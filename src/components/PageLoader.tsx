import React from 'react';

export default function PageLoader() {
  return (
    <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-12 text-slate-400 animate-in fade-in duration-300">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-12 h-12 border-4 border-[#00b4d8]/20 border-t-[#00b4d8] rounded-full animate-spin" />
        <div className="absolute w-6 h-6 bg-[#00b4d8]/10 rounded-full animate-ping" />
      </div>
      <p className="text-sm font-bold text-slate-600 animate-pulse">กำลังโหลดข้อมูลหน้า...</p>
    </div>
  );
}
