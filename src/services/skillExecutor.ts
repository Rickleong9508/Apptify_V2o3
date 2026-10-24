import { getStoredLanguage } from '../utils/i18n';
import { skillRegistry } from './skillRegistry';

export interface ExecutionResultCard {
  type: 'wealth' | 'vault' | 'task' | 'system';
  title: string;
  details: string[];
  badge?: string;
}

export interface ExecutionResponse {
  message: string;
  result?: ExecutionResultCard;
  navigateTarget?: string;
}

export interface LocalParseResult {
  intent: string;
  data: any;
  message: string;
}

const MYWEALTH_STORAGE_KEY = 'mw_data_main';
const NOTES_STORAGE_KEY = 'apptify_notes';
const TASKS_STORAGE_KEY = 'apptify_tasks';

export const loadMyWealthData = () => {
  try {
    const raw = localStorage.getItem(MYWEALTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        monthlyData: parsed.monthlyData || { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) },
        budgetHistory: Array.isArray(parsed.budgetHistory) ? parsed.budgetHistory : [],
        loans: Array.isArray(parsed.loans) ? parsed.loans : [],
        stocks: Array.isArray(parsed.stocks) ? parsed.stocks : [],
        cash: parsed.cash || { myr: 0, usd: 0, hkd: 0, hkdRate: 0.58 },
        exchangeRate: Number(parsed.exchangeRate) || 4.5,
      };
    }
  } catch (e) {
    console.error('Failed to load MyWealth data:', e);
  }
  return {
    accounts: [
      { id: 'acc-1', name: 'Maybank', balance: 5000, reservations: [], history: [] },
      { id: 'acc-2', name: 'Cash Wallet', balance: 500, reservations: [], history: [] }
    ],
    monthlyData: { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) },
    budgetHistory: [],
    loans: [],
    stocks: [],
    cash: { myr: 0, usd: 0, hkd: 0, hkdRate: 0.58 },
    exchangeRate: 4.5
  };
};

export const saveMyWealthData = (data: any) => {
  localStorage.setItem(MYWEALTH_STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event('apptify_data_changed'));
  window.dispatchEvent(new Event('storage'));
};

export const loadNotes = (): any[] => {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

export const saveNotes = (notes: any[]) => {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  window.dispatchEvent(new Event('apptify_notes_changed'));
  window.dispatchEvent(new Event('apptify_vault_changed'));
  window.dispatchEvent(new Event('apptify_data_changed'));
};

export const loadTasks = (): any[] => {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

export const saveTasks = (tasks: any[]) => {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  window.dispatchEvent(new Event('apptify_tasks_changed'));
  window.dispatchEvent(new Event('apptify_vault_changed'));
  window.dispatchEvent(new Event('apptify_data_changed'));
};

/**
 * Compute comprehensive metrics across all Apptify modules so the Butler
 * can inspect, analyze, and answer any question about the user's data.
 */
export const computeAppMetrics = () => {
  const mw = loadMyWealthData();
  const notes = loadNotes();
  const tasks = loadTasks();

  const exchangeRate = Number(mw.exchangeRate) || 4.5;
  const hkdRate = Number(mw.cash?.hkdRate) || 0.58;

  // Wallets & Reservations
  const walletSummaries = (mw.accounts || []).map((a: any) => {
    const bal = Number(a.balance) || 0;
    const reservations = Array.isArray(a.reservations) ? a.reservations : [];
    const reserved = reservations.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
    return {
      id: a.id,
      name: a.name,
      balance: bal,
      reserved,
      available: Math.max(0, bal - reserved),
      reservations: reservations.map((r: any) => ({ reason: r.reason, amount: Number(r.amount) || 0 })),
      interestRate: a.interestRate || 0,
      recentHistory: Array.isArray(a.history) ? a.history.slice(0, 5) : [],
    };
  });

  const totalCash = walletSummaries.reduce((sum: number, w: any) => sum + w.balance, 0);
  const totalReserved = walletSummaries.reduce((sum: number, w: any) => sum + w.reserved, 0);
  const totalAvailableCash = Math.max(0, totalCash - totalReserved);

  // Investments & Stocks
  const stockSummaries = (mw.stocks || []).map((s: any) => {
    const qty = Number(s.quantity ?? s.shares ?? 0);
    const buyPrice = Number(s.buyPrice || 0);
    const currentPrice = Number(s.currentPrice || buyPrice || 0);
    const currency = s.currency === 'USD' ? 'USD' : 'MYR';
    const fx = currency === 'USD' ? exchangeRate : 1;
    const costBasisMyr = qty * buyPrice * fx;
    const marketValueMyr = qty * currentPrice * fx;
    const pnlMyr = marketValueMyr - costBasisMyr;
    const pnlPct = costBasisMyr > 0 ? (pnlMyr / costBasisMyr) * 100 : 0;
    return {
      symbol: s.symbol,
      name: s.name || s.symbol,
      quantity: qty,
      buyPrice,
      currentPrice,
      currency,
      marketValueMyr: Number(marketValueMyr.toFixed(2)),
      pnlMyr: Number(pnlMyr.toFixed(2)),
      pnlPct: Number(pnlPct.toFixed(2)),
    };
  });

  const totalStockValueMyr = stockSummaries.reduce((s: number, st: any) => s + st.marketValueMyr, 0);
  const totalStockCostMyr = (mw.stocks || []).reduce((s: number, st: any) => {
    const qty = Number(st.quantity ?? st.shares ?? 0);
    const buyPrice = Number(st.buyPrice || 0);
    const fx = st.currency === 'USD' ? exchangeRate : 1;
    return s + qty * buyPrice * fx;
  }, 0);
  const totalStockPnlMyr = totalStockValueMyr - totalStockCostMyr;

  const investCashMyr = Number(mw.cash?.myr) || 0;
  const investCashUsd = Number(mw.cash?.usd) || 0;
  const investCashHkd = Number(mw.cash?.hkd) || 0;
  const totalInvestCashMyr = investCashMyr + investCashUsd * exchangeRate + investCashHkd * hkdRate;
  const totalInvestmentMyr = totalStockValueMyr + totalInvestCashMyr;

  // Loans
  const loanSummaries = (mw.loans || []).map((l: any) => ({
    name: l.name,
    totalAmount: Number(l.totalAmount) || 0,
    remainingAmount: Number(l.remainingAmount ?? l.totalAmount) || 0,
    monthlyPayment: Number(l.monthlyPayment) || 0,
    remainingMonths: Number(l.remainingMonths) || 0,
  }));
  const totalDebt = loanSummaries.reduce((s: number, l: any) => s + l.remainingAmount, 0);
  const totalMonthlyLoanPayment = loanSummaries.reduce((s: number, l: any) => s + l.monthlyPayment, 0);

  // Monthly Budget & Expenses
  const monthlyIncome = Number(mw.monthlyData?.income) || 0;
  const expenses = Array.isArray(mw.monthlyData?.expenses) ? mw.monthlyData.expenses : [];
  const fixedExpenses = expenses.filter((e: any) => e.isFixed);
  const variableExpenses = expenses.filter((e: any) => !e.isFixed);
  const totalFixedExpenses = fixedExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const totalVariableExpenses = variableExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const totalMonthlyExpenses = totalFixedExpenses + totalVariableExpenses + totalMonthlyLoanPayment;

  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e: any) => {
    const cat = e.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e.amount) || 0);
  });
  if (totalMonthlyLoanPayment > 0) {
    categoryTotals['Loan'] = (categoryTotals['Loan'] || 0) + totalMonthlyLoanPayment;
  }

  const netMonthlySurplus = monthlyIncome - totalMonthlyExpenses;
  const savingsRatePct = monthlyIncome > 0 ? Math.round((netMonthlySurplus / monthlyIncome) * 100) : 0;

  const grossNetWorth = totalCash + totalInvestmentMyr;
  const netWorthAfterDebt = grossNetWorth - totalDebt;

  // Tasks & Notes
  const pendingTasks = tasks.filter((t: any) => !t.completed);
  const completedTasks = tasks.filter((t: any) => t.completed);
  const highPriorityTasks = pendingTasks.filter((t: any) => t.priority === 'high');

  return {
    grossNetWorth,
    netWorthAfterDebt,
    totalCash,
    totalReserved,
    totalAvailableCash,
    walletSummaries,
    monthlyIncome,
    totalFixedExpenses,
    totalVariableExpenses,
    totalMonthlyLoanPayment,
    totalMonthlyExpenses,
    netMonthlySurplus,
    savingsRatePct,
    expenses,
    categoryTotals,
    loanSummaries,
    totalDebt,
    stockSummaries,
    totalStockValueMyr,
    totalStockPnlMyr,
    investCash: { myr: investCashMyr, usd: investCashUsd, hkd: investCashHkd, exchangeRate, hkdRate },
    totalInvestCashMyr,
    totalInvestmentMyr,
    pendingTasks,
    completedTasks,
    highPriorityTasks,
    notes,
  };
};

/**
 * Builds the complete App Knowledge + Live Data Snapshot for BingGo's System Prompt.
 */
export const buildFullAppContextSnapshot = (lang: 'en' | 'zh' = 'zh'): string => {
  const m = computeAppMetrics();

  return `
=== APPTIFY MODULE & FEATURE MAP (YOU KNOW EVERY FEATURE INSIDE OUT) ===
1. MyWealth (资产中心 - target: "mywealth"):
   - Overview (概览): Net Worth (Cash + Investments), Asset Allocation, Cash Flow summary, AI Financial Insights.
   - Wallets (钱包账户): Multi-account balances, earmarked Reservations (预留冻结资金), Interest rates, Transaction history (IN/OUT/Transfer).
   - Budget (月度预算): Monthly Income setting, 50/30/20 allocation rule, Fixed Bills vs Variable Expenses, Category breakdown (Self Maintenance, Family Expenses, Loan, Saving, Other).
   - Loans (借贷负债): Mortgage/Car/Personal loans tracking, total principal, remaining balance, monthly installment, remaining months, one-click repayment.
   - Investments (投资组合): Multi-currency Stocks (MYR & USD) with live P&L and valuation scenarios, plus Multi-currency Investment Cash Pool (MYR, USD, HKD) and custom FX rates.
2. NoteDown (便签与待办工作台 - target: "knowledgevault"):
   - Quick Notes (灵感便签): Categorized notes (work, idea, meeting, life), Pinning (置顶), keyword search, full markdown/text editing.
   - Action Tasks (待办清单): Todo items with Priority (high, medium, low), Due Dates (YYYY-MM-DD), completion tracking, batch clear completed.
   - Focus Pomodoro (专注计时器): 25-min work / 5-min break timer for deep work sessions.
3. NewsHub (全球科技与财经雷达 - target: "newshub"):
   - Live curated feeds across AI Infra, Chips, Macro Markets, and Fintech with AI summarization.
4. System Settings & Cloud Sync (系统设置 - target: "settings"):
   - Multi-provider AI Model switching (Google Gemini, DeepSeek, OpenAI, Anthropic, OpenRouter, SiliconFlow), Bilingual switch (中文/EN), Google Drive Backup & Sync.

=== LIVE USER DATA SNAPSHOT (REAL-TIME) ===
[WEALTH SUMMARY]
- Gross Net Worth (Cash + Investments): RM ${m.grossNetWorth.toFixed(2)}
- Net Worth After Debt: RM ${m.netWorthAfterDebt.toFixed(2)}
- Total Wallet Cash: RM ${m.totalCash.toFixed(2)} (Reserved: RM ${m.totalReserved.toFixed(2)}, Free Available: RM ${m.totalAvailableCash.toFixed(2)})
- Total Investments: RM ${m.totalInvestmentMyr.toFixed(2)} (Stocks: RM ${m.totalStockValueMyr.toFixed(2)} [Unrealized P&L: RM ${m.totalStockPnlMyr.toFixed(2)}], Invest Cash Pool: RM ${m.totalInvestCashMyr.toFixed(2)})
- Total Loan Debt: RM ${m.totalDebt.toFixed(2)} (Monthly Loan Installments: RM ${m.totalMonthlyLoanPayment.toFixed(2)})

[WALLETS (${m.walletSummaries.length})]
${JSON.stringify(m.walletSummaries.map((w: any) => ({
  name: w.name,
  balance: w.balance,
  available: w.available,
  reserved: w.reserved,
  reservations: w.reservations,
  recentTx: w.recentHistory.slice(0, 3).map((h: any) => `${h.type} RM${h.amount} (${h.description})`),
})))}

[MONTHLY BUDGET & CASHFLOW]
- Monthly Income: RM ${m.monthlyIncome.toFixed(2)}
- Total Monthly Outflow: RM ${m.totalMonthlyExpenses.toFixed(2)} (Fixed: RM ${m.totalFixedExpenses.toFixed(2)}, Variable: RM ${m.totalVariableExpenses.toFixed(2)}, Loans: RM ${m.totalMonthlyLoanPayment.toFixed(2)})
- Monthly Net Surplus: RM ${m.netMonthlySurplus.toFixed(2)} (Savings Rate: ${m.savingsRatePct}%)
- Category Breakdown: ${JSON.stringify(m.categoryTotals)}
- Expense Items (${m.expenses.length}): ${JSON.stringify(m.expenses.map((e: any) => ({ name: e.name, amount: e.amount, category: e.category, isFixed: e.isFixed })))}

[LOANS (${m.loanSummaries.length})]
${JSON.stringify(m.loanSummaries)}

[INVESTMENT PORTFOLIO]
- FX Rates: USD/MYR = ${m.investCash.exchangeRate}, HKD/MYR = ${m.investCash.hkdRate}
- Cash Holdings: MYR ${m.investCash.myr}, USD ${m.investCash.usd}, HKD ${m.investCash.hkd}
- Stocks (${m.stockSummaries.length}): ${JSON.stringify(m.stockSummaries)}

[NOTEDOWN TASKS (Pending: ${m.pendingTasks.length}, Completed: ${m.completedTasks.length})]
- Pending Tasks: ${JSON.stringify(m.pendingTasks.map((t: any) => ({ title: t.title, priority: t.priority, dueDate: t.dueDate || 'none' })))}
- Completed Tasks: ${JSON.stringify(m.completedTasks.slice(0, 8).map((t: any) => t.title))}

[NOTEDOWN NOTES (${m.notes.length})]
${JSON.stringify(m.notes.slice(0, 12).map((n: any) => ({
  title: n.title,
  category: n.category || n.tag || 'work',
  pinned: !!n.pinned,
  contentPreview: String(n.content || '').slice(0, 160),
})))}
`.trim();
};

export const generateDynamicSystemPrompt = (lang: string, currentApp: string): string => {
  const snapshot = buildFullAppContextSnapshot(lang === 'zh' ? 'zh' : 'en');
  const skillsDocumentation = skillRegistry.map(skill => {
    const intentsDoc = Object.entries(skill.intents).map(([intentName, def]) => {
      const paramsDoc = Object.entries(def.parameters).map(([pName, pDef]) =>
        `"${pName}": <${pDef.type}${pDef.required ? ' (required)' : ' (optional)'}> // ${pDef.description}`
      ).join(', ');
      return `  - Intent: "${intentName}"\n    Description: ${def.description}\n    Data Schema: { ${paramsDoc} }`;
    }).join('\n');
    return `### ${skill.name} (${skill.id})\n${intentsDoc}`;
  }).join('\n\n');

  return `You are BingGo, the intelligent Personal Butler (专属全能管家) of Apptify.
Active Screen: ${currentApp}
Preferred Language: ${lang === 'zh' ? 'Simplified Chinese (简体中文)' : 'English'}

${snapshot}

## Available Skills & Intents
${skillsDocumentation}
`;
};

export const executeAction = async (intent: string, data: any): Promise<ExecutionResponse> => {
  const lang = getStoredLanguage();
  const isZh = lang === 'zh';
  const normalizedIntent = (intent || '').toUpperCase().trim();

  // Support multi-step batch actions
  if (normalizedIntent === 'BATCH_ACTIONS' && Array.isArray(data?.actions)) {
    const messages: string[] = [];
    const details: string[] = [];
    let navigateTarget: string | undefined;
    for (const act of data.actions) {
      if (!act?.intent) continue;
      const res = await executeAction(act.intent, act.data || {});
      messages.push(res.message);
      if (res.result?.details) details.push(...res.result.details);
      if (res.navigateTarget) navigateTarget = res.navigateTarget;
    }
    return {
      message: messages.join('\n'),
      navigateTarget,
      result: {
        type: 'system',
        badge: isZh ? '管家批量执行完成' : 'BATCH EXECUTED',
        title: isZh ? `已完成 ${data.actions.length} 项操作` : `Completed ${data.actions.length} Actions`,
        details: details.slice(0, 8),
      },
    };
  }

  switch (normalizedIntent) {
    case 'WITHDRAW_MONEY':
    case 'RECORD_EXPENSE': {
      const mw = loadMyWealthData();
      const amount = Math.abs(Number(data?.amount) || 0);
      if (amount <= 0) {
        return { message: isZh ? '请提供有效的支出金额。' : 'Please specify a valid expense amount.' };
      }
      const desc = data?.description || data?.name || (isZh ? '日常支出' : 'General Expense');
      const category = data?.category || 'Self Maintenance';
      const targetWalletName = (data?.walletName || data?.accountName || '').trim();

      let account = mw.accounts.find((a: any) =>
        targetWalletName && a.name.toLowerCase().includes(targetWalletName.toLowerCase())
      );
      if (!account && mw.accounts.length > 0) account = mw.accounts[0];
      if (!account) {
        account = { id: `acc-${Date.now()}`, name: targetWalletName || 'Cash Wallet', balance: 0, reservations: [], history: [] };
        mw.accounts.push(account);
      }

      const oldBalance = Number(account.balance) || 0;
      account.balance = Math.max(0, oldBalance - amount);
      if (!Array.isArray(account.history)) account.history = [];
      account.history.unshift({
        id: `tx-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'OUT',
        amount,
        description: desc,
      });

      if (!mw.monthlyData) mw.monthlyData = { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) };
      if (!Array.isArray(mw.monthlyData.expenses)) mw.monthlyData.expenses = [];
      mw.monthlyData.expenses.unshift({
        id: `exp-${Date.now()}`,
        name: desc,
        amount,
        category,
        isFixed: false,
      });

      saveMyWealthData(mw);

      return {
        message: isZh
          ? `已从「${account.name}」记录支出 RM ${amount.toFixed(2)}（${desc}），当前余额 RM ${account.balance.toFixed(2)}。`
          : `Recorded RM ${amount.toFixed(2)} expense (${desc}) from "${account.name}". Remaining balance: RM ${account.balance.toFixed(2)}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '支出已入账' : 'EXPENSE LOGGED',
          title: `- RM ${amount.toFixed(2)} · ${desc}`,
          details: [
            isZh ? `扣款钱包: ${account.name}` : `Wallet: ${account.name}`,
            isZh ? `更新后余额: RM ${account.balance.toFixed(2)}` : `Updated Balance: RM ${account.balance.toFixed(2)}`,
            isZh ? `归类: ${category}` : `Category: ${category}`,
          ],
        },
      };
    }

    case 'ADD_MONEY':
    case 'RECORD_INCOME': {
      const mw = loadMyWealthData();
      const amount = Math.abs(Number(data?.amount) || 0);
      if (amount <= 0) {
        return { message: isZh ? '请提供有效的存入金额。' : 'Please specify a valid deposit amount.' };
      }
      const desc = data?.description || (isZh ? '资金存入' : 'Income Deposit');
      const targetWalletName = (data?.walletName || data?.accountName || '').trim();

      let account = mw.accounts.find((a: any) =>
        targetWalletName && a.name.toLowerCase().includes(targetWalletName.toLowerCase())
      );
      if (!account && targetWalletName) {
        account = { id: `acc-${Date.now()}`, name: targetWalletName, balance: 0, reservations: [], history: [] };
        mw.accounts.push(account);
      } else if (!account && mw.accounts.length > 0) {
        account = mw.accounts[0];
      } else if (!account) {
        account = { id: `acc-${Date.now()}`, name: 'Main Wallet', balance: 0, reservations: [], history: [] };
        mw.accounts.push(account);
      }

      const oldBalance = Number(account.balance) || 0;
      account.balance = oldBalance + amount;
      if (!Array.isArray(account.history)) account.history = [];
      account.history.unshift({
        id: `tx-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'IN',
        amount,
        description: desc,
      });

      saveMyWealthData(mw);

      return {
        message: isZh
          ? `已向「${account.name}」存入 RM ${amount.toFixed(2)}（${desc}），最新余额 RM ${account.balance.toFixed(2)}。`
          : `Deposited RM ${amount.toFixed(2)} (${desc}) into "${account.name}". New balance: RM ${account.balance.toFixed(2)}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '收入已入账' : 'INCOME LOGGED',
          title: `+ RM ${amount.toFixed(2)} · ${desc}`,
          details: [
            isZh ? `目标钱包: ${account.name}` : `Target Wallet: ${account.name}`,
            isZh ? `更新前余额: RM ${oldBalance.toFixed(2)}` : `Previous Balance: RM ${oldBalance.toFixed(2)}`,
            isZh ? `最新余额: RM ${account.balance.toFixed(2)}` : `New Balance: RM ${account.balance.toFixed(2)}`,
          ],
        },
      };
    }

    case 'TRANSFER_MONEY': {
      const mw = loadMyWealthData();
      const amount = Math.abs(Number(data?.amount) || 0);
      const srcName = (data?.sourceWallet || data?.fromWallet || '').trim();
      const dstName = (data?.destinationWallet || data?.toWallet || '').trim();
      const desc = data?.description || (isZh ? '钱包间转账' : 'Wallet Transfer');

      if (amount <= 0 || !srcName || !dstName) {
        return { message: isZh ? '请提供转出钱包、转入钱包和有效转账金额。' : 'Please provide source wallet, destination wallet, and a valid amount.' };
      }

      const srcAcc = mw.accounts.find((a: any) => a.name.toLowerCase().includes(srcName.toLowerCase()));
      let dstAcc = mw.accounts.find((a: any) => a.name.toLowerCase().includes(dstName.toLowerCase()));

      if (!srcAcc) {
        return { message: isZh ? `未找到转出钱包 "${srcName}"。` : `Source wallet "${srcName}" not found.` };
      }
      if (!dstAcc) {
        dstAcc = { id: `acc-${Date.now()}`, name: dstName, balance: 0, reservations: [], history: [] };
        mw.accounts.push(dstAcc);
      }

      srcAcc.balance = Math.max(0, (Number(srcAcc.balance) || 0) - amount);
      dstAcc.balance = (Number(dstAcc.balance) || 0) + amount;

      const nowIso = new Date().toISOString();
      if (!Array.isArray(srcAcc.history)) srcAcc.history = [];
      if (!Array.isArray(dstAcc.history)) dstAcc.history = [];

      srcAcc.history.unshift({
        id: `tx-${Date.now()}-out`,
        date: nowIso,
        type: 'OUT',
        amount,
        description: `${desc} -> ${dstAcc.name}`,
      });
      dstAcc.history.unshift({
        id: `tx-${Date.now()}-in`,
        date: nowIso,
        type: 'IN',
        amount,
        description: `${desc} <- ${srcAcc.name}`,
      });

      saveMyWealthData(mw);

      return {
        message: isZh
          ? `已从「${srcAcc.name}」转账 RM ${amount.toFixed(2)} 到「${dstAcc.name}」。`
          : `Transferred RM ${amount.toFixed(2)} from "${srcAcc.name}" to "${dstAcc.name}".`,
        result: {
          type: 'wealth',
          badge: isZh ? '转账成功' : 'TRANSFER COMPLETE',
          title: `RM ${amount.toFixed(2)} · ${srcAcc.name} → ${dstAcc.name}`,
          details: [
            `${srcAcc.name}: RM ${srcAcc.balance.toFixed(2)}`,
            `${dstAcc.name}: RM ${dstAcc.balance.toFixed(2)}`,
          ],
        },
      };
    }

    case 'CREATE_WALLET': {
      const mw = loadMyWealthData();
      const name = (data?.name || data?.walletName || '').trim();
      const balance = Math.max(0, Number(data?.balance) || 0);
      const interestRate = Number(data?.interestRate) || 0;
      if (!name) {
        return { message: isZh ? '请提供新钱包的名称。' : 'Please provide a name for the new wallet.' };
      }
      const existing = mw.accounts.find((a: any) => a.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.balance = balance;
        if (interestRate > 0) existing.interestRate = interestRate;
        saveMyWealthData(mw);
        return {
          message: isZh ? `钱包「${existing.name}」已存在，已将余额更新为 RM ${balance.toFixed(2)}。` : `Wallet "${existing.name}" already exists; updated balance to RM ${balance.toFixed(2)}.`,
          result: {
            type: 'wealth',
            badge: isZh ? '钱包已更新' : 'WALLET UPDATED',
            title: existing.name,
            details: [`Balance: RM ${balance.toFixed(2)}`],
          },
        };
      }
      const newAcc: any = {
        id: `acc-${Date.now()}`,
        name,
        balance,
        reservations: [],
        history: balance > 0 ? [{ id: `tx-${Date.now()}`, date: new Date().toISOString(), type: 'IN', amount: balance, description: isZh ? '初始余额' : 'Initial Balance' }] : [],
      };
      if (interestRate > 0) {
        newAcc.interestRate = interestRate;
        newAcc.interestFrequency = 'MONTHLY';
      }
      mw.accounts.push(newAcc);
      saveMyWealthData(mw);
      return {
        message: isZh ? `已为你创建新钱包「${name}」，初始余额 RM ${balance.toFixed(2)}。` : `Created new wallet "${name}" with initial balance RM ${balance.toFixed(2)}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '新钱包已创建' : 'WALLET CREATED',
          title: `${name} · RM ${balance.toFixed(2)}`,
          details: [
            interestRate > 0 ? (isZh ? `年化利率: ${interestRate}%` : `Interest Rate: ${interestRate}%`) : (isZh ? '状态: 已激活' : 'Status: Active'),
          ],
        },
      };
    }

    case 'UPDATE_WALLET': {
      const mw = loadMyWealthData();
      const targetName = (data?.walletName || data?.name || '').trim();
      const acc = mw.accounts.find((a: any) => a.name.toLowerCase().includes(targetName.toLowerCase()));
      if (!acc) {
        return { message: isZh ? `未找到名为「${targetName}」的钱包。` : `Wallet "${targetName}" not found.` };
      }
      if (data?.newBalance !== undefined && !Number.isNaN(Number(data.newBalance))) {
        acc.balance = Number(data.newBalance);
      } else if (data?.balance !== undefined && !Number.isNaN(Number(data.balance))) {
        acc.balance = Number(data.balance);
      }
      if (data?.newName) acc.name = String(data.newName).trim();
      if (data?.interestRate !== undefined) acc.interestRate = Number(data.interestRate);
      saveMyWealthData(mw);
      return {
        message: isZh ? `已更新钱包「${acc.name}」，当前余额为 RM ${Number(acc.balance).toFixed(2)}。` : `Updated wallet "${acc.name}". Balance is now RM ${Number(acc.balance).toFixed(2)}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '钱包已修改' : 'WALLET UPDATED',
          title: `${acc.name} · RM ${Number(acc.balance).toFixed(2)}`,
          details: [
            acc.interestRate ? (isZh ? `年利率: ${acc.interestRate}%` : `Interest Rate: ${acc.interestRate}%`) : (isZh ? '余额已同步' : 'Balance synced'),
          ],
        },
      };
    }

    case 'DELETE_WALLET': {
      const mw = loadMyWealthData();
      const targetName = (data?.walletName || data?.name || '').trim();
      const idx = mw.accounts.findIndex((a: any) => a.name.toLowerCase().includes(targetName.toLowerCase()));
      if (idx === -1) {
        return { message: isZh ? `未找到名为「${targetName}」的钱包。` : `Wallet "${targetName}" not found.` };
      }
      const [removed] = mw.accounts.splice(idx, 1);
      saveMyWealthData(mw);
      return {
        message: isZh ? `已删除钱包「${removed.name}」。` : `Deleted wallet "${removed.name}".`,
        result: {
          type: 'wealth',
          badge: isZh ? '钱包已删除' : 'WALLET DELETED',
          title: removed.name,
          details: [isZh ? `原余额: RM ${Number(removed.balance || 0).toFixed(2)}` : `Previous Balance: RM ${Number(removed.balance || 0).toFixed(2)}`],
        },
      };
    }

    case 'ADD_RESERVATION': {
      const mw = loadMyWealthData();
      const targetName = (data?.walletName || '').trim();
      const amount = Math.abs(Number(data?.amount) || 0);
      const reason = (data?.reason || data?.name || (isZh ? '专项预留' : 'Reserved Fund')).trim();
      let acc = mw.accounts.find((a: any) => targetName && a.name.toLowerCase().includes(targetName.toLowerCase()));
      if (!acc && mw.accounts.length > 0) acc = mw.accounts[0];
      if (!acc || amount <= 0) {
        return { message: isZh ? '请指定有效的钱包和预留金额。' : 'Please provide a valid wallet and reservation amount.' };
      }
      if (!Array.isArray(acc.reservations)) acc.reservations = [];
      acc.reservations.push({
        id: `res-${Date.now()}`,
        amount,
        reason,
        createdAt: new Date().toISOString(),
      });
      saveMyWealthData(mw);
      const totalRes = acc.reservations.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
      return {
        message: isZh
          ? `已在「${acc.name}」中为「${reason}」预留冻结 RM ${amount.toFixed(2)}，该钱包可用余额为 RM ${Math.max(0, acc.balance - totalRes).toFixed(2)}。`
          : `Reserved RM ${amount.toFixed(2)} for "${reason}" in "${acc.name}". Free available balance: RM ${Math.max(0, acc.balance - totalRes).toFixed(2)}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '预留金已锁定' : 'RESERVATION ADDED',
          title: `${reason} · RM ${amount.toFixed(2)}`,
          details: [
            isZh ? `所属钱包: ${acc.name}` : `Wallet: ${acc.name}`,
            isZh ? `总预留金: RM ${totalRes.toFixed(2)}` : `Total Reserved: RM ${totalRes.toFixed(2)}`,
          ],
        },
      };
    }

    case 'REMOVE_RESERVATION': {
      const mw = loadMyWealthData();
      const reason = (data?.reason || data?.name || '').trim().toLowerCase();
      let removedItem: any = null;
      let walletHit = '';
      for (const acc of mw.accounts) {
        if (!Array.isArray(acc.reservations)) continue;
        const idx = acc.reservations.findIndex((r: any) => String(r.reason || '').toLowerCase().includes(reason));
        if (idx !== -1) {
          [removedItem] = acc.reservations.splice(idx, 1);
          walletHit = acc.name;
          break;
        }
      }
      if (!removedItem) {
        return { message: isZh ? `未找到名为「${data?.reason || ''}」的预留金项目。` : `Reservation "${data?.reason || ''}" not found.` };
      }
      saveMyWealthData(mw);
      return {
        message: isZh ? `已从「${walletHit}」释放预留金「${removedItem.reason}」（RM ${Number(removedItem.amount).toFixed(2)}）。` : `Released reservation "${removedItem.reason}" (RM ${Number(removedItem.amount).toFixed(2)}) from "${walletHit}".`,
        result: {
          type: 'wealth',
          badge: isZh ? '预留金已释放' : 'RESERVATION RELEASED',
          title: removedItem.reason,
          details: [`+ RM ${Number(removedItem.amount).toFixed(2)} unlocked in ${walletHit}`],
        },
      };
    }

    case 'SET_MONTHLY_INCOME': {
      const mw = loadMyWealthData();
      const amount = Math.max(0, Number(data?.amount ?? data?.income) || 0);
      if (!mw.monthlyData) mw.monthlyData = { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) };
      mw.monthlyData.income = amount;
      saveMyWealthData(mw);
      return {
        message: isZh ? `已将你的月度总收入设为 RM ${amount.toFixed(2)}。` : `Updated your monthly income to RM ${amount.toFixed(2)}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '月收入已更新' : 'MONTHLY INCOME SET',
          title: `RM ${amount.toFixed(2)} / month`,
          details: [
            isZh ? `50% 必要开支建议上限: RM ${(amount * 0.5).toFixed(2)}` : `50% Needs Target: RM ${(amount * 0.5).toFixed(2)}`,
            isZh ? `20% 储蓄目标: RM ${(amount * 0.2).toFixed(2)}` : `20% Savings Target: RM ${(amount * 0.2).toFixed(2)}`,
          ],
        },
      };
    }

    case 'ADD_BUDGET': {
      const mw = loadMyWealthData();
      const name = data?.name || (isZh ? '预算支出项' : 'Budget Expense');
      const amount = Math.abs(Number(data?.amount) || 0);
      const category = data?.category || 'Self Maintenance';
      const isFixed = data?.isFixed !== undefined ? Boolean(data.isFixed) : true;

      if (!mw.monthlyData) mw.monthlyData = { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) };
      if (!Array.isArray(mw.monthlyData.expenses)) mw.monthlyData.expenses = [];
      mw.monthlyData.expenses.push({
        id: `exp-${Date.now()}`,
        name,
        amount,
        category,
        isFixed,
      });
      saveMyWealthData(mw);

      return {
        message: isZh
          ? `已添加月度预算项「${name}」（RM ${amount.toFixed(2)}，分类：${category}）。`
          : `Added monthly budget "${name}" of RM ${amount.toFixed(2)} under ${category}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '预算已添加' : 'BUDGET ADDED',
          title: `${name} · RM ${amount.toFixed(2)}`,
          details: [
            isZh ? `分类: ${category}` : `Category: ${category}`,
            isZh ? `性质: ${isFixed ? '固定月支出' : '日常变动支出'}` : `Type: ${isFixed ? 'Fixed Monthly' : 'Variable'}`,
          ],
        },
      };
    }

    case 'UPDATE_BUDGET': {
      const mw = loadMyWealthData();
      const targetName = (data?.name || '').trim().toLowerCase();
      const expenses = mw.monthlyData?.expenses || [];
      const item = expenses.find((e: any) => String(e.name || '').toLowerCase().includes(targetName));
      if (!item) {
        return { message: isZh ? `未在月度预算中找到「${data?.name || ''}」。` : `Budget item "${data?.name || ''}" not found.` };
      }
      if (data?.amount !== undefined) item.amount = Math.abs(Number(data.amount));
      if (data?.category) item.category = data.category;
      if (data?.isFixed !== undefined) item.isFixed = Boolean(data.isFixed);
      saveMyWealthData(mw);
      return {
        message: isZh ? `已将预算项「${item.name}」更新为 RM ${Number(item.amount).toFixed(2)}。` : `Updated budget item "${item.name}" to RM ${Number(item.amount).toFixed(2)}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '预算已修改' : 'BUDGET UPDATED',
          title: `${item.name} · RM ${Number(item.amount).toFixed(2)}`,
          details: [isZh ? `分类: ${item.category}` : `Category: ${item.category}`],
        },
      };
    }

    case 'DELETE_BUDGET': {
      const mw = loadMyWealthData();
      const targetName = (data?.name || '').trim().toLowerCase();
      const expenses = mw.monthlyData?.expenses || [];
      const idx = expenses.findIndex((e: any) => String(e.name || '').toLowerCase().includes(targetName));
      if (idx === -1) {
        return { message: isZh ? `未在月度预算中找到「${data?.name || ''}」。` : `Budget item "${data?.name || ''}" not found.` };
      }
      const [removed] = expenses.splice(idx, 1);
      saveMyWealthData(mw);
      return {
        message: isZh ? `已从月度预算中删除「${removed.name}」（RM ${Number(removed.amount).toFixed(2)}）。` : `Removed "${removed.name}" (RM ${Number(removed.amount).toFixed(2)}) from monthly budget.`,
        result: {
          type: 'wealth',
          badge: isZh ? '预算已移除' : 'BUDGET DELETED',
          title: removed.name,
          details: [`- RM ${Number(removed.amount).toFixed(2)}`],
        },
      };
    }

    case 'ADD_LOAN': {
      const mw = loadMyWealthData();
      const name = data?.name || (isZh ? '新贷款' : 'New Loan');
      const totalAmount = Math.abs(Number(data?.totalAmount) || 0);
      const remainingAmount = data?.remainingAmount !== undefined ? Math.abs(Number(data.remainingAmount)) : totalAmount;
      const monthlyPayment = Math.abs(Number(data?.monthlyPayment) || 0);
      const remainingMonths = Number(data?.months ?? data?.remainingMonths) || (monthlyPayment > 0 ? Math.ceil(remainingAmount / monthlyPayment) : 12);

      if (!Array.isArray(mw.loans)) mw.loans = [];
      mw.loans.push({
        id: `loan-${Date.now()}`,
        name,
        totalAmount,
        monthlyPayment,
        remainingAmount,
        remainingMonths,
      });
      saveMyWealthData(mw);

      return {
        message: isZh
          ? `已添加贷款「${name}」，总额 RM ${totalAmount.toFixed(2)}，月供 RM ${monthlyPayment.toFixed(2)}，剩余 ${remainingMonths} 期。`
          : `Added loan "${name}" (Total: RM ${totalAmount.toFixed(2)}, Monthly: RM ${monthlyPayment.toFixed(2)}, ${remainingMonths} months left).`,
        result: {
          type: 'wealth',
          badge: isZh ? '负债已记录' : 'LOAN TRACKED',
          title: `${name} · RM ${remainingAmount.toFixed(2)}`,
          details: [
            isZh ? `月供: RM ${monthlyPayment.toFixed(2)}` : `Monthly Installment: RM ${monthlyPayment.toFixed(2)}`,
            isZh ? `剩余期数: ${remainingMonths} 个月` : `Remaining Months: ${remainingMonths}`,
          ],
        },
      };
    }

    case 'REPAY_LOAN': {
      const mw = loadMyWealthData();
      const loanName = (data?.loanName || data?.name || '').trim();
      const loan = (mw.loans || []).find((l: any) => l.name.toLowerCase().includes(loanName.toLowerCase())) || mw.loans?.[0];
      if (!loan) {
        return { message: isZh ? `未找到匹配的贷款记录 "${loanName}"。` : `No matching loan "${loanName}" found.` };
      }

      const payAmount = Math.abs(Number(data?.amount) || Number(loan.monthlyPayment) || 0);
      loan.remainingAmount = Math.max(0, (Number(loan.remainingAmount) || 0) - payAmount);
      if (loan.remainingMonths > 0) loan.remainingMonths = Math.max(0, loan.remainingMonths - 1);

      const walletName = (data?.walletName || data?.accountName || '').trim();
      let deductedWallet = '';
      if (walletName) {
        const acc = mw.accounts.find((a: any) => a.name.toLowerCase().includes(walletName.toLowerCase()));
        if (acc) {
          acc.balance = Math.max(0, (Number(acc.balance) || 0) - payAmount);
          if (!Array.isArray(acc.history)) acc.history = [];
          acc.history.unshift({
            id: `tx-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'OUT',
            amount: payAmount,
            description: `Loan Repayment: ${loan.name}`,
          });
          deductedWallet = acc.name;
        }
      }

      saveMyWealthData(mw);

      return {
        message: isZh
          ? `已向「${loan.name}」还款 RM ${payAmount.toFixed(2)}${deductedWallet ? `（自 ${deductedWallet} 扣款）` : ''}，剩余本金 RM ${loan.remainingAmount.toFixed(2)}。`
          : `Repaid RM ${payAmount.toFixed(2)} towards "${loan.name}"${deductedWallet ? ` from ${deductedWallet}` : ''}. Remaining: RM ${loan.remainingAmount.toFixed(2)}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '还款已登记' : 'LOAN REPAID',
          title: `${loan.name} · -RM ${payAmount.toFixed(2)}`,
          details: [
            isZh ? `剩余待还: RM ${loan.remainingAmount.toFixed(2)}` : `Remaining Principal: RM ${loan.remainingAmount.toFixed(2)}`,
            isZh ? `剩余期数: ${loan.remainingMonths} 个月` : `Months Left: ${loan.remainingMonths}`,
          ],
        },
      };
    }

    case 'UPDATE_LOAN': {
      const mw = loadMyWealthData();
      const loanName = (data?.loanName || data?.name || '').trim().toLowerCase();
      const loan = (mw.loans || []).find((l: any) => l.name.toLowerCase().includes(loanName));
      if (!loan) {
        return { message: isZh ? `未找到贷款「${data?.loanName || ''}」。` : `Loan "${data?.loanName || ''}" not found.` };
      }
      if (data?.remainingAmount !== undefined) loan.remainingAmount = Math.max(0, Number(data.remainingAmount));
      if (data?.totalAmount !== undefined) loan.totalAmount = Math.max(0, Number(data.totalAmount));
      if (data?.monthlyPayment !== undefined) loan.monthlyPayment = Math.max(0, Number(data.monthlyPayment));
      if (data?.remainingMonths !== undefined) loan.remainingMonths = Math.max(0, Number(data.remainingMonths));
      saveMyWealthData(mw);
      return {
        message: isZh ? `已更新贷款「${loan.name}」，剩余本金 RM ${Number(loan.remainingAmount).toFixed(2)}，月供 RM ${Number(loan.monthlyPayment).toFixed(2)}。` : `Updated loan "${loan.name}": remaining RM ${Number(loan.remainingAmount).toFixed(2)}, monthly RM ${Number(loan.monthlyPayment).toFixed(2)}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '贷款已更新' : 'LOAN UPDATED',
          title: loan.name,
          details: [
            `Remaining: RM ${Number(loan.remainingAmount).toFixed(2)}`,
            `Monthly: RM ${Number(loan.monthlyPayment).toFixed(2)} (${loan.remainingMonths} mos)`,
          ],
        },
      };
    }

    case 'DELETE_LOAN': {
      const mw = loadMyWealthData();
      const loanName = (data?.loanName || data?.name || '').trim().toLowerCase();
      const idx = (mw.loans || []).findIndex((l: any) => l.name.toLowerCase().includes(loanName));
      if (idx === -1) {
        return { message: isZh ? `未找到贷款「${data?.loanName || ''}」。` : `Loan "${data?.loanName || ''}" not found.` };
      }
      const [removed] = mw.loans.splice(idx, 1);
      saveMyWealthData(mw);
      return {
        message: isZh ? `已删除贷款项目「${removed.name}」。` : `Deleted loan "${removed.name}".`,
        result: {
          type: 'wealth',
          badge: isZh ? '贷款已移除' : 'LOAN DELETED',
          title: removed.name,
          details: [isZh ? '已从负债列表移除' : 'Removed from liabilities'],
        },
      };
    }

    case 'ADD_STOCK': {
      const mw = loadMyWealthData();
      const symbol = String(data?.symbol || data?.name || '').trim().toUpperCase();
      const name = String(data?.name || symbol).trim();
      const quantity = Math.abs(Number(data?.quantity ?? data?.shares) || 0);
      const buyPrice = Math.abs(Number(data?.buyPrice ?? data?.price) || 0);
      const currentPrice = data?.currentPrice !== undefined ? Math.abs(Number(data.currentPrice)) : buyPrice;
      const currency = String(data?.currency || (symbol.endsWith('.KL') ? 'MYR' : 'USD')).toUpperCase() === 'MYR' ? 'MYR' : 'USD';

      if (!symbol || quantity <= 0) {
        return { message: isZh ? '请提供股票代码（Symbol）和持仓股数。' : 'Please provide a stock ticker symbol and share quantity.' };
      }

      if (!Array.isArray(mw.stocks)) mw.stocks = [];
      const existing = mw.stocks.find((s: any) => String(s.symbol).toUpperCase() === symbol);
      if (existing) {
        const oldQty = Number(existing.quantity ?? existing.shares ?? 0);
        const oldBuy = Number(existing.buyPrice || 0);
        const totalQty = oldQty + quantity;
        existing.buyPrice = totalQty > 0 ? Number(((oldQty * oldBuy + quantity * buyPrice) / totalQty).toFixed(4)) : buyPrice;
        existing.quantity = totalQty;
        existing.currentPrice = currentPrice || existing.currentPrice;
        existing.currency = currency;
      } else {
        mw.stocks.push({
          id: `stk-${Date.now()}`,
          symbol,
          name,
          quantity,
          buyPrice,
          currentPrice,
          currency,
        });
      }
      saveMyWealthData(mw);
      return {
        message: isZh
          ? `已将股票「${symbol}」（${quantity} 股 @ ${currency} ${buyPrice}）加入你的投资组合。`
          : `Added ${quantity} shares of ${symbol} at ${currency} ${buyPrice} to your portfolio.`,
        result: {
          type: 'wealth',
          badge: isZh ? '持仓已记录' : 'STOCK ADDED',
          title: `${symbol} · ${quantity} shares`,
          details: [
            isZh ? `买入均价: ${currency} ${buyPrice}` : `Buy Price: ${currency} ${buyPrice}`,
            isZh ? `现价: ${currency} ${currentPrice}` : `Current Price: ${currency} ${currentPrice}`,
          ],
        },
      };
    }

    case 'UPDATE_STOCK': {
      const mw = loadMyWealthData();
      const target = String(data?.symbol || data?.name || '').trim().toLowerCase();
      const stock = (mw.stocks || []).find((s: any) =>
        String(s.symbol || '').toLowerCase().includes(target) || String(s.name || '').toLowerCase().includes(target)
      );
      if (!stock) {
        return { message: isZh ? `未在持仓中找到股票「${data?.symbol || ''}」。` : `Stock "${data?.symbol || ''}" not found in portfolio.` };
      }
      if (data?.quantity !== undefined) stock.quantity = Math.max(0, Number(data.quantity));
      if (data?.buyPrice !== undefined) stock.buyPrice = Math.max(0, Number(data.buyPrice));
      if (data?.currentPrice !== undefined) stock.currentPrice = Math.max(0, Number(data.currentPrice));
      if (data?.currency) stock.currency = String(data.currency).toUpperCase() === 'MYR' ? 'MYR' : 'USD';
      saveMyWealthData(mw);
      return {
        message: isZh
          ? `已更新股票「${stock.symbol}」：持仓 ${stock.quantity} 股，成本 ${stock.currency} ${stock.buyPrice}，现价 ${stock.currency} ${stock.currentPrice}。`
          : `Updated ${stock.symbol}: ${stock.quantity} shares, buy ${stock.currency} ${stock.buyPrice}, current ${stock.currency} ${stock.currentPrice}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '持仓已更新' : 'STOCK UPDATED',
          title: `${stock.symbol} · ${stock.quantity} shares`,
          details: [
            `Buy: ${stock.currency} ${stock.buyPrice} | Now: ${stock.currency} ${stock.currentPrice}`,
          ],
        },
      };
    }

    case 'DELETE_STOCK': {
      const mw = loadMyWealthData();
      const target = String(data?.symbol || data?.name || '').trim().toLowerCase();
      const idx = (mw.stocks || []).findIndex((s: any) =>
        String(s.symbol || '').toLowerCase().includes(target) || String(s.name || '').toLowerCase().includes(target)
      );
      if (idx === -1) {
        return { message: isZh ? `未在持仓中找到股票「${data?.symbol || ''}」。` : `Stock "${data?.symbol || ''}" not found.` };
      }
      const [removed] = mw.stocks.splice(idx, 1);
      saveMyWealthData(mw);
      return {
        message: isZh ? `已从投资组合中移除股票「${removed.symbol}」。` : `Removed ${removed.symbol} from your investment portfolio.`,
        result: {
          type: 'wealth',
          badge: isZh ? '持仓已移除' : 'STOCK REMOVED',
          title: removed.symbol,
          details: [isZh ? `原股数: ${removed.quantity}` : `Previous Shares: ${removed.quantity}`],
        },
      };
    }

    case 'UPDATE_INVEST_CASH': {
      const mw = loadMyWealthData();
      if (!mw.cash) mw.cash = { myr: 0, usd: 0, hkd: 0, hkdRate: 0.58 };
      if (data?.myr !== undefined) mw.cash.myr = Math.max(0, Number(data.myr));
      if (data?.usd !== undefined) mw.cash.usd = Math.max(0, Number(data.usd));
      if (data?.hkd !== undefined) mw.cash.hkd = Math.max(0, Number(data.hkd));
      if (data?.exchangeRate !== undefined && Number(data.exchangeRate) > 0) {
        mw.exchangeRate = Number(data.exchangeRate);
      }
      saveMyWealthData(mw);
      return {
        message: isZh
          ? `已更新投资现金池：MYR ${mw.cash.myr}，USD ${mw.cash.usd}，HKD ${mw.cash.hkd}（USD/MYR 汇率：${mw.exchangeRate}）。`
          : `Updated investment cash pool: MYR ${mw.cash.myr}, USD ${mw.cash.usd}, HKD ${mw.cash.hkd} (USD/MYR rate: ${mw.exchangeRate}).`,
        result: {
          type: 'wealth',
          badge: isZh ? '投资现金已更新' : 'INVEST CASH UPDATED',
          title: `MYR ${mw.cash.myr} · USD ${mw.cash.usd} · HKD ${mw.cash.hkd}`,
          details: [`USD/MYR Rate: ${mw.exchangeRate}`],
        },
      };
    }

    case 'CREATE_NOTE': {
      const notes = loadNotes();
      const title = (data?.title || (isZh ? '随手记' : 'Quick Note')).trim();
      const content = (data?.content || title).trim();
      const category = ['work', 'idea', 'meeting', 'life'].includes(data?.category) ? data.category : 'work';
      const pinned = Boolean(data?.pinned);

      const newNote = {
        id: `note-${Date.now()}`,
        title,
        content,
        category,
        pinned,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      notes.unshift(newNote);
      saveNotes(notes);

      return {
        message: isZh ? `已在 NoteDown 保存笔记《${title}》${pinned ? '（已置顶）' : ''}。` : `Saved note "${title}" in NoteDown${pinned ? ' (pinned)' : ''}.`,
        result: {
          type: 'vault',
          badge: isZh ? '笔记已保存' : 'NOTE CREATED',
          title,
          details: [
            isZh ? `分类: ${category}${pinned ? ' · 已置顶' : ''}` : `Category: ${category}${pinned ? ' · Pinned' : ''}`,
            content.length > 70 ? content.slice(0, 70) + '...' : content,
          ],
        },
      };
    }

    case 'PIN_NOTE': {
      const notes = loadNotes();
      const targetTitle = (data?.title || '').trim().toLowerCase();
      const note = notes.find((n: any) => String(n.title || '').toLowerCase().includes(targetTitle)) || notes[0];
      if (!note) {
        return { message: isZh ? `未找到笔记《${data?.title || ''}》。` : `Note "${data?.title || ''}" not found.` };
      }
      note.pinned = data?.pinned !== undefined ? Boolean(data.pinned) : !note.pinned;
      note.updatedAt = new Date().toISOString();
      saveNotes(notes);
      return {
        message: isZh
          ? `已${note.pinned ? '置顶' : '取消置顶'}笔记《${note.title}》。`
          : `${note.pinned ? 'Pinned' : 'Unpinned'} note "${note.title}".`,
        result: {
          type: 'vault',
          badge: note.pinned ? (isZh ? '已置顶' : 'NOTE PINNED') : (isZh ? '已取消置顶' : 'NOTE UNPINNED'),
          title: note.title,
          details: [note.content?.slice(0, 60) || ''],
        },
      };
    }

    case 'SEARCH_NOTES': {
      const notes = loadNotes();
      const q = (data?.query || '').trim().toLowerCase();
      const matched = notes.filter((n: any) =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q) ||
        (n.category || '').toLowerCase().includes(q)
      );
      return {
        message: isZh
          ? `在 NoteDown 中找到 ${matched.length} 篇与 "${data?.query || ''}" 相关的笔记。`
          : `Found ${matched.length} note(s) matching "${data?.query || ''}" in NoteDown.`,
        result: {
          type: 'vault',
          badge: isZh ? '笔记检索结果' : 'NOTE SEARCH',
          title: isZh ? `匹配笔记 (${matched.length})` : `Matched Notes (${matched.length})`,
          details: matched.length > 0
            ? matched.slice(0, 5).map((n: any) => `• ${n.title}: ${(n.content || '').slice(0, 50)}`)
            : [isZh ? '没有找到匹配的笔记' : 'No matching notes found'],
        },
      };
    }

    case 'QUERY_NOTES': {
      const notes = loadNotes();
      return {
        message: isZh
          ? `你目前在 NoteDown 共有 ${notes.length} 篇笔记。`
          : `You currently have ${notes.length} note(s) in NoteDown.`,
        result: {
          type: 'vault',
          badge: isZh ? '笔记列表' : 'NOTES SUMMARY',
          title: isZh ? `共 ${notes.length} 篇笔记` : `Total ${notes.length} Notes`,
          details: notes.length > 0
            ? notes.slice(0, 6).map((n: any) => `• [${n.category || 'note'}]${n.pinned ? ' 📌' : ''} ${n.title}`)
            : [isZh ? '暂无笔记' : 'No notes yet'],
        },
      };
    }

    case 'UPDATE_NOTE': {
      const notes = loadNotes();
      const targetTitle = (data?.title || '').trim();
      const note = notes.find((n: any) => (n.title || '').toLowerCase().includes(targetTitle.toLowerCase())) || notes[0];
      if (!note) {
        return { message: isZh ? `未找到标题包含 "${targetTitle}" 的笔记。` : `Could not find a note matching "${targetTitle}".` };
      }
      if (data?.newTitle) note.title = data.newTitle;
      if (data?.content) {
        note.content = data?.append ? `${note.content}\n${data.content}` : data.content;
      }
      if (data?.category) note.category = data.category;
      if (data?.pinned !== undefined) note.pinned = Boolean(data.pinned);
      note.updatedAt = new Date().toISOString();
      saveNotes(notes);
      return {
        message: isZh ? `已更新笔记《${note.title}》。` : `Updated note "${note.title}".`,
        result: {
          type: 'vault',
          badge: isZh ? '笔记已更新' : 'NOTE UPDATED',
          title: note.title,
          details: [(note.content || '').slice(0, 80)],
        },
      };
    }

    case 'DELETE_NOTE': {
      const notes = loadNotes();
      const targetTitle = (data?.title || '').trim();
      const idx = notes.findIndex((n: any) => (n.title || '').toLowerCase().includes(targetTitle.toLowerCase()));
      if (idx === -1) {
        return { message: isZh ? `未找到要删除的笔记 "${targetTitle}"。` : `Could not find note "${targetTitle}" to delete.` };
      }
      const [removed] = notes.splice(idx, 1);
      saveNotes(notes);
      return {
        message: isZh ? `已删除笔记《${removed.title}》。` : `Deleted note "${removed.title}".`,
        result: {
          type: 'vault',
          badge: isZh ? '笔记已删除' : 'NOTE DELETED',
          title: removed.title,
          details: [isZh ? '已从 NoteDown 移除' : 'Removed from NoteDown'],
        },
      };
    }

    case 'CREATE_TASK':
    case 'CREATE_TODO': {
      const tasks = loadTasks();
      const title = (data?.title || (isZh ? '新待办任务' : 'New Task')).trim();
      const priority = ['high', 'medium', 'low'].includes(data?.priority) ? data.priority : 'medium';
      const dueDate = data?.deadline || data?.dueDate || new Date().toISOString().slice(0, 10);
      const category = data?.category === 'personal' ? 'personal' : 'work';

      const newTask = {
        id: `task-${Date.now()}`,
        title,
        completed: false,
        priority,
        dueDate,
        category,
        createdAt: new Date().toISOString(),
      };
      tasks.unshift(newTask);
      saveTasks(tasks);

      return {
        message: isZh ? `已添加待办任务：「${title}」（优先级：${priority}，截止：${dueDate}）。` : `Created task: "${title}" (${priority} priority, due ${dueDate}).`,
        result: {
          type: 'task',
          badge: isZh ? '待办已创建' : 'TASK CREATED',
          title,
          details: [
            isZh ? `优先级: ${priority.toUpperCase()}` : `Priority: ${priority.toUpperCase()}`,
            isZh ? `截止日期: ${dueDate}` : `Due Date: ${dueDate}`,
          ],
        },
      };
    }

    case 'UPDATE_TASK':
    case 'COMPLETE_TASK': {
      const tasks = loadTasks();
      const targetTitle = (data?.taskTitle || data?.title || '').trim();
      const completed = data?.completed !== undefined ? Boolean(data.completed) : true;
      const task = tasks.find((t: any) => (t.title || '').toLowerCase().includes(targetTitle.toLowerCase())) || tasks.find((t: any) => !t.completed);

      if (!task) {
        return { message: isZh ? `未找到匹配的待办事项 "${targetTitle}"。` : `Could not find a matching task "${targetTitle}".` };
      }

      if (data?.completed !== undefined || normalizedIntent === 'COMPLETE_TASK') {
        task.completed = completed;
      }
      if (data?.priority && ['high', 'medium', 'low'].includes(data.priority)) {
        task.priority = data.priority;
      }
      if (data?.deadline || data?.dueDate) {
        task.dueDate = data.deadline || data.dueDate;
      }
      if (data?.newTitle) {
        task.title = String(data.newTitle).trim();
      }
      saveTasks(tasks);

      return {
        message: isZh
          ? `已更新任务「${task.title}」（状态：${task.completed ? '已完成' : '待处理'}，优先级：${task.priority}）。`
          : `Updated task "${task.title}" (${task.completed ? 'Completed' : 'Pending'}, ${task.priority} priority).`,
        result: {
          type: 'task',
          badge: task.completed ? (isZh ? '任务已完成' : 'TASK COMPLETED') : (isZh ? '状态已更新' : 'TASK UPDATED'),
          title: task.title,
          details: [
            isZh ? `当前状态: ${task.completed ? '✅ 已完成' : '⏳ 待处理'}` : `Status: ${task.completed ? '✅ Completed' : '⏳ Pending'}`,
            isZh ? `优先级: ${task.priority}` : `Priority: ${task.priority}`,
          ],
        },
      };
    }

    case 'DELETE_TASK': {
      const tasks = loadTasks();
      const targetTitle = (data?.taskTitle || data?.title || '').trim();
      const idx = tasks.findIndex((t: any) => (t.title || '').toLowerCase().includes(targetTitle.toLowerCase()));
      if (idx === -1) {
        return { message: isZh ? `未找到要删除的待办事项 "${targetTitle}"。` : `Could not find task "${targetTitle}" to delete.` };
      }
      const [removed] = tasks.splice(idx, 1);
      saveTasks(tasks);
      return {
        message: isZh ? `已删除待办事项：「${removed.title}」。` : `Deleted task "${removed.title}".`,
        result: {
          type: 'task',
          badge: isZh ? '待办已删除' : 'TASK DELETED',
          title: removed.title,
          details: [isZh ? '已从待办列表移除' : 'Removed from task list'],
        },
      };
    }

    case 'CLEAR_COMPLETED_TASKS': {
      const tasks = loadTasks();
      const before = tasks.length;
      const remaining = tasks.filter((t: any) => !t.completed);
      const clearedCount = before - remaining.length;
      saveTasks(remaining);
      return {
        message: isZh
          ? `已为你清理 ${clearedCount} 项已完成的待办任务，目前剩余 ${remaining.length} 项待办。`
          : `Cleared ${clearedCount} completed task(s). ${remaining.length} pending task(s) remain.`,
        result: {
          type: 'task',
          badge: isZh ? '清理完成' : 'TASKS CLEANED',
          title: isZh ? `已移除 ${clearedCount} 项已完成任务` : `Removed ${clearedCount} Completed Tasks`,
          details: [isZh ? `当前剩余待办: ${remaining.length} 项` : `Remaining Pending: ${remaining.length}`],
        },
      };
    }

    case 'QUERY_TASKS': {
      const tasks = loadTasks();
      const pending = tasks.filter((t: any) => !t.completed);
      const completed = tasks.filter((t: any) => t.completed);

      return {
        message: isZh
          ? `你目前有 ${pending.length} 项待办任务尚未完成（已完成 ${completed.length} 项）。`
          : `You currently have ${pending.length} pending task(s) and ${completed.length} completed task(s).`,
        result: {
          type: 'task',
          badge: isZh ? '待办清单概览' : 'TASK CHECKLIST',
          title: isZh ? `待完成: ${pending.length} 项` : `Pending: ${pending.length} Tasks`,
          details: pending.length > 0
            ? pending.slice(0, 6).map((t: any) => `• [${(t.priority || 'medium').toUpperCase()}] ${t.title}${t.dueDate ? ` (${t.dueDate})` : ''}`)
            : [isZh ? '🎉 所有待办事项均已完成！' : '🎉 All tasks are completed!'],
        },
      };
    }

    case 'QUERY_WEALTH': {
      const m = computeAppMetrics();
      const walletBreakdown = m.walletSummaries.map((a: any) =>
        `${a.name}: RM ${a.balance.toFixed(2)}${a.reserved > 0 ? ` (可用 RM ${a.available.toFixed(2)})` : ''}`
      );

      return {
        message: isZh
          ? `你的当前总资产（现金+投资）为 RM ${m.grossNetWorth.toFixed(2)}（扣除贷款后净值 RM ${m.netWorthAfterDebt.toFixed(2)}）。其中钱包现金 RM ${m.totalCash.toFixed(2)}，投资组合 RM ${m.totalInvestmentMyr.toFixed(2)}，贷款总额 RM ${m.totalDebt.toFixed(2)}。`
          : `Your gross net worth is RM ${m.grossNetWorth.toFixed(2)} (Net after debt: RM ${m.netWorthAfterDebt.toFixed(2)}). Liquid Cash: RM ${m.totalCash.toFixed(2)}, Investments: RM ${m.totalInvestmentMyr.toFixed(2)}, Total Debt: RM ${m.totalDebt.toFixed(2)}.`,
        result: {
          type: 'wealth',
          badge: isZh ? '实时资产快照' : 'LIVE WEALTH SNAPSHOT',
          title: `RM ${m.grossNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          details: [
            isZh ? `流动现金总额: RM ${m.totalCash.toFixed(2)} (可用: RM ${m.totalAvailableCash.toFixed(2)})` : `Liquid Cash: RM ${m.totalCash.toFixed(2)} (Free: RM ${m.totalAvailableCash.toFixed(2)})`,
            isZh ? `投资组合市值: RM ${m.totalInvestmentMyr.toFixed(2)} (浮动盈亏: RM ${m.totalStockPnlMyr.toFixed(2)})` : `Investments: RM ${m.totalInvestmentMyr.toFixed(2)} (P&L: RM ${m.totalStockPnlMyr.toFixed(2)})`,
            isZh ? `本月收支: 收入 RM ${m.monthlyIncome.toFixed(2)} / 支出 RM ${m.totalMonthlyExpenses.toFixed(2)} (结余率 ${m.savingsRatePct}%)` : `Monthly: In RM ${m.monthlyIncome.toFixed(2)} / Out RM ${m.totalMonthlyExpenses.toFixed(2)} (${m.savingsRatePct}% saved)`,
            ...walletBreakdown.slice(0, 4),
          ],
        },
      };
    }

    case 'ANALYZE_APP_DATA': {
      const m = computeAppMetrics();
      const topCategory = Object.entries(m.categoryTotals).sort((a, b) => b[1] - a[1])[0];

      const summaryZh = [
        `**1. 资产与流动性健康度**`,
        `• 总资产 **RM ${m.grossNetWorth.toFixed(2)}**（净资产扣除负债后为 **RM ${m.netWorthAfterDebt.toFixed(2)}**）。`,
        `• 钱包现金共 **RM ${m.totalCash.toFixed(2)}**，其中已锁定预留金 **RM ${m.totalReserved.toFixed(2)}**，可自由支配现金 **RM ${m.totalAvailableCash.toFixed(2)}**。`,
        `**2. 月度收支与储蓄诊断**`,
        m.monthlyIncome > 0
          ? `• 本月收入 **RM ${m.monthlyIncome.toFixed(2)}**，总支出 **RM ${m.totalMonthlyExpenses.toFixed(2)}**（固定支出 RM ${m.totalFixedExpenses.toFixed(2)} + 日常支出 RM ${m.totalVariableExpenses.toFixed(2)} + 贷款月供 RM ${m.totalMonthlyLoanPayment.toFixed(2)}），月度净结余 **RM ${m.netMonthlySurplus.toFixed(2)}**（储蓄率 **${m.savingsRatePct}%**）。`
          : `• 目前尚未设置月度总收入（可对我说“把月收入设为 8000”），已记录本月支出 **RM ${m.totalMonthlyExpenses.toFixed(2)}**。`,
        topCategory ? `• 最大支出类别为「**${topCategory[0]}**」（RM ${topCategory[1].toFixed(2)}）。` : '',
        `**3. 投资组合与负债表现**`,
        `• 投资总市值 **RM ${m.totalInvestmentMyr.toFixed(2)}**（股票持仓 ${m.stockSummaries.length} 只，累计浮动盈亏 **RM ${m.totalStockPnlMyr >= 0 ? '+' : ''}${m.totalStockPnlMyr.toFixed(2)}**；外币及现金池折合 **RM ${m.totalInvestCashMyr.toFixed(2)}**）。`,
        `• 当前贷款共 ${m.loanSummaries.length} 笔，剩余本金总额 **RM ${m.totalDebt.toFixed(2)}**，每月固定还款 **RM ${m.totalMonthlyLoanPayment.toFixed(2)}**。`,
        `**4. NoteDown 工作台效率**`,
        `• 待办任务 **${m.pendingTasks.length}** 项（其中高优先级 **${m.highPriorityTasks.length}** 项，已完成 **${m.completedTasks.length}** 项），已保存灵感便签 **${m.notes.length}** 篇。`,
      ].filter(Boolean).join('\n');

      const summaryEn = [
        `**1. Asset & Liquidity Health**`,
        `• Gross Net Worth: **RM ${m.grossNetWorth.toFixed(2)}** (Net after debt: **RM ${m.netWorthAfterDebt.toFixed(2)}**).`,
        `• Liquid Cash: **RM ${m.totalCash.toFixed(2)}** (Reserved: **RM ${m.totalReserved.toFixed(2)}**, Free Available: **RM ${m.totalAvailableCash.toFixed(2)}**).`,
        `**2. Monthly Budget & Cashflow**`,
        m.monthlyIncome > 0
          ? `• Monthly Income: **RM ${m.monthlyIncome.toFixed(2)}**, Total Outflow: **RM ${m.totalMonthlyExpenses.toFixed(2)}**, Net Surplus: **RM ${m.netMonthlySurplus.toFixed(2)}** (Savings Rate: **${m.savingsRatePct}%**).`
          : `• Monthly income is not set yet (tell me "Set monthly income to 8000"). Logged monthly expenses: **RM ${m.totalMonthlyExpenses.toFixed(2)}**.`,
        topCategory ? `• Top spending category: **${topCategory[0]}** (RM ${topCategory[1].toFixed(2)}).` : '',
        `**3. Investments & Liabilities**`,
        `• Portfolio Total: **RM ${m.totalInvestmentMyr.toFixed(2)}** (${m.stockSummaries.length} stocks, Unrealized P&L: **RM ${m.totalStockPnlMyr >= 0 ? '+' : ''}${m.totalStockPnlMyr.toFixed(2)}**; Cash Pool: **RM ${m.totalInvestCashMyr.toFixed(2)}**).`,
        `• Active Loans: ${m.loanSummaries.length} totaling **RM ${m.totalDebt.toFixed(2)}** (Monthly payment: **RM ${m.totalMonthlyLoanPayment.toFixed(2)}**).`,
        `**4. NoteDown Workspace**`,
        `• Pending Tasks: **${m.pendingTasks.length}** (${m.highPriorityTasks.length} high-priority, ${m.completedTasks.length} completed), Saved Notes: **${m.notes.length}**.`,
      ].filter(Boolean).join('\n');

      return {
        message: isZh ? summaryZh : summaryEn,
        result: {
          type: 'system',
          badge: isZh ? '管家全局诊断报告' : 'BUTLER HEALTH REPORT',
          title: isZh ? `净资产 RM ${m.grossNetWorth.toFixed(2)} · 待办 ${m.pendingTasks.length} 项` : `Net Worth RM ${m.grossNetWorth.toFixed(2)} · ${m.pendingTasks.length} Tasks`,
          details: [
            isZh ? `自由可用现金: RM ${m.totalAvailableCash.toFixed(2)}` : `Free Cash: RM ${m.totalAvailableCash.toFixed(2)}`,
            isZh ? `投资组合盈亏: RM ${m.totalStockPnlMyr.toFixed(2)}` : `Portfolio P&L: RM ${m.totalStockPnlMyr.toFixed(2)}`,
            isZh ? `本月储蓄率: ${m.savingsRatePct}%` : `Savings Rate: ${m.savingsRatePct}%`,
            isZh ? `高优待办: ${m.highPriorityTasks.length} 项 | 便签: ${m.notes.length} 篇` : `High-Priority Tasks: ${m.highPriorityTasks.length} | Notes: ${m.notes.length}`,
          ],
        },
      };
    }

    case 'NAVIGATE': {
      const target = (data?.target || 'launcher').toLowerCase();
      return {
        message: isZh ? `正在为你打开 ${target} 模块...` : `Navigating to ${target}...`,
        navigateTarget: target,
        result: {
          type: 'system',
          badge: isZh ? '页面跳转' : 'NAVIGATION',
          title: isZh ? `已切换至 ${target.toUpperCase()}` : `Switched to ${target.toUpperCase()}`,
          details: [],
        },
      };
    }

    default:
      return {
        message: isZh ? '已完成指令处理。' : 'Command processed.',
      };
  }
};

export const tryLocalRuleParser = (input: string): LocalParseResult | null => {
  const text = input.trim();
  const isZh = getStoredLanguage() === 'zh';

  // 0. Deep Butler Analysis: "分析我的财务" / "管家体检" / "全面分析"
  if (/^(?:帮我)?(?:全面)?(?:分析|诊断|盘点|体检)(?:一下)?(?:我的)?(?:财务|资产|数据|开销|消费|app|全部数据|账目)/i.test(text) || /^analyze\s+(?:my\s+)?(?:finances?|data|wealth|spending|app)/i.test(text)) {
    return {
      intent: 'ANALYZE_APP_DATA',
      data: { focus: 'all' },
      message: isZh ? '正在为你生成全局管家诊断报告...' : 'Generating your full butler health report...',
    };
  }

  // 1. Set Monthly Income: "设置月收入 8000" / "把月收入设为 8500"
  const incomeMatch = text.match(/(?:设置|设定|修改|把)?月(?:度)?收入(?:设为|改为|是|为)?\s*(?:RM|\$)?\s*(\d+(?:\.\d+)?)/i) ||
                      text.match(/set\s+monthly\s+income\s+(?:to\s+)?(?:RM|\$)?\s*(\d+(?:\.\d+)?)/i);
  if (incomeMatch) {
    const amount = parseFloat(incomeMatch[1]);
    return {
      intent: 'SET_MONTHLY_INCOME',
      data: { amount },
      message: isZh ? `正在将月度收入设为 RM ${amount}...` : `Setting monthly income to RM ${amount}...`,
    };
  }

  // 2. Expense matching: "记一笔午餐 25" / "Spent RM25 on lunch"
  const zhExpenseMatch = text.match(/^(?:记一笔|记录支出|花了|消费|支出)[:：\s]*([^\d]+?)\s*(?:RM|¥|\$)?\s*(\d+(?:\.\d+)?)\s*(?:块|元|令吉|RM)?$/i);
  if (zhExpenseMatch) {
    const desc = zhExpenseMatch[1].trim();
    const amount = parseFloat(zhExpenseMatch[2]);
    return {
      intent: 'WITHDRAW_MONEY',
      data: { amount, description: desc, category: 'Self Maintenance' },
      message: isZh ? `正在为你记录支出：${desc} RM ${amount}...` : `Recording expense: ${desc} RM ${amount}...`,
    };
  }

  const enExpenseMatch = text.match(/^(?:spent|record expense|paid)\s+(?:RM|\$)?\s*(\d+(?:\.\d+)?)\s+(?:on|for)\s+(.+)$/i);
  if (enExpenseMatch) {
    const amount = parseFloat(enExpenseMatch[1]);
    const desc = enExpenseMatch[2].trim();
    return {
      intent: 'WITHDRAW_MONEY',
      data: { amount, description: desc, category: 'Self Maintenance' },
      message: `Recording expense: ${desc} RM ${amount}...`,
    };
  }

  // 3. Deposit matching: "存入 500 到 Maybank" / "Deposit RM500 into Maybank"
  const zhDepositMatch = text.match(/^(?:存入|进账|收入|充值)\s*(?:RM|\$)?\s*(\d+(?:\.\d+)?)\s*(?:块|元|RM)?\s*(?:到|进|至)\s*(.+)$/i);
  if (zhDepositMatch) {
    const amount = parseFloat(zhDepositMatch[1]);
    const walletName = zhDepositMatch[2].trim();
    return {
      intent: 'ADD_MONEY',
      data: { amount, walletName, description: isZh ? '资金存入' : 'Deposit' },
      message: isZh ? `正在存入 RM ${amount} 到 ${walletName}...` : `Depositing RM ${amount} into ${walletName}...`,
    };
  }

  // 4. Create task: "新建待办：xxx" / "Add task: xxx"
  const taskMatch = text.match(/^(?:新建待办|添加待办|加个待办|提醒我|add task|create task|new task)[:：\s]+(.+)$/i);
  if (taskMatch) {
    const title = taskMatch[1].trim();
    return {
      intent: 'CREATE_TASK',
      data: { title, priority: 'medium' },
      message: isZh ? `正在添加待办：${title}` : `Creating task: ${title}`,
    };
  }

  // 5. Clear completed tasks: "清理已完成待办" / "clear completed tasks"
  if (/^(?:清理|删除|清空)(?:所有)?已完成(?:的)?(?:待办|任务)/i.test(text) || /^clear\s+(?:all\s+)?completed\s+tasks/i.test(text)) {
    return {
      intent: 'CLEAR_COMPLETED_TASKS',
      data: {},
      message: isZh ? '正在清理已完成的待办任务...' : 'Clearing completed tasks...',
    };
  }

  // 6. Create note: "记录笔记：xxx" / "Create note: xxx"
  const noteMatch = text.match(/^(?:记录笔记|新建笔记|写条笔记|记一下|create note|add note|write a note)[:：\s]+(.+)$/i);
  if (noteMatch) {
    const body = noteMatch[1].trim();
    return {
      intent: 'CREATE_NOTE',
      data: { title: body.slice(0, 28), content: body, category: 'idea' },
      message: isZh ? `正在保存笔记...` : `Saving note...`,
    };
  }

  // 7. Query wealth
  if (/^(?:查一下|查看|查询)?(?:我的)?(?:总资产|净资产|钱包余额|资产状况|我现在怎么样|net worth|wallet balance|how am i doing)$/i.test(text)) {
    return {
      intent: 'QUERY_WEALTH',
      data: { aspect: 'all' },
      message: isZh ? '正在查询你的最新资产数据...' : 'Checking your live wealth snapshot...',
    };
  }

  // 8. Query tasks
  if (/^(?:查一下|查看|查询)?(?:我的)?(?:待办|待办清单|任务列表|todo list|pending tasks|my tasks)$/i.test(text)) {
    return {
      intent: 'QUERY_TASKS',
      data: { status: 'pending' },
      message: isZh ? '正在查询你的待办清单...' : 'Checking your pending tasks...',
    };
  }

  // 9. Navigation
  if (/^(?:打开|进入|去|切换到)\s*(?:资产中心|我的资产|钱包|mywealth)$/i.test(text)) {
    return { intent: 'NAVIGATE', data: { target: 'mywealth' }, message: '' };
  }
  if (/^(?:打开|进入|去|切换到)\s*(?:便签|记事本|笔记|待办|notedown|knowledgevault)$/i.test(text)) {
    return { intent: 'NAVIGATE', data: { target: 'knowledgevault' }, message: '' };
  }
  if (/^(?:打开|进入|去|切换到)\s*(?:新闻|资讯|newshub)$/i.test(text)) {
    return { intent: 'NAVIGATE', data: { target: 'newshub' }, message: '' };
  }
  if (/^(?:打开|进入|去|切换到)\s*(?:设置|系统设置|settings)$/i.test(text)) {
    return { intent: 'NAVIGATE', data: { target: 'settings' }, message: '' };
  }

  return null;
};
