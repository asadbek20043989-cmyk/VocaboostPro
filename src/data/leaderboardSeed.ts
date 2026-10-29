import { AchievementBadge } from '../types';

export const INITIAL_BADGES: AchievementBadge[] = [
  { id: 'badge-first-step', title: 'First Step', titleUz: 'Birinchi qadam', descriptionUz: "Birinchi 10 ta so'zni o'rganing", icon: '🚀', unlocked: false },
  { id: 'badge-word-master', title: 'Word Collector', titleUz: "So'z yig'uvchi", descriptionUz: "50 ta so'z o'rganing", icon: '📚', unlocked: false },
  { id: 'badge-flashcard-champ', title: 'Memory Champ', titleUz: 'Xotira chempioni', descriptionUz: "25 ta so'zni to'liq yodlang", icon: '🧠', unlocked: false },
  { id: 'badge-streak-fire', title: 'On Fire', titleUz: 'Olov seriya', descriptionUz: '3 kunlik streakka erishing', icon: '🔥', unlocked: false },
  { id: 'badge-quiz-ace', title: 'Game Ace', titleUz: "O'yin ustasi", descriptionUz: "5 ta o'yinni muvaffaqiyatli tugating", icon: '🎮', unlocked: false },
];
