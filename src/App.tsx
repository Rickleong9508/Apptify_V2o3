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
import AutoCount from './components/AutoCount';
import NewsHub from './components/NewsHub';
import AuthModal from './components/AuthModal';
import AskApptify from './components/AskApptify';

type AppMode = 'launcher' | 'mywealth' | 'knowledgevault' | 'settings' | 'autocount' | 'newshub';

const LauncherRobot: React.FC = () => {
  const [posX, setPosX] = useState(50); // percentage position (25% - 75%)
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isWalking, setIsWalking] = useState(true);
  const [timeStr, setTimeStr] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isRobotReplying, setIsRobotReplying] = useState(false);

  // Update date and time dynamically every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const date = now.getDate();
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const day = days[now.getDay()];
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${month}月${date}日 ${day} ${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Animate walking around
  useEffect(() => {
    if (!isWalking) return;
    const interval = setInterval(() => {
      setPosX(prev => {
        let next = prev;
        if (direction === 'right') {
          next += 0.35;
          if (next >= 72) {
            setDirection('left');
          }
        } else {
          next -= 0.35;
          if (next <= 28) {
            setDirection('right');
          }
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [direction, isWalking]);

  const handleInteraction = () => {
    setShowChat(prev => {
      const next = !prev;
      setIsWalking(!next);
      return next;
    });
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;

    setIsRobotReplying(true);
    setChatResponse(`🤖 收到指令: "${chatQuery}"，正在发送至 AI 助理执行...`);
    
    const queryToSend = chatQuery;
    setChatQuery('');

    setTimeout(() => {
      setIsRobotReplying(false);
      setShowChat(false);
      setIsWalking(true);
      setChatResponse('');

      // Dispatch event to open Ask Apptify with custom query
      const event = new CustomEvent('open_ask_apptify', {
        detail: { 
          query: queryToSend
        }
      });
      window.dispatchEvent(event);
    }, 1000);
  };

  return (
    <div className="w-full h-40 flex items-center relative select-none overflow-hidden sm:overflow-visible">
      {/* Centered Walking/Interactive Entity */}
      <div 
        onMouseEnter={() => setIsWalking(false)}
        onMouseLeave={() => { if (!showChat) setIsWalking(true); }}
        className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300"
        style={{
          left: `calc(${posX}% - 110px)`,
          transition: 'left 0.1s linear, transform 0.2s ease-out',
          width: '220px',
          zIndex: showChat ? 30 : 10
        }}
      >
        {/* Dynamic speech bubble */}
        {!showChat ? (
          <div 
            onClick={handleInteraction}
            className="mb-2 px-3 py-1.5 rounded-2xl bg-white/80 dark:bg-[#1E2025]/85 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-lg shadow-black/5 flex flex-col items-center gap-0.5 text-center w-52 relative cursor-pointer transform hover:scale-105 active:scale-95 transition-all duration-200 animate-bounce-soft"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold tracking-wide">今日时刻</span>
            </div>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{timeStr}</span>
            <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium leading-none mt-0.5">点我开启 AI 对话 💬</span>
            
            {/* Arrow */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white/80 dark:bg-[#1E2025]/85 border-r border-b border-white/50 dark:border-white/10" />
          </div>
        ) : (
          /* Mini Chat Dialogue Overlay */
          <div 
            className="mb-2 flex flex-col gap-2 w-56 p-3 rounded-2xl bg-white/95 dark:bg-[#1C1E23]/95 backdrop-blur-2xl border border-white/60 dark:border-white/15 shadow-2xl relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-1.5">
                <Bot size={13} className="text-blue-500" />
                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">Apptify 智能助手</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowChat(false); setIsWalking(true); }}
                className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 text-xs font-bold transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="text-[10px] text-gray-600 dark:text-gray-400 text-left font-medium leading-normal">
              <p className="font-semibold text-blue-600 dark:text-blue-400 mb-1">⏰ {timeStr}</p>
              <p className="line-clamp-2">{chatResponse || "可输入：“存100块到钱包” 或 “分析苹果股票”"}</p>
            </div>
            
            {!isRobotReplying ? (
              <form onSubmit={handleChatSubmit} className="flex gap-1.5 mt-1">
                <input
                  type="text"
                  placeholder="指令或对话..."
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-[11px] rounded-xl bg-gray-100/80 dark:bg-black/40 border border-gray-200 dark:border-white/10 outline-none text-gray-800 dark:text-gray-100 focus:border-blue-500 transition-colors"
                />
                <button 
                  type="submit"
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[10px] font-bold rounded-xl transition-all shadow-sm"
                >
                  发送
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5 justify-center py-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            )}

            {/* Arrow */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white/95 dark:bg-[#1C1E23]/95 border-r border-b border-white/60 dark:border-white/15" />
          </div>
        )}

        {/* Modern Spatial Glass Capsule */}
        <div 
          onClick={handleInteraction}
          className="w-[180px] h-[60px] rounded-2xl bg-white/70 dark:bg-[#1E2026]/70 backdrop-blur-xl p-2.5 flex items-center gap-2.5 cursor-pointer select-none border border-white/60 dark:border-white/10 shadow-lg shadow-black/5 hover:border-blue-500/50 hover:shadow-blue-500/10 transition-all duration-300 active:scale-95 group"
        >
          {/* SVG Robot Drawing */}
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-tr from-blue-500/10 to-purple-500/10 border border-blue-500/20">
            <svg 
              width="36" 
              height="36" 
              viewBox="0 0 64 64" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className={`transition-transform duration-300 ${direction === 'left' ? 'scale-x-[-1]' : ''}`}
            >
              {/* Antenna */}
              <path d="M32 14V8" stroke="#0071E3" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="32" cy="7" r="2.5" fill="#BF5AF2" className="animate-pulse" />

              {/* Ears */}
              <rect x="10" y="24" width="3" height="7" rx="1.5" fill="#9CA3AF" />
              <rect x="51" y="24" width="3" height="7" rx="1.5" fill="#9CA3AF" />

              {/* Body */}
              <rect x="16" y="26" width="32" height="24" rx="8" fill="#3B82F6" fillOpacity="0.15" stroke="#3B82F6" strokeWidth="1.5" />
              
              {/* Head */}
              <rect x="20" y="14" width="24" height="18" rx="6" fill="#3B82F6" fillOpacity="0.25" stroke="#3B82F6" strokeWidth="1.5" />

              {/* Screen / Face */}
              <rect x="23" y="17" width="18" height="12" rx="3" fill="#0D0E10" />
              
              {/* Eyes */}
              <circle cx="28" cy="23" r="2" fill="#34D399" className="animate-pulse" />
              <circle cx="36" cy="23" r="2" fill="#34D399" className="animate-pulse" />

              {/* Cheeks */}
              <circle cx="25" cy="27" r="1" fill="#F87171" />
              <circle cx="39" cy="27" r="1" fill="#F87171" />

              {/* Legs */}
              <rect x="25" y="50" width="3.5" height="7" rx="1.5" fill="#9CA3AF" className={isWalking ? "animate-bounce" : ""} />
              <rect x="35.5" y="50" width="3.5" height="7" rx="1.5" fill="#9CA3AF" className={isWalking ? "animate-bounce" : ""} style={{ animationDelay: '0.2s' }} />
            </svg>
          </div>

          {/* Capsule Text */}
          <div className="flex flex-col justify-center min-w-0">
            <span className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-tight group-hover:text-blue-500 transition-colors">Ask Apptify</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-0.5 leading-none truncate">点击随时语音对话</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentApp, setCurrentApp] = useState<AppMode>('launcher');

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

  const getAppTitle = () => {
    switch (currentApp) {
      case 'mywealth': return 'MyWealth 资产';
      case 'knowledgevault': return 'Knowledge Vault 知识库';
      case 'settings': return '系统设置';
      case 'autocount': return 'AutoCount 投研';
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

    if (currentApp === 'autocount') {
      return <AutoCount onExit={() => setCurrentApp('launcher')} />;
    }

    if (currentApp === 'newshub') {
      return <NewsHub onExit={() => setCurrentApp('launcher')} />;
    }

    // Default Launcher View (iOS Mobile-First)
    return (
      <div className="min-h-screen-safe w-full flex flex-col items-center justify-between px-4 py-6 sm:py-10 max-w-lg mx-auto selection:bg-blue-500/20">
        {/* Top Header & Theme Switcher */}
        <header className="w-full flex items-center justify-between pt-2 pb-4">
          <div className="flex flex-col text-left">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Apptify
            </h1>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wider uppercase mt-0.5">
              Personal OS
            </span>
          </div>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/70 dark:bg-white/10 backdrop-blur-xl border border-white/50 dark:border-white/15 shadow-sm text-gray-700 dark:text-gray-200 active:scale-95 transition-all"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-blue-600" />}
          </button>
        </header>

        {/* Mascot Interactive Zone */}
        <div className="w-full my-auto py-2">
          <LauncherRobot />
        </div>

        {/* Main 2x2 App Grid (iOS Touch-Friendly Cards) */}
        <div className="w-full grid grid-cols-2 gap-3.5 sm:gap-4 my-auto">
          {[
            { 
              id: 'mywealth', 
              icon: Wallet, 
              title: 'MyWealth', 
              desc: '个人资产与财务',
              color: 'from-emerald-500 to-teal-600',
              glow: 'hover:shadow-emerald-500/20'
            },
            { 
              id: 'autocount', 
              icon: Cpu, 
              title: 'AutoCount', 
              desc: 'AI 股票与估值研报',
              color: 'from-indigo-500 to-blue-600',
              glow: 'hover:shadow-indigo-500/20'
            },
            { 
              id: 'knowledgevault', 
              icon: NotebookPen, 
              title: 'Knowledge Vault', 
              desc: 'Obsidian 与第二大脑',
              color: 'from-amber-500 to-orange-600',
              glow: 'hover:shadow-amber-500/20'
            },
            { 
              id: 'newshub', 
              icon: Sparkles, 
              title: 'NewsHub Beta', 
              desc: '多源科技与财经动态',
              color: 'from-purple-500 to-pink-600',
              glow: 'hover:shadow-purple-500/20'
            },
          ].map((item, index) => (
            <button
              key={item.id}
              onClick={() => setCurrentApp(item.id as AppMode)}
              className={`group aspect-[1/1.05] rounded-3xl bg-white/70 dark:bg-[#1A1C22]/70 backdrop-blur-2xl p-4 sm:p-5 flex flex-col justify-between text-left border border-white/60 dark:border-white/10 shadow-lg shadow-black/5 ${item.glow} hover:border-white/90 dark:hover:border-white/20 active:scale-[0.96] transition-all duration-200 animate-fade-in-up`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* App Icon Container */}
              <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr ${item.color} flex items-center justify-center text-white shadow-md shadow-black/10 group-hover:scale-105 transition-transform duration-200`}>
                <item.icon size={22} strokeWidth={2.2} />
              </div>

              {/* Title & Desc */}
              <div className="mt-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  {item.title}
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1 leading-snug line-clamp-2">
                  {item.desc}
                </p>
              </div>

              {/* Action Indicator */}
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-semibold opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200">
                进入 <ArrowRight size={13} />
              </div>
            </button>
          ))}
        </div>

        {/* Bottom Settings Button (Full-width Touch Bar) */}
        <div className="w-full mt-4 pb-2">
          <button
            onClick={() => setCurrentApp('settings')}
            className="w-full h-14 rounded-2xl bg-white/65 dark:bg-[#1A1C22]/65 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-md shadow-black/5 flex items-center justify-between px-5 text-gray-800 dark:text-gray-200 font-semibold active:scale-[0.98] transition-all group hover:border-blue-500/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:rotate-45 transition-transform duration-300">
                <Settings size={18} />
              </div>
              <span className="text-sm font-bold">系统设置中心</span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 font-medium">
              AI 密钥与存储 <ArrowRight size={13} />
            </span>
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