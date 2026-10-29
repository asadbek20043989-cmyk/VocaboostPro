import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Landmark, ChevronDown, Crown as CrownIcon, Flame } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Avatar } from './Avatar';
import { loadHall, championCounts, HallWeek } from '../services/hall';
import { triggerHaptic } from '../services/telegram';

const medal = (p: number) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : String(p));
const rowCls = (p: number) => (p === 1 ? 'row-gold bg-amber-500/10' : p === 2 ? 'row-silver bg-sky-500/10' : p === 3 ? 'row-bronze bg-orange-500/10' : 'bg-[#151C28] border border-slate-800');

/** «Tarix zali»: har hafta yakunlangan TOP-20 natijalari. Faqat ko'rish uchun — raqamlar o'zgarmaydi */
export const HallOfHistory: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { accountId } = useApp();
  const [weeks, setWeeks] = useState<HallWeek[] | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<string>('');

  useEffect(() => {
    let dead = false;
    loadHall()
      .then(w => {
        if (dead) return;
        setWeeks(w);
        if (w[0]) setOpen(w[0].id);
      })
      .catch(() => !dead && setErr(true));
    return () => {
      dead = true;
    };
  }, []);

  const legends = useMemo(() => {
    if (!weeks) return [];
    const counts = championCounts(weeks);
    const info: Record<string, { name: string; avatar: string; xp: number }> = {};
    weeks.forEach(w => w.top.forEach(t => (info[t.uid] = info[t.uid] || { name: t.name, avatar: t.avatar, xp: 0 })));
    return Object.entries(counts)
      .map(([uid, c]) => ({ uid, ...c, ...info[uid] }))
      .sort((a, b) => b.gold - a.gold || b.top3 - a.top3)
      .slice(0, 5);
  }, [weeks]);

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => { triggerHaptic('light'); onBack(); }} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Ligaga qaytish
      </button>

      <div className="keep-dark p-4 rounded-3xl bg-gradient-to-br from-[#2A1F08] via-[#1B1708] to-[#0B0F17] border border-amber-500/40 shadow-xl text-center space-y-1">
        <Landmark className="w-8 h-8 text-amber-400 mx-auto" />
        <h3 className="text-lg font-extrabold text-amber-200">Tarix zali</h3>
        <p className="text-[11px] text-amber-100/80 leading-relaxed">Har hafta yakunida TOP-20 ning to‘plagan XP si shu yerda abadiy saqlanadi. Bu raqamlar o‘zgarmaydi — o‘z nomingizni tarixga yozing!</p>
      </div>

      {!weeks && !err && <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-6 text-center text-xs text-slate-400 animate-pulse">Tarix yuklanmoqda…</div>}
      {err && <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-300 text-center">Yuklab bo‘lmadi. Internetni tekshirib, qayta kiring.</div>}
      {weeks && weeks.length === 0 && (
        <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-6 text-center space-y-1">
          <div className="text-3xl">🏛</div>
          <div className="text-sm font-bold text-white">Tarix hali bo‘sh</div>
          <p className="text-xs text-slate-400">Birinchi hafta yakunlangach, TOP-20 shu yerda paydo bo‘ladi.</p>
        </div>
      )}

      {legends.length > 0 && (
        <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-3 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5"><CrownIcon className="w-3.5 h-3.5" /> Afsonaviy chempionlar</div>
          {legends.map((l, i) => (
            <div key={l.uid} className={`flex items-center gap-3 p-2 rounded-xl ${l.uid === accountId ? 'bg-amber-500/15 border border-amber-500/50' : 'bg-[#0E1524]'}`}>
              <span className="w-5 text-center text-sm">{medal(i + 1)}</span>
              <Avatar src={l.avatar} name={l.name} className="w-8 h-8" />
              <div className="flex-1 min-w-0 text-xs font-bold text-white truncate">{l.name}{l.uid === accountId ? ' (Siz)' : ''}</div>
              <div className="text-right text-[11px] text-slate-400"><b className="text-amber-400">🏆 {l.gold}</b> g‘alaba · TOP-3: {l.top3}</div>
            </div>
          ))}
        </div>
      )}

      {weeks?.map(w => {
        const isOpen = open === w.id;
        const champ = w.top[0];
        return (
          <section key={w.id} className="rounded-2xl bg-gradient-to-br from-[#1B2433] to-[#121822] border border-slate-800 overflow-hidden">
            <button type="button" onClick={() => { triggerHaptic('selection'); setOpen(isOpen ? '' : w.id); }} className="w-full p-3.5 flex items-center gap-3 text-left">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex flex-col items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-amber-300 leading-none">HAFTA</span>
                <span className="text-base font-black text-amber-300 leading-tight">{w.week}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-white truncate">{champ ? `👑 ${champ.name}` : 'Natijalar'}</div>
                <div className="text-[11px] text-slate-400">{w.date}{w.players ? ` · ${w.players} ishtirokchi` : ''}{champ ? ` · ${champ.xp.toLocaleString()} XP` : ''}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-1.5">
                {w.top.map(t => (
                  <div key={t.place} className={`flex items-center gap-3 p-2.5 rounded-xl ${rowCls(t.place)} ${t.uid === accountId ? 'ring-2 ring-amber-400' : ''}`}>
                    <span className="w-6 text-center text-sm font-bold text-slate-300 tabular-nums">{medal(t.place)}</span>
                    <Avatar src={t.avatar} name={t.name} className="w-8 h-8" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{t.name}{t.uid === accountId ? ' (Siz)' : ''}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">{t.level}{t.streak > 0 && <><span>·</span><Flame className="w-3 h-3 text-orange-400" />{t.streak}</>}</div>
                    </div>
                    <span className="text-xs font-extrabold text-amber-400 tabular-nums">{t.xp.toLocaleString()} XP</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
