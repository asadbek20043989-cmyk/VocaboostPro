import React from 'react';
import { useApp } from '../context/AppContext';
import { triggerHaptic } from '../services/telegram';
import { HomeIcon3D, BrainIcon3D, GameIcon3D, TrophyIcon3D, ShopIcon3D } from './NavIcons';

type Tab = 'home' | 'words' | 'games' | 'leaderboard' | 'shop';

/** Admin paneldan (config/shop/navBadges) beriladigan badge matnlari (HOT, NEW, ...) */
function useNavBadges(): Partial<Record<Tab, string>> {
  const { shopConf } = useApp() as any;
  const raw = (shopConf && (shopConf.navBadges || shopConf.badges)) || {};
  const out: Partial<Record<Tab, string>> = {};
  (['games', 'shop', 'leaderboard', 'words', 'home'] as Tab[]).forEach(k => {
    const v = raw[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 12);
  });
  return out;
}

const ITEMS: { id: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Bugun', Icon: HomeIcon3D },
  { id: 'words', label: "So'zlar", Icon: BrainIcon3D },
  { id: 'games', label: "O'yinlar", Icon: GameIcon3D },
  { id: 'leaderboard', label: 'Liga', Icon: TrophyIcon3D },
  { id: 'shop', label: "Do'kon", Icon: ShopIcon3D },
];

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, dueWords } = useApp();
  const badges = useNavBadges();
  return (
    <nav aria-label="Pastki navigatsiya" className="vb-nav fixed bottom-0 left-0 right-0 z-40 pb-safe px-3 pt-2">
      <div className="vb-nav-pill max-w-md mx-auto grid grid-cols-5 items-stretch">
        {ITEMS.map(({ id, label, Icon }, i) => {
          const on = activeTab === id;
          const badge = badges[id];
          const gold = id === 'shop';
          return (
            <div key={id} className="relative flex">
              {i > 0 && !gold && <span className="vb-nav-sep" aria-hidden />}
              <button
                type="button"
                onClick={() => { triggerHaptic('selection'); setActiveTab(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`vb-nav-zone ${gold ? 'vb-nav-gold' : ''} ${on ? 'is-on' : ''}`}
                aria-current={on ? 'page' : undefined}
              >
                <span className="relative inline-flex">
                  <Icon className="vb-nav-ico" />
                  {id === 'home' && dueWords.length > 0 && <span className="vb-nav-count">{dueWords.length > 99 ? '99+' : dueWords.length}</span>}
                </span>
                <span className="vb-nav-label">{label}</span>
              </button>
              {badge && (
                <span className={`vb-nav-badge ${gold ? 'is-gold' : id === 'games' ? 'is-violet' : ''}`}>
                  {badge === 'dot' || badge === '•' ? <i className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" /> : badge}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};
