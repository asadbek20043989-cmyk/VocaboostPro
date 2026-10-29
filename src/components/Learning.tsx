import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Volume2, Mic, Square, X, Sparkles, Check, BookmarkPlus, Loader2, PenLine, Shuffle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SavedWord } from '../types';
import { speakEnglish, isRecognitionAvailable, startListening, compareSpeech, stopSpeaking } from '../services/speech';
import { callAI } from '../services/ai';
import { triggerHaptic } from '../services/telegram';
import { sfx } from '../services/sound';

const Shell: React.FC<{ title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({ title, icon, onClose, children }) => (
  <div className="fixed inset-0 z-[60] bg-[#0B0F17]/97 backdrop-blur-md flex flex-col max-w-xl mx-auto">
    <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-800">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800/70 flex items-center justify-center text-slate-300">
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto p-4">{children}</div>
  </div>
);

const awardedShadow = new Set<string>();

// ---------------- 2. Shadowing ----------------
export const Shadowing: React.FC<{ text: string; onClose: () => void }> = ({ text, onClose }) => {
  const { addXp } = useApp();
  const [listening, setListening] = useState(false);
  const [spoken, setSpoken] = useState('');
  const [result, setResult] = useState<ReturnType<typeof compareSpeech> | null>(null);
  const [err, setErr] = useState('');
  const [xp, setXp] = useState(0);
  const stopRef = useRef<() => void>(() => {});
  const supported = isRecognitionAvailable();

  useEffect(() => () => { stopRef.current(); stopSpeaking(); }, []);

  const start = () => {
    stopSpeaking();
    setErr('');
    setResult(null);
    setSpoken('');
    setListening(true);
    triggerHaptic('medium');
    let last = '';
    stopRef.current = startListening(
      t => {
        last = t;
        setSpoken(t);
      },
      e => {
        setListening(false);
        if (e && e !== 'no-speech' && e !== 'aborted') {
          setErr(e === 'not-allowed' || e === 'service-not-allowed' ? 'Mikrofonga ruxsat bering (sozlamalar).' : 'Ovozni tanib bo‘lmadi, qayta urinib ko‘ring.');
          return;
        }
        if (!last) {
          setErr('Ovoz eshitilmadi. Mikrofonni bosib, aniq o‘qing.');
          return;
        }
        const r = compareSpeech(text, last);
        setResult(r);
        if (r.percent >= 80 && !awardedShadow.has(text)) {
          awardedShadow.add(text);
          setXp(addXp(5));
          triggerHaptic('success');
        }
      }
    );
  };

  const stop = () => stopRef.current();

  return (
    <Shell title="Talaffuz mashqi (Shadowing)" icon={<Mic className="w-4 h-4 text-amber-400" />} onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">1) Gapni tinglang. 2) Mikrofonni bosib, o‘zingiz ingliz tilida o‘qing. To‘g‘ri so‘zlar yashil, xatolari qizil bo‘ladi.</p>
      <div className="p-4 rounded-2xl bg-[#151C28] border border-slate-800 text-base leading-relaxed text-slate-100">
        {result ? (
          result.words.map((w, i) => (
            <span key={i} className={w.ok ? 'text-emerald-400' : 'text-rose-400 underline decoration-rose-500/60'}>
              {w.w}{' '}
            </span>
          ))
        ) : (
          text
        )}
      </div>
      <button type="button" onClick={() => speakEnglish(text, 0.85)} className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#151C28] border border-slate-700 text-amber-300 text-xs font-semibold">
        <Volume2 className="w-4 h-4" /> Avval tinglash
      </button>

      {!supported ? (
        <div className="mt-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">
          Bu qurilma/brauzer ovozni matnga aylantirishni qo‘llab-quvvatlamaydi. Telegram’ni Android’da yoki Chrome/Safari brauzerida ochib ko‘ring.
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={listening ? stop : start}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 ${listening ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`}
          >
            {listening ? <Square className="w-7 h-7 text-white fill-white" /> : <Mic className="w-8 h-8 text-slate-950" />}
          </button>
          <span className="text-xs text-slate-400">{listening ? 'Eshityapman... gapiring' : 'Bosing va o‘qing'}</span>
          {spoken && <p className="text-xs text-slate-500 italic text-center">“{spoken}”</p>}
        </div>
      )}
      {err && <p className="mt-3 text-xs text-amber-300 text-center">{err}</p>}
      {result && (
        <div className="mt-5 p-4 rounded-2xl bg-[#151C28] border border-amber-500/30 text-center">
          <div className={`text-4xl font-extrabold tabular-nums ${result.percent >= 80 ? 'text-emerald-400' : result.percent >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{result.percent}%</div>
          <p className="text-xs text-slate-400 mt-1">{result.percent >= 80 ? 'Ajoyib talaffuz!' : result.percent >= 50 ? 'Yaxshi, yana bir bor urinib ko‘ring' : 'Avval tinglang, so‘ng qayta o‘qing'}</p>
          {xp > 0 && <p className="text-xs text-amber-400 font-bold mt-2">+{xp} XP</p>}
        </div>
      )}
    </Shell>
  );
};

// ---------------- 5. Grammatik rentgen ----------------
interface XRayData {
  translationUz: string;
  grammarUz: string;
  chunks?: { en: string; uz: string }[];
}
export const XRay: React.FC<{ sentence: string; onClose: () => void }> = ({ sentence, onClose }) => {
  const { aiLeft, consumeAi, addWord, isWordSaved, profile } = useApp();
  const [data, setData] = useState<XRayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [, force] = useState(0);

  useEffect(() => {
    if (!consumeAi()) {
      setErr('Bugungi AI limiti tugadi. Ertaga qayta urinib ko‘ring.');
      setLoading(false);
      return;
    }
    callAI<XRayData>('xray', { sentence, level: profile.level })
      .then(setData)
      .catch(e => setErr(e.message || 'AI xatosi'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  return (
    <Shell title="Grammatik rentgen" icon={<Sparkles className="w-4 h-4 text-violet-400" />} onClose={onClose}>
      <div className="p-3 rounded-xl bg-[#151C28] border border-slate-800 text-sm text-slate-100 leading-relaxed">{sentence}</div>
      {loading && (
        <div className="py-10 flex flex-col items-center gap-2 text-slate-400 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" /> Gap tahlil qilinmoqda...
        </div>
      )}
      {err && <p className="mt-4 text-xs text-rose-300">{err}</p>}
      {data && (
        <div className="mt-4 space-y-3">
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-1">To‘liq ma’nosi</div>
            <p className="text-sm text-emerald-100">🇺🇿 {data.translationUz}</p>
          </div>
          <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-800/40">
            <div className="text-[10px] uppercase tracking-wider text-violet-300 font-bold mb-1">Grammatika</div>
            <p className="text-sm text-violet-100 leading-relaxed">{data.grammarUz}</p>
          </div>
          {!!data.chunks?.length && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Foydali iboralar (chunks)</div>
              {data.chunks.map((c, i) => {
                const saved = isWordSaved(c.en);
                return (
                  <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#151C28] border border-slate-800">
                    <div>
                      <div className="text-sm font-bold text-amber-300">{c.en}</div>
                      <div className="text-xs text-slate-400">{c.uz}</div>
                    </div>
                    <button
                      type="button"
                      disabled={saved}
                      onClick={() => {
                        addWord({ word: c.en, ipa: '', uzbek: c.uz, partOfSpeech: 'ibora', contextSentence: sentence, level: profile.level });
                        force(n => n + 1);
                      }}
                      className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${saved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500 text-slate-950'}`}
                    >
                      {saved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-slate-600 text-right">Bugun AI so‘rovlari qoldi: {aiLeft}</p>
        </div>
      )}
    </Shell>
  );
};

// ---------------- 1. Cloze test ----------------
const FALLBACK = ['important', 'decide', 'travel', 'quickly', 'before', 'remember', 'between', 'because', 'family', 'always'];
function shuffle<T>(a: T[]): T[] {
  return [...a].sort(() => Math.random() - 0.5);
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const ClozeTest: React.FC<{ words: SavedWord[]; onClose: () => void }> = ({ words, onClose }) => {
  const { savedWords, markWordReviewed } = useApp();
  const questions = useMemo(() => {
    const out: { w: SavedWord; sentence: string; options: string[] }[] = [];
    shuffle<SavedWord>(words).forEach((w: SavedWord) => {
      if (!w.contextSentence || w.word.includes(' ')) return;
      const re = new RegExp(`\\b${esc(w.word)}\\w*`, 'i');
      const m = w.contextSentence.match(re);
      if (!m) return;
      const sentence = w.contextSentence.replace(re, '_____');
      const pool = shuffle([...savedWords.filter(x => x.id !== w.id && !x.word.includes(' ')).map(x => x.word), ...FALLBACK]).filter(x => x.toLowerCase() !== w.word.toLowerCase());
      const answer = m[0];
      out.push({ w, sentence, options: shuffle([answer, ...pool.slice(0, 3)]) });
    });
    return out.slice(0, 10);
    // eslint-disable-next-line
  }, []);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const q = questions[i];

  if (!questions.length)
    return (
      <Shell title="Gapni to‘ldiring (Cloze)" icon={<PenLine className="w-4 h-4 text-amber-400" />} onClose={onClose}>
        <p className="text-sm text-slate-400 text-center py-10">Kontekstli so‘zlar yo‘q. Kitob o‘qiyotganda so‘zni saqlasangiz, u qatnashgan gap ham saqlanadi va shu yerda chiqadi.</p>
      </Shell>
    );

  const answerOf = (qq: (typeof questions)[number]) => qq.w.contextSentence!.match(new RegExp(`\\b${esc(qq.w.word)}\\w*`, 'i'))![0];

  const pick = (opt: string) => {
    if (picked) return;
    const ok = opt === answerOf(q);
    setPicked(opt);
    if (ok) setScore(s => s + 1);
    if (ok) sfx.correct();
    else sfx.wrong();
    markWordReviewed(q.w.id, ok);
  };

  if (i >= questions.length)
    return (
      <Shell title="Natija" icon={<PenLine className="w-4 h-4 text-amber-400" />} onClose={onClose}>
        <div className="text-center py-10 space-y-3">
          <div className="text-5xl font-extrabold text-amber-400">{score}/{questions.length}</div>
          <p className="text-sm text-slate-300">{score === questions.length ? 'Mukammal!' : 'Yaxshi natija, takrorlashda davom eting!'}</p>
          <button type="button" onClick={onClose} className="px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm">Yopish</button>
        </div>
      </Shell>
    );

  return (
    <Shell title={`Gapni to‘ldiring · ${i + 1}/${questions.length}`} icon={<PenLine className="w-4 h-4 text-amber-400" />} onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Siz o‘qigan kitobdagi gap. Bo‘sh joyga mos so‘zni tanlang.</p>
      <div className="p-4 rounded-2xl bg-[#151C28] border border-slate-800 text-lg leading-relaxed text-white">“{q.sentence}”</div>
      <div className="mt-4 space-y-2.5">
        {q.options.map(o => {
          const right = o === answerOf(q);
          const cls = !picked ? 'bg-[#151C28] border-slate-800 text-slate-200' : right ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300' : picked === o ? 'bg-rose-500/15 border-rose-500/60 text-rose-300' : 'bg-[#151C28] border-slate-800 text-slate-500';
          return (
            <button key={o} type="button" onClick={() => pick(o)} className={`w-full text-left p-3.5 rounded-xl border text-sm font-medium ${cls}`}>
              {o}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-400">{q.w.word} — <span className="text-emerald-300">{q.w.uzbek}</span></p>
          <button type="button" onClick={() => { setPicked(null); setI(n => n + 1); }} className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm">Keyingisi</button>
        </div>
      )}
    </Shell>
  );
};

// ---------------- 4. My Vocab Story ----------------
export const VocabStory: React.FC<{ words: SavedWord[]; onClose: () => void }> = ({ words, onClose }) => {
  const { aiLeft, consumeAi, profile } = useApp();
  const chosen = useMemo(() => [...words.filter(w => !w.mastered), ...words.filter(w => w.mastered)].slice(0, 12), [words]);
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<{ title: string; titleUz?: string; text: string; translationUz?: string } | null>(null);
  const [showUz, setShowUz] = useState(false);
  const [err, setErr] = useState('');

  const gen = async () => {
    if (!consumeAi()) return setErr('Bugungi AI limiti tugadi.');
    setLoading(true);
    setErr('');
    try {
      const r = await callAI<{ title: string; titleUz?: string; text: string; translationUz?: string }>('vocabStory', { words: chosen.map(w => w.word), level: profile.level });
      setStory(r);
      setShowUz(false);
    } catch (e: any) {
      setErr(e.message || 'AI xatosi');
    } finally {
      setLoading(false);
    }
  };

  const render = (t: string) =>
    t.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') ? <strong key={i} className="text-amber-300 font-bold underline decoration-amber-400/50">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
    );

  return (
    <Shell title="Bugungi so‘zlar hikoyasi (AI)" icon={<Sparkles className="w-4 h-4 text-amber-400" />} onClose={onClose}>
      {!story && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
            ✨ Sun&apos;iy intellekt siz o&apos;rgangan {chosen.length} ta so&apos;zdan foydalanib qiziqarli mini-hikoya yaratadi. So&apos;zlarni jonli kontekstda o&apos;qib, ularning qo&apos;llanishini mustahkamlang!
          </div>
          <div className="flex flex-wrap gap-1.5">
            {chosen.map(w => (
              <span key={w.id} className="px-2 py-1 rounded-lg bg-[#151E2E] border border-slate-700 text-amber-300 text-xs font-semibold">
                {w.word} <span className="text-[10px] text-slate-400">({w.uzbek})</span>
              </span>
            ))}
          </div>
          <button type="button" disabled={loading || chosen.length < 3} onClick={gen} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 disabled:opacity-40 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 fill-slate-950" />} Hikoya yaratish
          </button>
          {chosen.length < 3 && <p className="text-xs text-rose-300">Kamida 3 ta so‘z o‘rganilgan bo‘lishi kerak.</p>}
          {err && <p className="text-xs text-rose-300">{err}</p>}
          <p className="text-[11px] text-slate-500 text-center">Bugun qolgan AI so‘rovlari: {aiLeft}</p>
        </div>
      )}
      {story && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-extrabold text-white">{story.title}</h4>
            {story.titleUz && <div className="text-xs text-amber-400 font-medium">{story.titleUz}</div>}
          </div>

          <div className="p-4 rounded-2xl bg-[#121B2A] border border-slate-800 text-base text-slate-200 leading-loose whitespace-pre-line">
            {render(story.text)}
          </div>

          {story.translationUz && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowUz(!showUz)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
              >
                <span>{showUz ? '▲ O‘zbekcha tarjimani yashirish' : '▼ 🇺🇿 O‘zbekcha ma’nosini ko‘rish'}</span>
              </button>
              {showUz && (
                <div className="p-3.5 rounded-2xl bg-[#0E1524] border border-slate-800 text-xs text-slate-300 leading-relaxed italic">
                  {story.translationUz}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => speakEnglish(story.text.replace(/\*\*/g, ''))} className="flex-1 py-3 rounded-xl bg-[#151C28] border border-slate-700 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Volume2 className="w-4 h-4" /> Hikoyani tinglash
            </button>
            <button type="button" onClick={() => setStory(null)} className="flex-1 py-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold active:scale-95 transition-all">
              Yangi hikoya
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
};

// ---------------- 6. Aktiv yozish ----------------
export const WritingPractice: React.FC<{ words: SavedWord[]; onClose: () => void }> = ({ words, onClose }) => {
  const { aiLeft, consumeAi, addXp, markWritingDone, profile } = useApp();
  const pickWord = () => words[Math.floor(Math.random() * words.length)];
  const [word, setWord] = useState<SavedWord>(pickWord);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; corrected: string; feedbackUz: string } | null>(null);
  const [xp, setXp] = useState(0);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (text.trim().split(/\s+/).length < 3) return setErr('Kamida 3 so‘zdan iborat gap yozing.');
    if (!consumeAi()) return setErr('Bugungi AI limiti tugadi.');
    setLoading(true);
    setErr('');
    try {
      const r = await callAI<{ ok: boolean; corrected: string; feedbackUz: string }>('checkSentence', { word: word.word, sentence: text.trim(), level: profile.level });
      setRes(r);
      if (r.ok) sfx.correct();
      else sfx.wrong();
      if (r.ok && new RegExp(`\\b${esc(word.word)}`, 'i').test(text) && markWritingDone()) setXp(addXp(5));
    } catch (e: any) {
      setErr(e.message || 'AI xatosi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell title="Yozma mashq" icon={<PenLine className="w-4 h-4 text-amber-400" />} onClose={onClose}>
      <p className="text-xs text-slate-400">Quyidagi so‘z bilan o‘zingiz 1 ta ingliz tilida gap yozing:</p>
      <div className="mt-3 flex items-center justify-between p-4 rounded-2xl bg-[#151C28] border border-amber-500/30">
        <div>
          <div className="text-2xl font-bold text-amber-400">{word.word}</div>
          <div className="text-xs text-slate-400">{word.uzbek}</div>
        </div>
        <button type="button" onClick={() => { setWord(pickWord()); setRes(null); setText(''); setXp(0); }} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300"><Shuffle className="w-4 h-4" /></button>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Write your sentence here..." className="mt-3 w-full bg-[#151C28] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500" />
      <button type="button" disabled={loading} onClick={submit} className="mt-3 w-full py-3.5 rounded-xl bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center justify-center gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Tekshirish (AI) · +5 XP
      </button>
      {err && <p className="mt-3 text-xs text-rose-300">{err}</p>}
      {res && (
        <div className={`mt-4 p-4 rounded-2xl border ${res.ok ? 'bg-emerald-950/30 border-emerald-700/50' : 'bg-amber-950/20 border-amber-700/40'}`}>
          <div className={`text-sm font-bold ${res.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{res.ok ? '✅ To‘g‘ri!' : '✍️ Tuzatilgan variant'}</div>
          {!res.ok && <p className="text-sm text-white mt-1">{res.corrected}</p>}
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">{res.feedbackUz}</p>
          {xp > 0 && <p className="text-xs text-amber-400 font-bold mt-2">+{xp} XP</p>}
        </div>
      )}
      <p className="mt-4 text-[10px] text-slate-600 text-right">Bugun AI so‘rovlari qoldi: {aiLeft}</p>
    </Shell>
  );
};
