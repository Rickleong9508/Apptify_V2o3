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
    // Open Ask Apptify with custom welcome detail
    const event = new CustomEvent('open_ask_apptify', {
      detail: { 
        query: `你好！请帮我分析一下我的财务与笔记状况。`
      }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="w-full h-20 flex items-center relative select-none">
      {/* Neumorphic Interactive Card */}
      <div 
        onClick={handleInteraction}
        onMouseEnter={() => setIsWalking(false)}
        onMouseLeave={() => setIsWalking(true)}
        className="w-[185px] h-[64px] rounded-[24px] bg-[#E0E5EC] p-3 flex items-center gap-3 cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] absolute top-1/2 -translate-y-1/2"
        style={{
          left: `calc(${posX}% - 92.5px)`,
          boxShadow: "6px 6px 12px rgb(163,177,198,0.6), -6px -6px 12px rgba(255,255,255, 0.5)",
          transition: 'left 0.1s linear, transform 0.2s ease-out'
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

    if (modelId === 'deepseek/deepseek-r1' || modelId === 'anthropic/claude-3.7-sonnet' || modelId === 'openai/gpt-4o') {
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
          { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },
          { id: 'openai/gpt-4o', name: 'GPT-4o' }
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