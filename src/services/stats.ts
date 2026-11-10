// Yengil statistika: ilova ochilishi (soat bo'yicha), o'yin boshlandi/tugadi, do'kon xaridi.
// Hodisalar xotirada yig'iladi va bitta so'rov bilan yuboriladi (server: admin → track). Xato bo'lsa — jim o'tkazib yuboriladi.
import { getTelegramWebApp } from './telegram';

type Ev = { ev: 'open' | 'gstart' | 'gdone' | 'buy'; key?: string; price?: number; n?: number };
let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let uid = '';

export function setStatsUser(id: string) { uid = id; }

async function flush() {
  timer = null;
  if (!uid || !queue.length) return;
  const events = queue.splice(0, 25);
  try {
    await fetch('/api/fn/admin', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track', uid, initData: getTelegramWebApp()?.initData || '', events }),
    });
  } catch { /* statistika muhim emas */ }
  if (queue.length) timer = setTimeout(flush, 1500);
}

export function track(ev: Ev['ev'], key?: string, price?: number) {
  try {
    if (ev === 'open') {
      // soatiga bir marta
      const h = new Date().toISOString().slice(0, 13);
      if (localStorage.getItem('vb_open_h') === h) return;
      localStorage.setItem('vb_open_h', h);
    }
    queue.push({ ev, key, price });
    if (!timer) timer = setTimeout(flush, 4000);
  } catch { /* ignore */ }
}

/** Ilova yopilayotganda qolgan hodisalarni yuborish */
export function flushStatsNow() { if (timer) clearTimeout(timer); void flush(); }
