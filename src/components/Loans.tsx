import React, { useState } from 'react';
import { Loan } from '../types';
import { Trash2, Plus, CreditCard, ChevronRight, Pencil, X, AlertCircle, Calculator, Calendar, DollarSign } from 'lucide-react';

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
    const remaining = formData.remainingAmount !== undefined ? Number(formData.remainingAmount) : total;

    let months = formData.remainingMonths !== undefined && formData.remainingMonths !== null
      ? Number(formData.remainingMonths)
      : 0;

    if ((!months || months === 0) && monthly > 0) {
      months = Math.ceil(remaining / monthly);
    }

    if (editingId) {
      setLoans(prev => prev.map(l => l.id === editingId ? {
        ...l,
        name: formData.name!,
        totalAmount: total,
        monthlyPayment: monthly,
        remainingAmount: remaining,
        remainingMonths: months
      } : l));
    } else {
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

  const totalDebt = loans.reduce((acc, l) => acc + (l.remainingAmount || 0), 0);
  const totalMonthlyCommitment = loans.reduce((acc, l) => acc + (l.monthlyPayment || 0), 0);

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ios-label-primary)]">
            Loans & Liabilities
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ios-label-secondary)] mt-0.5">
            Track amortization, repayments, and debt-free milestones
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="ios-button-primary flex items-center justify-center gap-2 tap-scale self-start sm:self-auto"
        >
          <Plus size={18} />
          <span>Add Liability</span>
        </button>
      </div>

      {/* Summary Metrics */}
      {loans.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="ios-card p-4 sm:p-5">
            <span className="text-[11px] sm:text-xs font-semibold text-[var(--ios-label-secondary)] uppercase tracking-wider">
              Total Outstanding Debt
            </span>
            <div className="text-xl sm:text-2xl font-bold text-rose-500 mt-1">
              RM {totalDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="ios-card p-4 sm:p-5">
            <span className="text-[11px] sm:text-xs font-semibold text-[var(--ios-label-secondary)] uppercase tracking-wider">
              Monthly Debt Outflow
            </span>
            <div className="text-xl sm:text-2xl font-bold text-[var(--ios-label-primary)] mt-1">
              RM {totalMonthlyCommitment.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
            </div>
          </div>
        </div>
      )}

      {/* Loan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {loans.map(loan => {
          const progress = loan.totalAmount > 0
            ? Math.min(100, Math.max(0, ((loan.totalAmount - loan.remainingAmount) / loan.totalAmount) * 100))
            : 0;

          return (
            <div
              key={loan.id}
              className="ios-card p-5 sm:p-6 flex flex-col justify-between space-y-5 transition-all"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                      <CreditCard size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base sm:text-lg text-[var(--ios-label-primary)] leading-tight">
                        {loan.name}
                      </h3>
                      <span className="text-xs text-[var(--ios-label-secondary)] font-medium">
                        RM {loan.monthlyPayment.toLocaleString()}/month
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(loan)}
                      className="p-2 text-[var(--ios-label-secondary)] hover:text-blue-500 rounded-full hover:bg-[var(--ios-fill-tertiary)] tap-scale transition-colors"
                      title="Edit Loan"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteId(loan.id)}
                      className="p-2 text-[var(--ios-label-secondary)] hover:text-rose-500 rounded-full hover:bg-[var(--ios-fill-tertiary)] tap-scale transition-colors"
                      title="Delete Loan"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Balance & Progress */}
                <div className="mt-5 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="text-xs text-[var(--ios-label-secondary)] font-medium mr-1.5">Remaining</span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-[var(--ios-label-primary)] tracking-tight">
                        RM {loan.remainingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                      {progress.toFixed(0)}% Repaid
                    </span>
                  </div>

                  {/* iOS Style Progress Bar */}
                  <div className="w-full h-2.5 rounded-full bg-[var(--ios-fill-tertiary)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-700 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Meta stats */}
                <div className="grid grid-cols-2 gap-3 pt-4 mt-4 border-t border-[var(--ios-separator)]">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ios-label-secondary)]">
                      Total Principal
                    </span>
                    <p className="font-semibold text-xs sm:text-sm text-[var(--ios-label-primary)] mt-0.5">
                      RM {loan.totalAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ios-label-secondary)]">
                      Time Remaining
                    </span>
                    <p className="font-semibold text-xs sm:text-sm text-[var(--ios-label-primary)] mt-0.5">
                      {loan.remainingMonths} months (~{(loan.remainingMonths / 12).toFixed(1)} yrs)
                    </p>
                  </div>
                </div>
              </div>

              {/* Pay 1 month button */}
              <button
                onClick={() => payOneMonth(loan)}
                disabled={loan.remainingAmount <= 0}
                className="w-full py-3 px-4 rounded-xl bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)] text-[var(--ios-label-primary)] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 tap-scale transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Record 1 Month Payment</span>
                <ChevronRight size={14} className="text-[var(--ios-label-secondary)]" />
              </button>
            </div>
          );
        })}

        {loans.length === 0 && (
          <div className="md:col-span-2 text-center py-16 ios-card border-dashed border-2 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
              <CreditCard size={28} />
            </div>
            <h3 className="text-lg font-bold text-[var(--ios-label-primary)]">You are debt free!</h3>
            <p className="text-xs sm:text-sm text-[var(--ios-label-secondary)] max-w-sm mt-1">
              No active loans or liabilities recorded. Track home, auto, or personal loans when you need to.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 ios-button-primary text-xs tap-scale"
            >
              Add a Liability
            </button>
          </div>
        )}
      </div>

      {/* --- ADD / EDIT BOTTOM SHEET / MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full sm:max-w-lg ios-card rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--ios-separator)]">
              <h3 className="text-lg font-bold text-[var(--ios-label-primary)] flex items-center gap-2">
                {editingId ? <Pencil size={18} className="text-blue-500" /> : <Plus size={18} className="text-blue-500" />}
                <span>{editingId ? 'Edit Loan' : 'Add Liability'}</span>
              </h3>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-[var(--ios-fill-tertiary)] flex items-center justify-center text-[var(--ios-label-secondary)] tap-scale"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ios-label-secondary)] uppercase tracking-wider mb-1.5">
                  Loan Name
                </label>
                <input
                  className="ios-input"
                  placeholder="e.g. Car Loan, Home Mortgage"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ios-label-secondary)] uppercase tracking-wider mb-1.5">
                    Total Principal (RM)
                  </label>
                  <input
                    type="number"
                    className="ios-input"
                    placeholder="0.00"
                    value={formData.totalAmount || ''}
                    onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ios-label-secondary)] uppercase tracking-wider mb-1.5">
                    Monthly Payment (RM)
                  </label>
                  <input
                    type="number"
                    className="ios-input"
                    placeholder="0.00"
                    value={formData.monthlyPayment || ''}
                    onChange={e => setFormData({ ...formData, monthlyPayment: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--ios-fill-tertiary)] space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ios-label-secondary)] uppercase tracking-wider">
                  <Calculator size={14} />
                  <span>Amortization Adjustment (Optional)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase mb-1">
                      Current Remaining (RM)
                    </label>
                    <input
                      type="number"
                      className="ios-input text-sm"
                      placeholder="Auto (Principal)"
                      value={formData.remainingAmount !== undefined ? formData.remainingAmount : ''}
                      onChange={e => setFormData({ ...formData, remainingAmount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase mb-1">
                      Remaining Months
                    </label>
                    <input
                      type="number"
                      className="ios-input text-sm"
                      placeholder="Auto-calculated"
                      value={formData.remainingMonths !== undefined ? formData.remainingMonths : ''}
                      onChange={e => setFormData({ ...formData, remainingMonths: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.totalAmount || !formData.monthlyPayment}
                className="w-full ios-button-primary py-3.5 text-base tap-scale disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingId ? 'Save Changes' : 'Create Liability'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm ios-card rounded-3xl p-6 text-center space-y-4 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-lg font-bold text-[var(--ios-label-primary)]">Delete Loan?</h3>
            <p className="text-xs sm:text-sm text-[var(--ios-label-secondary)] leading-relaxed">
              Are you sure you want to remove this loan record? This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)] font-semibold text-xs sm:text-sm text-[var(--ios-label-primary)] tap-scale"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs sm:text-sm tap-scale shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Loans;