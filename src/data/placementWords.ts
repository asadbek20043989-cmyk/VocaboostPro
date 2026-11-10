// Daraja aniqlash testi uchun O'Z so'zlar banki (har daraja uchun 30 tadan).
// Ilovadagi admin so'zlarida C1/C2 darajalar bo'lmasligi mumkin, shuning uchun test shu bankka tayanadi
// (admin yuklagan so'zlar ham qo'shilib, savollar yanada xilma-xil bo'ladi). Format: [inglizcha, o'zbekcha]
import type { EnglishLevel } from '../types';

export const PLACEMENT_WORDS: Record<EnglishLevel, [string, string][]> = {
  A1: [
    ["apple", "olma"], ["water", "suv"], ["house", "uy"], ["friend", "do'st"], ["happy", "xursand"], ["small", "kichik"],
    ["eat", "yemoq"], ["drink", "ichmoq"], ["mother", "ona"], ["school", "maktab"], ["teacher", "o'qituvchi"], ["night", "tun"],
    ["city", "shahar"], ["car", "mashina"], ["dog", "it"], ["afraid", "qo'rqqan"], ["angry", "jahli chiqqan"], ["cold", "sovuq"],
    ["walk", "yurmoq"], ["sleep", "uxlamoq"], ["family", "oila"], ["morning", "ertalab"], ["table", "stol"], ["open", "ochmoq"],
    ["new", "yangi"], ["red", "qizil"], ["daughter", "qiz farzand"], ["milk", "sut"], ["read", "o'qimoq"], ["market", "bozor"],
  ],
  A2: [
    ["borrow", "qarz olmoq"], ["lend", "qarz bermoq"], ["journey", "sayohat"], ["weather", "ob-havo"], ["invite", "taklif qilmoq"], ["cheap", "arzon"],
    ["expensive", "qimmat"], ["lonely", "yolg'iz"], ["polite", "xushmuomala"], ["neighbour", "qo'shni"], ["ticket", "chipta"], ["delicious", "mazali"],
    ["dangerous", "xavfli"], ["crowded", "gavjum"], ["enough", "yetarli"], ["healthy", "sog'lom"], ["appointment", "uchrashuv"], ["recommend", "tavsiya qilmoq"],
    ["discount", "chegirma"], ["luggage", "yuk-bagaj"], ["holiday", "ta'til"], ["tired", "charchagan"], ["decide", "qaror qilmoq"], ["mistake", "xato"],
    ["empty", "bo'sh"], ["soon", "tez orada"], ["popular", "mashhur"], ["guest", "mehmon"], ["repair", "ta'mirlamoq"], ["useful", "foydali"],
  ],
  B1: [
    ["afford", "xarajatini ko'tara olmoq"], ["complain", "shikoyat qilmoq"], ["climate", "iqlim"], ["convenient", "qulay"], ["improve", "yaxshilamoq"], ["environment", "atrof-muhit"],
    ["argue", "bahslashmoq"], ["achieve", "erishmoq"], ["experience", "tajriba"], ["opportunity", "imkoniyat"], ["require", "talab qilmoq"], ["reduce", "kamaytirmoq"],
    ["suggest", "taklif etmoq"], ["responsible", "mas'ul"], ["community", "jamoa"], ["avoid", "oldini olmoq"], ["support", "qo'llab-quvvatlamoq"], ["probably", "ehtimol"],
    ["donate", "xayriya qilmoq"], ["shy", "uyatchan"], ["pollution", "ifloslanish"], ["encourage", "rag'batlantirmoq"], ["career", "kasb yo'li"], ["disappointed", "hafsalasi pir bo'lgan"],
    ["trust", "ishonch"], ["arrange", "tashkil qilmoq"], ["pressure", "bosim"], ["security", "xavfsizlik"], ["curious", "qiziquvchan"], ["recover", "tuzalmoq"],
  ],
  B2: [
    ["sustainable", "barqaror"], ["significant", "sezilarli"], ["approach", "yondashuv"], ["curriculum", "o'quv dasturi"], ["ambiguous", "ikki ma'noli"], ["reluctant", "istamaydigan"],
    ["consequence", "oqibat"], ["substantial", "salmoqli"], ["tackle", "bas kelmoq"], ["assume", "faraz qilmoq"], ["reliable", "ishonchli"], ["whereas", "holbuki"],
    ["evidence", "dalil"], ["bias", "tarafkashlik"], ["implement", "amalga oshirmoq"], ["conflict", "ziddiyat"], ["outcome", "natija"], ["trend", "tendensiya"],
    ["maintain", "saqlab turmoq"], ["estimate", "baholamoq"], ["pursue", "intilmoq"], ["obvious", "ravshan"], ["participate", "ishtirok etmoq"], ["threshold", "bo'sag'a"],
    ["inevitable", "muqarrar"], ["perspective", "nuqtai nazar"], ["sufficient", "yetarli darajada"], ["guarantee", "kafolat"], ["compromise", "murosa"], ["justify", "asoslab bermoq"],
  ],
  C1: [
    ["contemporary", "zamonaviy"], ["meticulous", "o'ta sinchkov"], ["ubiquitous", "hamma joyda uchraydigan"], ["scrutinize", "sinchiklab tekshirmoq"], ["mitigate", "yumshatmoq"], ["inherent", "ajralmas, xos"],
    ["profound", "chuqur"], ["plausible", "ishonarli"], ["reconcile", "yarashtirmoq"], ["pragmatic", "amaliy"], ["albeit", "garchi"], ["coherent", "izchil"],
    ["ambivalent", "ikkilangan"], ["compelling", "ishontiruvchi"], ["detrimental", "zararli"], ["arbitrary", "o'zboshimchalik bilan"], ["comprehensive", "har tomonlama"], ["elaborate", "batafsil yoritmoq"],
    ["mundane", "oddiy, zerikarli"], ["resilient", "chidamli"], ["stringent", "qat'iy"], ["undermine", "putur yetkazmoq"], ["viable", "amalga oshadigan"], ["alleviate", "yengillashtirmoq"],
    ["corroborate", "dalil bilan tasdiqlamoq"], ["discrepancy", "nomuvofiqlik"], ["feasible", "bajarish mumkin bo'lgan"], ["prevalent", "keng tarqalgan"], ["paradigm", "namuna, andoza"], ["nuance", "nozik farq"],
  ],
  C2: [
    ["ephemeral", "o'tkinchi"], ["obfuscate", "chalkashtirmoq"], ["perfunctory", "yuzaki, rasmiyatchilik uchun"], ["sycophant", "xushomadgo"], ["ineffable", "so'z bilan ta'riflab bo'lmaydigan"], ["recalcitrant", "itoatsiz"],
    ["magnanimous", "olijanob"], ["pernicious", "halokatli"], ["laconic", "lo'nda"], ["equivocal", "ikki xil talqin qilinadigan"], ["enigmatic", "jumboqli"], ["insidious", "yashirin xavfli"],
    ["ostentatious", "dabdabali"], ["quixotic", "xayolparast"], ["capricious", "injiq, o'zgaruvchan"], ["egregious", "yaqqol, dahshatli darajada yomon"], ["juxtapose", "yonma-yon qo'ymoq"], ["idiosyncratic", "o'ziga xos"],
    ["truculent", "jangari, qaysar"], ["obsequious", "yaltoqi"], ["ameliorate", "yaxshilamoq"], ["mellifluous", "ohangdor"], ["pusillanimous", "qo'rqoq"], ["perspicacious", "zehni o'tkir"],
    ["intransigent", "murosasiz"], ["tenuous", "zaif asoslangan"], ["surreptitious", "yashirincha qilingan"], ["aberration", "g'ayritabiiy og'ish"], ["loquacious", "gapdon"], ["vicarious", "boshqa orqali his qilingan"],
  ],
};
