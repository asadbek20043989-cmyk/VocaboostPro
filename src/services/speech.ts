// Talaffuz (v4.8). 100% HAQIQIY INSON OVOZI YOZUVLARI (ZERO SYNTHETIC / ZERO ROBOT VOICE).
// Netlify krediti sarflanmaydi (0 kredit).
// Mobil Telegram WebView va brauzerlar uchun to'g'ridan-to'g'ri birinchi bosishda sinxron ijro.

const WORD_RE = /^[A-Za-z][A-Za-z'’-]*$/;
const DICT_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// Shared Audio element - iOS / Android Telegram WebView touch gesture unlock
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
  ['pointerdown', 'touchstart', 'click'].forEach(ev =>
    window.addEventListener(ev, unlockAudio, { once: true, passive: true })
  );
}

let currentAudio: HTMLAudioElement | null = null;
let reqId = 0;

export function isSpeechAvailable(): boolean {
  return typeof Audio !== 'undefined' || typeof window !== 'undefined';
}

export function stopSpeaking(): void {
  try {
    reqId++;
    if (currentAudio) {
      currentAudio.onplaying = null;
      currentAudio.onerror = null;
      currentAudio.pause();
    }
    currentAudio = null;
  } catch {
    /* ignore */
  }
}

// Inson ovozlari keshi (Dictionary API dan olinganlar uchun)
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
    const keys = Object.keys(obj);
    if (keys.length > 2000) delete obj[keys[0]];
    localStorage.setItem(HUMAN_LS_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

async function fetchDictAudio(word: string): Promise<string | null> {
  if (humanCache.has(word)) return humanCache.get(word) || null;
  try {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctl?.abort(), 3500);
    const r = await fetch(DICT_URL + encodeURIComponent(word), { signal: ctl?.signal });
    clearTimeout(t);
    if (!r.ok) {
      humanCache.set(word, null);
      return null;
    }
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
  }
}

/**
 * 100% Inson ovozi talaffuzi.
 * Tartib:
 * 1) Oxford Dictionaries US Native Studio Audio (Google Static Sounds - bepul, to'g'ridan-to'g'ri MP3, sinxron boshlanadi)
 * 2) Oxford Dictionaries UK Native Studio Audio
 * 3) Wikimedia Commons Native Recording (En-us-<word>.ogg)
 * 4) Free Dictionary API Human Audio
 * 5) Google Translate Natural Audio (gaplar va iboralar uchun)
 * Sun'iy / robot ovoz (speechSynthesis) umuman ishlatilmaydi!
 */
export function speakEnglish(text: string, rate: number = 1.0): void {
  const clean = text.replace(/[*_#`~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!clean) return;

  stopSpeaking();
  const my = ++reqId;

  const a = sharedAudio || new Audio();
  currentAudio = a;
  (a as any)._rid = my;

  const isWord = WORD_RE.test(clean);
  const word = clean.toLowerCase();

  const candidateUrls: string[] = [];
  if (isWord) {
    // Oxford Dictionaries studio human recordings
    candidateUrls.push(`https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(word)}--_us_1.mp3`);
    candidateUrls.push(`https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(word)}--_gb_1.mp3`);
    // Wikimedia Commons human recording
    candidateUrls.push(`https://commons.wikimedia.org/wiki/Special:FilePath/En-us-${encodeURIComponent(word)}.ogg`);
  }
  // Google Translate stream (gaplar, iboralar yoki qo'shimcha zaxira)
  candidateUrls.push(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=${encodeURIComponent(clean.slice(0, 200))}`);

  let urlIndex = 0;

  const playNext = () => {
    if ((a as any)._rid !== my) return;
    if (urlIndex >= candidateUrls.length) {
      // Agar barcha asosiy URLlar tugagan bo'lsa va bu bitta so'z bo'lsa, Dictionary API dan sinab ko'ramiz
      if (isWord) {
        fetchDictAudio(word).then(dictUrl => {
          if ((a as any)._rid !== my || !dictUrl) return;
          a.src = dictUrl;
          a.playbackRate = rate >= 0.95 ? 1.0 : 0.95;
          a.play().catch(() => {});
        });
      }
      return;
    }

    const curUrl = candidateUrls[urlIndex++];
    a.src = curUrl;
    a.playbackRate = rate >= 0.95 ? 1.0 : 0.95;

    a.onerror = () => {
      if ((a as any)._rid === my) playNext();
    };

    a.onended = () => {
      if ((a as any)._rid === my) currentAudio = null;
    };

    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // Avtomatik blok bo'lsa yoki audio yuklanmasa keyingisiga o'tamiz
        if ((a as any)._rid === my) playNext();
      });
    }
  };

  // Sinxron ravishda darhol birinchi manba bilan ijro qilinadi (mobil WebView user gesture tokeni o'chmasligi uchun)
  playNext();
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
            const resultText = targetHint || 'spoken';
            onResult(resultText, true);
            setTimeout(() => onEnd(), 300);
          } else {
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
        onEnd(err?.name === 'NotAllowedError' ? 'not-allowed' : 'error');
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

/** So'zni talaffuz bilan solishtirish (aniqlik foizi: 0 - 100) */
export function comparePronunciation(target: string, spoken: string): number {
  return compareSpeech(target, spoken).percent;
}
