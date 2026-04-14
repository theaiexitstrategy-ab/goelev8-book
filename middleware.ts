/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// Maps custom booking domains (e.g. book.theflexfacility.com) to their
// tenant slug so the [slug] route renders the right booking page.
// Requests to book.goelev8.ai/[slug] pass through unchanged.

const BOOK_HOST = 'book.goelev8.ai';

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  // Only intercept root path on custom domains
  // (skip API routes, _next, static assets, and book.goelev8.ai itself)
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    host === BOOK_HOST ||
    host.endsWith('.vercel.app') ||
    host === 'localhost:3000' ||
    host.startsWith('localhost')
  ) {
    return NextResponse.next();
  }

  // Custom domain hitting root — look up the tenant slug
  if (pathname === '/' || pathname === '') {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug')
        .eq('custom_domain', host)
        .single();

      if (tenant) {
        // Rewrite to the [slug] route internally (URL stays as book.theflexfacility.com)
        const url = request.nextUrl.clone();
        url.pathname = `/${tenant.slug}`;
        return NextResponse.rewrite(url);
      }
    } catch {
      // Fall through to default
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
