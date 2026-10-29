import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  Flame,
  Diamond,
  Settings,
  Award,
  BookOpen,
  Brain,
  RotateCcw,
  CheckCircle2,
  Volume2,
  VolumeX,
  Users,
  Landmark,
  MessageSquare,
  X,
  Send,
  UserPlus,
  Share2,
  Copy,
  Check,
  Sparkles,
  Coins,
  Music,
  Play,
  Pause,
  SkipForward
} from 'lucide-react';
import { lofiPlayer } from '../services/lofiPlayer';
import { useApp } from '../context/AppContext';
import { EnglishLevel } from '../types';
import { triggerHaptic, getTelegramUserData } from '../services/telegram';
import { compressImage, AVATAR_PRESETS, presetValue } from '../services/avatar';
import { useSfx } from '../services/sound';
import { botSetRemind } from '../services/bot';
import { Avatar } from './Avatar';
import { DuelTab } from './DuelTab';
import { ChallengesTab } from './ChallengesTab';
import { Podium, GlowAvatar } from './Podium';
import { HallOfHistory } from './HallOfHistory';
import { loadHall, championCounts } from '../services/hall';
import { sendAdminMessage, MsgKind } from '../services/inbox';

export const LeaderboardTab: React.FC = () => {
  const { profile, savedWords, badges, updateProfile, resetProgress, leagueUsers, leagueLive, realtimeOn, showCertificate, certificates, accountId, isTelegram, linkAccount, realtimeOn: rtOn, leagueWeek, referralConfig } = useApp();
  const [linkCode, setLinkCode] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [lbMode, setLbMode] = useState<'xp' | 'referral'>('xp');
  const [refCopied, setRefCopied] = useState(false);

  const botUsername = (window as any).Telegram?.WebApp?.initDataUnsafe?.bot_username || 'VocaBoostProBot';
  const refLink = `https://t.me/${botUsername}?start=ref_${accountId}`;

  const { pendingDuelCode, lofiTracks, setActiveTab } = useApp();
  const hasLofi = !!profile.hasLofiMusic || (profile.inventory || []).includes('lofi_music') || (profile.inventory || []).includes('lofi_music_pass');
  const [isPlayingLofi, setIsPlayingLofi] = useState(() => lofiPlayer.isPlaying());
  const [currentTrackIndex, setCurrentTrackIndex] = useState(() => lofiPlayer.getCurrentIndex());

  useEffect(() => {
    if (lofiTracks && lofiTracks.length) lofiPlayer.setTracks(lofiTracks);
    const unsub = lofiPlayer.subscribe(() => {
      setIsPlayingLofi(lofiPlayer.isPlaying());
      setCurrentTrackIndex(lofiPlayer.getCurrentIndex());
    });
    return unsub;
  }, [lofiTracks]);
  const currentLofiTrack = lofiTracks?.[currentTrackIndex] || lofiTracks?.[0];
  const [activeSubTab, setActiveSubTab] = useState<'league' | 'duel' | 'challenge' | 'profile' | 'hall'>(() => {
    let want = '';
    try {
      want = sessionStorage.getItem('vb_liga_sub') || '';
      sessionStorage.removeItem('vb_liga_sub');
    } catch {
      /* ignore */
    }
    return pendingDuelCode || want === 'duel' ? 'duel' : want === 'challenge' ? 'challenge' : want === 'referral' ? 'profile' : 'league';
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);

  // Haftalik chempionlar (Tarix zalidan): podium va ro'yxatda 🏆 belgisi uchun. Ma'lumot o'zgarmaydi, bir marta yuklanadi.
  const [champs, setChamps] = useState<Record<string, { gold: number; top3: number }>>({});
  useEffect(() => {
    let dead = false;
    loadHall()
      .then(w => !dead && setChamps(championCounts(w)))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, []);

  // Adminga xabar yozish
  const [showMsg, setShowMsg] = useState(false);
  const [msgKind, setMsgKind] = useState<MsgKind>('savol');
  const [msgText, setMsgText] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgInfo, setMsgInfo] = useState<{ ok: boolean; text: string } | null>(null);
  const submitMsg = async () => {
    if (msgBusy) return;
    const text = msgText.trim();
    if (text.length < 3) return setMsgInfo({ ok: false, text: 'Xabarni biroz batafsilroq yozing' });
    setMsgBusy(true);
    setMsgInfo(null);
    try {
      await sendAdminMessage(accountId, profile.name, msgKind, text);
      triggerHaptic('success');
      setMsgInfo({ ok: true, text: '✅ Xabaringiz adminga yuborildi. Rahmat!' });
      setMsgText('');
    } catch (e: any) {
      triggerHaptic('error');
      setMsgInfo({ ok: false, text: e?.message || 'Yuborib bo‘lmadi, qayta urinib ko‘ring' });
    } finally {
      setMsgBusy(false);
    }
  };

  // Settings form state
  const [editName, setEditName] = useState(profile.name);
  const [editLevel, setEditLevel] = useState<EnglishLevel>(profile.level);
  const [editPerDay, setEditPerDay] = useState<number>(profile.wordsPerDay);
  const [editRemind, setEditRemind] = useState(profile.botRemind !== false);
  const [editAvatar, setEditAvatar] = useState(profile.avatar);
  const [sfxOn, setSfxOn] = useSfx();

  const tgInfo = getTelegramUserData();
  const tgAvatar = tgInfo.avatar || (isTelegram ? profile.avatar : undefined);

  // Real vaqtdagi umumiy reyting (barcha foydalanuvchilar: XP yoki Takliflar bo'yicha)
  const leaderboardList = useMemo(() => {
    if (lbMode === 'referral') {
      return [...leagueUsers].sort((a, b) => ((b.refCount || 0) - (a.refCount || 0)) || (b.xp - a.xp));
    }
    return leagueUsers;
  }, [leagueUsers, lbMode]);

  const currentUserRank = leaderboardList.findIndex(u => u.isCurrentUser) + 1;

  // Raqobatni qizdiruvchi qisqa gap: kimgacha necha XP qolgan
  const rivalLine = (() => {
    if (!currentUserRank || leaderboardList.length < 2) return '';
    const me = leaderboardList[currentUserRank - 1];
    if (currentUserRank === 1) {
      const gap = me.xp - (leaderboardList[1]?.xp || 0);
      return `👑 Siz 1-o‘rindasiz! Ikkinchi o‘rindagi sizdan ${gap.toLocaleString()} XP orqada — taxtni qo‘ldan bermang!`;
    }
    const above = leaderboardList[currentUserRank - 2];
    const gap = Math.max(1, above.xp - me.xp + 1);
    if (currentUserRank <= 3) return `🔥 Siz TOP-3 dasiz! ${currentUserRank - 1}-o‘ringa chiqish uchun yana ${gap.toLocaleString()} XP kerak.`;
    const third = leaderboardList[2];
    const toTop3 = third ? Math.max(1, third.xp - me.xp + 1) : 0;
    return `⚡ ${currentUserRank - 1}-o‘ringa ${gap.toLocaleString()} XP qoldi${toTop3 ? ` · TOP-3 gacha ${toTop3.toLocaleString()} XP` : ''}. Bugun bir mashq ko‘proq qiling!`;
  })();

  const handleSaveSettings = () => {
    triggerHaptic('success');
    const name = editName.trim() || "O'quvchi";
    updateProfile({
      name,
      level: editLevel,
      wordsPerDay: editPerDay,
      dailyGoalMinutes: Math.round(6 + editPerDay * 0.7),
      avatar: editAvatar,
      botRemind: editRemind,
      customName: profile.customName || name !== profile.name,
      // Telegram rasmi tanlansa — avtomatik yangilanib turadi; boshqasi tanlansa — o'zgarmas
      customAvatar: editAvatar === tgAvatar ? false : profile.customAvatar || editAvatar !== profile.avatar,
    });
    if (isTelegram && editRemind !== (profile.botRemind !== false)) botSetRemind(editRemind).catch(() => {});
    setShowSettingsModal(false);
  };

  return (
    <div className="space-y-4 pb-8 max-w-md mx-auto">
      {/* Top Bar with Settings Icon */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Reyting va Profil</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ligada bellashing va yutuqlaringizni kuzating
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setShowSettingsModal(true);
          }}
          className="w-10 h-10 rounded-xl bg-[#151C28] hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300 transition-colors"
          title="Sozlamalar"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Segmented Sub-Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-[#151C28] rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setActiveSubTab('league');
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center ${
            activeSubTab === 'league'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🏆 Liga
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setActiveSubTab('challenge');
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center ${
            activeSubTab === 'challenge'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🏁 Chellenj
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setActiveSubTab('duel');
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center ${
            activeSubTab === 'duel'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ⚔️ Bellashuv
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setActiveSubTab('profile');
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center ${
            activeSubTab === 'profile'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          👤 Profil
        </button>
      </div>

      {/* SUB-VIEW 1: Haftalik Liga */}
      {activeSubTab === 'league' && (
        <div className="space-y-3">
          {/* 2 xil reyting almashtirgichi: Haftalik XP va Targ'ibotchilar */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#0E1524] border border-slate-800">
            <button
              type="button"
              onClick={() => { triggerHaptic('selection'); setLbMode('xp'); }}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                lbMode === 'xp' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Diamond className="w-3.5 h-3.5" />
              <span>⚡ Haftalik XP</span>
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic('selection'); setLbMode('referral'); }}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                lbMode === 'referral' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md font-extrabold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>👥 Targ‘ibotchilar</span>
            </button>
          </div>

          {/* Top 3 Podium Box */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-[#151C28] via-[#1B2433] to-[#121822] border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 font-semibold text-[11px] shadow-sm">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {lbMode === 'referral'
                    ? "Targ'ibotchilar ligasi"
                    : (leagueWeek ? `${leagueWeek.week}-hafta · ` : '') + (leaderboardList.length > 0 ? `${leaderboardList.length.toLocaleString()} ta o'quvchi` : 'O\'quvchilar...')}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  {realtimeOn && leagueLive && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${realtimeOn && leagueLive ? 'bg-emerald-400' : realtimeOn ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
                </span>
                {!realtimeOn ? 'Oflayn rejim' : leagueLive ? 'Jonli reyting' : 'Reyting yuklanmoqda…'}
              </span>
            </div>

            <Podium users={leaderboardList.slice(0, 3)} badges={champs} mode={lbMode} />
          </div>

          {/* Raqobat: kimgacha necha XP qolgan + Tarix zali */}
          {lbMode === 'xp' && rivalLine && (
            <div className="rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-rose-500/15 border border-orange-500/30 px-3.5 py-2.5 text-xs font-semibold text-amber-100 leading-snug">{rivalLine}</div>
          )}
          {lbMode === 'referral' && (
            <div className="rounded-2xl bg-gradient-to-r from-indigo-500/20 via-purple-500/15 to-pink-500/20 border border-indigo-500/40 p-3 flex items-center justify-between gap-2">
              <div className="text-xs text-indigo-100">
                <span className="font-extrabold text-white">Har bir taklif uchun:</span> +{referralConfig?.rewardXp || 50} XP va +{referralConfig?.rewardCoins || 30} tanga!
              </div>
              <button
                type="button"
                onClick={() => { triggerHaptic('selection'); setActiveSubTab('profile'); }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-black active:scale-95 transition-all shadow-md shadow-indigo-500/20"
              >
                Linkim →
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => { triggerHaptic('medium'); setActiveSubTab('hall'); }}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border border-amber-500/40 flex items-center gap-3 text-left active:scale-[0.99] transition-all"
          >
            <Landmark className="w-6 h-6 text-amber-400 shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-extrabold text-white">Tarix zali</span>
              <span className="block text-[11px] text-slate-400">Oldingi haftalarning TOP-20 chempionlari · abadiy saqlanadi</span>
            </span>
            <span className="text-amber-400 text-lg">›</span>
          </button>

          {/* Current User Fixed Position Strip */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/50 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-base text-amber-400 w-6 text-center tabular-nums">
                #{currentUserRank || '-'}
              </span>
              <Avatar
                src={profile.avatar}
                name={profile.name}
                frame={profile.activeFrame}
                crown={profile.hasCrown}
                className="w-10 h-10 border border-amber-400"
              />
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`font-bold text-sm ${profile.hasGlowingNick ? 'bg-gradient-to-r from-amber-300 via-rose-300 to-amber-200 bg-clip-text text-transparent font-black drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-white'}`}>
                    {profile.name} (Siz)
                  </span>
                  {profile.hasVipCheck && <span className="w-3.5 h-3.5 rounded-full bg-sky-500 text-white text-[9px] flex items-center justify-center font-black shrink-0">✓</span>}
                  {profile.activeTitle && <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">{profile.activeTitle}</span>}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>{profile.level}</span>
                  <span>·</span>
                  <span className="text-orange-400 flex items-center gap-0.5">
                    <Flame className="w-3 h-3 fill-orange-400 inline" /> {profile.streak} kun
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              {lbMode === 'referral' ? (
                <div>
                  <div className="font-extrabold text-sm text-indigo-300 tabular-nums">
                    {(profile.refCount || 0).toLocaleString()} ta do&apos;st
                  </div>
                  <div className="text-[10px] text-slate-400">
                    +{((profile.refCount || 0) * (referralConfig?.rewardXp || 50)).toLocaleString()} XP
                  </div>
                </div>
              ) : (
                <span className="font-extrabold text-sm text-amber-400 tabular-nums">
                  {profile.xp} XP
                </span>
              )}
            </div>
          </div>

          {/* Remaining Rankings List */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs text-slate-400 font-semibold uppercase px-1">
              {lbMode === 'referral' ? "Targ'ibotchilar ro'yxati" : 'Barcha Ishtirokchilar'}
            </span>
            {leaderboardList.slice(0, displayLimit).map((user, idx) => {
              const rank = idx + 1;
              const isMe = user.isCurrentUser;

              return (
                <div
                  key={user.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                    isMe
                      ? 'bg-amber-500/15 border-amber-500/60'
                      : 'bg-[#151C28] border-slate-800/80 hover:bg-[#1B2333]'
                  } ${rank === 1 ? 'row-gold' : rank === 2 ? 'row-silver' : rank === 3 ? 'row-bronze' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-xs text-slate-400 w-5 text-center tabular-nums shrink-0">
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                    </span>
                    {rank <= 3 ? (
                      <GlowAvatar rank={rank as 1 | 2 | 3} src={user.avatar} name={user.name} size={36} frame={user.frame} crown={user.crown} />
                    ) : (
                      <Avatar
                        src={user.avatar}
                        name={user.name}
                        frame={user.frame}
                        crown={user.crown}
                        className="w-8 h-8 shrink-0"
                      />
                    )}
                    <div className="truncate max-w-[160px] min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`font-semibold text-xs truncate ${user.glowingNick ? 'bg-gradient-to-r from-amber-300 via-rose-300 to-amber-200 bg-clip-text text-transparent font-black drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-white'}`}>
                          {user.name}
                        </span>
                        {user.vipCheck && <span className="w-3.5 h-3.5 rounded-full bg-sky-500 text-white text-[9px] flex items-center justify-center font-black shrink-0">✓</span>}
                        {user.titleBadge && <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 truncate shrink-0">{user.titleBadge}</span>}
                        {champs[user.id]?.gold ? <span className="text-xs shrink-0">🏆×{champs[user.id].gold}</span> : null}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {user.level} · {user.streak} kun streak
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {lbMode === 'referral' ? (
                      <div>
                        <div className="font-bold text-xs text-indigo-300 tabular-nums">
                          {(user.refCount || 0).toLocaleString()} ta do&apos;st
                        </div>
                        <div className="text-[10px] text-slate-400">
                          +{((user.refCount || 0) * (referralConfig?.rewardXp || 50)).toLocaleString()} XP
                        </div>
                      </div>
                    ) : (
                      <span className="font-bold text-xs text-amber-400 tabular-nums">
                        {user.xp} XP
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {leaderboardList.length > displayLimit && (
              <button
                type="button"
                onClick={() => setDisplayLimit(l => l + 50)}
                className="w-full py-3 rounded-xl bg-[#1B2333] border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all active:scale-[0.98]"
              >
                Yana ko&apos;rsatish ({Math.min(displayLimit, leaderboardList.length)} / {leaderboardList.length})
              </button>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'hall' && <HallOfHistory onBack={() => setActiveSubTab('league')} />}
      {activeSubTab === 'duel' && <DuelTab />}
      {activeSubTab === 'challenge' && <ChallengesTab />}

      {/* SUB-VIEW 2: Shaxsiy Profil */}
      {activeSubTab === 'profile' && (
        <div className="space-y-4">
          {/* Profile Overview Card */}
          <div className="p-4 rounded-3xl bg-[#151C28] border border-slate-800 text-center space-y-3">
            <Avatar
              src={profile.avatar}
              name={profile.name}
              frame={profile.activeFrame}
              crown={profile.hasCrown}
              className="w-20 h-20 border-2 border-amber-500 mx-auto shadow-lg"
            />
            <div>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <h3 className={`text-lg font-bold ${profile.hasGlowingNick ? 'bg-gradient-to-r from-amber-300 via-rose-300 to-amber-200 bg-clip-text text-transparent font-black drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-white'}`}>
                  {profile.name}
                </h3>
                {profile.hasVipCheck && <span className="w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] flex items-center justify-center font-black shrink-0" title="VIP">✓</span>}
              </div>
              {profile.activeTitle && (
                <div className="mt-1">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-400/40 text-amber-300">
                    {profile.activeTitle}
                  </span>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Daraja: <strong className="text-amber-400">{profile.level}</strong> · Maqsad: kuniga {profile.wordsPerDay} ta so&apos;z
              </p>
            </div>

            {/* 4 Metrics Cards: XP, Streak, Tangalar, So'zlar */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
              <div className="p-2 rounded-xl bg-[#0E1524] border border-slate-800 text-center">
                <div className="text-sm font-bold text-amber-400 tabular-nums flex items-center justify-center gap-0.5">
                  <Diamond className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                  {profile.xp}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">XP</div>
              </div>

              <div className="p-2 rounded-xl bg-[#0E1524] border border-slate-800 text-center">
                <div className="text-sm font-bold text-orange-400 tabular-nums flex items-center justify-center gap-0.5">
                  <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-400 shrink-0" />
                  {profile.streak}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">Streak</div>
              </div>

              <div className="p-2 rounded-xl bg-[#0E1524] border border-slate-800 text-center">
                <div className="text-sm font-bold text-yellow-300 tabular-nums flex items-center justify-center gap-0.5">
                  <Coins className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  {profile.coins ?? 50}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">Tanga</div>
              </div>

              <div className="p-2 rounded-xl bg-[#0E1524] border border-slate-800 text-center">
                <div className="text-sm font-bold text-emerald-400 tabular-nums flex items-center justify-center gap-0.5">
                  <Brain className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {savedWords.length}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">So&apos;z</div>
              </div>
            </div>

            {/* Doimiy Lo-Fi Music for Studying Pleyeri (Faqat xarid qilganlarga ochiq) */}
            {hasLofi ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/70 border border-indigo-500/40 shadow-lg text-left mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPlayingLofi ? 'bg-indigo-500 text-slate-950 shadow-lg shadow-indigo-500/40 animate-pulse' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}`}>
                      <Music className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white flex items-center gap-1.5">
                        <span>Lo-Fi Study Player</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 font-bold">Faol</span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                        {currentLofiTrack?.title || 'Fokus & Diqqat musiqasi'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => lofiPlayer.toggle()}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all active:scale-95 ${
                        isPlayingLofi ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {isPlayingLofi ? <Pause className="w-3.5 h-3.5 fill-slate-950" /> : <Play className="w-3.5 h-3.5 fill-slate-200" />}
                      <span>{isPlayingLofi ? 'Pauza' : 'Ijro'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => lofiPlayer.next()}
                      className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all"
                      title="Keyingi trek"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setActiveTab('shop')}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#0E1524] border-2 border-indigo-200 dark:border-indigo-500/30 flex items-center justify-between cursor-pointer hover:border-indigo-400 transition-all mt-3 text-left shadow-sm dark:shadow-none"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-slate-800/80 text-indigo-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                      <span>Lo-Fi Music for Studying</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30 font-bold">🔒 Qulflangan</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Do‘kondan xarid qiling va profilingizda doimiy tinglang</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-[10px] font-bold transition-all shadow-sm shrink-0"
                >
                  Ochish →
                </button>
              </div>
            )}
          </div>

          {/* Do'stlarni taklif qilish (Referral tizimi) */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-[#1C1A3A] via-[#161B2E] to-[#121622] border-2 border-indigo-500/40 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Do‘stlarni taklif qilish</h4>
                  <p className="text-[11px] text-indigo-300 font-semibold">
                    Har bir do‘st uchun +{referralConfig?.rewardXp || 50} XP va +{referralConfig?.rewardCoins || 30} tanga
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/25 border border-indigo-400/40 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                Bonus
              </span>
            </div>

            {/* Referral Statistikasi */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-[#0D111A]/80 border border-slate-800 text-center">
              <div>
                <div className="text-base font-black text-indigo-400 tabular-nums">{profile.refCount || 0}</div>
                <div className="text-[10px] text-slate-400">Do‘stlar</div>
              </div>
              <div>
                <div className="text-base font-black text-amber-400 tabular-nums">+{profile.refXpEarned || ((profile.refCount || 0) * (referralConfig?.rewardXp || 50))}</div>
                <div className="text-[10px] text-slate-400">Bonus XP</div>
              </div>
              <div>
                <div className="text-base font-black text-yellow-300 tabular-nums">+{profile.refCoinsEarned || ((profile.refCount || 0) * (referralConfig?.rewardCoins || 30))}</div>
                <div className="text-[10px] text-slate-400">Tangalar</div>
              </div>
            </div>

            {/* Havola (Link) nusxalash qatori */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-300 font-semibold flex items-center justify-between">
                <span>Shaxsiy taklif havolangiz:</span>
                {refCopied && <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1"><Check className="w-3 h-3" /> Nusxa olindi!</span>}
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#090D14] border border-slate-700">
                <input
                  type="text"
                  readOnly
                  value={refLink}
                  className="flex-1 bg-transparent px-2.5 py-1 text-xs text-slate-200 outline-none truncate font-mono select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('success');
                    navigator.clipboard.writeText(refLink).catch(() => {});
                    setRefCopied(true);
                    setTimeout(() => setRefCopied(false), 2500);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{refCopied ? 'Nusxa' : 'Nusxalash'}</span>
                </button>
              </div>
            </div>

            {/* Telegramda ulashish tugmasi */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                const inviteText = (referralConfig?.inviteText || "Salom! Men VocaBoost orqali ingliz tili so'zlarini o'rganyapman. Siz ham qo'shiling va birga rivojlanaylik!");
                const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(inviteText)}`;
                if ((window as any).Telegram?.WebApp?.openTelegramLink) {
                  (window as any).Telegram.WebApp.openTelegramLink(shareUrl);
                } else {
                  window.open(shareUrl, '_blank');
                }
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:to-pink-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>Telegram orqali do‘stlarga ulashish 🚀</span>
            </button>

            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Do‘stingiz havola orqali botga start bosgan zahoti, Telegramingizga darhol xabar boradi va hisobingizga +{referralConfig?.rewardXp || 50} XP qo‘shiladi!
            </p>
          </div>

          {/* Adminga xabar */}
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setMsgInfo(null); setShowMsg(true); }}
            className="w-full p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center gap-3 text-left active:scale-[0.99] transition-all"
          >
            <MessageSquare className="w-5 h-5 text-sky-400 shrink-0" />
            <span className="flex-1">
              <span className="block text-sm font-bold text-white">Adminga xabar yozish</span>
              <span className="block text-[11px] text-slate-400">Savol, muammo yoki taklifingizni yuboring</span>
            </span>
          </button>

          {/* Sertifikatlar */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 px-1">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Sertifikatlarim ({certificates.length})</span>
            </h4>
            {certificates.length === 0 ? (
              <p className="text-xs text-slate-500 px-1">100, 250, 500, 750 va 1000 ta so&apos;zni yodlaganingizda ismingiz yozilgan sertifikat avtomatik beriladi. Admin ham sizga maxsus sertifikat yuborishi mumkin.</p>
            ) : (
              <div className="grid gap-2">
                {certificates.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => showCertificate(c)}
                    className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between text-left"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{c.title}{c.special ? ' ⭐' : ''}</div>
                      <div className="text-[11px] text-slate-400">{c.date} · № {c.id}</div>
                    </div>
                    <span className="text-xs font-bold text-amber-400">Ko&apos;rish 🎓</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Badges / Achievements Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 px-1">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Yutuqlar &amp; Nishonlar ({badges.filter(b => b.unlocked).length} / {badges.length})</span>
            </h4>

            <div className="grid gap-2">
              {badges.map(badge => (
                <div
                  key={badge.id}
                  className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                    badge.unlocked
                      ? 'bg-amber-500/10 border-amber-500/30 text-white'
                      : 'bg-[#151C28]/60 border-slate-800/60 opacity-60'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      badge.unlocked
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs flex items-center gap-2">
                      <span>{badge.titleUz}</span>
                      {badge.unlocked && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 rounded">
                          Ochilgan ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {badge.descriptionUz}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (O'ng tepadagi sozlamalar) */}
      {showMsg && (
        <div className="fixed inset-0 z-[115] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setShowMsg(false)}>
          <div className="w-full max-w-md rounded-3xl bg-[#151C28] border border-slate-700 p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2"><MessageSquare className="w-4 h-4 text-sky-400" /> Adminga xabar</h3>
              <button type="button" onClick={() => setShowMsg(false)} className="w-8 h-8 rounded-lg bg-[#0E1524] border border-slate-800 flex items-center justify-center" aria-label="Yopish"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {([['savol', '❓ Savol'], ['muammo', '🐞 Muammo'], ['taklif', '💡 Taklif'], ['boshqa', '💬 Boshqa']] as [MsgKind, string][]).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMsgKind(k)} className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${msgKind === k ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-[#0E1524] text-slate-300 border-slate-800'}`}>{l}</button>
              ))}
            </div>
            <textarea
              value={msgText}
              onChange={e => setMsgText(e.target.value.slice(0, 800))}
              rows={5}
              placeholder="Xabaringizni yozing…"
              className="w-full bg-[#0E1524] border border-slate-700 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500"><span>Xabar ismingiz va vaqti bilan adminga boradi</span><span>{msgText.length}/800</span></div>
            {msgInfo && <div className={`rounded-xl p-2.5 text-xs font-semibold ${msgInfo.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>{msgInfo.text}</div>}
            <button type="button" disabled={msgBusy || msgText.trim().length < 3} onClick={submitMsg} className="w-full h-12 rounded-2xl bg-amber-500 disabled:opacity-50 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              <Send className="w-4 h-4" /> {msgBusy ? 'Yuborilmoqda…' : 'Yuborish'}
            </button>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0F17]/95 backdrop-blur-md flex flex-col justify-between p-4 max-w-md mx-auto">
          {/* Modal Header */}
          <div className="pt-2 flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              <span>Sozlamalar</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="text-slate-400 hover:text-white text-xs font-semibold"
            >
              Yopish ✕
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Ismingiz</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full bg-[#151C28] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Avatar Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Profil rasmi</label>
              <div className="flex items-center gap-3 flex-wrap">
                <Avatar src={editAvatar} name={editName} className="w-16 h-16 border-2 border-amber-500/60" />
                <label className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer active:scale-95" data-sfx>
                  📷 Rasm yuklash
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        setEditAvatar(await compressImage(f, 96, 0.8, 5800));
                        triggerHaptic('success');
                      } catch {
                        /* ignore */
                      }
                    }}
                  />
                </label>
                {tgAvatar && (
                  <button type="button" onClick={() => setEditAvatar(tgAvatar)} className="px-3 py-2 rounded-lg bg-[#151C28] border border-slate-700 text-slate-300 text-xs font-semibold">
                    Telegram rasmi
                  </button>
                )}
              </div>
              <label className="text-xs font-semibold text-slate-300 block pt-1">Yoki maxsus avatar tanlang</label>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_PRESETS.map(pr => {
                  const v = presetValue(pr.id);
                  return (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setEditAvatar(v);
                      }}
                      aria-label={pr.id}
                      className={`rounded-full p-0.5 border-2 transition-all ${editAvatar === v ? 'border-amber-400 scale-105' : 'border-transparent opacity-70'}`}
                    >
                      <Avatar src={v} name={pr.id} className="w-full aspect-square" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* English Level Selection */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Ingliz tili darajangiz</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['A1', 'A2', 'B1', 'B2+'] as EnglishLevel[]).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setEditLevel(lvl);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      editLevel === lvl
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-[#151C28] text-slate-300 border-slate-800'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily words */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Kuniga nechta yangi so&apos;z</label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setEditPerDay(n);
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${editPerDay === n ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold' : 'bg-[#151C28] text-slate-300 border-slate-800'}`}
                  >
                    {n} ta
                  </button>
                ))}
              </div>
            </div>

            {/* Bot eslatmasi */}
            {isTelegram && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#151C28] border border-slate-800">
                <div className="text-xs text-slate-300">
                  <div className="font-semibold">Kunlik eslatma (bot orqali)</div>
                  <div className="text-[11px] text-slate-500">Telegram chatingizga eslatma keladi</div>
                </div>
                <input type="checkbox" checked={editRemind} onChange={e => setEditRemind(e.target.checked)} className="accent-amber-500 w-4 h-4" />
              </div>
            )}

            {/* Sound Toggle (darhol amal qiladi) */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#151C28] border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                {sfxOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                <span>Tovush effektlari (tugmalar, to&apos;g&apos;ri/xato javob)</span>
              </div>
              <input type="checkbox" data-nosfx checked={sfxOn} onChange={e => setSfxOn(e.target.checked)} className="accent-amber-500 w-4 h-4" />
            </div>

            {/* Hisob sinxronlash (telefon <-> noutbuk) */}
            <div className="p-3 rounded-xl bg-[#151C28] border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-white">Qurilmalar o&apos;rtasida sinxronlash</div>
              {isTelegram ? (
                <p className="text-[11px] text-slate-400 leading-relaxed">Telegram hisobingiz orqali progress (XP, so&apos;zlar, baraban, VIP) barcha qurilmalarda avtomatik bir xil bo&apos;ladi. Telegram ichida (ilova/Desktop/Web) oching.</p>
              ) : (
                <>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Brauzerda ochgan bo&apos;lsangiz, boshqa qurilmadagi hisobni ulash uchun shu kodni u yerda kiriting. Yaxshisi, ilovani har ikki qurilmada ham Telegram ichida oching.</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 text-[11px] bg-[#0E1524] border border-slate-800 rounded-lg px-2 py-2 text-amber-300 break-all">{accountId}</code>
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(accountId); setLinkMsg('Kod nusxalandi'); }} className="px-3 py-2 rounded-lg bg-slate-800 text-xs font-semibold">Nusxalash</button>
                  </div>
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/?link=${accountId}`); setLinkMsg('Havola nusxalandi — uni boshqa qurilmada oching, hisob avtomatik ulanadi'); }} className="w-full py-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-bold">Ulash havolasini nusxalash (eng oson usul)</button>
                  <div className="flex gap-2">
                    <input value={linkCode} onChange={e => setLinkCode(e.target.value)} placeholder="Boshqa qurilmadagi kod" className="flex-1 bg-[#0E1524] border border-slate-800 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-amber-500" />
                    <button type="button" onClick={() => { if (!linkAccount(linkCode)) setLinkMsg("Kod noto'g'ri"); }} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold">Ulash</button>
                  </div>
                </>
              )}
              {linkMsg && <p className="text-[11px] text-amber-300">{linkMsg}</p>}
              {!rtOn && <p className="text-[11px] text-rose-300">Bulut ulanmagan (VITE_FIREBASE_DB_URL), sinxronlash ishlamaydi.</p>}
            </div>

            {/* Reset Data Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Barcha saqlangan so'zlar va test natijalarini tozalashni xohlaysizmi?")) {
                    resetProgress();
                    setShowSettingsModal(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Barcha progressni qayta o&apos;rnatish (Reset)</span>
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-800 pb-safe">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md transition-all active:scale-[0.98]"
            >
              Saqlash
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
