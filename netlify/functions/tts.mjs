// Edge TTS (Microsoft neyral ovozlar) — Netlify Function.
// GET /.netlify/functions/tts?text=Hello+world[&voice=en-US-AriaNeural]
// Xavfsizlik: ochiq proksi sifatida begona domenlar tomonidan suiiste'mol qilinishining oldi olingan.
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const VOICES = new Set(['en-US-AriaNeural', 'en-US-JennyNeural', 'en-US-GuyNeural', 'en-GB-SoniaNeural', 'en-GB-RyanNeural']);
const DEFAULT_VOICE = process.env.TTS_VOICE || 'en-US-AriaNeural';

// "Avtomat to'xtatgich": Microsoft qator bilan rad etayotgan bo'lsa, issiq nusxa keyingi so'rovlarni
// darhol (≈0 s, deyarli bepul) rad etadi va har safar 6 soniya compute yemaydi.
let edgeFails = 0;
let edgeBlockedUntil = 0;

// IP bo'yicha daqiqalik cheklov (rate limiting)
const ipRequests = new Map(); // ip -> { count, resetTime }

const err = (status, msg) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify({ error: msg }),
});

const streamToBuffer = stream =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', c => chunks.push(Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

export const handler = async event => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  // 1. IP rate limiting (bir IP dan daqiqasiga ko'pi bilan 60 ta so'rov)
  const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || event.headers['client-ip'] || 'unknown';
  const now = Date.now();
  const ipData = ipRequests.get(clientIp);

  if (ipData && now < ipData.resetTime) {
    if (ipData.count >= 60) {
      return err(429, 'So‘rovlar soni me’yordan oshdi. Bir ozdan so‘ng urinib ko‘ring.');
    }
    ipData.count++;
  } else {
    ipRequests.set(clientIp, { count: 1, resetTime: now + 60000 });
  }

  // Eskirgan IP yozuvlarni tozalash
  if (ipRequests.size > 2000) {
    for (const [k, v] of ipRequests.entries()) {
      if (now >= v.resetTime) ipRequests.delete(k);
    }
  }

  const q = event.queryStringParameters || {};
  let text = String(q.text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!text) return err(400, 'text kerak');
  if (/^[A-Za-z][A-Za-z'’-]*$/.test(text)) text = text.toLowerCase(); // "Ignore" va "ignore" bitta keshdan chiqadi
  const voice = VOICES.has(q.voice) ? q.voice : DEFAULT_VOICE;
  if (Date.now() < edgeBlockedUntil) return err(503, 'Ovoz xizmati vaqtincha band');

  // neural=true: Microsoft neyral ovozi — 1 yil keshlanadi (bir xil so'z uchun funksiya qayta ishlamaydi).
  // neural=false: zaxira (robot ovozli Google) — FAQAT 1 soat keshlanadi, aks holda sifatsiz ovoz bir yilga "qotib" qoladi.
  const ok = (buf, neural) => {
    const cc = neural ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': cc,
        'Netlify-CDN-Cache-Control': cc,
        'Netlify-Vary': 'query=text|voice|v',
        'Access-Control-Allow-Origin': '*',
      },
      body: buf.toString('base64'),
    };
  };

  // Bitta urinish: yangi ulanish, vaqt chegarasi va ulanishni albatta yopish (aks holda funksiya osilib qoladi)
  const edgeOnce = async v => {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(v, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const out = tts.toStream(text);
      const stream = out && out.audioStream ? out.audioStream : out;
      const buf = await Promise.race([
        streamToBuffer(stream),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
      ]);
      return buf;
    } finally {
      try {
        tts.close();
      } catch {
        /* ignore */
      }
    }
  };

  // Microsoft neyral ovozi. KREDIT TEJASH: uzoq kutmaymiz — vaqt chegarasi 6 s, qayta urinish faqat tez (<2 s) xatoda.
  // Sifatsiz (robot) Google zaxirasi olib tashlangan: u ham kredit yeydi, ham sifatni buzadi.
  // Eng yomon holat ≈ 6 s (≈0,017 kredit); odatda xato 1–2 s ichida tugaydi.
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = Date.now();
    try {
      const buf = await edgeOnce(voice);
      if (buf.length > 500) {
        edgeFails = 0;
        return ok(buf, true);
      }
    } catch (e) {
      console.warn('edge-tts failed:', voice, e && e.message);
    }
    if (Date.now() - t0 > 2000) break; // sekin xato (timeout) — qayta urinmaymiz
  }
  edgeFails++;
  edgeBlockedUntil = Date.now() + Math.min(120000, 15000 * edgeFails); // keyingi so'rovlar tez rad etiladi
  return err(502, 'Ovoz olinmadi');
};
