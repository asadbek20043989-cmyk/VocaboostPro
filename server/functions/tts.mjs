// Talaffuz (British English, neyral ovoz): GET /api/fn/tts?t=<matn>&v=<ovoz>
// Microsoft Edge neyral ovozlari (msedge-tts) — kalitsiz, bepul. Natija mp3, CDN'da 1 yil keshlanadi:
// har bir so'z/gap serverda FAQAT BIR MARTA yaratiladi, keyingi safar zumda (edge keshidan) keladi.
//   TTS_VOICE env bilan ovozni almashtirish mumkin (standart: en-GB-SoniaNeural).
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const VOICES = new Set(['en-GB-SoniaNeural', 'en-GB-LibbyNeural', 'en-GB-RyanNeural', 'en-GB-ThomasNeural', 'en-GB-MaisieNeural']);
const DEFAULT_VOICE = VOICES.has(process.env.TTS_VOICE || '') ? process.env.TTS_VOICE : 'en-GB-SoniaNeural';

const fail = (status, msg) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify({ error: msg }),
});

function synth(text, voice) {
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TTS vaqti tugadi')), 12000);
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const res = tts.toStream(text);
      const stream = res?.audioStream || res;
      const chunks = [];
      stream.on('data', c => chunks.push(Buffer.from(c)));
      stream.on('error', e => { clearTimeout(timer); reject(e); });
      const done = () => { clearTimeout(timer); try { tts.close?.(); } catch { /* ignore */ } };
      stream.on('end', () => { done(); resolve(Buffer.concat(chunks)); });
      stream.on('close', () => { done(); if (chunks.length) resolve(Buffer.concat(chunks)); });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

export const handler = async event => {
  const q = event.queryStringParameters || {};
  // Faqat inglizcha matn: harflar, raqamlar va oddiy tinish belgilari (suiiste'molga qarshi)
  const text = String(q.t || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  if (!text || !/^[A-Za-z0-9 .,;:!?'’"“”()\-–—%&$/]+$/.test(text)) return fail(400, 'Matn xato');
  const voice = VOICES.has(q.v) ? q.v : DEFAULT_VOICE;
  try {
    const buf = await synth(text, voice);
    if (!buf || buf.length < 600) return fail(502, 'Ovoz yaratilmadi');
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
      },
      body: buf.toString('base64'),
    };
  } catch (e) {
    return fail(502, String(e?.message || e));
  }
};
