import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Settings, Package, Calendar, Clock, X, PawPrint } from 'lucide-react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where,
  limit,
  orderBy,
  getDocs,
  handleFirestoreError,
  OperationType
} from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  activeView: string;
  setActiveView: (view: any) => void;
}

interface Notification {
  id: string;
  type: 'booking' | 'stock';
  title: string;
  message: string;
  time: any;
  status?: string;
}

export default function Header({ activeView, setActiveView }: HeaderProps) {
  const { isAuthReady, isStaff } = useAuth();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<{patients: any[], inventory: any[]}>({ patients: [], inventory: [] });
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleGlobalSearch = async (val: string) => {
    setGlobalSearchQuery(val);
    if (val.length < 2) {
      setGlobalSearchResults({ patients: [], inventory: [] });
      setShowSearchResults(false);
      return;
    }

    setIsGlobalSearching(true);
    setShowSearchResults(true);
    try {
      // Parallel queries for all 3 concepts: Patient/HN, Owner/Phone, Medicine
      const [
        patientNameSnap, 
        patientHnSnap, 
        ownerNameSnap, 
        ownerPhoneSnap, 
        inventorySnap
      ] = await Promise.all([
        getDocs(query(collection(db, 'patients'), where('name', '>=', val), where('name', '<=', val + '\uf8ff'), limit(5))),
        getDocs(query(collection(db, 'patients'), where('hn', '>=', val), where('hn', '<=', val + '\uf8ff'), limit(5))),
        getDocs(query(collection(db, 'owners'), where('name', '>=', val), where('name', '<=', val + '\uf8ff'), limit(5))),
        getDocs(query(collection(db, 'owners'), where('phone', '>=', val), where('phone', '<=', val + '\uf8ff'), limit(5))),
        getDocs(query(collection(db, 'inventory'), where('itemName', '>=', val), where('itemName', '<=', val + '\uf8ff'), limit(5)))
      ]);

      // Merge patient results (from name and HN search)
      const patientsMap = new Map();
      [...patientNameSnap.docs, ...patientHnSnap.docs].forEach(doc => {
        patientsMap.set(doc.id, { id: doc.id, ...doc.data() });
      });

      // Owners found by name/phone
      const ownersFoundMap = new Map();
      [...ownerNameSnap.docs, ...ownerPhoneSnap.docs].forEach(doc => {
        ownersFoundMap.set(doc.id, { id: doc.id, ...doc.data() });
      });

      // For owners found, try to find their pets if they aren't already in patientsMap
      const ownersFoundIds = Array.from(ownersFoundMap.keys());
      if (ownersFoundIds.length > 0) {
        const petsOfOwnersSnap = await getDocs(query(
          collection(db, 'patients'),
          where('ownerIds', 'array-contains-any', ownersFoundIds.slice(0, 10))
        ));
        petsOfOwnersSnap.forEach(doc => {
          if (!patientsMap.has(doc.id)) {
            patientsMap.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
      }

      const patients = Array.from(patientsMap.values());
      
      // Fetch owners for display for all found patients (to show "HN: 123 • Owner Name")
      const ownerIdsNeeded = Array.from(new Set(patients.flatMap(p => p.ownerIds || [])));
      const finalOwnersMap: Record<string, string> = {};
      
      if (ownerIdsNeeded.length > 0) {
        try {
          const ownersSnap = await getDocs(query(
            collection(db, 'owners'),
            where('__name__', 'in', ownerIdsNeeded.slice(0, 10))
          ));
          ownersSnap.forEach(doc => {
            finalOwnersMap[doc.id] = doc.data().name;
          });
        } catch (ownerErr) {
          console.error("Error fetching owners for search display:", ownerErr);
        }
      }

      setGlobalSearchResults({
        patients: patients.map(p => ({
          ...p,
          displayOwnerName: p.ownerIds && p.ownerIds.length > 0 ? finalOwnersMap[p.ownerIds[0]] : 'No owner'
        })),
        inventory: inventorySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      });
    } catch (err) {
      console.error("Global search error:", err);
    } finally {
      setIsGlobalSearching(false);
    }
  };

  useEffect(() => {
    if (!isAuthReady || !isStaff) return;

    // Listen for New Booking Requests (Pending)
    const bookingQuery = query(
      collection(db, 'public_bookings'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribeBookings = onSnapshot(bookingQuery, (snap) => {
      const bookingNotifications: Notification[] = snap.docs.map(doc => ({
        id: doc.id,
        type: 'booking',
        title: 'New Booking Request',
        message: `จากคุณ ${doc.data().ownerName} (${doc.data().petName})`,
        time: doc.data().createdAt,
        status: doc.data().status
      }));

      updateNotifications(bookingNotifications, 'booking');
    }, (error) => {
      console.warn("Permission restricted for bookings listener (non-critical):", error.message);
      // Don't throw to global ErrorBoundary for background notification listeners
    });

    // Listen for Low Stock Items
    const stockQuery = query(
      collection(db, 'inventory'),
      limit(20)
    );

    const unsubscribeStock = onSnapshot(stockQuery, (snap) => {
      const stockNotifications: Notification[] = snap.docs
        .filter(doc => doc.data().quantity <= (doc.data().minStock || 0))
        .map(doc => ({
          id: doc.id,
          type: 'stock',
          title: 'Low Stock Alert',
          message: `${doc.data().itemName} เหลือเพียง ${doc.data().quantity} ชิ้น`,
          time: null
        }));

      updateNotifications(stockNotifications, 'stock');
    }, (error) => {
      console.warn("Permission restricted for low stock listener (non-critical):", error.message);
    });

    return () => {
      unsubscribeBookings();
      unsubscribeStock();
    };
  }, [isAuthReady, isStaff]);

  const updateNotifications = (newItems: Notification[], type: 'booking' | 'stock') => {
    setNotifications(prev => {
      const otherTypeItems = prev.filter(n => n.type !== type);
      return [...otherTypeItems, ...newItems].sort((a, b) => {
        const timeA = a.time?.toDate ? a.time.toDate().getTime() : 0;
        const timeB = b.time?.toDate ? b.time.toDate().getTime() : 0;
        return timeB - timeA;
      });
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 relative z-40">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-slate-900 capitalize">
          {activeView.replace(/-/g, ' ')}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center relative" ref={searchRef}>
          <div className="flex items-center bg-slate-100 rounded-xl px-4 py-2 gap-2 border border-slate-200 w-80">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Pet, HN, Owner or Phone..." 
              value={globalSearchQuery}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              onFocus={() => globalSearchQuery.length >= 2 && setShowSearchResults(true)}
              className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none"
            />
            {isGlobalSearching && (
              <div className="w-4 h-4 border-2 border-[#00b4d8] border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          <AnimatePresence>
            {showSearchResults && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 mt-2 w-[400px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
              >
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search Results</p>
                </div>
                
                <div className="max-h-[400px] overflow-y-auto">
                  {globalSearchResults.patients.length > 0 && (
                    <div className="p-2">
                      <p className="px-3 py-2 text-[10px] font-black text-[#00b4d8] uppercase tracking-widest">Patients</p>
                      {globalSearchResults.patients.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setActiveView('patients');
                            setShowSearchResults(false);
                            setGlobalSearchQuery('');
                          }}
                          className="w-full p-3 text-left hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors"
                        >
                          <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600">
                            <PawPrint className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px]">
                              HN: {p.hn} • {p.displayOwnerName || 'No owner'}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {globalSearchResults.inventory.length > 0 && (
                    <div className="p-2 border-t border-slate-50">
                      <p className="px-3 py-2 text-[10px] font-black text-[#00b4d8] uppercase tracking-widest">Inventory</p>
                      {globalSearchResults.inventory.map(i => (
                        <button
                          key={i.id}
                          onClick={() => {
                            setActiveView('inventory');
                            setShowSearchResults(false);
                            setGlobalSearchQuery('');
                          }}
                          className="w-full p-3 text-left hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors"
                        >
                          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{i.itemName}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Stock: {i.quantity} • {i.unitPrice} ฿</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {globalSearchResults.patients.length === 0 && globalSearchResults.inventory.length === 0 && !isGlobalSearching && (
                    <div className="p-8 text-center text-slate-400">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest">No results found</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={cn(
              "p-2 rounded-xl transition-all relative",
              isNotificationsOpen ? "bg-[#00b4d8] text-white" : "hover:bg-slate-100 text-slate-500"
            )}
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                {notifications.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
              >
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Notifications</h3>
                  <span className="px-2 py-0.5 bg-[#00b4d8] text-white text-[10px] font-bold rounded-full">
                    {notifications.length} New
                  </span>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                            notif.type === 'booking' ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500"
                          )}>
                            {notif.type === 'booking' ? <Calendar className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
                              {notif.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {notif.message}
                            </p>
                            {notif.time && (
                              <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400 font-bold">
                                <Clock className="w-3 h-3" />
                                {format(notif.time.toDate(), 'dd MMM, hh:mm a')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bell className="w-8 h-8 text-slate-200" />
                      </div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No notifications</p>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50/50 border-t border-slate-100">
                  <button className="w-full py-2 text-[10px] font-black text-[#00b4d8] uppercase tracking-widest hover:bg-white rounded-lg transition-all">
                    View All Notifications
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-500">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
