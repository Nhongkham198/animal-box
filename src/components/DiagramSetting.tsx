import React, { useState, useEffect, useRef } from 'react';
import { 
  Dog, 
  Cat, 
  Upload, 
  RotateCcw, 
  Save, 
  CheckCircle2, 
  Image as ImageIcon,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  handleFirestoreError 
} from '../firebase';

interface DiagramSettingsData {
  dogImage?: string;
  catImage?: string;
  defaultColor?: string;
  showLRMarking?: boolean;
}

const DEFAULT_SETTINGS: DiagramSettingsData = {
  dogImage: '',
  catImage: '',
  defaultColor: '#ef4444',
  showLRMarking: true,
};

export default function DiagramSetting() {
  const [settings, setSettings] = useState<DiagramSettingsData>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dogInputRef = useRef<HTMLInputElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // 1. Load from localStorage
        const savedLocal = localStorage.getItem('anatomy_diagram_settings');
        if (savedLocal) {
          setSettings(JSON.parse(savedLocal));
        }

        // 2. Fetch from Firestore
        const docRef = doc(db, 'settings', 'diagram');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const cloudData = snap.data() as DiagramSettingsData;
          setSettings(cloudData);
          localStorage.setItem('anatomy_diagram_settings', JSON.stringify(cloudData));
        }
      } catch (err) {
        console.warn('Could not load diagram settings from Firestore, using local fallback:', err);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async (updatedSettings = settings) => {
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // Save locally
      localStorage.setItem('anatomy_diagram_settings', JSON.stringify(updatedSettings));

      // Save to Firestore
      const docRef = doc(db, 'settings', 'diagram');
      await setDoc(docRef, {
        ...updatedSettings,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setSuccessMessage('บันทึกการตั้งค่าภาพกายวิภาคเรียบร้อยแล้ว');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      console.error('Error saving diagram settings:', err);
      handleFirestoreError(err, 'write' as any, 'settings/diagram');
      setErrorMessage('ไม่สามารถบันทึกไปยังคลาวด์ได้ (บันทึกไว้ในเครื่องเรียบร้อย)');
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, petType: 'dog' | 'cat') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const updated = {
          ...settings,
          [petType === 'dog' ? 'dogImage' : 'catImage']: dataUrl
        };
        setSettings(updated);
        handleSave(updated);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetImage = (petType: 'dog' | 'cat') => {
    const updated = {
      ...settings,
      [petType === 'dog' ? 'dogImage' : 'catImage']: ''
    };
    setSettings(updated);
    handleSave(updated);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white flex items-center justify-center shadow-md">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">ตั้งค่าภาพกายวิภาคสัตว์ (Anatomy Diagram)</h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              จัดการรูปภาพเค้าร่างตัวสัตว์สำหรับใช้ในระบบลงบันทึกบาดแผล (Wound Diagram) ใน OPD
            </p>
          </div>
        </div>

        <button
          onClick={() => handleSave()}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#00b4d8] text-white rounded-xl font-bold text-sm hover:bg-[#0096c7] active:scale-95 transition-all shadow-md shadow-sky-500/20 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span>
        </button>
      </div>

      {/* Success/Error Alerts */}
      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm font-bold shadow-xs"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      {errorMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm font-bold shadow-xs"
        >
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{errorMessage}</span>
        </motion.div>
      )}

      {/* Main Grid for Dog & Cat Images */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dog Diagram Setting */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Dog className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">ภาพกายวิภาคสุนัข (Dog Diagram)</h3>
                <p className="text-[11px] text-slate-400 font-medium">ภาพเค้าร่างที่ใช้เมื่อคนไข้เป็นสุนัข</p>
              </div>
            </div>
            {settings.dogImage ? (
              <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase">
                Custom Upload
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">
                Default Vector
              </span>
            )}
          </div>

          {/* Image Preview Box */}
          <div className="relative aspect-square max-w-[280px] mx-auto bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-4 overflow-hidden group">
            {settings.dogImage ? (
              <img 
                src={settings.dogImage} 
                alt="Dog Diagram" 
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="text-center space-y-2 p-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
                  <Dog className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-600">รูปภาพกายวิภาคสุนัขมาตรฐาน</p>
                <p className="text-[10px] text-slate-400">ภาพเค้าร่างเวกเตอร์มาตรฐานแบบ L/R</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <input 
              ref={dogInputRef} 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => handleImageUpload(e, 'dog')} 
            />
            <button
              type="button"
              onClick={() => dogInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs transition-all border border-indigo-200/60"
            >
              <Upload className="w-4 h-4" />
              <span>อัปโหลดรูปภาพใหม่</span>
            </button>

            {settings.dogImage && (
              <button
                type="button"
                onClick={() => handleResetImage('dog')}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all border border-rose-200/60"
                title="กลับไปใช้รูปตั้งต้น"
              >
                <RotateCcw className="w-4 h-4" />
                <span>ตั้งต้น</span>
              </button>
            )}
          </div>
        </div>

        {/* Cat Diagram Setting */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Cat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">ภาพกายวิภาคแมว (Cat Diagram)</h3>
                <p className="text-[11px] text-slate-400 font-medium">ภาพเค้าร่างที่ใช้เมื่อคนไข้เป็นแมว หรือสัตว์อื่น</p>
              </div>
            </div>
            {settings.catImage ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase">
                Custom Upload
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">
                Default Vector
              </span>
            )}
          </div>

          {/* Image Preview Box */}
          <div className="relative aspect-square max-w-[280px] mx-auto bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-4 overflow-hidden group">
            {settings.catImage ? (
              <img 
                src={settings.catImage} 
                alt="Cat Diagram" 
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="text-center space-y-2 p-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <Cat className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-600">รูปภาพกายวิภาคแมวมาตรฐาน</p>
                <p className="text-[10px] text-slate-400">ภาพเค้าร่างเวกเตอร์มาตรฐานแบบ L/R</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <input 
              ref={catInputRef} 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => handleImageUpload(e, 'cat')} 
            />
            <button
              type="button"
              onClick={() => catInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs transition-all border border-emerald-200/60"
            >
              <Upload className="w-4 h-4" />
              <span>อัปโหลดรูปภาพใหม่</span>
            </button>

            {settings.catImage && (
              <button
                type="button"
                onClick={() => handleResetImage('cat')}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all border border-rose-200/60"
                title="กลับไปใช้รูปตั้งต้น"
              >
                <RotateCcw className="w-4 h-4" />
                <span>ตั้งต้น</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Additional Drawing Options */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Sliders className="w-5 h-5 text-[#00b4d8]" />
          <div>
            <h3 className="text-sm font-black text-slate-800">ตัวเลือกเพิ่มเติมสำหรับการวาดแผล (Drawing Preferences)</h3>
            <p className="text-[11px] text-slate-400 font-medium">ตั้งค่าสีเริ่มต้นและสัญลักษณ์การระบุตำแหน่ง</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Default Color Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">สีปากกาวาดแผลเริ่มต้น (Default Wound Color)</label>
            <div className="flex items-center gap-2">
              {[
                { hex: '#ef4444', label: 'แดงสด' },
                { hex: '#f97316', label: 'ส้ม' },
                { hex: '#3b82f6', label: 'น้ำเงิน' },
                { hex: '#10b981', label: 'เขียว' },
                { hex: '#8b5cf6', label: 'ม่วง' }
              ].map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => {
                    const updated = { ...settings, defaultColor: c.hex };
                    setSettings(updated);
                    handleSave(updated);
                  }}
                  className={`w-7 h-7 rounded-full border-2 transition-transform flex items-center justify-center ${
                    settings.defaultColor === c.hex ? 'scale-110 border-slate-900 shadow-md' : 'border-white'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Information Tip */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#00b4d8] shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              เมื่อทำการอัปโหลดรูปภาพใหม่ ระบบในหน้า OPD จะดึงรูปภาพกายวิภาคที่คุณตั้งค่าไว้ไปใช้วาดวงกลมตำแหน่งบาดแผลโดยอัตโนมัติ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
