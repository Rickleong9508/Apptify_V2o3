import React, { useState, useMemo, useEffect } from 'react';
import { MonthlyData, Expense, ExpenseSubItem, ExpenseCategory, BudgetHistoryItem, Account } from '../types';
import { SupportedLanguage, Language, getStoredLanguage } from '../utils/i18n';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Plus,
  X,
  Calculator,
  ArrowRight,
  Repeat,
  Clock,
  TrendingUp,
  Archive,
  PieChart as PieIcon,
  Pencil,
  Trash2,
  ListChecks,
  ArrowDownLeft,
  ArrowUpRight,
  Check
} from 'lucide-react';

interface BudgetProps {
  monthlyData: MonthlyData;
  setMonthlyData: React.Dispatch<React.SetStateAction<MonthlyData>>;
  fixedExpenses: Expense[];
  setFixedExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  budgetHistory: BudgetHistoryItem[];
  onArchiveMonth: () => void;
  accounts: Account[];
}

interface CategoryStyle {
  id: string;
  start: string;
  end: string;
  text: string;
  onFill: string;
  zhLabel: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  /* Five distinguishable treatments, every one of them inside the four
     pigments: brand blue, lifted blue, signal yellow, deep yellow, ink. */
  [ExpenseCategory.MAINTENANCE]: {
    id: 'tone-blue',
    start: '#2600FD',
    end: '#5B3BFF',
    text: 'text-[#2600FD]',
    onFill: '#FFFFFF',
    zhLabel: '日常维护 (Self Maintenance)'
  },
  [ExpenseCategory.LOAN]: {
    id: 'tone-ink',
    start: '#0A0A0B',
    end: '#3A3A40',
    text: 'text-zinc-900',
    onFill: '#FFFFFF',
    zhLabel: '贷款 (Loan)'
  },
  [ExpenseCategory.SAVING]: {
    id: 'tone-blue-lift',
    start: '#6C52FF',
    end: '#A794FF',
    text: 'text-[#5B3BFF]',
    onFill: '#FFFFFF',
    zhLabel: '结余储蓄 (Saving)'
  },
  [ExpenseCategory.FAMILY]: {
    id: 'tone-yellow',
    start: '#FFBF00',
    end: '#FFC929',
    text: 'text-amber-600',
    onFill: '#0A0A0B',
    zhLabel: '家庭支出 (Family Expenses)'
  },
  [ExpenseCategory.OTHER]: {
    id: 'tone-yellow-deep',
    start: '#D49A00',
    end: '#F2B400',
    text: 'text-amber-700',
    onFill: '#0A0A0B',
    zhLabel: '其他 (Other)'
  },
  'Unallocated': {
    id: 'tone-neutral',
    start: '#52525A',
    end: '#717177',
    text: 'text-zinc-500',
    onFill: '#FFFFFF',
    zhLabel: '未分类'
  }
};

const getStyle = (name: string) => CATEGORY_STYLES[name] || CATEGORY_STYLES['Unallocated'];

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface PieDatum {
  name: string;
  value: number;
  sharePct: number;
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, sharePct, percent, name }: any) => {
  const pct = typeof sharePct === 'number' ? sharePct : (typeof percent === 'number' ? percent * 100 : 0);
  if (!pct || pct < 7) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.56;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const style = getStyle(name);

  return (
    <text
      x={x}
      y={y}
      fill={style.onFill}
      textAnchor="middle"
      dominantBaseline="central"
      pointerEvents="none"
      style={{
        fontSize: '11px',
        fontWeight: 800,
        fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, sans-serif',
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      {Math.round(pct)}%
    </text>
  );
};

interface CustomPieTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PieDatum }>;
  lang: SupportedLanguage;
}

const CustomPieTooltip: React.FC<CustomPieTooltipProps> = ({ active, payload, lang }) => {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  const style = getStyle(datum.name);

  return (
    <div
      style={{
        backgroundColor: '#0A0A0B',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: '14px',
        padding: '10px 14px',
        boxShadow: '0 14px 32px -12px rgba(10,10,11,0.45)',
        minWidth: '160px'
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: style.start }}
        />
        <span className="text-[11px] font-bold tracking-wide text-white/90">
          {lang === 'zh' ? style.zhLabel : datum.name}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4 mt-1">
        <span className="text-sm font-black text-white font-mono-numbers">
          RM {datum.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span
          className="text-xs font-black font-mono-numbers px-1.5 py-0.5 rounded-md"
          style={{ backgroundColor: '#FFBF00', color: '#0A0A0B' }}
        >
          {datum.sharePct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

interface EditableSubItem {
  id: string;
  label: string;
  type: 'out' | 'in';
  amountStr: string;
}

interface ExpenseItemProps {
  item: Expense;
  isFixedList: boolean;
  onEdit: (item: Expense, isFixed: boolean) => void;
  onRemove: (id: string, isFixed: boolean) => void;
  lang?: SupportedLanguage;
}

const ExpenseItem: React.FC<ExpenseItemProps> = ({ item, isFixedList, onEdit, onRemove, lang = 'en' }) => {
  const style = getStyle(item.category as string);
  const subCount = item.subItems?.length || 0;

  return (
    <div
      onClick={() => onEdit(item, isFixedList)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(item, isFixedList);
        }
      }}
      className="group flex items-center justify-between p-3 px-4 hover:bg-zinc-50 active:bg-zinc-100/80 transition-colors border-b border-gray-100 last:border-0 cursor-pointer"
      title={lang === 'zh' ? '点击编辑或添加明细细分' : 'Click to edit or add breakdown'}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm shrink-0"
          style={{
            backgroundImage: `linear-gradient(to bottom right, ${style.start}, ${style.end})`,
            color: style.onFill
          }}
        >
          {item.category.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
              {item.name}
            </p>
            {subCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#2600FD]/10 text-[#2600FD] text-[10px] font-bold font-mono-numbers shrink-0">
                <ListChecks size={10} />
                {lang === 'zh' ? `${subCount} 项明细` : `${subCount} items`}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">{item.category}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span className="font-bold font-mono-numbers text-gray-900 text-sm">
          RM {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span
          className="w-7 h-7 hidden sm:flex items-center justify-center text-zinc-400 group-hover:text-[#2600FD] group-hover:bg-[#2600FD]/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
          aria-hidden="true"
        >
          <Pencil size={13} />
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id, isFixedList);
          }}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
          title={lang === 'zh' ? '删除' : 'Delete'}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

interface BudgetEditModalProps {
  expense: Expense;
  originIsFixed: boolean;
  lang: SupportedLanguage;
  onClose: () => void;
  onSave: (updated: Expense, originIsFixed: boolean) => void;
  onDelete: (id: string, originIsFixed: boolean) => void;
}

const BudgetEditModal: React.FC<BudgetEditModalProps> = ({
  expense,
  originIsFixed,
  lang,
  onClose,
  onSave,
  onDelete
}) => {
  const [name, setName] = useState(expense.name);
  const [category, setCategory] = useState<string>(expense.category);
  const [isFixed, setIsFixed] = useState<boolean>(originIsFixed);
  const [amountStr, setAmountStr] = useState<string>(expense.amount.toString());
  const [subItems, setSubItems] = useState<EditableSubItem[]>(() =>
    (expense.subItems || []).map((s) => ({
      id: s.id,
      label: s.label,
      type: s.type,
      amountStr: s.amount.toString()
    }))
  );

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const hasSubItems = subItems.length > 0;

  const breakdownSummary = useMemo(() => {
    let totalOut = 0;
    let totalIn = 0;
    subItems.forEach((s) => {
      const val = parseFloat(s.amountStr);
      if (!isNaN(val) && val > 0) {
        if (s.type === 'out') totalOut += val;
        else totalIn += val;
      }
    });
    totalOut = round2(totalOut);
    totalIn = round2(totalIn);
    const rawNet = round2(totalOut - totalIn);
    const finalAmount = Math.max(0, rawNet);
    const excessInflow = rawNet < 0 ? round2(Math.abs(rawNet)) : 0;
    return { totalOut, totalIn, rawNet, finalAmount, excessInflow };
  }, [subItems]);

  const handleAddSubItem = () => {
    const now = Date.now();
    if (subItems.length === 0) {
      const currentVal = parseFloat(amountStr);
      const seeded: EditableSubItem[] = [];
      if (!isNaN(currentVal) && currentVal > 0) {
        seeded.push({
          id: `sub-${now}-base`,
          label: name.trim() || (lang === 'zh' ? '原有金额' : 'Base amount'),
          type: 'out',
          amountStr: currentVal.toString()
        });
      }
      seeded.push({
        id: `sub-${now}-new`,
        label: '',
        type: 'out',
        amountStr: ''
      });
      setSubItems(seeded);
    } else {
      setSubItems((prev) => [
        ...prev,
        {
          id: `sub-${now}-${Math.random().toString(36).slice(2, 6)}`,
          label: '',
          type: 'out',
          amountStr: ''
        }
      ]);
    }
  };

  const handleUpdateSubItem = (id: string, patch: Partial<EditableSubItem>) => {
    setSubItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleRemoveSubItem = (id: string) => {
    setSubItems((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        setAmountStr(breakdownSummary.finalAmount.toString());
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const cleanedSubItems: ExpenseSubItem[] = subItems
      .map((s) => {
        const parsed = parseFloat(s.amountStr);
        const amount = !isNaN(parsed) && parsed > 0 ? round2(parsed) : 0;
        return {
          id: s.id,
          label: s.label.trim(),
          type: s.type,
          amount
        };
      })
      .filter((s) => s.label !== '' || s.amount > 0);

    let finalAmount = 0;
    if (cleanedSubItems.length > 0) {
      const outSum = cleanedSubItems
        .filter((s) => s.type === 'out')
        .reduce((acc, s) => acc + s.amount, 0);
      const inSum = cleanedSubItems
        .filter((s) => s.type === 'in')
        .reduce((acc, s) => acc + s.amount, 0);
      finalAmount = Math.max(0, round2(outSum - inSum));
    } else {
      const parsed = parseFloat(amountStr);
      finalAmount = !isNaN(parsed) && parsed >= 0 ? round2(parsed) : 0;
    }

    const updatedExpense: Expense = {
      ...expense,
      name: trimmedName,
      category,
      isFixed,
      amount: finalAmount,
      subItems: cleanedSubItems.length > 0 ? cleanedSubItems : undefined
    };

    onSave(updatedExpense, originIsFixed);
  };

  const style = getStyle(category);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-200/80 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-sm shrink-0"
              style={{
                backgroundImage: `linear-gradient(to bottom right, ${style.start}, ${style.end})`,
                color: style.onFill
              }}
            >
              {category.charAt(0)}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black tracking-tight text-zinc-950 truncate">
                {lang === 'zh' ? '编辑预算条目与明细' : 'Edit Budget Entry'}
              </h3>
              <p className="text-[11px] font-mono text-zinc-500">
                {lang === 'zh' ? '修改内容、分类或添加出账/进账细分自动算总额' : 'Update details or add outflow / inflow breakdown'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-5 sm:px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {/* Primary Fields */}
            <div className="space-y-3.5">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                  {lang === 'zh' ? '预算名称 / CONTENT' : 'ENTRY CONTENT'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'zh' ? '例如：话费、伙食费、房租' : 'e.g., Telcom, Meal, Rent'}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-300 text-sm font-semibold text-zinc-950 outline-none focus:bg-white focus:border-[#2600FD] transition-colors"
                />
              </div>

              {/* Category + Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                    {lang === 'zh' ? '支出分类' : 'CATEGORY'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-300 text-xs font-mono font-bold text-zinc-900 outline-none focus:bg-white focus:border-[#2600FD] cursor-pointer"
                  >
                    {Object.values(ExpenseCategory)
                      .filter((cat) => cat !== ExpenseCategory.SAVING)
                      .map((c) => (
                        <option key={c} value={c}>
                          {lang === 'zh' ? getStyle(c).zhLabel : c}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                    {lang === 'zh' ? '账单类型' : 'BILL TYPE'}
                  </label>
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-100 border border-zinc-200 font-mono">
                    <button
                      type="button"
                      onClick={() => setIsFixed(false)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !isFixed ? 'bg-[#0A0A0B] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      {lang === 'zh' ? '单次日常' : 'One-Time'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFixed(true)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        isFixed ? 'bg-[#0A0A0B] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      <Repeat size={11} />
                      {lang === 'zh' ? '固定周期' : 'Recurring'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Amount (manual when no sub-items, auto-synced display when sub-items exist) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                    {lang === 'zh' ? '金额 (RM)' : 'AMOUNT (RM)'}
                  </label>
                  {hasSubItems && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#2600FD] bg-[#2600FD]/10 px-2 py-0.5 rounded-md">
                      <Calculator size={10} />
                      {lang === 'zh' ? '已由下方明细自动汇总' : 'Auto-calculated from breakdown'}
                    </span>
                  )}
                </div>

                {hasSubItems ? (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0A0A0B] text-white">
                    <span className="text-xs font-mono text-white/60 uppercase tracking-wider">
                      {lang === 'zh' ? '最终净支出' : 'FINAL NET TOTAL'}
                    </span>
                    <span className="text-lg font-black font-mono-numbers text-white">
                      RM {breakdownSummary.finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-300 focus-within:bg-white focus-within:border-[#2600FD] transition-colors">
                    <span className="text-xs font-mono font-black text-zinc-400 mr-2">RM</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amountStr}
                      onFocus={() => {
                        if (amountStr === '0' || parseFloat(amountStr) === 0) setAmountStr('');
                      }}
                      onBlur={() => {
                        if (amountStr.trim() === '') setAmountStr('0');
                      }}
                      onChange={(e) => setAmountStr(e.target.value)}
                      placeholder="0.00"
                      className="w-full text-base font-black bg-transparent text-zinc-950 outline-none font-mono-numbers"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Sub-Items Breakdown Section */}
            <div className="pt-4 border-t border-zinc-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#FFBF00] text-[#0A0A0B] flex items-center justify-center">
                    <ListChecks size={13} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-950">
                      {lang === 'zh' ? '细分明细（出账 / 进账）' : 'ITEMIZED BREAKDOWN (OUT / IN)'}
                    </h4>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddSubItem}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#2600FD] hover:bg-[#1A00B3] text-white text-xs font-bold shadow-sm transition-all cursor-pointer tactile-press"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  {lang === 'zh' ? '添加细分' : 'Add Line'}
                </button>
              </div>

              {!hasSubItems ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4 text-center">
                  <p className="text-xs text-zinc-500">
                    {lang === 'zh'
                      ? '可为此项目拆分为多笔出账与进账（如基础月费、加购流量、公司报销/返现），系统会自动加减算出最终金额。'
                      : 'Split this entry into multiple outflow & inflow lines (e.g., base bill, extra charges, rebates/refunds) and auto-calculate the final total.'}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {lang === 'zh'
                      ? '点击「添加细分」时，当前金额会自动保留为第一条出账明细。'
                      : 'Clicking "Add Line" keeps the current amount as the first outflow line.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {subItems.map((sub, idx) => (
                    <div
                      key={sub.id}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/90"
                    >
                      {/* Outflow / Inflow Toggle */}
                      <div className="grid grid-cols-2 p-0.5 rounded-xl bg-white border border-zinc-200 shrink-0 sm:w-[116px]">
                        <button
                          type="button"
                          onClick={() => handleUpdateSubItem(sub.id, { type: 'out' })}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                            sub.type === 'out'
                              ? 'bg-[#0A0A0B] text-white shadow-sm'
                              : 'text-zinc-400 hover:text-zinc-700'
                          }`}
                          title={lang === 'zh' ? '出账：增加此项支出' : 'Outflow: adds to expense'}
                        >
                          <ArrowUpRight size={11} />
                          {lang === 'zh' ? '出账' : 'Out'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateSubItem(sub.id, { type: 'in' })}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                            sub.type === 'in'
                              ? 'bg-[#2600FD] text-white shadow-sm'
                              : 'text-zinc-400 hover:text-zinc-700'
                          }`}
                          title={lang === 'zh' ? '进账：报销/返现，抵扣支出' : 'Inflow: rebate/refund, offsets expense'}
                        >
                          <ArrowDownLeft size={11} />
                          {lang === 'zh' ? '进账' : 'In'}
                        </button>
                      </div>

                      {/* Sub-item Description */}
                      <input
                        type="text"
                        value={sub.label}
                        onChange={(e) => handleUpdateSubItem(sub.id, { label: e.target.value })}
                        placeholder={
                          sub.type === 'out'
                            ? lang === 'zh'
                              ? `出账说明 #${idx + 1}（如：月费、流量包）`
                              : `Outflow note #${idx + 1}`
                            : lang === 'zh'
                              ? `进账说明 #${idx + 1}（如：返现、报销）`
                              : `Inflow note #${idx + 1} (refund/rebate)`
                        }
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-medium text-zinc-900 outline-none focus:border-[#2600FD]"
                      />

                      {/* Sub-item Amount + Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center px-2.5 py-2 rounded-xl bg-white border border-zinc-200 focus-within:border-[#2600FD] w-full sm:w-32">
                          <span
                            className={`text-[11px] font-mono font-black mr-1 whitespace-nowrap shrink-0 ${
                              sub.type === 'in' ? 'text-[#2600FD]' : 'text-zinc-400'
                            }`}
                          >
                            {sub.type === 'in' ? '−RM' : 'RM'}
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={sub.amountStr}
                            onFocus={() => {
                              if (sub.amountStr === '0') handleUpdateSubItem(sub.id, { amountStr: '' });
                            }}
                            onChange={(e) => handleUpdateSubItem(sub.id, { amountStr: e.target.value })}
                            placeholder="0.00"
                            className="w-full text-xs font-black bg-transparent text-zinc-950 outline-none font-mono-numbers"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubItem(sub.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                          title={lang === 'zh' ? '删除此条明细' : 'Remove line'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Auto-calculation Summary Card */}
                  <div className="rounded-2xl bg-zinc-950 text-white p-4 space-y-2 mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60 font-mono">
                        {lang === 'zh' ? '总出账 (OUTFLOW)' : 'TOTAL OUTFLOW'}
                      </span>
                      <span className="font-bold font-mono-numbers text-white">
                        + RM {breakdownSummary.totalOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60 font-mono">
                        {lang === 'zh' ? '总进账抵扣 (INFLOW)' : 'TOTAL INFLOW OFFSET'}
                      </span>
                      <span className="font-bold font-mono-numbers text-[#A794FF]">
                        − RM {breakdownSummary.totalIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-white/15 flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#FFBF00]">
                        {lang === 'zh' ? '计算结果 (最终金额)' : 'CALCULATED FINAL'}
                      </span>
                      <span className="text-lg font-black font-mono-numbers text-white">
                        RM {breakdownSummary.finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {breakdownSummary.excessInflow > 0 && (
                      <div className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-[#FFBF00]/15 text-[#FFBF00] border border-[#FFBF00]/30">
                        {lang === 'zh'
                          ? `进账高于出账，支出最低归零 RM 0.00（超出 RM ${breakdownSummary.excessInflow.toFixed(2)}）`
                          : `Inflow exceeds outflow — clamped to RM 0.00 (excess RM ${breakdownSummary.excessInflow.toFixed(2)})`}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-6 py-4 border-t border-zinc-200/80 bg-zinc-50/70 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onDelete(expense.id, originIsFixed)}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
              {lang === 'zh' ? '删除条目' : 'Delete'}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-200/70 transition-colors cursor-pointer"
              >
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#0A0A0B] hover:bg-[#2600FD] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer tactile-press"
              >
                <Check size={14} strokeWidth={2.5} />
                {lang === 'zh' ? '保存修改' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
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
  const [isIncomeFocused, setIsIncomeFocused] = useState(false);

  // Sync incomeInput when monthlyData.income changes externally (e.g. cloud sync / local load / archive)
  useEffect(() => {
    if (!isIncomeFocused) {
      setIncomeInput(monthlyData.income.toString());
    }
  }, [monthlyData.income, isIncomeFocused]);

  // Form State
  const [newExpName, setNewExpName] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [newExpCat, setNewExpCat] = useState<ExpenseCategory>(ExpenseCategory.MAINTENANCE);
  const [isRecurring, setIsRecurring] = useState(false);

  // Edit Modal State
  const [editingEntry, setEditingEntry] = useState<{ expense: Expense; isFixed: boolean } | null>(null);

  // Auto Calculations
  const allExpenses = useMemo(() => {
    return [...fixedExpenses, ...monthlyData.expenses];
  }, [fixedExpenses, monthlyData.expenses]);

  const totalExpenses = useMemo(
    () => round2(allExpenses.reduce((sum, item) => sum + item.amount, 0)),
    [allExpenses]
  );

  const balance = round2(monthlyData.income - totalExpenses);

  // Chart Data Preparation (with accurate percentages across all categories including Saving)
  const chartData = useMemo<PieDatum[]>(() => {
    const data: Record<string, number> = {};

    allExpenses.forEach((exp) => {
      let key = Object.values(ExpenseCategory).includes(exp.category as ExpenseCategory)
        ? exp.category
        : ExpenseCategory.OTHER;
      if (key === ExpenseCategory.SAVING) key = ExpenseCategory.OTHER;
      data[key] = round2((data[key] || 0) + exp.amount);
    });

    const rawList = Object.keys(data).map((key) => ({ name: key, value: data[key] }));

    if (balance > 0) {
      rawList.push({ name: ExpenseCategory.SAVING, value: balance });
    }

    const positive = rawList.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
    const total = positive.reduce((sum, item) => sum + item.value, 0);

    return positive.map((item) => ({
      ...item,
      sharePct: total > 0 ? (item.value / total) * 100 : 0
    }));
  }, [allExpenses, balance]);

  // Savings Allocation 60 / 40
  const savingTotal = balance > 0 ? balance : 0;
  const investmentFund = savingTotal * 0.6;
  const emergencyFund = savingTotal * 0.4;

  const handleIncomeFocus = () => {
    setIsIncomeFocused(true);
    if (incomeInput === '0' || parseFloat(incomeInput) === 0) {
      setIncomeInput('');
    }
  };

  const handleIncomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setIncomeInput(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      setMonthlyData((prev) => ({ ...prev, income: parsed }));
    } else if (raw === '') {
      setMonthlyData((prev) => ({ ...prev, income: 0 }));
    }
  };

  const handleIncomeBlur = () => {
    setIsIncomeFocused(false);
    const val = parseFloat(incomeInput);
    if (isNaN(val) || val < 0) {
      setMonthlyData((prev) => ({ ...prev, income: 0 }));
      setIncomeInput('0');
    } else {
      setMonthlyData((prev) => ({ ...prev, income: val }));
      setIncomeInput(val.toString());
    }
  };

  const addExpense = () => {
    if (!newExpName.trim() || !newExpAmount) return;
    const val = parseFloat(newExpAmount);
    if (isNaN(val) || val <= 0) return;

    const newExpense: Expense = {
      id: Date.now().toString(),
      name: newExpName.trim(),
      amount: round2(val),
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

  const handleSaveEditedExpense = (updated: Expense, originIsFixed: boolean) => {
    if (originIsFixed === updated.isFixed) {
      if (updated.isFixed) {
        setFixedExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      } else {
        setMonthlyData((prev) => ({
          ...prev,
          expenses: prev.expenses.map((e) => (e.id === updated.id ? updated : e))
        }));
      }
    } else {
      // Moved between Fixed and Variable lists
      if (originIsFixed) {
        setFixedExpenses((prev) => prev.filter((e) => e.id !== updated.id));
        setMonthlyData((prev) => ({
          ...prev,
          expenses: [...prev.expenses, updated]
        }));
      } else {
        setMonthlyData((prev) => ({
          ...prev,
          expenses: prev.expenses.filter((e) => e.id !== updated.id)
        }));
        setFixedExpenses((prev) => [...prev, updated]);
      }
    }
    setEditingEntry(null);
  };

  const removeExpense = (id: string, isFixed: boolean) => {
    if (confirm(lang === 'zh' ? '确认删除此项支出？' : 'Delete this expense item?')) {
      if (isFixed) {
        setFixedExpenses((prev) => prev.filter((e) => e.id !== id));
      } else {
        setMonthlyData((prev) => ({
          ...prev,
          expenses: prev.expenses.filter((e) => e.id !== id)
        }));
      }
      if (editingEntry?.expense.id === id) {
        setEditingEntry(null);
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
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-zinc-200/60 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-extrabold bg-zinc-900 text-[#FFBF00]">
              CAPITAL // ALLOCATION
            </span>
            <span className="font-mono text-[10px] text-zinc-400">
              03 // BUDGET
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] uppercase text-zinc-950">
            {lang === 'zh' ? '月度收支与预算规划' : 'Monthly Cash Flow & Budget'}
          </h2>
          <p className="text-xs font-mono text-zinc-500 mt-0.5">
            {lang === 'zh' ? '收支流水平衡 · 固定账单跟踪 · 结余资产分配' : 'Inflow/outflow balancing · Fixed bills · Surplus allocation'}
          </p>
        </div>

        {/* Tactical Cockpit Bar: Quick Stats */}
        <div className="flex flex-wrap sm:flex-nowrap items-stretch rounded-2xl bg-white border border-zinc-300 shadow-md divide-x divide-zinc-200 overflow-hidden">
          {/* Income Input */}
          <div className="px-4 py-2.5 flex flex-col justify-center">
            <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
              {lang === 'zh' ? 'EXPECTED // 本月收入' : 'INCOME // EXPECTED'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-mono font-black text-[#FFBF00] bg-zinc-900 px-1.5 py-0.5 rounded">RM</span>
              <input
                type="number"
                step="any"
                min="0"
                value={incomeInput}
                onFocus={handleIncomeFocus}
                onChange={handleIncomeChange}
                onBlur={handleIncomeBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                className="w-24 text-base font-black text-zinc-950 bg-transparent outline-none font-mono-numbers"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Total Spent */}
          <div className="px-4 py-2.5 flex flex-col justify-center">
            <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
              {lang === 'zh' ? 'OUTFLOW // 总支出' : 'OUTFLOW // SPENT'}
            </span>
            <span className="text-base font-black text-zinc-950 mt-0.5 font-mono-numbers">
              RM {totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* Balance */}
          <div className="px-4 py-2.5 flex flex-col justify-center">
            <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
              {lang === 'zh' ? 'SURPLUS // 预测结余' : 'SURPLUS // BALANCE'}
            </span>
            <span className={`text-base font-black mt-0.5 font-mono-numbers ${balance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              RM {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* End Month / Archive Button */}
          <button
            onClick={onArchiveMonth}
            className="px-4 py-2.5 flex items-center gap-1.5 text-xs font-mono font-bold text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all whitespace-nowrap cursor-pointer tactile-press"
            title={lang === 'zh' ? '将本月预算封存入历史记录' : 'Archive current month summary'}
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
            <div className="p-5 border-b border-zinc-200/60">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#FFBF00] text-[#0A0A0B] flex items-center justify-center font-bold">
                    <Plus size={15} strokeWidth={2.5} />
                  </div>
                  <h3 className="font-black text-sm text-zinc-950 uppercase tracking-tight">
                    {lang === 'zh' ? '录入预算事项' : 'Add Budget Entry'}
                  </h3>
                </div>

                {/* Recurring vs One-Time Segment */}
                <div className="flex p-0.5 rounded-xl bg-zinc-100 border border-zinc-200/60 font-mono">
                  <button
                    onClick={() => setIsRecurring(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${!isRecurring ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                  >
                    {lang === 'zh' ? '单次日常' : 'One-Time'}
                  </button>
                  <button
                    onClick={() => setIsRecurring(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${isRecurring ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                  >
                    <Repeat size={11} /> {lang === 'zh' ? '固定周期' : 'Recurring'}
                  </button>
                </div>
              </div>

              {/* Form Input Deck */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  placeholder={isRecurring ? (lang === 'zh' ? '固定账单 (例如：房贷、宽带费)' : 'Recurring Bill (e.g., Rent, Utilities)') : (lang === 'zh' ? '支出事项 (例如：超市采买)' : 'Expense (e.g., Groceries, Fuel)')}
                  value={newExpName}
                  onChange={(e) => setNewExpName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addExpense();
                  }}
                  className="flex-[2] px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-300 text-sm text-zinc-950 outline-none focus:bg-white focus:border-[#2600FD]"
                />

                <div className="flex-1 flex items-center px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-300 focus-within:bg-white focus-within:border-[#2600FD]">
                  <span className="text-xs font-mono font-bold text-zinc-400 mr-1">RM</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={newExpAmount}
                    onChange={(e) => setNewExpAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addExpense();
                    }}
                    className="w-full text-sm font-bold bg-transparent text-zinc-950 outline-none font-mono-numbers"
                  />
                </div>

                <select
                  value={newExpCat}
                  onChange={(e) => setNewExpCat(e.target.value as ExpenseCategory)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-300 text-xs font-mono font-bold text-zinc-700 outline-none cursor-pointer"
                >
                  {Object.values(ExpenseCategory)
                    .filter((cat) => cat !== ExpenseCategory.SAVING)
                    .map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                </select>

                <button
                  onClick={addExpense}
                  className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-[#2600FD] text-white font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center cursor-pointer tactile-press"
                  title={lang === 'zh' ? '添加项目' : 'Add Item'}
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>

            {/* Ledger Lists */}
            <div className="divide-y divide-gray-100">
              {/* Fixed Recurring */}
              {fixedExpenses.length > 0 && (
                <div>
                  <div className="px-5 py-2.5 bg-gray-50/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Repeat size={12} className="text-[#2600FD]" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        {lang === 'zh' ? `每月固定账单 (${fixedExpenses.length})` : `MONTHLY FIXED BILLS (${fixedExpenses.length})`}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {lang === 'zh' ? '点击条目编辑 / 添加明细' : 'Tap item to edit / breakdown'}
                    </span>
                  </div>
                  <div>
                    {fixedExpenses.map((exp) => (
                      <ExpenseItem
                        key={exp.id}
                        item={exp}
                        isFixedList={true}
                        onEdit={(item, isFixed) => setEditingEntry({ expense: item, isFixed })}
                        onRemove={removeExpense}
                        lang={lang}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Variable */}
              <div>
                <div className="px-5 py-2.5 bg-gray-50/70 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {lang === 'zh' ? `浮动变动支出 (${monthlyData.expenses.length})` : `VARIABLE EXPENSES (${monthlyData.expenses.length})`}
                    </span>
                  </div>
                  {fixedExpenses.length === 0 && (
                    <span className="text-[10px] font-mono text-zinc-400">
                      {lang === 'zh' ? '点击条目编辑 / 添加明细' : 'Tap item to edit / breakdown'}
                    </span>
                  )}
                </div>
                <div>
                  {monthlyData.expenses.map((exp) => (
                    <ExpenseItem
                      key={exp.id}
                      item={exp}
                      isFixedList={false}
                      onEdit={(item, isFixed) => setEditingEntry({ expense: item, isFixed })}
                      onRemove={removeExpense}
                      lang={lang}
                    />
                  ))}
                  {monthlyData.expenses.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-xs italic">
                      {lang === 'zh' ? '本月尚未添加浮动支出项目' : 'No variable expenses added this month'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Status */}
            <div className="p-3 bg-gray-50/50 border-t border-gray-100 text-center">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                {lang === 'zh'
                  ? `共计登记 ${fixedExpenses.length + monthlyData.expenses.length} 笔支出项目`
                  : `${fixedExpenses.length + monthlyData.expenses.length} TOTAL EXPENSE ITEMS LOGGED`}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Analytics - Span 4 */}
        <div className="lg:col-span-4 space-y-5">
          {/* Projected Savings Card */}
          <div className="p-6 rounded-3xl avant-card">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${balance >= 0 ? 'bg-[#FFBF00] text-[#0A0A0B]' : 'bg-rose-500/10 text-rose-500'}`}>
                <Calculator size={16} />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                {balance >= 0 ? (lang === 'zh' ? 'SURPLUS // 预期月末结余' : 'PROJECTED SURPLUS') : (lang === 'zh' ? 'DEFICIT // 预算赤字' : 'PROJECTED DEFICIT')}
              </span>
            </div>

            <div className={`text-3xl font-black tracking-tight my-2 font-mono-numbers ${balance >= 0 ? 'text-zinc-950' : 'text-rose-500'}`}>
              RM {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-zinc-500 mt-3 pt-3 border-t border-zinc-200/60">
              <span>{lang === 'zh' ? '储蓄转化率 (SAVINGS RATE)：' : 'SAVINGS RATE:'}</span>
              <span className="font-black text-zinc-950 font-mono-numbers">
                {monthlyData.income > 0 ? ((balance / monthlyData.income) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>

          {/* Savings Allocation (60% Invest / 40% Backup) */}
          <div className="p-6 rounded-3xl avant-card space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#FFBF00] text-[#0A0A0B] flex items-center justify-center font-bold">
                <TrendingUp size={15} />
              </div>
              <h3 className="font-mono font-black text-xs text-zinc-900 uppercase tracking-wider">
                {lang === 'zh' ? '结余资金科学分配 (60/40)' : 'SURPLUS ALLOCATION (60/40)'}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div className="p-3.5 rounded-2xl bg-zinc-100/70 border border-zinc-200/70">
                <p className="text-[9px] font-bold text-[#2600FD] uppercase tracking-widest">
                  {lang === 'zh' ? '稳健投资 (60%)' : 'INVESTMENT (60%)'}
                </p>
                <p className="font-black text-base text-zinc-950 mt-1 font-mono-numbers">
                  RM {investmentFund.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-100/70 border border-zinc-200/70">
                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">
                  {lang === 'zh' ? '应急储备 (40%)' : 'EMERGENCY (40%)'}
                </p>
                <p className="font-black text-base text-zinc-950 mt-1 font-mono-numbers">
                  RM {emergencyFund.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </div>

          {/* Recharts Pie Chart + Clear Category Percentage Breakdown */}
          <div className="p-6 rounded-3xl avant-card">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-200/60">
              <h3 className="font-mono font-black text-xs text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                <PieIcon size={15} className="text-[#FFBF00]" />
                {lang === 'zh' ? '支出结构分布 (BREAKDOWN)' : 'EXPENSE BREAKDOWN'}
              </h3>
              {chartData.length > 0 && (
                <span className="text-[10px] font-mono font-bold text-zinc-400">
                  {chartData.length} {lang === 'zh' ? '分类' : 'CATS'}
                </span>
              )}
            </div>

            {chartData.length > 0 ? (
              <div>
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
                        outerRadius={80}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`url(#${getStyle(entry.name).id})`}
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<CustomPieTooltip lang={lang} />}
                        wrapperStyle={{ outline: 'none', zIndex: 20 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Clear Category & Percentage Breakdown Legend */}
                <div className="mt-4 pt-3.5 border-t border-zinc-200/70 space-y-2.5">
                  {chartData.map((entry) => {
                    const style = getStyle(entry.name);
                    return (
                      <div key={entry.name} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: style.start }}
                            />
                            <span className="font-bold text-zinc-900 truncate">
                              {lang === 'zh' ? style.zhLabel : entry.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-semibold text-zinc-500 font-mono-numbers">
                              RM {entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="min-w-[46px] text-right text-[11px] font-black font-mono-numbers px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-950">
                              {entry.sharePct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(2, Math.min(100, entry.sharePct))}%`,
                              backgroundImage: `linear-gradient(to right, ${style.start}, ${style.end})`
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-xs italic">
                {lang === 'zh' ? '暂无数据' : 'No expense data'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Budget Entry Modal */}
      {editingEntry && (
        <BudgetEditModal
          expense={editingEntry.expense}
          originIsFixed={editingEntry.isFixed}
          lang={lang}
          onClose={() => setEditingEntry(null)}
          onSave={handleSaveEditedExpense}
          onDelete={removeExpense}
        />
      )}
    </div>
  );
};

export default Budget;
