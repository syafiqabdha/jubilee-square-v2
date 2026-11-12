import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL);

export default defineConfig({
  output: 'server',
  adapter: isVercel
    ? vercel()
    : node({
        mode: 'standalone',
      }),
  vite: {
    ssr: {
      // Astro's runtime imports `cookie` v2, but in this npm workspace the hoisted
      // copy is fastify's v1 (Astro's sits nested under node_modules/astro). Bundle
      // it so the server output never resolves the wrong or a missing copy.
      noExternal: ['cookie'],
    },
  },
  server: {
    port: 4321,
    host: true,
  },
});

