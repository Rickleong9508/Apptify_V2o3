import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Mic, Send, X, ChevronRight, Check, AlertTriangle, Play, RefreshCw, BarChart2, FileText, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabase } from '../services/supabaseClient';
import { aiService } from '../services/aiService';
import { stockService } from '../services/stockService';
import { investSkillService, InvestmentSignal } from '../services/investSkillService';
import { Account, Expense, Loan, Stock, MonthlyData } from '../types';

interface AskApptifyProps {
  currentApp: string;
  setCurrentApp: (app: any) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  stockAnalysis?: {
    symbol: string;
    signal: InvestmentSignal;
    report: string;
  };
  pendingAction?: {
    intent: string;
    data: any;
    message: string;
  };
}

const AskApptify: React.FC<AskApptifyProps> = ({ currentApp, setCurrentApp }) => {
  const { session, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello, I am Ask Apptify, your Personal OS assistant. What would you like to execute? e.g., 'spent RM15 on coffee', 'save a note: Buy milk', or 'analyze TSLA'."
    }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<Message['pendingAction'] | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isProcessing]);

  // Speech Recognition Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        handleSend(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // --- Cloud Sync Helpers ---
  const syncMyWealthToCloud = async (dataToSave: any) => {
    if (!user) return;
    try {
      const { data: existing } = await supabase.from('user_data').select('id, data').eq('user_id', user.id).single();
      let finalData = existing?.data || {};
      finalData.mywealth = dataToSave;
      if (existing?.id) {
        await supabase.from('user_data').update({ data: finalData, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      } else {
        await supabase.from('user_data').insert({ user_id: user.id, data: finalData, updated_at: new Date().toISOString() });
      }
    } catch (e) {
      console.error("AskApptify: MyWealth cloud sync failed", e);
    }
  };

  const syncGetNoteToCloud = async (notes: any[], todos: any[]) => {
    if (!user) return;
    try {
      const { data: existing } = await supabase.from('user_data').select('id, data').eq('user_id', user.id).single();
      let finalData = existing?.data || {};
      finalData.getnote = { notes, todos, lastUpdated: new Date().toISOString() };
      if (existing?.id) {
        await supabase.from('user_data').update({ data: finalData, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      } else {
        await supabase.from('user_data').insert({ user_id: user.id, data: finalData, updated_at: new Date().toISOString() });
      }
    } catch (e) {
      console.error("AskApptify: GetNote cloud sync failed", e);
    }
  };

  // --- State Execution Action ---
  const executeAction = async (intent: string, data: any): Promise<string> => {
    const mw = (window as any).__apptify_mywealth;
    const gn = (window as any).__apptify_getnote;

    // 1. NAVIGATE
    if (intent === 'NAVIGATE') {
      const target = data.target?.toLowerCase() || '';
      const tabMap: any = { wallet: 'accounts', budget: 'budget', loan: 'loans', portfolio: 'investments', overview: 'dashboard' };
      
      if (['mywealth', 'getnote', 'settings', 'autocount', 'newshub', 'launcher'].includes(target)) {
        setCurrentApp(target === 'launcher' ? 'launcher' : target);
        return `Navigated to ${data.target}.`;
      } else if (tabMap[target]) {
        setCurrentApp('mywealth');
        setTimeout(() => {
          const freshMw = (window as any).__apptify_mywealth;
          if (freshMw) {
            freshMw.setActiveTab(tabMap[target]);
          }
        }, 150);
        return `Navigated My Wealth to ${data.target}.`;
      }
      return `Target ${data.target} not recognized.`;
    }

    // 2. ADD_TRANSACTION
    if (intent === 'ADD_TRANSACTION') {
      const { action, accountName, amount, description, category } = data;
      const transactionAmt = Number(amount) || 0;
      
      let accounts: Account[] = [];
      let monthlyData: MonthlyData = { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) };
      let fixedExpenses: Expense[] = [];
      let loans: Loan[] = [];
      let stocks: Stock[] = [];
      let cash = { myr: 0, usd: 0, hkd: 0 };
      let exchangeRate = 4.50;
      let budgetHistory: any[] = [];

      if (mw) {
        accounts = [...mw.accounts];
        monthlyData = { ...mw.monthlyData };
        fixedExpenses = [...mw.fixedExpenses];
        loans = [...mw.loans];
        stocks = [...mw.stocks];
        cash = { ...mw.cash };
        exchangeRate = mw.exchangeRate;
        budgetHistory = [...mw.budgetHistory];
      } else {
        const savedMW = localStorage.getItem('mw_data_main');
        if (savedMW) {
          const parsed = JSON.parse(savedMW);
          accounts = parsed.accounts || [];
          monthlyData = parsed.monthlyData || monthlyData;
          fixedExpenses = parsed.fixedExpenses || [];
          loans = parsed.loans || [];
          stocks = parsed.stocks || [];
          cash = parsed.cash || cash;
          exchangeRate = parsed.exchangeRate || exchangeRate;
          budgetHistory = parsed.budgetHistory || [];
        }
      }

      // Find matching wallet
      let targetAcc = accounts.find(a => a.name.toLowerCase().includes(accountName?.toLowerCase() || ''));
      if (!targetAcc && accounts.length > 0) targetAcc = accounts[0];
      if (!targetAcc) {
        targetAcc = { id: Date.now().toString(), name: accountName || 'Cash', balance: 0, reservations: [], history: [] };
        accounts.push(targetAcc);
      }

      const newTx = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type: action === 'IN' ? 'IN' as const : 'OUT' as const,
        amount: transactionAmt,
        description: description || 'Command Layer Tx'
      };

      targetAcc.balance = action === 'IN' ? targetAcc.balance + transactionAmt : targetAcc.balance - transactionAmt;
      targetAcc.history = [newTx, ...targetAcc.history];

      // Cross-Module: Update Budget Planner if expense
      if (action === 'OUT') {
        const newExpense = {
          id: (Date.now() + 1).toString(),
          name: description || 'Expense',
          amount: transactionAmt,
          category: category || 'Other',
          isFixed: false
        };
        monthlyData.expenses = [newExpense, ...monthlyData.expenses];
      }

      // Save
      if (mw) {
        mw.setAccounts(accounts);
        if (action === 'OUT') mw.setMonthlyData(monthlyData);
      } else {
        const dataToSave = { accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, lastUpdated: new Date().toISOString() };
        localStorage.setItem('mw_data_main', JSON.stringify(dataToSave));
        await syncMyWealthToCloud(dataToSave);
      }

      return `Recorded ${action === 'IN' ? 'Income' : 'Expense'} of RM${transactionAmt} inside ${targetAcc.name} Wallet (${description || 'Uncategorized'}).`;
    }

    // 3. ADD_BUDGET
    if (intent === 'ADD_BUDGET') {
      const { name, amount, category, isFixed } = data;
      const budgetAmt = Number(amount) || 0;

      let monthlyData: MonthlyData = { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) };
      let fixedExpenses: Expense[] = [];
      let accounts: Account[] = [];
      let loans: Loan[] = [];
      let stocks: Stock[] = [];
      let cash = { myr: 0, usd: 0, hkd: 0 };
      let exchangeRate = 4.50;
      let budgetHistory: any[] = [];

      if (mw) {
        monthlyData = { ...mw.monthlyData };
        fixedExpenses = [...mw.fixedExpenses];
      } else {
        const savedMW = localStorage.getItem('mw_data_main');
        if (savedMW) {
          const parsed = JSON.parse(savedMW);
          accounts = parsed.accounts || [];
          monthlyData = parsed.monthlyData || monthlyData;
          fixedExpenses = parsed.fixedExpenses || [];
          loans = parsed.loans || [];
          stocks = parsed.stocks || [];
          cash = parsed.cash || cash;
          exchangeRate = parsed.exchangeRate || exchangeRate;
          budgetHistory = parsed.budgetHistory || [];
        }
      }

      const newExpense = {
        id: Date.now().toString(),
        name: name || 'Budget Allocation',
        amount: budgetAmt,
        category: category || 'Other',
        isFixed: !!isFixed
      };

      if (isFixed) {
        fixedExpenses = [newExpense, ...fixedExpenses];
      } else {
        monthlyData.expenses = [newExpense, ...monthlyData.expenses];
      }

      if (mw) {
        if (isFixed) mw.setFixedExpenses(fixedExpenses);
        else mw.setMonthlyData(monthlyData);
      } else {
        const dataToSave = { accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, lastUpdated: new Date().toISOString() };
        localStorage.setItem('mw_data_main', JSON.stringify(dataToSave));
        await syncMyWealthToCloud(dataToSave);
      }

      return `Added ${isFixed ? 'Fixed' : 'Variable'} budget allocation: ${name} (RM${budgetAmt}) under ${category || 'Other'}.`;
    }

    // 4. ADD_LOAN
    if (intent === 'ADD_LOAN') {
      const { name, totalAmount, monthlyPayment } = data;
      const total = Number(totalAmount) || 0;
      const pay = Number(monthlyPayment) || 0;

      let loans: Loan[] = [];
      let accounts: Account[] = [];
      let monthlyData: MonthlyData = { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) };
      let fixedExpenses: Expense[] = [];
      let stocks: Stock[] = [];
      let cash = { myr: 0, usd: 0, hkd: 0 };
      let exchangeRate = 4.50;
      let budgetHistory: any[] = [];

      if (mw) {
        loans = [...mw.loans];
      } else {
        const savedMW = localStorage.getItem('mw_data_main');
        if (savedMW) {
          const parsed = JSON.parse(savedMW);
          accounts = parsed.accounts || [];
          monthlyData = parsed.monthlyData || monthlyData;
          fixedExpenses = parsed.fixedExpenses || [];
          loans = parsed.loans || [];
          stocks = parsed.stocks || [];
          cash = parsed.cash || cash;
          exchangeRate = parsed.exchangeRate || exchangeRate;
          budgetHistory = parsed.budgetHistory || [];
        }
      }

      const newLoan = {
        id: Date.now().toString(),
        name: name || 'New Loan',
        totalAmount: total,
        monthlyPayment: pay,
        remainingAmount: total,
        remainingMonths: pay > 0 ? Math.ceil(total / pay) : 0
      };

      loans = [newLoan, ...loans];

      if (mw) {
        mw.setLoans(loans);
      } else {
        const dataToSave = { accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, lastUpdated: new Date().toISOString() };
        localStorage.setItem('mw_data_main', JSON.stringify(dataToSave));
        await syncMyWealthToCloud(dataToSave);
      }

      return `Added loan: ${name} (Principal: RM${total}).`;
    }

    // 5. REPAY_LOAN
    if (intent === 'REPAY_LOAN') {
      const { loanName, amount, accountName } = data;
      const repayAmt = Number(amount) || 0;

      let loans: Loan[] = [];
      let accounts: Account[] = [];
      let monthlyData: MonthlyData = { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) };
      let fixedExpenses: Expense[] = [];
      let stocks: Stock[] = [];
      let cash = { myr: 0, usd: 0, hkd: 0 };
      let exchangeRate = 4.50;
      let budgetHistory: any[] = [];

      if (mw) {
        loans = [...mw.loans];
        accounts = [...mw.accounts];
        monthlyData = { ...mw.monthlyData };
      } else {
        const savedMW = localStorage.getItem('mw_data_main');
        if (savedMW) {
          const parsed = JSON.parse(savedMW);
          accounts = parsed.accounts || [];
          monthlyData = parsed.monthlyData || monthlyData;
          fixedExpenses = parsed.fixedExpenses || [];
          loans = parsed.loans || [];
          stocks = parsed.stocks || [];
          cash = parsed.cash || cash;
          exchangeRate = parsed.exchangeRate || exchangeRate;
          budgetHistory = parsed.budgetHistory || [];
        }
      }

      const loan = loans.find(l => l.name.toLowerCase().includes(loanName?.toLowerCase() || ''));
      if (!loan) return `I couldn't find a loan named "${loanName}".`;

      loan.remainingAmount = Math.max(0, loan.remainingAmount - repayAmt);
      loan.remainingMonths = loan.monthlyPayment > 0 ? Math.ceil(loan.remainingAmount / loan.monthlyPayment) : 0;

      // Add OUT transaction to wallet
      let targetAcc = accounts.find(a => a.name.toLowerCase().includes(accountName?.toLowerCase() || ''));
      if (!targetAcc && accounts.length > 0) targetAcc = accounts[0];
      if (targetAcc) {
        targetAcc.balance -= repayAmt;
        const newTx = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          type: 'OUT' as const,
          amount: repayAmt,
          description: `Repayment for ${loan.name}`
        };
        targetAcc.history = [newTx, ...targetAcc.history];
      }

      // Add to variable expenses
      const repaymentExpense = {
        id: Date.now().toString(),
        name: `Repayment: ${loan.name}`,
        amount: repayAmt,
        category: 'Loan',
        isFixed: false
      };
      monthlyData.expenses = [repaymentExpense, ...monthlyData.expenses];

      if (mw) {
        mw.setLoans(loans);
        mw.setAccounts(accounts);
        mw.setMonthlyData(monthlyData);
      } else {
        const dataToSave = { accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, lastUpdated: new Date().toISOString() };
        localStorage.setItem('mw_data_main', JSON.stringify(dataToSave));
        await syncMyWealthToCloud(dataToSave);
      }

      return `Recorded RM${repayAmt} repayment for ${loan.name}. Remaining Balance: RM${loan.remainingAmount}.`;
    }

    // 6. BUY_STOCK / SELL_STOCK
    if (intent === 'BUY_STOCK' || intent === 'SELL_STOCK') {
      const { symbol, name, quantity, price, currency } = data;
      const qty = Number(quantity) || 0;
      const prc = Number(price) || 0;
      const curr = currency || 'MYR';

      let stocks: Stock[] = [];
      let cash = { myr: 0, usd: 0, hkd: 0 };
      let accounts: Account[] = [];
      let monthlyData: MonthlyData = { income: 0, expenses: [], targetDate: new Date().toISOString().slice(0, 7) };
      let fixedExpenses: Expense[] = [];
      let loans: Loan[] = [];
      let exchangeRate = 4.50;
      let budgetHistory: any[] = [];

      if (mw) {
        stocks = [...mw.stocks];
        cash = { ...mw.cash };
      } else {
        const savedMW = localStorage.getItem('mw_data_main');
        if (savedMW) {
          const parsed = JSON.parse(savedMW);
          accounts = parsed.accounts || [];
          monthlyData = parsed.monthlyData || monthlyData;
          fixedExpenses = parsed.fixedExpenses || [];
          loans = parsed.loans || [];
          stocks = parsed.stocks || [];
          cash = parsed.cash || cash;
          exchangeRate = parsed.exchangeRate || exchangeRate;
          budgetHistory = parsed.budgetHistory || [];
        }
      }

      const ticker = symbol?.toUpperCase() || '';
      let existingStock = stocks.find(s => s.symbol === ticker);

      if (intent === 'BUY_STOCK') {
        const totalCost = qty * prc;
        if (curr === 'USD') cash.usd -= totalCost;
        else cash.myr -= totalCost;

        if (existingStock) {
          const totalOld = existingStock.quantity * existingStock.buyPrice;
          const totalNew = qty * prc;
          existingStock.quantity += qty;
          existingStock.buyPrice = (totalOld + totalNew) / existingStock.quantity;
          existingStock.currentPrice = prc;
        } else {
          stocks.push({
            id: Date.now().toString(),
            symbol: ticker,
            name: name || ticker,
            buyPrice: prc,
            currentPrice: prc,
            quantity: qty,
            currency: curr as any
          });
        }
      } else {
        // SELL
        if (!existingStock) return `You don't own stock ${ticker}.`;
        if (existingStock.quantity < qty) return `Insufficient shares. You only own ${existingStock.quantity} shares of ${ticker}.`;

        const totalProceeds = qty * prc;
        if (curr === 'USD') cash.usd += totalProceeds;
        else cash.myr += totalProceeds;

        existingStock.quantity -= qty;
        existingStock.currentPrice = prc;

        if (existingStock.quantity <= 0) {
          stocks = stocks.filter(s => s.symbol !== ticker);
        }
      }

      if (mw) {
        mw.setStocks(stocks);
        mw.setCash(cash);
      } else {
        const dataToSave = { accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, lastUpdated: new Date().toISOString() };
        localStorage.setItem('mw_data_main', JSON.stringify(dataToSave));
        await syncMyWealthToCloud(dataToSave);
      }

      return `${intent === 'BUY_STOCK' ? 'Bought' : 'Sold'} ${qty} shares of ${ticker} at $${prc}. Adjusted Cash Balance: ${curr === 'USD' ? 'USD ' + cash.usd : 'MYR ' + cash.myr}.`;
    }

    // 7. CREATE_NOTE
    if (intent === 'CREATE_NOTE') {
      const { title, content, category } = data;
      let notes: any[] = [];
      let todos: any[] = [];

      if (gn) {
        notes = [...gn.notes];
        todos = [...gn.todos];
      } else {
        notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
        todos = JSON.parse(localStorage.getItem('gn_todos') || '[]');
      }

      const newNote = {
        id: Date.now().toString(),
        title: title || 'New Note',
        content: content || '',
        date: new Date().toISOString(),
        ai_category: category || 'General',
        ai_processed: true,
        ai_summary: (content || '').slice(0, 100),
        ai_keywords: [category || 'General']
      };

      notes = [newNote, ...notes];

      if (gn) {
        gn.setNotes(notes);
      } else {
        localStorage.setItem('gn_notes', JSON.stringify(notes));
        localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date().toISOString() }));
        await syncGetNoteToCloud(notes, todos);
      }

      return `Created Note: "${newNote.title}" under category "${newNote.ai_category}".`;
    }

    // 8. CREATE_TODO
    if (intent === 'CREATE_TODO') {
      const { title, priority, deadline } = data;
      let notes: any[] = [];
      let todos: any[] = [];

      if (gn) {
        notes = [...gn.notes];
        todos = [...gn.todos];
      } else {
        notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
        todos = JSON.parse(localStorage.getItem('gn_todos') || '[]');
      }

      const newTodo = {
        id: Date.now().toString(),
        title: title || 'New Task',
        priority: priority || 'T3',
        deadline: deadline || undefined,
        completed: false
      };

      todos = [newTodo, ...todos];

      if (gn) {
        gn.setTodos(todos);
      } else {
        localStorage.setItem('gn_todos', JSON.stringify(todos));
        localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date().toISOString() }));
        await syncGetNoteToCloud(notes, todos);
      }

      return `Created Task: "${newTodo.title}" (Priority: ${newTodo.priority}).`;
    }

    // 9. UPDATE_TODO
    if (intent === 'UPDATE_TODO') {
      const { todoTitle, completed } = data;
      let notes: any[] = [];
      let todos: any[] = [];

      if (gn) {
        notes = [...gn.notes];
        todos = [...gn.todos];
      } else {
        notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
        todos = JSON.parse(localStorage.getItem('gn_todos') || '[]');
      }

      const targetTask = todos.find(t => t.title.toLowerCase().includes(todoTitle?.toLowerCase() || ''));
      if (!targetTask) return `I couldn't find a task named "${todoTitle}".`;

      targetTask.completed = completed;
      targetTask.completedAt = completed ? new Date().toISOString() : undefined;

      if (gn) {
        gn.setTodos([...todos]);
      } else {
        localStorage.setItem('gn_todos', JSON.stringify(todos));
        localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date().toISOString() }));
        await syncGetNoteToCloud(notes, todos);
      }

      return `Updated Task: "${targetTask.title}" marked as ${completed ? 'Completed' : 'Pending'}.`;
    }

    // 10. DELETE_NOTE
    if (intent === 'DELETE_NOTE') {
      const { id, title } = data;
      let notes: any[] = [];
      let todos: any[] = [];

      if (gn) {
        notes = [...gn.notes];
        todos = [...gn.todos];
      } else {
        notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
        todos = JSON.parse(localStorage.getItem('gn_todos') || '[]');
      }

      const beforeLen = notes.length;
      notes = notes.filter(n => n.id !== id && n.title.toLowerCase() !== title?.toLowerCase());
      
      if (notes.length === beforeLen) return `I couldn't find any note matching ID "${id}" or title "${title}".`;

      if (gn) {
        gn.setNotes(notes);
      } else {
        localStorage.setItem('gn_notes', JSON.stringify(notes));
        localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date().toISOString() }));
        await syncGetNoteToCloud(notes, todos);
      }

      return `Deleted note: "${title || id}".`;
    }

    // 11. DELETE_TODO
    if (intent === 'DELETE_TODO') {
      const { id, title } = data;
      let notes: any[] = [];
      let todos: any[] = [];

      if (gn) {
        notes = [...gn.notes];
        todos = [...gn.todos];
      } else {
        notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
        todos = JSON.parse(localStorage.getItem('gn_todos') || '[]');
      }

      const beforeLen = todos.length;
      todos = todos.filter(t => t.id !== id && t.title.toLowerCase() !== title?.toLowerCase());

      if (todos.length === beforeLen) return `I couldn't find any task matching ID "${id}" or title "${title}".`;

      if (gn) {
        gn.setTodos(todos);
      } else {
        localStorage.setItem('gn_todos', JSON.stringify(todos));
        localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date().toISOString() }));
        await syncGetNoteToCloud(notes, todos);
      }

      return `Deleted task: "${title || id}".`;
    }

    return `Action not executed. Intent not recognized.`;
  };

  const handleSend = async (text: string = inputText) => {
    if (!text.trim() || isProcessing) return;

    // Add user message
    const userMsgId = Date.now().toString();
    const userMsg: Message = { id: userMsgId, role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    const apiKey = localStorage.getItem('app_global_api_key');
    const provider = (localStorage.getItem('app_global_ai_provider') as any) || 'google';
    const model = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';

    if (!apiKey) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "⚠️ Config Error: Please set your AI API Key in Settings (click this warning or the gear icon on launcher) to use Ask Apptify.",
        isError: true
      }]);
      setIsProcessing(false);
      return;
    }

    // Read context
    const mw = (window as any).__apptify_mywealth;
    const gn = (window as any).__apptify_getnote;
    
    const contextInfo = `
    CURRENT STATE & CONTEXT:
    Active Module: ${currentApp}
    Active Sub-tab: ${currentApp === 'mywealth' && mw ? mw.activeTab : currentApp === 'getnote' && gn ? gn.activeTab : 'None'}
    
    EXISITING DATABASE:
    My Wealth Wallets: ${mw ? JSON.stringify(mw.accounts.map((a: any) => ({ name: a.name, balance: a.balance }))) : localStorage.getItem('mw_data_main') || '[]'}
    My Wealth Stocks: ${mw ? JSON.stringify(mw.stocks.map((s: any) => s.symbol)) : '[]'}
    GetNote Todos: ${gn ? JSON.stringify(gn.todos.filter((t: any) => !t.completed).map((t: any) => t.title)) : '[]'}
    GetNote Notes: ${gn ? JSON.stringify(gn.notes.map((n: any) => ({ id: n.id, title: n.title }))) : '[]'}
    `;

    const systemInstruction = `
    You are "Ask Apptify", the system-wide intelligent command layer and Personal Operating System assistant for the Apptify platform.
    Your focus is execution first, chat second. Parse instructions into structural actions.

    Respond ONLY with a valid JSON matching this schema:
    {
      "intent": "NAVIGATE" | "ADD_TRANSACTION" | "ADD_BUDGET" | "ADD_LOAN" | "REPAY_LOAN" | "BUY_STOCK" | "SELL_STOCK" | "CREATE_NOTE" | "CREATE_TODO" | "UPDATE_TODO" | "DELETE_NOTE" | "DELETE_TODO" | "ANALYZE_STOCK" | "SEARCH_NEWS" | "CHAT",
      "data": { ... },
      "confirmationRequired": boolean,
      "confirmationMessage": "Description of destructive action requiring user consent",
      "message": "Assistant conversational response"
    }

    CRITICAL RULES:
    1. If the user wants to delete records, overwrite records, or make bulk changes (e.g., "delete note X", "delete task Y", "delete all notes"), you MUST set "confirmationRequired" to true and write a clear, descriptive "confirmationMessage".
    2. Do NOT output markdown formatting (no \`\`\`json). Return only the JSON object.
    
    --- CONTEXT ---
    ${contextInfo}
    `;

    try {
      const responseText = await aiService.generate(provider, model, apiKey, text, systemInstruction);
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const action = JSON.parse(cleanJson);

      // Check for Confirmation Required
      if (action.confirmationRequired) {
        const confirmMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: action.confirmationMessage || "Do you confirm this action?",
          pendingAction: {
            intent: action.intent,
            data: action.data,
            message: action.confirmationMessage
          }
        };
        setPendingConfirm(confirmMsg.pendingAction || null);
        setMessages(prev => [...prev, confirmMsg]);
        setIsProcessing(false);
        return;
      }

      // Handle custom routes: ANALYZE_STOCK
      if (action.intent === 'ANALYZE_STOCK') {
        const symbol = action.data.symbol?.toUpperCase();
        if (!symbol) throw new Error("Stock symbol missing.");

        const stockData = await stockService.getDetailedQuote(symbol);
        const promptTemplate = await investSkillService.readPrompt('stock-eval');

        const financials = (stockData.valuationFields || {}) as any;
        const revenueBillions = financials.revenueTtm ? (financials.revenueTtm / 1e9).toFixed(3) + 'B' : 'N/A';
        const netIncomeBillions = financials.netIncomeTtm ? (financials.netIncomeTtm / 1e9).toFixed(3) + 'B' : 'N/A';
        const fcfBillions = financials.obsFreeCashFlowTtm ? (financials.obsFreeCashFlowTtm / 1e9).toFixed(3) + 'B' : 'N/A';
        const cashBillions = financials.cashAndEquivalents ? (financials.cashAndEquivalents / 1e9).toFixed(3) + 'B' : 'N/A';
        const debtBillions = financials.totalDebt ? (financials.totalDebt / 1e9).toFixed(3) + 'B' : 'N/A';
        const marketCapBillions = stockData.marketCap ? (stockData.marketCap / 1e9).toFixed(3) + 'B' : 'N/A';

        const financialContext = `
Ticker: ${stockData.symbol}
Current Price: $${stockData.price}
Market Cap: $${marketCapBillions}
TTM Revenue: $${revenueBillions}
TTM Net Income: $${netIncomeBillions}
TTM Free Cash Flow: $${fcfBillions}
Cash & Equivalents: $${cashBillions}
Total Debt: $${debtBillions}
Volume Signal: ${stockData.volumeSignal}
`;

        const autoCountInstruction = `
You are an equity research assistant. Adhere strictly to stock valuation instructions.
At the very end of your response, you MUST include this INVESTMENT SIGNAL block exactly:
╔══════════════════════════════════════════════╗
║              INVESTMENT SIGNAL               ║
╠══════════════════════════════════════════════╣
║ Signal:      BULLISH / NEUTRAL / BEARISH     ║
║ Confidence:  HIGH / MEDIUM / LOW             ║
║ Horizon:     SHORT / MEDIUM / LONG-TERM      ║
║ Score:       X.X / 10                        ║
╠══════════════════════════════════════════════╣
║ Action:      BUY / HOLD / SELL               ║
║ Conviction:  STRONG / MODERATE / WEAK        ║
╚══════════════════════════════════════════════╝
`;
        const analysisPrompt = `
Selected framework:
${promptTemplate}

Financial stats:
${financialContext}
`;
        const reportResponse = await aiService.generate(provider, model, apiKey, analysisPrompt, autoCountInstruction);
        const parsedSignal = investSkillService.parseInvestmentSignal(reportResponse);

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Stock analysis completed for ${symbol}. Here is the summary:`,
          stockAnalysis: {
            symbol,
            signal: parsedSignal,
            report: reportResponse
          }
        }]);
        setIsProcessing(false);
        return;
      }

      // Handle custom routes: SEARCH_NEWS
      if (action.intent === 'SEARCH_NEWS') {
        const query = action.data.query || 'AI';
        const newsResponse = await fetch('/api/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'rss', url: 'https://wired.com/feed/tag/ai/latest/rss' })
        });
        const newsData = await newsResponse.json();
        
        const summaryPrompt = `
        Summarize the following latest news articles for the topic "${query}". Focus on technology trends. Provide 3-4 bullet points.
        
        Articles:
        ${JSON.stringify(newsData.slice(0, 8))}
        `;
        const newsSummary = await aiService.generate(provider, model, apiKey, summaryPrompt);

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Here is the tech news summary for **${query}**:\n\n${newsSummary}`
        }]);
        setIsProcessing(false);
        return;
      }

      // Execute Action
      const confirmText = await executeAction(action.intent, action.data);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `${action.message || 'Action executed successfully.'}\n\n*System Update: ${confirmText}*`
      }]);

    } catch (e: any) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error executing command: ${e.message}`,
        isError: true
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAction = async (confirm: boolean) => {
    if (!pendingConfirm) return;
    
    setIsProcessing(true);
    const action = pendingConfirm;
    setPendingConfirm(null);

    // Remove buttons from message bubble by setting pendingAction to undefined
    setMessages(prev => prev.map(m => m.pendingAction ? { ...m, pendingAction: undefined } : m));

    if (confirm) {
      try {
        const confirmText = await executeAction(action.intent, action.data);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ Action Confirmed.\n\n*System Update: ${confirmText}*`
        }]);
      } catch (err: any) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `❌ Error executing confirmed action: ${err.message}`,
          isError: true
        }]);
      }
    } else {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ Action Cancelled.`
      }]);
    }
    setIsProcessing(false);
  };

  const handleExportHtml = async (symbol: string, report: string, signal: InvestmentSignal) => {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `${symbol}_InvestReport_stock-eval_${dateStr}.html`;
      const scoreColor = signal.signal === 'BULLISH' ? '#319795' : (signal.signal === 'BEARISH' ? '#E53E3E' : '#D69E2E');
      
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${symbol} - InvestReport</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body { background-color: #E0E5EC; color: #4A4A4A; font-family: 'Inter', sans-serif; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
        .container { max-width: 900px; width: 100%; background: #E0E5EC; padding: 40px; border-radius: 40px; box-shadow: 9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5); }
        h1 { color: #2D3748; font-size: 32px; font-weight: 700; text-align: center; margin-bottom: 30px; }
        .signal-grid { display: grid; grid-template-cols: repeat(auto-fit, minmax(130px, 1fr)); gap: 15px; margin-bottom: 40px; }
        .signal-card { background: #E0E5EC; padding: 15px; border-radius: 20px; text-align: center; box-shadow: inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff; }
        .signal-val { font-size: 18px; font-weight: 700; margin-top: 5px; color: #2D3748; }
        .signal-label { font-size: 10px; font-weight: 600; color: #718096; text-transform: uppercase; }
        .score-card { border: 2px solid ${scoreColor}; }
        .score-val { font-size: 28px; font-weight: 800; color: ${scoreColor}; }
        .report-content { line-height: 1.8; font-size: 15px; color: #2D3748; border-top: 2px solid rgba(0,0,0,0.05); padding-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${symbol} Ask Apptify InvestReport</h1>
        <div class="signal-grid">
            <div class="signal-card score-card">
                <div class="signal-label">Overall Score</div>
                <div class="score-val">${signal.score.toFixed(1)}/10</div>
            </div>
            <div class="signal-card">
                <div class="signal-label">Signal</div>
                <div class="signal-val" style="color: ${scoreColor}">${signal.signal}</div>
            </div>
            <div class="signal-card">
                <div class="signal-label">Action</div>
                <div class="signal-val">${signal.action}</div>
            </div>
            <div class="signal-card">
                <div class="signal-label">Conviction</div>
                <div class="signal-val">${signal.conviction}</div>
            </div>
        </div>
        <div class="report-content">
            ${report
              .replace(/\n\n/g, '</p><p>')
              .replace(/### (.*)/g, '<h3>$1</h3>')
              .replace(/## (.*)/g, '<h2>$1</h2>')
              .replace(/^- (.*)/gm, '<li>$1</li>')
            }
        </div>
    </div>
</body>
</html>
`;
      const path = await investSkillService.saveReport(fileName, htmlContent);
      alert(`Report exported successfully to:\n${path}`);
    } catch (e: any) {
      alert("Failed to export: " + e.message);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-4 rounded-[26px] bg-[#E0E5EC] text-gray-700 font-bold transition-all duration-300 hover:scale-105 active:scale-95 group shadow-clay-btn hover:text-blue-600 border border-white/40"
      >
        <div className="relative w-6 h-6 flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md transition-transform group-hover:rotate-12 duration-300">
          <span className="absolute w-full h-full rounded-full bg-blue-400 animate-ping opacity-20"></span>
          <Sparkles size={13} className="fill-white" />
        </div>
        <span className="text-sm tracking-tight text-gray-800 font-bold">Ask Apptify</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Dark blur overlay */}
      <div 
        className="absolute inset-0 bg-black/10 backdrop-blur-sm transition-opacity duration-300" 
        onClick={() => setIsOpen(false)}
      />

      {/* Floating Neumorphic Panel */}
      <div 
        className="w-full max-w-[450px] bg-[#E0E5EC] h-full shadow-2xl relative flex flex-col border-l border-white/40 animate-slide-in-right"
        style={{
          boxShadow: "-10px 0 30px rgba(163,177,198,0.2)"
        }}
      >
        {/* Header */}
        <div 
          className="p-5 pt-6 sticky top-0 flex justify-between items-center z-10"
          style={{ 
            background: "#E0E5EC", 
            borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.02)"
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-clay-btn border border-white/20">
              <Sparkles size={18} className="fill-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-1.5 leading-none">
                Ask Apptify
              </h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Universal Command Layer
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-10 h-10 flex items-center justify-center rounded-2xl text-gray-500 hover:text-red-500 hover:scale-105 active:scale-95 transition-all shadow-clay-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar bg-[#E0E5EC]">
          {messages.map((msg, i) => (
            <div key={msg.id || i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`p-5 rounded-[24px] max-w-[85%] text-sm leading-relaxed border ${
                  msg.role === 'user' 
                    ? 'bg-[#E0E5EC] text-gray-800 rounded-tr-md border-white/20 shadow-clay-inner' 
                    : msg.isError 
                      ? 'bg-rose-50 border-rose-200 text-rose-700 rounded-tl-md shadow-clay-btn'
                      : 'bg-[#E0E5EC] text-gray-800 rounded-tl-md border-white/30 shadow-clay-btn'
                }`}
              >
                <div className="whitespace-pre-wrap font-medium">{msg.content}</div>

                {/* Stock Analysis Card Widget */}
                {msg.stockAnalysis && (
                  <div className="mt-4 p-4 rounded-2xl bg-[#E0E5EC] shadow-clay-inner border border-white/40 space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-300/40 pb-2">
                      <span className="font-extrabold text-blue-600 text-lg">{msg.stockAnalysis.symbol} Signal</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold text-white ${
                        msg.stockAnalysis.signal.signal === 'BULLISH' ? 'bg-teal-500' : msg.stockAnalysis.signal.signal === 'BEARISH' ? 'bg-rose-500' : 'bg-amber-500'
                      }`}>
                        {msg.stockAnalysis.signal.signal}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold text-gray-600">
                      <div className="p-2 rounded-xl bg-[#E0E5EC] shadow-clay-btn">
                        <p className="text-[9px] text-gray-400 uppercase">Score</p>
                        <p className="text-base text-gray-800 mt-0.5">{msg.stockAnalysis.signal.score.toFixed(1)}/10</p>
                      </div>
                      <div className="p-2 rounded-xl bg-[#E0E5EC] shadow-clay-btn">
                        <p className="text-[9px] text-gray-400 uppercase">Action</p>
                        <p className="text-base text-gray-800 mt-0.5">{msg.stockAnalysis.signal.action}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-[#E0E5EC] shadow-clay-btn">
                        <p className="text-[9px] text-gray-400 uppercase">Conviction</p>
                        <p className="text-base text-gray-800 mt-0.5">{msg.stockAnalysis.signal.conviction}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-[#E0E5EC] shadow-clay-btn">
                        <p className="text-[9px] text-gray-400 uppercase">Confidence</p>
                        <p className="text-base text-gray-800 mt-0.5">{msg.stockAnalysis.signal.confidence}</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleExportHtml(msg.stockAnalysis!.symbol, msg.stockAnalysis!.report, msg.stockAnalysis!.signal)}
                      className="w-full py-2.5 rounded-xl bg-blue-500 text-white font-bold text-xs hover:bg-blue-600 transition shadow-md flex items-center justify-center gap-1.5"
                    >
                      <FileText size={14} /> Export HTML Research Report
                    </button>
                  </div>
                )}

                {/* Pending Confirmation Buttons */}
                {msg.pendingAction && (
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => handleConfirmAction(true)}
                      className="flex-1 py-2 rounded-xl bg-teal-500 text-white font-bold text-xs hover:bg-teal-600 transition flex items-center justify-center gap-1"
                    >
                      <Check size={14} /> Confirm
                    </button>
                    <button
                      onClick={() => handleConfirmAction(false)}
                      className="flex-1 py-2 rounded-xl bg-gray-400 text-white font-bold text-xs hover:bg-gray-500 transition flex items-center justify-center gap-1"
                    >
                      <X size={14} /> Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start w-full">
              <div className="bg-[#E0E5EC] p-5 rounded-[24px] rounded-tl-none shadow-clay-btn flex items-center gap-2 border border-white/40">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Dock */}
        <div 
          className="p-5 bg-[#E0E5EC]"
          style={{ borderTop: "1px solid rgba(0, 0, 0, 0.05)" }}
        >
          <div className="relative flex items-center gap-2">
            <button
              onClick={toggleListening}
              className={`p-3.5 rounded-2xl transition-all shadow-clay-btn ${
                isListening 
                  ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/30' 
                  : 'bg-[#E0E5EC] text-gray-500 hover:text-blue-500'
              }`}
            >
              <Mic size={20} />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Record RM100, add task, analyze NVDA..."
              className="flex-1 p-3.5 bg-[#E0E5EC] rounded-2xl outline-none font-bold text-sm text-gray-700 placeholder-gray-400/80 shadow-clay-inner border border-white/10 focus:ring-2 focus:ring-blue-500/10 transition-all"
              disabled={isProcessing}
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isProcessing}
              className="p-3.5 rounded-2xl text-white bg-gray-800 disabled:bg-gray-300 disabled:opacity-50 transition-all shadow-clay-btn"
            >
              <Send size={18} />
            </button>
          </div>
          {isListening && <p className="text-[10px] text-center text-rose-500 font-extrabold uppercase mt-2 animate-pulse tracking-wider">Voice Listener Active...</p>}
        </div>
      </div>
    </div>
  );
};

export default AskApptify;
