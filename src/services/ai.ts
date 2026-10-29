// AI funksiyasi (Netlify Function /ai -> Gemini Flash). Kalit faqat serverda.
import { getTelegramWebApp } from './telegram';
import { ACCOUNT_ID } from './account';

const AI_URL: string = ((import.meta as any).env?.VITE_AI_URL as string) || '/.netlify/functions/ai';
export const AI_DAILY_LIMIT = 10;

export type AIAction = 'vocabStory' | 'xray' | 'checkSentence';

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
    if (res.status === 404 && !data?.error) throw new Error('AI funksiyasi topilmadi. Saytni Netlify Functions bilan qayta deploy qiling.');
    throw new Error(data?.error || `AI xatosi (${res.status})`);
  }
  return data as T;
}
