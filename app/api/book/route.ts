/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import {
  labelToMinutes, zonedToUtc, utcToZoned,
  pushBookingToGoogle, googleTemplateUrl, icsUrl,
} from '@/lib/calendar';
import { slotsForDate } from '@/lib/availability';
import { loadBookingConfig } from '@/lib/schedule';

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

// Mirror a booking into the portal's bookings + leads tables so it shows up
// in portal.goelev8.ai/{slug}. Mirrors the shape used by book.theflexfacility.com.
// Failure here is non-fatal — the user's booking is already confirmed.
async function mirrorToPortal(
  supabase: ReturnType<typeof createServiceClient>,
  args: {
    clientId: string;
    name: string;
    phone: string;
    email: string | null;
    service: string;
    date: string;
    time: string;
    tz: string;
  }
) {
  try {
    const { clientId, name, phone, email, service, date, time, tz } = args;
    const startsAt = zonedToUtc(date, labelToMinutes(time), tz).toISOString();
    const bookingDate = `${date} ${time}`;

    const { data: bookingRow, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        client_id: clientId,
        lead_name: name,
        phone,
        email: email || null,
        booking_date: bookingDate,
        service,
        service_type: service,
        starts_at: startsAt,
        status: 'Confirmed',
        source: 'book.goelev8.ai',
      })
      .select('id')
      .single();

    if (bookingErr) {
      console.error('Portal bookings insert error:', bookingErr);
      return;
    }

    let leadId: string | null = null;
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('client_id', clientId)
      .eq('phone', phone)
      .maybeSingle();

    if (existingLead) {
      leadId = existingLead.id;
      await supabase
        .from('leads')
        .update({ status: 'Ready to Book', name, email: email || null })
        .eq('id', leadId);
    } else {
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          client_id: clientId,
          name,
          phone,
          email: email || null,
          source: 'book.goelev8.ai',
          funnel: 'booking',
          status: 'Ready to Book',
          tags: ['ready-to-book'],
        })
        .select('id')
        .single();
      leadId = newLead?.id || null;
    }

    if (leadId && bookingRow?.id) {
      await supabase.from('bookings').update({ lead_id: leadId }).eq('id', bookingRow.id);
    }
  } catch (err) {
    console.error('Portal mirror error (non-fatal):', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, service, date, time, client_name, client_phone, client_email } = body;

    if (!slug || !service || !date || !time || !client_name || !client_phone) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Load tenant + the same schedule the booking page uses
    const config = await loadBookingConfig(supabase, slug);
    if (!config) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }
    const { tenant, services, schedule } = config;
    const tz = tenant.timezone;

    let startMin: number;
    try { startMin = labelToMinutes(time); }
    catch { return NextResponse.json({ error: 'Invalid time.' }, { status: 400 }); }

    // Duration comes from the tenant's service list, not the browser
    const svc = services.find((s) => s.name === service);
    const duration_min = svc?.duration || 60;

    // Slot must be inside business hours and clear of busy time
    const now = utcToZoned(new Date(), tz);
    if (!slotsForDate(schedule, date, duration_min, svc ? svc.name : null, now).includes(startMin)) {
      return NextResponse.json({ error: 'This time slot is no longer available.' }, { status: 409 });
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
      .limit(1);

    // Re-check right before insert (guards against two people booking at once)
    if (existing && existing.length > 0) {
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
        duration_min,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Booking insert error:', error);
      return NextResponse.json({ error: 'Failed to create booking.' }, { status: 500 });
    }

    // Mirror to portal so the booking shows up at portal.goelev8.ai/{slug}
    if (tenant.client_id) {
      await mirrorToPortal(supabase, {
        clientId: tenant.client_id,
        name: client_name,
        phone: client_phone,
        email: client_email || null,
        service,
        date,
        time,
        tz,
      });
    }

    const calBooking = {
      id: booking.id,
      service,
      client_name,
      client_email: client_email || null,
      client_phone,
      booking_date: date,
      booking_time: time,
      duration_min,
    };
    const calTenant = {
      slug: tenant.slug,
      business_name: tenant.business_name,
      owner_email: tenant.owner_email,
      timezone: tz,
    };

    // Put it on the owner's Google Calendar and email the client a calendar invite
    const gcal = await pushBookingToGoogle(supabase, tenant.client_id, calBooking, calTenant);

    // SMS confirmation to client — from the tenant's own number
    await sendSms(
      client_phone,
      `Confirmed! Your ${service} at ${tenant.business_name} is booked for ${date} at ${time}. Add to your calendar: ${icsUrl(booking.id)} Reply CANCEL to cancel.`,
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
      calendar: {
        google_url: googleTemplateUrl(calBooking, calTenant),
        ics_url: icsUrl(booking.id),
        synced_to_owner: !!gcal.event_id,
        invite_emailed: !!gcal.event_id && !!client_email,
      },
    });
  } catch (err) {
    console.error('Booking error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
