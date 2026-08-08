import React from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Package, 
  CreditCard, 
  BarChart3, 
  Settings,
  Stethoscope,
  Menu,
  Plus,
  LogOut,
  User as UserIcon,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useClinic } from '../../contexts/ClinicContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  activeView: string;
  setActiveView: (view: any) => void;
  expandedGroups: string[];
  toggleGroup: (groupId: string) => void;
  handleLogout: () => void;
}

export default function Sidebar({ 
  isOpen, 
  setIsOpen, 
  isMobileOpen = false,
  setIsMobileOpen,
  activeView, 
  setActiveView, 
  expandedGroups, 
  toggleGroup,
  handleLogout
}: SidebarProps) {
  const { user, userRole } = useAuth();
  const { clinicName, clinicLogo } = useClinic();

  const navGroups = [
    { id: 'dashboard', label: 'HOME', icon: LayoutDashboard },
    { 
      id: 'appointments-group', 
      label: 'Appointment', 
      icon: Calendar,
      subItems: [
        { id: 'appointments', label: 'Appointment List' },
        { id: 'calendar', label: 'Calendar' },
      ]
    },
    { 
      id: 'patients-group', 
      label: 'Pet Profile', 
      icon: Users,
      subItems: [
        { id: 'patients', label: 'Pet Profile List' },
        { id: 'search-microchip', label: 'Search From Microchip' },
        { id: 'add-pet', label: '+ Add New Pet' },
      ]
    },
    { 
      id: 'opd-group', 
      label: 'OPD', 
      icon: Stethoscope,
      subItems: [
        { id: 'opd', label: 'OPD List' },
      ]
    },
    { 
      id: 'ipd-group', 
      label: 'IPD', 
      icon: Stethoscope,
      subItems: [
        { id: 'ipd', label: 'IPD List' },
      ]
    },
    { id: 'finance', label: 'Finance', icon: CreditCard },
    { id: 'public-booking', label: 'Booking Requests', icon: Calendar },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'pos', label: 'POS / Billing', icon: CreditCard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { 
      id: 'settings-group', 
      label: 'Settings', 
      icon: Settings,
      subItems: [
        { id: 'settings-hospital', label: 'Hospital Profile' },
        { id: 'settings-vet', label: 'User Setting' },
        { id: 'settings-contact', label: 'Contact Setting' },
        { id: 'settings-activities', label: 'Activities Setting' },
        { id: 'settings-reward', label: 'Reward Setting' },
        { id: 'settings-product', label: 'ตั้งค่า ยาและเวชภัณฑ์' },
        { id: 'settings-food', label: 'ตั้งค่า อาหารสัตว์' },
        { id: 'settings-usage', label: 'ตั้งค่าราคาห้องพักสัตว์เลี้ยง' },
        { id: 'settings-payment', label: 'Payment Method Setting' },
        { id: 'settings-printer', label: 'Printer Setting' },
        { id: 'settings-diagram', label: 'ตั้งค่าภาพกายวิภาคสัตว์' },
      ]
    },
  ];

  React.useEffect(() => {
    navGroups.forEach(group => {
      if (group.subItems?.some(item => item.id === activeView)) {
        if (!expandedGroups.includes(group.id)) {
          toggleGroup(group.id);
        }
      }
    });
  }, [activeView]);

  const handleNavClick = (viewId: string) => {
    setActiveView(viewId);
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const renderNavItems = (isDrawer = false) => (
    <>
      <div className="h-24 flex items-center px-4 bg-[#005b70] justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => !isDrawer && setIsOpen(!isOpen)}
            className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors flex items-center justify-center shrink-0"
          >
            {(isOpen || isDrawer) ? (
              <Menu className="w-6 h-6" />
            ) : (
              <div className="w-10 h-10 bg-white rounded-xl p-1 flex items-center justify-center overflow-hidden shadow-sm">
                <img 
                  src={clinicLogo} 
                  className="w-full h-full object-contain" 
                  alt="Logo"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </button>
          {(isOpen || isDrawer) && (
            <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
              <div className="w-10 h-10 bg-white rounded-xl p-1 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                <img 
                  src={clinicLogo} 
                  className="w-full h-full object-contain" 
                  alt="Logo"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "https://via.placeholder.com/100?text=AB";
                  }}
                />
              </div>
              <div className="overflow-hidden whitespace-nowrap flex-1 min-w-0 relative py-1">
                <div className="animate-marquee whitespace-nowrap font-bold text-base text-white tracking-tight leading-tight">
                  <span className="pr-8">{clinicName}</span>
                  <span className="pr-8">{clinicName}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        {isDrawer && (
          <button 
            onClick={() => setIsMobileOpen?.(false)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl text-xs font-bold uppercase"
          >
            ✕
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        {navGroups.map((group) => {
          const isActive = activeView === group.id || group.subItems?.some(item => item.id === activeView);
          const isExpanded = expandedGroups.includes(group.id);

          return (
            <div key={group.id} className="mb-1">
              <button
                onClick={() => group.subItems ? toggleGroup(group.id) : handleNavClick(group.id)}
                className={cn(
                  "w-full flex items-center justify-between px-6 py-3 transition-all group",
                  !group.subItems && activeView === group.id 
                    ? "bg-[#00b4d8] text-white" 
                    : "text-white/80 hover:bg-[#005b70] hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <group.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-white/60 group-hover:text-white")} />
                  {(isOpen || isDrawer) && <span className="font-medium uppercase text-sm tracking-wide">{group.label}</span>}
                </div>
                {(isOpen || isDrawer) && group.subItems && (
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Plus className="w-3 h-3 opacity-50" />
                  </motion.div>
                )}
              </button>

              {(isOpen || isDrawer) && group.subItems && (
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-[#005b70]/30"
                    >
                      {group.subItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id)}
                          className={cn(
                            "w-full text-left pl-14 pr-6 py-2.5 text-sm transition-all",
                            activeView === item.id 
                              ? "text-[#00b4d8] font-bold" 
                              : "text-white/70 hover:text-white hover:bg-white/5"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 bg-[#005b70]/50">
        {(isOpen || isDrawer) && user && (
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/20">
              {user.photoURL ? (
                <img src={user.photoURL} className="w-full h-full object-cover" alt="User" />
              ) : (
                <UserIcon className="w-5 h-5 text-white/60" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-widest">{userRole}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-6 py-3 text-white/70 hover:bg-red-500/20 hover:text-red-200 transition-all rounded-lg",
            !(isOpen || isDrawer) && "justify-center px-0"
          )}
        >
          <LogOut className="w-5 h-5" />
          {(isOpen || isDrawer) && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden md:flex bg-[#006d87] transition-all duration-300 flex-col z-20 shadow-xl",
          isOpen ? "w-72" : "w-20"
        )}
      >
        {renderNavItems(false)}
      </aside>

      {/* Mobile Overlay Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex"
            onClick={() => setIsMobileOpen?.(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-80 max-w-[85vw] bg-[#006d87] h-full flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {renderNavItems(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
