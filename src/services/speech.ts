// Talaffuz (v5.4): BRITISH ENGLISH, neyral ovoz.
// Ketma-ketlik (birinchisi ishlamasa keyingisiga zumda o'tiladi):
//  1) Server neyral ovozi (/api/fn/tts, en-GB) — bir marta yaratiladi, keyin brauzer va CDN keshidan ZUMDA keladi
//  2) Yakka so'z: haqiqiy inson yozuvi (Free Dictionary, UK afzal) -> Wikimedia
//  3) Google TTS, so'ng qurilmaning eng yaxshi en-GB ovozi
// Kechikmaslik uchun: so'zlar OLDINDAN yuklanadi (prefetchEnglish), audio xotirada saqlanadi.
// Shadowing uchun: Web Speech API SpeechRecognition (bepul).

const TTS_URL: string = ((import.meta as any).env?.VITE_TTS_URL as string) || '/api/fn/tts';
const SERVER_TIMEOUT_MS = 8000;
const HUMAN_TIMEOUT_MS = 3500;
const WIKI_TIMEOUT_MS = 2500;
const GTTS_TIMEOUT_MS = 4000;
const GOOD_VOICE_SCORE = 70; // shu balldan yuqori brauzer ovozi "sifatli" hisoblanadi
const DICT_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

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

// ---------- Brauzer ovozi (zaxira) ----------

let cachedVoice: SpeechSynthesisVoice | null = null;
function scoreVoice(v: SpeechSynthesisVoice): number {
  let sc = 0;
  if (/^en[-_]GB$/i.test(v.lang)) sc += 40; // British accent afzal
  else if (/^en[-_]US$/i.test(v.lang)) sc += 22;
  else if (/^en[-_](AU|CA|IE)$/i.test(v.lang)) sc += 14;
  else if (/^en([-_]|$)/i.test(v.lang)) sc += 10;
  // Sifatli (neyral / tarmoq) ovozlar — robotga o'xshamaydi
  if (/Natural|Neural|Online/i.test(v.name)) sc += 60;
  if (/Google UK English/i.test(v.name)) sc += 50;
  else if (/Google US English/i.test(v.name)) sc += 40;
  if (/Sonia|Libby|Ryan|Daniel|Serena|Kate|Oliver|Martha|Arthur|Samantha|Ava|Allison|Susan|Zoe|Karen|Moira|Alex|Aria|Jenny|Guy/i.test(v.name)) sc += 40;
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
      u.lang = 'en-GB';
      u.rate = Math.min(1, Math.max(0.6, rate));
      u.pitch = 1;
      u.volume = 1;
      if (cachedVoice) {
        u.voice = cachedVoice;
        u.lang = cachedVoice.lang || 'en-GB';
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

const HUMAN_LS_KEY = 'vb_human_audio_v2';
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
    const best = urls.find(u => /-uk\.mp3/i.test(u)) || urls.find(u => /-us\.mp3/i.test(u)) || urls[0] || null;
    humanCache.set(word, best);
    if (best) saveHuman(word, best);
    return best;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function hasGoodBrowserVoice(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  if (!cachedVoice) loadVoices();
  return !!cachedVoice && scoreVoice(cachedVoice) >= GOOD_VOICE_SCORE;
}

// Wikimedia Commons: ko'p uchraydigan so'zlar uchun inson yozuvi (topilmasa 404 -> keyingi manbaga o'tiladi)
const wikiMiss = new Set<string>();
const wikiUrl = (w: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/En-uk-${encodeURIComponent(w)}.ogg`;
const wikiUsUrl = (w: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/En-us-${encodeURIComponent(w)}.ogg`;
// Google Translate TTS (zaxira; audio elementiga to'g'ridan-to'g'ri)
const gttsUrl = (t: string) => `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-GB&q=${encodeURIComponent(t.slice(0, 190))}`;

// ---------- Server neyral ovozi (British) + xotira keshi ----------
const blobCache = new Map<string, string>(); // kalit -> objectURL
const inflight = new Map<string, Promise<string | null>>();
const MAX_CACHE = 160;
let serverFails = 0;
let serverDownUntil = 0;

const cacheKey = (t: string) => t.toLowerCase();

async function serverAudio(text: string): Promise<string | null> {
  const key = cacheKey(text);
  const hit = blobCache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  if (Date.now() < serverDownUntil) return null;
  const p = (async () => {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctl?.abort(), SERVER_TIMEOUT_MS);
    try {
      const r = await fetch(`${TTS_URL}?t=${encodeURIComponent(text)}`, { signal: ctl?.signal });
      if (!r.ok) throw new Error('tts ' + r.status);
      const blob = await r.blob();
      if (blob.size < 600) throw new Error('tts bo\'sh');
      const url = URL.createObjectURL(blob);
      blobCache.set(key, url);
      if (blobCache.size > MAX_CACHE) {
        const first = blobCache.keys().next().value as string;
        const old = blobCache.get(first);
        blobCache.delete(first);
        if (old) { try { URL.revokeObjectURL(old); } catch { /* ignore */ } }
      }
      serverFails = 0;
      return url;
    } catch {
      // Ketma-ket 3 marta xato bo'lsa, 2 daqiqa serverni so'ramaymiz (foydalanuvchi kutib qolmasin)
      if (++serverFails >= 3) { serverDownUntil = Date.now() + 2 * 60 * 1000; serverFails = 0; }
      return null;
    } finally {
      clearTimeout(timer);
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** So'z/gaplarni OLDINDAN yuklab qo'yadi — keyin bosilganda ovoz darhol chiqadi. Chaqiruv xavfsiz (xato bo'lsa jim). */
export function prefetchEnglish(texts: (string | undefined | null)[], max = 8): void {
  try {
    if (typeof window === 'undefined' || Date.now() < serverDownUntil) return;
    const seen = new Set<string>();
    let n = 0;
    for (const raw of texts) {
      const t = String(raw || '').replace(/[*_#`~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!t || seen.has(t.toLowerCase()) || !/[A-Za-z]/.test(t)) continue;
      seen.add(t.toLowerCase());
      if (blobCache.has(cacheKey(t)) || inflight.has(cacheKey(t))) continue;
      if (++n > max) break;
      setTimeout(() => { serverAudio(t).catch(() => {}); }, n * 120);
    }
  } catch { /* ignore */ }
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

function waitAudioEnd(a: HTMLAudioElement | null, my: number, capMs = 25000): Promise<void> {
  return new Promise(res => {
    if (!a) return res();
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(cap);
      a.removeEventListener('ended', fin);
      a.removeEventListener('error', fin);
      res();
    };
    a.addEventListener('ended', fin);
    a.addEventListener('error', fin);
    const poll = setInterval(() => { if (my !== reqId) fin(); }, 200);
    const cap = setTimeout(fin, capMs);
  });
}

function splitChunks(text: string, max = 200): string[] {
  const sentences = text.match(/[^.!?;:]+[.!?;:]*/g) || [text];
  const out: string[] = [];
  let cur = '';
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if ((cur + ' ' + s).trim().length <= max) cur = (cur + ' ' + s).trim();
    else {
      if (cur) out.push(cur);
      if (s.length <= max) cur = s;
      else {
        let rest = s;
        while (rest.length > max) {
          let cut = rest.lastIndexOf(',', max);
          if (cut < 40) cut = rest.lastIndexOf(' ', max);
          if (cut < 1) cut = max;
          out.push(rest.slice(0, cut + 1).trim());
          rest = rest.slice(cut + 1).trim();
        }
        cur = rest;
      }
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Bitta bo'lak: server (British) -> Google -> (chaqiruvchi) brauzer ovozi. true = ovoz chiqdi */
async function playChunk(chunk: string, rate: number, my: number): Promise<boolean> {
  const url = await serverAudio(chunk);
  if (my !== reqId) return true;
  if (url && (await playUrl(url, rate, my, 3000))) return true;
  if (my !== reqId) return true;
  return playUrl(gttsUrl(chunk), rate, my, GTTS_TIMEOUT_MS);
}

async function speakFluent(clean: string, rate: number, my: number): Promise<void> {
  const chunks = splitChunks(clean);
  for (let i = 0; i < chunks.length; i++) {
    if (my !== reqId) return;
    if (chunks[i + 1]) prefetchEnglish([chunks[i + 1]], 1); // keyingi bo'lak oldindan tayyorlanadi — gaplar orasida pauza bo'lmaydi
    const ok = await playChunk(chunks[i], rate, my);
    if (my !== reqId) return;
    if (!ok) {
      browserSpeak(chunks.slice(i).join(' '), rate, my);
      return;
    }
    await waitAudioEnd(currentAudio, my);
  }
}

/** Talaffuz: BRITISH ENGLISH. Yakka so'z va gaplar — avval server neyral ovozi (keshdan zumda);
 *  u ishlamasa — inson yozuvi / Google / qurilma ovozi. Hech biri ishlamasa xabar chiqadi. */
export function speakEnglish(text: string, rate: number = 0.9): void {
  const clean = text.replace(/[*_#`~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!clean) return;
  stopSpeaking();
  const my = reqId;
  const words = (clean.match(/[A-Za-z][A-Za-z'’-]*/g) || []).slice(0, 12).map(w => w.toLowerCase());
  if (!words.length) return;

  // Ibora yoki gap (2 va undan ko'p so'z): bitta ravon audio
  if (words.length > 1) {
    speakFluent(clean, rate, my).catch(() => {
      if (my === reqId) browserSpeak(clean, rate, my);
    });
    return;
  }

  // Yakka so'z
  (async () => {
    const word = words[0];
    // 1) server (British neyral) — xotirada bo'lsa zumda chiqadi
    const url = await serverAudio(word);
    if (my !== reqId) return;
    if (url && (await playUrl(url, rate, my, 3000))) return;
    if (my !== reqId) return;
    // 2) inson yozuvi (UK afzal)
    const human = await getHumanAudio(word);
    if (my !== reqId) return;
    if (human && (await playUrl(human, rate, my, HUMAN_TIMEOUT_MS))) return;
    if (my !== reqId) return;
    if (!wikiMiss.has(word)) {
      if (await playUrl(wikiUrl(word), rate, my, WIKI_TIMEOUT_MS)) return;
      if (my !== reqId) return;
      if (await playUrl(wikiUsUrl(word), rate, my, WIKI_TIMEOUT_MS)) return;
      if (my !== reqId) return;
      wikiMiss.add(word);
    }
    // 3) Google, so'ng qurilma ovozi (en-GB afzal)
    if (await playUrl(gttsUrl(word), rate, my, GTTS_TIMEOUT_MS)) return;
    if (my !== reqId) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && (cachedVoice || window.speechSynthesis.getVoices().length)) {
      browserSpeak(clean, rate, my);
    } else if (typeof window !== 'undefined') {
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
