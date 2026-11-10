import React from 'react';
import { Globe } from 'lucide-react';
import { LANGS, useLang, t } from '../services/i18n';
import { triggerHaptic } from '../services/telegram';

/** Interfeys tili: O'zbekcha / Русский / English */
export const LangSwitch: React.FC<{ className?: string; compact?: boolean }> = ({ className = '', compact }) => {
  const [lang, setLang] = useLang();
  return (
    <div className={className}>
      {!compact && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
          <Globe className="w-3.5 h-3.5 text-sky-400" /> {t('Interfeys tili')}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t('Interfeys tili')}>
        {LANGS.map(l => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={lang === l.id}
            onClick={() => { triggerHaptic('selection'); setLang(l.id); }}
            className={`py-2 rounded-xl border text-[12px] font-bold transition-all active:scale-95 ${lang === l.id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-[#151C28] text-slate-300 border-slate-800'}`}
          >
            <span className="mr-1">{l.flag}</span>{l.label}
          </button>
        ))}
      </div>
    </div>
  );
};
