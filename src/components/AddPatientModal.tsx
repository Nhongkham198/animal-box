import { useState, useEffect } from 'react';
import { 
  db, 
  auth,
  collection, 
  addDoc, 
  serverTimestamp,
  handleFirestoreError,
  OperationType,
  onSnapshot,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  limit,
  orderBy,
  getDocsFromServer
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { 
  X, 
  PawPrint, 
  User, 
  Phone, 
  Calendar, 
  Stethoscope, 
  Syringe,
  Plus,
  Trash2,
  Save,
  Loader2,
  Edit2,
  Check,
  PlusCircle,
  ChevronDown,
  Search,
  Mail,
  MapPin,
  CreditCard,
  Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInMonths, differenceInYears } from 'date-fns';
import { cn } from '../lib/utils';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  editPatientId?: string | null;
}

export default function AddPatientModal({ isOpen, onClose, editPatientId }: AddPatientModalProps) {
  const throwError = useAsyncError();
  const { user, isAuthReady, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (phone: string | undefined | null) => {
    if (!phone) return '';
    const cleaned = phone.trim().replace(/\D/g, '');
    if (cleaned.length > 0 && !cleaned.startsWith('0')) {
      return '0' + cleaned;
    }
    return phone;
  };

  const [formData, setFormData] = useState({
    hn: '',
    name: '',
    species: 'Dog',
    breed: '',
    gender: 'Male' as 'Male' | 'Female',
    birthDate: '',
    birthMonth: new Date().getMonth() + 1,
    birthYear: new Date().getFullYear(),
    useExactDate: true,
    photoURL: '',
  });

  useEffect(() => {
    if (isOpen && isAuthReady && user && !editPatientId) {
      setFormData({
        hn: '',
        name: '',
        species: 'Dog',
        breed: '',
        gender: 'Male',
        birthDate: '',
        birthMonth: new Date().getMonth() + 1,
        birthYear: new Date().getFullYear(),
        useExactDate: true,
        photoURL: '',
      });
      setOwners([{ localId: crypto.randomUUID(), name: '', phone: '' }]);
      setMedicalHistory([]);
      setVaccineRecords([]);
      generateHN();
    }
  }, [isOpen, isAuthReady, user, editPatientId]);

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!editPatientId || !isOpen) return;
      try {
        const patientDoc = await getDoc(doc(db, 'patients', editPatientId));
        if (patientDoc.exists()) {
          const data = patientDoc.data();
          const birthDate = data.birthDate ? new Date(data.birthDate) : null;
          
          setFormData({
            hn: data.hn || '',
            name: data.name || '',
            species: data.species || 'Dog',
            breed: data.breed || '',
            gender: data.gender || 'Male',
            birthDate: birthDate ? format(birthDate, 'yyyy-MM-dd') : '',
            birthMonth: birthDate ? birthDate.getMonth() + 1 : new Date().getMonth() + 1,
            birthYear: birthDate ? birthDate.getFullYear() : new Date().getFullYear(),
            useExactDate: !!data.birthDate,
            photoURL: data.photoURL || '',
          });

          // Fetch owners
          if (data.ownerIds && data.ownerIds.length > 0) {
            const ownerPromises = data.ownerIds.map((id: string) => getDoc(doc(db, 'owners', id)));
            const ownerSnaps = await Promise.all(ownerPromises);
            const ownerData = ownerSnaps
              .filter(snap => snap.exists())
              .map(snap => ({ localId: crypto.randomUUID(), id: snap.id, ...snap.data() } as any));
            setOwners(ownerData.length > 0 ? ownerData : [{ localId: crypto.randomUUID(), name: '', phone: '' }]);
          }

          setMedicalHistory(data.medicalHistory?.map((h: any) => ({ ...h, localId: crypto.randomUUID(), date: format(new Date(h.date.toDate ? h.date.toDate() : h.date), 'yyyy-MM-dd') })) || []);
          setVaccineRecords(data.vaccineRecords?.map((v: any) => ({ 
            ...v, 
            localId: crypto.randomUUID(), 
            date: format(new Date(v.date.toDate ? v.date.toDate() : v.date), 'yyyy-MM-dd'),
            nextDate: v.nextDate ? format(new Date(v.nextDate.toDate ? v.nextDate.toDate() : v.nextDate), 'yyyy-MM-dd') : ''
          })) || []);
        }
      } catch (err) {
        console.warn("Patient data fetch warning (check permissions):", err);
      }
    };

    fetchPatientData();
  }, [editPatientId, isOpen]);

  const generateHN = async () => {
    const today = new Date();
    const day = format(today, 'dd');
    const month = format(today, 'MM');
    const yearBE = today.getFullYear() + 543;
    const datePrefix = `${month}${day}${yearBE}`;
    
    try {
      // To "count from the previous number" globally, we find the maximum sequence number across patients.
      // We use getDocsFromServer to ensure we have the latest data and avoid cache issues.
      const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocsFromServer(q);
      
      let nextNum = 1;
      if (!snap.empty) {
        // Extract all sequence numbers from existing HNs in the recent records
        const nums = snap.docs.map(doc => {
          const hn = doc.data().hn || '';
          const parts = hn.split('_');
          if (parts.length > 1) {
            const num = parseInt(parts[1]);
            return isNaN(num) ? 0 : num;
          }
          return 0;
        });
        
        const maxSeq = Math.max(...nums, 0);
        
        if (maxSeq > 0) {
          nextNum = maxSeq + 1;
        } else {
          // Fallback: if no _N format found in recent docs, use the total count
          // This handles the transition to the new format or very first patients
          const allSnap = await getDocsFromServer(collection(db, 'patients'));
          nextNum = allSnap.size + 1;
        }
      }
      
      setFormData(prev => ({ ...prev, hn: `${datePrefix}_${nextNum}` }));
    } catch (err) {
      console.warn("Error generating HN (non-critical):", err);
      // Fallback to a timestamp if query fails
      setFormData(prev => ({ ...prev, hn: `${datePrefix}_${Date.now().toString().slice(-4)}` }));
    }
  };

  const handlePetPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const resized = await resizeImage(base64, 64, 64);
        setFormData(prev => ({ ...prev, photoURL: resized }));
      };
      reader.readAsDataURL(file);
    }
  };

  const resizeImage = (base64Str: string, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const [owners, setOwners] = useState<{ localId: string; id?: string; name: string; phone: string; email?: string; address?: string; citizenId?: string; photoURL?: string }[]>([
    { localId: crypto.randomUUID(), name: '', phone: '' }
  ]);
  const [ownerSearch, setOwnerSearch] = useState<{ index: number; query: string; results: any[] }>({ index: -1, query: '', results: [] });
  const [isSearching, setIsSearching] = useState(false);

  const [speciesList, setSpeciesList] = useState<string[]>(['Dog', 'Cat', 'Bird', 'Rabbit', 'Other']);
  const [isEditingSpecies, setIsEditingSpecies] = useState(false);
  const [newSpeciesInput, setNewSpeciesInput] = useState('');

  useEffect(() => {
    const fetchSpecies = async () => {
      if (!isAuthReady || !user) return;
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'pet_species'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.values) {
            const uniqueValues = Array.from(new Set(data.values as string[]));
            setSpeciesList(uniqueValues);
            if (!formData.species && uniqueValues.length > 0) {
              setFormData(prev => ({ ...prev, species: uniqueValues[0] }));
            }
          }
        } else if (isAdmin) {
          await setDoc(doc(db, 'settings', 'pet_species'), {
            values: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'],
            updatedAt: serverTimestamp()
          });
          setSpeciesList(['Dog', 'Cat', 'Bird', 'Rabbit', 'Other']);
        }
      } catch (err) {
        console.warn("Error fetching species list (non-critical):", err);
      }
    };

    if (isOpen && isAuthReady && user) {
      fetchSpecies();
    }
  }, [isOpen, isAuthReady, user, isAdmin]);

  const handleSaveSpeciesList = async () => {
    try {
      await setDoc(doc(db, 'settings', 'pet_species'), {
        values: speciesList,
        updatedAt: serverTimestamp()
      });
      setIsEditingSpecies(false);
    } catch (err) {
      console.error("Error saving species list:", err);
    }
  };

  const handleAddSpecies = () => {
    if (newSpeciesInput.trim() && !speciesList.includes(newSpeciesInput.trim())) {
      setSpeciesList([...speciesList, newSpeciesInput.trim()]);
      setNewSpeciesInput('');
    }
  };

  const handleRemoveSpecies = (speciesToRemove: string) => {
    setSpeciesList(speciesList.filter(s => s !== speciesToRemove));
  };

  const [medicalHistory, setMedicalHistory] = useState<{ localId: string; date: string; diagnosis: string; treatment: string }[]>([]);
  const [vaccineRecords, setVaccineRecords] = useState<{ localId: string; name: string; date: string; nextDate: string }[]>([]);

  const calculateAge = (birthDate: string, month?: number, year?: number, useExact?: boolean) => {
    let date: Date;
    if (useExact && birthDate) {
      date = new Date(birthDate);
    } else if (!useExact && month && year) {
      date = new Date(year, month - 1, 1);
    } else {
      return 'N/A';
    }

    const years = differenceInYears(new Date(), date);
    const months = differenceInMonths(new Date(), date) % 12;
    
    if (years > 0) {
      return `${years}y ${months}m`;
    }
    return `${months}m`;
  };

  const handleAddHistory = () => {
    setMedicalHistory([...medicalHistory, { localId: crypto.randomUUID(), date: format(new Date(), 'yyyy-MM-dd'), diagnosis: '', treatment: '' }]);
  };

  const handleAddVaccine = () => {
    setVaccineRecords([...vaccineRecords, { localId: crypto.randomUUID(), name: '', date: format(new Date(), 'yyyy-MM-dd'), nextDate: '' }]);
  };

  const handleSearchOwner = async (index: number, phone: string) => {
    const newOwners = [...owners];
    newOwners[index].phone = phone;
    setOwners(newOwners);

    if (phone.length >= 3) {
      setIsSearching(true);
      try {
        const q = query(collection(db, 'owners'), where('phone', '>=', phone), where('phone', '<=', phone + '\uf8ff'), limit(5));
        const querySnapshot = await getDocs(q);
        const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOwnerSearch({ index, query: phone, results });
      } catch (err) {
        console.warn("Owner search warning (check permissions):", err);
      } finally {
        setIsSearching(false);
      }
    } else {
      setOwnerSearch({ index: -1, query: '', results: [] });
    }
  };

  const selectOwner = (index: number, owner: any) => {
    const newOwners = [...owners];
    newOwners[index] = {
      localId: newOwners[index].localId,
      id: owner.id,
      name: owner.name,
      phone: owner.phone,
      email: owner.email || '',
      address: owner.address || ''
    };
    setOwners(newOwners);
    setOwnerSearch({ index: -1, query: '', results: [] });
  };

  const handleAddOwnerField = () => {
    setOwners([...owners, { localId: crypto.randomUUID(), name: '', phone: '' }]);
  };

  const handleRemoveOwnerField = (index: number) => {
    setOwners(owners.filter((_, i) => i !== index));
  };

  const handleScanThaiID = async (index: number) => {
    try {
      // Common endpoints for Thai ID Card Agents
      // 1. http://localhost:8888/read (RD-ThaiID / ThaiID Agent)
      // 2. http://localhost:8182/thaiid (Custom Bridges)
      
      const endpoints = [
        'http://localhost:8888/read',
        'http://localhost:9898/read',
        'http://localhost:8182/thaiid'
      ];

      let data = null;
      let success = false;

      for (const url of endpoints) {
        try {
          const response = await fetch(url, { 
            method: 'GET',
            mode: 'cors',
            signal: AbortSignal.timeout(3000) // 3s timeout
          });
          if (response.ok) {
            data = await response.json();
            success = true;
            break;
          }
        } catch (e) {
          continue; // Try next endpoint
        }
      }
      
      if (success && data) {
        const newOwners = [...owners];
        
        // Mapping logic (Handles different agent JSON formats)
        const fullName = data.ThaiName || data.nameThai || `${data.prefixThai || ''}${data.nameThai || ''} ${data.surnameThai || ''}`;
        const citizenId = data.CitizenID || data.citizenId || data.idCardNo;
        const address = data.Address || data.address || 
                        `${data.houseNo || ''} ${data.moo || ''} ${data.soi || ''} ${data.road || ''} ${data.tambon || ''} ${data.amphur || ''} ${data.province || ''}`;
        const photo = data.Photo || data.photo;

        newOwners[index] = {
          ...newOwners[index],
          name: fullName.trim(),
          citizenId: citizenId,
          address: address.trim(),
          photoURL: photo ? (photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`) : undefined
        };
        setOwners(newOwners);
      } else {
        throw new Error("Could not connect to any Thai ID Agent");
      }
    } catch (err) {
      console.error("Error scanning Thai ID:", err);
      alert("ไม่สามารถเชื่อมต่อกับเครื่องอ่านบัตรได้!\n\nกรุณาตรวจสอบ:\n1. เสียบบัตรประชาชนเข้าเครื่องอ่านแล้ว\n2. เปิดโปรแกรมตัวกลาง (Thai ID Agent) แล้ว\n3. เครื่องอ่านบัตร SCR816 เชื่อมต่อกับคอมพิวเตอร์แล้ว");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    // Simple Client-side validation
    if (!formData.name) {
      alert("กรุณาระบุชื่อสัตว์เลี้ยง (Pet Name)");
      return;
    }

    if (owners.some(o => !o.name || !o.phone)) {
      alert("กรุณาระบุชื่อและเบอร์โทรศัพท์ของเจ้าของให้ครบถ้วน");
      return;
    }

    setLoading(true);

    try {
      console.log("Starting save process for patient:", {
        name: formData.name,
        ownersCount: owners.length,
        user: auth.currentUser?.email,
        uid: auth.currentUser?.uid
      });
      // 1. Handle Owners (Create new ones if they don't have an ID)
      const ownerIds: string[] = [];
      
      for (const owner of owners) {
        try {
          if (owner.id) {
            console.log("Updating existing owner:", owner.id);
            // Update existing owner
            await updateDoc(doc(db, 'owners', owner.id), {
              name: owner.name,
              phone: owner.phone,
              email: owner.email || '',
              address: owner.address || '',
              citizenId: owner.citizenId || '',
              photoURL: owner.photoURL || '',
              updatedAt: serverTimestamp()
            });
            ownerIds.push(owner.id);
          } else {
            console.log("Creating new owner:", owner.name);
            // Create new owner
            const ownerRef = await addDoc(collection(db, 'owners'), {
              name: owner.name,
              phone: owner.phone,
              email: owner.email || '',
              address: owner.address || '',
              citizenId: owner.citizenId || '',
              photoURL: owner.photoURL || '',
              petIds: [],
              createdAt: serverTimestamp()
            });
            ownerIds.push(ownerRef.id);
            console.log("Created new owner ID:", ownerRef.id);
          }
        } catch (ownerErr) {
          console.error("Owner processing failed:", ownerErr);
          handleFirestoreError(ownerErr, OperationType.WRITE, `owners/${owner.id || 'new'}`);
        }
      }

      // 2. Create or Update Patient
      console.log("Processing patient data update...");
      const nextVaccineDate = vaccineRecords
        .filter(v => v.nextDate)
        .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())[0]?.nextDate;

      const finalBirthDate = formData.useExactDate 
        ? (formData.birthDate ? new Date(formData.birthDate) : null)
        : new Date(formData.birthYear, formData.birthMonth - 1, 1);

      const patientData = {
        hn: formData.hn,
        name: formData.name,
        species: formData.species,
        breed: formData.breed,
        gender: formData.gender,
        birthDate: finalBirthDate ? finalBirthDate.toISOString() : null,
        photoURL: formData.photoURL,
        ownerIds,
        medicalHistory: medicalHistory.map(h => ({ ...h, date: new Date(h.date) })),
        vaccineRecords: vaccineRecords.map(v => ({ 
          ...v, 
          date: new Date(v.date),
          nextDate: v.nextDate ? new Date(v.nextDate) : null 
        })),
        nextVaccineDate: nextVaccineDate ? new Date(nextVaccineDate) : null,
        updatedAt: serverTimestamp(),
      };

      let patientId = editPatientId;
      try {
        if (editPatientId) {
          console.log("Updating existing patient:", editPatientId);
          await updateDoc(doc(db, 'patients', editPatientId), patientData);
        } else {
          console.log("Adding new patient document...");
          const patientRef = await addDoc(collection(db, 'patients'), {
            ...patientData,
            createdAt: serverTimestamp(),
          });
          patientId = patientRef.id;
          console.log("Created new patient ID:", patientId);
        }
      } catch (petErr) {
        console.error("Patient processing failed:", petErr);
        handleFirestoreError(petErr, OperationType.WRITE, `patients/${editPatientId || 'new'}`);
      }

      // 3. Update Owners with the pet ID
      console.log("Linking owners to pet...");
      for (const ownerId of ownerIds) {
        try {
          const ownerDoc = await getDoc(doc(db, 'owners', ownerId));
          if (ownerDoc.exists()) {
            const currentPetIds = ownerDoc.data().petIds || [];
            if (!currentPetIds.includes(patientId)) {
              await updateDoc(doc(db, 'owners', ownerId), {
                petIds: [...currentPetIds, patientId]
              });
            }
          }
        } catch (linkErr) {
          console.warn("Minor error linking owner to pet (non-critical):", linkErr);
        }
      }

      console.log("Save successful!");
      alert("บันทึกข้อมูลสำเร็จ!");
      onClose();
      // Reset form
      setFormData({ 
        hn: '',
        name: '', 
        species: 'Dog', 
        breed: '', 
        gender: 'Male',
        birthDate: '', 
        birthMonth: new Date().getMonth() + 1,
        birthYear: new Date().getFullYear(),
        useExactDate: true,
        photoURL: '' 
      });
      setOwners([{ localId: crypto.randomUUID(), name: '', phone: '' }]);
      setMedicalHistory([]);
      setVaccineRecords([]);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, 'patients');
      } catch (e) {
        throwError(e);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col"
            >
          {/* Header */}
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Add New Patient</h2>
                <p className="text-slate-500 text-sm font-bold">Register a new pet and owner</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-white rounded-2xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-10">
            {/* Basic Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <PawPrint className="w-4 h-4" />
                  Pet Information
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-6 mb-6">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-[2rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                        {formData.photoURL ? (
                          <img src={formData.photoURL} className="w-full h-full object-cover" alt="Pet" />
                        ) : (
                          <PawPrint className="w-10 h-10 text-slate-300" />
                        )}
                      </div>
                      <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-2xl shadow-lg flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-all">
                        <Plus className="w-5 h-5" />
                        <input type="file" className="hidden" accept="image/*" onChange={handlePetPhotoChange} />
                      </label>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Pet Name</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700"
                        placeholder="e.g. Buddy"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2 ml-1">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Species</label>
                        {isAdmin && (
                          <button 
                            type="button"
                            onClick={() => setIsEditingSpecies(true)}
                            className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <select
                          required
                          value={formData.species}
                          onChange={e => setFormData({ ...formData, species: e.target.value })}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700 appearance-none"
                        >
                          <option value="" disabled>Select Species</option>
                          {speciesList.map((s, i) => (
                            <option key={`species-${s}-${i}`} value={s}>{s}</option>
                          ))}
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Gender</label>
                      <div className="flex gap-2">
                        {['Male', 'Female'].map((g, i) => (
                          <button
                            key={`gender-${g}-${i}`}
                            type="button"
                            onClick={() => setFormData({ ...formData, gender: g as any })}
                            className={cn(
                              "flex-1 py-3 rounded-2xl font-bold transition-all border-2",
                              formData.gender === g 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                            )}
                          >
                            {g === 'Male' ? '♂ Male' : '♀ Female'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Breed</label>
                    <input
                      type="text"
                      value={formData.breed}
                      onChange={e => setFormData({ ...formData, breed: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700"
                      placeholder="e.g. Golden Retriever"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2 ml-1">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Birth Date</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, useExactDate: !formData.useExactDate })}
                        className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline"
                      >
                        {formData.useExactDate ? "Use Month/Year only" : "Use Exact Date"}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex gap-2">
                        {formData.useExactDate ? (
                          <input
                            type="date"
                            value={formData.birthDate}
                            onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700"
                          />
                        ) : (
                          <>
                            <select
                              value={formData.birthMonth}
                              onChange={e => setFormData({ ...formData, birthMonth: Number(e.target.value) })}
                              className="flex-1 px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700 appearance-none"
                            >
                              {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{format(new Date(2000, i, 1), 'MMMM')}</option>
                              ))}
                            </select>
                            <select
                              value={formData.birthYear}
                              onChange={e => setFormData({ ...formData, birthYear: Number(e.target.value) })}
                              className="flex-1 px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700 appearance-none"
                            >
                              {Array.from({ length: 30 }, (_, i) => (
                                <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                      <div className="w-full px-5 py-4 bg-slate-100 rounded-2xl font-black text-indigo-600 flex items-center justify-center h-[58px]">
                        {calculateAge(formData.birthDate, formData.birthMonth, formData.birthYear, formData.useExactDate)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">H.N. Number (Auto-generated)</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          required
                          type="text"
                          value={formData.hn}
                          onChange={e => setFormData({ ...formData, hn: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-700"
                          placeholder="e.g. 04052569_1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Owner(s) Information
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddOwnerField}
                    className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Owner
                  </button>
                </div>
                
                <div className="space-y-6">
                  {owners.map((owner, index) => (
                    <div key={owner.localId} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative group space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
                            {owner.photoURL ? (
                              <img src={owner.photoURL} className="w-full h-full object-cover" alt="Owner" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <User className="w-6 h-6 text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Owner #{index + 1}</h4>
                            <p className="text-xs font-bold text-slate-500">ID Card Photo</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 italic">* Requires Thai ID Agent</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleScanThaiID(index)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-200 transition-all"
                          >
                            <CreditCard className="w-3 h-3" />
                            Scan Thai ID
                          </button>
                          {owners.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOwnerField(index)}
                              className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div className="relative">
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Phone Number (Search)</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              required
                              type="tel"
                              value={owner.phone}
                              onChange={e => handleSearchOwner(index, e.target.value)}
                              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-transparent focus:border-indigo-500 rounded-xl outline-none font-bold text-slate-700"
                              placeholder="Search by phone..."
                            />
                            {isSearching && ownerSearch.index === index && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                              </div>
                            )}
                          </div>

                          {/* Search Results Dropdown */}
                          {ownerSearch.index === index && ownerSearch.results.length > 0 && (
                            <div className="absolute z-10 left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                              {ownerSearch.results.map((result, idx) => (
                                <button
                                  key={`owner-search-${result.id}-${idx}`}
                                  type="button"
                                  onClick={() => selectOwner(index, result)}
                                  className="w-full p-4 text-left hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                                >
                                  <div>
                                    <div className="font-black text-slate-800">{result.name}</div>
                                    <div className="text-xs font-bold text-slate-500">{formatPhoneNumber(result.phone)}</div>
                                  </div>
                                  <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg">
                                    Select
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Full Name</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              required
                              type="text"
                              value={owner.name}
                              onChange={e => {
                                const newOwners = [...owners];
                                newOwners[index].name = e.target.value;
                                setOwners(newOwners);
                              }}
                              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-transparent focus:border-indigo-500 rounded-xl outline-none font-bold text-slate-700"
                              placeholder="Owner's name"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Citizen ID (Optional)</label>
                            <div className="relative">
                              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                value={owner.citizenId || ''}
                                onChange={e => {
                                  const newOwners = [...owners];
                                  newOwners[index].citizenId = e.target.value;
                                  setOwners(newOwners);
                                }}
                                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-transparent focus:border-indigo-500 rounded-xl outline-none font-bold text-slate-700"
                                placeholder="13-digit ID"
                                maxLength={13}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Email (Optional)</label>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="email"
                                value={owner.email || ''}
                                onChange={e => {
                                  const newOwners = [...owners];
                                  newOwners[index].email = e.target.value;
                                  setOwners(newOwners);
                                }}
                                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-transparent focus:border-indigo-500 rounded-xl outline-none font-bold text-slate-700"
                                placeholder="Email address"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Address (Optional)</label>
                          <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              value={owner.address || ''}
                              onChange={e => {
                                const newOwners = [...owners];
                                newOwners[index].address = e.target.value;
                                setOwners(newOwners);
                              }}
                              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-transparent focus:border-indigo-500 rounded-xl outline-none font-bold text-slate-700"
                              placeholder="Home address"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Medical History Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" />
                  Initial Medical History
                </h3>
                <button
                  type="button"
                  onClick={handleAddHistory}
                  className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Record
                </button>
              </div>

              <div className="space-y-4">
                {medicalHistory.map((history, index) => (
                  <div key={history.localId} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative group">
                    <button
                      type="button"
                      onClick={() => setMedicalHistory(medicalHistory.filter((_, i) => i !== index))}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-white text-red-500 rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="date"
                        value={history.date}
                        onChange={e => {
                          const newHistory = [...medicalHistory];
                          newHistory[index].date = e.target.value;
                          setMedicalHistory(newHistory);
                        }}
                        className="px-4 py-3 bg-white rounded-xl font-bold text-slate-700 outline-none border-2 border-transparent focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="Diagnosis"
                        value={history.diagnosis}
                        onChange={e => {
                          const newHistory = [...medicalHistory];
                          newHistory[index].diagnosis = e.target.value;
                          setMedicalHistory(newHistory);
                        }}
                        className="px-4 py-3 bg-white rounded-xl font-bold text-slate-700 outline-none border-2 border-transparent focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="Treatment"
                        value={history.treatment}
                        onChange={e => {
                          const newHistory = [...medicalHistory];
                          newHistory[index].treatment = e.target.value;
                          setMedicalHistory(newHistory);
                        }}
                        className="px-4 py-3 bg-white rounded-xl font-bold text-slate-700 outline-none border-2 border-transparent focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ))}
                {medicalHistory.length === 0 && (
                  <div className="text-center py-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold text-sm">
                    No initial history added
                  </div>
                )}
              </div>
            </div>

            {/* Vaccine Records Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Syringe className="w-4 h-4" />
                  Vaccine Records & Reminders
                </h3>
                <button
                  type="button"
                  onClick={handleAddVaccine}
                  className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Vaccine
                </button>
              </div>

              <div className="space-y-4">
                {vaccineRecords.map((vaccine, index) => (
                  <div key={vaccine.localId} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative group">
                    <button
                      type="button"
                      onClick={() => setVaccineRecords(vaccineRecords.filter((_, i) => i !== index))}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-white text-red-500 rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="text"
                        placeholder="Vaccine Name"
                        value={vaccine.name}
                        onChange={e => {
                          const newVaccines = [...vaccineRecords];
                          newVaccines[index].name = e.target.value;
                          setVaccineRecords(newVaccines);
                        }}
                        className="px-4 py-3 bg-white rounded-xl font-bold text-slate-700 outline-none border-2 border-transparent focus:border-indigo-500"
                      />
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Date Given</label>
                        <input
                          type="date"
                          value={vaccine.date}
                          onChange={e => {
                            const newVaccines = [...vaccineRecords];
                            newVaccines[index].date = e.target.value;
                            setVaccineRecords(newVaccines);
                          }}
                          className="w-full px-4 py-3 bg-white rounded-xl font-bold text-slate-700 outline-none border-2 border-transparent focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-indigo-400 uppercase mb-1 ml-1">Next Appointment</label>
                        <input
                          type="date"
                          value={vaccine.nextDate}
                          onChange={e => {
                            const newVaccines = [...vaccineRecords];
                            newVaccines[index].nextDate = e.target.value;
                            setVaccineRecords(newVaccines);
                          }}
                          className="w-full px-4 py-3 bg-white rounded-xl font-bold text-indigo-600 outline-none border-2 border-transparent focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {vaccineRecords.length === 0 && (
                  <div className="text-center py-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold text-sm">
                    No vaccine records added
                  </div>
                )}
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4">
            <button
              onClick={onClose}
              className="px-8 py-4 text-slate-500 font-black uppercase tracking-widest hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={loading}
              className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Patient
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

  {/* Species Management Modal */}
  <AnimatePresence>
    {isEditingSpecies && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Manage Species</h3>
                <button onClick={() => setIsEditingSpecies(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newSpeciesInput}
                    onChange={e => setNewSpeciesInput(e.target.value)}
                    placeholder="New species name..."
                    className="flex-1 px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-xl outline-none font-bold"
                    onKeyDown={e => e.key === 'Enter' && handleAddSpecies()}
                  />
                  <button 
                    onClick={handleAddSpecies}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                  >
                    <PlusCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                  {speciesList.map((species, index) => (
                    <div key={`${species}-${index}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group">
                      <span className="font-bold text-slate-700">{species}</span>
                      <button 
                        onClick={() => handleRemoveSpecies(species)}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button 
                  onClick={() => setIsEditingSpecies(false)}
                  className="flex-1 py-3 text-slate-500 font-black uppercase tracking-widest text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveSpeciesList}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
