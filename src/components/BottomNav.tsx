import React from 'react';
import { Home, Brain, Gamepad2, Trophy, ShoppingBag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic } from '../services/telegram';
import { TabId } from '../types';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, dueWords } = useApp();
  const items: { id: TabId; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Bugun', Icon: Home },
    { id: 'words', label: "So'zlar", Icon: Brain },
    { id: 'shop', label: "Do'kon", Icon: ShoppingBag },
    { id: 'games', label: "O'yinlar", Icon: Gamepad2 },
    { id: 'leaderboard', label: 'Reyting', Icon: Trophy },
  ];
  return (
    <nav aria-label="Pastki navigatsiya" className="fixed bottom-0 left-0 right-0 z-40 bg-[#0E1524]/95 backdrop-blur-lg border-t border-slate-800/80 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-5 items-center h-16 px-1">
        {items.map(({ id, label, Icon }) => {
          const on = activeTab === id;
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
                {id === 'shop' && (
                  <span className="absolute -top-1 -right-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[8px] font-black px-1 rounded-full uppercase tracking-tighter">NEW</span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1 whitespace-nowrap">{label}</span>
              {on && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-400" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
