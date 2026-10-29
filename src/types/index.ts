export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2+';
export type DailyGoalMinutes = number;
export type Track = 'comm' | 'ielts' | 'both';
export type WordTrack = 'comm' | 'ielts' | 'acad';

/** Admin paneldan kiritiladigan so'z (bazadagi `words/` yozuvi) */
export interface BankWord {
  id: string;
  en: string;
  uz: string;
  ipa: string;
  pos: string;
  ex: string;
  exUz: string;
  col: string[];
  fam: string[];
  hook: string; // eslab qolish kaliti
  track: WordTrack;
  topic: string;
  level: EnglishLevel;
  order: number;
}

/** Foydalanuvchining shu so'z bo'yicha takrorlash holati (faqat qurilmada saqlanadi) */
export interface SrsEntry {
  box: number; // 0..5
  due: string; // YYYY-MM-DD — qachon takrorlanadi
  intro: string; // birinchi o'rganilgan kun
  seen: number;
  ok: number;
  days: string[]; // to'g'ri javob berilgan turli kunlar
  mastered: boolean;
  xpDay?: string; // oxirgi XP berilgan kun (kuniga bir marta)
  srsFactor?: number; // dinamik moslashuvchan SM-2 faktori
}

/** Eski komponentlar (Learning.tsx) bilan mos "o'rganilgan so'z" ko'rinishi */
export interface SavedWord {
  id: string;
  word: string;
  ipa: string;
  uzbek: string;
  partOfSpeech: string;
  definitionUz?: string;
  contextSentence?: string;
  contextUz?: string;
  level: EnglishLevel;
  dateAdded: string;
  reviewCount: number;
  mastered: boolean;
}

export interface DailyQuest {
  id: string;
  title: string;
  titleUz: string;
  target: number;
  current: number;
  xpReward: number;
  completed: boolean;
  type: 'learn_words' | 'review_words' | 'play_game' | 'spin_wheel' | 'master_words' | 'perfect_round';
  claimed?: boolean;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  level: EnglishLevel;
  isCurrentUser?: boolean;
  coins?: number;
  refCount?: number;
  crown?: boolean;
  glowingNick?: boolean;
  vipCheck?: boolean;
  titleBadge?: string;
  frame?: string;
}

export interface AchievementBadge {
  id: string;
  title: string;
  titleUz: string;
  descriptionUz: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export type TabId = 'home' | 'words' | 'shop' | 'games' | 'leaderboard';

export interface Certificate {
  id: string; // VB-000001
  tpl: string; // andoza (bronze | silver | gold | platinum | champion | active | marathon | thanks)
  title: string; // Sarlavha («Yutuq yoki natija» qatori) — admin kiritadi
  badgeText?: string; // nishon matni (masalan: "1-HAFTA CHEMPIONI")
  reason?: string; // Izoh — admin kiritadi
  verified?: boolean; // serverda ro'yxatdan o'tgan (QR orqali tekshiriladi)
  name: string;
  date: string; // YYYY-MM-DD
  special: boolean; // admin yuborgan
  delivered?: boolean; // admin paneldan Telegram chatiga allaqachon yuborilgan
  fmt?: 'wide' | 'story'; // 'wide' = 16:9 (albom), 'story' = 9:16 (Telegram Stories uchun tik)
  stats?: { lvl?: string; words?: number; streak?: number }; // sertifikat pastidagi muhrlar (daraja, so'zlar, streak)
}

export interface UserProfile {
  id: string;
  name: string;
  username?: string;
  avatar: string;
  level: EnglishLevel;
  track: Track;
  wordsPerDay: number; // kuniga nechta yangi so'z (5 / 10 / 15 / 20)
  dailyGoalMinutes: DailyGoalMinutes;
  xp: number;
  coins: number; // tangalar balansi (do'konda ishlatiladi)
  streak: number;
  lastReadDate?: string;
  reminderTime: string;
  hasCompletedOnboarding: boolean;
  soundEnabled: boolean;
  fontSize: 'sm' | 'base' | 'lg' | 'xl';
  fontFamily: 'sans' | 'serif';
  bonusDays: string[]; // kunlik mashq bonusi (10 XP) olingan kunlar
  gameXp: Record<string, string>; // o'yin -> oxirgi XP olingan kun
  milestones: number[]; // olingan sertifikat bosqichlari (250/500/750/1000)
  customName?: boolean;
  customAvatar?: boolean;
  aiUsage?: { day: string; count: number };
  blitzUsage?: { day: string; count: number }; // Blitz Duel: kuniga nechta o'ynalgani
  writingDays?: string[];
  joinedAt?: string; // ilovaga birinchi kirgan kun (YYYY-MM-DD)
  sentCerts?: string[]; // botga allaqachon yuborilgan sertifikatlar
  botRemind?: boolean; // bot orqali kunlik eslatma (standart: yoqilgan)
  xpSets?: string[]; // (eski) admin XP o'rnatgan bir martalik amallar ID lari
  adjV?: number; // admin XP tuzatishining qo'llangan versiyasi (Liga yozuvidagi `adjV` bilan solishtiriladi)
  adjApplied?: number; // admin tuzatishlarining shu hisobga qo'llangan umumiy yig'indisi
  updatedAt?: number; // sozlamalar (ism, daraja, ...) oxirgi o'zgargan vaqt — qurilmalar o'rtasida birlashtirish uchun
  customPacks?: CustomWordPack[]; // Foydalanuvchining shaxsiy lug'at to'plamlari
  // --- Do'stlarni taklif qilish (Referral) va Do'kon tizimi ---
  refCount?: number; // taklif qilingan do'stlar soni
  refXpEarned?: number; // referallar orqali ishlangan jami XP
  refCoinsEarned?: number; // referallar orqali ishlangan jami tangalar
  inventory?: string[]; // sotib olingan mahsulotlar identifikatorlari
  activeFrame?: string; // joriy tanlangan avatar ramkasi (gold | fire | crystal | neon | diamond | laurel)
  activeTitle?: string; // joriy profil unvoni ("So'z ustasi", "Kitobxon", "Titan", h.k.)
  activeTheme?: string; // joriy tanlangan tema ('dark' | 'indigo' | 'neon' | 'emerald')
  hasCrown?: boolean; // avatar ustida toj
  hasGlowingNick?: boolean; // reytingda yaltiroq/gradient ism
  hasVipCheck?: boolean; // ko'k tasdiqlangan belgi (galochka)
  hasLofiMusic?: boolean; // Lo-Fi musiqa pleyeri xarid qilingan / doimiy ochiq
  doubleXpUntil?: number; // 2x XP tugash vaqti (ms)
}

export type ShopCategory = 'all' | 'boosters' | 'cosmetics' | 'titles_themes' | 'learning' | 'special';
export type ShopItemType = 'consumable' | 'permanent' | 'duration';

export interface ShopItem {
  id: string;
  title: string;
  description: string;
  category: ShopCategory;
  priceCoins: number;
  priceXp?: number;
  discountPct?: number; // 0 - 90
  itemType: ShopItemType;
  durationHours?: number;
  stockLimit?: number | null;
  isActive: boolean;
  image?: string;
  icon?: string;
  badge?: string;
  neonColor?: string; // Neon kartochka va ramkaning RGB/HEX rangi
  sortOrder?: number; // Ilovada do'konda ko'rinish tartibi
}

export interface TopBook {
  id: string;
  title: string;
  author: string;
  level: string;
  desc: string;
  coverImage: string;
  downloadUrl?: string;
  readUrl?: string;
  content?: string;
}

export interface LofiTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  duration?: string;
}

export interface ReferralConfig {
  rewardXp: number;
  rewardCoins: number;
  inviteText: string;
}

export interface WheelState {
  dayKey: string;
  spinsUsed: number;
  bonusSpins: number;
  grantSpins: number; // admin sovg'a qilgan aylantirishlar (muddati bo'lishi mumkin)
  grantSpinsUntil: number; // 0 — muddatsiz; aks holda shu vaqtgacha amal qiladi
  referralDayKey: string;
  doubleXpPending: boolean;
  lockedUntil: number;
  proUntil: number;
  streakSavers: number;
  totalSpins: number;
}

/** Raqib bilan bellashuv */
export type DuelMetric = 'xp' | 'words' | 'mastered';

export interface DuelPlayer {
  id: string;
  name: string;
  avatar: string;
  gain: number; // bellashuv boshlanganidan beri to'plangan natija
  joinedAt: number;
  ts: number;
  base: { xp: number; words: number; mastered: number; pack?: number };
  started?: number; // Marafon (3 jon): urinish boshlangan vaqt (har kimga faqat 1 ta urinish)
  done?: boolean; // Marafon: urinish tugagan
}

export interface Duel {
  code: string;
  title: string;
  metric: DuelMetric;
  createdBy: string;
  createdAt: number;
  endsAt: number;
  maxPlayers: number;
  players: DuelPlayer[]; // natija bo'yicha saralangan
}

/** Admin yuklagan yoki foydalanuvchi yaratgan lug'at to'plami ("Bugungi mashqlar") */
export interface WordPack {
  id: string;
  title: string;
  desc: string;
  kind: 'daily' | 'open'; // daily — aniq kun uchun; open — istalgan vaqtda o'rganiladi
  date: string; // YYYY-MM-DD (faqat daily uchun)
  mode: 'replace' | 'extra'; // daily: odatdagi kunlik so'zlar o'rniga yoki ustiga
  order: number;
  words: BankWord[];
  isCustom?: boolean; // foydalanuvchi tomonidan yaratilgan
}

export interface CustomWordPack {
  id: string;
  title: string;
  desc?: string;
  createdAt: number;
  updatedAt: number;
  words: BankWord[];
}

export type ChallengeKind = 'metric' | 'themed' | 'survival';

/** Admin o'tkazadigan chellenj / marafon */
export interface Challenge {
  id: string;
  title: string;
  desc: string;
  kind: ChallengeKind; // metric — XP/so'z; themed — mavzuli to'plam; survival — Marafon (3 jon)
  packId: string; // themed: lug'at to'plami ID si
  packTitle: string;
  packTotal: number;
  lives: number; // survival: jonlar soni
  secs: number; // survival: bitta savolga beriladigan soniya
  myStarted: boolean;
  myDone: boolean;
  metric: DuelMetric;
  startsAt: number;
  endsAt: number;
  goal: number; // 0 — maqsad yo'q (faqat reyting)
  prize: string;
  finalized: boolean;
  players: DuelPlayer[]; // natija bo'yicha saralangan
  joined: boolean;
  myGain: number;
}
