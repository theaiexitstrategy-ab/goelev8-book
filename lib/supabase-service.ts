/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

import { createClient } from '@supabase/supabase-js';

// Next.js caches fetch() responses by default, and supabase-js uses fetch
// under the hood — without this, pages can serve stale tenants, bookings and
// Google Calendar busy times. Every query must hit the database fresh.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noStoreFetch },
    }
  );
}
