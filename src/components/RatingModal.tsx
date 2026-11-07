import React, { useState } from 'react';
import { Star, X, Send, Sparkles, MessageSquareHeart, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic, getTelegramWebApp } from '../services/telegram';

interface RatingModalProps {
  onClose: () => void;
}

const CRITERIA = [
  { id: 'vocab', label: "Lug'atlar va talaffuz sifati" },
  { id: 'games', label: "O'yinlar va qiziqarlilik" },
  { id: 'srs', label: "Intervalli takrorlash tizimi (SRS)" },
  { id: 'design', label: "Ilova tezligi va interfeysi" },
];

const STAR_LABELS: Record<number, { text: string; emoji: string }> = {
  1: { text: "Yomon — kamchiliklar ko'p", emoji: '😞' },
  2: { text: "Qoniqarsiz — yaxshilash kerak", emoji: '😕' },
  3: { text: "O'rtacha — yomon emas", emoji: '🙂' },
  4: { text: "Yaxshi — menga yoqmoqda", emoji: '😊' },
  5: { text: "A'lo darajada — juda zo'r!", emoji: '😍' },
};

export const RatingModal: React.FC<RatingModalProps> = ({ onClose }) => {
  const { profile, accountId } = useApp();
  const [stars, setStars] = useState<number>(5);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({
    vocab: 5,
    games: 5,
    srs: 5,
    design: 5,
  });
  const [likedText, setLikedText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState('');

  const activeStar = hoverStars ?? stars;
  const starInfo = STAR_LABELS[activeStar] || STAR_LABELS[5];

  const handleScoreCriterion = (id: string, score: number) => {
    triggerHaptic('selection');
    setCriteriaScores(prev => ({ ...prev, [id]: score }));
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
          action: 'submitRating',
          uid: accountId,
          initData: getTelegramWebApp()?.initData || '',
          name: profile.name,
          username: profile.username || '',
          rating: stars,
          criteria: criteriaScores,
          liked: likedText.trim(),
          text: feedbackText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Xatolik yuz berdi');
      triggerHaptic('success');
      setSubmitted(true);
    } catch (e: any) {
      setErr(e.message || 'Xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#111726] border border-amber-500/30 rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-white">Baholashingiz qabul qilindi!</h3>
            <p className="text-sm text-slate-300 leading-relaxed max-w-xs mx-auto">
              Sizning xolis bahoyingiz va takliflaringiz botimizni yanada mukammal qilishga yordam beradi. Rahmat! ❤️
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-extrabold text-sm active:scale-95 transition-transform"
            >
              Yopish
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                <MessageSquareHeart className="w-3.5 h-3.5" /> Botni baholash
              </div>
              <h3 className="text-xl font-extrabold text-white">Fikringiz biz uchun juda muhim!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Istalgan vaqtda botni baholang yoki taklif va shikoyatlaringizni yozib qoldiring.
              </p>
            </div>

            {/* 5-Yulduzli asosiy baholash */}
            <div className="bg-[#0B0F17] rounded-2xl p-4 border border-slate-800 text-center space-y-2">
              <div className="text-xs font-semibold text-slate-300">Umumiy bahoyingiz:</div>
              <div className="flex items-center justify-center gap-2 py-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      setStars(n);
                    }}
                    onMouseEnter={() => setHoverStars(n)}
                    onMouseLeave={() => setHoverStars(null)}
                    className="p-1 focus:outline-none transition-transform hover:scale-125 active:scale-90"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        n <= activeStar
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <div className="text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5">
                <span>{starInfo.emoji}</span>
                <span>{starInfo.text}</span>
              </div>
            </div>

            {/* Kriteriyalar bo'yicha qisqa baholash */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-300">Qisqa mezonlar bo&apos;yicha baholang:</div>
              {CRITERIA.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0F17]/70 border border-slate-800/80 text-xs"
                >
                  <span className="text-slate-300 font-medium">{c.label}</span>
                  <div className="flex gap-1 shrink-0">
                    {[1, 2, 3, 4, 5].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleScoreCriterion(c.id, val)}
                        className={`w-6 h-6 rounded-md font-bold text-[11px] transition-all ${
                          criteriaScores[c.id] === val
                            ? 'bg-amber-500 text-slate-950 scale-105 shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Yozma savol: Taklif va shikoyatlar */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Sizga nima ko&apos;proq yoqdi? (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={likedText}
                  onChange={e => setLikedText(e.target.value)}
                  placeholder="Masalan: ovozlar sifati, so'zlarning oson yodlanishi..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Taklif va shikoyatlaringiz bormi? (erkin yozing)
                </label>
                <textarea
                  rows={3}
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Ilovani yaxshilash bo'yicha har qanday fikr, xatolik yoki taklifingizni qoldiring..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F17] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>
            </div>

            {err && <div className="text-xs text-rose-400 font-medium text-center">{err}</div>}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {busy ? (
                'Yuborilmoqda...'
              ) : (
                <>
                  <Send className="w-4 h-4" /> Bahoni yuborish
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
