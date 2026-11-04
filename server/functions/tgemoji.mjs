// Premium emoji ko'rinishi (admin panel uchun): GET /api/fn/tgemoji?id=<custom_emoji_id>
// Bot orqali emojining kichik rasmini (thumbnail) olib beradi. BOT_TOKEN hech qachon brauzerga chiqmaydi.
import { tgApi } from '../lib/tg.mjs';

const none = status => ({ statusCode: status, headers: { 'Cache-Control': 'public, max-age=300' }, body: '' });

export const handler = async event => {
  const token = process.env.BOT_TOKEN;
  const id = String(event.queryStringParameters?.id || '');
  if (!token || !/^\d{5,25}$/.test(id)) return none(404);
  try {
    const list = await tgApi(token, 'getCustomEmojiStickers', { custom_emoji_ids: [id] });
    const st = list?.[0];
    if (!st) return none(404);
    // Animatsiyali (tgs/webm) emojilar uchun statik miniatura; oddiylari uchun o'zi
    const fileId = st.thumbnail?.file_id || (!st.is_animated && !st.is_video ? st.file_id : '');
    if (!fileId) return none(404);
    const f = await tgApi(token, 'getFile', { file_id: fileId });
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`);
    if (!res.ok) return none(404);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = String(f.file_path || '').split('.').pop();
    const type = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=604800', 'Netlify-CDN-Cache-Control': 'public, s-maxage=2592000, stale-while-revalidate=86400' },
      body: buf.toString('base64'),
    };
  } catch {
    return none(404);
  }
};
