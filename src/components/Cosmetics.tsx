import React from 'react';
import { BadgeCheck, Star } from 'lucide-react';
import { Avatar } from './Avatar';
import { FRAMES, AURAS } from '../data/shopDefaults';
import { nowMs } from '../services/time';

export interface CosLike { fr?: string; nf?: string; nc?: string; ns?: string; ti?: string; vf?: boolean; rb?: string; au?: string; na?: string; sp?: number }

/** Toj (reytingda maxsus belgi) */
const MiniCrown: React.FC<{ w: number }> = ({ w }) => (
  <svg viewBox="0 0 64 44" width={w} height={(w * 44) / 64} aria-hidden style={{ filter: 'drop-shadow(0 2px 4px rgba(251,191,36,.7))' }}>
    <path d="M6 38 L2 12 L18 24 L32 4 L46 24 L62 12 L58 38 Z" fill="#FBBF24" stroke="#92400E" strokeWidth="2" strokeLinejoin="round" />
    <rect x="6" y="36" width="52" height="6" rx="2.5" fill="#F59E0B" stroke="#92400E" strokeWidth="1.2" />
    <circle cx="32" cy="29" r="3.4" fill="#EF4444" />
  </svg>
);

/** Avatar + do'kondan olingan ramka va toj. `size` — piksel */
export const CosAvatar: React.FC<{ src?: string; name?: string; cos?: CosLike; size?: number; className?: string }> = ({ src, name, cos, size = 40, className = '' }) => {
  const fr = cos?.fr ? FRAMES[cos.fr] : null;
  const crown = cos?.rb === 'crown';
  const au = cos?.au ? AURAS[cos.au] : null;
  if (!fr && !crown && !au) return <Avatar src={src} name={name} className={className || 'w-10 h-10'} />;
  const pad = fr ? Math.max(3, Math.round(size * 0.08)) : 0;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size, marginTop: crown ? Math.round(size * 0.22) : 0 }}>
      {au && <span className="absolute -inset-[7px] rounded-full vb-aura pointer-events-none" style={{ ['--au' as any]: au.color }} />}
      {fr?.fx === 'sparks' && <span className="absolute inset-0 pointer-events-none" aria-hidden>{[8, 24, 42, 58, 76, 90].map((l, i) => <i key={i} className="vb-spark" style={{ left: `${l}%`, animationDelay: `${(i * 0.37) % 1.6}s`, width: Math.max(3, size * 0.07), height: Math.max(3, size * 0.07) }} />)}</span>}
      {fr?.fx === 'stars' && <span className="absolute inset-0 pointer-events-none" aria-hidden>{[[50, -6], [102, 30], [86, 96], [14, 96], [-2, 30], [78, 2]].map(([x, y], i) => <i key={i} className="vb-twinkle" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.4}s`, fontSize: Math.max(8, size * 0.24) }}>✦</i>)}</span>}
      {fr && <span className="absolute -inset-[3px] rounded-full vb-frame" style={{ background: fr.ring, boxShadow: `0 0 12px ${fr.glow}` }} />}
      <span className="relative rounded-full overflow-hidden bg-[#0B0F17]" style={{ width: size, height: size, padding: pad }}>
        <Avatar src={src} name={name} className="w-full h-full" />
      </span>
      {crown && <span className="absolute left-1/2 -top-[55%] -translate-x-1/2 pointer-events-none"><MiniCrown w={Math.round(size * 0.6)} /></span>}
    </span>
  );
};

/** Ism: rang, yaltirash, belgi, yulduzcha, VIP galochka; ixtiyoriy unvon */
export const CosName: React.FC<{ name: string; cos?: CosLike; className?: string; showTitle?: boolean }> = ({ name, cos, className = '', showTitle }) => {
  const style: React.CSSProperties = {};
  let cls = className;
  if (cos?.nf === 'rainbow') cls += ' vb-fx-rainbow';
  else if (cos?.nf === 'gold') cls += ' vb-fx-gold';
  else {
    if (cos?.nc) style.color = cos.nc;
    if (cos?.na) {
      cls += ` vb-na-${cos.na}`;
      if (cos.na === 'typing') (style as any)['--n'] = Math.max(2, name.length);
    }
  }
  if ((cos?.sp || 0) > nowMs()) cls += ' vb-spot-name';
  return (
    <span className="inline-flex flex-col min-w-0 max-w-full">
      <span className="inline-flex items-center gap-1 min-w-0">
        {cos?.ns ? <span className="shrink-0">{cos.ns}</span> : null}
        <span className={`truncate ${cls}`} style={style}>{name}</span>
        {cos?.rb === 'star' && <Star className="w-3.5 h-3.5 shrink-0 fill-amber-400 text-amber-400" />}
        {cos?.vf && <BadgeCheck className="w-4 h-4 shrink-0 text-sky-400 fill-sky-500/20" aria-label="VIP" />}
      </span>
      {showTitle && cos?.ti ? <span className="text-[10px] font-bold text-amber-300/90 truncate">{cos.ti}</span> : null}
    </span>
  );
};
