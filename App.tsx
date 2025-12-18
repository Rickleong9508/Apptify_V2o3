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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 text-text-main flex items-center justify-center p-6 transition-all duration-500">

      {/* Theme Toggle */}


      <div className="max-w-6xl w-full space-y-16 animate-fade-in py-10">

        <div className="text-center space-y-4 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter bg-gradient-to-r from-blue-600 via-purple-600 to-teal-500 bg-clip-text text-transparent py-2">
            Apptify
          </h1>
          <p className="text-xl text-text-muted font-medium tracking-wide">Next Gen Personal OS</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 px-4">

          {/* Card Component Helper */}
          {[
            { id: 'mywealth', icon: Wallet, title: 'MyWealth', desc: 'Finance & Portfolio', color: 'blue', gradient: 'from-blue-500/20 to-blue-600/5' },
            { id: 'autocount', icon: Cpu, title: 'AutoCount', desc: 'AI Object Valuation', color: 'cyan', gradient: 'from-cyan-500/20 to-cyan-600/5' },
            { id: 'getnote', icon: NotebookPen, title: 'GetNote', desc: 'Second Brain', color: 'purple', gradient: 'from-purple-500/20 to-purple-600/5' },
            { id: 'betatest', icon: Sparkles, title: 'BetaTest', desc: 'AI Stock Analyst', color: 'teal', gradient: 'from-teal-500/20 to-teal-600/5' },
            { id: 'settings', icon: Settings, title: 'Settings', desc: 'Configuration', color: 'gray', gradient: 'from-gray-500/20 to-gray-600/5' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentApp(item.id as AppMode)}
              className="group relative h-80 rounded-[40px] overflow-hidden text-left transition-all duration-500 hover:-translate-y-2"
            >
              {/* Liquid Glass Background - Frosted Blue Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-blue-500/5 to-transparent backdrop-blur-2xl border border-white/40 shadow-xl transition-all duration-500 group-hover:bg-blue-400/30 group-hover:shadow-[0_20px_50px_rgba(59,130,246,0.15)]"></div>

              {/* Inner Gradient Glow */}
              <div className={`absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br ${item.gradient} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>

              <div className="relative z-10 h-full flex flex-col justify-between p-8">
                <div>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg backdrop-blur-md bg-white/50 dark:bg-white/5 border border-white/20 text-${item.color}-500 group-hover:scale-110 transition-transform duration-500`}>
                    <item.icon size={32} />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">{item.title}</h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{item.desc}</p>
                </div>

                <div className={`flex items-center gap-2 text-${item.color}-600 dark:text-${item.color}-400 font-bold group-hover:translate-x-3 transition-transform duration-300`}>
                  Launch <ArrowRight size={20} />
                </div>
              </div>
            </button>
          ))}

        </div>

        <div className="text-center pt-12 pb-6 opacity-40 hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
            <Sparkles size={14} /> Intelligence by Gemini
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;