// Do'kondan QO'LDA beriladigan mahsulotlar (Telegram Premium / Stars va admin qo'shgan sovg'alar) uchun buyurtma qabul qiladi.
// Oddiy mahsulotlar (boost, ramka, mavzu...) ilovaning o'zida shu zahoti beriladi — bu funksiya chaqirilmaydi (kredit tejaladi).
//   POST { uid, initData, action: 'order', itemId, title, price, name }  ->  { ok: true, id }
// Buyurtma `orders/<id>` ga yoziladi va admin panelning «🛒 Do'kon → Buyurtmalar» bo'limida ko'rinadi.
// Admin Telegramida bildirishnoma olishi uchun Vercel muhitida ADMIN_CHAT_ID (Telegram ID, vergul bilan bir nechta) kiriting.
import { json, parseBody, verifyInitData, makeDb, sendMessage, escHtml, tashkentDay } from '../lib/tg.mjs';

const ID_RE = /^[A-Za-z0-9_\-]{3,64}$/;
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);

export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST kerak' });
  const db = makeDb();
  if (!db) return json(503, { error: 'Baza sozlanmagan' });
  const body = parseBody(event);
  if (!body) return json(400, { error: "Noto'g'ri so'rov" });
  const uid = String(body.uid || '');
  if (!ID_RE.test(uid)) return json(400, { error: 'Hisob ID xato' });
  let tgUser = null;
  if (uid.startsWith('tg_') && process.env.BOT_TOKEN) {
    tgUser = verifyInitData(body.initData, process.env.BOT_TOKEN);
    if (!tgUser || `tg_${tgUser.id}` !== uid) return json(401, { error: 'Telegram imzosi tasdiqlanmadi' });
  }
  if (body.action !== 'order') return json(400, { error: "Noma'lum amal" });
  const itemId = clean(body.itemId, 64);
  if (!ID_RE.test(itemId)) return json(400, { error: 'Mahsulot ID xato' });
  try {
    const day = tashkentDay();
    const lim = (await db('GET', `shopLimit/${uid}`)) || {};
    const count = lim.day === day ? Number(lim.count) || 0 : 0;
    if (count >= 10) return json(429, { error: 'Bugun uchun buyurtma limiti tugadi' });
    const id = 'o' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    const lb = await db('GET', `leaderboard/${uid}`);
    const name = clean(body.name || lb?.name || tgUser?.first_name || "O'quvchi", 60);
    const order = {
      uid, name, un: clean(tgUser?.username || lb?.un || '', 40), itemId,
      title: clean(body.title, 100), price: Math.max(0, Math.round(Number(body.price) || 0)),
      ts: Date.now(), status: 'new',
    };
    await db('PUT', `orders/${id}`, order);
    await db('PUT', `shopLimit/${uid}`, { day, count: count + 1 });
    const token = process.env.BOT_TOKEN;
    const cfg = (await db('GET', 'config/shop/adminChat').catch(() => null)) || '';
    const chats = String(process.env.ADMIN_CHAT_ID || cfg || '').split(/[,\s]+/).filter(x => /^-?\d+$/.test(x));
    if (token && chats.length) {
      const txt = `🛒 <b>Yangi buyurtma</b>\n\n📦 ${escHtml(order.title)}\n👤 ${escHtml(name)}${order.un ? ' (@' + escHtml(order.un) + ')' : ''}\n🆔 ${escHtml(uid)}\n🪙 ${order.price} tanga\n\nAdmin panel → 🛒 Do'kon → Buyurtmalar`;
      for (const c of chats) await sendMessage(token, Number(c), txt).catch(() => {});
    }
    return json(200, { ok: true, id });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
