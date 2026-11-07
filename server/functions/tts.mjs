// Talaffuz (BRITISH ENGLISH, neyral ovoz): GET /api/fn/tts?t=<matn>&v=<ovoz>
// 1) AZURE_SPEECH_KEY + AZURE_SPEECH_REGION berilsa — rasmiy Azure Speech (eng barqaror; oyiga 500 000 belgi bepul).
// 2) Aks holda Microsoft Edge neyral ovozlari (msedge-tts, kalitsiz). Xato bo'lsa boshqa en-GB ovozlar bilan qayta uriniladi.
// Zaxira: British ishlamasa mijoz AQSh neyral ovozini so'raydi (v=en-US-AriaNeural). Robot ovoz HECH QACHON ishlatilmaydi.
// Natija mp3, CDN'da 1 yil keshlanadi: har bir so'z/gap serverda FAQAT BIR MARTA yaratiladi.
//   TTS_VOICE env bilan ovozni almashtirish mumkin (standart: en-GB-SoniaNeural). Faqat en-GB ovozlar ruxsat etiladi.
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const VOICES = ['en-GB-SoniaNeural', 'en-GB-LibbyNeural', 'en-GB-RyanNeural', 'en-GB-ThomasNeural', 'en-GB-MaisieNeural'];
const US_VOICES = ['en-US-AriaNeural', 'en-US-JennyNeural', 'en-US-GuyNeural']; // faqat British ishlamaganda (zaxira), ular ham neyral
const VOICE_SET = new Set([...VOICES, ...US_VOICES]);
const DEFAULT_VOICE = VOICE_SET.has(process.env.TTS_VOICE || '') ? process.env.TTS_VOICE : 'en-GB-SoniaNeural';

const fail = (status, msg) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify({ error: msg }),
});

/** Yuklangan .txt dan kelgan har qanday matnni ovoz uchun tozalaydi (rad etmaydi, tuzatadi). */
export function sanitize(input) {
  let s = String(input ?? '');
  try { s = s.normalize('NFKC'); } catch { /* ignore */ }
  s = s
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '') // ko'rinmas belgilar, BOM
    .replace(/[‘’‚`´ʼ]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\([^)]{0,6}\)/g, ' ') // "(n)", "(v.)" kabi qisqa belgilar o'qilmasin
    .replace(/[\/|\\]+/g, ', ') // "color/colour" -> "color, colour"
    .replace(/[^\p{L}\p{N} .,;:!?'"()\-%&$]/gu, ' ') // qolgan g'alati belgilar bo'shliqqa
    .replace(/\s+/g, ' ')
    .trim();
  return s.slice(0, 220);
}

const xmlEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Rasmiy Azure Speech (ixtiyoriy, eng barqaror) */
async function azureSynth(text, voice) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return null;
  const single = !/\s/.test(text);
  const body = `<speak version="1.0" xml:lang="${voice.slice(0, 5)}" xmlns="http://www.w3.org/2001/10/synthesis"><voice name="${voice}">` +
    (single ? `<prosody rate="-8%">${xmlEsc(text)}</prosody>` : xmlEsc(text)) + `</voice></speak>`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'vocaboost-tts',
      },
      body,
    });
    if (!r.ok) throw new Error('azure ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

/** Edge neyral ovozi (kalitsiz) */
function edgeSynth(text, voice, timeoutMs = 6000) {
  return new Promise(async (resolve, reject) => {
    let tts;
    const timer = setTimeout(() => { try { tts?.close?.(); } catch { /* ignore */ } reject(new Error('TTS vaqti tugadi')); }, timeoutMs);
    try {
      tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const res = tts.toStream(text);
      const stream = res?.audioStream || res;
      const chunks = [];
      const done = () => { clearTimeout(timer); try { tts.close?.(); } catch { /* ignore */ } };
      stream.on('data', c => chunks.push(Buffer.from(c)));
      stream.on('error', e => { done(); reject(e); });
      stream.on('end', () => { done(); resolve(Buffer.concat(chunks)); });
      stream.on('close', () => { done(); if (chunks.length) resolve(Buffer.concat(chunks)); });
    } catch (e) {
      clearTimeout(timer);
      try { tts?.close?.(); } catch { /* ignore */ }
      reject(e);
    }
  });
}

/** Avval Azure (bo'lsa), keyin Edge — bir nechta en-GB ovoz bilan qayta urinish. Hammasi British. */
async function synth(text, voice) {
  // Qayta urinish shu lahja (GB yoki US) ichida qoladi
  const pool = voice.startsWith('en-US') ? US_VOICES : VOICES.filter(v => v !== 'en-GB-MaisieNeural');
  const tryOrder = [voice, ...pool.filter(v => v !== voice)].slice(0, 3);
  let lastErr;
  try {
    const a = await azureSynth(text, voice);
    if (a && a.length >= 600) return a;
  } catch (e) { lastErr = e; }
  for (const v of tryOrder) {
    try {
      const b = await edgeSynth(text, v);
      if (b && b.length >= 600) return b;
      lastErr = new Error('bo\'sh audio');
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Ovoz yaratilmadi');
}

export const handler = async event => {
  const q = event.queryStringParameters || {};
  const text = sanitize(q.t);
  if (!text || !/\p{L}/u.test(text)) return fail(400, 'Matn xato');
  const voice = VOICE_SET.has(q.v) ? q.v : DEFAULT_VOICE;
  try {
    const buf = await synth(text, voice);
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
