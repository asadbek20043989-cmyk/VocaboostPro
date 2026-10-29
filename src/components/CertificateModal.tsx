import React, { useEffect, useRef, useState } from 'react';
import { Download, X, Share2, Send, Link2, Sparkles } from 'lucide-react';
import { Certificate } from '../types';
import { triggerHaptic, shareUrl, shareToTelegramStory, canShareToStory, getTelegramWebApp } from '../services/telegram';
import { drawCertificate, certFileName, certificateBase64, certUrl, TEMPLATES } from '../services/certificate';
import { botSendCertificate, canUseBot } from '../services/bot';

export { TEMPLATES };

export const CertificateModal: React.FC<{ cert: Certificate; onClose: () => void }> = ({ cert, onClose }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inTg = canUseBot();

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let dead = false;
    drawCertificate(c, cert).then(() => {
      if (!dead) setUrl(c.toDataURL('image/png'));
    });
    return () => {
      dead = true;
    };
  }, [cert]);

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 4500);
  };

  // Telegram ichida brauzer "yuklab olish" ishlamaydi — fayl bot orqali chatga yuboriladi
  const sendToChat = async (kind: 'photo' | 'document') => {
    if (busy) return;
    setBusy(true);
    triggerHaptic('medium');
    try {
      const image = await certificateBase64(cert);
      await botSendCertificate({ id: cert.id, title: cert.title, date: cert.date, image, kind });
      triggerHaptic('success');
      flash(kind === 'document' ? '✅ Fayl Telegram chatingizga yuborildi — u yerdan saqlab olishingiz mumkin' : '✅ Sertifikat Telegram chatingizga yuborildi');
    } catch (e: any) {
      triggerHaptic('error');
      flash(`Yuborib bo'lmadi: ${e?.message || 'xato'}. Botni ochib /start bosing va qayta urinib ko'ring.`);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (inTg) return void sendToChat('document');
    triggerHaptic('medium');
    const a = document.createElement('a');
    a.href = ref.current!.toDataURL('image/png');
    a.download = certFileName(cert);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const shareText = `🎓 VocaBoost'da "${cert.title}" sertifikatini oldim! Siz ham so'zlarni tez yodlang 🚀`;
  const share = () => {
    triggerHaptic('light');
    if (inTg) {
      // Telegram: matn + ilova havolasini istalgan chatga ulashish oynasi (rasmning o'zi chatdagi xabardan uzatiladi)
      if (!shareUrl(certUrl(cert.id), shareText)) flash('Ulashib bo‘lmadi');
      return;
    }
    ref.current!.toBlob(async b => {
      if (!b) return;
      const f = new File([b], certFileName(cert), { type: 'image/png' });
      try {
        if ((navigator as any).canShare?.({ files: [f] })) await (navigator as any).share({ files: [f], text: shareText });
        else if ((navigator as any).share) await (navigator as any).share({ text: shareText, url: certUrl(cert.id) });
        else {
          await navigator.clipboard?.writeText(`${shareText} ${certUrl(cert.id)}`);
          flash('Matn nusxalandi');
        }
      } catch {
        /* bekor qilindi */
      }
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-3xl mx-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">🎓 Sertifikat</h3>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-[#151C28] border border-slate-800 flex items-center justify-center" aria-label="Yopish"><X className="w-4 h-4" /></button>
        </div>
        <canvas ref={ref} className="hidden" />
        {url ? (
          <img src={url} alt="Sertifikat" className={`w-full rounded-2xl border border-amber-500/30 ${cert.fmt === 'story' ? 'max-w-sm mx-auto' : ''}`} />
        ) : (
          <div className={`rounded-2xl bg-[#151C28] animate-pulse ${cert.fmt === 'story' ? 'aspect-[9/16] max-w-sm mx-auto' : 'aspect-[1754/1240]'}`} />
        )}
        <p className="text-[11px] text-slate-400 text-center">
          {inTg ? 'Sertifikatingiz bot orqali Telegram chatingizga ham yuboriladi.' : 'Yuklab olinmasa, rasmni bosib turib saqlang.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy || !url} onClick={download} className="h-12 rounded-xl bg-amber-500 disabled:opacity-60 text-slate-950 font-bold text-sm flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> {inTg ? (busy ? 'Yuborilmoqda…' : 'Faylni chatga') : 'Yuklab olish'}
          </button>
          <button type="button" disabled={!url} onClick={share} className="h-12 rounded-xl bg-[#1B2433] border border-slate-700 disabled:opacity-60 font-bold text-sm flex items-center justify-center gap-2">
            <Share2 className="w-4 h-4" /> Ulashish
          </button>
        </div>
        <button
          type="button"
          disabled={!url}
          onClick={async () => {
            triggerHaptic('medium');
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const certImageUrl = `${origin}/api/fn/cert?id=${encodeURIComponent(cert.id)}&image=1`;

            // Stories uchun HAR DOIM 9:16 (tik) rasm tayyorlanadi — kichrayib qolmaydi. Server keshiga bitta sertifikat uchun
            // FAQAT BIR MARTA yuboriladi (qayta bosilganda Netlify funksiyasi va Firebase yozuvi sarflanmaydi).
            try {
              const flag = `vb_story_up_${cert.id}`;
              if (!localStorage.getItem(flag)) {
                const imageB64 = await certificateBase64({ ...cert, fmt: 'story' });
                const rr = await fetch('/api/fn/cert', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'storeImage', id: cert.id, image: imageB64 }),
                });
                if (rr.ok) localStorage.setItem(flag, '1');
              }
            } catch {
              /* ignore */
            }

            const success = shareToTelegramStory(
              certImageUrl,
              `🎓 Men VocaBoost'da "${cert.title}" sertifikatini oldim! Siz ham so'zlarni tez va oson yodlang 🚀`,
              certUrl(cert.id),
              () => {
                flash("📸 Telegram Stories funksiyasi faqat Telegram mobil ilovasida (Android yoki iOS) qo'llab-quvvatlanadi. Kompyuter yoki veb versiyada stories ochilmaydi.");
              }
            );

            if (!success && !canShareToStory()) {
              flash("📸 Stories faqat Telegram mobil ilovasida (Android yoki iOS) ishlaydi. Iltimos, ilovani telefoningizdagi Telegram orqali oching.");
            }
          }}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 via-pink-600 to-amber-500 hover:opacity-95 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-amber-200" /> 📸 Telegram Stories&apos;ga ulashish
        </button>
        {cert.verified !== false && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard?.writeText(certUrl(cert.id));
                flash('Tekshirish havolasi nusxalandi (QR kod ham shu sahifani ochadi)');
              } catch {
                flash(certUrl(cert.id));
              }
            }}
            className="w-full h-11 rounded-xl bg-[#1B2433] border border-slate-700 font-bold text-xs flex items-center justify-center gap-2"
          >
            <Link2 className="w-4 h-4" /> Tekshirish havolasini nusxalash
          </button>
        )}
        {inTg && (
          <button type="button" disabled={busy || !url} onClick={() => sendToChat('photo')} className="w-full h-11 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-200 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-60">
            <Send className="w-4 h-4" /> Rasm sifatida botdan qayta yuborish
          </button>
        )}
        {msg && <div className="rounded-xl bg-slate-800 border border-slate-700 p-3 text-xs text-slate-100 text-center">{msg}</div>}
        {inTg && !getTelegramWebApp()?.initDataUnsafe?.user?.allows_write_to_pm && (
          <p className="text-[10px] text-slate-500 text-center">Sertifikat kelmasa, botni ochib «Start» tugmasini bosing.</p>
        )}
      </div>
    </div>
  );
};
