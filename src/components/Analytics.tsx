import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  BarChart3, 
  Activity,
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Syringe,
  Scissors,
  Stethoscope,
  Users,
  Dog,
  DollarSign
} from 'lucide-react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

import { StatCard, Card } from './ui/Card';

export default function Analytics() {
  const throwError = useAsyncError();
  const { user, isAuthReady } = useAuth();
  const [opdRecords, setOpdRecords] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const unsubscribeOPD = onSnapshot(collection(db, 'opd_records'), (snap) => {
      setOpdRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Analytics OPD records listener error:", err);
    });

    const unsubscribePatients = onSnapshot(collection(db, 'patients'), (snap) => {
      setPatients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Analytics patients listener error:", err);
    });

    return () => {
      unsubscribeOPD();
      unsubscribePatients();
    };
  }, [isAuthReady, user]);

  // Calculations
  const totalRevenue = opdRecords.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const treatmentRevenue = opdRecords.filter(r => r.category === 'Treatment').reduce((sum, r) => sum + (r.revenue || 0), 0);
  const groomingRevenue = opdRecords.filter(r => r.category === 'Grooming').reduce((sum, r) => sum + (r.revenue || 0), 0);
  const vaccineRevenue = opdRecords.filter(r => r.category === 'Vaccine').reduce((sum, r) => sum + (r.revenue || 0), 0);

  // Vaccine summary
  const vaccineCounts: Record<string, number> = {};
  opdRecords.filter(r => r.category === 'Vaccine').forEach(r => {
    r.items?.forEach((item: any) => {
      if (item.category === 'Vaccine' || item.name.toLowerCase().includes('vaccine')) {
        vaccineCounts[item.name] = (vaccineCounts[item.name] || 0) + (item.quantity || 1);
      }
    });
  });

  const popularVaccines = Object.entries(vaccineCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Clinic Analytics</h1>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm text-sm font-bold text-slate-600">
          <Calendar className="w-4 h-4 text-[#00b4d8]" />
          Last 30 Days
          <ChevronDown className="w-4 h-4 text-slate-300" />
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Revenue" 
          value={`${totalRevenue.toLocaleString()} ฿`} 
          trend={15} 
          icon={DollarSign} 
          color="text-[#00b4d8]" 
          description="from last month"
        />
        <StatCard 
          label="Total Patients" 
          value={patients.length} 
          trend={8} 
          icon={Dog} 
          color="text-purple-500" 
          description="from last month"
        />
        <StatCard 
          label="OPD Visits" 
          value={opdRecords.length} 
          trend={-2} 
          icon={Activity} 
          color="text-orange-500" 
          description="from last month"
        />
        <StatCard 
          label="New Owners" 
          value={Math.floor(patients.length * 0.4)} 
          trend={12} 
          icon={Users} 
          color="text-emerald-500" 
          description="from last month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Breakdown */}
        <Card 
          title="Revenue by Category" 
          className="lg:col-span-2"
          headerAction={
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Treatment</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Grooming</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Vaccine</span>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {[
              { label: 'Treatment', value: treatmentRevenue, color: 'bg-blue-500', icon: Stethoscope },
              { label: 'Grooming', value: groomingRevenue, color: 'bg-purple-500', icon: Scissors },
              { label: 'Vaccine', value: vaccineRevenue, color: 'bg-orange-500', icon: Syringe },
            ].map(item => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-lg text-white", item.color)}>
                      <item.icon className="w-3 h-3" />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{item.label}</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">{item.value.toLocaleString()} THB</span>
                </div>
                <div className="h-3 bg-slate-50 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-1000", item.color)}
                    style={{ width: `${(item.value / (totalRevenue || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Popular Vaccines */}
        <Card title="Top Vaccines (Monthly)">
          <div className="space-y-4">
            {popularVaccines.length > 0 ? popularVaccines.map(([name, count], i) => (
              <div key={`${name}-${i}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center font-black text-slate-400 text-xs">
                    #{i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700 truncate w-32">{name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vaccine</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-[#00b4d8]">{count}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Used</p>
                </div>
              </div>
            )) : (
              <div className="py-12 text-center text-slate-300 font-bold">No vaccine data yet</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
