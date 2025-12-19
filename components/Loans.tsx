import React, { useState } from 'react';
import { Loan } from '../types';
import { Trash2, Plus, CreditCard, ChevronRight, Pencil, X, AlertCircle, Check, Calculator } from 'lucide-react';

interface LoansProps {
  loans: Loan[];
  setLoans: React.Dispatch<React.SetStateAction<Loan[]>>;
}

const Loans: React.FC<LoansProps> = ({ loans, setLoans }) => {
  // --- Modal & Form State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Loan>>({});

  // --- Delete Confirmation State ---
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({});
    setIsModalOpen(true);
  };

  const openEditModal = (loan: Loan) => {
    setEditingId(loan.id);
    setFormData({ ...loan });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
    setEditingId(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.totalAmount || !formData.monthlyPayment) return;

    const total = Number(formData.totalAmount);
    const monthly = Number(formData.monthlyPayment);
    // If remaining isn't set (new loan), default to total. If editing, keep as is unless changed.
    const remaining = formData.remainingAmount !== undefined ? Number(formData.remainingAmount) : total;

    // Auto-calculate months if not provided manually
    let months = formData.remainingMonths !== undefined && formData.remainingMonths !== null
      ? Number(formData.remainingMonths)
      : 0;

    // If months is 0 (or empty) and we have a monthly payment, calculate it
    if ((!months || months === 0) && monthly > 0) {
      months = Math.ceil(remaining / monthly);
    }

    if (editingId) {
      // Update Existing
      setLoans(prev => prev.map(l => l.id === editingId ? {
        ...l,
        name: formData.name!,
        totalAmount: total,
        monthlyPayment: monthly,
        remainingAmount: remaining,
        remainingMonths: months
      } : l));
    } else {
      // Create New
      const newLoan: Loan = {
        id: Date.now().toString(),
        name: formData.name!,
        totalAmount: total,
        monthlyPayment: monthly,
        remainingAmount: remaining,
        remainingMonths: months
      };
      setLoans(prev => [...prev, newLoan]);
    }
    closeModal();
  };

  const confirmDelete = () => {
    if (deleteId) {
      setLoans(prev => prev.filter(l => l.id !== deleteId));
      setDeleteId(null);
    }
  };

  const payOneMonth = (loan: Loan) => {
    const updated = loans.map(l => {
      if (l.id === loan.id) {
        const newRemaining = Math.max(0, l.remainingAmount - l.monthlyPayment);
        const newMonths = Math.max(0, l.remainingMonths - 1);
        return { ...l, remainingAmount: newRemaining, remainingMonths: newMonths };
      }
      return l;
    });
    setLoans(updated);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">

      {/* Header */}
      <div className="flex justify-between items-center pb-2">
        <h2 className="text-4xl font-bold text-gray-700 tracking-tight animate-fade-in-down">Loans</h2>
        <button
          onClick={openAddModal}
          className="bg-[#E0E5EC] hover:scale-105 text-gray-700 w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 animate-fade-in-down"
          style={{ boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Loan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {loans.map((loan, index) => {
          const progress = loan.totalAmount > 0 ? ((loan.totalAmount - loan.remainingAmount) / loan.totalAmount) * 100 : 0;
          return (
            <div
              key={loan.id}
              className="rounded-[32px] overflow-hidden relative group transition-all duration-300 animate-fade-in-up opacity-0"
              style={{
                background: "#E0E5EC",
                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                animationDelay: `${index * 100}ms`
              }}
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 text-red-500 rounded-2xl flex items-center justify-center" style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}>
                      <CreditCard size={24} strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-gray-700 tracking-tight">{loan.name}</h3>
                      <span className="text-sm text-gray-500 font-medium">RM {loan.monthlyPayment.toLocaleString()}/mo</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => openEditModal(loan)}
                      className="p-3 text-gray-500 hover:text-blue-600 rounded-full transition-all cursor-pointer hover:scale-110 active:scale-95"
                      style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                      title="Edit Loan"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => setDeleteId(loan.id)}
                      className="p-3 text-gray-500 hover:text-red-600 rounded-full transition-all cursor-pointer hover:scale-110 active:scale-95"
                      style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                      title="Delete Loan"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-4xl font-bold text-gray-700 tracking-tight">
                      <span className="text-xl align-top opacity-50 mr-1">RM</span>
                      {loan.remainingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-sm font-semibold text-gray-500 mb-1">{progress.toFixed(0)}% Paid</span>
                  </div>

                  {/* Apple Style Progress Bar */}
                  <div className="w-full rounded-full h-4 overflow-hidden" style={{ background: "#E0E5EC", boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                    <div
                      className="bg-gradient-to-r from-red-500 to-orange-500 h-full rounded-full transition-all duration-1000 ease-out relative shadow-sm"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute top-0 right-0 bottom-0 w-full bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-300/50">
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Principal</p>
                    <p className="font-semibold text-gray-700">RM {loan.totalAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Time Left</p>
                    <p className="font-semibold text-gray-700">{loan.remainingMonths} months</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => payOneMonth(loan)}
                className="w-full hover:bg-gray-200/50 p-4 text-sm font-bold text-gray-600 hover:text-blue-600 transition-colors flex items-center justify-center space-x-2 border-t border-gray-300/50 active:bg-gray-300/50"
              >
                <span>Record 1 Month Payment</span>
                <ChevronRight size={16} />
              </button>
            </div>
          );
        })}
        {loans.length === 0 && (
          <div className="md:col-span-2 text-center py-20 rounded-[32px] border-2 border-dashed border-gray-300" style={{ background: "transparent" }}>
            <div className="w-20 h-20 bg-[#E0E5EC] rounded-full flex items-center justify-center mx-auto mb-6" style={{ boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)" }}>
              <CreditCard size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium text-lg">No active loans. You are debt free!</p>
            <button onClick={openAddModal} className="mt-4 text-blue-600 font-bold text-sm hover:underline">Add a liability</button>
          </div>
        )}
      </div>

      {/* --- ADD / EDIT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div
            className="rounded-[32px] w-full max-w-lg shadow-2xl relative z-10 animate-scale-in overflow-hidden"
            style={{
              background: "#E0E5EC",
              boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
            }}
          >
            <div className="p-6 border-b border-gray-300 flex justify-between items-center bg-[#E0E5EC]">
              <h3 className="font-bold text-xl text-gray-700 flex items-center gap-2">
                {editingId ? <><Pencil size={20} className="text-blue-600" /> Edit Loan</> : <><Plus size={20} className="text-blue-600" /> New Liability</>}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 rounded-full text-gray-500 hover:text-red-500 transition-all active:scale-95"
                style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6 bg-[#E0E5EC]">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Loan Name</label>
                <input
                  className="w-full p-3 rounded-xl border-none focus:ring-0 font-bold text-gray-700 outline-none transition-all"
                  style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                  placeholder="e.g. Car Loan"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Total Principal</label>
                  <input
                    type="number"
                    className="w-full p-3 rounded-xl border-none focus:ring-0 font-bold text-gray-700 outline-none transition-all"
                    style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                    placeholder="0.00"
                    value={formData.totalAmount || ''}
                    onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Monthly Payment</label>
                  <input
                    type="number"
                    className="w-full p-3 rounded-xl border-none focus:ring-0 font-bold text-gray-700 outline-none transition-all"
                    style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                    placeholder="0.00"
                    value={formData.monthlyPayment || ''}
                    onChange={e => setFormData({ ...formData, monthlyPayment: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-300 space-y-4 bg-[#E0E5EC]">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator size={14} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status Adjustment (Optional)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Remaining Amount</label>
                    <input
                      type="number"
                      className="w-full p-2.5 rounded-lg border-none focus:ring-0 font-bold text-sm text-gray-700 outline-none"
                      style={{ background: "#E0E5EC", boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}
                      placeholder="Auto"
                      value={formData.remainingAmount !== undefined ? formData.remainingAmount : ''}
                      onChange={e => setFormData({ ...formData, remainingAmount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Months Left</label>
                    <input
                      type="number"
                      className="w-full p-2.5 rounded-lg border-none focus:ring-0 font-bold text-sm text-gray-700 outline-none"
                      style={{ background: "#E0E5EC", boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}
                      placeholder="Auto-calc"
                      value={formData.remainingMonths !== undefined ? formData.remainingMonths : ''}
                      onChange={e => setFormData({ ...formData, remainingMonths: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full py-4 rounded-xl font-bold text-lg text-blue-600 hover:scale-[1.02] transition-all shadow-lg active:scale-[0.98]"
                style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
              >
                {editingId ? 'Save Changes' : 'Create Liability'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div
            className="rounded-[24px] w-full max-w-sm shadow-2xl relative z-10 animate-scale-in overflow-hidden"
            style={{
              background: "#E0E5EC",
              boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
            }}
          >
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 text-red-500 rounded-full flex items-center justify-center mb-4" style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}>
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">Delete Loan?</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Are you sure you want to remove this loan record? This cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-3.5 text-gray-600 font-bold rounded-xl hover:text-gray-800 transition-all active:scale-95"
                  style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3.5 text-red-500 font-bold rounded-xl hover:text-red-700 transition-all active:scale-95"
                  style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Loans;