import React, { useState, useEffect } from 'react';
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
  LogOut
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
    status: 'Admitted' as const
  });

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
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const q = query(
        collection(db, 'patients'),
        where('name', '>=', val),
        where('name', '<=', val + '\uf8ff'),
        limit(5)
      );
      const snap = await getDocs(q);
      setSearchResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
        status: 'Admitted'
      });
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
                    <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 font-black text-xs">
                      {record.cageNumber}
                    </div>
                    <div>
                      <p className="font-black text-slate-800">{record.petName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <User className="w-3 h-3" /> {record.ownerName}
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
                  <p className="text-sm font-bold text-slate-600 line-clamp-1 max-w-[200px]">{record.diagnosis}</p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
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

              <form onSubmit={handleAddRecord} className="p-8 space-y-6">
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
                      <div className="absolute z-10 w-full mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden max-h-[200px] overflow-y-auto">
                        {searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectPatient(p)}
                            className="w-full p-4 text-left hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                          >
                            <div>
                              <p className="font-black text-slate-800">{p.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HN: {p.hn || '-'} • {p.ownerName}</p>
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

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Diagnosis</label>
                  <textarea
                    required
                    rows={2}
                    value={newRecord.diagnosis}
                    onChange={(e) => setNewRecord({...newRecord, diagnosis: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Treatment Plan</label>
                  <textarea
                    required
                    rows={3}
                    value={newRecord.treatmentPlan}
                    onChange={(e) => setNewRecord({...newRecord, treatmentPlan: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700 resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
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
