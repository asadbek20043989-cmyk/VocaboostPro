// Telegram bot bilan aloqa (Netlify funksiyasi /bot). Faqat Telegram ichida ishlaydi:
// server `initData` imzosini bot tokeni bilan tekshiradi, shuning uchun boshqa odam nomidan yuborib bo'lmaydi.
import { getTelegramWebApp } from './telegram';

const BOT_URL: string = ((import.meta as any).env?.VITE_BOT_URL as string) || '/.netlify/functions/bot';

export const canUseBot = () => !!getTelegramWebApp()?.initData;

async function call<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const initData = getTelegramWebApp()?.initData;
  if (!initData) throw new Error('Telegram ichida oching');
  const res = await fetch(BOT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, initData, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Bot xatosi (${res.status})`);
  return data as T;
}

/** Foydalanuvchini botga ro'yxatdan o'tkazadi (eslatmalar uchun) */
export const botRegister = (info: { remind: boolean; level: string; wordsPerDay: number }) =>
  call<{ ok: boolean; remind: boolean }>('register', info);

/** Bir marta bosish bilan eslatmalarni yoqish/o'chirish */
export const botSetRemind = (remind: boolean) => call<{ ok: boolean }>('setRemind', { remind });

/** Sertifikat rasmini foydalanuvchining Telegram chatiga yuboradi. kind: 'photo' (ko'rinish) yoki 'document' (fayl) */
export const botSendCertificate = (c: { id: string; title: string; date: string; image: string; kind?: 'photo' | 'document' }) =>
  call<{ ok: boolean }>('sendCertificate', c);

/** Do'stlik (referral) havolasi orqali kirganlikni tasdiqlash va sovg'alarni yozish */
export const botProcessReferral = (startParam: string) =>
  call<{ ok: boolean; rewardXp?: number; rewardCoins?: number }>('processReferral', { startParam });
