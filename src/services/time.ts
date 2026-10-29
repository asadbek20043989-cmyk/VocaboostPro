// Yagona vaqt manbai: barcha qurilmalarda bir xil "bugun" (Toshkent vaqti, UTC+5) va server vaqtiga tuzatilgan soat.
// Telefon va noutbukdagi soat/vaqt zonasi farq qilsa ham, kun almashishi va baraban kutish vaqti bir xil bo'ladi.
export const TZ_OFFSET_MS = 5 * 3600 * 1000;

let skew = 0; // server vaqti - qurilma vaqti (ms)

/** Server vaqtiga tuzatilgan hozirgi vaqt (ms) */
export const nowMs = (): number => Date.now() + skew;

export const dayKeyOf = (ms: number): string => new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);

/** Bugungi sana (YYYY-MM-DD, Toshkent vaqti bo'yicha) */
export const todayKey = (): string => dayKeyOf(nowMs());

const parts = (key: string): [number, number, number] => {
  const [y, m, d] = key.split('-').map(Number);
  return [y, (m || 1) - 1, d || 1];
};

export const addDays = (key: string, n: number): string => {
  const [y, m, d] = parts(key);
  return new Date(Date.UTC(y, m, d) + n * 86400000).toISOString().slice(0, 10);
};

/** b - a (kunlarda) */
export const dayDiff = (a: string, b: string): number => {
  const [ya, ma, da] = parts(a);
  const [yb, mb, db] = parts(b);
  return Math.round((Date.UTC(yb, mb, db) - Date.UTC(ya, ma, da)) / 86400000);
};

let syncing: Promise<void> | null = null;

/** Qurilma soatini serverning `Date` sarlavhasi bilan solishtiradi (xato soatli qurilmalar uchun ham ishlaydi) */
export function syncClock(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const t0 = Date.now();
      const r = await fetch(`/favicon.png?_=${t0}`, { method: 'HEAD', cache: 'no-store' });
      const t1 = Date.now();
      const h = r.headers.get('date');
      const server = h ? Date.parse(h) : NaN;
      if (Number.isFinite(server)) {
        // Date sarlavhasi soniyagacha aniq: so'rov o'rtasiga moslab hisoblaymiz
        skew = server + 500 - (t0 + t1) / 2;
        if (Math.abs(skew) < 1500) skew = 0; // kichik farqni e'tiborsiz qoldiramiz
      }
    } catch {
      /* oflayn: qurilma soati ishlatiladi */
    } finally {
      // Netlify kreditini tejash: soat bitta sessiyada FAQAT 1 marta sinxronlanadi (qayta so'rov yo'q)
    }
  })();
  return syncing;
}
