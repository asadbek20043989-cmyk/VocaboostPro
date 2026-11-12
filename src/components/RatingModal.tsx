import React, { useState } from 'react';
import { X, Send, Heart, MessageCircleHeart, Lightbulb, AlertTriangle, Bug, PartyPopper } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic, getTelegramWebApp } from '../services/telegram';
import { t as tt } from '../services/i18n';

interface RatingModalProps {
  onClose: () => void;
}

const STAR_LABELS: Record<number, { text: string; emoji: string; color: string }> = {
  1: { text: "Yomon — kamchiliklar ko'p", emoji: '😞', color: '#F87171' },
  2: { text: 'Qoniqarsiz — yaxshilash kerak', emoji: '😕', color: '#FB923C' },
  3: { text: "O'rtacha — yomon emas", emoji: '🙂', color: '#FACC15' },
  4: { text: 'Yaxshi — menga yoqmoqda', emoji: '😊', color: '#A3E635' },
  5: { text: "A'lo darajada — juda zo'r!", emoji: '😍', color: '#FBBF24' },
};

// "Sizga nima yoqdi?" uchun tezkor teglar — bosilsa matnga qo'shiladi
const LIKE_TAGS = ['🎧 Ovozlar', "🎮 O'yinlar", '🧠 Yodlash usuli', '🏆 Reyting', '🎨 Dizayn', '🎁 Sovg‘alar'];

const KINDS = [
  { id: 'taklif', label: 'Taklif', Icon: Lightbulb, color: '#38BDF8' },
  { id: 'shikoyat', label: 'Shikoyat', Icon: AlertTriangle, color: '#FB923C' },
  { id: 'xatolik', label: 'Xatolik', Icon: Bug, color: '#F472B6' },
] as const;

export const RatingModal: React.FC<RatingModalProps> = ({ onClose }) => {
  const { profile, accountId } = useApp();
  const [stars, setStars] = useState<number>(5);
  const [likedText, setLikedText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('taklif');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState('');

  const info = STAR_LABELS[stars] || STAR_LABELS[5];
  const kindInfo = KINDS.find(k => k.id === kind)!;

  const toggleTag = (tag: string) => {
    triggerHaptic('selection');
    setLikedText(prev => {
      if (prev.includes(tag)) return prev.replace(tag, '').replace(/\s*,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '');
      return prev.trim() ? `${prev.trim().replace(/,$/, '')}, ${tag}` : tag;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const body = feedbackText.trim();
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
          liked: likedText.trim(),
          text: body ? `[${kindInfo.label}] ${body}` : '',
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
      <div className="vb-rate relative w-full max-w-md rounded-[28px] shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-full bg-black/30 border border-white/15 text-slate-200 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="relative text-center px-6 py-12 space-y-4">
            <div className="vb-rate-burst" aria-hidden>
              {['🎉', '⭐', '💛', '✨', '🎊', '⭐'].map((e, i) => (
                <span key={i} style={{ ['--i' as any]: i }}>{e}</span>
              ))}
            </div>
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 rotate-3">
              <PartyPopper className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-white">{tt('Baholashingiz qabul qilindi!')}</h3>
            <p className="text-sm text-slate-300 leading-relaxed max-w-xs mx-auto">
              Fikringiz ilovani yanada mukammal qilishga yordam beradi. Rahmat! ❤️
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-7 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-extrabold text-sm active:scale-95 transition-transform shadow-lg shadow-amber-500/25"
            >
              {tt('Yopish')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="relative">
            {/* Yuqori qism: sarlavha + yulduzlar */}
            <div className="vb-rate-hero px-5 pt-6 pb-5 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider mb-2.5">
                <MessageCircleHeart className="w-3.5 h-3.5" /> {tt('Botni baholash')}
              </div>
              <h3 className="text-[22px] leading-tight font-black text-white">{tt('Fikringiz biz uchun juda muhim!')}</h3>

              <div className="vb-rate-face" key={stars} style={{ ['--c' as any]: info.color }}>{info.emoji}</div>

              <div className="flex items-center justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} yulduz`}
                    onClick={() => {
                      triggerHaptic('medium');
                      setStars(n);
                    }}
                    className="vb-rate-star p-0.5 focus:outline-none active:scale-90 transition-transform"
                    data-on={n <= stars ? '1' : '0'}
                    style={{ ['--d' as any]: `${n * 40}ms` }}
                  >
                    <svg viewBox="0 0 24 24" className="w-9 h-9">
                      <path
                        d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z"
                        strokeLinejoin="round"
                        strokeWidth="1.4"
                      />
                    </svg>
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[13px] font-extrabold" style={{ color: info.color }}>{info.text}</div>
            </div>

            <div className="px-4 pb-5 pt-1 space-y-4">
              {/* Sizga nima yoqdi? */}
              <section className="vb-rate-card" style={{ ['--ac' as any]: '#F472B6' }}>
                <header className="flex items-center gap-2.5 mb-2.5">
                  <span className="vb-rate-ico" style={{ background: 'linear-gradient(135deg,#F472B6,#E11D48)' }}>
                    <Heart className="w-4 h-4 fill-white text-white" />
                  </span>
                  <div className="min-w-0">
                    <label htmlFor="vb-liked" className="block text-[13px] font-extrabold text-white leading-tight">Sizga nima ko&apos;proq yoqdi?</label>
                    <span className="text-[11px] text-slate-400">Bir-ikki so&apos;z bilan ham bo&apos;ladi</span>
                  </div>
                </header>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {LIKE_TAGS.map(tag => {
                    const on = likedText.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`vb-rate-chip ${on ? 'is-on' : ''}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="vb-liked"
                  type="text"
                  value={likedText}
                  maxLength={300}
                  onChange={e => setLikedText(e.target.value)}
                  placeholder="Masalan: ovozlar sifati, so'zlarning oson yodlanishi..."
                  className="vb-rate-input"
                />
              </section>

              {/* Taklif va shikoyatlar */}
              <section className="vb-rate-card" style={{ ['--ac' as any]: kindInfo.color }}>
                <header className="flex items-center gap-2.5 mb-2.5">
                  <span className="vb-rate-ico" style={{ background: `linear-gradient(135deg,${kindInfo.color},#7C3AED)` }}>
                    <kindInfo.Icon className="w-4 h-4 text-white" />
                  </span>
                  <div className="min-w-0">
                    <label htmlFor="vb-fb" className="block text-[13px] font-extrabold text-white leading-tight">Taklif va shikoyatlaringiz bormi?</label>
                    <span className="text-[11px] text-slate-400">Erkin yozing — barchasini o&apos;qiymiz</span>
                  </div>
                </header>
                <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                  {KINDS.map(k => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setKind(k.id);
                      }}
                      className={`vb-rate-kind ${kind === k.id ? 'is-on' : ''}`}
                      style={{ ['--kc' as any]: k.color }}
                    >
                      <k.Icon className="w-3.5 h-3.5" /> {k.label}
                    </button>
                  ))}
                </div>
                <textarea
                  id="vb-fb"
                  rows={4}
                  value={feedbackText}
                  maxLength={1000}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Ilovani yaxshilash bo'yicha har qanday fikr, xatolik yoki taklifingizni qoldiring..."
                  className="vb-rate-input resize-none"
                />
                <div className="mt-1 text-right text-[10px] text-slate-500 tabular-nums">{feedbackText.length} / 1000</div>
              </section>

              {err && <div className="text-xs text-rose-400 font-medium text-center">{err}</div>}

              <button
                type="submit"
                disabled={busy}
                className="w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {busy ? (
                  'Yuborilmoqda...'
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Bahoni yuborish
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
