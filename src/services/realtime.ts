import { getTelegramWebApp } from './telegram';
import { ACCOUNT_ID } from './account';

// Firebase Realtime Database REST + Server-Sent Events (SDK shart emas).
// .env: VITE_FIREBASE_DB_URL=https://<project>-default-rtdb.firebaseio.com
//
// Ishonchlilik (telefon / mobil internet / Telegram WebView uchun):
//  - har bir so'rovda vaqt chegarasi bor — "qotib qolish" yo'q;
//  - to'g'ridan-to'g'ri Firebase ga ulanib bo'lmasa, so'rov avtomatik ravishda saytning o'z serveri
//    (/api/fn/db) orqali yuboriladi (ba'zi mobil tarmoqlar firebaseio.com ni sekinlatadi/to'sadi);
//  - SSE oqimi ochilmasa yoki jim qolsa, ma'lumot avtomatik so'rov (polling) orqali olinadi;
//  - ekran qaytganda / internet qaytganda yangi holat darhol olinadi.
const DB: string = ((import.meta as any).env?.VITE_FIREBASE_DB_URL || '').replace(/\/$/, '');
const PROXY = '/api/fn/db';
const MODE_KEY = 'vb_db_mode_v1';

export const realtimeEnabled = !!DB;

// Netlify kreditini tejash: proksi (Netlify funksiyasi) orqali o'qish kamdan-kam va sekin bo'lishi kerak.
// VITE_DB_PROXY_READS=0 bo'lsa — o'qish faqat to'g'ridan-to'g'ri Firebase'dan (Netlify'ga umuman tegmaydi).
const PROXY_READS: boolean = String((import.meta as any).env?.VITE_DB_PROXY_READS ?? '1') !== '0';
const PROXY_POLL_MS = 60000; // proksi rejimida so'rov oralig'i (avval 5 soniya edi)
const DIRECT_POLL_MS = 20000; // SSE ishlamasa, to'g'ridan-to'g'ri so'rov oralig'i (avval 6 soniya)

type Mode = 'direct' | 'proxy';
let mode: Mode = 'direct';
let modeSince = 0;
try {
  const m = JSON.parse(localStorage.getItem(MODE_KEY) || 'null');
  if (PROXY_READS && m && m.m === 'proxy' && Date.now() - Number(m.ts) < 6 * 3600 * 1000) {
    mode = 'proxy';
    modeSince = Number(m.ts) || Date.now();
  }
} catch {
  /* ignore */
}
const setMode = (m: Mode) => {
  if (mode === m) return;
  mode = m;
  modeSince = Date.now();
  try {
    if (m === 'proxy') localStorage.setItem(MODE_KEY, JSON.stringify({ m, ts: modeSince }));
    else localStorage.removeItem(MODE_KEY);
  } catch {
    /* ignore */
  }
};

const urlFor = (m: Mode, path: string) => (m === 'direct' ? `${DB}/${path}.json` : `${PROXY}?p=${encodeURIComponent(path)}`);

/**
 * Bitta so'rov. Yozish amallari (PUT, PATCH, DELETE) xavfsizlik va Telegram imzosi
 * tekshiruvi uchun doim server proksisi (PROXY) orqali yuboriladi.
 * O'qish amallari (GET) esa to'g'ridan-to'g'ri tezkor Firebase yoki zaxira proksi orqali olinadi.
 */
async function http(method: string, path: string, body?: string, keepalive = false): Promise<Response | null> {
  if (!DB) return null;
  const isWrite = method !== 'GET';
  const order: Mode[] = isWrite ? ['proxy'] : !PROXY_READS ? ['direct'] : mode === 'proxy' ? ['proxy', 'direct'] : ['direct', 'proxy'];

  const initData = getTelegramWebApp()?.initData || '';
  const headers: Record<string, string> = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(initData ? { 'x-telegram-init-data': initData } : {}),
    'x-account-id': ACCOUNT_ID,
  };

  for (const m of order) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctl?.abort(), m === 'direct' ? 5500 : 12000);
    try {
      const r = await fetch(urlFor(m, path), {
        method,
        headers,
        body,
        cache: 'no-store',
        keepalive: keepalive && (body?.length || 0) < 60000,
        signal: ctl?.signal,
      });
      clearTimeout(timer);
      if (m === 'proxy' && r.status === 404) continue;
      if (!isWrite) {
        if (m !== mode) setMode(m);
        else if (m === 'direct') modeSince = Date.now();
      }
      return r;
    } catch {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Yo'l bo'yicha jonli obuna.
 * onStatus(true) — ma'lumot kelmoqda; onStatus(false) — hozircha ulanib bo'lmayapti.
 */
export function subscribe(path: string, cb: (value: any) => void, onStatus?: (live: boolean) => void): () => void {
  if (!DB) {
    cb(null);
    return () => {};
  }
  let state: any = null;
  let es: EventSource | null = null;
  let closed = false;
  let live: boolean | null = null;
  const startedAt = Date.now();
  let lastData = 0; // istalgan manbadan oxirgi ma'lumot
  let sseOpenedAt = 0;
  let sseLast = 0; // SSE dan oxirgi hodisa
  let sseGotPut = false;
  let lastPoll = 0;
  let polling = false;

  const setLive = (v: boolean) => {
    if (live === v) return;
    live = v;
    onStatus?.(v);
  };
  const emit = () => cb(state == null ? null : JSON.parse(JSON.stringify(state)));

  const setAt = (p: string, data: any) => {
    const parts = p.split('/').filter(Boolean);
    if (parts.length === 0) {
      state = data;
      return;
    }
    if (state == null || typeof state !== 'object') state = {};
    let cur = state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (data === null) delete cur[last];
    else cur[last] = data;
  };

  const pollOnce = async () => {
    if (closed || polling) return;
    polling = true;
    lastPoll = Date.now();
    try {
      const r = await http('GET', path);
      if (closed) return;
      if (!r || !r.ok) {
        if (!lastData || Date.now() - lastData > 25000) setLive(false);
        return;
      }
      state = await r.json();
      lastData = Date.now();
      setLive(true);
      emit();
    } catch {
      if (!lastData || Date.now() - lastData > 25000) setLive(false);
    } finally {
      polling = false;
    }
  };

  const closeSse = () => {
    es?.close();
    es = null;
  };

  const openSse = () => {
    if (closed || mode === 'proxy') return;
    closeSse();
    sseGotPut = false;
    sseOpenedAt = Date.now();
    try {
      es = new EventSource(`${DB}/${path}.json`);
    } catch {
      es = null;
      return;
    }
    es.addEventListener('put', e => {
      try {
        const m = JSON.parse((e as MessageEvent).data);
        setAt(m.path, m.data);
        sseGotPut = true;
        sseLast = lastData = Date.now();
        setLive(true);
        emit();
      } catch {
        /* ignore */
      }
    });
    es.addEventListener('patch', e => {
      try {
        const m = JSON.parse((e as MessageEvent).data);
        const base = m.path === '/' ? '' : m.path;
        for (const k of Object.keys(m.data || {})) setAt(`${base}/${k}`, m.data[k]);
        sseLast = lastData = Date.now();
        emit();
      } catch {
        /* ignore */
      }
    });
    es.addEventListener('keep-alive', () => {
      sseLast = Date.now();
    });
    es.addEventListener('cancel', () => closeSse());
    es.addEventListener('auth_revoked', () => closeSse());
    // Brauzer o'zi qayta ulanishga urinadi; qotib qolsa — quyidagi nazoratchi (tick) hal qiladi
  };

  // Nazoratchi: SSE sog'lommi? Yo'q bo'lsa — polling; kerak bo'lsa SSE ni qayta ochadi.
  const tick = () => {
    if (closed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const now = Date.now();
    const sseHealthy = !!es && es.readyState === 1 && sseGotPut && now - sseLast < 45000;
    if (mode === 'proxy') {
      closeSse();
      if (now - lastPoll >= PROXY_POLL_MS) pollOnce();
      return;
    }
    if (sseHealthy) return;
    // SSE yo'q yoki jim: ma'lumotni so'rov orqali olamiz
    const grace = es && es.readyState !== 2 ? 4000 : 0; // ochilayotgan oqimga qisqa muhlat
    if (now - Math.max(sseOpenedAt, startedAt) >= grace && now - lastPoll >= DIRECT_POLL_MS) pollOnce();
    // Oqim yopilgan yoki 8 soniyada ham ma'lumot bermagan bo'lsa — qayta ochamiz
    if (!es || es.readyState === 2 || (!sseGotPut && now - sseOpenedAt > 8000) || (sseGotPut && now - sseLast > 45000)) {
      if (now - sseOpenedAt > 3000) openSse();
    }
  };

  // Ekran qaytganda (telefon fonda oqimni uzgan bo'lishi mumkin) yangi holatni darhol olamiz
  const wake = () => {
    if (closed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    pollOnce();
    const stale = Date.now() - sseLast > 25000;
    if (mode === 'direct' && (stale || !es || es.readyState === 2)) openSse();
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  window.addEventListener('focus', wake);

  // Birinchi ma'lumot tezroq kelishi uchun SSE bilan bir vaqtda bitta so'rov ham yuboriladi
  openSse();
  pollOnce();
  const timer = setInterval(tick, 2000);

  return () => {
    closed = true;
    closeSse();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('online', wake);
    window.removeEventListener('focus', wake);
  };
}

/** PATCH. `keepalive` — sahifa yopilayotganda ham so'rov oxirigacha yetib boradi. Muvaffaqiyat bo'lsa true */
export async function patch(path: string, data: any, keepalive = false): Promise<boolean> {
  const r = await http('PATCH', path, JSON.stringify(data), keepalive);
  return !!r && r.ok;
}

export async function put(path: string, data: any, keepalive = false): Promise<boolean> {
  const r = await http('PUT', path, JSON.stringify(data), keepalive);
  return !!r && r.ok;
}

export async function getJson(path: string): Promise<any> {
  if (!DB) return null;
  const r = await http('GET', path);
  if (!r || !r.ok) throw new Error('DB ' + (r ? r.status : 'aloqa yo\'q'));
  return r.json();
}

export async function removePath(path: string): Promise<boolean> {
  const r = await http('DELETE', path);
  return !!r && r.ok;
}
