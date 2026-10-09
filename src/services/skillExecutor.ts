import { saveAllDataToDrive } from './driveService';
import type { Expense } from '../types';

/**
 * The BingGo skill engine.
 *
 * Lifted verbatim out of AskApptify, where it had grown to ~550 lines inside a
 * 1164-line component. It never actually depended on component state: it reads
 * and writes localStorage directly and dispatches `apptify_data_changed` so the
 * screens refresh themselves. Only navigation needed anything from outside, and
 * that is now an optional `ctx.navigate` callback.
 *
 * The extraction matters because BingGo and AskApptify must not end up as two
 * copies of the same skill logic drifting apart.
 */

export interface SkillActionPayload {
  intent: string;
  data: any;
  message?: string;
  confirmationRequired?: boolean;
  confirmationMessage?: string;
}

export interface SkillResult {
  type: 'finance' | 'note' | 'task' | 'wealth' | 'nav';
  title: string;
  details: string[];
  badge?: string;
}

export interface SkillContext {
  /** Called for NAVIGATE intents so the host app can route. */
  navigate?: (target: string) => void;
}

/** Kept as an alias so existing call sites keep type-checking unchanged. */
export type ActionPayload = SkillActionPayload;

// Cloud Sync Helper for MyWealth / KnowledgeVault via Google Drive
const syncMyWealthToCloud = async (_dataToSave?: any) => {
  try {
    await saveAllDataToDrive();
  } catch (e) {
    console.warn("AskApptify: Background Google Drive sync skipped/failed", e);
  }
};

// Helper to load MyWealth data safely
export const loadMyWealthData = () => {
  const raw = localStorage.getItem('mw_data_main');
  if (!raw) {
    return {
      accounts: [
        { id: '1', name: 'Cash', balance: 500, history: [] },
        { id: '2', name: 'Maybank', balance: 3500, history: [] }
      ],
      monthlyData: { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) },
      fixedExpenses: [],
      loans: [],
      stocks: [],
      cash: { myr: 0, usd: 0, hkd: 0 },
      exchangeRate: 4.5,
      budgetHistory: []
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      accounts: parsed.accounts || [],
      monthlyData: parsed.monthlyData || { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) },
      fixedExpenses: parsed.fixedExpenses || [],
      loans: parsed.loans || [],
      stocks: parsed.stocks || [],
      cash: parsed.cash || { myr: 0, usd: 0, hkd: 0 },
      exchangeRate: parsed.exchangeRate || 4.5,
      budgetHistory: parsed.budgetHistory || []
    };
  } catch {
    return {
      accounts: [],
      monthlyData: { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) },
      fixedExpenses: [],
      loans: [],
      stocks: [],
      cash: { myr: 0, usd: 0, hkd: 0 },
      exchangeRate: 4.5,
      budgetHistory: []
    };
  }
};

// Helper to save MyWealth data
export const saveMyWealthData = async (mwData: any) => {
  const toSave = { ...mwData, lastUpdated: new Date().toISOString() };
  localStorage.setItem('mw_data_main', JSON.stringify(toSave));
  window.dispatchEvent(new Event('apptify_data_changed'));
  await syncMyWealthToCloud(toSave);
};

// Helper to load Knowledge Vault notes
export const loadNotes = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('apptify_notes') || '[]');
  } catch {
    return [];
  }
};

// Helper to save Knowledge Vault notes
export const saveNotes = (notes: any[]) => {
  localStorage.setItem('apptify_notes', JSON.stringify(notes));
  window.dispatchEvent(new Event('apptify_data_changed'));
};

// Helper to load Knowledge Vault tasks
export const loadTasks = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('apptify_tasks') || '[]');
  } catch {
    return [];
  }
};

// Helper to save Knowledge Vault tasks
export const saveTasks = (tasks: any[]) => {
  localStorage.setItem('apptify_tasks', JSON.stringify(tasks));
  window.dispatchEvent(new Event('apptify_data_changed'));
};

// Core Action Execution Engine: Directly updates app data!
export const executeAction = async (
  intent: string,
  data: any,
  ctx?: SkillContext
): Promise<{ message: string; result?: SkillResult }> => {
  // 1. RECORD EXPENSE / WITHDRAW MONEY
  if (intent === 'WITHDRAW_MONEY' || intent === 'RECORD_EXPENSE') {
    const mwData = loadMyWealthData();
    const amount = Number(data.amount) || 0;
    if (amount <= 0) throw new Error("支出金额必须大于 0");

    const category = data.category || 'Food';
    const desc = data.description || '日常消费';
    const walletName = data.walletName || '';

    // Find matching wallet
    let targetAcc = mwData.accounts.find((a: any) => 
      walletName ? a.name.toLowerCase().includes(walletName.toLowerCase()) : false
    );
    if (!targetAcc && mwData.accounts.length > 0) {
      // Default to Cash, or first wallet
      targetAcc = mwData.accounts.find((a: any) => a.name.toLowerCase().includes('cash')) || mwData.accounts[0];
    }

    if (targetAcc) {
      targetAcc.balance -= amount;
      targetAcc.history = [
        {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          type: 'OUT',
          amount: amount,
          description: desc
        },
        ...targetAcc.history
      ];
    }

    // Add to monthly variable expenses
    const newExpense: Expense = {
      id: Date.now().toString(),
      name: desc,
      amount: amount,
      category: category as any,
      isFixed: false
    };
    mwData.monthlyData.expenses = [newExpense, ...mwData.monthlyData.expenses];

    await saveMyWealthData(mwData);

    return {
      message: `已为你成功记录这笔支出！\n• 金额：**RM${amount.toFixed(2)}**\n• 类别：${category}\n• 支付钱包：${targetAcc ? targetAcc.name : '未指定'}${targetAcc ? `（当前余额：RM${targetAcc.balance.toFixed(2)}）` : ''}`,
      result: {
        type: 'finance',
        title: '已记入 MyWealth 支出',
        details: [
          `金额: RM${amount.toFixed(2)}`,
          `类别: ${category} · 描述: ${desc}`,
          targetAcc ? `${targetAcc.name} 钱包扣除后余额: RM${targetAcc.balance.toFixed(2)}` : '未绑定特定钱包'
        ],
        badge: '记账完成'
      }
    };
  }

  // 2. ADD MONEY / RECORD INCOME
  if (intent === 'ADD_MONEY' || intent === 'RECORD_INCOME') {
    const mwData = loadMyWealthData();
    const amount = Number(data.amount) || 0;
    if (amount <= 0) throw new Error("存入金额必须大于 0");

    const desc = data.description || '存入款项';
    const walletName = data.walletName || '';

    let targetAcc = mwData.accounts.find((a: any) => 
      walletName ? a.name.toLowerCase().includes(walletName.toLowerCase()) : false
    );
    if (!targetAcc && mwData.accounts.length > 0) {
      targetAcc = mwData.accounts[0];
    }

    if (targetAcc) {
      targetAcc.balance += amount;
      targetAcc.history = [
        {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          type: 'IN',
          amount: amount,
          description: desc
        },
        ...targetAcc.history
      ];
    }

    await saveMyWealthData(mwData);

    return {
      message: `已成功为你存入钱包！\n• 存入金额：**RM${amount.toFixed(2)}**\n• 目标账户：${targetAcc ? targetAcc.name : '钱包'}\n• 最新余额：**RM${targetAcc ? targetAcc.balance.toFixed(2) : amount.toFixed(2)}**`,
      result: {
        type: 'finance',
        title: '钱包入账成功',
        details: [
          `存入: RM${amount.toFixed(2)}`,
          `账户: ${targetAcc ? targetAcc.name : '主账户'}`,
          `当前最新余额: RM${targetAcc ? targetAcc.balance.toFixed(2) : amount.toFixed(2)}`
        ],
        badge: '已存入'
      }
    };
  }

  // 3. TRANSFER MONEY
  if (intent === 'TRANSFER_MONEY') {
    const mwData = loadMyWealthData();
    const amount = Number(data.amount) || 0;
    if (amount <= 0) throw new Error("转账金额必须大于 0");

    const srcName = data.sourceWallet || '';
    const dstName = data.destinationWallet || '';

    const srcAcc = mwData.accounts.find((a: any) => a.name.toLowerCase().includes(srcName.toLowerCase()));
    const dstAcc = mwData.accounts.find((a: any) => a.name.toLowerCase().includes(dstName.toLowerCase()));

    if (!srcAcc) throw new Error(`未找到源钱包 "${srcName}"，现有钱包: ${mwData.accounts.map((a: any) => a.name).join(', ')}`);
    if (!dstAcc) throw new Error(`未找到目标钱包 "${dstName}"，现有钱包: ${mwData.accounts.map((a: any) => a.name).join(', ')}`);

    srcAcc.balance -= amount;
    srcAcc.history = [
      {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type: 'OUT',
        amount: amount,
        description: `转账至 ${dstAcc.name}`
      },
      ...srcAcc.history
    ];

    dstAcc.balance += amount;
    dstAcc.history = [
      {
        id: (Date.now() + 1).toString(),
        date: new Date().toISOString(),
        type: 'IN',
        amount: amount,
        description: `从 ${srcAcc.name} 转入`
      },
      ...dstAcc.history
    ];

    await saveMyWealthData(mwData);

    return {
      message: `转账成功！已从 **${srcAcc.name}** 转出 RM${amount.toFixed(2)} 到 **${dstAcc.name}**。`,
      result: {
        type: 'finance',
        title: '内部钱包转账成功',
        details: [
          `转账金额: RM${amount.toFixed(2)}`,
          `${srcAcc.name} 当前余额: RM${srcAcc.balance.toFixed(2)}`,
          `${dstAcc.name} 当前余额: RM${dstAcc.balance.toFixed(2)}`
        ],
        badge: '划转完成'
      }
    };
  }

  // 4. CREATE NOTE (Knowledge Vault)
  if (intent === 'CREATE_NOTE') {
    const title = data.title || '随手笔记';
    const content = data.content || '';
    const tag = data.category || data.tag || 'work';

    const notes = loadNotes();
    const safeTag = ['work', 'idea', 'meeting', 'life'].includes(String(tag).toLowerCase())
      ? String(tag).toLowerCase()
      : 'work';
    const newNote = {
      id: Date.now().toString(),
      title,
      content,
      // `category` is what KnowledgeVault reads; `tag` is kept because older
      // stored notes and this engine's own message template both use it.
      category: safeTag,
      tag: safeTag,
      isPinned: false,
      createdAt: new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    notes.unshift(newNote);
    saveNotes(notes);

    return {
      message: `已为你记录到 **NoteDown 随手记**：\n• 标题：**${title}**\n• 分类：#${newNote.tag}\n• 内容摘要：${content.slice(0, 60)}${content.length > 60 ? '...' : ''}`,
      result: {
        type: 'note',
        title: '笔记创建成功',
        details: [
          `标题: ${title}`,
          `分类标签: #${newNote.tag}`,
          `创建时间: ${newNote.createdAt}`
        ],
        badge: '已保存'
      }
    };
  }

  // 5. CREATE TASK (NoteDown)
  if (intent === 'CREATE_TASK' || intent === 'CREATE_TODO') {
    const title = data.title || '新待办任务';
    const priority = (data.priority || 'medium').toLowerCase();
    const dueDate = data.deadline || data.dueDate || '今天';

    const tasks = loadTasks();
    const newTask = {
      id: Date.now().toString(),
      title,
      priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
      completed: false,
      createdAt: new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      dueDate
    };

    tasks.unshift(newTask);
    saveTasks(tasks);

    return {
      message: `已为你添加到 **NoteDown 待办清单**：\n• 任务：**${title}**\n• 优先级：${newTask.priority.toUpperCase()}\n• 截止提醒：${dueDate}`,
      result: {
        type: 'task',
        title: '待办任务已添加',
        details: [
          `任务项: ${title}`,
          `优先级: ${newTask.priority === 'high' ? '🔴 高优' : newTask.priority === 'low' ? '🟢 低优' : '🟡 中等'}`,
          `截止提醒: ${dueDate}`
        ],
        badge: '任务就绪'
      }
    };
  }

  // 6. UPDATE TASK (Complete/Uncomplete)
  if (intent === 'UPDATE_TASK' || intent === 'COMPLETE_TASK') {
    const targetTitle = (data.taskTitle || data.title || '').toLowerCase();
    const tasks = loadTasks();
    const match = tasks.find(t => t.title.toLowerCase().includes(targetTitle));

    if (!match) {
      throw new Error(`未找到包含 "${data.taskTitle || data.title}" 的任务。当前待办：${tasks.map(t => t.title).join('、')}`);
    }

    match.completed = data.completed !== undefined ? Boolean(data.completed) : true;
    saveTasks(tasks);

    return {
      message: `已将任务 **"${match.title}"** 状态更新为：${match.completed ? '✅ **已完成**' : '⏳ **待处理**'}！`,
      result: {
        type: 'task',
        title: match.completed ? '待办任务已标记完成' : '待办任务已重新激活',
        details: [`任务: ${match.title}`, `状态: ${match.completed ? '已达成' : '进行中'}`],
        badge: match.completed ? '完成达成' : '已重置'
      }
    };
  }

  // 7. QUERY WEALTH STATUS
  if (intent === 'QUERY_WEALTH') {
    const mwData = loadMyWealthData();
    const totalCash = mwData.accounts.reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0);
    const exchangeRate = Number(mwData.exchangeRate) || 4.5;
    const stocksVal = (mwData.stocks || []).reduce((sum: number, s: any) => {
      const qty = Number(s.quantity ?? s.shares ?? 0);
      const price = Number(s.currentPrice || 0);
      const rate = s.currency === 'USD' ? exchangeRate : 1;
      return sum + (qty * price * rate);
    }, 0);
    const investCash = mwData.cash || {};
    const hkdRate = Number(investCash.hkdRate) || 0.58;
    const investCashVal = (Number(investCash.myr) || 0) + ((Number(investCash.usd) || 0) * exchangeRate) + ((Number(investCash.hkd) || 0) * hkdRate);
    const totalInvestment = stocksVal + investCashVal;

    // 严格按照用户需求：总数 = 现金 + 目前的投资数额（绝不计算/扣除 Loan）
    const grandTotal = totalCash + totalInvestment;
    const totalLoan = (mwData.loans || []).reduce((sum: number, l: any) => sum + (Number(l.remainingAmount) || 0), 0);
    const totalMonthlyExpenses = mwData.monthlyData.expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    const walletLines = mwData.accounts.map((a: any) => `• ${a.name}: RM${Number(a.balance).toFixed(2)}`).join('\n');

    return {
      message: `📊 **MyWealth 财富总数速报**：\n• **总数 (现金 + 目前投资数额)**：**RM${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}**\n  - 钱包现金：RM${totalCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n  - 目前投资数额：RM${totalInvestment.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• 履约中借贷：RM${totalLoan.toLocaleString('en-US', { minimumFractionDigits: 2 })} (独立跟踪，100%不从总数扣减)\n• 本月累计支出：RM${totalMonthlyExpenses.toFixed(2)}\n\n**各钱包余额分布：**\n${walletLines}`,
      result: {
        type: 'wealth',
        title: '现金与目前投资总数',
        details: [
          `总数 (现金+投资): RM${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `现金钱包: RM${totalCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `目前投资数额: RM${totalInvestment.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `履约借贷: RM${totalLoan.toLocaleString('en-US', { minimumFractionDigits: 2 })} (独立)`,
          `本月支出: RM${totalMonthlyExpenses.toFixed(2)}`
        ],
        badge: '总数速报'
      }
    };
  }

  // 8. QUERY TASKS
  if (intent === 'QUERY_TASKS') {
    const tasks = loadTasks();
    const pending = tasks.filter(t => !t.completed);
    const done = tasks.filter(t => t.completed);

    const lines = pending.length > 0 
      ? pending.map((t, idx) => `${idx + 1}. [${t.priority.toUpperCase()}] ${t.title} (${t.dueDate || '待定'})`).join('\n')
      : '暂无未完成待办事项，太棒了！';

    return {
      message: `📋 **NoteDown 待办任务清单**：\n未完成 (${pending.length}) 项 / 已完成 (${done.length}) 项：\n\n${lines}`,
      result: {
        type: 'task',
        title: `待办任务进度 (${pending.length} 待处理 / ${done.length} 已达成)`,
        details: pending.slice(0, 4).map(t => `${t.priority === 'high' ? '🔴' : '🟡'} ${t.title}`),
        badge: '待办汇总'
      }
    };
  }

  // 9. NAVIGATE MODULES
  if (intent === 'NAVIGATE') {
    const target = (data.target || '').toLowerCase();
    if (['launcher', 'mywealth', 'knowledgevault', 'newshub', 'settings'].includes(target)) {
      ctx?.navigate?.(target === 'launcher' ? 'launcher' : target);
      return {
        message: `已为你无缝切换至 **${target.toUpperCase()}** 模块。`,
        result: {
          type: 'nav',
          title: '页面跳转',
          details: [`已进入: ${target}`],
          badge: '导航'
        }
      };
    }
  }


  // 11. BUDGET LINE — declared in the registry since the beginning, but this
  //     engine never handled it: the model could ask for it and the user was
  //     told "done" while nothing changed. Now implemented.
  if (intent === 'ADD_BUDGET') {
    const mwData = loadMyWealthData();
    const amount = Number(data.amount) || 0;
    if (amount <= 0) throw new Error("预算金额必须大于 0");
    const name = data.name || data.description || 'New budget line';
    const category = data.category || 'Other';
    mwData.fixedExpenses = [
      ...(mwData.fixedExpenses || []),
      { id: `fe${Date.now()}`, name, amount, category, isFixed: true },
    ];
    await saveMyWealthData(mwData);
    const monthly = (mwData.fixedExpenses as any[]).reduce((s, e) => s + (e.amount || 0), 0);
    return {
      message: `已添加固定支出「${name}」。\n• 金额：**RM${amount.toFixed(2)}**\n• 类别：${category}\n• 每月固定支出合计：**RM${monthly.toFixed(2)}**`,
      result: { type: 'finance', title: '已添加固定支出', details: [`${name} · RM${amount.toFixed(2)}`, `类别：${category}`, `每月合计：RM${monthly.toFixed(2)}`], badge: '预算' },
    };
  }

  // 12. LOAN
  if (intent === 'ADD_LOAN') {
    const mwData = loadMyWealthData();
    const total = Number(data.totalAmount ?? data.amount) || 0;
    if (total <= 0) throw new Error("贷款金额必须大于 0");
    const name = data.name || 'New loan';
    const months = Number(data.remainingMonths ?? data.months) || 12;
    const monthly = Number(data.monthlyPayment) || Number((total / months).toFixed(2));
    mwData.loans = [
      ...(mwData.loans || []),
      { id: `ln${Date.now()}`, name, totalAmount: total, monthlyPayment: monthly, remainingAmount: total, remainingMonths: months },
    ];
    await saveMyWealthData(mwData);
    return {
      message: `已记录贷款「${name}」。\n• 本金：**RM${total.toFixed(2)}**\n• 每月还款：**RM${monthly.toFixed(2)}**\n• 剩余期数：${months}`,
      result: { type: 'finance', title: '已记录贷款', details: [`${name} · RM${total.toFixed(2)}`, `月供 RM${monthly.toFixed(2)} · ${months} 期`, `待还：RM${total.toFixed(2)}`], badge: '贷款' },
    };
  }

  // 13. REPAY LOAN
  if (intent === 'REPAY_LOAN') {
    const mwData = loadMyWealthData();
    const amount = Number(data.amount) || 0;
    if (amount <= 0) throw new Error("还款金额必须大于 0");
    const loans = (mwData.loans || []) as any[];
    if (!loans.length) throw new Error("当前没有贷款记录");
    const want = (data.loanName || data.name || '').toString().toLowerCase();
    const target = (want && loans.find((l) => l.name.toLowerCase().includes(want))) || loans[0];
    const remaining = Math.max(0, (target.remainingAmount || 0) - amount);
    const months = Math.max(0, (target.remainingMonths || 0) - Math.max(1, Math.round(amount / (target.monthlyPayment || amount))));
    target.remainingAmount = remaining;
    target.remainingMonths = months;
    await saveMyWealthData(mwData);
    return {
      message: `已还款 **RM${amount.toFixed(2)}** 到「${target.name}」。\n• 剩余待还：**RM${remaining.toFixed(2)}**\n• 剩余期数：${months}`,
      result: { type: 'finance', title: '已记录还款', details: [`${target.name} · 还款 RM${amount.toFixed(2)}`, `剩余待还：RM${remaining.toFixed(2)}`, `剩余 ${months} 期`], badge: '贷款' },
    };
  }

  // 14. SEARCH NOTES
  if (intent === 'SEARCH_NOTES') {
    const q = (data.query || data.keyword || '').toString().toLowerCase().trim();
    const notes = loadNotes() as any[];
    const hits = q
      ? notes.filter((n) => `${n.title || ''} ${n.content || ''}`.toLowerCase().includes(q))
      : notes.slice(0, 5);
    if (!hits.length) return { message: `没有找到和「${q}」相关的笔记。`, result: { type: 'note', title: '没有匹配', details: [`关键词：${q}`], badge: '搜索' } };
    return {
      message: `找到 ${hits.length} 条相关笔记：\n` + hits.slice(0, 5).map((n) => `• **${n.title || '未命名'}**`).join('\n'),
      result: { type: 'note', title: `找到 ${hits.length} 条笔记`, details: hits.slice(0, 5).map((n) => n.title || '未命名'), badge: '搜索' },
    };
  }

  // 15. QUERY NOTES
  if (intent === 'QUERY_NOTES') {
    const notes = loadNotes() as any[];
    if (!notes.length) return { message: '你还没有任何笔记。', result: { type: 'note', title: '暂无笔记', details: [], badge: '笔记' } };
    return {
      message: `你一共有 **${notes.length}** 条笔记，最近的是：\n` + notes.slice(0, 5).map((n) => `• **${n.title || '未命名'}**`).join('\n'),
      result: { type: 'note', title: `${notes.length} 条笔记`, details: notes.slice(0, 5).map((n) => n.title || '未命名'), badge: '笔记' },
    };
  }

  // 16. UPDATE / DELETE NOTE
  if (intent === 'UPDATE_NOTE' || intent === 'DELETE_NOTE') {
    const notes = loadNotes() as any[];
    const want = (data.title || data.noteTitle || '').toString().toLowerCase().trim();
    const idx = want ? notes.findIndex((n) => (n.title || '').toLowerCase().includes(want)) : -1;
    if (idx === -1) throw new Error(`没有找到标题包含「${data.title || data.noteTitle || ''}」的笔记`);
    if (intent === 'DELETE_NOTE') {
      const [gone] = notes.splice(idx, 1);
      saveNotes(notes);
      return { message: `已删除笔记「${gone.title || '未命名'}」。`, result: { type: 'note', title: '已删除笔记', details: [gone.title || '未命名'], badge: '笔记' } };
    }
    if (data.content !== undefined) notes[idx].content = data.content;
    if (data.newTitle) notes[idx].title = data.newTitle;
    if (data.category) notes[idx].category = data.category;
    saveNotes(notes);
    return { message: `已更新笔记「${notes[idx].title || '未命名'}」。`, result: { type: 'note', title: '已更新笔记', details: [notes[idx].title || '未命名'], badge: '笔记' } };
  }

  // 17. DELETE TASK
  if (intent === 'DELETE_TASK') {
    const tasks = loadTasks() as any[];
    const want = (data.taskTitle || data.title || '').toString().toLowerCase().trim();
    const idx = want ? tasks.findIndex((t) => (t.title || '').toLowerCase().includes(want)) : -1;
    if (idx === -1) throw new Error(`没有找到标题包含「${data.taskTitle || data.title || ''}」的待办`);
    const [gone] = tasks.splice(idx, 1);
    saveTasks(tasks);
    return { message: `已删除待办「${gone.title || '未命名'}」。`, result: { type: 'task', title: '已删除待办', details: [gone.title || '未命名'], badge: '待办' } };
  }

  // Anything the registry declares but this engine does not implement must say
  // so. The old fallback replied "命令已处理。" to every unrecognised intent,
  // which told the user their money had moved when nothing had happened.
  return {
    message: `我还不能执行「${intent}」这个操作。你可以到对应页面手动完成，或者换个说法告诉我。`,
    result: { type: 'nav', title: '暂不支持的操作', details: [`意图：${intent}`, '没有对数据做任何修改'], badge: '未执行' },
  };
};

// Smart Offline/Rule-based Command Parser (Zero-latency direct execution)
export const tryLocalRuleParser = (text: string): ActionPayload | null => {
  const trimmed = text.trim();

  // 1. 记账 / 支出：记一笔晚餐 35 / 消费 20 咖啡 / 记录支出 50
  // Examples: "记一笔晚餐 35", "支出 50 买菜", "用Cash支付 30 午餐", "花了 45", "record expense 25 lunch"
  const expenseRegex = /(?:记一笔|记录支出|记账|花费|支出|花了|消费|买|用)\s*([^\d\s]+)?\s*(\d+(?:\.\d+)?)\s*(?:元|块|rm)?\s*(?:在|买|为|做|于|用)?\s*(.*)/i;
  const expenseMatch = trimmed.match(expenseRegex);
  if (expenseMatch) {
    const rawCategoryOrItem = expenseMatch[1] || '';
    const amount = parseFloat(expenseMatch[2]);
    const rest = expenseMatch[3] || '';
    let desc = (rawCategoryOrItem + ' ' + rest).trim() || '日常消费';
    
    // Infer category
    let category = 'Food';
    if (/车|汽油|打车|地铁|交通|bus|grab|petrol/i.test(desc)) category = 'Transport';
    else if (/水费|电费|网费|房租|话费|utility|rent/i.test(desc)) category = 'Utilities';
    else if (/玩|电影|游戏|娱乐|game|movie/i.test(desc)) category = 'Entertainment';
    else if (/衣服|购物|买东西|淘宝|shopee/i.test(desc)) category = 'Shopping';
    else if (/药|医院|看病|体检|health/i.test(desc)) category = 'Health';

    // Infer wallet
    let walletName = '';
    if (/cash|现金/i.test(desc) || /cash|现金/i.test(trimmed)) walletName = 'Cash';
    else if (/maybank/i.test(desc) || /maybank/i.test(trimmed)) walletName = 'Maybank';
    else if (/cimb/i.test(desc) || /cimb/i.test(trimmed)) walletName = 'CIMB';

    return {
      intent: 'WITHDRAW_MONEY',
      data: { amount, description: desc, category, walletName }
    };
  }

  // 2. 存入 / 入账：存入 500 到 Maybank / 收入 3000
  const incomeRegex = /(?:存入|进账|收入|充值|入账)\s*(\d+(?:\.\d+)?)\s*(?:元|块|rm)?\s*(?:到|至|在)?\s*(.*)/i;
  const incomeMatch = trimmed.match(incomeRegex);
  if (incomeMatch) {
    const amount = parseFloat(incomeMatch[1]);
    const target = incomeMatch[2].trim();
    let walletName = '';
    if (/maybank/i.test(target)) walletName = 'Maybank';
    else if (/cimb/i.test(target)) walletName = 'CIMB';
    else if (/cash|现金/i.test(target)) walletName = 'Cash';

    return {
      intent: 'ADD_MONEY',
      data: { amount, description: target ? `存入 ${target}` : '充值入账', walletName }
    };
  }

  // 3. 转账：从 Maybank 转账 200 到 Cash
  const transferRegex = /(?:从)?\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)\s*(?:转账|转)?\s*(\d+(?:\.\d+)?)\s*(?:元|块|rm)?\s*(?:到|至)\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)/i;
  const transferMatch = trimmed.match(transferRegex);
  if (transferMatch) {
    const sourceWallet = transferMatch[1].trim();
    const amount = parseFloat(transferMatch[2]);
    const destinationWallet = transferMatch[3].trim();
    return {
      intent: 'TRANSFER_MONEY',
      data: { sourceWallet, destinationWallet, amount, description: `转账到 ${destinationWallet}` }
    };
  }

  // 4. 新建待办：添加待办：下午3点开会 / 新建任务：准备设计稿
  const taskRegex = /(?:添加待办|新建待办|添加任务|新建任务|提醒我|待办|todo)[:：\s]\s*(.*)/i;
  const taskMatch = trimmed.match(taskRegex);
  if (taskMatch) {
    const title = taskMatch[1].trim();
    let priority = 'medium';
    if (/重要|紧急|必须|urgent|high/i.test(title)) priority = 'high';
    else if (/有空|低|low/i.test(title)) priority = 'low';

    return {
      intent: 'CREATE_TASK',
      data: { title, priority, deadline: '尽快' }
    };
  }

  // 5. 完成待办：完成待办 准备设计稿 / 完成任务 下午开会
  const completeTaskRegex = /(?:完成待办|完成任务|标记完成|搞定)[:：\s]\s*(.*)/i;
  const completeMatch = trimmed.match(completeTaskRegex);
  if (completeMatch) {
    return {
      intent: 'UPDATE_TASK',
      data: { taskTitle: completeMatch[1].trim(), completed: true }
    };
  }

  // 6. 新建笔记：记笔记：... / 记录灵感：...
  const noteRegex = /(?:记笔记|新建笔记|记录笔记|随手记|记录想法|笔记)[:：\s]\s*(.*)/i;
  const noteMatch = trimmed.match(noteRegex);
  if (noteMatch) {
    const content = noteMatch[1].trim();
    const parts = content.split(/[:：\-\s]/);
    const title = parts.length > 1 && parts[0].length < 15 ? parts[0] : content.slice(0, 16);
    return {
      intent: 'CREATE_NOTE',
      data: { title, content, category: 'idea' }
    };
  }

  // 7. 资产查询：查资产 / 净资产 / 我有多少钱 / 查账
  if (/(?:查资产|净资产|总资产|余额|查账|我有多少钱|财务速报)/i.test(trimmed)) {
    return {
      intent: 'QUERY_WEALTH',
      data: {}
    };
  }

  // 8. 待办查询：查待办 / 我的任务 / 有什么事 / 待办清单
  if (/(?:查待办|待办事项|我的任务|未完成任务|有什么事|待办清单)/i.test(trimmed)) {
    return {
      intent: 'QUERY_TASKS',
      data: {}
    };
  }

  // 9. 模块跳转
  if (/(?:打开|切换到|前往|去)?\s*(?:mywealth|财富|记账)/i.test(trimmed) && trimmed.length < 12) {
    return { intent: 'NAVIGATE', data: { target: 'mywealth' } };
  }
  if (/(?:打开|切换到|前往|去)?\s*(?:knowledge|笔记|记事本|待办|vault)/i.test(trimmed) && trimmed.length < 12) {
    return { intent: 'NAVIGATE', data: { target: 'knowledgevault' } };
  }
  if (/(?:打开|切换到|前往|去)?\s*(?:newshub|新闻|资讯)/i.test(trimmed) && trimmed.length < 12) {
    return { intent: 'NAVIGATE', data: { target: 'newshub' } };
  }
  if (/(?:返回|回到)?\s*(?:主页|桌面|launcher)/i.test(trimmed) && trimmed.length < 8) {
    return { intent: 'NAVIGATE', data: { target: 'launcher' } };
  }

  return null;
};
