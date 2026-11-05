# VocaBoost — Vercel'ga deploy qilish

## 1. GitHub'ga yuklash
Papka ichidagi fayllarni (papkaning o'zini emas) repo ildiziga yuklang. `package.json` va `vercel.json` repo ildizida turishi kerak.

## 2. Vercel'da import
Vercel > Add New > Project > GitHub repo'ni tanlang. Framework: **Vite** (avtomatik aniqlanadi), Build: `npm run build`, Output: `dist`.

## 3. Environment Variables (Settings > Environment Variables)
Netlify'dagi qiymatlarning hammasini shu yerga ko'chiring:

| O'zgaruvchi | Izoh |
|---|---|
| ADMIN_CODE | admin panel kodi |
| FIREBASE_DB_URL, FIREBASE_DB_SECRET | Firebase |
| BOT_TOKEN | Telegram bot |
| GEMINI_API_KEY | AI (ixtiyoriy: GEMINI_MODEL) |
| VITE_FIREBASE_DB_URL, VITE_TELEGRAM_APP_LINK, VITE_BOT_USERNAME, VITE_SITE_URL | brauzer uchun (build vaqtida o'qiladi) |
| SITE_URL | `https://sizning-sayt.vercel.app` (yoki o'z domeningiz) |
| CRON_SECRET | istalgan uzun maxfiy satr (3-bosqich uchun) |
| TG_WEBHOOK_SECRET, ADMIN_CHAT_ID, BOT_USERNAME | ixtiyoriy |

Muhim: o'zgaruvchi qo'shgach yoki o'zgartirgach **Redeploy** qiling (VITE_* ham, serverdagilar ham shundan keyin ishlaydi).

## 4. Telegram bot
Admin paneldagi "webhook o'rnatish" tugmasini yangi domen ochiq turib qayta bosing (webhook manzili `/api/fn/tg-webhook` bo'ldi). BotFather'da Mini App/Menu Button havolasini ham yangi domenga almashtiring.

## 5. Soatlik eslatmalar (cron)
Netlify'dagi "Scheduled Functions" Vercel Hobby'da yo'q (cron kuniga 1 marta). Shu uchun `.github/workflows/cron.yml` GitHub Actions orqali chaqiradi.
GitHub repo > Settings > Secrets and variables > Actions > New repository secret:
- `SITE_URL` = sayt manzili
- `CRON_SECRET` = Vercel'dagidek bir xil qiymat

Alternativa: cron-job.org'da har soat `https://SAYT/api/fn/remind?key=CRON_SECRET` va `https://SAYT/api/fn/streak-warn?key=CRON_SECRET` ni chaqirtiring.

## 6. Firebase
Realtime Database qoidalari o'zgarmaydi (`database.rules.json`). Faqat Authorized domains kerak bo'lsa, yangi domenni qo'shing.

## Tuzilma
- `api/fn/[name].js` — barcha server funksiyalarini bitta Vercel funksiyasi qiladi (Hobby 12 funksiya limitiga tushmaydi)
- `server/functions`, `server/lib` — eski Netlify funksiyalari (kodi deyarli o'zgarmagan)
- `/.netlify/functions/*` eski manzillari ham `vercel.json` orqali ishlaydi
- Xabar yuborish (broadcast) funksiyasi maksimal 60 soniya ishlaydi (Hobby chegarasi); juda ko'p foydalanuvchi bo'lsa `api/fn/[name].js` dagi `maxDuration` ni oshiring (Pro / Fluid compute kerak).
