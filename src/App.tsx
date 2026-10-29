import React, { useEffect, useState } from 'react';
import { Megaphone, ExternalLink, Music, Pause, Play, SkipForward, X } from 'lucide-react';
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
import { CertificateModal } from './components/CertificateModal';
import { StreakPopup } from './components/StreakPopup';
import { LuckyWheel } from './components/LuckyWheel';
import { BrandMark, Logo, HeaderActions } from './components/Brand';
import { installGlobalClickSound } from './services/sound';
import { lofiPlayer } from './services/lofiPlayer';

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

/** Barcha sahifalarda ko'rinuvchi doimiy suzuvchi Lo-Fi mini-pleyer */
const GlobalLofiBar: React.FC = () => {
  const [playing, setPlaying] = useState(() => lofiPlayer.isPlaying());
  const [visible, setVisible] = useState(() => lofiPlayer.isBarVisible() || lofiPlayer.isPlaying());

  useEffect(() => {
    return lofiPlayer.subscribe(() => {
      setPlaying(lofiPlayer.isPlaying());
      setVisible(lofiPlayer.isBarVisible() || lofiPlayer.isPlaying());
    });
  }, []);

  if (!visible) return null;
  const track = lofiPlayer.getCurrentTrack();

  return (
    <div className="fixed bottom-[74px] left-0 right-0 z-[85] px-3.5 pointer-events-none animate-in slide-in-from-bottom-2 fade-in">
      <div className="max-w-md mx-auto pointer-events-auto rounded-2xl bg-[#111827]/95 backdrop-blur-md border border-amber-500/40 p-2.5 shadow-2xl flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
            <Music className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black text-white truncate flex items-center gap-1.5">
              <span>{track?.title || 'Lo-Fi Study Beats'}</span>
              {playing && (
                <span className="flex gap-0.5 items-end h-2.5 shrink-0">
                  <span className="w-0.5 h-2.5 bg-amber-400 animate-bounce" />
                  <span className="w-0.5 h-1.5 bg-amber-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-0.5 h-2 bg-amber-400 animate-bounce [animation-delay:0.4s]" />
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate">{track?.artist || 'VocaBoost Beats'}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => lofiPlayer.toggle()}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              playing ? 'bg-amber-400 text-slate-950 shadow-sm' : 'bg-slate-800 text-slate-200'
            }`}
            title={playing ? 'Pauza' : 'Ijro'}
          >
            {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => lofiPlayer.next()}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all"
            title="Keyingi musiqa"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => lofiPlayer.dismiss()}
            className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-200 flex items-center justify-center ml-0.5"
            title="Yopish"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MainScreen: React.FC = () => {
  const { profile, activeTab, overlay, announcement, certificateView, showCertificate, notice, syncReady, realtimeOn, totalSpinsLeft } = useApp();
  const [showWheelModal, setShowWheelModal] = useState(false);

  // Ilovadagi har bir tugmaga qisqa "ping" tovushi
  useEffect(() => {
    installGlobalClickSound();
  }, []);

  // Yangi qurilmada bulutdagi progress yuklanguncha onboarding ko'rsatilmaydi
  if (realtimeOn && !syncReady && !profile.hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center gap-4 text-sm text-slate-400">
        <Logo className="w-24 h-24 animate-pulse" glow />
        Yuklanmoqda…
      </div>
    );
  }
  if (!profile.hasCompletedOnboarding) return <Onboarding />;

  const certificate = certificateView ? <CertificateModal cert={certificateView} onClose={() => showCertificate(null)} /> : null;
  const toast = notice ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] px-4 py-2.5 rounded-xl bg-slate-800 border border-amber-500/40 text-xs font-medium text-white shadow-xl max-w-[92%] text-center">{notice}</div>
  ) : null;

  const themeClass = profile.activeTheme ? `theme-${profile.activeTheme}` : '';
  const hasLofi = !!profile.hasLofiMusic || (profile.inventory || []).includes('lofi_music') || (profile.inventory || []).includes('lofi_music_pass');

  if (overlay?.type === 'learn') return <><LearnSession />{certificate}{toast}{hasLofi && <GlobalLofiBar />}</>;
  if (overlay?.type === 'game') return <><GameScreen id={overlay.id} />{certificate}{toast}{hasLofi && <GlobalLofiBar />}</>;
  if (overlay?.type === 'survival') return <><SurvivalRun id={overlay.id} />{certificate}{toast}{hasLofi && <GlobalLofiBar />}</>;

  return (
    <div className={`min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-between selection:bg-amber-500/20 selection:text-amber-300 ${themeClass}`}>
      <div className="flex-1 max-w-md w-full mx-auto px-4 pt-3 pb-24">
        {/* Yuqori panel: logotip (chapda) va tovush/sovg'a/tema tugmalari (o'ngda) */}
        <div className="flex items-center justify-between mb-3">
          <BrandMark />
          <HeaderActions
            showGift={activeTab === 'home'}
            onGiftClick={() => setShowWheelModal(true)}
            spinsCount={totalSpinsLeft}
          />
        </div>
        {announcement && <AnnouncementBanner text={announcement.text} />}
        {activeTab === 'home' && <HomeTab />}
        {activeTab === 'words' && <WordsTab />}
        {activeTab === 'shop' && <ShopTab />}
        {activeTab === 'games' && <GamesTab />}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
      </div>
      {hasLofi && <GlobalLofiBar />}
      <BottomNav />
      {certificate}
      {toast}
      {/* Tepa paneldagi sovg'acha bosilganda baraban ochiladi */}
      {showWheelModal && <LuckyWheel onClose={() => setShowWheelModal(false)} />}
      {/* Streak oynasi: mashq/o'yin tugab, bosh sahifaga qaytilganda ko'rinadi */}
      <StreakPopup />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainScreen />
    </AppProvider>
  );
}
