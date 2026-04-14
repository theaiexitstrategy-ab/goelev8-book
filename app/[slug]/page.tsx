/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

import { createServiceClient } from '@/lib/supabase-service';
import { notFound } from 'next/navigation';
import BookingClient from './BookingClient';

type Props = { params: { slug: string } };

type ServiceItem = {
  name: string;
  duration: number;
  price: number;
};

type Availability = {
  days: string[];
  open: string;
  close: string;
};

type Tenant = {
  id: string;
  slug: string;
  business_name: string;
  brand_color: string;
  logo_url: string | null;
  services: ServiceItem[];
  availability: Availability;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = params;
  const supabase = createServiceClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('business_name')
    .eq('slug', slug)
    .single();

  if (!tenant) return { title: 'Booking Page Not Found' };

  return {
    title: `Book an Appointment — ${tenant.business_name}`,
    description: `Schedule a meeting with ${tenant.business_name}. Choose a service, pick a time, and book instantly.`,
  };
}

export default async function TenantBookingPage({ params }: Props) {
  const { slug } = params;
  const supabase = createServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, business_name, brand_color, logo_url, services, availability')
    .eq('slug', slug)
    .single();

  if (!tenant) notFound();

  // Fetch existing confirmed bookings for this tenant (for slot blocking)
  const { data: existingBookings } = await supabase
    .from('goelev8_bookings')
    .select('booking_date, booking_time')
    .eq('tenant_slug', slug)
    .eq('status', 'confirmed');

  return (
    <BookingClient
      tenant={tenant as Tenant}
      existingBookings={existingBookings || []}
    />
  );
}
