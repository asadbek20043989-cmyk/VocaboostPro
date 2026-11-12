// «Global Blitz»: tasodifiy raqib bilan Blitz Duel.
// Jonli raqib topilsa — «Do'st bilan Blitz Duel» xonasi ochiladi (kod bir xil). Topilmasa — saqlangan natija («ruh» raqib).
// Navbat va saqlash serverdagi /api/fn/bq orqali (poyga va tekshiruv uchun), o'z yozuvimizni kuzatish esa to'g'ridan-to'g'ri bazadan.
import { useSyncExternalStore } from 'react';
import { getJson } from './realtime';
import { todayKey } from './time';
import { getTelegramWebApp } from './telegram';
import { ACCOUNT_ID } from './account';
import { pointsFor, FD_COMBO_MAX, FD_SECONDS, FD_QUESTIONS } from './friendDuel';
import type { FdQuestion } from './friendDuel';

export const GB_WAIT_MS = 12000; // jonli raqib kutish vaqti
const GB_RETRY_MS = 3500; // navbatda turganda serverdan qayta so'rash oralig'i
const GB_POLL_MS = 2000; // o'z yozuvimizni tekshirish oralig'i (to'g'ridan-to'g'ri baza, funksiya chaqirilmaydi)

export interface GbOpp { id: string; name: string; avatar: string }
/** a — tanlangan variant (null — vaqt tugadi). Server ball va g'alabani SHU javoblardan qayta hisoblaydi */
export interface GbLogItem { c: 0 | 1; m: number; a?: string | null }
/** Bugungi holat (server): nechta mukofotli o'yin ishlatilgan */
export interface GbInfo { used: number; limit: number; xp: number; rewards: boolean }
/** O'yin mukofoti (server hisobi). why: '' | 'limit' | 'same' | 'off' | 'error' */
export interface GbSettle { xp: number; why: string; used: number; limit: number; counted: boolean; outcome?: 'win' | 'lose' | 'draw' }
export interface GbSubmitResult { ok: boolean; s: number; c: number; t: number; settled: boolean; late?: boolean; settle?: GbSettle; error?: string }
export interface GbGhost extends GbOpp { level: string; ts: number; q: FdQuestion[]; r: GbLogItem[]; s: number; c: number; t: number }
export type GbOutcome =
  | { kind: 'live'; code: string }
  | { kind: 'ghost'; ghost: GbGhost; info?: GbInfo }
  | { kind: 'none'; info?: GbInfo }
  | { kind: 'cancel' }
  | { kind: 'error' };

export interface GbMe { id: string; name: string; avatar: string; level: string }

/* ---------------------------- sozlamalar (shu qurilmada) ---------------------------- */

const RECENT_KEY = 'vb_gb_recent_v1';
const SHARE_KEY = 'vb_gb_share_v1';

export const getRecentOpps = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
};
/** Oxirgi 5 raqibni eslab qoladi — ular qayta chiqmaydi */
export const rememberOpp = (id: string) => {
  if (!id) return;
  try {
    const rest = getRecentOpps().filter(x => x !== id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...rest].slice(0, 5)));
  } catch {
    /* ignore */
  }
};

/** «Natijam keyingi o'yinchilarga raqib sifatida ko'rsatilsin» (standart: ha) */
export const getShareGhost = (): boolean => {
  try { return localStorage.getItem(SHARE_KEY) !== '0'; } catch { return true; }
};
export const setShareGhost = (on: boolean) => {
  try { localStorage.setItem(SHARE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
};

/* ------------------------------- server so'rovi ------------------------------- */

async function call(body: Record<string, unknown>, keepalive = false): Promise<any | null> {
  const initData = getTelegramWebApp()?.initData || '';
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), 12000);
  try {
    const r = await fetch('/api/fn/bq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(initData ? { 'x-telegram-init-data': initData } : {}), 'x-account-id': ACCOUNT_ID },
      body: JSON.stringify(body),
      keepalive,
      cache: 'no-store',
      signal: ctl?.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Xato javobini ham qaytaradi (status bilan) — natija yuborishda sabab ko'rsatish uchun */
async function callRaw(body: Record<string, unknown>): Promise<{ status: number; json: any } | null> {
  const initData = getTelegramWebApp()?.initData || '';
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), 15000);
  try {
    const r = await fetch('/api/fn/bq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(initData ? { 'x-telegram-init-data': initData } : {}), 'x-account-id': ACCOUNT_ID },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: ctl?.signal,
    });
    clearTimeout(timer);
    let json: any = null;
    try { json = await r.json(); } catch { /* ignore */ }
    return { status: r.status, json };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

const base = (me: GbMe) => ({ uid: me.id, level: me.level, name: me.name, avatar: me.avatar, recent: getRecentOpps() });
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

/**
 * Raqib qidiradi. `signal.cancelled` true bo'lsa — navbatdan chiqadi.
 * Jonli raqib → xona kodi; bo'lmasa → saqlangan natija; u ham bo'lmasa → 'none'.
 */
export async function findOpponent(me: GbMe, signal: { cancelled: boolean }, onTick?: (leftMs: number) => void, onInfo?: (i: GbInfo) => void): Promise<GbOutcome> {
  const t0 = Date.now();
  const first = await call({ op: 'join', first: true, ...base(me) });
  if (!first) return { kind: 'error' };
  if (first.matched && first.code) return { kind: 'live', code: first.code };
  let info: GbInfo | undefined = first.info && typeof first.info === 'object' ? first.info : undefined;
  if (info) onInfo?.(info);

  let lastJoin = Date.now();
  while (Date.now() - t0 < GB_WAIT_MS) {
    if (signal.cancelled) {
      const r = await call({ op: 'leave', ...base(me) });
      return r?.matched && r.code ? { kind: 'live', code: r.code } : { kind: 'cancel' };
    }
    onTick?.(Math.max(0, GB_WAIT_MS - (Date.now() - t0)));
    await sleep(GB_POLL_MS);

    // Bizdan keyin kelgan odam bizni band qilgan bo'lsa — yozuvimizda xona kodi paydo bo'ladi
    try {
      const mine = await getJson(`bq/${me.level}/${me.id}`);
      if (mine && typeof mine.room === 'string' && mine.room !== 'lock') return { kind: 'live', code: mine.room };
    } catch {
      /* keyingi urinishda */
    }

    // Bizdan oldin kelgan kutayotgan bo'lsa (yoki yangi kelgan bo'lsa) — serverdan qayta so'raymiz
    if (Date.now() - lastJoin >= GB_RETRY_MS) {
      lastJoin = Date.now();
      const r = await call({ op: 'join', ...base(me) });
      if (r?.matched && r.code) return { kind: 'live', code: r.code };
    }
  }

  if (signal.cancelled) {
    const r = await call({ op: 'leave', ...base(me) });
    return r?.matched && r.code ? { kind: 'live', code: r.code } : { kind: 'cancel' };
  }
  const g = await call({ op: 'ghost', ...base(me) });
  if (!g) return { kind: 'error' };
  if (g.matched && g.code) return { kind: 'live', code: g.code };
  if (g.info && typeof g.info === 'object') info = g.info;
  if (g.ghost && Array.isArray(g.ghost.q) && g.ghost.q.length === FD_QUESTIONS) return { kind: 'ghost', ghost: g.ghost as GbGhost, info };
  return { kind: 'none', info };
}

export const leaveQueue = (me: GbMe) => { void call({ op: 'leave', ...base(me) }, true); };

export interface GbSaveResult { ok: boolean; saved: boolean; s: number; c: number; t: number; settle?: GbSettle; error?: string }

/**
 * Mashq yoki «ruh» raqib bilan o'yin tugadi. `vs` — raqib (ruh) ID si: berilsa, server javoblarni o'zi bergan savollarga qarab qayta hisoblaydi,
 * g'olibni aniqlaydi va mukofot beradi. `vs` yo'q bo'lsa (mashq) — natija faqat keyingi o'yinchilar uchun saqlanadi.
 */
export async function saveGhost(me: GbMe, q: FdQuestion[], log: GbLogItem[], vs?: string): Promise<GbSaveResult | null> {
  if (log.length !== FD_QUESTIONS || q.length !== FD_QUESTIONS) return null;
  const body: Record<string, unknown> = { op: 'saveghost', ...base(me), noGhost: !getShareGhost(), r: log.map(x => ({ a: x.a ?? null, c: x.c, m: Math.round(x.m) })) };
  if (vs) body.vs = vs;
  else body.q = q; // mashq: savollar serverda hech kimga berilmagan, shuning uchun mijoz yuboradi (mukofotsiz)
  const r = await callRaw(body);
  if (!r) return null;
  const j = r.json || {};
  if (!j.ok) return { ok: false, saved: false, s: 0, c: 0, t: 0, error: String(j.error || 'Xato') };
  return { ok: true, saved: !!j.saved, s: Number(j.s) || 0, c: Number(j.c) || 0, t: Number(j.t) || 0, settle: j.settle };
}

/**
 * JONLI duel natijasini serverga yuboradi (server ball va g'olibni o'zi hisoblaydi). Tarmoq xatosida qayta uriniladi.
 * Qaytaradi: natija yoki null (hech qachon yetib bormadi). Tasdiqlanmagan natija uchun ok=false va sabab (error).
 */
export async function submitLive(me: GbMe, code: string, n: number, log: GbLogItem[]): Promise<GbSubmitResult | null> {
  const body = { op: 'submit', ...base(me), code, n, noGhost: !getShareGhost(), r: log.map(x => ({ a: x.a ?? null, c: x.c, m: Math.round(x.m) })) };
  for (let i = 0; i < 3; i++) {
    const r = await callRaw(body);
    if (r) {
      const j = r.json || {};
      if (r.status === 200 && j.ok) return { ok: true, s: Number(j.s) || 0, c: Number(j.c) || 0, t: Number(j.t) || 0, settled: !!j.settled, late: !!j.late, settle: j.settle };
      if (r.status >= 400 && r.status < 500 && r.status !== 409 && r.status !== 429) return { ok: false, s: 0, c: 0, t: 0, settled: false, error: String(j.error || 'Natija qabul qilinmadi') };
    }
    await sleep(1200 * (i + 1));
  }
  return null;
}

/* --------------------------- haftalik reyting --------------------------- */

export interface GbWeekRow { id: string; name: string; avatar: string; w: number; p: number; s: number }
/** Dushanba (Toshkent kuni bo'yicha) — haftalik reyting kaliti (serverdagi weekKeyOf bilan bir xil) */
export function weekKey(): string {
  const [y, m, d] = todayKey().split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}
/** Joriy haftaning eng yaxshi o'yinchilari (g'alabalar, so'ng ball bo'yicha) */
export async function loadWeekly(limit = 10): Promise<GbWeekRow[] | null> {
  try {
    const v = await getJson(`bweek/${weekKey()}`);
    if (!v || typeof v !== 'object') return [];
    return Object.entries(v as Record<string, any>)
      .filter(([, r]) => r && typeof r === 'object')
      .map(([id, r]) => ({ id, name: String(r.n || 'O‘yinchi').slice(0, 40), avatar: typeof r.a === 'string' ? r.a : '', w: Number(r.w) || 0, p: Number(r.p) || 0, s: Number(r.s) || 0 }))
      .sort((a, b) => b.w - a.w || b.s - a.s || a.p - b.p)
      .slice(0, limit);
  } catch {
    return null;
  }
}

/* ------------------------------- yordamchi hisoblar ------------------------------- */

/** Javoblar jurnalidan har bir savoldan keyingi jami ballni hisoblaydi (ekranda raqib balli shunday o'sadi) */
export function cumulativeScores(log: GbLogItem[]): number[] {
  const out: number[] = [];
  let s = 0, combo = 1;
  for (const x of log) {
    if (x.c === 1) {
      s += pointsFor(FD_SECONDS - x.m / 1000, combo);
      combo = Math.min(FD_COMBO_MAX, Math.round((combo + 0.3) * 10) / 10);
    } else combo = 1;
    out.push(s);
  }
  return out;
}

/* ------------------------------- oyna holati ------------------------------- */

interface GbUi { open: boolean }
let ui: GbUi = { open: false };
const listeners = new Set<() => void>();
const setUi = (u: GbUi) => { ui = u; listeners.forEach(l => l()); };
export const openGlobalBlitz = () => setUi({ open: true });
export const closeGlobalBlitz = () => setUi({ open: false });
export const useGlobalBlitzUi = (): GbUi => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => ui, () => ui);
