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
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useClinic } from '../../contexts/ClinicContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeView: string;
  setActiveView: (view: any) => void;
  expandedGroups: string[];
  toggleGroup: (groupId: string) => void;
  handleLogout: () => void;
}

export default function Sidebar({ 
  isOpen, 
  setIsOpen, 
  activeView, 
  setActiveView, 
  expandedGroups, 
  toggleGroup,
  handleLogout
}: SidebarProps) {
  const { user, userRole } = useAuth();
  const { clinicName } = useClinic();

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
        { id: 'settings-vet', label: 'Veterinarian' },
        { id: 'settings-contact', label: 'Contact Setting' },
        { id: 'settings-activities', label: 'Activities Setting' },
        { id: 'settings-reward', label: 'Reward Setting' },
        { id: 'settings-product', label: 'Product Setting' },
        { id: 'settings-usage', label: 'ตั้งค่าการใช้งาน' },
        { id: 'settings-payment', label: 'Payment Method Setting' },
      ]
    },
  ];

  return (
    <aside 
      className={cn(
        "bg-[#006d87] transition-all duration-300 flex flex-col z-20 shadow-xl",
        isOpen ? "w-72" : "w-20"
      )}
    >
      <div className="h-24 flex items-center px-4 bg-[#005b70]">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors flex items-center justify-center"
        >
          {isOpen ? (
            <Menu className="w-6 h-6" />
          ) : (
            <div className="w-10 h-10 bg-white rounded-xl p-1 flex items-center justify-center overflow-hidden shadow-sm">
              <img 
                src="https://i.postimg.cc/44qTnjwG/logo-2.webp" 
                className="w-full h-full object-contain" 
                alt="Logo"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </button>
        {isOpen && (
          <div className="ml-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl p-1 flex items-center justify-center overflow-hidden shadow-sm">
              <img 
                src="https://i.postimg.cc/44qTnjwG/logo-2.webp" 
                className="w-full h-full object-contain" 
                alt="Logo"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "https://via.placeholder.com/100?text=AB";
                }}
              />
            </div>
            <span className="font-bold text-lg text-white tracking-tight leading-tight truncate max-w-[140px]">{clinicName}</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        {navGroups.map((group) => {
          const isActive = activeView === group.id || group.subItems?.some(item => item.id === activeView);
          const isExpanded = expandedGroups.includes(group.id);

          return (
            <div key={group.id} className="mb-1">
              <button
                onClick={() => group.subItems ? toggleGroup(group.id) : setActiveView(group.id)}
                className={cn(
                  "w-full flex items-center justify-between px-6 py-3 transition-all group",
                  !group.subItems && activeView === group.id 
                    ? "bg-[#00b4d8] text-white" 
                    : "text-white/80 hover:bg-[#005b70] hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <group.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-white/60 group-hover:text-white")} />
                  {isOpen && <span className="font-medium uppercase text-sm tracking-wide">{group.label}</span>}
                </div>
                {isOpen && group.subItems && (
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Plus className="w-3 h-3 opacity-50" />
                  </motion.div>
                )}
              </button>

              {isOpen && group.subItems && (
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
                          onClick={() => setActiveView(item.id)}
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
        {isOpen && user && (
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
            !isOpen && "justify-center px-0"
          )}
        >
          <LogOut className="w-5 h-5" />
          {isOpen && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
