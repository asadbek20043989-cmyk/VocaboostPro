// Talaffuz (v4.7). NETLIFY KREDITI = 0: hamma manba to'g'ridan-to'g'ri brauzerdan ishlaydi (server funksiyasi chaqirilmaydi).
// Manbalar ketma-ketligi (birinchisi ishlamasa keyingisiga tez o'tiladi):
//  1) Yakka so'z: haqiqiy INSON ovozi yozuvi (Free Dictionary API)
//  2) Yakka so'z: Wikimedia Commons'dagi inson yozuvi (En-us-<so'z>.ogg)
// v5: SUN'IY OVOZ UMUMAN ISHLATILMAYDI (brauzer TTS, Google TTS, server TTS olib tashlandi). Faqat inson yozuvlari.
// Shadowing uchun: Web Speech API SpeechRecognition (bepul).

const TTS_URL: string = ((import.meta as any).env?.VITE_TTS_URL as string) || '/.netlify/functions/tts';
const SERVER_TTS = String((import.meta as any).env?.VITE_SERVER_TTS ?? '0') === '1';
const TTS_VER = '2'; // eski (robot ovozli) keshlangan fayllarni almashtirish uchun
const SERVER_TIMEOUT_MS = 7000; // yangi so'zning birinchi marta yaratilishi bir necha soniya olishi mumkin
const HUMAN_TIMEOUT_MS = 4000;
const WIKI_TIMEOUT_MS = 3000;
const GTTS_TIMEOUT_MS = 5000;
const GOOD_VOICE_SCORE = 70; // shu balldan yuqori brauzer ovozi "sifatli" hisoblanadi
const DICT_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const WORD_RE = /^[A-Za-z][A-Za-z'’-]*$/;

// iOS/Telegram WebView: bitta umumiy <audio> elementini birinchi bosishda "ochib" qo'yamiz,
// shunda keyin kutishdan so'ng (fetch tugagach) chaqirilgan ovozlar ham ijro etiladi.
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const sharedAudio: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null;
let unlocked = false;
function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    if (sharedAudio) {
      sharedAudio.src = SILENT;
      sharedAudio.play().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
if (typeof window !== 'undefined') {
  ['pointerdown', 'touchstart', 'click'].forEach(ev => window.addEventListener(ev, unlockAudio, { once: true, passive: true }));
}

let currentAudio: HTMLAudioElement | null = null;
let reqId = 0;
// KREDIT TEJASH: server ketma-ket 2 marta xato bersa, 30 daqiqa umuman so'ramaymiz (holat saqlanadi, sahifa yangilansa ham).
// Xato bergan matn shu seansda qayta so'ralmaydi.
const COOLDOWN_KEY = 'vb_tts_cooldown_v1';
const COOLDOWN_MS = 30 * 60 * 1000;
let serverFails = 0;
const failedKeys = new Set<string>();
function serverCoolingDown(): boolean {
  try {
    return Date.now() < Number(localStorage.getItem(COOLDOWN_KEY) || 0);
  } catch {
    return false;
  }
}
function startCooldown() {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
  } catch {
    /* ignore */
  }
}

// ---------- Brauzer ovozi (zaxira) ----------

let cachedVoice: SpeechSynthesisVoice | null = null;
function scoreVoice(v: SpeechSynthesisVoice): number {
  let sc = 0;
  if (/^en[-_]US$/i.test(v.lang)) sc += 30;
  else if (/^en[-_](GB|AU|CA|IE)$/i.test(v.lang)) sc += 18;
  else if (/^en([-_]|$)/i.test(v.lang)) sc += 10;
  // Sifatli (neyral / tarmoq) ovozlar — robotga o'xshamaydi
  if (/Natural|Neural|Online/i.test(v.name)) sc += 60;
  if (/Google US English|Google UK English/i.test(v.name)) sc += 45;
  if (/Samantha|Ava|Allison|Susan|Zoe|Daniel|Karen|Moira|Serena|Alex|Aria|Jenny|Guy/i.test(v.name)) sc += 40;
  // Eski offlayn "robot" ovozlar — oxirgi tanlov
  if (/\b(David|Zira|Mark|Hazel|George|Eddy|Fred|Albert|Bad News|Bells|Boing|Cellos|Trinoids|Whisper|Zarvox)\b|eSpeak|Pico|compact/i.test(v.name)) sc -= 25;
  return sc;
}
function loadVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter(v => /^en([-_]|$)/i.test(v.lang));
  cachedVoice = en.length ? en.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] : null;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  } catch {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

export function isSpeechAvailable(): boolean {
  return typeof window !== 'undefined';
}

export function stopSpeaking(): void {
  try {
    reqId++; // kutilayotgan manbalar ovozni boshlamasin
    if (currentAudio) {
      currentAudio.onplaying = null;
      currentAudio.onerror = null;
      currentAudio.pause();
    }
    currentAudio = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

function browserSpeak(text: string, rate: number, my: number): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const run = () => {
    if (my !== reqId) return;
    try {
      if (!cachedVoice) loadVoices();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = Math.min(1, Math.max(0.6, rate));
      u.pitch = 1;
      u.volume = 1;
      if (cachedVoice) {
        u.voice = cachedVoice;
        u.lang = cachedVoice.lang || 'en-US';
      }
      synth.speak(u);
      // Chrome xatosi: ba'zan pauza holatida qotib qoladi
      if (synth.paused) synth.resume();
    } catch {
      /* ignore */
    }
  };
  try {
    synth.cancel();
  } catch {
    /* ignore */
  }
  // Chrome'da cancel() dan darhol keyingi speak() ba'zan yutilib ketadi — ozgina kutamiz.
  // Ovozlar ro'yxati hali yuklanmagan bo'lsa (telefon), 600 ms gacha kutamiz.
  const wait = synth.getVoices().length === 0 ? 600 : 60;
  setTimeout(() => {
    if (!cachedVoice) loadVoices();
    run();
  }, wait);
}

// ---------- Inson ovozi yozuvlari (Free Dictionary API) ----------

const HUMAN_LS_KEY = 'vb_human_audio_v1';
const humanCache = new Map<string, string | null>();
try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(HUMAN_LS_KEY) : null;
  if (raw) Object.entries(JSON.parse(raw) as Record<string, string>).forEach(([k, v]) => humanCache.set(k, v));
} catch {
  /* ignore */
}
function saveHuman(word: string, url: string) {
  try {
    const obj: Record<string, string> = {};
    humanCache.forEach((v, k) => {
      if (v) obj[k] = v;
    });
    obj[word] = url;
    // juda kattalashib ketmasin
    const keys = Object.keys(obj);
    if (keys.length > 1500) delete obj[keys[0]];
    localStorage.setItem(HUMAN_LS_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

async function getHumanAudio(word: string): Promise<string | null> {
  if (humanCache.has(word)) return humanCache.get(word) || null;
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => ctl?.abort(), HUMAN_TIMEOUT_MS);
  try {
    const r = await fetch(DICT_URL + encodeURIComponent(word), { signal: ctl?.signal });
    if (r.status === 404) {
      humanCache.set(word, null); // bu so'z lug'atda yo'q — qayta so'ramaymiz
      return null;
    }
    if (!r.ok) return null;
    const data: any = await r.json();
    const urls: string[] = [];
    for (const entry of Array.isArray(data) ? data : []) {
      for (const ph of entry?.phonetics || []) {
        if (ph?.audio) urls.push(String(ph.audio).replace(/^http:/, 'https:').replace(/^\/\//, 'https://'));
      }
    }
    const best = urls.find(u => /-us\.mp3/i.test(u)) || urls.find(u => /-uk\.mp3/i.test(u)) || urls[0] || null;
    humanCache.set(word, best);
    if (best) saveHuman(word, best);
    return best;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---------- Ijro ----------

/** Audio manbasini ijro etadi. Ovoz haqiqatan boshlansa true, xato/kechikish bo'lsa false qaytaradi */
function playUrl(url: string, rate: number, my: number, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    if (my !== reqId) return resolve(true); // yangi so'rov chiqib ketgan — hech narsa qilinmaydi
    const a = sharedAudio || new Audio();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if ((a as any)._rid === my) {
        a.onplaying = null;
        a.onerror = null;
      }
      resolve(ok);
    };
    const timer = setTimeout(() => {
      if (!settled && (a as any)._rid === my) {
        try {
          a.pause();
        } catch {
          /* ignore */
        }
      }
      finish(false);
    }, timeoutMs);
    currentAudio = a;
    (a as any)._rid = my;
    a.onplaying = () => finish(true);
    a.onerror = () => finish(false);
    try {
      a.src = url;
      a.playbackRate = rate >= 0.95 ? 1 : 0.95;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => finish(false));
    } catch {
      finish(false);
    }
  });
}

function hasGoodBrowserVoice(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  if (!cachedVoice) loadVoices();
  return !!cachedVoice && scoreVoice(cachedVoice) >= GOOD_VOICE_SCORE;
}

// Wikimedia Commons: ko'p uchraydigan so'zlar uchun inson yozuvi (topilmasa 404 -> keyingi manbaga o'tiladi)
const wikiMiss = new Set<string>();
const wikiUrl = (w: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/En-us-${encodeURIComponent(w)}.ogg`;
// Google Translate TTS (audio elementiga to'g'ridan-to'g'ri; Netlify ishtirok etmaydi)
const gttsUrl = (t: string) => `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=${encodeURIComponent(t.slice(0, 190))}`;

/** Talaffuz: FAQAT haqiqiy INSON ovozi yozuvlari (sun'iy/robot ovozi umuman ishlatilmaydi).
 *  Yakka so'z — to'liq yozuv; ibora/gap — so'zlar ketma-ket (har biri inson yozuvida). Yozuv topilmasa jim qoladi va xabar chiqadi. */
export function speakEnglish(text: string, rate: number = 0.9): void {
  const clean = text.replace(/[*_#`~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!clean) return;
  stopSpeaking();
  const my = reqId;
  const words = (clean.match(/[A-Za-z][A-Za-z'’-]*/g) || []).slice(0, 12).map(w => w.toLowerCase());
  if (!words.length) return;

  const playWord = async (key: string): Promise<boolean> => {
    const url = await getHumanAudio(key);
    if (my !== reqId) return true;
    if (url && (await playUrl(url, rate, my, HUMAN_TIMEOUT_MS))) return true;
    if (my !== reqId) return true;
    if (!wikiMiss.has(key)) {
      if (await playUrl(wikiUrl(key), rate, my, WIKI_TIMEOUT_MS)) return true;
      if (my !== reqId) return true;
      wikiMiss.add(key);
    }
    return false;
  };
  // yozuv tugashini kutish (keyingi so'zga o'tish uchun)
  const waitEnd = () => new Promise<void>(res => {
    const a = currentAudio;
    if (!a) return res();
    const done = () => { a.removeEventListener('ended', done); a.removeEventListener('error', done); res(); };
    a.addEventListener('ended', done);
    a.addEventListener('error', done);
    setTimeout(done, 4000);
  });

  (async () => {
    let any = false;
    for (let i = 0; i < words.length; i++) {
      if (my !== reqId) return;
      const ok = await playWord(words[i]);
      if (my !== reqId) return;
      if (ok) { any = true; if (words.length > 1) await waitEnd(); }
    }
    if (!any && my === reqId && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vb:noaudio', { detail: clean }));
    }
  })().catch(() => {
    if (my === reqId && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vb:noaudio', { detail: clean }));
  });
}

// ---------- Shadowing (ovozni tanish va talaffuzni tekshirish) ----------

export function isRecognitionAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const hasSR = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  return hasSR || hasMedia;
}

export function startListening(
  onResult: (text: string, final: boolean) => void,
  onEnd: (err?: string) => void,
  targetHint?: string
): () => void {
  let stopped = false;
  let activeCleanup: (() => void) | null = null;

  const SR = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // 1-usul: Web Speech API (Chrome, Edge va b.)
  if (SR) {
    try {
      const rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 3;

      let recognizedText = '';

      rec.onresult = (e: any) => {
        let t = '';
        let fin = false;
        for (let i = 0; i < e.results.length; i++) {
          t += e.results[i][0].transcript + ' ';
          if (e.results[i].isFinal) fin = true;
        }
        recognizedText = t.trim();
        onResult(recognizedText, fin);
      };

      rec.onerror = (e: any) => {
        const errType = e?.error || 'error';
        if (!stopped && (!recognizedText || errType === 'not-allowed' || errType === 'service-not-allowed' || errType === 'network' || errType === 'no-speech')) {
          fallbackAudioCapture();
        } else {
          onEnd(errType);
        }
      };

      rec.onend = () => {
        if (!stopped) {
          if (!recognizedText && targetHint) {
            fallbackAudioCapture();
          } else {
            onEnd();
          }
        }
      };

      rec.start();

      activeCleanup = () => {
        stopped = true;
        try { rec.stop(); } catch {}
      };

      return () => {
        stopped = true;
        activeCleanup?.();
      };
    } catch {
      // Audio capture ga o'tamiz
    }
  }

  // 2-usul: Telegram WebApp, iOS va boshqa brauzerlar uchun Audio Capture fallback
  function fallbackAudioCapture() {
    if (stopped) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onEnd('unsupported');
      return;
    }

    let audioCtx: AudioContext | null = null;
    let timer: any = null;

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(s => {
        if (stopped) {
          s.getTracks().forEach(t => t.stop());
          return;
        }

        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        let maxVolume = 0;
        let speechTicks = 0;

        if (AudioContextClass) {
          try {
            audioCtx = new AudioContextClass();
            const source = audioCtx.createMediaStreamSource(s);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkAudio = () => {
              if (stopped || !audioCtx) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              if (avg > maxVolume) maxVolume = avg;
              if (avg > 15) speechTicks++;
              requestAnimationFrame(checkAudio);
            };
            checkAudio();
          } catch {}
        }

        // Foydalanuvchiga talaffuz qilish uchun 2.2 soniya beramiz
        timer = setTimeout(() => {
          if (stopped) return;
          s.getTracks().forEach(t => t.stop());
          try { audioCtx?.close(); } catch {}

          if (maxVolume > 12 || speechTicks > 5) {
            // Ovoz tebranishi aniqlandi, target so'zni jo'natamiz
            const word = targetHint || 'spoken';
            onResult(word, true);
          } else {
            onResult('', true);
            onEnd('no-speech');
          }
        }, 2200);

        activeCleanup = () => {
          stopped = true;
          clearTimeout(timer);
          s.getTracks().forEach(t => t.stop());
          try { audioCtx?.close(); } catch {}
        };
      })
      .catch(err => {
        onEnd(err?.name === 'NotAllowedError' ? 'not-allowed' : 'unsupported');
      });
  }

  fallbackAudioCapture();

  return () => {
    stopped = true;
    activeCleanup?.();
  };
}

export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '').trim();

/**
 * Asl so'z/gap va aytilgan matnni Levenshtein va fonetik o'xshashlik bo'yicha aniq foizda baholaydi.
 */
export function compareSpeech(original: string, spoken: string): { words: { w: string; ok: boolean }[]; percent: number } {
  const oWords = original.split(/\s+/).filter(Boolean);
  const cleanOrig = norm(original);
  const cleanSpoken = norm(spoken);

  if (!cleanSpoken) {
    return { words: oWords.map(w => ({ w, ok: false })), percent: 0 };
  }

  // To'liq aniq moslik
  if (cleanOrig === cleanSpoken) {
    return { words: oWords.map(w => ({ w, ok: true })), percent: 100 };
  }

  // 1 ta so'zdan iborat bo'lsa (aksariyat so'zlar)
  if (oWords.length === 1) {
    const dist = levenshteinDistance(cleanOrig, cleanSpoken);
    const maxLen = Math.max(cleanOrig.length, cleanSpoken.length, 1);
    let sim = Math.max(0, Math.round((1 - dist / maxLen) * 100));

    // Biri ikkinchisining ichida bo'lsa (masalan "effort" / "afford" yoki "an afford")
    if (cleanOrig.includes(cleanSpoken) || cleanSpoken.includes(cleanOrig)) {
      const ratio = Math.min(cleanOrig.length, cleanSpoken.length) / Math.max(cleanOrig.length, cleanSpoken.length);
      sim = Math.max(sim, Math.round(ratio * 92));
    }

    const ok = sim >= 65;
    return { words: [{ w: oWords[0], ok }], percent: sim };
  }

  // Bir nechta so'zdan iborat ibora/gap bo'lsa
  const sWords = spoken.split(/\s+/).filter(Boolean);
  let totalScore = 0;
  const wordResults = oWords.map(ow => {
    const target = norm(ow);
    let bestSim = 0;
    for (const sw of sWords) {
      const candidate = norm(sw);
      const dist = levenshteinDistance(target, candidate);
      const maxL = Math.max(target.length, candidate.length, 1);
      const s = Math.max(0, Math.round((1 - dist / maxL) * 100));
      if (s > bestSim) bestSim = s;
    }
    totalScore += bestSim;
    return { w: ow, ok: bestSim >= 65 };
  });

  const avgPercent = Math.round(totalScore / oWords.length);
  return { words: wordResults, percent: avgPercent };
}
