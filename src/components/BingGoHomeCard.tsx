import React from 'react';
import { ArrowRight, Brain, Languages, Zap, AppWindow, Volume2, Mic } from 'lucide-react';
import BingGo from './BingGo';
import type { Translations } from '../utils/i18n';
import './BingGoUI.css';

/**
 * The launcher entry.
 *
 * Structured after the reference the user supplied: an identity hero, a couple
 * of factual rows, then an inset panel holding capability tiles and a set of
 * selectable request chips, closed by an action bar with one circular
 * secondary and one wide primary.
 *
 * The point of the chips being selectable rather than decorative is that they
 * are real entry points — tapping one opens the assistant already working on
 * that request, and the pre-selected chip shows that these are choices.
 */

export interface BingGoHomeCardProps {
  t: Translations['binggo'];
  onOpen: (opts?: { seed?: string; mode?: 'chat' | 'call' }) => void;
}

const BingGoHomeCard: React.FC<BingGoHomeCardProps> = ({ t, onOpen }) => {
  const tiles = [
    { icon: <Brain size={16} strokeWidth={2.1} />, value: t.tileMemory, label: t.tileMemoryLabel },
    { icon: <Languages size={16} strokeWidth={2.1} />, value: t.tileLanguage, label: t.tileLanguageLabel },
    { icon: <Zap size={16} strokeWidth={2.1} />, value: t.tileActions, label: t.tileActionsLabel },
  ];

  const chips = [t.quickExpense, t.quickNetWorth, t.quickNote, t.quickStory];

  return (
    <div className="binggo-card">
      <span className="binggo-card__wash" aria-hidden="true" />

      {/* Identity hero */}
      <div className="relative z-10 flex items-start gap-3.5">
        <BingGo size={62} mood="idle" label={undefined} />

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="binggo-card__label">{t.yourAssistant}</div>
          <div className="binggo-card__name mt-1">{t.name}</div>
        </div>

        <span className="binggo-live pt-1.5">
          <span className="binggo-live__dot" />
          {t.ready}
        </span>
      </div>

      {/* Facts */}
      <div className="relative z-10 mt-3 space-y-1.5">
        <div className="binggo-card__fact">
          <AppWindow size={13} strokeWidth={2.1} />
          <span>{t.runsInside}</span>
        </div>
        <div className="binggo-card__fact">
          <Volume2 size={13} strokeWidth={2.1} />
          <span>{t.bilingualFact}</span>
        </div>
      </div>

      {/* Inset panel */}
      <div className="binggo-card__panel">
        <div className="binggo-card__label">{t.canDo}</div>

        <div className="binggo-tiles mt-2.5">
          {tiles.map((x) => (
            <div key={x.label} className="binggo-tile">
              <span className="binggo-tile__icon">{x.icon}</span>
              <span className="binggo-tile__value">{x.value}</span>
              <span className="binggo-tile__label">{x.label}</span>
            </div>
          ))}
        </div>

        <div className="binggo-card__label mt-4">{t.tryAsking}</div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2.5 -mx-0.5 px-0.5">
          {chips.map((c, i) => (
            <button
              key={c}
              type="button"
              className={`binggo-chip ${i === 1 ? 'binggo-chip--on' : ''}`}
              onClick={() => onOpen({ seed: c })}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className="binggo-card__bar">
        <button
          type="button"
          className="binggo-card__ghost"
          onClick={() => onOpen({ mode: 'call' })}
          aria-label={t.call}
          title={t.call}
        >
          <Mic size={17} strokeWidth={2.1} />
        </button>
        <button
          type="button"
          className="binggo-card__cta"
          onClick={() => onOpen()}
        >
          {t.talkTo}
          <ArrowRight size={16} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
};

export default BingGoHomeCard;
