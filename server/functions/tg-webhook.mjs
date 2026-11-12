// (Ixtiyoriy) Botning webhook'i: /start, /stop, /remind buyruqlari. Agar botingiz boshqa joyda ishlayotgan bo'lsa, bu funksiyani ulamang.
// O'rnatish: https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://SAYT.vercel.app/api/fn/tg-webhook&secret_token=<TG_WEBHOOK_SECRET>
import { json, parseBody, sendMessage, openAppMarkup, makeStartMarkup, makeDb, firstNameOf, processReferral, escHtml, siteUrl, DEFAULT_START_TEXT, DEFAULT_START_BUTTON } from '../lib/tg.mjs';

export const handler = async event => {
  const token = process.env.BOT_TOKEN;
  if (event.httpMethod !== 'POST' || !token) return json(200, { ok: true });
  const want = process.env.TG_WEBHOOK_SECRET;
  const got = event.headers?.['x-telegram-bot-api-secret-token'];
  if (want && got !== want) return json(401, { ok: false });
  const upd = parseBody(event);
  const db = makeDb();

  // Foydalanuvchi botni bloklaganda yoki blokdan chiqarganda
  if (upd?.my_chat_member) {
    const mcm = upd.my_chat_member;
    const uid = mcm?.from?.id;
    const status = mcm?.new_chat_member?.status;
    if (uid && db) {
      if (status === 'kicked' || status === 'left') {
        await db('PATCH', `tgusers/${uid}`, { blocked: true, blockedAt: Date.now() }).catch(() => {});
      } else if (status === 'member') {
        await db('PATCH', `tgusers/${uid}`, { blocked: null, unblockedAt: Date.now() }).catch(() => {});
      }
    }
    return json(200, { ok: true });
  }

  const m = upd?.message;

  // Botga PREMIUM EMOJI yuborilsa — uning ID raqamini qaytaradi. Yuboruvchi admin bo'lsa, kutubxonaga ham avtomatik qo'shiladi
  // (admin panel → 🤖 Bot → 💎 Premium emojilar). Admin: ADMIN_CHAT_ID (env) yoki admin paneldagi «admin Telegram ID».
  if (m?.chat?.type === 'private' && m.from?.id) {
    const raw = String(m.text ?? m.caption ?? '');
    const ents = [...(m.entities || []), ...(m.caption_entities || [])].filter(e => e?.type === 'custom_emoji' && e.custom_emoji_id);
    if (ents.length) {
      try {
        const seen = new Map();
        for (const e of ents) if (!seen.has(e.custom_emoji_id)) seen.set(e.custom_emoji_id, raw.substr(e.offset, e.length) || '⭐');
        const items = [...seen.entries()].slice(0, 20);
        const cfgChat = db ? await db('GET', 'config/shop/adminChat').catch(() => null) : null;
        const admins = String(process.env.ADMIN_CHAT_ID || '').split(/[,\s]+/).concat(String(cfgChat || '').split(/[,\s]+/)).filter(Boolean);
        const isAdmin = admins.includes(String(m.from.id));
        let saved = false;
        if (isAdmin && db) {
          const upd2 = {};
          items.forEach(([id, ch]) => { upd2[`adminState/emojis/${id}`] = { e: String(ch).slice(0, 8) }; });
          await db('PATCH', '', upd2);
          saved = true;
        }
        const lines = items.map(([id, ch]) => `${escHtml(ch)} <code>${id}</code>`).join('\n');
        await sendMessage(token, m.chat.id, `💎 <b>Premium emoji ID:</b>\n\n${lines}\n\n${saved ? "✅ Admin panel kutubxonasiga qo'shildi." : "Admin panelda «💎 Premium emojilar» bo'limiga shu ID ni kiriting."}`);
      } catch {
        /* jim */
      }
      return json(200, { ok: true });
    }
  }

  const text = String(m?.text || '').trim();
  if (!m?.chat || m.chat.type !== 'private' || !text.startsWith('/')) return json(200, { ok: true });
  const id = m.from?.id;
  const cmd = text.split(/[\s@]/)[0].toLowerCase();
  try {
    const db = makeDb();
    const upsert = async remind => {
      if (!db || !id) return;
      const prev = await db('GET', `tgusers/${id}`);
      await db('PATCH', `tgusers/${id}`, {
        name: [m.from.first_name, m.from.last_name].filter(Boolean).join(' ').slice(0, 60),
        username: String(m.from.username || '').slice(0, 40),
        wa: true,
        blocked: null,
        ts: Date.now(),
        ...(remind === undefined ? {} : { remind }),
        ...(prev ? {} : { joined: Date.now(), remind: remind ?? true }),
      });
    };
    if (cmd === '/start') {
      // Havola orqali kelgan bo'lsa (/start ref_<ID>): do'st FAQAT birinchi marta start bosganda hisobga olinadi
      const refParam = (text.split(/\s+/)[1] || '').trim();
      const wasNew = !!(db && id) && !(await db('GET', `tgusers/${id}`).catch(() => null));
      await upsert();
      // Xabar matni va tugma yozuvi admin paneldan (🤖 Bot) o'zgartiriladi
      const cfg = (db && (await db('GET', 'config/botStart'))) || {};
      // Do'st taklifi (t.me/<bot>?start=bd_KOD yoki duel_KOD): Telegram bunday havolada ilovaga parametr bermaydi,
      // shuning uchun kodni ilova manziliga qo'shib, to'g'ridan-to'g'ri duelga olib boradigan tugma yuboramiz
      const duelM = /^(bd|duel)_([A-Za-z0-9]{4,12})$/.exec(refParam);
      if (duelM && siteUrl().startsWith('https://')) {
        const q = duelM[1] === 'bd' ? 'bd' : 'duel';
        try {
          await sendMessage(token, m.chat.id, `⚔️ <b>Do'stingiz sizni Blitz Duelga chaqirdi!</b>\n\nQo'shilish uchun pastdagi tugmani bosing 👇`, {
            inline_keyboard: [[{ text: '⚔️ Duelga qo\'shilish', web_app: { url: `${siteUrl()}/?${q}=${duelM[2].toUpperCase()}` } }]],
          });
        } catch { /* ignore */ }
      }
      if (cfg.enabled !== false && !(duelM && !wasNew)) {
        // Ism Telegramdagi profildan olinadi (first_name); faqat u umuman bo'lmasa "do'st" deyiladi
        const name = firstNameOf(m.from) || "do'st";
        const text = String(cfg.text || DEFAULT_START_TEXT).replace(/\{name\}/g, escHtml(name));
        await sendMessage(token, m.chat.id, text, makeStartMarkup(cfg));
      }
      // Promokod havolasi (t.me/<bot>?start=promo_KOD): ilova promokod oynasi ochiq holda ochiladi
      if (/^promo_[A-Za-z0-9_\-]{3,32}$/.test(refParam) && siteUrl().startsWith('https://')) {
        const pc = refParam.slice(6).toUpperCase();
        try {
          await sendMessage(token, m.chat.id, `🎟️ Promokod: <b>${escHtml(pc)}</b>\n\nSovg'angizni olish uchun pastdagi tugmani bosing 👇`, {
            inline_keyboard: [[{ text: '🎁 Sovg\'ani olish', web_app: { url: `${siteUrl()}/?promo=${encodeURIComponent(pc)}` } }]],
          });
        } catch { /* ignore */ }
      }
      // Yangi foydalanuvchi: 2 minutdan (120 soniyadan) keyin Minnatdorchilik sertifikatini yuborish uchun navbat
      if (wasNew && db && id) {
        try {
          const name = firstNameOf(m.from) || "O'quvchi";
          const delaySec = 120; // 2 minut; welcome-cron config/thanksCert.delaySec bilan o'zgartiriladi
          await db('PUT', `pendingWelcome/${id}`, {
            name,
            chatId: id,
            at: Date.now(),
            sendAt: Date.now() + delaySec * 1000,
            sent: false,
          });
        } catch { /* ignore */ }
      }
      if (wasNew && db && /^ref_\d{3,15}$/.test(refParam)) {
        try {
          await processReferral(db, token, m.from, refParam.slice(4));
        } catch {
          /* xato bo'lsa ham start xabari allaqachon yuborilgan */
        }
      }
    } else if (cmd === '/stop') {
      await upsert(false);
      await sendMessage(token, m.chat.id, "🔕 Kunlik eslatmalar o'chirildi. Qayta yoqish uchun /remind ni yuboring.");
    } else if (cmd === '/remind') {
      await upsert(true);
      await sendMessage(token, m.chat.id, '🔔 Kunlik eslatmalar yoqildi!', openAppMarkup());
    }
  } catch {
    /* Telegram qayta yubormasligi uchun doim 200 */
  }
  return json(200, { ok: true });
};
