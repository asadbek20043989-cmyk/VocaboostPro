import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { AdminPopupCfg } from '../types';
import { getLang, t } from '../services/i18n';
import { triggerHaptic } from '../services/telegram';

const KEY = (id: string) => `vb_popup_seen_${id}`;
let shownThisSession = false;

/** Shu foydalanuvchiga hozir pop-up ko'rsatish kerakmi (versiya, chastota, auditoriya bo'yicha) */
export function shouldShowPopup(p: AdminPopupCfg, isNewUser: boolean): boolean {
  if (shownThisSession) return false;
  if (p.who === 'old' && isNewUser) return false;
  if (p.freq === 'always') return true;
  try {
    const v = localStorage.getItem(KEY(p.id));
    if (!v) return true;
    if (p.freq === 'daily') return v !== new Date().toISOString().slice(0, 10);
    return false; // once
  } catch {
    return true;
  }
}
export function markPopupShown(p: AdminPopupCfg): void {
  shownThisSession = true;
  try { localStorage.setItem(KEY(p.id), new Date().toISOString().slice(0, 10)); } catch { /* ignore */ }
}

const pick = (p: AdminPopupCfg, f: 'title' | 'text' | 'btn'): string => {
  const l = getLang();
  const v = l === 'ru' ? p[`${f}_ru` as const] : l === 'en' ? p[`${f}_en` as const] : '';
  return (v && v.trim()) || p[f];
};

/** Ilovaga kirganda birinchi bo'lib chiqadigan admin pop-upi. Har ikki rejimda ham o'qiladigan to'q premium kartochka. */
export const AdminPopup: React.FC<{ data: AdminPopupCfg; onClose: () => void; onAction: () => void }> = ({ data, onClose, onAction }) => {
  useEffect(() => { triggerHaptic('light'); }, []);
  const title = pick(data, 'title');
  const text = pick(data, 'text');
  const hasAction = data.action !== 'none';
  const btn = pick(data, 'btn') || (hasAction ? t('Boshlash') : t('Tushunarli'));
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-5 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="keep-dark vb-admin-pop relative w-full max-w-[340px] rounded-[30px] p-6 pt-7 text-center border border-sky-300/30 shadow-2xl">
        <button type="button" data-nosfx onClick={onClose} aria-label={t('Yopish')} className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 border border-white/15 text-slate-200 flex items-center justify-center active:scale-90">
          <X className="w-4 h-4" />
        </button>
        {data.emoji && (
          <div className="mx-auto mb-3 w-16 h-16 rounded-2xl flex items-center justify-center text-[34px] bg-gradient-to-br from-sky-400/25 to-indigo-500/25 border border-sky-300/30 shadow-[0_0_28px_rgba(56,189,248,.35)]">{data.emoji}</div>
        )}
        {title && <h2 className="text-[20px] leading-tight font-black" style={{ color: '#FFFFFF' }}>{title}</h2>}
        {text && <p className="mt-2.5 text-[13.5px] leading-relaxed whitespace-pre-line" style={{ color: '#CBD5E1' }}>{text}</p>}
        <button
          type="button"
          onClick={() => { triggerHaptic('medium'); onAction(); }}
          className="mt-5 w-full py-3 rounded-2xl font-black text-[14px] active:scale-[.97] transition-transform"
          style={{ background: 'linear-gradient(135deg,#FCD34D,#F59E0B)', color: '#0B0F17', boxShadow: '0 10px 28px rgba(245,158,11,.35)' }}
        >
          {btn}
        </button>
        {hasAction && (
          <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-[12.5px] font-bold" style={{ color: '#94A3B8' }}>{t('Keyin')}</button>
        )}
      </div>
    </div>
  );
};
