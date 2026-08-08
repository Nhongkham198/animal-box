import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, 
  Search, 
  Edit2, 
  ArrowLeft,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Check,
  Minus,
  Upload,
  FileSpreadsheet,
  Lock,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  History,
  Calendar,
  DollarSign,
  Clock,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  db, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  handleFirestoreError,
  OperationType,
  serverTimestamp,
  auth
} from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface Product {
  id: string;
  name: string;
  type: string;
  unit: string;
  currentStock: number;
  initialStock: number;
  minStock: number;
  isInStock: boolean;
  itemsPerPackage?: number;
  productType?: string;
  genericName?: string;
  barcode?: string;
  price?: number;
  expiryDate?: string;
  expiryDates?: string[];
  updatedAt?: any;
  updatedBy?: string;
  createdAt?: any;
  createdBy?: string;
  [key: string]: any;
}

const initialProducts: Product[] = [
  { id: '1', name: 'Advocate <4 kg cat', type: 'Anti-parasite', unit: 'หลอด', isInStock: true, currentStock: 0, initialStock: 0, minStock: 5 },
  { id: '2', name: 'Advocate <4 kg Dog', type: 'Anti-parasite', unit: 'หลอด', isInStock: true, currentStock: 0, initialStock: 0, minStock: 5 },
  { id: '3', name: 'Advocate 10-25 kg Dog', type: 'Anti-parasite', unit: 'หลอด', isInStock: true, currentStock: 0, initialStock: 0, minStock: 5 },
  { id: '4', name: 'Advocate 25-40 kg Dog', type: 'Anti-parasite', unit: 'หลอด', isInStock: true, currentStock: 0, initialStock: 0, minStock: 5 },
  { id: '5', name: 'Advocate 4-10 kg Dog', type: 'Anti-parasite', unit: 'หลอด', isInStock: true, currentStock: 0, initialStock: 0, minStock: 5 },
  { id: '6', name: 'Advocate 4-8 kg Cat', type: 'Anti-parasite', unit: 'หลอด', isInStock: true, currentStock: 0, initialStock: 0, minStock: 5 },
  { id: '7', name: 'Bayovac® DHPPi+L', type: 'Vaccine', unit: 'ขวด', isInStock: true, currentStock: 0, initialStock: 0, minStock: 5 },
];

const PRODUCT_TYPES = [
  'ยากิน (เม็ด)',
  'ยากิน (น้ำ)',
  'ยาหยด',
  'ยาฉีด',
  'ยาทา',
  'ยาหยอดตา',
  'ยาพ่น',
  'Anti-parasite',
  'Vaccine',
  'Medicine',
  'Supplies',
  'Other'
];
const UNITS = ['หลอด', 'ขวด', 'เม็ด', 'แผง', 'กล่อง', 'ถุง', 'กิโลกรัม', 'กรัม'];
const ACTIVITY_GROUPS = ['ยาและเวชภัณฑ์', 'บริการ', 'แล็บ', 'ศัลยกรรม', 'อื่นๆ'];
const ACTIVITY_SUB_GROUPS = [
  'ยาเห็บหมัด',
  'ยาเชื้อรา',
  'กระตุ้น',
  'ยาละลายเสมหะ',
  'ยาห้ามเลือด',
  'บำรุง',
  'กระดูกและข้อ',
  'ยาถ่ายพยาธิ',
  'วัคซีนรวม',
  'ยาฆ่าเชื้อ',
  'ตรวจเลือด',
  'อาบน้ำตัดขน'
];
const PET_TYPES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Exotic'];
const MEDICAL_USES = ['กิน', 'ทา', 'หยอดหู', 'หยอดตา', 'ฉีด'];
const DOSAGE_UNITS = ['เม็ด', 'CC', 'ML', 'หยด', 'หลอด'];

export default function ProductSetting() {
  const { user } = useAuth();
  const currentUserName = user?.displayName || user?.email?.split('@')[0] || auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Wasu Nganken';

  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const formatLastModifiedDate = (dateVal: any) => {
    if (!dateVal) return null;
    let d: Date | null = null;
    if (typeof dateVal === 'object' && typeof dateVal.toDate === 'function') {
      d = dateVal.toDate();
    } else if (typeof dateVal === 'object' && dateVal.seconds) {
      d = new Date(dateVal.seconds * 1000);
    } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
      d = new Date(dateVal);
    }
    if (!d || isNaN(d.getTime())) return null;

    const dateStr = d.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeStr = d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return { dateStr, timeStr };
  };

  const parseExpiryDate = (dateVal: any): Date | null => {
    if (!dateVal) return null;
    if (typeof dateVal === 'object' && typeof dateVal.toDate === 'function') {
      const d = dateVal.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof dateVal === 'object' && dateVal.seconds) {
      const d = new Date(dateVal.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (dateVal instanceof Date) {
      return isNaN(dateVal.getTime()) ? null : dateVal;
    }
    if (typeof dateVal === 'string') {
      const cleaned = dateVal.trim();
      if (!cleaned) return null;

      if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? null : d;
      }

      const parts = cleaned.split(/[\/\-]/);
      if (parts.length === 3) {
        let m = parseInt(parts[0], 10);
        let d = parseInt(parts[1], 10);
        let y = parseInt(parts[2], 10);

        if (m === 0) m = 1;
        if (y < 100) y += 2000;

        if (!isNaN(m) && !isNaN(d) && !isNaN(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          const dateObj = new Date(y, m - 1, d);
          if (!isNaN(dateObj.getTime())) return dateObj;
        }
      }

      const fallbackDate = new Date(cleaned);
      if (!isNaN(fallbackDate.getTime())) return fallbackDate;
    }
    return null;
  };

  const formatExpiryDateForInput = (dateVal: any): string => {
    const d = parseExpiryDate(dateVal);
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatExpiryDateDisplay = (dateVal: any): string | null => {
    const d = parseExpiryDate(dateVal);
    if (!d) {
      if (typeof dateVal === 'string' && dateVal.trim()) return dateVal.trim();
      return null;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getExpiryStatus = (dateVal: any) => {
    const d = parseExpiryDate(dateVal);
    if (!d) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exp = new Date(d);
    exp.setHours(0, 0, 0, 0);

    const diffMs = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        isExpired: true,
        isExpiringSoon: false,
        daysRemaining: diffDays,
        text: 'หมดอายุแล้ว',
        badgeClass: 'bg-rose-500 text-white font-bold'
      };
    }
    if (diffDays <= 14) {
      return {
        isExpired: false,
        isExpiringSoon: true,
        daysRemaining: diffDays,
        text: diffDays === 0 ? 'หมดอายุวันนี้' : `หมดอายุใน ${diffDays} วัน`,
        badgeClass: 'bg-amber-500 text-white font-bold'
      };
    }
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: diffDays,
      text: null,
      badgeClass: 'bg-emerald-50 text-emerald-700 font-medium'
    };
  };

  // Sync mode with Header back button
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('product-setting-mode-change', { detail: mode }));

    const handleHeaderBack = () => {
      if (mode === 'edit') {
        setMode('list');
      }
    };

    window.addEventListener('app-header-back', handleHeaderBack);
    return () => {
      window.removeEventListener('app-header-back', handleHeaderBack);
      window.dispatchEvent(new CustomEvent('product-setting-mode-change', { detail: 'list' }));
    };
  }, [mode]);

  const isFoodItem = (i: any) => {
    if (!i) return false;
    if (i.isFood || i.type === 'food' || i.type === 'Food' || i.productType === 'food' || i.productType === 'Food') return true;
    const cat = (i.category || '').toLowerCase();
    const pType = (i.productType || i.type || '').toLowerCase();
    const group = (i.activityGroup || '').toLowerCase();
    const subGroup = (i.activitySubGroup || '').toLowerCase();
    return pType === 'food' ||
           cat.includes('อาหาร') || group.includes('อาหาร') || subGroup.includes('อาหาร') ||
           cat.includes('นม') || group.includes('นม') || subGroup.includes('นม') ||
           cat.includes('food') || group.includes('food');
  };

  const getProductKey = (n: string, pkg?: string) => {
    const cleanN = (n || '').toLowerCase().trim();
    const cleanP = (pkg || '').toLowerCase().trim();
    return cleanP ? `${cleanN}___${cleanP}` : cleanN;
  };

  // Sync with Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(items.filter(item => !isFoodItem(item)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
      setLoading(false);
    });

    return () => unsub();
  }, []);
  
  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    success: number;
    duplicates: string[];
    show: boolean;
  } | null>(null);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [deleteError, setDeleteError] = useState(false);

  // Delete All State
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteAllPasscode, setDeleteAllPasscode] = useState('');
  const [deleteAllError, setDeleteAllError] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Excel Price Conflict State
  const [pendingImportItems, setPendingImportItems] = useState<Map<string, any> | null>(null);
  const [priceConflicts, setPriceConflicts] = useState<{
    key: string;
    name: string;
    oldPrice: number;
    newPrice: number;
    oldCostPrice: number;
    newCostPrice: number;
  }[]>([]);
  const [showPriceConflictModal, setShowPriceConflictModal] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

  // Helper to extract base unit (text after slash '/' if present, e.g. "10amp/กล่อง" -> "กล่อง")
  const extractUnitName = (u?: string) => {
    if (!u) return '';
    const trimmed = u.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      const after = parts[parts.length - 1].trim();
      if (after) return after;
    }
    return trimmed;
  };

  // Helper to extract package unit (text before '/' if present, with digits removed. e.g. "10แผง/กล่อง" -> "แผง", "1แผง" -> "แผง")
  const extractPackageUnit = (u?: string) => {
    if (!u) return '';
    const trimmed = u.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      const before = parts[0].trim();
      return before.replace(/^[0-9\s.,]+/, '').trim();
    }
    // If no slash but has digits at start, extract unit portion (e.g. "10แผง" -> "แผง")
    if (/^[0-9\s.,]+/.test(trimmed)) {
      return trimmed.replace(/^[0-9\s.,]+/, '').trim();
    }
    return '';
  };

  // Helper to determine active stock unit for display
  const getStockDisplayUnit = (product?: { unit?: string; packageUnit?: string; stockUnit?: string }) => {
    if (!product) return 'หน่วย';
    if (product.stockUnit) return product.stockUnit;
    return product.packageUnit || product.unit || 'หน่วย';
  };

  // Dynamic Product Types & Units
  const availableProductTypes = Array.from(new Set([
    ...PRODUCT_TYPES,
    ...products.map(p => p.productType || p.type).filter(Boolean),
    editingProduct?.productType,
    editingProduct?.type
  ])).filter(Boolean) as string[];

  const availableUnits = Array.from(new Set([
    ...UNITS,
    ...products.map(p => extractUnitName(p.unit)).filter(Boolean),
    ...products.map(p => p.unit).filter(Boolean),
    extractUnitName(editingProduct?.unit),
    editingProduct?.unit
  ])).filter(Boolean) as string[];

  const availablePackageUnits = Array.from(new Set([
    ...UNITS,
    ...products.map(p => p.packageUnit).filter(Boolean),
    ...products.map(p => extractPackageUnit(p.unit)).filter(Boolean),
    editingProduct?.packageUnit
  ])).filter(Boolean) as string[];

  const availableActivityGroups = Array.from(new Set([
    ...ACTIVITY_GROUPS,
    ...products.map(p => p.activityGroup).filter(Boolean),
    editingProduct?.activityGroup
  ])).filter(Boolean) as string[];

  const availableActivitySubGroups = Array.from(new Set([
    ...ACTIVITY_SUB_GROUPS,
    ...products.map(p => p.activitySubGroup).filter(Boolean),
    editingProduct?.activitySubGroup
  ])).filter(Boolean) as string[];

  const availableMedicalUses = Array.from(new Set([
    ...MEDICAL_USES,
    ...products.map(p => p.drugLabel?.medicalUse).filter(Boolean),
    editingProduct?.drugLabel?.medicalUse
  ])).filter(Boolean) as string[];

  const filteredProducts = products.filter(product => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = !q ||
      (product.name || '').toLowerCase().includes(q) ||
      (product.genericName || '').toLowerCase().includes(q) ||
      (product.barcode || '').toLowerCase().includes(q);
    const matchesType = !filterType || (product.productType || product.type) === filterType;
    return matchesQuery && matchesType;
  });

  // Success Toast State
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Purchase History Form State (Inside Edit Mode)
  const [newPurchaseDate, setNewPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPurchaseCost, setNewPurchaseCost] = useState<number | ''>('');
  const [newPurchaseQty, setNewPurchaseQty] = useState<number | ''>('');
  const [newPurchaseSupplier, setNewPurchaseSupplier] = useState('');
  const [newPurchaseNote, setNewPurchaseNote] = useState('');

  const handleCreate = () => {
    setNewPurchaseDate(new Date().toISOString().split('T')[0]);
    setNewPurchaseCost('');
    setNewPurchaseQty('');
    setNewPurchaseSupplier('');
    setNewPurchaseNote('');
    setEditingProduct({
      id: Math.random().toString(36).substr(2, 9),
      type: 'product',
      name: '',
      genericName: '',
      productType: '',
      unit: '',
      packageUnit: '',
      initialStockUnit: '',
      stockUnit: '',
      minStockUnit: '',
      barcode: '',
      initialStock: 0,
      currentStock: 0,
      minStock: 5,
      itemsPerPackage: 1,
      expiryDate: '',
      valueGroup: 'low',
      safetyStock: 0,
      leadTime: 0,
      maxStock: 0,
      activityGroup: '',
      activitySubGroup: '',
      petTypes: [],
      printGroup: '',
      price: 0,
      purchaseHistory: [],
      status: {
        appoint: { active: true, favorite: false },
        opd: { active: true, favorite: false },
        pos: { active: false, favorite: false },
      },
      vat: 'none',
      stockSetting: {
        name: '',
        amount: 0.01,
        showInReceipt: true
      },
      drugLabel: {
        enabled: true,
        mealsEnabled: true,
        medicalUse: '',
        position: '',
        dosage: 0,
        dosageUnit: '',
        timing: 'after',
        timingDetail: '',
        slots: { morning: false, noon: false, evening: false, bedtime: false },
        other: false,
        every: 0,
        asNeeded: false,
        warnings: { noEat: false, fridge: false, danger: false, shake: false },
        purpose: '',
        additional: ''
      }
    });
    setMode('edit');
  };

  const handleEdit = (product: Product) => {
    setNewPurchaseDate(new Date().toISOString().split('T')[0]);
    setNewPurchaseCost('');
    setNewPurchaseQty('');
    setNewPurchaseSupplier('');
    setNewPurchaseNote('');
    setEditingProduct({
      id: product.id,
      name: product.name || '',
      genericName: product.genericName || '',
      type: product.productType || product.type || '',
      productType: product.productType || product.type || '',
      unit: product.unit || '',
      packageUnit: product.packageUnit || '',
      initialStockUnit: product.initialStockUnit || product.stockUnit || product.packageUnit || product.unit || '',
      stockUnit: product.stockUnit || product.packageUnit || product.unit || '',
      minStockUnit: product.minStockUnit || product.stockUnit || product.packageUnit || product.unit || '',
      costPrice: product.costPrice ?? 0,
      initialStock: product.initialStock || 0,
      currentStock: product.currentStock || 0,
      minStock: product.minStock || 0,
      expiryDate: product.expiryDate || (product.expiryDates && product.expiryDates.length > 0 ? product.expiryDates[0] : ''),
      barcode: product.barcode || '',
      valueGroup: product.valueGroup || 'low',
      safetyStock: product.safetyStock || 0,
      leadTime: product.leadTime || 0,
      maxStock: product.maxStock || 0,
      activityGroup: product.activityGroup || '',
      activitySubGroup: product.activitySubGroup || '',
      petTypes: product.petTypes || [],
      printGroup: product.printGroup || '',
      price: product.price ?? 0,
      purchaseHistory: product.purchaseHistory || [],
      status: product.status || {
        appoint: { active: true, favorite: false },
        opd: { active: true, favorite: false },
        pos: { active: false, favorite: false },
      },
      vat: product.vat || 'none',
      stockSetting: product.stockSetting || {
        name: product.name,
        amount: 0.01,
        showInReceipt: true
      },
      drugLabel: product.drugLabel ? { mealsEnabled: true, ...product.drugLabel } : {
        enabled: true,
        mealsEnabled: true,
        medicalUse: '',
        position: '',
        dosage: 0,
        dosageUnit: '',
        timing: 'after',
        timingDetail: '',
        slots: { morning: false, noon: false, evening: false, bedtime: false },
        other: false,
        every: 0,
        asNeeded: false,
        warnings: { noEat: false, fridge: false, danger: false, shake: false },
        purpose: '',
        additional: ''
      }
    });
    setMode('edit');
  };

  const handleAddPurchaseRecord = () => {
    if (!newPurchaseCost || Number(newPurchaseCost) <= 0) {
      alert('กรุณาระบุราคาต้นทุนรับซื้อที่ถูกต้อง');
      return;
    }
    const newRecord = {
      id: Math.random().toString(36).substr(2, 9),
      date: newPurchaseDate || new Date().toISOString().split('T')[0],
      costPrice: Number(newPurchaseCost),
      quantity: Number(newPurchaseQty) || 0,
      supplier: newPurchaseSupplier || 'ไม่ระบุ',
      note: newPurchaseNote || ''
    };

    const currentHistory = editingProduct?.purchaseHistory || [];
    const updatedHistory = [...currentHistory, newRecord];

    setEditingProduct({
      ...editingProduct,
      purchaseHistory: updatedHistory
    });

    setNewPurchaseCost('');
    setNewPurchaseQty('');
    setNewPurchaseSupplier('');
    setNewPurchaseNote('');
  };

  const handleDeletePurchaseRecord = (recordId: string) => {
    const currentHistory = editingProduct?.purchaseHistory || [];
    const updatedHistory = currentHistory.filter((r: any) => r.id !== recordId);
    setEditingProduct({
      ...editingProduct,
      purchaseHistory: updatedHistory
    });
  };

  const getPurchaseAnalytics = (history: any[]) => {
    if (!history || history.length === 0) {
      return {
        latestCost: 0,
        prevCost: 0,
        diffAmount: 0,
        diffPercent: 0,
        trend: 'none',
        totalOrders: 0,
        avgDaysBetweenOrders: 0,
        lastOrderDate: '-'
      };
    }

    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sorted[sorted.length - 1];
    const latestCost = Number(latest.costPrice || 0);

    let prevCost = latestCost;
    let diffAmount = 0;
    let diffPercent = 0;
    let trend = 'same';

    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2];
      prevCost = Number(prev.costPrice || 0);
      diffAmount = latestCost - prevCost;
      diffPercent = prevCost > 0 ? ((latestCost - prevCost) / prevCost) * 100 : 0;
      if (diffAmount > 0) trend = 'up';
      else if (diffAmount < 0) trend = 'down';
      else trend = 'same';
    }

    let avgDaysBetweenOrders = 0;
    if (sorted.length >= 2) {
      const firstDate = new Date(sorted[0].date).getTime();
      const lastDate = new Date(sorted[sorted.length - 1].date).getTime();
      const totalDays = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)));
      avgDaysBetweenOrders = Math.round(totalDays / (sorted.length - 1));
    }

    return {
      latestCost,
      prevCost,
      diffAmount,
      diffPercent,
      trend,
      totalOrders: sorted.length,
      avgDaysBetweenOrders,
      lastOrderDate: latest.date
    };
  };

  const handleSave = async () => {
    if (!editingProduct.name) {
      alert('Please enter product name');
      return;
    }

    try {
      const finalType = editingProduct.productType || editingProduct.type || 'Other';
      const finalUnit = editingProduct.unit || 'หน่วย';
      const productData = {
        ...editingProduct,
        name: editingProduct.name,
        type: finalType,
        productType: finalType,
        unit: finalUnit,
        packageUnit: editingProduct.packageUnit || '',
        initialStockUnit: editingProduct.initialStockUnit || editingProduct.packageUnit || editingProduct.unit || '',
        stockUnit: editingProduct.stockUnit || editingProduct.packageUnit || editingProduct.unit || '',
        minStockUnit: editingProduct.minStockUnit || editingProduct.stockUnit || editingProduct.packageUnit || editingProduct.unit || '',
        costPrice: typeof editingProduct.costPrice === 'number' ? editingProduct.costPrice : (parseFloat(editingProduct.costPrice) || 0),
        price: typeof editingProduct.price === 'number' ? editingProduct.price : (parseFloat(editingProduct.price) || 0),
        updatedAt: serverTimestamp(),
        updatedBy: currentUserName
      };

      // If it's a new product (no ID exists in a way that implies creation or we want to force it)
      // Actually editingProduct.id is set in handleCreate, but we should check if it's existing in Firestore
      const isNew = !products.some(p => p.id === editingProduct.id);

      if (isNew) {
        const { id, ...dataToSave } = productData;
        await addDoc(collection(db, 'inventory'), {
          ...dataToSave,
          isInStock: true,
          createdAt: serverTimestamp(),
          createdBy: currentUserName
        });
      } else {
        const { id, ...dataToUpdate } = productData;
        await updateDoc(doc(db, 'inventory', id), dataToUpdate);
      }
      
      // Show success toast
      setToast({ show: true, message: 'บันทึกข้อมูลสำเร็จ!' });
      setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 3000);

      setMode('list');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    }
  };

  const toggleStock = async (product: Product) => {
    try {
      await updateDoc(doc(db, 'inventory', product.id), {
        isInStock: !product.isInStock,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${product.id}`);
    }
  };

  const handleDelete = async () => {
    if (passcode !== '999') {
      setDeleteError(true);
      return;
    }

    if (deletingId) {
      try {
        await deleteDoc(doc(db, 'inventory', deletingId));
        setDeletingId(null);
        setPasscode('');
        setDeleteError(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `inventory/${deletingId}`);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (deleteAllPasscode !== '198') {
      setDeleteAllError(true);
      return;
    }

    setIsDeletingAll(true);
    try {
      const deletePromises = products.map(product => deleteDoc(doc(db, 'inventory', product.id)));
      await Promise.all(deletePromises);
      
      setIsDeleteAllOpen(false);
      setDeleteAllPasscode('');
      setDeleteAllError(false);
      setToast({ show: true, message: 'ลบสินค้าทั้งหมดเรียบร้อยแล้ว!' });
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'inventory');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const executeImport = async (
    importedProductsMap: Map<string, any>,
    overwritePrices: boolean
  ) => {
    setIsImporting(true);
    try {
      let totalItems = 0;
      let successCount = 0;
      const duplicateNames: string[] = [];

      for (const [key, item] of importedProductsMap.entries()) {
        totalItems++;

        const existingDbProduct = products.find(p => getProductKey(p.name, p.packageUnit) === key);

        if (existingDbProduct) {
          duplicateNames.push(item.name);

          // Determine cost price & sale price to save
          const finalCostPrice = item.costPrice > 0 ? item.costPrice : (existingDbProduct.costPrice || 0);
          const finalPrice = overwritePrices 
            ? (item.price > 0 ? item.price : (existingDbProduct.price || 0))
            : (existingDbProduct.price > 0 ? existingDbProduct.price : (item.price || 0));

          await updateDoc(doc(db, 'inventory', existingDbProduct.id), {
            currentStock: (existingDbProduct.currentStock || 0) + item.currentStock,
            costPrice: finalCostPrice,
            price: finalPrice,
            type: item.type || existingDbProduct.type || 'Other',
            productType: item.type || existingDbProduct.productType || 'Other',
            itemsPerPackage: item.itemsPerPackage || existingDbProduct.itemsPerPackage || 1,
            unit: item.unit || existingDbProduct.unit || 'หน่วย',
            packageUnit: item.packageUnit || existingDbProduct.packageUnit || '',
            stockUnit: item.stockUnit || existingDbProduct.stockUnit || item.packageUnit || item.unit || 'หน่วย',
            initialStockUnit: item.stockUnit || existingDbProduct.initialStockUnit || item.packageUnit || item.unit || 'หน่วย',
            minStockUnit: item.stockUnit || existingDbProduct.minStockUnit || item.packageUnit || item.unit || 'หน่วย',
            activityGroup: item.activityGroup || existingDbProduct.activityGroup || '',
            activitySubGroup: item.activitySubGroup || existingDbProduct.activitySubGroup || '',
            drugLabel: {
              ...(existingDbProduct.drugLabel || { enabled: true }),
              medicalUse: item.medicalUse || existingDbProduct.drugLabel?.medicalUse || ''
            },
            expiryDate: (item.expiryDates && item.expiryDates.length > 0) ? item.expiryDates[0] : (existingDbProduct.expiryDate || ''),
            expiryDates: (item.expiryDates && item.expiryDates.length > 0) ? item.expiryDates : (existingDbProduct.expiryDates || []),
            updatedAt: serverTimestamp(),
            updatedBy: currentUserName
          });
          successCount++;
          continue;
        }

        const stockUnitToSave = item.stockUnit || item.packageUnit || item.unit || 'หน่วย';
        await addDoc(collection(db, 'inventory'), {
          name: item.name,
          type: item.type,
          productType: item.type,
          unit: item.unit,
          packageUnit: item.packageUnit || '',
          stockUnit: stockUnitToSave,
          initialStockUnit: stockUnitToSave,
          minStockUnit: stockUnitToSave,
          costPrice: item.costPrice || 0,
          price: item.price || 0,
          currentStock: item.currentStock,
          initialStock: item.currentStock,
          minStock: 5,
          itemsPerPackage: item.itemsPerPackage || 1,
          isInStock: item.currentStock > 0,
          activityGroup: item.activityGroup,
          activitySubGroup: item.activitySubGroup || '',
          expiryDate: (item.expiryDates && item.expiryDates.length > 0) ? item.expiryDates[0] : '',
          expiryDates: item.expiryDates || [],
          drugLabel: {
            enabled: true,
            medicalUse: item.medicalUse,
            position: '',
            dosage: 0,
            dosageUnit: '',
            timing: 'after',
            timingDetail: '',
            slots: { morning: false, noon: false, evening: false, bedtime: false },
            other: false,
            every: 0,
            asNeeded: false,
            warnings: { noEat: false, fridge: false, danger: false, shake: false },
            purpose: '',
            additional: ''
          },
          createdAt: serverTimestamp(),
          createdBy: currentUserName,
          updatedAt: serverTimestamp(),
          updatedBy: currentUserName
        });
        successCount++;
      }

      setImportSummary({
        total: totalItems,
        success: successCount,
        duplicates: duplicateNames,
        show: true
      });

    } catch (err) {
      console.error("Import error:", err);
    } finally {
      setIsImporting(false);
      setShowPriceConflictModal(false);
      setPendingImportItems(null);
      setPriceConflicts([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const importedProductsMap = new Map<string, {
          name: string;
          type: string;
          unit: string;
          packageUnit: string;
          stockUnit: string;
          itemsPerPackage?: number;
          costPrice: number;
          price: number;
          currentStock: number;
          expiryDates: string[];
          activityGroup: string;
          activitySubGroup: string;
          medicalUse: string;
        }>();

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          if (!data || data.length <= 1) continue;

          const sheetTabName = sheetName.trim();
          let currentCategory = sheetTabName;
          let lastProductName = '';
          let lastUnit = '';
          let lastPackageUnit = '';
          let lastStockUnit = '';
          let lastCost = 0;
          let lastPrice = 0;

          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const rawColA = String(row[0] || '').trim();
            const rawColB = String(row[1] || '').trim(); // ปริมาณ/หน่วย e.g. "3เม็ด/กล่อง"
            const rawColC = row[2] !== undefined ? String(row[2]).trim() : ''; // ราคาทุน
            const rawColD = row[3] !== undefined ? String(row[3]).trim() : ''; // ราคาขาย
            const rawColE = row[4] !== undefined ? String(row[4]).trim() : ''; // จำนวนคงเหลือ
            const rawColF = row[5] !== undefined ? String(row[5]).trim() : ''; // วันหมดอายุ

            if (rawColA && !rawColB && !rawColC && !rawColD && !rawColE) {
              currentCategory = rawColA;
              lastProductName = '';
              continue;
            }

            const cleanNumber = (valStr: string) => {
              if (!valStr) return 0;
              const match = valStr.match(/[0-9]+(\.[0-9]+)?/);
              return match ? parseFloat(match[0]) : 0;
            };

            const isColEDate = (rawColE.includes('/') || rawColE.includes('-')) && isNaN(Number(rawColE));

            let qty = 0;
            let cost = 0;
            let price = 0;
            let expiryDateVal = rawColF;
            let qtyRawStr = rawColE;

            if (isColEDate) {
              // Food Excel Format: Col C = Selling Price (ราคาขาย), Col D = Stock (จำนวนคงเหลือ), Col E = Expiry Date (วันหมดอายุ)
              price = cleanNumber(rawColC);
              qty = cleanNumber(rawColD);
              qtyRawStr = rawColD;
              expiryDateVal = rawColE;
              cost = cleanNumber(rawColF);
            } else {
              // Standard 6-col format: Col C = Cost, Col D = Selling, Col E = Stock, Col F = Expiry
              cost = cleanNumber(rawColC);
              price = cleanNumber(rawColD);
              qty = cleanNumber(rawColE);
              qtyRawStr = rawColE;
            }

            let productName = rawColA;
            const parsedUnit = extractUnitName(rawColB);
            const parsedPackageUnit = extractPackageUnit(rawColB);
            const extractedStockUnit = qtyRawStr ? qtyRawStr.replace(/^[0-9\s.,]+/, '').trim() : '';

            let unit = parsedUnit || lastUnit;
            let packageUnit = parsedPackageUnit || lastPackageUnit;
            let stockUnit = extractedStockUnit || packageUnit || unit || lastStockUnit || 'หน่วย';

            if (!productName) {
              if (lastProductName && (qty > 0 || rawColF)) {
                productName = lastProductName;
              } else {
                continue;
              }
            } else {
              lastProductName = productName;
              if (unit) lastUnit = unit;
              if (packageUnit) lastPackageUnit = packageUnit;
              if (stockUnit) lastStockUnit = stockUnit;
              if (cost > 0) lastCost = cost;
              if (price > 0) lastPrice = price;
            }

            const key = getProductKey(productName, packageUnit);
            const existing = importedProductsMap.get(key);

            const finalCost = cost > 0 ? cost : (existing?.costPrice || lastCost);
            const finalPrice = price > 0 ? price : (existing?.price || lastPrice);
            const ratioMatch = rawColB.match(/(\d+)/);
            const itemsPerPackage = ratioMatch ? parseInt(ratioMatch[1]) : 1;

            if (existing) {
              existing.currentStock += qty;
              if (extractedStockUnit) existing.stockUnit = extractedStockUnit;
              if (rawColF) existing.expiryDates.push(rawColF);
            } else {
              importedProductsMap.set(key, {
                name: productName,
                type: currentCategory,
                unit: unit || 'หน่วย',
                packageUnit: packageUnit || '',
                stockUnit: stockUnit,
                itemsPerPackage: itemsPerPackage,
                costPrice: finalCost,
                price: finalPrice,
                currentStock: qty,
                expiryDates: rawColF ? [rawColF] : [],
                activityGroup: sheetTabName,
                activitySubGroup: currentCategory,
                medicalUse: sheetTabName
              });
            }
          }
        }

        // Check for conflicts with existing DB products having old prices
        const conflicts: {
          key: string;
          name: string;
          oldPrice: number;
          newPrice: number;
          oldCostPrice: number;
          newCostPrice: number;
        }[] = [];

        for (const [key, item] of importedProductsMap.entries()) {
          const existingDbProduct = products.find(p => getProductKey(p.name, p.packageUnit) === key);
          if (existingDbProduct && existingDbProduct.price > 0 && item.price > 0 && existingDbProduct.price !== item.price) {
            conflicts.push({
              key,
              name: item.name,
              oldPrice: existingDbProduct.price,
              newPrice: item.price,
              oldCostPrice: existingDbProduct.costPrice || 0,
              newCostPrice: item.costPrice || 0
            });
          }
        }

        if (conflicts.length > 0) {
          setPendingImportItems(importedProductsMap);
          setPriceConflicts(conflicts);
          setShowPriceConflictModal(true);
          setIsImporting(false);
        } else {
          await executeImport(importedProductsMap, true);
        }
      } catch (err) {
        console.error("Import error:", err);
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  if (mode === 'edit') {
    return (
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">PRODUCT SETTING</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMode('list')}
              className="px-8 py-2 bg-white border border-[#00b4d8] text-[#00b4d8] rounded-lg font-bold hover:bg-cyan-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-8 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>



        {/* Main Form */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Left: Cover Picture */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-4">Cover Picture</label>
              <div className="relative aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 group cursor-pointer hover:border-[#00b4d8] transition-all">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-cyan-50 transition-colors">
                  <Upload className="w-8 h-8 text-slate-300 group-hover:text-[#00b4d8]" />
                </div>
                <p className="text-[10px] text-slate-400 text-center italic px-4">แนบรูป เป็น cover card</p>
              </div>
            </div>

            {/* Right: Product Details */}
            <div className="lg:col-span-3 space-y-8">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Product Name (Trade Name)</label>
                  <input 
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Generic Name, Concentration</label>
                  <input 
                    type="text"
                    placeholder="เช่น Paracetamol 500 mg, Aspirin 81 mg"
                    value={editingProduct.genericName}
                    onChange={(e) => setEditingProduct({ ...editingProduct, genericName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-sm"
                  />
                  <p className="mt-1 text-[10px] text-[#00b4d8] font-bold">*กรณีที่เป็น เวชภัณฑ์</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Type (ชนิดยา/หมวดหมู่)</label>
                  <div className="relative">
                    <input 
                      type="text"
                      list="productTypeDatalist"
                      placeholder="เลือก หรือ พิมพ์ชนิดยา (เช่น ยาซึม/ยาสลบ)"
                      value={editingProduct?.productType || editingProduct?.type || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, productType: e.target.value, type: e.target.value })}
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-800 [&::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                    <datalist id="productTypeDatalist">
                      {availableProductTypes.map(t => <option key={t} value={t} />)}
                    </datalist>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ปริมาณบรรจุ</label>
                  <div className="relative">
                    <input 
                      type="text"
                      list="packageUnitDatalist"
                      placeholder="เลือก หรือ พิมพ์หน่วยย่อย (เช่น แผง, amp, เม็ด)"
                      value={editingProduct?.packageUnit || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, packageUnit: e.target.value })}
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-800 [&::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                    <datalist id="packageUnitDatalist">
                      {availablePackageUnits.map(u => <option key={u} value={u} />)}
                    </datalist>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400 italic">ตัดตัวเลขออก เหลือเฉพาะชื่อหน่วย เช่น แผง, amp, เม็ด</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">หน่วยตั้งต้น</label>
                  <div className="relative">
                    <input 
                      type="text"
                      list="unitDatalist"
                      placeholder="เลือก หรือ พิมพ์หน่วยหลัก (เช่น กล่อง, ขวด)"
                      value={editingProduct?.unit || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-800 [&::-webkit-calendar-picker-indicator]:opacity-0"
                    />
                    <datalist id="unitDatalist">
                      {availableUnits.map(u => <option key={u} value={u} />)}
                    </datalist>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400 italic">หน่วยหลัก เช่น กล่อง, ขวด, แผง, ซอง</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Barcode</label>
                  <input 
                    type="text"
                    value={editingProduct.barcode}
                    onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                    placeholder="Scan or enter barcode"
                  />
                </div>
                {(() => {
                  const defaultBaseUnit = editingProduct?.stockUnit || editingProduct?.packageUnit || editingProduct?.unit || 'หน่วย';
                  const initialStockUnit = editingProduct?.initialStockUnit || defaultBaseUnit;
                  const currentStockUnit = editingProduct?.stockUnit || defaultBaseUnit;
                  const minStockUnit = editingProduct?.minStockUnit || currentStockUnit;

                  const stockUnitOptions = Array.from(new Set([
                    editingProduct?.unit,
                    editingProduct?.packageUnit,
                    initialStockUnit,
                    currentStockUnit,
                    minStockUnit,
                    'amp', 'vial', 'กล่อง', 'ขวด', 'แผง', 'ซอง', 'เม็ด', 'หลอด', 'ml', 'มล.', 'ถุง', 'ชิ้น', 'เข็ม', 'cc'
                  ].filter(Boolean))) as string[];

                  const renderUnitSelect = (selectedValue: string, fieldName: 'initialStockUnit' | 'stockUnit' | 'minStockUnit') => (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                      <select
                        value={selectedValue}
                        onChange={(e) => setEditingProduct({ ...editingProduct, [fieldName]: e.target.value })}
                        className="bg-slate-100/90 hover:bg-slate-200 text-slate-700 font-bold text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 outline-none cursor-pointer transition-all shadow-sm focus:ring-2 focus:ring-cyan-500/30"
                        title="คลิกเพื่อเลือกหน่วย"
                      >
                        {stockUnitOptions.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  );

                  return (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          จำนวนเริ่มต้น (Initial) <span className="text-indigo-500 font-semibold">({initialStockUnit})</span>
                        </label>
                        <div className="relative">
                          <input 
                            type="number"
                            value={editingProduct.initialStock}
                            onChange={(e) => setEditingProduct({ ...editingProduct, initialStock: parseInt(e.target.value) || 0 })}
                            className="w-full pl-4 pr-24 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium text-indigo-500"
                          />
                          {renderUnitSelect(initialStockUnit, 'initialStockUnit')}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          จำนวนคงเหลือ (Stock QTY) <span className="text-[#00b4d8] font-bold">({currentStockUnit})</span>
                        </label>
                        <div className="relative">
                          <input 
                            type="number"
                            value={editingProduct.currentStock}
                            onChange={(e) => setEditingProduct({ ...editingProduct, currentStock: parseInt(e.target.value) || 0 })}
                            className="w-full pl-4 pr-24 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium text-[#00b4d8]"
                          />
                          {renderUnitSelect(currentStockUnit, 'stockUnit')}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400 italic">
                          *ระบุจำนวนตามหน่วยนับจริง ({currentStockUnit})
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          จุดแจ้งเตือน (Min Alert) <span className="text-rose-500 font-semibold">({minStockUnit})</span>
                        </label>
                        <div className="relative">
                          <input 
                            type="number"
                            value={editingProduct.minStock}
                            onChange={(e) => setEditingProduct({ ...editingProduct, minStock: parseInt(e.target.value) || 0 })}
                            className="w-full pl-4 pr-24 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium text-rose-500"
                          />
                          {renderUnitSelect(minStockUnit, 'minStockUnit')}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          อัตราการบรรจุ (จำนวนต่อบรรจุภัณฑ์)
                        </label>
                        <div className="relative">
                          <input 
                            type="number"
                            min="1"
                            placeholder="1"
                            value={editingProduct.itemsPerPackage ?? 1}
                            onChange={(e) => setEditingProduct({ ...editingProduct, itemsPerPackage: parseInt(e.target.value) || 1 })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium text-slate-700 focus:ring-2 focus:ring-[#00b4d8]"
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400 italic">
                          *เช่น 10 (10 เม็ด/แผง) เพื่อใช้แปลงตัดสต๊อกเวลากินหรือจ่ายยา
                        </p>
                      </div>
                      <div className="md:col-span-1">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-bold text-slate-700">
                            วันหมดอายุ (Expiry Date)
                          </label>
                          {editingProduct.expiryDate && (() => {
                            const status = getExpiryStatus(editingProduct.expiryDate);
                            if (status?.isExpired) {
                              return (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold animate-pulse">
                                  <AlertTriangle className="w-3 h-3" /> หมดอายุแล้ว
                                </span>
                              );
                            }
                            if (status?.isExpiringSoon) {
                              return (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                                  <Clock className="w-3 h-3" /> หมดอายุใน {status.daysRemaining} วัน
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="relative">
                          <input 
                            type="date"
                            value={formatExpiryDateForInput(editingProduct.expiryDate)}
                            onChange={(e) => setEditingProduct({ ...editingProduct, expiryDate: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none font-medium text-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400 italic">
                          *แจ้งเตือนเมื่อใกล้หมดอายุล่วงหน้า 14 วัน
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex items-center gap-8">
                <p className="text-sm font-bold text-slate-700">กลุ่มมูลค่าสินค้า</p>
                <div className="flex gap-4">
                  {[
                    { label: 'ราคาสูง', value: 'high' },
                    { label: 'ราคาปานกลาง', value: 'medium' },
                    { label: 'ราคาต่ำ', value: 'low' }
                  ].map((item) => (
                    <label 
                      key={item.value} 
                      onClick={() => setEditingProduct({ ...editingProduct, valueGroup: item.value })}
                      className="flex items-center gap-3 px-6 py-2 rounded-xl border border-slate-100 bg-white cursor-pointer hover:bg-slate-50 transition-all"
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        editingProduct.valueGroup === item.value ? "border-[#00b4d8]" : "border-slate-200"
                      )}>
                        {editingProduct.valueGroup === item.value && <div className="w-2 h-2 rounded-full bg-[#00b4d8]" />}
                      </div>
                      <span className={cn("text-sm font-bold", editingProduct.valueGroup === item.value ? "text-[#00b4d8]" : "text-slate-400")}>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <p className="text-sm font-bold text-slate-800">ตั้งค่าจำนวนวันเพื่อคำนวณ Safety stock, Max stock, Re order point</p>
                {[
                  { label: 'จำนวนวันที่ต้องการเก็บสินค้าเพื่อความปลอดภัย (Safety Stock)', key: 'safetyStock', hint: '*เพื่อคำนวณ จุดสั่งซื้อ (Re order point) และ Safety stock (ต้องมากกว่า Lead time)' },
                  { label: 'ระยะเวลารอคอยการสั่งซื้อ (Lead time)', key: 'leadTime', hint: '*เพื่อคำนวณ จุดสั่งซื้อ (Re order point)' },
                  { label: 'จำนวนวันที่ต้องการเก็บสินค้าสูงสุด (Max Stock)', key: 'maxStock', hint: '*เพื่อคำนวณ Max Stock (ต้องมากกว่าจำนวน Safety stock)' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-8">
                    <p className="w-80 text-sm font-bold text-slate-600 leading-tight">{item.label}</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center w-32 border border-slate-100 bg-slate-50/50 rounded-lg overflow-hidden">
                        <button 
                          onClick={() => setEditingProduct({ ...editingProduct, [item.key]: Math.max(0, editingProduct[item.key] - 1) })}
                          className="p-2 hover:bg-slate-100 text-slate-400 transition-colors border-r border-slate-100"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input 
                          type="number"
                          value={editingProduct[item.key]}
                          onChange={(e) => setEditingProduct({ ...editingProduct, [item.key]: parseInt(e.target.value) || 0 })}
                          className="w-full text-center font-bold text-slate-700 outline-none bg-transparent"
                        />
                        <button 
                          onClick={() => setEditingProduct({ ...editingProduct, [item.key]: editingProduct[item.key] + 1 })}
                          className="p-2 hover:bg-slate-100 text-slate-400 transition-colors border-l border-slate-100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[10px] text-[#00b4d8] font-bold">{item.hint}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-700">วัน</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Activity Settings */}
          <div className="space-y-8">
            <h3 className="text-lg font-black text-slate-800">ตั้งค่า Activity <span className="text-green-500 ml-2">สถานะ: เปิดการใช้งาน</span></h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
              <div className="lg:col-span-1" />
              <div className="lg:col-span-3 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Activity Group <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input 
                        type="text"
                        list="activityGroupDatalist"
                        placeholder="เลือก หรือ พิมพ์ Activity Group (เช่น ยาฉีด, ยาและเวชภัณฑ์)"
                        value={editingProduct?.activityGroup || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, activityGroup: e.target.value })}
                        className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-800 [&::-webkit-calendar-picker-indicator]:opacity-0"
                      />
                      <datalist id="activityGroupDatalist">
                        {availableActivityGroups.map(g => <option key={g} value={g} />)}
                      </datalist>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Activity Sub Group <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input 
                        type="text"
                        list="activitySubGroupDatalist"
                        placeholder="เลือก หรือ พิมพ์ Activity Sub Group (เช่น ยาเห็บหมัด, ยาเชื้อรา)"
                        value={editingProduct?.activitySubGroup || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, activitySubGroup: e.target.value })}
                        className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-800 [&::-webkit-calendar-picker-indicator]:opacity-0"
                      />
                      <datalist id="activitySubGroupDatalist">
                        {availableActivitySubGroups.map(s => <option key={s} value={s} />)}
                      </datalist>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Pet Type</label>
                    <div className="relative">
                      <select 
                        value={editingProduct.petTypes?.[0] || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, petTypes: [e.target.value] })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none appearance-none font-medium"
                      >
                        <option value="">Pet Type</option>
                        {PET_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                    <p className="mt-1 text-[10px] text-[#00b4d8] font-bold">(ถ้าไม่เลือกจะแสดงในทุกชนิด)</p>
                  </div>
                  <div className="flex items-center pt-7">
                    <p className="text-[10px] text-[#00b4d8] font-bold">*สามารถเลือกได้มากกว่า 1 ชนิด</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">กลุ่มสำหรับพิมพ์ใบเสร็จแบบย่อ</label>
                    <input 
                      type="text"
                      placeholder="Print Group"
                      value={editingProduct.printGroup}
                      onChange={(e) => setEditingProduct({ ...editingProduct, printGroup: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                    />
                  </div>
                  <button className="mt-7 px-6 py-3 bg-cyan-50 text-[#00b4d8] rounded-xl font-bold hover:bg-cyan-100 transition-all border border-cyan-100">
                    +เพิ่มกลุ่ม
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ราคา (ราคาขาย)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={editingProduct.price ?? ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-bold text-center"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">บาท</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ราคาทุน</label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={editingProduct.costPrice ?? ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, costPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-bold text-center"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">บาท</span>
                    </div>
                  </div>
                </div>



                <div className="flex items-center gap-8 pt-4">
                  <p className="font-bold text-slate-700">ภาษีมูลค่าเพิ่ม</p>
                <div className="flex gap-6">
                  {[
                    { label: 'ไม่มี VAT', value: 'none' },
                    { label: 'VAT 7%', value: 'vat7' }
                  ].map((item) => (
                    <label 
                      key={item.value}
                      onClick={() => setEditingProduct({ ...editingProduct, vat: item.value })}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        editingProduct.vat === item.value ? "border-[#00b4d8]" : "border-slate-300"
                      )}>
                        {editingProduct.vat === item.value && <div className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />}
                      </div>
                      <span className={cn("text-sm font-bold", editingProduct.vat === item.value ? "text-[#00b4d8]" : "text-slate-400")}>{item.label}</span>
                    </label>
                  ))}
                </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Stock Cutting Settings */}
          <div className="space-y-8">
            <h3 className="text-lg font-black text-slate-800">ตั้งค่าการตัด stock และแสดงในใบเสร็จ</h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
              <div className="lg:col-span-1" />
              <div className="lg:col-span-3 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Product Name:</label>
                    <input 
                      type="text"
                      value={editingProduct.stockSetting.name}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        stockSetting: { ...editingProduct.stockSetting, name: e.target.value }
                      })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                    />
                  </div>
                  <div className="w-48">
                    <label className="block text-sm font-bold text-slate-700 mb-2">จำนวน</label>
                    <input 
                      type="number"
                      value={editingProduct.stockSetting.amount}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        stockSetting: { ...editingProduct.stockSetting, amount: parseFloat(e.target.value) }
                      })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-bold text-center"
                    />
                  </div>
                  <div className="pt-7">
                    <label 
                      onClick={() => setEditingProduct({
                        ...editingProduct,
                        stockSetting: { ...editingProduct.stockSetting, showInReceipt: !editingProduct.stockSetting.showInReceipt }
                      })}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#00b4d8] bg-white cursor-pointer"
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-all",
                        editingProduct.stockSetting.showInReceipt ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-300 bg-white"
                      )}>
                        {editingProduct.stockSetting.showInReceipt && <Check className="w-3 h-3 text-white stroke-[4]" />}
                      </div>
                      <span className={cn("text-sm font-bold", editingProduct.stockSetting.showInReceipt ? "text-[#00b4d8]" : "text-slate-400")}>แสดงในใบเสร็จ</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Drug Label Setting */}
          <div className="space-y-8">
            <div 
              onClick={() => setEditingProduct({
                ...editingProduct,
                drugLabel: { ...editingProduct.drugLabel, enabled: !editingProduct.drugLabel.enabled }
              })}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className={cn(
                "w-5 h-5 rounded border flex items-center justify-center transition-all",
                editingProduct.drugLabel.enabled ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-300 bg-white"
              )}>
                {editingProduct.drugLabel.enabled && <Check className="w-3 h-3 text-white stroke-[4]" />}
              </div>
              <h3 className={cn("text-lg font-black", editingProduct.drugLabel.enabled ? "text-[#00b4d8]" : "text-slate-400")}>Drug Label Setting</h3>
            </div>
            
            <div className={cn("grid grid-cols-1 lg:grid-cols-4 gap-12 transition-opacity", !editingProduct.drugLabel.enabled && "opacity-40 pointer-events-none")}>
              <div className="lg:col-span-1" />
              <div className="lg:col-span-3 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">วิธีการใช้</label>
                    <div className="relative">
                      <input 
                        type="text"
                        list="medicalUseDatalist"
                        placeholder="เลือก หรือ พิมพ์วิธีการใช้ (เช่น ยาฉีด, กิน, ทา)"
                        value={editingProduct?.drugLabel?.medicalUse || ''}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          drugLabel: { ...(editingProduct?.drugLabel || { enabled: true }), medicalUse: e.target.value }
                        })}
                        className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none font-medium text-slate-800 [&::-webkit-calendar-picker-indicator]:opacity-0"
                      />
                      <datalist id="medicalUseDatalist">
                        {availableMedicalUses.map(m => <option key={m} value={m} />)}
                      </datalist>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ตำแหน่งที่ใช้</label>
                  <input 
                    type="text"
                    value={editingProduct.drugLabel.position}
                    onChange={(e) => setEditingProduct({
                      ...editingProduct,
                      drugLabel: { ...editingProduct.drugLabel, position: e.target.value }
                    })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  <p className="text-sm font-bold text-slate-700 w-32 shrink-0">ปริมาณการใช้ (ต่อครั้ง)</p>
                  <div className="flex items-center gap-6 flex-1">
                    <div className="flex items-center w-32 border border-slate-100 bg-slate-50/50 rounded-lg overflow-hidden shrink-0">
                      <button 
                        onClick={() => setEditingProduct({
                          ...editingProduct,
                          drugLabel: { ...editingProduct.drugLabel, dosage: Math.max(0, editingProduct.drugLabel.dosage - 1) }
                        })}
                        className="p-2 hover:bg-slate-100 text-slate-400 transition-colors border-r border-slate-100"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input 
                        type="number"
                        value={editingProduct.drugLabel.dosage}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          drugLabel: { ...editingProduct.drugLabel, dosage: parseFloat(e.target.value) }
                        })}
                        className="w-full text-center font-bold text-slate-700 outline-none bg-transparent"
                      />
                      <button 
                        onClick={() => setEditingProduct({
                          ...editingProduct,
                          drugLabel: { ...editingProduct.drugLabel, dosage: editingProduct.drugLabel.dosage + 1 }
                        })}
                        className="p-2 hover:bg-slate-100 text-slate-400 transition-colors border-l border-slate-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="relative w-48 shrink-0">
                      <select 
                        value={editingProduct.drugLabel.dosageUnit}
                        onChange={(e) => setEditingProduct({
                          ...editingProduct,
                          drugLabel: { ...editingProduct.drugLabel, dosageUnit: e.target.value }
                        })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-[#00b4d8] outline-none appearance-none font-medium"
                      >
                        <option value="">Select Unit</option>
                        {DOSAGE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Timing Section */}
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="w-32 shrink-0 pt-1 space-y-2">
                      <p className="text-sm font-bold text-slate-700">เวลา</p>
                      {/* Meal Selection Toggle Button */}
                      <div 
                        onClick={() => {
                          const isMealOn = editingProduct.drugLabel?.mealsEnabled ?? true;
                          setEditingProduct({
                            ...editingProduct,
                            drugLabel: {
                              ...editingProduct.drugLabel,
                              mealsEnabled: !isMealOn
                            }
                          });
                        }}
                        className="flex items-center gap-2 cursor-pointer select-none group"
                        title="เปิด/ปิด การเลือกมื้ออาหาร"
                      >
                        <div className={cn(
                          "w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5",
                          (editingProduct.drugLabel?.mealsEnabled ?? true) ? "bg-[#00b4d8]" : "bg-slate-300"
                        )}>
                          <div className={cn(
                            "w-4 h-4 rounded-full bg-white shadow-md transition-transform transform",
                            (editingProduct.drugLabel?.mealsEnabled ?? true) ? "translate-x-4" : "translate-x-0"
                          )} />
                        </div>
                        <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700">
                          {(editingProduct.drugLabel?.mealsEnabled ?? true) ? "เปิดใช้งาน" : "ไม่ใช้งาน"}
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      "flex flex-wrap gap-x-12 gap-y-6 flex-1 transition-all duration-200",
                      !(editingProduct.drugLabel?.mealsEnabled ?? true) && "opacity-40 pointer-events-none"
                    )}>
                      {[
                        { label: 'Before Meals', value: 'before' },
                        { label: 'After Meals', value: 'after' },
                        { label: 'With Meals', value: 'with' }
                      ].map((item) => (
                        <div key={item.value} className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                          <label 
                            onClick={() => setEditingProduct({
                              ...editingProduct,
                              drugLabel: { ...editingProduct.drugLabel, timing: item.value }
                            })}
                            className="flex items-center gap-3 cursor-pointer shrink-0"
                          >
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                              editingProduct.drugLabel.timing === item.value ? "border-[#00b4d8]" : "border-slate-200"
                            )}>
                              {editingProduct.drugLabel.timing === item.value && <div className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />}
                            </div>
                            <span className={cn("text-sm font-bold", editingProduct.drugLabel.timing === item.value ? "text-slate-700" : "text-slate-400")}>{item.label}</span>
                          </label>
                          <input 
                            type="text"
                            placeholder="อธิบายเพิ่มเติม เช่น 30 นาที"
                            value={editingProduct.drugLabel.timing === item.value ? editingProduct.drugLabel.timingDetail : ''}
                            onChange={(e) => setEditingProduct({
                              ...editingProduct,
                              drugLabel: { ...editingProduct.drugLabel, timingDetail: e.target.value }
                            })}
                            className="px-4 py-2 rounded-lg border border-slate-100 bg-slate-50/50 outline-none text-xs w-full sm:w-48"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Daily Slots */}
                  <div className={cn(
                    "flex flex-wrap gap-4 sm:ml-36 transition-all duration-200",
                    !(editingProduct.drugLabel?.mealsEnabled ?? true) && "opacity-40 pointer-events-none"
                  )}>
                    {[
                      { label: 'เช้า', key: 'morning' },
                      { label: 'กลางวัน', key: 'noon' },
                      { label: 'เย็น', key: 'evening' },
                      { label: 'ก่อนนอน', key: 'bedtime' }
                    ].map((item) => (
                      <label 
                        key={item.key}
                        onClick={() => setEditingProduct({
                          ...editingProduct,
                          drugLabel: {
                            ...editingProduct.drugLabel,
                            slots: { ...editingProduct.drugLabel.slots, [item.key]: !editingProduct.drugLabel.slots[item.key] }
                          }
                        })}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all",
                          editingProduct.drugLabel.slots[item.key] ? "border-[#00b4d8] bg-cyan-50" : "border-slate-100 bg-slate-50/50 opacity-40"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          editingProduct.drugLabel.slots[item.key] ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-300 bg-white"
                        )}>
                          {editingProduct.drugLabel.slots[item.key] && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                        </div>
                        <span className={cn("text-xs font-bold", editingProduct.drugLabel.slots[item.key] ? "text-[#00b4d8]" : "text-slate-400")}>{item.label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Other Options */}
                  <div className="flex flex-wrap gap-x-12 gap-y-6 sm:ml-36">
                    <div className="flex flex-wrap items-center gap-8">
                      <label 
                        onClick={() => setEditingProduct({
                          ...editingProduct,
                          drugLabel: { ...editingProduct.drugLabel, other: !editingProduct.drugLabel.other }
                        })}
                        className="flex items-center gap-3 cursor-pointer shrink-0"
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          editingProduct.drugLabel.other ? "border-[#00b4d8]" : "border-slate-200"
                        )}>
                          {editingProduct.drugLabel.other && <div className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />}
                        </div>
                        <span className={cn("text-sm font-bold", editingProduct.drugLabel.other ? "text-[#00b4d8]" : "text-slate-700")}>อื่นๆ</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded border border-slate-200 bg-white" />
                        <span className="text-sm font-bold text-slate-400">ทุก / Every</span>
                        <input 
                          type="number" 
                          value={editingProduct.drugLabel.every}
                          onChange={(e) => setEditingProduct({
                            ...editingProduct,
                            drugLabel: { ...editingProduct.drugLabel, every: parseInt(e.target.value) || 0 }
                          })}
                          className="w-16 px-2 py-1 border border-slate-100 rounded bg-slate-50/50 text-center font-bold" 
                        />
                        <span className="text-sm font-bold text-slate-800">ชั่วโมง</span>
                      </div>
                      <div 
                        onClick={() => setEditingProduct({
                          ...editingProduct,
                          drugLabel: { ...editingProduct.drugLabel, asNeeded: !editingProduct.drugLabel.asNeeded }
                        })}
                        className="flex items-center gap-3 cursor-pointer shrink-0"
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          editingProduct.drugLabel.asNeeded ? "border-[#00b4d8] bg-[#00b4d8]" : "border-slate-200 bg-white"
                        )}>
                          {editingProduct.drugLabel.asNeeded && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                        </div>
                        <span className={cn("text-sm font-bold", editingProduct.drugLabel.asNeeded ? "text-[#00b4d8]" : "text-slate-400")}>เมื่อมีอาการ</span>
                      </div>
                    </div>
                  </div>

                  {/* Warning Stickers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:ml-36">
                    {[
                      { label: 'ห้ามรับประทาน', key: 'noEat' },
                      { label: 'เก็บในตู้เย็น', key: 'fridge' },
                      { label: 'ยาอันตราย', key: 'danger' },
                      { label: 'เขย่าก่อนใช้', key: 'shake' }
                    ].map((item) => (
                      <div 
                        key={item.key}
                        onClick={() => setEditingProduct({
                          ...editingProduct,
                          drugLabel: {
                            ...editingProduct.drugLabel,
                            warnings: { ...editingProduct.drugLabel.warnings, [item.key]: !editingProduct.drugLabel.warnings[item.key] }
                          }
                        })}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          editingProduct.drugLabel.warnings[item.key] ? "border-red-500 bg-red-500" : "border-slate-200 bg-white"
                        )}>
                          {editingProduct.drugLabel.warnings[item.key] && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                        </div>
                        <span className={cn("text-sm font-bold", editingProduct.drugLabel.warnings[item.key] ? "text-red-500" : "text-slate-400")}>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Purpose & Additional info */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <p className="text-sm font-bold text-slate-700 w-32 shrink-0">วัตถุประสงค์</p>
                    <input 
                      type="text"
                      placeholder="ยาต้านการแข็งตัวของเลือด"
                      value={editingProduct.drugLabel.purpose}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        drugLabel: { ...editingProduct.drugLabel, purpose: e.target.value }
                      })}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <p className="text-sm font-bold text-slate-700 w-32 shrink-0">เพิ่มเติม</p>
                    <input 
                      type="text"
                      value={editingProduct.drugLabel.additional}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        drugLabel: { ...editingProduct.drugLabel, additional: e.target.value }
                      })}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 outline-none font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Purchase History & Order Frequency Section */}
          {(() => {
            const analytics = getPurchaseAnalytics(editingProduct?.purchaseHistory || []);
            const historyList = editingProduct?.purchaseHistory || [];

            return (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-50 rounded-xl text-[#00b4d8]">
                        <History className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-black text-slate-800">
                        ประวัติการรับซื้อ & วิเคราะห์ความถี่ในการสั่งซื้อ
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 pl-10">
                      บันทึกราคาต้นทุนที่รับซื้อยาล่าสุดและย้อนหลัง พร้อมวิเคราะห์แนวโน้มราคาและรอบความถี่ในการสั่งยา
                    </p>
                  </div>
                </div>

                {/* Summary Analytics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1: Latest Cost Price & Trend */}
                  <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-[#00b4d8]" />
                        ราคาต้นทุนล่าสุด
                      </span>
                      {analytics.trend === 'up' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{analytics.diffPercent.toFixed(1)}%
                        </span>
                      )}
                      {analytics.trend === 'down' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                          <TrendingDown className="w-3.5 h-3.5" />
                          {analytics.diffPercent.toFixed(1)}%
                        </span>
                      )}
                      {analytics.trend === 'same' && historyList.length > 0 && (
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          เท่าเดิม
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-800">
                        ฿{analytics.latestCost.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-slate-400">/ {editingProduct.unit || 'หน่วย'}</span>
                    </div>
                    {analytics.trend !== 'none' && historyList.length >= 2 && (
                      <p className="text-[11px] font-bold text-slate-500">
                        {analytics.diffAmount > 0 
                          ? `เพิ่มขึ้น ฿${analytics.diffAmount.toLocaleString()} จากครั้งก่อน (฿${analytics.prevCost.toLocaleString()})`
                          : analytics.diffAmount < 0 
                          ? `ลดลง ฿${Math.abs(analytics.diffAmount).toLocaleString()} จากครั้งก่อน (฿${analytics.prevCost.toLocaleString()})`
                          : `คงที่เท่ากับครั้งก่อน (฿${analytics.prevCost.toLocaleString()})`}
                      </p>
                    )}
                  </div>

                  {/* Card 2: Price Trend Status */}
                  <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100 space-y-2">
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-purple-500" />
                      วิเคราะห์แนวโน้มราคา
                    </div>
                    <div className="flex items-center gap-2">
                      {analytics.trend === 'up' && (
                        <span className="text-base font-black text-red-500 flex items-center gap-1">
                          🔴 แนวโน้มปรับตัวขึ้น
                        </span>
                      )}
                      {analytics.trend === 'down' && (
                        <span className="text-base font-black text-emerald-600 flex items-center gap-1">
                          🟢 แนวโน้มปรับตัวลง (ต้นทุนลด)
                        </span>
                      )}
                      {(analytics.trend === 'same' || analytics.trend === 'none') && (
                        <span className="text-base font-black text-slate-600">
                          ⚪ ราคาทรงตัว
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-slate-400">
                      {historyList.length > 0 
                        ? `อิงจากบันทึกรับซื้อย้อนหลัง ${historyList.length} รายการ`
                        : 'ยังไม่มีประวัติการบันทึกราคา'}
                    </p>
                  </div>

                  {/* Card 3: Order Frequency Analysis */}
                  <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100 space-y-2">
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-500" />
                      ความถี่ในการสั่งยา
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-800">
                        {analytics.avgDaysBetweenOrders > 0 
                          ? `ทุกๆ ${analytics.avgDaysBetweenOrders} วัน`
                          : analytics.totalOrders > 0 
                          ? 'สั่งซื้อ 1 ครั้ง' 
                          : '-'}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {analytics.totalOrders > 0 
                        ? `รับสั่งยาล่าสุดเมื่อ: ${analytics.lastOrderDate} (รวม ${analytics.totalOrders} สั่งซื้อ)`
                        : 'ยังไม่มีการสั่งซื้อ'}
                    </p>
                  </div>
                </div>

                {/* Form to Add New Purchase Record */}
                <div className="bg-white rounded-2xl p-6 border border-cyan-100 bg-cyan-50/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#00b4d8]" />
                      เพิ่มบันทึกราคารับซื้อยา (New Purchase Record)
                    </h4>
                    <span className="text-xs font-bold text-[#00b4d8]">
                      * บันทึกเพื่ออัปเดตประวัติและวิเคราะห์แนวโน้ม
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">วันที่รับซื้อ</label>
                      <input 
                        type="date"
                        value={newPurchaseDate}
                        onChange={(e) => setNewPurchaseDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00b4d8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">ราคาต้นทุนรับซื้อ/หน่วย (บาท)</label>
                      <input 
                        type="number"
                        placeholder="เช่น 150"
                        value={newPurchaseCost}
                        onChange={(e) => setNewPurchaseCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00b4d8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">จำนวนที่สั่ง/รับเข้า</label>
                      <input 
                        type="number"
                        placeholder="เช่น 100"
                        value={newPurchaseQty}
                        onChange={(e) => setNewPurchaseQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00b4d8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">บริษัท / ผู้จัดจำหน่าย</label>
                      <input 
                        type="text"
                        placeholder="เช่น บริษัท ยาไทย จำกัด"
                        value={newPurchaseSupplier}
                        onChange={(e) => setNewPurchaseSupplier(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00b4d8]"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={handleAddPurchaseRecord}
                        className="w-full py-2.5 bg-[#00b4d8] text-white rounded-xl font-bold text-xs hover:bg-[#0096b1] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cyan-100"
                      >
                        <Plus className="w-4 h-4" />
                        + บันทึกรับซื้อ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Purchase Records Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-800">
                      ตารางประวัติการรับซื้อย้อนหลัง ({historyList.length} รายการ)
                    </h4>
                    {historyList.length === 0 && (
                      <button 
                        onClick={() => {
                          const today = new Date();
                          const d1 = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                          const d2 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                          const d3 = today.toISOString().split('T')[0];
                          setEditingProduct({
                            ...editingProduct,
                            purchaseHistory: [
                              { id: 'sample-1', date: d1, costPrice: 120, quantity: 50, supplier: 'บริษัท สัตว์แพทย์จำกัด', note: 'ลอตเริ่มต้น' },
                              { id: 'sample-2', date: d2, costPrice: 125, quantity: 50, supplier: 'บริษัท สัตว์แพทย์จำกัด', note: 'ราคาขึ้นเล็กน้อย' },
                              { id: 'sample-3', date: d3, costPrice: 130, quantity: 100, supplier: 'บริษัท สัตว์แพทย์จำกัด', note: 'ลอตล่าสุด' }
                            ]
                          });
                        }}
                        className="text-xs font-bold text-[#00b4d8] hover:underline"
                      >
                        + ใส่ประวัติการสั่งซื้อตัวอย่าง
                      </button>
                    )}
                  </div>

                  {historyList.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-500">ยังไม่มีประวัติการรับซื้อยาสำหรับรายการนี้</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        กรอกข้อมูลในฟอร์มด้านบนเพื่อเพิ่มบันทึกราคารับซื้อแรก
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                          <tr>
                            <th className="p-3">วันที่รับซื้อ</th>
                            <th className="p-3">ราคาต้นทุน/หน่วย</th>
                            <th className="p-3">จำนวนที่รับเข้า</th>
                            <th className="p-3">บริษัทผู้จัดจำหน่าย</th>
                            <th className="p-3 text-center">แนวโน้มราคา</th>
                            <th className="p-3 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {[...historyList]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((rec: any, idx: number, arr: any[]) => {
                              const prevRec = arr[idx + 1];
                              let diffBadge = null;
                              if (prevRec) {
                                const diff = rec.costPrice - prevRec.costPrice;
                                if (diff > 0) {
                                  diffBadge = (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-600">
                                      <TrendingUp className="w-3 h-3" />
                                      +฿{diff}
                                    </span>
                                  );
                                } else if (diff < 0) {
                                  diffBadge = (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-600">
                                      <TrendingDown className="w-3 h-3" />
                                      -฿{Math.abs(diff)}
                                    </span>
                                  );
                                } else {
                                  diffBadge = (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                      เท่าเดิม
                                    </span>
                                  );
                                }
                              } else {
                                diffBadge = (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-500">
                                    ครั้งแรก
                                  </span>
                                );
                              }

                              return (
                                <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {rec.date}
                                  </td>
                                  <td className="p-3 font-black text-slate-800">
                                    ฿{Number(rec.costPrice).toLocaleString()}
                                  </td>
                                  <td className="p-3 font-bold text-slate-600">
                                    {rec.quantity} {editingProduct.unit || 'หน่วย'}
                                  </td>
                                  <td className="p-3 text-slate-600">
                                    {rec.supplier || '-'}
                                  </td>
                                  <td className="p-3 text-center">
                                    {diffBadge}
                                  </td>
                                  <td className="p-3 text-right">
                                    <button 
                                      onClick={() => handleDeletePurchaseRecord(rec.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                      title="ลบรายการ"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Success Toast */}
        <AnimatePresence>
          {toast.show && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-6 right-6 bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center gap-3 z-[200] border border-emerald-400 font-bold"
            >
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">PRODUCT SETTING</h1>
        <div className="flex items-center gap-4">
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".xlsx,.xls" 
            onChange={handleImportExcel} 
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 transition-all disabled:opacity-50"
          >
            {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Import Excel
          </button>
          <button 
            onClick={handleCreate}
            className="flex items-center gap-2 px-6 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
          >
            <Plus className="w-4 h-4" />
            Create New Product
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-8">
          <div className="flex-1 space-y-2">
            <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Search</p>
            <div className="flex items-center">
              <input 
                type="text"
                placeholder="Product Name, Barcode, Generic Name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 rounded-l-lg border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] focus:border-transparent outline-none text-sm font-medium"
              />
              <button className="px-4 py-2 bg-slate-50 border border-l-0 border-slate-200 rounded-r-lg hover:bg-slate-100 transition-colors">
                <Search className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
          <div className="w-72 space-y-2">
            <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Product Type</p>
            <div className="relative">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm outline-none appearance-none pr-10 font-medium cursor-pointer"
              >
                <option value="">ทั้งหมด (All Types)</option>
                {availableProductTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center w-20">No.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">Product Name</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Type</th>
                <th className="px-4 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">แก้ไขล่าสุด</th>
                <th className="px-4 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">ผู้แก้ไข</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-right pr-12">ราคา(บาท)</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-right pr-10 text-[#00b4d8]">QTY</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Is in Stock</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">
                  <div className="flex items-center justify-center gap-3">
                    <span>EDIT</span>
                    <button 
                      onClick={() => {
                        setIsDeleteAllOpen(true);
                        setDeleteAllPasscode('');
                        setDeleteAllError(false);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all shadow-2xs tracking-normal cursor-pointer"
                      title="ลบสินค้าทั้งหมด"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>ลบทั้งหมด</span>
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <RefreshCw className="w-6 h-6 text-[#00b4d8] animate-spin mx-auto mb-2" />
                    <p className="text-slate-400 font-bold">Loading Products...</p>
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? filteredProducts.map((product, index) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-center font-medium text-slate-500">{index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700 flex items-center gap-2 flex-wrap">
                      <span>{product.name}</span>
                      {(() => {
                        const expVal = product.expiryDate || (product.expiryDates && product.expiryDates.length > 0 ? product.expiryDates[0] : null);
                        const status = getExpiryStatus(expVal);
                        if (status?.isExpired) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-xs">
                              <AlertTriangle className="w-3 h-3" /> หมดอายุแล้ว
                            </span>
                          );
                        }
                        if (status?.isExpiringSoon) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-xs">
                              <Clock className="w-3 h-3" /> หมดอายุใน {status.daysRemaining} วัน
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-normal mt-0.5 flex-wrap">
                      {product.genericName && <span>{product.genericName}</span>}
                      {(() => {
                        const expVal = product.expiryDate || (product.expiryDates && product.expiryDates.length > 0 ? product.expiryDates[0] : null);
                        const formattedExp = formatExpiryDateDisplay(expVal);
                        if (!formattedExp) return null;
                        return (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                            <Calendar className="w-3 h-3 text-slate-400" /> Exp: {formattedExp}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-700 font-medium">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold">
                      {product.productType || product.type || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {(() => {
                      const formatted = formatLastModifiedDate(product.updatedAt || product.createdAt);
                      if (!formatted) {
                        return <span className="text-xs text-slate-400 font-medium">-</span>;
                      }
                      return (
                        <div className="flex flex-col items-center justify-center text-xs">
                          <span className="font-semibold text-slate-700 tabular-nums">{formatted.dateStr}</span>
                          <span className="text-[10px] text-slate-400 font-medium tabular-nums">{formatted.timeStr} น.</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50/70 text-[#007791] border border-cyan-100 rounded-full text-xs font-semibold max-w-[140px] mx-auto">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00b4d8] shrink-0" />
                      <span className="truncate" title={product.updatedBy || product.updatedByName || product.createdBy || 'Wasu Nganken'}>
                        {product.updatedBy || product.updatedByName || product.createdBy || 'Wasu Nganken'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right pr-12">
                    <div className="font-black text-slate-800 text-base tabular-nums">
                      {Number(product.price || product.costPrice || 0).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right pr-10">
                    <div className="flex flex-col items-end">
                      {(() => {
                        const activeUnit = product.stockUnit || getStockDisplayUnit(product);
                        const minUnit = product.minStockUnit || activeUnit;
                        return (
                          <>
                            <span className={cn(
                              "text-sm font-black tabular-nums flex items-center gap-1",
                              (product.currentStock || 0) <= (product.minStock || 0) ? "text-rose-500" : "text-[#00b4d8]"
                            )}>
                              {(product.currentStock || 0).toLocaleString()} 
                              {activeUnit && <span className="text-xs font-bold text-slate-500">({activeUnit})</span>}
                            </span>
                            {product.packageUnit && product.unit && product.packageUnit !== product.unit && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                (ขนาดบรรจุ: {product.packageUnit}/{product.unit})
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter tabular-nums">
                              Min: {(product.minStock || 0).toLocaleString()} {minUnit}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => toggleStock(product)}
                      className={cn(
                        "w-10 h-5 rounded-full transition-all relative mx-auto",
                        product.isInStock ? "bg-green-500" : "bg-slate-300"
                      )}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all shadow-sm",
                        product.isInStock ? "left-5.5" : "left-1"
                      )} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleEdit(product)}
                        className="flex items-center gap-1 px-4 py-1.5 bg-[#00b4d8] text-white rounded-lg text-xs font-bold hover:bg-[#0096b1] transition-all"
                      >
                        Edit 
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => {
                          setDeletingId(product.id);
                          setPasscode('');
                          setDeleteError(false);
                        }}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                   <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-slate-400 font-bold">No products found. Create or import your first product!</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isDeleteAllOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
              onClick={() => !isDeletingAll && setIsDeleteAllOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-rose-100"
            >
              <div className="p-8 space-y-6 text-center">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">ยืนยันการลบสินค้าทั้งหมด?</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    กรุณากรอกรหัสความปลอดภัยเพื่อยืนยันการลบสินค้าทั้งหมดในระบบ
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="password"
                      placeholder="Enter passcode"
                      value={deleteAllPasscode}
                      onChange={(e) => {
                        setDeleteAllPasscode(e.target.value);
                        setDeleteAllError(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleDeleteAll();
                      }}
                      className={cn(
                        "w-full pl-10 pr-4 py-3 rounded-xl border outline-none font-bold text-center tracking-[0.5em] transition-all",
                        deleteAllError ? "border-rose-300 ring-4 ring-rose-50" : "border-slate-200 focus:border-[#00b4d8]"
                      )}
                      autoFocus
                    />
                  </div>
                  {deleteAllError && (
                    <p className="text-rose-500 text-xs font-bold">รหัสความปลอดภัยไม่ถูกต้อง!</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setIsDeleteAllOpen(false)}
                    disabled={isDeletingAll}
                    className="py-3 px-4 bg-slate-50 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={handleDeleteAll}
                    disabled={isDeletingAll}
                    className="py-3 px-4 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isDeletingAll ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>กำลังลบ...</span>
                      </>
                    ) : (
                      <span>ยืนยันลบทั้งหมด</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
              onClick={() => setDeletingId(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6 text-center">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">ยืนยันการลบตัวยา?</h3>
                  <p className="text-slate-500 text-sm">
                    กรุณาใส่รหัสผ่าน 999 เพื่อยืนยันการลบข้อมูลถาวร
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="password"
                      placeholder="Enter passcode"
                      value={passcode}
                      onChange={(e) => {
                        setPasscode(e.target.value);
                        setDeleteError(false);
                      }}
                      className={cn(
                        "w-full pl-10 pr-4 py-3 rounded-xl border outline-none font-bold text-center tracking-[0.5em] transition-all",
                        deleteError ? "border-rose-300 ring-4 ring-rose-50" : "border-slate-100 focus:border-[#00b4d8]"
                      )}
                      autoFocus
                    />
                  </div>
                  {deleteError && (
                    <p className="text-rose-500 text-xs font-bold">Passcode ไม่ถูกต้อง!</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setDeletingId(null)}
                    className="py-3 px-4 bg-slate-50 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="py-3 px-4 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-100"
                  >
                    Delete Product
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {importSummary && importSummary.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setImportSummary(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Import Result</h3>
                  <p className="text-sm text-slate-400">สรุปการนำเข้าข้อมูล</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Total</p>
                    <p className="text-2xl font-bold text-slate-900">{importSummary.total}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl text-center border border-emerald-100">
                    <p className="text-xs text-emerald-400 font-bold uppercase mb-1">Success</p>
                    <p className="text-2xl font-bold text-emerald-600">{importSummary.success}</p>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-2xl text-center border border-rose-100">
                    <p className="text-xs text-rose-400 font-bold uppercase mb-1">Duplicate</p>
                    <p className="text-2xl font-bold text-rose-600">{importSummary.duplicates.length}</p>
                  </div>
                </div>

                {importSummary.duplicates.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">รายชื่อยาที่ซ้ำ (ไม่ถูกนำเข้า):</p>
                    <div className="max-h-32 overflow-y-auto bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <ul className="text-xs text-slate-400 space-y-1">
                        {importSummary.duplicates.map((name, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => setImportSummary(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showPriceConflictModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
              onClick={() => {
                setShowPriceConflictModal(false);
                setPendingImportItems(null);
                setPriceConflicts([]);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-amber-100"
            >
              <div className="p-8 space-y-6">
                <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto border border-amber-100 shadow-xs">
                  <AlertCircle className="w-7 h-7" />
                </div>

                <div className="space-y-2 text-center">
                  <h3 className="text-xl font-bold text-slate-900">พบสินค้าที่มีราคาขายเดิมในระบบ</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    พบสินค้าจำนวน <span className="font-bold text-amber-600">{priceConflicts.length} รายการ</span> ที่มีราคาขายเดิมในระบบ คุณต้องการทับซ้ำราคาเดิมด้วยราคาใหม่จาก Excel หรือไม่?
                  </p>
                </div>

                <div className="max-h-52 overflow-y-auto bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 divide-y divide-slate-100">
                  {priceConflicts.map((c) => (
                    <div key={c.key} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{c.name}</p>
                        <p className="text-slate-400">ราคาทุน: ฿{c.oldCostPrice} ➔ ฿{c.newCostPrice}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 line-through mr-2">฿{c.oldPrice}</span>
                        <span className="font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          ฿{c.newPrice}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  <button 
                    onClick={() => pendingImportItems && executeImport(pendingImportItems, true)}
                    className="w-full py-3.5 px-4 bg-[#00b4d8] text-white rounded-xl font-bold hover:bg-[#0096b1] transition-all shadow-md shadow-cyan-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ทับซ้ำราคาเดิมทั้งหมด (ใช้อัตราใหม่จาก Excel)</span>
                  </button>
                  <button 
                    onClick={() => pendingImportItems && executeImport(pendingImportItems, false)}
                    className="w-full py-3.5 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>คงราคาขายเดิมไว้ (ไม่ทับซ้ำราคา)</span>
                  </button>
                  <button 
                    onClick={() => {
                      setShowPriceConflictModal(false);
                      setPendingImportItems(null);
                      setPriceConflicts([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="w-full py-2 px-4 text-slate-400 hover:text-slate-600 font-medium text-xs text-center cursor-pointer"
                  >
                    ยกเลิกการนำเข้า
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center gap-3 z-[200] border border-emerald-400 font-bold"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
