import fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { healthRoutes } from './routes/health.js';
import { categoryRoutes } from './routes/categories.js';
import { tenantRoutes } from './routes/tenants.js';
import { promotionRoutes } from './routes/promotions.js';
import { signageRoutes } from './routes/signage.js';
import { searchRoutes } from './routes/search.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  // Enable CORS
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Register OpenAPI / Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Jubilee Square v2 Store Catalog & Digital Signage API',
        description: 'REST endpoints powering web, mobile web, and 7 on-site digital directory screens across Levels 1–4',
        version: '2.0.0',
        contact: {
          name: 'Pancatz Engineering',
          email: 'engineering@pancatz.com',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local Development Server',
        },
      ],
      tags: [
        { name: 'System', description: 'System health and diagnostics' },
        { name: 'Categories', description: 'Mall tenant category verticals' },
        { name: 'Tenants', description: 'Store directory, floor units, and metadata' },
        { name: 'Promotions', description: 'Mall-wide and tenant-specific deals' },
        { name: 'Digital Signage', description: 'Hardware directory & signage feed endpoints' },
        { name: 'Search', description: 'Instant multi-field fuzzy search' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Register health route at root level
  await app.register(healthRoutes);

  // Register API v1 prefixed routes
  await app.register(
    async (v1) => {
      await v1.register(categoryRoutes);
      await v1.register(tenantRoutes);
      await v1.register(promotionRoutes);
      await v1.register(signageRoutes);
      await v1.register(searchRoutes);
    },
    { prefix: '/api/v1' }
  );

  return app;
}
