import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles, Flame, Rocket, ShieldAlert, Award } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { sfx } from '../services/sound';

export type RankDelta = {
  prev: number;
  curr: number;
  /** + means climbed up (e.g. from 10 to 5) */
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

/** Confetti particles for rank up celebration */
const CelebrationSparks: React.FC = () => {
  const sparks = [
    { left: '10%', delay: '0.1s', color: '#10B981' },
    { left: '25%', delay: '0.4s', color: '#FBBF24' },
    { left: '40%', delay: '0.2s', color: '#34D399' },
    { left: '60%', delay: '0.5s', color: '#60A5FA' },
    { left: '75%', delay: '0.15s', color: '#F59E0B' },
    { left: '90%', delay: '0.35s', color: '#A78BFA' },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
      {sparks.map((s, i) => (
        <span
          key={i}
          className="absolute -top-3 w-2.5 h-2.5 rounded-full animate-bounce opacity-80"
          style={{
            left: s.left,
            backgroundColor: s.color,
            animationDelay: s.delay,
            animationDuration: '1.4s',
            boxShadow: `0 0 10px ${s.color}`,
          }}
        />
      ))}
    </div>
  );
};

export const RankChangePopup: React.FC<{
  data: RankDelta;
  onClose: () => void;
}> = ({ data, onClose }) => {
  const played = useRef(false);
  const up = data.delta > 0;
  const down = data.delta < 0;
  const same = data.delta === 0;
  const abs = Math.abs(data.delta);

  // Animated ticker from prev to curr
  const [displayRank, setDisplayRank] = useState(data.prev);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    try {
      if (up) {
        sfx.win(true);
        triggerHaptic('heavy');
        setTimeout(() => triggerHaptic('success'), 200);
      } else if (down) {
        sfx.click?.();
        triggerHaptic('warning');
      } else {
        triggerHaptic('selection');
      }
    } catch {
      /* ignore */
    }

    // Number ticker animation
    if (data.prev !== data.curr) {
      const steps = Math.min(Math.abs(data.delta), 20);
      const stepDuration = 700 / steps;
      let currentStep = 0;
      const interval = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        const nextVal = Math.round(data.prev + (data.curr - data.prev) * progress);
        setDisplayRank(nextVal);
        if (currentStep >= steps) {
          clearInterval(interval);
          setDisplayRank(data.curr);
        }
      }, stepDuration);
      return () => clearInterval(interval);
    }
  }, [up, down, data.prev, data.curr, data.delta]);

  const title = up
    ? abs >= 5
      ? 'Raketa kabi uchdingiz! 🚀'
      : abs >= 2
        ? 'Ajoyib o‘sish — oldindasiz! 🔥'
        : 'Bir pog‘ona yuqoridasiz! ⚡'
    : down
      ? abs >= 5
        ? 'Raqiblar hujumga o‘tdi! ⚔️'
        : 'Reyting biroz tushdi! 🛡️'
      : 'O‘rningiz mustahkam! 👑';

  const subtitle = up
    ? `Siz #${data.prev}-o‘rindan #${data.curr}-o‘ringa ko‘tarildingiz!`
    : down
      ? `Siz #${data.prev}-o‘rindan #${data.curr}-o‘ringa tushdingiz.`
      : `Hozir ham faxrli #${data.curr}-o‘rindasiz — barqaror!`;

  const tip = up
    ? 'Zo‘r sur’at! Bugun yana bitta mashq qilsangiz, yetakchilar safida yanada mustahkam bo‘lasiz.'
    : down
      ? 'Raqiblar biroz oldinga o‘tib oldi. Bugun atigi 5 daqiqa mashq qilib, o‘z joyingizni qaytarib oling! 💪'
      : 'Joyingizni saqlab qoldingiz. Endi yuqoridagi raqiblarni ortda qoldirish vaqti keldi!';

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`keep-dark rc-pop relative w-full max-w-[340px] rounded-[32px] p-6 text-center shadow-2xl border-2 transition-all ${
          up
            ? 'bg-gradient-to-b from-[#0d2a1b] via-[#091815] to-[#060e18] border-emerald-400/60 shadow-emerald-500/25'
            : down
              ? 'bg-gradient-to-b from-[#2b0f15] via-[#1a0a0f] to-[#070b14] border-rose-500/60 shadow-rose-500/25'
              : 'bg-gradient-to-b from-[#192238] via-[#0f1728] to-[#070b14] border-amber-400/50 shadow-amber-500/20'
        }`}
      >
        {up && <CelebrationSparks />}

        {/* Ambient background glow */}
        <div
          className={`pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-40 ${
            up ? 'bg-emerald-400' : down ? 'bg-rose-500' : 'bg-amber-400'
          }`}
        />

        <div className="relative z-10">
          {/* Top animated badge icon */}
          <div className="mx-auto mb-3.5 relative flex items-center justify-center">
            <div
              className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl border ${
                up
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-emerald-500/30'
                  : down
                    ? 'bg-rose-500/20 border-rose-400/40 text-rose-300 shadow-rose-500/30'
                    : 'bg-amber-500/20 border-amber-400/40 text-amber-300 shadow-amber-500/30'
              }`}
            >
              {up ? (
                <div className="flex flex-col items-center">
                  <TrendingUp className="w-10 h-10 animate-bounce" strokeWidth={2.6} />
                </div>
              ) : down ? (
                <div className="flex flex-col items-center">
                  <TrendingDown className="w-10 h-10 animate-pulse" strokeWidth={2.6} />
                </div>
              ) : (
                <Award className="w-10 h-10" strokeWidth={2.4} />
              )}
            </div>

            {/* Floating micro pill */}
            <span
              className={`absolute -bottom-2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md border border-white/20 ${
                up
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/50'
                  : down
                    ? 'bg-rose-500 text-white shadow-rose-500/50'
                    : 'bg-amber-400 text-slate-950 shadow-amber-500/50'
              }`}
            >
              {up ? 'Yuqoriga 🚀' : down ? 'Qaytarib ol! ⚔️' : 'Mustahkam 👑'}
            </span>
          </div>

          <h3 className="mt-4 text-xl font-black text-white tracking-tight leading-tight">{title}</h3>
          <p className="mt-1.5 text-xs font-medium text-slate-300 leading-snug">{subtitle}</p>

          {/* Interactive Rank Transition Box */}
          <div className="my-5 p-3.5 rounded-2xl bg-[#060c18]/80 border border-white/10 flex items-center justify-around shadow-inner">
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Oldin</span>
              <span className="text-2xl font-black tabular-nums text-slate-400">#{data.prev}</span>
            </div>

            <div className="flex flex-col items-center justify-center px-1">
              <span
                className={`text-2xl font-black leading-none ${
                  up ? 'text-emerald-400 animate-pulse' : down ? 'text-rose-400 animate-pulse' : 'text-amber-400'
                }`}
              >
                {up ? '▲' : down ? '▼' : '➔'}
              </span>
              {!same && (
                <span
                  className={`mt-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                    up ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {up ? `+${abs}` : `−${abs}`}
                </span>
              )}
            </div>

            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Hozir</span>
              <span
                className={`text-3xl font-black tabular-nums transition-all ${
                  up ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]' : down ? 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'text-amber-300'
                }`}
              >
                #{displayRank}
              </span>
            </div>
          </div>

          {/* Motivation micro card */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11.5px] leading-relaxed text-slate-300">
            {tip}
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={onClose}
            className={`mt-4 w-full py-3.5 px-4 rounded-xl text-sm font-black tracking-wide shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
              up
                ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 hover:brightness-110 shadow-emerald-500/30'
                : down
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110 shadow-rose-500/30'
                  : 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 hover:brightness-110 shadow-amber-500/30'
            }`}
          >
            {up ? (
              <>
                <Rocket className="w-4 h-4" />
                Oldinga intilamiz!
              </>
            ) : down ? (
              <>
                <Flame className="w-4 h-4" />
                Joyimni qaytarib olaman!
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Mashqni boshlash!
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .rc-pop {
          animation: rcEntry 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes rcEntry {
          from {
            opacity: 0;
            transform: translateY(28px) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};
