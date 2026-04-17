/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc,
  FirebaseUser,
  handleFirestoreError,
  OperationType
} from './firebase';
import { useAsyncError } from './hooks/useAsyncError';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Package, 
  CreditCard, 
  BarChart3, 
  LogOut, 
  Menu, 
  X, 
  Plus,
  Search,
  Bell,
  Settings,
  User as UserIcon,
  Stethoscope,
  PawPrint,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClinicProvider, useClinic } from './contexts/ClinicContext';

// Layout Components
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import { ErrorBoundary } from './components/ErrorBoundary';

// Components
import Dashboard from './components/Dashboard';
import Appointments from './components/Appointments';
import CalendarView from './components/CalendarView';
import AddAppointment from './components/AddAppointment';
import SearchMicrochip from './components/SearchMicrochip';
import OPDList from './components/OPDList';
import IPDList from './components/IPDList';
import Patients from './components/Patients';
import Finance from './components/Finance';
import Analytics from './components/Analytics';
import PublicBooking from './components/PublicBooking';
import Inventory from './components/Inventory';
import POS from './components/POS';
import HospitalProfile from './components/HospitalProfile';
import Veterinarian from './components/Veterinarian';
import ContactSetting from './components/ContactSetting';
import ActivitiesSetting from './components/ActivitiesSetting';
import RewardSetting from './components/RewardSetting';
import ProductSetting from './components/ProductSetting';
import UsageSetting from './components/UsageSetting';
import PaymentMethodSetting from './components/PaymentMethodSetting';

type View = 
  | 'dashboard' 
  | 'appointments' | 'calendar' | 'add-appointment'
  | 'patients' | 'search-microchip' | 'add-pet'
  | 'opd' | 'add-opd'
  | 'ipd' | 'add-ipd'
  | 'finance' | 'public-booking'
  | 'inventory' | 'pos' | 'analytics'
  | 'settings-hospital' | 'settings-vet' | 'settings-contact' | 'settings-activities' | 'settings-reward' | 'settings-product' | 'settings-usage' | 'settings-payment';

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  subItems?: { id: View; label: string }[];
}

export default function App() {
  return (
    <ErrorBoundary>
      <ClinicProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ClinicProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { user, loading, isAuthReady, authError } = useAuth();
  const { clinicName } = useClinic();
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const [localAuthError, setLocalAuthError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLocalAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        setLocalAuthError("Login window was closed before completion. Please try again and wait for the window to finish.");
      } else if (error.code === 'auth/cancelled-by-user') {
        setLocalAuthError("Login was cancelled. Please try again.");
      } else {
        console.error("Login failed:", error);
        setLocalAuthError(`Failed to sign in (${error.code || 'unknown'}). Please check your connection or contact support.`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId) 
        : [...prev, groupId]
    );
  };

  if (loading || !isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <PawPrint className="w-12 h-12 text-indigo-600 animate-bounce" />
          <p className="text-slate-500 font-medium animate-pulse">Loading Clinic Hub...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-indigo-100 p-10 text-center border border-slate-100"
        >
          <div className="w-32 h-32 mx-auto mb-8 flex items-center justify-center">
            <img 
              src="https://i.postimg.cc/44qTnjwG/logo-2.webp" 
              className="w-full h-full object-contain rounded-2xl shadow-lg" 
              alt="Animal Box Logo"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://via.placeholder.com/200?text=Animal+Box";
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{clinicName}</h1>
          <p className="text-slate-500 mb-10">Smart Clinic Management & EMR System</p>
          
          <AnimatePresence>
            {(authError || localAuthError) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-left"
              >
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-rose-600">{authError || localAuthError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 brightness-0 invert" alt="Google" />
            Sign in with Staff Account
          </button>
          
          <p className="mt-8 text-xs text-slate-400">
            Authorized personnel only. Access is monitored and logged.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar 
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          activeView={activeView}
          setActiveView={setActiveView}
          expandedGroups={expandedGroups}
          toggleGroup={toggleGroup}
          handleLogout={handleLogout}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header activeView={activeView} setActiveView={setActiveView} />

          {/* View Content */}
          <div className="flex-1 overflow-y-auto p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                  {activeView === 'dashboard' && <Dashboard />}
                  {activeView === 'settings-hospital' && <HospitalProfile />}
                  {activeView === 'settings-vet' && <Veterinarian />}
                  {activeView === 'settings-contact' && <ContactSetting />}
                  {activeView === 'settings-activities' && <ActivitiesSetting />}
                  {activeView === 'settings-reward' && <RewardSetting />}
                  {activeView === 'settings-product' && <ProductSetting />}
                  {activeView === 'settings-usage' && <UsageSetting />}
                  {activeView === 'settings-payment' && <PaymentMethodSetting />}
                  {activeView === 'appointments' && <Appointments setActiveView={setActiveView} />}
                  {activeView === 'calendar' && <CalendarView setActiveView={setActiveView} />}
                  {activeView === 'add-appointment' && <AddAppointment />}
                  {activeView === 'search-microchip' && <SearchMicrochip />}
                  {activeView === 'opd' && <OPDList setActiveView={setActiveView} />}
                  {activeView === 'ipd' && <IPDList />}
                  {(activeView === 'patients' || activeView === 'add-pet') && <Patients />}
                  {activeView === 'inventory' && <Inventory />}
                  {activeView === 'pos' && <POS />}
                  {activeView === 'analytics' && <Analytics />}
                  {activeView === 'finance' && <Finance />}
                  {activeView === 'public-booking' && <PublicBooking />}
                  {activeView.startsWith('settings') && 
                    activeView !== 'settings-hospital' && 
                    activeView !== 'settings-vet' && 
                    activeView !== 'settings-contact' && 
                    activeView !== 'settings-activities' && 
                    activeView !== 'settings-reward' && 
                    activeView !== 'settings-product' && (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <div className="text-center">
                        <Settings className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <h3 className="text-lg font-bold text-slate-600">{activeView.replace(/-/g, ' ')}</h3>
                        <p>Settings module is coming soon.</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
          </div>
        </main>

        {/* Floating Action Button */}
        <div className="fixed bottom-8 right-8 z-50 flex flex-col-reverse items-end gap-4 group">
          <button className="w-14 h-14 bg-[#00b4d8] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group-hover:rotate-45">
            <Plus className="w-8 h-8" />
          </button>
          
          <div className="flex flex-col-reverse gap-3 opacity-0 translate-y-10 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300">
            <button 
              onClick={() => setActiveView('add-pet')}
              className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-xl border border-slate-100 hover:bg-slate-50 transition-all"
            >
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Add Pet</span>
              <div className="w-8 h-8 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center">
                <PawPrint className="w-4 h-4" />
              </div>
            </button>
            
            <button 
              onClick={() => setActiveView('add-appointment')}
              className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-xl border border-slate-100 hover:bg-slate-50 transition-all"
            >
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Appointment</span>
              <div className="w-8 h-8 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </button>

            <button 
              onClick={() => setActiveView('pos')}
              className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-xl border border-slate-100 hover:bg-slate-50 transition-all"
            >
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">POS Billing</span>
              <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
