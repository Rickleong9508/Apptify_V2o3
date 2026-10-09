import React from 'react';
import BingGo from './BingGo';
import './BingGoUI.css';

/**
 * The summon button. Present on every screen so BingGo is always one tap away,
 * and deliberately the character itself rather than a generic sparkle glyph —
 * it blinks while it waits, which is the whole reason it reads as present
 * rather than as another icon in the chrome.
 *
 * Hidden while the assistant is open, and offset to clear the dock.
 */

export interface BingGoFabProps {
  onOpen: () => void;
  /** Suppress while the assistant sheet is open. */
  hidden?: boolean;
  label: string;
}

const BingGoFab: React.FC<BingGoFabProps> = ({ onOpen, hidden = false, label }) => {
  if (hidden) return null;

  return (
    <button
      type="button"
      className="binggo-fab"
      onClick={onOpen}
      aria-label={label}
      title={label}
    >
      <BingGo size={38} mood="idle" label={undefined} />
    </button>
  );
};

export default BingGoFab;
