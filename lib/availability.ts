/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

// Pure availability math, shared by the booking page (browser) and
// /api/book (server) so both always agree on which slots are bookable.
// All times are minutes-of-day in the tenant's timezone.

export type Window = { start: number; end: number; service?: string | null };
export type BusyRange = { date: string; start: number; end: number };

export type Schedule = {
  tz: string;
  /** Recurring weekly hours, keyed by day of week (0 = Sunday). */
  weekly: Record<number, Window[]>;
  /**
   * Windows from "Available" events on the owner's Google Calendar, keyed by
   * date. When non-null, these replace the weekly hours entirely.
   */
  gcalAvailable: Record<string, Window[]> | null;
  /** Everything that blocks time: Google busy events, blocked dates, bookings. */
  busy: BusyRange[];
};

export const SLOT_STEP_MIN = 30;
/** Don't offer slots starting sooner than this from now. */
export const MIN_NOTICE_MIN = 15;

export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function overlapsBusy(busy: BusyRange[], date: string, startMin: number, durationMin: number): boolean {
  const endMin = startMin + durationMin;
  return busy.some((r) => r.date === date && r.start < endMin && r.end > startMin);
}

export function windowsForDate(schedule: Schedule, date: string, service: string | null): Window[] {
  const raw = schedule.gcalAvailable
    ? schedule.gcalAvailable[date] || []
    : schedule.weekly[dayOfWeek(date)] || [];
  return raw.filter((w) => !w.service || !service || w.service === service);
}

/**
 * Bookable start times (minutes-of-day) for a date. `now` is the current
 * date/minutes in the tenant's timezone, used to hide past slots.
 */
export function slotsForDate(
  schedule: Schedule,
  date: string,
  durationMin: number,
  service: string | null,
  now: { date: string; minutes: number }
): number[] {
  if (date < now.date) return [];
  const out = new Set<number>();
  for (const w of windowsForDate(schedule, date, service)) {
    for (let t = w.start; t + durationMin <= w.end; t += SLOT_STEP_MIN) {
      if (date === now.date && t < now.minutes + MIN_NOTICE_MIN) continue;
      if (overlapsBusy(schedule.busy, date, t, durationMin)) continue;
      out.add(t);
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}
