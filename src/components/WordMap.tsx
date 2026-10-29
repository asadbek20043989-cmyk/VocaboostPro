import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BankWord } from '../types';
import { WordCard } from './Learn';
import { triggerHaptic } from '../services/telegram';

/** So'zlar xaritasi: barcha so'zlar — yodlangan, o'rganilayotgan va hali o'rganilmagan — alohida oynada */
export const WordMap: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { bank, srs, masteredCount, savedWords } = useApp();
  const [open, setOpen] = useState<BankWord | null>(null);
  const cell = (b: BankWord) => {
    const e = srs[b.id];
    if (!e) return 'bg-slate-700/60';
    return e.mastered ? 'bg-emerald-500' : 'bg-amber-400';
  };
  const learning = savedWords.length - masteredCount;
  const fresh = Math.max(0, bank.length - savedWords.length);
  return (
    <div className="fixed inset-0 z-[70] bg-[#0B0F17] overflow-y-auto" role="dialog" aria-label="So'zlar xaritasi">
      <div className="max-w-md mx-auto p-4 pb-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-white">So&apos;zlar xaritasi</h2>
          <button type="button" onClick={onClose} aria-label="Yopish" className="w-10 h-10 rounded-xl bg-[#151C28] border border-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-4 space-y-3">
          <div className="flex items-end justify-between">
            <div><span className="text-3xl font-extrabold text-white tabular-nums">{masteredCount}</span><span className="text-sm text-slate-400"> / {bank.length} yodlandi</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 py-2"><div className="text-base font-extrabold text-emerald-400 tabular-nums">{masteredCount}</div>yodlangan</div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 py-2"><div className="text-base font-extrabold text-amber-400 tabular-nums">{learning}</div>o&apos;rganilmoqda</div>
            <div className="rounded-xl bg-slate-700/30 border border-slate-700 py-2"><div className="text-base font-extrabold text-slate-300 tabular-nums">{fresh}</div>yodlanmagan</div>
          </div>
          <div className="flex flex-wrap gap-[4px]">
            {bank.map(b => (
              <button key={b.id} type="button" aria-label={b.en} onClick={() => { triggerHaptic('selection'); setOpen(b); }} className={`w-[16px] h-[16px] rounded-[4px] ${cell(b)}`} />
            ))}
          </div>
          <div className="flex gap-3 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-slate-600" /> yodlanmagan</span>
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> o&apos;rganilmoqda</span>
            <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> yodlandi</span>
          </div>
          <p className="text-[11px] text-slate-500">Kvadratchani bossangiz, so&apos;z haqida ma&apos;lumot chiqadi.</p>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(null)}>
          <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-2"><button type="button" onClick={() => setOpen(null)} className="w-9 h-9 rounded-xl bg-[#151C28] border border-slate-800 flex items-center justify-center"><X className="w-4 h-4" /></button></div>
            <WordCard w={open} />
          </div>
        </div>
      )}
    </div>
  );
};
