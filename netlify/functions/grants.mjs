// Admin sovg'alarini QABUL QILISH. Har bir sovg'a serverda "olingan" deb belgilanadi, shuning uchun u faqat BIR MARTA
// (qaysi qurilmadan bo'lmasin) qo'llanadi — har kuni yoki har qurilmada qayta ishlamaydi.
//   POST { uid, initData, done: [oldin qo'llangan sovg'a ID lari] }  ->  { grants: [{ id, type, amount, validHours, note }] }
import { json, parseBody, verifyInitData, makeDb, claimNode } from '../lib/tg.mjs';

const ID_RE = /^[A-Za-z0-9_\-]{3,64}$/;
const MAX_AGE = 7 * 24 * 3600 * 1000; // 7 kundan eski, olinmagan sovg'alar kuchini yo'qotadi

export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST kerak' });
  const db = makeDb();
  if (!db) return json(503, { error: 'Baza sozlanmagan' });
  const body = parseBody(event);
  const uid = String(body?.uid || '');
  if (!ID_RE.test(uid)) return json(400, { error: 'Hisob ID xato' });

  if (uid.startsWith('tg_') && process.env.BOT_TOKEN) {
    const user = verifyInitData(body.initData, process.env.BOT_TOKEN);
    if (!user || `tg_${user.id}` !== uid) return json(401, { error: 'Telegram imzosi tasdiqlanmadi' });
  }

  try {
    const all = (await db('GET', `grants/${uid}`)) || {};
    const done = new Set(Array.isArray(body.done) ? body.done.map(String) : []);
    const out = [];
    for (const [gid, g] of Object.entries(all)) {
      if (!g || typeof g !== 'object' || g.claimedAt) continue;
      const claimed = await claimNode(`grants/${uid}/${gid}`);
      if (!claimed) continue; // boshqa qurilma oldin oldi
      const old = done.has(gid) || Date.now() - (Number(g.ts) || 0) > MAX_AGE;
      if (old) continue; // eski/qo'llangan sovg'a: faqat belgilanadi, qayta qo'llanmaydi
      out.push({ id: gid, type: g.type, amount: Number(g.amount) || 0, coins: Number(g.coins) || 0, validHours: Number(g.validHours) || 0, note: g.note || '' });
    }
    out.sort((a, b) => (a.id < b.id ? -1 : 1));
    // Bayroqni o'chiramiz: ilova keyingi safar bu funksiyani chaqirmaydi (kredit tejash)
    await db('PATCH', `leaderboard/${uid}`, { hasGrant: false }).catch(() => {});
    return json(200, { grants: out });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
