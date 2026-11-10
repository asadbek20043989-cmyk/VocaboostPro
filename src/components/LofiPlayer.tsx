import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Square, Headphones, Shuffle, ListMusic } from 'lucide-react';
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

/** Bosh menyudagi Lo-Fi pleer: ijro / pauza, oldingi / keyingi, aralash, treklar ro'yxati */
export const LofiPlayer: React.FC = () => {
  const { shopConf } = useApp();
  const l = useLofi();
  const [open, setOpen] = useState(false);
  const tracks = shopConf.lofi;
  const sig = tracks.map(t => t.url).join('|');
  // Admin ro'yxatni o'zgartirsa — ijro uzilmaydi, yangi ro'yxat qo'llanadi
  useEffect(() => { if (l.on) lofi.sync(tracks); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sig]);
  const btn = 'w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-all border';
  const hasList = tracks.length > 0;
  return (
    <section className="rounded-2xl bg-[#151C28] border border-slate-800 p-3.5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500/25 to-violet-500/25 border border-sky-500/30 flex items-center justify-center shrink-0 text-sky-400">
          {l.on ? <Eq playing={!l.paused} /> : <Headphones className="w-5 h-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white leading-tight">Lo-Fi musiqa{hasList && <span className="ml-1.5 text-[10px] font-semibold text-slate-500">{l.on && l.count ? `${l.index + 1}/${l.count}` : `${tracks.length} ta trek`}</span>}</div>
          <div className="text-[11px] text-slate-400 truncate">{l.on ? `${l.paused ? 'Pauza' : 'Ijro etilmoqda'} · ${l.title || 'Lo-Fi'}` : l.error || 'Dars paytida diqqatni jamlashga yordam beradi'}</div>
        </div>
        {!l.on && (
          <button type="button" data-nosfx onClick={() => { triggerHaptic('medium'); lofi.error = ''; l.start(tracks, { shuffle: !!shopConf.lofiShuffle }); }} className="shrink-0 px-4 h-10 rounded-xl bg-sky-500 text-white text-xs font-extrabold active:scale-95 flex items-center gap-1.5">
            <Play className="w-4 h-4 fill-white" /> Yoqish
          </button>
        )}
      </div>
      {l.on && (
        <div className="flex items-center justify-between gap-1.5">
          <button type="button" data-nosfx aria-label="Aralash" onClick={() => { triggerHaptic('selection'); l.setShuffle(!l.shuffle); }} disabled={!l.count} className={`${btn} ${l.shuffle ? 'bg-violet-500/25 border-violet-400 text-violet-200' : 'bg-[#0E1524] border-slate-700 text-slate-400'} disabled:opacity-30`}><Shuffle className="w-4 h-4" /></button>
          <button type="button" data-nosfx aria-label="Oldingisi" onClick={() => { triggerHaptic('selection'); l.prev(); }} disabled={!l.count} className={`${btn} bg-[#0E1524] border-slate-700 text-slate-200 disabled:opacity-30`}><SkipBack className="w-4 h-4" /></button>
          <button type="button" data-nosfx aria-label={l.paused ? 'Davom ettirish' : 'Pauza'} onClick={() => { triggerHaptic('selection'); l.toggle(); }} className={`${btn} !w-14 bg-sky-500 border-sky-500 text-white`}>
            {l.paused ? <Play className="w-5 h-5 fill-white" /> : <Pause className="w-5 h-5 fill-white" />}
          </button>
          <button type="button" data-nosfx aria-label="Keyingisi" onClick={() => { triggerHaptic('selection'); l.next(); }} className={`${btn} bg-[#0E1524] border-slate-700 text-slate-200`}><SkipForward className="w-4 h-4" /></button>
          <button type="button" data-nosfx aria-label="Ro'yxat" onClick={() => setOpen(o => !o)} disabled={!l.count} className={`${btn} ${open ? 'bg-sky-500/20 border-sky-400 text-sky-200' : 'bg-[#0E1524] border-slate-700 text-slate-300'} disabled:opacity-30`}><ListMusic className="w-4 h-4" /></button>
          <button type="button" data-nosfx aria-label="O'chirish" onClick={() => { triggerHaptic('light'); l.stop(); setOpen(false); }} className={`${btn} bg-[#0E1524] border-rose-500/40 text-rose-400`}><Square className="w-4 h-4 fill-rose-400" /></button>
        </div>
      )}
      {l.on && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="shrink-0">😴 Uyqu taymeri:</span>
          {[0, 15, 30, 60].map(m => {
            const active = m === 0 ? !l.sleepAt : !!l.sleepAt && Math.abs(l.sleepAt - Date.now() - m * 60000) < 90000;
            return <button key={m} type="button" data-nosfx onClick={() => { triggerHaptic('selection'); l.setSleep(m); }} className={`px-2.5 py-1 rounded-lg border font-bold ${active ? 'bg-sky-500/20 border-sky-400 text-sky-200' : 'bg-[#0E1524] border-slate-700'}`}>{m === 0 ? "Yo'q" : `${m} daq`}</button>;
          })}
          {l.sleepAt > 0 && <span className="ml-auto text-slate-500">{new Date(l.sleepAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} da o‘chadi</span>}
        </div>
      )}
      {l.on && open && l.count > 0 && (
        <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/80">
          {tracks.map((t, i) => (
            <button key={t.url + i} type="button" data-nosfx onClick={() => { triggerHaptic('selection'); l.playAt(i); }} className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs active:bg-slate-800 ${i === l.index ? 'bg-sky-500/10 text-sky-200' : 'text-slate-300'}`}>
              <span className="w-5 text-center tabular-nums text-slate-500">{i === l.index ? '▶' : i + 1}</span>
              <span className="truncate flex-1">{t.title}</span>
            </button>
          ))}
        </div>
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
    <div className="fixed right-3 bottom-28 z-50 pl-3 pr-1.5 py-1.5 rounded-full bg-sky-600 text-white shadow-lg flex items-center gap-1 keep-dark">
      <span className="text-xs font-bold mr-1">🎧 Lo-Fi</span>
      {l.count > 1 && <button type="button" data-nosfx aria-label="Oldingisi" onClick={() => l.prev()} className={`${b} bg-white/20`}><SkipBack className="w-3.5 h-3.5" /></button>}
      <button type="button" data-nosfx aria-label={l.paused ? 'Davom ettirish' : 'Pauza'} onClick={() => l.toggle()} className={`${b} bg-white/20`}>{l.paused ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5 fill-white" />}</button>
      <button type="button" data-nosfx aria-label="Keyingisi" onClick={() => l.next()} className={`${b} bg-white/20`}><SkipForward className="w-3.5 h-3.5" /></button>
      <button type="button" data-nosfx aria-label="O'chirish" onClick={() => l.stop()} className={`${b} bg-white/20`}><Square className="w-3.5 h-3.5 fill-white" /></button>
    </div>
  );
};
