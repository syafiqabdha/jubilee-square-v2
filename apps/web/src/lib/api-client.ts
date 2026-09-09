import type {
  Category,
  Tenant,
  Promotion,
  SignageSlide,
  SignageDirectoryFloorGroup,
  SignageDirectoryEntry,
  ApiResponse,
  FloorLevel,
} from '@jubilee/shared';
import {
  FALLBACK_CATEGORIES,
  FALLBACK_TENANTS,
  FALLBACK_PROMOTIONS,
  FALLBACK_SIGNAGE_SLIDES,
} from './tenant-roster.js';

const API_BASE_URL = process.env.CATALOG_API_URL || process.env.PUBLIC_API_URL || 'http://localhost:3000';

export class JubileeApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`API error ${res.status}: ${res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async getCategories(): Promise<Category[]> {
    try {
      const res = await this.fetchJson<ApiResponse<Category[]>>('/api/v1/categories');
      return res.data;
    } catch {
      return FALLBACK_CATEGORIES;
    }
  }

  async getTenantsByCategory(slug: string): Promise<{ category: Category; tenants: Tenant[] }> {
    try {
      const res = await this.fetchJson<ApiResponse<{ category: Category; tenants: Tenant[] }>>(
        `/api/v1/categories/${slug}/tenants`
      );
      return res.data;
    } catch {
      const category = FALLBACK_CATEGORIES.find((c) => c.slug === slug);
      if (!category) {
        throw new Error(`Category not found: ${slug}`);
      }
      const tenants = FALLBACK_TENANTS.filter((t) => t.categorySlug === slug);
      return { category, tenants };
    }
  }

  async getTenants(filters?: {
    category?: string;
    floor?: FloorLevel;
    featured?: boolean;
    search?: string;
  }): Promise<{ tenants: Tenant[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.floor) params.append('floor', filters.floor);
      if (filters?.featured !== undefined) params.append('featured', String(filters.featured));
      if (filters?.search) params.append('search', filters.search);

      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await this.fetchJson<ApiResponse<Tenant[]>>(`/api/v1/tenants${query}`);
      return {
        tenants: res.data,
        total: res.meta?.total ?? res.data.length,
      };
    } catch {
      let filtered = [...FALLBACK_TENANTS];
      if (filters?.category) {
        filtered = filtered.filter((t) => t.categorySlug === filters.category);
      }
      if (filters?.floor) {
        filtered = filtered.filter((t) => t.floorLevel === filters.floor);
      }
      if (filters?.featured !== undefined) {
        filtered = filtered.filter((t) => t.isFeatured === filters.featured);
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.summary.toLowerCase().includes(q) ||
            t.unitNumber.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      }
      return {
        tenants: filtered,
        total: filtered.length,
      };
    }
  }

  async getTenantBySlug(slug: string): Promise<Tenant> {
    try {
      const res = await this.fetchJson<ApiResponse<Tenant>>(`/api/v1/tenants/by-slug/${slug}`);
      return res.data;
    } catch {
      const tenant = FALLBACK_TENANTS.find((t) => t.slug === slug);
      if (!tenant) {
        throw new Error(`Tenant not found: ${slug}`);
      }
      return tenant;
    }
  }

  async getPromotions(): Promise<Promotion[]> {
    try {
      const res = await this.fetchJson<ApiResponse<Promotion[]>>('/api/v1/promotions');
      return res.data;
    } catch {
      return FALLBACK_PROMOTIONS;
    }
  }

  async getSignageFeatured(location: string = 'all'): Promise<{
    displayLocation: string;
    slides: SignageSlide[];
  }> {
    try {
      const res = await this.fetchJson<
        ApiResponse<{ displayLocation: string; refreshIntervalMs: number; totalSlides: number; slides: SignageSlide[] }>
      >(`/api/v1/signage/featured?location=${location}`);
      return res.data;
    } catch {
      const filtered =
        location === 'all'
          ? FALLBACK_SIGNAGE_SLIDES
          : FALLBACK_SIGNAGE_SLIDES.filter(
              (s) => s.targetLocations.includes('all') || s.targetLocations.includes(location)
            );
      return {
        displayLocation: location,
        slides: filtered,
      };
    }
  }

  async getSignageDirectory(): Promise<{
    mallName: string;
    floors: SignageDirectoryFloorGroup[];
  }> {
    try {
      const res = await this.fetchJson<
        ApiResponse<{ mallName: string; lastUpdated: string; floors: SignageDirectoryFloorGroup[] }>
      >('/api/v1/signage/directory');
      return res.data;
    } catch {
      const floors: FloorLevel[] = ['L4', 'L3', 'L2', 'L1'];
      const floorGroups: SignageDirectoryFloorGroup[] = floors.map((fl) => {
        const floorTenants: SignageDirectoryEntry[] = FALLBACK_TENANTS.filter((t) => t.floorLevel === fl).map((t) => ({
          floorLevel: t.floorLevel,
          unitNumber: t.unitNumber,
          tenantName: t.name,
          tenantSlug: t.slug,
          categoryName: t.categoryName || 'General',
          categorySlug: t.categorySlug || 'general',
          categoryIcon: null,
          summary: t.summary,
          logoUrl: t.logoUrl,
          phone: t.phone,
        }));
        return {
          floorLevel: fl,
          floorTitle: `Level ${fl.replace('L', '')}`,
          tenants: floorTenants,
        };
      });
      return {
        mallName: 'Jubilee Square',
        floors: floorGroups,
      };
    }
  }

  async search(query: string): Promise<Tenant[]> {
    if (!query.trim()) return [];
    try {
      const res = await this.fetchJson<ApiResponse<{ query: string; count: number; results: Tenant[] }>>(
        `/api/v1/search?q=${encodeURIComponent(query)}`
      );
      return res.data.results;
    } catch {
      const q = query.toLowerCase().trim();
      return FALLBACK_TENANTS.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.unitNumber.toLowerCase().includes(q) ||
          (t.categoryName && t.categoryName.toLowerCase().includes(q)) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
  }
}

export const api = new JubileeApiClient();
