import React, { useState, useRef } from 'react';
import { 
  Calendar, 
  User, 
  Phone, 
  PawPrint, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Camera,
  X,
  FileImage,
  ArrowLeft
} from 'lucide-react';
import { 
  db, 
  collection, 
  addDoc, 
  serverTimestamp,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  query,
  where,
  getDocs,
  limit
} from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { Search, Loader2, Info } from 'lucide-react';

interface CustomerBookingFormProps {
  onSuccess?: () => void;
  onBack?: () => void;
}

export default function CustomerBookingForm({ onSuccess, onBack }: CustomerBookingFormProps) {
  const [formData, setFormData] = useState({
    ownerName: '',
    ownerPhone: '',
    petName: '',
    petSpecies: 'Dog',
    requestedDate: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const [vaccineImage, setVaccineImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'none' | 'found' | 'not_found'>('none');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Logic to search for existing client and pet
  const searchExistingClient = async (phone: string, petName: string) => {
    if (!phone || !petName || phone.length < 9) return;

    setIsSearching(true);
    setSearchStatus('none');

    try {
      // 1. Search for Owner by phone
      const ownersRef = collection(db, 'owners');
      const qOwner = query(ownersRef, where('phone', '==', phone), limit(1));
      const ownerSnap = await getDocs(qOwner);

      if (!ownerSnap.empty) {
        const ownerData = ownerSnap.docs[0].data();
        const ownerId = ownerSnap.docs[0].id;
        
        // Update owner name if it's empty or hasn't been manually changed significantly
        setFormData(prev => ({ ...prev, ownerName: ownerData.name }));

        // 2. Search for Patient by name and ownerId
        const patientsRef = collection(db, 'patients');
        const qPet = query(
          patientsRef, 
          where('ownerIds', 'array-contains', ownerId), 
          where('name', '==', petName),
          limit(1)
        );
        const petSnap = await getDocs(qPet);

        if (!petSnap.empty) {
          const petData = petSnap.docs[0].data();
          setFormData(prev => ({ 
            ...prev, 
            petSpecies: petData.species || 'Dog'
          }));
          setSearchStatus('found');
        } else {
          setSearchStatus('not_found');
        }
      } else {
        setSearchStatus('not_found');
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Trigger search when phone or pet name changes
  const handlePhoneBlur = () => {
    if (formData.ownerPhone && formData.petName) {
      searchExistingClient(formData.ownerPhone, formData.petName);
    }
  };

  const handlePetNameBlur = () => {
    if (formData.ownerPhone && formData.petName) {
      searchExistingClient(formData.ownerPhone, formData.petName);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVaccineImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaccineImage) {
      setError("กรุณาแนบรูปภาพสมุดวัคซีนเพื่อดำเนินการต่อ");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Upload Image to Firebase Storage
      const storageRef = ref(storage, `vaccine_books/${Date.now()}_${vaccineImage.name}`);
      const snapshot = await uploadBytes(storageRef, vaccineImage);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      // 2. Save Booking Request to Firestore
      await addDoc(collection(db, 'public_bookings'), {
        ...formData,
        vaccineImage: downloadUrl,
        serviceType: 'general',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Booking error:", err);
      setError("เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto bg-white rounded-[3rem] p-10 text-center shadow-2xl border border-slate-100"
      >
        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 text-emerald-500 shadow-inner">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">ส่งคำขอจองสำเร็จ!</h2>
        <p className="text-slate-500 font-medium mb-8">
          เจ้าหน้าที่ได้รับข้อมูลของคุณแล้ว และจะติดต่อกลับผ่านเบอร์โทรศัพท์ที่ระบุไว้เพื่อยืนยันนัดหมาย
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
        >
          ตกลง
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden"
      >
        <div className="p-8 bg-indigo-600 text-white relative">
          {onBack && (
            <button 
              onClick={onBack}
              className="absolute left-6 top-8 p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="text-center">
            <PawPrint className="w-12 h-12 mx-auto mb-4 opacity-80" />
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">General Request</h1>
            <p className="text-indigo-100 font-medium">กรอกข้อมูลเพื่อขอนัดหมายเข้ารับบริการ</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 md:col-span-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อสัตว์เลี้ยง *</label>
              <div className="relative">
                <PawPrint className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                   required
                   placeholder="เช่น ถุงทอง"
                   className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                   value={formData.petName}
                   onChange={(e) => setFormData({...formData, petName: e.target.value})}
                   onBlur={handlePetNameBlur}
                 />
                 {isSearching && (
                   <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
                 )}
               </div>
             </div>

             <div className="space-y-2 col-span-2 md:col-span-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">สายพันธุ์ *</label>
               <select 
                 className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold appearance-none"
                 value={formData.petSpecies}
                 onChange={(e) => setFormData({...formData, petSpecies: e.target.value})}
               >
                 <option value="Dog">สุนัข (Dog)</option>
                 <option value="Cat">แมว (Cat)</option>
                 <option value="Bird">นก (Bird)</option>
                 <option value="Rabbit">กระต่าย (Rabbit)</option>
                 <option value="Exotic">Exotic Pet</option>
               </select>
             </div>

             <div className="space-y-2 col-span-2 md:col-span-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">เบอร์โทรศัพท์ *</label>
               <div className="relative">
                 <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    required
                    type="tel"
                    placeholder="08X-XXX-XXXX"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                    value={formData.ownerPhone}
                    onChange={(e) => setFormData({...formData, ownerPhone: e.target.value})}
                    onBlur={handlePhoneBlur}
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
                  )}
               </div>
             </div>

             <div className="space-y-2 col-span-2 md:col-span-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อเจ้าของ *</label>
               <div className="relative">
                 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                 <input 
                   required
                   placeholder="เช่น นายใจดี รักสัตว์"
                   className={cn(
                     "w-full border rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold",
                     searchStatus === 'found' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100"
                   )}
                   value={formData.ownerName}
                   onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                 />
                 {searchStatus === 'found' && (
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase">
                     <CheckCircle2 className="w-3 h-3" />
                     Matched
                   </div>
                 )}
               </div>
             </div>

             {searchStatus === 'not_found' && formData.ownerPhone.length >= 9 && formData.petName && (
               <div className="col-span-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                 <Info className="w-3 h-3" />
                 ไม่พบข้อมูลการลงทะเบียนเดิม กรุณากรอกข้อมูลเพื่อลงทะเบียนใหม่
               </div>
             )}

            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">วันที่ต้องการนัด *</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  required
                  type="date"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                  value={formData.requestedDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setFormData({...formData, requestedDate: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">รูปถ่ายสมุดวัคซีน (บังคับ) *</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative h-48 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all overflow-hidden",
                  vaccineImage ? "border-indigo-400 bg-indigo-50/30" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                )}
              >
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                
                {previewUrl ? (
                  <div className="absolute inset-0 group">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-2 font-bold">
                      <Camera className="w-6 h-6" />
                      เปลี่ยนรูปใหม่
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-600 tracking-tight">คลิกเพื่ออัปโหลดรูปสมุดวัคซีน</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Required Attachment</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">รายละเอียดเพิ่มเติม (ถ้ามี)</label>
              <textarea 
                placeholder="ระบุอาการเบื้องต้น หรือ สิ่งที่ต้องการปรึกษา..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold resize-none"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center justify-center gap-3",
              isSubmitting ? "bg-slate-300 text-slate-500" : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200 active:scale-95"
            )}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                กำลังส่งข้อมูล...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6" />
                ส่งคำขอนัดหมาย
              </>
            )}
          </button>
        </form>
      </motion.div>
      <p className="mt-8 text-center text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em]">Powered by Animal Box Clinic Hub</p>
    </div>
  );
}
