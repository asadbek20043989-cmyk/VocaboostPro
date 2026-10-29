import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Crown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BankWord } from '../types';
import { GameDef } from '../data/games';
import { Shell, QuestionView } from './Learn';
import { makeQuestion, shuffle, checkTyped, QKind } from '../services/srs';
import { speakEnglish, startListening, isRecognitionAvailable, compareSpeech } from '../services/speech';
import { triggerHaptic } from '../services/telegram';
import { sfx } from '../services/sound';
import { LuckyWheel } from './LuckyWheel';
import { nowMs } from '../services/time';
import { Mic, MicOff, Volume2, RotateCcw, Sparkles } from 'lucide-react';

interface GP {
  def: GameDef;
  pool: BankWord[];
  bank: BankWord[];
  onFinish: (correct: number, total: number) => void;
}
const S = (def: GameDef, k: string, d: number) => Number(def.settings[k]) || d;
const take = (pool: BankWord[], n: number) => shuffle(pool).slice(0, Math.min(n, pool.length));

/* ---------- 1. Juftlik topish ---------- */
const MatchGame: React.FC<GP> = ({ def, pool, onFinish }) => {
  const words = useMemo(() => take(pool, S(def, 'pairs', 6)), []);
  const left = useMemo(() => shuffle(words), [words]);
  const right = useMemo(() => shuffle(words), [words]);
  const [a, setA] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [bad, setBad] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const pickRight = (id: string) => {
    if (!a) return;
    if (a === id) {
      triggerHaptic('success');
      sfx.correct();
      const nd = [...done, id];
      setDone(nd);
      setA(null);
      if (nd.length === words.length) setTimeout(() => onFinish(words.length, words.length + mistakes), 400);
    } else {
      triggerHaptic('warning');
      sfx.wrong();
      setMistakes(m => m + 1);
      setBad(id);
      setTimeout(() => setBad(null), 400);
      setA(null);
    }
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        {left.map(w => (
          <button key={w.id} disabled={done.includes(w.id)} onClick={() => { setA(w.id); speakEnglish(w.en); }} className={`w-full px-3 py-3 rounded-2xl border text-sm font-bold transition-all ${done.includes(w.id) ? 'opacity-25 border-emerald-700' : a === w.id ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-[#151C28] border-slate-800'}`}>{w.en}</button>
        ))}
      </div>
      <div className="space-y-2">
        {right.map(w => (
          <button key={w.id} disabled={done.includes(w.id)} onClick={() => pickRight(w.id)} className={`w-full px-3 py-3 rounded-2xl border text-xs font-semibold transition-all ${done.includes(w.id) ? 'opacity-25 border-emerald-700' : bad === w.id ? 'bg-rose-500/20 border-rose-500' : 'bg-[#151C28] border-slate-800'}`}>{w.uz}</button>
        ))}
      </div>
    </div>
  );
};

/* ---------- 2. Tezlik raundi ---------- */
const SpeedGame: React.FC<GP> = ({ def, pool, bank, onFinish }) => {
  const seconds = S(def, 'seconds', 60);
  const goal = S(def, 'goal', 8);
  const [left, setLeft] = useState(seconds);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [n, setN] = useState(0);
  const fin = useRef(false);
  const q = useMemo(() => makeQuestion(pool[Math.floor(Math.random() * pool.length)], bank, 'mcq', S(def, 'choices', 4)), [n]);
  useEffect(() => {
    const id = setInterval(() => setLeft(l => l - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left <= 0 && !fin.current) {
      fin.current = true;
      onFinish(Math.min(score, goal), goal);
    }
  }, [left]);
  const pick = (o: string) => {
    if (fin.current) return;
    if (o === q.answer) { setScore(s => s + 1); triggerHaptic('success'); sfx.correct(); } else { setWrong(w => w + 1); triggerHaptic('warning'); sfx.wrong(); }
    setN(x => x + 1);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="text-amber-400">⏱ {Math.max(0, left)} s</span>
        <span className="text-emerald-400">✓ {score}</span>
        <span className="text-rose-400">✗ {wrong}</span>
        <span className="text-slate-500 text-xs">maqsad: {goal}</span>
      </div>
      <div className="rounded-3xl bg-[#151C28] border border-slate-800 p-6 text-center text-3xl font-extrabold text-white">{q.prompt}</div>
      <div className="grid gap-2">
        {q.options!.map(o => (
          <button key={o} onClick={() => pick(o)} className="w-full text-left px-4 py-3.5 rounded-2xl border bg-[#151C28] border-slate-800 text-sm font-semibold active:scale-[0.98] transition-all">{o}</button>
        ))}
      </div>
    </div>
  );
};

/* ---------- 3. Harflarni tartiblash ---------- */
const ScrambleGame: React.FC<GP> = ({ def, pool, onFinish }) => {
  const words = useMemo(() => { const b = take(pool, S(def, 'rounds', 6)); const f = b.filter(w => w.en.length >= 3); return f.length ? f : b; }, []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [chosen, setChosen] = useState<number[]>([]);
  const w = words[i];
  const letters = useMemo(() => {
    let l = w.en.split('');
    for (let k = 0; k < 5 && l.join('') === w.en && l.length > 1; k++) l = shuffle(l);
    return l;
  }, [i]);
  const next = (ok: boolean) => {
    const sc = score + (ok ? 1 : 0);
    if (i + 1 >= words.length) return onFinish(sc, words.length);
    setScore(sc); setI(i + 1); setChosen([]); setMistakes(0);
  };
  const tap = (idx: number) => {
    if (chosen.includes(idx)) return;
    const nc = [...chosen, idx];
    setChosen(nc);
    if (nc.length === letters.length) {
      const built = nc.map(k => letters[k]).join('');
      if (built.toLowerCase() === w.en.toLowerCase()) { triggerHaptic('success'); sfx.correct(); setTimeout(() => speakEnglish(w.en), 450); setTimeout(() => next(mistakes === 0), 500); }
      else { triggerHaptic('warning'); sfx.wrong(); const m = mistakes + 1; setMistakes(m); setTimeout(() => { if (m >= 2) next(false); else setChosen([]); }, 500); }
    }
  };
  return (
    <div className="space-y-5 text-center">
      <div className="text-xs text-slate-400">{i + 1} / {words.length}</div>
      <div className="text-xl font-bold text-white">{w.uz}</div>
      <div className="flex justify-center gap-1.5 flex-wrap min-h-[52px]">
        {letters.map((_, k) => (
          <div key={k} className="w-9 h-11 rounded-xl border border-slate-700 bg-[#0E1524] flex items-center justify-center text-lg font-bold text-amber-300">{chosen[k] !== undefined ? letters[chosen[k]] : ''}</div>
        ))}
      </div>
      <div className="flex justify-center gap-2 flex-wrap">
        {letters.map((l, k) => (
          <button key={k} onClick={() => tap(k)} disabled={chosen.includes(k)} className="w-11 h-12 rounded-xl bg-[#151C28] border border-slate-700 text-lg font-extrabold text-white disabled:opacity-20 active:scale-90 transition-all">{l}</button>
        ))}
      </div>
      <button onClick={() => setChosen([])} className="text-xs text-slate-400 underline">Tozalash</button>
    </div>
  );
};

/* ---------- 4,5,6. Savol raundlari (eshitib top / gapni to'ldir / yozib ko'r) ---------- */
const RoundsGame: React.FC<GP & { kind: QKind }> = ({ def, pool, bank, kind, onFinish }) => {
  const words = useMemo(() => take(pool, S(def, 'rounds', 8)), []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const q = useMemo(() => makeQuestion(words[i], bank, kind, S(def, 'choices', 4)), [i]);
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-400 text-center">{i + 1} / {words.length} · to&apos;g&apos;ri: {score}</div>
      <QuestionView key={i} q={q} onDone={ok => {
        const sc = score + (ok ? 1 : 0);
        if (i + 1 >= words.length) onFinish(sc, words.length);
        else { setScore(sc); setI(i + 1); }
      }} />
    </div>
  );
};

/* ---------- 7. To'g'ri / Noto'g'ri ---------- */
const TFGame: React.FC<GP> = ({ def, pool, bank, onFinish }) => {
  const rounds = S(def, 'rounds', 12);
  const items = useMemo(() => Array.from({ length: rounds }, () => {
    const w = pool[Math.floor(Math.random() * pool.length)];
    const truth = Math.random() < 0.5;
    const other = shuffle(bank.filter(b => b.id !== w.id))[0];
    return { w, shown: truth ? w.uz : other.uz, truth };
  }), []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<boolean | null>(null);
  const answer = (v: boolean) => {
    if (flash !== null) return;
    const ok = v === items[i].truth;
    setFlash(ok);
    triggerHaptic(ok ? 'success' : 'warning');
    if (ok) sfx.correct();
    else sfx.wrong();
    setTimeout(() => {
      const sc = score + (ok ? 1 : 0);
      setFlash(null);
      if (i + 1 >= items.length) onFinish(sc, items.length);
      else { setScore(sc); setI(i + 1); }
    }, 450);
  };
  const it = items[i];
  return (
    <div className="space-y-4 text-center">
      <div className="text-xs text-slate-400">{i + 1} / {items.length}</div>
      <div className={`rounded-3xl border p-6 space-y-2 transition-colors ${flash === null ? 'bg-[#151C28] border-slate-800' : flash ? 'bg-emerald-500/15 border-emerald-500' : 'bg-rose-500/15 border-rose-500'}`}>
        <div className="text-3xl font-extrabold text-white">{it.w.en}</div>
        <div className="text-slate-500">=</div>
        <div className="text-xl font-semibold text-amber-300">{it.shown}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => answer(true)} className="h-14 rounded-2xl bg-emerald-600 text-white font-bold active:scale-95 transition-all">✓ To&apos;g&apos;ri</button>
        <button onClick={() => answer(false)} className="h-14 rounded-2xl bg-rose-600 text-white font-bold active:scale-95 transition-all">✗ Noto&apos;g&apos;ri</button>
      </div>
    </div>
  );
};

/* ---------- 8. Xotira ketma-ketligi ---------- */
const SeqGame: React.FC<GP> = ({ def, pool, onFinish }) => {
  const rounds = S(def, 'rounds', 5);
  const start = S(def, 'start', 3);
  const showMs = S(def, 'showMs', 900);
  const [r, setR] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'show' | 'recall'>('show');
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const seq = useMemo(() => take(pool, Math.min(pool.length, start + r)), [r]);
  const opts = useMemo(() => shuffle(seq), [seq]);
  useEffect(() => {
    if (phase !== 'show') return;
    if (idx >= seq.length) { setPhase('recall'); return; }
    const t = setTimeout(() => setIdx(x => x + 1), showMs);
    return () => clearTimeout(t);
  }, [phase, idx, seq]);
  const next = (ok: boolean) => {
    const sc = score + (ok ? 1 : 0);
    if (r + 1 >= rounds) return onFinish(sc, rounds);
    setScore(sc); setR(r + 1); setPhase('show'); setIdx(0); setPicked([]);
  };
  const tap = (w: BankWord) => {
    if (picked.includes(w.id)) return;
    const expected = seq[picked.length];
    if (w.id !== expected.id) { triggerHaptic('warning'); sfx.wrong(); setTimeout(() => next(false), 500); setPicked([...picked, w.id]); return; }
    triggerHaptic('light');
    const np = [...picked, w.id];
    setPicked(np);
    if (np.length === seq.length) { triggerHaptic('success'); sfx.correct(); setTimeout(() => next(true), 400); }
    else sfx.correct();
  };
  return (
    <div className="space-y-4 text-center">
      <div className="text-xs text-slate-400">Raund {r + 1} / {rounds} · uzunlik {seq.length}</div>
      {phase === 'show' ? (
        <div className="rounded-3xl bg-[#151C28] border border-slate-800 h-40 flex flex-col items-center justify-center">
          <div className="text-[11px] text-slate-500 mb-2">Eslab qoling ({Math.min(idx + 1, seq.length)}/{seq.length})</div>
          <div className="text-3xl font-extrabold text-amber-300">{seq[Math.min(idx, seq.length - 1)].en}</div>
        </div>
      ) : (
        <>
          <div className="text-sm text-slate-300">Ko&apos;rgan tartibingizda bosing ({picked.length}/{seq.length})</div>
          <div className="grid grid-cols-2 gap-2">
            {opts.map(w => (
              <button key={w.id} onClick={() => tap(w)} disabled={picked.includes(w.id)} className={`px-3 py-4 rounded-2xl border font-bold text-sm transition-all ${picked.includes(w.id) ? (seq[picked.indexOf(w.id)]?.id === w.id ? 'bg-emerald-500/20 border-emerald-500' : 'bg-rose-500/20 border-rose-500') : 'bg-[#151C28] border-slate-800 active:scale-95'}`}>{w.en}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ---------- 9. Karta juftligi ---------- */
const CardsGame: React.FC<GP> = ({ def, pool, onFinish }) => {
  const words = useMemo(() => take(pool, S(def, 'pairs', 6)), []);
  const cards = useMemo(() => shuffle(words.flatMap(w => [{ k: w.id + 'a', id: w.id, t: w.en }, { k: w.id + 'b', id: w.id, t: w.uz }])), [words]);
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const lock = useRef(false);
  const tap = (k: string) => {
    if (lock.current || open.includes(k) || matched.includes(cards.find(c => c.k === k)!.id)) return;
    const no = [...open, k];
    setOpen(no);
    if (no.length === 2) {
      lock.current = true;
      const [c1, c2] = no.map(x => cards.find(c => c.k === x)!);
      setTimeout(() => {
        if (c1.id === c2.id) {
          triggerHaptic('success');
          sfx.correct();
          const nm = [...matched, c1.id];
          setMatched(nm);
          if (nm.length === words.length) setTimeout(() => onFinish(words.length, words.length + mistakes), 300);
        } else { triggerHaptic('warning'); sfx.wrong(); setMistakes(m => m + 1); }
        setOpen([]);
        lock.current = false;
      }, 700);
    }
  };
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-400 text-center">Xatolar: {mistakes}</div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map(c => {
          const show = open.includes(c.k) || matched.includes(c.id);
          return (
            <button key={c.k} onClick={() => tap(c.k)} className={`h-20 rounded-2xl border text-xs font-bold px-1 transition-all ${matched.includes(c.id) ? 'bg-emerald-500/15 border-emerald-600 text-emerald-200' : show ? 'bg-amber-500/15 border-amber-500 text-white' : 'bg-gradient-to-br from-indigo-600 to-slate-900 border-slate-700 text-transparent'}`}>{show ? c.t : '?'}</button>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- 10. Harf yetishmayapti ---------- */
const MissingGame: React.FC<GP> = ({ def, pool, onFinish }) => {
  const rounds = S(def, 'rounds', 8);
  const hidden = S(def, 'hidden', 2);
  const words = useMemo(() => { const b = take(pool, rounds); const f = b.filter(w => w.en.length >= 4); return f.length ? f : b; }, []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [filled, setFilled] = useState(0);
  const [mistake, setMistake] = useState(false);
  const w = words[i];
  const plan = useMemo(() => {
    const idxs = shuffle(w.en.split('').map((_, k) => k)).slice(0, Math.min(hidden, w.en.length - 2)).sort((a, b) => a - b);
    const miss = idxs.map(k => w.en[k].toLowerCase());
    const extra = shuffle('abcdefghijklmnoprstu'.split('').filter(c => !miss.includes(c))).slice(0, 3);
    return { idxs, miss, choices: shuffle([...miss, ...extra]) };
  }, [i]);
  const next = (ok: boolean) => {
    const sc = score + (ok ? 1 : 0);
    if (i + 1 >= words.length) return onFinish(sc, words.length);
    setScore(sc); setI(i + 1); setFilled(0); setMistake(false);
  };
  const tap = (c: string) => {
    if (c === plan.miss[filled]) {
      triggerHaptic('light');
      sfx.correct();
      const nf = filled + 1;
      setFilled(nf);
      if (nf === plan.miss.length) { setTimeout(() => speakEnglish(w.en), 450); setTimeout(() => next(!mistake), 600); }
    } else { triggerHaptic('warning'); sfx.wrong(); setMistake(true); }
  };
  return (
    <div className="space-y-5 text-center">
      <div className="text-xs text-slate-400">{i + 1} / {words.length}</div>
      <div className="text-lg font-bold text-white">{w.uz}</div>
      <div className="flex justify-center gap-1.5">
        {w.en.split('').map((ch, k) => {
          const pos = plan.idxs.indexOf(k);
          const shown = pos === -1 || pos < filled;
          return <div key={k} className={`w-9 h-12 rounded-xl border flex items-center justify-center text-xl font-extrabold ${shown ? 'border-slate-700 bg-[#0E1524] text-white' : 'border-amber-500 bg-amber-500/10 text-amber-300'}`}>{shown ? ch : '_'}</div>;
        })}
      </div>
      <div className="flex justify-center gap-2 flex-wrap">
        {plan.choices.map((c, k) => (
          <button key={k} onClick={() => tap(c)} className="w-12 h-12 rounded-xl bg-[#151C28] border border-slate-700 text-lg font-extrabold text-white active:scale-90 transition-all">{c}</button>
        ))}
      </div>
    </div>
  );
};

/* ---------- 11. Hangman: so'zni top (VIP) ---------- */
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const HangmanGame: React.FC<GP> = ({ def, pool, onFinish }) => {
  const rounds = S(def, 'rounds', 5);
  const maxLives = Math.max(3, S(def, 'lives', 6));
  const words = useMemo(() => {
    const ok = pool.filter(w => /^[a-z]{3,12}$/i.test(w.en.trim()));
    return take(ok.length >= 2 ? ok : pool, rounds);
  }, []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [guessed, setGuessed] = useState<string[]>([]);
  const [lives, setLives] = useState(maxLives);
  const [end, setEnd] = useState<null | 'win' | 'lose'>(null);
  const w = words[i];
  const letters = w.en.toLowerCase().split('');
  const isLetter = (ch: string) => /[a-z]/.test(ch);
  const tap = (c: string) => {
    if (end || guessed.includes(c)) return;
    const g = [...guessed, c];
    setGuessed(g);
    if (letters.includes(c)) {
      triggerHaptic('light');
      sfx.correct();
      if (letters.every(ch => !isLetter(ch) || g.includes(ch))) {
        setEnd('win');
        triggerHaptic('success');
        setTimeout(() => speakEnglish(w.en), 350);
      }
    } else {
      triggerHaptic('warning');
      sfx.wrong();
      const l = lives - 1;
      setLives(l);
      if (l <= 0) setEnd('lose');
    }
  };
  const next = () => {
    const sc = score + (end === 'win' ? 1 : 0);
    if (i + 1 >= words.length) return onFinish(sc, words.length);
    setScore(sc);
    setI(i + 1);
    setGuessed([]);
    setLives(maxLives);
    setEnd(null);
  };
  return (
    <div className="space-y-4 text-center">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{i + 1} / {words.length}</span>
        <span className="tracking-widest">{Array.from({ length: maxLives }).map((_, k) => (k < lives ? '❤️' : '🖤')).join('')}</span>
      </div>
      <div className="rounded-3xl bg-[#151C28] border border-slate-800 px-4 py-4">
        <div className="text-lg font-extrabold text-white">{w.uz}</div>
        <div className="text-[11px] text-slate-500 mt-1">{w.pos}{lives <= Math.ceil(maxLives / 2) && w.ipa ? ` · ${w.ipa}` : ''}</div>
      </div>
      <div className="flex justify-center gap-1.5 flex-wrap">
        {letters.map((ch, k) => {
          const show = !isLetter(ch) || guessed.includes(ch) || end === 'lose';
          const missed = end === 'lose' && isLetter(ch) && !guessed.includes(ch);
          return (
            <div key={k} className={`w-8 h-11 rounded-xl border flex items-center justify-center text-lg font-extrabold ${missed ? 'border-rose-500 bg-rose-500/10 text-rose-300' : show ? 'border-emerald-600 bg-[#0E1524] text-white' : 'border-amber-500 bg-amber-500/10 text-amber-300'}`}>{show ? ch : ''}</div>
          );
        })}
      </div>
      {end ? (
        <div className="space-y-3">
          <div className={`text-sm font-bold ${end === 'win' ? 'text-emerald-400' : 'text-rose-400'}`}>{end === 'win' ? "Barakalla! To'g'ri topdingiz 🎉" : `Jonlar tugadi. To'g'ri javob: ${w.en}`}</div>
          <button onClick={next} className="h-12 px-8 rounded-2xl bg-amber-500 text-slate-950 font-bold text-sm">{i + 1 >= words.length ? 'Natijani ko‘rish' : 'Keyingi so‘z'}</button>
        </div>
      ) : (
        <div className="space-y-2">
          {KEY_ROWS.map(row => (
            <div key={row} className="flex justify-center gap-1.5">
              {row.split('').map(c => {
                const used = guessed.includes(c);
                const good = used && letters.includes(c);
                return (
                  <button key={c} disabled={used} onClick={() => tap(c)} className={`w-8 h-11 rounded-lg border text-sm font-extrabold uppercase transition-all ${used ? (good ? 'bg-emerald-500/20 border-emerald-600 text-emerald-200' : 'bg-rose-500/15 border-rose-700 text-rose-300 opacity-60') : 'bg-[#151C28] border-slate-700 text-white active:scale-90'}`}>{c}</button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- 12. Gap quruvchi (VIP) ---------- */
const sentTokens = (ex: string) => (ex || '').trim().split(/\s+/).filter(Boolean);
const SentenceGame: React.FC<GP> = ({ def, pool, bank, onFinish }) => {
  const rounds = S(def, 'rounds', 6);
  const items = useMemo(() => {
    const ok = (w: BankWord) => {
      const t = sentTokens(w.ex);
      return t.length >= 4 && t.length <= 12;
    };
    let c = pool.filter(ok);
    if (c.length < 3) c = [...c, ...shuffle(bank.filter(w => ok(w) && !c.includes(w)))];
    return take(c, rounds);
  }, []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [state, setState] = useState<'play' | 'bad' | 'ok' | 'reveal'>('play');
  const w = items[i];
  const orig = useMemo(() => (w ? sentTokens(w.ex) : []), [i]);
  const mixed = useMemo(() => {
    let m = shuffle(orig.map((t, k) => ({ t, k })));
    for (let tries = 0; tries < 6 && orig.length > 1 && m.every((x, idx) => x.k === idx); tries++) m = shuffle(m);
    return m;
  }, [i]);
  if (!w) return <p className="text-sm text-slate-400 text-center pt-10">Gaplar uchun misollar yetarli emas.</p>;
  const builtTokens = chosen.map(k => mixed[k].t);
  const advance = (gain: number) => {
    const sc = score + gain;
    if (i + 1 >= items.length) return onFinish(sc, items.length);
    setScore(sc);
    setI(i + 1);
    setChosen([]);
    setAttempts(0);
    setState('play');
  };
  const check = () => {
    const good = builtTokens.join(' ').toLowerCase() === orig.join(' ').toLowerCase();
    if (good) {
      triggerHaptic('success');
      sfx.correct();
      setState('ok');
      speakEnglish(w.ex);
      setTimeout(() => advance(attempts === 0 ? 1 : 0), 1100);
    } else if (attempts === 0) {
      triggerHaptic('warning');
      sfx.wrong();
      setAttempts(1);
      setState('bad');
      setTimeout(() => setState('play'), 700);
    } else {
      sfx.wrong();
      setState('reveal');
    }
  };
  return (
    <div className="space-y-4 text-center">
      <div className="text-xs text-slate-400">{i + 1} / {items.length}</div>
      <div className="rounded-3xl bg-[#151C28] border border-slate-800 px-4 py-4">
        <div className="text-[11px] text-slate-500 mb-1">O‘zbekcha tarjimasi</div>
        <div className="text-base font-bold text-white leading-snug">{w.exUz || w.uz}</div>
      </div>
      <div className={`min-h-[84px] rounded-2xl border-2 border-dashed p-2 flex flex-wrap gap-2 items-start content-start justify-center transition-colors ${state === 'ok' ? 'border-emerald-500 bg-emerald-500/10' : state === 'bad' ? 'border-rose-500 bg-rose-500/10' : 'border-slate-700 bg-[#0E1524]'}`}>
        {state === 'reveal' ? (
          <div className="w-full text-sm font-bold text-amber-300 py-2">{w.ex}</div>
        ) : builtTokens.length === 0 ? (
          <span className="text-xs text-slate-500 py-3">So‘zlarni shu yerga tartib bilan bosing</span>
        ) : (
          chosen.map(k => (
            <button key={k} disabled={state !== 'play'} onClick={() => setChosen(chosen.filter(x => x !== k))} className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-sm font-bold active:scale-95">{mixed[k].t}</button>
          ))
        )}
      </div>
      {state === 'reveal' ? (
        <button onClick={() => advance(0)} className="h-12 px-8 rounded-2xl bg-amber-500 text-slate-950 font-bold text-sm">{i + 1 >= items.length ? 'Natijani ko‘rish' : 'Keyingi gap'}</button>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 justify-center">
            {mixed.map((m, k) => (
              <button key={k} disabled={chosen.includes(k) || state !== 'play'} onClick={() => { triggerHaptic('light'); setChosen([...chosen, k]); }} className={`px-3 py-2 rounded-xl border text-sm font-bold transition-all ${chosen.includes(k) ? 'opacity-20 border-slate-800' : 'bg-[#151C28] border-slate-700 text-white active:scale-95'}`}>{m.t}</button>
            ))}
          </div>
          <div className="text-[11px] text-slate-500">{attempts === 1 ? 'Bitta urinish qoldi' : ' '}</div>
          <button disabled={chosen.length !== mixed.length || state !== 'play'} onClick={check} className="h-12 w-full rounded-2xl bg-amber-500 text-slate-950 font-bold text-sm disabled:opacity-40">Tekshirish</button>
        </>
      )}
    </div>
  );
};

/* ---------- 13. Diktant (VIP) ---------- */
const DictationGame: React.FC<GP> = ({ def, pool, onFinish }) => {
  const rounds = S(def, 'rounds', 6);
  const words = useMemo(() => { const ok = pool.filter(w => w.en.trim().length >= 3); return take(ok.length ? ok : pool, rounds); }, []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [text, setText] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [state, setState] = useState<'play' | 'ok' | 'reveal'>('play');
  const [msg, setMsg] = useState('');
  const [hint, setHint] = useState(false);
  const w = words[i];
  useEffect(() => {
    const t = setTimeout(() => speakEnglish(w.en), 350);
    return () => clearTimeout(t);
  }, [i]);
  const advance = (gain: number) => {
    const sc = score + gain;
    if (i + 1 >= words.length) return onFinish(sc, words.length);
    setScore(sc);
    setI(i + 1);
    setText('');
    setAttempts(0);
    setState('play');
    setMsg('');
    setHint(false);
  };
  const check = () => {
    if (!text.trim()) return;
    const r = checkTyped(text, w.en);
    if (r.ok) {
      triggerHaptic('success');
      sfx.correct();
      setState('ok');
      setMsg(r.close ? `Deyarli to‘g‘ri! To‘g‘ri yozilishi: ${w.en}` : 'To‘g‘ri! 🎉');
      setTimeout(() => advance(attempts === 0 ? 1 : 0), r.close ? 1600 : 900);
    } else if (attempts === 0) {
      triggerHaptic('warning');
      sfx.wrong();
      setAttempts(1);
      setMsg(`Xato. Qayta urinib ko‘ring (${w.en.length} ta harf, ${w.en[0]}...)`);
    } else {
      sfx.wrong();
      setState('reveal');
      setMsg(`To‘g‘ri javob: ${w.en}`);
    }
  };
  return (
    <div className="space-y-4 text-center">
      <div className="text-xs text-slate-400">{i + 1} / {words.length}</div>
      <div className="rounded-3xl bg-[#151C28] border border-slate-800 py-6 px-4 space-y-3">
        <button onClick={() => speakEnglish(w.en)} className="w-20 h-20 rounded-full bg-amber-500/15 border-2 border-amber-500 text-4xl active:scale-90 transition-all">🔊</button>
        <div className="text-xs text-slate-400">So‘zni eshiting va yozing</div>
        {hint && <div className="text-sm font-bold text-sky-300">{w.uz}</div>}
      </div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && state === 'play' && check()}
        disabled={state !== 'play'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Inglizcha so‘zni yozing..."
        className={`w-full h-14 rounded-2xl bg-[#0E1524] border-2 px-4 text-center text-lg font-bold text-white outline-none ${state === 'ok' ? 'border-emerald-500' : state === 'reveal' ? 'border-rose-500' : 'border-slate-700 focus:border-amber-500'}`}
      />
      {msg && <div className={`text-sm font-bold ${state === 'ok' ? 'text-emerald-400' : 'text-amber-300'}`}>{msg}</div>}
      {state === 'reveal' ? (
        <button onClick={() => advance(0)} className="h-12 px-8 rounded-2xl bg-amber-500 text-slate-950 font-bold text-sm">{i + 1 >= words.length ? 'Natijani ko‘rish' : 'Keyingi so‘z'}</button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={state !== 'play'} onClick={() => setHint(true)} className="h-12 rounded-2xl bg-[#1B2433] border border-slate-700 font-bold text-sm disabled:opacity-40">💡 Ma‘nosi</button>
          <button disabled={state !== 'play' || !text.trim()} onClick={check} className="h-12 rounded-2xl bg-amber-500 text-slate-950 font-bold text-sm disabled:opacity-40">Tekshirish</button>
        </div>
      )}
    </div>
  );
};

/* ---------- 14. So'z yomg'iri (VIP) ---------- */
const RainGame: React.FC<GP> = ({ def, pool, bank, onFinish }) => {
  const total = S(def, 'words', 10);
  const maxLives = Math.max(1, S(def, 'lives', 3));
  const words = useMemo(() => take(pool, total), []);
  const [i, setI] = useState(0);
  const [lives, setLives] = useState(maxLives);
  const [score, setScore] = useState(0);
  const [p, setP] = useState(0); // 0..1 — so'z qanchalik tushdi
  const [flash, setFlash] = useState<'' | 'ok' | 'bad'>('');
  const [badOpt, setBadOpt] = useState<string | null>(null);
  const lock = useRef(false);
  const fall = Math.max(3500, 8000 - i * 350); // so'z tushish vaqti (ms): borgan sari tezlashadi
  const q = useMemo(() => makeQuestion(words[i], bank, 'mcq', 4), [i]);

  const advance = (nl: number, ns: number) => {
    if (nl <= 0 || i + 1 >= words.length) return onFinish(ns, words.length);
    setI(i + 1);
    setP(0);
    setFlash('');
    setBadOpt(null);
    lock.current = false;
  };

  useEffect(() => {
    setP(0);
    const id = setInterval(() => {
      if (lock.current) return;
      setP(x => Math.min(1, x + 50 / fall));
    }, 50);
    return () => clearInterval(id);
  }, [i]);

  useEffect(() => {
    if (p < 1 || lock.current) return;
    lock.current = true; // yerga tushdi
    triggerHaptic('warning');
    sfx.wrong();
    setFlash('bad');
    const nl = lives - 1;
    setLives(nl);
    setTimeout(() => advance(nl, score), 900);
  }, [p]);

  const pick = (opt: string) => {
    if (lock.current) return;
    if (opt === q.answer) {
      lock.current = true;
      triggerHaptic('success');
      sfx.correct();
      speakEnglish(words[i].en);
      setFlash('ok');
      const ns = score + 1;
      setScore(ns);
      setTimeout(() => advance(lives, ns), 500);
    } else {
      triggerHaptic('warning');
      sfx.wrong();
      setBadOpt(opt);
      const nl = lives - 1;
      setLives(nl);
      if (nl <= 0) {
        lock.current = true;
        setTimeout(() => onFinish(score, words.length), 700);
      }
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{i + 1} / {words.length} · ✅ {score}</span>
        <span className="tracking-widest">{Array.from({ length: maxLives }).map((_, k) => (k < lives ? '❤️' : '🖤')).join('')}</span>
      </div>
      <div className="relative h-64 rounded-3xl overflow-hidden border border-sky-900/60 bg-gradient-to-b from-[#0B1B33] via-[#0E2440] to-[#12395F]">
        <div className="absolute left-0 right-0 bottom-0 h-3 bg-sky-400/40" />
        <div
          className={`absolute left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-2xl text-xl font-extrabold shadow-lg border-2 ${flash === 'ok' ? 'bg-emerald-500 text-slate-950 border-emerald-300' : flash === 'bad' ? 'bg-rose-500 text-white border-rose-300' : 'bg-white text-slate-900 border-sky-200'}`}
          style={{ top: `${6 + p * 72}%` }}
        >
          {words[i].en}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(q.options || []).map(o => (
          <button key={o} onClick={() => pick(o)} className={`px-2 py-3 rounded-2xl border text-xs font-bold leading-snug transition-all active:scale-95 ${badOpt === o ? 'bg-rose-500/20 border-rose-500' : flash && o === q.answer ? 'bg-emerald-500/20 border-emerald-500' : 'bg-[#151C28] border-slate-700 text-white'}`}>{o}</button>
        ))}
      </div>
    </div>
  );
};

/* ---------- 15. Ortiqchasini top (VIP) ---------- */
const OddGame: React.FC<GP> = ({ def, pool, bank, onFinish }) => {
  const rounds = S(def, 'rounds', 8);
  const plan = useMemo(() => {
    const makeKey = (f: (w: BankWord) => string) => {
      const m = new Map<string, BankWord[]>();
      bank.forEach(w => {
        const k = f(w);
        if (!k) return;
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(w);
      });
      return m;
    };
    let by = makeKey(w => (w.topic || '').trim().toLowerCase());
    let label = (k: string) => `mavzu: ${k}`;
    if ([...by.values()].filter(v => v.length >= 3).length < 2) {
      by = makeKey(w => (w.pos || '').trim().toLowerCase());
      label = (k: string) => `so‘z turkumi: ${k}`;
    }
    const groups = [...by.entries()].filter(([, v]) => v.length >= 3);
    if (groups.length < 2) return [] as { opts: BankWord[]; odd: BankWord; group: string }[];
    const poolIds = new Set(pool.map(w => w.id));
    const out: { opts: BankWord[]; odd: BankWord; group: string }[] = [];
    const order = shuffle(groups);
    for (let r = 0; r < rounds; r++) {
      const [gk, gw] = order[r % order.length];
      const others = groups.filter(([k]) => k !== gk);
      const [, ow] = others[Math.floor(Math.random() * others.length)];
      const three = shuffle(gw).sort((a, b) => Number(poolIds.has(b.id)) - Number(poolIds.has(a.id))).slice(0, 3);
      const odd = shuffle(ow).sort((a, b) => Number(poolIds.has(b.id)) - Number(poolIds.has(a.id)))[0];
      out.push({ opts: shuffle([...three, odd]), odd, group: label(gk) });
    }
    return out;
  }, []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  if (!plan.length) return <p className="text-sm text-slate-400 text-center pt-10">Bu o‘yin uchun so‘zlar mavzulari yetarli emas.</p>;
  const r = plan[i];
  const pick = (w: BankWord) => {
    if (picked) return;
    setPicked(w.id);
    const ok = w.id === r.odd.id;
    triggerHaptic(ok ? 'success' : 'warning');
    if (ok) sfx.correct();
    else sfx.wrong();
    speakEnglish(w.en);
    const sc = score + (ok ? 1 : 0);
    setTimeout(() => {
      if (i + 1 >= plan.length) return onFinish(sc, plan.length);
      setScore(sc);
      setI(i + 1);
      setPicked(null);
    }, 1300);
  };
  return (
    <div className="space-y-4 text-center">
      <div className="text-xs text-slate-400">{i + 1} / {plan.length}</div>
      <div className="text-sm font-bold text-white">Qaysi so‘z boshqalariga mos kelmaydi?</div>
      <div className="grid grid-cols-2 gap-3">
        {r.opts.map(w => {
          const isOdd = w.id === r.odd.id;
          const state = !picked ? 'idle' : isOdd ? 'right' : picked === w.id ? 'wrong' : 'dim';
          return (
            <button key={w.id} onClick={() => pick(w)} className={`px-3 py-5 rounded-2xl border transition-all active:scale-95 ${state === 'right' ? 'bg-emerald-500/20 border-emerald-500' : state === 'wrong' ? 'bg-rose-500/20 border-rose-500' : state === 'dim' ? 'opacity-40 border-slate-800 bg-[#151C28]' : 'bg-[#151C28] border-slate-700'}`}>
              <div className="text-base font-extrabold text-white">{w.en}</div>
              {picked && <div className="text-[11px] text-slate-300 mt-1">{w.uz}</div>}
            </button>
          );
        })}
      </div>
      <div className="text-[11px] text-slate-500 min-h-[16px]">{picked ? `Qolgan uchtasi — ${r.group}` : ' '}</div>
    </div>
  );
};

/* ---------- 16. Sinonimini top (Har doim inglizcha sinonimlar) ---------- */
const ENGLISH_SYNONYMS: [string, string, string][] = [
  ['start', 'begin', 'boshlamoq'],
  ['huge', 'enormous', 'juda katta, ulkan'],
  ['smart', 'intelligent', 'aqlli, ziyrak'],
  ['fast', 'quick', 'tez, chaqqon'],
  ['happy', 'joyful', 'baxtli, quvnoq'],
  ['help', 'assist', 'yordam bermoq'],
  ['rich', 'wealthy', 'boy, badavlat'],
  ['hard', 'difficult', 'qiyin, murakkab'],
  ['calm', 'peaceful', 'xotirjam, tinch'],
  ['brave', 'courageous', 'jasur, qo\'rqmas'],
  ['buy', 'purchase', 'sotib olmoq'],
  ['gift', 'present', 'sovg\'a'],
  ['idea', 'thought', 'fikr, g\'oya'],
  ['answer', 'reply', 'javob bermoq'],
  ['speak', 'talk', 'gapirmoq'],
  ['show', 'display', 'ko\'rsatmoq, namoyish'],
  ['build', 'construct', 'qurmoq'],
  ['occur', 'happen', 'sodir bo\'lmoq'],
  ['journey', 'trip', 'sayohat'],
  ['tired', 'exhausted', 'charchagan, toliqqan'],
  ['shut', 'close', 'yopmoq'],
  ['correct', 'right', 'to\'g\'ri, xatosiz'],
  ['safe', 'secure', 'xavfsiz'],
  ['simple', 'easy', 'oddiy, oson'],
  ['tidy', 'neat', 'ozoda, saranjom'],
  ['shout', 'yell', 'baqirmoq'],
  ['hazard', 'danger', 'xavf-xatar'],
  ['end', 'finish', 'tugatmoq, yakun'],
  ['friend', 'companion', 'do\'st, hamroh'],
  ['funny', 'humorous', 'kulgili, qiziq'],
  ['urgent', 'pressing', 'shoshilinch'],
  ['accurate', 'precise', 'aniq, to\'g\'ri'],
  ['annual', 'yearly', 'yillik'],
  ['broad', 'wide', 'keng'],
  ['chief', 'main', 'asosiy, bosh'],
  ['damage', 'harm', 'zarar, ziyon'],
  ['loyal', 'faithful', 'sodiq, vafodor'],
  ['odd', 'strange', 'g\'alati'],
  ['polite', 'courteous', 'xushmuomala, odobli'],
  ['rare', 'scarce', 'kamyob, nodir'],
  ['slim', 'thin', 'nozik, ozg\'in'],
  ['total', 'complete', 'to\'liq, jami'],
  ['vivid', 'bright', 'yorqin'],
  ['choose', 'select', 'tanlamoq'],
  ['error', 'mistake', 'xato'],
  ['gather', 'collect', 'yig\'moq, to\'plamoq'],
  ['chance', 'opportunity', 'imkoniyat'],
];

const SynonymGame: React.FC<GP> = ({ def, pool, bank, onFinish }) => {
  const totalRounds = S(def, 'rounds', 6);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const current = useMemo(() => {
    // 1. Birinchi sinxron lug'atdan juftlik olamiz
    const pair = ENGLISH_SYNONYMS[round % ENGLISH_SYNONYMS.length];
    const flip = round % 2 === 1;
    const target = flip ? pair[1] : pair[0];
    const answer = flip ? pair[0] : pair[1];
    const uz = pair[2];

    // 2. Chalg'ituvchi boshqa INGLIZCHA so'zlarni tanlaymiz
    const otherWords = shuffle(
      ENGLISH_SYNONYMS.flatMap(p => [p[0], p[1]]).filter(w => w !== target && w !== answer)
    ).slice(0, 3);

    const options = shuffle([answer, ...otherWords]);
    return { target, answer, uz, options };
  }, [round]);

  const pick = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    const isRight = opt === current.answer;
    if (isRight) {
      triggerHaptic('success');
      sfx.correct();
      setCorrect(c => c + 1);
    } else {
      triggerHaptic('warning');
      sfx.wrong();
    }
    setTimeout(() => {
      setPicked(null);
      if (round + 1 >= totalRounds) {
        onFinish(correct + (isRight ? 1 : 0), totalRounds);
      } else {
        setRound(r => r + 1);
      }
    }, 900);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs font-bold text-slate-400">
        <span>Bosqich {round + 1} / {totalRounds}</span>
        <span className="text-emerald-400">To'g'ri: {correct}</span>
      </div>
      <div className="rounded-3xl bg-[#151C28] border border-slate-800 p-6 text-center space-y-2">
        <span className="text-[11px] uppercase tracking-wider text-amber-400 font-extrabold">Inglizcha sinonimini toping:</span>
        <h3 className="text-3xl font-black text-white tracking-wide">{current.target}</h3>
        <p className="text-xs text-slate-400 italic">Ma'nosi: {current.uz}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {current.options.map((opt, i) => {
          const state = !picked ? 'idle' : opt === current.answer ? 'right' : opt === picked ? 'wrong' : 'dim';
          return (
            <button
              key={i}
              onClick={() => pick(opt)}
              className={`p-4 rounded-2xl border text-sm font-black tracking-wide transition-all active:scale-95 ${
                state === 'right'
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/20'
                  : state === 'wrong'
                  ? 'bg-rose-500/25 border-rose-500 text-rose-300'
                  : state === 'dim'
                  ? 'opacity-35 border-slate-800 bg-[#151C28]'
                  : 'bg-[#151C28] hover:bg-slate-800/80 border-slate-700 text-white'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- 17. Qarama-qarshi so'z (Antonim) ---------- */
const AntonymGame: React.FC<GP> = ({ def, pool, bank, onFinish }) => {
  const totalRounds = S(def, 'rounds', 6);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const ANTONYMS: [string, string][] = [
    ['rich', 'poor'], ['hot', 'cold'], ['fast', 'slow'], ['big', 'small'],
    ['easy', 'difficult'], ['early', 'late'], ['happy', 'sad'], ['strong', 'weak'],
    ['ancient', 'modern'], ['bright', 'dark'], ['cheap', 'expensive'], ['clean', 'dirty']
  ];

  const current = useMemo(() => {
    const pair = ANTONYMS[round % ANTONYMS.length];
    const target = pair[0];
    const answer = pair[1];
    const others = shuffle(ANTONYMS.map(p => p[1]).filter(x => x !== answer)).slice(0, 3);
    const options = shuffle([answer, ...others]);
    return { target, answer, options };
  }, [round]);

  const pick = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    const isRight = opt === current.answer;
    if (isRight) {
      triggerHaptic('success');
      sfx.correct();
      setCorrect(c => c + 1);
    } else {
      triggerHaptic('warning');
      sfx.wrong();
    }
    setTimeout(() => {
      setPicked(null);
      if (round + 1 >= totalRounds) {
        onFinish(correct + (isRight ? 1 : 0), totalRounds);
      } else {
        setRound(r => r + 1);
      }
    }, 900);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs font-bold text-slate-400">
        <span>Bosqich {round + 1} / {totalRounds}</span>
        <span className="text-emerald-400">To'g'ri: {correct}</span>
      </div>
      <div className="rounded-3xl bg-[#151C28] border border-slate-800 p-6 text-center space-y-2">
        <span className="text-[11px] uppercase tracking-wider text-rose-400 font-extrabold">Qarama-qarshi ma'nosi (Antonim):</span>
        <h3 className="text-3xl font-black text-white">{current.target}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {current.options.map((opt, i) => {
          const state = !picked ? 'idle' : opt === current.answer ? 'right' : opt === picked ? 'wrong' : 'dim';
          return (
            <button key={i} onClick={() => pick(opt)} className={`p-4 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${state === 'right' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : state === 'wrong' ? 'bg-rose-500/20 border-rose-500 text-rose-300' : state === 'dim' ? 'opacity-40 border-slate-800 bg-[#151C28]' : 'bg-[#151C28] border-slate-700 text-white'}`}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- 18. So'z qidiruvi (Word Search) ---------- */
const WordSearchGame: React.FC<GP> = ({ def, pool, onFinish }) => {
  const totalRounds = S(def, 'rounds', 5);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [typed, setTyped] = useState<number[]>([]);

  const targetWord = useMemo(() => {
    const w = pool[round % pool.length];
    const en = w.en.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
    const letters = en.split('');
    const randomLetters = Array.from({ length: Math.max(0, 16 - letters.length) }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26)));
    const grid = shuffle([...letters, ...randomLetters]);
    return { word: w, clean: en, grid };
  }, [round, pool]);

  const clickLetter = (idx: number) => {
    if (typed.includes(idx)) {
      setTyped(t => t.filter(x => x !== idx));
      return;
    }
    const next = [...typed, idx];
    setTyped(next);
    const currentStr = next.map(i => targetWord.grid[i]).join('');
    if (currentStr === targetWord.clean) {
      triggerHaptic('success');
      sfx.correct();
      setCorrect(c => c + 1);
      setTimeout(() => {
        setTyped([]);
        if (round + 1 >= totalRounds) {
          onFinish(correct + 1, totalRounds);
        } else {
          setRound(r => r + 1);
        }
      }, 700);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs font-bold text-slate-400">
        <span>So'z {round + 1} / {totalRounds}</span>
        <span className="text-emerald-400">Topildi: {correct}</span>
      </div>
      <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-4 text-center">
        <div className="text-xs text-slate-400">O'zbekcha tarjimasi:</div>
        <div className="text-xl font-black text-amber-400 mt-1">{targetWord.word.uz}</div>
        <div className="mt-3 flex justify-center gap-1 min-h-[36px]">
          {typed.map((idx, i) => (
            <span key={i} className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center font-black text-white text-sm">
              {targetWord.grid[idx]}
            </span>
          ))}
          {Array.from({ length: Math.max(0, targetWord.clean.length - typed.length) }).map((_, i) => (
            <span key={i} className="w-8 h-8 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-600 text-xs">_</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {targetWord.grid.map((char, i) => {
          const isSelected = typed.includes(i);
          return (
            <button key={i} onClick={() => clickLetter(i)} className={`h-12 rounded-xl border text-lg font-black transition-all active:scale-90 ${isSelected ? 'bg-amber-500 text-slate-950 border-amber-400 scale-95 shadow-md shadow-amber-500/20' : 'bg-[#18202F] border-slate-800 text-white hover:border-slate-700'}`}>
              {char}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- 19. Blitz Viktorina ---------- */
const BlitzGame: React.FC<GP> = ({ def, pool, bank, onFinish }) => {
  const [seconds, setSeconds] = useState(S(def, 'seconds', 60));
  const goal = S(def, 'goal', 10);
  const [score, setScore] = useState(0);
  const [idx, setIdx] = useState(0);
  const [fin, setFin] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(timer);
          setFin(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (fin) onFinish(Math.min(score, goal), goal);
  }, [fin]);

  const current = useMemo(() => {
    const w = pool[idx % pool.length];
    const isTrue = Math.random() > 0.5;
    const fake = bank.find(b => b.id !== w.id) || w;
    const shownUz = isTrue ? w.uz : fake.uz;
    return { word: w, shownUz, isTrue };
  }, [idx, pool, bank]);

  const answer = (userThinksTrue: boolean) => {
    if (fin) return;
    if (userThinksTrue === current.isTrue) {
      triggerHaptic('success');
      sfx.correct();
      setScore(s => s + 1);
    } else {
      triggerHaptic('warning');
      sfx.wrong();
    }
    setIdx(i => i + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm font-bold">
        <span className="text-amber-400">⏱ {seconds}s</span>
        <span className="text-emerald-400">Natija: {score}</span>
        <span className="text-slate-500 text-xs">Maqsad: {goal}</span>
      </div>
      <div className="rounded-3xl bg-[#151C28] border border-slate-800 p-8 text-center space-y-3">
        <div className="text-3xl font-black text-white">{current.word.en}</div>
        <div className="text-slate-500 font-bold text-sm">=</div >
        <div className="text-xl font-extrabold text-amber-300">{current.shownUz}</div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => answer(false)} className="h-14 rounded-2xl bg-rose-500/20 border-2 border-rose-500 text-rose-300 font-black text-lg active:scale-95 transition-all">
          ❌ Noto'g'ri
        </button>
        <button onClick={() => answer(true)} className="h-14 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300 font-black text-lg active:scale-95 transition-all">
          ✅ To'g'ri
        </button>
      </div>
    </div>
  );
};

/* ---------- 20. Talaffuz sinovi (Echo va foiz baholash) ---------- */
const PronounceGame: React.FC<GP> = ({ def, pool, onFinish }) => {
  const totalRounds = S(def, 'rounds', 5);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [listening, setListening] = useState(false);
  const [spoken, setSpoken] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ percent: number; words: { w: string; ok: boolean }[] } | null>(null);
  const stopListenRef = useRef<(() => void) | null>(null);

  const current = useMemo(() => pool[round % pool.length], [round, pool]);

  useEffect(() => {
    setSpoken('');
    setResult(null);
    setListening(false);
    setStatusMsg(null);
    if (stopListenRef.current) {
      stopListenRef.current();
      stopListenRef.current = null;
    }
  }, [round, current]);

  useEffect(() => {
    return () => {
      if (stopListenRef.current) stopListenRef.current();
    };
  }, []);

  const playVoice = () => {
    speakEnglish(current.en);
    triggerHaptic('light');
  };

  const handleStartListen = () => {
    if (listening) {
      if (stopListenRef.current) stopListenRef.current();
      setListening(false);
      return;
    }
    triggerHaptic('medium');
    setSpoken('');
    setResult(null);
    setStatusMsg("🎙️ Tinglanmoqda... Marhamat, inglizcha talaffuz qiling!");
    setListening(true);

    const stop = startListening(
      (text, final) => {
        setSpoken(text);
        if (final || text.trim().length > 0) {
          const res = compareSpeech(current.en, text);
          setResult(res);
          setStatusMsg(null);
          if (res.percent >= 70) {
            triggerHaptic('success');
            sfx.correct();
          } else {
            triggerHaptic('warning');
            sfx.wrong();
          }
        }
      },
      (err) => {
        setListening(false);
        if (err === 'not-allowed') {
          setStatusMsg("Mikrofon ruxsati berilmadi. Iltimos brauzer sozlamalaridan mikrofonga ruxsat bering.");
        } else if (err === 'no-speech') {
          setStatusMsg("Ovoz eshitilmadi. Iltimos, mikrofonga yaqinroq va balandroq gapiring.");
        }
      },
      current.en
    );
    stopListenRef.current = stop;
  };

  const nextWord = (isGood: boolean) => {
    if (stopListenRef.current) stopListenRef.current();
    const newCorrect = correct + (isGood ? 1 : 0);
    setCorrect(newCorrect);
    if (round + 1 >= totalRounds) {
      onFinish(newCorrect, totalRounds);
    } else {
      setRound(r => r + 1);
    }
  };

  const passed = result ? result.percent >= 70 : false;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs font-bold text-slate-400">
        <span>So'z {round + 1} / {totalRounds}</span>
        <span className="text-emerald-400">To'g'ri talaffuz: {correct}</span>
      </div>

      <div className="rounded-3xl bg-[#151C28] border border-slate-800 p-6 text-center space-y-3 shadow-xl">
        <div className="text-3xl font-black text-white tracking-wide">{current.en}</div>
        <div className="text-sm text-cyan-400 font-mono tracking-wider">{current.ipa}</div>
        <div className="text-sm text-slate-300">{current.uz}</div>

        <button
          onClick={playVoice}
          className="mt-2 px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Volume2 className="w-4 h-4" />
          <span>To'g'ri talaffuzni eshitish</span>
        </button>

        {/* Live recognition transcript & accuracy display */}
        {statusMsg && (
          <div className="mt-3 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-300 animate-pulse">
            {statusMsg}
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className={`text-xl font-black ${result.percent >= 70 ? 'text-emerald-400' : result.percent >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                🎯 {result.percent}% Aniqlik
              </span>
            </div>
            <p className="text-xs font-medium text-slate-300">
              {result.percent >= 80 ? "Ajoyib talaffuz! Qoyilmaqom! 👏" : result.percent >= 60 ? "Yaxshi natija! Bir oz yana mashq qiling." : "Qaytadan aniqroq talaffuz qilishga urinib ko'ring."}
            </p>
            {spoken && (
              <div className="text-xs text-slate-400 italic">
                Siz aytdingiz: &ldquo;<span className="text-white font-semibold">{spoken}</span>&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="space-y-2.5">
        <button
          onClick={handleStartListen}
          className={`w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
            listening
              ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/30'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/25'
          }`}
        >
          {listening ? <MicOff className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
          <span>{listening ? 'Tinglanmoqda... Gapiring!' : '🎙️ Mikrofon orqali talaffuz qilish'}</span>
        </button>

        {result ? (
          <button
            onClick={() => nextWord(passed)}
            className={`w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              passed
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-200 border border-slate-700'
            }`}
          >
            <span>{passed ? "Keyingi so'zga o'tish →" : "O'tkazib yuborish (Keyingisi) →"}</span>
          </button>
        ) : (
          <button
            onClick={() => nextWord(false)}
            className="w-full h-10 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
          >
            Keyingisi (O'tkazib yuborish) →
          </button>
        )}
      </div>
    </div>
  );
};

const RENDER: Record<string, React.FC<GP>> = {
  match: MatchGame,
  speed: SpeedGame,
  scramble: ScrambleGame,
  listen: p => <RoundsGame {...p} kind="listen" />,
  gap: p => <RoundsGame {...p} kind="gap" />,
  typing: p => <RoundsGame {...p} kind="type" />,
  tf: TFGame,
  seq: SeqGame,
  cards: CardsGame,
  missing: MissingGame,
  hangman: HangmanGame,
  sentence: SentenceGame,
  dictation: DictationGame,
  rain: RainGame,
  odd: OddGame,
  synonym: SynonymGame,
  antonym: AntonymGame,
  wordsearch: WordSearchGame,
  blitz: BlitzGame,
  pronounce: PronounceGame,
};

export const GameScreen: React.FC<{ id: string }> = ({ id }) => {
  const { games, bank, srs, completeGame, closeOverlay } = useApp();
  const def = games.find(g => g.id === id)!;
  const [result, setResult] = useState<null | { correct: number; total: number; xp: number; passed: boolean; already: boolean }>(null);
  const [run, setRun] = useState(0);

  const learned = useMemo(() => bank.filter(b => srs[b.id]), [bank, srs]);
  const demo = learned.length < 4;
  const pool = demo ? bank.slice(0, Math.min(bank.length, 12)) : learned;
  const Game = RENDER[id];
  if (!def || !Game || pool.length < 2) {
    return <Shell title="O'yin" onBack={closeOverlay}><p className="text-sm text-slate-400 text-center pt-10">Bu o&apos;yin uchun so&apos;zlar yetarli emas.</p></Shell>;
  }

  return (
    <Shell title={`${def.icon} ${def.title}`} sub={demo ? "Namuna so'zlar (XP yo'q)" : def.kind === 'memory' ? 'Xotira mashqi' : "So'z mashqi"} onBack={closeOverlay}>
      {!result ? (
        <Game key={run} def={def} pool={pool} bank={bank} onFinish={(correct, total) => {
          const r = completeGame(id, correct, total, demo);
          setResult({ correct, total, ...r });
          if (r.passed) setTimeout(() => sfx.win(correct >= total), 200);
        }} />
      ) : (
        <div className="text-center space-y-4 pt-4">
          <div className="text-6xl">{result.passed ? (result.correct === result.total ? '🏆' : '🎉') : '💪'}</div>
          <h2 className="text-xl font-extrabold text-white">{result.passed ? 'Ajoyib natija!' : 'Yana urinib ko\'ring'}</h2>
          <div className="text-sm text-slate-300">Natija: <b className="text-amber-400">{Math.min(result.correct, result.total)} / {result.total}</b></div>
          {result.xp > 0 && <div className="inline-block rounded-2xl bg-amber-500/15 border border-amber-500/40 px-4 py-2 text-amber-300 font-bold">+{result.xp} XP</div>}
          {result.already && <p className="text-xs text-slate-400">Bu o&apos;yin uchun bugungi XP allaqachon olingan. Qayta o&apos;ynash XP bermaydi.</p>}
          {demo && <p className="text-xs text-slate-400">Avval «Bugungi mashq»da so&apos;z o&apos;rganing, shunda o&apos;yin sizning so&apos;zlaringiz bilan o&apos;ynaladi va XP beradi.</p>}
          {!result.passed && <p className="text-xs text-slate-400">XP uchun kamida 60% to&apos;g&apos;ri javob kerak.</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setResult(null); setRun(x => x + 1); }} className="h-12 rounded-2xl bg-[#1B2433] border border-slate-700 font-bold text-sm">Qayta o&apos;ynash</button>
            <button onClick={closeOverlay} className="h-12 rounded-2xl bg-amber-500 text-slate-950 font-bold text-sm">Tayyor</button>
          </div>
        </div>
      )}
    </Shell>
  );
};

export const GamesTab: React.FC = () => {
  const { games, openGame, isPro, wheel, savedWords } = useApp();
  const [showWheel, setShowWheel] = useState(false);
  const proLeft = Math.max(0, Math.ceil((wheel.proUntil - nowMs()) / 3600000));
  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className="text-xl font-extrabold text-white">O&apos;yinlar</h2>
        <p className="text-xs text-slate-400 mt-0.5">O&apos;rgangan so&apos;zlaringiz bilan o&apos;ynang. Har bir o&apos;yindan kuniga bir marta XP olinadi.</p>
      </div>
      {isPro && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-amber-500/20 border-2 border-amber-400/70 py-4 px-3 flex flex-col items-center justify-center gap-1 text-center shadow-lg shadow-amber-500/10">
          <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xl tracking-wide"><Crown className="w-6 h-6" /> VIP ochiq</div>
          <div className="text-base font-extrabold text-amber-200">~{proLeft} soat qoldi</div>
        </div>
      )}
      {savedWords.length < 4 && (
        <div className="rounded-2xl bg-sky-500/10 border border-sky-500/30 p-3 text-xs text-sky-200">Hozircha kam so&apos;z o&apos;rgandingiz, shuning uchun o&apos;yinlar namuna so&apos;zlar bilan (XP siz) ishlaydi. «Bugun» bo&apos;limida so&apos;z o&apos;rganing.</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {games.filter(g => g.enabled).map(g => {
          const locked = g.vip && !isPro;
          return (
            <button key={g.id} type="button" onClick={() => { triggerHaptic('selection'); if (!openGame(g.id)) setShowWheel(true); }} className={`relative text-left p-4 rounded-2xl border transition-all active:scale-[0.97] ${locked ? 'bg-[#121822] border-slate-800' : 'bg-[#151C28] border-slate-800 hover:border-amber-500/40'}`}>
              {g.vip && (
                <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-[9px] font-extrabold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded">{locked ? <Lock className="w-2.5 h-2.5" /> : <Crown className="w-2.5 h-2.5" />} VIP</span>
              )}
              <div className="text-3xl">{g.icon}</div>
              <div className="text-sm font-bold text-white mt-2 leading-tight">{g.title}</div>
              <div className="text-[11px] text-slate-400 mt-1 leading-snug">{g.desc}</div>
              <div className="text-[11px] text-amber-400 font-semibold mt-2">+{g.xp} XP{g.kind === 'memory' ? ' · 🧠 xotira' : ''}</div>
            </button>
          );
        })}
      </div>
      {showWheel && <LuckyWheel onClose={() => setShowWheel(false)} />}
    </div>
  );
};
