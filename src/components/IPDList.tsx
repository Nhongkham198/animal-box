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
  Upload
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
  dailyNotes?: { date: any; note: string; vet: string }[];
  billingStatus?: 'unpaid' | 'paid' | 'none';
  isBoarding?: boolean;
  boardingDetails?: string;
  boardingFeedingMeal?: boolean;
  boardingFeedingMealTimes?: string[];
  boardingFeedingDaily?: boolean;
  boardingWalking?: boolean;
  vaccinationPhoto?: string;
  vaccinationDate?: string;
  vaccinationNextDate?: string;
  vaccineName?: string;
  isMedication?: boolean;
  medicationDetails?: string;
  dischargeDate?: string;
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
    vaccineName: '',
    vaccinationDate: '',
    vaccinationNextDate: '',
    vaccinationPhoto: '',
    isMedication: false,
    medicationDetails: '',
    dischargeDate: '',
    serviceCharge: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

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

    return () => unsubscribe();
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
      await addDoc(collection(db, 'ipd_records'), {
        ...newRecord,
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
        vaccineName: '',
        vaccinationDate: '',
        vaccinationNextDate: '',
        vaccinationPhoto: '',
        isMedication: false,
        medicationDetails: '',
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
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          IPD Record List
        </h1>
        <button 
          onClick={() => setIsAddingRecord(true)}
          className="px-6 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Admit New Pet
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-6">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
            <PawPrint className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Currently Admitted</p>
            <p className="text-3xl font-black text-slate-800">{records.filter(r => r.status !== 'Discharged').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-6">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Observation</p>
            <p className="text-3xl font-black text-slate-800">{records.filter(r => r.status === 'Observation').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-6">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Discharged Today</p>
            <p className="text-3xl font-black text-slate-800">
              {records.filter(r => r.status === 'Discharged' && r.dateDischarge?.toDate()?.toDateString() === new Date().toDateString()).length}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
        <div className="flex-1 relative min-w-[300px]">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Pet Name, Owner, or Cage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="p-4 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all border-2 border-transparent">
            <Filter className="w-5 h-5" />
          </button>
          <button className="p-4 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all border-2 border-transparent">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* IPD Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Patient & Cage</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Admit Date</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Diagnosis</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading records...</p>
                  </div>
                </td>
              </tr>
            ) : filteredRecords.length > 0 ? filteredRecords.map((record) => (
              <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-rose-50 rounded-2xl flex flex-col items-center justify-center border-2 border-rose-100/50 shadow-inner group-hover:scale-105 transition-all">
                      <span className="text-[10px] font-black text-rose-300 uppercase leading-none mb-1">Cage</span>
                      <span className="text-sm font-black text-rose-600 leading-none">{record.cageNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <p className="text-base font-black text-slate-800 leading-none">{record.petName}</p>
                          <div className="flex gap-1">
                            {record.isBoarding && (
                              <div className="w-6 h-6 bg-sky-50 text-sky-500 rounded-lg flex items-center justify-center border border-sky-100 shadow-sm" title="Boarding">
                                <Bed className="w-3.5 h-3.5" />
                              </div>
                            )}
                            {record.isMedication && (
                              <div className="w-6 h-6 bg-amber-50 text-amber-500 rounded-lg flex items-center justify-center border border-amber-100 shadow-sm" title="Medication">
                                <Pill className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {(record.isBoarding && (record.boardingFeedingMeal || record.boardingFeedingDaily || record.boardingWalking)) && (
                            <>
                              {record.boardingFeedingMeal && (
                                <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-lg text-[9px] font-black uppercase border border-sky-200 flex items-center gap-1.5">
                                  <div className="w-1 h-1 rounded-full bg-sky-600" />
                                  {record.boardingFeedingMealTimes?.map(t => t.replace('มื้อ', '')).join(', ') || 'อาหาร'}
                                </span>
                              )}
                              {record.boardingFeedingDaily && (
                                <span className="px-2 py-1 bg-sky-600 text-white rounded-lg text-[9px] font-black uppercase shadow-sm flex items-center gap-1.5">
                                  <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                  อาหารแบบเหมาจ่าย
                                </span>
                              )}
                              {record.boardingWalking && (
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase border border-emerald-100 flex items-center gap-1.5">
                                  <Check className="w-2 h-2" />
                                  พาเดินเล่น
                                </span>
                              )}
                            </>
                          )}

                          {/* Vaccination Status Badge */}
                          {record.isBoarding && record.vaccinationNextDate && (() => {
                            const today = new Date();
                            const nextDate = new Date(record.vaccinationNextDate);
                            const isSafe = nextDate > today;
                            const diffMonths = (nextDate.getFullYear() - today.getFullYear()) * 12 + (nextDate.getMonth() - today.getMonth());
                            
                            return (
                              <span className={cn(
                                "px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 border",
                                isSafe 
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                  : "bg-rose-50 text-rose-600 border-rose-100 animate-pulse"
                              )}>
                                <ShieldCheck className="w-2.5 h-2.5" />
                                {isSafe ? `ปลอดภัย (เหลือ ${diffMonths} เดือน)` : `ครบกำหนด/อันตราย!`}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.15em] flex items-center gap-1.5 group-hover:text-slate-600 transition-colors">
                        <User className="w-3.5 h-3.5 text-slate-300" /> {record.ownerName}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold">
                      {record.dateAdmit?.toDate ? format(record.dateAdmit.toDate(), 'dd MMM yyyy') : 'N/A'}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-slate-600 line-clamp-1 max-w-[200px]">{record.diagnosis}</p>
                    {record.dischargeDate && (
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 w-fit">
                        <CalendarIcon className="w-3 h-3" />
                        Out: {format(new Date(record.dischargeDate), 'dd MMM yyyy')}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5",
                    record.status === 'Admitted' ? "bg-rose-50 text-rose-600" :
                    record.status === 'Observation' ? "bg-amber-50 text-amber-600" :
                    "bg-emerald-50 text-emerald-600"
                  )}>
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      record.status === 'Admitted' ? "bg-rose-600" :
                      record.status === 'Observation' ? "bg-amber-600" :
                      "bg-emerald-600"
                    )} />
                    {record.status}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-rose-600 transition-all shadow-sm">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {record.status !== 'Discharged' && (
                      <button 
                        onClick={() => handleDischarge(record.id)}
                        className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
                      >
                        Discharge
                      </button>
                    )}
                    <button 
                      onClick={() => handleSendToBilling(record)}
                      disabled={record.billingStatus === 'paid' || record.billingStatus === 'unpaid'}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
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
                <td colSpan={5} className="px-8 py-20 text-center">
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
                          {searchResults.map((p) => (
                            <button
                              key={p.id}
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
                                        key={time}
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
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">รายละเอียดการให้ยา ( Medication Instructions )</label>
                            <textarea
                              rows={2}
                              value={newRecord.medicationDetails}
                              onChange={(e) => setNewRecord({...newRecord, medicationDetails: e.target.value})}
                              placeholder="ชื่อยาลำดับที่ 1: เม็ด/ครั้ง, เวลา..."
                              className="w-full px-5 py-4 bg-amber-50/30 border-2 border-amber-100 focus:border-amber-500 rounded-2xl transition-all outline-none font-medium text-slate-700 resize-none text-xs"
                            />
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
    </div>
  );
}
