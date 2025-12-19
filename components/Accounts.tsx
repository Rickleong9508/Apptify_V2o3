import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
            <div className="flex justify-between items-center pb-2">
                <h2 className="text-4xl font-bold text-gray-700 tracking-tight animate-fade-in-down">Wallets</h2>
                <button
                    onClick={() => setIsAddingAccount(!isAddingAccount)}
                    className="bg-[#E0E5EC] text-gray-600 w-12 h-12 rounded-full flex items-center justify-center hover:scale-105 transition-all active:scale-95 animate-fade-in-down"
                    style={{ boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                >
                    {isAddingAccount ? <X size={20} /> : <Plus size={20} />}
                </button>
            </div>

            {isAddingAccount && (
                <div
                    className="p-6 rounded-[24px] flex items-center space-x-4 animate-scale-in origin-top"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                    }}
                >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-gray-500" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                        <Wallet size={20} />
                    </div>
                    <input
                        type="text"
                        placeholder="Bank Name (e.g. Chase)"
                        className="flex-1 bg-transparent text-lg font-medium placeholder-gray-400 border-none focus:ring-0 px-2 text-gray-700"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && addAccount()}
                    />
                    <button onClick={addAccount} className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700 transition-colors shadow-lg active:scale-95">Add</button>
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
                            className="h-60 p-6 rounded-[32px] hover:scale-[1.02] transition-all duration-300 cursor-pointer relative overflow-hidden group flex flex-col justify-between animate-fade-in-up"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                                animationDelay: `${index * 100}ms`
                            }}
                        >
                            <div className="flex justify-between items-start z-10">
                                <span className="font-bold text-lg tracking-wide text-gray-700">{acc.name}</span>
                                <button
                                    type="button"
                                    onClick={(e) => handleQuickDelete(e, acc.id)}
                                    className="relative z-20 p-2 text-gray-400 hover:text-red-500 rounded-full transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                                    title="Remove Wallet"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="z-10 mt-4">
                                {/* Decorative Icon/Gradient Element */}
                                <div
                                    className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center text-white shadow-inner ${gradientClass}`}
                                    style={{ boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.2), inset -2px -2px 5px rgba(255,255,255,0.3)" }}
                                >
                                    <Wallet size={24} />
                                </div>

                                {reserved > 0 ? (
                                    <div className="mb-1">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Available Balance</p>
                                        <p className="text-3xl font-bold tracking-tight text-gray-800">RM {available.toLocaleString()}</p>
                                        <p className="text-xs font-medium text-gray-500 mt-1 flex items-center gap-1">
                                            <Lock size={10} />
                                            RM {reserved.toLocaleString()} Reserved
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Current Balance</p>
                                        <p className="text-3xl font-bold tracking-tight text-gray-800">RM {acc.balance.toLocaleString()}</p>
                                    </div>
                                )}
                            </div>

                            <div className="z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex justify-end">
                                <span className="text-xs font-bold text-blue-600 px-4 py-1.5 rounded-full flex items-center gap-1" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                                    View & Edit <ArrowUpRight size={12} />
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Glass Modal */}
            {selectedAccount && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity" onClick={() => setSelectedAccount(null)} />

                    <div
                        className="bg-[#E0E5EC] rounded-[32px] w-full max-w-lg overflow-hidden flex flex-col max-h-[70vh] relative z-10 animate-scale-in origin-center my-auto"
                        style={{ boxShadow: "10px 10px 30px rgba(0,0,0,0.1), -10px -10px 30px rgba(255,255,255,0.7)" }}
                    >

                        <div className="p-8 pb-4">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex-1 mr-4">
                                    {/* Editable Title */}
                                    {isEditingName ? (
                                        <div className="flex items-center space-x-3 mb-2">
                                            <input
                                                type="text"
                                                value={editNameValue}
                                                onChange={(e) => setEditNameValue(e.target.value)}
                                                className="bg-transparent rounded-lg px-2 py-1 text-sm font-semibold uppercase tracking-wider w-full focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 border border-gray-300"
                                                autoFocus
                                            />
                                            <button onClick={saveAccountName} className="p-1.5 bg-green-500 text-white rounded-lg shadow hover:opacity-90"><Check size={14} /></button>
                                            <button onClick={() => setIsEditingName(false)} className="p-1.5 bg-gray-400 text-white rounded-lg shadow hover:opacity-90"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <div className="group flex items-center gap-2 mb-1 cursor-pointer w-fit" onClick={() => setIsEditingName(true)}>
                                            <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider hover:text-blue-600 transition-colors">{selectedAccount.name}</h3>
                                            <Pencil size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    )}

                                    {/* Header Balances */}
                                    <div className="flex items-end gap-2">
                                        <h2 className="text-4xl font-bold text-gray-800 tracking-tight">
                                            RM {(selectedAccount.balance - getTotalReserved(selectedAccount)).toLocaleString()}
                                        </h2>
                                        <span className="text-sm text-gray-400 font-bold mb-2 uppercase tracking-wide">Available</span>
                                    </div>

                                    <div className="flex items-center gap-4 mt-2 text-xs font-semibold text-gray-500">
                                        <span className="bg-gray-200/50 px-2 py-1 rounded-md">Total: <b>RM {selectedAccount.balance.toLocaleString()}</b></span>
                                        <span className="flex items-center gap-1 bg-yellow-100/50 text-yellow-700 px-2 py-1 rounded-md">
                                            <Lock size={10} />
                                            Reserved: <b>RM {getTotalReserved(selectedAccount).toLocaleString()}</b>
                                        </span>
                                    </div>

                                </div>
                                <button
                                    onClick={() => setSelectedAccount(null)}
                                    className="p-3 rounded-full text-gray-500 hover:text-red-500 transition-colors active:scale-95"
                                    style={{ boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                >
                                    <Plus size={20} className="rotate-45" />
                                </button>
                            </div>

                            {/* TABS */}
                            <div className="flex p-1.5 rounded-xl mb-6" style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}>
                                <button
                                    onClick={() => setModalTab('transactions')}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${modalTab === 'transactions' ? 'text-blue-600 bg-[#E0E5EC] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                    style={modalTab === 'transactions' ? { boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff" } : {}}
                                >
                                    Transactions
                                </button>
                                <button
                                    onClick={() => setModalTab('reserves')}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1 ${modalTab === 'reserves' ? 'text-blue-600 bg-[#E0E5EC] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                    style={modalTab === 'reserves' ? { boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff" } : {}}
                                >
                                    <Lock size={12} />
                                    Reserves
                                </button>
                            </div>

                            {/* ACTION AREA - Changes based on Tab */}
                            {modalTab === 'transactions' ? (
                                <>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 p-1 rounded-xl flex items-center transition-all bg-[#E0E5EC]" style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}>
                                                <span className="pl-4 text-gray-400 font-bold text-sm">RM</span>
                                                <input
                                                    type="number"
                                                    value={amount}
                                                    onChange={e => setAmount(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full p-3 bg-transparent border-none focus:ring-0 text-xl font-bold text-gray-700 placeholder-gray-300 outline-none"
                                                />
                                            </div>
                                        </div>

                                        <input
                                            type="text"
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="Description (e.g. Salary)"
                                            className="w-full p-4 rounded-xl border-none focus:ring-0 text-sm font-medium transition-all text-gray-700 placeholder-gray-400 bg-[#E0E5EC] outline-none"
                                            style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                        />

                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <button
                                                onClick={() => handleTransaction('IN')}
                                                className="py-3 rounded-xl flex items-center justify-center space-x-2 text-green-600 transition-all active:scale-95 group font-bold bg-[#E0E5EC]"
                                                style={{ boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                            >
                                                <ArrowDownLeft size={18} className="group-hover:scale-110 transition-transform" />
                                                <span>Deposit</span>
                                            </button>
                                            <button
                                                onClick={() => handleTransaction('OUT')}
                                                className="py-3 rounded-xl flex items-center justify-center space-x-2 text-gray-600 transition-all active:scale-95 group font-bold bg-[#E0E5EC]"
                                                style={{ boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                            >
                                                <ArrowUpRight size={18} className="group-hover:scale-110 transition-transform" />
                                                <span>Withdraw</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-4 rounded-2xl mb-4 bg-[#E0E5EC]" style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2 px-1">
                                            <Plus size={12} strokeWidth={3} />
                                            Add New Reserve
                                        </h4>
                                        <div className="flex gap-3 mb-3">
                                            <div className="flex-1 rounded-xl flex items-center px-3 bg-[#E0E5EC]" style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                                                <span className="text-gray-400 font-bold text-xs">RM</span>
                                                <input
                                                    type="number"
                                                    value={resAmount}
                                                    onChange={e => setResAmount(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full p-2 bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 placeholder-gray-300 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            value={resReason}
                                            onChange={e => setResReason(e.target.value)}
                                            placeholder="Reason (e.g. Vacation)"
                                            className="w-full p-3 rounded-xl border-none text-xs font-medium text-gray-700 placeholder-gray-400 mb-3 bg-[#E0E5EC] outline-none"
                                            style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}
                                        />
                                        <button
                                            onClick={addReservation}
                                            className="w-full py-2.5 rounded-xl font-bold text-xs text-blue-600 transition-all hover:scale-[1.02] active:scale-95 bg-[#E0E5EC]"
                                            style={{ boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                        >
                                            Lock Cash
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto p-0 min-h-0 bg-[#E0E5EC]">
                            <div className="px-8 py-3 bg-[#E0E5EC]/80 border-b border-gray-200 sticky top-0 backdrop-blur-md z-10">
                                <h4 className="font-bold text-gray-400 text-xs uppercase tracking-wider">
                                    {modalTab === 'transactions' ? 'Recent Activity' : 'Active Reservations'}
                                </h4>
                            </div>

                            <div className="divide-y divide-gray-200">
                                {/* TRANSACTIONS LIST */}
                                {modalTab === 'transactions' && (
                                    <>
                                        {selectedAccount.history.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                                <History size={32} className="mb-2 opacity-30" />
                                                <p className="text-sm">No transactions yet</p>
                                            </div>
                                        )}
                                        {selectedAccount.history.map(tx => (
                                            <div key={tx.id} className="flex justify-between items-center px-8 py-4 hover:bg-white/40 transition-colors">
                                                <div className="flex items-center space-x-4">
                                                    <div
                                                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'IN' ? 'text-green-600' : 'text-gray-500'}`}
                                                        style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                                    >
                                                        {tx.type === 'IN' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-700 text-[15px]">{tx.description}</p>
                                                        <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <span className={`font-bold text-[15px] ${tx.type === 'IN' ? 'text-green-600' : 'text-gray-800'}`}>
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
                                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                                <Lock size={32} className="mb-2 opacity-30" />
                                                <p className="text-sm">No cash reserves set</p>
                                            </div>
                                        )}
                                        {selectedAccount.reservations?.map(res => (
                                            <div key={res.id} className="flex justify-between items-center px-8 py-4 hover:bg-white/40 transition-colors group">
                                                <div className="flex items-center space-x-4">
                                                    <div
                                                        className="w-10 h-10 rounded-xl text-blue-500 flex items-center justify-center"
                                                        style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                                    >
                                                        <Lock size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-700 text-[15px]">{res.reason}</p>
                                                        <p className="text-xs text-gray-400">Created {new Date(res.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-bold text-[15px] text-gray-800">
                                                        RM {res.amount.toLocaleString()}
                                                    </span>
                                                    <button
                                                        onClick={() => deleteReservation(res.id)}
                                                        className="p-2 text-gray-400 hover:text-red-500 rounded-full transition-colors opacity-0 group-hover:opacity-100"
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
                            <div className="p-4 bg-red-50 border-t border-red-100 flex flex-col items-center animate-fade-in">
                                <div className="flex items-center gap-2 mb-3 text-red-600">
                                    <AlertCircle size={18} />
                                    <p className="font-bold text-sm">Are you sure? This cannot be undone.</p>
                                </div>
                                <div className="flex w-full gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 py-3 rounded-xl text-gray-600 font-semibold text-sm hover:bg-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeleteFromModal}
                                        className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm shadow-lg shadow-red-500/30 hover:bg-red-600 active:scale-[0.98] transition-all"
                                    >
                                        Confirm Delete
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-[#E0E5EC] border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="w-full py-3 rounded-xl text-red-500 font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] bg-[#E0E5EC]"
                                    style={{ boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                >
                                    <Trash2 size={16} />
                                    Delete Wallet
                                </button>
                            </div>
                        )}

                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Accounts;