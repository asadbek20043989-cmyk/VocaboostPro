import { shuffle } from './srs';

/** O'yinlarda savol/so'zlar takrorlanmasligi uchun: har bir o'yin bo'yicha oxirgi ishlatilgan kalitlar qurilmada saqlanadi */
const KEY = 'vb_game_seen_v2';
const CAP = 400;

const load = (): Record<string, string[]> => {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
};
const save = (o: Record<string, string[]>) => {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* ignore */ }
};

/**
 * Elementlarni «yangilari birinchi» tartibda qaytaradi (ichida aralash). Yangi elementlar `need` dan kam bo'lsa, tarix tozalanadi.
 * `prefer` berilsa, shu shartga mos yangilari eng oldinda turadi.
 */
export function freshOrder<T>(scope: string, items: T[], idOf: (t: T) => string, need: number, prefer?: (t: T) => boolean): T[] {
  const all = load();
  let seen = new Set(all[scope] || []);
  let fresh = items.filter(i => !seen.has(idOf(i)));
  if (fresh.length < Math.min(need, items.length)) {
    all[scope] = [];
    save(all);
    seen = new Set();
    fresh = items.slice();
  }
  const old = items.filter(i => seen.has(idOf(i)));
  const pf = prefer ? shuffle(fresh.filter(prefer)) : [];
  const rest = prefer ? shuffle(fresh.filter(i => !prefer(i))) : shuffle(fresh);
  return [...pf, ...rest, ...shuffle(old)];
}

export function markSeen(scope: string, ids: string[]) {
  if (!ids.length) return;
  const all = load();
  const merged = Array.from(new Set([...(all[scope] || []), ...ids]));
  all[scope] = merged.slice(-CAP);
  save(all);
}
