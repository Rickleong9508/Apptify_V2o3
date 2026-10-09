import React, { useEffect, useRef, useState } from 'react';
import './BingGo.css';

/**
 * BingGo — the Apptify assistant.
 *
 * Rebuilt from the uploaded mark (a blue rounded square with two white pill
 * eyes) as live DOM rather than an image, because the whole point is that the
 * face can move: blink, think, be pleased, be sorry, listen, speak.
 *
 * Mood is a single prop. The component owns one extra piece of state on top of
 * it — the involuntary blink — so a caller can say "think" and still get a
 * character that feels alive rather than a frozen glyph.
 */

export type BingGoMood =
  | 'idle'
  | 'blink'
  | 'think'
  | 'happy'
  | 'sad'
  | 'listen'
  | 'speak';

export interface BingGoProps {
  /** The expression to hold. `blink` is accepted for manual control. */
  mood?: BingGoMood;
  /** Any CSS length. A bare number is treated as px. */
  size?: number | string;
  /** Blink at random intervals whenever the held mood is `idle`. */
  autoBlink?: boolean;
  /** Suppress the idle breathing loop. */
  still?: boolean;
  className?: string;
  /** Accessible name. Omit to render as decorative. */
  label?: string;
}

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const BingGo: React.FC<BingGoProps> = ({
  mood = 'idle',
  size = 96,
  autoBlink = true,
  still = false,
  className = '',
  label,
}) => {
  const [blinking, setBlinking] = useState(false);
  const timers = useRef<number[]>([]);

  // The involuntary blink. Runs only while the caller is holding `idle`, so it
  // can never fight a deliberate expression.
  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    if (!autoBlink || mood !== 'idle' || prefersReducedMotion()) {
      setBlinking(false);
      return clear;
    }

    let cancelled = false;

    const schedule = () => {
      const next = window.setTimeout(() => {
        if (cancelled) return;
        setBlinking(true);
        const restore = window.setTimeout(() => {
          if (cancelled) return;
          setBlinking(false);
          schedule();
        }, 140);
        timers.current.push(restore);
      }, 2200 + Math.random() * 3800);
      timers.current.push(next);
    };

    schedule();
    return () => {
      cancelled = true;
      clear();
    };
  }, [autoBlink, mood]);

  // No annotation needed: `data-mood` is read as a plain attribute string.
  const resolved = blinking ? 'blink' : mood;
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={`binggo ${still ? 'binggo--still' : ''} ${className}`.trim()}
      data-mood={resolved}
      style={{ ['--binggo-size' as any]: dimension }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="binggo__ring" />
      <span className="binggo__halo">
        <i /><i /><i />
      </span>
      <div className="binggo__body">
        <div className="binggo__eyes">
          <i className="binggo__eye binggo__eye--l" />
          <i className="binggo__eye binggo__eye--r" />
        </div>
      </div>
    </div>
  );
};

export default BingGo;
