import { useState, useEffect } from 'react';
import { 
  db, 
  collection, 
  doc,
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  onSnapshot,
  query,
  where
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  MessageSquare, 
  CheckCircle2, 
  Loader2,
  Syringe,
  Stethoscope,
  Scissors,
  Droplets,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addHours } from 'date-fns';
import { cn } from '../lib/utils';

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  ownerName: string;
  activities: string;
  serviceType?: string;
  visitType?: 'OPD' | 'IPD';
  startTime: any;
  status: string;
  notes?: string;
  doctorId?: string;
  doctorName?: string;
}

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
}

const SERVICES = [
  { id: 'vaccine', name: 'Vaccine (วัคซีน)', icon: Syringe, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'checkup', name: 'Check-up (ตรวจ)', icon: Stethoscope, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'surgery', name: 'Surgery (ผ่าตัด)', icon: Scissors, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'bathing', name: 'Bathing (อาบน้ำ)', icon: Droplets, color: 'text-sky-500', bg: 'bg-sky-50' },
];

export default function EditAppointmentModal({ isOpen, onClose, appointment }: EditAppointmentModalProps) {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    serviceType: 'checkup',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    doctorId: '',
    doctorName: '',
    notes: '',
    status: 'pending'
  });

  // Load appointment data when modal opens
  useEffect(() => {
    if (!appointment) return;

    let apptDate = new Date();
    if (appointment.startTime) {
      if (appointment.startTime.toDate) {
        apptDate = appointment.startTime.toDate();
      } else {
        apptDate = new Date(appointment.startTime);
      }
    }

    setFormData({
      serviceType: appointment.serviceType || 'checkup',
      date: format(apptDate, 'yyyy-MM-dd'),
      time: format(apptDate, 'HH:mm'),
      doctorId: appointment.doctorId || '',
      doctorName: appointment.doctorName || '',
      notes: appointment.notes || '',
      status: appointment.status || 'pending'
    });
    setShowDeleteConfirm(false);
  }, [appointment, isOpen]);

  // Fetch doctors list
  useEffect(() => {
    if (!isOpen || !isAuthReady || !user || !isStaff) return;

    const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setDoctors(docs);
    }, (err) => {
      console.warn("EditAppointmentModal doctors listener restricted:", err.message);
    });
    return () => unsub();
  }, [isOpen, isAuthReady, user, isStaff]);

  const handleSubmit = async () => {
    if (!appointment) return;
    setLoading(true);
    try {
      const startDateTime = new Date(`${formData.date}T${formData.time}`);
      const endDateTime = addHours(startDateTime, 1);

      const updateData = {
        serviceType: formData.serviceType,
        activities: SERVICES.find(s => s.id === formData.serviceType)?.name || formData.serviceType,
        notes: formData.notes,
        startTime: startDateTime,
        endTime: endDateTime,
        doctorId: formData.doctorId,
        doctorName: formData.doctorName,
        status: formData.status,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'appointments', appointment.id), updateData);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${appointment.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'appointments', appointment.id));
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `appointments/${appointment.id}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        {!showDeleteConfirm ? (
          <motion.div
            key="edit-form"
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
                  <h2 className="text-xl font-black tracking-tight">EDIT APPOINTMENT</h2>
                  <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest">
                    Patient: {appointment.patientName}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Service selection */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Service Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {SERVICES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, serviceType: s.id })}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                        formData.serviceType === s.id 
                          ? "border-indigo-600 bg-indigo-50/50" 
                          : "border-slate-100 hover:border-slate-200 bg-white"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                        <s.icon className={cn("w-4 h-4", s.color)} />
                      </div>
                      <span className="font-bold text-xs text-slate-800 truncate">{s.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500 text-sm"
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
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Doctor & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Doctor</label>
                  <select
                    value={formData.doctorId}
                    onChange={(e) => {
                      const docItem = doctors.find(d => d.id === e.target.value);
                      setFormData({ ...formData, doctorId: e.target.value, doctorName: docItem?.name || '' });
                    }}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500 text-sm"
                  >
                    <option value="">Select Doctor</option>
                    {doctors.map((d, idx) => (
                      <option key={d.id || `doc-${d.name}-${idx}`} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500 text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="rescheduled">Rescheduled</option>
                    <option value="no-show">No-Show</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Notes / Reason</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Enter appointment notes..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500 resize-none text-sm"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button 
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-3 text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition-all text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>

              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-bold hover:bg-slate-50 transition-all text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all text-sm shadow-lg shadow-indigo-100 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="delete-confirm"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center space-y-6"
          >
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800">ยืนยันการลบนัดหมาย?</h3>
              <p className="text-slate-500 text-sm">
                คุณแน่ใจหรือไม่ที่จะลบการนัดหมายของ <strong className="text-slate-800">{appointment.patientName}</strong>? การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all text-sm"
              >
                ย้อนกลับ
              </button>
              <button 
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-700 transition-all text-sm shadow-lg shadow-rose-100 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                ลบนัดหมาย
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
