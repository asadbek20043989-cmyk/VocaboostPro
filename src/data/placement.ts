// Daraja aniqlash testi (20 savol). Toza funksiyalar — interfeys `components/LevelTest.tsx` da.
//
// BALL TIZIMI (har savol bir xil ball bermaydi):
//   A1 = 1 ball, A2 = 2, B1 = 3, B2 = 4, C1 = 5, C2 = 6.  «afraid» (A1) — 1 ball, «contemporary» (C1) — 5 ball.
//   To'g'ri javob: + daraja balli.  Noto'g'ri javob: − (daraja balli / 3)  (4 variantli savolda tasodifiy topish kutilgan ballni 0 qiladi).
//   «Bilmayman» tugmasi: 0 ball (jarima yo'q) — shuning uchun tasodifiy belgilash natijani buzmaydi.
// DARAJA: yig'ilgan ball chegaradan oshgan va shu darajadagi savollarning kamida yarmi to'g'ri bo'lgan eng yuqori daraja olinadi.
import type { BankWord, EnglishLevel } from '../types';
import { PLACEMENT_WORDS } from './placementWords';

export const P_LEVELS: EnglishLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const LEVEL_POINTS: Record<EnglishLevel, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
/** Har bir darajadan nechta savol (jami 20) */
export const LEVEL_PLAN: Record<EnglishLevel, number> = { A1: 3, A2: 3, B1: 4, B2: 4, C1: 3, C2: 3 };
export const TEST_SIZE = 20;
export const WRONG_PENALTY = 1 / 3;

export type TestOrder = 'easy' | 'mixed';

export interface PQuestion {
  id: string;
  level: EnglishLevel;
  points: number;
  dir: 'en-uz' | 'uz-en';
  word: string; // savoldagi so'z (inglizcha)
  prompt: string; // ko'rsatiladigan so'z/ibora
  options: string[];
  answer: number; // to'g'ri variant indeksi
}

/** -1 — «Bilmayman» */
export type PAnswer = number;

export interface LevelStat { total: number; correct: number; wrong: number; skipped: number; maxPoints: number; gained: number }
export interface PResult {
  score: number; // yig'ilgan ball (jarimadan keyin, 0 dan past emas)
  max: number; // mumkin bo'lgan eng yuqori ball
  level: EnglishLevel;
  per: Record<EnglishLevel, LevelStat>;
  correct: number;
  wrong: number;
  skipped: number;
}

const SEEN_KEY = 'vb_placement_seen_v1';
const rnd = <T,>(a: T[]): T[] => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const loadSeen = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') || []; } catch { return []; }
};
const saveSeen = (words: string[]) => {
  try {
    const merged = Array.from(new Set([...words, ...loadSeen()])).slice(0, 90);
    localStorage.setItem(SEEN_KEY, JSON.stringify(merged));
  } catch { /* ignore */ }
};

type Entry = { en: string; uz: string };

/** Har daraja uchun so'zlar hovuzi: ichki bank + admin yuklagan (qisqa va aniq tarjimali) so'zlar */
function buildPools(extra: BankWord[]): Record<EnglishLevel, Entry[]> {
  const pools = {} as Record<EnglishLevel, Entry[]>;
  P_LEVELS.forEach(l => (pools[l] = PLACEMENT_WORDS[l].map(([en, uz]) => ({ en, uz }))));
  const have = new Set<string>(P_LEVELS.flatMap(l => pools[l].map(e => e.en.toLowerCase())));
  extra.forEach(w => {
    const lvl = (w.level as string) === 'B2+' ? 'B2' : (w.level as EnglishLevel);
    if (!P_LEVELS.includes(lvl) || w.published === false) return;
    const en = String(w.en || '').trim();
    const uz = String(w.uz || '').split(';')[0].trim();
    if (!en || !uz || en.length > 18 || en.split(/\s+/).length > 2 || uz.length > 34) return;
    if (have.has(en.toLowerCase())) return;
    have.add(en.toLowerCase());
    pools[lvl].push({ en, uz });
  });
  return pools;
}

/** Yangi test tuzadi. Har safar boshqa savollar: avval ko'rilmagan so'zlar tanlanadi */
export function buildTest(extra: BankWord[], order: TestOrder): PQuestion[] {
  const pools = buildPools(extra);
  const seen = new Set(loadSeen());
  const picked: { level: EnglishLevel; e: Entry }[] = [];
  P_LEVELS.forEach(l => {
    const fresh = rnd(pools[l].filter(e => !seen.has(e.en.toLowerCase())));
    const old = rnd(pools[l].filter(e => seen.has(e.en.toLowerCase())));
    [...fresh, ...old].slice(0, LEVEL_PLAN[l]).forEach(e => picked.push({ level: l, e }));
  });

  const qs: PQuestion[] = picked.map(({ level, e }, i) => {
    const dir: 'en-uz' | 'uz-en' = Math.random() < 0.6 ? 'en-uz' : 'uz-en';
    const li = P_LEVELS.indexOf(level);
    // Chalg'ituvchilar: shu va yaqin darajalardan (A1 uchun A1-A2, C2 uchun C1-C2 ...)
    const near = P_LEVELS.slice(Math.max(0, li - 1), li + 2).flatMap(l => pools[l]);
    const key = (x: Entry) => (dir === 'en-uz' ? x.uz : x.en).toLowerCase();
    const correct = dir === 'en-uz' ? e.uz : e.en;
    const used = new Set([correct.toLowerCase()]);
    const wrong: string[] = [];
    for (const d of rnd(near)) {
      if (d.en.toLowerCase() === e.en.toLowerCase()) continue;
      const k = key(d);
      if (used.has(k)) continue;
      used.add(k);
      wrong.push(dir === 'en-uz' ? d.uz : d.en);
      if (wrong.length >= 3) break;
    }
    const options = rnd([correct, ...wrong]);
    return {
      id: `${level}-${e.en}-${i}`,
      level,
      points: LEVEL_POINTS[level],
      dir,
      word: e.en,
      prompt: dir === 'en-uz' ? e.en : e.uz,
      options,
      answer: options.indexOf(correct),
    };
  });

  saveSeen(qs.map(q => q.word.toLowerCase()));
  if (order === 'easy') {
    // Osondan qiyinga: daraja bo'yicha tartiblanadi, daraja ichida aralash
    return P_LEVELS.flatMap(l => rnd(qs.filter(q => q.level === l)));
  }
  return rnd(qs);
}

const emptyStat = (): LevelStat => ({ total: 0, correct: 0, wrong: 0, skipped: 0, maxPoints: 0, gained: 0 });

/** Natijani hisoblaydi */
export function scoreTest(qs: PQuestion[], answers: PAnswer[]): PResult {
  const per = {} as Record<EnglishLevel, LevelStat>;
  P_LEVELS.forEach(l => (per[l] = emptyStat()));
  let raw = 0;
  let max = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  qs.forEach((q, i) => {
    const s = per[q.level];
    const a = answers[i] ?? -1;
    s.total++;
    s.maxPoints += q.points;
    max += q.points;
    if (a < 0) { s.skipped++; skipped++; }
    else if (a === q.answer) { s.correct++; s.gained += q.points; raw += q.points; correct++; }
    else { s.wrong++; s.gained -= q.points * WRONG_PENALTY; raw -= q.points * WRONG_PENALTY; wrong++; }
  });
  const score = Math.max(0, Math.round(raw * 10) / 10);

  // Daraja: ball chegarasi + shu darajadagi savollarning kamida yarmi to'g'ri
  let level: EnglishLevel = 'A1';
  let cum = 0; // oldingi darajalarning maksimal yig'indisi
  P_LEVELS.forEach((l, i) => {
    const band = per[l].maxPoints;
    if (i > 0 && per[l].total > 0) {
      const entry = 0.9 * cum + 0.4 * band;
      const acc = per[l].correct / per[l].total;
      if (raw >= entry && acc >= 0.5) level = l;
    }
    cum += band;
  });
  return { score, max, level, per, correct, wrong, skipped };
}
