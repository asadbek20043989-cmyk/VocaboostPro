import { Certificate } from '../types';
import { drawQr } from './qr';

// Gorizontal (A4 albom) sertifikat. Har bir sertifikatda o'z QR kodi bor: skaner qilinsa, shu sertifikat sahifasi ochiladi.
export const CERT_W = 1754;
export const CERT_H = 1240;
/** 9:16 (tik) format: Telegram Stories va telefon ekrani uchun */
export const CERT_STORY_W = 1080;
export const CERT_STORY_H = 1920;
/** Har bir sertifikatning pastki o'rtasiga yoziladigan bot manzili */
export const CERT_BOT = '@VocaBoostProBot';
// O'lcham sertifikat formatiga qarab chizish paytida o'zgaradi (16:9 yoki 9:16)
let W = CERT_W;
let H = CERT_H;

type Deco = 'bronze' | 'silver' | 'gold' | 'platinum' | 'champion' | 'active' | 'marathon' | 'thanks' | 'trust' | 'growth' | 'wisdom' | 'speed' | 'reviewer' | 'expert' | 'consistent' | 'limitless';

interface Tpl {
  name: string;
  ribbonText: string;
  deco: Deco;
  frame: [string, string, string]; // och, o'rta, to'q
  accent: string; // "Boost" va F.I.SH. rangi
  head: [string, string]; // SERTIFIKAT gradienti (tepa, past)
  ribbon: [string, string, string]; // lenta: yorqin, asosiy, qirra
  ribbonInk: string;
  nameGrad: [string, string];
  wreath: string | null; // gul (lavr) rangi
  crown?: boolean;
  corner?: string; // burchak to'ldirish rangi
  bg?: { dark: string; mid: string; glow: string; light: string; accent: string }; // fon palitrasi
}

export const TEMPLATES: Record<string, Tpl> = {
  bronze: { name: 'Bronza', ribbonText: 'BRONZA', deco: 'bronze', frame: ['#F6B77A', '#E8923A', '#9A5420'], accent: '#E8923A', head: ['#F5B37A', '#C26A2E'], ribbon: ['#F0A468', '#C8702F', '#8A4A1D'], ribbonInk: '#2B1608', nameGrad: ['#F2A767', '#BE6A2C'], wreath: null },
  silver: { name: 'Kumush', ribbonText: 'KUMUSH', deco: 'silver', frame: ['#E8F1F8', '#A9C3D9', '#5F7C95'], accent: '#C9D8E6', head: ['#FFFFFF', '#9FB4C7'], ribbon: ['#E6ECF2', '#A9B6C3', '#6B7886'], ribbonInk: '#1B2530', nameGrad: ['#F4F8FC', '#9FB1C4'], wreath: '#C3D0DC' },
  gold: { name: 'Oltin', ribbonText: 'OLTIN', deco: 'gold', frame: ['#FFE58A', '#F2B705', '#A8730A'], accent: '#F5C21B', head: ['#FFE98F', '#D79B0A'], ribbon: ['#FFE079', '#E6A912', '#9A6A08'], ribbonInk: '#2E1F02', nameGrad: ['#FFE48A', '#D9A10E'], wreath: '#E9B820' },
  platinum: { name: 'Platina', ribbonText: 'PLATINA', deco: 'platinum', frame: ['#D4EEFF', '#8EC5E8', '#3F7FA6'], accent: '#8EC5E8', head: ['#EAF7FF', '#6FA9CF'], ribbon: ['#A9D4F0', '#6BA6CC', '#3A6E92'], ribbonInk: '#08202F', nameGrad: ['#DDF1FF', '#78B2D8'], wreath: '#A9D2EC' },
  champion: { name: 'Chempion', ribbonText: '1-HAFTA CHEMPIONI', deco: 'champion', frame: ['#FFE08A', '#F2A91B', '#B4540E'], accent: '#F5B83A', head: ['#FFE08A', '#D58A12'], ribbon: ['#E0443F', '#B01C26', '#6E0E16'], ribbonInk: '#FFD978', nameGrad: ['#FFE08A', '#D58A12'], wreath: '#F2B33A', crown: true, corner: '#A3151F' },
  active: { name: 'Eng faol', ribbonText: 'ENG FAOL', deco: 'active', frame: ['#7EE0A0', '#2DAA5F', '#166B3A'], accent: '#F5C21B', head: ['#FFE48A', '#D79B0A'], ribbon: ['#3FBF77', '#1F8C50', '#0F5A32'], ribbonInk: '#EAFFF1', nameGrad: ['#FFE48A', '#D9A10E'], wreath: '#4FC783' },
  marathon: { name: 'Marafon', ribbonText: 'MARAFON', deco: 'marathon', frame: ['#7FB6FF', '#2F7BFF', '#1546B8'], accent: '#4C95FF', head: ['#D8E9FF', '#4C8EEA'], ribbon: ['#3C8CFF', '#1F62E0', '#123F9C'], ribbonInk: '#F2F8FF', nameGrad: ['#CFE3FF', '#3F86F0'], wreath: null },
  thanks: { name: 'Minnatdorchilik', ribbonText: 'MINNATDORCHILIK', deco: 'thanks', frame: ['#D6BFFF', '#9B6BF2', '#5B2FB3'], accent: '#B58BFF', head: ['#EBDDFF', '#9A74E6'], ribbon: ['#7B4FD8', '#5A32B0', '#3A1D80'], ribbonInk: '#F4ECFF', nameGrad: ['#EBDDFF', '#A67FF0'], wreath: null },
  trust: { name: 'Ishonch', ribbonText: 'ISHONCH', deco: 'trust', frame: ['#BAE6FD', '#38BDF8', '#0284C7'], accent: '#38BDF8', head: ['#F0F9FF', '#38BDF8'], ribbon: ['#7DD3FC', '#0284C7', '#0369A1'], ribbonInk: '#082F49', nameGrad: ['#F0F9FF', '#38BDF8'], wreath: '#38BDF8' },
  growth: { name: 'Yuksalish', ribbonText: 'YUKSALISH', deco: 'growth', frame: ['#FDE68A', '#F59E0B', '#B45309'], accent: '#F59E0B', head: ['#FFFBEB', '#D97706'], ribbon: ['#FBBF24', '#D97706', '#78350F'], ribbonInk: '#451A03', nameGrad: ['#FEF3C7', '#F59E0B'], wreath: '#F59E0B', crown: true },
  wisdom: { name: 'Bilim donosi', ribbonText: 'BILIM DONOSI', deco: 'wisdom', frame: ['#FDE68A', '#D97706', '#78350F'], accent: '#D97706', head: ['#FFFDF5', '#B45309'], ribbon: ['#F59E0B', '#B45309', '#451A03'], ribbonInk: '#FEF3C7', nameGrad: ['#FFFBEB', '#D97706'], wreath: '#D97706' },
  speed: { name: 'Tezkor', ribbonText: 'TEZKOR', deco: 'speed', frame: ['#A5F3FC', '#06B6D4', '#0E7490'], accent: '#06B6D4', head: ['#ECFEFF', '#0891B2'], ribbon: ['#22D3EE', '#0891B2', '#155E75'], ribbonInk: '#083344', nameGrad: ['#ECFEFF', '#06B6D4'], wreath: null },
  reviewer: { name: 'Top Reviewer', ribbonText: 'TOP REVIEWER', deco: 'reviewer', frame: ['#FEF08A', '#EAB308', '#854D0E'], accent: '#EAB308', head: ['#FEF9C3', '#CA8A04'], ribbon: ['#FACC15', '#CA8A04', '#713F12'], ribbonInk: '#422006', nameGrad: ['#FEF08A', '#EAB308'], wreath: '#EAB308', crown: true },
  expert: { name: 'Mutaxassis', ribbonText: 'MUTAXASSIS', deco: 'expert', frame: ['#E9D5FF', '#C084FC', '#7E22CE'], accent: '#C084FC', head: ['#FAF5FF', '#A855F7'], ribbon: ['#D8B4FE', '#9333EA', '#581C87'], ribbonInk: '#3B0764', nameGrad: ['#FAF5FF', '#C084FC'], wreath: null },
  consistent: { name: 'Barqaror', ribbonText: 'BARQAROR', deco: 'consistent', frame: ['#A7F3D0', '#10B981', '#047857'], accent: '#10B981', head: ['#ECFDF5', '#059669'], ribbon: ['#34D399', '#059669', '#064E3B'], ribbonInk: '#022C22', nameGrad: ['#ECFDF5', '#10B981'], wreath: '#10B981' },
  limitless: { name: 'Cheksiz', ribbonText: 'CHEKSIZ', deco: 'limitless', frame: ['#C7D2FE', '#818CF8', '#4338CA'], accent: '#818CF8', head: ['#EEF2FF', '#6366F1'], ribbon: ['#A5B4FC', '#4F46E5', '#312E81'], ribbonInk: '#1E1B4B', nameGrad: ['#EEF2FF', '#818CF8'], wreath: null },
};

const SERIF = "Georgia, 'Times New Roman', 'DejaVu Serif', serif";
const SANS = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, 'DejaVu Sans', sans-serif";

/** Sertifikat QR kodi ochadigan manzil */
export const certUrl = (id: string): string => {
  const base: string = ((import.meta as any).env?.VITE_SITE_URL as string) || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base.replace(/\/$/, '')}/c/${encodeURIComponent(id)}`;
};

const fmtDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || '';
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** Harflar orasi ochiq matn (markazda) */
function spaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, gap: number, fill?: string | CanvasGradient): number {
  const chars = Array.from(text);
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  if (fill) ctx.fillStyle = fill;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + gap;
  });
  ctx.textAlign = prev;
  return total;
}

function vGrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, a: string, b: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

function metal(ctx: CanvasRenderingContext2D, t: Tpl): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.frame[0]);
  g.addColorStop(0.5, t.frame[1]);
  g.addColorStop(1, t.frame[2]);
  return g;
}

// ---------- Yagona art-deko uslub: oltin ramka, shablonga qarab o'zgaruvchan fon, yaltiroq yulduzlar ----------
const GOLD: [string, string, string] = ['#FFF0B3', '#E4B24C', '#8F651B'];
interface BgPal { dark: string; mid: string; glow: string; light: string; accent: string }
const BGK: Record<string, BgPal> = {
  teal: { dark: '#03161A', mid: '#0A4A47', glow: '#19C2A5', light: '#7FF0D6', accent: '#2DD4A8' },
  blue: { dark: '#050F28', mid: '#0C3A7C', glow: '#3B82F6', light: '#93C5FD', accent: '#60A5FA' },
  purple: { dark: '#120726', mid: '#3A1C78', glow: '#8B5CF6', light: '#C4B5FD', accent: '#A78BFA' },
  amber: { dark: '#170F04', mid: '#4A3410', glow: '#D9A21B', light: '#FDE68A', accent: '#F5C21B' },
};
const BG_OF: Record<string, string> = { marathon: 'blue', thanks: 'purple', expert: 'purple', limitless: 'purple', growth: 'amber', wisdom: 'amber' };
Object.entries(TEMPLATES).forEach(([k, t]) => {
  const pal = BGK[BG_OF[k] || 'teal'];
  t.bg = pal;
  t.frame = GOLD;
  t.accent = pal.accent;
  t.head = ['#FFF3BF', '#D9A331'];
  t.nameGrad = ['#FFFFFF', '#F0C463'];
});

function rnd(seed: number) {
  let x = seed || 1;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
}

function background(ctx: CanvasRenderingContext2D, t: Tpl) {
  const pal = t.bg || BGK.teal;
  const m = Math.min(W, H);
  const g = ctx.createLinearGradient(0, 0, W * 0.35, H);
  g.addColorStop(0, pal.dark);
  g.addColorStop(0.45, pal.mid);
  g.addColorStop(1, pal.dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // markaziy nur
  const gl = ctx.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H * 0.4, Math.max(W, H) * 0.62);
  gl.addColorStop(0, pal.glow + '55');
  gl.addColorStop(1, pal.glow + '00');
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, W, H);

  // katta geometrik (art-deko) shakllar
  const poly = (pts: number[][], fillA: number, strokeA: number) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = pal.light + Math.round(fillA * 255).toString(16).padStart(2, '0');
    ctx.fill();
    ctx.strokeStyle = pal.light + Math.round(strokeA * 255).toString(16).padStart(2, '0');
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  const dia = (cx: number, cy: number, r: number, f: number, sA: number) => poly([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]], f, sA);
  dia(W * 0.08, H * 0.82, m * 0.5, 0.07, 0.2);
  dia(W * 0.08, H * 0.82, m * 0.34, 0.06, 0.18);
  dia(W * 0.96, H * 0.94, m * 0.42, 0.07, 0.18);
  dia(W * 0.98, H * 0.18, m * 0.3, 0.05, 0.14);
  // yuqoridagi "V" yo'llar
  poly([[0, H * 0.13], [W / 2, H * 0.3], [W, H * 0.13], [W, H * 0.17], [W / 2, H * 0.34], [0, H * 0.17]], 0.06, 0.14);
  poly([[0, H * 0.19], [W / 2, H * 0.36], [W, H * 0.19], [W, H * 0.21], [W / 2, H * 0.38], [0, H * 0.21]], 0.04, 0.1);

  // yorqin nur chiziqlari (pastki o'ng)
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x0 = W * (0.72 + i * 0.07), y0 = H;
    const lg = ctx.createLinearGradient(x0, y0, x0 - m * 0.5, y0 - m * 0.5);
    lg.addColorStop(0, pal.light + 'AA');
    lg.addColorStop(1, pal.light + '00');
    ctx.strokeStyle = lg;
    ctx.lineWidth = 2.5 - i * 0.4;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 - m * 0.5, y0 - m * 0.5); ctx.stroke();
  }
  ctx.restore();

  // yulduzcha zarralar (har bir sertifikatda bir xil joylashuv)
  const r = rnd(W * 31 + H);
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = r() * H, s = 0.8 + r() * 2.4, a = 0.12 + r() * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fillStyle = (r() > 0.6 ? '#FFF3BF' : pal.light) + Math.round(a * 255).toString(16).padStart(2, '0');
    ctx.fill();
  }
  // chetlarni qoraytirish
  const vg = ctx.createRadialGradient(W / 2, H / 2, m * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/** Oltin ikki qatlamli ramka + burchaklardan chiquvchi nur chiziqlari */
function frame(ctx: CanvasRenderingContext2D, t: Tpl) {
  const m = metal(ctx, t);
  const o = 30, i2 = 54;
  ctx.strokeStyle = m;
  ctx.lineWidth = 3.5;
  ctx.strokeRect(o, o, W - o * 2, H - o * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(i2, i2, W - i2 * 2, H - i2 * 2);
  const L = Math.min(W, H) * 0.3;
  [[o, o, 1, 1], [W - o, o, -1, 1], [o, H - o, 1, -1], [W - o, H - o, -1, -1]].forEach(([cx, cy, sx, sy]) => {
    for (let k = 0; k < 9; k++) {
      const ang = (6 + k * 9.5) * (Math.PI / 180);
      const len = L * (0.45 + 0.55 * Math.abs(Math.sin(k * 1.37 + 0.6)));
      const ex = cx + sx * Math.cos(ang) * len, ey = cy + sy * Math.sin(ang) * len;
      const lg = ctx.createLinearGradient(cx, cy, ex, ey);
      lg.addColorStop(0, 'rgba(255,230,150,0.95)');
      lg.addColorStop(1, 'rgba(228,178,76,0)');
      ctx.strokeStyle = lg;
      ctx.lineWidth = k % 3 === 0 ? 2.2 : 1.2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.fillStyle = '#FFE9A8';
    ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 9, cy); ctx.closePath(); ctx.fill();
  });
}

/** To'rt qirrali yaltiroq yulduz (lentaning ikki yonida) */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#FFF1B0') {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 1.1;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.35, color);
  g.addColorStop(1, '#D9A331');
  ctx.fillStyle = g;
  ctx.beginPath();
  const k = r * 0.16;
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(k, -k, r, 0);
  ctx.quadraticCurveTo(k, k, 0, r);
  ctx.quadraticCurveTo(-k, k, -r, 0);
  ctx.quadraticCurveTo(-k, -k, 0, -r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function ribbon(ctx: CanvasRenderingContext2D, t: Tpl, cx: number, cy: number, customText?: string): number {
  const txt = (customText || t.ribbonText).toUpperCase();
  ctx.font = `700 44px ${SERIF}`;
  const textW = Array.from(txt).reduce((a, c) => a + ctx.measureText(c).width + 6, -6);
  const half = Math.max(210, textW / 2 + 70);
  const h = 70;
  const notch = 34;
  const x0 = cx - half;
  const x1 = cx + half;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, t.ribbon[0]);
  g.addColorStop(0.55, t.ribbon[1]);
  g.addColorStop(1, t.ribbon[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1 - notch, cy); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0 + notch, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = metal(ctx, t); // oltin qirra
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x0 + notch + 6, y0 + 7); ctx.lineTo(x1 - notch - 6, y0 + 7); ctx.stroke();
  ctx.fillStyle = t.ribbonInk;
  ctx.textBaseline = 'middle';
  spaced(ctx, txt, cx, cy + 2, 6);
  ctx.textBaseline = 'alphabetic';
  return half;
}

let logoPromise: Promise<HTMLImageElement | null> | null = null;
function loadLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromise) {
    logoPromise = new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/logo.png';
    });
  }
  return logoPromise;
}

/** Pastdagi «muhr»lar: daraja, yodlangan so'zlar, streak (sertifikatning rasmiy qiymatini oshiradi) */
function statPills(ctx: CanvasRenderingContext2D, t: Tpl, cx: number, y: number, stats: NonNullable<Certificate['stats']>, pw: number, ph: number) {
  const items: [string, string][] = [];
  if (stats.lvl) items.push(['DARAJA', String(stats.lvl)]);
  if (Number(stats.words) > 0) items.push(["SO'ZLAR", String(stats.words)]);
  if (Number(stats.streak) > 0) items.push(['STREAK', `${stats.streak} kun`]);
  if (!items.length) return;
  const gap = 20;
  const total = items.length * pw + (items.length - 1) * gap;
  let x = cx - total / 2;
  items.forEach(([label, value], idx) => {
    const isGold = label === 'STREAK';
    const edge = isGold ? '#F5C95A' : t.accent;
    const r = 16;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + pw - r, y); ctx.quadraticCurveTo(x + pw, y, x + pw, y + r);
    ctx.lineTo(x + pw, y + ph - r); ctx.quadraticCurveTo(x + pw, y + ph, x + pw - r, y + ph);
    ctx.lineTo(x + r, y + ph); ctx.quadraticCurveTo(x, y + ph, x, y + ph - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.save();
    ctx.shadowColor = edge;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = edge;
    ctx.font = `800 15px ${SANS}`;
    spaced(ctx, label, x + pw / 2, y + 22, 2);
    ctx.fillStyle = '#F1F5FB';
    let fs = 31;
    ctx.font = `800 ${fs}px ${SERIF}`;
    while (ctx.measureText(value).width > pw - 20 && fs > 18) { fs -= 2; ctx.font = `800 ${fs}px ${SERIF}`; }
    ctx.fillText(value, x + pw / 2, y + ph - 13);
    x += pw + gap;
  });
}

/** Sertifikatni canvas'ga chizadi: 16:9 (albom) yoki 9:16 (tik, Stories) format, QR bilan */
export async function drawCertificate(canvas: HTMLCanvasElement, c: Certificate): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  try {
    await (document as any).fonts?.load?.(`700 40px 'Plus Jakarta Sans'`);
  } catch {
    /* shrift yuklanmasa, zaxira shrift ishlatiladi */
  }
  const logo = await loadLogo();
  const t = TEMPLATES[c.tpl] || TEMPLATES.gold;
  const story = c.fmt === 'story';
  // DIQQAT: bundan keyingi chizish sinxron — W/H boshqa chizish bilan aralashib ketmaydi
  W = story ? CERT_STORY_W : CERT_W;
  H = story ? CERT_STORY_H : CERT_H;
  canvas.width = W;
  canvas.height = H;
  ctx.textAlign = 'center';

  // Aniq, tiniq va hashamatli vektorli fon va hoshiya (hech qanday xiralashish yoki aralashishsiz)
  background(ctx, t);
  frame(ctx, t);

  // VocaBoost yozuvi (+ logotip)
  const brandY = story ? 220 : 176;
  ctx.font = `800 ${story ? 58 : 62}px ${SANS}`;
  const wv = ctx.measureText('Voca').width;
  const wb = ctx.measureText('Boost').width;
  const lx = W / 2 - (wv + wb) / 2 + (story ? 30 : 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Voca', lx, brandY);
  ctx.fillStyle = t.accent;
  ctx.fillText('Boost', lx + wv, brandY);
  if (logo) {
    ctx.save();
    ctx.beginPath(); ctx.arc(lx - 52, brandY - 20, 34, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(logo, lx - 86, brandY - 54, 68, 68);
    ctx.restore();
  }
  ctx.textAlign = 'center';

  // SERTIFIKAT
  let hs = story ? 118 : 150;
  const hGap = story ? 6 : 10;
  ctx.font = `800 ${hs}px ${SERIF}`;
  if (story) {
    const widthOf = () => Array.from('SERTIFIKAT').reduce((a, ch) => a + ctx.measureText(ch).width + hGap, -hGap);
    while (widthOf() > W - 220 && hs > 60) { hs -= 4; ctx.font = `800 ${hs}px ${SERIF}`; }
  }
  const headY = story ? 440 : 330;
  ctx.save();
  spaced(ctx, 'SERTIFIKAT', W / 2, headY + 5, hGap, '#4A3108'); // chuqur soya (bo'rtma ko'rinish)
  ctx.shadowColor = 'rgba(255,200,80,0.45)';
  ctx.shadowBlur = 22;
  spaced(ctx, 'SERTIFIKAT', W / 2, headY, hGap, vGrad(ctx, headY - hs * 0.8, headY + 6, t.head[0], t.head[1]));
  ctx.restore();

  // lenta (tur nomi), gul, toj
  const ry = story ? 560 : 428;
  const badgeText = (c.badgeText || (c.tpl === 'champion' ? '1-HAFTA CHEMPIONI' : t.ribbonText)).toUpperCase();
  const half = ribbon(ctx, t, W / 2, ry, badgeText);
  const sx = half + (story ? 62 : 90);
  if (W / 2 + sx + 36 < W - 100) {
    [-1, 1].forEach(sd => {
      sparkle(ctx, W / 2 + sd * sx, ry, story ? 34 : 42);
      sparkle(ctx, W / 2 + sd * (sx + 44), ry - 26, 9);
      sparkle(ctx, W / 2 + sd * (sx - 30), ry + 30, 7);
    });
  }

  // matnlar
  ctx.fillStyle = '#D9E0EC';
  ctx.font = `400 ${story ? 36 : 32}px ${SERIF}`;
  const subY = story ? 700 : 548;
  ctx.fillText('Ushbu sertifikat quyidagi shaxsga topshiriladi', W / 2, subY);

  let size = story ? 108 : 112;
  ctx.font = `800 ${size}px ${SERIF}`;
  const nm = c.name || "F.I.SH.";
  const nameMax = story ? W - 200 : W - 420;
  while (ctx.measureText(nm).width > nameMax && size > 48) {
    size -= 6;
    ctx.font = `800 ${size}px ${SERIF}`;
  }
  const nameY = story ? 830 : 668;
  ctx.save();
  ctx.shadowColor = 'rgba(255,205,90,0.55)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = vGrad(ctx, nameY - size * 0.75, nameY + 12, t.nameGrad[0], t.nameGrad[1]);
  ctx.fillText(nm, W / 2, nameY);
  ctx.restore();

  // chiziq + olmos
  const my = story ? 880 : 704;
  const dHalf = story ? 380 : 520;
  const lg = metal(ctx, t);
  ctx.strokeStyle = lg;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(W / 2 - dHalf, my); ctx.lineTo(W / 2 - 18, my); ctx.moveTo(W / 2 + 18, my); ctx.lineTo(W / 2 + dHalf, my); ctx.stroke();
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.moveTo(W / 2, my - 11); ctx.lineTo(W / 2 + 11, my); ctx.lineTo(W / 2, my + 11); ctx.lineTo(W / 2 - 11, my); ctx.closePath(); ctx.fill();

  // Sarlavha (yutuq yoki natija) va Izoh
  ctx.fillStyle = '#F1F5FB';
  ctx.font = `700 ${story ? 52 : 50}px ${SERIF}`;
  const tY = story ? 980 : 790;
  const tLH = story ? 66 : 62;
  const titleLines = wrap(ctx, c.title || '', story ? W - 220 : W - 460).slice(0, story ? 3 : 2);
  titleLines.forEach((l, i) => ctx.fillText(l, W / 2, tY + i * tLH));
  let lastY = tY + Math.max(0, titleLines.length - 1) * tLH;
  if (c.reason) {
    ctx.fillStyle = '#A9B8CE';
    ctx.font = `italic 400 ${story ? 35 : 31}px ${SERIF}`;
    const rLH = story ? 50 : 44;
    const y0 = lastY + (story ? 62 : 58);
    const rl = wrap(ctx, c.reason, story ? W - 260 : W - 520).slice(0, story ? 3 : 3);
    rl.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * rLH));
    lastY = y0 + Math.max(0, rl.length - 1) * rLH;
  }

  // QR joylashuvi (format bo'yicha)
  const qs = story ? 300 : 210;
  const qx = story ? W / 2 - qs / 2 : W - 150 - qs;
  const qy = story ? 1330 : H - 140 - qs - 24;

  // Muhrlar: daraja / so'zlar / streak (joy yetsagina chiziladi)
  if (c.stats) {
    const ph = story ? 72 : 68;
    const sy = lastY + (story ? 46 : 40);
    const limit = story ? qy - 30 : H - 150;
    if (sy + ph <= limit) statPills(ctx, t, W / 2, sy, c.stats, story ? 250 : 220, ph);
  }

  if (story) {
    // 9:16: sana va raqam QR ostida, o'rtada
    ctx.textAlign = 'center';
    ctx.fillStyle = '#B4C0D2';
    ctx.font = `400 32px ${SERIF}`;
    ctx.fillText(`Sana: ${fmtDate(c.date)}   ·   № ${c.id}`, W / 2, H - 150);
  } else {
    // pastki chap: sana va raqam
    ctx.textAlign = 'left';
    ctx.fillStyle = '#B4C0D2';
    ctx.font = `400 32px ${SERIF}`;
    ctx.fillText(`Sana: ${fmtDate(c.date)}`, 150, H - 170);
    ctx.fillText(`№ ${c.id}`, 150, H - 120);
  }

  // QR (har bir sertifikat uchun alohida)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qx - 10, qy - 10, qs + 20, qs + 20);
  ctx.strokeStyle = lg;
  ctx.lineWidth = 4;
  ctx.strokeRect(qx - 10, qy - 10, qs + 20, qs + 20);
  if (c.verified !== false) drawQr(ctx, certUrl(c.id), qx, qy, qs, { dark: '#0A1220', light: '#FFFFFF', quiet: 1, ecc: 'M' });
  else {
    ctx.fillStyle = '#64748B';
    ctx.font = `600 20px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('Mahalliy nusxa', qx + qs / 2, qy + qs / 2);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = t.accent;
  ctx.font = `800 17px ${SANS}`;
  spaced(ctx, 'TEKSHIRISH QR', qx + qs / 2, qy + qs + 42, 1.5);

  // pastki o'rta: bot manzili
  ctx.textAlign = 'center';
  ctx.font = `800 ${story ? 40 : 38}px ${SANS}`;
  ctx.fillStyle = t.accent;
  ctx.fillText(CERT_BOT, W / 2, story ? H - 92 : H - 118);
  ctx.textAlign = 'center';
}

export const certFileName = (c: Certificate, ext = 'png') => `VocaBoost-${c.id}.${ext}`;

/** Sertifikatni rasm (JPEG) qilib, base64 (prefikssiz) ko'rinishida qaytaradi — botga yuborish uchun. */
export async function certificateBase64(c: Certificate): Promise<string> {
  const canvas = document.createElement('canvas');
  await drawCertificate(canvas, c);
  const url = canvas.toDataURL('image/jpeg', 0.92);
  return url.slice(url.indexOf(',') + 1);
}
