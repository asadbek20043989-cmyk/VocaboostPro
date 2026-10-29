// Kunlik eslatma (Netlify "Scheduled Function"): har soat ishga tushadi va admin belgilagan soatda (Toshkent vaqti) yuboradi.
// Sozlamalar admin paneldan: config/reminder = { enabled, hour, texts: [...], skipActive, lastDay }
import { makeDb, siteUrl, tashkentDay, tashkentNow } from '../lib/tg.mjs';

export const config = { schedule: '0 * * * *' };

export const handler = async () => {
  const db = makeDb();
  const code = process.env.ADMIN_CODE;
  if (!db || !code || !process.env.BOT_TOKEN) return { statusCode: 200, body: 'not configured' };
  const cfg = (await db('GET', 'config/reminder')) || {};
  const texts = (Array.isArray(cfg.texts) ? cfg.texts : Object.values(cfg.texts || {})).map(t => String(t || '').trim()).filter(Boolean);
  const day = tashkentDay();
  const hour = tashkentNow().getUTCHours();
  if (!cfg.enabled || !texts.length || cfg.lastDay === day || hour < Number(cfg.hour ?? 19)) return { statusCode: 200, body: 'skip' };

  // kunning tartib raqamiga qarab matn almashadi
  const dayNo = Math.floor(tashkentNow().getTime() / 86400000);
  const text = texts[dayNo % texts.length];
  await db('PATCH', 'config/reminder', { lastDay: day }); // ikki marta yuborilmasligi uchun avval belgilanadi
  const res = await fetch(`${siteUrl()}/api/fn/broadcast-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, text, kind: 'daily', skipActiveToday: cfg.skipActive !== false }),
  });
  return { statusCode: 200, body: `started ${res.status}` };
};
