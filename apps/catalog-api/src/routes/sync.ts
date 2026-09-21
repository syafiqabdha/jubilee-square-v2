import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getCatalogRepository, ResilientCatalogRepository } from '@jubilee/db';

interface SyncBody {
  event?: string;
  collection?: string;
  keys?: string[];
}

const SYNC_SECRET_HEADER = 'x-sync-secret';

/**
 * Shared-secret preHandler for the sync webhook.
 * The secret is read from SYNC_SECRET env var at request time so it can be
 * rotated without restarting the process. A missing env var is a hard fail:
 * an unconfigured sync endpoint must reject, not silently accept traffic.
 */
async function requireSyncSecret(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const expected = process.env.SYNC_SECRET;
  if (!expected) {
    request.log.error('SYNC_SECRET env var is not set; rejecting sync request');
    reply.code(500).send({
      success: false,
      message: 'Sync endpoint is not configured (missing SYNC_SECRET).',
    });
    return;
  }

  const provided = request.headers[SYNC_SECRET_HEADER];
  const value = Array.isArray(provided) ? provided[0] : provided;

  if (!value || value !== expected) {
    reply.code(401).send({
      success: false,
      message: 'Unauthorized: missing or invalid sync secret.',
    });
    return;
  }
}

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = getCatalogRepository();

  // POST /api/v1/sync
  fastify.post<{ Body: SyncBody }>(
    '/sync',
    {
      preHandler: requireSyncSecret,
      schema: {
        description: 'Webhook endpoint for Directus CMS mutations and cache/circuit revalidation. Requires `x-sync-secret` header matching SYNC_SECRET env.',
        tags: ['System'],
        headers: {
          type: 'object',
          properties: {
            [SYNC_SECRET_HEADER]: { type: 'string' },
          },
        },
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
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
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
