import { InMemoryCatalogRepository, type CatalogRepository } from './repository.js';
import { PostgresCatalogRepository, sanitizeTsQuery } from './postgres-repository.js';

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

export { InMemoryCatalogRepository, PostgresCatalogRepository, sanitizeTsQuery, type CatalogRepository };
export * from './seed-data.js';

