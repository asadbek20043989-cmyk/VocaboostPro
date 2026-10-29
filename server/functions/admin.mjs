// Admin API (Vercel funksiyasi). Admin kodi va baza siri FAQAT server muhit o'zgaruvchilarida saqlanadi.
// Vercel > Settings > Environment Variables:
//   ADMIN_CODE            — admin panelga kirish kodi
//   FIREBASE_DB_URL       — https://<project>-default-rtdb.firebaseio.com
//   FIREBASE_DB_SECRET    — Realtime Database "Database secret" (Project settings > Service accounts > Database secrets)
import { timingSafeEqual } from 'node:crypto';
import { tgApi, sendMessage, sendPhoto, openAppMarkup, makeStartMarkup, makeCustomButtonsMarkup, siteUrl, issueCertificate, statsFromLb, CERT_TPLS, DEFAULT_START_TEXT, DEFAULT_START_BUTTON, tashkentDay } from '../lib/tg.mjs';

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
      // so'ngra hammaning liga XP si 0 ga tushiriladi va yangi hafta boshlanadi.
      case 'resetLeague': {
        const lb = (await call('GET', 'leaderboard')) || {};
        const league = (await call('GET', 'config/league')) || {};
        const week = Math.max(1, Math.round(Number(league.week) || 1)); // yakunlanayotgan hafta raqami
        const hallId = 'w' + String(week).padStart(4, '0');
        if (await call('GET', `hall/${hallId}/week`)) return json(400, { error: `${week}-hafta allaqachon Tarix zaliga yozilgan (qayta yozib bo'lmaydi). Sahifani yangilang.` });

        const shownOf = e => Math.max(0, (Number(e?.xp) || 0) + (Number(e?.xpOffset) || 0));
        const ranked = Object.entries(lb)
          .filter(([, e]) => e && !e.deleted && !e.hidden && shownOf(e) > 0)
          .map(([uid, e]) => ({ uid, e, xp: shownOf(e) }))
          .sort((a, b) => b.xp - a.xp || (Number(a.e.ts) || 0) - (Number(b.e.ts) || 0))
          .slice(0, 20);
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
          await call('PUT', `hall/${hallId}`, { week, startedAt: Number(league.startedAt) || 0, endedAt, date: tashkentDay(), players: totalPlayers, top });
        }

        // Ixtiyoriy mukofotlar: TOP-3 ga baraban aylantirishlari, 1-o'ringa «Hafta chempioni» sertifikati
        let rewarded = 0;
        if (body.rewardSpins) {
          const spins = [5, 3, 2];
          for (let i = 0; i < Math.min(3, ranked.length); i++) {
            await call('PUT', `grants/${ranked[i].uid}/${newGid()}`, { type: 'spins', amount: spins[i], validHours: 72, note: `${week}-hafta ligasi: ${i + 1}-o'rin`, ts: Date.now() });
            await flagGrant(ranked[i].uid);
            rewarded++;
          }
        }
        if (body.rewardCert && ranked[0]) {
          await issueCertificate(call, {
            userId: ranked[0].uid, tpl: 'weekly', label: `${week}-HAFTA CHEMPIONI`, title: `${week}-hafta ligasi g'olibi`, reason: `${ranked[0].xp} XP bilan haftaning eng kuchli o'quvchisi bo'ldi`,
            name: top[0].name, fmt: body.certFmt === 'story' ? 'story' : 'wide', stats: statsFromLb(ranked[0].e),
          });
          rewarded++;
        }

        const upd = {};
        for (const [id, e] of Object.entries(lb)) {
          const shown = shownOf(e);
          upd[`${id}/xp`] = 0; // hamma uchun XP 0 dan boshlanadi
          upd[`${id}/xpOffset`] = 0;
          upd[`${id}/adj`] = (Number(e?.adj) || 0) - shown; // foydalanuvchining o'z hisobi ham 0 dan boshlanadi (farq sifatida)
          upd[`${id}/adjV`] = (Number(e?.adjV) || 0) + 1;
        }
        if (Object.keys(upd).length) await call('PATCH', 'leaderboard', upd);
        await call('PUT', 'config/league', { week: week + 1, startedAt: endedAt });
        return json(200, { ok: true, count: Object.keys(upd).length / 4, week, archived: top.length, rewarded });
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
        list.forEach((w, i) => {
          const en = str(w.en, 60), uz = str(w.uz, 120);
          if (!en || !uz) return errors.push(`${i + 1}-qator: inglizcha so'z va o'zbekcha ma'no kerak`);
          const id = ID_RE.test(w.id || '') ? w.id : slug(en);
          if (!id) return errors.push(`${i + 1}-qator: so'z noto'g'ri`);
          upd[id] = {
            en, uz,
            ipa: str(w.ipa, 60), pos: str(w.pos, 20),
            ex: str(w.ex, 220), exUz: str(w.exUz, 260),
            col: arrOf(w.col), fam: arrOf(w.fam),
            hook: str(w.hook, 260), topic: str(w.topic, 40),
            level: ['A1', 'A2', 'B1', 'B2+'].includes(w.level) ? w.level : 'B1',
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

      // ---------- O'yinlar / baraban / umumiy sozlamalar ----------
      case 'setConfig': {
        const key = body.key;
        if (!['games', 'wheel', 'settings', 'reminder'].includes(key)) return json(400, { error: 'Kalit xato' });
        const v = body.value;
        if (!v || typeof v !== 'object' || JSON.stringify(v).length > 40000) return json(400, { error: "Qiymat noto'g'ri yoki juda katta" });
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
        const text = String(body.text || '').trim().slice(0, 1000);
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
        const text = String(body.text || '').trim().slice(0, 1000);
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
            await sendMessage(process.env.BOT_TOKEN, Number(userId.slice(3)), `🎓 Sizga maxsus sertifikat berildi!\n\n«${t}»\n№ ${id}\n\nIlovani oching — sertifikat shu chatga rasm bo'lib keladi.`, openAppMarkup('🎓 Sertifikatni olish'));
            notified = true;
          } catch {
            /* foydalanuvchi botni boshlamagan bo'lishi mumkin */
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
        // Bitta so'rovda ko'p yo'lni yangilash (Firebase multi-path update) — tez va arzon
        for (let i = 0; i < targets.length; i += 200) {
          const upd = {};
          targets.slice(i, i + 200).forEach(uid => {
            upd[`grants/${uid}/${newGid()}`] = { type, amount: n, validHours, ...(type === 'item' ? { itemId } : {}), note: String(note || '').slice(0, 80), ts };
            upd[`leaderboard/${uid}/hasGrant`] = true;
          });
          if (targets.length === 1 && !(await call('GET', `leaderboard/${targets[0]}/ts`))) {
            const only = Object.keys(upd).filter(k => k.startsWith('grants/'));
            const u2 = {}; only.forEach(k => (u2[k] = upd[k]));
            await call('PATCH', '', u2); // reyting yozuvi yo'q: bo'sh yozuv yaratilmaydi
          } else await call('PATCH', '', upd);
        }
        return json(200, { ok: true, count: targets.length });
      }

      // ---------- Do'kon va taklif sozlamalari ----------
      case 'setShop': {
        const v = body.value;
        if (!v || typeof v !== 'object' || JSON.stringify(v).length > 90000) return json(400, { error: "Qiymat noto'g'ri yoki juda katta" });
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
          enabled: body.enabled !== false,
        });
        return json(200, { ok: true });
      }

      // Minnatdorchilik (ilk kirish) sertifikati matni
      case 'getThanksCert': {
        const cfg = (await call('GET', 'config/thanksCert')) || {};
        return json(200, {
          title: cfg.title || '"Vocaboost" ilovamizga tashrif buyurganizdan bag\'oyatda mamnunmiz!!!',
          reason: cfg.reason || 'Hali oldinda sizni ko‘p sertifikat va sovrinlar kutmoqda...',
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
        await tgApi(process.env.BOT_TOKEN, 'setWebhook', { url, allowed_updates: ['message'], drop_pending_updates: false, ...(process.env.TG_WEBHOOK_SECRET ? { secret_token: process.env.TG_WEBHOOK_SECRET } : {}) });
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
        await sendMessage(process.env.BOT_TOKEN, to, String(cfg.text || DEFAULT_START_TEXT).replace(/\{name\}/g, nm || "do'st"), makeStartMarkup(cfg));
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
          items.push({ uid, id: x.id, tpl: c.tpl, title: c.title || '', reason: c.reason || '', name: c.name || '', date: c.date || '', fmt: c.fmt || (c.tpl === 'thanks' ? 'story' : 'wide'), stats: c.stats || null, sent: !!c.sent, tg: /^tg_\d+$/.test(uid) });
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
          id, title: p.title || '', desc: p.desc || '', kind: p.kind || 'open', date: p.date || '', mode: p.mode || 'replace',
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
        const str = (v, n) => String(v ?? '').trim().slice(0, n);
        const title = str(body.title, 80);
        if (!title) return json(400, { error: "To'plam nomini kiriting" });
        const kind = body.kind === 'daily' ? 'daily' : 'open';
        const date = str(body.date, 10);
        if (kind === 'daily' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: 'Kunlik to\'plam uchun sanani tanlang' });
        const packId = ID_RE.test(body.id || '') ? body.id : 'k' + Date.now().toString(36);
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
            level: ['A1', 'A2', 'B1', 'B2+'].includes(w.level) ? w.level : 'B1', order: i, published: true,
          };
        });
        const prev = await call('GET', `packs/${packId}/createdAt`);
        const meta = {
          title, desc: str(body.desc, 240), kind, date: kind === 'daily' ? date : '', mode: body.mode === 'extra' ? 'extra' : 'replace',
          order: Number.isFinite(Number(body.order)) ? Number(body.order) : 0, published: body.published !== false, createdAt: prev || Date.now(),
        };
        if (list.length) {
          if (!Object.keys(words).length) return json(400, { error: errors.slice(0, 5).join('; ') || "So'zlar topilmadi" });
          await call('PUT', `packs/${packId}`, { ...meta, words });
        } else {
          if (!prev) return json(400, { error: "Kamida bitta so'z kiriting" });
          await call('PATCH', `packs/${packId}`, meta); // so'zlar o'zgarmaydi, faqat sozlamalar
        }
        await call('PUT', 'config/packsVersion', Date.now());
        return json(200, { ok: true, id: packId, saved: Object.keys(words).length, errors });
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

      default:
        return json(400, { error: "Noma'lum amal" });
    }
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
