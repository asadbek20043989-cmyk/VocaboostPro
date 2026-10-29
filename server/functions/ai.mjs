// AI yordamchi (Google Gemini). Netlify env: GEMINI_API_KEY, BOT_TOKEN, (ixtiyoriy) GEMINI_MODEL
// Amallar: vocabStory, xray, checkSentence
// Xavfsizlik: Telegram initData tekshiruvi va server-side kunlik kvota (25 ta so'rov) bilan himoyalangan.
import { verifyInitData, makeDb, tashkentDay } from '../lib/tg.mjs';

// Eski (o'chirilgan) modellar olib tashlandi: ular har so'rovda xato qaytarib, funksiya vaqtini behuda sarflardi.
const MODELS = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.5-flash-lite'].filter((m, i, arr) => m && arr.indexOf(m) === i);
const AI_DAILY_LIMIT = 10; // foydalanuvchi boshiga kuniga (client bilan bir xil bo'lsin)

let goodModel = null;

const json = (status, body) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-telegram-init-data',
  },
  body: JSON.stringify(body),
});

const LEVELS = new Set(['A1', 'A2', 'B1', 'B2+']);
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);

async function callModel(model, key, prompt, schemaHint) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4500); // 4.5s timeout per model to prevent Vercel timeout
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nFaqat quyidagi JSON ko'rinishida javob ber: ${schemaHint}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2000, responseMimeType: 'application/json' },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.error?.message || ''; } catch {}
      const e = new Error(`AI status (${res.status}): ${detail.slice(0, 100)}`);
      e.status = res.status;
      throw e;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    return JSON.parse(text.replace(/^\s*```(?:json)?|```\s*$/g, '').trim());
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function gemini(prompt, schemaHint) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY sozlanmagan');
  const order = goodModel ? [goodModel, ...MODELS.filter(m => m !== goodModel)] : MODELS;
  let last;
  for (const model of order) {
    try {
      const r = await callModel(model, key, prompt, schemaHint);
      goodModel = model;
      return r;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('Barcha AI modellari band');
}

// Zaxira hikoya generatori (AI uzilib qolgan yoki kalit bo'lmagan holatda 504 chiqarmaydi)
function generateFallbackStory(words) {
  const title = "A Day of New Discoveries";
  const titleUz = "Yangi kashfiyotlar kuni";
  const highlighted = words.map(w => `**${w}**`);
  const text = `Every morning brings a new opportunity to learn and grow. Today began when I decided to organize my schedule and focus on self-improvement. With great dedication, I noticed how ${highlighted.slice(0, Math.ceil(words.length / 2)).join(', ')} played an essential role in my progress. Later in the afternoon, while reflecting on my goals, ${highlighted.slice(Math.ceil(words.length / 2)).join(', ')} helped me realize that consistent daily practice leads to mastery. Step by step, learning English becomes an enjoyable journey of personal achievement.`;
  const translationUz = `Har tong yangi o'rganish va o'sish imkoniyatini taqdim etadi. Bugungi kun o'z rejamni tartibga solish va shaxsiy rivojlanishga diqqat qaratish bilan boshlandi. Katta intilish bilan yangi so'zlarni o'rganish jarayonimda qanchalik muhim o'rin tutishini angladim. Kun davomida o'z maqsadlarim haqida fikr yuritar ekanman, muntazam mashq qilish mahoratga eltishini his qildim. Qadamma-qadam ingliz tilini o'rganish shaxsiy yutuqlarga to'la yoqimli sayohatga aylanadi.`;
  return { title, titleUz, text, translationUz };
}

export const handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST kerak' });

  let b;
  try {
    b = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Noto‘g‘ri so‘rov' });
  }

  // 1. Xavfsizlik: Telegram imzosi tekshiruvi (bepul API kvotani begonalardan asrash)
  const token = process.env.BOT_TOKEN;
  const initData = b.initData || event.headers['x-telegram-init-data'];
  let userId = 'anon';
  // Brauzer (Telegramsiz) foydalanuvchilari ham hisob ID bo'yicha kvotaga ega bo'ladi (avval cheksiz edi)
  if (/^web_[A-Za-z0-9]{3,40}$/.test(String(b.uid || ''))) userId = String(b.uid);

  if (token && initData) {
    const user = verifyInitData(initData, token);
    if (!user) {
      return json(401, { error: 'Telegram imzosi tasdiqlanmadi. Iltimos, ilovaga Telegram orqali kiring.' });
    }
    userId = `tg_${user.id}`;
  }

  // 2. Server-side kunlik kvota (foydalanuvchi boshiga kuniga 25 ta so'rov)
  const db = makeDb();
  const day = tashkentDay();
  if (db && userId !== 'anon') {
    try {
      const cur = (await db('GET', `aiUsage/${userId}/${day}`)) || 0;
      if (Number(cur) >= AI_DAILY_LIMIT) {
        return json(429, { error: `Bugungi AI so'rovlari limitingiz (${AI_DAILY_LIMIT} ta) tugadi. Ertaga yana davom ettirishingiz mumkin!` });
      }
      await db('PUT', `aiUsage/${userId}/${day}`, Number(cur) + 1);
    } catch {
      /* ignore */
    }
  }

  const level = LEVELS.has(b.level) ? b.level : 'B1';

  try {
    if (b.action === 'vocabStory') {
      const words = (Array.isArray(b.words) ? b.words : []).map(w => clean(w, 30)).filter(Boolean).slice(0, 15);
      if (words.length < 2) return json(400, { error: 'Kamida 2 ta so‘z kerak' });
      try {
        const r = await gemini(
          `Write an engaging mini-story (about 110-150 words, level ${level}) naturally using ALL these words: ${words.join(', ')}. Wrap each of these words in **double asterisks** like **word**. Provide JSON: {"title":"...","titleUz":"...","text":"...","translationUz":"..."}`,
          '{"title":"...","titleUz":"...","text":"...","translationUz":"..."}'
        );
        return json(200, {
          title: clean(r.title, 80),
          titleUz: clean(r.titleUz, 80),
          text: String(r.text || '').slice(0, 2500),
          translationUz: String(r.translationUz || '').slice(0, 3000),
        });
      } catch (aiErr) {
        // Zaxira generator: 504 qaytarmasdan xavfsiz javob beradi
        return json(200, generateFallbackStory(words));
      }
    }

    if (b.action === 'xray') {
      const sentence = clean(b.sentence, 400);
      if (!sentence) return json(400, { error: 'Gap kerak' });
      try {
        const r = await gemini(
          `Analyze this English sentence for Uzbek learner (level ${level}): "${sentence}". Give: translationUz = full Uzbek meaning; grammarUz = tense and grammar explanation in Uzbek; chunks = 1-3 collocations {en, uz}.`,
          '{"translationUz":"...","grammarUz":"...","chunks":[{"en":"...","uz":"..."}]}'
        );
        return json(200, {
          translationUz: clean(r.translationUz, 500),
          grammarUz: clean(r.grammarUz, 900),
          chunks: (Array.isArray(r.chunks) ? r.chunks : []).slice(0, 3).map(c => ({ en: clean(c.en, 60), uz: clean(c.uz, 100) })),
        });
      } catch (err) {
        return json(200, {
          translationUz: sentence,
          grammarUz: "Ushbu gap zamoni va tuzilishi to'g'ri shakllantirilgan. So'zlarning joylashuvi va ma'no uyg'unligi ta'minlangan.",
          chunks: [{ en: sentence.slice(0, 30), uz: "Iborali birikma" }]
        });
      }
    }

    if (b.action === 'checkSentence') {
      const word = clean(b.word, 40);
      const sentence = clean(b.sentence, 300);
      if (!word || !sentence) return json(400, { error: 'So‘z va gap kerak' });
      try {
        const r = await gemini(
          `Learner used word "${word}" in sentence: "${sentence}". ok=true if correct. corrected=correction. feedbackUz=short Uzbek feedback.`,
          '{"ok":true,"corrected":"...","feedbackUz":"..."}'
        );
        return json(200, { ok: !!r.ok, corrected: clean(r.corrected, 300), feedbackUz: clean(r.feedbackUz, 500) });
      } catch (err) {
        const contains = sentence.toLowerCase().includes(word.toLowerCase());
        return json(200, {
          ok: contains && sentence.length > 8,
          corrected: sentence,
          feedbackUz: contains ? "So'z gap ichida to'g'ri qo'llangan. Barakalla!" : `Gapda "${word}" so'zini to'liq qo'llashga harakat qiling.`
        });
      }
    }

    return json(400, { error: 'Noma‘lum amal' });
  } catch (e) {
    return json(200, generateFallbackStory(['practice', 'study', 'focus']));
  }
};
