import { BankWord, SrsEntry } from '../types';
import { addDays } from './time';

export const INTERVALS = [0, 1, 3, 7, 14, 30]; // box -> kunlar
export const MASTER_DAYS = 3;

export { addDays };

/** Yangi o'rganilgan so'z uchun boshlang'ich holat */
export const newEntry = (today: string, correct: boolean): SrsEntry => ({
  box: correct ? 1 : 0,
  due: correct ? addDays(today, 1) : today,
  intro: today,
  seen: 1,
  ok: correct ? 1 : 0,
  days: correct ? [today] : [],
  mastered: false,
  srsFactor: 1.3,
});

/**
 * Takrorlash natijasini qo'llash (Dinamik Spaced Repetition):
 * - To'g'ri bo'lsa quti oshadi (maksimal 5) va srsFactor ko'tariladi;
 * - Xato bo'lsa quti 1-2 pog'ona qaytadi va srsFactor kamayadi;
 * - Keyingi takrorlash oralig'i shu individual faktorga asoslanadi.
 */
export const applyResult = (e: SrsEntry, correct: boolean, today: string): SrsEntry => {
  const currentFactor = Number(e.srsFactor) > 0 ? Number(e.srsFactor) : 1.3;
  const factor = correct
    ? Math.min(2.5, currentFactor + 0.15)
    : Math.max(1.1, currentFactor - 0.2);

  const box = correct
    ? Math.min(5, e.box + 1)
    : Math.max(0, e.box >= 3 ? e.box - 2 : e.box - 1);
  const days = correct && !e.days.includes(today) ? [...e.days, today] : e.days;

  const baseInterval = INTERVALS[box];
  const dynamicDays = Math.max(1, Math.round(baseInterval * (factor / 1.3)));

  return {
    ...e,
    box,
    due: correct ? addDays(today, dynamicDays) : (box === 0 ? today : addDays(today, 1)),
    seen: e.seen + 1,
    ok: e.ok + (correct ? 1 : 0),
    days,
    mastered: e.mastered || days.length >= MASTER_DAYS,
    srsFactor: factor,
  };
};

// ---------- savollar ----------
export type QKind = 'mcq' | 'rev' | 'listen' | 'gap' | 'type';

export interface Question {
  kind: QKind;
  word: BankWord;
  prompt: string;
  options?: string[];
  answer: string; // to'g'ri javob (matn)
  speak?: string;
  hint?: string;
  ansLang?: 'en' | 'uz'; // «Eshitib toping»: variantlar inglizcha yoki o'zbekcha
}

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pickDistractors = (word: BankWord, bank: BankWord[], n: number, field: 'en' | 'uz'): string[] => {
  const same = bank.filter(w => w.id !== word.id && w.pos === word.pos);
  const rest = bank.filter(w => w.id !== word.id && w.pos !== word.pos);
  const pool = [...shuffle(same), ...shuffle(rest)];
  const out: string[] = [];
  for (const w of pool) {
    const v = w[field];
    if (v && v !== word[field] && !out.includes(v)) out.push(v);
    if (out.length >= n) break;
  }
  return out;
};

const blankSentence = (word: BankWord): string | null => {
  const stem = word.en.toLowerCase().replace(/(e|y)$/, '');
  const re = new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'i');
  if (!re.test(word.ex)) return null;
  return word.ex.replace(re, '_____');
};

export const chooseKind = (box: number, word: BankWord): QKind => {
  const canGap = !!blankSentence(word);
  const r = Math.random();
  if (box <= 1) return r < 0.55 ? 'mcq' : 'listen';
  if (box === 2) return r < 0.4 ? 'rev' : canGap ? 'gap' : 'rev';
  if (box === 3) return r < 0.5 ? 'type' : canGap ? 'gap' : 'rev';
  return r < 0.6 ? 'type' : 'rev';
};

export const makeQuestion = (word: BankWord, bank: BankWord[], kind: QKind, choices = 4): Question => {
  const n = Math.max(1, choices - 1);
  switch (kind) {
    case 'rev': {
      const opts = shuffle([word.en, ...pickDistractors(word, bank, n, 'en')]);
      return { kind, word, prompt: word.uz, options: opts, answer: word.en, hint: "Inglizchasini tanlang" };
    }
    case 'listen': {
      // 50%: inglizcha yozuvini, 50%: o'zbekcha tarjimasini tanlash — faqat tovush o'xshashligidan topib ketib bo'lmaydi
      if (Math.random() < 0.5) {
        const opts = shuffle([word.uz, ...pickDistractors(word, bank, n, 'uz')]);
        return { kind, word, prompt: "Eshiting va tarjimasini tanlang", options: opts, answer: word.uz, speak: word.en, ansLang: 'uz' };
      }
      const opts = shuffle([word.en, ...pickDistractors(word, bank, n, 'en')]);
      return { kind, word, prompt: 'Eshiting va to\'g\'ri so\'zni tanlang', options: opts, answer: word.en, speak: word.en, ansLang: 'en' };
    }
    case 'gap': {
      const sentence = blankSentence(word);
      if (!sentence) return makeQuestion(word, bank, 'rev', choices);
      const opts = shuffle([word.en, ...pickDistractors(word, bank, n, 'en')]);
      return { kind, word, prompt: sentence, options: opts, answer: word.en, hint: word.exUz };
    }
    case 'type':
      return { kind, word, prompt: word.uz, answer: word.en, hint: `${word.en.length} ta harf, ${word.en[0]}...` };
    case 'mcq':
    default: {
      const opts = shuffle([word.uz, ...pickDistractors(word, bank, n, 'uz')]);
      return { kind: 'mcq', word, prompt: word.en, options: opts, answer: word.uz, speak: word.en };
    }
  }
};

const lev = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
};

/** Yozma javobni tekshirish: 6+ harfli so'zda 1 ta xatoga yo'l qo'yiladi */
export const checkTyped = (input: string, answer: string): { ok: boolean; close: boolean } => {
  const a = input.trim().toLowerCase();
  const b = answer.trim().toLowerCase();
  if (a === b) return { ok: true, close: false };
  if (b.length >= 6 && a.length > 0 && lev(a, b) === 1) return { ok: true, close: true };
  return { ok: false, close: false };
};
