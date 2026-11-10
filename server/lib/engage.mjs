// v11: Retention (foydalanuvchini ushlab qolish) mexanizmlari:
//   • kunlik xabar limiti (bir foydalanuvchiga kuniga N tadan ko'p avtomatik xabar bormaydi)
//   • win-back: N kundan beri kirmaganlarga qaytarish xabari (+ ixtiyoriy sovg'a)
//   • faollashtirish: /start bosgan, lekin ilovani HECH QACHON ochmaganlarga eslatma (+ sovg'a)
//   • haftalik natija: TOP-20 dan TASHQARIdagilarga shaxsiy hafta xulosasi (ertalab, navbat bilan)
// Hammasi admin panel → 🚀 Retention dan boshqariladi (config/retention).
import { sendMessage, openAppMarkup, tashkentDay, tashkentNow, escHtml, giftText, grantUpdates, fillTpl, cleanGift, cleanMilestones } from './tg.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const DAY = 86400000;
const clamp = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
export const isBlockedErr = e => e?.code === 403 || /blocked|deactivated|chat not found/i.test(String(e?.message || ''));

/* ---------------- standart matnlar va sozlamalar ---------------- */
export const DEFAULT_RISK_TEXTS = [
  "⏳ {name}, bugun hali mashq qilmadingiz.\n\n🔥 <b>{streak} kunlik</b> streakingiz xavf ostida! Atigi 2 daqiqa — va seriya saqlanadi 👇",
  "🔥 {name}, {streak} kun ketma-ket — bu kichik g'alaba emas!\n\nBugun 5 ta so'z takrorlang, seriyani uzmang 💪",
  "⚠️ {name}, tun yarmigacha vaqt bor: {streak} kunlik seriyangiz bugun mashq kutyapti.\n\nHoziroq boshlang 👇",
];
export const DEFAULT_LOST_TEXTS = [
  "💔 {name}, {streak} kunlik streakingiz uzildi.\n\nLekin hammasi yo'qolgani yo'q — bugun yangi seriyani boshlang, birinchi kun eng oson 🚀",
  "{name}, kecha mashq qilinmadi va {streak} kunlik seriya yakunlandi 😔\n\nBugun yangidan boshlaymiz — 2 daqiqa yetadi 👇",
];
export const SAVER_RISK_TEXT = "⏳ {name}, bugun hali mashq qilmadingiz.\n\nBugun mashq qilmasangiz {streak} kunlik streakingiz muzlaydi ❄️ Muzlab qolmasligi uchun hoziroq mashq qiling 👇";
export const SAVER_FROZEN_TEXT = "❄️ {name}, to'plagan {streak} kunlik streakingiz muzladi!\n\nSaqlab qolish uchun bugun kunlik mashqlarni bajarishda davom eting 👇";
export const DEFAULT_MILESTONES = [
  { days: 7, type: 'spins', amount: 1 },
  { days: 14, type: 'spins', amount: 2 },
  { days: 30, type: 'vip', amount: 24 },
  { days: 60, type: 'spins', amount: 3 },
  { days: 100, type: 'vip', amount: 72 },
];
export const DEFAULT_MILESTONE_TEXT = "🏆 {name}, <b>{streak} kun</b> ketma-ket mashq qildingiz! Bu haqiqiy odat.\n\n🎁 Sovg'a: <b>{gift}</b> — ilovani ochganingizda avtomatik qo'shiladi 👇";
export const DEFAULT_WINBACK = [
  { days: 3, type: '', amount: 0, text: "👋 {name}, 3 kundan beri ko'rinmadingiz.\n\nBugun atigi 5 ta so'z — 2 daqiqa. So'zlar esingizdan chiqmasin, takrorlash vaqti 🔁" },
  { days: 7, type: 'spins', amount: 1, text: "{name}, sizni sog'indik 🙌\n\nQaytganingiz uchun sovg'a tayyorladik: <b>{gift}</b>. Ilovani oching — avtomatik qo'shiladi 👇" },
  { days: 14, type: 'spins', amount: 2, text: "{name}, ikki hafta bo'ldi... So'zlaringiz sizni kutyapti 📚\n\nQaytsangiz: <b>{gift}</b> sizniki 🎁" },
];
export const DEFAULT_ACTIVATION = [
  { hours: 24, type: '', amount: 0, text: "👋 {name}, VocaBoost sizni kutyapti!\n\nBirinchi mashq — atigi 2 daqiqa. Ilovani oching va dastlabki so'zlarni o'rganing 👇" },
  { hours: 96, type: 'spins', amount: 1, text: "{name}, ilovani hali ochmadingiz 🙂\n\nSizga <b>{gift}</b> sovg'a qo'yib qo'ydik — ochsangiz darhol qo'shiladi 🎁" },
];
export const DEFAULT_REST_TEXT = "🏁 <b>{week}-hafta yakunlandi!</b>\n\n{name}, siz {xp} XP bilan {total} o'quvchi orasida <b>{place}-o'rin</b>ni egalladingiz.\n🎯 TOP-20 ga chiqish uchun atigi <b>{gap} XP</b> yetmadi — yangi haftada bunga erishish oson!\n\nBugun hafta 0 dan boshlanadi. Birinchilardan bo'ling 👇";
export const DEFAULT_ZERO_TEXT = "🏁 {week}-hafta yakunlandi.\n\n{name}, bu hafta ligada ishtirok etmadingiz. Yangi hafta hammaga 0 dan boshlanadi — birinchi XP ni bugunoq oling 🚀";
export const DEFAULT_REST_BUTTON = '🚀 Yangi haftani boshlash';

const textsOf = (v, def) => {
  const a = (Array.isArray(v) ? v : Object.values(v || {})).map(t => String(t || '').trim().slice(0, 1500)).filter(Boolean).slice(0, 12);
  return a.length ? a : def;
};
const stepsOf = (v, def, key) => {
  if (v === undefined || v === null) return def;
  return (Array.isArray(v) ? v : Object.values(v || {}))
    .map(s => ({ [key]: Math.round(Number(s?.[key]) || 0), ...(cleanGift(s) || { type: '', amount: 0 }), text: String(s?.text || '').trim().slice(0, 1500) }))
    .filter(s => s[key] > 0 && s.text)
    .sort((a, b) => a[key] - b[key])
    .slice(0, 6);
};

/** Admin saqlagan sozlamalar + standartlar birlashtiriladi (admin panel ham, cron ham shuni ishlatadi) */
export function mergeRt(raw, legacy = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const st = r.streak || {};
  const wb = r.winback || {};
  const wr = r.weekRest || {};
  return {
    cap: clamp(r.cap, 1, 10, 2),
    streak: {
      enabled: (st.enabled ?? legacy.enabled) !== false,
      minStreak: clamp(st.minStreak, 1, 365, 3),
      frozenHour: clamp(st.frozenHour ?? legacy.frozenHour, 0, 23, 10),
      riskHour: clamp(st.riskHour ?? legacy.riskHour, 0, 23, 20),
      maxPerRun: clamp(st.maxPerRun, 20, 2000, 400),
      riskTexts: textsOf(st.riskTexts, DEFAULT_RISK_TEXTS),
      lostTexts: textsOf(st.lostTexts, DEFAULT_LOST_TEXTS),
      milestoneOn: st.milestoneOn !== false,
      milestones: (st.milestones === undefined ? DEFAULT_MILESTONES : (Array.isArray(st.milestones) ? st.milestones : Object.values(st.milestones || {}))
        .map(m => ({ days: Math.round(Number(m?.days) || 0), ...(cleanGift(m) || {}) })).filter(m => m.days > 0 && m.type).sort((a, b) => a.days - b.days).slice(0, 8)),
      milestoneText: String(st.milestoneText || '').trim().slice(0, 1500) || DEFAULT_MILESTONE_TEXT,
    },
    winback: {
      enabled: wb.enabled !== false,
      hourFrom: clamp(wb.hourFrom, 6, 22, 10),
      hourTo: clamp(wb.hourTo, 6, 23, 20),
      maxDays: clamp(wb.maxDays, 7, 365, 45),
      maxPerRun: clamp(wb.maxPerRun, 10, 1000, 200),
      steps: stepsOf(wb.steps, DEFAULT_WINBACK, 'days'),
      activationOn: wb.activationOn !== false,
      activation: stepsOf(wb.activation, DEFAULT_ACTIVATION, 'hours'),
    },
    weekRest: {
      enabled: wr.enabled !== false,
      hour: clamp(wr.hour, 6, 20, 9),
      zero: wr.zero === true,
      text: String(wr.text || '').trim().slice(0, 1500) || DEFAULT_REST_TEXT,
      zeroText: String(wr.zeroText || '').trim().slice(0, 1500) || DEFAULT_ZERO_TEXT,
      button: String(wr.button || '').trim().slice(0, 40) || DEFAULT_REST_BUTTON,
    },
  };
}
export async function loadRt(db) {
  const [raw, legacy] = await Promise.all([db('GET', 'config/retention').catch(() => null), db('GET', 'config/streakWarn').catch(() => null)]);
  return mergeRt(raw, legacy || {});
}

/* ---------------- umumiy yordamchilar ---------------- */
/** Kunlik limit: tgusers/<id>/am = { d: 'YYYY-MM-DD', n: yuborilgan soni } */
export const capOK = (u, day, cap) => !(u?.am && u.am.d === day && Number(u.am.n) >= cap);
export const capMark = (u, day) => ({ d: day, n: (u?.am && u.am.d === day ? Number(u.am.n) || 0 : 0) + 1 });

/** HTML xato bo'lsa teglarsiz yuboradi; 429 da kutadi */
export async function sendAuto(token, chatId, text, label, style = 'success') {
  const markup = openAppMarkup(label, style);
  for (let t = 0; ; t++) {
    try {
      try {
        return await sendMessage(token, chatId, text, markup, 'HTML');
      } catch (e) {
        if (/parse entities|can't find end|unsupported start tag/i.test(String(e?.message))) {
          const plain = text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
          return await sendMessage(token, chatId, plain, markup, null);
        }
        throw e;
      }
    } catch (e) {
      if (e.code === 429 && t < 2) { await sleep(((e.retryAfter || 2) + 0.5) * 1000); continue; }
      throw e;
    }
  }
}

/** Ishlarni 10 tadan bo'lib (~25 xabar/soniya) bajaradi; vaqt tugasa to'xtaydi. fn(part) har bo'lakdan keyin natijani yozadi */
export async function inBatches(jobs, { t0, budgetMs, conc = 10, gap = 350 }, fn) {
  let i = 0;
  while (i < jobs.length && Date.now() - t0 < budgetMs) {
    await fn(jobs.slice(i, i + conc));
    i += conc;
    await sleep(gap);
  }
  return Math.min(i, jobs.length);
}

/** Kunlik hisoblagich (admin panelda «samaradorlik»): adminState/engage/<kun>/<kalit> */
export async function bump(db, counts) {
  const day = tashkentDay();
  try {
    const cur = (await db('GET', `adminState/engage/${day}`)) || {};
    const upd = {};
    for (const [k, v] of Object.entries(counts)) if (v) upd[k] = (Number(cur[k]) || 0) + v;
    if (Object.keys(upd).length) await db('PATCH', `adminState/engage/${day}`, upd);
  } catch { /* hisoblagich muhim emas */ }
}

/* ---------------- WIN-BACK + faollashtirish ---------------- */
export async function runWinback(db, token, rt, { budgetMs = 25000 } = {}) {
  const cfg = rt.winback;
  if (!cfg.enabled) return { off: true };
  const hour = tashkentNow().getUTCHours();
  if (hour < cfg.hourFrom || hour > cfg.hourTo) return { wait: true };
  const t0 = Date.now();
  const [lb, users] = await Promise.all([db('GET', 'leaderboard'), db('GET', 'tgusers')]);
  const day = tashkentDay();
  const now = Date.now();
  const jobs = [];
  for (const [id, u] of Object.entries(users || {})) {
    if (!/^\d{3,15}$/.test(id) || !u || typeof u !== 'object' || u.blocked || u.remind === false) continue;
    const e = (lb || {})[`tg_${id}`];
    if (e?.deleted) continue;
    const last = Number(e?.ts || u.lastSeen || 0);
    if (last) {
      const days = (now - last) / DAY;
      if (days > cfg.maxDays) continue;
      let idx = -1;
      cfg.steps.forEach((s, i) => { if (days >= s.days) idx = i; });
      if (idx < 0) continue;
      const wb = u.wb || {};
      if (Number(wb.at) === last && Number(wb.n) > idx) continue; // shu «yo'qolish davri»da bu qadam yuborilgan
      jobs.push({ id, u, e, kind: 'winback', idx, step: cfg.steps[idx], last, weight: last });
    } else if (cfg.activationOn) {
      const joined = Number(u.joined || u.ts || 0);
      if (!joined) continue;
      const hrs = (now - joined) / 3600000;
      if (hrs > 24 * 30) continue;
      let idx = -1;
      cfg.activation.forEach((s, i) => { if (hrs >= s.hours) idx = i; });
      if (idx < 0 || Number(u.act || 0) > idx) continue;
      jobs.push({ id, u, e: null, kind: 'activation', idx, step: cfg.activation[idx], weight: joined });
    }
  }
  jobs.sort((a, b) => b.weight - a.weight); // yaqinda yo'qolganlar birinchi
  const todo = jobs.slice(0, cfg.maxPerRun);
  const res = { winback: 0, activation: 0, blocked: 0, capped: 0, failed: 0, gifts: 0, due: jobs.length };
  await inBatches(todo, { t0, budgetMs }, async part => {
    const upd = {};
    await Promise.all(part.map(async j => {
      if (!capOK(j.u, day, rt.cap)) { res.capped++; return; }
      const name = String(j.u.name || j.e?.name || '').trim();
      const hasGift = !!j.step.type && j.step.amount > 0;
      const gift = hasGift ? giftText(j.step.type, j.step.amount) : '';
      const text = fillTpl(j.step.text, { name, gift });
      try {
        await sendAuto(token, Number(j.id), text, hasGift ? "🎁 Sovg'ani olish" : '🚀 Mashq qilish');
        j.u.am = capMark(j.u, day);
        upd[`tgusers/${j.id}/am`] = j.u.am;
        if (j.kind === 'winback') upd[`tgusers/${j.id}/wb`] = { at: j.last, n: j.idx + 1, ts: now };
        else upd[`tgusers/${j.id}/act`] = j.idx + 1;
        if (hasGift) {
          Object.assign(upd, grantUpdates(`tg_${j.id}`, { ...j.step, note: j.kind === 'winback' ? 'Qaytganingiz uchun sovg\'a' : 'Xush kelibsiz sovg\'asi' }, { flag: !!j.e }));
          res.gifts++;
        }
        res[j.kind]++;
      } catch (err) {
        if (isBlockedErr(err)) { res.blocked++; upd[`tgusers/${j.id}/blocked`] = true; }
        else res.failed++;
      }
    }));
    if (Object.keys(upd).length) await db('PATCH', '', upd).catch(() => {});
  });
  await bump(db, { winback: res.winback, activation: res.activation, gifts: res.gifts, blocked: res.blocked });
  return res;
}

/* ---------------- HAFTALIK NATIJA: TOP-20 dan tashqaridagilar ---------------- */
/** finishWeek chaqiradi: `all` — XP kamayish tartibida butun ro'yxat [{uid, e, xp}] (XP nolga tushishidan OLDIN) */
export async function enqueueWeekRest(db, all, week, rt) {
  const wr = rt.weekRest;
  if (!wr.enabled) return { queued: 0, off: true };
  const firstName = e => String(e?.name || '').trim().split(/\s+/)[0] || '';
  const xp20 = all[19]?.xp ?? 0;
  const items = {};
  all.forEach((r, i) => {
    if (i < 20 || !/^tg_\d{3,15}$/.test(r.uid)) return;
    items[r.uid.slice(3)] = { x: r.xp, p: i + 1, n: firstName(r.e).slice(0, 30), g: Math.max(1, xp20 - r.xp + 1), u: Math.max(1, (all[i - 1]?.xp ?? r.xp) - r.xp + 1) };
  });
  let zero = 0;
  if (wr.zero) {
    const lb = (await db('GET', 'leaderboard').catch(() => null)) || {};
    const inAll = new Set(all.map(r => r.uid));
    for (const [uid, e] of Object.entries(lb)) {
      if (!/^tg_\d{3,15}$/.test(uid) || !e || e.deleted || e.hidden || inAll.has(uid)) continue;
      if (!(Number(e.ts) > Date.now() - 30 * DAY)) continue;
      items[uid.slice(3)] = { x: 0, p: 0, n: firstName(e).slice(0, 30), g: 0, u: 0 };
      zero++;
    }
  }
  const queued = Object.keys(items).length;
  if (!queued) return { queued: 0 };
  await db('PUT', 'weekRest', {
    meta: { week, total: all.length, xp20, at: Date.now(), day: tashkentDay(), hour: wr.hour, text: wr.text, zeroText: wr.zeroText, button: wr.button, sent: 0, blocked: 0, failed: 0, queued },
    items,
  });
  return { queued, zero };
}

/** Navbatni bo'shatadi (har soatlik cron chaqiradi). force=true — soat tekshirilmaydi (admin «hozir yuborish») */
export async function drainWeekRest(db, token, rt, { force = false, budgetMs = 25000 } = {}) {
  const meta = await db('GET', 'weekRest/meta').catch(() => null);
  if (!meta) return { none: true };
  if (Date.now() - Number(meta.at || 0) > 3 * DAY) { await db('DELETE', 'weekRest').catch(() => {}); return { stale: true }; }
  const hour = tashkentNow().getUTCHours();
  if (!force && (hour < Number(meta.hour ?? 9) || hour > 21)) return { wait: true };
  const t0 = Date.now();
  const [items, users] = await Promise.all([db('GET', 'weekRest/items'), db('GET', 'tgusers')]);
  const ids = Object.keys(items || {});
  const day = tashkentDay();
  const res = { sent: 0, blocked: 0, failed: 0, skipped: 0, capped: 0 };
  const jobs = ids.map(id => ({ id, it: items[id], u: (users || {})[id] || {} }));
  await inBatches(jobs, { t0, budgetMs }, async part => {
    const upd = {};
    await Promise.all(part.map(async j => {
      if (!j.u || j.u.blocked || j.u.remind === false) { res.skipped++; upd[`weekRest/items/${j.id}`] = null; return; }
      if (!capOK(j.u, day, rt.cap + 1)) { res.capped++; return; } // haftalik xulosa uchun limitga +1 beriladi, kechroq qayta uriniladi
      const it = j.it || {};
      const vars = { name: it.n || j.u.name || '', week: meta.week, xp: it.x, place: it.p, total: meta.total, gap: it.g, nextGap: it.u };
      const text = fillTpl(it.p > 0 ? meta.text : meta.zeroText, vars);
      try {
        await sendAuto(token, Number(j.id), text, meta.button || DEFAULT_REST_BUTTON);
        res.sent++;
        j.u.am = capMark(j.u, day);
        upd[`tgusers/${j.id}/am`] = j.u.am;
      } catch (err) {
        if (isBlockedErr(err)) { res.blocked++; upd[`tgusers/${j.id}/blocked`] = true; }
        else res.failed++;
      }
      upd[`weekRest/items/${j.id}`] = null;
    }));
    if (Object.keys(upd).length) await db('PATCH', '', upd).catch(() => {});
  });
  const left = Object.keys((await db('GET', 'weekRest/items').catch(() => null)) || {}).length;
  const tot = { sent: (Number(meta.sent) || 0) + res.sent, blocked: (Number(meta.blocked) || 0) + res.blocked, failed: (Number(meta.failed) || 0) + res.failed };
  if (!left) {
    await db('PUT', 'adminState/weekRestLast', { week: meta.week, queued: meta.queued, ...tot, at: Date.now() }).catch(() => {});
    await db('DELETE', 'weekRest').catch(() => {});
  } else {
    await db('PATCH', 'weekRest/meta', tot).catch(() => {});
  }
  await bump(db, { weekRest: res.sent, blocked: res.blocked });
  return { ...res, left };
}

/** Admin «sinov» uchun namunaviy matn (haqiqiy foydalanuvchilarga ta'sir qilmaydi) */
export function sampleMessage(kind, rt) {
  const name = 'Sinov';
  const st = rt.streak;
  const wb = rt.winback;
  const gift = (s) => (s?.type ? giftText(s.type, s.amount) : '');
  switch (kind) {
    case 'risk': return { text: fillTpl(st.riskTexts[0], { name, streak: 12 }), label: '🚀 Mashq qilish' };
    case 'lost': return { text: fillTpl(st.lostTexts[0], { name, streak: 12 }), label: '🚀 Mashq qilish' };
    case 'milestone': { const m = st.milestones[0] || { type: 'spins', amount: 1, days: 7 }; return { text: fillTpl(st.milestoneText, { name, streak: m.days, gift: giftText(m.type, m.amount) }), label: "🎁 Sovg'ani olish" }; }
    case 'winback': { const s = wb.steps[wb.steps.length - 1]; return s ? { text: fillTpl(s.text, { name, gift: gift(s) }), label: s.type ? "🎁 Sovg'ani olish" : '🚀 Mashq qilish' } : null; }
    case 'activation': { const s = wb.activation[wb.activation.length - 1]; return s ? { text: fillTpl(s.text, { name, gift: gift(s) }), label: s.type ? "🎁 Sovg'ani olish" : '🚀 Mashq qilish' } : null; }
    case 'rest': return { text: fillTpl(rt.weekRest.text, { name, week: 7, xp: 840, place: 63, total: 410, gap: 215, nextGap: 12 }), label: rt.weekRest.button };
    default: return null;
  }
}
export { escHtml, cleanMilestones };
