import type { FastifyPluginAsync } from 'fastify';
import { getCatalogRepository } from '@jubilee/db';
import type { FloorLevel } from '@jubilee/shared';

interface TenantQuery {
  category?: string;
  floor?: string;
  featured?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export const tenantRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = getCatalogRepository();

  // GET /api/v1/tenants
  fastify.get<{ Querystring: TenantQuery }>(
    '/tenants',
    {
      schema: {
        description: 'Get paginated list of tenants with optional filters for category, floor, and featured status',
        tags: ['Tenants'],
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            floor: { type: 'string', enum: ['L1', 'L2', 'L3', 'L4', 'B1'] },
            featured: { type: 'string', enum: ['true', 'false'] },
            search: { type: 'string' },
            limit: { type: 'string' },
            offset: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { category, floor, featured, search, limit, offset } = request.query;

      const parsedLimit = limit ? parseInt(limit, 10) : 50;
      const parsedOffset = offset ? parseInt(offset, 10) : 0;
      const isFeatured = featured !== undefined ? featured === 'true' : undefined;

      const result = await repo.getTenants({
        category,
        floor: floor as FloorLevel,
        featured: isFeatured,
        search,
        limit: parsedLimit,
        offset: parsedOffset,
      });

      return {
        success: true,
        data: result.tenants,
        meta: {
          total: result.total,
          limit: parsedLimit,
          offset: parsedOffset,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );

  // GET /api/v1/tenants/by-slug/:slug
  fastify.get<{ Params: { slug: string } }>(
    '/tenants/by-slug/:slug',
    {
      schema: {
        description: 'Get single tenant details by SEO slug with full operating hours and active promotions',
        tags: ['Tenants'],
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
      const tenant = await repo.getTenantBySlug(slug);

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'TENANT_NOT_FOUND',
            message: `Tenant with slug '${slug}' not found`,
          },
        });
      }

      return {
        success: true,
        data: tenant,
      };
    }
  );

  // GET /api/v1/tenants/:id
  fastify.get<{ Params: { id: string } }>(
    '/tenants/:id',
    {
      schema: {
        description: 'Get single tenant details by UUID',
        tags: ['Tenants'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenant = await repo.getTenantById(id);

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'TENANT_NOT_FOUND',
            message: `Tenant with ID '${id}' not found`,
          },
        });
      }

      return {
        success: true,
        data: tenant,
      };
    }
  );
};
