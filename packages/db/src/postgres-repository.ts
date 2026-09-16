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
import pg from 'pg';
import { SEED_CATEGORIES } from './seed-data.js';
import { type CatalogRepository } from './repository.js';

const { Pool } = pg;

export { type CatalogRepository };

/**
 * Sanitizes a raw search input string into a valid PostgreSQL tsquery format.
 * Strips tsquery operators (&, |, !, (, ), :, *, <, >, ', ", \) and punctuation
 * that cause syntax errors in to_tsquery(), trims boundary hyphens, and joins
 * valid search terms with ' & '.
 * Returns an empty string if no valid terms remain.
 */
export function sanitizeTsQuery(query: string): string {
  if (!query || typeof query !== 'string') return '';
  const cleaned = query.replace(/[^\w\s-]/g, ' ');
  const terms = cleaned
    .split(/\s+/)
    .map((term) => term.replace(/^-+|-+$/g, ''))
    .filter((term) => term.length > 0);

  return terms.join(' & ');
}

export class PostgresCatalogRepository implements CatalogRepository {
  private pool: pg.Pool;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL,
    });
  }

  getPool(): pg.Pool {
    return this.pool;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async end(): Promise<void> {
    await this.pool.end();
  }

  async getCategories(): Promise<Category[]> {
    const query = `
      SELECT c.*, COUNT(t.id) as "tenantCount"
      FROM categories c
      LEFT JOIN tenants t ON t.category_id = c.id AND t.is_active = true
      GROUP BY c.id
      ORDER BY c.display_order
    `;
    const res = await this.pool.query(query);
    return res.rows.map(this.mapCategory);
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const query = `
      SELECT c.*, COUNT(t.id) as "tenantCount"
      FROM categories c
      LEFT JOIN tenants t ON t.category_id = c.id AND t.is_active = true
      WHERE c.slug = $1
      GROUP BY c.id
    `;
    const res = await this.pool.query(query, [slug]);
    if (res.rows.length === 0) return null;
    return this.mapCategory(res.rows[0]);
  }

  async getTenants(params: TenantFilterParams = {}): Promise<{ tenants: Tenant[]; total: number }> {
    let query = `
      SELECT t.*, c.name as category_name, c.slug as category_slug, COUNT(*) OVER() AS total_count
      FROM tenants t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.is_active = true
    `;
    const values: any[] = [];
    let paramIndex = 1;

    if (params.category) {
      query += ` AND (c.slug = $${paramIndex} OR c.id::text = $${paramIndex})`;
      values.push(params.category);
      paramIndex++;
    }

    if (params.floor) {
      query += ` AND t.floor_level = $${paramIndex}`;
      values.push(params.floor);
      paramIndex++;
    }

    if (params.featured !== undefined) {
      query += ` AND t.is_featured = $${paramIndex}`;
      values.push(params.featured);
      paramIndex++;
    }

    if (params.search && params.search.trim()) {
      const tsQuery = sanitizeTsQuery(params.search);
      if (tsQuery) {
        query += ` AND t.search_vector @@ to_tsquery('english', $${paramIndex})`;
        values.push(tsQuery);
        paramIndex++;
      } else {
        return {
          tenants: [],
          total: 0,
        };
      }
    }

    query += ` ORDER BY t.display_order OFFSET $${paramIndex} LIMIT $${paramIndex + 1}`;
    values.push(params.offset || 0, params.limit || 50);

    const res = await this.pool.query(query, values);
    const total = res.rows.length > 0 ? parseInt(res.rows[0].total_count, 10) : 0;
    return {
      tenants: res.rows.map(this.mapTenant),
      total,
    };
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return null;
    }

    const query = `
      SELECT t.*, c.name as category_name, c.slug as category_slug
      FROM tenants t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = $1
    `;
    const res = await this.pool.query(query, [id]);
    if (res.rows.length === 0) return null;
    const tenant = this.mapTenant(res.rows[0]);
    tenant.promotions = await this.getPromotionsForTenant(id);
    tenant.operatingHours = await this.getOperatingHoursForTenant(id);
    tenant.amenities = await this.getAmenitiesForTenant(id);
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const query = `
      SELECT t.*, c.name as category_name, c.slug as category_slug
      FROM tenants t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.slug = $1
    `;
    const res = await this.pool.query(query, [slug]);
    if (res.rows.length === 0) return null;
    const tenant = this.mapTenant(res.rows[0]);
    tenant.promotions = await this.getPromotionsForTenant(tenant.id);
    tenant.operatingHours = await this.getOperatingHoursForTenant(tenant.id);
    tenant.amenities = await this.getAmenitiesForTenant(tenant.id);
    return tenant;
  }

  private async getPromotionsForTenant(tenantId: string): Promise<Promotion[]> {
    const query = `SELECT * FROM promotions WHERE tenant_id = $1 AND is_active = true ORDER BY display_order`;
    const res = await this.pool.query(query, [tenantId]);
    return res.rows.map(this.mapPromotion);
  }

  private async getOperatingHoursForTenant(tenantId: string): Promise<OperatingHours[]> {
    const query = `SELECT * FROM operating_hours WHERE tenant_id = $1 ORDER BY day_of_week`;
    const res = await this.pool.query(query, [tenantId]);
    return res.rows
      .filter((r: any) => r && r.day_of_week !== undefined && r.day_name !== undefined)
      .map(this.mapOperatingHours);
  }

  private async getAmenitiesForTenant(tenantId: string): Promise<Amenity[]> {
    const query = `
      SELECT a.*
      FROM amenities a
      JOIN tenant_amenities ta ON ta.amenity_id = a.id
      WHERE ta.tenant_id = $1
      ORDER BY a.name
    `;
    const res = await this.pool.query(query, [tenantId]);
    return res.rows
      .filter((r: any) => r && r.code !== undefined && r.name !== undefined)
      .map(this.mapAmenity);
  }

  async getTenantsByCategory(categorySlug: string): Promise<Tenant[]> {
    const query = `
      SELECT t.*, c.name as category_name, c.slug as category_slug
      FROM tenants t
      JOIN categories c ON t.category_id = c.id
      WHERE c.slug = $1 AND t.is_active = true
      ORDER BY t.display_order
    `;
    const res = await this.pool.query(query, [categorySlug]);
    return res.rows.map(this.mapTenant);
  }

  async getPromotions(activeOnly: boolean = true): Promise<Promotion[]> {
    let query = `
      SELECT p.*, t.name as tenant_name, t.slug as tenant_slug
      FROM promotions p
      LEFT JOIN tenants t ON p.tenant_id = t.id
    `;
    if (activeOnly) {
      query += ` WHERE p.is_active = true`;
    }
    query += ` ORDER BY p.display_order`;
    const res = await this.pool.query(query);
    return res.rows.map(this.mapPromotion);
  }

  async getPromotionBySlug(slug: string): Promise<Promotion | null> {
    const query = `
      SELECT p.*, t.name as tenant_name, t.slug as tenant_slug
      FROM promotions p
      LEFT JOIN tenants t ON p.tenant_id = t.id
      WHERE p.slug = $1
    `;
    const res = await this.pool.query(query, [slug]);
    if (res.rows.length === 0) return null;
    return this.mapPromotion(res.rows[0]);
  }

  async getSignageSlides(location: string = 'all'): Promise<SignageSlide[]> {
    let query = `SELECT * FROM signage_slides WHERE is_active = true`;
    const values: any[] = [];
    if (location !== 'all') {
      query += ` AND ('all' = ANY(target_locations) OR $1 = ANY(target_locations))`;
      values.push(location);
    }
    query += ` ORDER BY priority`;
    const res = await this.pool.query(query, values);
    return res.rows.map(this.mapSignageSlide);
  }

  async getSignageDirectory(): Promise<SignageDirectoryFloorGroup[]> {
    const query = `SELECT * FROM v_signage_directory`;
    const res = await this.pool.query(query);
    const rows = res.rows;

    const floors: FloorLevel[] = ['L1', 'L2', 'L3', 'L4'];
    const floorTitles: Record<FloorLevel, string> = {
      L1: 'Level 1 — Dining, Retail & Services',
      L2: 'Level 2 — Dining & Wellness',
      L3: 'Level 3 — Education & Enrichment Hub',
      L4: 'Level 4 — Music, Preschool & Martial Arts',
      B1: 'Basement 1 — Parking & Access',
    };

    return floors.map((fl) => {
      const floorTenants = rows
        .filter((r) => r.floor_level === fl)
        .map((r) => ({
          floorLevel: r.floor_level,
          unitNumber: r.unit_number,
          tenantName: r.tenant_name,
          tenantSlug: r.tenant_slug,
          categoryName: r.category_name,
          categorySlug: r.category_slug,
          categoryIcon: r.category_icon,
          summary: r.summary,
          logoUrl: r.logo_url,
          phone: r.phone,
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

    const tsQuery = sanitizeTsQuery(query);
    if (!tsQuery) return [];

    const sql = `
      SELECT t.*, c.name as category_name, c.slug as category_slug
      FROM tenants t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.is_active = true 
        AND t.search_vector @@ to_tsquery('english', $1)
      ORDER BY ts_rank(t.search_vector, to_tsquery('english', $1)) DESC
    `;
    const res = await this.pool.query(sql, [tsQuery]);
    return res.rows.map(this.mapTenant);
  }

  private mapCategory = (r: any): Category => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    shortCode: r.short_code,
    description: r.description,
    icon: r.icon,
    accentColor: r.accent_color,
    displayOrder: r.display_order,
    tenantCount: r.tenantCount ? parseInt(r.tenantCount, 10) : 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  private mapTenant = (r: any): Tenant => {
    let catColor = undefined;
    if (r.category_slug) {
       const seedCat = SEED_CATEGORIES.find(c => c.slug === r.category_slug);
       if (seedCat) catColor = seedCat.accentColor;
    }
  
    return {
    id: r.id,
    categoryId: r.category_id,
    categorySlug: r.category_slug,
    categoryName: r.category_name,
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
    gallery: r.gallery || [],
    socialLinks: r.social_links || {},
    tags: r.tags || [],
    metadata: r.metadata || {},
    isActive: r.is_active,
    isFeatured: r.is_featured,
    displayOrder: r.display_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }};

  private mapPromotion = (r: any): Promotion => ({
    id: r.id,
    tenantId: r.tenant_id,
    tenantName: r.tenant_name,
    tenantSlug: r.tenant_slug,
    title: r.title,
    slug: r.slug,
    summary: r.summary,
    description: r.description,
    bannerUrl: r.banner_url,
    badgeText: r.badge_text,
    termsConditions: r.terms_conditions,
    startDate: r.start_date,
    endDate: r.end_date,
    isActive: r.is_active,
    isFeatured: r.is_featured,
    displayOrder: r.display_order,
  });

  private mapOperatingHours = (r: any): OperatingHours => ({
    id: r.id,
    tenantId: r.tenant_id,
    dayOfWeek: r.day_of_week,
    dayName: r.day_name,
    openTime: r.open_time,
    closeTime: r.close_time,
    isClosed: r.is_closed ?? false,
    specialNotes: r.special_notes,
  });

  private mapAmenity = (r: any): Amenity => ({
    id: r.id,
    code: r.code,
    name: r.name,
    icon: r.icon,
    description: r.description,
  });

  private mapSignageSlide = (r: any): SignageSlide => ({
    id: r.id,
    title: r.title,
    slideType: r.slide_type,
    mediaUrl: r.media_url,
    durationSeconds: r.duration_seconds,
    targetLocations: r.target_locations || [],
    tenantId: r.tenant_id,
    headline: r.headline,
    subheadline: r.subheadline,
    isActive: r.is_active,
    priority: r.priority,
    startDate: r.start_date,
    endDate: r.end_date,
  });
}
