// Profil rasmi: 3 xil ko'rinishda saqlanadi
//   "preset:rocket"      — ilovadagi maxsus avatarlardan biri (juda qisqa, hamma qurilmada bir xil)
//   "https://..."        — Telegram profil rasmi (yoki boshqa havola)
//   "data:image/jpeg..." — foydalanuvchi yuklagan rasm (kichraytirilgan)

export interface AvatarPreset {
  id: string;
  emoji: string;
  from: string;
  to: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'rocket', emoji: '🚀', from: '#0EA5E9', to: '#6366F1' },
  { id: 'fox', emoji: '🦊', from: '#FB923C', to: '#E11D48' },
  { id: 'panda', emoji: '🐼', from: '#64748B', to: '#1E293B' },
  { id: 'lion', emoji: '🦁', from: '#FBBF24', to: '#EA580C' },
  { id: 'owl', emoji: '🦉', from: '#8B5CF6', to: '#4C1D95' },
  { id: 'robot', emoji: '🤖', from: '#22D3EE', to: '#0369A1' },
  { id: 'dragon', emoji: '🐲', from: '#34D399', to: '#047857' },
  { id: 'unicorn', emoji: '🦄', from: '#F0ABFC', to: '#7C3AED' },
  { id: 'astro', emoji: '👨‍🚀', from: '#38BDF8', to: '#1E3A8A' },
  { id: 'brain', emoji: '🧠', from: '#F472B6', to: '#9D174D' },
  { id: 'crown', emoji: '👑', from: '#FDE047', to: '#CA8A04' },
  { id: 'fire', emoji: '🔥', from: '#F97316', to: '#B91C1C' },
  { id: 'penguin', emoji: '🐧', from: '#7DD3FC', to: '#0F172A' },
  { id: 'tiger', emoji: '🐯', from: '#F59E0B', to: '#92400E' },
  { id: 'koala', emoji: '🐨', from: '#A8A29E', to: '#44403C' },
  { id: 'star', emoji: '🌟', from: '#A78BFA', to: '#DB2777' },
];

/** Do'kon orqali olinadigan noyob avatarlar */
export const LIMITED_AVATARS: AvatarPreset[] = [
  { id: 'ltd_dragon', emoji: '🐉', from: '#FDE047', to: '#B91C1C' },
  { id: 'ltd_phoenix', emoji: '🦅', from: '#FB923C', to: '#7F1D1D' },
  { id: 'ltd_wizard', emoji: '🧙', from: '#818CF8', to: '#1E1B4B' },
  { id: 'ltd_ninja', emoji: '🥷', from: '#475569', to: '#020617' },
  { id: 'ltd_alien', emoji: '👽', from: '#86EFAC', to: '#065F46' },
  { id: 'ltd_diamond', emoji: '💠', from: '#67E8F9', to: '#4338CA' },
];

export const PRESET_PREFIX = 'preset:';
export const presetValue = (id: string) => PRESET_PREFIX + id;
export const getPreset = (v: string | undefined | null): AvatarPreset | null => {
  if (!v || !v.startsWith(PRESET_PREFIX)) return null;
  const id = v.slice(PRESET_PREFIX.length);
  return AVATAR_PRESETS.find(p => p.id === id) || LIMITED_AVATARS.find(p => p.id === id) || null;
};

export const DEFAULT_AVATAR = presetValue('rocket');

/** Ism boshlang'ich harflari (rasm bo'lmaganda) */
export const initialsOf = (name: string): string => {
  const parts = String(name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  const s = (parts[0]?.[0] || '?') + (parts[1]?.[0] || '');
  return s.toUpperCase();
};

const GRADS: [string, string][] = [
  ['#0EA5E9', '#6366F1'],
  ['#F59E0B', '#EF4444'],
  ['#10B981', '#0EA5E9'],
  ['#A855F7', '#EC4899'],
  ['#F97316', '#DB2777'],
  ['#14B8A6', '#2563EB'],
];
export const gradFor = (name: string): [string, string] => {
  let h = 0;
  for (const ch of String(name || '?')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADS[h % GRADS.length];
};

/** Telegram rasmi kelmaganda serverdagi proksi (bot orqali olinadi). Faqat Telegram ichida ishlatiladi. */
export const telegramPhotoProxy = (tgId: number | string) => `/.netlify/functions/tgavatar?id=${encodeURIComponent(String(tgId))}`;

/**
 * Rasmni brauzerning o'zida kichraytirib, qisqa data: URL qiladi.
 * Reyting bazasiga ham yuboriladi, shuning uchun hajmi `maxChars` dan oshmaguncha sifat/o'lcham kamaytiriladi.
 */
export function compressImage(file: File, size = 128, quality = 0.8, maxChars = 24000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Faylni o‘qib bo‘lmadi'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Rasm ochilmadi'));
      img.onload = () => {
        const s = Math.min(img.width, img.height); // markazdan kvadrat kesish
        const sx = (img.width - s) / 2;
        const sy = (img.height - s) / 2;
        let px = size;
        let q = quality;
        for (let i = 0; i < 8; i++) {
          const canvas = document.createElement('canvas');
          canvas.width = px;
          canvas.height = px;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas yo‘q'));
          ctx.drawImage(img, sx, sy, s, s, 0, 0, px, px);
          const out = canvas.toDataURL('image/jpeg', q);
          if (out.length <= maxChars || px <= 48) return resolve(out);
          if (q > 0.55) q -= 0.1;
          else px = Math.round(px * 0.8);
        }
        reject(new Error('Rasm juda katta'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
