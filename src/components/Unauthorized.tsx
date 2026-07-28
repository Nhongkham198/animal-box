import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Home, LogOut } from 'lucide-react';
import { auth, signOut } from '../firebase';

export default function Unauthorized() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mb-6">
        <ShieldAlert className="w-10 h-10" />
      </div>

      <span className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-black rounded-full uppercase tracking-wider mb-2">
        403 - Access Denied
      </span>

      <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-3 tracking-tight">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </h1>

      <p className="text-slate-500 text-sm max-w-md mb-8 leading-relaxed">
        บัญชีของคุณยังไม่ได้รับการอนุมัติสิทธิ์สัตวแพทย์/เจ้าหน้าที่ หรือสิทธิ์การใช้งานของคุณไม่เพียงพอในการเข้าถึงส่วนนี้
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-2.5 bg-[#00b4d8] hover:bg-[#0096b4] text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-cyan-100 flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          กลับหน้าหลัก
        </button>

        <button
          onClick={handleSignOut}
          className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all border border-rose-200 flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
