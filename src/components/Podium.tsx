import React from 'react';
import { Avatar } from './Avatar';

type Rank = 1 | 2 | 3;
const THEME: Record<Rank, { cls: string; label: string; text: string; bar: string; h: number; size: number }> = {
  1: { cls: 'pd-gold', label: '1', text: 'text-amber-300', bar: 'from-amber-300 via-amber-400 to-amber-600', h: 78, size: 72 },
  2: { cls: 'pd-silver', label: '2', text: 'text-sky-300', bar: 'from-sky-100 via-sky-300 to-sky-500', h: 56, size: 56 },
  3: { cls: 'pd-bronze', label: '3', text: 'text-orange-400', bar: 'from-orange-200 via-orange-400 to-orange-600', h: 42, size: 56 },
};

/** Tojsimon SVG (faqat 1-o'rin uchun) */
const Crown: React.FC<{ w: number }> = ({ w }) => (
  <svg viewBox="0 0 64 44" width={w} height={(w * 44) / 64} className="pd-crown" aria-hidden>
    <defs>
      <linearGradient id="pd-cg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FEF08A" />
        <stop offset="0.55" stopColor="#FBBF24" />
        <stop offset="1" stopColor="#B45309" />
      </linearGradient>
    </defs>
    <path d="M6 38 L2 12 L18 24 L32 4 L46 24 L62 12 L58 38 Z" fill="url(#pd-cg)" stroke="#92400E" strokeWidth="1.5" strokeLinejoin="round" />
    <rect x="6" y="36" width="52" height="6" rx="2.5" fill="#F59E0B" stroke="#92400E" strokeWidth="1.2" />
    <circle cx="2" cy="12" r="3.2" fill="#FFF7C2" stroke="#B45309" />
    <circle cx="32" cy="4" r="3.6" fill="#FFF7C2" stroke="#B45309" />
    <circle cx="62" cy="12" r="3.2" fill="#FFF7C2" stroke="#B45309" />
    <circle cx="32" cy="29" r="3.4" fill="#EF4444" stroke="#7F1D1D" />
    <circle cx="19" cy="31" r="2.2" fill="#38BDF8" stroke="#075985" />
    <circle cx="45" cy="31" r="2.2" fill="#34D399" stroke="#065F46" />
  </svg>
);

/** Porlab turuvchi avatar: har bir o'rin o'z rangida. 1-o'rinda toj, hammasida aylanuvchi halqa va yulduzchalar */
export const GlowAvatar: React.FC<{ rank: Rank; src?: string; name: string; size?: number; frame?: string; crown?: boolean }> = ({ rank, src, name, size, frame, crown }) => {
  const t = THEME[rank];
  const px = size || t.size;
  return (
    <div className={`pd-wrap ${t.cls}`} style={{ width: px, height: px, marginTop: rank === 1 ? 18 : 0 }}>
      <span className="pd-halo" />
      <span className="pd-ring" />
      {(rank === 1 || crown) && (
        <span className="pd-crown-pos">
          <Crown w={Math.round(px * 0.78)} />
        </span>
      )}
      <span className="pd-spark" style={{ top: -4, right: -2, animationDelay: '0s' }} />
      <span className="pd-spark" style={{ bottom: 2, left: -6, animationDelay: '0.7s' }} />
      {rank === 1 && <span className="pd-spark" style={{ top: 10, left: -10, animationDelay: '1.3s' }} />}
      <div className="pd-avatar" style={{ width: px - 8, height: px - 8, overflow: 'hidden' }}>
        <Avatar src={src} name={name} frame={frame} crown={crown} className="w-full h-full" />
      </div>
    </div>
  );
};

export interface PodiumUser {
  id: string;
  name: string;
  avatar?: string;
  xp: number;
  refCount?: number;
  frame?: string;
  crown?: boolean;
  vipCheck?: boolean;
  glowingNick?: boolean;
  titleBadge?: string;
}

/** TOP-3 podiumi: 2-1-3 tartibida, pastida pog'onalar. `badges` — haftalik chempionlik soni (ixtiyoriy) */
export const Podium: React.FC<{ users: PodiumUser[]; badges?: Record<string, { gold: number; top3: number }>; mode?: 'xp' | 'referral' }> = ({ users, badges, mode = 'xp' }) => {
  const order: Rank[] = [2, 1, 3];
  return (
    <div className="flex items-end justify-center gap-2 pt-2">
      {order.map(rank => {
        const u = users[rank - 1];
        const t = THEME[rank];
        if (!u) return <div key={rank} className="w-[30%]" />;
        const b = badges?.[u.id];
        return (
          <div key={rank} className="flex flex-col items-center w-[31%] min-w-0">
            <GlowAvatar rank={rank} src={u.avatar} name={u.name} frame={u.frame} crown={u.crown} />
            <div className="flex items-center gap-1 max-w-full justify-center mt-2 flex-wrap">
              <span className={`text-xs font-extrabold max-w-full truncate text-center ${rank === 1 ? 'text-sm' : ''} ${u.glowingNick ? 'bg-gradient-to-r from-amber-300 via-rose-300 to-amber-200 bg-clip-text text-transparent font-black drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-white'}`}>{u.name}</span>
              {u.vipCheck && <span className="w-3.5 h-3.5 rounded-full bg-sky-500 text-white text-[9px] flex items-center justify-center font-black shrink-0" title="VIP">✓</span>}
            </div>
            {u.titleBadge && (
              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 truncate max-w-full text-center mt-0.5">
                {u.titleBadge}
              </span>
            )}
            {b && b.gold > 0 && <span className="text-[10px] font-bold text-amber-300">🏆 ×{b.gold} hafta</span>}
            <span className={`text-[11px] font-mono font-extrabold tabular-nums ${t.text}`}>
              {mode === 'referral' ? `${(u.refCount || 0).toLocaleString()} ta do'st` : `${u.xp.toLocaleString()} XP`}
            </span>
            <div className={`pd-base mt-1.5 w-full rounded-t-xl bg-gradient-to-b ${t.bar} flex items-center justify-center shadow-lg`} style={{ height: t.h }}>
              <span className="text-2xl font-black text-black/55 drop-shadow-sm">{t.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
