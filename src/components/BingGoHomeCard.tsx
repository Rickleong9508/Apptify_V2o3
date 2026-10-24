import React from 'react';
import { ArrowRight, Phone } from 'lucide-react';
import BingGo from './BingGo';
import type { Translations } from '../utils/i18n';
import './BingGoUI.css';

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

        <div className="w-full flex items-center gap-2.5 mt-5">
          <button
            type="button"
            className="binggo-hero__cta flex-1"
            onClick={() => onOpen({ mode: 'chat' })}
          >
            {t.talkTo}
            <ArrowRight size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            onClick={() => onOpen({ mode: 'call' })}
            className="h-[52px] px-5 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shrink-0 border border-white/20"
            title={t.call}
            aria-label={t.call}
          >
            <Phone size={16} strokeWidth={2.2} />
            <span>{t.call}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BingGoHomeCard;
