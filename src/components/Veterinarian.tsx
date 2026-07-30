import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  UserPlus,
  ArrowLeft,
  Check,
  X,
  User,
  Shield,
  Stethoscope,
  Users,
  Key,
  Mail,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword as createAuthUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  db, 
  collection, 
  onSnapshot, 
  updateDoc, 
  setDoc,
  doc, 
  query, 
  orderBy,
  handleFirestoreError,
  OperationType,
  serverTimestamp
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';

interface StaffUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'staff';
  prefix?: string;
  firstName?: string;
  lastName?: string;
  licenseNumber?: string;
  address?: string;
  tel?: string;
  pin?: string;
  password?: string;
  status?: 'active' | 'inactive';
}

export default function Veterinarian() {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [mode, setMode] = useState<'list' | 'edit' | 'create'>('list');
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [editingUser, setEditingUser] = useState<Partial<StaffUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for creating new user
  const [passwordInput, setPasswordInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) {
      if (isAuthReady && !isStaff) setLoading(false);
      return;
    }

    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffUser));
      setUsers(data);
      setLoading(false);
    }, (err) => {
      console.warn("Users listener (veterinarian) restricted:", err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isAuthReady, user, isStaff]);

  const handleCreateUser = async () => {
    if (!editingUser?.email || !passwordInput) {
      setStatusMessage({ type: 'error', text: 'กรุณากรอกอีเมลและรหัสผ่าน' });
      return;
    }

    if (passwordInput.length < 8) {
      setStatusMessage({ type: 'error', text: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 หลัก' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    let secondaryApp;
    try {
      // 1. Create secondary Firebase App instance so we don't logout current Admin user
      secondaryApp = initializeApp(firebaseConfig, `SecondaryApp_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Register user in Firebase Authentication
      const userCred = await createAuthUser(secondaryAuth, editingUser.email, passwordInput);
      const newUid = userCred.user.uid;

      // 3. Build Full Display Name
      const fullName = `${editingUser.prefix || ''} ${editingUser.firstName || ''} ${editingUser.lastName || ''}`.trim() || editingUser.email.split('@')[0];

      // 4. Save User Document to Firestore
      const userPayload: Omit<StaffUser, 'id'> = {
        uid: newUid,
        email: editingUser.email,
        name: fullName,
        role: editingUser.role || 'staff',
        prefix: editingUser.prefix || '',
        firstName: editingUser.firstName || '',
        lastName: editingUser.lastName || '',
        licenseNumber: editingUser.licenseNumber || '',
        tel: editingUser.tel || '',
        pin: editingUser.pin || '',
        password: passwordInput, // Save for staff reference
        status: editingUser.status || 'active',
      };

      await setDoc(doc(db, 'users', newUid), {
        ...userPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `users/${newUid}`);
      });

      setStatusMessage({ type: 'success', text: `สร้างบัญชีผู้ใช้ ${editingUser.email} ในระบบ Firebase Authentication สำเร็จแล้ว!` });
      setTimeout(() => {
        setMode('list');
        setEditingUser(null);
        setPasswordInput('');
        setStatusMessage(null);
      }, 1500);

    } catch (error: any) {
      console.error('Error creating staff account:', error);
      if (error.code === 'auth/email-already-in-use') {
        setStatusMessage({ type: 'error', text: 'อีเมลนี้ถูกใช้งานแล้วในระบบ Firebase Authentication' });
      } else if (error.code === 'auth/invalid-email') {
        setStatusMessage({ type: 'error', text: 'รูปแบบอีเมลไม่ถูกต้อง' });
      } else {
        setStatusMessage({ type: 'error', text: error.message || 'เกิดข้อผิดพลาดในการสร้างบัญชีผู้ใช้' });
      }
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp).catch(() => {});
      }
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser?.id) return;

    if (passwordInput && passwordInput.length < 8) {
      setStatusMessage({ type: 'error', text: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 หลัก' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    let authNote = '';
    if (editingUser.email && passwordInput && passwordInput.length >= 8) {
      let secondaryApp;
      try {
        secondaryApp = initializeApp(firebaseConfig, `SecondaryApp_Update_${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        await createAuthUser(secondaryAuth, editingUser.email, passwordInput);
        authNote = ' (สร้างบัญชีใน Firebase Auth สำเร็จเรียบร้อย!)';
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          authNote = ' (หมายเหตุ: อีเมลนี้มีใน Firebase Auth แล้ว สามารถล็อกอินด้วย Google หรือรหัสผ่านเดิมได้)';
        }
      } finally {
        if (secondaryApp) {
          await deleteApp(secondaryApp).catch(() => {});
        }
      }
    }

    try {
      const fullName = `${editingUser.prefix || ''} ${editingUser.firstName || ''} ${editingUser.lastName || ''}`.trim() || editingUser.name || editingUser.email?.split('@')[0];
      const { id, ...updateData } = editingUser;

      const payload: any = {
        ...updateData,
        name: fullName,
        updatedAt: serverTimestamp()
      };

      if (passwordInput) {
        payload.password = passwordInput;
      }

      await updateDoc(doc(db, 'users', id), payload).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
      });

      setStatusMessage({ type: 'success', text: `อัปเดตข้อมูลบุคลากรเรียบร้อยแล้ว${authNote}` });
      setTimeout(() => {
        setMode('list');
        setEditingUser(null);
        setPasswordInput('');
        setStatusMessage(null);
      }, 1800);
    } catch (error: any) {
      console.error('Error updating staff:', error);
      setStatusMessage({ type: 'error', text: error.message || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (user: StaffUser) => {
    setEditingUser({ ...user });
    setPasswordInput(user.password || '');
    setStatusMessage(null);
    setMode('edit');
  };

  const startCreate = () => {
    setEditingUser({
      role: 'staff',
      status: 'active',
      prefix: '',
      firstName: '',
      lastName: '',
      email: '',
      tel: '',
      licenseNumber: '',
      pin: ''
    });
    setPasswordInput('');
    setStatusMessage(null);
    setMode('create');
  };

  if ((mode === 'edit' || mode === 'create') && editingUser) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {/* Header for Edit/Create Mode */}
        <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMode('list')}
              className="p-2.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">
                {mode === 'create' ? 'USER SETTING / CREATE NEW STAFF' : 'USER SETTING / EDIT STAFF'}
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {mode === 'create' ? 'เพิ่มสมาชิกรวมถึงสร้าง User ใน Firebase Authentication' : 'แก้ไขข้อมูลสิทธิ์การใช้งานและรหัสผ่านบุคลากร'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMode('list')}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={mode === 'create' ? handleCreateUser : handleUpdate}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#00b4d8] text-white rounded-xl font-bold text-sm hover:bg-[#0096c7] active:scale-95 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'กำลังดำเนินการ...' : mode === 'create' ? 'Create Staff User' : 'Update Staff'}
            </button>
          </div>
        </div>

        {/* Status Alert Messages */}
        {statusMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-center gap-3 p-4 rounded-2xl text-sm font-bold border shadow-xs",
              statusMessage.type === 'success' 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : "bg-rose-50 border-rose-200 text-rose-800"
            )}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </motion.div>
        )}

        {/* Form Container */}
        <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-8 space-y-8">
          {/* User Banner Header */}
          <div className="flex items-center gap-4 p-6 bg-slate-50/80 rounded-2xl border border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center border border-slate-200 shadow-xs shrink-0">
              <User className="w-8 h-8 text-[#00b4d8]" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-slate-800">
                {editingUser.firstName || editingUser.lastName 
                  ? `${editingUser.prefix || ''} ${editingUser.firstName || ''} ${editingUser.lastName || ''}` 
                  : (editingUser.name || 'Staff Member')}
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {editingUser.email || 'ยังไม่ได้ระบุอีเมล'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Role Selection */}
            <div className="space-y-4">
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">SYSTEM ROLE (สิทธิ์การใช้งาน)</label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'admin', label: 'Administrator', desc: 'Full access to all settings and data', icon: Shield, color: 'text-rose-500', bg: 'bg-rose-50' },
                  { id: 'doctor', label: 'Veterinarian', desc: 'Access to medical records and OPD/IPD', icon: Stethoscope, color: 'text-[#00b4d8]', bg: 'bg-cyan-50' },
                  { id: 'staff', label: 'Staff Member', desc: 'Access to POS, Inventory and Appointments', icon: Users, color: 'text-slate-500', bg: 'bg-slate-50' }
                ].map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setEditingUser({...editingUser, role: role.id as any})}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left cursor-pointer",
                      editingUser.role === role.id 
                        ? "border-[#00b4d8] bg-cyan-50/40 shadow-xs" 
                        : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className={cn("p-2.5 rounded-xl", role.bg)}>
                      <role.icon className={cn("w-5 h-5", role.color)} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-sm">{role.label}</p>
                      <p className="text-xs text-slate-400 font-medium">{role.desc}</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      editingUser.role === role.id ? "border-[#00b4d8]" : "border-slate-200"
                    )}>
                      {editingUser.role === role.id && <div className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Personal Info & Password Settings */}
            <div className="space-y-5">
              {/* Email Input */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">อีเมลเข้าใช้งาน (Account Email)</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input 
                    type="email"
                    disabled={mode === 'edit'}
                    placeholder="example@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  />
                </div>
              </div>

              {/* Password Input (8 digits / characters) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase">
                    รหัสผ่าน 8 หลัก (Password 8+ chars)
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold">ใช้สร้าง/ล็อกอินใน Firebase Auth</span>
                </div>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input 
                    type="text"
                    minLength={8}
                    placeholder="กำหนดรหัสผ่าน 8 ตัวอักษรขึ้นไป"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm font-mono"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Name Details */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">คำนำหน้า</label>
                  <input 
                    type="text"
                    placeholder="น.สพ. / สพ.ญ."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm"
                    value={editingUser.prefix || ''}
                    onChange={(e) => setEditingUser({...editingUser, prefix: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">ชื่อ</label>
                  <input 
                    type="text"
                    placeholder="ชื่อจริง"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm"
                    value={editingUser.firstName || ''}
                    onChange={(e) => setEditingUser({...editingUser, firstName: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">นามสกุล</label>
                <input 
                  type="text"
                  placeholder="นามสกุล"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm"
                  value={editingUser.lastName || ''}
                  onChange={(e) => setEditingUser({...editingUser, lastName: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">เลขที่ใบประกอบวิชาชีพ</label>
                <input 
                  type="text"
                  placeholder="เช่น ก.ส. 12345"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm"
                  value={editingUser.licenseNumber || ''}
                  onChange={(e) => setEditingUser({...editingUser, licenseNumber: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">เบอร์โทร</label>
                  <input 
                    type="tel"
                    placeholder="08X-XXX-XXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm"
                    value={editingUser.tel || ''}
                    onChange={(e) => setEditingUser({...editingUser, tel: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">PIN (4 หลัก)</label>
                  <input 
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm tracking-widest font-mono"
                    value={editingUser.pin || ''}
                    onChange={(e) => setEditingUser({...editingUser, pin: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-2">STATUS (สถานะผู้ใช้)</label>
                <div className="flex gap-3">
                  {['active', 'inactive'].map((st) => (
                    <button 
                      key={st}
                      type="button"
                      onClick={() => setEditingUser({...editingUser, status: st as any})}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl border-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer",
                        editingUser.status === st 
                          ? "border-[#00b4d8] bg-cyan-50 text-[#00b4d8]" 
                          : "border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header for List Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">USER SETTING MANAGEMENT</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">จัดการสิทธิ์การเข้าใช้งาน รหัสผ่าน 8 หลัก และข้อมูลบุคลากรในระบบ</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-bold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
            {users.length} Registered Users
          </span>

          <button
            type="button"
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00b4d8] text-white rounded-xl font-bold text-xs hover:bg-[#0096c7] active:scale-95 transition-all shadow-md shadow-cyan-500/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>สร้างบุคลากรใหม่ (Create Staff)</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider text-center w-16 text-[10px]">No.</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider text-[10px]">Name</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider text-[10px]">Email (Login)</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider text-center text-[10px]">Role</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider text-[10px]">License No.</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider text-center text-[10px]">Password (8 chars)</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider text-center text-[10px]">Status</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider text-center text-[10px]">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-slate-400 font-semibold">กำลังโหลดข้อมูลบุคลากร...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-50">
                      <Users className="w-12 h-12 text-slate-300" />
                      <p className="text-sm font-bold text-slate-500">ยังไม่มีรายชื่อบุคลากรในระบบ</p>
                      <button
                        onClick={startCreate}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs"
                      >
                        + เพิ่มผู้ใช้งานแรก
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((usr, index) => (
                  <tr key={usr.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 text-center font-bold text-slate-400 text-xs">{index + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-slate-800 text-sm">{usr.name}</div>
                      <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-0.5">
                        {usr.prefix} {usr.firstName} {usr.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-semibold text-xs">{usr.email}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-block",
                        usr.role === 'admin' ? "bg-rose-100 text-rose-700" :
                        usr.role === 'doctor' ? "bg-cyan-100 text-[#00838f]" :
                        "bg-slate-100 text-slate-600"
                      )}>
                        {usr.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs">{usr.licenseNumber || '-'}</td>
                    <td className="px-6 py-4 text-center font-mono text-xs text-slate-500">
                      {usr.password ? '••••••••' : <span className="text-slate-300 italic">ไม่ได้ระบุ</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-block",
                        usr.status === 'active' 
                          ? "bg-emerald-100 text-emerald-700" 
                          : "bg-slate-100 text-slate-400"
                      )}>
                        {usr.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => startEdit(usr)}
                        className="p-2 hover:bg-cyan-50 rounded-xl text-slate-400 hover:text-[#00b4d8] transition-all cursor-pointer"
                        title="แก้ไขข้อมูลบุคลากร"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
