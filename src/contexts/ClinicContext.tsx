import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { db, doc, onSnapshot, setDoc, serverTimestamp } from '../firebase';

interface ClinicContextType {
  clinicName: string;
  setClinicName: (name: string) => void;
  clinicAddress: string;
  setClinicAddress: (address: string) => void;
  clinicPhone: string;
  setClinicPhone: (phone: string) => void;
  clinicSupportEmail: string;
  setClinicSupportEmail: (email: string) => void;
  clinicHours: string;
  setClinicHours: (hours: string) => void;
  hospitalId: string;
  setHospitalId: (id: string) => void;
  website: string;
  setWebsite: (url: string) => void;
  lineId: string;
  setLineId: (id: string) => void;
  facebook: string;
  setFacebook: (url: string) => void;
  instagram: string;
  setInstagram: (url: string) => void;
  prefixUsername: string;
  setPrefixUsername: (prefix: string) => void;
  noTagMax: number;
  setNoTagMax: (value: number) => void;
  bronzeMax: number;
  setBronzeMax: (value: number) => void;
  silverMax: number;
  setSilverMax: (value: number) => void;
  clinicMapQuery: string;
  setClinicMapQuery: (query: string) => void;
  quotaExceeded: boolean;
  setQuotaExceeded: (exceeded: boolean) => void;
  saveClinicSettings: (data: Partial<ClinicContextType>) => Promise<void>;
  loading: boolean;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [clinicName, setClinicName] = useState('คลินิกรักษาสัตว์แอนนิมอลบ็อกซ์ กาฬสินธุ์');
  const [clinicAddress, setClinicAddress] = useState('5, 7 -9 Tha Sin Kha Alley, Mueang Kalasin District, Kalasin 46000, Thailand');
  const [clinicPhone, setClinicPhone] = useState('093-945-1539');
  const [clinicMapQuery, setClinicMapQuery] = useState('คลินิกรักษาสัตว์แอนนิมอลบ็อกซ์ กาฬสินธุ์');
  const [clinicSupportEmail, setClinicSupportEmail] = useState('ixohoxi_s@hotmail.com');
  const [clinicHours, setClinicHours] = useState('');
  const [hospitalId, setHospitalId] = useState('878');
  const [website, setWebsite] = useState('');
  const [lineId, setLineId] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [prefixUsername, setPrefixUsername] = useState('-');
  const [noTagMax, setNoTagMax] = useState(300);
  const [bronzeMax, setBronzeMax] = useState(2000);
  const [silverMax, setSilverMax] = useState(6000);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'clinic_profile'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.clinicName) setClinicName(data.clinicName);
        if (data.clinicAddress) setClinicAddress(data.clinicAddress);
        if (data.clinicPhone) setClinicPhone(data.clinicPhone);
        if (data.clinicSupportEmail) setClinicSupportEmail(data.clinicSupportEmail);
        if (data.clinicHours) setClinicHours(data.clinicHours);
        if (data.hospitalId) setHospitalId(data.hospitalId);
        if (data.website) setWebsite(data.website);
        if (data.lineId) setLineId(data.lineId);
        if (data.facebook) setFacebook(data.facebook);
        if (data.instagram) setInstagram(data.instagram);
        if (data.prefixUsername) setPrefixUsername(data.prefixUsername);
        if (data.noTagMax !== undefined) setNoTagMax(data.noTagMax);
        if (data.bronzeMax !== undefined) setBronzeMax(data.bronzeMax);
        if (data.silverMax !== undefined) setSilverMax(data.silverMax);
        if (data.clinicMapQuery) setClinicMapQuery(data.clinicMapQuery);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const saveClinicSettings = async (data: any) => {
    try {
      await setDoc(doc(db, 'settings', 'clinic_profile'), {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Error saving clinic settings:", err);
      throw err;
    }
  };

  const value = {
    clinicName,
    setClinicName,
    clinicAddress,
    setClinicAddress,
    clinicPhone,
    setClinicPhone,
    clinicSupportEmail,
    setClinicSupportEmail,
    clinicHours,
    setClinicHours,
    hospitalId,
    setHospitalId,
    website,
    setWebsite,
    lineId,
    setLineId,
    facebook,
    setFacebook,
    instagram,
    setInstagram,
    prefixUsername,
    setPrefixUsername,
    noTagMax,
    setNoTagMax,
    bronzeMax,
    setBronzeMax,
    silverMax,
    setSilverMax,
    clinicMapQuery,
    setClinicMapQuery,
    quotaExceeded,
    setQuotaExceeded,
    saveClinicSettings,
    loading
  };

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (context === undefined) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
}
