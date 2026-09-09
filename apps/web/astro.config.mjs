import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
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
  integrations: [tailwind()],
  server: {
    port: 4321,
    host: true,
  },
});

