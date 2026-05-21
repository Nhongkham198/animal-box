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
  Clock,
  GripVertical
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
  eyeOrder?: string;
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
  billingStatus?: 'unpaid' | 'paid' | 'none' | 'parked';
  isParked?: boolean;
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
    isParked: false,
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

  const [rightPanelWidth, setRightPanelWidth] = useState(400); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) { // Constraint for usability
        setRightPanelWidth(newWidth);
      }
    }
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);
  const [medicationSearchQuery, setMedicationSearchQuery] = useState('');
  const [showMedicationSuggestions, setShowMedicationSuggestions] = useState(false);
  const medicationSuggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (medicationSuggestionsRef.current && !medicationSuggestionsRef.current.contains(event.target as Node)) {
        setShowMedicationSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'inventory'), where('isInStock', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      setInventoryProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const filteredMedicationSuggestions = useMemo(() => {
    if (!medicationSearchQuery || medicationSearchQuery.length < 1) return [];
    return inventoryProducts.filter(p => 
      p.name.toLowerCase().includes(medicationSearchQuery.toLowerCase()) ||
      (p.genericName && p.genericName.toLowerCase().includes(medicationSearchQuery.toLowerCase()))
    ).slice(0, 8);
  }, [inventoryProducts, medicationSearchQuery]);

  const selectMedication = (product: any) => {
    const drugLabel = product.drugLabel || {};
    setNewItem({
      ...newItem,
      name: product.name,
      price: product.price || 0,
      category: product.type || 'Medicine',
      unit: product.unit || drugLabel.dosageUnit || 'เม็ด',
      dosage: drugLabel.dosage ? String(drugLabel.dosage) : '1',
      usageMethod: drugLabel.medicalUse || 'กิน',
      timingMeal: drugLabel.timing === 'before' ? 'Before' : (drugLabel.timing === 'after' ? 'After' : 'With'),
      timingDetail: drugLabel.timingDetail || '',
      frequency: drugLabel.slots || {
        morning: false,
        noon: false,
        evening: false,
        bedtime: false
      },
      refrigerate: drugLabel.warnings?.fridge || false,
      shake: drugLabel.warnings?.shake || false,
      noEat: drugLabel.warnings?.noEat || false,
      purpose: drugLabel.purpose || ''
    });
    setMedicationSearchQuery('');
    setShowMedicationSuggestions(false);
  };

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

  const handleIntervalChange = (val: string) => {
    const freq = { morning: false, noon: false, evening: false, bedtime: false };
    if (val === '1 ครั้งต่อวัน') {
      freq.morning = true;
    } else if (val === '2 ครั้งต่อวัน') {
      freq.morning = true;
      freq.evening = true;
    } else if (val === '3 ครั้งต่อวัน') {
      freq.morning = true;
      freq.noon = true;
      freq.evening = true;
    } else if (val === '4 ครั้งต่อวัน') {
      freq.morning = true;
      freq.noon = true;
      freq.evening = true;
      freq.bedtime = true;
    } else if (val === 'ทุก 12 ชั่วโมง') {
      freq.morning = true;
      freq.evening = true;
    } else if (val === 'ทุก 8 ชั่วโมง') {
      freq.morning = true;
      freq.noon = true;
      freq.evening = true;
    } else if (val === 'ทุก 6 ชั่วโมง') {
      freq.morning = true;
      freq.noon = true;
      freq.evening = true;
      freq.bedtime = true;
    } else if (val === 'ทุก 24 ชั่วโมง') {
      freq.morning = true;
    }
    setNewItem(prev => ({
      ...prev,
      interval: val,
      frequency: freq
    }));
  };

  const handleTimingMealChange = (val: string) => {
    let mapped: 'Before' | 'After' | 'With' | 'Other' = 'After';
    if (val === 'ก่อนอาหาร') mapped = 'Before';
    else if (val === 'หลังอาหาร') mapped = 'After';
    else if (val === 'กินพร้อมอาหาร') mapped = 'With';
    else if (val === 'กินตามเวลา') mapped = 'Other';
    setNewItem(prev => ({
      ...prev,
      timingMeal: mapped
    }));
  };

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

  const [injectionPetType, setInjectionPetType] = useState<'dog' | 'cat'>('dog');

  useEffect(() => {
    if (selectedPatient) {
      const sp = (selectedPatient.species || '').toLowerCase();
      if (sp.includes('cat') || sp.includes('แมว')) {
        setInjectionPetType('cat');
      } else {
        setInjectionPetType('dog');
      }
    }
  }, [selectedPatient]);

  useEffect(() => {
    if (newItem.name) {
      const isEyeKeyword = newItem.name.toLowerCase().includes('eye') || 
                           newItem.name.includes('ตา') || 
                           newItem.name.toLowerCase().includes('timolol') || 
                           newItem.name.toLowerCase().includes('หยดตา') || 
                           newItem.name.toLowerCase().includes('ป้ายตา') || 
                           newItem.name.toLowerCase().includes('drop');
                           
      if (isEyeKeyword && (newItem.category === 'Medicine' || !newItem.category)) {
        setNewItem(prev => ({
          ...prev,
          category: 'Eye',
          usageMethod: 'หยอดตา',
          unit: 'หยด',
          eyeOrder: prev.eyeOrder || 'ลำดับที่ 1'
        }));
      }
    }
  }, [newItem.name]);

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

  const handleAddRecord = async (e: React.FormEvent, isParking = false) => {
    if (e) e.preventDefault();
    
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
      const recordData = {
        ...newRecord,
        finalDiagnosis: mainDiagnosis,
        revenue: mainRevenue,
        isFollowUp: newRecord.isFollowUp || false,
        isParked: isParking,
        status: isParking ? 'Parked' : 'Completed',
        billingStatus: isParking ? 'parked' : ((mainRevenue > 0 || newRecord.serviceCharge > 0) ? 'unpaid' : 'none'),
        updatedAt: serverTimestamp()
      };

      if (editingRecordId) {
        await updateDoc(doc(db, 'opd_records', editingRecordId), recordData);
      } else {
        await addDoc(collection(db, 'opd_records'), {
          ...recordData,
          dateVisit: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }

      // 3. Save merged records (only if not parking, usually merge is done at final billing)
      if (!isParking) {
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
        isParked: false,
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
      isParked: record.isParked || false,
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

  const generateRxText = (items: any[]) => {
    if (!items || items.length === 0) return '';
    return items.map((item: any, index: number) => {
      const parts: string[] = [];
      const nameAndQty = `${item.name} (${item.quantity} ${item.unit || 'หน่วย'})`;
      
      const isEye = item.category === 'Eye' || item.type === 'Eye' || (item.name && item.name.toLowerCase().includes('eye'));
      const dosageStr = item.dosage ? `ครั้งละ ${item.dosage} ${item.unit || 'หน่วย'}` : '';
      
      let mainInstruction = '';
      if (item.woundCare) {
        mainInstruction = `ทำแผล${item.woundCareDescription ? `: ${item.woundCareDescription}` : ''}`;
      } else {
        let usage = item.usageMethod || (isEye ? 'หยอดตา' : 'กิน');
        if (isEye && item.usageLocation) {
          usage = `${usage} (${item.usageLocation})`;
        }
        mainInstruction = `${usage} ${dosageStr}`.trim();
      }
      
      if (mainInstruction) {
        parts.push(mainInstruction);
      }
      
      if (item.frequency) {
        const slots: string[] = [];
        if (item.frequency.morning) slots.push('เช้า');
        if (item.frequency.noon) slots.push('กลางวัน');
        if (item.frequency.evening) slots.push('เย็น');
        if (item.frequency.bedtime) slots.push('ก่อนนอน');
        if (slots.length > 0) {
          parts.push(slots.join(', '));
        }
      }
      
      if (item.interval && item.interval !== 'ไม่มีระบุ') {
        parts.push(item.interval);
      }
      
      if (item.timingMeal && !item.woundCare) {
        let mealText = '';
        if (item.timingMeal === 'Before') mealText = 'ก่อนอาหาร (Before Meal)';
        else if (item.timingMeal === 'After') mealText = 'หลังอาหาร (After Meal)';
        else if (item.timingMeal === 'With') mealText = 'พร้อมอาหาร (With Meal)';
        else if (item.timingMeal === 'Other') mealText = 'กินตามเวลา';
        if (mealText) {
          parts.push(mealText);
        }
      }
      
      if (item.timingDetail) {
        parts.push(item.timingDetail);
      }
      
      const conditionWarnings: string[] = [];
      if (item.refrigerate) {
        conditionWarnings.push('เก็บในตู้เย็น');
      }
      if (item.shake) {
        conditionWarnings.push('เขย่าขวดก่อนใช้');
      }
      if (item.onCondition) {
        conditionWarnings.push('เมื่อมีอาการ');
      }
      if (item.purpose) {
        conditionWarnings.push(`สรรพคุณ: ${item.purpose}`);
      }
      
      if (conditionWarnings.length > 0) {
        parts.push(`(${conditionWarnings.join(', ')})`);
      }
      
      return `${index + 1}. ${nameAndQty} - ${parts.join(' ')}`;
    }).join('\n');
  };

  const addItem = () => {
    if (!newItem.name) return;
    const itemToAdd = { ...newItem, id: crypto.randomUUID(), price: newItem.price || 0, petId: targetPetId };

    if (targetPetId === newRecord.patientId) {
      setNewRecord((prev: any) => {
        const nextItems = [...(prev.items || []), itemToAdd];
        const nextRx = generateRxText(nextItems);
        return {
          ...prev,
          items: nextItems,
          recipereRx: nextRx
        };
      });
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
    setNewRecord((prev: any) => {
      const nextItems = (prev.items || []).filter((i: any) => i.id !== item.id);
      const nextRx = generateRxText(nextItems);
      return {
        ...prev,
        items: nextItems,
        recipereRx: nextRx
      };
    });
  };

  const removeItem = (id: string, petId: string) => {
    if (petId === newRecord.patientId) {
      setNewRecord((prev: any) => {
        const nextItems = (prev.items || []).filter((item: any) => item.id !== id);
        const nextRx = generateRxText(nextItems);
        return {
          ...prev,
          items: nextItems,
          recipereRx: nextRx
        };
      });
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
                        record.status === 'Completed' ? "bg-emerald-50 text-emerald-600" : 
                        record.status === 'Parked' ? "bg-amber-100 text-amber-700" :
                        "bg-amber-50 text-amber-600"
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
                            record.billingStatus === 'parked' ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600" :
                            "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                          )}
                          title="Send to Billing"
                        >
                          {record.billingStatus === 'paid' ? 'Paid' : record.billingStatus === 'unpaid' ? 'In Billing' : record.billingStatus === 'parked' ? 'Parked' : 'Billing'}
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
                            type="button"
                            onClick={(e) => handleAddRecord(e as any, true)}
                            className="px-8 py-5 bg-amber-100 text-amber-600 rounded-[2rem] font-black uppercase tracking-widest hover:bg-amber-200 transition-all flex items-center gap-2"
                          >
                            <Clock className="w-5 h-5" /> พักบิล
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

            {/* Resizable Divider Handle */}
            <div 
              className={cn(
                "w-1 group flex flex-col items-center justify-center cursor-col-resize hover:bg-emerald-300 transition-colors z-20 relative",
                isResizing ? "bg-emerald-500" : "bg-slate-100"
              )}
              onMouseDown={startResizing}
            >
              <div className="absolute left-1/2 -translate-x-1/2 w-6 h-12 bg-white rounded-lg shadow-lg border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Right: Medical History Sidebar Column */}
            <div 
              className="bg-white flex flex-col border-l border-slate-100 shadow-[-20px_0_40px_rgba(0,0,0,0.02)]"
              style={{ width: `${rightPanelWidth}px` }}
            >

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

                <div className="mb-6 relative">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                      type="text"
                      value={newItem.name || medicationSearchQuery}
                      onChange={e => {
                        const val = e.target.value;
                        setMedicationSearchQuery(val);
                        setShowMedicationSuggestions(true);
                        
                        if (!val) {
                          setNewItem({...newItem, name: ''});
                        } else {
                          const updates: any = { name: val, category: 'Medicine' };
                          if (val.includes('ทำแผล')) {
                            updates.usageMethod = 'ทำแผล';
                            updates.woundCare = true;
                          }
                          setNewItem({...newItem, ...updates});
                        }
                      }}
                      onFocus={() => setShowMedicationSuggestions(true)}
                      className="w-full bg-slate-50 rounded-2xl border-none pl-12 pr-4 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100 transition-all shadow-inner"
                      placeholder="พิมพ์ค้นหาชื่อยาจากคลัง..."
                    />
                  </div>

                  {/* Medication Suggestions Dropdown */}
                  <AnimatePresence>
                    {showMedicationSuggestions && filteredMedicationSuggestions.length > 0 && (
                      <motion.div 
                        ref={medicationSuggestionsRef}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] max-h-[300px] overflow-y-auto"
                      >
                        {filteredMedicationSuggestions.map((product) => (
                          <div 
                            key={product.id}
                            onClick={() => selectMedication(product)}
                            className="px-6 py-4 hover:bg-emerald-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 group"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex flex-col">
                                <p className="text-sm font-black text-slate-800 group-hover:text-emerald-600 transition-colors">
                                  {product.name}
                                </p>
                                {product.genericName && (
                                  <p className="text-[10px] font-bold text-slate-400">
                                    {product.genericName}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-emerald-500">
                                  {product.price?.toLocaleString()} THB
                                </p>
                                <p className="text-[9px] font-bold text-slate-400">
                                  In Stock: {product.currentStock} {product.unit}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  {/* Detailed Drug Label Form */}
                  {newItem.name && (
                    <div className="p-5 bg-white rounded-3xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-300 shadow-xl shadow-slate-100/50">
                      
                      {/* Brand Label Setting Header */}
                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 flex-wrap gap-2">
                        <span className="text-[10px] font-black text-slate-500">รายละเอียดฉลากยา (Label Settings)</span>
                        <button
                          type="button"
                          onClick={() => setNewItem({ ...newItem, name: '' })}
                          className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {(() => {
                        const isEyeMedicine = newItem.category === 'Eye' || ((newItem.type as string) === 'Eye');
                        
                        if (isEyeMedicine) {
                          const isLeftEyeSelected = (newItem.usageLocation || '').includes('ตาซ้าย');
                          const isRightEyeSelected = (newItem.usageLocation || '').includes('ตาขวา');
                          
                          const toggleLeftEye = () => {
                            let newLocation = '';
                            if (isLeftEyeSelected && isRightEyeSelected) {
                              newLocation = 'ตาขวา';
                            } else if (isLeftEyeSelected && !isRightEyeSelected) {
                              newLocation = '';
                            } else if (!isLeftEyeSelected && isRightEyeSelected) {
                              newLocation = 'ตาซ้าย, ตาขวา';
                            } else {
                              newLocation = 'ตาซ้าย';
                            }
                            setNewItem({
                              ...newItem,
                              usageLocation: newLocation,
                              usageMethod: (newItem.eyeOrder && newItem.eyeOrder !== 'ไม่มีระบุ') ? `หยอดตา - ` + newItem.eyeOrder : 'หยอดตา'
                            });
                          };

                          const toggleRightEye = () => {
                            let newLocation = '';
                            if (isLeftEyeSelected && isRightEyeSelected) {
                              newLocation = 'ตาซ้าย';
                            } else if (!isLeftEyeSelected && isRightEyeSelected) {
                              newLocation = '';
                            } else if (isLeftEyeSelected && !isRightEyeSelected) {
                              newLocation = 'ตาซ้าย, ตาขวา';
                            } else {
                              newLocation = 'ตาขวา';
                            }
                            setNewItem({
                              ...newItem,
                              usageLocation: newLocation,
                              usageMethod: (newItem.eyeOrder && newItem.eyeOrder !== 'ไม่มีระบุ') ? `หยอดตา - ` + newItem.eyeOrder : 'หยอดตา'
                            });
                          };

                          return (
                            <>
                              {/* Row 1: ชื่อยา + ประเภทยา (Auto) */}
                              <div className="grid grid-cols-12 gap-2 animate-in fade-in duration-200">
                                <div className="col-span-12 md:col-span-5 flex flex-col gap-1 min-w-0">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อยา</span>
                                  <input 
                                    type="text" 
                                    value={newItem.name || ''} 
                                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="ชื่อยา..."
                                  />
                                </div>
                                
                                <div className="col-span-12 md:col-span-7 flex flex-col gap-1 min-w-0">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ประเภทยา (ขึ้น Auto ตามฐานข้อมูล)</span>
                                  <select 
                                    value={newItem.category || 'Eye'} 
                                    onChange={e => {
                                      const cat = e.target.value;
                                      setNewItem({
                                        ...newItem, 
                                        category: cat,
                                        usageMethod: cat === 'Eye' ? 'หยอดตา' : 'กิน'
                                      });
                                    }}
                                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer text-emerald-600 bg-emerald-50/10"
                                  >
                                    <option value="Eye">Eye Medicine (ยาใช้กับดวงตา)</option>
                                    <option value="Medicine">Medicine (ยาทั่วไป)</option>
                                    <option value="Anti-parasite">Anti-parasite (ยาฆ่าพยาธิ)</option>
                                    <option value="Vaccine">Vaccine (ยาคุม/วัคซีน)</option>
                                    <option value="Supplies">Supplies (เวชภัณฑ์)</option>
                                    <option value="Food">Food (อาหาร)</option>
                                    <option value="Other">Other (อื่น ๆ)</option>
                                  </select>
                                </div>
                              </div>

                              {/* Row 2: จำนวนที่ใช้ต่อครั้ง + หน่วย + ใช้วันละกี่ครั้งต่อวัน */}
                              <div className="grid grid-cols-12 gap-2 animate-in fade-in duration-200">
                                <div className="col-span-4 flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">จำนวนที่ใช้ต่อครั้ง</span>
                                  <input 
                                    type="text" 
                                    value={newItem.dosage || ''} 
                                    onChange={e => setNewItem({...newItem, dosage: e.target.value})}
                                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-center focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="จำนวน..."
                                  />
                                </div>
                                
                                <div className="col-span-3 flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">หน่วย</span>
                                  <select 
                                    value={newItem.unit || 'หยด'} 
                                    onChange={e => setNewItem({...newItem, unit: e.target.value})}
                                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-2 py-2 text-xs font-black focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                  >
                                    {['หยด', 'ป้าย', 'มิลลิลิตร', 'เม็ด', 'หลอด', 'g', 'ซีซี'].map(u => (
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="col-span-5 flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ใช้วันละกี่ครั้งต่อวัน</span>
                                  <select 
                                    value={newItem.interval || '2 ครั้งต่อวัน'} 
                                    onChange={e => setNewItem({...newItem, interval: e.target.value})}
                                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                  >
                                    <option value="1 ครั้งต่อวัน">1 ครั้งต่อวัน</option>
                                    <option value="2 ครั้งต่อวัน">2 ครั้งต่อวัน</option>
                                    <option value="3 ครั้งต่อวัน">3 ครั้งต่อวัน</option>
                                    <option value="4 ครั้งต่อวัน">4 ครั้งต่อวัน</option>
                                    <option value="ทุก 12 ชั่วโมง">ทุก 12 ชั่วโมง</option>
                                    <option value="ทุก 8 ชั่วโมง">ทุก 8 ชั่วโมง</option>
                                    <option value="ทุก 6 ชั่วโมง">ทุก 6 ชั่วโมง</option>
                                    <option value="หยอดเมื่อมีอาการระคายเคือง">หยอดเมื่อมีอาการระคายเคือง</option>
                                  </select>
                                </div>
                              </div>

                              {/* Row 3: ลำดับที่ + ข้อควรระวัง */}
                              <div className="grid grid-cols-12 gap-2 animate-in fade-in duration-200">
                                <div className="col-span-4 flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ลำดับที่</span>
                                  <select 
                                    value={newItem.eyeOrder || 'ลำดับที่ 1'} 
                                    onChange={e => {
                                      const order = e.target.value;
                                      setNewItem({
                                        ...newItem, 
                                        eyeOrder: order,
                                        usageMethod: order === 'ไม่มีระบุ' ? 'หยอดตา' : `หยอดตา - ` + order
                                      });
                                    }}
                                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                  >
                                    <option value="ลำดับที่ 1">ลำดับที่ 1</option>
                                    <option value="ลำดับที่ 2">ลำดับที่ 2</option>
                                    <option value="ลำดับที่ 3">ลำดับที่ 3</option>
                                    <option value="ลำดับที่ 4">ลำดับที่ 4</option>
                                    <option value="ลำดับที่ 5">ลำดับที่ 5</option>
                                    <option value="ไม่มีระบุ">ไม่มีระบุ</option>
                                  </select>
                                </div>

                                <div className="col-span-8 flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ข้อควรระวัง</span>
                                  <input 
                                    type="text" 
                                    value={newItem.purpose || ''} 
                                    onChange={e => setNewItem({...newItem, purpose: e.target.value})}
                                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="พิมพ์หรือเลือกข้อควรระวัง..."
                                  />
                                </div>
                              </div>

                              {/* Precaution quick selections */}
                              <div className="flex flex-wrap gap-1">
                                {[
                                  "เก็บให้พ้นแสง",
                                  "เขย่าขวดก่อนใช้",
                                  "เก็บในตู้เย็น ห้ามแช่แข็ง",
                                  "ใช้เสร็จปัดหัวให้สะอาด",
                                  "หยอดห่างจากยาขวดอื่น 5-10 นาที"
                                ].map(warn => (
                                  <button
                                    key={warn}
                                    type="button"
                                    onClick={() => setNewItem({...newItem, purpose: warn})}
                                    className="text-[9px] font-bold text-teal-600 bg-teal-50/30 border border-teal-100 hover:bg-teal-50 px-2.5 py-0.5 rounded-lg transition-colors"
                                  >
                                    {warn}
                                  </button>
                                ))}
                              </div>

                              {/* Dual-Diagram Row: Left dog/cat animal map, Right interactive eye drop drawer */}
                              <div className="grid grid-cols-12 gap-3 animate-in fade-in duration-300">
                                
                                {/* 1. Dog/Cat Representative Image Card */}
                                <div className="col-span-12 lg:col-span-6 bg-slate-50/40 rounded-2xl border border-slate-100 p-3 flex flex-col gap-2.5 relative overflow-hidden">
                                  <div className="flex items-center justify-between border-b border-slate-200/50 pb-1.5 flex-wrap gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">รูปภาพตัวแทนสัตว์</span>
                                    <div className="flex rounded-xl bg-slate-200/60 p-0.5 border border-slate-200 text-[9px]">
                                      <button 
                                        type="button" 
                                        onClick={() => setInjectionPetType('dog')}
                                        className={cn(
                                          "px-2.5 py-0.5 rounded-lg font-black transition-all",
                                          injectionPetType === 'dog' ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                        )}
                                      >
                                        หมา (Dog)
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => setInjectionPetType('cat')}
                                        className={cn(
                                          "px-2.5 py-0.5 rounded-lg font-black transition-all",
                                          injectionPetType === 'cat' ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                        )}
                                      >
                                        แมว (Cat)
                                      </button>
                                    </div>
                                  </div>

                                  <div 
                                    className="relative aspect-[4/3] bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
                                  >
                                    <div className="absolute inset-0 pointer-events-none z-[1]" />
                                    <div className="w-full h-full p-4 flex items-center justify-center pointer-events-none">
                                      <svg viewBox="0 0 200 240" className="w-full h-full max-h-[160px] select-none">
                                        {injectionPetType === 'dog' ? (
                                          <g fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Ears */}
                                            <path d="M 75 35 C 60 40, 55 65, 65 75 C 70 80, 75 75, 75 65 Z" fill="#f8fafc" />
                                            <path d="M 125 35 C 140 40, 145 65, 135 75 C 130 80, 125 75, 125 65 Z" fill="#f8fafc" />
                                            {/* Head */}
                                            <path d="M 75 55 C 75 35, 125 35, 125 55 C 125 70, 75 70, 75 55 Z" fill="#f8fafc" />
                                            {/* Dog Snout */}
                                            <ellipse cx="100" cy="62" rx="10" ry="8" fill="#f1f5f9" stroke="#cbd5e1" />
                                            <circle cx="100" cy="58" r="3" fill="#64748b" />
                                            {/* Body */}
                                            <path d="M 75 65 C 65 85, 45 80, 35 90 C 25 100, 30 110, 45 105 C 55 100, 65 100, 70 115 C 65 135, 65 155, 55 165 C 45 175, 35 178, 38 190 C 42 198, 55 193, 65 183 C 75 173, 85 178, 100 178 C 115 178, 125 173, 135 183 C 145 193, 158 198, 162 190 C 165 178, 155 175, 145 165 C 135 155, 135 135, 130 115 C 135 100, 145 100, 155 105 C 170 110, 175 100, 165 90 C 155 80, 135 85, 125 65" fill="#f8fafc" />
                                            {/* Tail */}
                                            <path d="M 100 178 C 100 205, 115 215, 120 210" />
                                          </g>
                                        ) : (
                                          <g fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Pointy Ears */}
                                            <polygon points="75,35 60,15 85,32" fill="#f8fafc" />
                                            <polygon points="125,35 140,15 115,32" fill="#f8fafc" />
                                            {/* Head */}
                                            <path d="M 75 50 C 75 30, 125 30, 125 50 C 125 68, 75 68, 75 50 Z" fill="#f8fafc" />
                                            {/* Whiskers */}
                                            <line x1="68" y1="52" x2="52" y2="50" stroke="#cbd5e1" />
                                            <line x1="68" y1="55" x2="50" y2="56" stroke="#cbd5e1" />
                                            <line x1="132" y1="52" x2="148" y2="50" stroke="#cbd5e1" />
                                            <line x1="132" y1="55" x2="150" y2="56" stroke="#cbd5e1" />
                                            {/* Body */}
                                            <path d="M 78 58 C 70 80, 50 78, 40 85 C 30 92, 32 102, 45 98 C 55 95, 62 95, 68 110 C 62 135, 62 155, 52 165 C 42 175, 32 178, 35 190 C 38 198, 50 193, 60 183 C 70 173, 80 180, 100 180 C 120 180, 130 173, 140 183 C 150 193, 162 198, 165 190 C 168 178, 158 175, 148 165 C 138 155, 138 135, 132 110 C 138 95, 145 95, 155 98 C 168 102, 170 92, 160 85 C 150 78, 130 80, 122 58" fill="#f8fafc" />
                                            {/* Tail */}
                                            <path d="M 100 180 C 100 205, 90 225, 105 230 C 115 232, 118 220, 115 210" />
                                          </g>
                                        )}
                                      </svg>
                                    </div>

                                    <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xl px-2.5 py-1 rounded-lg border border-slate-100 shadow flex flex-col z-10 pointer-events-none text-left">
                                      <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-wider leading-none">ตำแหน่งหลัก</span>
                                      <div className="text-[10px] font-black text-emerald-600 truncate max-w-[100px] mt-0.5 leading-tight">
                                        {newItem.usageLocation || 'ระบุบนตัวหมา/แมว...'}
                                      </div>
                                    </div>
                                  </div>

                                  <input 
                                    type="text"
                                    value={newItem.usageLocation || ''}
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
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-bold outline-none focus:ring-2 focus:ring-emerald-500/10"
                                    placeholder="แต่งเติม เช่น หาง, หูซ้าย..."
                                  />
                                </div>

                                {/* 2. Eye Drop location Large Diagram Card */}
                                <div className="col-span-12 lg:col-span-6 bg-slate-50/40 border border-slate-100 rounded-2xl p-3 flex flex-col gap-2.5 relative overflow-hidden justify-between">
                                  <div className="flex items-center justify-between border-b border-slate-200/50 pb-1.5 flex-wrap gap-1.5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">ตำแหน่งที่รักษาเรื่องตา (Ophthalmic)</span>
                                    <div className="flex rounded-xl bg-slate-250/60 p-0.5 border border-slate-200 text-[9px]">
                                      <button 
                                        type="button" 
                                        onClick={toggleLeftEye}
                                        className={cn(
                                          "px-2.5 py-0.5 rounded-lg font-black transition-all",
                                          isLeftEyeSelected ? "bg-teal-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                                        )}
                                      >
                                        ซ้าย
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={toggleRightEye}
                                        className={cn(
                                          "px-2.5 py-0.5 rounded-lg font-black transition-all",
                                          isRightEyeSelected ? "bg-teal-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                                        )}
                                      >
                                        ขวา
                                      </button>
                                    </div>
                                  </div>

                                  {/* Interactive Double Eyes Box */}
                                  <div className="grid grid-cols-2 gap-2 bg-white rounded-xl border border-slate-200 p-2">
                                    {/* Left Eye panel */}
                                    <div 
                                      onClick={toggleLeftEye}
                                      className={cn(
                                        "flex flex-col items-center justify-center p-2 rounded-lg border border-dashed transition-all cursor-pointer group text-center select-none",
                                        isLeftEyeSelected 
                                          ? "bg-teal-50/40 border-teal-500 ring-2 ring-teal-500/10 animate-fade-in" 
                                          : "bg-slate-50/30 border-slate-200 hover:border-teal-300 hover:bg-slate-50"
                                      )}
                                    >
                                      <span className="text-[8px] font-black uppercase tracking-wider mb-1 text-slate-400 group-hover:text-teal-500 transition-colors">
                                        ตาซ้าย (Left Eye)
                                      </span>
                                      <div className={cn("w-14 text-slate-300 transition-colors duration-300", isLeftEyeSelected ? "text-teal-500" : "group-hover:text-slate-400")}>
                                        <svg viewBox="0 0 160 80" className="w-full h-auto drop-shadow-sm">
                                          <path d="M10,40 Q80,5 150,40 Q80,75 10,40 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                          <circle cx="80" cy="40" r="22" fill="none" stroke="currentColor" strokeWidth="2" />
                                          <circle cx="80" cy="40" r="10" fill="currentColor" />
                                          <circle cx="74" cy="34" r="3.5" fill="white" />
                                          <circle cx="86" cy="44" r="1.5" fill="white" />
                                        </svg>
                                      </div>
                                      {isLeftEyeSelected && (
                                        <span className="mt-1 text-[7.5px] font-black bg-teal-500 text-white px-2 py-0.5 rounded-full leading-none">
                                          ACTIVE
                                        </span>
                                      )}
                                    </div>

                                    {/* Right Eye panel */}
                                    <div 
                                      onClick={toggleRightEye}
                                      className={cn(
                                        "flex flex-col items-center justify-center p-2 rounded-lg border border-dashed transition-all cursor-pointer group text-center select-none",
                                        isRightEyeSelected 
                                          ? "bg-teal-50/40 border-teal-500 ring-2 ring-teal-500/10 animate-fade-in" 
                                          : "bg-slate-50/30 border-slate-200 hover:border-teal-300 hover:bg-slate-50"
                                      )}
                                    >
                                      <span className="text-[8px] font-black uppercase tracking-wider mb-1 text-slate-400 group-hover:text-teal-500 transition-colors">
                                        ตาขวา (Right Eye)
                                      </span>
                                      <div className={cn("w-14 text-slate-300 transition-colors duration-300", isRightEyeSelected ? "text-teal-500" : "group-hover:text-slate-400")}>
                                        <svg viewBox="0 0 160 80" className="w-full h-auto drop-shadow-sm">
                                          <path d="M10,40 Q80,5 150,40 Q80,75 10,40 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                          <circle cx="80" cy="40" r="22" fill="none" stroke="currentColor" strokeWidth="2" />
                                          <circle cx="80" cy="40" r="10" fill="currentColor" />
                                          <circle cx="74" cy="34" r="3.5" fill="white" />
                                          <circle cx="86" cy="44" r="1.5" fill="white" />
                                        </svg>
                                      </div>
                                      {isRightEyeSelected && (
                                        <span className="mt-1 text-[7.5px] font-black bg-teal-500 text-white px-2 py-0.5 rounded-full leading-none">
                                          ACTIVE
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="bg-teal-500/10 p-2 rounded-xl text-[8px] font-bold text-teal-700 leading-normal">
                                    💡 <span className="font-black">หยอดตารวม:</span> สามารถกดเลือกที่ดวงตา หรือพิมพ์ระบุแมนนวล เช่น "ตาขวา" ได้ ระบบจะอัปเดตฉลากยาให้อัตโนมัติ
                                  </div>
                                </div>
                              </div>

                              {/* Secondary Settings Panel: Fridge, Shake, On condition & WoundCare */}
                              <div className="p-4 bg-slate-50/30 border border-slate-100 rounded-2xl grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={newItem.refrigerate || false} 
                                      onChange={e => setNewItem({...newItem, refrigerate: e.target.checked})} 
                                      className="w-4 h-4 text-sky-500 rounded border-slate-200" 
                                    />
                                    <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest">เก็บในตู้เย็น (Fridge)</span>
                                  </label>
                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={newItem.shake || false} 
                                      onChange={e => setNewItem({...newItem, shake: e.target.checked})} 
                                      className="w-4 h-4 text-[#00b4d8] rounded border-slate-200" 
                                    />
                                    <span className="text-[10px] font-black text-[#00b4d8] uppercase tracking-widest">เขย่าก่อนใช้ (Shake)</span>
                                  </label>
                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={newItem.onCondition || false} 
                                      onChange={e => setNewItem({...newItem, onCondition: e.target.checked})} 
                                      className="w-4 h-4 text-emerald-500 rounded border-slate-200" 
                                    />
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">เมื่อมีอาการ (As needed)</span>
                                  </label>
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={newItem.woundCare || false} 
                                      onChange={e => setNewItem({...newItem, woundCare: e.target.checked})} 
                                      className="w-4 h-4 text-rose-500 rounded border-slate-200" 
                                    />
                                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">ต้องการทำแผล (WoundCare)</span>
                                  </label>
                                  {newItem.woundCare && (
                                    <input 
                                      type="text"
                                      value={newItem.woundCareDescription || ''}
                                      onChange={e => setNewItem({...newItem, woundCareDescription: e.target.value})}
                                      placeholder="รายละเอียดการผลิตหรือทำแผล..."
                                      className="w-full bg-rose-50/50 rounded-xl border border-rose-100 px-3 py-1.5 text-xs font-bold outline-none placeholder:text-rose-300 text-rose-600"
                                    />
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        }

                        const isInjectionOrVaccine = newItem.type === 'Injection' || newItem.category === 'Vaccine';
                        if (isInjectionOrVaccine) {
                          return (
                            <>
                              {/* Row 1: ชื่อยา + ประเภทยา (Auto) */}
                              <div className="grid grid-cols-12 gap-2">
                                <div className="col-span-6 flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อยา</span>
                                  <input 
                                    type="text" 
                                    value={newItem.name || ''} 
                                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="ชื่อยา..."
                                  />
                                </div>
                                
                                <div className="col-span-6 flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ประเภทยา (ขึ้น Auto ตามฐานข้อมูล)</span>
                                  <select 
                                    value={newItem.category || 'Medicine'} 
                                    onChange={e => setNewItem({...newItem, category: e.target.value})}
                                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                  >
                                    <option value="Medicine">Medicine (ยาทั่วไป)</option>
                                    <option value="Anti-parasite">Anti-parasite (ยาฆ่าพยาธิ)</option>
                                    <option value="Vaccine">Vaccine (ยาคุม/วัคซีน)</option>
                                    <option value="Eye">Eye Medicine (ยาใช้กับดวงตา)</option>
                                    <option value="Supplies">Supplies (เวชภัณฑ์)</option>
                                    <option value="Food">Food (อาหาร)</option>
                                    <option value="Other">Other (อื่น ๆ)</option>
                                  </select>
                                </div>
                              </div>

                              {/* Row 2: ตำแหน่งที่ฉีด + ข้อควรระวัง */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ตำแหน่งที่ฉีด</span>
                                  <input 
                                    type="text" 
                                    value={newItem.usageLocation || ''} 
                                    onChange={e => setNewItem({...newItem, usageLocation: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="ระบุตำแหน่ง หรือจิ้มภาพด้านล่าง..."
                                  />
                                </div>

                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ข้อควรระวัง</span>
                                  <input 
                                    type="text" 
                                    value={newItem.purpose || ''} 
                                    onChange={e => setNewItem({...newItem, purpose: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="เลือกหรือพิมพ์คัดกรองเบื้องต้น..."
                                  />
                                </div>
                              </div>

                              {/* Warning quick-select row */}
                              <div className="flex flex-wrap gap-1">
                                {[
                                  "ไม่มีข้อควรระวังพิเศษ",
                                  "สังเกตอาการแพ้หลังฉีด 15-30 นาที",
                                  "ประคบเย็นหากมีอาการบวมแดง",
                                  "สลับตำแหน่งเข็มห้ามฉีดซ้ำจุดเดิม",
                                  "เก็บในตู้เย็นห้ามแช่แข็ง"
                                ].map(warn => (
                                  <button
                                    key={warn}
                                    type="button"
                                    onClick={() => setNewItem({...newItem, purpose: warn})}
                                    className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-0.5 rounded-lg"
                                  >
                                    {warn}
                                  </button>
                                ))}
                              </div>

                              {/* Row 3: Interactive Animal Map and Blue Box layout */}
                              <div className="grid grid-cols-12 gap-3">
                                {/* Left Card: 3D-Like / Schematic Pet outline with tabs */}
                                <div className="col-span-7 bg-slate-50/40 rounded-2xl border border-slate-100 p-3 flex flex-col gap-3 relative overflow-hidden">
                                  <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 flex-wrap gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">รูปภาพตัวแทนสัตว์</span>
                                    <div className="flex rounded-xl bg-slate-200/60 p-0.5 border border-slate-200 text-[10px]">
                                      <button 
                                        type="button" 
                                        onClick={() => setInjectionPetType('dog')}
                                        className={cn(
                                          "px-3 py-1 rounded-lg font-black transition-all",
                                          injectionPetType === 'dog' ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                        )}
                                      >
                                        หมา (Dog)
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => setInjectionPetType('cat')}
                                        className={cn(
                                          "px-3 py-1 rounded-lg font-black transition-all",
                                          injectionPetType === 'cat' ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                        )}
                                      >
                                        แมว (Cat)
                                      </button>
                                    </div>
                                  </div>

                                  {/* Interactive Vector Overlay Map */}
                                  <div className="bg-white rounded-xl border border-slate-100/80 p-2 flex items-center justify-center relative aspect-[1.1] min-h-[220px]">
                                    {/* L / R Margin Labels */}
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300 font-mono">L</span>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300 font-mono">R</span>

                                    {/* SVG Outline based on species */}
                                    <svg viewBox="0 0 200 240" className="w-full h-full max-h-[220px] select-none">
                                      {/* Dynamic Silhouette */}
                                      {injectionPetType === 'dog' ? (
                                        <g fill="none" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          {/* Ears */}
                                          <path d="M 75 35 C 60 40, 55 65, 65 75 C 70 80, 75 75, 75 65 Z" fill="#f8fafc" />
                                          <path d="M 125 35 C 140 40, 145 65, 135 75 C 130 80, 125 75, 125 65 Z" fill="#f8fafc" />
                                          {/* Head */}
                                          <path d="M 75 55 C 75 35, 125 35, 125 55 C 125 70, 75 70, 75 55 Z" fill="#f8fafc" />
                                          {/* Dog Snout */}
                                          <ellipse cx="100" cy="62" rx="10" ry="8" fill="#f1f5f9" stroke="#cbd5e1" />
                                          <circle cx="100" cy="58" r="3" fill="#64748b" />
                                          {/* Body */}
                                          <path d="M 75 65 C 65 85, 45 80, 35 90 C 25 100, 30 110, 45 105 C 55 100, 65 100, 70 115 C 65 135, 65 155, 55 165 C 45 175, 35 178, 38 190 C 42 198, 55 193, 65 183 C 75 173, 85 178, 100 178 C 115 178, 125 173, 135 183 C 145 193, 158 198, 162 190 C 165 178, 155 175, 145 165 C 135 155, 135 135, 130 115 C 135 100, 145 100, 155 105 C 170 110, 175 100, 165 90 C 155 80, 135 85, 125 65" fill="#f8fafc" />
                                          {/* Tail */}
                                          <path d="M 100 178 C 100 205, 115 215, 120 210" />
                                        </g>
                                      ) : (
                                        <g fill="none" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          {/* Pointy Ears */}
                                          <polygon points="75,35 60,15 85,32" fill="#f8fafc" />
                                          <polygon points="125,35 140,15 115,32" fill="#f8fafc" />
                                          {/* Head */}
                                          <path d="M 75 50 C 75 30, 125 30, 125 50 C 125 68, 75 68, 75 50 Z" fill="#f8fafc" />
                                          {/* Whiskers */}
                                          <line x1="68" y1="52" x2="52" y2="50" stroke="#cbd5e1" />
                                          <line x1="68" y1="55" x2="50" y2="56" stroke="#cbd5e1" />
                                          <line x1="132" y1="52" x2="148" y2="50" stroke="#cbd5e1" />
                                          <line x1="132" y1="55" x2="150" y2="56" stroke="#cbd5e1" />
                                          {/* Body */}
                                          <path d="M 78 58 C 70 80, 50 78, 40 85 C 30 92, 32 102, 45 98 C 55 95, 62 95, 68 110 C 62 135, 62 155, 52 165 C 42 175, 32 178, 35 190 C 38 198, 50 193, 60 183 C 70 173, 80 180, 100 180 C 120 180, 130 173, 140 183 C 150 193, 162 198, 165 190 C 168 178, 158 175, 148 165 C 138 155, 138 135, 132 110 C 138 95, 145 95, 155 98 C 168 102, 170 92, 160 85 C 150 78, 130 80, 122 58" fill="#f8fafc" />
                                          {/* Tail */}
                                          <path d="M 100 180 C 100 205, 90 225, 105 230 C 115 232, 118 220, 115 210" />
                                        </g>
                                      )}

                                      {/* Highlighting selected hot-spots */}
                                      {[
                                        { id: 'neck', name: 'ต้นคอ', x: 100, y: 75, type: 'SC' },
                                        { id: 'shoulder_l', name: 'หัวไหล่ซ้าย', x: 62, y: 88, type: 'IM' },
                                        { id: 'shoulder_r', name: 'หัวไหล่ขวา', x: 138, y: 88, type: 'IM' },
                                        { id: 'back', name: 'กลางหลัง', x: 100, y: 125, type: 'SC' },
                                        { id: 'flank_l', name: 'ข้างตัวซ้าย', x: 70, y: 140, type: 'SC' },
                                        { id: 'flank_r', name: 'ข้างตัวขวา', x: 130, y: 140, type: 'SC' },
                                        { id: 'hip_l', name: 'สะโพกซ้าย', x: 75, y: 170, type: 'IM' },
                                        { id: 'hip_r', name: 'สะโพกขวา', x: 125, y: 170, type: 'IM' },
                                      ].map(target => {
                                        const isSelected = (newItem.usageLocation || '').includes(target.name);
                                        return (
                                          <g 
                                            key={target.id}
                                            className="cursor-pointer group/spot"
                                            onClick={() => {
                                              // Extract existing route prefix if any, like "SC" or "IM"
                                              const currentRouteMatch = (newItem.usageLocation || '').match(/^(SC|IM|IV|Fluid)/);
                                              const prefix = currentRouteMatch ? currentRouteMatch[0] : target.type;
                                              setNewItem({
                                                ...newItem,
                                                usageLocation: `${prefix} - ${target.name}`
                                              });
                                            }}
                                          >
                                            {/* Outer Glow / Radar Ring */}
                                            {isSelected && (
                                              <circle 
                                                cx={target.x} 
                                                cy={target.y} 
                                                r="14" 
                                                className="fill-sky-400/20 stroke-sky-400 animate-pulse"
                                              />
                                            )}
                                            {/* Main Interactive Circle */}
                                            <circle 
                                              cx={target.x} 
                                              cy={target.y} 
                                              r={isSelected ? "8" : "6"} 
                                              className={cn(
                                                "transition-all duration-300",
                                                isSelected 
                                                  ? (target.type === 'SC' ? "fill-emerald-500 stroke-white stroke-2 shadow-md" : "fill-sky-500 stroke-white stroke-2 shadow-md") 
                                                  : "fill-slate-300 hover:fill-indigo-400 opacity-60 hover:opacity-100"
                                              )} 
                                            />
                                          </g>
                                        );
                                      })}
                                    </svg>

                                    {/* Helper text */}
                                    <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none">
                                      <p className="text-[8px] font-black tracking-wide text-slate-400 bg-white/95 backdrop-blur-md py-1 px-1.5 rounded-lg border border-slate-100 inline-block shadow-sm">
                                        จิ้มตำแหน่งบนรูปภาพเพื่อระบุพิกัดฉีด
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Card: Blue "กรณียาฉีด / วัคซีน" quick methods list */}
                                <div className="col-span-5 flex flex-col gap-2 bg-gradient-to-br from-indigo-50/50 to-sky-50/50 rounded-2xl border border-indigo-100/60 p-3 justify-between">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100/70">
                                      <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">กรณียาฉีด / วัคซีน</span>
                                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                    </div>
                                    
                                    <span className="text-[8px] font-bold text-slate-400 block leading-tight">
                                      เลือกเส้นทางบริหารยาเพื่อติดหน้าตำแหน่ง
                                    </span>

                                    <div className="flex flex-col gap-1.5">
                                      {[
                                        { id: 'SC', label: 'SC - ใต้ผิวหนัง', desc: 'Subcutaneous' },
                                        { id: 'IM', label: 'IM - เข้ากล้ามเนื้อ', desc: 'Intramuscular' },
                                        { id: 'IV', label: 'IV - เข้าเส้นเลือดดำ', desc: 'Intravenous' },
                                        { id: 'Fluid', label: 'Fluid - สารน้ำใต้ผิวหนัง', desc: 'SC Fluids' },
                                      ].map(method => {
                                        const isSelected = (newItem.usageLocation || '').startsWith(method.id);
                                        return (
                                          <button
                                            key={method.id}
                                            type="button"
                                            onClick={() => {
                                              const currentLoc = (newItem.usageLocation || '').replace(/^(SC|IM|IV|Fluid)\s*-\s*/, '');
                                              setNewItem({
                                                ...newItem,
                                                usageLocation: method.id + (currentLoc ? ` - ${currentLoc}` : ' - ')
                                              });
                                            }}
                                            className={cn(
                                              "flex items-center justify-between p-2 rounded-xl border text-left transition-all active:scale-95",
                                              isSelected 
                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100/50 hover:border-slate-300"
                                            )}
                                          >
                                            <span className="text-[10px] font-black">{method.label}</span>
                                            <span className="text-[8px] opacity-75 font-mono">{method.desc}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100/50 text-[9px] text-slate-500 font-bold leading-normal">
                                    💡 <span className="font-black text-slate-700">แนะนำ:</span> สามารถพิมพ์ต่อท้ายในช่อง "ตำแหน่งที่ฉีด" เพื่อแต่งเติมรายละเอียด เช่น ซ้าย/ขวา ซ้ำได้
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        }

                        // Otherwise show Standard Oral Form
                        return (
                          <>
                            {/* Row 1: ชื่อยา + จำนวนที่ใช้ต่อครั้ง + หน่วย */}
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-6 flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อยา</span>
                                <input 
                                  type="text" 
                                  value={newItem.name || ''} 
                                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                                  className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                  placeholder="ชื่อยา..."
                                />
                              </div>
                              <div className="col-span-3 flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">ปริมาณ/ครั้ง</span>
                                <input 
                                  type="text" 
                                  value={newItem.dosage || ''} 
                                  onChange={e => setNewItem({...newItem, dosage: e.target.value})}
                                  className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-2 py-2 text-xs font-black text-center focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                  placeholder="จำนวน..."
                                />
                              </div>
                              <div className="col-span-3 flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">หน่วย</span>
                                <select 
                                  value={newItem.unit || 'เม็ด'} 
                                  onChange={e => setNewItem({...newItem, unit: e.target.value})}
                                  className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-2 py-2 text-xs font-black focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                >
                                  {['เม็ด', 'มิลลิลิตร', 'แคปซูล', 'ช้อนชา', 'หยด', 'หลอด', 'ซอง', 'ขวด', 'ซีซี', 'g'].map(u => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Row 2: ประเภทยา (Auto) + ใช้วันละกี่ครั้งต่อวัน */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ประเภทยา (ขึ้น Auto ตามฐานข้อมูล)</span>
                                <select 
                                  value={newItem.category || 'Medicine'} 
                                  onChange={e => setNewItem({...newItem, category: e.target.value})}
                                  className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                >
                                  <option value="Medicine">Medicine (ยาทั่วไป)</option>
                                  <option value="Anti-parasite">Anti-parasite (ยาฆ่าพยาธิ)</option>
                                  <option value="Vaccine">Vaccine (ยาคุม/วัคซีน)</option>
                                  <option value="Eye">Eye Medicine (ยาใช้กับดวงตา)</option>
                                  <option value="Supplies">Supplies (เวชภัณฑ์)</option>
                                  <option value="Food">Food (อาหาร)</option>
                                  <option value="Other">Other (อื่น ๆ)</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ใช้วันละกี่ครั้งต่อวัน</span>
                                <select 
                                  value={newItem.interval || '1 ครั้งต่อวัน'} 
                                  onChange={e => handleIntervalChange(e.target.value)}
                                  className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                >
                                  <option value="1 ครั้งต่อวัน">1 ครั้งต่อวัน</option>
                                  <option value="2 ครั้งต่อวัน">2 ครั้งต่อวัน</option>
                                  <option value="3 ครั้งต่อวัน">3 ครั้งต่อวัน</option>
                                  <option value="4 ครั้งต่อวัน">4 ครั้งต่อวัน</option>
                                  <option value="ทุก 24 ชั่วโมง">ทุก 24 ชั่วโมง</option>
                                  <option value="ทุก 12 ชั่วโมง">ทุก 12 ชั่วโมง</option>
                                  <option value="ทุก 8 ชั่วโมง">ทุก 8 ชั่วโมง</option>
                                  <option value="ทุก 6 ชั่วโมง">ทุก 6 ชั่วโมง</option>
                                  <option value="ทุก 4 ชั่วโมง">ทุก 4 ชั่วโมง</option>
                                </select>
                              </div>
                            </div>

                            {/* Row 3: เวลาที่กิน + กรณียากิน / ยาพ่น Container (Flexible layout) */}
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">เวลาที่กิน (ก่อนอาหาร / หลังอาหาร / กินตามเวลา)</span>
                                <select 
                                  value={newItem.timingMeal === 'Before' ? 'ก่อนอาหาร' : newItem.timingMeal === 'After' ? 'หลังอาหาร' : newItem.timingMeal === 'With' ? 'กินพร้อมอาหาร' : 'กินตามเวลา'} 
                                  onChange={e => handleTimingMealChange(e.target.value)}
                                  className="w-full bg-slate-50/50 rounded-xl border border-slate-100 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                >
                                  <option value="ก่อนอาหาร">ก่อนอาหาร (Before Meal)</option>
                                  <option value="หลังอาหาร">หลังอาหาร (After Meal)</option>
                                  <option value="กินพร้อมอาหาร">กินพร้อมอาหาร (With Meal)</option>
                                  <option value="กินตามเวลา">กินตามเวลา (Interval/Other)</option>
                                </select>
                              </div>

                              {/* Blue/Gray Container: กรณียากิน / ยาพ่น */}
                              <div className="bg-sky-50/30 border border-sky-100 rounded-2xl p-4 space-y-4">
                                <div className="flex items-center justify-between pb-2 border-b border-sky-100/40">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">รายละเอียด (เช้า - ก่อนนอน)</span>
                                  <span className="text-[9px] font-black bg-sky-100/70 text-sky-600 border border-sky-200 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                    กรณียากิน / ยาพ่น
                                  </span>
                                </div>

                                {/* Row 4: เช้า, กลางวัน, เย็น, ก่อนนอน Buttons */}
                                <div className="grid grid-cols-4 gap-1.5">
                                  {[
                                    { id: 'morning', label: 'เช้า' },
                                    { id: 'noon', label: 'กลางวัน' },
                                    { id: 'evening', label: 'เย็น' },
                                    { id: 'bedtime', label: 'ก่อนนอน' }
                                  ].map((f) => {
                                    const isSelected = !!newItem.frequency?.[f.id as keyof typeof newItem.frequency];
                                    return (
                                      <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setNewItem({
                                          ...newItem,
                                          frequency: {
                                            ...newItem.frequency!,
                                            [f.id]: !isSelected
                                          }
                                        })}
                                        className={cn(
                                          "py-2.5 rounded-xl text-xs font-bold border transition-all text-center",
                                          isSelected 
                                            ? "bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-100" 
                                            : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                                        )}
                                      >
                                        {f.label}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Row 5: เวลา (08:00 กับ 20:00) */}
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">เวลา</span>
                                  <input 
                                    type="text" 
                                    value={newItem.timingDetail || ''} 
                                    onChange={e => setNewItem({...newItem, timingDetail: e.target.value})}
                                    className="w-full bg-white rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="เช่น 08:00 กับ 20:00"
                                  />
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {[
                                      '08:00 กับ 20:00',
                                      '08:00, 12:00, 18:00',
                                      '08:00, 12:00, 18:00, 21:00',
                                      '08:00',
                                      '20:00'
                                    ].map(t => (
                                      <button
                                        key={t}
                                        type="button"
                                        onClick={() => setNewItem({...newItem, timingDetail: t})}
                                        className="text-[9px] font-bold text-sky-600 bg-white border border-sky-100 hover:bg-sky-50 px-2 py-0.5 rounded"
                                      >
                                        {t}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Row 6: ข้อควรระวัง (มีให้เลือกและแบบพิมพ์เองได้) */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ข้อควรระวัง (เลือกหรือพิมพ์เองได้)</span>
                              <input 
                                type="text" 
                                value={newItem.purpose || ''} 
                                onChange={e => setNewItem({...newItem, purpose: e.target.value})}
                                className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all mb-1"
                                placeholder="ระบุข้อควรระวัง..."
                              />
                              <div className="flex flex-wrap gap-1">
                                {[
                                  "ไม่มีข้อควรระวังพิเศษ",
                                  "เก็บในตู้เย็น",
                                  "เขย่าขวดก่อนใช้",
                                  "ทานติดต่อกันจนหมด",
                                  "ห้ามทานพร้อมนม"
                                ].map(warn => (
                                  <button
                                    key={warn}
                                    type="button"
                                    onClick={() => setNewItem({...newItem, purpose: warn})}
                                    className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-0.5 rounded-lg"
                                  >
                                    {warn}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Advanced Settings: Anatomical Marker & Warnings & Wound Care */}
                            <details className="group border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/20">
                              <summary className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-50 transition-colors list-none select-none">
                                <div className="flex items-center gap-2">
                                  <PawPrint className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ตำแหน่งบนตัวสัตว์ / ทำแผล (Anatomy & Wound)</span>
                                </div>
                                <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                              </summary>
                              <div className="p-4 bg-white border-t border-slate-100 space-y-4">
                                
                                {/* Wound Care Setup */}
                                <div className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col gap-2 shadow-sm">
                                  <label className="flex items-center gap-3"><input type="checkbox" checked={newItem.refrigerate} onChange={e => setNewItem({...newItem, refrigerate: e.target.checked})} className="w-4 h-4 text-sky-500 rounded border-slate-200" /><span className="text-[10px] font-black text-sky-600 uppercase tracking-widest">เก็บในตู้เย็น</span></label>
                                  <label className="flex items-center gap-3"><input type="checkbox" checked={newItem.shake} onChange={e => setNewItem({...newItem, shake: e.target.checked})} className="w-4 h-4 text-[#00b4d8] rounded border-slate-200" /><span className="text-[10px] font-black text-[#00b4d8] uppercase tracking-widest">เขย่าก่อนใช้</span></label>
                                  <label className="flex items-center gap-3 pt-2 border-t border-slate-100"><input type="checkbox" checked={newItem.onCondition} onChange={e => setNewItem({...newItem, onCondition: e.target.checked})} className="w-4 h-4 text-emerald-500 rounded border-slate-200" /><span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">เมื่อมีอาการ</span></label>
                                  
                                  <div className="pt-2 border-t border-slate-100 space-y-2">
                                    <label className="flex items-center gap-3">
                                      <input 
                                        type="checkbox" 
                                        checked={newItem.woundCare} 
                                        onChange={e => setNewItem({...newItem, woundCare: e.target.checked})} 
                                        className="w-4 h-4 text-rose-500 rounded border-slate-200" 
                                      />
                                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">ทำแผล</span>
                                    </label>
                                    {newItem.woundCare && (
                                      <input 
                                        type="text"
                                        value={newItem.woundCareDescription}
                                        onChange={e => setNewItem({...newItem, woundCareDescription: e.target.value})}
                                        placeholder="รายละเอียดการทำแผล..."
                                        className="w-full bg-rose-50/50 rounded-lg border border-rose-100 px-3 py-1.5 text-xs font-bold outline-none placeholder:text-rose-300 text-rose-700"
                                      />
                                    )}
                                  </div>
                                </div>

                                {/* Anatomy marker system */}
                                <div className="space-y-3 relative">
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Anatomical Marker</span>
                                      <span className="text-[8px] text-emerald-500 font-bold">จิ้มที่อวัยวะหรือส่วนต่างๆ เพื่อระบุตำแหน่ง</span>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={() => setNewItem({...newItem, usageLocation: ''})}
                                      className="text-[8px] font-bold text-rose-500 uppercase px-2 py-1 bg-rose-50 rounded hover:bg-rose-100 transition-all border border-rose-100"
                                    >
                                      รีเซ็ตตำแหน่ง
                                    </button>
                                  </div>
                                  
                                  <div 
                                    className="relative aspect-[4/3] bg-white rounded-2xl border border-slate-100 group shadow-md overflow-hidden cursor-zoom-in hover:shadow-emerald-100/20 transition-all duration-500"
                                    onClick={() => setIsAnatomyZoomed(true)}
                                  >
                                    <div className="absolute inset-0 pointer-events-none group-hover:bg-black/5 transition-colors z-[1]" />
                                    <div className="w-full h-full pointer-events-none">
                                      <AnatomyMap 
                                        onSelect={() => {}} 
                                        selectedLocations={newItem.anatomicalParts || []}
                                        customSvg={customAnatomySvg}
                                      />
                                    </div>
                                    
                                    <div className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-xl rounded-xl border border-slate-100 shadow-md flex items-center justify-center text-emerald-500 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 z-10">
                                      <Search className="w-4 h-4" />
                                    </div>

                                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-slate-100 shadow-md flex flex-col gap-0.5 z-10 pointer-events-none">
                                      <div className="flex items-center gap-1">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">ตำแหน่งที่เลือก</span>
                                        <Search className="w-2.5 h-2.5 text-slate-400" />
                                      </div>
                                      <div className="text-xs font-black text-emerald-600 truncate max-w-[120px]">
                                        {newItem.usageLocation || 'คลิกเพื่อขยาย...'}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">แมนนวลระบุเอง</span>
                                      <div className="flex gap-1">
                                        <button 
                                          type="button"
                                          onClick={() => setNewItem({...newItem, usageLocation: 'ทางเดินหู'})}
                                          className="text-[8px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100"
                                        >
                                          Ear Canal
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setNewItem({...newItem, usageLocation: 'ผิวหนังชั้นนอก'})}
                                          className="text-[8px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100"
                                        >
                                          Skin
                                        </button>
                                      </div>
                                    </div>
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
                                      className="w-full bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/10"
                                      placeholder="พิมพ์ระบุระเปรี๊ยบ เช่น หูขวา..."
                                    />
                                  </div>
                                </div>
                              </div>
                            </details>
                          </>
                        );
                      })()}

                      {/* Row 7: ราคา (บาท) + Confirm Button */}
                      <div className="grid grid-cols-12 gap-2 pt-2 border-t border-slate-50">
                        <div className="col-span-5 flex flex-col gap-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ราคา (บาท)</span>
                          <input 
                            type="number" 
                            value={newItem.price || ''} 
                            onChange={e => setNewItem({...newItem, price: Number(e.target.value)})}
                            className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                            placeholder="0"
                          />
                        </div>
                        <div className="col-span-7 flex items-end">
                          <button 
                            type="button" 
                            onClick={addItem}
                            className="w-full bg-emerald-500 text-white py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/15 hover:bg-emerald-600 active:scale-95 transition-all text-center"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>�

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

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewItem({
                        ...newItem,
                        usageLocation: '',
                        anatomicalParts: []
                      });
                    }}
                    className="mt-4 px-6 py-3 bg-white/80 backdrop-blur-sm text-rose-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all border border-rose-100 shadow-xl shadow-rose-500/10 active:scale-95 whitespace-nowrap"
                  >
                    ล้างพื้นที่ทั้งหมด
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
