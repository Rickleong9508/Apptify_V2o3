import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  NotebookPen, 
  ArrowRight, 
  ArrowUpRight,
  Sparkles, 
  Settings, 
  Cpu, 
  ChevronLeft, 
  ChevronDown, 
  Sun, 
  Moon,
  MessageSquare,
  Bot,
  Globe,
  Calendar,
  CheckSquare,
  Zap,
  TrendingUp,
  Cloud,
  Plus,
  Check,
  Radio,
  Activity,
  SlidersHorizontal,
  Clock
} from 'lucide-react';
import MyWealthApp from './components/MyWealthApp';
import KnowledgeVault from './components/KnowledgeVault';
import GlobalSettings from './components/GlobalSettings';
import NewsHub from './components/NewsHub';
import AuthModal from './components/AuthModal';
import AskApptify from './components/AskApptify';
import { useAuth } from './components/AuthProvider';
import { Language, translations, getStoredLanguage, setStoredLanguage } from './utils/i18n';

type AppMode = 'launcher' | 'mywealth' | 'knowledgevault' | 'settings' | 'newshub';

const getAppFromHash = (): AppMode => {
  if (typeof window === 'undefined') return 'launcher';
  const hash = window.location.hash.replace('#', '') as AppMode;
  const validModes: AppMode[] = ['launcher', 'mywealth', 'knowledgevault', 'settings', 'newshub'];
  return validModes.includes(hash) ? hash : 'launcher';
};

const App: React.FC = () => {
  const { isConnected, user } = useAuth();
  const [currentApp, setCurrentAppState] = useState<AppMode>(getAppFromHash);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Auto-prompt welcome/login modal for new or unauthenticated users (defaults to English, toggleable to Chinese)
  useEffect(() => {
    try {
      const isDismissed = sessionStorage.getItem('apptify_welcome_dismissed');
      if (!isConnected && !isDismissed) {
        const timer = setTimeout(() => {
          setShowAuthModal(true);
        }, 700);
        return () => clearTimeout(timer);
      }
    } catch (e) {}
  }, [isConnected]);

  const setCurrentApp = (mode: AppMode) => {
    setCurrentAppState(mode);
    if (window.location.hash !== `#${mode}`) {
      window.location.hash = mode;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentAppState(getAppFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Global theme state with auto-detection of device preferences
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mw_theme') as 'light' | 'dark' | null;
    if (saved) return saved;
    // Follow phone / OS system preference by default
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  // Listen to phone/system light & dark mode changes automatically
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      // If user hasn't manually overridden with the button, auto-adapt to phone system
      const hasManualOverride = localStorage.getItem('mw_theme_manual');
      if (!hasManualOverride) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      body?.classList.add('dark');
      body?.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      body?.classList.remove('dark');
      body?.classList.add('light');
    }
    localStorage.setItem('mw_theme', theme);
    window.dispatchEvent(new Event('apptify_theme_change'));
  }, [theme]);

  // Language State (Defaults to English, supports Chinese)
  const [lang, setLang] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    const handleLangChange = () => setLang(getStoredLanguage());
    window.addEventListener('apptify_language_change', handleLangChange);
    return () => window.removeEventListener('apptify_language_change', handleLangChange);
  }, []);

  const t = translations[lang];

  // Global settings sync states
  const [activeProvider, setActiveProvider] = useState<string>(() => localStorage.getItem('app_global_ai_provider') || 'google');
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentModels, setRecentModels] = useState<string[]>([]);
  const [modelsList, setModelsList] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const getProviderFromModelId = (modelId: string, currentProvider?: string): string => {
    if (!modelId) return 'google';
    if (modelId.startsWith('gemini-')) return 'google';
    if (modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3-')) return 'openai';
    if (modelId.startsWith('claude-')) return 'anthropic';
    if (modelId.startsWith('deepseek-')) return 'deepseek';
    
    try {
      const sfCache = localStorage.getItem('app_siliconflow_models_cache');
      if (sfCache) {
        const sfModels: any[] = JSON.parse(sfCache);
        if (sfModels.some(m => m.id === modelId)) {
          return 'siliconflow';
        }
      }
    } catch (e) {}

    if (modelId.startsWith('deepseek/') || modelId.startsWith('anthropic/') || modelId.startsWith('openai/') || modelId.startsWith('qwen/') || modelId.startsWith('moonshot/')) {
      return 'openrouter';
    }

    if (modelId.includes('/')) {
      return 'siliconflow';
    }

    return currentProvider || 'google';
  };

  const handleSelectModel = (modelId: string) => {
    const provider = getProviderFromModelId(modelId, activeProvider);
    
    localStorage.setItem('app_global_ai_model', modelId);
    localStorage.setItem('app_global_ai_provider', provider);
    
    const key = localStorage.getItem(`app_api_key_${provider}`) || localStorage.getItem('app_global_api_key') || '';
    localStorage.setItem('app_global_api_key', key);
    
    setActiveModel(modelId);
    setActiveProvider(provider);
    
    if (!recentModels.includes(modelId)) {
      const updated = [modelId, ...recentModels.filter(id => id !== modelId).slice(0, 4)];
      setRecentModels(updated);
      localStorage.setItem('app_ai_recent', JSON.stringify(updated));
    }
    
    setShowDropdown(false);
    window.dispatchEvent(new Event('apptify_settings_change'));
  };

  const syncSettings = () => {
    setActiveProvider(localStorage.getItem('app_global_ai_provider') || 'google');
    setActiveModel(localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');
    try {
      setFavorites(JSON.parse(localStorage.getItem('app_ai_favorites') || '[]'));
      setRecentModels(JSON.parse(localStorage.getItem('app_ai_recent') || '[]'));
    } catch (e) {}

    const currentProvider = localStorage.getItem('app_global_ai_provider') || 'google';
    if (currentProvider === 'siliconflow') {
      try {
        const cached = localStorage.getItem('app_siliconflow_models_cache');
        if (cached) {
          setModelsList(JSON.parse(cached));
        } else {
          setModelsList([]);
        }
      } catch (e) {
        setModelsList([]);
      }
    } else {
      if (currentProvider === 'google') {
        setModelsList([
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
          { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking' },
          { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro (Exp)' },
          { id: 'gemini-2.0-flash-lite-preview-02-05', name: 'Gemini 2.0 Flash Lite' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
        ]);
      } else if (currentProvider === 'deepseek') {
        setModelsList([
          { id: 'deepseek-flash', name: 'DeepSeek-V4 Flash (Recommended)' },
          { id: 'deepseek-v4-pro', name: 'DeepSeek-V4 Pro (Reasoning)' },
          { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)' },
          { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)' }
        ]);
      } else if (currentProvider === 'openai') {
        setModelsList([
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'o3-mini', name: 'o3-mini' },
          { id: 'o1', name: 'o1' }
        ]);
      } else if (currentProvider === 'anthropic') {
        setModelsList([
          { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' }
        ]);
      } else if (currentProvider === 'openrouter') {
        setModelsList([
          { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek-V4 Pro' },
          { id: 'deepseek/deepseek-flash', name: 'DeepSeek-V4 Flash' },
          { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
          { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
          { id: 'deepseek/deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Llama-70B' },
          { id: 'deepseek/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Qwen-32B' },
          { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },
          { id: 'openai/gpt-4o', name: 'GPT-4o' },
          { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'qwen/qwq-32b', name: 'Qwen QwQ 32B (Reasoning)' },
          { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B' },
          { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
          { id: 'moonshot/moonshot-v1-128k', name: 'Moonshot Kimi V1 128K' }
        ]);
      } else {
        setModelsList([]);
      }
    }
  };

  useEffect(() => {
    syncSettings();
    window.addEventListener('storage', syncSettings);
    window.addEventListener('apptify_settings_change', syncSettings);
    return () => {
      window.removeEventListener('storage', syncSettings);
      window.removeEventListener('apptify_settings_change', syncSettings);
    };
  }, []);

  const [liveNetWorth, setLiveNetWorth] = useState<string>('0.00');
  const [liveCash, setLiveCash] = useState<string>('0.00');
  const [liveInvest, setLiveInvest] = useState<string>('0.00');
  const [wealthView, setWealthView] = useState<'total' | 'cash' | 'invest'>('total');
  const [taskCount, setTaskCount] = useState<number>(0);
  const [noteCount, setNoteCount] = useState<number>(0);

  // Live Digital Clock for Tactical Top Bar
  const [currentTime, setCurrentTime] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Quick-Jot Scratchpad State for NoteDown launcher card
  const [quickJotText, setQuickJotText] = useState<string>('');
  const [quickJotType, setQuickJotType] = useState<'task' | 'note'>('task');
  const [quickJotToast, setQuickJotToast] = useState<string | null>(null);

  const handleQuickJotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickJotText.trim()) return;

    if (quickJotType === 'task') {
      try {
        const raw = localStorage.getItem('apptify_tasks');
        const tasks = raw ? JSON.parse(raw) : [];
        const newTask = {
          id: 'task_' + Date.now(),
          title: quickJotText.trim(),
          completed: false,
          priority: 'medium',
          dueDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        };
        const updated = [newTask, ...(Array.isArray(tasks) ? tasks : [])];
        localStorage.setItem('apptify_tasks', JSON.stringify(updated));
        window.dispatchEvent(new Event('apptify_tasks_changed'));
        window.dispatchEvent(new Event('apptify_vault_changed'));
        window.dispatchEvent(new Event('apptify_data_changed'));
        setQuickJotText('');
        setQuickJotToast(lang === 'zh' ? '已记入 NoteDown 待办' : 'Added to NoteDown Tasks');
        setTimeout(() => setQuickJotToast(null), 2200);
      } catch {}
    } else {
      try {
        const raw = localStorage.getItem('apptify_notes');
        const notes = raw ? JSON.parse(raw) : [];
        const newNote = {
          id: 'note_' + Date.now(),
          title: quickJotText.trim().slice(0, 32),
          content: quickJotText.trim(),
          tag: 'Quick',
          updatedAt: new Date().toISOString()
        };
        const updated = [newNote, ...(Array.isArray(notes) ? notes : [])];
        localStorage.setItem('apptify_notes', JSON.stringify(updated));
        window.dispatchEvent(new Event('apptify_notes_changed'));
        window.dispatchEvent(new Event('apptify_vault_changed'));
        window.dispatchEvent(new Event('apptify_data_changed'));
        setQuickJotText('');
        setQuickJotToast(lang === 'zh' ? '已存入 NoteDown 便签' : 'Saved to NoteDown Notes');
        setTimeout(() => setQuickJotToast(null), 2200);
      } catch {}
    }
  };

  const newsRadarTopics = [
    { id: 'ai', label: 'AI INFRA', count: '14+' },
    { id: 'chips', label: 'CHIPS', count: '11+' },
    { id: 'market', label: 'MACRO', count: '8+' },
    { id: 'crypto', label: 'FINTECH', count: '6+' }
  ];

  useEffect(() => {
    const updateAllData = () => {
      try {
        const raw = localStorage.getItem('mw_data_main');
        if (raw) {
          const data = JSON.parse(raw);
          const accounts = data.accounts || [];
          const totalCash = accounts.reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0);
          const stocks = data.stocks || [];
          const exchangeRate = Number(data.exchangeRate) || 4.5;
          const stocksVal = stocks.reduce((sum: number, s: any) => {
            const qty = Number(s.quantity ?? s.shares ?? 0);
            const price = Number(s.currentPrice || 0);
            const rate = s.currency === 'USD' ? exchangeRate : 1;
            return sum + (qty * price * rate);
          }, 0);
          const investCash = data.cash || {};
          const hkdRate = Number(investCash.hkdRate) || 0.58;
          const investCashVal = (Number(investCash.myr) || 0) + ((Number(investCash.usd) || 0) * exchangeRate) + ((Number(investCash.hkd) || 0) * hkdRate);
          const totalInvestment = stocksVal + investCashVal;

          const grandTotal = totalCash + totalInvestment;
          setLiveNetWorth(grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          setLiveCash(totalCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          setLiveInvest(totalInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      } catch {}

      try {
        const rawNotes = localStorage.getItem('apptify_notes');
        if (rawNotes) {
          const notes = JSON.parse(rawNotes);
          setNoteCount(Array.isArray(notes) ? notes.length : 0);
        }
        const rawTasks = localStorage.getItem('apptify_tasks');
        if (rawTasks) {
          const tasks = JSON.parse(rawTasks);
          if (Array.isArray(tasks)) {
            const pending = tasks.filter((t: any) => !t.completed).length;
            setTaskCount(pending);
          }
        }
      } catch {}
    };

    updateAllData();
    window.addEventListener('apptify_data_changed', updateAllData);
    window.addEventListener('apptify_vault_changed', updateAllData);
    window.addEventListener('apptify_notes_changed', updateAllData);
    window.addEventListener('apptify_tasks_changed', updateAllData);
    window.addEventListener('storage', updateAllData);
    return () => {
      window.removeEventListener('apptify_data_changed', updateAllData);
      window.removeEventListener('apptify_vault_changed', updateAllData);
      window.removeEventListener('apptify_notes_changed', updateAllData);
      window.removeEventListener('apptify_tasks_changed', updateAllData);
      window.removeEventListener('storage', updateAllData);
    };
  }, []);

  const currentDateStr = (() => {
    const now = new Date();
    if (lang === 'zh') {
      return now.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
    }
    return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  })();

  const getAppTitle = () => {
    switch (currentApp) {
      case 'mywealth': return lang === 'zh' ? 'MyWealth 资产中心' : 'MyWealth Finance';
      case 'knowledgevault': return lang === 'zh' ? 'NoteDown 便签工作台' : 'NoteDown Workspace';
      case 'settings': return lang === 'zh' ? '系统设置中心' : 'Settings & Preferences';
      case 'newshub': return lang === 'zh' ? 'NewsHub 资讯' : 'NewsHub Beta';
      default: return '';
    }
  };

  const renderSubApp = () => {
    if (currentApp === 'mywealth') {
      return <MyWealthApp onExit={() => setCurrentApp('launcher')} />;
    }

    if (currentApp === 'knowledgevault') {
      return <KnowledgeVault onExit={() => setCurrentApp('launcher')} />;
    }

    if (currentApp === 'settings') {
      return <GlobalSettings onExit={() => setCurrentApp('launcher')} />;
    }

    if (currentApp === 'newshub') {
      return <NewsHub onExit={() => setCurrentApp('launcher')} />;
    }

    // Avant-Garde Kinetic Modular Launcher
    return (
      <div className="min-h-screen-safe w-full flex flex-col items-center justify-start px-3.5 sm:px-6 py-3.5 sm:py-6 max-w-2xl mx-auto space-y-4 sm:space-y-5 selection:bg-[#D4FF00] selection:text-black animate-fade-in font-sans">
        
        {/* 1. Tactical Micro Status Bar */}
        <div className="w-full flex items-center justify-between py-1 relative z-30">
          {/* Left: System Beacon, Live Clock & Cloud Sync */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Live Clock & Status Beacon */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-sm text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="tracking-tight">{currentTime}</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 hidden xs:inline">{currentDateStr}</span>
            </div>

            {/* Google Drive Status Pill */}
            <button
              onClick={() => setShowAuthModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl border shadow-sm text-xs font-semibold active:scale-95 transition-all cursor-pointer ${
                isConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title={isConnected ? `Google Drive: ${user?.email || ''}` : (lang === 'zh' ? '连接 Google Drive 云同步' : 'Connect Google Drive')}
            >
              <Cloud size={12} className={isConnected ? "fill-emerald-500/20" : ""} />
              <span className="text-[11px] font-mono font-medium hidden xs:inline">
                {isConnected ? (user?.name?.split(' ')[0] || 'DRIVE // OK') : 'SYNC // OFF'}
              </span>
            </button>
          </div>

          {/* Right: Quick Controls (Language, Theme) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Language Capsule */}
            <button
              onClick={() => setStoredLanguage(lang === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-sm text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 active:scale-90 hover:border-black/20 dark:hover:border-white/25 transition-all cursor-pointer"
              title={lang === 'en' ? "切换为中文" : "Switch to English"}
            >
              <Globe size={13} className="text-zinc-500 dark:text-zinc-400" />
              <span>{lang === 'en' ? 'EN' : '中'}</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => {
                const nextTheme = theme === 'dark' ? 'light' : 'dark';
                localStorage.setItem('mw_theme_manual', 'true');
                localStorage.setItem('mw_theme', nextTheme);
                setTheme(nextTheme);
              }}
              className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-sm text-zinc-800 dark:text-zinc-200 active:scale-90 hover:border-black/20 dark:hover:border-white/25 transition-all cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={15} className="text-[#D4FF00]" /> : <Moon size={15} className="text-zinc-900" />}
            </button>
          </div>
        </div>

        {/* 2. Avant-Garde Asymmetric Masthead */}
        <header className="w-full flex items-end justify-between pt-1 pb-1 px-1">
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-extrabold bg-zinc-900 text-[#D4FF00] dark:bg-[#D4FF00] dark:text-black">
                OS V2.3 // KINETIC
              </span>
              <div className="flex items-center gap-1 h-3">
                <span className="w-1 h-3 rounded-full bg-zinc-900 dark:bg-[#D4FF00] animate-pulse"></span>
                <span className="w-1 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-pulse delay-75"></span>
                <span className="w-1 h-3.5 rounded-full bg-zinc-900 dark:bg-[#D4FF00] animate-pulse delay-150"></span>
                <span className="w-1 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600"></span>
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-[-0.05em] uppercase text-zinc-950 dark:text-white leading-none select-none">
              APPTIFY
            </h1>
          </div>

          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              {lang === 'zh' ? '年轻人高触感数字系统' : 'HYPER PERSONAL OS'}
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
              <span className="px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800/80">FINANCE</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800/80">NOTEDOWN</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800/80">RADAR</span>
            </div>
          </div>
        </header>

        {/* 3. Modular Tactical Deck */}
        <div className="w-full flex flex-col gap-3.5 sm:gap-4">
          
          {/* Deck 01: MyWealth Flagship Asset Terminal */}
          <div className="avant-card rounded-3xl p-5 sm:p-6.5 relative overflow-hidden group">
            {/* Ambient specular corner light */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-[#D4FF00]/10 dark:bg-[#D4FF00]/15 rounded-full blur-3xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
            
            {/* Card Header Strip: Badge & Interactive Toggle Switch */}
            <div className="flex items-center justify-between w-full relative z-10 pb-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-950 dark:bg-white text-[#D4FF00] dark:text-black flex items-center justify-center font-black shadow-md shrink-0">
                  <Wallet size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight text-zinc-950 dark:text-white uppercase leading-none">
                      {t.launcher.myWealthTitle}
                    </h2>
                    <span className="font-mono text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold">
                      01 // COCKPIT
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                    {t.launcher.myWealthDesc}
                  </p>
                </div>
              </div>

              {/* Interactive In-Card Metric Switcher */}
              <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200/70 dark:border-zinc-700/60 text-[10px] font-mono font-bold">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setWealthView('total'); }}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    wealthView === 'total'
                      ? 'bg-zinc-950 dark:bg-[#D4FF00] text-[#D4FF00] dark:text-black shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {lang === 'zh' ? '总资产' : 'TOTAL'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setWealthView('cash'); }}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    wealthView === 'cash'
                      ? 'bg-zinc-950 dark:bg-[#D4FF00] text-[#D4FF00] dark:text-black shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {lang === 'zh' ? '现金' : 'CASH'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setWealthView('invest'); }}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    wealthView === 'invest'
                      ? 'bg-zinc-950 dark:bg-[#D4FF00] text-[#D4FF00] dark:text-black shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {lang === 'zh' ? '投资' : 'INVEST'}
                </button>
              </div>
            </div>

            {/* Large Tabular Number Display */}
            <div 
              onClick={() => setCurrentApp('mywealth')}
              className="py-5 cursor-pointer relative z-10 group/num"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs sm:text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  RM
                </span>
                <span className="font-mono font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight text-zinc-950 dark:text-white font-mono-numbers group-hover/num:text-emerald-600 dark:group-hover/num:text-[#D4FF00] transition-colors">
                  {wealthView === 'total' ? liveNetWorth : wealthView === 'cash' ? liveCash : liveInvest}
                </span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
                <span>
                  {wealthView === 'total' ? t.launcher.netWorthLabel : wealthView === 'cash' ? (lang === 'zh' ? '流动现金及多币种账户' : 'Liquid Multi-Currency Accounts') : (lang === 'zh' ? '当前持仓市值与投资本金' : 'Securities & Active Holdings')}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </p>
            </div>

            {/* Bottom Actions & Launch Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 relative z-10">
              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 font-bold">50/30/20</span>
                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 font-bold hidden xs:inline">MULTI-FX</span>
              </div>

              <button
                onClick={() => setCurrentApp('mywealth')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-black text-xs font-bold font-mono tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer group/btn"
              >
                <span>{t.launcher.openWealth}</span>
                <ArrowUpRight size={14} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Split Deck: NoteDown (Interactive Scratchpad) + NewsHub (Live Radar) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 w-full">
            
            {/* Deck 02: NoteDown (Interactive Scratchpad & Todos) */}
            <div className="avant-card rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between group">
              <div className="absolute top-0 right-0 w-28 h-28 bg-amber-400/10 dark:bg-amber-400/15 rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />

              {/* Header */}
              <div className="relative z-10">
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                      <NotebookPen size={18} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h2 className="text-base font-black tracking-tight text-zinc-950 dark:text-white uppercase leading-none">
                        NoteDown
                      </h2>
                      <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500 font-bold">
                        02 // SCRATCHPAD
                      </span>
                    </div>
                  </div>

                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-800 dark:text-amber-300">
                    {taskCount > 0 ? `${taskCount} ${lang === 'zh' ? '待办' : 'TASKS'}` : `${noteCount} ${lang === 'zh' ? '便签' : 'NOTES'}`}
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mb-3">
                  {lang === 'zh' ? '灵感闪念速记 · 待办清单 · 极简专注' : 'Instant Notes, Action Tasks & Clean Focus'}
                </p>

                {/* Interactive In-Card Fast Jot Input */}
                <form onSubmit={handleQuickJotSubmit} className="mb-3 relative">
                  <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/80 p-1 focus-within:border-amber-500 transition-colors">
                    <button
                      type="button"
                      onClick={() => setQuickJotType(quickJotType === 'task' ? 'note' : 'task')}
                      className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-zinc-200/80 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shrink-0 cursor-pointer hover:bg-amber-500 hover:text-white transition-colors"
                      title={lang === 'zh' ? '点击切换 待办 / 便签' : 'Click to toggle Task / Note'}
                    >
                      {quickJotType === 'task' ? (lang === 'zh' ? '待办' : 'TASK') : (lang === 'zh' ? '便签' : 'NOTE')}
                    </button>
                    <input
                      type="text"
                      value={quickJotText}
                      onChange={(e) => setQuickJotText(e.target.value)}
                      placeholder={quickJotType === 'task' ? (lang === 'zh' ? '极速记待办并按回车...' : 'Quick task & press enter...') : (lang === 'zh' ? '极速记闪念灵感...' : 'Quick jot an idea...')}
                      className="w-full bg-transparent px-2.5 py-1 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!quickJotText.trim()}
                      className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-[#D4FF00] text-white dark:text-black flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Instant save feedback toast */}
                  {quickJotToast && (
                    <div className="absolute -bottom-6 left-1 text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-fade-in">
                      <Check size={11} strokeWidth={2.5} />
                      <span>{quickJotToast}</span>
                    </div>
                  )}
                </form>
              </div>

              {/* Bottom Jump Button */}
              <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between relative z-10 mt-2">
                <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  {noteCount} {lang === 'zh' ? '篇随手记' : 'Total Notes'}
                </span>

                <button
                  onClick={() => setCurrentApp('knowledgevault')}
                  className="flex items-center gap-1 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:text-amber-600 dark:hover:text-amber-400 active:scale-95 transition-all cursor-pointer"
                >
                  <span>{t.launcher.openVault}</span>
                  <ArrowUpRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Deck 03: NewsHub (Live Radar Feed) */}
            <div className="avant-card rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between group">
              <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-400/10 dark:bg-cyan-400/15 rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />

              {/* Header */}
              <div className="relative z-10">
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500 text-white flex items-center justify-center font-bold shadow-sm">
                      <Radio size={18} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h2 className="text-base font-black tracking-tight text-zinc-950 dark:text-white uppercase leading-none">
                        {t.launcher.newsTitle}
                      </h2>
                      <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500 font-bold">
                        03 // RADAR FEED
                      </span>
                    </div>
                  </div>

                  {/* Pulsing Radar Badge */}
                  <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-800 dark:text-cyan-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping"></span>
                    <span>LIVE STREAM</span>
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mb-3">
                  {t.launcher.newsDesc}
                </p>

                {/* Dynamic Radar Topics Strip */}
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {newsRadarTopics.map(topic => (
                    <div
                      key={topic.id}
                      onClick={() => setCurrentApp('newshub')}
                      className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 hover:border-cyan-500/50 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <span className="font-mono text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                        #{topic.label}
                      </span>
                      <span className="font-mono text-[9px] text-cyan-600 dark:text-cyan-400 font-bold">
                        {topic.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Jump Button */}
              <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between relative z-10 mt-1">
                <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  {lang === 'zh' ? '多源科技与宏观快讯' : 'Real-time Tech & Markets'}
                </span>

                <button
                  onClick={() => setCurrentApp('newshub')}
                  className="flex items-center gap-1 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:text-cyan-600 dark:hover:text-cyan-400 active:scale-95 transition-all cursor-pointer"
                >
                  <span>{t.launcher.openNews}</span>
                  <ArrowUpRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          {/* Deck 04: System Hardware Console & AI Switcher */}
          <div className="avant-card rounded-2xl p-4 sm:p-4.5 flex flex-col sm:flex-row items-center justify-between gap-3 relative overflow-hidden group">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shadow-xs shrink-0 group-hover:rotate-45 transition-transform duration-300">
                <Settings size={18} />
              </div>
              
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-950 dark:text-white uppercase font-mono tracking-tight">
                    {t.launcher.settingsTitle}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-400 uppercase">
                    04 // SYSTEM
                  </span>
                </div>
                
                {/* AI Model Indicator Pill */}
                <div className="flex items-center gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
                    className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-zinc-600 dark:text-zinc-300 hover:text-[#D4FF00] transition-colors cursor-pointer"
                  >
                    <Cpu size={12} className="text-zinc-400" />
                    <span>AI: {activeModel.includes('/') ? activeModel.split('/').pop() : activeModel}</span>
                    <ChevronDown size={11} />
                  </button>
                </div>
              </div>
            </div>

            {/* Launch Settings Button */}
            <button
              onClick={() => setCurrentApp('settings')}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-zinc-200/80 dark:border-zinc-700/80"
            >
              <span>{lang === 'zh' ? '偏好与密钥控制' : 'Preferences & Keys'}</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-zinc-900 dark:text-zinc-100 font-sans avant-grid-bg selection:bg-[#D4FF00] selection:text-black">
      {/* Universal Floating Top Bar for Sub-Apps (iOS Safe Area Ready) */}
      {currentApp !== 'launcher' && (
        <header className="fixed top-0 left-0 right-0 z-50 pt-safe bg-white/75 dark:bg-[#0D0E10]/80 backdrop-blur-2xl border-b border-black/5 dark:border-white/10 transition-colors">
          <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
            {/* Back Button (iOS Style Chevron) */}
            <button
              onClick={() => setCurrentApp('launcher')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 bg-black/5 dark:bg-white/10 active:scale-95 transition-all"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
              <span>{t.nav.home}</span>
            </button>

            {/* Active App Title */}
            <h2 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate max-w-[140px] sm:max-w-xs text-center">
              {getAppTitle()}
            </h2>

            {/* Right Controls Container */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Language Switcher Capsule */}
              <button
                onClick={() => setStoredLanguage(lang === 'en' ? 'zh' : 'en')}
                className="px-2.5 py-1 rounded-full text-xs font-bold text-gray-700 dark:text-gray-200 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all"
                title={lang === 'en' ? "切换为中文" : "Switch to English"}
              >
                {lang === 'en' ? 'EN' : '中'}
              </button>

              {/* Google Drive Cloud Sync */}
              <button
                onClick={() => setShowAuthModal(true)}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
                  isConnected
                    ? 'text-blue-500 bg-blue-500/10'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={isConnected ? `Google Drive: ${user?.email || ''}` : "Connect Google Drive"}
              >
                <Cloud size={16} className={isConnected ? "fill-blue-500/20" : ""} />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => {
                  const nextTheme = theme === 'dark' ? 'light' : 'dark';
                  localStorage.setItem('mw_theme_manual', 'true');
                  localStorage.setItem('mw_theme', nextTheme);
                  setTheme(nextTheme);
                }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer pointer-events-auto"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
              </button>

              {/* AI Model Selector Button */}
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 active:scale-95 transition-all border border-purple-500/20"
                >
                  <Cpu size={13} />
                  <span className="max-w-[70px] sm:max-w-[110px] truncate">
                    {activeModel.includes('/') ? activeModel.split('/').pop() : activeModel}
                  </span>
                  <ChevronDown size={13} />
                </button>

                {/* Dropdown Menu */}
                {showDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-60 sm:w-64 rounded-2xl p-3 bg-white/95 dark:bg-[#1A1C22]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 z-50 shadow-2xl max-h-[340px] overflow-y-auto no-scrollbar animate-scale-in">
                      <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-gray-100 dark:border-white/10">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">{lang === 'zh' ? '选择 AI 模型' : 'SELECT MODEL'}</span>
                        <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase px-2 py-0.5 rounded-full bg-purple-500/10">
                          {activeProvider}
                        </span>
                      </div>

                      {/* Favorites */}
                      {favorites.length > 0 && (
                        <div className="mb-3">
                          <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block mb-1">⭐ {lang === 'zh' ? '常用收藏' : 'FAVORITES'}</span>
                          <div className="space-y-1">
                            {favorites.map(id => (
                              <button
                                key={id}
                                onClick={() => handleSelectModel(id)}
                                className={`w-full text-left p-1.5 rounded-xl text-xs font-semibold transition-all truncate hover:bg-black/5 dark:hover:bg-white/10 ${activeModel === id ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10' : 'text-gray-700 dark:text-gray-300'}`}
                              >
                                {id.includes('/') ? id.split('/').pop() : id}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recents */}
                      {recentModels.length > 0 && (
                        <div className="mb-3">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">🕒 {lang === 'zh' ? '最近使用' : 'RECENTS'}</span>
                          <div className="space-y-1">
                            {recentModels.filter(id => !favorites.includes(id)).map(id => (
                              <button
                                key={id}
                                onClick={() => handleSelectModel(id)}
                                className={`w-full text-left p-1.5 rounded-xl text-xs font-semibold transition-all truncate hover:bg-black/5 dark:hover:bg-white/10 ${activeModel === id ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10' : 'text-gray-700 dark:text-gray-300'}`}
                              >
                                {id.includes('/') ? id.split('/').pop() : id}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* All Models */}
                      <div>
                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider block mb-1">📋 {lang === 'zh' ? '可用模型' : 'AVAILABLE MODELS'}</span>
                        <div className="space-y-1">
                          {modelsList.length > 0 ? (
                            modelsList.map(m => (
                              <button
                                key={m.id}
                                onClick={() => handleSelectModel(m.id)}
                                className={`w-full text-left p-1.5 rounded-xl text-xs font-semibold transition-all truncate hover:bg-black/5 dark:hover:bg-white/10 ${activeModel === m.id ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10' : 'text-gray-700 dark:text-gray-300'}`}
                              >
                                {m.name || (m.id.includes('/') ? m.id.split('/').pop() : m.id)}
                              </button>
                            ))
                          ) : (
                            <p className="text-[10px] text-gray-400 italic p-2">{lang === 'zh' ? '未找到缓存模型' : 'No cached models found'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Sub-App Content with Safe-Area Offset */}
      <main className={currentApp !== 'launcher' ? 'pt-16 sm:pt-20 min-h-screen-safe' : 'min-h-screen-safe'}>
        {renderSubApp()}
      </main>

      {/* Global AI Floating Copilot Drawer */}
      <AskApptify currentApp={currentApp} setCurrentApp={setCurrentApp} />

      {/* Google Drive Auth & Welcome Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default App;