import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, X, Loader2, Zap, RotateCcw, Crown, ChevronRight, Trophy } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic } from '../services/telegram';
import { sfx } from '../services/sound';
import {
  FD_QUESTIONS, FdPlayer, FdQuestion, FdResult, compareResults, buildQuestions, openGlobalRoom, useFriendDuelUi,
} from '../services/friendDuel';
import {
  GB_WAIT_MS, GbGhost, GbLogItem, GbMe, GbInfo, GbSaveResult, GbWeekRow, findOpponent, saveGhost, loadWeekly, rememberOpp, getShareGhost, setShareGhost,
  openGlobalBlitz, closeGlobalBlitz, useGlobalBlitzUi, useGbWaiters, useGbToast, dismissGbToast, startWaiterWatch, setWaiterWatchPaused,
} from '../services/globalBlitz';
import { GLASS, Person, Vs, Rules, Primary, Ghost, FdPlay, Countdown, ScoreCard, PlayDone, RewardLine } from './FriendDuel';

/* =====================================================================
   Global Blitz — ilovadagi istalgan o'yinchi bilan Blitz Duel.
   1) ~60 soniya jonli raqib qidiriladi (daraja bo'yicha navbat, ±1 daraja). «Ochiq lobbi»: kutayotganingizni boshqa o'yinchilar ko'radi (bildirishnoma / kartochka) va bosib sizga ulanishi mumkin;
   2) topilsa — «Do'st bilan Blitz Duel» xonasi ochiladi (o'sha oyna, o'sha kod);
   3) topilmasa — shu darajada oldin o'ynagan o'yinchining saqlangan natijasi bilan o'ynaladi va bu ochiq yoziladi.
   Mukofot (serverda hisoblanadi): g'alabaga XP, kuniga cheklangan soni, bir raqib bilan kuniga 1 marta. Haftalik reyting — kartada.
   «Ruh» raqib bilan o'yinda ham mukofot beriladi, mashqda (hech kim o'ynamagan) — yo'q.
   ===================================================================== */

const InfoLine: React.FC<{ info: GbInfo }> = ({ info }) => {
  const left = Math.max(0, info.limit - info.used);
  return (
    <div className="mx-auto max-w-[17rem] rounded-xl bg-emerald-500/10 border border-emerald-400/30 px-3 py-1.5 text-[11px] text-emerald-100 leading-snug">
      💎 G‘alabaga <b>+{info.xp} XP</b> · bugun mukofotli o‘yin: <b>{info.used}/{info.limit}</b>{left === 0 ? ' (limit tugadi)' : ''}
    </div>
  );
};

type Phase = 'search' | 'intro' | 'count' | 'play' | 'result' | 'none' | 'error';

const GlobalBlitzModal: React.FC = () => {
  const { accountId, profile, allWords, refreshGrants } = useApp();
  const me: GbMe = useMemo(
    () => ({ id: accountId, name: profile.name || 'O‘yinchi', avatar: profile.avatar && profile.avatar.length <= 400 ? profile.avatar : '', level: profile.level }),
    [accountId, profile.name, profile.avatar, profile.level]
  );

  const [phase, setPhase] = useState<Phase>('search');
  const [run, setRun] = useState(0); // qayta qidirish uchun
  const [leftMs, setLeftMs] = useState(GB_WAIT_MS);
  const [ghost, setGhost] = useState<GbGhost | null>(null);
  const [practice, setPractice] = useState<FdQuestion[] | null>(null);
  const [mine, setMine] = useState<{ res: FdResult; wrong: FdQuestion[] } | null>(null);
  const [saved, setSaved] = useState<GbSaveResult | null | undefined>(undefined); // undefined — yuborilmoqda, null — server bilan aloqa yo'q
  const [info, setInfo] = useState<GbInfo | null>(null);
  const signal = useRef<{ cancelled: boolean; skip?: boolean }>({ cancelled: false });
  // «Ochiq lobbi»: bildirishnoma/kartochkadan kelgan bo'lsak — birinchi qidiruvda shu kutuvchiga ulanishga urinamiz (keyingi qidiruvlarda yo'q)
  const { prefer } = useGlobalBlitzUi();
  const preferRef = useRef<string | undefined>(prefer);
  const meRef = useRef(me);
  meRef.current = me;

  /* 1. Raqib qidirish */
  useEffect(() => {
    if (phase !== 'search') return;
    const sig = { cancelled: false };
    signal.current = sig;
    setLeftMs(GB_WAIT_MS);
    let alive = true;
    findOpponent(meRef.current, sig, l => alive && setLeftMs(l), i => alive && setInfo(i), preferRef.current).then(out => {
      if (!alive) return;
      if ((out.kind === 'ghost' || out.kind === 'none') && out.info) setInfo(out.info);
      if (out.kind === 'live') {
        triggerHaptic('success');
        sfx.click(true);
        closeGlobalBlitz();
        openGlobalRoom(out.code);
      } else if (out.kind === 'ghost') {
        rememberOpp(out.ghost.id);
        setGhost(out.ghost);
        setPhase('intro');
      } else if (out.kind === 'none') setPhase('none');
      else if (out.kind === 'error') setPhase('error');
    });
    return () => {
      alive = false;
      sig.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, phase === 'search']);

  const again = () => {
    setGhost(null);
    setPractice(null);
    setMine(null);
    setSaved(undefined);
    preferRef.current = undefined;
    setRun(r => r + 1);
    setPhase('search');
  };

  const startPractice = () => {
    const built = buildQuestions(allWords, profile.level, new Set());
    if (!built) { setPhase('error'); return; }
    setPractice(built.q);
    setGhost(null);
    setPhase('count');
  };

  const qs: FdQuestion[] | null = ghost ? ghost.q : practice;

  const finish = async (r: PlayDone) => {
    if (!qs) return;
    setMine({ res: { k: '', s: r.s, c: r.c, t: r.t, ts: Date.now() }, wrong: r.wrong });
    setPhase('result');
    sfx.win(r.c >= FD_QUESTIONS / 2);
    // Server javoblarni o'zi qayta hisoblaydi: g'olib va mukofot ham shu yerda aniqlanadi; natija keyingi o'yinchilar uchun saqlanadi
    setSaved(undefined);
    const res = await saveGhost(me, qs, r.log as GbLogItem[], ghost?.id);
    setSaved(res);
    if (res?.ok && res.settle && res.settle.xp > 0) setTimeout(refreshGrants, 700);
    if (res?.ok && (res.s !== r.s || res.c !== r.c || res.t !== r.t)) setMine(m => (m ? { ...m, res: { ...m.res, s: res.s, c: res.c, t: res.t } } : m));
  };

  const close = () => {
    if (phase === 'play' || phase === 'count') {
      if (!window.confirm('O‘yinni to‘xtatasizmi? Natija saqlanmaydi.')) return;
    }
    closeGlobalBlitz();
  };

  const ghostP: FdPlayer | null = ghost ? { id: ghost.id, name: ghost.name, avatar: ghost.avatar, joinedAt: 0 } : null;
  const meP: FdPlayer = { id: me.id, name: me.name, avatar: me.avatar, joinedAt: 0 };
  const ghostRes: FdResult | undefined = ghost ? { k: '', s: ghost.s, c: ghost.c, t: ghost.t, ts: 0 } : undefined;

  let body: React.ReactNode;
  if (phase === 'search') {
    const sec = Math.ceil(leftMs / 1000);
    body = (
      <div className="py-6 text-center space-y-5">
        <div className="flex items-center justify-center gap-3">
          <Person p={meP} you tone="amber" big />
          <Vs />
          <Person tone="sky" big waiting />
        </div>
        <div>
          <h3 className="text-xl font-black text-white">Raqib qidirilmoqda…</h3>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">Darajangiz ({profile.level}) atrofidagi jonli o‘yinchi izlanmoqda. Topilmasa, saqlangan natija bilan o‘ynaysiz.</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-amber-300 font-bold tabular-nums"><Loader2 className="w-4 h-4 animate-spin" /> {sec} s</div>
        <div className="mx-auto max-w-[17rem] rounded-xl bg-sky-500/10 border border-sky-400/30 px-3 py-1.5 text-[11px] text-sky-100 leading-snug">
          🌍 <b>Ochiq lobbi:</b> {preferRef.current ? 'kutayotgan raqibga ulanilmoqda. Band bo‘lsa, boshqasi qidiriladi.' : 'kutayotganingizni boshqa o‘yinchilar ko‘radi va sizga ulanishi mumkin. Oynani yopmang.'}
        </div>
        {info && info.rewards && <InfoLine info={info} />}
        <div className="flex flex-col gap-2">
          {sec > 3 && <Ghost onClick={() => { signal.current.skip = true; }}>Kutmasdan, saqlangan natija bilan boshlash</Ghost>}
          <Ghost onClick={close}>Bekor qilish</Ghost>
        </div>
      </div>
    );
  } else if (phase === 'intro' && ghost) {
    body = (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-2">
          <Person p={meP} you tone="amber" big />
          <Vs />
          <Person p={ghostP} tone="sky" big />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-black text-white">Raqib: {ghost.name}</h3>
          <p className="mt-1 text-xs text-amber-200 font-semibold">(oldin o‘ynagan)</p>
          <p className="mt-2 text-xs text-slate-300 leading-relaxed">Hozir jonli o‘yinchi yo‘q edi. {ghost.name} shu savollarni oldin o‘ynagan — uning natijasi bilan bellashasiz. Savollar ikkalangizga bir xil.</p>
        </div>
        {info && info.rewards && <InfoLine info={info} />}
        <Rules />
        <Primary onClick={() => setPhase('count')}><Zap className="w-5 h-5 fill-slate-950" /> Boshlash</Primary>
        <Ghost onClick={again}><RotateCcw className="w-4 h-4" /> Boshqa raqib qidirish</Ghost>
      </div>
    );
  } else if (phase === 'count' && qs) {
    body = <Countdown onEnd={() => setPhase('play')} />;
  } else if (phase === 'play' && qs) {
    body = <FdPlay qs={qs} ghost={ghost ? { name: `${ghost.name} (oldin o‘ynagan)`, log: ghost.r } : undefined} onProgress={() => {}} onDone={finish} />;
  } else if (phase === 'result' && mine) {
    const verdict = ghostRes ? compareResults(mine.res, ghostRes) : null;
    const srv = saved && saved.ok ? saved : null;
    const title = verdict === null ? 'O‘yin tugadi!' : verdict > 0 ? 'Siz yutdingiz! 🏆' : verdict < 0 ? `${ghost!.name} yutdi 😤` : 'Durang! 🤝';
    const wrongList = mine.wrong.slice(0, 6);
    body = (
      <div className="space-y-3.5">
        <div className="text-center">
          <div className="fd-rise text-5xl">{verdict === null ? '🎯' : verdict > 0 ? '🏆' : verdict < 0 ? '⚔️' : '🤝'}</div>
          <h3 className="mt-1 text-xl font-black text-white">{title}</h3>
          {ghost && <p className="mt-1 text-xs text-slate-300">{ghost.name} bilan saqlangan natija asosida o‘ynadingiz — bu jonli o‘yin emas edi.</p>}
        </div>
        {ghost ? (
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <ScoreCard p={meP} you r={mine.res} win={verdict! > 0} tone="amber" />
            <ScoreCard p={ghostP} r={ghostRes} win={verdict! < 0} tone="sky" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[[`${mine.res.s}`, 'ball'], [`${mine.res.c}/${FD_QUESTIONS}`, 'to‘g‘ri'], [`${(mine.res.t / 1000).toFixed(1)} s`, 'vaqt']].map(([a, b]) => (
              <div key={b} className={`${GLASS} rounded-xl py-2`}><div className="text-base font-black text-amber-300 leading-none">{a}</div><div className="text-[10px] text-slate-300 mt-1">{b}</div></div>
            ))}
          </div>
        )}
        {ghost && (saved === undefined ? <RewardLine pending /> : srv ? <RewardLine s={srv.settle} win={verdict !== null && verdict > 0} /> : saved ? <div className="rounded-xl bg-rose-500/10 border border-rose-400/40 p-2.5 text-xs text-rose-200 text-center">Natija tasdiqlanmadi: {saved.error}. Bunday o‘yin hisobga olinmaydi.</div> : <div className="rounded-xl bg-amber-500/10 border border-amber-400/40 p-2.5 text-xs text-amber-200 text-center">Serverga ulanib bo‘lmadi — mukofot berilmadi.</div>)}
        {!ghost && <div className="text-center text-[11px] text-slate-300">Mashq o‘yini — mukofot yo‘q.</div>}
        {srv && srv.saved && getShareGhost() && <div className="text-center text-[11px] text-emerald-300">Natijangiz saqlandi — keyingi o‘yinchi sizga qarshi o‘ynashi mumkin.</div>}
        {wrongList.length > 0 && (
          <div className={`${GLASS} rounded-xl p-3`}>
            <div className="text-[11px] font-bold text-slate-200 mb-1.5">Xato qilgan so‘zlaringiz — eslab qoling:</div>
            <div className="flex flex-wrap gap-1.5">
              {wrongList.map(w => <span key={w.e} className="text-[11px] px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-100"><b>{w.e}</b> — {w.u}</span>)}
            </div>
          </div>
        )}
        <Primary onClick={again}><RotateCcw className="w-5 h-5" /> Yangi raqib</Primary>
        <Ghost onClick={close}>Yopish</Ghost>
      </div>
    );
  } else if (phase === 'none') {
    body = (
      <div className="py-6 text-center space-y-4">
        <div className="text-5xl">🌍</div>
        <h3 className="text-lg font-black text-white">Hozircha raqib yo‘q</h3>
        <p className="text-xs text-slate-300 leading-relaxed">Shu darajada hali hech kim o‘ynamagan. Mashq qilib o‘ynang — natijangiz saqlanadi va keyingi kelgan o‘yinchi sizga qarshi bellashadi.</p>
        <Primary onClick={startPractice}><Zap className="w-5 h-5 fill-slate-950" /> Mashq qilish</Primary>
        <Ghost onClick={again}><RotateCcw className="w-4 h-4" /> Qayta qidirish</Ghost>
      </div>
    );
  } else {
    body = (
      <div className="py-6 text-center space-y-4">
        <p className="text-sm text-rose-300">Ulanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.</p>
        <Primary onClick={again}><RotateCcw className="w-4 h-4" /> Qayta urinish</Primary>
        <Ghost onClick={close}>Yopish</Ghost>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md overflow-y-auto" role="dialog" aria-modal="true">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="keep-dark fd-pop relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#182232] to-[#0E1524] border border-amber-500/40 p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5"><Globe2 className="w-4 h-4" /> Global Blitz</span>
            <button type="button" onClick={close} aria-label="Yopish" className="w-8 h-8 rounded-full bg-white/[0.08] text-slate-300 hover:text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
          {body}
        </div>
      </div>
    </div>
  );
};

/** «Kimdir Global Blitz da raqib kutyapti!» — bosilsa shu kutuvchiga ulanadi. 10 soniya turadi, progress chizig'i tugaydi */
const WaiterToast: React.FC<{ n: number; onJoin: () => void; onClose: () => void }> = ({ n, onJoin, onClose }) => (
  <div className="fixed inset-x-0 top-0 z-[150] flex justify-center px-3 pointer-events-none" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
    <div role="status" className="keep-dark gb-toast-in pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-sky-400/50 bg-gradient-to-br from-[#0B2238] via-[#13183A] to-[#0E1524] shadow-xl shadow-sky-500/25">
      <button type="button" onClick={onJoin} className="flex w-full items-center gap-3 p-3 pr-10 text-left active:scale-[0.99] transition-transform">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center text-slate-950 shrink-0"><Globe2 className="w-5 h-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-extrabold text-white leading-tight">{n > 1 ? `${n} kishi Global Blitz da raqib kutyapti!` : 'Kimdir Global Blitz da raqib kutyapti!'}</span>
          <span className="block text-[11px] text-sky-200/90 mt-0.5">Bosing — darhol ulanasiz</span>
        </span>
      </button>
      <button type="button" onClick={onClose} aria-label="Yopish" className="absolute right-2 top-2 w-6 h-6 rounded-full bg-white/[0.08] text-slate-300 hover:text-white flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
      <div className="h-1 bg-white/10"><div className="gb-toast-bar h-full w-full bg-gradient-to-r from-sky-400 to-indigo-500" /></div>
    </div>
  </div>
);

export const GlobalBlitzHost: React.FC = () => {
  const { open } = useGlobalBlitzUi();
  const fd = useFriendDuelUi();
  const toast = useGbToast();
  const { realtimeOn, accountId, profile } = useApp();
  const meRef = useRef({ id: accountId, level: profile.level });
  meRef.current = { id: accountId, level: profile.level };

  // Kutayotgan raqiblarni kuzatish (bq ni o'qiydi). Global Blitz oynasi yoki duel ochiq bo'lsa — to'xtaydi va bildirishnoma chiqmaydi
  const busy = open || fd.open;
  useEffect(() => {
    if (!realtimeOn || !accountId) return;
    return startWaiterWatch(() => meRef.current);
  }, [realtimeOn, accountId]);
  useEffect(() => { setWaiterWatchPaused(busy); }, [busy]);

  return (
    <>
      {open ? <GlobalBlitzModal /> : null}
      {toast && !busy ? (
        <WaiterToast
          key={toast.key}
          n={toast.n}
          onJoin={() => { triggerHaptic('medium'); sfx.click(true); dismissGbToast(); openGlobalBlitz(toast.id); }}
          onClose={dismissGbToast}
        />
      ) : null}
    </>
  );
};

/* ------------------------------ DuelTab uchun karta ------------------------------ */

/** «(N) raqib kutyapti» — HomeTab dagi kartochka ham xuddi shu yozuvni ko'rsatadi */
export const WaitingLine: React.FC<{ n: number }> = ({ n }) => (
  <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 leading-tight">
    <span className="relative flex w-1.5 h-1.5 shrink-0"><span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" /><span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" /></span>
    ({n}) raqib kutyapti
  </div>
);

export const GlobalBlitzCard: React.FC<{ className?: string; variant?: 'full' | 'banner' }> = ({ className = '', variant = 'full' }) => {
  const { realtimeOn } = useApp();
  const { accountId } = useApp();
  const waiters = useGbWaiters();
  const best = waiters[0]; // eng mos kutuvchi (o'z darajam, so'ng eng eskisi) — bosilganda shunga ulanadi
  const [share, setShare] = useState(getShareGhost());
  const [weekOpen, setWeekOpen] = useState(false);
  const [week, setWeek] = useState<GbWeekRow[] | null | undefined>(undefined);
  useEffect(() => {
    if (!weekOpen || week !== undefined) return;
    let alive = true;
    loadWeekly(10).then(r => alive && setWeek(r));
    return () => { alive = false; };
  }, [weekOpen, week]);
  if (!realtimeOn) return null;
  if (variant === 'banner') {
    // Bosh sahifa uchun ixcham qator: bir bosishda raqib qidiriladi
    return (
      <button type="button" onClick={() => { triggerHaptic('medium'); openGlobalBlitz(best?.id); }} className={`keep-dark relative w-full overflow-hidden rounded-2xl border border-sky-400/40 bg-gradient-to-br from-[#0B2238] via-[#13183A] to-[#0E1524] p-3.5 flex items-center gap-3 text-left shadow-lg shadow-sky-500/10 active:scale-[0.98] transition-all ${className}`}>
        <span className="pointer-events-none absolute -right-8 -top-10 w-28 h-28 rounded-full bg-sky-400/20 blur-2xl" aria-hidden />
        <div className="relative w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center text-slate-950 shrink-0"><Globe2 className="w-5 h-5" /></div>
        <div className="relative min-w-0 flex-1">
          <div className="text-sm font-extrabold text-white leading-tight">🌍 Global Blitz</div>
          <div className="text-[11px] text-slate-300 mt-0.5 truncate">Tasodifiy raqib · g‘alabaga XP</div>
          {waiters.length > 0 && <WaitingLine n={waiters.length} />}
        </div>
        <span className="relative shrink-0 h-9 px-3 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950 font-extrabold text-xs flex items-center gap-1">O‘ynash <ChevronRight className="w-3.5 h-3.5" /></span>
      </button>
    );
  }
  return (
    <div className={`keep-dark relative overflow-hidden rounded-2xl border border-sky-400/40 bg-gradient-to-br from-[#0B2238] via-[#13183A] to-[#0E1524] p-4 shadow-lg shadow-sky-500/10 ${className}`}>
      <span className="pointer-events-none absolute -right-10 -top-12 w-36 h-36 rounded-full bg-sky-400/20 blur-2xl" aria-hidden />
      <div className="relative flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center text-slate-950 shrink-0 shadow-md shadow-sky-500/30"><Globe2 className="w-6 h-6" /></div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-white leading-tight">🌍 Global Blitz</div>
          <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">Ilovadagi istalgan o‘yinchi bilan bellashing. Jonli raqib topilmasa — oldin o‘ynagan o‘yinchining natijasi bilan.</div>
        </div>
      </div>
      {waiters.length > 0 && <div className="relative mt-2.5"><WaitingLine n={waiters.length} /></div>}
      <button type="button" onClick={() => { triggerHaptic('medium'); openGlobalBlitz(best?.id); }} className="relative mt-3 w-full h-11 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-500/25 active:scale-[0.98] transition-all">
        <Crown className="w-4 h-4" /> Raqib topish <ChevronRight className="w-4 h-4" />
      </button>
      <label className="relative mt-2.5 flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
        <input type="checkbox" checked={share} onChange={e => { setShare(e.target.checked); setShareGhost(e.target.checked); }} className="accent-sky-400" />
        Natijam keyingi o‘yinchilarga raqib sifatida ko‘rsatilsin
      </label>
      <button type="button" onClick={() => { setWeekOpen(o => !o); if (weekOpen) setWeek(undefined); }} className="relative mt-2.5 w-full flex items-center justify-between text-[11px] font-bold text-sky-200">
        <span className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> Haftalik reyting (g‘alabalar)</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${weekOpen ? 'rotate-90' : ''}`} />
      </button>
      {weekOpen && (
        <div className="relative mt-1.5 rounded-xl bg-white/[0.06] border border-white/[0.12] p-2 space-y-1">
          {week === undefined ? <div className="py-2 text-center text-[11px] text-slate-300"><Loader2 className="w-4 h-4 animate-spin inline text-sky-300" /></div>
            : week === null ? <div className="py-2 text-center text-[11px] text-slate-300">Reytingni yuklab bo‘lmadi</div>
            : week.length === 0 ? <div className="py-2 text-center text-[11px] text-slate-300">Bu hafta hali hech kim g‘alaba qilmagan — birinchi bo‘ling!</div>
            : week.map((r, i) => (
              <div key={r.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] ${r.id === accountId ? 'bg-amber-400/15 border border-amber-400/30' : ''}`}>
                <span className="w-4 text-center font-black text-slate-300 tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate font-semibold text-white">{r.name}{r.id === accountId ? ' (siz)' : ''}</span>
                <span className="font-black text-emerald-300 tabular-nums">{r.w} 🏆</span>
                <span className="text-slate-400 tabular-nums">{r.p} o‘yin</span>
              </div>
            ))}
          <div className="text-center text-[10px] text-slate-400 pt-0.5">Hafta dushanba kuni yangilanadi</div>
        </div>
      )}
    </div>
  );
};
