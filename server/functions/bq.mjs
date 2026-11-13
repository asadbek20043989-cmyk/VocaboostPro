// «Global Blitz»: tasodifiy raqib topish (navbat), saqlangan natijalar («ruh» raqib), natijani server tekshiruvi va mukofot.
//
// POST /api/fn/bq   { op, uid, level, name, avatar, recent: [uid...], noGhost, ... }
//   op = 'join'      navbatga turadi va (o'zidan oldin kutayotgan bo'lsa) raqibni band qiladi. first:true — kunlik holat (info) ham qaytadi.
//                    prefer:<uid> — «ochiq lobbi»: foydalanuvchi bildirishnoma/kartochkadagi aniq kutuvchini bosgan; shu kutuvchi (daraja ±1 ichida bo'lsa) birinchi tanlanadi
//   op = 'ghost'     jonli raqib topilmadi: navbatdan chiqadi va saqlangan natija beradi (u serverda «bplay» ga yozib qo'yiladi)
//   op = 'leave'     «Bekor qilish»
//   op = 'saveghost' «ruh» raqib bilan yoki mashq o'yini tugadi:
//                      vs:<ruh id> bo'lsa — javoblar serverdagi savollarga qarab qayta hisoblanadi, g'alaba/mag'lubiyat aniqlanadi, mukofot beriladi;
//                      vs bo'lmasa (mashq) — natija faqat keyingi o'yinchilar uchun saqlanadi (mukofotsiz)
//   op = 'submit'    JONLI duel natijasi: {code, n, r:[{a, m}]}. Ball savollar va javoblardan serverda hisoblanadi va `bduels/<kod>/res` ga
//                    faqat server yozadi. Ikkala natija kelganda g'olib aniqlanadi, mukofot beriladi, birinchi tugatganga bot xabari yuboriladi
//
// Bazada:
//   bq/<daraja>/<uid>      { ts, hb, name, avatar, room? }   navbat yozuvi (room — raqib topilganda xona kodi)
//   bghost/<daraja>/<uid>  { ts, name, avatar, q, r, s, c, t }  har bir o'yinchining oxirgi natijasi (bittadan)
//   bplay/<uid>            berilgan «ruh» raqib (javoblar shunga qarab tekshiriladi)
//   bglobal/<kod>          server ochgan jonli xona (kim o'ynaydi, hisob-kitob qulfi)
//   bduels/<kod>/...       jonli o'yin xonasi — «Do'st bilan Blitz Duel» bilan bir xil format (+ settle/r<N> — natija va mukofot)
//   bdaily, bweek, bstats  kunlik limit, haftalik reyting, ichki hisoblagichlar (server/lib/blitz.mjs ga qarang)
//
// Navbat poygasi: raqibni band qilish Firebase ETag («if-match») bilan qilinadi — ikki kishi bir vaqtda
// bitta kutayotganni olsa, faqat bittasi o'tadi. Ikki kutayotgan bir-birini bir vaqtda olmasligi uchun
// faqat «o'zidan oldin kelgan»ni olish mumkin (ts, so'ng uid bo'yicha), va olishdan oldin o'z yozuvi qulflanadi.
import { json, parseBody, verifyInitData } from '../lib/tg.mjs';
import { safeName } from '../lib/names.mjs';
import {
  Q, SETTLE_WINDOW_MS, NOTIFY_AFTER_MS, isCode, blitzDb, loadCfg, dailyInfo, awardGame, notifyResult, scoreLog, cleanQuestions, timeLooksReal, compareRes,
  eGet, ePut as ePutLock, putNew, bump,
} from '../lib/blitz.mjs';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const ID_RE = /^[A-Za-z0-9_\-:.@+]{3,64}$/;
const FRESH_MS = 25000; // navbat yozuvi shuncha vaqt «tirik» hisoblanadi (kutayotgan mijoz har ~3.5 soniyada yangilaydi, kutish ~60 soniya)
// Eslatma: ilova (globalBlitz.ts, peekWaiters) `bq` ni hamma o'qiydigan tugun sifatida o'qib, kutuvchilarni ko'rsatadi.
// Kutuvchi yozuvi: { ts, hb, name, avatar } (room yo'q = bo'sh). Botga hech qanday xabar yuborilmaydi.
const LOCK_MS = 8000; // qulf shundan eskirsa — e'tiborga olinmaydi
const CLAIMED_KEEP_MS = 120000; // raqib topilgan yozuv shuncha vaqtdan keyin tozalanadi
const GHOST_MAX_AGE = 14 * 24 * 3600 * 1000;
const GHOST_POOL = 30;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

const DB = () => String(process.env.FIREBASE_DB_URL || process.env.VITE_FIREBASE_DB_URL || '').replace(/\/$/, '');
const url = p => `${DB()}/${p}.json?auth=${encodeURIComponent(process.env.FIREBASE_DB_SECRET || '')}`;

async function dbGet(p) {
  const r = await fetch(url(p), { headers: { 'X-Firebase-ETag': 'true' } });
  if (!r.ok) throw new Error(`DB ${r.status}`);
  return { val: await r.json(), etag: r.headers.get('etag') || '' };
}
async function dbPut(p, data) {
  const r = await fetch(url(p), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error(`DB ${r.status}`);
}
async function dbDel(p) {
  await fetch(url(p), { method: 'DELETE' }).catch(() => {});
}
/** Shartli yozish/o'chirish: yozuv o'zgarmagan bo'lsa true, birov o'zgartirib ulgurgan bo'lsa false */
async function putIf(p, data, etag) {
  const r = await fetch(url(p), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify(data) });
  if (r.status === 412) return false;
  if (!r.ok) throw new Error(`DB ${r.status}`);
  return true;
}
async function delIf(p, etag) {
  const r = await fetch(url(p), { method: 'DELETE', headers: { 'if-match': etag } });
  if (r.status === 412) return false;
  if (!r.ok) throw new Error(`DB ${r.status}`);
  return true;
}
const stat = key => bump(key);

const rmStrict = async path => { try { await dbDel(path); } catch { /* ignore */ } };
const lvlNear = level => {
  const i = LEVELS.indexOf(level);
  return [level, LEVELS[i - 1], LEVELS[i + 1]].filter(Boolean);
};
const before = (a, b) => a.ts < b.ts || (a.ts === b.ts && a.id < b.id); // a, b dan oldin kelganmi

const isAlive = (e, now) => e && typeof e === 'object' && now - (Number(e.hb) || Number(e.ts) || 0) < FRESH_MS;
const isLocked = (e, now) => e.room === 'lock' && now - (Number(e.lockTs) || 0) < LOCK_MS;
const isClaimed = e => !!e.room && e.room !== 'lock';
const isFree = (e, now) => isAlive(e, now) && !isClaimed(e) && !isLocked(e, now);

/** Tarmoqdagi barcha darajalardan eskirgan yozuvlarni tozalaydi (ko'pi bilan bir nechta, javobni kechiktirmaydi) */
async function sweep(level, entries, now) {
  let n = 0;
  for (const [id, e] of Object.entries(entries || {})) {
    if (n >= 4) break;
    const dead = !isAlive(e, now) && !(isClaimed(e) && now - (Number(e.hb) || 0) < CLAIMED_KEEP_MS);
    if (dead) { n++; await dbDel(`bq/${level}/${id}`); }
  }
}

/* ------------------------------- amallar ------------------------------- */

async function opJoin(me, now) {
  const path = `bq/${me.level}/${me.id}`;

  // 1. O'z yozuvim: allaqachon band qilingan bo'lsa — o'sha xona (ulanish uzilib qayta urinilgan holat)
  let { val: mine, etag } = await dbGet(path);
  if (mine && isClaimed(mine) && now - (Number(mine.hb) || 0) < CLAIMED_KEEP_MS) return { matched: true, code: mine.room, opp: mine.opp || null };

  if (!mine || !isAlive(mine, now) || isClaimed(mine)) {
    mine = { ts: now, hb: now, name: me.name, avatar: me.avatar };
    await dbPut(path, mine);
    ({ etag } = await dbGet(path));
  } else {
    mine = { ...mine, hb: now, name: me.name, avatar: me.avatar };
    if (isLocked(mine, now) === false && mine.room === 'lock') delete mine.room;
    if (!(await putIf(path, mine, etag))) return { matched: false }; // kimdir band qildi — keyingi so'rovda ko'rinadi
    ({ etag } = await dbGet(path));
  }
  const meKey = { ts: Number(mine.ts), id: me.id };

  // 2. Nomzodlar: o'zidan OLDIN kelgan, tirik, bo'sh yozuvlar. Avval o'z darajam, keyin ±1.
  const cands = [];
  for (const lvl of lvlNear(me.level)) {
    const { val } = await dbGet(`bq/${lvl}`);
    if (!val) continue;
    if (lvl === me.level) await sweep(lvl, val, now);
    for (const [id, e] of Object.entries(val)) {
      if (id === me.id || me.recent.includes(id) || !isFree(e, now)) continue;
      const k = { ts: Number(e.ts) || 0, id };
      if (!before(k, meKey)) continue;
      cands.push({ lvl, id, ts: k.ts, same: lvl === me.level ? 0 : 1 });
    }
  }
  // «Ochiq lobbi»: bosilgan kutuvchi (prefer) birinchi, qolganlari avvalgidek (avval o'z darajam, so'ng eng eskisi)
  cands.sort((a, b) => (b.id === me.prefer) - (a.id === me.prefer) || a.same - b.same || a.ts - b.ts);
  if (!cands.length) return { matched: false };

  // 3. O'zimni qulflaymiz (boshqa kishi meni olib ketmasin), so'ng nomzodni ETag bilan band qilamiz
  const locked = { ...mine, room: 'lock', lockTs: now };
  if (!(await putIf(path, locked, etag))) {
    const { val } = await dbGet(path);
    if (val && isClaimed(val)) return { matched: true, code: val.room, opp: val.opp || null };
    return { matched: false };
  }

  for (const c of cands.slice(0, 4)) {
    const cp = `bq/${c.lvl}/${c.id}`;
    const { val: cur, etag: ce } = await dbGet(cp);
    if (!cur || !isFree(cur, Date.now())) continue;
    const opp = { id: c.id, name: safeName(cur.name, me.bad), avatar: String(cur.avatar || '').slice(0, 400) };
    const code = newCode();
    // avval raqib yozuvini band qilamiz (poyga shu yerda hal bo'ladi), keyin xonani ochamiz
    const claimed = { ...cur, room: code, opp: { id: me.id, name: me.name, avatar: me.avatar }, hb: Date.now() };
    if (!(await putIf(cp, claimed, ce))) continue;
    const now2 = Date.now();
    // Server yozuvi: bu xona haqiqatan Global Blitz (kim o'ynaydi). Natijalar faqat shu yozuvga tayanib qabul qilinadi
    await dbPut(`bglobal/${code}`, { ts: now2, a: c.id, an: opp.name, aa: opp.avatar, b: me.id, bn: me.name, ba: me.avatar });
    await dbPut(`bduels/${code}/meta`, { createdBy: c.id, createdAt: now2, global: true });
    await dbPut(`bduels/${code}/players/${c.id}`, { name: opp.name, avatar: opp.avatar, joinedAt: now2 });
    await dbPut(`bduels/${code}/players/${me.id}`, { name: me.name, avatar: me.avatar, joinedAt: now2 + 1 });
    await dbPut(path, { ...mine, room: code, opp, hb: now2 });
    await stat('live');
    return { matched: true, code, opp };
  }

  // hech kim olinmadi: qulfni yechamiz va kutishda davom etamiz
  await dbPut(path, { ...mine, hb: Date.now() });
  return { matched: false };
}

function pickGhosts(list) {
  const rows = list.sort((a, b) => b.ts - a.ts).slice(0, GHOST_POOL);
  for (let i = rows.length - 1; i > 0; i--) { // aralashtiramiz — buzuq yozuv chiqsa keyingisi olinadi
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

async function opGhost(me, now, ctx) {
  const path = `bq/${me.level}/${me.id}`;
  // Navbatdan chiqamiz. Shu orada kimdir bizni olib ulgurgan bo'lsa — jonli o'yin bor
  for (let i = 0; i < 2; i++) {
    const { val, etag } = await dbGet(path);
    if (!val) break;
    if (isClaimed(val)) return { matched: true, code: val.room, opp: val.opp || null };
    if (await delIf(path, etag)) break;
  }
  await rmStrict(`bplay/${me.id}`); // oldin berilgan «ruh» eskirdi

  for (const lvl of lvlNear(me.level)) {
    const { val } = await dbGet(`bghost/${lvl}`);
    const rows = Object.entries(val || {})
      .filter(([id, g]) => id !== me.id && !me.recent.includes(id) && g && Array.isArray(g.q) && Array.isArray(g.r) && now - (Number(g.ts) || 0) < GHOST_MAX_AGE)
      .map(([id, g]) => ({ id, ...g }));
    for (const g of pickGhosts(rows)) {
      const qs = cleanQuestions(g.q);
      if (!qs || g.r.length !== Q) continue;
      const ghost = {
        id: g.id, name: safeName(g.name, me.bad), avatar: String(g.avatar || '').slice(0, 400), level: lvl, ts: g.ts,
        q: qs, r: g.r.map(x => ({ c: x && x.c ? 1 : 0, m: Math.max(0, Math.min(5000, Math.round(Number(x?.m)) || 0)) })), s: Number(g.s) || 0, c: Number(g.c) || 0, t: Number(g.t) || 0,
      };
      // Server «ruh» ni eslab qoladi: o'yin tugagach javoblar SHU savollarga qarab tekshiriladi (mijoz yuborgan savollarga ishonilmaydi)
      await dbPut(`bplay/${me.id}`, { gid: ghost.id, ts: Number(ghost.ts) || 0, lvl, name: ghost.name, avatar: ghost.avatar, q: ghost.q, r: ghost.r, s: ghost.s, c: ghost.c, t: ghost.t, issued: now });
      await stat('ghost');
      return { matched: false, ghost, info: await dailyInfo(ctx.db, ctx.cfg, me.id) };
    }
  }
  await stat('none');
  return { matched: false, ghost: null, info: await dailyInfo(ctx.db, ctx.cfg, me.id) };
}

async function opLeave(me) {
  const path = `bq/${me.level}/${me.id}`;
  const { val, etag } = await dbGet(path);
  if (!val) return { ok: true };
  if (isClaimed(val)) return { matched: true, code: val.room, opp: val.opp || null };
  await delIf(path, etag);
  return { ok: true };
}

/* --------------------- natijalarni saqlash va tekshirish --------------------- */

/** O'yinchining natijasini keyingi o'yinchilar uchun «ruh» sifatida saqlaydi (har bir o'yinchidan bittadan) */
async function storeGhost(me, qs, sc, now) {
  // boshqa darajadagi eski yozuv qolib ketmasin
  for (const l of LEVELS) if (l !== me.level) await dbDel(`bghost/${l}/${me.id}`);
  await dbPut(`bghost/${me.level}/${me.id}`, { ts: now, name: me.name, avatar: me.avatar, q: qs, r: sc.log, s: sc.s, c: sc.c, t: sc.t });
  await stat('saved');
}

const publicSettle = (aw, cfg) => (aw
  ? { xp: aw.xp || 0, why: aw.why || '', used: aw.used || 0, limit: aw.limit ?? cfg.limit, counted: !!aw.counted }
  : { xp: 0, why: 'error', used: 0, limit: cfg.limit, counted: false });

/** «Ruh» raqib bilan o'ynalgan o'yin: javoblar serverda saqlangan savollar bo'yicha qayta hisoblanadi, mukofot beriladi */
async function playedGhost(me, body, now, ctx, vs, share) {
  const path = `bplay/${me.id}`;
  const { val: play, etag } = await eGet(path);
  if (!play || play.gid !== vs || !Array.isArray(play.q)) return { ok: false, error: 'O‘yin muddati o‘tgan. Qayta urinib ko‘ring' };
  const sc = scoreLog(play.q, Array.isArray(body.r) ? body.r : []);
  if (!sc) return { ok: false, error: 'Natija noto‘g‘ri' };
  if (!timeLooksReal(now - (Number(play.issued) || 0), sc.sumM, sc.answered)) return { ok: false, error: 'Natija noto‘g‘ri' };
  if (!(await delIf(path, etag))) return { ok: false, error: 'Natija allaqachon yuborilgan' };

  const opp = { s: Number(play.s) || 0, c: Number(play.c) || 0, t: Number(play.t) || 0 };
  const d = compareRes(sc, opp);
  const outcome = d > 0 ? 'win' : d < 0 ? 'lose' : 'draw';
  let aw = null;
  try {
    aw = await awardGame(ctx.db, ctx.cfg, { uid: me.id, name: me.name, avatar: me.avatar, oppId: play.gid, outcome, score: sc.s });
  } catch { /* mukofot berilmadi — o'yin natijasi baribir ko'rsatiladi */ }

  let saved = false;
  if (share && sc.answered === Q) { await storeGhost(me, play.q, sc, now); saved = true; }
  else if (!share) await dbDel(`bghost/${me.level}/${me.id}`);
  return { ok: true, saved, s: sc.s, c: sc.c, t: sc.t, settle: { ...publicSettle(aw, ctx.cfg), outcome } };
}

async function opSave(me, body, now, ctx) {
  const share = !body.noGhost;
  const vs = typeof body.vs === 'string' ? body.vs.slice(0, 64) : '';
  if (vs) return playedGhost(me, body, now, ctx, vs, share);

  // Mashq (hech kim o'ynamagan): natija faqat keyingi o'yinchiga raqib bo'lish uchun saqlanadi, mukofot yo'q
  if (!share) {
    await dbDel(`bghost/${me.level}/${me.id}`);
    return { ok: true, saved: false };
  }
  const qs = cleanQuestions(body.q);
  const r = Array.isArray(body.r) ? body.r : null;
  if (!qs || !r || r.length !== Q) return { ok: false, error: 'Natija noto‘g‘ri' };
  // 0.4 soniyadan tez «to'g'ri» javob — shubhali: bunday natija ruh sifatida saqlanmaydi
  const sc = scoreLog(qs, r, { rejectFast: true });
  if (!sc) return { ok: false, error: 'Natija noto‘g‘ri' };
  await storeGhost(me, qs, sc, now);
  return { ok: true, saved: true, s: sc.s, c: sc.c, t: sc.t };
}

/* ---------------------------- jonli duel natijasi ---------------------------- */

/** Mijozdagi parseRoom bilan bir xil tanlov: raundning g'olib nomzodi (eng kichik ts, so'ng muallif id si) */
function roundCandidate(room, n) {
  const cands = room?.rounds?.[`r${n}`];
  if (!cands || typeof cands !== 'object') return null;
  const list = Object.entries(cands)
    .filter(([, c]) => c && typeof c === 'object' && c.q && Object.keys(c.q).length > 0)
    .map(([k, c]) => ({ k, ts: Number(c.ts) || 0, q: c.q }))
    .sort((a, b) => a.ts - b.ts || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  return list[0] || null;
}

async function opSubmit(me, body, now, ctx) {
  const { db, cfg } = ctx;
  const code = String(body.code || '').toUpperCase();
  const n = Math.round(Number(body.n));
  if (!isCode(code) || !Number.isFinite(n) || n < 1 || n > 20) return { ok: false, error: 'So‘rov noto‘g‘ri', status: 400 };

  const g = await db('GET', `bglobal/${code}`);
  if (!g || (g.a !== me.id && g.b !== me.id)) return { ok: false, error: 'Bu Global Blitz xonasi emas', status: 403 };
  const iAmA = g.a === me.id;
  const oppId = iAmA ? g.b : g.a;
  const myName = (iAmA ? g.an : g.bn) || me.name;
  const myAvatar = (iAmA ? g.aa : g.ba) || me.avatar;
  const oppName = (iAmA ? g.bn : g.an) || 'Raqib';
  const oppAvatar = (iAmA ? g.ba : g.aa) || '';

  const room = await db('GET', `bduels/${code}`);
  const cand = roundCandidate(room, n);
  if (!cand) return { ok: false, error: 'Savollar topilmadi', status: 404 };
  const qs = cleanQuestions(cand.q);
  if (!qs) return { ok: false, error: 'Savollar noto‘g‘ri', status: 400 };

  const resPath = `bduels/${code}/res/r${n}`;
  let mine = room?.res?.[`r${n}`]?.[me.id];
  if (!(mine && mine.k === cand.k)) {
    const sc = scoreLog(qs, Array.isArray(body.r) ? body.r : []);
    if (!sc) return { ok: false, error: 'Natija noto‘g‘ri', status: 400 };
    // Haqiqiy o'yinda xona ochilgandan beri o'tgan vaqt javob vaqtlari yig'indisidan doim katta. Tez «natija» soxta
    if (!timeLooksReal(now - (Number(g.ts) || 0), sc.sumM, sc.answered)) return { ok: false, error: 'Natija noto‘g‘ri', status: 400 };
    mine = { k: cand.k, s: sc.s, c: sc.c, t: sc.t, ts: now, v: 1 };
    if (await putNew(`${resPath}/${me.id}`, mine)) {
      // To'liq o'ynalgan bo'lsa — keyingi o'yinchilar uchun «ruh» sifatida ham saqlanadi (mijoz alohida yubormaydi)
      if (body.noGhost) await dbDel(`bghost/${me.level}/${me.id}`);
      else if (sc.answered === Q) await storeGhost({ ...me, name: myName, avatar: myAvatar }, qs, sc, now);
    } else {
      const cur = await db('GET', `${resPath}/${me.id}`);
      if (!(cur && cur.k === cand.k)) return { ok: false, error: 'Natija yozilmadi', status: 409 };
      mine = cur; // ikki marta yuborilgan (qayta urinish) — birinchisi qoladi
    }
  }
  const base = { ok: true, s: Number(mine.s) || 0, c: Number(mine.c) || 0, t: Number(mine.t) || 0 };

  const opp = await db('GET', `${resPath}/${oppId}`);
  if (!(opp && opp.k === cand.k)) return { ...base, settled: false }; // raqib hali tugatmadi

  // ---- ikkala natija bor: g'olib aniqlanadi (bir marta — qulf bilan) ----
  const lockPath = `bglobal/${code}/set/r${n}`;
  if (!(await putNew(lockPath, { ts: now }))) {
    // boshqasi hisoblayapti. U yarim yo'lda to'xtab qolgan bo'lsa (1 daqiqadan oshdi, natija yozilmagan) — o'zimiz davom ettiramiz
    const [{ val: lk, etag }, st] = await Promise.all([eGet(lockPath), db('GET', `bduels/${code}/settle/r${n}`)]);
    const stuck = !st && lk && now - (Number(lk.ts) || 0) > 60000;
    if (!stuck || !(await ePutLock(lockPath, { ts: now }, etag))) return { ...base, settled: true };
  }

  const A = { s: base.s, c: base.c, t: base.t };
  const B = { s: Number(opp.s) || 0, c: Number(opp.c) || 0, t: Number(opp.t) || 0 };
  const gap = Math.abs((Number(mine.ts) || 0) - (Number(opp.ts) || 0));
  const settlePath = `bduels/${code}/settle/r${n}`;
  if (gap > SETTLE_WINDOW_MS) {
    await db('PUT', settlePath, { w: '', late: 1, at: now }); // juda kech keldi — mukofotsiz, xabarsiz
    return { ...base, settled: true, late: true };
  }

  const d = compareRes(A, B);
  const oMe = d > 0 ? 'win' : d < 0 ? 'lose' : 'draw';
  const oOpp = d > 0 ? 'lose' : d < 0 ? 'win' : 'draw';
  let awMe = null, awOpp = null;
  try { awMe = await awardGame(db, cfg, { uid: me.id, name: myName, avatar: myAvatar, oppId, outcome: oMe, score: A.s }); } catch { /* ignore */ }
  try { awOpp = await awardGame(db, cfg, { uid: oppId, name: oppName, avatar: oppAvatar, oppId: me.id, outcome: oOpp, score: B.s }); } catch { /* ignore */ }

  const pubMe = publicSettle(awMe, cfg);
  const pubOpp = publicSettle(awOpp, cfg);
  await db('PUT', settlePath, { w: d > 0 ? me.id : d < 0 ? oppId : '', at: now, r: { [me.id]: pubMe, [oppId]: pubOpp } });
  await bump('settled');

  // Birinchi tugatgan o'yinchi xonada kutib o'tirmagan bo'lsa (raqib 30 soniyadan keyin tugatdi) — natija botga yuboriladi
  if (gap >= NOTIFY_AFTER_MS) {
    try {
      if ((Number(opp.ts) || 0) < (Number(mine.ts) || 0)) await notifyResult(db, cfg, { uid: oppId, oppName: myName, me: B, opp: A, outcome: oOpp, xp: pubOpp.xp });
      else await notifyResult(db, cfg, { uid: me.id, oppName, me: A, opp: B, outcome: oMe, xp: pubMe.xp });
    } catch { /* xabar muhim emas */ }
  }
  return { ...base, settled: true, settle: { ...pubMe, outcome: oMe } };
}


/* ------------------------------- kirish ------------------------------- */

export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST kerak' });
  const db = blitzDb();
  if (!db) return json(503, { error: 'Baza sozlanmagan' });
  const body = parseBody(event);
  if (!body) return json(400, { error: "Noto'g'ri so'rov" });

  const uid = String(body.uid || '');
  const level = String(body.level || '');
  if (!ID_RE.test(uid)) return json(400, { error: 'Hisob ID xato' });
  if (!LEVELS.includes(level)) return json(400, { error: 'Daraja xato' });

  if (uid.startsWith('tg_') && process.env.BOT_TOKEN) {
    const initData = event.headers?.['x-telegram-init-data'] || body.initData;
    const u = verifyInitData(initData, process.env.BOT_TOKEN);
    if (!u || `tg_${u.id}` !== uid) return json(401, { error: 'Telegram imzosi tasdiqlanmadi' });
  }

  try {
    const cfg = await loadCfg(db);
    const avatar = typeof body.avatar === 'string' && body.avatar.length <= 400 ? body.avatar : '';
    const me = {
      id: uid,
      level,
      name: safeName(body.name, cfg.bad), // haqoratli/reklama ismlar «O'yinchi» ga almashtiriladi
      bad: cfg.bad,
      avatar,
      prefer: typeof body.prefer === 'string' && ID_RE.test(body.prefer) ? body.prefer : '',
      recent: Array.isArray(body.recent) ? body.recent.filter(x => typeof x === 'string' && ID_RE.test(x)).slice(0, 5) : [],
    };
    const now = Date.now();
    const ctx = { db, cfg };

    switch (body.op) {
      case 'join': {
        const r = await opJoin(me, now);
        if (body.first && !r.matched) r.info = await dailyInfo(db, cfg, uid);
        return json(200, r);
      }
      case 'ghost': return json(200, await opGhost(me, now, ctx));
      case 'leave': return json(200, await opLeave(me));
      case 'saveghost': {
        const r = await opSave(me, body, now, ctx);
        return json(r.ok ? 200 : 400, r);
      }
      case 'submit': {
        const r = await opSubmit(me, body, now, ctx);
        return json(r.status || (r.ok ? 200 : 400), r);
      }
      default: return json(400, { error: 'Amal noma\'lum' });
    }
  } catch (e) {
    return json(502, { error: String(e?.message || e) });
  }
};
