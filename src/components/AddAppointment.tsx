import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown
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

interface Patient {
  id: string;
  name: string;
  species: string;
  breed: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  hn?: string;
}

export default function AddAppointment() {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) {
      if (isAuthReady && !isStaff) setLoading(false);
      return;
    }

    const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const pts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(pts);
      setLoading(false);
    }, (err) => {
      console.warn("Patients listener (AddAppt) restricted:", err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isAuthReady, user, isStaff]);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.ownerPhone.includes(searchQuery) ||
    (p.hn && p.hn.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Top Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#00b4d8] font-medium cursor-pointer hover:underline">Home</span>
          <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
          <span className="text-slate-400">New Appointment</span>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#d4d700] text-slate-800 rounded-lg font-bold hover:bg-[#eeef20] transition-all text-sm shadow-sm">
          <Plus className="w-4 h-4" />
          New Pet
        </button>
      </div>

      {/* Page Title */}
      <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
        NEW APPOINTMENT 1/2: SELECT PET
      </h1>

      {/* Search & Result Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 space-y-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-xl font-black text-slate-800 text-center">
            ค้นหาเจ้าของ หรือ สัตว์เลี้ยงจากใน minimal
          </h2>
          
          <div className="flex items-center">
            <input 
              type="text" 
              placeholder="ค้นหาด้วยชื่อสัตว์, เบอร์โทร, ชื่อเจ้าของ, อีเมล์, HN, Microchips, Pet ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-6 py-4 rounded-l-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent outline-none text-sm placeholder:text-slate-300"
            />
            <button className="px-8 py-4 bg-slate-50 border border-l-0 border-slate-200 rounded-r-xl hover:bg-slate-100 transition-colors">
              <Search className="w-6 h-6 text-slate-300" />
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">H.N.</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Pet Name</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Owner</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Tel./Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-400">Loading...</td>
                </tr>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group">
                    <td className="px-8 py-4 font-medium text-slate-600">{patient.hn || '-'}</td>
                    <td className="px-8 py-4 font-bold text-slate-900 group-hover:text-[#00b4d8]">{patient.name}</td>
                    <td className="px-8 py-4 text-slate-600">{patient.species}</td>
                    <td className="px-8 py-4 text-slate-600">{patient.ownerName}</td>
                    <td className="px-8 py-4 text-slate-600">
                      <div>{patient.ownerPhone}</div>
                      <div className="text-xs text-slate-400">{patient.ownerEmail || ''}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <p className="text-lg font-bold text-slate-800">ไม่พบข้อมูลที่ต้องการค้นหา</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2">
          <button className="p-2 rounded-lg bg-slate-50 text-slate-300 cursor-not-allowed">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 rounded-lg bg-[#00b4d8] text-white font-bold text-sm shadow-lg shadow-cyan-100">1</button>
          <button className="p-2 rounded-lg bg-slate-50 text-slate-300 cursor-not-allowed">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
