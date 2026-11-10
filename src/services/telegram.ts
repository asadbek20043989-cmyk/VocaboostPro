// Telegram WebApp SDK Integration Helper

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  allows_write_to_pm?: boolean;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  requestWriteAccess?: (cb?: (allowed: boolean) => void) => void;
  isVersionAtLeast?: (v: string) => boolean;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  close: () => void;
  openTelegramLink: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function initTelegramApp(): void {
  const tg = getTelegramWebApp();
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.('#0B0F17');
      tg.setBackgroundColor?.('#0B0F17');
    } catch {
      // Ignore if running outside official client
    }
  }
}

export function getTelegramUserData(): { name: string; username?: string; avatar?: string; hasPhoto: boolean } {
  const tg = getTelegramWebApp();
  const user = tg?.initDataUnsafe?.user;
  if (user) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return {
      name: fullName || "O'quvchi",
      username: user.username,
      // Telegram profil rasmi. Ba'zi mijozlarda `photo_url` kelmaydi — u holda ilova serverdagi proksidan oladi.
      avatar: user.photo_url || undefined,
      hasPhoto: !!user.photo_url,
    };
  }
  return { name: "O'quvchi", hasPhoto: false };
}

/** Telegram ichida birinchi marta ochilganda botga yozish uchun ruxsat so'raydi (eslatma va sertifikat yuborish uchun). */
export function askBotWriteAccess(): void {
  const tg = getTelegramWebApp();
  const u = tg?.initDataUnsafe?.user;
  if (!tg || !u || u.allows_write_to_pm === true) return;
  try {
    if (tg.requestWriteAccess && (!tg.isVersionAtLeast || tg.isVersionAtLeast('6.9'))) tg.requestWriteAccess();
  } catch {
    /* ignore */
  }
}

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' = 'light'): void {
  const tg = getTelegramWebApp();
  if (tg?.HapticFeedback) {
    try {
      if (type === 'selection') {
        tg.HapticFeedback.selectionChanged();
      } else if (type === 'success' || type === 'warning' || type === 'error') {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        tg.HapticFeedback.impactOccurred(type);
      }
      return;
    } catch {
      // Fallback below
    }
  }

  // Web fallback using navigator.vibrate
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'selection') navigator.vibrate(10);
      else if (type === 'light') navigator.vibrate(15);
      else if (type === 'medium') navigator.vibrate(30);
      else if (type === 'heavy') navigator.vibrate(50);
      else if (type === 'success') navigator.vibrate([20, 40, 30]);
      else if (type === 'warning' || type === 'error') navigator.vibrate([40, 30, 40]);
    } catch {
      // safe ignore
    }
  }
}

let activeBackHandler: (() => void) | null = null;

export function configureBackButton(visible: boolean, onClick?: () => void): void {
  const tg = getTelegramWebApp();
  if (!tg?.BackButton) return;

  try {
    if (activeBackHandler) {
      tg.BackButton.offClick(activeBackHandler);
      activeBackHandler = null;
    }

    if (visible && onClick) {
      activeBackHandler = onClick;
      tg.BackButton.onClick(activeBackHandler);
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }
  } catch {
    // safe ignore
  }
}

// ---------- Referral helpers ----------
// Set VITE_TELEGRAM_APP_LINK in your env, e.g. https://t.me/YourBot/app
const APP_LINK: string = (import.meta as any).env?.VITE_TELEGRAM_APP_LINK || '';

export function getTelegramUserId(): number | null {
  return getTelegramWebApp()?.initDataUnsafe?.user?.id ?? null;
}

export function getStartParam(): string | null {
  return getTelegramWebApp()?.initDataUnsafe?.start_param ?? null;
}

export function getReferralLink(): string {
  const id = getTelegramUserId();
  const base = APP_LINK || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) return '';
  if (APP_LINK) return id ? `${APP_LINK}?startapp=ref_${id}` : APP_LINK;
  return base;
}

export const REFERRAL_TEXT =
  "🚀 VocaBoost — inglizcha so'zlarni tez va mustahkam yodlang! Menga qo'shiling, o'yinlar o'ynang va har kuni omadli barabanni aylantirib sovrin yutib oling 🎡";

/** Matn + havolani Telegramda istalgan do'st yoki chatga yuborish oynasini ochadi. */
export function shareReferral(text: string = REFERRAL_TEXT): boolean {
  const link = getReferralLink();
  if (!link) return false;
  const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  const tg = getTelegramWebApp();
  try {
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, '_blank');
    return true;
  } catch {
    return false;
  }
}


/** Istalgan havolani Telegramda ulashish oynasini ochadi (Telegram tashqarisida — brauzerning ulashish oynasi) */
export function shareUrl(link: string, text: string): boolean {
  const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  const tg = getTelegramWebApp();
  try {
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, '_blank');
    return true;
  } catch {
    return false;
  }
}

/** Boshqa foydalanuvchini bellashuvga taklif qilish havolasi */
export function getDuelLink(code: string): string {
  if (APP_LINK) return `${APP_LINK}${APP_LINK.includes('?') ? '&' : '?'}startapp=duel_${code}`;
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/?duel=${code}`;
}

/** Telegram Story funksiyasi mavjudligini tekshiradi (Bot API 7.8+ va mobil ilovalar) */
export function canShareToStory(): boolean {
  const tg = getTelegramWebApp();
  if (!tg) return false;
  if (typeof (tg as any).shareToStory !== 'function') return false;
  if (typeof tg.isVersionAtLeast === 'function') {
    return tg.isVersionAtLeast('7.8');
  }
  return true;
}

/** Telegram Stories'ga sertifikat yoki yutuqni ulashish */
export function shareToTelegramStory(
  mediaUrl: string,
  text?: string,
  widgetLink?: string,
  onUnsupported?: () => void
): boolean {
  const tg = getTelegramWebApp();
  const appLink = APP_LINK || (typeof window !== 'undefined' ? window.location.origin : '');
  const link = widgetLink || appLink;

  // mediaUrl must be http:// or https:// (Telegram rejects data: URIs)
  let validMediaUrl = (mediaUrl || '').trim();
  if (!/^https?:\/\//i.test(validMediaUrl)) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    validMediaUrl = `${origin}/og.png`;
  }

  if (canShareToStory()) {
    try {
      (tg as any).shareToStory(validMediaUrl, {
        text: (text || "VocaBoost bilan inglizcha so'z boyligimni oshiryapman! 🚀").slice(0, 200),
        widget_link: link ? { url: link, name: 'VocaBoost' } : undefined,
      });
      return true;
    } catch (e) {
      console.warn('Telegram shareToStory xatosi:', e);
    }
  }

  // Agar Telegram Stories qo'llab-quvvatlanmasa (masalan Telegram Desktop yoki eski versiya)
  if (onUnsupported) {
    onUnsupported();
  }
  return false;
}
