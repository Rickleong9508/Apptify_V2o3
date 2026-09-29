import React, { useMemo, useState } from 'react';
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

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            财务概览
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })} 资产与收支统计
          </p>
        </div>
      </div>

      {/* Hero Section: Net Worth Card (iOS 27 Liquid Glass Frosted Gradient) */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-blue-500/15 via-indigo-500/8 to-white/70 dark:from-blue-600/20 dark:via-indigo-950/15 dark:to-[#181A20]/80 backdrop-blur-3xl border border-blue-500/30 dark:border-blue-400/25 shadow-[0_16px_40px_-10px_rgba(59,130,246,0.18)] relative overflow-hidden group">
        {/* Subtle decorative glowing corner */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-blue-500/20 dark:bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
            <Activity size={15} />
            <span className="text-[11px] font-bold uppercase tracking-wider">个人总资产 (Total Assets)</span>
          </div>

          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-lg sm:text-2xl text-gray-400 dark:text-gray-500 font-semibold">RM</span>
            <span className="text-4xl sm:text-6xl font-black tracking-tight text-gray-900 dark:text-white font-mono">
              {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Quick Metrics Breakdown (Frosted Translucent Pills) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-6 border-t border-gray-100/80 dark:border-white/10 pt-5">
            <div className="p-2 sm:p-3 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/5 border border-emerald-500/20 backdrop-blur-md">
              <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 font-semibold mb-0.5">流动现金</p>
              <p className="text-sm sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
                +RM {totalCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="p-2 sm:p-3 rounded-2xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 dark:from-purple-500/20 dark:to-purple-500/5 border border-purple-500/20 backdrop-blur-md">
              <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 font-semibold mb-0.5">投资持仓</p>
              <p className="text-sm sm:text-lg font-bold text-purple-600 dark:text-purple-400 truncate">
                +RM {totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="p-2 sm:p-3 rounded-2xl bg-gradient-to-br from-rose-500/15 to-rose-500/5 dark:from-rose-500/20 dark:to-rose-500/5 border border-rose-500/20 backdrop-blur-md" title="贷款为独立履约跟踪，不从总资产中抵扣">
              <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 font-semibold mb-0.5">借贷履约 (独立)</p>
              <p className="text-sm sm:text-lg font-bold text-rose-600 dark:text-rose-400 truncate">
                RM {totalLiabilities.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Asset Structure & Monthly Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Asset Structure Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white/75 dark:bg-[#181A20]/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-lg shadow-black/5 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <PieChart size={18} />
                </div>
                资产构成配比
              </h3>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                总资产 RM {totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Visual Stream Bars */}
            <div className="space-y-6">
              {/* Cash Row */}
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-2">
                  <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> 现金与钱包
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">RM {totalCash.toLocaleString()}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden flex p-0.5">
                  <div style={{ width: `${availableCashPercent}%` }} className="h-full bg-blue-500 rounded-full transition-all duration-500" />
                  <div style={{ width: `${reservedCashPercent}%` }} className="h-full bg-amber-400/60 rounded-full ml-1 transition-all duration-500" />
                </div>
                <div className="flex justify-between mt-1.5 text-[11px]">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">RM {availableCash.toLocaleString()} 可支配</span>
                  {totalReserved > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <Lock size={10} /> RM {totalReserved.toLocaleString()} 已锁定准备金
                    </span>
                  )}
                </div>
              </div>

              {/* Stock Row */}
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-2">
                  <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> 股票与证券持仓
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">RM {totalStockValue.toLocaleString()}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden p-0.5">
                  <div style={{ width: `${stockPercent}%` }} className="h-full bg-purple-500 rounded-full transition-all duration-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Mini Stat Pills */}
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-white/10 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-white/5 text-center">
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">可用流动率</p>
              <p className="text-base sm:text-lg font-extrabold text-blue-600 dark:text-blue-400">{availableCashPercent.toFixed(0)}%</p>
            </div>
            {totalReserved > 0 && (
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-white/5 text-center">
                <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">专款锁定率</p>
                <p className="text-base sm:text-lg font-extrabold text-amber-500">{reservedCashPercent.toFixed(0)}%</p>
              </div>
            )}
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-white/5 text-center">
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">投资仓位比</p>
              <p className="text-base sm:text-lg font-extrabold text-purple-600 dark:text-purple-400">{stockPercent.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        {/* Monthly Pulse / Budget Health */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white/75 dark:bg-[#181A20]/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-lg shadow-black/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <Layers size={18} />
              </div>
              本月现金脉搏
            </h3>
          </div>

          <div className="space-y-4 my-auto">
            {/* Income */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ArrowDownLeft size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">总收入计划</p>
                  <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">RM {monthlyData.income.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Expenses */}
            <div className="p-3 rounded-2xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <ArrowUpRight size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">总支出合计</p>
                    <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">RM {monthlyExpensesTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Sub-breakdown */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-rose-500/10">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  日常浮动: <span className="font-bold text-gray-800 dark:text-gray-200">RM {monthlyOneTimeExpenses.toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 text-right">
                  固定周期: <span className="font-bold text-gray-800 dark:text-gray-200">RM {monthlyRecurringExpenses.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Net Flow Result Card */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500 font-bold uppercase">净现金流 (Net Flow)</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${monthlyCashFlow >= 0 ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/50' : 'text-rose-700 bg-rose-100 dark:text-rose-400 dark:bg-rose-950/50'}`}>
                  {savingsRate.toFixed(0)}% 储蓄率
                </span>
              </div>
              <p className={`text-2xl font-black font-mono ${monthlyCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {monthlyCashFlow >= 0 ? '+' : ''} RM {monthlyCashFlow.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Monthly History Section */}
      <MonthlyHistory accounts={accounts} fixedExpenses={fixedExpenses} monthlyData={monthlyData} budgetHistory={budgetHistory} />

      {/* Liability Summary if debts exist */}
      {loans.length > 0 && (
        <div className="p-6 rounded-3xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/15 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
              <TrendingDown size={22} />
            </div>
            <div>
              <p className="font-bold text-rose-600 dark:text-rose-400 text-base sm:text-lg">未结清贷款总览</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">当前共有 {loans.length} 笔在履行中的贷款账户</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">剩余本金合计</p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">RM {totalLiabilities.toLocaleString()}</p>
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
}

const MonthlyHistory: React.FC<MonthlyHistoryProps> = ({ accounts, fixedExpenses, monthlyData, budgetHistory }) => {
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

  if (historyData.length === 0) return null;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white flex items-center gap-2">
          <Activity size={17} className="text-blue-500" />
          历史月度对账表
        </h3>

        {/* Mode Toggle Switch */}
        <div className="flex p-1 rounded-full bg-gray-100 dark:bg-white/10 border border-black/5 dark:border-white/10 w-fit">
          <button
            onClick={() => setViewMode('actual')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'actual' ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}
          >
            实际钱包流水
          </button>
          <button
            onClick={() => setViewMode('budget')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'budget' ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}
          >
            预算规划收支
          </button>
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden p-4 sm:p-6 bg-white/75 dark:bg-[#181A20]/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-lg shadow-black/5">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="text-[11px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-white/10">
                <th className="pb-3 pl-2 text-left">月份</th>
                <th className="pb-3 text-right">总流入</th>
                <th className="pb-3 text-right">总流出</th>
                <th className="pb-3 text-right pr-2">结余</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {displayData.map((item) => {
                const data = viewMode === 'actual' ? item.actual : item.budget;
                return (
                  <tr key={item.month} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm font-medium">
                    <td className="py-3 pl-2 font-bold text-gray-900 dark:text-white text-left font-mono">
                      {item.month}
                    </td>
                    <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                      +RM {data.totalIn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-bold font-mono">
                      -RM {data.totalOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`py-3 text-right pr-2 font-black font-mono ${data.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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
              className="text-xs font-bold text-gray-600 dark:text-gray-300 px-5 py-2 rounded-full bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 active:scale-95 transition-all"
            >
              {showAll ? '收起更少' : `展开查看更多 (${historyData.length} 个月)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;