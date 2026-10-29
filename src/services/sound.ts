// VocaBoost tovush effektlari: audio fayl kerak emas, hammasi WebAudio bilan sintez qilinadi.
// - sfx.click()   : har bir tugma bosilganda juda qisqa, ko'tarinki "ping"
// - sfx.correct() : to'g'ri javob — yorqin qo'ng'iroqcha arpeggio (ketma-ket to'g'ri javobda tovush balandlashadi)
// - sfx.wrong()   : xato javob — yumshoq, pasayuvchi "bop-bop"
// - sfx.win()     : g'alaba / sovrin fanfarasi
// Hammasini yuqori o'ng burchakdagi tugma (yoki Sozlamalar) orqali o'chirib qo'yish mumkin.
import { useSyncExternalStore } from 'react';

const KEY = 'lx_sfx_v1';

let on = true;
try {
  on = localStorage.getItem(KEY) !== '0';
} catch {
  /* ignore */
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const isSfxOn = () => on;
export function setSfxOn(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
  emit();
  if (v) sfx.click(true);
}
export const toggleSfx = () => setSfxOn(!on);

/** React hook: [yoqilganmi, o'rnatish] */
export function useSfx(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => on,
    () => true
  );
  return [v, setSfxOn];
}

// ---------- audio dvigatel ----------
let ctx: AudioContext | null = null;
let bus: GainNode | null = null; // quruq signal
let send: GainNode | null = null; // aks-sado (yengil "havo") uchun

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);

      bus = ctx.createGain();
      bus.connect(master);

      // yengil echo: ovozga "jonli" tus beradi
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.1;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      const wet = ctx.createGain();
      wet.gain.value = 0.28;
      send = ctx.createGain();
      send.connect(delay);
      delay.connect(lp);
      lp.connect(fb).connect(delay);
      lp.connect(wet).connect(master);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface NoteOpts {
  type?: OscillatorType;
  vol?: number;
  attack?: number;
  glideFrom?: number; // boshlang'ich chastota (silliq ko'tarilish/tushish)
  glideTime?: number;
  lowpass?: number; // past chastotali filtr (yumshoq tovush)
  echo?: number; // 0..1
}

function voice(freq: number, start: number, dur: number, o: NoteOpts = {}) {
  const c = getCtx();
  if (!c || !bus) return;
  const t0 = c.currentTime + start;
  const vol = o.vol ?? 0.2;
  const attack = o.attack ?? 0.006;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  if (o.glideFrom) {
    osc.frequency.setValueAtTime(o.glideFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(freq, t0 + (o.glideTime ?? 0.05));
  } else {
    osc.frequency.setValueAtTime(freq, t0);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  let out: AudioNode = g;
  if (o.lowpass) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lowpass;
    g.connect(f);
    out = f;
  }
  osc.connect(g);
  out.connect(bus);
  if (send && (o.echo ?? 0) > 0) {
    const s = c.createGain();
    s.gain.value = o.echo!;
    out.connect(s).connect(send);
  }
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Qo'ng'iroq (bell) tembri: asosiy ton + 2x va 3x overtonlar */
function bell(freq: number, start: number, dur: number, vol: number, echo = 0.5) {
  voice(freq, start, dur, { vol, echo, attack: 0.004 });
  voice(freq * 2, start, dur * 0.6, { vol: vol * 0.32, echo, attack: 0.003 });
  voice(freq * 3.01, start, dur * 0.3, { vol: vol * 0.12, echo: 0, attack: 0.002 });
}

// ---------- effektlar ----------
let streak = 0; // ketma-ket to'g'ri javoblar (tovush balandligi uchun)
let lastSpecial = 0; // to'g'ri/xato/g'alaba tovushi oxirgi marta qachon chalingan
let clickIdx = 0;
let lastClick = 0;
const PENTA = [659.25, 783.99, 880, 987.77, 1174.66, 987.77, 880, 783.99]; // E5 G5 A5 B5 D6...

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const sfx = {
  /** Har bir tugma uchun juda qisqa (~100 ms), ilhomlantiruvchi "ping". */
  click(force = false) {
    if (!on && !force) return;
    const t = now();
    if (!force && t - lastSpecial < 140) return; // to'g'ri/xato tovushi bilan qo'shilib ketmasin
    if (t - lastClick > 1500) clickIdx = 0; // ozgina tanaffusdan keyin yana pastdan boshlanadi
    lastClick = t;
    const f = PENTA[clickIdx++ % PENTA.length];
    voice(f, 0, 0.13, { type: 'sine', vol: 0.085, glideFrom: f * 0.8, glideTime: 0.035, echo: 0.35 });
    voice(f * 2, 0.012, 0.07, { type: 'sine', vol: 0.03, echo: 0 });
  },

  /** To'g'ri javob: porloq arpeggio. Ketma-ket to'g'ri javoblarda yarim ton balandlashadi (maks. +7). */
  correct() {
    if (!on) return;
    lastSpecial = now();
    streak = Math.min(streak + 1, 8);
    const k = Math.pow(2, Math.min(streak - 1, 7) / 12);
    const notes = [783.99, 987.77, 1174.66, 1567.98]; // G5 B5 D6 G6
    notes.forEach((f, i) => bell(f * k, i * 0.065, 0.42 + i * 0.05, 0.17));
    voice(3135.96 * k, 0.26, 0.35, { vol: 0.045, echo: 0.6 }); // yuqori "chaqnash"
  },

  /** Xato javob: yumshoq pasayuvchi ikki ton (qo'pol emas). */
  wrong() {
    if (!on) return;
    lastSpecial = now();
    streak = 0;
    voice(311.13, 0, 0.2, { type: 'triangle', vol: 0.2, lowpass: 900, glideFrom: 340, glideTime: 0.08 });
    voice(233.08, 0.14, 0.34, { type: 'triangle', vol: 0.2, lowpass: 800, glideFrom: 262, glideTime: 0.09 });
    voice(116.54, 0.14, 0.3, { type: 'sine', vol: 0.12, echo: 0 });
  },

  /** G'alaba / sovrin: fanfara. big=true bo'lsa uzunroq va to'laroq. */
  win(big = false) {
    if (!on) return;
    lastSpecial = now();
    const seq = big ? [523.25, 659.25, 783.99, 1046.5, 1318.51] : [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => bell(f, i * 0.1, 0.5, 0.2, 0.55));
    const t = seq.length * 0.1;
    [523.25, 659.25, 783.99, 1046.5].forEach(f => voice(f, t, big ? 1.1 : 0.7, { type: 'triangle', vol: 0.09, echo: 0.5 }));
    if (big) {
      bell(1567.98, t + 0.1, 0.9, 0.16, 0.6);
      voice(2093, t + 0.25, 0.7, { vol: 0.05, echo: 0.7 });
    }
  },

  /** Baraban aylanayotgandagi "tik" */
  tick() {
    if (!on) return;
    voice(900, 0, 0.04, { type: 'square', vol: 0.035, lowpass: 2400, echo: 0 });
  },
};

// Eski nomlar bilan moslik
export const playTick = () => sfx.tick();
export const playWin = (big = false) => sfx.win(big);

/** Ilovadagi barcha tugmalarga avtomatik "click" tovushi (bir marta o'rnatiladi). */
let installed = false;
export function installGlobalClickSound() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const SEL = 'button, [role="button"], a[href], summary, select, input[type="checkbox"], input[type="radio"], label[data-sfx]';
  document.addEventListener(
    'click',
    e => {
      const el = (e.target as Element | null)?.closest?.(SEL) as HTMLElement | null;
      if (!el || (el as HTMLButtonElement).disabled) return;
      if (el.closest('[data-nosfx]')) return;
      sfx.click();
    },
    false
  );
}
