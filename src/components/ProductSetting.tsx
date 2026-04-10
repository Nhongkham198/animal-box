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
  ChevronRight,
  Image as ImageIcon,
  Check,
  Minus,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Product {
  id: string;
  name: string;
  type: string;
  unit: string;
  isInStock: boolean;
}

const initialProducts: Product[] = [
  { id: '1', name: 'Advocate <4 kg cat', type: 'Anti-parasite', unit: 'หลอด', isInStock: true },
  { id: '2', name: 'Advocate <4 kg Dog', type: 'Anti-parasite', unit: 'หลอด', isInStock: true },
  { id: '3', name: 'Advocate 10-25 kg Dog', type: 'Anti-parasite', unit: 'หลอด', isInStock: true },
  { id: '4', name: 'Advocate 25-40 kg Dog', type: 'Anti-parasite', unit: 'หลอด', isInStock: true },
  { id: '5', name: 'Advocate 4-10 kg Dog', type: 'Anti-parasite', unit: 'หลอด', isInStock: true },
  { id: '6', name: 'Advocate 4-8 kg Cat', type: 'Anti-parasite', unit: 'หลอด', isInStock: true },
  { id: '7', name: 'Bayovac® DHPPi+L', type: 'Vaccine', unit: 'ขวด', isInStock: true },
];

const PRODUCT_TYPES = ['Anti-parasite', 'Vaccine', 'Medicine', 'Supplies', 'Food', 'Other'];
const UNITS = ['หลอด', 'ขวด', 'เม็ด', 'แผง', 'กล่อง', 'ถุง', 'กิโลกรัม', 'กรัม'];
const ACTIVITY_GROUPS = ['ยาและเวชภัณฑ์', 'บริการ', 'แล็บ', 'ศัลยกรรม', 'อื่นๆ'];
const ACTIVITY_SUB_GROUPS = ['ยาถ่ายพยาธิ', 'วัคซีนรวม', 'ยาฆ่าเชื้อ', 'ตรวจเลือด', 'อาบน้ำตัดขน'];
const PET_TYPES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Exotic'];
const MEDICAL_USES = ['กิน', 'ทา', 'หยอดหู', 'หยอดตา', 'ฉีด'];
const DOSAGE_UNITS = ['เม็ด', 'CC', 'ML', 'หยด', 'หลอด'];

export default function ProductSetting() {
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const handleCreate = () => {
    setEditingProduct({
      id: Math.random().toString(36).substr(2, 9),
      type: 'product',
      name: '',
      genericName: '',
      productType: '',
      unit: '',
      barcode: '',
      valueGroup: 'low',
      safetyStock: 0,
      leadTime: 0,
      maxStock: 0,
      activityGroup: '',
      activitySubGroup: '',
      petTypes: [],
      printGroup: '',
      price: 0,
      status: {
        appoint: { active: true, favorite: false },
        opd: { active: true, favorite: false },
        pos: { active: false, favorite: false },
      },
      vat: 'none',
      stockSetting: {
        name: '',
        amount: 0.01,
        showInReceipt: true
      },
      drugLabel: {
        enabled: true,
        medicalUse: '',
        position: '',
        dosage: 0,
        dosageUnit: '',
        timing: 'after',
        timingDetail: '',
        slots: { morning: false, noon: false, evening: false, bedtime: false },
        other: false,
        every: 0,
        asNeeded: false,
        warnings: { noEat: false, fridge: false, danger: false, shake: false },
        purpose: '',
        additional: ''
      }
    });
    setMode('edit');
  };

  const handleEdit = (product: Product) => {
    // In a real app, we'd fetch full details. For now, mock it.
    setEditingProduct({
      ...product,
      type: 'product',
      productType: product.type,
      valueGroup: 'low',
      safetyStock: 0,
      leadTime: 0,
      maxStock: 0,
      status: {
        appoint: { active: true, favorite: false },
        opd: { active: true, favorite: false },
        pos: { active: false, favorite: false },
      },
      vat: 'none',
      stockSetting: {
        name: product.name,
        amount: 0.01,
        showInReceipt: true
      },
      drugLabel: { enabled: true, slots: {}, warnings: {} }
    });
    setMode('edit');
  };

  const handleSave = () => {
    if (!editingProduct.name) {
      alert('Please enter product name');
      return;
    }

    const newProduct: Product = {
      id: editingProduct.id,
      name: editingProduct.name,
      type: editingProduct.productType || 'Other',
      unit: editingProduct.unit || 'Unit',
      isInStock: true
    };

    setProducts(prev => {
      const exists = prev.find(p => p.id === newProduct.id);
      if (exists) {
        return prev.map(p => p.id === newProduct.id ? newProduct : p);
      }
      return [...prev, newProduct];
    });

    setMode('list');
  };

  if (mode === 'edit') {
    return (
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMode('list')}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">PRODUCT SETTING</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMode('list')}
              className="px-8 py-2 bg-white border border-[#00b4d8] text-[#00b4d8] rounded-lg font-bold hover:bg-cyan-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-8 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>

        {/* Activity Type Selection */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <div className="flex flex-col items-center gap-6">
            <p className="text-sm font-bold text-slate-800">เลือกชนิด Activity</p>
            <div className="flex items-center gap-20">
              <label 
                onClick={() => setEditingProduct({ ...editingProduct, type: 'product' })}
                className="flex items-center gap-4 cursor-pointer group"
              >
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                  editingProduct.type === 'product' ? "border-[#00b4d8]" : "border-slate-200"
                )}>
                  {editingProduct.type === 'product' && <div className="w-3 h-3 rounded-full bg-[#00b4d8]" />}
                </div>
                <div className="text-center">
                  <p className={cn("font-bold text-lg", editingProduct.type === 'product' ? "text-[#00b4d8]" : "text-slate-400")}>Product</p>
                  <p className="text-xs text-slate-300">(ผลิตภัณฑ์)</p>
                </div>
              </label>
              <div className="h-12 w-px bg-slate-100" />
              <label 
                onClick={() => setEditingProduct({ ...editingProduct, type: 'service' })}
                className="flex items-center gap-4 cursor-pointer group"
              >
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                  editingProduct.type === 'service' ? "border-[#00b4d8]" : "border-slate-200"
                )}>
                  {editingProduct.type === 'service' && <div className="w-3 h-3 rounded-full bg-[#00b4d8]" />}
                </div>
                <div className="text-center">
                  <p className={cn("font-bold text-lg", editingProduct.type === 'service' ? "text-[#00b4d8]" : "text-slate-400")}>Service</p>
                  <p className="text-xs text-slate-300">(บริการ)</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Left: Cover Picture */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-4">Cover Picture</label>
              <div className="relative aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 group cursor-pointer hover:border-[#00b4d8] transition-all">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-cyan-50 transition-colors">
                  <Upload className="w-8 h-8 text-slate-300 group-hover:text-[#00b4d8]" />
                </div>
                <p className="text-[10px] text-slate-400 text-center italic px-4">แนบรูป เป็น cover card</p>
              </div>
            </div>

            {/* Right: Product Details */}
            <div className="lg:col-span-3 space-y-8">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Product Name (Trade Name)</label>
                  <input 
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Generic Name, Concentration</label>
                  <input 
                    type="text"
                    placeholder="เช่น Paracetamol 500 mg, Aspirin 81 mg"
                    value={editingProduct.genericName}
                    onChange={(e) => setEditingProduct({ ...editingProduct, genericName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-sm"
                  />
                  <p className="mt-1 text-[10px] text-[#00b4d8] font-bold">*กรณีที่เป็น เวชภัณฑ์</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Type</label>
                  <div className="relative">
                    <select 
                      value={editingProduct.productType}
                      onChange={(e) => setEditingProduct({ ...editingProduct, productType: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none appearance-none font-medium"
                    >
                      <option value="">Select Product Type</option>
                      {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Unit ตั้งต้น</label>
                  <div className="relative">
                    <select 
                      value={editingProduct.unit}
                      onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none appearance-none font-medium"
                    >
                      <option value="">Select Unit</option>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400 italic">ให้ใส่หน่วยย่อยที่สุดของ product ชนิดนี้</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Barcode</label>
                <input 
                  type="text"
                  value={editingProduct.barcode}
                  onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium"
                />
              </div>

              <div className="flex items-center gap-8">
                <p className="text-sm font-bold text-slate-700">กลุ่มมูลค่าสินค้า</p>
                <div className="flex gap-4">
                  {[
                    { label: 'ราคาสูง', value: 'high' },
                    { label: 'ราคาปานกลาง', value: 'medium' },
                    { label: 'ราคาต่ำ', value: 'low' }
                  ].map((item) => (
                    <label 
                      key={item.value} 
                      onClick={() => setEditingProduct({ ...editingProduct, valueGroup: item.value })}
                      className="flex items-center gap-3 px-6 py-2 rounded-xl border border-slate-100 bg-white cursor-pointer hover:bg-slate-50 transition-all"
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        editingProduct.valueGroup === item.value ? "border-[#00b4d8]" : "border-slate-200"
                      )}>
                        {editingProduct.valueGroup === item.value && <div className="w-2 h-2 rounded-full bg-[#00b4d8]" />}
                      </div>
                      <span className={cn("text-sm font-bold", editingProduct.valueGroup === item.value ? "text-[#00b4d8]" : "text-slate-400")}>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <p className="text-sm font-bold text-slate-800">ตั้งค่าจำนวนวันเพื่อคำนวณ Safety stock, Max stock, Re order point</p>
                {[
                  { label: 'จำนวนวันที่ต้องการเก็บสินค้าเพื่อความปลอดภัย (Safety Stock)', key: 'safetyStock', hint: '*เพื่อคำนวณ จุดสั่งซื้อ (Re order point) และ Safety stock (ต้องมากกว่า Lead time)' },
                  { label: 'ระยะเวลารอคอยการสั่งซื้อ (Lead time)', key: 'leadTime', hint: '*เพื่อคำนวณ จุดสั่งซื้อ (Re order point)' },
                  { label: 'จำนวนวันที่ต้องการเก็บสินค้าสูงสุด (Max Stock)', key: 'maxStock', hint: '*เพื่อคำนวณ Max Stock (ต้องมากกว่าจำนวน Safety stock)' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-8">
                    <p className="w-80 text-sm font-bold text-slate-600 leading-tight">{item.label}</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center w-32 border border-slate-100 bg-slate-50/50 rounded-lg overflow-hidden">
                        <button 
                          onClick={() => setEditingProduct({ ...editingProduct, [item.key]: Math.max(0, editingProduct[item.key] - 1) })}
                          className="p-2 hover:bg-slate-100 text-slate-400 transition-colors border-r border-slate-100"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input 
                          type="number"
                          value={editingProduct[item.key]}
                          onChange={(e) => setEditingProduct({ ...editingProduct, [item.key]: parseInt(e.target.value) || 0 })}
                          className="w-full text-center font-bold text-slate-700 outline-none bg-transparent"
                        />
                        <button 
                          onClick={() => setEditingProduct({ ...editingProduct, [item.key]: editingProduct[item.key] + 1 })}
                          className="p-2 hover:bg-slate-100 text-slate-400 transition-colors border-l border-slate-100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[10px] text-[#00b4d8] font-bold">{item.hint}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-700">วัน</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Activity Settings */}
          <div className="space-y-8">
            <h3 className="text-lg font-black text-slate-800">ตั้งค่า Activity <span className="text-green-500 ml-2">สถานะ: เปิดการใช้งาน</span></h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
              <div className="lg:col-span-1" />
              <div className="lg:col-span-3 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Activity Group <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select 
                        value={editingProduct.activityGroup}
                        onChange={(e) => setEditingProduct({ ...editingProduct, activityGroup: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none appearance-none font-medium"
                      >
                        <option value="">Activity Group</option>
                        {ACTIVITY_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Activity Sub Group <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select 
                        value={editingProduct.activitySubGroup}
                        onChange={(e) => setEditingProduct({ ...editingProduct, activitySubGroup: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none appearance-none font-medium"
                      >
                        <option value="">Activity Sub Group</option>
                        {ACTIVITY_SUB_GROUPS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Pet Type</label>
                    <div className="relative">
                      <select 
                        value={editingProduct.petTypes[0] || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, petTypes: [e.target.value] })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none appearance-none font-medium"
                      >
                        <option value="">Pet Type</option>
                        {PET_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                    <p className="mt-1 text-[10px] text-[#00b4d8] font-bold">(ถ้าไม่เลือกจะแสดงในทุกชนิด)</p>
                  </div>
                  <div className="flex items-center pt-7">
                    <p className="text-[10px] text-[#00b4d8] font-bold">*สามารถเลือกได้มากกว่า 1 ชนิด</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">กลุ่มสำหรับพิมพ์ใบเสร็จแบบย่อ</label>
                    <input 
                      type="text"
                      placeholder="Print Group"
                      value={editingProduct.printGroup}
                      onChange={(e) => setEditingProduct({ ...editingProduct, printGroup: e.target.value })}
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
                        value={editingProduct.price}
                        onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-bold text-center"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">บาท</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-bold text-slate-700">Status</p>
                  {[
                    { label: 'Appointment', key: 'appoint' },
                    { label: 'OPD', key: 'opd' },
                    { label: 'POS', key: 'pos' }
                  ].map(item => (
                    <div key={item.key} className="flex items-center gap-12">
                      <p className="w-32 font-bold text-slate-600">{item.label}</p>
                      <div className="flex gap-6">
                        <label 
                          onClick={() => setEditingProduct({
                            ...editingProduct,
                            status: {
                              ...editingProduct.status,
                              [item.key]: { ...editingProduct.status[item.key], active: !editingProduct.status[item.key].active }
                            }
                          })}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center transition-all",
                            editingProduct.status[item.key].active ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-300 bg-white"
                          )}>
                            {editingProduct.status[item.key].active && <Check className="w-3 h-3 text-white stroke-[4]" />}
                          </div>
                          <span className={cn("text-xs font-bold", editingProduct.status[item.key].active ? "text-[#00b4d8]" : "text-slate-400")}>Active</span>
                        </label>
                        <label 
                          onClick={() => setEditingProduct({
                            ...editingProduct,
                            status: {
                              ...editingProduct.status,
                              [item.key]: { ...editingProduct.status[item.key], favorite: !editingProduct.status[item.key].favorite }
                            }
                          })}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center transition-all",
                            editingProduct.status[item.key].favorite ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-300 bg-white"
                          )}>
                            {editingProduct.status[item.key].favorite && <Check className="w-3 h-3 text-white stroke-[4]" />}
                          </div>
                          <span className={cn("text-xs font-bold", editingProduct.status[item.key].favorite ? "text-[#00b4d8]" : "text-slate-400")}>Favorite</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-8 pt-4">
                  <p className="font-bold text-slate-700">ภาษีมูลค่าเพิ่ม</p>
                <div className="flex gap-6">
                  {[
                    { label: 'ไม่มี VAT', value: 'none' },
                    { label: 'VAT 7%', value: 'vat7' }
                  ].map((item) => (
                    <label 
                      key={item.value}
                      onClick={() => setEditingProduct({ ...editingProduct, vat: item.value })}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        editingProduct.vat === item.value ? "border-[#00b4d8]" : "border-slate-300"
                      )}>
                        {editingProduct.vat === item.value && <div className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />}
                      </div>
                      <span className={cn("text-sm font-bold", editingProduct.vat === item.value ? "text-[#00b4d8]" : "text-slate-400")}>{item.label}</span>
                    </label>
                  ))}
                </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Stock Cutting Settings */}
          <div className="space-y-8">
            <h3 className="text-lg font-black text-slate-800">ตั้งค่าการตัด stock และแสดงในใบเสร็จ</h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
              <div className="lg:col-span-1" />
              <div className="lg:col-span-3 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Product Name:</label>
                    <input 
                      type="text"
                      value={editingProduct.stockSetting.name}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        stockSetting: { ...editingProduct.stockSetting, name: e.target.value }
                      })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                    />
                  </div>
                  <div className="w-48">
                    <label className="block text-sm font-bold text-slate-700 mb-2">จำนวน</label>
                    <input 
                      type="number"
                      value={editingProduct.stockSetting.amount}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        stockSetting: { ...editingProduct.stockSetting, amount: parseFloat(e.target.value) }
                      })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-bold text-center"
                    />
                  </div>
                  <div className="pt-7">
                    <label 
                      onClick={() => setEditingProduct({
                        ...editingProduct,
                        stockSetting: { ...editingProduct.stockSetting, showInReceipt: !editingProduct.stockSetting.showInReceipt }
                      })}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#00b4d8] bg-white cursor-pointer"
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-all",
                        editingProduct.stockSetting.showInReceipt ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-300 bg-white"
                      )}>
                        {editingProduct.stockSetting.showInReceipt && <Check className="w-3 h-3 text-white stroke-[4]" />}
                      </div>
                      <span className={cn("text-sm font-bold", editingProduct.stockSetting.showInReceipt ? "text-[#00b4d8]" : "text-slate-400")}>แสดงในใบเสร็จ</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Drug Label Setting */}
          <div className="space-y-8">
            <div 
              onClick={() => setEditingProduct({
                ...editingProduct,
                drugLabel: { ...editingProduct.drugLabel, enabled: !editingProduct.drugLabel.enabled }
              })}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className={cn(
                "w-5 h-5 rounded border flex items-center justify-center transition-all",
                editingProduct.drugLabel.enabled ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-300 bg-white"
              )}>
                {editingProduct.drugLabel.enabled && <Check className="w-3 h-3 text-white stroke-[4]" />}
              </div>
              <h3 className={cn("text-lg font-black", editingProduct.drugLabel.enabled ? "text-[#00b4d8]" : "text-slate-400")}>Drug Label Setting</h3>
            </div>
            
            <div className={cn("grid grid-cols-1 lg:grid-cols-4 gap-12 transition-opacity", !editingProduct.drugLabel.enabled && "opacity-40 pointer-events-none")}>
              <div className="lg:col-span-1" />
              <div className="lg:col-span-3 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">วิธีการใช้</label>
                    <div className="relative">
                      <select 
                        value={editingProduct.drugLabel.medicalUse}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          drugLabel: { ...editingProduct.drugLabel, medicalUse: e.target.value }
                        })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none appearance-none font-medium"
                      >
                        <option value="">Select Medical Use</option>
                        {MEDICAL_USES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ตำแหน่งที่ใช้</label>
                  <input 
                    type="text"
                    value={editingProduct.drugLabel.position}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      drugLabel: { ...editingProduct.drugLabel, position: e.target.value }
                    })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <p className="text-sm font-bold text-slate-700 w-32">ปริมาณการใช้ (ต่อครั้ง)</p>
                  <div className="flex items-center w-32 border border-slate-100 bg-slate-50/50 rounded-lg overflow-hidden">
                    <button 
                      onClick={() => setEditingProduct({
                        ...editingProduct,
                        drugLabel: { ...editingProduct.drugLabel, dosage: Math.max(0, editingProduct.drugLabel.dosage - 1) }
                      })}
                      className="p-2 hover:bg-slate-100 text-slate-400 transition-colors border-r border-slate-100"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input 
                      type="number"
                      value={editingProduct.drugLabel.dosage}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        drugLabel: { ...editingProduct.drugLabel, dosage: parseFloat(e.target.value) }
                      })}
                      className="w-full text-center font-bold text-slate-700 outline-none bg-transparent"
                    />
                    <button 
                      onClick={() => setEditingProduct({
                        ...editingProduct,
                        drugLabel: { ...editingProduct.drugLabel, dosage: editingProduct.drugLabel.dosage + 1 }
                      })}
                      className="p-2 hover:bg-slate-100 text-slate-400 transition-colors border-l border-slate-100"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative w-48">
                    <select 
                      value={editingProduct.drugLabel.dosageUnit}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        drugLabel: { ...editingProduct.drugLabel, dosageUnit: e.target.value }
                      })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none appearance-none font-medium"
                    >
                      <option value="">Select Unit</option>
                      {DOSAGE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-12">
                    <p className="text-sm font-bold text-slate-700 w-32">เวลา</p>
                    <div className="flex gap-8">
                      {[
                        { label: 'Before Meals', value: 'before' },
                        { label: 'After Meals', value: 'after' },
                        { label: 'With Meals', value: 'with' }
                      ].map((item) => (
                        <div key={item.value} className="flex items-center gap-6">
                          <label 
                            onClick={() => setEditingProduct({
                              ...editingProduct,
                              drugLabel: { ...editingProduct.drugLabel, timing: item.value }
                            })}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                              editingProduct.drugLabel.timing === item.value ? "border-[#00b4d8]" : "border-slate-200"
                            )}>
                              {editingProduct.drugLabel.timing === item.value && <div className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />}
                            </div>
                            <span className={cn("text-sm font-bold", editingProduct.drugLabel.timing === item.value ? "text-slate-700" : "text-slate-400")}>{item.label}</span>
                          </label>
                          <input 
                            type="text"
                            placeholder="อธิบายเพิ่มเติม เช่น 30 นาที"
                            value={editingProduct.drugLabel.timing === item.value ? editingProduct.drugLabel.timingDetail : ''}
                            onChange={(e) => setEditingProduct({
                              ...editingProduct,
                              drugLabel: { ...editingProduct.drugLabel, timingDetail: e.target.value }
                            })}
                            className="px-4 py-2 rounded-lg border border-slate-100 bg-slate-50/50 outline-none text-xs w-48"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-12 ml-44">
                    <div className="flex gap-4">
                      {[
                        { label: 'เช้า', key: 'morning' },
                        { label: 'กลางวัน', key: 'noon' },
                        { label: 'เย็น', key: 'evening' },
                        { label: 'ก่อนนอน', key: 'bedtime' }
                      ].map((item) => (
                        <label 
                          key={item.key}
                          onClick={() => setEditingProduct({
                            ...editingProduct,
                            drugLabel: {
                              ...editingProduct.drugLabel,
                              slots: { ...editingProduct.drugLabel.slots, [item.key]: !editingProduct.drugLabel.slots[item.key] }
                            }
                          })}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all",
                            editingProduct.drugLabel.slots[item.key] ? "border-[#00b4d8] bg-cyan-50" : "border-slate-100 bg-slate-50/50 opacity-40"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                            editingProduct.drugLabel.slots[item.key] ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-300 bg-white"
                          )}>
                            {editingProduct.drugLabel.slots[item.key] && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                          </div>
                          <span className={cn("text-xs font-bold", editingProduct.drugLabel.slots[item.key] ? "text-[#00b4d8]" : "text-slate-400")}>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-12 ml-44">
                    <div className="flex items-center gap-8">
                      <label 
                        onClick={() => setEditingProduct({
                          ...editingProduct,
                          drugLabel: { ...editingProduct.drugLabel, other: !editingProduct.drugLabel.other }
                        })}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          editingProduct.drugLabel.other ? "border-[#00b4d8]" : "border-slate-200"
                        )}>
                          {editingProduct.drugLabel.other && <div className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />}
                        </div>
                        <span className={cn("text-sm font-bold", editingProduct.drugLabel.other ? "text-[#00b4d8]" : "text-slate-700")}>อื่นๆ</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded border border-slate-200 bg-white" />
                        <span className="text-sm font-bold text-slate-400">ทุก / Every</span>
                        <input 
                          type="number" 
                          value={editingProduct.drugLabel.every}
                          onChange={(e) => setEditingProduct({
                            ...editingProduct,
                            drugLabel: { ...editingProduct.drugLabel, every: parseInt(e.target.value) || 0 }
                          })}
                          className="w-16 px-2 py-1 border border-slate-100 rounded bg-slate-50/50 text-center font-bold" 
                        />
                        <span className="text-sm font-bold text-slate-800">ชั่วโมง</span>
                      </div>
                      <div 
                        onClick={() => setEditingProduct({
                          ...editingProduct,
                          drugLabel: { ...editingProduct.drugLabel, asNeeded: !editingProduct.drugLabel.asNeeded }
                        })}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          editingProduct.drugLabel.asNeeded ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-200 bg-white"
                        )}>
                          {editingProduct.drugLabel.asNeeded && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                        </div>
                        <span className={cn("text-sm font-bold", editingProduct.drugLabel.asNeeded ? "text-[#00b4d8]" : "text-slate-400")}>เมื่อมีอาการ</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 ml-44">
                  {[
                    { label: 'ห้ามรับประทาน', key: 'noEat' },
                    { label: 'เก็บในตู้เย็น', key: 'fridge' },
                    { label: 'ยาอันตราย', key: 'danger' },
                    { label: 'เขย่าก่อนใช้', key: 'shake' }
                  ].map((item) => (
                    <div 
                      key={item.key}
                      onClick={() => setEditingProduct({
                        ...editingProduct,
                        drugLabel: {
                          ...editingProduct.drugLabel,
                          warnings: { ...editingProduct.drugLabel.warnings, [item.key]: !editingProduct.drugLabel.warnings[item.key] }
                        }
                      })}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-all",
                        editingProduct.drugLabel.warnings[item.key] ? "border-red-500 bg-red-500" : "border-slate-200 bg-white"
                      )}>
                        {editingProduct.drugLabel.warnings[item.key] && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                      </div>
                      <span className={cn("text-sm font-bold", editingProduct.drugLabel.warnings[item.key] ? "text-red-500" : "text-slate-400")}>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-12">
                  <p className="text-sm font-bold text-slate-700 w-32">วัตถุประสงค์</p>
                  <input 
                    type="text"
                    placeholder="ยาต้านการแข็งตัวของเลือด"
                    value={editingProduct.drugLabel.purpose}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      drugLabel: { ...editingProduct.drugLabel, purpose: e.target.value }
                    })}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                  />
                </div>

                <div className="flex items-center gap-12">
                  <p className="text-sm font-bold text-slate-700 w-32">เพิ่มเติม</p>
                  <input 
                    type="text"
                    value={editingProduct.drugLabel.additional}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      drugLabel: { ...editingProduct.drugLabel, additional: e.target.value }
                    })}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                  />
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
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">PRODUCT SETTING</h1>
        <button 
          onClick={handleCreate}
          className="flex items-center gap-2 px-6 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
        >
          <Plus className="w-4 h-4" />
          Create New Product
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-8">
          <div className="flex-1 space-y-2">
            <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Search</p>
            <div className="flex items-center">
              <input 
                type="text"
                placeholder="Product Name, Barcode"
                className="flex-1 px-4 py-2 rounded-l-lg border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent outline-none text-sm"
              />
              <button className="px-4 py-2 bg-slate-50 border border-l-0 border-slate-200 rounded-r-lg hover:bg-slate-100 transition-colors">
                <Search className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
          <div className="w-72 space-y-2">
            <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Product Type</p>
            <div className="relative">
              <select className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-400 text-sm outline-none appearance-none pr-10">
                <option>Select Product Type</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center w-20">No.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">Product Name</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Type</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Unit</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Is in Stock</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.map((product, index) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-center font-medium text-slate-500">{index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{product.name}</div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-700 font-medium">{product.type}</td>
                  <td className="px-6 py-4 text-center text-slate-700 font-medium">{product.unit}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="w-10 h-5 rounded-full bg-green-500 relative mx-auto">
                      <div className="w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 left-5.5" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => handleEdit(product)}
                      className="flex items-center gap-1 px-6 py-1.5 bg-[#00b4d8] text-white rounded-lg text-xs font-bold hover:bg-[#0096b1] transition-all mx-auto"
                    >
                      Edit 
                      <ChevronRight className="w-3 h-3" />
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
