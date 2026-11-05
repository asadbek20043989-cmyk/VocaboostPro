// Minnatdorchilik sertifikatini /start dan N soniya o'tgach yuborish (Vercel Cron: har daqiqa).
// Navbat: pendingWelcome/{tgId} = { name, chatId, at, sendAt, sent }
// Sozlama: config/thanksCert = { title, reason, delaySec, enabled, caption }
import {
  makeDb,
  siteUrl,
  sendPhoto,
  sendMessage,
  openAppMarkup,
  issueCertificate,
  escHtml,
} from '../lib/tg.mjs';

export const config = { schedule: '* * * * *' }; // har daqiqa

const WELCOME_TITLE = '"Vocaboost" ilovamizga tashrif buyurganizdan bag\'oyatda mamnunmiz!!!';
const WELCOME_REASON = 'Hali oldinda sizni ko‘p sertifikat va sovrinlar kutmoqda...';
const DEFAULT_DELAY = 60;
const MAX_PER_RUN = 40;
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const handler = async () => {
  const token = process.env.BOT_TOKEN;
  const db = makeDb();
  if (!token || !db) return { statusCode: 200, body: 'not configured' };

  const cfg = (await db('GET', 'config/thanksCert').catch(() => null)) || {};
  if (cfg.enabled === false) return { statusCode: 200, body: 'disabled' };

  const delaySec = Math.max(30, Math.min(600, Number(cfg.delaySec) || DEFAULT_DELAY));
  const title = String(cfg.title || WELCOME_TITLE).trim().slice(0, 100);
  const reason = String(cfg.reason || WELCOME_REASON).trim().slice(0, 200);
  const now = Date.now();

  let pending = {};
  try {
    pending = (await db('GET', 'pendingWelcome')) || {};
  } catch {
    return { statusCode: 200, body: 'no pending' };
  }
  if (!pending || typeof pending !== 'object') return { statusCode: 200, body: 'empty' };

  const due = Object.entries(pending)
    .filter(([, v]) => {
      if (!v || v.sent) return false;
      const at = Number(v.at) || 0;
      const sendAt = Number(v.sendAt) || (at + delaySec * 1000);
      // Configdagi delaySec o'zgarsa ham ishlashi uchun at+delaySec ham tekshiriladi
      return Math.min(sendAt, at + delaySec * 1000) <= now;
    })
    .slice(0, MAX_PER_RUN);

  if (!due.length) return { statusCode: 200, body: 'none due' };

  const base = siteUrl();
  // Sertifikat fon rasmi (Telegram HTTPS URL orqali o'qiydi)
  const photoUrl = base.startsWith('https://') ? `${base}/certs/bg_thanks.jpg?v=7` : null;

  let sent = 0;
  let failed = 0;

  for (const [tgId, row] of due) {
    const chatId = Number(row.chatId || tgId);
    const name = String(row.name || "O'quvchi").slice(0, 40);
    const uid = `tg_${tgId}`;

    try {
      // Allaqachon berilgan bo'lsa — faqat rasm/xabar yuboramiz, qayta issue qilmaymiz
      let certId = null;
      let certDate = null;
      const had = await db('GET', `welcomeIdx/${uid}`).catch(() => null);
      if (had && had.id) {
        certId = had.id;
        certDate = had.date || null;
      } else {
        // Band qilish (ikki marta yuborilmasin)
        try {
          await db('PUT', `welcomeIdx/${uid}`, { pending: true, ts: Date.now() });
        } catch { /* continue */ }
        const issued = await issueCertificate(db, {
          userId: uid,
          tpl: 'thanks',
          title,
          reason,
          name,
          auto: true,
          fmt: 'wide',
        });
        certId = issued.id;
        certDate = issued.date;
        await db('PUT', `welcomeIdx/${uid}`, { id: certId, date: certDate, ts: Date.now() });
      }

      const caption =
        String(cfg.caption || '').trim() ||
        `🎓 <b>Minnatdorchilik sertifikati</b>\n\n` +
          `Hurmatli <b>${escHtml(name)}</b>!\n\n` +
          `${escHtml(title)}\n\n` +
          `<i>${escHtml(reason)}</i>\n\n` +
          (certId ? `№ <code>${escHtml(certId)}</code>${certDate ? ` · ${escHtml(certDate)}` : ''}\n\n` : '') +
          `VocaBoost jamoasi 💚`;

      const markup = openAppMarkup('🚀 VocaBoostni ochish');

      if (photoUrl) {
        try {
          await sendPhoto(token, chatId, photoUrl, caption, markup, 'HTML');
        } catch {
          // Rasm yuborilmasa — matn bilan yuboramiz
          await sendMessage(token, chatId, caption, markup, 'HTML');
        }
      } else {
        await sendMessage(token, chatId, caption, markup, 'HTML');
      }

      await db('PUT', `pendingWelcome/${tgId}`, { ...row, sent: true, sentAt: Date.now(), certId });
      sent++;
      await sleep(80); // Telegram rate limit
    } catch (e) {
      failed++;
      // Bloklagan / chat topilmasa — qayta urinmaslik
      const msg = String(e?.message || e);
      if (/403|blocked|chat not found|deactivated/i.test(msg)) {
        await db('PUT', `pendingWelcome/${tgId}`, { ...row, sent: true, error: 'blocked', sentAt: Date.now() }).catch(() => {});
      }
    }
  }

  return { statusCode: 200, body: `sent=${sent} failed=${failed} delay=${delaySec}s` };
};
