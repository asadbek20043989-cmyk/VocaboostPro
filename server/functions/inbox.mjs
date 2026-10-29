// Foydalanuvchi -> Admin xabarlari. Telegram imzosi tekshiriladi, spamdan himoya (1 daqiqada 1 ta, kuniga 5 ta).
//   POST { uid, name, text, kind, initData }  ->  { ok: true }
// Xabarlar `messages/<id>` ga yoziladi va admin panelda (Xabarlar bo'limi) ism, vaqt va ID bilan ko'rinadi.
import { json, parseBody, verifyInitData, makeDb, tashkentDay } from '../lib/tg.mjs';

const ID_RE = /^[A-Za-z0-9_\-]{3,64}$/;
const KINDS = ['savol', 'muammo', 'taklif', 'boshqa'];

export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST kerak' });
  const db = makeDb();
  if (!db) return json(503, { error: 'Baza sozlanmagan' });
  const body = parseBody(event);
  if (!body) return json(400, { error: "Noto'g'ri so'rov" });

  const uid = String(body.uid || '');
  if (!ID_RE.test(uid)) return json(400, { error: 'Hisob ID xato' });
  const text = String(body.text || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 800);
  if (text.length < 3) return json(400, { error: 'Xabar juda qisqa' });

  let tgUser = null;
  if (uid.startsWith('tg_') && process.env.BOT_TOKEN) {
    tgUser = verifyInitData(body.initData, process.env.BOT_TOKEN);
    if (!tgUser || `tg_${tgUser.id}` !== uid) return json(401, { error: 'Telegram imzosi tasdiqlanmadi' });
  }

  try {
    // Spamdan himoya
    const day = tashkentDay();
    const lim = (await db('GET', `msgLimit/${uid}`)) || {};
    const count = lim.day === day ? Number(lim.count) || 0 : 0;
    if (Date.now() - (Number(lim.ts) || 0) < 60000) return json(429, { error: 'Iltimos, 1 daqiqadan so‘ng qayta yuboring' });
    if (count >= 5) return json(429, { error: 'Bugun uchun xabar limiti tugadi (kuniga 5 ta). Ertaga yozing' });

    const lb = await db('GET', `leaderboard/${uid}`);
    const name = String(body.name || lb?.name || tgUser?.first_name || "O'quvchi").replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 60);
    const id = 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    await db('PUT', `messages/${id}`, {
      uid,
      name,
      un: String(tgUser?.username || lb?.un || '').slice(0, 40),
      level: String(lb?.level || '').slice(0, 4),
      xp: Math.max(0, Math.round((Number(lb?.xp) || 0) + (Number(lb?.xpOffset) || 0))),
      kind: KINDS.includes(body.kind) ? body.kind : 'boshqa',
      text,
      ts: Date.now(),
      read: false,
    });
    await db('PUT', `msgLimit/${uid}`, { day, count: count + 1, ts: Date.now() });
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
