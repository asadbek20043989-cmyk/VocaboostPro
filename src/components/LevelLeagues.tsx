import React, { useMemo } from 'react';
import { Crown, Users, Globe2, Swords } from 'lucide-react';
import type { EnglishLevel, LeaderboardUser } from '../types';
import { LEVEL_NAMES } from '../data/levels';
import { triggerHaptic } from '../services/telegram';

export type LeagueView = 'all' | EnglishLevel;

export const LEAGUE_LEVELS: EnglishLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const LEAGUE_THEME: Record<EnglishLevel, { c1: string; c2: string; icon: string; title: string }> = {
  A1: { c1: '#34D399', c2: '#047857', icon: '🌱', title: 'Nihol ligasi' },
  A2: { c1: '#22D3EE', c2: '#0E7490', icon: '🍀', title: 'Kashfiyotchilar ligasi' },
  B1: { c1: '#60A5FA', c2: '#1D4ED8', icon: '🔥', title: 'Olov ligasi' },
  B2: { c1: '#A78BFA', c2: '#6D28D9', icon: '⚡', title: "Chaqmoq ligasi" },
  C1: { c1: '#F472B6', c2: '#BE185D', icon: '💎', title: 'Olmos ligasi' },
  C2: { c1: '#FBBF24', c2: '#B45309', icon: '👑', title: 'Ustozlar ligasi' },
};
const ALL_THEME = { c1: '#FBBF24', c2: '#EA580C', icon: '🌍', title: 'Umumiy reyting' };

export const themeOf = (v: LeagueView) => (v === 'all' ? ALL_THEME : LEAGUE_THEME[v]);

interface Props {
  users: LeaderboardUser[]; // barcha foydalanuvchilar (XP bo'yicha tartiblangan)
  view: LeagueView;
  onView: (v: LeagueView) => void;
  myLevel: EnglishLevel;
}

/** Darajalar «yo'li»: 6 ta liga kartasi + umumiy reyting, tanlangan liga uchun katta sahna */
export const LevelLeagues: React.FC<Props> = ({ users, view, onView, myLevel }) => {
  const stats = useMemo(() => {
    const m: Record<string, { count: number; xp: number; top?: LeaderboardUser }> = { all: { count: users.length, xp: 0, top: users[0] } };
    LEAGUE_LEVELS.forEach(l => (m[l] = { count: 0, xp: 0 }));
    users.forEach(u => {
      m.all.xp += u.xp;
      const k = LEAGUE_LEVELS.includes(u.level) ? u.level : 'A1';
      m[k].count++;
      m[k].xp += u.xp;
      if (!m[k].top) m[k].top = u; // users XP bo'yicha tartiblangan — birinchisi yetakchi
    });
    return m;
  }, [users]);

  const items: LeagueView[] = ['all', ...LEAGUE_LEVELS];
  const th = themeOf(view);
  const st = stats[view];
  const list = view === 'all' ? users : users.filter(u => (LEAGUE_LEVELS.includes(u.level) ? u.level : 'A1') === view);
  const meIdx = list.findIndex(u => u.isCurrentUser);

  return (
    <div className="space-y-2.5">
      {/* Liga kartalari (gorizontal) */}
      <div className="vb-lg-row -mx-1 px-1">
        {items.map(v => {
          const t = themeOf(v);
          const on = view === v;
          const mine = v === myLevel;
          return (
            <button
              key={v}
              type="button"
              onClick={() => { triggerHaptic('selection'); onView(v); }}
              className={`vb-lg-card ${on ? 'is-on' : ''}`}
              style={{ ['--c1' as any]: t.c1, ['--c2' as any]: t.c2 }}
              aria-pressed={on}
            >
              {mine && <span className="vb-lg-me">SIZ</span>}
              <span className="vb-lg-ico">{v === 'all' ? <Globe2 className="w-4 h-4" /> : t.icon}</span>
              <span className="vb-lg-code">{v === 'all' ? 'Barcha' : v}</span>
              <span className="vb-lg-cnt"><Users className="w-2.5 h-2.5" />{stats[v].count}</span>
            </button>
          );
        })}
      </div>

      {/* Tanlangan liga sahnasi */}
      <div className="vb-lg-hero" style={{ ['--c1' as any]: th.c1, ['--c2' as any]: th.c2 }} key={view}>
        <span className="vb-lg-mark" aria-hidden>{view === 'all' ? '★' : view}</span>
        <div className="relative flex items-center gap-3">
          <div className="vb-lg-emblem">{th.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">
              {view === 'all' ? 'Barcha darajalar' : `${view} · ${LEVEL_NAMES[view]}`}
            </div>
            <div className="text-lg font-black text-white leading-tight truncate">{th.title}</div>
            {view !== 'all' && view === myLevel && <div className="text-[11px] font-bold text-white/85 flex items-center gap-1"><Swords className="w-3 h-3" /> Sizning ligangiz — tengdoshlar bilan bellashing</div>}
            {view !== 'all' && view !== myLevel && <div className="text-[11px] font-semibold text-white/75">Boshqa liga — kuzatuv rejimi</div>}
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-2 mt-3">
          <div className="vb-lg-stat"><b>{st.count.toLocaleString()}</b><span>ishtirokchi</span></div>
          <div className="vb-lg-stat"><b>{st.xp >= 10000 ? `${(st.xp / 1000).toFixed(1)}k` : st.xp.toLocaleString()}</b><span>jami XP</span></div>
          <div className="vb-lg-stat"><b>{meIdx >= 0 ? `#${meIdx + 1}` : '—'}</b><span>{meIdx >= 0 ? 'sizning o‘rin' : 'siz bu yerda emassiz'}</span></div>
        </div>
        {st.top && (
          <div className="relative mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-white/90 bg-black/20 rounded-xl px-2.5 py-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">Yetakchi: {st.top.name.replace(' (Siz)', '')}{view !== 'all' ? '' : ` · ${st.top.level}`}</span>
            <span className="ml-auto tabular-nums shrink-0">{st.top.xp.toLocaleString()} XP</span>
          </div>
        )}
      </div>
    </div>
  );
};
