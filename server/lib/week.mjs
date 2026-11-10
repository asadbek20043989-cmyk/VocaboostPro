// Haftalik ligani yakunlash (admin «Yangi hafta» tugmasi VA avtomatik cron ikkalasi shu funksiyani ishlatadi).
//  1) TOP-20 «Tarix zali»ga qotiriladi; 2) hammaning liga XP si 0 ga tushadi; 3) yangi hafta boshlanadi;
//  4) TOP-20 o'quvchiga bot orqali tabrik xabari + «Mashqni davom ettirish» tugmasi yuboriladi.
import { issueCertificate, statsFromLb, tashkentDay, sendMessage, openAppMarkup, escHtml } from './tg.mjs';
import { loadRt, enqueueWeekRest } from './engage.mjs';

export const DEFAULT_WEEK_TEXT = "🏁{week}-hafta tugadi.\n\n🎉 Siz {xp}XP bilan {place}-o'rinni oldingiz va kuchli TOP20 talikka kirdingiz. Tabriklaymiz 🎊🎊🎊";
export const DEFAULT_WEEK_BUTTON = '▶️ Mashqni davom ettirish';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const newGid = () => 'g' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
const shownOf = e => Math.max(0, (Number(e?.xp) || 0) + (Number(e?.xpOffset) || 0));

/** Xabar matni: {week} {xp} {place} {name} almashtiriladi */
export const renderWeekText = (tpl, { week, xp, place, name }) =>
  String(tpl || DEFAULT_WEEK_TEXT)
    .replace(/\{week\}/gi, () => String(week))
    .replace(/\{xp\}/gi, () => String(xp))
    .replace(/\{place\}/gi, () => String(place))
    .replace(/\{name\}/gi, () => escHtml(String(name || '').trim().split(/\s+/)[0] || "do'st"));

async function sendOne(token, tgId, text, button) {
  const markup = openAppMarkup(button || DEFAULT_WEEK_BUTTON, 'success');
  for (let tries = 0; ; tries++) {
    try {
      try {
        return await sendMessage(token, tgId, text, markup, 'HTML');
      } catch (e) {
        // Admin yozgan HTML noto'g'ri bo'lsa — teglarsiz yuboramiz (xabar yo'qolmasin)
        if (/parse entities|can't find end|unsupported start tag/i.test(String(e?.message))) {
          const plain = text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
          return await sendMessage(token, tgId, plain, markup, null);
        }
        throw e;
      }
    } catch (e) {
      if (e.code === 429 && tries < 2) { await sleep(((e.retryAfter || 2) + 0.5) * 1000); continue; }
      throw e;
    }
  }
}

/** TOP-20 ga haftalik tabrik xabari. Bot bloklangan yoki Telegram bo'lmagan hisoblarga yuborilmaydi */
export async function notifyTop(db, ranked, week, { text, button } = {}) {
  const token = process.env.BOT_TOKEN;
  const res = { sent: 0, blocked: 0, failed: 0, skipped: 0 };
  if (!token) return { ...res, skipped: ranked.length, noToken: true };
  const jobs = ranked.map((r, i) => ({ ...r, place: i + 1 })).filter(r => {
    if (!/^tg_\d{3,15}$/.test(r.uid)) { res.skipped++; return false; }
    return true;
  });
  for (let i = 0; i < jobs.length; i += 8) {
    await Promise.all(jobs.slice(i, i + 8).map(async j => {
      const id = j.uid.slice(3);
      try {
        const u = (await db('GET', `tgusers/${id}`).catch(() => null)) || {};
        if (u.blocked) { res.blocked++; return; }
        const body = renderWeekText(text, { week, xp: j.xp, place: j.place, name: j.e?.name || u.name });
        await sendOne(token, Number(id), body, button);
        res.sent++;
      } catch (e) {
        if (e.code === 403 || /blocked|deactivated|chat not found/i.test(String(e.message))) {
          res.blocked++;
          await db('PATCH', `tgusers/${id}`, { blocked: true }).catch(() => {});
        } else res.failed++;
      }
    }));
    await sleep(60);
  }
  return res;
}

const flagGrant = async (db, uid) => {
  try {
    if (await db('GET', `leaderboard/${uid}/ts`)) await db('PATCH', `leaderboard/${uid}`, { hasGrant: true });
  } catch { /* bayroq muhim emas */ }
};

/**
 * o: { rewardSpins, rewardCert, certFmt, notify (standart true), text, button }
 * Xato: Error (message — foydalanuvchiga ko'rsatiladigan matn, .code = 'DUP' agar hafta allaqachon yozilgan bo'lsa)
 */
export async function finishWeek(db, o = {}) {
  const lb = (await db('GET', 'leaderboard')) || {};
  const league = (await db('GET', 'config/league')) || {};
  const week = Math.max(1, Math.round(Number(league.week) || 1));
  const hallId = 'w' + String(week).padStart(4, '0');
  if (await db('GET', `hall/${hallId}/week`)) {
    const err = new Error(`${week}-hafta allaqachon Tarix zaliga yozilgan (qayta yozib bo'lmaydi). Sahifani yangilang.`);
    err.code = 'DUP';
    throw err;
  }

  // v11: butun reyting (TOP-20 dan tashqaridagilar uchun ham haftalik xulosa tayyorlanadi)
  const allRanked = Object.entries(lb)
    .filter(([, e]) => e && !e.deleted && !e.hidden && shownOf(e) > 0)
    .map(([uid, e]) => ({ uid, e, xp: shownOf(e) }))
    .sort((a, b) => b.xp - a.xp || (Number(a.e.ts) || 0) - (Number(b.e.ts) || 0));
  const ranked = allRanked.slice(0, 20);
  const top = ranked.map((r, i) => ({
    place: i + 1,
    uid: r.uid,
    name: String(r.e.name || "O'quvchi").slice(0, 40),
    avatar: typeof r.e.avatar === 'string' && !r.e.avatar.startsWith('data:') ? r.e.avatar.slice(0, 300) : '',
    xp: r.xp,
    streak: Number(r.e.streak) || 0,
    level: String(r.e.level || '').slice(0, 4),
  }));
  const totalPlayers = Object.values(lb).filter(e => e && !e.deleted && shownOf(e) > 0).length;
  const endedAt = Date.now();
  if (top.length) {
    await db('PUT', `hall/${hallId}`, { week, startedAt: Number(league.startedAt) || 0, endedAt, date: tashkentDay(), players: totalPlayers, top });
  }

  let rewarded = 0;
  if (o.rewardSpins) {
    const spins = [5, 3, 2];
    for (let i = 0; i < Math.min(3, ranked.length); i++) {
      await db('PUT', `grants/${ranked[i].uid}/${newGid()}`, { type: 'spins', amount: spins[i], validHours: 72, note: `${week}-hafta ligasi: ${i + 1}-o'rin`, ts: Date.now() });
      await flagGrant(db, ranked[i].uid);
      rewarded++;
    }
  }
  if (o.rewardCert && ranked[0]) {
    await issueCertificate(db, {
      userId: ranked[0].uid, tpl: 'weekly', label: `${week}-HAFTA CHEMPIONI`, title: `${week}-hafta ligasi g'olibi`, reason: `${ranked[0].xp} XP bilan haftaning eng kuchli o'quvchisi bo'ldi`,
      name: top[0].name, fmt: o.certFmt === 'story' ? 'story' : 'wide', stats: statsFromLb(ranked[0].e),
    });
    rewarded++;
  }

  // Hamma uchun XP 0 dan boshlanadi (foydalanuvchining o'z hisobi ham farq (adj) orqali nolga tushadi)
  const upd = {};
  for (const [id, e] of Object.entries(lb)) {
    const shown = shownOf(e);
    upd[`${id}/xp`] = 0;
    upd[`${id}/xpOffset`] = 0;
    upd[`${id}/adj`] = (Number(e?.adj) || 0) - shown;
    upd[`${id}/adjV`] = (Number(e?.adjV) || 0) + 1;
  }
  if (Object.keys(upd).length) await db('PATCH', 'leaderboard', upd);
  // MUHIM: PATCH — `auto`, `msgText` kabi sozlamalar o'chib ketmasin
  await db('PATCH', 'config/league', { week: week + 1, startedAt: endedAt, lastFinishedAt: endedAt });

  // v11: TOP-20 dan tashqaridagilarga shaxsiy hafta xulosasi — navbatga qo'yiladi, ertalab (admin belgilagan soatda) yuboriladi
  let rest = null;
  if (o.notify !== false) {
    try {
      rest = await enqueueWeekRest(db, allRanked, week, await loadRt(db));
    } catch (e) {
      rest = { queued: 0, error: String(e?.message || e) };
    }
  }

  // TOP-20 ga tabrik xabari (XP 0 ga tushishidan OLDINGI natija bilan)
  let notify = null;
  if (o.notify !== false && ranked.length) {
    try {
      notify = await notifyTop(db, ranked, week, { text: o.text ?? league.msgText, button: o.button ?? league.msgButton });
      await db('PATCH', `hall/${hallId}`, { notified: notify.sent || 0 }).catch(() => {});
    } catch (e) {
      notify = { sent: 0, blocked: 0, failed: ranked.length, error: String(e?.message || e) };
    }
  }
  return { week, archived: top.length, rewarded, count: Object.keys(upd).length / 4, notify, rest };
}
