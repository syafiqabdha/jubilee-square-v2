import { buildApp } from './app.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const app = await buildApp();

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
