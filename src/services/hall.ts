// «Tarix zali»: har hafta yakunida admin TOP-20 natijalarini qotirib saqlaydi (hall/wNNNN). Ma'lumot o'zgarmaydi,
// shuning uchun bir seansda faqat bir marta yuklanadi va xotirada saqlanadi (to'g'ridan-to'g'ri Firebase — Netlify krediti sarflanmaydi).
import { getJson } from './realtime';

export interface HallEntry {
  place: number;
  uid: string;
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  level: string;
}
export interface HallWeek {
  id: string;
  week: number;
  date: string;
  endedAt: number;
  players: number;
  top: HallEntry[];
}

let cache: Promise<HallWeek[]> | null = null;

const toArr = (v: any): any[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

export function loadHall(force = false): Promise<HallWeek[]> {
  if (cache && !force) return cache;
  cache = (async () => {
    const raw = await getJson('hall');
    const out: HallWeek[] = Object.entries(raw || {})
      .filter(([, v]) => v && typeof v === 'object')
      .map(([id, v]: [string, any]) => ({
        id,
        week: Number(v.week) || 0,
        date: String(v.date || ''),
        endedAt: Number(v.endedAt) || 0,
        players: Number(v.players) || 0,
        top: toArr(v.top)
          .filter(Boolean)
          .map((t: any) => ({
            place: Number(t.place) || 0,
            uid: String(t.uid || ''),
            name: String(t.name || "O'quvchi"),
            avatar: String(t.avatar || ''),
            xp: Number(t.xp) || 0,
            streak: Number(t.streak) || 0,
            level: String(t.level || ''),
          }))
          .sort((a: HallEntry, b: HallEntry) => a.place - b.place),
      }))
      .sort((a, b) => b.week - a.week);
    return out;
  })().catch(e => {
    cache = null; // xato bo'lsa keyingi safar qayta uriniladi
    throw e;
  });
  return cache;
}

/** Foydalanuvchi bo'yicha haftalik g'alabalar: { uid: { gold, top3 } } */
export function championCounts(weeks: HallWeek[]): Record<string, { gold: number; top3: number }> {
  const m: Record<string, { gold: number; top3: number }> = {};
  weeks.forEach(w =>
    w.top.forEach(t => {
      if (t.place > 3 || !t.uid) return;
      const c = (m[t.uid] = m[t.uid] || { gold: 0, top3: 0 });
      c.top3++;
      if (t.place === 1) c.gold++;
    })
  );
  return m;
}
