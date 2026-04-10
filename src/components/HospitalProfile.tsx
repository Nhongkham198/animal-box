import React, { useState } from 'react';
import { 
  Edit2, 
  QrCode, 
  MapPin, 
  Globe, 
  Facebook, 
  Instagram, 
  MessageCircle,
  CreditCard,
  Award,
  ExternalLink,
  Save,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useClinic } from '../contexts/ClinicContext';
import { useAuth } from '../contexts/AuthContext';

export default function HospitalProfile() {
  const { clinicName, setClinicName, clinicAddress, setClinicAddress, clinicPhone, setClinicPhone } = useClinic();
  const { user, isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: clinicName,
    address: clinicAddress,
    phone: clinicPhone
  });

  const handleSave = () => {
    setClinicName(editData.name);
    setClinicAddress(editData.address);
    setClinicPhone(editData.phone);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Hospital Profile</h1>
        {isAdmin && (
          <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all shadow-lg",
              isEditing 
                ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100" 
                : "bg-[#00b4d8] text-white hover:bg-[#0096b1] shadow-cyan-100"
            )}
          >
            {isEditing ? (
              <><Save className="w-4 h-4" /> Save Changes</>
            ) : (
              <><Edit2 className="w-4 h-4" /> Edit Profile</>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-full border-4 border-slate-50 bg-slate-100 flex items-center justify-center mb-4 overflow-hidden">
                <img 
                  src="https://illustrations.popsy.co/amber/medical-care.svg" 
                  alt="Hospital Logo" 
                  className="w-full h-full object-contain p-4"
                  referrerPolicy="no-referrer"
                />
              </div>
              {isEditing ? (
                <input 
                  className="text-xl font-black text-slate-900 mb-6 w-full text-center border-b-2 border-indigo-500 focus:outline-none"
                  value={editData.name}
                  onChange={e => setEditData({...editData, name: e.target.value})}
                />
              ) : (
                <h2 className="text-xl font-black text-slate-900 mb-6">{clinicName}</h2>
              )}
              <button className="w-full flex items-center justify-center gap-2 py-3 bg-[#00b4d8] text-white rounded-xl font-bold hover:bg-[#0096b1] transition-all shadow-md">
                <QrCode className="w-5 h-5" />
                Print QR Code
              </button>
            </div>
            
            <div className="px-8 pb-8 space-y-4">
              <div className="border-t border-slate-50 pt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hospital ID</p>
                <p className="font-bold text-slate-700">878</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Username</p>
                <p className="font-bold text-slate-700">{user?.email}</p>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-slate-400 hover:text-[#00b4d8] cursor-pointer transition-colors">
                  <Globe className="w-4 h-4" />
                  <span className="text-sm font-medium">Website</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 hover:text-[#00b4d8] cursor-pointer transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Line ID</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 hover:text-[#00b4d8] cursor-pointer transition-colors">
                  <Facebook className="w-4 h-4" />
                  <span className="text-sm font-medium">Facebook</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 hover:text-[#00b4d8] cursor-pointer transition-colors">
                  <Instagram className="w-4 h-4" />
                  <span className="text-sm font-medium">Instagram</span>
                </div>
              </div>
            </div>
          </div>

          {/* Prefix Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <h3 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-wider">Prefix username</h3>
            <p className="text-2xl font-bold text-slate-700 mb-2">-</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              ตั้งค่าคำนำหน้า Username Staff ที่ใช้งานโรงพยาบาลนี้ คำนำหน้าจะไม่ซ้ำกันในระบบ VRemind
            </p>
          </div>

          {/* Plan Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <h3 className="text-sm font-black text-slate-900 mb-6 uppercase tracking-wider">Plan/Credit</h3>
            <div className="space-y-4 mb-8">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Plan</p>
                <p className="font-black text-slate-900">Free</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Credit Available</p>
                <p className="font-black text-slate-900">0 Credits</p>
              </div>
            </div>
            <button className="w-full py-3 bg-[#00b4d8] text-white rounded-xl font-bold hover:bg-[#0096b1] transition-all shadow-md">
              Hospital Profile iTaam
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <h2 className="text-xl font-black text-slate-900 mb-8">รายละเอียดสถานพยาบาล</h2>
            
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 mb-2">อีเมล์ของสถานพยาบาลสำหรับลูกค้า</p>
                <p className="font-bold text-slate-700">ixohoxi_s@hotmail.com</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 mb-2">เบอร์ติดต่อสถานพยาบาลสำหรับลูกค้า</p>
                {isEditing ? (
                  <input 
                    className="w-full bg-slate-50 border-none rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                    value={editData.phone}
                    onChange={e => setEditData({...editData, phone: e.target.value})}
                  />
                ) : (
                  <p className={cn("font-bold", clinicPhone ? "text-slate-700" : "text-slate-300 italic")}>
                    {clinicPhone || "ไม่ได้ระบุ"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 mb-2">เวลาทำการ</p>
                <p className="font-bold text-slate-300 italic">ไม่ได้ระบุ</p>
              </div>

              <div className="pt-4">
                <h3 className="text-lg font-black text-slate-900 mb-4">Map</h3>
                <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 relative group">
                  <img 
                    src="https://illustrations.popsy.co/amber/map.svg" 
                    alt="Map Placeholder" 
                    className="w-full h-full object-contain p-8 opacity-40"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/5 group-hover:bg-transparent transition-all">
                    <div className="bg-white p-3 rounded-full shadow-xl">
                      <MapPin className="w-6 h-6 text-red-500" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-lg font-black text-slate-900 mb-4">Address</h3>
                {isEditing ? (
                  <textarea 
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                    rows={3}
                    value={editData.address}
                    onChange={e => setEditData({...editData, address: e.target.value})}
                  />
                ) : (
                  <p className={cn("font-bold", clinicAddress ? "text-slate-700" : "text-slate-300 italic")}>
                    {clinicAddress || "ไม่ได้ระบุ"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Customer Tier Settings */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
              <h3 className="text-sm font-black text-slate-600">ตั้งค่ากลุ่มลูกค้า ตามค่าใช้จ่ายยอดรวมต่อปี ของเจ้าของสัตว์ และ สัตว์เลี้ยง</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6 font-bold text-slate-700 text-right w-1/4">No Tag</td>
                    <td className="p-6 text-slate-500">ช่วงการใช้จ่าย <span className="mx-2">น้อยกว่าเท่ากับ</span></td>
                    <td className="p-6">
                      <div className="flex items-center gap-4 justify-end">
                        <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-32 text-center">300</div>
                        <span className="font-black text-slate-900">THB</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6 font-bold text-slate-700">
                      <div className="flex items-center gap-3 justify-end">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                          <Award className="w-4 h-4 text-amber-600" />
                        </div>
                        Bronze
                      </div>
                    </td>
                    <td className="p-6 text-slate-500">ช่วงการใช้จ่าย <span className="mx-2">มากกว่า</span></td>
                    <td className="p-6">
                      <div className="flex items-center gap-4 justify-end">
                        <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-24 text-center">300</div>
                        <span className="text-slate-400">น้อยกว่าเท่ากับ</span>
                        <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-24 text-center">2000</div>
                        <span className="font-black text-slate-900">THB</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6 font-bold text-slate-700">
                      <div className="flex items-center gap-3 justify-end">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                          <Award className="w-4 h-4 text-slate-400" />
                        </div>
                        Silver
                      </div>
                    </td>
                    <td className="p-6 text-slate-500">ช่วงการใช้จ่าย <span className="mx-2">มากกว่า</span></td>
                    <td className="p-6">
                      <div className="flex items-center gap-4 justify-end">
                        <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-24 text-center">2000</div>
                        <span className="text-slate-400">น้อยกว่าเท่ากับ</span>
                        <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-24 text-center">6000</div>
                        <span className="font-black text-slate-900">THB</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6 font-bold text-slate-700">
                      <div className="flex items-center gap-3 justify-end">
                        <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Award className="w-4 h-4 text-yellow-600" />
                        </div>
                        Gold
                      </div>
                    </td>
                    <td className="p-6 text-slate-500">ช่วงการใช้จ่าย <span className="mx-2">มากกว่า</span></td>
                    <td className="p-6">
                      <div className="flex items-center gap-4 justify-end">
                        <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-32 text-center">6000</div>
                        <span className="font-black text-slate-900">THB</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
