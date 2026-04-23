import React, { createContext, useContext, useState, ReactNode } from 'react';

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
