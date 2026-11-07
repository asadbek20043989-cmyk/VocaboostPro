import type { EnglishLevel } from '../types';

/** Darajalarning yagona nomlari — ilovaning hamma joyida (onboarding, bosh sahifa, sozlamalar) shu yerdan olinadi */
export const LEVEL_NAMES: Record<EnglishLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Pre-Intermediate',
  B2: 'Intermediate',
  C1: 'Advanced',
  C2: 'Proficiency / Master',
};

export const LEVEL_IELTS: Record<EnglishLevel, string> = {
  A1: 'IELTS 2.0-3.0',
  A2: 'IELTS 3.5-4.0',
  B1: 'IELTS 4.5-5.0',
  B2: 'IELTS 5.5-6.5',
  C1: 'IELTS 7.0-8.0',
  C2: 'IELTS 8.5-9.0',
};

export const levelLabel = (l: string): string => `${l} · ${LEVEL_NAMES[l as EnglishLevel] || ''}`.trim();
