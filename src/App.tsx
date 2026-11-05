import React, { useEffect, useState, useRef } from 'react';
import { Megaphone, ExternalLink } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Onboarding } from './components/Onboarding';
import { BottomNav } from './components/BottomNav';
import { HomeTab } from './components/HomeTab';
import { WordsTab } from './components/WordsTab';
import { GamesTab, GameScreen } from './components/Games';
import { SurvivalRun } from './components/SurvivalRun';
import { LearnSession } from './components/Learn';
import { LeaderboardTab } from './components/LeaderboardTab';
import { ShopTab } from './components/ShopTab';
import { LofiMini } from './components/LofiPlayer';
import { CertificateModal } from './components/CertificateModal';
import { StreakPopup } from './components/StreakPopup';
import { WelcomePopup, welcomeSeen, markWelcomeSeen } from './components/WelcomePopup';
import { RankChangePopup, loadLastRank, saveLastRank, RankDelta } from './components/RankChangePopup';
import { LuckyWheel } from './components/LuckyWheel';
import { BrandMark, Logo, HeaderActions } from './components/Brand';
import { installGlobalClickSound } from './services/sound';
import { WeatherFx } from './components/WeatherFx';

/** E'lon matnidagi havolalarni (http, https, t.me) avtomatik ko'k rangda bosiladigan qiluvchi komponent */
const AnnouncementBanner: React.FC<{ text: string }> = ({ text }) => {
  const renderFormatted = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+|t\.me\/[^\s]+)/gi;
    const parts = content.split(urlRegex);
    return parts.map((part, i) => {
      if (/^(https?:\/\/|t\.me\/)/i.test(part)) {
        const href = part.startsWith('http') ? part : `https://${part}`;
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 font-bold underline inline-flex items-center gap-0.5 break-all transition-colors"
          >
            <span>{part}</span>
            <ExternalLink className="w-3 h-3 shrink-0 inline ml-0.5" />
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="vb-announce mb-3.5 p-3.5 rounded-2xl border-2 border-amber-400/40 shadow-lg shadow-amber-500/10 text-xs text-slate-100 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="px-2 py-0.5 rounded-md bg-amber-400/25 text-amber-300 font-extrabold text-[10px] tracking-wider uppercase border border-amber-400/40 flex items-center gap-1">
          <Megaphone className="w-3 h-3 text-amber-400 shrink-0" />
          DIQQAT E'LON
        </span>
      </div>
      <div className="leading-relaxed whitespace-pre-line text-slate-200 text-xs font-medium pl-0.5">
        {renderFormatted(text)}
      </div>
    </div>
  );
};

const MainScreen: React.FC = () => {
  const { profile, activeTab, overlay, announcement, certificateView, showCertificate, notice, syncReady, realtimeOn, totalSpinsLeft, coins, setActiveTab, shopConf, leagueUsers, leagueLive } = useApp();
  const [showWheelModal, setShowWheelModal] = useState(false);
  const [rankDelta, setRankDelta] = useState<RankDelta | null>(null);

  // Ilovadagi har bir tugmaga qisqa "ping" tovushi
  useEffect(() => {
    installGlobalClickSound();
  }, []);

  // Faqat BIRINCHI kirishda «Xush kelibsiz» oynasi. Avval ro'yxatdan o'tgan (eski) foydalanuvchilarga ko'rsatilmaydi.
  const [welcome, setWelcome] = useState(() => !welcomeSeen());
  useEffect(() => {
    if (profile.hasCompletedOnboarding) markWelcomeSeen();
  }, [profile.hasCompletedOnboarding]);

  // Reyting o'zgarishi: birinchi marta kirganlar uchun emas, keyingi kirishlarda kreativ popup
  const rankCheckedRef = useRef(false);
  useEffect(() => {
    if (rankCheckedRef.current) return;
    if (!profile.hasCompletedOnboarding || !leagueLive || !leagueUsers.length) return;
    const meIdx = leagueUsers.findIndex(u => u.isCurrentUser);
    if (meIdx < 0) return;
    const curr = meIdx + 1;
    const prev = loadLastRank();
    rankCheckedRef.current = true;
    if (prev == null) {
      // Birinchi marta kirgan foydalanuvchi: joriy o'rin saqlanadi, popup chiqmaydi
      saveLastRank(curr);
      return;
    }
    if (prev === curr) return;
    // O'sish yoki pasayish — kreativ popup
    setRankDelta({ prev, curr, delta: prev - curr }); // + = ko'tarilish (prev > curr)
    saveLastRank(curr);
  }, [profile.hasCompletedOnboarding, leagueLive, leagueUsers]);

  // Yangi qurilmada bulutdagi progress yuklanguncha onboarding ko'rsatilmaydi
  if (realtimeOn && !syncReady && !profile.hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center gap-4 text-sm text-slate-400">
        <Logo className="w-24 h-24 animate-pulse" glow />
        Yuklanmoqda…
      </div>
    );
  }
  if (!profile.hasCompletedOnboarding) return <><Onboarding />{welcome && <WelcomePopup onClose={() => setWelcome(false)} />}</>;

  const certificate = certificateView ? <CertificateModal cert={certificateView} onClose={() => showCertificate(null)} /> : null;
  const toast = notice ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] px-4 py-2.5 rounded-xl bg-slate-800 border border-amber-500/40 text-xs font-medium text-white shadow-xl max-w-[92%] text-center">{notice}</div>
  ) : null;

  if (overlay?.type === 'learn') return <><LearnSession />{certificate}{toast}</>;
  if (overlay?.type === 'game') return <><GameScreen id={overlay.id} />{certificate}{toast}</>;
  if (overlay?.type === 'survival') return <><SurvivalRun id={overlay.id} />{certificate}{toast}</>;

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-between selection:bg-amber-500/20 selection:text-amber-300">
      <div className="flex-1 max-w-md w-full mx-auto px-4 pt-3 pb-24">
        {/* Yuqori panel: logotip (chapda) va tovush/sovg'a/tema tugmalari (o'ngda) */}
        <div className="flex items-center justify-between mb-3">
          <BrandMark />
          <button type="button" data-nosfx onClick={() => setActiveTab('shop')} className="ml-auto mr-2 px-2.5 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-sm font-extrabold tabular-nums flex items-center gap-1 active:scale-95" title="Tangalar — do'kon">🪙 {coins.toLocaleString()}</button>
          <HeaderActions
            showGift={activeTab === 'home'}
            onGiftClick={() => setShowWheelModal(true)}
            spinsCount={totalSpinsLeft}
          />
        </div>
        {announcement && <AnnouncementBanner text={announcement.text} />}
        {activeTab === 'home' && <HomeTab />}
        {activeTab === 'words' && <WordsTab />}
        {activeTab === 'games' && <GamesTab />}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
        {activeTab === 'shop' && <ShopTab />}
      </div>
      <BottomNav />
      {activeTab !== 'home' && <LofiMini />}
      {certificate}
      {toast}
      {/* Tepa paneldagi sovg'acha bosilganda baraban ochiladi */}
      {showWheelModal && <LuckyWheel onClose={() => setShowWheelModal(false)} />}
      {/* Streak oynasi: mashq/o'yin tugab, bosh sahifaga qaytilganda ko'rinadi */}
      <StreakPopup />
      {/* Reyting o'zgarishi (birinchi kirishdan tashqari) */}
      {rankDelta && !welcome && (
        <RankChangePopup data={rankDelta} onClose={() => setRankDelta(null)} />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainScreen />
      <WeatherFx />
    </AppProvider>
  );
}
