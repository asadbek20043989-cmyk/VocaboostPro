// «Do'st bilan Blitz Duel»: havola orqali chaqirilgan do'st bilan 1:1 bellashuv.
//
// Xona bazada `bduels/<KOD>` ostida saqlanadi:
//   meta                       { createdBy, createdAt }
//   players/<uid>              { name, avatar, joinedAt }               (eng ko'pi bilan 2 kishi)
//   rounds/r<N>/<muallif>      { ts, by, i: [so'z id lari], q: [{e,p,u,o}] }   (15 ta savol — ikkalasiga bir xil)
//   res/r<N>/<uid>             { k: raund muallifi, s: ball, c: to'g'ri, t: ms, ts }
//
// Raund kalitlari «r1», «r2» ko'rinishida: Firebase 1,2,3 kabi raqamli kalitlarni massivga aylantirib yuboradi.
// Ikki kishi bir vaqtda raund boshlasa ham, g'olib raund aniq tanlanadi (eng kichik ts, so'ng muallif id si).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { subscribe, put, getJson, realtimeEnabled } from './realtime';
import { nowMs } from './time';
import { shuffle } from './srs';
import type { BankWord } from '../types';

export const FD_QUESTIONS = 15;
export const FD_SECONDS = 5; // har bir so'zga beriladigan vaqt
export const FD_MAX_PLAYERS = 2;
export const FD_COMBO_MAX = 2.5;

export interface FdQuestion { e: string; p: string; u: string; o: string[] }
export interface FdPlayer { id: string; name: string; avatar: string; joinedAt: number }
export interface FdResult { k: string; s: number; c: number; t: number; ts: number }
export interface FdRound { n: number; k: string; ts: number; q: FdQuestion[]; ids: string[] }
export interface FdRoom {
  code: string;
  createdBy: string;
  createdAt: number;
  players: FdPlayer[];
  rounds: FdRound[]; // har bir raund uchun g'olib nomzod, n bo'yicha o'sish tartibida
  results: Record<number, Record<string, FdResult>>; // faqat g'olib raundga tegishli natijalar
}
export interface FdMe { id: string; name: string; avatar: string }

/* ---------------------------- yordamchilar ---------------------------- */

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const entries = (v: any): [string, any][] => (v && typeof v === 'object' ? Object.entries(v).filter(([, x]) => x != null) : []);
const toArr = (v: any): any[] => (Array.isArray(v) ? v.filter(x => x != null) : v && typeof v === 'object' ? Object.values(v) : []);
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Bitta savol uchun ball: qolgan vaqt va ketma-ket to'g'ri javoblar (combo) hisobga olinadi */
export const pointsFor = (remaining: number, combo: number) => Math.round((50 + Math.max(0, remaining) * 10) * combo);

/** a g'alaba qilsa > 0, b g'alaba qilsa < 0, durang bo'lsa 0 */
export function compareResults(a: FdResult, b: FdResult): number {
  if (a.s !== b.s) return a.s - b.s;
  if (a.c !== b.c) return a.c - b.c;
  if (a.t !== b.t) return b.t - a.t; // kamroq vaqt — yaxshiroq
  return 0;
}

export const roundOf = (room: FdRoom | null, n: number) => room?.rounds.find(r => r.n === n) || null;

/* ------------------------------ xonani o'qish ------------------------------ */

export function parseRoom(code: string, raw: any): FdRoom | null {
  if (!raw || !raw.meta) return null;
  const players: FdPlayer[] = entries(raw.players)
    .map(([id, p]) => ({ id, name: String(p.name || "Do'st").slice(0, 60), avatar: String(p.avatar || ''), joinedAt: num(p.joinedAt) }))
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));

  const rounds: FdRound[] = [];
  for (const [rk, cands] of entries(raw.rounds)) {
    const n = Number(rk.replace(/^r/, ''));
    if (!Number.isFinite(n) || n < 1) continue;
    const list = entries(cands)
      .map(([k, c]) => ({ k, ts: num(c.ts), q: toArr(c.q) as FdQuestion[], ids: toArr(c.i).map(String) }))
      .filter(c => c.q.length > 0)
      .sort((a, b) => a.ts - b.ts || a.k.localeCompare(b.k));
    if (list.length) rounds.push({ n, ...list[0] });
  }
  rounds.sort((a, b) => a.n - b.n);

  const results: Record<number, Record<string, FdResult>> = {};
  for (const r of rounds) {
    const perUser: Record<string, FdResult> = {};
    for (const [uid, x] of entries(raw.res?.[`r${r.n}`])) {
      if (String(x.k) !== r.k) continue; // boshqa nomzod savollari bilan o'ynalgan natija hisobga olinmaydi
      perUser[uid] = { k: r.k, s: num(x.s), c: num(x.c), t: num(x.t), ts: num(x.ts) };
    }
    results[r.n] = perUser;
  }

  return { code, createdBy: String(raw.meta.createdBy || ''), createdAt: num(raw.meta.createdAt), players, rounds, results };
}

/** Umumiy hisob: kim nechta raundda yutgan (ikkala natijasi bor raundlar bo'yicha) */
export function seriesScore(room: FdRoom, aId: string, bId: string): { a: number; b: number; draws: number; played: number } {
  let a = 0, b = 0, draws = 0, played = 0;
  for (const r of room.rounds) {
    const ra = room.results[r.n]?.[aId];
    const rb = room.results[r.n]?.[bId];
    if (!ra || !rb) continue;
    played++;
    const d = compareResults(ra, rb);
    if (d > 0) a++;
    else if (d < 0) b++;
    else draws++;
  }
  return { a, b, draws, played };
}

/* ---------------------------- savollar tuzish ---------------------------- */

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const norm = (s: string) => s.trim().toLowerCase();

/**
 * Raund uchun 15 ta so'z va har biriga 4 ta variant. Foydalanuvchi darajasi atrofidagi so'zlar olinadi;
 * oldingi raundlarda kelgan so'zlar (`exclude`) takrorlanmaydi — har safar yangi so'zlar chiqadi.
 */
export function buildQuestions(bank: BankWord[], level: string, exclude: Set<string>, count = FD_QUESTIONS): { q: FdQuestion[]; ids: string[] } | null {
  const valid = bank.filter(w => w.published !== false && w.en && w.uz && w.en.length <= 26 && w.uz.length <= 38);
  if (valid.length < count + 4) return null;
  const li = LEVELS.indexOf(level);
  const near = li < 0 ? valid : valid.filter(w => Math.abs(LEVELS.indexOf(w.level) - li) <= 1);
  const pool = near.length >= count * 3 ? near : valid;

  const fresh = pool.filter(w => !exclude.has(w.id));
  // yangi so'zlar yetmasa — qolganini eskilardan to'ldiramiz (juda ko'p raund o'ynalganda)
  const ordered = [...shuffle(fresh), ...shuffle(pool.filter(w => exclude.has(w.id)))];

  const picked: BankWord[] = [];
  const seenEn = new Set<string>();
  const seenUz = new Set<string>();
  for (const w of ordered) {
    if (seenEn.has(norm(w.en)) || seenUz.has(norm(w.uz))) continue;
    seenEn.add(norm(w.en));
    seenUz.add(norm(w.uz));
    picked.push(w);
    if (picked.length === count) break;
  }
  if (picked.length < count) return null;

  const q: FdQuestion[] = picked.map(w => {
    const others = shuffle(valid.filter(x => x.id !== w.id && norm(x.uz) !== norm(w.uz)));
    const samePos = others.filter(x => x.pos && x.pos === w.pos);
    const rest = others.filter(x => !(x.pos && x.pos === w.pos));
    const used = new Set([norm(w.uz)]);
    const dis: string[] = [];
    for (const x of [...samePos, ...rest]) {
      if (used.has(norm(x.uz))) continue;
      used.add(norm(x.uz));
      dis.push(x.uz);
      if (dis.length === 3) break;
    }
    return { e: w.en, p: w.ipa || '', u: w.uz, o: shuffle([w.uz, ...dis]) };
  });
  return { q, ids: picked.map(w => w.id) };
}

/* ------------------------------ baza amallari ------------------------------ */

const base = (code: string) => `bduels/${code}`;
const playerBody = (me: FdMe) => ({ name: me.name.slice(0, 40) || "Do'st", avatar: me.avatar && me.avatar.length <= 400 ? me.avatar : '', joinedAt: nowMs() });

export async function fetchRoom(code: string): Promise<FdRoom | null> {
  try {
    return parseRoom(code, await getJson(base(code)));
  } catch {
    return null;
  }
}

/** Yangi xona ochadi va uning kodini qaytaradi (xato bo'lsa null) */
export async function createRoom(me: FdMe): Promise<string | null> {
  if (!realtimeEnabled) return null;
  let code = newCode();
  try {
    if (await getJson(base(code))) code = newCode(); // juda kam uchraydigan to'qnashuv
  } catch {
    /* tarmoq xatosi — yozishda ham bilinadi */
  }
  const t = nowMs();
  if (!(await put(`${base(code)}/meta`, { createdBy: me.id, createdAt: t }))) return null;
  if (!(await put(`${base(code)}/players/${me.id}`, playerBody(me)))) return null;
  return code;
}

export type JoinResult = { ok: true } | { ok: false; error: 'none' | 'full' | 'net' };

export async function joinRoom(code: string, me: FdMe): Promise<JoinResult> {
  if (!realtimeEnabled) return { ok: false, error: 'net' };
  try {
    const raw = await getJson(base(code));
    if (!raw?.meta) return { ok: false, error: 'none' };
    const ids = entries(raw.players).map(([id]) => id);
    if (ids.includes(me.id)) return { ok: true };
    if (ids.length >= FD_MAX_PLAYERS) return { ok: false, error: 'full' };
    return (await put(`${base(code)}/players/${me.id}`, playerBody(me))) ? { ok: true } : { ok: false, error: 'net' };
  } catch {
    return { ok: false, error: 'net' };
  }
}

/** N-raundni boshlaydi (agar do'sti allaqachon boshlab qo'ygan bo'lsa — o'sha qoladi). Muvaffaqiyatli bo'lsa true */
export async function startRound(code: string, n: number, me: FdMe, bank: BankWord[], level: string, used: Set<string>): Promise<boolean> {
  try {
    const existing = await getJson(`${base(code)}/rounds/r${n}`);
    if (existing && Object.keys(existing).length) return true;
  } catch {
    /* davom etamiz */
  }
  const built = buildQuestions(bank, level, used);
  if (!built) return false;
  return put(`${base(code)}/rounds/r${n}/${me.id}`, { ts: nowMs(), by: me.id, i: built.ids, q: built.q });
}

export async function submitResult(code: string, n: number, uid: string, r: Omit<FdResult, 'ts'>): Promise<boolean> {
  return put(`${base(code)}/res/r${n}/${uid}`, { k: r.k, s: Math.round(r.s), c: Math.round(r.c), t: Math.round(r.t), ts: nowMs() });
}

/* ---------------- jonli kuzatuv (React hook) ---------------- */

/**
 * Xonaga jonli obuna. `fast` — natija/do'st kutilayotganda: obuna jim qolsa (masalan, proksi rejimida) har 4 soniyada qayta so'raladi.
 */
export function useFriendRoom(code: string | null, fast: boolean) {
  const [room, setRoom] = useState<FdRoom | null>(null);
  const [loaded, setLoaded] = useState(false);
  const lastEvent = useRef(0);

  useEffect(() => {
    setRoom(null);
    setLoaded(false);
    lastEvent.current = 0;
    if (!code || !realtimeEnabled) return;
    return subscribe(base(code), v => {
      lastEvent.current = Date.now();
      setRoom(parseRoom(code, v));
      setLoaded(true);
    });
  }, [code]);

  const refresh = useCallback(async () => {
    if (!code) return;
    const r = await fetchRoom(code);
    lastEvent.current = Date.now();
    if (r) setRoom(r);
    setLoaded(true);
  }, [code]);

  useEffect(() => {
    if (!code || !fast) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastEvent.current > 7000) refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [code, fast, refresh]);

  return { room, loaded, refresh };
}

/* ---------------- shu qurilmadagi xonalar ro'yxati ---------------- */

const ROOMS_KEY = 'vb_bd_rooms_v1';
export interface FdLocalRoom { code: string; host: boolean; ts: number }

export const getMyRooms = (): FdLocalRoom[] => {
  try {
    const v = JSON.parse(localStorage.getItem(ROOMS_KEY) || '[]');
    return Array.isArray(v) ? v.filter(x => x && typeof x.code === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
};
export const rememberRoom = (code: string, host: boolean) => {
  try {
    const rest = getMyRooms().filter(r => r.code !== code);
    localStorage.setItem(ROOMS_KEY, JSON.stringify([{ code, host, ts: Date.now() }, ...rest].slice(0, 8)));
  } catch {
    /* ignore */
  }
};
export const forgetRoom = (code: string) => {
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(getMyRooms().filter(r => r.code !== code)));
  } catch {
    /* ignore */
  }
};

/* O'yin davomida saqlanadigan oraliq natija: ilova yopilib qolsa, qayta ochilganda savollarni qayta o'ynab bo'lmaydi */
const progKey = (code: string, n: number) => `vb_bd_prog_${code}_${n}`;
export interface FdProgress { k: string; s: number; c: number; t: number; i: number }
export const saveProgress = (code: string, n: number, p: FdProgress) => {
  try { localStorage.setItem(progKey(code, n), JSON.stringify(p)); } catch { /* ignore */ }
};
export const loadProgress = (code: string, n: number): FdProgress | null => {
  try {
    const v = JSON.parse(localStorage.getItem(progKey(code, n)) || 'null');
    return v && typeof v.k === 'string' ? v : null;
  } catch {
    return null;
  }
};
export const clearProgress = (code: string, n: number) => {
  try { localStorage.removeItem(progKey(code, n)); } catch { /* ignore */ }
};
/** Chala qolgan o'yinni yakuniy natijaga aylantiradi: javob berilmagan savollar xato hisoblanadi */
export const finalizeProgress = (p: FdProgress): Omit<FdResult, 'ts'> => ({ k: p.k, s: p.s, c: p.c, t: p.t + Math.max(0, FD_QUESTIONS - p.i) * FD_SECONDS * 1000 });

/* ---------------- modal oynasining umumiy holati ---------------- */

interface FdUi { open: boolean; code: string | null }
let ui: FdUi = { open: false, code: null };
const listeners = new Set<() => void>();
const setUi = (u: FdUi) => {
  ui = u;
  listeners.forEach(l => l());
};
/** code berilmasa — yangi xona ochiladi (yoki kutib turgan oxirgi xona qayta ishlatiladi) */
export const openFriendDuel = (code: string | null = null) => setUi({ open: true, code });
export const setFriendDuelCode = (code: string | null) => setUi({ ...ui, code });
export const closeFriendDuel = () => setUi({ open: false, code: null });
export const useFriendDuelUi = (): FdUi => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => ui, () => ui);
