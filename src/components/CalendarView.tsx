import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Calendar as CalendarIcon,
  Clock,
  User,
  PawPrint,
  X,
  ExternalLink,
  Stethoscope,
  FileText,
  Trash2,
  Save,
  AlertCircle
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval 
} from 'date-fns';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where,
  handleFirestoreError,
  OperationType,
  updateDoc,
  deleteDoc,
  doc
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import AddAppointmentModal from './AddAppointmentModal';

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  ownerName: string;
  activities: string;
  startTime: any;
  status: string;
  notes?: string;
  doctorName?: string;
}

interface CalendarViewProps {
  setActiveView: (view: any) => void;
}

export default function CalendarView({ setActiveView }: CalendarViewProps) {
  const throwError = useAsyncError();
  const { user, isAuthReady } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [editedTime, setEditedTime] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    const q = query(
      collection(db, 'appointments'),
      where('startTime', '>=', monthStart),
      where('startTime', '<=', monthEnd)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const apps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(apps);
      setLoading(false);
    }, (err) => {
      console.error("CalendarView appointments listener error:", err);
    });

    return () => unsubscribe();
  }, [currentMonth, isAuthReady, user]);

  const handleUpdateAppointment = async () => {
    if (!selectedAppointment) return;
    try {
      const appDate = selectedAppointment.startTime.toDate ? selectedAppointment.startTime.toDate() : new Date(selectedAppointment.startTime);
      const [hours, minutes] = editedTime.split(':').map(Number);
      const newDate = new Date(appDate);
      newDate.setHours(hours, minutes);

      await updateDoc(doc(db, 'appointments', selectedAppointment.id), {
        notes: editedNotes,
        startTime: newDate
      });
      setIsEditing(false);
      setSelectedAppointment({ ...selectedAppointment, notes: editedNotes, startTime: newDate });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'appointments');
    }
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;
    try {
      await deleteDoc(doc(db, 'appointments', selectedAppointment.id));
      setSelectedAppointment(null);
      setIsDeleting(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'appointments');
    }
  };

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setCurrentMonth(new Date())}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Today
            </button>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day, i) => (
          <div key={i} className="text-center text-xs font-black text-slate-400 uppercase tracking-widest py-2">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, "d");
        const cloneDay = day;
        
        const dayAppointments = appointments.filter(app => {
          const appDate = app.startTime.toDate ? app.startTime.toDate() : new Date(app.startTime);
          return isSameDay(appDate, cloneDay);
        });

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[120px] bg-white border border-slate-100 p-2 transition-all flex flex-col gap-1",
              !isSameMonth(day, monthStart) ? "bg-slate-50/50 text-slate-300" : "text-slate-700",
              isSameDay(day, new Date()) && "bg-indigo-50/30"
            )}
            onClick={() => setSelectedDate(cloneDay)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
                isSameDay(day, new Date()) ? "bg-[#00b4d8] text-white" : ""
              )}>
                {formattedDate}
              </span>
              {dayAppointments.length > 0 && (
                <span className="text-[10px] font-black text-[#00b4d8] bg-cyan-50 px-1.5 py-0.5 rounded">
                  {dayAppointments.length} CASE
                </span>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
              {dayAppointments.slice(0, 3).map((app) => (
                <div 
                  key={app.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAppointment(app);
                  }}
                  className="text-[10px] p-1.5 rounded bg-white border border-slate-100 shadow-sm hover:border-[#00b4d8] hover:bg-cyan-50/30 transition-all cursor-pointer truncate"
                >
                  <div className="flex items-center gap-1 font-bold text-slate-700">
                    <PawPrint className="w-2 h-2 text-[#00b4d8]" />
                    {app.patientName}
                  </div>
                  <div className="text-slate-400 truncate">{app.activities}</div>
                </div>
              ))}
              {dayAppointments.length > 3 && (
                <div className="text-[10px] text-center font-bold text-slate-400 py-1">
                  + {dayAppointments.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">{rows}</div>;
  };

  return (
    <div className="h-full flex flex-col">
      {renderHeader()}
      <div className="flex-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        {renderDays()}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {renderCells()}
        </div>
      </div>

      {/* Appointment Details Modal */}
      <AnimatePresence>
        {selectedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAppointment(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Appointment Details</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {format(selectedAppointment.startTime.toDate ? selectedAppointment.startTime.toDate() : new Date(selectedAppointment.startTime), 'EEEE, MMMM do')}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAppointment(null)}
                  className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-8 space-y-8">
                {/* Patient & Owner */}
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-cyan-50 rounded-3xl flex items-center justify-center text-[#00b4d8]">
                    <PawPrint className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-800">{selectedAppointment.patientName}</p>
                    <p className="text-sm font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                      <User className="w-3 h-3" /> Owner: {selectedAppointment.ownerName}
                    </p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity</p>
                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                      <Stethoscope className="w-4 h-4 text-[#00b4d8]" />
                      {selectedAppointment.activities}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</p>
                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                      <Clock className="w-4 h-4 text-[#00b4d8]" />
                      {isEditing ? (
                        <input
                          type="time"
                          value={editedTime}
                          onChange={(e) => setEditedTime(e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4d8]"
                        />
                      ) : (
                        format(selectedAppointment.startTime.toDate ? selectedAppointment.startTime.toDate() : new Date(selectedAppointment.startTime), 'hh:mm a')
                      )}
                    </div>
                  </div>
                  {selectedAppointment.doctorName && (
                    <div className="col-span-2 space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doctor</p>
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <User className="w-4 h-4 text-indigo-500" />
                        {selectedAppointment.doctorName}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes Section */}
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3" /> Notes / Reason for Visit
                    </div>
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00b4d8] min-h-[100px] resize-none"
                      placeholder="Add notes or reason for visit..."
                    />
                  ) : (
                    <p className="text-sm text-slate-600 font-medium leading-relaxed italic">
                      {selectedAppointment.notes || "No additional notes provided."}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  {!isEditing && (
                    <button 
                      onClick={() => {
                        setSelectedAppointment(null);
                        setActiveView('opd');
                      }}
                      className="flex-1 py-4 bg-[#00b4d8] text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-cyan-100 hover:bg-[#0096b1] transition-all flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Go to OPD
                    </button>
                  )}
                  
                  {isEditing ? (
                    <>
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleUpdateAppointment}
                        className="flex-1 py-4 bg-[#00b4d8] text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-cyan-100 hover:bg-[#0096b1] transition-all flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          setEditedNotes(selectedAppointment.notes || '');
                          const appDate = selectedAppointment.startTime.toDate ? selectedAppointment.startTime.toDate() : new Date(selectedAppointment.startTime);
                          setEditedTime(format(appDate, 'HH:mm'));
                          setIsEditing(true);
                        }}
                        className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => setIsDeleting(true)}
                        className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all"
                        title="Delete Appointment"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    </>
                  )}
                </div>
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
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Delete Appointment</h3>
              <p className="text-slate-500 font-bold text-sm mb-8">
                Are you sure you want to delete this appointment? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleting(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAppointment}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AddAppointmentModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}
