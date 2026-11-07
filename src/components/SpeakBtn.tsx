import React from 'react';
import { Volume2 } from 'lucide-react';
import { speakEnglish } from '../services/speech';
import { triggerHaptic } from '../services/telegram';

/** Gap oldidagi kichkina ovoz belgisi: bosilganda gap talaffuzi eshittiriladi */
export const SpeakBtn: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <button
    type="button"
    aria-label="Gapni eshitish"
    title="Gap talaffuzini eshitish"
    onClick={e => {
      e.stopPropagation();
      triggerHaptic('light');
      speakEnglish(text);
    }}
    className={`inline-flex w-6 h-6 shrink-0 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 items-center justify-center active:scale-90 transition-all align-middle ${className}`}
  >
    <Volume2 className="w-3.5 h-3.5" />
  </button>
);
