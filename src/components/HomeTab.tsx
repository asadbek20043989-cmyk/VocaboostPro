import React, { useState } from 'react';
import { Flame, Diamond, Play, CheckCircle2, Sparkles, Crown, Zap, Snowflake, Swords, BookMarked, Target, ChevronRight, Star } from 'lucide-react';
import { Avatar } from './Avatar';
import { CosAvatar, CosName } from './Cosmetics';
import { BANNERS } from '../data/shopDefaults';
import { LofiPlayer } from './LofiPlayer';
import { useApp } from '../context/AppContext';
import { triggerHaptic } from '../services/telegram';
import { LuckyWheel } from './LuckyWheel';
import { WordMap } from './WordMap';
import { VocabStory } from './Learning';
import { nowMs, todayKey, addDays, dayDiff } from '../services/time';


/** 3D uslubidagi sovg'a qutisi */
const GiftArt: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 56 64" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FDE047" /><stop offset="1" stopColor="#F59E0B" /></linearGradient>
      <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FACC15" /><stop offset="1" stopColor="#EA9A0B" /></linearGradient>
      <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F43F5E" /><stop offset="1" stopColor="#BE123C" /></linearGradient>
    </defs>
    <rect x="6" y="26" width="44" height="34" rx="6" fill="url(#gb)" />
    <rect x="2" y="16" width="52" height="15" rx="5" fill="url(#gl)" />
    <rect x="23" y="16" width="10" height="44" fill="url(#gr)" />
    <rect x="23" y="16" width="10" height="15" fill="#E11D48" />
    <path d="M28 16 C20 2 8 6 12 13 C15 18 24 17 28 16Z" fill="url(#gr)" />
    <path d="M28 16 C36 2 48 6 44 13 C41 18 32 17 28 16Z" fill="url(#gr)" />
    <rect x="9" y="29" width="6" height="26" rx="3" fill="#fff" opacity="0.28" />
  </svg>
);

/** Baraban (ferris wheel) belgisi */
const WheelArt: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="16" cy="13" r="9.5" />
    <circle cx="16" cy="13" r="3" />
    <path d="M16 3.5v19M6.5 13h19M9.3 6.3l13.4 13.4M22.7 6.3 9.3 19.7" />
    <path d="M10 30l6-11 6 11M8 30h16" />
  </svg>
);

interface LevelTheme {
  name: string;
  ielts: string;
  badge: string;
  icon: string;
  containerBg: string;
  border: string;
  iconBg: string;
  titleColor: string;
  quote: string;
  btnBg: string;
  statsBg: string;
  tagColor: string;
  tagBg: string;
}

const LEVEL_THEMES: Record<string, LevelTheme> = {
  A1: {
    name: "A1 · Boshlang'ich",
    ielts: "IELTS 2.0-3.0",
    badge: "🌱 A1 · Beginner",
    icon: "🌱",
    containerBg: "from-[#092218]/95 via-[#0e1c18]/85 to-[#0E1524]",
    border: "border-emerald-500/40 shadow-emerald-950/40",
    iconBg: "from-emerald-400 to-teal-500 text-slate-950 shadow-emerald-500/30",
    titleColor: "text-emerald-400",
    quote: "Katta maqsadlar birinchi so'zlardan boshlanadi 🌱",
    btnBg: "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25",
    statsBg: "bg-[#091f16]/70 border-emerald-500/25",
    tagColor: "text-emerald-300",
    tagBg: "bg-emerald-500/15 border-emerald-500/30",
  },
  A2: {
    name: "A2 · Elementary",
    ielts: "IELTS 3.5-4.0",
    badge: "⚡ A2 · Elementary",
    icon: "⚡",
    containerBg: "from-[#081e33]/95 via-[#0b1928]/85 to-[#0E1524]",
    border: "border-sky-500/40 shadow-sky-950/40",
    iconBg: "from-sky-400 to-blue-500 text-slate-950 shadow-sky-500/30",
    titleColor: "text-sky-400",
    quote: "Har kuni yangi iboralar bilan tezligingiz ortmoqda ⚡",
    btnBg: "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/25",
    statsBg: "bg-[#091b2c]/70 border-sky-500/25",
    tagColor: "text-sky-300",
    tagBg: "bg-sky-500/15 border-sky-500/30",
  },
  B1: {
    name: "B1 · Intermediate",
    ielts: "IELTS 4.5-5.0",
    badge: "🔮 B1 · Intermediate",
    icon: "🔮",
    containerBg: "from-[#1a1438]/95 via-[#141228]/85 to-[#0E1524]",
    border: "border-indigo-500/40 shadow-indigo-950/40",
    iconBg: "from-indigo-400 to-purple-500 text-slate-950 shadow-indigo-500/30",
    titleColor: "text-indigo-400",
    quote: "Erkin muloqot va mustaqil fikrlash bosqichidasiz 🔮",
    btnBg: "bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/25",
    statsBg: "bg-[#16122e]/70 border-indigo-500/25",
    tagColor: "text-indigo-300",
    tagBg: "bg-indigo-500/15 border-indigo-500/30",
  },
  B2: {
    name: "B2 · Upper-Intermediate",
    ielts: "IELTS 5.5-6.5",
    badge: "🔥 B2 · Upper-Int",
    icon: "🔥",
    containerBg: "from-[#291708]/95 via-[#1d140e]/85 to-[#0E1524]",
    border: "border-amber-500/40 shadow-amber-950/40",
    iconBg: "from-amber-400 to-orange-500 text-slate-950 shadow-amber-500/30",
    titleColor: "text-amber-400",
    quote: "Professional ingliz tili va yuqori marralar sari 🔥",
    btnBg: "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25",
    statsBg: "bg-[#211409]/70 border-amber-500/25",
    tagColor: "text-amber-300",
    tagBg: "bg-amber-500/15 border-amber-500/30",
  },
  'B2+': {
    name: "B2 · Upper-Intermediate",
    ielts: "IELTS 5.5-6.5",
    badge: "🔥 B2 · Upper-Int",
    icon: "🔥",
    containerBg: "from-[#291708]/95 via-[#1d140e]/85 to-[#0E1524]",
    border: "border-amber-500/40 shadow-amber-950/40",
    iconBg: "from-amber-400 to-orange-500 text-slate-950 shadow-amber-500/30",
    titleColor: "text-amber-400",
    quote: "Professional ingliz tili va yuqori marralar sari 🔥",
    btnBg: "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25",
    statsBg: "bg-[#211409]/70 border-amber-500/25",
    tagColor: "text-amber-300",
    tagBg: "bg-amber-500/15 border-amber-500/30",
  },
  C1: {
    name: "C1 · Advanced",
    ielts: "IELTS 7.0-8.0",
    badge: "💎 C1 · Advanced",
    icon: "💎",
    containerBg: "from-[#2e0b1d]/95 via-[#1e0d19]/85 to-[#0E1524]",
    border: "border-rose-500/40 shadow-rose-950/40",
    iconBg: "from-rose-400 to-pink-500 text-slate-950 shadow-rose-500/30",
    titleColor: "text-rose-400",
    quote: "Akademik so'z boyligi va nozik grammatik mahorat 💎",
    btnBg: "bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/25",
    statsBg: "bg-[#240b19]/70 border-rose-500/25",
    tagColor: "text-rose-300",
    tagBg: "bg-rose-500/15 border-rose-500/30",
  },
  C2: {
    name: "C2 · Proficiency / Master",
    ielts: "IELTS 8.5-9.0",
    badge: "👑 C2 · Master",
    icon: "👑",
    containerBg: "from-[#092233]/95 via-[#1f0e2e]/85 to-[#0E1524]",
    border: "border-fuchsia-500/40 shadow-fuchsia-950/40",
    iconBg: "from-cyan-300 via-fuchsia-400 to-amber-300 text-slate-950 shadow-fuchsia-500/30",
    titleColor: "text-fuchsia-300",
    quote: "Ingliz tili cho'qqisi — ona tili darajasidagi mahorat 👑",
    btnBg: "bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 text-slate-950 shadow-fuchsia-500/25",
    statsBg: "bg-[#1a0c28]/70 border-fuchsia-500/25",
    tagColor: "text-fuchsia-300",
    tagBg: "bg-fuchsia-500/15 border-fuchsia-500/30",
  },
};

export const HomeTab: React.FC = () => {
  const {
    profile, bank, srs, savedWords, masteredCount, newQueue, dueWords, introducedToday, dailyQuests, claimQuest,
    openLearn, setActiveTab, totalSpinsLeft, isPro, wheel, wheelFreeSpins, packs, todayPacks, packProgress, duels, challenges,
  } = useApp();
  const liveChallenges = challenges.filter(c => !c.finalized && c.endsAt > nowMs());
  const openPacks = packs.filter(p => p.kind === 'open');
  // Maxsus mavzular: har kuni bitta mavzu bo'yicha TOP 20 lug'at (admin yuklaydi). Kelajak sanalilar ko'rinmaydi.
  const todayK = todayKey();
  const topics = packs.filter(p => p.kind === 'topic' && p.date && p.date <= todayK).sort((a, b) => b.date.localeCompare(a.date));
  const topicToday = topics.find(p => p.date === todayK);
  const topicPast = topics.filter(p => p !== topicToday).slice(0, 6);
  const openEquip = () => { triggerHaptic('selection'); try { sessionStorage.setItem('vb_open_equip', '1'); } catch { /* ignore */ } setActiveTab('shop'); };
  const activeDuels = duels.filter(d => d.endsAt > nowMs()).length;
  const [showWheel, setShowWheel] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showStory, setShowStory] = useState(false);

  const total = Math.max(bank.length, 1);
  const pctLearned = Math.round((savedWords.length / total) * 100);
  const pctMastered = Math.round((masteredCount / total) * 100);
  const todayWork = newQueue.length + dueWords.length;
  const allDone = todayWork === 0;
  const claimable = dailyQuests.filter(q => q.completed && !q.claimed).length;

  const hasBanner = (profile.own || []).includes('banner') && !!profile.banner && !!BANNERS[profile.banner as string];

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <header className={`relative flex items-center justify-between gap-3 ${hasBanner ? 'overflow-hidden rounded-2xl p-3' : 'pt-2.5 pl-1.5'}`}>
        {hasBanner && <><div className="vb-banner absolute inset-0" style={{ background: BANNERS[profile.banner as string].bg }} aria-hidden /><div className="absolute inset-0 bg-black/35" aria-hidden /></>}
        <div className="relative flex items-center gap-3 min-w-0">
          <CosAvatar src={profile.avatar} name={profile.name} size={44} cos={{ fr: profile.frame, rb: profile.rankBadge, au: (profile.own || []).includes('aura') ? profile.aura : '' }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white truncate min-w-0"><CosName name={profile.name} cos={{ nf: profile.nameFx, nc: profile.nameColor, ns: profile.nameSym, rb: profile.rankBadge, vf: (profile.own || []).includes('verified'), na: (profile.own || []).includes('nameanim') ? profile.nameAnim : '' }} /></h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">{profile.level}</span>
            </div>
            <p className="text-[11px] text-slate-400">Kuniga {profile.wordsPerDay} ta yangi so&apos;z</p>
          </div>
        </div>
        <div className="relative flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold tabular-nums"><Flame className="w-3.5 h-3.5" /> {profile.streak}</div>
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tabular-nums"><Diamond className="w-3.5 h-3.5" /> {profile.xp} XP</div>
        </div>
      </header>

      {/* Jihozlarim: bir bosishda ramka, mavzu, unvon va boshqa bezaklar */}
      <button type="button" onClick={openEquip} className="w-full text-left rounded-2xl p-3 flex items-center gap-3 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-amber-500/15 border border-violet-400/40 active:scale-[0.98] transition-all">
        <span className="keep-dark w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/30 shrink-0"><Sparkles className="w-5 h-5 text-white" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-white">Jihozlarim</div>
          <div className="text-[11px] text-slate-400 truncate">Ramka, ilova mavzusi, unvon va nik rangi{(profile.own || []).length ? ` · ${(profile.own || []).filter(x => !x.startsWith('av:')).length} ta mahsulot` : ''}</div>
        </div>
        <ChevronRight className="w-5 h-5 text-violet-400 shrink-0" />
      </button>

      {/* Bugungi mashq — Har bir daraja uchun o'ziga xos dizayn va motivatsiya */}
      {(() => {
        const curLvl = profile.level || 'B1';
        const lt = LEVEL_THEMES[curLvl] || LEVEL_THEMES.B1;
        const levelWords = bank.filter(w => (w.level === curLvl || (curLvl === 'B2' && w.level === 'B2+')));
        const levelMastered = levelWords.filter(w => srs[w.id]?.mastered).length;
        const levelPct = levelWords.length ? Math.round((levelMastered / levelWords.length) * 100) : 0;

        return (
          <section className={`rounded-3xl bg-gradient-to-br ${lt.containerBg} border ${lt.border} p-5 space-y-4 shadow-xl transition-all relative overflow-hidden`}>
            {/* Orqa fon nur effekti */}
            <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/5 blur-2xl pointer-events-none" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${lt.iconBg} flex items-center justify-center text-xl shadow-md shrink-0`}>
                  {lt.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${lt.tagBg} ${lt.tagColor}`}>
                      {lt.badge}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">· {lt.ielts}</span>
                  </div>
                  <h2 className="text-lg font-black leading-tight text-white mt-1">Bugungi mashq</h2>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-white tabular-nums leading-none">{introducedToday}</div>
                <div className="text-[10px] text-slate-400 mt-1">bugun o&apos;rganildi</div>
              </div>
            </div>

            {/* Daraja bo'yicha motivatsion shior */}
            <div className="relative px-3 py-1.5 rounded-xl bg-black/25 border border-white/5 text-[11px] text-slate-300 flex items-center gap-2">
              <span className="text-sm shrink-0">✨</span>
              <span className="truncate">{lt.quote}</span>
            </div>

            {/* Daraja so'zlarini to'liq yodlash progressi */}
            {levelWords.length > 0 && (
              <div className="relative rounded-2xl p-3 bg-black/30 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">
                    {curLvl} darajasi lug&apos;ati: <b className="text-white">{levelMastered} / {levelWords.length}</b> yodlandi
                  </span>
                  <span className={`font-extrabold ${lt.titleColor}`}>{levelPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/50 overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${lt.iconBg} transition-all duration-500`} style={{ width: `${levelPct}%` }} />
                </div>
                {levelMastered >= levelWords.length && levelWords.length >= 5 ? (
                  <div className="text-[10px] text-amber-300 font-bold flex items-center gap-1 pt-0.5">
                    🎉 Ushbu daraja to&apos;liq yakunlandi! Keyingi levelga o&apos;tiladi.
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400">
                    Barcha so&apos;zlarni to&apos;liq yodlaganingizda darajangiz avtomatik oshiriladi!
                  </div>
                )}
              </div>
            )}

            <div className="relative grid grid-cols-2 gap-3">
              <div className={`rounded-2xl border p-3 ${lt.statsBg}`}>
                <div className="text-2xl font-extrabold text-sky-400 tabular-nums">{newQueue.length}</div>
                <div className="text-[11px] text-slate-400">yangi so&apos;z</div>
              </div>
              <div className={`rounded-2xl border p-3 ${lt.statsBg}`}>
                <div className="text-2xl font-extrabold text-emerald-400 tabular-nums">{dueWords.length}</div>
                <div className="text-[11px] text-slate-400">takrorlash kerak</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { triggerHaptic('medium'); openLearn(); }}
              disabled={allDone}
              className={`w-full h-14 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 shadow-lg disabled:bg-slate-800 disabled:text-slate-500 active:scale-[0.98] transition-all ${lt.btnBg}`}
            >
              {allDone ? <><CheckCircle2 className="w-5 h-5" /> Bugungi reja bajarildi</> : <><Play className="w-5 h-5 fill-current" /> Mashqni boshlash</>}
            </button>

            {todayPacks.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-sky-500/10 border border-sky-500/30 px-3 py-2 text-[11px] text-sky-300">
                <BookMarked className="w-4 h-4 shrink-0" />
                <span className="truncate">Bugungi lug‘at: <b>{todayPacks.map(p => p.title).join(', ')}</b></span>
              </div>
            )}
            {allDone && <p className="text-[11px] text-slate-400 text-center">Ajoyib! O&apos;yinlar bo&apos;limida so&apos;zlarni mustahkamlang yoki ertaga qayting.</p>}
          </section>
        );
      })()}

      <LofiPlayer />

      {/* Maxsus mavzular: kunlik TOP 20 lug'at */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Maxsus mavzular</h3>
          <span className="text-[11px] text-slate-400">Har kuni yangi mavzu</span>
        </div>
        {topicToday ? (() => {
          const pr = packProgress(topicToday);
          const done = pr.learned >= pr.total;
          return (
            <div className="keep-dark relative overflow-hidden rounded-3xl p-4 bg-gradient-to-br from-[#0F766E] via-[#0E7490] to-[#4338CA] border border-cyan-300/30 shadow-xl shadow-cyan-950/30">
              <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full bg-white/10 blur-xl" />
              <div className="relative">
                <span className="inline-block text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-300 text-slate-950">Bugungi mavzu · TOP {topicToday.words.length}</span>
                <h4 className="mt-2 text-xl font-extrabold text-white leading-tight">{topicToday.title}</h4>
                {topicToday.desc && <p className="text-xs text-cyan-50/85 mt-1">{topicToday.desc}</p>}
                <div className="mt-3 h-2 rounded-full bg-black/25 overflow-hidden"><div className="h-full bg-amber-300" style={{ width: `${Math.round((pr.learned / Math.max(1, pr.total)) * 100)}%` }} /></div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-cyan-50/90">{pr.learned} / {pr.total} so&apos;z o&apos;rganildi</span>
                  <button type="button" onClick={() => { triggerHaptic('medium'); openLearn(topicToday.id); }} className="px-4 py-2 rounded-xl bg-amber-300 hover:bg-amber-200 text-slate-950 text-xs font-extrabold active:scale-95 transition-all flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 fill-slate-950" /> {done ? 'Takrorlash' : pr.learned > 0 ? 'Davom etish' : "O'rganish"}
                  </button>
                </div>
              </div>
            </div>
          );
        })() : (
          <div className="rounded-2xl bg-[#151C28] border border-dashed border-slate-700 p-4 text-center text-xs text-slate-400">Bugungi maxsus mavzu tez orada e&apos;lon qilinadi ✨</div>
        )}
        {topicPast.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-1">Oldingi mavzular</div>
            {topicPast.map(p => {
              const pr = packProgress(p);
              return (
                <button key={p.id} type="button" onClick={() => { triggerHaptic('selection'); openLearn(p.id); }} className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-[#151C28] border border-slate-800 active:scale-[0.98] transition-all">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0"><BookMarked className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">{p.title}</div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-400" style={{ width: `${Math.round((pr.learned / Math.max(1, pr.total)) * 100)}%` }} /></div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{p.date.split('-').reverse().join('.')} · {pr.learned} / {pr.total} so&apos;z</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Qo'shimcha lug'at to'plamlari (admin yuklagan) */}
      {openPacks.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><BookMarked className="w-4 h-4 text-sky-400" /> Lug‘at to‘plamlari</h3>
          {openPacks.map(p => {
            const pr = packProgress(p);
            const done = pr.learned >= pr.total;
            return (
              <div key={p.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#151C28] border border-slate-800">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{p.title}</span>
                    {p.isCustom && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Shaxsiy
                      </span>
                    )}
                  </div>
                  {p.desc && <div className="text-[11px] text-slate-400 truncate">{p.desc}</div>}
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-sky-500" style={{ width: `${Math.round((pr.learned / Math.max(1, pr.total)) * 100)}%` }} /></div>
                  <div className="text-[10px] text-slate-400 mt-1">{pr.learned} / {pr.total} so‘z</div>
                </div>
                <button type="button" onClick={() => { triggerHaptic('medium'); openLearn(p.id); }} className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold active:scale-95 transition-all">{done ? 'Takrorlash' : "O‘rganish"}</button>
              </div>
            );
          })}
        </section>
      )}

      {/* Haftalik Streak Kalendari */}
      <section className="rounded-2xl bg-[#151C28] border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-white flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-500 fill-orange-500" /> Haftalik faollik seriyasi</span>
          <span className="text-amber-400 font-extrabold">{profile.streak} kun uzluksiz</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map((d, i) => {
            // Haqiqiy faol kunlar: oxirgi mashq kunidan orqaga qarab `streak` kun (Toshkent vaqti bo'yicha, hafta Dushanbadan boshlanadi)
            const todayK = todayKey();
            const todayIdx = (new Date(todayK + 'T00:00:00Z').getUTCDay() + 6) % 7;
            const dayKey = addDays(todayK, i - todayIdx);
            const last = profile.lastReadDate || '';
            const span = profile.streak > 0 && last ? dayDiff(dayKey, last) : -1; // oxirgi mashq shu kundan necha kun keyin
            const active = profile.streak > 0 && !!last && span >= 0 && span < profile.streak && dayKey <= last;
            const isToday = i === todayIdx;
            return (
              <div key={d} className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all ${isToday ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-extrabold shadow-sm shadow-amber-500/20' : active ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-[#18202F] border-slate-800 text-slate-500'}`}>
                <span className="text-[10px]">{d}</span>
                <span className="text-xs">{active ? '🔥' : '·'}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sun'iy intellekt hikoyasi */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-purple-500/15 border border-amber-500/30 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
              So‘zlarimdan AI Hikoya
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">AI</span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              O‘rgangan so‘zlaringiz asosida qiziqarli hikoya va tarjima
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { triggerHaptic('selection'); setShowStory(true); }}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold active:scale-95 transition-all shadow-md shadow-amber-500/20"
        >
          O‘qish →
        </button>
      </div>

      {/* Progress */}
      <section className="rounded-2xl bg-[#151C28] border border-slate-800 p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white">So&apos;zlar xaritasi</span>
          <button type="button" onClick={() => setShowMap(true)} className="text-amber-400 font-semibold">So&apos;zlar xaritasini ko&apos;rish →</button>
        </div>
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden flex">
          <div className="h-full bg-emerald-500" style={{ width: `${pctMastered}%` }} />
          <div className="h-full bg-amber-400" style={{ width: `${Math.max(0, pctLearned - pctMastered)}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-slate-400">
          <span><b className="text-emerald-400">{masteredCount}</b> yodlandi</span>
          <span><b className="text-amber-400">{savedWords.length - masteredCount}</b> o&apos;rganilmoqda</span>
          <span>jami {bank.length}</span>
        </div>
      </section>

      {/* Omadli baraban: sahifaning o'rtasida */}
      <button
        type="button"
        onClick={() => { triggerHaptic('selection'); setShowWheel(true); }}
        className="keep-dark relative w-full overflow-hidden text-left rounded-[26px] p-5 bg-gradient-to-br from-[#4C1D95] via-[#5B21B6] to-[#9D2A8F] border border-fuchsia-300/25 shadow-xl shadow-purple-950/50 active:scale-[0.98] transition-all"
      >
        <div className="absolute -right-10 -bottom-12 w-44 h-44 rounded-full bg-fuchsia-400/20 blur-2xl" />
        <GiftArt className="absolute top-4 right-4 w-14 h-16 rotate-[8deg] drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]" />
        <div className="relative">
          <div className="text-[12px] font-extrabold tracking-wide text-amber-300 uppercase">Kunlik sovg&apos;a</div>
          <div className="mt-2 flex items-center gap-2.5 pr-16">
            <WheelArt className="w-9 h-9 text-amber-200 shrink-0" />
            <h3 className="text-[22px] leading-none font-extrabold text-white tracking-tight">Omadli Baraban</h3>
          </div>
          <p className="mt-2.5 text-xs text-purple-100/85 pr-10">
            {totalSpinsLeft > 0 ? `${totalSpinsLeft} ta aylantirish imkoniyati bor` : `Keyingi imkoniyat uchun kuting (har ${wheelFreeSpins} ta urinishdan keyin)`}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {wheel.doubleXpPending && <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/25 text-pink-100 inline-flex items-center gap-1"><Zap className="w-3 h-3" />2x</span>}
              {isPro && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/25 text-amber-100 inline-flex items-center gap-1"><Crown className="w-3 h-3" />VIP</span>}
              {wheel.streakSavers > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/25 text-cyan-100 inline-flex items-center gap-1"><Snowflake className="w-3 h-3" />×{wheel.streakSavers}</span>}
            </div>
            <span className="shrink-0 px-4 py-2 rounded-full bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/30">Aylantirish →</span>
          </div>
        </div>
      </button>

      {/* Chellenj / marafon (admin e'lon qiladi) */}
      {liveChallenges.length > 0 && (
        <button type="button" onClick={() => { triggerHaptic('selection'); try { sessionStorage.setItem('vb_liga_sub', 'challenge'); } catch { /* ignore */ } setActiveTab('leaderboard'); }} className="w-full text-left rounded-2xl bg-gradient-to-r from-emerald-500/15 to-sky-500/10 border border-emerald-500/40 p-4 flex items-center gap-3 active:scale-[0.98] transition-all">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-xl">🏁</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">{liveChallenges[0].title}</div>
            <div className="text-[11px] text-slate-300">{liveChallenges.length > 1 ? `${liveChallenges.length} ta faol chellenj` : 'Faol chellenj'} · {liveChallenges[0].joined ? 'Siz qatnashyapsiz' : 'Qatnashing!'}</div>
          </div>
          <span className="text-xs font-bold text-emerald-400">Ochish →</span>
        </button>
      )}

      {/* Raqib bilan bellashuv */}
      <button type="button" onClick={() => { triggerHaptic('selection'); try { sessionStorage.setItem('vb_liga_sub', 'duel'); } catch { /* ignore */ } setActiveTab('leaderboard'); }} className="w-full text-left rounded-2xl bg-[#151C28] border border-slate-800 p-4 flex items-center gap-3 active:scale-[0.98] transition-all">
        <div className="w-11 h-11 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0"><Swords className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">Raqib bilan bellashuv</div>
          <div className="text-[11px] text-slate-400">{activeDuels > 0 ? `${activeDuels} ta faol bellashuv bor` : 'Do‘stingizni chaqiring va XP bo‘yicha bellashing'}</div>
        </div>
        <span className="text-xs font-bold text-amber-400">Ochish →</span>
      </button>

      {/* Kunlik missiyalar */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" /> Kunlik missiyalar</h3>
          <span className="text-[11px] text-slate-400">{dailyQuests.filter(q => q.claimed).length} / {dailyQuests.length} {claimable > 0 ? `· ${claimable} ta olinadi` : ''}</span>
        </div>
        {dailyQuests.map(q => (
          <div key={q.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#151C28] border border-slate-800">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold tabular-nums shrink-0 ${q.claimed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-300'}`}>{q.claimed ? <CheckCircle2 className="w-5 h-5" /> : `${q.current}/${q.target}`}</div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold leading-snug ${q.claimed ? 'text-slate-500 line-through' : 'text-white'}`}>{q.titleUz}</div>
              <div className="text-[11px] text-amber-400 font-semibold">Mukofot: +{q.xpReward} XP{wheel.doubleXpPending && !q.claimed ? ' (×2)' : ''}</div>
            </div>
            {q.completed && !q.claimed ? (
              <button
                type="button"
                onClick={() => claimQuest(q.id)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 via-amber-400 to-amber-500 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/30 border border-amber-200 active:scale-95 transition-all animate-bounce flex items-center gap-1 shrink-0"
              >
                <span>🎁 Olish{wheel.doubleXpPending ? ' ×2' : ''}</span>
              </button>
            ) : !q.claimed ? (
              <button
                type="button"
                onClick={() => {
                  if (q.type === 'play_game') setActiveTab('games');
                  else if (q.type === 'spin_wheel') setShowWheel(true);
                  else if (q.type === 'learn_words' || q.type === 'review_words') openLearn();
                  else setActiveTab('words');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-sky-500/25 border border-sky-400/40 active:scale-95 transition-all flex items-center gap-1 shrink-0 animate-pulse"
              >
                <span>Boshlash</span>
                <span className="text-sky-200 font-extrabold">→</span>
              </button>
            ) : null}
          </div>
        ))}
      </section>

      {showWheel && <LuckyWheel onClose={() => setShowWheel(false)} />}
      {showMap && <WordMap onClose={() => setShowMap(false)} />}
      {showStory && <VocabStory words={savedWords} onClose={() => setShowStory(false)} />}
    </div>
  );
};
