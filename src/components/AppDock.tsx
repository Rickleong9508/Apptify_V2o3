import React from 'react';
import { Wallet, NotebookPen, Home, Radio, Settings } from 'lucide-react';

/**
 * AppDock — the global bottom navigation.
 *
 * The structural signature of the Ink & Signal system: an ink capsule with four
 * destinations and a raised centre Home button that turns yellow when active.
 * It maps 1:1 onto the five AppMode values that already drive routing, so no
 * new state was introduced.
 *
 * Layout note: the capsule is a 5-column GRID of equal tracks, and each item is
 * centred inside its own track. That makes the Home button mathematically
 * centred rather than approximately centred — an earlier flex/justify-around
 * version only happened to look centred, and drifted as soon as the two sides
 * held items of different widths.
 *
 * The raised button is lifted with a transform, not a negative margin, so it
 * never affects the grid's row height.
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

  const left = [
    { mode: 'mywealth' as DockMode, Icon: Wallet, title: label('MyWealth', '资产') },
    { mode: 'knowledgevault' as DockMode, Icon: NotebookPen, title: label('NoteDown', '便签') },
  ];

  const right = [
    { mode: 'newshub' as DockMode, Icon: Radio, title: label('NewsHub', '资讯') },
    { mode: 'settings' as DockMode, Icon: Settings, title: label('Settings', '设置') },
  ];

  const isOn = (mode: DockMode) => currentApp === mode;

  const DockItem: React.FC<{ mode: DockMode; Icon: typeof Wallet; title: string }> = ({
    mode, Icon, title,
  }) => (
    <button
      type="button"
      onClick={() => setCurrentApp(mode)}
      title={title}
      aria-label={title}
      aria-current={isOn(mode) ? 'page' : undefined}
      className={`justify-self-center flex flex-col items-center justify-center gap-[2px]
                  w-[42px] h-[42px] rounded-full transition-all duration-300 active:scale-90 cursor-pointer ${
        isOn(mode) ? 'text-white' : 'text-white/45 hover:text-white/75'
      }`}
    >
      <Icon size={18} strokeWidth={1.8} />
      <span
        className={`w-1 h-1 rounded-full bg-[#2600FD] transition-all duration-300 ${
          isOn(mode) ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
      />
    </button>
  );

  return (
    <nav
      aria-label={label('Primary navigation', '主导航')}
      className="fixed left-1/2 -translate-x-1/2 z-40
                 grid grid-cols-5 items-center
                 w-[calc(100%-40px)] max-w-[288px] h-[56px] px-1.5 rounded-full
                 bg-[#0A0A0B]
                 shadow-[0_10px_28px_-12px_rgba(10,10,11,0.55),inset_0_1px_0_rgba(255,255,255,0.1)]"
      style={{ bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
    >
      {left.map((it) => <DockItem key={it.mode} {...it} />)}

      {/* Centre track — Home. Centred within an equal track, so it is centred
          within the capsule by construction. */}
      <button
        type="button"
        onClick={() => setCurrentApp('launcher')}
        title={label('Home', '首页')}
        aria-label={label('Home', '首页')}
        aria-current={isOn('launcher') ? 'page' : undefined}
        className={`justify-self-center w-[46px] h-[46px] rounded-full
                    -translate-y-[13px] flex items-center justify-center cursor-pointer
                    transition-all duration-300 active:scale-90
                    shadow-[0_6px_16px_-6px_rgba(10,10,11,0.5),0_0_0_4px_#0A0A0B] ${
          isOn('launcher') ? 'bg-[#FFBF00] text-[#0A0A0B]' : 'bg-white text-[#0A0A0B]'
        }`}
      >
        <Home size={20} strokeWidth={1.9} />
      </button>

      {right.map((it) => <DockItem key={it.mode} {...it} />)}
    </nav>
  );
};

export default AppDock;
