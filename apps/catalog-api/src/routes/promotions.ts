import type { FastifyPluginAsync } from 'fastify';
import { getCatalogRepository } from '@jubilee/db';

export const promotionRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = getCatalogRepository();

  // GET /api/v1/promotions
  fastify.get(
    '/promotions',
    {
      schema: {
        description: 'Get all active store promotions and special events',
        tags: ['Promotions'],
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
                    tenantId: { type: 'string', nullable: true },
                    tenantName: { type: 'string' },
                    tenantSlug: { type: 'string' },
                    title: { type: 'string' },
                    slug: { type: 'string' },
                    summary: { type: 'string', nullable: true },
                    description: { type: 'string', nullable: true },
                    bannerUrl: { type: 'string' },
                    badgeText: { type: 'string', nullable: true },
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    isActive: { type: 'boolean' },
                    isFeatured: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const promotions = await repo.getPromotions(true);
      return {
        success: true,
        data: promotions,
      };
    }
  );

  // GET /api/v1/promotions/:slug
  fastify.get<{ Params: { slug: string } }>(
    '/promotions/:slug',
    {
      schema: {
        description: 'Get promotion detail by slug',
        tags: ['Promotions'],
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
      const promo = await repo.getPromotionBySlug(slug);

      if (!promo) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'PROMOTION_NOT_FOUND',
            message: `Promotion with slug '${slug}' not found`,
          },
        });
      }

      return {
        success: true,
        data: promo,
      };
    }
  );
};
