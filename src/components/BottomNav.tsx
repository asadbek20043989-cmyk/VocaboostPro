import React from 'react';
import { Home, Brain, Gamepad2, Trophy, ShoppingBag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic } from '../services/telegram';

type Tab = 'home' | 'words' | 'games' | 'leaderboard' | 'shop';

/** Admin paneldan (config/navBadges yoki shopConf.navBadges) beriladigan chiroyli badge matnlari */
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

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, dueWords } = useApp();
  const badges = useNavBadges();
  const items: { id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Bugun', Icon: Home },
    { id: 'words', label: "So'zlar", Icon: Brain },
    { id: 'games', label: "O'yinlar", Icon: Gamepad2 },
    { id: 'leaderboard', label: 'Liga', Icon: Trophy },
    { id: 'shop', label: "Do'kon", Icon: ShoppingBag },
  ];
  return (
    <nav aria-label="Pastki navigatsiya" className="fixed bottom-0 left-0 right-0 z-40 bg-[#0E1524]/95 backdrop-blur-lg border-t border-slate-800/80 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-5 items-center h-16 px-2">
        {items.map(({ id, label, Icon }) => {
          const on = activeTab === id;
          const badge = badges[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab(id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center min-h-[48px] py-1 relative transition-colors ${on ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${on ? 'scale-110' : ''}`} />
                {id === 'home' && dueWords.length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-amber-500 text-black text-[9px] font-bold px-1 rounded-full tabular-nums">{dueWords.length > 99 ? '99+' : dueWords.length}</span>
                )}
                {badge && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1.5 flex items-center justify-center rounded-full text-[8.5px] font-black tracking-tight leading-none shadow-lg border border-white/30 select-none ${
                      id === 'shop'
                        ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-pink-500 text-white'
                        : id === 'games'
                          ? 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white'
                          : 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950'
                    }`}
                    style={{
                      boxShadow: id === 'shop' ? '0 0 10px rgba(244,63,94,0.6)' : id === 'games' ? '0 0 10px rgba(168,85,247,0.6)' : '0 0 8px rgba(251,191,36,0.45)',
                    }}
                  >
                    {badge === 'dot' || badge === '•' ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    ) : (
                      badge
                    )}
                  </span>
                )}
              </div>
              <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">{label}</span>
              {on && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-400" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
