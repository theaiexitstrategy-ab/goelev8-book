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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeToLabel(t: string): string {
  // "08:30:00" → "8:30 AM"
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

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
    .select('id, slug, business_name, brand_color, logo_url, services, availability, client_id')
    .eq('slug', slug)
    .single();

  if (!tenant) notFound();

  let services: ServiceItem[] = tenant.services || [];
  let availability: Availability = tenant.availability || { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], open: '9:00 AM', close: '6:00 PM' };

  // If tenant is linked to a portal client, read real services + availability
  // from the portal tables (booking_services, availability_templates)
  if (tenant.client_id) {
    // Get services from portal
    const { data: portalServices } = await supabase
      .from('booking_services')
      .select('name, full_name, key, info_note, is_active, sort_order')
      .eq('client_id', tenant.client_id)
      .eq('is_active', true)
      .order('sort_order');

    if (portalServices && portalServices.length > 0) {
      services = portalServices
        .filter((s: { name: string }) => s.name !== 'test service')
        .map((s: { name: string; full_name: string | null; info_note: string | null }) => ({
          name: s.full_name || s.name,
          duration: 60,
          price: 0,
        }));
    }

    // Get availability from portal — derive days and hours from availability_templates
    const { data: templates } = await supabase
      .from('availability_templates')
      .select('day_of_week, start_time, end_time')
      .eq('client_id', tenant.client_id)
      .eq('is_active', true);

    if (templates && templates.length > 0) {
      // Collect unique days
      const daySet = new Set<number>();
      let earliestStart = '23:59:00';
      let latestEnd = '00:00:00';

      for (const t of templates) {
        daySet.add(t.day_of_week);
        if (t.start_time < earliestStart) earliestStart = t.start_time;
        if (t.end_time > latestEnd) latestEnd = t.end_time;
      }

      const days = Array.from(daySet).sort().map(d => DAY_NAMES[d]);
      availability = {
        days,
        open: timeToLabel(earliestStart),
        close: timeToLabel(latestEnd),
      };
    }
  }

  // Fetch existing confirmed bookings for this tenant (for slot blocking)
  const { data: existingBookings } = await supabase
    .from('goelev8_bookings')
    .select('booking_date, booking_time')
    .eq('tenant_slug', slug)
    .eq('status', 'confirmed');

  const resolvedTenant: Tenant = {
    id: tenant.id,
    slug: tenant.slug,
    business_name: tenant.business_name,
    brand_color: tenant.brand_color,
    logo_url: tenant.logo_url,
    services,
    availability,
  };

  return (
    <BookingClient
      tenant={resolvedTenant}
      existingBookings={existingBookings || []}
    />
  );
}
