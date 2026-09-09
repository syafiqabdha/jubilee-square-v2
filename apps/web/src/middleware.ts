import { defineMiddleware } from 'astro:middleware';

const REDIRECT_MAP: Record<string, string> = {
  '/index.aspx': '/',
  '/default.aspx': '/',
  '/stores.aspx': '/directory',
  '/store_directory.aspx': '/directory',
  '/whats-new.aspx': '/news',
  '/deals.aspx': '/deals',
  '/services.aspx': '/services',
  '/location.aspx': '/location',
  '/about.aspx': '/about',
  '/contact.aspx': '/contact',
  '/terms.aspx': '/terms',
  '/mobile': '/',
  '/mobile/': '/',
  '/mobile/index.aspx': '/',
  '/mobile/default.aspx': '/',
  '/mobile/stores.aspx': '/directory',
  '/mobile/store_directory.aspx': '/directory',
  '/mobile/whats-new.aspx': '/news',
  '/mobile/deals.aspx': '/deals',
  '/mobile/services.aspx': '/services',
  '/mobile/location.aspx': '/location',
  '/mobile/about.aspx': '/about',
  '/mobile/contact.aspx': '/contact',
  '/mobile/terms.aspx': '/terms',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname.toLowerCase();

  // Check direct exact match in redirect map
  if (REDIRECT_MAP[pathname]) {
    return context.redirect(REDIRECT_MAP[pathname], 301);
  }

  // Handle /whats-new-detail.aspx?id=...
  if (pathname.includes('whats-new-detail.aspx')) {
    const id = url.searchParams.get('id');
    return context.redirect(id ? `/news?legacy_id=${encodeURIComponent(id)}` : '/news', 301);
  }

  // Handle /deal-detail.aspx?id=...
  if (pathname.includes('deal-detail.aspx')) {
    const id = url.searchParams.get('id');
    return context.redirect(id ? `/deals?legacy_id=${encodeURIComponent(id)}` : '/deals', 301);
  }

  // Handle general /mobile/* catch-all
  if (pathname.startsWith('/mobile/')) {
    return context.redirect('/', 301);
  }

  return next();
});
