import React from 'react';
import { Avatar } from './Avatar';
import { CosName, CosLike } from './Cosmetics';

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
export const GlowAvatar: React.FC<{ rank: Rank; src?: string; name: string; size?: number }> = ({ rank, src, name, size }) => {
  const t = THEME[rank];
  const px = size || t.size;
  return (
    <div className={`pd-wrap ${t.cls}`} style={{ width: px, height: px, marginTop: rank === 1 ? 18 : 0 }}>
      <span className="pd-halo" />
      <span className="pd-ring" />
      {rank === 1 && (
        <span className="pd-crown-pos">
          <Crown w={Math.round(px * 0.78)} />
        </span>
      )}
      <span className="pd-spark" style={{ top: -4, right: -2, animationDelay: '0s' }} />
      <span className="pd-spark" style={{ bottom: 2, left: -6, animationDelay: '0.7s' }} />
      {rank === 1 && <span className="pd-spark" style={{ top: 10, left: -10, animationDelay: '1.3s' }} />}
      <div className="pd-avatar" style={{ width: px - 8, height: px - 8, overflow: 'hidden' }}>
        <Avatar src={src} name={name} className="w-full h-full" />
      </div>
    </div>
  );
};

export interface PodiumUser {
  id: string;
  name: string;
  avatar?: string;
  xp: number;
  cos?: CosLike;
}

// Konfetti va yulduzchalar (joylashuvi qat'iy — qayta chizilganda "sakramaydi")
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: ((i * 53) % 90) / 10,
  dur: 6 + ((i * 29) % 50) / 10,
  color: ['#FDE047', '#F472B6', '#38BDF8', '#34D399', '#FB923C', '#C084FC'][i % 6],
  w: 5 + (i % 3) * 2,
  rot: (i * 47) % 360,
}));
const STARS = [
  { l: '8%', t: '22%', d: 0 }, { l: '90%', t: '18%', d: 0.8 }, { l: '20%', t: '58%', d: 1.4 }, { l: '80%', t: '52%', d: 0.4 },
  { l: '50%', t: '8%', d: 1.1 }, { l: '35%', t: '30%', d: 1.9 }, { l: '66%', t: '34%', d: 0.6 },
];

/** Podium bloki: old yuzasi, usti (3D) va yon tomoni; 1-o'rinda g'alaba zinapoyalari */
const Block: React.FC<{ rank: Rank }> = ({ rank }) => {
  const t = THEME[rank];
  const h = rank === 1 ? 104 : rank === 2 ? 76 : 58;
  return (
    <div className={`pd-block ${t.cls}`} style={{ height: h + 14 }}>
      <div className="pd-block-top" />
      <div className="pd-block-front" style={{ height: h }}>
        <span className="pd-block-num">{t.label}</span>
        <span className="pd-block-shine" />
      </div>
      {rank === 1 && (
        <div className="pd-stairs" aria-hidden>
          <i style={{ width: '104%' }} /><i style={{ width: '112%' }} /><i style={{ width: '122%' }} />
        </div>
      )}
    </div>
  );
};

/** TOP-3 g'alaba maydoni: 2-1-3 tartibida 3D podium, neon halqali avatarlar, konfetti va yulduzchalar.
 *  `chip` — chap yuqoridagi yozuv («2-hafta · 119 ta o'quvchi»), `live` — o'ng yuqoridagi holat */
export const Podium: React.FC<{
  users: PodiumUser[];
  badges?: Record<string, { gold: number; top3: number }>;
  chip?: React.ReactNode;
  live?: { text: string; state: 'live' | 'loading' | 'off' };
}> = ({ users, badges, chip, live }) => {
  const order: Rank[] = [2, 1, 3];
  return (
    <div className="pd-arena keep-dark">
      <div className="pd-conf-layer" aria-hidden>
        {CONFETTI.map((c, i) => (
          <i key={i} className="pd-conf" style={{ left: `${c.left}%`, width: c.w, height: c.w * 1.7, background: c.color, animationDelay: `-${c.delay}s`, animationDuration: `${c.dur}s`, transform: `rotate(${c.rot}deg)` }} />
        ))}
        {STARS.map((st, i) => <span key={i} className="pd-star" style={{ left: st.l, top: st.t, animationDelay: `${st.d}s` }} />)}
      </div>
      <div className="pd-top">
        <span className="pd-chip">{chip}</span>
        {live && (
          <span className="pd-live">
            <span className={`pd-dot ${live.state}`} />
            {live.text}
          </span>
        )}
      </div>
      <div className="pd-stage">
        <div className="pd-spot" aria-hidden />
        {order.map(rank => {
          const u = users[rank - 1];
          if (!u) return <div key={rank} className="pd-col" />;
          const b = badges?.[u.id];
          const t = THEME[rank];
          return (
            <div key={rank} className={`pd-col pd-r${rank}`}>
              <GlowAvatar rank={rank} src={u.avatar} name={u.name} size={rank === 1 ? 84 : 64} />
              <span className="pd-name"><CosName name={u.name} cos={u.cos} showTitle className="pd-nm" /></span>
              {b && b.gold > 0 && <span className="pd-champ">🏆 ×{b.gold} hafta chempioni</span>}
              <span className={`pd-xp ${t.cls}`}>{u.xp.toLocaleString()} XP</span>
              <Block rank={rank} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
