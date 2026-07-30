import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  DollarSign, 
  ShoppingCart, 
  User, 
  X, 
  Printer,
  CheckCircle2,
  CreditCard,
  Wallet,
  Receipt,
  ArrowUpRight,
  PawPrint,
  Settings,
  Edit2,
  Package,
  Wrench,
  Stethoscope,
  Scissors,
  Pill,
  Tag,
  Layers,
  Boxes,
  Sparkles,
  ListPlus,
  Check,
  ChevronRight,
  Minus
} from 'lucide-react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  handleFirestoreError,
  OperationType,
  addDoc,
  serverTimestamp,
  getDocs,
  where,
  updateDoc,
  deleteDoc,
  doc
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  unit?: string;
  petName?: string;
  sourceRecordId?: string;
  sourceType?: string;
}

interface SetItem {
  itemId?: string;
  name: string;
  quantity: number;
  unit?: string;
}

interface TreatmentSet {
  id: string;
  name: string;
  category?: string;
  description?: string;
  items: SetItem[];
}

const DEFAULT_QUICK_ITEMS = [
  { name: 'General Consultation', price: 500, category: 'Service', unit: 'ครั้ง' },
  { name: 'Grooming (Small)', price: 350, category: 'Grooming', unit: 'ครั้ง' },
  { name: 'Rabies Vaccine', price: 250, category: 'Vaccine', unit: 'เข็ม' },
  { name: 'Heartworm Med', price: 180, category: 'Medicine', unit: 'เม็ด' },
  { name: 'Pet Food (Premium)', price: 850, category: 'Product', unit: 'ถุง' },
  { name: 'Emergency Fee', price: 1000, category: 'Service', unit: 'ครั้ง' },
  { name: 'ชุดทำแผลและปั้นเฝือก', price: 300, category: 'Equipment', unit: 'ชุด' },
  { name: 'เข็มฉีดยา & ไซริงค์ 3ml', price: 50, category: 'Equipment', unit: 'ชุด' }
];

const DEFAULT_TREATMENT_SETS: TreatmentSet[] = [
  {
    id: 'def-set-1',
    name: 'ชุดทำแผลสุนัข/แมว (Basic Wound Care)',
    category: 'Equipment',
    description: 'ชุดอุปกรณ์ทำแผลพื้นฐาน พร้อมน้ำเกลือ สำลี และผ้าก๊อซ',
    items: [
      { name: 'ชุดทำแผลและปั้นเฝือก', quantity: 1, unit: 'ชุด' },
      { name: 'เข็มฉีดยา & ไซริงค์ 3ml', quantity: 2, unit: 'ชุด' },
      { name: 'General Consultation', quantity: 1, unit: 'ครั้ง' }
    ]
  },
  {
    id: 'def-set-2',
    name: 'ชุดฉีดวัคซีนประจำปี (Annual Vaccination Set)',
    category: 'Vaccine',
    description: 'วัคซีนพิษสุนัขบ้า ยาป้องกันพยาธิหัวใจ พร้อมค่าตรวจสุขภาพ',
    items: [
      { name: 'Rabies Vaccine', quantity: 1, unit: 'เข็ม' },
      { name: 'Heartworm Med', quantity: 1, unit: 'เม็ด' },
      { name: 'General Consultation', quantity: 1, unit: 'ครั้ง' }
    ]
  },
  {
    id: 'def-set-3',
    name: 'ชุดผ่าตัดทำหมัน / ศัลยกรรม (Surgery & Sterilization)',
    category: 'Service',
    description: 'ค่าบริการผ่าตัด ยาสลบ อุปกรณ์ทำแผล และตรวจสุขภาพก่อนผ่าตัด',
    items: [
      { name: 'Emergency Fee', quantity: 1, unit: 'ครั้ง' },
      { name: 'ชุดทำแผลและปั้นเฝือก', quantity: 2, unit: 'ชุด' },
      { name: 'เข็มฉีดยา & ไซริงค์ 3ml', quantity: 3, unit: 'ชุด' },
      { name: 'General Consultation', quantity: 1, unit: 'ครั้ง' }
    ]
  }
];

const PRESET_UNITS = [
  'ชิ้น', 'ชุด', 'ครั้ง', 'เม็ด', 'ขวด', 'หลอด', 'แผง', 'กล่อง', 
  'ถุง', 'อัน', 'เข็ม', 'กิโลกรัม', 'กรัม', 'ชั่วโมง', 'ระบุเอง'
];

const CATEGORIES = [
  { key: 'All', label: 'ทั้งหมด' },
  { key: 'Packages', label: '🎁 ชุดรักษา / แพ็กเกจ' },
  { key: 'Equipment', label: 'อุปกรณ์ / เครื่องมือ' },
  { key: 'Service', label: 'บริการ' },
  { key: 'Medicine', label: 'ยา / เวชภัณฑ์' },
  { key: 'Vaccine', label: 'วัคซีน' },
  { key: 'Product', label: 'สินค้าทั่วไป' },
  { key: 'Grooming', label: 'อาบน้ำ / ตัดขน' },
];

export default function POS() {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<any>(null);
  const [ownerPets, setOwnerPets] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCheckout, setIsCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [serviceCharge, setServiceCharge] = useState(0);

  // Treatment Sets / Order Packages State
  const [treatmentSets, setTreatmentSets] = useState<TreatmentSet[]>([]);
  const [modalTab, setModalTab] = useState<'items' | 'treatment_sets'>('items');

  // Treatment Set Form State inside Settings Modal
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [setName, setSetName] = useState('');
  const [setDescription, setSetDescription] = useState('');
  const [setCategory, setSetCategory] = useState('Equipment');
  const [setItemsList, setSetItemsList] = useState<SetItem[]>([]);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState('');
  const [itemQtyForSet, setItemQtyForSet] = useState<number>(1);
  const [isSavingSet, setIsSavingSet] = useState(false);

  // POS Equipment & Pricing Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Add Item Modal State (for Current Bill "+ เพิ่มรายการ")
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemSearchQuery, setAddItemSearchQuery] = useState('');
  const [addItemCategoryFilter, setAddItemCategoryFilter] = useState('All');
  const [addItemQtyMap, setAddItemQtyMap] = useState<Record<string, number>>({});
  
  // Item Form State inside Modal
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Equipment');
  const [itemPrice, setItemPrice] = useState<number | ''>('');
  const [itemUnit, setItemUnit] = useState('ชิ้น');
  const [customUnit, setCustomUnit] = useState('');
  const [itemStock, setItemStock] = useState<number | ''>('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [isSavingItem, setIsSavingItem] = useState(false);

  const formatPhoneNumber = (phone: string | undefined | null) => {
    if (!phone) return '-';
    const cleaned = phone.trim().replace(/\D/g, '');
    if (cleaned.length > 0 && !cleaned.startsWith('0')) {
      return '0' + cleaned;
    }
    return phone;
  };

  // Event listener for gear icon click in top Header
  useEffect(() => {
    const handleOpenPosSettings = () => {
      setShowSettingsModal(true);
    };
    window.addEventListener('open-pos-settings', handleOpenPosSettings);
    return () => window.removeEventListener('open-pos-settings', handleOpenPosSettings);
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) return;

    const unsubscribePatients = onSnapshot(collection(db, 'patients'), (snap) => {
      setPatients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("Patients listener (POS) restricted:", err.message);
    });

    const unsubscribeInventory = onSnapshot(collection(db, 'inventory'), (snap) => {
      setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("Inventory listener (POS) restricted:", err.message);
    });

    const unsubscribeSets = onSnapshot(collection(db, 'treatment_sets'), (snap) => {
      setTreatmentSets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TreatmentSet[]);
    }, (err) => {
      console.warn("Treatment sets listener restricted:", err.message);
    });

    return () => {
      unsubscribePatients();
      unsubscribeInventory();
      unsubscribeSets();
    };
  }, [isAuthReady, user, isStaff]);

  const handleSelectOwner = async (ownerPhone: string) => {
    const q = query(collection(db, 'patients'), where('ownerPhone', '==', ownerPhone));
    const snap = await getDocs(q);
    const pets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    setOwnerPets(pets);
    const ownerName = pets[0]?.ownerName || 'Unknown';
    setSelectedOwner({ phone: ownerPhone, name: ownerName });
    
    // Auto-add items from UNPAID OPD records for these pets
    const patientIds = pets.map(p => p.id);
    const opdQ = query(
      collection(db, 'opd_records'), 
      where('patientId', 'in', patientIds),
      where('billingStatus', '==', 'unpaid')
    );
    const ipdQ = query(
      collection(db, 'ipd_records'),
      where('patientId', 'in', patientIds),
      where('billingStatus', '==', 'unpaid')
    );

    const [opdSnap, ipdSnap] = await Promise.all([
      getDocs(opdQ),
      getDocs(ipdQ)
    ]);

    const pendingItems: any[] = [];
    
    // OPD items
    opdSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.items) {
        data.items.forEach((item: any, idx: number) => {
          pendingItems.push({ 
            ...item, 
            id: `opd-${doc.id}-${item.id || idx}`,
            petName: data.petName,
            sourceRecordId: doc.id,
            sourceType: 'opd',
            unit: item.unit || 'ชิ้น'
          });
        });
      }
      if (data.serviceCharge > 0) {
        pendingItems.push({
          id: `opd-sc-${doc.id}`,
          name: 'Service Charge (OPD)',
          price: data.serviceCharge,
          quantity: 1,
          category: 'Service',
          unit: 'ครั้ง',
          petName: data.petName,
          sourceRecordId: doc.id,
          sourceType: 'opd'
        });
      }
    });

    // IPD items
    ipdSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.items) {
        data.items.forEach((item: any, idx: number) => {
          pendingItems.push({
            ...item,
            id: `ipd-${doc.id}-${item.id || idx}`,
            petName: data.petName,
            sourceRecordId: doc.id,
            sourceType: 'ipd',
            unit: item.unit || 'ชิ้น'
          });
        });
      }
      if (data.serviceCharge > 0) {
        pendingItems.push({
          id: `ipd-sc-${doc.id}`,
          name: 'Service Charge (IPD)',
          price: data.serviceCharge,
          quantity: 1,
          category: 'Service',
          unit: 'ครั้ง',
          petName: data.petName,
          sourceRecordId: doc.id,
          sourceType: 'ipd'
        });
      }
    });

    setCart(pendingItems);
  };

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.name === item.name && i.category === item.category);
      if (existing) {
        return prev.map(i => (i.name === item.name && i.category === item.category) ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, id: `cart-${crypto.randomUUID()}` }];
    });
  };

  const handleBarcodeScan = (barcode: string) => {
    const item = inventory.find(i => i.barcode === barcode);
    if (item) {
      addToCart({
        id: item.id,
        name: item.itemName || item.name,
        price: Number(item.unitPrice || item.price || 0),
        quantity: 1,
        category: item.category || 'Product',
        unit: item.unit || 'ชิ้น'
      });
      setSearchQuery('');
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    
    if (val.length >= 3) {
      const item = inventory.find(i => i.barcode === val);
      if (item) {
        handleBarcodeScan(val);
      }
    }
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + serviceCharge;

  const handleCheckout = async () => {
    try {
      await addDoc(collection(db, 'sales'), {
        ownerId: selectedOwner?.phone,
        ownerName: selectedOwner?.name,
        items: cart,
        subtotal,
        serviceCharge,
        total,
        paymentMethod,
        patientIds: ownerPets.map(p => p.id),
        createdAt: serverTimestamp()
      });

      const sourceOpdIds = Array.from(new Set(cart.filter(i => (i as any).sourceType === 'opd').map(i => (i as any).sourceRecordId)));
      await Promise.all(sourceOpdIds.map(id => 
        updateDoc(doc(db, 'opd_records', id as string), { billingStatus: 'paid' })
      ));

      const sourceIpdIds = Array.from(new Set(cart.filter(i => (i as any).sourceType === 'ipd').map(i => (i as any).sourceRecordId)));
      await Promise.all(sourceIpdIds.map(id => 
        updateDoc(doc(db, 'ipd_records', id as string), { billingStatus: 'paid' })
      ));

      for (const item of cart) {
        const invItem = inventory.find(i => (i.itemName || i.name) === item.name || i.barcode === item.id);
        if (invItem) {
          await updateDoc(doc(db, 'inventory', invItem.id), {
            quantity: Math.max(0, (invItem.quantity || 0) - item.quantity)
          });
        }
      }

      setIsCheckout(true);
      setCart([]);
      setSelectedOwner(null);
      setOwnerPets([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sales');
    }
  };

  // Combine items from Firestore inventory and fallback quick items
  const combinedItems = React.useMemo(() => {
    const invItems = inventory.map(item => {
      let p = Number(item.unitPrice || item.price || 0);
      let u = item.unit || 'ชิ้น';

      if (p === 0 && u && !isNaN(Number(u)) && Number(u) > 0) {
        p = Number(u);
        u = 'ชิ้น';
      } else if (u && !isNaN(Number(u))) {
        u = 'ชิ้น';
      }

      return {
        id: item.id,
        name: item.itemName || item.name || 'ไม่มีชื่อ',
        price: p,
        category: item.category || 'Product',
        unit: u,
        quantity: item.quantity ?? 0,
        barcode: item.barcode || ''
      };
    });

    // Add default quick items if not present in inventory
    DEFAULT_QUICK_ITEMS.forEach(def => {
      const exists = invItems.some(i => i.name.toLowerCase() === def.name.toLowerCase());
      if (!exists) {
        invItems.push({
          id: `def-${def.name}`,
          name: def.name,
          price: def.price,
          category: def.category,
          unit: def.unit,
          quantity: 99,
          barcode: ''
        });
      }
    });

    return invItems;
  }, [inventory]);

  // Filter inventory items for the "+ เพิ่มรายการ" modal in Current Bill
  const filteredAddItemInventory = React.useMemo(() => {
    return combinedItems.filter(item => {
      const matchesCategory = addItemCategoryFilter === 'All' || item.category === addItemCategoryFilter;
      const q = addItemSearchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) || 
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [combinedItems, addItemCategoryFilter, addItemSearchQuery]);

  // Combine custom treatment sets from Firestore with defaults if empty
  const combinedTreatmentSets = React.useMemo(() => {
    if (treatmentSets.length > 0) {
      return treatmentSets;
    }
    return DEFAULT_TREATMENT_SETS;
  }, [treatmentSets]);

  // Calculate live total price of a treatment set using current Inventory prices
  const getSetCalculatedPrice = (set: TreatmentSet) => {
    return (set.items || []).reduce((sum, item) => {
      const invMatch = combinedItems.find(i => 
        (item.itemId && i.id === item.itemId) || 
        i.name.toLowerCase() === item.name.toLowerCase()
      );
      const unitPrice = invMatch ? invMatch.price : 0;
      return sum + (unitPrice * item.quantity);
    }, 0);
  };

  // Add entire treatment set / order package into cart with 1 click
  const addTreatmentSetToCart = (set: TreatmentSet) => {
    const newCartItems: CartItem[] = [];

    (set.items || []).forEach(setItem => {
      // Resolve price and details directly from Inventory
      const invMatch = combinedItems.find(i => 
        (setItem.itemId && i.id === setItem.itemId) || 
        i.name.toLowerCase() === setItem.name.toLowerCase()
      );

      const price = invMatch ? invMatch.price : 0;
      const unit = invMatch ? (invMatch.unit || setItem.unit || 'ชิ้น') : (setItem.unit || 'ชิ้น');
      const category = invMatch ? invMatch.category : (set.category || 'Equipment');

      newCartItems.push({
        id: `cart-${crypto.randomUUID()}`,
        name: setItem.name,
        price: price,
        quantity: setItem.quantity || 1,
        category: category,
        unit: unit
      });
    });

    setCart(prev => {
      let updated = [...prev];
      newCartItems.forEach(newItem => {
        const existingIdx = updated.findIndex(i => i.name === newItem.name && i.category === newItem.category);
        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + newItem.quantity
          };
        } else {
          updated.push(newItem);
        }
      });
      return updated;
    });
  };

  // Filter items by category tab & search query
  const filteredDisplayItems = combinedItems.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  // Filter treatment sets by search query
  const filteredTreatmentSets = combinedTreatmentSets.filter(set => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return set.name.toLowerCase().includes(q) || 
      (set.description && set.description.toLowerCase().includes(q)) ||
      set.items.some(i => i.name.toLowerCase().includes(q));
  });

  // Treatment Set Handlers for Settings Modal
  const handleSaveTreatmentSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setName.trim() || setItemsList.length === 0) return;
    setIsSavingSet(true);

    try {
      const setData = {
        name: setName.trim(),
        description: setDescription.trim(),
        category: setCategory,
        items: setItemsList,
        updatedAt: serverTimestamp()
      };

      if (editingSetId && !editingSetId.startsWith('def-')) {
        await updateDoc(doc(db, 'treatment_sets', editingSetId), setData);
      } else {
        await addDoc(collection(db, 'treatment_sets'), {
          ...setData,
          createdAt: serverTimestamp()
        });
      }

      // Reset Form
      setEditingSetId(null);
      setSetName('');
      setSetDescription('');
      setSetCategory('Equipment');
      setSetItemsList([]);
      setSelectedInventoryItemId('');
      setItemQtyForSet(1);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'treatment_sets');
    } finally {
      setIsSavingSet(false);
    }
  };

  const handleEditSetClick = (set: TreatmentSet) => {
    setEditingSetId(set.id);
    setSetName(set.name);
    setSetDescription(set.description || '');
    setSetCategory(set.category || 'Equipment');
    setSetItemsList(set.items || []);
  };

  const handleDeleteSetClick = async (setId: string) => {
    if (setId.startsWith('def-')) return;
    if (window.confirm('คุณต้องการลบชุดรักษานี้ใช่หรือไม่?')) {
      try {
        await deleteDoc(doc(db, 'treatment_sets', setId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'treatment_sets');
      }
    }
  };

  const handleAddItemToSetList = () => {
    if (!selectedInventoryItemId) return;
    const invItem = combinedItems.find(i => i.id === selectedInventoryItemId);
    if (!invItem) return;

    const existingIdx = setItemsList.findIndex(i => i.itemId === invItem.id || i.name === invItem.name);
    if (existingIdx >= 0) {
      const updated = [...setItemsList];
      updated[existingIdx].quantity += itemQtyForSet;
      setSetItemsList(updated);
    } else {
      setSetItemsList(prev => [
        ...prev,
        {
          itemId: invItem.id,
          name: invItem.name,
          quantity: itemQtyForSet,
          unit: invItem.unit || 'ชิ้น'
        }
      ]);
    }
    setSelectedInventoryItemId('');
    setItemQtyForSet(1);
  };

  const handleRemoveItemFromSetList = (idx: number) => {
    setSetItemsList(prev => prev.filter((_, i) => i !== idx));
  };

  // Handle Save/Update Item in POS Settings Modal
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || itemPrice === '') return;

    const finalUnit = itemUnit === 'ระบุเอง' ? (customUnit.trim() || 'ชิ้น') : itemUnit;
    setIsSavingItem(true);

    try {
      const itemData = {
        itemName: itemName.trim(),
        name: itemName.trim(),
        category: itemCategory,
        unitPrice: Number(itemPrice),
        price: Number(itemPrice),
        unit: finalUnit,
        quantity: itemStock === '' ? 0 : Number(itemStock),
        barcode: itemBarcode.trim(),
        updatedAt: serverTimestamp()
      };

      if (editingItemId && !editingItemId.startsWith('def-')) {
        await updateDoc(doc(db, 'inventory', editingItemId), itemData);
      } else {
        await addDoc(collection(db, 'inventory'), {
          ...itemData,
          createdAt: serverTimestamp()
        });
      }

      // Reset Form
      setEditingItemId(null);
      setItemName('');
      setItemPrice('');
      setItemCategory('Equipment');
      setItemUnit('ชิ้น');
      setCustomUnit('');
      setItemStock('');
      setItemBarcode('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory');
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleEditClick = (item: any) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemCategory(item.category || 'Equipment');
    setItemPrice(item.price);
    if (PRESET_UNITS.includes(item.unit)) {
      setItemUnit(item.unit);
      setCustomUnit('');
    } else {
      setItemUnit('ระบุเอง');
      setCustomUnit(item.unit || '');
    }
    setItemStock(item.quantity || '');
    setItemBarcode(item.barcode || '');
  };

  const handleDeleteClick = async (itemId: string) => {
    if (itemId.startsWith('def-')) return;
    if (window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
      try {
        await deleteDoc(doc(db, 'inventory', itemId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'inventory');
      }
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'Equipment': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Service': return 'bg-cyan-50 text-[#00b4d8] border-cyan-100';
      case 'Medicine': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Vaccine': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'Product': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Grooming': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="h-full flex gap-8">
      {/* Left: Consolidated Billing + Equipment / Item Selection */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Consolidated Billing</h2>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 bg-slate-100 hover:bg-[#00b4d8] hover:text-white text-slate-600 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm"
                title="ตั้งค่าอุปกรณ์ สินค้า และหน่วยการใช้งาน"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">ตั้งค่าอุปกรณ์/ราคา</span>
              </button>
            </div>
          </div>

          {searchQuery && !selectedOwner && (
            <div className="grid grid-cols-2 gap-4">
              {patients.filter(p => 
                formatPhoneNumber(p.ownerPhone).includes(searchQuery) || 
                p.ownerPhone?.includes(searchQuery) ||
                p.name?.toLowerCase().includes(searchQuery.toLowerCase())
              ).slice(0, 4).map((p, idx) => (
                <button 
                  key={`pos-patient-${p.id || 'id'}-${idx}`}
                  onClick={() => handleSelectOwner(p.ownerPhone)}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-[#00b4d8] hover:bg-cyan-50 transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#00b4d8]/10 flex items-center justify-center text-[#00b4d8]">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{p.ownerName}</p>
                    <p className="text-xs text-slate-400">{formatPhoneNumber(p.ownerPhone)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedOwner && (
            <div className="space-y-4">
              <div className="p-4 bg-cyan-50 rounded-2xl border border-cyan-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#00b4d8] flex items-center justify-center text-white">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-slate-800">{selectedOwner.name}</p>
                    <p className="text-xs font-bold text-[#00b4d8] uppercase tracking-widest">{formatPhoneNumber(selectedOwner.phone)}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedOwner(null); setOwnerPets([]); setCart([]); }} className="p-2 hover:bg-white rounded-lg text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pets included in this bill</p>
                <div className="flex flex-wrap gap-2">
                  {ownerPets.map((pet, idx) => (
                    <div key={`owner-pet-${pet.id}-${idx}`} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <PawPrint className="w-3 h-3 text-[#00b4d8]" />
                      <span className="text-xs font-bold text-slate-700">{pet.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">({pet.hn})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border shrink-0",
                selectedCategory === cat.key
                  ? "bg-[#00b4d8] text-white border-[#00b4d8] shadow-md shadow-cyan-100"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Quick Add Equipment & Items Grid */}
        <div className="space-y-6 overflow-y-auto max-h-[520px] pr-1 custom-scrollbar">
          {/* If category is 'Packages' or 'All', show Treatment Sets Section */}
          {(selectedCategory === 'Packages' || selectedCategory === 'All') && filteredTreatmentSets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-[#00b4d8]" />
                  ชุดรักษา / แพ็กเกจอุปกรณ์สำเร็จรูป ({filteredTreatmentSets.length} ชุด)
                </h3>
                {selectedCategory === 'All' && (
                  <button 
                    onClick={() => setSelectedCategory('Packages')}
                    className="text-xs font-bold text-[#00b4d8] hover:underline flex items-center gap-1"
                  >
                    ดูทั้งหมด <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTreatmentSets.slice(0, selectedCategory === 'All' ? 3 : undefined).map((set) => {
                  const calcPrice = getSetCalculatedPrice(set);
                  return (
                    <div 
                      key={`set-card-${set.id}`}
                      className="bg-gradient-to-br from-cyan-50/70 via-white to-blue-50/30 p-5 rounded-3xl border border-cyan-100/80 shadow-sm hover:shadow-md hover:border-[#00b4d8] transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-8 h-8 rounded-xl bg-[#00b4d8]/10 text-[#00b4d8] flex items-center justify-center font-bold">
                            <Boxes className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg border bg-cyan-100/70 text-[#00b4d8] border-cyan-200">
                            {set.items.length} รายการในชุด
                          </span>
                        </div>
                        
                        <p className="font-black text-slate-800 text-sm mb-1 line-clamp-1 group-hover:text-[#00b4d8] transition-colors">{set.name}</p>
                        {set.description && (
                          <p className="text-xs text-slate-500 font-medium mb-2.5 line-clamp-2 leading-relaxed">{set.description}</p>
                        )}

                        {/* Sub-item preview inside the package */}
                        <div className="bg-white/90 p-2.5 rounded-2xl border border-slate-100 space-y-1 my-2 shadow-2xs">
                          {set.items.map((subItem, sIdx) => {
                            const invMatch = combinedItems.find(i => (subItem.itemId && i.id === subItem.itemId) || i.name.toLowerCase() === subItem.name.toLowerCase());
                            const currentUnitPrice = invMatch ? invMatch.price : 0;
                            return (
                              <div key={`sub-${sIdx}`} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-700 font-medium truncate flex items-center gap-1.5 min-w-0 pr-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00b4d8] shrink-0"></span>
                                  <span className="truncate">{subItem.name}</span>
                                </span>
                                <span className="text-slate-400 font-bold shrink-0">
                                  x{subItem.quantity} {subItem.unit || 'ชิ้น'} ({currentUnitPrice.toLocaleString()}฿)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">ราคาดึงจากคลัง</span>
                          <span className="text-base font-black text-[#00b4d8]">{calcPrice.toLocaleString()} ฿</span>
                        </div>
                        <button
                          onClick={() => addTreatmentSetToCart(set)}
                          className="px-3.5 py-2 bg-[#00b4d8] text-white rounded-xl text-xs font-bold hover:bg-[#0096b4] transition-all shadow-md shadow-cyan-100 flex items-center gap-1.5 group-hover:scale-105"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          เพิ่มทั้งชุด
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual Items Grid (if category is NOT 'Packages') */}
          {selectedCategory !== 'Packages' && (
            <div className="space-y-3">
              {selectedCategory === 'All' && filteredTreatmentSets.length > 0 && (
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 pt-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  อุปกรณ์ และสินค้าเดี่ยวทั้งหมด
                </h3>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDisplayItems.map((item, idx) => (
                  <button 
                    key={`quick-add-${item.id}-${idx}`}
                    onClick={() => addToCart({ 
                      id: item.id, 
                      name: item.name, 
                      price: item.price, 
                      quantity: 1, 
                      category: item.category,
                      unit: item.unit
                    })}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-[#00b4d8] transition-all text-left group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#00b4d8] group-hover:text-white transition-colors">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border", getCategoryBadgeClass(item.category))}>
                          {item.category === 'Equipment' ? 'อุปกรณ์' : item.category}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 text-sm mb-1 line-clamp-2">{item.name}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-50 flex items-baseline justify-between">
                      <span className="text-xs text-slate-400 font-bold uppercase">ราคา / {item.unit || 'ชิ้น'}</span>
                      <p className="text-base font-black text-[#00b4d8]">
                        {item.price.toLocaleString()} ฿ <span className="text-xs font-normal text-slate-400">/ {item.unit || 'ชิ้น'}</span>
                      </p>
                    </div>
                  </button>
                ))}

                {filteredDisplayItems.length === 0 && (
                  <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-100 text-center text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#00b4d8]" />
                    <p className="font-bold text-sm">ไม่พบรายการในหมวดหมู่นี้</p>
                    <button 
                      onClick={() => setShowSettingsModal(true)} 
                      className="mt-3 px-4 py-2 bg-[#00b4d8] text-white rounded-xl text-xs font-bold hover:bg-[#0096b4] transition-all shadow-sm"
                    >
                      + เพิ่มอุปกรณ์ หรือรายการสินค้าใหม่
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart & Checkout */}
      <div className="w-96 flex flex-col gap-6">
        <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-slate-400" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Current Bill</h3>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddItemModal(true)}
                className="px-3 py-1.5 bg-[#00b4d8] hover:bg-[#0096b4] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-sm shadow-cyan-100"
                title="ค้นหาและเพิ่มรายการอุปกรณ์/สินค้าเข้าบิล"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มรายการ</span>
              </button>
              <span className="px-2 py-1 bg-[#00b4d8]/10 text-[#00b4d8] border border-cyan-200 text-[10px] font-black rounded-lg">{cart.length} ITEMS</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.map((item, idx) => (
              <div key={`pos-cart-item-${item.id || 'noid'}-${item.name}-${idx}`} className="flex items-center justify-between group bg-slate-50/50 p-3 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-white transition-all">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                    {(item as any).petName && (
                      <span className="text-[10px] bg-cyan-100 text-[#00b4d8] px-1.5 py-0.5 rounded-md font-black uppercase shrink-0">{(item as any).petName}</span>
                    )}
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                    {item.quantity} {item.unit || 'ชิ้น'} x {item.price.toLocaleString()} ฿
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-sm font-black text-slate-900">{(item.price * item.quantity).toLocaleString()} ฿</p>
                  <button onClick={() => removeFromCart(item.id)} className="p-1.5 bg-red-50 text-red-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-40">
                <Receipt className="w-16 h-16" />
                <p className="font-bold">Cart is empty</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-widest">
              <span>Subtotal</span>
              <span>{subtotal.toLocaleString()} ฿</span>
            </div>
            
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-widest">
              <span>Service Charge</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  value={serviceCharge || ''}
                  onChange={(e) => setServiceCharge(Number(e.target.value))}
                  placeholder="0"
                  className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-right font-black text-slate-700 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                />
                <span>฿</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-slate-800 font-black text-2xl">
              <span>Total</span>
              <span className="text-[#00b4d8]">{total.toLocaleString()} ฿</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'cash', icon: <Wallet className="w-4 h-4" />, label: 'Cash' },
              { id: 'card', icon: <CreditCard className="w-4 h-4" />, label: 'Card' },
              { id: 'transfer', icon: <ArrowUpRight className="w-4 h-4" />, label: 'Transfer' },
            ].map((method, idx) => (
              <button 
                key={`pay-${method.id}-${idx}`}
                onClick={() => setPaymentMethod(method.id as any)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                  paymentMethod === method.id 
                    ? "bg-[#00b4d8] text-white border-[#00b4d8] shadow-lg shadow-cyan-100" 
                    : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                )}
              >
                {method.icon}
                <span className="text-[10px] font-black uppercase">{method.label}</span>
              </button>
            ))}
          </div>
          <button 
            disabled={cart.length === 0 || !selectedOwner}
            onClick={handleCheckout}
            className="w-full py-4 bg-[#00b4d8] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-cyan-100 hover:bg-[#0096b4] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Complete Checkout
          </button>
        </div>
      </div>

      {/* Add Item Modal (สำหรับปุ่ม "+ เพิ่มรายการ" ที่ Current Bill) */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 text-[#00b4d8] flex items-center justify-center font-bold">
                  <ListPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">ค้นหาและเพิ่มรายการสินค้า/อุปกรณ์ในบิล</h3>
                  <p className="text-xs text-slate-400">เลือกรายการจากคลังสินค้าเพื่อเพิ่มลงในรายการชำระเงินของลูกค้า</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddItemModal(false)}
                className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar & Category Filter */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-3">
              {/* Search Box */}
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="พิมพ์ค้นหาชื่อรายการ, รหัสบาร์โค้ด หรือหมวดหมู่..."
                  value={addItemSearchQuery}
                  onChange={(e) => setAddItemSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none shadow-2xs"
                  autoFocus
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                {addItemSearchQuery && (
                  <button 
                    onClick={() => setAddItemSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                {[
                  { key: 'All', label: 'ทั้งหมด' },
                  { key: 'Equipment', label: 'อุปกรณ์' },
                  { key: 'Medicine', label: 'ยา / เวชภัณฑ์' },
                  { key: 'Vaccine', label: 'วัคซีน' },
                  { key: 'Service', label: 'บริการ' },
                  { key: 'Product', label: 'สินค้าทั่วไป' },
                  { key: 'Grooming', label: 'อาบน้ำ/ตัดขน' },
                ].map(cat => (
                  <button
                    key={`modal-cat-${cat.key}`}
                    onClick={() => setAddItemCategoryFilter(cat.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border",
                      addItemCategoryFilter === cat.key
                        ? "bg-[#00b4d8] text-white border-[#00b4d8] shadow-2xs"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {filteredAddItemInventory.length > 0 ? (
                <div className="space-y-2">
                  {filteredAddItemInventory.map((item) => {
                    const currentQty = addItemQtyMap[item.id] || 1;
                    const isLowStock = item.quantity <= 5 && item.quantity > 0;
                    const isOutOfStock = item.quantity <= 0;

                    return (
                      <div 
                        key={`add-modal-item-${item.id}`}
                        className="bg-white p-3.5 rounded-2xl border border-slate-100 hover:border-cyan-200 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Item Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", getCategoryBadgeClass(item.category))}>
                              {item.category === 'Equipment' ? 'อุปกรณ์' : item.category}
                            </span>
                            {item.barcode && (
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                Barcode: {item.barcode}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                        </div>

                        {/* Price & Stock info */}
                        <div className="flex items-center gap-6 shrink-0">
                          {/* Price */}
                          <div className="text-right min-w-[90px]">
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">ราคาขาย</span>
                            <span className="text-sm font-black text-[#00b4d8]">
                              {item.price.toLocaleString()} ฿ <span className="text-[10px] text-slate-400 font-normal">/ {item.unit || 'ชิ้น'}</span>
                            </span>
                          </div>

                          {/* Remaining Stock */}
                          <div className="text-right min-w-[95px]">
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">คงเหลือในสต๊อก</span>
                            <span className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-lg inline-block border",
                              isOutOfStock 
                                ? "bg-rose-50 text-rose-600 border-rose-100 font-black" 
                                : isLowStock 
                                  ? "bg-amber-50 text-amber-600 border-amber-100" 
                                  : "bg-emerald-50 text-emerald-600 border-emerald-100"
                            )}>
                              {isOutOfStock ? 'สินค้าหมด' : `${item.quantity} ${item.unit || 'ชิ้น'}`}
                            </span>
                          </div>

                          {/* Quantity Selector & Add Button */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                              <button
                                type="button"
                                onClick={() => setAddItemQtyMap(prev => ({ ...prev, [item.id]: Math.max(1, (prev[item.id] || 1) - 1) }))}
                                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white rounded-lg transition-colors font-bold text-xs"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input 
                                type="number" 
                                min="1"
                                value={currentQty}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value) || 1;
                                  setAddItemQtyMap(prev => ({ ...prev, [item.id]: Math.max(1, v) }));
                                }}
                                className="w-10 text-center text-xs font-black bg-transparent outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setAddItemQtyMap(prev => ({ ...prev, [item.id]: (prev[item.id] || 1) + 1 }))}
                                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white rounded-lg transition-colors font-bold text-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                addToCart({ 
                                  id: item.id, 
                                  name: item.name, 
                                  price: item.price, 
                                  quantity: currentQty, 
                                  category: item.category,
                                  unit: item.unit
                                });
                              }}
                              className="px-3.5 py-2 bg-[#00b4d8] hover:bg-[#0096b4] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm shadow-cyan-100 active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>เพิ่ม</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Package className="w-12 h-12 mx-auto text-slate-300 opacity-50" />
                  <p className="font-bold text-sm">ไม่พบรายการในคลังสินค้าตามเงื่อนไขที่ค้นหา</p>
                  <p className="text-xs text-slate-400">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่น</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                พบทั้งหมด <strong className="text-slate-800">{filteredAddItemInventory.length}</strong> รายการ | ในบิลมีแล้ว <strong className="text-[#00b4d8]">{cart.length}</strong> รายการ
              </span>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                เสร็จสิ้น / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Settings Modal (ตั้งค่าอุปกรณ์/สินค้า/บริการ & หน่วยการใช้งาน & ราคา) */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00b4d8]/10 text-[#00b4d8] flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">ตั้งค่าอุปกรณ์ สินค้า บริการ และราคา POS</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    เพิ่ม/แก้ไขรายการอุปกรณ์ กำหนดราคาขาย และเลือกหน่วยการใช้งาน
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowSettingsModal(false);
                  setEditingItemId(null);
                }}
                className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="px-6 pt-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setModalTab('items')}
                className={cn(
                  "px-4 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border-b-2",
                  modalTab === 'items'
                    ? "border-[#00b4d8] text-[#00b4d8] bg-white shadow-2xs"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                )}
              >
                <Package className="w-4 h-4" />
                📦 อุปกรณ์ / สินค้าเดี่ยว
              </button>

              <button
                type="button"
                onClick={() => setModalTab('treatment_sets')}
                className={cn(
                  "px-4 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border-b-2",
                  modalTab === 'treatment_sets'
                    ? "border-[#00b4d8] text-[#00b4d8] bg-white shadow-2xs"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                )}
              >
                <Boxes className="w-4 h-4" />
                🎁 ชุดรักษา / แพ็กเกจอุปกรณ์ ({combinedTreatmentSets.length})
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {modalTab === 'items' ? (
                <>
                  {/* Form Section */}
                  <form onSubmit={handleSaveItem} className="bg-cyan-50/50 p-6 rounded-2xl border border-cyan-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-[#00b4d8]" />
                        {editingItemId ? 'แก้ไขข้อมูลรายการ' : 'เพิ่มอุปกรณ์ / รายการสินค้า / บริการใหม่'}
                      </h4>
                      {editingItemId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(null);
                            setItemName('');
                            setItemPrice('');
                            setItemCategory('Equipment');
                            setItemUnit('ชิ้น');
                            setCustomUnit('');
                            setItemStock('');
                            setItemBarcode('');
                          }}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600"
                        >
                          ยกเลิกการแก้ไข
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Name */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600">ชื่ออุปกรณ์ / สินค้า / บริการ <span className="text-rose-500">*</span></label>
                        <input 
                          type="text" 
                          required
                          placeholder="เช่น ชุดทำแผล, เข็มฉีดยา 3ml, ค่าบริการฉีดวัคซีน..."
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                        />
                      </div>

                      {/* Category */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">หมวดหมู่ <span className="text-rose-500">*</span></label>
                        <select
                          value={itemCategory}
                          onChange={(e) => setItemCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                        >
                          <option value="Equipment">อุปกรณ์ / เครื่องมือ</option>
                          <option value="Service">บริการ</option>
                          <option value="Medicine">ยา / เวชภัณฑ์</option>
                          <option value="Vaccine">วัคซีน</option>
                          <option value="Product">สินค้าทั่วไป</option>
                          <option value="Grooming">อาบน้ำ / ตัดขน</option>
                        </select>
                      </div>

                      {/* Price */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">ราคาขาย / ค่าบริการ (บาท) <span className="text-rose-500">*</span></label>
                        <input 
                          type="number" 
                          required
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={itemPrice}
                          onChange={(e) => setItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                        />
                      </div>

                      {/* Unit Selection */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">หน่วยการใช้งาน / หน่วยนับ <span className="text-rose-500">*</span></label>
                        <select
                          value={itemUnit}
                          onChange={(e) => setItemUnit(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                        >
                          {PRESET_UNITS.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>

                      {/* Custom Unit Input if selected */}
                      {itemUnit === 'ระบุเอง' && (
                        <div className="space-y-1 animate-in fade-in duration-200">
                          <label className="text-xs font-bold text-slate-600">พิมพ์หน่วยการใช้งาน</label>
                          <input 
                            type="text" 
                            required
                            placeholder="ระบุหน่วยเอง เช่น ขวด, หลอด, ชุด..."
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value)}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                          />
                        </div>
                      )}

                      {/* Stock Quantity */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">จำนวนสต็อก (ถ้ามี)</label>
                        <input 
                          type="number" 
                          placeholder="0"
                          value={itemStock}
                          onChange={(e) => setItemStock(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                        />
                      </div>

                      {/* Barcode */}
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-bold text-slate-600">บาร์โค้ด / รหัสสินค้า (สำหรับยิงสแกนเนอร์)</label>
                        <input 
                          type="text" 
                          placeholder="สแกน หรือพิมพ์รหัสบาร์โค้ด..."
                          value={itemBarcode}
                          onChange={(e) => setItemBarcode(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingItem}
                        className="px-6 py-2.5 bg-[#00b4d8] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#0096b4] transition-all shadow-md shadow-cyan-100 disabled:opacity-50 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {editingItemId ? 'อัปเดตข้อมูล' : 'บันทึกเพิ่มรายการใหม่'}
                      </button>
                    </div>
                  </form>

                  {/* Existing Items Table */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-sm">รายการอุปกรณ์และสินค้าทั้งหมด ({combinedItems.length} รายการ)</h4>
                    </div>

                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-black uppercase tracking-wider">
                            <th className="p-3">ชื่อรายการ</th>
                            <th className="p-3">หมวดหมู่</th>
                            <th className="p-3 text-right">ราคา</th>
                            <th className="p-3">หน่วยการใช้งาน</th>
                            <th className="p-3 text-center">สต็อก</th>
                            <th className="p-3 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {combinedItems.map((item) => (
                            <tr key={`tbl-${item.id}`} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3 font-bold text-slate-800">
                                {item.name}
                                {item.barcode && <span className="block text-[10px] text-slate-400 font-normal">บาร์โค้ด: {item.barcode}</span>}
                              </td>
                              <td className="p-3">
                                <span className={cn("px-2 py-0.5 rounded-md font-bold text-[10px] border", getCategoryBadgeClass(item.category))}>
                                  {item.category === 'Equipment' ? 'อุปกรณ์' : item.category}
                                </span>
                              </td>
                              <td className="p-3 text-right font-black text-[#00b4d8]">
                                {item.price.toLocaleString()} ฿
                              </td>
                              <td className="p-3 font-bold text-slate-600">
                                {item.unit || 'ชิ้น'}
                              </td>
                              <td className="p-3 text-center font-medium text-slate-500">
                                {item.quantity}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button 
                                    onClick={() => handleEditClick(item)}
                                    className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors"
                                    title="แก้ไข"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  {!item.id.startsWith('def-') && (
                                    <button 
                                      onClick={() => handleDeleteClick(item.id)}
                                      className="p-1.5 hover:bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg transition-colors"
                                      title="ลบ"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                /* Treatment Sets Management View */
                <div className="space-y-8">
                  {/* Form to create/edit Treatment Set */}
                  <form onSubmit={handleSaveTreatmentSet} className="bg-gradient-to-br from-cyan-50/60 to-blue-50/30 p-6 rounded-2xl border border-cyan-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-[#00b4d8]" />
                        {editingSetId ? 'แก้ไขข้อมูลชุดรักษา / แพ็กเกจ' : 'สร้างชุดรักษา / แพ็กเกจอุปกรณ์ใหม่'}
                      </h4>
                      {editingSetId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSetId(null);
                            setSetName('');
                            setSetDescription('');
                            setSetCategory('Equipment');
                            setSetItemsList([]);
                          }}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600"
                        >
                          ยกเลิกการแก้ไข
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Set Name */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600">ชื่อชุดรักษา / แพ็กเกจ <span className="text-rose-500">*</span></label>
                        <input 
                          type="text" 
                          required
                          placeholder="เช่น ชุดทำแผลสุนัขใหญ่, ชุดผ่าตัดทำหมัน, แพ็กเกจตรวจเลือด..."
                          value={setName}
                          onChange={(e) => setSetName(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                        />
                      </div>

                      {/* Category */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">หมวดหมู่หลัก <span className="text-rose-500">*</span></label>
                        <select
                          value={setCategory}
                          onChange={(e) => setSetCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                        >
                          <option value="Equipment">อุปกรณ์ / เครื่องมือ</option>
                          <option value="Service">บริการ</option>
                          <option value="Medicine">ยา / เวชภัณฑ์</option>
                          <option value="Vaccine">วัคซีน</option>
                          <option value="Product">สินค้าทั่วไป</option>
                        </select>
                      </div>

                      {/* Description */}
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-xs font-bold text-slate-600">คำอธิบายชุดรักษา (ถ้ามี)</label>
                        <input 
                          type="text" 
                          placeholder="ระบุคำอธิบายสั้นๆ เกี่ยวกับชุดรักษานี้..."
                          value={setDescription}
                          onChange={(e) => setSetDescription(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                        />
                      </div>
                    </div>

                    {/* Sub-Items Picker from Inventory */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                      <label className="text-xs font-bold text-slate-700 block">
                        ดึงอุปกรณ์/ยาจากคลังสินค้าเพื่อรวมเข้าชุด (ราคาจะคำนวณจากคลังโดยอัตโนมัติ)
                      </label>

                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <select
                          value={selectedInventoryItemId}
                          onChange={(e) => setSelectedInventoryItemId(e.target.value)}
                          className="flex-1 w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                        >
                          <option value="">-- เลือกรายการจาก Inventory --</option>
                          {combinedItems.map(inv => (
                            <option key={`opt-${inv.id}`} value={inv.id}>
                              {inv.name} (ราคาคลัง: {inv.price.toLocaleString()} ฿ / {inv.unit || 'ชิ้น'})
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <input 
                            type="number" 
                            min="1"
                            value={itemQtyForSet}
                            onChange={(e) => setItemQtyForSet(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-center focus:ring-2 focus:ring-[#00b4d8] outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAddItemToSetList}
                            disabled={!selectedInventoryItemId}
                            className="px-4 py-2 bg-[#00b4d8] text-white rounded-xl text-xs font-bold hover:bg-[#0096b4] transition-all disabled:opacity-40 whitespace-nowrap shadow-sm"
                          >
                            + เพิ่มเข้าชุด
                          </button>
                        </div>
                      </div>

                      {/* Items currently added to the set */}
                      {setItemsList.length > 0 ? (
                        <div className="mt-3 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                          {setItemsList.map((st, sIdx) => {
                            const invMatch = combinedItems.find(i => (st.itemId && i.id === st.itemId) || i.name.toLowerCase() === st.name.toLowerCase());
                            const unitPrice = invMatch ? invMatch.price : 0;
                            return (
                              <div key={`added-${sIdx}`} className="p-3 bg-slate-50/50 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-[#00b4d8]"></span>
                                  <span className="font-bold text-slate-800">{st.name}</span>
                                  <span className="text-slate-400 font-medium">(ราคาต่อหน่วย: {unitPrice.toLocaleString()} ฿)</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="font-bold text-[#00b4d8]">
                                    x{st.quantity} {st.unit || 'ชิ้น'} = {(unitPrice * st.quantity).toLocaleString()} ฿
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItemFromSetList(sIdx)}
                                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic text-center py-2">ยังไม่ได้เลือกอุปกรณ์เข้าชุดรักษา</p>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingSet || setItemsList.length === 0}
                        className="px-6 py-2.5 bg-[#00b4d8] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#0096b4] transition-all shadow-md shadow-cyan-100 disabled:opacity-50 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {editingSetId ? 'อัปเดตชุดรักษา' : 'บันทึกชุดรักษาใหม่'}
                      </button>
                    </div>
                  </form>

                  {/* List of existing treatment sets */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 text-sm">รายการชุดรักษา / แพ็กเกจอุปกรณ์ที่มี ({combinedTreatmentSets.length} ชุด)</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {combinedTreatmentSets.map((set) => {
                        const totalCalculated = getSetCalculatedPrice(set);
                        return (
                          <div key={`set-manage-${set.id}`} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className="font-black text-slate-800 text-sm">{set.name}</h5>
                                {set.description && <p className="text-xs text-slate-400 font-medium mt-0.5">{set.description}</p>}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditSetClick(set)}
                                  className="p-1.5 text-slate-400 hover:text-[#00b4d8] hover:bg-cyan-50 rounded-lg transition-colors"
                                  title="แก้ไข"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {!set.id.startsWith('def-') && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSetClick(set.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="ลบ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="bg-slate-50 p-2.5 rounded-xl space-y-1 text-xs">
                              {set.items.map((st, iIdx) => {
                                const invMatch = combinedItems.find(i => (st.itemId && i.id === st.itemId) || i.name.toLowerCase() === st.name.toLowerCase());
                                const uPrice = invMatch ? invMatch.price : 0;
                                return (
                                  <div key={`set-sub-${iIdx}`} className="flex justify-between text-slate-600">
                                    <span>• {st.name}</span>
                                    <span className="font-bold text-slate-700">x{st.quantity} {st.unit || 'ชิ้น'} ({uPrice.toLocaleString()} ฿)</span>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-bold uppercase">ราคารวมดึงจาก Inventory</span>
                              <span className="font-black text-[#00b4d8] text-sm">{totalCalculated.toLocaleString()} ฿</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {isCheckout && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Payment Success</h2>
              <p className="text-slate-400 font-medium">Transaction has been recorded.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsCheckout(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Close
              </button>
              <button className="flex-1 py-3 bg-[#00b4d8] text-white rounded-xl font-bold hover:bg-[#0096b4] transition-all shadow-lg shadow-cyan-100 flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
