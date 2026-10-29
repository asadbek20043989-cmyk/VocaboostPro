# VocaBoost — o'rnatish, bot va admin panel

VocaBoost — inglizcha so'zlarni **tez va uzoq yodlash** uchun ilova: intervalli takrorlash, 10 ta o'yin, jonli reyting, omadli baraban va sertifikatlar.
Kontentning hammasi (so'zlar, o'yinlar, baraban, missiyalar, sertifikatlar, eslatmalar) **admin paneldan** boshqariladi.

## 1. Bir martalik o'rnatish

1. **Firebase → Realtime Database → Rules**: `database.rules.json` dagi qoidalarni joylang va **Publish** qiling (yangi qoida kerak emas, avvalgisi yetadi).
2. **Netlify → Site settings → Environment variables**:
   - `ADMIN_CODE` — admin kodi
   - `FIREBASE_DB_URL`, `FIREBASE_DB_SECRET` — serverdagi baza
   - `VITE_FIREBASE_DB_URL` — ilova uchun baza manzili
   - `VITE_TELEGRAM_APP_LINK` — do'st taklif qilish havolasi (`https://t.me/BotNomi/appnomi`)
   - `GEMINI_API_KEY` — AI mashqlari uchun ([aistudio.google.com](https://aistudio.google.com) dan bepul kalit)
   - **`BOT_TOKEN`** — (YANGI) BotFather bergan token. Quyidagilar uchun kerak: sertifikatni chatga yuborish, kunlik eslatmalar, Telegram profil rasmi zaxirasi.
   - `SITE_URL` — (ixtiyoriy) `https://saytingiz.netlify.app`; odatda Netlify o'zi beradi.
3. Zip'ni Netlify'ga deploy qiling (**Functions** yoqilgan bo'lishi kerak — zip'ni Drag&Drop emas, Git yoki `netlify deploy` bilan joylash tavsiya etiladi, chunki `npm install` ishlashi kerak).
4. Botda Mini App menyusi (BotFather → `/mybots` → Bot Settings → Menu Button) sayt manziliga ulangan bo'lsin. Logotipni bot rasmi qilish: BotFather → `/setuserpic`.

### Bot orqali nima ishlaydi (BOT_TOKEN kiritilgach)
| Imkoniyat | Qanday |
|---|---|
| **Sertifikat** | Foydalanuvchi sertifikat olganda (100/250/500/750/1000 so'z yoki admin yuborgan) ilova uni avtomatik **rasm qilib botdan foydalanuvchi chatiga** yuboradi. Sertifikat oynasidagi «Faylni chatga» va «Ulashish» tugmalari ham ishlaydi. |
| **Kunlik eslatma** | Admin panel → 🔔 Eslatmalar: matn(lar), soat va yoqish. Har kuni belgilangan soatda yuboriladi. |
| **Hammaga xabar** | Admin panel → 🔔 Eslatmalar → «Hozir hammaga yuborish». |
| **Profil rasmi** | Telegram rasmi avtomatik qo'yiladi (Telegram bermasa, bot orqali olinadi). |

Muhim: bot foydalanuvchiga yoza olishi uchun u botni bir marta «Start» qilgan bo'lishi kerak. Ilova birinchi marta ochilganda Telegram o'zi «botga yozishga ruxsat» so'raydi.
Ixtiyoriy: `/start`, `/stop`, `/remind` buyruqlari uchun webhook: `https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://SAYT/.netlify/functions/tg-webhook&secret_token=<TG_WEBHOOK_SECRET>` (agar botingiz boshqa joyda ishlayotgan bo'lsa, ulamang).

### AI «404» xatosi
Sababi: Google eski `gemini-2.0-flash` modelini o'chirgan. Endi funksiya bir nechta modelni (`gemini-2.5-flash`, `gemini-flash-latest`, …) ketma-ket sinaydi. `GEMINI_API_KEY` to'g'ri kiritilganiga ishonch hosil qiling.

## 2. Admin panelga kirish

`https://SAYTINGIZ.netlify.app/admin.html` → admin kodini kiriting.

**Birinchi qadam:** «📖 So'zlar» → **«Boshlang'ich 500+ ta so'zni yuklash»**. Shundan keyin so'zlar bazada turadi va hammasini panel orqali tahrirlaysiz.
(Eslatma: bazadagi so'zlar 500 tadan kam bo'lsa, ilova ularni o'ziga o'rnatilgan boshlang'ich so'zlar bilan to'ldiradi — «So'zlar» bo'limi hech qachon bo'sh turmaydi. Arxivlangan so'z qaytib kelmaydi.)

## 3. Panel imkoniyatlari

| Bo'lim | Nima qilish mumkin |
|---|---|
| 📊 Umumiy | Foydalanuvchilar, so'zlar, XP, sertifikatlar soni |
| 📖 So'zlar | Qo'shish, tahrirlash, **arxivlash**, o'chirish, qidirish; **Excel/Sheets'dan ommaviy yuklash**; qoralama/e'lon |
| 🎮 O'yinlar | 10 ta o'yinni yoqish/o'chirish, tartib, VIP belgisi, XP, nomi va har bir o'yin sozlamalari |
| 🎡 Baraban | Sovrinlarni almashtirish (tur, miqdor, yozuv, rang, ehtimol), aylantirishlar soni, kutish vaqti, VIP muddati; o'rtacha XP hisobi |
| 🎯 Missiyalar | Har kun uchun 3 ta missiya tanlash (sana yoki «standart») |
| 👥 Foydalanuvchilar | Onboarding'da tanlangan **daraja** va **kuniga so'z soni** taqsimoti va har bir foydalanuvchi ro'yxati, CSV yuklab olish |
| 🔔 Eslatmalar | Kunlik eslatma matni/vaqti, hammaga bir vaqtda xabar yuborish, sinov xabari |
| 🏆 Liga | XP tahrirlash, ismni o'zgartirish, yashirish, o'chirish/tiklash, «yangi mavsum» (hammasi 0 dan) |
| 🎓 Sertifikat | Tanlangan foydalanuvchiga **maxsus sertifikat** (8 andozadan), bekor qilish, **raqam bo'yicha tekshirish** |
| ⚙️ Sozlamalar | Takrorlash chegarasi, XP qiymatlari, e'lon, foydalanuvchiga sovg'a (aylantirish / VIP / XP) |

O'zgarishlar foydalanuvchilarga bir necha soniyada yetib boradi.

### Ommaviy yuklash formati
Har qator — bitta so'z, ustunlar Tab bilan ajratilgan (Google Sheets'dan nusxalaganda o'zi shunday bo'ladi):

`en, uz, ipa, pos, ex, exUz, col (| bilan), hook, topic, level (A1/A2/B1/B2+), order`

Faqat birinchi ikkitasi (`en`, `uz`) majburiy. `order` — so'zlar o'rganilish tartibi.

## 4. Ilovaning ishlashi (qisqacha)

- **Kunlik mashq:** yangi so'zlar (5 tadan paket) → mini-test → takrorlash. Takrorlash oralig'i: 1 → 3 → 7 → 14 → 30 kun.
- **«Yodlandi»** — 3 xil kunda to'g'ri javob berilgan so'z.
- **XP qoidasi:** bir xil so'z/o'yin/to'plam uchun XP kuniga faqat bir marta beriladi; qayta takrorlash XP bermaydi. Yangi so'z +3, to'g'ri takrorlash +2 (so'zga kuniga 1 marta), kunlik mashq bonusi +10, o'yinlar (≥60% natija bilan, kuniga 1 marta) — o'yinning o'z XP si. Hammasini «Sozlamalar» va «O'yinlar»dan o'zgartirasiz.
- **Baraban:** bepul aylantirishlar tugagach, kutish taymeri ishlaydi. Natija to'xtagandan keyin ko'rinadi.
- **Sertifikatlar:** 100 / 250 / 500 / 750 / 1000 ta so'z yodlanganda avtomatik (bronza, kumush, oltin, platina, chempion). Admin esa 8 andozadan istalganini yuboradi.
- **VIP:** VIP deb belgilangan o'yinlarni faqat barabandan «VIP / Pro» yutgan foydalanuvchi o'ynay oladi.

## 5. Cheklovlar (halol eslatmalar)

- **Qurilmalar o'rtasida sinxronlash** bazadagi `state/<hisob>` orqali ishlaydi (XP, so'zlar, baraban, VIP, missiyalar, sertifikatlar). Telegram ichida hisob avtomatik bir xil (Telegram ID). Agar sayt brauzerda to'g'ridan-to'g'ri ochilsa, bu **alohida hisob** bo'ladi: Liga → Profil → Sozlamalar'dagi «Hisob kodi» orqali boshqa qurilmaga ulanadi. Ikki qurilma bir vaqtda o'zgartirsa, oxirgi o'zgarish yutadi.
- Liga XP si va baraban natijasi foydalanuvchi qurilmasida hisoblanadi, texnikani yaxshi biladigan odam uni o'zgartirishi mumkin. Kichik auditoriya uchun muammo emas; pulga teng sovrin qo'ymang. Jiddiy himoya uchun natijani server funksiyasida hisoblash kerak bo'ladi.
- Yangi **turdagi** o'yin yoki yangi ekran qo'shish uchun kod kerak; mavjud 10 ta o'yin va ularning sozlamalari to'liq admin qo'lida.
- 100 ta boshlang'ich so'z va ularning «eslab qolish kalitlari» AI yordamida tayyorlangan: **o'zbekcha tarjimalar va assotsiatsiyalarni o'zingiz tekshirib chiqing** va kerak bo'lsa panelda tuzating.
- Eski «kitoblar», «o'qish» va «kunlik grammatika» qismlari olib tashlangan (ilova faqat lug'atga qaratilgan).

## 6. Yangilashdan keyingi birinchi kirish

Sinxronlash yoqilgandan keyin dastlab **progressi eng kerakli (masalan, VIP yutilgan) qurilmada** ilovani birinchi ochib, bir necha soniya kuting. Shundan keyin boshqa qurilmani oching: u bulutdagi holatni yuklaydi. Agar boshqa qurilma avval ochilsa, uning eski holati bulutga yoziladi va keyingi qurilma uni oladi.

---

# v3.1 yangiliklari (shu zip)

**Deploydan oldin majburiy:** Firebase → Realtime Database → Rules bo'limiga `database.rules.json` ichidagi yangi qoidalarni qo'yib **Publish** qiling (bellashuvlar, lug'at to'plamlari va sertifikat indeksi uchun). Boshqa env o'zgaruvchilari o'sha-o'sha. Ixtiyoriy: `VITE_SITE_URL`.

## 1. Telefon ↔ noutbuk sinxronlash (tuzatildi)
- Eski usulda "oxirgi yozgan qurilma hammasini ustiga yozar" edi. Endi har bir maydon birlashtiriladi: XP/streak/baraban aylantirishlari/missiyalar — kattasi yutadi; so'zlar, sertifikatlar, yutuqlar, olingan sovg'alar — birlashtiriladi.
- "Bugun" va baraban kutish vaqti server soatiga va Toshkent vaqtiga bog'landi — qurilma soati yoki vaqt zonasi noto'g'ri bo'lsa ham bir xil.
- Ilova fonga ketib qaytganda, internet uzilib tiklanganda ma'lumot qayta olinadi; yopilayotganda kutayotgan o'zgarishlar darhol yuboriladi.
- **Muhim:** brauzerda (Telegramsiz) ochilsa, har qurilma alohida hisob oladi. Profil → «Qurilmalar o'rtasida sinxronlash» ichidagi **«Ulash havolasi»**ni nusxalab, boshqa qurilmada oching. Telegram ichida hisob avtomatik bir xil.

## 2. Kun / Tun rejimi
Tepa o'ng burchakda ☀️/🌙 tugmasi (qurilmada saqlanadi).

## 3. Sertifikatlar
- Gorizontal (A4 albom) dizayn, 8 andoza. Har birida o'z QR kodi: skaner qilinsa `/c/VB-000123` sahifasi ochiladi va sertifikat haqiqiyligi ko'rsatiladi (bekor qilingan bo'lsa «topilmadi»).
- Raqamlar ketma-ket: `VB-000001`, `VB-000002`…
- Admin → Sertifikatlar: **Sarlavha** (ism ostidagi katta yozuv) va **Izoh** (kichik qiya yozuv), «Ko'rib chiqish» tugmasi, har bir sertifikat uchun «Ko'rish / QR».
- Avtomatik (100/250/500/750/1000 so'z) sertifikatlar matnini ham admin o'zgartiradi; ular ham server orqali raqam oladi va QR bilan tekshiriladi.

## 4. Raqib bilan bellashuv
Liga → «⚔️ Bellashuv» (va bosh sahifada kartochka). Yaratish → havola/kod yuborish → ikkala tomon natijani jonli ko'radi. Mezonlar: XP, yangi so'zlar, yodlangan so'zlar; 24 soat / 3 / 7 kun; 2–10 ishtirokchi.

## 5. Admin → «Bugungi mashqlar»
Alohida lug'at to'plami yuklash (qo'yish yoki .csv/.tsv/.txt/.json fayl). **Kunlik** (sana, kunlik so'zlar o'rniga yoki ustiga) yoki **doim ochiq** (bosh sahifada «Lug'at to'plamlari»). Deploy shart emas.

## Ma'lum cheklov
Ilovada Firebase Authentication yo'q: bazadagi progress yozuvlari hisob ID siga tayanadi (web hisoblar uchun ID taxmin qilib bo'lmaydigan tasodifiy; Telegram hisoblari uchun `tg_<raqam>` — taxmin qilish mumkin). To'liq himoya uchun keyingi bosqichda Telegram initData bilan tasdiqlanadigan server API kerak bo'ladi.

---

# v3.2 yangiliklari

**Deploydan oldin:** Firebase → Realtime Database → Rules ga `database.rules.json` ni qo'yib **Publish** qiling (yangi: `challenges`; `grants` endi faqat server orqali o'qiladi). Qo'shimcha env o'zgaruvchisi kerak emas.

## Tuzatilgan xatolar
- **Bir telefonda bir nechta Telegram akkaunt:** ma'lumotlar aralashar edi (mini-ilova xotirasi hamma akkaunt uchun umumiy). Endi har bir akkauntning mahalliy xotirasi alohida (`kalit@tg_123`), progress esa bulutdan akkaunt bo'yicha tiklanadi. *Oldin aralashib ketgan akkauntlar uchun:* Profil → «Barcha progressni qayta o'rnatish».
- **Sovg'alar har kuni takrorlanishi:** endi sovg'ani server bir martagina beradi (qaysi qurilmadan ochmasin). «Aylantirish» sovg'asining muddati bor (admin tanlaydi: shu kuni / 3 / 7 kun / foydalanilguncha), muddat tugasa qolgani yonadi. Sovg'a aylantirishlari birinchi sarflanadi.
- **Admin XP ni 0 qilsa, keyin yig'gan XP Ligada ko'rinmasligi:** admin XP o'zgartirganda endi foydalanuvchining o'z balansi ham o'zgaradi (bir martalik amal), «haqiqiy/ko'rinadigan» farq yo'q. «Yangi mavsum» tugmasi ham hammaning balansini 0 qiladi.
- **«Progressni qayta o'rnatish»:** hamma narsa noldan boshlanadi (eski sovg'alar qayta qo'llanmaydi), foydalanuvchi boshlanish ekraniga qaytadi, ismi va rasmi Telegramdan olinadi, Liga ham darhol 0 bo'ladi.
- **Bellashuv:** natija endi Ligadagi jonli XP/so'z ko'rsatkichidan hisoblanadi — baraban, o'yin, sovg'a XP lari darhol ko'rinadi. Kod bilan qo'shilish bloki katta va aniq; yaratilgan bellashuvda kod katta yozuvda + «Kodni nusxalash». Tugagan bellashuvni ro'yxatdan olib tashlash endi ishlaydi. Standart ishtirokchi soni 5.

## Yangi imkoniyatlar
- **Bot /start:** Admin → 🔔 Eslatmalar → «🤖 Botning /start xabari»: matn va tugma yozuvini tahrirlang, **«Botni ulash (webhook)»** tugmasini bir marta bosing — shundan keyin har bir /start bosgan foydalanuvchiga xabar + «🚀 VocaBoostni ochish» tugmasi boradi. Sinov uchun o'z Telegram ID ngizga «Sinov xabari» yuboring. (BotFather'da «Menu Button» ham ilovaga sozlangan bo'lsa yaxshi.)
- **Chellenj / marafon:** Admin → 🏁 Chellenjlar. Nom, mezon (XP / yangi so'z / yodlash), maqsad, boshlanish-tugash vaqti, sovrin. Foydalanuvchilar Liga → «🏁 Chellenj» da qatnashadi (bosh sahifada ham kartochka chiqadi). Muddat tugagach **«Yakunlash 🏆»**: natijalar qotadi, g'oliblarga sertifikat (🥇 Chempion, 🥈 Oltin, 🥉 Kumush, qolganlarga Bronza) va ixtiyoriy bonus XP, maqsadga yetganlarga «Marafon» sertifikati avtomatik beriladi.
- **UI:** «Bugungi mashq» sarlavhasi markazda katta; tugmada vaqt yozuvi yo'q; XP yonida «XP» yozuvi; VIP yozuvi markazda yirik; «So'zlar xaritasi» — bosh sahifadagi «So'zlar xaritasini ko'rish» orqali alohida oynada (So'zlar bo'limida endi faqat ro'yxat).

## Yangiliklar (v5.1)

- **Telefonda reyting/chellenj muammosi:** ilova endi Firebase bilan aloqani avtomatik tiklaydi: so'rovlarda vaqt chegarasi bor, to'g'ridan-to'g'ri ulanib bo'lmasa so'rov saytning o'z serveri (`/.netlify/functions/db`) orqali yuboriladi, jonli oqim ishlamasa ma'lumot avtomatik so'rov orqali olinadi. Liga tepasidagi nuqta endi haqiqiy holatni ko'rsatadi («Jonli reyting» / «Reyting yuklanmoqda…»). Qo'shimcha sozlama kerak emas (`FIREBASE_DB_URL` Netlify env da bo'lishi kifoya).
- **Streak oynalari:** bugungi streak yig'ilganda «N streak» oynasi; baraban orqali **Streak muzlatish ❄️** yutgan va bir kun mashq qilmagan foydalanuvchi ilovaga kirganda birinchi bo'lib «Streaklaringiz muzladi» oynasi chiqadi.
- **Botning oldindan ogohlantirishi:** `streak-warn` funksiyasi (har soat) muzlatish yutgan foydalanuvchilarga Telegramda avtomatik xabar yuboradi: kecha mashq qilmagan bo'lsa — ertalab (10:00 dan keyin) «streak muzladi», bugun hali mashq qilmagan bo'lsa — kechqurun (19:00 dan keyin) «bugun mashq qilmasangiz muzlaydi». Kuniga bir martadan; `/stop` bosganlarga yuborilmaydi. Soatlar/o'chirish (ixtiyoriy): Firebase `config/streakWarn` = `{ "enabled": true, "frozenHour": 10, "riskHour": 19 }`.
- **Bot /start va sinov xabari:** `{name}` o'rniga foydalanuvchining Telegramdagi ismi qo'yiladi (sinov xabari ham). «do'st» faqat ism umuman bo'lmaganda ishlatiladi.
- **Sertifikat:** har bir sertifikatning pastki o'rtasida `@VocaBoostProBot` yoziladi.

## Yangiliklar (v5.2)

- **Missiyalar:** admin almashtirgan kunlik missiyalar endi eskilari ustiga qo'shilmaydi — foydalanuvchida aynan admin tanlagan 3 ta missiya chiqadi (progress faqat bir xil missiyalar uchun saqlanadi).
- **Daraja bo'yicha kunlik so'zlar:** foydalanuvchi tanlagan darajaga mos so'zlar uning mashqlari, lug'ati va o'yinlariga beriladi. U onboardingda kiritgan miqdordagi (kuniga nechta) yangi so'z har kuni navbat bilan avtomatik yangilanadi (1-kun — birinchi so'zlar, 2-kun — keyingilari...). Daraja so'zlari tugasa, eng yaqin daraja so'zlari beriladi. Foydalanuvchining XP, streak va allaqachon o'rgangan so'zlari o'zgarmaydi.
- **🗓 Kunlik reja (admin):** daraja va "kuniga nechta so'z"ni tanlab, kunma-kun to'plamlarni ko'rasiz; so'zlarni ↑ ↓ bilan surish, tahrirlash, arxivlash, yangi so'z qo'shish mumkin. O'zgarishlar bir necha soniyada foydalanuvchilarga yetadi.
- **5 ta yangi VIP o'yin:** Hangman (so'zni top), Gap quruvchi, Diktant, So'z yomg'iri, Ortiqchasini top. Admin panelning «O'yinlar» bo'limida yoqish/o'chirish, XP va sozlamalarni o'zgartirish mumkin.
- **Minnatdorchilik sertifikati:** ilovaga kirgan har bir foydalanuvchiga 3 daqiqadan keyin bir marta avtomatik beriladi. Sarlavha va izoh o'zgarmaydi, faqat ism va QR kod (sertifikat raqami) alohida.

---

# v4.0.0 (Ultimate yangilanishi)

Ushbu versiyada barcha so'ralgan funksiyalar va tizim takomillashtirishlari to'liq qo'shildi:

1. **1200+ ta boyitilgan so'zlar bazasi (1000+ so'z kafolatlangan):**
   - So'zlar soni 571 tadan 1,229 taga oshirildi.
   - Har bir so'z to'liq metama'lumotlarga ega (`en`, `uz`, `ipa`, `pos`, `ex`, `exUz`, `col`, `hook`, `track`, `topic`, `level`, `order`).
   - Mavjud foydalanuvchilarning XP, Streak, o'rganilgan so'zlari va reytinglari 100% buzilmasdan saqlanib qoladi.
   - Admin panel orqali "Boshlang'ich 1000+ ta so'zni yuklash" tugmasi yangilangan bazani bir zumda o'rnatadi.

2. **Botning `/start` xabarida 3 ta tugma (Admin boshqaruvida):**
   - 1-tugma: Mini App ochuvchi asosiy tugma (nomini tahrirlash mumkin).
   - 2-tugma & 3-tugma: Admin xohlagan nom va URL (Telegram kanal, guruh yoki veb-sayt havolasi) qo'yishi mumkin.
   - Admin panel → 🔔 Eslatmalar → "Botning /start xabari" bo'limida 3 ta tugmani sozlash va "Sinov xabari yuborish" imkoniyati bor.

3. **16 xil sertifikat andozasi:**
   - 8 ta yangi premium dizayn qo'shildi: `trust` (Ishonch), `growth` (Rivojlanish), `wisdom` (Hikmat), `speed` (Tezkorlik), `reviewer` (Takrorlovchi), `expert` (Ekspert), `consistent` (Barqarorlik), `limitless` (Cheksiz).
   - Admin panel → 🎓 Sertifikatlar bo'limidan barcha 16 ta andozani ko'rish, tanlash va istalgan foydalanuvchiga to'g'ridan-to'g'ri yuborish mumkin.

4. **Minnatdorchilik (Welcome) sertifikati admin boshqaruvida:**
   - Yangi foydalanuvchi ilovani ochganda boradigan Minnatdorchilik sertifikatining **Sarlavhasi** va **Izohini** admin paneldagi "Minnatdorchilik sertifikati sozlamalari" kartochkasidan istalgan vaqtda o'zgartirish mumkin.

5. **5 ta yangi o'yin (Jami 20 ta o'yin):**
   - 16. **Sinonimini top (synonym)**: Ma'nodosh so'zni topish orqali so'z boyligini kengaytirish.
   - 17. **Qarama-qarshi so'z (antonym)**: Antonimlarni topish mashqi.
   - 18. **So'z qidiruvi (wordsearch)**: Harflar to'ridan yashiringan inglizcha so'zni topish o'yini.
   - 19. **Blitz viktorina (blitz)**: 30 soniya ichida eng ko'p to'g'ri tarjimani belgilash poygasi.
   - 20. **Talaffuz sinovi (pronounce)**: Ovozli talaffuzni eshitib to'g'ri so'zni aniqlash.
   - Yangi 5 ta o'yin ham Admin panel → 🎮 O'yinlar bo'limiga to'liq ulandi (yoqish/o'chirish, VIP qilish, XP va tartibini sozlash mumkin).

6. **Retention va pedagogik optimizatsiyalar:**
   - **Intervalli takrorlash (srsFactor):** SuperMemo SM-2 adaptiv takrorlash koeffitsiyenti qo'shildi — qiyin so'zlar tez-tez, oson so'zlar kamroq takrorlanib, o'rganish samaradorligini 2 karra oshiradi.
   - **Reyting jadvali (Liderlar):** Dastlab eng kuchli Top-50 ko'rsatiladi, "Yana ko'rsatish" tugmasi orqali keyingi 50 talik bosqichma-bosqich ochiladi.
   - **Streak haftalik kalendari:** Bosh sahifada dushanbadan yakshanbagacha bo'lgan kunlik o'qish ritmi chiroyli ko'rsatkichlar bilan aks etadi.

---

# v4.6.0 / v4.6.1 yangiliklari

**Deploydan oldin:** Firebase qoidalari o'zgarmadi, yangi env o'zgaruvchisi kerak emas.

## 1. Admin XP ni o'zgartirsa — foydalanuvchi XP si ustiga qo'shiladi (tuzatildi)
- Avval admin XP ni o'zgartirgach, foydalanuvchi qurilmasi eski XP bilan Ligani qayta yozib yuborardi.
- Endi admin o'zgartirishi **farq (`adj`/`adjV`)** sifatida Liga yozuviga yoziladi va foydalanuvchining ilovasi bu farqni o'z XP siga **bir marta** qo'shadi. Shundan keyin yig'gan XP **admin qo'ygan qiymatning ustiga** qo'shiladi. Eski «xpset» sovg'alari endi ishlatilmaydi.
- «Yangi mavsum» (hammani 0 qilish) ham shu usulda ishlaydi.
- **Bir marta qilish kerak:** oldin XP si qo'lda o'zgartirilgan foydalanuvchi (masalan, Muxarram) uchun Admin → 🏆 Liga'da XP ni yana bir marta kiritib saqlang.

## 2. Talaffuz (Netlify kreditini umuman sarflamaydi)
- Talaffuz tartibi: (1) yakka so'z — haqiqiy inson yozuvi (bepul Free Dictionary API, Netlify'ga tegmaydi); (2) `/tts` (Microsoft neyral ovozi, 1 yil keshlanadi); (3) brauzer ovozi.
- Kredit tejash: `/tts` faqat lug'atda yo'q so'zlar va gaplar uchun chaqiriladi; xato bo'lsa 6 s dan oshmaydi, server 2 marta xato bersa mijoz 30 daqiqa so'ramaydi, server esa qisqa vaqt tez rad etadi. Google zaxirasi olib tashlangan (sifat va kredit uchun). Serverni butunlay o'chirish: `VITE_SERVER_TTS=0`.
- Service Worker begona manbalarni (audio) endi ushlamaydi.

## 3. Chellenj sertifikatlari
- Yakunlanganda **har bir ishtirokchiga o'z o'rniga qarab** sertifikat beriladi: 1-o'rin **Oltin**, 2-o'rin **Kumush**, 3-o'rin **Bronza**, maqsadga yetganlar (1-3 o'rindan tashqari) **Marafon**, qolganlar **Minnatdorchilik**.
- Sarlavha va izohlar Admin → 🏁 Chellenjlar formasida (5 juft) **chellenj boshlanishidan oldin** yoziladi. `{place}`, `{challenge}`, `{score}`, `{goal}` ishlatish mumkin. Bo'sh qoldirilsa standart matn qo'yiladi. Ism-familiya avtomatik yoziladi.
- «Yakunlash 🏆» bosilgach admin sahifasi sertifikat rasmlarini chizib, har bir foydalanuvchining bot chatiga **tantanali xabar** bilan yuboradi (sahifani yopmang). Yuborilmaganlari uchun jadvalda «📨 Telegramga yuborish» tugmasi bor; baribir foydalanuvchi ilovani ochganda sertifikat o'zi keladi (ikki marta emas).
- Yakunlash qayta bosilsa ham sertifikat ikki marta berilmaydi.

## 4. Yangi chellenj turlari
- **Mavzuli chellenj:** admin «Bugungi mashqlar» bo'limidagi lug'at to'plamini tanlaydi. Ball: to'plamdagi o'rganilgan so'z — 1 ball, yodlangan so'z — yana +1 ball (qatnashish paytidagi holatdan boshlab).
- **Marafon (3 jon):** cheksiz savol, 3 jon va har bir savolga 30 soniya (admin ikkalasini o‘zgartira oladi; vaqt tugasa o‘yin tugaydi). Natija — jonlar tugaguncha topilgan so'zlar soni. Har kimga **faqat 1 ta urinish**; boshlash va tugash vaqtini admin belgilaydi. Teng natijada oldin tugatgan yuqori turadi.
- Oddiy XP / yangi so'z / yodlash chellenjlari avvalgidek ishlaydi.

## v4.7.0 yangiliklari
- **Liga → Yangi hafta**: TOP-20 «Tarix zali»ga (`hall/wNNNN`) qotiriladi, hamma XP 0 ga tushadi; ixtiyoriy: TOP-3 ga aylantirish sovg'asi, 1-o'ringa sertifikat.
- **Xabarlar** bo'limi: foydalanuvchilar yozgan xabarlar (kim, qachon), «Javob yozish» bot orqali boradi. Funksiya: `netlify/functions/inbox.mjs`.
- **Baraban**: «VIP sovg'a ehtimoli (%)» — aniq foiz.
- **Sertifikat**: yuborishda 9:16 yoki 16:9 tanlanadi; «Minnatdorchilik» avtomatik 9:16. Yangi avtomatik sertifikatlar: Barqaror (7/14/30 kun streak), Bilim donosi (daraja tugatildi), Tezkor (10/25/50 duel g'alaba), Mutaxassis (mavzuli to'plam).
- **Firebase qoidalari** yangilandi (`database.rules.json`): `certs` faqat `certs/<uid>` bo'yicha o'qiladi, `messages` yopiq, `hall` ochiq. Qoidalarni Firebase Console'ga qayta joylang!
- Netlify krediti: `grants` faqat `hasGrant` bayrog'i bo'lsa chaqiriladi, soat sinxroni sessiyada 1 marta, bot ro'yxati 3 kunda 1 marta, Stories rasmi 1 marta yuklanadi.
- `public/cert-render.js` `src/services/certificate.ts` o'zgarsa qayta yig'iladi: `npx esbuild src/services/certificate.ts --bundle --format=iife --global-name=VBC --minify --outfile=public/cert-render.js`

## Talaffuz (TTS) — Netlify krediti 0
Ilova endi `/.netlify/functions/tts` ni chaqirmaydi. Ketma-ketlik: inson yozuvi (Free Dictionary) → Wikimedia inson yozuvi → sifatli tizim ovozi → Google TTS → brauzer ovozi. Eski serverli neyral ovozni qaytarish uchun Netlify env'da `VITE_SERVER_TTS=1` qo'ying (kredit sarflaydi).

## v4.7.2 — sertifikat dizayni
Barcha 16 shablon yagona art-deko uslubda: oltin ramka va burchak nurlari, fon rangi shablonga qarab (yashil / ko'k / binafsha / oltin-jigarrang), oltin «SERTIFIKAT», yaltiroq yulduzlar, daraja-so'z-streak muhrlari. Ikkala format (16:9 va 9:16) bir xil uslubda. Dizayn `src/services/certificate.ts` da; o'zgartirsangiz `public/cert-render.js` ni qayta yig'ing (yuqoridagi buyruq).


---
## v5.0 — Tanga, Do'kon, Do'st taklif qilish, yangi sertifikatlar

**Tanga:** XP ning yarmi tanga bo'lib yig'iladi (admin: 🛒 Do'kon → «1 XP = necha tanga»), 7 va 30 kunlik streak bonusi, barcha kunlik missiyalar bonusi, yangi foydalanuvchiga boshlang'ich tanga (mavjud foydalanuvchilarga ham bir marta beriladi). XP, reyting va boshqa ma'lumotlarga TEGILMAYDI.

**Do'kon:** pastki menyuda «Do'kon». Mahsulotlar sotib olinishi bilan shu zahoti beriladi. Admin panel → 🛒 Do'kon: narx/chegirma/nom/rasm/yoqish-o'chirish, yangi (qo'lda beriladigan) mahsulot qo'shish, premium so'zlar, TOP kitoblar, Lo-Fi musiqa havolalari, istalgan foydalanuvchiga (yoki hammaga / taklif qilganlarga) tanga, XP yoki mahsulot sovg'a qilish, buyurtmalar.

**Taklif:** profilda shaxsiy havola `https://t.me/<bot>?start=ref_<ID>`. Do'st birinchi marta Start bosganda taklif qiluvchiga XP (admin belgilaydi, standart 50) beriladi va botdan xabar boradi. 📣 Taklif bo'limi: matnlar, shaxsiy tugmali ommaviy xabar, Targ'ibotchilar reytingi. Buning uchun bot webhook (tg-webhook) ulangan bo'lishi kerak.

**Sertifikatlar:** 8 ta yangi dizayn (`public/certs/*.jpg`) + haftalik g'olibga avtomatik «N-HAFTA CHEMPIONI». `public/cert-render.js` qayta yig'ilgan.

**Talaffuz:** sun'iy (robot) ovoz butunlay o'chirildi — faqat inson yozuvlari. `tts` funksiyasi olib tashlandi.
