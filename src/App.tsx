import React, { useState, useEffect } from 'react';
import { Wallet, NotebookPen, ArrowRight, Sparkles, Settings, Cpu, ArrowLeft, ChevronDown, Sun, Moon } from 'lucide-react';
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
      const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const day = days[now.getDay()];
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${year}年${month}月${date}日 ${day} ${hours}:${minutes}:${seconds}`);
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
          next += 0.4;
          if (next >= 75) {
            setDirection('left');
          }
        } else {
          next -= 0.4;
          if (next <= 25) {
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
    setChatResponse(`🤖 收到指令: "${chatQuery}"，正在帮您发送至 AI 助理执行...`);
    
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
    }, 1200);
  };

  return (
    <div className="w-full h-44 flex items-center relative select-none">
      {/* Centered Walking/Interactive Entity */}
      <div 
        onMouseEnter={() => setIsWalking(false)}
        onMouseLeave={() => { if (!showChat) setIsWalking(true); }}
        className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300"
        style={{
          left: `calc(${posX}% - 112px)`, // centered: half of w-56 (224px) is 112px
          transition: 'left 0.1s linear, transform 0.2s ease-out',
          width: '224px',
          zIndex: showChat ? 30 : 10
        }}
      >
        {/* Dynamic speech bubble */}
        {!showChat ? (
          <div 
            onClick={handleInteraction}
            className="mb-2 px-3 py-1.5 rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-md flex flex-col items-center gap-0.5 text-center w-56 relative cursor-pointer transform hover:scale-105 active:scale-95 transition-all duration-300 animate-bounce-soft"
            style={{
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.05)",
            }}
          >
            <span className="text-[9px] text-blue-500 font-extrabold uppercase tracking-wider">今日时刻</span>
            <span className="text-[11px] font-extrabold text-gray-800 dark:text-gray-100">{timeStr}</span>
            <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium leading-none mt-1">🤖 点我开启 AI 互动</span>
            
            {/* Arrow */}
            <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-white/90 dark:border-t-zinc-900/90" />
          </div>
        ) : (
          /* Mini Chat Dialogue Overlay */
          <div 
            className="mb-2 flex flex-col gap-2 w-56 p-3 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-lg relative"
            onClick={(e) => e.stopPropagation()} // Prevent propagation from triggering handleInteraction again
            style={{
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-blue-500">Apptify 智能助手</span>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowChat(false); setIsWalking(true); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="text-[10px] text-gray-600 dark:text-gray-400 text-left font-medium leading-normal">
              <p className="font-extrabold text-blue-600 dark:text-blue-400 mb-1">⏰ {timeStr}</p>
              <p>{chatResponse || "您可以对我说：“帮我存100块到钱包” 或 “帮我做理财分析”。"}</p>
            </div>
            
            {!isRobotReplying ? (
              <form onSubmit={handleChatSubmit} className="flex gap-1.5 mt-1">
                <input
                  type="text"
                  placeholder="输入对话或指令..."
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  className="flex-1 px-2 py-1 text-[11px] rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 outline-none text-gray-800 dark:text-gray-100 focus:border-blue-500"
                />
                <button 
                  type="submit"
                  className="px-2.5 py-1 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-[10px] font-bold rounded-lg transition-all"
                >
                  发送
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5 justify-center py-1.5">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            )}

            {/* Arrow */}
            <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-white/95 dark:border-t-zinc-900/95" />
          </div>
        )}

        {/* Neumorphic Interactive Card */}
        <div 
          onClick={handleInteraction}
          className="w-[185px] h-[64px] rounded-[24px] bg-[#E0E5EC] p-3 flex items-center gap-3 cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
          style={{
            boxShadow: "6px 6px 12px rgb(163,177,198,0.6), -6px -6px 12px rgba(255,255,255, 0.5)",
          }}
        >
          {/* SVG Robot Drawing */}
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
            <svg 
              width="40" 
              height="40" 
              viewBox="0 0 64 64" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className={`animate-bounce-soft duration-[2s] ${direction === 'left' ? 'scale-x-[-1]' : ''}`}
            >
              {/* Head Antenna */}
              <path d="M32 14V8" stroke="#1082FF" strokeWidth="3" strokeLinecap="round" />
              <circle cx="32" cy="7" r="3" fill="#BF5AF2" className="animate-pulse" />

              {/* Ears */}
              <rect x="8" y="24" width="4" height="8" rx="2" fill="#8E8E93" />
              <rect x="52" y="24" width="4" height="8" rx="2" fill="#8E8E93" />

              {/* Body */}
              <rect x="16" y="26" width="32" height="24" rx="8" fill="url(#robotBodyGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" className="backdrop-blur-md" />
              
              {/* Head */}
              <rect x="20" y="14" width="24" height="18" rx="6" fill="url(#robotHeadGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />

              {/* Screen / Face */}
              <rect x="23" y="17" width="18" height="12" rx="3" fill="#1C1C1E" />
              
              {/* Eyes - Blinking */}
              <circle cx="28" cy="23" r="2.5" fill="#30D158" className="animate-pulse" />
              <circle cx="36" cy="23" r="2.5" fill="#30D158" className="animate-pulse" />

              {/* Cheeks */}
              <circle cx="25" cy="27" r="1" fill="#FF453A" />
              <circle cx="39" cy="27" r="1" fill="#FF453A" />

              {/* Hands */}
              <path d="M12 34C12 34 8 36 8 40" stroke="#8E8E93" strokeWidth="3" strokeLinecap="round" />
              <path d="M52 34C52 34 56 36 56 40" stroke="#8E8E93" strokeWidth="3" strokeLinecap="round" />

              {/* Legs */}
              <rect x="24" y="50" width="4" height="8" rx="2" fill="#8E8E93" className={isWalking ? "animate-bounce" : ""} />
              <rect x="36" y="50" width="4" height="8" rx="2" fill="#8E8E93" className={isWalking ? "animate-bounce" : ""} style={{ animationDelay: '0.2s' }} />

              {/* Gradients */}
              <defs>
                <linearGradient id="robotHeadGrad" x1="20" y1="14" x2="44" y2="32" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.45)" />
                </linearGradient>
                <linearGradient id="robotBodyGrad" x1="16" y1="26" x2="48" y2="50" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.55)" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Card Text Content */}
          <div className="flex flex-col justify-center min-w-0">
            <span className="text-xs font-extrabold text-gray-700 leading-tight">Ask Apptify</span>
            <span className="text-[9px] text-gray-500 font-bold mt-0.5 leading-none truncate">点击与 AI 助手对话</span>
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
    } else {
      root.classList.remove('dark');
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
      case 'mywealth': return 'MyWealth';
      case 'knowledgevault': return 'Knowledge Vault';
      case 'settings': return 'Global Settings';
      case 'autocount': return 'AutoCount';
      case 'newshub': return 'NewsHub';
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

    return (
      <div className="min-h-screen bg-[#E0E5EC] text-[#4A4A4A] flex flex-col items-center justify-start pt-16 md:pt-24 p-6 transition-all duration-500 font-sans selection:bg-gray-300">
        <div className="max-w-md w-full flex flex-col items-center gap-8 translate-y-[-20px] md:translate-y-[-40px]">
          {/* Header */}
          <div className="text-center space-y-2 animate-fade-in-down w-full relative flex flex-col items-center justify-center">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="absolute top-0 right-2 p-2.5 rounded-full text-gray-600 dark:text-gray-300 bg-[#E0E5EC] hover:scale-105 active:scale-95 transition-all border border-white/40 shadow-sm"
              style={{
                boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
              }}
            >
              {theme === 'dark' ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} className="text-indigo-600" />}
            </button>
            <h1 className="text-6xl font-bold tracking-tight text-[#444] drop-shadow-sm">
              Apptify
            </h1>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Next Gen Personal OS</p>
          </div>

          {/* Interactive walking robot */}
          <LauncherRobot />

          {/* 2x2 Grid Layout */}
          <div className="grid grid-cols-2 gap-6 w-full px-2">
            {[
              { id: 'mywealth', icon: Wallet, title: 'MyWealth', desc: 'Finance & Portfolio' },
              { id: 'autocount', icon: Cpu, title: 'AutoCount', desc: 'AI Object Valuation' },
              { id: 'knowledgevault', icon: NotebookPen, title: 'Knowledge Vault', desc: 'Second Brain' },
              { id: 'newshub', icon: Sparkles, title: 'NewsHub Beta', desc: 'Tech & Trends' },
            ].map((item, index) => (
              <button
                key={item.id}
                onClick={() => setCurrentApp(item.id as AppMode)}
                className="group aspect-square rounded-[35px] bg-[#E0E5EC] p-5 flex flex-col justify-between text-left transition-all duration-300 hover:scale-[1.02] active:scale-95 animate-fade-in-up opacity-0"
                style={{
                  boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                  animationDelay: `${index * 100}ms`
                }}
              >
                {/* Icon Container - Raised Neumorphic */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-gray-700 mb-2 transition-transform group-hover:-translate-y-1"
                  style={{
                    background: "#E0E5EC",
                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                  }}
                >
                  <item.icon size={22} strokeWidth={2} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-800 leading-tight group-hover:text-blue-600 transition-colors">{item.title}</h2>
                  <p className="text-[10px] text-gray-500 font-medium mt-1 leading-snug">{item.desc}</p>
                </div>

                <div className="flex items-center gap-1 text-[#6B7280] group-hover:text-blue-500 transition-colors text-xs font-semibold mt-2 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 duration-300">
                  Launch <ArrowRight size={14} />
                </div>
              </button>
            ))}
          </div>

          {/* Settings Button - Wide Pill */}
          <button
            onClick={() => setCurrentApp('settings')}
            className="w-full flex items-center gap-4 py-4 px-8 rounded-[30px] bg-[#E0E5EC] text-gray-700 font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 hover:text-blue-600 group animate-fade-in-up opacity-0"
            style={{
              boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
              animationDelay: '400ms'
            }}
          >
            <div className="group-hover:rotate-90 transition-transform duration-500">
              <Settings size={24} />
            </div>
            <span className="text-lg">Settings</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {currentApp !== 'launcher' && (
        <div className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none animate-fade-in-down animate-duration-300">
          <div 
            className="w-[95%] sm:w-[90%] max-w-4xl flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3 rounded-full bg-[#E0E5EC]/90 backdrop-blur-md border border-white/50 pointer-events-auto"
            style={{
              boxShadow: "9px 9px 16px rgb(163,177,198,0.3), -9px -9px 16px rgba(255,255,255, 0.8)"
            }}
          >
          {/* Back to Launcher Button */}
          <button
            onClick={() => setCurrentApp('launcher')}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:gap-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold text-gray-600 hover:text-blue-500 transition-all bg-[#E0E5EC] hover:scale-105 active:scale-95 border border-white/40"
            style={{
              boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
            }}
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Active App Title */}
          <span className="font-extrabold text-[10px] sm:text-xs text-gray-700 uppercase tracking-widest pl-1 sm:pl-2 truncate max-w-[100px] sm:max-w-none">
            {getAppTitle()}
          </span>

          {/* Right actions container */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center justify-center p-1.5 sm:p-2 rounded-full text-gray-600 dark:text-gray-300 hover:text-blue-500 transition-all bg-[#E0E5EC] border border-white/40"
              style={{
                boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
              }}
            >
              {theme === 'dark' ? <Sun size={14} className="text-amber-500" /> : <Moon size={14} className="text-indigo-600" />}
            </button>

            {/* Global AI Model Dropdown Selection */}
            <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:gap-2 sm:px-4 sm:py-2 rounded-full text-xs font-extrabold text-purple-600 hover:text-purple-700 transition-all bg-[#E0E5EC] border border-white/40"
              style={{
                boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
              }}
            >
              <Cpu size={14} />
              <span className="max-w-[60px] sm:max-w-[120px] truncate">
                {activeModel.includes('/') ? activeModel.split('/').pop() : activeModel}
              </span>
              <ChevronDown size={14} />
            </button>

            {showDropdown && (
              <>
                {/* Backdrop Click Shield */}
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowDropdown(false)} />
                
                {/* Dropdown Card */}
                <div 
                  className="absolute right-0 mt-2.5 w-56 sm:w-64 rounded-2xl p-3 sm:p-4 bg-[#E0E5EC] border border-white/50 z-50 shadow-2xl max-h-[320px] overflow-y-auto no-scrollbar"
                  style={{
                    boxShadow: "10px 10px 20px rgb(163,177,198,0.4), -10px -10px 20px rgba(255,255,255, 0.8)"
                  }}
                >
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-300/40">
                    <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Select AI Model</span>
                    <span className="text-[9px] font-extrabold text-purple-500 uppercase px-2 py-0.5 rounded-full bg-purple-50">
                      {activeProvider}
                    </span>
                  </div>

                  {/* Pinned Favorites */}
                  {favorites.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[9px] font-extrabold text-amber-500 uppercase tracking-wider block mb-1">⭐ Favorites</span>
                      <div className="space-y-1">
                        {favorites.map(id => (
                          <button
                            key={id}
                            onClick={() => handleSelectModel(id)}
                            className={`w-full text-left p-2 rounded-xl text-xs font-bold transition-all truncate hover:bg-black/5 ${activeModel === id ? 'text-purple-600' : 'text-gray-600'}`}
                          >
                            {id.includes('/') ? id.split('/').pop() : id}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recently Used */}
                  {recentModels.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">🕒 Recent</span>
                      <div className="space-y-1">
                        {recentModels.filter(id => !favorites.includes(id)).map(id => (
                          <button
                            key={id}
                            onClick={() => handleSelectModel(id)}
                            className={`w-full text-left p-2 rounded-xl text-xs font-bold transition-all truncate hover:bg-black/5 ${activeModel === id ? 'text-purple-600' : 'text-gray-600'}`}
                          >
                            {id.includes('/') ? id.split('/').pop() : id}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Retrieved Models / Current Provider Models */}
                  <div>
                    <span className="text-[9px] font-extrabold text-blue-500 uppercase tracking-wider block mb-1">📋 All Models</span>
                    <div className="space-y-1">
                      {modelsList.length > 0 ? (
                        modelsList.map(m => (
                          <button
                            key={m.id}
                            onClick={() => handleSelectModel(m.id)}
                            className={`w-full text-left p-2 rounded-xl text-xs font-bold transition-all truncate hover:bg-black/5 ${activeModel === m.id ? 'text-purple-600' : 'text-gray-600'}`}
                          >
                            {m.name || (m.id.includes('/') ? m.id.split('/').pop() : m.id)}
                          </button>
                        ))
                      ) : (
                        <p className="text-[9px] text-gray-400 italic p-2">No models found in cache.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
      )}
      <div className={currentApp !== 'launcher' ? 'pt-24 bg-[#E0E5EC] min-h-screen' : ''}>
        {renderSubApp()}
      </div>
      <AskApptify currentApp={currentApp} setCurrentApp={setCurrentApp} />
    </>
  );
};

export default App;