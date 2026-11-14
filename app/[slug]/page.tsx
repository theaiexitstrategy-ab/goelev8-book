/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

import { createServiceClient } from '@/lib/supabase-service';
import { notFound } from 'next/navigation';
import BookingClient from './BookingClient';
import { loadBookingConfig } from '@/lib/schedule';

type Props = { params: { slug: string } };

// Always render fresh so new bookings + Google Calendar changes show up.
export const dynamic = 'force-dynamic';

export const viewport = { themeColor: '#f4f5f7' };

export async function generateMetadata({ params }: Props) {
  const supabase = createServiceClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('business_name')
    .eq('slug', params.slug)
    .single();

  if (!tenant) return { title: 'Booking Page Not Found' };

  return {
    title: `Book an Appointment — ${tenant.business_name}`,
    description: `Schedule a meeting with ${tenant.business_name}. Choose a service, pick a time, and book instantly.`,
  };
}

export default async function TenantBookingPage({ params }: Props) {
  const supabase = createServiceClient();
  const config = await loadBookingConfig(supabase, params.slug);
  if (!config) notFound();

  const { tenant, services, schedule } = config;

  return (
    <BookingClient
      tenant={{
        id: tenant.id,
        slug: tenant.slug,
        business_name: tenant.business_name,
        brand_color: tenant.brand_color,
        logo_url: tenant.logo_url,
        services,
        timezone: tenant.timezone,
      }}
      schedule={schedule}
    />
  );
}
