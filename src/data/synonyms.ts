import type { EnglishLevel } from '../types';

/**
 * Daraja bo'yicha sinonim guruhlari. Format: «so'z=sinonim1,sinonim2; ...»
 * «Sinonimini top» o'yini avval foydalanuvchining «Bugungi mashq» so'zlaridan, so'ng o'z darajasidagi guruhlardan savol tuzadi.
 */
const RAW: Record<EnglishLevel, string> = {
  A1: `afraid=scared,frightened; angry=mad,cross; arrive=reach; start=begin; choose=pick,select; quick=fast,rapid; big=large; small=little,tiny;
smart=clever; happy=glad,cheerful; sad=unhappy; ill=sick; easy=simple; hard=difficult; buy=purchase; talk=speak,chat; shut=close; mistake=error;
trip=journey; film=movie; kid=child; finish=end; cheap=inexpensive; fix=repair; wrong=incorrect; right=correct; quiet=silent; tired=exhausted;
pretty=beautiful,lovely; nice=pleasant,kind; rich=wealthy; shout=yell; hurry=rush; famous=well-known; busy=occupied; ready=prepared;
strong=powerful; sofa=couch; car=automobile; present=gift; intelligent=bright; look=glance`,
  A2: `allow=permit; amazing=wonderful,astonishing; brave=courageous; calm=peaceful,relaxed; careful=cautious; clever=sharp; collect=gather;
create=make; dangerous=risky,unsafe; huge=enormous,giant; honest=truthful,sincere; pleased=delighted; helpful=supportive; exciting=thrilling;
excellent=great,fantastic; fight=battle; finally=lastly; foreign=overseas; journey=voyage; nervous=worried,uneasy; pain=ache; polite=respectful;
repair=mend; reply=answer,respond; secret=hidden; serious=severe; similar=alike; strange=odd,weird; terrible=awful,dreadful; tidy=neat;
useful=handy; weak=frail; wish=want; awesome=fantastic; alive=living; announce=declare; attack=assault; author=writer; award=prize;
assistant=helper; attach=connect; goal=aim,target; habit=routine; imagine=suppose; ancient=old; discuss=debate; continue=carry on`,
  B1: `arrange=organize; complain=grumble; reliable=dependable,trustworthy; appreciate=value; delay=postpone; refuse=decline,reject; require=need;
admire=respect; admit=confess,acknowledge; annoy=irritate,bother; anxious=concerned; bargain=deal; benefit=advantage; certain=sure; courage=bravery;
damage=harm; destroy=ruin,wreck; encourage=motivate; entire=whole,complete; eventually=ultimately; fear=dread; forgive=pardon; grateful=thankful;
ignore=disregard; immediately=instantly; increase=raise,grow; inform=notify; intend=plan; limit=restrict; obvious=clear,evident; ordinary=normal,usual;
permission=consent; produce=manufacture; provide=supply; purpose=objective; recover=heal; reduce=cut,decrease; rescue=save; solution=remedy;
strength=power; strict=firm; sudden=abrupt,unexpected; suggest=propose; talent=ability; trust=faith; valuable=precious; warn=alert; absolute=total;
accurate=exact,precise; adjust=adapt; annual=yearly; approximately=roughly,about; attempt=try; aware=conscious; brief=short; combine=merge,unite;
concentrate=focus; concern=worry; conflict=clash; confirm=verify; constant=steady,continuous; determine=decide; donate=give; duty=obligation;
abandon=desert; accomplish=achieve; advance=progress; afford=manage; enormous=immense; eager=keen; rapid=swift; remain=stay`,
  B2: `significant=notable,major; moreover=furthermore,besides; consequently=therefore,thus; nevertheless=nonetheless,however; reluctant=unwilling;
evidence=proof; indicate=signal; substantial=considerable; assume=presume; acquire=obtain,gain; adequate=sufficient; appropriate=suitable,proper;
assess=evaluate; consequence=result,outcome; contemporary=modern; crucial=vital,essential; demonstrate=illustrate; detect=spot; dispute=disagreement;
diverse=varied; abundant=plentiful; accelerate=hasten; allocate=assign; anticipate=expect; authentic=genuine,real; reside=live; mandatory=compulsory;
prohibit=forbid; hinder=obstruct,hamper; fundamental=basic; scarce=rare; durable=lasting; flexible=adaptable; tolerate=endure,bear;
inevitable=unavoidable; vast=extensive; sustain=maintain; hesitate=pause; abolish=eliminate; reinforce=strengthen; ambitious=aspiring;
rely=depend; thorough=complete; trivial=minor; widespread=common`,
  C1: `ubiquitous=omnipresent,widespread; meticulous=painstaking,thorough; ambiguous=vague; eloquent=articulate,expressive; mitigate=alleviate,ease;
scrutinize=examine,inspect; resilient=robust; candid=frank; coherent=logical; prudent=sensible; arbitrary=random; elaborate=intricate;
obsolete=outdated; tangible=concrete; lucid=clear; hostile=unfriendly,aggressive; fluctuate=vary,waver; vindicate=justify; pragmatic=practical;
diminish=lessen; thrive=flourish,prosper; frugal=thrifty; reluctant=hesitant; profound=deep,intense; compelling=convincing,persuasive;
inherent=intrinsic; adamant=unyielding,insistent; conceal=hide,mask; acquit=clear; endorse=back,approve; exemplify=illustrate`,
  C2: `ephemeral=fleeting,transient; pernicious=destructive; obsequious=servile,fawning; laconic=concise,terse; ostentatious=showy,flashy;
capricious=fickle,unpredictable; mundane=banal; enigmatic=mysterious,puzzling; tenacious=persistent,determined; venerate=revere; ameliorate=improve;
exacerbate=worsen,aggravate; garrulous=talkative,chatty; lethargic=sluggish; magnanimous=generous; perfunctory=cursory; recalcitrant=stubborn,defiant;
surreptitious=stealthy,covert; truculent=belligerent; zealous=fervent,passionate; acrimonious=bitter; gregarious=sociable; indolent=lazy,idle;
nefarious=wicked,evil; precarious=unstable; sycophant=flatterer; esoteric=obscure; ineffable=inexpressible; obfuscate=confuse,obscure`,
};

export interface SynGroup { words: string[]; level: EnglishLevel }

export const LEVEL_ORDER: EnglishLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const SYN_GROUPS: SynGroup[] = [];
/** so'z (kichik harf) → barcha sinonimlari */
export const SYN_INDEX = new Map<string, Set<string>>();
/** so'z → daraja (birinchi uchragan guruh bo'yicha) */
export const SYN_LEVEL = new Map<string, EnglishLevel>();

LEVEL_ORDER.forEach(level => {
  RAW[level].split(';').forEach(chunk => {
    const c = chunk.trim();
    if (!c.includes('=')) return;
    const [head, rest] = c.split('=');
    const words = [head.trim().toLowerCase(), ...rest.split(',').map(x => x.trim().toLowerCase())].filter(Boolean);
    if (words.length < 2) return;
    SYN_GROUPS.push({ words, level });
    words.forEach(w => {
      if (!SYN_INDEX.has(w)) SYN_INDEX.set(w, new Set());
      if (!SYN_LEVEL.has(w)) SYN_LEVEL.set(w, level);
      words.forEach(o => o !== w && SYN_INDEX.get(w)!.add(o));
    });
  });
});

/** Qarama-qarshi ma'noli juftliklar (antonim o'yini uchun) */
export const ANTONYM_PAIRS: [string, string][] = [
  ['rich', 'poor'], ['hot', 'cold'], ['fast', 'slow'], ['big', 'small'], ['easy', 'difficult'], ['early', 'late'], ['happy', 'sad'],
  ['strong', 'weak'], ['ancient', 'modern'], ['bright', 'dark'], ['cheap', 'expensive'], ['clean', 'dirty'], ['open', 'closed'],
  ['full', 'empty'], ['heavy', 'light'], ['thick', 'thin'], ['wide', 'narrow'], ['deep', 'shallow'], ['safe', 'dangerous'],
  ['true', 'false'], ['brave', 'cowardly'], ['generous', 'selfish'], ['polite', 'rude'], ['honest', 'dishonest'], ['calm', 'nervous'],
  ['arrive', 'depart'], ['accept', 'refuse'], ['increase', 'decrease'], ['remember', 'forget'], ['borrow', 'lend'], ['win', 'lose'],
  ['buy', 'sell'], ['build', 'destroy'], ['agree', 'disagree'], ['allow', 'forbid'], ['permanent', 'temporary'], ['visible', 'invisible'],
  ['possible', 'impossible'], ['success', 'failure'], ['victory', 'defeat'], ['ancient', 'recent'], ['include', 'exclude'], ['expand', 'shrink'],
  ['optimistic', 'pessimistic'], ['arrival', 'departure'], ['advantage', 'disadvantage'], ['abundant', 'scarce'], ['accurate', 'inaccurate'],
  ['reliable', 'unreliable'], ['junior', 'senior'], ['major', 'minor'], ['maximum', 'minimum'], ['vague', 'precise'], ['guilty', 'innocent'],
  ['loose', 'tight'], ['smooth', 'rough'], ['shy', 'confident'], ['curious', 'indifferent'], ['export', 'import'], ['victory', 'loss'],
  ['praise', 'criticize'], ['encourage', 'discourage'], ['simple', 'complex'], ['rare', 'common'], ['careful', 'careless'], ['mild', 'severe'],
  ['humble', 'arrogant'], ['frequent', 'rare'], ['ascend', 'descend'], ['innocent', 'guilty'],
];
