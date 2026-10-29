// (Ixtiyoriy) Botning webhook'i: /start, /stop, /remind buyruqlari. Agar botingiz boshqa joyda ishlayotgan bo'lsa, bu funksiyani ulamang.
// O'rnatish: https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://SAYT.netlify.app/.netlify/functions/tg-webhook&secret_token=<TG_WEBHOOK_SECRET>
import { json, parseBody, sendMessage, openAppMarkup, makeStartMarkup, makeDb, firstNameOf, processReferral, DEFAULT_START_TEXT, DEFAULT_START_BUTTON } from '../lib/tg.mjs';

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
      if (cfg.enabled !== false) {
        // Ism Telegramdagi profildan olinadi (first_name); faqat u umuman bo'lmasa "do'st" deyiladi
        const name = firstNameOf(m.from) || "do'st";
        const text = String(cfg.text || DEFAULT_START_TEXT).replace(/\{name\}/g, name);
        await sendMessage(token, m.chat.id, text, makeStartMarkup(cfg));
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
