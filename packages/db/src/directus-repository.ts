/**
 * Jubilee Square v2 — Directus Headless CMS REST Catalog Repository
 *
 * Implements CatalogRepository against Directus 11 REST endpoints.
 * Enables live content synchronization directly from Directus collections.
 */

import type {
  Category,
  Tenant,
  Promotion,
  SignageSlide,
  SignageDirectoryFloorGroup,
  TenantFilterParams,
  FloorLevel,
  OperatingHours,
  Amenity,
} from '@jubilee/shared';
import { type CatalogRepository } from './repository.js';
import { SEED_CATEGORIES } from './seed-data.js';

export interface DirectusCatalogRepositoryOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
}

export class DirectusCatalogRepository implements CatalogRepository {
  private baseUrl: string;
  private token?: string;
  private timeoutMs: number;

  constructor(options: DirectusCatalogRepositoryOptions = {}) {
    this.baseUrl = (options.baseUrl || process.env.DIRECTUS_URL || 'http://localhost:8055').replace(/\/$/, '');
    this.token = options.token || process.env.DIRECTUS_TOKEN;
    this.timeoutMs = options.timeoutMs ?? 3000;
  }

  private async fetchDirectus<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`Directus API request failed [${res.status}]: ${res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async getCategories(): Promise<Category[]> {
    const res = await this.fetchDirectus<{ data: any[] }>('/items/categories?sort=display_order&fields=*,tenants.id,tenants.is_active');
    return res.data.map(this.mapCategory);
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const res = await this.fetchDirectus<{ data: any[] }>(
      `/items/categories?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1&fields=*,tenants.id,tenants.is_active`
    );
    if (!res.data || res.data.length === 0) return null;
    return this.mapCategory(res.data[0]);
  }

  async getTenants(params: TenantFilterParams = {}): Promise<{ tenants: Tenant[]; total: number }> {
    const queryParts: string[] = ['filter[is_active][_eq]=true', 'sort=display_order'];

    if (params.category) {
      queryParts.push(`filter[_or][0][category_id][slug][_eq]=${encodeURIComponent(params.category)}`);
      queryParts.push(`filter[_or][1][category_id][_eq]=${encodeURIComponent(params.category)}`);
    }

    if (params.floor) {
      queryParts.push(`filter[floor_level][_eq]=${encodeURIComponent(params.floor)}`);
    }

    if (params.featured !== undefined) {
      queryParts.push(`filter[is_featured][_eq]=${params.featured}`);
    }

    if (params.search && params.search.trim()) {
      queryParts.push(`search=${encodeURIComponent(params.search.trim())}`);
    }

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    queryParts.push(`limit=${limit}`);
    queryParts.push(`offset=${offset}`);
    queryParts.push('meta=total_count');
    queryParts.push('fields=*,category_id.*');

    const path = `/items/tenants?${queryParts.join('&')}`;
    const res = await this.fetchDirectus<{ data: any[]; meta?: { total_count?: number } }>(path);

    const total = res.meta?.total_count ?? res.data.length;
    return {
      tenants: res.data.map(this.mapTenant),
      total,
    };
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    try {
      const res = await this.fetchDirectus<{ data: any }>(
        `/items/tenants/${encodeURIComponent(id)}?fields=*,category_id.*,operating_hours.*,promotions.*`
      );
      if (!res.data) return null;
      return this.mapTenant(res.data);
    } catch (err: any) {
      if (err.message && err.message.includes('404')) return null;
      throw err;
    }
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const res = await this.fetchDirectus<{ data: any[] }>(
      `/items/tenants?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1&fields=*,category_id.*,operating_hours.*,promotions.*`
    );
    if (!res.data || res.data.length === 0) return null;
    return this.mapTenant(res.data[0]);
  }

  async getTenantsByCategory(categorySlug: string): Promise<Tenant[]> {
    const res = await this.fetchDirectus<{ data: any[] }>(
      `/items/tenants?filter[is_active][_eq]=true&filter[category_id][slug][_eq]=${encodeURIComponent(categorySlug)}&sort=display_order&fields=*,category_id.*`
    );
    return res.data.map(this.mapTenant);
  }

  async getPromotions(activeOnly: boolean = true): Promise<Promotion[]> {
    let path = '/items/promotions?sort=display_order&fields=*,tenant_id.*';
    if (activeOnly) {
      path += '&filter[is_active][_eq]=true';
    }
    const res = await this.fetchDirectus<{ data: any[] }>(path);
    return res.data.map(this.mapPromotion);
  }

  async getPromotionBySlug(slug: string): Promise<Promotion | null> {
    const res = await this.fetchDirectus<{ data: any[] }>(
      `/items/promotions?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1&fields=*,tenant_id.*`
    );
    if (!res.data || res.data.length === 0) return null;
    return this.mapPromotion(res.data[0]);
  }

  async getSignageSlides(location: string = 'all'): Promise<SignageSlide[]> {
    let path = '/items/signage_slides?filter[is_active][_eq]=true&sort=priority&fields=*,tenant_id.*';
    const res = await this.fetchDirectus<{ data: any[] }>(path);
    const slides = res.data.map(this.mapSignageSlide);

    if (location === 'all') return slides;
    return slides.filter(
      (s) => s.targetLocations.includes('all') || s.targetLocations.includes(location)
    );
  }

  async getSignageDirectory(): Promise<SignageDirectoryFloorGroup[]> {
    const res = await this.fetchDirectus<{ data: any[] }>(
      '/items/tenants?filter[is_active][_eq]=true&sort=floor_level,unit_number&fields=name,slug,floor_level,unit_number,summary,logo_url,phone,category_id.*'
    );
    const tenants = res.data.map(this.mapTenant);

    const floors: FloorLevel[] = ['L1', 'L2', 'L3', 'L4'];
    const floorTitles: Record<FloorLevel, string> = {
      L1: 'Level 1 — Dining, Retail & Services',
      L2: 'Level 2 — Dining & Wellness',
      L3: 'Level 3 — Education & Enrichment Hub',
      L4: 'Level 4 — Music, Preschool & Martial Arts',
      B1: 'Basement 1 — Parking & Access',
    };

    return floors.map((fl) => ({
      floorLevel: fl,
      floorTitle: floorTitles[fl],
      tenants: tenants
        .filter((t) => t.floorLevel === fl)
        .map((t) => ({
          floorLevel: t.floorLevel,
          unitNumber: t.unitNumber,
          tenantName: t.name,
          tenantSlug: t.slug,
          categoryName: t.categoryName || 'General',
          categorySlug: t.categorySlug || 'general',
          categoryIcon: t.categorySlug ? (SEED_CATEGORIES.find((c) => c.slug === t.categorySlug)?.icon || null) : null,
          summary: t.summary,
          logoUrl: t.logoUrl,
          phone: t.phone,
        })),
    }));
  }

  async searchTenants(query: string): Promise<Tenant[]> {
    if (!query || !query.trim()) return [];
    const res = await this.fetchDirectus<{ data: any[] }>(
      `/items/tenants?filter[is_active][_eq]=true&search=${encodeURIComponent(query.trim())}&fields=*,category_id.*`
    );
    return res.data.map(this.mapTenant);
  }

  async close(): Promise<void> {}
  async end(): Promise<void> {}

  private mapCategory = (r: any): Category => {
    const activeTenants = Array.isArray(r.tenants)
      ? r.tenants.filter((t: any) => t.is_active !== false).length
      : 0;

    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      shortCode: r.short_code,
      description: r.description,
      icon: r.icon,
      accentColor: r.accent_color,
      displayOrder: r.display_order ?? 0,
      tenantCount: r.tenantCount !== undefined ? parseInt(r.tenantCount, 10) : activeTenants,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  };

  private mapTenant = (r: any): Tenant => {
    let catSlug = r.category_slug;
    let catName = r.category_name;
    let catColor = undefined;
    let catId = r.category_id;

    if (typeof r.category_id === 'object' && r.category_id !== null) {
      catId = r.category_id.id;
      catSlug = r.category_id.slug;
      catName = r.category_id.name;
      catColor = r.category_id.accent_color;
    }

    if (!catColor && catSlug) {
      const seedCat = SEED_CATEGORIES.find((c) => c.slug === catSlug);
      if (seedCat) catColor = seedCat.accentColor;
    }

    let operatingHours: OperatingHours[] | undefined;
    if (Array.isArray(r.operating_hours)) {
      operatingHours = r.operating_hours.map((oh: any) => ({
        id: oh.id,
        tenantId: oh.tenant_id,
        dayOfWeek: oh.day_of_week,
        dayName: oh.day_name,
        openTime: oh.open_time,
        closeTime: oh.close_time,
        isClosed: oh.is_closed ?? false,
        specialNotes: oh.special_notes,
      }));
    }

    let promotions: Promotion[] | undefined;
    if (Array.isArray(r.promotions)) {
      promotions = r.promotions.map((p: any) => this.mapPromotion(p));
    }

    return {
      id: r.id,
      categoryId: catId,
      categorySlug: catSlug,
      categoryName: catName,
      categoryColor: catColor,
      slug: r.slug,
      name: r.name,
      floorLevel: r.floor_level,
      unitNumber: r.unit_number,
      summary: r.summary,
      description: r.description,
      phone: r.phone,
      whatsapp: r.whatsapp,
      email: r.email,
      website: r.website,
      logoUrl: r.logo_url,
      heroImageUrl: r.hero_image_url,
      gallery: Array.isArray(r.gallery) ? r.gallery : [],
      socialLinks: typeof r.social_links === 'object' && r.social_links !== null ? r.social_links : {},
      tags: Array.isArray(r.tags) ? r.tags : [],
      metadata: typeof r.metadata === 'object' && r.metadata !== null ? r.metadata : {},
      isActive: r.is_active ?? true,
      isFeatured: r.is_featured ?? false,
      displayOrder: r.display_order ?? 0,
      operatingHours,
      promotions,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  };

  private mapPromotion = (r: any): Promotion => {
    let tenantName = r.tenant_name;
    let tenantSlug = r.tenant_slug;
    let tenantId = r.tenant_id;

    if (typeof r.tenant_id === 'object' && r.tenant_id !== null) {
      tenantId = r.tenant_id.id;
      tenantName = r.tenant_id.name;
      tenantSlug = r.tenant_id.slug;
    }

    return {
      id: r.id,
      tenantId,
      tenantName,
      tenantSlug,
      title: r.title,
      slug: r.slug,
      summary: r.summary,
      description: r.description,
      bannerUrl: r.banner_url,
      badgeText: r.badge_text,
      termsConditions: r.terms_conditions,
      startDate: r.start_date,
      endDate: r.end_date,
      isActive: r.is_active ?? true,
      isFeatured: r.is_featured ?? false,
      displayOrder: r.display_order ?? 0,
    };
  };

  private mapSignageSlide = (r: any): SignageSlide => {
    let tenant = null;
    let tenantId = r.tenant_id;
    if (typeof r.tenant_id === 'object' && r.tenant_id !== null) {
      tenantId = r.tenant_id.id;
      tenant = {
        name: r.tenant_id.name,
        slug: r.tenant_id.slug,
        unitNumber: r.tenant_id.unit_number,
        floorLevel: r.tenant_id.floor_level,
      };
    }

    return {
      id: r.id,
      title: r.title,
      slideType: r.slide_type,
      mediaUrl: r.media_url,
      durationSeconds: r.duration_seconds,
      targetLocations: Array.isArray(r.target_locations) ? r.target_locations : ['all'],
      tenantId,
      tenant,
      headline: r.headline,
      subheadline: r.subheadline,
      isActive: r.is_active ?? true,
      priority: r.priority ?? 1,
      startDate: r.start_date,
      endDate: r.end_date,
    };
  };
}
