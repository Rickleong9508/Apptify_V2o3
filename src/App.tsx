import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  NotebookPen, 
  ArrowRight, 
  Sparkles, 
  Settings, 
  Cpu, 
  ChevronLeft, 
  ChevronDown, 
  Sun, 
  Moon,
  MessageSquare,
  Bot
} from 'lucide-react';
import MyWealthApp from './components/MyWealthApp';
import KnowledgeVault from './components/KnowledgeVault';
import GlobalSettings from './components/GlobalSettings';
import NewsHub from './components/NewsHub';
import AuthModal from './components/AuthModal';
import AskApptify from './components/AskApptify';

type AppMode = 'launcher' | 'mywealth' | 'knowledgevault' | 'settings' | 'newshub';

const getAppFromHash = (): AppMode => {
  if (typeof window === 'undefined') return 'launcher';
  const hash = window.location.hash.replace('#', '') as AppMode;
  const validModes: AppMode[] = ['launcher', 'mywealth', 'knowledgevault', 'settings', 'newshub'];
  return validModes.includes(hash) ? hash : 'launcher';
};

const App: React.FC = () => {
  const [currentApp, setCurrentAppState] = useState<AppMode>(getAppFromHash);

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

  // Global theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('mw_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('mw_theme', theme);
    window.dispatchEvent(new Event('apptify_theme_change'));
  }, [theme]);

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
    if (modelId === 'deepseek-chat' || modelId === 'deepseek-reasoner') return 'deepseek';
    
    try {
      const sfCache = localStorage.getItem('app_siliconflow_models_cache');
      if (sfCache) {
        const sfModels: any[] = JSON.parse(sfCache);
        if (sfModels.some(m => m.id === modelId)) {
          return 'siliconflow';
        }
      }
    } catch (e) {}

    if (modelId.startsWith('deepseek/') || modelId.startsWith('anthropic/') || modelId.startsWith('openai/') || modelId.startsWith('qwen/')) {
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
          { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
          { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
          { id: 'deepseek/deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Llama-70B' },
          { id: 'deepseek/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Qwen-32B' },
          { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },
          { id: 'openai/gpt-4o', name: 'GPT-4o' },
          { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' }
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

  useEffect(() => {
    const updateNetWorth = () => {
      try {
        const raw = localStorage.getItem('mw_data_main');
        if (raw) {
          const data = JSON.parse(raw);
          const accounts = data.accounts || [];
          const cash = accounts.reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0);
          const stocks = data.stocks || [];
          const stockVal = stocks.reduce((sum: number, s: any) => sum + ((Number(s.shares) || 0) * (Number(s.currentPrice) || 0)), 0);
          const loans = data.loans || [];
          const debts = loans.reduce((sum: number, l: any) => sum + (Number(l.remainingAmount) || 0), 0);
          const nw = cash + stockVal - debts;
          setLiveNetWorth(nw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      } catch {}
    };
    updateNetWorth();
    window.addEventListener('apptify_data_changed', updateNetWorth);
    window.addEventListener('storage', updateNetWorth);
    return () => {
      window.removeEventListener('apptify_data_changed', updateNetWorth);
      window.removeEventListener('storage', updateNetWorth);
    };
  }, []);

  const getAppTitle = () => {
    switch (currentApp) {
      case 'mywealth': return 'MyWealth 资产';
      case 'knowledgevault': return 'Knowledge Vault 工作台';
      case 'settings': return '系统设置';
      case 'newshub': return 'NewsHub 资讯';
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

    // Default Launcher View (3-Core Apps Golden Layout)
    return (
      <div className="min-h-screen-safe w-full flex flex-col items-center justify-start px-4 sm:px-6 py-6 sm:py-10 max-w-lg mx-auto space-y-5 sm:space-y-7 selection:bg-blue-500/20">
        {/* Centered Large Apptify Header & Absolute Top-Right Theme Toggle */}
        <header className="w-full relative flex flex-col items-center justify-center pt-3 sm:pt-6 pb-2 sm:pb-4 text-center">
          {/* Floating Theme Switcher at Top-Right */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/70 dark:bg-white/10 backdrop-blur-2xl border border-white/60 dark:border-white/15 shadow-[0_4px_16px_0_rgba(0,0,0,0.06)] text-gray-700 dark:text-gray-200 active:scale-90 transition-all hover:bg-white/90 dark:hover:bg-white/20 absolute right-0 top-3 sm:top-5"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} className="text-blue-600" />}
          </button>

          {/* Centered Large Apptify Title with Apple Liquid Gradient */}
          <div className="flex flex-col items-center animate-fade-in-down w-full px-2">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.2] pb-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-sky-400 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent drop-shadow-sm select-none">
              Apptify
            </h1>
            <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-gray-500 dark:text-gray-400 uppercase mt-3 select-none">
              Personal OS · 个人智能系统
            </p>
          </div>
        </header>

        {/* 3 Core Apps Layout: 1 Hero Wide Card (MyWealth) + 2 Standard Cards (Vault & News) */}
        <div className="w-full grid grid-cols-2 gap-3.5 sm:gap-4">
          {/* 1. Hero Wide Card: MyWealth */}
          <button
            onClick={() => setCurrentApp('mywealth')}
            className="col-span-2 group rounded-3xl liquid-card-emerald backdrop-blur-2xl p-5 sm:p-6 flex flex-col justify-between text-left active:scale-[0.98] transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
          >
            {/* Shimmer Ambient Glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-emerald-400/20 dark:bg-emerald-400/15 blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />

            <div className="flex items-center justify-between w-full relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform duration-300">
                  <Wallet size={24} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white leading-tight">
                    MyWealth
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                    个人财务与资产全局工作台
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  净资产
                </span>
                <p className="text-sm sm:text-base font-black font-mono text-gray-900 dark:text-white mt-1">
                  RM {liveNetWorth}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs relative z-10">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                多币种钱包 · 50/30/20 预算 · 负债追踪
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                进入资产中心 <ArrowRight size={13} strokeWidth={2.5} />
              </span>
            </div>
          </button>

          {/* 2. Knowledge Vault Card (Notes & Tasks) */}
          <button
            onClick={() => setCurrentApp('knowledgevault')}
            className="group rounded-3xl liquid-card-amber backdrop-blur-2xl p-4 sm:p-5 flex flex-col justify-between text-left active:scale-[0.96] transition-all duration-300 hover:-translate-y-1 relative overflow-hidden aspect-[1/1.1] sm:aspect-square"
          >
            <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-amber-400/20 dark:bg-amber-400/15 blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />

            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform duration-300">
                <NotebookPen size={22} strokeWidth={2.2} />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-amber-800 dark:text-amber-300 bg-amber-500/15">
                工作与笔记
              </span>
            </div>

            <div className="mt-2 relative z-10">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white leading-tight">
                Knowledge Vault
              </h2>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium mt-1 leading-snug line-clamp-2">
                日常随手记 · 待办任务 · 沉浸专注
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 relative z-10">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                进入
              </span>
              <div className="w-6 h-6 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center text-gray-700 dark:text-gray-200 group-hover:bg-amber-500 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200">
                <ArrowRight size={13} strokeWidth={2.5} />
              </div>
            </div>
          </button>

          {/* 3. NewsHub Beta Card */}
          <button
            onClick={() => setCurrentApp('newshub')}
            className="group rounded-3xl liquid-card-purple backdrop-blur-2xl p-4 sm:p-5 flex flex-col justify-between text-left active:scale-[0.96] transition-all duration-300 hover:-translate-y-1 relative overflow-hidden aspect-[1/1.1] sm:aspect-square"
          >
            <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-purple-400/20 dark:bg-purple-400/15 blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />

            <div className="flex items-center justify-between w-full relative z-10">
              <div className="w-11 h-11 rounded-2xl bg-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-fuchsia-500/30 group-hover:scale-105 transition-transform duration-300">
                <Sparkles size={22} strokeWidth={2.2} />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-fuchsia-800 dark:text-fuchsia-300 bg-fuchsia-500/15">
                全球资讯
              </span>
            </div>

            <div className="mt-2 relative z-10">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white leading-tight">
                NewsHub Beta
              </h2>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium mt-1 leading-snug line-clamp-2">
                多源科技 · 商业要闻 · AI 智能精炼
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 relative z-10">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                进入
              </span>
              <div className="w-6 h-6 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center text-gray-700 dark:text-gray-200 group-hover:bg-fuchsia-600 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200">
                <ArrowRight size={13} strokeWidth={2.5} />
              </div>
            </div>
          </button>
        </div>

        {/* Bottom Settings Button (iOS 27 Liquid Glass Touch Bar) */}
        <div className="w-full mt-4 pb-2">
          <button
            onClick={() => setCurrentApp('settings')}
            className="w-full h-15 py-3 rounded-2xl bg-white/70 dark:bg-[#181A20]/75 backdrop-blur-2xl border border-white/60 dark:border-white/12 shadow-[0_8px_30px_0_rgba(0,0,0,0.05)] flex items-center justify-between px-5 text-gray-800 dark:text-gray-200 font-semibold active:scale-[0.98] transition-all group hover:border-blue-500/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:rotate-45 transition-transform duration-300 shadow-sm">
                <Settings size={18} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold leading-tight">系统设置中心</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">AI 密钥配置 · 数据存储 · 偏好设置</span>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all">
              <ArrowRight size={14} strokeWidth={2.5} />
            </div>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 font-sans selection:bg-blue-500/20">
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
              <span>主页</span>
            </button>

            {/* Active App Title */}
            <h2 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate max-w-[140px] sm:max-w-xs text-center">
              {getAppTitle()}
            </h2>

            {/* Right Controls Container */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
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
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">选择 AI 模型</span>
                        <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase px-2 py-0.5 rounded-full bg-purple-500/10">
                          {activeProvider}
                        </span>
                      </div>

                      {/* Favorites */}
                      {favorites.length > 0 && (
                        <div className="mb-3">
                          <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block mb-1">⭐ 常用收藏</span>
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
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">🕒 最近使用</span>
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
                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider block mb-1">📋 可用模型</span>
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
                            <p className="text-[10px] text-gray-400 italic p-2">未找到缓存模型</p>
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
    </div>
  );
};

export default App;