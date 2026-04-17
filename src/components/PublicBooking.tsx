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
  MessageSquare
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
  doc
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

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

export default function PublicBooking() {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('pending');

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) {
      if (isAuthReady && !isStaff) setLoading(false);
      return;
    }

    const q = query(collection(db, 'public_bookings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookingRequest)));
      setLoading(false);
    }, (err) => {
      console.warn("PublicBooking listener restricted:", err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isAuthReady, user, isStaff]);

  const handleStatusChange = async (id: string, status: 'confirmed' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'public_bookings', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `public_bookings/${id}`);
    }
  };

  const filteredBookings = bookings.filter(b => 
    filterStatus === 'all' ? true : b.status === filterStatus
  );

  return (
    <div className="space-y-6">
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

              {booking.status === 'confirmed' && (
                <div className="p-4 bg-emerald-50 border-t border-emerald-100">
                  <button 
                    onClick={() => alert('Opening WhatsApp/SMS to ' + booking.ownerPhone)}
                    className="w-full py-2.5 bg-white border border-emerald-200 text-emerald-600 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Notify Client
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
