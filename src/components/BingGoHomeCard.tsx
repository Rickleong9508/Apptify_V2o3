import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import BingGo from './BingGo';
import type { Translations } from '../utils/i18n';
import './BingGoUI.css';

/**
 * The launcher entry.
 *
 * Composed asymmetrically — character left, copy and affordance right — rather
 * than as a centred hero, so it reads as a working part of the launcher instead
 * of a banner. The character keeps blinking while it sits there.
 *
 * The quick chips are real entry points, not decoration: each one opens the
 * assistant with that request already understood.
 */

export interface BingGoHomeCardProps {
  t: Translations['binggo'];
  onOpen: (seed?: string) => void;
}

const BingGoHomeCard: React.FC<BingGoHomeCardProps> = ({ t, onOpen }) => {
  const chips = [t.quickExpense, t.quickNote, t.quickNetWorth];

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        className="binggo-card"
        onClick={() => onOpen()}
        aria-label={`${t.name} — ${t.ready}`}
      >
        <span className="binggo-card__wash" aria-hidden="true" />
        <BingGo size={60} mood="idle" label={undefined} />

        <span className="binggo-card__body">
          <span className="flex items-center gap-2">
            <span className="text-[17px] font-semibold tracking-tight text-[#0A0A0B]">
              {t.name}
            </span>
            <span className="binggo-live">
              <span className="binggo-live__dot" />
              {t.tagline}
            </span>
          </span>
          <span className="mt-0.5 block text-[12px] leading-snug text-[#0A0A0B]/52">
            {t.ready}
          </span>
        </span>

        <span
          className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2600FD] text-white"
          aria-hidden="true"
        >
          <ArrowUpRight size={16} strokeWidth={2.3} />
        </span>
      </button>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            className="binggo-chip"
            onClick={() => onOpen(c)}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BingGoHomeCard;
