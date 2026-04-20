import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ClinicContextType {
  clinicName: string;
  setClinicName: (name: string) => void;
  clinicAddress: string;
  setClinicAddress: (address: string) => void;
  clinicPhone: string;
  setClinicPhone: (phone: string) => void;
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
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const value = {
    clinicName,
    setClinicName,
    clinicAddress,
    setClinicAddress,
    clinicPhone,
    setClinicPhone,
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
