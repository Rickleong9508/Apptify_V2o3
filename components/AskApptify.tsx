import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Mic, Send, X, ChevronRight, Check, AlertTriangle, Play, RefreshCw, BarChart2, FileText, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabase } from '../services/supabaseClient';
import { aiService } from '../services/aiService';
import { stockService } from '../services/stockService';
import { investSkillService, InvestmentSignal } from '../services/investSkillService';
import { Account, Expense, Loan, Stock, MonthlyData } from '../types';
import { skillRegistry } from '../services/skillRegistry';
import { videoSummarySkillService } from '../services/videoSummarySkillService';

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

const validateWalletOperation = (intent: string, data: any, accounts: Account[]): ValidationResult => {
  if (!data) {
    return { isValid: false, error: "No parameters were provided for the wallet operation." };
  }

  // 1. Verify amount is valid
  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0) {
    return { isValid: false, error: `Invalid amount "${data.amount}". Amount must be a positive number.` };
  }

  // Helper to find wallet by name (case-insensitive, match or contains)
  const findWallet = (name: string) => {
    if (!name) return null;
    return accounts.find(a => a.name.toLowerCase() === name.toLowerCase() || a.name.toLowerCase().includes(name.toLowerCase()));
  };

  // 2. Verify wallets exist
  if (intent === 'ADD_MONEY' || intent === 'WITHDRAW_MONEY') {
    const walletName = data.walletName || data.accountName;
    if (!walletName) {
      return { isValid: false, error: "No wallet name was specified in the request." };
    }
    const wallet = findWallet(walletName);
    if (!wallet) {
      return { isValid: false, error: `Wallet "${walletName}" does not exist. Available wallets: ${accounts.map(a => a.name).join(', ')}.` };
    }
  } else if (intent === 'TRANSFER_MONEY') {
    const sourceName = data.sourceWallet || data.sourceAccount;
    const destName = data.destinationWallet || data.destinationAccount;

    if (!sourceName) {
      return { isValid: false, error: "Source wallet was not specified for the transfer." };
    }
    if (!destName) {
      return { isValid: false, error: "Destination wallet was not specified for the transfer." };
    }

    const sourceWallet = findWallet(sourceName);
    const destWallet = findWallet(destName);

    if (!sourceWallet) {
      return { isValid: false, error: `Source wallet "${sourceName}" does not exist. Available wallets: ${accounts.map(a => a.name).join(', ')}.` };
    }
    if (!destWallet) {
      return { isValid: false, error: `Destination wallet "${destName}" does not exist. Available wallets: ${accounts.map(a => a.name).join(', ')}.` };
    }
  }

  return { isValid: true };
};

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
  videoSummary?: {
    url: string;
    title: string;
    markdown: string;
  };
  pendingAction?: {
    intent: string;
    data: any;
    message: string;
  };
}

interface VideoSummaryWidgetProps {
  summary: {
    url: string;
    title: string;
    markdown: string;
  };
  onSaveSuccess: (msg: string) => void;
  onSaveError: (msg: string) => void;
}

const VideoSummaryWidget: React.FC<VideoSummaryWidgetProps> = ({ summary, onSaveSuccess, onSaveError }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const kv = (window as any).__apptify_knowledgevault;
  const hasObsidian = !!(kv && kv.vaultPath);

  // Extract excerpt and tags
  const summaryMatch = summary.markdown.match(/## Executive Summary\r?\n([\s\S]+?)(?:\r?\n##|$)/);
  const excerpt = summaryMatch ? summaryMatch[1].trim() : (summary.markdown.slice(0, 200) + '...');
  
  const tagsMatch = summary.markdown.match(/Tags:\r?\n([^\r\n]+)/i);
  const tags = tagsMatch ? tagsMatch[1].split(/\s+/).map((t: string) => t.trim()).filter(Boolean) : [];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (hasObsidian) {
        // Save to local Obsidian Vault
        await videoSummarySkillService.saveToVault(
          kv.vaultPath,
          summary.title,
          summary.markdown,
          'Video Summary'
        );
        // Reload notes in KnowledgeVault state
        const res = await fetch('/api/obsidian/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vaultPath: kv.vaultPath })
        });
        const data = await res.json();
        if (res.ok && data.notes && kv.setNotes) {
          kv.setNotes(data.notes);
        }
        setSaved(true);
        onSaveSuccess(`Saved video summary "${summary.title}" to Obsidian vault successfully!`);
      } else {
        // Fallback to internal Storage / Supabase
        let notes: any[] = [];
        let todos: any[] = [];

        if (kv) {
          notes = [...kv.notes];
          todos = [...kv.todos];
        } else {
          notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
          todos = JSON.parse(localStorage.getItem('gn_todos') || '[]');
        }

        const exists = notes.some(n => n.title === summary.title);
        if (exists) {
          throw new Error(`A note with the title "${summary.title}" already exists.`);
        }

        const newNote = {
          id: Date.now().toString(),
          title: summary.title,
          content: summary.markdown,
          date: new Date().toISOString(),
          ai_category: 'Video Summary',
          ai_processed: true,
          ai_summary: excerpt.slice(0, 150),
          ai_keywords: tags.map(t => t.replace(/^#/, ''))
        };

        notes = [newNote, ...notes];

        if (kv) {
          kv.setNotes(notes);
        } else {
          localStorage.setItem('gn_notes', JSON.stringify(notes));
          localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date().toISOString() }));
        }
        setSaved(true);
        onSaveSuccess(`Saved video summary "${summary.title}" to local Knowledge Vault!`);
      }
    } catch (err: any) {
      console.error(err);
      onSaveError(err.message || "Failed to save summary.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-2xl bg-[#E0E5EC] shadow-clay-inner border border-white/40 space-y-4">
      <div className="border-b border-gray-300/40 pb-2">
        <p className="font-extrabold text-indigo-600 text-sm">YouTube Summary Widget</p>
        <p className="text-xs text-gray-500 line-clamp-1">{summary.title}</p>
      </div>

      <div className="p-3 rounded-xl bg-[#E0E5EC] shadow-clay-btn text-xs text-gray-700 italic space-y-1">
        <span className="font-extrabold text-gray-500 block uppercase text-[9px]">Excerpt</span>
        <p className="line-clamp-3 leading-relaxed">{excerpt}</p>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, idx) => (
            <span key={idx} className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold">
              {tag}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving || saved}
        className={`w-full py-2.5 rounded-xl text-white font-bold text-xs transition flex items-center justify-center gap-1.5 ${
          saved
            ? 'bg-green-500 shadow-none cursor-default'
            : isSaving
              ? 'bg-indigo-400 cursor-wait'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-md'
        }`}
      >
        {saved ? (
          <>
            <Check size={14} /> Saved to {hasObsidian ? 'Obsidian' : 'Knowledge Vault'}
          </>
        ) : isSaving ? (
          <>
            <RefreshCw size={14} className="animate-spin" /> Saving...
          </>
        ) : (
          <>
            <FileText size={14} /> Save to {hasObsidian ? 'Obsidian Vault' : 'Knowledge Vault'}
          </>
        )}
      </button>
    </div>
  );
};

const buildSystemInstruction = (skills: any[], contextInfo: string) => {
  const intentsList = skills.flatMap(s => Object.keys(s.intents));
  
  let skillsDoc = '';
  skills.forEach(skill => {
    skillsDoc += `### Skill: ${skill.name} (${skill.id})\nDescription: ${skill.description}\n`;
    Object.entries(skill.intents).forEach(([intentName, intentDef]: [string, any]) => {
      skillsDoc += `- **Intent**: ${intentName}\n  Description: ${intentDef.description}\n  Parameters:\n`;
      Object.entries(intentDef.parameters).forEach(([paramName, paramDef]: [string, any]) => {
        skillsDoc += `    * \`${paramName}\` (${paramDef.type}): ${paramDef.description}${paramDef.required ? ' (Required)' : ''}\n`;
      });
      if (intentDef.examples && intentDef.examples.length > 0) {
        skillsDoc += `  Examples:\n`;
        intentDef.examples.forEach((ex: string) => {
          skillsDoc += `    * "${ex}"\n`;
        });
      }
    });
    skillsDoc += `\n`;
  });

  return `You are "Ask Apptify", the system-wide intelligent command layer and Personal Operating System assistant for the Apptify platform.
Your focus is execution first, chat second. Parse instructions into structural actions based on the available skills registry.

Respond ONLY with a valid JSON matching this schema:
{
  "intent": ${intentsList.map(i => `"${i}"`).join(' | ')} | "CHAT",
  "data": { ... },
  "confirmationRequired": boolean,
  "confirmationMessage": "Description of destructive action requiring user consent",
  "message": "Assistant conversational response"
}

### AVAILABLE SKILLS & INTENTS REGISTERED:
${skillsDoc}

CRITICAL RULES:
1. Wallet Action Rules:
   - ADD_MONEY: Use this intent when the user wants to add, deposit, top up, increase, or save money into a specific wallet.
     Do NOT infer transfers or deduct from other wallets. Only increase this wallet.
   - WITHDRAW_MONEY: Use this intent when the user wants to withdraw, take out, spend, deduct, or remove money from a specific wallet.
     Do NOT infer transfers. Only decrease this wallet.
   - TRANSFER_MONEY: Use this intent ONLY when the user explicitly asks to transfer, move, send, or shift money from one wallet to another.
     Never assume/infer transfer actions unless explicitly requested with source and destination.
   
2. Confirmation Rules:
   - You MUST set "confirmationRequired" to true if the user wants to delete records, overwrite records, or make bulk changes (e.g., "delete note X", "delete task Y", "delete all notes").
   - Read, Create, and Update actions do not require confirmation.

3. Do NOT output markdown formatting (no \`\`\`json). Return only the JSON object.

--- CONTEXT ---
${contextInfo}
`;
};

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

  // --- Draggable Floating Button State & Logic ---
  const [position, setPosition] = useState({ x: 0, y: 0 }); // offset from bottom-right
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartCoordsRef = useRef({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartCoordsRef.current = { x: e.clientX, y: e.clientY };
    dragStartOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartCoordsRef.current = { x: touch.clientX, y: touch.clientY };
    dragStartOffsetRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    const distance = Math.sqrt(
      Math.pow(dragStartCoordsRef.current.x - e.clientX, 2) +
      Math.pow(dragStartCoordsRef.current.y - e.clientY, 2)
    );
    if (distance > 5) {
      e.preventDefault();
      return;
    }
    setIsOpen(true);
  };

  useEffect(() => {
    const updatePosition = (clientX: number, clientY: number) => {
      let newX = clientX - dragStartOffsetRef.current.x;
      let newY = clientY - dragStartOffsetRef.current.y;
      
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        const btnWidth = rect.width;
        const btnHeight = rect.height;
        const defaultLeft = window.innerWidth - btnWidth - 24;
        const defaultTop = window.innerHeight - btnHeight - 24;
        
        const targetLeft = defaultLeft + newX;
        const targetTop = defaultTop + newY;
        
        const boundedLeft = Math.max(10, Math.min(window.innerWidth - btnWidth - 10, targetLeft));
        const boundedTop = Math.max(10, Math.min(window.innerHeight - btnHeight - 10, targetTop));
        
        newX = boundedLeft - defaultLeft;
        newY = boundedTop - defaultTop;
      }
      setPosition({ x: newX, y: newY });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      updatePosition(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      updatePosition(touch.clientX, touch.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, position]);

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
    const kv = (window as any).__apptify_knowledgevault;

    // 1. NAVIGATE
    if (intent === 'NAVIGATE') {
      let target = data.target?.toLowerCase() || '';
      if (target === 'getnote' || target === 'notes' || target === 'notebook' || target === 'secondbrain') {
        target = 'knowledgevault';
      }

      const mwTabMap: any = { wallet: 'accounts', budget: 'budget', loan: 'loans', portfolio: 'investments', overview: 'dashboard' };
      const kvTabMap: any = { note: 'notes', notes: 'notes', video: 'video', videosummary: 'video', todo: 'todo', todos: 'todo', task: 'todo', tasks: 'todo', focus: 'focus' };
      
      if (['mywealth', 'knowledgevault', 'settings', 'autocount', 'newshub', 'launcher'].includes(target)) {
        setCurrentApp(target === 'launcher' ? 'launcher' : (target as any));
        return `Navigated to ${data.target}.`;
      } else if (mwTabMap[target]) {
        setCurrentApp('mywealth');
        setTimeout(() => {
          const freshMw = (window as any).__apptify_mywealth;
          if (freshMw) {
            freshMw.setActiveTab(mwTabMap[target]);
          }
        }, 150);
        return `Navigated My Wealth to ${data.target}.`;
      } else if (kvTabMap[target]) {
        setCurrentApp('knowledgevault');
        setTimeout(() => {
          const freshKv = (window as any).__apptify_knowledgevault;
          if (freshKv) {
            freshKv.setActiveTab(kvTabMap[target]);
          }
        }, 150);
        return `Navigated Knowledge Vault to ${data.target}.`;
      }
      return `Target ${data.target} not recognized.`;
    }

    // 2a. ADD_MONEY
    if (intent === 'ADD_MONEY') {
      const { walletName, amount, description } = data;
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

      const targetAcc = accounts.find(a => a.name.toLowerCase() === walletName?.toLowerCase() || a.name.toLowerCase().includes(walletName?.toLowerCase()));
      if (!targetAcc) throw new Error(`Wallet "${walletName}" not found.`);

      const newTx = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type: 'IN' as const,
        amount: transactionAmt,
        description: description || 'Deposit'
      };

      targetAcc.balance += transactionAmt;
      targetAcc.history = [newTx, ...targetAcc.history];

      // Save My Wealth state
      if (mw) {
        mw.setAccounts(accounts);
      } else {
        const dataToSave = { accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, lastUpdated: new Date().toISOString() };
        localStorage.setItem('mw_data_main', JSON.stringify(dataToSave));
        await syncMyWealthToCloud(dataToSave);
      }

      return `Deposited RM${transactionAmt} into ${targetAcc.name} Wallet.`;
    }

    // 2b. WITHDRAW_MONEY
    if (intent === 'WITHDRAW_MONEY') {
      const { walletName, amount, description, category } = data;
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

      const targetAcc = accounts.find(a => a.name.toLowerCase() === walletName?.toLowerCase() || a.name.toLowerCase().includes(walletName?.toLowerCase()));
      if (!targetAcc) throw new Error(`Wallet "${walletName}" not found.`);

      const newTx = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type: 'OUT' as const,
        amount: transactionAmt,
        description: description || 'Withdrawal'
      };

      targetAcc.balance -= transactionAmt;
      targetAcc.history = [newTx, ...targetAcc.history];

      // Cross-Module: Update Budget Planner if expense
      const newExpense = {
        id: (Date.now() + 1).toString(),
        name: description || 'Withdrawal Expense',
        amount: transactionAmt,
        category: category || 'Other',
        isFixed: false
      };
      monthlyData.expenses = [newExpense, ...monthlyData.expenses];

      // Save My Wealth state
      if (mw) {
        mw.setAccounts(accounts);
        mw.setMonthlyData(monthlyData);
      } else {
        const dataToSave = { accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, lastUpdated: new Date().toISOString() };
        localStorage.setItem('mw_data_main', JSON.stringify(dataToSave));
        await syncMyWealthToCloud(dataToSave);
      }

      return `Withdrew RM${transactionAmt} from ${targetAcc.name} Wallet. Recorded as expense.`;
    }

    // 2c. TRANSFER_MONEY
    if (intent === 'TRANSFER_MONEY') {
      const { sourceWallet, destinationWallet, amount, description } = data;
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

      const sourceAcc = accounts.find(a => a.name.toLowerCase() === sourceWallet?.toLowerCase() || a.name.toLowerCase().includes(sourceWallet?.toLowerCase()));
      const destAcc = accounts.find(a => a.name.toLowerCase() === destinationWallet?.toLowerCase() || a.name.toLowerCase().includes(destinationWallet?.toLowerCase()));

      if (!sourceAcc) throw new Error(`Source wallet "${sourceWallet}" not found.`);
      if (!destAcc) throw new Error(`Destination wallet "${destinationWallet}" not found.`);

      const outTx = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type: 'OUT' as const,
        amount: transactionAmt,
        description: description || `Transfer to ${destAcc.name}`
      };

      const inTx = {
        id: (Date.now() + 1).toString(),
        date: new Date().toISOString(),
        type: 'IN' as const,
        amount: transactionAmt,
        description: description || `Transfer from ${sourceAcc.name}`
      };

      sourceAcc.balance -= transactionAmt;
      sourceAcc.history = [outTx, ...sourceAcc.history];

      destAcc.balance += transactionAmt;
      destAcc.history = [inTx, ...destAcc.history];

      // Save My Wealth state
      if (mw) {
        mw.setAccounts(accounts);
      } else {
        const dataToSave = { accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, lastUpdated: new Date().toISOString() };
        localStorage.setItem('mw_data_main', JSON.stringify(dataToSave));
        await syncMyWealthToCloud(dataToSave);
      }

      return `Transferred RM${transactionAmt} from ${sourceAcc.name} to ${destAcc.name}.`;
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
      const { title, content, category, tags } = data;
      let notes: any[] = [];
      let todos: any[] = [];

      if (kv && kv.vaultPath) {
        // Obsidian flow
        const res = await fetch('/api/obsidian/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaultPath: kv.vaultPath,
            title: title || 'New Note',
            content: content || '',
            category: category || 'General',
            keywords: tags || [category || 'General'],
            summary: (content || '').slice(0, 100),
            date: new Date().toISOString()
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create Obsidian note');
        }
        const resData = await res.json();
        if (kv.setNotes) {
          kv.setNotes((prev: any[]) => [resData.note, ...prev]);
        }
        return `Created Obsidian Note: "${resData.note.title}" under category "${resData.note.ai_category}".`;
      } else {
        // Standard flow
        if (kv) {
          notes = [...kv.notes];
          todos = [...kv.todos];
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
          ai_keywords: tags || [category || 'General']
        };

        notes = [newNote, ...notes];

        if (kv) {
          kv.setNotes(notes);
        } else {
          localStorage.setItem('gn_notes', JSON.stringify(notes));
          localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date().toISOString() }));
          await syncGetNoteToCloud(notes, todos);
        }

        return `Created Note: "${newNote.title}" under category "${newNote.ai_category}".`;
      }
    }

    // 8. CREATE_TODO
    if (intent === 'CREATE_TODO') {
      const { title, priority, deadline } = data;
      let notes: any[] = [];
      let todos: any[] = [];

      if (kv) {
        notes = [...kv.notes];
        todos = [...kv.todos];
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

      if (kv) {
        kv.setTodos(todos);
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

      if (kv) {
        notes = [...kv.notes];
        todos = [...kv.todos];
      } else {
        notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
        todos = JSON.parse(localStorage.getItem('gn_todos') || '[]');
      }

      const targetTask = todos.find(t => t.title.toLowerCase().includes(todoTitle?.toLowerCase() || ''));
      if (!targetTask) return `I couldn't find a task named "${todoTitle}".`;

      targetTask.completed = completed;
      targetTask.completedAt = completed ? new Date().toISOString() : undefined;

      if (kv) {
        kv.setTodos([...todos]);
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

      if (kv && kv.vaultPath) {
        // Obsidian flow
        let noteToDelete = kv.notes.find((n: any) => n.id === id || n.title.toLowerCase() === title?.toLowerCase());
        if (!noteToDelete) {
          return `I couldn't find any note matching title "${title || id}".`;
        }
        const res = await fetch('/api/obsidian/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaultPath: kv.vaultPath,
            id: noteToDelete.id
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete Obsidian note');
        }
        if (kv.setNotes) {
          kv.setNotes((prev: any[]) => prev.filter(n => n.id !== noteToDelete.id));
        }
        return `Deleted Obsidian note: "${noteToDelete.title}".`;
      } else {
        // Standard flow
        if (kv) {
          notes = [...kv.notes];
          todos = [...kv.todos];
        } else {
          notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
          todos = JSON.parse(localStorage.getItem('gn_todos') || '[]');
        }

        const beforeLen = notes.length;
        notes = notes.filter(n => n.id !== id && n.title.toLowerCase() !== title?.toLowerCase());
        
        if (notes.length === beforeLen) return `I couldn't find any note matching ID "${id}" or title "${title}".`;

        if (kv) {
          kv.setNotes(notes);
        } else {
          localStorage.setItem('gn_notes', JSON.stringify(notes));
          localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date().toISOString() }));
          await syncGetNoteToCloud(notes, todos);
        }

        return `Deleted note: "${title || id}".`;
      }
    }

    // 11. DELETE_TODO
    if (intent === 'DELETE_TODO') {
      const { id, title } = data;
      let notes: any[] = [];
      let todos: any[] = [];

      if (kv) {
        notes = [...kv.notes];
        todos = [...kv.todos];
      } else {
        notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
        todos = JSON.parse(localStorage.getItem('gn_todos') || '[]');
      }

      const beforeLen = todos.length;
      todos = todos.filter(t => t.id !== id && t.title.toLowerCase() !== title?.toLowerCase());

      if (todos.length === beforeLen) return `I couldn't find any task matching ID "${id}" or title "${title}".`;

      if (kv) {
        kv.setTodos(todos);
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
    const kv = (window as any).__apptify_knowledgevault;
    
    const contextInfo = `
    CURRENT STATE & CONTEXT:
    Active Module: ${currentApp}
    Active Sub-tab: ${currentApp === 'mywealth' && mw ? mw.activeTab : currentApp === 'knowledgevault' && kv ? kv.activeTab : 'None'}
    
    EXISITING DATABASE:
    My Wealth Wallets: ${mw ? JSON.stringify(mw.accounts.map((a: any) => ({ name: a.name, balance: a.balance }))) : localStorage.getItem('mw_data_main') || '[]'}
    My Wealth Stocks: ${mw ? JSON.stringify(mw.stocks.map((s: any) => s.symbol)) : '[]'}
    Knowledge Vault Todos: ${kv ? JSON.stringify(kv.todos.filter((t: any) => !t.completed).map((t: any) => t.title)) : localStorage.getItem('gn_todos') ? JSON.stringify(JSON.parse(localStorage.getItem('gn_todos') || '[]').filter((t: any) => !t.completed).map((t: any) => t.title)) : '[]'}
    Knowledge Vault Notes: ${kv ? JSON.stringify(kv.notes.map((n: any) => ({ id: n.id, title: n.title }))) : localStorage.getItem('gn_notes') ? JSON.stringify(JSON.parse(localStorage.getItem('gn_notes') || '[]').map((n: any) => ({ id: n.id, title: n.title }))) : '[]'}
    `;

    const systemInstruction = buildSystemInstruction(skillRegistry, contextInfo);

    try {
      const responseText = await aiService.generate(provider, model, apiKey, text, systemInstruction);
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const action = JSON.parse(cleanJson);

      // Force confirmation for DELETE/Destructive actions
      const isDeleteAction = ['DELETE_NOTE', 'DELETE_TODO'].includes(action.intent);
      const isDestructive = action.intent?.includes('DELETE') || action.intent?.includes('REMOVE') || action.intent?.includes('CLEAR');
      
      if (isDeleteAction || isDestructive) {
        action.confirmationRequired = true;
        if (!action.confirmationMessage) {
          action.confirmationMessage = `Are you sure you want to perform this destructive action (${action.intent})?`;
        }
      }

      // Read current accounts for validation
      let currentAccounts: Account[] = [];
      if (mw) {
        currentAccounts = [...mw.accounts];
      } else {
        const savedMW = localStorage.getItem('mw_data_main');
        if (savedMW) {
          try {
            currentAccounts = JSON.parse(savedMW).accounts || [];
          } catch {}
        }
      }

      // Mandatory Validation Layer for Wallet Operations
      if (['ADD_MONEY', 'WITHDRAW_MONEY', 'TRANSFER_MONEY'].includes(action.intent)) {
        const validation = validateWalletOperation(action.intent, action.data, currentAccounts);
        if (!validation.isValid) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ **Validation Error:** ${validation.error}\n\nPlease clarify your request.`,
            isError: true
          }]);
          setIsProcessing(false);
          return;
        }
      }

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

      // Handle custom routes: SUMMARIZE_VIDEO
      if (action.intent === 'SUMMARIZE_VIDEO') {
        const url = action.data.url;
        if (!url) throw new Error("YouTube video URL is missing.");

        const summaryResult = await videoSummarySkillService.generateSummary(url, provider, model, apiKey);
        
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Successfully generated summary for YouTube video: **${summaryResult.title}**`,
          videoSummary: {
            url,
            title: summaryResult.title,
            markdown: summaryResult.markdown
          }
        }]);
        setIsProcessing(false);
        return;
      }

      // Handle custom routes: SEARCH_NOTES
      if (action.intent === 'SEARCH_NOTES') {
        const query = action.data.query;
        if (!query) throw new Error("Search query is missing.");

        let notes: any[] = [];
        if (kv) {
          notes = kv.notes;
        } else {
          notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
        }

        if (notes.length === 0) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `You don't have any notes in your Knowledge Vault to search yet.`
          }]);
          setIsProcessing(false);
          return;
        }

        const queryTokens = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 1);
        const scored = notes.map(note => {
          let score = 0;
          const title = (note.title || '').toLowerCase();
          const content = (note.content || '').toLowerCase();
          const category = (note.ai_category || '').toLowerCase();
          const keywords = (note.ai_keywords || []).map((k: string) => k.toLowerCase());

          if (queryTokens.length === 0) {
            if (title.includes(query.toLowerCase())) score += 10;
            if (content.includes(query.toLowerCase())) score += 3;
          } else {
            queryTokens.forEach(token => {
              if (title.includes(token)) score += 10;
              if (category.includes(token)) score += 8;
              keywords.forEach((keyword: string) => {
                if (keyword.includes(token) || token.includes(keyword)) {
                  score += 6;
                }
              });
              if (content.includes(token)) score += 3;
            });
          }
          return { note, score };
        });

        const matchedNotes = scored
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(item => item.note)
          .slice(0, 5);

        if (matchedNotes.length === 0) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `No notes matched the query "${query}" in your vault.`
          }]);
          setIsProcessing(false);
          return;
        }

        let retrievedNotesContext = "";
        matchedNotes.forEach(n => {
          retrievedNotesContext += `Title: ${n.title || 'Untitled'}\n`;
          if (n.ai_category) retrievedNotesContext += `Category: ${n.ai_category}\n`;
          if (n.ai_summary) retrievedNotesContext += `Summary: ${n.ai_summary}\n`;
          if (n.ai_keywords && n.ai_keywords.length > 0) retrievedNotesContext += `Keywords: ${n.ai_keywords.join(', ')}\n`;
          retrievedNotesContext += `Content: ${n.content || '(Empty)'}\n`;
          retrievedNotesContext += `----------------------------------------\n\n`;
        });

        const systemPrompt = `You are an AI Knowledge Assistant.
Analyze the following notes from the user's personal knowledge vault and synthesize a comprehensive answer to their query: "${query}".

If the notes don't contain enough information, explain that.

Format your response in a clear and readable manner. Cite the note titles you used to answer the query.`;

        const userPrompt = `Notes Context:\n${retrievedNotesContext}\n\nUser Question: ${query}`;
        const synthesis = await aiService.generate(provider, model, apiKey, userPrompt, systemPrompt);

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: synthesis
        }]);
        setIsProcessing(false);
        return;
      }

      // Handle custom routes: ANALYZE_STOCK (Orchestrate AutoCount Engine)
      if (action.intent === 'ANALYZE_STOCK') {
        const symbol = action.data.symbol?.toUpperCase();
        if (!symbol) throw new Error("Stock symbol missing.");

        // 1. Route to AutoCount app mode
        setCurrentApp('autocount');

        // 2. Wait for AutoCount to initialize
        const getAutoCount = () => (window as any).__apptify_autocount;
        const waitForAutoCount = () => {
          return new Promise<any>((resolve, reject) => {
            let attempts = 0;
            const interval = setInterval(() => {
              const ac = getAutoCount();
              if (ac) {
                clearInterval(interval);
                resolve(ac);
              } else {
                attempts++;
                if (attempts > 50) {
                  clearInterval(interval);
                  reject(new Error("AutoCount engine failed to initialize."));
                }
              }
            }, 100);
          });
        };

        const autocount = await waitForAutoCount();
        autocount.setSymbol(symbol);

        // 3. Search and Run framework analysis inside AutoCount
        const searchResult = await autocount.handleSearch(symbol);
        const analysisResult = await autocount.handleRunAnalysis(searchResult);

        if (!analysisResult) {
          throw new Error("Analysis failed to run.");
        }

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Stock analysis completed for ${symbol} using AutoCount. Here is the summary:`,
          stockAnalysis: {
            symbol,
            signal: analysisResult.signal,
            report: analysisResult.report
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
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleButtonClick}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          touchAction: 'none',
          boxShadow: isDragging 
            ? "12px 12px 24px rgb(163,177,198,0.8), -12px -12px 24px rgba(255,255,255, 0.7)" 
            : "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
        }}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-4 rounded-[26px] bg-[#E0E5EC] text-gray-700 font-bold transition-all duration-300 ${isDragging ? 'scale-105' : 'hover:scale-105 active:scale-95'} group border border-white/40 select-none cursor-grab active:cursor-grabbing`}
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

                {/* Video Summary Card Widget */}
                {msg.videoSummary && (
                  <VideoSummaryWidget
                    summary={msg.videoSummary}
                    onSaveSuccess={(successMsg) => {
                      setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: `✅ ${successMsg}`
                      }]);
                    }}
                    onSaveError={(errorMsg) => {
                      setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: `❌ ${errorMsg}`,
                        isError: true
                      }]);
                    }}
                  />
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
