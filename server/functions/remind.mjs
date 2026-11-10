// Kunlik eslatma + v11 retention vazifalari (har soat ishga tushadi).
//  1) Kunlik eslatma: admin belgilagan soatda (Toshkent vaqti) yuboradi. Sozlamalar: config/reminder
//  2) Haftalik natija navbatini bo'shatish (TOP-20 dan tashqaridagilar, ertalab)
//  3) Win-back va faollashtirish xabarlari (admin → 🚀 Retention)
import { makeDb, siteUrl, tashkentDay, tashkentNow, triggerBroadcastResume } from '../lib/tg.mjs';
import { loadRt, drainWeekRest, runWinback } from '../lib/engage.mjs';

export const config = { schedule: '0 * * * *' };

async function dailyReminder(db) {
  const code = process.env.ADMIN_CODE;
  if (!code) return 'no admin code';
  const cfg = (await db('GET', 'config/reminder')) || {};
  const texts = (Array.isArray(cfg.texts) ? cfg.texts : Object.values(cfg.texts || {})).map(t => String(t || '').trim()).filter(Boolean);
  const day = tashkentDay();
  const hour = tashkentNow().getUTCHours();
  if (!cfg.enabled || !texts.length || cfg.lastDay === day || hour < Number(cfg.hour ?? 19)) return 'skip';

  // kunning tartib raqamiga qarab matn almashadi
  const dayNo = Math.floor(tashkentNow().getTime() / 86400000);
  const text = texts[dayNo % texts.length];
  await db('PATCH', 'config/reminder', { lastDay: day }); // ikki marta yuborilmasligi uchun avval belgilanadi
  const res = await fetch(`${siteUrl()}/api/fn/broadcast-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, text, kind: 'daily', skipActiveToday: cfg.skipActive !== false }),
  });
  return `started ${res.status}`;
}

// Zanjir uzilib, yarmida qolgan ommaviy yuborishni (oxirgi 6 soat ichida boshlangan) davom ettiradi
async function resumeStaleBroadcast(db) {
  const st = await db('GET', 'adminState/broadcast');
  if (!st || !st.id || st.done) return 'none';
  if (Date.now() - (Number(st.startedAt) || 0) > 6 * 3600 * 1000) return 'too-old';
  if (Date.now() - (Number(st.lastTick) || Number(st.startedAt) || 0) < 120000) return 'running';
  if (!(await db('GET', `broadcastJobs/${st.id}`))) return 'no-job';
  return (await triggerBroadcastResume(st.id, false)) ? 'resumed' : 'failed';
}

export const handler = async () => {
  const db = makeDb();
  if (!db || !process.env.BOT_TOKEN) return { statusCode: 200, body: 'not configured' };
  const out = {};
  try { out.broadcast = await resumeStaleBroadcast(db); } catch (e) { out.broadcast = 'error: ' + String(e?.message || e); }
  try { out.reminder = await dailyReminder(db); } catch (e) { out.reminder = 'error: ' + String(e?.message || e); }
  try {
    const rt = await loadRt(db);
    const token = process.env.BOT_TOKEN;
    const t0 = Date.now();
    out.weekRest = await drainWeekRest(db, token, rt, { budgetMs: 22000 });
    out.winback = await runWinback(db, token, rt, { budgetMs: Math.max(5000, 45000 - (Date.now() - t0)) });
  } catch (e) {
    out.engage = 'error: ' + String(e?.message || e);
  }
  return { statusCode: 200, body: JSON.stringify(out) };
};
