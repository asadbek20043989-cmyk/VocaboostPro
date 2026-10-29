import React, { useMemo, useState } from 'react';
import { Search, X, Sparkles, PenLine, BookOpenText, BookOpen, FolderOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WordCard } from './Learn';
import { ClozeTest, VocabStory, WritingPractice } from './Learning';
import { CustomPacksView } from './CustomPacksView';
import { BankWord } from '../types';
import { triggerHaptic } from '../services/telegram';

type Filter = 'all' | 'new' | 'learning' | 'mastered' | 'due';
type SubTab = 'bank' | 'custom';
const PAGE = 100;

export const WordsTab: React.FC = () => {
  const { bank, srs, savedWords, masteredCount, dueWords, customPacks } = useApp();
  const [subTab, setSubTab] = useState<SubTab>('bank');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<BankWord | null>(null);
  const [tool, setTool] = useState<null | 'cloze' | 'story' | 'write'>(null);
  const [shown, setShown] = useState(PAGE);

  const dueSet = useMemo(() => new Set(dueWords.map(d => d.id)), [dueWords]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bank
      .filter(b => {
        const e = srs[b.id];
        if (filter === 'new') return !e;
        if (filter === 'mastered') return !!e && e.mastered;
        if (filter === 'learning') return !!e && !e.mastered;
        if (filter === 'due') return dueSet.has(b.id);
        return true;
      })
      .filter(b => !needle || b.en.toLowerCase().includes(needle) || b.uz.toLowerCase().includes(needle));
  }, [bank, srs, filter, q, dueSet]);

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className="text-xl font-extrabold text-white">So&apos;zlar</h2>
        <p className="text-xs text-slate-400 mt-0.5">Hammasi — eng muhim so&apos;zlar. «Yodlandi» — 3 xil kunda to&apos;g&apos;ri javob bergan so&apos;zlar</p>
      </div>

      {/* Asosiy lug'at va Shaxsiy to'plamlar switcheri */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-[#151C28] border border-slate-800 rounded-2xl">
        <button
          type="button"
          onClick={() => { triggerHaptic('selection'); setSubTab('bank'); }}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            subTab === 'bank' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Lug‘at banki
        </button>
        <button
          type="button"
          onClick={() => { triggerHaptic('selection'); setSubTab('custom'); }}
          className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            subTab === 'custom' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FolderOpen className="w-4 h-4" /> Shaxsiy to‘plamlarim
          {customPacks.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              subTab === 'custom' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
            }`}>
              {customPacks.length}
            </span>
          )}
        </button>
      </div>

      {subTab === 'custom' ? (
        <CustomPacksView />
      ) : (
        <>
          <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-4 flex items-end justify-between">
            <div><span className="text-3xl font-extrabold text-white tabular-nums">{masteredCount}</span><span className="text-sm text-slate-400"> / {bank.length} yodlandi</span></div>
            <div className="text-[11px] text-slate-400 text-right">{savedWords.length} o&apos;rganilgan<br />{dueWords.length} takrorlash kerak</div>
          </div>

          {savedWords.length >= 3 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'story' as const, label: "So'zlarim hikoyasi", Icon: BookOpenText },
                { id: 'cloze' as const, label: "Gapni to'ldir", Icon: Sparkles },
                { id: 'write' as const, label: 'Yozma mashq', Icon: PenLine },
              ].map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => { triggerHaptic('selection'); setTool(id); }} className="p-3 rounded-2xl bg-[#151C28] border border-slate-800 text-center active:scale-95 transition-all">
                  <Icon className="w-5 h-5 text-amber-400 mx-auto" />
                  <div className="text-[11px] font-semibold text-slate-200 mt-1.5 leading-tight">{label}</div>
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => { setQ(e.target.value); setShown(PAGE); }} placeholder="So'z qidirish..." className="w-full bg-[#151C28] border border-slate-800 rounded-2xl pl-10 pr-3 py-3 text-sm text-white focus:outline-none focus:border-amber-500" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([['all', 'Barchasi'], ['new', 'Yangi'], ['due', 'Takrorlash'], ['learning', "O'rganilmoqda"], ['mastered', 'Yodlangan']] as [Filter, string][]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => { setFilter(id); setShown(PAGE); }} className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${filter === id ? 'bg-amber-500 text-slate-950' : 'bg-[#151C28] border border-slate-800 text-slate-300'}`}>{label}</button>
            ))}
          </div>

          <div className="space-y-2">
            {list.length === 0 && <div className="text-center text-sm text-slate-500 py-10">So&apos;z topilmadi.</div>}
            {list.slice(0, shown).map(b => {
              const e = srs[b.id];
              const badge = !e ? { t: 'yangi', c: 'bg-sky-500/15 text-sky-300' } : e.mastered ? { t: 'yodlandi', c: 'bg-emerald-500/15 text-emerald-400' } : dueSet.has(b.id) ? { t: 'takrorlash', c: 'bg-amber-500/15 text-amber-300' } : { t: `${e.days.length}/3 kun`, c: 'bg-slate-800 text-slate-400' };
              return (
              <button key={b.id} type="button" onClick={() => setOpen(b)} className="w-full text-left p-3.5 rounded-2xl bg-[#151C28] border border-slate-800 flex items-center justify-between gap-3 active:scale-[0.99] transition-all">
                <div>
                  <div className="text-sm font-bold text-white">{b.en} <span className="text-[11px] font-normal text-slate-500">{b.ipa}</span></div>
                  <div className="text-xs text-emerald-400">{b.uz}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${badge.c}`}>{badge.t}</span>
              </button>
              );
            })}
            {list.length > shown && (
              <button type="button" onClick={() => setShown(n => n + PAGE)} className="w-full py-3 rounded-2xl bg-[#151C28] border border-slate-800 text-xs font-bold text-amber-400">
                Yana ko&apos;rsatish ({list.length - shown} ta qoldi)
              </button>
            )}
          </div>
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(null)}>
          <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-2"><button type="button" onClick={() => setOpen(null)} className="w-9 h-9 rounded-xl bg-[#151C28] border border-slate-800 flex items-center justify-center"><X className="w-4 h-4" /></button></div>
            <WordCard w={open} />
          </div>
        </div>
      )}

      {tool === 'cloze' && <ClozeTest words={savedWords} onClose={() => setTool(null)} />}
      {tool === 'story' && <VocabStory words={savedWords} onClose={() => setTool(null)} />}
      {tool === 'write' && <WritingPractice words={savedWords} onClose={() => setTool(null)} />}
    </div>
  );
};
