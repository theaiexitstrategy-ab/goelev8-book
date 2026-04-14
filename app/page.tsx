/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ─── constants ─── */
const BOOKED_DAYS = [3, 7, 10, 14, 17, 21, 24, 28];
const AVAIL_DAYS = [5, 6, 8, 9, 12, 13, 15, 16, 18, 19, 20, 22, 23, 25, 26, 27, 29, 30, 31];
const TODAY = 11;
const ALL_TIMES = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
const TAKEN = ['10:00 AM', '12:00 PM', '3:00 PM'];
const TYPE_LABELS: Record<string, string> = {
  fitness: 'Fitness / Training', salon: 'Salon / Beauty', health: 'Health / Wellness',
  consulting: 'Consulting / Coaching', creative: 'Creative / Studio', food: 'Food / Catering',
  events: 'Events / Entertainment', other: 'Something else',
};
const PAY_LABELS: Record<string, string> = { full: 'Full payment at booking', deposit: 'Deposit only', none: 'Pay in person' };
const PCT = [17, 33, 50, 67, 83, 100];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-').substring(0, 30);
}

export default function LandingPage() {
  /* ─── refs ─── */
  const calGridRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  /* ─── wizard state ─── */
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wStep, setWStep] = useState(1);
  const [wBiz, setWBiz] = useState('');
  const [wSlug, setWSlug] = useState('');
  const [wBt, setWBt] = useState('');
  const [wSvc, setWSvc] = useState('');
  const [wColor, setWColor] = useState('#c8a96e');
  const [wLogoSrc, setWLogoSrc] = useState('');
  const [wLogoFile, setWLogoFile] = useState<File | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [wOpen, setWOpen] = useState('8:00 AM');
  const [wClose, setWClose] = useState('6:00 PM');
  const [wStaff, setWStaff] = useState('');
  const [wFn, setWFn] = useState('');
  const [wLn, setWLn] = useState('');
  const [wEmail, setWEmail] = useState('');
  const [wPhone, setWPhone] = useState('');
  const [wPay, setWPay] = useState('');
  const [launched, setLaunched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [wServices, setWServices] = useState<{ name: string; duration: string; price: string }[]>([{ name: '', duration: '60', price: '' }]);

  /* ─── demo calendar state ─── */
  const [demoSelDay, setDemoSelDay] = useState<number | null>(null);
  const [demoSelTime, setDemoSelTime] = useState<string | null>(null);
  const [demoShowTimes, setDemoShowTimes] = useState(false);
  const [demoShowConfirm, setDemoShowConfirm] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState(false);
  const [demoAiThink, setDemoAiThink] = useState(false);

  /* ─── signup form state ─── */
  const [signupSlug, setSignupSlug] = useState('');

  const openWizard = useCallback(() => {
    setWizardOpen(true);
    setWStep(1);
    setLaunched(false);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeWizard = useCallback(() => {
    setWizardOpen(false);
    document.body.style.overflow = '';
  }, []);

  const doAutoSlug = useCallback((biz: string) => {
    setWBiz(biz);
    const s = slugify(biz.replace(/\s+/g, '-'));
    setWSlug(s);
  }, []);

  /* ─── slug availability check ─── */
  useEffect(() => {
    if (!wSlug || wSlug.length < 3) { setSlugStatus('idle'); return; }
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check-slug?slug=${encodeURIComponent(wSlug)}`);
        const data = await res.json();
        setSlugStatus(data.available ? 'available' : 'taken');
      } catch { setSlugStatus('idle'); }
    }, 400);
    return () => clearTimeout(t);
  }, [wSlug]);

  /* ─── cursor tracking ─── */
  useEffect(() => {
    let mx = 0, my = 0, rx = 0, ry = 0;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      if (curRef.current) { curRef.current.style.left = mx + 'px'; curRef.current.style.top = my + 'px'; }
    };
    document.addEventListener('mousemove', onMove);
    let raf: number;
    const animRing = () => {
      rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
      if (ringRef.current) { ringRef.current.style.left = rx + 'px'; ringRef.current.style.top = ry + 'px'; }
      raf = requestAnimationFrame(animRing);
    };
    raf = requestAnimationFrame(animRing);

    const hovers = document.querySelectorAll('button,a,input,.svc-item,.dc,.ts');
    const addH = () => { curRef.current?.classList.add('h'); ringRef.current?.classList.add('h'); };
    const rmH = () => { curRef.current?.classList.remove('h'); ringRef.current?.classList.remove('h'); };
    hovers.forEach(el => { el.addEventListener('mouseenter', addH); el.addEventListener('mouseleave', rmH); });

    return () => {
      document.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
      hovers.forEach(el => { el.removeEventListener('mouseenter', addH); el.removeEventListener('mouseleave', rmH); });
    };
  }, []);

  /* ─── booking widget animation ─── */
  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>(r => { const t = setTimeout(r, ms); if (cancelled) clearTimeout(t); });

    const fakeMouseEl = document.getElementById('fakeMouse');
    const clickRippleEl = document.getElementById('clickRipple');
    if (!fakeMouseEl || !clickRippleEl) return;

    let fmX = 0, fmY = 0, fmTargetX = 0, fmTargetY = 0;
    let fmRaf: number | null = null;

    const fmAnimate = () => {
      fmX += (fmTargetX - fmX) * 0.09;
      fmY += (fmTargetY - fmY) * 0.09;
      fakeMouseEl.style.transform = `translate(${fmX}px,${fmY}px)`;
      fmRaf = requestAnimationFrame(fmAnimate);
    };

    const getCenter = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    const moveTo = (el: Element, dur = 700) => new Promise<void>(res => {
      const c = getCenter(el);
      fmTargetX = c.x - 9; fmTargetY = c.y - 10;
      setTimeout(res, dur);
    });

    const clickAnim = (el: HTMLElement) => new Promise<void>(res => {
      const c = getCenter(el);
      clickRippleEl.style.transition = 'none';
      clickRippleEl.style.left = c.x + 'px';
      clickRippleEl.style.top = c.y + 'px';
      clickRippleEl.style.opacity = '1';
      clickRippleEl.style.transform = 'translate(-50%,-50%) scale(0.2)';
      requestAnimationFrame(() => {
        clickRippleEl.style.transition = 'transform 0.45s ease-out, opacity 0.45s ease-out';
        clickRippleEl.style.transform = 'translate(-50%,-50%) scale(2)';
        clickRippleEl.style.opacity = '0';
      });
      el.style.transform = 'scale(0.94)';
      el.style.transition = 'transform 0.12s ease';
      setTimeout(() => { el.style.transform = ''; }, 130);
      setTimeout(res, 320);
    });

    const run = async () => {
      while (!cancelled) {
        // Reset state
        setDemoSelDay(null); setDemoSelTime(null);
        setDemoShowTimes(false); setDemoShowConfirm(false);
        setDemoSuccess(false); setDemoAiThink(false);

        await wait(1800);
        if (cancelled) return;

        const shell = document.querySelector('.booking-shell');
        if (!shell) return;
        const shellR = shell.getBoundingClientRect();
        fmX = shellR.left + 60; fmY = shellR.top + 40;
        fmTargetX = fmX; fmTargetY = fmY;
        fakeMouseEl.style.opacity = '1';
        if (!fmRaf) fmAnimate();

        await wait(400);
        if (cancelled) return;

        // Browse services
        const svc1 = document.getElementById('svc1');
        const svc2 = document.getElementById('svc2');
        const svc0 = document.getElementById('svc0');
        if (svc1) { await moveTo(svc1, 600); await wait(300); }
        if (cancelled) return;
        if (svc2) { await moveTo(svc2, 500); await wait(300); }
        if (cancelled) return;
        if (svc0) { await moveTo(svc0, 600); await wait(200); await clickAnim(svc0); }
        if (cancelled) return;

        // AI thinking
        await wait(300);
        setDemoAiThink(true);
        await wait(1300);
        setDemoAiThink(false);
        if (cancelled) return;

        // Click day 20
        const day20 = document.getElementById('d20');
        if (day20) {
          await moveTo(day20, 700);
          await wait(200);
          await clickAnim(day20);
          setDemoSelDay(20);
          setDemoShowTimes(true);
        }
        if (cancelled) return;

        await wait(600);

        // Click 9:00 AM
        setDemoSelTime(null);
        await wait(100);
        const slot = document.getElementById('t9_00_AM');
        if (slot) {
          await moveTo(slot, 650);
          await wait(200);
          await clickAnim(slot);
          setDemoSelTime('9:00 AM');
          setDemoShowConfirm(true);
        }
        if (cancelled) return;

        await wait(700);

        // Click confirm
        const confirmBtn = document.getElementById('confirmBtn');
        if (confirmBtn) {
          await moveTo(confirmBtn, 700);
          await wait(300);
          await clickAnim(confirmBtn);
        }
        if (cancelled) return;

        fakeMouseEl.style.opacity = '0';
        await wait(300);
        setDemoSuccess(true);
        await wait(3700);
        if (cancelled) return;
        setDemoSuccess(false);
        await wait(500);
        setDemoSelDay(null); setDemoSelTime(null);
        setDemoShowTimes(false); setDemoShowConfirm(false);
        await wait(1800);
      }
    };

    const timeout = setTimeout(run, 100);
    return () => { cancelled = true; clearTimeout(timeout); if (fmRaf) cancelAnimationFrame(fmRaf); };
  }, []);

  /* ─── wizard launch handler ─── */
  const handleLaunch = async () => {
    if (!wEmail || !wFn) {
      alert('Please fill in your name and email before launching.');
      setWStep(5);
      return;
    }
    try {
      // Upload logo if one was selected
      let logoUrl: string | null = null;
      if (wLogoFile) {
        const formData = new FormData();
        formData.append('file', wLogoFile);
        const logoRes = await fetch('/api/upload-logo', { method: 'POST', body: formData });
        if (logoRes.ok) {
          const logoData = await logoRes.json();
          logoUrl = logoData.url;
        }
      }

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: wSlug,
          business_name: wBiz,
          owner_email: wEmail,
          owner_phone: wPhone,
          brand_color: wColor,
          logo_url: logoUrl,
          services: wServices.filter(s => s.name.trim()).map(s => ({
            name: s.name.trim(),
            duration: parseInt(s.duration) || 60,
            price: parseInt(s.price) || 0,
          })),
          availability: {
            days: selectedDays.length ? selectedDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            open: wOpen,
            close: wClose,
          },
          staff_count: wStaff || '1',
          payment_preference: wPay || 'none',
          first_name: wFn,
          last_name: wLn,
          business_type: wBt,
        }),
      });
      if (res.ok) {
        setLaunched(true);
      } else {
        const data = await res.json();
        alert(data.error || 'Something went wrong.');
      }
    } catch {
      alert('Network error. Please try again.');
    }
  };

  /* ─── render ─── */
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      {/* Custom cursor */}
      <div id="cur" ref={curRef} />
      <div id="ring" ref={ringRef} />

      {/* Fake mouse for animation */}
      <div id="fakeMouse" style={{ position: 'fixed', pointerEvents: 'none', zIndex: 99999, opacity: 0, transition: 'opacity 0.4s', willChange: 'transform', top: 0, left: 0, transform: 'translate(0,0)' }}>
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none"><path d="M1 1L1 16.5L4.5 13L7 19.5L9.5 18.5L7 12L11.5 12L1 1Z" fill="#f0ede8" stroke="#080808" strokeWidth="1.2" strokeLinejoin="round" /></svg>
      </div>
      <div id="clickRipple" style={{ position: 'fixed', pointerEvents: 'none', zIndex: 99998, width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--gold)', opacity: 0, transform: 'translate(-50%,-50%) scale(0.2)', top: 0, left: 0 }} />

      {/* NAV */}
      <nav>
        <a href="/" className="logo">
          <div className="logo-text">GoElev8.AI <span>Booking</span></div>
        </a>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="https://portal.goelev8.ai">Portal Login</a></li>
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="https://portal.goelev8.ai" className="nav-signin">Sign In</a>
          <button className="nav-cta" onClick={openWizard}>Claim Your Link</button>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="orb o1" />
        <div className="orb o2" />

        {/* LEFT */}
        <div className="hero-left">
          <div className="hero-badge">AI-Powered Scheduling &middot; Live at book.goelev8.ai</div>
          <h1 className="hero-h1">
            Your Booking<br />Link. <em>Powered</em><br />
            <em>by AI.</em><br />
            <span className="dim">Built Different.</span>
          </h1>
          <p className="hero-sub">
            We connect an AI assistant directly to your booking calendar.
            <strong> You share the link. The assistant handles the rest</strong> &mdash;
            answering questions, qualifying clients, collecting payment, sending confirmations,
            and filling your schedule while you focus on the work that actually pays.
          </p>

          {/* HOW IT WORKS */}
          <div className="how-steps">
            <div className="how-step">
              <div className="how-num">01</div>
              <div className="how-text">
                <div className="how-title">You get your link</div>
                <div className="how-desc">book.goelev8.ai/yourbusiness goes live in under 2 minutes. Your services, availability, and pricing &mdash; all set.</div>
              </div>
            </div>
            <div className="how-step">
              <div className="how-num">02</div>
              <div className="how-text">
                <div className="how-title">Share it anywhere</div>
                <div className="how-desc">IG bio, Google Business, a text message, a flyer. One link. The AI assistant is always on, 24/7.</div>
              </div>
            </div>
            <div className="how-step">
              <div className="how-num">03</div>
              <div className="how-text">
                <div className="how-title">AI handles the rest</div>
                <div className="how-desc">Books appointments, sends SMS reminders, collects deposits, fills no-show slots &mdash; all without you lifting a finger.</div>
              </div>
            </div>
          </div>

          <div className="hero-btns">
            <button className="btn-p" onClick={openWizard}>Get Your Free Link &rarr;</button>
            <button className="btn-g" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>See Features</button>
          </div>
        </div>

        {/* RIGHT — ANIMATED BOOKING WIDGET */}
        <div className="hero-right">
          <div className="booking-shell" style={{ position: 'relative' }}>
            <div className="shell-bar">
              <div className="shell-dots"><div className="sd sd1" /><div className="sd sd2" /><div className="sd sd3" /></div>
              <div className="shell-url">book.goelev8.ai/<span>flexfacility</span></div>
              <div className="shell-live">Live</div>
            </div>

            <div className="booking-body">
              {/* Sidebar */}
              <div className="bk-sidebar">
                <div className="biz-info">
                  <div className="biz-name">The Flex Facility</div>
                  <div className="biz-url">book.goelev8.ai/flexfacility</div>
                  <div className="ai-pill">AI-Powered</div>
                </div>
                <div className="svc-label">Select a Service</div>
                <div className="svc-item active" id="svc0">
                  <div className="svc-name">1-on-1 Training <span className="price">$75</span></div>
                  <div className="svc-meta">60 min &middot; Coach Kenny</div>
                </div>
                <div className="svc-item" id="svc1">
                  <div className="svc-name">Group HIIT <span className="price">$25</span></div>
                  <div className="svc-meta">45 min &middot; Any staff</div>
                </div>
                <div className="svc-item" id="svc2">
                  <div className="svc-name">NIL Assessment <span className="price">$120</span></div>
                  <div className="svc-meta">90 min &middot; Coach Kenny</div>
                </div>
              </div>

              {/* Calendar */}
              <div className="bk-cal" style={{ position: 'relative' }}>
                <div className="cal-hdr">
                  <div className="cal-month">May 2026</div>
                  <div className="cal-nav-btns"><div className="cnb">&#9665;</div><div className="cnb">&#9655;</div></div>
                </div>
                <div className="day-labels">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="dl">{d}</div>)}
                </div>
                <div className="cal-grid" ref={calGridRef}>
                  {/* May 2026 starts Friday (offset 5) */}
                  {Array.from({ length: 5 }).map((_, i) => <div key={`e${i}`} className="dc" />)}
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                    let cls = 'dc';
                    if (d < TODAY) cls += ' past';
                    else if (BOOKED_DAYS.includes(d)) cls += ' booked';
                    else if (d === TODAY) cls += ' today avail';
                    else cls += ' avail';
                    if (demoSelDay === d) cls += ' selected';
                    const showDot = cls.includes('avail') && !cls.includes('booked') && demoSelDay !== d;
                    return (
                      <div key={d} className={cls} id={`d${d}`}>
                        {d}
                        {showDot && <div className="avdot" />}
                      </div>
                    );
                  })}
                </div>

                <div className={`ai-thinking${demoAiThink ? ' show' : ''}`}>
                  <div className="ai-dot" /><div className="ai-dot" /><div className="ai-dot" />
                  AI finding best times&hellip;
                </div>

                <div className={`time-section${demoShowTimes ? ' show' : ''}`}>
                  <div className="ts-label">Available Times &mdash; <span>May 20, 2026</span></div>
                  <div className="time-grid">
                    {ALL_TIMES.map(t => {
                      const taken = TAKEN.includes(t);
                      const sel = demoSelTime === t;
                      const id = 't' + t.replace(/[: ]/g, '_');
                      return (
                        <div key={t} id={id} className={`ts${taken ? ' taken' : ''}${sel ? ' sel' : ''}`}>
                          {t}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={`confirm-row${demoShowConfirm ? ' show' : ''}`}>
                  <button className="confirm-btn" id="confirmBtn">
                    {demoSelTime ? `Confirm — May 20 @ ${demoSelTime} →` : 'Confirm Booking →'}
                  </button>
                </div>

                {/* Success overlay */}
                <div className={`success-overlay${demoSuccess ? ' show' : ''}`}>
                  <div className="success-icon" style={demoSuccess ? { transform: 'scale(1)', transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)' } : { transform: 'scale(0)' }}>
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M6 13l5 5 9-9" stroke="#3ecf8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div className="success-title">Booking Confirmed!</div>
                  <div className="success-detail">May 20, 2026 &middot; 9:00 AM<br />1-on-1 Training &middot; $75 &middot; Coach Kenny</div>
                  <div className="success-sms">&#128241; SMS Confirmation Sent</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div className="ticker-wrap">
        <div className="ticker">
          {[...Array(2)].map((_, rep) => (
            <span key={rep}>
              {['AI Scheduling', 'SMS Reminders', 'Stripe Payments', 'No-Show Protection', 'Client Portal', 'Waitlist AI', 'Multi-Staff', 'book.goelev8.ai'].map(t => (
                <span key={`${rep}-${t}`} className="ti">{t} <span className="dot">&bull;</span></span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div className="features" id="features">
        <div className="sec-label">What&apos;s Included</div>
        <h2 className="sec-title">Everything the big names<br />charge extra for. Built in.</h2>
        <div className="feat-grid">
          {[
            { icon: '🤖', title: 'AI Smart Scheduling', desc: 'Learns your patterns, auto-blocks prep time, fills your calendar without back-and-forth.' },
            { icon: '💬', title: 'SMS Auto-Reminders', desc: 'Two-way Twilio SMS built in. Clients confirm, cancel, or reschedule by text. No-shows drop 73%.' },
            { icon: '💳', title: 'Stripe Checkout', desc: 'Collect deposits or full payment at booking. Set per-service rules. No middleman markup.' },
            { icon: '🔗', title: 'Your Branded URL', desc: 'book.goelev8.ai/yourbusiness — your logo, colors, custom domain redirect available.' },
            { icon: '📊', title: 'Portal Dashboard', desc: 'Every booking flows into portal.goelev8.ai/yourbusiness. One command center.' },
            { icon: '⚡', title: 'Waitlist AI Auto-Fill', desc: 'When a slot opens, AI texts the waitlist and fills the gap in minutes.' },
          ].map(f => (
            <div key={f.title} className="feat">
              <div className="feat-icon">{f.icon}</div>
              <div className="feat-title">{f.title}</div>
              <div className="feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING */}
      <div className="pricing" id="pricing">
        <div className="pricing-inner">
          <div className="sec-label">Simple Pricing</div>
          <h2 className="sec-title">A utility bill, not<br />a subscription trap.</h2>
          <div className="price-grid">
            <div className="pc">
              <div className="plan-tag">Starter</div>
              <div className="plan-price"><sup>$</sup>0</div>
              <div className="plan-per">free forever</div>
              <ul className="plan-feats">
                <li>1 booking page</li><li>Unlimited appointments</li>
                <li>20 free SMS credits</li><li>Stripe payments</li>
              </ul>
              <button className="plan-btn" onClick={openWizard}>Start Free &rarr;</button>
            </div>
            <div className="pc feat-pc">
              <div className="feat-badge">Most Popular</div>
              <div className="plan-tag">Pro</div>
              <div className="plan-price"><sup>$</sup>99</div>
              <div className="plan-per">per month</div>
              <ul className="plan-feats">
                <li>Everything in Starter</li><li>AI scheduling engine</li>
                <li>Unlimited SMS reminders</li><li>Waitlist AI auto-fill</li>
                <li>Full client portal</li><li>Multi-staff support</li>
              </ul>
              <button className="plan-btn" onClick={openWizard}>Get Pro &rarr;</button>
            </div>
            <div className="pc">
              <div className="plan-tag">Business</div>
              <div className="plan-price"><sup>$</sup>149</div>
              <div className="plan-per">per month</div>
              <ul className="plan-feats">
                <li>Everything in Pro</li><li>Multiple locations</li>
                <li>White-label option</li><li>API access</li>
                <li>Priority onboarding</li>
              </ul>
              <button className="plan-btn">Contact Sales &rarr;</button>
            </div>
          </div>
        </div>
      </div>

      {/* SIGNUP SECTION */}
      <div className="signup" id="signup">
        <div className="signup-inner">
          <div className="sec-label">Claim Your Link</div>
          <h2 className="sec-title" style={{ marginBottom: 14 }}>Your booking page<br />is waiting.</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.9 }}>Setup in under 2 minutes. No credit card required.</p>
          <div className="sform">
            <div className="frow">
              <div className="ff"><div className="flabel">First Name</div><input className="finput" type="text" placeholder="Aaron" /></div>
              <div className="ff"><div className="flabel">Last Name</div><input className="finput" type="text" placeholder="Bryant" /></div>
            </div>
            <div className="ff">
              <div className="flabel">Business Name</div>
              <input className="finput" type="text" placeholder="The Flex Facility" onChange={e => {
                const s = slugify(e.target.value.replace(/\s+/g, '-'));
                setSignupSlug(s);
              }} />
            </div>
            <div className="ff">
              <div className="flabel">Your Booking Link</div>
              <div className="url-wrap">
                <div className="url-pre">book.goelev8.ai/</div>
                <input className="url-in" type="text" placeholder="yourcompany" value={signupSlug} onChange={e => setSignupSlug(slugify(e.target.value))} />
              </div>
            </div>
            <div className="ff"><div className="flabel">Email</div><input className="finput" type="email" placeholder="you@yourbusiness.com" /></div>
            <div className="ff"><div className="flabel">Phone</div><input className="finput" type="tel" placeholder="+1 (314) 000-0000" /></div>
            <button className="fsub" onClick={openWizard}>Claim book.goelev8.ai/<span id="slug-preview">{signupSlug || 'yourcompany'}</span> &rarr;</button>
            <div className="fine">By signing up you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.<br />Your portal activates instantly. Free plan &middot; No credit card required.</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="fl">&copy; 2026 <a href="https://goelev8.ai">GoElev8.ai</a> &middot; Aaron Bryant &middot; All rights reserved.</div>
        <div className="fr">
          <a href="https://portal.goelev8.ai">Portal Login</a>
          <a href="#">Terms</a><a href="#">Privacy</a><a href="#">Contact</a>
        </div>
      </footer>

      {/* ═══ WIZARD MODAL ═══ */}
      {wizardOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(4,4,4,.96)', backdropFilter: 'blur(16px)', overflowY: 'auto' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px 80px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: '#c8a96e', letterSpacing: '.06em' }}>GoElev8.AI Booking</div>
              <button onClick={closeWizard} style={{ background: 'transparent', border: '1px solid #222', color: '#6b6560', width: 32, height: 32, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#c8a96e' }}>Step {wStep} of 6</span>
                <span style={{ fontSize: 10, color: '#6b6560' }}>{PCT[wStep - 1]}%</span>
              </div>
              <div style={{ height: 2, background: '#222', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: '#c8a96e', transition: 'width .5s ease', width: PCT[wStep - 1] + '%' }} />
              </div>
            </div>

            {/* Step 1 */}
            {wStep === 1 && (
              <div className="ws">
                <div className="ws-tag">Let&apos;s build your page</div>
                <h2 className="ws-h">Your AI booking<br />page starts here.</h2>
                <p className="ws-p">Answer a few quick questions and your page at <strong>book.goelev8.ai/yourbusiness</strong> goes live with a 24/7 AI assistant handling bookings while you focus on the work.</p>
                <div className="wf">
                  <div className="wl">Business Name <span style={{ color: '#e05252' }}>*</span></div>
                  <input className="wi" value={wBiz} onChange={e => doAutoSlug(e.target.value)} placeholder="e.g. The Flex Facility" />
                </div>
                <div className="wf">
                  <div className="wl">Your booking link</div>
                  <div style={{ display: 'flex', border: '1px solid #222', background: '#080808', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 14px', background: '#161616', borderRight: '1px solid #222', fontSize: 11, color: '#2a2825', whiteSpace: 'nowrap', flexShrink: 0 }}>book.goelev8.ai/</div>
                    <input className="wi" style={{ border: 'none', background: 'transparent', color: '#c8a96e', flex: 1, margin: 0, padding: '12px 14px' }} value={wSlug} onChange={e => setWSlug(slugify(e.target.value))} placeholder="yourbusiness" />
                  </div>
                  <div style={{ fontSize: 10, color: '#6b6560', marginTop: 6 }}>
                    {slugStatus === 'checking' && 'Checking availability...'}
                    {slugStatus === 'available' && <span style={{ color: '#3ecf8e' }}>&#10003; book.goelev8.ai/{wSlug} is available!</span>}
                    {slugStatus === 'taken' && <span style={{ color: '#e05252' }}>&#10007; This link is already taken.</span>}
                    {slugStatus === 'idle' && <>Your live link: <strong style={{ color: '#c8a96e' }}>book.goelev8.ai/{wSlug || 'yourbusiness'}</strong></>}
                  </div>
                </div>
                <button className="wn" onClick={() => setWStep(2)}>Looks good &mdash; Next</button>
              </div>
            )}

            {/* Step 2 */}
            {wStep === 2 && (
              <div className="ws">
                <div className="ws-tag">What you do</div>
                <h2 className="ws-h">What kind of<br />business are you?</h2>
                <p className="ws-p">Pick the one that fits best &mdash; this helps us set up your calendar and AI assistant the right way from day one.</p>
                <div className="wchips">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <div key={k} className={`wc${wBt === k ? ' on' : ''}`} onClick={() => setWBt(k)}>{v}</div>
                  ))}
                </div>
                <div className="wf" style={{ marginTop: 24 }}>
                  <div className="wl">Your Services <span style={{ color: '#e05252' }}>*</span></div>
                  <p style={{ fontSize: 11, color: '#6b6560', marginBottom: 10, lineHeight: 1.7 }}>Add at least one service so clients can book with you.</p>
                  {wServices.map((svc, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                      <div style={{ flex: 2 }}>
                        {i === 0 && <div style={{ fontSize: 9, color: '#6b6560', marginBottom: 4, letterSpacing: '.08em', textTransform: 'uppercase' as const }}>Service Name</div>}
                        <input className="wi" style={{ margin: 0 }} placeholder="e.g. 1-on-1 Training" value={svc.name} onChange={e => {
                          const n = [...wServices]; n[i] = { ...n[i], name: e.target.value }; setWServices(n);
                        }} />
                      </div>
                      <div style={{ flex: 0, minWidth: 70 }}>
                        {i === 0 && <div style={{ fontSize: 9, color: '#6b6560', marginBottom: 4, letterSpacing: '.08em', textTransform: 'uppercase' as const }}>Min</div>}
                        <input className="wi" style={{ margin: 0, textAlign: 'center' }} placeholder="60" value={svc.duration} onChange={e => {
                          const n = [...wServices]; n[i] = { ...n[i], duration: e.target.value }; setWServices(n);
                        }} />
                      </div>
                      <div style={{ flex: 0, minWidth: 80 }}>
                        {i === 0 && <div style={{ fontSize: 9, color: '#6b6560', marginBottom: 4, letterSpacing: '.08em', textTransform: 'uppercase' as const }}>Price $</div>}
                        <input className="wi" style={{ margin: 0, textAlign: 'center' }} placeholder="75" value={svc.price} onChange={e => {
                          const n = [...wServices]; n[i] = { ...n[i], price: e.target.value }; setWServices(n);
                        }} />
                      </div>
                      {wServices.length > 1 && (
                        <button onClick={() => setWServices(wServices.filter((_, j) => j !== i))} style={{ background: 'transparent', border: '1px solid #222', color: '#e05252', width: 36, height: 36, cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>&times;</button>
                      )}
                    </div>
                  ))}
                  {wServices.length < 6 && (
                    <button onClick={() => setWServices([...wServices, { name: '', duration: '60', price: '' }])} style={{ background: 'transparent', border: '1px dashed #222', color: '#6b6560', padding: '8px 14px', fontSize: 11, cursor: 'pointer', width: '100%', marginTop: 4 }}>+ Add another service</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button className="wb" onClick={() => setWStep(1)}>Back</button>
                  <button className="wn" style={{ flex: 1, margin: 0 }} onClick={() => setWStep(3)}>Next</button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {wStep === 3 && (
              <div className="ws">
                <div className="ws-tag">Your brand</div>
                <h2 className="ws-h">Let&apos;s make it<br /><em style={{ fontFamily: "'Instrument Serif',serif", color: '#c8a96e', fontStyle: 'italic' }}>look like you.</em></h2>
                <p className="ws-p">Your booking page will match your brand &mdash; logo, colors, your vibe.</p>
                <div className="wf">
                  <div className="wl">Upload your logo</div>
                  <div style={{ border: '1px dashed #222', background: '#161616', padding: 28, textAlign: 'center', position: 'relative', cursor: 'pointer' }}>
                    <input type="file" accept="image/*" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setWLogoFile(file);
                      const r = new FileReader();
                      r.onload = ev => setWLogoSrc(ev.target?.result as string);
                      r.readAsDataURL(file);
                    }} />
                    {!wLogoSrc ? (
                      <div>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>🖼️</div>
                        <div style={{ fontSize: 12, color: '#6b6560' }}>Drop your logo or <span style={{ color: '#c8a96e', textDecoration: 'underline' }}>click to browse</span></div>
                      </div>
                    ) : (
                      <img src={wLogoSrc} alt="" style={{ maxHeight: 70, maxWidth: 180 }} />
                    )}
                  </div>
                </div>
                <div className="wf" style={{ marginTop: 20 }}>
                  <div className="wl">Pick your primary brand color</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
                    {['#c8a96e', '#3ecf8e', '#4f88f6', '#e05252', '#b06fd8', '#f07840', '#1a1a2e', '#f0ede8'].map(c => (
                      <div key={c} onClick={() => setWColor(c)} style={{
                        width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
                        border: wColor === c ? '2px solid #f0ede8' : '2px solid transparent',
                        transform: wColor === c ? 'scale(1.1)' : 'none', transition: 'all .2s',
                      }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: wColor, flexShrink: 0, border: '2px solid #333' }} />
                    <input className="wi" style={{ margin: 0, fontSize: 12 }} value={wColor} onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setWColor(e.target.value); else setWColor(e.target.value); }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button className="wb" onClick={() => setWStep(2)}>Back</button>
                  <button className="wn" style={{ flex: 1, margin: 0 }} onClick={() => setWStep(4)}>Next</button>
                </div>
              </div>
            )}

            {/* Step 4 */}
            {wStep === 4 && (
              <div className="ws">
                <div className="ws-tag">Availability</div>
                <h2 className="ws-h">When are you<br />open for business?</h2>
                <p className="ws-p">Your AI assistant only offers the time slots you set here.</p>
                <div className="wf">
                  <div className="wl">Available days</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      <div key={d} className={`wc${selectedDays.includes(d) ? ' on' : ''}`} onClick={() => {
                        setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
                      }}>{d}</div>
                    ))}
                  </div>
                </div>
                <div className="wf" style={{ marginTop: 20 }}>
                  <div className="wl">Typical hours</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    <select className="wi" style={{ flex: 1, padding: '10px 12px' }} value={wOpen} onChange={e => setWOpen(e.target.value)}>
                      {['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <span style={{ color: '#6b6560', fontSize: 11 }}>to</span>
                    <select className="wi" style={{ flex: 1, padding: '10px 12px' }} value={wClose} onChange={e => setWClose(e.target.value)}>
                      {['3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="wf" style={{ marginTop: 20 }}>
                  <div className="wl">How many people take bookings?</div>
                  <div className="wchips" style={{ marginTop: 8 }}>
                    {[['1', 'Just me'], ['2-5', '2\u20135 people'], ['6+', '6 or more']].map(([v, l]) => (
                      <div key={v} className={`wc${wStaff === v ? ' on' : ''}`} onClick={() => setWStaff(v)}>{l}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button className="wb" onClick={() => setWStep(3)}>Back</button>
                  <button className="wn" style={{ flex: 1, margin: 0 }} onClick={() => setWStep(5)}>Next</button>
                </div>
              </div>
            )}

            {/* Step 5 */}
            {wStep === 5 && (
              <div className="ws">
                <div className="ws-tag">Your contact info</div>
                <h2 className="ws-h">Almost there.<br />Last few things.</h2>
                <p className="ws-p">We&apos;ll send booking alerts to your email and activate the AI-powered SMS reminder system.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="wf" style={{ flex: 1 }}><div className="wl">First Name <span style={{ color: '#e05252' }}>*</span></div><input className="wi" value={wFn} onChange={e => setWFn(e.target.value)} placeholder="Aaron" /></div>
                  <div className="wf" style={{ flex: 1 }}><div className="wl">Last Name <span style={{ color: '#e05252' }}>*</span></div><input className="wi" value={wLn} onChange={e => setWLn(e.target.value)} placeholder="Bryant" /></div>
                </div>
                <div className="wf"><div className="wl">Email <span style={{ color: '#e05252' }}>*</span></div><input className="wi" value={wEmail} onChange={e => setWEmail(e.target.value)} type="email" placeholder="you@yourbusiness.com" /></div>
                <div className="wf">
                  <div className="wl">Business Phone <span style={{ color: '#e05252' }}>*</span></div>
                  <input className="wi" value={wPhone} onChange={e => setWPhone(e.target.value)} type="tel" placeholder="+1 (314) 000-0000" />
                  <div style={{ fontSize: 10, color: '#6b6560', marginTop: 5 }}>Your clients get AI-powered SMS reminders from this number.</div>
                </div>
                <div className="wf">
                  <div className="wl">Collect payment at booking?</div>
                  <div className="wchips" style={{ marginTop: 8 }}>
                    {[['full', 'Yes \u2014 full payment'], ['deposit', 'Deposit only'], ['none', 'No \u2014 pay in person']].map(([v, l]) => (
                      <div key={v} className={`wc${wPay === v ? ' on' : ''}`} onClick={() => setWPay(v)}>{l}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button className="wb" onClick={() => setWStep(4)}>Back</button>
                  <button className="wn" style={{ flex: 1, margin: 0 }} onClick={() => setWStep(6)}>Review &amp; Launch</button>
                </div>
              </div>
            )}

            {/* Step 6 */}
            {wStep === 6 && !launched && (
              <div className="ws">
                <div className="ws-tag">You&apos;re ready</div>
                <h2 className="ws-h">Here&apos;s what you&apos;re<br />about to launch:</h2>

                <div style={{ border: '1px solid #222', background: '#161616', padding: 24, marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid #222' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 4, background: wColor, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏢</div>
                    <div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>{wBiz || 'Your Business'}</div>
                      <div style={{ fontSize: 11, color: '#c8a96e', marginTop: 2 }}>book.goelev8.ai/{wSlug || 'yourbusiness'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 12 }}>
                    <div><div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b6560', marginBottom: 4 }}>Business Type</div><div>{TYPE_LABELS[wBt] || '\u2014'}</div></div>
                    <div><div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b6560', marginBottom: 4 }}>Availability</div><div>{selectedDays.length ? `${selectedDays.join(', ')} \u00B7 ${wOpen} \u2013 ${wClose}` : '\u2014'}</div></div>
                    <div><div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b6560', marginBottom: 4 }}>Team</div><div>{wStaff === '1' ? 'Just you' : wStaff === '2-5' ? '2\u20135 people' : wStaff === '6+' ? '6+ people' : '\u2014'}</div></div>
                    <div><div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b6560', marginBottom: 4 }}>Payments</div><div>{PAY_LABELS[wPay] || '\u2014'}</div></div>
                  </div>
                </div>

                <div style={{ border: '1px solid #222', marginBottom: 24 }}>
                  {['Branded booking page at your custom link', 'AI assistant handles scheduling 24/7', '20 free SMS reminders to start', `Portal dashboard at portal.goelev8.ai/${wSlug || 'yourbusiness'}`, 'Stripe payment collection (if selected)'].map(item => (
                    <div key={item} style={{ padding: '10px 14px', borderBottom: '1px solid #222', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: '#3ecf8e' }}>&#10003;</span> {item}
                    </div>
                  ))}
                </div>

                <div style={{ background: 'rgba(200,169,110,.06)', border: '1px solid rgba(200,169,110,.15)', padding: '14px 18px', marginBottom: 24, fontSize: 12, color: '#6b6560', lineHeight: 1.8 }}>
                  💡 <strong style={{ color: '#f0ede8' }}>No credit card required.</strong> Your free plan goes live instantly. Upgrade to Pro ($99/mo) anytime from your portal.
                </div>

                <button className="wn" onClick={handleLaunch}>🚀 Launch My Page &mdash; It&apos;s Free</button>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="wb" style={{ flex: 1 }} onClick={() => setWStep(5)}>Edit Answers</button>
                </div>
              </div>
            )}

            {/* Launch success */}
            {wStep === 6 && launched && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
                <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 26, marginBottom: 8, color: '#3ecf8e' }}>You&apos;re live!</h3>
                <div style={{ fontSize: 13, color: '#c8a96e', letterSpacing: '.04em', marginBottom: 16 }}>book.goelev8.ai/{wSlug}</div>
                <div style={{ fontSize: 12, color: '#6b6560', lineHeight: 1.9, marginBottom: 24 }}>Your booking page is live right now.<br />Share this link with your clients to start receiving bookings.</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="wn" style={{ padding: '12px 24px', fontSize: 12, width: 'auto', margin: 0 }} onClick={() => window.open(`https://book.goelev8.ai/${wSlug}`, '_blank')}>View My Booking Page &rarr;</button>
                  <button className="wb" style={{ padding: '12px 24px', fontSize: 12 }} onClick={() => window.open(`https://portal.goelev8.ai/${wSlug}`, '_blank')}>Open Portal</button>
                  <button className="wb" style={{ padding: '12px 24px', fontSize: 12 }} onClick={closeWizard}>Back to Site</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── CSS (identical to original goelev8-booking.html) ─── */
const LANDING_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --black:#080808;--ink:#0f0f0f;--surface:#161616;--border:#222;--gold:#c8a96e;
  --gold-light:#e8c98e;--gold-dim:#8a7250;--text:#f0ede8;--muted:#6b6560;
  --dim:#2a2825;--green:#3ecf8e;--red:#e05252;
}
html{scroll-behavior:smooth}
body{background:var(--black);color:var(--text);font-family:"DM Mono",monospace;font-size:14px;line-height:1.6;overflow-x:hidden;cursor:none}
#cur{position:fixed;width:10px;height:10px;background:var(--gold);border-radius:50%;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);transition:width .2s,height .2s;mix-blend-mode:difference}
#cur.h{width:20px;height:20px}
#ring{position:fixed;width:38px;height:38px;border:1px solid rgba(200,169,110,.35);border-radius:50%;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);transition:width .25s,height .25s}
#ring.h{width:60px;height:60px;border-color:rgba(200,169,110,.15)}
body::after{content:"";position:fixed;inset:0;background-image:linear-gradient(rgba(200,169,110,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(200,169,110,.018) 1px,transparent 1px);background-size:72px 72px;pointer-events:none;z-index:0}
nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:18px 40px;background:rgba(8,8,8,.93);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.logo-text{font-family:"Syne",sans-serif;font-weight:800;font-size:16px;letter-spacing:.06em;text-transform:uppercase;color:var(--text)}
.logo-text span{color:var(--gold)}
.nav-links{display:flex;align-items:center;gap:28px;list-style:none}
.nav-links a{color:var(--muted);text-decoration:none;font-size:11px;letter-spacing:.08em;text-transform:uppercase;transition:color .2s}
.nav-links a:hover{color:var(--gold)}
.nav-signin{color:var(--muted);text-decoration:none;font-family:"Syne",sans-serif;font-weight:600;font-size:12px;letter-spacing:.06em;text-transform:uppercase;padding:9px 18px;border:1px solid var(--border);background:transparent;transition:all .2s;cursor:none}
.nav-signin:hover{color:var(--gold);border-color:var(--gold)}
.nav-cta{background:var(--gold);color:var(--black);border:none;padding:10px 22px;font-family:"Syne",sans-serif;font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;cursor:none;transition:all .2s;clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))}
.nav-cta:hover{background:var(--gold-light);transform:translateY(-1px)}
.hero{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:60px;padding:100px 60px 60px;position:relative;z-index:2;max-width:1300px;margin:0 auto}
@media(max-width:900px){.hero{grid-template-columns:1fr;padding:100px 24px 60px}.nav-links{display:none}.nav-signin{display:none}}
.hero-left{display:flex;flex-direction:column;gap:0}
.hero-badge{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--border);background:rgba(200,169,110,.05);padding:6px 14px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:40px;width:fit-content}
.hero-badge::before{content:"";width:6px;height:6px;background:var(--green);border-radius:50%;animation:blink 1.6s ease-in-out infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
.hero-h1{font-family:"Syne",sans-serif;font-weight:800;font-size:clamp(44px,5.5vw,76px);line-height:.96;letter-spacing:-.04em;margin-bottom:28px}
.hero-h1 em{font-style:italic;font-family:"Instrument Serif",serif;color:var(--gold);font-weight:400}
.hero-h1 .dim{color:var(--dim)}
.hero-sub{color:var(--muted);font-size:13px;line-height:1.9;max-width:400px;margin-bottom:44px}
.hero-sub strong{color:var(--text)}
.hero-btns{display:flex;gap:14px;flex-wrap:wrap}
.btn-p{background:var(--gold);color:var(--black);border:none;padding:15px 32px;font-family:"Syne",sans-serif;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;cursor:none;transition:all .25s;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))}
.btn-p:hover{background:var(--gold-light);transform:translateY(-2px);box-shadow:0 12px 40px rgba(200,169,110,.3)}
.btn-g{background:transparent;color:var(--muted);border:1px solid var(--border);padding:14px 24px;font-family:"DM Mono",monospace;font-size:12px;cursor:none;transition:all .25s}
.btn-g:hover{border-color:var(--gold-dim);color:var(--text)}
.how-steps{display:flex;flex-direction:column;gap:0;margin-bottom:36px;border:1px solid var(--border)}
.how-step{display:flex;align-items:flex-start;gap:16px;padding:16px 18px;border-bottom:1px solid var(--border);transition:background .2s;position:relative}
.how-step:last-child{border-bottom:none}
.how-step::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:transparent;transition:background .3s}
.how-step:hover{background:rgba(200,169,110,.03)}
.how-step:hover::before{background:var(--gold-dim)}
.how-num{font-family:"Syne",sans-serif;font-weight:800;font-size:11px;color:var(--gold-dim);letter-spacing:.1em;min-width:24px;padding-top:2px;flex-shrink:0}
.how-title{font-family:"Syne",sans-serif;font-weight:700;font-size:13px;color:var(--text);margin-bottom:4px}
.how-desc{font-size:11px;color:var(--muted);line-height:1.7}
.orb{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;animation:orbf 9s ease-in-out infinite}
.o1{width:500px;height:500px;background:radial-gradient(circle,rgba(200,169,110,.1) 0,transparent 70%);top:-10%;left:-15%;animation-delay:0s}
.o2{width:320px;height:320px;background:radial-gradient(circle,rgba(62,207,142,.05) 0,transparent 70%);bottom:10%;right:-5%;animation-delay:-4s}
@keyframes orbf{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-28px) scale(1.04)}}
.hero-right{position:relative}
.booking-shell{background:var(--ink);border:1px solid var(--border);border-radius:2px;overflow:hidden;box-shadow:0 40px 80px rgba(0,0,0,.6),0 0 0 1px rgba(200,169,110,.06);animation:shellIn .8s .3s ease both}
@keyframes shellIn{from{opacity:0;transform:translateY(30px) scale(.97)}to{opacity:1;transform:none}}
.shell-bar{background:var(--surface);border-bottom:1px solid var(--border);padding:10px 16px;display:flex;align-items:center;gap:12px}
.shell-dots{display:flex;gap:5px}
.sd{width:9px;height:9px;border-radius:50%}
.sd1{background:#e05252}.sd2{background:#e0a052}.sd3{background:var(--green)}
.shell-url{font-size:10px;color:var(--muted);letter-spacing:.04em;margin-left:4px}
.shell-url span{color:var(--gold)}
.shell-live{margin-left:auto;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--green);display:flex;align-items:center;gap:5px}
.shell-live::before{content:"";width:5px;height:5px;background:var(--green);border-radius:50%;animation:blink 1.6s ease-in-out infinite}
.booking-body{display:grid;grid-template-columns:180px 1fr}
.bk-sidebar{background:var(--surface);border-right:1px solid var(--border);padding:20px 16px}
.biz-info{margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--border)}
.biz-name{font-family:"Syne",sans-serif;font-weight:700;font-size:13px;color:var(--text);margin-bottom:3px}
.biz-url{font-size:9px;color:var(--gold-dim);letter-spacing:.03em}
.ai-pill{display:inline-flex;align-items:center;gap:4px;background:rgba(62,207,142,.07);border:1px solid rgba(62,207,142,.18);padding:3px 8px;font-size:9px;color:var(--green);letter-spacing:.08em;text-transform:uppercase;margin-top:6px}
.ai-pill::before{content:"\\2726";font-size:5px}
.svc-label{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.svc-item{padding:10px 8px;border-bottom:1px solid var(--border);cursor:none;transition:all .2s;border-left:2px solid transparent}
.svc-item.active{border-left-color:var(--gold);background:rgba(200,169,110,.05)}
.svc-name{font-family:"Syne",sans-serif;font-weight:600;font-size:11px;color:var(--text);display:flex;justify-content:space-between}
.svc-name .price{color:var(--gold)}
.svc-meta{font-size:9px;color:var(--muted);margin-top:2px}
.svc-item.active .svc-name{color:var(--gold)}
.bk-cal{padding:20px}
.cal-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.cal-month{font-family:"Syne",sans-serif;font-weight:700;font-size:14px}
.cal-nav-btns{display:flex;gap:4px}
.cnb{width:24px;height:24px;background:var(--surface);border:1px solid var(--border);color:var(--muted);font-size:11px;display:flex;align-items:center;justify-content:center;cursor:none}
.day-labels{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:3px}
.dl{text-align:center;font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);padding:4px 0}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.dc{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);position:relative;border:1px solid transparent;transition:all .15s}
.dc.avail{color:var(--text);cursor:none}
.dc.avail:hover{background:var(--surface);border-color:var(--border)}
.dc.past{color:var(--dim)}
.dc.booked{color:var(--dim);text-decoration:line-through}
.dc.today{border-color:var(--gold-dim);color:var(--gold)}
.dc.selected{background:var(--gold);color:var(--black);font-weight:700;border-color:var(--gold)}
.avdot{position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:var(--green)}
.time-section{margin-top:14px;opacity:0;transition:opacity .4s}
.time-section.show{opacity:1}
.ts-label{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.time-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.ts{border:1px solid var(--border);background:var(--surface);padding:7px 4px;text-align:center;font-size:10px;color:var(--muted);transition:all .2s;cursor:none}
.ts:hover{border-color:var(--gold-dim);color:var(--text)}
.ts.sel{border-color:var(--gold);background:rgba(200,169,110,.1);color:var(--gold)}
.ts.taken{opacity:.25;text-decoration:line-through;pointer-events:none}
.confirm-row{margin-top:12px;display:flex;gap:8px;opacity:0;transition:opacity .4s}
.confirm-row.show{opacity:1}
.confirm-btn{flex:1;background:var(--gold);color:var(--black);border:none;padding:11px;font-family:"Syne",sans-serif;font-weight:700;font-size:11px;letter-spacing:.05em;text-transform:uppercase;cursor:none;transition:all .2s;clip-path:polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))}
.success-overlay{position:absolute;inset:0;background:rgba(8,8,8,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;opacity:0;pointer-events:none;transition:opacity .5s;z-index:10}
.success-overlay.show{opacity:1}
.success-icon{width:52px;height:52px;border-radius:50%;border:2px solid var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.success-title{font-family:"Syne",sans-serif;font-weight:700;font-size:16px;color:var(--green)}
.success-detail{font-size:11px;color:var(--muted);text-align:center;line-height:1.8}
.success-sms{display:inline-flex;align-items:center;gap:6px;background:rgba(62,207,142,.08);border:1px solid rgba(62,207,142,.2);padding:6px 14px;font-size:10px;color:var(--green);letter-spacing:.06em;margin-top:4px}
.ai-thinking{display:flex;align-items:center;gap:6px;background:rgba(200,169,110,.06);border:1px solid rgba(200,169,110,.12);padding:6px 12px;font-size:10px;color:var(--gold);letter-spacing:.06em;margin-top:10px;opacity:0;transition:opacity .3s}
.ai-thinking.show{opacity:1}
.ai-dot{width:4px;height:4px;border-radius:50%;background:var(--gold);animation:aidot 1.2s ease-in-out infinite}
.ai-dot:nth-child(2){animation-delay:.2s}
.ai-dot:nth-child(3){animation-delay:.4s}
@keyframes aidot{0%,80%,100%{transform:scale(0);opacity:.3}40%{transform:scale(1);opacity:1}}
.ticker-wrap{overflow:hidden;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--surface);padding:11px 0;position:relative;z-index:2}
.ticker{display:flex;animation:tick 22s linear infinite;white-space:nowrap}
.ti{display:inline-flex;align-items:center;gap:20px;padding:0 36px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);flex-shrink:0}
.ti .dot{color:var(--gold);font-size:7px}
@keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.features{max-width:1300px;margin:0 auto;padding:80px 60px}
.sec-label{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:14px;display:flex;align-items:center;gap:10px}
.sec-label::before{content:"";width:22px;height:1px;background:var(--gold-dim)}
.sec-title{font-family:"Syne",sans-serif;font-weight:800;font-size:clamp(30px,4vw,52px);line-height:1.05;letter-spacing:-.03em;margin-bottom:50px}
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border)}
@media(max-width:900px){.feat-grid{grid-template-columns:1fr}}
.feat{background:var(--ink);padding:36px;transition:background .3s;position:relative;overflow:hidden}
.feat::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--gold-dim),transparent);opacity:0;transition:opacity .3s}
.feat:hover{background:var(--surface)}
.feat:hover::before{opacity:1}
.feat-icon{font-size:22px;margin-bottom:20px}
.feat-title{font-family:"Syne",sans-serif;font-weight:700;font-size:15px;margin-bottom:10px}
.feat-desc{font-size:12px;color:var(--muted);line-height:1.8}
.pricing{background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:80px 60px}
.pricing-inner{max-width:1100px;margin:0 auto}
.price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);margin-top:50px}
@media(max-width:900px){.price-grid{grid-template-columns:1fr}}
.pc{background:var(--ink);padding:44px 36px;position:relative}
.pc.feat-pc{background:var(--black);border:1px solid var(--gold-dim);margin:-1px}
.plan-tag{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:18px}
.pc.feat-pc .plan-tag{color:var(--gold)}
.plan-price{font-family:"Syne",sans-serif;font-weight:800;font-size:52px;letter-spacing:-.04em;line-height:1}
.plan-price sup{font-size:22px;font-weight:400;color:var(--muted)}
.plan-per{font-size:11px;color:var(--muted);margin-bottom:28px}
.plan-feats{list-style:none;margin-bottom:36px}
.plan-feats li{font-size:12px;color:var(--muted);padding:9px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
.plan-feats li::before{content:"\\2713";color:var(--gold-dim)}
.pc.feat-pc .plan-feats li::before{color:var(--gold)}
.plan-btn{width:100%;padding:13px;font-family:"Syne",sans-serif;font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;cursor:none;transition:all .2s;border:1px solid var(--border);background:transparent;color:var(--muted)}
.pc.feat-pc .plan-btn{background:var(--gold);color:var(--black);border-color:var(--gold);clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))}
.plan-btn:hover{border-color:var(--gold-dim);color:var(--text)}
.pc.feat-pc .plan-btn:hover{background:var(--gold-light)}
.feat-badge{position:absolute;top:18px;right:18px;background:var(--gold);color:var(--black);font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;font-weight:700}
.signup{padding:80px 60px;background:var(--ink);border-top:1px solid var(--border)}
.signup-inner{max-width:600px;margin:0 auto;text-align:center}
.sform{margin-top:44px;display:flex;flex-direction:column;gap:10px;text-align:left}
.frow{display:flex;gap:10px}
.ff{flex:1;display:flex;flex-direction:column;gap:5px}
.flabel{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.finput{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:12px 14px;font-family:"DM Mono",monospace;font-size:13px;outline:none;transition:all .2s;width:100%}
.finput:focus{border-color:var(--gold-dim);background:rgba(200,169,110,.04)}
.finput::placeholder{color:var(--dim)}
.url-wrap{display:flex;border:1px solid var(--border);background:var(--black);overflow:hidden}
.url-pre{padding:12px 14px;background:var(--surface);border-right:1px solid var(--border);font-size:11px;color:var(--dim);white-space:nowrap;flex-shrink:0}
.url-in{background:transparent;border:none;color:var(--gold);padding:12px 14px;font-family:"DM Mono",monospace;font-size:13px;outline:none;flex:1}
.fsub{background:var(--gold);color:var(--black);border:none;padding:16px;font-family:"Syne",sans-serif;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;cursor:none;transition:all .2s;margin-top:6px;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))}
.fsub:hover{background:var(--gold-light);transform:translateY(-2px);box-shadow:0 16px 48px rgba(200,169,110,.3)}
.fine{font-size:11px;color:var(--dim);margin-top:14px;line-height:1.9}
.fine a{color:var(--gold-dim);text-decoration:none}
footer{border-top:1px solid var(--border);padding:36px 60px;display:flex;align-items:center;justify-content:space-between;background:var(--black);position:relative;z-index:2}
.fl{font-size:11px;color:var(--dim)}
.fl a{color:var(--gold-dim);text-decoration:none}
.fr{display:flex;gap:22px}
.fr a{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);text-decoration:none;transition:color .2s}
.fr a:hover{color:var(--gold)}

/* WIZARD STYLES */
.ws{animation:fadeUp .4s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.ws-tag{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8a7250;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.ws-tag::before{content:"";display:inline-block;width:18px;height:1px;background:#8a7250}
.ws-h{font-family:'Syne',sans-serif;font-weight:800;font-size:clamp(24px,5vw,40px);line-height:1.08;letter-spacing:-.03em;margin-bottom:12px;color:#f0ede8}
.ws-p{color:#6b6560;font-size:13px;line-height:1.9;margin-bottom:24px}
.wf{margin-bottom:16px}
.wl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#6b6560;margin-bottom:6px}
.wi{background:#161616;border:1px solid #222;color:#f0ede8;padding:12px 16px;font-family:"DM Mono",monospace;font-size:13px;outline:none;transition:all .2s;width:100%;display:block;box-sizing:border-box}
.wi:focus{border-color:#8a7250;background:rgba(200,169,110,.04)}
.wi::placeholder{color:#2a2825}
.wchips{display:flex;flex-wrap:wrap;gap:8px}
.wc{padding:9px 16px;border:1px solid #222;background:#161616;font-size:12px;color:#6b6560;cursor:pointer;transition:all .2s;letter-spacing:.02em;user-select:none}
.wc:hover{border-color:#8a7250;color:#f0ede8}
.wc.on{border-color:#c8a96e;background:rgba(200,169,110,.1);color:#c8a96e}
.wn{background:#c8a96e;color:#080808;border:none;padding:15px 28px;font-family:'Syne',sans-serif;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:all .25s;clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));width:100%;margin-top:8px;display:block}
.wn:hover{background:#e8c98e;transform:translateY(-1px);box-shadow:0 10px 30px rgba(200,169,110,.3)}
.wb{background:transparent;border:1px solid #222;color:#6b6560;padding:13px 20px;font-family:"DM Mono",monospace;font-size:12px;cursor:pointer;transition:all .2s}
.wb:hover{border-color:#8a7250;color:#f0ede8}
`;
