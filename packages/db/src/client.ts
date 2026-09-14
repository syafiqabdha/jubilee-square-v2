import { InMemoryCatalogRepository, type CatalogRepository } from './repository.js';
import { PostgresCatalogRepository } from './postgres-repository.js';

let defaultRepo: CatalogRepository | null = null;

export function getCatalogRepository(): CatalogRepository {
  if (!defaultRepo) {
    if (process.env.USE_PG === 'true') {
      defaultRepo = new PostgresCatalogRepository();
    } else {
      defaultRepo = new InMemoryCatalogRepository();
    }
  }
  return defaultRepo;
}

export { InMemoryCatalogRepository, PostgresCatalogRepository, type CatalogRepository };
export * from './seed-data.js';
