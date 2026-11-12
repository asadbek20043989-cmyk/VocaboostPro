import React, { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic } from '../services/telegram';
import { sfx } from '../services/sound';

/**
 * Harf-harf ochiladigan «Yordam» tizimi (so'z qidiruvi, harflarni tartiblash, hangman, diktant va h.k.).
 * 1-yordam `base` tanga, har keyingisi `step` tangaga qimmatroq (standart: 2, 3, 4, ...).
 * Har bir so'z/raundda hisob qaytadan boshlanadi (useHints reset() yoki key bilan qayta ochiladi).
 */
export interface HintCfg { base: number; step: number; free?: boolean }

/** O'yin sozlamalaridan yordam narxi sozlamasini oladi (admin paneldan o'zgartiriladi) */
export const hintCfgOf = (settings: Record<string, number> | undefined, free?: boolean): HintCfg => {
  const b = Number(settings?.hintBase);
  const s = Number(settings?.hintStep);
  return { base: Number.isFinite(b) && b >= 0 ? b : 2, step: Number.isFinite(s) && s >= 0 ? s : 1, free };
};

export function useHints(cfg: HintCfg) {
  const { coins, spendCoins } = useApp();
  const [used, setUsed] = useState(0);
  const [msg, setMsg] = useState('');
  const cost = cfg.free ? 0 : cfg.base + used * cfg.step;
  /** Narxni yechadi. Tanga yetmasa false qaytaradi va xabar ko'rsatadi */
  const ask = (): boolean => {
    if (!spendCoins(cost)) {
      setMsg(`Tanga yetarli emas — yordam ${cost} 🪙 turadi (sizda ${coins} 🪙)`);
      triggerHaptic('warning');
      sfx.wrong();
      return false;
    }
    setUsed(u => u + 1);
    setMsg('');
    triggerHaptic('light');
    return true;
  };
  const reset = () => { setUsed(0); setMsg(''); };
  return { used, cost, ask, reset, msg, coins, free: !!cfg.free };
}

export type HintApi = ReturnType<typeof useHints>;

export const HintButton: React.FC<{ h: HintApi; onUse: () => void; disabled?: boolean; className?: string }> = ({ h, onUse, disabled, className = '' }) => (
  <div className={`space-y-1 ${className}`}>
    <button
      type="button"
      disabled={disabled}
      onClick={onUse}
      className="mx-auto inline-flex items-center gap-2 pl-3 pr-2 h-10 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-200 text-xs font-bold disabled:opacity-35 active:scale-95 transition-all"
    >
      <Lightbulb className="w-4 h-4 text-amber-300" />
      <span>{h.used === 0 ? 'Yordam: harf ochish' : 'Yana bir harf'}</span>
      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold">{h.free ? 'bepul' : `🪙 ${h.cost}`}</span>
    </button>
    {h.msg && <div className="text-[11px] font-semibold text-rose-300">{h.msg}</div>}
  </div>
);
