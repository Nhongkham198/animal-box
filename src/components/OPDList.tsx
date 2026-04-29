import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Calendar,
  ArrowRight,
  X,
  Upload,
  FileText,
  Trash2,
  DollarSign,
  Stethoscope,
  Scissors,
  Syringe,
  Check,
  Activity,
  History,
  Droplets,
  MoreHorizontal,
  PawPrint,
  Printer,
  Save,
  AlertCircle,
  Clock
} from 'lucide-react';
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
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  limit
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  addDays,
  subDays,
  isToday,
  isSameYear
} from 'date-fns';

interface OPDItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: string;
  type?: 'Oral' | 'Injection' | 'Service' | 'None';
}

interface OPDRecord {
  id: string;
  dateVisit: any;
  patientId: string;
  petName: string;
  ownerName: string;
  status: string;
  category: 'Treatment' | 'Grooming' | 'Vaccine' | 'Other';
  finalDiagnosis: string;
  revenue: number;
  attachments?: string[];
  items?: OPDItem[];
  billingStatus?: 'unpaid' | 'paid' | 'none';
  vitals?: {
    weight?: string;
    temp?: string;
    heartRate?: string;
    respiratoryRate?: string;
  };
  treatmentTx?: string;
  recipereRx?: string;
  plan?: string;
  clientEducation?: string;
  chiefComplaint?: string;
  historyTaking?: string;
  problemList?: string;
  typeOfFood?: string;
}

interface OPDQueueItem {
  id: string;
  patientId: string;
  patientName: string;
  ownerName: string;
  activities: string;
  startTime: any;
  status: string;
}

export default function OPDList({ setActiveView }: { setActiveView: (view: any) => void }) {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [records, setRecords] = useState<OPDRecord[]>([]);
  const [opdQueue, setOpdQueue] = useState<OPDQueueItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Record State
  const [newRecord, setNewRecord] = useState<any>({
    patientId: '',
    petName: '',
    category: 'Treatment',
    finalDiagnosis: '',
    status: 'Completed',
    attachments: [],
    items: [],
    vitals: {
      weight: '',
      temp: '',
      heartRate: '',
      respiratoryRate: ''
    },
    treatmentTx: '',
    recipereRx: '',
    plan: '',
    clientEducation: '',
    chiefComplaint: '',
    historyTaking: '',
    problemList: '',
    typeOfFood: ''
  });

  const [pastRecords, setPastRecords] = useState<any[]>([]);
  const [activeStep, setActiveStep] = useState(1);

  const [newItem, setNewItem] = useState({
    name: '',
    quantity: 1,
    price: 0,
    category: 'Medicine',
    type: 'Oral' as 'Oral' | 'Injection' | 'Service' | 'None'
  });

  const [petSearchQuery, setPetSearchQuery] = useState('');
  const [isPetDropdownOpen, setIsPetDropdownOpen] = useState(false);
  const petDropdownRef = useRef<HTMLDivElement>(null);

  const fetchPastRecords = async (patientId: string) => {
    try {
      const q = query(
        collection(db, 'opd_records'),
        where('patientId', '==', patientId),
        orderBy('dateVisit', 'desc'),
        limit(5)
      );
      const snap = await getDocs(q);
      setPastRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.warn("Error fetching past records (non-critical):", err);
    }
  };

  const selectedPatient = useMemo(() => {
    return patients.find(p => p.id === newRecord.patientId);
  }, [patients, newRecord.patientId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (petDropdownRef.current && !petDropdownRef.current.contains(event.target as Node)) {
        setIsPetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPatientsForSelect = useMemo(() => {
    if (!petSearchQuery) return patients;
    return patients.filter(p => 
      p.name.toLowerCase().includes(petSearchQuery.toLowerCase())
    );
  }, [patients, petSearchQuery]);

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) {
      if (isAuthReady && !isStaff) setLoading(false);
      return;
    }

    const q = query(collection(db, 'opd_records'), orderBy('dateVisit', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OPDRecord));
      setRecords(data);
      setLoading(false);
    }, (err) => {
      console.warn("OPD records listener (non-critical):", err);
      handleFirestoreError(err, OperationType.LIST, 'opd_records');
    });

    // Fetch current OPD queue from appointments
    const queueQuery = query(
      collection(db, 'appointments'),
      where('visitType', '==', 'OPD'),
      where('status', '!=', 'completed')
    );
    const unsubscribeQueue = onSnapshot(queueQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OPDQueueItem));
      setOpdQueue(data);
    }, (err) => {
      console.warn("OPD queue listener (non-critical):", err);
      handleFirestoreError(err, OperationType.LIST, 'appointments');
    });

    // Fetch patients and owners for selection
    Promise.all([
      getDocs(collection(db, 'patients')),
      getDocs(collection(db, 'owners'))
    ]).then(([patientSnap, ownerSnap]) => {
      const ownersMap: Record<string, { name: string, phone: string }> = {};
      ownerSnap.docs.forEach(doc => {
        const data = doc.data();
        ownersMap[doc.id] = { name: data.name, phone: data.phone };
      });

      const patientData = patientSnap.docs.map(doc => {
        const data = doc.data();
        const firstOwnerId = data.ownerIds?.[0];
        const owner = firstOwnerId ? ownersMap[firstOwnerId] : null;
        
        return {
          id: doc.id,
          name: data.name,
          ownerName: owner?.name || 'No Owner',
          ownerPhone: owner?.phone || '-',
          ...data
        };
      });
      setPatients(patientData);
    }).catch(err => {
      console.warn("Error fetching patients/owners for OPD selection (non-critical):", err);
      handleFirestoreError(err, OperationType.LIST, 'patients');
    });

    return () => {
      unsubscribe();
      unsubscribeQueue();
    };
  }, [isAuthReady, user, isStaff]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalRevenue = newRecord.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    
    try {
      if (editingRecordId) {
        await updateDoc(doc(db, 'opd_records', editingRecordId), {
          ...newRecord,
          revenue: totalRevenue,
          status: 'Completed',
          billingStatus: totalRevenue > 0 ? 'unpaid' : 'none',
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'opd_records'), {
          ...newRecord,
          revenue: totalRevenue,
          status: 'Completed',
          billingStatus: totalRevenue > 0 ? 'unpaid' : 'none',
          dateVisit: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
      setIsAddingRecord(false);
      setEditingRecordId(null);
      setActiveStep(1);
      setPastRecords([]);
      setNewRecord({
        patientId: '',
        petName: '',
        category: 'Treatment',
        finalDiagnosis: '',
        status: 'Completed',
        attachments: [],
        items: [],
        vitals: { weight: '', temp: '', heartRate: '', respiratoryRate: '' },
        treatmentTx: '',
        recipereRx: '',
        plan: '',
        clientEducation: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'opd_records');
    }
  };

  const handleStartRecordFromQueue = async (item: OPDQueueItem) => {
    try {
      const opdRef = await addDoc(collection(db, 'opd_records'), {
        patientId: item.patientId,
        petName: item.patientName,
        ownerName: item.ownerName || '',
        category: 'Treatment',
        finalDiagnosis: item.activities || '',
        status: 'In Progress',
        billingStatus: 'none',
        revenue: 0,
        items: [],
        attachments: [],
        vitals: { weight: '', temp: '', heartRate: '', respiratoryRate: '' },
        treatmentTx: '',
        recipereRx: '',
        plan: '',
        clientEducation: '',
        chiefComplaint: '',
        historyTaking: '',
        problemList: '',
        typeOfFood: '',
        dateVisit: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'appointments', item.id), {
        status: 'completed'
      });

      setEditingRecordId(opdRef.id);
      setNewRecord({
        patientId: item.patientId,
        petName: item.patientName,
        category: 'Treatment',
        finalDiagnosis: item.activities || '',
        status: 'In Progress',
        attachments: [],
        items: [],
        vitals: { weight: '', temp: '', heartRate: '', respiratoryRate: '' },
        treatmentTx: '',
        recipereRx: '',
        plan: '',
        clientEducation: ''
      });
      fetchPastRecords(item.patientId);
      setIsAddingRecord(true);
      setActiveStep(1);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'opd_records');
    }
  };

  const handleEditRecord = (record: OPDRecord) => {
    setEditingRecordId(record.id);
    setNewRecord({
      patientId: record.patientId,
      petName: record.petName,
      category: record.category,
      finalDiagnosis: record.finalDiagnosis || '',
      status: record.status,
      attachments: record.attachments || [],
      items: record.items || [],
      vitals: record.vitals || { weight: '', temp: '', heartRate: '', respiratoryRate: '' },
      treatmentTx: record.treatmentTx || '',
      recipereRx: record.recipereRx || '',
      plan: record.plan || '',
      clientEducation: record.clientEducation || '',
      chiefComplaint: record.chiefComplaint || '',
      historyTaking: record.historyTaking || '',
      problemList: record.problemList || '',
      typeOfFood: record.typeOfFood || ''
    });
    fetchPastRecords(record.patientId);
    setIsAddingRecord(true);
    setActiveStep(1);
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'opd_records', id));
      if (editingRecordId === id) {
        setIsAddingRecord(false);
        setEditingRecordId(null);
      }
      setIsDeleting(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'opd_records');
    }
  };

  const addItem = () => {
    if (!newItem.name || newItem.price <= 0) return;
    setNewRecord(prev => ({
      ...prev,
      items: [...prev.items, { ...newItem, id: crypto.randomUUID() }]
    }));
    setNewItem({ name: '', quantity: 1, price: 0, category: 'Medicine', type: 'Oral' });
  };

  const removeItem = (id: string) => {
    setNewRecord(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewRecord(prev => ({
          ...prev,
          attachments: [...prev.attachments, reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Treatment': return <Stethoscope className="w-4 h-4" />;
      case 'Grooming': return <Scissors className="w-4 h-4" />;
      case 'Vaccine': return <Syringe className="w-4 h-4" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  const handleAdmitToIPD = async (record: OPDRecord) => {
    try {
      await addDoc(collection(db, 'ipd_records'), {
        patientId: record.patientId,
        petName: record.petName,
        ownerName: record.ownerName || 'Unknown Owner',
        cageNumber: 'TBD',
        diagnosis: record.finalDiagnosis || 'Transferred from OPD',
        treatmentPlan: 'Initial evaluation from OPD',
        status: 'Admitted',
        dateAdmit: serverTimestamp(),
        dailyNotes: []
      });
      setActiveView('ipd');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'ipd_records');
    }
  };

  const handleSendToBilling = async (record: OPDRecord) => {
    if (record.revenue <= 0) return;
    try {
      await updateDoc(doc(db, 'opd_records', record.id), {
        billingStatus: 'unpaid',
        status: 'Completed'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'opd_records');
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.finalDiagnosis && r.finalDiagnosis.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const recordDate = r.dateVisit?.toDate ? r.dateVisit.toDate() : new Date(r.dateVisit);
    const matchesDate = isSameDay(recordDate, currentMonth);
    
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Top Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#00b4d8] font-medium cursor-pointer hover:underline">Home</span>
          <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
          <span className="text-slate-400">OPD List</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAddingRecord(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#d8b4fe] text-slate-700 rounded-lg font-bold hover:bg-[#e9d5ff] transition-all text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            OPD Record
          </button>
        </div>
      </div>

      {/* Page Title */}
      <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
        OPD RECORD LIST
      </h1>

      {/* Overview Card */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Overview</h3>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setCurrentMonth(subDays(currentMonth, 1))}
                    className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <span 
                    onClick={() => {
                      setViewDate(currentMonth);
                      setIsDatePickerOpen(true);
                    }}
                    className="text-2xl font-bold text-slate-800 cursor-pointer hover:text-[#00b4d8] transition-colors"
                  >
                    {format(currentMonth, 'dd MMMM yyyy')}
                  </span>
                  <button 
                    onClick={() => setCurrentMonth(addDays(currentMonth, 1))}
                    className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-12 divide-x divide-slate-100">
              <div className="pl-12 flex items-baseline justify-between gap-8">
                <p className="text-sm font-bold text-slate-800">Gain Revenue</p>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-800">
                    {filteredRecords.reduce((sum, r) => sum + r.revenue, 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">THB</p>
                </div>
              </div>
              <div className="pl-12 flex items-baseline justify-between gap-8">
                <p className="text-sm font-bold text-slate-800">Done</p>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-800">{filteredRecords.filter(r => r.status === 'Completed').length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">case</p>
                </div>
              </div>
              <div className="pl-12 flex items-baseline justify-between gap-8">
                <p className="text-sm font-bold text-slate-800">Pending</p>
                <div className="text-right">
                  <p className="text-2xl font-black text-amber-500">{opdQueue.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">case</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Patient Names List */}
          {opdQueue.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-500" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Patients</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {opdQueue.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => handleStartRecordFromQueue(item)}
                    className="px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-amber-100 transition-all group"
                  >
                    <span className="text-xs font-bold text-amber-700">{item.patientName}</span>
                    <ArrowRight className="w-3 h-3 text-amber-300 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Today's OPD Queue */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Today's OPD Queue</h3>
            <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-widest">
              {opdQueue.length} Active
            </span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[120px] pr-2 custom-scrollbar">
            {opdQueue.length > 0 ? opdQueue.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100 group-hover:text-indigo-500 transition-colors">
                    <PawPrint className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">{item.patientName}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.activities}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400">{item.startTime?.toDate ? format(item.startTime.toDate(), 'hh:mm a') : 'N/A'}</p>
                    <button 
                      onClick={() => handleStartRecordFromQueue(item)}
                      className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline"
                    >
                      Start Record
                    </button>
                </div>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                <Stethoscope className="w-8 h-8 opacity-20" />
                <p className="text-[10px] font-bold uppercase tracking-widest">No active cases</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Search</h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center">
              <input 
                type="text" 
                placeholder="Pet Name, H.N., Owner, Medical Record ID , Tel"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-l-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent outline-none text-sm placeholder:text-slate-300"
              />
              <button className="px-5 py-2.5 bg-slate-50 border border-l-0 border-slate-200 rounded-r-xl hover:bg-slate-100 transition-colors">
                <Search className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Result Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-black text-[#00b4d8] uppercase tracking-wider">
            {filteredRecords.length} RESULT
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm",
                isEditMode 
                  ? "bg-rose-500 text-white border-rose-500 shadow-rose-100" 
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
              )}
            >
              {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Date Visit</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Pet</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Final Diagnosis</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400">Loading...</td>
                </tr>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr 
                    key={record.id} 
                    onClick={() => handleEditRecord(record)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-8 py-4 font-medium text-slate-600">
                      {format(record.dateVisit?.toDate ? record.dateVisit.toDate() : new Date(record.dateVisit), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-8 py-4 font-bold text-slate-900">{record.petName}</td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "p-1.5 rounded-lg",
                          record.category === 'Treatment' ? "bg-blue-100 text-blue-600" :
                          record.category === 'Grooming' ? "bg-purple-100 text-purple-600" :
                          record.category === 'Vaccine' ? "bg-orange-100 text-orange-600" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {getCategoryIcon(record.category)}
                        </span>
                        <span className="text-xs font-bold text-slate-600">{record.category}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                        record.status === 'Completed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-slate-600">{record.finalDiagnosis || '-'}</td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="text-right mr-2">
                          <p className="font-black text-slate-900">{record.revenue.toLocaleString()} THB</p>
                        </div>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdmitToIPD(record);
                          }}
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100"
                          title="Admit to IPD"
                        >
                          Admit
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendToBilling(record);
                          }}
                          disabled={record.billingStatus === 'paid' || record.billingStatus === 'unpaid'}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                            record.billingStatus === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            record.billingStatus === 'unpaid' ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                          )}
                          title="Send to Billing"
                        >
                          {record.billingStatus === 'paid' ? 'Paid' : record.billingStatus === 'unpaid' ? 'In Billing' : 'Billing'}
                        </button>

                        {isEditMode && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditRecord(record);
                              }}
                              className="p-2 text-slate-400 hover:text-[#00b4d8] hover:bg-cyan-50 rounded-lg transition-all"
                              title="Edit Record"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsDeleting(record.id);
                              }}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative w-80 h-80 opacity-60">
                        <img 
                          src="https://www.vremind.co/img/medical-record-no-result.2b3dd25c.png" 
                          alt="No Records"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <p className="text-2xl font-bold text-slate-300">ไม่มีรายการตรวจรักษาในวันนี้</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add OPD Record Modal */}
      {isAddingRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex h-[90vh]">
            {/* Left: Form Column */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-50">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                    {editingRecordId ? 'Consultation' : 'New OPD Visit'}
                  </h2>
                  <div className="h-5 w-[1px] bg-slate-200" />
                  <div className="flex items-center gap-0 ml-2">
                    {[
                      { label: 'รอคิว', id: 0 },
                      { label: 'พบแพทย์', id: 1 },
                      { label: 'รอชำระเงิน/รับยา', id: 2 },
                      { label: 'เสร็จสิ้น', id: 3 }
                    ].map((step, idx) => {
                      // Custom mapping for current state
                      let isCompleted = false;
                      let isCurrent = false;

                      if (activeStep === 1) {
                        if (idx === 0) isCompleted = true;
                        if (idx === 1) isCurrent = true;
                      } else if (activeStep === 2) {
                        if (idx === 0) isCompleted = true;
                        if (idx === 1) isCurrent = true;
                      } else if (activeStep === 3) {
                        if (idx <= 1) isCompleted = true;
                        if (idx === 2) isCurrent = true;
                      }

                      return (
                        <div key={idx} className="flex items-center">
                          <div className="flex flex-col items-center relative group">
                            {/* Circle Node */}
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-700 z-10 bg-white",
                              isCompleted ? "border-[#00b4d8] bg-[#00b4d8]" : (isCurrent ? "border-[#00b4d8]" : "border-slate-200")
                            )}>
                              {isCompleted ? (
                                <Check className="w-3 h-3 text-white" strokeWidth={4} />
                              ) : (
                                isCurrent && <div className="w-2 h-2 rounded-full bg-[#00b4d8] animate-pulse" />
                              )}
                            </div>
                            
                            {/* Label */}
                            <span className={cn(
                              "text-[9px] font-black absolute top-6 min-w-[60px] text-center uppercase tracking-tighter transition-colors duration-500",
                              isCompleted || isCurrent ? "text-[#00b4d8]" : "text-slate-300"
                            )}>
                              {step.label}
                            </span>
                          </div>

                          {/* Connector Line */}
                          {idx < 3 && (
                            <div className={cn(
                              "w-12 h-[2px] transition-all duration-700 -mt-0",
                              isCompleted ? "bg-[#00b4d8]" : "bg-slate-100"
                            )} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button onClick={() => { setIsAddingRecord(false); setEditingRecordId(null); setActiveStep(1); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddRecord} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex-1 p-8">
                  {activeStep === 1 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="space-y-1 relative" ref={petDropdownRef}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Patient *</label>
                        <div className="relative">
                          <input 
                            type="text"
                            required={!newRecord.patientId}
                            placeholder={newRecord.petName || "Search pet name or HN..."}
                            value={petSearchQuery}
                            onFocus={() => setIsPetDropdownOpen(true)}
                            onChange={(e) => {
                              setPetSearchQuery(e.target.value);
                              setIsPetDropdownOpen(true);
                            }}
                            className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-sky-50 outline-none text-sm font-bold shadow-inner placeholder:text-slate-300"
                          />
                          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>

                        <AnimatePresence>
                          {isPetDropdownOpen && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-60 overflow-y-auto custom-scrollbar"
                            >
                              {filteredPatientsForSelect.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setNewRecord({ ...newRecord, patientId: p.id, petName: p.name });
                                    setPetSearchQuery('');
                                    setIsPetDropdownOpen(false);
                                    fetchPastRecords(p.id);
                                  }}
                                  className="w-full px-6 py-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group flex items-center justify-between"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800">{p.name}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">HN: {p.hn} • {p.ownerName}</span>
                                  </div>
                                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[#00b4d8] font-black uppercase tracking-widest">Select Patient</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-sky-50/50 rounded-[2.5rem] border border-sky-100/50 space-y-6">
                          <h4 className="text-[10px] font-black text-sky-600 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Vital Signs
                          </h4>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5 focus-within:translate-y-[-2px] transition-transform">
                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Weight (kg)</label>
                              <input 
                                type="text" 
                                value={newRecord.vitals.weight}
                                onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, weight: e.target.value}})}
                                className="w-full bg-white rounded-xl border border-slate-100 text-sm font-bold py-3 px-4 shadow-inner text-slate-700 outline-none focus:ring-2 focus:ring-sky-200" 
                                placeholder="0.0"
                              />
                            </div>
                            <div className="space-y-1.5 focus-within:translate-y-[-2px] transition-transform">
                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Temp (°C)</label>
                              <input 
                                type="text" 
                                value={newRecord.vitals.temp}
                                onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, temp: e.target.value}})}
                                className="w-full bg-white rounded-xl border border-slate-100 text-sm font-bold py-3 px-4 shadow-inner text-slate-700 outline-none focus:ring-2 focus:ring-sky-200" 
                                placeholder="38.5"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Visit Category</label>
                          <div className="grid grid-cols-2 gap-3">
                            {['Treatment', 'Grooming', 'Vaccine', 'Other'].map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setNewRecord({ ...newRecord, category: cat as any })}
                                className={cn(
                                  "px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                  newRecord.category === cat 
                                    ? "bg-[#00b4d8] text-white border-[#00b4d8] shadow-xl shadow-cyan-100 scale-[1.02]" 
                                    : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                                )}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Problem Oriented Section */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="h-[1px] flex-1 bg-slate-100" />
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Problem Oriented</h4>
                          <div className="h-[1px] flex-1 bg-slate-100" />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="space-y-1.5 group">
                              <label className="text-[10px] font-black text-[#00b4d8] uppercase tracking-widest flex items-center gap-2 ml-1">
                                <Activity className="w-3 h-3" /> Chief Complaint (CC)
                              </label>
                              <textarea 
                                value={newRecord.chiefComplaint}
                                onChange={e => setNewRecord({...newRecord, chiefComplaint: e.target.value})}
                                rows={3}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-sky-50 outline-none transition-all placeholder:text-slate-300"
                                placeholder="อาการที่ส่งผลให้ต้องมาพบหมอ..."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                                <History className="w-3 h-3" /> History Taking (HT)
                              </label>
                              <textarea 
                                value={newRecord.historyTaking}
                                onChange={e => setNewRecord({...newRecord, historyTaking: e.target.value})}
                                rows={4}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-sky-50 outline-none transition-all placeholder:text-slate-300"
                                placeholder="ประวัติตามข้อมูลจากเจ้าของสัตว์..."
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                                <Stethoscope className="w-3 h-3" /> Problem List
                              </label>
                              <textarea 
                                value={newRecord.problemList}
                                onChange={e => setNewRecord({...newRecord, problemList: e.target.value})}
                                rows={3}
                                className="w-full bg-rose-50/20 border border-rose-100/30 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-rose-50 outline-none transition-all placeholder:text-slate-300"
                                placeholder="รายการปัญหาที่ตรวจพบเบื้องต้น..."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                                <Droplets className="w-3 h-3" /> Type of food
                              </label>
                              <input 
                                value={newRecord.typeOfFood}
                                onChange={e => setNewRecord({...newRecord, typeOfFood: e.target.value})}
                                type="text"
                                className="w-full bg-emerald-50/20 border border-emerald-100/30 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-emerald-50 outline-none transition-all placeholder:text-slate-300"
                                placeholder="อาหารที่กินปกติ..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                        <button 
                          type="button" 
                          onClick={() => newRecord.patientId && setActiveStep(2)}
                          disabled={!newRecord.patientId}
                          className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 shadow-2xl flex items-center justify-center gap-3 active:scale-95"
                        >
                          Step 2: Start Diagnosis <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-8">
                      <div className="grid grid-cols-1 gap-6">
                        {/* Treatment Section */}
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-[#00b4d8] uppercase tracking-widest flex items-center gap-2 ml-1">
                            <Activity className="w-3 h-3" /> Treatment: Tx
                          </label>
                          <textarea 
                            rows={2}
                            value={newRecord.treatmentTx}
                            onChange={(e) => setNewRecord({ ...newRecord, treatmentTx: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-sky-50 outline-none text-sm font-medium shadow-inner placeholder:text-slate-300"
                            placeholder="แผนการรักษา..."
                          />
                        </div>

                        {/* Recipere Section */}
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                            <Droplets className="w-3 h-3" /> Recipere: Rx
                          </label>
                          <textarea 
                            rows={3}
                            value={newRecord.recipereRx}
                            onChange={(e) => setNewRecord({ ...newRecord, recipereRx: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-rose-50/30 border border-rose-100/50 focus:ring-4 focus:ring-rose-50 outline-none text-sm font-medium shadow-inner placeholder:text-slate-300 font-mono"
                            placeholder="รายการยาและขนาดยา (e.g. Medicine 20mg PO SID * 7)..."
                          />
                        </div>

                        {/* Plan Section */}
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                            <History className="w-3 h-3" /> Plan: แผนการรักษาต่อเนื่อง
                          </label>
                          <textarea 
                            rows={2}
                            value={newRecord.plan}
                            onChange={(e) => setNewRecord({ ...newRecord, plan: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-sky-50 outline-none text-sm font-medium shadow-inner placeholder:text-slate-300"
                            placeholder="แผนสำรองหรือการนัดหมายครั้งถัดไป..."
                          />
                        </div>

                        {/* Client Education Section */}
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                            <Stethoscope className="w-3 h-3" /> Client Education: คำแนะนำสำหรับเจ้าของ
                          </label>
                          <textarea 
                            rows={2}
                            value={newRecord.clientEducation}
                            onChange={(e) => setNewRecord({ ...newRecord, clientEducation: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border border-emerald-100/50 focus:ring-4 focus:ring-emerald-50 outline-none text-sm font-medium shadow-inner placeholder:text-slate-300"
                            placeholder="ข้อควรปฏิบัติและการสังเกตอาการที่บ้าน..."
                          />
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4 border-t border-slate-100">
                        <button 
                          type="button" 
                          onClick={() => setActiveStep(1)}
                          className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-sans"
                        >
                          Back
                        </button>
                        <button 
                          type="button" 
                          onClick={() => {
                            // Synthesize finalDiagnosis for backward compatibility or display
                            const combinedDiagnosis = `CC: ${newRecord.chiefComplaint}\nHT: ${newRecord.historyTaking}\nTx: ${newRecord.treatmentTx}\nRx: ${newRecord.recipereRx}\nPlan: ${newRecord.plan}\nEducation: ${newRecord.clientEducation}`;
                            setNewRecord({ ...newRecord, finalDiagnosis: combinedDiagnosis });
                            setActiveStep(3);
                          }}
                          className="flex-[2] py-5 bg-[#00b4d8] text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#0096b1] transition-all shadow-2xl shadow-cyan-100 active:scale-95 transition-all"
                        >
                          Next: Pharmacy & Billing
                        </button>
                      </div>
                    </div>
                  )}

                  {activeStep === 3 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <Droplets className="w-3 h-3 text-emerald-500" /> Dispensing & Billing
                          </label>
                          <div className="flex gap-2">
                            {(['Oral', 'Injection', 'Service'] as const).map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setNewItem({...newItem, type: t, category: t === 'Service' ? 'Service' : 'Medicine'})}
                                className={cn(
                                  "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                                  newItem.type === t 
                                    ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-100" 
                                    : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="p-8 bg-emerald-50/40 rounded-[2.5rem] border border-emerald-100/50 flex flex-col gap-4">
                          <div className="flex gap-4">
                            <div className="flex-1 relative">
                              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
                              <input 
                                type="text"
                                placeholder={newItem.type === 'Oral' ? "Search Oral Medicine..." : (newItem.type === 'Injection' ? "Search Injection..." : "Search Service...") }
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                className="w-full pl-12 pr-6 py-4 bg-white border-none rounded-2xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                              />
                            </div>
                            <div className="w-24">
                              <input 
                                type="number"
                                value={newItem.quantity}
                                onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                                className="w-full px-4 py-4 bg-white border-none rounded-2xl text-sm text-center font-bold shadow-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                              />
                            </div>
                            <div className="w-32">
                              <input 
                                type="number"
                                placeholder="Price"
                                value={newItem.price || ''}
                                onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })}
                                className="w-full px-4 py-4 bg-white border-none rounded-2xl text-sm text-center font-black shadow-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                              />
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={addItem}
                            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            Add To Prescription <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                          {newRecord.items.map((itemValue: any) => (
                            <div key={itemValue.id} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm group hover:border-emerald-200 transition-all">
                              <div className="flex items-center gap-5">
                                <div className={cn(
                                  "w-12 h-12 rounded-[1rem] flex items-center justify-center transition-colors",
                                  itemValue.type === 'Oral' ? "bg-amber-50 text-amber-500" : (itemValue.type === 'Injection' ? "bg-rose-50 text-rose-500" : "bg-sky-50 text-sky-500")
                                )}>
                                  {itemValue.type === 'Oral' ? <Activity className="w-6 h-6" /> : (itemValue.type === 'Injection' ? <Syringe className="w-6 h-6" /> : <Stethoscope className="w-6 h-6" />)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-slate-800">{itemValue.name}</p>
                                    <span className={cn(
                                      "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                                      itemValue.type === 'Oral' ? "border-amber-200 text-amber-500" : (itemValue.type === 'Injection' ? "border-rose-200 text-rose-500" : "border-sky-200 text-sky-500")
                                    )}>
                                      {itemValue.type}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Qty: {itemValue.quantity} • {itemValue.price} THB each</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <span className="text-sm font-black text-slate-900">{(itemValue.price * itemValue.quantity).toLocaleString()} THB</span>
                                <div className="flex items-center gap-2">
                                  {itemValue.type === 'Oral' && (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        const printWindow = window.open('', '_blank', 'width=400,height=300');
                                        if (!printWindow) return;
                                        printWindow.document.write(`
                                          <html>
                                            <head>
                                              <style>
                                                @page { size: 80mm 50mm; margin: 0; }
                                                body { font-family: sans-serif; padding: 15px; }
                                                .label { border: 2px solid #000; height: 100%; display: flex; flex-direction: column; border-radius: 8px; }
                                                .header { font-weight: 900; background: #000; color: #fff; padding: 5px 10px; font-size: 14px; text-transform: uppercase; }
                                                .content { padding: 10px; font-size: 12px; flex: 1; }
                                                .pet { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
                                                .med { font-size: 14px; color: #333; margin-bottom: 10px; }
                                                .footer { font-size: 10px; background: #f5f5f5; padding: 5px 10px; border-top: 1px solid #eee; text-align: right; }
                                              </style>
                                            </head>
                                            <body>
                                              <div class="label">
                                                <div class="header">Prescription Label</div>
                                                <div class="content">
                                                  <div class="pet">Patient: ${newRecord.petName}</div>
                                                  <div class="med">Medicine: ${itemValue.name}</div>
                                                  <div class="instr">Qty: ${itemValue.quantity} Units</div>
                                                  <div class="date">Date: ${format(new Date(), 'dd/MM/yyyy')}</div>
                                                </div>
                                                <div class="footer">ANIMAL BOX CLINIC</div>
                                              </div>
                                              <script>window.onload = () => { window.print(); window.close(); };</script>
                                            </body>
                                          </html>
                                        `);
                                        printWindow.document.close();
                                      }}
                                      className="p-2 bg-amber-50 text-amber-500 rounded-xl hover:bg-amber-100 transition-colors shadow-sm"
                                      title="Print Medicine Label"
                                    >
                                      <Printer className="w-5 h-5" />
                                    </button>
                                  )}
                                  <button 
                                    type="button"
                                    onClick={() => removeItem(itemValue.id)}
                                    className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Estimated Total</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-900 leading-none">
                              {newRecord.items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0).toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">THB</span>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <button 
                            type="button" 
                            onClick={() => setActiveStep(2)}
                            className="px-8 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                          >
                            Back
                          </button>
                          <button 
                            type="submit"
                            className="px-12 py-5 bg-emerald-500 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-100 flex items-center gap-3 active:scale-95"
                          >
                            <Save className="w-5 h-5" /> Complete Visit
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Right: Medical History Sidebar Column */}
            <div className="w-[400px] bg-white flex flex-col border-l border-slate-100 shadow-[-20px_0_40px_rgba(0,0,0,0.02)]">
              {/* TOP: Patient Info Header */}
              <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <PawPrint className="w-4 h-4" /> Patient Summary
                  </h3>
                </div>

                {selectedPatient ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-[#00b4d8]">
                        <PawPrint className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-800 leading-tight">{selectedPatient.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">HN: {selectedPatient.hn} • {selectedPatient.ownerName}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       <div className="bg-white/80 p-3 rounded-2xl border border-slate-100/50">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Breed</p>
                          <p className="text-[11px] font-bold text-slate-700 truncate">{selectedPatient.breed || '-'}</p>
                       </div>
                       <div className="bg-white/80 p-3 rounded-2xl border border-slate-100/50">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Gender</p>
                          <p className="text-[11px] font-bold text-slate-700">{selectedPatient.gender || '-'}</p>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 border-2 border-dashed border-slate-100 rounded-3xl opacity-50 bg-white/50">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-loose">
                      Search pet name to view<br/>patient dashboard
                    </p>
                  </div>
                )}
              </div>

              {/* MIDDLE: Current Dispensing Section (The Top Red Box in your image) */}
              <div className="flex-none p-8 bg-white border-b border-slate-50">
                <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
                  <Syringe className="w-4 h-4" /> Current Pharmacy Selection
                </h3>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {newRecord.items.length > 0 ? (
                    newRecord.items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-emerald-50/30 border border-emerald-100/30 rounded-2xl group transition-all hover:bg-emerald-50">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-400 shadow-sm">
                            <Activity className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-800">{item.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-black text-slate-900">{(item.price * item.quantity).toLocaleString()}</p>
                          <p className="text-[8px] font-bold text-slate-300">THB</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 bg-slate-50/50 rounded-3xl border border-dashed border-slate-100 flex flex-col items-center justify-center gap-3 text-slate-300">
                      <Droplets className="w-6 h-6 opacity-20" />
                      <span className="text-[10px] font-black uppercase tracking-[0.1em]">No medications added</span>
                    </div>
                  )}
                </div>

                {newRecord.items.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between bg-white">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Running Total</span>
                    <span className="text-lg font-black text-slate-900">
                      {newRecord.items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0).toLocaleString()} <span className="text-[10px] text-slate-300">THB</span>
                    </span>
                  </div>
                )}
              </div>

              {/* BOTTOM: Medical History Timeline (The Bottom Red Box in your image) */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/10">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-10">
                  <History className="w-4 h-4" /> Treatment Timeline
                </h3>

                {selectedPatient ? (
                  pastRecords.length > 0 ? (
                    <div className="relative pb-10">
                      {/* Central Thick Timeline Line with Segments */}
                      <div className="absolute left-10 top-0 bottom-0 w-[4px] bg-slate-100 rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1/4 bg-amber-400" />
                        <div className="absolute top-1/4 left-0 right-0 h-1/4 bg-orange-500" />
                        <div className="absolute top-2/4 left-0 right-0 h-1/4 bg-rose-500" />
                        <div className="absolute top-3/4 left-0 right-0 h-1/4 bg-purple-600" />
                      </div>
                      
                      <div className="space-y-12">
                        {pastRecords.map((rec, idx) => {
                          const visitDate = rec.dateVisit?.toDate ? rec.dateVisit.toDate() : new Date(rec.dateVisit);
                          const colors = [
                            'border-amber-400 text-amber-600 bg-amber-50',
                            'border-orange-500 text-orange-600 bg-orange-50',
                            'border-rose-500 text-rose-600 bg-rose-50',
                            'border-purple-600 text-purple-600 bg-purple-50'
                          ];
                          const colorClass = colors[idx % colors.length];

                          return (
                            <div key={rec.id} className="relative pl-24 group animate-in fade-in slide-in-from-bottom-8 duration-700">
                              {/* Horizontal connector line */}
                              <div className="absolute left-11 top-8 w-12 h-[2px] bg-slate-100" />
                              
                              {/* Milestone Node (Date Circle) */}
                              <div className={cn(
                                "absolute left-0 top-0 w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shadow-xl z-20 bg-white transition-transform group-hover:scale-110 duration-500",
                                colorClass.split(' ')[0], // border color
                              )}>
                                <span className={cn("text-[10px] font-black uppercase tracking-tighter", colorClass.split(' ')[1])}>
                                  {format(visitDate, 'MMM')}
                                </span>
                                <span className="text-2xl font-black text-slate-800 leading-none">
                                  {format(visitDate, 'dd')}
                                </span>
                                <span className="text-[8px] font-bold text-slate-400">
                                  {format(visitDate, 'yyyy')}
                                </span>
                              </div>
                              
                              {/* Content Card */}
                              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                                 <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <div className={cn("w-2 h-2 rounded-full", colorClass.split(' ')[2].replace('bg-', 'bg-').split(' ')[0])} />
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical Note</span>
                                    </div>
                                    <FileText className="w-4 h-4 text-slate-100 group-hover:text-slate-300" />
                                 </div>
                                 
                                 <div className="space-y-3">
                                   {rec.chiefComplaint && (
                                     <div className="bg-amber-50/30 p-4 rounded-2xl border border-amber-100/30">
                                       <span className="text-[8px] font-black text-amber-600 uppercase tracking-[0.2em] block mb-1.5">CC: Chief Complaint</span>
                                       <p className="text-xs font-black text-slate-800 leading-relaxed">{rec.chiefComplaint}</p>
                                     </div>
                                   )}
                                   {rec.treatmentTx && (
                                     <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                       <span className="text-[8px] font-black text-[#00b4d8] uppercase tracking-[0.2em] block mb-1.5">Tx: Treatment</span>
                                       <p className="text-xs font-bold text-slate-700 leading-relaxed">{rec.treatmentTx}</p>
                                     </div>
                                   )}
                                   {rec.recipereRx && (
                                     <div className="bg-rose-50/10 p-4 rounded-2xl border border-rose-100/10">
                                       <span className="text-[8px] font-black text-rose-500 uppercase tracking-[0.2em] block mb-1.5">Rx: Recipere</span>
                                       <p className="text-xs font-medium text-slate-500 leading-relaxed italic">{rec.recipereRx}</p>
                                     </div>
                                   )}
                                   {!rec.treatmentTx && !rec.recipereRx && (
                                     <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                       {rec.finalDiagnosis}
                                     </p>
                                   )}
                                 </div>

                                 {rec.items && rec.items.length > 0 && (
                                   <div className="flex flex-wrap gap-1.5 mt-5 pt-5 border-t border-slate-50">
                                      {rec.items.slice(0, 3).map((it: any, i: number) => (
                                        <span key={i} className="text-[8px] font-black bg-slate-50 text-slate-400 px-3 py-1.5 rounded-xl uppercase tracking-tighter hover:bg-[#00b4d8] hover:text-white transition-colors cursor-default">
                                          {it.name}
                                        </span>
                                      ))}
                                      {rec.items.length > 3 && <span className="text-[8px] font-black text-slate-300 self-center">+ {rec.items.length - 3}</span>}
                                   </div>
                                 )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4 py-20">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                        <History className="w-8 h-8" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-center leading-loose">No clinical history<br/>available yet</p>
                    </div>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Date Picker Modal */}
      <AnimatePresence>
        {isDatePickerOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setViewDate(subMonths(viewDate, 1))}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                  {format(viewDate, 'MMMM yyyy')}
                </h3>
                <button 
                  onClick={() => setViewDate(addMonths(viewDate, 1))}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-[10px] font-black text-slate-300 uppercase py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {eachDayOfInterval({
                  start: startOfWeek(startOfMonth(viewDate)),
                  end: endOfWeek(endOfMonth(viewDate))
                }).map((day, i) => {
                  const isCurrentMonth = isSameMonth(day, viewDate);
                  const isSelected = isSameMonth(day, currentMonth) && isSameYear(day, currentMonth);
                  const isTodayDate = isToday(day);

                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentMonth(day);
                        setIsDatePickerOpen(false);
                      }}
                      className={cn(
                        "aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all",
                        !isCurrentMonth && "text-slate-200",
                        isCurrentMonth && !isSelected && !isTodayDate && "text-slate-600 hover:bg-slate-50",
                        isTodayDate && !isSelected && "text-[#00b4d8] bg-cyan-50",
                        isSelected && "bg-[#00b4d8] text-white shadow-lg shadow-cyan-100"
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setIsDatePickerOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all text-xs"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setIsDatePickerOpen(false);
                  }}
                  className="flex-1 py-3 bg-cyan-50 text-[#00b4d8] rounded-xl font-black uppercase tracking-widest hover:bg-cyan-100 transition-all text-xs"
                >
                  Today
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Confirm Delete</h3>
              <p className="text-slate-500 font-bold text-sm mb-8">
                Are you sure you want to delete this record? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleting(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteRecord(isDeleting)}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
