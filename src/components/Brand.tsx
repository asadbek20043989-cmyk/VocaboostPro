import React from 'react';
import { PremiumTick } from './PremiumTick';
import { Volume2, VolumeX, Sun, Moon, Star, Ticket, Gift } from 'lucide-react';
import { useSfx } from '../services/sound';
import { useTheme } from '../services/theme';
import { t as tt } from '../services/i18n';

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

/** Logotip + nom + rasmiy tasdiq belgisi (tepa panel uchun) */
export const BrandMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
    <span className="vb-logo-ring"><Logo className="w-9 h-9 shrink-0" /></span>
    <span className="text-[17px] font-extrabold tracking-tight text-white truncate">
      Voca<span className="text-amber-400">Boost</span>
    </span>
    <PremiumTick size={20} variant="official" className="shrink-0" title={tt("Rasmiy tasdiqlangan")} />
  </div>
);

const hb = (extra = '', small?: boolean) => `vb-hbtn ${small ? 'vb-hbtn--sm' : ''} ${extra} text-amber-400`;

/** Tovush effektlarini o'chirish/yoqish tugmasi */
export const SoundButton: React.FC<{ className?: string; small?: boolean }> = ({ className = '', small }) => {
  const [on, setOn] = useSfx();
  return (
    <button
      type="button"
      data-nosfx
      onClick={() => setOn(!on)}
      aria-label={on ? tt("Tovushni o'chirish") : tt('Tovushni yoqish')}
      aria-pressed={!on}
      title={on ? tt("Tovushni o'chirish") : tt('Tovushni yoqish')}
      style={{ ['--d' as any]: '3.6s' }}
      className={`${hb('', small)} ${on ? '' : 'opacity-70'} ${className}`}
    >
      {on ? <Volume2 /> : <VolumeX />}
    </button>
  );
};

/** Kun / Tun rejimi tugmasi */
export const ThemeButton: React.FC<{ className?: string; small?: boolean }> = ({ className = '', small }) => {
  const [theme, setTheme] = useTheme();
  const light = theme === 'light';
  return (
    <button
      type="button"
      data-nosfx
      onClick={() => setTheme(light ? 'dark' : 'light')}
      aria-label={light ? tt('Tun rejimiga o‘tish') : tt('Kun rejimiga o‘tish')}
      title={light ? tt('Tun rejimi') : tt('Kun rejimi')}
      style={{ ['--d' as any]: '2.7s' }}
      className={`${hb('', small)} ${className}`}
    >
      {light ? <Moon /> : <Sun />}
    </button>
  );
};

/** Tepa panel tugmalari: promokod + baholash + sovg'a + tema + tovush (hammasi bir xil o'lcham va uslubda) */
export const HeaderActions: React.FC<{
  small?: boolean;
  spread?: boolean; // to'liq kenglikda teng masofa bilan joylashtirish
  showGift?: boolean;
  onGiftClick?: () => void;
  spinsCount?: number;
  onRateClick?: () => void;
  onPromoClick?: () => void;
}> = ({ small, spread, showGift, onGiftClick, spinsCount, onRateClick, onPromoClick }) => (
  <div className={spread ? 'flex items-center justify-between w-full' : 'flex items-center gap-2 shrink-0'}>
    {onPromoClick && (
      <button
        type="button"
        data-nosfx
        onClick={onPromoClick}
        aria-label={tt("Promokod")}
        title={tt("Promokod kiritish")}
        className={hb('', small)}
      >
        <Ticket />
      </button>
    )}
    {onRateClick && (
      <button
        type="button"
        data-nosfx
        onClick={onRateClick}
        aria-label={tt("Botni baholash")}
        title={tt("Botni baholash (5 ballik shkala)")}
        style={{ ['--d' as any]: '0.9s' }}
        className={hb('vb-hbtn--star', small)}
      >
        <Star className="fill-amber-400" />
      </button>
    )}
    {showGift && (
      <button
        type="button"
        data-nosfx
        onClick={onGiftClick}
        aria-label={tt("Omadli baraban")}
        title={tt("Omadli baraban (Sovg'a)")}
        style={{ ['--d' as any]: '1.8s' }}
        className={hb('vb-hbtn--gift', small)}
      >
        <Gift />
        {typeof spinsCount === 'number' && spinsCount > 0 && <span className="vb-hbadge">{spinsCount}</span>}
      </button>
    )}
    <ThemeButton small={small} />
    <SoundButton small={small} />
  </div>
);
