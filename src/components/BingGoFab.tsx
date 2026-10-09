import React, { useCallback, useEffect, useRef, useState } from 'react';
import BingGo from './BingGo';
import './BingGoUI.css';

/**
 * The summon button. Present on every screen except the launcher, where the
 * hero panel already is the entry point and a second one would be redundant.
 *
 * It is the character itself rather than a generic glyph, and it blinks while
 * it waits — that is the whole reason it reads as present rather than as
 * another icon in the chrome.
 *
 * It can also be dragged anywhere the user wants it. Two details matter here:
 *
 *  - The tap is decided on pointerup, by distance travelled, NOT by a `click`
 *    handler. Capturing the pointer on pointerdown retargets `click` to the
 *    capturing element, which is exactly the bug that once made the old
 *    assistant's handle impossible to actually press. Handling both the drag
 *    and the tap in the pointer sequence avoids that class of bug entirely.
 *  - The position is clamped so it can never be parked underneath the dock,
 *    where it would be unreachable.
 */

const SIZE = 60;
const STORAGE_KEY = 'binggo_fab_pos_v1';
const MARGIN = 8;
const TAP_SLOP = 6;
/** The dock is 56px tall, 16px up — nothing may come to rest below this line. */
const DOCK_CLEARANCE = 76;

interface Pos { x: number; y: number; }

const readStored = (): Pos | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === 'number' && typeof p?.y === 'number') return p;
  } catch { /* corrupt or unavailable storage — fall back to the default spot */ }
  return null;
};

const clamp = (p: Pos): Pos => {
  const w = typeof window === 'undefined' ? 0 : window.innerWidth;
  const h = typeof window === 'undefined' ? 0 : window.innerHeight;
  const maxX = Math.max(MARGIN, w - SIZE - MARGIN);
  const maxY = Math.max(MARGIN, h - DOCK_CLEARANCE - SIZE);
  return {
    x: Math.min(Math.max(MARGIN, p.x), maxX),
    y: Math.min(Math.max(MARGIN, p.y), maxY),
  };
};

export interface BingGoFabProps {
  onOpen: () => void;
  /** Suppress while the assistant sheet is open, or on the launcher. */
  hidden?: boolean;
  label: string;
}

const BingGoFab: React.FC<BingGoFabProps> = ({ onOpen, hidden = false, label }) => {
  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const posRef = useRef<Pos | null>(null);
  const drag = useRef({ on: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  useEffect(() => { posRef.current = pos; }, [pos]);

  // Restore, clamped — the viewport may have changed since it was saved.
  useEffect(() => {
    const stored = readStored();
    if (stored) setPos(clamp(stored));
  }, []);

  // Keep it on screen and clear of the dock when the viewport changes.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { on: true, moved: false, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d.on) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    // Below the slop it is still a tap, so nothing moves under the finger.
    if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    d.moved = true;
    setPos(clamp({ x: d.ox + dx, y: d.oy + dy }));
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }

    if (d.moved) {
      const p = posRef.current;
      if (p) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* quota or blocked */ }
      }
      return;
    }
    onOpen();   // travelled less than the slop: it was a tap
  }, [onOpen]);

  if (hidden) return null;

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : {};

  return (
    <button
      type="button"
      className={`binggo-fab ${dragging && drag.current.moved ? 'binggo-fab--drag' : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      aria-label={label}
      title={label}
    >
      <BingGo size={SIZE} mood="idle" label={undefined} />
    </button>
  );
};

export default BingGoFab;
