import React, { useState } from 'react';
import { 
  Plus, 
  X, 
  Minus,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Reward {
  id: string;
  name: string;
  points: number;
  detail: string;
  status: boolean;
}

export default function RewardSetting() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    points: 0,
    detail: ''
  });

  const handleOpenModal = () => {
    setFormData({ name: '', points: 0, detail: '' });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = () => {
    if (!formData.name) return;
    
    const newReward: Reward = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.name,
      points: formData.points,
      detail: formData.detail,
      status: true
    };

    setRewards([...rewards, newReward]);
    handleCloseModal();
  };

  const toggleStatus = (id: string) => {
    setRewards(rewards.map(r => r.id === id ? { ...r, status: !r.status } : r));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">REWARD SETTING</h1>
        <button 
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-6 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
        >
          <Plus className="w-4 h-4" />
          Add Reward
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Reward Name</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Health Point</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Detail</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rewards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <p className="text-lg font-bold text-slate-800">ไม่พบข้อมูลที่ต้องการค้นหา</p>
                  </td>
                </tr>
              ) : (
                rewards.map((reward) => (
                  <tr key={reward.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center font-bold text-slate-700">{reward.name}</td>
                    <td className="px-6 py-4 text-center font-black text-slate-900">{reward.points}</td>
                    <td className="px-6 py-4 text-center text-slate-500">{reward.detail || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <div 
                        onClick={() => toggleStatus(reward.id)}
                        className={cn(
                          "w-10 h-5 rounded-full relative cursor-pointer transition-all mx-auto",
                          reward.status ? "bg-green-500" : "bg-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all",
                          reward.status ? "left-5.5" : "left-1"
                        )} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="p-2 text-[#00b4d8] hover:bg-cyan-50 rounded-lg transition-colors mx-auto">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-50 flex justify-end gap-2">
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 disabled:opacity-20" disabled>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center bg-[#00b4d8] text-white rounded-lg font-bold text-xs">
            1
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 disabled:opacity-20" disabled>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Add Reward Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-50">
                <div className="w-6" /> {/* Spacer */}
                <h2 className="text-xl font-black text-slate-800">Add Reward</h2>
                <button 
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 space-y-6">
                {/* Reward Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Reward Name*</label>
                  <textarea 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none resize-none"
                    rows={3}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Reward Point */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Reward point</label>
                  <div className="flex items-center w-32 border border-slate-200 rounded-lg overflow-hidden">
                    <button 
                      onClick={() => setFormData({ ...formData, points: Math.max(0, formData.points - 1) })}
                      className="p-2 hover:bg-slate-50 text-slate-400 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input 
                      type="number"
                      className="w-full text-center font-bold text-slate-700 outline-none bg-transparent"
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                    />
                    <button 
                      onClick={() => setFormData({ ...formData, points: formData.points + 1 })}
                      className="p-2 hover:bg-slate-50 text-slate-400 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Detail */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Detail</label>
                  <textarea 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none resize-none"
                    rows={3}
                    value={formData.detail}
                    onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-center gap-4 p-6 bg-slate-50/50 border-t border-slate-50">
                <button 
                  onClick={handleCloseModal}
                  className="px-8 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="px-10 py-2.5 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
