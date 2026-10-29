// Qurilmalar (telefon / noutbuk) o'rtasida ma'lumotlarni BIRLASHTIRISH.
//
// Eski usulda "oxirgi yozgan qurilma hammasini ustiga yozar" edi: soati orqada qolgan yoki ekrani eski holatda
// ochilib qolgan qurilma yangi ma'lumotni (masalan, aylantirilgan barabanni) o'chirib yuborishi mumkin edi.
// Endi har bir maydon o'z qoidasi bilan birlashtiriladi va hech qachon ortga qaytmaydi:
//   XP, streak, aylantirishlar soni, missiya natijalari — kattasi yutadi;
//   o'rganilgan so'zlar, sertifikatlar, yutuqlar, olingan sovg'alar — birlashtiriladi (union);
//   ism, daraja, rasm kabi sozlamalar — oxirgi o'zgartirilgani yutadi (updatedAt).
import { AchievementBadge, Certificate, DailyQuest, SrsEntry, UserProfile, WheelState } from '../types';
import { MASTER_DAYS } from './srs';

export interface QuestState {
  date: string;
  quests: DailyQuest[];
}

export interface CoreState {
  profile: UserProfile;
  wheel: WheelState;
  questState: QuestState;
  localCerts: Certificate[];
  badges: AchievementBadge[];
  gamesPlayed: number;
  grantsDone: string[];
  duels: string[];
  hiddenDuels: string[]; // ro'yxatdan olib tashlangan (tugagan) bellashuvlar
  epoch: number; // "Progressni tiklash" bosilganda oshadi — eski ma'lumotlar qaytib kelmasligi uchun
}

export interface CloudCore extends CoreState {
  dev: string;
  ts: number;
  rev: number;
}

const uniqSorted = (a: (string | number)[]): any[] => Array.from(new Set(a)).sort();
const arr = (v: any): any[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

/** Kalitlari tartiblangan JSON (taqqoslash uchun) */
export function stable(v: any): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return (
    '{' +
    Object.keys(v)
      .filter(k => v[k] !== undefined)
      .sort()
      .map(k => JSON.stringify(k) + ':' + stable(v[k]))
      .join(',') +
    '}'
  );
}

// ---------- profil ----------
export function mergeProfile(a: UserProfile, b: UserProfile): UserProfile {
  // sozlamalar: oxirgi o'zgartirilgan yutadi. Teng bo'lsa — barcha qurilmalarda bir xil natija beradigan qoida
  // (aks holda ikki qurilma bir-birining qiymatini cheksiz almashtirib turardi)
  const ua0 = a.updatedAt || 0;
  const ub0 = b.updatedAt || 0;
  const bWins = ua0 !== ub0 ? ub0 > ua0 : stable(b) > stable(a);
  const base = bWins ? b : a;
  const other = bWins ? a : b;
  const out: UserProfile = { ...other, ...base };

  out.avatar = base.avatar || other.avatar;
  // XP: odatda kattasi. Lekin admin XP ni o'zgartirgan (xpSets) bo'lsa — o'sha o'zgartirishni ko'proq qo'llagan tomon yutadi
  const sa = arr(a.xpSets).length;
  const sb = arr(b.xpSets).length;
  const va = a.adjV || 0;
  const vb = b.adjV || 0;
  if (va !== vb) {
    // Admin XP tuzatishini ko'proq qo'llagan tomon yutadi (shunda tuzatish boshqa qurilma tomonidan bekor qilinmaydi)
    const w = va > vb ? a : b;
    out.xp = w.xp || 0;
    out.adjV = w.adjV;
    out.adjApplied = w.adjApplied;
  } else {
    out.xp = sa !== sb ? (sa > sb ? a.xp : b.xp) || 0 : Math.max(a.xp || 0, b.xp || 0);
    out.adjV = a.adjV || b.adjV;
    out.adjApplied = a.adjApplied ?? b.adjApplied;
  }
  out.xpSets = uniqSorted([...arr(a.xpSets), ...arr(b.xpSets)]).slice(-30);
  out.hasCompletedOnboarding = !!(a.hasCompletedOnboarding || b.hasCompletedOnboarding);
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0) || undefined;

  // streak: oxirgi faol kuni kattasi; teng bo'lsa — kattasi
  const la = a.lastReadDate || '';
  const lb = b.lastReadDate || '';
  if (la !== lb) {
    const w = la > lb ? a : b;
    out.lastReadDate = w.lastReadDate;
    out.streak = w.streak;
  } else {
    out.lastReadDate = a.lastReadDate || b.lastReadDate;
    out.streak = Math.max(a.streak || 0, b.streak || 0);
  }

  out.bonusDays = uniqSorted([...arr(a.bonusDays), ...arr(b.bonusDays)]).slice(-40);
  out.milestones = uniqSorted([...arr(a.milestones), ...arr(b.milestones)].map(Number));
  out.sentCerts = uniqSorted([...arr(a.sentCerts), ...arr(b.sentCerts)]).slice(-60);
  out.writingDays = uniqSorted([...arr(a.writingDays), ...arr(b.writingDays)]).slice(-12);

  const gx: Record<string, string> = { ...(a.gameXp || {}) };
  Object.entries(b.gameXp || {}).forEach(([k, v]) => {
    if (!gx[k] || String(v) > gx[k]) gx[k] = String(v);
  });
  out.gameXp = gx;

  const ua = a.aiUsage;
  const ub = b.aiUsage;
  if (ua && ub) out.aiUsage = ua.day !== ub.day ? (ua.day > ub.day ? ua : ub) : { day: ua.day, count: Math.max(ua.count, ub.count) };
  else out.aiUsage = ua || ub;
  const ba = a.blitzUsage;
  const bb = b.blitzUsage;
  if (ba && bb) out.blitzUsage = ba.day !== bb.day ? (ba.day > bb.day ? ba : bb) : { day: ba.day, count: Math.max(ba.count, bb.count) };
  else out.blitzUsage = ba || bb;

  // ---- tanga va do'kon: hech qachon kamaymaydi / yo'qolmaydi ----
  out.coinsEarned = Math.max(a.coinsEarned || 0, b.coinsEarned || 0) || undefined;
  out.coinsSpent = Math.max(a.coinsSpent || 0, b.coinsSpent || 0) || undefined;
  out.coinInit = !!(a.coinInit || b.coinInit) || undefined;
  out.coinDays = uniqSorted([...arr(a.coinDays), ...arr(b.coinDays)]).slice(-30);
  out.own = uniqSorted([...arr(a.own), ...arr(b.own)]);
  out.boostUntil = Math.max(a.boostUntil || 0, b.boostUntil || 0) || undefined;
  const bu: Record<string, { n: number; d: string; dn: number }> = { ...(a.buys || {}) };
  Object.entries(b.buys || {}).forEach(([k, v]) => {
    const o = bu[k];
    if (!o) bu[k] = v;
    else bu[k] = { n: Math.max(o.n || 0, v.n || 0), d: o.d >= v.d ? o.d : v.d, dn: o.d === v.d ? Math.max(o.dn || 0, v.dn || 0) : o.d > v.d ? o.dn : v.dn };
  });
  out.buys = bu;

  const ja = a.joinedAt || '';
  const jb = b.joinedAt || '';
  out.joinedAt = ja && jb ? (ja < jb ? ja : jb) : ja || jb || undefined;
  return out;
}

// ---------- so'zlar (SRS) ----------
export function mergeSrsEntry(a: SrsEntry, b: SrsEntry): SrsEntry {
  const pick = a.seen !== b.seen ? (a.seen > b.seen ? a : b) : a.box !== b.box ? (a.box > b.box ? a : b) : a.due >= b.due ? a : b;
  const days = uniqSorted([...arr(a.days), ...arr(b.days)]) as string[];
  const xpA = a.xpDay || '';
  const xpB = b.xpDay || '';
  const out: SrsEntry = {
    ...pick,
    days,
    intro: a.intro && b.intro ? (a.intro < b.intro ? a.intro : b.intro) : a.intro || b.intro,
    seen: Math.max(a.seen || 0, b.seen || 0),
    ok: Math.max(a.ok || 0, b.ok || 0),
    mastered: !!(a.mastered || b.mastered) || days.length >= MASTER_DAYS,
  };
  const xd = xpA > xpB ? xpA : xpB;
  if (xd) out.xpDay = xd;
  return out;
}

export function mergeSrs(a: Record<string, SrsEntry>, b: Record<string, SrsEntry>): Record<string, SrsEntry> {
  const out: Record<string, SrsEntry> = { ...a };
  Object.entries(b).forEach(([id, e]) => {
    out[id] = out[id] ? mergeSrsEntry(out[id], e) : e;
  });
  return out;
}

// ---------- baraban ----------
/** `bNewer` — b (bulutdagi) holat a (mahalliy) dan keyinroq yozilgan */
export function mergeWheel(a: WheelState, b: WheelState, bNewer: boolean): WheelState {
  let base: WheelState;
  if ((a.totalSpins || 0) !== (b.totalSpins || 0)) base = (a.totalSpins || 0) > (b.totalSpins || 0) ? a : b;
  else base = bNewer ? b : a;
  return {
    ...base,
    proUntil: Math.max(a.proUntil || 0, b.proUntil || 0),
    referralDayKey: (a.referralDayKey || '') > (b.referralDayKey || '') ? a.referralDayKey : b.referralDayKey,
    totalSpins: Math.max(a.totalSpins || 0, b.totalSpins || 0),
  };
}

// ---------- missiyalar ----------
export function mergeQuests(a: QuestState, b: QuestState): QuestState {
  if (a.date !== b.date) return a.date > b.date ? a : b;
  // Missiyalar ro'yxati — faqat bitta tomondan (hozirgi qurilmadagi, bo'sh bo'lsa bulutdagi) olinadi.
  // Ikkala tomonni birlashtirish admin almashtirgan eski missiyalarni qaytarib kelardi (yangi 3 + eski 3 = 6 ta bo'lib qolardi).
  // Faqat bir xil missiyalarning bajarilish holati (progress, olingan mukofot) birlashtiriladi.
  const main = a.quests.length ? a : b;
  const other = main === a ? b : a;
  const quests = main.quests.map(q => {
    const o = other.quests.find(x => x.id === q.id);
    if (!o) return q;
    const cur = Math.max(q.current, o.current);
    return { ...q, current: cur, completed: q.completed || o.completed || cur >= q.target, claimed: !!(q.claimed || o.claimed) };
  });
  return { date: main.date, quests };
}

// ---------- yutuqlar, sertifikatlar ----------
export function mergeBadges(a: AchievementBadge[], b: AchievementBadge[]): AchievementBadge[] {
  const out = new Map<string, AchievementBadge>();
  [...a, ...b].forEach(x => {
    const old = out.get(x.id);
    if (!old) return void out.set(x.id, x);
    const unlocked = old.unlocked || x.unlocked;
    const times = [old.unlockedAt, x.unlockedAt].filter(Boolean).sort() as string[];
    out.set(x.id, { ...old, unlocked, unlockedAt: unlocked ? times[0] : undefined });
  });
  return Array.from(out.values()).sort((p, q) => (p.id < q.id ? -1 : 1));
}

export function mergeCerts(a: Certificate[], b: Certificate[]): Certificate[] {
  const out = new Map<string, Certificate>();
  [...a, ...b].forEach(c => {
    if (c && c.id && !out.has(c.id)) out.set(c.id, c);
  });
  return Array.from(out.values()).sort((p, q) => (p.id < q.id ? -1 : 1));
}

/** Holatni yagona ko'rinishga keltiradi (tartib va dublikatlar) — taqqoslash va yozish uchun */
export function normalizeCore(c: CoreState): CoreState {
  return {
    ...c,
    profile: {
      ...c.profile,
      bonusDays: uniqSorted(arr(c.profile.bonusDays)).slice(-40),
      milestones: uniqSorted(arr(c.profile.milestones).map(Number)),
      sentCerts: uniqSorted(arr(c.profile.sentCerts)).slice(-60),
      writingDays: uniqSorted(arr(c.profile.writingDays)).slice(-12),
      xpSets: uniqSorted(arr(c.profile.xpSets)).slice(-30),
      coinDays: uniqSorted(arr(c.profile.coinDays)).slice(-30),
      own: uniqSorted(arr(c.profile.own)),
    },
    badges: [...c.badges].sort((p, q) => (p.id < q.id ? -1 : 1)),
    localCerts: mergeCerts(c.localCerts, []),
    grantsDone: uniqSorted(c.grantsDone),
    duels: uniqSorted(c.duels),
    hiddenDuels: uniqSorted(c.hiddenDuels || []),
  };
}

export const coreSig = (c: CoreState): string => stable(normalizeCore(c));
export const srsSig = (e: SrsEntry): string => stable({ ...e, days: uniqSorted(arr(e.days)) });

/**
 * Mahalliy va bulutdagi holatni birlashtiradi.
 * Agar "epoch" farq qilsa (progress tiklangan), epochi kattasi to'liq yutadi.
 */
export function mergeCore(local: CoreState, remote: CloudCore, localDirty = false): { core: CoreState; adoptRemoteOnly: boolean } {
  if (remote.epoch > local.epoch) return { core: normalizeCore(remote), adoptRemoteOnly: true };
  if (remote.epoch < local.epoch) return { core: normalizeCore(local), adoptRemoteOnly: false };
  const bNewer = !localDirty; // yuborilmagan mahalliy o'zgarish bo'lsa, u saqlanadi; aks holda bulutdagi (eng so'nggi) yutadi
  return {
    core: normalizeCore({
      profile: mergeProfile(local.profile, remote.profile),
      wheel: mergeWheel(local.wheel, remote.wheel, bNewer),
      questState: mergeQuests(local.questState, remote.questState),
      localCerts: mergeCerts(local.localCerts, remote.localCerts),
      badges: mergeBadges(local.badges, remote.badges),
      gamesPlayed: Math.max(local.gamesPlayed, remote.gamesPlayed),
      grantsDone: uniqSorted([...local.grantsDone, ...remote.grantsDone]),
      duels: uniqSorted([...local.duels, ...remote.duels]),
      hiddenDuels: uniqSorted([...(local.hiddenDuels || []), ...(remote.hiddenDuels || [])]),
      epoch: local.epoch,
    }),
    adoptRemoteOnly: false,
  };
}

/** Bulutdan kelgan xom ma'lumotni (Firebase massivlarni obyektga aylantiradi) tozalaydi */
export function parseRemoteCore(raw: any, initial: { profile: UserProfile; wheel: WheelState; badges: AchievementBadge[] }): CloudCore | null {
  if (!raw || typeof raw !== 'object') return null;
  const rp = raw.profile || {};
  const profile: UserProfile = {
    ...initial.profile,
    ...rp,
    bonusDays: arr(rp.bonusDays).map(String),
    milestones: arr(rp.milestones).map(Number),
    sentCerts: arr(rp.sentCerts).map(String),
    writingDays: arr(rp.writingDays).map(String),
    xpSets: arr(rp.xpSets).map(String),
    coinDays: arr(rp.coinDays).map(String),
    own: arr(rp.own).map(String),
    gameXp: rp.gameXp || {},
  };
  const badges = arr(raw.badges) as AchievementBadge[];
  return {
    profile,
    wheel: { ...initial.wheel, ...(raw.wheel || {}) },
    questState: { date: raw.questState?.date || '', quests: arr(raw.questState?.quests) as DailyQuest[] },
    localCerts: arr(raw.localCerts) as Certificate[],
    badges: badges.length ? badges : initial.badges,
    gamesPlayed: Number(raw.gamesPlayed) || 0,
    grantsDone: arr(raw.grantsDone).map(String),
    duels: arr(raw.duels).map(String),
    hiddenDuels: arr(raw.hiddenDuels).map(String),
    epoch: Number(raw.epoch) || 0,
    dev: String(raw.dev || ''),
    ts: Number(raw.ts) || 0,
    rev: Number(raw.rev) || 0,
  };
}

export function parseRemoteSrs(raw: any): Record<string, SrsEntry> {
  const out: Record<string, SrsEntry> = {};
  Object.entries(raw || {}).forEach(([id, e]: [string, any]) => {
    if (e && typeof e === 'object') out[id] = { ...e, days: arr(e.days).map(String) } as SrsEntry;
  });
  return out;
}
