// Do'kon: standart mahsulotlar, premium so'zlar, TOP kitoblar. Hammasi admin paneldan (🛒 Do'kon) o'zgartiriladi:
// narx, chegirma, nom, tavsif, rasm, yoqish/o'chirish; premium so'zlar va kitoblar ro'yxati ham matn sifatida tahrirlanadi.
import type { BankWord } from '../types';

export type ShopCat = 'boosters' | 'cosmetics' | 'learning' | 'social' | 'vip' | 'rewards';
export type ShopKind =
  | 'boost' | 'saver' | 'spin' | 'frame' | 'avatars' | 'nickcolor' | 'glow' | 'skin' | 'titles' | 'pack'
  | 'rankbadge' | 'mystery' | 'manual' | 'verified' | 'books' | 'lofi';

export interface ShopItem {
  id: string;
  title: string;
  desc: string;
  cat: ShopCat;
  icon: string;
  grad: [string, string];
  price: number;
  kind: ShopKind;
  value: string; // boost: soat; frame/skin: nom; spin: soni; pack: to'plam ID
  repeat: boolean; // qayta-qayta sotib olinadi (boost, mystery...)
  img: string; // admin qo'ygan rasm havolasi (bo'sh bo'lsa — belgi + rang)
  discount: number; // 0..90 %
  active: boolean;
  order: number;
  dayLimit: number; // bir foydalanuvchi kuniga ko'pi bilan (0 — cheklanmagan)
  custom?: boolean; // admin qo'shgan (qo'lda beriladigan) mahsulot
}

export const CATS: { id: ShopCat | 'all'; label: string }[] = [
  { id: 'all', label: 'Hammasi' },
  { id: 'boosters', label: '⚡ Kuchaytirgich' },
  { id: 'cosmetics', label: '🎨 Bezak' },
  { id: 'learning', label: "📚 O'rganish" },
  { id: 'social', label: '🏅 Reyting' },
  { id: 'vip', label: '👑 VIP' },
  { id: 'rewards', label: '🎁 Sovrin' },
];

const I = (id: string, title: string, desc: string, cat: ShopCat, icon: string, g1: string, g2: string, price: number, kind: ShopKind, value = '', repeat = false, dayLimit = 0): ShopItem => ({
  id, title, desc, cat, icon, grad: [g1, g2], price, kind, value, repeat, img: '', discount: 0, active: true, order: 0, dayLimit,
});

export const DEFAULT_ITEMS: ShopItem[] = [
  I('boost_1h', '2x XP (1 soat)', "Bir soat davomida olingan XP ikki baravar.", 'boosters', '⚡', '#F59E0B', '#EA580C', 40, 'boost', '1', true),
  I('boost_24h', '2x XP (24 soat)', "Bir kunlik kuchaytirgich: butun kun XP ikki baravar.", 'boosters', '🚀', '#F97316', '#DC2626', 150, 'boost', '24', true),
  I('streak_saver', 'Streak himoyasi', "Bir kun mashq qilmasangiz ham streak saqlanadi.", 'boosters', '🛡️', '#38BDF8', '#2563EB', 80, 'saver', '1', true),
  I('spin_1', 'Baraban aylantirish', "Omadli barabanda qo'shimcha 1 ta aylantirish.", 'rewards', '🎡', '#A78BFA', '#7C3AED', 60, 'spin', '1', true),
  I('mystery', 'Sirli quti', "Tasodifiy sovrin: XP, kuchaytirgich yoki noyob avatar.", 'rewards', '🎁', '#F472B6', '#9333EA', 120, 'mystery', '', true),
  I('frame_gold', 'Oltin ramka', "Avatar atrofida yaltiroq oltin ramka.", 'cosmetics', '🥇', '#FDE047', '#CA8A04', 250, 'frame', 'gold'),
  I('frame_fire', 'Olov ramka', "Avatar atrofida lovullab turgan olov.", 'cosmetics', '🔥', '#FB923C', '#B91C1C', 350, 'frame', 'fire'),
  I('frame_crystal', 'Kristall ramka', "Avatar atrofida nur sochuvchi kristall.", 'cosmetics', '💎', '#67E8F9', '#6366F1', 450, 'frame', 'crystal'),
  I('avatars', "Noyob avatarlar to'plami", "Faqat do'kon orqali olinadigan 6 ta maxsus avatar.", 'cosmetics', '🐉', '#34D399', '#047857', 400, 'avatars'),
  I('nickcolor', 'Nik rangi va belgi', "Reytingda ismingiz o'zingiz tanlagan rangda va belgi bilan ko'rinadi.", 'cosmetics', '🎨', '#FB7185', '#E11D48', 200, 'nickcolor'),
  I('glow', 'Yaltiroq ism', "Reytingda ismingiz oltin yoki kamalak rangda yaltirab turadi.", 'cosmetics', '✨', '#FACC15', '#EC4899', 500, 'glow'),
  I('skin_neon', 'Neon mavzusi', "Ilovaning neon rang sxemasi.", 'cosmetics', '🌃', '#22D3EE', '#D946EF', 300, 'skin', 'neon'),
  I('skin_nature', 'Tabiat mavzusi', "Ko'zni charchatmaydigan yashil rang sxemasi.", 'cosmetics', '🌿', '#4ADE80', '#15803D', 300, 'skin', 'nature'),
  I('skin_royal', 'Qirollik mavzusi', "Chuqur indigo va oltin ranglar.", 'cosmetics', '👑', '#6366F1', '#CA8A04', 350, 'skin', 'royal'),
  I('titles', 'Maxsus unvon', "Profilda ismingiz ostida unvon: «So'z ustasi», «Kitobxon» va boshqalar.", 'social', '🏷️', '#FBBF24', '#B45309', 250, 'titles'),
  I('rankbadge', 'Reytingda maxsus belgi', "Haftalik jadvalda ismingizga yulduzcha, avatar ustiga toj.", 'social', '👑', '#FDE047', '#F59E0B', 350, 'rankbadge'),
  I('verified', 'VIP maqomi (galochka)', "Ismingiz yonida ko'k galochka — VIP foydalanuvchi belgisi.", 'vip', '✅', '#38BDF8', '#0EA5E9', 1500, 'verified'),
  I('premium_words', "Premium so'zlar to'plami", "Yuqori darajadagi tanlangan so'zlar — o'rganish uchun alohida to'plam.", 'learning', '🧠', '#A78BFA', '#4F46E5', 600, 'pack', 'premium_words'),
  I('top_books', 'Inglizcha TOP kitoblar', "Ingliz tilini o'rganuvchilar uchun eng yaxshi kitoblar ro'yxati.", 'learning', '📚', '#FBBF24', '#92400E', 700, 'books'),
  I('lofi', 'Lo-Fi musiqa', "Dars paytida yoqib qo'yadigan sokin musiqa. Xohlagan payt o'chirasiz.", 'learning', '🎧', '#60A5FA', '#7C3AED', 300, 'lofi'),
  I('tg_stars', 'Telegram Premium / Stars', "Eng qimmatli, kamdan-kam beriladigan sovrin. Admin buyurtmangizni qo'lda bajaradi.", 'rewards', '⭐', '#FDE047', '#F97316', 5000, 'manual'),
];

// ---------- Cosmetika ----------
export const FRAMES: Record<string, { label: string; ring: string; glow: string }> = {
  gold: { label: 'Oltin', ring: 'conic-gradient(#FDE047,#F59E0B,#FFF7C2,#F59E0B,#FDE047)', glow: 'rgba(250,204,21,.55)' },
  fire: { label: 'Olov', ring: 'conic-gradient(#FEF08A,#F97316,#DC2626,#F97316,#FEF08A)', glow: 'rgba(249,115,22,.6)' },
  crystal: { label: 'Kristall', ring: 'conic-gradient(#CFFAFE,#67E8F9,#A5B4FC,#E0E7FF,#CFFAFE)', glow: 'rgba(103,232,249,.55)' },
};
export const NICK_COLORS = ['#FBBF24', '#F87171', '#34D399', '#38BDF8', '#C084FC', '#F472B6', '#FB923C', '#A3E635'];
export const NAME_SYMS = ['', '⭐', '🔥', '💎', '⚡', '🌙', '🚀', '🦋'];
export const TITLES = ["So'z ustasi", 'Kitobxon', 'Vocab Legend', 'Word Hunter', 'IELTS Master', 'Lingvist'];
export const SKINS: Record<string, string> = { neon: 'Neon', nature: 'Tabiat', royal: 'Qirollik' };

export const LTD_AVATARS = [
  { id: 'ltd_dragon', emoji: '🐉', from: '#FDE047', to: '#B91C1C' },
  { id: 'ltd_phoenix', emoji: '🦅', from: '#FB923C', to: '#7F1D1D' },
  { id: 'ltd_wizard', emoji: '🧙', from: '#818CF8', to: '#1E1B4B' },
  { id: 'ltd_ninja', emoji: '🥷', from: '#475569', to: '#020617' },
  { id: 'ltd_alien', emoji: '👽', from: '#86EFAC', to: '#065F46' },
  { id: 'ltd_diamond', emoji: '💠', from: '#67E8F9', to: '#4338CA' },
];

// ---------- Premium so'zlar (standart; admin o'zgartiradi) ----------
// Format: en | uz | misol | misol tarjimasi
export const DEFAULT_PREMIUM_TEXT = `ubiquitous | hamma joyda uchraydigan | Smartphones are ubiquitous in modern life. | Smartfonlar zamonaviy hayotda hamma joyda bor.
meticulous | o'ta puxta, sinchkov | She is meticulous about every detail. | U har bir tafsilotga o'ta sinchkov.
resilient | chidamli, tez tiklanuvchi | Resilient people recover quickly from failure. | Chidamli odamlar muvaffaqiyatsizlikdan tez tiklanadi.
ambiguous | ikki xil ma'noli, noaniq | The instructions were ambiguous. | Ko'rsatmalar noaniq edi.
pragmatic | amaliy, real fikrlaydigan | We need a pragmatic solution. | Bizga amaliy yechim kerak.
scrutinize | sinchiklab tekshirmoq | Auditors scrutinize every report. | Auditorlar har bir hisobotni sinchiklab tekshiradi.
inevitable | muqarrar | Change is inevitable. | O'zgarish muqarrar.
profound | chuqur, teran | It had a profound effect on me. | Bu menga chuqur ta'sir qildi.
elaborate | batafsil; murakkab | He gave an elaborate explanation. | U batafsil tushuntirdi.
mitigate | yumshatmoq, kamaytirmoq | Trees mitigate the effects of heat. | Daraxtlar issiqlik ta'sirini kamaytiradi.
substantial | sezilarli, katta | A substantial amount of money was spent. | Sezilarli miqdorda pul sarflandi.
reluctant | istaksiz | He was reluctant to leave. | U ketishni istamadi.
coherent | izchil, mantiqiy | Write a coherent essay. | Izchil insho yozing.
inherent | tabiatan xos | Risk is inherent in business. | Xavf biznesga xos.
fluctuate | tebranmoq, o'zgarib turmoq | Prices fluctuate daily. | Narxlar kundan-kunga o'zgaradi.
endeavor | urinish, harakat | We endeavor to improve every day. | Biz har kuni yaxshilanishga intilamiz.
compelling | ishonarli, jalb qiluvchi | She made a compelling argument. | U ishonarli dalil keltirdi.
overwhelm | tanholik bermaydigan darajada bosmoq | Too much work can overwhelm you. | Ko'p ish sizni bosib ketishi mumkin.
undermine | zaiflashtirmoq | Rumors undermine trust. | G'iybat ishonchni zaiflashtiradi.
thrive | gullab-yashnamoq | Plants thrive in sunlight. | O'simliklar quyoshda gullab-yashnaydi.
tangible | aniq, sezilarli | We need tangible results. | Bizga aniq natijalar kerak.
reinforce | mustahkamlamoq | Practice reinforces learning. | Mashq o'rganganni mustahkamlaydi.
subtle | nozik, sezilmas | There is a subtle difference. | Nozik farq bor.
adhere | rioya qilmoq | Please adhere to the rules. | Iltimos, qoidalarga rioya qiling.
convey | yetkazmoq | Words cannot convey my joy. | So'zlar quvonchimni yetkaza olmaydi.
diminish | kamaymoq, kamaytirmoq | Interest began to diminish. | Qiziqish pasaya boshladi.
feasible | amalga oshirsa bo'ladigan | The plan is feasible. | Reja amalga oshirsa bo'ladigan.
innovative | yangilikka boy | An innovative approach to learning. | O'rganishga yangicha yondashuv.
prevalent | keng tarqalgan | This habit is prevalent among teens. | Bu odat o'smirlar orasida keng tarqalgan.
vulnerable | himoyasiz, zaif | Children are vulnerable. | Bolalar himoyasiz.`;

export function parsePremium(text: string): BankWord[] {
  const out: BankWord[] = [];
  String(text || '').split('\n').forEach((ln, i) => {
    const c = ln.split('|').map(x => x.trim());
    if (c.length < 2 || !c[0] || !c[1]) return;
    out.push({ id: `prem_${i}_${c[0].toLowerCase().replace(/[^a-z0-9]+/g, '')}`.slice(0, 60), en: c[0], uz: c[1], ex: c[2] || '', exUz: c[3] || '', ipa: '', pos: '', col: [], fam: [], hook: '', track: 'acad', topic: 'Premium', level: 'B2+', order: i });
  });
  return out;
}

// ---------- TOP kitoblar (standart; admin o'zgartiradi) ----------
// Format: nomi | muallif | daraja | qisqacha tavsif
export const DEFAULT_BOOKS_TEXT = `Harry Potter and the Philosopher's Stone | J.K. Rowling | B1 | Sehrli maktab haqida sarguzasht — oson tilda, o'qishni boshlash uchun ajoyib.
The Alchemist | Paulo Coelho | B1 | Orzu ortidan ketgan cho'pon haqida ilhomlantiruvchi hikoya.
Animal Farm | George Orwell | B1 | Hayvonlar fermasi orqali hokimiyat haqida qisqa va kuchli satirik asar.
The Great Gatsby | F. Scott Fitzgerald | B2 | Amerika orzusi va muhabbat haqida klassik roman.
To Kill a Mockingbird | Harper Lee | B2 | Adolat va insoniylik haqida mashhur roman.
The Little Prince | Antoine de Saint-Exupéry | A2 | Kichkina shahzoda haqida sodda va hikmatli ertak.
Charlie and the Chocolate Factory | Roald Dahl | A2 | Shokolad fabrikasidagi quvnoq sarguzasht.
The Old Man and the Sea | Ernest Hemingway | B1 | Chol baliqchi va ulkan baliq haqida qisqa, kuchli hikoya.
Pride and Prejudice | Jane Austen | B2 | Muhabbat va jamiyat haqida klassik ingliz romani.
1984 | George Orwell | B2 | Nazorat va erkinlik haqida antiutopiya.
Sherlock Holmes: Stories | Arthur Conan Doyle | B1 | Detektiv hikoyalar — yangi so'zlar va mantiq mashqi.
Atomic Habits | James Clear | B1 | Odatlarni o'zgartirishning amaliy yo'llari — ravon, zamonaviy til.
Rich Dad Poor Dad | Robert Kiyosaki | B1 | Pul va moliyaviy fikrlash haqida mashhur kitob.
The 7 Habits of Highly Effective People | Stephen R. Covey | B2 | Shaxsiy samaradorlik bo'yicha klassik qo'llanma.
Charlotte's Web | E.B. White | A2 | Do'stlik haqida iliq va sodda hikoya.`;

export interface BookRow { title: string; author: string; level: string; desc: string }
export function parseBooks(text: string): BookRow[] {
  return String(text || '').split('\n').map(l => l.split('|').map(x => x.trim())).filter(c => c.length >= 2 && c[0]).map(c => ({ title: c[0], author: c[1] || '', level: c[2] || '', desc: c[3] || '' }));
}
