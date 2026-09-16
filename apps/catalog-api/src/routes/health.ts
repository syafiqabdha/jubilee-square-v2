import type { FastifyPluginAsync } from 'fastify';
import { getCatalogRepository, ResilientCatalogRepository } from '@jubilee/db';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Service Health Check',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              uptime: { type: 'number' },
              timestamp: { type: 'string' },
              version: { type: 'string' },
              circuitBreaker: {
                type: 'object',
                properties: {
                  state: { type: 'string' },
                  totalFailures: { type: 'number' },
                  totalFallbacks: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      const repo = getCatalogRepository();
      let circuitBreakerInfo: { state: string; totalFailures: number; totalFallbacks: number } | undefined = undefined;

      if (repo instanceof ResilientCatalogRepository) {
        const metrics = repo.getMetrics();
        circuitBreakerInfo = {
          state: metrics.state,
          totalFailures: metrics.totalFailures,
          totalFallbacks: metrics.totalFallbacks,
        };
      }

      return {
        status: circuitBreakerInfo?.state === 'OPEN' ? 'degraded' : 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        circuitBreaker: circuitBreakerInfo,
      };
    }
  );
};
