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
  Tag
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

const PRESET_UNITS = [
  'ชิ้น', 'ชุด', 'ครั้ง', 'เม็ด', 'ขวด', 'หลอด', 'แผง', 'กล่อง', 
  'ถุง', 'อัน', 'เข็ม', 'กิโลกรัม', 'กรัม', 'ชั่วโมง', 'ระบุเอง'
];

const CATEGORIES = [
  { key: 'All', label: 'ทั้งหมด' },
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

  // POS Equipment & Pricing Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
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

    return () => {
      unsubscribePatients();
      unsubscribeInventory();
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
    const invItems = inventory.map(item => ({
      id: item.id,
      name: item.itemName || item.name || 'ไม่มีชื่อ',
      price: Number(item.unitPrice || item.price || 0),
      category: item.category || 'Product',
      unit: item.unit || 'ชิ้น',
      quantity: item.quantity ?? 0,
      barcode: item.barcode || ''
    }));

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

  // Filter items by category tab & search query
  const filteredDisplayItems = combinedItems.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

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
            <div className="relative w-80">
              <input 
                type="text" 
                placeholder="Search Owner, Pet or Scan Barcode..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-[#00b4d8] font-medium"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
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

      {/* Right: Cart & Checkout */}
      <div className="w-96 flex flex-col gap-6">
        <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-slate-400" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Current Bill</h3>
            </div>
            <span className="px-2 py-1 bg-[#00b4d8] text-white text-[10px] font-black rounded-lg">{cart.length} ITEMS</span>
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

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
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
