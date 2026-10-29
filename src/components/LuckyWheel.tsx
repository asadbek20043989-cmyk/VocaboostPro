import React, { useEffect, useMemo, useRef, useState } from 'react';
import { animate } from 'motion';
import { ArrowLeft, Gift, Users, Clock, Crown, ShieldCheck, Zap, Copy, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WheelPrize } from '../data/wheel';
import { triggerHaptic, shareReferral, getReferralLink, REFERRAL_TEXT } from '../services/telegram';
import { sfx } from '../services/sound';
import { HeaderActions } from './Brand';
import { nowMs } from '../services/time';

const SIZE = 320;
const C = SIZE / 2;
const RIM = 20; // gold rim thickness
const R_IN = C - RIM;

const polar = (angleDeg: number, radius: number) => {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: C + radius * Math.cos(a), y: C + radius * Math.sin(a) };
};

const slicePath = (i: number, STEP: number) => {
  const p0 = polar(i * STEP, R_IN);
  const p1 = polar((i + 1) * STEP, R_IN);
  return `M ${C} ${C} L ${p0.x} ${p0.y} A ${R_IN} ${R_IN} 0 0 1 ${p1.x} ${p1.y} Z`;
};

const pad = (n: number) => String(n).padStart(2, '0');

function useCountdown(targetMs: number, active: boolean) {
  const calc = () => {
    const s = Math.max(0, Math.floor((targetMs - nowMs()) / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  };
  const [text, setText] = useState(calc);
  useEffect(() => {
    if (!active) return;
    setText(calc());
    const id = setInterval(() => setText(calc()), 1000);
    return () => clearInterval(id);
  }, [active, targetMs]);
  return text;
}

const CONFETTI_COLORS = ['#F59E0B', '#FBBF24', '#EC4899', '#8B5CF6', '#22C55E', '#38BDF8', '#EF4444'];

const Confetti: React.FC<{ count?: number }> = ({ count = 46 }) => {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.8 + Math.random() * 1.6,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: Math.random() * 360,
      })),
    [count]
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="lw-confetti"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.5, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }}
        />
      ))}
    </div>
  );
};

export const LuckyWheel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { profile, wheel, freeSpinsLeft, totalSpinsLeft, isPro, spinWheel, applyPrize, grantReferralSpin, wheelPrizes, wheelFreeSpins } = useApp();
  const WHEEL_PRIZES = wheelPrizes;
  const DAILY_FREE_SPINS = wheelFreeSpins;
  const STEP = 360 / WHEEL_PRIZES.length;

  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelPrize | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const lastSliceRef = useRef(-1);

  const noSpins = totalSpinsLeft <= 0 && !spinning;
  const countdown = useCountdown(wheel.lockedUntil, noSpins && wheel.lockedUntil > 0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const handleSpin = () => {
    if (spinning || totalSpinsLeft <= 0) return;
    const res = spinWheel();
    if (!res) return;
    const { prize, usedFree } = res;

    setWinner(null);
    setSpinning(true);
    triggerHaptic('heavy');

    const index = WHEEL_PRIZES.findIndex(p => p.id === prize.id);
    const jitter = (Math.random() - 0.5) * STEP * 0.6;
    const desiredMod = (360 - (index * STEP + STEP / 2) + jitter + 720) % 360;
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    const delta = (desiredMod - currentMod + 360) % 360;
    const target = rotationRef.current + 360 * 6 + delta;

    animate(rotationRef.current, target, {
      duration: 5.4,
      ease: [0.12, 0.72, 0.12, 1],
      onUpdate: v => {
        rotationRef.current = v;
        setRotation(v);
        const slice = Math.floor((((360 - (v % 360)) + 360) % 360) / STEP);
        if (slice !== lastSliceRef.current) {
          lastSliceRef.current = slice;
          triggerHaptic('light'); // aylanish paytidagi yengil vibratsiya
          sfx.tick();
        }
      },
      onComplete: () => {
        rotationRef.current = target;
        setRotation(target);
        setSpinning(false);
        applyPrize(prize, usedFree); // sovrin faqat endi hisobga qo'shiladi
        setWinner(prize);
        triggerHaptic('success');
        setTimeout(() => triggerHaptic('heavy'), 160);
        sfx.win(prize.big);
      },
    });
  };

  const link = getReferralLink();

  const reward = () => {
    if (grantReferralSpin()) {
      triggerHaptic('success');
      showToast('+1 ta aylantirish huquqi berildi! 🎉');
    }
  };

  const handleShare = () => {
    if (!shareReferral()) {
      showToast("Ulashib bo'lmadi. Havolani nusxalab yuboring.");
      return;
    }
    reward();
  };

  const handleCopy = async () => {
    const full = `${REFERRAL_TEXT}\n${link}`;
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = full;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    triggerHaptic('success');
    showToast('Matn va havola nusxalandi ✅');
    reward();
  };

  const proLeftHours = Math.max(0, Math.ceil((wheel.proUntil - nowMs()) / 3600000));
  const bigWin = !!winner?.big;
  const lights = Array.from({ length: 24 }, (_, i) => polar((i * 360) / 24, C - RIM / 2));

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F17] overflow-y-auto">
      <div className="min-h-full max-w-md mx-auto px-4 pt-4 pb-10 flex flex-col items-center relative">
        {/* Header */}
        <div className="w-full flex items-center gap-3">
          <button
            type="button"
            disabled={spinning}
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="h-10 pl-2.5 pr-3.5 rounded-xl bg-[#151C28] border border-slate-800 flex items-center gap-1.5 text-slate-200 text-sm font-semibold disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" /> Orqaga
          </button>
          <div className="order-last"><HeaderActions /></div>
          <div className="flex-1 text-right">
            <h2 className="text-lg font-bold text-white tracking-tight">Omadli Baraban</h2>
            <p className="text-[11px] text-slate-400">Har {DAILY_FREE_SPINS} urinishdan keyin kutish vaqti bor</p>
          </div>
        </div>

        {/* Active effects (faqat yutib bo'lingandan keyin) */}
        {(wheel.doubleXpPending || isPro || wheel.streakSavers > 0) && !spinning && (
          <div className="w-full flex flex-wrap gap-2 mt-3">
            {wheel.doubleXpPending && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-pink-500/15 text-pink-300 border border-pink-500/30">
                <Zap className="w-3 h-3" /> 2x XP faol
              </span>
            )}
            {isPro && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Crown className="w-3 h-3" /> VIP/Pro ~{proLeftHours} soat
              </span>
            )}
            {wheel.streakSavers > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                <ShieldCheck className="w-3 h-3" /> Streak muzlatish ❄️ × {wheel.streakSavers}
              </span>
            )}
          </div>
        )}

        {/* Wheel stage */}
        <div className="relative mt-8" style={{ width: SIZE, height: SIZE }}>
          {/* golden aura: rotating rays + pulsing glow */}
          <div className="lw-rays absolute -inset-10 rounded-full opacity-70" />
          <div className={`absolute -inset-4 rounded-full blur-2xl bg-amber-400 lw-glow ${spinning ? 'lw-glow-fast' : ''}`} />

          {/* pointer */}
          <div className="absolute left-1/2 -top-5 -translate-x-1/2 z-30 drop-shadow-lg">
            <svg width="40" height="48" viewBox="0 0 40 48">
              <defs>
                <linearGradient id="ptr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FFF3B0" />
                  <stop offset="1" stopColor="#D97706" />
                </linearGradient>
              </defs>
              <path d="M20 48 L3 12 Q20 -4 37 12 Z" fill="url(#ptr)" stroke="#7C4A03" strokeWidth="2" />
              <circle cx="20" cy="15" r="4.5" fill="#7C2D12" />
            </svg>
          </div>

          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative z-10" style={{ transform: `rotate(${rotation}deg)` }}>
            <defs>
              <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#FFF3B0" />
                <stop offset="0.35" stopColor="#F5B301" />
                <stop offset="0.7" stopColor="#B45309" />
                <stop offset="1" stopColor="#FCD34D" />
              </linearGradient>
              <radialGradient id="shade" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#000" stopOpacity="0.38" />
                <stop offset="0.45" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#fff" stopOpacity="0.14" />
              </radialGradient>
              <radialGradient id="hub" cx="40%" cy="35%" r="70%">
                <stop offset="0" stopColor="#FFF3B0" />
                <stop offset="0.6" stopColor="#F59E0B" />
                <stop offset="1" stopColor="#92400E" />
              </radialGradient>
              <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.6" />
              </filter>
            </defs>

            {/* gold rim */}
            <circle cx={C} cy={C} r={C - 1} fill="url(#gold)" />
            <circle cx={C} cy={C} r={R_IN + 2} fill="#3B2300" />

            {WHEEL_PRIZES.map((p, i) => {
              const mid = i * STEP + STEP / 2;
              const ePos = polar(mid, R_IN * 0.8);
              const tPos = polar(mid, R_IN * 0.5);
              return (
                <g key={p.id}>
                  <path d={slicePath(i, STEP)} fill={p.color} />
                  <path d={slicePath(i, STEP)} fill="url(#shade)" stroke="#FCD34D" strokeOpacity="0.85" strokeWidth="1.5" />
                  <text x={ePos.x} y={ePos.y} fontSize="24" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${mid} ${ePos.x} ${ePos.y})`} filter="url(#soft)">
                    {p.emoji}
                  </text>
                  <text
                    x={tPos.x}
                    y={tPos.y}
                    fontSize="13"
                    fontWeight="800"
                    fill="#fff"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${mid} ${tPos.x} ${tPos.y})`}
                    filter="url(#soft)"
                    style={{ letterSpacing: '0.2px' }}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}

            {/* rim lights */}
            {lights.map((l, i) => (
              <circle key={i} cx={l.x} cy={l.y} r="3.4" fill="#FFF8D6" className={`lw-bulb ${i % 2 ? 'lw-bulb-b' : ''} ${spinning ? 'lw-bulb-fast' : ''}`} />
            ))}

            {/* hub */}
            <circle cx={C} cy={C} r="30" fill="url(#gold)" />
            <circle cx={C} cy={C} r="24" fill="url(#hub)" stroke="#7C4A03" strokeWidth="2" />
            <text x={C} y={C + 1} fontSize="22" textAnchor="middle" dominantBaseline="middle">⭐</text>
          </svg>
        </div>

        {/* Spin button / timer */}
        <div className="w-full mt-9 space-y-3">
          {!noSpins ? (
            <button
              type="button"
              onClick={handleSpin}
              disabled={spinning}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-extrabold text-base shadow-lg shadow-amber-500/30 active:scale-[0.97] transition-all disabled:opacity-60"
            >
              {spinning ? 'Aylanmoqda…' : `AYLANTIRISH (${totalSpinsLeft} ta qoldi)`}
            </button>
          ) : (
            <div className="w-full rounded-2xl bg-[#151C28] border border-slate-800 p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Clock className="w-4 h-4" />
                <span>Imkoniyatlar tugadi</span>
              </div>
              <div className="mt-1 text-base font-bold text-amber-400 tabular-nums">Keyingi imkoniyatga: {countdown} qoldi</div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
            {Array.from({ length: DAILY_FREE_SPINS }).map((_, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < freeSpinsLeft ? 'bg-amber-400' : 'bg-slate-700'}`} />
            ))}
            {wheel.bonusSpins + wheel.grantSpins > 0 && <span className="text-emerald-400 font-semibold">+{wheel.bonusSpins + wheel.grantSpins} bonus</span>}
          </div>

          {/* Referral */}
          <button
            type="button"
            onClick={() => setShowInvite(v => !v)}
            disabled={spinning}
            className="w-full p-3.5 rounded-2xl bg-[#151C28] hover:bg-[#1B2433] border border-slate-800 flex items-center gap-3 text-left transition-colors disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">Do&apos;stingni taklif qil</div>
              <div className="text-[11px] text-slate-400">Yana +1 ta aylantirish huquqi oling</div>
            </div>
            <Gift className="w-5 h-5 text-amber-400" />
          </button>

          {showInvite && (
            <div className="rounded-2xl bg-[#151C28] border border-emerald-500/30 p-3.5 space-y-3">
              <div className="rounded-xl bg-[#0E1524] border border-slate-800 p-3 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                {REFERRAL_TEXT}
                {'\n'}
                <span className="text-sky-400 break-all">{link}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={handleCopy} className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5">
                  <Copy className="w-4 h-4" /> Nusxalash
                </button>
                <button type="button" onClick={handleShare} className="h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5">
                  <Send className="w-4 h-4" /> Telegramda yuborish
                </button>
              </div>
              <p className="text-[10px] text-slate-500">Do&apos;st yoki chatni tanlab yuboring. Bonus urinish kuniga 1 marta beriladi.</p>
            </div>
          )}
        </div>

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-white shadow-xl max-w-[90%] text-center">
            {toast}
          </div>
        )}
      </div>

      {/* Winner overlay */}
      {winner && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <Confetti count={bigWin ? 90 : 46} />
          <div className="lw-pop relative w-full max-w-xs rounded-3xl bg-gradient-to-b from-[#1B2433] to-[#121822] border-2 border-amber-400/60 p-6 text-center shadow-2xl shadow-amber-500/20">
            <div className="text-xs font-bold tracking-widest text-amber-400 uppercase">{bigWin ? '🔥 Super yutuq! 🔥' : 'Tabriklaymiz!'}</div>
            <div className="lw-emoji text-7xl my-4">{winner.emoji}</div>
            <div className="text-2xl font-extrabold text-white tracking-tight">{winner.title}</div>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">{winner.description}</p>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setWinner(null);
              }}
              className="mt-5 w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm active:scale-[0.97] transition-all"
            >
              {winner.id === 'lucky_spin' ? 'Yana aylantirish 🍀' : "Zo'r!"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
