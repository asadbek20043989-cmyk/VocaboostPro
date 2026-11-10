import React, { useMemo, useState } from 'react';
import { X, ArrowRight, RotateCcw, CheckCircle2, Target, HelpCircle, Trophy, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic } from '../services/telegram';
import type { EnglishLevel } from '../types';
import { LEVEL_NAMES, LEVEL_IELTS } from '../data/levels';
import { buildTest, scoreTest, P_LEVELS, TEST_SIZE, LEVEL_POINTS, PQuestion, TestOrder } from '../data/placement';

const LEVEL_TONE: Record<EnglishLevel, { bar: string; chip: string; glow: string }> = {
  A1: { bar: 'from-emerald-400 to-teal-500', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', glow: 'shadow-emerald-500/30' },
  A2: { bar: 'from-sky-400 to-blue-500', chip: 'bg-sky-500/15 text-sky-300 border-sky-500/40', glow: 'shadow-sky-500/30' },
  B1: { bar: 'from-indigo-400 to-purple-500', chip: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40', glow: 'shadow-indigo-500/30' },
  B2: { bar: 'from-amber-400 to-orange-500', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40', glow: 'shadow-amber-500/30' },
  C1: { bar: 'from-rose-400 to-pink-500', chip: 'bg-rose-500/15 text-rose-300 border-rose-500/40', glow: 'shadow-rose-500/30' },
  C2: { bar: 'from-cyan-300 via-fuchsia-400 to-amber-300', chip: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40', glow: 'shadow-fuchsia-500/30' },
};

export interface PlacementOutcome { level: EnglishLevel; score: number; max: number; mode: 'test' | 'manual' }

interface Props {
  /** Foydalanuvchi qaysi darajani tanlab davom etishni hal qilganda chaqiriladi (parent darajani saqlaydi va oynani yopadi) */
  onApply: (o: PlacementOutcome) => void;
  onClose: () => void;
  currentLevel?: EnglishLevel;
}

export const LevelTest: React.FC<Props> = ({ onApply, onClose, currentLevel }) => {
  const { allWords } = useApp();
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [order, setOrder] = useState<TestOrder>('easy');
  const [qs, setQs] = useState<PQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [pickOwn, setPickOwn] = useState(false);

  const result = useMemo(() => (phase === 'result' ? scoreTest(qs, answers) : null), [phase, qs, answers]);

  const start = () => {
    triggerHaptic('medium');
    setQs(buildTest(allWords, order));
    setAnswers([]);
    setIdx(0);
    setPicked(null);
    setPickOwn(false);
    setPhase('quiz');
  };

  const answer = (a: number) => {
    if (picked !== null) return;
    triggerHaptic('selection');
    setPicked(a);
    const next = [...answers, a];
    setTimeout(() => {
      setAnswers(next);
      setPicked(null);
      if (idx + 1 >= qs.length) setPhase('result');
      else setIdx(idx + 1);
    }, 260);
  };

  const close = () => {
    if (phase === 'quiz' && !window.confirm('Testni to‘xtatasizmi? Natija saqlanmaydi.')) return;
    onClose();
  };

  const q = qs[idx];

  return (
    <div className="fixed inset-0 z-[140] bg-[#0B0F17] text-slate-100 overflow-y-auto">
      <div className="max-w-md mx-auto min-h-full px-4 pt-3 pb-8 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5"><Target className="w-4 h-4" /> Daraja aniqlash testi</span>
          <button type="button" onClick={close} aria-label="Yopish" className="w-9 h-9 rounded-xl bg-[#151C28] border border-slate-800 flex items-center justify-center active:scale-90">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ---------- KIRISH ---------- */}
        {phase === 'intro' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="text-center pt-2">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-xl shadow-amber-500/30 text-4xl">🎯</div>
              <h1 className="mt-4 text-2xl font-extrabold text-white leading-tight">Darajangizni aniqlaymiz</h1>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{TEST_SIZE} ta savol. So‘zning tarjimasini toping — natijaga qarab eng mos daraja tavsiya qilinadi.</p>
            </div>

            <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-4 space-y-2.5 text-[13px] text-slate-300">
              <div className="flex gap-2.5"><Trophy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /><span>Qiyin so‘zlar <b className="text-white">ko‘proq ball</b> beradi: oson so‘z — 1 ball, eng qiyin — {LEVEL_POINTS.C2} ball.</span></div>
              <div className="flex gap-2.5"><HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" /><span>Bilmasangiz — <b className="text-white">«Bilmayman»</b> tugmasini bosing. Taxmin bilan xato qilish ballni kamaytiradi.</span></div>
              <div className="flex gap-2.5"><RotateCcw className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span>Testni <b className="text-white">istalgan vaqtda</b> qayta topshirishingiz mumkin — har safar savollar yangi.</span></div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-300 mb-2">Savollar tartibi</div>
              <div className="grid grid-cols-2 gap-2">
                {([['easy', 'Osondan qiyinga', '📈'], ['mixed', 'Aralash', '🔀']] as [TestOrder, string, string][]).map(([k, l, ic]) => (
                  <button key={k} type="button" onClick={() => { triggerHaptic('selection'); setOrder(k); }} className={`py-3 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${order === k ? 'bg-amber-500/15 border-amber-500 text-amber-300' : 'bg-[#151C28] border-slate-800 text-slate-300'}`}>
                    <span className="mr-1">{ic}</span>{l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto space-y-2.5 pt-2">
              <button type="button" onClick={start} className="w-full h-13 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all">
                Testni boshlash <ArrowRight className="w-5 h-5" />
              </button>
              <button type="button" onClick={onClose} className="w-full py-3 rounded-2xl bg-[#151C28] border border-slate-800 text-slate-300 text-sm font-semibold active:scale-[0.98]">
                {currentLevel ? `Hozirgi darajada qolish (${currentLevel})` : 'Orqaga'}
              </button>
            </div>
          </div>
        )}

        {/* ---------- SAVOLLAR ---------- */}
        {phase === 'quiz' && q && (
          <div className="flex-1 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span><b className="text-white tabular-nums">{idx + 1}</b> / {qs.length}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-extrabold">+{q.points} ball</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300" style={{ width: `${((idx + (picked !== null ? 1 : 0)) / qs.length) * 100}%` }} />
              </div>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-[#1B2333] to-[#151C28] border border-slate-700/70 px-5 py-8 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{q.dir === 'en-uz' ? 'Tarjimasini toping' : 'Inglizchasini toping'}</div>
              <div className="text-3xl font-black text-white break-words leading-tight">{q.prompt}</div>
            </div>

            <div className="grid gap-2.5">
              {q.options.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  data-nosfx
                  disabled={picked !== null}
                  onClick={() => answer(i)}
                  className={`text-left px-4 py-3.5 rounded-2xl border text-[15px] font-semibold transition-all active:scale-[0.98] ${picked === i ? 'bg-amber-500/20 border-amber-400 text-white' : 'bg-[#151C28] border-slate-800 text-slate-200 hover:border-slate-600'}`}
                >
                  <span className="inline-block w-6 text-slate-500 font-bold">{String.fromCharCode(65 + i)}</span>{o}
                </button>
              ))}
            </div>

            <button
              type="button"
              data-nosfx
              disabled={picked !== null}
              onClick={() => answer(-1)}
              className={`mt-1 py-3 rounded-2xl border border-dashed text-sm font-bold transition-all active:scale-[0.98] ${picked === -1 ? 'border-sky-400 text-sky-300 bg-sky-500/10' : 'border-slate-700 text-slate-400'}`}
            >
              🤷 Bilmayman
            </button>
          </div>
        )}

        {/* ---------- NATIJA ---------- */}
        {phase === 'result' && result && (
          <div className="flex-1 flex flex-col gap-4">
            <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1B2333] via-[#151C28] to-[#0E1524] p-5 text-center shadow-xl ${LEVEL_TONE[result.level].glow}`}>
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-amber-400/10 blur-2xl" />
              <div className="relative">
                <div className="text-xs font-bold text-slate-400 flex items-center justify-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-400" /> Test yakunlandi</div>
                <div className="mt-2 text-5xl font-black text-white tabular-nums leading-none">{Math.round(result.score)}<span className="text-xl text-slate-500 font-bold"> / {result.max}</span></div>
                <div className="text-sm text-slate-300 mt-1">ball to‘pladingiz</div>
                <div className={`mt-4 inline-flex flex-col items-center px-6 py-3 rounded-2xl border ${LEVEL_TONE[result.level].chip}`}>
                  <span className="text-3xl font-black leading-none">{result.level}</span>
                  <span className="text-xs font-bold mt-1">{LEVEL_NAMES[result.level]} · {LEVEL_IELTS[result.level]}</span>
                </div>
                <p className="mt-4 text-sm text-slate-200 leading-relaxed">
                  Siz <b className="text-white">{Math.round(result.score)} ball</b> to‘pladingiz — darajangiz <b className="text-amber-300">{result.level} · {LEVEL_NAMES[result.level]}</b> ekan.
                </p>
                <div className="mt-2 text-[11px] text-slate-500">{result.correct} ta to‘g‘ri · {result.wrong} ta xato · {result.skipped} ta «bilmayman»</div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-3.5 space-y-2">
              <div className="text-xs font-bold text-slate-300">Darajalar bo‘yicha natija</div>
              {P_LEVELS.map(l => {
                const s = result.per[l];
                const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
                return (
                  <div key={l} className="flex items-center gap-2.5 text-[11px]">
                    <span className="w-6 font-extrabold text-slate-300">{l}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full bg-gradient-to-r ${LEVEL_TONE[l].bar}`} style={{ width: `${pct}%` }} /></div>
                    <span className="w-14 text-right text-slate-400 tabular-nums">{s.correct}/{s.total} · {LEVEL_POINTS[l]}b</span>
                  </div>
                );
              })}
            </div>

            {!pickOwn ? (
              <div className="mt-auto space-y-2.5">
                <button type="button" onClick={() => { triggerHaptic('success'); onApply({ level: result.level, score: Math.round(result.score), max: result.max, mode: 'test' }); }} className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98]">
                  <CheckCircle2 className="w-5 h-5" /> {result.level} darajasi bilan davom etish
                </button>
                <button type="button" onClick={() => { triggerHaptic('selection'); setPickOwn(true); }} className="w-full py-3.5 rounded-2xl bg-[#151C28] border border-amber-500/40 text-amber-300 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
                  <Target className="w-4 h-4" /> O‘zim xohlagan darajadan boshlayman
                </button>
                <button type="button" onClick={start} className="w-full py-3.5 rounded-2xl bg-[#151C28] border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
                  <RotateCcw className="w-4 h-4" /> Testni qayta topshirish
                </button>
              </div>
            ) : (
              <div className="mt-auto space-y-2.5">
                <div className="text-sm font-extrabold text-white">Qaysi darajadan boshlaymiz?</div>
                <div className="grid grid-cols-2 gap-2">
                  {P_LEVELS.map(l => (
                    <button key={l} type="button" onClick={() => { triggerHaptic('success'); onApply({ level: l, score: Math.round(result.score), max: result.max, mode: 'manual' }); }} className={`p-3 rounded-2xl border text-left active:scale-95 transition-all ${l === result.level ? 'border-amber-400 bg-amber-500/10' : 'border-slate-800 bg-[#151C28]'}`}>
                      <div className="text-lg font-black text-white leading-none">{l}{l === result.level && <span className="ml-1.5 text-[10px] font-bold text-amber-300">test natijasi</span>}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{LEVEL_NAMES[l]}</div>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setPickOwn(false)} className="w-full py-2.5 text-xs font-semibold text-slate-400">← Orqaga</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
