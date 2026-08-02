/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  signOut, 
  db,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc
} from './firebase';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Package, 
  CreditCard, 
  BarChart3, 
  Plus,
  Settings,
  PawPrint,
  AlertCircle,
  ArrowLeftRight,
  ExternalLink,
  Stethoscope,
  Menu
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

// Routes and view mapping
import { ViewId, VIEW_TO_PATH_MAP, getViewFromPath, getPathFromView } from './routes';

// Shared Utilities & Guards
import PageLoader from './components/PageLoader';
import NotFound from './components/NotFound';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy Loaded Page Components (Code Splitting)
const Dashboard = lazy(() => import('./components/Dashboard'));
const Appointments = lazy(() => import('./components/Appointments'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const AddAppointment = lazy(() => import('./components/AddAppointment'));
const SearchMicrochip = lazy(() => import('./components/SearchMicrochip'));
const OPDList = lazy(() => import('./components/OPDList'));
const IPDList = lazy(() => import('./components/IPDList'));
const Patients = lazy(() => import('./components/Patients'));
const Finance = lazy(() => import('./components/Finance'));
const Analytics = lazy(() => import('./components/Analytics'));
const PublicBooking = lazy(() => import('./components/PublicBooking'));
const Inventory = lazy(() => import('./components/Inventory'));
const POS = lazy(() => import('./components/POS'));
const HospitalProfile = lazy(() => import('./components/HospitalProfile'));
const Veterinarian = lazy(() => import('./components/Veterinarian'));
const ContactSetting = lazy(() => import('./components/ContactSetting'));
const ActivitiesSetting = lazy(() => import('./components/ActivitiesSetting'));
const RewardSetting = lazy(() => import('./components/RewardSetting'));
const ProductSetting = lazy(() => import('./components/ProductSetting'));
const UsageSetting = lazy(() => import('./components/UsageSetting'));
const PaymentMethodSetting = lazy(() => import('./components/PaymentMethodSetting'));
const CustomerBookingForm = lazy(() => import('./components/CustomerBookingForm'));
const PrinterSetting = lazy(() => import('./components/PrinterSetting'));
const DiagramSetting = lazy(() => import('./components/DiagramSetting'));

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
  const { clinicName, quotaExceeded } = useClinic();
  
  const navigate = useNavigate();
  const location = useLocation();

  // Derive activeView from URL path
  const activeView = getViewFromPath(location.pathname);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const navigateToView = (nextView: ViewId | string) => {
    const targetPath = getPathFromView(nextView as ViewId);
    navigate(targetPath);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const [localAuthError, setLocalAuthError] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loginMode, setLoginMode] = useState<'login' | 'signup'>('login');

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsSubmitting(true);
    setLocalAuthError(null);
    try {
      if (loginMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const { createUserWithEmailAndPassword } = await import('./firebase');
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Account created successfully! You can now login.");
        setLoginMode('login');
      }
    } catch (error: any) {
      console.error("Auth failed:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        if (loginMode === 'login') {
          // Check if password matches user setting in Firestore
          try {
            const searchEmail = email.trim().toLowerCase();
            const q = query(collection(db, 'users'), where('email', '==', searchEmail));
            const querySnapshot = await getDocs(q);
            
            let matchedDoc: any = null;
            querySnapshot.forEach(docSnap => {
              const data = docSnap.data();
              if (data.password === password || data.pin === password) {
                matchedDoc = { id: docSnap.id, ...data };
              }
            });

            if (matchedDoc) {
              console.log("Firestore staff profile password matched:", matchedDoc.email);
              const { signInAnonymously } = await import('firebase/auth');
              const anonCred = await signInAnonymously(auth);
              await setDoc(doc(db, 'users', anonCred.user.uid), {
                uid: anonCred.user.uid,
                name: matchedDoc.name || matchedDoc.firstName || matchedDoc.email?.split('@')[0] || 'Staff Member',
                email: matchedDoc.email,
                role: matchedDoc.role || 'staff',
                status: 'active'
              }, { merge: true });
              return; // Successfully authenticated via staff record
            }
          } catch (fallbackErr) {
            console.warn("Firestore fallback auth check failed:", fallbackErr);
          }

          setLocalAuthError("อีเมลหรือรหัสผ่านไม่ถูกต้อง หากคุณใช้อีเมล Google ในการลงทะเบียน หรือเปิดใช้งานในระบบไว้แล้ว สามารถกดปุ่ม 'Sign in with Google' ด้านบนเพื่อเข้าสู่ระบบได้ทันที");
        } else {
          setLocalAuthError("ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีเมลและรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)");
        }
      } else if (error.code === 'auth/email-already-in-use') {
        setLoginMode('login');
        setLocalAuthError("อีเมลนี้ถูกลงทะเบียนไว้แล้ว สามารถกดปุ่ม 'Sign in with Google' หรือกรอกรหัสผ่านเพื่อเข้าสู่ระบบ");
      } else if (error.code === 'auth/weak-password') {
        setLocalAuthError("รหัสผ่านไม่ปลอดภัยพอ กรุณาใช้รหัสผ่านอย่างน้อย 6 ตัวอักษร");
      } else if (error.code === 'auth/invalid-email') {
        setLocalAuthError("รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีเมลของคุณ");
      } else if (error.code === 'auth/too-many-requests') {
        setLocalAuthError("Too many attempts. Please try again later.");
      } else {
        setLocalAuthError(`Error: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
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

  const [fabSide, setFabSide] = useState<'left' | 'right'>('right');
  const [fabVertical, setFabVertical] = useState<'top' | 'bottom'>('bottom');
  const [fabCoords, setFabCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleResize = () => {
      const sidebarWidth = isSidebarOpen ? 288 : 80;
      const maxNegativeX = - (window.innerWidth - sidebarWidth - 96);
      const maxNegativeY = - (window.innerHeight - 184);

      setFabCoords({
        x: fabSide === 'left' ? maxNegativeX : 0,
        y: fabVertical === 'top' ? maxNegativeY : 0
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen, fabSide, fabVertical]);

  const onDragEnd = (_: any, info: any) => {
    const sidebarWidth = isSidebarOpen ? 288 : 80;
    const maxNegativeX = - (window.innerWidth - sidebarWidth - 96);
    const maxNegativeY = - (window.innerHeight - 184);

    const pointerX = info.point.x;
    const pointerY = info.point.y;

    const mainContentCenter = sidebarWidth + (window.innerWidth - sidebarWidth) / 2;
    const headerHeight = 96;
    const mainContentCenterY = headerHeight + (window.innerHeight - headerHeight) / 2;

    let targetX = 0;
    let nextSide: 'left' | 'right' = 'right';
    if (pointerX < mainContentCenter) {
      targetX = maxNegativeX;
      nextSide = 'left';
    } else {
      targetX = 0;
      nextSide = 'right';
    }

    let targetY = 0;
    let nextVertical: 'top' | 'bottom' = 'bottom';
    if (pointerY < mainContentCenterY) {
      targetY = maxNegativeY;
      nextVertical = 'top';
    } else {
      targetY = 0;
      nextVertical = 'bottom';
    }

    setFabSide(nextSide);
    setFabVertical(nextVertical);
    setFabCoords({ x: targetX, y: targetY });
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

  // Standalone public booking page
  if (location.pathname === '/public-booking-form') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-12">
        <CustomerBookingForm onBack={() => navigateToView('public-booking')} />
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
          
          <div className="mb-8">
            <button
               onClick={() => navigateToView('public-form')}
               className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all border border-slate-200 shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Preview Public Booking Form (Customer)
            </button>
          </div>

          <AnimatePresence>
            {(authError || localAuthError) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col gap-2 text-left"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-rose-700">{authError || localAuthError}</p>
                </div>
                {loginMode === 'login' && localAuthError?.includes("Sign Up") && (
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode('signup');
                      setLocalAuthError(null);
                    }}
                    className="self-start ml-8 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline transition-colors cursor-pointer"
                  >
                    👉 คลิกที่นี่เพื่อสลับเป็นหน้าลงทะเบียน (Sign Up)
                  </button>
                )}
                {loginMode === 'signup' && localAuthError?.includes("Login") && (
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode('login');
                      setLocalAuthError(null);
                    }}
                    className="self-start ml-8 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline transition-colors cursor-pointer"
                  >
                    👉 คลิกที่นี่เพื่อสลับเป็นหน้าเข้าสู่ระบบ (Login)
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4 text-left">
            {/* Direct Google Sign In Option */}
            <button
              type="button"
              onClick={handleLogin}
              className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-3.5 px-6 rounded-2xl transition-all shadow-xs flex items-center justify-center gap-3 cursor-pointer"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              <span>Sign in with Google</span>
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="shrink mx-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">or sign in with email</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="flex gap-4 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('login');
                    setLocalAuthError(null);
                  }}
                  className={cn(
                    "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer",
                    loginMode === 'login' ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('signup');
                    setLocalAuthError(null);
                  }}
                  className={cn(
                    "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer",
                    loginMode === 'signup' ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Sign Up
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium text-slate-800"
                  placeholder="name@clinic.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium text-slate-800"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isSubmitting ? 'กำลังดำเนินการ...' : loginMode === 'login' ? 'เข้าสู่ระบบ (Sign in)' : 'สร้างบัญชีผู้ใช้ใหม่ (Sign up)'}
              </button>
            </form>
          </div>
          
          <p className="mt-8 text-xs text-slate-400">
            Authorized personnel only. Access is monitored and logged.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-screen bg-slate-50 flex overflow-hidden">
        <Sidebar 
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          isMobileOpen={isMobileMenuOpen}
          setIsMobileOpen={setIsMobileMenuOpen}
          activeView={activeView}
          setActiveView={navigateToView}
          expandedGroups={expandedGroups}
          toggleGroup={toggleGroup}
          handleLogout={handleLogout}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative pb-14 md:pb-0">
          {quotaExceeded && (
            <div className="bg-rose-500 text-white px-6 py-3 flex items-between justify-between gap-4 animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div className="text-xs md:text-sm font-bold uppercase tracking-tight">
                  <span className="hidden md:inline">SYSTEM ALERT: </span> 
                  Firebase Quota Exceeded (50,000 Free Reads Used). Features may be disabled until tomorrow.
                </div>
              </div>
              <button 
                onClick={() => window.open('https://firebase.google.com/pricing', '_blank')}
                className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-[10px] font-black uppercase transition-all whitespace-nowrap"
              >
                Learn More
              </button>
            </div>
          )}
          <Header 
            activeView={activeView} 
            setActiveView={navigateToView} 
            onBack={handleBack}
            canGoBack={true}
            onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
          />

          {/* View Content with Multi-page Router & Code-Splitting */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8 pb-24 md:pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    
                    {/* Core Staff Protected Routes */}
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/appointments" element={<ProtectedRoute><Appointments setActiveView={navigateToView} /></ProtectedRoute>} />
                    <Route path="/appointments/calendar" element={<ProtectedRoute><CalendarView setActiveView={navigateToView} /></ProtectedRoute>} />
                    <Route path="/appointments/add" element={<ProtectedRoute><AddAppointment /></ProtectedRoute>} />
                    
                    {/* Patient & Microchip & Dynamic Detail Routes */}
                    <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
                    <Route path="/patients/microchip" element={<ProtectedRoute><SearchMicrochip /></ProtectedRoute>} />
                    <Route path="/patients/add" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
                    <Route path="/patients/:patientId" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
                    
                    {/* OPD & Dynamic OPD Detail Routes */}
                    <Route path="/opd" element={<ProtectedRoute><OPDList setActiveView={navigateToView} /></ProtectedRoute>} />
                    <Route path="/opd/:opdId" element={<ProtectedRoute><OPDList setActiveView={navigateToView} /></ProtectedRoute>} />
                    
                    {/* IPD & Dynamic IPD Detail Routes */}
                    <Route path="/ipd" element={<ProtectedRoute><IPDList /></ProtectedRoute>} />
                    <Route path="/ipd/:ipdId" element={<ProtectedRoute><IPDList /></ProtectedRoute>} />
                    
                    {/* Operational & Financial Modules */}
                    <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
                    <Route path="/booking-requests" element={<ProtectedRoute><PublicBooking onOpenPublicForm={() => navigateToView('public-form')} /></ProtectedRoute>} />
                    <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                    <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
                    <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                    
                    {/* Settings Routes */}
                    <Route path="/settings/hospital" element={<ProtectedRoute><HospitalProfile /></ProtectedRoute>} />
                    <Route path="/settings/user" element={<ProtectedRoute><Veterinarian /></ProtectedRoute>} />
                    <Route path="/settings/contact" element={<ProtectedRoute><ContactSetting /></ProtectedRoute>} />
                    <Route path="/settings/activities" element={<ProtectedRoute><ActivitiesSetting /></ProtectedRoute>} />
                    <Route path="/settings/reward" element={<ProtectedRoute><RewardSetting /></ProtectedRoute>} />
                    <Route path="/settings/product" element={<ProtectedRoute><ProductSetting /></ProtectedRoute>} />
                    <Route path="/settings/room-rates" element={<ProtectedRoute><UsageSetting /></ProtectedRoute>} />
                    <Route path="/settings/payment-methods" element={<ProtectedRoute><PaymentMethodSetting /></ProtectedRoute>} />
                    <Route path="/settings/printer" element={<ProtectedRoute><PrinterSetting /></ProtectedRoute>} />
                    <Route path="/settings/diagram" element={<ProtectedRoute><DiagramSetting /></ProtectedRoute>} />
                    
                    {/* 404 Not Found Page */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <motion.div 
          layout
          drag
          dragConstraints={{
            left: - (window.innerWidth - (isSidebarOpen ? 288 : 80) - 96),
            right: 0,
            top: - (window.innerHeight - 184),
            bottom: 0
          }}
          dragMomentum={false}
          dragElastic={0}
          onDragEnd={onDragEnd}
          animate={fabCoords}
          initial={false}
          transition={{ 
            type: 'spring', 
            damping: 30, 
            stiffness: 300
          }}
          className="fixed z-[10001] w-14 h-14 right-8 bottom-8 group cursor-grab active:cursor-grabbing touch-none"
        >
          <button 
            className="w-14 h-14 bg-[#00b4d8] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group-hover:rotate-45"
          >
            <Plus className="w-8 h-8" />
          </button>
          
          <div className={cn(
            "absolute flex gap-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 z-[10002]",
            fabVertical === 'bottom' ? "bottom-16 flex-col-reverse translate-y-10" : "top-16 flex-col -translate-y-10",
            fabSide === 'right' ? "right-0 items-end" : "left-0 items-start"
          )}>
            {[
              { id: 'dashboard', label: 'Home', icon: LayoutDashboard, color: 'bg-blue-50 text-[#00b4d8]' },
              { id: 'add-pet', label: 'Add Pet', icon: PawPrint, color: 'bg-rose-50 text-rose-500' },
              { id: 'appointments', label: 'Appointment', icon: Calendar, color: 'bg-indigo-50 text-indigo-500' },
              { id: 'pos', label: 'POS Billing', icon: CreditCard, color: 'bg-emerald-50 text-emerald-500' },
              { id: 'toggle-side', label: 'Move Side', icon: ArrowLeftRight, color: 'bg-amber-50 text-amber-500', action: () => setFabSide(prev => prev === 'right' ? 'left' : 'right') }
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => item.action ? item.action() : navigateToView(item.id as ViewId)}
                className={cn(
                  "flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-xl border border-slate-100 hover:bg-slate-50 transition-all whitespace-nowrap",
                  fabSide === 'right' ? "flex-row" : "flex-row-reverse"
                )}
              >
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{item.label}</span>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", item.color)}>
                  <item.icon className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Mobile Bottom Navigation Bar for Admin */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-[90] flex items-center justify-around py-2 px-1 shadow-lg">
          {[
            { id: 'dashboard', label: 'หน้าแรก', icon: LayoutDashboard },
            { id: 'opd', label: 'OPD', icon: Stethoscope },
            { id: 'patients', label: 'สัตว์เลี้ยง', icon: Users },
            { id: 'pos', label: 'POS/ชำระเงิน', icon: CreditCard },
            { id: 'menu', label: 'เมนูทั้งหมด', icon: Menu, action: () => setIsMobileMenuOpen(true) },
          ].map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={`mob-nav-${item.id}`}
                onClick={() => item.action ? item.action() : navigateToView(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-2xl transition-all cursor-pointer flex-1 min-w-0",
                  isActive ? "text-[#00b4d8] font-bold bg-sky-50" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-[#00b4d8]" : "text-slate-500")} />
                <span className="text-[10px] font-medium tracking-tight truncate max-w-full">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </ErrorBoundary>
  );
}

