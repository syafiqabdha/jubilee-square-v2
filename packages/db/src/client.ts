import { InMemoryCatalogRepository, type CatalogRepository } from './repository.js';
import { PostgresCatalogRepository, sanitizeTsQuery } from './postgres-repository.js';
import { ResilientCatalogRepository } from './resilient-repository.js';
import { DirectusCatalogRepository } from './directus-repository.js';
import { CircuitBreaker, CircuitBreakerOpenError, type CircuitState, type CircuitBreakerMetrics, type CircuitBreakerOptions } from './circuit-breaker.js';

let defaultRepo: CatalogRepository | null = null;

export interface RepositoryFactoryOptions {
  forceType?: 'postgres' | 'directus' | 'memory' | 'resilient';
  disableCircuitBreaker?: boolean;
  circuitBreakerOptions?: CircuitBreakerOptions;
}

export function getCatalogRepository(options: RepositoryFactoryOptions = {}): CatalogRepository {
  if (!defaultRepo) {
    const useDirectus = options.forceType === 'directus' || process.env.USE_DIRECTUS === 'true';
    const usePg =
      options.forceType === 'postgres' ||
      options.forceType === 'resilient' ||
      process.env.USE_PG === 'true' ||
      Boolean(process.env.DATABASE_URL && process.env.USE_PG !== 'false');

    if (useDirectus) {
      const directusRepo = new DirectusCatalogRepository();
      if (options.disableCircuitBreaker) {
        defaultRepo = directusRepo;
      } else {
        defaultRepo = new ResilientCatalogRepository(
          directusRepo,
          new InMemoryCatalogRepository(),
          { name: 'directus-catalog', ...options.circuitBreakerOptions }
        );
      }
    } else if (usePg) {
      const pgRepo = new PostgresCatalogRepository();
      if (options.disableCircuitBreaker) {
        defaultRepo = pgRepo;
      } else {
        defaultRepo = new ResilientCatalogRepository(
          pgRepo,
          new InMemoryCatalogRepository(),
          { name: 'postgres-catalog', ...options.circuitBreakerOptions }
        );
      }
    } else {
      defaultRepo = new InMemoryCatalogRepository();
    }
  }
  return defaultRepo;
}

export function setDefaultCatalogRepository(repo: CatalogRepository | null): void {
  defaultRepo = repo;
}

export async function closeCatalogRepository(): Promise<void> {
  if (defaultRepo) {
    if (typeof defaultRepo.close === 'function') {
      await defaultRepo.close();
    } else if (typeof defaultRepo.end === 'function') {
      await defaultRepo.end();
    }
    defaultRepo = null;
  }
}

export {
  InMemoryCatalogRepository,
  PostgresCatalogRepository,
  DirectusCatalogRepository,
  ResilientCatalogRepository,
  CircuitBreaker,
  CircuitBreakerOpenError,
  sanitizeTsQuery,
  type CatalogRepository,
  type CircuitState,
  type CircuitBreakerMetrics,
};
export * from './seed-data.js';
