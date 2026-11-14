/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

// GET /api/ics?id=<booking uuid> → downloadable .ics for Apple Calendar,
// Outlook, or any calendar app. Tapping the link on iPhone opens Calendar.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { buildIcs, DEFAULT_TZ } from '@/lib/calendar';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || '';
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid booking id.' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: b } = await supabase
    .from('goelev8_bookings')
    .select('id, tenant_slug, service, client_name, client_email, client_phone, booking_date, booking_time, duration_min, status')
    .eq('id', id)
    .maybeSingle();
  if (!b || b.status !== 'confirmed') return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

  const { data: t } = await supabase
    .from('tenants')
    .select('slug, business_name, owner_email, timezone')
    .eq('slug', b.tenant_slug)
    .single();
  if (!t) return NextResponse.json({ error: 'Business not found.' }, { status: 404 });

  const ics = buildIcs(
    { ...b, duration_min: b.duration_min || 60 },
    { ...t, timezone: t.timezone || DEFAULT_TZ }
  );

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="booking-${t.slug}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
