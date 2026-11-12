import React, { useState } from 'react';
import { X, Check, Send, Gift, ChevronLeft, ChevronRight, PartyPopper, PenLine } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic, getTelegramWebApp } from '../services/telegram';

interface Question {
  id: string;
  text: string;
  type: 'choice' | 'text';
  options?: string[];
}

export interface SurveyData {
  id: string;
  title: string;
  desc?: string;
  rewardXp?: number;
  rewardCoins?: number;
  questions: Question[];
}

interface SurveyModalProps {
  survey: SurveyData;
  onClose: () => void;
  onCompleted?: () => void;
}

const ACCENTS = ['#38BDF8', '#A78BFA', '#F472B6', '#FBBF24', '#34D399', '#FB923C'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const SurveyModal: React.FC<SurveyModalProps> = ({ survey, onClose, onCompleted }) => {
  const { profile, accountId, claimGrants } = useApp();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const qs = survey.questions || [];
  const total = qs.length;
  const q = qs[step];
  const last = step >= total - 1;
  const accent = ACCENTS[step % ACCENTS.length];
  const hasReward = (survey.rewardXp || 0) > 0 || (survey.rewardCoins || 0) > 0;
  const answered = qs.filter(x => (answers[x.id] || '').trim()).length;

  const handleClose = () => {
    if (done && onCompleted) onCompleted();
    onClose();
  };

  const go = (d: 1 | -1) => {
    triggerHaptic('selection');
    setDir(d);
    setStep(s => Math.min(total - 1, Math.max(0, s + d)));
  };

  const pick = (qId: string, val: string, autoNext: boolean) => {
    triggerHaptic('selection');
    setAnswers(prev => ({ ...prev, [qId]: val }));
    if (autoNext && !last) setTimeout(() => go(1), 280);
  };

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/fn/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submitSurvey',
          surveyId: survey.id,
          uid: accountId,
          initData: getTelegramWebApp()?.initData || '',
          name: profile.name,
          username: profile.username || '',
          answers,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.already) {
        try { localStorage.setItem(`vb_survey_done_${survey.id}`, '1'); } catch { /* ignore */ }
      }
      if (!res.ok) throw new Error(data.error || 'Xatolik yuz berdi');
      triggerHaptic('success');
      setDone(true);
      try { localStorage.setItem(`vb_survey_done_${survey.id}`, '1'); } catch { /* ignore */ }
      setTimeout(() => { claimGrants(); }, 500);
    } catch (e: any) {
      setErr(e.message || 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="vb-sv relative w-full max-w-md rounded-[28px] shadow-2xl max-h-[92vh] overflow-hidden flex flex-col" style={{ ['--ac' as any]: done ? '#34D399' : accent }}>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Yopish"
          className="absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-full bg-black/30 border border-white/15 text-slate-200 hover:text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {done ? (
          <div className="relative text-center px-6 py-12 space-y-4">
            <div className="vb-rate-burst" aria-hidden>
              {['🎉', '✨', '🎊', '⭐', '💙', '🎉'].map((e, i) => <span key={i} style={{ ['--i' as any]: i }}>{e}</span>)}
            </div>
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-emerald-300 to-teal-500 text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/30 -rotate-3">
              <PartyPopper className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-white">So&apos;rovnoma qabul qilindi!</h3>
            <p className="text-sm text-slate-300 leading-relaxed max-w-xs mx-auto">Qimmatli fikringiz va ajratgan vaqtingiz uchun minnatdormiz!</p>
            {hasReward && (
              <div className="vb-sv-ticket mx-auto">
                <Gift className="w-4 h-4" /> Bonusingiz hisobingizga qo&apos;shildi!
              </div>
            )}
            <button type="button" onClick={handleClose} className="px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-extrabold text-sm active:scale-95 transition-transform">
              Yopish
            </button>
          </div>
        ) : total === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Savollar topilmadi.</div>
        ) : (
          <>
            {/* Sarlavha */}
            <div className="vb-sv-head px-5 pt-5 pb-4">
              <div className="flex items-center gap-2 pr-10">
                <span className="vb-sv-badge">📋 So&apos;rovnoma</span>
                {hasReward && (
                  <span className="vb-sv-ticket">
                    <Gift className="w-3.5 h-3.5" />
                    {survey.rewardXp ? `+${survey.rewardXp} XP` : ''}{survey.rewardXp && survey.rewardCoins ? ' · ' : ''}{survey.rewardCoins ? `+${survey.rewardCoins} 🪙` : ''}
                  </span>
                )}
              </div>
              <h3 className="mt-2.5 text-xl font-black text-white leading-tight">{survey.title}</h3>
              {survey.desc && step === 0 && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{survey.desc}</p>}

              {/* Progress segmentlari */}
              <div className="mt-3.5 flex gap-1.5" aria-label={`${step + 1} / ${total}`}>
                {qs.map((x, i) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => { setDir(i > step ? 1 : -1); setStep(i); }}
                    className="vb-sv-seg"
                    data-state={i < step ? 'done' : i === step ? 'now' : 'todo'}
                    data-ans={(answers[x.id] || '').trim() ? '1' : '0'}
                    aria-label={`Savol ${i + 1}`}
                  />
                ))}
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-slate-400 tabular-nums">Savol {step + 1} / {total} · javob berildi: {answered}</div>
            </div>

            {/* Savol kartasi */}
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <div key={step} className={dir === 1 ? 'vb-sv-in-r' : 'vb-sv-in-l'}>
                <div className="vb-sv-q">
                  <span className="vb-sv-num">{step + 1}</span>
                  <span className="text-[15px] font-extrabold text-white leading-snug">{q.text}</span>
                </div>

                {q.type === 'choice' && Array.isArray(q.options) && q.options.length > 0 ? (
                  <div className="grid gap-2 mt-3">
                    {q.options.map((opt, i) => {
                      const on = answers[q.id] === opt;
                      return (
                        <button key={opt + i} type="button" onClick={() => pick(q.id, opt, true)} className={`vb-sv-opt ${on ? 'is-on' : ''}`}>
                          <span className="vb-sv-letter">{on ? <Check className="w-4 h-4" strokeWidth={3} /> : LETTERS[i] || i + 1}</span>
                          <span className="flex-1 text-left text-[13px] font-bold">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="vb-sv-text">
                      <PenLine className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
                      <textarea
                        rows={5}
                        value={answers[q.id] || ''}
                        maxLength={1000}
                        onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Fikringiz, taklif yoki shikoyatingizni yozing..."
                        className="flex-1 bg-transparent text-[13px] text-white placeholder-slate-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pastki boshqaruv */}
            <div className="px-4 pt-3 pb-4 space-y-2">
              {err && <div className="text-xs text-rose-400 font-medium text-center">{err}</div>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  disabled={step === 0}
                  aria-label="Orqaga"
                  className="h-12 w-12 shrink-0 rounded-2xl bg-white/5 border border-white/10 text-slate-300 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {last ? (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="flex-1 h-12 rounded-2xl text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(90deg,#34D399,#38BDF8)' }}
                  >
                    {busy ? 'Yuborilmoqda...' : <><Send className="w-4 h-4" /> Javoblarni yuborish</>}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="flex-1 h-12 rounded-2xl text-slate-950 font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-lg active:scale-[0.98] transition-all"
                    style={{ background: `linear-gradient(90deg,${accent},#fff8)` }}
                  >
                    {(answers[q.id] || '').trim() ? 'Keyingisi' : "O'tkazib yuborish"} <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
