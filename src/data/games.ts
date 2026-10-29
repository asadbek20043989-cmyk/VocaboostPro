export interface GameDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  kind: 'vocab' | 'memory'; // memory = umumiy xotirani mashq qildiradi
  enabled: boolean;
  order: number;
  vip: boolean;
  xp: number; // kuniga bir marta, muvaffaqiyatli tugatilsa
  settings: Record<string, number>;
}

// Admin paneldan yoqish/o'chirish va sozlash mumkin (config/games)
export const GAME_DEFAULTS: GameDef[] = [
  { id: 'match', title: 'Juftlik topish', desc: "Inglizcha so'z va uning tarjimasini juftlang", icon: '🧩', kind: 'vocab', enabled: true, order: 1, vip: false, xp: 10, settings: { pairs: 6 } },
  { id: 'speed', title: 'Tezlik raundi', desc: "Vaqt tugaguncha ko'proq so'z tarjimasini toping", icon: '⚡', kind: 'vocab', enabled: true, order: 2, vip: false, xp: 10, settings: { seconds: 60, choices: 4, goal: 8 } },
  { id: 'scramble', title: "Harflarni tartiblash", desc: "Aralashgan harflardan so'zni tuzing", icon: '🔤', kind: 'vocab', enabled: true, order: 3, vip: false, xp: 10, settings: { rounds: 6 } },
  { id: 'listen', title: 'Eshitib top', desc: "So'zni eshiting va to'g'ri javobni tanlang", icon: '🎧', kind: 'vocab', enabled: true, order: 4, vip: false, xp: 10, settings: { rounds: 8, choices: 4 } },
  { id: 'gap', title: "Gapni to'ldir", desc: "Gapdagi bo'sh joyga mos so'zni tanlang", icon: '✍️', kind: 'vocab', enabled: true, order: 5, vip: false, xp: 10, settings: { rounds: 8, choices: 4 } },
  { id: 'typing', title: "Yozib ko'r", desc: "O'zbekcha ma'nosiga qarab inglizchasini yozing", icon: '⌨️', kind: 'vocab', enabled: true, order: 6, vip: false, xp: 15, settings: { rounds: 6 } },
  { id: 'tf', title: "To'g'ri / Noto'g'ri", desc: "Juftlik to'g'rimi? Tez qaror qiling", icon: '✅', kind: 'vocab', enabled: true, order: 7, vip: false, xp: 10, settings: { rounds: 12 } },
  { id: 'seq', title: 'Xotira ketma-ketligi', desc: "So'zlar ketma-ketligini eslab, tartib bilan bosing", icon: '🧠', kind: 'memory', enabled: true, order: 8, vip: false, xp: 15, settings: { start: 3, showMs: 900, rounds: 5 } },
  { id: 'cards', title: 'Karta juftligi', desc: "Yashirilgan kartalardan bir xil juftlarni toping", icon: '🃏', kind: 'memory', enabled: true, order: 9, vip: true, xp: 15, settings: { pairs: 6 } },
  { id: 'missing', title: 'Harf yetishmayapti', desc: "So'zdagi tushib qolgan harflarni toping", icon: '🕵️', kind: 'vocab', enabled: true, order: 10, vip: true, xp: 10, settings: { rounds: 8, hidden: 2 } },
  // ---- VIP o'yinlar: lug'atni mustahkam yodlash uchun ----
  { id: 'hangman', title: "Hangman: so'zni top", desc: "Ma'nosiga qarab so'zni harf-harf toping, jonlaringizni saqlang", icon: '🔠', kind: 'vocab', enabled: true, order: 11, vip: true, xp: 15, settings: { rounds: 5, lives: 6 } },
  { id: 'sentence', title: 'Gap quruvchi', desc: "Aralashgan so'zlardan to'g'ri inglizcha gap tuzing", icon: '🧱', kind: 'vocab', enabled: true, order: 12, vip: true, xp: 20, settings: { rounds: 6 } },
  { id: 'dictation', title: 'Diktant', desc: "So'zni eshiting va uni imlosi bilan to'g'ri yozing", icon: '🎙️', kind: 'vocab', enabled: true, order: 13, vip: true, xp: 15, settings: { rounds: 6 } },
  { id: 'rain', title: "So'z yomg'iri", desc: "Tushayotgan so'zning tarjimasini yerga tushmasidan toping", icon: '🌧️', kind: 'vocab', enabled: true, order: 14, vip: true, xp: 15, settings: { words: 10, lives: 3 } },
  { id: 'odd', title: 'Ortiqchasini top', desc: "To'rtta so'z ichidan mavzuga mos kelmaydiganini toping", icon: '🔍', kind: 'vocab', enabled: true, order: 15, vip: true, xp: 15, settings: { rounds: 8 } },
  // ---- Yangi 5 ta interaktiv o'yin ----
  { id: 'synonym', title: 'Sinonimini top', desc: "Berilgan so'zning sinonimi yoki eng yaqin ma'nodosini toping", icon: '🔄', kind: 'vocab', enabled: true, order: 16, vip: false, xp: 15, settings: { rounds: 6, choices: 4 } },
  { id: 'antonym', title: 'Qarama-qarshi so\'z', desc: "So'zning zid (antonim) ma'nodagi juftini tanlang", icon: '⚖️', kind: 'vocab', enabled: true, order: 17, vip: false, xp: 15, settings: { rounds: 6, choices: 4 } },
  { id: 'wordsearch', title: 'So\'z qidiruvi', desc: "Harflar to'ridan yashiringan so'z harflarini tartib bilan toping", icon: '🗺️', kind: 'vocab', enabled: true, order: 18, vip: true, xp: 20, settings: { rounds: 5, gridSize: 6 } },
  { id: 'blitz', title: 'Blitz Viktorina', desc: "60 soniya ichida eng ko'p to'g'ri so'z variantini belgilang", icon: '🎯', kind: 'vocab', enabled: true, order: 19, vip: false, xp: 20, settings: { seconds: 60, goal: 10 } },
  { id: 'pronounce', title: 'Talaffuz sinovi', desc: "So'zni tinglang va uni ovoz chiqarib takrorlang", icon: '🗣️', kind: 'vocab', enabled: true, order: 20, vip: true, xp: 20, settings: { rounds: 5 } },
  // ---- 2D Grafik O'yinlar ----
  { id: 'word_catcher_2d', title: "2D So'z Tutgich", desc: "Tushayotgan so'zlar orasidan to'g'ri tarjimani savat bilan tuting!", icon: '🧺', kind: 'vocab', enabled: true, order: 21, vip: false, xp: 20, settings: { rounds: 6, lives: 3 } },
  { id: 'flappy_vocab_2d', title: "2D Flappy Vocab", desc: "Qanot qoqib, to'g'ri tarjima darvozalaridan o'ting va ball to'plang!", icon: '🕊️', kind: 'vocab', enabled: true, order: 22, vip: false, xp: 25, settings: { goal: 6, lives: 3 } },
];

/** Admin sozlamalarini standart qiymatlar bilan birlashtirish */
export function mergeGames(cfg: any): GameDef[] {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  return GAME_DEFAULTS.map(g => {
    const o = c[g.id] || {};
    const settings = { ...g.settings };
    Object.entries(o.settings || {}).forEach(([k, v]) => {
      if (k in settings && Number.isFinite(Number(v))) settings[k] = Number(v);
    });
    return {
      ...g,
      enabled: o.enabled === undefined ? g.enabled : !!o.enabled,
      order: Number.isFinite(Number(o.order)) ? Number(o.order) : g.order,
      vip: o.vip === undefined ? g.vip : !!o.vip,
      xp: Number.isFinite(Number(o.xp)) ? Math.max(0, Number(o.xp)) : g.xp,
      title: typeof o.title === 'string' && o.title ? o.title.slice(0, 40) : g.title,
      settings,
    };
  }).sort((a, b) => a.order - b.order);
}
