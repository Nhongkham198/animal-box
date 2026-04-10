import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ArrowLeft,
  ChevronDown,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Banknote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Contact {
  id: string;
  type: 'บุคคลธรรมดา' | 'บริษัทจำกัด';
  name: string;
  taxId: string;
  province: string;
}

export default function ContactSetting() {
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [formData, setFormData] = useState({
    type: 'บุคคลธรรมดา' as 'บุคคลธรรมดา' | 'บริษัทจำกัด',
    taxId: '',
    prefix: '',
    firstName: '',
    lastName: '',
    address: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
    country: '',
    phone: '',
    email: '',
    bank: '',
    branch: '',
    accountNumber: '',
    accountName: ''
  });

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const handleCreate = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const name = formData.type === 'บุคคลธรรมดา' 
      ? `${formData.prefix} ${formData.firstName} ${formData.lastName}`.trim()
      : formData.firstName; // For company, maybe just use firstName field as company name

    setContacts([...contacts, { 
      id, 
      type: formData.type, 
      name, 
      taxId: formData.taxId, 
      province: formData.province 
    }]);
    setMode('list');
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      type: 'บุคคลธรรมดา',
      taxId: '',
      prefix: '',
      firstName: '',
      lastName: '',
      address: '',
      subDistrict: '',
      district: '',
      province: '',
      postalCode: '',
      country: '',
      phone: '',
      email: '',
      bank: '',
      branch: '',
      accountNumber: '',
      accountName: ''
    });
  };

  if (mode === 'add') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMode('list')}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Contact Setting</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMode('list')}
              className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreate}
              className="px-6 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
            >
              Create
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 space-y-10">
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-800">สร้างผู้ติดต่อ</h2>
            </div>

            <div className="space-y-8">
              {/* Contact Type */}
              <div className="relative">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <span className="text-red-500 mr-1">*</span>ประเภทผู้ติดต่อ
                </label>
                <button 
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all outline-none text-left"
                >
                  <span className={cn("font-medium", formData.type ? "text-slate-700" : "text-slate-400")}>
                    {formData.type}
                  </span>
                  <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", showTypeDropdown && "rotate-180")} />
                </button>
                
                <AnimatePresence>
                  {showTypeDropdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden"
                    >
                      {['บุคคลธรรมดา', 'บริษัทจำกัด'].map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            setFormData({...formData, type: type as any});
                            setShowTypeDropdown(false);
                          }}
                          className={cn(
                            "w-full text-left px-6 py-4 text-sm transition-colors",
                            formData.type === type ? "bg-cyan-50 text-[#00b4d8] font-bold" : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tax ID */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">เลขที่ผู้เสียภาษี 13 หลัก</label>
                <input 
                  type="text"
                  maxLength={13}
                  placeholder="กรอกเลขที่ผู้เสียภาษี"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                  value={formData.taxId}
                  onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                />
              </div>

              {/* Name Info */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">คำนำหน้า</label>
                  <input 
                    type="text"
                    placeholder="กรอกคำนำหน้า"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                    value={formData.prefix}
                    onChange={(e) => setFormData({...formData, prefix: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อ</label>
                    <input 
                      type="text"
                      placeholder="กรอกชื่อ"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">นามสกุล</label>
                    <input 
                      type="text"
                      placeholder="กรอกนามสกุล"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-800 border-b border-slate-50 pb-2">ที่อยู่ / ช่องทางติดต่อ</h3>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ที่อยู่</label>
                  <textarea 
                    placeholder="กรอกที่อยู่"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none resize-none"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ตำบล/แขวง</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.subDistrict}
                      onChange={(e) => setFormData({...formData, subDistrict: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">อำเภอ/เขต</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.district}
                      onChange={(e) => setFormData({...formData, district: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">จังหวัด</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.province}
                      onChange={(e) => setFormData({...formData, province: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">รหัสไปรษณีย์</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ประเทศ</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                    value={formData.country}
                    onChange={(e) => setFormData({...formData, country: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">เบอร์โทร</label>
                    <input 
                      type="tel"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                    <input 
                      type="email"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Financial Section */}
              <div className="space-y-6 pt-4">
                <h3 className="text-lg font-black text-slate-800 border-b border-slate-50 pb-2">ช่องทางการเงิน</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ธนาคาร</label>
                    <div className="relative">
                      <select 
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none appearance-none bg-white"
                        value={formData.bank}
                        onChange={(e) => setFormData({...formData, bank: e.target.value})}
                      >
                        <option value="">เลือก</option>
                        <option value="kbank">ธนาคารกสิกรไทย</option>
                        <option value="scb">ธนาคารไทยพาณิชย์</option>
                        <option value="bbl">ธนาคารกรุงเทพ</option>
                        <option value="ktb">ธนาคารกรุงไทย</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">สาขา</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.branch}
                      onChange={(e) => setFormData({...formData, branch: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">เลขที่บัญชี</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({...formData, accountNumber: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อบัญชี</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none"
                      value={formData.accountName}
                      onChange={(e) => setFormData({...formData, accountName: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">CONTACT LIST</h1>
        <button 
          onClick={() => setMode('add')}
          className="flex items-center gap-2 px-6 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
        >
          <Plus className="w-4 h-4" />
          New Contact
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
          <h3 className="text-sm font-black text-slate-600 uppercase tracking-wider">{contacts.length} RESULT</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center w-16">No.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">TAX</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">Province</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <User className="w-16 h-16" />
                      <p className="text-lg font-bold">ไม่พบข้อมูล</p>
                    </div>
                  </td>
                </tr>
              ) : (
                contacts.map((contact, index) => (
                  <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center font-medium text-slate-500">{index + 1}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        contact.type === 'บุคคลธรรมดา' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                      )}>
                        {contact.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">{contact.name}</td>
                    <td className="px-6 py-4 text-slate-600">{contact.taxId || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{contact.province || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="p-4 border-t border-slate-50 flex justify-end gap-2">
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 disabled:opacity-20" disabled>
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center bg-[#00b4d8] text-white rounded-lg font-bold text-xs">
            1
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 disabled:opacity-20" disabled>
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}
