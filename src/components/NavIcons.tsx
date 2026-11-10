import React from 'react';

/** 3D ko'rinishdagi yorqin pastki menyu ikonkalari (gradient + yaltirash + soya). Har biri 40x40 */
const Defs: React.FC<{ id: string; a: string; b: string }> = ({ id, a, b }) => (
  <defs>
    <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
    <linearGradient id={`${id}-h`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
  </defs>
);
const Shadow = { filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.45))' } as React.CSSProperties;

export const HomeIcon3D: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 40" className={className} style={Shadow} aria-hidden>
    <Defs id="nh" a="#C7D2FE" b="#7C8CF8" />
    <path d="M20 5 3 20h5v14a2 2 0 0 0 2 2h6V25h8v11h6a2 2 0 0 0 2-2V20h5z" fill="url(#nh-g)" stroke="#A5B4FC" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M20 6.5 6 19h28z" fill="url(#nh-h)" />
  </svg>
);
export const BrainIcon3D: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 40" className={className} style={Shadow} aria-hidden>
    <Defs id="nb" a="#C4B5FD" b="#7C3AED" />
    <path d="M20 7c-2-3-7-3-9 0-4 0-6 4-4 7-2 2-2 6 1 8-1 4 2 8 6 7 1 3 5 4 6 1 1 3 5 2 6-1 4 1 7-3 6-7 3-2 3-6 1-8 2-3 0-7-4-7-2-3-7-3-9 0z" fill="url(#nb-g)" stroke="#DDD6FE" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M20 8v24M13 15c3 0 4 2 7 2M27 15c-3 0-4 2-7 2M12 24c3 0 5-2 8-2M28 24c-3 0-5-2-8-2" fill="none" stroke="#EDE9FE" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
export const GameIcon3D: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 40" className={className} style={Shadow} aria-hidden>
    <Defs id="ng" a="#EEF2FF" b="#A5B4FC" />
    <path d="M10 11h20c4 0 6 3 7 9l1 7c.5 4-4 6-7 3l-4-4H13l-4 4c-3 3-7.500 1-7-3l1-7c1-6 3-9 7-9z" fill="url(#ng-g)" stroke="#C7D2FE" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M11 17v6M8 20h6" stroke="#4F46E5" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="28" cy="17" r="1.9" fill="#6366F1" /><circle cx="32" cy="20" r="1.9" fill="#3B82F6" /><circle cx="28" cy="23" r="1.9" fill="#6366F1" /><circle cx="24" cy="20" r="1.9" fill="#3B82F6" />
  </svg>
);
export const TrophyIcon3D: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 40" className={className} style={Shadow} aria-hidden>
    <Defs id="nt" a="#E0E7FF" b="#8B9CF5" />
    <path d="M11 5h18v10c0 6-4 10-9 10s-9-4-9-10z" fill="url(#nt-g)" stroke="#C7D2FE" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M11 8H5c0 6 2 9 7 10M29 8h6c0 6-2 9-7 10" fill="none" stroke="#A5B4FC" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M17 25h6v5h5v5H12v-5h5z" fill="url(#nt-g)" stroke="#C7D2FE" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="m20 9 1.800 3.700 4 .6-2.900 2.800.7 4L20 18l-3.600 2 .7-4-2.900-2.800 4-.6z" fill="#4F46E5" />
  </svg>
);
export const ShopIcon3D: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 40" className={className} style={{ filter: 'drop-shadow(0 3px 5px rgba(245,158,11,.55))' }} aria-hidden>
    <Defs id="ns" a="#FDE047" b="#F59E0B" />
    <path d="M14 14v-3a6 6 0 0 1 12 0v3" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
    <path d="M7 14h26l2 19a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="url(#ns-g)" stroke="#FCD34D" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M8 15h24l.8 7H7.200z" fill="url(#ns-h)" />
    <path d="M14 25c1.500 5 10.500 5 12 0" fill="none" stroke="#92400E" strokeWidth="2.200" strokeLinecap="round" />
    <circle cx="15" cy="21" r="1.300" fill="#92400E" /><circle cx="25" cy="21" r="1.300" fill="#92400E" />
  </svg>
);
