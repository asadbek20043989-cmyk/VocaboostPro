import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  UserProfile, SavedWord, DailyQuest, AchievementBadge, EnglishLevel, WheelState,
  Certificate, LeaderboardUser, BankWord, SrsEntry, WordPack, CustomWordPack, Duel, DuelMetric, DuelPlayer, Challenge,
} from '../types';
import { getTelegramUserData, getTelegramUserId, getStartParam, initTelegramApp, triggerHaptic, askBotWriteAccess, configureBackButton, getTelegramWebApp } from '../services/telegram';
import { DEFAULT_AVATAR, telegramPhotoProxy } from '../services/avatar';
import { sfx } from '../services/sound';
import { botRegister, botSendCertificate, canUseBot } from '../services/bot';
import { certificateBase64 } from '../services/certificate';
import { INITIAL_BADGES } from '../data/leaderboardSeed';
import { STARTER_WORDS } from '../data/starterWords';
import { AI_DAILY_LIMIT } from '../services/ai';

// Blitz Duel: kuniga 5 ta o'yin; g'alaba uchun eng ko'pi bilan 6 XP
export const BLITZ_DAILY_LIMIT = 5;
export const BLITZ_MAX_XP = 6;
export const BLITZ_WIN_MIN_CORRECT = 3; // 5 tadan kamida 3 ta to'g'ri = g'alaba
import { pickPrize, buildWheel, WheelPrize } from '../data/wheel';
import { buildQuests, DEFAULT_QUEST_IDS } from '../data/quests';
import { mergeGames, GameDef } from '../data/games';
import { newEntry, applyResult, MASTER_DAYS } from '../services/srs';
import { subscribe, patch, put, realtimeEnabled, getJson, removePath } from '../services/realtime';
import { nowMs, todayKey, dayDiff, syncClock } from '../services/time';
import { claimCertificate, claimWelcomeCertificate, claimAward } from '../services/certApi';
import { ACCOUNT_ID, lsGet, lsSet, lsDel } from '../services/account';
import { shopCfg, buildCatalog, priceOf, balanceOf, inviteLinkFor, botNameFrom, ShopCfg } from '../services/shop';
import { ShopItem, parsePremium, DEFAULT_PREMIUM_TEXT, LTD_AVATARS, NICK_COLORS, TITLES } from '../data/shopDefaults';

// ---- Netlify kreditini tejash sozlamalari ----
// Har bir bazaga yozish Netlify funksiyasi (db.mjs) chaqiruvi hisoblanadi, shuning uchun yozuvlar jamlanadi.
const SYNC_DEBOUNCE_MS = 20000; // holat sinxronlash: oxirgi o'zgarishdan 20 soniya keyin (avval 1.5 soniya)
const LB_THROTTLE_MS = 45000; // reytingga yozish: ko'pi bilan 45 soniyada bir marta (avval har o'zgarishda)
import {
  CoreState, CloudCore, mergeCore, mergeSrs, normalizeCore, coreSig, srsSig,
  parseRemoteCore, parseRemoteSrs,
} from '../services/sync';

type TabId = 'home' | 'words' | 'games' | 'leaderboard' | 'shop';
/** Streak oynasi: gain — bugungi streak yig'ildi; frozen — bir kun o'tkazib yuborilgan, streak muzlab turibdi */
export type StreakPopupData =
  | { kind: 'gain'; streak: number; saved: boolean }
  | { kind: 'frozen'; streak: number; savers: number };
/** Reytingda ko'rinadigan bezaklar (do'kondan olingan) */
export interface Cosmetic { fr?: string; nf?: string; nc?: string; ns?: string; ti?: string; vf?: boolean; rb?: string }
export type Overlay = null | { type: 'learn'; packId?: string } | { type: 'game'; id: string } | { type: 'survival'; id: string };

export interface Settings {
  reviewCap: number;
  xpNewWord: number;
  xpCorrect: number;
  xpDailyBonus: number;
}
/** Daraja bo'yicha so'zlar ustuvorligi: o'z darajasi birinchi, tugasa — eng yaqin darajalar */
const LEVEL_PREF: Record<EnglishLevel, EnglishLevel[]> = {
  A1: ['A1', 'A2', 'B1', 'B2+'],
  A2: ['A2', 'A1', 'B1', 'B2+'],
  B1: ['B1', 'A2', 'B2+', 'A1'],
  'B2+': ['B2+', 'B1', 'A2', 'A1'],
};
/** Daraja bo'yicha so'z kam bo'lsa ham o'yin/mashqlar to'xtab qolmasligi uchun eng kam ko'rinadigan so'zlar soni */
const MIN_LEVEL_WORDS = 40;
const DEFAULT_SETTINGS: Settings = { reviewCap: 30, xpNewWord: 3, xpCorrect: 2, xpDailyBonus: 10 };

export const MILESTONES: { n: number; tpl: string; title: string }[] = [
  { n: 100, tpl: 'bronze', title: "100 ta so'z yodlandi" },
  { n: 250, tpl: 'silver', title: "250 ta so'z yodlandi" },
  { n: 500, tpl: 'gold', title: "500 ta so'z yodlandi" },
  { n: 750, tpl: 'platinum', title: "750 ta so'z yodlandi" },
  { n: 1000, tpl: 'champion', title: "1000 ta so'z — VocaBoost ustasi" },
];

interface QuestState { date: string; quests: DailyQuest[] }

interface AppContextType {
  profile: UserProfile;
  bank: BankWord[];
  bankFromCloud: boolean;
  srs: Record<string, SrsEntry>;
  savedWords: SavedWord[]; // o'rganilgan so'zlar (Learning.tsx bilan mos)
  masteredCount: number;
  dueWords: BankWord[];
  newQueue: BankWord[]; // bugun o'rganish mumkin bo'lgan yangi so'zlar
  introducedToday: number;
  dailyQuests: DailyQuest[];
  badges: AchievementBadge[];
  games: GameDef[];
  settings: Settings;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  overlay: Overlay;
  openLearn: (packId?: string) => void;
  openGame: (id: string) => boolean;
  closeOverlay: () => void;
  goBack: () => void;
  canGoBack: boolean;
  // lug'at to'plamlari ("Bugungi mashqlar")
  packs: WordPack[];
  todayPacks: WordPack[];
  packProgress: (p: WordPack) => { learned: number; total: number };
  // shaxsiy lug'at to'plamlari
  customPacks: CustomWordPack[];
  saveCustomPack: (pack: { id?: string; title: string; desc?: string; words: BankWord[] }) => CustomWordPack;
  deleteCustomPack: (id: string) => void;
  // raqib bilan bellashuv
  duels: Duel[];
  createDuel: (o: { title: string; metric: DuelMetric; hours: number; maxPlayers: number }) => Promise<string | null>;
  joinDuel: (code: string) => Promise<{ ok: boolean; error?: string }>;
  leaveDuel: (code: string) => void;
  pendingDuelCode: string;
  clearPendingDuel: () => void;
  duelMetricValue: (m: DuelMetric) => number;
  // chellenj / marafonlar (admin o'tkazadi)
  challenges: Challenge[];
  joinChallenge: (id: string) => Promise<{ ok: boolean; error?: string }>;
  openSurvival: (id: string) => Promise<{ ok: boolean; error?: string }>; // Marafon: urinishni boshlaydi (faqat 1 marta)
  saveSurvival: (id: string, score: number, done: boolean, keepalive?: boolean) => void;
  allWords: BankWord[]; // barcha darajadagi so'zlar (Marafon uchun adolatli umumiy to'plam)
  introduceWord: (w: BankWord, correct: boolean) => number;
  reviewWord: (w: BankWord, correct: boolean) => number;
  // Learning.tsx bilan moslik
  addWord: (d: any) => boolean;
  isWordSaved: (word: string) => boolean;
  markWordReviewed: (id: string, remembered: boolean) => void;
  claimDailyBonus: () => number;
  completeGame: (id: string, correct: number, total: number, demo?: boolean) => { xp: number; passed: boolean; already: boolean };
  updateProfile: (updates: Partial<UserProfile>) => void;
  finishOnboarding: (level: EnglishLevel, perDay: number) => void;
  resetProgress: () => void;
  claimQuest: (questId: string) => void;
  // baraban
  wheel: WheelState;
  wheelPrizes: WheelPrize[];
  wheelFreeSpins: number;
  freeSpinsLeft: number;
  totalSpinsLeft: number;
  isPro: boolean;
  spinWheel: () => { prize: WheelPrize; usedFree: boolean } | null;
  applyPrize: (prize: WheelPrize, usedFree: boolean) => void;
  grantReferralSpin: () => boolean;
  // tanga, do'kon, taklif
  coins: number;
  catalog: ShopItem[];
  shopConf: ShopCfg;
  buyItem: (id: string) => { ok: boolean; error?: string; reveal?: string };
  equip: (field: 'frame' | 'nameFx' | 'nameColor' | 'nameSym' | 'title' | 'rankBadge' | 'skin', value: string) => boolean;
  owns: (id: string) => boolean;
  boostActive: boolean;
  inviteLink: string;
  refCount: number;
  refLeague: (LeaderboardUser & { refs: number })[];
  refInfo: { enabled: boolean; xp: number; shareText: string };
  // liga
  leagueUsers: LeaderboardUser[];
  leagueLive: boolean;
  challengesLive: boolean;
  realtimeOn: boolean;
  announcement: { text: string; active: boolean } | null;
  /** Joriy liga haftasi (admin «Yangi hafta» bosganda oshadi) */
  leagueWeek: { week: number; startedAt: number } | null;
  // sertifikatlar
  certificates: Certificate[];
  certificateView: Certificate | null;
  showCertificate: (c: Certificate | null) => void;
  notice: string | null;
  streakPopup: StreakPopupData | null;
  dismissStreakPopup: () => void;
  addXp: (amount: number) => number;
  aiLeft: number;
  consumeAi: () => boolean;
  blitzLeft: number;
  consumeBlitz: () => boolean;
  markWritingDone: () => boolean;
  today: string;
  syncReady: boolean;
  accountId: string;
  isTelegram: boolean;
  linkAccount: (code: string) => boolean;
}

const toArray = (v: any): any[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

const INITIAL_WHEEL: WheelState = {
  dayKey: '', spinsUsed: 0, bonusSpins: 0, grantSpins: 0, grantSpinsUntil: 0, referralDayKey: '', doubleXpPending: false,
  lockedUntil: 0, proUntil: 0, streakSavers: 0, totalSpins: 0,
};

const LOCAL_KEYS = [
  'lx_state_ts_v1', 'lx_profile_v1', 'lx_srs_v1', 'lx_wheel_v1', 'lx_quests_v1', 'lx_certs_v1', 'lx_badges_v1',
  'lx_games_played_v1', 'lx_grants_v1', 'lx_duels_v1', 'lx_hduels_v1', 'lx_epoch_v1', 'lx_certs_seen_v1', 'lx_certs_init_v1',
  'lx_streak_pop_v1', 'lx_freeze_pop_v1', 'lx_welcome_cert_v1', 'lx_custom_packs_v1',
];

const MIN_BANK = 100; // ilovada kamida shuncha so'z ko'rinib turadi

const INITIAL_PROFILE: UserProfile = {
  id: 'user_default',
  name: "O'quvchi",
  avatar: DEFAULT_AVATAR,
  level: 'A1',
  track: 'both',
  wordsPerDay: 10,
  dailyGoalMinutes: 10,
  xp: 0,
  streak: 0,
  reminderTime: '20:00',
  hasCompletedOnboarding: false,
  soundEnabled: true,
  fontSize: 'base',
  fontFamily: 'sans',
  bonusDays: [],
  gameXp: {},
  milestones: [],
};

/** Yangi (nol) profil: ism, username va rasm Telegramdan olinadi */
const freshProfile = (): UserProfile => {
  const tg = getTelegramUserData();
  const tgId = getTelegramUserId();
  return { ...INITIAL_PROFILE, name: tg.name || INITIAL_PROFILE.name, username: tg.username, avatar: tg.avatar || (tgId ? telegramPhotoProxy(tgId) : INITIAL_PROFILE.avatar) };
};

const load = <T,>(key: string, fallback: T): T => {
  try {
    const s = lsGet(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try {
    lsSet(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage error', e);
  }
};

const normalizeBankWord = (id: string, w: any, i: number): BankWord | null => {
  if (!w || w.published === false || !w.en || !w.uz) return null;
  return {
    id,
    en: String(w.en),
    uz: String(w.uz),
    ipa: String(w.ipa || ''),
    pos: String(w.pos || ''),
    ex: String(w.ex || ''),
    exUz: String(w.exUz || ''),
    col: toArray(w.col).map(String).filter(Boolean),
    fam: toArray(w.fam).map(String).filter(Boolean),
    hook: String(w.hook || ''),
    track: (['comm', 'ielts', 'acad'].includes(w.track) ? w.track : 'comm') as BankWord['track'],
    topic: String(w.topic || ''),
    level: (['A1', 'A2', 'B1', 'B2+'].includes(w.level) ? w.level : 'B1') as EnglishLevel,
    order: Number.isFinite(Number(w.order)) ? Number(w.order) : 100000 + i,
  };
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    initTelegramApp();
  }, []);

  // ---------- holat ----------
  const [profile, setProfile] = useState<UserProfile>(() => {
    const stored = load<Partial<UserProfile> | null>('lx_profile_v1', null);
    if (stored) return { ...INITIAL_PROFILE, ...stored };
    return freshProfile();
  });
  // Telegram ichida: ism va profil rasmi avtomatik Telegramdagidek qo'yiladi (foydalanuvchi o'zi o'zgartirmagan bo'lsa)
  useEffect(() => {
    const tgId = getTelegramUserId();
    if (!tgId) return;
    const tg = getTelegramUserData();
    setProfile(p => {
      const next = { ...p };
      if (!p.customName && tg.name && p.name !== tg.name) next.name = tg.name;
      if (!p.customAvatar) {
        if (tg.avatar) {
          if (p.avatar !== tg.avatar) next.avatar = tg.avatar;
        } else if (!p.avatar || p.avatar === DEFAULT_AVATAR || p.avatar.includes('dicebear.com')) {
          next.avatar = telegramPhotoProxy(tgId); // `photo_url` kelmagan mijozlar uchun: bot orqali olinadi
        }
      }
      if (tg.username && p.username !== tg.username) next.username = tg.username;
      return next.name === p.name && next.avatar === p.avatar && next.username === p.username ? p : next;
    });
  }, []);

  const [srs, setSrs] = useState<Record<string, SrsEntry>>(() => load('lx_srs_v1', {}));
  const [badges, setBadges] = useState<AchievementBadge[]>(() => load('lx_badges_v1', INITIAL_BADGES));
  const [wheel, setWheel] = useState<WheelState>(() => ({ ...INITIAL_WHEEL, ...load<Partial<WheelState>>('lx_wheel_v1', {}) }));
  const [questState, setQuestState] = useState<QuestState>(() => load('lx_quests_v1', { date: '', quests: [] }));
  const [localCerts, setLocalCerts] = useState<Certificate[]>(() => load('lx_certs_v1', []));
  const [gamesPlayed, setGamesPlayed] = useState<number>(() => load('lx_games_played_v1', 0));
  const [grantsDone, setGrantsDone] = useState<string[]>(() => load('lx_grants_v1', []));
  const [duelCodes, setDuelCodes] = useState<string[]>(() => load('lx_duels_v1', []));
  const [hiddenDuels, setHiddenDuels] = useState<string[]>(() => load('lx_hduels_v1', []));
  const [epoch, setEpoch] = useState<number>(() => load('lx_epoch_v1', 0));
  const [syncReady, setSyncReady] = useState(!realtimeEnabled);

  const [activeTab, setActiveTabRaw] = useState<TabId>('home');
  const [navHistory, setNavHistory] = useState<TabId[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [certificateView, setCertificateView] = useState<Certificate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pushNotice = (t: string) => {
    setNotice(t);
    setTimeout(() => setNotice(c => (c === t ? null : c)), 3800);
  };

  // Inson ovozi yozuvi topilmasa (sun'iy ovoz ishlatilmaydi) foydalanuvchiga bildiriladi
  useEffect(() => {
    let last = 0;
    const f = () => { if (Date.now() - last > 4000) { last = Date.now(); pushNotice("🔇 Bu so'z uchun inson ovozi yozuvi topilmadi"); } };
    window.addEventListener('vb:noaudio', f);
    return () => window.removeEventListener('vb:noaudio', f);
  }, []);

  // ---------- tanga ----------
  const coinRateRef = useRef(0.5);
  /** XP qo'shadi va unga mos tanga hisoblaydi (1 XP = coinRate tanga) */
  const addXpTo = (p: UserProfile, gained: number): UserProfile => ({ ...p, xp: p.xp + gained, coinsEarned: (p.coinsEarned || 0) + Math.max(0, gained) * coinRateRef.current });
  const earnCoins = (n: number, key?: string) => {
    if (n <= 0) return;
    setProfile(p => {
      if (key && (p.coinDays || []).includes(key)) return p;
      return { ...p, coinsEarned: (p.coinsEarned || 0) + n, coinDays: key ? [...(p.coinDays || []).slice(-29), key] : p.coinDays };
    });
  };

  const [today, setToday] = useState(todayKey());
  const [now, setNow] = useState(nowMs());
  useEffect(() => {
    const tick = () => {
      setToday(todayKey());
      setNow(nowMs());
    };
    const id = setInterval(tick, 10000);
    // soat server vaqtiga tuzatilgach, "bugun" ham yangilanadi; ilova qayta ochilganda ham tekshiriladi
    syncClock().then(tick);
    const vis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  useEffect(() => save('lx_profile_v1', profile), [profile]);
  useEffect(() => save('lx_srs_v1', srs), [srs]);
  useEffect(() => save('lx_badges_v1', badges), [badges]);
  useEffect(() => save('lx_wheel_v1', wheel), [wheel]);
  useEffect(() => save('lx_quests_v1', questState), [questState]);
  useEffect(() => save('lx_certs_v1', localCerts), [localCerts]);
  useEffect(() => save('lx_games_played_v1', gamesPlayed), [gamesPlayed]);
  useEffect(() => save('lx_grants_v1', grantsDone), [grantsDone]);
  useEffect(() => save('lx_duels_v1', duelCodes), [duelCodes]);
  useEffect(() => save('lx_hduels_v1', hiddenDuels), [hiddenDuels]);
  useEffect(() => save('lx_epoch_v1', epoch), [epoch]);

  // ---------- navigatsiya ----------
  const setActiveTab = (tab: TabId) => {
    if (tab === activeTab) return;
    setNavHistory(h => [...h.slice(-19), activeTab]);
    setActiveTabRaw(tab);
  };
  const openLearn = (packId?: string) => setOverlay({ type: 'learn', packId });
  const closeOverlay = () => {
    triggerHaptic('selection');
    setOverlay(null);
  };
  const goBack = () => {
    triggerHaptic('selection');
    if (overlay) return setOverlay(null);
    setNavHistory(h => {
      if (h.length === 0) return h;
      setActiveTabRaw(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };
  const canGoBack = navHistory.length > 0;

  // ---------- real vaqt: sozlamalar, liga, so'zlar banki ----------
  const [config, setConfig] = useState<any>(null);
  const [leagueRaw, setLeagueRaw] = useState<Record<string, any> | null>(null);
  const [leagueLive, setLeagueLive] = useState(false); // reyting bazasidan haqiqatan ma'lumot kelyaptimi
  const [cloudWords, setCloudWords] = useState<BankWord[] | null>(() => {
    const c = load<{ v: number; words: BankWord[] } | null>('lx_words_cache_v1', null);
    return c && Array.isArray(c.words) && c.words.length ? c.words : null;
  });
  // bazadagi barcha so'z id lari (arxivdagilar ham) — arxivlangan boshlang'ich so'z qaytib kelmasligi uchun
  const [knownIds, setKnownIds] = useState<string[]>(() => load<{ ids?: string[] } | null>('lx_words_cache_v1', null)?.ids || []);

  const myId = useRef<string>(ACCOUNT_ID);

  const [certsRaw, setCertsRaw] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const us = [
      subscribe('config', setConfig),
      subscribe('leaderboard', setLeagueRaw, setLeagueLive),
      subscribe(`certs/${myId.current}`, setCertsRaw),
    ];
    return () => us.forEach(u => u());
  }, []);

  // So'zlar faqat versiya o'zgarganda yuklanadi (trafikni tejash uchun) va qurilmada saqlanadi
  const wordsVersion = Number(config?.wordsVersion) || 0;
  useEffect(() => {
    if (!realtimeEnabled || !config) return;
    const cached = load<{ v: number; words: BankWord[] } | null>('lx_words_cache_v1', null);
    if (cached && cached.v === wordsVersion && cached.words?.length) return;
    getJson('words')
      .then(raw => {
        const list: BankWord[] = [];
        Object.entries(raw || {}).forEach(([id, w], i) => {
          const b = normalizeBankWord(id, w, i);
          if (b) list.push(b);
        });
        list.sort((a, b) => a.order - b.order);
        const ids = Object.keys(raw || {});
        save('lx_words_cache_v1', { v: wordsVersion, words: list, ids });
        setCloudWords(list.length ? list : null);
        setKnownIds(ids);
      })
      .catch(() => {
        /* oflayn: keshdagi yoki boshlang'ich so'zlar ishlatiladi */
      });
  }, [wordsVersion, !!config]);

  // So'zlar banki: bazadagi so'zlar; ular 100 tadan kam bo'lsa, ilovadagi boshlang'ich so'zlar bilan to'ldiriladi
  const mainBank: BankWord[] = useMemo(() => {
    const base = cloudWords || [];
    if (base.length >= MIN_BANK) return base;
    const ids = new Set<string>([...base.map(w => w.id), ...knownIds]);
    const ens = new Set(base.map(w => w.en.toLowerCase()));
    const extra = STARTER_WORDS.filter(w => !ids.has(w.id) && !ens.has(w.en.toLowerCase()));
    return [...base, ...extra];
  }, [cloudWords, knownIds]);
  const bankFromCloud = !!(cloudWords && cloudWords.length);

  // ---------- lug'at to'plamlari (admin yuklaydi) ----------
  const [cloudPacks, setCloudPacks] = useState<WordPack[]>(() => load<{ v: number; packs: WordPack[] } | null>('lx_packs_cache_v1', null)?.packs || []);
  const packsVersion = Number(config?.packsVersion) || 0;
  useEffect(() => {
    if (!realtimeEnabled || !config) return;
    const cached = load<{ v: number; packs: WordPack[] } | null>('lx_packs_cache_v1', null);
    if (cached && cached.v === packsVersion) return;
    getJson('packs')
      .then(raw => {
        const list: WordPack[] = [];
        Object.entries(raw || {}).forEach(([id, p]: [string, any]) => {
          if (!p || p.published === false) return;
          const words: BankWord[] = [];
          Object.entries(p.words || {}).forEach(([wid, w], i) => {
            const b = normalizeBankWord(wid, w, i);
            if (b) words.push(b);
          });
          words.sort((a, b) => a.order - b.order);
          if (!words.length) return;
          list.push({
            id, title: String(p.title || 'Lug\'at'), desc: String(p.desc || ''), kind: p.kind === 'daily' ? 'daily' : 'open',
            date: String(p.date || ''), mode: p.mode === 'extra' ? 'extra' : 'replace', order: Number(p.order) || 0, words,
          });
        });
        list.sort((a, b) => a.order - b.order);
        save('lx_packs_cache_v1', { v: packsVersion, packs: list });
        setCloudPacks(list);
      })
      .catch(() => {
        /* oflayn: keshdagi to'plamlar ishlatiladi */
      });
  }, [packsVersion, !!config]);

  // ---------- foydalanuvchining shaxsiy lug'at to'plamlari ----------
  const [customPacks, setCustomPacks] = useState<CustomWordPack[]>(() => {
    return load<CustomWordPack[]>('lx_custom_packs_v1', []) || [];
  });

  const saveCustomPack = (data: { id?: string; title: string; desc?: string; words: BankWord[] }): CustomWordPack => {
    const id = data.id || `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    let resultPack: CustomWordPack;
    setCustomPacks(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx >= 0) {
        resultPack = { ...prev[idx], title: data.title, desc: data.desc, words: data.words, updatedAt: now };
        const copy = [...prev];
        copy[idx] = resultPack;
        save('lx_custom_packs_v1', copy);
        return copy;
      } else {
        resultPack = { id, title: data.title, desc: data.desc, words: data.words, createdAt: now, updatedAt: now };
        const copy = [resultPack, ...prev];
        save('lx_custom_packs_v1', copy);
        return copy;
      }
    });
    return resultPack!;
  };

  const deleteCustomPack = (id: string) => {
    setCustomPacks(prev => {
      const copy = prev.filter(p => p.id !== id);
      save('lx_custom_packs_v1', copy);
      return copy;
    });
  };

  const customAsPacks: WordPack[] = useMemo(() => {
    return customPacks.map((cp, idx) => ({
      id: cp.id,
      title: cp.title,
      desc: cp.desc || '',
      kind: 'open' as const,
      date: '',
      mode: 'extra' as const,
      order: 1000 + idx,
      words: cp.words,
      isCustom: true,
    }));
  }, [customPacks]);

  // Do'kondan olingan «Premium so'zlar» to'plami (so'zlarni admin o'zgartiradi, bo'sh bo'lsa standart ro'yxat)
  const premiumText = String(config?.shop?.premiumText || '');
  const hasPremium = (profile.own || []).includes('premium_words');
  const premiumPack: WordPack[] = useMemo(() => {
    if (!hasPremium) return [];
    const words = parsePremium(premiumText || DEFAULT_PREMIUM_TEXT);
    return words.length ? [{ id: 'premium_words', title: "💎 Premium so'zlar", desc: "Do'kondan olingan tanlangan yuqori daraja so'zlari", kind: 'open' as const, date: '', mode: 'extra' as const, order: 900, words }] : [];
  }, [hasPremium, premiumText]);
  const packs = useMemo(() => [...cloudPacks, ...premiumPack, ...customAsPacks], [cloudPacks, premiumPack, customAsPacks]);
  const packWords = useMemo(() => {
    const seen = new Set<string>();
    const out: BankWord[] = [];
    packs.forEach(p => p.words.forEach(w => { if (!seen.has(w.id)) { seen.add(w.id); out.push(w); } }));
    return out;
  }, [packs]);
  // Qidiruv uchun barcha so'zlar; foydalanuvchiga esa asosiy bank + o'rganilgan to'plam so'zlari ko'rsatiladi
  const bankMap = useMemo(() => new Map([...mainBank, ...packWords].map(w => [w.id, w])), [mainBank, packWords]);

  // Foydalanuvchi tanlagan darajaga mos so'zlar: avval o'z darajasi, so'ng (so'z yetmasa) eng yaqin darajalar
  const levelPref = LEVEL_PREF[profile.level] || LEVEL_PREF.B1;
  const levelMain: BankWord[] = useMemo(() => {
    const rank = (w: BankWord) => {
      const i = levelPref.indexOf(w.level);
      return i < 0 ? 9 : i;
    };
    return [...mainBank].sort((a, b) => rank(a) - rank(b)); // barqaror saralash: daraja ichida admin tartibi saqlanadi
  }, [mainBank, levelPref]);
  // Ko'rinadigan lug'at / o'yinlar / mashqlar banki: o'z darajasi + allaqachon o'rganilgan so'zlar (ma'lumot yo'qolmaydi)
  const bank: BankWord[] = useMemo(() => {
    const ownCount = levelMain.filter(w => w.level === profile.level).length;
    let fill = Math.max(0, MIN_LEVEL_WORDS - ownCount);
    const list = levelMain.filter(w => {
      if (w.level === profile.level || srs[w.id]) return true;
      if (fill > 0) {
        fill--;
        return true;
      }
      return false;
    });
    return [...list, ...packWords.filter(w => srs[w.id])];
  }, [levelMain, packWords, srs, profile.level]);

  const games = useMemo(() => mergeGames(config?.games), [config]);
  const settings: Settings = useMemo(() => {
    const s = config?.settings || {};
    const n = (v: any, d: number) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.max(0, Number(v)) : d);
    return {
      reviewCap: Math.max(5, n(s.reviewCap, DEFAULT_SETTINGS.reviewCap)),
      xpNewWord: n(s.xpNewWord, DEFAULT_SETTINGS.xpNewWord),
      xpCorrect: n(s.xpCorrect, DEFAULT_SETTINGS.xpCorrect),
      xpDailyBonus: n(s.xpDailyBonus, DEFAULT_SETTINGS.xpDailyBonus),
    };
  }, [config]);

  const wheelCfg = useMemo(() => buildWheel(config?.wheel), [config]);

  const myCos = { fr: profile.frame || '', nf: profile.nameFx || '', nc: profile.nameColor || '', ns: profile.nameSym || '', ti: profile.title || '', vf: (profile.own || []).includes('verified'), rb: profile.rankBadge || '' };
  const leagueUsers: LeaderboardUser[] = (() => {
    const list: LeaderboardUser[] = [];
    let meSeen = false;
    let meHidden = false;
    Object.entries(leagueRaw || {}).forEach(([id, e]: [string, any]) => {
      if (!e) return;
      const isMe = id === myId.current;
      if (isMe) {
        meSeen = true;
        if (e.hidden || e.deleted) meHidden = true;
      }
      if (e.hidden || e.deleted) return;
      list.push({
        id,
        name: isMe ? `${profile.name} (Siz)` : String(e.name || "O'quvchi"),
        avatar: isMe ? profile.avatar : String(e.avatar || ''),
        xp: Math.max(0, Math.round(isMe ? profile.xp : (Number(e.xp) || 0) + (Number(e.xpOffset) || 0))),
        streak: isMe ? profile.streak : Number(e.streak) || 0,
        level: (isMe ? profile.level : e.level || 'A1') as EnglishLevel,
        isCurrentUser: isMe,
        cos: isMe ? myCos : { fr: e.fr || '', nf: e.nf || '', nc: e.nc || '', ns: e.ns || '', ti: e.ti || '', vf: !!e.vf, rb: e.rb || '' },
        refs: Number(e.refs) || 0,
      });
    });
    if (!meSeen && !meHidden) {
      list.push({ id: myId.current, name: `${profile.name} (Siz)`, avatar: profile.avatar, xp: profile.xp, streak: profile.streak, level: profile.level, isCurrentUser: true, cos: myCos, refs: 0 });
    }
    list.sort((a, b) => b.xp - a.xp);
    return list;
  })();

  const refLeague = leagueUsers.filter(u => (u.refs || 0) > 0).sort((a, b) => (b.refs || 0) - (a.refs || 0) || b.xp - a.xp).map(u => ({ ...u, refs: u.refs || 0 }));

  const announcement =
    config?.announcement && config.announcement.active && config.announcement.text
      ? { text: String(config.announcement.text), active: true }
      : null;

  const leagueWeek = config?.league && Number(config.league.week) > 0 ? { week: Number(config.league.week), startedAt: Number(config.league.startedAt) || 0 } : null;

// ---------- qurilmalar o'rtasida sinxronlash (telefon <-> noutbuk) ----------
  // Butun progress bulutda `state/<hisob>` ostida saqlanadi. Qurilmalar bir-birining ma'lumotini ustiga yozmaydi:
  // har bir maydon o'z qoidasi bilan BIRLASHTIRILADI (services/sync.ts). Shu sababli baraban, XP, so'zlar,
  // missiyalar va sertifikatlar har ikkala qurilmada bir xil bo'ladi.
  const devId = useRef<string>('');
  if (!devId.current) {
    let d = load<string>('lx_dev_v1', '');
    if (!d) { d = 'd' + Math.random().toString(36).slice(2, 10); save('lx_dev_v1', d); }
    devId.current = d;
  }
  // Eng so'nggi holat (closure muammosiz o'qish uchun)
  const latest = useRef<any>(null);
  latest.current = { profile, srs, wheel, questState, localCerts, badges, gamesPlayed, grantsDone, duels: duelCodes, hiddenDuels, epoch };

  const rawRef = useRef<any>(null); // bulutdagi xom holat
  const remoteCoreRef = useRef<CloudCore | null>(null);
  const syncedSig = useRef(''); // bulutda turgan holat imzosi
  const lastSrs = useRef<Record<string, string>>({}); // bulutdagi so'zlar imzolari
  const pushOk = useRef(false);
  const revRef = useRef(0);
  const pushing = useRef(false);
  const pushAgain = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oldSrsKey = useRef<string>(''); // "tiklash" dan keyin tozalanadigan eski so'zlar yo'li

  const srsKey = (ep: number) => (ep ? `srs_${ep}` : 'srs');
  const snapshot = (): CoreState => {
    const L = latest.current;
    return { profile: L.profile, wheel: L.wheel, questState: L.questState, localCerts: L.localCerts, badges: L.badges, gamesPlayed: L.gamesPlayed, grantsDone: L.grantsDone, duels: L.duels, hiddenDuels: L.hiddenDuels, epoch: L.epoch };
  };
  // Juda katta rasm (data:) bulutga yuborilmaydi — qurilmalar o'z rasmini saqlab qoladi
  const wire = (c: CoreState): CoreState => {
    const p = { ...c.profile };
    if (typeof p.avatar === 'string' && p.avatar.length > 30000) p.avatar = '';
    return { ...c, profile: p };
  };
  const applyCore = (c: CoreState) => {
    setProfile(c.profile);
    setWheel(c.wheel);
    setQuestState(c.questState);
    setLocalCerts(c.localCerts);
    setBadges(c.badges);
    setGamesPlayed(c.gamesPlayed);
    setGrantsDone(c.grantsDone);
    setDuelCodes(c.duels);
    setHiddenDuels(c.hiddenDuels || []);
    setEpoch(c.epoch);
  };
  const srsChanged = (a: Record<string, SrsEntry>, b: Record<string, SrsEntry>) => {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return true;
    return ka.some(k => !b[k] || srsSig(a[k]) !== srsSig(b[k]));
  };

  const reconcile = (localDirty: boolean) => {
    const raw = rawRef.current;
    if (raw === null) return;
    const L = latest.current as { srs: Record<string, SrsEntry>; epoch: number };
    const rem = remoteCoreRef.current;
    const local = snapshot();
    let core = local;
    let nextSrs = L.srs;
    let finalEpoch = local.epoch;
    if (rem) {
      const m = mergeCore(local, rem, localDirty);
      core = m.core;
      finalEpoch = core.epoch;
      revRef.current = Math.max(revRef.current, rem.rev);
      const remSrs = parseRemoteSrs(raw?.[srsKey(rem.epoch)]);
      if (m.adoptRemoteOnly) nextSrs = remSrs;
      else if (rem.epoch === local.epoch) nextSrs = mergeSrs(L.srs, remSrs);
    } else {
      nextSrs = mergeSrs(L.srs, parseRemoteSrs(raw?.[srsKey(local.epoch)]));
    }
    if (coreSig(wire(core)) !== coreSig(wire(local))) applyCore(core);
    if (srsChanged(L.srs, nextSrs)) setSrs(nextSrs);
    // bulutdagi so'zlar imzolari: faqat bulutda yo'q yoki farq qiladigan so'zlar yuboriladi
    const cloudSrs = parseRemoteSrs(raw?.[srsKey(finalEpoch)]);
    lastSrs.current = Object.fromEntries(Object.entries(cloudSrs).map(([k, v]) => [k, srsSig(v)]));
  };

  const scheduleRetry = (ms = 5000) => {
    if (retryTimer.current) return;
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      pushNow(false);
    }, ms);
  };

  const pushNow = async (keepalive: boolean): Promise<void> => {
    if (!realtimeEnabled || !pushOk.current) return;
    if (pushing.current) {
      pushAgain.current = true;
      return;
    }
    const L = latest.current;
    if (!L.profile.hasCompletedOnboarding && !oldSrsKey.current) return;
    pushing.current = true;
    try {
      const uid = myId.current;
      const core = wire(normalizeCore(snapshot()));
      const sig = coreSig(core);
      const key = srsKey(core.epoch);
      const delta: Record<string, SrsEntry> = {};
      Object.entries(L.srs as Record<string, SrsEntry>).forEach(([id, e]) => {
        if (lastSrs.current[id] !== srsSig(e)) delta[id] = e;
      });
      // 1) so'zlar, 2) asosiy holat — boshqa qurilma asosiy holatni ko'rganda so'zlar ham yetib kelgan bo'ladi
      if (Object.keys(delta).length) {
        if (!(await patch(`state/${uid}/${key}`, delta, keepalive))) return scheduleRetry();
        Object.entries(delta).forEach(([id, e]) => (lastSrs.current[id] = srsSig(e)));
      }
      if (sig !== syncedSig.current) {
        const rev = revRef.current + 1;
        if (!(await put(`state/${uid}/core`, { ...core, dev: devId.current, ts: nowMs(), rev }, keepalive))) return scheduleRetry();
        revRef.current = rev;
        syncedSig.current = sig;
        if (oldSrsKey.current) {
          removePath(`state/${uid}/${oldSrsKey.current}`); // "tiklash" dan keyin eski so'zlar tozalanadi
          oldSrsKey.current = '';
        }
      }
    } catch {
      scheduleRetry();
    } finally {
      pushing.current = false;
      if (pushAgain.current) {
        pushAgain.current = false;
        setTimeout(() => pushNow(false), 300);
      }
    }
  };

  useEffect(() => {
    if (!realtimeEnabled) return;
    const fallback = setTimeout(() => setSyncReady(true), 6000); // oflayn bo'lsa ham ilova ochiladi
    const unsub = subscribe(`state/${myId.current}`, raw => {
      const prev = syncedSig.current;
      const dirty = pushOk.current && prev !== '' && coreSig(wire(snapshot())) !== prev;
      rawRef.current = raw || {};
      const core = parseRemoteCore(raw?.core, { profile: INITIAL_PROFILE, wheel: INITIAL_WHEEL, badges: INITIAL_BADGES });
      remoteCoreRef.current = core;
      syncedSig.current = core ? coreSig(wire(core)) : '#none';
      reconcile(dirty);
      pushOk.current = true;
      setSyncReady(true);
      setTimeout(() => pushNow(false), 600);
    });
    // Ekran yopilayotganda (yoki ilova fonga ketganda) kutayotgan o'zgarishlar darhol yuboriladi
    const flush = () => {
      if (document.visibilityState === 'hidden') pushNow(true);
    };
    const hide = () => pushNow(true);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', hide);
    return () => {
      clearTimeout(fallback);
      unsub();
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', hide);
    };
  }, []);

  useEffect(() => {
    if (!realtimeEnabled) return;
    const t = setTimeout(() => pushNow(false), SYNC_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [profile, srs, wheel, questState, localCerts, badges, gamesPlayed, grantsDone, duelCodes, hiddenDuels, epoch]);

  // Web (brauzer) hisobini boshqa qurilmaga ulash uchun kod. Telegram'da hisob avtomatik ulanadi.
  const isTelegram = !!getTelegramUserId();
  const linkAccount = (code: string): boolean => {
    const c = code.trim();
    if (!/^(tg|web)_[A-Za-z0-9]{3,40}$/.test(c) || isTelegram) return false;
    try {
      localStorage.setItem('lx_uid_v1', JSON.stringify(c));
    } catch {
      /* ignore */
    }
    LOCAL_KEYS.forEach(k => lsDel(k));
    window.location.reload();
    return true;
  };

  // ---------- do'kon: katalog, sotib olish, bezaklar, taklif ----------
  const shopConf = useMemo(() => shopCfg(config?.shop), [config]);
  const catalog = useMemo(() => buildCatalog(config?.shop), [config]);
  const catalogRef = useRef<ShopItem[]>([]);
  catalogRef.current = catalog;
  coinRateRef.current = shopConf.coinPerXp;
  const coins = balanceOf(profile);
  const owns = (id: string) => (profile.own || []).includes(id);
  const boostActive = (profile.boostUntil || 0) > now;

  /** Mahsulotni foydalanuvchiga beradi (sotib olish, admin sovg'asi) */
  const giveItem = (p: UserProfile, id: string, it?: ShopItem): UserProfile => {
    const own = Array.from(new Set([...(p.own || []), id]));
    const n: UserProfile = { ...p, own, updatedAt: nowMs() };
    const k = it?.kind;
    if (k === 'frame') n.frame = n.frame || it!.value;
    if (k === 'skin') n.skin = it!.value;
    if (k === 'nickcolor') n.nameColor = n.nameColor || NICK_COLORS[0];
    if (k === 'glow') n.nameFx = 'gold';
    if (k === 'titles') n.title = n.title || TITLES[0];
    if (k === 'rankbadge') n.rankBadge = n.rankBadge || 'crown';
    if (k === 'boost') { n.own = p.own; n.boostUntil = Math.max(nowMs(), p.boostUntil || 0) + (Number(it!.value) || 1) * 3600000; }
    if (k === 'saver' || k === 'spin' || k === 'mystery' || k === 'manual') n.own = p.own;
    return n;
  };
  /** Baraban bilan bog'liq mahsulotlar (streak himoyasi, aylantirish) — holat yangilovchi funksiyadan TASHQARIDA qo'llanadi */
  const wheelItem = (it?: ShopItem) => {
    if (!it) return;
    if (it.kind === 'saver') setWheel(x => ({ ...x, streakSavers: x.streakSavers + (Number(it.value) || 1) }));
    if (it.kind === 'spin') setWheel(x => ({ ...x, bonusSpins: x.bonusSpins + (Number(it.value) || 1) }));
  };

  const buyLock = useRef(0);
  const buyItem = (id: string): { ok: boolean; error?: string; reveal?: string } => {
    const it = catalogRef.current.find(x => x.id === id);
    if (!it) return { ok: false, error: 'Mahsulot topilmadi' };
    if (Date.now() - buyLock.current < 600) return { ok: false, error: '' };
    const p = latest.current.profile as UserProfile;
    const t = todayKey();
    const price = priceOf(it);
    if (balanceOf(p) < price) return { ok: false, error: `Tanga yetarli emas (yana ${price - balanceOf(p)} kerak)` };
    if (!it.repeat && (p.own || []).includes(it.id)) return { ok: false, error: 'Bu mahsulot sizda allaqachon bor' };
    const b = p.buys?.[it.id];
    const dn = b && b.d === t ? b.dn : 0;
    if (it.dayLimit > 0 && dn >= it.dayLimit) return { ok: false, error: `Bu mahsulotni kuniga ${it.dayLimit} marta olish mumkin` };
    buyLock.current = Date.now();
    let reveal = '';
    let extra: (p: UserProfile) => UserProfile = x => x;
    if (it.kind === 'mystery') {
      const r = Math.random();
      if (r < 0.3) { const xp = [30, 50, 100][Math.floor(Math.random() * 3)]; reveal = `⭐ +${xp} XP`; extra = x => addXpTo(x, xp); }
      else if (r < 0.5) { const c = [50, 100, 200][Math.floor(Math.random() * 3)]; reveal = `🪙 +${c} tanga`; extra = x => ({ ...x, coinsEarned: (x.coinsEarned || 0) + c }); }
      else if (r < 0.68) { reveal = '⚡ 2x XP (1 soat)'; extra = x => ({ ...x, boostUntil: Math.max(nowMs(), x.boostUntil || 0) + 3600000 }); }
      else if (r < 0.82) { reveal = '🛡️ Streak himoyasi'; setWheel(x => ({ ...x, streakSavers: x.streakSavers + 1 })); }
      else if (r < 0.92) { reveal = '🎡 2 ta aylantirish'; setWheel(x => ({ ...x, bonusSpins: x.bonusSpins + 2 })); }
      else {
        const av = LTD_AVATARS[Math.floor(Math.random() * LTD_AVATARS.length)];
        reveal = `${av.emoji} Noyob avatar!`;
        extra = x => ({ ...x, own: Array.from(new Set([...(x.own || []), `av:${av.id}`])) });
      }
    }
    setProfile(prev => {
      let n = giveItem(prev, it.id, it);
      if (it.repeat && it.kind !== 'manual') n.own = prev.own; // qayta olinadiganlar «bor» deb belgilanmaydi
      if (it.repeat && it.kind === 'manual') n.own = prev.own;
      n = extra(n);
      const old = prev.buys?.[it.id];
      n.coinsSpent = (prev.coinsSpent || 0) + price;
      n.buys = { ...(prev.buys || {}), [it.id]: { n: (old?.n || 0) + 1, d: t, dn: (old && old.d === t ? old.dn : 0) + 1 } };
      return n;
    });
    wheelItem(it);
    triggerHaptic('success');
    sfx.win(false);
    if (it.kind === 'manual') queueOrder(it, price);
    return { ok: true, reveal };
  };

  // Qo'lda beriladigan mahsulotlar (Telegram Premium/Stars...): buyurtma serverga yuboriladi, muvaffaqiyatsiz bo'lsa qayta uriniladi
  const orderBusy = useRef(false);
  const queueOrder = (it: ShopItem, price: number) => {
    const q = load<any[]>('lx_orders_v1', []);
    q.push({ itemId: it.id, title: it.title, price, ts: Date.now() });
    save('lx_orders_v1', q.slice(-10));
    flushOrders();
  };
  const flushOrders = async () => {
    if (orderBusy.current) return;
    const q = load<any[]>('lx_orders_v1', []);
    if (!q.length) return;
    orderBusy.current = true;
    try {
      const rest = [...q];
      for (const o of q) {
        const r = await fetch('/api/fn/shop', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: myId.current, initData: getTelegramWebApp()?.initData || '', action: 'order', itemId: o.itemId, title: o.title, price: o.price, name: latest.current.profile.name }),
        });
        if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) rest.shift();
        else break;
      }
      save('lx_orders_v1', rest);
    } catch { /* keyingi safar qayta uriniladi */ } finally { orderBusy.current = false; }
  };
  useEffect(() => { if (syncReady) setTimeout(flushOrders, 4000); }, [syncReady]);

  const equip = (field: 'frame' | 'nameFx' | 'nameColor' | 'nameSym' | 'title' | 'rankBadge' | 'skin', value: string): boolean => {
    const own = latest.current.profile.own || [];
    const need: Record<string, string> = { frame: value ? `frame_${value}` : '', skin: value ? `skin_${value}` : '', title: 'titles', nameColor: 'nickcolor', nameSym: 'nickcolor', nameFx: 'glow', rankBadge: 'rankbadge' };
    if (need[field] && !own.includes(need[field])) return false;
    setProfile(p => ({ ...p, [field]: value, updatedAt: nowMs() }));
    return true;
  };

  // Mavzu (skin) ilova ranglarini o'zgartiradi
  useEffect(() => {
    const sk = profile.skin && (profile.own || []).includes(`skin_${profile.skin}`) ? profile.skin : '';
    if (sk) document.documentElement.setAttribute('data-skin', sk);
    else document.documentElement.removeAttribute('data-skin');
  }, [profile.skin, profile.own]);

  // Boshlang'ich tanga (bir marta) va seriya bonuslari
  useEffect(() => {
    if (!syncReady || !profile.hasCompletedOnboarding || profile.coinInit || (realtimeEnabled && !config)) return;
    setProfile(p => (p.coinInit ? p : { ...p, coinInit: true, coinsEarned: (p.coinsEarned || 0) + shopConf.startCoins }));
  }, [syncReady, profile.hasCompletedOnboarding, profile.coinInit, config]);
  useEffect(() => {
    if (!syncReady || !profile.hasCompletedOnboarding || !profile.lastReadDate) return;
    const st = profile.streak;
    if (st >= 7 && st % 7 === 0 && shopConf.streak7 > 0) earnCoins(shopConf.streak7, `s7:${profile.lastReadDate}`);
    if (st >= 30 && st % 30 === 0 && shopConf.streak30 > 0) earnCoins(shopConf.streak30, `s30:${profile.lastReadDate}`);
  }, [profile.streak, profile.lastReadDate, syncReady]);

  // Taklif: havola, hisoblagich va «Targ'ibotchilar» reytingi
  const refCfg = config?.referral || {};
  const refInfo = { enabled: refCfg.enabled !== false, xp: Number.isFinite(Number(refCfg.xp)) && refCfg.xp !== '' && refCfg.xp !== undefined ? Number(refCfg.xp) : 50, shareText: String(refCfg.shareText || '') };
  const tgIdNow = getTelegramUserId();
  const inviteLink = inviteLinkFor(tgIdNow, botNameFrom(refCfg.botUsername));
  const refCount = Math.max(0, Number(leagueRaw?.[myId.current]?.refs) || 0);

  // ---------- kunlik missiyalar ----------
  const dayCfg = config?.daily?.[today] || config?.daily?.default || null;
  const desiredIds: string[] = dayCfg?.quests ? toArray(dayCfg.quests).map(String) : DEFAULT_QUEST_IDS;
  const idsKey = desiredIds.join('|');
  const curQuestKey = questState.quests.map(q => q.id).join('|');
  useEffect(() => {
    // Admin belgilagan missiyalar bilan mos kelmasa (admin almashtirgan yoki sinxronlash eski ro'yxatni qaytargan bo'lsa) — qayta quriladi.
    // Bajarilgan progress faqat bir xil missiyalar uchun saqlanadi.
    setQuestState(prev => {
      const sameDay = prev.date === today;
      if (sameDay && prev.quests.map(q => q.id).join('|') === idsKey) return prev;
      return { date: today, quests: buildQuests(idsKey.split('|'), sameDay ? prev.quests : []) };
    });
  }, [today, idsKey, curQuestKey, questState.date]);
  const dailyQuests = questState.quests;

  const bumpQuest = (type: DailyQuest['type'], n = 1) => {
    setQuestState(prev => ({
      ...prev,
      quests: prev.quests.map(q => {
        if (q.type !== type || q.completed) return q;
        const cur = Math.min(q.target, q.current + n);
        return { ...q, current: cur, completed: cur >= q.target };
      }),
    }));
  };

  // ---------- baraban ----------
  const normalizeWheel = (w0: WheelState, t: number): WheelState => {
    let w = w0;
    if (w.lockedUntil > 0 && t >= w.lockedUntil) w = { ...w, lockedUntil: 0, spinsUsed: 0 };
    // admin sovg'a qilgan aylantirishlar muddati tugagan bo'lsa — yonib ketadi (har kuni qaytmaydi)
    if (w.grantSpinsUntil > 0 && t >= w.grantSpinsUntil) w = { ...w, grantSpins: 0, grantSpinsUntil: 0 };
    return w;
  };
  const w = normalizeWheel(wheel, now);
  const lockActive = w.lockedUntil > now;
  const freeSpinsLeft = lockActive ? 0 : Math.max(0, wheelCfg.freeSpins - w.spinsUsed);
  const totalSpinsLeft = freeSpinsLeft + w.bonusSpins + w.grantSpins;
  const isPro = wheel.proUntil > now;

  useEffect(() => {
    if (wheel.lockedUntil > 0 && now >= wheel.lockedUntil) setWheel(p => normalizeWheel(p, nowMs()));
  }, [now, wheel.lockedUntil]);

  const spinWheel = () => {
    const t = nowMs();
    const cur = normalizeWheel(wheel, t);
    const free = cur.lockedUntil > t ? 0 : Math.max(0, wheelCfg.freeSpins - cur.spinsUsed);
    if (free + cur.bonusSpins + cur.grantSpins <= 0) return null;
    const prize = pickPrize(wheelCfg.prizes);
    // Tartib: avval sovg'a (muddatli) aylantirishlar, keyin bonuslar, oxirida kunlik bepul aylantirishlar
    const fromGrant = cur.grantSpins > 0;
    const fromBonus = !fromGrant && cur.bonusSpins > 0;
    const usedFree = !fromGrant && !fromBonus;
    setWheel(() => {
      const next: WheelState = { ...cur, totalSpins: cur.totalSpins + 1 };
      if (fromGrant) {
        next.grantSpins = cur.grantSpins - 1;
        if (next.grantSpins <= 0) next.grantSpinsUntil = 0;
      } else if (fromBonus) {
        next.bonusSpins = cur.bonusSpins - 1;
      } else {
        next.spinsUsed = cur.spinsUsed + 1;
        if (next.spinsUsed >= wheelCfg.freeSpins) next.lockedUntil = t + wheelCfg.cooldownMs;
      }
      return next;
    });
    bumpQuest('spin_wheel');
    return { prize, usedFree };
  };

  // Sovrin effekti baraban to'xtagandan KEYIN qo'llanadi
  const applyPrize = (prize: WheelPrize, usedFree: boolean) => {
    if (prize.type === 'xp') setProfile(p => addXpTo(p, prize.amount));
    setWheel(p => {
      const next = { ...p };
      switch (prize.type) {
        case 'extra_spin':
          if (usedFree) {
            next.spinsUsed = Math.max(0, p.spinsUsed - 1);
            next.lockedUntil = 0;
            next.bonusSpins = p.bonusSpins + Math.max(0, prize.amount - 1);
          } else next.bonusSpins = p.bonusSpins + prize.amount;
          break;
        case 'double_xp':
          next.doubleXpPending = true;
          break;
        case 'vip':
          next.proUntil = Math.max(nowMs(), p.proUntil) + prize.amount * 3600000;
          break;
        case 'streak_saver':
          next.streakSavers = p.streakSavers + prize.amount;
          break;
      }
      return next;
    });
  };

  const grantReferralSpin = (): boolean => {
    const t = todayKey();
    if (wheel.referralDayKey === t) return false;
    setWheel(p => ({ ...p, referralDayKey: t, bonusSpins: p.bonusSpins + 1 }));
    return true;
  };
  useEffect(() => {
    try {
      const param = getStartParam();
      if (!param || !param.startsWith('ref_')) return;
      if (lsGet('lx_referred_v1')) return;
      lsSet('lx_referred_v1', param);
      if (String(getTelegramUserId() ?? '') === param.slice(4)) return;
      setWheel(p => ({ ...p, bonusSpins: p.bonusSpins + 1 }));
    } catch {
      /* ignore */
    }
  }, []);

  // Admin sovg'alari: server har bir sovg'ani faqat BIR MARTA beradi (qaysi qurilmadan bo'lmasin), shuning uchun
  // ular har kuni yoki har qurilmada qayta qo'llanmaydi. Aylantirish sovg'alarining muddati bor.
  const [grantsReady, setGrantsReady] = useState(!realtimeEnabled);
  const grantsBusy = useRef(false);
  const claimGrants = async () => {
    if (!realtimeEnabled || grantsBusy.current) return;
    grantsBusy.current = true;
    try {
      const r = await fetch('/api/fn/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: myId.current, initData: getTelegramWebApp()?.initData || '', done: latest.current.grantsDone }),
      });
      if (!r.ok) throw new Error('grants ' + r.status);
      const j = await r.json();
      const list: { id: string; type: string; amount: number; validHours: number; note?: string; itemId?: string }[] = Array.isArray(j.grants) ? j.grants : [];
      list.forEach(g => {
        const amount = Math.max(0, Math.min(10000000, Number(g.amount) || 0));
        if (g.type === 'spins' && amount > 0) {
          const t = nowMs();
          setWheel(p => {
            const active = p.grantSpinsUntil === 0 || p.grantSpinsUntil > t ? p.grantSpins : 0;
            const until = g.validHours > 0 ? t + g.validHours * 3600000 : 0;
            const keepOld = active > 0 ? p.grantSpinsUntil : -1;
            const merged = keepOld === -1 ? until : keepOld === 0 || until === 0 ? 0 : Math.max(keepOld, until);
            return { ...p, grantSpins: active + amount, grantSpinsUntil: merged };
          });
          pushNotice(`🎁 Admin sizga +${amount} ta aylantirish sovg'a qildi${g.validHours > 0 ? ` (${g.validHours >= 24 ? Math.round(g.validHours / 24) + ' kun' : g.validHours + ' soat'} ichida ishlating)` : ''}`);
        } else if (g.type === 'vip' && amount > 0) {
          setWheel(p => ({ ...p, proUntil: Math.max(nowMs(), p.proUntil) + amount * 3600000 }));
          pushNotice(`👑 Admin sizga ${amount} soatlik VIP sovg'a qildi`);
        } else if (g.type === 'xp' && amount > 0) {
          setProfile(p => addXpTo(p, amount));
          pushNotice(g.note && /^Do'st taklif/.test(g.note) ? `🎉 ${g.note.replace('Do\'st taklif qilindi: ', '')} do'stingiz qo'shildi: +${amount} XP` : `💎 Admin sizga +${amount} XP sovg'a qildi`);
        } else if (g.type === 'coins' && amount > 0) {
          setProfile(p => ({ ...p, coinsEarned: (p.coinsEarned || 0) + amount }));
          pushNotice(`🪙 Admin sizga +${amount.toLocaleString()} tanga sovg'a qildi`);
        } else if (g.type === 'item' && /^[A-Za-z0-9_\-]{1,64}$/.test(g.itemId || '')) {
          const iid = String(g.itemId);
          const it = catalogRef.current.find(x => x.id === iid);
          setProfile(p => giveItem(p, iid, it));
          wheelItem(it);
          pushNotice(`🎁 Admin sizga sovg'a qildi: ${it ? it.title : 'mahsulot'}`);
        }
        // Eski «xpset» sovg'alari endi qo'llanmaydi: admin XP o'zgartirishi Liga yozuvidagi `adj` orqali (farq sifatida) ishlaydi.
      });
      if (list.length) setGrantsDone(prev => Array.from(new Set([...prev, ...list.map(g => g.id)])));
      setGrantsReady(true);
    } catch {
      setTimeout(() => setGrantsReady(true), 4000); // aloqa yo'q bo'lsa ham ilova to'xtab qolmaydi
    } finally {
      grantsBusy.current = false;
    }
  };
  // Netlify kreditini tejash: sovg'ani tekshirish funksiyasi FAQAT admin sovg'a yuborganida (reytingdagi `hasGrant` bayrog'i)
  // chaqiriladi. Soatiga bir marta so'rov yuborish bekor qilindi. Yangilanishdan keyingi birinchi kirishda bitta tekshiruv bor
  // (eski, bayroqsiz sovg'alar yo'qolmasligi uchun).
  const grantsBoot = useRef(false);
  useEffect(() => {
    if (!realtimeEnabled || !syncReady || !profile.hasCompletedOnboarding) return;
    if (leagueRaw === null && !grantsBoot.current) {
      const t = setTimeout(() => setGrantsReady(true), 6000); // reyting kelmasa ham ilova to'xtab qolmaydi
      return () => clearTimeout(t);
    }
    const flagged = leagueRaw?.[myId.current]?.hasGrant === true;
    const firstEver = !lsGet('lx_grants_boot_v2');
    if (flagged || (firstEver && !grantsBoot.current)) {
      grantsBoot.current = true;
      lsSet('lx_grants_boot_v2', '1');
      claimGrants();
    } else {
      grantsBoot.current = true;
      setGrantsReady(true);
    }
  }, [syncReady, profile.hasCompletedOnboarding, leagueRaw]);

  // Eski "XP ofseti" (admin XP ni o'zgartirganda ishlatilgan) ni haqiqiy XP ga aylantiramiz: shundan keyin
  // foydalanuvchi yig'gan XP Ligada darhol ko'rinadi.
  useEffect(() => {
    if (!realtimeEnabled || !syncReady || !grantsReady || !profile.hasCompletedOnboarding) return;
    const self = leagueRaw?.[myId.current];
    const off = Number(self?.xpOffset) || 0;
    if (!off) return;
    const nx = Math.max(0, profile.xp + off);
    setProfile(p => ({ ...p, xp: nx, xpSets: Array.from(new Set([...(p.xpSets || []), `lg${off}_${nx}`])), updatedAt: nowMs() }));
    patch(`leaderboard/${myId.current}`, { xp: nx, xpOffset: 0 });
  }, [leagueRaw, syncReady, grantsReady, profile.hasCompletedOnboarding]);

  // Admin XP ni o'zgartirsa (Liga yozuvidagi `adj` / `adjV`), shu FARQ foydalanuvchining o'z XP siga bir marta qo'shiladi.
  // Shundan keyin foydalanuvchi yig'gan XP admin qo'ygan qiymatning ustiga qo'shiladi (grant/qurilma holatiga bog'liq emas).
  useEffect(() => {
    if (!realtimeEnabled || !syncReady || !profile.hasCompletedOnboarding) return;
    const self = leagueRaw?.[myId.current];
    if (!self) return;
    const v = Number(self.adjV) || 0;
    if (v <= (profile.adjV || 0)) return;
    const adj = Number(self.adj) || 0;
    const delta = adj - (profile.adjApplied || 0);
    setProfile(p => (v <= (p.adjV || 0) ? p : { ...p, xp: Math.max(0, p.xp + delta), adjV: v, adjApplied: adj, updatedAt: nowMs() }));
  }, [leagueRaw, syncReady, profile.hasCompletedOnboarding, profile.adjV]);

  const applyXpMultiplier = (amount: number): number => {
    if (amount > 0 && (latest.current.profile.boostUntil || 0) > nowMs()) return amount * 2; // do'kondan olingan 2x kuchaytirgich
    if (!wheel.doubleXpPending || amount <= 0) return amount;
    setWheel(p => ({ ...p, doubleXpPending: false }));
    return amount * 2;
  };
  const addXp = (amount: number): number => {
    const gained = applyXpMultiplier(amount);
    setProfile(p => addXpTo(p, gained));
    return gained;
  };

  // ---------- streak ----------
  // Streak oynalari: (1) bugungi streak yig'ilganda "N kun streak"; (2) muzlatish yutilgan va bir kun o'tkazib yuborilgan bo'lsa,
  // ilovaga kirganda birinchi navbatda "streak muzladi" xabari. Har biri kuniga bir martadan.
  const [streakPopup, setStreakPopup] = useState<StreakPopupData | null>(null);
  const gainPopDay = useRef<string>(load<string>('lx_streak_pop_v1', ''));
  const freezePopDay = useRef<string>(load<string>('lx_freeze_pop_v1', ''));
  const actDay = useRef<string>(''); // shu sessiyada bugungi mashq allaqachon hisobga olinganmi
  useEffect(() => {
    if (actDay.current && profile.lastReadDate !== actDay.current) actDay.current = ''; // bulut eski holatni qaytargan bo'lsa
  }, [profile.lastReadDate]);

  const dismissStreakPopup = () => setStreakPopup(null);

  const registerActivity = () => {
    const t = todayKey();
    const L = latest.current.profile as UserProfile;
    const W = latest.current.wheel as WheelState;
    if (L.lastReadDate === t || actDay.current === t) return;
    let streak = 1;
    let usedSaver = false;
    if (L.lastReadDate) {
      const gap = dayDiff(L.lastReadDate, t);
      if (gap < 0) return; // qurilma soati orqaga ketgan — streak o'zgarmaydi
      if (gap === 1) streak = L.streak + 1;
      else if (gap === 2 && W.streakSavers > 0) {
        streak = L.streak + 1;
        usedSaver = true;
      }
    }
    actDay.current = t;
    setProfile(prev => (prev.lastReadDate === t ? prev : { ...prev, streak, lastReadDate: t }));
    if (usedSaver) setWheel(x => ({ ...x, streakSavers: Math.max(0, x.streakSavers - 1) }));
    if (gainPopDay.current !== t) {
      gainPopDay.current = t;
      save('lx_streak_pop_v1', t);
      setStreakPopup({ kind: 'gain', streak, saved: usedSaver });
    }
  };

  // Muzlatish yutilgan, lekin kecha mashq qilinmagan: ilovaga kirganda darhol ogohlantiramiz
  useEffect(() => {
    if (!syncReady || !profile.hasCompletedOnboarding || !profile.lastReadDate) return;
    if (dayDiff(profile.lastReadDate, today) !== 2) return;
    if (wheel.streakSavers <= 0 || profile.streak <= 0) return;
    if (freezePopDay.current === today) return;
    freezePopDay.current = today;
    save('lx_freeze_pop_v1', today);
    setStreakPopup({ kind: 'frozen', streak: profile.streak, savers: wheel.streakSavers });
  }, [syncReady, profile.hasCompletedOnboarding, profile.lastReadDate, profile.streak, wheel.streakSavers, today]);

  // ---------- so'z o'rganish ----------
  const savedWords: SavedWord[] = useMemo(
    () =>
      Object.entries(srs)
        .map(([id, e]) => {
          const b = bankMap.get(id);
          if (!b) return null;
          return {
            id, word: b.en, ipa: b.ipa, uzbek: b.uz, partOfSpeech: b.pos, definitionUz: b.hook,
            contextSentence: b.ex, contextUz: b.exUz, level: b.level, dateAdded: e.intro,
            reviewCount: e.seen, mastered: e.mastered,
          } as SavedWord;
        })
        .filter(Boolean) as SavedWord[],
    [srs, bankMap]
  );
  const masteredCount = savedWords.filter(x => x.mastered).length;

  // Reytingga o'z ma'lumotlarimizni yuboramiz. Netlify kreditini tejash uchun: o'zgarmagan bo'lsa yuborilmaydi,
  // tez-tez o'zgarsa ham ko'pi bilan LB_THROTTLE_MS da bir marta yuboriladi, ilova yopilganda esa darhol yuboriladi.
  const lbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lbPayload = useRef<Record<string, any> | null>(null);
  const lbLastSig = useRef('');
  const flushLb = (keepalive = false) => {
    if (lbTimer.current) {
      clearTimeout(lbTimer.current);
      lbTimer.current = null;
    }
    const p = lbPayload.current;
    if (!p) return;
    lbPayload.current = null;
    const { ts: _ts, ...rest } = p;
    const sig = JSON.stringify(rest);
    if (sig === lbLastSig.current) return;
    lbLastSig.current = sig;
    patch(`leaderboard/${myId.current}`, { ...p, ts: nowMs() }, keepalive).then(ok => {
      if (!ok) lbLastSig.current = '';
    });
  };
  // Reytingga yozishdan oldin Liga yozuvi yuklanishini kutamiz (admin XP tuzatishi eski XP bilan ustidan yozilib ketmasin)
  const [lbGate, setLbGate] = useState(false);
  useEffect(() => {
    if (leagueRaw !== null) setLbGate(true);
  }, [leagueRaw]);
  useEffect(() => {
    const t = setTimeout(() => setLbGate(true), 10000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!realtimeEnabled || !profile.hasCompletedOnboarding || !syncReady || !grantsReady || !lbGate) return;
    // Admin XP tuzatishi hali qo'llanmagan bo'lsa, eski XP ni yubormaymiz (yuqoridagi effekt avval qo'llaydi)
    const selfLb = leagueRaw?.[myId.current];
    if (selfLb && (Number(selfLb.adjV) || 0) > (profile.adjV || 0)) return;
    lbPayload.current = {
      name: profile.name,
      avatar: profile.avatar.startsWith('data:') && profile.avatar.length > 1500 ? '' : profile.avatar,
      xp: profile.xp,
      xpOffset: 0,
      streak: profile.streak,
      level: profile.level,
      wpd: profile.wordsPerDay,
      learned: savedWords.length,
      mastered: masteredCount,
      un: profile.username || '',
      joined: profile.joinedAt || '',
      lr: profile.lastReadDate || '', // oxirgi mashq kuni — bot streak haqida oldindan ogohlantirishi uchun
      sv: wheel.streakSavers || 0, // muzlatish (streak saver) soni
      co: balanceOf(profile), // tanga balansi (admin ko'rishi uchun)
      fr: profile.frame || '', nf: profile.nameFx || '', nc: profile.nameColor || '', ns: profile.nameSym || '',
      ti: profile.title || '', vf: (profile.own || []).includes('verified'), rb: profile.rankBadge || '',
      ts: 0,
    };
    if (!lbTimer.current) lbTimer.current = setTimeout(() => flushLb(), lbLastSig.current ? LB_THROTTLE_MS : 2000);
  }, [profile.xp, profile.name, profile.avatar, profile.streak, profile.level, profile.wordsPerDay, profile.username, profile.joinedAt, profile.lastReadDate, wheel.streakSavers, profile.hasCompletedOnboarding, savedWords.length, masteredCount, syncReady, grantsReady, lbGate, leagueRaw, profile.adjV, coins, profile.frame, profile.nameFx, profile.nameColor, profile.nameSym, profile.title, profile.own, profile.rankBadge]);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushLb(true);
    const onPageHide = () => flushLb(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  const introducedToday = Object.values(srs).filter(e => e.intro === today).length;
  const todayPacks = useMemo(() => packs.filter(p => p.kind === 'daily' && p.date === today), [packs, today]);
  const learnedEn = useMemo(() => {
    const set = new Set<string>();
    Object.keys(srs).forEach(id => {
      const b = bankMap.get(id);
      if (b) set.add(b.en.toLowerCase());
    });
    return set;
  }, [srs, bankMap]);
  const packProgress = (p: WordPack) => ({ learned: p.words.filter(w => srs[w.id] || learnedEn.has(w.en.toLowerCase())).length, total: p.words.length });
  const newQueue = useMemo(() => {
    // Bugungi to'plam (admin yuklagan) so'zlari birinchi; "replace" rejimida odatdagi kunlik so'zlar o'rniga o'rganiladi
    const seen = new Set<string>();
    const fromPacks: BankWord[] = [];
    todayPacks.forEach(p =>
      p.words.forEach(w => {
        const en = w.en.toLowerCase();
        if (srs[w.id] || learnedEn.has(en) || seen.has(en)) return;
        seen.add(en);
        fromPacks.push(w);
      })
    );
    const replace = todayPacks.some(p => p.mode === 'replace' && p.words.length);
    const packIds = new Set(packWords.map(w => w.id));
    const introducedMain = Object.entries(srs).filter(([id, e]) => e.intro === today && !packIds.has(id)).length;
    const left = replace ? 0 : Math.max(0, profile.wordsPerDay - introducedMain);
    // Odatiy kunlik so'zlar: foydalanuvchi darajasidagi tartib bo'yicha navbatdagi o'rganilmagan so'zlar (har kuni yangi to'plam)
    const regular = levelMain.filter(b => !srs[b.id] && !learnedEn.has(b.en.toLowerCase()) && !seen.has(b.en.toLowerCase())).slice(0, left);
    return [...fromPacks, ...regular];
  }, [levelMain, srs, profile.wordsPerDay, today, todayPacks, learnedEn, packWords]);

  const dueWords = useMemo(() => {
    const due = Object.entries(srs)
      .filter(([, e]) => e.due <= today && !(e.intro === today && e.box > 0))
      .sort((a, b) => (a[1].due < b[1].due ? -1 : 1))
      .map(([id]) => bankMap.get(id))
      .filter(Boolean) as BankWord[];
    return due.slice(0, settings.reviewCap);
  }, [srs, today, bankMap, settings.reviewCap]);

  const introduceWord = (b: BankWord, correct: boolean): number => {
    setSrs(prev => (prev[b.id] ? prev : { ...prev, [b.id]: { ...newEntry(todayKey(), correct), xpDay: todayKey() } }));
    bumpQuest('learn_words');
    registerActivity();
    return addXp(settings.xpNewWord);
  };

  const reviewWord = (b: BankWord, correct: boolean): number => {
    const t = todayKey();
    const cur = srs[b.id];
    if (!cur) return 0;
    const next = applyResult(cur, correct, t);
    // XP: har bir so'z uchun kuniga faqat bir marta (qayta takrorlash XP bermaydi)
    const give = correct && cur.xpDay !== t;
    setSrs(prev => ({ ...prev, [b.id]: give ? { ...next, xpDay: t } : next }));
    bumpQuest('review_words');
    if (!cur.mastered && next.mastered) {
      bumpQuest('master_words');
      triggerHaptic('success');
    }
    registerActivity();
    return give ? addXp(settings.xpCorrect) : 0;
  };

  const addWord = (_d: any): boolean => false; // so'zlar endi admin bankidan o'rganiladi
  const isWordSaved = (word: string) => savedWords.some(x => x.word.toLowerCase() === word.toLowerCase().trim());
  const markWordReviewed = (id: string, remembered: boolean) => {
    const b = bankMap.get(id);
    if (b) reviewWord(b, remembered);
  };

  const claimDailyBonus = (): number => {
    const t = todayKey();
    if (profile.bonusDays.includes(t)) return 0;
    const xp = applyXpMultiplier(settings.xpDailyBonus);
    setProfile(p => ({ ...addXpTo(p, xp), bonusDays: [...p.bonusDays.slice(-30), t] }));
    triggerHaptic('success');
    return xp;
  };

  const openGame = (id: string): boolean => {
    const g = games.find(x => x.id === id);
    if (!g) return false;
    if (g.vip && !isPro) {
      triggerHaptic('warning');
      return false;
    }
    setOverlay({ type: 'game', id });
    return true;
  };

  // O'yin tugadi: aniqlik >= 60% bo'lsa XP (har bir o'yin uchun kuniga faqat bir marta)
  const completeGame = (id: string, correct: number, total: number, demo = false) => {
    const t = todayKey();
    const g = games.find(x => x.id === id);
    const passed = total > 0 && correct / total >= 0.6;
    if (demo || !g || !passed) return { xp: 0, passed, already: false };
    const already = profile.gameXp[id] === t;
    if (already) return { xp: 0, passed, already: true };
    const xp = applyXpMultiplier(g.xp);
    setProfile(p => ({ ...addXpTo(p, xp), gameXp: { ...p.gameXp, [id]: t } }));
    setGamesPlayed(n => n + 1);
    bumpQuest('play_game');
    if (correct === total) bumpQuest('perfect_round');
    registerActivity();
    triggerHaptic('success');
    return { xp, passed, already: false };
  };

  // ---------- sertifikatlar ----------
  const cloudCerts: Certificate[] = Object.entries(certsRaw || {})
    .filter(([, c]) => c)
    .map(([id, c]: [string, any]) => ({
      id, tpl: String(c.tpl || 'gold'), title: String(c.title || 'Maxsus sertifikat'), label: c.label ? String(c.label) : undefined,
      reason: c.reason ? String(c.reason) : undefined, name: String(c.name || profile.name),
      date: String(c.date || '').slice(0, 10), special: !c.auto, verified: true, delivered: !!c.sent,
      fmt: c.fmt === 'story' ? 'story' : 'wide', stats: c.stats && typeof c.stats === 'object' ? c.stats : undefined,
    }));
  const certificates = [...cloudCerts, ...localCerts].sort((a, b) => (a.date < b.date ? 1 : -1));

  // Bosqich sertifikatlari: yodlangan so'zlar 100 / 250 / 500 / 750 / 1000 ga yetganda.
  // Raqam va QR kodni server beradi (har bir sertifikat o'z raqami bilan ro'yxatga olinadi); muvaffaqiyatsiz bo'lsa qayta uriniladi.
  const claiming = useRef<Set<number>>(new Set());
  const [claimTick, setClaimTick] = useState(0);
  useEffect(() => {
    if (!syncReady || !profile.hasCompletedOnboarding) return;
    MILESTONES.forEach(m => {
      if (masteredCount < m.n || profile.milestones.includes(m.n) || claiming.current.has(m.n)) return;
      claiming.current.add(m.n);
      if (!realtimeEnabled) {
        // Server ulanmagan: mahalliy sertifikat (QR orqali tekshirib bo'lmaydi)
        const cert: Certificate = { id: 'VB-L' + nowMs().toString(36).toUpperCase().slice(-5), tpl: m.tpl, title: m.title, name: profile.name, date: todayKey(), special: false, verified: false };
        setLocalCerts(c => [cert, ...c]);
        setProfile(p => ({ ...p, milestones: [...p.milestones, m.n] }));
        setTimeout(() => { setCertificateView(cert); sfx.win(true); }, 500);
        return;
      }
      setTimeout(async () => {
        try {
          const r = await claimCertificate(myId.current, m.n, profile.name);
          if (r.id || r.revoked) setProfile(p => (p.milestones.includes(m.n) ? p : { ...p, milestones: [...p.milestones, m.n] }));
          if (!r.id && !r.revoked) throw new Error('retry');
        } catch {
          claiming.current.delete(m.n);
          setTimeout(() => setClaimTick(n => n + 1), 20000); // reyting yozuvi yetib borguncha yoki aloqa tiklanguncha
        }
      }, 3000);
    });
  }, [masteredCount, syncReady, profile.hasCompletedOnboarding, profile.milestones.length, claimTick]);

  // Ilovaga kirgandan 3 daqiqa o'tgach har bir foydalanuvchiga bir martalik «Minnatdorchilik» sertifikati beriladi.
  // Sarlavha va izoh serverda qat'iy; faqat ism va QR kod (sertifikat raqami) har safar boshqacha. Server bitta foydalanuvchiga faqat bitta beradi.
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    if (!syncReady || !profile.hasCompletedOnboarding || !realtimeEnabled) return;
    if (lsGet('lx_welcome_cert_v1')) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        lsSet('lx_certs_init_v1', '1'); // yangi sertifikat kelganda tabrik oynasi ko'rsatilishi uchun
        const r = await claimWelcomeCertificate(myId.current, latest.current.profile.name);
        if (r.id || r.revoked) lsSet('lx_welcome_cert_v1', '1');
        else retry = setTimeout(run, 30000); // boshqa qurilma hozir olayotgan bo'lishi mumkin
      } catch {
        retry = setTimeout(run, 60000); // aloqa yo'q — keyinroq qayta uriniladi
      }
    };
    const t = setTimeout(run, Math.max(0, 180000 - (Date.now() - mountedAt.current)));
    return () => {
      clearTimeout(t);
      if (retry) clearTimeout(retry);
    };
  }, [syncReady, profile.hasCompletedOnboarding]);

  // Admin yuborgan yangi sertifikat haqida bildirishnoma
  useEffect(() => {
    if (!certsRaw) return;
    const seen = new Set<string>(load<string[]>('lx_certs_seen_v1', []));
    const fresh = Object.keys(certsRaw).filter(id => certsRaw[id] && !seen.has(id));
    if (fresh.length) {
      fresh.forEach(id => seen.add(id));
      save('lx_certs_seen_v1', Array.from(seen));
      const first = certsRaw[fresh[0]];
      if (seen.size > fresh.length || lsGet('lx_certs_init_v1')) {
        pushNotice(first.auto ? '🎓 Tabriklaymiz! Yangi sertifikat oldingiz' : '🎓 Sizga maxsus sertifikat berildi!');
        sfx.win(true);
        setTimeout(() => setCertificateView({ id: fresh[0], tpl: String(first.tpl || 'gold'), label: first.label ? String(first.label) : undefined, title: String(first.title || ''), reason: first.reason, name: String(first.name || profile.name), date: String(first.date || '').slice(0, 10), special: !first.auto, verified: true, fmt: first.fmt === 'story' ? 'story' : 'wide', stats: first.stats && typeof first.stats === 'object' ? first.stats : undefined }), 600);
      }
      lsSet('lx_certs_init_v1', '1');
    } else lsSet('lx_certs_init_v1', '1');
  }, [certsRaw]);

  // Sertifikatlar avtomatik foydalanuvchining Telegram chatiga (bot orqali) yuboriladi — har biri bir marta
  const certSending = useRef(false);
  const certFailed = useRef<Set<string>>(new Set());
  const [certTick, setCertTick] = useState(0);
  const certKey = certificates.map(c => c.id).join(',');
  useEffect(() => {
    if (!canUseBot() || !syncReady || !profile.hasCompletedOnboarding || certSending.current) return;
    const sent = new Set(profile.sentCerts || []);
    const next = certificates.find(c => !c.delivered && !sent.has(c.id) && !certFailed.current.has(c.id));
    if (!next) return;
    certSending.current = true;
    (async () => {
      try {
        const image = await certificateBase64(next);
        await botSendCertificate({ id: next.id, title: next.title, date: next.date, image, kind: 'photo' });
        setProfile(p => ({ ...p, sentCerts: [...(p.sentCerts || []).slice(-60), next.id] }));
        pushNotice('🎓 Sertifikat Telegram chatingizga yuborildi');
      } catch {
        certFailed.current.add(next.id); // bu seansda qayta urinilmaydi; keyingi kirishda yana uriniladi
      } finally {
        certSending.current = false;
        setCertTick(n => n + 1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certKey, profile.sentCerts, syncReady, profile.hasCompletedOnboarding, certTick]);

  // Botga ro'yxatdan o'tish (kunlik eslatmalar uchun): kuniga bir marta, yoki sozlama o'zgarganda
  useEffect(() => {
    if (!canUseBot() || !profile.hasCompletedOnboarding) return;
    const remind = profile.botRemind !== false;
    // Netlify kreditini tejash: ro'yxatdan o'tkazish kuniga emas, 3 kunda bir marta (yoki sozlama o'zgarganda)
    const sig = `${Math.floor(dayDiff('2024-01-01', today) / 3)}|${remind}|${profile.level}|${profile.wordsPerDay}`;
    if (load<string>('lx_reg_v1', '') === sig) return;
    botRegister({ remind, level: profile.level, wordsPerDay: profile.wordsPerDay })
      .then(() => save('lx_reg_v1', sig))
      .catch(() => {
        /* bot sozlanmagan yoki oflayn */
      });
  }, [profile.hasCompletedOnboarding, profile.botRemind, profile.level, profile.wordsPerDay, today]);

  // Telegram: botga yozish ruxsatini bir marta so'raymiz (eslatma va sertifikat kelishi uchun)
  useEffect(() => {
    if (!canUseBot() || !profile.hasCompletedOnboarding) return;
    if (load<string>('lx_wa_v1', '')) return;
    save('lx_wa_v1', '1');
    const t = setTimeout(() => askBotWriteAccess(), 2500);
    return () => clearTimeout(t);
  }, [profile.hasCompletedOnboarding]);

  // Telegram "Orqaga" tugmasi
  useEffect(() => {
    const show = !!overlay || navHistory.length > 0;
    configureBackButton(show, show ? goBack : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay, navHistory.length]);

  // ---------- yutuqlar ----------
  useEffect(() => {
    setBadges(prev =>
      prev.map(b => {
        if (b.unlocked) return b;
        let ok = false;
        if (b.id === 'badge-first-step' && savedWords.length >= 10) ok = true;
        if (b.id === 'badge-word-master' && savedWords.length >= 50) ok = true;
        if (b.id === 'badge-flashcard-champ' && masteredCount >= 25) ok = true;
        if (b.id === 'badge-streak-fire' && profile.streak >= 3) ok = true;
        if (b.id === 'badge-quiz-ace' && gamesPlayed >= 5) ok = true;
        if (ok) {
          triggerHaptic('success');
          return { ...b, unlocked: true, unlockedAt: new Date().toISOString() };
        }
        return b;
      })
    );
  }, [savedWords.length, masteredCount, profile.streak, gamesPlayed]);

  // ---------- raqib bilan bellashuv ----------
  // Bellashuv bazada `duels/<kod>` ostida saqlanadi: har bir ishtirokchi o'z natijasini (boshlanganidan beri to'plagan XP /
  // yangi so'z / yodlangan so'z) yozib boradi, hamma bir-birining natijasini jonli ko'radi.
  const [duelRaw, setDuelRaw] = useState<Record<string, any>>({});
  const [pendingDuelCode, setPendingDuelCode] = useState('');
  const activeCodes = duelCodes.filter(c => !hiddenDuels.includes(c));
  const duelKey = activeCodes.join('|');
  useEffect(() => {
    if (!realtimeEnabled) return;
    const unsubs = activeCodes.map(code => subscribe(`duels/${code}`, v => setDuelRaw(prev => ({ ...prev, [code]: v }))));
    return () => unsubs.forEach(u => u());
  }, [duelKey]);

  const duelMetricValue = (m: DuelMetric): number => (m === 'xp' ? profile.xp : m === 'words' ? savedWords.length : masteredCount);
  const shortAvatar = profile.avatar && profile.avatar.length <= 400 ? profile.avatar : '';

  // Natija manbai: faol bellashuvda — har bir ishtirokchining Ligadagi jonli ko'rsatkichi (XP, yangi/yodlangan so'zlar) minus
  // qo'shilgan paytdagi boshlang'ich qiymat. Shu sabab baraban, o'yin, admin sovg'asi — hamma XP darhol hisobga olinadi.
  const liveValue = (uid: string, m: DuelMetric): number | null => {
    if (uid === myId.current) return duelMetricValue(m);
    const e = leagueRaw?.[uid];
    if (!e) return null;
    return m === 'xp' ? (Number(e.xp) || 0) + (Number(e.xpOffset) || 0) : m === 'words' ? Number(e.learned) || 0 : Number(e.mastered) || 0;
  };
  const duels: Duel[] = activeCodes
    .map(code => {
      const d = duelRaw[code];
      if (!d?.meta) return null;
      const players: DuelPlayer[] = Object.entries(d.players || {})
        .filter(([, p]) => p)
        .map(([id, p]: [string, any]) => {
          const metric = (['xp', 'words', 'mastered'].includes(d.meta.metric) ? d.meta.metric : 'xp') as DuelMetric;
          const base = { xp: Number(p.base?.xp) || 0, words: Number(p.base?.words) || 0, mastered: Number(p.base?.mastered) || 0 };
          const stored = Math.max(0, Number(p.gain) || 0);
          const ended = nowMs() >= (Number(d.meta.endsAt) || 0);
          const lv = ended ? null : liveValue(id, metric);
          const live = lv === null ? 0 : Math.max(0, lv - base[metric]);
          return {
            id,
            name: id === myId.current ? profile.name : String(p.name || (leagueRaw?.[id]?.name ?? "O'quvchi")),
            avatar: id === myId.current ? shortAvatar || String(p.avatar || '') : String(p.avatar || leagueRaw?.[id]?.avatar || ''),
            gain: Math.max(stored, live),
            joinedAt: Number(p.joinedAt) || 0,
            ts: Number(p.ts) || 0,
            base,
          };
        })
        .sort((a, b) => b.gain - a.gain || a.ts - b.ts);
      return {
        code,
        title: String(d.meta.title || ''),
        metric: (['xp', 'words', 'mastered'].includes(d.meta.metric) ? d.meta.metric : 'xp') as DuelMetric,
        createdBy: String(d.meta.createdBy || ''),
        createdAt: Number(d.meta.createdAt) || 0,
        endsAt: Number(d.meta.endsAt) || 0,
        maxPlayers: Number(d.meta.maxPlayers) || 2,
        players,
      } as Duel;
    })
    .filter(Boolean)
    .sort((a, b) => b!.createdAt - a!.createdAt) as Duel[];

  // O'z natijamni bazaga yozaman (tugagan bellashuvga yozilmaydi — natija qotadi)
  useEffect(() => {
    if (!realtimeEnabled || !syncReady || !profile.hasCompletedOnboarding) return;
    const t = setTimeout(() => {
      const me = myId.current;
      duels.forEach(d => {
        const mine = d.players.find(p => p.id === me);
        if (!mine || nowMs() >= d.endsAt) return;
        const cur = duelMetricValue(d.metric);
        const gain = Math.max(0, cur - mine.base[d.metric]);
        const rawP = duelRaw[d.code]?.players?.[me] || {};
        // saqlangan qiymat bilan farq qilsa (yoki ism o'zgargan bo'lsa) — bazaga yozamiz; natija faqat oshib boradi
        if (gain > (Number(rawP.gain) || 0) || rawP.name !== profile.name) {
          patch(`duels/${d.code}/players/${me}`, { gain: Math.max(gain, Number(rawP.gain) || 0), ts: nowMs(), name: profile.name, avatar: shortAvatar });
        }
      });
    }, 8000);
    return () => clearTimeout(t);
  }, [profile.xp, savedWords.length, masteredCount, profile.name, shortAvatar, duelRaw, syncReady, now]);

  // ---------- Qo'shimcha avtomatik sertifikatlar ----------
  //   Barqaror (7/14/30 kun streak) · Bilim donosi (daraja tugatildi) · Tezkor (duel g'alabalari) · Mutaxassis (mavzuli to'plam)
  // Har bir mezon uchun server faqat BIR MARTA sertifikat beradi; bajarilganlari qurilmada eslab qolinadi (ortiqcha so'rov yo'q).
  const [duelWins, setDuelWins] = useState<number>(() => load<string[]>('lx_duelwins_v1', []).length);
  const duelsSig = duels.map(d => `${d.code}:${nowMs() >= d.endsAt ? 1 : 0}:${d.players.length}:${d.players[0]?.id}:${d.players[0]?.gain}`).join('|');
  useEffect(() => {
    const me = myId.current;
    const won = new Set<string>(load<string[]>('lx_duelwins_v1', []));
    let changed = false;
    duels.forEach(d => {
      const top = d.players[0];
      if (nowMs() >= d.endsAt && d.players.length >= 2 && top && top.id === me && top.gain > 0 && !won.has(d.code)) {
        won.add(d.code);
        changed = true;
      }
    });
    if (changed) {
      save('lx_duelwins_v1', Array.from(won));
      setDuelWins(won.size);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelsSig]);

  const awardBusy = useRef(false);
  const awardFail = useRef<Record<string, number>>({});
  const [awardTick, setAwardTick] = useState(0);
  const awardCandidates = useMemo(() => {
    type Cand = { kind: 'streak' | 'level' | 'duel' | 'pack'; key: string; n?: number; level?: string; title?: string };
    const list: Cand[] = [];
    [7, 14, 30].forEach(n => profile.streak >= n && list.push({ kind: 'streak', key: String(n), n }));
    [10, 25, 50].forEach(n => duelWins >= n && list.push({ kind: 'duel', key: String(n), n }));
    (['A1', 'A2', 'B1', 'B2+'] as const).forEach(L => {
      const ws = mainBank.filter(w => w.level === L);
      if (ws.length >= 20 && ws.every(w => srs[w.id]?.mastered)) list.push({ kind: 'level', key: L.replace('+', 'p'), level: L });
    });
    packs.forEach(p => {
      if (p.kind === 'open' && p.words.length >= 5 && p.words.every(w => srs[w.id]?.mastered)) list.push({ kind: 'pack', key: p.id.slice(0, 30), title: p.title });
    });
    return list;
  }, [profile.streak, duelWins, mainBank, packs, srs]);
  useEffect(() => {
    if (!realtimeEnabled || !syncReady || !profile.hasCompletedOnboarding || awardBusy.current || !awardCandidates.length) return;
    const done = new Set<string>(load<string[]>('lx_awards_v1', []));
    const nowT = Date.now();
    const next = awardCandidates.find(c => !done.has(`${c.kind}_${c.key}`) && nowT - (awardFail.current[`${c.kind}_${c.key}`] || 0) > 120000);
    if (!next) return;
    awardBusy.current = true;
    const k = `${next.kind}_${next.key}`;
    const t = setTimeout(async () => {
      try {
        lsSet('lx_certs_init_v1', '1');
        const r = await claimAward(myId.current, next.kind, next.key, { n: next.n, level: next.level, title: next.title, name: latest.current.profile.name });
        if (r.id || r.revoked) {
          done.add(k);
          save('lx_awards_v1', Array.from(done));
        } else awardFail.current[k] = Date.now();
      } catch {
        awardFail.current[k] = Date.now();
      } finally {
        awardBusy.current = false;
        setAwardTick(n => n + 1);
        if (awardFail.current[k]) setTimeout(() => setAwardTick(n => n + 1), 125000);
      }
    }, 4000);
    return () => {
      clearTimeout(t);
      awardBusy.current = false;
    };
  }, [awardCandidates, syncReady, profile.hasCompletedOnboarding, awardTick]);

  const newDuelCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const myPlayer = (): Record<string, unknown> => ({
    name: profile.name,
    avatar: shortAvatar,
    gain: 0,
    joinedAt: nowMs(),
    ts: nowMs(),
    base: { xp: profile.xp, words: savedWords.length, mastered: masteredCount },
  });

  const createDuel = async (o: { title: string; metric: DuelMetric; hours: number; maxPlayers: number }): Promise<string | null> => {
    if (!realtimeEnabled) return null;
    const code = newDuelCode();
    const t = nowMs();
    const okMeta = await put(`duels/${code}/meta`, {
      title: o.title.trim().slice(0, 40),
      metric: o.metric,
      createdBy: myId.current,
      createdAt: t,
      endsAt: t + Math.max(1, Math.min(24 * 30, o.hours)) * 3600000,
      maxPlayers: Math.max(2, Math.min(12, o.maxPlayers)),
    });
    if (!okMeta) return null;
    if (!(await put(`duels/${code}/players/${myId.current}`, myPlayer()))) return null;
    setDuelCodes(c => (c.includes(code) ? c : [...c, code]));
    triggerHaptic('success');
    return code;
  };

  const joinDuel = async (raw: string): Promise<{ ok: boolean; error?: string }> => {
    const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) return { ok: false, error: 'Kod noto‘g‘ri' };
    if (!realtimeEnabled) return { ok: false, error: 'Bellashuv uchun internet va baza kerak' };
    try {
      const d = await getJson(`duels/${code}`);
      if (!d?.meta) return { ok: false, error: 'Bunday bellashuv topilmadi' };
      const players = Object.keys(d.players || {});
      const already = players.includes(myId.current);
      if (!already) {
        if (nowMs() >= Number(d.meta.endsAt)) return { ok: false, error: 'Bu bellashuv tugagan' };
        if (players.length >= Number(d.meta.maxPlayers || 2)) return { ok: false, error: 'Bellashuvda joy qolmagan' };
        if (!(await put(`duels/${code}/players/${myId.current}`, myPlayer()))) return { ok: false, error: 'Qo‘shilib bo‘lmadi, qayta urinib ko‘ring' };
      }
      setDuelCodes(c => (c.includes(code) ? c : [...c, code]));
      setHiddenDuels(h => h.filter(x => x !== code));
      triggerHaptic('success');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Aloqa xatosi' };
    }
  };
  const leaveDuel = (code: string) => setHiddenDuels(h => (h.includes(code) ? h : [...h, code]));

  // ---------- chellenj / marafonlar (admin paneldan yaratiladi) ----------
  const [challengesRaw, setChallengesRaw] = useState<Record<string, any>>({});
  const [challengesLive, setChallengesLive] = useState(false);
  useEffect(() => {
    if (!realtimeEnabled) return;
    return subscribe('challenges', v => setChallengesRaw(v || {}), setChallengesLive);
  }, []);

  // Mavzuli chellenj: to'plamdagi so'zlar bo'yicha ball (o'rganilgan so'z — 1 ball, yodlangan so'z — yana +1 ball)
  const packScore = (packId: string): number => {
    const p = packs.find(x => x.id === packId);
    if (!p) return 0;
    return p.words.reduce((n, w) => n + (srs[w.id] || learnedEn.has(w.en.toLowerCase()) ? 1 : 0) + (srs[w.id]?.mastered ? 1 : 0), 0);
  };

  const challenges: Challenge[] = Object.entries(challengesRaw)
    .filter(([, c]: [string, any]) => c?.meta && c.meta.published !== false)
    .map(([id, c]: [string, any]) => {
      const m = c.meta;
      const kind = (['themed', 'survival'].includes(m.kind) ? m.kind : 'metric') as Challenge['kind'];
      const metric = (['xp', 'words', 'mastered'].includes(m.metric) ? m.metric : 'xp') as DuelMetric;
      const endsAt = Number(m.endsAt) || 0;
      const ended = nowMs() >= endsAt;
      const pack = kind === 'themed' ? packs.find(x => x.id === m.packId) : undefined;
      const players: DuelPlayer[] = Object.entries(c.players || {})
        .filter(([, p]) => p)
        .map(([uid, p]: [string, any]) => {
          const base = { xp: Number(p.base?.xp) || 0, words: Number(p.base?.words) || 0, mastered: Number(p.base?.mastered) || 0, pack: Number(p.base?.pack) || 0 };
          const stored = Math.max(0, Number(p.gain) || 0);
          let lv: number | null = null;
          if (!ended) {
            if (kind === 'metric') {
              const v = liveValue(uid, metric);
              lv = v === null ? null : Math.max(0, v - base[metric]);
            } else if (kind === 'themed' && uid === myId.current) lv = Math.max(0, packScore(m.packId) - base.pack);
          }
          return {
            id: uid,
            name: uid === myId.current ? profile.name : String(p.name || leagueRaw?.[uid]?.name || "O'quvchi"),
            avatar: uid === myId.current ? shortAvatar || String(p.avatar || '') : String(p.avatar || leagueRaw?.[uid]?.avatar || ''),
            gain: Math.max(stored, lv === null ? 0 : lv),
            joinedAt: Number(p.joinedAt) || 0,
            ts: Number(p.ts) || 0,
            base,
            started: Number(p.started) || 0,
            done: !!p.done,
          };
        })
        .sort((a, b) => b.gain - a.gain || a.ts - b.ts);
      const me = players.find(p => p.id === myId.current);
      return {
        id,
        title: String(m.title || 'Chellenj'),
        desc: String(m.desc || ''),
        kind,
        packId: String(m.packId || ''),
        packTitle: pack?.title || '',
        packTotal: pack?.words.length || 0,
        lives: Math.max(1, Number(m.lives) || 3),
        secs: Math.max(5, Number(m.secs) || 30),
        myStarted: !!me?.started,
        myDone: !!me?.done,
        metric,
        startsAt: Number(m.startsAt) || 0,
        endsAt,
        goal: Number(m.goal) || 0,
        prize: String(m.prize || ''),
        finalized: !!m.finalized,
        players,
        joined: !!me,
        myGain: me?.gain || 0,
      } as Challenge;
    })
    .sort((a, b) => b.startsAt - a.startsAt);

  // Qatnashayotgan chellenjlarda o'z natijamni bazaga yozaman (faqat o'sib boradi). Marafon natijasi o'yinning o'zida yoziladi.
  useEffect(() => {
    if (!realtimeEnabled || !syncReady || !profile.hasCompletedOnboarding) return;
    const t = setTimeout(() => {
      const me = myId.current;
      Object.entries(challengesRaw).forEach(([id, c]: [string, any]) => {
        const m = c?.meta;
        const mine = c?.players?.[me];
        const t0 = nowMs();
        if (!m || !mine || m.finalized || m.kind === 'survival' || t0 < Number(m.startsAt) || t0 >= Number(m.endsAt)) return;
        let gain: number;
        if (m.kind === 'themed') gain = Math.max(0, packScore(String(m.packId || '')) - (Number(mine.base?.pack) || 0));
        else {
          const metric = (['xp', 'words', 'mastered'].includes(m.metric) ? m.metric : 'xp') as DuelMetric;
          gain = Math.max(0, duelMetricValue(metric) - (Number(mine.base?.[metric]) || 0));
        }
        if (gain > (Number(mine.gain) || 0) || mine.name !== profile.name) {
          patch(`challenges/${id}/players/${me}`, { gain: Math.max(gain, Number(mine.gain) || 0), ts: nowMs(), name: profile.name, avatar: shortAvatar });
        }
      });
    }, 8000);
    return () => clearTimeout(t);
  }, [profile.xp, savedWords.length, masteredCount, profile.name, shortAvatar, challengesRaw, syncReady, now, srs, packs]);

  const joinChallenge = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const c = challengesRaw[id];
    if (!c?.meta) return { ok: false, error: 'Chellenj topilmadi' };
    if (c.meta.finalized || nowMs() >= Number(c.meta.endsAt)) return { ok: false, error: 'Chellenj tugagan' };
    if (c.players?.[myId.current]) return { ok: true };
    const me = myPlayer();
    if (c.meta.kind === 'themed') (me.base as any).pack = packScore(String(c.meta.packId || ''));
    // So'rov vaqt chegarasiga ega (qotib qolmaydi); ulanish yo'q bo'lsa 2 marta qayta uriniladi
    let ok = await put(`challenges/${id}/players/${myId.current}`, me);
    if (!ok) ok = await put(`challenges/${id}/players/${myId.current}`, me);
    if (!ok) return { ok: false, error: 'Qo‘shilib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring' };
    // Jonli oqim kechiksa ham, ekranda darhol "Siz qatnashyapsiz" ko'rinishi uchun mahalliy holatni yangilaymiz
    setChallengesRaw(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), players: { ...((prev[id] || {}).players || {}), [myId.current]: me } },
    }));
    triggerHaptic('success');
    // Boshqa ishtirokchilar ro'yxatini ham yangilab olamiz
    getJson(`challenges/${id}`)
      .then(v => {
        if (v && v.meta) setChallengesRaw(prev => ({ ...prev, [id]: { ...v, players: { ...(v.players || {}), [myId.current]: (v.players || {})[myId.current] || me } } }));
      })
      .catch(() => {});
    return { ok: true };
  };

  // Marafon (3 jon): har bir foydalanuvchiga FAQAT 1 ta urinish. Boshlashdan oldin bazadagi eng yangi holat tekshiriladi.
  const openSurvival = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const c = challengesRaw[id];
    if (!c?.meta || c.meta.kind !== 'survival') return { ok: false, error: 'Marafon topilmadi' };
    const t0 = nowMs();
    if (c.meta.finalized || t0 >= Number(c.meta.endsAt)) return { ok: false, error: 'Marafon tugagan' };
    if (t0 < Number(c.meta.startsAt)) return { ok: false, error: 'Marafon hali boshlanmagan' };
    const fresh = await getJson(`challenges/${id}/players/${myId.current}`).catch(() => null);
    if (fresh && fresh.started) return { ok: false, error: 'Siz bu marafonda allaqachon urindingiz. Har kimga faqat 1 ta imkoniyat beriladi.' };
    const base = { name: profile.name, avatar: shortAvatar, gain: 0, started: nowMs(), done: false, ts: nowMs() };
    const ok = await patch(`challenges/${id}/players/${myId.current}`, fresh ? base : { ...base, joinedAt: nowMs(), base: { xp: profile.xp, words: savedWords.length, mastered: masteredCount } });
    if (!ok) return { ok: false, error: 'Boshlab bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring' };
    setChallengesRaw(prev => ({ ...prev, [id]: { ...(prev[id] || {}), players: { ...((prev[id] || {}).players || {}), [myId.current]: { ...(((prev[id] || {}).players || {})[myId.current] || {}), ...base } } } }));
    try { sessionStorage.setItem('vb_liga_sub', 'challenge'); } catch { /* ignore */ }
    setOverlay({ type: 'survival', id });
    return { ok: true };
  };
  const saveSurvival = (id: string, score: number, done: boolean, keepalive = false) => {
    const data = { gain: Math.max(0, Math.round(score)), done, ts: nowMs() };
    patch(`challenges/${id}/players/${myId.current}`, data, keepalive);
    setChallengesRaw(prev => ({ ...prev, [id]: { ...(prev[id] || {}), players: { ...((prev[id] || {}).players || {}), [myId.current]: { ...(((prev[id] || {}).players || {})[myId.current] || {}), ...data } } } }));
  };

  // Taklif havolasi: Telegram `startapp=duel_KOD` yoki `?duel=KOD`
  useEffect(() => {
    try {
      const sp = getStartParam();
      const q = new URLSearchParams(window.location.search).get('duel');
      const code = sp && sp.startsWith('duel_') ? sp.slice(5) : q || '';
      if (code && /^[A-Za-z0-9]{4,12}$/.test(code)) {
        setPendingDuelCode(code.toUpperCase());
        setActiveTabRaw('leaderboard');
        if (q) window.history.replaceState(null, '', window.location.pathname);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ---------- profil ----------
  const updateProfile = (updates: Partial<UserProfile>) => setProfile(p => ({ ...p, ...updates, updatedAt: nowMs() }));
  const finishOnboarding = (level: EnglishLevel, perDay: number) => {
    triggerHaptic('success');
    sfx.win(false);
    updateProfile({
      level,
      wordsPerDay: perDay,
      dailyGoalMinutes: Math.round(6 + perDay * 0.7),
      hasCompletedOnboarding: true,
      joinedAt: profile.joinedAt || todayKey(),
    });
  };

  const aiUsed = profile.aiUsage && profile.aiUsage.day === today ? profile.aiUsage.count : 0;
  const aiLeft = Math.max(0, AI_DAILY_LIMIT - aiUsed);
  const consumeAi = (): boolean => {
    if (aiLeft <= 0) return false;
    setProfile(p => ({ ...p, aiUsage: { day: todayKey(), count: (p.aiUsage && p.aiUsage.day === todayKey() ? p.aiUsage.count : 0) + 1 } }));
    return true;
  };
  const blitzUsed = profile.blitzUsage && profile.blitzUsage.day === today ? profile.blitzUsage.count : 0;
  const blitzLeft = Math.max(0, BLITZ_DAILY_LIMIT - blitzUsed);
  const consumeBlitz = (): boolean => {
    if (blitzLeft <= 0) return false;
    setProfile(p => ({ ...p, blitzUsage: { day: todayKey(), count: (p.blitzUsage && p.blitzUsage.day === todayKey() ? p.blitzUsage.count : 0) + 1 } }));
    return true;
  };
  const markWritingDone = (): boolean => {
    const days = (profile.writingDays || []).filter(d => d.startsWith(today));
    if (days.length >= 3) return false;
    setProfile(p => ({ ...p, writingDays: [...(p.writingDays || []).filter(d => d.startsWith(todayKey())), `${todayKey()}#${nowMs()}`] }));
    return true;
  };

  const claimQuest = (questId: string) => {
    const quest = dailyQuests.find(q => q.id === questId);
    if (!quest || !quest.completed || quest.claimed) return;
    triggerHaptic('success');
    sfx.win(false);
    addXp(quest.xpReward);
    if (dailyQuests.every(q => q.id === questId || q.claimed)) earnCoins(shopConf.allQuests, `q:${todayKey()}`); // «Hammasini bajar» bonusi
    setQuestState(prev => ({ ...prev, quests: prev.quests.map(q => (q.id === questId ? { ...q, claimed: true } : q)) }));
  };

  const resetProgress = () => {
    triggerHaptic('warning');
    ['profile', 'srs', 'badges', 'wheel', 'quests', 'certs', 'games_played', 'referred', 'grants', 'certs_seen', 'certs_init', 'reg', 'duels'].forEach(k =>
      lsDel(`lx_${k}_v1`)
    );
    // Yangi "davr" (epoch): boshqa qurilmalar eski ma'lumotni qaytarib yubora olmaydi, ular ham tozalanadi
    oldSrsKey.current = srsKey(epoch);
    setEpoch(Math.max(nowMs(), epoch + 1));
    const selfLb = leagueRaw?.[myId.current];
    setProfile({ ...freshProfile(), adjV: Number(selfLb?.adjV) || 0, adjApplied: Number(selfLb?.adj) || 0, updatedAt: nowMs() });
    // Liga ham darhol nolga tushadi (ro'yxatdan o'tish tugamaguncha eski natija ko'rinib turmasin)
    patch(`leaderboard/${myId.current}`, { xp: 0, xpOffset: 0, streak: 0, learned: 0, mastered: 0, ts: nowMs() });
    setSrs({});
    setBadges(INITIAL_BADGES);
    setWheel(INITIAL_WHEEL);
    setQuestState({ date: '', quests: [] });
    setLocalCerts([]);
    setGamesPlayed(0);
    setGrantsDone([]);
    setDuelCodes([]);
    setHiddenDuels([]);
    lastSrs.current = {};
    setOverlay(null);
    setNavHistory([]);
    setActiveTabRaw('home');
  };

  return (
    <AppContext.Provider
      value={{
        profile, bank, bankFromCloud, srs, savedWords, masteredCount, dueWords, newQueue, introducedToday,
        dailyQuests, badges, games, settings, activeTab, setActiveTab, overlay, openLearn, openGame, closeOverlay,
        goBack, canGoBack, packs, todayPacks, packProgress, customPacks, saveCustomPack, deleteCustomPack, duels, createDuel, joinDuel, leaveDuel, pendingDuelCode, clearPendingDuel: () => setPendingDuelCode(''), duelMetricValue, challenges, joinChallenge, openSurvival, saveSurvival, allWords: mainBank, introduceWord, reviewWord, addWord, isWordSaved, markWordReviewed, claimDailyBonus, completeGame, updateProfile, finishOnboarding,
        resetProgress, claimQuest, wheel: w, wheelPrizes: wheelCfg.prizes, wheelFreeSpins: wheelCfg.freeSpins,
        freeSpinsLeft, totalSpinsLeft, isPro, spinWheel, applyPrize, grantReferralSpin, coins, catalog, shopConf, buyItem, equip, owns, boostActive, inviteLink, refCount, refLeague, refInfo, leagueUsers, leagueLive, challengesLive,
        realtimeOn: realtimeEnabled, announcement, leagueWeek, certificates, certificateView, showCertificate: setCertificateView,
        notice, streakPopup, dismissStreakPopup, addXp, aiLeft, consumeAi, blitzLeft, consumeBlitz, markWritingDone, today, syncReady, accountId: myId.current, isTelegram, linkAccount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
