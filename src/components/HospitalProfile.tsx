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
  X,
  Sparkles,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useClinic } from '../contexts/ClinicContext';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function HospitalProfile() {
  const { 
    clinicName,
    clinicAddress,
    clinicPhone,
    clinicSupportEmail,
    clinicHours,
    hospitalId,
    website,
    lineId,
    facebook,
    instagram,
    clinicLogo,
    prefixUsername,
    noTagMax,
    bronzeMax,
    silverMax,
    clinicMapQuery,
    saveClinicSettings,
    loading: isClinicLoading
  } = useClinic();
  const { user, isAdmin } = useAuth();
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isFindingAddress, setIsFindingAddress] = React.useState(false);
  const [editData, setEditData] = React.useState({
    name: clinicName,
    address: clinicAddress,
    phone: clinicPhone,
    supportEmail: clinicSupportEmail,
    hours: clinicHours,
    id: hospitalId,
    website: website,
    lineId: lineId,
    facebook: facebook,
    instagram: instagram,
    logo: clinicLogo,
    noTagMax: noTagMax,
    bronzeMax: bronzeMax,
    silverMax: silverMax,
    mapQuery: clinicMapQuery
  });

  // Sync editData with context when not editing
  React.useEffect(() => {
    if (!isEditing) {
      setEditData({
        name: clinicName,
        address: clinicAddress,
        phone: clinicPhone,
        supportEmail: clinicSupportEmail,
        hours: clinicHours,
        id: hospitalId,
        website: website,
        lineId: lineId,
        facebook: facebook,
        instagram: instagram,
        logo: clinicLogo,
        noTagMax: noTagMax,
        bronzeMax: bronzeMax,
        silverMax: silverMax,
        mapQuery: clinicMapQuery
      });
    }
  }, [
    isEditing, clinicName, clinicAddress, clinicPhone, clinicSupportEmail, 
    clinicHours, hospitalId, website, lineId, facebook, instagram, clinicLogo,
    noTagMax, bronzeMax, silverMax, clinicMapQuery
  ]);

  const handleSmartSyncAddress = async () => {
    const query = editData.mapQuery || `${editData.name}`;
    if (!query || query.length < 3) {
      alert("โปรดระบุชื่อสถานที่ในช่อง Map Pin ก่อนค้นหา");
      return;
    }

    setIsFindingAddress(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `ค้นหาที่อยู่อย่างเป็นทางการของสถานพยาบาลหรือสถานที่นี้: "${query}" ให้ข้อมูลเฉพาะที่อยู่เต็มรูปแบบเพียงอย่างเดียว ห้ามมีคำนำหน้าหรือสรุปอื่นๆ`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const foundAddress = response.text?.trim();
      if (foundAddress) {
        setEditData(prev => ({ ...prev, address: foundAddress }));
      } else {
        alert("ไม่พบข้อมูลที่อยู่ โปรดลองระบุชื่อให้ชัดเจนกว่านี้");
      }
    } catch (err) {
      console.error("Gemini Search Error:", err);
      alert("เกิดข้อผิดพลาดในการค้นหาข้อมูลที่อยู่");
    } finally {
      setIsFindingAddress(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveClinicSettings({
        clinicName: editData.name,
        clinicAddress: editData.address,
        clinicPhone: editData.phone,
        clinicSupportEmail: editData.supportEmail,
        clinicHours: editData.hours,
        hospitalId: editData.id,
        website: editData.website,
        lineId: editData.lineId,
        facebook: editData.facebook,
        instagram: editData.instagram,
        clinicLogo: editData.logo,
        noTagMax: Number(editData.noTagMax),
        bronzeMax: Number(editData.bronzeMax),
        silverMax: Number(editData.silverMax),
        clinicMapQuery: editData.mapQuery
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Save Error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSaving(false);
    }
  };

  // Construct the search query for Google Maps
  const effectiveMapQuery = clinicMapQuery || `${clinicName} ${clinicAddress}`;

  if (isClinicLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 text-[#00b4d8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Hospital Profile</h1>
        {isAdmin && (
          <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            disabled={isSaving}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all shadow-lg",
              isEditing 
                ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100" 
                : "bg-[#00b4d8] text-white hover:bg-[#0096b1] shadow-cyan-100",
              isSaving && "opacity-70 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : isEditing ? (
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
              <div 
                className={cn(
                  "w-32 h-32 rounded-full border-4 border-slate-50 bg-slate-100 flex items-center justify-center mb-4 overflow-hidden relative group",
                  isEditing && "cursor-pointer ring-2 ring-indigo-500 ring-offset-2"
                )}
              >
                <img 
                  src={isEditing ? editData.logo : clinicLogo} 
                  alt="Hospital Logo" 
                  className="w-full h-full object-contain p-2"
                  referrerPolicy="no-referrer"
                />
                {isEditing && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit2 className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
              
              {isEditing ? (
                <div className="w-full space-y-4 mb-6">
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Logo URL</p>
                    <input 
                      className="w-full bg-slate-50 border-none rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                      placeholder="https://example.com/logo.png"
                      value={editData.logo}
                      onChange={e => setEditData({...editData, logo: e.target.value})}
                    />
                  </div>
                  <input 
                    className="text-xl font-black text-slate-900 w-full text-center border-b-2 border-indigo-500 focus:outline-none bg-transparent"
                    value={editData.name}
                    onChange={e => setEditData({...editData, name: e.target.value})}
                  />
                </div>
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
                {isEditing ? (
                  <input 
                    className="font-bold text-slate-700 w-full border-b border-indigo-200 focus:outline-none"
                    value={editData.id}
                    onChange={e => setEditData({...editData, id: e.target.value})}
                  />
                ) : (
                  <p className="font-bold text-slate-700">{hospitalId}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Username</p>
                <p className="font-bold text-slate-700">{user?.email}</p>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-slate-400 hover:text-[#00b4d8] transition-colors">
                  <Globe className="w-4 h-4" />
                  {isEditing ? (
                    <input 
                      className="text-sm font-medium w-full border-b border-indigo-200 focus:outline-none"
                      placeholder="Website"
                      value={editData.website}
                      onChange={e => setEditData({...editData, website: e.target.value})}
                    />
                  ) : (
                    <span className={cn("text-sm font-medium", !website && "italic opacity-50")}>{website || "Website"}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-400 hover:text-[#00b4d8] transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  {isEditing ? (
                    <input 
                      className="text-sm font-medium w-full border-b border-indigo-200 focus:outline-none"
                      placeholder="Line ID"
                      value={editData.lineId}
                      onChange={e => setEditData({...editData, lineId: e.target.value})}
                    />
                  ) : (
                    <span className={cn("text-sm font-medium", !lineId && "italic opacity-50")}>{lineId || "Line ID"}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-400 hover:text-[#00b4d8] transition-colors">
                  <Facebook className="w-4 h-4" />
                  {isEditing ? (
                    <input 
                      className="text-sm font-medium w-full border-b border-indigo-200 focus:outline-none"
                      placeholder="Facebook"
                      value={editData.facebook}
                      onChange={e => setEditData({...editData, facebook: e.target.value})}
                    />
                  ) : (
                    <span className={cn("text-sm font-medium", !facebook && "italic opacity-50")}>{facebook || "Facebook"}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-400 hover:text-[#00b4d8] transition-colors">
                  <Instagram className="w-4 h-4" />
                  {isEditing ? (
                    <input 
                      className="text-sm font-medium w-full border-b border-indigo-200 focus:outline-none"
                      placeholder="Instagram"
                      value={editData.instagram}
                      onChange={e => setEditData({...editData, instagram: e.target.value})}
                    />
                  ) : (
                    <span className={cn("text-sm font-medium", !instagram && "italic opacity-50")}>{instagram || "Instagram"}</span>
                  )}
                </div>
              </div>
            </div>
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
                {isEditing ? (
                  <input 
                    className="w-full bg-slate-50 border-none rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                    value={editData.supportEmail}
                    onChange={e => setEditData({...editData, supportEmail: e.target.value})}
                  />
                ) : (
                  <p className="font-bold text-slate-700">{clinicSupportEmail}</p>
                )}
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
                {isEditing ? (
                  <input 
                    className="w-full bg-slate-50 border-none rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                    placeholder="เช่น : เปิดทุกวัน 08:00 - 20:00"
                    value={editData.hours}
                    onChange={e => setEditData({...editData, hours: e.target.value})}
                  />
                ) : (
                  <p className={cn("font-bold", clinicHours ? "text-slate-700" : "text-slate-300 italic")}>
                    {clinicHours || "ไม่ได้ระบุ"}
                  </p>
                )}
              </div>

              <div className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900 uppercase italic">Map Pin</h3>
                  {isEditing && (
                    <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded">
                      TIP: Copy exact Google Maps name or Plus Code
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Pin Location Search (Optional)</p>
                    <input 
                      className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 placeholder:text-slate-300"
                      placeholder="เช่น : คลินิกรักษาสัตว์แอนนิมอลบ็อกซ์ กาฬสินธุ์ หรือ Plus Code"
                      value={editData.mapQuery}
                      onChange={e => setEditData({...editData, mapQuery: e.target.value})}
                    />
                  </div>
                )}

                <div className="aspect-video bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 relative group shadow-inner">
                  {effectiveMapQuery ? (
                    <iframe
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      style={{ border: 0 }}
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(effectiveMapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      allowFullScreen
                      className="grayscale-[20%] contrast-[110%] opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                    ></iframe>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900">Address</h3>
                  {isEditing && (
                    <button
                      onClick={handleSmartSyncAddress}
                      disabled={isFindingAddress}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-50"
                    >
                      {isFindingAddress ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Sync from Pin
                    </button>
                  )}
                </div>
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
                        {isEditing ? (
                          <input 
                            type="number"
                            className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-indigo-600 w-32 text-center border-none focus:ring-2 focus:ring-indigo-500"
                            value={editData.noTagMax}
                            onChange={e => setEditData({...editData, noTagMax: Number(e.target.value)})}
                          />
                        ) : (
                          <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-32 text-center">{noTagMax}</div>
                        )}
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
                        <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-24 text-center">
                          {isEditing ? editData.noTagMax : noTagMax}
                        </div>
                        <span className="text-slate-400">น้อยกว่าเท่ากับ</span>
                        {isEditing ? (
                          <input 
                            type="number"
                            className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-indigo-600 w-24 text-center border-none focus:ring-2 focus:ring-indigo-500"
                            value={editData.bronzeMax}
                            onChange={e => setEditData({...editData, bronzeMax: Number(e.target.value)})}
                          />
                        ) : (
                          <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-24 text-center">{bronzeMax}</div>
                        )}
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
                        <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-24 text-center">
                          {isEditing ? editData.bronzeMax : bronzeMax}
                        </div>
                        <span className="text-slate-400">น้อยกว่าเท่ากับ</span>
                        {isEditing ? (
                          <input 
                            type="number"
                            className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-indigo-600 w-24 text-center border-none focus:ring-2 focus:ring-indigo-500"
                            value={editData.silverMax}
                            onChange={e => setEditData({...editData, silverMax: Number(e.target.value)})}
                          />
                        ) : (
                          <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-24 text-center">{silverMax}</div>
                        )}
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
                        <div className="px-4 py-2 bg-slate-50 rounded-lg font-bold text-slate-400 w-32 text-center">
                          {isEditing ? editData.silverMax : silverMax}
                        </div>
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
