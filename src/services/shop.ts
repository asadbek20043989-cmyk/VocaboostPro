// Do'kon yordamchilari: katalog (standart + admin sozlamalari), narx, taklif havolasi, Lo-Fi pleer.
import { DEFAULT_ITEMS, ShopItem, ShopCat, ShopKind } from '../data/shopDefaults';
import type { UserProfile } from '../types';

const toArr = (v: any): any[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);
const num = (v: any, d: number) => (Number.isFinite(Number(v)) && v !== '' && v !== null && v !== undefined ? Number(v) : d);

export interface ShopCfg {
  enabled: boolean;
  coinPerXp: number; // 1 XP = necha tanga
  startCoins: number;
  streak7: number;
  streak30: number;
  allQuests: number;
  premiumText: string;
  booksText: string;
  lofi: { title: string; url: string }[];
}

export function shopCfg(raw: any): ShopCfg {
  const c = raw || {};
  return {
    enabled: c.enabled !== false,
    coinPerXp: Math.max(0, Math.min(10, num(c.coinPerXp, 0.5))),
    startCoins: Math.max(0, Math.min(100000, Math.round(num(c.startCoins, 50)))),
    streak7: Math.max(0, Math.round(num(c.streak7, 30))),
    streak30: Math.max(0, Math.round(num(c.streak30, 150))),
    allQuests: Math.max(0, Math.round(num(c.allQuests, 15))),
    premiumText: String(c.premiumText || ''),
    booksText: String(c.booksText || ''),
    lofi: toArr(c.lofi).filter((t: any) => t && /^https?:\/\//.test(String(t.url || ''))).map((t: any) => ({ title: String(t.title || 'Lo-Fi').slice(0, 60), url: String(t.url) })),
  };
}

/** Katalog: standart mahsulotlar + admin o'zgartirishlari (config/shop/items/<id>) + admin qo'shgan mahsulotlar */
export function buildCatalog(raw: any): ShopItem[] {
  const ov = (raw && raw.items) || {};
  const list: ShopItem[] = [];
  DEFAULT_ITEMS.forEach((d, i) => {
    const o = ov[d.id] || {};
    list.push({
      ...d,
      title: String(o.title || d.title),
      desc: String(o.desc ?? d.desc),
      price: Math.max(0, Math.round(num(o.price, d.price))),
      discount: Math.max(0, Math.min(90, Math.round(num(o.discount, 0)))),
      active: o.active !== false,
      img: String(o.img || ''),
      cat: (['boosters', 'cosmetics', 'learning', 'social', 'vip', 'rewards'].includes(o.cat) ? o.cat : d.cat) as ShopCat,
      dayLimit: Math.max(0, Math.round(num(o.dayLimit, 0))),
      order: num(o.order, i),
    });
  });
  Object.entries(ov).forEach(([id, o]: [string, any]) => {
    if (!o || !o.custom || DEFAULT_ITEMS.some(d => d.id === id)) return;
    list.push({
      id, title: String(o.title || 'Sovg\'a'), desc: String(o.desc || ''), cat: (['boosters', 'cosmetics', 'learning', 'social', 'vip', 'rewards'].includes(o.cat) ? o.cat : 'rewards') as ShopCat,
      icon: String(o.icon || '🎁'), grad: ['#F472B6', '#9333EA'], price: Math.max(0, Math.round(num(o.price, 100))), kind: 'manual' as ShopKind, value: '',
      repeat: true, img: String(o.img || ''), discount: Math.max(0, Math.min(90, Math.round(num(o.discount, 0)))), active: o.active !== false,
      order: num(o.order, 500), dayLimit: Math.max(0, Math.round(num(o.dayLimit, 0))), custom: true,
    });
  });
  return list.filter(x => x.active).sort((a, b) => a.order - b.order);
}

export const priceOf = (it: ShopItem): number => Math.max(0, Math.round((it.price * (100 - (it.discount || 0))) / 100));
export const balanceOf = (p: Pick<UserProfile, 'coinsEarned' | 'coinsSpent'>): number => Math.max(0, Math.floor(p.coinsEarned || 0) - Math.floor(p.coinsSpent || 0));

/** Botning /start havolasi: u orqali kirgan har bir yangi do'st uchun taklif qiluvchiga XP beriladi */
export function inviteLinkFor(tgId: string | number | null | undefined, botName: string): string {
  if (!tgId || !botName) return '';
  return `https://t.me/${botName.replace(/^@/, '')}?start=ref_${tgId}`;
}

export function botNameFrom(cfgName: string | undefined): string {
  const env = (import.meta as any).env || {};
  if (cfgName) return String(cfgName).replace(/^@/, '');
  if (env.VITE_BOT_USERNAME) return String(env.VITE_BOT_USERNAME).replace(/^@/, '');
  const link = String(env.VITE_TELEGRAM_APP_LINK || '');
  const m = /t\.me\/([A-Za-z0-9_]{4,})/.exec(link);
  return m ? m[1] : 'VocaBoostProBot';
}

export const DEFAULT_SHARE_TEXT = "🚀 VocaBoost — inglizcha so'zlarni tez va uzoq yodlash ilovasi! Men har kuni mashq qilyapman. Sen ham qo'shil 👇";

// ---------------------------------------------------------------------------------------------------
// Lo-Fi pleer. Standart: brauzerning o'zida hosil qilinadigan sokin musiqa (fayl kerak emas, trafik yo'q).
// Admin musiqa havolalari (mp3) qo'shsa — ular ketma-ket chaladi.
// ---------------------------------------------------------------------------------------------------
type Lofi = { on: boolean; start: (tracks?: { title: string; url: string }[]) => void; stop: () => void; listeners: Set<() => void> };
const L: Lofi = { on: false, start: () => {}, stop: () => {}, listeners: new Set() };
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let audioEl: HTMLAudioElement | null = null;
let nextT = 0;
let step = 0;
const CHORDS = [[48, 55, 59, 64], [45, 52, 57, 60], [50, 57, 60, 65], [43, 50, 55, 59]];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function tick() {
  if (!ctx || !master) return;
  const bpm = 72;
  const beat = 60 / bpm;
  while (nextT < ctx.currentTime + 0.6) {
    const bar = Math.floor(step / 8) % 4;
    const s8 = step % 8; // 8 ta yarim zarb
    const t = nextT;
    if (s8 === 0) {
      CHORDS[bar].forEach((m, i) => {
        [-6, 6].forEach(det => {
          const o = ctx!.createOscillator();
          const g = ctx!.createGain();
          const f = ctx!.createBiquadFilter();
          o.type = 'triangle'; o.frequency.value = mtof(m + 12); o.detune.value = det + i;
          f.type = 'lowpass'; f.frequency.value = 900;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.5); g.gain.linearRampToValueAtTime(0, t + beat * 4.2);
          o.connect(f); f.connect(g); g.connect(master!); o.start(t); o.stop(t + beat * 4.4);
        });
      });
    }
    if (s8 === 0 || s8 === 5) { // zarba (kick)
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
    }
    if (s8 % 2 === 1 || s8 === 4) { // hi-hat / snare shovqini
      const len = Math.floor(ctx.sampleRate * 0.06);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
      src.buffer = buf; f.type = 'highpass'; f.frequency.value = s8 === 4 ? 1800 : 6000;
      g.gain.value = s8 === 4 ? 0.12 : 0.05;
      src.connect(f); f.connect(g); g.connect(master); src.start(t);
    }
    if (s8 === 2 || s8 === 6) { // yumshoq melodiya
      const m = CHORDS[bar][Math.floor(Math.random() * 4)] + 24;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + beat * 1.6);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + beat * 1.7);
    }
    nextT += beat / 2;
    step++;
  }
}

L.start = (tracks = []) => {
  if (L.on) return;
  L.on = true;
  if (tracks.length) {
    let i = 0;
    audioEl = new Audio(tracks[0].url);
    audioEl.volume = 0.5;
    audioEl.onended = () => { i = (i + 1) % tracks.length; if (audioEl) { audioEl.src = tracks[i].url; audioEl.play().catch(() => {}); } };
    audioEl.play().catch(() => { L.on = false; L.listeners.forEach(f => f()); });
  } else {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) { L.on = false; return; }
    ctx = new AC();
    master = ctx!.createGain();
    master.gain.value = 0.9;
    master.connect(ctx!.destination);
    // eski plastinka shitirlashi
    const len = ctx!.sampleRate * 2;
    const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() < 0.002 ? (Math.random() * 2 - 1) * 0.6 : (Math.random() * 2 - 1) * 0.01;
    const src = ctx!.createBufferSource(); const g = ctx!.createGain();
    src.buffer = buf; src.loop = true; g.gain.value = 0.5; src.connect(g); g.connect(master); src.start();
    nextT = ctx!.currentTime + 0.1; step = 0;
    timer = setInterval(tick, 200);
  }
  L.listeners.forEach(f => f());
};
L.stop = () => {
  L.on = false;
  if (timer) { clearInterval(timer); timer = null; }
  if (ctx) { ctx.close().catch(() => {}); ctx = null; master = null; }
  if (audioEl) { audioEl.pause(); audioEl.src = ''; audioEl = null; }
  L.listeners.forEach(f => f());
};
export const lofi = L;
