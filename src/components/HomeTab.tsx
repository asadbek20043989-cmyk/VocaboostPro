import React, { useState } from 'react';
import { Flame, Diamond, Play, CheckCircle2, Sparkles, Crown, Zap, Snowflake, Swords, BookMarked, Coins, UserPlus, ShoppingBag } from 'lucide-react';
import { Avatar } from './Avatar';
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

export const HomeTab: React.FC = () => {
  const {
    profile, bank, savedWords, masteredCount, newQueue, dueWords, introducedToday, dailyQuests, claimQuest,
    openLearn, setActiveTab, totalSpinsLeft, isPro, wheel, wheelFreeSpins, packs, todayPacks, packProgress, duels, challenges,
  } = useApp();
  const liveChallenges = challenges.filter(c => !c.finalized && c.endsAt > nowMs());
  const openPacks = packs.filter(p => p.kind === 'open');
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

  return (
    <div className="space-y-5 pb-6">
      {/* Header - Tartibli va chiroyli 2 qatorli joylashuv */}
      <header className="space-y-3 pt-1">
        {/* 1-qator: Foydalanuvchi ma'lumotlari to'liq hajmda */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar
              src={profile.avatar}
              name={profile.name}
              frame={profile.activeFrame}
              crown={profile.hasCrown}
              className="w-13 h-13 border-2 border-slate-700/80 shadow-md shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className={`text-base sm:text-lg font-black truncate max-w-[170px] sm:max-w-none ${profile.hasGlowingNick ? 'bg-gradient-to-r from-amber-300 via-rose-300 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]' : 'text-white'}`}>
                  {profile.name}
                </h1>
                {profile.hasVipCheck && (
                  <span className="w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] flex items-center justify-center font-black shrink-0 shadow-[0_0_8px_rgba(14,165,233,0.5)]" title="VIP foydalanuvchi">✓</span>
                )}
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">{profile.level}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {profile.activeTitle && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-sky-500/20 border border-amber-400/40 text-amber-300 shadow-sm">
                    {profile.activeTitle}
                  </span>
                )}
                <p className="text-[11px] text-slate-400">Kuniga {profile.wordsPerDay} ta yangi so&apos;z</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/30 text-amber-400 hover:scale-105 active:scale-95 transition-all shadow-md shrink-0"
            title="Do'konga o'tish"
          >
            <ShoppingBag className="w-5 h-5 text-amber-400" />
          </button>
        </div>

        {/* 2-qator: Streak, Tangalar va XP ko'rsatkichlari sig'adigan 3 ta teng karta */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-2xl bg-[#141B28]/90 border border-orange-500/30 text-orange-400 shadow-sm">
            <Flame className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="text-xs font-black tabular-nums">{profile.streak} kun</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-2xl bg-[#141B28]/90 border border-yellow-500/30 text-yellow-300 hover:border-yellow-400/60 active:scale-95 transition-all shadow-sm"
            title="Tangalar balansi"
          >
            <Coins className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-xs font-black tabular-nums">{profile.coins ?? 50} tanga</span>
          </button>
          <div className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-2xl bg-[#141B28]/90 border border-sky-500/30 text-sky-400 shadow-sm">
            <Diamond className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-xs font-black tabular-nums">{profile.xp} XP</span>
          </div>
        </div>
      </header>

      {/* Bugungi mashq */}
      <section className="rounded-3xl bg-gradient-to-br from-[#1B2433] to-[#121822] border border-slate-800 p-5 space-y-4 shadow-xl shadow-black/20">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-amber-400">Bugungi mashq</h2>
          <div className="text-xs text-slate-400 mt-1">Bugun o&apos;rganildi: <b className="text-slate-200">{introducedToday}</b></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#0E1524] border border-slate-800 p-3">
            <div className="text-2xl font-extrabold text-sky-400 tabular-nums">{newQueue.length}</div>
            <div className="text-[11px] text-slate-400">yangi so&apos;z</div>
          </div>
          <div className="rounded-2xl bg-[#0E1524] border border-slate-800 p-3">
            <div className="text-2xl font-extrabold text-emerald-400 tabular-nums">{dueWords.length}</div>
            <div className="text-[11px] text-slate-400">takrorlash kerak</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { triggerHaptic('medium'); openLearn(); }}
          disabled={allDone}
          className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
        >
          {allDone ? <><CheckCircle2 className="w-5 h-5" /> Bugungi reja bajarildi</> : <><Play className="w-5 h-5 fill-slate-950" /> Mashqni boshlash</>}
        </button>
        {todayPacks.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-sky-500/10 border border-sky-500/30 px-3 py-2 text-[11px] text-sky-300">
            <BookMarked className="w-4 h-4 shrink-0" />
            <span className="truncate">Bugungi lug‘at: <b>{todayPacks.map(p => p.title).join(', ')}</b></span>
          </div>
        )}
        {allDone && <p className="text-[11px] text-slate-400 text-center">Ajoyib! O&apos;yinlar bo&apos;limida so&apos;zlarni mustahkamlang yoki ertaga qayting.</p>}
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

      {/* Do'stlarni taklif qilish va do'kon tezkor bloki */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            try { sessionStorage.setItem('vb_liga_sub', 'referral'); } catch { /* ignore */ }
            setActiveTab('leaderboard');
          }}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 text-left hover:border-indigo-400/60 active:scale-[0.98] transition-all group"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <UserPlus className="w-5 h-5" />
          </div>
          <div className="text-xs font-black text-white">Do‘stlarni taklif et</div>
          <div className="text-[10px] text-indigo-300 font-bold mt-0.5">+50 XP & +30 Tanga</div>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setActiveTab('shop');
          }}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-900/40 to-yellow-900/40 border border-amber-500/30 text-left hover:border-amber-400/60 active:scale-[0.98] transition-all group"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="text-xs font-black text-white">VocaBoost Do‘koni</div>
          <div className="text-[10px] text-amber-300 font-bold mt-0.5">2x XP, Kitoblar, Lo-Fi</div>
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
