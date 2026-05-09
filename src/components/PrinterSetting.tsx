import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Usb, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Settings2,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Save,
  Gauge,
  Maximize2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  OperationType, 
  handleFirestoreError 
} from '../firebase';

interface PrinterConfig {
  labelWidth: number;
  labelHeight: number;
  gap: number;
  speed: number;
}

const DEFAULT_CONFIG: PrinterConfig = {
  labelWidth: 40,
  labelHeight: 30,
  gap: 2,
  speed: 4
};

export default function PrinterSetting() {
  const [device, setDevice] = useState<USBDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Calibration State
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_CONFIG);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 1. Try LocalStorage for instant load
        const savedLocal = localStorage.getItem('printer_config');
        if (savedLocal) {
          setConfig(JSON.parse(savedLocal));
        }

        // 2. Fetch from Firestore for cloud sync
        const docRef = doc(db, 'settings', 'printer');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const cloudData = snap.data() as PrinterConfig;
          setConfig(cloudData);
          localStorage.setItem('printer_config', JSON.stringify(cloudData));
        }
      } catch (err) {
        console.warn("Failed to load printer config:", err);
      }
    };

    const checkDevices = async () => {
      if ('usb' in navigator) {
        const devices = await navigator.usb.getDevices();
        if (devices.length > 0) {
          setDevice(devices[0]);
          setStatus('connected');
        }
      }
    };

    loadConfig();
    checkDevices();
  }, []);

  const saveConfig = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // 1. Save to LocalStorage
      localStorage.setItem('printer_config', JSON.stringify(config));

      // 2. Save to Firestore
      const docRef = doc(db, 'settings', 'printer');
      await setDoc(docRef, {
        ...config,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/printer');
      setError("ไม่สามารถบันทึกการตั้งค่าลงฐานข้อมูลได้");
    } finally {
      setIsSaving(false);
    }
  };

  const connectPrinter = async () => {
    setError(null);
    setStatus('connecting');
    try {
      if (!('usb' in navigator)) {
        throw new Error("บราวเซอร์ของคุณไม่รองรับ WebUSB กรุณาใช้ Chrome หรือ Edge");
      }

      // Request device from user
      const selectedDevice = await navigator.usb.requestDevice({ 
        filters: [] 
      });

      setDevice(selectedDevice);
      setStatus('connected');
      
      await selectedDevice.open();
      if (selectedDevice.configuration === null) {
        await selectedDevice.selectConfiguration(1);
      }
      await selectedDevice.claimInterface(0);
      
      console.log("Connected to:", selectedDevice.productName);
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message.includes('No device selected')) {
        console.log("User cancelled device selection");
        setStatus('disconnected');
        return;
      }
      console.error("USB Connection Error:", err);
      setError(err.message || "ไม่สามารถเชื่อมต่อเครื่องพิมพ์ได้");
      setStatus('disconnected');
    }
  };

  const testPrint = async () => {
    if (!device) {
      setError("กรุณาเชื่อมต่อเครื่องพิมพ์ก่อนทำการทดสอบ (Scan for Printer)");
      // Scroll to error if needed or highlight
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      const encoder = new TextEncoder();
      // Use calibrated values
      const tsplCommand = [
        `CLS`,
        `SIZE ${config.labelWidth} mm, ${config.labelHeight} mm`,
        `GAP ${config.gap} mm, 0 mm`,
        `SPEED ${config.speed}`,
        `DIRECTION 1`,
        `REFERENCE 0,0`,
        `TEXT 50,50,"3",0,1,1,"CONNECTION OK"`,
        `PRINT 1`,
        `END`
      ].join("\r\n") + "\r\n";

      const testData = encoder.encode(tsplCommand);
      
      await device.transferOut(1, testData);
      alert("ส่งคำสั่งพิมพ์ทดสอบสำเร็จ!");
    } catch (err: any) {
      setError("พิมพ์ทดสอบไม่สำเร็จ: " + err.message);
    }
  };

  const emergencyReset = async () => {
    if (!device) {
      setError("กรุณาเชื่อมต่อเครื่องพิมพ์ก่อน (Scan for Printer)");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      const encoder = new TextEncoder();
      const resetData = encoder.encode("CLS\r\nCLS\r\nCLS\r\n");
      
      await device.transferOut(1, resetData);
      alert("ส่งคำสั่ง Emergency Reset สำเร็จ! (Buffer Cleared)");
    } catch (err: any) {
      setError("Reset ไม่สำเร็จ: " + err.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Printer Setting</h2>
          <p className="text-slate-500 font-medium">จัดการการเชื่อมต่อและการตั้งค่ากระดาษ (WebUSB Persistence)</p>
        </div>
        <div className={cn(
          "px-4 py-2 rounded-2xl flex items-center gap-2 font-bold text-sm border",
          status === 'connected' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
        )}>
          <div className={cn("w-2 h-2 rounded-full animate-pulse", status === 'connected' ? "bg-emerald-500" : "bg-slate-300")} />
          {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Connection Tool */}
          <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 space-y-8">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0">
                <Usb className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">เชื่อมต่อผ่านสาย USB</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  เชื่อมต่อเครื่องพิมพ์ Thermal Label เข้ากับคอมพิวเตอร์ของคุณ แล้วกดปุ่มเพื่อเริ่มใช้งาน WebUSB Direct Print
                </p>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-6 bg-rose-50 border-2 border-rose-100 rounded-3xl flex items-center gap-4 text-rose-600 shadow-sm"
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                  <AlertCircle className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest opacity-60">System Notice</p>
                  <p className="text-sm font-bold">{error}</p>
                </div>
              </motion.div>
            )}

            {device ? (
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Device Identified</p>
                      <p className="text-lg font-black text-slate-800">{device.productName || 'Unknown Printer'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={connectPrinter}
                    className="p-3 hover:bg-slate-200 rounded-xl transition-all text-slate-400"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase">Vendor ID</p>
                    <p className="font-mono font-bold text-slate-600">0x{device.vendorId.toString(16).padStart(4, '0')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase">Product ID</p>
                    <p className="font-mono font-bold text-slate-600">0x{device.productId.toString(16).padStart(4, '0')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={connectPrinter}
                disabled={status === 'connecting'}
                className="w-full py-8 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-95 flex flex-col items-center gap-3 disabled:bg-slate-300"
              >
                <Zap className="w-8 h-8" />
                Scan for Printer
              </button>
            )}
          </div>

          {/* Calibration Tool */}
          <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 space-y-8">
            <div className="flex flex-col lg:flex-row gap-10">
              {/* Left: Diagram */}
              <div className="lg:w-1/3 space-y-4">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Label Preview (Visual Mapping)</p>
                  
                  {/* Sticker Roll Visualization */}
                  <div className="relative flex flex-col items-center gap-1 w-full max-w-[160px]">
                    {/* Sticker 1 (Top partially cut) */}
                    <div className="w-full h-8 bg-white/40 border border-slate-200 rounded-sm" />
                    
                    {/* Buffer space above */}
                    <div className="w-full h-4 relative" />

                    {/* Main Sticker */}
                    <div 
                      className="w-full bg-white border-2 border-indigo-500 rounded-md shadow-sm flex items-center justify-center relative"
                      style={{ height: '120px' }}
                    >
                      {/* Width Line */}
                      <div className="absolute -top-6 left-0 right-0 flex items-center gap-2">
                        <div className="h-[1px] flex-1 bg-slate-300 relative">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-slate-300 rotate-45" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap">W: {config.labelWidth}mm</span>
                        <div className="h-[1px] flex-1 bg-slate-300 relative">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-slate-300 rotate-45" />
                        </div>
                      </div>

                      {/* Height Line */}
                      <div className="absolute -left-6 top-0 bottom-0 flex flex-col items-center gap-2">
                        <div className="w-[1px] flex-1 bg-slate-300 relative">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-slate-300 rotate-45" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap -rotate-90">H: {config.labelHeight}mm</span>
                        <div className="w-[1px] flex-1 bg-slate-300 relative">
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-slate-300 rotate-45" />
                        </div>
                      </div>

                      <div className="p-2 border border-slate-100 rounded text-[8px] text-slate-300 uppercase font-black text-center">
                        Print Area
                      </div>
                    </div>

                    {/* Gap Indicator (Moved to bottom) */}
                    <div className="w-full flex items-center justify-center h-4 relative">
                      <div className="absolute left-[-20px] right-[-20px] border-t border-dashed border-indigo-300" />
                      <div className="bg-indigo-500 text-[8px] text-white px-1 rounded absolute -right-8 flex items-center gap-1 active:scale-110 transition-transform">
                        <RefreshCw className="w-2 h-2" />
                        GAP: {config.gap}mm
                      </div>
                    </div>

                    {/* Sticker 3 (Bottom partially cut) */}
                    <div className="w-full h-12 bg-white/40 border border-slate-200 rounded-sm" />
                  </div>

                  <div className="mt-8 flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full">
                    <Gauge className={cn("w-3 h-3 text-indigo-500", config.speed > 5 ? "animate-pulse" : "")} />
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">Speed: {config.speed} (Standard)</span>
                  </div>
                </div>
              </div>

              {/* Right: Controls */}
              <div className="flex-1 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shrink-0">
                      <Settings2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-slate-900">Calibration & Paper Size</h3>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        ตั้งค่าขนาดสติ๊กเกอร์และความเร็วเพื่อให้พิมพ์ออกมาตรงตำแหน่งและชัดเจนที่สุด
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={saveConfig}
                    disabled={isSaving}
                    className={cn(
                      "px-6 py-3 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center gap-2",
                      copied ? "bg-emerald-500 text-white" : "bg-slate-900 text-white hover:bg-black"
                    )}
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : copied ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {copied ? "Saved" : "Save Config"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Label Width (mm)</label>
                    <div className="relative">
                      <Maximize2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="number"
                        value={config.labelWidth}
                        onChange={(e) => setConfig({...config, labelWidth: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Label Height (mm)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 transform rotate-90">
                        <Maximize2 className="w-4 h-4" />
                      </div>
                      <input 
                        type="number"
                        value={config.labelHeight}
                        onChange={(e) => setConfig({...config, labelHeight: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gap Size (mm)</label>
                    <div className="relative">
                      <RefreshCw className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="number"
                        value={config.gap}
                        onChange={(e) => setConfig({...config, gap: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Printing Speed</label>
                    <div className="relative">
                      <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="number"
                        min="1"
                        max="10"
                        value={config.speed}
                        onChange={(e) => setConfig({...config, speed: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button 
                    onClick={testPrint}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                  >
                    Test Print
                  </button>
                  <button 
                    onClick={emergencyReset}
                    className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <ShieldAlert className="w-5 h-5" />
                    Emergency Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Safety & Info */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2rem] text-white space-y-6 shadow-xl">
            <ShieldCheck className="w-10 h-10 text-cyan-400" />
            <div className="space-y-2">
              <h4 className="font-bold text-lg">Secure WebUSB</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                ระบบจะขออนุญาตใช้งาน USB ทุกครั้งที่คุณต่อสายใหม่ เพื่อความปลอดภัยของข้อมูล
              </p>
            </div>
            <ul className="space-y-3">
              {[
                "Direct Hardware Access",
                "Low Latency Printing",
                "Cloud-Sync Configuration",
                "LocalStorage Resilience"
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] space-y-2">
            <div className="flex items-center gap-2 text-amber-600 font-bold mb-2">
              <Settings2 className="w-5 h-5" />
              <span>Config Guide</span>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
              หากพิมพ์แล้วตัวอักษรเพี้ยน กรุณาตรวจสอบว่า Driver ในเครื่องไม่ได้แย่งการใช้งาน (Claiming Interface) ของบราวเซอร์
            </p>
            <div className="pt-2 text-[10px] text-amber-600/70 font-bold uppercase italic">
              * ข้อมูลจะถูกบันทึกที่ LocalStorage และ Sync ลง Cloud ทานอัตโนมัติ
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

