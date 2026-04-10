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
  PawPrint,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  CreditCard,
  Package
} from 'lucide-react';
import { motion } from 'motion/react';
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
import { format, subDays, isSameDay, startOfDay } from 'date-fns';

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
  const [topMeds, setTopMeds] = useState<any[]>([]);
  const [patientsMap, setPatientsMap] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const fetchDashboardData = async () => {
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

        // Fetch Data
        const [
          patientsSnap, 
          inventorySnap, 
          todayApptsSnap, 
          yesterdayApptsSnap,
          thisMonthOpdSnap,
          lastMonthOpdSnap,
          salesSnap
        ] = await Promise.all([
          getDocs(collection(db, 'patients')),
          getDocs(collection(db, 'inventory')),
          getDocs(query(collection(db, 'appointments'), where('startTime', '>=', todayStart), where('startTime', '<=', todayEnd))),
          getDocs(query(collection(db, 'appointments'), where('startTime', '>=', yesterdayStart), where('startTime', '<=', yesterdayEnd))),
          getDocs(query(collection(db, 'opd_records'), where('dateVisit', '>=', thisMonthStart))),
          getDocs(query(collection(db, 'opd_records'), where('dateVisit', '>=', lastMonthStart), where('dateVisit', '<=', lastMonthEnd))),
          getDocs(query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(100)))
        ]);

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

        // Health Trends
        const opds = thisMonthOpdSnap.docs.map(doc => doc.data());
        const diagMap: Record<string, number> = {};
        opds.forEach(o => {
          if (o.finalDiagnosis) {
            diagMap[o.finalDiagnosis] = (diagMap[o.finalDiagnosis] || 0) + 1;
          }
        });
        const diags = Object.entries(diagMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        setTopDiagnoses(diags);

        const medMap: Record<string, number> = {};
        opds.forEach(o => {
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
        console.error("Dashboard data fetch error:", err);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAuthReady, user]);

  const statCards = [
    { 
      label: 'Total Patients', 
      value: stats.totalPatients, 
      icon: Users, 
      color: 'bg-blue-500', 
      trend: `${stats.totalPatientsTrend >= 0 ? '+' : ''}${stats.totalPatientsTrend.toFixed(1)}%`, 
      isUp: stats.totalPatientsTrend >= 0 
    },
    { 
      label: "Today's Appts", 
      value: stats.todayAppointments, 
      icon: Calendar, 
      color: 'bg-indigo-500', 
      trend: `${stats.todayAppointmentsTrend.toFixed(0)}% Done`, 
      isUp: stats.todayAppointmentsTrend >= 50 
    },
    { 
      label: 'Low Stock Alerts', 
      value: stats.lowStockItems, 
      icon: AlertTriangle, 
      color: 'bg-amber-500', 
      trend: `${stats.lowStockTrend.toFixed(0)}% of Items`, 
      isUp: stats.lowStockTrend <= 20 
    },
    { 
      label: 'Monthly Revenue', 
      value: `฿${stats.monthlyRevenue.toLocaleString()}`, 
      icon: TrendingUp, 
      color: 'bg-emerald-500', 
      trend: `${stats.monthlyRevenueTrend >= 0 ? '+' : ''}${stats.monthlyRevenueTrend.toFixed(1)}%`, 
      isUp: stats.monthlyRevenueTrend >= 0 
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
            delay={i * 0.1}
          />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-8">Revenue Insights</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#00b4d8" strokeWidth={3} fill="#00b4d8" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-8">Health Trends</h3>
          <div className="space-y-6">
            {topDiagnoses.map((diag, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 truncate">{diag.name}</span>
                  <span className="text-slate-400">{diag.value}</span>
                </div>
                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                  <div className="h-full bg-[#00b4d8]" style={{ width: `${(diag.value / (topDiagnoses[0]?.value || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
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
              {[
                { item: 'Rabies Vaccine', stock: 5, min: 10 },
                { item: 'Surgical Gloves', stock: 2, min: 20 },
              ].map((item, i) => (
                <div key={`alert-${item.item}-${i}`} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.item}</p>
                    <p className="text-xs text-amber-600">Stock: {item.stock} (Min: {item.min})</p>
                  </div>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
              ))}
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
    </div>
  );
}

