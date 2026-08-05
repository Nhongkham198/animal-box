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
  Truck,
  Tag,
  Package,
  ShieldCheck,
  Store,
  Info
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
  Timestamp
} from '../firebase';

export interface PriceHistoryRecord {
  id: string;
  date: string;
  supplierName: string;
  costPrice: number;
  sellingPrice: number;
  qtyAdded?: number;
  note?: string;
  updatedBy?: string;
  changeType?: 'increase' | 'decrease' | 'initial' | 'no_change';
}

export interface FoodItem {
  id: string;
  name: string;
  genericName?: string;
  category: string; // e.g. อาหารเม็ด แมว, อาหารเปียก แมว, อาหารเม็ด สุนัข, อาหารเปียก สุนัข, นมแพะ
  activityGroup?: string;
  activitySubGroup?: string;
  petType?: string;
  unit: string; // e.g. ถุง, กระป๋อง, กล่อง
  packageUnit?: string; // e.g. 1.2kg/ถุง, 400g/ถุง
  currentStock: number;
  initialStock: number;
  minStock: number;
  isInStock: boolean;
  costPrice: number;
  price: number; // selling price
  unitPrice?: number;
  supplierName?: string;
  supplierContact?: string;
  barcode?: string;
  expiryDates?: string[];
  supplierPriceHistory?: PriceHistoryRecord[];
  note?: string;
  type?: string;
  isFood?: boolean;
  updatedAt?: any;
  createdAt?: any;
}

const FOOD_CATEGORIES = [
  'ALL',
  'อาหารเม็ด แมว',
  'อาหารเปียก แมว',
  'อาหารเม็ด สุนัข',
  'อาหารเปียก สุนัข',
  'นมแพะ',
  'ขนมและอาหารเสริม',
  'OTHER'
];

const FOOD_UNITS = ['ถุง', 'กระป๋อง', 'ซอง', 'กล่อง', 'ถาด', 'กิโลกรัม', 'กรัม', 'ชิ้น'];
const PET_TYPES = ['Cat', 'Dog', 'Exotic', 'All Pets'];

const getItemKey = (n: string, pkg?: string) => {
  const cleanN = (n || '').toLowerCase().trim();
  const cleanP = (pkg || '').toLowerCase().trim();
  return cleanP ? `${cleanN}___${cleanP}` : cleanN;
};

export default function FoodSetting() {
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [editingItem, setEditingItem] = useState<Partial<FoodItem> | null>(null);
  const [loading, setLoading] = useState(true);

  // Supplier & Price History State
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<FoodItem | null>(null);
  const [newPriceRecord, setNewPriceRecord] = useState({
    supplierName: '',
    costPrice: 0,
    sellingPrice: 0,
    qtyAdded: 0,
    note: ''
  });

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('ALL');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    success: number;
    duplicates: string[];
    show: boolean;
  } | null>(null);

  // Price Conflict Resolution Modal
  const [pendingImportItems, setPendingImportItems] = useState<Map<string, any> | null>(null);
  const [priceConflicts, setPriceConflicts] = useState<{
    key: string;
    name: string;
    supplier: string;
    oldPrice: number;
    newPrice: number;
    oldCostPrice: number;
    newCostPrice: number;
  }[]>([]);
  const [showPriceConflictModal, setShowPriceConflictModal] = useState(false);

  // Delete Passcode State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [deleteError, setDeleteError] = useState(false);

  // Delete All State
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteAllPasscode, setDeleteAllPasscode] = useState('');
  const [deleteAllError, setDeleteAllError] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

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

  // Sync with Firestore (inventory collection)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      const items = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as FoodItem[];

      // Filter for food items (or items in food categories/groups)
      const isFoodFilter = (i: FoodItem) => {
        if (i.isFood || i.type === 'food' || i.type === 'Food') return true;
        const cat = (i.category || '').toLowerCase();
        const group = (i.activityGroup || '').toLowerCase();
        const subGroup = (i.activitySubGroup || '').toLowerCase();
        return cat.includes('อาหาร') || group.includes('อาหาร') || subGroup.includes('อาหาร') ||
               cat.includes('นม') || group.includes('นม') || subGroup.includes('นม') ||
               cat.includes('food') || group.includes('food');
      };

      setFoodItems(items.filter(isFoodFilter));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Extract list of all unique suppliers
  const suppliersList = Array.from(new Set(
    foodItems.map(i => i.supplierName).filter(Boolean) as string[]
  ));

  // Filtered Food Items
  const filteredItems = foodItems.filter(i => {
    const matchesSearch = 
      (i.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.barcode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.supplierName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.category || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || i.category === selectedCategory || i.activitySubGroup === selectedCategory;
    const matchesSupplier = selectedSupplierFilter === 'ALL' || i.supplierName === selectedSupplierFilter;

    return matchesSearch && matchesCategory && matchesSupplier;
  });

  // Handle Save Food Item
  const handleSaveItem = async () => {
    if (!editingItem?.name?.trim()) {
      alert('กรุณากรอกชื่อรายการอาหารสัตว์');
      return;
    }

    try {
      const cost = Number(editingItem.costPrice) || 0;
      const selling = Number(editingItem.price) || 0;
      const stock = Number(editingItem.currentStock) || 0;
      const minStk = Number(editingItem.minStock) || 5;
      const supplier = editingItem.supplierName?.trim() || 'Unspecified Supplier';

      // Check if price history needs a new entry
      let history: PriceHistoryRecord[] = editingItem.supplierPriceHistory || [];

      if (!history.length || 
          history[0].costPrice !== cost || 
          history[0].sellingPrice !== selling || 
          history[0].supplierName !== supplier) {
        
        const changeType: 'increase' | 'decrease' | 'initial' = !history.length ? 'initial' :
          (cost > (history[0]?.costPrice || 0) ? 'increase' : 'decrease');

        const newHistoryRecord: PriceHistoryRecord = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          supplierName: supplier,
          costPrice: cost,
          sellingPrice: selling,
          qtyAdded: stock,
          note: editingItem.note || 'บันทึกการอัปเดตราคา / รายการใหม่',
          changeType
        };

        history = [newHistoryRecord, ...history];
      }

      const payload = {
        name: editingItem.name.trim(),
        genericName: editingItem.genericName || '',
        category: editingItem.category || 'อาหารสัตว์',
        type: 'food',
        isFood: true,
        activityGroup: editingItem.activityGroup || 'อาหารสัตว์',
        activitySubGroup: editingItem.category || 'อาหารสัตว์',
        petType: editingItem.petType || 'Cat',
        unit: editingItem.unit || 'ถุง',
        packageUnit: editingItem.packageUnit || '',
        currentStock: stock,
        initialStock: editingItem.initialStock ?? stock,
        minStock: minStk,
        isInStock: stock > 0,
        costPrice: cost,
        price: selling,
        unitPrice: selling,
        supplierName: supplier,
        supplierContact: editingItem.supplierContact || '',
        barcode: editingItem.barcode || '',
        expiryDates: editingItem.expiryDates || [],
        supplierPriceHistory: history,
        updatedAt: serverTimestamp()
      };

      if (editingItem.id) {
        // Update existing doc in inventory
        await updateDoc(doc(db, 'inventory', editingItem.id), payload);
      } else {
        // Create new doc in inventory
        await addDoc(collection(db, 'inventory'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }

      setMode('list');
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    }
  };

  // Add a new supplier price change record manually
  const handleAddPriceHistoryRecord = async () => {
    if (!selectedHistoryItem) return;
    if (!newPriceRecord.costPrice || !newPriceRecord.sellingPrice) {
      alert('กรุณาระบุราคาทุนและราคาขายให้ครบถ้วน');
      return;
    }

    try {
      const currentHist = selectedHistoryItem.supplierPriceHistory || [];
      const cost = Number(newPriceRecord.costPrice);
      const selling = Number(newPriceRecord.sellingPrice);
      const supplier = newPriceRecord.supplierName.trim() || selectedHistoryItem.supplierName || 'Unspecified Supplier';
      const prevCost = currentHist[0]?.costPrice || selectedHistoryItem.costPrice || 0;

      const record: PriceHistoryRecord = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        supplierName: supplier,
        costPrice: cost,
        sellingPrice: selling,
        qtyAdded: Number(newPriceRecord.qtyAdded) || 0,
        note: newPriceRecord.note || 'อัปเดตประวัติการซื้อขายจาก Supplier',
        changeType: cost > prevCost ? 'increase' : (cost < prevCost ? 'decrease' : 'no_change')
      };

      const updatedHistory = [record, ...currentHist];
      const newStock = selectedHistoryItem.currentStock + (Number(newPriceRecord.qtyAdded) || 0);

      await updateDoc(doc(db, 'inventory', selectedHistoryItem.id), {
        costPrice: cost,
        price: selling,
        unitPrice: selling,
        supplierName: supplier,
        currentStock: newStock,
        isInStock: newStock > 0,
        supplierPriceHistory: updatedHistory,
        updatedAt: serverTimestamp()
      });

      // Reset record form & update local view
      setSelectedHistoryItem({
        ...selectedHistoryItem,
        costPrice: cost,
        price: selling,
        supplierName: supplier,
        currentStock: newStock,
        supplierPriceHistory: updatedHistory
      });

      setNewPriceRecord({
        supplierName: '',
        costPrice: 0,
        sellingPrice: 0,
        qtyAdded: 0,
        note: ''
      });
      alert('บันทึกประวัติการเปลี่ยนแปลงราคา Supplier เรียบร้อยแล้ว');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${selectedHistoryItem.id}`);
    }
  };

  // Delete Single Item with Passcode
  const handleDeleteItem = async (id: string) => {
    if (passcode !== '198') {
      setDeleteError(true);
      return;
    }

    try {
      await deleteDoc(doc(db, 'inventory', id));
      setDeletingId(null);
      setPasscode('');
      setDeleteError(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  };

  // Delete All Food Items with Passcode
  const handleDeleteAllItems = async () => {
    if (deleteAllPasscode !== '198') {
      setDeleteAllError(true);
      return;
    }

    setIsDeletingAll(true);
    try {
      for (const item of foodItems) {
        await deleteDoc(doc(db, 'inventory', item.id));
      }
      setIsDeleteAllOpen(false);
      setDeleteAllPasscode('');
      setDeleteAllError(false);
      alert('ลบรายการอาหารสัตว์ทั้งหมดเรียบร้อยแล้ว');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'inventory');
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Handle Excel Import for Pet Food
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const importedItemsMap = new Map<string, any>();
        const conflicts: any[] = [];

        // Build existing lookup map
        const existingMap = new Map<string, FoodItem>();
        foodItems.forEach(item => {
          existingMap.set(getItemKey(item.name, item.packageUnit), item);
        });

        for (const sheetName of wb.SheetNames) {
          const sheetTabName = sheetName.trim();
          const ws = wb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          let currentSubGroup = sheetTabName;
          const rows = data.slice(1);

          for (const row of rows) {
            if (!row || !row.length) continue;

            const rawColA = String(row[0] || '').trim();
            const rawColB = String(row[1] || '').trim();
            const rawColC = row[2] !== undefined ? String(row[2]).trim() : '';
            const rawColD = row[3] !== undefined ? String(row[3]).trim() : '';
            const rawColE = row[4] !== undefined ? String(row[4]).trim() : '';
            const rawColF = row[5] !== undefined ? String(row[5]).trim() : '';

            // Section sub-header row check (e.g. "อาหารเม็ด แมว")
            if (rawColA && !rawColB && !rawColC && !rawColD && !rawColE) {
              currentSubGroup = rawColA;
              continue;
            }

            const name = rawColA;
            if (!name || name === 'รายการ' || name === 'ชื่อสินค้า') continue;

            const packaging = rawColB;

            let costPrice = 0;
            let sellingPrice = 0;
            let currentStock = 0;
            let expiryDate = '';

            // Detect if Col E is a date string (e.g. "8/4/2027") or Col F is empty while Col D is numeric (Stock)
            const isColEDate = rawColE.includes('/') || rawColE.includes('-') || !isNaN(Date.parse(rawColE));

            if (isColEDate || (!rawColF && rawColD !== '' && !isNaN(Number(rawColD)))) {
              // Food Excel format (Col C = Selling Price (ราคาขาย), Col D = Stock (จำนวนคงเหลือ), Col E = Expiry Date (วันหมดอายุ))
              sellingPrice = Number(rawColC) || 0;
              currentStock = Number(rawColD) || 0;
              expiryDate = rawColE;
              costPrice = Number(rawColF) || 0;
            } else {
              // Standard 6-column format (Col C = Cost Price, Col D = Selling Price, Col E = Stock, Col F = Expiry Date)
              costPrice = Number(rawColC) || 0;
              sellingPrice = Number(rawColD) || 0;
              currentStock = Number(rawColE) || 0;
              expiryDate = rawColF;
            }

            // Unit parsing
            let itemUnit = 'ถุง';
            if (packaging.includes('/')) {
              const parts = packaging.split('/');
              itemUnit = parts[parts.length - 1].trim() || 'ถุง';
            }

            const lookupKey = getItemKey(name, packaging);
            const existing = existingMap.get(lookupKey);

            const newItemData = {
              name,
              category: sheetTabName,
              activityGroup: 'อาหารสัตว์',
              activitySubGroup: currentSubGroup,
              type: 'food',
              isFood: true,
              packageUnit: packaging,
              unit: itemUnit,
              costPrice,
              price: sellingPrice,
              unitPrice: sellingPrice,
              currentStock,
              initialStock: currentStock,
              minStock: 5,
              isInStock: currentStock > 0,
              supplierName: 'Excel Import Supplier',
              expiryDates: expiryDate ? [expiryDate] : []
            };

            if (existing) {
              // Check price conflict
              if (existing.price !== sellingPrice || existing.costPrice !== costPrice) {
                conflicts.push({
                  key: lookupKey,
                  name,
                  supplier: existing.supplierName || 'Excel Import Supplier',
                  oldPrice: existing.price || 0,
                  newPrice: sellingPrice,
                  oldCostPrice: existing.costPrice || 0,
                  newCostPrice: costPrice
                });
              }
            }

            importedItemsMap.set(lookupKey, newItemData);
          }
        }

        if (conflicts.length > 0) {
          setPendingImportItems(importedItemsMap);
          setPriceConflicts(conflicts);
          setShowPriceConflictModal(true);
        } else {
          await processBatchImport(importedItemsMap, true);
        }
      } catch (err) {
        console.error('Excel Import Error:', err);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาตรวจสอบรูปแบบไฟล์');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  // Process Batch Import Execution
  const processBatchImport = async (itemsMap: Map<string, any>, updatePrices: boolean) => {
    let successCount = 0;
    const duplicates: string[] = [];

    const existingMap = new Map<string, FoodItem>();
    foodItems.forEach(item => {
      existingMap.set(getItemKey(item.name, item.packageUnit), item);
    });

    for (const [key, newItem] of itemsMap.entries()) {
      const existing = existingMap.get(key);

      if (existing) {
        duplicates.push(newItem.name);
        const newCost = updatePrices ? newItem.costPrice : existing.costPrice;
        const newSelling = updatePrices ? newItem.price : existing.price;

        let history = existing.supplierPriceHistory || [];
        if (updatePrices && (existing.costPrice !== newCost || existing.price !== newSelling)) {
          history = [{
            id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
            date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            supplierName: newItem.supplierName || 'Excel Import Supplier',
            costPrice: newCost,
            sellingPrice: newSelling,
            qtyAdded: newItem.currentStock,
            note: 'นำเข้าไฟล์ Excel สต็อกอาหารสัตว์ (ปรับราคา)',
            changeType: newCost > existing.costPrice ? 'increase' : 'decrease'
          }, ...history];
        }

        await updateDoc(doc(db, 'inventory', existing.id), {
          costPrice: newCost,
          price: newSelling,
          unitPrice: newSelling,
          currentStock: existing.currentStock + newItem.currentStock,
          isInStock: (existing.currentStock + newItem.currentStock) > 0,
          supplierPriceHistory: history,
          updatedAt: serverTimestamp()
        });
        successCount++;
      } else {
        const initialRecord: PriceHistoryRecord = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
          date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          supplierName: newItem.supplierName || 'Excel Import Supplier',
          costPrice: newItem.costPrice,
          sellingPrice: newItem.price,
          qtyAdded: newItem.currentStock,
          note: 'นำเข้าไฟล์ Excel สต็อกอาหารสัตว์ครั้งแรก',
          changeType: 'initial'
        };

        await addDoc(collection(db, 'inventory'), {
          ...newItem,
          supplierPriceHistory: [initialRecord],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        successCount++;
      }
    }

    setImportSummary({
      total: itemsMap.size,
      success: successCount,
      duplicates,
      show: true
    });

    setShowPriceConflictModal(false);
    setPendingImportItems(null);
    setPriceConflicts([]);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Mode Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">ตั้งค่า อาหารสัตว์ (Pet Food Management)</h1>
              <p className="text-xs text-slate-500 font-medium">จัดการรายการอาหารสัตว์ ประวัติราคาซื้อขายจากแต่ละ Supplier</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          {mode === 'list' ? (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleExcelImport} 
                accept=".xlsx,.xls" 
                className="hidden" 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-xs transition-all border border-emerald-100 cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isImporting ? 'กำลังอ่านไฟล์...' : 'นำเข้า Excel สต็อกอาหาร'}</span>
              </button>

              <button
                onClick={() => {
                  setEditingItem({
                    name: '',
                    category: 'อาหารเม็ด แมว',
                    petType: 'Cat',
                    unit: 'ถุง',
                    currentStock: 0,
                    minStock: 5,
                    costPrice: 0,
                    price: 0,
                    supplierName: '',
                    supplierPriceHistory: []
                  });
                  setMode('edit');
                }}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#00b4d8] text-white hover:bg-[#0096c7] font-bold text-xs transition-all shadow-md shadow-sky-100 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มรายการอาหารใหม่</span>
              </button>

              {foodItems.length > 0 && (
                <button
                  onClick={() => setIsDeleteAllOpen(true)}
                  className="p-3 rounded-2xl text-rose-500 bg-rose-50 hover:bg-rose-100 transition-all cursor-pointer border border-rose-100"
                  title="ลบรายการอาหารสัตว์ทั้งหมด"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                setMode('list');
                setEditingItem(null);
              }}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ย้อนกลับรายการ</span>
            </button>
          )}
        </div>
      </div>

      {mode === 'list' ? (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#00b4d8] flex items-center justify-center shrink-0 font-bold">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">รายการอาหารทั้งหมด</p>
                <p className="text-2xl font-black text-slate-900">{foodItems.length} <span className="text-xs text-slate-400 font-medium">รายการ</span></p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 font-bold">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">สต็อกเหลือน้อย (Low Stock)</p>
                <p className="text-2xl font-black text-rose-600">
                  {foodItems.filter(i => i.currentStock <= i.minStock).length} <span className="text-xs text-slate-400 font-medium">รายการ</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">จำนวน Supplier ที่บันทึก</p>
                <p className="text-2xl font-black text-slate-900">{suppliersList.length} <span className="text-xs text-slate-400 font-medium">บริษัท/ร้าน</span></p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 font-bold">
                <History className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">มีประวัติอัปเดตราคา</p>
                <p className="text-2xl font-black text-slate-900">
                  {foodItems.filter(i => (i.supplierPriceHistory?.length || 0) > 0).length} <span className="text-xs text-slate-400 font-medium">รายการ</span>
                </p>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่ออาหารสัตว์, บาร์โค้ด, Supplier, หรือประเภท..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#00b4d8] outline-none"
                />
              </div>

              {suppliersList.length > 0 && (
                <div className="w-full md:w-64 relative">
                  <select
                    value={selectedSupplierFilter}
                    onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none appearance-none"
                  >
                    <option value="ALL">Supplier ทั้งหมด ({suppliersList.length})</option>
                    {suppliersList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {FOOD_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border",
                    selectedCategory === cat 
                      ? "bg-[#00b4d8] text-white border-[#00b4d8] shadow-md shadow-sky-100" 
                      : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                  )}
                >
                  {cat === 'ALL' ? 'ทั้งหมด (All)' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Food Items Table / Grid */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400 font-medium">กำลังโหลดข้อมูลอาหารสัตว์...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Store className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-slate-500 font-bold">ไม่พบรายการอาหารสัตว์ในหมวดหมู่นี้</p>
                <p className="text-xs text-slate-400">กดปุ่ม "เพิ่มรายการอาหารใหม่" หรือ "นำเข้า Excel" ด้านบนเพื่อเริ่มต้น</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-4 px-6">รายการอาหารสัตว์ / บรรจุภัณฑ์</th>
                      <th className="py-4 px-6">หมวดหมู่ / สัตว์</th>
                      <th className="py-4 px-6">Supplier (ผู้จัดจำหน่าย)</th>
                      <th className="py-4 px-6 text-right">ราคาทุน (บาท)</th>
                      <th className="py-4 px-6 text-right">ราคาขาย (บาท)</th>
                      <th className="py-4 px-6 text-center">คงเหลือ (Stock)</th>
                      <th className="py-4 px-6 text-center">ประวัติราคา</th>
                      <th className="py-4 px-6 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-medium">
                    {filteredItems.map(item => {
                      const historyCount = item.supplierPriceHistory?.length || 0;
                      const latestHistory = item.supplierPriceHistory?.[0];

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6">
                            <div>
                              <p className="font-bold text-slate-900">{item.name}</p>
                              {item.packageUnit && (
                                <span className="inline-block px-2 py-0.5 mt-1 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-md">
                                  {item.packageUnit}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <div>
                              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl">
                                {item.category || item.activitySubGroup || 'อาหารสัตว์'}
                              </span>
                              {item.petType && (
                                <p className="text-[11px] text-slate-400 mt-1 font-semibold">{item.petType}</p>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                              <Truck className="w-3.5 h-3.5 text-slate-400" />
                              <span>{item.supplierName || 'ยังไม่ระบุ'}</span>
                            </div>
                          </td>

                          <td className="py-4 px-6 text-right font-bold text-slate-600">
                            ฿{(item.costPrice || 0).toLocaleString()}
                          </td>

                          <td className="py-4 px-6 text-right font-black text-emerald-600">
                            ฿{(item.price || 0).toLocaleString()}
                          </td>

                          <td className="py-4 px-6 text-center">
                            <span className={cn(
                              "px-3 py-1 rounded-xl text-xs font-bold inline-block",
                              item.currentStock <= item.minStock 
                                ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            )}>
                              {item.currentStock} {item.unit}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-center">
                            <button
                              onClick={() => setSelectedHistoryItem(item)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold transition-all border border-purple-100 cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>ประวัติ ({historyCount})</span>
                            </button>
                          </td>

                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setMode('edit');
                                }}
                                className="p-2 rounded-xl text-slate-400 hover:text-[#00b4d8] hover:bg-sky-50 transition-all cursor-pointer"
                                title="แก้ไข"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => {
                                  setDeletingId(item.id);
                                  setPasscode('');
                                  setDeleteError(false);
                                }}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                title="ลบ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Form View */
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm max-w-4xl mx-auto space-y-8">
          <div className="border-b border-slate-100 pb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingItem?.id ? 'แก้ไขรายการอาหารสัตว์' : 'เพิ่มรายการอาหารสัตว์ใหม่'}
              </h2>
              <p className="text-xs text-slate-400">กรอกรายละเอียดอาหารและระบุ Supplier ผู้จัดจำหน่าย</p>
            </div>
            <button
              onClick={() => {
                setMode('list');
                setEditingItem(null);
              }}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                ชื่อรายการอาหารสัตว์ (Trade Name) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="เช่น Royal Canin Renal Select, Me-O Gold Indoor"
                value={editingItem?.name || ''}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-medium text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                สูตร / รายละเอียดเพิ่มเติม (Formula)
              </label>
              <input
                type="text"
                placeholder="เช่น Renal, Gastrointestinal, Skin & Coat"
                value={editingItem?.genericName || ''}
                onChange={(e) => setEditingItem({ ...editingItem, genericName: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-medium text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                หมวดหมู่อาหาร (Category)
              </label>
              <select
                value={editingItem?.category || 'อาหารเม็ด แมว'}
                onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-medium text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
              >
                {FOOD_CATEGORIES.filter(c => c !== 'ALL').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                ขนาด/บรรจุภัณฑ์ (เช่น 1.2kg/ถุง, 400g/ถุง)
              </label>
              <input
                type="text"
                placeholder="เช่น 1.2kg/ถุง"
                value={editingItem?.packageUnit || ''}
                onChange={(e) => setEditingItem({ ...editingItem, packageUnit: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-medium text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                หน่วยนับหลัก (Unit)
              </label>
              <select
                value={editingItem?.unit || 'ถุง'}
                onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-medium text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
              >
                {FOOD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="md:col-span-2 p-5 bg-amber-50/60 border border-amber-100 rounded-3xl space-y-4">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>ข้อมูล Supplier & ประวัติการสั่งซื้อ/ปรับราคา</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    ชื่อ Supplier (ผู้จัดจำหน่าย)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น บริษัท Royal Canin ประเทศไทย, Supplier A"
                    value={editingItem?.supplierName || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, supplierName: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-medium text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    หมายเหตุ/บันทึกรอบสั่งซื้อ
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ปรับราคาทุนใหม่ประจำไตรมาส"
                    value={editingItem?.note || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, note: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-medium text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                ราคาทุน (บาท/หน่วย)
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={editingItem?.costPrice ?? ''}
                onChange={(e) => setEditingItem({ ...editingItem, costPrice: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                ราคาขาย (บาท/หน่วย)
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={editingItem?.price ?? ''}
                onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-emerald-600 focus:ring-2 focus:ring-[#00b4d8] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                จำนวนคงเหลือปัจจุบัน (Current Stock)
              </label>
              <input
                type="number"
                placeholder="0"
                value={editingItem?.currentStock ?? ''}
                onChange={(e) => setEditingItem({ ...editingItem, currentStock: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                จำนวนแจ้งเตือนสต็อกขั้นต่ำ (Min Stock)
              </label>
              <input
                type="number"
                placeholder="5"
                value={editingItem?.minStock ?? 5}
                onChange={(e) => setEditingItem({ ...editingItem, minStock: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-slate-800 focus:ring-2 focus:ring-[#00b4d8] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              onClick={() => {
                setMode('list');
                setEditingItem(null);
              }}
              className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              onClick={handleSaveItem}
              className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-[#00b4d8] text-white hover:bg-[#0096c7] font-bold text-xs transition-all shadow-md shadow-sky-100 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกรายการอาหาร</span>
            </button>
          </div>
        </div>
      )}

      {/* Supplier Price History Drawer/Modal */}
      <AnimatePresence>
        {selectedHistoryItem && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <History className="w-5 h-5 text-purple-600" />
                    <span>ประวัติราคาซื้อขาย Supplier</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedHistoryItem.name}</p>
                </div>
                <button
                  onClick={() => setSelectedHistoryItem(null)}
                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Add New Record Form inside History Modal */}
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-4">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#00b4d8]" />
                  <span>บันทึกการซื้อเพิ่ม / ปรับราคาทุนจาก Supplier</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อ Supplier</label>
                    <input
                      type="text"
                      placeholder={selectedHistoryItem.supplierName || 'ระบุชื่อ Supplier'}
                      value={newPriceRecord.supplierName}
                      onChange={(e) => setNewPriceRecord({ ...newPriceRecord, supplierName: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">จำนวนสั่งซื้อเพิ่ม ({selectedHistoryItem.unit})</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={newPriceRecord.qtyAdded || ''}
                      onChange={(e) => setNewPriceRecord({ ...newPriceRecord, qtyAdded: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ราคาทุนใหม่ (บาท)</label>
                    <input
                      type="number"
                      placeholder={String(selectedHistoryItem.costPrice || 0)}
                      value={newPriceRecord.costPrice || ''}
                      onChange={(e) => setNewPriceRecord({ ...newPriceRecord, costPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ราคาขายใหม่ (บาท)</label>
                    <input
                      type="number"
                      placeholder={String(selectedHistoryItem.price || 0)}
                      value={newPriceRecord.sellingPrice || ''}
                      onChange={(e) => setNewPriceRecord({ ...newPriceRecord, sellingPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-emerald-600 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">หมายเหตุการสั่งซื้อ</label>
                    <input
                      type="text"
                      placeholder="เช่น ใบส่งของเลขที่ IV-2026-08, ปรับราคาทุนขึ้นตามบริษัท"
                      value={newPriceRecord.note}
                      onChange={(e) => setNewPriceRecord({ ...newPriceRecord, note: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddPriceHistoryRecord}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  บันทึกประวัติการปรับราคา
                </button>
              </div>

              {/* History Records Timeline */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ประวัติย้อนหลังทั้งหมด</p>

                {(!selectedHistoryItem.supplierPriceHistory || selectedHistoryItem.supplierPriceHistory.length === 0) ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    ยังไม่มีประวัติการปรับราคา บันทึกรายการใหม่ด้านบน
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedHistoryItem.supplierPriceHistory.map((rec, idx) => (
                      <div key={rec.id || idx} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{rec.supplierName || 'Unspecified Supplier'}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{rec.date}</span>
                          </div>
                          {rec.note && <p className="text-xs text-slate-500">{rec.note}</p>}
                          {rec.qtyAdded ? (
                            <p className="text-[11px] font-bold text-sky-600">+ เพิ่มสต็อก {rec.qtyAdded} {selectedHistoryItem.unit}</p>
                          ) : null}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-center justify-end gap-1 font-bold text-xs">
                            <span className="text-slate-400 text-[10px]">ทุน:</span>
                            <span className="text-slate-700">฿{rec.costPrice}</span>
                            {rec.changeType === 'increase' && <TrendingUp className="w-3.5 h-3.5 text-rose-500" />}
                            {rec.changeType === 'decrease' && <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />}
                          </div>
                          <div className="text-xs font-black text-emerald-600">
                            <span className="text-slate-400 text-[10px] font-normal">ขาย: </span>
                            ฿{rec.sellingPrice}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Single Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 text-center"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">ยืนยันการลบรายการอาหารสัตว์</h3>
                <p className="text-xs text-slate-500 mt-1">กรุณากรอกรหัสผ่านเพื่อยืนยันการลบ</p>
              </div>

              <input
                type="password"
                placeholder="กรอกรหัสผ่าน"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setDeleteError(false);
                }}
                className={cn(
                  "w-full px-4 py-3 bg-slate-50 border rounded-2xl text-center text-lg font-bold tracking-widest outline-none",
                  deleteError ? "border-rose-500 bg-rose-50" : "border-slate-200 focus:ring-2 focus:ring-rose-500"
                )}
              />

              {deleteError && (
                <p className="text-xs text-rose-600 font-bold">รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง</p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setDeletingId(null);
                    setPasscode('');
                    setDeleteError(false);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleDeleteItem(deletingId)}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-rose-100 cursor-pointer"
                >
                  ยืนยันลบ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete All Modal */}
      <AnimatePresence>
        {isDeleteAllOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 text-center"
            >
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">ลบรายการอาหารสัตว์ทั้งหมด!</h3>
                <p className="text-xs text-slate-500 mt-1">การดำเนินการนี้จะไม่สามารถย้อนกลับได้ กรุณากรอกรหัสผ่านเพื่อยืนยัน</p>
              </div>

              <input
                type="password"
                placeholder="กรอกรหัสผ่าน"
                value={deleteAllPasscode}
                onChange={(e) => {
                  setDeleteAllPasscode(e.target.value);
                  setDeleteAllError(false);
                }}
                className={cn(
                  "w-full px-4 py-3 bg-slate-50 border rounded-2xl text-center text-lg font-bold tracking-widest outline-none",
                  deleteAllError ? "border-rose-500 bg-rose-50" : "border-slate-200 focus:ring-2 focus:ring-rose-500"
                )}
              />

              {deleteAllError && (
                <p className="text-xs text-rose-600 font-bold">รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง</p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsDeleteAllOpen(false);
                    setDeleteAllPasscode('');
                    setDeleteAllError(false);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleDeleteAllItems}
                  disabled={isDeletingAll}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-rose-100 cursor-pointer"
                >
                  {isDeletingAll ? 'กำลังลบ...' : 'ยืนยันลบทั้งหมด'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Price Conflict Resolution Modal */}
      <AnimatePresence>
        {showPriceConflictModal && pendingImportItems && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">พบการเปลี่ยนแปลงราคาอาหารสัตว์</h3>
                  <p className="text-xs text-slate-500">มีรายการอาหารที่มีราคาซื้อขายแตกต่างจากในระบบ</p>
                </div>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {priceConflicts.map(item => (
                  <div key={item.key} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <div className="flex justify-between text-slate-500">
                      <span>ทุนเดิม: ฿{item.oldCostPrice} ➔ ใหม่: ฿{item.newCostPrice}</span>
                      <span className="font-bold text-emerald-600">ขายเดิม: ฿{item.oldPrice} ➔ ใหม่: ฿{item.newPrice}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
                <button
                  onClick={() => processBatchImport(pendingImportItems, false)}
                  className="w-full sm:flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all cursor-pointer"
                >
                  คงราคาเดิมไว้ (นำเข้าเฉพาะสต็อก)
                </button>
                <button
                  onClick={() => processBatchImport(pendingImportItems, true)}
                  className="w-full sm:flex-1 py-3 bg-[#00b4d8] hover:bg-[#0096c7] text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-sky-100 cursor-pointer"
                >
                  อัปเดตราคาใหม่ทั้งหมด
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Summary Modal */}
      <AnimatePresence>
        {importSummary?.show && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 text-center"
            >
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">นำเข้าข้อมูลสำเร็จ</h3>
                <p className="text-xs text-slate-500 mt-1">
                  นำเข้าสำเร็จ {importSummary.success} จากทั้งหมด {importSummary.total} รายการ
                </p>
              </div>

              {importSummary.duplicates.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-2xl text-left text-xs space-y-1 max-h-36 overflow-y-auto">
                  <p className="font-bold text-amber-800">อัปเดตสต็อก/ราคาของรายการที่มีอยู่แล้ว ({importSummary.duplicates.length} รายการ):</p>
                  <p className="text-amber-700">{importSummary.duplicates.join(', ')}</p>
                </div>
              )}

              <button
                onClick={() => setImportSummary(null)}
                className="w-full py-3 bg-[#00b4d8] text-white font-bold text-xs rounded-2xl shadow-md shadow-sky-100 cursor-pointer"
              >
                ตกลง
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
