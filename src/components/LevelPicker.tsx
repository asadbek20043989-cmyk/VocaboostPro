import React, { useState } from 'react';
import { X, Target, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic } from '../services/telegram';
import { LEVEL_NAMES, LEVEL_IELTS } from '../data/levels';
import { P_LEVELS } from '../data/placement';
import { LevelTest, PlacementOutcome } from './LevelTest';

/** Darajani o'zgartirish oynasi: 6 ta daraja kartasi + «Daraja aniqlash testi» tugmasi (istalgan vaqtda) */
export const LevelPicker: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { profile, updateProfile } = useApp();
  const [test, setTest] = useState(false);

  const apply = (o: PlacementOutcome) => {
    updateProfile({ level: o.level, placement: { level: o.level, score: o.score, max: o.max, ts: Date.now(), mode: o.mode } });
    onClose();
  };
  if (test) return <LevelTest currentLevel={profile.level} onApply={apply} onClose={() => setTest(false)} />;

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0F1520] border border-slate-700 rounded-t-3xl sm:rounded-3xl p-4 pb-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold text-white">Darajani o‘zgartirish</h2>
          <button type="button" onClick={onClose} aria-label="Yopish" className="w-9 h-9 rounded-xl bg-[#151C28] border border-slate-800 flex items-center justify-center"><X className="w-4 h-4 text-slate-300" /></button>
        </div>

        <button type="button" onClick={() => { triggerHaptic('medium'); setTest(true); }} className="w-full mb-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 flex items-center gap-3 text-left shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all">
          <span className="w-10 h-10 rounded-xl bg-black/15 flex items-center justify-center shrink-0"><Target className="w-5 h-5" /></span>
          <span className="flex-1">
            <span className="block text-sm font-black">Daraja aniqlash testi</span>
            <span className="block text-[11px] font-semibold opacity-80">20 savol · natijaga qarab mos daraja</span>
          </span>
        </button>

        <div className="text-[11px] font-bold text-slate-400 mb-2">Yoki o‘zingiz tanlang</div>
        <div className="grid grid-cols-2 gap-2">
          {P_LEVELS.map(l => {
            const on = profile.level === l;
            return (
              <button key={l} type="button" onClick={() => { triggerHaptic('success'); updateProfile({ level: l }); onClose(); }} className={`relative p-3 rounded-2xl border text-left active:scale-95 transition-all ${on ? 'border-amber-400 bg-amber-500/10' : 'border-slate-800 bg-[#151C28]'}`}>
                {on && <Check className="absolute top-2 right-2 w-4 h-4 text-amber-400" />}
                <div className="text-xl font-black text-white leading-none">{l}</div>
                <div className="text-[11px] text-slate-300 mt-1">{LEVEL_NAMES[l]}</div>
                <div className="text-[10px] text-slate-500">{LEVEL_IELTS[l]}</div>
              </button>
            );
          })}
        </div>
        {profile.placement && <p className="mt-3 text-[11px] text-slate-500 text-center">Oxirgi test: {profile.placement.score}/{profile.placement.max} ball → {profile.placement.level}</p>}
      </div>
    </div>
  );
};
