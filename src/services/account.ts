// Hisob (akkaunt) identifikatori va hisobga xos mahalliy xotira.
//
// Bitta telefonning Telegramida bir nechta akkaunt bo'lsa, mini-ilova ularning hammasi uchun BIR XIL localStorage'dan
// foydalanadi — shu sabab ma'lumotlar aralashib ketardi. Endi har bir kalit hisob ID siga bog'lanadi ("kalit@tg_123").
import { getTelegramUserId } from './telegram';

const GLOBAL_KEYS = new Set(['lx_uid_v1', 'lx_dev_v1', 'lx_words_cache_v1', 'lx_packs_cache_v1']);

const rawGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const rawSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};
const rawDel = (k: string) => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
};

function computeAccount(): string {
  const tg = getTelegramUserId();
  if (tg) return `tg_${tg}`;
  try {
    // Havola orqali ulash: ?link=web_xxxxxxxx — boshqa qurilmadagi hisobni shu qurilmaga ulaydi
    const lk = new URLSearchParams(window.location.search).get('link');
    if (lk && /^web_[A-Za-z0-9]{3,40}$/.test(lk)) {
      rawSet('lx_uid_v1', JSON.stringify(lk));
      window.history.replaceState(null, '', window.location.pathname);
    }
  } catch {
    /* ignore */
  }
  let id = '';
  try {
    id = JSON.parse(rawGet('lx_uid_v1') || '""');
  } catch {
    id = '';
  }
  if (!id) {
    id = 'web_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    rawSet('lx_uid_v1', JSON.stringify(id));
  }
  return id;
}

export const ACCOUNT_ID: string = computeAccount();
export const isWebAccount = ACCOUNT_ID.startsWith('web_');

const nsKey = (key: string) => (GLOBAL_KEYS.has(key) ? key : `${key}@${ACCOUNT_ID}`);

/** Eski (hisobga bog'lanmagan) ma'lumot faqat brauzer (web) hisobi uchun o'tkaziladi: Telegram hisoblari bulutdan tiklanadi */
const legacyAllowed = (key: string) => isWebAccount && !GLOBAL_KEYS.has(key);

export function lsGet(key: string): string | null {
  const v = rawGet(nsKey(key));
  if (v !== null) return v;
  if (legacyAllowed(key)) {
    const old = rawGet(key);
    if (old !== null) {
      rawSet(nsKey(key), old);
      rawDel(key);
      return old;
    }
  }
  return null;
}
export const lsSet = (key: string, value: string) => rawSet(nsKey(key), value);
export const lsDel = (key: string) => {
  rawDel(nsKey(key));
  rawDel(key);
};
