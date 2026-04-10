import { useState, useEffect, FormEvent } from 'react';
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
  OperationType
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
  ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface InventoryItem {
  id: string;
  itemName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  minStock: number;
  category?: string;
}

export default function Inventory() {
  const throwError = useAsyncError();
  const { user, isAuthReady } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Form state
  const [newItem, setNewItem] = useState({
    itemName: '',
    barcode: '',
    quantity: 0,
    unitPrice: 0,
    minStock: 10,
    category: 'Medicine'
  });

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'inventory'), orderBy('itemName', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const inv = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setItems(inv);
      setLoading(false);
    }, (err) => {
      console.error("Inventory listener error:", err);
    });
    return () => unsubscribe();
  }, [isAuthReady, user]);

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'inventory'), {
        ...newItem,
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

  const updateQuantity = async (id: string, delta: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    try {
      await updateDoc(doc(db, 'inventory', id), {
        quantity: Math.max(0, item.quantity + delta)
      }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `inventory/${id}`);
      });
    } catch (error) {
      console.error("Error updating quantity:", error);
      throwError(error);
    }
  };

  const filteredItems = items.filter(i => 
    i.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.barcode && i.barcode.includes(searchQuery))
  );

  const lowStockCount = items.filter(i => i.quantity <= i.minStock).length;

  return (
    <div className="h-full flex flex-col gap-8">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Items</p>
            <p className="text-2xl font-bold text-slate-900">{items.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Low Stock</p>
            <p className="text-2xl font-bold text-slate-900">{lowStockCount}</p>
          </div>
        </div>
        <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-60">Inventory Value</p>
              <p className="text-2xl font-bold">฿124,500</p>
            </div>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-white text-indigo-600 p-2 rounded-xl hover:bg-indigo-50 transition-all">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="bg-white p-2 rounded-2xl border border-slate-200 flex items-center gap-2 w-80">
          <Search className="w-4 h-4 text-slate-400 ml-2" />
          <input 
            type="text" 
            placeholder="Search inventory..." 
            className="bg-transparent border-none focus:ring-0 text-sm w-full"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
            <Filter className="w-4 h-4" />
            Category
          </button>
        </div>
      </div>

      {/* Inventory List */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 grid grid-cols-12 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <div className="col-span-3">Item Name</div>
          <div className="col-span-2">Barcode</div>
          <div className="col-span-1">Category</div>
          <div className="col-span-2 text-center">Stock Level</div>
          <div className="col-span-2 text-right">Unit Price</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-20 text-center text-slate-400">Loading inventory...</div>
          ) : filteredItems.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {filteredItems.map((item) => (
                <div key={item.id} className="p-6 grid grid-cols-12 items-center hover:bg-slate-50/50 transition-all group">
                  <div className="col-span-3 flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                      item.quantity <= item.minStock ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-600"
                    )}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{item.itemName}</p>
                      {item.quantity <= item.minStock && (
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Low Stock
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs font-mono text-slate-400">
                      {item.barcode || '-'}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                      {item.category || 'General'}
                    </span>
                  </div>
                  <div className="col-span-2 flex flex-col items-center gap-2">
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          item.quantity <= item.minStock ? "bg-amber-500" : "bg-indigo-500"
                        )}
                        style={{ width: `${Math.min(100, (item.quantity / (item.minStock * 2)) * 100)}%` }}
                      />
                    </div>
                    <p className="text-sm font-bold text-slate-900">{item.quantity} units</p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="font-bold text-slate-900">฿{item.unitPrice.toLocaleString()}</p>
                  </div>
                  <div className="col-span-2 text-right flex items-center justify-end gap-2">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                    >
                      <ArrowDownRight className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-500 transition-all"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <img 
                src="https://illustrations.popsy.co/amber/box.svg" 
                alt="No Items"
                className="w-48 h-48 opacity-40 mb-4"
                referrerPolicy="no-referrer"
              />
              <p className="text-slate-500 font-medium">No items in inventory</p>
              <p className="text-sm text-slate-400">Add medicines or supplies to track stock levels.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Item Modal */}
      <AnimatePresence>
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
