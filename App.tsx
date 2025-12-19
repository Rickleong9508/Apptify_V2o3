import React, { useState, useEffect } from 'react';
import { Wallet, NotebookPen, ArrowRight, Sparkles, Settings, Cpu } from 'lucide-react';
import MyWealthApp from './components/MyWealthApp';
import GetNote from './components/GetNote';
import GlobalSettings from './components/GlobalSettings';
import AutoCount from './components/AutoCount';
import BetaTest from './components/BetaTest';

type AppMode = 'launcher' | 'mywealth' | 'getnote' | 'settings' | 'autocount' | 'betatest';

const App: React.FC = () => {
  const [currentApp, setCurrentApp] = useState<AppMode>('launcher');


  if (currentApp === 'mywealth') {
    return <MyWealthApp onExit={() => setCurrentApp('launcher')} />;
  }

  if (currentApp === 'getnote') {
    return <GetNote onExit={() => setCurrentApp('launcher')} />;
  }

  if (currentApp === 'settings') {
    return <GlobalSettings onExit={() => setCurrentApp('launcher')} />;
  }

  if (currentApp === 'autocount') {
    return <AutoCount onExit={() => setCurrentApp('launcher')} />;
  }

  if (currentApp === 'betatest') {
    return <BetaTest onExit={() => setCurrentApp('launcher')} />;
  }

  return (
    <div className="min-h-screen bg-[#E0E5EC] text-[#4A4A4A] flex flex-col items-center justify-start pt-16 md:pt-24 p-6 transition-all duration-500 font-sans selection:bg-gray-300">

      <div className="max-w-md w-full flex flex-col items-center gap-8 translate-y-[-20px] md:translate-y-[-40px]">

        {/* Header */}
        <div className="text-center space-y-2 animate-fade-in-down">
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
            { id: 'getnote', icon: NotebookPen, title: 'GetNote', desc: 'Second Brain' },
            { id: 'betatest', icon: Sparkles, title: 'BetaTest', desc: 'AI Stock Analyst' },
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

export default App;