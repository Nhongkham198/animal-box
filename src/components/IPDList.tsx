import React, { useState, useEffect, useRef } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  where,
  handleFirestoreError,
  OperationType,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  limit
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  MoreVertical,
  Filter,
  Download,
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertCircle,
  PawPrint,
  User,
  Phone,
  Calendar as CalendarIcon,
  ArrowRight,
  LogOut,
  Bed,
  Pill,
  ShieldCheck,
  Check,
  Camera,
  Image as ImageIcon,
  X,
  Upload,
  Heart,
  Thermometer,
  Scale,
  Sun,
  Moon,
  Microscope,
  Printer,
  BookOpen,
  Info,
  FileText,
  Activity,
  Edit,
  Sparkles,
  History,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface IPDRecord {
  id: string;
  dateAdmit: any;
  dateDischarge?: any;
  patientId: string;
  petName: string;
  ownerName: string;
  cageNumber: string;
  status: 'Admitted' | 'Observation' | 'Discharged';
  diagnosis: string;
  treatmentPlan: string;
  dailyNotes?: { date: any; note: string; vet: string; shift?: 'Day' | 'Night'; vitals?: { weight?: string; temp?: string; heartRate?: string; respiratoryRate?: string } }[];
  billingStatus?: 'unpaid' | 'paid' | 'none';
  isBoarding?: boolean;
  boardingDetails?: string;
  boardingFeedingMeal?: boolean;
  boardingFeedingMealTimes?: string[];
  boardingFeedingDaily?: boolean;
  boardingWalking?: boolean;
  boardingRoomSize?: string;
  boardingBathing?: boolean;
  boardingBathingPrice?: number;
  vaccinationPhoto?: string;
  vaccinationDate?: string;
  vaccinationNextDate?: string;
  vaccineName?: string;
  isMedication?: boolean;
  medicationDetails?: string;
  medicationWoundCare?: boolean;
  medicationWoundCareFrequency?: string;
  medicationWoundCareSize?: 'Small' | 'Large' | '';
  medicationFeedMeds?: boolean;
  medicationFeedMedsTime?: string[];
  medicationFeedMedsDetails?: string;
  medicationGiveIv?: boolean;
  medicationGiveIvType?: string;
  medicationGiveIvVolume?: string;
  medicationFeedFood?: boolean;
  medicationFeedFoodDetails?: string;
  dischargeDate?: string;
  // Dynamic diagnostic details
  latestVitals?: {
    weight?: string;
    temp?: string;
    heartRate?: string;
    respiratoryRate?: string;
  };
  xrayNotes?: string;
}

export default function IPDList() {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [records, setRecords] = useState<IPDRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [patients, setPatients] = useState<{id: string, name: string, ownerName?: string}[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Clinical Details Board state variables
  const [selectedRecord, setSelectedRecord] = useState<IPDRecord | null>(null);
  const [activeBoardTab, setActiveBoardTab] = useState<'plan' | 'lab' | 'rx'>('plan');
  const [inventoryDrugs, setInventoryDrugs] = useState<any[]>([]);
  
  // Handover shift log state
  const [handoverShift, setHandoverShift] = useState<'Day' | 'Night'>('Day');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverWeight, setHandoverWeight] = useState('');
  const [handoverTemp, setHandoverWeightTemp] = useState('');
  const [handoverHR, setHandoverHR] = useState('');
  const [handoverRR, setHandoverRR] = useState('');

  // Lab Results IDEXX state
  const [labCBC, setLabCBC] = useState('WBC: 8.5 x10^3/uL, RBC: 6.8 x10^6/uL, HGB: 14.5 g/dL, PLT: 250 x10^3/uL');
  const [labBiochem, setLabBiochem] = useState('ALT: 45 U/L, AST: 38 U/L, BUN: 18 mg/dL, CRE: 1.2 mg/dL');
  const [labElectrolytes, setLabElectrolytes] = useState('Na: 142 mmol/L, K: 4.2 mmol/L, Cl: 110 mmol/L');
  const [labSyncing, setLabSyncing] = useState<'idle' | 'syncing' | 'synced'>('idle');

  // Radiology / X-ray state
  const [xrayNotes, setXrayNotes] = useState('');
  const [zoomXray, setZoomXray] = useState(false);

  // Rx dispensing state
  const [rxDrugId, setRxDrugId] = useState('');
  const [rxQty, setRxQty] = useState(1);
  const [rxInstruction, setRxInstruction] = useState('ป้อนครั้งละ 1 เม็ด หลังอาหาร เช้า-เย็น');
  const [rxWarning, setRxWarning] = useState('กินติดต่อกันจนหมด');
  const [rxShowLabel, setRxShowLabel] = useState(false);
  const [printLabelAnimation, setPrintLabelAnimation] = useState(false);

  // Patient Timeline History State
  const [patientTimelineHistory, setPatientTimelineHistory] = useState<any[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [showTimelineMobile, setShowTimelineMobile] = useState(false);

  useEffect(() => {
    if (!selectedRecord) {
      setPatientTimelineHistory([]);
      setSelectedHistoryItem(null);
      setShowTimelineMobile(false);
      return;
    }

    const fetchPatientHistory = async () => {
      setIsTimelineLoading(true);
      try {
        const historyItems: any[] = [];
        const pid = selectedRecord.patientId;
        const petName = selectedRecord.petName;

        // Fetch OPD Records
        if (pid) {
          const opdQ = query(collection(db, 'opd_records'), where('patientId', '==', pid));
          const opdSnap = await getDocs(opdQ);
          opdSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            historyItems.push({
              id: docSnap.id,
              type: 'OPD',
              date: data.dateVisit || data.createdAt,
              diagnosis: data.finalDiagnosis || data.category || 'ตรวจรักษา OPD',
              symptoms: data.symptoms || data.chiefComplaint || '-',
              treatmentPlan: data.treatmentPlan || '-',
              vitals: data.vitalSigns || { weight: data.weight, temp: data.temp, hr: data.heartRate, rr: data.respRate },
              medications: data.items || data.medications || [],
              vetName: data.vetName || data.createdByName || 'สัตวแพทย์',
              rawData: data
            });
          });
        }

        // Fetch IPD Records
        if (pid) {
          const ipdQ = query(collection(db, 'ipd_records'), where('patientId', '==', pid));
          const ipdSnap = await getDocs(ipdQ);
          ipdSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            historyItems.push({
              id: docSnap.id,
              type: 'IPD',
              date: data.dateAdmit || data.createdAt,
              diagnosis: data.diagnosis || 'รับแอดมิท IPD',
              symptoms: data.symptoms || '-',
              treatmentPlan: data.treatmentPlan || '-',
              cageNumber: data.cageNumber,
              status: data.status,
              handoverLogs: data.handoverLogs || [],
              vitals: data.vitalSigns,
              vetName: data.vetName || data.ownerName || 'สัตวแพทย์',
              rawData: data
            });
          });
        }

        // Fallback by petName if patientId matched nothing
        if (historyItems.length === 0 && petName) {
          const opdNameQ = query(collection(db, 'opd_records'), where('petName', '==', petName));
          const opdNameSnap = await getDocs(opdNameQ);
          opdNameSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            historyItems.push({
              id: docSnap.id,
              type: 'OPD',
              date: data.dateVisit || data.createdAt,
              diagnosis: data.finalDiagnosis || data.category || 'ตรวจรักษา OPD',
              symptoms: data.symptoms || data.chiefComplaint || '-',
              treatmentPlan: data.treatmentPlan || '-',
              vitals: data.vitalSigns || { weight: data.weight, temp: data.temp, hr: data.heartRate, rr: data.respRate },
              medications: data.items || data.medications || [],
              vetName: data.vetName || data.createdByName || 'สัตวแพทย์',
              rawData: data
            });
          });
        }

        // Sort descending by date
        historyItems.sort((a, b) => {
          const tA = a.date?.toDate ? a.date.toDate().getTime() : (a.date ? new Date(a.date).getTime() : 0);
          const tB = b.date?.toDate ? b.date.toDate().getTime() : (b.date ? new Date(b.date).getTime() : 0);
          return tB - tA;
        });

        setPatientTimelineHistory(historyItems);
      } catch (err) {
        console.error("Error loading patient timeline history:", err);
      } finally {
        setIsTimelineLoading(false);
      }
    };

    fetchPatientHistory();
  }, [selectedRecord]);

  const handleUpdateTreatmentPlan = async (newPlan: string) => {
    if (!selectedRecord) return;
    try {
      await updateDoc(doc(db, 'ipd_records', selectedRecord.id), {
        treatmentPlan: newPlan
      });
      setSelectedRecord(prev => prev ? { ...prev, treatmentPlan: newPlan } : null);
    } catch (err) {
      console.error("Error updating treatment plan:", err);
    }
  };

  const [newRecord, setNewRecord] = useState({
    patientId: '',
    petName: '',
    ownerName: '',
    cageNumber: '',
    diagnosis: '',
    treatmentPlan: '',
    status: 'Admitted' as const,
    isBoarding: false,
    boardingDetails: '',
    boardingFeedingMeal: false,
    boardingFeedingMealTimes: [] as string[],
    boardingFeedingDaily: false,
    boardingWalking: false,
    boardingRoomSize: 'Small',
    boardingBathing: false,
    boardingBathingPrice: 0,
    vaccineName: '',
    vaccinationDate: '',
    vaccinationNextDate: '',
    vaccinationPhoto: '',
    isMedication: false,
    medicationDetails: '',
    medicationWoundCare: false,
    medicationWoundCareFrequency: '',
    medicationWoundCareSize: '' as 'Small' | 'Large' | '',
    medicationFeedMeds: false,
    medicationFeedMedsTime: [] as string[],
    medicationFeedMedsDetails: '',
    medicationGiveIv: false,
    medicationGiveIvType: '',
    medicationGiveIvVolume: '',
    medicationFeedFood: false,
    medicationFeedFoodDetails: '',
    dischargeDate: '',
    serviceCharge: 0
  });

  const [roomPrices, setRoomPrices] = useState<{ Small: string; Large: string; Cage: string }>({
    Small: '',
    Large: '',
    Cage: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const fetchRoomPrices = async () => {
      try {
        const docRef = doc(db, 'settings', 'usage_settings');
        const snap = await getDoc(docRef);
        if (snap.exists() && active) {
          const data = snap.data();
          setRoomPrices({
            Small: data.roomPriceSmall !== undefined && data.roomPriceSmall !== '' ? `${data.roomPriceSmall} ฿/วัน` : '',
            Large: data.roomPriceLarge !== undefined && data.roomPriceLarge !== '' ? `${data.roomPriceLarge} ฿/วัน` : '',
            Cage: data.roomPriceCage !== undefined && data.roomPriceCage !== '' ? `${data.roomPriceCage} ฿/วัน` : ''
          });
        }
      } catch (err) {
        console.warn("Failed to retrieve room prices settings:", err);
      }
    };
    fetchRoomPrices();
    return () => {
      active = false;
    };
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if too large
        const MAX_DIM = 800;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = (height / width) * MAX_DIM;
            width = MAX_DIM;
          } else {
            width = (width / height) * MAX_DIM;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setNewRecord(prev => ({ ...prev, vaccinationPhoto: base64 }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) {
      if (isAuthReady && !isStaff) setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'ipd_records'),
      orderBy('dateAdmit', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as IPDRecord));
      setRecords(data);
      setLoading(false);
    }, (err) => {
      console.warn("IPD records listener restricted:", err.message);
      setLoading(false);
    });

    // Fetch inventory for prescribing
    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInventoryDrugs(data);
    }, (err) => {
      console.warn("Inventory listener warning in IPD:", err);
    });

    // Fetch patients for selection (initial list or recent)
    const fetchInitialPatients = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'patients'), limit(10)));
        setPatients(snap.docs.map(doc => ({ id: doc.id, name: doc.data().name, ...doc.data() })));
      } catch (err) {
        console.warn("Initial patients fetch warning (IPD/non-critical):", err);
      }
    };
    fetchInitialPatients();

    return () => {
      unsubscribe();
      unsubInventory();
    };
  }, [isAuthReady, user, isStaff]);

  const handleSearchPatient = async (val: string) => {
    setPatientSearch(val);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const parts = val.toLowerCase().trim().split(/\s+/);
      const petQuery = parts[0];
      const ownerQuery = parts.length > 1 ? parts.slice(1).join(' ') : '';

      const q = query(
        collection(db, 'patients'),
        where('name', '>=', petQuery),
        where('name', '<=', petQuery + '\uf8ff'),
        limit(10)
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Fetch missing owner names
      const enhancedResults = await Promise.all(results.map(async (p) => {
        let ownerName = p.ownerName || p.owner || p.ownerDisplayName || '';
        if (!ownerName && p.ownerIds && p.ownerIds.length > 0) {
          try {
            const ownerDoc = await getDoc(doc(db, 'owners', p.ownerIds[0]));
            if (ownerDoc.exists()) {
              ownerName = ownerDoc.data().name;
            }
          } catch (e) {
            console.warn("Owner fetch error during search:", e);
          }
        }
        return { ...p, ownerName };
      }));

      // Filter by owner name if ownerQuery exists
      const finalResults = ownerQuery 
        ? enhancedResults.filter(p => (p.ownerName || '').toLowerCase().includes(ownerQuery))
        : enhancedResults;

      setSearchResults(finalResults.slice(0, 5));
    } catch (err) {
      console.warn("Search warning (check permissions):", err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectPatient = async (p: any) => {
    let ownerName = p.ownerName || '';
    
    // If ownerName is not in patient record, try to fetch from owners collection
    if (!ownerName && p.ownerIds && p.ownerIds.length > 0) {
      try {
        const ownerSnap = await getDocs(query(collection(db, 'owners'), where('__name__', 'in', p.ownerIds))).catch(e => {
          console.warn("Owner info fetch warning (IPD):", e);
          return { empty: true, docs: [] };
        });
        if (!ownerSnap.empty) {
          ownerName = ownerSnap.docs[0].data().name;
        }
      } catch (err) {
        console.warn("Error fetching owner for IPD (non-critical):", err);
      }
    }

    setNewRecord({
      ...newRecord,
      patientId: p.id,
      petName: p.name,
      ownerName: ownerName
    });
    setPatientSearch(p.name);
    setSearchResults([]);
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.patientId || !newRecord.cageNumber) return;

    try {
      let finalDetails = newRecord.medicationDetails;
      if (newRecord.isMedication) {
        const parts = [];
        if (newRecord.medicationFeedMeds) {
          parts.push(`ป้อนยา: [ช่วงเวลา: ${newRecord.medicationFeedMedsTime?.join(', ') || 'N/A'}] ${newRecord.medicationFeedMedsDetails || ''}`);
        }
        if (newRecord.medicationWoundCare) {
          parts.push(`ทำแผล: ${newRecord.medicationWoundCareFrequency || '1'} ครั้ง/วัน [ขนาดแผล: ${newRecord.medicationWoundCareSize === 'Small' ? 'เล็ก' : newRecord.medicationWoundCareSize === 'Large' ? 'ใหญ่' : 'N/A'}]`);
        }
        if (newRecord.medicationGiveIv) {
          parts.push(`ให้น้ำเกลือ: [ชนิด: ${newRecord.medicationGiveIvType || 'N/A'}, ปริมาณ: ${newRecord.medicationGiveIvVolume || 'N/A'}]`);
        }
        if (newRecord.medicationFeedFood) {
          parts.push(`ป้อนข้าว: ${newRecord.medicationFeedFoodDetails || ''}`);
        }
        finalDetails = parts.join(' | ') || 'ฝากให้ยา';
      }

      await addDoc(collection(db, 'ipd_records'), {
        ...newRecord,
        medicationDetails: finalDetails,
        dateAdmit: serverTimestamp(),
        billingStatus: 'unpaid',
        dailyNotes: []
      });
      setIsAddingRecord(false);
      setNewRecord({
        patientId: '',
        petName: '',
        ownerName: '',
        cageNumber: '',
        diagnosis: '',
        treatmentPlan: '',
        status: 'Admitted',
        isBoarding: false,
        boardingDetails: '',
        boardingFeedingMeal: false,
        boardingFeedingMealTimes: [],
        boardingFeedingDaily: false,
        boardingWalking: false,
        boardingRoomSize: 'Small',
        boardingBathing: false,
        boardingBathingPrice: 0,
        vaccineName: '',
        vaccinationDate: '',
        vaccinationNextDate: '',
        vaccinationPhoto: '',
        isMedication: false,
        medicationDetails: '',
        medicationWoundCare: false,
        medicationWoundCareFrequency: '',
        medicationWoundCareSize: '',
        medicationFeedMeds: false,
        medicationFeedMedsTime: [],
        medicationFeedMedsDetails: '',
        medicationGiveIv: false,
        medicationGiveIvType: '',
        medicationGiveIvVolume: '',
        medicationFeedFood: false,
        medicationFeedFoodDetails: '',
        dischargeDate: '',
        serviceCharge: 0
      });
      setPatientSearch('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'ipd_records');
    }
  };

  const handleDischarge = async (id: string) => {
    try {
      await updateDoc(doc(db, 'ipd_records', id), {
        status: 'Discharged',
        dateDischarge: serverTimestamp(),
        billingStatus: 'unpaid'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'ipd_records');
    }
  };

  const handleSendToBilling = async (record: IPDRecord) => {
    try {
      await updateDoc(doc(db, 'ipd_records', record.id), {
        billingStatus: 'unpaid'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'ipd_records');
    }
  };

  const filteredRecords = records.filter(r => 
    r.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.cageNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            IPD RECORD LIST
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1.5 ml-1">In-Patient Department patient directory and monitoring board</p>
        </div>
        <button 
          onClick={() => setIsAddingRecord(true)}
          className="px-6 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-100 hover:bg-rose-700 hover:shadow-rose-200 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 text-sm self-start sm:self-auto"
        >
          <Plus className="w-5 h-5" />
          Admit New Pet
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Currently Admitted */}
        <div className="bg-rose-50/10 border border-rose-100/40 rounded-[2rem] p-6 flex items-center gap-5 transition-all hover:bg-rose-50/25 hover:border-rose-200/50 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shadow-sm">
            <PawPrint className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Currently Admitted</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-slate-800">
                {records.filter(r => r.status !== 'Discharged').length}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pets</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Observation */}
        <div className="bg-amber-50/10 border border-amber-100/40 rounded-[2rem] p-6 flex items-center gap-5 transition-all hover:bg-amber-50/25 hover:border-amber-200/50 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shadow-sm">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observation</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-slate-800">
                {records.filter(r => r.status === 'Observation').length}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pets</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Discharged Today */}
        <div className="bg-emerald-50/10 border border-emerald-100/40 rounded-[2rem] p-6 flex items-center gap-5 transition-all hover:bg-emerald-50/25 hover:border-emerald-200/50 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-sm">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discharged Today</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-slate-800">
                {records.filter(r => r.status === 'Discharged' && r.dateDischarge?.toDate()?.toDateString() === new Date().toDateString()).length}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
        <div className="flex-1 relative min-w-[300px]">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Pet Name, Owner, or Cage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700 shadow-inner placeholder:text-slate-300"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="p-4 bg-slate-50 text-slate-500 rounded-2xl hover:bg-slate-100/80 hover:text-slate-700 transition-all border border-slate-100 flex items-center justify-center active:scale-95 shadow-sm">
            <Filter className="w-5 h-5" />
          </button>
          <button className="p-4 bg-slate-50 text-slate-500 rounded-2xl hover:bg-slate-100/80 hover:text-slate-700 transition-all border border-slate-100 flex items-center justify-center active:scale-95 shadow-sm">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* IPD Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-4 py-4.5 md:px-5 md:py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Patient & Cage</th>
              <th className="px-4 py-4.5 md:px-5 md:py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Admit Date</th>
              <th className="px-4 py-4.5 md:px-5 md:py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Diagnosis</th>
              <th className="px-4 py-4.5 md:px-5 md:py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
              <th className="px-4 py-4.5 md:px-5 md:py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading records...</p>
                  </div>
                </td>
              </tr>
            ) : filteredRecords.length > 0 ? filteredRecords.map((record, index) => (
              <tr key={`ipd-rec-${record.id || 'id'}-${index}`} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-4 py-4 md:px-5 md:py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-rose-50 rounded-xl flex flex-col items-center justify-center border border-rose-100/50 shadow-inner group-hover:scale-105 transition-all shrink-0">
                      <span className="text-[8px] font-black text-rose-300 uppercase leading-none mb-1">Cage</span>
                      <span className="text-xs font-black text-rose-600 leading-none">{record.cageNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-800 leading-none truncate">{record.petName}</p>
                          <div className="flex gap-1">
                            {record.isBoarding && (
                              <div className="w-5 h-5 bg-sky-50 text-sky-500 rounded-md flex items-center justify-center border border-sky-100 shadow-sm" title="Boarding">
                                <Bed className="w-3 h-3" />
                              </div>
                            )}
                            {record.isMedication && (
                              <div className="w-5 h-5 bg-amber-50 text-amber-500 rounded-md flex items-center justify-center border border-amber-100 shadow-sm" title="Medication">
                                <Pill className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(record.isBoarding && (record.boardingFeedingMeal || record.boardingFeedingDaily || record.boardingWalking || record.boardingRoomSize || record.boardingBathing)) && (
                            <>
                              {record.boardingRoomSize && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[8px] font-black uppercase border border-blue-200 flex items-center gap-1">
                                  ห้อง: {
                                    record.boardingRoomSize === 'Small' ? 'ห้องเล็ก' :
                                    record.boardingRoomSize === 'Large' ? 'ห้องใหญ่' :
                                    record.boardingRoomSize === 'Cage' ? 'กรง' : record.boardingRoomSize
                                  }
                                </span>
                              )}
                              {record.boardingFeedingMeal && (
                                <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded-md text-[8px] font-black uppercase border border-sky-200 flex items-center gap-1">
                                  {record.boardingFeedingMealTimes?.map(t => t.replace('มื้อ', '')).join(', ') || 'อาหาร'}
                                </span>
                              )}
                              {record.boardingFeedingDaily && (
                                <span className="px-1.5 py-0.5 bg-sky-600 text-white rounded-md text-[8px] font-black uppercase shadow-sm flex items-center gap-1">
                                  อาหารแบบเหมาจ่าย
                                </span>
                              )}
                              {record.boardingWalking && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[8px] font-black uppercase border border-emerald-100 flex items-center gap-1">
                                  <Check className="w-1.5 h-1.5" />
                                  เดินเล่น
                                </span>
                              )}
                              {record.boardingBathing && (
                                <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-md text-[8px] font-black uppercase border border-teal-250 flex items-center gap-1">
                                  อาบน้ำ (฿{record.boardingBathingPrice || '0'})
                                </span>
                              )}
                            </>
                          )}
 
                          {record.isMedication && (
                            <>
                              {record.medicationFeedMeds && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[8px] font-black uppercase border border-amber-100 flex items-center gap-1">
                                  ป้อนยา: {record.medicationFeedMedsTime?.join(', ') || 'N/A'}
                                </span>
                              )}
                              {record.medicationWoundCare && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[8px] font-black uppercase border border-amber-200 flex items-center gap-1">
                                  ทำแผล ({record.medicationWoundCareFrequency || '1'} ครั้ง/วัน)
                                </span>
                              )}
                              {record.medicationGiveIv && (
                                <span className="px-1.5 py-0.5 bg-amber-600 text-white rounded-md text-[8px] font-black uppercase shadow-sm flex items-center gap-1">
                                  น้ำเกลือ
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider flex items-center gap-1 group-hover:text-slate-600 transition-colors">
                        <User className="w-3 h-3 text-slate-300" /> {record.ownerName}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 md:px-5 md:py-5">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-bold">
                      {record.dateAdmit?.toDate ? format(record.dateAdmit.toDate(), 'dd MMM yyyy') : 'N/A'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 md:px-5 md:py-5">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-bold text-slate-600 line-clamp-1 max-w-[150px]">{record.diagnosis}</p>
                    {record.dischargeDate && (
                      <div className="flex items-center gap-1 text-[8px] font-black text-rose-500 uppercase tracking-wider bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100 w-fit">
                        <CalendarIcon className="w-2.5 h-2.5" />
                        Out: {format(new Date(record.dischargeDate), 'dd MMM yyyy')}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 md:px-5 md:py-5">
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1",
                    record.status === 'Admitted' ? "bg-rose-50 text-rose-600" :
                    record.status === 'Observation' ? "bg-amber-50 text-amber-600" :
                    "bg-emerald-50 text-emerald-600"
                  )}>
                    <div className={cn(
                      "w-1 h-1 rounded-full",
                      record.status === 'Admitted' ? "bg-rose-600" :
                      record.status === 'Observation' ? "bg-amber-600" :
                      "bg-emerald-600"
                    )} />
                    {record.status}
                  </span>
                </td>
                <td className="px-4 py-4 md:px-5 md:py-5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button 
                      onClick={() => {
                        setSelectedRecord(record);
                        setXrayNotes(record.xrayNotes || '');
                        setActiveBoardTab('plan');
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm border border-rose-100 shrink-0"
                    >
                      <Stethoscope className="w-3 h-3" />
                      Board
                    </button>
                    {record.status !== 'Discharged' && (
                      <button 
                        onClick={() => handleDischarge(record.id)}
                        className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all shrink-0 border border-emerald-100"
                      >
                        Discharge
                      </button>
                    )}
                    <button 
                      onClick={() => handleSendToBilling(record)}
                      disabled={record.billingStatus === 'paid' || record.billingStatus === 'unpaid'}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border shrink-0",
                        record.billingStatus === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        record.billingStatus === 'unpaid' ? "bg-amber-50 text-amber-600 border-amber-100" :
                        "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                      )}
                    >
                      {record.billingStatus === 'paid' ? 'Paid' : record.billingStatus === 'unpaid' ? 'In Billing' : 'Billing'}
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-5 py-20 text-center">
                  <div className="flex flex-col items-center gap-4 opacity-20">
                    <Stethoscope className="w-16 h-16 text-slate-400" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No IPD records found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Record Modal */}
      <AnimatePresence>
        {isAddingRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full h-full shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Admit New Pet</h2>
                    <p className="text-slate-500 text-sm font-bold">Register a pet for in-patient care</p>
                  </div>
                </div>
                <button onClick={() => setIsAddingRecord(false)} className="p-2 hover:bg-white rounded-xl text-slate-400">
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddRecord} className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50/20">
                {/* 1. Basic Information */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">Basic Information</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2 relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Patient</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search pet name..."
                          value={patientSearch}
                          onChange={(e) => handleSearchPatient(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700"
                        />
                        {isSearching && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>

                      {searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden max-h-[200px] overflow-y-auto">
                          {searchResults.map((p, pIdx) => (
                            <button
                              key={`search-p-${p.id || 'id'}-${pIdx}`}
                              type="button"
                              onClick={() => selectPatient(p)}
                              className="w-full p-4 text-left hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                            >
                              <div className="py-1">
                                <p className="text-xl font-black text-slate-900 leading-tight">{p.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter",
                                    p.species?.toLowerCase() === 'dog' ? "bg-amber-50 text-amber-600" : 
                                    p.species?.toLowerCase() === 'cat' ? "bg-emerald-50 text-emerald-600" : 
                                    "bg-slate-100 text-slate-500"
                                  )}>
                                    {p.species || 'Species'}
                                  </span>
                                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="font-mono">HN: {p.hn || '-'}</span>
                                    {p.ownerName && (
                                      <>
                                        <span className="text-slate-200">|</span>
                                        <span className="text-rose-600 font-black">เจ้าของ: {p.ownerName}</span>
                                      </>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-300" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cage Number</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. A-01"
                        value={newRecord.cageNumber}
                        onChange={(e) => setNewRecord({...newRecord, cageNumber: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Owner Name</label>
                    <input
                      required
                      type="text"
                      value={newRecord.ownerName}
                      onChange={(e) => setNewRecord({...newRecord, ownerName: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700"
                    />
                  </div>
                </div>

                {/* 2. Medical Details */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">Medical Assessment</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Diagnosis</label>
                      <textarea
                        required
                        rows={2}
                        value={newRecord.diagnosis}
                        onChange={(e) => setNewRecord({...newRecord, diagnosis: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700 resize-none placeholder:text-slate-300"
                        placeholder="อาการเบื้องต้น หรือข้อวินิจฉัย..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">วันที่แอดมิท (Admit Date)</label>
                        <div className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent text-slate-400 rounded-2xl font-bold flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          {format(new Date(), 'dd MMM yyyy')}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">วันที่คาดว่าจะออก (Expected Discharge)</label>
                        <input
                          type="date"
                          value={newRecord.dischargeDate}
                          onChange={(e) => setNewRecord({...newRecord, dischargeDate: e.target.value})}
                          className="w-full px-5 py-4 bg-rose-50/50 border-2 border-rose-100 focus:border-rose-400 rounded-2xl transition-all outline-none font-bold text-rose-600"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Service Charge (ค่าบริการเพิ่มเติม)</label>
                       <div className="flex items-center gap-4">
                         <div className="flex-1 relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-rose-300">฿</span>
                            <input
                              type="number"
                              placeholder="ระบุกจำนวนเงินค่าบริการ..."
                              value={newRecord.serviceCharge || ''}
                              onChange={(e) => setNewRecord({...newRecord, serviceCharge: Number(e.target.value)})}
                              className="w-full pl-10 pr-6 py-4 bg-rose-50/30 border-2 border-transparent focus:border-rose-300 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700"
                            />
                         </div>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Treatment Plan</label>
                    <textarea
                      required
                      rows={3}
                      value={newRecord.treatmentPlan}
                      onChange={(e) => setNewRecord({...newRecord, treatmentPlan: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700 resize-none placeholder:text-slate-300"
                      placeholder="แผนการรักษาที่โรงพยาบาล..."
                    />
                  </div>
                </div>

                {/* 3. Additional Services */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">Additional Services</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Boarding Section */}
                    <div className={cn(
                      "p-6 rounded-[2.5rem] border-2 transition-all duration-500 relative overflow-hidden group cursor-pointer",
                      newRecord.isBoarding ? "border-sky-400 bg-sky-50 shadow-2xl shadow-sky-100 ring-4 ring-sky-50" : "border-slate-100 bg-white hover:border-sky-200"
                    )} onClick={() => setNewRecord({...newRecord, isBoarding: !newRecord.isBoarding})}>
                      <div className="flex items-center justify-between mb-6">
                        <div className={cn(
                          "w-14 h-14 rounded-3xl flex items-center justify-center transition-all duration-500 shadow-lg",
                          newRecord.isBoarding ? "bg-sky-500 text-white scale-110 shadow-sky-200 rotate-3" : "bg-sky-50 text-sky-400 group-hover:scale-105"
                        )}>
                          <Bed className="w-7 h-7" />
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                          newRecord.isBoarding ? "border-sky-500 bg-sky-500 scale-125" : "border-slate-100"
                        )}>
                          {newRecord.isBoarding && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                      <h5 className={cn("text-base font-black uppercase tracking-widest leading-none transition-colors", newRecord.isBoarding ? "text-sky-900" : "text-slate-500")}>
                        ฝากสัตว์เลี้ยง
                      </h5>
                      <p className="text-[10px] font-black text-slate-300 mt-2 uppercase tracking-[0.2em] transition-colors group-hover:text-sky-300">Pet Hotel / Boarding</p>
                    </div>

                    {/* Medication Section */}
                    <div className={cn(
                      "p-6 rounded-[2.5rem] border-2 transition-all duration-500 relative overflow-hidden group cursor-pointer",
                      newRecord.isMedication ? "border-amber-400 bg-amber-50 shadow-2xl shadow-amber-100 ring-4 ring-amber-50" : "border-slate-100 bg-white hover:border-amber-200"
                    )} onClick={() => setNewRecord({...newRecord, isMedication: !newRecord.isMedication})}>
                      <div className="flex items-center justify-between mb-6">
                        <div className={cn(
                          "w-14 h-14 rounded-3xl flex items-center justify-center transition-all duration-500 shadow-lg",
                          newRecord.isMedication ? "bg-amber-500 text-white scale-110 shadow-amber-200 -rotate-3" : "bg-amber-50 text-amber-400 group-hover:scale-105"
                        )}>
                          <Pill className="w-7 h-7" />
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                          newRecord.isMedication ? "border-amber-500 bg-amber-500 scale-125" : "border-slate-100"
                        )}>
                          {newRecord.isMedication && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                      <h5 className={cn("text-base font-black uppercase tracking-widest leading-none transition-colors", newRecord.isMedication ? "text-amber-900" : "text-slate-500")}>
                        ฝากให้ยา
                      </h5>
                      <p className="text-[10px] font-black text-slate-300 mt-2 uppercase tracking-[0.2em] transition-colors group-hover:text-amber-300">Medication Deposit</p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {(newRecord.isBoarding || newRecord.isMedication) && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 pt-2 overflow-hidden"
                      >
                        {newRecord.isBoarding && (
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-sky-600 uppercase tracking-widest ml-1">รายละเอียดการฝาก ( Boarding Services )</label>
                            
                            <div className="grid gap-3">
                              {/* Option 1: Feeding by Meal */}
                              <div className={cn(
                                "p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                newRecord.boardingFeedingMeal ? "border-sky-500 bg-sky-50" : "border-slate-100 bg-white"
                              )} onClick={() => setNewRecord({...newRecord, boardingFeedingMeal: !newRecord.boardingFeedingMeal})}>
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                    newRecord.boardingFeedingMeal ? "border-sky-500 bg-sky-500" : "border-slate-200"
                                  )}>
                                    {newRecord.boardingFeedingMeal && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <span className={cn("text-xs font-bold", newRecord.boardingFeedingMeal ? "text-sky-700" : "text-slate-500")}>ให้อาหารแบบมื้อ</span>
                                </div>
                                
                                {newRecord.boardingFeedingMeal && (
                                  <div className="mt-4 ml-8 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                                    {['มื้อเช้า', 'มื้อกลางวัน', 'มื้อเย็น'].map(time => (
                                      <button
                                        key={`meal-time-${time}`}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const current = newRecord.boardingFeedingMealTimes || [];
                                          const next = current.includes(time) 
                                            ? current.filter(t => t !== time)
                                            : [...current, time];
                                          setNewRecord({ ...newRecord, boardingFeedingMealTimes: next });
                                        }}
                                        className={cn(
                                          "px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                                          newRecord.boardingFeedingMealTimes?.includes(time)
                                            ? "bg-sky-500 text-white shadow-lg shadow-sky-200 ring-2 ring-sky-200"
                                            : "bg-white border-2 border-slate-100 text-slate-400 hover:border-sky-200 hover:text-sky-400"
                                        )}
                                      >
                                        {newRecord.boardingFeedingMealTimes?.includes(time) && <Check className="w-3 h-3" />}
                                        {time}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Option 2: Daily Flat Rate */}
                              <div className={cn(
                                "p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                newRecord.boardingFeedingDaily ? "border-sky-500 bg-sky-50" : "border-slate-100 bg-white"
                              )} onClick={() => setNewRecord({...newRecord, boardingFeedingDaily: !newRecord.boardingFeedingDaily})}>
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                    newRecord.boardingFeedingDaily ? "border-sky-500 bg-sky-500" : "border-slate-200"
                                  )}>
                                    {newRecord.boardingFeedingDaily && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <span className={cn("text-xs font-bold", newRecord.boardingFeedingDaily ? "text-sky-700" : "text-slate-500")}>ให้อาหารแบบเหมาจ่ายรายวัน</span>
                                </div>
                              </div>

                              {/* Option 3: Walking */}
                              <div className={cn(
                                "p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                newRecord.boardingWalking ? "border-sky-500 bg-sky-50" : "border-slate-100 bg-white"
                              )} onClick={() => setNewRecord({...newRecord, boardingWalking: !newRecord.boardingWalking})}>
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                    newRecord.boardingWalking ? "border-sky-500 bg-sky-500" : "border-slate-200"
                                  )}>
                                    {newRecord.boardingWalking && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <span className={cn("text-xs font-bold", newRecord.boardingWalking ? "text-sky-700" : "text-slate-500")}>พาเดินเล่น</span>
                                </div>
                              </div>

                              {/* Room Size Option */}
                              <div className="space-y-2.5 mt-2 bg-white p-5 rounded-3xl border border-slate-150 shadow-sm">
                                <label className="text-[10px] font-black text-sky-600 uppercase tracking-widest ml-1 block">ขนาดห้อง (Boarding Room Size)</label>
                                <div className="grid grid-cols-3 gap-3">
                                  {[
                                    { value: 'Small', label: 'ห้องเล็ก' },
                                    { value: 'Large', label: 'ห้องใหญ่' },
                                    { value: 'Cage', label: 'กรง' }
                                  ].map((room) => (
                                    <button
                                      key={`room-sz-${room.value}`}
                                      type="button"
                                      onClick={() => setNewRecord({ ...newRecord, boardingRoomSize: room.value })}
                                      className={cn(
                                        "px-4 py-3.5 rounded-2xl text-xs font-bold transition-all border-2 flex flex-col items-center justify-center gap-1 min-h-[70px]",
                                        newRecord.boardingRoomSize === room.value
                                          ? "bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-200"
                                          : "bg-white border-slate-100 text-slate-500 hover:border-sky-200"
                                      )}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {newRecord.boardingRoomSize === room.value && <Check className="w-3.5 h-3.5" />}
                                        <span className="font-extrabold">{room.label}</span>
                                      </div>
                                      {roomPrices[room.value as 'Small' | 'Large' | 'Cage'] ? (
                                        <span className={cn(
                                          "text-[10px] font-mono",
                                          newRecord.boardingRoomSize === room.value ? "text-sky-100 font-extrabold" : "text-slate-400 font-bold"
                                        )}>
                                          {roomPrices[room.value as 'Small' | 'Large' | 'Cage']}
                                        </span>
                                      ) : (
                                        <span className={cn(
                                          "text-[9px]",
                                          newRecord.boardingRoomSize === room.value ? "text-sky-200" : "text-slate-350"
                                        )}>
                                          ไม่ได้ระบุราคา
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Bathing before checkout Option */}
                              <div className="p-5 rounded-3xl border border-slate-150 bg-white shadow-sm space-y-4">
                                <div 
                                  className="flex items-center gap-3 cursor-pointer select-none"
                                  onClick={() => setNewRecord({ ...newRecord, boardingBathing: !newRecord.boardingBathing })}
                                >
                                  <div className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                                    newRecord.boardingBathing ? "border-sky-500 bg-sky-500" : "border-slate-200 bg-white"
                                  )}>
                                    {newRecord.boardingBathing && <Check className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <div className="flex-1">
                                    <span className={cn("text-xs font-black block", newRecord.boardingBathing ? "text-sky-700" : "text-slate-600")}>
                                      ก่อนกลับต้องการอาบน้ำ (Bath before Checkout)
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold block mt-0.5">เลือกหากต้องการให้บริการอาบน้ำสัตว์เลี้ยงก่อนเจ้าของรับกลับ</span>
                                  </div>
                                </div>

                                {newRecord.boardingBathing && (
                                  <div className="ml-8 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">ระบุราคาค่าอาบน้ำ (Bathing Price)</label>
                                    <div className="relative">
                                      <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-sky-400 text-xs">฿</span>
                                      <input
                                        type="number"
                                        placeholder="ราคาบริการอาบน้ำ..."
                                        value={newRecord.boardingBathingPrice || ''}
                                        onChange={(e) => setNewRecord({ ...newRecord, boardingBathingPrice: Number(e.target.value) })}
                                        className="w-full pl-10 pr-5 py-3.5 bg-sky-50/20 border-2 border-transparent focus:border-sky-300 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-705 text-xs"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Vaccination Record Section */}
                            <div className="mt-6 p-6 rounded-[2.5rem] bg-white border-2 border-emerald-100 shadow-xl shadow-emerald-50/50 space-y-4">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                                  <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                  <h6 className="text-[11px] font-black text-emerald-600 uppercase tracking-widest leading-none">Vaccination Record</h6>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">บันทึกข้อมูลและตรวจสอบความปลอดภัย</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อวัคซีน (Vaccine Name)</label>
                                  <input
                                    type="text"
                                    value={newRecord.vaccineName || ''}
                                    onChange={(e) => setNewRecord({...newRecord, vaccineName: e.target.value})}
                                    placeholder="เช่น พิษสุนัขบ้า, รวม 5 โรค..."
                                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl transition-all outline-none font-bold text-slate-700 text-xs"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">วันที่ฉีดล่าสุด</label>
                                  <input
                                    type="date"
                                    value={newRecord.vaccinationDate || ''}
                                    onChange={(e) => setNewRecord({...newRecord, vaccinationDate: e.target.value})}
                                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl transition-all outline-none font-bold text-slate-700 text-xs"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-1">นัดครั้งถัดไป</label>
                                  <input
                                    type="date"
                                    value={newRecord.vaccinationNextDate || ''}
                                    onChange={(e) => setNewRecord({...newRecord, vaccinationNextDate: e.target.value})}
                                    className="w-full px-5 py-3.5 bg-rose-50/50 border-2 border-rose-100 focus:border-rose-400 rounded-2xl transition-all outline-none font-bold text-rose-600 text-xs"
                                  />
                                </div>
                                <div className="col-span-2 space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ลิ้งก์รูปภาพสมุดวัคซีน หรือ อัปโหลดรูปภาพ</label>
                                  
                                  <div className="flex gap-3">
                                    <div className="flex-1 relative group">
                                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                      <input
                                        type="url"
                                        value={newRecord.vaccinationPhoto || ''}
                                        onChange={(e) => setNewRecord({...newRecord, vaccinationPhoto: e.target.value})}
                                        placeholder="ใส่ URL ของรูปภาพสมุดวัคซีน..."
                                        className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl transition-all outline-none font-bold text-slate-700 text-xs"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => fileInputRef.current?.click()}
                                      className="px-6 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                                    >
                                      <Upload className="w-4 h-4" />
                                      อัปโหลดรูป
                                    </button>
                                  </div>

                                  <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handlePhotoUpload} 
                                    className="hidden" 
                                    accept="image/*" 
                                  />

                                  {newRecord.vaccinationPhoto && (
                                    <div className="relative mt-4 aspect-video w-full rounded-2xl overflow-hidden border-2 border-slate-100 group">
                                      <img 
                                        src={newRecord.vaccinationPhoto} 
                                        alt="Vaccination Record" 
                                        className="w-full h-full object-cover"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setNewRecord({...newRecord, vaccinationPhoto: ''})}
                                        className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all shadow-lg"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {newRecord.isMedication && (
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">รายละเอียดการฝากให้ยา ( Medication Services )</label>
                            
                            <div className="grid gap-3">
                              {/* Option 2: ป้อนยา */}
                              <div className={cn(
                                "p-4 rounded-2xl border border-dashed hover:border-amber-300 transition-all cursor-pointer",
                                newRecord.medicationFeedMeds ? "border-amber-500 bg-amber-50/40 border-solid" : "border-slate-200 bg-white"
                              )} onClick={() => setNewRecord({...newRecord, medicationFeedMeds: !newRecord.medicationFeedMeds})}>
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                    newRecord.medicationFeedMeds ? "border-amber-500 bg-amber-500" : "border-slate-200"
                                  )}>
                                    {newRecord.medicationFeedMeds && <Check className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <span className={cn("text-xs font-black", newRecord.medicationFeedMeds ? "text-amber-800" : "text-slate-600")}>ป้อนยา</span>
                                </div>
                                
                                {newRecord.medicationFeedMeds && (
                                  <div className="mt-4 ml-8 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300" onClick={(e) => e.stopPropagation()}>
                                    <div>
                                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-2">ช่วงเวลาการป้อนยา (เช้า / กลางวัน / เย็น)</label>
                                      <div className="flex gap-2">
                                        {['เช้า', 'กลางวัน', 'เย็น'].map(time => {
                                          const medicationFeedMedsTime = newRecord.medicationFeedMedsTime || [];
                                          const exists = medicationFeedMedsTime.includes(time);
                                          return (
                                            <button
                                              key={`med-feed-time-${time}`}
                                              type="button"
                                              onClick={() => {
                                                const next = exists 
                                                  ? medicationFeedMedsTime.filter(t => t !== time)
                                                  : [...medicationFeedMedsTime, time];
                                                setNewRecord({ ...newRecord, medicationFeedMedsTime: next });
                                              }}
                                              className={cn(
                                                "px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border-2",
                                                exists
                                                  ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100"
                                                  : "bg-white border-slate-100 text-slate-400 hover:border-amber-200"
                                              )}
                                            >
                                              {exists && <Check className="w-3 h-3" />}
                                              {time}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">รายละเอียดสำหรับการป้อนยา</label>
                                      <input
                                        type="text"
                                        placeholder="ระบุชื่อยาลำดับที่ 1: เม็ด/ครั้ง, เวลา, และรายละเอียด..."
                                        value={newRecord.medicationFeedMedsDetails || ''}
                                        onChange={(e) => setNewRecord({...newRecord, medicationFeedMedsDetails: e.target.value})}
                                        className="w-full px-5 py-3.5 bg-amber-50/20 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-705 text-xs"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Option 1: ทำแผล */}
                              <div className={cn(
                                "p-4 rounded-2xl border border-dashed hover:border-amber-300 transition-all cursor-pointer",
                                newRecord.medicationWoundCare ? "border-amber-500 bg-amber-50/40 border-solid" : "border-slate-200 bg-white"
                              )} onClick={() => setNewRecord({...newRecord, medicationWoundCare: !newRecord.medicationWoundCare})}>
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                    newRecord.medicationWoundCare ? "border-amber-500 bg-amber-500" : "border-slate-200"
                                  )}>
                                    {newRecord.medicationWoundCare && <Check className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <span className={cn("text-xs font-black", newRecord.medicationWoundCare ? "text-amber-800" : "text-slate-600")}>ทำแผล</span>
                                </div>
                                
                                {newRecord.medicationWoundCare && (
                                  <div className="mt-4 ml-8 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300" onClick={(e) => e.stopPropagation()}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">จำนวนครั้งที่ทำแผลต่อวัน (ความถี่)</label>
                                        <div className="relative">
                                          <input
                                            type="text"
                                            placeholder="ระบุตัวเลข เช่น 1, 2, 3..."
                                            value={newRecord.medicationWoundCareFrequency || ''}
                                            onChange={(e) => setNewRecord({...newRecord, medicationWoundCareFrequency: e.target.value})}
                                            className="w-full pl-5 pr-20 py-3.5 bg-amber-50/20 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-705 text-xs"
                                          />
                                          <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-amber-500 text-xs">ครั้ง / วัน</span>
                                        </div>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">ขนาดของแผล</label>
                                        <div className="flex gap-2">
                                          {[
                                            { value: 'Small', label: 'แผลขนาดเล็ก' },
                                            { value: 'Large', label: 'แผลขนาดใหญ่' }
                                          ].map((size) => (
                                            <button
                                              key={`wound-sz-${size.value}`}
                                              type="button"
                                              onClick={() => setNewRecord({ ...newRecord, medicationWoundCareSize: size.value as 'Small' | 'Large' })}
                                              className={cn(
                                                "flex-1 py-3.5 rounded-xl text-xs font-bold transition-all border-2 flex items-center justify-center gap-1.5",
                                                newRecord.medicationWoundCareSize === size.value
                                                  ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100"
                                                  : "bg-white border-slate-100 text-slate-500 hover:border-amber-250"
                                              )}
                                            >
                                              {newRecord.medicationWoundCareSize === size.value && <Check className="w-3.5 h-3.5" />}
                                              {size.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Option 3: ให้น้ำเกลือ */}
                              <div className={cn(
                                "p-4 rounded-2xl border border-dashed hover:border-amber-300 transition-all cursor-pointer",
                                newRecord.medicationGiveIv ? "border-amber-500 bg-amber-50/40 border-solid" : "border-slate-200 bg-white"
                              )} onClick={() => setNewRecord({...newRecord, medicationGiveIv: !newRecord.medicationGiveIv})}>
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                    newRecord.medicationGiveIv ? "border-amber-500 bg-amber-500" : "border-slate-200"
                                  )}>
                                    {newRecord.medicationGiveIv && <Check className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <span className={cn("text-xs font-black", newRecord.medicationGiveIv ? "text-amber-800" : "text-slate-600")}>ให้น้ำเกลือ</span>
                                </div>
                                
                                {newRecord.medicationGiveIv && (
                                  <div className="mt-4 ml-8 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300" onClick={(e) => e.stopPropagation()}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">ชนิดของน้ำเกลือ</label>
                                        <input
                                          type="text"
                                          placeholder="ระบุชนิดน้ำเกลือ เช่น Acetate, NaCl 0.9%..."
                                          value={newRecord.medicationGiveIvType || ''}
                                          onChange={(e) => setNewRecord({...newRecord, medicationGiveIvType: e.target.value})}
                                          className="w-full px-5 py-3.5 bg-amber-50/20 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-705 text-xs"
                                        />
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">ปริมาณน้ำเกลือ</label>
                                        <input
                                          type="text"
                                          placeholder="ระบุปริมาณ เช่น 100 ml, 50 ml/hr..."
                                          value={newRecord.medicationGiveIvVolume || ''}
                                          onChange={(e) => setNewRecord({...newRecord, medicationGiveIvVolume: e.target.value})}
                                          className="w-full px-5 py-3.5 bg-amber-50/20 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-705 text-xs"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Option 4: ป้อนข้าว */}
                              <div className={cn(
                                "p-4 rounded-2xl border border-dashed hover:border-amber-300 transition-all cursor-pointer",
                                newRecord.medicationFeedFood ? "border-amber-500 bg-amber-50/40 border-solid" : "border-slate-200 bg-white"
                              )} onClick={() => setNewRecord({...newRecord, medicationFeedFood: !newRecord.medicationFeedFood})}>
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                    newRecord.medicationFeedFood ? "border-amber-500 bg-amber-500" : "border-slate-200"
                                  )}>
                                    {newRecord.medicationFeedFood && <Check className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <span className={cn("text-xs font-black", newRecord.medicationFeedFood ? "text-amber-800" : "text-slate-600")}>ป้อนข้าว</span>
                                </div>
                                
                                {newRecord.medicationFeedFood && (
                                  <div className="mt-4 ml-8 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300" onClick={(e) => e.stopPropagation()}>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">รายละเอียดการป้อนข้าว</label>
                                    <input
                                      type="text"
                                      placeholder="ระบุชนิดอาหาร หรือ ปริมาณการป้อนในแต่ละมื้อ..."
                                      value={newRecord.medicationFeedFoodDetails || ''}
                                      onChange={(e) => setNewRecord({...newRecord, medicationFeedFoodDetails: e.target.value})}
                                      className="w-full px-5 py-3.5 bg-amber-50/20 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-705 text-xs"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>



                <div className="flex gap-4 pt-4 sticky bottom-0 bg-white p-4 -mx-8 border-t border-slate-100 z-20">
                  <button
                    type="button"
                    onClick={() => setIsAddingRecord(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all"
                  >
                    Admit Pet
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Immersive Clinical & Treatment Details Board */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex bg-slate-900/70 backdrop-blur-md overflow-hidden">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={() => setSelectedRecord(null)} />

            {/* Left Panel: Medical History Timeline (Image 1 Style Node Badge Timeline) */}
            <motion.div
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="hidden lg:flex flex-col w-[380px] h-full bg-slate-900/95 border-r border-slate-700/60 backdrop-blur-xl z-20 text-white p-5 overflow-hidden shadow-2xl shrink-0"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm text-slate-100 tracking-tight truncate">ประวัติการรักษา (Timeline)</h3>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      สัตว์ป่วย: {selectedRecord.petName} ({selectedRecord.ownerName || '-'})
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 bg-slate-800 text-sky-400 rounded-full text-[10px] font-mono font-bold border border-slate-700 shrink-0">
                  {patientTimelineHistory.length} รายการ
                </span>
              </div>

              {/* Timeline Items List (Image 1 Circular Date Badge Node Timeline) */}
              <div className="flex-1 overflow-y-auto pt-5 pr-1 custom-scrollbar">
                {isTimelineLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                    <span className="text-xs font-medium">กำลังโหลดประวัติการรักษา...</span>
                  </div>
                ) : patientTimelineHistory.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs font-medium bg-slate-800/40 rounded-2xl p-6 border border-slate-800/80 space-y-2">
                    <History className="w-8 h-8 mx-auto text-slate-600 mb-1" />
                    <p className="font-bold text-slate-300">ยังไม่มีประวัติการรักษาเดิม</p>
                    <p className="text-[10px] text-slate-500">ประวัติการตรวจ OPD/IPD ย้อนหลังจะแสดงที่นี่</p>
                  </div>
                ) : (
                  <div className="relative space-y-6 before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-[3px] before:bg-gradient-to-b before:from-amber-400 before:via-sky-400 before:to-rose-400 before:rounded-full before:opacity-80">
                    {patientTimelineHistory.map((item, idx) => {
                      const itemRawDate = item.date?.toDate 
                        ? item.date.toDate() 
                        : (item.date ? new Date(item.date) : new Date());
                      
                      const monthStr = format(itemRawDate, 'MMM').toUpperCase();
                      const dayStr = format(itemRawDate, 'dd');
                      const yearStr = format(itemRawDate, 'yyyy');
                      const timeStr = format(itemRawDate, 'HH:mm');

                      const isOPD = item.type === 'OPD';
                      const ringColor = isOPD ? 'border-amber-400 text-amber-500 shadow-amber-500/20' : 'border-rose-400 text-rose-500 shadow-rose-500/20';
                      const bulletBg = isOPD ? 'bg-amber-400' : 'bg-rose-500';

                      return (
                        <div key={`ipd-timeline-item-${item.type}-${item.id || 'no-id'}-${idx}`} className="relative flex items-center gap-3 group">
                          {/* Left: Circular Date Badge (Matches Image 1) */}
                          <div className={cn(
                            "relative z-10 w-14 h-14 rounded-full bg-white border-[3px] flex flex-col items-center justify-center shrink-0 shadow-md transition-transform group-hover:scale-105",
                            ringColor
                          )}>
                            <span className="text-[9px] font-black uppercase tracking-wider leading-none">
                              {monthStr}
                            </span>
                            <span className="text-base font-black text-slate-900 leading-none my-0.5">
                              {dayStr}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 leading-none">
                              {yearStr}
                            </span>
                          </div>

                          {/* Horizontal connector line */}
                          <div className="w-2.5 h-[2px] bg-slate-600/60 shrink-0" />

                          {/* Right: Sleek White Pill Container Card (Matches Image 1) */}
                          <div
                            onClick={() => setSelectedHistoryItem(item)}
                            className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-400/80 rounded-[22px] p-3.5 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer group/card space-y-1.5 overflow-hidden text-slate-800"
                            title="คลิกเพื่อดูรายละเอียดเวชระเบียน"
                          >
                            {/* Card Top Row */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn("w-2 h-2 rounded-full shrink-0 animate-pulse", bulletBg)} />
                                <span className="text-[10px] font-black tracking-wider uppercase text-slate-700 truncate">
                                  {isOPD ? 'MEDICAL NOTE (OPD)' : 'IPD ADMIT RECORD'}
                                </span>
                              </div>
                              <FileText className="w-3.5 h-3.5 text-slate-300 group-hover/card:text-sky-500 transition-colors shrink-0" />
                            </div>

                            {/* Diagnosis & Symptoms */}
                            <div>
                              <h4 className="text-xs font-black text-slate-900 group-hover/card:text-sky-600 transition-colors line-clamp-1">
                                {item.diagnosis}
                              </h4>
                              {item.symptoms && item.symptoms !== '-' && (
                                <p className="text-[10.5px] text-slate-500 line-clamp-1 font-medium mt-0.5">
                                  อาการ: {item.symptoms}
                                </p>
                              )}
                            </div>

                            {/* Card Bottom Info Row */}
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1.5 border-t border-slate-100">
                              <span className="font-mono font-bold text-slate-500">เวลา {timeStr} น.</span>
                              <span className="text-sky-600 font-bold flex items-center gap-1 group-hover/card:underline">
                                <Search className="w-3 h-3" /> ดูรายละเอียด
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative flex-1 h-full bg-slate-50 shadow-2xl flex flex-col z-10 min-w-0 overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-rose-100">
                    <Stethoscope className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{selectedRecord.petName}</h2>
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-lg text-[9.5px] font-black uppercase tracking-wider border border-rose-100">
                        กรง {selectedRecord.cageNumber}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mt-0.5">
                      เจ้าของ: {selectedRecord.ownerName} • โรค/อาการ: {selectedRecord.diagnosis}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowTimelineMobile(!showTimelineMobile)}
                    className="lg:hidden px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-sky-200 transition-colors"
                    title="เปิดดูประวัติการรักษา"
                  >
                    <History className="w-4 h-4 text-sky-600" />
                    <span>ประวัติ ({patientTimelineHistory.length})</span>
                  </button>

                  <button 
                    onClick={() => setSelectedRecord(null)} 
                    className="p-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-slate-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Segmented Navigation Bar */}
              <div className="bg-white px-6 py-2 border-b border-slate-100 flex gap-1">
                <button
                  onClick={() => setActiveBoardTab('plan')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2",
                    activeBoardTab === 'plan' 
                      ? "bg-rose-600 text-white shadow-md shadow-rose-100" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  )}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  แผนรักษา & บันทึกส่งเวร
                </button>
                <button
                  onClick={() => setActiveBoardTab('lab')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2",
                    activeBoardTab === 'lab' 
                      ? "bg-rose-600 text-white shadow-md shadow-rose-100" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  )}
                >
                  <Microscope className="w-3.5 h-3.5" />
                  ผลแล็บ IDEXX & รังสีวินิจฉัย
                </button>
                <button
                  onClick={() => setActiveBoardTab('rx')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2",
                    activeBoardTab === 'rx' 
                      ? "bg-rose-600 text-white shadow-md shadow-rose-100" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  )}
                >
                  <Pill className="w-3.5 h-3.5" />
                  สั่งจ่ายยา & พิมพ์ฉลากยาทันที
                </button>
              </div>

              {/* Tab Content Panels */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. CLINICAL PLAN & HANDOVER LOG TAB */}
                {activeBoardTab === 'plan' && (
                  <div className="space-y-6">
                    {/* Top Active plan status */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-4 bg-rose-600 rounded-full" />
                          <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">แอกทีฟแผนการรักษา (Active Treatment Plan)</h3>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">พิมพ์ข้อความแล้วคลิกบันทึก</span>
                      </div>
                      <div className="space-y-2">
                        <textarea
                          id="activeTreatmentPlanTextarea"
                          defaultValue={selectedRecord.treatmentPlan}
                          className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700 text-sm resize-none"
                          rows={4}
                          placeholder="กรอกรายละเอียดขั้นตอนและแผนการพยาบาลสำหรับพนักงานสัตวแพทย์..."
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={async () => {
                              const txtarea = document.getElementById('activeTreatmentPlanTextarea') as HTMLTextAreaElement;
                              if (txtarea) {
                                await handleUpdateTreatmentPlan(txtarea.value);
                              }
                            }}
                            className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 transition-all font-black text-[10px] uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            บันทึกแผนรักษา
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Vitals Dashboard */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                          <Scale className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Weight</p>
                          <p className="text-sm font-black text-slate-700">
                            {selectedRecord.latestVitals?.weight || '-'} kg
                          </p>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                          <Thermometer className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Temp</p>
                          <p className="text-sm font-black text-slate-700">
                            {selectedRecord.latestVitals?.temp || '-'} °C
                          </p>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                          <Heart className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Heart Rate</p>
                          <p className="text-sm font-black text-slate-700">
                            {selectedRecord.latestVitals?.heartRate || '-'} bpm
                          </p>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                          <Activity className="w-5 h-5 animate-bounce" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Resp Rate</p>
                          <p className="text-sm font-black text-slate-700">
                            {selectedRecord.latestVitals?.respiratoryRate || '-'} rpm
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Handover Daily Progress Note Form */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">เพิ่มบันทึกส่งเวรเวชระเบียน (Daily Progress & Shift Handover Log)</h3>
                      </div>

                      <div className="space-y-4">
                        {/* Shift selection & Vitals inputs */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ช่วงกะเวร</label>
                            <div className="flex p-0.5 bg-slate-100 rounded-xl gap-0.5">
                              <button
                                type="button"
                                onClick={() => setHandoverShift('Day')}
                                className={cn(
                                  "flex-1 py-2 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                                  handoverShift === 'Day' ? "bg-white text-amber-500 shadow-sm" : "text-slate-500"
                                )}
                              >
                                <Sun className="w-3 h-3" />
                                Day
                              </button>
                              <button
                                type="button"
                                onClick={() => setHandoverShift('Night')}
                                className={cn(
                                  "flex-1 py-2 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                                  handoverShift === 'Night' ? "bg-white text-indigo-500 shadow-sm" : "text-slate-500"
                                )}
                              >
                                <Moon className="w-3 h-3" />
                                Night
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Weight (kg)</label>
                            <input
                              type="text"
                              value={handoverWeight}
                              onChange={(e) => setHandoverWeight(e.target.value)}
                              placeholder="3.5"
                              className="w-full px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Temp (°C)</label>
                            <input
                              type="text"
                              value={handoverTemp}
                              onChange={(e) => setHandoverWeightTemp(e.target.value)}
                              placeholder="38.5"
                              className="w-full px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">HR (bpm)</label>
                            <input
                              type="text"
                              value={handoverHR}
                              onChange={(e) => setHandoverHR(e.target.value)}
                              placeholder="120"
                              className="w-full px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">RR (rpm)</label>
                            <input
                              type="text"
                              value={handoverRR}
                              onChange={(e) => setHandoverRR(e.target.value)}
                              placeholder="28"
                              className="w-full px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700 text-xs"
                            />
                          </div>
                        </div>

                        {/* Note text and Submit */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">บันทึกอาการและสิ่งที่ดำเนินการรักษาในรอบกะเวรนี้</label>
                          <div className="flex gap-3 items-end">
                            <textarea
                              value={handoverNote}
                              onChange={(e) => setHandoverNote(e.target.value)}
                              placeholder="พิมพ์การตรวจสุขภาพทั่วไป การให้ยา ป้อนสารอาหาร คราบอุจจาระ ปัสสาวะ หรือการส่งตัวรักษาระหว่างสัตวแพทย์รอบเวร..."
                              rows={2}
                              className="flex-1 px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700 text-xs resize-none"
                            />
                            <button
                              onClick={async () => {
                                if (!handoverNote.trim()) return;
                                try {
                                  const noteObj = {
                                    date: new Date().toISOString(),
                                    note: handoverNote,
                                    vet: user?.displayName || user?.email || 'Veterinarian',
                                    shift: handoverShift,
                                    vitals: {
                                      weight: handoverWeight,
                                      temp: handoverTemp,
                                      heartRate: handoverHR,
                                      respiratoryRate: handoverRR
                                    }
                                  };
                                  const updatedNotes = [...(selectedRecord.dailyNotes || []), noteObj];
                                  const recordRef = doc(db, 'ipd_records', selectedRecord.id);
                                  await updateDoc(recordRef, {
                                    dailyNotes: updatedNotes,
                                    latestVitals: {
                                      weight: handoverWeight || selectedRecord.latestVitals?.weight || '',
                                      temp: handoverTemp || selectedRecord.latestVitals?.temp || '',
                                      heartRate: handoverHR || selectedRecord.latestVitals?.heartRate || '',
                                      respiratoryRate: handoverRR || selectedRecord.latestVitals?.respiratoryRate || ''
                                    }
                                  });
                                  setSelectedRecord(prev => prev ? { 
                                    ...prev, 
                                    dailyNotes: updatedNotes,
                                    latestVitals: {
                                      weight: handoverWeight || prev.latestVitals?.weight || '',
                                      temp: handoverTemp || prev.latestVitals?.temp || '',
                                      heartRate: handoverHR || prev.latestVitals?.heartRate || '',
                                      respiratoryRate: handoverRR || prev.latestVitals?.respiratoryRate || ''
                                    }
                                  } : null);
                                  setHandoverNote('');
                                  setHandoverWeight('');
                                  setHandoverWeightTemp('');
                                  setHandoverHR('');
                                  setHandoverRR('');
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className="px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 shrink-0 self-stretch justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              ส่งเวรทันที
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* History Timeline */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-slate-400" />
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">ประวัติการพยาบาล & ส่งเวรที่ผ่านมา (Ward Clinical Timeline)</h4>
                      </div>

                      <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
                        {selectedRecord.dailyNotes && selectedRecord.dailyNotes.length > 0 ? (
                          [...selectedRecord.dailyNotes].reverse().map((note, i) => (
                            <div key={`ipd-daily-note-${note.date || 'dt'}-${i}`} className="relative">
                              {/* Timeline indicator circle */}
                              <div className={cn(
                                "absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-md",
                                note.shift === 'Night' ? "bg-indigo-500 text-white" : "bg-amber-400 text-white"
                              )}>
                                {note.shift === 'Night' ? <Moon className="w-2.5 h-2.5" /> : <Sun className="w-2.5 h-2.5" />}
                              </div>

                              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-700">{note.vet}</span>
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider",
                                      note.shift === 'Night' ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                                    )}>
                                      {note.shift === 'Night' ? '🌙 Night Shift' : '🌤️ Day Shift'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {note.date ? format(new Date(note.date), 'dd/MM/yyyy HH:mm') : 'N/A'}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-600 font-bold leading-relaxed">{note.note}</p>

                                {note.vitals && (note.vitals.weight || note.vitals.temp || note.vitals.heartRate || note.vitals.respiratoryRate) && (
                                  <div className="pt-2 border-t border-slate-50 flex flex-wrap gap-2">
                                    {note.vitals.weight && (
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                        <Scale className="w-2.5 h-2.5 text-slate-400" />
                                        Wt: {note.vitals.weight} kg
                                      </span>
                                    )}
                                    {note.vitals.temp && (
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                        <Thermometer className="w-2.5 h-2.5 text-slate-400" />
                                        T: {note.vitals.temp} °C
                                      </span>
                                    )}
                                    {note.vitals.heartRate && (
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                        <Heart className="w-2.5 h-2.5 text-rose-400" />
                                        HR: {note.vitals.heartRate} bpm
                                      </span>
                                    )}
                                    {note.vitals.respiratoryRate && (
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                        <Activity className="w-2.5 h-2.5 text-blue-400" />
                                        RR: {note.vitals.respiratoryRate} rpm
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="bg-white p-6 rounded-2xl border border-slate-150 text-center opacity-40">
                            <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">ยังไม่มีประวัติส่งเวรเข้ารักษา</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. LAB & DIAGNOSTICS BOARD TAB */}
                {activeBoardTab === 'lab' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    
                    {/* IDEXX Connection Status Card */}
                    <div className="bg-slate-900 text-white p-6 rounded-[2rem] border border-slate-800 shadow-2xl relative overflow-hidden">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl" />
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-sky-500/20 text-sky-400 rounded-xl flex items-center justify-center border border-sky-500/20">
                            <Microscope className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-wider text-slate-200">IDEXX VetLab Network Terminal</h4>
                            <p className="text-[10px] font-bold text-slate-400">STATUS: CONNECTED & ONLINE</p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setLabSyncing('syncing');
                            setTimeout(() => {
                              setLabSyncing('synced');
                              setLabCBC('WBC: 11.2 x10^3/uL (HIGH), RBC: 6.9 x10^6/uL, HGB: 15.1 g/dL, PLT: 280 x10^3/uL');
                              setLabBiochem('ALT: 52 U/L (HIGH), AST: 40 U/L, BUN: 22 mg/dL (HIGH), CRE: 1.3 mg/dL');
                              setLabElectrolytes('Na: 144 mmol/L, K: 3.9 mmol/L, Cl: 112 mmol/L');
                            }, 1200);
                          }}
                          disabled={labSyncing === 'syncing'}
                          className={cn(
                            "px-4 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg transition-all flex items-center gap-1.5",
                            labSyncing === 'syncing' 
                              ? "bg-slate-800 text-slate-500 border border-slate-700" 
                              : "bg-sky-500 hover:bg-sky-600 text-white"
                          )}
                        >
                          {labSyncing === 'syncing' ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                              Syncing Hardware...
                            </>
                          ) : labSyncing === 'synced' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              IDEXX Synced
                            </>
                          ) : 'Sync IDEXX Results'}
                        </button>
                      </div>

                      {/* Diagnostic Panels Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        {/* 1. CBC */}
                        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                          <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                            <span className="text-[10px] font-black tracking-widest uppercase text-sky-400">Hematology (CBC)</span>
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[8px] font-black uppercase">Normal</span>
                          </div>
                          <div className="space-y-1.5 font-mono text-[10px]">
                            {labCBC.split(', ').map((v, idx) => (
                              <div key={`cbc-val-${idx}`} className="flex justify-between text-slate-300">
                                <span>{v.split(': ')[0]}:</span>
                                <span className="font-bold text-white">{v.split(': ')[1]}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 2. Blood Biochem */}
                        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                          <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                            <span className="text-[10px] font-black tracking-widest uppercase text-sky-400">Biochemistry</span>
                            {labSyncing === 'synced' ? (
                              <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded text-[8px] font-black uppercase animate-pulse">Abnormal</span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[8px] font-black uppercase">Normal</span>
                            )}
                          </div>
                          <div className="space-y-1.5 font-mono text-[10px]">
                            {labBiochem.split(', ').map((v, idx) => (
                              <div key={`biochem-val-${idx}`} className="flex justify-between text-slate-300">
                                <span>{v.split(': ')[0]}:</span>
                                <span className={cn("font-bold", v.includes('HIGH') ? "text-rose-400" : "text-white")}>{v.split(': ')[1]}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 3. Electrolytes */}
                        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                          <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                            <span className="text-[10px] font-black tracking-widest uppercase text-sky-400">Electrolytes</span>
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[8px] font-black uppercase">Normal</span>
                          </div>
                          <div className="space-y-1.5 font-mono text-[10px]">
                            {labElectrolytes.split(', ').map((v, idx) => (
                              <div key={`electro-val-${idx}`} className="flex justify-between text-slate-300">
                                <span>{v.split(': ')[0]}:</span>
                                <span className="font-bold text-white">{v.split(': ')[1]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Radiology Viewer and Reports */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">รังสีวินิจฉัย & Diagnostic Imaging Viewer</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* B&W Radiology Viewer Canvas */}
                        <div className="bg-slate-950 p-4 rounded-2xl border-4 border-slate-800 shadow-inner relative flex flex-col items-center justify-center h-64 overflow-hidden group">
                          {/* Inverted Diagnostic Negative */}
                          <img
                            src="https://i.postimg.cc/qM9392S5/xray-dog.webp"
                            className="h-full object-contain filter invert opacity-90 group-hover:scale-105 transition-all duration-700"
                            alt="Xray"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "https://via.placeholder.com/300?text=Radiography+Negative";
                            }}
                          />
                          <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-[8px] font-mono text-emerald-400 border border-emerald-500/20">
                            FILT: NEG_INVERT_XRAY
                          </div>

                          <button
                            onClick={() => setZoomXray(true)}
                            className="absolute bottom-4 bg-white hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-800 shadow-lg transition-all"
                          >
                            Inspect Image (ขยายฟิล์มตรวจ)
                          </button>
                        </div>

                        {/* Diagnosis Report Writer */}
                        <div className="flex flex-col justify-between space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Radiological clinical report (รายงานผลรังสีวินิจฉัย)</label>
                            <textarea
                              id="radiologyNotesTextarea"
                              defaultValue={xrayNotes}
                              placeholder="ตัวอย่าง: พบเงาทึบผิดปกติบริเวณปอดส่วนท้าย หรือโครงสร้างกระดูกต้นขาหลังด้านขวามีรอยร้าวเคลื่อนตัวเล็กน้อย..."
                              rows={5}
                              className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700 text-xs resize-none"
                            />
                          </div>

                          <button
                            onClick={async () => {
                              const txtarea = document.getElementById('radiologyNotesTextarea') as HTMLTextAreaElement;
                              if (txtarea) {
                                try {
                                  await updateDoc(doc(db, 'ipd_records', selectedRecord.id), {
                                    xrayNotes: txtarea.value
                                  });
                                  setXrayNotes(txtarea.value);
                                  setSelectedRecord(prev => prev ? { ...prev, xrayNotes: txtarea.value } : null);
                                } catch (e) {
                                  console.error(e);
                                }
                              }
                            }}
                            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all shadow-md shadow-rose-100 flex items-center justify-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            บันทึกรายงานผลรังสี
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. DISPENSING & LABEL PRINTING TAB */}
                {activeBoardTab === 'rx' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Prescribing input controls */}
                      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                          <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">รายการยาและเวชภัณฑ์</h3>
                        </div>

                        {/* Select drug from Inventory */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">เลือกตัวยาในคลังสินค้า</label>
                          <select
                            value={rxDrugId}
                            onChange={(e) => {
                              const dId = e.target.value;
                              setRxDrugId(dId);
                              const selectedItem = inventoryDrugs.find(it => it.id === dId);
                              if (selectedItem) {
                                setRxInstruction(selectedItem.useLabel || `ป้อนครั้งละ 1 หน่วย หลังอาหาร เช้า-เย็น`);
                                setRxWarning(selectedItem.warningLabel || 'รับประทานติดต่อกันจนหมด');
                              }
                            }}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700 text-xs"
                          >
                            <option value="">-- เลือกยาหรืออุปกรณ์เวชภัณฑ์ --</option>
                            {inventoryDrugs.map((item, drugIdx) => (
                              <option key={`drug-opt-${item.id || 'drug'}-${drugIdx}`} value={item.id}>
                                {item.name} (คงเหลือ: {item.quantity || 0} {item.unit || 'ชิ้น'})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Dispense quantity */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">จำนวนจ่าย</label>
                          <input
                            type="number"
                            min="1"
                            value={rxQty}
                            onChange={(e) => setRxQty(Number(e.target.value))}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700 text-xs"
                          />
                        </div>

                        {/* Prescription usage details */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">วิธีใช้ยา / ข้อบ่งใช้ที่พิมพ์บนฉลาก</label>
                          <textarea
                            value={rxInstruction}
                            onChange={(e) => setRxInstruction(e.target.value)}
                            rows={2}
                            placeholder="ระบุวิธีใช้ รายละเอียดตามความต้องการของสัตวแพทย์..."
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700 text-xs resize-none"
                          />
                        </div>

                        {/* Warning notes */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">หมายเหตุ / คำเตือนพิเศษ</label>
                          <input
                            type="text"
                            value={rxWarning}
                            onChange={(e) => setRxWarning(e.target.value)}
                            placeholder="ห้ามใช้ในสัตว์มีครรภ์ หรือ นมแช่ตู้เย็น..."
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700 text-xs"
                          />
                        </div>

                        <button
                          onClick={() => {
                            if (!rxDrugId) return;
                            setRxShowLabel(true);
                            setPrintLabelAnimation(true);
                            setTimeout(() => setPrintLabelAnimation(false), 2000);
                          }}
                          className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                          <Printer className="w-4 h-4" />
                          พิมพ์ฉลากยาทันที (Print Thermal Label)
                        </button>
                      </div>

                      {/* Animated Thermal sticker preview */}
                      <div className="bg-slate-100 p-6 rounded-[2rem] flex flex-col justify-center items-center relative overflow-hidden min-h-64">
                        <div className="text-center mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          PREVIEW THERMAL PRESCRIPTION LABEL
                        </div>

                        <AnimatePresence>
                          {rxShowLabel && (
                            <motion.div
                              initial={{ y: -50, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: 50, opacity: 0 }}
                              className={cn(
                                "w-72 bg-white p-4 shadow-xl border border-slate-200 font-mono text-[9px] text-slate-800 space-y-3 relative rounded-sm transition-all",
                                printLabelAnimation ? "scale-95 opacity-50 translate-y-4 duration-500" : ""
                              )}
                            >
                              {/* Slit line mock */}
                              <div className="border-b-2 border-dashed border-slate-300 pb-2 text-center space-y-1">
                                <p className="font-sans font-bold text-[10px] uppercase text-rose-600">ANIMAL BOX CLINIC</p>
                                <p className="text-[7px]">โทร. 02-123-4567 • คลินิกสัตว์อัจฉริยะ</p>
                              </div>

                              <div className="space-y-1.5">
                                <p><span className="font-bold">คนไข้/สัตว์เลี้ยง:</span> {selectedRecord.petName} (สุนัข/แมว)</p>
                                <p><span className="font-bold">เจ้าของ:</span> {selectedRecord.ownerName}</p>
                                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                  <p className="font-bold text-rose-600 font-sans text-xs">
                                    {inventoryDrugs.find(it => it.id === rxDrugId)?.name || 'ตัวยาเวชภัณฑ์'}
                                  </p>
                                  <p className="text-[8px] mt-1 font-bold text-slate-500">วิธีใช้:</p>
                                  <p className="text-xs font-bold leading-relaxed">{rxInstruction}</p>
                                </div>
                                <p className="text-[8px] text-rose-600 font-bold"><span className="text-slate-500">คำเตือน:</span> {rxWarning}</p>
                              </div>

                              <div className="flex justify-between items-end pt-2 border-t border-slate-200">
                                <div>
                                  <p className="text-[6px]">วันที่สั่งจ่าย: {format(new Date(), 'dd/MM/yyyy')}</p>
                                  <p className="text-[6px]">สัตวแพทย์ผู้รักษารับอนุญาต</p>
                                </div>
                                <div className="w-10 h-10 bg-slate-200 flex items-center justify-center font-bold text-slate-400 text-[6px]">
                                  QR CODE
                                </div>
                              </div>

                              {printLabelAnimation && (
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center font-black text-[11px] text-emerald-600 uppercase tracking-widest animate-pulse">
                                  Printing label...
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {!rxShowLabel && (
                          <div className="text-slate-400 font-bold text-xs text-center flex flex-col items-center gap-2 opacity-50">
                            <Info className="w-8 h-8" />
                            <span>โปรดเลือกตัวยาและคลิกพิมพ์ฉลาก</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Radiology Full Screen Zoom Overlay */}
      <AnimatePresence>
        {zoomXray && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl">
            <div className="absolute top-6 right-6 flex gap-4">
              <button
                onClick={() => setZoomXray(false)}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="max-w-4xl max-h-[80vh] flex flex-col items-center justify-center p-6">
              <img
                src="https://i.postimg.cc/qM9392S5/xray-dog.webp"
                className="max-h-[70vh] object-contain filter invert border-4 border-slate-800 shadow-2xl rounded-lg"
                alt="Zoom Xray"
                referrerPolicy="no-referrer"
              />
              <p className="text-white/60 font-mono text-[10px] mt-4 uppercase tracking-widest">
                INVERTED MONOCHROME NEGATIVE VIEW • CANINE SKELETAL SYSTEM
              </p>
            </div>
          </div>
        )}
      </AnimatePresence>
      {/* 6. Patient Timeline History Item Detail Modal */}
      <AnimatePresence>
        {selectedHistoryItem && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHistoryItem(null)}
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
                    selectedHistoryItem.type === 'OPD' ? "bg-sky-500 shadow-sky-500/20" : "bg-rose-500 shadow-rose-500/20"
                  )}>
                    <History className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider border",
                        selectedHistoryItem.type === 'OPD' 
                          ? "bg-sky-50 text-sky-600 border-sky-200" 
                          : "bg-rose-50 text-rose-600 border-rose-200"
                      )}>
                        {selectedHistoryItem.type} Record
                      </span>
                      <span className="text-slate-400 text-xs font-mono font-bold">
                        {selectedHistoryItem.date?.toDate 
                          ? format(selectedHistoryItem.date.toDate(), 'dd/MM/yyyy HH:mm') 
                          : (selectedHistoryItem.date ? format(new Date(selectedHistoryItem.date), 'dd/MM/yyyy') : '-')}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-slate-800 leading-tight truncate mt-0.5">
                      {selectedHistoryItem.diagnosis}
                    </h3>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedHistoryItem(null)}
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
                    {selectedHistoryItem.symptoms || '-'}
                  </p>
                </div>

                {/* Vital Signs Grid */}
                {selectedHistoryItem.vitals && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">สัญญาณชีพ (Vital Signs)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-sky-50/50 p-2.5 rounded-xl border border-sky-100 text-center">
                        <span className="text-[9px] font-bold text-sky-600 block uppercase">น้ำหนัก</span>
                        <span className="text-xs font-black text-slate-800 font-mono">{selectedHistoryItem.vitals.weight || '-'} kg</span>
                      </div>
                      <div className="bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 text-center">
                        <span className="text-[9px] font-bold text-rose-600 block uppercase">อุณหภูมิ</span>
                        <span className="text-xs font-black text-slate-800 font-mono">{selectedHistoryItem.vitals.temp || '-'} °C</span>
                      </div>
                      <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 text-center">
                        <span className="text-[9px] font-bold text-amber-600 block uppercase">Heart Rate</span>
                        <span className="text-xs font-black text-slate-800 font-mono">{selectedHistoryItem.vitals.hr || selectedHistoryItem.vitals.heartRate || '-'} bpm</span>
                      </div>
                      <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 text-center">
                        <span className="text-[9px] font-bold text-emerald-600 block uppercase">Resp Rate</span>
                        <span className="text-xs font-black text-slate-800 font-mono">{selectedHistoryItem.vitals.rr || selectedHistoryItem.vitals.respRate || '-'} rpm</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Treatment Plan */}
                <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">แผนการรักษา & บันทึกแพทย์ (Treatment Plan)</span>
                  <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedHistoryItem.treatmentPlan || '-'}
                  </p>
                </div>

                {/* Prescribed Medications */}
                {selectedHistoryItem.medications && selectedHistoryItem.medications.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">รายการยาที่สั่งจ่าย (Medications)</span>
                    <div className="space-y-1.5">
                      {selectedHistoryItem.medications.map((m: any, mIdx: number) => (
                        <div key={`ipd-hist-med-${m.id || m.name || 'med'}-${mIdx}`} className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-slate-800 block">{m.name || m.drugName || 'ยา'}</span>
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
                  ผู้บันทึก: <span className="font-bold text-slate-700">{selectedHistoryItem.vetName || 'สัตวแพทย์'}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                <button 
                  onClick={() => setSelectedHistoryItem(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
                >
                  ปิด (Close)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Timeline History Sheet */}
      <AnimatePresence>
        {showTimelineMobile && selectedRecord && (
          <div className="fixed inset-0 z-[150] flex justify-start lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTimelineMobile(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-80 max-w-[85vw] h-full bg-slate-900 text-white p-5 flex flex-col z-10 overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-sky-400" />
                  <h3 className="font-bold text-sm text-slate-100">ประวัติการรักษา</h3>
                </div>
                <button 
                  onClick={() => setShowTimelineMobile(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pt-4 space-y-4">
                {isTimelineLoading ? (
                  <div className="text-center py-12 text-slate-400 text-xs">กำลังโหลด...</div>
                ) : patientTimelineHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">ไม่พบประวัติการรักษาเดิม</div>
                ) : (
                  <div className="relative space-y-5 before:absolute before:left-[23px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-amber-400 before:to-rose-400 before:opacity-60">
                    {patientTimelineHistory.map((item, idx) => {
                      const itemRawDate = item.date?.toDate 
                        ? item.date.toDate() 
                        : (item.date ? new Date(item.date) : new Date());
                      
                      const monthStr = format(itemRawDate, 'MMM').toUpperCase();
                      const dayStr = format(itemRawDate, 'dd');
                      const yearStr = format(itemRawDate, 'yyyy');
                      const isOPD = item.type === 'OPD';

                      return (
                        <div key={`mobile-timeline-item-${item.type}-${item.id || 'no-id'}-${idx}`} className="relative flex items-center gap-2.5">
                          {/* Circle badge */}
                          <div className={cn(
                            "relative z-10 w-12 h-12 rounded-full bg-white border-[2.5px] flex flex-col items-center justify-center shrink-0 text-slate-900 shadow-sm",
                            isOPD ? "border-amber-400 text-amber-500" : "border-rose-400 text-rose-500"
                          )}>
                            <span className="text-[8px] font-black uppercase leading-none">{monthStr}</span>
                            <span className="text-sm font-black text-slate-900 leading-none my-0.5">{dayStr}</span>
                            <span className="text-[7px] font-bold text-slate-400 leading-none">{yearStr}</span>
                          </div>

                          {/* Pill Card */}
                          <div
                            onClick={() => {
                              setSelectedHistoryItem(item);
                              setShowTimelineMobile(false);
                            }}
                            className="flex-1 bg-white p-3 rounded-2xl text-slate-800 space-y-1 cursor-pointer active:scale-98 transition-all shadow-xs"
                          >
                            <div className="flex items-center justify-between text-[9.5px]">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded font-black uppercase tracking-wider",
                                isOPD ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                              )}>
                                {isOPD ? 'OPD' : 'IPD'}
                              </span>
                              <FileText className="w-3 h-3 text-slate-400" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.diagnosis}</h4>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
