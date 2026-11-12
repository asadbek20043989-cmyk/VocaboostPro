// «Global Blitz» — umumiy server mantig'i (bq.mjs, remind.mjs va admin.mjs ishlatadi).
//
// Bazadagi tugunlar (hammasi faqat server orqali yoziladi):
//   bglobal/<kod>              { ts, a, b, an, aa, bn, ba, set: { r1: {ts} } }   server ochgan jonli xona haqida yozuv (kim o'ynaydi, hisob-kitob qulfi)
//   bplay/<uid>                { gid, ts, name, avatar, q, r, s, c, t, issued }  foydalanuvchiga berilgan «ruh» raqib (javoblar shunga qarab tekshiriladi)
//   bdaily/<kun>/<uid>         { n, o: {raqib: 1}, m }                           kunlik mukofotli o'yinlar soni, o'ynalgan raqiblar, yuborilgan bot xabarlari
//   bweek/<dushanba>/<uid>     { n, a, w, p, s, ts }                             haftalik reyting (g'alabalar, o'yinlar, jami ball) — hamma o'qiy oladi
//   bstats/<kun>/<kalit>       ichki hisoblagichlar
//   bduels/<kod>/settle/r<N>   { w, r: { uid: { xp, why, used } }, at }          o'yin natijasi va mukofot (ikkala o'yinchiga ko'rinadi)
//   config/blitz              admin sozlamalari (XP, kunlik limit, bot xabari matnlari, taqiqlangan so'zlar)
import { tashkentDay, sendMessage, openAppMarkup, escHtml, fillTpl } from './tg.mjs';
import { parseBadWords } from './names.mjs';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const Q = 15; // savollar soni (mijozdagi FD_QUESTIONS bilan bir xil)
export const SEC = 5; // har bir savolga vaqt (soniya)
export const COMBO_MAX = 2.5;
export const MIN_CORRECT_MS = 400; // bundan tez «to'g'ri» javob inson uchun mumkin emas
export const TIME_SLACK_MS = 8000; // o'yin boshlanganidan beri o'tgan vaqt javoblar yig'indisidan kamida shuncha ko'p bo'lishi kerak (sanoq, savol orasidagi pauzalar)
export const SETTLE_WINDOW_MS = 30 * 60 * 1000; // ikkinchi natija shu vaqt ichida kelsa — hisoblanadi (mukofot, bot xabari)
export const NOTIFY_AFTER_MS = 30000; // birinchi tugatgan odamga bot xabari: raqib shundan keyin tugatsa (xonada kutib turmagan bo'lsa)
export const MAX_MSG_PER_DAY = 5;

const CODE_RE = /^[A-Z0-9]{6}$/;
export const isCode = c => CODE_RE.test(String(c || ''));

/* ------------------------------ sozlamalar ------------------------------ */

export const DEFAULT_MSG_WIN = '🏆 <b>{opp}</b> Global Blitzda sizga yutqazdi!\n\nHisob: siz {me} ball, {opp} {them} ball.{reward}\n\nYana bellashing 👇';
export const DEFAULT_MSG_LOSE = '⚔️ <b>{opp}</b> Global Blitzda sizni yutdi!\n\nHisob: {opp} {them} ball, siz {me} ball.\n\nHisobni tenglashtiring — qayta o‘ynang 👇';
export const DEFAULT_MSG_DRAW = '🤝 Global Blitzda <b>{opp}</b> bilan durang!\n\nIkkalangiz ham {me} ball to‘pladingiz. Qayta bellashib ko‘ring 👇';
export const DEFAULT_BUTTON = '🌍 Global Blitz ni ochish';

const clampInt = (v, lo, hi, d) => {
  if (v === '' || v == null) return d;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const str = (v, n) => String(v ?? '').trim().slice(0, n);

export function cleanCfg(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    rewards: r.rewards !== false, // g'alabaga XP berilsinmi
    xp: clampInt(r.xp, 0, 1000, 10), // bitta g'alaba uchun XP
    limit: clampInt(r.limit, 0, 100, 5), // kuniga mukofotli o'yinlar soni
    notify: r.notify !== false, // raqib natijasi keyin kelsa — bot xabari
    msgWin: str(r.msgWin, 900) || DEFAULT_MSG_WIN,
    msgLose: str(r.msgLose, 900) || DEFAULT_MSG_LOSE,
    msgDraw: str(r.msgDraw, 900) || DEFAULT_MSG_DRAW,
    button: str(r.button, 60) || DEFAULT_BUTTON,
    badWords: str(r.badWords, 3000),
    bad: parseBadWords(r.badWords),
  };
}

let cfgCache = { at: 0, v: null };
export async function loadCfg(db, force = false) {
  if (!force && cfgCache.v && Date.now() - cfgCache.at < 45000) return cfgCache.v;
  const raw = await db('GET', 'config/blitz').catch(() => null);
  const v = cleanCfg(raw);
  cfgCache = { at: Date.now(), v };
  return v;
}
export const dropCfgCache = () => { cfgCache = { at: 0, v: null }; };

/* ------------------------------ vaqt ------------------------------ */

/** Toshkent sanasi (YYYY-MM-DD) bo'yicha haftaning dushanbasi — haftalik reyting kaliti */
export const weekKeyOf = day => {
  const [y, m, d] = String(day).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};

/* ------------------------------ baza (ETag bilan) ------------------------------ */

const DBU = () => String(process.env.FIREBASE_DB_URL || process.env.VITE_FIREBASE_DB_URL || '').replace(/\/$/, '');
const AUTH = () => encodeURIComponent(process.env.FIREBASE_DB_SECRET || '');
const urlOf = (p, q = '') => `${DBU()}/${p}.json?auth=${AUTH()}${q}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** makeDb() bilan bir xil imzo, lekin VITE_FIREBASE_DB_URL ni ham qabul qiladi (bq.mjs shunday ishlaydi) */
export function blitzDb() {
  const base = DBU();
  if (!base || !process.env.FIREBASE_DB_SECRET) return null;
  return async (method, path, data) => {
    const res = await fetch(urlOf(path), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB xatosi ${res.status}`);
    return res.json();
  };
}

export async function eGet(p) {
  const r = await fetch(urlOf(p), { headers: { 'X-Firebase-ETag': 'true' } });
  if (!r.ok) throw new Error(`DB ${r.status}`);
  return { val: await r.json(), etag: r.headers.get('etag') || 'null_etag' };
}
/** Yozuv o'zgarmagan bo'lsagina yozadi (poyga bo'lsa false). etag='null_etag' — «hali yo'q bo'lsa yarat» */
export async function ePut(p, data, etag) {
  const r = await fetch(urlOf(p), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag || 'null_etag' }, body: JSON.stringify(data) });
  if (r.status === 412) return false;
  if (!r.ok) throw new Error(`DB ${r.status}`);
  return true;
}
/** Faqat yangi yaratadi: allaqachon bor bo'lsa false */
export const putNew = (p, data) => ePut(p, data, 'null_etag');

/**
 * O'qi → o'zgartir → ETag bilan yoz (poyga bo'lsa qayta urinadi). fn(old) yangi qiymatni qaytaradi yoki `undefined` (yozmaslik uchun).
 * Qaytaradi: oxirgi yozilgan (yoki o'zgarmagan) qiymat.
 */
export async function update(p, fn) {
  for (let i = 0; i < 6; i++) {
    const { val, etag } = await eGet(p);
    const next = fn(val);
    if (next === undefined) return val;
    if (await ePut(p, next, etag)) return next;
    await sleep(30 + Math.random() * 90);
  }
  throw new Error('DB band, qayta urinib ko‘ring');
}

/** Ichki hisoblagich (statistika muhim emas — xato bo'lsa e'tiborsiz) */
export async function bump(key, by = 1) {
  try {
    await fetch(urlOf(`bstats/${tashkentDay()}/${key}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ '.sv': { increment: by } }) });
  } catch { /* ignore */ }
}

/* ------------------------------ ball hisoblash ------------------------------ */

/** Ball formulasi mijozdagi bilan bir xil (friendDuel.ts: pointsFor) */
export const points = (remaining, combo) => Math.round((50 + Math.max(0, remaining) * 10) * combo);

/** a g'alaba qilsa > 0, b g'alaba qilsa < 0, durang bo'lsa 0 (mijozdagi compareResults bilan bir xil) */
export function compareRes(a, b) {
  if (a.s !== b.s) return a.s - b.s;
  if (a.c !== b.c) return a.c - b.c;
  if (a.t !== b.t) return b.t - a.t;
  return 0;
}

/** Savollar ro'yxatini tekshiradi va tozalaydi (15 ta; har birida 2–4 variant va to'g'ri javob variantlar orasida bo'lishi shart) */
export function cleanQuestions(list) {
  const arr = Array.isArray(list) ? list : list && typeof list === 'object' ? Object.values(list) : null;
  if (!arr || arr.length !== Q) return null;
  const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);
  const out = [];
  for (const x of arr) {
    const oRaw = x && (Array.isArray(x.o) ? x.o : x.o && typeof x.o === 'object' ? Object.values(x.o) : null);
    if (!oRaw || oRaw.length < 2 || oRaw.length > 4) return null;
    const o = oRaw.map(s => clean(s, 60));
    const u = clean(x.u, 60);
    if (!u || !o.includes(u)) return null;
    out.push({ e: clean(x.e, 40), p: clean(x.p, 40), u, o });
  }
  return out;
}

/**
 * Javoblardan natijani QAYTA hisoblaydi. entries: [{ a: tanlangan variant | null (vaqt tugadi), m: ms }] (0..15 ta; yetmaganlari — vaqt tugadi deb olinadi).
 * Eski mijoz `a` o'rniga `c` (1/0) yuboradi — shuni ham qabul qiladi.
 * opts.rejectFast — to'g'ri javob 0.4 soniyadan tez bo'lsa butun natija rad etiladi (null), aks holda 0.4 soniyaga tenglashtiriladi.
 * Qaytaradi: { s, c, t, log: [{c, m}], answered, sumM } yoki null.
 */
export function scoreLog(qs, entries, opts = {}) {
  const list = Array.isArray(entries) ? entries.slice(0, Q) : [];
  let s = 0, c = 0, t = 0, combo = 1, sumM = 0;
  const log = [];
  for (let i = 0; i < Q; i++) {
    const x = list[i];
    if (!x || typeof x !== 'object') {
      log.push({ c: 0, m: SEC * 1000 });
      t += SEC * 1000;
      combo = 1;
      continue;
    }
    let m = Math.round(Number(x.m));
    if (!Number.isFinite(m)) return null;
    m = Math.max(0, Math.min(SEC * 1000, m));
    let ok;
    if (typeof x.a === 'string') ok = x.a === qs[i].u;
    else if (x.a === null) ok = false;
    else ok = x.c === 1 || x.c === true;
    if (x.a === null) m = SEC * 1000;
    if (ok && m < MIN_CORRECT_MS) {
      if (opts.rejectFast) return null;
      m = MIN_CORRECT_MS;
    }
    sumM += m;
    if (ok) {
      s += points(SEC - m / 1000, combo);
      c++;
      combo = Math.min(COMBO_MAX, Math.round((combo + 0.3) * 10) / 10);
    } else combo = 1;
    t += m;
    log.push({ c: ok ? 1 : 0, m });
  }
  return { s, c, t, log, answered: Math.min(list.length, Q), sumM };
}

/** O'yin boshlanganidan beri o'tgan (server) vaqt javoblar yig'indisiga mos keladimi? (haqiqiy o'yinda har doim mos keladi) */
export const timeLooksReal = (elapsedMs, sumM, answered) => answered === 0 || elapsedMs >= sumM + TIME_SLACK_MS;

/* ------------------------------ mukofot, kunlik limit, haftalik reyting ------------------------------ */

const fbKey = s => String(s).replace(/[.#$\[\]\/]/g, '_').slice(0, 64);

/** Bugungi holat: nechta mukofotli o'yin ishlatilgan (ilovada «2/5» ko'rsatish uchun) */
export async function dailyInfo(db, cfg, uid) {
  const rec = (await db('GET', `bdaily/${tashkentDay()}/${uid}`).catch(() => null)) || {};
  return { used: Number(rec.n) || 0, limit: cfg.limit, xp: cfg.xp, rewards: cfg.rewards };
}

async function flagGrant(db, uid) {
  try {
    if (await db('GET', `leaderboard/${uid}/ts`)) await db('PATCH', `leaderboard/${uid}`, { hasGrant: true });
  } catch { /* bayroq muhim emas: ilova birinchi ochilishda baribir tekshiradi */ }
}

/**
 * Tugagan o'yin uchun BITTA o'yinchining hisobini yuritadi.
 *  - bir raqib bilan kuniga bir marta; kuniga cfg.limit ta mukofotli o'yin (g'alaba, mag'lubiyat va durang ham bitta o'rin oladi);
 *  - g'alaba bo'lsa cfg.xp beriladi (sovg'a sifatida — ilova `grants` orqali oladi), haftalik reytingga g'alaba/ball yoziladi.
 * o: { uid, name, avatar, oppId, outcome: 'win'|'lose'|'draw', score }
 * Qaytaradi: { counted, why: ''|'limit'|'same'|'off', used, limit, xp, outcome }
 */
export async function awardGame(db, cfg, o) {
  const day = tashkentDay();
  const oppKey = fbKey(o.oppId);
  let res = { counted: false, why: 'off', used: 0 };
  await update(`bdaily/${day}/${o.uid}`, cur => {
    const c = cur && typeof cur === 'object' ? cur : {};
    const used = Number(c.n) || 0;
    const opps = c.o && typeof c.o === 'object' ? { ...c.o } : {};
    if (!cfg.rewards) { res = { counted: false, why: 'off', used }; return undefined; }
    if (opps[oppKey]) { res = { counted: false, why: 'same', used }; return undefined; }
    if (used >= cfg.limit) { res = { counted: false, why: 'limit', used }; return undefined; }
    opps[oppKey] = 1;
    res = { counted: true, why: '', used: used + 1 };
    return { ...c, n: used + 1, o: opps };
  });
  const xp = res.counted && o.outcome === 'win' ? cfg.xp : 0;
  const out = { ...res, limit: cfg.limit, xp, outcome: o.outcome };
  if (!res.counted) {
    await bump(res.why === 'same' ? 'same' : res.why === 'limit' ? 'limit' : 'unrewarded');
    return out;
  }

  // haftalik reyting
  const wk = weekKeyOf(day);
  try {
    await update(`bweek/${wk}/${o.uid}`, cur => {
      const c = cur && typeof cur === 'object' ? cur : {};
      return {
        n: String(o.name || '').slice(0, 40),
        a: typeof o.avatar === 'string' && o.avatar.length <= 400 ? o.avatar : '',
        w: (Number(c.w) || 0) + (o.outcome === 'win' ? 1 : 0),
        p: (Number(c.p) || 0) + 1,
        s: (Number(c.s) || 0) + Math.max(0, Math.round(Number(o.score) || 0)),
        ts: Date.now(),
      };
    });
  } catch { /* reyting muhim emas — o'yin hisobi saqlandi */ }

  await bump('rewarded');
  if (o.outcome === 'win') await bump('wins');
  if (xp > 0) {
    const gid = 'b' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
    try {
      await db('PUT', `grants/${o.uid}/${gid}`, { type: 'xp', amount: xp, validHours: 0, note: "Global Blitz g'alabasi", ts: Date.now(), keep: true });
      await flagGrant(db, o.uid);
      await bump('xp', xp);
    } catch {
      out.xp = 0; // sovg'a yozilmadi — foydalanuvchiga va'da qilinmaydi
    }
  }
  return out;
}

/* ------------------------------ bot xabari ------------------------------ */

/**
 * Raqib natijasi KEYIN kelganda, birinchi tugatgan o'yinchiga bot orqali natija yuboriladi («Ali sizni yutdi / sizga yutqazdi»).
 * o: { uid, oppName, me: {s}, opp: {s}, outcome (shu o'yinchi nuqtai nazaridan), xp }
 * Qaytaradi: true (yuborildi) | false
 */
export async function notifyResult(db, cfg, o) {
  const token = process.env.BOT_TOKEN;
  if (!cfg.notify || !token || !/^tg_\d{3,15}$/.test(String(o.uid))) return false;
  const tgId = String(o.uid).slice(3);
  try {
    const u = (await db('GET', `tgusers/${tgId}`).catch(() => null)) || {};
    if (u.blocked) return false;
    // kuniga ko'pi bilan MAX_MSG_PER_DAY ta xabar (spamdan va bloklanishdan saqlaydi)
    let allowed = false;
    await update(`bdaily/${tashkentDay()}/${o.uid}/m`, cur => {
      const n = Number(cur) || 0;
      allowed = n < MAX_MSG_PER_DAY;
      return allowed ? n + 1 : undefined;
    });
    if (!allowed) return false;
    const tpl = o.outcome === 'win' ? cfg.msgWin : o.outcome === 'lose' ? cfg.msgLose : cfg.msgDraw;
    const reward = o.xp > 0 ? `\n💎 G‘alaba mukofoti: +${o.xp} XP (ilovani ochganingizda qo‘shiladi)` : '';
    const text = fillTpl(tpl, {
      name: u.name || '',
      opp: escHtml(o.oppName || 'Raqib'),
      me: o.me.s,
      them: o.opp.s,
      xp: o.xp || 0,
      reward,
    });
    const markup = openAppMarkup(cfg.button, 'success');
    try {
      await sendMessage(token, Number(tgId), text, markup, 'HTML');
    } catch (e) {
      // Admin yozgan HTML noto'g'ri bo'lsa — teglarsiz yuboramiz
      if (/parse entities|can't find end|unsupported start tag/i.test(String(e?.message))) {
        await sendMessage(token, Number(tgId), text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'), markup, null);
      } else throw e;
    }
    await bump('notified');
    return true;
  } catch (e) {
    if (e?.code === 403 || /blocked|deactivated|chat not found/i.test(String(e?.message))) {
      await db('PATCH', `tgusers/${tgId}`, { blocked: true, blockedAt: Date.now() }).catch(() => {});
    }
    return false;
  }
}

/* ------------------------------ eski ma'lumotlarni tozalash ------------------------------ */

async function queryOld(path, orderBy, endAt, limit) {
  const q = `&orderBy=${encodeURIComponent(JSON.stringify(orderBy))}&endAt=${Math.round(endAt)}&limitToFirst=${limit}`;
  const r = await fetch(urlOf(path, q));
  if (!r.ok) throw new Error(`DB ${r.status}`);
  const v = await r.json();
  return v && typeof v === 'object' ? Object.keys(v) : [];
}
async function shallowKeys(path) {
  const r = await fetch(urlOf(path, '&shallow=true'));
  if (!r.ok) throw new Error(`DB ${r.status}`);
  const v = await r.json();
  return v && typeof v === 'object' ? Object.keys(v) : [];
}

/**
 * Eskirgan Global Blitz ma'lumotlarini o'chiradi (remind funksiyasi har soat chaqiradi, har safar cheklangan miqdorda):
 *  - serverdagi jonli xonalar (24 soatdan eski) va do'st duel xonalari (21 kundan eski);
 *  - 14 kundan eski saqlangan natijalar, 1 kundan eski berilgan «ruh» yozuvlari, navbatdagi o'lik yozuvlar;
 *  - 3 kundan eski kunlik hisoblar, 60 kundan eski statistika, 8 haftadan eski haftalik reytinglar.
 * Qaytaradi: { rooms, friendRooms, ghosts, plays, queue, daily, stats, weeks, errors? }
 */
export async function cleanupBlitz(db, { budgetMs = 20000 } = {}) {
  const t0 = Date.now();
  const left = () => Date.now() - t0 < budgetMs;
  const now = Date.now();
  const out = { rooms: 0, friendRooms: 0, ghosts: 0, plays: 0, queue: 0, daily: 0, stats: 0, weeks: 0 };
  const errors = [];
  const step = async (name, fn) => {
    if (!left()) return;
    try { await fn(); } catch (e) { errors.push(`${name}: ${String(e?.message || e)}`); }
  };

  await step('rooms', async () => {
    for (const code of await queryOld('bglobal', 'ts', now - 24 * 3600000, 40)) {
      if (!left()) break;
      await db('DELETE', `bduels/${code}`);
      await db('DELETE', `bglobal/${code}`);
      out.rooms++;
    }
  });
  await step('friendRooms', async () => {
    for (const code of await queryOld('bduels', 'meta/createdAt', now - 21 * 24 * 3600000, 40)) {
      if (!left()) break;
      await db('DELETE', `bduels/${code}`);
      await db('DELETE', `bglobal/${code}`);
      out.friendRooms++;
    }
  });
  await step('ghosts', async () => {
    for (const lvl of LEVELS) {
      for (const id of await queryOld(`bghost/${lvl}`, 'ts', now - 14 * 24 * 3600000, 40)) {
        if (!left()) return;
        await db('DELETE', `bghost/${lvl}/${id}`);
        out.ghosts++;
      }
    }
  });
  await step('plays', async () => {
    for (const id of await queryOld('bplay', 'issued', now - 24 * 3600000, 40)) {
      if (!left()) break;
      await db('DELETE', `bplay/${id}`);
      out.plays++;
    }
  });
  await step('queue', async () => {
    for (const lvl of LEVELS) {
      const v = (await db('GET', `bq/${lvl}`)) || {};
      for (const [id, e] of Object.entries(v)) {
        if (!left()) return;
        const hb = Number(e?.hb) || Number(e?.ts) || 0;
        if (now - hb > 10 * 60000) { await db('DELETE', `bq/${lvl}/${id}`); out.queue++; }
      }
    }
  });
  const dayAgo = n => new Date(now + 5 * 3600000 - n * 86400000).toISOString().slice(0, 10);
  await step('daily', async () => {
    const cut = dayAgo(3);
    for (const k of await shallowKeys('bdaily')) if (k < cut && left()) { await db('DELETE', `bdaily/${k}`); out.daily++; }
  });
  await step('stats', async () => {
    const cut = dayAgo(60);
    for (const k of await shallowKeys('bstats')) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k < cut && left()) { await db('DELETE', `bstats/${k}`); out.stats++; }
  });
  await step('weeks', async () => {
    const cut = weekKeyOf(dayAgo(56));
    for (const k of await shallowKeys('bweek')) if (k < cut && left()) { await db('DELETE', `bweek/${k}`); out.weeks++; }
  });
  return errors.length ? { ...out, errors } : out;
}
