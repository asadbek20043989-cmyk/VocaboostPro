// Telegram profil rasmi proksisi: Mini App `photo_url` bermagan mijozlarda rasmni bot orqali olib beradi.
// GET /api/fn/tgavatar?id=<telegram id>   (BOT_TOKEN kerak; token hech qachon brauzerga chiqmaydi)
import { tgApi } from '../lib/tg.mjs';

const none = status => ({ statusCode: status, headers: { 'Cache-Control': 'public, max-age=600', 'Netlify-CDN-Cache-Control': 'public, s-maxage=3600' }, body: '' });

export const handler = async event => {
  const token = process.env.BOT_TOKEN;
  const id = String(event.queryStringParameters?.id || '');
  if (!token || !/^\d{3,15}$/.test(id)) return none(404);
  try {
    const r = await tgApi(token, 'getUserProfilePhotos', { user_id: Number(id), limit: 1 });
    const sizes = r?.photos?.[0];
    if (!sizes?.length) return none(404);
    const pick = sizes.find(s => s.width >= 160) || sizes[sizes.length - 1];
    const f = await tgApi(token, 'getFile', { file_id: pick.file_id });
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`);
    if (!res.ok) return none(404);
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: { 'Content-Type': res.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'Netlify-CDN-Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400' },
      body: buf.toString('base64'),
    };
  } catch {
    return none(404);
  }
};
