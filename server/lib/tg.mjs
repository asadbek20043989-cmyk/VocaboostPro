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

/** Telegram tugma ranglari (Bot API 9.4+): primary = ko'k, success = yashil, danger = qizil. Bo'sh = oddiy (kulrang) */
export const BTN_STYLES = ['primary', 'success', 'danger'];
export const cleanStyle = v => (BTN_STYLES.includes(String(v || '')) ? String(v) : '');
const cleanEmojiId = v => (/^\d{5,25}$/.test(String(v || '').trim()) ? String(v).trim() : '');

/** Tugma obyektiga rang va premium emoji ikonkasini qo'shadi (noto'g'ri qiymatlar tashlab yuboriladi) */
const decorate = (btn, style, icon) => {
  const st = cleanStyle(style);
  const ic = cleanEmojiId(icon);
  if (st) btn.style = st;
  if (ic) btn.icon_custom_emoji_id = ic;
  return btn;
};

/** "Ilovani ochish" tugmasi (Mini App) */
export const openAppMarkup = (label = '🚀 VocaBoost ni ochish', style = 'success') => {
  const url = siteUrl();
  return url.startsWith('https://') ? { inline_keyboard: [[decorate({ text: label, web_app: { url } }, style)]] } : undefined;
};

/** /start xabari ostidagi 3 ta tugmali klaviatura (1-si Mini App, 2- va 3-si admin havolalari). Har biriga rang va premium ikonka berish mumkin */
export const makeStartMarkup = (cfg = {}) => {
  const url = siteUrl();
  const inline_keyboard = [];
  const btn1Text = String(cfg.button || DEFAULT_START_BUTTON).slice(0, 40);
  if (url.startsWith('https://')) {
    inline_keyboard.push([decorate({ text: btn1Text, web_app: { url } }, cfg.btn1Style === undefined ? 'success' : cfg.btn1Style, cfg.btn1Icon)]);
  }
  if (cfg.btn2Text && cfg.btn2Url) {
    inline_keyboard.push([decorate({ text: String(cfg.btn2Text).slice(0, 40), url: String(cfg.btn2Url).trim() }, cfg.btn2Style, cfg.btn2Icon)]);
  }
  if (cfg.btn3Text && cfg.btn3Url) {
    inline_keyboard.push([decorate({ text: String(cfg.btn3Text).slice(0, 40), url: String(cfg.btn3Url).trim() }, cfg.btn3Style, cfg.btn3Icon)]);
  }
  return inline_keyboard.length ? { inline_keyboard } : undefined;
};

export const makeCustomButtonsMarkup = (buttons = []) => {
  const rows = [];
  (Array.isArray(buttons) ? buttons : []).slice(0, 3).forEach(b => {
    if (b && b.text && b.url) {
      rows.push([decorate({ text: String(b.text).slice(0, 40), url: String(b.url).trim() }, b.style, b.icon)]);
    }
  });
  return rows.length ? { inline_keyboard: rows } : undefined;
};

/** Premium emoji (<tg-emoji emoji-id="..">😀</tg-emoji>) ni oddiy emojiga aylantiradi — Telegram qabul qilmasa zaxira variant */
export const stripPremium = text => String(text ?? '').replace(/<tg-emoji\b[^>]*>([\s\S]*?)<\/tg-emoji>/gi, '$1');
/** Tugmalardan rang va premium ikonkani olib tashlaydi (zaxira variant) */
export const stripButtonExtras = markup => {
  if (!markup || !markup.inline_keyboard) return markup;
  return { inline_keyboard: markup.inline_keyboard.map(row => row.map(b => { const { style, icon_custom_emoji_id, ...rest } = b; return rest; })) };
};
const isFancyError = e => /custom.?emoji|emoji.?id|entit|style|icon|BUTTON_|DOCUMENT_INVALID|premium/i.test(String(e?.message || ''));

export const sendMessage = async (token, chatId, text, markup, parseMode = 'HTML') => {
  const build = (t, m) => {
    const payload = {
      chat_id: chatId,
      text: String(t).slice(0, 4000),
      disable_web_page_preview: false,
      ...(m ? { reply_markup: m } : {}),
    };
    if (parseMode) payload.parse_mode = parseMode;
    return payload;
  };
  try {
    return await tgApi(token, 'sendMessage', build(text, markup));
  } catch (e) {
    // Premium emoji yoki rangli tugma qabul qilinmasa — oddiy ko'rinishda qayta yuboramiz (xabar yo'qolmasin)
    if (!isFancyError(e)) throw e;
    return tgApi(token, 'sendMessage', build(stripPremium(text), stripButtonExtras(markup)));
  }
};

export const sendPhoto = async (token, chatId, photo, caption, markup, parseMode = 'HTML') => {
  const build = (c, m) => {
    const payload = {
      chat_id: chatId,
      photo: String(photo).trim(),
      ...(c ? { caption: String(c).slice(0, 1024) } : {}),
      ...(m ? { reply_markup: m } : {}),
    };
    if (parseMode && c) payload.parse_mode = parseMode;
    return payload;
  };
  try {
    return await tgApi(token, 'sendPhoto', build(caption, markup));
  } catch (e) {
    if (!isFancyError(e)) throw e;
    return tgApi(token, 'sendPhoto', build(stripPremium(caption), stripButtonExtras(markup)));
  }
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
/**
 * Segment: { levels?: ['B1',...], inactiveDays?: N (kamida N kundan beri kirmagan), minStreak?: N, maxStreak?: N }
 * Maydonlar bo'sh bo'lsa — shart qo'llanmaydi.
 */
export function inSegment(seg, tgUser, lbEntry) {
  if (!seg) return true;
  const e = lbEntry || {};
  if (Array.isArray(seg.levels) && seg.levels.length) {
    const lv = String(e.level || tgUser?.level || '').toUpperCase();
    if (!seg.levels.includes(lv)) return false;
  }
  if (seg.inactiveDays > 0) {
    const last = Number(e.ts || tgUser?.lastSeen || 0);
    if (last && Date.now() - last < seg.inactiveDays * 86400000) return false;
  }
  const st = Number(e.streak) || 0;
  if (seg.minStreak > 0 && st < seg.minStreak) return false;
  if (seg.maxStreak >= 0 && seg.maxStreak != null && seg.maxStreak !== '' && Number.isFinite(seg.maxStreak) && st > seg.maxStreak) return false;
  return true;
}
export const cleanSegment = raw => {
  if (!raw || typeof raw !== 'object') return null;
  const LV = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const levels = Array.isArray(raw.levels) ? raw.levels.map(x => String(x).toUpperCase()).filter(x => LV.includes(x)) : [];
  const num = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(max, n) : 0; };
  const seg = { levels, inactiveDays: num(raw.inactiveDays, 365), minStreak: num(raw.minStreak, 3650) };
  const mx = raw.maxStreak === '' || raw.maxStreak == null ? null : Math.round(Number(raw.maxStreak));
  if (mx !== null && Number.isFinite(mx) && mx >= 0) seg.maxStreak = Math.min(3650, mx);
  return levels.length || seg.inactiveDays || seg.minStreak || seg.maxStreak !== undefined ? seg : null;
};

// ---------- Ommaviy yuborish (Vercel 60 soniya chegarasiga mos, davom ettiriladigan) ----------
// Muammo: eski kod hamma foydalanuvchini BITTA chaqiruvda, ketma-ket (har biri ~0,2 s) yuborardi. Vercel funksiyasi 60 soniyada
// o'chirilgani uchun ~280 tadan keyin yuborish to'xtab qolardi. Endi:
//  • xabarlar 25 tadan guruhlab (taxminan 25 xabar/s — Telegram chegarasi 30/s dan past) parallel yuboriladi;
//  • yuboriladiganlar ro'yxati va joriy o'rni bazada (broadcastJobs/<id>) saqlanadi;
//  • vaqt tugab qolsa, funksiya o'zini yangidan chaqirib, qolganini davom ettiradi (har chaqiruv — yangi 60 soniya);
//  • biror sabab bilan zanjir uzilsa, soatlik `remind` yoki paneldagi «Davom ettirish» tugmasi qolganini yuboradi.
const BC_BATCH = 25;
const BC_MIN_BATCH_MS = 1000;
const bcBudgetMs = () => Number(process.env.BROADCAST_BUDGET_MS) || (process.env.NETLIFY ? 800000 : 42000);

/** To'xtab qolgan yoki vaqt tugagan yuborishni yangi chaqiruvda davom ettiradi. chain=true: oldingi ishchi tugagan (qulf tekshirilmaydi) */
export async function triggerBroadcastResume(runId, chain = false) {
  const base = siteUrl();
  const code = process.env.ADMIN_CODE;
  if (!base || !code || !runId) return false;
  try {
    const r = await fetch(`${base}/api/fn/broadcast-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, resume: String(runId), chain: !!chain }),
      signal: AbortSignal.timeout(10000),
    });
    return r.status === 202 || r.ok;
  } catch {
    return false;
  }
}

export async function runBroadcast(opts) {
  const t0 = Date.now();
  const token = process.env.BOT_TOKEN;
  const db = makeDb();
  if (!token || !db) throw new Error('BOT_TOKEN yoki Firebase sozlanmagan');

  let runId;
  let job;
  let st;
  let users;
  if (opts.resume) {
    // ---- davom ettirish ----
    runId = String(opts.resume);
    [job, st] = await Promise.all([db('GET', `broadcastJobs/${runId}`), db('GET', 'adminState/broadcast')]);
    if (!job || !st || st.id !== runId || st.done) return st || null;
    // Zanjirdan tashqari (cron/tugma) chaqiruvda: boshqa ishchi hali ishlayotgan bo'lsa — aralashmaymiz
    if (!opts.chain && Date.now() - (Number(st.lastTick) || 0) < 120000) return st;
    users = (await db('GET', 'tgusers')) || {};
  } else {
    // ---- yangi yuborish ----
    users = (await db('GET', 'tgusers')) || {};
    const lb = opts.skipActiveToday || opts.segment ? (await db('GET', 'leaderboard')) || {} : {};
    const dayStart = tashkentStartOfDayMs();
    const only = Array.isArray(opts.onlyIds) ? new Set(opts.onlyIds.map(String)) : null; // faqat shu ID larga (yarim qolgan yuborishni tugatish)
    const targets = Object.entries(users).filter(([id, u]) => {
      if (only && !only.has(id)) return false;
      if (!u || u.blocked) return false;
      if (opts.respectOptOut && u.remind === false) return false;
      if (opts.skipActiveToday && Number(lb[`tg_${id}`]?.ts) >= dayStart) return false;
      if (opts.segment && !inSegment(opts.segment, u, lb[`tg_${id}`])) return false;
      return /^\d{3,15}$/.test(id);
    });
    runId = 'b' + Date.now().toString(36);
    const photoUrl = opts.photoUrl ? String(opts.photoUrl).trim() : null;
    job = {
      o: {
        text: String(opts.text),
        photoUrl,
        buttons: Array.isArray(opts.buttons) ? opts.buttons : [],
        customButtonsOnly: !!opts.customButtonsOnly,
        parseMode: opts.parseMode || 'HTML',
        invite: opts.invite || null,
      },
      ids: targets.map(([id]) => id).join(','),
      pos: 0,
    };
    st = {
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
      done: false,
      lastTick: Date.now(),
    };
    const prev = await db('GET', 'adminState/broadcast').catch(() => null);
    await db('PUT', `broadcastJobs/${runId}`, job);
    await db('PUT', 'adminState/broadcast', st);
    if (prev?.id && prev.id !== runId) db('DELETE', `broadcastJobs/${prev.id}`).catch(() => {});
  }

  const o = job.o || {};
  const ids = String(job.ids || '').split(',').filter(Boolean);
  const markup = o.customButtonsOnly ? makeCustomButtonsMarkup(o.buttons) : o.buttons && o.buttons.length ? makeCustomButtonsMarkup(o.buttons) : openAppMarkup();
  const parseMode = o.parseMode || 'HTML';
  const photoUrl = o.photoUrl || null;

  // Shaxsiy taklif tugmasi: har bir foydalanuvchi uchun UNING o'z havolasi (t.me/Bot?start=ref_<ID>) bilan
  let inviteBot = '';
  let inviteText = DEFAULT_INVITE_TEXT;
  if (o.invite) {
    const rcfg = (await db('GET', 'config/referral').catch(() => null)) || {};
    inviteBot = await getBotUsername(rcfg, token);
    inviteText = String(rcfg.shareText || DEFAULT_INVITE_TEXT);
  }

  const upd = {};
  const sendOne = async id => {
    const u = users[id] || {};
    if (u.blocked) return;
    const name = String(u.name || '').split(' ')[0] || "do'st";
    const text = String(o.text).replace(/\{name\}/gi, escHtml(name));
    let mk = markup;
    if (o.invite && inviteBot) {
      const link = inviteLink(inviteBot, id);
      const url = o.invite.mode === 'link' ? link : shareUrl(link, inviteText);
      const row = [{ text: String(o.invite.label || "👥 Do'stlarni taklif qilish").slice(0, 40), url }];
      mk = { inline_keyboard: [row, ...((markup && markup.inline_keyboard) || [])] };
    }
    let tries = 0;
    for (;;) {
      try {
        if (photoUrl) await sendPhoto(token, Number(id), photoUrl, text, mk, parseMode);
        else await sendMessage(token, Number(id), text, mk, parseMode);
        st.sent++;
        return;
      } catch (e) {
        if (e.code === 429 && tries++ < 4) {
          await sleep(((e.retryAfter || 2) + 0.5) * 1000);
          continue;
        }
        if (e.code === 403 || /blocked|deactivated|chat not found/i.test(String(e.message))) {
          st.blocked++;
          upd[`tgusers/${id}/blocked`] = true;
        } else st.failed++;
        return;
      }
    }
  };

  let pos = Math.max(0, Number(job.pos) || 0);
  const stopAt = t0 + bcBudgetMs();
  while (pos < ids.length && Date.now() < stopAt) {
    const tb = Date.now();
    const batch = ids.slice(pos, pos + BC_BATCH);
    await Promise.all(batch.map(sendOne));
    pos += batch.length;
    // Bitta so'rov bilan: hisoblagichlar + joriy o'rin + bloklanganlar (uzilib qolsa ham shu joydan davom etadi)
    await db('PATCH', '', {
      ...upd,
      'adminState/broadcast/sent': st.sent,
      'adminState/broadcast/failed': st.failed,
      'adminState/broadcast/blocked': st.blocked,
      'adminState/broadcast/lastTick': Date.now(),
      [`broadcastJobs/${runId}/pos`]: pos,
    }).catch(() => {});
    for (const k of Object.keys(upd)) delete upd[k];
    const spent = Date.now() - tb;
    if (spent < BC_MIN_BATCH_MS) await sleep(BC_MIN_BATCH_MS - spent);
  }

  if (pos >= ids.length) {
    st.done = true;
    st.finishedAt = Date.now();
    await db('PATCH', 'adminState/broadcast', { sent: st.sent, failed: st.failed, blocked: st.blocked, done: true, finishedAt: st.finishedAt, lastTick: Date.now() }).catch(() => {});
    db('DELETE', `broadcastJobs/${runId}`).catch(() => {});
    return st;
  }
  // Vaqt tugadi — qolganini yangi chaqiruv (yangi 60 soniya) davom ettiradi
  await triggerBroadcastResume(runId, true);
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
  const lvl = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(String(lb.level)) ? String(lb.level) : (String(lb.level) === 'B2+' ? 'B2' : '');
  if (!words && !streak && !lvl) return undefined;
  return { ...(lvl ? { lvl } : {}), ...(words ? { words } : {}), ...(streak ? { streak } : {}) };
};

/** Sertifikatni bazaga yozadi (foydalanuvchi ostida + umumiy indeks) va raqamini qaytaradi.
 *  fmt: 'wide' (16:9) yoki 'story' (9:16). Berilmasa — 16:9 */
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
    fmt: fmt === 'story' || fmt === 'wide' ? fmt : 'wide',
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

// ---------------------------------------------------------------------------------------------------------
// SOVG'A XABARI: foydalanuvchiga bot orqali «Sizga shu nomdagi sovg'a berildi» + «🚀 Ilovani ochish» tugmasi.
// Matnda {name} (ism), {gift} (sovg'a nomi), {id} (sertifikat raqami) ishlatiladi. Admin o'z matnini bera oladi.
// ---------------------------------------------------------------------------------------------------------
export const DEFAULT_GIFT_TEXT =
  "🎁 <b>Sizga sovg'a berildi!</b>\n\nHurmatli <b>{name}</b>, sizga «<b>{gift}</b>» nomli sovg'a berildi.\n\nUni olish uchun ilovani oching 👇";
export const DEFAULT_GIFT_CERT_TEXT =
  "🎓 <b>Sizga sertifikat berildi!</b>\n\nHurmatli <b>{name}</b>, sizga «<b>{gift}</b>» nomli sertifikat berildi.\n№ <code>{id}</code>\n\nIlovani oching — sertifikat shu chatga rasm bo'lib keladi 👇";

/** Sovg'a haqida xabar yuboradi. Xato bo'lsa tashlaydi (403 = bot bloklangan). 429 bo'lsa kutib qayta uriniladi */
export async function notifyGift(token, tgId, { name, gift, id = '', text, kind = 'gift' }) {
  const tpl = String(text || '').trim() || (kind === 'cert' ? DEFAULT_GIFT_CERT_TEXT : DEFAULT_GIFT_TEXT);
  const first = String(name || '').trim().split(/\s+/)[0] || "do'st";
  const body = tpl
    .replace(/\{name\}/gi, () => escHtml(first))
    .replace(/\{gift\}/gi, () => escHtml(gift))
    .replace(/\{id\}/gi, () => escHtml(id));
  const markup = openAppMarkup('🚀 Ilovani ochish');
  for (let tries = 0; ; tries++) {
    try {
      try {
        return await sendMessage(token, tgId, body, markup, 'HTML');
      } catch (e) {
        // Admin yozgan HTML noto'g'ri bo'lsa — teglarsiz oddiy matn sifatida yuboramiz (xabar yo'qolmasin)
        if (/parse entities|can't find end|unsupported start tag/i.test(String(e?.message))) {
          const plain = body.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
          return await sendMessage(token, tgId, plain, markup, null);
        }
        throw e;
      }
    } catch (e) {
      if (e.code === 429 && tries < 2) {
        await sleep(((e.retryAfter || 2) + 0.5) * 1000);
        continue;
      }
      throw e;
    }
  }
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
// ---------- v11: sovg'a yordamchilari (taklif, streak marralari, win-back ular bilan yozadi) ----------
/** Sovg'a nomi (bot xabarlarida) */
export const giftText = (type, amount) => {
  const n = Math.round(Number(amount) || 0);
  if (type === 'spins') return `${n} ta baraban aylantirish 🎡`;
  if (type === 'vip') return n >= 24 && n % 24 === 0 ? `${n / 24} kunlik VIP 👑` : `${n} soatlik VIP 👑`;
  if (type === 'xp') return `${n} XP 💎`;
  if (type === 'coins') return `${n} tanga 🪙`;
  return "sovg'a 🎁";
};
export const GIFT_CAPS = { spins: 50, vip: 720, xp: 100000, coins: 100000000 };
/** {kalit} o'rinlariga qiymat qo'yadi (name — HTML-xavfsiz, faqat birinchi so'z) */
export const fillTpl = (tpl, vars = {}) =>
  String(tpl ?? '').replace(/\{(\w+)\}/g, (m, k) => {
    const key = Object.keys(vars).find(x => x.toLowerCase() === k.toLowerCase());
    if (key === undefined) return m;
    return key === 'name' ? escHtml(String(vars[key] || '').trim().split(/\s+/)[0] || "do'st") : String(vars[key]);
  });
/** Ko'p joyga yoziladigan o'zgartirishlar (db('PATCH','',upd)) uchun sovg'a yozuvi. flag — reytingda yozuvi bor foydalanuvchiga hasGrant bayrog'i */
export function grantUpdates(uid, { type, amount, note }, { flag = false } = {}) {
  const n = Math.round(Number(amount) || 0);
  if (!GIFT_CAPS[type] || !(n > 0) || n > GIFT_CAPS[type]) return {};
  const gid = 'v' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
  const upd = { [`grants/${uid}/${gid}`]: { type, amount: n, validHours: 0, note: String(note || '').slice(0, 80), ts: Date.now(), keep: true } };
  if (flag) upd[`leaderboard/${uid}/hasGrant`] = true;
  return upd;
}
export const cleanGift = g => {
  const type = String(g?.type || '');
  const amount = Math.round(Number(g?.amount) || 0);
  return GIFT_CAPS[type] && amount > 0 ? { type, amount: Math.min(GIFT_CAPS[type], amount) } : null;
};
/** Taklif marralari: [{count, type, amount}] — tartiblanadi, noto'g'rilari tashlanadi */
export const cleanMilestones = arr =>
  (Array.isArray(arr) ? arr : Object.values(arr || {}))
    .map(m => ({ count: Math.round(Number(m?.count) || 0), ...(cleanGift(m) || {}) }))
    .filter(m => m.count > 0 && m.type)
    .sort((a, b) => a.count - b.count)
    .slice(0, 8);
export const DEFAULT_REF_MILESTONES = [
  { count: 3, type: 'spins', amount: 2 },
  { count: 5, type: 'vip', amount: 24 },
  { count: 10, type: 'vip', amount: 72 },
  { count: 25, type: 'vip', amount: 168 },
];
export const DEFAULT_REF_FRIEND_TEXT = "🎁 Xush kelibsiz, {name}! Siz do'stingiz taklifi bilan keldingiz — sizga <b>{gift}</b> sovg'a tayyor.\n\nIlovani oching, sovg'a avtomatik qo'shiladi 👇";
export const DEFAULT_REF_MILESTONE_TEXT = "🏆 <b>{count} ta do'st</b> marrasi! Qo'shimcha sovg'a: <b>{gift}</b> 🎁";

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
    upd[`grants/${refUid}/${gid}`] = { type: 'xp', amount: xp, validHours: 0, note: `Do'st taklif qilindi: ${fname}`.slice(0, 80), ts: Date.now(), keep: true };
    upd[`leaderboard/${refUid}/hasGrant`] = true;
  }
  upd[`leaderboard/${refUid}/refs`] = count;

  // v11: taklif marrasi (3/5/10/25... do'st) — taklif qiluvchiga qo'shimcha sovg'a
  const milestones = cfg.milestones === undefined ? DEFAULT_REF_MILESTONES : cleanMilestones(cfg.milestones);
  const ms = milestones.find(m => m.count === count);
  const nextMs = milestones.find(m => m.count > count);
  if (ms) Object.assign(upd, grantUpdates(refUid, { ...ms, note: `${count} ta do'st marrasi` }, { flag: true }));

  // v11: ikki tomonlama bonus — taklif qilingan do'st ham birinchi kirishda sovg'a oladi (ilova ochilganda o'zi qo'shiladi)
  const friendSpins = clampInt(cfg.friendSpins, 0, 50, 1);
  const friendXp = clampInt(cfg.friendXp, 0, 100000, 0);
  const fGifts = [];
  if (friendSpins > 0) fGifts.push({ type: 'spins', amount: friendSpins });
  if (friendXp > 0) fGifts.push({ type: 'xp', amount: friendXp });
  // Do'st ilovada allaqachon bo'lsa (reytingda yozuvi bor) — hasGrant bayrog'i bilan; bo'lmasa ilova birinchi ochilganda o'zi oladi
  const friendInApp = fGifts.length ? !!(await db('GET', `leaderboard/tg_${fid}/ts`).catch(() => null)) : false;
  for (const g of fGifts) Object.assign(upd, grantUpdates(`tg_${fid}`, { ...g, note: 'Xush kelibsiz bonusi' }, { flag: friendInApp }));

  await db('PATCH', '', upd);
  db('PATCH', `tgusers/${fid}`, { ref: String(refId) }).catch(() => {});
  const tpl = String(cfg.notifyText || DEFAULT_REF_NOTIFY);
  let msg = tpl.replace(/\{name\}/gi, escHtml(fname)).replace(/\{xp\}/gi, String(xp)).replace(/\{count\}/gi, String(count));
  if (ms) msg += '\n\n' + fillTpl(cfg.milestoneText || DEFAULT_REF_MILESTONE_TEXT, { count, gift: giftText(ms.type, ms.amount) });
  if (nextMs) msg += `\n\n🎯 Keyingi marra: <b>${nextMs.count} ta do'st</b> — ${giftText(nextMs.type, nextMs.amount)}`;
  try {
    await sendMessage(token, Number(refId), msg, openAppMarkup('🚀 VocaBoostni ochish'));
  } catch {
    /* taklif qiluvchi botni bloklagan bo'lishi mumkin — sovg'alar baribir berilgan */
  }
  if (fGifts.length) {
    try {
      const gift = fGifts.map(g => giftText(g.type, g.amount)).join(' + ');
      await sendMessage(token, Number(fid), fillTpl(cfg.friendText || DEFAULT_REF_FRIEND_TEXT, { name: fname, gift }), openAppMarkup("🎁 Sovg'ani olish"));
    } catch {
      /* do'st xabarni olmasa ham sovg'a ilova ochilganda qo'shiladi */
    }
  }
  return { count, xp };
}
