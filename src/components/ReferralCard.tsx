import React, { useState } from 'react';
import { Users, Copy, Send, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { shareUrl, triggerHaptic } from '../services/telegram';
import { DEFAULT_SHARE_TEXT } from '../services/shop';

/** Profil ichidagi «Do'stlarni taklif qilish»: shaxsiy havola, ulashish va taklif qilinganlar soni */
export const ReferralCard: React.FC = () => {
  const { inviteLink, refCount, refInfo, refLeague, accountId } = useApp();
  const [copied, setCopied] = useState(false);
  if (!refInfo.enabled) return null;
  const text = refInfo.shareText || DEFAULT_SHARE_TEXT;
  const rank = refLeague.findIndex(u => u.id === accountId) + 1;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = inviteLink; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    triggerHaptic('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="p-4 rounded-3xl bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-fuchsia-500/15 border border-sky-500/40 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0"><Users className="w-5 h-5 text-sky-300" /></div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-white">Do'stlarni taklif qilish</div>
          <div className="text-[11px] text-slate-300 leading-snug">Havolangiz orqali botga start bosgan har bir do'st uchun <b className="text-amber-300">+{refInfo.xp} XP</b> olasiz.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-[#0E1524] border border-slate-800 py-2"><div className="text-lg font-black text-emerald-400 tabular-nums">{refCount}</div><div className="text-[10px] text-slate-400">Taklif qilinganlar</div></div>
        <div className="rounded-xl bg-[#0E1524] border border-slate-800 py-2"><div className="text-lg font-black text-amber-400 tabular-nums">{refCount * refInfo.xp}</div><div className="text-[10px] text-slate-400">Olingan XP</div></div>
      </div>
      {inviteLink ? (
        <>
          <div className="rounded-xl bg-[#0E1524] border border-slate-700 px-3 py-2 text-[11px] text-sky-300 font-mono break-all select-all">{inviteLink}</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={copy} className="py-2.5 rounded-xl bg-[#151C28] border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 active:scale-95">
              {copied ? <><Check className="w-4 h-4 text-emerald-400" /> Nusxalandi</> : <><Copy className="w-4 h-4" /> Nusxalash</>}
            </button>
            <button type="button" onClick={() => shareUrl(inviteLink, text)} className="py-2.5 rounded-xl bg-sky-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95"><Send className="w-4 h-4" /> Do'stga yuborish</button>
          </div>
          {rank > 0 && <div className="text-[11px] text-center text-slate-400">Targ'ibotchilar reytingida: <b className="text-amber-300">#{rank}</b></div>}
        </>
      ) : (
        <p className="text-[11px] text-slate-400">Shaxsiy havola faqat Telegram ichida ishlaydi. Ilovani Telegram orqali oching.</p>
      )}
    </div>
  );
};
