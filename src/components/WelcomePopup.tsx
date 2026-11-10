import React, { useEffect, useMemo, useRef } from 'react';
import { Logo } from './Brand';
import { sfx } from '../services/sound';
import { getTelegramUserData, triggerHaptic } from '../services/telegram';
import { t as tt } from '../services/i18n';

const KEY = 'vb_welcome_seen_v1';

export const welcomeSeen = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
export const markWelcomeSeen = (): void => {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
};

const COLORS = ['#FBBF24', '#38BDF8', '#F472B6', '#34D399', '#A78BFA', '#FB923C'];

/**
 * Ilovaga BIRINCHI marta kirgan foydalanuvchiga iliq kutib olish oynasi: logotip, tabrik matni, konfetti
 * va ~2 soniyalik tantanali tovush. Faqat bir marta ko'rsatiladi (qurilmada eslab qolinadi).
 */
export const WelcomePopup: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const played = useRef(false);
  const firstName = useMemo(() => {
    const n = getTelegramUserData();
    const nm = n.name && n.name !== "O'quvchi" ? n.name.split(' ')[0] : '';
    return nm.slice(0, 24);
  }, []);

  // Konfetti bo'laklari (bir marta tasodifiy hosil qilinadi)
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.round(Math.random() * 100),
        delay: Math.round(Math.random() * 900) / 1000,
        dur: 2.4 + Math.random() * 1.8,
        size: 6 + Math.round(Math.random() * 6),
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
        rot: Math.round(Math.random() * 360),
      })),
    []
  );

  useEffect(() => {
    const play = () => {
      if (played.current) return;
      if (sfx.welcome()) {
        played.current = true;
        triggerHaptic('success');
      }
    };
    // Brauzer ovozga ruxsat bersa — darhol; bermasa — birinchi tegishda (tugma bosilganda ham ishlaydi)
    const t = setTimeout(play, 250);
    const onTouch = () => play();
    window.addEventListener('pointerdown', onTouch, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', onTouch);
      window.removeEventListener('touchstart', onTouch);
    };
  }, []);

  const close = () => {
    markWelcomeSeen();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tt("VocaBoostga xush kelibsiz")}
      className="vb-wl-backdrop fixed inset-0 z-[300] flex items-center justify-center p-5 overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 30%, rgba(30,58,138,.92), rgba(5,8,16,.97) 70%)', backdropFilter: 'blur(6px)' }}
    >
      {/* konfetti */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {pieces.map((p, i) => (
          <i
            key={i}
            className="vb-wl-confetti"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              background: p.color,
              borderRadius: p.round ? '50%' : 2,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              transform: `rotate(${p.rot}deg)`,
            }}
          />
        ))}
      </div>

      <div
        className="vb-wl-card relative w-full max-w-sm rounded-[28px] px-6 pt-10 pb-6 text-center"
        style={{
          background: 'linear-gradient(160deg, #162033 0%, #0E1524 100%)',
          border: '1px solid rgba(251,191,36,.35)',
          boxShadow: '0 0 0 1px rgba(255,255,255,.04), 0 30px 80px rgba(0,0,0,.6), 0 0 60px rgba(56,189,248,.18)',
        }}
      >
        <div className="relative mx-auto w-28 h-28 mb-5">
          <span className="vb-wl-ring absolute -inset-4 rounded-full" style={{ border: '2px solid rgba(251,191,36,.45)' }} />
          <span className="vb-wl-ring vb-wl-ring2 absolute -inset-4 rounded-full" style={{ border: '2px solid rgba(56,189,248,.45)' }} />
          <Logo className="vb-wl-logo relative w-28 h-28" glow />
        </div>

        {firstName && (
          <div className="text-[13px] font-bold mb-1" style={{ color: '#FBBF24' }}>
            Salom, {firstName}! 👋
          </div>
        )}
        <h2 className="text-[26px] leading-tight font-black" style={{ color: '#FFFFFF' }}>
          Voca<span style={{ color: '#FBBF24' }}>Boost</span>ga
          <br />
          xush kelibsiz!
        </h2>
        <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: '#CBD5E1' }}>
          Inglizcha so&apos;zlarni tez va uzoq yodlash safaringiz shu yerdan boshlanadi. Har kuni oz-ozdan — natija esa katta bo&apos;ladi 🚀
        </p>

        <button
          type="button"
          data-nosfx
          onClick={close}
          className="mt-6 w-full h-14 rounded-2xl font-black text-base active:scale-[0.97] transition-transform"
          style={{ background: 'linear-gradient(135deg,#FCD34D,#F59E0B)', color: '#0B0F17', boxShadow: '0 10px 30px rgba(245,158,11,.35)' }}
        >
          Boshlaymiz! ✨
        </button>
      </div>
    </div>
  );
};
