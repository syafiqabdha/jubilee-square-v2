import type { Category, Tenant, Amenity, Promotion, SignageSlide } from '@jubilee/shared';
import {
  SEED_CATEGORIES,
  SEED_AMENITIES,
  SEED_TENANTS,
  SEED_PROMOTIONS,
  SEED_SIGNAGE_SLIDES,
} from '@jubilee/db';

export {
  SEED_CATEGORIES as FALLBACK_CATEGORIES,
  SEED_AMENITIES as FALLBACK_AMENITIES,
  SEED_TENANTS as FALLBACK_TENANTS,
  SEED_PROMOTIONS as FALLBACK_PROMOTIONS,
  SEED_SIGNAGE_SLIDES as FALLBACK_SIGNAGE_SLIDES,
};

export const MALI_INFO = {
  name: 'Jubilee Square',
  location: '61 Ang Mo Kio Ave 8, Singapore 569814',
  mrt: 'Ang Mo Kio MRT (NS16) Exit C — 2 min walk',
  phone: '+65 6451 2388',
  email: 'info@jubileesq.com.sg',
  hours: '10:00 AM – 10:00 PM Daily',
  totalTenants: SEED_TENANTS.length,
  floors: ['L1', 'L2', 'L3', 'L4'],
};
