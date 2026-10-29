import React, { useEffect, useState, useRef } from 'react';
import { Swords, Plus, Link2, Share2, Copy, Check, Crown, Clock, LogOut, Users, Hash, Zap, Play, Timer, Trophy, RotateCcw, X, Sparkles } from 'lucide-react';
import { useApp, BLITZ_DAILY_LIMIT, BLITZ_MAX_XP, BLITZ_WIN_MIN_CORRECT } from '../context/AppContext';
import { Duel, DuelMetric, BankWord } from '../types';
import { Avatar } from './Avatar';
import { triggerHaptic, shareUrl, getDuelLink } from '../services/telegram';
import { nowMs } from '../services/time';
import { sfx } from '../services/sound';
import { shuffle } from '../services/srs';

const METRICS: { id: DuelMetric; label: string; unit: string; hint: string }[] = [
  { id: 'xp', label: 'XP yig‘ish', unit: 'XP', hint: 'Kim ko‘proq XP to‘plasa, o‘sha yutadi' },
  { id: 'words', label: 'Yangi so‘zlar', unit: 'so‘z', hint: 'Kim ko‘proq yangi so‘z o‘rgansa' },
  { id: 'mastered', label: 'Yodlangan so‘zlar', unit: 'so‘z', hint: 'Kim ko‘proq so‘zni to‘liq yodlasa' },
];
const DURATIONS = [{ h: 24, t: '24 soat' }, { h: 72, t: '3 kun' }, { h: 168, t: '7 kun' }];
const metricOf = (m: DuelMetric) => METRICS.find(x => x.id === m) || METRICS[0];

const left = (ms: number) => {
  if (ms <= 0) return 'Tugadi';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d} kun ${h} soat` : h > 0 ? `${h} soat ${m % 60} daq` : `${m} daq`;
};

const Standings: React.FC<{ d: Duel; meId: string; ended: boolean }> = ({ d, meId, ended }) => {
  const u = metricOf(d.metric).unit;
  const max = Math.max(1, ...d.players.map(p => p.gain));
  return (
    <div className="space-y-2">
      {d.players.map((p, i) => {
        const me = p.id === meId;
        return (
          <div key={p.id} className={`p-3 rounded-xl border ${me ? 'bg-amber-500/10 border-amber-500/50' : 'bg-[#151C28] border-slate-800'}`}>
            <div className="flex items-center gap-3">
              <span className="w-5 text-center text-xs font-bold text-slate-400 tabular-nums">{i === 0 && p.gain > 0 ? <Crown className="w-4 h-4 text-amber-400 mx-auto" /> : i + 1}</span>
              <Avatar src={p.avatar} name={p.name} className="w-9 h-9" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{p.name}{me ? ' (Siz)' : ''}</div>
                <div className="mt-1.5 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : 'bg-sky-500'} transition-all duration-700`} style={{ width: `${Math.round((p.gain / max) * 100)}%` }} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-extrabold text-amber-400 tabular-nums">+{p.gain}</div>
                <div className="text-[10px] text-slate-400">{u}</div>
              </div>
            </div>
          </div>
        );
      })}
      {ended && d.players[0] && d.players[0].gain > 0 && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-center text-sm font-bold text-emerald-300">
          🏆 G‘olib: {d.players[0].id === meId ? 'Siz!' : d.players[0].name}
        </div>
      )}
    </div>
  );
};

// G'alaba: kamida 3/5 to'g'ri. XP = to'g'ri javoblar + 1, ko'pi bilan 6 (3→4, 4→5, 5→6). Yutqazganda XP yo'q.
const blitzXp = (correct: number) => (correct >= BLITZ_WIN_MIN_CORRECT ? Math.min(BLITZ_MAX_XP, correct + 1) : 0);

const BlitzDuelModal: React.FC<{ bank: BankWord[]; blitzLeft: number; consumeBlitz: () => boolean; onClose: () => void; onWinXp: (xp: number) => void }> = ({ bank, blitzLeft, consumeBlitz, onClose, onWinXp }) => {
  const [phase, setPhase] = useState<'intro' | 'play' | 'result'>('intro');
  const [qIndex, setQIndex] = useState(0);
  const [questions, setQuestions] = useState<{ word: BankWord; options: string[]; answer: string }[]>([]);
  const [timeLeft, setTimeLeft] = useState(6);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const timerRef = useRef<any>(null);
  const awardedRef = useRef(false);

  const startDuel = () => {
    if (!consumeBlitz()) return; // kunlik limit tugagan
    awardedRef.current = false;
    const pool = shuffle([...bank]).slice(0, 5);
    const qs = pool.map(w => {
      const distractors = shuffle(bank.filter(x => x.id !== w.id)).slice(0, 3).map(x => x.uz);
      return {
        word: w,
        options: shuffle([w.uz, ...distractors]),
        answer: w.uz,
      };
    });
    setQuestions(qs);
    setQIndex(0);
    setScore(0);
    setCombo(1);
    setCorrectCount(0);
    setSelected(null);
    setTimeLeft(6);
    setPhase('play');
    triggerHaptic('medium');
  };

  useEffect(() => {
    if (phase !== 'play') return;
    setTimeLeft(6);
    setSelected(null);

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 0.1) {
          clearInterval(timerRef.current);
          handleAnswer(null);
          return 0;
        }
        return Math.round((t - 0.1) * 10) / 10;
      });
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [phase, qIndex]);

  const handleAnswer = (choice: string | null) => {
    if (selected !== null) return;
    clearInterval(timerRef.current);
    setSelected(choice || '__timeout__');

    const cur = questions[qIndex];
    const isCorrect = choice === cur.answer;

    if (isCorrect) {
      triggerHaptic('success');
      sfx.correct();
      const gained = Math.round((50 + timeLeft * 10) * combo);
      setScore(s => s + gained);
      setCombo(c => Math.min(2.5, Math.round((c + 0.3) * 10) / 10));
      setCorrectCount(c => c + 1);
    } else {
      triggerHaptic('warning');
      sfx.wrong();
      setCombo(1);
    }

    setTimeout(() => {
      if (qIndex + 1 < questions.length) {
        setQIndex(i => i + 1);
      } else {
        setPhase('result');
        triggerHaptic('success');
        sfx.win(true);
      }
    }, 850);
  };

  useEffect(() => {
    if (phase === 'result' && !awardedRef.current) {
      awardedRef.current = true;
      const xpEarned = blitzXp(correctCount);
      if (xpEarned > 0) onWinXp(xpEarned);
    }
  }, [phase]);

  const curQ = questions[qIndex];

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#182232] to-[#0E1524] border border-amber-500/40 p-5 space-y-4 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {phase === 'intro' && (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-lg shadow-orange-500/30 animate-bounce">
              <Zap className="w-9 h-9 fill-slate-950" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight">30 Soniyalik Blitz Duel</h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                5 ta tezkor so‘z, har biriga 6 soniya vaqt! Qanchalik tez topsangiz, shuncha ko‘p ball va combo olasiz 🔥
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              💎 5 tadan kamida {BLITZ_WIN_MIN_CORRECT} tasini topsangiz yutasiz va {BLITZ_MAX_XP} XP gacha olasiz. Bugun: {blitzLeft} / {BLITZ_DAILY_LIMIT} urinish qoldi.
            </div>
            <button
              type="button"
              onClick={startDuel}
              disabled={blitzLeft <= 0}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-orange-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              <Play className="w-5 h-5 fill-slate-950" /> {blitzLeft <= 0 ? 'Bugungi limit tugadi' : 'Jangni boshlash!'}
            </button>
          </div>
        )}

        {phase === 'play' && curQ && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 flex items-center gap-1">
                <Timer className="w-4 h-4" /> {timeLeft.toFixed(1)}s
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                {qIndex + 1} / {questions.length}
              </span>
              <span className="font-extrabold text-orange-400 tabular-nums">
                {score} ball {combo > 1 && <span className="text-[10px] text-amber-300">({combo}x)</span>}
              </span>
            </div>

            {/* Timer bar */}
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${timeLeft <= 2 ? 'bg-rose-500' : timeLeft <= 4 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${(timeLeft / 6) * 100}%` }}
              />
            </div>

            {/* Word Prompt */}
            <div className="p-5 rounded-2xl bg-[#121B2B] border border-slate-700 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Tarjimasini toping</span>
              <div className="text-3xl font-black text-white tracking-tight">{curQ.word.en}</div>
              <div className="text-xs text-slate-400">{curQ.word.ipa}</div>
            </div>

            {/* Options */}
            <div className="grid gap-2">
              {curQ.options.map((opt, i) => {
                let btnStyle = 'bg-[#151E2E] border-slate-700 text-white hover:border-slate-600';
                if (selected !== null) {
                  if (opt === curQ.answer) {
                    btnStyle = 'bg-emerald-500/25 border-emerald-500 text-emerald-300 font-extrabold';
                  } else if (opt === selected) {
                    btnStyle = 'bg-rose-500/25 border-rose-500 text-rose-300';
                  } else {
                    btnStyle = 'opacity-40 border-slate-800';
                  }
                }
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={selected !== null}
                    onClick={() => handleAnswer(opt)}
                    className={`p-3.5 rounded-2xl border text-sm font-semibold text-left transition-all active:scale-[0.98] ${btnStyle}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div className="text-center space-y-4 py-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/30 animate-bounce">
              <Trophy className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">Ajoyib Natija! ⚡</h3>
              <p className="text-xs text-slate-400 mt-1">30 soniyalik Blitz Duel yakunlandi</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-[#121B2B] border border-slate-800">
                <div className="text-2xl font-black text-amber-400 tabular-nums">{score}</div>
                <div className="text-[11px] text-slate-400">To‘plangan ball</div>
              </div>
              <div className="p-3 rounded-2xl bg-[#121B2B] border border-slate-800">
                <div className="text-2xl font-black text-emerald-400 tabular-nums">{correctCount} / 5</div>
                <div className="text-[11px] text-slate-400">To‘g‘ri javoblar</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-extrabold text-sm flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" /> {blitzXp(correctCount) > 0 ? `🏆 G‘alaba! +${blitzXp(correctCount)} XP balansingizga qo‘shildi` : `Yutish uchun kamida ${BLITZ_WIN_MIN_CORRECT} ta to‘g‘ri javob kerak (XP yo‘q)`}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={startDuel}
                disabled={blitzLeft <= 0}
                className="h-12 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
              >
                <RotateCcw className="w-4 h-4" /> {blitzLeft <= 0 ? 'Limit tugadi' : `Qayta o‘ynash (${blitzLeft})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  shareUrl(
                    getDuelLink('BLITZ'),
                    `⚡ VocaBoost Blitz Duelda ${score} ball to‘pladim! Meni yenga olasanmi? 🚀`
                  );
                }}
                className="h-12 rounded-xl bg-[#1F2B3E] border border-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <Share2 className="w-4 h-4" /> Do‘stni chaqirish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DuelCard: React.FC<{ d: Duel; meId: string; onLeave: () => void }> = ({ d, meId, onLeave }) => {
  const [copied, setCopied] = useState(false);
  const ended = nowMs() >= d.endsAt;
  const m = metricOf(d.metric);
  const link = getDuelLink(d.code);
  const text = `⚔️ VocaBoost'da bellashuvga chaqiraman! ${m.label} bo‘yicha kim kuchli? Kod: ${d.code}`;
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(`${text}\n${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };
  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#1B2433] to-[#121822] border border-slate-800 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-white truncate">{d.title || 'Bellashuv'}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{m.label}</div>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${ended ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
          <Clock className="w-3 h-3" /> {left(d.endsAt - nowMs())}
        </span>
      </div>
      {!ended && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Bellashuv kodi</div>
            <div className="text-2xl font-extrabold tracking-[0.3em] text-amber-400 tabular-nums">{d.code}</div>
          </div>
          <button type="button" onClick={copy} className="h-10 px-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shrink-0">{copied ? <><Check className="w-4 h-4" /> Nusxalandi</> : <><Copy className="w-4 h-4" /> Kodni nusxalash</>}</button>
        </div>
      )}
      <Standings d={d} meId={meId} ended={ended} />
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><Users className="w-3.5 h-3.5" /> {d.players.length} / {d.maxPlayers} ishtirokchi</div>
      {!ended && d.players.length < d.maxPlayers && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { triggerHaptic('light'); shareUrl(link, text); }} className="h-10 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5">
            <Share2 className="w-4 h-4" /> Raqibni chaqirish
          </button>
          <button type="button" onClick={copy} className="h-10 rounded-xl bg-[#1B2433] border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5">
            {copied ? <><Check className="w-4 h-4 text-emerald-400" /> Nusxalandi</> : <><Copy className="w-4 h-4" /> Havolani nusxalash</>}
          </button>
        </div>
      )}
      {ended && (
        <button type="button" onClick={onLeave} className="w-full h-9 rounded-xl bg-[#151C28] border border-slate-800 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5">
          <LogOut className="w-3.5 h-3.5" /> Ro‘yxatdan olib tashlash
        </button>
      )}
    </section>
  );
};

export const DuelTab: React.FC = () => {
  const { duels, createDuel, joinDuel, leaveDuel, accountId, realtimeOn, pendingDuelCode, clearPendingDuel, profile, bank, addXp, blitzLeft, consumeBlitz } = useApp();
  const [blitzOpen, setBlitzOpen] = useState(false);
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<DuelMetric>('xp');
  const [hours, setHours] = useState(72);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const flash = (t: string, ok = false) => {
    setMsg({ t, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  // Taklif havolasi orqali kelgan bo'lsa — kod avtomatik kiritiladi
  useEffect(() => {
    if (pendingDuelCode) setCode(pendingDuelCode);
  }, [pendingDuelCode]);

  const join = async (c = code) => {
    if (busy) return;
    setBusy(true);
    const r = await joinDuel(c);
    setBusy(false);
    if (r.ok) {
      setCode('');
      clearPendingDuel();
      flash('Bellashuvga qo‘shildingiz! Omad 🔥', true);
    } else flash(r.error || 'Xatolik');
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    const c = await createDuel({ title, metric, hours, maxPlayers });
    setBusy(false);
    if (c) {
      setMode('list');
      setTitle('');
      flash(`Bellashuv yaratildi. Kod: ${c} — raqibingizga yuboring`, true);
    } else flash('Yaratib bo‘lmadi. Internetni tekshiring.');
  };

  const active = duels.filter(d => nowMs() < d.endsAt);
  const finished = duels.filter(d => nowMs() >= d.endsAt);

  if (!realtimeOn) {
    return <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-5 text-sm text-slate-400">Raqib bilan bellashuv uchun jonli baza (Firebase) ulangan bo‘lishi kerak.</div>;
  }

  return (
    <div className="space-y-4">
      {blitzOpen && (
        <BlitzDuelModal
          bank={bank}
          blitzLeft={blitzLeft}
          consumeBlitz={consumeBlitz}
          onClose={() => setBlitzOpen(false)}
          onWinXp={xp => {
            addXp(xp);
            flash(`🏆 Blitz Duelda g‘alaba qozondingiz! +${xp} XP qo‘shildi!`, true);
          }}
        />
      )}

      {/* 30-soniyalik Jonli Blitz Duel */}
      <section className="rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/20 to-rose-500/15 border-2 border-amber-500/50 p-4 space-y-3 shadow-lg shadow-amber-500/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shrink-0 shadow-md shadow-orange-500/30">
            <Zap className="w-7 h-7 fill-slate-950 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
              30 Soniyalik Blitz Duel <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-rose-500 text-white">Yangi</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">5 ta tezkor so‘z. G‘alabaga {BLITZ_MAX_XP} XP gacha · bugun {blitzLeft} / {BLITZ_DAILY_LIMIT} urinish qoldi</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            setBlitzOpen(true);
          }}
          disabled={blitzLeft <= 0}
          className="disabled:opacity-50 w-full h-12 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all"
        >
          <Swords className="w-4 h-4 fill-slate-950" /> {blitzLeft <= 0 ? 'Bugungi limit tugadi' : 'Blitz Duelni boshlash ⚡'}
        </button>
      </section>

      {pendingDuelCode && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/40 p-4 space-y-3">
          <div className="text-sm font-bold text-amber-300 flex items-center gap-2"><Swords className="w-4 h-4" /> Sizni bellashuvga chaqirishdi!</div>
          <div className="text-xs text-slate-300">Kod: <b className="tracking-widest">{pendingDuelCode}</b>. {profile.name}, qo‘shilasizmi?</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => join(pendingDuelCode)} className="h-10 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs disabled:opacity-60">Qo‘shilish</button>
            <button type="button" onClick={() => { clearPendingDuel(); setCode(''); }} className="h-10 rounded-xl bg-[#151C28] border border-slate-800 text-xs font-semibold">Keyinroq</button>
          </div>
        </div>
      )}

      {msg && <div className={`rounded-xl p-3 text-xs font-medium border ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>{msg.t}</div>}

      <section className="rounded-2xl bg-[#151C28] border-2 border-amber-500/50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white"><Hash className="w-4 h-4 text-amber-400" /> Kod bilan bellashuvga qo‘shilish</div>
        <p className="text-xs text-slate-400">Raqibingiz sizga <b className="text-slate-200">6 belgili kod</b> (masalan <b className="text-amber-400 tracking-widest">A8FNA8</b>) yuboradi. Uni shu yerga kiriting.</p>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          maxLength={12}
          placeholder="KODNI KIRITING"
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full h-14 px-4 rounded-xl bg-[#0E1524] border-2 border-slate-700 text-center text-2xl font-extrabold tracking-[0.35em] text-white placeholder:text-sm placeholder:tracking-normal placeholder:font-semibold focus:outline-none focus:border-amber-500"
        />
        <button type="button" disabled={busy || code.trim().length < 4} onClick={() => join()} className="w-full h-12 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-sm disabled:opacity-50 active:scale-[0.98] transition-all">
          {busy ? 'Tekshirilmoqda…' : 'Bellashuvga qo‘shilish'}
        </button>
      </section>

      <button type="button" onClick={() => { triggerHaptic('selection'); setMode(mode === 'new' ? 'list' : 'new'); }} className="w-full h-12 rounded-2xl bg-[#1B2433] border border-slate-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
        <Plus className="w-4 h-4 text-amber-400" /> Yangi bellashuv yaratish
      </button>

      {mode === 'new' && (
        <section className="rounded-2xl bg-[#151C28] border border-slate-800 p-4 space-y-3">
          <div className="text-sm font-bold text-white">Yangi bellashuv</div>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={40} placeholder="Nomi (ixtiyoriy), masalan: Do‘stlar ligasi" className="w-full h-11 px-3 rounded-xl bg-[#0E1524] border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500" />
          <div>
            <div className="text-[11px] text-slate-400 mb-1.5">Nima bo‘yicha bellashamiz?</div>
            <div className="grid gap-1.5">
              {METRICS.map(m => (
                <button key={m.id} type="button" onClick={() => setMetric(m.id)} className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-all ${metric === m.id ? 'bg-amber-500/15 border-amber-500/60' : 'bg-[#0E1524] border-slate-800'}`}>
                  <div className="font-bold text-white">{m.label}</div>
                  <div className="text-[11px] text-slate-400">{m.hint}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 mb-1.5">Davomiyligi</div>
            <div className="grid grid-cols-3 gap-1.5">
              {DURATIONS.map(d => (
                <button key={d.h} type="button" onClick={() => setHours(d.h)} className={`h-10 rounded-xl border text-xs font-bold ${hours === d.h ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-[#0E1524] border-slate-800 text-slate-300'}`}>{d.t}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 mb-1.5">Ishtirokchilar soni: <b className="text-white">{maxPlayers}</b></div>
            <input type="range" min={2} max={10} value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
          <button type="button" disabled={busy} onClick={create} className="w-full h-12 rounded-2xl bg-amber-500 text-slate-950 font-extrabold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            <Link2 className="w-4 h-4" /> {busy ? 'Yaratilmoqda…' : 'Yaratish va havola olish'}
          </button>
        </section>
      )}

      {active.length === 0 && finished.length === 0 && mode === 'list' && (
        <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-6 text-center space-y-2">
          <div className="text-4xl">⚔️</div>
          <div className="text-sm font-bold text-white">Raqib bilan bellashing</div>
          <p className="text-xs text-slate-400">Bellashuv yarating, havolani do‘stingizga yuboring — ikkalangiz ham bir-biringizning natijasini jonli ko‘rasiz.</p>
        </div>
      )}

      {active.map(d => <DuelCard key={d.code} d={d} meId={accountId} onLeave={() => leaveDuel(d.code)} />)}
      {finished.length > 0 && <div className="text-xs text-slate-400 font-semibold uppercase px-1 pt-1">Tugagan bellashuvlar</div>}
      {finished.map(d => <DuelCard key={d.code} d={d} meId={accountId} onLeave={() => leaveDuel(d.code)} />)}
    </div>
  );
};
