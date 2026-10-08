import React, { useMemo, useState, useEffect } from 'react';
import { Account, MonthlyData, Loan, Stock, Expense, CashHolding, BudgetHistoryItem } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  ArrowUpRight, 
  ArrowDownLeft, 
  PieChart, 
  Lock, 
  Layers, 
  Sparkles, 
  ChevronDown 
} from 'lucide-react';
import { Language, SupportedLanguage, getStoredLanguage } from '../utils/i18n';

interface DashboardProps {
  accounts: Account[];
  monthlyData: MonthlyData;
  fixedExpenses: Expense[];
  loans: Loan[];
  stocks: Stock[];
  exchangeRate: number;
  cash: CashHolding;
  budgetHistory: BudgetHistoryItem[];
}

const Dashboard: React.FC<DashboardProps> = ({ 
  accounts, 
  monthlyData, 
  fixedExpenses, 
  loans, 
  stocks, 
  exchangeRate, 
  cash, 
  budgetHistory 
}) => {

  // 1. Calculate Total Assets (Cash + Stock Value)
  const totalCash = useMemo(() => accounts.reduce((sum, acc) => sum + acc.balance, 0), [accounts]);

  const totalReserved = useMemo(() => accounts.reduce((sum, acc) => {
    const accReserved = acc.reservations ? acc.reservations.reduce((rSum, r) => rSum + r.amount, 0) : 0;
    return sum + accReserved;
  }, 0), [accounts]);

  const availableCash = totalCash - totalReserved;

  // Calculate Stock Value + Free Cash in Investments
  const totalStockValue = useMemo(() => {
    const stocksValue = stocks.reduce((sum, s) => {
      const rate = s.currency === 'USD' ? exchangeRate : 1;
      return sum + (s.currentPrice * s.quantity * rate);
    }, 0);

    const hkdRate = Number(cash.hkdRate || 0.58);
    const cashValue = Number(cash.myr || 0) + (Number(cash.usd || 0) * exchangeRate) + (Number(cash.hkd || 0) * hkdRate);

    return stocksValue + cashValue;
  }, [stocks, exchangeRate, cash]);

  const totalAssets = totalCash + totalStockValue;

  // 2. Calculate Liabilities (Loans)
  const totalLiabilities = useMemo(() => loans.reduce((sum, l) => sum + l.remainingAmount, 0), [loans]);

  // 3. Net Worth (Total Assets)
  const netWorth = totalAssets;

  // 4. Monthly Flows
  const monthlyOneTimeExpenses = useMemo(() => monthlyData.expenses.reduce((sum, e) => sum + e.amount, 0), [monthlyData]);
  const monthlyRecurringExpenses = useMemo(() => fixedExpenses ? fixedExpenses.reduce((sum, e) => sum + e.amount, 0) : 0, [fixedExpenses]);
  const monthlyExpensesTotal = monthlyOneTimeExpenses + monthlyRecurringExpenses;
  const monthlyCashFlow = monthlyData.income - monthlyExpensesTotal;
  const savingsRate = monthlyData.income > 0 ? ((monthlyData.income - monthlyExpensesTotal) / monthlyData.income) * 100 : 0;

  // Helper for Asset Bar
  const availableCashPercent = totalAssets > 0 ? (availableCash / totalAssets) * 100 : 0;
  const reservedCashPercent = totalAssets > 0 ? (totalReserved / totalAssets) * 100 : 0;
  const stockPercent = totalAssets > 0 ? (totalStockValue / totalAssets) * 100 : 0;

  const [lang, setLang] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    const handleLangChange = () => setLang(getStoredLanguage());
    window.addEventListener('apptify_language_change', handleLangChange);
    return () => window.removeEventListener('apptify_language_change', handleLangChange);
  }, []);

  return (
    <div className="space-y-5 sm:space-y-7 animate-fade-in pb-16 font-sans">

      {/* Avant-Garde Masthead */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-extrabold bg-zinc-900 text-[#FFBF00] dark:bg-[#FFBF00] dark:text-black">
              CAPITAL // TERMINAL
            </span>
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              01 // OVERVIEW
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] uppercase text-zinc-950 dark:text-white">
            {lang === 'zh' ? '财务概览与资产透视' : 'Net Worth & Capital Cockpit'}
          </h2>
        </div>

        <div className="text-left sm:text-right font-mono text-xs text-zinc-400 dark:text-zinc-500">
          <span>{new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · {lang === 'zh' ? '实时数据' : 'Live Stream'}</span>
        </div>
      </div>

      {/* Hero: Net Worth — an ink mass carrying the figure */}
      <div className="relative overflow-hidden rounded-[30px] bg-[#0A0A0B] text-white p-6 sm:p-8 group
                      shadow-[0_1px_2px_rgba(10,10,11,0.04),0_18px_44px_-24px_rgba(10,10,11,0.35)]">
        {/* Specular edge refraction — the system has no outer glow */}
        <div className="pointer-events-none absolute inset-0 rounded-[30px] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="signal-dot signal-dot--light shrink-0"></span>
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-white/55 leading-snug">
                {lang === 'zh' ? '总资产净值 (现金 + 目前投资数额 · 不扣减借贷)' : 'TOTAL NET WORTH (CASH + INVESTMENTS · EXCL. LOANS)'}
              </span>
            </div>

            <span className="font-mono text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/10 text-white/60 whitespace-nowrap shrink-0">
              LIVE COCKPIT
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-6">
            <span className="font-mono text-lg sm:text-2xl text-white/45 font-medium uppercase">
              RM
            </span>
            <span className="font-mono font-semibold text-4xl sm:text-6xl lg:text-7xl tracking-[-0.05em] text-white font-mono-numbers">
              {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Metric breakdown — hairlines on ink rather than nested cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-white/10">
            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-white/50 font-medium uppercase tracking-[0.06em]">
                  {lang === 'zh' ? '现金钱包' : 'CASH WALLETS'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              </div>
              <p className="font-mono text-base sm:text-xl font-semibold text-white truncate font-mono-numbers">
                +RM {totalCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] font-mono text-white/40 mt-0.5">
                {lang === 'zh' ? '多币种钱包与银行账户' : 'Multi-currency & bank accounts'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-white/50 font-medium uppercase tracking-[0.06em]">
                  {lang === 'zh' ? '目前投资数额' : 'ACTIVE INVESTMENTS'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-white/55"></span>
              </div>
              <p className="font-mono text-base sm:text-xl font-semibold text-white truncate font-mono-numbers">
                +RM {totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] font-mono text-white/40 mt-0.5">
                {lang === 'zh' ? '持仓市值与券商闲置本金' : 'Securities & broker cash'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/10" title={lang === 'zh' ? "贷款为独立履约跟踪，不从总数中扣减" : "Tracked independently, excluded from net worth"}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-white/50 font-medium uppercase tracking-[0.06em]">
                  {lang === 'zh' ? '履约借贷 (独立跟踪)' : 'TOTAL LIABILITIES (INDEP.)'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFBF00]"></span>
              </div>
              <p className="font-mono text-base sm:text-xl font-semibold text-[#FFBF00] truncate font-mono-numbers">
                RM {totalLiabilities.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] font-mono text-white/40 mt-0.5">
                {lang === 'zh' ? '进行中负债分期总额' : 'Active loans & installments'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Asset Structure & Monthly Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Asset Structure Card */}
        <div className="avant-card p-6 sm:p-7 rounded-3xl lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-6 pb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#FFBF00] text-[#0A0A0B] flex items-center justify-center font-bold shrink-0">
                  <PieChart size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-base sm:text-lg leading-8 text-zinc-950 dark:text-white uppercase tracking-tight whitespace-nowrap">
                    {lang === 'zh' ? '资产构成配比' : 'Asset Allocation'}
                  </h3>
                  <span className="font-mono text-[9px] text-zinc-400 uppercase">ASSET ALLOCATION RATIO</span>
                </div>
              </div>
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                {lang === 'zh' ? '总资产' : 'TOTAL ASSETS'} RM {totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Visual Stream Bars */}
            <div className="space-y-6">
              {/* Cash Row */}
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-2 font-mono">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {lang === 'zh' ? '现金与钱包' : 'Cash & Wallets'}
                  </span>
                  <span className="font-bold text-zinc-950 dark:text-white">RM {totalCash.toLocaleString()}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-zinc-100 dark:bg-zinc-800/80 overflow-hidden flex p-0.5 border border-zinc-200/50 dark:border-zinc-700/50">
                  <div style={{ width: `${availableCashPercent}%` }} className="h-full bg-emerald-500 rounded-full transition-all duration-500" />
                  <div style={{ width: `${reservedCashPercent}%` }} className="h-full bg-amber-400 rounded-full ml-1 transition-all duration-500" />
                </div>
                <div className="flex justify-between mt-1.5 text-[11px] font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">RM {availableCash.toLocaleString()} {lang === 'zh' ? '可支配' : 'Available'}</span>
                  {totalReserved > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <Lock size={10} /> RM {totalReserved.toLocaleString()} {lang === 'zh' ? '锁定准备金' : 'Locked Reserves'}
                    </span>
                  )}
                </div>
              </div>

              {/* Stock Row */}
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-2 font-mono">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> {lang === 'zh' ? '股票与证券持仓' : 'Equities & Holdings'}
                  </span>
                  <span className="font-bold text-zinc-950 dark:text-white">RM {totalStockValue.toLocaleString()}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-zinc-100 dark:bg-zinc-800/80 overflow-hidden p-0.5 border border-zinc-200/50 dark:border-zinc-700/50">
                  <div style={{ width: `${stockPercent}%` }} className="h-full bg-cyan-500 rounded-full transition-all duration-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Mini Stat Pills */}
          <div className="mt-6 pt-5 border-t border-zinc-200/60 dark:border-zinc-800/60 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/50 text-center font-mono">
              <p className="text-[10px] text-zinc-400 uppercase font-bold mb-0.5">{lang === 'zh' ? '可用流动率' : 'Liquidity Ratio'}</p>
              <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">{availableCashPercent.toFixed(0)}%</p>
            </div>
            {totalReserved > 0 && (
              <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/50 text-center font-mono">
                <p className="text-[10px] text-zinc-400 uppercase font-bold mb-0.5">{lang === 'zh' ? '专款锁定率' : 'Reserve Ratio'}</p>
                <p className="text-base sm:text-lg font-black text-amber-500">{reservedCashPercent.toFixed(0)}%</p>
              </div>
            )}
            <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/50 text-center font-mono">
              <p className="text-[10px] text-zinc-400 uppercase font-bold mb-0.5">{lang === 'zh' ? '投资仓位比' : 'Equities Ratio'}</p>
              <p className="text-base sm:text-lg font-black text-cyan-600 dark:text-cyan-400">{stockPercent.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        {/* Monthly Pulse / Budget Health */}
        <div className="avant-card p-6 sm:p-7 rounded-3xl flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4 pb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#FFBF00] text-[#0A0A0B] flex items-center justify-center font-bold shrink-0">
                <Layers size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-base sm:text-lg leading-8 text-zinc-950 dark:text-white uppercase tracking-tight whitespace-nowrap">
                  {lang === 'zh' ? '本月现金脉搏' : 'Monthly Cash Pulse'}
                </h3>
                <span className="font-mono text-[9px] text-zinc-400 uppercase">MONTHLY CASH PULSE</span>
              </div>
            </div>
          </div>

          <div className="space-y-3.5 my-auto">
            {/* Income */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 font-mono">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#FFBF00] text-[#0A0A0B] flex items-center justify-center font-bold shrink-0">
                  <ArrowDownLeft size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">{lang === 'zh' ? '总收入计划' : 'Planned Income'}</p>
                  <p className="font-black text-sm sm:text-base text-zinc-950 dark:text-white">RM {monthlyData.income.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Expenses */}
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFBF00] text-[#0A0A0B] flex items-center justify-center font-bold shrink-0">
                    <ArrowUpRight size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold">{lang === 'zh' ? '总支出合计' : 'Total Planned Expenses'}</p>
                    <p className="font-black text-sm sm:text-base text-zinc-950 dark:text-white">RM {monthlyExpensesTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Sub-breakdown */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-rose-500/20 text-[10px]">
                <div className="text-zinc-500 dark:text-zinc-400">
                  {lang === 'zh' ? '日常浮动' : 'Variable'}: <span className="font-bold text-zinc-800 dark:text-zinc-200">RM {monthlyOneTimeExpenses.toLocaleString()}</span>
                </div>
                <div className="text-zinc-500 dark:text-zinc-400 text-right">
                  {lang === 'zh' ? '固定周期' : 'Recurring'}: <span className="font-bold text-zinc-800 dark:text-zinc-200">RM {monthlyRecurringExpenses.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Net Flow Result Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60 font-mono">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold uppercase">{lang === 'zh' ? '净现金流 (NET FLOW)' : 'NET CASH FLOW'}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${monthlyCashFlow >= 0 ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/60' : 'text-rose-700 bg-rose-100 dark:text-rose-400 dark:bg-rose-950/60'}`}>
                  {savingsRate.toFixed(0)}% {lang === 'zh' ? '储蓄率' : 'Savings Rate'}
                </span>
              </div>
              <p className={`text-2xl font-black ${monthlyCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {monthlyCashFlow >= 0 ? '+' : ''} RM {monthlyCashFlow.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Monthly History Section */}
      <MonthlyHistory accounts={accounts} fixedExpenses={fixedExpenses} monthlyData={monthlyData} budgetHistory={budgetHistory} lang={lang} />

      {/* Liability Summary if debts exist */}
      {loans.length > 0 && (
        <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between font-mono">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <TrendingDown size={22} />
            </div>
            <div>
              <p className="font-black text-rose-700 dark:text-rose-400 text-base sm:text-lg uppercase">{lang === 'zh' ? '未结清借贷账目' : 'Outstanding Liabilities'}</p>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">{lang === 'zh' ? `当前共有 ${loans.length} 笔独立履约负债账户` : `${loans.length} active liability commitments`}</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{lang === 'zh' ? '剩余本金合计' : 'Remaining Principal'}</p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400">RM {totalLiabilities.toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Monthly History Sub-Component ---
interface MonthlyHistoryProps {
  accounts: Account[];
  fixedExpenses: Expense[];
  monthlyData: MonthlyData;
  budgetHistory: BudgetHistoryItem[];
  lang?: SupportedLanguage;
}

const MonthlyHistory: React.FC<MonthlyHistoryProps> = ({ accounts, fixedExpenses, monthlyData, budgetHistory, lang = 'en' }) => {
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<'actual' | 'budget'>('actual');

  const historyData = useMemo(() => {
    const months = new Set<string>();

    if (monthlyData && monthlyData.targetDate) {
      months.add(monthlyData.targetDate);
    }
    if (budgetHistory) {
      budgetHistory.forEach(h => {
        if (h.month) months.add(h.month);
      });
    }
    if (accounts) {
      accounts.forEach(acc => {
        if (acc.history) {
          acc.history.forEach(tx => {
            if (tx.date) months.add(tx.date.slice(0, 7));
          });
        }
      });
    }

    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));

    return sortedMonths.map(month => {
      let actualIn = 0;
      let actualOut = 0;
      if (accounts) {
        accounts.forEach(acc => {
          if (acc.history) {
            acc.history.forEach(tx => {
              if (tx.date && tx.date.startsWith(month)) {
                if (tx.type === 'IN') actualIn += tx.amount;
                else if (tx.type === 'OUT') actualOut += tx.amount;
              }
            });
          }
        });
      }
      const actualBalance = actualIn - actualOut;

      let budgetIn = 0;
      let budgetOut = 0;
      if (monthlyData && monthlyData.targetDate === month) {
        budgetIn = monthlyData.income;
        const currentVariableExpenses = monthlyData.expenses || [];
        const allExp = [...(fixedExpenses || []), ...currentVariableExpenses];
        budgetOut = allExp.reduce((sum, item) => sum + item.amount, 0);
      } else {
        const histItem = budgetHistory?.find(h => h.month === month);
        if (histItem) {
          budgetIn = histItem.income;
          budgetOut = histItem.totalExpenses;
        }
      }
      const budgetBalance = budgetIn - budgetOut;

      return {
        month,
        actual: { totalIn: actualIn, totalOut: actualOut, balance: actualBalance },
        budget: { totalIn: budgetIn, totalOut: budgetOut, balance: budgetBalance }
      };
    });
  }, [accounts, fixedExpenses, monthlyData, budgetHistory]);

  const displayData = showAll ? historyData : historyData.slice(0, 6);

  // Monthly flow chart series. Bars are scaled against the largest single
  // figure in the window so inflow and outflow stay directly comparable.
  const flowChart = useMemo(() => {
    const rows = displayData.map((item) => {
      const d = viewMode === 'actual' ? item.actual : item.budget;
      return {
        month: item.month,
        inflow: d.totalIn || 0,
        outflow: d.totalOut || 0,
        balance: d.balance || 0,
      };
    });
    const peak = Math.max(1, ...rows.map((r) => Math.max(r.inflow, r.outflow)));
    return rows.map((r) => ({
      ...r,
      inPct: Math.max(r.inflow > 0 ? 3 : 0, Math.round((r.inflow / peak) * 100)),
      outPct: Math.max(r.outflow > 0 ? 3 : 0, Math.round((r.outflow / peak) * 100)),
    }));
  }, [displayData, viewMode]);

  const flowTotals = useMemo(() => {
    const inflow = flowChart.reduce((a, r) => a + r.inflow, 0);
    const outflow = flowChart.reduce((a, r) => a + r.outflow, 0);
    return { inflow, outflow, net: inflow - outflow };
  }, [flowChart]);

  if (historyData.length === 0) return null;

  return (
    <div className="w-full space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#FFBF00] text-[#0A0A0B] flex items-center justify-center font-bold shrink-0">
            <Activity size={16} />
          </div>
          <div>
            <h3 className="font-black text-base sm:text-lg leading-8 text-zinc-950 dark:text-white uppercase tracking-tight whitespace-nowrap">
              {lang === 'zh' ? '历史月度对账账目表' : 'Monthly Reconciliation'}
            </h3>
            <span className="font-mono text-[9px] text-zinc-400 uppercase">MONTHLY RECONCILIATION LEDGER</span>
          </div>
        </div>

        {/* Mode Toggle Switch */}
        <div className="flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200/70 dark:border-zinc-700/60 font-mono text-xs font-bold w-fit">
          <button
            onClick={() => setViewMode('actual')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === 'actual' 
                ? 'bg-zinc-950 dark:bg-[#FFBF00] text-[#FFBF00] dark:text-black shadow-xs' 
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            {lang === 'zh' ? '实际钱包流水' : 'Actual Cash Flow'}
          </button>
          <button
            onClick={() => setViewMode('budget')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === 'budget' 
                ? 'bg-zinc-950 dark:bg-[#FFBF00] text-[#FFBF00] dark:text-black shadow-xs' 
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            {lang === 'zh' ? '预算规划收支' : 'Budget Projection'}
          </button>
        </div>
      </div>

      {/* Monthly flow — the shape of the ledger at a glance */}
      <div className="avant-card rounded-3xl p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <span className="signal-label text-black/45 dark:text-white/45">
              {lang === 'zh' ? '月度现金流' : 'Monthly cash flow'}
            </span>
            <p className="mt-1 text-[12px] text-black/50 dark:text-white/50">
              {lang === 'zh'
                ? '蓝 = 流入 · 墨 = 流出 · 底部为当月经结余'
                : 'Blue = inflow · ink = outflow · net below each month'}
            </p>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-black/60 dark:text-white/60">
              <i className="w-2.5 h-2.5 rounded-[3px] bg-[#2600FD]" />
              {lang === 'zh' ? '流入' : 'IN'}
            </span>
            <span className="flex items-center gap-1.5 text-black/60 dark:text-white/60">
              <i className="w-2.5 h-2.5 rounded-[3px] bg-[#0A0A0B] dark:bg-white" />
              {lang === 'zh' ? '流出' : 'OUT'}
            </span>
          </div>
        </div>

        <div className="flex items-end gap-1.5 sm:gap-3 h-44">
          {flowChart.map((row) => (
            <div key={row.month} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-2">
              <div className="flex items-end justify-center gap-1 w-full flex-1 min-h-0">
                <div
                  className="w-1/2 max-w-[16px] rounded-t-[4px] bg-[#2600FD] transition-[height] duration-500"
                  style={{ height: `${row.inPct}%` }}
                  title={`${lang === 'zh' ? '流入' : 'Inflow'}: RM ${row.inflow.toLocaleString()}`}
                />
                <div
                  className="w-1/2 max-w-[16px] rounded-t-[4px] bg-[#0A0A0B] dark:bg-white/85 transition-[height] duration-500"
                  style={{ height: `${row.outPct}%` }}
                  title={`${lang === 'zh' ? '流出' : 'Outflow'}: RM ${row.outflow.toLocaleString()}`}
                />
              </div>
              <span className="w-full text-center font-mono text-[9px] text-black/40 dark:text-white/40 truncate">
                {row.month}
              </span>
              <span
                className={`w-full text-center font-mono text-[10px] font-semibold font-mono-numbers ${
                  row.balance >= 0 ? 'text-[#2600FD]' : 'text-[#0A0A0B] dark:text-white'
                }`}
              >
                {row.balance >= 0 ? '+' : ''}
                {Math.round(row.balance).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-black/[0.08] dark:border-white/[0.09] grid grid-cols-3 gap-3">
          <div>
            <span className="signal-label block text-black/40 dark:text-white/40">
              {lang === 'zh' ? '总流入' : 'Total in'}
            </span>
            <p className="mt-1 font-mono font-semibold text-[15px] font-mono-numbers text-[#2600FD]">
              +RM {Math.round(flowTotals.inflow).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="signal-label block text-black/40 dark:text-white/40">
              {lang === 'zh' ? '总流出' : 'Total out'}
            </span>
            <p className="mt-1 font-mono font-semibold text-[15px] font-mono-numbers text-[#0A0A0B] dark:text-white">
              -RM {Math.round(flowTotals.outflow).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="signal-label block text-black/40 dark:text-white/40">
              {lang === 'zh' ? '净结余' : 'Net'}
            </span>
            <p className={`mt-1 font-mono font-semibold text-[15px] font-mono-numbers ${
              flowTotals.net >= 0 ? 'text-[#2600FD]' : 'text-[#0A0A0B] dark:text-white'
            }`}>
              {flowTotals.net >= 0 ? '+' : ''}RM {Math.round(flowTotals.net).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="avant-card rounded-3xl overflow-hidden p-4 sm:p-6">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider border-b border-zinc-200/60 dark:border-zinc-800/60">
                <th className="pb-3 pl-2 text-left">{lang === 'zh' ? '月份 // CYCLE' : 'MONTH // CYCLE'}</th>
                <th className="pb-3 text-right">{lang === 'zh' ? '总流入 // INFLOW' : 'INFLOW (+)'}</th>
                <th className="pb-3 text-right">{lang === 'zh' ? '总流出 // OUTFLOW' : 'OUTFLOW (-)'}</th>
                <th className="pb-3 text-right pr-2">{lang === 'zh' ? '净结余 // BALANCE' : 'NET BALANCE'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/50 font-mono">
              {displayData.map((item) => {
                const data = viewMode === 'actual' ? item.actual : item.budget;
                return (
                  <tr key={item.month} className="hover:bg-zinc-100/60 dark:hover:bg-white/5 transition-colors text-sm font-medium">
                    <td className="py-3.5 pl-2 font-black text-zinc-950 dark:text-white text-left">
                      {item.month}
                    </td>
                    <td className="py-3.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                      +RM {data.totalIn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3.5 text-right text-rose-600 dark:text-rose-400 font-bold">
                      -RM {data.totalOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`py-3.5 text-right pr-2 font-black ${data.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {data.balance >= 0 ? '+' : ''}RM {data.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {historyData.length > 6 && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 px-5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer border border-zinc-200/70 dark:border-zinc-700/60"
            >
              {showAll ? (lang === 'zh' ? '收起更少' : 'Show Less') : (lang === 'zh' ? `展开查看更多 (${historyData.length} 个月)` : `Show More (${historyData.length} Months)`)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;