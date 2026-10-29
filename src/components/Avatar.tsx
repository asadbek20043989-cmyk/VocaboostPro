import React, { useEffect, useState } from 'react';
import { getPreset, gradFor, initialsOf } from '../services/avatar';

/** Doira shaklidagi profil rasmi. Maxsus avatar / Telegram rasmi / yuklangan rasm / ism harflari. */
export const Avatar: React.FC<{
  src?: string;
  name?: string;
  className?: string;
  frame?: string;
  crown?: boolean;
}> = ({ src, name = '', className = 'w-10 h-10', frame, crown }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const frameClasses = (() => {
    if (!frame) return '';
    const f = frame.toLowerCase();
    if (f.includes('diam') || f.includes('olmos')) {
      return 'ring-2 ring-sky-300 ring-offset-2 ring-offset-[#0B0F17] shadow-[0_0_16px_rgba(186,230,253,0.85)]';
    }
    if (f.includes('laur') || f.includes('lavr')) {
      return 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0B0F17] shadow-[0_0_14px_rgba(52,211,153,0.7)]';
    }
    if (f.includes('gold') || f.includes('oltin')) {
      return 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0B0F17] shadow-[0_0_12px_rgba(251,191,36,0.55)]';
    }
    if (f.includes('fire') || f.includes('olov')) {
      return 'ring-2 ring-rose-500 ring-offset-2 ring-offset-[#0B0F17] shadow-[0_0_15px_rgba(244,63,94,0.65)]';
    }
    if (f.includes('cryst') || f.includes('kristall')) {
      return 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#0B0F17] shadow-[0_0_14px_rgba(34,211,238,0.6)]';
    }
    if (f.includes('neon')) {
      return 'ring-2 ring-purple-500 ring-offset-2 ring-offset-[#0B0F17] shadow-[0_0_14px_rgba(168,85,247,0.65)]';
    }
    return 'ring-2 ring-amber-400/60 ring-offset-1 ring-offset-[#0B0F17]';
  })();

  const base = `${className} rounded-full overflow-hidden shrink-0 bg-slate-800 block ${frameClasses}`;
  const preset = getPreset(src);

  const avatarContent = (() => {
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
  })();

  if (!crown) return avatarContent;

  return (
    <div className="relative inline-block shrink-0">
      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-sm z-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-none select-none animate-bounce">
        👑
      </span>
      {avatarContent}
    </div>
  );
};
