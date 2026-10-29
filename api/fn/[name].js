// Vercel adapteri: barcha Netlify-uslubidagi funksiyalar (server/functions/*.mjs) BITTA Vercel funksiyasi orqali ishlaydi.
// Shu sababli Vercel Hobby rejasidagi "12 ta funksiya" chegarasi muammo bo'lmaydi.
// Eski manzillar (/.netlify/functions/<nom>) vercel.json rewrite orqali bu yerga yo'naltiriladi.
import { timingSafeEqual } from 'node:crypto';
import { handler as admin } from '../../server/functions/admin.mjs';
import { handler as ai } from '../../server/functions/ai.mjs';
import { handler as bot } from '../../server/functions/bot.mjs';
import { handler as broadcast } from '../../server/functions/broadcast-background.mjs';
import { handler as cert } from '../../server/functions/cert.mjs';
import { handler as db } from '../../server/functions/db.mjs';
import { handler as grants } from '../../server/functions/grants.mjs';
import { handler as inbox } from '../../server/functions/inbox.mjs';
import { handler as remind } from '../../server/functions/remind.mjs';
import { handler as shop } from '../../server/functions/shop.mjs';
import { handler as streakWarn } from '../../server/functions/streak-warn.mjs';
import { handler as tgWebhook } from '../../server/functions/tg-webhook.mjs';
import { handler as tgavatar } from '../../server/functions/tgavatar.mjs';

const HANDLERS = {
  admin, ai, bot, cert, db, grants, inbox, shop, tgavatar,
  'tg-webhook': tgWebhook,
  'broadcast-background': broadcast,
  remind,
  'streak-warn': streakWarn,
};
const CRON = new Set(['remind', 'streak-warn']);

export const config = { maxDuration: 60 };

const safeEq = (a, b) => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
};

const rawBody = req => {
  const b = req.body;
  if (b == null) return '';
  if (typeof b === 'string') return b;
  if (Buffer.isBuffer(b)) return b.toString('utf8');
  try { return JSON.stringify(b); } catch { return ''; }
};

const waitUntil = p => {
  try {
    const ctx = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
    if (ctx?.waitUntil) { ctx.waitUntil(p); return true; }
  } catch { /* ignore */ }
  return false;
};

export default async function vercelEntry(req, res) {
  const name = String(req.query?.name || '');
  const fn = HANDLERS[name];
  if (!fn) { res.status(404).json({ error: 'Funksiya topilmadi' }); return; }

  // Rejalashtirilgan funksiyalar (GitHub Actions / cron-job.org / Vercel Cron chaqiradi): CRON_SECRET bilan himoyalanadi
  if (CRON.has(name)) {
    const secret = process.env.CRON_SECRET;
    const given = String(req.query?.key || '') || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!secret || !safeEq(given, secret)) { res.status(401).json({ error: 'CRON_SECRET kerak' }); return; }
  }

  const qs = { ...(req.query || {}) };
  delete qs.name;
  const event = {
    httpMethod: req.method,
    headers: req.headers || {},
    queryStringParameters: qs,
    body: rawBody(req),
    isBase64Encoded: false,
    path: req.url,
  };

  const send = out => {
    const r = out || { statusCode: 200, body: '' };
    const headers = { ...(r.headers || {}) };
    // Netlify CDN keshi -> Vercel CDN keshi
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === 'netlify-cdn-cache-control') {
        headers['Vercel-CDN-Cache-Control'] = headers[k];
        delete headers[k];
      }
    }
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.status(r.statusCode || 200);
    if (r.body == null || r.body === '') { res.end(); return; }
    res.end(r.isBase64Encoded ? Buffer.from(r.body, 'base64') : String(r.body));
  };

  try {
    if (name === 'broadcast-background') {
      // Orqa fon: darhol 202 qaytaramiz, yuborish davom etadi (waitUntil)
      const work = Promise.resolve(fn(event)).catch(() => {});
      if (waitUntil(work)) { res.status(202).end(); return; }
      send(await work);
      return;
    }
    send(await fn(event, {}));
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
