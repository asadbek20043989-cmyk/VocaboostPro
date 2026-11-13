// «Global Blitz»: tasodifiy raqib bilan Blitz Duel.
// Jonli raqib topilsa — «Do'st bilan Blitz Duel» xonasi ochiladi (kod bir xil). Topilmasa — saqlangan natija («ruh» raqib).
// Navbat va saqlash serverdagi /api/fn/bq orqali (poyga va tekshiruv uchun), o'z yozuvimizni kuzatish esa to'g'ridan-to'g'ri bazadan.
import { useSyncExternalStore } from 'react';
import { getJson, dbReadMode } from './realtime';
import { todayKey } from './time';
import { getTelegramWebApp } from './telegram';
import { ACCOUNT_ID } from './account';
import { pointsFor, FD_COMBO_MAX, FD_SECONDS, FD_QUESTIONS } from './friendDuel';
import type { FdQuestion } from './friendDuel';

export const GB_WAIT_MS = 60000; // jonli raqib kutish vaqti («ochiq lobbi»: boshqalar ham kutayotganingizni ko'radi)
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
export async function findOpponent(me: GbMe, signal: { cancelled: boolean; skip?: boolean }, onTick?: (leftMs: number) => void, onInfo?: (i: GbInfo) => void, prefer?: string): Promise<GbOutcome> {
  const t0 = Date.now();
  // prefer — bildirishnoma/kartochkadan bosilgan kutuvchi: server uni birinchi tanlaydi (daraja ±1 ichida bo'lsa), bo'lmasa odatdagi tartib
  const pf = prefer ? { prefer } : {};
  const first = await call({ op: 'join', first: true, ...base(me), ...pf });
  if (!first) return { kind: 'error' };
  if (first.matched && first.code) return { kind: 'live', code: first.code };
  let info: GbInfo | undefined = first.info && typeof first.info === 'object' ? first.info : undefined;
  if (info) onInfo?.(info);

  let lastJoin = Date.now();
  // signal.skip — «Kutmasdan boshlash»: kutishni to'xtatib, darrov saqlangan natijaga o'tadi
  while (Date.now() - t0 < GB_WAIT_MS && !signal.skip) {
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
      const r = await call({ op: 'join', ...base(me), ...pf });
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

/* --------------------- «ochiq lobbi»: kutayotgan raqiblarni kuzatish --------------------- */

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const WATCH_DIRECT_MS = 5000; // to'g'ridan-to'g'ri Firebase o'qishi
const WATCH_PROXY_MS = 20000; // proksi (server funksiyasi) orqali o'qishda siyrak — har so'rov hisoblanadi
const WAITER_FRESH_MS = 25000; // serverdagi FRESH_MS bilan bir xil: shundan eski yozuv «tirik» emas
export const GB_TOAST_MS = 10000; // bildirishnoma shuncha turadi

export interface GbWaiter { id: string; level: string; ts: number; name: string; avatar: string }
export interface GbToast { id: string; key: string; n: number } // n — hozir kutayotganlar soni
interface GbWatchState { waiters: GbWaiter[]; toast: GbToast | null }

const levelsNear = (level: string): string[] => {
  const i = LEVELS.indexOf(level);
  return i < 0 ? [] : ([level, LEVELS[i - 1], LEVELS[i + 1]].filter(Boolean) as string[]);
};

// Soat farqi bo'lsa ham «tirik»ni aniqlash uchun: har bir yozuvning hb qiymati oxirgi marta qachon o'zgargani (shu qurilma soati bilan)
const hbSeen = new Map<string, { hb: number; at: number }>();

/**
 * `bq` navbatidan hozir kutayotgan raqiblarni o'qiydi. Faqat tirik va bo'sh yozuvlar, o'z darajam ±1 ichida (server ham shu oraliqda ulaydi).
 * Faqat o'zim chiqarib tashlanadi (oldin o'ynagan raqib bilan ham istalgan marta o'ynash mumkin). Tartib serverdagi bilan bir xil: avval o'z darajam, so'ng eng eskisi — [0] eng mos kutuvchi.
 */
export async function peekWaiters(me: { id: string; level: string }): Promise<GbWaiter[]> {
  const v = await getJson('bq');
  const now = Date.now();
  const near = new Set(levelsNear(me.level));
  const out: GbWaiter[] = [];
  const seen = new Set<string>();
  if (v && typeof v === 'object') {
    for (const [lvl, group] of Object.entries(v as Record<string, any>)) {
      if (!group || typeof group !== 'object') continue;
      for (const [id, e] of Object.entries(group as Record<string, any>)) {
        if (!e || typeof e !== 'object') continue;
        const hb = Number(e.hb) || Number(e.ts) || 0;
        const key = `${lvl}/${id}`;
        seen.add(key);
        const prev = hbSeen.get(key);
        if (!prev) hbSeen.set(key, { hb, at: 0 }); // birinchi ko'rish: o'zgarganini keyingi so'rovda bilamiz
        else if (prev.hb !== hb) hbSeen.set(key, { hb, at: now });
        if (!near.has(lvl) || id === me.id) continue; // oldin o'ynagan raqib ham ko'rinadi
        if (e.room) continue; // raqib topilgan yoki hozir band qilinayotgan
        const at = hbSeen.get(key)!.at;
        const alive = now - hb < WAITER_FRESH_MS || (at > 0 && now - at < WAITER_FRESH_MS);
        if (!alive) continue;
        out.push({ id, level: lvl, ts: Number(e.ts) || 0, name: String(e.name || ''), avatar: typeof e.avatar === 'string' ? e.avatar : '' });
      }
    }
  }
  for (const k of Array.from(hbSeen.keys())) if (!seen.has(k)) hbSeen.delete(k);
  out.sort((a, b) => (a.level === me.level ? 0 : 1) - (b.level === me.level ? 0 : 1) || a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

let wst: GbWatchState = { waiters: [], toast: null };
const wListeners = new Set<() => void>();
const setW = (n: GbWatchState) => { wst = n; wListeners.forEach(l => l()); };
const subW = (cb: () => void) => { wListeners.add(cb); return () => { wListeners.delete(cb); }; };
/** Hozir kutayotganlar (eng mos kutuvchi — [0]) */
export const useGbWaiters = (): GbWaiter[] => useSyncExternalStore(subW, () => wst.waiters, () => wst.waiters);
/** Bosiladigan bildirishnoma holati (null — ko'rinmaydi) */
export const useGbToast = (): GbToast | null => useSyncExternalStore(subW, () => wst.toast, () => wst.toast);

const notified = new Set<string>(); // bir kutuvchi (uid:ts) uchun bildirishnoma bir marta
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let watchTimer: ReturnType<typeof setTimeout> | null = null;
let watchGen = 0;
let watchPaused = false;
let watchGetMe: (() => { id: string; level: string }) | null = null;
let lastOk = 0;

const stopToastTimer = () => { if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; } };
export const dismissGbToast = () => { stopToastTimer(); if (wst.toast) setW({ ...wst, toast: null }); };

function applyWaiters(list: GbWaiter[]) {
  const same = list.length === wst.waiters.length && list.every((w, i) => w.id === wst.waiters[i].id && w.ts === wst.waiters[i].ts);
  let toast = wst.toast;
  if (toast && !list.some(w => w.id === toast!.id)) { toast = null; stopToastTimer(); } // kutuvchi ketdi — bildirishnoma yo'qoladi
  if (!toast && !watchPaused) {
    const fresh = list.find(w => !notified.has(`${w.id}:${w.ts}`));
    if (fresh) {
      if (notified.size > 200) notified.clear();
      const key = `${fresh.id}:${fresh.ts}`;
      notified.add(key);
      toast = { id: fresh.id, key, n: list.length };
      stopToastTimer();
      toastTimer = setTimeout(dismissGbToast, GB_TOAST_MS);
    }
  }
  if (toast && toast.n !== list.length) toast = { ...toast, n: list.length }; // son o'zgarsa — matn ham yangilanadi
  if (!same || toast !== wst.toast) setW({ waiters: same ? wst.waiters : list, toast });
}

function schedule(ms: number) {
  if (watchTimer) clearTimeout(watchTimer);
  watchTimer = setTimeout(tick, ms);
}

async function tick() {
  watchTimer = null;
  const getMe = watchGetMe;
  if (!getMe || watchPaused) return; // to'xtatilgan bo'lsa — qayta yoqilganda schedule(0) chaqiriladi
  const gen = watchGen;
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
    const me = getMe();
    if (me.id) {
      try {
        const list = await peekWaiters(me);
        if (gen !== watchGen || watchPaused) return;
        lastOk = Date.now();
        applyWaiters(list);
      } catch {
        if (gen !== watchGen || watchPaused) return;
        if (Date.now() - lastOk > 30000) applyWaiters([]); // uzoq vaqt o'qib bo'lmasa — eskirgan ro'yxatni ko'rsatmaymiz
      }
    }
  }
  if (gen === watchGen && !watchPaused) schedule(dbReadMode() === 'proxy' ? WATCH_PROXY_MS : WATCH_DIRECT_MS);
}

/** Kuzatuvchini ishga tushiradi (GlobalBlitzHost). Qaytgan funksiya — to'xtatish */
export function startWaiterWatch(getMe: () => { id: string; level: string }): () => void {
  watchGetMe = getMe;
  const gen = ++watchGen;
  const onVis = () => { if (gen === watchGen && !watchPaused && document.visibilityState === 'visible') schedule(0); };
  document.addEventListener('visibilitychange', onVis);
  schedule(1500);
  return () => {
    if (gen !== watchGen) return;
    watchGen++;
    watchGetMe = null;
    if (watchTimer) { clearTimeout(watchTimer); watchTimer = null; }
    document.removeEventListener('visibilitychange', onVis);
    stopToastTimer();
    hbSeen.clear();
    setW({ waiters: [], toast: null });
  };
}

/** Global Blitz oynasi yoki duel ochiq bo'lganda kuzatuv to'xtaydi (so'rov ham, bildirishnoma ham yo'q) */
export function setWaiterWatchPaused(paused: boolean) {
  if (watchPaused === paused) return;
  watchPaused = paused;
  if (paused) {
    if (watchTimer) { clearTimeout(watchTimer); watchTimer = null; }
    stopToastTimer();
    if (wst.toast || wst.waiters.length) setW({ waiters: [], toast: null });
  } else if (watchGetMe) schedule(0);
}

/* ------------------------------- oyna holati ------------------------------- */

/** prefer — bosilgan kutuvchining ID si (bildirishnoma/kartochka): qidiruv avval shu kutuvchiga ulanishga urinadi */
interface GbUi { open: boolean; prefer?: string }
let ui: GbUi = { open: false };
const listeners = new Set<() => void>();
const setUi = (u: GbUi) => { ui = u; listeners.forEach(l => l()); };
export const openGlobalBlitz = (prefer?: string) => setUi({ open: true, prefer: typeof prefer === 'string' && prefer ? prefer : undefined });
export const closeGlobalBlitz = () => setUi({ open: false });
export const useGlobalBlitzUi = (): GbUi => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => ui, () => ui);
