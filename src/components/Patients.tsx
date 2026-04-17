import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  LayoutGrid,
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  PawPrint,
  Printer,
  Upload,
  X,
  Camera,
  User,
  Phone,
  Mail,
  Hash,
  MessageSquare,
  Syringe,
  Edit2,
  Trash2,
  Stethoscope
} from 'lucide-react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  handleFirestoreError,
  OperationType,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  getDocsFromServer
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { StatCard, Card } from './ui/Card';
import AddPatientModal from './AddPatientModal';

interface Patient {
  id: string;
  hn: string;
  name: string;
  species: string;
  breed: string;
  gender?: 'Male' | 'Female';
  ownerIds: string[];
  photoURL?: string;
  birthDate?: string;
  medicalHistory?: { id?: string; date: any; diagnosis: string; treatment: string }[];
  vaccineRecords?: { id?: string; name: string; date: any; nextDate: any }[];
  nextVaccineDate?: any;
}

interface Owner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  photoURL?: string;
}

export default function Patients() {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [ownersMap, setOwnersMap] = useState<Record<string, Owner>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'vaccines' | 'appointments' | 'timeline'>('history');
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  const fetchTimeline = async (patientId: string) => {
    setIsTimelineLoading(true);
    try {
      const opdQ = query(collection(db, 'opd_records'), where('patientId', '==', patientId), orderBy('dateVisit', 'desc'));
      const ipdQ = query(collection(db, 'ipd_records'), where('patientId', '==', patientId), orderBy('dateAdmit', 'desc'));
      
      const [opdSnap, ipdSnap] = await Promise.all([getDocs(opdQ), getDocs(ipdQ)]);
      
      const opdItems = opdSnap.docs.map(doc => ({ 
        id: doc.id, 
        type: 'OPD', 
        date: doc.data().dateVisit, 
        title: doc.data().category || 'Treatment',
        description: doc.data().finalDiagnosis,
        items: doc.data().items || []
      }));
      
      const ipdItems = ipdSnap.docs.map(doc => ({ 
        id: doc.id, 
        type: 'IPD', 
        date: doc.data().dateAdmit, 
        title: 'In-Patient Admission',
        description: doc.data().diagnosis,
        status: doc.data().status
      }));

      const combined = [...opdItems, ...ipdItems].sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
        const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
        return dateB - dateA;
      });

      setTimelineData(combined);
    } catch (err) {
      console.warn("Timeline fetch warning (check permissions):", err);
    } finally {
      setIsTimelineLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPatient && activeTab === 'timeline') {
      fetchTimeline(selectedPatient.id);
    }
  }, [selectedPatient, activeTab]);
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editPatientId, setEditPatientId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return 'N/A';
    try {
      const date = new Date(birthDate);
      if (isNaN(date.getTime())) return 'N/A';
      
      const years = differenceInYears(new Date(), date);
      const months = differenceInMonths(new Date(), date) % 12;
      
      if (years > 0) {
        return `${years}y ${months}m`;
      }
      return `${months}m`;
    } catch (e) {
      return 'N/A';
    }
  };

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) {
      if (isAuthReady && !isStaff) setLoading(false);
      return;
    }

    const fetchPatients = async () => {
      try {
        console.log("Patients: Fetching from server...");
        const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
        const snap = await getDocsFromServer(q);
        const pts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
        setPatients(pts);
        setLoading(false);
      } catch (err: any) {
        if (err.message?.includes('permissions')) {
          console.warn("Patients fetch denied (non-critical):", err);
          setLoading(false);
        } else {
          console.error("Patients fetch error:", err);
          handleFirestoreError(err, OperationType.LIST, 'patients');
        }
      }
    };

    const fetchOwners = async () => {
      try {
        console.log("Owners: Fetching from server...");
        const snap = await getDocsFromServer(collection(db, 'owners'));
        const map: Record<string, Owner> = {};
        snap.docs.forEach(doc => {
          map[doc.id] = { id: doc.id, ...doc.data() } as Owner;
        });
        setOwnersMap(map);
      } catch (err) {
        console.warn("Owners fetch warning (non-critical):", err);
        handleFirestoreError(err, OperationType.LIST, 'owners');
      }
    };

    fetchPatients();
    fetchOwners();
  }, [isAuthReady, user, isStaff]);

  const handleUpdatePhoto = async (patientId: string, photoURL: string) => {
    try {
      await updateDoc(doc(db, 'patients', patientId), { photoURL });
      if (selectedPatient?.id === patientId) {
        setSelectedPatient({ ...selectedPatient, photoURL });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `patients/${patientId}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, patientId?: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (patientId) {
          handleUpdatePhoto(patientId, base64String);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const printLabel = (patient: Patient) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Pet Label - ${patient.name}</title>
          <style>
            @page { size: 80mm 50mm; margin: 0; }
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 5mm; 
              display: flex; 
              gap: 5mm;
              align-items: center;
              height: 40mm;
            }
            .photo { 
              width: 30mm; 
              height: 30mm; 
              border-radius: 4mm; 
              object-fit: cover; 
              background: #f1f5f9;
            }
            .info { flex: 1; }
            .hn { font-size: 10pt; font-weight: bold; color: #64748b; margin-bottom: 1mm; }
            .name { font-size: 16pt; font-weight: 900; color: #0f172a; margin-bottom: 2mm; }
            .owner { font-size: 9pt; color: #475569; }
            .species { font-size: 8pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
            .owner-photo {
              width: 10mm;
              height: 10mm;
              border-radius: 2mm;
              object-fit: cover;
              margin-right: 2mm;
              vertical-align: middle;
            }
          </style>
        </head>
        <body>
          <img src="${patient.photoURL || 'https://picsum.photos/seed/pet/200'}" class="photo" />
          <div class="info">
            <div class="hn">HN: ${patient.hn || '-'}</div>
            <div class="name">${patient.name}</div>
            <div class="owner">
              ${patient.ownerIds?.map(id => {
                const owner = ownersMap[id];
                if (!owner) return '';
                return `
                  <div style="margin-bottom: 1mm; display: flex; align-items: center;">
                    ${owner.photoURL ? `<img src="${owner.photoURL}" class="owner-photo" />` : ''}
                    <div>
                      <div style="font-weight: bold;">${owner.name}</div>
                      <div style="font-size: 8pt;">Tel: ${owner.phone}</div>
                    </div>
                  </div>
                `;
              }).join('') || '-'}
            </div>
            <div class="species">${patient.species} ${patient.breed ? `(${patient.breed})` : ''}</div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredPatients = patients.filter(p => {
    const petMatch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (p.hn && p.hn.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const ownerMatch = p.ownerIds?.some(id => {
      const owner = ownersMap[id];
      return owner && (
        owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        owner.phone.includes(searchQuery)
      );
    });

    return petMatch || ownerMatch;
  });

  const handleEditSelected = () => {
    if (selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    setEditPatientId(id);
    setIsAddPatientModalOpen(true);
  };

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    try {
      const deletePromises = Array.from(selectedIds).map(id => deleteDoc(doc(db, 'patients', id)));
      await Promise.all(deletePromises);
      setSelectedIds(new Set());
      setIsDeleteConfirmOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'patients');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPatients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPatients.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  return (
    <div className="space-y-6 relative">
      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto">
              <Trash2 className="w-10 h-10 text-rose-500" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Confirm Delete</h3>
              <p className="text-slate-500 font-medium">
                Are you sure you want to delete {selectedIds.size} selected pet profile(s)? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">PET PROFILE LIST</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={selectedIds.size === 1 ? handleEditSelected : () => setIsAddPatientModalOpen(true)}
            disabled={selectedIds.size > 1}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all text-sm shadow-sm",
              selectedIds.size <= 1 
                ? "bg-[#d4d700] text-slate-800 hover:bg-[#eeef20]" 
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            {selectedIds.size === 1 ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {selectedIds.size === 1 ? 'Edit' : 'New Pet'}
          </button>
          <button 
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all text-sm shadow-sm",
              selectedIds.size > 0 
                ? "bg-red-500 text-white hover:bg-red-600" 
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Overview Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="space-y-6">
          <h2 className="text-lg font-black text-slate-800">Overview</h2>
          <div className="grid grid-cols-5 divide-x divide-slate-100">
            <div className="px-6 first:pl-0">
              <p className="text-xs font-bold text-slate-400">New Pet</p>
              <p className="text-[10px] text-slate-300 italic mb-1">This month</p>
              <p className="text-3xl font-black text-[#00b4d8]">0</p>
            </div>
            <div className="px-6">
              <p className="text-xs font-bold text-slate-400 mb-4">Total Pet</p>
              <p className="text-3xl font-black text-slate-800">{patients.length}</p>
            </div>
            <div className="px-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-slate-400">♂ Male</span>
                <span className="text-[10px] text-slate-300">Pet</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-slate-800">
                  {patients.filter(p => p.gender === 'Male').length}
                </p>
                <span className="text-xs font-bold text-slate-400">
                  {patients.length > 0 ? Math.round((patients.filter(p => p.gender === 'Male').length / patients.length) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="px-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-slate-400">♀ Female</span>
                <span className="text-[10px] text-slate-300">Pet</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-slate-800">
                  {patients.filter(p => p.gender === 'Female').length}
                </p>
                <span className="text-xs font-bold text-slate-400">
                  {patients.length > 0 ? Math.round((patients.filter(p => p.gender === 'Female').length / patients.length) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="px-6 border-r-0">
              <p className="text-xs font-bold text-slate-400 mb-4">Total Owner</p>
              <p className="text-3xl font-black text-slate-800">{Object.keys(ownersMap).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center">
            <input 
              type="text" 
              placeholder="ชื่อสัตว์, เบอร์โทร, ชื่อเจ้าของ, อีเมล์, HN, Microchips, Pet ID, Appoir..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-l-xl border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent outline-none text-sm placeholder:text-slate-300"
            />
            <button className="px-5 py-2.5 bg-slate-50 border border-l-0 border-slate-200 rounded-r-xl hover:bg-slate-100 transition-colors">
              <Search className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          
          <div className="w-48 relative">
            <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 text-sm outline-none appearance-none pr-10">
              <option>Pet Type</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
          </div>

          <div className="w-48 relative">
            <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 text-sm outline-none appearance-none pr-10">
              <option>Breed</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Result Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <h3 className="text-sm font-black text-[#00b4d8] uppercase tracking-wider">{filteredPatients.length} RESULT</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider w-10">
                  <input 
                    type="checkbox" 
                    checked={filteredPatients.length > 0 && selectedIds.size === filteredPatients.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#00b4d8] focus:ring-[#00b4d8]"
                  />
                </th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider w-10">
                  #
                </th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">H.N.</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Pet Name</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Gender</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Breed</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Owner</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Tel./Email</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-8 py-10 text-center text-slate-400">Loading...</td>
                </tr>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient, index) => (
                  <tr 
                    key={`patient-${patient.id}-${index}`} 
                    className={cn(
                      "hover:bg-slate-50/50 transition-colors cursor-pointer group",
                      selectedIds.has(patient.id) && "bg-indigo-50/50"
                    )}
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <td className="px-8 py-4" onClick={(e) => toggleSelect(patient.id, e)}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(patient.id)}
                        onChange={() => {}} // Handled by td onClick
                        className="w-4 h-4 rounded border-slate-300 text-[#00b4d8] focus:ring-[#00b4d8]"
                      />
                    </td>
                    <td className="px-8 py-4 font-bold text-slate-400">{index + 1}</td>
                    <td className="px-8 py-4 font-medium text-slate-600">{patient.hn || '-'}</td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                          {patient.photoURL ? (
                            <img src={patient.photoURL} className="w-full h-full object-cover" alt={patient.name} />
                          ) : (
                            <PawPrint className="w-5 h-5 text-slate-300 m-2.5" />
                          )}
                        </div>
                        <span className="font-bold text-slate-900">{patient.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                        patient.gender === 'Male' ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
                      )}>
                        {patient.gender || 'N/A'}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-slate-600">{patient.species}</td>
                    <td className="px-8 py-4 text-slate-600">{patient.breed || '-'}</td>
                    <td className="px-8 py-4 text-slate-600">
                      {patient.ownerIds?.map(id => ownersMap[id]?.name).join(', ') || '-'}
                    </td>
                    <td className="px-8 py-4 text-slate-600">
                      {patient.ownerIds?.map((id, idx) => (
                        <div key={`owner-${id}-${idx}`}>
                          <div>{ownersMap[id]?.phone}</div>
                          <div className="text-xs text-slate-400">{ownersMap[id]?.email || ''}</div>
                        </div>
                      ))}
                    </td>
                    <td className="px-8 py-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          printLabel(patient);
                        }}
                        className="p-2 hover:bg-[#00b4d8]/10 text-[#00b4d8] rounded-lg transition-colors"
                        title="Print Label"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <p className="text-lg font-bold text-slate-800">ไม่พบข้อมูลที่ต้องการค้นหา</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Placeholder */}
        <div className="p-6 border-t border-slate-50 flex items-center justify-end gap-6">
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-300 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="w-9 h-9 rounded-lg bg-[#00b4d8] text-white font-bold text-sm shadow-lg shadow-cyan-100">1</button>
            <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-300 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Pet Modal */}
      <AddPatientModal 
        isOpen={isAddPatientModalOpen} 
        onClose={() => {
          setIsAddPatientModalOpen(false);
          setEditPatientId(null);
        }} 
        editPatientId={editPatientId}
      />

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex h-[80vh]"
          >
            {/* Sidebar Info */}
            <div className="w-80 bg-slate-50 border-r border-slate-100 p-8 flex flex-col">
              <div className="relative group mb-6">
                <div className="w-full aspect-square rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                  {selectedPatient.photoURL ? (
                    <img src={selectedPatient.photoURL} className="w-full h-full object-cover" alt={selectedPatient.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PawPrint className="w-16 h-16 text-slate-100" />
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 p-2 bg-white rounded-xl shadow-lg border border-slate-100 text-[#00b4d8] hover:scale-110 transition-transform"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, selectedPatient.id)}
                />
              </div>

              <div className="space-y-6 flex-1">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{selectedPatient.name}</h2>
                  <p className="text-xs font-bold text-[#00b4d8] tracking-widest uppercase">
                    {selectedPatient.gender === 'Male' ? '♂' : '♀'} {selectedPatient.species} • {selectedPatient.breed || 'Unknown Breed'}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Hash className="w-4 h-4 text-slate-300" />
                    <span className="text-sm font-medium">HN: {selectedPatient.hn || '-'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-300" />
                    <span className="text-sm font-medium">Age: {calculateAge(selectedPatient.birthDate)}</span>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Owner(s)</p>
                    {selectedPatient.ownerIds?.map((id) => {
                      const owner = ownersMap[id];
                      if (!owner) return null;
                      return (
                        <div key={`owner-detail-${id}`} className="space-y-2 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                              {owner.photoURL ? (
                                <img src={owner.photoURL} className="w-full h-full object-cover" alt={owner.name} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-slate-200" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{owner.name}</p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{owner.phone}</span>
                              </div>
                            </div>
                          </div>
                          {owner.email && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold ml-1">
                              <Mail className="w-2.5 h-2.5" />
                              <span className="truncate">{owner.email}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const firstOwner = ownersMap[selectedPatient.ownerIds?.[0]];
                    if (firstOwner) alert('SMS Sent to ' + firstOwner.phone);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                >
                  <MessageSquare className="w-4 h-4" />
                  SMS
                </button>
                <button 
                  onClick={() => printLabel(selectedPatient)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#00b4d8] text-white rounded-xl font-bold hover:bg-[#0096b4] transition-all shadow-lg shadow-cyan-100"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setActiveTab('history')}
                    className={cn(
                      "text-sm font-bold pb-6 -mb-6 transition-all",
                      activeTab === 'history' ? "text-[#00b4d8] border-b-2 border-[#00b4d8]" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Medical History
                  </button>
                  <button 
                    onClick={() => setActiveTab('vaccines')}
                    className={cn(
                      "text-sm font-bold pb-6 -mb-6 transition-all",
                      activeTab === 'vaccines' ? "text-[#00b4d8] border-b-2 border-[#00b4d8]" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Vaccines
                  </button>
                  <button 
                    onClick={() => setActiveTab('appointments')}
                    className={cn(
                      "text-sm font-bold pb-6 -mb-6 transition-all",
                      activeTab === 'appointments' ? "text-[#00b4d8] border-b-2 border-[#00b4d8]" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Appointments
                  </button>
                  <button 
                    onClick={() => setActiveTab('timeline')}
                    className={cn(
                      "text-sm font-bold pb-6 -mb-6 transition-all",
                      activeTab === 'timeline' ? "text-[#00b4d8] border-b-2 border-[#00b4d8]" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Timeline
                  </button>
                </div>
                <button onClick={() => setSelectedPatient(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                {activeTab === 'timeline' && (
                  <div className="space-y-8 relative before:absolute before:left-[19px] before:top-0 before:bottom-0 before:w-0.5 before:bg-slate-100">
                    {isTimelineLoading ? (
                      <div className="text-center py-20 text-slate-400">Loading timeline...</div>
                    ) : timelineData.length > 0 ? (
                      timelineData.map((item, i) => (
                        <div key={item.id} className="relative pl-12">
                          <div className={cn(
                            "absolute left-0 top-0 w-10 h-10 rounded-xl flex items-center justify-center z-10 shadow-sm border border-white",
                            item.type === 'OPD' ? "bg-blue-50 text-blue-500" : "bg-rose-50 text-rose-500"
                          )}>
                            {item.type === 'OPD' ? <Stethoscope className="w-5 h-5" /> : <PawPrint className="w-5 h-5" />}
                          </div>
                          
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-[#00b4d8] uppercase tracking-widest">
                                {item.type} • {item.date?.toDate ? format(item.date.toDate(), 'dd MMM yyyy HH:mm') : 'N/A'}
                              </span>
                              {item.status && (
                                <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[10px] font-black rounded-full uppercase">
                                  {item.status}
                                </span>
                              )}
                            </div>
                            
                            <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">{item.title}</h4>
                            <p className="text-sm text-slate-500 leading-relaxed">{item.description || 'No description provided.'}</p>
                            
                            {item.items && item.items.length > 0 && (
                              <div className="pt-4 border-t border-slate-50 flex flex-wrap gap-2">
                                {item.items.map((it: any, idx: number) => (
                                  <span key={idx} className="px-2 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-100">
                                    {it.name} x{it.quantity}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                          <Calendar className="w-8 h-8 text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No medical history found</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-4">
                    {selectedPatient.medicalHistory && selectedPatient.medicalHistory.length > 0 ? (
                      selectedPatient.medicalHistory.map((h, i) => (
                        <div key={h.id || `history-${i}`} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              {h.date?.toDate ? format(h.date.toDate(), 'dd MMM yyyy') : format(new Date(h.date), 'dd MMM yyyy')}
                            </span>
                          </div>
                          <p className="font-bold text-slate-800">{h.diagnosis}</p>
                          <p className="text-sm text-slate-500">{h.treatment}</p>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-slate-400 text-sm text-center py-10">No medical history found for this patient.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'vaccines' && (
                  <div className="space-y-4">
                    {selectedPatient.vaccineRecords && selectedPatient.vaccineRecords.length > 0 ? (
                      selectedPatient.vaccineRecords.map((v, i) => (
                        <div key={v.id || `vaccine-${i}`} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                              <Syringe className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{v.name}</p>
                              <p className="text-xs text-slate-400">Given: {v.date?.toDate ? format(v.date.toDate(), 'dd MMM yyyy') : format(new Date(v.date), 'dd MMM yyyy')}</p>
                            </div>
                          </div>
                          {v.nextDate && (
                            <div className="text-right">
                              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Next Appointment</p>
                              <p className="text-sm font-black text-orange-600">
                                {v.nextDate?.toDate ? format(v.nextDate.toDate(), 'dd MMM yyyy') : format(new Date(v.nextDate), 'dd MMM yyyy')}
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-slate-400 text-sm text-center py-10">No vaccine records found.</p>
                      </div>
                    )}

                    {selectedPatient.nextVaccineDate && (
                      <div className="bg-orange-500 p-6 rounded-2xl text-white shadow-lg shadow-orange-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest opacity-80">Upcoming Vaccine Reminder</p>
                          <p className="text-lg font-black">
                            {selectedPatient.nextVaccineDate?.toDate ? format(selectedPatient.nextVaccineDate.toDate(), 'dd MMM yyyy') : format(new Date(selectedPatient.nextVaccineDate), 'dd MMM yyyy')}
                          </p>
                        </div>
                        <Calendar className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'appointments' && (
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-slate-400 text-sm text-center py-10">No upcoming appointments.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
