import React, { useId } from 'react';

/**
 * Premium galochka: 12 qirrali oltin muhr + ichki halqa + oq galochka + vaqti-vaqti bilan o'tuvchi yaltirash.
 * variant="vip"      — oltin (VIP maqomi, ism yonida)
 * variant="official" — safir-ko'k (ilovaning rasmiy tasdiq belgisi)
 */
const POINTS = 12;
const sealPath = (() => {
  const cx = 12;
  const cy = 12;
  const ro = 11.6;
  const ri = 9.9;
  const pts: string[] = [];
  for (let i = 0; i < POINTS * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = (Math.PI * i) / POINTS - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

const THEMES = {
  vip: { a: '#FFF3B0', b: '#FBBF24', c: '#D97706', ring: '#FFF7D1', glow: 'rgba(251,191,36,.75)', check: '#7A3E00' },
  official: { a: '#BAE6FD', b: '#38BDF8', c: '#2563EB', ring: '#E0F2FE', glow: 'rgba(56,189,248,.7)', check: '#0B3A8F' },
} as const;

export const PremiumTick: React.FC<{ size?: number; variant?: 'vip' | 'official'; className?: string; title?: string }> = ({
  size = 18,
  variant = 'vip',
  className = '',
  title,
}) => {
  const uid = useId().replace(/:/g, '');
  const th = THEMES[variant];
  return (
    <span
      className={`vb-ptick ${className}`}
      style={{ width: size, height: size, ['--g' as any]: th.glow }}
      role="img"
      aria-label={title || (variant === 'vip' ? 'Premium' : 'Rasmiy tasdiqlangan')}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id={`g${uid}`} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={th.a} />
            <stop offset=".5" stopColor={th.b} />
            <stop offset="1" stopColor={th.c} />
          </linearGradient>
          <linearGradient id={`s${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".95" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`c${uid}`}>
            <path d={sealPath} />
          </clipPath>
        </defs>
        <path d={sealPath} fill={`url(#g${uid})`} stroke={th.c} strokeWidth=".5" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="7.7" fill="none" stroke={th.ring} strokeOpacity=".75" strokeWidth=".8" />
        <path d="M7.9 12.4l2.7 2.8 5.6-6.2" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.9 12.4l2.7 2.8 5.6-6.2" fill="none" stroke={th.check} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        <g clipPath={`url(#c${uid})`}>
          <rect className="vb-ptick-shine" x="-9" y="-2" width="7" height="28" fill={`url(#s${uid})`} transform="skewX(-18)" />
        </g>
      </svg>
    </span>
  );
};
