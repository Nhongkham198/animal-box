export type ViewId = 
  | 'dashboard' 
  | 'appointments' | 'calendar' | 'add-appointment'
  | 'patients' | 'search-microchip' | 'add-pet' | 'patient-detail'
  | 'opd' | 'add-opd'
  | 'ipd' | 'add-ipd'
  | 'finance' | 'public-booking'
  | 'inventory' | 'pos' | 'analytics' | 'public-form'
  | 'settings-hospital' | 'settings-vet' | 'settings-contact' | 'settings-activities' | 'settings-reward' | 'settings-product' | 'settings-usage' | 'settings-payment' | 'settings-printer' | 'settings-diagram';

export const VIEW_TO_PATH_MAP: Record<ViewId, string> = {
  'dashboard': '/dashboard',
  'appointments': '/appointments',
  'calendar': '/appointments/calendar',
  'add-appointment': '/appointments/add',
  'patients': '/patients',
  'search-microchip': '/patients/microchip',
  'add-pet': '/patients/add',
  'patient-detail': '/patients/detail',
  'opd': '/opd',
  'add-opd': '/opd/add',
  'ipd': '/ipd',
  'add-ipd': '/ipd/add',
  'finance': '/finance',
  'public-booking': '/booking-requests',
  'inventory': '/inventory',
  'pos': '/pos',
  'analytics': '/analytics',
  'public-form': '/public-booking-form',
  'settings-hospital': '/settings/hospital',
  'settings-vet': '/settings/user',
  'settings-contact': '/settings/contact',
  'settings-activities': '/settings/activities',
  'settings-reward': '/settings/reward',
  'settings-product': '/settings/product',
  'settings-usage': '/settings/room-rates',
  'settings-payment': '/settings/payment-methods',
  'settings-printer': '/settings/printer',
  'settings-diagram': '/settings/diagram',
};

export const VIEW_LABELS: Record<string, { title: string; category?: string; parentPath?: string }> = {
  '/dashboard': { title: 'Dashboard', category: 'Home' },
  '/appointments': { title: 'Appointment List', category: 'Appointment', parentPath: '/appointments' },
  '/appointments/calendar': { title: 'Calendar', category: 'Appointment', parentPath: '/appointments' },
  '/appointments/add': { title: 'Add Appointment', category: 'Appointment', parentPath: '/appointments' },
  '/patients': { title: 'Pet Profile List', category: 'Pet Profile', parentPath: '/patients' },
  '/patients/microchip': { title: 'Search From Microchip', category: 'Pet Profile', parentPath: '/patients' },
  '/patients/add': { title: 'Add New Pet', category: 'Pet Profile', parentPath: '/patients' },
  '/opd': { title: 'OPD List', category: 'OPD', parentPath: '/opd' },
  '/ipd': { title: 'IPD List', category: 'IPD', parentPath: '/ipd' },
  '/finance': { title: 'Finance', category: 'Finance' },
  '/booking-requests': { title: 'Booking Requests', category: 'Booking' },
  '/inventory': { title: 'Inventory', category: 'Inventory' },
  '/pos': { title: 'POS / Billing', category: 'POS' },
  '/analytics': { title: 'Analytics', category: 'Analytics' },
  '/settings/hospital': { title: 'Hospital Profile', category: 'Settings', parentPath: '/settings/hospital' },
  '/settings/user': { title: 'User Setting', category: 'Settings', parentPath: '/settings/hospital' },
  '/settings/contact': { title: 'Contact Setting', category: 'Settings', parentPath: '/settings/hospital' },
  '/settings/activities': { title: 'Activities Setting', category: 'Settings', parentPath: '/settings/hospital' },
  '/settings/reward': { title: 'Reward Setting', category: 'Settings', parentPath: '/settings/hospital' },
  '/settings/product': { title: 'Product Setting', category: 'Settings', parentPath: '/settings/hospital' },
  '/settings/room-rates': { title: 'ตั้งค่าราคาห้องพักสัตว์เลี้ยง', category: 'Settings', parentPath: '/settings/hospital' },
  '/settings/payment-methods': { title: 'Payment Method Setting', category: 'Settings', parentPath: '/settings/hospital' },
  '/settings/printer': { title: 'Printer Setting', category: 'Settings', parentPath: '/settings/hospital' },
  '/settings/diagram': { title: 'ตั้งค่าภาพกายวิภาคสัตว์', category: 'Settings', parentPath: '/settings/hospital' },
};

export const PATH_TO_VIEW_MAP: Record<string, ViewId> = Object.entries(VIEW_TO_PATH_MAP).reduce((acc, [view, path]) => {
  acc[path] = view as ViewId;
  return acc;
}, {} as Record<string, ViewId>);

PATH_TO_VIEW_MAP['/'] = 'dashboard';

export function getViewFromPath(pathname: string): ViewId {
  const cleanPath = pathname.replace(/\/$/, '') || '/';
  if (PATH_TO_VIEW_MAP[cleanPath]) {
    return PATH_TO_VIEW_MAP[cleanPath];
  }
  
  // Handle wildcards or parameterized paths
  if (cleanPath.startsWith('/patients')) {
    return 'patients';
  }
  if (cleanPath.startsWith('/appointments')) {
    return 'appointments';
  }
  if (cleanPath.startsWith('/opd')) {
    return 'opd';
  }
  if (cleanPath.startsWith('/ipd')) {
    return 'ipd';
  }
  if (cleanPath.startsWith('/settings')) {
    return 'settings-hospital';
  }
  return 'dashboard';
}

export function getPathFromView(view: ViewId | string): string {
  return VIEW_TO_PATH_MAP[view as ViewId] || '/dashboard';
}
