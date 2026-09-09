import type { FastifyPluginAsync } from 'fastify';

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
            },
          },
        },
      },
    },
    async () => {
      return {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: '2.0.0',
      };
    }
  );
};
