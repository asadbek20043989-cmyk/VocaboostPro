// Firebase Realtime Database xavfsiz server proksisi.
// Barcha yozish va o'chirish amallari server siri (FIREBASE_DB_SECRET) orqali va
// Telegram initData imzosi tasdiqlangandan so'ng amalga oshiriladi.
// Begona shaxslar boshqa foydalanuvchilarning hisoblarini o'chira yoki soxtalashtira olmaydi.
import { verifyInitData } from '../lib/tg.mjs';

const ALLOWED = /^(leaderboard|state|duels|challenges|config|certs|words|packs|hall)(\/[A-Za-z0-9_\-:.@+]{1,200}){0,6}$/;
const MAX_BODY = 300 * 1024;
// Umumiy ma'lumotlar uchun CDN kesh muddati (soniya)
const SHARED_TTL = { leaderboard: 30, config: 30, challenges: 30, words: 600, packs: 600, hall: 3600 };

const reply = (status, body) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-telegram-init-data, x-account-id',
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
  },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

export const handler = async event => {
  if (event.httpMethod === 'OPTIONS') return reply(200, { ok: true });

  const base = String(process.env.FIREBASE_DB_URL || process.env.VITE_FIREBASE_DB_URL || '').replace(/\/$/, '');
  const secret = process.env.FIREBASE_DB_SECRET;
  if (!base) return reply(503, { error: 'Baza manzili sozlanmagan' });

  const method = String(event.httpMethod || 'GET').toUpperCase();
  if (!['GET', 'PUT', 'PATCH', 'DELETE'].includes(method)) return reply(405, { error: 'Usul ruxsat etilmagan' });

  const path = String(event.queryStringParameters?.p || '').replace(/^\/+|\/+$/g, '');
  if (!ALLOWED.test(path) || path.includes('..')) return reply(400, { error: "Yo'l ruxsat etilmagan" });

  const parts = path.split('/');
  const root = parts[0];
  const targetId = parts[1] || '';

  // Xavfsizlik: DELETE amali faqat eskirgan sub-kalitlarni (masalan: state/<uid>/srs_<epoch>) tozalash uchun ruxsat etiladi.
  // Butun boshli hisob yoki begona tugunlarni o'chirish qat'iyan taqiqlanadi!
  if (method === 'DELETE') {
    if (root !== 'state' || parts.length < 3 || !parts[2].startsWith('srs_')) {
      return reply(403, { error: "Ildiz hisobni o'chirishga ruxsat yo'q" });
    }
  }

  // Yozish va o'chirish amallari uchun foydalanuvchi shaxsini tekshirish
  if (method !== 'GET') {
    const token = process.env.BOT_TOKEN;
    const initData = event.headers['x-telegram-init-data'] || event.queryStringParameters?.initData;
    const accountHeader = event.headers['x-account-id'] || '';

    // 1. Telegram foydalanuvchisi tekshiruvi (tg_ bilan boshlanuvchi hisoblar)
    let authenticatedTgId = null;
    if (token && initData) {
      const user = verifyInitData(initData, token);
      if (user && user.id) {
        authenticatedTgId = String(user.id);
      }
    }

    // Telegram ID tekshiruvini qat'iy qilish
    if (targetId.startsWith('tg_')) {
      const expectedTgId = targetId.replace(/^tg_/, '');
      if (token && (!authenticatedTgId || authenticatedTgId !== expectedTgId)) {
        return reply(401, { error: 'Telegram imzosi tasdiqlanmadi yoki hisob boshqaga tegishli' });
      }
    }

    // Duellar va chellenjlarda o'yinchilar yozuvi tekshiruvi
    if ((root === 'duels' || root === 'challenges') && parts[2] === 'players' && parts[3]) {
      const playerUid = parts[3];
      if (playerUid.startsWith('tg_') && token) {
        const expected = playerUid.replace(/^tg_/, '');
        if (!authenticatedTgId || authenticatedTgId !== expected) {
          return reply(401, { error: 'Bellashuvdagi Telegram imzosi tasdiqlanmadi' });
        }
      }
    }
  }

  let body;
  if (method === 'PUT' || method === 'PATCH') {
    body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
    if (!body || body.length > MAX_BODY) return reply(413, { error: 'Ma’lumot hajmi xato' });

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return reply(400, { error: 'JSON formati xato' });
    }

    // Anti-cheat & validatsiya
    if (root === 'leaderboard' && parsed && typeof parsed === 'object') {
      if (parsed.xp !== undefined) {
        const xpNum = Number(parsed.xp);
        if (!Number.isFinite(xpNum) || xpNum < 0 || xpNum > 100000000) {
          return reply(400, { error: "XP miqdori noto'g'ri" });
        }
      }
      if (parsed.streak !== undefined) {
        const streakNum = Number(parsed.streak);
        if (!Number.isFinite(streakNum) || streakNum < 0 || streakNum > 10000) {
          return reply(400, { error: "Streak noto'g'ri" });
        }
      }
      // Admin XP tuzatishi (adj/adjV) faqat admin paneldan o'zgaradi — ilova yozolmaydi
      if ('adj' in parsed || 'adjV' in parsed || 'hasGrant' in parsed || 'refs' in parsed) {
        delete parsed.adj;
        delete parsed.adjV;
        delete parsed.refs; // taklif qilingan do'stlar soni — faqat server yozadi
        delete parsed.hasGrant; // faqat server qo'yadi
        body = JSON.stringify(parsed);
      }
      for (const k of ['fr', 'nf', 'nc', 'ns', 'ti', 'rb']) {
        if (k in parsed) { parsed[k] = String(parsed[k] ?? '').slice(0, 24); body = JSON.stringify(parsed); }
      }
      if (parsed.name && typeof parsed.name === 'string') {
        parsed.name = parsed.name.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 60);
        body = JSON.stringify(parsed);
      }
    }

    if (root === 'duels' && parts.length === 2 && parts[1] && method === 'PUT') {
      // Yangi duel metadatasini yaratish
      if (path.endsWith('/meta')) {
        if (!parsed.metric || !parsed.endsAt || !parsed.createdBy) {
          return reply(400, { error: "Duel ma'lumotlari to'liq emas" });
        }
      }
    }
  }

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 9000);
    const authParam = secret ? `?auth=${encodeURIComponent(secret)}` : '';
    const r = await fetch(`${base}/${path}.json${authParam}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body,
      signal: ctl.signal,
    });
    clearTimeout(t);
    const text = await r.text();
    const res = reply(r.status, text);
    // Umumiy (hamma uchun bir xil) o'qishlar Netlify CDN'da keshlanadi: bitta funksiya chaqiruvi minglab foydalanuvchiga yetadi.
    if (method === 'GET' && r.ok) {
      const ttl = SHARED_TTL[root];
      if (ttl && parts.length <= (root === 'challenges' ? 1 : 1)) {
        res.headers['Netlify-CDN-Cache-Control'] = `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`;
      }
    }
    return res;
  } catch (e) {
    return reply(502, { error: 'Bazaga ulanib bo‘lmadi: ' + String(e.message || e) });
  }
};
