import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, Square, Headphones } from 'lucide-react';
import { lofi } from '../services/shop';
import { useApp } from '../context/AppContext';
import { triggerHaptic } from '../services/telegram';

/** Lo-Fi holatini kuzatadi */
function useLofi() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN(x => x + 1);
    lofi.listeners.add(f);
    return () => { lofi.listeners.delete(f); };
  }, []);
  return lofi;
}

const Eq: React.FC<{ playing: boolean }> = ({ playing }) => (
  <span className="inline-flex items-end gap-[3px] h-5" aria-hidden>
    {[0, 1, 2, 3].map(i => (
      <span key={i} className="w-[3px] rounded-full bg-sky-400" style={{ height: playing ? undefined : 5, animation: playing ? `lf-eq ${0.7 + i * 0.17}s ease-in-out ${i * 0.1}s infinite alternate` : 'none' }} />
    ))}
  </span>
);

/** Bosh menyudagi Lo-Fi pleer: ijro / pauza, keyingisi, o'chirish */
export const LofiPlayer: React.FC = () => {
  const { shopConf } = useApp();
  const l = useLofi();
  const btn = 'w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-all border';
  return (
    <section className="rounded-2xl bg-[#151C28] border border-slate-800 p-3.5 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500/25 to-violet-500/25 border border-sky-500/30 flex items-center justify-center shrink-0 text-sky-400">
        {l.on ? <Eq playing={!l.paused} /> : <Headphones className="w-5 h-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-white leading-tight">Lo-Fi musiqa</div>
        <div className="text-[11px] text-slate-400 truncate">{l.on ? `${l.paused ? 'Pauza' : 'Ijro etilmoqda'} · ${l.title || 'Lo-Fi'}` : 'Dars paytida diqqatni jamlashga yordam beradi'}</div>
      </div>
      {l.on ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" data-nosfx aria-label={l.paused ? 'Davom ettirish' : 'Pauza'} onClick={() => { triggerHaptic('selection'); l.toggle(); }} className={`${btn} bg-sky-500 border-sky-500 text-white`}>
            {l.paused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4 fill-white" />}
          </button>
          <button type="button" data-nosfx aria-label="Keyingisi" onClick={() => { triggerHaptic('selection'); l.next(); }} className={`${btn} bg-[#0E1524] border-slate-700 text-slate-200`}>
            <SkipForward className="w-4 h-4" />
          </button>
          <button type="button" data-nosfx aria-label="O'chirish" onClick={() => { triggerHaptic('light'); l.stop(); }} className={`${btn} bg-[#0E1524] border-rose-500/40 text-rose-400`}>
            <Square className="w-4 h-4 fill-rose-400" />
          </button>
        </div>
      ) : (
        <button type="button" data-nosfx onClick={() => { triggerHaptic('medium'); l.start(shopConf.lofi); }} className="shrink-0 px-4 h-10 rounded-xl bg-sky-500 text-white text-xs font-extrabold active:scale-95 flex items-center gap-1.5">
          <Play className="w-4 h-4 fill-white" /> Yoqish
        </button>
      )}
    </section>
  );
};

/** Boshqa bo'limlarda musiqa yoqilgan bo'lsa pastda ko'rinadigan kichik boshqaruv */
export const LofiMini: React.FC = () => {
  const l = useLofi();
  if (!l.on) return null;
  const b = 'w-8 h-8 rounded-full flex items-center justify-center active:scale-90';
  return (
    <div className="fixed right-3 bottom-20 z-50 pl-3 pr-1.5 py-1.5 rounded-full bg-sky-600 text-white shadow-lg flex items-center gap-1 keep-dark">
      <span className="text-xs font-bold mr-1">🎧 Lo-Fi</span>
      <button type="button" data-nosfx aria-label={l.paused ? 'Davom ettirish' : 'Pauza'} onClick={() => l.toggle()} className={`${b} bg-white/20`}>{l.paused ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5 fill-white" />}</button>
      <button type="button" data-nosfx aria-label="Keyingisi" onClick={() => l.next()} className={`${b} bg-white/20`}><SkipForward className="w-3.5 h-3.5" /></button>
      <button type="button" data-nosfx aria-label="O'chirish" onClick={() => l.stop()} className={`${b} bg-white/20`}><Square className="w-3.5 h-3.5 fill-white" /></button>
    </div>
  );
};
