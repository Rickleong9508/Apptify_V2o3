import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, X, Check, AlertTriangle, ArrowRight, 
  Wallet, FileText, CheckSquare, TrendingUp, RefreshCw, 
  Compass, ChevronRight, ChevronLeft, PieChart, ShieldCheck, Zap
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabase } from '../services/supabaseClient';
import { aiService } from '../services/aiService';
import { Account, Expense, Loan, Stock, MonthlyData } from '../types';
import { skillRegistry } from '../services/skillRegistry';
import { Language, translations, getStoredLanguage } from '../utils/i18n';

interface AskApptifyProps {
  currentApp: string;
  setCurrentApp: (app: any) => void;
}

interface ActionPayload {
  intent: string;
  data: any;
  message?: string;
  confirmationRequired?: boolean;
  confirmationMessage?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  actionResult?: {
    type: 'finance' | 'note' | 'task' | 'wealth' | 'nav';
    title: string;
    details: string[];
    badge?: string;
  };
  pendingAction?: ActionPayload;
}

export const AskApptify: React.FC<AskApptifyProps> = ({ currentApp, setCurrentApp }) => {
  const { session, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<ActionPayload | null>(null);

  // i18n language state
  const [lang, setLang] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    const handleLang = () => setLang(getStoredLanguage());
    window.addEventListener('apptify_language_change', handleLang);
    return () => window.removeEventListener('apptify_language_change', handleLang);
  }, []);

  const t = translations[lang];

  // Draggable button coordinates state (supports X & Y adjustment, default right-docked)
  const [btnPos, setBtnPos] = useState<{ x: number | null; y: number }>({
    x: null, // null means auto-docked against right edge
    y: typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.52) : 380,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0, hasMoved: false });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('apptify_copilot_coords');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.y === 'number') {
          const maxY = window.innerHeight - 80;
          const clampedY = Math.max(70, Math.min(maxY, parsed.y));
          let clampedX = null;
          if (typeof parsed.x === 'number') {
            const maxX = window.innerWidth - 80;
            clampedX = Math.max(5, Math.min(maxX, parsed.x));
          }
          setBtnPos({ x: clampedX, y: clampedY });
        }
      }
    } catch (e) {}
  }, []);

  // Drag start handler
  const handleDragStart = (clientX: number, clientY: number) => {
    const btnEl = document.getElementById('apptify-copilot-trigger');
    const rect = btnEl?.getBoundingClientRect();
    const currentX = rect ? rect.left : (btnPos.x ?? (window.innerWidth - 75));
    const currentY = rect ? rect.top : btnPos.y;

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: currentX,
      initialY: currentY,
      hasMoved: false,
    };
    setIsDragging(true);
  };

  // Drag move handler
  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;
    if (!dragRef.current.hasMoved && Math.hypot(deltaX, deltaY) > 5) {
      dragRef.current.hasMoved = true;
    }
    if (dragRef.current.hasMoved) {
      const maxX = window.innerWidth - 75;
      const maxY = window.innerHeight - 75;
      const newX = Math.max(4, Math.min(maxX, dragRef.current.initialX + deltaX));
      const newY = Math.max(65, Math.min(maxY, dragRef.current.initialY + deltaY));
      setBtnPos({ x: newX, y: newY });
    }
  };

  // Drag end handler
  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!dragRef.current.hasMoved) {
      // Tap / Click without drag: open drawer
      setIsOpen(true);
    } else {
      // Snap to right edge if dropped near right margin
      let finalX = btnPos.x;
      if (finalX !== null && finalX > window.innerWidth - 95) {
        finalX = null;
      }
      const finalCoords = { x: finalX, y: btnPos.y };
      setBtnPos(finalCoords);
      localStorage.setItem('apptify_copilot_coords', JSON.stringify(finalCoords));
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      handleDragEnd();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, btnPos]);

  // Model & Provider settings
  const [activeProvider, setActiveProvider] = useState<string>('google');
  const [activeModel, setActiveModel] = useState<string>('gemini-2.5-flash');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial welcome message
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: translations[getStoredLanguage()].copilot.welcomeMsg,
      actionResult: {
        type: 'wealth',
        title: getStoredLanguage() === 'zh' ? '专属私人助理已就绪' : 'Personal Copilot Ready',
        details: getStoredLanguage() === 'zh' 
          ? ['全面联动 MyWealth 财富中心', '全面联动 Knowledge Vault 灵感空间', '支持语音与自然语言命令实时更新']
          : ['Full integration with MyWealth Center', 'Connected to Knowledge Vault workspace', 'Natural language commands supported'],
        badge: getStoredLanguage() === 'zh' ? '专属私人助理' : 'Private Copilot'
      }
    }
  ]);

  // Sync settings
  useEffect(() => {
    const syncSettings = () => {
      setActiveProvider(localStorage.getItem('app_global_ai_provider') || 'google');
      setActiveModel(localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');
    };
    syncSettings();
    window.addEventListener('storage', syncSettings);
    return () => window.removeEventListener('storage', syncSettings);
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Cloud Sync Helper for MyWealth
  const syncMyWealthToCloud = async (dataToSave: any) => {
    if (!session || !user) return;
    try {
      const { data: existing } = await supabase.from('user_data').select('id, data').eq('user_id', user.id).single();
      let finalData = existing?.data || {};
      finalData.mywealth = dataToSave;

      if (existing?.id) {
        await supabase.from('user_data').update({
          data: finalData,
          updated_at: new Date().toISOString()
        }).eq('user_id', user.id);
      } else {
        await supabase.from('user_data').insert({
          user_id: user.id,
          data: finalData,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn("AskApptify: Background cloud sync failed", e);
    }
  };

  // Helper to load MyWealth data safely
  const loadMyWealthData = () => {
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
  const saveMyWealthData = async (mwData: any) => {
    const toSave = { ...mwData, lastUpdated: new Date().toISOString() };
    localStorage.setItem('mw_data_main', JSON.stringify(toSave));
    window.dispatchEvent(new Event('apptify_data_changed'));
    await syncMyWealthToCloud(toSave);
  };

  // Helper to load Knowledge Vault notes
  const loadNotes = (): any[] => {
    try {
      return JSON.parse(localStorage.getItem('apptify_notes') || '[]');
    } catch {
      return [];
    }
  };

  // Helper to save Knowledge Vault notes
  const saveNotes = (notes: any[]) => {
    localStorage.setItem('apptify_notes', JSON.stringify(notes));
    window.dispatchEvent(new Event('apptify_data_changed'));
  };

  // Helper to load Knowledge Vault tasks
  const loadTasks = (): any[] => {
    try {
      return JSON.parse(localStorage.getItem('apptify_tasks') || '[]');
    } catch {
      return [];
    }
  };

  // Helper to save Knowledge Vault tasks
  const saveTasks = (tasks: any[]) => {
    localStorage.setItem('apptify_tasks', JSON.stringify(tasks));
    window.dispatchEvent(new Event('apptify_data_changed'));
  };

  // Core Action Execution Engine: Directly updates app data!
  const executeAction = async (intent: string, data: any): Promise<{ message: string; result?: Message['actionResult'] }> => {
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
      const newNote = {
        id: Date.now().toString(),
        title,
        content,
        tag: ['work', 'idea', 'meeting', 'life'].includes(tag.toLowerCase()) ? tag.toLowerCase() : 'work',
        isPinned: false,
        createdAt: new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      };

      notes.unshift(newNote);
      saveNotes(notes);

      return {
        message: `已为你记录到 **Knowledge Vault 随手记**：\n• 标题：**${title}**\n• 分类：#${newNote.tag}\n• 内容摘要：${content.slice(0, 60)}${content.length > 60 ? '...' : ''}`,
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

    // 5. CREATE TASK (Knowledge Vault)
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
        message: `已为你添加到 **Knowledge Vault 待办清单**：\n• 任务：**${title}**\n• 优先级：${newTask.priority.toUpperCase()}\n• 截止提醒：${dueDate}`,
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
      const totalStock = (mwData.stocks || []).reduce((sum: number, s: any) => sum + ((Number(s.shares) || 0) * (Number(s.currentPrice) || 0)), 0);
      const totalAssets = totalCash + totalStock;
      const totalLoan = mwData.loans.reduce((sum: number, l: any) => sum + (Number(l.remainingAmount) || 0), 0);
      const totalMonthlyExpenses = mwData.monthlyData.expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

      const walletLines = mwData.accounts.map((a: any) => `• ${a.name}: RM${Number(a.balance).toFixed(2)}`).join('\n');

      return {
        message: `📊 **MyWealth 实时资产速报**：\n• **个人总资产**：**RM${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}**\n• 钱包总现金：RM${totalCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• 投资持仓：RM${totalStock.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• 履约借贷 (独立跟踪)：RM${totalLoan.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• 本月累计支出：RM${totalMonthlyExpenses.toFixed(2)}\n\n**各钱包余额分布：**\n${walletLines}`,
        result: {
          type: 'wealth',
          title: '实时总资产快报',
          details: [
            `个人总资产: RM${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            `流动现金: RM${totalCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            `投资持仓: RM${totalStock.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            `履约借贷: RM${totalLoan.toLocaleString('en-US', { minimumFractionDigits: 2 })} (独立)`,
            `本月支出: RM${totalMonthlyExpenses.toFixed(2)}`
          ],
          badge: '实时资产'
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
        message: `📋 **Knowledge Vault 待办任务清单**：\n未完成 (${pending.length}) 项 / 已完成 (${done.length}) 项：\n\n${lines}`,
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
        setCurrentApp(target === 'launcher' ? 'launcher' : (target as any));
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

    return { message: "命令已处理。" };
  };

  // Smart Offline/Rule-based Command Parser (Zero-latency direct execution)
  const tryLocalRuleParser = (text: string): ActionPayload | null => {
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

  // Main Handle Send
  const handleSend = async (textToSend: string = inputText) => {
    const query = textToSend.trim();
    if (!query || isProcessing) return;

    // Append user message
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    // 1. Try local rule-based intent parser first (instant execution, zero API key required)
    const localAction = tryLocalRuleParser(query);
    if (localAction) {
      try {
        const { message, result } = await executeAction(localAction.intent, localAction.data);
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: message,
            actionResult: result
          }
        ]);
        setIsProcessing(false);
        return;
      } catch (err: any) {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ 执行出错: ${err.message}`,
            isError: true
          }
        ]);
        setIsProcessing(false);
        return;
      }
    }

    // 2. If no direct local rule matched, send to LLM (if API key available)
    const apiKey = localStorage.getItem('app_global_api_key');
    if (!apiKey) {
      // Friendly message guiding user
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `💡 你可以直接下达精准命令让我更新数据：\n• **记支出**：如 *“记一笔午餐 25 块”*\n• **存钱包**：如 *“存入 500 到 Maybank”*\n• **转账**：如 *“从 Maybank 转账 200 到 Cash”*\n• **加待办**：如 *“新建待办：准备周报”*\n• **记想法**：如 *“新建笔记：Apptify V3 架构”*\n• **查资产**：如 *“查资产”*\n\n若需进行深层自由对话，请点击右下角设置配置您的 **AI API Key**。`,
          actionResult: {
            type: 'wealth',
            title: '本地快速命令就绪',
            details: ['记账/存入/划转/待办/笔记均支持免 Key 毫秒级执行'],
            badge: '命令引擎'
          }
        }
      ]);
      setIsProcessing(false);
      return;
    }

    // Construct live context for LLM
    const mwData = loadMyWealthData();
    const tasks = loadTasks();
    const notes = loadNotes();

    const contextPrompt = `
You are the dedicated "Personal AI Executive Assistant" for Apptify (Apptify 专属私人 AI 助手).
Current Active Page: ${currentApp}

CURRENT LIVE APP STATE:
- Wallets: ${JSON.stringify(mwData.accounts.map((a: any) => ({ name: a.name, balance: a.balance })))}
- Current Month Total Expenses: RM${mwData.monthlyData.expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)}
- Active Pending Tasks: ${JSON.stringify(tasks.filter(t => !t.completed).map(t => ({ id: t.id, title: t.title, priority: t.priority })))}
- Recent Notes: ${JSON.stringify(notes.slice(0, 5).map(n => ({ id: n.id, title: n.title })))}

CAPABILITIES:
You can directly update Apptify's database by returning a JSON action:
1. "WITHDRAW_MONEY" -> { "amount": number, "category": "Food"|"Transport"|"Utilities"|"Entertainment"|"Shopping"|"Health"|"Other", "description": string, "walletName": string }
2. "ADD_MONEY" -> { "amount": number, "description": string, "walletName": string }
3. "TRANSFER_MONEY" -> { "sourceWallet": string, "destinationWallet": string, "amount": number, "description": string }
4. "CREATE_NOTE" -> { "title": string, "content": string, "category": "work"|"idea"|"meeting"|"life" }
5. "CREATE_TASK" -> { "title": string, "priority": "high"|"medium"|"low", "deadline": string }
6. "UPDATE_TASK" -> { "taskTitle": string, "completed": boolean }
7. "QUERY_WEALTH" -> {}
8. "QUERY_TASKS" -> {}
9. "NAVIGATE" -> { "target": "mywealth"|"knowledgevault"|"newshub"|"launcher"|"settings" }
10. "CHAT" -> General conversational response.

OUTPUT SCHEMA (MUST BE VALID JSON ONLY, NO MARKDOWN, NO CODEBLOCKS):
{
  "intent": "WITHDRAW_MONEY" | "ADD_MONEY" | "TRANSFER_MONEY" | "CREATE_NOTE" | "CREATE_TASK" | "UPDATE_TASK" | "QUERY_WEALTH" | "QUERY_TASKS" | "NAVIGATE" | "CHAT",
  "data": { ... },
  "message": "Friendly and concise Chinese response to user"
}
`;

    try {
      const responseText = await aiService.generate(activeProvider as any, activeModel, apiKey, query, contextPrompt);
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedAction = JSON.parse(cleanJson);

      if (parsedAction.intent && parsedAction.intent !== 'CHAT') {
        const { message, result } = await executeAction(parsedAction.intent, parsedAction.data || {});
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: parsedAction.message || message,
            actionResult: result
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: parsedAction.message || responseText
          }
        ]);
      }
    } catch (err: any) {
      console.error("Ask Apptify AI generate error:", err);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ 处理请求时出错: ${err.message || '网络或接口异常'}\n提示：常用记账和任务指令支持本地秒级执行，可尝试直接输入 *“记一笔午餐 25”*。`,
          isError: true
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick Action Chips with dynamic i18n
  const quickActions = [
    { label: t.copilot.quickExpense, query: lang === 'zh' ? '记一笔午餐 25 块' : 'Record lunch RM25' },
    { label: t.copilot.quickIncome, query: lang === 'zh' ? '存入 500 到 Maybank' : 'Deposit 500 into Maybank' },
    { label: t.copilot.quickNote, query: lang === 'zh' ? '新建笔记：关于 Apptify 全新 iOS 27 设计' : 'Create note: Apptify iOS 27 Redesign' },
    { label: t.copilot.quickTask, query: lang === 'zh' ? '新建待办：本周完成财务核算' : 'Add task: Weekly finance report' },
    { label: t.copilot.quickWealth, query: lang === 'zh' ? '查资产' : 'Check net worth' },
    { label: t.copilot.quickTasks, query: lang === 'zh' ? '查待办' : 'Check todos' }
  ];

  return (
    <>
      {/* 1. Draggable & Right-Docked Floating Assistant Tab (用户可自由上下/左右拖拽，默认靠右吸附) */}
      {!isOpen && (
        <div
          id="apptify-copilot-trigger"
          onMouseDown={(e) => {
            e.preventDefault();
            handleDragStart(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            if (e.touches.length > 0) {
              handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          style={{
            position: 'fixed',
            top: `${btnPos.y}px`,
            left: btnPos.x !== null ? `${btnPos.x}px` : undefined,
            right: btnPos.x === null ? '0px' : undefined,
            touchAction: 'none',
            userSelect: 'none',
            zIndex: 45,
          }}
          className={`flex items-center gap-1.5 py-2.5 bg-white/85 dark:bg-[#16181F]/90 backdrop-blur-2xl border text-gray-800 dark:text-gray-100 shadow-[-4px_10px_30px_rgba(59,130,246,0.28)] transition-shadow duration-200 group cursor-grab active:cursor-grabbing select-none ${
            btnPos.x === null
              ? 'pl-2.5 pr-1.5 rounded-l-2xl rounded-r-none border-l border-t border-b border-r-0 border-white/60 dark:border-white/15'
              : 'px-3 rounded-full border-white/60 dark:border-white/15 shadow-xl'
          }`}
          title={lang === 'zh' ? "按住可拖动调节位置，点击展开私人助理" : "Drag to reposition, tap to open AI copilot"}
        >
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-1 flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 pointer-events-none">
            <img src="/icon.png" alt="Apptify" className="w-full h-full object-contain filter brightness-0 invert drop-shadow-sm" />
          </div>
          <div className="flex flex-col text-left pr-0.5 pointer-events-none">
            <span className="text-[11px] font-extrabold tracking-tight leading-none text-gray-900 dark:text-white">
              {t.copilot.tabTitle}
            </span>
            <span className="text-[8px] text-blue-600 dark:text-blue-400 font-bold mt-0.5 leading-none">
              {btnPos.x === null ? t.copilot.tabSub : (lang === 'zh' ? '点击展开' : 'Open')}
            </span>
          </div>
          {btnPos.x === null ? (
            <ChevronLeft size={13} className="text-gray-400 group-hover:-translate-x-0.5 transition-transform pointer-events-none" />
          ) : (
            <div className="flex flex-col gap-0.5 opacity-40 ml-0.5 pointer-events-none">
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              <span className="w-1 h-1 rounded-full bg-gray-500" />
            </div>
          )}
        </div>
      )}

      {/* 2. Slide-out Copilot Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop blur */}
          <div 
            className="absolute inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Liquid Glass Drawer Panel */}
          <div 
            className="w-full sm:w-[440px] h-full relative z-10 flex flex-col bg-white/80 dark:bg-[#12141A]/90 backdrop-blur-3xl border-l border-white/40 dark:border-white/10 shadow-2xl animate-slide-in-right overflow-hidden"
            style={{
              boxShadow: '-15px 0 50px rgba(0, 0, 0, 0.25)'
            }}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-2 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
                  <img src="/icon.png" alt="Apptify" className="w-full h-full object-contain filter brightness-0 invert drop-shadow" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-gray-900 dark:text-white leading-none">
                      {t.copilot.drawerTitle}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {t.copilot.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      {t.copilot.status} · {activeModel.split('/').pop()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors tap-scale"
                aria-label="关闭抽屉"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Chips Bar */}
            <div className="px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 overflow-x-auto no-scrollbar flex items-center gap-2">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(action.query)}
                  disabled={isProcessing}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/70 dark:bg-white/10 text-gray-700 dark:text-gray-200 border border-black/5 dark:border-white/10 hover:border-blue-500/40 hover:text-blue-600 dark:hover:text-blue-400 transition-all tap-scale shadow-sm disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* Messages Chat Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}
                >
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[88%] p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed transition-all shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-blue-500/20'
                        : msg.isError
                        ? 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-tl-none'
                        : 'ios-glass border border-white/60 dark:border-white/10 text-gray-800 dark:text-gray-100 rounded-tl-none bg-white/70 dark:bg-white/10'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Action Execution Result Card */}
                    {msg.actionResult && (
                      <div className="mt-3 p-3 rounded-xl bg-white/60 dark:bg-black/30 border border-black/5 dark:border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-white">
                            <Check size={14} className="text-emerald-500" />
                            <span>{msg.actionResult.title}</span>
                          </div>
                          {msg.actionResult.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {msg.actionResult.badge}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-300">
                          {msg.actionResult.details.map((item, dIdx) => (
                            <div key={dIdx} className="flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-blue-500" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 px-1 font-medium">
                    {msg.role === 'user' ? (lang === 'zh' ? '你' : 'You') : 'Ask Apptify'}
                  </span>
                </div>
              ))}

              {isProcessing && (
                <div className="flex items-start gap-2 animate-pulse">
                  <div className="ios-glass p-3 rounded-2xl rounded-tl-none border border-white/40 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Sparkles size={14} className="animate-spin text-blue-500" />
                    <span>{lang === 'zh' ? '专属 AI 正在解析指令并执行更新...' : 'Private AI is executing your instruction...'}</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 sm:p-4 border-t border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <div className="flex-1 relative flex items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t.copilot.inputPlaceholder}
                    disabled={isProcessing}
                    className="w-full pl-4 pr-10 py-3 rounded-2xl bg-white/70 dark:bg-black/30 border border-black/5 dark:border-white/10 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-inner"
                  />
                  {inputText && (
                    <button
                      type="button"
                      onClick={() => setInputText('')}
                      className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isProcessing}
                  className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25 tap-scale disabled:opacity-40 disabled:scale-100 transition-all"
                  aria-label="发送指令"
                >
                  <Send size={16} />
                </button>
              </form>
              <div className="mt-2 text-center">
                <span className="text-[10px] text-gray-400">
                  {t.copilot.hint}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AskApptify;
