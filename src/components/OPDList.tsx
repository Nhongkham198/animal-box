import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Minus,
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  Calendar,
  ArrowRight,
  X,
  Maximize2,
  Upload,
  FileText,
  Trash2,
  DollarSign,
  Stethoscope,
  Scissors,
  Syringe,
  Check,
  Activity,
  History,
  Droplets,
  MoreHorizontal,
  PawPrint,
  Printer,
  Save,
  AlertCircle,
  Clock
} from 'lucide-react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  where,
  handleFirestoreError,
  OperationType,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  getDocs,
  limit
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { AnatomyMap } from './AnatomyMap';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  addDays,
  subDays,
  isToday,
  isSameYear
} from 'date-fns';

interface OPDItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: string;
  type?: 'Oral' | 'Injection' | 'Service' | 'None';
  usageMethod?: string;
  usageLocation?: string;
  dosage?: string;
  unit?: string;
  timingMeal?: 'Before' | 'After' | 'With' | 'Other';
  timingDetail?: string;
  frequency?: {
    morning: boolean;
    noon: boolean;
    evening: boolean;
    bedtime: boolean;
  };
  interval?: string;
  onCondition?: boolean;
  isWarning?: boolean;
  noEat?: boolean;
  refrigerate?: boolean;
  shake?: boolean;
  purpose?: string;
  woundCare?: boolean;
  woundCareDescription?: string;
  anatomicalParts?: string[];
}

interface OPDRecord {
  id: string;
  dateVisit: any;
  patientId: string;
  petName: string;
  ownerName: string;
  status: string;
  category: 'Treatment' | 'Grooming' | 'Vaccine' | 'Other';
  finalDiagnosis: string;
  revenue: number;
  isFollowUp?: boolean;
  groomingSize?: 'Small' | 'Medium' | 'Large';
  groomingTreatment?: boolean;
  groomingNotes?: string;
  attachments?: string[];
  items?: OPDItem[];
  billingStatus?: 'unpaid' | 'paid' | 'none';
  vitals?: {
    weight?: string;
    temp?: string;
    heartRate?: string;
    respiratoryRate?: string;
  };
  treatmentTx?: string;
  recipereRx?: string;
  physicalExaminationPe?: string;
  plan?: string;
  clientEducation?: string;
  chiefComplaint?: string;
  historyTaking?: string;
  problemList?: string;
  typeOfFood?: string;
}

interface OPDQueueItem {
  id: string;
  patientId: string;
  patientName: string;
  ownerName: string;
  activities: string;
  startTime: any;
  status: string;
}

export default function OPDList({ setActiveView }: { setActiveView: (view: any) => void }) {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [records, setRecords] = useState<OPDRecord[]>([]);
  const [opdQueue, setOpdQueue] = useState<OPDQueueItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [pastRecords, setPastRecords] = useState<any[]>([]);
  const [isBodyMapOpen, setIsBodyMapOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newRecord, setNewRecord] = useState<any>({
    patientId: '',
    petName: '',
    category: 'Treatment',
    finalDiagnosis: '',
    status: 'Completed',
    attachments: [],
    items: [],
    isFollowUp: false,
    groomingSize: 'Small',
    groomingTreatment: false,
    groomingNotes: '',
    serviceCharge: 0,
    vitals: { weight: '', temp: '', heartRate: '', respiratoryRate: '' },
    treatmentTx: '',
    recipereRx: '',
    physicalExaminationPe: '',
    plan: '',
    clientEducation: '',
    chiefComplaint: '',
    historyTaking: '',
    problemList: '',
    typeOfFood: ''
  });

  const [mergedBillingRecords, setMergedBillingRecords] = useState<any[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  const [targetPetId, setTargetPetId] = useState<string>('');

  useEffect(() => {
    if (newRecord.patientId && !targetPetId) {
      setTargetPetId(newRecord.patientId);
    }
  }, [newRecord.patientId, targetPetId]);

  const availableMergePatients = useMemo(() => {
    return opdQueue.filter(q => q.patientId !== newRecord.patientId);
  }, [opdQueue, newRecord.patientId]);

  const handleMergePatient = (queueItem: OPDQueueItem) => {
    if (mergedBillingRecords.find(r => r.patientId === queueItem.patientId)) {
      setShowMergeModal(false);
      return;
    }
    setMergedBillingRecords(prev => [...prev, {
      patientId: queueItem.patientId,
      petName: queueItem.patientName,
      items: [],
      id: queueItem.id
    }]);
    setShowMergeModal(false);
  };

  const removeMergedRecord = (patientId: string) => {
    setMergedBillingRecords(prev => prev.filter(r => r.patientId !== patientId));
  };

  const [customAnatomySvg, setCustomAnatomySvg] = useState<string | undefined>(undefined);
  const [isAnatomyZoomed, setIsAnatomyZoomed] = useState(false);
  const [anatomicalMappings, setAnatomicalMappings] = useState<Record<string, string[]>>({});

  // Load custom anatomy map and mappings from database
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [configDoc, mappingsDoc] = await Promise.all([
          getDoc(doc(db, 'settings', 'anatomy_map_config')),
          getDoc(doc(db, 'settings', 'anatomy_mappings'))
        ]);

        if (configDoc.exists()) {
          setCustomAnatomySvg(configDoc.data().svgContent);
        }
        if (mappingsDoc.exists()) {
          setAnatomicalMappings(mappingsDoc.data().mappings || {});
        }
      } catch (error) {
        console.error("Error loading anatomy data:", error);
      }
    };
    loadConfig();
  }, []);

  const handleSvgImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (content.toLowerCase().includes('<svg')) {
          setCustomAnatomySvg(content);
          // Persist to database
          try {
            await setDoc(doc(db, 'settings', 'anatomy_map_config'), {
              svgContent: content,
              updatedAt: serverTimestamp(),
              updatedBy: user?.email || 'unknown'
            }, { merge: true });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'settings/anatomy_map_config');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const [newItem, setNewItem] = useState<Partial<OPDItem>>({
    name: '',
    quantity: 1,
    price: 0,
    category: 'Medicine',
    type: 'Oral',
    usageMethod: 'กิน',
    unit: 'เม็ด',
    usageLocation: '',
    dosage: '1',
    timingMeal: 'After',
    timingDetail: '',
    frequency: {
      morning: false,
      noon: false,
      evening: false,
      bedtime: false
    },
    interval: '',
    onCondition: false,
    isWarning: false,
    noEat: false,
    refrigerate: false,
    shake: false,
    purpose: '',
    woundCare: false,
    woundCareDescription: '',
    anatomicalParts: []
  });

  const totalAmount = useMemo(() => {
    const mainTotal = (newRecord.items || []).reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
    const mergedTotal = (mergedBillingRecords || []).reduce((sum, r) => {
      return sum + (r.items || []).reduce((s: number, i: any) => s + (i.price * i.quantity), 0);
    }, 0);
    return mainTotal + mergedTotal + (newRecord.serviceCharge || 0);
  }, [newRecord.items, mergedBillingRecords, newRecord.serviceCharge]);

  const [petSearchQuery, setPetSearchQuery] = useState('');
  const [isPetDropdownOpen, setIsPetDropdownOpen] = useState(false);
  const petDropdownRef = useRef<HTMLDivElement>(null);

  const fetchPastRecords = async (patientId: string) => {
    try {
      const q = query(
        collection(db, 'opd_records'),
        where('patientId', '==', patientId),
        orderBy('dateVisit', 'desc'),
        limit(5)
      );
      const snap = await getDocs(q);
      setPastRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.warn("Error fetching past records (non-critical):", err);
    }
  };

  const selectedPatient = useMemo(() => {
    return patients.find(p => p.id === newRecord.patientId);
  }, [patients, newRecord.patientId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (petDropdownRef.current && !petDropdownRef.current.contains(event.target as Node)) {
        setIsPetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPatientsForSelect = useMemo(() => {
    if (!petSearchQuery) return patients;
    const parts = petSearchQuery.toLowerCase().trim().split(/\s+/);
    
    return patients.filter(p => {
      if (parts.length === 1) {
        // Single word: search pet name, HN, or species
        const query = parts[0];
        return (
          p.name.toLowerCase().includes(query) || 
          (p.hn && p.hn.toLowerCase().includes(query)) ||
          (p.species && p.species.toLowerCase().includes(query))
        );
      } else {
        // Multiple words: Pet Name [Space] Owner Name
        const petNameQuery = parts[0];
        const ownerNameQuery = parts.slice(1).join(' ');
        
        const petMatch = p.name.toLowerCase().includes(petNameQuery);
        const ownerMatch = (p.ownerName || '').toLowerCase().includes(ownerNameQuery);
        
        return petMatch && ownerMatch;
      }
    });
  }, [patients, petSearchQuery]);

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) {
      if (isAuthReady && !isStaff) setLoading(false);
      return;
    }

    const q = query(collection(db, 'opd_records'), orderBy('dateVisit', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OPDRecord));
      setRecords(data);
      setLoading(false);
    }, (err) => {
      console.warn("OPD records listener (non-critical):", err);
      handleFirestoreError(err, OperationType.LIST, 'opd_records');
    });

    // Fetch current OPD queue from appointments
    const queueQuery = query(
      collection(db, 'appointments'),
      where('visitType', '==', 'OPD'),
      where('status', '!=', 'completed')
    );
    const unsubscribeQueue = onSnapshot(queueQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OPDQueueItem));
      setOpdQueue(data);
    }, (err) => {
      console.warn("OPD queue listener (non-critical):", err);
      handleFirestoreError(err, OperationType.LIST, 'appointments');
    });

    // Fetch patients and owners for selection
    Promise.all([
      getDocs(collection(db, 'patients')),
      getDocs(collection(db, 'owners'))
    ]).then(([patientSnap, ownerSnap]) => {
      const ownersMap: Record<string, { name: string, phone: string }> = {};
      ownerSnap.docs.forEach(doc => {
        const data = doc.data();
        ownersMap[doc.id] = { name: data.name, phone: data.phone };
      });

      const patientData = patientSnap.docs.map(doc => {
        const data = doc.data();
        const firstOwnerId = data.ownerIds?.[0];
        const owner = firstOwnerId ? ownersMap[firstOwnerId] : null;
        
        return {
          id: doc.id,
          name: data.name,
          ownerName: owner?.name || 'No Owner',
          ownerPhone: owner?.phone || '-',
          ...data
        };
      });
      setPatients(patientData);
    }).catch(err => {
      console.warn("Error fetching patients/owners for OPD selection (non-critical):", err);
      handleFirestoreError(err, OperationType.LIST, 'patients');
    });

    return () => {
      unsubscribe();
      unsubscribeQueue();
    };
  }, [isAuthReady, user, isStaff]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Prepare main record data
    const mainRevenue = (newRecord.items || []).reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const mainDiagnosis = [
      newRecord.chiefComplaint && `CC: ${newRecord.chiefComplaint}`,
      newRecord.historyTaking && `HT: ${newRecord.historyTaking}`,
      newRecord.problemList && `Prob: ${newRecord.problemList}`,
      newRecord.physicalExaminationPe && `PE: ${newRecord.physicalExaminationPe}`,
      newRecord.treatmentTx && `Tx: ${newRecord.treatmentTx}`,
      newRecord.recipereRx && `Rx: ${newRecord.recipereRx}`,
      newRecord.plan && `Plan: ${newRecord.plan}`,
      newRecord.clientEducation && `Education: ${newRecord.clientEducation}`,
      newRecord.typeOfFood && `Food: ${newRecord.typeOfFood}`,
      newRecord.vitals?.weight && `Weight: ${newRecord.vitals.weight}kg`,
      newRecord.vitals?.temp && `Temp: ${newRecord.vitals.temp}C`
    ].filter(Boolean).join('\n');

    try {
      // 2. Save main record
      if (editingRecordId) {
        await updateDoc(doc(db, 'opd_records', editingRecordId), {
          ...newRecord,
          finalDiagnosis: mainDiagnosis,
          revenue: mainRevenue,
          isFollowUp: newRecord.isFollowUp || false,
          status: 'Completed',
          billingStatus: (mainRevenue > 0 || newRecord.serviceCharge > 0) ? 'unpaid' : 'none',
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'opd_records'), {
          ...newRecord,
          finalDiagnosis: mainDiagnosis,
          revenue: mainRevenue,
          isFollowUp: newRecord.isFollowUp || false,
          status: 'Completed',
          billingStatus: (mainRevenue > 0 || newRecord.serviceCharge > 0) ? 'unpaid' : 'none',
          dateVisit: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }

      // 3. Save merged records
      for (const merged of mergedBillingRecords) {
        const mergedRev = (merged.items || []).reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
        
        // Find owner name for merged records
        const queueItem = opdQueue.find(q => q.patientId === merged.patientId);
        
        await addDoc(collection(db, 'opd_records'), {
          patientId: merged.patientId,
          petName: merged.petName,
          ownerName: queueItem?.ownerName || '',
          category: 'Treatment',
          finalDiagnosis: `Billing merged with ${newRecord.petName}`,
          revenue: mergedRev,
          items: merged.items,
          status: 'Completed',
          billingStatus: mergedRev > 0 ? 'unpaid' : 'none',
          dateVisit: serverTimestamp(),
          createdAt: serverTimestamp()
        });

        // Update queue item for merged patient if still in queue
        if (queueItem) {
          await updateDoc(doc(db, 'appointments', queueItem.id), { status: 'Completed' });
        }
      }

      // Reset state
      setIsAddingRecord(false);
      setEditingRecordId(null);
      setActiveStep(1);
      setPastRecords([]);
      setMergedBillingRecords([]);
      setTargetPetId('');
      setNewRecord({
        patientId: '',
        petName: '',
        category: 'Treatment',
        isFollowUp: false,
        finalDiagnosis: '',
        status: 'Completed',
        attachments: [],
        items: [],
        vitals: { weight: '', temp: '', heartRate: '', respiratoryRate: '' },
        treatmentTx: '',
        recipereRx: '',
        physicalExaminationPe: '',
        plan: '',
        clientEducation: '',
        groomingSize: 'Small',
        groomingTreatment: false,
        groomingNotes: '',
        serviceCharge: 0
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'opd_records');
    }
  };

  const handleStartRecordFromQueue = async (item: OPDQueueItem) => {
    try {
      const opdRef = await addDoc(collection(db, 'opd_records'), {
        patientId: item.patientId,
        petName: item.patientName,
        ownerName: item.ownerName || '',
        category: 'Treatment',
        finalDiagnosis: item.activities || '',
        status: 'In Progress',
        billingStatus: 'none',
        revenue: 0,
        items: [],
        attachments: [],
        vitals: { weight: '', temp: '', heartRate: '', respiratoryRate: '' },
        treatmentTx: '',
        recipereRx: '',
        physicalExaminationPe: '',
        plan: '',
        clientEducation: '',
        chiefComplaint: '',
        historyTaking: '',
        problemList: '',
        typeOfFood: '',
        isFollowUp: false,
        groomingSize: 'Small',
        groomingTreatment: false,
        groomingNotes: '',
        dateVisit: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'appointments', item.id), {
        status: 'completed'
      });

      setEditingRecordId(opdRef.id);
      setNewRecord({
        patientId: item.patientId,
        petName: item.patientName,
        category: 'Treatment',
        finalDiagnosis: item.activities || '',
        status: 'In Progress',
        attachments: [],
        items: [],
        vitals: { weight: '', temp: '', heartRate: '', respiratoryRate: '' },
        treatmentTx: '',
        recipereRx: '',
        physicalExaminationPe: '',
        plan: '',
        clientEducation: '',
        groomingSize: 'Small',
        groomingTreatment: false,
        groomingNotes: ''
      });
      fetchPastRecords(item.patientId);
      setIsAddingRecord(true);
      setActiveStep(1);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'opd_records');
    }
  };

  const handleEditRecord = (record: OPDRecord) => {
    setEditingRecordId(record.id);
    setNewRecord({
      patientId: record.patientId,
      petName: record.petName,
      category: record.category,
      finalDiagnosis: record.finalDiagnosis || '',
      status: record.status,
      attachments: record.attachments || [],
      items: record.items || [],
      isFollowUp: record.isFollowUp || false,
      vitals: record.vitals || { weight: '', temp: '', heartRate: '', respiratoryRate: '' },
      treatmentTx: record.treatmentTx || '',
      recipereRx: record.recipereRx || '',
      physicalExaminationPe: record.physicalExaminationPe || '',
      plan: record.plan || '',
      clientEducation: record.clientEducation || '',
      chiefComplaint: record.chiefComplaint || '',
      historyTaking: record.historyTaking || '',
      problemList: record.problemList || '',
      typeOfFood: record.typeOfFood || '',
      groomingSize: record.groomingSize || 'Small',
      groomingTreatment: record.groomingTreatment || false,
      groomingNotes: record.groomingNotes || '',
      serviceCharge: (record as any).serviceCharge || 0
    });
    fetchPastRecords(record.patientId);
    setIsAddingRecord(true);
    setActiveStep(1);
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'opd_records', id));
      if (editingRecordId === id) {
        setIsAddingRecord(false);
        setEditingRecordId(null);
      }
      setIsDeleting(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'opd_records');
    }
  };

  const addItem = () => {
    if (!newItem.name) return;
    const itemToAdd = { ...newItem, id: crypto.randomUUID(), price: newItem.price || 0, petId: targetPetId };

    if (targetPetId === newRecord.patientId) {
      setNewRecord((prev: any) => ({
        ...prev,
        items: [...(prev.items || []), itemToAdd]
      }));
    } else {
      setMergedBillingRecords(prev => prev.map(r => 
        r.patientId === targetPetId 
          ? { ...r, items: [...(r.items || []), itemToAdd] }
          : r
      ));
    }

    setNewItem({ 
      name: '', 
      quantity: 1, 
      price: 0, 
      category: 'Medicine', 
      type: 'Oral',
      usageMethod: 'กิน',
      unit: 'เม็ด',
      usageLocation: '',
      dosage: '1',
      timingMeal: 'After',
      timingDetail: '',
      frequency: {
        morning: true,
        noon: true,
        evening: true,
        bedtime: false
      },
      onCondition: false,
      refrigerate: false,
      shake: false,
      purpose: ''
    });
  };

  const editItem = (item: any) => {
    setNewItem({ ...item });
    setNewRecord((prev: any) => ({
      ...prev,
      items: prev.items.filter((i: any) => i.id !== item.id)
    }));
  };

  const removeItem = (id: string, petId: string) => {
    if (petId === newRecord.patientId) {
      setNewRecord((prev: any) => ({
        ...prev,
        items: prev.items.filter((item: any) => item.id !== id)
      }));
    } else {
      setMergedBillingRecords(prev => prev.map(r => 
        r.patientId === petId 
          ? { ...r, items: (r.items || []).filter((item: any) => item.id !== id) }
          : r
      ));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewRecord(prev => ({
          ...prev,
          attachments: [...prev.attachments, reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Treatment': return <Stethoscope className="w-4 h-4" />;
      case 'Grooming': return <Scissors className="w-4 h-4" />;
      case 'Vaccine': return <Syringe className="w-4 h-4" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  const handleAdmitToIPD = async (record: OPDRecord) => {
    try {
      await addDoc(collection(db, 'ipd_records'), {
        patientId: record.patientId,
        petName: record.petName,
        ownerName: record.ownerName || 'Unknown Owner',
        cageNumber: 'TBD',
        diagnosis: record.finalDiagnosis || 'Transferred from OPD',
        treatmentPlan: 'Initial evaluation from OPD',
        status: 'Admitted',
        dateAdmit: serverTimestamp(),
        dailyNotes: []
      });
      setActiveView('ipd');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'ipd_records');
    }
  };

  const handleSendToBilling = async (record: OPDRecord) => {
    if (record.revenue <= 0) return;
    try {
      await updateDoc(doc(db, 'opd_records', record.id), {
        billingStatus: 'unpaid',
        status: 'Completed'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'opd_records');
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.finalDiagnosis && r.finalDiagnosis.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const recordDate = r.dateVisit?.toDate ? r.dateVisit.toDate() : new Date(r.dateVisit);
    const matchesDate = isSameDay(recordDate, currentMonth);
    
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Top Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#00b4d8] font-medium cursor-pointer hover:underline">Home</span>
          <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
          <span className="text-slate-400">OPD List</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAddingRecord(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#d8b4fe] text-slate-700 rounded-lg font-bold hover:bg-[#e9d5ff] transition-all text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            OPD Record
          </button>
        </div>
      </div>

      {/* Page Title */}
      <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
        OPD RECORD LIST
      </h1>

      {/* Overview Card */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Overview</h3>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setCurrentMonth(subDays(currentMonth, 1))}
                    className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <span 
                    onClick={() => {
                      setViewDate(currentMonth);
                      setIsDatePickerOpen(true);
                    }}
                    className="text-2xl font-bold text-slate-800 cursor-pointer hover:text-[#00b4d8] transition-colors"
                  >
                    {format(currentMonth, 'dd MMMM yyyy')}
                  </span>
                  <button 
                    onClick={() => setCurrentMonth(addDays(currentMonth, 1))}
                    className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-12 divide-x divide-slate-100">
              <div className="pl-12 flex items-baseline justify-between gap-8">
                <p className="text-sm font-bold text-slate-800">Gain Revenue</p>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-800">
                    {filteredRecords.reduce((sum, r) => sum + r.revenue, 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">THB</p>
                </div>
              </div>
              <div className="pl-12 flex items-baseline justify-between gap-8">
                <p className="text-sm font-bold text-slate-800">Done</p>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-800">{filteredRecords.filter(r => r.status === 'Completed').length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">case</p>
                </div>
              </div>
              <div className="pl-12 flex items-baseline justify-between gap-8">
                <p className="text-sm font-bold text-slate-800">Pending</p>
                <div className="text-right">
                  <p className="text-2xl font-black text-amber-500">{opdQueue.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">case</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Patient Names List */}
          {opdQueue.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-500" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Patients</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {opdQueue.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => handleStartRecordFromQueue(item)}
                    className="px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-amber-100 transition-all group"
                  >
                    <span className="text-xs font-bold text-amber-700">{item.patientName}</span>
                    <ArrowRight className="w-3 h-3 text-amber-300 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Today's OPD Queue */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Today's OPD Queue</h3>
            <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-widest">
              {opdQueue.length} Active
            </span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[120px] pr-2 custom-scrollbar">
            {opdQueue.length > 0 ? opdQueue.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100 group-hover:text-indigo-500 transition-colors">
                    <PawPrint className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">{item.patientName}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.activities}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400">{item.startTime?.toDate ? format(item.startTime.toDate(), 'hh:mm a') : 'N/A'}</p>
                    <button 
                      onClick={() => handleStartRecordFromQueue(item)}
                      className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline"
                    >
                      Start Record
                    </button>
                </div>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                <Stethoscope className="w-8 h-8 opacity-20" />
                <p className="text-[10px] font-bold uppercase tracking-widest">No active cases</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Search</h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center">
              <input 
                type="text" 
                placeholder="Pet Name, H.N., Owner, Medical Record ID , Tel"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-l-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent outline-none text-sm placeholder:text-slate-300"
              />
              <button className="px-5 py-2.5 bg-slate-50 border border-l-0 border-slate-200 rounded-r-xl hover:bg-slate-100 transition-colors">
                <Search className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Result Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-black text-[#00b4d8] uppercase tracking-wider">
            {filteredRecords.length} RESULT
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm",
                isEditMode 
                  ? "bg-rose-500 text-white border-rose-500 shadow-rose-100" 
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
              )}
            >
              {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Date Visit</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Pet</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Final Diagnosis</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400">Loading...</td>
                </tr>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr 
                    key={record.id} 
                    onClick={() => handleEditRecord(record)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-8 py-4 font-medium text-slate-600">
                      {format(record.dateVisit?.toDate ? record.dateVisit.toDate() : new Date(record.dateVisit), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-8 py-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        {record.petName}
                        {record.isFollowUp && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded-md text-[9px] font-black uppercase tracking-tighter border border-violet-100">
                            <History className="w-2.5 h-2.5" />
                            Follow up
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "p-1.5 rounded-lg",
                          record.category === 'Treatment' ? "bg-blue-100 text-blue-600" :
                          record.category === 'Grooming' ? "bg-purple-100 text-purple-600" :
                          record.category === 'Vaccine' ? "bg-orange-100 text-orange-600" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {getCategoryIcon(record.category)}
                        </span>
                        <span className="text-xs font-bold text-slate-600">{record.category}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                        record.status === 'Completed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-slate-600">{record.finalDiagnosis || '-'}</td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="text-right mr-2">
                          <p className="font-black text-slate-900">{record.revenue.toLocaleString()} THB</p>
                        </div>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdmitToIPD(record);
                          }}
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100"
                          title="Admit to IPD"
                        >
                          Admit
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendToBilling(record);
                          }}
                          disabled={record.billingStatus === 'paid' || record.billingStatus === 'unpaid'}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                            record.billingStatus === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            record.billingStatus === 'unpaid' ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                          )}
                          title="Send to Billing"
                        >
                          {record.billingStatus === 'paid' ? 'Paid' : record.billingStatus === 'unpaid' ? 'In Billing' : 'Billing'}
                        </button>

                        {isEditMode && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditRecord(record);
                              }}
                              className="p-2 text-slate-400 hover:text-[#00b4d8] hover:bg-cyan-50 rounded-lg transition-all"
                              title="Edit Record"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsDeleting(record.id);
                              }}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative w-80 h-80 opacity-60">
                        <img 
                          src="https://www.vremind.co/img/medical-record-no-result.2b3dd25c.png" 
                          alt="No Records"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <p className="text-2xl font-bold text-slate-300">ไม่มีรายการตรวจรักษาในวันนี้</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add OPD Record Modal */}
      {isAddingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="bg-white w-full h-full overflow-hidden flex">
            {/* Left: Form Column */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-50">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                    {editingRecordId ? 'Consultation' : 'New OPD Visit'}
                  </h2>
                  <div className="h-5 w-[1px] bg-slate-200" />
                  <div className="flex items-center gap-0 ml-2">
                    {[
                      { label: 'รอคิว', id: 0 },
                      { label: 'พบแพทย์', id: 1 },
                      { label: 'รอชำระเงิน/รับยา', id: 2 },
                      { label: 'เสร็จสิ้น', id: 3 }
                    ].map((step, idx) => {
                      // Custom mapping for current state
                      let isCompleted = false;
                      let isCurrent = false;

                      if (activeStep === 1) {
                        if (idx === 0) isCompleted = true;
                        if (idx === 1) isCurrent = true;
                      } else if (activeStep === 2) {
                        if (idx === 0) isCompleted = true;
                        if (idx === 1) isCurrent = true;
                      } else if (activeStep === 3) {
                        if (idx <= 1) isCompleted = true;
                        if (idx === 2) isCurrent = true;
                      }

                      return (
                        <div key={idx} className="flex items-center">
                          <div className="flex flex-col items-center relative group">
                            {/* Circle Node */}
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-700 z-10 bg-white",
                              isCompleted ? "border-[#00b4d8] bg-[#00b4d8]" : (isCurrent ? "border-[#00b4d8]" : "border-slate-200")
                            )}>
                              {isCompleted ? (
                                <Check className="w-3 h-3 text-white" strokeWidth={4} />
                              ) : (
                                isCurrent && <div className="w-2 h-2 rounded-full bg-[#00b4d8] animate-pulse" />
                              )}
                            </div>
                            
                            {/* Label */}
                            <span className={cn(
                              "text-[9px] font-black absolute top-6 min-w-[60px] text-center uppercase tracking-tighter transition-colors duration-500",
                              isCompleted || isCurrent ? "text-[#00b4d8]" : "text-slate-300"
                            )}>
                              {step.label}
                            </span>
                          </div>

                          {/* Connector Line */}
                          {idx < 3 && (
                            <div className={cn(
                              "w-12 h-[2px] transition-all duration-700 -mt-0",
                              isCompleted ? "bg-[#00b4d8]" : "bg-slate-100"
                            )} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button onClick={() => { setIsAddingRecord(false); setEditingRecordId(null); setActiveStep(1); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddRecord} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex-1 p-8">
                  {activeStep === 1 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="space-y-1 relative" ref={petDropdownRef}>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Patient *</label>
                        <div className="relative">
                          <input 
                            type="text"
                            required={!newRecord.patientId}
                            placeholder={newRecord.petName || "Search pet name or HN..."}
                            value={petSearchQuery}
                            onFocus={() => setIsPetDropdownOpen(true)}
                            onChange={(e) => {
                              setPetSearchQuery(e.target.value);
                              setIsPetDropdownOpen(true);
                            }}
                            className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-sky-50 outline-none text-sm font-bold shadow-inner placeholder:text-slate-300"
                          />
                          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        </div>

                        <AnimatePresence>
                          {isPetDropdownOpen && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-60 overflow-y-auto custom-scrollbar"
                            >
                              {filteredPatientsForSelect.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setNewRecord({ ...newRecord, patientId: p.id, petName: p.name });
                                    setPetSearchQuery('');
                                    setIsPetDropdownOpen(false);
                                    fetchPastRecords(p.id);
                                  }}
                                  className="w-full px-6 py-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group flex items-center justify-between"
                                >
                                  <div className="flex flex-col py-1">
                                    <span className="text-xl font-black text-slate-900 leading-tight">{p.name}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter",
                                        p.species?.toLowerCase() === 'dog' ? "bg-amber-50 text-amber-600" : 
                                        p.species?.toLowerCase() === 'cat' ? "bg-emerald-50 text-emerald-600" : 
                                        "bg-slate-100 text-slate-500"
                                      )}>
                                        {p.species || 'Species'}
                                      </span>
                                      <span className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none">
                                        HN: {p.hn} • <span className="text-[#00b4d8] font-black">Owner: {p.ownerName}</span>
                                      </span>
                                    </div>
                                  </div>
                                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[#00b4d8] font-black uppercase tracking-widest">Select Patient</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-sky-50/50 rounded-[2.5rem] border border-sky-100/50 space-y-6">
                          <h4 className="text-xs font-black text-sky-600 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Vital Signs
                          </h4>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5 focus-within:translate-y-[-2px] transition-transform">
                              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Weight (kg)</label>
                              <input 
                                type="text" 
                                value={newRecord.vitals.weight}
                                onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, weight: e.target.value}})}
                                className="w-full bg-white rounded-xl border border-slate-100 text-sm font-bold py-3 px-4 shadow-inner text-slate-700 outline-none focus:ring-2 focus:ring-sky-200" 
                                placeholder="0.0"
                              />
                            </div>
                            <div className="space-y-1.5 focus-within:translate-y-[-2px] transition-transform">
                              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Temp (°C)</label>
                              <input 
                                type="text" 
                                value={newRecord.vitals.temp}
                                onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, temp: e.target.value}})}
                                className="w-full bg-white rounded-xl border border-slate-100 text-sm font-bold py-3 px-4 shadow-inner text-slate-700 outline-none focus:ring-2 focus:ring-sky-200" 
                                placeholder="38.5"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1 flex items-center justify-between">
                            Visit Info
                            {newRecord.isFollowUp && <span className="text-[10px] text-violet-500 lowercase tracking-normal font-bold flex items-center gap-1"><History className="w-3 h-3" /> รักษาต่อเนื่อง</span>}
                          </label>
                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-[2.5rem] space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              {['Treatment', 'Grooming', 'Vaccine', 'Other'].map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => setNewRecord({ ...newRecord, category: cat as any })}
                                  className={cn(
                                    "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border",
                                    newRecord.category === cat 
                                      ? "bg-[#00b4d8] text-white border-[#00b4d8] shadow-lg shadow-cyan-100" 
                                      : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                                  )}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>

                            <AnimatePresence>
                              {newRecord.category === 'Grooming' && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 bg-white border border-slate-100 rounded-2xl space-y-4 shadow-sm">
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Size Selection</label>
                                      <div className="grid grid-cols-3 gap-2">
                                        {['Small', 'Medium', 'Large'].map((size) => (
                                          <button
                                            key={size}
                                            type="button"
                                            onClick={() => setNewRecord({ ...newRecord, groomingSize: size as any })}
                                            className={cn(
                                              "px-2 py-2 rounded-xl text-[10px] font-black uppercase transition-all border",
                                              newRecord.groomingSize === size 
                                                ? "bg-amber-500 text-white border-amber-500 shadow-md" 
                                                : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                                            )}
                                          >
                                            {size}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                                      <div className="flex items-center gap-2 px-2">
                                        <div className={cn(
                                          "w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all",
                                          newRecord.groomingTreatment ? "bg-emerald-500 border-emerald-500" : "bg-white border-slate-200"
                                        )}>
                                          {newRecord.groomingTreatment && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Treatment</span>
                                      </div>
                                      <button 
                                        type="button"
                                        onClick={() => setNewRecord({ ...newRecord, groomingTreatment: !newRecord.groomingTreatment })}
                                        className="text-[9px] font-black text-emerald-600 uppercase bg-white px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-50 transition-colors"
                                      >
                                        {newRecord.groomingTreatment ? 'Enabled' : 'Click to Enable'}
                                      </button>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Notes (หมายเหตุ)</label>
                                      <textarea 
                                        value={newRecord.groomingNotes}
                                        onChange={e => setNewRecord({...newRecord, groomingNotes: e.target.value})}
                                        rows={2}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] font-medium focus:ring-4 focus:ring-amber-50 outline-none transition-all placeholder:text-slate-300"
                                        placeholder="รายละเอียดเพิ่มเติมสำหรับการกรูมมิ่ง..."
                                      />
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            
                            <button
                              type="button"
                              onClick={() => setNewRecord({ ...newRecord, isFollowUp: !newRecord.isFollowUp })}
                              className={cn(
                                "w-full px-4 py-4 rounded-3xl text-xs font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2",
                                newRecord.isFollowUp 
                                  ? "bg-violet-500 text-white border-violet-500 shadow-xl shadow-violet-100 scale-[1.02]" 
                                  : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                              )}
                            >
                              <History className="w-4 h-4" />
                              รักษาต่อเนื่อง (Follow-up)
                              {newRecord.isFollowUp && <Check className="w-4 h-4 ml-auto" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Problem Oriented Section */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="h-[1px] flex-1 bg-slate-100" />
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Problem Oriented</h4>
                          <div className="h-[1px] flex-1 bg-slate-100" />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="space-y-1.5 group">
                              <label className="text-xs font-black text-[#00b4d8] uppercase tracking-widest flex items-center gap-2 ml-1">
                                <Activity className="w-3 h-3" /> Chief Complaint (CC)
                              </label>
                              <textarea 
                                value={newRecord.chiefComplaint}
                                onChange={e => setNewRecord({...newRecord, chiefComplaint: e.target.value})}
                                rows={3}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-sky-50 outline-none transition-all placeholder:text-slate-300"
                                placeholder="อาการที่ส่งผลให้ต้องมาพบหมอ..."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                                <History className="w-3 h-3" /> History Taking (HT)
                              </label>
                              <textarea 
                                value={newRecord.historyTaking}
                                onChange={e => setNewRecord({...newRecord, historyTaking: e.target.value})}
                                rows={4}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-sky-50 outline-none transition-all placeholder:text-slate-300"
                                placeholder="ประวัติตามข้อมูลจากเจ้าของสัตว์..."
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                                <Stethoscope className="w-3 h-3" /> Problem List
                              </label>
                              <textarea 
                                value={newRecord.problemList}
                                onChange={e => setNewRecord({...newRecord, problemList: e.target.value})}
                                rows={3}
                                className="w-full bg-rose-50/20 border border-rose-100/30 rounded-2xl p-4 text-sm font-medium focus:ring-4 focus:ring-rose-50 outline-none transition-all placeholder:text-slate-300"
                                placeholder="รายการปัญหาที่ตรวจพบเบื้องต้น..."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                                <Droplets className="w-3 h-3" /> Type of food
                              </label>
                              <input 
                                value={newRecord.typeOfFood}
                                onChange={e => setNewRecord({...newRecord, typeOfFood: e.target.value})}
                                type="text"
                                className="w-full bg-emerald-50/20 border border-emerald-100/30 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-emerald-50 outline-none transition-all placeholder:text-slate-300"
                                placeholder="อาหารที่กินปกติ..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                        <button 
                          type="button" 
                          onClick={() => newRecord.patientId && setActiveStep(2)}
                          disabled={!newRecord.patientId}
                          className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 shadow-2xl flex items-center justify-center gap-3 active:scale-95"
                        >
                          Step 2: Start Diagnosis <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-8">
                      <div className="grid grid-cols-1 gap-6">
                        {/* PE Section */}
                        <div className="space-y-3">
                          <label className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                            <Stethoscope className="w-3 h-3" /> Physical Examination: PE
                          </label>
                          <textarea 
                            rows={2}
                            value={newRecord.physicalExaminationPe}
                            onChange={(e) => setNewRecord({ ...newRecord, physicalExaminationPe: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-indigo-50/30 border border-indigo-100/50 focus:ring-4 focus:ring-indigo-50 outline-none text-sm font-medium shadow-inner placeholder:text-slate-300"
                            placeholder="ผลการตรวจร่างกายเบื้องต้น..."
                          />
                        </div>

                        {/* Treatment Section */}
                        <div className="space-y-3">
                          <label className="text-xs font-black text-[#00b4d8] uppercase tracking-widest flex items-center gap-2 ml-1">
                            <Activity className="w-3 h-3" /> Treatment: TX
                          </label>
                          <textarea 
                            rows={2}
                            value={newRecord.treatmentTx}
                            onChange={(e) => setNewRecord({ ...newRecord, treatmentTx: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-sky-50 outline-none text-sm font-medium shadow-inner placeholder:text-slate-300"
                            placeholder="แผนการรักษา..."
                          />
                        </div>

                        {/* Plan Section */}
                        <div className="space-y-3">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                            <History className="w-3 h-3" /> Plan: แผนการรักษาต่อเนื่อง
                          </label>
                          <textarea 
                            rows={2}
                            value={newRecord.plan}
                            onChange={(e) => setNewRecord({ ...newRecord, plan: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-sky-50 outline-none text-sm font-medium shadow-inner placeholder:text-slate-300"
                            placeholder="แผนสำรองหรือการนัดหมายครั้งถัดไป..."
                          />
                        </div>

                        {/* Client Education Section */}
                        <div className="space-y-3">
                          <label className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                            <Check className="w-3 h-3" /> Client Education: คำแนะนำสำหรับเจ้าของ
                          </label>
                          <textarea 
                            rows={2}
                            value={newRecord.clientEducation}
                            onChange={(e) => setNewRecord({ ...newRecord, clientEducation: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border border-emerald-100/50 focus:ring-4 focus:ring-emerald-50 outline-none text-sm font-medium shadow-inner placeholder:text-slate-300"
                            placeholder="ข้อควรปฏิบัติและการสังเกตอาการที่บ้าน..."
                          />
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4 border-t border-slate-100">
                        <button 
                          type="button" 
                          onClick={() => setActiveStep(1)}
                          className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-sans"
                        >
                          Back
                        </button>
                        <button 
                          type="button" 
                          onClick={() => {
                            // Synthesize finalDiagnosis for backward compatibility or display
                            const combinedDiagnosis = `CC: ${newRecord.chiefComplaint}\nHT: ${newRecord.historyTaking}\nPE: ${newRecord.physicalExaminationPe}\nTx: ${newRecord.treatmentTx}\nRx: ${newRecord.recipereRx}\nPlan: ${newRecord.plan}\nEducation: ${newRecord.clientEducation}`;
                            setNewRecord({ ...newRecord, finalDiagnosis: combinedDiagnosis });
                            setActiveStep(3);
                          }}
                          className="flex-[2] py-5 bg-[#00b4d8] text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#0096b1] transition-all shadow-2xl shadow-cyan-100 active:scale-95"
                        >
                          Next: Pharmacy & Billing
                        </button>
                      </div>
                    </div>
                  )}

                  {activeStep === 3 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="space-y-6">
                        {/* RX Section in Step 3 */}
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                            <Droplets className="w-3 h-3" /> Recipere: RX
                          </label>
                          <textarea 
                            rows={2}
                            value={newRecord.recipereRx}
                            onChange={(e) => setNewRecord({ ...newRecord, recipereRx: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-rose-50/20 border border-rose-100/30 focus:ring-4 focus:ring-rose-50 outline-none text-sm font-medium shadow-inner placeholder:text-slate-300 font-mono"
                            placeholder="รายการยาและขนาดยา (e.g. Medicine 20mg PO SID * 7)..."
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <Droplets className="w-3 h-3 text-emerald-500" /> Dispensing & Billing
                          </label>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => setShowMergeModal(true)}
                              className="px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-sky-100 hover:bg-sky-100 transition-all flex items-center gap-2"
                            >
                              <Plus className="w-3 h-3" /> รวมบิล (Merge Bill)
                            </button>
                            <div className="flex gap-2">
                              {(['Oral', 'Injection', 'Service'] as const).map(t => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setNewItem({...newItem, type: t, category: t === 'Service' ? 'Service' : 'Medicine'})}
                                  className={cn(
                                    "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                                    newItem.type === t 
                                      ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-100" 
                                      : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                                  )}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-8 bg-emerald-50/40 rounded-[2.5rem] border border-emerald-100/50 flex flex-col gap-6">
                          {mergedBillingRecords.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest ml-1">Select Target Pet</span>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setTargetPetId(newRecord.patientId)}
                                  className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-bold border transition-all",
                                    targetPetId === newRecord.patientId ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-400 border-slate-100"
                                  )}
                                >
                                  {newRecord.petName} (Current)
                                </button>
                                {mergedBillingRecords.map(r => (
                                  <div key={r.patientId} className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setTargetPetId(r.patientId)}
                                      className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-bold border transition-all",
                                        targetPetId === r.patientId ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-400 border-slate-100"
                                      )}
                                    >
                                      {r.petName}
                                    </button>
                                    <button onClick={() => removeMergedRecord(r.patientId)} className="p-1.5 text-slate-300 hover:text-rose-500">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-4">
                            <div className="flex-1 relative">
                              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
                              <input 
                                type="text"
                                placeholder={newItem.type === 'Oral' ? "Search Oral Medicine..." : (newItem.type === 'Injection' ? "Search Injection..." : "Search Service...") }
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value, category: 'Medicine' })}
                                className="w-full pl-12 pr-6 py-4 bg-white border-none rounded-2xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                              />
                            </div>
                            <div className="w-24">
                              <input 
                                type="number"
                                value={newItem.quantity}
                                onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                                className="w-full px-4 py-4 bg-white border-none rounded-2xl text-sm text-center font-bold shadow-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                              />
                            </div>
                            <div className="w-32">
                              <input 
                                type="number"
                                placeholder="Price"
                                value={newItem.price || ''}
                                onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })}
                                className="w-full px-4 py-4 bg-white border-none rounded-2xl text-sm text-center font-black shadow-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                              />
                            </div>
                          </div>

                          <button 
                            type="button"
                            onClick={addItem}
                            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            Add To Prescription <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {[
                            { name: newRecord.petName, items: newRecord.items || [], patientId: newRecord.patientId },
                            ...mergedBillingRecords
                          ].map((pet) => (
                            <div key={pet.patientId} className="space-y-3">
                              {mergedBillingRecords.length > 0 && (
                                <div className="flex items-center gap-2 px-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pet.name}'s Items</span>
                                </div>
                              )}
                              <div className="space-y-3">
                                {pet.items.map((itemValue: any) => (
                                  <div key={itemValue.id} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm group hover:border-emerald-200 transition-all">
                                    <div className="flex items-center gap-5 flex-1 cursor-pointer" onClick={() => editItem(itemValue)}>
                                      <div className={cn(
                                        "w-12 h-12 rounded-[1rem] flex items-center justify-center transition-colors",
                                        itemValue.type === 'Oral' ? "bg-amber-50 text-amber-500" : (itemValue.type === 'Injection' ? "bg-rose-50 text-rose-500" : "bg-sky-50 text-sky-500")
                                      )}>
                                        {itemValue.type === 'Oral' ? <Activity className="w-6 h-6" /> : (itemValue.type === 'Injection' ? <Syringe className="w-6 h-6" /> : <Stethoscope className="w-6 h-6" />)}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{itemValue.name}</p>
                                          <span className={cn(
                                            "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                                            itemValue.type === 'Oral' ? "border-amber-200 text-amber-500" : (itemValue.type === 'Injection' ? "border-rose-200 text-rose-500" : "border-sky-200 text-sky-500")
                                          )}>
                                            {itemValue.type}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Qty: {itemValue.quantity} • {itemValue.price} THB each</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                      <span className="text-sm font-black text-slate-900">{(itemValue.price * itemValue.quantity).toLocaleString()} THB</span>
                                      <div className="flex items-center gap-2">
                                        <button 
                                          type="button"
                                          onClick={() => removeItem(itemValue.id, pet.patientId)}
                                          className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                          <Trash2 className="w-5 h-5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto">
                        <div className="flex gap-8">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Estimated Total</span>
                            <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-black text-slate-900 leading-none">
                                {totalAmount.toLocaleString()}
                              </span>
                              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">THB</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">Service Charge</span>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number"
                                value={newRecord.serviceCharge || ''}
                                onChange={(e) => setNewRecord({...newRecord, serviceCharge: Number(e.target.value)})}
                                placeholder="0"
                                className="w-24 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl text-lg font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-400"
                              />
                              <span className="text-xs font-bold text-rose-300">THB</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <button 
                            type="button" 
                            onClick={() => setActiveStep(2)}
                            className="px-8 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-sans"
                          >
                            Back
                          </button>
                          <button 
                            type="submit"
                            className="px-12 py-5 bg-emerald-500 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-100 flex items-center gap-3 active:scale-95 transition-all"
                          >
                            <Save className="w-5 h-5" /> Complete Visit
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Right: Medical History Sidebar Column */}
            <div className="w-[400px] bg-white flex flex-col border-l border-slate-100 shadow-[-20px_0_40px_rgba(0,0,0,0.02)]">
              {/* TOP: Patient Info Header */}
              <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <PawPrint className="w-4 h-4" /> Patient Summary
                  </h3>
                </div>

                {selectedPatient ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-[#00b4d8]">
                        <PawPrint className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-800 leading-tight">{selectedPatient.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">HN: {selectedPatient.hn} • {selectedPatient.ownerName}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       <div className="bg-white/80 p-3 rounded-2xl border border-slate-100/50">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Breed</p>
                          <p className="text-[11px] font-bold text-slate-700 truncate">{selectedPatient.breed || '-'}</p>
                       </div>
                       <div className="bg-white/80 p-3 rounded-2xl border border-slate-100/50">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Gender</p>
                          <p className="text-[11px] font-bold text-slate-700">{selectedPatient.gender || '-'}</p>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 border-2 border-dashed border-slate-100 rounded-3xl opacity-50 bg-white/50">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-loose">
                      Search pet name to view<br/>patient dashboard
                    </p>
                  </div>
                )}
              </div>

              <div className="flex-none p-8 bg-white border-b border-slate-50 flex flex-col overflow-hidden max-h-[750px]">
                <h3 className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
                  <Syringe className="w-4 h-4" /> Pharmacy Management
                </h3>

                <div className="mb-6">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                      type="text"
                      value={newItem.name}
                      onChange={e => {
                        const val = e.target.value;
                        const updates: any = { name: val, category: 'Medicine' };
                        if (val.includes('ทำแผล')) {
                          updates.usageMethod = 'ทำแผล';
                          updates.woundCare = true;
                        }
                        setNewItem({...newItem, ...updates});
                      }}
                      className="w-full bg-slate-50 rounded-2xl border-none pl-12 pr-4 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100 transition-all shadow-inner"
                      placeholder="Search medication name..."
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  {/* Detailed Drug Label Form */}
                  {newItem.name && (
                    <div className="p-6 bg-emerald-50/20 rounded-[2rem] border border-emerald-100/50 space-y-6 animate-in fade-in zoom-in-95 duration-300 shadow-sm">
                      <div className="flex items-center justify-between mb-6 bg-emerald-50/50 p-4 rounded-[1.5rem] border border-emerald-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="drug-label-setting-sidebar-check" defaultChecked className="w-4 h-4 text-emerald-500 rounded border-slate-300" />
                          <label htmlFor="drug-label-setting-sidebar-check" className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] whitespace-nowrap">Drug Label Setting</label>
                        </div>
                        
                        <label className="cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-emerald-200 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm active:scale-95 flex items-center gap-2">
                          <Upload className="w-3 h-3 text-emerald-500" />
                          <span>นำเข้า SVG</span>
                          <input 
                            type="file" 
                            accept=".svg" 
                            className="hidden" 
                            onChange={handleSvgImport}
                          />
                        </label>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">วิธีการใช้</span>
                          <select 
                            value={newItem.usageMethod}
                            onChange={e => setNewItem({...newItem, usageMethod: e.target.value})}
                            className="w-full bg-white rounded-xl border border-emerald-100 px-4 py-2.5 text-sm font-bold shadow-sm outline-none"
                          >
                            {['กิน', 'ทา', 'หยอดหู', 'หยอดตา', 'พ่น', 'สวน', 'ล้างหู', 'ทำแผล'].map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-4 relative">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anatomical Marker (ระบุตำแหน่งบนตัวสัตว์)</span>
                              <span className="text-[9px] text-emerald-500 font-medium">จิ้มที่อวัยวะหรือส่วนต่างๆ เพื่อระบุตำแหน่ง</span>
                            </div>
                            <button 
                              type="button"
                              onClick={() => setNewItem({...newItem, usageLocation: ''})}
                              className="text-[9px] font-bold text-rose-500 uppercase px-3 py-1.5 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
                            >
                              รีเซ็ตตำแหน่ง
                            </button>
                          </div>
                          
                          <div 
                            className="relative aspect-[4/3] bg-white rounded-[2.5rem] border border-emerald-100 group shadow-2xl overflow-hidden cursor-zoom-in"
                            onClick={() => setIsAnatomyZoomed(true)}
                          >
                            <div className="absolute inset-0 pointer-events-none group-hover:bg-black/5 transition-colors z-0" />
                            <AnatomyMap 
                              onSelect={(loc) => {
                                const currentParts = newItem.anatomicalParts || [];
                                const index = currentParts.findIndex(l => l.toLowerCase() === loc.toLowerCase());
                                let nextParts;
                                if (index > -1) {
                                  nextParts = currentParts.filter((_, i) => i !== index);
                                } else {
                                  nextParts = [...currentParts, loc];
                                }
                                setNewItem({...newItem, anatomicalParts: nextParts});
                              }} 
                              selectedLocations={newItem.anatomicalParts || []}
                              customSvg={customAnatomySvg}
                            />
                            
                            {/* Expand Icon */}
                            <div className="absolute top-6 right-6 w-10 h-10 bg-white/90 backdrop-blur-xl rounded-2xl border border-emerald-100 shadow-xl flex items-center justify-center text-emerald-500 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 z-10">
                              <Maximize2 className="w-5 h-5" />
                            </div>

                            {/* Floating Selection Badge */}
                            <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-xl px-5 py-3 rounded-[1.5rem] border border-emerald-100 shadow-xl flex flex-col gap-0.5 z-10">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">ตำแหน่งที่เลือก</span>
                              <input 
                                className="text-sm font-black text-emerald-600 bg-transparent border-none outline-none p-0 w-full min-w-[150px] focus:ring-0"
                                value={newItem.usageLocation || ''}
                                onChange={(e) => setNewItem({...newItem, usageLocation: e.target.value})}
                                placeholder="คลี่กเลือกหรือพิมพ์..."
                              />
                            </div>

                            <div className="absolute bottom-6 right-6 pointer-events-none">
                              <div className="bg-emerald-500/10 backdrop-blur-md p-3 rounded-2xl border border-emerald-500/20 flex flex-col items-end gap-1">
                                <span className="text-[8px] font-bold text-emerald-600 uppercase">Interactive System Map</span>
                                <div className="flex gap-1">
                                  {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-emerald-500" />)}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50/50 p-4 rounded-[2rem] border border-slate-100 space-y-3">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">แมนนวล: ระบุตำแหน่งเอง</span>
                              <div className="flex gap-2">
                                <button 
                                  type="button"
                                  onClick={() => setNewItem({...newItem, usageLocation: 'ทางเดินหู'})}
                                  className="text-[9px] font-bold text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100"
                                >
                                  Ear Canal
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setNewItem({...newItem, usageLocation: 'ผิวหนังชั้นนอก'})}
                                  className="text-[9px] font-bold text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100"
                                >
                                  Skin
                                </button>
                              </div>
                            </div>
                            <div className="relative group">
                              <input 
                                type="text"
                                value={newItem.usageLocation}
                                onChange={e => {
                                  const val = e.target.value;
                                  const organNames = val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                                  
                                  const allPartsSet = new Set<string>();
                                  organNames.forEach(name => {
                                    if (anatomicalMappings[name]) {
                                      anatomicalMappings[name].forEach(p => allPartsSet.add(p));
                                    }
                                  });

                                  setNewItem({
                                    ...newItem, 
                                    usageLocation: val,
                                    anatomicalParts: allPartsSet.size > 0 ? Array.from(allPartsSet) : newItem.anatomicalParts
                                  });
                                }}
                                className="w-full bg-white rounded-2xl border border-emerald-100 px-5 py-3 text-sm outline-none shadow-sm font-bold group-hover:border-emerald-300 transition-all focus:ring-4 focus:ring-emerald-500/10"
                                placeholder="พิมพ์ระบุตำแหน่ง เช่น ตาซ้าย, กระดูกสันหลังส่วนอก..."
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ปริมาณ/ครั้ง</span>
                          <div className="flex gap-2">
                            <div className="flex items-center bg-white rounded-xl border border-emerald-100 overflow-hidden shadow-sm">
                              <button type="button" onClick={() => setNewItem({...newItem, dosage: String(Math.max(0, Number(newItem.dosage) - 0.5))})} className="p-2.5 hover:bg-slate-50 text-slate-400"><Minus className="w-3 h-3" /></button>
                              <input type="text" value={newItem.dosage} onChange={e => setNewItem({...newItem, dosage: e.target.value})} className="w-10 text-center text-xs font-black border-none outline-none" />
                              <button type="button" onClick={() => setNewItem({...newItem, dosage: String(Number(newItem.dosage) + 0.5)})} className="p-2.5 hover:bg-slate-50 text-slate-400"><Plus className="w-3 h-3" /></button>
                            </div>
                            <select 
                              value={newItem.unit}
                              onChange={e => setNewItem({...newItem, unit: e.target.value})}
                              className="flex-1 bg-white rounded-xl border border-emerald-100 px-3 py-2.5 text-xs font-bold shadow-sm"
                            >
                              {['เม็ด', 'มิลลิลิตร', 'แคปซูล', 'ช้อนชา', 'หยด'].map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {!newItem.woundCare && (
                          <>
                            <div className="space-y-2 pt-2">
                              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">เวลา</span>
                              {['Before', 'After', 'With'].map(m => (
                                <div key={m} className={cn(
                                  "p-3 rounded-2xl transition-all border",
                                  newItem.timingMeal === m ? "bg-white border-emerald-200 shadow-xl shadow-emerald-50/50" : "bg-transparent border-transparent"
                                )}>
                                  <div className="flex items-center gap-3">
                                    <input type="radio" checked={newItem.timingMeal === m} onChange={() => setNewItem({...newItem, timingMeal: m as any})} className="w-4 h-4 text-emerald-500 shadow-sm" />
                                    <span className="text-xs font-black text-slate-700 uppercase">{m} Meals</span>
                                    {newItem.timingMeal === m && (
                                      <input type="text" value={newItem.timingDetail} onChange={e => setNewItem({...newItem, timingDetail: e.target.value})} className="flex-1 bg-slate-50 rounded-lg border-none px-2 py-1 text-[9px] font-bold outline-none" placeholder="คำอธิบาย..." />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {['morning', 'noon', 'evening', 'bedtime'].map(f => (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => setNewItem({...newItem, frequency: {...newItem.frequency!, [f]: !newItem.frequency![f as keyof typeof newItem.frequency]}})}
                                  className={cn(
                                    "py-3 rounded-xl text-sm font-bold border transition-all shadow-sm",
                                    newItem.frequency?.[f as keyof typeof newItem.frequency] ? "bg-sky-500 text-white border-sky-500 shadow-lg shadow-sky-100" : "bg-white text-slate-300 border-slate-100"
                                  )}
                                >
                                  {f === 'morning' ? 'เช้า' : f === 'noon' ? 'กลางวัน' : f === 'evening' ? 'เย็น' : 'ก่อนนอน'}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        <div className="p-4 bg-white/50 rounded-2xl border border-emerald-50 flex flex-col gap-2">
                          <label className="flex items-center gap-3"><input type="checkbox" checked={newItem.refrigerate} onChange={e => setNewItem({...newItem, refrigerate: e.target.checked})} className="w-5 h-5 text-sky-500 rounded border-slate-200" /><span className="text-xs font-black text-sky-600 uppercase tracking-widest">เก็บในตู้เย็น</span></label>
                          <label className="flex items-center gap-3"><input type="checkbox" checked={newItem.shake} onChange={e => setNewItem({...newItem, shake: e.target.checked})} className="w-5 h-5 text-[#00b4d8] rounded border-slate-200" /><span className="text-xs font-black text-[#00b4d8] uppercase tracking-widest">เขย่าก่อนใช้</span></label>
                          <label className="flex items-center gap-3 pt-2 border-t border-emerald-50"><input type="checkbox" checked={newItem.onCondition} onChange={e => setNewItem({...newItem, onCondition: e.target.checked})} className="w-5 h-5 text-emerald-500 rounded border-slate-200" /><span className="text-xs font-black text-emerald-600 uppercase tracking-widest">เมื่อมีอาการ</span></label>
                          
                          <div className="pt-2 border-t border-emerald-50 space-y-3">
                            <label className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                checked={newItem.woundCare} 
                                onChange={e => setNewItem({...newItem, woundCare: e.target.checked})} 
                                className="w-5 h-5 text-rose-500 rounded border-slate-200" 
                              />
                              <span className="text-xs font-black text-rose-600 uppercase tracking-widest">ทำแผล</span>
                            </label>
                            {newItem.woundCare && (
                              <input 
                                type="text"
                                value={newItem.woundCareDescription}
                                onChange={e => setNewItem({...newItem, woundCareDescription: e.target.value})}
                                placeholder="รายละเอียดการทำแผล..."
                                className="w-full bg-rose-50/50 rounded-xl border border-rose-100 px-4 py-2 text-xs font-bold shadow-sm outline-none placeholder:text-rose-300 text-rose-700"
                              />
                            )}
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={() => {
                            addItem();
                          }}
                          className="w-full bg-emerald-500 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-95"
                        >
                          Confirm & Add Medication
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    {[
                      { name: newRecord.petName, items: (newRecord.items || []), patientId: newRecord.patientId },
                      ...mergedBillingRecords
                    ].map((pet) => (
                      <div key={pet.patientId} className="space-y-3">
                        {mergedBillingRecords.length > 0 && pet.items.length > 0 && (
                          <div className="flex items-center gap-2 px-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{pet.name}'s Items</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {pet.items.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-emerald-50/10 border border-emerald-100/30 rounded-2xl shadow-sm hover:bg-emerald-50 transition-colors group">
                                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => editItem(item)}>
                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-emerald-500 font-black text-xs shadow-sm">{item.quantity}</div>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-black text-slate-800 group-hover:text-emerald-600 transition-colors">{item.name}</span>
                                    <span className="text-[11px] font-bold text-slate-400 capitalize">{item.usageMethod} • {item.dosage} {item.unit}</span>
                                  </div>
                                </div>
                                <button type="button" onClick={() => removeItem(item.id, pet.patientId)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {newRecord.items.length === 0 && mergedBillingRecords.length === 0 && !newItem.name && (
                      <div className="py-20 bg-slate-50/20 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-3 text-slate-300">
                        <Droplets className="w-8 h-8 opacity-20" />
                        <span className="text-xs font-black uppercase tracking-widest">Type Med Name to Start</span>
                      </div>
                    )}
                  </div>
                </div>

                {newRecord.items.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total BILL</span>
                    <span className="text-lg font-black text-slate-900">
                      {totalAmount.toLocaleString()} <span className="text-xs text-slate-300">THB</span>
                    </span>
                  </div>
                )}
              </div>

              {/* BOTTOM: Medical History Timeline (The Bottom Red Box in your image) */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/10">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-10">
                  <History className="w-4 h-4" /> Treatment Timeline
                </h3>

                {selectedPatient ? (
                  pastRecords.length > 0 ? (
                    <div className="relative pb-10">
                      {/* Central Thick Timeline Line with Segments */}
                      <div className="absolute left-10 top-0 bottom-0 w-[4px] bg-slate-100 rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1/4 bg-amber-400" />
                        <div className="absolute top-1/4 left-0 right-0 h-1/4 bg-orange-500" />
                        <div className="absolute top-2/4 left-0 right-0 h-1/4 bg-rose-500" />
                        <div className="absolute top-3/4 left-0 right-0 h-1/4 bg-purple-600" />
                      </div>
                      
                      <div className="space-y-12">
                        {pastRecords.map((rec, idx) => {
                          const visitDate = rec.dateVisit?.toDate ? rec.dateVisit.toDate() : new Date(rec.dateVisit);
                          const colors = [
                            'border-amber-400 text-amber-600 bg-amber-50',
                            'border-orange-500 text-orange-600 bg-orange-50',
                            'border-rose-500 text-rose-600 bg-rose-50',
                            'border-purple-600 text-purple-600 bg-purple-50'
                          ];
                          const colorClass = colors[idx % colors.length];

                          return (
                            <div key={rec.id} className="relative pl-24 group animate-in fade-in slide-in-from-bottom-8 duration-700">
                              {/* Horizontal connector line */}
                              <div className="absolute left-11 top-8 w-12 h-[2px] bg-slate-100" />
                              
                              {/* Milestone Node (Date Circle) */}
                              <div className={cn(
                                "absolute left-0 top-0 w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shadow-xl z-20 bg-white transition-transform group-hover:scale-110 duration-500",
                                colorClass.split(' ')[0], // border color
                              )}>
                                <span className={cn("text-[10px] font-black uppercase tracking-tighter", colorClass.split(' ')[1])}>
                                  {format(visitDate, 'MMM')}
                                </span>
                                <span className="text-2xl font-black text-slate-800 leading-none">
                                  {format(visitDate, 'dd')}
                                </span>
                                <span className="text-[8px] font-bold text-slate-400">
                                  {format(visitDate, 'yyyy')}
                                </span>
                              </div>
                              
                              {/* Content Card */}
                              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                                 <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <div className={cn("w-2 h-2 rounded-full", colorClass.split(' ')[2].replace('bg-', 'bg-').split(' ')[0])} />
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical Note</span>
                                    </div>
                                    <FileText className="w-4 h-4 text-slate-100 group-hover:text-slate-300" />
                                 </div>
                                 
                                 <div className="space-y-3">
                                   {rec.chiefComplaint && (
                                     <div className="bg-amber-50/30 p-4 rounded-2xl border border-amber-100/30">
                                       <span className="text-[8px] font-black text-amber-600 uppercase tracking-[0.2em] block mb-1.5">CC: Chief Complaint</span>
                                       <p className="text-xs font-black text-slate-800 leading-relaxed">{rec.chiefComplaint}</p>
                                     </div>
                                   )}
                                   {rec.historyTaking && (
                                     <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1.5">HT: History Taking</span>
                                       <p className="text-xs font-medium text-slate-600 leading-relaxed">{rec.historyTaking}</p>
                                     </div>
                                   )}
                                   {rec.vitals && (rec.vitals.weight || rec.vitals.temp) && (
                                     <div className="flex gap-2">
                                       {rec.vitals.weight && (
                                         <div className="flex-1 bg-sky-50/30 p-3 rounded-xl border border-sky-100/30 flex flex-col">
                                           <span className="text-[7px] font-black text-sky-600 uppercase">Weight</span>
                                           <span className="text-sm font-black text-slate-800">{rec.vitals.weight} <small className="text-[8px]">kg</small></span>
                                         </div>
                                       )}
                                       {rec.vitals.temp && (
                                         <div className="flex-1 bg-orange-50/30 p-3 rounded-xl border border-orange-100/30 flex flex-col">
                                           <span className="text-[7px] font-black text-orange-600 uppercase">Temp</span>
                                           <span className="text-sm font-black text-slate-800">{rec.vitals.temp} <small className="text-[8px]">°C</small></span>
                                         </div>
                                       )}
                                     </div>
                                   )}
                                   {rec.physicalExaminationPe && (
                                     <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/30">
                                       <span className="text-[8px] font-black text-indigo-600 uppercase tracking-[0.2em] block mb-1.5">PE: Physical Examination</span>
                                       <p className="text-xs font-bold text-slate-700 leading-relaxed">{rec.physicalExaminationPe}</p>
                                     </div>
                                   )}
                                   {rec.treatmentTx && (
                                     <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                       <span className="text-[8px] font-black text-[#00b4d8] uppercase tracking-[0.2em] block mb-1.5">Tx: Treatment</span>
                                       <p className="text-xs font-bold text-slate-700 leading-relaxed">{rec.treatmentTx}</p>
                                     </div>
                                   )}
                                   {rec.recipereRx && (
                                     <div className="bg-rose-50/10 p-4 rounded-2xl border border-rose-100/10">
                                       <span className="text-[8px] font-black text-rose-500 uppercase tracking-[0.2em] block mb-1.5">Rx: Recipere</span>
                                       <p className="text-xs font-medium text-slate-500 leading-relaxed italic">{rec.recipereRx}</p>
                                     </div>
                                   )}
                                   {rec.plan && (
                                     <div className="bg-slate-50/30 p-4 rounded-2xl border border-dashed border-slate-200">
                                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1.5">Plan</span>
                                       <p className="text-xs font-medium text-slate-500 leading-relaxed">{rec.plan}</p>
                                     </div>
                                   )}
                                   {rec.clientEducation && (
                                     <div className="bg-emerald-50/20 p-4 rounded-2xl border border-emerald-100/20">
                                       <span className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em] block mb-1.5">Home Care</span>
                                       <p className="text-xs font-medium text-slate-600 leading-relaxed">{rec.clientEducation}</p>
                                     </div>
                                   )}
                                   {!rec.treatmentTx && !rec.recipereRx && !rec.chiefComplaint && (
                                     <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                       {rec.finalDiagnosis}
                                     </p>
                                   )}
                                 </div>

                                 {rec.items && rec.items.length > 0 && (
                                   <div className="flex flex-wrap gap-1.5 mt-5 pt-5 border-t border-slate-50">
                                      {rec.items.slice(0, 3).map((it: any, i: number) => (
                                        <span key={i} className="text-[8px] font-black bg-slate-50 text-slate-400 px-3 py-1.5 rounded-xl uppercase tracking-tighter hover:bg-[#00b4d8] hover:text-white transition-colors cursor-default">
                                          {it.name}
                                        </span>
                                      ))}
                                      {rec.items.length > 3 && <span className="text-[8px] font-black text-slate-300 self-center">+ {rec.items.length - 3}</span>}
                                   </div>
                                 )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4 py-20">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                        <History className="w-8 h-8" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-center leading-loose">No clinical history<br/>available yet</p>
                    </div>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Date Picker Modal */}
      <AnimatePresence>
        {isDatePickerOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setViewDate(subMonths(viewDate, 1))}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                  {format(viewDate, 'MMMM yyyy')}
                </h3>
                <button 
                  onClick={() => setViewDate(addMonths(viewDate, 1))}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-[10px] font-black text-slate-300 uppercase py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {eachDayOfInterval({
                  start: startOfWeek(startOfMonth(viewDate)),
                  end: endOfWeek(endOfMonth(viewDate))
                }).map((day, i) => {
                  const isCurrentMonth = isSameMonth(day, viewDate);
                  const isSelected = isSameMonth(day, currentMonth) && isSameYear(day, currentMonth);
                  const isTodayDate = isToday(day);

                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentMonth(day);
                        setIsDatePickerOpen(false);
                      }}
                      className={cn(
                        "aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all",
                        !isCurrentMonth && "text-slate-200",
                        isCurrentMonth && !isSelected && !isTodayDate && "text-slate-600 hover:bg-slate-50",
                        isTodayDate && !isSelected && "text-[#00b4d8] bg-cyan-50",
                        isSelected && "bg-[#00b4d8] text-white shadow-lg shadow-cyan-100"
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setIsDatePickerOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all text-xs"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setIsDatePickerOpen(false);
                  }}
                  className="flex-1 py-3 bg-cyan-50 text-[#00b4d8] rounded-xl font-black uppercase tracking-widest hover:bg-cyan-100 transition-all text-xs"
                >
                  Today
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Confirm Delete</h3>
              <p className="text-slate-500 font-bold text-sm mb-8">
                Are you sure you want to delete this record? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleting(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteRecord(isDeleting)}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Merge Bill Modal */}
      <AnimatePresence>
        {showMergeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMergeModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-800">เลือกสัตว์ที่ต้องการรวมบิล</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Select patient to merge billing</p>
                </div>
                <button onClick={() => setShowMergeModal(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text"
                    placeholder="Search patient name..."
                    value={mergeSearchQuery}
                    onChange={(e) => setMergeSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold shadow-inner focus:ring-2 focus:ring-sky-400 outline-none"
                  />
                </div>
                
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {availableMergePatients
                    .filter(p => !mergeSearchQuery || p.patientName.toLowerCase().includes(mergeSearchQuery.toLowerCase()))
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleMergePatient(item)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-sky-50/50 rounded-2xl transition-all border border-transparent hover:border-sky-100 group text-left"
                      >
                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-sky-500 group-hover:scale-110 transition-transform">
                          <PawPrint className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-slate-800">{item.patientName}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.ownerName}</p>
                        </div>
                        <Plus className="w-5 h-5 text-slate-200 group-hover:text-sky-500" />
                      </button>
                    ))}
                  {availableMergePatients.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-sm font-bold text-slate-400">No other patients in queue</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Anatomy Zoom Modal */}
      <AnimatePresence>
        {isAnatomyZoomed && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAnatomyZoomed(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-[95vw] h-[90vh] max-w-7xl bg-white rounded-[3rem] shadow-2xl border border-white/50 overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-8 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <Maximize2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Interactive Anatomical Map</h3>
                    <p className="text-xs font-bold text-slate-400">คลิกที่อวัยวะเพื่อระบุตำแหน่งที่ต้องการ</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAnatomyZoomed(false)}
                  className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all hover:rotate-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body - Large Map */}
              <div className="flex-1 bg-slate-50/30 relative overflow-hidden">
                {/* Fixed Navigation Buttons on the Left (Outside scroll area) */}
                <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-50">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const viewport = document.getElementById('anatomy-modal-viewport');
                      if (viewport) viewport.scrollBy({ top: -300, behavior: 'smooth' });
                    }}
                    className="w-16 h-16 bg-white rounded-3xl shadow-2xl border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-emerald-500 hover:text-white transition-all active:scale-90 group/btn"
                    title="เลื่อนขึ้น"
                  >
                    <ChevronUp className="w-8 h-8 group-hover/btn:-translate-y-1 transition-transform" />
                  </button>

                  <div className="flex gap-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const viewport = document.getElementById('anatomy-modal-viewport');
                        if (viewport) viewport.scrollBy({ left: -300, behavior: 'smooth' });
                      }}
                      className="w-16 h-16 bg-white rounded-3xl shadow-2xl border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-emerald-500 hover:text-white transition-all active:scale-90 group/btn"
                      title="เลื่อนซ้าย"
                    >
                      <ChevronLeft className="w-8 h-8 group-hover/btn:-translate-x-1 transition-transform" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const viewport = document.getElementById('anatomy-modal-viewport');
                        if (viewport) viewport.scrollBy({ left: 300, behavior: 'smooth' });
                      }}
                      className="w-16 h-16 bg-white rounded-3xl shadow-2xl border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-emerald-500 hover:text-white transition-all active:scale-90 group/btn"
                      title="เลื่อนขวา"
                    >
                      <ChevronRight className="w-8 h-8 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const viewport = document.getElementById('anatomy-modal-viewport');
                      if (viewport) viewport.scrollBy({ top: 300, behavior: 'smooth' });
                    }}
                    className="w-16 h-16 bg-white rounded-3xl shadow-2xl border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-emerald-500 hover:text-white transition-all active:scale-90 group/btn"
                    title="เลื่อนลง"
                  >
                    <ChevronDown className="w-8 h-8 group-hover/btn:translate-y-1 transition-transform" />
                  </button>
                </div>

                <div 
                  id="anatomy-modal-viewport"
                  className="w-full h-full p-4 overflow-auto scroll-smooth hide-scrollbar"
                >
                  <div className="w-[150%] h-[150%] bg-white rounded-[3rem] border border-slate-100 shadow-inner relative flex items-center justify-center min-h-[1200px]">
                    <AnatomyMap 
                      onSelect={(loc) => {
                        const currentParts = newItem.anatomicalParts || [];
                        const index = currentParts.findIndex(l => l.toLowerCase() === loc.toLowerCase());
                        let nextParts;
                        if (index > -1) {
                          nextParts = currentParts.filter((_, i) => i !== index);
                        } else {
                          nextParts = [...currentParts, loc];
                        }
                        setNewItem({...newItem, anatomicalParts: nextParts});
                      }} 
                      selectedLocations={newItem.anatomicalParts || []}
                      customSvg={customAnatomySvg}
                    />
                    
                    {/* Floating Input Panel (Top Right inside scroll area or fixed?) 
                        Let's make it fixed so it's always available */}
                  </div>
                </div>

                {/* Floating Feedback Panel (Fixed on the Left) */}
                <div className="absolute top-8 left-8 z-50 w-full max-w-[calc(100%-8rem)] md:max-w-[400px] flex flex-col gap-4">
                  {/* Selected Parts Info */}
                  <div className="bg-white/95 backdrop-blur-xl px-6 py-4 rounded-[1.5rem] border border-emerald-100 shadow-2xl flex flex-col gap-1 w-full">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">ระบุตำเเหน่งที่เลือก (PART ID)</span>
                    <div className="text-lg font-black text-emerald-600 truncate min-h-[1.75rem]">
                      {(newItem.anatomicalParts && newItem.anatomicalParts.length > 0) ? newItem.anatomicalParts.join(', ') : 'จิ้มที่อวัยวะเพื่อระบุตำแหน่ง'}
                    </div>
                  </div>

                  {/* Mapping Input Box */}
                  <div className="bg-white/95 backdrop-blur-xl px-6 py-4 rounded-[2rem] border-2 border-rose-400 shadow-2xl flex flex-col gap-2 w-full animate-in slide-in-from-left duration-500">
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] leading-none">ระบุชื่ออวัยวะ (MAPPING)</span>
                    <input 
                      className="text-lg font-black text-slate-700 bg-transparent border-none outline-none p-0 w-full focus:ring-0 placeholder:text-slate-300"
                      value={newItem.usageLocation || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const organNames = val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                        
                        const allPartsSet = new Set<string>();
                        organNames.forEach(name => {
                          if (anatomicalMappings[name]) {
                            anatomicalMappings[name].forEach(p => allPartsSet.add(p));
                          }
                        });

                        setNewItem({
                          ...newItem, 
                          usageLocation: val,
                          anatomicalParts: allPartsSet.size > 0 ? Array.from(allPartsSet) : newItem.anatomicalParts
                        });
                      }}
                      placeholder="พิมพ์ชื่ออวัยวะ เช่น หู, ขา..."
                    />
                    <div className="text-[10px] text-slate-400 font-medium italic">
                      *Mapping ข้อมูลเพื่อใช้แสดงผลในอนาคต
                    </div>
                  </div>
                </div>

                {/* Bottom Center Save Panel (Fixed) */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center z-50 pointer-events-none">
                  <button 
                    onClick={async () => {
                      // Save mapping if name is provided and parts are selected
                      if (newItem.usageLocation && newItem.anatomicalParts && newItem.anatomicalParts.length > 0) {
                        const organNames = newItem.usageLocation.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                        
                        let updatedMappings = { ...anatomicalMappings };
                        organNames.forEach(name => {
                          updatedMappings[name] = newItem.anatomicalParts!;
                        });

                        setAnatomicalMappings(updatedMappings);
                        try {
                          await setDoc(doc(db, 'settings', 'anatomy_mappings'), {
                            mappings: updatedMappings,
                            updatedAt: serverTimestamp()
                          }, { merge: true });
                        } catch (error) {
                          console.error("Error saving mappings:", error);
                        }
                      }
                      setIsAnatomyZoomed(false);
                    }}
                    className="bg-emerald-500 text-white h-14 px-10 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 shadow-2xl shadow-emerald-500/30 flex items-center gap-3 pointer-events-auto"
                  >
                    <Check className="w-5 h-5" />
                    <span>ยืนยันข้อมูลและกลับหน้าเดิม</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
