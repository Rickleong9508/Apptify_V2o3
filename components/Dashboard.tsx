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

    // 3. Net Worth (User requested: Wallet + Portfolio, excluding loans from this calc)
    const netWorth = totalAssets;

    // 4. Monthly Flows
    const monthlyExpensesTotal = useMemo(() => monthlyData.expenses.reduce((sum, e) => sum + e.amount, 0), [monthlyData]);
    const monthlyCashFlow = monthlyData.income - monthlyExpensesTotal;
    const savingsRate = monthlyData.income > 0 ? ((monthlyData.income - monthlyExpensesTotal) / monthlyData.income) * 100 : 0;

    // Helper for Asset Bar
    const availableCashPercent = totalAssets > 0 ? (availableCash / totalAssets) * 100 : 0;
    const reservedCashPercent = totalAssets > 0 ? (totalReserved / totalAssets) * 100 : 0;
    const stockPercent = totalAssets > 0 ? (totalStockValue / totalAssets) * 100 : 0;

    return (
        <div className="space-y-8 animate-fade-in pb-10">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between pb-4">
                <div className="animate-fade-in-down">
                    <h2 className="text-3xl font-bold text-gray-700 tracking-tight">Overview</h2>
                    <p className="text-gray-500 mt-1">Financial summary for {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
                </div>
            </div>

            {/* Hero Section: Net Worth */}
            <div
                className="p-8 rounded-[32px] relative overflow-hidden group animate-fade-in-up opacity-0"
                style={{
                    background: "#E0E5EC",
                    boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                    animationDelay: '100ms'
                }}
            >
                <div className="relative z-10 text-gray-700">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Activity size={16} />
                        <span className="text-xs font-bold uppercase tracking-widest">Net Worth</span>
                    </div>

                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-8 text-gray-800">
                        <span className="text-2xl text-gray-400 font-medium mr-2">RM</span>
                        {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h1>

                    <div className="grid grid-cols-2 gap-8 border-t border-gray-300 pt-6">
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Cash</p>
                            <p className="text-xl font-bold text-green-500">
                                + RM {totalCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Liabilities</p>
                            <p className="text-xl font-bold text-red-500">
                                - RM {totalLiabilities.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Asset Structure Card */}
                <div
                    className="p-8 rounded-[32px] lg:col-span-2 flex flex-col justify-between animate-fade-in-up opacity-0"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                        animationDelay: '200ms'
                    }}
                >
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold text-xl text-gray-700 flex items-center gap-3">
                            <div className="p-2 rounded-xl text-blue-500" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                                <PieChart size={20} />
                            </div>
                            Asset Structure
                        </h3>
                        <span
                            className="text-xs font-bold px-3 py-2 rounded-xl text-gray-500"
                            style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}
                        >
                            RM {totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })} Total
                        </span>
                    </div>

                    {/* Visual Bars */}
                    <div className="space-y-8">
                        {/* Cash Row */}
                        <div>
                            <div className="flex justify-between text-sm mb-3">
                                <span className="font-bold text-gray-600 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div> Cash (Liquidity)
                                </span>
                                <span className="font-bold text-gray-800">RM {totalCash.toLocaleString()}</span>
                            </div>
                            <div className="w-full h-4 rounded-full overflow-hidden flex p-1" style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                                {/* Available Cash */}
                                <div style={{ width: `${availableCashPercent}%` }} className="h-full bg-blue-500 rounded-full shadow-sm"></div>
                                {/* Reserved Cash */}
                                <div style={{ width: `${reservedCashPercent}%` }} className="h-full bg-gray-400/30 rounded-full ml-1"></div>
                            </div>
                            <div className="flex justify-between mt-2 text-[10px]">
                                <span className="text-blue-600 font-bold">RM {availableCash.toLocaleString()} Available</span>
                                {totalReserved > 0 && <span className="text-gray-400 font-bold flex items-center gap-1"><Lock size={8} /> RM {totalReserved.toLocaleString()} Reserved</span>}
                            </div>
                        </div>

                        {/* Stock Row */}
                        <div>
                            <div className="flex justify-between text-sm mb-3">
                                <span className="font-bold text-gray-600 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500"></div> Stocks & Investments
                                </span>
                                <span className="font-bold text-gray-800">RM {totalStockValue.toLocaleString()}</span>
                            </div>
                            <div className="w-full h-4 rounded-full overflow-hidden p-1" style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                                <div style={{ width: `${stockPercent}%` }} className="h-full bg-purple-500 rounded-full shadow-sm"></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-300 flex gap-4 overflow-x-auto no-scrollbar">
                        {/* Mini details */}
                        <div className="flex-1 p-4 rounded-2xl min-w-[120px]" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Liquid Ratio</p>
                            <p className="text-2xl font-bold text-blue-600">{availableCashPercent.toFixed(0)}%</p>
                        </div>
                        {totalReserved > 0 && (
                            <div className="flex-1 p-4 rounded-2xl min-w-[120px]" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Reserved</p>
                                <p className="text-2xl font-bold text-gray-500">{reservedCashPercent.toFixed(0)}%</p>
                            </div>
                        )}
                        <div className="flex-1 p-4 rounded-2xl min-w-[120px]" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Invested</p>
                            <p className="text-2xl font-bold text-purple-600">{stockPercent.toFixed(0)}%</p>
                        </div>
                    </div>
                </div>

                {/* Monthly Pulse / Budget Health */}
                <div
                    className="p-8 rounded-[32px] flex flex-col animate-fade-in-up opacity-0"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                        animationDelay: '300ms'
                    }}
                >
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold text-xl text-gray-700 flex items-center gap-3">
                            <div className="p-2 rounded-xl text-orange-500" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                                <Activity size={20} />
                            </div>
                            Monthly Pulse
                        </h3>
                    </div>

                    <div className="flex-1 flex flex-col justify-center space-y-8">
                        {/* Income */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl text-green-600 flex items-center justify-center transition-transform hover:scale-105" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                                    <ArrowDownLeft size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 font-bold uppercase">Income</p>
                                    <p className="font-bold text-lg text-gray-700">RM {monthlyData.income.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Expenses */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl text-red-600 flex items-center justify-center transition-transform hover:scale-105" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                                    <ArrowUpRight size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 font-bold uppercase">Expenses</p>
                                    <p className="font-bold text-lg text-gray-700">RM {monthlyExpensesTotal.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gray-300 w-full"></div>

                        {/* Result */}
                        <div className="p-4 rounded-2xl" style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}>
                            <div className="flex justify-between items-end mb-1">
                                <p className="text-xs text-gray-500 font-bold uppercase">Net Flow</p>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${monthlyCashFlow >= 0 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
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
                <div
                    className="p-6 rounded-[32px] flex items-center justify-between animate-fade-in-up opacity-0"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                        animationDelay: '400ms'
                    }}
                >
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-red-500" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                            <TrendingDown size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-red-600 text-xl">Outstanding Debts</p>
                            <p className="text-red-400 text-sm">You have {loans.length} active loan accounts.</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Total Principal</p>
                        <p className="text-3xl font-bold text-red-600">RM {totalLiabilities.toLocaleString()}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;