import React, { useState, useEffect } from 'react';
import { Save, Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export default function UsageSetting() {
  const [formData, setFormData] = useState({
    roomPriceSmall: '',
    roomPriceLarge: '',
    roomPriceCage: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load settings on mount
  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'usage_settings');
        const snap = await getDoc(docRef);
        if (snap.exists() && active) {
          const data = snap.data();
          setFormData({
            roomPriceSmall: data.roomPriceSmall !== undefined ? String(data.roomPriceSmall) : '',
            roomPriceLarge: data.roomPriceLarge !== undefined ? String(data.roomPriceLarge) : '',
            roomPriceCage: data.roomPriceCage !== undefined ? String(data.roomPriceCage) : ''
          });
        }
      } catch (err) {
        console.warn("Failed to load room prices settings:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const docRef = doc(db, 'settings', 'usage_settings');
      await setDoc(docRef, {
        roomPriceSmall: formData.roomPriceSmall !== '' ? Number(formData.roomPriceSmall) : '',
        roomPriceLarge: formData.roomPriceLarge !== '' ? Number(formData.roomPriceLarge) : '',
        roomPriceCage: formData.roomPriceCage !== '' ? Number(formData.roomPriceCage) : '',
        updatedAt: serverTimestamp()
      }, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/usage_settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-[#00b4d8] animate-spin" />
        <p className="text-sm text-slate-500 font-bold">กำลังโหลดการตั้งค่าราคาห้อง...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">ตั้งค่าราคาห้องพักสัตว์เลี้ยง</h1>
          <p className="text-xs text-slate-400 font-bold mt-1">กำหนดอัตราค่าบริการรายวันสำหรับการ Admit ทำการรักษา</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "flex items-center gap-2 px-8 py-2.5 text-white rounded-lg font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50",
            saveSuccess 
              ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100" 
              : "bg-[#00b4d8] hover:bg-[#0096b1] shadow-cyan-100"
          )}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? 'กำลังบันทึก...' : saveSuccess ? 'บันทึกสำเร็จ' : 'บันทึกข้อมูล'}
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden max-w-5xl">
        <div className="p-12 space-y-8">
          
          <div className="space-y-3">
            <h2 className="text-lg font-black text-slate-850">ราคาห้องพักสัตว์เลี้ยงรายวัน (Daily Boarding Room Prices)</h2>
            <p className="text-xs font-bold text-slate-400 leading-relaxed max-w-3xl">
              ระบุราคาห้องพักสัตว์เลี้ยงรายวัน โดยราคาเหล่านี้จะถูกนำไปแสดงที่ปุ่มเลือกขนาดห้องในระบบ Admit ทำการรักษา (IPD Record)
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl pt-2">
            <div className="space-y-3">
              <label className="text-sm font-extrabold text-slate-500">ราคาห้องเล็ก (฿ / วัน)</label>
              <div className="relative shadow-sm rounded-2xl">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-[#00b4d8] text-lg">฿</span>
                <input 
                  type="number"
                  min="0"
                  placeholder="ระบุราคาตัวเลขห้องเล็ก"
                  value={formData.roomPriceSmall}
                  onChange={(e) => setFormData({ ...formData, roomPriceSmall: e.target.value })}
                  className="w-full pl-11 pr-5 py-4 rounded-2xl border border-slate-200 focus:border-[#00b4d8] focus:ring-2 focus:ring-cyan-50 bg-white outline-none font-bold text-slate-700 placeholder:text-slate-350 transition-all text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-extrabold text-slate-500">ราคาห้องใหญ่ (฿ / วัน)</label>
              <div className="relative shadow-sm rounded-2xl">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-[#00b4d8] text-lg">฿</span>
                <input 
                  type="number"
                  min="0"
                  placeholder="ระบุราคาตัวเลขห้องใหญ่"
                  value={formData.roomPriceLarge}
                  onChange={(e) => setFormData({ ...formData, roomPriceLarge: e.target.value })}
                  className="w-full pl-11 pr-5 py-4 rounded-2xl border border-slate-200 focus:border-[#00b4d8] focus:ring-2 focus:ring-cyan-50 bg-white outline-none font-bold text-slate-700 placeholder:text-slate-355 transition-all text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-extrabold text-slate-500">ราคากรง (฿ / วัน)</label>
              <div className="relative shadow-sm rounded-2xl">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-[#00b4d8] text-lg">฿</span>
                <input 
                  type="number"
                  min="0"
                  placeholder="ระบุราคาตัวเลขกรง"
                  value={formData.roomPriceCage}
                  onChange={(e) => setFormData({ ...formData, roomPriceCage: e.target.value })}
                  className="w-full pl-11 pr-5 py-4 rounded-2xl border border-slate-200 focus:border-[#00b4d8] focus:ring-2 focus:ring-cyan-50 bg-white outline-none font-bold text-slate-700 placeholder:text-slate-355 transition-all text-sm"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
