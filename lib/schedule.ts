/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

// Server-side loader for everything that defines a tenant's bookable time:
//   • weekly hours — portal availability_templates (per day, optionally per
//     service) for linked tenants, else tenants.availability
//   • "Available" events on the owner's Google Calendar (override weekly hours)
//   • busy time — Google Calendar events, portal blocked dates, and existing
//     confirmed bookings (by their real duration)
// Used by both the booking page and /api/book so they always agree.

import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_TZ, labelToMinutes, loadAvailableWindows, loadBusyRanges, utcToZoned } from './calendar';
import type { BusyRange, Schedule, Window } from './availability';

export type ServiceItem = {
  name: string;
  duration: number;
  price: number;
  info_note?: string | null;
};

export type TenantRow = {
  id: string;
  slug: string;
  business_name: string;
  brand_color: string;
  logo_url: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  client_id: string | null;
  timezone: string | null;
  services: ServiceItem[] | null;
  availability: { days: string[]; open: string; close: string } | null;
};

export type BookingConfig = {
  tenant: TenantRow & { timezone: string };
  services: ServiceItem[];
  schedule: Schedule;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeToMinutes(t: string): number {
  // "08:30:00" → 510
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export async function loadBookingConfig(supabase: SupabaseClient, slug: string): Promise<BookingConfig | null> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, business_name, brand_color, logo_url, owner_email, owner_phone, client_id, timezone, services, availability')
    .eq('slug', slug)
    .maybeSingle<TenantRow>();
  if (!tenant) return null;

  const tz = tenant.timezone || DEFAULT_TZ;
  let services: ServiceItem[] = tenant.services || [];
  const weekly: Record<number, Window[]> = {};

  // ── Services + weekly hours from the portal (linked tenants) ──
  let usedTemplates = false;
  if (tenant.client_id) {
    const [{ data: portalServices }, { data: templates }] = await Promise.all([
      supabase
        .from('booking_services')
        .select('id, name, full_name, info_note, sort_order')
        .eq('client_id', tenant.client_id)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('availability_templates')
        .select('day_of_week, start_time, end_time, service_id')
        .eq('client_id', tenant.client_id)
        .eq('is_active', true),
    ]);

    const serviceNameById = new Map<string, string>();
    if (portalServices && portalServices.length > 0) {
      const visible = portalServices.filter((s) => s.name !== 'test service');
      for (const s of visible) serviceNameById.set(s.id, s.full_name || s.name);
      services = visible.map((s) => ({
        name: s.full_name || s.name,
        duration: 60,
        price: 0,
        info_note: s.info_note || null,
      }));
    }

    if (templates && templates.length > 0) {
      usedTemplates = true;
      const seen = new Set<string>();
      for (const t of templates) {
        const service = t.service_id ? serviceNameById.get(t.service_id) ?? null : null;
        // Template for a service that's inactive/hidden → skip it.
        if (t.service_id && !service) continue;
        const key = `${t.day_of_week}|${t.start_time}|${t.end_time}|${service ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        (weekly[t.day_of_week] ||= []).push({
          start: timeToMinutes(t.start_time),
          end: timeToMinutes(t.end_time),
          service,
        });
      }
    }
  }

  // ── Fallback: simple days + open/close on the tenant row ──
  if (!usedTemplates) {
    const a = tenant.availability || { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], open: '9:00 AM', close: '6:00 PM' };
    const start = labelToMinutes(a.open);
    const end = labelToMinutes(a.close);
    a.days.forEach((d) => {
      const idx = DAY_NAMES.indexOf(d);
      if (idx >= 0) weekly[idx] = [{ start, end }];
    });
  }

  // ── Busy time ──
  const today = utcToZoned(new Date(), tz).date;
  const [gcalBusy, gcalAvailable, blockedRes, bookingsRes] = await Promise.all([
    loadBusyRanges(supabase, tenant.client_id, tz),
    loadAvailableWindows(supabase, tenant.client_id, tz),
    tenant.client_id
      ? supabase
          .from('booking_blocked_dates')
          .select('blocked_date, start_time, end_time')
          .eq('client_id', tenant.client_id)
          .gte('blocked_date', today)
      : Promise.resolve({ data: [] as { blocked_date: string; start_time: string | null; end_time: string | null }[] }),
    supabase
      .from('goelev8_bookings')
      .select('booking_date, booking_time, duration_min')
      .eq('tenant_slug', slug)
      .eq('status', 'confirmed')
      .gte('booking_date', today),
  ]);

  const busy: BusyRange[] = [...gcalBusy];
  for (const b of blockedRes.data || []) {
    busy.push({
      date: b.blocked_date,
      start: b.start_time ? timeToMinutes(b.start_time) : 0,
      end: b.end_time ? timeToMinutes(b.end_time) : 24 * 60,
    });
  }
  for (const b of bookingsRes.data || []) {
    try {
      const start = labelToMinutes(b.booking_time);
      busy.push({ date: b.booking_date, start, end: start + (b.duration_min || 60) });
    } catch {
      /* malformed legacy time — ignore */
    }
  }

  return {
    tenant: { ...tenant, timezone: tz },
    services,
    schedule: { tz, weekly, gcalAvailable, busy },
  };
}
