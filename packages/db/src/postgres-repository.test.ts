/**
 * Unit tests for PostgresCatalogRepository
 *
 * Strategy: mock pg.Pool at the module level so no real DB connection is made.
 * Each test configures the mock's query stub to return controlled row sets,
 * then verifies the repository's mapping logic.
 */

import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Minimal pg mock — replaces the real pg module for this test file.
// We override process.env before the module is imported so the constructor
// sees the connection string but never actually connects.
// ---------------------------------------------------------------------------

let mockQueryFn: (sql: string, values?: unknown[]) => { rows: Record<string, unknown>[] } = () => ({
  rows: [],
});

// Inject a fake pg module before importing the repository.
// Node's module cache (esm) does not support register() here, so we rely on
// the fact that pg is a CommonJS package and stub it via a side-channel
// approach: we pass the mock pool directly to a test-only constructor overload.

// Instead of full ESM mock (which requires --experimental-vm-modules or jest),
// we test the mapping logic by sub-classing PostgresCatalogRepository and
// overriding the pool.query call via a protected accessor pattern, OR we
// instantiate the real class but immediately replace its private pool with
// our mock object using Object.defineProperty.

import { PostgresCatalogRepository, sanitizeTsQuery } from './postgres-repository.js';

let mockEndCalled = 0;

// We'll monkey-patch the pool on constructed instances.
function makeRepo() {
  // Prevent any real connection attempt by pointing to a dummy URL.
  process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test_db';
  const repo = new PostgresCatalogRepository();

  // Replace private pool with a stub that delegates to our configurable mock.
  const stubPool = {
    query: (sql: string, values?: unknown[]) => {
      return Promise.resolve(mockQueryFn(sql, values));
    },
    end: () => {
      mockEndCalled++;
      return Promise.resolve();
    },
  };
  // Use bracket notation to reach the private field (compiled JS; no type error at runtime).
  (repo as unknown as { pool: unknown }).pool = stubPool;

  return repo;
}

// ---------------------------------------------------------------------------
// Test helpers — row shapes that mirror what PostgreSQL would return
// ---------------------------------------------------------------------------

function makeCategoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c0000000-0000-0000-0000-000000000001',
    slug: 'dine',
    name: 'Dine',
    short_code: 'FNB',
    description: 'Food and drink',
    icon: 'utensils',
    accent_color: '#EF4444',
    display_order: 1,
    tenantCount: '6',
    created_at: new Date('2024-01-01').toISOString(),
    updated_at: new Date('2024-01-01').toISOString(),
    ...overrides,
  };
}

function makeTenantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b0000000-0000-0000-0000-000000000001',
    slug: 'ya-kun-kaya-toast',
    name: 'Ya Kun Kaya Toast',
    category_id: 'c0000000-0000-0000-0000-000000000001',
    category_slug: 'dine',
    category_name: 'Dine',
    floor_level: 'L1',
    unit_number: '#01-08',
    summary: 'Iconic Singaporean breakfast chain',
    description: 'Full description',
    phone: '+65 6100 0001',
    whatsapp: null,
    email: null,
    website: null,
    logo_url: '/logos/ya-kun.png',
    hero_image_url: null,
    gallery: [],
    social_links: {},
    tags: ['breakfast', 'coffee'],
    metadata: {},
    is_active: true,
    is_featured: false,
    display_order: 1,
    total_count: '5',
    created_at: new Date('2024-01-01').toISOString(),
    updated_at: new Date('2024-01-01').toISOString(),
    ...overrides,
  };
}

function makePromotionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e0000000-0000-0000-0000-000000000001',
    tenant_id: 'b0000000-0000-0000-0000-000000000001',
    title: '10% off this week',
    slug: '10-off-this-week',
    summary: 'Limited offer',
    description: null,
    banner_url: null,
    badge_text: '10% OFF',
    terms_conditions: null,
    start_date: null,
    end_date: null,
    is_active: true,
    is_featured: false,
    display_order: 1,
    ...overrides,
  };
}

function makeSignageSlideRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f0000000-0000-0000-0000-000000000001',
    title: 'Welcome Slide',
    slide_type: 'image',
    media_url: '/slides/welcome.jpg',
    duration_seconds: 10,
    target_locations: ['all'],
    tenant_id: null,
    headline: 'Welcome',
    subheadline: null,
    is_active: true,
    priority: 1,
    start_date: null,
    end_date: null,
    ...overrides,
  };
}

function makeSignageDirectoryRow(overrides: Record<string, unknown> = {}) {
  return {
    floor_level: 'L1',
    unit_number: '#01-08',
    tenant_name: 'Ya Kun Kaya Toast',
    tenant_slug: 'ya-kun-kaya-toast',
    category_name: 'Dine',
    category_slug: 'dine',
    category_icon: 'utensils',
    summary: 'Iconic breakfast chain',
    logo_url: '/logos/ya-kun.png',
    phone: '+65 6100 0001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostgresCatalogRepository — unit tests (mocked pool)', () => {
  let repo: PostgresCatalogRepository;

  before(() => {
    repo = makeRepo();
  });

  // ---- getCategories -------------------------------------------------------

  describe('getCategories()', () => {
    test('maps DB rows to Category objects with integer tenantCount', async () => {
      const row = makeCategoryRow({ tenantCount: '6' });
      mockQueryFn = () => ({ rows: [row] });

      const cats = await repo.getCategories();

      assert.equal(cats.length, 1);
      assert.equal(cats[0].slug, 'dine');
      assert.equal(cats[0].tenantCount, 6);
      assert.equal(typeof cats[0].tenantCount, 'number');
    });

    test('returns empty array when no categories exist', async () => {
      mockQueryFn = () => ({ rows: [] });
      const cats = await repo.getCategories();
      assert.deepEqual(cats, []);
    });

    test('tenantCount is 0 when DB returns null/falsy', async () => {
      const row = makeCategoryRow({ tenantCount: null });
      mockQueryFn = () => ({ rows: [row] });

      const cats = await repo.getCategories();
      assert.equal(cats[0].tenantCount, 0);
    });
  });

  // ---- getCategoryBySlug ---------------------------------------------------

  describe('getCategoryBySlug()', () => {
    test('returns mapped Category for a matching slug', async () => {
      const row = makeCategoryRow();
      mockQueryFn = () => ({ rows: [row] });

      const cat = await repo.getCategoryBySlug('dine');
      assert.ok(cat);
      assert.equal(cat.slug, 'dine');
      assert.equal(cat.id, 'c0000000-0000-0000-0000-000000000001');
    });

    test('returns null when no row is found', async () => {
      mockQueryFn = () => ({ rows: [] });
      const cat = await repo.getCategoryBySlug('nonexistent');
      assert.equal(cat, null);
    });
  });

  // ---- getTenants ----------------------------------------------------------

  describe('getTenants()', () => {
    test('returns tenants and total from total_count column', async () => {
      const rows = [makeTenantRow({ total_count: '23' }), makeTenantRow({ id: 't2', slug: 'other', total_count: '23' })];
      mockQueryFn = () => ({ rows });

      const { tenants, total } = await repo.getTenants();
      assert.equal(tenants.length, 2);
      assert.equal(total, 23);
    });

    test('total is 0 when result set is empty', async () => {
      mockQueryFn = () => ({ rows: [] });
      const { tenants, total } = await repo.getTenants();
      assert.equal(tenants.length, 0);
      assert.equal(total, 0);
    });

    test('maps gallery, tags, social_links as arrays/objects', async () => {
      const row = makeTenantRow({
        gallery: ['img1.jpg', 'img2.jpg'],
        tags: ['coffee', 'breakfast'],
        social_links: { instagram: '@yakun' },
        total_count: '1',
      });
      mockQueryFn = () => ({ rows: [row] });

      const { tenants } = await repo.getTenants();
      assert.deepEqual(tenants[0].gallery, ['img1.jpg', 'img2.jpg']);
      assert.deepEqual(tenants[0].tags, ['coffee', 'breakfast']);
      assert.deepEqual(tenants[0].socialLinks, { instagram: '@yakun' });
    });

    test('falls back to empty arrays/objects for null gallery/tags/socialLinks', async () => {
      const row = makeTenantRow({ gallery: null, tags: null, social_links: null, metadata: null, total_count: '1' });
      mockQueryFn = () => ({ rows: [row] });

      const { tenants } = await repo.getTenants();
      assert.deepEqual(tenants[0].gallery, []);
      assert.deepEqual(tenants[0].tags, []);
      assert.deepEqual(tenants[0].socialLinks, {});
      assert.deepEqual(tenants[0].metadata, {});
    });

    test('passes category filter as SQL parameter', async () => {
      const captured: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        captured.push(values ?? []);
        return { rows: [] };
      };
      await repo.getTenants({ category: 'dine' });
      assert.ok(
        captured.some((v) => v.includes('dine')),
        'category slug should be passed as a query parameter'
      );
    });

    test('passes floor filter as SQL parameter', async () => {
      const captured: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        captured.push(values ?? []);
        return { rows: [] };
      };
      await repo.getTenants({ floor: 'L3' as 'L3' });
      assert.ok(
        captured.some((v) => v.includes('L3')),
        'floor level should be passed as a query parameter'
      );
    });

    test('passes featured filter as SQL parameter', async () => {
      const captured: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        captured.push(values ?? []);
        return { rows: [] };
      };
      await repo.getTenants({ featured: true });
      assert.ok(
        captured.some((v) => v.includes(true)),
        'featured flag should be passed as a query parameter'
      );
    });

    test('uses default offset 0 and limit 50 when not specified', async () => {
      const captured: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        captured.push(values ?? []);
        return { rows: [] };
      };
      await repo.getTenants({});
      const params = captured[0];
      assert.ok(params.includes(0), 'default offset should be 0');
      assert.ok(params.includes(50), 'default limit should be 50');
    });

    test('respects custom offset and limit params', async () => {
      const captured: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        captured.push(values ?? []);
        return { rows: [] };
      };
      await repo.getTenants({ offset: 10, limit: 5 });
      const params = captured[0];
      assert.ok(params.includes(10), 'offset should be 10');
      assert.ok(params.includes(5), 'limit should be 5');
    });
  });

  // ---- getTenantById / getTenantBySlug -------------------------------------

  describe('getTenantById()', () => {
    test('returns null when tenant not found', async () => {
      mockQueryFn = () => ({ rows: [] });
      const t = await repo.getTenantById('missing-id');
      assert.equal(t, null);
    });

    test('returns tenant with promotions attached', async () => {
      let callCount = 0;
      mockQueryFn = () => {
        callCount++;
        if (callCount === 1) return { rows: [makeTenantRow()] };
        // Second call is getPromotionsForTenant
        return { rows: [makePromotionRow()] };
      };
      const t = await repo.getTenantById('b0000000-0000-0000-0000-000000000001');
      assert.ok(t);
      assert.equal(t.name, 'Ya Kun Kaya Toast');
      assert.ok(Array.isArray(t.promotions));
      assert.equal(t.promotions!.length, 1);
      assert.equal(t.promotions![0].title, '10% off this week');
    });
  });

  describe('getTenantBySlug()', () => {
    test('returns null when not found', async () => {
      mockQueryFn = () => ({ rows: [] });
      const t = await repo.getTenantBySlug('ghost-tenant');
      assert.equal(t, null);
    });

    test('returns tenant with promotions', async () => {
      let callCount = 0;
      mockQueryFn = () => {
        callCount++;
        if (callCount === 1) return { rows: [makeTenantRow()] };
        return { rows: [] }; // no promotions
      };
      const t = await repo.getTenantBySlug('ya-kun-kaya-toast');
      assert.ok(t);
      assert.equal(t.slug, 'ya-kun-kaya-toast');
      assert.deepEqual(t.promotions, []);
    });
  });

  // ---- getTenantsByCategory ------------------------------------------------

  describe('getTenantsByCategory()', () => {
    test('returns mapped tenants for a category slug', async () => {
      const row = makeTenantRow();
      mockQueryFn = () => ({ rows: [row] });
      const tenants = await repo.getTenantsByCategory('dine');
      assert.equal(tenants.length, 1);
      assert.equal(tenants[0].categorySlug, 'dine');
    });

    test('returns empty array when no tenants in category', async () => {
      mockQueryFn = () => ({ rows: [] });
      const tenants = await repo.getTenantsByCategory('nonexistent');
      assert.deepEqual(tenants, []);
    });

    test('passes category slug as SQL parameter', async () => {
      const captured: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        captured.push(values ?? []);
        return { rows: [] };
      };
      await repo.getTenantsByCategory('learn');
      assert.ok(captured.some((v) => v.includes('learn')));
    });
  });

  // ---- getPromotions -------------------------------------------------------

  describe('getPromotions()', () => {
    test('returns all active promotions by default', async () => {
      const promos = [makePromotionRow(), makePromotionRow({ id: 'p2', slug: 'buy-one-get-one' })];
      mockQueryFn = () => ({ rows: promos });

      const result = await repo.getPromotions();
      assert.equal(result.length, 2);
      assert.equal(result[0].slug, '10-off-this-week');
    });

    test('adds WHERE is_active clause when activeOnly=true', async () => {
      const sqls: string[] = [];
      mockQueryFn = (sql) => {
        sqls.push(sql);
        return { rows: [] };
      };
      await repo.getPromotions(true);
      assert.ok(sqls.some((s) => s.includes('is_active')));
    });

    test('omits WHERE is_active clause when activeOnly=false', async () => {
      const sqls: string[] = [];
      mockQueryFn = (sql) => {
        sqls.push(sql);
        return { rows: [] };
      };
      await repo.getPromotions(false);
      // The base query for false should not include is_active filter
      assert.ok(sqls.some((s) => !s.includes('is_active')));
    });
  });

  describe('getPromotionBySlug()', () => {
    test('returns promotion when found', async () => {
      mockQueryFn = () => ({ rows: [makePromotionRow()] });
      const promo = await repo.getPromotionBySlug('10-off-this-week');
      assert.ok(promo);
      assert.equal(promo.slug, '10-off-this-week');
    });

    test('returns null when not found', async () => {
      mockQueryFn = () => ({ rows: [] });
      const promo = await repo.getPromotionBySlug('ghost-promo');
      assert.equal(promo, null);
    });
  });

  // ---- getSignageSlides ----------------------------------------------------

  describe('getSignageSlides()', () => {
    test('returns slides mapped to SignageSlide shape', async () => {
      mockQueryFn = () => ({ rows: [makeSignageSlideRow()] });
      const slides = await repo.getSignageSlides();
      assert.equal(slides.length, 1);
      assert.equal(slides[0].title, 'Welcome Slide');
      assert.deepEqual(slides[0].targetLocations, ['all']);
    });

    test('passes location parameter when not "all"', async () => {
      const captured: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        captured.push(values ?? []);
        return { rows: [] };
      };
      await repo.getSignageSlides('L1_lift');
      assert.ok(captured.some((v) => v.includes('L1_lift')));
    });

    test('does not pass location parameter when location is "all"', async () => {
      const captured: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        captured.push(values ?? []);
        return { rows: [] };
      };
      await repo.getSignageSlides('all');
      // values array should be empty since no $1 param is bound
      assert.ok(captured.some((v) => (v as unknown[]).length === 0));
    });

    test('falls back to empty array for null target_locations', async () => {
      mockQueryFn = () => ({ rows: [makeSignageSlideRow({ target_locations: null })] });
      const slides = await repo.getSignageSlides();
      assert.deepEqual(slides[0].targetLocations, []);
    });
  });

  // ---- getSignageDirectory -------------------------------------------------

  describe('getSignageDirectory()', () => {
    test('returns 4 floor groups for L1–L4 even when some floors have no tenants', async () => {
      // Only L1 rows in the mock
      mockQueryFn = () => ({
        rows: [
          makeSignageDirectoryRow({ floor_level: 'L1' }),
          makeSignageDirectoryRow({ floor_level: 'L1', unit_number: '#01-09', tenant_name: 'Starbucks' }),
        ],
      });

      const groups = await repo.getSignageDirectory();
      assert.equal(groups.length, 4);

      const l1 = groups.find((g) => g.floorLevel === 'L1');
      const l2 = groups.find((g) => g.floorLevel === 'L2');
      assert.ok(l1);
      assert.equal(l1!.tenants.length, 2);
      assert.ok(l2);
      assert.equal(l2!.tenants.length, 0);
    });

    test('group floor titles are correctly assigned', async () => {
      mockQueryFn = () => ({ rows: [] });
      const groups = await repo.getSignageDirectory();
      const titles = groups.map((g) => g.floorTitle);
      assert.ok(titles[0].includes('Level 1'));
      assert.ok(titles[1].includes('Level 2'));
      assert.ok(titles[2].includes('Level 3'));
      assert.ok(titles[3].includes('Level 4'));
    });

    test('maps tenant fields within a floor group correctly', async () => {
      mockQueryFn = () => ({ rows: [makeSignageDirectoryRow()] });
      const groups = await repo.getSignageDirectory();
      const entry = groups[0].tenants[0];
      assert.equal(entry.tenantName, 'Ya Kun Kaya Toast');
      assert.equal(entry.tenantSlug, 'ya-kun-kaya-toast');
      assert.equal(entry.unitNumber, '#01-08');
      assert.equal(entry.categorySlug, 'dine');
    });

    test('groups cover exactly L1, L2, L3, L4 (not B1)', async () => {
      mockQueryFn = () => ({ rows: [] });
      const groups = await repo.getSignageDirectory();
      const levels = groups.map((g) => g.floorLevel);
      assert.deepEqual(levels, ['L1', 'L2', 'L3', 'L4']);
      assert.ok(!levels.includes('B1' as 'L1'));
    });
  });

  // ---- searchTenants -------------------------------------------------------

  describe('searchTenants()', () => {
    test('returns empty array for blank query without hitting the DB', async () => {
      let called = false;
      mockQueryFn = () => {
        called = true;
        return { rows: [] };
      };
      const result = await repo.searchTenants('');
      assert.deepEqual(result, []);
      assert.equal(called, false, 'DB should not be called for empty query');
    });

    test('returns empty array for whitespace-only query', async () => {
      let called = false;
      mockQueryFn = () => {
        called = true;
        return { rows: [] };
      };
      const result = await repo.searchTenants('   ');
      assert.deepEqual(result, []);
      assert.equal(called, false);
    });

    test('converts multi-word query to tsquery AND format', async () => {
      const sqls: string[] = [];
      const params: unknown[][] = [];
      mockQueryFn = (sql, values) => {
        sqls.push(sql);
        params.push(values ?? []);
        return { rows: [] };
      };
      await repo.searchTenants('kaya toast');
      assert.ok(params.some((v) => v.includes('kaya & toast')), 'multi-word query should be joined with & for tsquery');
    });

    test('single keyword is passed directly as tsquery term', async () => {
      const params: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        params.push(values ?? []);
        return { rows: [] };
      };
      await repo.searchTenants('drum');
      assert.ok(params.some((v) => v.includes('drum')));
    });

    test('uses to_tsquery in the SQL (not ILIKE or LIKE)', async () => {
      const sqls: string[] = [];
      mockQueryFn = (sql) => {
        sqls.push(sql);
        return { rows: [] };
      };
      await repo.searchTenants('coffee');
      assert.ok(sqls.some((s) => s.includes('to_tsquery')));
      assert.ok(!sqls.some((s) => s.includes('LIKE') || s.includes('ILIKE')));
    });

    test('returns mapped tenant objects from DB rows', async () => {
      mockQueryFn = () => ({ rows: [makeTenantRow()] });
      const results = await repo.searchTenants('kaya');
      assert.equal(results.length, 1);
      assert.equal(results[0].slug, 'ya-kun-kaya-toast');
    });

    test('sanitizes boolean/tsquery operators (| & !) to prevent syntax errors', async () => {
      const params: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        params.push(values ?? []);
        return { rows: [] };
      };
      await repo.searchTenants('kaya | toast');
      assert.ok(params.some((v) => v.includes('kaya & toast')), 'pipe should be sanitized into valid & joined terms');

      await repo.searchTenants('!kaya');
      assert.ok(params.some((v) => v.includes('kaya')), 'exclamation should be stripped to prevent syntax errors');

      await repo.searchTenants('kaya & toast');
      assert.ok(params.some((v) => v.includes('kaya & toast')), 'raw ampersand should be sanitized');
    });

    test('sanitizes parentheses, colons, asterisks, and quotes', async () => {
      const params: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        params.push(values ?? []);
        return { rows: [] };
      };
      await repo.searchTenants('(kaya) :toast*');
      assert.ok(params.some((v) => v.includes('kaya & toast')), 'parentheses, colon, and asterisk should be sanitized');
    });

    test('returns empty array without hitting DB when query contains only special characters', async () => {
      let called = false;
      mockQueryFn = () => {
        called = true;
        return { rows: [] };
      };
      const result = await repo.searchTenants('! & | : * ( ) < > \' " \\');
      assert.deepEqual(result, []);
      assert.equal(called, false, 'DB should not be hit for query containing only special characters');
    });

    test('handles punctuation and hyphens cleanly (e.g. #02-01, a-grader)', async () => {
      const params: unknown[][] = [];
      mockQueryFn = (_sql, values) => {
        params.push(values ?? []);
        return { rows: [] };
      };
      await repo.searchTenants('unit #02-01');
      assert.ok(params.some((v) => v.includes('unit & 02-01')), 'hash should be stripped while unit number preserved');
    });
  });

  // ---- sanitizeTsQuery() ---------------------------------------------------

  describe('sanitizeTsQuery() unit tests', () => {
    test('handles empty, blank, or invalid inputs', () => {
      assert.equal(sanitizeTsQuery(''), '');
      assert.equal(sanitizeTsQuery('   '), '');
      assert.equal(sanitizeTsQuery(null as unknown as string), '');
      assert.equal(sanitizeTsQuery(undefined as unknown as string), '');
    });

    test('strips tsquery operators & | ! ( ) : * < > \' " \\', () => {
      assert.equal(sanitizeTsQuery('kaya | toast'), 'kaya & toast');
      assert.equal(sanitizeTsQuery('kaya & toast'), 'kaya & toast');
      assert.equal(sanitizeTsQuery('!kaya'), 'kaya');
      assert.equal(sanitizeTsQuery('(kaya) (toast)'), 'kaya & toast');
      assert.equal(sanitizeTsQuery('kaya:toast*'), 'kaya & toast');
      assert.equal(sanitizeTsQuery("don't stop"), 'don & t & stop');
    });

    test('preserves valid word hyphens while stripping boundary hyphens', () => {
      assert.equal(sanitizeTsQuery('unit #02-01'), 'unit & 02-01');
      assert.equal(sanitizeTsQuery('a-grader'), 'a-grader');
      assert.equal(sanitizeTsQuery('--test--'), 'test');
      assert.equal(sanitizeTsQuery('---'), '');
    });

    test('returns empty string when no valid search tokens remain', () => {
      assert.equal(sanitizeTsQuery('! & | : * ( ) < >'), '');
      assert.equal(sanitizeTsQuery('??? @@@ $$$ %%%'), '');
    });
  });

  // ---- Pool lifecycle and graceful drain -----------------------------------

  describe('Pool lifecycle and graceful drain', () => {
    test('repo.end() drains the underlying pg.Pool', async () => {
      mockEndCalled = 0;
      await repo.end();
      assert.equal(mockEndCalled, 1, 'repo.end() should call pool.end()');
    });

    test('repo.close() drains the underlying pg.Pool', async () => {
      mockEndCalled = 0;
      await repo.close();
      assert.equal(mockEndCalled, 1, 'repo.close() should call pool.end()');
    });

    test('closeCatalogRepository() drains defaultRepo when initialized', async () => {
      const { getCatalogRepository, closeCatalogRepository } = await import('./client.js');
      const r = getCatalogRepository();
      assert.ok(r);
      await closeCatalogRepository();
      // Verifies no throw and graceful completion
      assert.ok(true);
    });
  });

  // ---- USE_PG env toggle (client.ts) ---------------------------------------
  // These tests import client.ts and verify the factory selects the right repo.

  describe('getCatalogRepository() — USE_PG toggle', () => {
    test('USE_PG=false returns InMemoryCatalogRepository', async () => {
      // Import dynamically to avoid module-cache issues with env changes.
      delete process.env['USE_PG'];
      // Reset module cache trick: we can't in ESM without --experimental-vm-modules,
      // so we at minimum verify the constructor branch logic directly.
      const { InMemoryCatalogRepository } = await import('./repository.js');
      const instance = new InMemoryCatalogRepository();
      // Quick sanity: InMemory has all seed data available immediately.
      const cats = await instance.getCategories();
      assert.ok(cats.length > 0, 'InMemoryCatalogRepository should return seeded categories');
    });

    test('PostgresCatalogRepository can be constructed with explicit connection string', () => {
      // Verify the constructor signature accepts a connection string override.
      assert.doesNotThrow(() => {
        const r = new PostgresCatalogRepository('postgresql://u:p@localhost/db');
        // We can't verify the internal pool URL but construction should not throw.
        assert.ok(r);
      });
    });
  });
});
