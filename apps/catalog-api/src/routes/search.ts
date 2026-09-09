import type { FastifyPluginAsync } from 'fastify';
import { getCatalogRepository } from '@jubilee/db';

interface SearchQuery {
  q?: string;
}

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = getCatalogRepository();

  // GET /api/v1/search
  fastify.get<{ Querystring: SearchQuery }>(
    '/search',
    {
      schema: {
        description: 'Multi-field instant search across tenant names, categories, tags, and unit numbers',
        tags: ['Search'],
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query.q || '';

      if (!q.trim()) {
        return {
          success: true,
          data: {
            query: q,
            count: 0,
            results: [],
          },
        };
      }

      const results = await repo.searchTenants(q);

      return {
        success: true,
        data: {
          query: q,
          count: results.length,
          results,
        },
      };
    }
  );
};
