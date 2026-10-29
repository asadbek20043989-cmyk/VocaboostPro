import { BankWord, EnglishLevel, WordTrack } from '../types';
import { STARTER_WORDS } from '../data/starterWords';

// Tezkori qidiruv uchun lug'at xaritasi
let lookupMap: Map<string, BankWord> | null = null;

function getLookupMap(): Map<string, BankWord> {
  if (!lookupMap) {
    lookupMap = new Map();
    for (const w of STARTER_WORDS) {
      const key = w.en.trim().toLowerCase();
      if (!lookupMap.has(key)) {
        lookupMap.set(key, w);
      }
    }
  }
  return lookupMap;
}

/**
 * Oddiy fonetik IPA hosil qiluvchi yordamchi
 */
function approximateIPA(word: string): string {
  const w = word.toLowerCase().trim();
  let ipa = w
    .replace(/tion/g, 'ʃən')
    .replace(/sion/g, 'ʒən')
    .replace(/ough/g, 'ɔː')
    .replace(/ight/g, 'aɪt')
    .replace(/ph/g, 'f')
    .replace(/sh/g, 'ʃ')
    .replace(/ch/g, 'tʃ')
    .replace(/th/g, 'θ')
    .replace(/ee/g, 'iː')
    .replace(/ea/g, 'iː')
    .replace(/oo/g, 'uː')
    .replace(/ou/g, 'aʊ')
    .replace(/ow/g, 'aʊ')
    .replace(/ai/g, 'eɪ')
    .replace(/ay/g, 'eɪ')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'kw')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k');

  return `/${ipa}/`;
}

export interface CustomWordInput {
  en: string;
  uz?: string;
  ipa?: string;
  ex?: string;
  exUz?: string;
  hook?: string;
  pos?: string;
}

/**
 * Foydalanuvchi kiritgan inglizcha so'zni avtomatik to'ldirib, BankWord ga aylantiradi.
 * Agar faqat inglizcha so'z kiritilgan bo'lsa:
 * 1. Avval mavjud 1000+ so'zlar bazasidan qidiradi va aniq tarjima, IPA, misol, mnemotexnikasini oladi.
 * 2. Baza ichida bo'lmasa, intellektual tarzda talaffuz, gap va assotsiatsiya yaratadi.
 */
export function enrichCustomWord(input: CustomWordInput, index: number, packId: string): BankWord {
  const enClean = input.en.trim();
  const key = enClean.toLowerCase();
  const dict = getLookupMap().get(key);

  const id = `cw_${packId}_${index}_${key.replace(/[^a-z0-9]/g, '_')}`;

  const uz = input.uz?.trim() || dict?.uz || `${enClean}`;
  const ipa = input.ipa?.trim() || dict?.ipa || approximateIPA(enClean);
  const pos = input.pos?.trim() || dict?.pos || 'noun';
  const ex = input.ex?.trim() || dict?.ex || `I practice using "${enClean}" every day.`;
  const exUz = input.exUz?.trim() || dict?.exUz || `Men har kuni "${enClean}" so'zini qo'llashni mashq qilaman.`;
  const hook = input.hook?.trim() || dict?.hook || `💡 Assotsiatsiya: "${enClean.toUpperCase()}" so'zini eslab qolish uchun uni shaxsiy rejalaringiz bilan bog'lang.`;
  const col = dict?.col || [`use ${enClean}`, `practice ${enClean}`];
  const fam = dict?.fam || [];
  const track: WordTrack = dict?.track || 'comm';
  const topic = dict?.topic || 'Shaxsiy lug\'at';
  const level: EnglishLevel = dict?.level || 'B1';

  return {
    id,
    en: enClean,
    uz,
    ipa,
    pos,
    ex,
    exUz,
    col,
    fam,
    hook,
    track,
    topic,
    level,
    order: index + 1,
  };
}

/**
 * Matn orqali tezkor ko'p so'zlarni ajratib olish (Paste / Bulk Import)
 * Satrma-satr: "apple - olma" yoki "apple : olma" yoki "apple"
 */
export function parseBulkWords(rawText: string, max = 50): CustomWordInput[] {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result: CustomWordInput[] = [];

  for (const line of lines) {
    if (result.length >= max) break;

    // Tartib raqamlarini tozalash: "1. apple", "1) apple"
    const cleaned = line.replace(/^\d+[\.\)\-\s]+/, '').trim();
    if (!cleaned) continue;

    // Ajratuvchilar: " - ", " : ", " = ", "\t"
    const parts = cleaned.split(/\s*[-:=–—\t]\s*/);
    const en = parts[0]?.trim();
    const uz = parts.slice(1).join(' - ').trim();

    if (en) {
      result.push({
        en,
        uz: uz || undefined,
      });
    }
  }

  return result;
}
