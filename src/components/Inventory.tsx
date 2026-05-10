import { useState, useEffect, FormEvent, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  db, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  Timestamp,
  handleFirestoreError,
  OperationType,
  writeBatch
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Search, 
  Package, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  MoreVertical, 
  Filter,
  XCircle,
  TrendingDown,
  ShoppingCart,
  FileSpreadsheet,
  CheckCircle2,
  Info,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface InventoryItem {
  id: string;
  name?: string;
  itemName?: string;
  type?: string;
  unit?: string;
  unitPrice?: number;
  initialStock?: number;
  currentStock?: number;
  minStock?: number;
  barcode?: string;
  category?: string;
  isInStock: boolean;
}

const STOCK_LEVELS = {
  EMPTY: { label: 'Out of Stock', color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
  LOW: { label: 'Low Stock', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
  NORMAL: { label: 'In Stock', color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' }
};

export default function Inventory() {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categories based on the requested screenshot
  const categories = ['All', 'Anti-parasite', 'Vaccine', 'Medicine', 'Supplies', 'Food', 'Other'];

  // Import Result State
  const [importSummary, setImportSummary] = useState<{
    total: number;
    success: number;
    duplicates: string[];
    show: boolean;
  } | null>(null);

  const [isImporting, setIsImporting] = useState(false);

  // Form state
  const [newItem, setNewItem] = useState({
    itemName: '',
    barcode: '',
    quantity: 0,
    unitPrice: 0,
    minStock: 10,
    category: 'Medicine'
  });

  // Sync with Firestore
  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) {
      if (isAuthReady && !isStaff) setLoading(false);
      return;
    }

    const q = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const inv = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setItems(inv);
      setLoading(false);
    }, (err) => {
      console.warn("Inventory listener:", err);
      handleFirestoreError(err, OperationType.LIST, 'inventory');
    });
    return () => unsubscribe();
  }, [isAuthReady, user, isStaff]);

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'inventory'), {
        name: newItem.itemName,
        itemName: newItem.itemName,
        barcode: newItem.barcode,
        currentStock: newItem.quantity,
        initialStock: newItem.quantity,
        unitPrice: newItem.unitPrice,
        minStock: newItem.minStock,
        type: newItem.category,
        category: newItem.category,
        isInStock: true,
        createdAt: Timestamp.now()
      }).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, 'inventory');
      });
      setIsModalOpen(false);
      setNewItem({
        itemName: '',
        barcode: '',
        quantity: 0,
        unitPrice: 0,
        minStock: 10,
        category: 'Medicine'
      });
    } catch (error) {
      console.error("Error adding item:", error);
      throwError(error);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    const current = item.currentStock || 0;
    const min = item.minStock || 0;
    if (current === 0 || item.isInStock === false) return STOCK_LEVELS.EMPTY;
    if (current <= min) return STOCK_LEVELS.LOW;
    return STOCK_LEVELS.NORMAL;
  };

  const filteredItems = items.filter(i => {
    const matchesSearch = (i.name || i.itemName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (i.barcode && i.barcode.includes(searchQuery));
    const matchesCategory = activeCategory === 'All' || 
                           (i.type || i.category) === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockCount = items.filter(i => (i.currentStock || 0) <= (i.minStock || 0)).length;
  const totalValue = items.reduce((acc, item) => acc + ((item.currentStock || 0) * (item.unitPrice || 0)), 0);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        let totalItems = 0;
        let successCount = 0;
        const duplicateNames: string[] = [];

        // Categories mapping based on sheets provided by user
        const sheetMappings: Record<string, string> = {
          'ยาฉีด': 'Injectable Medicine',
          'ยากิน': 'Oral Medicine',
          'ใช้ในหู': 'Ear Care',
          'ใช้กับตา': 'Eye Care',
          'Testkit': 'Diagnostics'
        };

        // We'll process all sheets
        for (const sheetName of wb.SheetNames) {
          const category = sheetMappings[sheetName] || 'General';
          const ws = wb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          // Skip header row (index 0)
          const rows = data.slice(1);
          
          for (const row of rows) {
            // Mapping based on image structure:
            // Col A (index 0): Name
            // Col B (index 1): Unit info (e.g. 2 ml/ขวด)
            // Col C (index 2): Price
            const name = String(row[0] || '').trim();
            const unitInfo = String(row[1] || '').trim();
            const price = Number(row[2]) || 0;

            if (!name) continue; // Skip empty rows

            totalItems++;
            const fullItemName = unitInfo ? `${name} (${unitInfo})` : name;

            // Check for duplicate in local state (which is synced with DB)
            const isDuplicate = items.some(
              i => i.itemName.toLowerCase() === fullItemName.toLowerCase() && i.category === category
            );

            if (isDuplicate) {
              duplicateNames.push(fullItemName);
              continue;
            }

            // Not a duplicate -> Add to DB
            try {
              await addDoc(collection(db, 'inventory'), {
                name: fullItemName,
                itemName: fullItemName,
                category: category,
                type: category,
                unitPrice: price,
                currentStock: 0,
                initialStock: 0,
                quantity: 0,
                minStock: 10,
                isInStock: true,
                createdAt: Timestamp.now()
              });
              successCount++;
            } catch (err) {
              console.error("Error importing row:", name, err);
            }
          }
        }

        setImportSummary({
          total: totalItems,
          success: successCount,
          duplicates: duplicateNames,
          show: true
        });

      } catch (err) {
        console.error("Excel processing error:", err);
        alert("เกิดข้อผิดพลาดในการอ่านไฟล์ Excel");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="h-full flex flex-col gap-8 pb-10">
      {/* Header & Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-[#00b4d8]/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-[#00b4d8]/10 rounded-2xl flex items-center justify-center text-[#00b4d8]">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-1 rounded-lg font-black uppercase tracking-widest">Total</span>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 leading-none">{items.length}</p>
            <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-tight">Active Inventory Items</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-amber-200 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            {lowStockCount > 0 && <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />}
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 leading-none">{lowStockCount}</p>
            <p className="text-xs font-bold text-amber-500 mt-2 uppercase tracking-tight">Requires Attention (Low)</p>
          </div>
        </div>

        <div className="md:col-span-2 bg-[#00b4d8] p-8 rounded-[2.5rem] text-white shadow-2xl shadow-[#00b4d8]/20 flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/20">
              <ShoppingCart className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-black uppercase tracking-widest mb-1">Total Inventory Value</p>
              <p className="text-4xl font-black tabular-nums">฿{totalValue.toLocaleString()}</p>
              <p className="text-white/50 text-[10px] font-bold mt-1 uppercase tracking-tighter">*Calculated from Current Stock x Unit Price</p>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-10">
            <Package className="w-48 h-48" />
          </div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl w-full lg:w-fit overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeCategory === cat 
                  ? "bg-white text-[#00b4d8] shadow-sm" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200 flex items-center gap-3 w-full lg:w-80 group focus-within:border-[#00b4d8] transition-all">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Name or Barcode..." 
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 w-full placeholder:text-slate-300"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            onChange={handleImportExcel}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 px-6 py-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600 font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition-all shadow-sm disabled:opacity-50"
          >
            {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Import
          </button>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200"
          >
            <Plus className="w-4 h-4" />
            New Item
          </button>
        </div>
      </div>

      {/* Main Inventory Layout */}
      <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-8 border-b border-slate-100 grid grid-cols-12 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/50">
          <div className="col-span-4">Item Identification</div>
          <div className="col-span-2 text-center">Price / Unit</div>
          <div className="col-span-4 px-10 text-center">Stock Overview (Initial vs Current)</div>
          <div className="col-span-2 text-right">Status</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <RefreshCw className="w-8 h-8 text-[#00b4d8] animate-spin" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Synchronizing Stocks...</p>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {filteredItems.map((item) => {
                const status = getStockStatus(item);
                const progress = Math.min(100, Math.max(0, ((item.currentStock || 0) / (item.initialStock || 1)) * 100));
                
                return (
                  <div key={item.id} className="p-8 grid grid-cols-12 items-center hover:bg-slate-50/20 transition-all group">
                    <div className="col-span-4 flex items-center gap-5">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner relative transition-transform group-hover:scale-105",
                        status.bg, status.color
                      )}>
                        <Package className="w-6 h-6" />
                        {item.currentStock === 0 && <XCircle className="w-4 h-4 absolute -top-1 -right-1 fill-white" />}
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-800 leading-tight mb-1">{item.name || item.itemName}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                            {item.type || item.category || 'General'}
                          </span>
                          {item.barcode && (
                            <span className="text-[10px] font-mono text-slate-300">#{item.barcode}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 text-center">
                      <p className="text-xl font-black text-slate-700 tabular-nums">฿{(item.unitPrice || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">per {item.unit || 'unit'}</p>
                    </div>

                    <div className="col-span-4 px-10">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-tight">
                          <div className="flex flex-col">
                            <span className="text-slate-400">Current QTY</span>
                            <span className={cn("text-lg", status.color)}>{(item.currentStock || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-slate-300">Initial Stock</span>
                            <span className="text-lg text-slate-900/40">{(item.initialStock || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner flex">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              status.color.replace('text-', 'bg-')
                            )}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-300">
                          <span>0%</span>
                          <span className="text-slate-400">Target Range: {(item.minStock || 0)}+</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 text-right">
                      <div className={cn(
                        "inline-flex flex-col items-end px-4 py-3 rounded-2xl border transition-all",
                        status.bg, status.border, status.color
                      )} title={item.currentStock === 0 ? "Out of Stock" : "Current Status"}>
                        <span className="text-[10px] font-black uppercase tracking-[0.1em] leading-none mb-1">{status.label}</span>
                        <div className="flex items-center gap-2">
                          {(item.currentStock || 0) <= (item.minStock || 0) && <AlertTriangle className="w-3 h-3 animate-pulse" />}
                          <span className="text-xs font-bold whitespace-nowrap">
                            {item.currentStock === 0 ? 'PLEASE RESTOCK' : `${progress.toFixed(0)}% Utilized`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-32 flex flex-col items-center justify-center text-center px-10">
              <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6">
                <Package className="w-12 h-12 text-slate-200" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Inventory Empty</h3>
              <p className="text-slate-400 max-w-sm font-medium">ไม่พบรายการครุภัณฑ์ยาหรืออุปกณ์ที่คุณค้นหา กรุณาเพิ่มรายการใหม่หรือตรวจสอบคำค้นหา</p>
            </div>
          )}
        </div>
      </div>

      {/* New Item Modal */}
      <AnimatePresence>
        {importSummary && importSummary.show && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setImportSummary(prev => prev ? {...prev, show: false} : null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Import Summary</h3>
                  <p className="text-white/70 text-sm font-medium">สรุปผลการนำเข้าข้อมูลครุภัณฑ์ยาจาก Excel</p>
                </div>
                <button 
                  onClick={() => setImportSummary(prev => prev ? {...prev, show: false} : null)}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Found in File</p>
                    <p className="text-3xl font-black text-slate-900">{importSummary.total}</p>
                  </div>
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex flex-col items-center">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Success</p>
                    <p className="text-3xl font-black text-emerald-600">{importSummary.success}</p>
                  </div>
                  <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 flex flex-col items-center">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Duplicates</p>
                    <p className="text-3xl font-black text-rose-600">{importSummary.duplicates.length}</p>
                  </div>
                </div>

                {importSummary.duplicates.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-rose-600">
                      <AlertTriangle className="w-5 h-5" />
                      <h4 className="font-black uppercase tracking-tight text-sm">รายการที่ซ้ำ (ข้ามการนำเข้า)</h4>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto bg-slate-50 rounded-2xl p-4 border border-slate-200 divide-y divide-slate-200">
                      {importSummary.duplicates.map((name, idx) => (
                        <div key={idx} className="py-3 flex items-center justify-between group">
                          <span className="text-sm font-bold text-slate-600">{name}</span>
                          <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-1 rounded-lg font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-all">Skipped</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => setImportSummary(prev => prev ? {...prev, show: false} : null)}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  เสร็จสิ้น
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Add Inventory Item</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleAddItem} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Item Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Rabies Vaccine"
                      className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 font-bold"
                      value={newItem.itemName}
                      onChange={e => setNewItem({...newItem, itemName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Barcode (Scan here)</label>
                    <input 
                      type="text" 
                      placeholder="Scan or type barcode..."
                      className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={newItem.barcode}
                      onChange={e => setNewItem({...newItem, barcode: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category</label>
                    <select 
                      className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-500"
                      value={newItem.category}
                      onChange={e => setNewItem({...newItem, category: e.target.value})}
                    >
                      <option>Medicine</option>
                      <option>Supplies</option>
                      <option>Food</option>
                      <option>Equipment</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Unit Price (฿)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-500"
                      value={newItem.unitPrice}
                      onChange={e => setNewItem({...newItem, unitPrice: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Initial Quantity</label>
                    <input 
                      required
                      type="number" 
                      className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-500"
                      value={newItem.quantity}
                      onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Min Stock Alert</label>
                    <input 
                      required
                      type="number" 
                      className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-500"
                      value={newItem.minStock}
                      onChange={e => setNewItem({...newItem, minStock: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-100"
                >
                  Add to Inventory
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
