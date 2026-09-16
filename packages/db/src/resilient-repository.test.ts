/**
 * Unit & Lifecycle Tests for ResilientCatalogRepository, CircuitBreaker,
 * and DirectusCatalogRepository.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker.js';
import { ResilientCatalogRepository } from './resilient-repository.js';
import { DirectusCatalogRepository } from './directus-repository.js';
import { InMemoryCatalogRepository } from './repository.js';
import type { CatalogRepository } from './repository.js';
import type { Category, Tenant, Promotion, SignageSlide, SignageDirectoryFloorGroup, TenantFilterParams } from '@jubilee/shared';

describe('CircuitBreaker Unit Tests', () => {
  test('initial state is CLOSED with zero failures', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 100 });
    assert.equal(cb.getState(), 'CLOSED');
    const metrics = cb.getMetrics();
    assert.equal(metrics.state, 'CLOSED');
    assert.equal(metrics.totalFailures, 0);
    assert.equal(metrics.totalSuccesses, 0);
  });

  test('successful calls execute and update metrics', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 100 });
    const result = await cb.execute(() => Promise.resolve('ok'));
    assert.equal(result, 'ok');
    assert.equal(cb.getState(), 'CLOSED');
    assert.equal(cb.getMetrics().totalSuccesses, 1);
  });

  test('trips to OPEN after reaching failureThreshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 200 });

    // First failure
    await assert.rejects(
      () => cb.execute(() => Promise.reject(new Error('fail 1'))),
      /fail 1/
    );
    assert.equal(cb.getState(), 'CLOSED');
    assert.equal(cb.getMetrics().totalFailures, 1);

    // Second failure: trips to OPEN
    await assert.rejects(
      () => cb.execute(() => Promise.reject(new Error('fail 2'))),
      /fail 2/
    );
    assert.equal(cb.getState(), 'OPEN');
    assert.equal(cb.getMetrics().totalFailures, 2);
  });

  test('when OPEN without fallback, throws CircuitBreakerOpenError without invoking primary', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 500 });
    await assert.rejects(() => cb.execute(() => Promise.reject(new Error('fail'))));
    assert.equal(cb.getState(), 'OPEN');

    let actionInvoked = false;
    await assert.rejects(
      () => cb.execute(() => {
        actionInvoked = true;
        return Promise.resolve('ok');
      }),
      CircuitBreakerOpenError
    );
    assert.equal(actionInvoked, false);
  });

  test('when OPEN with fallback, executes fallback immediately', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 500 });
    // First failure trips breaker and uses fallback
    const res1 = await cb.execute(
      () => Promise.reject(new Error('down')),
      () => Promise.resolve('fallback-value')
    );
    assert.equal(res1, 'fallback-value');
    assert.equal(cb.getState(), 'OPEN');

    // While OPEN, fallback is executed immediately without calling primary
    let primaryCalled = false;
    const res2 = await cb.execute(
      () => {
        primaryCalled = true;
        return Promise.resolve('primary');
      },
      () => Promise.resolve('fallback-value-2')
    );
    assert.equal(res2, 'fallback-value-2');
    assert.equal(primaryCalled, false);
    assert.equal(cb.getMetrics().totalFallbacks, 2);
  });

  test('transitions to HALF_OPEN after resetTimeoutMs and recovers on success', async () => {
    const resetTimeoutMs = 50;
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs });

    // Trip the breaker
    await assert.rejects(() => cb.execute(() => Promise.reject(new Error('fail'))));
    assert.equal(cb.getState(), 'OPEN');

    // Wait for reset timeout to expire
    await new Promise((resolve) => setTimeout(resolve, resetTimeoutMs + 20));

    // Next successful execution should reset state to CLOSED
    const res = await cb.execute(() => Promise.resolve('recovered'));
    assert.equal(res, 'recovered');
    assert.equal(cb.getState(), 'CLOSED');
    assert.equal(cb.getMetrics().consecutiveFailures, 0);
  });

  test('re-trips to OPEN if HALF_OPEN trial fails', async () => {
    const resetTimeoutMs = 50;
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs });

    await assert.rejects(() => cb.execute(() => Promise.reject(new Error('fail'))));
    assert.equal(cb.getState(), 'OPEN');

    await new Promise((resolve) => setTimeout(resolve, resetTimeoutMs + 20));

    // Trial fails -> should trip back to OPEN
    await assert.rejects(() => cb.execute(() => Promise.reject(new Error('trial failed'))));
    assert.equal(cb.getState(), 'OPEN');
  });

  test('manual trip and reset work as expected', () => {
    const cb = new CircuitBreaker();
    assert.equal(cb.getState(), 'CLOSED');
    cb.trip();
    assert.equal(cb.getState(), 'OPEN');
    cb.reset();
    assert.equal(cb.getState(), 'CLOSED');
  });
});

describe('ResilientCatalogRepository Fallback & Lifecycle Tests', () => {
  class MockFailingRepo implements CatalogRepository {
    public callCount: number = 0;
    public shouldFail: boolean = true;

    private async call<T>(successValue: T): Promise<T> {
      this.callCount++;
      if (this.shouldFail) {
        throw new Error('Database connection timeout (504 Gateway Timeout)');
      }
      return successValue;
    }

    async getCategories(): Promise<Category[]> {
      return this.call([{ id: 'custom-cat', slug: 'custom', name: 'Custom', shortCode: 'CST', description: '', icon: '', accentColor: '', displayOrder: 1, tenantCount: 1, createdAt: '', updatedAt: '' }]);
    }
    async getCategoryBySlug(): Promise<Category | null> {
      return this.call(null);
    }
    async getTenants(): Promise<{ tenants: Tenant[]; total: number }> {
      return this.call({ tenants: [], total: 0 });
    }
    async getTenantById(): Promise<Tenant | null> {
      return this.call(null);
    }
    async getTenantBySlug(): Promise<Tenant | null> {
      return this.call(null);
    }
    async getTenantsByCategory(): Promise<Tenant[]> {
      return this.call([]);
    }
    async getPromotions(): Promise<Promotion[]> {
      return this.call([]);
    }
    async getPromotionBySlug(): Promise<Promotion | null> {
      return this.call(null);
    }
    async getSignageSlides(): Promise<SignageSlide[]> {
      return this.call([]);
    }
    async getSignageDirectory(): Promise<SignageDirectoryFloorGroup[]> {
      return this.call([]);
    }
    async searchTenants(): Promise<Tenant[]> {
      return this.call([]);
    }
    async close(): Promise<void> {}
  }

  test('serves primary data when primary is healthy', async () => {
    const primary = new MockFailingRepo();
    primary.shouldFail = false;
    const fallback = new InMemoryCatalogRepository();
    const resilient = new ResilientCatalogRepository(primary, fallback);

    const categories = await resilient.getCategories();
    assert.equal(primary.callCount, 1);
    assert.equal(categories.length, 1);
    assert.equal(categories[0].id, 'custom-cat');
    assert.equal(resilient.getCircuitState(), 'CLOSED');
  });

  test('transparently falls back to in-memory seed data when primary fails', async () => {
    const primary = new MockFailingRepo();
    primary.shouldFail = true;
    const fallback = new InMemoryCatalogRepository();
    const resilient = new ResilientCatalogRepository(primary, fallback, { failureThreshold: 3 });

    // getCategories falls back to in-memory seed data (5 verticals)
    const categories = await resilient.getCategories();
    assert.equal(primary.callCount, 1);
    assert.equal(categories.length, 5);
    assert.ok(categories.some((c) => c.slug === 'dine'));

    // getTenants falls back to in-memory seed data (23 tenants)
    const { tenants, total } = await resilient.getTenants();
    assert.equal(total, 23);
    assert.equal(tenants.length, 23);

    // search falls back to in-memory seed data
    const searchResults = await resilient.searchTenants('drum');
    assert.ok(searchResults.length > 0);
    assert.equal(searchResults[0].slug, 'my-drum-school');

    // getSignageDirectory falls back
    const directory = await resilient.getSignageDirectory();
    assert.equal(directory.length, 4);

    // Circuit should now be OPEN because failureThreshold was 3
    assert.equal(resilient.getCircuitState(), 'OPEN');
  });

  test('bypasses failing primary when circuit is OPEN', async () => {
    const primary = new MockFailingRepo();
    primary.shouldFail = true;
    const fallback = new InMemoryCatalogRepository();
    const resilient = new ResilientCatalogRepository(primary, fallback, { failureThreshold: 2, resetTimeoutMs: 1000 });

    // 2 failures to trip circuit
    await resilient.getCategories();
    await resilient.getCategories();
    assert.equal(resilient.getCircuitState(), 'OPEN');
    assert.equal(primary.callCount, 2);

    // Next calls route directly to fallback without calling primary
    const res = await resilient.getCategories();
    assert.equal(res.length, 5);
    assert.equal(primary.callCount, 2, 'Primary must NOT be called while circuit is OPEN');
  });

  test('recovers when primary becomes healthy again after reset timeout', async () => {
    const primary = new MockFailingRepo();
    primary.shouldFail = true;
    const fallback = new InMemoryCatalogRepository();
    const resilient = new ResilientCatalogRepository(primary, fallback, { failureThreshold: 1, resetTimeoutMs: 50 });

    // Trigger failure to open circuit
    await resilient.getCategories();
    assert.equal(resilient.getCircuitState(), 'OPEN');

    // Primary recovers
    primary.shouldFail = false;

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 70));

    // Next request should execute primary and close circuit
    const categories = await resilient.getCategories();
    assert.equal(categories[0].id, 'custom-cat');
    assert.equal(resilient.getCircuitState(), 'CLOSED');
  });
});

describe('DirectusCatalogRepository Data Mapping & Unit Tests', () => {
  const originalFetch = globalThis.fetch;
  let mockFetchHandler: (url: string, init?: RequestInit) => Promise<Response>;

  beforeEach(() => {
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      return mockFetchHandler(url, init);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function jsonResponse(data: unknown, status: number = 200): Promise<Response> {
    return Promise.resolve(new Response(JSON.stringify(data), {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: { 'Content-Type': 'application/json' },
    }));
  }

  test('getCategories maps Directus categories and active tenant counts', async () => {
    mockFetchHandler = async (url) => {
      assert.ok(url.includes('/items/categories'));
      return jsonResponse({
        data: [
          {
            id: 'c1',
            slug: 'dine',
            name: 'Food & Dining',
            short_code: 'DINE',
            description: 'Restaurants and cafes',
            icon: 'utensils',
            accent_color: '#EF4444',
            display_order: 1,
            tenants: [{ id: 't1', is_active: true }, { id: 't2', is_active: false }, { id: 't3', is_active: true }],
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      });
    };

    const repo = new DirectusCatalogRepository({ baseUrl: 'http://test-directus:8055' });
    const categories = await repo.getCategories();

    assert.equal(categories.length, 1);
    const cat = categories[0];
    assert.equal(cat.id, 'c1');
    assert.equal(cat.slug, 'dine');
    assert.equal(cat.shortCode, 'DINE');
    assert.equal(cat.tenantCount, 2, 'Should count only active tenants');
  });

  test('getTenants maps Directus tenants, category relationship, and pagination', async () => {
    mockFetchHandler = async (url) => {
      assert.ok(url.includes('/items/tenants'));
      assert.ok(url.includes('filter[is_active][_eq]=true'));
      return jsonResponse({
        data: [
          {
            id: 'b0000000-0000-0000-0000-000000000001',
            slug: 'my-drum-school',
            name: 'My Drum School',
            floor_level: 'L4',
            unit_number: '#04-01',
            summary: 'Leading drum music academy',
            description: 'Professional drum lessons for all ages',
            phone: '+65 6789 0123',
            category_id: {
              id: 'c2',
              slug: 'learn',
              name: 'Education & Enrichment',
              accent_color: '#3B82F6',
            },
            is_active: true,
            is_featured: true,
            display_order: 1,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        meta: {
          total_count: 23,
        },
      });
    };

    const repo = new DirectusCatalogRepository({ baseUrl: 'http://test-directus:8055' });
    const { tenants, total } = await repo.getTenants({ category: 'learn', floor: 'L4' });

    assert.equal(total, 23);
    assert.equal(tenants.length, 1);
    const t = tenants[0];
    assert.equal(t.id, 'b0000000-0000-0000-0000-000000000001');
    assert.equal(t.slug, 'my-drum-school');
    assert.equal(t.categorySlug, 'learn');
    assert.equal(t.categoryName, 'Education & Enrichment');
    assert.equal(t.floorLevel, 'L4');
    assert.equal(t.isFeatured, true);
  });

  test('getTenantById maps nested operating_hours and promotions', async () => {
    mockFetchHandler = async (url) => {
      assert.ok(url.includes('/items/tenants/b0000000-0000-0000-0000-000000000001'));
      return jsonResponse({
        data: {
          id: 'b0000000-0000-0000-0000-000000000001',
          slug: 'my-drum-school',
          name: 'My Drum School',
          floor_level: 'L4',
          unit_number: '#04-01',
          operating_hours: [
            {
              id: 'oh-1',
              tenant_id: 'b0000000-0000-0000-0000-000000000001',
              day_of_week: 1,
              day_name: 'Monday',
              open_time: '10:00:00',
              close_time: '21:00:00',
              is_closed: false,
            },
          ],
          promotions: [
            {
              id: 'p1',
              title: 'Free Trial Drum Lesson',
              slug: 'free-trial',
              badge_text: 'PROMO',
              is_active: true,
            },
          ],
        },
      });
    };

    const repo = new DirectusCatalogRepository({ baseUrl: 'http://test-directus:8055' });
    const tenant = await repo.getTenantById('b0000000-0000-0000-0000-000000000001');

    assert.ok(tenant);
    assert.equal(tenant.name, 'My Drum School');
    assert.ok(tenant.operatingHours);
    assert.equal(tenant.operatingHours.length, 1);
    assert.equal(tenant.operatingHours[0].openTime, '10:00:00');
    assert.ok(tenant.promotions);
    assert.equal(tenant.promotions.length, 1);
    assert.equal(tenant.promotions[0].title, 'Free Trial Drum Lesson');
  });

  test('getPromotions maps promotions with tenant relations', async () => {
    mockFetchHandler = async (url) => {
      assert.ok(url.includes('/items/promotions'));
      return jsonResponse({
        data: [
          {
            id: 'e0000000-0000-0000-0000-000000000001',
            title: '1-for-1 Toast Set',
            slug: 'yakun-1-for-1',
            summary: 'Enjoy 1-for-1 kaya toast set on weekdays',
            badge_text: '1-FOR-1',
            start_date: '2026-01-01',
            end_date: '2026-12-31',
            is_active: true,
            is_featured: true,
            tenant_id: {
              id: 'b0000000-0000-0000-0000-000000000002',
              name: 'Ya Kun Kaya Toast',
              slug: 'ya-kun-kaya-toast',
            },
          },
        ],
      });
    };

    const repo = new DirectusCatalogRepository({ baseUrl: 'http://test-directus:8055' });
    const promos = await repo.getPromotions(true);

    assert.equal(promos.length, 1);
    assert.equal(promos[0].slug, 'yakun-1-for-1');
    assert.equal(promos[0].tenantName, 'Ya Kun Kaya Toast');
    assert.equal(promos[0].badgeText, '1-FOR-1');
  });

  test('throws on Directus 500 error allowing circuit breaker to catch it', async () => {
    mockFetchHandler = async () => {
      return jsonResponse({ errors: [{ message: 'Internal Server Error' }] }, 500);
    };

    const repo = new DirectusCatalogRepository({ baseUrl: 'http://test-directus:8055' });
    await assert.rejects(
      () => repo.getCategories(),
      /Directus API request failed \[500\]/
    );
  });
});
