import { buildApp } from './app.js';
import { closeCatalogRepository } from '@jubilee/db';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const app = await buildApp();

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`Received ${signal}, initiating graceful shutdown...`);
    try {
      await app.close();
      await closeCatalogRepository();
      console.log('Server and database connections successfully drained.');
      process.exit(0);
    } catch (err) {
      console.error('Error during graceful shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Jubilee Square v2 Catalog API running at ${address}`);
    console.log(`📖 Swagger API Docs available at ${address}/docs`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

