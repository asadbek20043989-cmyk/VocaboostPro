import React from 'react';
import { Volume2, VolumeX, Sun, Moon } from 'lucide-react';
import { useSfx } from '../services/sound';
import { useTheme } from '../services/theme';

export const APP_NAME = 'VocaBoost';

/** Logotip (yumaloq, tayyor rasm) */
export const Logo: React.FC<{ className?: string; glow?: boolean }> = ({ className = 'w-9 h-9', glow }) => (
  <img
    src="/logo.png"
    alt={APP_NAME}
    width={256}
    height={256}
    draggable={false}
    className={`${className} rounded-full select-none ${glow ? 'shadow-[0_0_40px_rgba(56,189,248,0.45)]' : ''}`}
  />
);

/** Logotip + nom (tepa panel uchun) */
export const BrandMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-2 min-w-0 ${className}`}>
    <Logo className="w-8 h-8" />
    <span className="text-[15px] font-extrabold tracking-tight text-white">
      Voca<span className="text-amber-400">Boost</span>
    </span>
  </div>
);

/** Tovush effektlarini o'chirish/yoqish tugmasi (yuqori o'ng burchak) */
export const SoundButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [on, setOn] = useSfx();
  return (
    <button
      type="button"
      data-nosfx
      onClick={() => setOn(!on)}
      aria-label={on ? "Tovushni o'chirish" : 'Tovushni yoqish'}
      aria-pressed={!on}
      title={on ? "Tovushni o'chirish" : 'Tovushni yoqish'}
      className={`w-10 h-10 rounded-xl bg-[#151C28] border border-slate-800 flex items-center justify-center active:scale-90 transition-all ${on ? 'text-amber-400' : 'text-slate-500'} ${className}`}
    >
      {on ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
    </button>
  );
};

/** Kun / Tun rejimi tugmasi (yuqori o'ng burchak) */
export const ThemeButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [theme, setTheme] = useTheme();
  const light = theme === 'light';
  return (
    <button
      type="button"
      data-nosfx
      onClick={() => setTheme(light ? 'dark' : 'light')}
      aria-label={light ? 'Tun rejimiga o‘tish' : 'Kun rejimiga o‘tish'}
      title={light ? 'Tun rejimi' : 'Kun rejimi'}
      className={`w-10 h-10 rounded-xl bg-[#151C28] border border-slate-800 flex items-center justify-center active:scale-90 transition-all text-amber-400 ${className}`}
    >
      {light ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
};

/** Tepa o'ng burchakdagi tugmalar: sovg'a (faqat bosh sahifada) + tema + tovush */
export const HeaderActions: React.FC<{ small?: boolean; showGift?: boolean; onGiftClick?: () => void; spinsCount?: number }> = ({ small, showGift, onGiftClick, spinsCount }) => (
  <div className="flex items-center gap-2 shrink-0">
    {showGift && (
      <button
        type="button"
        data-nosfx
        onClick={onGiftClick}
        aria-label="Omadli baraban"
        title="Omadli baraban (Sovg'a)"
        className={`relative w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 via-pink-500/15 to-purple-500/20 border border-amber-500/40 flex items-center justify-center active:scale-90 transition-all text-amber-400 hover:border-amber-400 shadow-sm ${small ? 'w-9 h-9' : ''}`}
      >
        <span className="text-lg leading-none transform hover:scale-110 transition-transform">🎁</span>
        {typeof spinsCount === 'number' && spinsCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-[10px] font-black text-slate-950 flex items-center justify-center shadow-md animate-pulse">
            {spinsCount}
          </span>
        )}
      </button>
    )}
    <ThemeButton className={small ? 'w-9 h-9' : ''} />
    <SoundButton className={small ? 'w-9 h-9' : ''} />
  </div>
);
