// Haftalik ligani AVTOMATIK yakunlash (cron: har dushanba 00:05 Toshkent vaqti = yakshanba 19:05 UTC).
// Admin panel → 🏆 Liga → «Avtomatik yakunlash» yoqilgan bo'lsagina ishlaydi (config/league.auto = true).
// Natija qo'lda «Yangi hafta» bosilgandagi bilan bir xil: TOP-20 Tarix zaliga yoziladi, XP 0 ga tushadi,
// TOP-20 o'quvchiga bot orqali «🏁 N-hafta tugadi» xabari boradi.
import { makeDb } from '../lib/tg.mjs';
import { finishWeek } from '../lib/week.mjs';

export const handler = async () => {
  const db = makeDb();
  if (!db) return { statusCode: 200, body: 'not configured' };
  const lg = (await db('GET', 'config/league').catch(() => null)) || {};
  if (!lg.auto) return { statusCode: 200, body: 'auto off' };
  // Ikki marta ishga tushsa ham hafta ikki marta yakunlanmasin: oldingi yakundan 5 kun o'tmagan bo'lsa — o'tkazib yuboramiz
  const started = Number(lg.startedAt) || 0;
  if (started && Date.now() - started < 5 * 24 * 3600 * 1000) return { statusCode: 200, body: 'too early' };
  try {
    const r = await finishWeek(db, {
      rewardSpins: lg.rewardSpins !== false,
      rewardCert: lg.rewardCert !== false,
      certFmt: lg.certFmt === 'wide' ? 'wide' : 'story',
      notify: lg.notify !== false,
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...r }) };
  } catch (e) {
    if (e.code === 'DUP') return { statusCode: 200, body: 'already done' };
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
