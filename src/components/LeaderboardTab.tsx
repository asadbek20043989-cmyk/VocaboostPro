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
  Send
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EnglishLevel } from '../types';
import { triggerHaptic, getTelegramUserData } from '../services/telegram';
import { compressImage, AVATAR_PRESETS, LIMITED_AVATARS, presetValue } from '../services/avatar';
import { CosAvatar, CosName } from './Cosmetics';
import { ReferralCard } from './ReferralCard';
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
  const { profile, savedWords, badges, updateProfile, resetProgress, leagueUsers, leagueLive, realtimeOn, showCertificate, certificates, accountId, isTelegram, linkAccount, realtimeOn: rtOn, leagueWeek, refLeague, owns, refInfo } = useApp();
  const [leagueMode, setLeagueMode] = useState<'xp' | 'refs'>('xp');
  const [linkCode, setLinkCode] = useState('');
  const [linkMsg, setLinkMsg] = useState('');

  const { pendingDuelCode } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'league' | 'duel' | 'challenge' | 'profile' | 'hall'>(() => {
    let want = '';
    try {
      want = sessionStorage.getItem('vb_liga_sub') || '';
      sessionStorage.removeItem('vb_liga_sub');
    } catch {
      /* ignore */
    }
    return pendingDuelCode || want === 'duel' ? 'duel' : want === 'challenge' ? 'challenge' : 'league';
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

  // Real vaqtdagi umumiy reyting (barcha foydalanuvchilar)
  const leaderboardList = leagueUsers;

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
          <div className="flex items-center gap-1 p-1 bg-[#0E1524] rounded-xl border border-slate-800">
            <button type="button" onClick={() => setLeagueMode('xp')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${leagueMode === 'xp' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>⭐ XP reytingi (haftalik)</button>
            <button type="button" onClick={() => setLeagueMode('refs')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${leagueMode === 'refs' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>📣 Targ'ibotchilar</button>
          </div>
          {leagueMode === 'refs' && (
            <div className="space-y-2">
              <div className="rounded-2xl bg-gradient-to-r from-sky-500/15 to-fuchsia-500/15 border border-sky-500/30 px-3.5 py-2.5 text-xs font-semibold text-slate-200 leading-snug">
                Eng ko'p do'st taklif qilganlar. Har bir do'st uchun {refInfo.xp} XP beriladi. Havolangizni Profil bo'limidan olasiz.
              </div>
              {refLeague.length === 0 && <p className="text-xs text-slate-500 text-center py-6">Hozircha hech kim do'st taklif qilmagan. Birinchi bo'ling! 🚀</p>}
              {refLeague.slice(0, 50).map((u, i) => (
                <div key={u.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${u.isCurrentUser ? 'bg-amber-500/15 border-amber-500/60' : 'bg-[#151C28] border-slate-800/80'} ${i === 0 ? 'row-gold' : i === 1 ? 'row-silver' : i === 2 ? 'row-bronze' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-xs text-slate-400 w-5 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                    <CosAvatar src={u.avatar} name={u.name} size={34} cos={u.cos} />
                    <div className="min-w-0"><CosName name={u.name} cos={u.cos} showTitle className="font-semibold text-xs text-white" /></div>
                  </div>
                  <span className="font-extrabold text-xs text-sky-300 tabular-nums shrink-0">👥 {u.refs} ta</span>
                </div>
              ))}
            </div>
          )}
          {leagueMode === 'xp' && (<>
          {/* Top 3 Podium Box */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-[#151C28] via-[#1B2433] to-[#121822] border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 font-semibold text-[11px] shadow-sm">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>{leagueWeek ? `${leagueWeek.week}-hafta · ` : ''}{leaderboardList.length > 0 ? `${leaderboardList.length.toLocaleString()} ta o'quvchi` : 'O\'quvchilar...'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  {realtimeOn && leagueLive && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${realtimeOn && leagueLive ? 'bg-emerald-400' : realtimeOn ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
                </span>
                {!realtimeOn ? 'Oflayn rejim' : leagueLive ? 'Jonli reyting' : 'Reyting yuklanmoqda…'}
              </span>
            </div>

            <Podium users={leaderboardList.slice(0, 3).map(u => ({ id: u.id, name: u.name, avatar: u.avatar, xp: u.xp, cos: u.cos }))} badges={champs} />
          </div>

          {/* Raqobat: kimgacha necha XP qolgan + Tarix zali */}
          {rivalLine && (
            <div className="rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-rose-500/15 border border-orange-500/30 px-3.5 py-2.5 text-xs font-semibold text-amber-100 leading-snug">{rivalLine}</div>
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
              <CosAvatar src={profile.avatar} name={profile.name} size={40} cos={leaderboardList.find(u => u.isCurrentUser)?.cos} />
              <div>
                <div className="font-bold text-sm text-white"><CosName name={`${profile.name} (Siz)`} cos={leaderboardList.find(u => u.isCurrentUser)?.cos} showTitle /></div>
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
              <span className="font-extrabold text-sm text-amber-400 tabular-nums">
                {profile.xp} XP
              </span>
            </div>
          </div>

          {/* Remaining Rankings List */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs text-slate-400 font-semibold uppercase px-1">Barcha Ishtirokchilar</span>
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
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xs text-slate-400 w-5 text-center tabular-nums">
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                    </span>
                    {rank <= 3 ? <GlowAvatar rank={rank as 1 | 2 | 3} src={user.avatar} name={user.name} size={36} /> : <CosAvatar src={user.avatar} name={user.name} size={32} cos={user.cos} />}
                    <div className="truncate max-w-[150px]">
                      <div className="font-semibold text-xs text-white truncate">
                        <CosName name={`${user.name}${champs[user.id]?.gold ? ` 🏆×${champs[user.id].gold}` : ''}`} cos={user.cos} showTitle />
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {user.level} · {user.streak} kun streak
                      </div>
                    </div>
                  </div>

                  <span className="font-bold text-xs text-amber-400 tabular-nums">
                    {user.xp} XP
                  </span>
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
          </>)}
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
            <div className="flex justify-center"><CosAvatar src={profile.avatar} name={profile.name} size={80} cos={leaderboardList.find(u => u.isCurrentUser)?.cos} /></div>
            <div>
              <h3 className="text-lg font-bold text-white flex justify-center"><CosName name={profile.name} cos={leaderboardList.find(u => u.isCurrentUser)?.cos} showTitle /></h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Daraja: <strong className="text-amber-400">{profile.level}</strong> · Maqsad: kuniga {profile.wordsPerDay} ta so&apos;z
              </p>
            </div>

            {/* 3 Metrics Cards */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
              <div className="p-2.5 rounded-xl bg-[#0E1524] border border-slate-800 text-center">
                <div className="text-base font-bold text-amber-400 tabular-nums flex items-center justify-center gap-1">
                  <Diamond className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {profile.xp}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Jami XP</div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1524] border border-slate-800 text-center">
                <div className="text-base font-bold text-orange-400 tabular-nums flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4 fill-orange-400 text-orange-400" />
                  {profile.streak}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Kun Streak</div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1524] border border-slate-800 text-center">
                <div className="text-base font-bold text-emerald-400 tabular-nums flex items-center justify-center gap-1">
                  <Brain className="w-4 h-4 text-emerald-400" />
                  {savedWords.length}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">So&apos;zlar</div>
              </div>
            </div>
          </div>

          <ReferralCard />

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
                {[...AVATAR_PRESETS, ...LIMITED_AVATARS.filter(a => owns('avatars') || owns(`av:${a.id}`))].map(pr => {
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
