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
