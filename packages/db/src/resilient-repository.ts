/**
 * Jubilee Square v2 — Resilient Catalog Repository
 *
 * Wraps a primary repository (Postgres or Directus) with an in-memory fallback
 * governed by a Circuit Breaker. If the primary backend is unreachable or throws
 * errors, queries automatically and seamlessly fall back to in-memory seed data.
 */

import type {
  Category,
  Tenant,
  Promotion,
  SignageSlide,
  SignageDirectoryFloorGroup,
  TenantFilterParams,
} from '@jubilee/shared';
import { type CatalogRepository } from './repository.js';
import { CircuitBreaker, type CircuitBreakerOptions, type CircuitState, type CircuitBreakerMetrics } from './circuit-breaker.js';

export class ResilientCatalogRepository implements CatalogRepository {
  private primary: CatalogRepository;
  private fallback: CatalogRepository;
  private breaker: CircuitBreaker;

  constructor(
    primary: CatalogRepository,
    fallback: CatalogRepository,
    options: CircuitBreakerOptions = {}
  ) {
    this.primary = primary;
    this.fallback = fallback;
    this.breaker = new CircuitBreaker({
      name: options.name || 'catalog-repository',
      failureThreshold: options.failureThreshold ?? 3,
      resetTimeoutMs: options.resetTimeoutMs ?? 5000,
      ...options,
    });
  }

  getPrimary(): CatalogRepository {
    return this.primary;
  }

  getFallback(): CatalogRepository {
    return this.fallback;
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.breaker;
  }

  getCircuitState(): CircuitState {
    return this.breaker.getState();
  }

  getMetrics(): CircuitBreakerMetrics {
    return this.breaker.getMetrics();
  }

  reset(): void {
    this.breaker.reset();
  }

  trip(): void {
    this.breaker.trip();
  }

  async getCategories(): Promise<Category[]> {
    return this.breaker.execute(
      () => this.primary.getCategories(),
      () => this.fallback.getCategories()
    );
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return this.breaker.execute(
      () => this.primary.getCategoryBySlug(slug),
      () => this.fallback.getCategoryBySlug(slug)
    );
  }

  async getTenants(params?: TenantFilterParams): Promise<{ tenants: Tenant[]; total: number }> {
    return this.breaker.execute(
      () => this.primary.getTenants(params),
      () => this.fallback.getTenants(params)
    );
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.breaker.execute(
      () => this.primary.getTenantById(id),
      () => this.fallback.getTenantById(id)
    );
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.breaker.execute(
      () => this.primary.getTenantBySlug(slug),
      () => this.fallback.getTenantBySlug(slug)
    );
  }

  async getTenantsByCategory(categorySlug: string): Promise<Tenant[]> {
    return this.breaker.execute(
      () => this.primary.getTenantsByCategory(categorySlug),
      () => this.fallback.getTenantsByCategory(categorySlug)
    );
  }

  async getPromotions(activeOnly?: boolean): Promise<Promotion[]> {
    return this.breaker.execute(
      () => this.primary.getPromotions(activeOnly),
      () => this.fallback.getPromotions(activeOnly)
    );
  }

  async getPromotionBySlug(slug: string): Promise<Promotion | null> {
    return this.breaker.execute(
      () => this.primary.getPromotionBySlug(slug),
      () => this.fallback.getPromotionBySlug(slug)
    );
  }

  async getSignageSlides(location?: string): Promise<SignageSlide[]> {
    return this.breaker.execute(
      () => this.primary.getSignageSlides(location),
      () => this.fallback.getSignageSlides(location)
    );
  }

  async getSignageDirectory(): Promise<SignageDirectoryFloorGroup[]> {
    return this.breaker.execute(
      () => this.primary.getSignageDirectory(),
      () => this.fallback.getSignageDirectory()
    );
  }

  async searchTenants(query: string): Promise<Tenant[]> {
    return this.breaker.execute(
      () => this.primary.searchTenants(query),
      () => this.fallback.searchTenants(query)
    );
  }

  async close(): Promise<void> {
    if (typeof this.primary.close === 'function') {
      await this.primary.close();
    } else if (typeof this.primary.end === 'function') {
      await this.primary.end();
    }
    if (typeof this.fallback.close === 'function') {
      await this.fallback.close();
    } else if (typeof this.fallback.end === 'function') {
      await this.fallback.end();
    }
  }

  async end(): Promise<void> {
    await this.close();
  }
}
