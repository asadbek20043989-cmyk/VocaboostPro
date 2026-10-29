// Streak muzlatish haqida OLDINDAN ogohlantirish (Netlify "Scheduled Function"): har soat ishga tushadi.
// Faqat baraban orqali "Streak muzlatish" ❄️ yutgan foydalanuvchilarga (ilova leaderboard/<id> ga `sv` va `lr` yozib boradi):
//   • kecha mashq qilmagan (streak muzlab turibdi)      -> ertalabdan keyin: "streaklaringiz muzladi, saqlash uchun mashqni davom ettiring"
//   • bugun hali mashq qilmagan (kecha qilgan)          -> kechqurun: "bugun mashq qilmasangiz streak muzlaydi"
// Har bir xabar har bir foydalanuvchiga kuniga bir martadan yuboriladi. Sozlamalar (ixtiyoriy): config/streakWarn = { enabled, frozenHour, riskHour }
import { makeDb, tashkentDay, tashkentNow, sendMessage, openAppMarkup } from '../lib/tg.mjs';

// Kredit tejash: kuniga 24 marta emas, faqat kerakli soatlarda (UTC). Toshkent = UTC+5:
//   05:10-07:10 UTC = 10:10-12:10 (muzlagan streak), 14:10-17:10 UTC = 19:10-22:10 (xavf ogohlantirishi).
// Admin paneldan frozenHour/riskHour ni boshqa soatga qo'ysangiz, bu jadvalni ham moslang.
export const config = { schedule: '10 5-7,14-17 * * *' };

const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MAX_PER_RUN = 150;

export const handler = async () => {
  const token = process.env.BOT_TOKEN;
  const db = makeDb();
  if (!token || !db) return { statusCode: 200, body: 'not configured' };
  const cfg = (await db('GET', 'config/streakWarn')) || {};
  if (cfg.enabled === false) return { statusCode: 200, body: 'disabled' };
  const frozenHour = Number.isFinite(Number(cfg.frozenHour)) ? Number(cfg.frozenHour) : 10;
  const riskHour = Number.isFinite(Number(cfg.riskHour)) ? Number(cfg.riskHour) : 19;
  const day = tashkentDay();
  const hour = tashkentNow().getUTCHours();
  if (hour < Math.min(frozenHour, riskHour)) return { statusCode: 200, body: 'early' };
  const yesterday = addDays(day, -1);
  const twoAgo = addDays(day, -2);

  const [lb, users] = await Promise.all([db('GET', 'leaderboard'), db('GET', 'tgusers')]);
  const markup = openAppMarkup('🚀 Mashq qilish');
  let sent = 0;
  let blocked = 0;

  for (const [uid, e] of Object.entries(lb || {})) {
    if (sent >= MAX_PER_RUN) break; // qolganlari keyingi soatda
    if (!uid.startsWith('tg_') || !e || e.hidden || e.deleted) continue;
    const id = uid.slice(3);
    const u = (users || {})[id];
    if (!u || u.blocked || u.remind === false) continue;
    const savers = Number(e.sv) || 0;
    const streak = Number(e.streak) || 0;
    const lr = String(e.lr || '');
    if (savers <= 0 || streak <= 0 || !lr) continue;

    let kind = null;
    if (lr === twoAgo && hour >= frozenHour) kind = 'frozen';
    else if (lr === yesterday && hour >= riskHour) kind = 'risk';
    if (!kind) continue;
    const mark = kind === 'frozen' ? 'swF' : 'swR';
    if (u[mark] === day) continue;

    const name = String(u.name || e.name || '').trim().split(' ')[0].slice(0, 40) || "do'st";
    const text =
      kind === 'frozen'
        ? `❄️ ${name}, to'plagan ${streak} kunlik streakingiz muzladi!\n\nSaqlab qolish uchun bugun kunlik mashqlarni bajarishda davom eting 👇`
        : `⏳ ${name}, bugun hali mashq qilmadingiz.\n\nBugun mashq qilmasangiz ${streak} kunlik streakingiz muzlaydi ❄️ Muzlab qolmasligi uchun hoziroq mashq qiling 👇`;

    try {
      await sendMessage(token, Number(id), text, markup);
      sent++;
      await db('PATCH', `tgusers/${id}`, { [mark]: day }).catch(() => {});
    } catch (err) {
      if (err.code === 429) {
        await sleep(((err.retryAfter || 2) + 0.5) * 1000);
      } else if (err.code === 403 || /blocked|deactivated|chat not found/i.test(String(err.message))) {
        blocked++;
        await db('PATCH', `tgusers/${id}`, { blocked: true }).catch(() => {});
      }
    }
    await sleep(50);
  }
  return { statusCode: 200, body: `sent ${sent}, blocked ${blocked}` };
};
