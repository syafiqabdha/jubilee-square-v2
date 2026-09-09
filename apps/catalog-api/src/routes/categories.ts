import type { FastifyPluginAsync } from 'fastify';
import { getCatalogRepository } from '@jubilee/db';

export const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = getCatalogRepository();

  // GET /api/v1/categories
  fastify.get(
    '/categories',
    {
      schema: {
        description: 'Get all tenant categories with store counts',
        tags: ['Categories'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    slug: { type: 'string' },
                    name: { type: 'string' },
                    shortCode: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    icon: { type: 'string', nullable: true },
                    accentColor: { type: 'string' },
                    displayOrder: { type: 'number' },
                    tenantCount: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const categories = await repo.getCategories();
      return {
        success: true,
        data: categories,
      };
    }
  );

  // GET /api/v1/categories/:slug/tenants
  fastify.get<{ Params: { slug: string } }>(
    '/categories/:slug/tenants',
    {
      schema: {
        description: 'Get all active tenants belonging to a specific category slug',
        tags: ['Categories'],
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const category = await repo.getCategoryBySlug(slug);

      if (!category) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: `Category with slug '${slug}' not found`,
          },
        });
      }

      const tenants = await repo.getTenantsByCategory(slug);

      return {
        success: true,
        data: {
          category,
          tenants,
        },
      };
    }
  );
};
