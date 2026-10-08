import React, { useState, useMemo, useEffect } from 'react';
import { MonthlyData, Expense, ExpenseCategory, BudgetHistoryItem, Account } from '../types';
import { SupportedLanguage } from '../utils/i18n';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Plus, 
  X, 
  Calculator, 
  ArrowRight, 
  Repeat, 
  Clock, 
  TrendingUp, 
  Wallet, 
  Archive,
  PieChart as PieIcon,
  Layers,
  Sparkles
} from 'lucide-react';
import { Language, getStoredLanguage } from '../utils/i18n';

interface BudgetProps {
  monthlyData: MonthlyData;
  setMonthlyData: React.Dispatch<React.SetStateAction<MonthlyData>>;
  fixedExpenses: Expense[];
  setFixedExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  budgetHistory: BudgetHistoryItem[];
  onArchiveMonth: () => void;
  accounts: Account[];
}

const CATEGORY_STYLES: Record<string, { id: string; start: string; end: string; text: string }> = {
  [ExpenseCategory.MAINTENANCE]: { id: 'grad-blue', start: '#0066FF', end: '#38BDF8', text: 'text-blue-500' },
  [ExpenseCategory.LOAN]: { id: 'grad-red', start: '#EF4444', end: '#F87171', text: 'text-rose-500' },
  [ExpenseCategory.SAVING]: { id: 'grad-green', start: '#10B981', end: '#34D399', text: 'text-emerald-500' },
  [ExpenseCategory.FAMILY]: { id: 'grad-orange', start: '#F59E0B', end: '#FBBF24', text: 'text-amber-500' },
  [ExpenseCategory.OTHER]: { id: 'grad-purple', start: '#8B5CF6', end: '#A78BFA', text: 'text-purple-500' },
  'Unallocated': { id: 'grad-gray', start: '#6B7280', end: '#9CA3AF', text: 'text-gray-400' }
};

const getStyle = (name: string) => CATEGORY_STYLES[name] || CATEGORY_STYLES['Unallocated'];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  if (percent < 0.06) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const displayName = name.length > 7 ? name.substring(0, 5) + '..' : name;

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">
      <tspan x={x} dy="-0.5em" className="text-[10px] font-bold fill-white">{displayName}</tspan>
      <tspan x={x} dy="1.2em" className="text-[9px] font-semibold fill-white/90">{(percent * 100).toFixed(0)}%</tspan>
    </text>
  );
};

interface ExpenseItemProps {
  item: Expense;
  isFixedList: boolean;
  onRemove: (id: string, isFixed: boolean) => void;
  lang?: SupportedLanguage;
}

const ExpenseItem: React.FC<ExpenseItemProps> = ({ item, isFixedList, onRemove, lang = 'en' }) => {
  const style = getStyle(item.category as string);
  return (
    <div className="group flex items-center justify-between p-3 px-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm"
          style={{ backgroundImage: `linear-gradient(to bottom right, ${style.start}, ${style.end})` }}
        >
          {item.category.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight">
            {item.name}
          </p>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">{item.category}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold font-mono text-gray-900 dark:text-gray-100 text-sm">
          RM {item.amount.toFixed(2)}
        </span>
        <button
          onClick={() => onRemove(item.id, isFixedList)}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          title={lang === 'zh' ? "删除" : "Delete"}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

const Budget: React.FC<BudgetProps> = ({ 
  monthlyData, 
  setMonthlyData, 
  fixedExpenses, 
  setFixedExpenses, 
  onArchiveMonth 
}) => {
  const [incomeInput, setIncomeInput] = useState(monthlyData.income.toString());

  // Form State
  const [newExpName, setNewExpName] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [newExpCat, setNewExpCat] = useState<ExpenseCategory>(ExpenseCategory.MAINTENANCE);
  const [isRecurring, setIsRecurring] = useState(false);

  // Auto Calculations
  const allExpenses = useMemo(() => {
    return [...fixedExpenses, ...monthlyData.expenses];
  }, [fixedExpenses, monthlyData.expenses]);

  const totalExpenses = useMemo(() =>
    allExpenses.reduce((sum, item) => sum + item.amount, 0),
    [allExpenses]
  );

  const balance = monthlyData.income - totalExpenses;

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const data: Record<string, number> = {};

    allExpenses.forEach(exp => {
      let key = Object.values(ExpenseCategory).includes(exp.category as ExpenseCategory)
        ? exp.category
        : ExpenseCategory.OTHER;
      if (key === ExpenseCategory.SAVING) key = ExpenseCategory.OTHER;
      data[key] = (data[key] || 0) + exp.amount;
    });

    const result = Object.keys(data).map(key => ({ name: key, value: data[key] }));

    if (balance > 0) {
      result.push({ name: ExpenseCategory.SAVING, value: balance });
    }

    return result.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  }, [allExpenses, balance]);

  const totalIncomeCalc = monthlyData.income > 0 ? monthlyData.income : (totalExpenses > 0 ? totalExpenses : 1);
  const spendingPct = Math.min(100, (totalExpenses / totalIncomeCalc) * 100);
  const savingPct = balance > 0 ? (balance / totalIncomeCalc) * 100 : 0;

  // Savings Allocation 60 / 40
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
    if (!newExpName.trim() || !newExpAmount) return;
    const val = parseFloat(newExpAmount);
    if (isNaN(val) || val <= 0) return;

    const newExpense: Expense = {
      id: Date.now().toString(),
      name: newExpName.trim(),
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
    if (confirm(lang === 'zh' ? '确认删除此项支出？' : 'Delete this expense item?')) {
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

  const [lang, setLang] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    const handleLangChange = () => setLang(getStoredLanguage());
    window.addEventListener('apptify_language_change', handleLangChange);
    return () => window.removeEventListener('apptify_language_change', handleLangChange);
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12 font-sans">
      {/* 1. Avant-Garde Masthead with Integrated Tactical Income Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-extrabold bg-zinc-900 text-[#D4FF00] dark:bg-[#D4FF00] dark:text-black">
              CAPITAL // ALLOCATION
            </span>
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              03 // BUDGET
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] uppercase text-zinc-950 dark:text-white">
            {lang === 'zh' ? '月度收支与预算规划' : 'Monthly Cash Flow & Budget'}
          </h2>
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
            {lang === 'zh' ? '收支流水平衡 · 固定账单跟踪 · 结余资产分配' : 'Inflow/outflow balancing · Fixed bills · Surplus allocation'}
          </p>
        </div>

        {/* Tactical Cockpit Bar: Quick Stats */}
        <div className="flex flex-wrap sm:flex-nowrap items-stretch rounded-2xl bg-white dark:bg-[#12141A] border border-zinc-300 dark:border-zinc-800 shadow-md divide-x divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
          {/* Income Input */}
          <div className="px-4 py-2.5 flex flex-col justify-center">
            <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              {lang === 'zh' ? 'EXPECTED // 本月收入' : 'INCOME // EXPECTED'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-mono font-black text-[#D4FF00] bg-zinc-900 px-1 py-0.2 rounded">RM</span>
              <input
                type="number"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                onBlur={updateIncome}
                className="w-24 text-base font-black font-mono text-zinc-950 dark:text-white bg-transparent outline-none font-mono-numbers"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Total Spent */}
          <div className="px-4 py-2.5 flex flex-col justify-center">
            <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              {lang === 'zh' ? 'OUTFLOW // 总支出' : 'OUTFLOW // SPENT'}
            </span>
            <span className="text-base font-black font-mono text-zinc-950 dark:text-white mt-0.5 font-mono-numbers">
              RM {totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* Balance */}
          <div className="px-4 py-2.5 flex flex-col justify-center">
            <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              {lang === 'zh' ? 'SURPLUS // 预测结余' : 'SURPLUS // BALANCE'}
            </span>
            <span className={`text-base font-black font-mono mt-0.5 font-mono-numbers ${balance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
              RM {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* End Month / Archive Button */}
          <button
            onClick={onArchiveMonth}
            className="px-4 py-2.5 flex items-center gap-1.5 text-xs font-mono font-bold text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all whitespace-nowrap cursor-pointer tactile-press"
            title={lang === 'zh' ? "将本月预算封存入历史记录" : "Archive current month summary"}
          >
            <Archive size={14} />
            <span>{lang === 'zh' ? 'ARCHIVE // 结账' : 'ARCHIVE'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Unified Ledger - Span 8 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="rounded-3xl avant-card overflow-hidden flex flex-col">
            
            {/* New Entry Input Row */}
            <div className="p-5 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-[#D4FF00] flex items-center justify-center font-bold">
                    <Plus size={15} strokeWidth={2.5} />
                  </div>
                  <h3 className="font-black text-sm text-zinc-950 dark:text-white uppercase tracking-tight">
                    {lang === 'zh' ? '录入预算事项' : 'Add Budget Entry'}
                  </h3>
                </div>

                {/* Recurring vs One-Time Segment */}
                <div className="flex p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 font-mono">
                  <button
                    onClick={() => setIsRecurring(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${!isRecurring ? 'bg-zinc-950 text-white dark:bg-[#D4FF00] dark:text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                  >
                    {lang === 'zh' ? '单次日常' : 'One-Time'}
                  </button>
                  <button
                    onClick={() => setIsRecurring(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${isRecurring ? 'bg-zinc-950 text-white dark:bg-[#D4FF00] dark:text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                  >
                    <Repeat size={11} /> {lang === 'zh' ? '固定周期' : 'Recurring'}
                  </button>
                </div>
              </div>

              {/* Form Input Deck */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  placeholder={isRecurring ? (lang === 'zh' ? "固定账单 (例如：房贷、宽带费)" : "Recurring Bill (e.g., Rent, Utilities)") : (lang === 'zh' ? "支出事项 (例如：超市采买)" : "Expense (e.g., Groceries, Fuel)")}
                  value={newExpName}
                  onChange={e => setNewExpName(e.target.value)}
                  className="flex-[2] px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-950 dark:text-white outline-none focus:border-[#D4FF00]"
                />

                <div className="flex-1 flex items-center px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus-within:border-[#D4FF00]">
                  <span className="text-xs font-mono font-bold text-zinc-400 mr-1">RM</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={newExpAmount}
                    onChange={e => setNewExpAmount(e.target.value)}
                    className="w-full text-sm font-bold bg-transparent text-zinc-950 dark:text-white outline-none font-mono font-mono-numbers"
                  />
                </div>

                <select
                  value={newExpCat}
                  onChange={e => setNewExpCat(e.target.value as ExpenseCategory)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                >
                  {Object.values(ExpenseCategory)
                    .filter(cat => cat !== ExpenseCategory.SAVING)
                    .map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                </select>

                <button
                  onClick={addExpense}
                  className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 dark:bg-[#D4FF00] dark:text-black dark:hover:bg-[#c2ea00] text-white font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center cursor-pointer tactile-press"
                  title={lang === 'zh' ? "添加项目" : "Add Item"}
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>

            {/* Ledger Lists */}
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {/* Fixed Recurring */}
              {fixedExpenses.length > 0 && (
                <div>
                  <div className="px-5 py-2.5 bg-gray-50/50 dark:bg-white/5 flex items-center gap-2">
                    <Repeat size={12} className="text-blue-500" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{lang === 'zh' ? `每月固定账单 (${fixedExpenses.length})` : `MONTHLY FIXED BILLS (${fixedExpenses.length})`}</span>
                  </div>
                  <div>
                    {fixedExpenses.map(exp => (
                      <ExpenseItem key={exp.id} item={exp} isFixedList={true} onRemove={removeExpense} lang={lang} />
                    ))}
                  </div>
                </div>
              )}

              {/* Variable */}
              <div>
                <div className="px-5 py-2.5 bg-gray-50/50 dark:bg-white/5 flex items-center gap-2">
                  <Clock size={12} className="text-amber-500" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{lang === 'zh' ? `浮动变动支出 (${monthlyData.expenses.length})` : `VARIABLE EXPENSES (${monthlyData.expenses.length})`}</span>
                </div>
                <div>
                  {monthlyData.expenses.map(exp => (
                    <ExpenseItem key={exp.id} item={exp} isFixedList={false} onRemove={removeExpense} lang={lang} />
                  ))}
                  {monthlyData.expenses.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-xs italic">{lang === 'zh' ? '本月尚未添加浮动支出项目' : 'No variable expenses added this month'}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Status */}
            <div className="p-3 bg-gray-50/50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5 text-center">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                {lang === 'zh' ? `共计登记 ${fixedExpenses.length + monthlyData.expenses.length} 笔支出项目` : `${fixedExpenses.length + monthlyData.expenses.length} TOTAL EXPENSE ITEMS LOGGED`}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Analytics - Span 4 */}
        <div className="lg:col-span-4 space-y-5">
          {/* Projected Savings Card */}
          <div className="p-6 rounded-3xl avant-card">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${balance >= 0 ? 'bg-zinc-950 dark:bg-zinc-800 text-[#D4FF00]' : 'bg-rose-500/10 text-rose-500'}`}>
                <Calculator size={16} />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                {balance >= 0 ? (lang === 'zh' ? 'SURPLUS // 预期月末结余' : 'PROJECTED SURPLUS') : (lang === 'zh' ? 'DEFICIT // 预算赤字' : 'PROJECTED DEFICIT')}
              </span>
            </div>

            <div className={`text-3xl font-black font-mono tracking-tight my-2 font-mono-numbers ${balance >= 0 ? 'text-zinc-950 dark:text-[#D4FF00]' : 'text-rose-500'}`}>
              RM {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60">
              <span>{lang === 'zh' ? '储蓄转化率 (SAVINGS RATE)：' : 'SAVINGS RATE:'}</span>
              <span className="font-black text-zinc-950 dark:text-white">
                {monthlyData.income > 0 ? ((balance / monthlyData.income) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>

          {/* Savings Allocation (60% Invest / 40% Backup) */}
          <div className="p-6 rounded-3xl avant-card space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-950 dark:bg-zinc-800 text-[#D4FF00] flex items-center justify-center font-bold">
                <TrendingUp size={15} />
              </div>
              <h3 className="font-mono font-black text-xs text-zinc-900 dark:text-zinc-200 uppercase tracking-wider">{lang === 'zh' ? '结余资金科学分配 (60/40)' : 'SURPLUS ALLOCATION (60/40)'}</h3>
            </div>

            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div className="p-3.5 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60">
                <p className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">{lang === 'zh' ? '稳健投资 (60%)' : 'INVESTMENT (60%)'}</p>
                <p className="font-black text-base text-zinc-950 dark:text-white mt-1 font-mono-numbers">
                  RM {investmentFund.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60">
                <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">{lang === 'zh' ? '应急储备 (40%)' : 'EMERGENCY (40%)'}</p>
                <p className="font-black text-base text-zinc-950 dark:text-white mt-1 font-mono-numbers">
                  RM {emergencyFund.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </div>

          {/* Recharts Pie Chart */}
          <div className="p-6 rounded-3xl avant-card">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <h3 className="font-mono font-black text-xs text-zinc-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <PieIcon size={15} className="text-[#D4FF00]" />
                {lang === 'zh' ? '支出结构分布 (BREAKDOWN)' : 'EXPENSE BREAKDOWN'}
              </h3>
            </div>

            {chartData.length > 0 ? (
              <div className="w-full h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {Object.values(CATEGORY_STYLES).map((style) => (
                        <linearGradient key={style.id} id={style.id} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={style.start} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={style.end} stopOpacity={1} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={75}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`url(#${getStyle(entry.name).id})`}
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [`RM ${val.toLocaleString()}`]}
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: '1px solid rgba(255,255,255,0.2)', 
                        background: 'rgba(20, 22, 28, 0.85)', 
                        backdropFilter: 'blur(16px)',
                        color: '#fff',
                        fontSize: '12px' 
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-xs italic">{lang === 'zh' ? '暂无数据' : 'No expense data'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Budget;