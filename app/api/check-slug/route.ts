/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

const RESERVED = new Set(['api', 'admin', 'www', 'portal', 'book', 'app', 'auth', 'login', 'signup', 'dashboard', 'settings']);

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')?.toLowerCase().trim();

  if (!slug || slug.length < 3 || slug.length > 30 || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ available: false, reason: 'Slug must be 3-30 lowercase alphanumeric characters or hyphens' });
  }

  if (RESERVED.has(slug)) {
    return NextResponse.json({ available: false, reason: 'This name is reserved' });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('tenants')
    .select('slug')
    .eq('slug', slug)
    .single();

  return NextResponse.json({ available: !data });
}
