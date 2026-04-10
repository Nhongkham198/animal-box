import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ClinicContextType {
  clinicName: string;
  setClinicName: (name: string) => void;
  clinicAddress: string;
  setClinicAddress: (address: string) => void;
  clinicPhone: string;
  setClinicPhone: (phone: string) => void;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [clinicName, setClinicName] = useState('Animal Box');
  const [clinicAddress, setClinicAddress] = useState('123 Clinic St, Bangkok, Thailand');
  const [clinicPhone, setClinicPhone] = useState('02-123-4567');

  const value = {
    clinicName,
    setClinicName,
    clinicAddress,
    setClinicAddress,
    clinicPhone,
    setClinicPhone,
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
