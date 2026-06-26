import React, { useState, useEffect } from 'react';
import { Wallet, NotebookPen, ArrowRight, Sparkles, Settings, Cpu, ArrowLeft, ChevronDown } from 'lucide-react';
import MyWealthApp from './components/MyWealthApp';
import KnowledgeVault from './components/KnowledgeVault';
import GlobalSettings from './components/GlobalSettings';
import AutoCount from './components/AutoCount';
import NewsHub from './components/NewsHub';
import AuthModal from './components/AuthModal';
import AskApptify from './components/AskApptify';

type AppMode = 'launcher' | 'mywealth' | 'knowledgevault' | 'settings' | 'autocount' | 'newshub';

const App: React.FC = () => {
  const [currentApp, setCurrentApp] = useState<AppMode>('launcher');

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
          <div className="text-center space-y-2 animate-fade-in-down w-full relative">
            <h1 className="text-6xl font-bold tracking-tight text-[#444] drop-shadow-sm">
              Apptify
            </h1>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Next Gen Personal OS</p>
          </div>

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
      )}
      <div className={currentApp !== 'launcher' ? 'pt-24' : ''}>
        {renderSubApp()}
      </div>
      <AskApptify currentApp={currentApp} setCurrentApp={setCurrentApp} />
    </>
  );
};

export default App;