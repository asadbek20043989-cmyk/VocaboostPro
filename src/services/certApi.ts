// Sertifikat serveri (Netlify funksiyasi /cert) bilan aloqa
import { getTelegramWebApp } from './telegram';
import { Certificate } from '../types';

const URL_BASE = '/api/fn/cert';

/** Ommaviy tekshirish (QR kod shu orqali sertifikatni topadi) */
export async function fetchCertificate(id: string): Promise<Certificate | null> {
  const r = await fetch(`${URL_BASE}?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 200) throw new Error(j?.error || `Xato ${r.status}`);
  if (!j.found || !j.cert) return null;
  const c = j.cert;
  return { id: c.id, tpl: String(c.tpl || 'gold'), title: String(c.title || ''), reason: c.reason || undefined, name: String(c.name || ''), date: String(c.date || '').slice(0, 10), special: !!c.special, verified: true, fmt: c.fmt === 'story' ? 'story' : 'wide', stats: c.stats || undefined };
}

/** "n ta so'z yodlandi" sertifikatini olish (server raqam beradi va QR uchun ro'yxatga oladi) */
export async function claimCertificate(uid: string, n: number, name: string): Promise<{ id?: string; date?: string; revoked?: boolean; retry?: boolean }> {
  const r = await fetch(URL_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'claim', uid, n, name, initData: getTelegramWebApp()?.initData || '' }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 409 || r.status >= 500) throw new Error(j?.error || `Xato ${r.status}`);
  if (!r.ok) throw new Error(j?.error || `Xato ${r.status}`);
  return j;
}

/** Ilovaga kirgandan 3 daqiqa o'tgach beriladigan bir martalik «Minnatdorchilik» sertifikati (sarlavha/izoh serverda qat'iy) */
export async function claimWelcomeCertificate(uid: string, name: string): Promise<{ id?: string; revoked?: boolean; pending?: boolean }> {
  const r = await fetch(URL_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'welcome', uid, name, initData: getTelegramWebApp()?.initData || '' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Xato ${r.status}`);
  return j;
}

/** Qo'shimcha avtomatik sertifikatlar: Barqaror (streak), Bilim donosi (daraja), Tezkor (duel), Mutaxassis (to'plam) */
export async function claimAward(uid: string, kind: 'streak' | 'level' | 'duel' | 'pack', key: string, extra: { n?: number; level?: string; title?: string; name: string }): Promise<{ id?: string; revoked?: boolean; pending?: boolean }> {
  const r = await fetch(URL_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'award', uid, kind, key, ...extra, initData: getTelegramWebApp()?.initData || '' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Xato ${r.status}`);
  return j;
}
