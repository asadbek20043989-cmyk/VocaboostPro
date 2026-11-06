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
    const t0 = Date.now();
    const budget = Number(process.env.GRANTS_BUDGET_MS) || 40000; // Vercel 60 soniya chegarasidan oldin to'xtaymiz
    const all = (await db('GET', `grants/${uid}`)) || {};
    const done = new Set(Array.isArray(body.done) ? body.done.map(String) : []);
    const out = [];
    const pending = Object.entries(all).filter(([, g]) => g && typeof g === 'object' && !g.claimedAt);
    let more = false;
    // Ko'p sovg'a (masalan, yuzlab do'st taklifi) birin-ketin olinsa vaqt chegarasidan oshib, sovg'alar «olingan» deb belgilanib, lekin ilovaga yetmay yo'qolardi.
    // Shuning uchun 10 tadan parallel olinadi; vaqt tugasa — qolgani keyingi so'rovga qoladi (`more`), ilova shu zahoti qayta so'raydi.
    for (let i = 0; i < pending.length; i += 10) {
      if (Date.now() - t0 > budget) { more = true; break; }
      const part = await Promise.all(pending.slice(i, i + 10).map(async ([gid, g]) => ({ gid, g, claimed: await claimNode(`grants/${uid}/${gid}`).catch(() => null) })));
      for (const { gid, g, claimed } of part) {
        if (!claimed) continue; // boshqa qurilma oldin oldi
        // `keep` — botda xabar yuborilgan sovg'alar (ayniqsa ilovaga hali kirmaganlarga): muddati o'tib yo'qolmaydi
        const old = done.has(gid) || (!g.keep && Date.now() - (Number(g.ts) || 0) > MAX_AGE);
        if (old) continue; // eski/qo'llangan sovg'a: faqat belgilanadi, qayta qo'llanmaydi
        out.push({ id: gid, type: g.type, amount: Number(g.amount) || 0, validHours: Number(g.validHours) || 0, note: g.note || '', itemId: String(g.itemId || '').slice(0, 64) });
      }
    }
    out.sort((a, b) => (a.id < b.id ? -1 : 1));
    // Hisoblash vaqtida yangi sovg'a (masalan, yangi do'st) kelgan bo'lishi mumkin — bayroq o'chib ketib, u yo'qolmasin
    if (!more) {
      const left = (await db('GET', `grants/${uid}`).catch(() => null)) || {};
      more = Object.values(left).some(g => g && typeof g === 'object' && !g.claimedAt);
    }
    // Bayroqni faqat hammasi olingan bo'lsa o'chiramiz: ilova keyingi safar bu funksiyani chaqirmaydi (kredit tejash)
    if (!more) await db('PATCH', `leaderboard/${uid}`, { hasGrant: false }).catch(() => {});
    return json(200, { grants: out, more });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
