// Orqa fon funksiyasi (nomi "-background" bilan tugagani uchun 15 daqiqagacha ishlaydi): ko'p foydalanuvchiga xabar yuborish.
// Faqat admin.mjs yoki remind.mjs chaqiradi; admin kodi bilan himoyalangan.
import { timingSafeEqual } from 'node:crypto';
import { parseBody, runBroadcast } from '../lib/tg.mjs';

const safeEq = (a, b) => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
};

export const handler = async event => {
  const body = parseBody(event);
  const code = process.env.ADMIN_CODE;
  if (!body || !code || !safeEq(body.code || '', code)) return { statusCode: 401, body: '' };
  const text = String(body.text || '').trim();
  if (!text) return { statusCode: 400, body: '' };
  try {
    await runBroadcast({
      text,
      photoUrl: body.photoUrl ? String(body.photoUrl).trim() : null,
      buttons: Array.isArray(body.buttons) ? body.buttons : [],
      customButtonsOnly: !!body.customButtonsOnly,
      kind: body.kind === 'daily' ? 'daily' : body.kind === 'ad' ? 'ad' : 'manual',
      respectOptOut: body.kind === 'daily',
      skipActiveToday: !!body.skipActiveToday,
      parseMode: body.parseMode || 'HTML',
      invite: body.invite && typeof body.invite === 'object' ? { label: String(body.invite.label || ''), mode: body.invite.mode === 'link' ? 'link' : 'share' } : null,
    });
  } catch {
    /* holat adminState/broadcast ga yozilgan */
  }
  return { statusCode: 202, body: '' };
};
