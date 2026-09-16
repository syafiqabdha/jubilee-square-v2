import type { FastifyPluginAsync } from 'fastify';
import { getCatalogRepository, ResilientCatalogRepository } from '@jubilee/db';

interface SyncBody {
  event?: string;
  collection?: string;
  keys?: string[];
}

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = getCatalogRepository();

  // POST /api/v1/sync
  fastify.post<{ Body: SyncBody }>(
    '/sync',
    {
      schema: {
        description: 'Webhook endpoint for Directus CMS mutations and cache/circuit revalidation',
        tags: ['System'],
        body: {
          type: 'object',
          properties: {
            event: { type: 'string' },
            collection: { type: 'string' },
            keys: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              syncedAt: { type: 'string' },
              circuitState: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      let circuitState = 'CLOSED';
      if (repo instanceof ResilientCatalogRepository) {
        repo.reset();
        circuitState = repo.getCircuitState();
      }

      return {
        success: true,
        message: 'Sync event processed successfully. Repository circuit breaker reset for fresh sync.',
        syncedAt: new Date().toISOString(),
        circuitState,
      };
    }
  );

  // GET /api/v1/sync/status
  fastify.get(
    '/sync/status',
    {
      schema: {
        description: 'Get current sync and repository health status',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              activeBackend: { type: 'string' },
              circuitState: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async () => {
      let circuitState = 'CLOSED';
      let activeBackend = 'in-memory';

      if (repo instanceof ResilientCatalogRepository) {
        circuitState = repo.getCircuitState();
        activeBackend = 'resilient-pg-directus';
      }

      return {
        success: true,
        activeBackend,
        circuitState,
        timestamp: new Date().toISOString(),
      };
    }
  );
};
