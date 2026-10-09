import React, { useEffect, useRef, useState } from 'react';
import './BingGo.css';

/**
 * BingGo — the Apptify assistant.
 *
 * Rebuilt from the uploaded mark (a blue rounded square with two white pill
 * eyes) as live DOM rather than an image, because the whole point is that the
 * face can move: blink, think, be pleased, be sorry, listen, speak.
 *
 * Mood is a single prop. On top of it the component runs two involuntary
 * layers of its own, so a caller can say "idle" and still get something that
 * reads as alive rather than as a logo:
 *
 *   blink  a quick closure every few seconds, the way eyes actually work
 *   beat   a larger idle gesture — glance aside, double blink, wink, tilt,
 *          squash — picked at random and held briefly
 *
 * Both are suppressed the moment a real mood is set, so they can never fight a
 * deliberate expression.
 *
 * `ghost` drops the body and leaves only the eyes. On a blue surface the body
 * is the same blue as the background, so the character reduces to its two
 * signature eyes — which is how the call screen uses it.
 */

export type BingGoMood =
  | 'idle'
  | 'blink'
  | 'think'
  | 'happy'
  | 'sad'
  | 'listen'
  | 'speak';

export type BingGoBeat =
  | 'look-l'
  | 'look-r'
  | 'look-up'
  | 'blink2'
  | 'wink'
  | 'tilt-l'
  | 'tilt-r'
  | 'squash';

export interface BingGoProps {
  /** The expression to hold. `blink` is accepted for manual control. */
  mood?: BingGoMood;
  /** Any CSS length. A bare number is treated as px. */
  size?: number | string;
  /** Blink and fidget at random intervals whenever the held mood is `idle`. */
  autoBlink?: boolean;
  /** Also run the larger idle gestures. Off for small inline usages. */
  autoBeat?: boolean;
  /** Suppress the idle breathing loop. */
  still?: boolean;
  /** Drop the body; render only the eyes. For blue surfaces. */
  ghost?: boolean;
  /** Render the eyes solid ink instead of white. For white surfaces. */
  ink?: boolean;
  /** Let it be tapped. A tap makes it pleased and gives it a shake. */
  pettable?: boolean;
  /** Fired on each tap, so a host can react too. */
  onPet?: () => void;
  className?: string;
  /** Accessible name. Omit to render as decorative. */
  label?: string;
}

const BEATS: BingGoBeat[] = [
  'look-l', 'look-r', 'look-up', 'blink2', 'wink', 'tilt-l', 'tilt-r', 'squash',
];

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const BingGo: React.FC<BingGoProps> = ({
  mood = 'idle',
  size = 96,
  autoBlink = true,
  autoBeat = true,
  still = false,
  ghost = false,
  ink = false,
  pettable = false,
  onPet,
  className = '',
  label,
}) => {
  const [blinking, setBlinking] = useState(false);
  const [petting, setPetting] = useState(false);
  const petTimer = useRef<number | null>(null);
  const [beat, setBeat] = useState<BingGoBeat | null>(null);
  const timers = useRef<number[]>([]);
  const idle = mood === 'idle';

  // The quick involuntary blink.
  useEffect(() => {
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    if (!autoBlink || !idle || prefersReducedMotion()) { setBlinking(false); return clear; }

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
    return () => { cancelled = true; clear(); };
  }, [autoBlink, idle]);

  // The larger idle gestures. Deliberately irregular — a fixed cadence reads as
  // an animation loop, a random one reads as a creature.
  useEffect(() => {
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    if (!autoBlink || !autoBeat || !idle || prefersReducedMotion()) { setBeat(null); return clear; }

    let cancelled = false;
    let last: BingGoBeat | null = null;

    const schedule = () => {
      const next = window.setTimeout(() => {
        if (cancelled) return;
        // Avoid repeating the previous gesture, so it never reads as a loop.
        const pool = BEATS.filter((b) => b !== last);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        last = pick;
        setBeat(pick);
        const hold = 560 + Math.random() * 640;
        const restore = window.setTimeout(() => {
          if (cancelled) return;
          setBeat(null);
          schedule();
        }, hold);
        timers.current.push(restore);
      }, 2600 + Math.random() * 5200);
      timers.current.push(next);
    };
    schedule();
    return () => { cancelled = true; clear(); };
  }, [autoBlink, autoBeat, idle]);

  /* Being petted. Held long enough for the shake to finish, then released back
     to whatever the caller was holding. */
  const pet = () => {
    if (!pettable) return;
    onPet?.();
    setPetting(true);
    if (petTimer.current) window.clearTimeout(petTimer.current);
    petTimer.current = window.setTimeout(() => setPetting(false), 900);
  };

  useEffect(() => () => { if (petTimer.current) window.clearTimeout(petTimer.current); }, []);

  // A pet overrides everything, including a deliberate mood: it is a direct
  // response to the user touching it and should never be swallowed.
  const resolved = petting ? 'happy' : (blinking && idle ? 'blink' : mood);
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={`binggo ${still ? 'binggo--still' : ''} ${ghost ? 'binggo--ghost' : ''} ${ink ? 'binggo--ink' : ''} ${pettable ? 'binggo--pettable' : ''} ${className}`.trim()}
      data-mood={resolved}
      data-beat={idle && !blinking && !petting ? (beat ?? 'none') : 'none'}
      data-pet={petting ? 'true' : undefined}
      style={{ ['--binggo-size' as any]: dimension }}
      onClick={pettable ? pet : undefined}
      onKeyDown={pettable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pet(); } } : undefined}
      role={pettable ? 'button' : (label ? 'img' : undefined)}
      tabIndex={pettable ? 0 : undefined}
      aria-label={label ?? (pettable ? 'BingGo' : undefined)}
      aria-hidden={!pettable && !label ? true : undefined}
    >
      <span className="binggo__ring" />
      <span className="binggo__halo"><i /><i /><i /></span>
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
