import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

type P = { x: number; y: number; v: number; s: number; r: number; w: number; o: number };

/**
 * Do'kondan olingan «Yomg'ir» va «Qor» mavzulari: butun ilova ustida yog'ib turuvchi animatsiya.
 * Bosishlarga xalaqit bermaydi (pointer-events: none), sahifa yashirin bo'lsa to'xtaydi (batareya),
 * zaif qurilmada zarrachalar soni kamayadi. Faqat ekranda chiziladi — foydalanuvchi ma'lumotlariga tegmaydi.
 */
export const WeatherFx: React.FC = () => {
  const { activeSkin } = useApp();
  const ref = useRef<HTMLCanvasElement>(null);
  const kind = activeSkin === 'rain' || activeSkin === 'snow' ? activeSkin : '';

  useEffect(() => {
    const cv = ref.current;
    if (!kind || !cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, last = 0, running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const weak = ((navigator as any).hardwareConcurrency || 4) <= 4;
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const area = (w * h) / (390 * 800);
    const count = Math.round((kind === 'rain' ? 110 : 80) * Math.min(1.6, Math.max(0.8, area)) * (weak ? 0.65 : 1) * (reduce ? 0.5 : 1));
    const mk = (init: boolean): P => kind === 'rain'
      ? { x: Math.random() * (w + 80) - 40, y: init ? Math.random() * h : -20 - Math.random() * 60, v: 650 + Math.random() * 450, s: 0, r: 9 + Math.random() * 12, w: 0, o: 0.25 + Math.random() * 0.35 }
      : { x: Math.random() * w, y: init ? Math.random() * h : -10 - Math.random() * 30, v: 30 + Math.random() * 50, s: Math.random() * Math.PI * 2, r: 1.2 + Math.random() * 2.6, w: 0.5 + Math.random() * 1.2, o: 0.45 + Math.random() * 0.5 };
    const ps: P[] = Array.from({ length: count }, () => mk(true));
    const splashes: { x: number; y: number; t: number }[] = [];

    const frame = (t: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      ctx.clearRect(0, 0, w, h);
      if (kind === 'rain') {
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.2;
        for (const p of ps) {
          p.y += p.v * dt; p.x -= p.v * dt * 0.12;
          ctx.strokeStyle = `rgba(147,197,253,${p.o})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.r * 0.12, p.y - p.r); ctx.stroke();
          if (p.y > h) {
            if (Math.random() < 0.12 && splashes.length < 18) splashes.push({ x: p.x, y: h - 2, t: 0 });
            Object.assign(p, mk(false));
          }
        }
        for (let i = splashes.length - 1; i >= 0; i--) {
          const sp = splashes[i]; sp.t += dt;
          if (sp.t > 0.35) { splashes.splice(i, 1); continue; }
          ctx.strokeStyle = `rgba(191,219,254,${0.5 * (1 - sp.t / 0.35)})`;
          ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 2 + sp.t * 22, 1 + sp.t * 6, 0, 0, Math.PI * 2); ctx.stroke();
        }
      } else {
        for (const p of ps) {
          p.y += p.v * dt; p.s += p.w * dt; p.x += Math.sin(p.s) * 18 * dt;
          ctx.fillStyle = `rgba(255,255,255,${p.o})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          if (p.y > h + 6) Object.assign(p, mk(false));
          if (p.x > w + 6) p.x = -6; else if (p.x < -6) p.x = w + 6;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    return () => {
      running = false; cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', resize);
    };
  }, [kind]);

  if (!kind) return null;
  return <canvas ref={ref} aria-hidden className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 100 }} />;
};
