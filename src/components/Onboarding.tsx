import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Sparkles, Check, Zap, Brain, Gamepad2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EnglishLevel } from '../types';
import { triggerHaptic } from '../services/telegram';
import { Logo, HeaderActions } from './Brand';

const LEVELS: { id: EnglishLevel; t: string; d: string }[] = [
  { id: 'A1', t: 'Noldan boshlayapman', d: "A1 · Boshlang'ich" },
  { id: 'A2', t: 'Ozgina tushunaman', d: 'A2 · Elementary' },
  { id: 'B1', t: "O'rtacha", d: 'B1 · Intermediate' },
  { id: 'B2+', t: 'Yaxshi bilaman', d: 'B2+ · Upper-Intermediate' },
];

const PER_DAY: { n: number; tag: string }[] = [
  { n: 5, tag: 'yengil' },
  { n: 10, tag: 'tavsiya' },
  { n: 15, tag: 'tezkor' },
  { n: 20, tag: 'intensiv' },
];

export const Onboarding: React.FC = () => {
  const { finishOnboarding } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [level, setLevel] = useState<EnglishLevel>('A2');
  const [perDay, setPerDay] = useState<number>(10);

  const pick = <T,>(fn: (v: T) => void, v: T) => {
    triggerHaptic('selection');
    fn(v);
  };
  const minutes = Math.round(6 + perDay * 0.7);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      <div className="max-w-md w-full mx-auto px-4 pt-4 flex-1 pb-28">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-400">Qadam {step} / 2</span>
          <HeaderActions />
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 mb-6 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-sky-400 to-amber-400 transition-all" style={{ width: `${step * 50}%` }} />
        </div>

        {step === 1 ? (
          <div className="space-y-5">
            <div className="text-center">
              <Logo className="w-28 h-28 mx-auto" glow />
              <div className="mt-3 text-sm font-extrabold tracking-[0.25em] text-amber-400 uppercase">VocaBoost</div>
              <h1 className="mt-2 text-[26px] font-extrabold text-white leading-tight">So&apos;zlarni tez va uzoq yodlang 🚀</h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Aqlli takrorlash, qiziqarli o&apos;yinlar va eslab qolish kalitlari bilan lug&apos;atingizni jadal boyiting — har kuni atigi bir necha daqiqada.
              </p>
              <div className="mt-3 flex justify-center gap-2 text-[11px] text-slate-300">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/25"><Brain className="w-3.5 h-3.5 text-sky-300" /> Aqlli takrorlash</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25"><Gamepad2 className="w-3.5 h-3.5 text-amber-300" /> O&apos;yinlar</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25"><Zap className="w-3.5 h-3.5 text-emerald-300" /> Tezkor</span>
              </div>
            </div>

            <h2 className="text-base font-extrabold text-white pt-1">Ingliz tili darajangiz qanday?</h2>
            <div className="grid gap-2.5">
              {LEVELS.map(l => (
                <button key={l.id} type="button" onClick={() => pick(setLevel, l.id)} className={`text-left p-4 rounded-2xl border flex items-center justify-between transition-all active:scale-[0.98] ${level === l.id ? 'bg-amber-500/10 border-amber-500' : 'bg-[#151C28] border-slate-800'}`}>
                  <div>
                    <div className="text-sm font-bold text-white">{l.t}</div>
                    <div className="text-[11px] text-slate-400">{l.d}</div>
                  </div>
                  {level === l.id && <Check className="w-5 h-5 text-amber-400" />}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center">
              <Logo className="w-16 h-16 mx-auto" />
              <h2 className="mt-3 text-[22px] font-extrabold text-white leading-tight">Kuniga nechta yangi so&apos;z yodlamoqchisiz?</h2>
              <p className="text-sm text-slate-400 mt-1.5">Istalgan payt Sozlamalardan o&apos;zgartirishingiz mumkin.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PER_DAY.map(o => (
                <button key={o.n} type="button" onClick={() => pick(setPerDay, o.n)} className={`p-5 rounded-2xl border text-center transition-all active:scale-95 ${perDay === o.n ? 'bg-amber-500/10 border-amber-500' : 'bg-[#151C28] border-slate-800'}`}>
                  <div className="text-3xl font-extrabold text-white">{o.n}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">ta so&apos;z · {o.tag}</div>
                </button>
              ))}
            </div>
            <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-4 text-center">
              <div className="text-sm text-slate-200">
                100 ta so&apos;zni taxminan <b className="text-amber-400">{Math.ceil(100 / perDay)} kunda</b> yodlaysiz
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Kuniga ~{minutes} daqiqa vaqt ketadi</div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#0B0F17]/95 backdrop-blur border-t border-slate-800 p-4 pb-safe">
        <div className="max-w-md mx-auto flex gap-2">
          {step === 2 && (
            <button type="button" onClick={() => setStep(1)} className="h-12 w-12 rounded-xl bg-[#151C28] border border-slate-800 flex items-center justify-center" aria-label="Orqaga">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {step === 1 ? (
            <button type="button" onClick={() => { triggerHaptic('light'); setStep(2); }} className="flex-1 h-12 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2">
              Davom etish <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={() => finishOnboarding(level, perDay)} className="flex-1 h-12 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" /> Boshlash
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
