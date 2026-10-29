import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ArrowLeft, Volume2, Lightbulb, CheckCircle2, XCircle, ArrowRight, Sparkles, Mic, MicOff, Check, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BankWord } from '../types';
import { speakEnglish, isRecognitionAvailable, startListening, compareSpeech } from '../services/speech';
import { triggerHaptic } from '../services/telegram';
import { Question, makeQuestion, chooseKind, checkTyped } from '../services/srs';
import { sfx } from '../services/sound';
import { HeaderActions } from './Brand';

export const Shell: React.FC<{ title: string; sub?: string; progress?: number; onBack: () => void; children: React.ReactNode }> = ({ title, sub, progress, onBack, children }) => (
  <div className="min-h-screen bg-[#0B0F17] text-slate-100">
    <div className="max-w-md mx-auto px-4 pt-3 pb-10">
      <div className="flex items-center gap-3 mb-3">
        <button type="button" onClick={onBack} className="h-10 pl-2.5 pr-3.5 rounded-xl bg-[#151C28] border border-slate-800 flex items-center gap-1.5 text-sm font-semibold text-slate-200 active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4" /> Orqaga
        </button>
        <div className="flex-1 text-right min-w-0">
          <div className="text-sm font-bold text-white truncate">{title}</div>
          {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
        </div>
        <HeaderActions small />
      </div>
      {progress !== undefined && (
        <div className="h-1.5 rounded-full bg-slate-800 mb-4 overflow-hidden">
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {children}
    </div>
  </div>
);

export const WordCard: React.FC<{ w: BankWord }> = ({ w }) => {
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState<{ percent: number; text: string; ok: boolean } | null>(null);
  const stopListenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopListenRef.current?.();
    };
  }, []);

  const handleMic = () => {
    if (listening) {
      stopListenRef.current?.();
      setListening(false);
      return;
    }

    if (!isRecognitionAvailable()) {
      setFeedback({ percent: 0, text: "Ushbu brauzerda ovoz tanish funksiyasi yo'q", ok: false });
      return;
    }

    setFeedback(null);
    setListening(true);
    triggerHaptic('light');

    stopListenRef.current = startListening(
      (text, final) => {
        const cmp = compareSpeech(w.en, text);
        const ok = cmp.percent >= 70;
        setFeedback({ percent: cmp.percent, text: text || w.en, ok });
        if (final || cmp.percent >= 80) {
          stopListenRef.current?.();
          setListening(false);
          if (ok) {
            triggerHaptic('success');
            sfx.correct();
          } else {
            triggerHaptic('warning');
            sfx.wrong();
          }
        }
      },
      err => {
        setListening(false);
        if (err === 'not-allowed') {
          setFeedback({ percent: 0, text: "Mikrofon ruxsati berilmadi", ok: false });
        } else if (err === 'no-speech') {
          setFeedback({ percent: 0, text: "Ovoz eshitilmadi, qaytadan urinib ko'ring", ok: false });
        }
      },
      w.en
    );
  };

  return (
    <div className="rounded-3xl bg-gradient-to-b from-[#1B2433] to-[#121822] border border-slate-800 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{w.en}</div>
          <div className="text-xs text-slate-400 mt-1">{w.ipa} · {w.pos}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMic}
            aria-label="Talaffuzni tekshirish"
            className={`w-11 h-11 rounded-xl flex items-center justify-center active:scale-90 transition-all ${
              listening
                ? 'bg-rose-500/25 text-rose-400 ring-2 ring-rose-500 animate-pulse'
                : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
            }`}
            title="Mikrofonga aytib tekshiring"
          >
            {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => speakEnglish(w.en)}
            aria-label="Talaffuz"
            className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 flex items-center justify-center active:scale-90 transition-all"
            title="Tinglash"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {listening && (
        <div className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
          Gapiring: &quot;{w.en}&quot;...
        </div>
      )}

      {feedback && (
        <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
          feedback.ok
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
        }`}>
          <div>
            <div className="font-bold flex items-center gap-1">
              {feedback.ok ? '🎯 Ajoyib talaffuz!' : '⚠️ Qaytadan urinib ko‘ring'}
              {feedback.percent > 0 && <span>({feedback.percent}%)</span>}
            </div>
            {feedback.text && <div className="text-[11px] opacity-80 mt-0.5">&quot;{feedback.text}&quot;</div>}
          </div>
          <button type="button" onClick={handleMic} className="p-1 rounded-lg hover:bg-white/10">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="text-lg font-semibold text-emerald-400">{w.uz}</div>
      {w.ex && (
        <button type="button" onClick={() => speakEnglish(w.ex)} className="block w-full text-left rounded-2xl bg-[#0E1524] border border-slate-800 p-3 hover:border-slate-700 transition-all">
          <div className="text-sm text-slate-100">{w.ex}</div>
          <div className="text-xs text-slate-400 mt-1">{w.exUz}</div>
        </button>
      )}
      {w.col.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {w.col.map(c => (
            <span key={c} className="text-[11px] px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300">{c}</span>
          ))}
        </div>
      )}
      {w.hook && (
        <div className="flex gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3">
          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-100 leading-relaxed"><b>Eslab qolish kaliti:</b> {w.hook}</div>
        </div>
      )}
    </div>
  );
};

/** Bitta savol (tanlash yoki yozish). onDone — javob berilib, "Davom" bosilganda chaqiriladi */
export const QuestionView: React.FC<{ q: Question; onDone: (correct: boolean) => void; onAnswer?: (correct: boolean) => void }> = ({ q, onDone, onAnswer }) => {
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<null | { ok: boolean; close?: boolean }>(null);
  const spoken = useRef(false);
  if (q.speak && !spoken.current && q.kind === 'listen') {
    spoken.current = true;
    setTimeout(() => speakEnglish(q.speak!), 250);
  }

  const answer = (ok: boolean, close = false) => {
    if (result) return;
    triggerHaptic(ok ? 'success' : 'warning');
    if (ok) sfx.correct();
    else sfx.wrong();
    setResult({ ok, close });
    onAnswer?.(ok);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[#151C28] border border-slate-800 p-5 text-center space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-slate-500">
          {q.kind === 'mcq' ? "Tarjimasini toping" : q.kind === 'rev' ? 'Inglizchasini toping' : q.kind === 'listen' ? 'Eshitib toping' : q.kind === 'gap' ? "Bo'sh joyni to'ldiring" : 'Inglizchasini yozing'}
        </div>
        {q.kind === 'listen' ? (
          <button type="button" onClick={() => speakEnglish(q.speak!)} className="mx-auto w-20 h-20 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center active:scale-90 transition-all">
            <Volume2 className="w-9 h-9" />
          </button>
        ) : (
          <div className="text-2xl font-extrabold text-white leading-snug">{q.prompt}</div>
        )}
        {q.kind === 'mcq' && (
          <button type="button" onClick={() => speakEnglish(q.word.en)} className="text-amber-400 text-xs inline-flex items-center gap-1"><Volume2 className="w-4 h-4" /> eshitish</button>
        )}
        {q.hint && q.kind === 'type' && <div className="text-xs text-slate-500">{q.hint}</div>}
      </div>

      {q.options && (
        <div className="grid gap-2">
          {q.options.map(o => {
            const isAns = o === q.answer;
            const cls = !result
              ? 'bg-[#151C28] border-slate-800 hover:border-amber-500/50'
              : isAns
              ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200'
              : o === picked
              ? 'bg-rose-500/15 border-rose-500/60 text-rose-200'
              : 'bg-[#151C28] border-slate-800 opacity-50';
            return (
              <button
                key={o}
                type="button"
                disabled={!!result}
                onClick={() => {
                  setPicked(o);
                  answer(o === q.answer);
                }}
                className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm font-semibold transition-all active:scale-[0.98] ${cls}`}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === 'type' && (
        <div className="space-y-2">
          <input
            value={typed}
            disabled={!!result}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && typed.trim() && !result) {
                const r = checkTyped(typed, q.answer);
                answer(r.ok, r.close);
              }
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Yozing..."
            className="w-full bg-[#0E1524] border border-slate-700 rounded-2xl px-4 py-3.5 text-base text-white focus:outline-none focus:border-amber-500"
          />
          {!result && (
            <button type="button" disabled={!typed.trim()} onClick={() => { const r = checkTyped(typed, q.answer); answer(r.ok, r.close); }} className="w-full h-12 rounded-2xl bg-amber-500 disabled:opacity-40 text-slate-950 font-bold text-sm">
              Tekshirish
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className={`rounded-2xl p-3.5 flex items-start gap-2 border ${result.ok ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
            {result.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            <div className="text-sm">
              <div className={`font-bold ${result.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                {result.ok ? (result.close ? "To'g'ri (kichik xato bilan)" : "To'g'ri!") : "Noto'g'ri"}
              </div>
              <div className={`text-slate-300 mt-0.5 ${q.kind === 'listen' ? 'text-base' : 'text-xs'}`}>
                {q.kind === 'listen' ? <span className="font-extrabold text-white text-xl block leading-tight">{q.word.en} — {q.word.uz}</span> : <><b>{q.word.en}</b> — {q.word.uz}</>}
                {q.word.hook && !result.ok ? <div className="mt-1 text-amber-200">💡 {q.word.hook}</div> : null}
              </div>
            </div>
          </div>
          <button type="button" onClick={() => onDone(result.ok)} className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
            Davom etish <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

type Phase = 'learn' | 'quiz' | 'review' | 'done';

export const LearnSession: React.FC = () => {
  const { bank, newQueue, dueWords, introduceWord, reviewWord, claimDailyBonus, closeOverlay, srs, overlay, packs } = useApp();
  const packId = overlay?.type === 'learn' ? overlay.packId : undefined;
  const pack = packId ? packs.find(p => p.id === packId) : undefined;

  // Seans boshidagi ro'yxatlar (mashq davomida o'zgarmaydi)
  const plan = useMemo(() => {
    if (pack) {
      // Alohida lug'at to'plami: hali o'rganilmagan so'zlar (bir mashqda ko'pi bilan 20 ta)
      const unlearned = pack.words.filter(w => !srs[w.id]);
      if (unlearned.length > 0) {
        return { news: unlearned.slice(0, 20), dues: [] as BankWord[] };
      }
      // Agar barcha so'zlar o'rganilgan bo'lsa, to'plamdagi so'zlarni mustahkamlash (review) sifatida beramiz
      return { news: [] as BankWord[], dues: pack.words.slice(0, 20) };
    }
    const news = [...newQueue];
    const newIds = new Set(news.map(n => n.id));
    const dues = dueWords.filter(d => !newIds.has(d.id));
    return { news, dues };
  }, []);

  const batches = useMemo(() => {
    const out: BankWord[][] = [];
    for (let i = 0; i < plan.news.length; i += 5) out.push(plan.news.slice(i, i + 5));
    return out;
  }, [plan]);

  const [phase, setPhase] = useState<Phase>(batches.length ? 'learn' : plan.dues.length ? 'review' : 'done');
  const [bi, setBi] = useState(0); // joriy paket
  const [ci, setCi] = useState(0); // paketdagi karta
  const [qi, setQi] = useState(0); // savol raqami
  const [queue, setQueue] = useState<BankWord[]>(plan.dues);
  const [retried, setRetried] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ ok: 0, total: 0, xp: 0, newCount: 0 });
  const [bonus, setBonus] = useState(0);
  // Mini-testda xato qilingan so'zlar paket oxirida TO'G'RI topilguncha qayta so'raladi
  const [qFailed, setQFailed] = useState<BankWord[]>([]);
  const [qQueue, setQQueue] = useState<BankWord[]>([]);
  const [qRetry, setQRetry] = useState(false);
  const [qNonce, setQNonce] = useState(0);

  const batch = batches[bi] || [];
  const totalSteps = plan.news.length * 2 + plan.dues.length;
  const doneSteps = bi * 10 + (phase === 'learn' ? ci : phase === 'quiz' ? batch.length + qi : 0) + (phase === 'review' ? plan.news.length * 2 + (plan.dues.length - queue.length) : phase === 'done' ? totalSteps : 0);

  const finish = () => {
    setBonus(stats.total > 0 ? claimDailyBonus() : 0);
    if (stats.total > 0) setTimeout(() => sfx.win(stats.ok === stats.total), 150);
    setPhase('done');
  };

  const quizQ = useMemo(() => {
    if (phase !== 'quiz') return null;
    if (qRetry) return qQueue[0] ? makeQuestion(qQueue[0], bank, qNonce % 2 ? 'rev' : 'mcq') : null;
    return batch[qi] ? makeQuestion(batch[qi], bank, 'mcq') : null;
  }, [phase, bi, qi, qRetry, qNonce]);
  const reviewQ = useMemo(() => {
    if (phase !== 'review' || !queue[0]) return null;
    const e = srs[queue[0].id];
    return makeQuestion(queue[0], bank, chooseKind(e ? e.box : 0, queue[0]));
  }, [phase, queue[0]?.id, queue.length]);

  return (
    <Shell title={pack ? pack.title : "Bugungi mashq"} sub={phase === 'learn' ? "Yangi so'zlar" : phase === 'quiz' ? (qRetry ? 'Xatolarni takrorlash' : 'Mini-test') : phase === 'review' ? 'Takrorlash' : 'Natija'} progress={phase === 'done' ? 1 : totalSteps ? Math.min(1, doneSteps / totalSteps) : 0} onBack={closeOverlay}>
      {phase === 'learn' && batch[ci] && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 text-center">{ci + 1} / {batch.length} (paket {bi + 1}/{batches.length})</div>
          <WordCard w={batch[ci]} />
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              if (ci < batch.length - 1) setCi(ci + 1);
              else { setQi(0); setPhase('quiz'); }
            }}
            className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {ci < batch.length - 1 ? 'Keyingi so\'z' : 'Mini-testni boshlash'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {phase === 'quiz' && quizQ && (
        <QuestionView
          key={`q-${bi}-${qi}-${qRetry ? 'r' + qNonce : 'n'}`}
          q={quizQ}
          onDone={ok => {
            const advance = () => {
              setQRetry(false);
              setQFailed([]);
              setQQueue([]);
              if (bi < batches.length - 1) { setBi(bi + 1); setCi(0); setQi(0); setPhase('learn'); }
              else if (plan.dues.length) setPhase('review');
              else finish();
            };
            if (qRetry) {
              // Qayta so'rash: to'g'ri topilsa navbatdan chiqadi, xato bo'lsa — oxiriga qaytadi (XP/SRS ga ta'sir qilmaydi)
              const w = qQueue[0];
              const rest = qQueue.slice(1);
              if (ok) {
                if (rest.length) { setQQueue(rest); setQNonce(n => n + 1); } else advance();
              } else {
                setQQueue([...rest, w]);
                setQNonce(n => n + 1);
              }
              return;
            }
            const xp = introduceWord(quizQ.word, ok);
            setStats(s => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1, xp: s.xp + xp, newCount: s.newCount + 1 }));
            const failed = ok ? qFailed : [...qFailed, quizQ.word];
            if (qi < batch.length - 1) { setQFailed(failed); setQi(qi + 1); }
            else if (failed.length) { setQFailed(failed); setQQueue(failed); setQRetry(true); setQNonce(n => n + 1); }
            else advance();
          }}
        />
      )}

      {phase === 'review' && reviewQ && (
        <QuestionView
          key={`r-${queue[0].id}-${queue.length}`}
          q={reviewQ}
          onDone={ok => {
            const w = queue[0];
            const first = !retried.has(w.id);
            let xp = 0;
            if (first) {
              xp = reviewWord(w, ok);
              setStats(s => ({ ...s, ok: s.ok + (ok ? 1 : 0), total: s.total + 1, xp: s.xp + xp }));
            }
            const rest = queue.slice(1);
            if (!ok && first) {
              setRetried(new Set(retried).add(w.id));
              setQueue([...rest, w]); // xato so'z seans oxirida yana bir marta so'raladi (XP/SRS ta'sirisiz)
            } else {
              setQueue(rest);
              if (rest.length === 0) finish();
            }
          }}
        />
      )}

      {phase === 'done' && (
        <div className="text-center space-y-4 pt-4">
          <div className="text-6xl">{stats.total === 0 ? '🌤️' : stats.ok === stats.total ? '🏆' : '🎉'}</div>
          {stats.total === 0 ? (
            <>
              <h2 className="text-xl font-extrabold text-white">Bugun hammasi bajarildi!</h2>
              <p className="text-sm text-slate-400">Yangi so&apos;zlar kunlik limitga yetdi va takrorlashga so&apos;z yo&apos;q. O&apos;yinlar bo&apos;limida mashq qilishingiz mumkin.</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-extrabold text-white">Mashq yakunlandi!</h2>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-3"><div className="text-xl font-bold text-emerald-400">{stats.ok}/{stats.total}</div><div className="text-[11px] text-slate-400">to&apos;g&apos;ri</div></div>
                <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-3"><div className="text-xl font-bold text-sky-400">{stats.newCount}</div><div className="text-[11px] text-slate-400">yangi so&apos;z</div></div>
                <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-3"><div className="text-xl font-bold text-amber-400">+{stats.xp + bonus}</div><div className="text-[11px] text-slate-400">XP</div></div>
              </div>
              {bonus > 0 && (
                <div className="rounded-2xl bg-amber-500/15 border border-amber-500/40 p-3 text-sm font-semibold text-amber-300 inline-flex items-center gap-2"><Sparkles className="w-4 h-4" /> Kunlik bonus: +{bonus} XP</div>
              )}
              <p className="text-[11px] text-slate-500">Bir kunda bir xil so&apos;zni qayta takrorlash uchun XP berilmaydi.</p>
            </>
          )}
          <button type="button" onClick={closeOverlay} className="w-full h-12 rounded-2xl bg-amber-500 text-slate-950 font-bold text-sm">Tayyor</button>
        </div>
      )}
    </Shell>
  );
};
