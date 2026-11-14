// Umumiy chat (bitta xona). O'qish — Firebase jonli oqimi (realtime.subscribe), yozish — faqat server funksiyasi /api/fn/chat.
import { getTelegramWebApp } from './telegram';

export const CHAT_PATH = 'chat/general';
export const CHAT_CFG_PATH = 'config/chat';

export interface ChatMsg {
  id: string;
  uid: string;
  name: string;
  lv?: string;
  text: string;
  ts: number;
  hidden?: boolean;
}

export interface ChatCfg {
  enabled: boolean;
  maxLen: number;
  rules: string;
  slowSec: number;
  minXp: number;
}

export const DEFAULT_CHAT_CFG: ChatCfg = {
  enabled: true,
  maxLen: 300,
  rules: 'Hurmat bilan muloqot qiling. Haqorat, reklama va havolalar taqiqlanadi.',
  slowSec: 3,
  minXp: 0,
};

/** config/chat dan kelgan xom qiymatni ishlatishga tayyor ko'rinishga keltiradi (server bilan bir xil standartlar) */
export function parseChatCfg(raw: any): ChatCfg {
  const r = raw && typeof raw === 'object' ? raw : {};
  const num = (v: any, d: number, lo: number, hi: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    enabled: r.enabled !== false,
    maxLen: num(r.maxLen, DEFAULT_CHAT_CFG.maxLen, 20, 1000),
    rules: typeof r.rules === 'string' ? r.rules : DEFAULT_CHAT_CFG.rules,
    slowSec: num(r.slowSec, DEFAULT_CHAT_CFG.slowSec, 0, 120),
    minXp: num(r.minXp, 0, 0, 1000000),
  };
}

/** Firebase tugunini (id -> xabar) vaqt bo'yicha tartiblangan ro'yxatga aylantiradi; yashirilgan va yaroqsiz yozuvlar tashlab yuboriladi */
export function toChatList(raw: any): ChatMsg[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: ChatMsg[] = [];
  for (const [id, v] of Object.entries<any>(raw)) {
    if (!v || typeof v !== 'object' || typeof v.text !== 'string' || !v.text || v.hidden) continue;
    out.push({ id, uid: String(v.uid || ''), name: String(v.name || "O'quvchi"), lv: v.lv ? String(v.lv) : undefined, text: v.text, ts: Number(v.ts) || 0 });
  }
  return out.sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
}

async function post(body: Record<string, unknown>): Promise<any> {
  const r = await fetch('/api/fn/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, initData: getTelegramWebApp()?.initData || '' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Xato ${r.status}`);
  return j;
}

/** Xabar yuboradi. Muvaffaqiyatli bo'lsa serverdagi yakuniy xabarni qaytaradi (ism va daraja serverdan keladi) */
export async function sendChat(uid: string, text: string): Promise<ChatMsg> {
  const j = await post({ action: 'send', uid, text });
  return j.msg as ChatMsg;
}

/** Xabarga shikoyat. Yetarli shikoyat yig'ilsa xabar hamma uchun yashiriladi */
export async function reportChat(uid: string, id: string): Promise<boolean> {
  const j = await post({ action: 'report', uid, id });
  return !!j.hidden;
}
