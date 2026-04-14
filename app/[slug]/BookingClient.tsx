/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */
'use client';

import { useCallback, useMemo, useState } from 'react';

type ServiceItem = { name: string; duration: number; price: number };
type Availability = { days: string[]; open: string; close: string };
type Tenant = {
  id: string;
  slug: string;
  business_name: string;
  brand_color: string;
  logo_url: string | null;
  services: ServiceItem[];
  availability: Availability;
};
type ExistingBooking = { booking_date: string; booking_time: string };

type Props = {
  tenant: Tenant;
  existingBookings: ExistingBooking[];
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseTime(t: string): number {
  const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function generateTimeSlots(open: string, close: string, duration: number): string[] {
  const start = parseTime(open);
  const end = parseTime(close);
  const slots: string[] = [];
  for (let t = start; t + duration <= end; t += 30) {
    slots.push(formatTime(t));
  }
  return slots;
}

export default function BookingClient({ tenant, existingBookings }: Props) {
  const brand = tenant.brand_color || '#c8a96e';
  const services = tenant.services || [];
  const avail = tenant.availability || { days: [], open: '9:00 AM', close: '6:00 PM' };

  const [selectedService, setSelectedService] = useState<ServiceItem | null>(services[0] || null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<'calendar' | 'form' | 'success'>('calendar');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const bookedSlots = useMemo(() => {
    const set = new Set<string>();
    existingBookings.forEach((b) => set.add(`${b.booking_date}|${b.booking_time}`));
    return set;
  }, [existingBookings]);

  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number; dateStr: string; available: boolean; isToday: boolean; isPast: boolean }[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: 0, dateStr: '', available: false, isToday: false, isPast: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayName = DAY_NAMES[new Date(year, month, d).getDay()];
      const isPast = dateStr < today;
      const isAvailDay = avail.days.includes(dayName);
      cells.push({
        day: d,
        dateStr,
        available: !isPast && isAvailDay,
        isToday: dateStr === today,
        isPast,
      });
    }
    return cells;
  }, [currentMonth, avail.days, today]);

  const timeSlots = useMemo(() => {
    if (!selectedDate || !selectedService) return [];
    const duration = selectedService.duration;
    return generateTimeSlots(avail.open, avail.close, duration);
  }, [selectedDate, selectedService, avail.open, avail.close]);

  const isSlotBooked = useCallback(
    (time: string) => selectedDate ? bookedSlots.has(`${selectedDate}|${time}`) : false,
    [selectedDate, bookedSlots]
  );

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !selectedService || !clientName || !clientPhone) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: tenant.slug,
          service: selectedService.name,
          date: selectedDate,
          time: selectedTime,
          client_name: clientName,
          client_phone: clientPhone,
          client_email: clientEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Booking failed.');
        setSubmitting(false);
        return;
      }

      setStep('success');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <style>{`
        :root {
          --brand: ${brand};
          --black: #080808;
          --ink: #0f0f0f;
          --surface: #161616;
          --border: #222;
          --text: #f0ede8;
          --muted: #6b6560;
          --dim: #2a2825;
          --green: #3ecf8e;
          --red: #e05252;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--black); color: var(--text); font-family: "DM Mono", monospace; font-size: 14px; line-height: 1.6; }
        body::after { content: ""; position: fixed; inset: 0; background-image: linear-gradient(rgba(200,169,110,.018) 1px,transparent 1px), linear-gradient(90deg,rgba(200,169,110,.018) 1px,transparent 1px); background-size: 72px 72px; pointer-events: none; z-index: 0; }
      `}</style>
      <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <header style={{
          borderBottom: '1px solid var(--border)',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(8,8,8,.93)',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {tenant.logo_url && (
              <img src={tenant.logo_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            )}
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15 }}>
                {tenant.business_name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.04em' }}>
                book.goelev8.ai/{tenant.slug}
              </div>
            </div>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(62,207,142,.07)',
            border: '1px solid rgba(62,207,142,.18)',
            padding: '3px 8px',
            fontSize: 9,
            color: 'var(--green)',
            letterSpacing: '.08em',
            textTransform: 'uppercase' as const,
          }}>
            <span style={{ width: 5, height: 5, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} />
            AI-Powered
          </div>
        </header>

        {/* Main */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px 80px' }}>
          <div style={{
            background: 'var(--ink)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: services.length > 0 ? '200px 1fr' : '1fr',
            }}>
              {/* Service sidebar */}
              {services.length > 0 && (
                <div style={{
                  background: 'var(--surface)',
                  borderRight: '1px solid var(--border)',
                  padding: '20px 16px',
                }}>
                  <div style={{
                    fontSize: 9,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--muted)',
                    marginBottom: 10,
                  }}>
                    Select a Service
                  </div>
                  {services.map((svc, i) => (
                    <div
                      key={i}
                      onClick={() => { setSelectedService(svc); setSelectedTime(null); }}
                      style={{
                        padding: '12px 10px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        borderLeft: selectedService?.name === svc.name ? `2px solid ${brand}` : '2px solid transparent',
                        background: selectedService?.name === svc.name ? `${brand}11` : 'transparent',
                        transition: 'all .2s',
                      }}
                    >
                      <div style={{
                        fontFamily: "'Syne', sans-serif",
                        fontWeight: 600,
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: selectedService?.name === svc.name ? brand : 'var(--text)',
                      }}>
                        {svc.name}
                        <span style={{ color: brand }}>${svc.price}</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                        {svc.duration} min
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Calendar + slots */}
              <div style={{ padding: 24 }}>
                {step === 'calendar' && (
                  <>
                    {/* Month header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>
                        {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => setCurrentMonth(p => {
                            const m = p.month === 0 ? 11 : p.month - 1;
                            const y = p.month === 0 ? p.year - 1 : p.year;
                            return { year: y, month: m };
                          })}
                          style={{ width: 28, height: 28, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          &#9665;
                        </button>
                        <button
                          onClick={() => setCurrentMonth(p => {
                            const m = p.month === 11 ? 0 : p.month + 1;
                            const y = p.month === 11 ? p.year + 1 : p.year;
                            return { year: y, month: m };
                          })}
                          style={{ width: 28, height: 28, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          &#9655;
                        </button>
                      </div>
                    </div>

                    {/* Day labels */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                      {DAY_LABELS.map(d => (
                        <div key={d} style={{ textAlign: 'center', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--dim)', padding: '4px 0' }}>
                          {d}
                        </div>
                      ))}
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                      {calendarDays.map((cell, i) => {
                        if (cell.day === 0) return <div key={`e${i}`} />;
                        const isSelected = selectedDate === cell.dateStr;
                        return (
                          <div
                            key={cell.dateStr}
                            onClick={() => {
                              if (!cell.available) return;
                              setSelectedDate(cell.dateStr);
                              setSelectedTime(null);
                            }}
                            style={{
                              aspectRatio: '1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              position: 'relative',
                              border: isSelected ? `1px solid ${brand}` : cell.isToday ? `1px solid ${brand}55` : '1px solid transparent',
                              background: isSelected ? brand : 'transparent',
                              color: isSelected ? 'var(--black)' : cell.isPast ? 'var(--dim)' : cell.available ? 'var(--text)' : 'var(--dim)',
                              fontWeight: isSelected ? 700 : 400,
                              cursor: cell.available ? 'pointer' : 'default',
                              textDecoration: !cell.available && !cell.isPast && cell.day > 0 ? 'line-through' : 'none',
                              transition: 'all .15s',
                            }}
                          >
                            {cell.day}
                            {cell.available && !isSelected && (
                              <span style={{
                                position: 'absolute',
                                bottom: 3,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 3,
                                height: 3,
                                borderRadius: '50%',
                                background: 'var(--green)',
                              }} />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Time slots */}
                    {selectedDate && (
                      <div style={{ marginTop: 18 }}>
                        <div style={{
                          fontSize: 9,
                          letterSpacing: '.1em',
                          textTransform: 'uppercase' as const,
                          color: 'var(--muted)',
                          marginBottom: 8,
                        }}>
                          Available Times &mdash; {formatDateLabel(selectedDate)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                          {timeSlots.map(time => {
                            const booked = isSlotBooked(time);
                            const sel = selectedTime === time;
                            return (
                              <div
                                key={time}
                                onClick={() => !booked && setSelectedTime(time)}
                                style={{
                                  border: sel ? `1px solid ${brand}` : '1px solid var(--border)',
                                  background: sel ? `${brand}22` : 'var(--surface)',
                                  padding: '8px 4px',
                                  textAlign: 'center',
                                  fontSize: 11,
                                  color: booked ? 'var(--dim)' : sel ? brand : 'var(--muted)',
                                  textDecoration: booked ? 'line-through' : 'none',
                                  opacity: booked ? 0.3 : 1,
                                  cursor: booked ? 'default' : 'pointer',
                                  pointerEvents: booked ? 'none' : 'auto',
                                  transition: 'all .2s',
                                }}
                              >
                                {time}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Confirm button */}
                    {selectedDate && selectedTime && (
                      <div style={{ marginTop: 16 }}>
                        <button
                          onClick={() => setStep('form')}
                          style={{
                            width: '100%',
                            background: brand,
                            color: 'var(--black)',
                            border: 'none',
                            padding: '13px',
                            fontFamily: "'Syne', sans-serif",
                            fontWeight: 700,
                            fontSize: 12,
                            letterSpacing: '.05em',
                            textTransform: 'uppercase' as const,
                            cursor: 'pointer',
                            clipPath: 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))',
                          }}
                        >
                          Continue &mdash; {selectedTime} &rarr;
                        </button>
                      </div>
                    )}
                  </>
                )}

                {step === 'form' && (
                  <div>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
                        Complete Your Booking
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {selectedService?.name} &mdash; {formatDateLabel(selectedDate!)} at {selectedTime}
                        {selectedService && <span style={{ color: brand }}> &middot; ${selectedService.price}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                          Your Name *
                        </label>
                        <input
                          value={clientName}
                          onChange={e => setClientName(e.target.value)}
                          placeholder="Full name"
                          style={{
                            width: '100%',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            padding: '12px 14px',
                            fontFamily: '"DM Mono", monospace',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                          Phone Number *
                        </label>
                        <input
                          value={clientPhone}
                          onChange={e => setClientPhone(e.target.value)}
                          placeholder="+1 (314) 000-0000"
                          type="tel"
                          style={{
                            width: '100%',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            padding: '12px 14px',
                            fontFamily: '"DM Mono", monospace',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                          Email (optional)
                        </label>
                        <input
                          value={clientEmail}
                          onChange={e => setClientEmail(e.target.value)}
                          placeholder="you@email.com"
                          type="email"
                          style={{
                            width: '100%',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            padding: '12px 14px',
                            fontFamily: '"DM Mono", monospace',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>

                    {error && (
                      <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 12 }}>{error}</div>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                      <button
                        onClick={() => setStep('calendar')}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--muted)',
                          padding: '13px 20px',
                          fontFamily: '"DM Mono", monospace',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Back
                      </button>
                      <button
                        onClick={handleConfirm}
                        disabled={submitting || !clientName || !clientPhone}
                        style={{
                          flex: 1,
                          background: (!clientName || !clientPhone) ? 'var(--dim)' : brand,
                          color: 'var(--black)',
                          border: 'none',
                          padding: '13px',
                          fontFamily: "'Syne', sans-serif",
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: '.05em',
                          textTransform: 'uppercase' as const,
                          cursor: (!clientName || !clientPhone) ? 'default' : 'pointer',
                          opacity: submitting ? 0.6 : 1,
                          clipPath: 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))',
                        }}
                      >
                        {submitting ? 'Booking...' : 'Confirm Booking →'}
                      </button>
                    </div>
                  </div>
                )}

                {step === 'success' && (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      border: '2px solid var(--green)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}>
                      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                        <path d="M6 13l5 5 9-9" stroke="#3ecf8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--green)', marginBottom: 8 }}>
                      Booking Confirmed!
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.9 }}>
                      {selectedService?.name} &middot; ${selectedService?.price}<br />
                      {formatDateLabel(selectedDate!)} at {selectedTime}
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(62,207,142,.08)',
                      border: '1px solid rgba(62,207,142,.2)',
                      padding: '6px 14px',
                      fontSize: 10,
                      color: 'var(--green)',
                      letterSpacing: '.06em',
                      marginTop: 16,
                    }}>
                      &#128241; SMS Confirmation Sent
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 32,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--dim)',
          }}>
            <a
              href={`https://portal.goelev8.ai/${tenant.slug}`}
              style={{ color: 'var(--muted)', textDecoration: 'none' }}
            >
              Manage your calendar &rarr; portal.goelev8.ai/{tenant.slug}
            </a>
            <div style={{ marginTop: 8 }}>
              Powered by{' '}
              <a href="https://book.goelev8.ai" style={{ color: brand, textDecoration: 'none' }}>
                GoElev8.AI Booking
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
