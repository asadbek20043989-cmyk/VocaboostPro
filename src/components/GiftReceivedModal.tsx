import React from 'react';
import { Gift, X, Sparkles, Diamond, RotateCw, Crown, Coins, Shield } from 'lucide-react';
import { triggerHaptic } from '../services/telegram';
import { t as tt } from '../services/i18n';

export interface ReceivedGrantItem {
  type: string;
  amount: number;
  note?: string;
  validHours?: number;
}

interface GiftReceivedModalProps {
  items: ReceivedGrantItem[];
  onClose: () => void;
}

export const GiftReceivedModal: React.FC<GiftReceivedModalProps> = ({ items, onClose }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'xp':
        return <Diamond className="w-5 h-5 text-amber-400" />;
      case 'spins':
        return <RotateCw className="w-5 h-5 text-emerald-400" />;
      case 'vip':
        return <Crown className="w-5 h-5 text-purple-400" />;
      case 'coins':
        return <Coins className="w-5 h-5 text-yellow-400" />;
      default:
        return <Shield className="w-5 h-5 text-sky-400" />;
    }
  };

  const getTitle = (item: ReceivedGrantItem) => {
    switch (item.type) {
      case 'xp':
        return `+${item.amount} XP`;
      case 'spins':
        return `+${item.amount} ta baraban aylantirish`;
      case 'vip':
        return `${item.amount} soatlik VIP maqomi`;
      case 'coins':
        return `+${item.amount.toLocaleString()} tanga`;
      default:
        return item.note || "Maxsus sovg'a";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="keep-dark relative w-full max-w-sm bg-gradient-to-b from-[#182033] to-[#0E1524] border-2 border-amber-500/50 rounded-3xl p-5 shadow-2xl text-center overflow-hidden">
        {/* Orqa fon nur */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/25 rounded-full blur-3xl pointer-events-none" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="py-2 space-y-3">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-400 to-rose-500 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 animate-bounce">
            <Gift className="w-10 h-10" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[11px] font-black uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Sovg&apos;a qabul qilindi!
            </div>
            <h3 className="text-xl font-black text-white">{tt("Sizga sovg'a berildi! 🎁")}</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Admin tomonidan hisobingizga quyidagi sovg&apos;alar o&apos;tkazildi:
            </p>
          </div>

          <div className="rounded-2xl bg-[#090D15]/90 border border-slate-800 p-3 space-y-2 text-left my-3">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    {getIcon(it.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{getTitle(it)}</div>
                    {it.note && <div className="text-[10px] text-slate-400 truncate">{it.note}</div>}
                  </div>
                </div>
                {it.validHours && it.validHours > 0 ? (
                  <span className="text-[10px] text-amber-400 font-semibold shrink-0">
                    {it.validHours >= 24 ? Math.round(it.validHours / 24) + ' kun' : it.validHours + ' soat'}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onClose();
            }}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm active:scale-95 transition-all shadow-lg shadow-amber-500/25"
          >
            Sovg&apos;ani qabul qilish 🚀
          </button>
        </div>
      </div>
    </div>
  );
};
