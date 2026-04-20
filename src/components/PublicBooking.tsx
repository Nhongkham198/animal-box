import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  User, 
  Phone, 
  PawPrint, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ExternalLink,
  Search,
  Filter,
  MessageSquare,
  Building2,
  Bed,
  CreditCard,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  handleFirestoreError,
  OperationType,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  setDoc,
  where,
  getDocs
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { useClinic } from '../contexts/ClinicContext';
import { cn } from '../lib/utils';
import { format, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface BookingRequest {
  id: string;
  ownerName: string;
  ownerPhone: string;
  petName: string;
  petSpecies: string;
  requestedDate: string;
  serviceType: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: any;
}

interface PetRoom {
  id: string;
  building: 'A' | 'B';
  floor: number;
  roomNumber: number;
  status: 'available' | 'occupied' | 'maintenance';
  pricePerNight: number;
}

interface RoomBooking {
  id: string;
  roomId: string;
  patientId: string;
  petName: string;
  ownerName: string;
  ownerPhone: string;
  checkIn: string;
  checkInTime: string;
  checkOut: string;
  checkOutTime: string;
  status: 'pending_payment' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  totalAmount: number;
  paidAmount: number;
  createdAt: any;
}

export default function PublicBooking() {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const { setQuotaExceeded } = useClinic();
  const [activeTab, setActiveTab] = useState<'requests' | 'condo'>('condo');
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [rooms, setRooms] = useState<PetRoom[]>([]);
  const [roomBookings, setRoomBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('pending');
  
  // Condo State
  const [selectedRoom, setSelectedRoom] = useState<PetRoom | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<RoomBooking>>({});

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) {
      if (isAuthReady && !isStaff) setLoading(false);
      return;
    }

    // Listener for Public Bookings
    const q = query(collection(db, 'public_bookings'), orderBy('createdAt', 'desc'));
    const unsubPublic = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookingRequest)));
    }, (err) => {
      if (err.message.includes('quota') || err.message.includes('resource-exhausted')) setQuotaExceeded(true);
    });

    // Listener for Pet Rooms
    const unsubRooms = onSnapshot(collection(db, 'pet_rooms'), (snap) => {
      if (snap.empty) {
        seedRooms();
      } else {
        setRooms(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PetRoom)));
      }
    }, (err) => {
      if (err.message.includes('quota') || err.message.includes('resource-exhausted')) setQuotaExceeded(true);
    });

    // Listener for Room Bookings
    const unsubRoomBookings = onSnapshot(collection(db, 'room_bookings'), (snap) => {
      setRoomBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomBooking)));
    }, (err) => {
      if (err.message.includes('quota') || err.message.includes('resource-exhausted')) setQuotaExceeded(true);
    });

    setLoading(false);
    return () => {
      unsubPublic();
      unsubRooms();
      unsubRoomBookings();
    };
  }, [isAuthReady, user, isStaff]);

  const seedRooms = async () => {
    const batch: Promise<any>[] = [];
    ['A', 'B'].forEach(building => {
      for (let floor = 1; floor <= 4; floor++) {
        for (let num = 1; num <= 4; num++) {
          const roomId = `${building}-${floor}0${num}`;
          batch.push(setDoc(doc(db, 'pet_rooms', roomId), {
            building,
            floor,
            roomNumber: num,
            status: 'available',
            pricePerNight: floor * 500 // higher floors more expensive?
          }));
        }
      }
    });
    await Promise.all(batch);
  };

  const handleStatusChange = async (id: string, status: 'confirmed' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'public_bookings', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `public_bookings/${id}`);
    }
  };

  const handleOpenBooking = (room: PetRoom) => {
    if (room.status !== 'available') return;
    setSelectedRoom(room);
    setCurrentBooking({
      roomId: room.id,
      status: 'pending_payment',
      checkIn: format(new Date(), 'yyyy-MM-dd'),
      checkInTime: '12:00',
      checkOut: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
      checkOutTime: '12:00',
    });
    setIsBookingModalOpen(true);
  };

  const handleSaveBooking = async () => {
    if (!selectedRoom || !currentBooking.ownerName || !currentBooking.petName || !currentBooking.checkIn || !currentBooking.checkOut) {
      alert("Please fill all fields");
      return;
    }

    try {
      // Midday (Noon) Cutoff Logic Calculation (Thai Style)
      // A stay occupies "noon-to-noon" blocks.
      // Arriving before 12:00 PM counts start as the previous noon block.
      // Departing after 12:00 PM counts end as the following noon block.
      
      const checkInDate = new Date(currentBooking.checkIn!);
      const checkOutDate = new Date(currentBooking.checkOut!);
      
      const [inH, inM] = (currentBooking.checkInTime || '12:00').split(':').map(Number);
      const [outH, outM] = (currentBooking.checkOutTime || '12:00').split(':').map(Number);
      
      const startDateTime = new Date(checkInDate);
      startDateTime.setHours(inH, inM, 0, 0);
      
      const endDateTime = new Date(checkOutDate);
      endDateTime.setHours(outH, outM, 0, 0);

      if (endDateTime <= startDateTime) {
        alert("Check-out must be after check-in");
        return;
      }

      // Calculate the start and end "Noon Nodes"
      // Normalized to days
      let d1 = new Date(checkInDate);
      if (inH < 12) {
        // If arriving before noon, you are using the block that started at yesterday's noon
        d1.setDate(d1.getDate() - 1);
      }
      
      let d2 = new Date(checkOutDate);
      if (outH >= 12 && (outH > 12 || outM > 0)) {
        // If departing after noon, you are using the block that ends at tomorrow's noon
        d2.setDate(d2.getDate() + 1);
      }

      // Calculate days difference
      // We use time difference to avoid timezone issues with differenceInDays if needed,
      // but normalized dates at midnight are safe.
      d1.setHours(0,0,0,0);
      d2.setHours(0,0,0,0);
      
      let days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      
      // Ensure at least 1 day
      days = Math.max(1, days);

      const total = days * selectedRoom.pricePerNight;
      
      const bookingData = {
        ...currentBooking,
        totalAmount: total,
        paidAmount: 0,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'room_bookings'), bookingData);
      setCurrentBooking({ ...bookingData, id: docRef.id });
      setIsBookingModalOpen(false);
      setIsPaymentModalOpen(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'room_bookings');
    }
  };

  const handlePayment = async () => {
    try {
      await updateDoc(doc(db, 'room_bookings', currentBooking.id!), {
        status: 'confirmed',
        paidAmount: currentBooking.totalAmount
      });
      
      await updateDoc(doc(db, 'pet_rooms', selectedRoom!.id), {
        status: 'occupied'
      });

      setIsPaymentModalOpen(false);
      alert("Payment Successful! Booking Confirmed.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `room_bookings/${currentBooking.id}`);
    }
  };

  const filteredBookings = bookings.filter(b => 
    filterStatus === 'all' ? true : b.status === filterStatus
  );

  const calculateStayDays = () => {
    if (!currentBooking.checkIn || !currentBooking.checkOut) return 0;
    
    const checkInDate = new Date(currentBooking.checkIn);
    const checkOutDate = new Date(currentBooking.checkOut);
    
    const [inH, inM] = (currentBooking.checkInTime || '12:00').split(':').map(Number);
    const [outH, outM] = (currentBooking.checkOutTime || '12:00').split(':').map(Number);
    
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) return 0;

    let d1 = new Date(checkInDate);
    if (inH < 12) d1.setDate(d1.getDate() - 1);
    
    let d2 = new Date(checkOutDate);
    if (outH >= 12 && (outH > 12 || outM > 0)) d2.setDate(d2.getDate() + 1);

    d1.setHours(0,0,0,0);
    d2.setHours(0,0,0,0);
    
    let days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
  };

  const stayDays = calculateStayDays();
  const totalPrice = selectedRoom ? stayDays * selectedRoom.pricePerNight : 0;

  const renderBuilding = (buildingId: 'A' | 'B') => {
    const floors = [4, 3, 2, 1];
    return (
      <div className="flex-1 flex flex-col gap-4">
        {/* Building Label Above */}
        <div className="text-center">
          <h2 className="text-3xl font-black text-slate-800 italic tracking-tighter">BUILDING {buildingId}</h2>
          <div className="w-12 h-1 bg-[#00b4d8] mx-auto mt-1 rounded-full opacity-50" />
        </div>

        {/* Building Structure */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="bg-white rounded-[2rem] p-4 border-2 border-slate-100 shadow-inner flex flex-col gap-2"
        >
          {floors.map((floor, floorIdx) => (
            <motion.div 
              key={floor} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: floorIdx * 0.1 }}
              className="relative"
            >
              {/* Floor Label */}
              <div className="absolute -left-2 top-0 bottom-0 w-6 flex items-center justify-center">
                <span className="text-[10px] font-black text-slate-300 -rotate-90 whitespace-nowrap">FL 0{floor}</span>
              </div>
              
              {/* Rooms in Floor */}
              <div className="ml-6 bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Level 0{floor} Units</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-slate-200" />
                    <div className="w-1 h-1 rounded-full bg-slate-200" />
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                  {rooms.length > 0 ? (
                    rooms
                      .filter(r => r.building === buildingId && r.floor === floor)
                      .sort((a, b) => a.roomNumber - b.roomNumber)
                      .map((room, idx) => (
                        <motion.button
                          key={room.id}
                          initial={{ opacity: 0, scale: 0.8, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: idx * 0.03, duration: 0.3, type: "spring", stiffness: 300, damping: 20 }}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleOpenBooking(room)}
                          className={cn(
                            "aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors relative overflow-hidden group/room",
                            room.status === 'available' 
                              ? "bg-white border-2 border-slate-100 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-xl hover:shadow-indigo-100/50" 
                              : room.status === 'occupied' 
                                ? "bg-white border-2 border-rose-100 text-rose-400 hover:border-rose-300"
                                : "bg-slate-200 border-2 border-slate-300 text-slate-400 cursor-not-allowed opacity-50"
                          )}
                        >
                          {/* Animated background glow for available rooms */}
                          {room.status === 'available' && (
                            <motion.div 
                              animate={{ 
                                scale: [1, 1.2, 1],
                                opacity: [0, 0.5, 0]
                              }}
                              transition={{ 
                                duration: 2, 
                                repeat: Infinity, 
                                ease: "easeInOut" 
                              }}
                              className="absolute inset-0 bg-emerald-50/50"
                            />
                          )}

                          <Bed className={cn(
                            "w-5 h-5 transition-transform relative z-10", 
                            room.status === 'occupied' ? "text-rose-500" : "group-hover/room:scale-110"
                          )} />
                          <span className={cn(
                            "text-[10px] font-black relative z-10",
                            room.status === 'occupied' ? "text-rose-600" : ""
                          )}>{room.id}</span>
                          
                          {(room.status === 'available' || room.status === 'occupied') && (
                            <motion.div 
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="absolute top-2 right-2"
                            >
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                room.status === 'available' 
                                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" 
                                  : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                              )} />
                            </motion.div>
                          )}

                          {/* Shine effect on hover */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover/room:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
                        </motion.button>
                      ))
                  ) : (
                    // Placeholder Units while loading/quota
                    [1, 2, 3, 4].map(n => (
                      <div key={n} className="aspect-square rounded-xl bg-slate-100/50 border-2 border-dashed border-slate-200" />
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          
          {/* Building Entrance Visual */}
          <div className="mt-2 h-6 bg-slate-800 rounded-xl relative flex items-center justify-center">
            <div className="w-12 h-1 bg-slate-600 rounded-full" />
            <div className="absolute -top-1 w-8 h-1 bg-indigo-400 rounded-full opacity-50" />
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex gap-2 w-fit mx-auto lg:mx-0">
        <motion.button
          onClick={() => setActiveTab('condo')}
          animate={activeTab === 'condo' ? { y: [0, -2, 0] } : {}}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'condo' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Building2 className="w-4 h-4" />
          Pet Condo
        </motion.button>
        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'requests' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          General Requests
          {bookings.filter(b => b.status === 'pending').length > 0 && (
            <span className="bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">
              {bookings.filter(b => b.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'requests' ? (
          <motion.div
            key="requests"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Booking Requests</h1>
                <p className="text-sm text-slate-400 font-medium">Appointments from Facebook & External Links</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {['all', 'pending', 'confirmed', 'cancelled'].map(status => (
                    <button 
                      key={status}
                      onClick={() => setFilterStatus(status as any)}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize",
                        filterStatus === status ? "bg-white text-[#00b4d8] shadow-sm" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                <div className="col-span-full py-20 text-center text-slate-400">Loading requests...</div>
              ) : filteredBookings.length > 0 ? (
                filteredBookings.map((booking) => (
                  <div key={booking.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all">
                    {/* ... (Existing Request Card Content) */}
                    <div className="p-6 space-y-6 flex-1">
                      <div className="flex items-center justify-between">
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          booking.status === 'pending' ? "bg-orange-100 text-orange-600" :
                          booking.status === 'confirmed' ? "bg-emerald-100 text-emerald-600" :
                          "bg-red-100 text-red-600"
                        )}>
                          {booking.status}
                        </div>
                        <span className="text-[10px] font-bold text-slate-300">
                          {booking.createdAt?.toDate ? format(booking.createdAt.toDate(), 'dd MMM, HH:mm') : 'Just now'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                          <PawPrint className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-800">{booking.petName}</h3>
                          <p className="text-xs font-bold text-[#00b4d8] uppercase tracking-widest">{booking.petSpecies} • {booking.serviceType}</p>
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-3 text-slate-600">
                          <User className="w-4 h-4 text-slate-300" />
                          <span className="text-sm font-medium">{booking.ownerName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                          <Phone className="w-4 h-4 text-slate-300" />
                          <span className="text-sm font-medium">{booking.ownerPhone}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-300" />
                          <span className="text-sm font-medium">Requested: {booking.requestedDate}</span>
                        </div>
                      </div>
                    </div>

                    {booking.status === 'pending' && (
                      <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                        <button 
                          onClick={() => handleStatusChange(booking.id, 'confirmed')}
                          className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-xs hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm
                        </button>
                        <button 
                          onClick={() => handleStatusChange(booking.id, 'cancelled')}
                          className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full py-24 text-center">
                  <div className="flex flex-col items-center gap-4 opacity-40">
                    <Clock className="w-16 h-16 text-slate-300" />
                    <p className="text-xl font-bold text-slate-400">No pending requests</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="condo"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-8 mb-12">
                <div className="space-y-2">
                  <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">PET ACCOMODATION</h1>
                  <p className="text-slate-500 font-bold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Click an available unit to start booking
                  </p>
                </div>
                <div className="flex items-center gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-emerald-500 rounded-md" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-rose-500 rounded-md" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Occupied</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row gap-12 max-w-6xl mx-auto">
                {renderBuilding('A')}
                <div className="hidden xl:flex flex-col items-center justify-center gap-4 py-20 px-8">
                  <div className="w-1 h-32 bg-slate-100 rounded-full" />
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] rotate-90">ENTRANCE</span>
                  <div className="w-1 h-32 bg-slate-100 rounded-full" />
                </div>
                {renderBuilding('B')}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && selectedRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[3rem] p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">BOOK UNIT {selectedRoom.id}</h3>
                  <p className="text-indigo-600 font-bold">Floor {selectedRoom.floor} • Building {selectedRoom.building}</p>
                </div>
                <button onClick={() => setIsBookingModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-300" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pet Name</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Snowy"
                    value={currentBooking.petName || ''}
                    onChange={(e) => setCurrentBooking({...currentBooking, petName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Owner Name</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="John Doe"
                    value={currentBooking.ownerName || ''}
                    onChange={(e) => setCurrentBooking({...currentBooking, ownerName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Owner Phone</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="08X-XXX-XXXX"
                    value={currentBooking.ownerPhone || ''}
                    onChange={(e) => setCurrentBooking({...currentBooking, ownerPhone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Check In</label>
                  <div className="flex gap-2">
                    <input 
                      type="date"
                      className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={currentBooking.checkIn || ''}
                      onChange={(e) => setCurrentBooking({...currentBooking, checkIn: e.target.value})}
                    />
                    <input 
                      type="time"
                      className="w-32 bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={currentBooking.checkInTime || '12:00'}
                      onChange={(e) => setCurrentBooking({...currentBooking, checkInTime: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Check Out</label>
                  <div className="flex gap-2">
                    <input 
                      type="date"
                      className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={currentBooking.checkOut || ''}
                      onChange={(e) => setCurrentBooking({...currentBooking, checkOut: e.target.value})}
                    />
                    <input 
                      type="time"
                      className="w-32 bg-slate-50 border border-slate-100 rounded-2xl py-3 px-5 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={currentBooking.checkOutTime || '12:00'}
                      onChange={(e) => setCurrentBooking({...currentBooking, checkOutTime: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 p-6 rounded-3xl flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Rate: ฿{selectedRoom.pricePerNight}</p>
                    <span className="text-[8px] font-bold text-indigo-400/60 uppercase px-1.5 py-0.5 border border-indigo-200 rounded">Noon Cutoff</span>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-2xl font-black text-indigo-600 leading-none">฿{totalPrice}</p>
                    <p className="text-[9px] font-bold text-indigo-400 mt-1 uppercase tracking-tight">{stayDays} {stayDays === 1 ? 'Day' : 'Days'} Total</p>
                  </div>
                </div>
                <button 
                  onClick={handleSaveBooking}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Book Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && currentBooking && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[3rem] p-10 max-w-md w-full shadow-2xl border border-slate-100 space-y-8 text-center"
            >
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                <CreditCard className="w-10 h-10 text-indigo-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic">SECURE PAYMENT</h3>
                <p className="text-slate-500 font-medium">Please confirm payment to finalize booking</p>
              </div>

              <div className="bg-slate-50 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Amount Due</span>
                  <span className="text-slate-900 font-black">฿{currentBooking.totalAmount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Unit</span>
                  <span className="text-indigo-600 font-black">{currentBooking.roomId}</span>
                </div>
                <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 uppercase">Total</span>
                  <span className="text-3xl font-black text-[#00b4d8]">฿{currentBooking.totalAmount}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handlePayment}
                  className="w-full py-4 bg-[#00b4d8] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#0096b4] transition-all shadow-xl shadow-cyan-100"
                >
                  Pay Now
                </button>
                <button 
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Pay Later
                </button>
              </div>

              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic flex items-center justify-center gap-2">
                <CheckCircle className="w-3 h-3" />
                SSL SECURED ENCRYPTION
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shareable Link Card */}
      <div className="bg-[#00b4d8] p-8 rounded-3xl shadow-xl shadow-cyan-100 text-white flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-black uppercase tracking-tight">Booking Link</h3>
          <p className="text-white/70 text-sm font-medium">Share this link on Facebook or Line to receive appointment requests.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 font-mono text-sm">
            animalbox.clinic/book/v123
          </div>
          <button className="p-3 bg-white text-[#00b4d8] rounded-xl font-bold hover:bg-slate-50 transition-all">
            <ExternalLink className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
