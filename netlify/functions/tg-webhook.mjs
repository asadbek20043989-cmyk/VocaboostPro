// (Ixtiyoriy) Botning webhook'i: /start, /stop, /remind buyruqlari. Agar botingiz boshqa joyda ishlayotgan bo'lsa, bu funksiyani ulamang.
// O'rnatish: https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://SAYT.netlify.app/.netlify/functions/tg-webhook&secret_token=<TG_WEBHOOK_SECRET>
import { json, parseBody, sendMessage, openAppMarkup, makeStartMarkup, makeDb, firstNameOf, DEFAULT_START_TEXT, DEFAULT_START_BUTTON } from '../lib/tg.mjs';

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
      const prevUser = db && (await db('GET', `tgusers/${id}`));
      await upsert();

      // Referral (Do'stlarni taklif qilish) tekshiruvi: /start ref_123456
      const parts = text.split(/\s+/);
      const arg = parts[1] || '';
      if (!prevUser?.referredBy && arg) {
        let rawRef = '';
        if (arg.startsWith('ref_')) rawRef = arg.slice(4).trim();
        else if (/^\d+$/.test(arg)) rawRef = arg.trim();

        if (rawRef) {
          const referrerKey = rawRef.startsWith('tg_') || rawRef.startsWith('web_') ? rawRef : `tg_${rawRef}`;
          const isSelf = referrerKey === `tg_${id}` || referrerKey === String(id);

          if (!isSelf && db) {
            try {
              const friendName = firstNameOf(m.from) || "Do'stingiz";
              const refCfg = (await db('GET', 'config/referral')) || {};
              const refXp = Number.isFinite(Number(refCfg.rewardXp)) ? Number(refCfg.rewardXp) : 50;
              const refCoins = Number.isFinite(Number(refCfg.rewardCoins)) ? Number(refCfg.rewardCoins) : 30;

              // Referal yozuvi saqlanadi
              await db('PUT', `referrals/${referrerKey}/${id}`, {
                name: friendName,
                username: String(m.from?.username || '').slice(0, 40),
                ts: Date.now(),
              });
              await db('PATCH', `tgusers/${id}`, { referredBy: referrerKey, referredAt: Date.now() });

              // Taklif qilgan foydalanuvchining reytingi va hisobiga XP va tangalar qo'shiladi
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

              // Foydalanuvchiga sovg'a (grant) yoziladi — ilovani ochgan zahoti darhol hisobiga qo'shiladi
              const gid = 'g_ref_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              await db('PUT', `grants/${referrerKey}/${gid}`, {
                type: 'xp',
                amount: refXp,
                coins: refCoins,
                note: `"${friendName}" do'stingiz taklif qilindi (+${refXp} XP)`,
                ts: Date.now(),
              });
              await db('PATCH', `leaderboard/${referrerKey}`, { hasGrant: true });

              // Taklif qiluvchining Telegram profiliga darhol bot tomonidan xabar boradi
              if (referrerKey.startsWith('tg_')) {
                const referrerTgId = Number(referrerKey.slice(3));
                const notifyText = `🎉 "${friendName}" ismli do'stingiz siz yuborgan link orqali botimizga qo'shildi, shuning uchun sizga ${refXp}XP berildi. Taklif qilgan do'stlaringiz soni ${newRefCount} ta`;
                await sendMessage(token, referrerTgId, notifyText, openAppMarkup('🚀 VocaBoostni ochish'), 'HTML').catch(() => {});
              }
            } catch (refErr) {
              console.warn('Referral error:', refErr);
            }
          }
        }
      }

      // Xabar matni va tugma yozuvi admin paneldan (🤖 Bot) o'zgartiriladi
      const cfg = (db && (await db('GET', 'config/botStart'))) || {};
      if (cfg.enabled !== false) {
        // Ism Telegramdagi profildan olinadi (first_name); faqat u umuman bo'lmasa "do'st" deyiladi
        const name = firstNameOf(m.from) || "do'st";
        const text = String(cfg.text || DEFAULT_START_TEXT).replace(/\{name\}/g, name);
        await sendMessage(token, m.chat.id, text, makeStartMarkup(cfg));
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
