import React, { useState } from 'react';
import { Ticket, X, Sparkles, Gift, CheckCircle2, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerHaptic, getTelegramWebApp } from '../services/telegram';

interface PromoModalProps {
  initialCode?: string;
  onClose: () => void;
}

export const PromoModal: React.FC<PromoModalProps> = ({ initialCode = '', onClose }) => {
  const { profile, accountId, claimGrants } = useApp();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [claimedRewards, setClaimedRewards] = useState<any>(null);

  const handleClaim = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return setErr('Promokodni kiriting');
    setBusy(true);
    setErr('');

    try {
      const res = await fetch('/api/fn/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claimPromo',
          code: cleanCode,
          uid: accountId,
          initData: getTelegramWebApp()?.initData || '',
          name: profile.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Promokod xato yoki muddati tugagan');

      triggerHaptic('success');
      setClaimedRewards(data.gifts || {});
      // Sovg'alarni profilga o'zlashtirish
      setTimeout(() => {
        claimGrants();
      }, 500);
    } catch (e: any) {
      triggerHaptic('error');
      setErr(e.message || 'Promokod aktivlashtirilmadi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm bg-[#111726] border border-amber-500/40 rounded-3xl p-5 shadow-2xl overflow-hidden">
        {/* Yuqori orqa fon nur */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {claimedRewards ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-bounce">
              <Gift className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Tabriklaymiz! 🎉</h3>
              <p className="text-xs text-slate-300 mt-1">Sovg&apos;angiz muvaffaqiyatli berildi:</p>
            </div>

            <div className="rounded-2xl bg-[#0B0F17] border border-amber-500/30 p-3.5 space-y-2 text-left">
              {claimedRewards.xp > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                  <span>💎 XP bonusi:</span>
                  <span>+{claimedRewards.xp} XP</span>
                </div>
              )}
              {claimedRewards.spins > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span>🎡 Baraban aylantirish:</span>
                  <span>+{claimedRewards.spins} ta</span>
                </div>
              )}
              {claimedRewards.vipHours > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                  <span>👑 VIP maqomi:</span>
                  <span>{claimedRewards.vipHours} soat</span>
                </div>
              )}
              {claimedRewards.coins > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-yellow-300">
                  <span>🪙 Tangalar:</span>
                  <span>+{claimedRewards.coins.toLocaleString()}</span>
                </div>
              )}
              {claimedRewards.streakSaver > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                  <span>❄️ Streak muzlatgich:</span>
                  <span>+{claimedRewards.streakSaver} ta</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-extrabold text-sm active:scale-95 transition-transform"
            >
              Ajoyib, rahmat!
            </button>
          </div>
        ) : (
          <form onSubmit={handleClaim} className="space-y-4 pt-2">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-2">
                <Ticket className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Promokodni kiriting</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Telegram kanal yoki guruhlarda e&apos;lon qilingan maxsus kodni kiriting va sovg&apos;ani oling!
              </p>
            </div>

            <div className="space-y-1">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="MASALAN: START2026"
                className="w-full px-4 py-3 rounded-2xl bg-[#0B0F17] border border-slate-700 text-center text-sm font-black text-amber-400 tracking-widest placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors uppercase"
                autoFocus
              />
              {err && <div className="text-[11px] text-rose-400 font-bold text-center pt-1">{err}</div>}
            </div>

            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {busy ? (
                'Tekshirilmoqda...'
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Sovg&apos;ani olish
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
