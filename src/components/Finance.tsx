import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Upload,
  Trash2,
  Tag,
  FileText,
  X
} from 'lucide-react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  handleFirestoreError,
  OperationType,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  auth
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  realId?: string;
  date: any;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  createdBy: string;
}

export default function Finance() {
  const throwError = useAsyncError();
  const { user, isAuthReady, isStaff } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  // New Expense State
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: 0,
    category: 'Utilities',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (!isAuthReady || !user || !isStaff) {
      if (isAuthReady && !isStaff) setLoading(false);
      return;
    }

    let expData: Transaction[] = [];
    let incData: Transaction[] = [];

    const updateAll = () => {
      const all = [...expData, ...incData].sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      setTransactions(all);
      setLoading(false);
    };

    // Listen to expenses
    const qExpenses = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribeExpenses = onSnapshot(qExpenses, (snap) => {
      expData = snap.docs.map((doc, idx) => {
        const data = doc.data();
        return { 
          id: `exp-${doc.id}-${idx}`, 
          realId: doc.id,
          date: data.date,
          description: data.description,
          amount: data.amount,
          category: data.category,
          createdBy: data.createdBy,
          type: 'expense' as const 
        } as Transaction;
      });
      updateAll();
    }, (err) => {
      console.warn("Expenses listener restricted:", err.message);
      setLoading(false);
    });

    // Listen to OPD records for income
    const qIncome = query(collection(db, 'opd_records'), orderBy('dateVisit', 'desc'));
    const unsubscribeIncome = onSnapshot(qIncome, (incomeSnap) => {
      incData = incomeSnap.docs.map((doc, idx) => ({
        id: `inc-${doc.id}-${idx}`,
        realId: doc.id,
        date: doc.data().dateVisit,
        description: `OPD: ${doc.data().petName} - ${doc.data().category}`,
        amount: doc.data().revenue,
        category: doc.data().category,
        type: 'income' as const,
        createdBy: 'System'
      } as Transaction));
      updateAll();
    }, (err) => {
      console.warn("OPD records listener (finance) restricted:", err.message);
      setLoading(false);
    });

    return () => {
      unsubscribeExpenses();
      unsubscribeIncome();
    };
  }, [isAuthReady, user, isStaff]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'expenses'), {
        ...newExpense,
        amount: parseFloat(newExpense.amount.toString()),
        date: new Date(newExpense.date),
        createdBy: auth.currentUser?.displayName || 'Unknown',
        createdAt: serverTimestamp()
      });
      setIsAddingExpense(false);
      setNewExpense({
        description: '',
        amount: 0,
        category: 'Utilities',
        date: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'expenses');
    }
  };

  const handleDeleteExpense = async (transaction: Transaction) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      const realId = (transaction as any).realId || transaction.id;
      await deleteDoc(doc(db, 'expenses', realId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `expenses/${transaction.id}`);
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const filteredTransactions = transactions.filter(t => 
    filterType === 'all' ? true : t.type === filterType
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Finance & Accounting</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAddingExpense(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-all text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-all text-sm shadow-sm">
            <Upload className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-24 h-24 text-emerald-500" />
          </div>
          <div className="space-y-4 relative">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Income</p>
              <p className="text-3xl font-black text-slate-900">{totalIncome.toLocaleString()} <span className="text-sm font-bold text-slate-400">THB</span></p>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
              <ArrowUpRight className="w-4 h-4" />
              <span>+12.5% from last month</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingDown className="w-24 h-24 text-red-500" />
          </div>
          <div className="space-y-4 relative">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Expense</p>
              <p className="text-3xl font-black text-slate-900">{totalExpense.toLocaleString()} <span className="text-sm font-bold text-slate-400">THB</span></p>
            </div>
            <div className="flex items-center gap-2 text-red-600 text-xs font-bold">
              <ArrowDownRight className="w-4 h-4" />
              <span>+5.2% from last month</span>
            </div>
          </div>
        </div>

        <div className="bg-[#00b4d8] p-8 rounded-3xl shadow-xl shadow-cyan-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <DollarSign className="w-24 h-24 text-white" />
          </div>
          <div className="space-y-4 relative">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-white/60 uppercase tracking-widest">Net Balance</p>
              <p className="text-3xl font-black text-white">{balance.toLocaleString()} <span className="text-sm font-bold text-white/60">THB</span></p>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-xs font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>Updated just now</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Recent Transactions</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setFilterType('all')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", filterType === 'all' ? "bg-white text-[#00b4d8] shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                All
              </button>
              <button 
                onClick={() => setFilterType('income')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", filterType === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                Income
              </button>
              <button 
                onClick={() => setFilterType('expense')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", filterType === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                Expense
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search description..."
                className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-[#00b4d8]"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            </div>
            <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Description</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider">Created By</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                <th className="px-8 py-4 font-bold text-slate-400 uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400">Loading transactions...</td>
                </tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t, idx) => (
                  <tr key={`${t.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-4 font-medium text-slate-600">
                      {format(t.date?.toDate ? t.date.toDate() : new Date(t.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        )}>
                          {t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <span className="font-bold text-slate-900">{t.description}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3 text-slate-300" />
                        <span className="text-xs font-bold text-slate-500">{t.category}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-slate-500">{t.createdBy}</td>
                    <td className={cn(
                      "px-8 py-4 font-black text-right",
                      t.type === 'income' ? "text-emerald-600" : "text-red-600"
                    )}>
                      {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()}
                    </td>
                    <td className="px-8 py-4 text-center">
                      {t.type === 'expense' && (
                        <button 
                          onClick={() => handleDeleteExpense(t)}
                          className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Record Expense</h2>
              <button onClick={() => setIsAddingExpense(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description *</label>
                <input 
                  required
                  type="text" 
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  placeholder="e.g. Electricity Bill, New Stethoscope..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount (THB) *</label>
                  <input 
                    required
                    type="number" 
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date *</label>
                  <input 
                    required
                    type="date" 
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category *</label>
                <select 
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                >
                  <option value="Utilities">Utilities (Water/Electric)</option>
                  <option value="Supplies">Medical Supplies</option>
                  <option value="Salary">Staff Salary</option>
                  <option value="Rent">Rent</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddingExpense(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
