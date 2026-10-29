// Foydalanuvchi -> Admin xabari (Netlify funksiyasi /inbox). Xabar admin panelda ism, ID va vaqti bilan ko'rinadi.
import { getTelegramWebApp } from './telegram';

export type MsgKind = 'savol' | 'muammo' | 'taklif' | 'boshqa';

export async function sendAdminMessage(uid: string, name: string, kind: MsgKind, text: string): Promise<void> {
  const r = await fetch('/.netlify/functions/inbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, name, kind, text, initData: getTelegramWebApp()?.initData || '' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Xato ${r.status}`);
}
