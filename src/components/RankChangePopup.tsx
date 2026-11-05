import React, { useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { sfx } from '../services/sound';

export type RankDelta = {
  prev: number;
  curr: number;
  /** + means rose (better rank number is lower) */
  delta: number;
};

const KEY = 'vb_last_rank_v1';

export function loadLastRank(): number | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveLastRank(place: number) {
  try {
    if (place > 0) localStorage.setItem(KEY, String(place));
  } catch {
    /* ignore */
  }
}

/**
 * Kreativ reyting o'zgarishi oynasi.
 * Birinchi kirishda ko'rsatilmaydi (prev yo'q).
 * O'sish = pastga tushgan raqam (1-o'rin eng yaxshi).
 */
export const RankChangePopup: React.FC<{
  data: RankDelta;
  onClose: () => void;
}> = ({ data, onClose }) => {
  const played = useRef(false);
  const up = data.delta > 0;
  const down = data.delta < 0;
  const same = data.delta === 0;
  const abs = Math.abs(data.delta);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    try {
      if (up) sfx.success?.() || sfx.levelUp?.();
      else if (down) sfx.click?.();
      triggerHaptic(up ? 'medium' : 'light');
    } catch {
      /* ignore */
    }
  }, [up, down]);

  const title = up
    ? abs >= 5
      ? 'Raketa kabi uchdingiz! 🚀'
      : abs >= 2
        ? 'Yuqoriga ko‘tarildingiz!'
        : 'Bir pog‘ona yuqoridasiz!'
    : down
      ? abs >= 5
        ? 'Bugun biroz orqada qoldingiz'
        : 'Reyting biroz tushdi'
      : 'Joy saqlanib qoldi';

  const subtitle = up
    ? `Siz ${data.prev}-o‘rindan ${data.curr}-o‘ringa ko‘tarildingiz`
    : down
      ? `Siz ${data.prev}-o‘rindan ${data.curr}-o‘ringa tushdingiz`
      : `Hozir ham ${data.curr}-o‘rindasiz — barqaror!`;

  const tip = up
    ? 'Davom eting — eng yuqori pog‘onalar yaqin!'
    : down
      ? 'Bugun 5–10 daqiqa mashq qilsangiz, qaytib olasiz 💪'
      : 'Kunlik streak va so‘zlar bilan yetakchilikni ushlang';

  return (
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center px-5 bg-black/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`rc-pop w-full max-w-[320px] rounded-[28px] border p-6 text-center shadow-2xl relative overflow-hidden ${
          up
            ? 'bg-gradient-to-b from-[#0F2A1A] to-[#0B1220] border-emerald-400/45'
            : down
              ? 'bg-gradient-to-b from-[#2A1218] to-[#0B1220] border-rose-400/40'
              : 'bg-gradient-to-b from-[#1A2030] to-[#0B1220] border-slate-500/40'
        }`}
      >
        {/* soft glow */}
        <div
          className={`absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-40 pointer-events-none ${
            up ? 'bg-emerald-500' : down ? 'bg-rose-500' : 'bg-slate-500'
          }`}
        />

        <div className="relative">
          <div
            className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl ${
              up ? 'bg-emerald-500/20 text-emerald-300' : down ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-500/20 text-slate-300'
            }`}
          >
            {up ? <TrendingUp className="w-9 h-9" strokeWidth={2.4} /> : down ? <TrendingDown className="w-9 h-9" strokeWidth={2.4} /> : <Minus className="w-9 h-9" strokeWidth={2.4} />}
          </div>

          <h3 className="text-lg font-extrabold text-white leading-snug">{title}</h3>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">{subtitle}</p>

          {/* big rank numbers */}
          <div className="mt-5 flex items-center justify-center gap-3">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Oldin</div>
              <div className="text-3xl font-black tabular-nums text-slate-400">#{data.prev}</div>
            </div>
            <div className={`text-2xl font-bold ${up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-slate-500'}`}>
              {up ? '↑' : down ? '↓' : '→'}
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Hozir</div>
              <div className={`text-3xl font-black tabular-nums ${up ? 'text-emerald-300' : down ? 'text-rose-300' : 'text-white'}`}>
                #{data.curr}
              </div>
            </div>
          </div>

          {!same && (
            <div
              className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                up ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {up ? `+${abs} o‘rin` : `−${abs} o‘rin`}
            </div>
          )}

          <p className="mt-4 text-[13px] leading-relaxed text-slate-400">{tip}</p>

          <button
            type="button"
            onClick={onClose}
            className={`mt-5 w-full rounded-xl py-3 text-sm font-bold transition active:scale-[0.98] ${
              up
                ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                : down
                  ? 'bg-rose-500 text-white hover:bg-rose-400'
                  : 'bg-slate-600 text-white hover:bg-slate-500'
            }`}
          >
            {up ? 'Davom etamiz! 🔥' : down ? 'Mashq qilishga o‘tish' : 'Yaxshi'}
          </button>
        </div>
      </div>

      <style>{`
        .rc-pop { animation: rcIn 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes rcIn {
          from { opacity: 0; transform: translateY(24px) scale(0.94); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
};
