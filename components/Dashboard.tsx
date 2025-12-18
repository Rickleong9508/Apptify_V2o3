import React, { useMemo } from 'react';
import { Account, MonthlyData, Loan, Stock } from '../types';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Activity, ArrowUpRight, ArrowDownLeft, PieChart, Lock, Unlock } from 'lucide-react';

interface DashboardProps {
  accounts: Account[];
  monthlyData: MonthlyData;
  loans: Loan[];
  stocks: Stock[];
  exchangeRate: number;
}

const Dashboard: React.FC<DashboardProps> = ({ accounts, monthlyData, loans, stocks, exchangeRate }) => {
  
  // 1. Calculate Total Assets (Cash + Stock Value)
  const totalCash = useMemo(() => accounts.reduce((sum, acc) => sum + acc.balance, 0), [accounts]);
  
  const totalReserved = useMemo(() => accounts.reduce((sum, acc) => {
    const accReserved = acc.reservations ? acc.reservations.reduce((rSum, r) => rSum + r.amount, 0) : 0;
    return sum + accReserved;
  }, 0), [accounts]);

  const availableCash = totalCash - totalReserved;
  
  // Calculate Stock Value
  const totalStockValue = useMemo(() => {
    return stocks.reduce((sum, s) => {
        const rate = s.currency === 'USD' ? exchangeRate : 1;
        return sum + (s.currentPrice * s.quantity * rate);
    }, 0);
  }, [stocks, exchangeRate]);

  const totalAssets = totalCash + totalStockValue;

  // 2. Calculate Liabilities (Loans)
  const totalLiabilities = useMemo(() => loans.reduce((sum, l) => sum + l.remainingAmount, 0), [loans]);

  // 3. Net Worth
  const netWorth = totalAssets - totalLiabilities;

  // 4. Monthly Flows
  const monthlyExpensesTotal = useMemo(() => monthlyData.expenses.reduce((sum, e) => sum + e.amount, 0), [monthlyData]);
  const monthlyCashFlow = monthlyData.income - monthlyExpensesTotal;
  const savingsRate = monthlyData.income > 0 ? ((monthlyData.income - monthlyExpensesTotal) / monthlyData.income) * 100 : 0;

  // Helper for Asset Bar
  const availableCashPercent = totalAssets > 0 ? (availableCash / totalAssets) * 100 : 0;
  const reservedCashPercent = totalAssets > 0 ? (totalReserved / totalAssets) * 100 : 0;
  const stockPercent = totalAssets > 0 ? (totalStockValue / totalAssets) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-4">
        <div>
            <h2 className="text-3xl font-bold text-text-main tracking-tight">Overview</h2>
            <p className="text-text-muted mt-1">Financial summary for {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Hero Section: Net Worth */}
      <div className="bg-secondary text-surface p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl transition-transform duration-1000 group-hover:scale-110"></div>
          
          <div className="relative z-10">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Activity size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">Net Worth</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-8">
                  <span className="text-2xl text-gray-500 font-medium mr-2">RM</span>
                  {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h1>

              <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
                  <div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Assets</p>
                      <p className="text-xl font-semibold text-green-400">
                          + RM {totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                  </div>
                  <div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Liabilities</p>
                      <p className="text-xl font-semibold text-red-400">
                          - RM {totalLiabilities.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Asset Structure Card */}
          <div className="bg-surface p-6 rounded-[32px] shadow-apple border border-border lg:col-span-2 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg text-text-main flex items-center gap-2">
                      <PieChart size={20} className="text-primary"/>
                      Asset Structure
                  </h3>
                  <span className="text-xs font-bold bg-input-bg px-2 py-1 rounded text-text-muted">
                      RM {totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })} Total
                  </span>
              </div>

              {/* Visual Bars */}
              <div className="space-y-6">
                  {/* Cash Row */}
                  <div>
                      <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-text-main flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div> Cash (Liquidity)
                          </span>
                          <span className="font-bold text-text-main">RM {totalCash.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-input-bg h-3 rounded-full overflow-hidden flex">
                          {/* Available Cash */}
                          <div style={{ width: `${availableCashPercent}%` }} className="h-full bg-blue-500"></div>
                          {/* Reserved Cash */}
                          <div style={{ width: `${reservedCashPercent}%` }} className="h-full bg-text-muted/30 relative">
                             {/* Striped pattern overlay for reserved */}
                             <div className="absolute inset-0 w-full h-full opacity-20" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, #000 5px, #000 10px)'}}></div>
                          </div>
                      </div>
                      <div className="flex justify-between mt-1 text-[10px]">
                           <span className="text-blue-600 font-bold">RM {availableCash.toLocaleString()} Available</span>
                           {totalReserved > 0 && <span className="text-text-muted font-bold flex items-center gap-1"><Lock size={8}/> RM {totalReserved.toLocaleString()} Reserved</span>}
                      </div>
                  </div>

                  {/* Stock Row */}
                  <div>
                      <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-text-main flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-accent"></div> Stocks & Investments
                          </span>
                          <span className="font-bold text-text-main">RM {totalStockValue.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-input-bg h-3 rounded-full overflow-hidden">
                          <div style={{ width: `${stockPercent}%` }} className="h-full bg-accent rounded-full"></div>
                      </div>
                  </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex gap-4 overflow-x-auto no-scrollbar">
                  {/* Mini details */}
                  <div className="flex-1 bg-input-bg p-3 rounded-xl min-w-[120px]">
                      <p className="text-[10px] text-text-muted font-bold uppercase">Liquid Ratio</p>
                      <p className="text-lg font-bold text-blue-600">{availableCashPercent.toFixed(0)}%</p>
                  </div>
                  {totalReserved > 0 && (
                      <div className="flex-1 bg-input-bg p-3 rounded-xl min-w-[120px]">
                        <p className="text-[10px] text-text-muted font-bold uppercase">Reserved</p>
                        <p className="text-lg font-bold text-text-muted">{reservedCashPercent.toFixed(0)}%</p>
                      </div>
                  )}
                  <div className="flex-1 bg-input-bg p-3 rounded-xl min-w-[120px]">
                      <p className="text-[10px] text-text-muted font-bold uppercase">Investment Ratio</p>
                      <p className="text-lg font-bold text-accent">{stockPercent.toFixed(0)}%</p>
                  </div>
              </div>
          </div>

          {/* Monthly Pulse / Budget Health */}
          <div className="bg-surface p-6 rounded-[32px] shadow-apple border border-border flex flex-col">
              <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg text-text-main flex items-center gap-2">
                      <Activity size={20} className="text-orange-500"/>
                      Monthly Pulse
                  </h3>
              </div>

              <div className="flex-1 flex flex-col justify-center space-y-6">
                   {/* Income */}
                   <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center">
                               <ArrowDownLeft size={18} />
                           </div>
                           <div>
                               <p className="text-xs text-text-muted font-bold uppercase">Income</p>
                               <p className="font-bold text-text-main">RM {monthlyData.income.toLocaleString()}</p>
                           </div>
                       </div>
                   </div>

                   {/* Expenses */}
                   <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center">
                               <ArrowUpRight size={18} />
                           </div>
                           <div>
                               <p className="text-xs text-text-muted font-bold uppercase">Expenses</p>
                               <p className="font-bold text-text-main">RM {monthlyExpensesTotal.toLocaleString()}</p>
                           </div>
                       </div>
                   </div>

                   {/* Divider */}
                   <div className="h-px bg-border w-full"></div>

                   {/* Result */}
                   <div>
                       <div className="flex justify-between items-end mb-1">
                           <p className="text-xs text-text-muted font-bold uppercase">Net Flow</p>
                           <span className={`text-xs font-bold px-2 py-0.5 rounded ${monthlyCashFlow >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                               {savingsRate.toFixed(0)}% Saved
                           </span>
                       </div>
                       <p className={`text-2xl font-bold ${monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                           {monthlyCashFlow >= 0 ? '+' : ''} RM {monthlyCashFlow.toLocaleString()}
                       </p>
                   </div>
              </div>
          </div>

      </div>

      {/* Optional: Liability Summary if debts exist */}
      {loans.length > 0 && (
          <div className="bg-red-500/10 p-6 rounded-[32px] border border-red-500/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center text-red-500 shadow-sm">
                      <TrendingDown size={20} />
                  </div>
                  <div>
                      <p className="font-bold text-red-900 dark:text-red-300 text-lg">Outstanding Debts</p>
                      <p className="text-red-700/70 dark:text-red-400/70 text-sm">You have {loans.length} active loan accounts.</p>
                  </div>
              </div>
              <div className="text-right">
                  <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Total Principal</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-300">RM {totalLiabilities.toLocaleString()}</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;