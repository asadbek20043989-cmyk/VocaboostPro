// Comprehensive English-Uzbek Dictionary for Tap-to-Translate

export interface DictionaryEntry {
  word: string;
  ipa: string;
  uzbek: string;
  partOfSpeech: 'ot (noun)' | 'fe\'l (verb)' | 'sifat (adj)' | 'ravish (adv)' | 'bog\'lovchi (conj)' | 'olmosh (pron)' | 'predlog (prep)' | 'iboralar (phrase)';
  definitionUz: string;
  exampleSentenceEn?: string;
  exampleSentenceUz?: string;
}

export const DICTIONARY: Record<string, DictionaryEntry> = {
  // A
  abandon: { word: 'abandon', ipa: '/əˈbændən/', uzbek: 'tashlab ketmoq, voz kechmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Biror joy yoki narsani butunlay tark etish.' },
  ability: { word: 'ability', ipa: '/əˈbɪlɪti/', uzbek: 'qobiliyat, imkoniyat', partOfSpeech: 'ot (noun)', definitionUz: 'Biror ishni bajara olish iqtidori.' },
  able: { word: 'able', ipa: '/ˈeɪbl/', uzbek: 'qodir, qo\'lidan keladigan', partOfSpeech: 'sifat (adj)', definitionUz: 'Biror narsani qilishga kuchi yoki aqli yetadigan.' },
  about: { word: 'about', ipa: '/əˈbaʊt/', uzbek: 'haqida, to\'g\'risida; taxminan', partOfSpeech: 'predlog (prep)', definitionUz: 'Biror mavzu yoki voqea yuzasidan.' },
  above: { word: 'above', ipa: '/əˈbʌv/', uzbek: 'yuqorida, tepasida', partOfSpeech: 'predlog (prep)', definitionUz: 'Boshqa narsadan balandroqda joylashgan.' },
  across: { word: 'across', ipa: '/əˈkrɒs/', uzbek: 'narigi tomonga, kesib o\'tib', partOfSpeech: 'predlog (prep)', definitionUz: 'Bir chekkadan ikkinchi chekkaga.' },
  after: { word: 'after', ipa: '/ˈɑːftər/', uzbek: 'keyin, so\'ng', partOfSpeech: 'predlog (prep)', definitionUz: 'Vaqt yoki tartib bo\'yicha keyinroq.' },
  again: { word: 'again', ipa: '/əˈɡeɪn/', uzbek: 'yana, qaytadan', partOfSpeech: 'ravish (adv)', definitionUz: 'Yana bir marta.' },
  ahead: { word: 'ahead', ipa: '/əˈhed/', uzbek: 'oldinda, oldinga qarab', partOfSpeech: 'ravish (adv)', definitionUz: 'Oldingi tomonda joylashgan.' },
  alarm: { word: 'alarm', ipa: '/əˈlɑːm/', uzbek: 'qo\'ng\'iroq, xavf signali', partOfSpeech: 'ot (noun)', definitionUz: 'Ertalab uyg\'otuvchi yoki xavfdan ogohlantiruvchi ovoz.' },
  all: { word: 'all', ipa: '/ɔːl/', uzbek: 'hamma, barcha, butun', partOfSpeech: 'olmosh (pron)', definitionUz: 'To\'liq miqdor yoki jami odamlar.' },
  almost: { word: 'almost', ipa: '/ˈɔːlməʊst/', uzbek: 'deyarli, sal bo\'lmasa', partOfSpeech: 'ravish (adv)', definitionUz: 'To\'liq emas, lekin juda yaqin.' },
  alone: { word: 'alone', ipa: '/əˈləʊn/', uzbek: 'yolg\'iz, bir o\'zi', partOfSpeech: 'sifat (adj)', definitionUz: 'Hech kim yo\'q holda.' },
  already: { word: 'already', ipa: '/ɔːlˈredi/', uzbek: 'allaqachon', partOfSpeech: 'ravish (adv)', definitionUz: 'Kutilgandan oldinroq sodir bo\'lgan.' },
  always: { word: 'always', ipa: '/ˈɔːlweɪz/', uzbek: 'har doim, doimo', partOfSpeech: 'ravish (adv)', definitionUz: 'Doimiy ravishda, to\'xtovsiz.' },
  amazed: { word: 'amazed', ipa: '/əˈmeɪzd/', uzbek: 'hayratda qolgan, lol', partOfSpeech: 'sifat (adj)', definitionUz: 'Juda hayron bo\'lgan holat.' },
  ancient: { word: 'ancient', ipa: '/ˈeɪnʃənt/', uzbek: 'qadimiy, qadimgi', partOfSpeech: 'sifat (adj)', definitionUz: 'Juda uzoq o\'tmishga tegishli.' },
  answer: { word: 'answer', ipa: '/ˈɑːnsər/', uzbek: 'javob bermoq; javob', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Savolga qaytarilgan so\'z.' },
  antique: { word: 'antique', ipa: '/ænˈtiːk/', uzbek: 'antiqa, qimmatbaho qadimiy buyum', partOfSpeech: 'sifat (adj)', definitionUz: 'Qadimiy va noyob qiymatga ega narsa.' },
  anyone: { word: 'anyone', ipa: '/ˈeniwʌn/', uzbek: 'kimdir, har qanday odam', partOfSpeech: 'olmosh (pron)', definitionUz: 'Ixtiyoriy bir kishi.' },
  anything: { word: 'anything', ipa: '/ˈeniθɪŋ/', uzbek: 'biror narsa, har narsa', partOfSpeech: 'olmosh (pron)', definitionUz: 'Har qanday narsa.' },
  appear: { word: 'appear', ipa: '/əˈpɪər/', uzbek: 'paydo bo\'lmoq, ko\'rinmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Kutilmaganda ko\'zga ko\'rinish.' },
  arrived: { word: 'arrived', ipa: '/əˈraɪvd/', uzbek: 'yetib keldi', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Manzilga borib yetgan.' },
  assistant: { word: 'assistant', ipa: '/əˈsɪstənt/', uzbek: 'yordamchi', partOfSpeech: 'ot (noun)', definitionUz: 'Boshqa kishining ishlariga ko\'maklashuvchi shaxs.' },
  atmosphere: { word: 'atmosphere', ipa: '/ˈætməsfɪər/', uzbek: 'muhit, havo', partOfSpeech: 'ot (noun)', definitionUz: 'Biror joydagi umumiy kayfiyat yoki holat.' },
  autumn: { word: 'autumn', ipa: '/ˈɔːtəm/', uzbek: 'kuz fasli', partOfSpeech: 'ot (noun)', definitionUz: 'Yoz va qish orasidagi fasl.' },

  // B
  bark: { word: 'bark', ipa: '/bɑːk/', uzbek: 'vovullamoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Itning chiqargan ovozi.' },
  beautiful: { word: 'beautiful', ipa: '/ˈbjuːtɪfl/', uzbek: 'chiroyli, go\'zal', partOfSpeech: 'sifat (adj)', definitionUz: 'Ko\'zni quvontiruvchi husnga ega.' },
  because: { word: 'because', ipa: '/bɪˈkɒz/', uzbek: 'chunki, sababli', partOfSpeech: 'bog\'lovchi (conj)', definitionUz: 'Sababni ko\'rsatish uchun ishlatiladi.' },
  become: { word: 'become', ipa: '/bɪˈkʌm/', uzbek: 'bo\'lmoq, aylanmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Yangi holatga o\'tmoq.' },
  before: { word: 'before', ipa: '/bɪˈfɔːr/', uzbek: 'oldin, avval', partOfSpeech: 'predlog (prep)', definitionUz: 'Biror vaqtdan yoki hodisadan ilgari.' },
  behind: { word: 'behind', ipa: '/bɪˈhaɪnd/', uzbek: 'orqasida, ortida', partOfSpeech: 'predlog (prep)', definitionUz: 'Biror narsaning orqa tomonida.' },
  believe: { word: 'believe', ipa: '/bɪˈliːv/', uzbek: 'ishonmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Biror narsani haqiqat deb bilish.' },
  belong: { word: 'belong', ipa: '/bɪˈlɒŋ/', uzbek: 'tegishli bo\'lmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Biror kishiga yoki joyga qarashli bo\'lish.' },
  between: { word: 'between', ipa: '/bɪˈtwiːn/', uzbek: 'orasida, o\'rtasida', partOfSpeech: 'predlog (prep)', definitionUz: 'Ikki narsa yoki nuqta o\'rtasida.' },
  book: { word: 'book', ipa: '/bʊk/', uzbek: 'kitob; buyurtma qilmoq', partOfSpeech: 'ot (noun)', definitionUz: 'Yozma yoki bosma asar.' },
  brass: { word: 'brass', ipa: '/brɑːs/', uzbek: 'jez, latun (sariq metall)', partOfSpeech: 'ot (noun)', definitionUz: 'Mis va rux qotishmasi bo\'lgan sariq metall.' },
  breathe: { word: 'breathe', ipa: '/briːð/', uzbek: 'nafas olmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'O\'pkaga havo tortib chiqarish.' },
  bright: { word: 'bright', ipa: '/braɪt/', uzbek: 'yorqin, porloq; ziyrak', partOfSpeech: 'sifat (adj)', definitionUz: 'Ko\'p nur taratadigan yoki aql bilan to\'la.' },
  bring: { word: 'bring', ipa: '/brɪŋ/', uzbek: 'olib kelmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Biror narsani o\'zi bilan birga kelgan joyga yetkazish.' },
  breeze: { word: 'breeze', ipa: '/briːz/', uzbek: 'shabboda, mayin shamol', partOfSpeech: 'ot (noun)', definitionUz: 'Yoqimli, yengil esuvchi shamol.' },
  business: { word: 'business', ipa: '/ˈbɪznəs/', uzbek: 'biznes, ish, tijorat', partOfSpeech: 'ot (noun)', definitionUz: 'Daromad keltiruvchi kasbiy faoliyat.' },

  // C
  carefully: { word: 'carefully', ipa: '/ˈkeəfəli/', uzbek: 'ehtiyotkorlik bilan, diqqat bilan', partOfSpeech: 'ravish (adv)', definitionUz: 'Barcha tafsilotlarga e\'tibor berib.' },
  center: { word: 'center', ipa: '/ˈsentər/', uzbek: 'markaz, o\'rta', partOfSpeech: 'ot (noun)', definitionUz: 'Biror hudud yoki narsaning eng markaziy qismi.' },
  certain: { word: 'certain', ipa: '/ˈsɜːtn/', uzbek: 'aniq, ma\'lum bir', partOfSpeech: 'sifat (adj)', definitionUz: 'Shubhasiz bo\'lgan.' },
  chair: { word: 'chair', ipa: '/tʃeər/', uzbek: 'stul, kursi', partOfSpeech: 'ot (noun)', definitionUz: 'O\'tirish uchun mo\'ljallangan mebel.' },
  chapter: { word: 'chapter', ipa: '/ˈtʃæptər/', uzbek: 'bob, fasl', partOfSpeech: 'ot (noun)', definitionUz: 'Kitobning asosiy bo\'limlaridan biri.' },
  clever: { word: 'clever', ipa: '/ˈklevər/', uzbek: 'aqlli, ziyrak', partOfSpeech: 'sifat (adj)', definitionUz: 'Tez tushunadigan va yaxshi o\'ylaydigan.' },
  clock: { word: 'clock', ipa: '/klɒk/', uzbek: 'soat (devor yoki stol soati)', partOfSpeech: 'ot (noun)', definitionUz: 'Vaqtni ko\'rsatuvchi mexanizm.' },
  coffee: { word: 'coffee', ipa: '/ˈkɒfi/', uzbek: 'qahva, kofe', partOfSpeech: 'ot (noun)', definitionUz: 'Xushbo\'y qovurilgan donalardan tayyorlanadigan issiq ichimlik.' },
  corner: { word: 'corner', ipa: '/ˈkɔːnər/', uzbek: 'burchak', partOfSpeech: 'ot (noun)', definitionUz: 'Ikki devor yoki ko\'cha kesishgan joy.' },
  could: { word: 'could', ipa: '/kʊd/', uzbek: 'qila oldi, qilishi mumkin edi', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Can fe\'lining o\'tgan zamon shakli.' },
  cup: { word: 'cup', ipa: '/kʌp/', uzbek: 'chashka, finjon', partOfSpeech: 'ot (noun)', definitionUz: 'Choy yoki qahva ichiladigan kichik idish.' },
  curious: { word: 'curious', ipa: '/ˈkjʊəriəs/', uzbek: 'qiziquvchan, qiziqqon', partOfSpeech: 'sifat (adj)', definitionUz: 'Yangi narsalarni bilishga intiluvchan.' },

  // D
  dark: { word: 'dark', ipa: '/dɑːk/', uzbek: 'qorong\'i, qorong\'ulik', partOfSpeech: 'sifat (adj)', definitionUz: 'Yorug\'lik yo\'q yoki juda kam holat.' },
  decide: { word: 'decide', ipa: '/dɪˈsaɪd/', uzbek: 'qaror qilmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'O\'ylab ko\'rib bir to\'xtamga kelish.' },
  delicious: { word: 'delicious', ipa: '/dɪˈlɪʃəs/', uzbek: 'juda mazali, totli', partOfSpeech: 'sifat (adj)', definitionUz: 'Tatib ko\'rganda xush yoqadigan ta\'m.' },
  desk: { word: 'desk', ipa: '/desk/', uzbek: 'yozuv stoli, ish stoli', partOfSpeech: 'ot (noun)', definitionUz: 'O\'qish yoki ishlash uchun ishlatiladigan stol.' },
  detective: { word: 'detective', ipa: '/dɪˈtektɪv/', uzbek: 'detektiv, izquvar', partOfSpeech: 'ot (noun)', definitionUz: 'Jinoyat va sirlarni fosh qiluvchi mutaxassis.' },
  dilemma: { word: 'dilemma', ipa: '/dɪˈlemə/', uzbek: 'dilemma, qiyin tanlov', partOfSpeech: 'ot (noun)', definitionUz: 'Ikki yo\'l orasidagi qiyin qaror.' },
  discover: { word: 'discover', ipa: '/dɪˈskʌvər/', uzbek: 'kashf qilmoq, topmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Oldin noma\'lum bo\'lgan narsani birinchi bo\'lib bilish.' },
  distance: { word: 'distance', ipa: '/ˈdɪstəns/', uzbek: 'masofa, oraliq', partOfSpeech: 'ot (noun)', definitionUz: 'Ikki nuqta orasidagi masofa.' },
  door: { word: 'door', ipa: '/dɔːr/', uzbek: 'eshik', partOfSpeech: 'ot (noun)', definitionUz: 'Xonaga yoki binoga kirish joyi.' },
  dream: { word: 'dream', ipa: '/driːm/', uzbek: 'orzu, tush', partOfSpeech: 'ot (noun)', definitionUz: 'Uxlaganda ko\'riladigan voqea yoki intilayotgan maqsad.' },

  // E
  early: { word: 'early', ipa: '/ˈɜːli/', uzbek: 'erta, vaqtli', partOfSpeech: 'ravish (adv)', definitionUz: 'Belgilangan vaqtdan oldin.' },
  easily: { word: 'easily', ipa: '/ˈiːzəli/', uzbek: 'osonlikcha, qiyinchiliksiz', partOfSpeech: 'ravish (adv)', definitionUz: 'Kam kuch talab qilib.' },
  emerald: { word: 'emerald', ipa: '/ˈemərəld/', uzbek: 'zumrad (yashil qimmatbaho tosh)', partOfSpeech: 'ot (noun)', definitionUz: 'To\'q yashil tusdagi nodir tosh.' },
  enough: { word: 'enough', ipa: '/ɪˈnʌf/', uzbek: 'yetarli, yetarli darajada', partOfSpeech: 'sifat (adj)', definitionUz: 'Ehtiyojga to\'liq javob beradigan miqdor.' },
  enter: { word: 'enter', ipa: '/ˈentər/', uzbek: 'kirmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Ichkariga qadam qo\'ymoq.' },
  evening: { word: 'evening', ipa: '/ˈiːvnɪŋ/', uzbek: 'oqshom, kechqurun', partOfSpeech: 'ot (noun)', definitionUz: 'Kun botgandan keyingi vaqt.' },
  every: { word: 'every', ipa: '/ˈevri/', uzbek: 'har bir, barcha', partOfSpeech: 'sifat (adj)', definitionUz: 'Guruhdagi har bir alohida element.' },
  excited: { word: 'excited', ipa: '/ɪkˈsaɪtɪd/', uzbek: 'hayajonlangan, to\'lqinlangan', partOfSpeech: 'sifat (adj)', definitionUz: 'Quvonchli hayajon bilan to\'lgan.' },
  experience: { word: 'experience', ipa: '/ɪkˈspɪəriəns/', uzbek: 'tajriba; boshdan kechirmoq', partOfSpeech: 'ot (noun)', definitionUz: 'Amaliy faoliyat orqali orttirilgan bilim.' },
  eyes: { word: 'eyes', ipa: '/aɪz/', uzbek: 'ko\'zlar', partOfSpeech: 'ot (noun)', definitionUz: 'Ko\'rish a\'zosi.' },

  // F
  favorite: { word: 'favorite', ipa: '/ˈfeɪvərɪt/', uzbek: 'sevimli, yoqimli', partOfSpeech: 'sifat (adj)', definitionUz: 'Eng ko\'p yoqadigan narsa yoki kishi.' },
  feeling: { word: 'feeling', ipa: '/ˈfiːlɪŋ/', uzbek: 'hissiyot, tuyg\'u', partOfSpeech: 'ot (noun)', definitionUz: 'Qalbda paydo bo\'ladigan kechinma.' },
  finally: { word: 'finally', ipa: '/ˈfaɪnəli/', uzbek: 'nihoyat, oxir-oqibat', partOfSpeech: 'ravish (adv)', definitionUz: 'Uzoq kutish yoki urinishdan keyin.' },
  find: { word: 'find', ipa: '/faɪnd/', uzbek: 'topmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Qidirib izlagan narsani ko\'rish.' },
  first: { word: 'first', ipa: '/fɜːst/', uzbek: 'birinchi, avvalo', partOfSpeech: 'sifat (adj)', definitionUz: 'Boshida turuvchi.' },
  flashcard: { word: 'flashcard', ipa: '/ˈflæʃkɑːd/', uzbek: 'o\'rganish kartochkasi', partOfSpeech: 'ot (noun)', definitionUz: 'So\'z va tarjimani yodlash uchun maxsus kartochka.' },
  foggy: { word: 'foggy', ipa: '/ˈfɒɡi/', uzbek: 'tumanli', partOfSpeech: 'sifat (adj)', definitionUz: 'Tuman bilan qoplangan, ko\'rish qiyin bo\'lgan.' },
  follow: { word: 'follow', ipa: '/ˈfɒləʊ/', uzbek: 'ergashmoq, kuzatmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Biror kishining orqasidan yurmoq.' },
  found: { word: 'found', ipa: '/faʊnd/', uzbek: 'topdi; asos solmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Find fe\'lining o\'tgan zamoni.' },
  friend: { word: 'friend', ipa: '/frend/', uzbek: 'do\'st, o\'rtoq', partOfSpeech: 'ot (noun)', definitionUz: 'Yaxshi ko\'rilgan va ishonchli inson.' },
  future: { word: 'future', ipa: '/ˈfjuːtʃər/', uzbek: 'kelajak', partOfSpeech: 'ot (noun)', definitionUz: 'Hozirgi vaqtdan keyin keladigan davr.' },

  // G
  garden: { word: 'garden', ipa: '/ˈɡɑːdn/', uzbek: 'bog\', bog\'cha', partOfSpeech: 'ot (noun)', definitionUz: 'Daraxt va gullar ekilgan maydon.' },
  glance: { word: 'glance', ipa: '/ɡlɑːns/', uzbek: 'bir nazar tashlamoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Tezgina, qisqa qarab qo\'yish.' },
  glow: { word: 'glow', ipa: '/ɡləʊ/', uzbek: 'jilvalanmoq, muloyim nur sochmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Olovsiz mayin nur chiqarish.' },
  golden: { word: 'golden', ipa: '/ˈɡəʊldən/', uzbek: 'oltin rangli, oltindan yasalgan', partOfSpeech: 'sifat (adj)', definitionUz: 'Oltindek yaraqlagan.' },
  great: { word: 'great', ipa: '/ɡreɪt/', uzbek: 'buyuk, ulug\'; ajoyib', partOfSpeech: 'sifat (adj)', definitionUz: 'Yuksak ahamiyatga yoki hajmga ega.' },
  green: { word: 'green', ipa: '/ɡriːn/', uzbek: 'yashil', partOfSpeech: 'sifat (adj)', definitionUz: 'Maysazor rangidagi.' },

  // H
  hands: { word: 'hands', ipa: '/hændz/', uzbek: 'qo\'llar', partOfSpeech: 'ot (noun)', definitionUz: 'Inson qo\'llari.' },
  happen: { word: 'happen', ipa: '/ˈhæpən/', uzbek: 'sodir bo\'lmoq, yuz bermoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Voqea yuzaga kelishi.' },
  hear: { word: 'hear', ipa: '/hɪər/', uzbek: 'eshitmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Quloq orqali tovushni his qilish.' },
  heart: { word: 'heart', ipa: '/hɑːt/', uzbek: 'yurak, qalb', partOfSpeech: 'ot (noun)', definitionUz: 'Qon haydovchi a\'zo yoki tuyg\'ular markazi.' },
  help: { word: 'help', ipa: '/help/', uzbek: 'yordam bermoq; yordam', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Kimgadir ko\'mak ko\'rsatish.' },
  history: { word: 'history', ipa: '/ˈhɪstri/', uzbek: 'tarix', partOfSpeech: 'ot (noun)', definitionUz: 'O\'tmishda yuz bergan voqealar majmuasi.' },
  hope: { word: 'hope', ipa: '/həʊp/', uzbek: 'umid qilmoq; umid', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Yaxshi narsa bo\'lishini kutish.' },
  hour: { word: 'hour', ipa: '/ˈaʊər/', uzbek: 'soat (60 daqiqa)', partOfSpeech: 'ot (noun)', definitionUz: 'Oltmish daqiqalik vaqt o\'lchovi.' },
  house: { word: 'house', ipa: '/haʊs/', uzbek: 'uy, hovli', partOfSpeech: 'ot (noun)', definitionUz: 'Yashash uchun qurilgan bino.' },

  // I
  immediately: { word: 'immediately', ipa: '/ɪˈmiːdiətli/', uzbek: 'darhol, tezda', partOfSpeech: 'ravish (adv)', definitionUz: 'Hech kutmasdan, ayni damda.' },
  important: { word: 'important', ipa: '/ɪmˈpɔːtnt/', uzbek: 'muhim, ahamiyatli', partOfSpeech: 'sifat (adj)', definitionUz: 'Katta e\'tibor talab qiladigan.' },
  inside: { word: 'inside', ipa: '/ˌɪnˈsaɪd/', uzbek: 'ichkarida, ichida', partOfSpeech: 'predlog (prep)', definitionUz: 'Biror narsaning ichki qismida.' },
  interesting: { word: 'interesting', ipa: '/ˈɪntrəstɪŋ/', uzbek: 'qiziqarli, e\'tiborga loyiq', partOfSpeech: 'sifat (adj)', definitionUz: 'Kishini o\'ziga jalb qiluvchi.' },
  journey: { word: 'journey', ipa: '/ˈdʒɜːni/', uzbek: 'sayohat, safar', partOfSpeech: 'ot (noun)', definitionUz: 'Bir joydan boshqasiga uzoq yo\'l yurish.' },

  // K
  knew: { word: 'knew', ipa: '/njuː/', uzbek: 'bildi, bilardi', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Know fe\'lining o\'tgan zamon shakli.' },
  know: { word: 'know', ipa: '/nəʊ/', uzbek: 'bilmoq, tanimoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Ma\'lumotga ega bo\'lish.' },

  // L
  lantern: { word: 'lantern', ipa: '/ˈlæntən/', uzbek: 'fonus, chiroq', partOfSpeech: 'ot (noun)', definitionUz: 'Ko\'chada yoki qorong\'ida yoqiladigan chiroq.' },
  laugh: { word: 'laugh', ipa: '/lɑːf/', uzbek: 'kulmoq, kulgi', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Quvonchdan tovush chiqarib kulish.' },
  league: { word: 'league', ipa: '/liːɡ/', uzbek: 'liga, ittifoq, guruh', partOfSpeech: 'ot (noun)', definitionUz: 'Umumiy maqsad yo\'lida birlashgan jamoa yoki reyting guruhi.' },
  learn: { word: 'learn', ipa: '/lɜːn/', uzbek: 'o\'rganmoq, saboq olmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Yangi bilim yoki ko\'nikmaga ega bo\'lish.' },
  letter: { word: 'letter', ipa: '/ˈletər/', uzbek: 'xat, maktub; harf', partOfSpeech: 'ot (noun)', definitionUz: 'Qog\'ozga yozilgan xabar.' },
  light: { word: 'light', ipa: '/laɪt/', uzbek: 'yorug\'lik, nur; yengil', partOfSpeech: 'ot (noun)', definitionUz: 'Ko\'rish imkonini beruvchi nurlanish.' },
  listen: { word: 'listen', ipa: '/ˈlɪsn/', uzbek: 'tinglamoq, quloq solmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Diqqat bilan eshitish.' },
  little: { word: 'little', ipa: '/ˈlɪtl/', uzbek: 'kichik, ozgina', partOfSpeech: 'sifat (adj)', definitionUz: 'Hajmi yoki miqdori kam.' },
  locked: { word: 'locked', ipa: '/lɒkt/', uzbek: 'qulflangan, berk', partOfSpeech: 'sifat (adj)', definitionUz: 'Kalit bilan berkilib yopilgan.' },
  lonely: { word: 'lonely', ipa: '/ˈləʊnli/', uzbek: 'yolg\'iz, g\'arib', partOfSpeech: 'sifat (adj)', definitionUz: 'Boshqalardan ajralgan va xafa his qiluvchi.' },
  look: { word: 'look', ipa: '/lʊk/', uzbek: 'qaramoq; ko\'rinish', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Ko\'z bilan diqqat qaratish.' },
  lost: { word: 'lost', ipa: '/lɒst/', uzbek: 'yo\'qolgan, adashgan', partOfSpeech: 'sifat (adj)', definitionUz: 'Qayerdaligi noma\'lum bo\'lib qolgan.' },

  // M
  manager: { word: 'manager', ipa: '/ˈmænɪdʒər/', uzbek: 'menejer, boshqaruvchi', partOfSpeech: 'ot (noun)', definitionUz: 'Jamoa yoki ish jarayonini boshqaruvchi shaxs.' },
  mansion: { word: 'mansion', ipa: '/ˈmænʃn/', uzbek: 'hashamatli qasr, saroy', partOfSpeech: 'ot (noun)', definitionUz: 'Katta va qimmatbaho turar-joy.' },
  market: { word: 'market', ipa: '/ˈmɑːkɪt/', uzbek: 'bozor, bozor maydoni', partOfSpeech: 'ot (noun)', definitionUz: 'Oldi-sotdi qilinadigan gavjum joy.' },
  meeting: { word: 'meeting', ipa: '/ˈmiːtɪŋ/', uzbek: 'yig\'ilish, uchrashuv', partOfSpeech: 'ot (noun)', definitionUz: 'Bir guruh odamlarning suhbatlashish uchun to\'planishi.' },
  midnight: { word: 'midnight', ipa: '/ˈmɪdnaɪt/', uzbek: 'yarim tun (soat 00:00)', partOfSpeech: 'ot (noun)', definitionUz: 'Tunning qoq o\'rtasi.' },
  minute: { word: 'minute', ipa: '/ˈmɪnɪt/', uzbek: 'daqiqa (60 soniya)', partOfSpeech: 'ot (noun)', definitionUz: 'Bir soatning 60 dan bir qismi.' },
  morning: { word: 'morning', ipa: '/ˈmɔːnɪŋ/', uzbek: 'tong, ertalab', partOfSpeech: 'ot (noun)', definitionUz: 'Kunning boshlanish qismi.' },
  mysterious: { word: 'mysterious', ipa: '/mɪˈstɪəriəs/', uzbek: 'sirli, jumboqli', partOfSpeech: 'sifat (adj)', definitionUz: 'Tushunish yoki bilish qiyin bo\'lgan jumboqli holat.' },
  mystery: { word: 'mystery', ipa: '/ˈmɪstri/', uzbek: 'sir, jumboq', partOfSpeech: 'ot (noun)', definitionUz: 'Yashiringan va ma\'nosi fosh etilmagan voqea.' },

  // N
  never: { word: 'never', ipa: '/ˈnevər/', uzbek: 'hech qachon, aslo', partOfSpeech: 'ravish (adv)', definitionUz: 'Hech bir vaqtda sodir bo\'lmagan.' },
  night: { word: 'night', ipa: '/naɪt/', uzbek: 'tun, kecha', partOfSpeech: 'ot (noun)', definitionUz: 'Kun botgandan to tong otguncha davr.' },
  note: { word: 'note', ipa: '/nəʊt/', uzbek: 'eslatma, qisqa xat; e\'tibor bermoq', partOfSpeech: 'ot (noun)', definitionUz: 'Qog\'ozga yozilgan qisqa yozuv.' },
  notice: { word: 'notice', ipa: '/ˈnəʊtɪs/', uzbek: 'payqamoq, sezmoq; e\'lon', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Biror narsani ko\'rib fahmlamoq.' },

  // O
  office: { word: 'office', ipa: '/ˈɒfɪs/', uzbek: 'ofis, idora', partOfSpeech: 'ot (noun)', definitionUz: 'Xodimlar ishlaydigan xona yoki bino.' },
  often: { word: 'often', ipa: '/ˈɒfn/', uzbek: 'tez-tez, tez-tezdan', partOfSpeech: 'ravish (adv)', definitionUz: 'Ko\'p marotaba takrorlanuvchi.' },
  opened: { word: 'opened', ipa: '/ˈəʊpənd/', uzbek: 'ochdi, ochilgan', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Yopiq holatdan ochiq holatga keltirilgan.' },

  // P
  page: { word: 'page', ipa: '/peɪdʒ/', uzbek: 'sahifa, bet', partOfSpeech: 'ot (noun)', definitionUz: 'Kitob yoki daftarning bir tomoni.' },
  paragraph: { word: 'paragraph', ipa: '/ˈpærəɡrɑːf/', uzbek: 'abzas, xatboshi', partOfSpeech: 'ot (noun)', definitionUz: 'Yozma matnning alohida mazmunli qismi.' },
  party: { word: 'party', ipa: '/ˈpɑːti/', uzbek: 'ziyofat, o\'tirish, bazm', partOfSpeech: 'ot (noun)', definitionUz: 'Odamlar ko\'ngil yozish uchun yig\'iladigan marosim.' },
  past: { word: 'past', ipa: '/pɑːst/', uzbek: 'o\'tmish; yonidan o\'tib', partOfSpeech: 'ot (noun)', definitionUz: 'Oldin yuz bergan vaqt.' },
  people: { word: 'people', ipa: '/ˈpiːpl/', uzbek: 'odamlar, xalq', partOfSpeech: 'ot (noun)', definitionUz: 'Insonlar jamoasi.' },
  perfect: { word: 'perfect', ipa: '/ˈpɜːfɪkt/', uzbek: 'mukammal, a\'lo darajadagi', partOfSpeech: 'sifat (adj)', definitionUz: 'Hech qanday kamchiligi bo\'lmagan.' },
  pocket: { word: 'pocket', ipa: '/ˈpɒkɪt/', uzbek: 'cho\'ntak', partOfSpeech: 'ot (noun)', definitionUz: 'Kiyimdagi kichik buyumlarni solish qismi.' },
  portal: { word: 'portal', ipa: '/ˈpɔːtl/', uzbek: 'portal, sehrli darvoza', partOfSpeech: 'ot (noun)', definitionUz: 'Boshqa olam yoki zamonga o\'tish eshigi.' },
  possible: { word: 'possible', ipa: '/ˈpɒsəbl/', uzbek: 'mumkin bo\'lgan, ehtimolli', partOfSpeech: 'sifat (adj)', definitionUz: 'Amalga oshishi mumkin bo\'lgan.' },
  puppy: { word: 'puppy', ipa: '/ˈpʌpi/', uzbek: 'kuchukcha, it bolasi', partOfSpeech: 'ot (noun)', definitionUz: 'Yangi tug\'ilgan yoki kichik yoshdagi it.' },

  // Q
  question: { word: 'question', ipa: '/ˈkwestʃən/', uzbek: 'savol; shubha', partOfSpeech: 'ot (noun)', definitionUz: 'Javob olish maqsadida beriladigan so\'z.' },
  quickly: { word: 'quickly', ipa: '/ˈkwɪkli/', uzbek: 'tezda, chaqqonlik bilan', partOfSpeech: 'ravish (adv)', definitionUz: 'Qisqa vaqt ichida shoshib.' },
  quiet: { word: 'quiet', ipa: '/ˈkwaɪət/', uzbek: 'tinch, sokin', partOfSpeech: 'sifat (adj)', definitionUz: 'Shovqinsiz va osoyishta.' },

  // R
  rain: { word: 'rain', ipa: '/reɪn/', uzbek: 'yomg\'ir; yomg\'ir yog\'moq', partOfSpeech: 'ot (noun)', definitionUz: 'Bulutlardan tomchi bo\'lib tushuvchi suv.' },
  read: { word: 'read', ipa: '/riːd/', uzbek: 'o\'qimoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Yozilgan matnni ko\'z bilan ilg\'ab tushunish.' },
  reader: { word: 'reader', ipa: '/ˈriːdər/', uzbek: 'kitobxon, o\'quvchi', partOfSpeech: 'ot (noun)', definitionUz: 'Muntazam ravishda kitob o\'quvchi inson.' },
  ready: { word: 'ready', ipa: '/ˈredi/', uzbek: 'tayyor', partOfSpeech: 'sifat (adj)', definitionUz: 'Biror ishga kirishishga to\'liq shay.' },
  remember: { word: 'remember', ipa: '/rɪˈmembər/', uzbek: 'eslamoq, xotirlamoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Xotirada saqlab qolmoq.' },
  restaurant: { word: 'restaurant', ipa: '/ˈrestrɒnt/', uzbek: 'restoran, oshxona', partOfSpeech: 'ot (noun)', definitionUz: 'Odamlar taomlanadigan jamoat joyi.' },
  ring: { word: 'ring', ipa: '/rɪŋ/', uzbek: 'uzuk; jiringlamoq', partOfSpeech: 'ot (noun)', definitionUz: 'Barmog\'ga taqiladigan metall taqinchoq yoki jiringlash.' },
  river: { word: 'river', ipa: '/ˈrɪvər/', uzbek: 'daryo', partOfSpeech: 'ot (noun)', definitionUz: 'Tabiiy ravishda oqib o\'tuvchi katta suv havzasi.' },

  // S
  scent: { word: 'scent', ipa: '/sent/', uzbek: 'xushbo\'y hid, ifor', partOfSpeech: 'ot (noun)', definitionUz: 'Burunga uriladigan yoqimli hid.' },
  screen: { word: 'screen', ipa: '/skriːn/', uzbek: 'ekran, monitor', partOfSpeech: 'ot (noun)', definitionUz: 'Tasvir va yozuv ko\'rsatiladigan yuzasi.' },
  secret: { word: 'secret', ipa: '/ˈsiːkrət/', uzbek: 'sir, maxfiy narsa', partOfSpeech: 'ot (noun)', definitionUz: 'Boshqalardan yashirilgan ma\'lumot.' },
  shadow: { word: 'shadow', ipa: '/ˈʃædəʊ/', uzbek: 'soya', partOfSpeech: 'ot (noun)', definitionUz: 'Yorug\'lik to\'silganda yuzaga keladigan qorong\'i qiyofa.' },
  silence: { word: 'silence', ipa: '/ˈsaɪləns/', uzbek: 'jimjitlik, sukunat', partOfSpeech: 'ot (noun)', definitionUz: 'Har qanday shovqin va ovozning yo\'qligi.' },
  simple: { word: 'simple', ipa: '/ˈsɪmpl/', uzbek: 'oddiy, sodda', partOfSpeech: 'sifat (adj)', definitionUz: 'Murakkab bo\'lmagan, tushunarli.' },
  smile: { word: 'smile', ipa: '/smaɪl/', uzbek: 'tabassum qilmoq; tabassum', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Yuzda quvonch va xayrixohlik aks etishi.' },
  somewhere: { word: 'somewhere', ipa: '/ˈsʌmweər/', uzbek: 'qayerdadir, biror joyda', partOfSpeech: 'ravish (adv)', definitionUz: 'Noma\'lum bir makonda.' },
  special: { word: 'special', ipa: '/ˈspeʃl/', uzbek: 'maxsus, o\'zgacha, noyob', partOfSpeech: 'sifat (adj)', definitionUz: 'Oddiy narsalardan ajralib turadigan.' },
  start: { word: 'start', ipa: '/stɑːt/', uzbek: 'boshlamoq, boshlanish', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Biror faoliyatga kirishish.' },
  story: { word: 'story', ipa: '/ˈstɔːri/', uzbek: 'hikoya, qissa', partOfSpeech: 'ot (noun)', definitionUz: 'Voqealar haqidagi qiziqarli bayon.' },
  street: { word: 'street', ipa: '/striːt/', uzbek: 'ko\'cha', partOfSpeech: 'ot (noun)', definitionUz: 'Shahardagi uylar va transport o\'tadigan yo\'l.' },
  suddenly: { word: 'suddenly', ipa: '/ˈsʌdənli/', uzbek: 'to\'satdan, kutilmaganda', partOfSpeech: 'ravish (adv)', definitionUz: 'Hech kim kutmagan paytda.' },

  // T
  table: { word: 'table', ipa: '/ˈteɪbl/', uzbek: 'stol', partOfSpeech: 'ot (noun)', definitionUz: 'Buyumlar qo\'yiladigan usti tekis mebel.' },
  team: { word: 'team', ipa: '/tiːm/', uzbek: 'jamoa, guruh', partOfSpeech: 'ot (noun)', definitionUz: 'Birgalikda ish olib boruvchi odamlar guruhi.' },
  technology: { word: 'technology', ipa: '/tekˈnɒlədʒi/', uzbek: 'texnologiya', partOfSpeech: 'ot (noun)', definitionUz: 'Ilmiy bilimlarni amalda qo\'llash usullari.' },
  thinking: { word: 'thinking', ipa: '/ˈθɪŋkɪŋ/', uzbek: 'fikrlash, o\'ylash', partOfSpeech: 'ot (noun)', definitionUz: 'Aql bilan mushohada qilish jarayoni.' },
  through: { word: 'through', ipa: '/θruː/', uzbek: 'orqali, ichidan o\'tib', partOfSpeech: 'predlog (prep)', definitionUz: 'Biror narsaning ichkarisidan kesib o\'tish.' },
  time: { word: 'time', ipa: '/taɪm/', uzbek: 'vaqt, zamon; marotaba', partOfSpeech: 'ot (noun)', definitionUz: 'Voqealar ketma-ketligi o\'lchovi.' },
  travel: { word: 'travel', ipa: '/ˈtrævl/', uzbek: 'sayohat qilmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Boshqa shahar yoki mamlakatlarga borish.' },
  turned: { word: 'turned', ipa: '/tɜːnd/', uzbek: 'burildi, o\'girildi', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Yo\'nalishini boshqa tomonga o\'zgartirgan.' },

  // U
  understand: { word: 'understand', ipa: '/ˌʌndəˈstænd/', uzbek: 'tushunmoq, anglamoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Biror narsaning mohiyatini aql bilan ilg\'ash.' },
  unlock: { word: 'unlock', ipa: '/ʌnˈlɒk/', uzbek: 'qulfini ochmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Qulflangan narsani kalit bilan ochish.' },
  upstairs: { word: 'upstairs', ipa: '/ˌʌpˈsteəz/', uzbek: 'yuqori qavatda, tepada', partOfSpeech: 'ravish (adv)', definitionUz: 'Binoning yuqorigi qavatida.' },

  // V
  vault: { word: 'vault', ipa: '/vɔːlt/', uzbek: 'xazina yerto\'lasi, po\'lat xona', partOfSpeech: 'ot (noun)', definitionUz: 'Qimmatbaho buyumlar va pullar saqlanadigan xavfsiz yer osti xonasi.' },
  vintage: { word: 'vintage', ipa: '/ˈvɪntɪdʒ/', uzbek: 'nodir qadimiy, klassik', partOfSpeech: 'sifat (adj)', definitionUz: 'Eski davrning eng yaxshi namunasi.' },
  voice: { word: 'voice', ipa: '/vɔɪs/', uzbek: 'ovoz, tovush', partOfSpeech: 'ot (noun)', definitionUz: 'Odam gapirganda chiqadigan tovush.' },

  // W
  walk: { word: 'walk', ipa: '/wɔːk/', uzbek: 'piyoda yurmoq, sayr qilmoq', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Oyoqda qadam tashlab harakatlanish.' },
  warm: { word: 'warm', ipa: '/wɔːm/', uzbek: 'iliq, issiq; samimiy', partOfSpeech: 'sifat (adj)', definitionUz: 'Yoqimli haroratga ega.' },
  watch: { word: 'watch', ipa: '/wɒtʃ/', uzbek: 'qo\'l soati; tomosha qilmoq', partOfSpeech: 'ot (noun)', definitionUz: 'Qo\'lga taqiladigan soat yoki diqqat bilan ko\'rish.' },
  whisper: { word: 'whisper', ipa: '/ˈwɪspər/', uzbek: 'pichirlamoq; pichirlash', partOfSpeech: 'fe\'l (verb)', definitionUz: 'Juda past ovozda gapirish.' },
  window: { word: 'window', ipa: '/ˈwɪndəʊ/', uzbek: 'deraza, oyna', partOfSpeech: 'ot (noun)', definitionUz: 'Binoga yorug\'lik kirishi uchun shisha oyna.' },
  without: { word: 'without', ipa: '/wɪˈðaʊt/', uzbek: '...siz, ...siz holda', partOfSpeech: 'predlog (prep)', definitionUz: 'Biror narsa yoki kishisiz.' },
  wonderful: { word: 'wonderful', ipa: '/ˈwʌndəfl/', uzbek: 'ajoyib, hayratomuz', partOfSpeech: 'sifat (adj)', definitionUz: 'Kishini quvontiradigan va zavq bag\'ishlovchi.' },
  word: { word: 'word', ipa: '/wɜːd/', uzbek: 'so\'z, kalom', partOfSpeech: 'ot (noun)', definitionUz: 'Ma\'noga ega bo\'lgan nutq birligi.' },
  world: { word: 'world', ipa: '/wɜːld/', uzbek: 'dunyo, olam', partOfSpeech: 'ot (noun)', definitionUz: 'Sayyoramiz va undagi barcha mavjudotlar.' },
};

// Algorithmic Stemming and Lookup Helper
export function lookupWord(rawWord: string): DictionaryEntry {
  const clean = rawWord.toLowerCase().replace(/[^a-z]/g, '').trim();

  // 1. Direct match
  if (DICTIONARY[clean]) {
    return DICTIONARY[clean];
  }

  // 2. Strip plural or 3rd person singular -s / -es
  if (clean.endsWith('es') && DICTIONARY[clean.slice(0, -2)]) {
    return DICTIONARY[clean.slice(0, -2)];
  }
  if (clean.endsWith('s') && DICTIONARY[clean.slice(0, -1)]) {
    return DICTIONARY[clean.slice(0, -1)];
  }

  // 3. Strip past tense -ed / -d
  if (clean.endsWith('ed') && DICTIONARY[clean.slice(0, -2)]) {
    return DICTIONARY[clean.slice(0, -2)];
  }
  if (clean.endsWith('ed') && DICTIONARY[clean.slice(0, -1)]) {
    return DICTIONARY[clean.slice(0, -1)];
  }

  // 4. Strip -ing
  if (clean.endsWith('ing') && DICTIONARY[clean.slice(0, -3)]) {
    return DICTIONARY[clean.slice(0, -3)];
  }
  if (clean.endsWith('ing') && DICTIONARY[clean.slice(0, -3) + 'e']) {
    return DICTIONARY[clean.slice(0, -3) + 'e'];
  }

  // 5. Strip -ly
  if (clean.endsWith('ly') && DICTIONARY[clean.slice(0, -2)]) {
    return DICTIONARY[clean.slice(0, -2)];
  }

  // 6. Common irregular past forms
  const irregulars: Record<string, string> = {
    went: 'go', saw: 'see', took: 'take', gave: 'give', made: 'make', felt: 'feel',
    came: 'come', ran: 'run', spoke: 'speak', thought: 'think', began: 'begin',
    stood: 'stand', sat: 'sit', told: 'tell', held: 'hold', knew: 'know', was: 'be', were: 'be'
  };
  if (irregulars[clean] && DICTIONARY[irregulars[clean]]) {
    return DICTIONARY[irregulars[clean]];
  }

  // Fallback intelligent entry so the user never gets an empty screen
  return {
    word: rawWord.trim(),
    ipa: `/${clean}/`,
    uzbek: `"${rawWord}" so'zining kontekstdagi tarjimasi`,
    partOfSpeech: 'ot (noun)',
    definitionUz: `Ushbu so'z matndagi gap mazmuniga ko'ra tushuniladi.`
  };
}
