import type {
  Category,
  Tenant,
  Promotion,
  SignageSlide,
  SignageDirectoryFloorGroup,
  TenantFilterParams,
  FloorLevel,
} from '@jubilee/shared';
import {
  SEED_CATEGORIES,
  SEED_TENANTS,
  SEED_PROMOTIONS,
  SEED_SIGNAGE_SLIDES,
  SEED_AMENITIES,
} from './seed-data.js';

export interface CatalogRepository {
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | null>;
  getTenants(params?: TenantFilterParams): Promise<{ tenants: Tenant[]; total: number }>;
  getTenantById(id: string): Promise<Tenant | null>;
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  getTenantsByCategory(categorySlug: string): Promise<Tenant[]>;
  getPromotions(activeOnly?: boolean): Promise<Promotion[]>;
  getPromotionBySlug(slug: string): Promise<Promotion | null>;
  getSignageSlides(location?: string): Promise<SignageSlide[]>;
  getSignageDirectory(): Promise<SignageDirectoryFloorGroup[]>;
  searchTenants(query: string): Promise<Tenant[]>;
}

export class InMemoryCatalogRepository implements CatalogRepository {
  private categories: Category[] = JSON.parse(JSON.stringify(SEED_CATEGORIES));
  private tenants: Tenant[] = JSON.parse(JSON.stringify(SEED_TENANTS));
  private promotions: Promotion[] = JSON.parse(JSON.stringify(SEED_PROMOTIONS));
  private signageSlides: SignageSlide[] = JSON.parse(JSON.stringify(SEED_SIGNAGE_SLIDES));

  async getCategories(): Promise<Category[]> {
    return this.categories
      .map((cat) => ({
        ...cat,
        tenantCount: this.tenants.filter((t) => t.categorySlug === cat.slug && t.isActive).length,
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const cat = this.categories.find((c) => c.slug.toLowerCase() === slug.toLowerCase());
    if (!cat) return null;
    const count = this.tenants.filter((t) => t.categorySlug === cat.slug && t.isActive).length;
    return { ...cat, tenantCount: count };
  }

  async getTenants(params: TenantFilterParams = {}): Promise<{ tenants: Tenant[]; total: number }> {
    let filtered = this.tenants.filter((t) => t.isActive);

    if (params.category) {
      filtered = filtered.filter(
        (t) => t.categorySlug?.toLowerCase() === params.category?.toLowerCase() || t.categoryId === params.category
      );
    }

    if (params.floor) {
      filtered = filtered.filter((t) => t.floorLevel.toLowerCase() === params.floor?.toLowerCase());
    }

    if (params.featured !== undefined) {
      filtered = filtered.filter((t) => t.isFeatured === params.featured);
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.unitNumber.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const offset = params.offset || 0;
    const limit = params.limit || 50;

    const tenants = filtered
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(offset, offset + limit);

    return { tenants, total };
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    const tenant = this.tenants.find((t) => t.id === id);
    if (!tenant) return null;
    const promos = this.promotions.filter((p) => p.tenantId === tenant.id && p.isActive);
    return { ...tenant, promotions: promos };
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const tenant = this.tenants.find((t) => t.slug.toLowerCase() === slug.toLowerCase());
    if (!tenant) return null;
    const promos = this.promotions.filter((p) => p.tenantId === tenant.id && p.isActive);
    return { ...tenant, promotions: promos };
  }

  async getTenantsByCategory(categorySlug: string): Promise<Tenant[]> {
    return this.tenants
      .filter((t) => t.categorySlug?.toLowerCase() === categorySlug.toLowerCase() && t.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getPromotions(activeOnly: boolean = true): Promise<Promotion[]> {
    let promos = this.promotions;
    if (activeOnly) {
      promos = promos.filter((p) => p.isActive);
    }
    return promos.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getPromotionBySlug(slug: string): Promise<Promotion | null> {
    return this.promotions.find((p) => p.slug.toLowerCase() === slug.toLowerCase()) || null;
  }

  async getSignageSlides(location: string = 'all'): Promise<SignageSlide[]> {
    return this.signageSlides
      .filter((s) => {
        if (!s.isActive) return false;
        if (location === 'all') return true;
        return s.targetLocations.includes('all') || s.targetLocations.includes(location);
      })
      .sort((a, b) => a.priority - b.priority);
  }

  async getSignageDirectory(): Promise<SignageDirectoryFloorGroup[]> {
    const floors: FloorLevel[] = ['L1', 'L2', 'L3', 'L4'];
    const floorTitles: Record<FloorLevel, string> = {
      L1: 'Level 1 — Dining, Retail & Services',
      L2: 'Level 2 — Dining & Wellness',
      L3: 'Level 3 — Education & Enrichment Hub',
      L4: 'Level 4 — Music, Preschool & Martial Arts',
      B1: 'Basement 1 — Parking & Access',
    };

    return floors.map((fl) => {
      const floorTenants = this.tenants
        .filter((t) => t.floorLevel === fl && t.isActive)
        .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber))
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
        }));

      return {
        floorLevel: fl,
        floorTitle: floorTitles[fl],
        tenants: floorTenants,
      };
    });
  }

  async searchTenants(query: string): Promise<Tenant[]> {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);

    return this.tenants
      .filter((t) => {
        if (!t.isActive) return false;
        const haystack = [
          t.name,
          t.unitNumber,
          t.floorLevel,
          t.categoryName || '',
          t.categorySlug || '',
          t.summary,
          t.description,
          ...t.tags,
        ]
          .join(' ')
          .toLowerCase();

        return terms.every((term) => haystack.includes(term));
      })
      .sort((a, b) => {
        // Boost exact prefix match on name
        const aExact = a.name.toLowerCase().startsWith(q) ? 10 : 0;
        const bExact = b.name.toLowerCase().startsWith(q) ? 10 : 0;
        return bExact - aExact;
      });
  }
}
