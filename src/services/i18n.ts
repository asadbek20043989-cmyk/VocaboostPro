// Interfeys tili: O'zbekcha (asos), Ruscha, Inglizcha.
// Matnlar «o'zbekcha asl matn -> tarjima» ko'rinishida saqlanadi; tarjimasi yo'q matn o'zbekcha qoladi.
import { useSyncExternalStore } from 'react';

export type Lang = 'uz' | 'ru' | 'en';
export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
];
const KEY = 'vb_lang_v1';
const listeners = new Set<() => void>();

const detect = (): Lang => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'uz' || saved === 'ru' || saved === 'en') return saved;
  } catch { /* ignore */ }
  try {
    const tg = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code || navigator.language || '';
    const c = String(tg).slice(0, 2).toLowerCase();
    if (c === 'ru') return 'ru';
    if (c === 'en') return 'en';
  } catch { /* ignore */ }
  return 'uz';
};
let current: Lang = typeof window === 'undefined' ? 'uz' : detect();

export const getLang = (): Lang => current;
export function setLang(l: Lang): void {
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  try { document.documentElement.lang = l; } catch { /* ignore */ }
  listeners.forEach(f => f());
}
export function useLang(): [Lang, (l: Lang) => void] {
  const l = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, getLang, () => 'uz' as Lang);
  return [l, setLang];
}

/** Apostrof turlarini birxillashtirish (o' g' ʻ ‘ ’) */
const norm = (s: string) => s.replace(/[\u2018\u2019\u02BB\u02BC`]/g, "'").replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();

const RAW: [string, string, string][] = [
  ["Bugun", "Сегодня", "Today"],
  ["So'zlar", "Слова", "Words"],
  ["O'yinlar", "Игры", "Games"],
  ["Liga", "Лига", "League"],
  ["Do'kon", "Магазин", "Shop"],
  ["Bugungi mashq", "Тренировка на сегодня", "Today's practice"],
  ["bugun o'rganildi", "выучено сегодня", "learned today"],
  ["yangi", "новых", "new"],
  ["so'z", "слов", "words"],
  ["takrorlash", "повторить", "to review"],
  ["kerak", "нужно", "due"],
  ["Bugungi reja bajarildi", "План на сегодня выполнен", "Today's plan is complete"],
  ["Mashqni boshlash", "Начать тренировку", "Start practice"],
  ["Bugungi lug'at:", "Словарь на сегодня:", "Today's vocabulary:"],
  ["Ajoyib! O'yinlar bo'limida so'zlarni mustahkamlang yoki ertaga qayting.", "Отлично! Закрепите слова в разделе «Игры» или возвращайтесь завтра.", "Great! Reinforce words in Games or come back tomorrow."],
  ["Jihozlarim", "Мои предметы", "My gear"],
  ["Ramka, aura, mavzu", "Рамка, аура, тема", "Frame, aura, theme"],
  ["Darajam", "Мой уровень", "My level"],
  ["Maxsus mavzular", "Особые темы", "Special topics"],
  ["Har kuni yangi mavzu", "Новая тема каждый день", "A new topic every day"],
  ["Bugungi maxsus mavzu tez orada e'lon qilinadi ✨", "Особая тема дня скоро появится ✨", "Today's special topic is coming soon ✨"],
  ["Oldingi mavzular", "Прошлые темы", "Previous topics"],
  ["Lug'at to'plamlari", "Наборы слов", "Word packs"],
  ["Haftalik faollik seriyasi", "Недельная серия активности", "Weekly activity streak"],
  ["So'zlar xaritasi", "Карта слов", "Word map"],
  ["So'zlar xaritasini ko'rish →", "Открыть карту слов →", "View word map →"],
  ["yodlandi", "выучено", "memorized"],
  ["o'rganilmoqda", "изучается", "learning"],
  ["Kunlik sovg'a", "Ежедневный подарок", "Daily gift"],
  ["Omadli Baraban", "Колесо удачи", "Lucky Wheel"],
  ["Omadli baraban", "Колесо удачи", "Lucky Wheel"],
  ["Omadli baraban (Sovg'a)", "Колесо удачи (подарок)", "Lucky Wheel (gift)"],
  ["Aylantirish →", "Крутить →", "Spin →"],
  ["Ochish →", "Открыть →", "Open →"],
  ["Raqib bilan bellashuv", "Дуэль с соперником", "Duel with a rival"],
  ["Kunlik missiyalar", "Ежедневные задания", "Daily quests"],
  ["Boshlash", "Начать", "Start"],
  ["⭐ XP reytingi (haftalik)", "⭐ Рейтинг XP (недельный)", "⭐ XP ranking (weekly)"],
  ["📣 Targ'ibotchilar", "📣 Амбассадоры", "📣 Promoters"],
  ["Hozircha hech kim do'st taklif qilmagan. Birinchi bo'ling! 🚀", "Пока никто не пригласил друзей. Будьте первым! 🚀", "Nobody has invited friends yet. Be the first! 🚀"],
  ["Tarix zali", "Зал истории", "Hall of History"],
  ["Oldingi haftalarning TOP-20 chempionlari · abadiy saqlanadi", "ТОП-20 прошлых недель · хранится навсегда", "TOP-20 champions of past weeks · kept forever"],
  ["Barcha Ishtirokchilar", "Все участники", "All participants"],
  ["Jami XP", "Всего XP", "Total XP"],
  ["Kun Streak", "Дней подряд", "Day streak"],
  ["Adminga xabar yozish", "Написать админу", "Message the admin"],
  ["Savol, muammo yoki taklifingizni yuboring", "Отправьте вопрос, проблему или предложение", "Send a question, problem or suggestion"],
  ["Ko'rish 🎓", "Смотреть 🎓", "View 🎓"],
  ["Adminga xabar", "Сообщение админу", "Message to admin"],
  ["Xabar ismingiz va vaqti bilan adminga boradi", "Сообщение уйдёт админу с вашим именем и временем", "Your message goes to the admin with your name and time"],
  ["Sozlamalar", "Настройки", "Settings"],
  ["Ismingiz", "Ваше имя", "Your name"],
  ["Profil rasmi", "Фото профиля", "Profile photo"],
  ["Yoki maxsus avatar tanlang", "Или выберите аватар", "Or choose an avatar"],
  ["Ingliz tili darajangiz", "Ваш уровень английского", "Your English level"],
  ["🎯 Daraja aniqlash testini topshirish", "🎯 Пройти тест на определение уровня", "🎯 Take the level placement test"],
  ["Kuniga nechta yangi so'z", "Сколько новых слов в день", "New words per day"],
  ["Kunlik eslatma (bot orqali)", "Ежедневное напоминание (через бота)", "Daily reminder (via bot)"],
  ["Telegram chatingizga eslatma keladi", "Напоминание придёт в ваш Telegram-чат", "The reminder arrives in your Telegram chat"],
  ["Tovush effektlari (tugmalar, to'g'ri/xato javob)", "Звуковые эффекты (кнопки, верный/неверный ответ)", "Sound effects (buttons, right/wrong answers)"],
  ["Qurilmalar o'rtasida sinxronlash", "Синхронизация между устройствами", "Sync between devices"],
  ["Nusxalash", "Копировать", "Copy"],
  ["Ulash", "Подключить", "Connect"],
  ["Barcha progressni qayta o'rnatish (Reset)", "Сбросить весь прогресс (Reset)", "Reset all progress"],
  ["Yopish", "Закрыть", "Close"],
  ["Xabaringizni yozing…", "Напишите сообщение…", "Write your message…"],
  ["Boshqa qurilmadagi kod", "Код с другого устройства", "Code from another device"],
  ["Do'kon hozircha yopiq.", "Магазин пока закрыт.", "The shop is closed for now."],
  ["Mening tangalarim", "Мои монеты", "My coins"],
  ["✅ Mening", "✅ Моё", "✅ Owned"],
  ["👁 Sinab ko'rish", "👁 Примерить", "👁 Try on"],
  ["Mavzu vaqtincha yoqildi — profilingiz o'zgarmaydi.", "Тема включена временно — ваш профиль не изменится.", "Theme enabled temporarily — your profile won't change."],
  ["Bekor qilish", "Отмена", "Cancel"],
  ["Hali sotib olinmagan. Pastdagi tugma bilan olishingiz mumkin.", "Ещё не куплено. Можно купить кнопкой ниже.", "Not purchased yet. You can buy it with the button below."],
  ["Ramka avataringizda shunday ko'rinadi. Hali sotib olinmagan.", "Так рамка выглядит на вашем аватаре. Ещё не куплена.", "This is how the frame looks on your avatar. Not purchased yet."],
  ["Ramka sizning avataringizda shunday ko'rinadi.", "Так рамка выглядит на вашем аватаре.", "This is how the frame looks on your avatar."],
  ["👁 Ilovada sinab ko'rish (20 soniya)", "👁 Примерить в приложении (20 сек.)", "👁 Try in the app (20 sec.)"],
  ["Narxi", "Цена", "Price"],
  ["Balansingiz", "Ваш баланс", "Your balance"],
  ["Qoladi", "Останется", "Remaining"],
  ["Bu mahsulotni admin qo'lda beradi. Buyurtma yuboriladi va siz bilan bog'lanishadi.", "Этот товар выдаёт админ вручную. Заказ будет отправлен, и с вами свяжутся.", "The admin delivers this item manually. Your order will be sent and you'll be contacted."],
  ["Sotib olish", "Купить", "Buy"],
  ["Jihozlash", "Надеть", "Equip"],
  ["🎓 Grammar Master ni ochish", "🎓 Открыть Grammar Master", "🎓 Open Grammar Master"],
  ["🔦 Reytingda ko'rish", "🔦 Показать в рейтинге", "🔦 See in ranking"],
  ["Kitoblarni ochish", "Открыть книги", "Open the books"],
  ["🎧 Musiqani yoqish", "🎧 Включить музыку", "🎧 Play music"],
  ["Hozircha jihozingiz yo'q.", "Пока у вас нет предметов.", "You have no gear yet."],
  ["Do'kondan ramka, mavzu yoki unvon xarid qiling 🛍️", "Купите в магазине рамку, тему или титул 🛍️", "Buy a frame, theme or title in the shop 🛍️"],
  ["Yo'q", "Нет", "None"],
  ["Standart", "Стандарт", "Default"],
  ["Oddiy", "Обычный", "Plain"],
  ["Oltin", "Золото", "Gold"],
  ["Kamalak", "Радуга", "Rainbow"],
  ["⭐ Yulduzcha", "⭐ Звёздочка", "⭐ Star"],
  ["👑 Toj", "👑 Корона", "👑 Crown"],
  ["Sotib olishni tasdiqlang", "Подтвердите покупку", "Confirm purchase"],
  ["📚 Inglizcha TOP kitoblar", "📚 ТОП книги на английском", "📚 TOP English books"],
  ["🎓 Grammar Master", "🎓 Grammar Master", "🎓 Grammar Master"],
  ["✨ Jihozlarim", "✨ Мои предметы", "✨ My gear"],
  ["Ramka", "Рамка", "Frame"],
  ["Ilova mavzusi", "Тема приложения", "App theme"],
  ["Unvon", "Титул", "Title"],
  ["Nik rangi", "Цвет ника", "Name color"],
  ["Ism yonidagi belgi", "Значок рядом с именем", "Symbol next to name"],
  ["Yaltiroq ism", "Сияющее имя", "Shiny name"],
  ["Reytingdagi belgi", "Значок в рейтинге", "Ranking badge"],
  ["Aura (avatar nuri)", "Аура (свечение аватара)", "Aura (avatar glow)"],
  ["Animatsion nik", "Анимированный ник", "Animated name"],
  ["Profil banneri", "Баннер профиля", "Profile banner"],
  ["Noyob avatarlar", "Уникальные аватары", "Unique avatars"],
  ["So'zlarni tez va uzoq yodlang 🚀", "Запоминайте слова быстро и надолго 🚀", "Memorize words fast and for good 🚀"],
  ["Aqlli takrorlash", "Умное повторение", "Smart review"],
  ["Tezkor", "Быстро", "Quick"],
  ["Darajamni test bilan aniqlayman", "Определю уровень тестом", "Find my level with a test"],
  ["20 savol · 2 daqiqa · eng aniq yo'l", "20 вопросов · 2 минуты · самый точный способ", "20 questions · 2 minutes · most accurate"],
  ["yoki o'zingiz tanlang", "или выберите сами", "or choose yourself"],
  ["Ingliz tili darajangiz qanday?", "Какой у вас уровень английского?", "What's your English level?"],
  ["Kuniga nechta yangi so'z yodlamoqchisiz?", "Сколько новых слов в день хотите учить?", "How many new words a day do you want to learn?"],
  ["Istalgan payt Sozlamalardan o'zgartirishingiz mumkin.", "Можно изменить в любой момент в Настройках.", "You can change this anytime in Settings."],
  ["Orqaga", "Назад", "Back"],
  ["VocaBoostga xush kelibsiz", "Добро пожаловать в VocaBoost", "Welcome to VocaBoost"],
  ["Baholashingiz qabul qilindi!", "Ваша оценка принята!", "Your rating was received!"],
  ["Fikringiz biz uchun juda muhim!", "Ваше мнение очень важно для нас!", "Your opinion matters a lot to us!"],
  ["Umumiy bahoyingiz:", "Ваша общая оценка:", "Your overall rating:"],
  ["Qisqa mezonlar bo'yicha baholang:", "Оцените по коротким критериям:", "Rate by short criteria:"],
  ["Tabriklaymiz! 🎉", "Поздравляем! 🎉", "Congratulations! 🎉"],
  ["Sovg'angiz muvaffaqiyatli berildi:", "Ваш подарок успешно выдан:", "Your gift was delivered:"],
  ["💎 XP bonusi:", "💎 Бонус XP:", "💎 XP bonus:"],
  ["🎡 Baraban aylantirish:", "🎡 Прокрутки колеса:", "🎡 Wheel spins:"],
  ["👑 VIP maqomi:", "👑 VIP-статус:", "👑 VIP status:"],
  ["🪙 Tangalar:", "🪙 Монеты:", "🪙 Coins:"],
  ["🛍️ Do'kon sovg'asi:", "🛍️ Подарок из магазина:", "🛍️ Shop gift:"],
  ["❄️ Streak muzlatgich:", "❄️ Заморозка серии:", "❄️ Streak freeze:"],
  ["Promokodni kiriting", "Введите промокод", "Enter promo code"],
  ["Oldin", "Было", "Before"],
  ["Hozir", "Сейчас", "Now"],
  ["Sizga sovg'a berildi! 🎁", "Вам подарили подарок! 🎁", "You received a gift! 🎁"],
  ["Shaxsiy to'plamlarim", "Мои наборы", "My packs"],
  ["So'z topilmadi.", "Слово не найдено.", "Word not found."],
  ["So'z qidirish...", "Поиск слова...", "Search a word..."],
  ["Rasmiy tasdiqlangan", "Официально подтверждено", "Officially verified"],
  ["Promokod", "Промокод", "Promo code"],
  ["Promokod kiritish", "Ввести промокод", "Enter promo code"],
  ["Botni baholash", "Оценить бота", "Rate the bot"],
  ["Botni baholash (5 ballik shkala)", "Оценить бота (по 5-балльной шкале)", "Rate the bot (5-point scale)"],
  ["Imkoniyatlar tugadi", "Попытки закончились", "No spins left"],
  ["Do'stingni taklif qil", "Пригласи друга", "Invite a friend"],
  ["Yana +1 ta aylantirish huquqi oling", "Получите ещё +1 прокрутку", "Get +1 more spin"],
  ["Qadam", "Шаг", "Step"],
  ["DIQQAT E'LON", "ВАЖНОЕ ОБЪЯВЛЕНИЕ", "IMPORTANT NOTICE"],
  ["Fikringizni bildiring va sovg'a oling", "Выскажите мнение и получите подарок", "Share your opinion and get a gift"],
  ["Qatnashish", "Участвовать", "Join"],
  ["Yuklanmoqda…", "Загрузка…", "Loading…"],
  ["Interfeys tili", "Язык интерфейса", "Interface language"],
  ["Kun rejimiga o'tish", "Перейти в дневной режим", "Switch to day mode"],
  ["Tun rejimiga o'tish", "Перейти в ночной режим", "Switch to night mode"],
  ["Kun rejimi", "Дневной режим", "Day mode"],
  ["Tun rejimi", "Ночной режим", "Night mode"],
  ["Tovushni o'chirish", "Выключить звук", "Mute sound"],
  ["Tovushni yoqish", "Включить звук", "Unmute sound"],
  ["Pastki navigatsiya", "Нижняя навигация", "Bottom navigation"],
  ["Noldan boshlayapman", "Начинаю с нуля", "Starting from zero"],
  ["Ozgina tushunaman", "Немного понимаю", "I understand a little"],
  ["O'rtacha", "Средний", "Intermediate"],
  ["Yaxshi bilaman", "Хорошо знаю", "I know it well"],
  ["Erkin gapiraman", "Говорю свободно", "I speak fluently"],
  ["Mukammal daraja", "Совершенный уровень", "Mastery level"],
  ["yengil", "лёгкий", "easy"],
  ["tavsiya", "рекомендуем", "recommended"],
  ["tezkor", "быстрый", "fast"],
  ["intensiv", "интенсивный", "intensive"],
  ["Qatnashish (oldindan)", "Участвовать (заранее)", "Join (in advance)"],
  ["Yaxshi", "Хорошо", "Good"],
  ["Bugungi vazifalar", "Задачи на сегодня", "Today's tasks"],
  ["Tushunarli", "Понятно", "Got it"],
  ["Keyin", "Позже", "Later"],
  ["{n}-hafta · ", "{n}-я неделя · ", "Week {n} · "],
  ["{n} ta o'quvchi", "{n} учеников", "{n} students"],
  ["O'quvchilar...", "Ученики...", "Students..."],
  ["Oflayn rejim", "Офлайн-режим", "Offline mode"],
  ["Jonli reyting", "Живой рейтинг", "Live ranking"],
  ["Reyting yuklanmoqda…", "Загрузка рейтинга…", "Loading ranking…"],
];
const MAP: Record<string, { ru: string; en: string }> = {};
RAW.forEach(([uz, ru, en]) => { MAP[norm(uz)] = { ru, en }; });

/** Tarjima: t("Bugun") -> joriy tildagi matn. Tarjima topilmasa asl (o'zbekcha) matn qaytadi. */
export function t(uz: string): string {
  if (current === 'uz') return uz;
  const hit = MAP[norm(uz)];
  return hit ? hit[current] : uz;
}
/** {n} kabi o'rinbosarli matn: tp("{n} ta so'z", { n: 5 }) */
export function tp(uz: string, vars: Record<string, string | number>): string {
  let s = t(uz);
  Object.entries(vars).forEach(([k, v]) => { s = s.split(`{${k}}`).join(String(v)); });
  return s;
}
