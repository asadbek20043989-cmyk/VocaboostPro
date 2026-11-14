// Umumiy chat (barcha foydalanuvchilar uchun bitta xona). Telegram imzosi tekshiriladi, spamdan himoya qilinadi.
//   POST { action: 'send',   uid, text, initData }  ->  { ok: true, msg }
//   POST { action: 'report', uid, id,   initData }  ->  { ok: true, hidden }
// Xabarlar `chat/general/<id>` ga FAQAT shu funksiya yozadi (mijoz yozolmaydi: database.rules.json + db.mjs). O'qish — to'g'ridan-to'g'ri Firebase SSE.
//
// Himoya qatlamlari:
//   1) Telegram initData imzosi (tg_ hisoblar). BOT_TOKEN bor bo'lsa, tg_ bo'lmagan hisob chatga yoza olmaydi (ID sini birov bilib olib, nomidan yozmasin);
//   2) ism va daraja mijozdan emas, ligadagi yozuvdan olinadi (soxtalashtirib bo'lmaydi);
//   3) mute (chatMute/<uid>), sekin rejim, daqiqada limit, bir xil matnni takrorlashni to'xtatish;
//   4) haqorat / havola / @username / telefon raqam filtri (names.mjs + admin qo'shgan so'zlar);
//   5) shikoyat: 3 ta turli foydalanuvchidan kelsa xabar avtomatik yashiriladi, admin panelda ko'rinadi.
import { json, parseBody, verifyInitData, makeDb } from '../lib/tg.mjs';
import { isBadName, parseBadWords, safeName } from '../lib/names.mjs';

const ID_RE = /^[A-Za-z0-9_\-]{3,64}$/;
const MSG_ID_RE = /^[A-Za-z0-9_\-]{6,40}$/;
const ROOM = 'general';

export const DEFAULT_CHAT_CFG = {
  enabled: true,
  slowSec: 3, // ketma-ket xabarlar orasidagi eng kam vaqt (soniya)
  perMin: 12, // 1 daqiqada eng ko'pi bilan nechta xabar
  minXp: 0, // yozish uchun kerakli minimal XP (spam-botlardan himoya; admin o'zgartiradi)
  maxLen: 300,
  keep: 80, // xonada saqlanadigan oxirgi xabarlar soni
  hideAt: 3, // nechta shikoyatdan keyin xabar yashiriladi
  rules: "Hurmat bilan muloqot qiling. Haqorat, reklama va havolalar taqiqlanadi.",
  badWords: '',
};

const clampInt = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** config/chat dan olingan xom qiymatni xavfsiz ko'rinishga keltiradi (admin.mjs ham shuni ishlatadi) */
export function cleanChatCfg(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_CHAT_CFG;
  return {
    enabled: r.enabled !== false,
    slowSec: clampInt(r.slowSec, 0, 120, d.slowSec),
    perMin: clampInt(r.perMin, 1, 60, d.perMin),
    minXp: clampInt(r.minXp, 0, 1000000, d.minXp),
    maxLen: clampInt(r.maxLen, 20, 1000, d.maxLen),
    keep: clampInt(r.keep, 20, 300, d.keep),
    hideAt: clampInt(r.hideAt, 1, 50, d.hideAt),
    rules: String(r.rules ?? d.rules).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 300),
    badWords: String(r.badWords ?? '').slice(0, 4000),
  };
}

// Xabar matnini tozalash: nazorat va yo'nalishni buzuvchi (RTL) belgilar olib tashlanadi, bo'shliqlar bittaga keltiriladi
export const tidyText = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);

const HANDLE_RE = /@[a-z0-9_]{4,}/i; // @username (kanal / shaxs reklamasi)
const PHONE_RE = /\+?\d[\d\s\-()]{7,}\d/g; // raqamlar ketma-ketligi
// Telefon deb: 9+ raqam bo'lib, (a) 7+ raqamli bitta guruh yoki (b) 2+ raqamli kamida 3 ta guruhdan iborat bo'lsa hisoblaymiz.
// «1 2 3 4 5 6 7 8 9 10» kabi sanash xabarlari o'tib ketadi.
const hasPhone = t =>
  (t.match(PHONE_RE) || []).some(m => {
    const groups = m.split(/\D+/).filter(Boolean);
    const digits = groups.join('').length;
    return digits >= 9 && (groups.some(g => g.length >= 7) || groups.filter(g => g.length >= 2).length >= 3);
  });

/** Matnda haqorat, havola, @username yoki telefon bormi? (extra — parseBadWords() natijasi) */
export function isBadText(text, extra = []) {
  const t = String(text ?? '');
  if (HANDLE_RE.test(t) || hasPhone(t)) return true;
  // «f u c k» kabi ajratib yozilgan harflarni birlashtiramiz (ketma-ket bir harfli so'zlar). «a f u c k» kabi oldidagi harf xalaqit
  // bermasligi uchun birlashgan qatorning 3+ harfli barcha bo'laklari ham tekshiriladi.
  const merged = [];
  let run = '';
  const flush = () => {
    if (!run) return;
    merged.push(run);
    const r = run.slice(0, 14);
    for (let i = 0; i < r.length; i++) for (let j = i + 3; j <= r.length; j++) if (j - i < r.length) merged.push(r.slice(i, j));
    run = '';
  };
  for (const w of t.split(/\s+/).filter(Boolean)) {
    if ([...w].length === 1 && /\p{L}/u.test(w)) run += w;
    else {
      flush();
      merged.push(w);
    }
  }
  flush();
  // So'zlar alohida tekshiriladi: butun matnni yopishtirib tekshirsak, qo'shni so'zlar tasodifan taqiqlangan o'zakni hosil qilishi mumkin
  return merged.slice(0, 300).some(w => isBadName(w, extra));
}

const newId = () => 't' + Date.now().toString(36).padStart(9, '0') + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
const normText = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Eski xabarlarni tozalash (xona kichik qolsin, mijoz tez yuklasin). Faqat kalitlar so'raladi (shallow) — arzon.
async function prune(db, keep) {
  const { FIREBASE_DB_URL, FIREBASE_DB_SECRET } = process.env;
  const base = String(FIREBASE_DB_URL || '').replace(/\/$/, '');
  const r = await fetch(`${base}/chat/${ROOM}.json?auth=${encodeURIComponent(FIREBASE_DB_SECRET)}&shallow=true`);
  if (!r.ok) return;
  const keys = Object.keys((await r.json()) || {}).sort(); // kalitlar vaqt bo'yicha tartiblanadi
  const over = keys.length - keep;
  if (over <= 0) return;
  const del = {};
  keys.slice(0, over).forEach(k => { del[k] = null; });
  await db('PATCH', `chat/${ROOM}`, del);
}

export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST kerak' });
  const db = makeDb();
  if (!db) return json(503, { error: 'Baza sozlanmagan' });
  const body = parseBody(event);
  if (!body) return json(400, { error: "Noto'g'ri so'rov" });

  const uid = String(body.uid || '');
  if (!ID_RE.test(uid)) return json(400, { error: 'Hisob ID xato' });

  // Shaxsni tekshirish: BOT_TOKEN bor bo'lsa, faqat imzosi tasdiqlangan Telegram foydalanuvchisi yoza oladi
  const token = process.env.BOT_TOKEN;
  let tgUser = null;
  if (token) {
    tgUser = verifyInitData(body.initData, token);
    if (!tgUser || `tg_${tgUser.id}` !== uid) {
      return json(401, { error: uid.startsWith('tg_') ? 'Telegram imzosi tasdiqlanmadi. Ilovani qayta oching' : 'Chatga yozish uchun ilovani Telegram orqali oching' });
    }
  }

  try {
    const cfg = cleanChatCfg(await db('GET', 'config/chat'));
    if (!cfg.enabled) return json(403, { error: 'Chat vaqtincha o‘chirilgan' });

    const mute = await db('GET', `chatMute/${uid}`);
    if (mute && Number(mute.until) > Date.now()) {
      const mins = Math.ceil((Number(mute.until) - Date.now()) / 60000);
      return json(403, { error: mins > 60 * 24 * 365 ? 'Siz chatdan chetlatilgansiz' : `Siz chatda vaqtincha cheklangansiz (yana ~${mins} daqiqa)` });
    }

    const lb = await db('GET', `leaderboard/${uid}`);
    if (!lb || lb.deleted) return json(403, { error: 'Avval ilovada biroz mashq qiling, keyin chatga yozasiz' });

    if (body.action === 'report') return await report({ db, uid, cfg, id: String(body.id || '') });

    // ---- Xabar yuborish ----
    const xp = Math.max(0, Math.round((Number(lb.xp) || 0) + (Number(lb.xpOffset) || 0)));
    if (xp < cfg.minXp) return json(403, { error: `Chatga yozish uchun kamida ${cfg.minXp} XP kerak (sizda ${xp}). Mashq qiling!` });

    const text = tidyText(body.text, cfg.maxLen);
    if (!text) return json(400, { error: 'Xabar bo‘sh' });

    const extra = parseBadWords(`${(await db('GET', 'config/blitz/badWords').catch(() => '')) || ''}\n${cfg.badWords}`);
    if (isBadText(text, extra)) return json(400, { error: 'Xabarda nomaqbul so‘z, havola, @username yoki telefon raqam bor' });

    const now = Date.now();
    const lim = (await db('GET', `chatLim/${uid}`)) || {};
    if (now - (Number(lim.ts) || 0) < cfg.slowSec * 1000) return json(429, { error: `Juda tez. ${cfg.slowSec} soniya kuting` });
    const win = now - (Number(lim.ws) || 0) < 60000 ? Number(lim.wn) || 0 : 0;
    if (win >= cfg.perMin) return json(429, { error: 'Daqiqada juda ko‘p xabar yubordingiz. Biroz kuting' });
    const nt = normText(text);
    if (nt && lim.lt === nt && now - (Number(lim.ts) || 0) < 60000) return json(429, { error: 'Bir xil xabarni qayta yuborib bo‘lmaydi' });

    const id = newId();
    const msg = {
      uid,
      name: safeName(lb.name || tgUser?.first_name, extra, "O'quvchi"),
      lv: String(lb.level || '').slice(0, 4),
      text,
      ts: now,
    };
    await db('PUT', `chat/${ROOM}/${id}`, msg);
    await db('PUT', `chatLim/${uid}`, { ts: now, lt: nt.slice(0, 200), ws: win ? Number(lim.ws) : now, wn: win + 1 });

    // Har safar emas, ~5 martadan birida tozalaymiz (arzon va xona baribir chegaradan ozgina oshadi xolos)
    if (Math.random() < 0.2) await prune(db, cfg.keep).catch(() => {});

    return json(200, { ok: true, msg: { id, ...msg } });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

async function report({ db, uid, cfg, id }) {
  if (!MSG_ID_RE.test(id)) return json(400, { error: 'Xabar ID xato' });
  const msg = await db('GET', `chat/${ROOM}/${id}`);
  if (!msg || !msg.text) return json(404, { error: 'Xabar topilmadi (o‘chirilgan bo‘lishi mumkin)' });
  if (msg.uid === uid) return json(400, { error: 'O‘z xabaringizga shikoyat qilib bo‘lmaydi' });
  const rep = (await db('GET', `chatReports/${id}`)) || {};
  const by = rep.by && typeof rep.by === 'object' ? rep.by : {};
  if (by[uid]) return json(200, { ok: true, hidden: !!msg.hidden });
  by[uid] = 1;
  const n = Object.keys(by).length;
  // Xabar nusxasi saqlanadi: u keyin tozalanib ketsa ham admin nima haqida shikoyat bo'lganini ko'radi
  await db('PUT', `chatReports/${id}`, { uid: msg.uid, name: msg.name, text: msg.text, ts: msg.ts, n, by, last: Date.now() });
  let hidden = !!msg.hidden;
  if (n >= cfg.hideAt && !hidden) {
    await db('PATCH', `chat/${ROOM}/${id}`, { hidden: true });
    hidden = true;
  }
  return json(200, { ok: true, hidden });
}
