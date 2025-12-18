import React, { useState, useEffect } from 'react';
import { Account, Transaction, Reservation } from '../types';
import { Plus, ArrowUpRight, ArrowDownLeft, History, Wallet, Trash2, Pencil, Check, X, AlertCircle, Lock, Unlock, List } from 'lucide-react';

interface AccountsProps {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
}

const GRADIENTS = [
    'bg-gradient-to-br from-[#0071e3] to-[#00c6fb]', // Apple Blue
    'bg-gradient-to-br from-[#30cfd0] to-[#330867]', // Teal/Purple
    'bg-gradient-to-br from-[#f093fb] to-[#f5576c]', // Pink/Orange
    'bg-gradient-to-br from-[#4facfe] to-[#00f2fe]', // Light Blue
    'bg-gradient-to-br from-[#434343] to-[#000000]', // Black
];

const Accounts: React.FC<AccountsProps> = ({ accounts, setAccounts }) => {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [modalTab, setModalTab] = useState<'transactions' | 'reserves'>('transactions');

  // Transaction Form
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  // Reservation Form
  const [resAmount, setResAmount] = useState('');
  const [resReason, setResReason] = useState('');

  // Add Account State
  const [newAccountName, setNewAccountName] = useState('');
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  // Edit Account State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  // Delete Confirmation State (For Modal Only)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset state when modal opens/changes
  useEffect(() => {
    if (selectedAccount) {
      setEditNameValue(selectedAccount.name);
      setIsEditingName(false);
      setShowDeleteConfirm(false); 
      setAmount('');
      setDescription('');
      setResAmount('');
      setResReason('');
      setModalTab('transactions');
    }
  }, [selectedAccount]);

  // Helper to calculate total reserved
  const getTotalReserved = (acc: Account) => {
      return acc.reservations ? acc.reservations.reduce((sum, r) => sum + r.amount, 0) : 0;
  };

  const handleTransaction = (type: 'IN' | 'OUT') => {
    if (!selectedAccount || !amount) return;

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    const newTx: Transaction = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type,
      amount: val,
      description: description || (type === 'IN' ? 'Deposit' : 'Withdrawal'),
    };

    setAccounts(prev => prev.map(acc => {
      if (acc.id === selectedAccount.id) {
        return {
          ...acc,
          balance: type === 'IN' ? acc.balance + val : acc.balance - val,
          history: [newTx, ...acc.history]
        };
      }
      return acc;
    }));
    
    setSelectedAccount(prev => {
        if (!prev) return null;
        return {
            ...prev,
            balance: type === 'IN' ? prev.balance + val : prev.balance - val,
            history: [newTx, ...prev.history]
        };
    });

    setAmount('');
    setDescription('');
  };

  const addReservation = () => {
      if (!selectedAccount || !resAmount || !resReason) return;
      const val = parseFloat(resAmount);
      if (isNaN(val) || val <= 0) return;

      const newRes: Reservation = {
          id: Date.now().toString(),
          amount: val,
          reason: resReason,
          createdAt: new Date().toISOString()
      };

      setAccounts(prev => prev.map(acc => {
          if (acc.id === selectedAccount.id) {
              return { ...acc, reservations: [...(acc.reservations || []), newRes] };
          }
          return acc;
      }));

      setSelectedAccount(prev => {
          if (!prev) return null;
          return { ...prev, reservations: [...(prev.reservations || []), newRes] };
      });

      setResAmount('');
      setResReason('');
  };

  const deleteReservation = (resId: string) => {
      if (!selectedAccount) return;

      setAccounts(prev => prev.map(acc => {
          if (acc.id === selectedAccount.id) {
              return { ...acc, reservations: acc.reservations.filter(r => r.id !== resId) };
          }
          return acc;
      }));

      setSelectedAccount(prev => {
          if (!prev) return null;
          return { ...prev, reservations: prev.reservations.filter(r => r.id !== resId) };
      });
  };

  const addAccount = () => {
    if (!newAccountName.trim()) return;
    const newAcc: Account = {
      id: Date.now().toString(),
      name: newAccountName,
      balance: 0,
      reservations: [],
      history: []
    };
    setAccounts(prev => [...prev, newAcc]);
    setNewAccountName('');
    setIsAddingAccount(false);
  };

  const saveAccountName = () => {
    if (!selectedAccount || !editNameValue.trim()) return;

    setAccounts(prev => prev.map(acc => {
      if (acc.id === selectedAccount.id) {
        return { ...acc, name: editNameValue };
      }
      return acc;
    }));
    
    setSelectedAccount(prev => prev ? { ...prev, name: editNameValue } : null);
    setIsEditingName(false);
  };

  const handleDeleteFromModal = () => {
    if (!selectedAccount) return;
    setAccounts(prev => prev.filter(a => a.id !== selectedAccount.id));
    setSelectedAccount(null); 
  };

  const handleQuickDelete = (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation(); 
    setAccounts(prev => prev.filter(a => a.id !== accountId));
    if (selectedAccount?.id === accountId) {
        setSelectedAccount(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center pb-2 border-b border-border">
        <h2 className="text-4xl font-bold text-text-main tracking-tight">Wallets</h2>
        <button 
          onClick={() => setIsAddingAccount(!isAddingAccount)}
          className="bg-text-main text-surface w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity shadow-lg"
        >
          {isAddingAccount ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {isAddingAccount && (
        <div className="bg-surface p-6 rounded-[24px] shadow-apple flex items-center space-x-4 animate-slide-in border border-border">
            <div className="w-12 h-12 bg-input-bg rounded-full flex items-center justify-center text-text-muted">
                <Wallet size={20}/>
            </div>
            <input 
                type="text" 
                placeholder="Bank Name (e.g. Chase)" 
                className="flex-1 bg-transparent text-lg font-medium placeholder-text-muted border-none focus:ring-0 px-0 text-text-main"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && addAccount()}
            />
            <button onClick={addAccount} className="bg-primary text-white px-6 py-2 rounded-full font-medium hover:opacity-90 transition-opacity">Add</button>
        </div>
      )}

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc, index) => {
          const gradientClass = GRADIENTS[index % GRADIENTS.length];
          const reserved = getTotalReserved(acc);
          const available = acc.balance - reserved;
          
          return (
            <div 
              key={acc.id} 
              onClick={() => setSelectedAccount(acc)}
              className={`${gradientClass} h-56 p-6 rounded-[24px] shadow-apple-hover hover:scale-[1.02] transition-all duration-300 cursor-pointer relative overflow-hidden group text-white flex flex-col justify-between`}
            >
              <div className="absolute top-0 right-0 p-20 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
              
              <div className="flex justify-between items-start z-10">
                <span className="font-semibold text-lg tracking-wide opacity-90">{acc.name}</span>
                <button 
                  type="button"
                  onClick={(e) => handleQuickDelete(e, acc.id)}
                  className="relative z-20 p-2 bg-black/20 hover:bg-red-500 text-white rounded-full backdrop-blur-md transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                  title="Remove Wallet"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="z-10">
                 {reserved > 0 ? (
                    <div className="mb-1">
                        <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5">Available Balance</p>
                        <p className="text-4xl font-bold tracking-tight">RM {available.toLocaleString()}</p>
                        <p className="text-xs font-medium opacity-70 mt-1 flex items-center gap-1">
                            <Lock size={10} />
                            RM {reserved.toLocaleString()} Reserved ({acc.reservations.length})
                        </p>
                    </div>
                 ) : (
                    <div>
                        <p className="text-sm font-medium opacity-70 mb-1">Current Balance</p>
                        <p className="text-4xl font-bold tracking-tight">RM {acc.balance.toLocaleString()}</p>
                    </div>
                 )}
              </div>

              <div className="z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex justify-end">
                  <span className="text-xs font-medium bg-white/20 px-3 py-1 rounded-full backdrop-blur-md flex items-center gap-1">
                    View & Edit <ArrowUpRight size={12} />
                  </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Glass Modal */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedAccount(null)} />
          
          <div className="bg-surface/90 backdrop-blur-2xl rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10 relative z-10 animate-scale-in">
            
            <div className="p-8 pb-4 border-b border-border">
               <div className="flex justify-between items-start mb-4">
                 <div className="flex-1 mr-4">
                    {/* Editable Title */}
                    {isEditingName ? (
                      <div className="flex items-center space-x-2 mb-2">
                        <input 
                          type="text" 
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="bg-input-bg rounded-lg px-2 py-1 text-sm font-semibold uppercase tracking-wider w-full focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main"
                          autoFocus
                        />
                        <button onClick={saveAccountName} className="p-1 bg-green-500/20 text-green-600 rounded hover:bg-green-500/30"><Check size={16}/></button>
                        <button onClick={() => setIsEditingName(false)} className="p-1 bg-input-bg text-text-muted rounded hover:bg-border"><X size={16}/></button>
                      </div>
                    ) : (
                      <div className="group flex items-center gap-2 mb-1 cursor-pointer" onClick={() => setIsEditingName(true)}>
                        <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider hover:text-primary transition-colors">{selectedAccount.name}</h3>
                        <Pencil size={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                    
                    {/* Header Balances */}
                    <div className="flex items-end gap-2">
                        <h2 className="text-4xl font-bold text-text-main">
                            RM {(selectedAccount.balance - getTotalReserved(selectedAccount)).toLocaleString()}
                        </h2>
                        <span className="text-sm text-text-muted font-bold mb-1.5 uppercase tracking-wide">Available</span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs font-medium text-text-muted">
                        <span>Total: <b>RM {selectedAccount.balance.toLocaleString()}</b></span>
                        <span className="flex items-center gap-1">
                            <Lock size={10} /> 
                            Reserved: <b>RM {getTotalReserved(selectedAccount).toLocaleString()}</b>
                        </span>
                    </div>

                 </div>
                 <button onClick={() => setSelectedAccount(null)} className="bg-input-bg p-2 rounded-full hover:bg-border transition-colors">
                   <Plus size={20} className="rotate-45 text-text-muted" />
                 </button>
               </div>

               {/* TABS */}
               <div className="flex p-1 bg-input-bg rounded-xl mb-4">
                    <button 
                        onClick={() => setModalTab('transactions')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${modalTab === 'transactions' ? 'bg-surface shadow-sm text-text-main' : 'text-text-muted hover:text-text-main'}`}
                    >
                        Transactions
                    </button>
                    <button 
                        onClick={() => setModalTab('reserves')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1 ${modalTab === 'reserves' ? 'bg-surface shadow-sm text-text-main' : 'text-text-muted hover:text-text-main'}`}
                    >
                        <Lock size={12} />
                        Reserves
                    </button>
               </div>

               {/* ACTION AREA - Changes based on Tab */}
               {modalTab === 'transactions' ? (
                   <>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <button 
                                onClick={() => handleTransaction('IN')}
                                className="bg-green-500 text-white p-3 rounded-xl flex items-center justify-center space-x-2 hover:bg-green-600 transition-all active:scale-95 shadow-md shadow-green-500/20"
                            >
                                <ArrowDownLeft size={18} />
                                <span className="font-bold text-sm">Deposit</span>
                            </button>
                            <button 
                                onClick={() => handleTransaction('OUT')}
                                className="bg-text-main text-surface p-3 rounded-xl flex items-center justify-center space-x-2 hover:opacity-90 transition-all active:scale-95 shadow-md"
                            >
                                <ArrowUpRight size={18} />
                                <span className="font-bold text-sm">Withdraw</span>
                            </button>
                        </div>
                        <div className="space-y-2">
                            <div className="bg-input-bg p-2 rounded-xl border border-border flex items-center focus-within:ring-2 ring-primary/20 transition-all">
                                <span className="pl-3 text-text-muted font-bold text-sm">RM</span>
                                <input 
                                    type="number" 
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full p-2 bg-transparent border-none focus:ring-0 text-lg font-bold text-text-main placeholder-text-muted/50"
                                />
                            </div>
                            <input 
                                type="text" 
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Description (e.g. Salary)"
                                className="w-full p-3 bg-input-bg rounded-xl border-none focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-all text-text-main placeholder-text-muted/50"
                            />
                        </div>
                   </>
               ) : (
                   <>
                        <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 mb-4">
                            <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-2">
                                <Plus size={12} strokeWidth={3} />
                                Add New Reserve
                            </h4>
                            <div className="flex gap-2 mb-2">
                                <div className="flex-1 bg-surface rounded-lg border border-blue-500/20 flex items-center px-3">
                                    <span className="text-text-muted font-bold text-xs">RM</span>
                                    <input 
                                        type="number" 
                                        value={resAmount}
                                        onChange={e => setResAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full p-2 bg-transparent border-none focus:ring-0 text-sm font-bold text-text-main placeholder-text-muted/50"
                                    />
                                </div>
                                <button 
                                    onClick={addReservation}
                                    className="bg-blue-600 text-white px-4 rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors shadow-md"
                                >
                                    Lock Cash
                                </button>
                            </div>
                            <input 
                                type="text" 
                                value={resReason}
                                onChange={e => setResReason(e.target.value)}
                                placeholder="What is this reserve for? (e.g. Vacation)"
                                className="w-full p-2.5 bg-surface rounded-lg border border-blue-500/20 focus:ring-2 focus:ring-blue-500/20 text-xs font-medium text-text-main placeholder-text-muted/50"
                            />
                        </div>
                   </>
               )}
            </div>

            <div className="flex-1 overflow-auto p-0 min-h-[200px] bg-surface">
                <div className="px-8 py-3 bg-input-bg/50 border-b border-border sticky top-0 backdrop-blur-md z-10 flex justify-between items-center">
                    <h4 className="font-bold text-text-muted text-xs uppercase tracking-wider">
                        {modalTab === 'transactions' ? 'Recent Activity' : 'Active Reservations'}
                    </h4>
                </div>
                
                <div className="divide-y divide-border">
                    {/* TRANSACTIONS LIST */}
                    {modalTab === 'transactions' && (
                        <>
                            {selectedAccount.history.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                                    <History size={32} className="mb-2 opacity-50"/>
                                    <p className="text-sm">No transactions yet</p>
                                </div>
                            )}
                            {selectedAccount.history.map(tx => (
                                <div key={tx.id} className="flex justify-between items-center px-8 py-4 hover:bg-input-bg transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'IN' ? 'bg-green-500/10 text-green-600' : 'bg-text-muted/10 text-text-muted'}`}>
                                            {tx.type === 'IN' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-text-main text-[15px]">{tx.description}</p>
                                            <p className="text-xs text-text-muted">{new Date(tx.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className={`font-bold text-[15px] ${tx.type === 'IN' ? 'text-green-600' : 'text-text-main'}`}>
                                        {tx.type === 'IN' ? '+' : '-'} RM {tx.amount.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </>
                    )}

                    {/* RESERVATIONS LIST */}
                    {modalTab === 'reserves' && (
                        <>
                            {(!selectedAccount.reservations || selectedAccount.reservations.length === 0) && (
                                <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                                    <Lock size={32} className="mb-2 opacity-50"/>
                                    <p className="text-sm">No cash reserves set</p>
                                </div>
                            )}
                            {selectedAccount.reservations?.map(res => (
                                <div key={res.id} className="flex justify-between items-center px-8 py-4 hover:bg-input-bg transition-colors group">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                            <Lock size={16}/>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-text-main text-[15px]">{res.reason}</p>
                                            <p className="text-xs text-text-muted">Created {new Date(res.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-[15px] text-text-main">
                                            RM {res.amount.toLocaleString()}
                                        </span>
                                        <button 
                                            onClick={() => deleteReservation(res.id)}
                                            className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* Delete Account Footer with Confirmation UI */}
            {showDeleteConfirm ? (
                <div className="p-4 bg-red-500/10 border-t border-red-500/20 flex flex-col items-center animate-fade-in">
                    <div className="flex items-center gap-2 mb-3 text-red-600">
                        <AlertCircle size={18} />
                        <p className="font-bold text-sm">Are you sure? This cannot be undone.</p>
                    </div>
                    <div className="flex w-full gap-3">
                        <button 
                            type="button"
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-3 rounded-xl bg-surface text-text-main font-semibold text-sm shadow-sm border border-border hover:bg-input-bg"
                        >
                            Cancel
                        </button>
                        <button 
                            type="button"
                            onClick={handleDeleteFromModal}
                            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm shadow-sm hover:bg-red-700 active:scale-[0.98] transition-all"
                        >
                            Confirm Delete
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-4 bg-input-bg border-t border-border">
                    <button 
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full py-3 rounded-xl text-red-500 font-semibold text-sm hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        <Trash2 size={16} />
                        Delete Wallet
                    </button>
                </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;