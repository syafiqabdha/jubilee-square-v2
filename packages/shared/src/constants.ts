export const CATEGORIES = [
  { slug: 'dine', name: 'Dine', shortCode: 'FNB', color: '#EF4444', icon: 'utensils' },
  { slug: 'learn', name: 'Learn', shortCode: 'EDU', color: '#3B82F6', icon: 'graduation-cap' },
  { slug: 'relax', name: 'Relax', shortCode: 'WLN', color: '#EC4899', icon: 'sparkles' },
  { slug: 'shop', name: 'Shop', shortCode: 'RET', color: '#F59E0B', icon: 'shopping-bag' },
  { slug: 'services', name: 'Services', shortCode: 'SVC', color: '#10B981', icon: 'heart-pulse' },
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
