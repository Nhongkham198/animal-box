import { useState, useEffect } from 'react';
import { 
  db, 
  collection, 
  addDoc, 
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  onSnapshot,
  query,
  where,
  limit,
  getDocs
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Search, 
  MessageSquare, 
  CheckCircle2, 
  Loader2,
  Syringe,
  Stethoscope,
  Scissors,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addHours, startOfToday } from 'date-fns';
import { cn } from '../lib/utils';

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SERVICES = [
  { id: 'vaccine', name: 'Vaccine (วัคซีน)', icon: Syringe, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'checkup', name: 'Check-up (ตรวจ)', icon: Stethoscope, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'surgery', name: 'Surgery (ผ่าตัด)', icon: Scissors, color: 'text-amber-500', bg: 'bg-amber-50' },
];

export default function AddAppointmentModal({ isOpen, onClose }: AddAppointmentModalProps) {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (phone: string | undefined | null) => {
    if (!phone) return '';
    const cleaned = phone.trim().replace(/\D/g, '');
    if (cleaned.length > 0 && !cleaned.startsWith('0')) {
      return '0' + cleaned;
    }
    return phone;
  };

  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    ownerName: '',
    ownerPhone: '',
    serviceType: 'checkup',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    doctorId: '',
    doctorName: '',
    notes: '',
    sendSms: true
  });

  const [patientSearch, setPatientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !isAuthReady || !user || !isStaff) return;

    // Fetch doctors
    const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setDoctors(docs);
      if (docs.length > 0 && !formData.doctorId) {
        setFormData(prev => ({ ...prev, doctorId: docs[0].id, doctorName: docs[0].name }));
      }
    }, (err) => {
      console.warn("AddAppointmentModal doctors listener restricted:", err.message);
    });
    return () => unsub();
  }, [isOpen, isAuthReady, user, isStaff, formData.doctorId]);

  const handleSearchPatient = async (val: string) => {
    setPatientSearch(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search by Pet Name
      const nameQ = query(
        collection(db, 'patients'),
        where('name', '>=', val),
        where('name', '<=', val + '\uf8ff'),
        limit(5)
      );
      
      // Search by HN
      const hnQ = query(
        collection(db, 'patients'),
        where('hn', '>=', val.toUpperCase()),
        where('hn', '<=', val.toUpperCase() + '\uf8ff'),
        limit(5)
      );

      // Search by Owner Name
      const ownerQ = query(
        collection(db, 'owners'),
        where('name', '>=', val),
        where('name', '<=', val + '\uf8ff'),
        limit(5)
      );

      const [nameSnap, hnSnap, ownerSnap] = await Promise.all([
        getDocs(nameQ).catch(e => { console.warn("Appt search - Name fetch warning:", e); return { empty: true, docs: [] }; }), 
        getDocs(hnQ).catch(e => { console.warn("Appt search - HN fetch warning:", e); return { empty: true, docs: [] }; }),
        getDocs(ownerQ).catch(e => { console.warn("Appt search - Owner fetch warning:", e); return { empty: true, docs: [] }; })
      ]);
      
      const resultsMap = new Map();
      nameSnap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      hnSnap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      
      if (!ownerSnap.empty) {
        const ownerIds = ownerSnap.docs.map(doc => doc.id);
        // We need to find patients associated with these owners
        // Note: array-contains-any is limited to 10 items, which is fine here
        const patientsByOwnerQ = query(
          collection(db, 'patients'),
          where('ownerIds', 'array-contains-any', ownerIds),
          limit(10)
        );
        const patientsByOwnerSnap = await getDocs(patientsByOwnerQ);
        patientsByOwnerSnap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }
      
      setSearchResults(Array.from(resultsMap.values()));
    } catch (err) {
      console.warn("Error searching results (check permissions):", err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectPatient = async (patient: any) => {
    // Fetch owner info to get phone number
    let ownerName = 'Unknown';
    let ownerPhone = '';
    
    if (patient.ownerIds && patient.ownerIds.length > 0) {
      try {
        const ownerSnap = await getDocs(query(collection(db, 'owners'), where('__name__', 'in', patient.ownerIds))).catch(e => {
          console.warn("Owner info fetch warning:", e);
          return { empty: true, docs: [] };
        });
        if (!ownerSnap.empty) {
          const ownerData = ownerSnap.docs[0].data();
          ownerName = ownerData.name;
          ownerPhone = ownerData.phone;
        }
      } catch (err) {
        console.error("Error fetching owner:", err);
      }
    }

    setFormData({
      ...formData,
      patientId: patient.id,
      patientName: patient.name,
      ownerName,
      ownerPhone
    });
    setPatientSearch(patient.name);
    setSearchResults([]);
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const startDateTime = new Date(`${formData.date}T${formData.time}`);
      const endDateTime = addHours(startDateTime, 1);

      const appointmentData = {
        patientId: formData.patientId,
        patientName: formData.patientName,
        doctorId: formData.doctorId,
        doctorName: formData.doctorName,
        serviceType: formData.serviceType,
        notes: formData.notes,
        startTime: startDateTime,
        endTime: endDateTime,
        status: formData.sendSms ? 'pending' : 'confirmed',
        depositPaid: false,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'appointments'), appointmentData);

      if (formData.sendSms) {
        // Simulate SMS sending
        const formattedPhone = formatPhoneNumber(formData.ownerPhone);
        console.log(`Sending SMS to ${formattedPhone}: "Dear ${formData.ownerName}, please confirm your appointment for ${formData.patientName} on ${formData.date} at ${formData.time}. Click here: https://clinic.app/confirm"`);
        alert(`SMS confirmation sent to ${formattedPhone}`);
      }

      onClose();
      // Reset
      setStep(1);
      setFormData({
        patientId: '',
        patientName: '',
        ownerName: '',
        ownerPhone: '',
        serviceType: 'checkup',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        doctorId: doctors[0]?.id || '',
        doctorName: doctors[0]?.name || '',
        notes: '',
        sendSms: true
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'appointments');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-6 bg-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">NEW APPOINTMENT</h2>
              <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest">Schedule a visit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8">
          {/* Progress Bar */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-500",
                  step >= i ? "bg-indigo-600" : "bg-slate-100"
                )}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Search Registered Patient (Pet or Owner)</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => handleSearchPatient(e.target.value)}
                      placeholder="Enter pet name, HN, or owner name..."
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none font-bold text-slate-700 transition-all shadow-sm"
                    />
                    {isSearching && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                      </div>
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden max-h-[250px] overflow-y-auto border-t-4 border-t-indigo-500">
                      {searchResults.map((p, idx) => (
                        <button
                          key={`search-res-${p.id}-${idx}`}
                          onClick={() => selectPatient(p)}
                          className="w-full p-4 text-left hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                              <User className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div>
                              <p className="font-black text-slate-800">{p.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HN: {p.hn || '-'} • {p.species} • Owner: {p.ownerName || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                            Select
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Time</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Select Service</label>
                  <div className="grid grid-cols-1 gap-3">
                    {SERVICES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setFormData({ ...formData, serviceType: s.id })}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all",
                          formData.serviceType === s.id 
                            ? "border-indigo-600 bg-indigo-50/50" 
                            : "border-slate-100 hover:border-slate-200 bg-white"
                        )}
                      >
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", s.bg)}>
                          <s.icon className={cn("w-6 h-6", s.color)} />
                        </div>
                        <div className="text-left">
                          <p className="font-black text-slate-800">{s.name}</p>
                          <p className="text-xs font-bold text-slate-400">Standard procedure</p>
                        </div>
                        {formData.serviceType === s.id && (
                          <CheckCircle2 className="w-6 h-6 text-indigo-600 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => setStep(3)}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Next
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Doctor</label>
                  <select
                    value={formData.doctorId}
                    onChange={(e) => {
                      const doc = doctors.find(d => d.id === e.target.value);
                      setFormData({ ...formData, doctorId: e.target.value, doctorName: doc?.name || '' });
                    }}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500"
                  >
                    {doctors.length > 0 ? (
                      doctors.map((d, idx) => (
                        <option key={d.id || `doc-${d.name}-${idx}`} value={d.id}>{d.name}</option>
                      ))
                    ) : (
                      <option value="">No doctors available</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Notes / Reason (หมายเหตุ)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Enter appointment details..."
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <MessageSquare className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">Send SMS Confirmation</p>
                      <p className="text-[10px] font-bold text-indigo-600">Reduces No-shows by 40%</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={formData.sendSms}
                      onChange={(e) => setFormData({ ...formData, sendSms: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setStep(2)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Confirm
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
