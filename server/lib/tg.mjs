// Telegram bot va Firebase uchun umumiy yordamchilar (Vercel funksiyalari ichida ishlatiladi).
import { createHmac, timingSafeEqual } from 'node:crypto';

export const json = (status, body, extra = {}) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body: JSON.stringify(body),
});

export const parseBody = event => {
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '{}';
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
};

/** Foydalanuvchining Telegramdagi ismi (xabarda murojaat uchun). Ism bo'lmasa — username, u ham bo'lmasa bo'sh qator */
export const firstNameOf = u => String(u?.first_name || '').trim().slice(0, 40) || String(u?.username || '').trim().slice(0, 40);

/** Mini App ochiladigan manzil (bot tugmasi uchun). SITE_URL ni qo'lda berish mumkin; aks holda Vercel production domeni */
export const siteUrl = () => {
  const v = process.env.SITE_URL || process.env.URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  return String(v).replace(/\/$/, '');
};

/**
 * Telegram Mini App `initData` imzosini tekshiradi (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * To'g'ri bo'lsa foydalanuvchi obyektini qaytaradi, aks holda null.
 */
export function verifyInitData(initData, token, maxAgeSec = 3 * 24 * 3600) {
  try {
    if (!initData || !token) return null;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
    params.delete('hash');
    const check = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    const calc = createHmac('sha256', secret).update(check).digest('hex');
    const a = Buffer.from(calc, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const age = Date.now() / 1000 - Number(params.get('auth_date') || 0);
    if (!(age >= -300 && age <= maxAgeSec)) return null;
    const user = JSON.parse(params.get('user') || 'null');
    return user && Number.isFinite(Number(user.id)) ? user : null;
  } catch {
    return null;
  }
}

/** Telegram Bot API chaqiruvi (JSON yoki FormData) */
export async function tgApi(token, method, payload) {
  const isForm = typeof FormData !== 'undefined' && payload instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? payload : JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const err = new Error(data.description || `Telegram xatosi ${res.status}`);
    err.code = data.error_code || res.status;
    err.retryAfter = data.parameters?.retry_after;
    throw err;
  }
  return data.result;
}

/** "Ilovani ochish" tugmasi (Mini App) */
export const openAppMarkup = (label = '🚀 VocaBoost ni ochish') => {
  const url = siteUrl();
  return url.startsWith('https://') ? { inline_keyboard: [[{ text: label, web_app: { url } }]] } : undefined;
};

/** /start xabari ostidagi 3 ta tugmali klaviatura (1-si Mini App, 2- va 3-si admin havolalari) */
export const makeStartMarkup = (cfg = {}) => {
  const url = siteUrl();
  const inline_keyboard = [];
  const btn1Text = String(cfg.button || DEFAULT_START_BUTTON).slice(0, 40);
  if (url.startsWith('https://')) {
    inline_keyboard.push([{ text: btn1Text, web_app: { url } }]);
  }
  if (cfg.btn2Text && cfg.btn2Url) {
    inline_keyboard.push([{ text: String(cfg.btn2Text).slice(0, 40), url: String(cfg.btn2Url).trim() }]);
  }
  if (cfg.btn3Text && cfg.btn3Url) {
    inline_keyboard.push([{ text: String(cfg.btn3Text).slice(0, 40), url: String(cfg.btn3Url).trim() }]);
  }
  return inline_keyboard.length ? { inline_keyboard } : undefined;
};

export const makeCustomButtonsMarkup = (buttons = []) => {
  const rows = [];
  (Array.isArray(buttons) ? buttons : []).slice(0, 3).forEach(b => {
    if (b && b.text && b.url) {
      rows.push([{ text: String(b.text).slice(0, 40), url: String(b.url).trim() }]);
    }
  });
  return rows.length ? { inline_keyboard: rows } : undefined;
};

export const sendMessage = (token, chatId, text, markup, parseMode = 'HTML') => {
  const payload = {
    chat_id: chatId,
    text: String(text).slice(0, 4000),
    disable_web_page_preview: false,
    ...(markup ? { reply_markup: markup } : {}),
  };
  if (parseMode) payload.parse_mode = parseMode;
  return tgApi(token, 'sendMessage', payload);
};

export const sendPhoto = (token, chatId, photo, caption, markup, parseMode = 'HTML') => {
  const payload = {
    chat_id: chatId,
    photo: String(photo).trim(),
    ...(caption ? { caption: String(caption).slice(0, 1024) } : {}),
    ...(markup ? { reply_markup: markup } : {}),
  };
  if (parseMode && caption) payload.parse_mode = parseMode;
  return tgApi(token, 'sendPhoto', payload);
};

/** Firebase Realtime Database (REST, maxfiy kalit bilan) */
export function makeDb() {
  const { FIREBASE_DB_URL, FIREBASE_DB_SECRET } = process.env;
  if (!FIREBASE_DB_URL || !FIREBASE_DB_SECRET) return null;
  const DB = FIREBASE_DB_URL.replace(/\/$/, '');
  return async (method, path, data) => {
    const res = await fetch(`${DB}/${path}.json?auth=${encodeURIComponent(FIREBASE_DB_SECRET)}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB xatosi ${res.status}`);
    return res.json();
  };
}

/** Toshkent vaqti (UTC+5) */
export const tashkentNow = () => new Date(Date.now() + 5 * 3600 * 1000);
export const tashkentDay = () => tashkentNow().toISOString().slice(0, 10);
export const tashkentStartOfDayMs = () => {
  const t = tashkentNow();
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - 5 * 3600 * 1000;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Hammaga (yoki eslatmani yoqqanlarga) xabar yuboradi. Telegram chegarasiga (~30 xabar/soniya) mos sekinlikda.
 * Jarayon `adminState/broadcast` ga yoziladi — admin panelda ko'rinadi.
 * opts: { text, kind: 'manual' | 'daily', respectOptOut, skipActiveToday }
 */
export async function runBroadcast(opts) {
  const token = process.env.BOT_TOKEN;
  const db = makeDb();
  if (!token || !db) throw new Error('BOT_TOKEN yoki Firebase sozlanmagan');
  const users = (await db('GET', 'tgusers')) || {};
  const lb = opts.skipActiveToday ? (await db('GET', 'leaderboard')) || {} : {};
  const dayStart = tashkentStartOfDayMs();
  const markup = opts.customButtonsOnly ? makeCustomButtonsMarkup(opts.buttons) : (opts.buttons && opts.buttons.length ? makeCustomButtonsMarkup(opts.buttons) : openAppMarkup());
  const parseMode = opts.parseMode || 'HTML';
  const photoUrl = opts.photoUrl ? String(opts.photoUrl).trim() : null;

  // Shaxsiy taklif tugmasi: har bir foydalanuvchi uchun UNING o'z havolasi (t.me/Bot?start=ref_<ID>) bilan
  let inviteBot = '';
  let inviteText = DEFAULT_INVITE_TEXT;
  if (opts.invite) {
    const rcfg = (await db('GET', 'config/referral').catch(() => null)) || {};
    inviteBot = await getBotUsername(rcfg, token);
    inviteText = String(rcfg.shareText || DEFAULT_INVITE_TEXT);
  }
  const targets = Object.entries(users).filter(([id, u]) => {
    if (!u || u.blocked) return false;
    if (opts.respectOptOut && u.remind === false) return false;
    if (opts.skipActiveToday && Number(lb[`tg_${id}`]?.ts) >= dayStart) return false;
    return true;
  });

  const runId = 'b' + Date.now().toString(36);
  const st = {
    id: runId,
    kind: opts.kind || 'manual',
    text: String(opts.text).slice(0, 300),
    photoUrl: photoUrl || null,
    buttonsCount: opts.buttons ? opts.buttons.length : 0,
    startedAt: Date.now(),
    total: targets.length,
    sent: 0,
    failed: 0,
    blocked: 0,
    done: false
  };
  await db('PUT', 'adminState/broadcast', st).catch(() => {});

  let n = 0;
  for (const [id, u] of targets) {
    const name = String(u.name || '').split(' ')[0] || "do'st";
    const text = String(opts.text).replace(/\{name\}/gi, name);
    let tries = 0;
    let mk = markup;
    if (opts.invite && inviteBot) {
      const link = inviteLink(inviteBot, id);
      const url = opts.invite.mode === 'link' ? link : shareUrl(link, inviteText);
      const row = [{ text: String(opts.invite.label || '👥 Do\'stlarni taklif qilish').slice(0, 40), url }];
      mk = { inline_keyboard: [row, ...((markup && markup.inline_keyboard) || [])] };
    }
    for (;;) {
      try {
        if (photoUrl) {
          await sendPhoto(token, Number(id), photoUrl, text, mk, parseMode);
        } else {
          await sendMessage(token, Number(id), text, mk, parseMode);
        }
        st.sent++;
        break;
      } catch (e) {
        if (e.code === 429 && tries++ < 3) {
          await sleep(((e.retryAfter || 2) + 0.5) * 1000);
          continue;
        }
        if (e.code === 403 || /blocked|deactivated|chat not found/i.test(e.message)) {
          st.blocked++;
          await db('PATCH', `tgusers/${id}`, { blocked: true }).catch(() => {});
        } else st.failed++;
        break;
      }
    }
    n++;
    if (n % 20 === 0) await db('PATCH', 'adminState/broadcast', { sent: st.sent, failed: st.failed, blocked: st.blocked }).catch(() => {});
    await sleep(45);
  }
  st.done = true;
  st.finishedAt = Date.now();
  await db('PUT', 'adminState/broadcast', st).catch(() => {});
  return st;
}

const sleepMs = ms => new Promise(r => setTimeout(r, ms));

/** Ketma-ket raqam (ETag bilan xavfsiz oshiriladi — ikki kishiga bir xil raqam berilmaydi) */
export async function nextSeq(path = 'meta/certSeq') {
  const { FIREBASE_DB_URL, FIREBASE_DB_SECRET } = process.env;
  if (!FIREBASE_DB_URL || !FIREBASE_DB_SECRET) throw new Error('Baza sozlanmagan');
  const url = `${FIREBASE_DB_URL.replace(/\/$/, '')}/${path}.json?auth=${encodeURIComponent(FIREBASE_DB_SECRET)}`;
  for (let i = 0; i < 10; i++) {
    const g = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' } });
    if (!g.ok) throw new Error(`DB xatosi ${g.status}`);
    const etag = g.headers.get('etag');
    const cur = Number(await g.json()) || 0;
    const p = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag || 'null_etag' }, body: JSON.stringify(cur + 1) });
    if (p.ok) return cur + 1;
    if (p.status !== 412) throw new Error(`DB xatosi ${p.status}`);
    await sleepMs(40 + Math.random() * 120);
  }
  throw new Error("Sertifikat raqamini olib bo'lmadi, qayta urinib ko'ring");
}

export const certNumber = n => 'VB-' + String(n).padStart(6, '0');

/** Barcha sertifikat dizaynlari (src/services/certificate.ts va admin.html bilan bir xil bo'lishi shart) */
export const CERT_TPLS = ['bronze', 'silver', 'gold', 'platinum', 'champion', 'active', 'marathon', 'thanks', 'trust', 'growth', 'wisdom', 'speed', 'reviewer', 'expert', 'consistent', 'limitless', 'weekly'];

/** Reyting yozuvidan sertifikat «muhr»lari: daraja, yodlangan so'zlar, streak */
export const statsFromLb = lb => {
  if (!lb || typeof lb !== 'object') return undefined;
  const words = Math.max(Number(lb.mastered) || 0, 0) || Math.max(Number(lb.learned) || 0, 0);
  const streak = Math.max(0, Number(lb.streak) || 0);
  const lvl = ['A1', 'A2', 'B1', 'B2', 'B2+', 'C1'].includes(String(lb.level)) ? String(lb.level) : '';
  if (!words && !streak && !lvl) return undefined;
  return { ...(lvl ? { lvl } : {}), ...(words ? { words } : {}), ...(streak ? { streak } : {}) };
};

/** Sertifikatni bazaga yozadi (foydalanuvchi ostida + umumiy indeks) va raqamini qaytaradi.
 *  fmt: 'wide' (16:9) yoki 'story' (9:16). Berilmasa: «Minnatdorchilik» — avtomatik 9:16, qolganlari — 16:9 */
export async function issueCertificate(db, { userId, tpl, title, reason, name, auto = false, milestone = 0, fmt, stats, label }) {
  const id = certNumber(await nextSeq());
  const date = tashkentDay();
  const useTpl = CERT_TPLS.includes(tpl) ? tpl : 'gold';
  const cert = {
    tpl: useTpl,
    title: String(title || '').slice(0, 100),
    ...(label ? { label: String(label).slice(0, 28) } : {}),
    reason: String(reason || '').slice(0, 200),
    name: String(name || "O'quvchi").slice(0, 40),
    date,
    ts: Date.now(),
    auto: !!auto,
    fmt: fmt === 'story' || fmt === 'wide' ? fmt : useTpl === 'thanks' ? 'story' : 'wide',
    ...(milestone ? { milestone } : {}),
    ...(stats ? { stats } : {}),
  };
  await db('PUT', `certs/${userId}/${id}`, cert);
  await db('PUT', `certIndex/${id}`, { userId, title: cert.title, date });
  return { id, date, cert };
}

/** Tugunni "olingan" deb belgilaydi (ETag bilan: bir sovg'ani ikki qurilma bir vaqtda ola olmaydi). Olingan bo'lsa — null */
export async function claimNode(path) {
  const { FIREBASE_DB_URL, FIREBASE_DB_SECRET } = process.env;
  const url = `${FIREBASE_DB_URL.replace(/\/$/, '')}/${path}.json?auth=${encodeURIComponent(FIREBASE_DB_SECRET)}`;
  for (let i = 0; i < 4; i++) {
    const g = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' } });
    if (!g.ok) throw new Error(`DB xatosi ${g.status}`);
    const etag = g.headers.get('etag');
    const val = await g.json();
    if (!val || typeof val !== 'object' || val.claimedAt) return null;
    const p = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag || '' }, body: JSON.stringify({ ...val, claimedAt: Date.now() }) });
    if (p.ok) return val;
    if (p.status !== 412) throw new Error(`DB xatosi ${p.status}`);
    await sleepMs(40 + Math.random() * 100);
  }
  return null;
}

export const DEFAULT_START_BUTTON = '🚀 VocaBoostni ochish';
export const DEFAULT_START_TEXT =
  "👋 Assalomu alaykum, {name}!\n\n🚀 VocaBoost'ga xush kelibsiz — inglizcha so'zlarni tez va uzoq yodlash ilovasi.\n\n✅ Har kuni atigi 10 ta yangi so'z\n🧠 Aqlli takrorlash — o'rgangan so'zlaringizni unutmaysiz\n🎮 O'yinlar, omadli baraban va raqiblar bilan bellashuv\n🎓 100 / 250 / 500 / 1000 ta so'zga sertifikat\n\nBoshlash uchun pastdagi tugmani bosing 👇";


// ---------------------------------------------------------------------------------------------------------
// DO'ST TAKLIF QILISH (referal). Havola: https://t.me/<bot>?start=ref_<taklif qiluvchining Telegram ID si>
// ---------------------------------------------------------------------------------------------------------
export const DEFAULT_INVITE_TEXT = "🚀 VocaBoost — inglizcha so'zlarni tez va uzoq yodlash ilovasi! Men har kuni mashq qilyapman. Sen ham qo'shil 👇";
export const DEFAULT_REF_NOTIFY = '🎉 «{name}» ismli do\'stingiz siz yuborgan link orqali botimizga qo\'shildi, shuning uchun sizga {xp} XP berildi.\n\n👥 Taklif qilgan do\'stlaringiz soni: {count} ta';

export const escHtml = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const inviteLink = (bot, uid) => `https://t.me/${bot}?start=ref_${uid}`;
export const shareUrl = (link, text) => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(String(text || '').slice(0, 900))}`;

let _botName = '';
/** Bot username: admin paneldagi qiymat > BOT_USERNAME env > Telegram getMe (xotirada saqlanadi) */
export async function getBotUsername(cfg, token) {
  const fromCfg = String(cfg?.botUsername || process.env.BOT_USERNAME || '').replace(/^@/, '').trim();
  if (fromCfg) return fromCfg;
  if (_botName) return _botName;
  try {
    const me = await tgApi(token, 'getMe', {});
    _botName = String(me?.username || '');
  } catch {
    /* ignore */
  }
  return _botName;
}

const clampInt = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/**
 * Do'st botga havola orqali BIRINCHI marta /start bosganda chaqiriladi.
 * 1) taklif qiluvchiga XP sovg'asi (grants) va hisoblagich (leaderboard/<uid>/refs) yoziladi — ilova shu zahoti oladi;
 * 2) taklif qiluvchining Telegramiga xabar yuboriladi.
 * Qaytarish: { count, xp } yoki null (hisobga olinmadi).
 */
export async function processReferral(db, token, friend, refId) {
  const fid = String(friend?.id || '');
  if (!fid || !/^\d{3,15}$/.test(String(refId)) || fid === String(refId)) return null;
  const cfg = (await db('GET', 'config/referral')) || {};
  if (cfg.enabled === false) return null;
  const refUid = `tg_${refId}`;
  const lb = await db('GET', `leaderboard/${refUid}`);
  if (!lb || lb.deleted) return null; // faqat ilovadan foydalanayotgan haqiqiy foydalanuvchi taklif qila oladi
  if (await db('GET', `referrals/${refId}/${fid}`)) return null; // bu do'st oldin hisobga olingan
  const xp = clampInt(cfg.xp, 0, 100000, 50);
  const fname = firstNameOf(friend) || "do'st";
  await db('PUT', `referrals/${refId}/${fid}`, { name: fname.slice(0, 40), ts: Date.now(), xp });
  const all = (await db('GET', `referrals/${refId}`)) || {};
  const count = Object.keys(all).length;
  const upd = {};
  if (xp > 0) {
    const gid = 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    upd[`grants/${refUid}/${gid}`] = { type: 'xp', amount: xp, validHours: 0, note: `Do'st taklif qilindi: ${fname}`.slice(0, 80), ts: Date.now() };
    upd[`leaderboard/${refUid}/hasGrant`] = true;
  }
  upd[`leaderboard/${refUid}/refs`] = count;
  await db('PATCH', '', upd);
  db('PATCH', `tgusers/${fid}`, { ref: String(refId) }).catch(() => {});
  const tpl = String(cfg.notifyText || DEFAULT_REF_NOTIFY);
  const msg = tpl.replace(/\{name\}/gi, escHtml(fname)).replace(/\{xp\}/gi, String(xp)).replace(/\{count\}/gi, String(count));
  try {
    await sendMessage(token, Number(refId), msg, openAppMarkup('🚀 VocaBoostni ochish'));
  } catch {
    /* taklif qiluvchi botni bloklagan bo'lishi mumkin — XP baribir berilgan */
  }
  return { count, xp };
}
