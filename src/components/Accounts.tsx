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
import { Language, getStoredLanguage } from '../utils/i18n';

interface AccountsProps {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
}

const CARD_THEMES = [
  {
    bg: 'bg-zinc-950 dark:bg-[#0D0F14] border border-zinc-800 text-white',
    accent: 'bg-[#D4FF00]/10 text-[#D4FF00] border border-[#D4FF00]/30',
    chip: '#D4FF00',
    highlight: 'text-[#D4FF00]'
  },
  {
    bg: 'bg-zinc-900 dark:bg-[#141721] border border-zinc-700/80 text-white',
    accent: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30',
    chip: '#22D3EE',
    highlight: 'text-cyan-400'
  },
  {
    bg: 'bg-zinc-900 dark:bg-[#111A18] border border-zinc-700/80 text-white',
    accent: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    chip: '#34D399',
    highlight: 'text-emerald-400'
  },
  {
    bg: 'bg-zinc-900 dark:bg-[#1C1613] border border-zinc-700/80 text-white',
    accent: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    chip: '#FBBF24',
    highlight: 'text-amber-400'
  },
  {
    bg: 'bg-zinc-900 dark:bg-[#191522] border border-zinc-700/80 text-white',
    accent: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
    chip: '#C084FC',
    highlight: 'text-purple-400'
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
      description: description.trim() || (type === 'IN' ? (lang === 'zh' ? '存入' : 'Deposit') : (lang === 'zh' ? '提取' : 'Withdrawal'))
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

  const [lang, setLang] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    const handleLangChange = () => setLang(getStoredLanguage());
    window.addEventListener('apptify_language_change', handleLangChange);
    return () => window.removeEventListener('apptify_language_change', handleLangChange);
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Avant-Garde Masthead & Add Wallet Button */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-extrabold bg-zinc-900 text-[#D4FF00] dark:bg-[#D4FF00] dark:text-black">
              VAULT // LIQUIDITY
            </span>
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              02 // WALLETS
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] uppercase text-zinc-950 dark:text-white">
            {lang === 'zh' ? '我的钱包与账户' : 'Wallets & Cash Accounts'}
          </h2>
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
            {lang === 'zh' ? `共 ${accounts.length} 个流动资产与专款钱包 · 独立记账` : `${accounts.length} active wallets & designated reserve vaults`}
          </p>
        </div>

        <button
          onClick={() => setIsAddingAccount(!isAddingAccount)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all active:scale-95 cursor-pointer tactile-press shadow-sm ${
            isAddingAccount
              ? 'bg-zinc-800 text-white dark:bg-zinc-700'
              : 'bg-zinc-950 text-white dark:bg-[#D4FF00] dark:text-black hover:opacity-90'
          }`}
          aria-label="Add wallet"
        >
          {isAddingAccount ? <X size={15} /> : <Plus size={15} />}
          <span>{isAddingAccount ? (lang === 'zh' ? 'CLOSE // 关闭' : 'CLOSE') : (lang === 'zh' ? 'NEW WALLET // 新建钱包' : 'NEW WALLET')}</span>
        </button>
      </div>

      {/* Add Wallet Form (Avant-Garde Tactical Card) */}
      {isAddingAccount && (
        <div className="p-5 sm:p-6 rounded-3xl avant-card border border-zinc-300 dark:border-zinc-800 shadow-xl animate-scale-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-[#D4FF00] flex items-center justify-center font-bold">
              <Wallet size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-zinc-950 dark:text-white uppercase tracking-tight">
                {lang === 'zh' ? '创建新流动钱包' : 'Create New Cash Wallet'}
              </h3>
              <p className="text-[11px] font-mono text-zinc-500">
                {lang === 'zh' ? '添加银行卡、现金包或带收益的活期存款账户' : 'Add a bank account, cash envelope, or interest-bearing vault'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder={lang === 'zh' ? "账户名称 (例如：Maybank、日常现金钱包)" : "Wallet name (e.g., Maybank, Daily Cash)"}
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-950 dark:text-white outline-none focus:border-[#D4FF00] transition-colors font-sans"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              autoFocus
            />

            <div className="flex gap-2">
              <input
                type="number"
                placeholder={lang === 'zh' ? "年利率 %" : "APY %"}
                className="w-24 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-950 dark:text-white outline-none focus:border-[#D4FF00] transition-colors font-mono"
                value={newInterestRate}
                onChange={(e) => setNewInterestRate(e.target.value)}
              />
              <select
                className="px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                value={newInterestFreq}
                onChange={(e) => setNewInterestFreq(e.target.value as any)}
              >
                <option value="NONE">{lang === 'zh' ? '无利息' : 'No Interest'}</option>
                <option value="DAILY">{lang === 'zh' ? '每日复利' : 'Daily Comp.'}</option>
                <option value="MONTHLY">{lang === 'zh' ? '按月计息' : 'Monthly'}</option>
                <option value="YEARLY">{lang === 'zh' ? '按年结算' : 'Yearly'}</option>
              </select>

              <button 
                onClick={addAccount} 
                className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-900 dark:bg-[#D4FF00] dark:text-black dark:hover:bg-[#c2ea00] active:scale-95 text-white font-mono font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md whitespace-nowrap cursor-pointer tactile-press"
              >
                {lang === 'zh' ? 'CONFIRM // 创建' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Cards Grid (Tactile Modular Card Deck) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {accounts.map((acc, index) => {
          const theme = CARD_THEMES[index % CARD_THEMES.length];
          const reserved = getTotalReserved(acc);
          const available = acc.balance - reserved;

          return (
            <div
              key={acc.id}
              onClick={() => setSelectedAccount(acc)}
              className={`rounded-3xl p-5 sm:p-6 ${theme.bg} shadow-lg hover:shadow-2xl hover:scale-[1.015] active:scale-[0.98] transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[200px] sm:min-h-[220px] group tactile-press`}
            >
              {/* Tactical Top Specular Hairline */}
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              
              {/* Top Card Row */}
              <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-6 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-inner">
                    <Wifi size={13} className="text-[#D4FF00] rotate-90" />
                  </div>
                  <div>
                    <span className="font-black text-base tracking-wide block">{acc.name}</span>
                    <span className="font-mono text-[9px] text-zinc-400 block tracking-widest uppercase">ID // {acc.id.slice(-4)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleQuickDelete(e, acc.id)}
                  className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                  title={lang === 'zh' ? "删除钱包" : "Delete Wallet"}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Middle Balance Section */}
              <div className="z-10 my-auto py-2">
                <p className="text-[10px] font-mono uppercase font-bold text-zinc-400 tracking-widest mb-0.5">{lang === 'zh' ? '可用余额 (AVAILABLE)' : 'AVAILABLE BALANCE'}</p>
                <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight font-mono-numbers">
                  RM {available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>

                {reserved > 0 && (
                  <p className="text-xs text-amber-400 font-mono font-bold mt-1.5 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg w-fit">
                    <Lock size={11} /> {lang === 'zh' ? `已锁定 RM ${reserved.toLocaleString()}` : `LOCKED RM ${reserved.toLocaleString()}`}
                  </p>
                )}
              </div>

              {/* Bottom Card Footer */}
              <div className="z-10 flex items-center justify-between pt-3 border-t border-zinc-800">
                {acc.interestRate && acc.interestFrequency !== 'NONE' ? (
                  <span className="text-[10px] font-mono font-black text-[#D4FF00] flex items-center gap-1 bg-[#D4FF00]/10 border border-[#D4FF00]/30 px-2 py-0.5 rounded-md">
                    <TrendingUp size={10} /> +{acc.interestRate}% ({acc.interestFrequency})
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-mono tracking-wider">STANDARD WALLET</span>
                )}

                <span className="text-[11px] font-mono font-bold text-zinc-300 flex items-center gap-1 group-hover:text-white group-hover:translate-x-0.5 transition-all">
                  DETAILS <ArrowUpRight size={13} className="text-[#D4FF00]" />
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
                  <span className="text-[10px] text-gray-400 font-bold uppercase">{lang === 'zh' ? '可用余额' : 'AVAILABLE'}</span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  <span>{lang === 'zh' ? '总计: ' : 'TOTAL: '}<b>RM {selectedAccount.balance.toLocaleString()}</b></span>
                  {getTotalReserved(selectedAccount) > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-bold">
                      <Lock size={10} /> {lang === 'zh' ? `锁定: RM ${getTotalReserved(selectedAccount).toLocaleString()}` : `LOCKED: RM ${getTotalReserved(selectedAccount).toLocaleString()}`}
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
                  {lang === 'zh' ? '收支记账' : 'Cashflow Log'}
                </button>
                <button
                  onClick={() => setModalTab('reserves')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    modalTab === 'reserves' 
                      ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Lock size={12} /> {lang === 'zh' ? '专款准备金' : 'Reserve Vault'}
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
                      title={lang === 'zh' ? "打开简易计算器" : "Open Quick Calculator"}
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
                          {lang === 'zh' ? '填入金额' : 'Insert Amount'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCalc(false)}
                          className="px-3 py-1.5 bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 font-bold text-xs rounded-xl"
                        >
                          {lang === 'zh' ? '关闭' : 'Close'}
                        </button>
                      </div>
                    </div>
                  )}

                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={lang === 'zh' ? "备注说明 (例如：工资发薪、晚餐消费)" : "Notes (e.g., Salary, Dinner, Transfer)"}
                    className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
                  />

                  {/* Actions: Deposit vs Withdraw */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => handleTransaction('IN')}
                      className="py-2.5 rounded-2xl flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-sm border border-emerald-500/20 active:scale-95 transition-all"
                    >
                      <ArrowDownLeft size={16} />
                      <span>{lang === 'zh' ? '记入存入 (Deposit)' : 'Record Deposit (+)'}</span>
                    </button>
                    <button
                      onClick={() => handleTransaction('OUT')}
                      className="py-2.5 rounded-2xl flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-sm border border-rose-500/20 active:scale-95 transition-all"
                    >
                      <ArrowUpRight size={16} />
                      <span>{lang === 'zh' ? '记入支出 (Withdraw)' : 'Record Withdrawal (-)'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Reserves Form */
                <div className="space-y-3 p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Lock size={13} className="text-amber-500" />
                    {lang === 'zh' ? '设置专款锁定金额' : 'Lock Reserved Funds'}
                  </h4>
                  <input
                    type="number"
                    value={resAmount}
                    onChange={(e) => setResAmount(e.target.value)}
                    placeholder={lang === 'zh' ? "锁定金额 (RM)" : "Lock Amount (RM)"}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-900 dark:text-white outline-none"
                  />
                  <input
                    type="text"
                    value={resReason}
                    onChange={(e) => setResReason(e.target.value)}
                    placeholder={lang === 'zh' ? "专款用途 (例如：下月房租、旅游基金)" : "Purpose (e.g., Rent, Emergency Fund)"}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none"
                  />
                  <button
                    onClick={addReservation}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                  >
                    {lang === 'zh' ? '立即锁定专款' : 'Lock Funds Now'}
                  </button>
                </div>
              )}

              {/* History / List View */}
              <div className="pt-3 border-t border-gray-100 dark:border-white/10">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-2">
                  {modalTab === 'transactions' ? (lang === 'zh' ? '历史流水记录' : 'Transaction History') : (lang === 'zh' ? '当前已锁定专款' : 'Active Reserved Funds')}
                </span>

                {modalTab === 'transactions' ? (
                  <div className="space-y-2">
                    {selectedAccount.history.length === 0 ? (
                      <div className="py-8 text-center text-gray-400 text-xs">{lang === 'zh' ? '暂无流水记录' : 'No transactions recorded yet'}</div>
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
                      <div className="py-8 text-center text-gray-400 text-xs">{lang === 'zh' ? '暂无专款准备金' : 'No reserved funds active'}</div>
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
                    {lang === 'zh' ? '取消' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleDeleteFromModal}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-sm"
                  >
                    {lang === 'zh' ? '确认删除此钱包' : 'Confirm Delete Wallet'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 size={13} />
                  <span>{lang === 'zh' ? '删除该账户' : 'Delete This Wallet'}</span>
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