import { useState, useEffect } from 'react';
import { 
  auth,
  db, 
  collection, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  handleFirestoreError,
  OperationType,
  getDocs,
  getDocsFromServer,
  testFirestoreConnection,
  limit
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { 
  Users, 
  Calendar, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  Check,
  PawPrint,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  CreditCard,
  Package,
  X,
  Stethoscope,
  Syringe,
  History,
  Bed,
  Scissors,
  Home,
  Activity,
  Search,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, subDays, isSameDay, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

const COLORS = ['#00b4d8', '#48cae4', '#90e0ef', '#ade8f4', '#caf0f8'];
import { cn } from '../lib/utils';

import { useClinic } from '../contexts/ClinicContext';
import { useAuth } from '../contexts/AuthContext';

import { StatCard, Card } from './ui/Card';
import AddPatientModal from './AddPatientModal';
import AddAppointmentModal from './AddAppointmentModal';

export default function Dashboard() {
  const throwError = useAsyncError();
  const { user, isAuthReady, userRole, isAdmin, isStaff } = useAuth();
  const { clinicName } = useClinic();
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  
  const calculateAge = (birthDateStr?: string) => {
    if (!birthDateStr) return '-';
    try {
      const birth = new Date(birthDateStr);
      const now = new Date();
      let year = now.getFullYear() - birth.getFullYear();
      let month = now.getMonth() - birth.getMonth();
      if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) {
        year--;
        month += 12;
      }
      if (year > 0) {
        return `${year} ปี ${month} เดือน`;
      }
      return `${month} เดือน`;
    } catch (e) {
      return '-';
    }
  };

  const formatThaiDateString = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      const monthsTh = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      const thaiYear = Number(y) + 543;
      return `${Number(d)} ${monthsTh[Number(m) - 1]} ${thaiYear}`;
    } catch (e) {
      return dateStr;
    }
  };
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalPatientsTrend: 0,
    todayAppointments: 0,
    todayAppointmentsTrend: 0,
    lowStockItems: 0,
    lowStockTrend: 0,
    monthlyRevenue: 0,
    monthlyRevenueTrend: 0
  });
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [topDiagnoses, setTopDiagnoses] = useState<any[]>([]);
  const [selectedTrend, setSelectedTrend] = useState<{ name: string; value: number; records: any[] } | null>(null);
  const [topMeds, setTopMeds] = useState<any[]>([]);
  const [uniquePatientsCount, setUniquePatientsCount] = useState(0);
  const [vaccinesCount, setVaccinesCount] = useState(0);
  const [patientsMap, setPatientsMap] = useState<Record<string, any>>({});
  const [outOfStockItems, setOutOfStockItems] = useState<any[]>([]);
  const [showStockModal, setShowStockModal] = useState(false);
  const [hasAlertedThisSession, setHasAlertedThisSession] = useState(false);
  const [uniquePatientIds, setUniquePatientIds] = useState<string[]>([]);
  const [showUniquePetsModal, setShowUniquePetsModal] = useState(false);
  const [uniquePetsSearchQuery, setUniquePetsSearchQuery] = useState('');
  const [isCustomDateActive, setIsCustomDateActive] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customUniquePatientIds, setCustomUniquePatientIds] = useState<string[]>([]);
  const [isCustomDateLoading, setIsCustomDateLoading] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [realtimeActive, setRealtimeActive] = useState({
    opd: 0,
    ipd: 0,
    grooming: 0,
    petCondo: 0,
  });

  useEffect(() => {
    if (!isAuthReady || !user || (!isStaff && !isAdmin)) return;

    let currentAllOpdDocs: any[] = [];
    let currentAllIpdDocs: any[] = [];
    let currentApptsDocs: any[] = [];
    let currentPublicDocs: any[] = [];
    let currentRoomDocs: any[] = [];

    const recalculateOpdAndGrooming = () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // GROOMING ACTIVE
      const publicGroomingToday = currentPublicDocs.filter(b => {
        const isBathing = ['bathing', 'grooming'].includes((b.serviceType || '').toLowerCase());
        const isConfirmed = ['confirmed', 'pending'].includes((b.status || '').toLowerCase());
        const isToday = b.requestedDate === todayStr;
        return isBathing && isConfirmed && isToday;
      });

      const apptsGroomingToday = currentApptsDocs.filter(a => {
        const act = (a.activities || '').toLowerCase();
        const isGroom = act.includes('groom') || act.includes('bath') || act.includes('อาบน้ำ') || act.includes('ตัดขน') || act.includes('สปา') || act.includes('spa');
        const isActive = a.status !== 'completed' && a.status !== 'cancelled';
        let isToday = false;
        if (a.startTime?.toDate) {
          isToday = format(a.startTime.toDate(), 'yyyy-MM-dd') === todayStr;
        } else if (a.requestedDate) {
          isToday = a.requestedDate === todayStr;
        } else {
          isToday = true;
        }
        return isGroom && isActive && isToday;
      });

      const totalGroomingActive = publicGroomingToday.length + apptsGroomingToday.length;

      // OPD ACTIVE
      const inProgressOpdCount = currentAllOpdDocs.filter(d => d.status === 'In Progress').length;

      const apptsTreatmentToday = currentApptsDocs.filter(a => {
        const act = (a.activities || '').toLowerCase();
        const isGroom = act.includes('groom') || act.includes('bath') || act.includes('อาบน้ำ') || act.includes('ตัดขน') || act.includes('สปา') || act.includes('spa');
        const isActive = a.status !== 'completed' && a.status !== 'cancelled';
        let isToday = false;
        if (a.startTime?.toDate) {
          isToday = format(a.startTime.toDate(), 'yyyy-MM-dd') === todayStr;
        } else if (a.requestedDate) {
          isToday = a.requestedDate === todayStr;
        } else {
          isToday = true;
        }
        return !isGroom && isActive && isToday;
      });

      const publicTreatmentToday = currentPublicDocs.filter(b => {
        const isBathing = ['bathing', 'grooming'].includes((b.serviceType || '').toLowerCase());
        const isConfirmed = ['confirmed', 'pending'].includes((b.status || '').toLowerCase());
        const isToday = b.requestedDate === todayStr;
        return !isBathing && isConfirmed && isToday;
      });

      const totalOpdActive = inProgressOpdCount + apptsTreatmentToday.length + publicTreatmentToday.length;

      setRealtimeActive(prev => ({
        ...prev,
        opd: totalOpdActive,
        grooming: totalGroomingActive
      }));

      // Calculate Daily Pet Visitors for every day of the selected month
      const targetMonthStart = startOfMonth(new Date(selectedYear, selectedMonth, 1));
      const targetMonthEnd = endOfMonth(new Date(selectedYear, selectedMonth, 1));
      const daysInSelectedMonth = eachDayOfInterval({ start: targetMonthStart, end: targetMonthEnd });

      const monthlyVisitors = daysInSelectedMonth.map((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        const dayOpds = currentAllOpdDocs.filter(o => {
          const d = o.dateVisit?.toDate ? o.dateVisit.toDate() : (o.dateVisit ? new Date(o.dateVisit) : null);
          return d && isSameDay(d, date);
        });

        const dayIpds = currentAllIpdDocs.filter(iDoc => {
          const d = iDoc.dateAdmit?.toDate ? iDoc.dateAdmit.toDate() : (iDoc.dateAdmit ? new Date(iDoc.dateAdmit) : null);
          return d && isSameDay(d, date);
        });

        const dayAppts = currentApptsDocs.filter(a => {
          if (a.status === 'cancelled') return false;
          const d = a.startTime?.toDate ? a.startTime.toDate() : (a.startTime ? new Date(a.startTime) : null);
          return d && isSameDay(d, date);
        });

        const dayPublics = currentPublicDocs.filter(b => {
          if (b.status === 'cancelled') return false;
          return b.requestedDate === dateStr;
        });

        const opdSet = new Set<string>();
        const ipdSet = new Set<string>();
        const groomingSet = new Set<string>();
        const condoSet = new Set<string>();
        const totalPetSet = new Set<string>();

        dayOpds.forEach(o => {
          const key = (o.patientId || o.petName || '').toLowerCase().trim();
          if (key) {
            totalPetSet.add(key);
            opdSet.add(key);
          }
        });

        dayIpds.forEach(iDoc => {
          const key = (iDoc.patientId || iDoc.petName || '').toLowerCase().trim();
          if (key) {
            totalPetSet.add(key);
            ipdSet.add(key);
          }
        });

        dayAppts.forEach(a => {
          const key = (a.patientName || a.patientId || '').toLowerCase().trim();
          if (!key) return;
          totalPetSet.add(key);
          const act = (a.activities || '').toLowerCase();
          const isGroom = act.includes('groom') || act.includes('bath') || act.includes('อาบน้ำ') || act.includes('ตัดขน') || act.includes('สปา') || act.includes('spa');
          if (isGroom) {
            groomingSet.add(key);
          } else {
            opdSet.add(key);
          }
        });

        dayPublics.forEach(b => {
          const key = (b.petName || '').toLowerCase().trim();
          if (!key) return;
          totalPetSet.add(key);
          const st = (b.serviceType || '').toLowerCase();
          if (['bathing', 'grooming'].includes(st)) {
            groomingSet.add(key);
          } else if (['hotel', 'boarding', 'condo', 'petcondo'].includes(st)) {
            condoSet.add(key);
          } else {
            opdSet.add(key);
          }
        });

        currentRoomDocs.forEach(r => {
          if (r.status === 'occupied' || r.currentBooking) {
            const cb = r.currentBooking;
            const petName = cb?.petName || r.petName;
            if (petName) {
              const key = petName.toLowerCase().trim();
              let isOccupiedOnDate = false;
              if (cb?.checkIn && cb?.checkOut) {
                const cIn = new Date(cb.checkIn);
                const cOut = new Date(cb.checkOut);
                isOccupiedOnDate = date >= cIn && date <= cOut;
              } else if (isSameDay(date, new Date()) && r.status === 'occupied') {
                isOccupiedOnDate = true;
              }
              if (isOccupiedOnDate) {
                totalPetSet.add(key);
                condoSet.add(key);
              }
            }
          }
        });

        return {
          name: format(date, 'd'),
          fullDate: format(date, 'dd/MM/yyyy'),
          count: totalPetSet.size,
          opd: opdSet.size,
          ipd: ipdSet.size,
          grooming: groomingSet.size,
          petCondo: condoSet.size
        };
      });

      setRevenueData(monthlyVisitors);
    };

    // 1. IPD Active Listener
    const unsubIpd = onSnapshot(collection(db, 'ipd_records'), (snap) => {
      currentAllIpdDocs = snap.docs.map(d => d.data());
      const activeIpd = snap.docs.filter(d => {
        const status = d.data().status;
        return status && status !== 'Discharged';
      }).length;
      setRealtimeActive(prev => ({ ...prev, ipd: activeIpd }));
      recalculateOpdAndGrooming();
    }, (err) => console.warn("IPD realtime listener warning:", err));

    // 2. Pet Rooms Active Listener
    const unsubRooms = onSnapshot(collection(db, 'pet_rooms'), (snapRooms) => {
      currentRoomDocs = snapRooms.docs.map(d => d.data());
      const occupiedRooms = snapRooms.docs.filter(d => d.data().status === 'occupied').length;
      setRealtimeActive(prev => ({ ...prev, petCondo: occupiedRooms }));
      recalculateOpdAndGrooming();
    }, (err) => console.warn("Pet rooms realtime listener warning:", err));

    // 3. OPD Records Listener
    const unsubOpdRecords = onSnapshot(collection(db, 'opd_records'), (snap) => {
      currentAllOpdDocs = snap.docs.map(d => d.data());
      recalculateOpdAndGrooming();
    }, (err) => console.warn("OPD records realtime listener warning:", err));

    // 4. Appointments Listener
    const unsubAppointments = onSnapshot(collection(db, 'appointments'), (snap) => {
      currentApptsDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recalculateOpdAndGrooming();
    }, (err) => console.warn("Appointments realtime listener warning:", err));

    // 5. Public Bookings Listener
    const unsubPublicBookings = onSnapshot(collection(db, 'public_bookings'), (snap) => {
      currentPublicDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recalculateOpdAndGrooming();
    }, (err) => console.warn("Public bookings realtime listener warning:", err));

    return () => {
      unsubIpd();
      unsubRooms();
      unsubOpdRecords();
      unsubAppointments();
      unsubPublicBookings();
    };
  }, [isAuthReady, user, isStaff, isAdmin, selectedMonth, selectedYear]);

  const [selectedTimelinePatient, setSelectedTimelinePatient] = useState<any | null>(null);
  const [patientTimelineData, setPatientTimelineData] = useState<any[]>([]);
  const [isPatientTimelineLoading, setIsPatientTimelineLoading] = useState(false);
  const [selectedTimelineDetailItem, setSelectedTimelineDetailItem] = useState<any | null>(null);

  const safeFormatDate = (rawDate: any, formatStr: string, fallback = '-') => {
    if (!rawDate) return fallback;
    try {
      let d: Date;
      if (typeof rawDate?.toDate === 'function') {
        d = rawDate.toDate();
      } else if (rawDate?.seconds !== undefined) {
        d = new Date(rawDate.seconds * 1000);
      } else if (rawDate instanceof Date) {
        d = rawDate;
      } else {
        d = new Date(rawDate);
      }
      if (isNaN(d.getTime())) return fallback;
      return format(d, formatStr);
    } catch (e) {
      return fallback;
    }
  };

  const fetchPatientTimeline = async (patientId?: string, targetHn?: string) => {
    setIsPatientTimelineLoading(true);
    setPatientTimelineData([]);
    try {
      let opdDocs: any[] = [];
      let ipdDocs: any[] = [];

      if (patientId && !patientId.startsWith('temp-')) {
        const opdQ = query(collection(db, 'opd_records'), where('patientId', '==', patientId));
        const ipdQ = query(collection(db, 'ipd_records'), where('patientId', '==', patientId));
        
        const [opdSnap, ipdSnap] = await Promise.all([
          getDocs(opdQ).catch(e => { console.warn("OPD fetch failed", e); return { docs: [] } as any; }),
          getDocs(ipdQ).catch(e => { console.warn("IPD fetch failed", e); return { docs: [] } as any; })
        ]);
        opdDocs = opdSnap?.docs || [];
        ipdDocs = ipdSnap?.docs || [];
      }

      if (opdDocs.length === 0 && ipdDocs.length === 0 && targetHn && targetHn !== '-') {
        const opdHnQ = query(collection(db, 'opd_records'), where('patientHn', '==', targetHn));
        const ipdHnQ = query(collection(db, 'ipd_records'), where('patientHn', '==', targetHn));
        
        const [opdSnap2, ipdSnap2] = await Promise.all([
          getDocs(opdHnQ).catch(e => { console.warn("OPD HN fetch failed", e); return { docs: [] } as any; }),
          getDocs(ipdHnQ).catch(e => { console.warn("IPD HN fetch failed", e); return { docs: [] } as any; })
        ]);
        opdDocs = opdSnap2?.docs || [];
        ipdDocs = ipdSnap2?.docs || [];
      }

      const opdItems = opdDocs.map((doc: any) => {
        const d = doc.data();
        return { 
          id: doc.id, 
          type: 'OPD', 
          date: d.dateVisit, 
          title: d.category || 'OPD Treatment',
          description: d.finalDiagnosis || d.symptoms || d.treatmentPlan || '-',
          diagnosis: d.finalDiagnosis || d.diagnosis || d.category || 'OPD Treatment',
          symptoms: d.symptoms || '-',
          treatmentPlan: d.treatmentPlan || d.treatmentNote || '-',
          vitals: d.vitals || { weight: d.weight, temp: d.temperature, hr: d.heartRate, rr: d.respRate },
          vetName: d.vetName || d.vet || '-',
          medications: d.medications || d.items || [],
          items: d.items || [],
          rawData: d
        };
      });
      
      const ipdItems = ipdDocs.map((doc: any) => {
        const d = doc.data();
        return { 
          id: doc.id, 
          type: 'IPD', 
          date: d.dateAdmit, 
          title: 'IPD Admit (รับแอดมิท)',
          description: d.diagnosis || d.symptoms || '-',
          diagnosis: d.diagnosis || 'IPD Record',
          symptoms: d.symptoms || '-',
          treatmentPlan: d.activeTreatmentPlan || d.treatmentPlan || '-',
          vitals: d.vitals || { weight: d.weight, temp: d.temperature, hr: d.heartRate, rr: d.respRate },
          vetName: d.vetName || d.vet || '-',
          status: d.status,
          medications: d.medications || d.items || [],
          items: d.items || [],
          rawData: d
        };
      });

      const combined = [...opdItems, ...ipdItems].sort((a, b) => {
        const getTime = (d: any) => {
          if (!d) return 0;
          if (typeof d.toDate === 'function') return d.toDate().getTime();
          if (d.seconds !== undefined) return d.seconds * 1000;
          const parsed = new Date(d).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        return getTime(b.date) - getTime(a.date);
      });

      setPatientTimelineData(combined);
    } catch (err) {
      console.warn("Timeline fetch error:", err);
      setPatientTimelineData([]);
    } finally {
      setIsPatientTimelineLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTimelinePatient) {
      fetchPatientTimeline(selectedTimelinePatient.id, selectedTimelinePatient.hn);
    }
  }, [selectedTimelinePatient]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const fetchTrendsData = async () => {
      try {
        const monthStart = new Date(selectedYear, selectedMonth, 1);
        const monthEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);

        // Fetch OPD records for the selected month/year
        const trendOpdSnap = await getDocs(query(
          collection(db, 'opd_records'), 
          where('dateVisit', '>=', monthStart),
          where('dateVisit', '<=', monthEnd)
        )).catch(e => { 
          console.warn("Trend OPD fetch denied", e); 
          return { size: 0, docs: [] }; 
        }) as any;

        const opds = trendOpdSnap.docs.map((doc: any) => doc.data());
        
        // Calculate Unique Patients
        const uniqueIds = Array.from(new Set(opds.filter((o: any) => o.patientId).map((o: any) => o.patientId))) as string[];
        setUniquePatientsCount(uniqueIds.length);
        setUniquePatientIds(uniqueIds);

        // Calculate Vaccines (Placeholder keyword check)
        let vCount = 0;
        opds.forEach((o: any) => {
          if (o.items) {
            o.items.forEach((it: any) => {
              const nameLower = (it.name || '').toLowerCase();
              if (it.category === 'Service' && (nameLower.includes('vaccine') || nameLower.includes('วัคซีน'))) {
                vCount += (it.quantity || 1);
              } else if (it.category === 'Medicine' && (nameLower.includes('vaccine') || nameLower.includes('วัคซีน'))) {
                vCount += (it.quantity || 1);
              }
            });
          }
        });
        setVaccinesCount(vCount);

        // Update Diagnoses & Health Trends
        const diagMap: Record<string, { count: number; records: any[] }> = {};
        opds.forEach((o: any) => {
          const diagName = o.finalDiagnosis || o.chiefComplaint || (o.items?.[0]?.name ? `บริการ: ${o.items[0].name}` : null);
          if (diagName) {
            const cleanName = diagName.trim();
            if (!diagMap[cleanName]) {
              diagMap[cleanName] = { count: 0, records: [] };
            }
            diagMap[cleanName].count += 1;
            diagMap[cleanName].records.push(o);
          }
        });
        const diags = Object.entries(diagMap)
          .map(([name, data]) => ({ name, value: data.count, records: data.records }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);
        setTopDiagnoses(diags);

        // Update Meds
        const medMap: Record<string, number> = {};
        opds.forEach((o: any) => {
          if (o.items) {
            o.items.forEach((it: any) => {
              if (it.category === 'Medicine') {
                medMap[it.name] = (medMap[it.name] || 0) + (it.quantity || 1);
              }
            });
          }
        });
        const meds = Object.entries(medMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        setTopMeds(meds);

      } catch (err) {
        console.warn("Error fetching trends data:", err);
      }
    };

    fetchTrendsData();
  }, [selectedMonth, selectedYear, isAuthReady, user, isStaff, isAdmin]);

  const fetchRangeUniquePets = async (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return;
    setIsCustomDateLoading(true);
    try {
      const startParts = startStr.split('-');
      const endParts = endStr.split('-');
      
      const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]), 0, 0, 0, 0);
      const end = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]), 23, 59, 59, 999);
      
      const q = query(
        collection(db, 'opd_records'),
        where('dateVisit', '>=', start),
        where('dateVisit', '<=', end)
      );
      
      const snap = await getDocs(q);
      const docs = snap.docs.map((d: any) => d.data());
      
      const uniqueIds = Array.from(new Set(docs.filter((o: any) => o.patientId).map((o: any) => o.patientId))) as string[];
      setCustomUniquePatientIds(uniqueIds);
      setIsCustomDateActive(true);
    } catch (err) {
      console.error("Failed to fetch custom date range unique pets:", err);
    } finally {
      setIsCustomDateLoading(false);
    }
  };

  useEffect(() => {
    if (showUniquePetsModal) {
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0);
      
      const formatLocal = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const r = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${r}`;
      };
      
      setCustomStartDate(formatLocal(start));
      setCustomEndDate(formatLocal(end));
      setIsCustomDateActive(false);
      setCustomUniquePatientIds([]);
    }
  }, [showUniquePetsModal, selectedMonth, selectedYear]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    // Safety timeout to ensure loading spinner doesn't get stuck
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const fetchDashboardData = async () => {
      // Test connection first
      testFirestoreConnection();
      
      try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayEnd);
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Check staff permissions before fetching sensitive data
        if (!isStaff && !isAdmin) {
          console.warn("User is not staff or admin, skipping sensitive dashboard data fetch");
          setLoading(false);
          return;
        }

        // Fetch Data
        const [
          patientsSnap, 
          inventorySnap, 
          todayApptsSnap, 
          yesterdayApptsSnap,
          thisMonthOpdSnap,
          lastMonthOpdSnap,
          salesSnap,
          outOfStockSnap
        ] = await Promise.all([
          getDocs(collection(db, 'patients')).catch(e => { console.warn("Patients fetch denied (non-critical)", e); return { size: 0, docs: [] }; }),
          getDocs(collection(db, 'inventory')).catch(e => { console.warn("Inventory fetch denied (non-critical)", e); return { size: 0, docs: [] }; }),
          getDocs(query(collection(db, 'appointments'), where('startTime', '>=', todayStart), where('startTime', '<=', todayEnd))).catch(e => { console.warn("Appointments fetch denied (non-critical)", e); return { size: 0, docs: [] }; }),
          getDocs(query(collection(db, 'appointments'), where('startTime', '>=', yesterdayStart), where('startTime', '<=', yesterdayEnd))).catch(e => { console.warn("Appointments (yesterday) fetch denied (non-critical)", e); return { size: 0, docs: [] }; }),
          getDocs(query(collection(db, 'opd_records'), where('dateVisit', '>=', thisMonthStart))).catch(e => { console.warn("OPD fetch denied (non-critical)", e); return { size: 0, docs: [] }; }),
          getDocs(query(collection(db, 'opd_records'), where('dateVisit', '>=', lastMonthStart), where('dateVisit', '<=', lastMonthEnd))).catch(e => { console.warn("OPD (last month) fetch denied (non-critical)", e); return { size: 0, docs: [] }; }),
          getDocs(query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(100))).catch(e => { console.warn("Sales fetch denied (non-critical)", e); return { size: 0, docs: [] }; }),
          getDocs(collection(db, 'inventory')).catch(e => { console.warn("Inventory fetch denied (non-critical)", e); return { size: 0, docs: [] }; })
        ]) as any[];

        const inventoryData = inventorySnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const outOfStock = inventoryData.filter((item: any) => 
          item.isInStock === false || (item.currentStock !== undefined && item.currentStock <= (item.minStock || 0))
        );
        setOutOfStockItems(outOfStock);

        // Check for critical items to show modal
        if (outOfStock.length > 0 && !hasAlertedThisSession) {
          setShowStockModal(true);
          setHasAlertedThisSession(true);
        }

        // 1. Total Patients Trend
        const totalPatients = patientsSnap.size;
        const patientsBefore30Days = patientsSnap.docs.filter(doc => {
          const createdAt = doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt);
          return createdAt < thirtyDaysAgo;
        }).length;
        const totalPatientsTrend = patientsBefore30Days === 0 
          ? (totalPatients > 0 ? 100 : 0) 
          : ((totalPatients - patientsBefore30Days) / patientsBefore30Days) * 100;

        // 2. Today's Appts Progress
        const todayApptsDocs = todayApptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const todayApptsCount = todayApptsDocs.length;
        const completedToday = todayApptsDocs.filter((a: any) => a.status === 'completed').length;
        const todayProgress = todayApptsCount > 0 
          ? (completedToday / todayApptsCount) * 100 
          : 0;

        // 3. Low Stock
        const lowStockItems = inventorySnap.docs.filter(doc => doc.data().quantity <= doc.data().minStock).length;
        const totalItems = inventorySnap.size;
        const lowStockPercent = totalItems > 0 ? (lowStockItems / totalItems) * 100 : 0;

        // 4. Monthly Revenue
        const monthlyRevenue = thisMonthOpdSnap.docs.reduce((sum, doc) => sum + (doc.data().revenue || 0), 0);
        const lastMonthRevenue = lastMonthOpdSnap.docs.reduce((sum, doc) => sum + (doc.data().revenue || 0), 0);
        const monthlyRevenueTrend = lastMonthRevenue === 0 
          ? (monthlyRevenue > 0 ? 100 : 0) 
          : ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;

        const pMap: Record<string, any> = {};
        patientsSnap.docs.forEach(doc => {
          pMap[doc.id] = { id: doc.id, ...doc.data() };
        });
        setPatientsMap(pMap);

        setStats({
          totalPatients,
          totalPatientsTrend,
          todayAppointments: todayApptsCount,
          todayAppointmentsTrend: todayProgress,
          lowStockItems,
          lowStockTrend: lowStockPercent,
          monthlyRevenue,
          monthlyRevenueTrend
        });

        // Revenue Graph Data
        const sales = salesSnap.docs.map(doc => doc.data());
        const last7Days = Array.from({ length: 7 }).map((_, i) => {
          const date = subDays(new Date(), i);
          const daySales = sales.filter(s => s.createdAt?.toDate && isSameDay(s.createdAt.toDate(), date));
          return {
            name: format(date, 'EEE'),
            revenue: daySales.reduce((sum, s) => sum + (s.total || 0), 0)
          };
        }).reverse();
        setRevenueData(last7Days);

        // Sort today's schedule
        const sortedSchedule = todayApptsDocs
          .sort((a: any, b: any) => {
            const timeA = a.startTime?.toDate?.() || new Date(a.startTime);
            const timeB = b.startTime?.toDate?.() || new Date(b.startTime);
            return timeA.getTime() - timeB.getTime();
          });
        
        setTodaySchedule(sortedSchedule);
        setLoading(false);
      } catch (err: any) {
        console.warn("Dashboard data fetch warning (check permissions):", err);
        setLoading(false);
      }
    };

    fetchDashboardData();
    return () => clearTimeout(timeoutId);
  }, [isAuthReady, user, isStaff, isAdmin]);

  const statCards = [
    { 
      label: 'OPD Active Cases', 
      value: realtimeActive.opd, 
      icon: Stethoscope, 
      color: 'bg-sky-500', 
      trend: 'Real-time', 
      isUp: true,
      description: 'เคส OPD ที่กำลังรักษา/รอตรวจ'
    },
    { 
      label: 'IPD Admitted', 
      value: realtimeActive.ipd, 
      icon: Bed, 
      color: 'bg-indigo-500', 
      trend: 'Real-time', 
      isUp: true,
      description: 'ผู้ป่วยครองเตียงแอดมิทปัจจุบัน'
    },
    { 
      label: 'Grooming Active', 
      value: realtimeActive.grooming, 
      icon: Scissors, 
      color: 'bg-rose-500', 
      trend: 'Real-time', 
      isUp: true,
      description: 'คิวอาบน้ำ/ตัดขนที่ยังไม่เสร็จ'
    },
    { 
      label: 'Pet Condo Occupied', 
      value: realtimeActive.petCondo, 
      icon: Home, 
      color: 'bg-amber-500', 
      trend: 'Real-time', 
      isUp: true,
      description: 'ห้องพักฝากเลี้ยงที่มีสัตว์เข้าพัก'
    },
  ];

  return (
    <div className="space-y-8">
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 font-bold animate-pulse">Loading Dashboard...</p>
          </div>
        </div>
      )}
      {/* Welcome Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">{clinicName} Overview</h1>
        <p className="text-slate-500">Welcome back! Here's what's happening at the clinic today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <StatCard
            key={`${stat.label}-${i}`}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            trend={stat.trend}
            isUp={stat.isUp}
            description={stat.description}
            delay={i * 0.1}
          />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Daily Pet Visitors</h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    จำนวนสัตว์ที่เข้ามารับบริการรายวัน ({format(new Date(selectedYear, selectedMonth, 1), 'MMM yyyy')})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                    <select 
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="text-[10px] font-black uppercase tracking-widest bg-transparent border-none outline-none focus:ring-0 text-slate-700 cursor-pointer"
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={`dash-opt-m-${i}`} value={i}>{format(new Date(2024, i, 1), 'MMM')}</option>
                      ))}
                    </select>
                    <select 
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="text-[10px] font-black uppercase tracking-widest bg-transparent border-none outline-none focus:ring-0 text-slate-700 cursor-pointer"
                    >
                      {Array.from({ length: 3 }).map((_, i) => {
                        const year = new Date().getFullYear() - 1 + i;
                        return <option key={`dash-opt-y-${year}-${i}`} value={year}>{year}</option>;
                      })}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100 shrink-0">
                    <PawPrint className="w-3.5 h-3.5 text-sky-500" />
                    <span className="text-xs font-black text-sky-700">
                      {selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear() ? (
                        <>วันนี้: {revenueData.find(d => d.fullDate === format(new Date(), 'dd/MM/yyyy'))?.count || 0} ตัว</>
                      ) : (
                        <>รวมเดือนนี้: {revenueData.reduce((acc, curr) => acc + (curr.count || 0), 0)} ตัว</>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      interval="preserveStartEnd"
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                    />
                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <Tooltip 
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-slate-100 min-w-[210px] text-xs space-y-2 z-50">
                              <div className="font-black text-slate-800 text-xs border-b border-slate-100 pb-2 flex items-center justify-between">
                                <span>วันที่ {data.fullDate}</span>
                                <span className="text-sky-600 font-bold bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100">
                                  รวม {data.count} ตัว
                                </span>
                              </div>
                              <div className="space-y-1.5 font-medium pt-0.5">
                                <div className="flex items-center justify-between text-slate-600">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                                    OPD (ตรวจรักษา):
                                  </span>
                                  <span className="font-black text-slate-800">{data.opd || 0} ตัว</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-600">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                    IPD (ผู้ป่วยใน):
                                  </span>
                                  <span className="font-black text-slate-800">{data.ipd || 0} ตัว</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-600">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                    Grooming (อาบน้ำ/ตัดขน):
                                  </span>
                                  <span className="font-black text-slate-800">{data.grooming || 0} ตัว</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-600">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    Pet Condo (ฝากเลี้ยง):
                                  </span>
                                  <span className="font-black text-slate-800">{data.petCondo || 0} ตัว</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#00b4d8" strokeWidth={3} fill="#00b4d8" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-50/50 rounded-2xl p-6 flex flex-col justify-center gap-6">
              <div 
                onClick={() => {
                  if (uniquePatientIds.length > 0) {
                    setShowUniquePetsModal(true);
                  }
                }}
                className={cn(
                  "space-y-1 p-3 -m-3 rounded-2xl transition-all select-none group border border-transparent",
                  uniquePatientIds.length > 0 
                    ? "hover:bg-sky-50 cursor-pointer hover:border-sky-100 active:scale-[0.98]" 
                    : ""
                )}
                title={uniquePatientIds.length > 0 ? "คลิกเพื่อดูรายชื่อสัตว์" : ""}
              >
                <div className="flex items-center gap-2 text-sky-500 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-sky-600 transition-colors">Monthly Analysis</span>
                  {uniquePatientIds.length > 0 && (
                    <span className="text-[9px] bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full font-black ml-auto leading-none uppercase tracking-tight">ดูรายชื่อ</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 group-hover:text-sky-700 transition-colors">{uniquePatientsCount}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase">Unique Pets</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Distinct pets treated in {format(new Date(selectedYear, selectedMonth, 1), 'MMMM')}</p>
              </div>

              <div className="h-px bg-slate-100" />

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-500 mb-1">
                  <Plus className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prevention</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{vaccinesCount}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase">Vaccines</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Total vaccination services administered</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Health Trends</h3>
            <div className="flex items-center gap-2">
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="text-[10px] font-black uppercase tracking-widest bg-slate-50 border-none rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-sky-400"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={`trend-month-${i}`} value={i}>{format(new Date(2024, i, 1), 'MMM')}</option>
                ))}
              </select>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="text-[10px] font-black uppercase tracking-widest bg-slate-50 border-none rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-sky-400"
              >
                {Array.from({ length: 3 }).map((_, i) => {
                  const year = new Date().getFullYear() - 1 + i;
                  return <option key={`trend-year-${year}`} value={year}>{year}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {topDiagnoses.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-medium">
                ไม่มีข้อมูล Health Trends ในช่วงเดือนนี้
              </div>
            ) : (
              topDiagnoses.map((diag, i) => (
                <div 
                  key={`top-diag-${diag.name}-${i}`} 
                  onClick={() => setSelectedTrend(diag)}
                  className="p-3 bg-slate-50 hover:bg-sky-50/80 border border-slate-100 hover:border-sky-200 rounded-2xl cursor-pointer transition-all space-y-2 group shadow-2xs"
                  title="คลิกเพื่อดูประวัติสัตว์ป่วยย้อนหลัง"
                >
                  <div className="flex items-center justify-between text-xs font-bold gap-3">
                    <div className="flex-1 overflow-hidden relative min-w-0">
                      {diag.name.length > 28 ? (
                        <div className="overflow-hidden whitespace-nowrap relative">
                          <div className="inline-flex animate-marquee group-hover:[animation-play-state:paused] whitespace-nowrap">
                            <span className="text-slate-700 font-bold pr-8">{diag.name}</span>
                            <span className="text-slate-700 font-bold pr-8">{diag.name}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-700 font-bold block truncate">{diag.name}</span>
                      )}
                    </div>
                    <span className="text-sky-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-[11px] font-mono font-black shrink-0 shadow-2xs">
                      {diag.value} ราย
                    </span>
                  </div>

                  <div className="h-2 bg-slate-200/60 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#00b4d8] rounded-full transition-all duration-500" 
                      style={{ width: `${Math.max(10, (diag.value / (topDiagnoses[0]?.value || 1)) * 100)}%` }} 
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                    <span className="group-hover:text-sky-600 flex items-center gap-1 transition-colors font-semibold">
                      <Search className="w-3 h-3 text-sky-500" /> คลิกดูสัตว์ป่วย ({diag.records?.length || diag.value} ตัว)
                    </span>
                    <span className="text-slate-400 font-mono font-bold">
                      {((diag.value / (topDiagnoses.reduce((acc: number, d: any) => acc + d.value, 0) || 1)) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Schedule */}
        <Card 
          title="Today's Schedule" 
          headerAction={<button className="text-indigo-600 text-sm font-bold hover:underline">View All</button>}
          className="lg:col-span-2"
        >
          <div className="space-y-6">
            {todaySchedule.length > 0 ? (
              todaySchedule.map((appt, i) => {
                const patient = patientsMap[appt.patientId];
                return (
                  <div key={`appt-${appt.id}-${i}`} className="flex items-center gap-4 group">
                    <div className="w-20 text-sm font-bold text-slate-400">
                      {appt.startTime?.toDate ? format(appt.startTime.toDate(), 'hh:mm a') : format(new Date(appt.startTime), 'hh:mm a')}
                    </div>
                    <div className="flex-1 bg-slate-50 p-4 rounded-2xl flex items-center justify-between hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm overflow-hidden border border-slate-100">
                          {patient?.photoURL ? (
                            <img 
                              src={patient.photoURL} 
                              className="w-full h-full object-cover" 
                              alt={appt.patientName}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <PawPrint className="w-6 h-6 text-indigo-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">{appt.patientName}</p>
                            <span className="text-[10px] text-slate-400 font-bold">HN: {patient?.hn || '-'}</span>
                          </div>
                          <p className="text-xs text-slate-500">{appt.serviceType} • {appt.doctorName}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                          appt.status === 'completed' ? "bg-emerald-100 text-emerald-600" :
                          appt.status === 'confirmed' ? "bg-blue-100 text-blue-600" :
                          appt.status === 'pending' ? "bg-amber-100 text-amber-600" :
                          appt.status === 'rescheduled' ? "bg-purple-100 text-purple-600" :
                          appt.status === 'no-show' ? "bg-rose-100 text-rose-600" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {appt.status}
                        </span>
                        {appt.status === 'rescheduled' && (
                          <span className="text-[9px] text-purple-400 font-bold italic">Rescheduled</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-slate-400 font-bold">No appointments for today</p>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions & Notifications */}
        <div className="space-y-8">
          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsAddAppointmentModalOpen(true)}
                className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Appt
              </button>
              <button 
                onClick={() => setIsAddPatientModalOpen(true)}
                className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Add Patient
              </button>
              <button className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-2">
                <CreditCard className="w-4 h-4" />
                New Bill
              </button>
              <button className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-2">
                <Package className="w-4 h-4" />
                Stock In
              </button>
            </div>
          </div>

          <Card title="Inventory Alerts">
            <div className="space-y-4">
              {outOfStockItems.length > 0 ? (
                outOfStockItems.map((item, i) => (
                  <div key={`out-stock-${item.id}-${i}`} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100 animate-pulse">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.name}</p>
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "text-xs font-black uppercase tracking-wider",
                          item.currentStock === 0 ? "text-rose-600" : "text-amber-600"
                        )}>
                          {item.currentStock === 0 ? "Out of Stock (หมด)" : `Low Stock: ${item.currentStock}`}
                        </p>
                        <span className="text-[10px] text-slate-400 font-bold tracking-tighter">(Min: {item.minStock || 0})</span>
                      </div>
                    </div>
                    <AlertTriangle className={cn(
                      "w-5 h-5",
                      item.currentStock === 0 ? "text-rose-500 fill-rose-500/10" : "text-amber-500 fill-amber-500/10"
                    )} />
                  </div>
                ))
              ) : (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">All Items in Stock</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <AddPatientModal 
        isOpen={isAddPatientModalOpen} 
        onClose={() => setIsAddPatientModalOpen(false)} 
      />

      <AddAppointmentModal 
        isOpen={isAddAppointmentModalOpen} 
        onClose={() => setIsAddAppointmentModalOpen(false)} 
      />

      <AnimatePresence>
        {showStockModal && outOfStockItems.length > 0 && (
          <div key="modal-wrapper-stock" className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-left">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStockModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center animate-bounce shadow-inner">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">CRITICAL STOCK INFO!</h3>
                    <p className="text-sm text-slate-400 font-bold">ยาบางรายการใกล้หมดหรือหมดแล้ว</p>
                  </div>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto px-1">
                  {outOfStockItems.map((item, i) => (
                    <div key={`modal-alert-${item.id}-${i}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-rose-50 hover:border-rose-100 transition-all cursor-default">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          item.currentStock === 0 ? "bg-rose-500 animate-ping" : "bg-amber-500"
                        )} />
                        <div>
                          <p className="text-[15px] font-black text-slate-800">{item.name}</p>
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">
                            QTY: <span className={cn(item.currentStock === 0 ? "text-rose-500" : "text-amber-500")}>
                                {item.currentStock}
                              </span> 
                            <span className="mx-1">/</span> 
                            MIN: {item.minStock || 0}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        item.currentStock === 0 ? "bg-rose-100 text-rose-500" : "bg-amber-100 text-amber-500"
                      )}>
                        {item.currentStock === 0 ? "EMPTY" : "LOW"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button 
                    onClick={() => setShowStockModal(false)}
                    className="py-4 px-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all uppercase text-xs tracking-widest"
                  >
                    Close
                  </button>
                  <button 
                    onClick={() => {
                      setShowStockModal(false);
                      // In this app, navigation is likely handled by tab/mode state in App.tsx
                      // Since we can't easily trigger a state change in parent App.tsx here without props,
                      // we'll assume the user can navigate via the sidebar link.
                      // However, to be more helpful, we'll try to set a flag in storage.
                      localStorage.setItem('redirect_to_product', 'true');
                      // Most AI Studio templates use a central "activeTab" in App.tsx
                    }}
                    className="py-4 px-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all shadow-xl shadow-slate-200 uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                  >
                    Update Stock
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showUniquePetsModal && (
          <div key="modal-wrapper-unique-pets" className="fixed inset-0 z-[120] flex items-center justify-center p-4 text-left">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowUniquePetsModal(false);
                setUniquePetsSearchQuery('');
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="px-8 py-6 border-b border-sky-100 bg-gradient-to-r from-sky-50/50 to-indigo-50/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">รายชื่อสัตว์เลี้ยง (Unique Pets)</h3>
                    <p className="text-[11px] text-slate-405 font-bold uppercase tracking-wider">
                      {isCustomDateActive ? (
                        <span className="text-sky-600 font-extrabold flex items-center gap-1.5 normal-case">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
                          ช่วงวันที่เลือก: {formatThaiDateString(customStartDate)} - {formatThaiDateString(customEndDate)}
                        </span>
                      ) : (
                        `ประจำความเคลื่อนไหว ${['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][selectedMonth]} ${selectedYear + 543} (${format(new Date(selectedYear, selectedMonth, 1), 'MMMM yyyy')})`
                      )}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowUniquePetsModal(false);
                    setUniquePetsSearchQuery('');
                  }}
                  className="p-2.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all font-black font-extrabold"
                >
                  ✕
                </button>
              </div>

              {/* Custom Date Range Filter HUD */}
              <div className="px-8 py-4 bg-sky-50/30 border-b border-sky-100/60 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-2.5 cursor-pointer select-none"
                    onClick={() => {
                      if (isCustomDateActive) {
                        setIsCustomDateActive(false);
                      } else {
                        fetchRangeUniquePets(customStartDate, customEndDate);
                      }
                    }}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-all",
                      isCustomDateActive ? "border-sky-500 bg-sky-500" : "border-slate-300 bg-white"
                    )}>
                      {isCustomDateActive && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                      กำหนดช่วงวันที่เอง (Custom Date Range)
                    </span>
                  </div>

                  {isCustomDateActive && (
                    <button 
                      onClick={() => {
                        setIsCustomDateActive(false);
                      }}
                      className="text-[10px] bg-sky-100 hover:bg-sky-200 text-sky-700 px-2.5 py-1 rounded-lg font-black uppercase transition-all duration-200"
                    >
                      ย้อนกลับไปใช้รายเดือน
                    </button>
                  )}
                </div>

                <div className="flex items-end gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-[130px]">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">วันที่เริ่มต้น</span>
                    <input 
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-sky-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none transition-all shadow-xs"
                    />
                  </div>

                  <div className="flex-1 min-w-[130px]">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">วันที่สิ้นสุด</span>
                    <input 
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-sky-305 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none transition-all shadow-xs"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isCustomDateLoading}
                    onClick={() => fetchRangeUniquePets(customStartDate, customEndDate)}
                    className="h-[38px] px-5 bg-sky-500 hover:bg-sky-600 active:scale-95 disabled:bg-sky-300 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-sky-150 shrink-0"
                  >
                    {isCustomDateLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>กำลังดึงข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <span>ดึงข้อมูล</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Subheader */}
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ทั้งหมด:</span>
                  <span className="px-3 py-1 bg-sky-500 text-white rounded-full text-xs font-black shadow-sm">
                    {(isCustomDateActive ? customUniquePatientIds : uniquePatientIds).length} รายการ
                  </span>
                </div>
                
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="ค้นหาตาม ชื่อ/HN/เจ้าของ..."
                    value={uniquePetsSearchQuery}
                    onChange={(e) => setUniquePetsSearchQuery(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 focus:border-sky-305 rounded-xl outline-none transition-all placeholder-slate-400 text-xs font-bold text-slate-700 shadow-xs"
                  />
                  {uniquePetsSearchQuery ? (
                    <button 
                      onClick={() => setUniquePetsSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black"
                    >
                      ยกเลิก
                    </button>
                  ) : (
                    <Users className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  )}
                </div>
              </div>

              {/* Patient List */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-3 bg-slate-50/30">
                {(() => {
                  const queryLower = uniquePetsSearchQuery.trim().toLowerCase();
                  const targetList = isCustomDateActive ? customUniquePatientIds : uniquePatientIds;
                  const filteredPatients = targetList
                    .map(id => patientsMap[id])
                    .filter(Boolean)
                    .filter(patient => {
                      if (!queryLower) return true;
                      const nameMatch = (patient.name || '').toLowerCase().includes(queryLower);
                      const hnMatch = (patient.hn || '').toLowerCase().includes(queryLower);
                      const ownerMatch = (patient.ownerName || '').toLowerCase().includes(queryLower);
                      const breedMatch = (patient.breed || '').toLowerCase().includes(queryLower);
                      return nameMatch || hnMatch || ownerMatch || breedMatch;
                    });

                  if (filteredPatients.length === 0) {
                    return (
                      <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-6">
                        <PawPrint className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
                        <h4 className="text-sm font-black text-slate-700 mb-1">ไม่พบข้อมูลสัตว์เลี้ยง</h4>
                        <p className="text-xs text-slate-400">ระบุชื่อ, HN, หรือผู้ปกครองเพื่อค้นหาใหม่อีกครั้ง</p>
                      </div>
                    );
                  }

                  return filteredPatients.map((patient, index) => {
                    const petAge = patient.birthDate ? calculateAge(patient.birthDate) : '-';
                    return (
                      <div 
                        key={`unique-pet-row-${patient.id}-${index}`}
                        className="p-5 bg-white rounded-2xl border border-slate-100 hover:border-sky-200 hover:shadow-md transition-all duration-200 flex items-center justify-between gap-4 group"
                      >
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-sky-50 group-hover:border-sky-100 transition-colors">
                            {patient.gender === 'Male' ? (
                              <span className="text-blue-500 font-extrabold text-sm font-sans">♂</span>
                            ) : patient.gender === 'Female' ? (
                              <span className="text-rose-500 font-extrabold text-sm font-sans">♀</span>
                            ) : (
                              <PawPrint className="w-5 h-5 text-slate-450" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              <span 
                                onClick={() => setSelectedTimelinePatient(patient)} 
                                className="font-extrabold text-sm text-slate-800 hover:text-sky-600 hover:underline cursor-pointer transition-colors leading-none inline-flex items-center gap-1.5"
                                title="คลิกเพื่อดูประวัติการรักษา (Timeline)"
                              >
                                {patient.name || '-'}
                                <History className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-500 transition-colors" />
                              </span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] font-black font-mono leading-none tracking-tight">HN: {patient.hn || '-'}</span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-[11px] text-slate-400 font-bold">
                              <span>สายพันธุ์: <strong className="text-slate-600">{patient.breed || '-'}</strong></span>
                              <span className="text-slate-300">•</span>
                              <span>อายุ: <strong className="text-slate-600">{petAge}</strong></span>
                              <span className="text-slate-300">•</span>
                              <span>เพศ: <strong className="text-slate-600">{patient.gender === 'Male' ? 'ผู้' : patient.gender === 'Female' ? 'เมีย' : patient.gender || 'ไม่ระบุ'}</strong></span>
                            </div>
                            
                            <div className="mt-1 text-[11px] text-slate-400">
                              เจ้าของ: <span className="text-slate-600 font-bold">{patient.ownerName || '-'}</span> {patient.ownerPhone && <span className="text-[10px] text-slate-400">({patient.ownerPhone})</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="px-2.5 py-1 bg-sky-50 text-sky-600 border border-sky-100 rounded-lg text-[9px] font-black uppercase tracking-tight">
                            วิเคราะห์รายเดือน
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => {
                    setShowUniquePetsModal(false);
                    setUniquePetsSearchQuery('');
                  }}
                  className="px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-slate-200"
                >
                  ปิดหน้าต่าง (Close)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Patient History Timeline Sub-Modal */}
      <AnimatePresence>
        {selectedTimelinePatient && (
          <div key={`modal-wrapper-timeline-patient-${selectedTimelinePatient.id || 'pt'}`} className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            {/* Backdrop with blur styling */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl h-[85vh] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden relative z-10"
            >
              {/* Header */}
              <div className="p-6 md:p-8 bg-white border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-500 shadow-sm border border-sky-100 shrink-0">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-lg text-slate-800 leading-none">
                        {selectedTimelinePatient.name || '-'}
                      </h3>
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-550 rounded-md text-[9px] font-black font-mono tracking-tight leading-none">
                        HN: {selectedTimelinePatient.hn || '-'}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                      ประวัติการรักษาแบบ Timeline (Treatment Timeline)
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedTimelinePatient(null)}
                  className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors outline-none shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Patient Quick Stats Card */}
              <div className="mx-6 md:mx-8 mt-5 p-4 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">สายพันธุ์ / พันธุ์</span>
                  <span className="text-xs font-black text-slate-700 block truncate">{selectedTimelinePatient.breed || '-'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">อายุ</span>
                  <span className="text-xs font-black text-slate-700 block truncate">{selectedTimelinePatient.birthDate ? calculateAge(selectedTimelinePatient.birthDate) : '-'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">เพศ</span>
                  <span className="text-xs font-black text-slate-700 block truncate">
                    {selectedTimelinePatient.gender === 'Male' ? 'ผู้ (♂)' : selectedTimelinePatient.gender === 'Female' ? 'เมีย (♀)' : selectedTimelinePatient.gender || 'ไม่ระบุ'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">เจ้าของ</span>
                  <span className="text-xs font-black text-slate-700 block truncate">
                    {selectedTimelinePatient.ownerName || '-'}
                  </span>
                </div>
              </div>

              {/* Timeline Container */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {isPatientTimelineLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-8 h-8 border-3 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">กำลังดึงข้อมูลประวัติ...</p>
                  </div>
                ) : patientTimelineData.length > 0 ? (
                  <div className="space-y-6 relative before:absolute before:left-[31px] before:top-4 before:bottom-4 before:w-[3px] before:bg-gradient-to-b before:from-amber-400 before:via-sky-400 before:to-indigo-500 before:rounded-full before:opacity-70">
                    {patientTimelineData.map((item, i) => {
                      const isOPD = item.type === 'OPD';
                      const monthStr = safeFormatDate(item.date, 'MMM', '-').toUpperCase();
                      const dayStr = safeFormatDate(item.date, 'dd', '-');
                      const yearStr = safeFormatDate(item.date, 'yyyy', '-');
                      const timeStr = safeFormatDate(item.date, 'HH:mm', '-');

                      const ringColor = isOPD ? 'border-amber-400 text-amber-500 shadow-amber-500/20' : 'border-sky-400 text-sky-500 shadow-sky-500/20';
                      const bulletBg = isOPD ? 'bg-amber-400' : 'bg-sky-500';

                      return (
                        <div key={`dash-timeline-${item.type}-${item.id || 'no-id'}-${i}`} className="relative flex items-center gap-4 group">
                          {/* Circular Date Badge (Matches Image 1) */}
                          <div className={cn(
                            "relative z-10 w-16 h-16 rounded-full bg-white border-[3.5px] flex flex-col items-center justify-center shrink-0 shadow-md transition-transform group-hover:scale-105",
                            ringColor
                          )}>
                            <span className="text-[10px] font-black uppercase tracking-wider leading-none">
                              {monthStr}
                            </span>
                            <span className="text-lg font-black text-slate-900 leading-none my-0.5">
                              {dayStr}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 leading-none">
                              {yearStr}
                            </span>
                          </div>

                          {/* Horizontal connector line */}
                          <div className="w-3 h-[2px] bg-slate-300 shrink-0" />

                          {/* Card Content Pill Container */}
                          <div 
                            onClick={() => setSelectedTimelineDetailItem(item)}
                            className="flex-1 bg-white p-5 rounded-[24px] border border-slate-200/80 hover:border-amber-400 shadow-sm hover:shadow-xl transition-all duration-200 space-y-2.5 cursor-pointer group/card active:scale-[0.99]"
                            title="คลิกเพื่อดูรายละเอียดเวชระเบียน"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0 animate-pulse", bulletBg)} />
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase",
                                  isOPD ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-sky-50 text-sky-700 border border-sky-200"
                                )}>
                                  {isOPD ? 'MEDICAL NOTE (OPD)' : 'IPD ADMIT RECORD'}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-400 font-mono">
                                เวลา {timeStr} น.
                              </span>
                            </div>

                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover/card:text-sky-600 transition-colors">
                              {item.title}
                            </h4>
                            
                            {item.description ? (
                              <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                {item.description}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400 italic">ไม่มีข้อมูลแสดงรายละเอียดการรักษา</p>
                            )}

                            {/* Medications / Items prescribed */}
                            {item.items && item.items.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                                {item.items.map((it: any, idx: number) => (
                                  <span 
                                    key={`timeline-item-unit-${idx}`} 
                                    className="px-2 py-1 bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 inline-flex items-center gap-1 shadow-2xs"
                                  >
                                    <Package className="w-3 h-3 text-slate-400" />
                                    {it.name} <span className="text-slate-400 font-bold">x{it.quantity}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Bottom Action Hint */}
                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100">
                              <span className="text-sky-600 font-bold flex items-center gap-1 group-hover/card:underline">
                                <Search className="w-3.5 h-3.5" /> คลิกดูรายละเอียดเวชระเบียน
                              </span>
                              <FileText className="w-4 h-4 text-slate-300 group-hover/card:text-sky-500 transition-colors shrink-0" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-6 flex flex-col items-center justify-center">
                    <History className="w-12 h-12 text-slate-350 mx-auto mb-3 animate-pulse" />
                    <h4 className="text-sm font-black text-slate-705 mb-1 text-center">ไม่พบประวัติการรักษา</h4>
                    <p className="text-xs text-slate-400 text-center max-w-sm leading-relaxed">
                      สัตว์เลี้ยงตัวนี้ยังไม่มีบันทึกการรักษาในระบบ OPD หรือ IPD ในปัจจุบัน
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button 
                  onClick={() => setSelectedTimelinePatient(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-slate-200"
                >
                  ปิดหน้าต่าง (Close)
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Selected Timeline Detail Item Sub-Modal */}
        <AnimatePresence>
          {selectedTimelineDetailItem && (
            <div key={`modal-wrapper-timeline-detail-${selectedTimelineDetailItem.id || 'dtl'}`} className="fixed inset-0 z-[160] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTimelineDetailItem(null)}
                className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
              />

              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white w-full max-w-xl max-h-[85vh] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden relative z-10"
              >
                {/* Detail Header */}
                <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md",
                      selectedTimelineDetailItem.type === 'OPD' ? "bg-amber-500 shadow-amber-500/20" : "bg-sky-500 shadow-sky-500/20"
                    )}>
                      <History className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider border",
                          selectedTimelineDetailItem.type === 'OPD' 
                            ? "bg-amber-50 text-amber-700 border-amber-200" 
                            : "bg-sky-50 text-sky-700 border-sky-200"
                        )}>
                          {selectedTimelineDetailItem.type} Record
                        </span>
                        <span className="text-slate-400 text-xs font-mono font-bold">
                          {safeFormatDate(selectedTimelineDetailItem.date, 'dd/MM/yyyy HH:mm', '-')}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-slate-800 leading-tight truncate mt-0.5">
                        {selectedTimelineDetailItem.diagnosis || selectedTimelineDetailItem.title}
                      </h3>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedTimelineDetailItem(null)}
                    className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shrink-0 shadow-2xs"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Detail Content */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-slate-700">
                  {/* Symptoms / Chief Complaint */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">อาการสำคัญ / อาการที่พบ (Symptoms)</span>
                    <p className="text-xs font-bold text-slate-800 leading-relaxed">
                      {selectedTimelineDetailItem.symptoms || selectedTimelineDetailItem.description || '-'}
                    </p>
                  </div>

                  {/* Vital Signs Grid */}
                  {selectedTimelineDetailItem.vitals && (
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">สัญญาณชีพ (Vital Signs)</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-sky-50/50 p-2.5 rounded-xl border border-sky-100 text-center">
                          <span className="text-[9px] font-bold text-sky-600 block uppercase">น้ำหนัก</span>
                          <span className="text-xs font-black text-slate-800 font-mono">{selectedTimelineDetailItem.vitals.weight || '-'} kg</span>
                        </div>
                        <div className="bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 text-center">
                          <span className="text-[9px] font-bold text-rose-600 block uppercase">อุณหภูมิ</span>
                          <span className="text-xs font-black text-slate-800 font-mono">{selectedTimelineDetailItem.vitals.temp || '-'} °C</span>
                        </div>
                        <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 text-center">
                          <span className="text-[9px] font-bold text-amber-600 block uppercase">Heart Rate</span>
                          <span className="text-xs font-black text-slate-800 font-mono">{selectedTimelineDetailItem.vitals.hr || selectedTimelineDetailItem.vitals.heartRate || '-'} bpm</span>
                        </div>
                        <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 text-center">
                          <span className="text-[9px] font-bold text-emerald-600 block uppercase">Resp Rate</span>
                          <span className="text-xs font-black text-slate-800 font-mono">{selectedTimelineDetailItem.vitals.rr || selectedTimelineDetailItem.vitals.respRate || '-'} rpm</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Treatment Plan */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">แผนการรักษา & บันทึกแพทย์ (Treatment Plan)</span>
                    <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {selectedTimelineDetailItem.treatmentPlan || selectedTimelineDetailItem.description || '-'}
                    </p>
                  </div>

                  {/* Prescribed Medications */}
                  {(selectedTimelineDetailItem.medications?.length > 0 || selectedTimelineDetailItem.items?.length > 0) && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">รายการยาที่สั่งจ่าย / เวชภัณฑ์ (Medications)</span>
                      <div className="space-y-1.5">
                        {(selectedTimelineDetailItem.medications || selectedTimelineDetailItem.items || []).map((m: any, mIdx: number) => (
                          <div key={`dtl-med-${m.id || m.name || 'med'}-${mIdx}`} className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <span className="font-extrabold text-slate-800 block">{m.name || m.drugName || 'ยา / เวชภัณฑ์'}</span>
                              {m.instruction && <span className="text-[11px] text-slate-500 block mt-0.5">{m.instruction}</span>}
                            </div>
                            <span className="font-mono font-black text-sky-600 bg-white px-2 py-1 rounded-lg border border-slate-200 shrink-0">
                              {m.quantity || m.qty || 1} {m.unit || 'ชิ้น'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vet Name */}
                  <div className="text-right text-xs text-slate-400 font-medium pt-2 border-t border-slate-100">
                    ผู้บันทึก: <span className="font-bold text-slate-700">{selectedTimelineDetailItem.vetName || 'สัตวแพทย์'}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                  <button 
                    onClick={() => setSelectedTimelineDetailItem(null)}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
                  >
                    ปิด (Close)
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Selected Health Trend Detail Modal */}
        {selectedTrend && (
          <div key={`modal-wrapper-trend-${selectedTrend.name}`} className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrend(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden relative z-10"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 bg-sky-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-sky-600 block">Health Trend Patients List</span>
                    <h3 className="text-base font-black text-slate-800 leading-tight truncate">
                      {selectedTrend.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      พบประวัติการรักษาทั้งหมด {selectedTrend.value} ราย ในเดือนนี้
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTrend(null)}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shrink-0 shadow-2xs"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - Patients List */}
              <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
                {selectedTrend.records && selectedTrend.records.length > 0 ? (
                  selectedTrend.records.map((rec: any, idx: number) => {
                    const matchedPatient = patientsMap[rec.patientId];
                    const petName = matchedPatient?.name || rec.patientName || rec.petName || 'สัตว์ป่วย';
                    const hn = matchedPatient?.hn || rec.hn || rec.patientHn || '-';
                    const species = matchedPatient?.species || rec.species || rec.petSpecies || 'สัตว์เลี้ยง';
                    const breed = matchedPatient?.breed || rec.breed || rec.petBreed || '-';
                    const ownerName = matchedPatient?.ownerName || rec.ownerName || '-';
                    const visitDate = safeFormatDate(rec.dateVisit, 'dd/MM/yyyy HH:mm', '-');

                    return (
                      <div key={`trend-rec-${rec.patientId || rec.hn || 'rec'}-${idx}`} className="bg-slate-50/70 hover:bg-white border border-slate-100 hover:border-sky-300 p-4 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 border border-sky-100 shrink-0 font-black text-sm overflow-hidden">
                            {matchedPatient?.photoURL ? (
                              <img src={matchedPatient.photoURL} className="w-full h-full object-cover" alt={petName} />
                            ) : (
                              <PawPrint className="w-6 h-6 text-sky-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-slate-800 text-sm">{petName}</h4>
                              <span className="bg-white text-sky-600 border border-sky-100 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-2xs">
                                HN: {hn}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              {species} ({breed}) • เจ้าของ: {ownerName}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                              <span>วันที่เข้ารับบริการ: {visitDate}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const targetPatient = matchedPatient || {
                              id: rec.patientId || `temp-${idx}`,
                              name: petName,
                              hn: hn,
                              species: species,
                              breed: breed,
                              ownerName: ownerName
                            };
                            setSelectedTrend(null);
                            setSelectedTimelinePatient(targetPatient);
                          }}
                          className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                        >
                          <History className="w-3.5 h-3.5" />
                          ดูประวัติเวชระเบียน
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-400 text-xs font-medium">
                    ไม่พบรายละเอียดสัตว์ป่วยสำหรับกลุ่ม Health Trend นี้
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                <button 
                  onClick={() => setSelectedTrend(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
                >
                  ปิด (Close)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

