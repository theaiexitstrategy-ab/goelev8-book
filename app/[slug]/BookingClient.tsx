/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */
'use client';

import { useCallback, useMemo, useState } from 'react';
import { labelToMinutes, utcToZoned } from '@/lib/calendar';
import { minutesToLabel, slotsForDate as computeSlots, type Schedule } from '@/lib/availability';

type ServiceItem = { name: string; duration: number; price: number; info_note?: string | null };
type Tenant = {
  id: string;
  slug: string;
  business_name: string;
  brand_color: string;
  logo_url: string | null;
  services: ServiceItem[];
  timezone: string;
};

type Props = {
  tenant: Tenant;
  schedule: Schedule;
};

type Step = 'service' | 'calendar' | 'form' | 'success';
type CalendarLinks = { google_url: string; ics_url: string; synced_to_owner: boolean; invite_emailed: boolean };

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Time helpers ────────────────────────────────────────────────

/** "9:30 AM" → "9:30am" (Calendly-style display) */
function shortTime(label: string): string {
  return label.replace(/\s*(AM|PM)$/i, (_, p: string) => p.toLowerCase());
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function tzLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longGeneric' }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value || tz;
  } catch {
    return tz;
  }
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// ─── Color helpers (keep any brand color legible on white) ──────

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 105, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastWithWhite(rgb: [number, number, number]): number {
  return 1.05 / (luminance(rgb) + 0.05);
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function brandPalette(hex: string) {
  const base = hexToRgb(hex);
  // Darken until it reads as text on white (WCAG AA 4.5:1).
  let text: [number, number, number] = [...base];
  for (let i = 0; i < 20 && contrastWithWhite(text) < 4.5; i++) {
    text = [text[0] * 0.9, text[1] * 0.9, text[2] * 0.9];
  }
  const onBrand = contrastWithWhite(base) >= 3 ? '#ffffff' : '#111827';
  const [r, g, b] = base;
  return {
    brand: toHex(base),
    text: toHex(text),
    onBrand,
    tint: `rgba(${r},${g},${b},0.10)`,
    tintStrong: `rgba(${r},${g},${b},0.18)`,
    ring: `rgba(${r},${g},${b},0.35)`,
  };
}

// ─── Icons ───────────────────────────────────────────────────────

const Icon = {
  clock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
  ),
  globe: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
  ),
  tag: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
  ),
  user: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  ),
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
  ),
  chevL: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
  ),
  chevR: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
  ),
  check: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10" /></svg>
  ),
  google: (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z" /><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 41.1 15.4 46 24 46z" /><path fill="#FBBC05" d="M11.7 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.4C2.9 17.1 2 20.5 2 24s.9 6.9 2.4 9.9l7.3-5.7z" /><path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8 6.9 4.4 14.1l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z" /></svg>
  ),
  apple: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-3.9zM14 5.2c.7-.8 1.1-1.9 1-3-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z" /></svg>
  ),
};

// ─── Component ───────────────────────────────────────────────────

export default function BookingClient({ tenant, schedule }: Props) {
  const c = useMemo(() => brandPalette(tenant.brand_color || '#0069ff'), [tenant.brand_color]);
  const services = tenant.services || [];
  const tz = tenant.timezone;

  const [step, setStep] = useState<Step>(services.length > 1 ? 'service' : 'calendar');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(services[0] || null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [calLinks, setCalLinks] = useState<CalendarLinks | null>(null);

  // "Now" in the business's timezone, so past days/slots are hidden correctly.
  const nowLocal = useMemo(() => utcToZoned(new Date(), tz), [tz]);
  const today = nowLocal.date;

  const [currentMonth, setCurrentMonth] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [todayYear, todayMonth] = today.split('-').map(Number);
  const atFirstMonth = currentMonth.year === todayYear && currentMonth.month === todayMonth - 1;

  const duration = selectedService?.duration || 60;

  const slotsForDate = useCallback(
    (date: string) => computeSlots(schedule, date, duration, selectedService?.name || null, nowLocal).map(minutesToLabel),
    [schedule, duration, selectedService, nowLocal]
  );

  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number; dateStr: string; available: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: 0, dateStr: '', available: false, isToday: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        dateStr,
        available: dateStr >= today && slotsForDate(dateStr).length > 0,
        isToday: dateStr === today,
      });
    }
    return cells;
  }, [currentMonth, today, slotsForDate]);

  const timeSlots = useMemo(() => (selectedDate ? slotsForDate(selectedDate) : []), [selectedDate, slotsForDate]);

  const endTime = selectedTime ? minutesToLabel(labelToMinutes(selectedTime) + duration) : null;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim());
  const phoneValid = clientPhone.replace(/\D/g, '').length >= 10;
  const formValid = clientName.trim().length > 1 && emailValid && phoneValid;

  const shiftMonth = (delta: number) =>
    setCurrentMonth((p) => {
      const idx = p.year * 12 + p.month + delta;
      return { year: Math.floor(idx / 12), month: idx % 12 };
    });

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime || !selectedService || !formValid) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: tenant.slug,
          service: selectedService.name,
          duration: selectedService.duration,
          date: selectedDate,
          time: selectedTime,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
          client_email: clientEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Booking failed. Please try again.');
        return;
      }
      setCalLinks(data.calendar || null);
      setStep('success');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setSelectedDate(null);
    setSelectedTime(null);
    setError('');
    setCalLinks(null);
    setStep(services.length > 1 ? 'service' : 'calendar');
  };

  const initials = tenant.business_name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const renderLogo = (size: number) =>
    tenant.logo_url ? (
      <img src={tenant.logo_url} alt={tenant.business_name} className="bk-logo" style={{ maxHeight: size }} />
    ) : (
      <div className="bk-monogram" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</div>
    );

  // ─── Left details panel ────────────────────────────────────────
  const detailsPanel = (
    <aside className="bk-details">
      {(step === 'form' || (step === 'calendar' && services.length > 1)) && (
        <button
          type="button"
          className="bk-back"
          aria-label="Back"
          onClick={() => {
            setError('');
            setStep(step === 'form' ? 'calendar' : 'service');
          }}
        >
          {Icon.back}
        </button>
      )}
      <div className="bk-details-brand">{renderLogo(48)}</div>
      <div className="bk-org">{tenant.business_name}</div>
      <h1 className="bk-event-title">{selectedService?.name || 'Book a time'}</h1>
      <ul className="bk-meta">
        <li>{Icon.clock}<span>{formatDuration(duration)}</span></li>
        {selectedService && selectedService.price > 0 && (
          <li>{Icon.tag}<span>${selectedService.price}</span></li>
        )}
        {step === 'form' && selectedDate && selectedTime && (
          <li className="bk-meta-strong">
            {Icon.calendar}
            <span>{shortTime(selectedTime)} – {shortTime(endTime!)}, {formatDateLong(selectedDate)}</span>
          </li>
        )}
        <li>{Icon.globe}<span>{tzLabel(tz)}</span></li>
      </ul>
      {selectedService?.info_note && <p className="bk-note">{selectedService.info_note}</p>}
    </aside>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bk-brand: ${c.brand};
          --bk-brand-text: ${c.text};
          --bk-on-brand: ${c.onBrand};
          --bk-tint: ${c.tint};
          --bk-tint-strong: ${c.tintStrong};
          --bk-ring: ${c.ring};
          --bk-bg: #f4f5f7;
          --bk-card: #ffffff;
          --bk-ink: #0b1220;
          --bk-body: #374151;
          --bk-muted: #6b7280;
          --bk-faint: #9ca3af;
          --bk-line: #e5e7eb;
          --bk-line-soft: #f0f1f3;
          --bk-danger: #dc2626;
          --bk-success: #16a34a;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: var(--bk-bg); }
        body {
          color: var(--bk-body);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 15px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
        }
        button { font: inherit; cursor: pointer; }
        button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--bk-brand); outline-offset: 2px; }

        .bk-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 48px 16px 32px; }
        .bk-card {
          position: relative;
          width: 100%;
          max-width: 1060px;
          background: var(--bk-card);
          border: 1px solid var(--bk-line);
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 12px 32px -8px rgba(16,24,40,.10);
          overflow: hidden;
          animation: bk-in .35s ease both;
        }
        .bk-card.narrow { max-width: 760px; }
        @keyframes bk-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .bk-fade { animation: bk-in .25s ease both; }
        @media (prefers-reduced-motion: reduce) { .bk-card, .bk-fade, .bk-next { animation: none; } }

        .bk-split { display: grid; grid-template-columns: 340px 1fr; min-height: 560px; }

        /* Details panel */
        .bk-details { position: relative; padding: 32px 28px; border-right: 1px solid var(--bk-line); }
        .bk-details-brand { padding: 0 28px 20px; margin: 0 -28px 20px; border-bottom: 1px solid var(--bk-line); }
        .bk-back {
          position: absolute; top: 28px; right: 24px;
          width: 40px; height: 40px; border-radius: 50%;
          display: grid; place-items: center;
          border: 1px solid var(--bk-line); background: #fff; color: var(--bk-brand-text);
          transition: background .15s, border-color .15s;
        }
        .bk-back:hover { background: var(--bk-tint); border-color: var(--bk-ring); }
        .bk-logo { display: block; max-width: 180px; object-fit: contain; }
        .bk-monogram {
          display: grid; place-items: center; border-radius: 12px;
          background: var(--bk-brand); color: var(--bk-on-brand); font-weight: 700; letter-spacing: .02em;
        }
        .bk-org { font-size: 15px; font-weight: 600; color: var(--bk-muted); margin-bottom: 4px; }
        .bk-event-title { font-size: 26px; line-height: 1.2; font-weight: 700; color: var(--bk-ink); letter-spacing: -.01em; margin-bottom: 20px; }
        .bk-meta { list-style: none; display: flex; flex-direction: column; gap: 14px; }
        .bk-meta li { display: flex; align-items: flex-start; gap: 10px; color: var(--bk-muted); font-weight: 500; font-size: 15px; }
        .bk-meta li svg { flex-shrink: 0; margin-top: 1px; color: var(--bk-faint); }
        .bk-meta li.bk-meta-strong { color: var(--bk-ink); }
        .bk-note { margin-top: 20px; font-size: 14px; color: var(--bk-muted); line-height: 1.6; }

        /* Main panel */
        .bk-main { padding: 32px 32px 28px; min-width: 0; }
        .bk-h2 { font-size: 20px; font-weight: 700; color: var(--bk-ink); margin-bottom: 24px; letter-spacing: -.005em; }
        .bk-picker { display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; }
        .bk-picker.with-times { grid-template-columns: minmax(0, 1fr) 220px; }

        .bk-month { display: flex; align-items: center; justify-content: center; gap: 24px; margin-bottom: 16px; }
        .bk-month-label { font-size: 16px; font-weight: 500; color: var(--bk-ink); min-width: 150px; text-align: center; }
        .bk-nav {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          display: grid; place-items: center;
          background: var(--bk-tint); color: var(--bk-brand-text);
          transition: background .15s;
        }
        .bk-nav:hover:not(:disabled) { background: var(--bk-tint-strong); }
        .bk-nav:disabled { background: transparent; color: #d1d5db; cursor: default; }

        .bk-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 6px; justify-items: center; }
        .bk-dow { font-size: 12px; font-weight: 500; color: var(--bk-muted); letter-spacing: .04em; padding: 8px 0 10px; }
        .bk-day {
          position: relative;
          width: 46px; height: 46px; border-radius: 50%; border: none;
          display: grid; place-items: center;
          font-size: 16px; font-variant-numeric: tabular-nums;
          background: transparent; color: var(--bk-faint);
          cursor: default;
        }
        .bk-day.avail { background: var(--bk-tint); color: var(--bk-brand-text); font-weight: 700; cursor: pointer; transition: background .15s; }
        .bk-day.avail:hover { background: var(--bk-tint-strong); }
        .bk-day.selected, .bk-day.selected:hover { background: var(--bk-brand); color: var(--bk-on-brand); }
        .bk-day.today::after {
          content: ''; position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%);
          width: 4px; height: 4px; border-radius: 50%; background: currentColor;
        }

        .bk-tz { margin-top: 28px; }
        .bk-tz-label { font-size: 15px; font-weight: 700; color: var(--bk-ink); margin-bottom: 6px; }
        .bk-tz-value { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--bk-body); }
        .bk-tz-value svg { width: 16px; height: 16px; color: var(--bk-muted); }

        .bk-times-head { font-size: 15px; color: var(--bk-ink); margin: 6px 0 20px; font-weight: 500; }
        .bk-times { display: flex; flex-direction: column; gap: 10px; max-height: 440px; overflow-y: auto; padding-right: 4px; }
        .bk-times { scrollbar-width: thin; scrollbar-color: #d1d5db transparent; }
        .bk-times::-webkit-scrollbar { width: 6px; }
        .bk-times::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        .bk-slot-row { display: flex; gap: 8px; }
        .bk-slot {
          flex: 1; height: 52px; border-radius: 8px;
          border: 1px solid var(--bk-ring); background: #fff;
          color: var(--bk-brand-text); font-weight: 700; font-size: 15px;
          transition: border-color .15s, box-shadow .15s, background .15s;
        }
        .bk-slot:hover { border-color: var(--bk-brand); box-shadow: inset 0 0 0 1px var(--bk-brand); }
        .bk-slot.chosen { background: #4b5563; border-color: #4b5563; color: #fff; box-shadow: none; cursor: default; }
        .bk-next {
          flex: 1; height: 52px; border-radius: 8px; border: none;
          background: var(--bk-brand); color: var(--bk-on-brand); font-weight: 700; font-size: 15px;
          animation: bk-in .2s ease both;
          transition: filter .15s;
        }
        .bk-next:hover { filter: brightness(.94); }
        .bk-empty { font-size: 14px; color: var(--bk-muted); padding: 12px 0; }

        /* Form */
        .bk-form { max-width: 460px; display: flex; flex-direction: column; gap: 20px; }
        .bk-field label { display: block; font-size: 14px; font-weight: 700; color: var(--bk-ink); margin-bottom: 8px; }
        .bk-field input {
          width: 100%; height: 46px; padding: 0 14px;
          border: 1px solid #d1d5db; border-radius: 8px; background: #fff;
          font: inherit; font-size: 15px; color: var(--bk-ink);
          transition: border-color .15s, box-shadow .15s;
        }
        .bk-field input:hover { border-color: #9ca3af; }
        .bk-field input:focus { outline: none; border-color: var(--bk-brand); box-shadow: 0 0 0 3px var(--bk-ring); }
        .bk-hint { font-size: 13px; color: var(--bk-muted); margin-top: 6px; }
        .bk-error { font-size: 14px; color: var(--bk-danger); background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; }
        .bk-legal { font-size: 13px; color: var(--bk-muted); line-height: 1.6; }
        .bk-primary {
          align-self: flex-start;
          height: 46px; padding: 0 28px; border-radius: 999px; border: none;
          background: var(--bk-brand); color: var(--bk-on-brand); font-weight: 700; font-size: 15px;
          transition: filter .15s, opacity .15s;
        }
        .bk-primary:hover:not(:disabled) { filter: brightness(.94); }
        .bk-primary:disabled { opacity: .45; cursor: not-allowed; }

        /* Service list */
        .bk-intro { text-align: center; padding: 40px 32px 28px; border-bottom: 1px solid var(--bk-line); }
        .bk-intro .bk-logo, .bk-intro .bk-monogram { margin: 0 auto 16px; }
        .bk-intro h1 { font-size: 22px; font-weight: 700; color: var(--bk-ink); margin-bottom: 6px; }
        .bk-intro p { font-size: 15px; color: var(--bk-muted); max-width: 440px; margin: 0 auto; }
        .bk-services { padding: 8px 0; }
        .bk-service {
          width: 100%; text-align: left; background: #fff; border: none;
          display: flex; align-items: center; gap: 18px;
          padding: 22px 32px; border-bottom: 1px solid var(--bk-line-soft);
          transition: background .15s;
        }
        .bk-service:last-child { border-bottom: none; }
        .bk-service:hover { background: #fafafa; }
        .bk-service-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--bk-brand); flex-shrink: 0; }
        .bk-service-body { flex: 1; min-width: 0; display: block; }
        .bk-service-name { display: block; font-size: 17px; font-weight: 700; color: var(--bk-ink); }
        .bk-service-meta { font-size: 14px; color: var(--bk-muted); margin-top: 2px; display: flex; gap: 14px; flex-wrap: wrap; }
        .bk-service-note { display: block; font-size: 13px; color: var(--bk-muted); margin-top: 6px; }
        .bk-service-arrow { color: var(--bk-faint); transition: transform .15s, color .15s; display: grid; }
        .bk-service:hover .bk-service-arrow { color: var(--bk-brand-text); transform: translateX(3px); }

        /* Success */
        .bk-success { padding: 48px 32px 40px; text-align: center; }
        .bk-success > .bk-logo, .bk-success > .bk-monogram { margin: 0 auto 28px; }
        .bk-check {
          width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px;
          display: grid; place-items: center; background: #dcfce7; color: var(--bk-success);
        }
        .bk-success h1 { font-size: 24px; font-weight: 700; color: var(--bk-ink); margin-bottom: 8px; }
        .bk-success-sub { font-size: 15px; color: var(--bk-muted); max-width: 440px; margin: 0 auto; }
        .bk-summary {
          text-align: left; max-width: 460px; margin: 28px auto 0;
          border: 1px solid var(--bk-line); border-radius: 12px; padding: 22px 24px;
        }
        .bk-summary-title { font-size: 17px; font-weight: 700; color: var(--bk-ink); margin-bottom: 14px; }
        .bk-addcal { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 24px; }
        .bk-addcal a {
          display: inline-flex; align-items: center; gap: 8px;
          height: 44px; padding: 0 18px; border-radius: 999px;
          border: 1px solid var(--bk-line); background: #fff;
          color: var(--bk-ink); font-weight: 600; font-size: 14px; text-decoration: none;
          transition: border-color .15s, background .15s;
        }
        .bk-addcal a:hover { border-color: #c7cbd1; background: #fafafa; }
        .bk-link { display: inline-block; background: none; border: none; color: var(--bk-brand-text); font-weight: 600; font-size: 14px; margin-top: 28px; }
        .bk-link:hover { text-decoration: underline; }

        .bk-footer { margin-top: 20px; font-size: 12px; color: var(--bk-faint); }
        .bk-footer a { color: var(--bk-muted); text-decoration: none; font-weight: 600; }
        .bk-footer a:hover { color: var(--bk-ink); }

        @media (max-width: 900px) {
          .bk-picker.with-times { grid-template-columns: minmax(0, 1fr); }
          .bk-times { max-height: none; }
        }
        @media (max-width: 760px) {
          .bk-page { padding: 0 0 24px; }
          .bk-card { border-radius: 0; border-left: none; border-right: none; border-top: none; box-shadow: none; }
          .bk-split { grid-template-columns: minmax(0, 1fr); min-height: 0; }
          .bk-details { border-right: none; border-bottom: 1px solid var(--bk-line); padding: 24px 20px; }
          .bk-details-brand { padding: 0 20px 16px; margin: 0 -20px 16px; }
          .bk-back { top: 18px; right: 16px; }
          .bk-event-title { font-size: 22px; margin-bottom: 14px; }
          .bk-meta { gap: 10px; }
          .bk-main { padding: 24px 16px; }
          .bk-month { gap: 12px; }
          .bk-day { width: 40px; height: 40px; font-size: 15px; }
          .bk-service { padding: 18px 20px; }
          .bk-intro { padding: 32px 20px 24px; }
          .bk-success { padding: 36px 20px 32px; }
        }
      ` }} />

      <div className="bk-page">
        {/* ── Step 1: choose a service ── */}
        {step === 'service' && (
          <div className="bk-card narrow">
            <div className="bk-intro">
              {renderLogo(64)}
              <h1>{tenant.business_name}</h1>
              <p>Welcome! Choose an appointment type below to see available times.</p>
            </div>
            <div className="bk-services">
              {services.map((svc) => (
                <button
                  key={svc.name}
                  type="button"
                  className="bk-service"
                  onClick={() => {
                    setSelectedService(svc);
                    setSelectedTime(null);
                    setStep('calendar');
                  }}
                >
                  <span className="bk-service-dot" />
                  <span className="bk-service-body">
                    <span className="bk-service-name">{svc.name}</span>
                    <span className="bk-service-meta">
                      <span>{formatDuration(svc.duration)}</span>
                      {svc.price > 0 && <span>${svc.price}</span>}
                    </span>
                    {svc.info_note && <span className="bk-service-note">{svc.info_note}</span>}
                  </span>
                  <span className="bk-service-arrow">{Icon.chevR}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2 & 3: calendar / details ── */}
        {(step === 'calendar' || step === 'form') && (
          <div className="bk-card">
            <div className="bk-split">
              {detailsPanel}

              <main className="bk-main">
                {step === 'calendar' && (
                  <div className="bk-fade">
                    <h2 className="bk-h2">Select a Date &amp; Time</h2>
                    <div className={`bk-picker${selectedDate ? ' with-times' : ''}`}>
                      <div>
                        <div className="bk-month">
                          <button type="button" className="bk-nav" aria-label="Previous month" disabled={atFirstMonth} onClick={() => shiftMonth(-1)}>
                            {Icon.chevL}
                          </button>
                          <div className="bk-month-label">{MONTH_NAMES[currentMonth.month]} {currentMonth.year}</div>
                          <button type="button" className="bk-nav" aria-label="Next month" onClick={() => shiftMonth(1)}>
                            {Icon.chevR}
                          </button>
                        </div>
                        <div className="bk-grid">
                          {DAY_LABELS.map((d) => <div key={d} className="bk-dow">{d}</div>)}
                          {calendarDays.map((cell, i) => {
                            if (cell.day === 0) return <div key={`e${i}`} />;
                            const isSelected = selectedDate === cell.dateStr;
                            const cls = ['bk-day', cell.available && 'avail', isSelected && 'selected', cell.isToday && 'today']
                              .filter(Boolean).join(' ');
                            return (
                              <button
                                key={cell.dateStr}
                                type="button"
                                className={cls}
                                disabled={!cell.available}
                                aria-pressed={isSelected}
                                aria-label={formatDateLong(cell.dateStr)}
                                onClick={() => {
                                  setSelectedDate(cell.dateStr);
                                  setSelectedTime(null);
                                }}
                              >
                                {cell.day}
                              </button>
                            );
                          })}
                        </div>
                        <div className="bk-tz">
                          <div className="bk-tz-label">Time zone</div>
                          <div className="bk-tz-value">{Icon.globe}{tzLabel(tz)}</div>
                        </div>
                      </div>

                      {selectedDate && (
                        <div className="bk-fade" key={selectedDate}>
                          <div className="bk-times-head">{formatDateShort(selectedDate)}</div>
                          <div className="bk-times">
                            {timeSlots.length === 0 && <div className="bk-empty">No times left on this day.</div>}
                            {timeSlots.map((time) => {
                              const chosen = selectedTime === time;
                              return (
                                <div key={time} className="bk-slot-row">
                                  <button
                                    type="button"
                                    className={`bk-slot${chosen ? ' chosen' : ''}`}
                                    onClick={() => setSelectedTime(time)}
                                  >
                                    {shortTime(time)}
                                  </button>
                                  {chosen && (
                                    <button type="button" className="bk-next" onClick={() => setStep('form')}>
                                      Next
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === 'form' && (
                  <form className="bk-fade" onSubmit={handleConfirm} noValidate>
                    <h2 className="bk-h2">Enter Details</h2>
                    <div className="bk-form">
                      <div className="bk-field">
                        <label htmlFor="bk-name">Name *</label>
                        <input id="bk-name" autoComplete="name" value={clientName} onChange={(e) => setClientName(e.target.value)} autoFocus />
                      </div>
                      <div className="bk-field">
                        <label htmlFor="bk-email">Email *</label>
                        <input id="bk-email" type="email" autoComplete="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                        <div className="bk-hint">Your calendar invitation will be sent here.</div>
                      </div>
                      <div className="bk-field">
                        <label htmlFor="bk-phone">Phone number *</label>
                        <input id="bk-phone" type="tel" autoComplete="tel" placeholder="(314) 555-0123" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                        <div className="bk-hint">We&rsquo;ll text you a confirmation.</div>
                      </div>
                      {error && <div className="bk-error" role="alert">{error}</div>}
                      <p className="bk-legal">
                        By scheduling, you agree to receive text messages about this appointment. Message &amp; data rates may apply. Reply STOP to opt out.
                      </p>
                      <button type="submit" className="bk-primary" disabled={submitting || !formValid}>
                        {submitting ? 'Scheduling…' : 'Schedule Event'}
                      </button>
                    </div>
                  </form>
                )}
              </main>
            </div>
          </div>
        )}

        {/* ── Step 4: confirmation ── */}
        {step === 'success' && selectedDate && selectedTime && (
          <div className="bk-card narrow">
            <div className="bk-success">
              {renderLogo(48)}
              <div className="bk-check">{Icon.check}</div>
              <h1>You are scheduled</h1>
              <p className="bk-success-sub">
                {calLinks?.invite_emailed
                  ? `A calendar invitation has been sent to ${clientEmail.trim()}.`
                  : 'A confirmation has been texted to you. Add it to your calendar below.'}
              </p>

              <div className="bk-summary">
                <div className="bk-summary-title">{selectedService?.name}</div>
                <ul className="bk-meta">
                  <li>{Icon.user}<span>{tenant.business_name}</span></li>
                  <li className="bk-meta-strong">
                    {Icon.calendar}
                    <span>{shortTime(selectedTime)} – {shortTime(endTime!)}, {formatDateLong(selectedDate)}</span>
                  </li>
                  <li>{Icon.globe}<span>{tzLabel(tz)}</span></li>
                </ul>
              </div>

              {calLinks && (
                <div className="bk-addcal">
                  <a href={calLinks.google_url} target="_blank" rel="noopener noreferrer">
                    {Icon.google} Add to Google Calendar
                  </a>
                  <a href={calLinks.ics_url}>
                    {Icon.apple} Apple / Outlook
                  </a>
                </div>
              )}

              <button type="button" className="bk-link" onClick={resetAll}>Schedule another appointment</button>
            </div>
          </div>
        )}

        <div className="bk-footer">
          Powered by <a href="https://book.goelev8.ai">GoElev8.AI</a>
        </div>
      </div>
    </>
  );
}
