import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check,
  ChevronDown,
  Cpu
} from 'lucide-react';
import { 
  db, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  Timestamp,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Microchip {
  id: string;
  number: string;
  petName: string;
  ownerName: string;
  createdAt: any;
}

export default function SearchMicrochip() {
  const throwError = useAsyncError();
  const { user, isAuthReady } = useAuth();
  const [microchips, setMicrochips] = useState<Microchip[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    number: '',
    petName: '',
    ownerName: ''
  });

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'microchips'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Microchip));
      setMicrochips(data);
    }, (err) => {
      console.error("SearchMicrochip listener error:", err);
    });
    return () => unsubscribe();
  }, [isAuthReady, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'microchips', editingId), {
          ...formData
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `microchips/${editingId}`);
        });
      } else {
        await addDoc(collection(db, 'microchips'), {
          ...formData,
          createdAt: Timestamp.now()
        }).catch(err => {
          handleFirestoreError(err, OperationType.CREATE, 'microchips');
        });
      }
      closeModal();
    } catch (error) {
      throwError(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this microchip?')) return;
    try {
      await deleteDoc(doc(db, 'microchips', id)).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `microchips/${id}`);
      });
    } catch (error) {
      throwError(error);
    }
  };

  const openModal = (chip?: Microchip) => {
    if (chip) {
      setEditingId(chip.id);
      setFormData({
        number: chip.number,
        petName: chip.petName,
        ownerName: chip.ownerName
      });
    } else {
      setEditingId(null);
      setFormData({ number: '', petName: '', ownerName: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ number: '', petName: '', ownerName: '' });
  };

  const filteredChips = microchips.filter(chip => 
    chip.number.toLowerCase() === searchQuery.toLowerCase() || searchQuery === ''
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#00b4d8] font-medium cursor-pointer hover:underline">Home</span>
          <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
          <span className="text-slate-400">Search Microchip</span>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Microchip
        </button>
      </div>

      {/* Page Title */}
      <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
        SEARCH MICROCHIP
      </h1>

      {/* Search Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-xl font-black text-slate-800 text-center">
            ค้นหาสัตว์จาก Microchip
          </h2>
          
          <div className="flex items-center">
            <input 
              type="text" 
              placeholder="ค้นหาจาก Microchip"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-6 py-4 rounded-l-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent outline-none text-sm placeholder:text-slate-300"
            />
            <button className="px-8 py-4 bg-slate-50 border border-l-0 border-slate-200 rounded-r-xl hover:bg-slate-100 transition-colors">
              <Search className="w-6 h-6 text-slate-300" />
            </button>
          </div>
          
          <p className="text-center text-[#00b4d8] text-sm font-bold">
            * พิมพ์ให้ถูกต้องทุกตัวอักษร ถึงจะแสดงผลการค้นหา
          </p>
        </div>
      </div>

      {/* Results Table */}
      {searchQuery !== '' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="text-sm font-black text-[#00b4d8] uppercase tracking-wider">
              {filteredChips.length} RESULT
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Microchip No.</th>
                  <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Pet Name</th>
                  <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Owner</th>
                  <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredChips.length > 0 ? (
                  filteredChips.map((chip) => (
                    <tr key={chip.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4 font-bold text-slate-900">{chip.number}</td>
                      <td className="px-8 py-4 text-slate-600">{chip.petName}</td>
                      <td className="px-8 py-4 text-slate-600">{chip.ownerName}</td>
                      <td className="px-8 py-4 text-right space-x-2">
                        <button 
                          onClick={() => openModal(chip)}
                          className="p-2 hover:bg-cyan-50 text-slate-400 hover:text-[#00b4d8] rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(chip.id)}
                          className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <p className="text-lg font-bold text-slate-800">ไม่พบข้อมูลที่ต้องการค้นหา</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800">
                  {editingId ? 'Edit Microchip' : 'Add New Microchip'}
                </h2>
                <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Microchip Number</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                    value={formData.number}
                    onChange={e => setFormData({...formData, number: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pet Name</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                    value={formData.petName}
                    onChange={e => setFormData({...formData, petName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Owner Name</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                    value={formData.ownerName}
                    onChange={e => setFormData({...formData, ownerName: e.target.value})}
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-[#00b4d8] text-white rounded-xl font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
                >
                  {editingId ? 'Update Microchip' : 'Save Microchip'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
