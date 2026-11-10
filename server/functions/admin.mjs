// Admin API (Vercel funksiyasi). Admin kodi va baza siri FAQAT server muhit o'zgaruvchilarida saqlanadi.
// Vercel > Settings > Environment Variables:
//   ADMIN_CODE            — admin panelga kirish kodi
//   FIREBASE_DB_URL       — https://<project>-default-rtdb.firebaseio.com
//   FIREBASE_DB_SECRET    — Realtime Database "Database secret" (Project settings > Service accounts > Database secrets)
import { timingSafeEqual } from 'node:crypto';
import { verifyInitData, tgApi, sendMessage, sendPhoto, openAppMarkup, makeStartMarkup, makeCustomButtonsMarkup, cleanStyle, escHtml, siteUrl, issueCertificate, statsFromLb, notifyGift, CERT_TPLS, DEFAULT_START_TEXT, DEFAULT_START_BUTTON, tashkentDay, tashkentNow, cleanSegment, inSegment } from '../lib/tg.mjs';

import { finishWeek } from '../lib/week.mjs';

const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const safeEq = (a, b) => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
};

/** Sovg'a nomi (bot xabarida ko'rinadi). Mahsulot nomini admin panel yuboradi; bo'lmasa umumiy nom */
const giftLabel = (type, n, itemId) =>
  type === 'spins' ? `${n} ta baraban aylantirish` : type === 'vip' ? `${n} soatlik VIP` : type === 'xp' ? `${n} XP` : type === 'coins' ? `${Number(n).toLocaleString('en-US').replace(/,/g, ' ')} tanga` : `Do'kon mahsuloti (${itemId})`;

const newGid = () => 'g' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
const ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;
const DATE_RE = /^(\d{4}-\d{2}-\d{2}|default)$/;

// IP bo'yicha noto'g'ri urinishlarni bloklash (Brute-force himoyasi)
const loginAttempts = new Map(); // ip -> { count, lockedUntil }

export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST kerak' });

  const { ADMIN_CODE, FIREBASE_DB_URL, FIREBASE_DB_SECRET } = process.env;
  if (!ADMIN_CODE || !FIREBASE_DB_URL || !FIREBASE_DB_SECRET) {
    return json(500, { error: "Server sozlanmagan: ADMIN_CODE, FIREBASE_DB_URL, FIREBASE_DB_SECRET muhit o'zgaruvchilarini kiriting." });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: "Noto'g'ri so'rov" });
  }

  const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || event.headers['client-ip'] || 'unknown';
  const now = Date.now();
  const attempt = loginAttempts.get(clientIp);

  const PUBLIC_ACTIONS = new Set(['claimPromo', 'submitRating', 'submitSurvey', 'getActiveSurvey', 'track']);
  if (!PUBLIC_ACTIONS.has(body.action)) {
    if (attempt && attempt.lockedUntil > now) {
      const minsLeft = Math.ceil((attempt.lockedUntil - now) / 60000);
      return json(429, { error: `Ko'p xato urinishlar! Iltimos, ${minsLeft} daqiqadan so'ng qayta urinib ko'ring.` });
    }

    if (!safeEq(body.code || '', ADMIN_CODE)) {
      const curCount = (attempt?.count || 0) + 1;
      if (curCount >= 5) {
        loginAttempts.set(clientIp, { count: curCount, lockedUntil: now + 15 * 60 * 1000 });
        return json(429, { error: "Xavfsizlik: 5 marta xato kod kiritildi. Tizim 15 daqiqaga bloklandi." });
      } else {
        loginAttempts.set(clientIp, { count: curCount, lockedUntil: 0 });
      }
      await new Promise(r => setTimeout(r, 1000));
      return json(401, { error: `Admin kodi noto'g'ri (${5 - curCount} ta urinish qoldi)` });
    }

    // To'g'ri kod kiritilganda hisoblagichni tozalaymiz
    loginAttempts.delete(clientIp);
  }

  const DB = FIREBASE_DB_URL.replace(/\/$/, '');
  const call = async (method, path, data) => {
    const res = await fetch(`${DB}/${path}.json?auth=${encodeURIComponent(FIREBASE_DB_SECRET)}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB xatosi ${res.status}`);
    return res.json();
  };

  // Foydalanuvchi reyting yozuviga «sovg'a bor» bayrog'i (yozuv mavjud bo'lsagina; bo'sh yozuv yaratilmaydi)
  const flagGrant = async uid => {
    try {
      if (await call('GET', `leaderboard/${uid}/ts`)) await call('PATCH', `leaderboard/${uid}`, { hasGrant: true });
    } catch { /* bayroq muhim emas: ilova birinchi ochilishda baribir tekshiradi */ }
  };

  // To'plamni bazaga yozadi (savePack va savePackBatch ishlatadi). skipVersion — ko'p to'plam saqlanganda versiyani oxirida bir marta yangilash uchun
  const savePackCore = async (body, skipVersion = false) => {
    const str = (v, n) => String(v ?? '').trim().slice(0, n);
    const title = str(body.title, 80);
    if (!title) throw new Error("To'plam nomini kiriting");
    const kind = body.kind === 'daily' ? 'daily' : body.kind === 'topic' ? 'topic' : 'open';
    const packLevel = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(body.level) ? body.level : ''; // bo'sh — hamma darajaga
    const date = str(body.date, 10);
    if (kind !== 'open' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Kunlik to'plam / maxsus mavzu uchun sanani tanlang");
    const packId = ID_RE.test(body.id || '') ? body.id : 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    const list = Array.isArray(body.words) ? body.words.slice(0, 500) : [];
    const slug = t => String(t).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    const arrOf = v => (Array.isArray(v) ? v : String(v ?? '').split('|')).map(x => str(x, 80)).filter(Boolean).slice(0, 8);
    const words = {};
    const errors = [];
    list.forEach((w, i) => {
      const en = str(w.en, 60), uz = str(w.uz, 120);
      if (!en || !uz) return errors.push(`${i + 1}-qator: inglizcha so'z va o'zbekcha ma'no kerak`);
      let id = `p_${packId}_${slug(en) || i}`;
      if (words[id]) id += `_${i}`;
      words[id] = {
        en, uz, ipa: str(w.ipa, 60), pos: str(w.pos, 20), ex: str(w.ex, 220), exUz: str(w.exUz, 260),
        col: arrOf(w.col), fam: arrOf(w.fam), hook: str(w.hook, 260), topic: str(w.topic, 40),
        level: packLevel || (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(String(w.level).trim().toUpperCase()) ? String(w.level).trim().toUpperCase() : (String(w.level).trim() === 'B2+' ? 'B2' : 'B1')), order: i, published: true,
      };
    });
    const prev = await call('GET', `packs/${packId}/createdAt`);
    const meta = {
      title, desc: str(body.desc, 240), kind, date: kind !== 'open' ? date : '', mode: body.mode === 'extra' ? 'extra' : 'replace', level: packLevel,
      order: Number.isFinite(Number(body.order)) ? Number(body.order) : 0, published: body.published !== false, createdAt: prev || Date.now(),
    };
    if (list.length) {
      if (!Object.keys(words).length) throw new Error(errors.slice(0, 5).join('; ') || "So'zlar topilmadi");
      await call('PUT', `packs/${packId}`, { ...meta, words });
    } else {
      if (!prev) throw new Error("Kamida bitta so'z kiriting");
      await call('PATCH', `packs/${packId}`, meta); // so'zlar o'zgarmaydi, faqat sozlamalar
    }
    if (!skipVersion) await call('PUT', 'config/packsVersion', Date.now());
    return { id: packId, saved: Object.keys(words).length, errors };
  };

  try {
    switch (body.action) {
      case 'ping':
        return json(200, { ok: true });

      case 'overview': {
        const [leaderboard, config] = await Promise.all([call('GET', 'leaderboard'), call('GET', 'config')]);
        return json(200, { leaderboard: leaderboard || {}, config: config || {} });
      }

      case 'setUser': {
        // patch: { name?, hidden?, deleted?, xp? (istalgan yangi ko'rinadigan XP) }
        const { id, patch = {} } = body;
        if (!ID_RE.test(id || '')) return json(400, { error: 'ID xato' });
        const upd = {};
        if (typeof patch.name === 'string') upd.name = patch.name.slice(0, 40);
        if (typeof patch.hidden === 'boolean') upd.hidden = patch.hidden;
        if (typeof patch.deleted === 'boolean') upd.deleted = patch.deleted;
        if (patch.xp !== undefined) {
          // XP «farq» (adj) sifatida yoziladi: foydalanuvchi ilovasi shu farqni o'z XP siga BIR MARTA qo'shadi.
          // Shundan keyin u yig'gan XP admin qo'ygan qiymatning ustiga qo'shiladi. Liga qiymati darhol yangilanadi.
          const want = Math.max(0, Math.min(10000000, Math.round(Number(patch.xp))));
          const cur = (await call('GET', `leaderboard/${id}`)) || {};
          const shown = Math.max(0, (Number(cur.xp) || 0) + (Number(cur.xpOffset) || 0));
          upd.adj = (Number(cur.adj) || 0) + (want - shown);
          upd.adjV = (Number(cur.adjV) || 0) + 1;
          upd.xp = want;
          upd.xpOffset = 0;
        }
        await call('PATCH', `leaderboard/${id}`, upd);
        return json(200, { ok: true });
      }

      case 'purgeUser': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        // Qayta paydo bo'lmasligi uchun "deleted" belgisi bilan qoldiriladi, ma'lumotlari tozalanadi
        await call('PUT', `leaderboard/${body.id}`, { name: 'deleted', xp: 0, deleted: true, ts: Date.now() });
        return json(200, { ok: true });
      }

      // Haftalik ligani yangilash: TOP-20 natijalari «Tarix zali»ga QOTIRIB saqlanadi (keyin o'zgarmaydi),
      // so'ngra hammaning liga XP si 0 ga tushiriladi va yangi hafta boshlanadi. TOP-20 ga bot orqali tabrik xabari boradi.
      // (Xuddi shu mantiq avtomatik cron `week-end` da ham ishlaydi — server/lib/week.mjs)
      case 'resetLeague': {
        try {
          const r = await finishWeek(call, {
            rewardSpins: !!body.rewardSpins, rewardCert: !!body.rewardCert, certFmt: body.certFmt,
            notify: body.notify !== false,
          });
          return json(200, { ok: true, ...r });
        } catch (e) {
          if (e.code === 'DUP') return json(400, { error: e.message });
          throw e;
        }
      }

      // Avtomatik yakunlash va tabrik xabari sozlamalari (config/league ichida; hafta raqamiga tegilmaydi)
      case 'setLeagueAuto': {
        const upd = {
          auto: !!body.auto,
          notify: body.notify !== false,
          rewardSpins: !!body.rewardSpins,
          rewardCert: !!body.rewardCert,
          certFmt: body.certFmt === 'wide' ? 'wide' : 'story',
          msgText: String(body.msgText || '').trim().slice(0, 1500),
          msgButton: String(body.msgButton || '').trim().slice(0, 40),
        };
        await call('PATCH', 'config/league', upd);
        return json(200, { ok: true });
      }

      // Haftalik tabrik xabarini bitta Telegram ID ga sinab ko'rish (admin o'ziga)
      case 'testWeekMsg': {
        const { notifyTop } = await import('../lib/week.mjs');
        const id = String(body.tgId || '').replace(/^tg_/, '');
        if (!/^\d{3,15}$/.test(id)) return json(400, { error: 'Telegram ID kiriting (faqat raqamlar)' });
        if (!process.env.BOT_TOKEN) return json(400, { error: 'BOT_TOKEN kiritilmagan' });
        const lg = (await call('GET', 'config/league')) || {};
        const r = await notifyTop(call, [{ uid: `tg_${id}`, e: { name: 'Sinov' }, xp: 2765 }].map((x, i) => ({ ...x })), Math.max(1, Number(lg.week) || 1), { text: String(body.msgText || '').trim() || lg.msgText, button: String(body.msgButton || '').trim() || lg.msgButton });
        return json(200, { ok: true, ...r });
      }

      // Tarix zali (admin ko'rishi uchun)
      case 'listHall': {
        const h = (await call('GET', 'hall')) || {};
        const items = Object.entries(h).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.week || 0) - (a.week || 0));
        const league = (await call('GET', 'config/league')) || {};
        return json(200, { items, league });
      }

      // ---------- Foydalanuvchilarning adminga xabarlari ----------
      case 'listMessages': {
        const m = (await call('GET', 'messages')) || {};
        const items = Object.entries(m).filter(([, v]) => v && v.text).map(([id, v]) => ({ id, ...v }));
        items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return json(200, { items: items.slice(0, 300), unread: items.filter(x => !x.read).length });
      }

      case 'markMessage': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        await call('PATCH', `messages/${body.id}`, { read: body.read !== false });
        return json(200, { ok: true });
      }

      case 'deleteMessage': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        await call('DELETE', `messages/${body.id}`);
        return json(200, { ok: true });
      }

      // Foydalanuvchiga bot orqali javob yozish
      case 'replyMessage': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        const text = String(body.text || '').trim().slice(0, 1500);
        if (!text) return json(400, { error: 'Javob matnini yozing' });
        const msg = await call('GET', `messages/${body.id}`);
        if (!msg) return json(404, { error: 'Xabar topilmadi' });
        let sent = false;
        if (process.env.BOT_TOKEN && /^tg_\d+$/.test(String(msg.uid || ''))) {
          try {
            await sendMessage(process.env.BOT_TOKEN, Number(msg.uid.slice(3)), `✉️ Admin javobi:\n\n${text}`, openAppMarkup(), null);
            sent = true;
          } catch (e) {
            return json(502, { error: `Telegram: ${e.message} (foydalanuvchi botga Start bosmagan bo'lishi mumkin)` });
          }
        }
        await call('PATCH', `messages/${body.id}`, { read: true, reply: text, repliedAt: Date.now() });
        return json(200, { ok: true, sent });
      }

      case 'setDaily': {
        const { date, quests, grammar } = body;
        if (!DATE_RE.test(date || '')) return json(400, { error: 'Sana xato' });
        const data = {};
        if (Array.isArray(quests)) {
          if (quests.length !== 3) return json(400, { error: '3 ta missiya tanlang' });
          data.quests = quests.map(q => String(q).slice(0, 40));
        }
        if (grammar && typeof grammar === 'object') {
          const opts = Array.isArray(grammar.options) ? grammar.options.map(o => String(o).slice(0, 120)).filter(Boolean) : [];
          if (!grammar.question || opts.length < 2) return json(400, { error: 'Savol va kamida 2 ta variant kerak' });
          data.grammar = {
            title: String(grammar.title || 'Kunlik Grammatika').slice(0, 120),
            ruleUz: String(grammar.ruleUz || '').slice(0, 600),
            question: String(grammar.question).slice(0, 300),
            options: opts,
            correct: Math.min(opts.length - 1, Math.max(0, Number(grammar.correct) || 0)),
            explanation: String(grammar.explanation || '').slice(0, 400),
          };
        }
        await call('PATCH', `config/daily/${date}`, data);
        return json(200, { ok: true });
      }

      case 'clearDaily': {
        if (!DATE_RE.test(body.date || '')) return json(400, { error: 'Sana xato' });
        await call('DELETE', `config/daily/${body.date}`);
        return json(200, { ok: true });
      }

      // ---------- So'zlar banki ----------
      case 'listWords': {
        const w = (await call('GET', 'words')) || {};
        const items = Object.entries(w).map(([id, v]) => ({ id, ...v }));
        items.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
        return json(200, { items, version: (await call('GET', 'config/wordsVersion')) || 0 });
      }

      case 'saveWords': {
        const list = Array.isArray(body.words) ? body.words.slice(0, 300) : [];
        if (!list.length) return json(400, { error: "So'zlar ro'yxati bo'sh" });
        const slug = t => String(t).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
        const str = (v, n) => String(v ?? '').trim().slice(0, n);
        const arrOf = v => (Array.isArray(v) ? v : String(v ?? '').split('|')).map(x => str(x, 80)).filter(Boolean).slice(0, 8);
        const upd = {};
        const errors = [];
        const LV = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        const normLv = v => { const t = String(v ?? '').trim().toUpperCase(); const x = t === 'B2+' ? 'B2' : t; return LV.includes(x) ? x : 'B1'; };
        // Mavjud so'zlar: bir xil inglizcha so'z boshqa darajada bo'lsa, u o'chib/ko'chib ketmasligi uchun alohida yozuv ochiladi
        const existing = (await call('GET', 'words')) || {};
        const levelAt = k => (upd[k] ? upd[k].level : existing[k] ? normLv(existing[k].level) : null);
        list.forEach((w, i) => {
          const en = str(w.en, 60), uz = str(w.uz, 120);
          if (!en || !uz) return errors.push(`${i + 1}-qator: inglizcha so'z va o'zbekcha ma'no kerak`);
          const lv = normLv(w.level);
          let id = ID_RE.test(w.id || '') ? w.id : slug(en);
          if (!id) return errors.push(`${i + 1}-qator: so'z noto'g'ri`);
          if (!ID_RE.test(w.id || '') && levelAt(id) && levelAt(id) !== lv) {
            id = `${slug(en)}-${lv.toLowerCase()}`.slice(0, 60);
          }
          upd[id] = {
            en, uz,
            ipa: str(w.ipa, 60), pos: str(w.pos, 20),
            ex: str(w.ex, 220), exUz: str(w.exUz, 260),
            col: arrOf(w.col), fam: arrOf(w.fam),
            hook: str(w.hook, 260), topic: str(w.topic, 40),
            level: lv,
            order: Number.isFinite(Number(w.order)) ? Number(w.order) : 100000 + i,
            published: w.published !== false,
          };
        });
        if (errors.length && !Object.keys(upd).length) return json(400, { error: errors.slice(0, 5).join('; ') });
        await call('PATCH', 'words', upd);
        await call('PUT', 'config/wordsVersion', Date.now());
        return json(200, { ok: true, saved: Object.keys(upd).length, errors });
      }

      case 'setWordPublished': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        await call('PATCH', `words/${body.id}`, { published: !!body.published });
        await call('PUT', 'config/wordsVersion', Date.now());
        return json(200, { ok: true });
      }

      case 'deleteWord': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        await call('DELETE', `words/${body.id}`);
        await call('PUT', 'config/wordsVersion', Date.now());
        return json(200, { ok: true });
      }

      // ---------- Daraja ikonkalari (admin rasm yuklaydi; brauzer 96x96 ga kichraytirib yuboradi) ----------
      case 'setLevelIcon': {
        const lvl = String(body.level || '');
        if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(lvl)) return json(400, { error: 'Daraja xato' });
        const key = lvl.replace('+', 'plus');
        const img = String(body.image || '');
        if (!img) {
          await call('DELETE', `config/levelIcons/${key}`);
          return json(200, { ok: true, removed: true });
        }
        if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 60000) return json(400, { error: 'Rasm noto\'g\'ri yoki juda katta (PNG/JPG/WEBP, kichik hajmda)' });
        await call('PUT', `config/levelIcons/${key}`, img);
        return json(200, { ok: true });
      }

      // ---------- O'yinlar / baraban / umumiy sozlamalar ----------
      case 'setConfig': {
        const key = body.key;
        if (!['games', 'wheel', 'settings', 'reminder', 'shop'].includes(key)) return json(400, { error: 'Kalit xato' });
        const v = body.value;
        if (!v || typeof v !== 'object' || JSON.stringify(v).length > 40000) return json(400, { error: "Qiymat noto'g'ri yoki juda katta" });
        if (key === 'shop') {
          // Pastki menyu nishonlari (O'yinlar / Do'kon). Faqat navBadges yoziladi; do'kon sozlamalari (setShop) buzilmaydi.
          const nb = v.navBadges && typeof v.navBadges === 'object' ? v.navBadges : {};
          const clean = { games: String(nb.games || '').trim().slice(0, 12), shop: String(nb.shop || '').trim().slice(0, 12) };
          await call('PUT', 'config/shop/navBadges', clean);
          return json(200, { ok: true });
        }
        if (key === 'wheel') {
          const prizes = Array.isArray(v.prizes) ? v.prizes : [];
          const active = prizes.filter(p => p && p.enabled !== false && Number(p.weight) > 0);
          if (active.length < 2 || prizes.length > 10) return json(400, { error: 'Kamida 2 ta faol sovrin kerak (ko\'pi bilan 10 ta)' });
        }
        if (key === 'reminder') {
          // lastDay saqlanib qoladi (PATCH), shuning uchun bir kunda ikki marta yuborilmaydi
          const texts = (Array.isArray(v.texts) ? v.texts : []).map(t => String(t || '').trim().slice(0, 1000)).filter(Boolean).slice(0, 30);
          await call('PATCH', 'config/reminder', {
            enabled: !!v.enabled,
            hour: Math.min(23, Math.max(0, Math.round(Number(v.hour)) || 0)),
            texts,
            skipActive: v.skipActive !== false,
          });
          return json(200, { ok: true });
        }
        if (key === 'wheel') {
          // VIP foizi: bo'sh = og'irlik bo'yicha, aks holda 0–100 oralig'ida aniq foiz
          const raw = v.vipPercent;
          v.vipPercent = raw === null || raw === undefined || raw === '' || !Number.isFinite(Number(raw)) ? null : Math.min(100, Math.max(0, Math.round(Number(raw) * 10) / 10));
        }
        await call('PUT', `config/${key}`, v);
        return json(200, { ok: true });
      }

      // ---------- Foydalanuvchilar (onboarding javoblari: daraja va kunlik so'z soni) ----------
      case 'users': {
        const [lb, tgu] = await Promise.all([call('GET', 'leaderboard'), call('GET', 'tgusers')]);
        return json(200, { leaderboard: lb || {}, tgusers: tgu || {} });
      }

      // ---------- Bot: xabar yuborish ----------
      case 'broadcast': {
        const text = String(body.text || '').trim().slice(0, 3500);
        if (!text) return json(400, { error: 'Xabar matnini yozing' });
        if (!process.env.BOT_TOKEN) return json(400, { error: 'Vercel muhitida BOT_TOKEN kiritilmagan' });
        const base = siteUrl();
        if (!base) return json(400, { error: 'SITE_URL aniqlanmadi (Vercel muhitida SITE_URL kiriting)' });
        const r = await fetch(`${base}/api/fn/broadcast-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: ADMIN_CODE, text, kind: 'manual' }),
        });
        if (r.status !== 202 && !r.ok) return json(502, { error: `Yuborishni boshlab bo'lmadi (${r.status})` });
        return json(200, { ok: true });
      }

      case 'broadcastStatus': {
        return json(200, { status: (await call('GET', 'adminState/broadcast')) || null });
      }

      case 'testSend': {
        const text = String(body.text || '').trim().slice(0, 3500);
        const id = String(body.userId || '').replace(/^tg_/, '');
        if (!text || !/^\d{3,15}$/.test(id)) return json(400, { error: 'Telegram ID va matn kerak' });
        if (!process.env.BOT_TOKEN) return json(400, { error: 'BOT_TOKEN kiritilmagan' });
        try {
          await sendMessage(process.env.BOT_TOKEN, Number(id), text.replace(/\{name\}/gi, 'Do\'st'), openAppMarkup());
        } catch (e) {
          return json(502, { error: `Telegram: ${e.message}` });
        }
        return json(200, { ok: true });
      }

      // ---------- Reklama: statistika va yuborish ----------
      // Tanlangan segmentga (daraja / necha kundan beri kirmagan / streak) nechta foydalanuvchi tushishini hisoblaydi
      case 'segmentCount': {
        const seg = cleanSegment(body.segment);
        const [lb, tgu] = await Promise.all([call('GET', 'leaderboard'), call('GET', 'tgusers')]);
        let n = 0, all = 0;
        for (const [id, u] of Object.entries(tgu || {})) {
          if (!u || u.blocked) continue;
          all++;
          if (inSegment(seg, u, (lb || {})[`tg_${id}`])) n++;
        }
        return json(200, { count: n, total: all, segment: seg });
      }

      case 'adStats': {
        const [lb, tgu, bcast] = await Promise.all([call('GET', 'leaderboard'), call('GET', 'tgusers'), call('GET', 'adminState/broadcast')]);
        const tgList = Object.entries(tgu || {});
        const totalTgUsers = tgList.length;
        const blockedUsers = tgList.filter(([, u]) => u && u.blocked).length;
        const eligibleUsers = Math.max(0, totalTgUsers - blockedUsers);
        const sevenDaysAgo = Date.now() - 7 * 86400 * 1000;
        const activeUsers = tgList.filter(([id, u]) => {
          if (u && u.blocked) return false;
          const lastTs = Number(lb?.[`tg_${id}`]?.ts || u?.lastSeen || 0);
          return lastTs >= sevenDaysAgo;
        }).length;
        const passiveUsers = Math.max(0, eligibleUsers - activeUsers);
        return json(200, {
          totalTgUsers,
          blockedUsers,
          eligibleUsers,
          activeUsers,
          passiveUsers,
          lastBroadcast: bcast || null,
        });
      }

      case 'sendAd': {
        const text = String(body.text || '').trim();
        if (!text) return json(400, { error: 'Reklama matnini yozing' });
        if (!process.env.BOT_TOKEN) return json(400, { error: 'Vercel muhitida BOT_TOKEN kiritilmagan' });
        const photoUrl = body.photoUrl ? String(body.photoUrl).trim() : null;
        const buttons = Array.isArray(body.buttons) ? body.buttons.filter(b => b && b.text && b.url) : [];
        const isTest = !!body.isTest;
        const testTgId = String(body.testTgId || '').replace(/^tg_/, '').trim();

        if (isTest) {
          if (!/^\d{3,15}$/.test(testTgId)) return json(400, { error: 'Sinov uchun to‘g‘ri Telegram ID kiriting' });
          const markup = makeCustomButtonsMarkup(buttons);
          try {
            if (photoUrl) {
              await sendPhoto(process.env.BOT_TOKEN, Number(testTgId), photoUrl, text, markup, 'HTML');
            } else {
              await sendMessage(process.env.BOT_TOKEN, Number(testTgId), text, markup, 'HTML');
            }
          } catch (e) {
            return json(502, { error: `Telegram: ${e.message}` });
          }
          return json(200, { ok: true, isTest: true });
        }

        const base = siteUrl();
        if (!base) return json(400, { error: 'SITE_URL aniqlanmadi' });
        const r = await fetch(`${base}/api/fn/broadcast-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: ADMIN_CODE,
            text,
            photoUrl,
            buttons,
            customButtonsOnly: true,
            kind: 'ad',
            parseMode: 'HTML',
            segment: cleanSegment(body.segment),
          }),
        });
        if (r.status !== 202 && !r.ok) return json(502, { error: `Reklama yuborishni boshlab bo'lmadi (${r.status})` });
        return json(200, { ok: true });
      }

      case 'botInfo': {
        if (!process.env.BOT_TOKEN) return json(200, { configured: false });
        try {
          const me = await tgApi(process.env.BOT_TOKEN, 'getMe', {});
          return json(200, { configured: true, username: me.username, site: siteUrl() });
        } catch (e) {
          return json(200, { configured: true, error: String(e.message || e) });
        }
      }

      // ---------- Sertifikatlar ----------
      case 'sendCertificate': {
        // Sarlavha (title) — «Yutuq yoki natija» qatori, Izoh (reason) — uning ostidagi qisqa izoh
        const { userId, tpl, title, reason, name } = body;
        if (!ID_RE.test(userId || '')) return json(400, { error: 'Foydalanuvchi ID xato' });
        const t = String(title || '').trim().slice(0, 100);
        if (!t) return json(400, { error: 'Sertifikat sarlavhasi kerak' });
        const user = await call('GET', `leaderboard/${userId}`);
        const issued = await issueCertificate(call, {
          userId,
          tpl,
          title: t,
          reason: String(reason || '').trim().slice(0, 200),
          name: String(name || user?.name || "O'quvchi").trim().slice(0, 40),
          fmt: body.fmt === 'story' ? 'story' : 'wide', // admin tanlaydi: 9:16 yoki 16:9
          stats: statsFromLb(user),
        });
        const id = issued.id;
        // Telegram foydalanuvchisiga bot orqali xabar (rasm esa ilova ochilganda avtomatik yuboriladi)
        let notified = false;
        if (process.env.BOT_TOKEN && /^tg_\d+$/.test(userId)) {
          try {
            await notifyGift(process.env.BOT_TOKEN, Number(userId.slice(3)), { name: String(name || user?.name || '').trim(), gift: t, id, kind: 'cert', text: body.text });
            notified = true;
          } catch {
            /* foydalanuvchi botni boshlamagan yoki bloklagan bo'lishi mumkin */
          }
        }
        return json(200, { ok: true, id, notified, url: `${siteUrl()}/c/${id}` });
      }

      // Avtomatik (so'z bosqichi) sertifikatlar matni: {n} — so'zlar soni
      case 'setCertText': {
        const TPL = ['bronze', 'silver', 'gold', 'platinum', 'champion'];
        const v = body.value && typeof body.value === 'object' ? body.value : {};
        const out = {};
        for (const k of TPL) {
          const x = v[k] || {};
          out[k] = { title: String(x.title || '').trim().slice(0, 100), reason: String(x.reason || '').trim().slice(0, 200) };
        }
        await call('PUT', 'config/certText', out);
        return json(200, { ok: true });
      }

      case 'revokeCertificate': {
        if (!ID_RE.test(body.userId || '') || !ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        await call('DELETE', `certs/${body.userId}/${body.id}`);
        await call('DELETE', `certIndex/${body.id}`);
        return json(200, { ok: true });
      }

      case 'verifyCertificate': {
        const id = String(body.id || '').trim().toUpperCase();
        if (!ID_RE.test(id)) return json(400, { error: 'Raqam xato' });
        const idx = await call('GET', `certIndex/${id}`);
        if (!idx) return json(200, { found: false });
        const cert = await call('GET', `certs/${idx.userId}/${id}`);
        return json(200, { found: !!cert, cert: cert ? { id, userId: idx.userId, ...cert } : null });
      }

      case 'listCerts': {
        const all = (await call('GET', 'certs')) || {};
        const items = [];
        for (const [userId, certs] of Object.entries(all)) for (const [id, c] of Object.entries(certs || {})) items.push({ id, userId, ...c });
        items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return json(200, { items });
      }

      // ---------- Sovg'alar ----------
      case 'grant': {
        // type: spins | vip | xp | coins | item.  Qabul qiluvchi: userId (bitta) yoki audience: 'all' | 'referrers' (minRefs)
        const { userId, type, amount, note } = body;
        if (!['spins', 'vip', 'xp', 'coins', 'item'].includes(type)) return json(400, { error: 'Tur xato' });
        const itemId = String(body.itemId || '').trim().slice(0, 64);
        if (type === 'item' && !ID_RE.test(itemId)) return json(400, { error: 'Mahsulot ID xato' });
        const n = type === 'item' ? 1 : Math.round(Number(amount));
        const cap = type === 'xp' ? 100000 : type === 'vip' ? 720 : type === 'coins' ? 100000000 : type === 'item' ? 1 : 50;
        if (!(n > 0) || n > cap) return json(400, { error: 'Miqdor noto\'g\'ri' });
        const validHours = type === 'spins' ? Math.max(0, Math.min(24 * 60, Math.round(Number(body.validHours ?? 24) || 0))) : 0;
        let targets = [];
        if (body.audience === 'all' || body.audience === 'referrers') {
          const lb = (await call('GET', 'leaderboard')) || {};
          const minRefs = Math.max(1, Math.round(Number(body.minRefs) || 1));
          targets = Object.entries(lb).filter(([, e]) => e && !e.deleted && e.ts && (body.audience === 'all' || (Number(e.refs) || 0) >= minRefs)).map(([id]) => id);
          if (!targets.length) return json(400, { error: 'Mos foydalanuvchi topilmadi' });
          if (targets.length > 5000) return json(400, { error: 'Juda ko\'p qabul qiluvchi (5000 tagacha)' });
        } else {
          if (!ID_RE.test(userId || '')) return json(400, { error: 'Foydalanuvchi ID xato' });
          targets = [userId];
        }
        const ts = Date.now();
        const notify = body.notify !== false && !!process.env.BOT_TOKEN; // botga «sovg'a berildi» xabari (standart: yoqilgan)
        const giftName = String(body.giftName || '').trim().slice(0, 100) || giftLabel(type, n, itemId);
        // Bitta so'rovda ko'p yo'lni yangilash (Firebase multi-path update) — tez va arzon
        for (let i = 0; i < targets.length; i += 200) {
          const upd = {};
          targets.slice(i, i + 200).forEach(uid => {
            upd[`grants/${uid}/${newGid()}`] = { type, amount: n, validHours, ...(type === 'item' ? { itemId } : {}), note: String(note || '').slice(0, 80), ts, keep: true };
            upd[`leaderboard/${uid}/hasGrant`] = true;
          });
          if (targets.length === 1 && !(await call('GET', `leaderboard/${targets[0]}/ts`))) {
            const only = Object.keys(upd).filter(k => k.startsWith('grants/'));
            const u2 = {}; only.forEach(k => (u2[k] = upd[k]));
            await call('PATCH', '', u2); // reyting yozuvi yo'q: bo'sh yozuv yaratilmaydi
          } else await call('PATCH', '', upd);
        }
        // Bot xabari: bitta foydalanuvchiga darhol; ko'pchilikka — admin panel `giftNotify` ni bo'laklab chaqiradi (Vercel vaqt chegarasi uchun)
        let notified = false;
        let ids = [];
        if (notify) {
          const tgIds = targets.filter(u => /^tg_\d+$/.test(u)).map(u => u.slice(3));
          if (targets.length === 1 && tgIds.length === 1) {
            const [tu, lbu] = await Promise.all([call('GET', `tgusers/${tgIds[0]}`).catch(() => null), call('GET', `leaderboard/${targets[0]}/name`).catch(() => null)]);
            if (!tu?.blocked) {
              try {
                await notifyGift(process.env.BOT_TOKEN, Number(tgIds[0]), { name: String(lbu || tu?.name || ''), gift: giftName, text: body.text });
                notified = true;
              } catch { /* bot yozolmaydi */ }
            }
          } else ids = tgIds;
        }
        return json(200, { ok: true, count: targets.length, notified, ids });
      }

      // Faqat bot xabarini yuboradi (sovg'a allaqachon berilgan): admin panel ro'yxatni 30 tadan bo'lib chaqiradi
      case 'giftNotify': {
        if (!process.env.BOT_TOKEN) return json(400, { error: 'BOT_TOKEN kiritilmagan' });
        const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(x => String(x).replace(/^tg_/, '')).filter(x => /^\d{3,15}$/.test(x)))].slice(0, 30);
        const giftName = String(body.giftName || '').trim().slice(0, 100);
        if (!ids.length || !giftName) return json(400, { error: 'Qabul qiluvchi va sovg\'a nomi kerak' });
        const r = { sent: 0, blocked: 0, failed: 0 };
        for (const id of ids) {
          const u = (await call('GET', `tgusers/${id}`).catch(() => null)) || {};
          if (u.blocked) { r.blocked++; continue; }
          try {
            await notifyGift(process.env.BOT_TOKEN, Number(id), { name: u.name, gift: giftName, text: body.text });
            r.sent++;
          } catch (e) {
            if (e.code === 403 || /blocked|deactivated|chat not found/i.test(String(e.message))) { r.blocked++; await call('PATCH', `tgusers/${id}`, { blocked: true }).catch(() => {}); } else r.failed++;
          }
          await new Promise(r2 => setTimeout(r2, 40));
        }
        return json(200, { ok: true, ...r });
      }

      // ---------- Botga /start bosgan, lekin ilovaga HECH QACHON kirmaganlar ----------
      // Mezon: reytingda (leaderboard) yozuvi yo'q va ilova `register` qilmagan (tgusers.lastSeen yo'q). Bloklaganlarga xabar yetmaydi, shuning uchun alohida sanaladi.
      case 'giftAudience': {
        const [tgu, lb] = await Promise.all([call('GET', 'tgusers'), call('GET', 'leaderboard')]);
        const items = [];
        let total = 0;
        let blocked = 0;
        let giftedCount = 0;
        for (const [id, u] of Object.entries(tgu || {})) {
          if (!u || typeof u !== 'object' || !/^\d{3,15}$/.test(id)) continue;
          const e = lb?.[`tg_${id}`];
          if ((e && e.ts) || u.lastSeen) continue; // ilovaga kirgan
          total++;
          if (u.blocked) { blocked++; continue; }
          const hasGift = !!u.giftGiven || !!u.hasGift;
          if (hasGift) giftedCount++;
          items.push({
            id,
            name: String(u.name || ''),
            username: String(u.username || ''),
            joined: Number(u.joined || u.ts) || 0,
            hasGift,
            giftTime: u.giftTime || null,
            giftName: u.giftName || '',
          });
        }
        items.sort((a, b) => b.joined - a.joined);
        return json(200, { items: items.slice(0, 5000), total, blocked, giftedCount, unGiftedCount: items.length - giftedCount, truncated: items.length > 5000 });
      }

      // Tanlangan (yoki hamma) foydalanuvchilarga sovg'a yoki sertifikat + bot xabari. Admin panel ro'yxatni bo'laklab chaqiradi.
      // `cid` — yuborish kampaniyasi ID si: qayta urinishda bir kishiga ikki marta berilmaydi (adminState/gifts/<cid>/<tgId>).
      case 'giftSend': {
        const token = process.env.BOT_TOKEN;
        const notify = body.notify !== false; // Admin belgilaydi: telegram bot orqali xabar borishi kerakmi yoki yo'q
        if (notify && !token) return json(400, { error: 'BOT_TOKEN kiritilmagan' });
        const cid = String(body.cid || '');
        if (!/^[A-Za-z0-9_\-]{6,40}$/.test(cid)) return json(400, { error: 'Kampaniya ID xato' });
        const g = body.gift && typeof body.gift === 'object' ? body.gift : {};
        const isCert = g.kind === 'cert';
        let spec;
        if (isCert) {
          const title = String(g.title || '').trim().slice(0, 100);
          if (!title) return json(400, { error: 'Sertifikat sarlavhasi kerak' });
          spec = { title, reason: String(g.reason || '').trim().slice(0, 200), tpl: CERT_TPLS.includes(g.tpl) ? g.tpl : 'gold', fmt: g.fmt === 'story' ? 'story' : 'wide' };
        } else {
          const type = String(g.type || '');
          if (!['spins', 'vip', 'xp', 'coins', 'item'].includes(type)) return json(400, { error: 'Tur xato' });
          const itemId = String(g.itemId || '').trim().slice(0, 64);
          if (type === 'item' && !ID_RE.test(itemId)) return json(400, { error: 'Mahsulot ID xato' });
          const n = type === 'item' ? 1 : Math.round(Number(g.amount));
          const cap = type === 'xp' ? 100000 : type === 'vip' ? 720 : type === 'coins' ? 100000000 : type === 'item' ? 1 : 50;
          if (!(n > 0) || n > cap) return json(400, { error: "Miqdor noto'g'ri" });
          spec = { type, amount: n, itemId, validHours: type === 'spins' ? Math.max(0, Math.min(24 * 60, Math.round(Number(g.validHours ?? 24) || 0))) : 0 };
        }
        const giftName = String(body.giftName || '').trim().slice(0, 100) || (isCert ? spec.title : giftLabel(spec.type, spec.amount, spec.itemId));
        const text = String(body.text || '').trim().slice(0, 1500);
        const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(x => String(x).replace(/^tg_/, '')).filter(x => /^\d{3,15}$/.test(x)))];
        const batch = ids.slice(0, isCert ? 12 : 30);
        const done = (await call('GET', `adminState/gifts/${cid}`)) || {};
        const t0 = Date.now();
        const r = { sent: 0, blocked: 0, failed: 0, skipped: 0 };
        let processed = 0;
        let lastError = '';
        for (const id of batch) {
          if (Date.now() - t0 > 45000) break; // Vercel 60 soniya chegarasi: qolganini panel keyingi so'rovda yuboradi
          processed++;
          const uid = `tg_${id}`;
          const mark = done[id];
          if (mark && mark.notified) { r.skipped++; continue; }
          const u = (await call('GET', `tgusers/${id}`).catch(() => null)) || {};
          if (u.blocked) { r.blocked++; continue; }
          let certId = mark?.cert || '';
          if (!mark) {
            const ts = Date.now();
            try {
              if (isCert) {
                const issued = await issueCertificate(call, { userId: uid, tpl: spec.tpl, title: spec.title, reason: spec.reason, name: String(u.name || "O'quvchi").trim().slice(0, 40) || "O'quvchi", fmt: spec.fmt });
                certId = issued.id;
                await call('PUT', `adminState/gifts/${cid}/${id}`, { ts, cert: certId });
              } else {
                // Ilovaga kirmagan foydalanuvchi uchun reyting yozuvi yaratilmaydi (Ligada bo'sh qator paydo bo'lmasin): ilova birinchi ochilganda sovg'ani o'zi oladi
                await call('PATCH', '', {
                  [`grants/${uid}/${newGid()}`]: { type: spec.type, amount: spec.amount, validHours: spec.validHours, ...(spec.type === 'item' ? { itemId: spec.itemId } : {}), note: giftName.slice(0, 80), ts, keep: true },
                  [`adminState/gifts/${cid}/${id}`]: { ts },
                });
              }
              // Foydalanuvchini sovg'a olgan deb belgilaymiz (alohida ajratish uchun)
              await call('PATCH', `tgusers/${id}`, { giftGiven: true, giftTime: ts, giftName }).catch(() => {});
            } catch (e) {
              r.failed++;
              lastError = String(e.message || e);
              continue;
            }
          }
          if (notify && token) {
            try {
              await notifyGift(token, Number(id), { name: u.name, gift: giftName, id: certId, text, kind: isCert ? 'cert' : 'gift' });
              r.sent++;
              await call('PATCH', `adminState/gifts/${cid}/${id}`, { notified: true }).catch(() => {});
            } catch (e) {
              if (e.code === 403 || /blocked|deactivated|chat not found/i.test(String(e.message))) {
                r.blocked++;
                await call('PATCH', `tgusers/${id}`, { blocked: true }).catch(() => {});
                await call('PATCH', `adminState/gifts/${cid}/${id}`, { notified: 'blocked' }).catch(() => {});
              } else {
                r.failed++;
                lastError = String(e.message || e);
              }
            }
          } else {
            // Xabar yuborish o'chirilgan, faqat sovg'a berildi
            r.sent++;
            await call('PATCH', `adminState/gifts/${cid}/${id}`, { notified: true }).catch(() => {});
          }
          await new Promise(r2 => setTimeout(r2, 40));
        }
        return json(200, { ok: true, processed, lastError, ...r });
      }

      // ---------- Do'kon va taklif sozlamalari ----------
      // ---------- Foydalanuvchi sovg'a / bezaklarini yoqish-o'chirish ----------
      // Foydalanuvchi sotib olgan yoki sovg'a qilingan bezaklar (mavzu: yomg'ir/qor..., ramka, aura, 2x XP, VIP...) o'chmaydi — faqat ta'siri to'xtatiladi.
      // Holat `leaderboard/<uid>/off` da turadi ({ skin: 1, frame: 1 ... }); ilova uni jonli kuzatadi va bir necha soniyada qo'llaydi. Qayta yoqish — yozuvni olib tashlash.
      case 'getUserFx': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        const [prof, wheel, lbe] = await Promise.all([
          call('GET', `state/${body.id}/profile`).catch(() => null),
          call('GET', `state/${body.id}/wheel`).catch(() => null),
          call('GET', `leaderboard/${body.id}`).catch(() => null),
        ]);
        const p = prof || {};
        const own = Array.isArray(p.own) ? p.own : Object.values(p.own || {});
        return json(200, {
          id: body.id,
          name: String(lbe?.name || p.name || ''),
          own: own.map(String),
          equip: {
            skin: String(p.skin || ''), frame: String(p.frame || ''), aura: String(p.aura || ''), nameFx: String(p.nameFx || ''), nameAnim: String(p.nameAnim || ''),
            nameColor: String(p.nameColor || ''), nameSym: String(p.nameSym || ''), title: String(p.title || ''), rankBadge: String(p.rankBadge || ''), banner: String(p.banner || ''),
          },
          boostUntil: Number(p.boostUntil) || 0,
          spotUntil: Number(p.spotUntil) || 0,
          proUntil: Number(wheel?.proUntil) || 0,
          off: lbe && typeof lbe.off === 'object' && lbe.off ? lbe.off : {},
          hasEntry: !!lbe?.ts,
        });
      }

      case 'setUserFx': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        if (!(await call('GET', `leaderboard/${body.id}/ts`))) return json(400, { error: "Bu foydalanuvchi ilovaga hali kirmagan (reytingda yozuvi yo'q)" });
        const KEYS = ['skin', 'frame', 'aura', 'nameFx', 'nameAnim', 'nameColor', 'nameSym', 'title', 'rankBadge', 'banner', 'verified', 'spotlight', 'boost', 'vip'];
        const off = {};
        for (const k of KEYS) if (body.off && body.off[k]) off[k] = 1;
        if (Object.keys(off).length) await call('PUT', `leaderboard/${body.id}/off`, off);
        else await call('DELETE', `leaderboard/${body.id}/off`);
        return json(200, { ok: true, off });
      }

      // ---------- Lo-Fi musiqa kutubxonasi (do'kon sozlamasidan alohida; tartib saqlanadi, 400 tagacha) ----------
      case 'setLofi': {
        const normAudio = u => {
          u = String(u || '').trim();
          const d = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(u) || /drive\.google\.com\/(?:open|uc)\?[^#]*\bid=([A-Za-z0-9_-]{10,})/.exec(u);
          if (d) return `https://drive.google.com/uc?export=download&id=${d[1]}`;
          if (/^https?:\/\/(www\.)?dropbox\.com\//i.test(u)) return u.replace(/^https?:\/\/(www\.)?dropbox\.com/i, 'https://dl.dropboxusercontent.com').replace(/([?&])dl=0/, '$1raw=1');
          const g = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i.exec(u);
          return g ? `https://raw.githubusercontent.com/${g[1]}/${g[2]}/${g[3]}` : u;
        };
        const src = Array.isArray(body.tracks) ? body.tracks : [];
        const seen = new Set();
        const tracks = [];
        for (const t of src) {
          const url = normAudio(t?.url).slice(0, 600);
          if (!(/^https?:\/\//i.test(url) || /^\/music\/[^\s]+/.test(url)) || seen.has(url)) continue;
          seen.add(url);
          tracks.push({ title: String(t?.title || '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 80) || `Lo-Fi ${tracks.length + 1}`, url, order: tracks.length });
          if (tracks.length >= 400) break;
        }
        await call('PUT', 'config/lofi', { tracks, shuffle: !!body.shuffle, v: Date.now() });
        return json(200, { ok: true, count: tracks.length, dropped: src.length - tracks.length });
      }

      // ---------- Statistika ----------
      // Ilova yuborgan yengil hodisalar: ochilish (soat bo'yicha), o'yin boshlandi/tugadi, do'kon xaridi.
      // Foydalanuvchining Telegram imzosi tekshiriladi; so'rov ichidagi hodisalar soni cheklangan.
      case 'track': {
        const bad = verifyUid(String(body.uid || ''), body.initData);
        if (bad) return bad;
        const uid = String(body.uid);
        const lim = (globalThis.__trackLim ||= new Map());
        const slot = Math.floor(Date.now() / 60000);
        const cur = lim.get(uid);
        const used = cur && cur.slot === slot ? cur.n : 0;
        if (used >= 40) return json(429, { error: "Ko'p so'rov" });
        const evs = (Array.isArray(body.events) ? body.events : []).slice(0, 25);
        lim.set(uid, { slot, n: used + 1 });
        if (lim.size > 5000) lim.clear();
        const inc = n => ({ '.sv': { increment: Math.max(1, Math.min(1000, Math.round(Number(n) || 1))) } });
        const KEY = /^[A-Za-z0-9_\-]{1,64}$/;
        const day = tashkentDay();
        const hh = String(tashkentNow().getUTCHours()).padStart(2, '0');
        const jobs = new Map(); // yo'l -> yangilanish obyekti
        const put = (path, obj) => jobs.set(path, { ...(jobs.get(path) || {}), ...obj });
        for (const e of evs) {
          const ev = String(e?.ev || '');
          const key = String(e?.key || '');
          if (ev === 'open') put(`stats/au/${day}/${uid}`, { [hh]: 1 });
          else if ((ev === 'gstart' || ev === 'gdone') && KEY.test(key)) {
            put(`stats/games/${key}`, { [ev === 'gstart' ? 'plays' : 'done']: inc(e.n) });
            put(`stats/gu/${key}`, { [uid]: 1 });
            put(`stats/gd/${day}/${key}`, { [ev === 'gstart' ? 'plays' : 'done']: inc(e.n) });
          } else if (ev === 'buy' && KEY.test(key)) {
            const price = Math.max(0, Math.min(100000000, Math.round(Number(e.price) || 0)));
            put(`stats/shop/${key}`, { n: inc(1), coins: { '.sv': { increment: price } } });
            put(`stats/su/${key}`, { [uid]: 1 });
            put(`stats/sd/${day}/${key}`, { n: inc(1) });
          }
        }
        await Promise.all([...jobs.entries()].map(([path, obj]) => call('PATCH', path, obj).catch(() => null)));
        return json(200, { ok: true });
      }

      case 'statsOverview': {
        const days = Math.max(1, Math.min(45, Math.round(Number(body.days) || 14)));
        const t0 = tashkentNow().getTime();
        const dayKeys = Array.from({ length: days }, (_, i) => new Date(t0 - i * 86400000).toISOString().slice(0, 10));
        // Eski kunlarni tozalash (60+ kun oldingi faollik yozuvlari)
        const oldKeys = Array.from({ length: 12 }, (_, i) => new Date(t0 - (61 + i) * 86400000).toISOString().slice(0, 10));
        Promise.all(oldKeys.map(d => call('DELETE', `stats/au/${d}`).catch(() => null))).catch(() => {});
        const [auDays, games, gu, shop, su, gd] = await Promise.all([
          Promise.all(dayKeys.map(d => call('GET', `stats/au/${d}`).catch(() => null))),
          call('GET', 'stats/games').catch(() => null),
          call('GET', 'stats/gu').catch(() => null),
          call('GET', 'stats/shop').catch(() => null),
          call('GET', 'stats/su').catch(() => null),
          Promise.all(dayKeys.slice(0, 14).map(d => call('GET', `stats/gd/${d}`).catch(() => null))),
        ]);
        const hours = Array(24).fill(0); // soat bo'yicha: shu soatda faol bo'lgan (foydalanuvchi, kun) juftliklari
        const perDay = [];
        const uniq = new Set();
        let userDays = 0;
        dayKeys.forEach((d, i) => {
          const m = auDays[i] || {};
          const users = Object.keys(m);
          users.forEach(u => {
            uniq.add(u);
            userDays++;
            Object.keys(m[u] || {}).forEach(h => { const n = Number(h); if (n >= 0 && n < 24) hours[n]++; });
          });
          perDay.push({ day: d, users: users.length });
        });
        const hoursUsers = Array(24).fill(0).map(() => new Set());
        auDays.forEach(m => Object.entries(m || {}).forEach(([u, hs]) => Object.keys(hs || {}).forEach(h => { const n = Number(h); if (n >= 0 && n < 24) hoursUsers[n].add(u); })));
        const gameRows = Object.entries(games || {}).map(([id, g]) => ({ id, plays: Number(g?.plays) || 0, done: Number(g?.done) || 0, players: Object.keys((gu || {})[id] || {}).length }));
        const shopRows = Object.entries(shop || {}).map(([id, g]) => ({ id, n: Number(g?.n) || 0, coins: Number(g?.coins) || 0, buyers: Object.keys((su || {})[id] || {}).length }));
        const gameDays = dayKeys.slice(0, 14).map((d, i) => ({ day: d, games: gd[i] || {} }));
        return json(200, { days, hours, hourUsers: hoursUsers.map(x => x.size), uniqueUsers: uniq.size, userDays, perDay, games: gameRows, shop: shopRows, gameDays });
      }

      case 'setShop': {
        const v = body.value;
        if (!v || typeof v !== 'object' || JSON.stringify(v).length > 90000) return json(400, { error: "Qiymat noto'g'ri yoki juda katta" });
        const prevNb = await call('GET', 'config/shop/navBadges').catch(() => null);
        if (prevNb && typeof prevNb === 'object' && !v.navBadges) v.navBadges = prevNb; // nishonlar do'kon saqlanganda o'chib ketmasin
        await call('PUT', 'config/shop', v);
        return json(200, { ok: true });
      }

      case 'setReferral': {
        const v = body.value || {};
        const out = {
          enabled: v.enabled !== false,
          xp: Math.max(0, Math.min(100000, Math.round(Number(v.xp)) || 0)),
          botUsername: String(v.botUsername || '').replace(/^@/, '').trim().slice(0, 40),
          shareText: String(v.shareText || '').trim().slice(0, 900),
          notifyText: String(v.notifyText || '').trim().slice(0, 900),
        };
        await call('PUT', 'config/referral', out);
        return json(200, { ok: true });
      }

      case 'listReferrals': {
        const r = (await call('GET', `referrals/${String(body.id || '').replace(/^tg_/, '')}`)) || {};
        return json(200, { items: Object.entries(r).map(([id, x]) => ({ id, ...x })).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 200) });
      }

      case 'listOrders': {
        const o = (await call('GET', 'orders')) || {};
        const items = Object.entries(o).map(([id, x]) => ({ id, ...x })).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 300);
        return json(200, { items });
      }

      case 'setOrder': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        if (body.remove) await call('DELETE', `orders/${body.id}`);
        else await call('PATCH', `orders/${body.id}`, { status: body.status === 'done' ? 'done' : 'new', doneAt: Date.now() });
        if (body.notify && /^tg_\d+$/.test(body.uid || '') && process.env.BOT_TOKEN) {
          await sendMessage(process.env.BOT_TOKEN, Number(body.uid.slice(3)), `🎁 Buyurtmangiz bajarildi: «${String(body.title || '').replace(/[<>&]/g, '')}»\n\nRahmat!`, openAppMarkup()).catch(() => {});
        }
        return json(200, { ok: true });
      }

      // Shaxsiy taklif tugmali ommaviy xabar: har bir foydalanuvchiga UNING o'z havolasi bilan tugma qo'shiladi
      case 'inviteBroadcast': {
        const text = String(body.text || '').trim().slice(0, 1000);
        if (!text) return json(400, { error: 'Xabar matnini yozing' });
        if (!process.env.BOT_TOKEN) return json(400, { error: 'Vercel muhitida BOT_TOKEN kiritilmagan' });
        const base = siteUrl();
        if (!base) return json(400, { error: 'SITE_URL aniqlanmadi' });
        const r = await fetch(`${base}/api/fn/broadcast-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: ADMIN_CODE, text, kind: 'manual', invite: { label: String(body.label || '').slice(0, 40), mode: body.mode === 'link' ? 'link' : 'share' } }),
        });
        if (r.status !== 202 && !r.ok) return json(502, { error: `Yuborishni boshlab bo'lmadi (${r.status})` });
        return json(200, { ok: true });
      }

      // ---------- Ilovaga kirganda chiqadigan pop-up ----------
      case 'setPopup': {
        const old = (await call('GET', 'config/popup')) || {};
        const act = ['none', 'levelTest', 'tab', 'link', 'promo'].includes(body.action) ? body.action : 'none';
        let target = String(body.target || '').slice(0, 300);
        if (act === 'tab' && !['home', 'words', 'games', 'leaderboard', 'shop'].includes(target)) target = 'home';
        if (act === 'link' && target && !/^https?:\/\//i.test(target) && !/^t\.me\//i.test(target)) return json(400, { error: "Havola https:// yoki t.me/ bilan boshlanishi kerak" });
        const next = {
          active: !!body.active,
          emoji: String(body.emoji || '').slice(0, 8),
          title: String(body.title || '').slice(0, 80),
          text: String(body.text || '').slice(0, 500),
          btn: String(body.btn || '').slice(0, 30),
          title_ru: String(body.title_ru || '').slice(0, 80), text_ru: String(body.text_ru || '').slice(0, 500), btn_ru: String(body.btn_ru || '').slice(0, 30),
          title_en: String(body.title_en || '').slice(0, 80), text_en: String(body.text_en || '').slice(0, 500), btn_en: String(body.btn_en || '').slice(0, 30),
          action: act,
          target: act === 'none' || act === 'levelTest' ? '' : target,
          who: body.who === 'old' ? 'old' : 'all',
          freq: ['once', 'daily', 'always'].includes(body.freq) ? body.freq : 'once',
        };
        if (next.active && !next.title && !next.text) return json(400, { error: 'Sarlavha yoki matn kiriting' });
        const same = ['emoji', 'title', 'text', 'btn', 'title_ru', 'text_ru', 'btn_ru', 'title_en', 'text_en', 'btn_en', 'action', 'target', 'who', 'freq'].every(k => String(old[k] || '') === String(next[k] || ''));
        // Mazmun o'zgarsa yoki «qayta ko'rsat» belgilansa — yangi versiya: hamma yana ko'radi
        next.id = !body.resend && same && old.id ? String(old.id) : String(Date.now());
        await call('PUT', 'config/popup', next);
        return json(200, { ok: true, id: next.id });
      }

      case 'setAnnouncement': {
        await call('PUT', 'config/announcement', { text: String(body.text || '').slice(0, 300), active: !!body.active });
        return json(200, { ok: true });
      }

      // ---------- Bot /start xabari ----------
      case 'getBotStart': {
        const cfg = (await call('GET', 'config/botStart')) || {};
        let hook = null;
        if (process.env.BOT_TOKEN) {
          try { hook = await tgApi(process.env.BOT_TOKEN, 'getWebhookInfo', {}); } catch (e) { hook = { error: String(e.message || e) }; }
        }
        return json(200, {
          text: cfg.text || DEFAULT_START_TEXT,
          button: cfg.button || DEFAULT_START_BUTTON,
          btn2Text: cfg.btn2Text || '',
          btn2Url: cfg.btn2Url || '',
          btn3Text: cfg.btn3Text || '',
          btn3Url: cfg.btn3Url || '',
          btn1Style: cfg.btn1Style === undefined ? 'success' : cleanStyle(cfg.btn1Style),
          btn2Style: cleanStyle(cfg.btn2Style),
          btn3Style: cleanStyle(cfg.btn3Style),
          btn1Icon: cfg.btn1Icon || '', btn2Icon: cfg.btn2Icon || '', btn3Icon: cfg.btn3Icon || '',
          enabled: cfg.enabled !== false,
          site: siteUrl(), hook: hook ? { url: hook.url || '', pending: hook.pending_update_count || 0, error: hook.last_error_message || hook.error || '' } : null,
          hasToken: !!process.env.BOT_TOKEN, wantUrl: `${siteUrl()}/api/fn/tg-webhook`,
        });
      }

      case 'setBotStart': {
        const text = String(body.text || '').trim().slice(0, 3500);
        if (!text) return json(400, { error: 'Xabar matnini kiriting' });
        await call('PUT', 'config/botStart', {
          text,
          button: String(body.button || DEFAULT_START_BUTTON).trim().slice(0, 40) || DEFAULT_START_BUTTON,
          btn2Text: String(body.btn2Text || '').trim().slice(0, 40),
          btn2Url: String(body.btn2Url || '').trim().slice(0, 300),
          btn3Text: String(body.btn3Text || '').trim().slice(0, 40),
          btn3Url: String(body.btn3Url || '').trim().slice(0, 300),
          btn1Style: cleanStyle(body.btn1Style),
          btn2Style: cleanStyle(body.btn2Style),
          btn3Style: cleanStyle(body.btn3Style),
          btn1Icon: String(body.btn1Icon || '').replace(/\D/g, '').slice(0, 25),
          btn2Icon: String(body.btn2Icon || '').replace(/\D/g, '').slice(0, 25),
          btn3Icon: String(body.btn3Icon || '').replace(/\D/g, '').slice(0, 25),
          enabled: body.enabled !== false,
        });
        return json(200, { ok: true });
      }

      // ---------- Premium emoji kutubxonasi ----------
      // adminState/emojis/<id> = { e: zaxira emoji, pack?: to'plam nomi }. Admin matnga <tg-emoji emoji-id="ID">😀</tg-emoji> qo'shadi.
      case 'getEmojis': {
        return json(200, { emojis: (await call('GET', 'adminState/emojis')) || {} });
      }

      case 'addEmoji': {
        const id = String(body.id || '').trim();
        if (!/^\d{5,25}$/.test(id)) return json(400, { error: 'Premium emoji ID faqat raqamlardan iborat (masalan 5368324170671202286)' });
        const e = String(body.e || '').trim().slice(0, 8) || '⭐';
        await call('PUT', `adminState/emojis/${id}`, { e, ...(body.pack ? { pack: String(body.pack).slice(0, 64) } : {}) });
        return json(200, { ok: true });
      }

      case 'deleteEmoji': {
        const id = String(body.id || '').trim();
        if (!/^\d{5,25}$/.test(id)) return json(400, { error: 'ID xato' });
        await call('DELETE', `adminState/emojis/${id}`);
        return json(200, { ok: true });
      }

      // Telegram premium emoji to'plamini havola bilan qo'shish: https://t.me/addemoji/<nom>
      case 'importEmojiPack': {
        if (!process.env.BOT_TOKEN) return json(400, { error: 'BOT_TOKEN kiritilmagan' });
        const m = /(?:addemoji|addstickers)\/([A-Za-z0-9_]{3,64})/.exec(String(body.link || '')) || /^([A-Za-z0-9_]{3,64})$/.exec(String(body.link || '').trim());
        if (!m) return json(400, { error: 'To\'plam havolasi xato. Masalan: https://t.me/addemoji/EmojiPackNomi' });
        let set;
        try { set = await tgApi(process.env.BOT_TOKEN, 'getStickerSet', { name: m[1] }); } catch (e) { return json(502, { error: `Telegram: ${e.message}` }); }
        const list = (set?.stickers || []).filter(x => x && x.custom_emoji_id).slice(0, 120);
        if (!list.length) return json(400, { error: 'Bu to\'plamda premium emoji topilmadi (u oddiy stiker to\'plami bo\'lishi mumkin)' });
        const cur = (await call('GET', 'adminState/emojis')) || {};
        if (Object.keys(cur).length + list.length > 400) return json(400, { error: 'Kutubxona to\'ldi (ko\'pi bilan 400 ta). Ba\'zi emojilarni o\'chiring' });
        const upd = {};
        list.forEach(x => { upd[`adminState/emojis/${x.custom_emoji_id}`] = { e: String(x.emoji || '⭐').slice(0, 8), pack: m[1] }; });
        await call('PATCH', '', upd);
        return json(200, { ok: true, count: list.length, title: set.title || m[1] });
      }

      // Minnatdorchilik (ilk kirish) sertifikati matni
      case 'getThanksCert': {
        const cfg = (await call('GET', 'config/thanksCert')) || {};
        return json(200, {
          title: cfg.title || '“VocaBoost” loyihamizga qo‘shgan beqiyos hissangiz, bilimga bo‘lgan ishtiyoqingiz va doimiy qo‘llab-quvvatlashingiz uchun chin dildan minnatdorchilik bildiramiz!',
          reason: cfg.reason || '— Birgalikda yanada katta maqsadlarga! —',
        });
      }

      case 'setThanksCert': {
        const title = String(body.title || '').trim().slice(0, 150);
        const reason = String(body.reason || '').trim().slice(0, 300);
        if (!title) return json(400, { error: 'Sarlavha bo\'sh bo\'lmasin' });
        await call('PUT', 'config/thanksCert', { title, reason });
        return json(200, { ok: true });
      }

      // Botni shu saytga ulaydi: endi /start bosgan har bir foydalanuvchiga xabar + «🚀 VocaBoostni ochish» tugmasi boradi
      case 'setupWebhook': {
        if (!process.env.BOT_TOKEN) return json(400, { error: 'BOT_TOKEN env o\'zgaruvchisi kiritilmagan' });
        const url = `${siteUrl()}/api/fn/tg-webhook`;
        if (!url.startsWith('https://')) return json(400, { error: 'Sayt manzili (URL) aniqlanmadi — Vercel deployidan keyin urinib ko\'ring' });
        await tgApi(process.env.BOT_TOKEN, 'setWebhook', { url, allowed_updates: ['message', 'my_chat_member'], drop_pending_updates: false, ...(process.env.TG_WEBHOOK_SECRET ? { secret_token: process.env.TG_WEBHOOK_SECRET } : {}) });
        return json(200, { ok: true, url });
      }

      case 'testBotStart': {
        if (!process.env.BOT_TOKEN) return json(400, { error: 'BOT_TOKEN yo\'q' });
        const to = Number(body.to);
        if (!to) return json(400, { error: 'Telegram ID kerak' });
        const cfg = (await call('GET', 'config/botStart')) || {};
        // Sinov xabarida ham haqiqiy ism ishlatiladi: avval Telegramdan, bo'lmasa bazadan, oxirida "do'st"
        let nm = '';
        try {
          const chat = await tgApi(process.env.BOT_TOKEN, 'getChat', { chat_id: to });
          nm = String(chat?.first_name || chat?.username || '').trim().slice(0, 40);
        } catch { /* foydalanuvchi botni hali ishga tushirmagan bo'lishi mumkin */ }
        if (!nm) {
          try { nm = String(((await call('GET', `tgusers/${to}`)) || {}).name || '').split(' ')[0].slice(0, 40); } catch { /* ignore */ }
        }
        await sendMessage(process.env.BOT_TOKEN, to, String(cfg.text || DEFAULT_START_TEXT).replace(/\{name\}/g, escHtml(nm || "do'st")), makeStartMarkup(cfg));
        return json(200, { ok: true });
      }

      // ---------- Chellenj / marafonlar ----------
      case 'listChallenges': {
        const all = (await call('GET', 'challenges')) || {};
        const items = Object.entries(all).filter(([, c]) => c?.meta).map(([id, c]) => ({
          id, ...c.meta, players: Object.keys(c.players || {}).length,
        }));
        items.sort((a, b) => (b.startsAt || 0) - (a.startsAt || 0));
        return json(200, { items });
      }

      case 'saveChallenge': {
        const str = (v, n) => String(v ?? '').trim().slice(0, n);
        const title = str(body.title, 80);
        if (!title) return json(400, { error: 'Chellenj nomini kiriting' });
        const kind = ['metric', 'themed', 'survival'].includes(body.kind) ? body.kind : 'metric';
        const metric = ['xp', 'words', 'mastered'].includes(body.metric) ? body.metric : 'xp';
        const startsAt = Number(body.startsAt), endsAt = Number(body.endsAt);
        if (!(startsAt > 0) || !(endsAt > startsAt)) return json(400, { error: 'Boshlanish va tugash vaqtini to\'g\'ri kiriting' });
        const id = ID_RE.test(body.id || '') ? body.id : 'c' + Date.now().toString(36);
        const prev = (await call('GET', `challenges/${id}/meta`)) || {};
        if (prev.finalized) return json(400, { error: 'Yakunlangan chellenjni o\'zgartirib bo\'lmaydi' });
        const num = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
        let packId = '';
        if (kind === 'themed') {
          packId = ID_RE.test(body.packId || '') ? body.packId : '';
          if (!packId) return json(400, { error: 'Mavzuli chellenj uchun lug\'at to\'plamini tanlang' });
          const pk = await call('GET', `packs/${packId}/title`);
          if (!pk) return json(400, { error: 'Tanlangan to\'plam topilmadi' });
        }
        // Yakunda avtomatik beriladigan sertifikatlarning sarlavha va izohi (oldindan yoziladi)
        const certs = {};
        const cin = body.certs && typeof body.certs === 'object' ? body.certs : {};
        for (const k of ['gold', 'silver', 'bronze', 'marathon', 'thanks']) {
          const x = cin[k] || {};
          certs[k] = { title: str(x.title, 100), reason: str(x.reason, 200) };
        }
        const meta = {
          title, desc: str(body.desc, 400), prize: str(body.prize, 200), kind, metric: kind === 'metric' ? metric : 'xp', startsAt, endsAt,
          goal: num(body.goal, 1000000), xpTop: num(body.xpTop, 5000), packId, lives: kind === 'survival' ? Math.max(1, num(body.lives || 3, 10)) : 0, secs: kind === 'survival' ? Math.max(5, num(body.secs || 30, 120)) : 0,
          certs, published: body.published !== false, createdAt: prev.createdAt || Date.now(), finalized: false,
        };
        await call('PUT', `challenges/${id}/meta`, meta);
        return json(200, { ok: true, id });
      }

      case 'deleteChallenge': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        await call('DELETE', `challenges/${body.id}`);
        return json(200, { ok: true });
      }

      // Yakunlash: natijalar qotiriladi va HAR BIR ishtirokchiga o'z o'rniga qarab sertifikat beriladi:
      //   1-o'rin Oltin, 2-o'rin Kumush, 3-o'rin Bronza, maqsadga yetganlarga Marafon, qolganlarga Minnatdorchilik.
      // Matnlar chellenj yaratilganda admin yozgan (meta.certs). Funksiya qayta chaqirilsa ham sertifikat ikki marta berilmaydi.
      case 'finalizeChallenge': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        const ch = await call('GET', `challenges/${body.id}`);
        if (!ch?.meta) return json(404, { error: 'Chellenj topilmadi' });
        const m = ch.meta;
        if (m.finalized) return json(400, { error: 'Allaqachon yakunlangan' });
        const kind = m.kind || 'metric';
        const lb = (await call('GET', 'leaderboard')) || {};
        const live = e => (m.metric === 'xp' ? (Number(e?.xp) || 0) + (Number(e?.xpOffset) || 0) : m.metric === 'words' ? Number(e?.learned) || 0 : Number(e?.mastered) || 0);
        const rows = Object.entries(ch.players || {}).filter(([, p]) => p).map(([uid, p]) => {
          const stored = Math.max(0, Number(p.gain) || 0);
          const base = Number(p.base?.[m.metric]) || 0;
          const gain = kind === 'metric' ? Math.max(stored, Math.max(0, live(lb[uid]) - base)) : stored;
          return { uid, name: String(p.name || lb[uid]?.name || "O'quvchi").slice(0, 40), gain, ts: Number(p.ts) || 0 };
        }).sort((a, b) => b.gain - a.gain || a.ts - b.ts);

        const goal = Number(m.goal) || 0;
        const T = m.certs || {};
        const fill = (s, r, place) => String(s).replace(/\{place\}/g, String(place)).replace(/\{challenge\}/g, m.title).replace(/\{score\}/g, String(r.gain)).replace(/\{goal\}/g, String(goal)).replace(/\{name\}/g, r.name);
        const DEF = {
          gold: ['{challenge} — {place}-o\'rin', m.prize || '{score} natija bilan g\'olib bo\'ldi'],
          silver: ['{challenge} — {place}-o\'rin', m.prize || '{score} natija bilan {place}-o\'rinni egalladi'],
          bronze: ['{challenge} — {place}-o\'rin', m.prize || '{score} natija bilan {place}-o\'rinni egalladi'],
          marathon: ['{challenge} — maqsadga erishdi', 'Belgilangan maqsad: {goal}. Natijangiz: {score}'],
          thanks: ['{challenge} ishtirokchisi', 'Ishtirokingiz uchun rahmat!'],
        };
        const issuedMap = (await call('GET', `challenges/${body.id}/certIssued`)) || {};
        const out = [];
        const work = rows.map((r, i) => {
          const place = i + 1;
          const key = place <= 3 && r.gain > 0 ? ['gold', 'silver', 'bronze'][i] : goal > 0 && r.gain >= goal ? 'marathon' : 'thanks';
          return { r, place, key };
        });
        const doOne = async ({ r, place, key }) => {
          const done = issuedMap[r.uid];
          if (done?.id) return out.push({ uid: r.uid, place, tpl: done.tpl, id: done.id, reused: true });
          const t = T[key] || {};
          const title = fill(t.title || DEF[key][0], r, place).slice(0, 100);
          const reason = fill(t.reason || DEF[key][1], r, place).slice(0, 200);
          const issued = await issueCertificate(call, { userId: r.uid, tpl: key === 'marathon' ? 'marathon' : key === 'thanks' ? 'thanks' : key, title, reason, name: r.name, stats: statsFromLb(lb[r.uid]) });
          await call('PUT', `challenges/${body.id}/certIssued/${r.uid}`, { id: issued.id, tpl: key });
          if (place <= 3 && key !== 'marathon' && key !== 'thanks' && m.xpTop > 0) {
            await call('PUT', `grants/${r.uid}/${newGid()}`, { type: 'xp', amount: m.xpTop, validHours: 0, note: `${m.title}: ${place}-o'rin`, ts: Date.now() });
            await flagGrant(r.uid);
          }
          out.push({ uid: r.uid, place, tpl: key, id: issued.id });
        };
        for (let i = 0; i < work.length; i += 6) await Promise.all(work.slice(i, i + 6).map(doOne));
        const byUid = Object.fromEntries(out.map(o => [o.uid, o]));
        await call('PATCH', `challenges/${body.id}/meta`, {
          finalized: true, finalizedAt: Date.now(),
          result: rows.slice(0, 20).map((r, i) => ({ uid: r.uid, name: r.name, gain: r.gain, cert: byUid[r.uid]?.id || '', tpl: byUid[r.uid]?.tpl || '', place: i + 1 })),
        });
        return json(200, { ok: true, players: rows.length, awarded: out.length });
      }

      // Yakunlangan chellenjda sertifikat egalari ro'yxati (Telegramga yuborish uchun, hali yuborilmaganlari belgilanadi)
      case 'challengeCerts': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        const issued = (await call('GET', `challenges/${body.id}/certIssued`)) || {};
        const items = [];
        for (const [uid, x] of Object.entries(issued)) {
          const c = await call('GET', `certs/${uid}/${x.id}`);
          if (!c) continue;
          items.push({ uid, id: x.id, tpl: c.tpl, title: c.title || '', reason: c.reason || '', name: c.name || '', date: c.date || '', fmt: c.fmt || 'wide', stats: c.stats || null, sent: !!c.sent, tg: /^tg_\d+$/.test(uid) });
        }
        items.sort((a, b) => (a.id < b.id ? -1 : 1));
        return json(200, { items });
      }

      // Sertifikat rasmini (admin brauzerida chizilgan JPEG) tantanali xabar bilan foydalanuvchining Telegram chatiga yuboradi
      case 'deliverCert': {
        if (!process.env.BOT_TOKEN) return json(400, { error: 'BOT_TOKEN yo\'q' });
        if (!ID_RE.test(body.userId || '') || !ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        if (!/^tg_\d+$/.test(body.userId)) return json(200, { ok: false, error: 'Telegram hisobi emas' });
        const c = await call('GET', `certs/${body.userId}/${body.id}`);
        if (!c) return json(404, { error: 'Sertifikat topilmadi' });
        const b64 = String(body.image || '').replace(/^data:image\/[a-z]+;base64,/, '');
        if (b64.length < 1000 || b64.length > 5_000_000) return json(400, { error: 'Rasm hajmi xato' });
        const buf = Buffer.from(b64, 'base64');
        if (buf[0] !== 0xff || buf[1] !== 0xd8) return json(400, { error: 'Faqat JPEG qabul qilinadi' });
        const lines = [`🎉 Tabriklaymiz, ${c.name || "o'quvchi"}!`, '', `🏆 ${c.title}`];
        if (c.reason) lines.push(c.reason);
        lines.push('', `№ ${body.id} · ${c.date || ''}`, '', 'VocaBoost — so\'zlarni tez va uzoq yodlang');
        const form = new FormData();
        form.append('chat_id', body.userId.slice(3));
        form.append('caption', lines.join('\n').slice(0, 1024));
        const markup = openAppMarkup('🚀 VocaBoostni ochish');
        if (markup) form.append('reply_markup', JSON.stringify(markup));
        form.append('photo', new Blob([buf], { type: 'image/jpeg' }), `VocaBoost-${body.id}.jpg`);
        try {
          await tgApi(process.env.BOT_TOKEN, 'sendPhoto', form);
        } catch (e) {
          const forbidden = e.code === 403 || /chat not found|blocked|deactivated/i.test(e.message);
          return json(200, { ok: false, error: forbidden ? 'Bot foydalanuvchiga yoza olmaydi (Start bosmagan)' : String(e.message || e) });
        }
        await call('PATCH', `certs/${body.userId}/${body.id}`, { sent: true });
        return json(200, { ok: true });
      }

      // ---------- Lug'at to'plamlari ("Bugungi mashqlar") ----------
      case 'listPacks': {
        const all = (await call('GET', 'packs')) || {};
        const items = Object.entries(all).map(([id, p]) => ({
          id, title: p.title || '', desc: p.desc || '', kind: p.kind || 'open', date: p.date || '', mode: p.mode || 'replace', level: p.level || '',
          order: p.order ?? 0, published: p.published !== false, count: Object.keys(p.words || {}).length, createdAt: p.createdAt || 0,
        }));
        items.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.order - b.order));
        return json(200, { items });
      }

      case 'getPack': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        const p = await call('GET', `packs/${body.id}`);
        if (!p) return json(404, { error: 'To\'plam topilmadi' });
        const words = Object.entries(p.words || {}).map(([id, w]) => ({ id, ...w })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return json(200, { pack: { id: body.id, ...p, words: undefined }, words });
      }

      case 'savePack': {
        try {
          const r = await savePackCore(body);
          return json(200, { ok: true, ...r });
        } catch (e) {
          return json(400, { error: String(e.message || e) });
        }
      }

      // Bir nechta maxsus mavzu / kunlik to'plamni sanama-sana birdan saqlash.
      // items: [{ title, date, desc?, words: [...] }]. Bir xil sana + bir xil daraja + bir xil tur bo'yicha mavjud to'plam bo'lsa — uning ustiga yoziladi (dublikat bo'lmaydi).
      case 'savePackBatch': {
        const items = Array.isArray(body.items) ? body.items.slice(0, 120) : [];
        if (!items.length) return json(400, { error: 'Yuklanadigan fayl yo\'q' });
        const kind = body.kind === 'daily' ? 'daily' : 'topic';
        const level = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(body.level) ? body.level : '';
        const overwrite = body.overwrite !== false;
        const all = overwrite ? (await call('GET', 'packs')) || {} : {};
        const byKey = {};
        Object.entries(all).forEach(([id, p]) => { if (p && p.kind === kind && p.date) byKey[`${p.date}|${p.level || ''}`] = id; });
        const results = [];
        let ok = 0;
        for (const it of items) {
          const key = `${String(it.date || '').slice(0, 10)}|${level}`;
          const existing = byKey[key];
          try {
            const r = await savePackCore({
              id: existing || undefined, title: it.title, desc: it.desc, kind, level, date: it.date,
              mode: body.mode, order: 0, published: body.published !== false, words: it.words,
            }, true);
            if (byKey[key] === undefined) byKey[key] = r.id; // bir so'rovda ikki xil fayl bir sanaga tushsa, ikkinchisi birinchisining ustiga yoziladi
            results.push({ date: it.date, title: it.title, ok: true, id: r.id, saved: r.saved, replaced: !!existing, skipped: r.errors.length });
            ok++;
          } catch (e) {
            results.push({ date: it.date, title: it.title, ok: false, error: String(e.message || e) });
          }
        }
        if (ok) await call('PUT', 'config/packsVersion', Date.now());
        return json(200, { ok: true, saved: ok, failed: items.length - ok, results });
      }

      case 'setPackPublished': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        await call('PATCH', `packs/${body.id}`, { published: !!body.published });
        await call('PUT', 'config/packsVersion', Date.now());
        return json(200, { ok: true });
      }

      case 'deletePack': {
        if (!ID_RE.test(body.id || '')) return json(400, { error: 'ID xato' });
        await call('DELETE', `packs/${body.id}`);
        await call('PUT', 'config/packsVersion', Date.now());
        return json(200, { ok: true });
      }

      // ---------- Promokodlar & Havolalar ----------
      // Panel formati: { promo: { code, desc, maxUses (0 = cheksiz), expiresAt, xp, coins, spins, vipHours, streakSaver } }
      case 'listPromos': {
        const promos = (await call('GET', 'promos')) || {};
        const items = Object.entries(promos).filter(([, p]) => p && typeof p === 'object').map(([code, p]) => {
          const g = p.gifts || {};
          return {
            id: code, code, desc: p.note || '', maxUses: Number(p.maxUses) || 0, usedCount: Number(p.usedCount) || 0,
            expiresAt: Number(p.expiresAt) || 0, active: p.active !== false, createdAt: p.createdAt || 0,
            xp: g.xp || 0, coins: g.coins || 0, spins: g.spins || 0, vipHours: g.vipHours || 0, streakSaver: g.streakSaver || 0,
            shopItems: Array.isArray(g.shopItems) ? g.shopItems : [],
            usersCount: Object.keys(p.users || {}).length,
          };
        });
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return json(200, { items });
      }

      case 'savePromo': {
        const src = body.promo && typeof body.promo === 'object' ? body.promo : body;
        const code = String(src.code || '').trim().toUpperCase().slice(0, 32);
        if (!/^[A-Z0-9_\-]{3,32}$/.test(code)) return json(400, { error: "Promokod faqat lotin harflari, raqam, '-' va '_' dan iborat bo'lishi kerak (3-32 belgi)" });
        const maxUses = Math.max(0, Math.min(1000000, Math.round(Number(src.maxUses)) || 0)); // 0 = cheksiz
        const gs = src.gifts && typeof src.gifts === 'object' ? src.gifts : src;
        const cleanGifts = {
          xp: Math.max(0, Math.min(100000, Math.round(Number(gs.xp)) || 0)),
          spins: Math.max(0, Math.min(50, Math.round(Number(gs.spins)) || 0)),
          vipHours: Math.max(0, Math.min(720, Math.round(Number(gs.vipHours)) || 0)),
          coins: Math.max(0, Math.min(100000000, Math.round(Number(gs.coins)) || 0)),
          streakSaver: Math.max(0, Math.min(10, Math.round(Number(gs.streakSaver)) || 0)),
        };
        // Do'kondagi sovg'alar (mahsulot ID lari): promokod ularni ham beradi
        const rawItems = Array.isArray(gs.shopItems) ? gs.shopItems : (gs.shopItem ? [gs.shopItem] : []);
        const shopItems = [...new Set(rawItems.map(x => String(x || '').trim()).filter(x => /^[A-Za-z0-9_\-]{1,64}$/.test(x)))].slice(0, 10);
        if (!Object.values(cleanGifts).some(x => x > 0) && !shopItems.length) return json(400, { error: 'Kamida bitta sovg\'a miqdorini kiriting' });
        const expTs = src.expiresAt ? Date.parse(src.expiresAt) || Number(src.expiresAt) || 0 : 0;
        const prev = (await call('GET', `promos/${code}`)) || {};
        const promoData = {
          code, maxUses, usedCount: Number(prev.usedCount) || 0, gifts: { ...cleanGifts, shopItems },
          active: src.enabled !== false && src.active !== false,
          note: String(src.desc ?? src.note ?? '').trim().slice(0, 100),
          expiresAt: expTs > 0 ? expTs : 0,
          createdAt: prev.createdAt || Date.now(), updatedAt: Date.now(),
          ...(prev.users ? { users: prev.users } : {}),
        };
        await call('PUT', `promos/${code}`, promoData);
        return json(200, { ok: true, code });
      }

      case 'deletePromo': {
        const code = String(body.code || body.id || '').trim().toUpperCase();
        if (!/^[A-Z0-9_\-]{3,32}$/.test(code)) return json(400, { error: 'Promokod kiritilmadi' });
        await call('DELETE', `promos/${code}`);
        return json(200, { ok: true });
      }

      // Foydalanuvchi promokodni kiritadi / havolani bosadi (ochiq amal: admin kodi shart emas, lekin Telegram imzosi tekshiriladi)
      case 'claimPromo': {
        const code = String(body.code || '').trim().toUpperCase().slice(0, 32);
        const uid = String(body.uid || '').trim();
        const name = String(body.name || "O'quvchi").trim().slice(0, 40);
        if (!/^[A-Z0-9_\-]{3,32}$/.test(code)) return json(400, { error: "Promokod noto'g'ri kiritilgan" });
        const bad = verifyUid(uid, body.initData);
        if (bad) return bad;

        // Atomik band qilish (ETag): "birinchi 1 kishi" bir vaqtda bosilganda ham faqat belgilangan son kishiga beriladi
        const url = `${DB}/promos/${code}.json?auth=${encodeURIComponent(FIREBASE_DB_SECRET)}`;
        let promo = null;
        let reserved = false;
        for (let attempt = 0; attempt < 8 && !reserved; attempt++) {
          const r = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' } });
          if (!r.ok) throw new Error(`DB xatosi ${r.status}`);
          const etag = r.headers.get('etag');
          promo = await r.json();
          if (!promo || typeof promo !== 'object' || promo.active === false) return json(404, { error: 'Promokod topilmadi yoki o\'chirilgan' });
          if (promo.expiresAt && Number(promo.expiresAt) < Date.now()) return json(400, { error: 'Promokod muddati tugagan' });
          if (promo.users && promo.users[uid]) return json(400, { error: 'Siz ushbu promokodni oldin ishlatgansiz' });
          const used = Number(promo.usedCount) || 0;
          if (Number(promo.maxUses) > 0 && used >= Number(promo.maxUses)) return json(400, { error: 'Afsus, bu promokodni ulgurib olishdi — limit tugagan' });
          const next = { ...promo, usedCount: used + 1, users: { ...(promo.users || {}), [uid]: { name, ts: Date.now() } } };
          const w = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify(next) });
          if (w.status === 412) continue; // boshqa kishi bir vaqtda yozdi — qayta tekshiramiz
          if (!w.ok) throw new Error(`DB xatosi ${w.status}`);
          reserved = true;
        }
        if (!reserved) return json(503, { error: "Server band, bir ozdan so'ng qayta urinib ko'ring" });

        const ts = Date.now();
        const gifts = promo.gifts || {};
        const upd = {};
        const note = `Promokod: ${code}`;
        if (gifts.xp > 0) upd[`grants/${uid}/${newGid()}`] = { type: 'xp', amount: gifts.xp, note, ts, keep: true };
        if (gifts.spins > 0) upd[`grants/${uid}/${newGid()}`] = { type: 'spins', amount: gifts.spins, validHours: 168, note, ts, keep: true };
        if (gifts.vipHours > 0) upd[`grants/${uid}/${newGid()}`] = { type: 'vip', amount: gifts.vipHours, note, ts, keep: true };
        if (gifts.coins > 0) upd[`grants/${uid}/${newGid()}`] = { type: 'coins', amount: gifts.coins, note, ts, keep: true };
        for (let i = 0; i < (Number(gifts.streakSaver) || 0); i++) upd[`grants/${uid}/${newGid()}`] = { type: 'item', amount: 1, itemId: 'streak_saver', note, ts, keep: true };
        for (const iid of (Array.isArray(gifts.shopItems) ? gifts.shopItems : []).slice(0, 10)) {
          if (/^[A-Za-z0-9_\-]{1,64}$/.test(String(iid))) upd[`grants/${uid}/${newGid()}`] = { type: 'item', amount: 1, itemId: String(iid), note, ts, keep: true };
        }
        await call('PATCH', '', upd);
        await flagGrant(uid);
        return json(200, { ok: true, code, gifts, message: 'Promokod muvaffaqiyatli qabul qilindi! 🎉' });
      }

      // ---------- So'rovnoma & Baholashlar ----------
      case 'getSurvey': {
        const survey = (await call('GET', 'config/survey')) || null;
        return json(200, { survey });
      }

      case 'saveSurvey': {
        const s = body.survey && typeof body.survey === 'object' ? body.survey : {};
        const old = (await call('GET', 'config/survey')) || {};
        const wantId = String(s.id || '');
        const surveyData = {
          id: /^[A-Za-z0-9_\-]{3,40}$/.test(wantId) ? wantId : 'surv_' + Date.now().toString(36),
          title: String(s.title || '').trim().slice(0, 150),
          desc: String(s.desc || '').trim().slice(0, 300),
          active: s.active !== false,
          rewardXp: Math.max(0, Math.min(1000, Math.round(Number(s.rewardXp)) || 0)),
          rewardCoins: Math.max(0, Math.min(10000, Math.round(Number(s.rewardCoins)) || 0)),
          questions: (Array.isArray(s.questions) ? s.questions : []).slice(0, 15).map((q, idx) => ({
            id: /^[A-Za-z0-9_\-]{1,30}$/.test(String(q.id || '')) ? String(q.id) : `q_${idx + 1}`,
            text: String(q.text || '').trim().slice(0, 250),
            type: q.type === 'choice' ? 'choice' : 'text',
            options: q.type === 'choice' && Array.isArray(q.options) ? q.options.map(o => String(o || '').trim().slice(0, 80)).filter(Boolean).slice(0, 12) : [],
          })).filter(q => q.text && (q.type === 'text' || q.options.length >= 2)),
          createdAt: old.id === wantId && old.createdAt ? old.createdAt : Date.now(),
          updatedAt: Date.now(),
        };
        if (!surveyData.title) return json(400, { error: "So'rovnoma sarlavhasini kiriting" });
        if (!surveyData.questions.length) return json(400, { error: "Kamida bitta savol kerak (variantli savolda kamida 2 ta variant)" });
        await call('PUT', 'config/survey', surveyData);
        return json(200, { ok: true, survey: surveyData });
      }

      case 'getActiveSurvey': {
        const survey = (await call('GET', 'config/survey')) || null;
        if (!survey || survey.active === false || !Array.isArray(survey.questions) || !survey.questions.length) return json(200, { survey: null });
        return json(200, { survey });
      }

      case 'submitSurvey': {
        const uid = String(body.uid || '').trim();
        const surveyId = String(body.surveyId || '').trim();
        const bad = verifyUid(uid, body.initData);
        if (bad) return bad;
        const survey = await call('GET', 'config/survey');
        if (!survey || survey.active === false || survey.id !== surveyId) return json(400, { error: "So'rovnoma faol emas yoki yangilangan" });
        const prev = await call('GET', `surveys/responses/${surveyId}/${uid}/ts`);
        if (prev) return json(409, { error: "Siz bu so'rovnomada allaqachon qatnashgansiz", already: true });
        const raw = body.answers && typeof body.answers === 'object' ? body.answers : {};
        const answers = {};
        for (const q of survey.questions || []) {
          const v = String(raw[q.id] ?? '').trim().slice(0, 600);
          if (v) answers[q.id] = v;
        }
        if (!Object.keys(answers).length) return json(400, { error: 'Kamida bitta savolga javob bering' });
        const ts = Date.now();
        await call('PUT', `surveys/responses/${surveyId}/${uid}`, {
          uid, name: String(body.name || "O'quvchi").slice(0, 40), username: String(body.username || '').slice(0, 40), answers, ts,
        });
        if (survey.rewardXp > 0 || survey.rewardCoins > 0) {
          const upd = {};
          if (survey.rewardXp > 0) upd[`grants/${uid}/${newGid()}`] = { type: 'xp', amount: survey.rewardXp, note: "So'rovnomada qatnashish bonusi", ts, keep: true };
          if (survey.rewardCoins > 0) upd[`grants/${uid}/${newGid()}`] = { type: 'coins', amount: survey.rewardCoins, note: "So'rovnoma bonusi", ts, keep: true };
          await call('PATCH', '', upd);
          await flagGrant(uid);
        }
        return json(200, { ok: true, message: "Fikringiz uchun rahmat! So'rovnoma qabul qilindi." });
      }

      case 'submitRating': {
        const uid = String(body.uid || '').trim();
        const bad = verifyUid(uid, body.initData);
        if (bad) return bad;
        const rating = Math.round(Number(body.rating));
        if (!(rating >= 1 && rating <= 5)) return json(400, { error: 'Baho 1 dan 5 gacha bo\'lishi kerak' });
        const criteria = {};
        for (const k of ['vocab', 'games', 'srs', 'design']) {
          const n = Math.round(Number(body.criteria?.[k]));
          if (n >= 1 && n <= 5) criteria[k] = n;
        }
        await call('PUT', `ratings/${uid}`, {
          uid, name: String(body.name || "O'quvchi").slice(0, 40), username: String(body.username || '').slice(0, 40),
          rating, criteria,
          liked: String(body.liked || '').trim().slice(0, 300),
          text: String(body.text || '').trim().slice(0, 1000),
          ts: Date.now(),
        });
        return json(200, { ok: true, message: 'Baholashingiz uchun katta rahmat! ⭐' });
      }

      case 'listFeedback': {
        const [ratings, responses, survey] = await Promise.all([call('GET', 'ratings'), call('GET', 'surveys/responses'), call('GET', 'config/survey')]);
        const rList = Object.entries(ratings || {}).filter(([, r]) => r && typeof r === 'object').map(([id, r]) => ({ id, ...r }));
        rList.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        const sList = [];
        for (const [survId, users] of Object.entries(responses || {})) {
          if (users && typeof users === 'object') for (const [uid, resp] of Object.entries(users)) if (resp && typeof resp === 'object') sList.push({ survId, id: uid, ...resp });
        }
        sList.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return json(200, { ratings: rList.slice(0, 2000), surveys: sList.slice(0, 2000), survey: survey || null });
      }

      case 'deleteFeedback': {
        const id = String(body.id || '').trim();
        if (!ID_RE.test(id)) return json(400, { error: 'ID xato' });
        if (body.type === 'survey') {
          const sid = String(body.survId || '');
          if (!ID_RE.test(sid)) return json(400, { error: 'ID xato' });
          await call('DELETE', `surveys/responses/${sid}/${id}`);
        } else {
          await call('DELETE', `ratings/${id}`);
        }
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "Noma'lum amal" });
    }
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

/** Ochiq (foydalanuvchi) amallari uchun: Telegram imzosini tekshiradi, boshqa odam nomidan yuborib bo'lmaydi */
function verifyUid(uid, initData) {
  if (!ID_RE.test(uid)) return json(400, { error: 'Hisob ID xato' });
  if (uid.startsWith('tg_') && process.env.BOT_TOKEN) {
    const user = verifyInitData(initData, process.env.BOT_TOKEN);
    if (!user || `tg_${user.id}` !== uid) return json(401, { error: 'Telegram imzosi tasdiqlanmadi' });
  }
  return null;
}
