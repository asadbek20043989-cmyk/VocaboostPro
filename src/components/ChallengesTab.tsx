import React, { useState } from 'react';
import { Flag, Clock, Users, Trophy, Gift, Check, BookMarked, Heart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Challenge, DuelMetric } from '../types';
import { Avatar } from './Avatar';
import { triggerHaptic } from '../services/telegram';
import { nowMs } from '../services/time';

const UNIT: Record<DuelMetric, string> = { xp: 'XP', words: 'so‘z', mastered: 'so‘z' };
const LABEL: Record<DuelMetric, string> = { xp: 'XP yig‘ish', words: 'Yangi so‘zlar o‘rganish', mastered: 'So‘zlarni yodlash' };
const kindLabel = (c: Challenge) => (c.kind === 'survival' ? 'Marafon · 3 jon' : c.kind === 'themed' ? 'Mavzuli chellenj' : LABEL[c.metric]);
const unitOf = (c: Challenge) => (c.kind === 'survival' ? 'so‘z' : c.kind === 'themed' ? 'ball' : UNIT[c.metric]);

const span = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d} kun ${h} soat` : h > 0 ? `${h} soat ${m % 60} daq` : `${m} daq`;
};
const dateStr = (ms: number) => new Date(ms + 5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');

const Card: React.FC<{ c: Challenge; meId: string }> = ({ c, meId }) => {
  const { joinChallenge, openSurvival, openLearn } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const t = nowMs();
  const upcoming = t < c.startsAt;
  const ended = t >= c.endsAt || c.finalized;
  const unit = unitOf(c);
  const max = Math.max(1, c.goal || 0, ...c.players.map(p => p.gain));
  const join = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await joinChallenge(c.id);
      if (!r.ok) setErr(r.error || 'Xatolik');
    } catch {
      setErr('Qo‘shilib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring');
    } finally {
      setBusy(false); // tugma hech qachon "Qo‘shilmoqda…" holatida qotib qolmaydi
    }
  };
  const top = c.players.slice(0, 10);
  const myRank = c.players.findIndex(p => p.id === meId) + 1;
  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#1B2433] to-[#121822] border border-slate-800 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold text-amber-400 uppercase tracking-wider"><Flag className="w-3.5 h-3.5" /> {kindLabel(c)}</div>
          <h3 className="text-base font-extrabold text-white mt-0.5">{c.title}</h3>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${ended ? 'bg-slate-800 text-slate-400 border-slate-700' : upcoming ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
          <Clock className="w-3 h-3" /> {ended ? 'Tugadi' : upcoming ? `${span(c.startsAt - t)} dan so‘ng` : `${span(c.endsAt - t)} qoldi`}
        </span>
      </div>
      {c.desc && <p className="text-xs text-slate-300 leading-relaxed">{c.desc}</p>}
      <div className="text-[11px] text-slate-400">{dateStr(c.startsAt)} → {dateStr(c.endsAt)} (Toshkent vaqti)</div>
      {c.prize && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200"><Gift className="w-4 h-4 shrink-0 mt-0.5" /> <span><b>Sovrin:</b> {c.prize}</span></div>
      )}
      {c.goal > 0 && c.joined && (
        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1"><span>Maqsad: {c.goal} {unit}</span><span className="font-bold text-white tabular-nums">{Math.min(c.myGain, c.goal)} / {c.goal}</span></div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(100, Math.round((c.myGain / c.goal) * 100))}%` }} /></div>
          {c.myGain >= c.goal && <div className="text-[11px] text-emerald-400 font-bold mt-1 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Maqsadga erishdingiz!</div>}
        </div>
      )}
      {c.kind === 'themed' && (
        <div className="rounded-xl bg-sky-500/10 border border-sky-500/30 px-3 py-2 text-xs text-sky-200 flex items-center gap-2">
          <BookMarked className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0"><b>{c.packTitle || 'Lug‘at to‘plami'}</b>{c.packTotal ? ` · ${c.packTotal} ta so‘z` : ''}<br /><span className="text-[11px] text-sky-300/80">So‘zni o‘rganish — 1 ball, yodlash — yana +1 ball</span></span>
          {c.packId && !ended && !upcoming && c.joined && (
            <button type="button" onClick={() => { triggerHaptic('medium'); openLearn(c.packId); }} className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-extrabold active:scale-95 transition-all">O‘rganish</button>
          )}
        </div>
      )}
      {c.kind === 'survival' && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-100 space-y-2">
          <div className="flex items-start gap-2"><Heart className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" /> <span>Cheksiz savollar, atigi <b>{c.lives} ta jon</b>. Har bir so‘z tarjimasiga <b>{c.secs} soniya</b> beriladi: vaqt tugasa yoki jonlar tugasa o‘yin tugaydi, topilgan so‘zlar soni hisoblanadi. <b>Har kimga faqat 1 ta urinish.</b></span></div>
          {!ended && !upcoming && !c.myStarted && (
            <button type="button" disabled={busy} onClick={async () => { triggerHaptic('heavy'); if (!window.confirm('Marafonni boshlaysizmi? Faqat 1 ta urinish beriladi.')) return; setBusy(true); setErr(''); try { const r = await openSurvival(c.id); if (!r.ok) setErr(r.error || 'Xatolik'); } catch { setErr('Boshlab bo‘lmadi. Internetni tekshiring'); } finally { setBusy(false); } }} className="w-full h-12 rounded-xl bg-rose-500 text-white font-extrabold text-sm disabled:opacity-60 active:scale-[0.98] transition-all">{busy ? 'Yuklanmoqda…' : 'Marafonni boshlash'}</button>
          )}
          {c.myStarted && <div className="text-[12px] font-bold text-emerald-300">✅ Urinishingiz yakunlandi · natija: {c.myGain} {unit}</div>}
        </div>
      )}
      {!ended && !c.joined && c.kind !== 'survival' && (
        <button type="button" disabled={busy} onClick={() => { triggerHaptic('medium'); join(); }} className="w-full h-12 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-sm disabled:opacity-60 active:scale-[0.98] transition-all">
          {busy ? 'Qo‘shilmoqda…' : upcoming ? 'Qatnashish (oldindan)' : 'Qatnashish'}
        </button>
      )}
      {err && <div className="text-xs text-rose-300">{err}</div>}
      {c.joined && !ended && c.kind !== 'survival' && <div className="text-[11px] text-emerald-400 font-semibold">✅ Siz qatnashyapsiz{myRank ? ` · hozirgi o‘rningiz: ${myRank}` : ''}</div>}
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><Users className="w-3.5 h-3.5" /> {c.players.length} ishtirokchi</div>
      {top.length > 0 && (
        <div className="space-y-1.5">
          {top.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${p.id === meId ? 'bg-amber-500/10 border-amber-500/50' : 'bg-[#151C28] border-slate-800'}`}>
              <span className="w-5 text-center text-xs font-bold text-slate-400">{i === 0 && p.gain > 0 ? <Trophy className="w-4 h-4 text-amber-400 mx-auto" /> : i + 1}</span>
              <Avatar src={p.avatar} name={p.name} className="w-8 h-8" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{p.name}{p.id === meId ? ' (Siz)' : ''}</div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${i === 0 ? 'bg-amber-400' : 'bg-sky-500'} transition-all duration-700`} style={{ width: `${Math.round((p.gain / max) * 100)}%` }} /></div>
              </div>
              <div className="text-sm font-extrabold text-amber-400 tabular-nums">+{p.gain} <span className="text-[10px] text-slate-400 font-medium">{unit}</span></div>
            </div>
          ))}
        </div>
      )}
      {c.finalized && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-center text-xs font-bold text-emerald-300">🏆 Natijalar e‘lon qilindi. Barcha ishtirokchilarga sertifikat berildi — Telegram chatingizni tekshiring.</div>}
    </section>
  );
};

export const ChallengesTab: React.FC = () => {
  const { challenges, accountId, realtimeOn, challengesLive } = useApp();
  if (!realtimeOn) return <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-5 text-sm text-slate-400">Chellenjlar uchun jonli baza (Firebase) ulangan bo‘lishi kerak.</div>;
  const t = nowMs();
  const live = challenges.filter(c => !c.finalized && t < c.endsAt);
  const past = challenges.filter(c => c.finalized || t >= c.endsAt);
  return (
    <div className="space-y-4">
      {challenges.length === 0 && !challengesLive && (
        <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-6 text-center space-y-2">
          <div className="text-4xl animate-pulse">🏁</div>
          <div className="text-sm font-bold text-white">Chellenjlar yuklanmoqda…</div>
          <p className="text-xs text-slate-400">Aloqa sekin bo‘lsa, bir necha soniya kuting.</p>
        </div>
      )}
      {challenges.length === 0 && challengesLive && (
        <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-6 text-center space-y-2">
          <div className="text-4xl">🏁</div>
          <div className="text-sm font-bold text-white">Hozircha chellenj yo‘q</div>
          <p className="text-xs text-slate-400">Yangi chellenj yoki marafon e‘lon qilinganda shu yerda paydo bo‘ladi.</p>
        </div>
      )}
      {live.map(c => <Card key={c.id} c={c} meId={accountId} />)}
      {past.length > 0 && <div className="text-xs text-slate-400 font-semibold uppercase px-1 pt-1">Tugagan chellenjlar</div>}
      {past.map(c => <Card key={c.id} c={c} meId={accountId} />)}
    </div>
  );
};
