import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Swords, X, Share2, Copy, Check, Crown, Timer, RotateCcw, ChevronRight, Zap, Users, Loader2, Handshake, Gem } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Avatar } from './Avatar';
import { triggerHaptic, shareUrl, getFriendDuelLink, readFriendDuelParam } from '../services/telegram';
import { sfx } from '../services/sound';
import {
  FD_QUESTIONS, FD_SECONDS, FD_COMBO_MAX, FD_MAX_PLAYERS, FdMe, FdQuestion, FdPlayer, FdRoom, FdResult, FdSettleUser,
  pointsFor, compareResults, seriesScore, roundOf, createRoom, joinRoom, startRound, submitResult, fetchRoom, useFriendRoom,
  getMyRooms, rememberRoom, forgetRoom, saveProgress, loadProgress, clearProgress, finalizeProgress,
  openFriendDuel, setFriendDuelCode, closeFriendDuel, useFriendDuelUi,
} from '../services/friendDuel';
import { openGlobalBlitz, rememberOpp, submitLive, cumulativeScores } from '../services/globalBlitz';
import type { GbLogItem, GbSettle } from '../services/globalBlitz';

/* =====================================================================
   Do'st bilan Blitz Duel — butun ilova bo'ylab bitta oyna (App'da bir marta ulanadi).
   Panel `keep-dark`: kun va tun rejimida ham bir xil to'q ko'rinadi, matn har doim o'qiladi.
   Shaffof oq qatlamlar `bg-white/[0.06]` ko'rinishida yoziladi (kun rejimi `bg-white/5|10` ni o'zgartirib yuboradi).
   ===================================================================== */

export const GLASS = 'bg-white/[0.06] border border-white/[0.12]';
export const fmtTime = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

const inviteText = (name: string) => `⚔️ ${name} seni VocaBoost'da ${FD_QUESTIONS} so'zlik Blitz Duelga chaqiryapti! Kim ko'proq so'z biladi? 🔥`;

/* ---------------------------- kichik bo'laklar ---------------------------- */

export const Person: React.FC<{ p?: FdPlayer | null; you?: boolean; tone: 'amber' | 'sky'; big?: boolean; waiting?: boolean }> = ({ p, you, tone, big, waiting }) => {
  const ring = tone === 'amber' ? 'ring-amber-400/80' : 'ring-sky-400/80';
  const size = big ? 'w-16 h-16' : 'w-12 h-12';
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0 w-24">
      {p ? (
        <Avatar src={p.avatar} name={p.name} className={`${size} ring-2 ${ring} ring-offset-2 ring-offset-[#121B2B]`} />
      ) : (
        <div className={`${size} rounded-full border-2 border-dashed border-white/30 flex items-center justify-center ${waiting ? 'animate-pulse' : ''}`}>
          <Users className="w-5 h-5 text-slate-400" />
        </div>
      )}
      <div className="text-xs font-bold text-white truncate max-w-full">{p ? (you ? 'Siz' : p.name) : 'Do‘st'}</div>
    </div>
  );
};

export const Vs: React.FC = () => (
  <div className="fd-vs shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 text-xs font-black flex items-center justify-center shadow-lg shadow-orange-500/30">VS</div>
);

export const Rules: React.FC = () => (
  <div className="grid grid-cols-3 gap-2 text-center">
    {[
      [`${FD_QUESTIONS}`, 'ta so‘z'],
      [`${FD_SECONDS} s`, 'har biriga'],
      ['1 xil', 'savollar'],
    ].map(([a, b]) => (
      <div key={b} className={`${GLASS} rounded-xl py-2`}>
        <div className="text-base font-black text-amber-300 leading-none">{a}</div>
        <div className="text-[10px] text-slate-300 mt-1">{b}</div>
      </div>
    ))}
  </div>
);

export const Primary: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...rest }) => (
  <button type="button" {...rest} className={`w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 ${className}`}>
    {children}
  </button>
);
export const Ghost: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...rest }) => (
  <button type="button" {...rest} className={`w-full h-11 rounded-2xl ${GLASS} text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-50 ${className}`}>
    {children}
  </button>
);

/* ------------------------------ o'yin (15 savol) ------------------------------ */

export interface PlayDone { s: number; c: number; t: number; wrong: FdQuestion[]; log: GbLogItem[] }
export interface PlayProgress { s: number; c: number; t: number; i: number; log: GbLogItem[] }

export const FdPlay: React.FC<{ qs: FdQuestion[]; onProgress: (p: PlayProgress) => void; onDone: (r: PlayDone) => void; ghost?: { name: string; log: GbLogItem[] } }> = ({ qs, onProgress, onDone, ghost }) => {
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(FD_SECONDS);
  const [selected, setSelected] = useState<string | null>(null);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [view, setView] = useState({ s: 0, combo: 1 });
  const lock = useRef(false);
  const acc = useRef({ s: 0, c: 0, t: 0, combo: 1, wrong: [] as FdQuestion[], log: [] as GbLogItem[] });
  const ghostScores = useMemo(() => (ghost ? cumulativeScores(ghost.log) : []), [ghost]);
  const t0 = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const next = useRef<ReturnType<typeof setTimeout> | null>(null);

  const answer = (choice: string | null) => {
    if (lock.current) return;
    lock.current = true;
    if (timer.current) clearInterval(timer.current);
    const q = qs[idx];
    // Vaqt butun millisekundga yaxlitlanadi va ball SHU qiymatdan hisoblanadi — server javoblardan aynan shu natijani qayta hisoblaydi
    let m = choice === null ? FD_SECONDS * 1000 : Math.max(0, Math.min(FD_SECONDS * 1000, Math.round(performance.now() - t0.current)));
    const ok = choice !== null && choice === q.u;
    if (ok && m < 400) m = 400; // 0,4 soniyadan tez to'g'ri javob inson uchun mumkin emas (serverda ham shunday)
    if (ok) {
      acc.current.s += pointsFor(FD_SECONDS - m / 1000, acc.current.combo);
      acc.current.c += 1;
      acc.current.combo = Math.min(FD_COMBO_MAX, Math.round((acc.current.combo + 0.3) * 10) / 10);
      sfx.correct();
      triggerHaptic('success');
    } else {
      acc.current.combo = 1;
      acc.current.wrong.push(q);
      sfx.wrong();
      triggerHaptic('warning');
    }
    acc.current.t += m;
    acc.current.log.push({ c: ok ? 1 : 0, m, a: choice });
    setSelected(choice ?? '__timeout__');
    setMarks(m => [...m, ok]);
    setView({ s: acc.current.s, combo: acc.current.combo });
    onProgress({ s: acc.current.s, c: acc.current.c, t: acc.current.t, i: idx + 1, log: acc.current.log.slice() });
    next.current = setTimeout(() => {
      if (idx + 1 < qs.length) {
        lock.current = false;
        setIdx(idx + 1);
      } else {
        onDone({ s: acc.current.s, c: acc.current.c, t: acc.current.t, wrong: acc.current.wrong, log: acc.current.log });
      }
    }, 700);
  };

  useEffect(() => {
    t0.current = performance.now();
    setRemaining(FD_SECONDS);
    setSelected(null);
    timer.current = setInterval(() => {
      const rem = Math.max(0, FD_SECONDS - (performance.now() - t0.current) / 1000);
      setRemaining(rem);
      if (rem <= 0) answer(null);
    }, 100);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => () => { if (next.current) clearTimeout(next.current); }, []);

  const q = qs[idx];
  const pct = (remaining / FD_SECONDS) * 100;
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-amber-300 flex items-center gap-1 tabular-nums"><Timer className="w-4 h-4" /> {remaining.toFixed(1)}s</span>
        <span className={`${GLASS} px-2 py-0.5 rounded-full text-slate-200 font-bold tabular-nums`}>{idx + 1} / {qs.length}</span>
        <span className="font-extrabold text-orange-400 tabular-nums">{view.s} ball{view.combo > 1 && <span className="ml-1 text-[10px] text-amber-300">{view.combo}x</span>}</span>
      </div>

      {ghost && (
        <div className={`${GLASS} rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px]`}>
          <span className="text-slate-300 truncate">Raqib: <b className="text-white">{ghost.name}</b></span>
          <span className="font-extrabold text-sky-300 tabular-nums">{marks.length ? ghostScores[marks.length - 1] ?? 0 : 0} ball</span>
        </div>
      )}

      <div className="flex gap-[3px]" aria-hidden>
        {qs.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < marks.length ? (marks[i] ? 'bg-emerald-400' : 'bg-rose-400') : i === idx ? 'bg-amber-400' : 'bg-white/[0.15]'}`} />
        ))}
      </div>

      <div className="h-2 rounded-full bg-white/[0.12] overflow-hidden">
        <div className={`h-full transition-[width] duration-100 ${remaining <= 1.5 ? 'bg-rose-500' : remaining <= 3 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>

      <div className={`${GLASS} rounded-2xl p-5 text-center`}>
        <div className="text-[10px] uppercase font-bold tracking-widest text-slate-300">Tarjimasini toping</div>
        <div key={idx} className="fd-rise mt-1 text-3xl font-black text-white tracking-tight break-words">{q.e}</div>
        {q.p && <div className="text-xs text-slate-300 mt-0.5">{q.p}</div>}
      </div>

      <div className="grid gap-2">
        {q.o.map((opt, i) => {
          let cls = `${GLASS} text-white`;
          if (selected !== null) {
            if (opt === q.u) cls = 'bg-emerald-500/25 border border-emerald-400 text-emerald-200 font-extrabold';
            else if (opt === selected) cls = 'bg-rose-500/25 border border-rose-400 text-rose-200';
            else cls = 'border border-white/[0.06] text-slate-400 opacity-50';
          }
          return (
            <button key={`${idx}-${i}`} type="button" data-nosfx disabled={selected !== null} onClick={() => answer(opt)} className={`p-3.5 rounded-2xl text-sm font-semibold text-left transition-all active:scale-[0.98] ${cls}`}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const Countdown: React.FC<{ onEnd: () => void }> = ({ onEnd }) => {
  const [n, setN] = useState(3);
  useEffect(() => {
    sfx.click(true);
    triggerHaptic('medium');
    const id = setTimeout(() => (n > 1 ? setN(n - 1) : onEnd()), 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  return (
    <div className="py-10 text-center">
      <div className="text-xs font-bold uppercase tracking-widest text-slate-300">Tayyor turing</div>
      <div key={n} className="fd-count mt-2 text-8xl font-black text-amber-300 tabular-nums drop-shadow-[0_0_24px_rgba(251,191,36,0.55)]">{n}</div>
    </div>
  );
};

/* ------------------------------ natija ekrani ------------------------------ */

export const ScoreCard: React.FC<{ p?: FdPlayer | null; you?: boolean; r?: FdResult; win?: boolean; tone: 'amber' | 'sky' }> = ({ p, you, r, win, tone }) => (
  <div className={`relative rounded-2xl p-3 text-center border ${win ? 'bg-amber-400/15 border-amber-400/70 shadow-lg shadow-amber-500/10' : `${GLASS}`}`}>
    {win && <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 text-amber-300 fill-amber-300 drop-shadow" />}
    <div className="flex justify-center"><Avatar src={p?.avatar} name={p?.name} className={`w-11 h-11 ring-2 ${tone === 'amber' ? 'ring-amber-400/80' : 'ring-sky-400/80'}`} /></div>
    <div className="mt-1.5 text-xs font-bold text-white truncate">{you ? 'Siz' : p?.name || 'Do‘st'}</div>
    {r ? (
      <>
        <div className="mt-1 text-3xl font-black text-amber-300 tabular-nums leading-none">{r.s}</div>
        <div className="text-[10px] text-slate-300 mt-0.5">ball</div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-slate-200 tabular-nums">
          <span className="text-emerald-300 font-bold">{r.c}/{FD_QUESTIONS}</span>
          <span className="text-slate-500">·</span>
          <span>{fmtTime(r.t)}</span>
        </div>
      </>
    ) : (
      <div className="mt-3 mb-1 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> o‘ynayapti…</div>
    )}
  </div>
);

/* ------------------------------ Global Blitz mukofot qatori ------------------------------ */

/** O'yin tugagach serverdan kelgan mukofot/limit holatini ko'rsatadi (Global Blitz) */
export const RewardLine: React.FC<{ s?: Pick<FdSettleUser, 'xp' | 'why' | 'used' | 'limit' | 'counted'> | GbSettle | null; late?: boolean; pending?: boolean; win?: boolean }> = ({ s, late, pending, win }) => {
  const wrap = (cls: string, icon: React.ReactNode, text: React.ReactNode) => (
    <div className={`rounded-xl border px-3 py-2 text-xs leading-snug flex items-start gap-2 ${cls}`}><span className="shrink-0 mt-px">{icon}</span><span>{text}</span></div>
  );
  if (late) return wrap('bg-white/[0.06] border-white/[0.12] text-slate-300', '⏱', 'Raqib juda kech tugatdi — bu o‘yin mukofotga hisoblanmadi.');
  if (!s) return pending ? wrap('bg-white/[0.06] border-white/[0.12] text-slate-300', <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />, 'Mukofot hisoblanmoqda…') : null;
  if (s.xp > 0) return wrap('bg-emerald-500/10 border-emerald-400/40 text-emerald-200', <Gem className="w-4 h-4 text-emerald-300" />, <><b className="text-emerald-100">+{s.xp} XP</b> — g‘alaba mukofoti. Bugungi mukofotli o‘yinlar: {s.used}/{s.limit}</>);
  if (s.counted) return wrap('bg-sky-500/10 border-sky-400/30 text-sky-100', '✅', <>O‘yin hisobga olindi ({s.used}/{s.limit}). {win ? 'Mukofot hozircha o‘chirilgan.' : 'XP faqat g‘alaba uchun beriladi — keyingisida omad!'}</>);
  if (s.why === 'limit') return wrap('bg-amber-500/10 border-amber-400/30 text-amber-100', '🛑', <>Bugungi {s.limit} ta mukofotli o‘yin tugadi — bu o‘yin hisobga olinmadi. Mashq qilishingiz mumkin, mukofot ertaga yangilanadi.</>);
  if (s.why === 'same') return wrap('bg-amber-500/10 border-amber-400/30 text-amber-100', '🔁', 'Bu raqib bilan bugun allaqachon o‘ynagansiz — mukofot faqat har xil raqiblar uchun. Yangi raqib toping!');
  if (s.why === 'error') return wrap('bg-rose-500/10 border-rose-400/30 text-rose-200', '⚠️', 'Mukofotni hisoblab bo‘lmadi. Natija saqlandi.');
  return null;
};

/* ------------------------------ asosiy oyna ------------------------------ */

const WALKOVER_MS = 100000; // Global Blitz: raqib shuncha vaqt natija yubormasa — chiqib ketgan deb hisoblanadi
const STUCK_MS = 20000; // Global Blitz: raqib shuncha vaqt savollarni tayyorlamasa — o'zimiz tayyorlaymiz

const FriendDuelModal: React.FC<{ code: string | null; global?: boolean }> = ({ code, global = false }) => {
  const { accountId, profile, allWords, realtimeOn, refreshGrants } = useApp();
  const me: FdMe = useMemo(
    () => ({ id: accountId, name: profile.name || 'Do‘st', avatar: profile.avatar && profile.avatar.length <= 400 ? profile.avatar : '' }),
    [accountId, profile.name, profile.avatar]
  );

  const [phase, setPhase] = useState<'idle' | 'count' | 'play'>('idle');
  const [active, setActive] = useState<{ n: number; k: string; q: FdQuestion[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinErr, setJoinErr] = useState<'none' | 'full' | 'net' | ''>('');
  const [mine, setMine] = useState<{ n: number; res: FdResult; wrong: FdQuestion[]; sent: boolean; log?: GbLogItem[]; rejected?: string } | null>(null);
  const [settleMine, setSettleMine] = useState<{ n: number; s: GbSettle } | null>(null);
  const grantKey = useRef('');
  const { room, loaded, refresh } = useFriendRoom(code, phase !== 'play');
  const booting = useRef(false);
  const joining = useRef(false);
  const finalizing = useRef('');
  const progRef = useRef<{ s: number; c: number; t: number; i: number }>({ s: 0, c: 0, t: 0, i: 0 });
  const [, force] = useState(0);
  const seenOppAt = useRef(0);
  const autoKey = useRef('');

  const iAmIn = !!room?.players.some(p => p.id === me.id);
  const meP = room?.players.find(p => p.id === me.id) || null;
  const opp = room?.players.find(p => p.id !== me.id) || null;
  const round = room && room.rounds.length ? room.rounds[room.rounds.length - 1] : null;
  const serverRes = round && room ? room.results[round.n]?.[me.id] : undefined;
  const localRes = round && mine && mine.n === round.n && mine.res.k === round.k ? mine.res : undefined;
  const myRes = serverRes || localRes;
  const oppRes = round && room && opp ? room.results[round.n]?.[opp.id] : undefined;
  const link = code ? getFriendDuelLink(code) : '';
  const verdict = myRes && oppRes ? compareResults(myRes, oppRes) : null;

  /* 1. Kod yo'q bo'lsa: kutib turgan o'z xonamizni qayta ishlatamiz yoki yangisini ochamiz */
  useEffect(() => {
    if (code || booting.current) return;
    booting.current = true;
    (async () => {
      const recent = getMyRooms().filter(r => r.host && Date.now() - r.ts < 12 * 3600 * 1000);
      for (const r of recent) {
        const rm = await fetchRoom(r.code);
        if (rm && rm.players.length < FD_MAX_PLAYERS && rm.players.some(p => p.id === me.id)) {
          setFriendDuelCode(r.code);
          return;
        }
      }
      const c = await createRoom(me);
      if (!c) {
        setErr('Duel ochib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.');
        booting.current = false;
        return;
      }
      rememberRoom(c, true);
      setFriendDuelCode(c);
    })();
  }, [code, me]);

  /* 2. Havola orqali kirgan do'st xonaga avtomatik qo'shiladi */
  useEffect(() => {
    if (!code || !loaded) return;
    if (!room) { setJoinErr('none'); return; }
    if (iAmIn) { if (!global) rememberRoom(code, room.createdBy === me.id); setJoinErr(''); return; }
    if (room.players.length >= FD_MAX_PLAYERS) { setJoinErr('full'); return; }
    if (joining.current) return;
    joining.current = true;
    joinRoom(code, me).then(r => {
      if (r.ok) {
        rememberRoom(code, false);
        triggerHaptic('success');
        refresh();
      } else setJoinErr(r.error);
      joining.current = false;
    });
  }, [code, loaded, room, iAmIn, me, refresh, global]);

  /* 3. O'yin yarmida yopilgan bo'lsa — qolgan savollar xato hisoblanib natija yuboriladi (savollarni qayta o'ynab bo'lmaydi) */
  useEffect(() => {
    if (!room || !round || !iAmIn || phase !== 'idle' || myRes) return;
    const p = loadProgress(room.code, round.n);
    const key = `${room.code}:${round.n}:${round.k}`;
    if (!p || p.k !== round.k || finalizing.current === key) return;
    finalizing.current = key;
    const done = (ok: boolean) => { if (ok) { clearProgress(room.code, round.n); refresh(); } else finalizing.current = ''; };
    if (global) {
      // Global Blitz: natijani server hisoblaydi — saqlangan javoblar yuboriladi (javob berilmaganlari «vaqt tugadi» hisoblanadi)
      submitLive({ id: me.id, name: me.name, avatar: me.avatar, level: profile.level }, room.code, round.n, (p.log || []) as GbLogItem[]).then(r => {
        if (r?.ok && r.settle && r.settle.xp > 0) setTimeout(refreshGrants, 700);
        // server rad etgan natija (masalan, vaqt mos kelmadi) qayta-qayta yuborilmaydi
        done(!!r && (r.ok || !!r.error));
      });
    } else submitResult(room.code, round.n, me.id, finalizeProgress(p)).then(done);
  }, [room, round, iAmIn, phase, myRes, me.id, refresh, global]);

  /* 4. Do'st natijasi kelganda — ovoz va tebranish */
  const oppSeen = useRef(false);
  useEffect(() => {
    const has = !!(myRes && oppRes);
    if (has && !oppSeen.current && phase === 'idle') {
      oppSeen.current = true;
      if (verdict !== null && verdict > 0) { sfx.win(true); triggerHaptic('success'); }
      else if (verdict !== null && verdict < 0) { sfx.wrong(); triggerHaptic('warning'); }
      else triggerHaptic('selection');
    }
    if (!has) oppSeen.current = false;
  }, [myRes, oppRes, verdict, phase]);

  const begin = async (rematch: boolean) => {
    if (!room || busy) return;
    setBusy(true);
    setErr('');
    const n = rematch ? (round?.n ?? 0) + 1 : round?.n ?? 1;
    if (!round || rematch) {
      const used = new Set(room.rounds.flatMap(r => r.ids));
      const ok = await startRound(room.code, n, me, allWords, profile.level, used);
      if (!ok) { setErr('Duelni boshlab bo‘lmadi. Internetni tekshiring va qayta urinib ko‘ring.'); setBusy(false); return; }
    }
    const fresh = await fetchRoom(room.code);
    const r = roundOf(fresh, n);
    if (!r) { setErr('Savollar yuklanmadi. Qayta urinib ko‘ring.'); setBusy(false); return; }
    saveProgress(room.code, n, { k: r.k, s: 0, c: 0, t: 0, i: 0 });
    progRef.current = { s: 0, c: 0, t: 0, i: 0 };
    setActive({ n, k: r.k, q: r.q });
    setPhase('count');
    setBusy(false);
    refresh();
  };

  /* Global Blitz: raqib eslab qolinadi; o'yin avtomatik boshlanadi (savollarni xona egasi tayyorlaydi — poyga yo'q) */
  useEffect(() => {
    if (global && opp) rememberOpp(opp.id);
  }, [global, opp?.id]);

  useEffect(() => {
    if (!global) return;
    const id = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(id);
  }, [global]);

  if (global && opp && !seenOppAt.current) seenOppAt.current = Date.now();
  const stuck = global && !!opp && !round && seenOppAt.current > 0 && Date.now() - seenOppAt.current > STUCK_MS;

  useEffect(() => {
    if (!global || !room || !iAmIn || !opp || phase !== 'idle' || busy || myRes || mine) return;
    const host = room.createdBy === me.id;
    if (!host && !round) return;
    const key = `${room.code}:${round?.k || 'new'}`;
    if (autoKey.current === key) return;
    autoKey.current = key;
    begin(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [global, room, iAmIn, opp, phase, busy, myRes, mine, round]);

  const gbMe = { id: me.id, name: me.name, avatar: me.avatar, level: profile.level };
  /** Global Blitz: natijani serverga yuboradi (server ball, g'olib va mukofotni o'zi hisoblaydi) */
  const sendLive = async (n: number, log: GbLogItem[]) => {
    const sub = await submitLive(gbMe, room!.code, n, log);
    if (sub?.ok) {
      clearProgress(room!.code, n);
      setMine(m => (m && m.n === n ? { ...m, res: { ...m.res, s: sub.s, c: sub.c, t: sub.t }, sent: true, rejected: undefined } : m));
      if (sub.settle) {
        setSettleMine({ n, s: sub.settle });
        if (sub.settle.xp > 0) setTimeout(refreshGrants, 700);
      }
      refresh();
      return true;
    }
    if (sub && !sub.ok) { // server natijani qabul qilmadi — qayta yuborish foyda bermaydi
      clearProgress(room!.code, n);
      setMine(m => (m && m.n === n ? { ...m, sent: true, rejected: sub.error || 'Natija qabul qilinmadi' } : m));
      return true;
    }
    return false;
  };

  const finish = async (r: PlayDone) => {
    if (!room || !active) return;
    const res: FdResult = { k: active.k, s: r.s, c: r.c, t: r.t, ts: Date.now() };
    setMine({ n: active.n, res, wrong: r.wrong, sent: false, log: r.log });
    setPhase('idle');
    sfx.win(r.c >= FD_QUESTIONS / 2);
    if (global) { await sendLive(active.n, r.log); return; }
    const ok = await submitResult(room.code, active.n, me.id, res);
    if (ok) {
      clearProgress(room.code, active.n);
      setMine(m => (m ? { ...m, sent: true } : m));
      refresh();
    }
  };
  const resend = async () => {
    if (!room || !mine) return;
    setBusy(true);
    const ok = global ? await sendLive(mine.n, mine.log || []) : await submitResult(room.code, mine.n, me.id, mine.res).then(o => {
      if (o) { clearProgress(room.code, mine.n); setMine({ ...mine, sent: true }); refresh(); }
      return o;
    });
    setBusy(false);
    if (!ok) setErr('Natijani yuborib bo‘lmadi. Internetni tekshiring.');
  };

  /* Global Blitz: raqib keyin tugatsa, mukofot serverda hisoblanadi — XP sovg'a sifatida olinadi */
  const mySettle: FdSettleUser | GbSettle | undefined = round && room ? room.settle[round.n]?.r?.[me.id] || (settleMine && settleMine.n === round.n ? settleMine.s : undefined) : undefined;
  const lateSettle = !!(round && room && room.settle[round.n]?.late);
  useEffect(() => {
    if (!global || !room || !round || !mySettle || mySettle.xp <= 0) return;
    const key = `${room.code}:${round.n}`;
    if (grantKey.current === key) return;
    grantKey.current = key;
    setTimeout(refreshGrants, 700);
  }, [global, room, round, mySettle, refreshGrants]);

  const close = () => {
    if (phase === 'play' || phase === 'count') {
      if (!window.confirm('Duelni to‘xtatasizmi? Qolgan savollar xato hisoblanadi.')) return;
    }
    closeFriendDuel();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(`${inviteText(me.name)}\n${link}`); } catch {
      const ta = document.createElement('textarea');
      ta.value = link; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    triggerHaptic('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const invite = () => { triggerHaptic('light'); shareUrl(link, inviteText(me.name)); };
  const remind = () => { triggerHaptic('light'); shareUrl(link, `⏳ Men Blitz Duelda ${myRes?.s ?? 0} ball to‘pladim — meni yenga olasanmi? 😎`); };

  const series = room && opp ? seriesScore(room, me.id, opp.id) : null;
  const wrongList = mine && round && mine.n === round.n ? mine.wrong.slice(0, 6) : [];

  /* ------------------------------- ko'rinish ------------------------------- */
  let body: React.ReactNode;

  if (!realtimeOn) {
    body = <p className="py-8 text-center text-sm text-slate-300">Do‘st bilan duel uchun jonli baza (Firebase) ulangan bo‘lishi kerak.</p>;
  } else if (!code) {
    body = err ? (
      <div className="py-6 space-y-4 text-center">
        <p className="text-sm text-rose-300">{err}</p>
        <Primary onClick={() => { setErr(''); booting.current = false; setFriendDuelCode(null); }}><RotateCcw className="w-4 h-4" /> Qayta urinish</Primary>
      </div>
    ) : (
      <div className="py-14 text-center text-sm text-slate-300 flex flex-col items-center gap-3"><Loader2 className="w-7 h-7 animate-spin text-amber-300" /> Duel tayyorlanmoqda…</div>
    );
  } else if (joinErr === 'none' || joinErr === 'full' || (loaded && !room)) {
    body = (
      <div className="py-8 text-center space-y-4">
        <div className="text-5xl">{joinErr === 'full' ? '🚫' : '🤷'}</div>
        <p className="text-sm text-slate-200 font-semibold">{joinErr === 'full' ? 'Bu duelda joy qolmagan — unda allaqachon ikki kishi o‘ynayapti.' : 'Bunday duel topilmadi yoki havola xato.'}</p>
        <Primary onClick={() => { forgetRoom(code); openFriendDuel(); }}><Swords className="w-4 h-4" /> O‘z duelimni ochish</Primary>
      </div>
    );
  } else if (!room || !iAmIn) {
    body = <div className="py-14 text-center text-sm text-slate-300 flex flex-col items-center gap-3"><Loader2 className="w-7 h-7 animate-spin text-amber-300" /> {joinErr === 'net' ? 'Ulanib bo‘lmadi, qayta urinilmoqda…' : 'Duelga qo‘shilinmoqda…'}</div>;
  } else if (phase === 'count' && active) {
    body = <Countdown onEnd={() => setPhase('play')} />;
  } else if (phase === 'play' && active) {
    body = <FdPlay qs={active.q} onProgress={p => { progRef.current = p; saveProgress(room.code, active.n, { k: active.k, s: p.s, c: p.c, t: p.t, i: p.i, ...(global ? { log: p.log.map(x => ({ a: x.a ?? null, c: x.c, m: x.m })) } : {}) }); }} onDone={finish} />;
  } else if (!opp) {
    /* ---- LOBBY: do'st kutilmoqda ---- */
    body = (
      <div className="space-y-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 py-2">
            <Person p={meP} you tone="amber" big />
            <Vs />
            <Person tone="sky" big waiting />
          </div>
          <h3 className="mt-2 text-xl font-black text-white">Do‘stingizni chaqiring!</h3>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">Havolani yuboring. Do‘stingiz kirishi bilan ikkalangizga <b className="text-white">bir xil {FD_QUESTIONS} ta so‘z</b> beriladi — kim tez va to‘g‘ri topadi?</p>
        </div>
        <Rules />
        <Primary onClick={invite}><Share2 className="w-4 h-4" /> Do‘stga yuborish</Primary>
        <Ghost onClick={copy}>{copied ? <><Check className="w-4 h-4 text-emerald-300" /> Nusxalandi</> : <><Copy className="w-4 h-4" /> Havolani nusxalash</>}</Ghost>
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-300"><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Do‘st kirishi kutilmoqda… (o‘zi yangilanadi)</div>
      </div>
    );
  } else if (global && (!round || !myRes) && !err && !stuck) {
    /* ---- GLOBAL: raqib topildi, o'yin o'zi boshlanadi ---- */
    body = (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-2">
          <Person p={meP} you tone="amber" big />
          <Vs />
          <Person p={opp} tone="sky" big />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-black text-white">Raqib topildi!</h3>
          <p className="mt-1 text-xs text-slate-300">{opp.name} bilan bir xil {FD_QUESTIONS} ta savol. Hozir boshlanadi…</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-300"><Loader2 className="w-4 h-4 animate-spin text-amber-300" /> Savollar tayyorlanmoqda</div>
      </div>
    );
  } else if (!round || !myRes) {
    /* ---- TAYYOR: ikkalasi ham xonada, o'yin boshlash ---- */
    const oppDone = !!oppRes;
    body = (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-2">
          <Person p={meP} you tone="amber" big />
          <Vs />
          <Person p={opp} tone="sky" big />
        </div>
        {series && series.played > 0 && <div className="text-center text-xs font-bold text-slate-200">Hisob: <span className="text-amber-300 tabular-nums">{series.a}</span> : <span className="text-sky-300 tabular-nums">{series.b}</span></div>}
        <div className="text-center">
          <h3 className="text-xl font-black text-white">{round ? (oppDone ? 'Do‘stingiz o‘ynab bo‘ldi!' : 'Yangi raund tayyor!') : `${opp.name} qo‘shildi!`}</h3>
          <p className="mt-1 text-xs text-slate-300">{oppDone ? 'Navbat sizda — natijangiz bilan birga uning balli ham ochiladi.' : 'Ikkalangiz bir xil savollarni olasiz. Natijalar ikkalangizga ko‘rinadi.'}</p>
        </div>
        <Rules />
        {err && <div className="rounded-xl bg-rose-500/10 border border-rose-400/40 p-2.5 text-xs text-rose-300 text-center">{err}</div>}
        <Primary disabled={busy} onClick={() => begin(false)}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-5 h-5 fill-slate-950" /> {round ? 'Boshlash' : 'Duelni boshlash'}</>}</Primary>
      </div>
    );
  } else {
    /* ---- NATIJA ---- */
    const bothDone = !!oppRes;
    const gone = global && !bothDone && Date.now() - myRes.ts > WALKOVER_MS;
    const title = gone ? 'Raqib chiqib ketdi 🚪' : !bothDone ? 'Natijangiz tayyor!' : verdict! > 0 ? 'Siz yutdingiz! 🏆' : verdict! < 0 ? `${opp.name} yutdi 😤` : 'Durang! 🤝';
    const sub = gone ? 'Raqibingiz o‘yinni tugatmadi, shuning uchun bu o‘yin mukofotga hisoblanmaydi. U keyinroq tugatsa, natija botga yuborilishi mumkin. Yangi raqib bilan davom eting.' : !bothDone ? `${opp.name} hali o‘ynamadi. U tugatishi bilan natijalar shu yerda chiqadi.` : verdict! > 0 ? 'Zo‘r o‘ynadingiz! Endi qayta o‘ynab, g‘alabani mustahkamlang.' : verdict! < 0 ? 'Hisobni teng qilish uchun qayta o‘ynang — so‘zlar yangi bo‘ladi.' : 'Ball, to‘g‘ri javob va vaqt aynan teng chiqdi!';
    body = (
      <div className="space-y-3.5">
        <div className="text-center">
          {gone ? <div className="fd-rise text-5xl">🚪</div> : bothDone && verdict === 0 ? <Handshake className="w-10 h-10 mx-auto text-amber-300" /> : bothDone ? <div className="fd-rise text-5xl">{verdict! > 0 ? '🏆' : '⚔️'}</div> : <div className="fd-rise text-5xl">⏳</div>}
          <h3 className="mt-1 text-xl font-black text-white">{title}</h3>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">{sub}</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <ScoreCard p={meP} you r={myRes} win={bothDone && verdict! > 0} tone="amber" />
          <ScoreCard p={opp} r={oppRes} win={bothDone && verdict! < 0} tone="sky" />
        </div>

        {global && bothDone && (
          <RewardLine s={mySettle} late={lateSettle} win={verdict !== null && verdict > 0} pending={!!myRes && !!oppRes && Date.now() - Math.max(myRes.ts, oppRes.ts) < 20000} />
        )}

        {!global && series && series.played > 0 && (
          <div className={`${GLASS} rounded-xl px-3 py-2 flex items-center justify-between text-xs`}>
            <span className="text-slate-300">Umumiy hisob ({series.played} raund)</span>
            <span className="font-black tabular-nums"><span className="text-amber-300">{series.a}</span> <span className="text-slate-400">:</span> <span className="text-sky-300">{series.b}</span></span>
          </div>
        )}

        {wrongList.length > 0 && (
          <div className={`${GLASS} rounded-xl p-3`}>
            <div className="text-[11px] font-bold text-slate-200 mb-1.5">Xato qilgan so‘zlaringiz — eslab qoling:</div>
            <div className="flex flex-wrap gap-1.5">
              {wrongList.map(w => <span key={w.e} className="text-[11px] px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-100"><b>{w.e}</b> — {w.u}</span>)}
            </div>
          </div>
        )}

        {global && mine?.rejected && !serverRes && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-400/40 p-3 text-xs text-rose-200">Natijangiz tasdiqlanmadi: {mine.rejected}. Bunday o‘yin hisobga olinmaydi.</div>
        )}
        {mine && !mine.sent && !serverRes && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-400/40 p-3 text-xs text-amber-200 space-y-2">
            <div>{global ? 'Natijangiz hali serverga yuborilmadi.' : 'Natijangiz hali do‘stingizga yuborilmadi.'}</div>
            <Ghost disabled={busy} onClick={resend}><RotateCcw className="w-4 h-4" /> Qayta yuborish</Ghost>
          </div>
        )}
        {err && <div className="rounded-xl bg-rose-500/10 border border-rose-400/40 p-2.5 text-xs text-rose-300 text-center">{err}</div>}

        {global ? (
          bothDone || gone ? (
            <Primary onClick={() => { closeFriendDuel(); openGlobalBlitz(); }}><RotateCcw className="w-5 h-5" /> Yangi raqib</Primary>
          ) : (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-300 py-1"><Loader2 className="w-4 h-4 animate-spin text-amber-300" /> {opp.name} o‘ynayapti…</div>
          )
        ) : bothDone ? (
          <Primary disabled={busy} onClick={() => begin(true)}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RotateCcw className="w-5 h-5" /> Qayta o‘ynash — yangi so‘zlar</>}</Primary>
        ) : (
          <Primary onClick={remind}><Share2 className="w-4 h-4" /> Do‘stga eslatish</Primary>
        )}
        <Ghost onClick={close}>Yopish</Ghost>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md overflow-y-auto" role="dialog" aria-modal="true">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="keep-dark fd-pop relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#182232] to-[#0E1524] border border-amber-500/40 p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5"><Swords className="w-4 h-4" /> {global ? '🌍 Global Blitz' : 'Do‘st bilan Blitz Duel'}</span>
            <button type="button" onClick={close} aria-label="Yopish" className="w-8 h-8 rounded-full bg-white/[0.08] text-slate-300 hover:text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
          {body}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ App'ga ulanadigan qism ------------------------------ */

export const FriendDuelHost: React.FC = () => {
  const { open, code, global } = useFriendDuelUi();
  // Ilova do'st havolasi orqali ochilgan bo'lsa — bir marta duel oynasi ochiladi
  useEffect(() => {
    const c = readFriendDuelParam();
    if (!c) return;
    if (!getMyRooms().some(r => r.code === c)) openFriendDuel(c);
    try { if (new URLSearchParams(window.location.search).get('bd')) window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
  }, []);
  return open ? <FriendDuelModal code={code} global={global} /> : null;
};

/* ------------------------------ taklif kartasi ------------------------------ */

export type InviteContext = 'level' | 'rank' | 'streak' | 'cert';

const COPY: Record<InviteContext, { title: (d?: string) => string; sub: string }> = {
  level: { title: d => (d ? `${d} — zo‘r natija!` : 'Zo‘r natija!'), sub: 'Do‘stingiz sizdan kuchlimi? Uni 15 so‘zlik Blitz Duelga chaqiring.' },
  rank: { title: () => 'Reytingda ko‘tarildingiz! 🚀', sub: 'Do‘stingiz sizga yeta oladimi? Duelda sinab ko‘ring.' },
  streak: { title: d => (d ? `${d} kunlik streak! 🔥` : 'Streak rekordi! 🔥'), sub: 'Do‘stingiz shuncha so‘zni biladimi? Uni duelga chaqiring.' },
  cert: { title: () => 'Sertifikat oldingiz! 🎓', sub: 'Endi do‘stingiz bilan kim ko‘p so‘z bilishini sinab ko‘ring.' },
};

const IconTile: React.FC<{ size?: string }> = ({ size = 'w-11 h-11' }) => (
  <div className={`${size} rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 shrink-0 shadow-md shadow-orange-500/30`}>
    <Swords className="w-6 h-6" />
  </div>
);

export const FriendDuelCard: React.FC<{ variant?: 'hero' | 'banner' | 'moment'; context?: InviteContext; detail?: string; onOpen?: () => void; className?: string }> = ({ variant = 'moment', context, detail, onOpen, className = '' }) => {
  const { realtimeOn } = useApp();
  if (!realtimeOn) return null;
  const go = () => {
    triggerHaptic('medium');
    onOpen?.();
    openFriendDuel();
  };
  const surface = 'keep-dark relative overflow-hidden border border-amber-400/40 bg-gradient-to-br from-[#2A1A0A] via-[#1B1530] to-[#0E1524] text-left';

  if (variant === 'banner') {
    return (
      <button type="button" onClick={go} className={`${surface} w-full rounded-2xl p-3 flex items-center gap-3 shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all ${className}`}>
        <span className="pointer-events-none absolute -right-8 -top-10 w-28 h-28 rounded-full bg-amber-400/20 blur-2xl" aria-hidden />
        <IconTile />
        <span className="relative min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-white leading-tight">Do‘stni duelga chaqirish</span>
          <span className="block text-[11px] text-slate-300 mt-0.5 truncate">{FD_QUESTIONS} ta so‘z · bir xil savollar · kim kuchli?</span>
        </span>
        <span className="relative shrink-0 h-9 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-xs font-black flex items-center gap-1">Chaqirish <ChevronRight className="w-4 h-4" /></span>
      </button>
    );
  }

  const c = context ? COPY[context] : null;
  const title = c ? c.title(detail) : 'Do‘stni duelga chaqirish';
  const sub = c ? c.sub : 'Havola yuboring — do‘stingiz kirishi bilan ikkalangizga bir xil so‘zlar beriladi. Kim tez va ko‘p topadi?';
  return (
    <div className={`${surface} rounded-2xl p-4 shadow-lg shadow-amber-500/10 ${className}`}>
      <span className="pointer-events-none absolute -right-10 -top-12 w-36 h-36 rounded-full bg-amber-400/20 blur-2xl" aria-hidden />
      <div className="relative flex items-center gap-3">
        <IconTile size="w-12 h-12" />
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-white leading-tight">{title}</div>
          <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">{sub}</div>
        </div>
      </div>
      {variant === 'hero' && (
        <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">
          {[[`${FD_QUESTIONS}`, 'ta so‘z'], [`${FD_SECONDS} s`, 'har biriga'], ['∞', 'qayta o‘ynash']].map(([a, b]) => (
            <div key={b} className={`${GLASS} rounded-xl py-1.5`}>
              <div className="text-sm font-black text-amber-300 leading-none">{a}</div>
              <div className="text-[10px] text-slate-300 mt-1">{b}</div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={go} className="relative mt-3 w-full h-11 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 active:scale-[0.98] transition-all">
        <Swords className="w-4 h-4" /> Do‘stni duelga chaqirish
      </button>
    </div>
  );
};

/* ------------------------------ oxirgi duellar (DuelTab) ------------------------------ */

export const FriendDuelRecent: React.FC = () => {
  const { accountId } = useApp();
  const [rows, setRows] = useState<FdRoom[]>([]);
  useEffect(() => {
    let dead = false;
    (async () => {
      const list = await Promise.all(getMyRooms().slice(0, 3).map(r => fetchRoom(r.code)));
      if (!dead) setRows(list.filter((x): x is FdRoom => !!x && x.players.some(p => p.id === accountId)));
    })();
    return () => { dead = true; };
  }, [accountId]);
  if (!rows.length) return null;
  return (
    <section className="space-y-2">
      <div className="text-xs text-slate-400 font-semibold uppercase px-1">Do‘stlar bilan duellar</div>
      {rows.map(r => {
        const opp = r.players.find(p => p.id !== accountId);
        const last = r.rounds[r.rounds.length - 1];
        const my = last ? r.results[last.n]?.[accountId] : undefined;
        const his = last && opp ? r.results[last.n]?.[opp.id] : undefined;
        const sc = opp ? seriesScore(r, accountId, opp.id) : null;
        const status = !opp ? 'Do‘st kutilmoqda' : !last ? 'Boshlashga tayyor' : !my ? 'Sizning navbatingiz ⚡' : !his ? 'Do‘st natijasi kutilmoqda' : 'Raund tugadi';
        return (
          <button key={r.code} type="button" onClick={() => openFriendDuel(r.code)} className="w-full text-left rounded-2xl p-3 bg-[#151C28] border border-slate-800 flex items-center gap-3 active:scale-[0.99] transition-all">
            {opp ? <Avatar src={opp.avatar} name={opp.name} className="w-10 h-10" /> : <span className="w-10 h-10 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center"><Users className="w-4 h-4 text-slate-400" /></span>}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white truncate">{opp ? opp.name : 'Do‘st hali kirmadi'}</span>
              <span className="block text-[11px] text-slate-400">{status}</span>
            </span>
            {sc && sc.played > 0 && <span className="text-sm font-black tabular-nums text-amber-400">{sc.a}:{sc.b}</span>}
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          </button>
        );
      })}
    </section>
  );
};

export { openFriendDuel };
