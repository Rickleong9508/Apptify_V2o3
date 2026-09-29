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
  Bot,
  Globe
} from 'lucide-react';
import MyWealthApp from './components/MyWealthApp';
import KnowledgeVault from './components/KnowledgeVault';
import GlobalSettings from './components/GlobalSettings';
import NewsHub from './components/NewsHub';
import AuthModal from './components/AuthModal';
import AskApptify from './components/AskApptify';
import { Language, translations, getStoredLanguage, setStoredLanguage } from './utils/i18n';

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
      case 'mywealth': return lang === 'zh' ? 'MyWealth 资产中心' : 'MyWealth Finance';
      case 'knowledgevault': return lang === 'zh' ? 'Knowledge Vault 灵感工作台' : 'Knowledge Vault';
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

    // Default Launcher View (3-Core Apps Golden Layout)
    return (
      <div className="min-h-screen-safe w-full flex flex-col items-center justify-start px-4 sm:px-6 py-4 sm:py-8 max-w-lg mx-auto space-y-4 sm:space-y-6 selection:bg-blue-500/20">
        {/* Top Control Bar: Language Switcher Capsule & Theme Toggle (Guaranteed Clickable & Z-Indexed) */}
        <div className="w-full flex items-center justify-between pt-1 pb-1 relative z-30">
          <button
            onClick={() => setStoredLanguage(lang === 'en' ? 'zh' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/75 dark:bg-white/10 backdrop-blur-2xl border border-white/60 dark:border-white/15 shadow-sm text-xs font-bold text-gray-700 dark:text-gray-200 active:scale-95 hover:bg-white/90 dark:hover:bg-white/20 transition-all cursor-pointer pointer-events-auto"
            title={lang === 'en' ? "切换为中文" : "Switch to English"}
          >
            <Globe size={14} className="text-blue-500" />
            <span>{lang === 'en' ? 'English (EN)' : '中文 (ZH)'}</span>
          </button>

          <button
            onClick={() => {
              const nextTheme = theme === 'dark' ? 'light' : 'dark';
              localStorage.setItem('mw_theme_manual', 'true');
              localStorage.setItem('mw_theme', nextTheme);
              setTheme(nextTheme);
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/75 dark:bg-white/10 backdrop-blur-2xl border border-white/60 dark:border-white/15 shadow-sm text-gray-700 dark:text-gray-200 active:scale-90 hover:bg-white/90 dark:hover:bg-white/20 transition-all cursor-pointer pointer-events-auto"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} className="text-blue-600" />}
          </button>
        </div>

        {/* Centered Large Apptify Title with Apple Liquid Gradient */}
        <header className="w-full flex flex-col items-center justify-center text-center pt-1 pb-2">
          <div className="flex flex-col items-center animate-fade-in-down w-full px-2">
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[1.1] pb-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-sky-400 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent drop-shadow-sm select-none">
              Apptify
            </h1>
            <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-gray-500 dark:text-gray-400 uppercase mt-2.5 select-none">
              {t.launcher.subtitle}
            </p>
          </div>
        </header>

        {/* 3 Core Apps Layout: 1 Hero Wide Card (MyWealth) + 2 Standard Cards (Vault & News) */}
        <div className="w-full grid grid-cols-2 gap-3.5 sm:gap-4">
          {/* 1. Hero Wide Card: MyWealth (Enlarged & Flagship Presence) */}
          <button
            onClick={() => setCurrentApp('mywealth')}
            className="col-span-2 group rounded-3xl liquid-card-emerald backdrop-blur-2xl p-6 sm:p-7 flex flex-col justify-between text-left active:scale-[0.98] transition-all duration-300 hover:-translate-y-1 relative overflow-hidden min-h-[180px] sm:min-h-[190px]"
          >
            {/* Shimmer Ambient Glow */}
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-emerald-400/20 dark:bg-emerald-400/15 blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />

            <div className="flex items-center justify-between w-full relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform duration-300 shrink-0">
                  <Wallet size={28} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                    {t.launcher.myWealthTitle}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium mt-0.5">
                    {t.launcher.myWealthDesc}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/20">
                  {t.launcher.netWorthLabel}
                </span>
                <p className="text-base sm:text-lg lg:text-xl font-black font-mono text-gray-900 dark:text-white mt-1.5 tracking-tight">
                  RM {liveNetWorth}
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-emerald-500/15 flex items-center justify-between text-xs relative z-10">
              <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
                {t.launcher.myWealthFeatures}
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                {t.launcher.openWealth} <ArrowRight size={13} strokeWidth={2.5} />
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
                {t.launcher.vaultTag}
              </span>
            </div>

            <div className="mt-2 relative z-10">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white leading-tight">
                {t.launcher.vaultTitle}
              </h2>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium mt-1 leading-snug line-clamp-2">
                {t.launcher.vaultDesc}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 relative z-10">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                {t.launcher.openVault}
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
                {t.launcher.newsTag}
              </span>
            </div>

            <div className="mt-2 relative z-10">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white leading-tight">
                {t.launcher.newsTitle}
              </h2>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium mt-1 leading-snug line-clamp-2">
                {t.launcher.newsDesc}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 relative z-10">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {t.launcher.openNews}
              </span>
              <div className="w-6 h-6 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center text-gray-700 dark:text-gray-200 group-hover:bg-fuchsia-600 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200">
                <ArrowRight size={13} strokeWidth={2.5} />
              </div>
            </div>
          </button>
        </div>

        {/* Bottom Settings Button (iOS 27 Liquid Glass Touch Bar) */}
        <div className="w-full mt-3 pb-2">
          <button
            onClick={() => setCurrentApp('settings')}
            className="w-full h-15 py-3 rounded-2xl bg-white/70 dark:bg-[#181A20]/75 backdrop-blur-2xl border border-white/60 dark:border-white/12 shadow-[0_8px_30px_0_rgba(0,0,0,0.05)] flex items-center justify-between px-5 text-gray-800 dark:text-gray-200 font-semibold active:scale-[0.98] transition-all group hover:border-blue-500/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:rotate-45 transition-transform duration-300 shadow-sm">
                <Settings size={18} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold leading-tight">{t.launcher.settingsTitle}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">{t.launcher.settingsDesc}</span>
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