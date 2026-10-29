import React, { useState, useEffect } from 'react';
import {
  Coins,
  Diamond,
  Zap,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  BookOpen,
  Music,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  Flame,
  Award,
  Crown,
  Send,
  Star
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ShopItem, ShopCategory, TopBook } from '../types';
import { triggerHaptic } from '../services/telegram';
import { sfx } from '../services/sound';
import { lofiPlayer } from '../services/lofiPlayer';

export const ShopTab: React.FC = () => {
  const {
    profile,
    shopItems,
    books,
    lofiTracks,
    buyShopItem,
    isDoubleXpActive,
    doubleXpTimeLeft,
    updateProfile,
  } = useApp();

  const [activeCategory, setActiveCategory] = useState<ShopCategory>('all');
  const [selectedBook, setSelectedBook] = useState<TopBook | null>(null);

  // Tantanali tantana modal holatlari
  const [celebrationItem, setCelebrationItem] = useState<{ item: ShopItem; prize?: any } | null>(null);

  // Telegram Stars so'rov modali
  const [starsModalItem, setStarsModalItem] = useState<ShopItem | null>(null);
  const [starsUsername, setStarsUsername] = useState<string>(() => profile.username || '');
  const [starsSuccess, setStarsSuccess] = useState<string | null>(null);

  // Lo-Fi pleyer holatini global xizmatdan olamiz
  const [isPlayingLofi, setIsPlayingLofi] = useState(() => lofiPlayer.isPlaying());
  const [currentTrackIndex, setCurrentTrackIndex] = useState(() => lofiPlayer.getCurrentIndex());

  useEffect(() => {
    lofiPlayer.setTracks(lofiTracks);
    const unsub = lofiPlayer.subscribe(() => {
      setIsPlayingLofi(lofiPlayer.isPlaying());
      setCurrentTrackIndex(lofiPlayer.getCurrentIndex());
    });
    return unsub;
  }, [lofiTracks]);

  const currentTrack = lofiTracks[currentTrackIndex] || lofiTracks[0];

  const categories: { id: ShopCategory; label: string; icon: string }[] = [
    { id: 'all', label: 'Barchasi', icon: '✨' },
    { id: 'boosters', label: 'Kuchaytirgich', icon: '⚡' },
    { id: 'cosmetics', label: 'Bezaklar', icon: '🎨' },
    { id: 'titles_themes', label: 'Unvon & Mavzu', icon: '👑' },
    { id: 'learning', label: 'Kitob & Lug‘at', icon: '📚' },
    { id: 'special', label: 'Maxsus', icon: '🎁' },
  ];

  const hasLofi = !!profile.hasLofiMusic || (profile.inventory || []).includes('lofi_music') || (profile.inventory || []).includes('lofi_music_pass');

  const filteredItems = shopItems
    .filter(item => {
      if (item.isActive === false) return false;
      if (activeCategory === 'all') return true;
      return item.category === activeCategory;
    })
    .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));

  const inventory = profile.inventory || [];

  const handlePurchase = (item: ShopItem) => {
    // Agar Telegram Stars bo'lsa, username kiritish modalini ochamiz
    if (item.id.startsWith('telegram_stars_')) {
      const balance = profile.coins ?? 50;
      if (balance < item.priceCoins) {
        triggerHaptic('error');
        alert(`Mablag' yetarli emas! Sizda ${balance} tanga bor, bu mahsulot esa ${item.priceCoins} tanga.`);
        return;
      }
      setStarsModalItem(item);
      return;
    }

    // Agar allaqachon xarid qilingan doimiy (permanent) bezak bo'lsa, yoqish/o'chirish
    if (item.itemType === 'permanent' && inventory.includes(item.id)) {
      toggleEquip(item);
      return;
    }

    // Yangi xarid (faqat tangada)
    const res = buyShopItem(item);
    if (res.ok) {
      triggerHaptic('success');
      sfx.win(true);
      setCelebrationItem({ item, prize: res.prize });
    }
  };

  const toggleEquip = (item: ShopItem) => {
    triggerHaptic('selection');
    if (item.id === 'frame_golden') {
      updateProfile({ activeFrame: profile.activeFrame === 'golden' ? '' : 'golden' });
    } else if (item.id === 'frame_fire') {
      updateProfile({ activeFrame: profile.activeFrame === 'fire' ? '' : 'fire' });
    } else if (item.id === 'frame_crystal') {
      updateProfile({ activeFrame: profile.activeFrame === 'crystal' ? '' : 'crystal' });
    } else if (item.id === 'frame_diamond') {
      updateProfile({ activeFrame: profile.activeFrame === 'diamond' ? '' : 'diamond' });
    } else if (item.id === 'frame_laurel') {
      updateProfile({ activeFrame: profile.activeFrame === 'laurel' ? '' : 'laurel' });
    } else if (item.id.startsWith('custom_title_')) {
      const titleName = item.title.replace('Maxsus unvon: ', '').replace(/«|»/g, '');
      updateProfile({ activeTitle: profile.activeTitle === titleName ? '' : titleName });
    } else if (item.id === 'leaderboard_crown') {
      updateProfile({ hasCrown: !profile.hasCrown });
    } else if (item.id === 'gradient_nick') {
      updateProfile({ hasGlowingNick: !profile.hasGlowingNick });
    } else if (item.id === 'vip_badge') {
      updateProfile({ hasVipCheck: !profile.hasVipCheck });
    } else if (item.id.startsWith('theme_')) {
      const th = item.id.replace('theme_', '');
      updateProfile({ activeTheme: profile.activeTheme === th ? '' : th });
    } else if (item.id === 'top_books') {
      setSelectedBook(books[0] || null);
    } else if (item.id === 'lofi_music' || item.id === 'lofi_music_pass') {
      lofiPlayer.toggle();
    }
  };

  const confirmStarsPurchase = () => {
    if (!starsModalItem) return;
    const cleanUn = starsUsername.trim().replace(/^@/, '');
    if (!cleanUn) {
      alert('Iltimos, Telegram @username kiriting!');
      return;
    }
    const res = buyShopItem(starsModalItem, cleanUn);
    if (res.ok) {
      triggerHaptic('success');
      sfx.win(true);
      const starsCount = starsModalItem.id === 'telegram_stars_100' ? 100 : 50;
      setStarsModalItem(null);
      setStarsSuccess(`✅ So‘rovingiz adminga yuborildi! Biroz kuting, admin sizga belgilangan ${starsCount} Starsni @${cleanUn} hisobingizga taqdim etadi.`);
    }
  };

  return (
    <div className="space-y-4 pb-14 max-w-md mx-auto">
      {/* Do'kon sarlavhasi va Balans kartochkasi */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#1A2333] via-[#151C28] to-[#0E1524] border border-amber-500/30 shadow-[0_4px_25px_rgba(245,158,11,0.08)] relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <ShoppingBag className="w-5 h-5 text-slate-950 font-black" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-1.5">
                <span>VocaBoost Do‘koni</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">Faqat Tanga</span>
              </h2>
              <p className="text-[11px] text-slate-400">Tangalaringiz bilan super kuchaytirgichlar va sovg‘alar oling</p>
            </div>
          </div>
        </div>

        {/* Balans: Tanga va XP */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-[#0B0F17]/90 border border-amber-500/40 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-md shadow-amber-500/30">
              🪙
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Tangalar</div>
              <div className="text-lg font-black text-white tabular-nums">
                {(profile.coins ?? 50).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#0B0F17]/90 border border-sky-500/30 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-md shadow-sky-500/20">
              💎
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">Jami XP</div>
              <div className="text-lg font-black text-white tabular-nums">
                {profile.xp.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Faol 2x XP booster taymeri */}
        {isDoubleXpActive && (
          <div className="mt-3 p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-400/40 flex items-center justify-between text-xs text-amber-300">
            <span className="flex items-center gap-1.5 font-bold animate-pulse">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              2x XP kuchaytirgich faol!
            </span>
            <span className="font-extrabold tabular-nums bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-400/30 text-amber-200">
              ⏳ {doubleXpTimeLeft}
            </span>
          </div>
        )}
      </div>

      {/* Lo-Fi Music Widget: faqat xarid qilganlar uchun to'liq faol, bo'lmasa qulflangan holat */}
      {hasLofi ? (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#151C28] border-2 border-indigo-200 dark:border-indigo-500/40 flex items-center justify-between shadow-sm dark:shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPlayingLofi ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 animate-pulse' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40'}`}>
              <Music className="w-4 h-4" />
            </div>
            <div className="min-w-0 pr-2">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Lo-Fi Study Player</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-400/30 font-bold">Ochiq</span>
                {isPlayingLofi && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
              </div>
              <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate mt-0.5">
                {currentTrack?.title || 'Fokus uchun tinch musiqa'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => lofiPlayer.toggle()}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all active:scale-95 ${
                isPlayingLofi ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30' : 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isPlayingLofi ? <Pause className="w-3.5 h-3.5 fill-slate-950" /> : <Play className="w-3.5 h-3.5 fill-slate-800 dark:fill-slate-200" />}
              <span>{isPlayingLofi ? 'Pauza' : 'Ijro'}</span>
            </button>
            <button
              type="button"
              onClick={() => lofiPlayer.next()}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 flex items-center justify-center active:scale-95 transition-all"
              title="Keyingi musiqa"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#131B2A] border-2 border-indigo-200 dark:border-indigo-500/40 flex items-center justify-between shadow-sm dark:shadow-md transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0 shadow-sm">
              <Music className="w-5 h-5" />
            </div>
            <div className="min-w-0 pr-2">
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                <span className="leading-snug">Lo-Fi Music for Studying</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/50 font-bold">
                  🔒 Qulflangan
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate mt-0.5">
                Dars paytida charchoqsiz diqqatni jamlovchi audio pleyer
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-300 font-black text-xs tabular-nums shadow-sm">
              <Coins className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{shopItems.find(x => x.id === 'lofi_music')?.priceCoins ?? 120}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const lofiItem = shopItems.find(x => x.id === 'lofi_music');
                if (lofiItem) handlePurchase(lofiItem);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs active:scale-95 transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              <span>Xarid qilish</span>
              <span>🎧</span>
            </button>
          </div>
        </div>
      )}

      {/* Kategoriyalar filtri */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setActiveCategory(c.id);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
              activeCategory === c.id
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-[#151C28] text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Mahsulotlar ro'yxati: neon/glowing jozibali orqa fon bilan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredItems.map(item => {
          const isOwned = item.itemType === 'permanent' && inventory.includes(item.id);
          const isEquipped = (() => {
            if (!isOwned) return false;
            if (item.id === 'frame_golden' && profile.activeFrame === 'golden') return true;
            if (item.id === 'frame_fire' && profile.activeFrame === 'fire') return true;
            if (item.id === 'frame_crystal' && profile.activeFrame === 'crystal') return true;
            if (item.id === 'frame_diamond' && profile.activeFrame === 'diamond') return true;
            if (item.id === 'frame_laurel' && profile.activeFrame === 'laurel') return true;
            if ((item.id === 'lofi_music' || item.id === 'lofi_music_pass') && hasLofi) return true;
            if (item.id === 'leaderboard_crown' && profile.hasCrown) return true;
            if (item.id === 'gradient_nick' && profile.hasGlowingNick) return true;
            if (item.id === 'vip_badge' && profile.hasVipCheck) return true;
            if (item.id.startsWith('theme_')) {
              const th = item.id.replace('theme_', '');
              return profile.activeTheme === th;
            }
            if (item.id.startsWith('custom_title_')) {
              const titleName = item.title.replace('Maxsus unvon: ', '').replace(/«|»/g, '');
              return profile.activeTitle === titleName;
            }
            return false;
          })();

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden shadow-lg ${
                isEquipped
                  ? 'bg-gradient-to-br from-amber-500/15 via-[#182336] to-[#111827] border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.18)]'
                  : 'bg-gradient-to-br from-[#161F2E] to-[#0F1622] border-slate-800/90 hover:border-amber-500/40 shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
              }`}
            >
              {/* Neon aura effekti */}
              <div
                className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-25"
                style={{ backgroundColor: item.neonColor || '#f59e0b' }}
              />

              {/* Badge */}
              {item.badge && (
                <span
                  className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md border text-[10px] font-black shadow-sm"
                  style={{
                    backgroundColor: item.neonColor ? `${item.neonColor}25` : 'rgba(251,191,36,0.2)',
                    borderColor: item.neonColor ? `${item.neonColor}66` : 'rgba(251,191,36,0.4)',
                    color: item.neonColor || '#fcd34d',
                  }}
                >
                  {item.badge}
                </span>
              )}

              <div>
                {/* Icon & Title */}
                <div className="flex items-start gap-2.5 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#0D1420] border border-amber-500/20 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                    {item.icon || '🛍️'}
                  </div>
                  <div className="min-w-0 pr-10">
                    <h3 className="text-sm font-extrabold text-white truncate leading-snug">{item.title}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price & Action button: FAQAT TANGA */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 tabular-nums">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>{item.priceCoins} tanga</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isOwned ? (
                    <button
                      type="button"
                      onClick={() => handlePurchase(item)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1 ${
                        isEquipped
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-sm'
                          : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-sm'
                      }`}
                    >
                      {isEquipped ? '✓ Faol (O‘chirish)' : 'Yoqish'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePurchase(item)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 active:scale-95 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20"
                    >
                      Olish
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tantanali Taqdim Etish (Celebration / Reward) Modali */}
      {celebrationItem && (
        <div className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1C2538] to-[#0E1524] border-2 border-amber-400/80 p-6 text-center space-y-4 shadow-[0_0_40px_rgba(251,191,36,0.25)] relative animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-400 to-yellow-300 flex items-center justify-center text-4xl shadow-2xl shadow-amber-500/40 animate-bounce">
              {celebrationItem.item.icon || '🎉'}
            </div>
            <div>
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Muvaffaqiyatli xarid!
              </span>
              <h3 className="text-xl font-black text-white mt-1.5">{celebrationItem.item.title}</h3>
              <p className="text-xs text-slate-300 mt-1">
                {celebrationItem.item.description}
              </p>
            </div>

            {celebrationItem.prize && (
              <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-xl font-black text-amber-300">
                {celebrationItem.prize.text}
              </div>
            )}

            <div className="p-3 rounded-2xl bg-[#090D15] border border-slate-800 text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Sovg‘a profilingizga darhol biriktirildi!</span>
            </div>

            <button
              type="button"
              onClick={() => setCelebrationItem(null)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-sm active:scale-95 transition-all shadow-lg shadow-amber-500/25"
            >
              Ajoyib, Rahmat! 🚀
            </button>
          </div>
        </div>
      )}

      {/* Telegram Stars Buy Modal (Usernameni kiritish) */}
      {starsModalItem && (
        <div className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1A2333] to-[#0E1524] border border-amber-500/50 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-3xl shadow-xl shadow-amber-500/30">
                ⭐
              </div>
              <h3 className="text-lg font-black text-white">{starsModalItem.title}</h3>
              <p className="text-xs text-slate-400">
                Narxi: <b className="text-amber-400 font-extrabold">{starsModalItem.priceCoins} tanga</b>. Stars to‘g‘ridan-to‘g‘ri sizning Telegram akkauntingizga yuboriladi.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Telegram profilingiz username:</label>
              <div className="flex items-center rounded-xl bg-[#0B0F17] border border-slate-700 focus-within:border-amber-400 px-3 py-2 text-white">
                <span className="text-slate-500 font-bold mr-1">@</span>
                <input
                  type="text"
                  value={starsUsername}
                  onChange={e => setStarsUsername(e.target.value)}
                  placeholder="username"
                  className="bg-transparent w-full text-sm font-bold focus:outline-none text-white placeholder-slate-600"
                />
              </div>
              <p className="text-[10px] text-slate-500">Iltimos, o‘zingizning haqiqiy Telegram @usernamingizni xatosiz kiriting.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStarsModalItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={confirmStarsPurchase}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Olish ({starsModalItem.priceCoins} 🪙)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Stars Muvaffaqiyat Xabari */}
      {starsSuccess && (
        <div className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1C2538] to-[#0E1524] border border-emerald-500/50 p-6 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl">
              ⭐
            </div>
            <div>
              <h3 className="text-lg font-black text-white">So‘rovingiz Qabul Qilindi!</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {starsSuccess}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStarsSuccess(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs active:scale-95 transition-all shadow-md shadow-emerald-500/20"
            >
              Tushundim
            </button>
          </div>
        </div>
      )}

      {/* Book Reader Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
          <div className="w-full max-w-lg max-h-[85vh] rounded-3xl bg-[#151C28] border border-slate-700 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white">{selectedBook.title}</h3>
                <p className="text-xs text-slate-400">{selectedBook.author} · Daraja: {selectedBook.level}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-200 leading-relaxed font-serif">
              <p className="text-xs text-amber-400 font-sans font-bold bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/30">
                📖 {selectedBook.desc}
              </p>
              <div className="whitespace-pre-line text-slate-300 bg-[#0E1524] p-4 rounded-2xl border border-slate-800">
                {selectedBook.content || "Kitob matni tez kunda to'liq yuklanadi."}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-[#0E1524]">
              {selectedBook.readUrl ? (
                <a
                  href={selectedBook.readUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4" /> To‘liq kitobni ochish
                </a>
              ) : <div />}
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
