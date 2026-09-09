export const BRAND_COLORS = {
  navy: '#252F81', // Pantone 2745 C
  navyDark: '#1A2160',
  navyLight: '#EAEBF5',
  magenta: '#C60A4D', // Pantone 207 C
  magentaDark: '#9E083E',
  magentaLight: '#FDF2F5',
  canvas: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  borderHover: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
} as const;

export const CATEGORY_EMOJI_MAP: Record<string, string> = {
  dine: '🍜',
  learn: '📚',
  relax: '💆',
  shop: '🛍️',
  services: '🩺',
};

export const CATEGORIES = [
  { slug: 'dine', name: 'Dine', shortCode: 'FNB', color: '#C60A4D', icon: 'utensils', emoji: '🍜' },
  { slug: 'learn', name: 'Learn', shortCode: 'EDU', color: '#252F81', icon: 'graduation-cap', emoji: '📚' },
  { slug: 'relax', name: 'Relax', shortCode: 'WLN', color: '#7C3AED', icon: 'sparkles', emoji: '💆' },
  { slug: 'shop', name: 'Shop', shortCode: 'RET', color: '#D97706', icon: 'shopping-bag', emoji: '🛍️' },
  { slug: 'services', name: 'Services', shortCode: 'SVC', color: '#059669', icon: 'heart-pulse', emoji: '🩺' },
] as const;

export type CategorySlug = typeof CATEGORIES[number]['slug'];

export const FLOOR_LEVELS = ['L1', 'L2', 'L3', 'L4', 'B1'] as const;
export type FloorLevel = typeof FLOOR_LEVELS[number];

export const SIGNAGE_LOCATIONS = [
  'all',
  'L1_lift',
  'L1_counter',
  'L2_lift',
  'L2_escalator',
  'L3_lift',
  'L3_ceiling',
  'L4_lift',
] as const;
export type SignageLocation = typeof SIGNAGE_LOCATIONS[number];
