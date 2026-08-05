import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Settings, Package, Calendar, Clock, X, PawPrint, ArrowLeft, Menu } from 'lucide-react';
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
import { useLocation } from 'react-router-dom';
import { VIEW_LABELS } from '../../routes';

interface HeaderProps {
  activeView: string;
  setActiveView: (view: any) => void;
  onBack?: () => void;
  canGoBack?: boolean;
  onToggleMobileMenu?: () => void;
}

interface Notification {
  id: string;
  type: 'booking' | 'stock' | 'appointment';
  title: string;
  message: string;
  time: any;
  dateStr?: string;
  petName?: string;
  ownerName?: string;
  status?: string;
}

export default function Header({ activeView, setActiveView, onBack, canGoBack, onToggleMobileMenu }: HeaderProps) {
  const { isAuthReady, isStaff } = useAuth();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifFilter, setNotifFilter] = useState<'all' | 'appointment' | 'booking' | 'stock'>('all');
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

    // Listen for Pet Appointments
    const apptQuery = query(
      collection(db, 'appointments'),
      limit(25)
    );

    const unsubscribeAppointments = onSnapshot(apptQuery, (snap) => {
      const apptNotifications: Notification[] = snap.docs
        .map(doc => {
          const d = doc.data();
          const petName = d.patientName || d.petName || 'สัตว์เลี้ยง';
          const ownerInfo = d.ownerName ? ` (คุณ${d.ownerName})` : '';
          const service = d.serviceType ? `นัด${d.serviceType}` : (d.notes || 'การนัดหมายตรวจรักษา');
          const dateStr = d.date || (d.startTime?.toDate ? format(d.startTime.toDate(), 'dd/MM/yyyy') : '');
          const timeStr = d.time || (d.startTime?.toDate ? format(d.startTime.toDate(), 'HH:mm') : '');
          
          return {
            id: doc.id,
            type: 'appointment' as const,
            title: `นัดหมายสัตว์เลี้ยง: ${petName}`,
            message: `${service}${ownerInfo} • ${dateStr} ${timeStr}`,
            time: d.startTime || d.createdAt || null,
            dateStr: dateStr,
            petName: petName,
            ownerName: d.ownerName || '',
            status: d.status || 'scheduled'
          };
        })
        .filter(item => {
          const st = (item.status || '').toLowerCase().trim();
          return st !== 'completed' && st !== 'done' && st !== 'cancelled';
        });

      updateNotifications(apptNotifications, 'appointment');
    }, (error) => {
      console.warn("Permission restricted for appointments listener (non-critical):", error.message);
    });

    // Listen for New Booking Requests (Pending)
    const bookingQuery = query(
      collection(db, 'public_bookings'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribeBookings = onSnapshot(bookingQuery, (snap) => {
      const bookingNotifications: Notification[] = snap.docs.map(doc => ({
        id: doc.id,
        type: 'booking',
        title: 'คำขอนัดหมายออนไลน์ใหม่',
        message: `จากคุณ ${doc.data().ownerName} (${doc.data().petName}) • ${doc.data().serviceType || 'ขอนัดหมาย'}`,
        time: doc.data().createdAt,
        status: doc.data().status
      }));

      updateNotifications(bookingNotifications, 'booking');
    }, (error) => {
      console.warn("Permission restricted for bookings listener (non-critical):", error.message);
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
          title: 'แจ้งเตือนสินค้าใกล้หมด',
          message: `${doc.data().itemName} เหลือเพียง ${doc.data().quantity} ชิ้น`,
          time: null
        }));

      updateNotifications(stockNotifications, 'stock');
    }, (error) => {
      console.warn("Permission restricted for low stock listener (non-critical):", error.message);
    });

    return () => {
      unsubscribeAppointments();
      unsubscribeBookings();
      unsubscribeStock();
    };
  }, [isAuthReady, isStaff]);

  const updateNotifications = (newItems: Notification[], type: 'booking' | 'stock' | 'appointment') => {
    setNotifications(prev => {
      const otherTypeItems = prev.filter(n => n.type !== type);
      return [...otherTypeItems, ...newItems].sort((a, b) => {
        const timeA = a.time?.toDate ? a.time.toDate().getTime() : (typeof a.time === 'number' ? a.time : 0);
        const timeB = b.time?.toDate ? b.time.toDate().getTime() : (typeof b.time === 'number' ? b.time : 0);
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

  const [productSettingMode, setProductSettingMode] = useState<'list' | 'edit'>('list');

  useEffect(() => {
    const handleModeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setProductSettingMode(customEvent.detail);
      }
    };
    window.addEventListener('product-setting-mode-change', handleModeChange);
    return () => {
      window.removeEventListener('product-setting-mode-change', handleModeChange);
    };
  }, []);

  const location = useLocation();
  const routeInfo = VIEW_LABELS[location.pathname] || { title: activeView.replace(/-/g, ' ') };

  const isProductOrFoodSetting = location.pathname === '/settings/product' || location.pathname === '/settings/food';
  const shouldShowBack = isProductOrFoodSetting ? (productSettingMode === 'edit') : canGoBack;

  const handleBackClick = () => {
    if (isProductOrFoodSetting && productSettingMode === 'edit') {
      window.dispatchEvent(new CustomEvent('app-header-back'));
      return;
    }
    if (onBack) {
      onBack();
    }
  };

  return (
    <header className="h-16 md:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 flex-shrink-0 relative z-40">
      <div className="flex items-center gap-2.5 md:gap-4">
        {onToggleMobileMenu && (
          <button 
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-700 transition-all flex items-center justify-center border border-slate-200 shadow-2xs bg-white"
            title="เปิดเมนู"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
        )}
        {shouldShowBack && onBack && (
          <button 
            id="header-back-btn"
            onClick={handleBackClick}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all flex items-center justify-center border border-slate-200 shadow-sm bg-white hover:scale-105 active:scale-95"
            title="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
        )}
        <div>
          {routeInfo.category && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
              <span>{routeInfo.category}</span>
              <span>/</span>
              <span className="text-[#00b4d8]">{routeInfo.title}</span>
            </div>
          )}
          <h2 className="text-base md:text-xl font-bold text-slate-900 capitalize truncate max-w-[180px] sm:max-w-xs md:max-w-none">
            {routeInfo.title}
          </h2>
        </div>
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
                className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
              >
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#00b4d8]" />
                    <h3 className="font-black text-slate-800 tracking-tight text-sm">การแจ้งเตือน (Notifications)</h3>
                  </div>
                  <span className="px-2.5 py-0.5 bg-[#00b4d8] text-white text-[10px] font-bold rounded-full">
                    {notifications.length} รายการ
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 p-2 bg-slate-50/80 border-b border-slate-100 text-xs font-bold overflow-x-auto">
                  <button
                    onClick={() => setNotifFilter('all')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all text-[11px]",
                      notifFilter === 'all' ? "bg-white text-slate-800 shadow-sm font-black" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    ทั้งหมด ({notifications.length})
                  </button>
                  <button
                    onClick={() => setNotifFilter('appointment')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all text-[11px]",
                      notifFilter === 'appointment' ? "bg-indigo-50 text-indigo-600 shadow-sm font-black" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    นัดหมาย ({notifications.filter(n => n.type === 'appointment').length})
                  </button>
                  <button
                    onClick={() => setNotifFilter('booking')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all text-[11px]",
                      notifFilter === 'booking' ? "bg-emerald-50 text-emerald-600 shadow-sm font-black" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    จองออนไลน์ ({notifications.filter(n => n.type === 'booking').length})
                  </button>
                  <button
                    onClick={() => setNotifFilter('stock')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all text-[11px]",
                      notifFilter === 'stock' ? "bg-amber-50 text-amber-600 shadow-sm font-black" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    สต็อก ({notifications.filter(n => n.type === 'stock').length})
                  </button>
                </div>

                <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-50">
                  {(() => {
                    const filtered = notifications.filter(n => notifFilter === 'all' || n.type === notifFilter);
                    if (filtered.length === 0) {
                      return (
                        <div className="p-10 text-center">
                          <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Bell className="w-7 h-7 text-slate-200" />
                          </div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ไม่มีรายการแจ้งเตือน</p>
                        </div>
                      );
                    }

                    return filtered.map((notif) => (
                      <div 
                        key={notif.id} 
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          if (notif.type === 'appointment') {
                            setActiveView('appointments');
                          } else if (notif.type === 'booking') {
                            setActiveView('booking-requests');
                          } else if (notif.type === 'stock') {
                            setActiveView('inventory');
                          }
                        }}
                        className="p-3.5 hover:bg-slate-50 transition-all cursor-pointer group flex gap-3 items-start"
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5",
                          notif.type === 'appointment' ? "bg-indigo-50 text-indigo-500 border border-indigo-100" :
                          notif.type === 'booking' ? "bg-emerald-50 text-emerald-500 border border-emerald-100" :
                          "bg-amber-50 text-amber-500 border border-amber-100"
                        )}>
                          {notif.type === 'appointment' ? <Calendar className="w-4 h-4" /> :
                           notif.type === 'booking' ? <Clock className="w-4 h-4" /> :
                           <Package className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-black text-slate-800 tracking-tight truncate">
                              {notif.title}
                            </p>
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                              notif.type === 'appointment' ? "bg-indigo-50 text-indigo-600" :
                              notif.type === 'booking' ? "bg-emerald-50 text-emerald-600" :
                              "bg-amber-50 text-amber-600"
                            )}>
                              {notif.type === 'appointment' ? 'นัดหมาย' : notif.type === 'booking' ? 'จองออนไลน์' : 'เตือนสต็อก'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2 font-medium leading-relaxed">
                            {notif.message}
                          </p>
                          {notif.time && (
                            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400 font-bold">
                              <Clock className="w-3 h-3" />
                              {notif.time?.toDate ? format(notif.time.toDate(), 'dd MMM, HH:mm น.') : (notif.dateStr || '')}
                            </div>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="p-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button 
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      setActiveView('appointments');
                    }}
                    className="flex-1 py-1.5 text-[10px] font-black text-[#00b4d8] bg-cyan-50 hover:bg-[#00b4d8] hover:text-white rounded-lg transition-all border border-cyan-100 text-center"
                  >
                    ดูการนัดหมายทั้งหมด (Appointment List)
                  </button>
                  <button 
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      setActiveView('booking-requests');
                    }}
                    className="flex-1 py-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-500 hover:text-white rounded-lg transition-all border border-emerald-100 text-center"
                  >
                    ดูคำขอนัดออนไลน์
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {(activeView === 'inventory' || activeView.startsWith('inventory')) && (
          <button 
            id="header-settings-btn"
            onClick={() => {
              setActiveView('settings-product');
            }}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all hover:scale-105 active:scale-95"
            title="ตั้งค่าสินค้าและเวชภัณฑ์ (Product Setting)"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  );
}
