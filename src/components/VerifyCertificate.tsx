import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ShieldX, Download, Loader2, Rocket } from 'lucide-react';
import { Certificate } from '../types';
import { fetchCertificate } from '../services/certApi';
import { drawCertificate, certFileName, TEMPLATES, CERT_BOT } from '../services/certificate';
import { Logo, ThemeButton } from './Brand';

/** QR kod skaner qilinganda ochiladigan ommaviy sahifa: sertifikat haqiqiyligini tekshiradi va uni ko'rsatadi */
export const VerifyCertificate: React.FC<{ id: string }> = ({ id }) => {
  const [state, setState] = useState<'loading' | 'ok' | 'none' | 'error'>('loading');
  const [cert, setCert] = useState<Certificate | null>(null);
  const [url, setUrl] = useState('');
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let dead = false;
    fetchCertificate(id)
      .then(c => {
        if (dead) return;
        if (!c) return setState('none');
        setCert(c);
        setState('ok');
      })
      .catch(() => !dead && setState('error'));
    return () => {
      dead = true;
    };
  }, [id]);

  useEffect(() => {
    if (!cert || !ref.current) return;
    const c = ref.current;
    let dead = false;
    drawCertificate(c, cert).then(() => !dead && setUrl(c.toDataURL('image/png')));
    return () => {
      dead = true;
    };
  }, [cert]);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100">
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-10 space-y-4">
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Logo className="w-8 h-8" />
            <span className="text-[15px] font-extrabold tracking-tight text-white">Voca<span className="text-amber-400">Boost</span></span>
          </a>
          <ThemeButton />
        </div>

        {state === 'loading' && (
          <div className="rounded-2xl bg-[#151C28] border border-slate-800 p-8 flex items-center justify-center gap-3 text-sm text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Sertifikat tekshirilmoqda…
          </div>
        )}

        {state === 'ok' && cert && (
          <>
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-start gap-3">
              <BadgeCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-emerald-300">Haqiqiy sertifikat</div>
                <div className="text-xs text-slate-300 mt-0.5">
                  № {cert.id} · {cert.name} · {TEMPLATES[cert.tpl]?.name || ''} · {cert.date}
                </div>
              </div>
            </div>
            <canvas ref={ref} className="hidden" />
            {url ? (
              <img src={url} alt={`Sertifikat ${cert.id}`} className={`w-full rounded-2xl border border-slate-800 ${cert.fmt === 'story' ? 'max-w-sm mx-auto' : ''}`} />
            ) : (
              <div className={`rounded-2xl bg-[#151C28] animate-pulse ${cert.fmt === 'story' ? 'aspect-[9/16] max-w-sm mx-auto' : 'aspect-[1754/1240]'}`} />
            )}
            <a
              href={url || undefined}
              download={certFileName(cert)}
              className={`w-full h-12 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 ${url ? '' : 'opacity-60 pointer-events-none'}`}
            >
              <Download className="w-4 h-4" /> Yuklab olish
            </a>
            {/* Har bir QR skaneri — botning potensial yangi foydalanuvchisi */}
            <a
              href={`https://t.me/${CERT_BOT.replace(/^@/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="keep-dark block rounded-2xl bg-gradient-to-r from-violet-600 via-pink-600 to-amber-500 p-4 text-center text-white shadow-lg shadow-pink-500/20 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center justify-center gap-2 text-sm font-extrabold"><Rocket className="w-4 h-4" /> Siz ham o‘rganing va sertifikat oling!</div>
              <div className="text-[11px] text-white/85 mt-1 leading-snug">🚀 VocaBoost&apos;da ingliz tilini o‘yinlar orqali o‘rganing va rasmiy sertifikat oling — botni ochish uchun bosing</div>
            </a>
          </>
        )}

        {state === 'none' && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-5 flex items-start gap-3">
            <ShieldX className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-rose-300">Sertifikat topilmadi</div>
              <div className="text-xs text-slate-300 mt-1">№ {id} raqamli sertifikat mavjud emas yoki bekor qilingan.</div>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 text-sm text-amber-300">
            Tekshirib bo‘lmadi (aloqa xatosi). Sahifani yangilab qayta urinib ko‘ring.
          </div>
        )}

        <p className="text-center text-[11px] text-slate-500">VocaBoost — so&apos;zlarni tez va uzoq yodlang</p>
      </div>
    </div>
  );
};

/** Joriy manzil sertifikat sahifasimi? (/c/VB-000123 yoki ?cert=VB-000123) */
export function certIdFromLocation(): string {
  try {
    const m = /^\/c\/([A-Za-z0-9_-]{3,40})\/?$/.exec(window.location.pathname);
    if (m) return decodeURIComponent(m[1]).toUpperCase();
    const q = new URLSearchParams(window.location.search).get('cert');
    return q && /^[A-Za-z0-9_-]{3,40}$/.test(q) ? q.toUpperCase() : '';
  } catch {
    return '';
  }
}
