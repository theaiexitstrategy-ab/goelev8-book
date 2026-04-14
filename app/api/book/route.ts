/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

async function sendSms(to: string, body: string, fromNumber?: string | null) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = fromNumber || process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return;

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, service, date, time, client_name, client_phone, client_email } = body;

    if (!slug || !service || !date || !time || !client_name || !client_phone) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify tenant exists and get linked client info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, owner_phone, client_id')
      .eq('slug', slug)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }

    // If tenant is linked to a portal client, use their Twilio phone number
    let tenantPhone: string | null = null;
    if (tenant.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('twilio_phone_number')
        .eq('id', tenant.client_id)
        .single();
      if (client?.twilio_phone_number) {
        tenantPhone = client.twilio_phone_number;
      }
    }

    // Check for double-booking
    const { data: existing } = await supabase
      .from('goelev8_bookings')
      .select('id')
      .eq('tenant_slug', slug)
      .eq('booking_date', date)
      .eq('booking_time', time)
      .eq('status', 'confirmed')
      .single();

    if (existing) {
      return NextResponse.json({ error: 'This time slot is no longer available.' }, { status: 409 });
    }

    // Insert booking
    const { data: booking, error } = await supabase
      .from('goelev8_bookings')
      .insert({
        tenant_slug: slug,
        client_name,
        client_email: client_email || null,
        client_phone,
        service,
        booking_date: date,
        booking_time: time,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Booking insert error:', error);
      return NextResponse.json({ error: 'Failed to create booking.' }, { status: 500 });
    }

    // SMS confirmation to client — from the tenant's own number
    await sendSms(
      client_phone,
      `Confirmed! Your ${service} at ${tenant.business_name} is booked for ${date} at ${time}. Reply CANCEL to cancel.`,
      tenantPhone
    );

    // SMS notification to business owner
    if (tenant.owner_phone) {
      await sendSms(
        tenant.owner_phone,
        `New booking: ${client_name} booked ${service} for ${date} at ${time}. Via book.goelev8.ai/${slug}`,
        tenantPhone
      );
    }

    return NextResponse.json({
      confirmed: true,
      booking_id: booking.id,
    });
  } catch (err) {
    console.error('Booking error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
