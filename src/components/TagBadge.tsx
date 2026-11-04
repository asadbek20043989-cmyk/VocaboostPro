import React from 'react';
import { activeBadge, BadgeData } from '../data/badges';
import { nowMs } from '../services/time';

/** Kartaning burchagidagi nishon (New / Hot / Sale...). Muddati o'tgan yoki o'chirilgan bo'lsa hech narsa ko'rsatmaydi. */
export const TagBadge: React.FC<{ data?: BadgeData; className?: string }> = ({ data, className = '' }) => {
  const b = activeBadge(data, nowMs());
  if (!b) return null;
  return (
    <span
      className={`vb-tagbadge ${b.type.pulse ? 'vb-tagbadge-pulse' : ''} inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-black tracking-wide leading-none shadow-lg pointer-events-none ${className}`}
      style={{ background: `linear-gradient(135deg, ${b.type.from}, ${b.type.to})`, color: b.type.text, boxShadow: `0 4px 14px ${b.type.to}66` }}
    >
      <span aria-hidden>{b.type.emoji}</span>
      {b.label}
    </span>
  );
};
