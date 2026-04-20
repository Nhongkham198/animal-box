import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  LayoutGrid,
  ChevronDown,
  CheckCircle2,
  Clock,
  ArrowRight,
  XCircle,
  X,
  PawPrint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  doc,
  updateDoc,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { useClinic } from '../contexts/ClinicContext';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import AddPatientModal from './AddPatientModal';
import AddAppointmentModal from './AddAppointmentModal';

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
}

interface AppointmentsProps {
  setActiveView: (view: any) => void;
}

export default function Appointments({ setActiveView }: AppointmentsProps) {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const { setQuotaExceeded } = useClinic();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  const [viewingStatusList, setViewingStatusList] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) return;

    const q = query(collection(db, 'appointments'), orderBy('startTime', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const apps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(apps);
      setLoading(false);
    }, (err) => {
      console.warn("Appointments listener restricted:", err.message);
      if (err.message.includes('quota') || err.message.includes('resource-exhausted')) {
        setQuotaExceeded(true);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isAuthReady, user, isStaff, setQuotaExceeded]);

  const handleUpdateStatus = async (apptId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'appointments', apptId), {
        status: newStatus
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${apptId}`);
    }
  };

  const handleUpdateVisitType = async (apptId: string, visitType: 'OPD' | 'IPD') => {
    try {
      await updateDoc(doc(db, 'appointments', apptId), {
        visitType
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${apptId}`);
    }
  };

  const opdAppointments = appointments.filter(app => app.visitType === 'OPD');
  const ipdAppointments = appointments.filter(app => app.visitType === 'IPD');
  const rescheduledApps = appointments.filter(app => app.status === 'rescheduled');
  const noShowApps = appointments.filter(app => app.status === 'no-show');

  return (
    <div className="space-y-8">
      {/* Top Action Buttons */}
      <div className="flex justify-end gap-2">
        <button 
          onClick={() => setIsAddAppointmentModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Appointment
        </button>
        <button 
          onClick={() => setIsAddPatientModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#d4d700] text-slate-800 rounded-lg font-bold hover:bg-[#eeef20] transition-all text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Pet
        </button>
        <button 
          onClick={() => setActiveView('calendar')}
          className="flex items-center gap-2 px-4 py-2 bg-[#52b788] text-white rounded-lg font-bold hover:bg-[#40916c] transition-all text-sm shadow-sm"
        >
          <Calendar className="w-4 h-4" />
          Calendar
        </button>
        <button 
          onClick={() => setActiveView('patients')}
          className="flex items-center gap-2 px-4 py-2 bg-[#c1a386] text-white rounded-lg font-bold hover:bg-[#b08968] transition-all text-sm shadow-sm"
        >
          <LayoutGrid className="w-4 h-4" />
          Pet Profile
        </button>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-black text-slate-800">Appointment List</h2>
        
        {/* Today List Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800">Today List {appointments.length}</h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewingStatusList('rescheduled')}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 hover:bg-purple-100 transition-all"
              >
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-black uppercase tracking-widest">เลื่อนนัด: {rescheduledApps.length}</span>
              </button>
              <button 
                onClick={() => setViewingStatusList('no-show')}
                className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 hover:bg-rose-100 transition-all"
              >
                <XCircle className="w-3 h-3" />
                <span className="text-[10px] font-black uppercase tracking-widest">ไม่มา: {noShowApps.length}</span>
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">
                    <div className="flex items-center gap-1">Time <ArrowRight className="w-3 h-3 rotate-[-45deg]" /></div>
                  </th>
                  <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">
                    <div className="flex items-center gap-1">Pet <ArrowRight className="w-3 h-3 rotate-[-45deg]" /></div>
                  </th>
                  <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">
                    <div className="flex items-center gap-1">Activities <ArrowRight className="w-3 h-3 rotate-[-45deg]" /></div>
                  </th>
                  <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">
                    <div className="flex items-center gap-1">Visit Type <ArrowRight className="w-3 h-3 rotate-[-45deg]" /></div>
                  </th>
                  <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">
                    <div className="flex items-center gap-1">Status <ArrowRight className="w-3 h-3 rotate-[-45deg]" /></div>
                  </th>
                  <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Mark Done</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length > 0 ? (
                  appointments.map((appt, index) => (
                    <tr key={`appt-${appt.id}-${index}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4 font-bold text-slate-600">
                        {appt.startTime?.toDate ? format(appt.startTime.toDate(), 'hh:mm a') : format(new Date(appt.startTime), 'hh:mm a')}
                      </td>
                      <td className="px-8 py-4">
                        <div className="font-black text-slate-800">{appt.patientName}</div>
                      </td>
                      <td className="px-8 py-4 font-bold text-slate-500">
                        {appt.serviceType}
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleUpdateVisitType(appt.id, 'OPD')}
                            className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                              appt.visitType === 'OPD' 
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            )}
                          >
                            OPD
                          </button>
                          <button 
                            onClick={() => handleUpdateVisitType(appt.id, 'IPD')}
                            className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                              appt.visitType === 'IPD' 
                                ? "bg-amber-500 text-white shadow-md shadow-amber-100" 
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            )}
                          >
                            IPD
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <select
                          value={appt.status}
                          onChange={(e) => handleUpdateStatus(appt.id, e.target.value)}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full outline-none border-none cursor-pointer",
                            appt.status === 'completed' ? "bg-emerald-100 text-emerald-600" :
                            appt.status === 'confirmed' ? "bg-blue-100 text-blue-600" :
                            appt.status === 'pending' ? "bg-amber-100 text-amber-600" :
                            appt.status === 'rescheduled' ? "bg-purple-100 text-purple-600" :
                            appt.status === 'no-show' ? "bg-rose-100 text-rose-600" :
                            "bg-slate-100 text-slate-600"
                          )}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="rescheduled">Rescheduled</option>
                          <option value="no-show">No-Show</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <button 
                          disabled={appt.status === 'completed' || !appt.visitType}
                          onClick={() => handleUpdateStatus(appt.id, 'completed')}
                          title={!appt.visitType ? "กรุณาเลือกประเภท OPD/IPD ก่อนจบงาน" : "คลิกเพื่อจบงาน"}
                          className={cn(
                            "px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 mx-auto",
                            appt.status === 'completed' 
                              ? "bg-emerald-50 text-emerald-400 border border-emerald-100" 
                              : !appt.visitType
                                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"
                                : "bg-emerald-500 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-600"
                          )}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {appt.status === 'completed' ? 'Finished' : 'Finish Work'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative w-80 h-80 opacity-60">
                          <img 
                            src="https://www.vremind.co/img/no-result-01.c13dbe37.png" 
                            alt="No Appointments"
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <p className="text-2xl font-bold text-slate-300">ไม่มีรายการนัดหมายวันนี้</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Cards: OPD & IPD */}
        <div className="grid grid-cols-2 gap-8">
          {/* OPD Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">OPD สัตว์ป่วยนอก</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#d8b4fe] text-slate-700 rounded-lg font-bold hover:bg-[#e9d5ff] transition-all text-sm shadow-sm">
                <Plus className="w-4 h-4" />
                OPD Record
              </button>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <div className="px-6 first:pl-0 flex items-baseline justify-between">
                <p className="text-sm font-bold text-slate-800">Today Case</p>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-800">{opdAppointments.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">case</p>
                </div>
              </div>
              <div className="px-6 border-r-0 flex items-baseline justify-between">
                <p className="text-sm font-bold text-slate-800">Gain Revenue</p>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-800">0.00</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">THB</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-400 uppercase">Date Visit</th>
                    <th className="px-4 py-3 font-bold text-slate-400 uppercase">Pet</th>
                    <th className="px-4 py-3 font-bold text-slate-400 uppercase text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {opdAppointments.length > 0 ? (
                    opdAppointments.map((app, idx) => (
                      <tr key={`opd-row-${app.id}-${idx}`} className="border-b border-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-500">
                          {app.startTime?.toDate ? format(app.startTime.toDate(), 'dd/MM/yyyy') : format(new Date(app.startTime), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-3 font-black text-slate-800">{app.patientName}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-400">0.00</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-40 scale-90">
                          <img 
                            src="https://www.vremind.co/img/medical-record-no-result.2b3dd25c.png" 
                            alt="Empty"
                            className="w-32 h-32 object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <p className="text-xl font-bold text-slate-400">ไม่มีรายการตรวจรักษาในวันนี้</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* IPD Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-8">
            <h3 className="text-xl font-black text-slate-800">IPD สัตว์ป่วยใน</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-500">Today Gain Revenue</p>
                <div className="text-right">
                  <p className="text-xl font-black text-slate-800">0.00</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">THB</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-500">Active Case</p>
                <div className="text-right">
                  <p className="text-xl font-black text-slate-800">{ipdAppointments.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">case</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-500">Overdue Case</p>
                <div className="text-right">
                  <p className="text-xl font-black text-slate-800">0</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">case</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-400 uppercase">Date Admit</th>
                    <th className="px-4 py-3 font-bold text-slate-400 uppercase">Pet</th>
                    <th className="px-4 py-3 font-bold text-slate-400 uppercase text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {ipdAppointments.length > 0 ? (
                    ipdAppointments.map((app, idx) => (
                      <tr key={`ipd-row-${app.id}-${idx}`} className="border-b border-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-500">
                          {app.startTime?.toDate ? format(app.startTime.toDate(), 'dd/MM/yyyy') : format(new Date(app.startTime), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-3 font-black text-slate-800">{app.patientName}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-400">0.00</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-40 scale-90">
                          <img 
                            src="https://www.vremind.co/img/medical-record-no-result.2b3dd25c.png" 
                            alt="Empty"
                            className="w-32 h-32 object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <p className="text-xl font-bold text-slate-400">ไม่มีรายการตรวจรักษาในวันนี้</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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

      {/* Status List Modal */}
      <AnimatePresence>
        {viewingStatusList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingStatusList(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    viewingStatusList === 'rescheduled' ? "bg-purple-100 text-purple-600" : "bg-rose-100 text-rose-600"
                  )}>
                    {viewingStatusList === 'rescheduled' ? <Clock className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                      {viewingStatusList === 'rescheduled' ? 'เลื่อนนัด' : 'ไม่มาตามนัด'}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      รายชื่อสัตว์เลี้ยงทั้งหมด
                    </p>
                  </div>
                </div>
                <button onClick={() => setViewingStatusList(null)} className="p-2 hover:bg-white rounded-xl text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
                {(viewingStatusList === 'rescheduled' ? rescheduledApps : noShowApps).map((app, idx) => (
                  <div key={`status-list-${app.id}-${idx}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                        <PawPrint className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{app.patientName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Owner: {app.ownerName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-500">{app.activities}</p>
                      <p className="text-[10px] text-slate-400">{app.startTime?.toDate ? format(app.startTime.toDate(), 'hh:mm a') : 'N/A'}</p>
                    </div>
                  </div>
                ))}
                {(viewingStatusList === 'rescheduled' ? rescheduledApps : noShowApps).length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-bold">
                    ไม่มีรายชื่อในกลุ่มนี้
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50">
                <button 
                  onClick={() => setViewingStatusList(null)}
                  className="w-full py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
