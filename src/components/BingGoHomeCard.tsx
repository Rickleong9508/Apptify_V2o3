import React from 'react';
import { ArrowRight } from 'lucide-react';
import BingGo from './BingGo';
import type { Translations } from '../utils/i18n';
import './BingGoUI.css';

/**
 * The launcher entry.
 *
 * A blue panel with the character's body dropped out, so the page shows only
 * its two signature eyes — the same reduction the call screen uses, at launcher
 * size. On blue the body would be blue anyway, so nothing is hidden; the eyes
 * simply become the whole character.
 *
 * Everything else is gone: no capability tiles, no factual rows, no request
 * chips. One action, "Talk to BingGo". The eyes are still pettable, because
 * that is the one thing on this panel that answers back.
 */

export interface BingGoHomeCardProps {
  t: Translations['binggo'];
  onOpen: (opts?: { seed?: string; mode?: 'chat' | 'call' }) => void;
}

const BingGoHomeCard: React.FC<BingGoHomeCardProps> = ({ t, onOpen }) => {
  return (
    <div className="binggo-hero">
      <span className="binggo-hero__sheen" aria-hidden="true" />

      <div className="relative z-10 flex flex-col items-center w-full">
        <BingGo size={172} mood="idle" ghost autoBeat pettable label={t.name} />

        <h2 className="binggo-hero__name mt-2">{t.name}</h2>
        <p className="binggo-hero__hint mt-1.5">{t.tapToPoke}</p>

        <button
          type="button"
          className="binggo-hero__cta mt-5"
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
