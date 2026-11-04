// Do'kon mahsulotlari va o'yinlar uchun nishonlar (New, Hot...). Admin paneldan qo'yiladi va istalgan payt olib tashlanadi.
// Saqlanadigan maydonlar (config/shop/items/<id> va config/games/<id> ichida):
//   badge      — nishon turi (quyidagi kalitlardan biri); bo'sh = nishon yo'q
//   badgeText  — ixtiyoriy: o'z yozuvingiz (bo'sh bo'lsa standart yozuv)
//   badgeUntil — ixtiyoriy: shu vaqtdan (ms) keyin nishon avtomatik yo'qoladi (0 = cheksiz)

export interface BadgeType {
  label: string;
  emoji: string;
  from: string;
  to: string;
  text: string;
  pulse?: boolean;
}

export const BADGE_TYPES: Record<string, BadgeType> = {
  new: { label: 'NEW', emoji: '🆕', from: '#22C55E', to: '#059669', text: '#052E16' },
  hot: { label: 'HOT', emoji: '🔥', from: '#FB923C', to: '#DC2626', text: '#FFFFFF', pulse: true },
  sale: { label: 'SALE', emoji: '💸', from: '#F472B6', to: '#E11D48', text: '#FFFFFF' },
  top: { label: 'TOP', emoji: '⭐', from: '#FCD34D', to: '#F59E0B', text: '#3B2300' },
  limited: { label: 'LIMIT', emoji: '⏳', from: '#A78BFA', to: '#7C3AED', text: '#FFFFFF', pulse: true },
  soon: { label: 'TEZDA', emoji: '🚧', from: '#38BDF8', to: '#2563EB', text: '#FFFFFF' },
  best: { label: 'ENG YAXSHI', emoji: '🏆', from: '#2DD4BF', to: '#0891B2', text: '#042F2E' },
};

export interface BadgeData {
  badge?: string;
  badgeText?: string;
  badgeUntil?: number;
}

/** Admin sozlamasidan (o) nishon ma'lumotini xavfsiz o'qiydi */
export function readBadge(o: any): BadgeData {
  const b = o && typeof o === 'object' ? o : {};
  const badge = typeof b.badge === 'string' && BADGE_TYPES[b.badge] ? b.badge : '';
  const until = Number(b.badgeUntil);
  return {
    badge,
    badgeText: badge ? String(b.badgeText || '').trim().slice(0, 14) : '',
    badgeUntil: badge && Number.isFinite(until) && until > 0 ? until : 0,
  };
}

/** Hozir ko'rsatilishi kerak bo'lgan nishon (muddati o'tgan bo'lsa — null) */
export function activeBadge(d: BadgeData | undefined, nowTs: number): { type: BadgeType; label: string } | null {
  if (!d || !d.badge || !BADGE_TYPES[d.badge]) return null;
  if (d.badgeUntil && nowTs > d.badgeUntil) return null;
  const type = BADGE_TYPES[d.badge];
  return { type, label: d.badgeText || type.label };
}
