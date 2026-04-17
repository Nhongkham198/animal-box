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
  PawPrint
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
}

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
    const opdQ = query(
      collection(db, 'opd_records'), 
      where('patientId', 'in', pets.map(p => p.id)),
      where('billingStatus', '==', 'unpaid')
    );
    const opdSnap = await getDocs(opdQ);
    const pendingItems: CartItem[] = [];
    opdSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.items) {
        data.items.forEach((item: any, idx: number) => {
          pendingItems.push({ 
            ...item, 
            id: `opd-${doc.id}-${item.id || idx}`,
            petName: data.petName,
            sourceRecordId: doc.id,
            sourceType: 'opd'
          });
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
        name: item.itemName,
        price: item.unitPrice,
        quantity: 1,
        category: item.category || 'Product'
      });
      setSearchQuery(''); // Clear search after successful scan
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    
    // Check if it's a barcode (usually longer and numeric, but let's just check if it matches any item)
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

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    try {
      // 1. Record the sale
      await addDoc(collection(db, 'sales'), {
        ownerId: selectedOwner?.phone,
        ownerName: selectedOwner?.name,
        items: cart,
        total,
        paymentMethod,
        patientIds: ownerPets.map(p => p.id),
        createdAt: serverTimestamp()
      });

      // 2. Mark source records as paid
      const sourceOpdIds = Array.from(new Set(cart.filter(i => (i as any).sourceType === 'opd').map(i => (i as any).sourceRecordId)));
      await Promise.all(sourceOpdIds.map(id => 
        updateDoc(doc(db, 'opd_records', id as string), { billingStatus: 'paid' })
      ));

      // 3. Deduct Inventory
      const inventoryUpdates = cart.filter(i => (i as any).sourceType !== 'opd'); // Only deduct if added from inventory directly or quick add
      // Actually, we should check if the item exists in inventory
      for (const item of cart) {
        const invItem = inventory.find(i => i.itemName === item.name || i.barcode === item.id);
        if (invItem) {
          await updateDoc(doc(db, 'inventory', invItem.id), {
            quantity: Math.max(0, invItem.quantity - item.quantity)
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

  return (
    <div className="h-full flex gap-8">
      {/* Left: Product/Service Selection */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Consolidated Billing</h2>
            <div className="relative w-96">
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
                p.ownerPhone?.includes(searchQuery) || 
                p.name?.toLowerCase().includes(searchQuery.toLowerCase())
              ).slice(0, 4).map(p => (
                <button 
                  key={p.id}
                  onClick={() => handleSelectOwner(p.ownerPhone)}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-[#00b4d8] hover:bg-cyan-50 transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#00b4d8]/10 flex items-center justify-center text-[#00b4d8]">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{p.ownerName}</p>
                    <p className="text-xs text-slate-400">{p.ownerPhone}</p>
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
                    <p className="text-xs font-bold text-[#00b4d8] uppercase tracking-widest">{selectedOwner.phone}</p>
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

        {/* Quick Add Items */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: 'General Consultation', price: 500, category: 'Service' },
            { name: 'Grooming (Small)', price: 350, category: 'Grooming' },
            { name: 'Rabies Vaccine', price: 250, category: 'Vaccine' },
            { name: 'Heartworm Med', price: 180, category: 'Medicine' },
            { name: 'Pet Food (Premium)', price: 850, category: 'Product' },
            { name: 'Emergency Fee', price: 1000, category: 'Service' },
          ].map((item, idx) => (
            <button 
              key={`quick-add-${item.name}-${idx}`}
              onClick={() => addToCart({ ...item, id: '', quantity: 1 })}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-[#00b4d8] transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#00b4d8] group-hover:text-white transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{item.category}</span>
              </div>
              <p className="font-bold text-slate-800 mb-1">{item.name}</p>
              <p className="text-lg font-black text-[#00b4d8]">{item.price.toLocaleString()} ฿</p>
            </button>
          ))}
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
              <div key={item.id || `cart-${item.name}-${idx}`} className="flex items-center justify-between group bg-slate-50/50 p-3 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-white transition-all">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">{item.name}</p>
                    {(item as any).petName && (
                      <span className="text-[10px] bg-cyan-100 text-[#00b4d8] px-1.5 py-0.5 rounded-md font-black uppercase">{(item as any).petName}</span>
                    )}
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.quantity} x {item.price.toLocaleString()} ฿</p>
                </div>
                <div className="flex items-center gap-4">
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
              <span>{total.toLocaleString()} ฿</span>
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
