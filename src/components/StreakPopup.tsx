import React from 'react';
import { Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic, shareToTelegramStory } from '../services/telegram';

/** Streak oynasi: bugungi streak yig'ilganda yoki muzlatish ishlatilishi kerak bo'lganda ko'rsatiladi */
export const StreakPopup: React.FC = () => {
  const { streakPopup, dismissStreakPopup } = useApp();
  if (!streakPopup) return null;
  const frozen = streakPopup.kind === 'frozen';
  const saved = streakPopup.kind === 'gain' && streakPopup.saved;
  const n = streakPopup.streak;

  const close = () => {
    triggerHaptic('light');
    dismissStreakPopup();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={close}>
      <div
        onClick={e => e.stopPropagation()}
        className={`sp-pop w-full max-w-xs rounded-3xl border p-6 text-center shadow-2xl ${
          frozen ? 'bg-gradient-to-b from-[#0E2236] to-[#0B1220] border-cyan-400/40' : 'bg-gradient-to-b from-[#2A1A0A] to-[#0B1220] border-amber-400/40'
        }`}
      >
        <div className={`sp-flame text-6xl leading-none ${frozen ? '' : 'drop-shadow-[0_0_18px_rgba(251,146,60,0.7)]'}`}>{frozen ? '❄️' : '🔥'}</div>

        {frozen ? (
          <>
            <h3 className="mt-4 text-xl font-extrabold text-cyan-200">Streaklaringiz muzladi!</h3>
            <div className="mt-2 inline-flex items-baseline gap-1.5 text-white">
              <span className="text-4xl font-extrabold tabular-nums text-cyan-300">{n}</span>
              <span className="text-sm font-semibold text-slate-300">kunlik streak</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Sizning to‘plagan streaklaringiz muzladi. Saqlash uchun kunlik mashqlarni bajarishda davom eting.
            </p>
          </>
        ) : (
          <>
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-6xl font-extrabold tabular-nums text-amber-300">{n}</span>
              <span className="text-lg font-bold text-white">streak</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {saved
                ? 'Muzlatish streakingizni saqlab qoldi ❄️ Har kuni mashq qilishda davom eting!'
                : n <= 1
                ? 'Bugungi mashq bajarildi — streak boshlandi! Ertaga ham qaytib keling.'
                : `${n} kun ketma-ket mashq qilyapsiz. Uzilib qolmasligi uchun ertaga ham qaytib keling!`}
            </p>
          </>
        )}

        {!frozen && n >= 2 && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              shareToTelegramStory(
                `${origin}/og.png`,
                `🔥 Men VocaBoost'da ketma-ket ${n} kunlik o'rganish streakiga erishdim! Siz ham qo'shiling 🚀`
              );
              close();
            }}
            className="mt-3 w-full h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" /> 📸 Story&apos;ga ulashish
          </button>
        )}

        <button
          type="button"
          onClick={close}
          className={`mt-2.5 w-full h-11 rounded-xl font-extrabold text-sm active:scale-[0.98] transition-all ${frozen ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'}`}
        >
          {frozen ? 'Mashqni boshlash' : 'Davom etish'}
        </button>
      </div>
    </div>
  );
};
