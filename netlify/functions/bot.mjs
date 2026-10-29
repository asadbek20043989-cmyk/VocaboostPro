// Telegram bot bilan ishlash (Mini App'dan chaqiriladi). Netlify env: BOT_TOKEN, FIREBASE_DB_URL, FIREBASE_DB_SECRET
// Har bir so'rov Telegram `initData` imzosi bilan tekshiriladi — boshqa odam nomidan yuborib bo'lmaydi.
//  register        — foydalanuvchini eslatmalar uchun ro'yxatga oladi
//  setRemind       — eslatmani yoqish/o'chirish
//  sendCertificate — sertifikat rasmini foydalanuvchining chatiga yuboradi
import { json, parseBody, verifyInitData, tgApi, openAppMarkup, makeDb } from '../lib/tg.mjs';

const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);

export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST kerak' });
  const token = process.env.BOT_TOKEN;
  if (!token) return json(503, { error: 'Bot sozlanmagan (BOT_TOKEN yo\'q)' });
  const body = parseBody(event);
  if (!body) return json(400, { error: "Noto'g'ri so'rov" });
  const user = verifyInitData(body.initData, token);
  if (!user) return json(401, { error: 'Telegram imzosi tasdiqlanmadi' });
  const id = Number(user.id);

  try {
    if (body.action === 'register' || body.action === 'setRemind') {
      const db = makeDb();
      if (!db) return json(503, { error: 'Baza sozlanmagan' });
      const remind = body.remind !== false;
      if (body.action === 'setRemind') {
        await db('PATCH', `tgusers/${id}`, { remind, ts: Date.now() });
        return json(200, { ok: true, remind });
      }
      const prev = await db('GET', `tgusers/${id}`);
      await db('PATCH', `tgusers/${id}`, {
        name: clean([user.first_name, user.last_name].filter(Boolean).join(' '), 60),
        username: clean(user.username, 40),
        lang: clean(user.language_code, 8),
        wa: !!user.allows_write_to_pm,
        remind,
        level: ['A1', 'A2', 'B1', 'B2+'].includes(body.level) ? body.level : null,
        wpd: Math.max(0, Math.min(100, Number(body.wordsPerDay) || 0)) || null,
        lastSeen: Date.now(),
        ts: Date.now(),
        ...(prev ? {} : { joined: Date.now() }),
      });
      return json(200, { ok: true, remind });
    }

    if (body.action === 'processReferral') {
      const db = makeDb();
      if (!db) return json(503, { error: 'Baza sozlanmagan' });
      const refParam = clean(body.startParam, 60);
      if (!refParam || !refParam.startsWith('ref_')) return json(200, { ok: false, reason: 'No ref param' });

      const prevUser = await db('GET', `tgusers/${id}`);
      if (prevUser?.referredBy) return json(200, { ok: false, reason: 'Already referred' });

      let rawRef = refParam.slice(4).trim();
      if (!rawRef) return json(200, { ok: false });
      const referrerKey = rawRef.startsWith('tg_') || rawRef.startsWith('web_') ? rawRef : `tg_${rawRef}`;
      if (referrerKey === `tg_${id}` || referrerKey === String(id)) return json(200, { ok: false, reason: 'Self referral' });

      const friendName = clean([user.first_name, user.last_name].filter(Boolean).join(' ') || user.first_name, 40) || "Do'stingiz";
      const refCfg = (await db('GET', 'config/referral')) || {};
      const refXp = Number.isFinite(Number(refCfg.rewardXp)) ? Number(refCfg.rewardXp) : 50;
      const refCoins = Number.isFinite(Number(refCfg.rewardCoins)) ? Number(refCfg.rewardCoins) : 30;

      await db('PUT', `referrals/${referrerKey}/${id}`, {
        name: friendName,
        username: clean(user.username, 40),
        ts: Date.now(),
      });
      await db('PATCH', `tgusers/${id}`, { referredBy: referrerKey, referredAt: Date.now() });

      const curLb = (await db('GET', `leaderboard/${referrerKey}`)) || {};
      const newRefCount = (Number(curLb.refCount) || 0) + 1;
      const newXp = (Number(curLb.xp) || 0) + refXp;
      const newAdj = (Number(curLb.adj) || 0) + refXp;
      const newAdjV = (Number(curLb.adjV) || 0) + 1;
      const newCoins = (Number(curLb.coins) || 0) + refCoins;

      await db('PATCH', `leaderboard/${referrerKey}`, {
        refCount: newRefCount,
        xp: newXp,
        adj: newAdj,
        adjV: newAdjV,
        coins: newCoins,
        ts: Date.now(),
      });

      const gid = 'g_ref_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await db('PUT', `grants/${referrerKey}/${gid}`, {
        type: 'xp',
        amount: refXp,
        coins: refCoins,
        note: `"${friendName}" do'stingiz taklif qilindi (+${refXp} XP)`,
        ts: Date.now(),
      });
      await db('PATCH', `leaderboard/${referrerKey}`, { hasGrant: true });

      if (referrerKey.startsWith('tg_')) {
        const referrerTgId = Number(referrerKey.slice(3));
        const notifyText = `🎉 "${friendName}" ismli do'stingiz siz yuborgan link orqali botimizga qo'shildi, shuning uchun sizga ${refXp}XP berildi. Taklif qilgan do'stlaringiz soni ${newRefCount} ta`;
        await sendMessage(token, referrerTgId, notifyText, openAppMarkup('🚀 VocaBoostni ochish'), 'HTML').catch(() => {});
      }

      return json(200, { ok: true, rewardXp: refXp, rewardCoins: refCoins });
    }

    if (body.action === 'sendCertificate') {
      const certId = clean(body.id, 20);
      if (!/^[A-Za-z0-9-]{3,20}$/.test(certId)) return json(400, { error: 'Sertifikat raqami xato' });
      const b64 = String(body.image || '');
      if (b64.length < 1000 || b64.length > 5_000_000) return json(400, { error: 'Rasm hajmi xato' });
      const buf = Buffer.from(b64, 'base64');
      if (buf[0] !== 0xff || buf[1] !== 0xd8) return json(400, { error: 'Faqat JPEG qabul qilinadi' });
      const asDoc = body.kind === 'document';
      const form = new FormData();
      form.append('chat_id', String(id));
      form.append('caption', `🎓 ${clean(body.title, 100) || 'Sertifikat'}\n№ ${certId} · ${clean(body.date, 10)}\n\nVocaBoost — so'zlarni tez va uzoq yodlang`);
      const markup = openAppMarkup('🚀 Mashqni davom ettirish');
      if (markup) form.append('reply_markup', JSON.stringify(markup));
      form.append(asDoc ? 'document' : 'photo', new Blob([buf], { type: 'image/jpeg' }), `VocaBoost-${certId}.jpg`);
      try {
        await tgApi(token, asDoc ? 'sendDocument' : 'sendPhoto', form);
      } catch (e) {
        const forbidden = e.code === 403 || /chat not found|blocked|deactivated/i.test(e.message);
        return json(forbidden ? 409 : 502, { error: forbidden ? "Bot sizga yoza olmaydi: botni ochib «Start» bosing" : `Telegram: ${e.message}` });
      }
      return json(200, { ok: true });
    }

    return json(400, { error: "Noma'lum amal" });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
