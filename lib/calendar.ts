/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

// Calendar helpers for book.goelev8.ai:
//   • timezone math (tenant wall-clock → UTC)
//   • .ics generation (Apple Calendar / Outlook / anything)
//   • "Add to Google Calendar" template links
//   • writing bookings to the tenant's connected Google Calendar, using the
//     same OAuth tokens the portal stores in client_google_calendar
//
// Google writes need GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (same values as
// the portal project) so expired access tokens can be refreshed.

import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_TZ = 'America/Chicago';
export const BOOK_BASE_URL = process.env.NEXT_PUBLIC_BOOK_BASE_URL || 'https://book.goelev8.ai';

// ─── Time ────────────────────────────────────────────────────────

/** "9:30 AM" → minutes since midnight */
export function labelToMinutes(label: string): number {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) throw new Error(`bad time label: ${label}`);
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

/** Offset (ms) of `tz` from UTC at the given instant. */
function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - at.getTime();
}

/** Wall-clock date ("2026-11-16") + minutes-of-day in `tz` → UTC Date. */
export function zonedToUtc(date: string, minutes: number, tz: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  // Two passes handle DST transitions correctly.
  let ts = guess - tzOffsetMs(tz, new Date(guess));
  ts = guess - tzOffsetMs(tz, new Date(ts));
  return new Date(ts);
}

/** UTC instant → { date: 'YYYY-MM-DD', minutes } in `tz`. */
export function utcToZoned(at: Date, tz: string): { date: string; minutes: number } {
  const local = new Date(at.getTime() + tzOffsetMs(tz, at));
  return {
    date: local.toISOString().slice(0, 10),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

export type BookingTimes = { start: Date; end: Date };

export function bookingTimes(date: string, timeLabel: string, durationMin: number, tz: string): BookingTimes {
  const start = zonedToUtc(date, labelToMinutes(timeLabel), tz);
  return { start, end: new Date(start.getTime() + durationMin * 60_000) };
}

// ─── Event content ──────────────────────────────────────────────

export type CalendarBooking = {
  id: string;
  service: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  booking_date: string;
  booking_time: string;
  duration_min: number;
};

export type CalendarTenant = {
  slug: string;
  business_name: string;
  owner_email: string | null;
  timezone: string;
};

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

/** Fold lines at 75 octets per RFC 5545. */
function icsFold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

/** Single-event .ics. Times are in UTC so every client renders them correctly. */
export function buildIcs(b: CalendarBooking, t: CalendarTenant): string {
  const { start, end } = bookingTimes(b.booking_date, b.booking_time, b.duration_min, t.timezone);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GoElev8.AI//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@book.goelev8.ai`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(`${b.service} — ${t.business_name}`)}`,
    `DESCRIPTION:${icsEscape(`${b.service} with ${t.business_name}\nBooked by ${b.client_name}\n${BOOK_BASE_URL}/${t.slug}`)}`,
    `URL:${BOOK_BASE_URL}/${t.slug}`,
    t.owner_email ? `ORGANIZER;CN=${icsEscape(t.business_name)}:mailto:${t.owner_email}` : null,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(b.service)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean) as string[];
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/** Pre-filled "Add to Google Calendar" link for the person who booked. */
export function googleTemplateUrl(b: CalendarBooking, t: CalendarTenant): string {
  const { start, end } = bookingTimes(b.booking_date, b.booking_time, b.duration_min, t.timezone);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${b.service} — ${t.business_name}`,
    dates: `${icsStamp(start)}/${icsStamp(end)}`,
    details: `${b.service} with ${t.business_name}\n${BOOK_BASE_URL}/${t.slug}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function icsUrl(bookingId: string): string {
  return `${BOOK_BASE_URL}/api/ics?id=${bookingId}`;
}

// ─── Google Calendar (tenant's connected account) ───────────────

type GcalRow = {
  client_id: string;
  calendar_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

async function loadAccessToken(supabase: SupabaseClient, clientId: string): Promise<{ token: string; calendarId: string } | null> {
  const { data } = await supabase
    .from('client_google_calendar')
    .select('client_id, calendar_id, access_token, refresh_token, token_expires_at')
    .eq('client_id', clientId)
    .maybeSingle<GcalRow>();
  if (!data || (!data.access_token && !data.refresh_token)) return null;

  const calendarId = data.calendar_id || 'primary';
  const exp = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (data.access_token && exp - Date.now() > 60_000) return { token: data.access_token, calendarId };

  const clientIdEnv = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!data.refresh_token || !clientIdEnv || !secret) {
    console.error('gcal: cannot refresh token (missing refresh_token or GOOGLE_CLIENT_ID/SECRET env)');
    return null;
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: data.refresh_token,
      client_id: clientIdEnv,
      client_secret: secret,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('gcal_refresh_failed: ' + (json.error_description || json.error || res.status));

  const newExp = new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString();
  await supabase
    .from('client_google_calendar')
    .update({ access_token: json.access_token, token_expires_at: newExp, updated_at: new Date().toISOString() })
    .eq('client_id', clientId);
  return { token: json.access_token, calendarId };
}

/**
 * Mirror a booking onto the tenant's connected Google Calendar and invite the
 * client as an attendee (Google emails them an invite that works with Gmail,
 * Apple Calendar and Outlook). Best-effort: never throws.
 */
export async function pushBookingToGoogle(
  supabase: SupabaseClient,
  clientId: string | null,
  b: CalendarBooking,
  t: CalendarTenant
): Promise<{ ok: boolean; skipped?: string; event_id?: string; error?: string }> {
  if (!clientId) return { ok: true, skipped: 'tenant_not_linked' };
  try {
    const auth = await loadAccessToken(supabase, clientId);
    if (!auth) return { ok: true, skipped: 'google_not_connected' };

    const { start, end } = bookingTimes(b.booking_date, b.booking_time, b.duration_min, t.timezone);
    const event = {
      summary: `${b.service} — ${b.client_name}`,
      description: [
        `Booked via ${BOOK_BASE_URL}/${t.slug}`,
        `Name: ${b.client_name}`,
        b.client_email ? `Email: ${b.client_email}` : null,
        b.client_phone ? `Phone: ${b.client_phone}` : null,
      ].filter(Boolean).join('\n'),
      start: { dateTime: start.toISOString(), timeZone: t.timezone },
      end: { dateTime: end.toISOString(), timeZone: t.timezone },
      transparency: 'opaque',
      attendees: b.client_email ? [{ email: b.client_email, displayName: b.client_name }] : undefined,
      reminders: { useDefault: true },
      extendedProperties: { private: { goelev8_source: 'book', goelev8_booking_id: b.id } },
    };

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events?sendUpdates=all`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `gcal_http_${res.status}`);

    await supabase
      .from('goelev8_bookings')
      .update({ google_event_id: json.id, google_calendar_id: auth.calendarId })
      .eq('id', b.id);
    return { ok: true, event_id: json.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('gcal push failed:', msg);
    await supabase
      .from('client_google_calendar')
      .update({ last_sync_error: `book push: ${msg}`.slice(0, 500) })
      .eq('client_id', clientId);
    return { ok: false, error: msg };
  }
}

// ─── Busy blocks (Google → booking page) ────────────────────────

export type BusyRange = { date: string; start: number; end: number }; // minutes-of-day in tenant tz

/** Read the portal's google_calendar_busy cache and convert to per-day ranges in tenant tz. */
export async function loadBusyRanges(
  supabase: SupabaseClient,
  clientId: string | null,
  tz: string,
  days = 120
): Promise<BusyRange[]> {
  if (!clientId) return [];
  const now = new Date();
  const until = new Date(now.getTime() + days * 86_400_000);
  const { data } = await supabase
    .from('google_calendar_busy')
    .select('starts_at, ends_at')
    .eq('client_id', clientId)
    .lt('starts_at', until.toISOString())
    .gt('ends_at', now.toISOString());

  const out: BusyRange[] = [];
  for (const row of data || []) {
    const s = utcToZoned(new Date(row.starts_at), tz);
    const e = utcToZoned(new Date(row.ends_at), tz);
    // Split multi-day events into one range per day.
    let date = s.date;
    let start = s.minutes;
    for (let guard = 0; guard < 60; guard++) {
      const isLast = date === e.date;
      const end = isLast ? e.minutes : 24 * 60;
      if (end > start) out.push({ date, start, end });
      if (isLast || date > e.date) break;
      const next = new Date(date + 'T00:00:00Z');
      next.setUTCDate(next.getUTCDate() + 1);
      date = next.toISOString().slice(0, 10);
      start = 0;
    }
  }
  return out;
}

export function overlapsBusy(busy: BusyRange[], date: string, startMin: number, durationMin: number): boolean {
  const endMin = startMin + durationMin;
  return busy.some((r) => r.date === date && r.start < endMin && r.end > startMin);
}
