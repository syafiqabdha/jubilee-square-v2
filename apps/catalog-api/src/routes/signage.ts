import type { FastifyPluginAsync } from 'fastify';
import { getCatalogRepository } from '@jubilee/db';

interface SignageQuery {
  location?: string;
}

export const signageRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = getCatalogRepository();

  // GET /api/v1/signage/featured
  fastify.get<{ Querystring: SignageQuery }>(
    '/signage/featured',
    {
      schema: {
        description: 'Get active digital signage rotating slides filtered by hardware display location',
        tags: ['Digital Signage'],
        querystring: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              enum: [
                'all',
                'L1_lift',
                'L1_counter',
                'L2_lift',
                'L2_escalator',
                'L3_lift',
                'L3_ceiling',
                'L4_lift',
              ],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const location = request.query.location || 'all';
      const slides = await repo.getSignageSlides(location);

      return {
        success: true,
        data: {
          displayLocation: location,
          refreshIntervalMs: 60000,
          totalSlides: slides.length,
          slides,
        },
      };
    }
  );

  // GET /api/v1/signage/directory
  fastify.get(
    '/signage/directory',
    {
      schema: {
        description: 'Get structured floor-grouped store directory feed for wayfinding kiosk displays',
        tags: ['Digital Signage'],
      },
    },
    async (request, reply) => {
      const directory = await repo.getSignageDirectory();

      return {
        success: true,
        data: {
          mallName: 'Jubilee Square (Ang Mo Kio)',
          lastUpdated: new Date().toISOString(),
          floors: directory,
        },
      };
    }
  );
};
