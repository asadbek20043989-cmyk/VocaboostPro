import React from 'react';
import { Avatar } from './Avatar';
import { CosName, CosLike } from './Cosmetics';
import { champLabel } from '../services/hall';
import { AURAS } from '../data/shopDefaults';

type Rank = 1 | 2 | 3;
const THEME: Record<Rank, { cls: string; label: string; text: string; bar: string; h: number; size: number }> = {
  1: { cls: 'pd-gold', label: '1', text: 'text-amber-300', bar: 'from-amber-300 via-amber-400 to-amber-600', h: 78, size: 58 },
  2: { cls: 'pd-silver', label: '2', text: 'text-sky-300', bar: 'from-sky-100 via-sky-300 to-sky-500', h: 56, size: 46 },
  3: { cls: 'pd-bronze', label: '3', text: 'text-orange-400', bar: 'from-orange-200 via-orange-400 to-orange-600', h: 42, size: 46 },
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
export const GlowAvatar: React.FC<{ rank: Rank; src?: string; name: string; size?: number; au?: string }> = ({ rank, src, name, size, au }) => {
  const aura = au ? AURAS[au] : null;
  const t = THEME[rank];
  const px = size || t.size;
  return (
    <div className={`pd-wrap ${t.cls}`} style={{ width: px, height: px, marginTop: rank === 1 ? 14 : 0 }}>
      {aura && <span className="absolute -inset-[9px] rounded-full vb-aura pointer-events-none" style={{ ['--au' as any]: aura.color }} />}
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

// Orqa fondagi mayda yulduzchalar (joylashuvi qat'iy — qayta chizilganda "sakramaydi")
const STARS = [
  { l: '7%', t: '20%', d: 0, s: 9 }, { l: '92%', t: '16%', d: 0.8, s: 11 }, { l: '17%', t: '55%', d: 1.4, s: 6 }, { l: '86%', t: '48%', d: 0.4, s: 7 },
  { l: '50%', t: '5%', d: 1.1, s: 7 }, { l: '33%', t: '14%', d: 1.9, s: 6 }, { l: '68%', t: '26%', d: 0.6, s: 6 }, { l: '95%', t: '70%', d: 1.6, s: 8 },
];

/** Medal uchun palitra: har bir o'rinning o'z rangi */
const MEDAL: Record<Rank, { ring: string; glow: string; plate: string; plateText: string; icon: string; leaf: string }> = {
  1: { ring: 'conic-gradient(from 210deg,#FFF3B0,#FBBF24,#B45309,#FDE047,#FFF3B0)', glow: 'rgba(251,191,36,.75)', plate: 'linear-gradient(180deg,#FDE68A,#F59E0B)', plateText: '#2A1700', icon: '🏆', leaf: '#FBBF24' },
  2: { ring: 'conic-gradient(from 210deg,#F1F5F9,#93C5FD,#3B82F6,#BFDBFE,#F1F5F9)', glow: 'rgba(96,165,250,.7)', plate: 'linear-gradient(180deg,rgba(148,197,255,.32),rgba(37,99,235,.28))', plateText: '#F1F7FF', icon: '🥈', leaf: '#BFDBFE' },
  3: { ring: 'conic-gradient(from 210deg,#FED7AA,#F97316,#9A3412,#FDBA74,#FED7AA)', glow: 'rgba(249,115,22,.65)', plate: 'linear-gradient(180deg,rgba(124,58,18,.85),rgba(60,25,8,.9))', plateText: '#FFE9D2', icon: '🥉', leaf: '#FB923C' },
};

/** Toj (har bir o'rin uchun o'z rangida) */
const RankCrown: React.FC<{ rank: Rank; w: number }> = ({ rank, w }) => {
  if (rank === 1) return <Crown w={w} />;
  const c = rank === 2 ? ['#F8FAFC', '#93C5FD', '#475569'] : ['#FED7AA', '#F97316', '#7C2D12'];
  const id = `pd-cg${rank}`;
  return (
    <svg viewBox="0 0 64 44" width={w} height={(w * 44) / 64} aria-hidden style={{ filter: `drop-shadow(0 3px 6px ${MEDAL[rank].glow})` }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c[0]} /><stop offset=".55" stopColor={c[1]} /><stop offset="1" stopColor={c[2]} />
        </linearGradient>
      </defs>
      <path d="M6 38 L2 12 L18 24 L32 4 L46 24 L62 12 L58 38 Z" fill={`url(#${id})`} stroke={c[2]} strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="6" y="36" width="52" height="6" rx="2.5" fill={c[1]} stroke={c[2]} strokeWidth="1.1" />
      <circle cx="32" cy="29" r="3" fill="#EF4444" stroke="#7F1D1D" />
    </svg>
  );
};

/** Profil rasmi: alohida yorqin medal ramkasi + dafna + toj */
const Medal: React.FC<{ rank: Rank; src?: string; name: string; size: number; au?: string }> = ({ rank, src, name, size, au }) => {
  const m = MEDAL[rank];
  const aura = au ? AURAS[au] : null;
  const ring = Math.max(5, Math.round(size * 0.1));
  const outer = size + ring * 2;
  return (
    <div className="pd-medal-wrap" style={{ width: outer + 8, marginTop: rank === 1 ? Math.round(size * 0.42) : Math.round(size * 0.34) }}>
      <div className="pd-medal" style={{ width: outer, height: outer, background: m.ring, boxShadow: `0 0 ${rank === 1 ? 30 : 20}px ${m.glow}, inset 0 0 0 1.5px rgba(255,255,255,.55)` }}>
        {aura && <span className="absolute -inset-[8px] rounded-full vb-aura pointer-events-none" style={{ ['--au' as any]: aura.color }} />}
        <span className="pd-medal-in" style={{ width: size, height: size }}>
          <Avatar src={src} name={name} className="w-full h-full" />
        </span>
        <span className="pd-medal-gloss" />
      </div>
      <span className="pd-crown-pos" style={{ transform: 'translate(-50%, -62%)' }}>
        <RankCrown rank={rank} w={Math.round(outer * (rank === 1 ? 0.78 : 0.58))} />
      </span>
    </div>
  );
};

/** Silindrsimon podium bloki: yuqori sirt (ellips), old yuzasi va katta raqam */
const Block: React.FC<{ rank: Rank }> = ({ rank }) => {
  const h = rank === 1 ? 104 : rank === 2 ? 76 : 60;
  const m = MEDAL[rank];
  return (
    <div className={`pd-block ${THEME[rank].cls}`} style={{ height: h + 14 }}>
      <div className="pd-block-top" />
      <div className="pd-block-front" style={{ height: h }}>
        <span className="pd-block-num">
          {THEME[rank].label}
        </span>
        <span className="pd-block-shine" />
      </div>
      <i className="pd-block-glow" style={{ background: m.glow }} />
    </div>
  );
};

/** TOP-3 g'alaba maydoni: 2-1-3 tartibida podium, medal ramkali avatarlar, ism lavhasi, alohida XP belgisi.
 *  `chip` — chap yuqoridagi yozuv («2-hafta · 119 ta o'quvchi»), `live` — o'ng yuqoridagi holat */
export const Podium: React.FC<{
  users: PodiumUser[];
  badges?: Record<string, { gold: number; top3: number; weeks?: number[] }>;
  chip?: React.ReactNode;
  live?: { text: string; state: 'live' | 'loading' | 'off' };
}> = ({ users, badges, chip, live }) => {
  const order: Rank[] = [2, 1, 3];
  return (
    <div className="pd-arena keep-dark">
      <div className="pd-bg" aria-hidden>
        <i className="pd-ribbon pd-ribbon-l" /><i className="pd-ribbon pd-ribbon-r" />
        {STARS.map((st, i) => <span key={i} className="pd-star" style={{ left: st.l, top: st.t, width: st.s, height: st.s, animationDelay: `${st.d}s` }} />)}
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
          const m = MEDAL[rank];
          return (
            <div key={rank} className={`pd-col pd-r${rank}`}>
              <Medal rank={rank} src={u.avatar} name={u.name} size={rank === 1 ? 66 : 52} au={u.cos?.au} />
              <span className="pd-plate" style={{ background: m.plate, color: m.plateText }}>
                {rank === 1 && <span className="pd-plate-ico" aria-hidden>{m.icon}</span>}
                <span className="pd-plate-name"><CosName name={u.name} cos={u.cos} showTitle className="pd-nm" /></span>
              </span>
              {b && b.gold > 0 && <span className="pd-champ">🏆 {champLabel(b)}</span>}
              <span className={`pd-xp ${THEME[rank].cls}`}><span className="pd-xp-star" aria-hidden>★</span>{u.xp.toLocaleString()} XP</span>
              <Block rank={rank} />
            </div>
          );
        })}
        <i className="pd-floor" aria-hidden />
      </div>
    </div>
  );
};
