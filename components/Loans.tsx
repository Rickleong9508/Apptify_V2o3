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
    if(deleteId) {
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
      <div className="flex justify-between items-center pb-2 border-b border-border">
        <h2 className="text-4xl font-bold text-text-main tracking-tight">Loans</h2>
        <button 
          onClick={openAddModal}
          className="bg-text-main hover:opacity-80 text-surface w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors active:scale-95"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Loan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loans.map(loan => {
          const progress = loan.totalAmount > 0 ? ((loan.totalAmount - loan.remainingAmount) / loan.totalAmount) * 100 : 0;
          return (
            <div key={loan.id} className="bg-surface rounded-[32px] shadow-apple border border-border overflow-hidden relative group hover:shadow-apple-hover transition-all duration-300">
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
                      <CreditCard size={24} strokeWidth={2}/>
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-text-main tracking-tight">{loan.name}</h3>
                      <span className="text-sm text-text-muted font-medium">RM {loan.monthlyPayment.toLocaleString()}/mo</span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                      <button 
                        onClick={() => openEditModal(loan)} 
                        className="p-2 bg-input-bg text-text-muted hover:text-blue-600 hover:bg-blue-500/10 rounded-full transition-colors cursor-pointer"
                        title="Edit Loan"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        onClick={() => setDeleteId(loan.id)} 
                        className="p-2 bg-input-bg text-text-muted hover:text-red-600 hover:bg-red-500/10 rounded-full transition-colors cursor-pointer"
                        title="Delete Loan"
                      >
                        <Trash2 size={18} />
                      </button>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-4xl font-bold text-text-main tracking-tight">
                        <span className="text-xl align-top opacity-50 mr-1">RM</span>
                        {loan.remainingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-sm font-semibold text-text-muted mb-1">{progress.toFixed(0)}% Paid</span>
                  </div>
                  
                  {/* Apple Style Progress Bar */}
                  <div className="w-full bg-input-bg rounded-full h-4 overflow-hidden">
                    <div 
                        className="bg-gradient-to-r from-red-500 to-orange-500 h-full rounded-full transition-all duration-1000 ease-out relative" 
                        style={{ width: `${progress}%` }}
                    >
                         <div className="absolute top-0 right-0 bottom-0 w-full bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-border">
                   <div>
                      <p className="text-text-muted text-xs font-bold uppercase tracking-wider mb-1">Total Principal</p>
                      <p className="font-semibold text-text-main">RM {loan.totalAmount.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-text-muted text-xs font-bold uppercase tracking-wider mb-1">Time Left</p>
                      <p className="font-semibold text-text-main">{loan.remainingMonths} months</p>
                   </div>
                </div>
              </div>
              
              <button 
                onClick={() => payOneMonth(loan)}
                className="w-full bg-input-bg hover:bg-border p-4 text-sm font-bold text-primary transition-colors flex items-center justify-center space-x-2 border-t border-border"
               >
                 <span>Record 1 Month Payment</span>
                 <ChevronRight size={16} />
               </button>
            </div>
          );
        })}
        {loans.length === 0 && (
            <div className="md:col-span-2 text-center py-20 bg-surface rounded-[32px] border border-dashed border-border">
                <CreditCard size={48} className="mx-auto text-text-muted mb-4" />
                <p className="text-text-muted font-medium">No active loans. You are debt free!</p>
                <button onClick={openAddModal} className="mt-4 text-primary font-bold text-sm hover:underline">Add a liability</button>
            </div>
        )}
      </div>

      {/* --- ADD / EDIT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
            <div className="bg-surface rounded-[32px] w-full max-w-lg shadow-2xl relative z-10 animate-scale-in border border-border overflow-hidden">
                <div className="p-6 border-b border-border flex justify-between items-center bg-input-bg">
                    <h3 className="font-bold text-xl text-text-main flex items-center gap-2">
                        {editingId ? <><Pencil size={20} className="text-primary"/> Edit Loan</> : <><Plus size={20} className="text-primary"/> New Liability</>}
                    </h3>
                    <button onClick={closeModal} className="p-2 bg-surface hover:bg-border rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-8 space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Loan Name</label>
                        <input 
                            className="w-full p-3 bg-input-bg rounded-xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-text-main" 
                            placeholder="e.g. Car Loan" 
                            value={formData.name || ''} 
                            onChange={e => setFormData({...formData, name: e.target.value})} 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Total Principal</label>
                            <input 
                                type="number"
                                className="w-full p-3 bg-input-bg rounded-xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-text-main" 
                                placeholder="0.00" 
                                value={formData.totalAmount || ''} 
                                onChange={e => setFormData({...formData, totalAmount: Number(e.target.value)})} 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Monthly Payment</label>
                            <input 
                                type="number"
                                className="w-full p-3 bg-input-bg rounded-xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-text-main" 
                                placeholder="0.00" 
                                value={formData.monthlyPayment || ''} 
                                onChange={e => setFormData({...formData, monthlyPayment: Number(e.target.value)})} 
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-input-bg rounded-xl border border-border space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                             <Calculator size={14} className="text-text-muted"/>
                             <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Status Adjustment (Optional)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Remaining Amount</label>
                                <input 
                                    type="number"
                                    className="w-full p-2.5 bg-surface rounded-lg border border-border focus:ring-2 focus:ring-primary/20 font-bold text-sm text-text-main" 
                                    placeholder="Auto" 
                                    value={formData.remainingAmount !== undefined ? formData.remainingAmount : ''} 
                                    onChange={e => setFormData({...formData, remainingAmount: Number(e.target.value)})} 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Months Left</label>
                                <input 
                                    type="number"
                                    className="w-full p-2.5 bg-surface rounded-lg border border-border focus:ring-2 focus:ring-primary/20 font-bold text-sm text-text-main" 
                                    placeholder="Auto-calc" 
                                    value={formData.remainingMonths !== undefined ? formData.remainingMonths : ''} 
                                    onChange={e => setFormData({...formData, remainingMonths: Number(e.target.value)})} 
                                />
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleSave} 
                        className="w-full py-4 bg-text-main text-surface rounded-xl font-bold text-lg hover:opacity-90 transition-colors shadow-lg active:scale-[0.98]"
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
            <div className="bg-surface rounded-[24px] w-full max-w-sm shadow-2xl relative z-10 animate-scale-in border border-border overflow-hidden">
                <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-text-main mb-2">Delete Loan?</h3>
                    <p className="text-text-muted text-sm mb-6 leading-relaxed">
                        Are you sure you want to remove this loan record? This cannot be undone.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteId(null)}
                            className="flex-1 py-3.5 bg-input-bg text-text-main font-bold rounded-xl hover:bg-border transition-colors active:scale-95"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 active:scale-95"
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