import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  ArrowLeft,
  Trash2,
  Save,
  X,
  ChevronDown,
  Image as ImageIcon,
  Check,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Activity {
  id: string;
  name: string;
  group: string;
  subGroup: string;
  product: string;
  price: number;
  appoint: boolean;
  opd: boolean;
  pos: boolean;
  petTypes: string[];
}

const initialActivities: Activity[] = [
  { id: '1', name: 'Dental Clinic VAT', group: 'Specialist', subGroup: 'Dental', product: '-', price: 500, appoint: true, opd: true, pos: true, petTypes: ['Dog/สุนัข', 'Cat/แมว'] },
  { id: '2', name: 'Bone and Joint Clinic', group: 'Specialist', subGroup: 'Orthopedic', product: '-', price: 500, appoint: true, opd: true, pos: true, petTypes: ['Dog/สุนัข'] },
  { id: '3', name: 'Acupunture Clinic', group: 'Specialist', subGroup: 'Alternative', product: '-', price: 500, appoint: true, opd: true, pos: true, petTypes: ['Dog/สุนัข', 'Cat/แมว'] },
  { id: '4', name: 'Rehabilitation Clinic', group: 'Specialist', subGroup: 'Physical therapy', product: '-', price: 500, appoint: true, opd: true, pos: true, petTypes: ['Dog/สุนัข', 'Cat/แมว'] },
  { id: '5', name: 'Neurology Clinic', group: 'Specialist', subGroup: 'Neurology', product: '-', price: 500, appoint: true, opd: true, pos: true, petTypes: ['Dog/สุนัข', 'Cat/แมว'] },
  { id: '6', name: 'Urology Clinic', group: 'Specialist', subGroup: 'Internal', product: '-', price: 500, appoint: true, opd: true, pos: true, petTypes: ['Dog/สุนัข', 'Cat/แมว'] },
  { id: '7', name: 'Endocrinology Clinic', group: 'Specialist', subGroup: 'Internal', product: '-', price: 500, appoint: true, opd: true, pos: true, petTypes: ['Dog/สุนัข', 'Cat/แมว'] },
  { id: '8', name: 'Reproductive Clinic', group: 'Specialist', subGroup: 'Internal', product: '-', price: 500, appoint: true, opd: true, pos: true, petTypes: ['Dog/สุนัข', 'Cat/แมว'] },
  { id: '9', name: 'Cardiology Clinic', group: 'Specialist', subGroup: 'Internal', product: '-', price: 500, appoint: true, opd: true, pos: true, petTypes: ['Dog/สุนัข', 'Cat/แมว'] },
  { id: '10', name: 'Dermatology Clinic', group: 'Specialist', subGroup: 'Dermatology', product: '-', price: 500, appoint: true, opd: true, pos: true, petTypes: ['Dog/สุนัข', 'Cat/แมว'] },
];

export default function ActivitiesSetting() {
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [editingActivity, setEditingActivity] = useState<Partial<Activity> | null>(null);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showSubGroupDropdown, setShowSubGroupDropdown] = useState(false);
  const [showPetTypeDropdown, setShowPetTypeDropdown] = useState(false);

  const activityGroups = [
    'Vaccine', 'Parasite', 'Drug', 'Surgery', 'Pet Shop', 
    'Pet care', 'Lab and histo check', 'Specialist', 'Image', 
    'Physical therapy', 'Package', 'Feed', 'Product', 'Custom', 'ETC.'
  ];

  const activitySubGroups = [
    'Skin', 'Other (อื่น ๆ)', 'Nutrition', 'Oncology', 'Ophthalmology', 'Feline', 'Dermatology'
  ];

  const availablePetTypes = [
    'Dog/สุนัข', 'Cat/แมว', 'Rabbit/กระต่าย', 'Bird/นก', 'Turtle/เต่าน้ำ', 'Chinchilla/ชินชิลล่า', 'Ferret/เฟอเรท'
  ];

  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setMode('edit');
  };

  const toggleStatus = (id: string, field: 'appoint' | 'opd' | 'pos') => {
    setActivities(activities.map(a => 
      a.id === id ? { ...a, [field]: !a[field] } : a
    ));
  };

  const toggleEditStatus = (field: 'appoint' | 'opd' | 'pos') => {
    if (editingActivity) {
      setEditingActivity({
        ...editingActivity,
        [field]: !editingActivity[field as keyof Activity]
      });
    }
  };

  const handleCreate = () => {
    setEditingActivity({
      name: '',
      group: 'Select Group',
      subGroup: 'Select Sub Group',
      product: '-',
      price: 0,
      appoint: true,
      opd: true,
      pos: true,
      petTypes: []
    });
    setMode('edit');
  };

  const handleSave = () => {
    if (editingActivity?.id) {
      setActivities(activities.map(a => a.id === editingActivity.id ? editingActivity as Activity : a));
    } else {
      const newId = (activities.length + 1).toString();
      setActivities([...activities, { ...editingActivity, id: newId } as Activity]);
    }
    setMode('list');
  };

  if (mode === 'edit') {
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
            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">CREATE ACTIVITY</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-6 py-2 bg-white border border-red-200 text-red-500 rounded-lg font-bold hover:bg-red-50 transition-all">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button 
              onClick={() => setMode('list')}
              className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>

        {/* Type Selection */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <div className="flex items-center justify-center gap-12">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm font-bold text-slate-800">ชนิดของ Activity</p>
              <div className="flex gap-12">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-[#00b4d8]">
                    <div className="w-2.5 h-2.5 rounded-full bg-transparent" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-400">Product</p>
                    <p className="text-[10px] text-slate-300">(ผลิตภัณฑ์)</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="w-5 h-5 rounded-full border-2 border-[#00b4d8] flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-[#00b4d8]">Service</p>
                    <p className="text-[10px] text-[#00b4d8] opacity-60">(บริการ)</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            {/* Left: Cover Picture */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-4">Cover Picture</label>
              <div className="relative aspect-[4/3] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 group cursor-pointer hover:border-[#00b4d8] transition-all overflow-hidden">
                <img 
                  src="https://illustrations.popsy.co/amber/pharmacy.svg" 
                  alt="Cover" 
                  className="absolute inset-0 w-full h-full object-contain p-8 opacity-60"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-green-500/80 flex flex-col items-center justify-center text-white p-4 text-center">
                  <p className="text-xl font-black mb-1">คลินิกทันตกรรม</p>
                  <p className="text-xs">(Dental Clinic)</p>
                </div>
                <button className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-400 text-center italic">แนบรูป เป็น cover card</p>
            </div>

            {/* Right: Form Fields */}
            <div className="lg:col-span-3 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Activity Name <span className="text-red-500">*</span></label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent transition-all outline-none font-medium"
                  value={editingActivity?.name || ''}
                  onChange={(e) => setEditingActivity({ ...editingActivity, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Activity Group <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <button 
                      onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border flex items-center justify-between transition-all outline-none font-medium text-left",
                        showGroupDropdown ? "border-[#00b4d8] ring-1 ring-[#00b4d8] bg-white" : "border-slate-100 bg-slate-50/50"
                      )}
                    >
                      <span className={cn(editingActivity?.group === 'Select Group' ? "text-slate-400" : "text-slate-700")}>
                        {editingActivity?.group}
                      </span>
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", showGroupDropdown && "rotate-180")} />
                    </button>
                    
                    <AnimatePresence>
                      {showGroupDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowGroupDropdown(false)} 
                          />
                          <motion.div 
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-20 max-h-64 overflow-y-auto custom-scrollbar"
                          >
                            {activityGroups.map((group) => (
                              <button
                                key={group}
                                onClick={() => {
                                  setEditingActivity({ ...editingActivity, group: group });
                                  setShowGroupDropdown(false);
                                }}
                                className={cn(
                                  "w-full px-6 py-3 text-left text-sm font-medium transition-colors hover:bg-slate-50",
                                  editingActivity?.group === group ? "text-[#00b4d8] bg-cyan-50/30" : "text-slate-600"
                                )}
                              >
                                {group}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Activity Sub Group <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <button 
                      onClick={() => setShowSubGroupDropdown(!showSubGroupDropdown)}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border flex items-center justify-between transition-all outline-none font-medium text-left",
                        showSubGroupDropdown ? "border-[#00b4d8] ring-1 ring-[#00b4d8] bg-white" : "border-slate-100 bg-slate-50/50"
                      )}
                    >
                      <span className={cn(editingActivity?.subGroup === 'Select Sub Group' ? "text-slate-400" : "text-slate-700")}>
                        {editingActivity?.subGroup}
                      </span>
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", showSubGroupDropdown && "rotate-180")} />
                    </button>
                    
                    <AnimatePresence>
                      {showSubGroupDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowSubGroupDropdown(false)} 
                          />
                          <motion.div 
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-20 max-h-64 overflow-y-auto custom-scrollbar"
                          >
                            {activitySubGroups.map((sub) => (
                              <button
                                key={sub}
                                onClick={() => {
                                  setEditingActivity({ ...editingActivity, subGroup: sub });
                                  setShowSubGroupDropdown(false);
                                }}
                                className={cn(
                                  "w-full px-6 py-3 text-left text-sm font-medium transition-colors hover:bg-slate-50",
                                  editingActivity?.subGroup === sub ? "text-[#00b4d8] bg-cyan-50/30" : "text-slate-600"
                                )}
                              >
                                {sub}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Pet Type</label>
                <div className="relative">
                  <div 
                    onClick={() => setShowPetTypeDropdown(!showPetTypeDropdown)}
                    className={cn(
                      "w-full p-3 rounded-xl border flex flex-wrap gap-2 min-h-[50px] cursor-pointer transition-all",
                      showPetTypeDropdown ? "border-[#00b4d8] ring-1 ring-[#00b4d8] bg-white" : "border-slate-100 bg-slate-50/50"
                    )}
                  >
                    {editingActivity?.petTypes && editingActivity.petTypes.length > 0 ? (
                      editingActivity.petTypes.map(tag => (
                        <div key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500">
                          {tag}
                          <X 
                            className="w-3 h-3 cursor-pointer hover:text-red-500" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingActivity({
                                ...editingActivity,
                                petTypes: editingActivity.petTypes?.filter(t => t !== tag)
                              });
                            }}
                          />
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-400 text-sm self-center ml-1">Select Pet Types</span>
                    )}
                    <ChevronDown className={cn("ml-auto w-4 h-4 text-slate-400 self-center transition-transform", showPetTypeDropdown && "rotate-180")} />
                  </div>

                  <AnimatePresence>
                    {showPetTypeDropdown && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowPetTypeDropdown(false)} 
                        />
                        <motion.div 
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-20 max-h-64 overflow-y-auto custom-scrollbar"
                        >
                          {availablePetTypes.map((type) => {
                            const isSelected = editingActivity?.petTypes?.includes(type);
                            return (
                              <button
                                key={type}
                                onClick={() => {
                                  const currentTypes = editingActivity?.petTypes || [];
                                  const newTypes = isSelected 
                                    ? currentTypes.filter(t => t !== type)
                                    : [...currentTypes, type];
                                  setEditingActivity({ ...editingActivity, petTypes: newTypes });
                                }}
                                className={cn(
                                  "w-full px-6 py-3 text-left text-sm font-medium transition-colors hover:bg-slate-50 flex items-center justify-between",
                                  isSelected ? "text-[#00b4d8] bg-cyan-50/30" : "text-slate-600"
                                )}
                              >
                                {type}
                                {isSelected && <Check className="w-4 h-4" />}
                              </button>
                            );
                          })}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                <p className="mt-2 text-[10px] text-[#00b4d8] font-bold">(ถ้าไม่เลือกจะแสดงในทุกชนิด)</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">กลุ่มสำหรับพิมพ์ใบเสร็จแบบย่อ</label>
                  <input 
                    type="text"
                    placeholder="Print Group"
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                  />
                </div>
                <button className="mt-7 px-6 py-3 bg-cyan-50 text-[#00b4d8] rounded-xl font-bold hover:bg-cyan-100 transition-all border border-cyan-100">
                  +เพิ่มกลุ่ม
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-1/2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">ราคา</label>
                  <div className="relative">
                    <input 
                      type="number"
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-bold text-center"
                      value={editingActivity?.price || 0}
                      onChange={(e) => setEditingActivity({ ...editingActivity, price: Number(e.target.value) })}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">บาท</span>
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="space-y-4">
                {[
                  { label: 'Appointment', key: 'appoint' },
                  { label: 'OPD', key: 'opd' },
                  { label: 'POS', key: 'pos' }
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-12">
                    <p className="w-32 font-bold text-slate-800">{item.label}</p>
                    <div className="flex gap-6">
                      <label 
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => toggleEditStatus(item.key as 'appoint' | 'opd' | 'pos')}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-all",
                          editingActivity?.[item.key as keyof Activity] 
                            ? "border-[#00b4d8] bg-[#00b4d8]" 
                            : "border-slate-300 bg-white"
                        )}>
                          {editingActivity?.[item.key as keyof Activity] && (
                            <Check className="w-3 h-3 text-white stroke-[4]" />
                          )}
                        </div>
                        <span className={cn(
                          "text-xs font-bold transition-all",
                          editingActivity?.[item.key as keyof Activity] ? "text-[#00b4d8]" : "text-slate-400"
                        )}>Active</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer opacity-40">
                        <div className="w-5 h-5 rounded border border-slate-300 bg-white" />
                        <span className="text-xs font-bold text-slate-400">Favorite</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* VAT Section */}
              <div className="flex items-center gap-8 pt-4">
                <p className="font-bold text-slate-800">ภาษีมูลค่าเพิ่ม</p>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer opacity-40">
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                    <span className="text-sm font-bold text-slate-400">ไม่มี VAT</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className="w-5 h-5 rounded-full border-2 border-[#00b4d8] flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />
                    </div>
                    <span className="text-sm font-bold text-[#00b4d8]">VAT 7%</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Product List Section */}
          <div className="pt-10 border-t border-slate-50">
            <h3 className="text-lg font-black text-[#00b4d8] mb-6">จัดรายการ Product ที่ใช้ในกิจกรรม</h3>
            <div className="flex gap-4">
              <button className="flex items-center gap-2 px-6 py-3 bg-white border border-cyan-200 text-[#00b4d8] rounded-xl font-bold hover:bg-cyan-50 transition-all">
                <Plus className="w-4 h-4" />
                เพิ่มรายการ
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all">
                Create New Product
              </button>
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
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">ACTIVITIES SETTING</h1>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <select className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-400 text-sm outline-none appearance-none pr-10">
              <option>Activity Group</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          </div>
          <button 
            onClick={handleCreate}
            className="flex items-center gap-2 px-6 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
          >
            <Plus className="w-4 h-4" />
            Create New Activity
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Search</p>
              <div className="flex items-center">
                <input 
                  type="text"
                  placeholder="Activity name , Product name"
                  className="w-96 px-4 py-2 rounded-l-lg border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent outline-none text-sm"
                />
                <button className="px-4 py-2 bg-slate-50 border border-l-0 border-slate-200 rounded-r-lg hover:bg-slate-100 transition-colors">
                  <Search className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="mt-6">
              <div className="relative w-48">
                <select className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-400 text-sm outline-none appearance-none pr-10">
                  <option>All</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all">
              เรียงลำดับ
            </button>
            <button className="flex items-center gap-2 px-6 py-2 bg-white border border-red-100 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition-all">
              ลบ Activity
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center w-16">No.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">Activity Name</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Price (THB)</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Appoint.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">OPD.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">POS.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activities.map((activity, index) => (
                <tr key={activity.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-center font-medium text-slate-500">{index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{activity.name}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{activity.product}</td>
                  <td className="px-6 py-4 text-center font-black text-slate-900">{activity.price}</td>
                  <td className="px-6 py-4 text-center">
                    <div 
                      onClick={() => toggleStatus(activity.id, 'appoint')}
                      className={cn(
                        "w-10 h-5 rounded-full relative cursor-pointer transition-all mx-auto",
                        activity.appoint ? "bg-green-500" : "bg-slate-200"
                      )}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all",
                        activity.appoint ? "left-5.5" : "left-1"
                      )} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div 
                      onClick={() => toggleStatus(activity.id, 'opd')}
                      className={cn(
                        "w-10 h-5 rounded-full relative cursor-pointer transition-all mx-auto",
                        activity.opd ? "bg-green-500" : "bg-slate-200"
                      )}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all",
                        activity.opd ? "left-5.5" : "left-1"
                      )} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div 
                      onClick={() => toggleStatus(activity.id, 'pos')}
                      className={cn(
                        "w-10 h-5 rounded-full relative cursor-pointer transition-all mx-auto",
                        activity.pos ? "bg-green-500" : "bg-slate-200"
                      )}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all",
                        activity.pos ? "left-5.5" : "left-1"
                      )} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => handleEdit(activity)}
                      className="flex items-center gap-1 px-4 py-1.5 bg-[#00b4d8] text-white rounded-lg text-xs font-bold hover:bg-[#0096b1] transition-all mx-auto"
                    >
                      Edit 
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
