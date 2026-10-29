import { DailyQuest } from '../types';

// Admin paneldagi (public/admin.html) POOL bilan bir xil `id` lardan foydalaning!
export const QUEST_POOL: Omit<DailyQuest, 'current' | 'completed' | 'claimed'>[] = [
  { id: 'learn-5', title: 'Learn 5 new words', titleUz: "5 ta yangi so'z o'rganish", target: 5, xpReward: 20, type: 'learn_words' },
  { id: 'learn-10', title: 'Learn 10 new words', titleUz: "10 ta yangi so'z o'rganish", target: 10, xpReward: 35, type: 'learn_words' },
  { id: 'review-10', title: 'Review 10 words', titleUz: "10 ta so'zni takrorlash", target: 10, xpReward: 25, type: 'review_words' },
  { id: 'review-20', title: 'Review 20 words', titleUz: "20 ta so'zni takrorlash", target: 20, xpReward: 40, type: 'review_words' },
  { id: 'game-1', title: 'Play 1 game', titleUz: "1 ta o'yin o'ynash", target: 1, xpReward: 15, type: 'play_game' },
  { id: 'game-3', title: 'Play 3 games', titleUz: "3 ta turli o'yin o'ynash", target: 3, xpReward: 35, type: 'play_game' },
  { id: 'wheel-1', title: 'Spin the wheel', titleUz: "Omadli barabanni 1 marta aylantirish", target: 1, xpReward: 15, type: 'spin_wheel' },
  { id: 'master-1', title: 'Master 1 word', titleUz: "1 ta so'zni to'liq yodlash (3 xil kunda to'g'ri javob)", target: 1, xpReward: 30, type: 'master_words' },
  { id: 'perfect-1', title: 'Perfect round', titleUz: "Bitta o'yin yoki mashqni xatosiz tugatish", target: 1, xpReward: 30, type: 'perfect_round' },
];

export const DEFAULT_QUEST_IDS = ['learn-5', 'review-10', 'game-1'];

export function buildQuests(ids: string[], previous: DailyQuest[] = []): DailyQuest[] {
  const list = ids.map(id => QUEST_POOL.find(q => q.id === id)).filter(Boolean) as typeof QUEST_POOL;
  const base = list.length === 3 ? list : DEFAULT_QUEST_IDS.map(id => QUEST_POOL.find(q => q.id === id)!);
  return base.map(q => {
    const old = previous.find(p => p.id === q.id);
    return { ...q, current: old?.current ?? 0, completed: old?.completed ?? false, claimed: old?.claimed ?? false };
  });
}
