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
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  db, 
  collection, 
  onSnapshot, 
  updateDoc, 
  doc, 
  query, 
  orderBy,
  handleFirestoreError,
  OperationType
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
  status?: 'active' | 'inactive';
}

export default function Veterinarian() {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [editingUser, setEditingUser] = useState<Partial<StaffUser> | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleUpdate = async () => {
    if (!editingUser?.id) return;
    try {
      const { id, ...updateData } = editingUser;
      await updateDoc(doc(db, 'users', id), updateData).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
      });
      setMode('list');
      setEditingUser(null);
    } catch (error) {
      throwError(error);
    }
  };

  const startEdit = (user: StaffUser) => {
    setEditingUser({ ...user });
    setMode('edit');
  };

  if (mode === 'edit' && editingUser) {
    return (
      <div className="space-y-6">
        {/* Header for Edit Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMode('list')}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">User Setting / Edit Staff</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMode('list')}
              className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleUpdate}
              className="px-6 py-2 bg-[#00b4d8] text-white rounded-lg font-bold hover:bg-[#0096b1] transition-all shadow-lg shadow-cyan-100"
            >
              Update
            </button>
          </div>
        </div>

        {/* Form Container */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 space-y-8">
            <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-2xl">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                <User className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800">{editingUser.name}</h2>
                <p className="text-sm text-slate-500">{editingUser.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Role Selection */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">System Role (สิทธิ์การใช้งาน)</label>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'admin', label: 'Administrator', icon: Shield, color: 'text-red-500', bg: 'bg-red-50' },
                    { id: 'doctor', label: 'Veterinarian', icon: Stethoscope, color: 'text-[#00b4d8]', bg: 'bg-cyan-50' },
                    { id: 'staff', label: 'Staff Member', icon: Users, color: 'text-slate-500', bg: 'bg-slate-50' }
                  ].map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setEditingUser({...editingUser, role: role.id as any})}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                        editingUser.role === role.id 
                          ? "border-[#00b4d8] bg-cyan-50/50" 
                          : "border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <div className={cn("p-2 rounded-lg", role.bg)}>
                        <role.icon className={cn("w-5 h-5", role.color)} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">{role.label}</p>
                        <p className="text-xs text-slate-500">
                          {role.id === 'admin' && 'Full access to all settings and data'}
                          {role.id === 'doctor' && 'Access to medical records and OPD/IPD'}
                          {role.id === 'staff' && 'Access to POS, Inventory and Appointments'}
                        </p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        editingUser.role === role.id ? "border-[#00b4d8]" : "border-slate-200"
                      )}>
                        {editingUser.role === role.id && <div className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal Info */}
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">คำนำหน้า</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                      value={editingUser.prefix || ''}
                      onChange={(e) => setEditingUser({...editingUser, prefix: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">ชื่อ</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                      value={editingUser.firstName || ''}
                      onChange={(e) => setEditingUser({...editingUser, firstName: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">นามสกุล</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                    value={editingUser.lastName || ''}
                    onChange={(e) => setEditingUser({...editingUser, lastName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">เลขที่ใบประกอบวิชาชีพ</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                    value={editingUser.licenseNumber || ''}
                    onChange={(e) => setEditingUser({...editingUser, licenseNumber: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">เบอร์โทร</label>
                  <input 
                    type="tel"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                    value={editingUser.tel || ''}
                    onChange={(e) => setEditingUser({...editingUser, tel: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">PIN (4 หลัก)</label>
                  <input 
                    type="password"
                    maxLength={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00b4d8] outline-none"
                    value={editingUser.pin || ''}
                    onChange={(e) => setEditingUser({...editingUser, pin: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-4">Status</label>
                  <div className="flex gap-4">
                    {['active', 'inactive'].map((status) => (
                      <button 
                        key={status}
                        type="button"
                        onClick={() => setEditingUser({...editingUser, status: status as any})}
                        className={cn(
                          "flex-1 py-3 rounded-xl border-2 font-bold capitalize transition-all",
                          editingUser.status === status 
                            ? "border-[#00b4d8] bg-cyan-50 text-[#00b4d8]" 
                            : "border-slate-100 text-slate-400"
                        )}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header for List Mode */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">User Setting Management</h1>
        <div className="text-sm text-slate-400 font-bold">
          {users.length} Registered Users
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center w-16">No.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Role</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">License No.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400">Loading staff data...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                      <img 
                        src="https://illustrations.popsy.co/amber/medical-care.svg" 
                        alt="No Staff"
                        className="w-48 h-48 mb-4"
                        referrerPolicy="no-referrer"
                      />
                      <p className="text-lg font-bold text-slate-500">No staff members found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center font-medium text-slate-500">{index + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700">{user.name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        {user.prefix} {user.firstName} {user.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.email}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        user.role === 'admin' ? "bg-red-100 text-red-600" :
                        user.role === 'doctor' ? "bg-cyan-100 text-[#00b4d8]" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.licenseNumber || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        user.status === 'active' 
                          ? "bg-green-100 text-green-600" 
                          : "bg-slate-100 text-slate-500"
                      )}>
                        {user.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => startEdit(user)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#00b4d8] transition-all"
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

