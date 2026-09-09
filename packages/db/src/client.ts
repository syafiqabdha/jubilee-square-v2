import { InMemoryCatalogRepository, type CatalogRepository } from './repository.js';

let defaultRepo: CatalogRepository | null = null;

export function getCatalogRepository(): CatalogRepository {
  if (!defaultRepo) {
    // Return the in-memory repository initialized with seed data
    defaultRepo = new InMemoryCatalogRepository();
  }
  return defaultRepo;
}

export { InMemoryCatalogRepository, type CatalogRepository };
export * from './seed-data.js';
