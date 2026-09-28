import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Account, Transaction, Reservation } from '../types';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Wallet, 
  Trash2, 
  Pencil, 
  Check, 
  X, 
  AlertCircle, 
  Lock, 
  TrendingUp, 
  Calculator,
  CreditCard,
  Wifi
} from 'lucide-react';

interface AccountsProps {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
}

const CARD_THEMES = [
  {
    bg: 'bg-gradient-to-br from-[#0066FF] to-[#00C6FF]',
    accent: 'bg-blue-400/20 text-blue-100',
    chip: '#E0F2FE'
  },
  {
    bg: 'bg-gradient-to-br from-[#6366F1] to-[#8B5CF6]',
    accent: 'bg-indigo-400/20 text-indigo-100',
    chip: '#EDE9FE'
  },
  {
    bg: 'bg-gradient-to-br from-[#0D9488] to-[#14B8A6]',
    accent: 'bg-teal-400/20 text-teal-100',
    chip: '#CCFBF1'
  },
  {
    bg: 'bg-gradient-to-br from-[#EA580C] to-[#F97316]',
    accent: 'bg-orange-400/20 text-orange-100',
    chip: '#FFEDD5'
  },
  {
    bg: 'bg-gradient-to-br from-[#1F2937] to-[#111827]',
    accent: 'bg-gray-700/40 text-gray-200',
    chip: '#9CA3AF'
  },
];

const safeEvaluate = (str: string): number => {
  if (!str) return 0;
  const clean = str.replace(/[^0-9+\-*/. ]/g, '');
  try {
    const result = new Function(`return (${clean})`)();
    return typeof result === 'number' && isFinite(result) ? result : 0;
  } catch (e) {
    return 0;
  }
};

const Accounts: React.FC<AccountsProps> = ({ accounts, setAccounts }) => {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [modalTab, setModalTab] = useState<'transactions' | 'reserves'>('transactions');

  // Transaction Form
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showCalc, setShowCalc] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('');

  // Reservation Form
  const [resAmount, setResAmount] = useState('');
  const [resReason, setResReason] = useState('');

  // Add Account State
  const [newAccountName, setNewAccountName] = useState('');
  const [newInterestRate, setNewInterestRate] = useState('');
  const [newInterestFreq, setNewInterestFreq] = useState<'DAILY' | 'MONTHLY' | 'YEARLY' | 'NONE'>('NONE');
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  // Edit Account State
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingInterest, setIsEditingInterest] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editInterestFreq, setEditInterestFreq] = useState<'DAILY' | 'MONTHLY' | 'YEARLY' | 'NONE'>('NONE');

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (selectedAccount) {
      setEditNameValue(selectedAccount.name);
      setEditInterestRate(selectedAccount.interestRate ? selectedAccount.interestRate.toString() : '');
      setEditInterestFreq(selectedAccount.interestFrequency || 'NONE');
      setIsEditingName(false);
      setIsEditingInterest(false);
      setShowDeleteConfirm(false);
      setAmount('');
      setDescription('');
      setResAmount('');
      setResReason('');
      setModalTab('transactions');
      setShowCalc(false);
    }
  }, [selectedAccount]);

  const getTotalReserved = (acc: Account): number => {
    if (!acc.reservations) return 0;
    return acc.reservations.reduce((sum, r) => sum + r.amount, 0);
  };

  const getNextInterestDate = (freq: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'NONE'): string | undefined => {
    if (freq === 'NONE') return undefined;
    const now = new Date();
    if (freq === 'DAILY') now.setDate(now.getDate() + 1);
    else if (freq === 'MONTHLY') now.setMonth(now.getMonth() + 1);
    else if (freq === 'YEARLY') now.setFullYear(now.getFullYear() + 1);
    return now.toISOString();
  };

  const addAccount = () => {
    if (!newAccountName.trim()) return;

    const newAcc: Account = {
      id: Date.now().toString(),
      name: newAccountName.trim(),
      balance: 0,
      reservations: [],
      history: [],
      interestRate: newInterestRate ? parseFloat(newInterestRate) : undefined,
      interestFrequency: newInterestFreq,
      nextInterestDate: getNextInterestDate(newInterestFreq)
    };

    setAccounts(prev => [...prev, newAcc]);
    setNewAccountName('');
    setNewInterestRate('');
    setNewInterestFreq('NONE');
    setIsAddingAccount(false);
  };

  const handleTransaction = (type: 'IN' | 'OUT') => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (!selectedAccount) return;

    const newTx: Transaction = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type,
      amount: parsedAmount,
      description: description.trim() || (type === 'IN' ? '存入' : '提取')
    };

    const newBalance = type === 'IN' 
      ? selectedAccount.balance + parsedAmount 
      : selectedAccount.balance - parsedAmount;

    setAccounts(prev => prev.map(acc => {
      if (acc.id === selectedAccount.id) {
        return {
          ...acc,
          balance: newBalance,
          history: [newTx, ...acc.history]
        };
      }
      return acc;
    }));

    setSelectedAccount(prev => prev ? {
      ...prev,
      balance: newBalance,
      history: [newTx, ...prev.history]
    } : null);

    setAmount('');
    setDescription('');
  };

  const addReservation = () => {
    const parsedAmount = parseFloat(resAmount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (!resReason.trim() || !selectedAccount) return;

    const newRes: Reservation = {
      id: Date.now().toString(),
      amount: parsedAmount,
      reason: resReason.trim(),
      createdAt: new Date().toISOString()
    };

    setAccounts(prev => prev.map(acc => {
      if (acc.id === selectedAccount.id) {
        return {
          ...acc,
          reservations: [newRes, ...(acc.reservations || [])]
        };
      }
      return acc;
    }));

    setSelectedAccount(prev => prev ? {
      ...prev,
      reservations: [newRes, ...(prev.reservations || [])]
    } : null);

    setResAmount('');
    setResReason('');
  };

  const deleteReservation = (resId: string) => {
    if (!selectedAccount) return;

    setAccounts(prev => prev.map(acc => {
      if (acc.id === selectedAccount.id) {
        return {
          ...acc,
          reservations: acc.reservations.filter(r => r.id !== resId)
        };
      }
      return acc;
    }));

    setSelectedAccount(prev => prev ? {
      ...prev,
      reservations: prev.reservations.filter(r => r.id !== resId)
    } : null);
  };

  const saveAccountName = () => {
    if (!selectedAccount || !editNameValue.trim()) return;

    setAccounts(prev => prev.map(acc => {
      if (acc.id === selectedAccount.id) {
        return { ...acc, name: editNameValue.trim() };
      }
      return acc;
    }));

    setSelectedAccount(prev => prev ? { ...prev, name: editNameValue.trim() } : null);
    setIsEditingName(false);
  };

  const saveInterestSettings = () => {
    if (!selectedAccount) return;

    setAccounts(prev => prev.map(acc => {
      if (acc.id === selectedAccount.id) {
        const needsReset = (editInterestFreq !== 'NONE' && acc.interestFrequency !== editInterestFreq);
        return {
          ...acc,
          interestRate: editInterestRate ? parseFloat(editInterestRate) : undefined,
          interestFrequency: editInterestFreq,
          nextInterestDate: needsReset
            ? getNextInterestDate(editInterestFreq)
            : (editInterestFreq === 'NONE' ? undefined : acc.nextInterestDate)
        };
      }
      return acc;
    }));

    setSelectedAccount(prev => {
      if (!prev) return null;
      const needsReset = (editInterestFreq !== 'NONE' && prev.interestFrequency !== editInterestFreq);
      return {
        ...prev,
        interestRate: editInterestRate ? parseFloat(editInterestRate) : undefined,
        interestFrequency: editInterestFreq,
        nextInterestDate: needsReset
          ? getNextInterestDate(editInterestFreq)
          : (editInterestFreq === 'NONE' ? undefined : prev.nextInterestDate)
      };
    });
    setIsEditingInterest(false);
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
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Title & Add Wallet Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            我的钱包与账户
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            共 {accounts.length} 个流动资产与专款钱包
          </p>
        </div>

        <button
          onClick={() => setIsAddingAccount(!isAddingAccount)}
          className="w-11 h-11 rounded-2xl flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 active:scale-95 transition-all"
          aria-label="Add wallet"
        >
          {isAddingAccount ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {/* Add Wallet Form (Collapsible Glass Card) */}
      {isAddingAccount && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-[#1A1C22]/85 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-xl shadow-black/5 animate-scale-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">创建新钱包</h3>
              <p className="text-[11px] text-gray-500">添加银行卡、现金包或带收益的存款账户</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="账户名称 (例如：Maybank、储蓄钱包)"
              className="flex-1 px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              autoFocus
            />

            <div className="flex gap-2">
              <input
                type="number"
                placeholder="年利率 %"
                className="w-24 px-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
                value={newInterestRate}
                onChange={(e) => setNewInterestRate(e.target.value)}
              />
              <select
                className="px-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-gray-300 outline-none cursor-pointer"
                value={newInterestFreq}
                onChange={(e) => setNewInterestFreq(e.target.value as any)}
              >
                <option value="NONE">无利息</option>
                <option value="DAILY">每日复利</option>
                <option value="MONTHLY">按月计息</option>
                <option value="YEARLY">按年结算</option>
              </select>

              <button 
                onClick={addAccount} 
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm rounded-2xl transition-all shadow-md shadow-blue-500/20 whitespace-nowrap"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Cards Grid (Apple Wallet Touch-Friendly Card Deck) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {accounts.map((acc, index) => {
          const theme = CARD_THEMES[index % CARD_THEMES.length];
          const reserved = getTotalReserved(acc);
          const available = acc.balance - reserved;

          return (
            <div
              key={acc.id}
              onClick={() => setSelectedAccount(acc)}
              className={`rounded-3xl p-5 sm:p-6 text-white ${theme.bg} shadow-lg shadow-black/10 hover:shadow-2xl hover:scale-[1.015] active:scale-[0.98] transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[190px] sm:min-h-[210px] group`}
            >
              {/* Subtle Card Textures */}
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              
              {/* Top Card Row */}
              <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-6 rounded-md bg-amber-400/70 border border-amber-300/60 shadow-sm flex items-center justify-center">
                    <Wifi size={13} className="text-amber-900 rotate-90" />
                  </div>
                  <span className="font-extrabold text-base tracking-wide drop-shadow-sm">{acc.name}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleQuickDelete(e, acc.id)}
                  className="p-1.5 text-white/60 hover:text-rose-300 rounded-full transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  title="删除钱包"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Middle Balance Section */}
              <div className="z-10 my-auto py-2">
                <p className="text-[10px] uppercase font-bold text-white/70 tracking-widest mb-0.5">可用余额 (Available)</p>
                <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight drop-shadow-sm">
                  RM {available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>

                {reserved > 0 && (
                  <p className="text-xs text-amber-200 font-semibold mt-1 flex items-center gap-1">
                    <Lock size={11} /> 已锁定 RM {reserved.toLocaleString()}
                  </p>
                )}
              </div>

              {/* Bottom Card Footer */}
              <div className="z-10 flex items-center justify-between pt-2 border-t border-white/15">
                {acc.interestRate && acc.interestFrequency !== 'NONE' ? (
                  <span className="text-[10px] font-bold text-emerald-200 flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full">
                    <TrendingUp size={10} /> {acc.interestRate}% ({acc.interestFrequency})
                  </span>
                ) : (
                  <span className="text-[10px] text-white/60 font-mono tracking-wider">WALLET #{acc.id.slice(-4)}</span>
                )}

                <span className="text-[11px] font-bold text-white/90 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  明细 <ArrowUpRight size={13} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Account Details & Transaction Modal (iOS Bottom Sheet on Mobile) */}
      {selectedAccount && createPortal(
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
          {/* Backdrop Shield */}
          <div 
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedAccount(null)} 
          />

          {/* Modal / Sheet Container */}
          <div className="w-full sm:max-w-lg bg-white dark:bg-[#181A20] rounded-t-[32px] sm:rounded-3xl border-t sm:border border-white/60 dark:border-white/10 shadow-2xl relative z-10 flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden pb-safe animate-fade-in-up">
            
            {/* Grab Handle for Touch Devices */}
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20 mx-auto mt-2.5 mb-1 sm:hidden" />

            {/* Modal Header */}
            <div className="px-5 sm:px-6 pt-3 pb-3 border-b border-gray-100 dark:border-white/10 flex items-start justify-between">
              <div className="flex-1 mr-3">
                {isEditingName ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="px-2.5 py-1 text-sm font-bold rounded-xl bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/15 text-gray-900 dark:text-white outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <button onClick={saveAccountName} className="p-1.5 bg-emerald-500 text-white rounded-lg"><Check size={14} /></button>
                    <button onClick={() => setIsEditingName(false)} className="p-1.5 bg-gray-400 text-white rounded-lg"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group cursor-pointer mb-1" onClick={() => setIsEditingName(true)}>
                    <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">{selectedAccount.name}</h3>
                    <Pencil size={12} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                )}

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">
                    RM {(selectedAccount.balance - getTotalReserved(selectedAccount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">可用余额</span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  <span>总计: <b>RM {selectedAccount.balance.toLocaleString()}</b></span>
                  {getTotalReserved(selectedAccount) > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-bold">
                      <Lock size={10} /> 锁定: RM {getTotalReserved(selectedAccount).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedAccount(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Segment Tab Switcher */}
            <div className="px-5 sm:px-6 pt-3 pb-2">
              <div className="flex p-1 rounded-2xl bg-gray-100 dark:bg-white/10 border border-black/5 dark:border-white/5">
                <button
                  onClick={() => setModalTab('transactions')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    modalTab === 'transactions' 
                      ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  收支记账
                </button>
                <button
                  onClick={() => setModalTab('reserves')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    modalTab === 'reserves' 
                      ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Lock size={12} /> 专款准备金
                </button>
              </div>
            </div>

            {/* Modal Body / Active Content */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-2 space-y-4 no-scrollbar">
              {modalTab === 'transactions' ? (
                <div className="space-y-3">
                  {/* Amount Input with Calculator */}
                  <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus-within:border-blue-500 transition-colors">
                    <span className="pl-3 text-sm font-bold text-gray-400">RM</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 p-2 bg-transparent text-lg font-bold text-gray-900 dark:text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCalcDisplay(amount || '');
                        setShowCalc(!showCalc);
                      }}
                      className="p-2 text-gray-500 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all"
                      title="打开简易计算器"
                    >
                      <Calculator size={18} />
                    </button>
                  </div>

                  {/* Calculator Pad */}
                  {showCalc && (
                    <div className="p-3 rounded-2xl bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/15 animate-scale-in">
                      <div className="p-2 text-right font-mono text-base font-bold text-gray-800 dark:text-white mb-2 bg-white dark:bg-black/30 rounded-xl">
                        {calcDisplay || '0'}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 mb-2">
                        {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'].map(key => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              if (key === 'C') setCalcDisplay('');
                              else if (key === '=') {
                                try {
                                  const res = safeEvaluate(calcDisplay);
                                  setCalcDisplay(Number(res.toFixed(2)).toString());
                                } catch (e) {
                                  setCalcDisplay('Error');
                                }
                              } else {
                                setCalcDisplay(prev => prev === 'Error' ? key : prev + key);
                              }
                            }}
                            className="p-2 text-sm font-bold rounded-xl bg-white dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 active:scale-95 transition-all text-gray-800 dark:text-gray-200"
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const res = safeEvaluate(calcDisplay);
                              if (!isNaN(res) && res > 0) setAmount(res.toFixed(2));
                            } catch (e) {}
                            setShowCalc(false);
                          }}
                          className="flex-1 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-xl"
                        >
                          填入金额
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCalc(false)}
                          className="px-3 py-1.5 bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 font-bold text-xs rounded-xl"
                        >
                          关闭
                        </button>
                      </div>
                    </div>
                  )}

                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="备注说明 (例如：工资发薪、晚餐消费)"
                    className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
                  />

                  {/* Actions: Deposit vs Withdraw */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => handleTransaction('IN')}
                      className="py-2.5 rounded-2xl flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-sm border border-emerald-500/20 active:scale-95 transition-all"
                    >
                      <ArrowDownLeft size={16} />
                      <span>记入存入 (Deposit)</span>
                    </button>
                    <button
                      onClick={() => handleTransaction('OUT')}
                      className="py-2.5 rounded-2xl flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-sm border border-rose-500/20 active:scale-95 transition-all"
                    >
                      <ArrowUpRight size={16} />
                      <span>记入支出 (Withdraw)</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Reserves Form */
                <div className="space-y-3 p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Lock size={13} className="text-amber-500" />
                    设置专款锁定金额
                  </h4>
                  <input
                    type="number"
                    value={resAmount}
                    onChange={(e) => setResAmount(e.target.value)}
                    placeholder="锁定金额 (RM)"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-900 dark:text-white outline-none"
                  />
                  <input
                    type="text"
                    value={resReason}
                    onChange={(e) => setResReason(e.target.value)}
                    placeholder="专款用途 (例如：下月房租、旅游基金)"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none"
                  />
                  <button
                    onClick={addReservation}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                  >
                    立即锁定专款
                  </button>
                </div>
              )}

              {/* History / List View */}
              <div className="pt-3 border-t border-gray-100 dark:border-white/10">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-2">
                  {modalTab === 'transactions' ? '历史流水记录' : '当前已锁定专款'}
                </span>

                {modalTab === 'transactions' ? (
                  <div className="space-y-2">
                    {selectedAccount.history.length === 0 ? (
                      <div className="py-8 text-center text-gray-400 text-xs">暂无流水记录</div>
                    ) : (
                      selectedAccount.history.map(tx => (
                        <div key={tx.id} className="flex justify-between items-center p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'IN' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {tx.type === 'IN' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-gray-800 dark:text-gray-200">{tx.description}</p>
                              <p className="text-[10px] text-gray-400">{new Date(tx.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className={`font-mono font-bold text-sm ${tx.type === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-800 dark:text-gray-200'}`}>
                            {tx.type === 'IN' ? '+' : '-'}RM {tx.amount.toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(!selectedAccount.reservations || selectedAccount.reservations.length === 0) ? (
                      <div className="py-8 text-center text-gray-400 text-xs">暂无专款准备金</div>
                    ) : (
                      selectedAccount.reservations.map(res => (
                        <div key={res.id} className="flex justify-between items-center p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                              <Lock size={14} />
                            </div>
                            <div>
                              <p className="font-bold text-xs text-gray-800 dark:text-gray-200">{res.reason}</p>
                              <p className="text-[10px] text-gray-400">{new Date(res.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-sm text-gray-800 dark:text-gray-200">
                              RM {res.amount.toLocaleString()}
                            </span>
                            <button
                              onClick={() => deleteReservation(res.id)}
                              className="text-gray-400 hover:text-rose-500 p-1 rounded-full transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Delete Account Safeguard */}
            <div className="p-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2 animate-fade-in">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-white/10"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDeleteFromModal}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-sm"
                  >
                    确认删除此钱包
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 size={13} />
                  <span>删除该账户</span>
                </button>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Accounts;