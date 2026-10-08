import React from 'react';
import { Wallet, NotebookPen, Home, Radio, Settings } from 'lucide-react';

/**
 * AppDock — the global bottom navigation.
 *
 * This is the structural signature of the Ink & Signal system: a black capsule
 * with four destinations and a raised centre Home button that turns yellow when
 * active. It replaces the previous "Back to Launcher" pattern and mirrors the
 * five AppMode values that already drive routing, so no new state was added.
 *
 * AppMode is declared locally rather than imported from App.tsx to avoid a
 * circular dependency (App renders this component).
 */

type DockMode = 'launcher' | 'mywealth' | 'knowledgevault' | 'settings' | 'newshub';

interface AppDockProps {
  currentApp: DockMode;
  setCurrentApp: (mode: DockMode) => void;
  lang: 'en' | 'zh';
}

const AppDock: React.FC<AppDockProps> = ({ currentApp, setCurrentApp, lang }) => {
  const label = (en: string, zh: string) => (lang === 'zh' ? zh : en);

  const items = [
    { mode: 'mywealth' as DockMode, Icon: Wallet, title: label('MyWealth', '资产') },
    { mode: 'knowledgevault' as DockMode, Icon: NotebookPen, title: label('NoteDown', '便签') },
    { mode: 'newshub' as DockMode, Icon: Radio, title: label('NewsHub', '资讯') },
    { mode: 'settings' as DockMode, Icon: Settings, title: label('Settings', '设置') },
  ];

  const isOn = (mode: DockMode) => currentApp === mode;

  const itemClass = (mode: DockMode) =>
    `relative flex flex-col items-center justify-center gap-[3px] w-[52px] h-[52px] rounded-full transition-all duration-300 active:scale-90 cursor-pointer ${
      isOn(mode) ? 'text-white' : 'text-white/45 hover:text-white/75'
    }`;

  return (
    <nav
      aria-label={label('Primary navigation', '主导航')}
      className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center justify-around
                 w-[calc(100%-32px)] max-w-[344px] h-[68px] px-2 rounded-full
                 bg-[#0A0A0B] dark:bg-[#141416]
                 shadow-[0_12px_34px_-12px_rgba(10,10,11,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]"
      style={{ bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Left pair */}
      {items.slice(0, 2).map(({ mode, Icon, title }) => (
        <button key={mode} type="button" onClick={() => setCurrentApp(mode)} title={title} aria-label={title}
          aria-current={isOn(mode) ? 'page' : undefined} className={itemClass(mode)}>
          <Icon size={21} strokeWidth={1.8} />
          <span className={`w-1 h-1 rounded-full bg-[#2600FD] transition-all duration-300 ${
            isOn(mode) ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`} />
        </button>
      ))}

      {/* Raised centre — Home */}
      <button
        type="button"
        onClick={() => setCurrentApp('launcher')}
        title={label('Home', '首页')}
        aria-label={label('Home', '首页')}
        aria-current={isOn('launcher') ? 'page' : undefined}
        className={`w-[56px] h-[56px] rounded-full -mt-[22px] flex items-center justify-center cursor-pointer
                    transition-all duration-300 active:scale-90
                    shadow-[0_8px_22px_-6px_rgba(10,10,11,0.5),0_0_0_5px_#0A0A0B] dark:shadow-[0_8px_22px_-6px_rgba(0,0,0,0.7),0_0_0_5px_#141416] ${
          isOn('launcher') ? 'bg-[#FFBF00] text-[#0A0A0B]' : 'bg-white text-[#0A0A0B]'
        }`}
      >
        <Home size={22} strokeWidth={1.9} />
      </button>

      {/* Right pair */}
      {items.slice(2).map(({ mode, Icon, title }) => (
        <button key={mode} type="button" onClick={() => setCurrentApp(mode)} title={title} aria-label={title}
          aria-current={isOn(mode) ? 'page' : undefined} className={itemClass(mode)}>
          <Icon size={21} strokeWidth={1.8} />
          <span className={`w-1 h-1 rounded-full bg-[#2600FD] transition-all duration-300 ${
            isOn(mode) ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`} />
        </button>
      ))}
    </nav>
  );
};

export default AppDock;
