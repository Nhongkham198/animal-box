import React, { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export default function UsageSetting() {
  const [formData, setFormData] = useState({
    companyName: '',
    taxId: '',
    phone: '',
    address: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
    isVatRegistered: false,
    enableStockCounting: false
  });

  const handleSave = () => {
    console.log('Saving usage settings:', formData);
    // In a real app, this would save to Firestore
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">ตั้งค่าการใช้งาน</h1>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-8 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden max-w-5xl">
        <div className="p-12 space-y-12">
          
          {/* Section 1: Organization Details */}
          <div className="space-y-10">
            <h2 className="text-xl font-black text-slate-800">1. รายละเอียดองค์กรเพื่อออกใบเสร็จรับเงิน</h2>
            
            <div className="space-y-6 max-w-3xl">
              <div className="grid grid-cols-4 items-center gap-6">
                <label className="text-sm font-bold text-slate-400">ชื่อบริษัท</label>
                <input 
                  type="text"
                  placeholder="กรอกชื่อบริษัท"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="col-span-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-700 placeholder:text-slate-300 transition-all"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-6">
                <label className="text-sm font-bold text-slate-400">เลขที่ผู้เสียภาษี</label>
                <input 
                  type="text"
                  placeholder="กรอกเลขที่ผู้เสียภาษี"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="col-span-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-700 placeholder:text-slate-300 transition-all"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-6">
                <label className="text-sm font-bold text-slate-400">โทรศัพท์</label>
                <input 
                  type="text"
                  placeholder="กรอกเบอร์โทรศัพท์"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="col-span-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-700 placeholder:text-slate-300 transition-all"
                />
              </div>

              <div className="pt-6 space-y-8">
                <h3 className="text-xl font-black text-slate-800">ที่อยู่</h3>
                
                <div className="grid grid-cols-4 items-center gap-6">
                  <label className="text-sm font-bold text-slate-400">ที่อยู่</label>
                  <input 
                    type="text"
                    placeholder="กรอกที่อยู่"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="col-span-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-700 placeholder:text-slate-300 transition-all"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-6">
                  <label className="text-sm font-bold text-slate-400">แขวง/ตำบล</label>
                  <input 
                    type="text"
                    placeholder="กรอกแขวง/ตำบล"
                    value={formData.subDistrict}
                    onChange={(e) => setFormData({ ...formData, subDistrict: e.target.value })}
                    className="col-span-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-700 placeholder:text-slate-300 transition-all"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-6">
                  <label className="text-sm font-bold text-slate-400">เขต/อำเภอ</label>
                  <input 
                    type="text"
                    placeholder="กรอกเขต/อำเภอ"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="col-span-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-700 placeholder:text-slate-300 transition-all"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-6">
                  <label className="text-sm font-bold text-slate-400">จังหวัด</label>
                  <input 
                    type="text"
                    placeholder="กรอกจังหวัด"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="col-span-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-700 placeholder:text-slate-300 transition-all"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-6">
                  <label className="text-sm font-bold text-slate-400">รหัสไปรษณีย์</label>
                  <input 
                    type="text"
                    placeholder="กรอกรหัสไปรษณีย์"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="col-span-3 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-700 placeholder:text-slate-300 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-6 pt-6">
                <label className="text-sm font-bold text-slate-400">ภาษีมูลค่าเพิ่ม</label>
                <div className="col-span-3 flex items-center gap-3">
                  <label 
                    onClick={() => setFormData({ ...formData, isVatRegistered: !formData.isVatRegistered })}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all",
                      formData.isVatRegistered ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-200 bg-white"
                    )}>
                      {formData.isVatRegistered && <Check className="w-5 h-5 text-white stroke-[4]" />}
                    </div>
                    <span className="text-base font-bold text-slate-600">จดทะเบียนภาษีมูลค่าเพิ่ม</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Section 2: Stock Counting */}
          <div className="space-y-8">
            <h2 className="text-xl font-black text-slate-800">2. ตั้งค่าการนับ Stock</h2>
            
            <div className="flex items-start gap-12 max-w-3xl">
              <div className="flex-1 space-y-2">
                <p className="text-base font-bold text-slate-400 leading-relaxed">
                  เปิดเพื่อใช้งานการนับ Stock โดยไม่สามารถสร้างรายการได้ถ้าจำนวนในคลังสินค้ามีจำนวนไม่เพียงพอ
                </p>
              </div>
              <div 
                onClick={() => setFormData({ ...formData, enableStockCounting: !formData.enableStockCounting })}
                className={cn(
                  "w-14 h-7 rounded-full relative cursor-pointer transition-all flex-shrink-0",
                  formData.enableStockCounting ? "bg-[#00b4d8]" : "bg-slate-200"
                )}
              >
                <div className={cn(
                  "w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-md",
                  formData.enableStockCounting ? "left-8" : "left-1"
                )} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
