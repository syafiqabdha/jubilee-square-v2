import type { FloorLevel } from './constants.js';

export interface Category {
  id: string;
  slug: string;
  name: string;
  shortCode: string;
  description: string | null;
  icon: string | null;
  accentColor: string;
  displayOrder: number;
  tenantCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Amenity {
  id: string;
  code: string;
  name: string;
  icon: string;
  description?: string | null;
}

export interface OperatingHours {
  id?: string;
  tenantId?: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon ...
  dayName: string;
  openTime: string | null; // e.g. "10:00:00"
  closeTime: string | null; // e.g. "21:30:00"
  isClosed: boolean;
  specialNotes?: string | null;
}

export interface Promotion {
  id: string;
  tenantId: string | null;
  tenantName?: string;
  tenantSlug?: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  bannerUrl: string;
  badgeText: string | null;
  termsConditions: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;
}

export interface Tenant {
  id: string;
  categoryId: string;
  categorySlug?: string;
  categoryName?: string;
  categoryColor?: string;
  slug: string;
  name: string;
  floorLevel: FloorLevel;
  unitNumber: string;
  summary: string;
  description: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  gallery: string[];
  socialLinks: Record<string, string>;
  tags: string[];
  metadata: Record<string, any>;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;
  amenities?: Amenity[];
  operatingHours?: OperatingHours[];
  promotions?: Promotion[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SignageSlide {
  id: string;
  title: string;
  slideType: 'image' | 'video' | 'tenant_spotlight' | 'html';
  mediaUrl: string;
  durationSeconds: number;
  targetLocations: string[];
  tenantId: string | null;
  tenant?: {
    name: string;
    slug: string;
    unitNumber: string;
    floorLevel: string;
  } | null;
  headline: string | null;
  subheadline: string | null;
  isActive: boolean;
  priority: number;
  startDate?: string;
  endDate?: string;
}

export interface SignageDirectoryEntry {
  floorLevel: FloorLevel;
  unitNumber: string;
  tenantName: string;
  tenantSlug: string;
  categoryName: string;
  categorySlug: string;
  categoryIcon: string | null;
  summary: string;
  logoUrl: string | null;
  phone: string | null;
}

export interface SignageDirectoryFloorGroup {
  floorLevel: FloorLevel;
  floorTitle: string;
  tenants: SignageDirectoryEntry[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    timestamp?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface TenantFilterParams {
  category?: string;
  floor?: FloorLevel;
  featured?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}
