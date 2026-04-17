import React, { useState, useEffect, useRef } from 'react';
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
  getDocs
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
  const [patients, setPatients] = useState<{id: string, name: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Record State
  const [newRecord, setNewRecord] = useState<{
    patientId: string;
    petName: string;
    category: 'Treatment' | 'Grooming' | 'Vaccine' | 'Other';
    finalDiagnosis: string;
    status: string;
    attachments: string[];
    items: OPDItem[];
  }>({
    patientId: '',
    petName: '',
    category: 'Treatment',
    finalDiagnosis: '',
    status: 'Completed',
    attachments: [],
    items: []
  });

  const [newItem, setNewItem] = useState({
    name: '',
    quantity: 1,
    price: 0,
    category: 'Medicine'
  });

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

    // Fetch patients for selection
    getDocs(collection(db, 'patients')).then(snap => {
      setPatients(snap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    }).catch(err => {
      console.warn("Error fetching patients for OPD selection (non-critical):", err);
      handleFirestoreError(err, OperationType.LIST, 'patients');
    });

    return () => {
      unsubscribe();
      unsubscribeQueue();
    };
  }, [isAuthReady, user, isStaff]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalRevenue = newRecord.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    try {
      if (editingRecordId) {
        // Update existing record
        await updateDoc(doc(db, 'opd_records', editingRecordId), {
          ...newRecord,
          revenue: totalRevenue,
          status: 'Completed', // Mark as completed when saved from modal
          billingStatus: totalRevenue > 0 ? 'unpaid' : 'none',
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new record
        await addDoc(collection(db, 'opd_records'), {
          ...newRecord,
          finalDiagnosis: newRecord.finalDiagnosis || '',
          petName: newRecord.petName || 'Unknown Pet',
          patientId: newRecord.patientId || '',
          revenue: totalRevenue,
          billingStatus: totalRevenue > 0 ? 'unpaid' : 'none',
          dateVisit: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
      setIsAddingRecord(false);
      setEditingRecordId(null);
      setNewRecord({
        patientId: '',
        petName: '',
        category: 'Treatment',
        finalDiagnosis: '',
        status: 'Completed',
        attachments: [],
        items: []
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'opd_records');
    }
  };

  const handleStartRecordFromQueue = async (item: OPDQueueItem) => {
    try {
      // 1. Create OPD Record with "In Progress" status
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
        dateVisit: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // 2. Update Appointment Status to 'completed' (so it leaves the queue)
      await updateDoc(doc(db, 'appointments', item.id), {
        status: 'completed'
      });

      // 3. Open modal to edit this record
      setEditingRecordId(opdRef.id);
      setNewRecord({
        patientId: item.patientId,
        petName: item.patientName,
        category: 'Treatment',
        finalDiagnosis: item.activities || '',
        status: 'In Progress',
        attachments: [],
        items: []
      });
      setIsAddingRecord(true);
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
      items: record.items || []
    });
    setIsAddingRecord(true);
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
    setNewItem({ name: '', quantity: 1, price: 0, category: 'Medicine' });
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
            {/* Left: Form */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                  {editingRecordId ? 'Edit OPD Record' : 'New OPD Record'}
                </h2>
                <button onClick={() => { setIsAddingRecord(false); setEditingRecordId(null); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleAddRecord} className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Patient *</label>
                    <select 
                      required
                      value={newRecord.patientId}
                      onChange={(e) => {
                        const p = patients.find(p => p.id === e.target.value);
                        setNewRecord({ ...newRecord, patientId: e.target.value, petName: p?.name || '' });
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm"
                    >
                      <option value="">Select Pet</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category *</label>
                    <div className="flex gap-2">
                      {['Treatment', 'Grooming', 'Vaccine', 'Other'].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewRecord({ ...newRecord, category: cat as any })}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-bold transition-all border",
                            newRecord.category === cat 
                              ? "bg-[#00b4d8] text-white border-[#00b4d8] shadow-lg shadow-cyan-100" 
                              : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Diagnosis / Clinical Notes</label>
                    <textarea 
                      rows={3}
                      value={newRecord.finalDiagnosis}
                      onChange={(e) => setNewRecord({ ...newRecord, finalDiagnosis: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm resize-none"
                      placeholder="Enter diagnosis, symptoms, or treatment notes..."
                    />
                  </div>
                </div>

                {/* Blood Test / Attachments */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blood Test / Attachments</label>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] font-black text-[#00b4d8] uppercase tracking-widest hover:underline"
                    >
                      + Upload File
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileUpload}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {newRecord.attachments.map((url, i) => (
                      <div key={`attachment-${i}`} className="relative group aspect-square rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                        <img src={url} className="w-full h-full object-cover" alt="Attachment" />
                        <button 
                          type="button"
                          onClick={() => setNewRecord(prev => ({ ...prev, attachments: prev.attachments.filter((_, idx) => idx !== i) }))}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {newRecord.attachments.length === 0 && (
                      <div className="col-span-4 py-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-300">
                        <Upload className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No files uploaded</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Billing Items */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Billing Items</label>
                  <div className="bg-slate-50 rounded-2xl p-6 space-y-4 border border-slate-100">
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-5">
                        <input 
                          type="text" 
                          placeholder="Item Name (Medicine, Service...)"
                          value={newItem.name}
                          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input 
                          type="number" 
                          placeholder="Qty"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-center"
                        />
                      </div>
                      <div className="col-span-3">
                        <input 
                          type="number" 
                          placeholder="Price"
                          value={newItem.price}
                          onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none text-right"
                        />
                      </div>
                      <div className="col-span-2">
                        <button 
                          type="button"
                          onClick={addItem}
                          className="w-full h-full bg-[#00b4d8] text-white rounded-xl font-bold text-sm hover:bg-[#0096b4] transition-all"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {newRecord.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-700">{item.name}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{item.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-900">{(item.price * item.quantity).toLocaleString()} THB</p>
                              <p className="text-[10px] text-slate-400 font-bold">{item.quantity} x {item.price.toLocaleString()}</p>
                            </div>
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
                                        body { font-family: sans-serif; padding: 10px; }
                                        .label { border: 1px solid #000; height: 100%; display: flex; flex-direction: column; }
                                        .header { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px; font-size: 14px; }
                                        .content { font-size: 12px; flex: 1; }
                                        .footer { font-size: 10px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
                                      </style>
                                    </head>
                                    <body>
                                      <div class="label">
                                        <div class="header">Medication Label</div>
                                        <div class="content">
                                          <strong>Pet:</strong> ${newRecord.petName}<br/>
                                          <strong>Med:</strong> ${item.name}<br/>
                                          <strong>Qty:</strong> ${item.quantity}<br/>
                                          <strong>Date:</strong> ${format(new Date(), 'dd/MM/yyyy')}
                                        </div>
                                        <div class="footer">Animal Box Clinic</div>
                                      </div>
                                      <script>window.onload = () => { window.print(); window.close(); };</script>
                                    </body>
                                  </html>
                                `);
                                printWindow.document.close();
                              }}
                              className="p-2 text-[#00b4d8] hover:bg-cyan-50 rounded-lg transition-colors"
                              title="Print Med Label"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="p-2 text-red-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </form>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Revenue</p>
                  <p className="text-3xl font-black text-slate-900">
                    {newRecord.items.reduce((sum, i) => sum + (i.price * i.quantity), 0).toLocaleString()} <span className="text-sm font-bold text-slate-400">THB</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => { setIsAddingRecord(false); setEditingRecordId(null); }}
                    className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  {editingRecordId && (
                    <button 
                      type="button"
                      onClick={() => setIsDeleting(editingRecordId)}
                      className="px-6 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                  <button 
                    onClick={handleAddRecord}
                    className="px-10 py-3 bg-[#00b4d8] text-white rounded-xl font-bold hover:bg-[#0096b4] transition-all shadow-lg shadow-cyan-100 flex items-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {editingRecordId ? 'Update Record' : 'Save Record'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Summary / Preview */}
            <div className="w-80 bg-slate-900 p-8 text-white flex flex-col">
              <div className="flex-1 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Patient Summary</h3>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                      <PawPrint className="w-8 h-8 text-white/20" />
                    </div>
                    <div>
                      <p className="text-lg font-black">{newRecord.petName || 'Unknown Pet'}</p>
                      <p className="text-xs text-white/40 font-bold uppercase tracking-widest">{newRecord.category}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Billing Breakdown</h3>
                  <div className="space-y-3">
                    {['Medicine', 'Service', 'Vaccine', 'Other'].map(cat => {
                      const catTotal = newRecord.items.filter(i => i.category === cat).reduce((sum, i) => sum + (i.price * i.quantity), 0);
                      if (catTotal === 0) return null;
                      return (
                        <div key={cat} className="flex items-center justify-between">
                          <span className="text-sm text-white/60">{cat}</span>
                          <span className="text-sm font-bold">{catTotal.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10">
                <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#00b4d8] flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Final Amount</p>
                    <p className="text-xl font-black">{newRecord.items.reduce((sum, i) => sum + (i.price * i.quantity), 0).toLocaleString()} THB</p>
                  </div>
                </div>
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
