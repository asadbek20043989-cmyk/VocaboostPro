// Baraban sovrinlari admin paneldan o'zgartiriladi (config/wheel). Quyidagilar — standart qiymatlar.
export type PrizeType = 'xp' | 'double_xp' | 'extra_spin' | 'vip' | 'streak_saver';

export interface WheelPrize {
  id: string; // p0, p1 ...
  type: PrizeType;
  amount: number;
  label: string; // g'ildirakdagi qisqa yozuv
  title: string;
  description: string;
  emoji: string;
  probability: number; // foiz (jami 100 ga normallashtiriladi)
  color: string;
  big: boolean; // katta yutuq (konfeti kuchliroq)
}

export interface WheelConfig {
  prizes: { type: PrizeType; amount: number; label?: string; emoji?: string; color?: string; weight: number; enabled?: boolean }[];
  freeSpins: number;
  cooldownHours: number;
  vipHours: number;
  /** Admin belgilaydigan VIP sovrinlarining JAMI ehtimoli (foiz, 0–100). Berilmasa — og'irlik bo'yicha */
  vipPercent?: number | null;
}

export const DEFAULT_WHEEL: WheelConfig = {
  prizes: [
    { type: 'xp', amount: 10, weight: 25, color: '#2563EB' },
    { type: 'xp', amount: 25, weight: 18, color: '#7C3AED' },
    { type: 'double_xp', amount: 1, weight: 15, color: '#DB2777' },
    { type: 'extra_spin', amount: 1, weight: 14, color: '#059669' },
    { type: 'vip', amount: 24, weight: 12, color: '#D97706' },
    { type: 'streak_saver', amount: 1, weight: 10, color: '#0891B2' },
    { type: 'xp', amount: 50, weight: 6, color: '#DC2626' },
  ],
  freeSpins: 3,
  cooldownHours: 24,
  vipHours: 24,
};

const COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#059669', '#D97706', '#0891B2', '#DC2626', '#4F46E5'];
const toArr = (v: any): any[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

export const prizeText = (type: PrizeType, amount: number) => {
  switch (type) {
    case 'xp':
      return { label: `+${amount} XP`, title: amount >= 50 ? 'Super Bonus!' : `+${amount} XP`, description: `Hisobingizga ${amount} XP qo'shildi!`, emoji: amount >= 50 ? '🎁' : '💎' };
    case 'double_xp':
      return { label: '2x XP', title: '2x XP', description: "Keyingi XP olinadigan vazifa uchun XP ikki barobar bo'ladi!", emoji: '⚡' };
    case 'extra_spin':
      return { label: amount > 1 ? `+${amount} urinish` : 'Lucky Spin', title: 'Lucky Spin', description: `${amount} ta qo'shimcha aylantirish imkoniyati!`, emoji: '🍀' };
    case 'vip':
      return { label: 'VIP / Pro', title: 'VIP / Pro kirish', description: `VIP o'yinlar ${amount} soat davomida ochiq!`, emoji: '👑' };
    case 'streak_saver':
      return { label: 'Muzlatish', title: 'Streak muzlatish', description: "Bir kun mashq qilolmasangiz ham streakingiz muzlab, saqlanib qoladi. Qaytgach mashqni davom ettiring!", emoji: '❄️' };
  }
};

/** config/wheel -> g'ildirak bo'laklari (kamida 2 ta faol bo'lak bo'lmasa standart ishlatiladi) */
export function buildWheel(cfg: any): { prizes: WheelPrize[]; freeSpins: number; cooldownMs: number; vipMs: number } {
  const raw = toArr(cfg?.prizes).filter((p: any) => p && p.enabled !== false && Number(p.weight) > 0);
  const src = raw.length >= 2 ? raw : DEFAULT_WHEEL.prizes;
  const total = src.reduce((s: number, p: any) => s + Number(p.weight), 0) || 1;
  // Admin VIP ehtimolini aniq foizda belgilagan bo'lsa: VIP sovrinlar jami shuncha foiz, qolganlari (100 - shuncha) ni o'zaro bo'lishadi
  const vp = cfg?.vipPercent === null || cfg?.vipPercent === undefined || cfg?.vipPercent === '' ? NaN : Number(cfg.vipPercent);
  const sliced = src.slice(0, 10);
  const vipW = sliced.filter((p: any) => p.type === 'vip').reduce((s: number, p: any) => s + Number(p.weight), 0);
  const othW = sliced.filter((p: any) => p.type !== 'vip').reduce((s: number, p: any) => s + Number(p.weight), 0);
  const useVp = Number.isFinite(vp) && vipW > 0 && othW > 0;
  const vipShare = useVp ? Math.min(100, Math.max(0, vp)) : 0;
  const prizes: WheelPrize[] = src.slice(0, 10).map((p: any, i: number) => {
    const type = (['xp', 'double_xp', 'extra_spin', 'vip', 'streak_saver'].includes(p.type) ? p.type : 'xp') as PrizeType;
    const amount = Math.max(1, Math.round(Number(p.amount) || 1));
    const t = prizeText(type, amount);
    return {
      id: `p${i}`,
      type,
      amount,
      label: String(p.label || t.label).slice(0, 14),
      title: t.title,
      description: t.description,
      emoji: String(p.emoji || t.emoji).slice(0, 4),
      probability: useVp ? (type === 'vip' ? (Number(p.weight) / vipW) * vipShare : (Number(p.weight) / othW) * (100 - vipShare)) : (Number(p.weight) / total) * 100,
      color: /^#[0-9a-fA-F]{6}$/.test(p.color || '') ? p.color : COLORS[i % COLORS.length],
      big: type === 'xp' && amount >= 50,
    };
  });
  return {
    prizes,
    freeSpins: Math.min(10, Math.max(1, Math.round(Number(cfg?.freeSpins) || DEFAULT_WHEEL.freeSpins))),
    cooldownMs: Math.min(168, Math.max(1, Number(cfg?.cooldownHours) || DEFAULT_WHEEL.cooldownHours)) * 3600000,
    vipMs: Math.min(720, Math.max(1, Number(cfg?.vipHours) || DEFAULT_WHEEL.vipHours)) * 3600000,
  };
}

/** Ehtimollik bo'yicha tasodifiy tanlash (kriptografik RNG) */
export function pickPrize(prizes: WheelPrize[]): WheelPrize {
  let r: number;
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    r = (buf[0] / 0x100000000) * 100;
  } catch {
    r = Math.random() * 100;
  }
  let acc = 0;
  for (const p of prizes) {
    acc += p.probability;
    if (r < acc && p.probability > 0) return p;
  }
  return prizes.find(p => p.probability > 0) || prizes[0];
}
