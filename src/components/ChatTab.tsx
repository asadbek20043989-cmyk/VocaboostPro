import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Flag, RefreshCw, ArrowDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { subscribe, getJson, realtimeEnabled, dbReadMode } from '../services/realtime';
import { CHAT_PATH, CHAT_CFG_PATH, ChatMsg, ChatCfg, DEFAULT_CHAT_CFG, parseChatCfg, toChatList, sendChat, reportChat } from '../services/chat';
import { triggerHaptic } from '../services/telegram';
import { CosAvatar, CosName } from './Cosmetics';

const timeOf = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayOf = (ts: number) => new Date(ts).toDateString();
const dayLabel = (ts: number) => {
  const d = new Date(ts);
  const t = new Date();
  const y = new Date(Date.now() - 86400000);
  if (d.toDateString() === t.toDateString()) return 'Bugun';
  if (d.toDateString() === y.toDateString()) return 'Kecha';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long' });
};

export const ChatTab: React.FC = () => {
  const { accountId, leagueUsers, isTelegram } = useApp();
  const [raw, setRaw] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(true);
  const [cfg, setCfg] = useState<ChatCfg>(DEFAULT_CHAT_CFG);
  const [sent, setSent] = useState<ChatMsg[]>([]); // yuborilgan, lekin jonli oqimda hali ko'rinmagan o'z xabarlarim
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [selected, setSelected] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [away, setAway] = useState(false); // pastdan uzoqlashgan — yangi xabarlar tugmasi uchun
  const boxRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastCount = useRef(0);

  // Jonli obuna faqat chat ochiq turganda ishlaydi (Liga ichidan chiqilsa uziladi — ulanishlar tejaladi)
  useEffect(() => {
    const off = subscribe(
      CHAT_PATH,
      v => {
        setRaw(v);
        setLoaded(true);
      },
      setLive,
    );
    return off;
  }, []);

  // Sozlamalar (yoqilgan/o'chirilgan, uzunlik, qoidalar) — bir marta olinadi
  useEffect(() => {
    let dead = false;
    getJson(CHAT_CFG_PATH)
      .then(v => !dead && setCfg(parseChatCfg(v)))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, []);

  const list = useMemo(() => {
    const base = toChatList(raw);
    const have = new Set(base.map(m => m.id));
    const extra = sent.filter(m => !have.has(m.id));
    return extra.length ? [...base, ...extra].sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1)) : base;
  }, [raw, sent]);

  // Jonli oqimga yetib kelgan xabarlarni "yuborilgan" ro'yxatdan olib tashlaymiz
  useEffect(() => {
    if (!sent.length || !raw) return;
    const left = sent.filter(m => !raw[m.id]);
    if (left.length !== sent.length) setSent(left);
  }, [raw, sent]);

  // Boshqa foydalanuvchilarning bezaklari (ramka, ism rangi) — ligadagi yozuvdan
  const byId = useMemo(() => {
    const m = new Map<string, (typeof leagueUsers)[number]>();
    leagueUsers.forEach(u => m.set(u.id, u));
    return m;
  }, [leagueUsers]);

  const scrollDown = useCallback((smooth = false) => {
    const el = boxRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    stick.current = true;
    setAway(false);
  }, []);

  useEffect(() => {
    const grew = list.length > lastCount.current;
    const lastIsMine = list.length > 0 && list[list.length - 1].uid === accountId;
    if (stick.current || (grew && lastIsMine)) scrollDown();
    else if (grew) setAway(true);
    lastCount.current = list.length;
  }, [list, accountId, scrollDown]);

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = near;
    if (near) setAway(false);
  };

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setErr('');
    setInfo('');
    try {
      const msg = await sendChat(accountId, t);
      triggerHaptic('light');
      setText('');
      if (msg) setSent(s => [...s, msg]);
      stick.current = true;
    } catch (e: any) {
      triggerHaptic('error');
      setErr(String(e?.message || 'Yuborib bo‘lmadi'));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    triggerHaptic('selection');
    try {
      setRaw(await getJson(CHAT_PATH));
      setLoaded(true);
    } catch {
      setErr('Yangilab bo‘lmadi. Internetni tekshiring');
    }
  };

  const report = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId('');
    setSelected('');
    try {
      const hidden = await reportChat(accountId, id);
      setInfo(hidden ? 'Shikoyat qabul qilindi, xabar yashirildi' : 'Shikoyat qabul qilindi. Rahmat!');
      setErr('');
    } catch (e: any) {
      setErr(String(e?.message || 'Shikoyat yuborilmadi'));
    }
  };

  const slowProxy = realtimeEnabled && dbReadMode() === 'proxy';
  const disabled = !cfg.enabled;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <span className={`inline-block w-2 h-2 rounded-full ${live && realtimeEnabled ? 'bg-emerald-400' : 'bg-slate-500 animate-pulse'}`} />
          {!realtimeEnabled ? 'Chat sozlanmagan' : live ? 'Umumiy chat · jonli' : 'Ulanmoqda…'}
        </div>
        <button type="button" onClick={refresh} className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-800 flex items-center justify-center" aria-label="Yangilash" title="Yangilash">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {cfg.rules && <p className="text-[11px] leading-snug text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">📌 {cfg.rules}</p>}
      {slowProxy && <p className="text-[11px] text-slate-500 px-1">Aloqa sekin rejimda: yangi xabarlar ko‘rinishi uchun yangilash tugmasini bosing.</p>}

      <div className="relative">
        <div ref={boxRef} onScroll={onScroll} className="h-[52vh] min-h-[280px] max-h-[520px] overflow-y-auto overscroll-contain rounded-2xl bg-[#151C28] border border-slate-800 p-3 space-y-2">
          {!loaded && <p className="text-center text-xs text-slate-500 py-10">Yuklanmoqda…</p>}
          {loaded && list.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Hali xabar yo‘q. Birinchi bo‘ling! 👋</p>}
          {list.map((m, i) => {
            const mine = m.uid === accountId;
            const prev = list[i - 1];
            const newDay = !prev || dayOf(prev.ts) !== dayOf(m.ts);
            const grouped = !!prev && !newDay && prev.uid === m.uid && m.ts - prev.ts < 120000;
            const u = byId.get(m.uid);
            const open = selected === m.id;
            return (
              <React.Fragment key={m.id}>
                {newDay && <div className="text-center text-[10px] font-semibold text-slate-500 py-1">{dayLabel(m.ts)}</div>}
                <div className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''} ${grouped ? 'mt-0.5' : ''}`}>
                  <div className="w-8 shrink-0">{!mine && !grouped && <CosAvatar src={u?.avatar} name={m.name} cos={u?.cos} size={32} className="w-8 h-8" />}</div>
                  <div className={`max-w-[78%] min-w-0 flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && !grouped && (
                      <div className="flex items-center gap-1.5 mb-0.5 px-1 min-w-0">
                        <span className="text-[11px] font-bold truncate">
                          <CosName name={m.name} cos={u?.cos} />
                        </span>
                        {m.lv && <span className="text-[9px] font-bold text-slate-400 bg-slate-800 rounded px-1 py-px">{m.lv}</span>}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (mine) return;
                        setSelected(open ? '' : m.id);
                        setConfirmId('');
                      }}
                      className={`text-left text-[13px] leading-snug px-3 py-1.5 rounded-2xl break-words whitespace-pre-wrap max-w-full ${
                        mine ? 'bg-amber-500 text-slate-950 rounded-br-md cursor-default' : 'bg-slate-800 text-slate-100 rounded-bl-md'
                      }`}
                    >
                      {m.text}
                    </button>
                    <div className="flex items-center gap-2 px-1 mt-0.5">
                      <span className="text-[9px] text-slate-500">{timeOf(m.ts)}</span>
                      {open && !mine && (
                        <button type="button" onClick={() => report(m.id)} className={`text-[10px] font-semibold flex items-center gap-1 ${confirmId === m.id ? 'text-red-400' : 'text-slate-400'}`}>
                          <Flag className="w-3 h-3" />
                          {confirmId === m.id ? 'Tasdiqlash' : 'Shikoyat'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {away && (
          <button type="button" onClick={() => scrollDown(true)} className="absolute bottom-3 right-3 flex items-center gap-1 text-[11px] font-bold bg-amber-500 text-slate-950 rounded-full px-3 py-1.5 shadow-lg">
            <ArrowDown className="w-3.5 h-3.5" /> Yangi xabarlar
          </button>
        )}
      </div>

      {err && <p className="text-[11px] text-red-400 px-1">{err}</p>}
      {info && <p className="text-[11px] text-emerald-400 px-1">{info}</p>}
      {!isTelegram && realtimeEnabled && <p className="text-[11px] text-slate-500 px-1">Xabar yozish uchun ilovani Telegram orqali oching.</p>}

      {disabled ? (
        <p className="text-center text-xs text-slate-400 bg-[#151C28] border border-slate-800 rounded-2xl py-3">Chat vaqtincha o‘chirilgan.</p>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <textarea
              value={text}
              onChange={e => {
                setText(e.target.value.slice(0, cfg.maxLen));
                if (err) setErr('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && window.matchMedia?.('(hover: hover)').matches) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              maxLength={cfg.maxLen}
              placeholder="Xabar yozing…"
              className="w-full resize-none rounded-2xl bg-[#151C28] border border-slate-800 px-3 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 max-h-28"
            />
            {text.length > cfg.maxLen * 0.8 && <div className="text-right text-[10px] text-slate-500 px-1">{text.length}/{cfg.maxLen}</div>}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            aria-label="Yuborish"
            className="shrink-0 w-10 h-10 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
