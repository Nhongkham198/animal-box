import React, { useState } from 'react';
import { Plus, X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface PaymentMethod {
  id: string;
  type: string;
  bank?: string;
  bankId?: string;
  accountName?: string;
  fee?: string;
}

const initialMethods: PaymentMethod[] = [
  { id: '1', type: 'เงินสด (Cash)' }
];

const PAYMENT_TYPES = [
  'เงินสด (Cash)',
  'โอนเงิน (Bank Transfer)',
  'Credit/Debit card',
  'Online/Mobile Payment',
  'อื่นๆ (Other)'
];

export default function PaymentMethodSetting() {
  const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [formData, setFormData] = useState({
    type: 'เงินสด (Cash)',
    accountName: ''
  });

  const handleSave = () => {
    const newMethod: PaymentMethod = {
      id: Math.random().toString(36).substr(2, 9),
      type: formData.type,
      accountName: formData.accountName
    };
    setMethods([...methods, newMethod]);
    setIsModalOpen(false);
    setFormData({ type: 'เงินสด (Cash)', accountName: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">PAYMENT METHOD SETTING</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
        >
          <Plus className="w-4 h-4" />
          Create Payment Method
        </button>
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center w-20">No.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">Payment Type</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Bank</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Bank ID</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Account Name</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {methods.map((method, index) => (
                <tr key={method.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-center font-medium text-slate-500">{index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{method.type}</div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-700 font-medium">{method.bank || ''}</td>
                  <td className="px-6 py-4 text-center text-slate-700 font-medium">{method.bankId || ''}</td>
                  <td className="px-6 py-4 text-center text-slate-700 font-medium">{method.accountName || ''}</td>
                  <td className="px-6 py-4 text-center text-slate-700 font-medium">{method.fee || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-50 flex justify-end">
          <div className="flex items-center gap-2">
            <button className="p-1 rounded hover:bg-slate-100 text-slate-300">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="w-8 h-8 rounded bg-[#00b4d8] text-white font-bold text-sm">1</button>
            <button className="p-1 rounded hover:bg-slate-100 text-slate-300">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-8 py-6 flex items-center justify-between border-b border-slate-100">
                <div className="flex-1" />
                <h2 className="text-2xl font-black text-[#00b4d8] text-center flex-1">Create Payment Method</h2>
                <div className="flex-1 flex justify-end">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-10 space-y-8">
                {/* Payment Type Dropdown */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">
                    ช่องทางชำระ (Payment Type) <span className="text-red-500">ช่องทางที่รับเป็นเงินสด ไม่ต้องใส่ข้อมูลธนาคาร</span>
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                      className={cn(
                        "w-full px-5 py-4 rounded-xl border flex items-center justify-between transition-all font-bold text-slate-600",
                        showTypeDropdown ? "border-[#00b4d8] ring-4 ring-cyan-50" : "border-slate-200 bg-white"
                      )}
                    >
                      <span>{formData.type}</span>
                      <ChevronDown className={cn("w-5 h-5 text-slate-300 transition-transform", showTypeDropdown && "rotate-180")} />
                    </button>

                    <AnimatePresence>
                      {showTypeDropdown && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowTypeDropdown(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 overflow-hidden"
                          >
                            {PAYMENT_TYPES.map((type) => (
                              <button
                                key={type}
                                onClick={() => {
                                  setFormData({ ...formData, type });
                                  setShowTypeDropdown(false);
                                }}
                                className={cn(
                                  "w-full px-6 py-4 text-left font-bold transition-colors",
                                  formData.type === type ? "text-[#00b4d8] bg-cyan-50" : "text-slate-500 hover:bg-slate-50"
                                )}
                              >
                                {type}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Account Name Input */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">
                    ชื่อบัญชี (Account Name)
                  </label>
                  <input
                    type="text"
                    placeholder="name"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    className="w-full px-5 py-4 rounded-xl border border-slate-200 bg-white focus:ring-4 focus:ring-cyan-50 focus:border-[#00b4d8] outline-none font-bold text-slate-600 placeholder:text-slate-300 transition-all"
                  />
                </div>

                <p className="text-sm font-bold text-slate-500 leading-relaxed">
                  ใส่ช่องทางชำระเงิน ถ้าช่องนั้นมี ธนาคาร ชื่อบัญชี เลขที่บัญชี หรือ เลขที่อ้างอิงช่องทางอื่นสามารถใส่ข้อมูลลงมาเพื่อความถูกต้องได้
                </p>
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-8 bg-slate-50/50 flex gap-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 px-6 rounded-xl border border-slate-200 bg-white text-slate-500 font-bold hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-4 px-6 rounded-xl bg-[#00b4d8] text-white font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
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
