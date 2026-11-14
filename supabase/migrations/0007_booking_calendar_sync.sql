-- © 2026 GoElev8.ai | Aaron Bryant. All rights reserved.
-- Migration: calendar sync for book.goelev8.ai bookings
--   • tenants.timezone — wall-clock zone the tenant's slots are expressed in
--   • goelev8_bookings.duration_min / google_event_id / google_calendar_id —
--     so we can mirror bookings to the tenant's connected Google Calendar
--     (portal table client_google_calendar) and generate .ics files.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Chicago';

ALTER TABLE goelev8_bookings
  ADD COLUMN IF NOT EXISTS duration_min integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_id text;
