import React, { useState, useMemo } from 'react';
import { MonthlyData, Expense, ExpenseCategory } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus, X, Calculator, ArrowRight, Repeat, Clock, TrendingUp, Wallet, ArrowDown, ArrowUp } from 'lucide-react';

interface BudgetProps {
  monthlyData: MonthlyData;
  setMonthlyData: React.Dispatch<React.SetStateAction<MonthlyData>>;
  fixedExpenses: Expense[];
  setFixedExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
}

// Gradient Definitions Configuration
const CATEGORY_STYLES: Record<string, { id: string, start: string, end: string }> = {
  [ExpenseCategory.MAINTENANCE]: { id: 'grad-blue', start: '#007AFF', end: '#00C6FB' },
  [ExpenseCategory.LOAN]: { id: 'grad-red', start: '#FF3B30', end: '#FF2D55' },
  [ExpenseCategory.SAVING]: { id: 'grad-green', start: '#34C759', end: '#30D158' },
  [ExpenseCategory.FAMILY]: { id: 'grad-orange', start: '#FF9500', end: '#FFCC00' },
  [ExpenseCategory.OTHER]: { id: 'grad-purple', start: '#AF52DE', end: '#5856D6' },
  'Unallocated': { id: 'grad-gray', start: '#8E8E93', end: '#C7C7CC' }
};

const getStyle = (name: string) => CATEGORY_STYLES[name] || CATEGORY_STYLES['Unallocated'];

// Custom Label Render for Pie Chart (Name + Percent)
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  if (percent < 0.05) return null; // Hide label if slice is less than 5%
  
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Shorten name if too long
  const displayName = name.length > 8 ? name.substring(0, 6) + '..' : name;

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.4))' }}>
       <tspan x={x} dy="-0.6em" className="text-[10px] font-bold fill-white">{displayName}</tspan>
       <tspan x={x} dy="1.2em" className="text-[9px] font-medium fill-white/90">{(percent * 100).toFixed(0)}%</tspan>
    </text>
  );
};

interface ExpenseItemProps {
  item: Expense;
  isFixedList: boolean;
  onRemove: (id: string, isFixed: boolean) => void;
}

// Helper component for list item
const ExpenseItem: React.FC<ExpenseItemProps> = ({ item, isFixedList, onRemove }) => (
  <div className="group flex items-center justify-between p-3 px-4 hover:bg-input-bg transition-all border-b border-border last:border-0">
      <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shadow-sm bg-gradient-to-br" 
            style={{ 
                backgroundImage: `linear-gradient(to bottom right, ${getStyle(item.category as string).start}, ${getStyle(item.category as string).end})`
            }}
          >
              {item.category.charAt(0)}
          </div>
          <div>
              <p className="font-semibold text-text-main text-sm flex items-center gap-2 leading-tight">
                  {item.name}
              </p>
              <p className="text-[10px] text-text-muted font-medium uppercase tracking-wide">{item.category}</p>
          </div>
      </div>
      <div className="flex items-center gap-3">
          <span className="font-bold text-text-main text-sm">RM {item.amount.toFixed(2)}</span>
          <button 
            onClick={() => onRemove(item.id, isFixedList)} 
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
          >
              <X size={14} />
          </button>
      </div>
  </div>
);

const Budget: React.FC<BudgetProps> = ({ monthlyData, setMonthlyData, fixedExpenses, setFixedExpenses }) => {
  const [incomeInput, setIncomeInput] = useState(monthlyData.income.toString());
  
  // Form State
  const [newExpName, setNewExpName] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [newExpCat, setNewExpCat] = useState<ExpenseCategory>(ExpenseCategory.MAINTENANCE);
  const [isRecurring, setIsRecurring] = useState(false); // Toggle state

  // --- Auto Calculations ---
  const allExpenses = useMemo(() => {
    return [...fixedExpenses, ...monthlyData.expenses];
  }, [fixedExpenses, monthlyData.expenses]);

  const totalExpenses = useMemo(() => 
    allExpenses.reduce((sum, item) => sum + item.amount, 0), 
    [allExpenses]
  );

  const balance = monthlyData.income - totalExpenses;

  // Pie Chart Data Preparation
  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    
    // Aggregate Expenses
    allExpenses.forEach(exp => {
      let key = Object.values(ExpenseCategory).includes(exp.category as ExpenseCategory) 
        ? exp.category 
        : ExpenseCategory.OTHER;
      if (key === ExpenseCategory.SAVING) key = ExpenseCategory.OTHER;
      data[key] = (data[key] || 0) + exp.amount;
    });

    const result = Object.keys(data)
      .map(key => ({ name: key, value: data[key] }));

    // Add Balance as "Saving"
    if (balance > 0) {
        result.push({ name: ExpenseCategory.SAVING, value: balance });
    }

    return result.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  }, [allExpenses, balance]);

  const totalChartValue = useMemo(() => chartData.reduce((sum, item) => sum + item.value, 0), [chartData]);
  
  // Percentages for Summary
  const totalIncomeCalc = monthlyData.income > 0 ? monthlyData.income : (totalExpenses > 0 ? totalExpenses : 1);
  const spendingPct = Math.min(100, (totalExpenses / totalIncomeCalc) * 100);
  const savingPct = balance > 0 ? (balance / totalIncomeCalc) * 100 : 0;

  // Savings Allocation
  const savingTotal = balance > 0 ? balance : 0;
  const investmentFund = savingTotal * 0.6;
  const emergencyFund = savingTotal * 0.4;

  const updateIncome = () => {
    const val = parseFloat(incomeInput);
    if (!isNaN(val)) {
      setMonthlyData({ ...monthlyData, income: val });
    }
  };

  const addExpense = () => {
    if (!newExpName || !newExpAmount) return;
    const val = parseFloat(newExpAmount);
    if (isNaN(val) || val <= 0) return;

    const newExpense: Expense = {
      id: Date.now().toString(),
      name: newExpName,
      amount: val,
      category: newExpCat,
      isFixed: isRecurring
    };

    if (isRecurring) {
        setFixedExpenses([...fixedExpenses, newExpense]);
    } else {
        setMonthlyData({
            ...monthlyData,
            expenses: [...monthlyData.expenses, newExpense]
        });
    }

    setNewExpName('');
    setNewExpAmount('');
  };

  const removeExpense = (id: string, isFixed: boolean) => {
    if (confirm('Delete this expense?')) {
        if (isFixed) {
            setFixedExpenses(fixedExpenses.filter(e => e.id !== id));
        } else {
            setMonthlyData({
                ...monthlyData,
                expenses: monthlyData.expenses.filter(e => e.id !== id)
            });
        }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-8">
       {/* 1. Page Header with Integrated Controls */}
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
         <div>
            <h2 className="text-3xl font-bold text-text-main tracking-tight">Budget Planner</h2>
            <p className="text-text-muted text-sm mt-1">Track flow, manage bills & forecast.</p>
         </div>
         
         {/* Top Bar: Income Input & High Level Stats */}
         <div className="flex flex-col sm:flex-row bg-surface rounded-2xl shadow-apple border border-border overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-border">
             
             {/* Income Input Section - Moved to TOP */}
             <div className="px-5 py-3 flex flex-col justify-center bg-input-bg hover:bg-surface transition-colors group">
                 <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Monthly Income</label>
                 <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-text-muted group-focus-within:text-primary transition-colors">RM</span>
                    <input 
                        type="number" 
                        value={incomeInput}
                        onChange={(e) => setIncomeInput(e.target.value)}
                        onBlur={updateIncome}
                        className="w-28 text-lg font-bold text-text-main border-none focus:ring-0 p-0 bg-transparent placeholder-text-muted"
                        placeholder="0.00"
                    />
                 </div>
             </div>

             {/* Total Spent Stat */}
             <div className="px-5 py-3 flex flex-col justify-center min-w-[100px]">
                 <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Total Spent</p>
                 <p className="text-lg font-bold text-text-main">RM {totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 0})}</p>
             </div>

             {/* Remaining Balance Stat */}
             <div className="px-5 py-3 flex flex-col justify-center min-w-[120px]">
                 <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Remaining</p>
                 <p className={`text-lg font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>RM {balance.toLocaleString(undefined, {minimumFractionDigits: 0})}</p>
             </div>
         </div>
       </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Unified Ledger - Span 8 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Unified Card */}
            <div className="bg-surface rounded-[24px] shadow-apple border border-border overflow-hidden flex flex-col min-h-[600px]">
                
                {/* 2. REFINED NEW TRANSACTION FORM */}
                <div className="p-6 border-b border-border bg-input-bg">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <div className="bg-text-main text-surface p-1.5 rounded-lg shadow-sm">
                                <Plus size={14} strokeWidth={3} />
                            </div>
                            <h3 className="font-bold text-sm text-text-main uppercase tracking-wide">New Entry</h3>
                        </div>
                        
                        {/* Improved Toggle Pill */}
                        <div className="flex bg-surface rounded-lg p-1 shadow-sm border border-border">
                             <button 
                                onClick={() => setIsRecurring(false)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${!isRecurring ? 'bg-input-bg text-text-main shadow-inner' : 'text-text-muted hover:text-text-main'}`}
                            >
                                One-Time
                            </button>
                            <button 
                                onClick={() => setIsRecurring(true)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${isRecurring ? 'bg-blue-500/10 text-blue-600 shadow-inner' : 'text-text-muted hover:text-text-main'}`}
                            >
                                <Repeat size={10} />
                                Recurring
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                         {/* Name Input Container */}
                         <div className="flex-[2] bg-surface rounded-xl border border-border px-4 py-2.5 focus-within:ring-2 ring-primary/20 focus-within:border-primary transition-all shadow-sm flex flex-col justify-center">
                             <label className="block text-[10px] font-bold text-text-muted uppercase mb-0.5">Description</label>
                             <input 
                                type="text" 
                                placeholder={isRecurring ? "e.g. Netflix Subscription" : "e.g. Grocery Shopping"} 
                                className="w-full text-sm font-bold bg-transparent border-none p-0 focus:ring-0 placeholder-text-muted/50 text-text-main h-6"
                                value={newExpName}
                                onChange={e => setNewExpName(e.target.value)}
                             />
                         </div>
                         
                         {/* Amount Input Container */}
                         <div className="flex-1 bg-surface rounded-xl border border-border px-4 py-2.5 focus-within:ring-2 ring-primary/20 focus-within:border-primary transition-all shadow-sm flex flex-col justify-center">
                             <label className="block text-[10px] font-bold text-text-muted uppercase mb-0.5">Amount</label>
                             <div className="flex items-center gap-1 h-6">
                                 <span className="text-sm font-bold text-text-muted">RM</span>
                                 <input 
                                    type="number" 
                                    placeholder="0.00" 
                                    className="w-full text-sm font-bold bg-transparent border-none p-0 focus:ring-0 placeholder-text-muted/50 text-text-main"
                                    value={newExpAmount}
                                    onChange={e => setNewExpAmount(e.target.value)}
                                 />
                             </div>
                         </div>

                         {/* Category Select Container */}
                         <div className="flex-1 bg-surface rounded-xl border border-border px-4 py-2.5 focus-within:ring-2 ring-primary/20 focus-within:border-primary transition-all shadow-sm flex flex-col justify-center">
                             <label className="block text-[10px] font-bold text-text-muted uppercase mb-0.5">Category</label>
                             <select 
                                className="w-full text-sm font-bold bg-transparent border-none p-0 focus:ring-0 cursor-pointer text-text-main h-6 appearance-none"
                                value={newExpCat}
                                onChange={e => setNewExpCat(e.target.value as ExpenseCategory)}
                             >
                                {Object.values(ExpenseCategory)
                                    .filter(cat => cat !== ExpenseCategory.SAVING)
                                    .map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                         </div>

                         <button 
                            onClick={addExpense}
                            className="bg-text-main text-surface rounded-xl px-5 hover:opacity-90 transition-all shadow-lg active:scale-95 flex items-center justify-center min-w-[50px]"
                        >
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Ledger List */}
                <div className="flex-1 overflow-y-auto">
                    {/* Recurring Section */}
                    {fixedExpenses.length > 0 && (
                        <div>
                            <div className="px-5 py-2 bg-input-bg border-b border-border flex items-center gap-2 sticky top-0 backdrop-blur-sm z-10">
                                <Repeat size={12} className="text-primary"/>
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Fixed Monthly Bills</span>
                            </div>
                            <div className="bg-surface">
                                {fixedExpenses.map(exp => <ExpenseItem key={exp.id} item={exp} isFixedList={true} onRemove={removeExpense} />)}
                            </div>
                        </div>
                    )}

                    {/* Variable Section */}
                    <div>
                        <div className="px-5 py-2 bg-input-bg border-b border-border border-t flex items-center gap-2 sticky top-0 backdrop-blur-sm z-10">
                            <Clock size={12} className="text-orange-500"/>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Variable Expenses</span>
                        </div>
                        <div className="bg-surface min-h-[200px]">
                            {monthlyData.expenses.map(exp => <ExpenseItem key={exp.id} item={exp} isFixedList={false} onRemove={removeExpense} />)}
                            {monthlyData.expenses.length === 0 && <div className="p-12 text-center text-text-muted text-sm italic">No variable expenses recorded for this month.</div>}
                        </div>
                    </div>
                </div>

                {/* Footer Totals */}
                <div className="p-3 bg-input-bg border-t border-border text-center">
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                        {fixedExpenses.length + monthlyData.expenses.length} Transactions Logged
                    </p>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: Analytics Only - Span 4 */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Note: Income Card Removed from here, moved to Top Header */}

          {/* 3. Balance Hero Card */}
          <div className={`bg-gradient-to-br ${balance >= 0 ? 'from-[#0071e3] to-[#4facfe]' : 'from-[#ff3b30] to-[#ff9500]'} text-white p-6 rounded-[24px] shadow-lg shadow-blue-500/20 relative overflow-hidden group`}>
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
             
             <div className="relative z-10">
                <div className="flex items-center gap-2 opacity-90 mb-2">
                    <Calculator size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{balance >= 0 ? 'Projected Savings' : 'Deficit'}</span>
                </div>
                <div className="text-4xl font-bold tracking-tight mb-6">RM {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                
                <div className="flex items-center gap-2 text-xs font-medium bg-white/20 w-fit px-3 py-1.5 rounded-full backdrop-blur-md">
                     <span>Savings Rate:</span>
                     <span className="font-bold">{monthlyData.income > 0 ? ((balance / monthlyData.income) * 100).toFixed(1) : 0}%</span>
                </div>
             </div>
          </div>

          {/* 4. Savings Breakdown (Grid) */}
          <div className="bg-surface p-5 rounded-[24px] shadow-apple border border-border">
            <div className="flex items-center gap-2 mb-4">
               <div className="p-1.5 bg-green-500/10 text-green-600 rounded-md">
                   <TrendingUp size={14} />
               </div>
               <h3 className="font-bold text-xs text-text-main uppercase tracking-wider">Allocation</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               {/* Invest */}
               <div className="bg-input-bg p-4 rounded-xl border border-border hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                      <p className="text-[10px] font-bold text-text-muted uppercase">Invest (60%)</p>
                  </div>
                  <p className="font-bold text-lg text-text-main">RM {investmentFund.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
               </div>
               
               {/* Emergency */}
               <div className="bg-input-bg p-4 rounded-xl border border-border hover:border-orange-400/30 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                      <p className="text-[10px] font-bold text-text-muted uppercase">Backup (40%)</p>
                  </div>
                  <p className="font-bold text-lg text-text-main">RM {emergencyFund.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
               </div>
            </div>
            
            {savingTotal === 0 && balance < 0 && (
                <div className="mt-3 p-2 bg-red-500/10 rounded-lg flex items-center justify-center gap-2 text-red-500 border border-red-500/20">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                    <p className="text-[10px] font-bold">Negative Balance</p>
                </div>
            )}
          </div>

          {/* 5. Spending Mix (Enhanced Pie + Summary) */}
          <div className="bg-surface p-6 rounded-[24px] shadow-apple border border-border flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-sm text-text-main">Financial Mix</h3>
                <span className="text-[10px] font-bold bg-input-bg text-text-muted px-2 py-1 rounded-md border border-border">This Month</span>
            </div>
            
            {chartData.length > 0 ? (
              <div className="flex-1 flex flex-col">
                {/* Chart Area */}
                <div className="w-full h-[220px] mb-6 relative">
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <defs>
                            {Object.values(CATEGORY_STYLES).map((style) => (
                                <linearGradient key={style.id} id={style.id} x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor={style.start} stopOpacity={0.95}/>
                                    <stop offset="100%" stopColor={style.end} stopOpacity={1}/>
                                </linearGradient>
                            ))}
                        </defs>
                        <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={80}
                        dataKey="value"
                        >
                        {chartData.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={`url(#${getStyle(entry.name).id})`}
                                stroke="rgba(255,255,255,0.4)"
                                strokeWidth={2}
                            />
                        ))}
                        </Pie>
                        <Tooltip 
                            formatter={(value: number) => [`RM ${value.toLocaleString(undefined, {minimumFractionDigits: 0})}`]} 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '8px 12px', fontSize: '12px' }}
                            itemStyle={{ color: '#1d1d1f', fontWeight: 600 }}
                        />
                    </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Spending vs Saving Summary Cards */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 flex flex-col items-center text-center">
                        <div className="flex items-center gap-1 mb-1 text-red-500">
                            <ArrowUp size={12} strokeWidth={3} />
                            <p className="text-[10px] uppercase font-bold tracking-wider">Spent</p>
                        </div>
                        <p className="font-bold text-lg text-red-700 dark:text-red-400">RM {totalExpenses.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
                        <p className="text-[10px] font-bold text-red-400 bg-surface/50 px-2 py-0.5 rounded-full mt-1">{spendingPct.toFixed(0)}% of Income</p>
                    </div>
                    <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20 flex flex-col items-center text-center">
                         <div className="flex items-center gap-1 mb-1 text-green-600">
                            <ArrowDown size={12} strokeWidth={3} />
                            <p className="text-[10px] uppercase font-bold tracking-wider">Saved</p>
                        </div>
                        <p className="font-bold text-lg text-green-700 dark:text-green-400">RM {savingTotal.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
                        <p className="text-[10px] font-bold text-green-600 bg-surface/50 px-2 py-0.5 rounded-full mt-1">{savingPct.toFixed(0)}% of Income</p>
                    </div>
                </div>

                {/* Detailed Category Legend */}
                <div className="space-y-3 border-t border-border pt-4">
                    {chartData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-3">
                                <div 
                                    className="w-2.5 h-2.5 rounded-full shadow-sm bg-gradient-to-br" 
                                    style={{ 
                                        backgroundImage: `linear-gradient(to bottom right, ${getStyle(item.name).start}, ${getStyle(item.name).end})`
                                    }}
                                ></div>
                                <span className="font-medium text-text-muted group-hover:text-text-main transition-colors">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-text-main">RM {item.value.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                                <span className="text-[10px] font-bold bg-input-bg text-text-muted px-1.5 py-0.5 rounded min-w-[32px] text-center border border-border">
                                    {((item.value / totalChartValue) * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
              </div>
            ) : (
               <div className="flex-1 flex items-center justify-center text-text-muted text-xs italic">
                   Add expenses to visualize
               </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Budget;