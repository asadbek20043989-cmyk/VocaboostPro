import React, { useState } from 'react';
import { ClipboardList, X, Check, Send, Sparkles, CheckCircle2 } from 'lucide-react';
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

export const SurveyModal: React.FC<SurveyModalProps> = ({ survey, onClose, onCompleted }) => {
  const { profile, accountId, claimGrants } = useApp();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const handleClose = () => {
    if (done && onCompleted) onCompleted();
    onClose();
  };

  const handlePickChoice = (qId: string, val: string) => {
    triggerHaptic('selection');
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleTextAnswer = (qId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        try {
          localStorage.setItem(`vb_survey_done_${survey.id}`, '1');
        } catch {
          /* ignore */
        }
      }
      if (!res.ok) throw new Error(data.error || 'Xatolik yuz berdi');

      triggerHaptic('success');
      setDone(true);
      try {
        localStorage.setItem(`vb_survey_done_${survey.id}`, '1');
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        claimGrants();
      }, 500);
    } catch (e: any) {
      setErr(e.message || 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#111726] border border-cyan-500/30 rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {done ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-white">So&apos;rovnoma qabul qilindi!</h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
              Qimmatli fikringiz va ajratgan vaqtingiz uchun minnatdormiz!
              {((survey.rewardXp || 0) > 0 || (survey.rewardCoins || 0) > 0) && (
                <span className="block mt-2 font-bold text-amber-300">
                  🎁 Bonusingiz hisobingizga qo&apos;shildi!
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 rounded-2xl bg-cyan-500 text-slate-950 font-extrabold text-sm active:scale-95 transition-transform"
            >
              Yopish
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold uppercase tracking-wider mb-1.5">
                <ClipboardList className="w-3.5 h-3.5" /> So&apos;rovnoma
              </div>
              <h3 className="text-lg font-black text-white leading-tight">{survey.title}</h3>
              {survey.desc && <p className="text-xs text-slate-400 mt-1">{survey.desc}</p>}
              {((survey.rewardXp || 0) > 0 || (survey.rewardCoins || 0) > 0) && (
                <div className="mt-2 text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Ishtirok bonusi: {survey.rewardXp ? `+${survey.rewardXp} XP ` : ''}
                  {survey.rewardCoins ? `+${survey.rewardCoins} tanga` : ''}
                </div>
              )}
            </div>

            {/* Savollar ro'yxati */}
            <div className="space-y-4 divide-y divide-slate-800/80 pt-2">
              {survey.questions.map((q, idx) => (
                <div key={q.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="text-xs font-bold text-white flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{q.text}</span>
                  </div>

                  {q.type === 'choice' && Array.isArray(q.options) && q.options.length > 0 ? (
                    <div className="grid gap-1.5 pl-5">
                      {q.options.map(opt => {
                        const picked = answers[q.id] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handlePickChoice(q.id, opt)}
                            className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between transition-all ${
                              picked
                                ? 'bg-cyan-500/20 border-cyan-400 text-white'
                                : 'bg-[#0B0F17] border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span>{opt}</span>
                            {picked && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pl-5">
                      <textarea
                        rows={2}
                        value={answers[q.id] || ''}
                        onChange={e => handleTextAnswer(q.id, e.target.value)}
                        placeholder="Fikringiz, taklif yoki shikoyatingizni yozing..."
                        className="w-full px-3 py-2 rounded-xl bg-[#0B0F17] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors resize-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {err && <div className="text-xs text-rose-400 font-medium text-center">{err}</div>}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {busy ? (
                'Yuborilmoqda...'
              ) : (
                <>
                  <Send className="w-4 h-4" /> Javoblarni yuborish
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
