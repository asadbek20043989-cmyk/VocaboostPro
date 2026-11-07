// AI funksiyasi (Netlify Function /ai -> Gemini Flash). Kalit faqat serverda.
import { getTelegramWebApp } from './telegram';
import { ACCOUNT_ID } from './account';

const AI_URL: string = ((import.meta as any).env?.VITE_AI_URL as string) || '/api/fn/ai';
export const AI_DAILY_LIMIT = 10;

export type AIAction = 'vocabStory' | 'xray' | 'checkSentence' | 'enrichWords';

export interface VocabStoryResponse {
  title: string;
  titleUz?: string;
  text: string;
  translationUz?: string;
}

export async function callAI<T = any>(action: AIAction, payload: Record<string, unknown>): Promise<T> {
  const initData = getTelegramWebApp()?.initData || '';
  let res: Response;
  try {
    res = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'x-telegram-init-data': initData } : {}),
      },
      body: JSON.stringify({ action, initData, uid: ACCOUNT_ID, ...payload }),
    });
  } catch {
    throw new Error("Internet bilan aloqa yo'q. Ulanishni tekshirib, qayta urinib ko'ring.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404 && !data?.error) throw new Error('AI funksiyasi topilmadi. Saytni Vercel ga qayta deploy qiling.');
    throw new Error(data?.error || `AI xatosi (${res.status})`);
  }
  return data as T;
}

export interface EnrichedWord { en: string; uz: string; ipa: string; pos: string; ex: string; exUz: string; hook: string }

/** Faqat inglizcha so'z (va ixtiyoriy tarjima) beriladi — qolganini AI to'ldiradi. Xato bo'lsa bo'sh ro'yxat qaytadi. */
export async function aiEnrichWords(words: { en: string; uz?: string }[]): Promise<EnrichedWord[]> {
  const out: EnrichedWord[] = [];
  for (let i = 0; i < words.length; i += 10) {
    const chunk = words.slice(i, i + 10);
    try {
      const r = await callAI<{ items: EnrichedWord[] }>('enrichWords', { words: chunk });
      const items = Array.isArray(r?.items) ? r.items : [];
      chunk.forEach((_, k) => out.push(items[k] || ({} as EnrichedWord)));
    } catch {
      chunk.forEach(() => out.push({} as EnrichedWord));
    }
  }
  return out;
}
