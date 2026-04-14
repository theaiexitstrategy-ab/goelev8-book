-- © 2026 GoElev8.ai | Aaron Bryant. All rights reserved.
-- Migration: Tenants and bookings schema for book.goelev8.ai
-- Note: uses goelev8_bookings to avoid conflict with existing bookings table

-- ═══════════════════════════════════════════════════
-- 1. Tables
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  business_name text NOT NULL,
  owner_email text NOT NULL,
  owner_phone text,
  brand_color text DEFAULT '#c8a96e',
  logo_url text,
  services jsonb DEFAULT '[]',
  availability jsonb DEFAULT '{"days":["Mon","Tue","Wed","Thu","Fri"],"open":"9:00 AM","close":"6:00 PM"}',
  staff_count text DEFAULT '1',
  payment_preference text DEFAULT 'none',
  stripe_customer_id text,
  plan text DEFAULT 'free',
  created_at timestamptz DEFAULT now(),
  portal_url text GENERATED ALWAYS AS ('https://portal.goelev8.ai/' || slug) STORED,
  booking_url text GENERATED ALWAYS AS ('https://book.goelev8.ai/' || slug) STORED
);

CREATE TABLE IF NOT EXISTS goelev8_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text REFERENCES tenants(slug),
  client_name text,
  client_email text,
  client_phone text,
  service text,
  booking_date date,
  booking_time text,
  status text DEFAULT 'confirmed',
  stripe_payment_id text,
  created_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 2. Indexes
-- ═══════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_goelev8_bookings_tenant_slug ON goelev8_bookings(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_goelev8_bookings_date ON goelev8_bookings(booking_date);

-- ═══════════════════════════════════════════════════
-- 3. Row Level Security
-- ═══════════════════════════════════════════════════

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE goelev8_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_public_select ON tenants;
CREATE POLICY tenants_public_select ON tenants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS goelev8_bookings_public_insert ON goelev8_bookings;
CREATE POLICY goelev8_bookings_public_insert ON goelev8_bookings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS goelev8_bookings_public_select ON goelev8_bookings;
CREATE POLICY goelev8_bookings_public_select ON goelev8_bookings
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════
-- 4. Seed: The Flex Facility
-- ═══════════════════════════════════════════════════

INSERT INTO tenants (slug, business_name, owner_email, owner_phone, brand_color, services, availability)
VALUES (
  'flexfacility',
  'The Flex Facility',
  'coach@theflexfacility.com',
  '+13149102203',
  '#c8a96e',
  '[{"name":"1-on-1 Training","duration":60,"price":75},{"name":"Group HIIT","duration":45,"price":25},{"name":"NIL Assessment","duration":90,"price":120}]',
  '{"days":["Mon","Tue","Wed","Thu","Fri","Sat"],"open":"8:00 AM","close":"7:00 PM"}'
)
ON CONFLICT (slug) DO NOTHING;
