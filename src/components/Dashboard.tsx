import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Account, MonthlyData, Loan, Stock, Expense, CashHolding, BudgetHistoryItem } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
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
  ChevronDown,
  ChevronLeft,
  ChevronRight
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

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const fmtRM = (val: number) =>
  Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtAxis = (val: number) => {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  return `${val}`;
};

interface ActualChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: any }>;
  lang: SupportedLanguage;
}

const ActualChartTooltip: React.FC<ActualChartTooltipProps> = ({ active, payload, lang }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      style={{
        backgroundColor: '#0A0A0B',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: '14px',
        padding: '12px 14px',
        boxShadow: '0 16px 36px -14px rgba(10,10,11,0.55)',
        minWidth: '220px'
      }}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15">
        <span className="font-mono text-[11px] font-black text-[#FFBF00]">{row.month}</span>
        <span className="font-mono text-[10px] text-white/50">
          {lang === 'zh' ? '实际现金流' : 'ACTUAL FLOW'}
        </span>
      </div>
      <div className="space-y-2 text-xs">
        <div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-white/80">
              <i className="w-2 h-2 rounded-full bg-[#2600FD] inline-block" />
              {lang === 'zh' ? 'Wallet 进账' : 'Wallet In'}
            </span>
            <span className="font-bold font-mono-numbers text-white">+RM {fmtRM(row.walletIn)}</span>
          </div>
          <div className="text-[10px] text-white/45 text-right font-mono-numbers">
            {lang === 'zh' ? '原本余额' : 'Opening'}: {row.walletOpening < 0 ? '-' : ''}RM {fmtRM(row.walletOpening)}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-white/80">
              <i className="w-2 h-2 rounded-full bg-[#FFBF00] inline-block" />
              {lang === 'zh' ? 'Budget剩+钱包' : 'Budget+Wallets'}
            </span>
            <span className="font-bold font-mono-numbers text-[#FFBF00]">
              {row.budgetPlusWallets < 0 ? '-' : ''}RM {fmtRM(row.budgetPlusWallets)}
            </span>
          </div>
          <div className="text-[10px] text-white/45 text-right font-mono-numbers">
            {lang === 'zh' ? '预算' : 'Budget'} {row.budgetRemaining < 0 ? '-' : ''}RM {fmtRM(row.budgetRemaining)} + {lang === 'zh' ? '钱包' : 'Wallets'} {row.walletClosing < 0 ? '-' : ''}RM {fmtRM(row.walletClosing)}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-white/80">
              <i className="w-2 h-2 rounded-full bg-white/75 inline-block" />
              {lang === 'zh' ? '本月共花' : 'Total Spent'}
            </span>
            <span className="font-bold font-mono-numbers text-white">-RM {fmtRM(row.totalSpent)}</span>
          </div>
          <div className="text-[10px] text-white/45 text-right font-mono-numbers">
            Wallet RM {fmtRM(row.walletOut)} · Budget RM {fmtRM(row.budgetOut)}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ProjectionChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: any }>;
  lang: SupportedLanguage;
}

const ProjectionChartTooltip: React.FC<ProjectionChartTooltipProps> = ({ active, payload, lang }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      style={{
        backgroundColor: '#0A0A0B',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: '14px',
        padding: '12px 14px',
        boxShadow: '0 16px 36px -14px rgba(10,10,11,0.55)',
        minWidth: '215px'
      }}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15">
        <span className="font-mono text-[11px] font-black text-[#FFBF00]">{row.month}</span>
        <span className="font-mono text-[10px] text-white/50">
          {lang === 'zh' ? '收支对照' : 'PROJECTION'}
        </span>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-white/80">
            <i className="w-2 h-2 rounded-full bg-[#2600FD] inline-block" />
            {lang === 'zh' ? '进 Wallet 现金' : 'Wallet Cash In'}
          </span>
          <span className="font-bold font-mono-numbers text-white">+RM {fmtRM(row.inflow)}</span>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-white/80">
              <i className="w-2 h-2 rounded-full bg-white/75 inline-block" />
              {lang === 'zh' ? 'Budget+Wallets 支出' : 'Budget+Wallets Out'}
            </span>
            <span className="font-bold font-mono-numbers text-white">-RM {fmtRM(row.outflow)}</span>
          </div>
          <div className="text-[10px] text-white/45 text-right font-mono-numbers">
            Budget RM {fmtRM(row.budgetOut)} · Wallets RM {fmtRM(row.walletOut)}
          </div>
        </div>

        <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-4">
          <span className="text-[11px] font-mono font-bold text-white/70">
            {lang === 'zh' ? '净差额 (NET)' : 'NET BALANCE'}
          </span>
          <span
            className="text-xs font-black font-mono-numbers px-1.5 py-0.5 rounded-md"
            style={{
              backgroundColor: row.balance >= 0 ? '#FFBF00' : 'rgba(244,63,94,0.22)',
              color: row.balance >= 0 ? '#0A0A0B' : '#FDA4AF'
            }}
          >
            {row.balance >= 0 ? '+' : '-'}RM {fmtRM(row.balance)}
          </span>
        </div>
      </div>
    </div>
  );
};

const MonthlyHistory: React.FC<MonthlyHistoryProps> = ({ accounts, fixedExpenses, monthlyData, budgetHistory, lang = 'en' }) => {
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<'actual' | 'budget'>('actual');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({ canLeft: false, canRight: false });

  const historyData = useMemo(() => {
    const months = new Set<string>();

    if (monthlyData && monthlyData.targetDate) {
      months.add(monthlyData.targetDate);
    }
    if (budgetHistory) {
      budgetHistory.forEach((h) => {
        if (h.month) months.add(h.month);
      });
    }
    if (accounts) {
      accounts.forEach((acc) => {
        if (acc.history) {
          acc.history.forEach((tx) => {
            if (tx.date) months.add(tx.date.slice(0, 7));
          });
        }
      });
    }

    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
    const currentWalletTotal = round2((accounts || []).reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0));

    return sortedMonths.map((month) => {
      let walletIn = 0;
      let walletOut = 0;
      let futureNet = 0;

      if (accounts) {
        accounts.forEach((acc) => {
          if (acc.history) {
            acc.history.forEach((tx) => {
              if (!tx.date) return;
              const txMonth = tx.date.slice(0, 7);
              const amt = Number(tx.amount) || 0;
              if (txMonth === month) {
                if (tx.type === 'IN') walletIn += amt;
                else if (tx.type === 'OUT') walletOut += amt;
              } else if (txMonth > month) {
                futureNet += tx.type === 'IN' ? amt : -amt;
              }
            });
          }
        });
      }

      walletIn = round2(walletIn);
      walletOut = round2(walletOut);
      const walletClosing = round2(currentWalletTotal - futureNet);
      const walletOpening = round2(walletClosing - walletIn + walletOut);

      let budgetIn = 0;
      let budgetOut = 0;
      if (monthlyData && monthlyData.targetDate === month) {
        budgetIn = Number(monthlyData.income) || 0;
        const currentVariableExpenses = monthlyData.expenses || [];
        const allExp = [...(fixedExpenses || []), ...currentVariableExpenses];
        budgetOut = round2(allExp.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
      } else {
        const histItem = budgetHistory?.find((h) => h.month === month);
        if (histItem) {
          budgetIn = Number(histItem.income) || 0;
          budgetOut = Number(histItem.totalExpenses) || 0;
        }
      }

      const budgetRemaining = round2(budgetIn - budgetOut);
      const budgetPlusWallets = round2(budgetRemaining + walletClosing);
      const totalSpent = round2(budgetOut + walletOut);
      const projectionNet = round2(walletIn - totalSpent);

      return {
        month,
        walletIn,
        walletOut,
        walletOpening,
        walletClosing,
        budgetIn,
        budgetOut,
        budgetRemaining,
        budgetPlusWallets,
        totalSpent,
        projectionNet
      };
    });
  }, [accounts, fixedExpenses, monthlyData, budgetHistory]);

  // Charts show up to the most recent 12 months (1 year); table shows 12 by default with Show More for older records
  const yearlyData = useMemo(() => historyData.slice(0, 12), [historyData]);
  const displayData = showAll ? historyData : yearlyData;

  const activeMonthRow = useMemo(() => {
    if (historyData.length === 0) return null;
    if (selectedMonth) {
      const found = historyData.find((item) => item.month === selectedMonth);
      if (found) return found;
    }
    if (monthlyData?.targetDate) {
      const current = historyData.find((item) => item.month === monthlyData.targetDate);
      if (current) return current;
    }
    return historyData[0];
  }, [historyData, selectedMonth, monthlyData]);

  // Chronological series (oldest -> newest, up to 12 months) for Actual Cash Flow grouped bar chart
  const actualChartData = useMemo(() => {
    return [...yearlyData].reverse().map((item) => ({
      ...item,
      budgetPlusWalletsBar: Math.max(0, item.budgetPlusWallets)
    }));
  }, [yearlyData]);

  // Budget Projection flow chart series (chronological oldest -> newest, up to 12 months):
  // Blue bar = cash into wallets (walletIn)
  // Ink bar  = combined spend across budget + wallets (totalSpent)
  const projectionChart = useMemo(() => {
    return [...yearlyData].reverse().map((item) => ({
      month: item.month,
      inflow: item.walletIn,
      outflow: item.totalSpent,
      budgetOut: item.budgetOut,
      walletOut: item.walletOut,
      balance: item.projectionNet
    }));
  }, [yearlyData]);

  const projectionTotals = useMemo(() => {
    const inflow = round2(projectionChart.reduce((a, r) => a + r.inflow, 0));
    const outflow = round2(projectionChart.reduce((a, r) => a + r.outflow, 0));
    const budgetOut = round2(projectionChart.reduce((a, r) => a + r.budgetOut, 0));
    const walletOut = round2(projectionChart.reduce((a, r) => a + r.walletOut, 0));
    return { inflow, outflow, budgetOut, walletOut, net: round2(inflow - outflow) };
  }, [projectionChart]);

  const updateScrollButtons = () => {
    const el = chartScrollRef.current;
    if (!el) {
      setScrollState({ canLeft: false, canRight: false });
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setScrollState({
      canLeft: el.scrollLeft > 4,
      canRight: maxScroll - el.scrollLeft > 4
    });
  };

  // Auto-scroll chart viewport to the latest month (rightmost) whenever mode or month count changes
  useEffect(() => {
    const el = chartScrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
      updateScrollButtons();
    });
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [viewMode, yearlyData.length]);

  const scrollChartBy = (delta: number) => {
    const el = chartScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const actualChartMinWidth = actualChartData.length > 5 ? `${actualChartData.length * 108}px` : '100%';
  const projectionChartMinWidth = projectionChart.length > 6 ? `${projectionChart.length * 92}px` : '100%';

  if (historyData.length === 0) return null;

  return (
    <div className="w-full space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#FFBF00] text-[#0A0A0B] flex items-center justify-center font-bold shrink-0">
            <Activity size={16} />
          </div>
          <div>
            <h3 className="font-black text-base sm:text-lg leading-8 text-zinc-950 uppercase tracking-tight whitespace-nowrap">
              {lang === 'zh' ? '历史月度对账账目表' : 'Monthly Reconciliation'}
            </h3>
            <span className="font-mono text-[9px] text-zinc-400 uppercase">MONTHLY RECONCILIATION LEDGER</span>
          </div>
        </div>

        {/* Mode Toggle Switch */}
        <div className="flex p-1 rounded-xl bg-zinc-100 border border-zinc-200/70 font-mono text-xs font-bold w-fit">
          <button
            onClick={() => setViewMode('actual')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === 'actual'
                ? 'bg-zinc-950 text-[#FFBF00] shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            {lang === 'zh' ? '实际现金流' : 'Actual Cash Flow'}
          </button>
          <button
            onClick={() => setViewMode('budget')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === 'budget'
                ? 'bg-zinc-950 text-[#FFBF00] shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            {lang === 'zh' ? '预算收支对照' : 'Budget Projection'}
          </button>
        </div>
      </div>

      {viewMode === 'actual' && activeMonthRow ? (
        <>
          {/* Actual Cash Flow — 3-pillar snapshot for the active/selected month */}
          <div className="avant-card rounded-3xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-200/70">
              <div>
                <span className="signal-label text-black/45">
                  {lang === 'zh' ? '实际现金流快照' : 'Actual Cash Flow Snapshot'}
                </span>
                <p className="mt-0.5 text-[12px] text-black/50">
                  {lang === 'zh'
                    ? '点击下方任意月份行可切换查看该月现金入账、可用总资金与支出明细'
                    : 'Select any month row below to inspect wallet cash in, combined cash, and total spend'}
                </p>
              </div>
              <span className="font-mono text-xs font-black px-3 py-1 rounded-full bg-[#0A0A0B] text-[#FFBF00]">
                {activeMonthRow.month}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* 1. Wallet Cash In & Opening Wallet Balance */}
              <div className="p-4 rounded-2xl bg-zinc-50/90 border border-zinc-200/80 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {lang === 'zh' ? '01 // 本月进账 & 原本余额' : '01 // WALLET IN & OPENING'}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#2600FD]" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-zinc-500">
                    {lang === 'zh' ? '本月进入 Wallet 现金' : 'Cash Into Wallets'}
                  </p>
                  <p className="text-2xl font-black font-mono-numbers text-[#2600FD] mt-0.5">
                    +RM {fmtRM(activeMonthRow.walletIn)}
                  </p>
                </div>
                <div className="pt-2.5 border-t border-zinc-200/80 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-medium">
                    {lang === 'zh' ? '原本 Wallet 余额' : 'Opening Wallet'}
                  </span>
                  <span className="font-bold font-mono-numbers text-zinc-900">
                    {activeMonthRow.walletOpening < 0 ? '-' : ''}RM {fmtRM(activeMonthRow.walletOpening)}
                  </span>
                </div>
              </div>

              {/* 2. Budget Remaining + Total Wallets Cash */}
              <div className="p-4 rounded-2xl bg-[#0A0A0B] text-white border border-zinc-900 flex flex-col justify-between gap-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#FFBF00]">
                    {lang === 'zh' ? '02 // BUDGET 剩余 + WALLETS' : '02 // BUDGET LEFT + WALLETS'}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#FFBF00]" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-white/60">
                    {lang === 'zh' ? '本月 Budget 结余 + Wallets 整体现金' : 'Budget Remaining + Total Wallets Cash'}
                  </p>
                  <p className="text-2xl font-black font-mono-numbers text-white mt-0.5">
                    {activeMonthRow.budgetPlusWallets < 0 ? '-' : ''}RM {fmtRM(activeMonthRow.budgetPlusWallets)}
                  </p>
                </div>
                <div className="pt-2.5 border-t border-white/15 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="block text-white/45">{lang === 'zh' ? 'Budget 剩余' : 'Budget Left'}</span>
                    <span className={`font-bold font-mono-numbers ${activeMonthRow.budgetRemaining >= 0 ? 'text-white' : 'text-[#FFBF00]'}`}>
                      {activeMonthRow.budgetRemaining < 0 ? '-' : ''}RM {fmtRM(activeMonthRow.budgetRemaining)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-white/45">{lang === 'zh' ? 'Wallets 整体现金' : 'Wallets Total'}</span>
                    <span className="font-bold font-mono-numbers text-white">
                      {activeMonthRow.walletClosing < 0 ? '-' : ''}RM {fmtRM(activeMonthRow.walletClosing)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Total Spent This Month & Wallet Outflow */}
              <div className="p-4 rounded-2xl bg-zinc-50/90 border border-zinc-200/80 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {lang === 'zh' ? '03 // 本月共花 & WALLET 支出' : '03 // TOTAL SPENT & WALLET OUT'}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#0A0A0B]" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-zinc-500">
                    {lang === 'zh' ? '本月共花费 (Budget + Wallets)' : 'Total Spent (Budget + Wallets)'}
                  </p>
                  <p className="text-2xl font-black font-mono-numbers text-zinc-950 mt-0.5">
                    -RM {fmtRM(activeMonthRow.totalSpent)}
                  </p>
                </div>
                <div className="pt-2.5 border-t border-zinc-200/80 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="block text-zinc-400">{lang === 'zh' ? 'Wallet 支出' : 'Wallet Spent'}</span>
                    <span className="font-bold font-mono-numbers text-rose-600">
                      -RM {fmtRM(activeMonthRow.walletOut)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-zinc-400">{lang === 'zh' ? 'Budget 支出' : 'Budget Spent'}</span>
                    <span className="font-bold font-mono-numbers text-zinc-800">
                      -RM {fmtRM(activeMonthRow.budgetOut)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actual Cash Flow Interactive Bar Chart (Up to 12 Months, Horizontally Scrollable) */}
            <div className="pt-4 border-t border-zinc-200/70">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {lang === 'zh' ? '月度三维度趋势对比 (点击柱子切换月份)' : 'MONTHLY 3-PILLAR COMPARISON (CLICK BAR TO INSPECT)'}
                  </span>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                    {lang === 'zh'
                      ? `近 ${actualChartData.length} 个月 / 最多 12 月`
                      : `${actualChartData.length} / 12 MO`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3.5 font-mono text-[11px]">
                  <span className="flex items-center gap-1.5 text-zinc-600">
                    <i className="w-2.5 h-2.5 rounded-[3px] bg-[#2600FD] inline-block" />
                    {lang === 'zh' ? 'Wallet 进账' : 'Wallet In'}
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-600">
                    <i className="w-2.5 h-2.5 rounded-[3px] bg-[#FFBF00] inline-block" />
                    {lang === 'zh' ? 'Budget 剩 + 钱包' : 'Budget Left + Wallets'}
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-600">
                    <i className="w-2.5 h-2.5 rounded-[3px] bg-[#0A0A0B] inline-block" />
                    {lang === 'zh' ? '本月共花' : 'Total Spent'}
                  </span>

                  {(scrollState.canLeft || scrollState.canRight) && (
                    <div className="flex items-center gap-1 pl-1 border-l border-zinc-200">
                      <button
                        type="button"
                        onClick={() => scrollChartBy(-280)}
                        disabled={!scrollState.canLeft}
                        className="w-6 h-6 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title={lang === 'zh' ? '向左滑动查看更多月份' : 'Scroll left'}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollChartBy(280)}
                        disabled={!scrollState.canRight}
                        className="w-6 h-6 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title={lang === 'zh' ? '向右滑动查看较新月份' : 'Scroll right'}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={chartScrollRef}
                onScroll={updateScrollButtons}
                className="w-full overflow-x-auto pb-2 scroll-smooth"
              >
                <div style={{ width: actualChartMinWidth, minWidth: '100%' }} className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={actualChartData}
                      margin={{ top: 14, right: 16, left: -6, bottom: 4 }}
                      barGap={6}
                      onClick={(state: any) => {
                        if (state && state.activeLabel) {
                          setSelectedMonth(String(state.activeLabel));
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(10,10,11,0.08)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: '#717177', fontFamily: 'monospace' }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis
                        tickFormatter={fmtAxis}
                        tick={{ fontSize: 10, fill: '#717177', fontFamily: 'monospace' }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <Tooltip
                        content={<ActualChartTooltip lang={lang} />}
                        cursor={{ fill: 'rgba(38, 0, 253, 0.04)', radius: 8 }}
                        wrapperStyle={{ outline: 'none', zIndex: 20 }}
                      />
                      <Bar
                        dataKey="walletIn"
                        name="Wallet In"
                        fill="#2600FD"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={24}
                        isAnimationActive={false}
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="budgetPlusWalletsBar"
                        name="Budget Left + Wallets"
                        fill="#FFBF00"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={24}
                        isAnimationActive={false}
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="totalSpent"
                        name="Total Spent"
                        fill="#0A0A0B"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={24}
                        isAnimationActive={false}
                        className="cursor-pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {(scrollState.canLeft || scrollState.canRight) && (
                <p className="text-[10px] font-mono text-zinc-400 text-right mt-1">
                  {lang === 'zh' ? '← 可在图表区域左右滑动浏览近一年数据 →' : '← Swipe or scroll chart horizontally to browse up to 12 months →'}
                </p>
              )}
            </div>
          </div>

          {/* Actual Cash Flow Monthly Ledger Table */}
          <div className="avant-card rounded-3xl overflow-hidden p-4 sm:p-6">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider border-b border-zinc-200/60">
                    <th className="pb-3 pl-2 text-left">{lang === 'zh' ? '月份 // CYCLE' : 'MONTH // CYCLE'}</th>
                    <th className="pb-3 text-right">{lang === 'zh' ? 'WALLET 进账 / 原余额' : 'WALLET IN / OPENING'}</th>
                    <th className="pb-3 text-right">{lang === 'zh' ? 'BUDGET 剩余 + WALLETS' : 'BUDGET LEFT + WALLETS'}</th>
                    <th className="pb-3 text-right pr-2">{lang === 'zh' ? '共花 / WALLET 支出' : 'TOTAL SPENT / WALLET OUT'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/50">
                  {displayData.map((item) => {
                    const isSelected = activeMonthRow.month === item.month;
                    return (
                      <tr
                        key={item.month}
                        onClick={() => setSelectedMonth(item.month)}
                        className={`transition-colors text-sm cursor-pointer ${
                          isSelected ? 'bg-[#2600FD]/[0.05]' : 'hover:bg-zinc-100/60'
                        }`}
                      >
                        <td className="py-3.5 pl-2 font-mono font-black text-zinc-950 text-left align-top">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isSelected ? 'bg-[#2600FD]' : 'bg-zinc-300'
                              }`}
                            />
                            <span>{item.month}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-right align-top">
                          <div className="font-bold font-mono-numbers text-[#2600FD]">
                            +RM {fmtRM(item.walletIn)}
                          </div>
                          <div className="text-[11px] font-mono-numbers text-zinc-400 mt-0.5">
                            {lang === 'zh' ? '原余额' : 'Opening'} {item.walletOpening < 0 ? '-' : ''}RM {fmtRM(item.walletOpening)}
                          </div>
                        </td>
                        <td className="py-3.5 text-right align-top">
                          <div className="font-black font-mono-numbers text-zinc-950">
                            {item.budgetPlusWallets < 0 ? '-' : ''}RM {fmtRM(item.budgetPlusWallets)}
                          </div>
                          <div className="text-[11px] font-mono-numbers text-zinc-400 mt-0.5">
                            {lang === 'zh' ? '预算剩' : 'Budget'} {item.budgetRemaining < 0 ? '-' : ''}RM {fmtRM(item.budgetRemaining)} + {lang === 'zh' ? '钱包' : 'Wallets'} {item.walletClosing < 0 ? '-' : ''}RM {fmtRM(item.walletClosing)}
                          </div>
                        </td>
                        <td className="py-3.5 text-right pr-2 align-top">
                          <div className="font-bold font-mono-numbers text-rose-600">
                            -RM {fmtRM(item.totalSpent)}
                          </div>
                          <div className="text-[11px] font-mono-numbers text-zinc-400 mt-0.5">
                            Wallet RM {fmtRM(item.walletOut)} · Budget RM {fmtRM(item.budgetOut)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {historyData.length > 12 && (
              <div className="mt-5 flex justify-center">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs font-mono font-bold text-zinc-700 px-5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-95 transition-all cursor-pointer border border-zinc-200/70"
                >
                  {showAll ? (lang === 'zh' ? '收起至近 12 个月' : 'Show Last 12 Months') : (lang === 'zh' ? `展开查看全部 (${historyData.length} 个月)` : `Show All (${historyData.length} Months)`)}
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Budget Projection — Cash into Wallets vs Budget + Wallets Outflow */}
          <div className="avant-card rounded-3xl p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="signal-label text-black/45">
                    {lang === 'zh' ? '月度现金进出对照 (WALLETS & BUDGET)' : 'Monthly Cash In vs Budget & Wallets Spend'}
                  </span>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                    {lang === 'zh'
                      ? `近 ${projectionChart.length} 个月 / 最多 12 月`
                      : `${projectionChart.length} / 12 MO`}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-black/50">
                  {lang === 'zh'
                    ? '蓝 = 该月进入 Wallet 现金 · 墨 = 该月 Budget + Wallets 总支出 · 悬停查看净差额'
                    : 'Blue = cash into wallets · ink = budget + wallets spend · hover for net breakdown'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
                <span className="flex items-center gap-1.5 text-black/60">
                  <i className="w-2.5 h-2.5 rounded-[3px] bg-[#2600FD]" />
                  {lang === 'zh' ? '进 Wallet' : 'WALLET IN'}
                </span>
                <span className="flex items-center gap-1.5 text-black/60">
                  <i className="w-2.5 h-2.5 rounded-[3px] bg-[#0A0A0B]" />
                  {lang === 'zh' ? 'Budget + Wallets 支出' : 'BUDGET + WALLETS OUT'}
                </span>

                {(scrollState.canLeft || scrollState.canRight) && (
                  <div className="flex items-center gap-1 pl-1 border-l border-zinc-200">
                    <button
                      type="button"
                      onClick={() => scrollChartBy(-280)}
                      disabled={!scrollState.canLeft}
                      className="w-6 h-6 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title={lang === 'zh' ? '向左滑动查看更多月份' : 'Scroll left'}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollChartBy(280)}
                      disabled={!scrollState.canRight}
                      className="w-6 h-6 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title={lang === 'zh' ? '向右滑动查看较新月份' : 'Scroll right'}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              ref={chartScrollRef}
              onScroll={updateScrollButtons}
              className="w-full overflow-x-auto pb-2 scroll-smooth"
            >
              <div style={{ width: projectionChartMinWidth, minWidth: '100%' }} className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={projectionChart}
                    margin={{ top: 14, right: 16, left: -6, bottom: 4 }}
                    barGap={8}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(10,10,11,0.08)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#717177', fontFamily: 'monospace' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tickFormatter={fmtAxis}
                      tick={{ fontSize: 10, fill: '#717177', fontFamily: 'monospace' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      content={<ProjectionChartTooltip lang={lang} />}
                      cursor={{ fill: 'rgba(38, 0, 253, 0.04)', radius: 8 }}
                      wrapperStyle={{ outline: 'none', zIndex: 20 }}
                    />
                    <Bar
                      dataKey="inflow"
                      name="Wallet Cash In"
                      fill="#2600FD"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="outflow"
                      name="Budget + Wallets Out"
                      fill="#0A0A0B"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {(scrollState.canLeft || scrollState.canRight) && (
              <p className="text-[10px] font-mono text-zinc-400 text-right mt-1">
                {lang === 'zh' ? '← 可在图表区域左右滑动浏览近一年数据 →' : '← Swipe or scroll chart horizontally to browse up to 12 months →'}
              </p>
            )}

            <div className="mt-5 pt-4 border-t border-black/[0.08] grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="signal-label block text-black/40">
                  {lang === 'zh' ? '总进入 Wallet 现金' : 'Total wallet cash in'}
                </span>
                <p className="mt-1 font-mono font-semibold text-[15px] font-mono-numbers text-[#2600FD]">
                  +RM {fmtRM(projectionTotals.inflow)}
                </p>
              </div>
              <div>
                <span className="signal-label block text-black/40">
                  {lang === 'zh' ? '总支出 (BUDGET + WALLETS)' : 'Total out (Budget + Wallets)'}
                </span>
                <p className="mt-1 font-mono font-semibold text-[15px] font-mono-numbers text-[#0A0A0B]">
                  -RM {fmtRM(projectionTotals.outflow)}
                </p>
                <p className="text-[10px] font-mono text-black/45 mt-0.5 font-mono-numbers">
                  Budget RM {fmtRM(projectionTotals.budgetOut)} · Wallets RM {fmtRM(projectionTotals.walletOut)}
                </p>
              </div>
              <div>
                <span className="signal-label block text-black/40">
                  {lang === 'zh' ? '净现金差额' : 'Net cash flow'}
                </span>
                <p
                  className={`mt-1 font-mono font-semibold text-[15px] font-mono-numbers ${
                    projectionTotals.net >= 0 ? 'text-[#2600FD]' : 'text-rose-600'
                  }`}
                >
                  {projectionTotals.net >= 0 ? '+' : '-'}RM {fmtRM(projectionTotals.net)}
                </p>
              </div>
            </div>
          </div>

          <div className="avant-card rounded-3xl overflow-hidden p-4 sm:p-6">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[540px]">
                <thead>
                  <tr className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider border-b border-zinc-200/60">
                    <th className="pb-3 pl-2 text-left">{lang === 'zh' ? '月份 // CYCLE' : 'MONTH // CYCLE'}</th>
                    <th className="pb-3 text-right">{lang === 'zh' ? '进入 WALLET 现金 (+)' : 'WALLET CASH IN (+)'}</th>
                    <th className="pb-3 text-right">{lang === 'zh' ? 'BUDGET & WALLETS 支出 (-)' : 'BUDGET & WALLETS OUT (-)'}</th>
                    <th className="pb-3 text-right pr-2">{lang === 'zh' ? '净差额 // NET' : 'NET BALANCE'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/50">
                  {displayData.map((item) => (
                    <tr key={item.month} className="hover:bg-zinc-100/60 transition-colors text-sm font-medium">
                      <td className="py-3.5 pl-2 font-mono font-black text-zinc-950 text-left align-top">
                        {item.month}
                      </td>
                      <td className="py-3.5 text-right font-mono-numbers text-[#2600FD] font-bold align-top">
                        +RM {fmtRM(item.walletIn)}
                      </td>
                      <td className="py-3.5 text-right align-top">
                        <div className="font-bold font-mono-numbers text-rose-600">
                          -RM {fmtRM(item.totalSpent)}
                        </div>
                        <div className="text-[11px] font-mono-numbers text-zinc-400 mt-0.5">
                          Budget RM {fmtRM(item.budgetOut)} · Wallets RM {fmtRM(item.walletOut)}
                        </div>
                      </td>
                      <td
                        className={`py-3.5 text-right pr-2 font-black font-mono-numbers align-top ${
                          item.projectionNet >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {item.projectionNet >= 0 ? '+' : '-'}RM {fmtRM(item.projectionNet)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {historyData.length > 12 && (
              <div className="mt-5 flex justify-center">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs font-mono font-bold text-zinc-700 px-5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-95 transition-all cursor-pointer border border-zinc-200/70"
                >
                  {showAll ? (lang === 'zh' ? '收起至近 12 个月' : 'Show Last 12 Months') : (lang === 'zh' ? `展开查看全部 (${historyData.length} 个月)` : `Show All (${historyData.length} Months)`)}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;