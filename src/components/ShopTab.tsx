import React, { useEffect, useState } from 'react';
import { X, Music2, BookOpen, Sparkles, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATS, ShopCat, ShopItem, FRAMES, NICK_COLORS, NAME_SYMS, TITLES, SKINS, LTD_AVATARS, DEFAULT_BOOKS_TEXT, parseBooks } from '../data/shopDefaults';
import { priceOf } from '../services/shop';
import { lofi } from '../services/shop';
import { presetValue } from '../services/avatar';
import { triggerHaptic } from '../services/telegram';
import { CosAvatar, CosName } from './Cosmetics';
import { Avatar } from './Avatar';
import { nowMs } from '../services/time';

const Modal: React.FC<{ onClose: () => void; children: React.ReactNode; title?: string }> = ({ onClose, children, title }) => (
  <div className="fixed inset-0 z-[110] bg-black/80 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
    <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl bg-[#151C28] border border-slate-700 p-4 keep-dark-not" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-extrabold text-white">{title}</h3>
        <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300"><X className="w-4 h-4" /></button>
      </div>
      {children}
    </div>
  </div>
);

const ItemArt: React.FC<{ it: ShopItem; h?: number }> = ({ it, h = 84 }) =>
  it.img ? (
    <img src={it.img} alt="" className="w-full object-cover" style={{ height: h }} loading="lazy" referrerPolicy="no-referrer" />
  ) : (
    <div className="w-full flex items-center justify-center relative overflow-hidden" style={{ height: h, background: `linear-gradient(135deg, ${it.grad[0]}, ${it.grad[1]})` }}>
      <span className="absolute -left-4 -top-6 w-24 h-24 rounded-full bg-white/15" />
      <span className="text-4xl drop-shadow-lg relative">{it.icon}</span>
    </div>
  );

export const ShopTab: React.FC = () => {
  const { profile, coins, catalog, shopConf, buyItem, equip, owns, boostActive, updateProfile, setActiveTab } = useApp();
  const [cat, setCat] = useState<ShopCat | 'all'>('all');
  const [confirm, setConfirm] = useState<ShopItem | null>(null);
  const [result, setResult] = useState<{ it: ShopItem; reveal?: string } | null>(null);
  const [err, setErr] = useState('');
  const [equipOpen, setEquipOpen] = useState(false);
  const [booksOpen, setBooksOpen] = useState(false);
  const [lofiOn, setLofiOn] = useState(lofi.on);
  const [, setTick] = useState(0);

  useEffect(() => {
    const f = () => setLofiOn(lofi.on);
    lofi.listeners.add(f);
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => { lofi.listeners.delete(f); clearInterval(t); };
  }, []);

  if (!shopConf.enabled) return <div className="p-6 text-center text-slate-400 text-sm">Do'kon hozircha yopiq.</div>;

  const list = catalog.filter(i => cat === 'all' || i.cat === cat);
  const boostLeft = Math.max(0, (profile.boostUntil || 0) - nowMs());
  const fmtLeft = (ms: number) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} soat ${m % 60} daq` : `${m} daq`; };

  const doBuy = () => {
    if (!confirm) return;
    const r = buyItem(confirm.id);
    if (!r.ok) { setErr(r.error || ''); triggerHaptic('warning'); return; }
    setResult({ it: confirm, reveal: r.reveal });
    setConfirm(null);
    setErr('');
  };

  const action = (it: ShopItem) => {
    if (it.kind === 'books') setBooksOpen(true);
    else if (it.kind === 'lofi') { if (lofi.on) lofi.stop(); else lofi.start(shopConf.lofi); }
    else if (it.kind === 'pack') setActiveTab('home');
    else setEquipOpen(true);
  };
  const ownedLabel = (it: ShopItem) => it.kind === 'books' ? 'Ochish' : it.kind === 'lofi' ? (lofiOn ? "O'chirish" : 'Yoqish') : it.kind === 'pack' ? "O'rganish" : it.kind === 'verified' ? 'Faol ✓' : 'Jihozlash';

  const hasEquip = ['frame_gold', 'frame_fire', 'frame_crystal', 'skin_neon', 'skin_nature', 'skin_royal', 'titles', 'nickcolor', 'glow', 'rankbadge', 'avatars'].some(owns) || (profile.own || []).some(x => x.startsWith('av:'));

  return (
    <div className="space-y-4 pb-8">
      {/* Balans */}
      <div className="rounded-3xl p-4 bg-gradient-to-br from-amber-500/25 via-orange-500/10 to-rose-500/15 border border-amber-500/40 keep-dark">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-200/90">Mening tangalarim</div>
            <div className="text-3xl font-black text-amber-300 tabular-nums flex items-center gap-2">🪙 {coins.toLocaleString()}</div>
          </div>
          {hasEquip && (
            <button type="button" onClick={() => setEquipOpen(true)} className="px-3 py-2 rounded-xl bg-slate-900/60 border border-amber-500/40 text-xs font-bold text-amber-200 flex items-center gap-1.5 active:scale-95">
              <Sparkles className="w-4 h-4" /> Jihozlarim
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-300/80 mt-2 leading-snug">XP yig'ib, vazifalarni bajarib, streakni saqlab tanga toping. Har {Math.round(1 / Math.max(0.01, shopConf.coinPerXp))} XP ga ≈ 1 tanga.</p>
        {boostActive && <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-200 text-[11px] font-bold"><Zap className="w-3.5 h-3.5" /> 2x XP faol · {fmtLeft(boostLeft)} qoldi</div>}
      </div>

      {/* Bo'limlar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {CATS.map(c => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${cat === c.id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-[#151C28] text-slate-300 border-slate-800'}`}>{c.label}</button>
        ))}
      </div>

      {/* Mahsulotlar */}
      <div className="grid grid-cols-2 gap-3">
        {list.map(it => {
          const price = priceOf(it);
          const has = !it.repeat && owns(it.id);
          const can = coins >= price;
          return (
            <div key={it.id} className="rounded-2xl bg-[#151C28] border border-slate-800 overflow-hidden flex flex-col">
              <ItemArt it={it} />
              <div className="p-2.5 flex-1 flex flex-col">
                <div className="text-[13px] font-extrabold text-white leading-tight">{it.title}</div>
                <p className="text-[10.5px] text-slate-400 leading-snug mt-1 flex-1">{it.desc}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-sm font-black text-amber-400 tabular-nums">🪙 {price.toLocaleString()}</span>
                  {it.discount > 0 && <><span className="text-[10px] text-slate-500 line-through">{it.price.toLocaleString()}</span><span className="text-[9px] font-black px-1 rounded bg-rose-500 text-white">-{it.discount}%</span></>}
                </div>
                {has ? (
                  <button type="button" onClick={() => action(it)} className="mt-2 w-full py-2 rounded-xl text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 active:scale-95">{ownedLabel(it)}</button>
                ) : (
                  <button type="button" onClick={() => { setErr(''); setConfirm(it); }} className={`mt-2 w-full py-2 rounded-xl text-xs font-extrabold active:scale-95 ${can ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    {can ? 'Sotib olish' : 'Tanga yetmaydi'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!list.length && <p className="text-center text-xs text-slate-500">Bu bo'limda mahsulot yo'q</p>}

      {/* Tasdiqlash */}
      {confirm && (
        <Modal onClose={() => setConfirm(null)} title="Sotib olishni tasdiqlang">
          <div className="rounded-2xl overflow-hidden border border-slate-700"><ItemArt it={confirm} h={110} /></div>
          <div className="mt-3 text-sm font-extrabold text-white">{confirm.title}</div>
          <p className="text-xs text-slate-400 mt-1">{confirm.desc}</p>
          <div className="mt-3 rounded-xl bg-[#0E1524] border border-slate-800 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Narxi</span><b className="text-amber-400">🪙 {priceOf(confirm).toLocaleString()}</b></div>
            <div className="flex justify-between"><span className="text-slate-400">Balansingiz</span><b className="text-white">🪙 {coins.toLocaleString()}</b></div>
            <div className="flex justify-between"><span className="text-slate-400">Qoladi</span><b className="text-white">🪙 {Math.max(0, coins - priceOf(confirm)).toLocaleString()}</b></div>
          </div>
          {confirm.kind === 'manual' && <p className="text-[11px] text-sky-300 mt-2">Bu mahsulotni admin qo'lda beradi. Buyurtma yuboriladi va siz bilan bog'lanishadi.</p>}
          {err && <p className="text-xs text-rose-400 mt-2 font-semibold">{err}</p>}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button type="button" onClick={() => setConfirm(null)} className="py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold">Bekor qilish</button>
            <button type="button" onClick={doBuy} className="py-2.5 rounded-xl bg-amber-500 text-slate-950 text-sm font-extrabold active:scale-95">Sotib olish</button>
          </div>
        </Modal>
      )}

      {/* Natija */}
      {result && (
        <Modal onClose={() => setResult(null)} title={result.reveal ? '🎁 Sirli quti ochildi!' : '🎉 Xarid bajarildi!'}>
          <div className="text-center py-3">
            <div className="vb-pop inline-block text-6xl">{result.reveal ? '🎁' : result.it.icon}</div>
            <div className="mt-3 text-base font-extrabold text-white">{result.reveal || result.it.title}</div>
            <p className="text-xs text-slate-400 mt-1">{result.reveal ? 'Sovrin hisobingizga shu zahoti qo\'shildi.' : result.it.kind === 'manual' ? 'Buyurtmangiz adminga yuborildi.' : 'Mahsulot shu zahoti sizga berildi.'}</p>
          </div>
          <div className="grid gap-2">
            {!result.reveal && !result.it.repeat && ['frame', 'skin', 'titles', 'nickcolor', 'glow', 'rankbadge', 'avatars'].includes(result.it.kind) && (
              <button type="button" onClick={() => { setResult(null); setEquipOpen(true); }} className="py-2.5 rounded-xl bg-amber-500 text-slate-950 text-sm font-extrabold">Jihozlash</button>
            )}
            {!result.reveal && result.it.kind === 'books' && <button type="button" onClick={() => { setResult(null); setBooksOpen(true); }} className="py-2.5 rounded-xl bg-amber-500 text-slate-950 text-sm font-extrabold">Kitoblarni ochish</button>}
            {!result.reveal && result.it.kind === 'lofi' && <button type="button" onClick={() => { lofi.start(shopConf.lofi); setResult(null); }} className="py-2.5 rounded-xl bg-amber-500 text-slate-950 text-sm font-extrabold">🎧 Musiqani yoqish</button>}
            <button type="button" onClick={() => setResult(null)} className="py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold">Yopish</button>
          </div>
        </Modal>
      )}

      {/* Kitoblar */}
      {booksOpen && (
        <Modal onClose={() => setBooksOpen(false)} title="📚 Inglizcha TOP kitoblar">
          <div className="space-y-2">
            {parseBooks(shopConf.booksText || DEFAULT_BOOKS_TEXT).map((b, i) => (
              <div key={i} className="rounded-xl bg-[#0E1524] border border-slate-800 p-3">
                <div className="flex items-start gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-white leading-tight">{i + 1}. {b.title}</div>
                    <div className="text-[11px] text-slate-400">{b.author}{b.level ? ` · ${b.level}` : ''}</div>
                    {b.desc && <p className="text-[11px] text-slate-300 mt-1 leading-snug">{b.desc}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Jihozlar */}
      {equipOpen && (
        <Modal onClose={() => setEquipOpen(false)} title="✨ Jihozlarim">
          <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-[#0E1524] border border-slate-800">
            <CosAvatar src={profile.avatar} name={profile.name} size={52} cos={{ fr: profile.frame, rb: profile.rankBadge }} />
            <div className="min-w-0">
              <CosName name={profile.name} showTitle className="text-sm font-extrabold text-white" cos={{ nf: profile.nameFx, nc: profile.nameColor, ns: profile.nameSym, ti: profile.title, vf: owns('verified'), rb: profile.rankBadge }} />
            </div>
          </div>
          <EquipSection title="Ramka" show={['gold', 'fire', 'crystal'].some(f => owns(`frame_${f}`))}>
            <Chip on={!profile.frame} onClick={() => equip('frame', '')}>Yo'q</Chip>
            {Object.entries(FRAMES).filter(([k]) => owns(`frame_${k}`)).map(([k, f]) => <Chip key={k} on={profile.frame === k} onClick={() => equip('frame', k)}>{f.label}</Chip>)}
          </EquipSection>
          <EquipSection title="Ilova mavzusi" show={Object.keys(SKINS).some(k => owns(`skin_${k}`))}>
            <Chip on={!profile.skin} onClick={() => equip('skin', '')}>Standart</Chip>
            {Object.entries(SKINS).filter(([k]) => owns(`skin_${k}`)).map(([k, l]) => <Chip key={k} on={profile.skin === k} onClick={() => equip('skin', k)}>{l}</Chip>)}
          </EquipSection>
          <EquipSection title="Unvon" show={owns('titles')}>
            <Chip on={!profile.title} onClick={() => equip('title', '')}>Yo'q</Chip>
            {TITLES.map(t => <Chip key={t} on={profile.title === t} onClick={() => equip('title', t)}>{t}</Chip>)}
          </EquipSection>
          <EquipSection title="Nik rangi" show={owns('nickcolor')}>
            {NICK_COLORS.map(c => <button key={c} type="button" onClick={() => { equip('nameFx', ''); equip('nameColor', c); }} className={`w-8 h-8 rounded-full border-2 ${profile.nameColor === c && !profile.nameFx ? 'border-white scale-110' : 'border-transparent'}`} style={{ background: c }} aria-label={c} />)}
          </EquipSection>
          <EquipSection title="Ism yonidagi belgi" show={owns('nickcolor')}>
            {NAME_SYMS.map(sy => <Chip key={sy || 'x'} on={(profile.nameSym || '') === sy} onClick={() => equip('nameSym', sy)}>{sy || 'Yo\'q'}</Chip>)}
          </EquipSection>
          <EquipSection title="Yaltiroq ism" show={owns('glow')}>
            <Chip on={!profile.nameFx} onClick={() => equip('nameFx', '')}>Oddiy</Chip>
            <Chip on={profile.nameFx === 'gold'} onClick={() => equip('nameFx', 'gold')}>Oltin</Chip>
            <Chip on={profile.nameFx === 'rainbow'} onClick={() => equip('nameFx', 'rainbow')}>Kamalak</Chip>
          </EquipSection>
          <EquipSection title="Reytingdagi belgi" show={owns('rankbadge')}>
            <Chip on={!profile.rankBadge} onClick={() => equip('rankBadge', '')}>Yo'q</Chip>
            <Chip on={profile.rankBadge === 'star'} onClick={() => equip('rankBadge', 'star')}>⭐ Yulduzcha</Chip>
            <Chip on={profile.rankBadge === 'crown'} onClick={() => equip('rankBadge', 'crown')}>👑 Toj</Chip>
          </EquipSection>
          <EquipSection title="Noyob avatarlar" show={owns('avatars') || (profile.own || []).some(x => x.startsWith('av:'))}>
            {LTD_AVATARS.filter(a => owns('avatars') || owns(`av:${a.id}`)).map(a => (
              <button key={a.id} type="button" onClick={() => updateProfile({ avatar: presetValue(a.id), customAvatar: true })} className={`w-12 h-12 rounded-full p-0.5 border-2 ${profile.avatar === presetValue(a.id) ? 'border-amber-400' : 'border-transparent'}`}>
                <Avatar src={presetValue(a.id)} name={a.id} className="w-full h-full" />
              </button>
            ))}
          </EquipSection>
          {owns('lofi') && (
            <button type="button" onClick={() => (lofi.on ? lofi.stop() : lofi.start(shopConf.lofi))} className="mt-2 w-full py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 text-sm font-bold flex items-center justify-center gap-2"><Music2 className="w-4 h-4" /> {lofiOn ? "Lo-Fi musiqani o'chirish" : 'Lo-Fi musiqani yoqish'}</button>
          )}
        </Modal>
      )}
    </div>
  );
};

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${on ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-[#0E1524] text-slate-300 border-slate-700'}`}>{children}</button>
);
const EquipSection: React.FC<{ title: string; show: boolean; children: React.ReactNode }> = ({ title, show, children }) =>
  show ? (
    <div className="mb-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{title}</div>
      <div className="flex flex-wrap gap-2 items-center">{children}</div>
    </div>
  ) : null;
