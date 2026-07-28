import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-slate-100 shadow-sm my-auto">
      <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 mb-6 shadow-inner">
        <FileQuestion className="w-10 h-10" />
      </div>
      
      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-black rounded-full uppercase tracking-wider mb-2">
        404 - Not Found
      </span>

      <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-3 tracking-tight">
        ไม่พบหน้าที่คุณต้องการ
      </h1>

      <p className="text-slate-500 text-sm max-w-md mb-8 leading-relaxed">
        ลิงก์ที่คุณเปิดอาจไม่ถูกต้อง ถูกย้าย หรือไม่มีอยู่ในระบบ กรุณาตรวจสอบ URL หรือกลับไปยังหน้าหลัก
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border border-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          ย้อนกลับ
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-2.5 bg-[#00b4d8] hover:bg-[#0096b4] text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-cyan-100 flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          กลับหน้าหลัก Dashboard
        </button>
      </div>
    </div>
  );
}
