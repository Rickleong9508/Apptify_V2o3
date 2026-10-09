import React from 'react';
import { ArrowRight } from 'lucide-react';
import BingGo from './BingGo';
import type { Translations } from '../utils/i18n';
import './BingGoUI.css';

/**
 * The launcher entry.
 *
 * Deliberately sparse: a large character, its name, one line, a few request
 * chips and a single action. The earlier version carried capability tiles and
 * factual rows, which made the launcher read as documentation rather than as a
 * character you can talk to.
 *
 * The character is pettable. Tapping it makes it pleased and gives it a shake —
 * the only part of this card that answers back, which is the point of putting it
 * at this size.
 */

export interface BingGoHomeCardProps {
  t: Translations['binggo'];
  onOpen: (opts?: { seed?: string; mode?: 'chat' | 'call' }) => void;
}

const BingGoHomeCard: React.FC<BingGoHomeCardProps> = ({ t, onOpen }) => {
  const chips = [t.quickExpense, t.quickNote, t.quickNetWorth];

  return (
    <div className="binggo-card">
      <span className="binggo-card__wash" aria-hidden="true" />

      <div className="relative z-10">
        <BingGo size={112} mood="idle" pettable label={t.name} />

        <h2 className="binggo-card__name mt-3.5 text-center">{t.name}</h2>
        <p className="binggo-card__sub mt-1 text-center">{t.tagline}</p>
        <p className="binggo-card__hint mt-2 text-center">{t.tapToPoke}</p>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              className="binggo-chip"
              onClick={() => onOpen({ seed: c })}
            >
              {c}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="binggo-card__cta mt-3.5"
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
