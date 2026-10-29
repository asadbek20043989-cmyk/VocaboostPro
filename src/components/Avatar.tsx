import React, { useEffect, useState } from 'react';
import { getPreset, gradFor, initialsOf } from '../services/avatar';

/** Doira shaklidagi profil rasmi. Maxsus avatar / Telegram rasmi / yuklangan rasm / ism harflari. */
export const Avatar: React.FC<{ src?: string; name?: string; className?: string }> = ({ src, name = '', className = 'w-10 h-10' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const base = `${className} rounded-full overflow-hidden shrink-0 bg-slate-800 block`;
  const preset = getPreset(src);

  if (preset) {
    const id = `av-${preset.id}`;
    return (
      <svg viewBox="0 0 100 100" className={base} role="img" aria-label={name || 'avatar'}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={preset.from} />
            <stop offset="1" stopColor={preset.to} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${id})`} />
        <circle cx="30" cy="24" r="26" fill="#fff" opacity="0.14" />
        <text x="50" y="52" fontSize="54" textAnchor="middle" dominantBaseline="central">
          {preset.emoji}
        </text>
      </svg>
    );
  }

  if (src && !failed) {
    return <img src={src} alt={name} className={`${base} object-cover`} onError={() => setFailed(true)} referrerPolicy="no-referrer" />;
  }

  const [a, b] = gradFor(name);
  const id = `avi-${a.slice(1)}${b.slice(1)}`;
  return (
    <svg viewBox="0 0 100 100" className={base} role="img" aria-label={name || 'avatar'}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
      <text x="50" y="52" fontSize="40" fontWeight="800" fill="#fff" textAnchor="middle" dominantBaseline="central" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
        {initialsOf(name)}
      </text>
    </svg>
  );
};
