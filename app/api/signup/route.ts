/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import Stripe from 'stripe';

const RESERVED = new Set(['api', 'admin', 'www', 'portal', 'book', 'app', 'auth', 'login', 'signup', 'dashboard', 'settings']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      slug,
      business_name,
      owner_email,
      owner_phone,
      brand_color,
      logo_url,
      services,
      availability,
      staff_count,
      payment_preference,
      first_name,
      last_name,
      business_type,
    } = body;

    // Validate slug
    const cleanSlug = slug?.toLowerCase().trim();
    if (!cleanSlug || cleanSlug.length < 3 || cleanSlug.length > 30 || !/^[a-z0-9-]+$/.test(cleanSlug)) {
      return NextResponse.json({ error: 'Invalid slug. Must be 3-30 lowercase alphanumeric characters or hyphens.' }, { status: 400 });
    }
    if (RESERVED.has(cleanSlug)) {
      return NextResponse.json({ error: 'This name is reserved.' }, { status: 400 });
    }
    if (!business_name || !owner_email) {
      return NextResponse.json({ error: 'Business name and email are required.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('tenants')
      .select('slug')
      .eq('slug', cleanSlug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'This booking link is already taken.' }, { status: 409 });
    }

    // Create Stripe customer
    let stripeCustomerId: string | null = null;
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const customer = await stripe.customers.create({
        email: owner_email,
        name: business_name,
        phone: owner_phone || undefined,
        metadata: {
          slug: cleanSlug,
          first_name: first_name || '',
          last_name: last_name || '',
          business_type: business_type || '',
        },
      });
      stripeCustomerId = customer.id;
    }

    // Insert tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        slug: cleanSlug,
        business_name,
        owner_email,
        owner_phone: owner_phone || null,
        brand_color: brand_color || '#c8a96e',
        logo_url: logo_url || null,
        services: services || [],
        availability: availability || { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], open: '9:00 AM', close: '6:00 PM' },
        staff_count: staff_count || '1',
        payment_preference: payment_preference || 'none',
        stripe_customer_id: stripeCustomerId,
      })
      .select()
      .single();

    if (error) {
      console.error('Tenant insert error:', error);
      return NextResponse.json({ error: 'Failed to create booking page.' }, { status: 500 });
    }

    // Fire welcome SMS via Supabase Edge Function
    if (owner_phone && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-welcome-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            to: owner_phone,
            business_name,
            slug: cleanSlug,
          }),
        });
      } catch {
        // Non-blocking — SMS failure shouldn't fail signup
      }
    }

    return NextResponse.json({
      success: true,
      slug: cleanSlug,
      portal_url: `https://portal.goelev8.ai/${cleanSlug}`,
      booking_url: `https://book.goelev8.ai/${cleanSlug}`,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
