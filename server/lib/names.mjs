// «Global Blitz» ismlar filtri: haqoratli so'z, reklama havolasi yoki bo'sh ism raqibga ko'rsatilmaydi — «O'yinchi» bilan almashtiriladi.
//
// Ism avval tozalanadi (nazorat belgilari olib tashlanadi, 40 belgigacha qisqartiriladi), so'ng tekshiriladi:
//   1) havola/reklama (http, www, t.me, .com, .uz ...);
//   2) harf almashtirishlar bilan aldash: «f u c k», «sh1t», «пидор» (kirill → lotin), «xuuuy» (takrorlar) bir xil ko'rinishga keltiriladi;
//   3) STEMS — ismning ichida uchrasa ham taqiqlanadi (kamida 4 harf, oddiy ismlarda uchramaydigan);
//   4) TOKENS — faqat alohida so'z sifatida taqiqlanadi (masalan, «Sikandar» ismi «sik» tufayli bloklanmasin).
// Admin qo'shimcha so'zlarni Admin → 🌍 Global Blitz → «Taqiqlangan so'zlar» orqali qo'shadi (config/blitz.badWords).

export const DEFAULT_NAME = "O'yinchi";
const MAX_NAME = 40;

// Kirill/ozbek harflari → lotin (taqqoslash uchun; ko'rinadigan ism o'zgarmaydi)
const TR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'x', ц: 's', ч: 'c', ш: 's', щ: 's', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'u', я: 'a', ў: 'u', қ: 'k', ғ: 'g', ҳ: 'x',
};
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i', '€': 'e', '£': 'l' };

// Oddiy ko'rinishga keltirish: kichik harf, diakritiksiz, leet/kirill → lotin, h/kh → x, w → v, q → k, c → k, takrorlar bitta
export function normalizeName(s) {
  let t = String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  t = t.replace(/[ʻʼ’‘`´']/g, '');
  let out = '';
  for (const ch of t) {
    if (TR[ch] !== undefined) out += TR[ch];
    else if (LEET[ch] !== undefined) out += LEET[ch];
    else out += ch;
  }
  out = out.replace(/kh/g, 'x').replace(/h/g, 'x').replace(/w/g, 'v').replace(/q/g, 'k').replace(/c/g, 'k').replace(/ph/g, 'f');
  out = out.replace(/(.)\1+/g, '$1'); // takrorlangan harflar («fuuuck» → «fuk»)
  return out;
}
const tokensOf = norm => norm.split(/[^a-z]+/).filter(Boolean);
const compactOf = norm => norm.replace(/[^a-z]+/g, '').replace(/(.)\1+/g, '$1');

// Bu ro'yxatlar normalizeName() dan o'tkazilgan ko'rinishda saqlanadi (masalan, «fuck» → «fuk», «пидор» → «pidor»)
const STEM_SRC = [
  // Uzun, ismlarda uchramaydigan o'zaklar (ismning ichida bo'lsa ham taqiqlanadi)
  'motherfucker', 'cocksucker', 'asshole', 'dickhead', 'bastard', 'faggot', 'whore',
  'blyat', 'blyad', 'pizd', 'pidor', 'pidar', 'eblan', 'yebat', 'mudak', 'gandon', 'zalup', 'dolboeb', 'huesos', 'xuesos', 'huilo', 'xuilo',
  'пизд', 'блять', 'блядь', 'ебланд', 'мудак', 'гандон', 'залуп', 'пидор', 'пидар', 'шлюх', 'долбоеб',
  'onangni', 'onangn', 'onasini', 'sikaman', 'sikib', 'sikay', 'sikish', 'kotagim', 'kotinga', 'jalab', 'dalbayob', 'dalbaeb', 'haromi',
];
const TOKEN_SRC = [
  // Qisqa so'zlar — faqat alohida so'z sifatida (yoki harflari ajratib yozilganda) taqiqlanadi:
  // «Sikandar», «Nishita», «Kuntal», «Asuka», «Slutsky», «Nigar» kabi oddiy ismlar bloklanmasin
  'fuck', 'shit', 'bitch', 'slut', 'cunt', 'pussy', 'nigger', 'nigga', 'dick', 'porn', 'porno', 'sex', 'sexy', 'arse',
  'sik', 'sikma', 'sikam', 'amkor', 'xuy', 'huy', 'hui', 'xui', 'хуй', 'suka', 'сука', 'lox', 'лох', 'tentak', 'ahmoq', 'axmoq', 'iflos', 'nahuy', 'naxuy', 'pidoras', 'puki',
];
const STEMS = [...new Set(STEM_SRC.map(normalizeName).filter(s => s.length >= 4))];
const TOKENS = new Set(TOKEN_SRC.map(normalizeName).filter(Boolean));
// «ass» → «as» bo'lib qolmasligi uchun takrorlanuvchi ikki harfli o'zaklar alohida tekshiriladi
const RAW_TOKENS = new Set(['ass']);

const LINK_RE = /(https?:|www\.|t\.me|telegram\.me|wa\.me|bit\.ly|\.(com|uz|ru|org|net|me|io|ly|xyz|info)\b)/i;

/** Qo'shimcha (admin kiritgan) so'zlar bilan tekshiruv uchun tayyorlanadi: vergul yoki yangi qator bilan ajratilgan matn yoki massiv */
export function parseBadWords(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[\n,;]+/);
  return list.map(x => normalizeName(String(x).trim())).filter(x => x.length >= 2).slice(0, 300);
}

/** Ism taqiqlanganmi? (extra — parseBadWords() natijasi) */
export function isBadName(raw, extra = []) {
  const name = String(raw ?? '');
  if (LINK_RE.test(name)) return true;
  const norm = normalizeName(name);
  if (!norm) return false;
  const compact = compactOf(norm);
  if (!compact) return false;
  const toks = tokensOf(norm);
  for (const t of toks) if (TOKENS.has(t)) return true;
  if (TOKENS.has(compact)) return true; // harflar ajratib yozilgan: «f.u.c.k», «s i k»
  if (RAW_TOKENS.size && String(name).toLowerCase().split(/[^a-z]+/).some(t => RAW_TOKENS.has(t))) return true;
  for (const s of STEMS) if (compact.includes(s)) return true;
  for (const w of extra) {
    if (w.length >= 4 ? compact.includes(w) : toks.includes(w)) return true;
  }
  return false;
}

/** Nazorat belgilarini olib tashlaydi va 40 belgiga qisqartiradi (filtrsiz) */
export const tidyName = v => String(v ?? '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, MAX_NAME);

/** Raqibga ko'rsatiladigan xavfsiz ism: tozalanadi, taqiqlangan bo'lsa yoki bo'sh bo'lsa — «O'yinchi» */
export function safeName(raw, extra = [], fallback = DEFAULT_NAME) {
  const t = tidyName(raw);
  if (!t) return fallback;
  return isBadName(t, extra) ? fallback : t;
}
