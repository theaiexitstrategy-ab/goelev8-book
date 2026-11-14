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

  const step1Ready = wBiz.trim().length > 1 && wSlug.length >= 3 && slugStatus === 'available';

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

      {/* Fake mouse for demo animation */}
      <div id="fakeMouse" style={{ position: 'fixed', pointerEvents: 'none', zIndex: 99999, opacity: 0, transition: 'opacity 0.4s', willChange: 'transform', top: 0, left: 0, transform: 'translate(0,0)' }}>
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none"><path d="M1 1L1 16.5L4.5 13L7 19.5L9.5 18.5L7 12L11.5 12L1 1Z" fill="#0b1220" stroke="#ffffff" strokeWidth="1.2" strokeLinejoin="round" /></svg>
      </div>
      <div id="clickRipple" style={{ position: 'fixed', pointerEvents: 'none', zIndex: 99998, width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--brand)', opacity: 0, transform: 'translate(-50%,-50%) scale(0.2)', top: 0, left: 0 }} />

      {/* NAV */}
      <nav className="nav">
        <div className="nav-inner">
          <a href="/" className="logo">
            <span className="logo-mark"><img src="/brand/goelev8-mark-white.png" alt="" /></span>
            <span className="logo-text"><span className="wm">GO ELEV8.AI</span><span className="logo-sub">Booking</span></span>
          </a>
          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="https://portal.goelev8.ai">Portal Login</a></li>
          </ul>
          <div className="nav-actions">
            <a href="https://portal.goelev8.ai" className="nav-signin">Sign In</a>
            <button className="btn btn-primary btn-sm" onClick={openWizard}>Claim Your Link</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-badge"><span className="live-dot" />AI-powered scheduling &middot; Live at book.goelev8.ai</div>
          <h1 className="hero-h1">
            Your booking link.<br />
            <span className="accent">Powered by AI.</span>
          </h1>
          <p className="hero-sub">
            We connect an AI assistant directly to your booking calendar.
            <strong> You share the link. The assistant handles the rest</strong> &mdash;
            answering questions, qualifying clients, collecting payment, sending confirmations,
            and filling your schedule while you focus on the work that actually pays.
          </p>

          <div className="hero-btns">
            <button className="btn btn-primary btn-lg" onClick={openWizard}>Get your free link &rarr;</button>
            <button className="btn btn-ghost btn-lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>See features</button>
          </div>
          <div className="hero-fine">Free forever plan &middot; No credit card required &middot; Live in 2 minutes</div>

          {/* HOW IT WORKS */}
          <ol className="how-steps">
            <li className="how-step">
              <div className="how-num">1</div>
              <div>
                <div className="how-title">You get your link</div>
                <div className="how-desc">book.goelev8.ai/yourbusiness goes live in under 2 minutes. Your services, availability, and pricing &mdash; all set.</div>
              </div>
            </li>
            <li className="how-step">
              <div className="how-num">2</div>
              <div>
                <div className="how-title">Share it anywhere</div>
                <div className="how-desc">IG bio, Google Business, a text message, a flyer. One link. The AI assistant is always on, 24/7.</div>
              </div>
            </li>
            <li className="how-step">
              <div className="how-num">3</div>
              <div>
                <div className="how-title">AI handles the rest</div>
                <div className="how-desc">Books appointments, sends SMS reminders, collects deposits, fills no-show slots &mdash; all without you lifting a finger.</div>
              </div>
            </li>
          </ol>
        </div>

        {/* RIGHT — ANIMATED BOOKING WIDGET */}
        <div className="hero-right">
          <img className="hero-mascot" src="/brand/goelev8-mascot.png" alt="GoElev8.AI booking assistant" />
          <div className="booking-shell" style={{ position: 'relative' }}>
            <div className="shell-bar">
              <div className="shell-dots"><div className="sd" /><div className="sd" /><div className="sd" /></div>
              <div className="shell-url">book.goelev8.ai/<span>flexfacility</span></div>
              <div className="shell-live"><span className="live-dot" />Live</div>
            </div>

            <div className="booking-body">
              {/* Sidebar */}
              <div className="demo-side">
                <div className="biz-info">
                  <div className="biz-logo">TF</div>
                  <div className="biz-name">The Flex Facility</div>
                  <div className="ai-pill">AI-Powered</div>
                </div>
                <div className="svc-label">Select a service</div>
                <div className="svc-list">
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
              </div>

              {/* Calendar */}
              <div className="demo-cal" style={{ position: 'relative' }}>
                <div className="cal-hdr">
                  <div className="cnb" aria-hidden="true">&#8249;</div>
                  <div className="cal-month">May 2026</div>
                  <div className="cnb" aria-hidden="true">&#8250;</div>
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
                    return (
                      <div key={d} className={cls} id={`d${d}`}>
                        {d}
                      </div>
                    );
                  })}
                </div>

                <div className={`ai-thinking${demoAiThink ? ' show' : ''}`}>
                  <div className="ai-dot" /><div className="ai-dot" /><div className="ai-dot" />
                  AI finding best times&hellip;
                </div>

                <div className={`time-section${demoShowTimes ? ' show' : ''}`}>
                  <div className="ts-label">Wednesday, May 20</div>
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
                  <button className="confirm-btn" id="confirmBtn" tabIndex={-1}>
                    {demoSelTime ? `Confirm — May 20 @ ${demoSelTime}` : 'Confirm booking'}
                  </button>
                </div>

                {/* Success overlay */}
                <div className={`success-overlay${demoSuccess ? ' show' : ''}`}>
                  <div className="success-icon" style={demoSuccess ? { transform: 'scale(1)', transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)' } : { transform: 'scale(0)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10" /></svg>
                  </div>
                  <div className="success-title">You are scheduled</div>
                  <div className="success-detail">Wednesday, May 20, 2026 &middot; 9:00am<br />1-on-1 Training &middot; $75 &middot; Coach Kenny</div>
                  <div className="success-sms">SMS confirmation sent</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITY STRIP */}
      <div className="strip">
        <div className="strip-inner">
          {['AI Scheduling', 'SMS Reminders', 'Stripe Payments', 'No-Show Protection', 'Client Portal', 'Waitlist AI', 'Multi-Staff', 'Google & Apple Calendar Sync'].map(t => (
            <span key={t} className="strip-item">{t}</span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section className="section" id="features">
        <div className="section-inner">
          <div className="sec-head">
            <div className="sec-label">What&apos;s included</div>
            <h2 className="sec-title">Everything the big names charge extra for. Built in.</h2>
          </div>
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
      </section>

      {/* PRICING */}
      <section className="section section-alt" id="pricing">
        <div className="section-inner">
          <div className="sec-head center">
            <div className="sec-label">Simple pricing</div>
            <h2 className="sec-title">A utility bill, not a subscription trap.</h2>
          </div>
          <div className="price-grid">
            <div className="pc">
              <div className="plan-tag">Starter</div>
              <div className="plan-price"><sup>$</sup>0</div>
              <div className="plan-per">free forever</div>
              <ul className="plan-feats">
                <li>1 booking page</li><li>Unlimited appointments</li>
                <li>20 free SMS credits</li><li>Stripe payments</li>
              </ul>
              <button className="btn btn-outline btn-block" onClick={openWizard}>Start free</button>
            </div>
            <div className="pc featured">
              <div className="feat-badge">Most popular</div>
              <div className="plan-tag">Pro</div>
              <div className="plan-price"><sup>$</sup>99</div>
              <div className="plan-per">per month</div>
              <ul className="plan-feats">
                <li>Everything in Starter</li><li>AI scheduling engine</li>
                <li>Unlimited SMS reminders</li><li>Waitlist AI auto-fill</li>
                <li>Full client portal</li><li>Multi-staff support</li>
              </ul>
              <button className="btn btn-primary btn-block" onClick={openWizard}>Get Pro</button>
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
              <button className="btn btn-outline btn-block">Contact sales</button>
            </div>
          </div>
        </div>
      </section>

      {/* SIGNUP SECTION */}
      <section className="section" id="signup">
        <div className="signup-card">
          <img className="signup-mascot" src="/brand/goelev8-mascot.png" alt="" />
          <div className="sec-head center">
            <div className="sec-label">Claim your link</div>
            <h2 className="sec-title">Your booking page is waiting.</h2>
            <p className="sec-sub">Setup in under 2 minutes. No credit card required.</p>
          </div>
          <div className="sform">
            <div className="frow">
              <div className="ff"><label className="flabel">First name</label><input className="finput" type="text" autoComplete="given-name" placeholder="Aaron" value={wFn} onChange={e => setWFn(e.target.value)} /></div>
              <div className="ff"><label className="flabel">Last name</label><input className="finput" type="text" autoComplete="family-name" placeholder="Bryant" value={wLn} onChange={e => setWLn(e.target.value)} /></div>
            </div>
            <div className="ff">
              <label className="flabel">Business name</label>
              <input className="finput" type="text" autoComplete="organization" placeholder="The Flex Facility" value={wBiz} onChange={e => doAutoSlug(e.target.value)} />
            </div>
            <div className="ff">
              <label className="flabel">Your booking link</label>
              <div className="url-wrap">
                <div className="url-pre">book.goelev8.ai/</div>
                <input className="url-in" type="text" placeholder="yourcompany" value={wSlug} onChange={e => setWSlug(slugify(e.target.value))} />
              </div>
              <div className="w-hint">
                {slugStatus === 'checking' && 'Checking availability...'}
                {slugStatus === 'available' && <span className="ok">&#10003; book.goelev8.ai/{wSlug} is available!</span>}
                {slugStatus === 'taken' && <span className="bad">&#10007; This link is already taken.</span>}
              </div>
            </div>
            <div className="ff"><label className="flabel">Email</label><input className="finput" type="email" autoComplete="email" placeholder="you@yourbusiness.com" value={wEmail} onChange={e => setWEmail(e.target.value)} /></div>
            <div className="ff"><label className="flabel">Phone</label><input className="finput" type="tel" autoComplete="tel" placeholder="+1 (314) 000-0000" value={wPhone} onChange={e => setWPhone(e.target.value)} /></div>
            <button className="btn btn-primary btn-lg btn-block" onClick={openWizard}>Claim book.goelev8.ai/<span id="slug-preview">{wSlug || 'yourcompany'}</span> &rarr;</button>
            <div className="fine">By signing up you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.<br />Your portal activates instantly. Free plan &middot; No credit card required.</div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="fbrand">
            <img className="flockup" src="/brand/goelev8-lockup.png" alt="GoElev8.AI — Infinite Possibilities" />
            <div className="fl">&copy; 2026 <a href="https://goelev8.ai">GoElev8.ai</a> &middot; Aaron Bryant &middot; All rights reserved.</div>
          </div>
          <div className="fr">
            <a href="https://portal.goelev8.ai">Portal Login</a>
            <a href="#">Terms</a><a href="#">Privacy</a><a href="#">Contact</a>
          </div>
        </div>
      </footer>

      {/* ═══ WIZARD MODAL ═══ */}
      {wizardOpen && (
        <div className="wz-overlay">
          <div className="wz-wrap">
            {/* Header */}
            <div className="wz-top">
              <div className="logo">
                <span className="logo-mark"><img src="/brand/goelev8-mark-white.png" alt="" /></span>
                <span className="logo-text"><span className="wm">GO ELEV8.AI</span><span className="logo-sub">Booking</span></span>
              </div>
              <button className="wz-close" onClick={closeWizard} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="wz-card">
              {/* Progress */}
              {!launched && (
                <div className="wz-progress">
                  <div className="wz-progress-row">
                    <span className="wz-step">Step {wStep} of 6</span>
                    <span className="wz-pct">{PCT[wStep - 1]}%</span>
                  </div>
                  <div className="wz-bar"><div className="wz-bar-fill" style={{ width: PCT[wStep - 1] + '%' }} /></div>
                </div>
              )}

              {/* Step 1 */}
              {wStep === 1 && (
                <div className="ws">
                  <div className="ws-tag">Let&apos;s build your page</div>
                  <h2 className="ws-h">Your AI booking page starts here.</h2>
                  <p className="ws-p">Answer a few quick questions and your page at <strong>book.goelev8.ai/yourbusiness</strong> goes live with a 24/7 AI assistant handling bookings while you focus on the work.</p>
                  <div className="wf">
                    <label className="wl">Business name <span className="req">*</span></label>
                    <input className="wi" value={wBiz} onChange={e => doAutoSlug(e.target.value)} placeholder="e.g. The Flex Facility" />
                  </div>
                  <div className="wf">
                    <label className="wl">Your booking link</label>
                    <div className="url-wrap">
                      <div className="url-pre">book.goelev8.ai/</div>
                      <input className="url-in" value={wSlug} onChange={e => setWSlug(slugify(e.target.value))} placeholder="yourbusiness" />
                    </div>
                    <div className="w-hint">
                      {slugStatus === 'checking' && 'Checking availability...'}
                      {slugStatus === 'available' && <span className="ok">&#10003; book.goelev8.ai/{wSlug} is available!</span>}
                      {slugStatus === 'taken' && <span className="bad">&#10007; This link is already taken.</span>}
                      {slugStatus === 'idle' && <>Your live link: <strong className="brand-text">book.goelev8.ai/{wSlug || 'yourbusiness'}</strong></>}
                    </div>
                  </div>
                  <div className="w-actions">
                    <button className="btn btn-primary btn-lg btn-block" disabled={!step1Ready} onClick={() => setWStep(2)}>
                      {slugStatus === 'checking' ? 'Checking link…' : <>Looks good &mdash; Next</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {wStep === 2 && (
                <div className="ws">
                  <div className="ws-tag">What you do</div>
                  <h2 className="ws-h">What kind of business are you?</h2>
                  <p className="ws-p">Pick the one that fits best &mdash; this helps us set up your calendar and AI assistant the right way from day one.</p>
                  <div className="wchips">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <div key={k} className={`wc${wBt === k ? ' on' : ''}`} onClick={() => setWBt(k)}>{v}</div>
                    ))}
                  </div>
                  <div className="wf" style={{ marginTop: 28 }}>
                    <label className="wl">Your services <span className="req">*</span></label>
                    <p className="w-hint" style={{ marginTop: 0, marginBottom: 12 }}>Add at least one service so clients can book with you.</p>
                    {wServices.map((svc, i) => (
                      <div key={i} className="w-svc-row">
                        <div className="w-svc-name">
                          {i === 0 && <div className="w-svc-lbl">Service name</div>}
                          <input className="wi" placeholder="e.g. 1-on-1 Training" value={svc.name} onChange={e => {
                            const n = [...wServices]; n[i] = { ...n[i], name: e.target.value }; setWServices(n);
                          }} />
                        </div>
                        <div className="w-svc-num">
                          {i === 0 && <div className="w-svc-lbl">Min</div>}
                          <input className="wi center" placeholder="60" value={svc.duration} onChange={e => {
                            const n = [...wServices]; n[i] = { ...n[i], duration: e.target.value }; setWServices(n);
                          }} />
                        </div>
                        <div className="w-svc-num">
                          {i === 0 && <div className="w-svc-lbl">Price $</div>}
                          <input className="wi center" placeholder="75" value={svc.price} onChange={e => {
                            const n = [...wServices]; n[i] = { ...n[i], price: e.target.value }; setWServices(n);
                          }} />
                        </div>
                        {wServices.length > 1 && (
                          <button className="w-x" aria-label="Remove service" onClick={() => setWServices(wServices.filter((_, j) => j !== i))}>&times;</button>
                        )}
                      </div>
                    ))}
                    {wServices.length < 6 && (
                      <button className="w-add" onClick={() => setWServices([...wServices, { name: '', duration: '60', price: '' }])}>+ Add another service</button>
                    )}
                  </div>
                  <div className="w-actions">
                    <button className="btn btn-ghost btn-lg" onClick={() => setWStep(1)}>Back</button>
                    <button className="btn btn-primary btn-lg grow" onClick={() => setWStep(3)}>Next</button>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {wStep === 3 && (
                <div className="ws">
                  <div className="ws-tag">Your brand</div>
                  <h2 className="ws-h">Let&apos;s make it <span className="accent">look like you.</span></h2>
                  <p className="ws-p">Your booking page will match your brand &mdash; logo, colors, your vibe.</p>
                  <div className="wf">
                    <label className="wl">Upload your logo</label>
                    <div className="w-drop">
                      <input type="file" accept="image/*" onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setWLogoFile(file);
                        const r = new FileReader();
                        r.onload = ev => setWLogoSrc(ev.target?.result as string);
                        r.readAsDataURL(file);
                      }} />
                      {!wLogoSrc ? (
                        <div>
                          <div className="w-drop-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                          </div>
                          <div className="w-drop-text">Drop your logo or <span className="brand-text u">click to browse</span></div>
                          <div className="w-hint">PNG, JPG or SVG</div>
                        </div>
                      ) : (
                        <img src={wLogoSrc} alt="" style={{ maxHeight: 70, maxWidth: 180 }} />
                      )}
                    </div>
                  </div>
                  <div className="wf" style={{ marginTop: 24 }}>
                    <label className="wl">Primary brand color</label>
                    <div className="w-swatches">
                      {['#c8a96e', '#3ecf8e', '#4f88f6', '#e05252', '#b06fd8', '#f07840', '#1a1a2e', '#f0ede8'].map(c => (
                        <button key={c} type="button" aria-label={c} className={`w-swatch${wColor === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setWColor(c)} />
                      ))}
                    </div>
                    <div className="w-color-row">
                      <div className="w-color-preview" style={{ background: wColor }} />
                      <input className="wi" value={wColor} onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setWColor(e.target.value); else setWColor(e.target.value); }} />
                    </div>
                  </div>
                  <div className="w-actions">
                    <button className="btn btn-ghost btn-lg" onClick={() => setWStep(2)}>Back</button>
                    <button className="btn btn-primary btn-lg grow" onClick={() => setWStep(4)}>Next</button>
                  </div>
                </div>
              )}

              {/* Step 4 */}
              {wStep === 4 && (
                <div className="ws">
                  <div className="ws-tag">Availability</div>
                  <h2 className="ws-h">When are you open for business?</h2>
                  <p className="ws-p">Your AI assistant only offers the time slots you set here.</p>
                  <div className="wf">
                    <label className="wl">Available days</label>
                    <div className="wchips">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                        <div key={d} className={`wc day${selectedDays.includes(d) ? ' on' : ''}`} onClick={() => {
                          setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
                        }}>{d}</div>
                      ))}
                    </div>
                  </div>
                  <div className="wf" style={{ marginTop: 24 }}>
                    <label className="wl">Typical hours</label>
                    <div className="w-hours">
                      <select className="wi" value={wOpen} onChange={e => setWOpen(e.target.value)}>
                        {['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'].map(t => <option key={t}>{t}</option>)}
                      </select>
                      <span className="w-to">to</span>
                      <select className="wi" value={wClose} onChange={e => setWClose(e.target.value)}>
                        {['3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="wf" style={{ marginTop: 24 }}>
                    <label className="wl">How many people take bookings?</label>
                    <div className="wchips">
                      {[['1', 'Just me'], ['2-5', '2–5 people'], ['6+', '6 or more']].map(([v, l]) => (
                        <div key={v} className={`wc${wStaff === v ? ' on' : ''}`} onClick={() => setWStaff(v)}>{l}</div>
                      ))}
                    </div>
                  </div>
                  <div className="w-actions">
                    <button className="btn btn-ghost btn-lg" onClick={() => setWStep(3)}>Back</button>
                    <button className="btn btn-primary btn-lg grow" onClick={() => setWStep(5)}>Next</button>
                  </div>
                </div>
              )}

              {/* Step 5 */}
              {wStep === 5 && (
                <div className="ws">
                  <div className="ws-tag">Your contact info</div>
                  <h2 className="ws-h">Almost there. Last few things.</h2>
                  <p className="ws-p">We&apos;ll send booking alerts to your email and activate the AI-powered SMS reminder system.</p>
                  <div className="w-two">
                    <div className="wf"><label className="wl">First name <span className="req">*</span></label><input className="wi" value={wFn} onChange={e => setWFn(e.target.value)} placeholder="Aaron" /></div>
                    <div className="wf"><label className="wl">Last name <span className="req">*</span></label><input className="wi" value={wLn} onChange={e => setWLn(e.target.value)} placeholder="Bryant" /></div>
                  </div>
                  <div className="wf"><label className="wl">Email <span className="req">*</span></label><input className="wi" value={wEmail} onChange={e => setWEmail(e.target.value)} type="email" placeholder="you@yourbusiness.com" /></div>
                  <div className="wf">
                    <label className="wl">Business phone <span className="req">*</span></label>
                    <input className="wi" value={wPhone} onChange={e => setWPhone(e.target.value)} type="tel" placeholder="+1 (314) 000-0000" />
                    <div className="w-hint">Your clients get AI-powered SMS reminders from this number.</div>
                  </div>
                  <div className="wf">
                    <label className="wl">Collect payment at booking?</label>
                    <div className="wchips">
                      {[['full', 'Yes — full payment'], ['deposit', 'Deposit only'], ['none', 'No — pay in person']].map(([v, l]) => (
                        <div key={v} className={`wc${wPay === v ? ' on' : ''}`} onClick={() => setWPay(v)}>{l}</div>
                      ))}
                    </div>
                  </div>
                  <div className="w-actions">
                    <button className="btn btn-ghost btn-lg" onClick={() => setWStep(4)}>Back</button>
                    <button className="btn btn-primary btn-lg grow" onClick={() => setWStep(6)}>Review &amp; launch</button>
                  </div>
                </div>
              )}

              {/* Step 6 */}
              {wStep === 6 && !launched && (
                <div className="ws">
                  <div className="ws-tag">You&apos;re ready</div>
                  <h2 className="ws-h">Here&apos;s what you&apos;re about to launch</h2>

                  <div className="w-review">
                    <div className="w-review-head">
                      <div className="w-review-logo" style={{ background: wColor }}>
                        {wLogoSrc ? <img src={wLogoSrc} alt="" /> : (wBiz || 'Y').trim().charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="w-review-name">{wBiz || 'Your Business'}</div>
                        <div className="w-review-url">book.goelev8.ai/{wSlug || 'yourbusiness'}</div>
                      </div>
                    </div>
                    <div className="w-review-grid">
                      <div><div className="w-k">Business type</div><div className="w-v">{TYPE_LABELS[wBt] || '—'}</div></div>
                      <div><div className="w-k">Availability</div><div className="w-v">{selectedDays.length ? `${selectedDays.join(', ')} · ${wOpen} – ${wClose}` : '—'}</div></div>
                      <div><div className="w-k">Team</div><div className="w-v">{wStaff === '1' ? 'Just you' : wStaff === '2-5' ? '2–5 people' : wStaff === '6+' ? '6+ people' : '—'}</div></div>
                      <div><div className="w-k">Payments</div><div className="w-v">{PAY_LABELS[wPay] || '—'}</div></div>
                    </div>
                  </div>

                  <ul className="w-checklist">
                    {['Branded booking page at your custom link', 'AI assistant handles scheduling 24/7', '20 free SMS reminders to start', `Portal dashboard at portal.goelev8.ai/${wSlug || 'yourbusiness'}`, 'Stripe payment collection (if selected)'].map(item => (
                      <li key={item}><span className="w-check">&#10003;</span> {item}</li>
                    ))}
                  </ul>

                  <div className="w-note">
                    <strong>No credit card required.</strong> Your free plan goes live instantly. Upgrade to Pro ($99/mo) anytime from your portal.
                  </div>

                  <button className="btn btn-primary btn-lg btn-block" onClick={handleLaunch}>Launch my page &mdash; it&apos;s free</button>
                  <div className="w-actions" style={{ marginTop: 12 }}>
                    <button className="btn btn-ghost btn-lg grow" onClick={() => setWStep(5)}>Edit answers</button>
                  </div>
                </div>
              )}

              {/* Launch success */}
              {wStep === 6 && launched && (
                <div className="w-done">
                  <img className="w-done-mascot" src="/brand/goelev8-mascot.png" alt="" />
                  <h3 className="w-done-title">You&apos;re live!</h3>
                  <div className="w-done-url">book.goelev8.ai/{wSlug}</div>
                  <p className="ws-p" style={{ textAlign: 'center' }}>Your booking page is live right now.<br />Share this link with your clients to start receiving bookings.</p>
                  <div className="w-done-btns">
                    <button className="btn btn-primary btn-lg" onClick={() => window.open(`https://book.goelev8.ai/${wSlug}`, '_blank')}>View my booking page &rarr;</button>
                    <button className="btn btn-ghost btn-lg" onClick={() => window.open(`https://portal.goelev8.ai/${wSlug}`, '_blank')}>Open portal</button>
                    <button className="btn btn-ghost btn-lg" onClick={closeWizard}>Back to site</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── CSS ─── */
const LANDING_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --navy:#182230;
  --slate:#354050;
  --brand:#39caf1;
  --brand-strong:#182230;
  --brand-hover:#2a3647;
  --brand-text:#227890;
  --tint:rgba(57,202,241,.12);
  --tint-strong:rgba(57,202,241,.22);
  --ring:rgba(57,202,241,.45);
  --bg:#f4f5f7;
  --card:#ffffff;
  --ink:#182230;
  --body:#374151;
  --muted:#6b7280;
  --faint:#9ca3af;
  --line:#e5e7eb;
  --line-soft:#f0f1f3;
  --success:#16a34a;
  --danger:#dc2626;
  --shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -8px rgba(16,24,40,.10);
}
html{scroll-behavior:smooth;background:var(--bg)}
body{background:var(--bg);color:var(--body);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased;overflow-x:hidden}
button{font:inherit;cursor:pointer}
a,button,input,select{-webkit-tap-highlight-color:transparent}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.accent{color:var(--brand-text)}
.brand-text{color:var(--brand-text)}
.u{text-decoration:underline}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;font-weight:600;border:1px solid transparent;transition:background .15s,border-color .15s,color .15s,box-shadow .15s;white-space:nowrap;text-decoration:none}
.btn-sm{height:38px;padding:0 18px;font-size:14px}
.btn-lg{height:48px;padding:0 26px;font-size:15px}
.btn-block{width:100%}
.btn-primary{background:var(--brand-strong);color:#fff}
.btn-primary:hover{background:var(--brand-hover)}
.btn-ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.btn-ghost:hover{border-color:#c7cbd1;background:#fafafa}
.btn-outline{background:#fff;color:var(--brand-text);border-color:var(--ring)}
.btn-outline:hover{border-color:var(--brand);background:var(--tint)}

/* Nav */
.nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.85);backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--line)}
.nav-inner{max-width:1200px;margin:0 auto;height:64px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.logo-mark{width:34px;height:34px;border-radius:9px;background:var(--navy);display:grid;place-items:center;flex-shrink:0}
.logo-mark img{height:21px;width:auto;display:block}
.logo-text{display:flex;align-items:baseline;gap:8px;white-space:nowrap}
.wm{font-family:'Montserrat','Inter',sans-serif;font-weight:800;font-size:17px;letter-spacing:.04em;color:var(--navy)}
.logo-sub{font-size:15px;font-weight:500;color:var(--muted)}
.hero-mascot{position:absolute;left:-92px;bottom:-34px;width:150px;height:auto;z-index:3;pointer-events:none;filter:drop-shadow(0 14px 20px rgba(24,34,48,.18))}
.signup-mascot{display:block;width:104px;height:auto;margin:-96px auto 12px}
.w-done-mascot{display:block;width:120px;height:auto;margin:0 auto 12px}
.fbrand{display:flex;flex-direction:column;gap:8px}
.flockup{height:30px;width:auto;display:block}
.btn:disabled{opacity:.45;cursor:not-allowed}
.nav-links{display:flex;align-items:center;gap:28px;list-style:none}
.nav-links a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:500;transition:color .15s}
.nav-links a:hover{color:var(--ink)}
.nav-actions{display:flex;align-items:center;gap:8px}
.nav-signin{color:var(--ink);text-decoration:none;font-size:14px;font-weight:600;padding:8px 14px;border-radius:999px;transition:background .15s}
.nav-signin:hover{background:var(--line-soft)}

/* Hero */
.hero{max-width:1200px;margin:0 auto;padding:72px 24px 80px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:56px;align-items:start}
.hero-left{padding-top:8px}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:500;color:var(--body);margin-bottom:28px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 0 3px rgba(22,163,74,.15);flex-shrink:0}
.hero-h1{font-size:clamp(40px,5.2vw,60px);line-height:1.05;font-weight:800;letter-spacing:-.035em;color:var(--ink);margin-bottom:22px}
.hero-sub{font-size:17px;line-height:1.7;color:var(--muted);max-width:520px;margin-bottom:32px}
.hero-sub strong{color:var(--ink);font-weight:600}
.hero-btns{display:flex;gap:12px;flex-wrap:wrap}
.hero-fine{font-size:13px;color:var(--faint);margin-top:14px}
.how-steps{list-style:none;margin-top:44px;display:flex;flex-direction:column;gap:18px;max-width:520px}
.how-step{display:flex;gap:14px;align-items:flex-start}
.how-num{width:28px;height:28px;border-radius:50%;background:var(--tint);color:var(--brand-text);font-weight:700;font-size:13px;display:grid;place-items:center;flex-shrink:0}
.how-title{font-weight:700;font-size:15px;color:var(--ink);margin-bottom:2px}
.how-desc{font-size:14px;color:var(--muted);line-height:1.6}

/* Demo widget */
.hero-right{position:relative}
.booking-shell{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.04),0 24px 56px -12px rgba(16,24,40,.18);animation:shellIn .6s .15s ease both}
@keyframes shellIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.shell-bar{background:#fafbfc;border-bottom:1px solid var(--line);padding:10px 14px;display:flex;align-items:center;gap:12px}
.shell-dots{display:flex;gap:6px}
.sd{width:10px;height:10px;border-radius:50%;background:#e5e7eb}
.shell-url{flex:1;min-width:0;font-size:12px;color:var(--muted);background:#fff;border:1px solid var(--line);border-radius:999px;padding:4px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shell-url span{color:var(--ink);font-weight:600}
.shell-live{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--success)}
.booking-body{display:grid;grid-template-columns:190px minmax(0,1fr)}
.demo-side{border-right:1px solid var(--line);padding:20px 16px}
.biz-info{padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid var(--line)}
.biz-logo{width:36px;height:36px;border-radius:9px;background:#c8a96e;color:#fff;font-weight:800;font-size:13px;display:grid;place-items:center;margin-bottom:10px}
.biz-name{font-weight:700;font-size:14px;color:var(--ink)}
.ai-pill{display:inline-flex;align-items:center;margin-top:6px;background:var(--tint);color:var(--brand-text);font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px}
.svc-label{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);margin-bottom:8px}
.svc-list{display:flex;flex-direction:column;gap:6px}
.svc-item{padding:10px;border:1px solid var(--line);border-radius:10px;transition:border-color .2s,background .2s}
.svc-item.active{border-color:var(--brand);background:var(--tint)}
.svc-name{font-weight:600;font-size:12.5px;color:var(--ink);display:flex;justify-content:space-between;gap:6px}
.svc-name .price{color:var(--muted);font-weight:500}
.svc-meta{font-size:11px;color:var(--muted);margin-top:2px}
.demo-cal{padding:18px 18px 20px}
.cal-hdr{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:10px}
.cal-month{font-weight:600;font-size:14px;color:var(--ink);min-width:96px;text-align:center}
.cnb{width:28px;height:28px;border-radius:50%;background:var(--tint);color:var(--brand-text);display:grid;place-items:center;font-size:18px;line-height:1}
.day-labels{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));margin-bottom:4px}
.dl{text-align:center;font-size:10px;font-weight:600;color:var(--faint);padding:4px 0;letter-spacing:.04em}
.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));row-gap:4px;justify-items:center}
.dc{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:12.5px;color:#c4c8cf;transition:background .2s,color .2s}
.dc.avail{background:var(--tint);color:var(--brand-text);font-weight:700}
.dc.booked{color:#c4c8cf}
.dc.today{box-shadow:inset 0 0 0 1.5px var(--ring)}
.dc.selected{background:var(--brand);color:#0b1220}
.time-section{margin-top:12px;opacity:0;transition:opacity .35s}
.time-section.show{opacity:1}
.ts-label{font-size:12px;font-weight:600;color:var(--ink);margin-bottom:8px}
.time-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.ts{border:1px solid var(--ring);border-radius:8px;padding:7px 2px;text-align:center;font-size:11.5px;font-weight:700;color:var(--brand-text);background:#fff;transition:all .2s;white-space:nowrap}
.ts.sel{background:#4b5563;border-color:#4b5563;color:#fff}
.ts.taken{border-color:var(--line);color:#d1d5db;text-decoration:line-through;font-weight:500}
.confirm-row{margin-top:10px;opacity:0;transition:opacity .35s}
.confirm-row.show{opacity:1}
.confirm-btn{width:100%;height:40px;border:none;border-radius:8px;background:var(--brand);color:#0b1220;font-weight:700;font-size:13px;cursor:default}
.ai-thinking{display:inline-flex;align-items:center;gap:6px;background:var(--tint);color:var(--brand-text);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;margin-top:10px;opacity:0;transition:opacity .3s}
.ai-thinking.show{opacity:1}
.ai-dot{width:5px;height:5px;border-radius:50%;background:var(--brand-text);animation:aidot 1.2s ease-in-out infinite}
.ai-dot:nth-child(2){animation-delay:.2s}
.ai-dot:nth-child(3){animation-delay:.4s}
@keyframes aidot{0%,80%,100%{transform:scale(0);opacity:.3}40%{transform:scale(1);opacity:1}}
.success-overlay{position:absolute;inset:0;background:rgba(255,255,255,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;opacity:0;pointer-events:none;transition:opacity .4s;z-index:10;text-align:center}
.success-overlay.show{opacity:1}
.success-icon{width:52px;height:52px;border-radius:50%;background:#dcfce7;color:var(--success);display:grid;place-items:center;flex-shrink:0}
.success-title{font-weight:700;font-size:18px;color:var(--ink)}
.success-detail{font-size:13px;color:var(--muted);line-height:1.7}
.success-sms{font-size:12px;font-weight:600;color:var(--success);background:#f0fdf4;border:1px solid #bbf7d0;border-radius:999px;padding:4px 12px;margin-top:4px}

/* Strip */
.strip{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:#fff}
.strip-inner{max-width:1200px;margin:0 auto;padding:18px 24px;display:flex;flex-wrap:wrap;justify-content:center;gap:10px 28px}
.strip-item{font-size:14px;font-weight:500;color:var(--muted);display:inline-flex;align-items:center;gap:8px}
.strip-item::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--brand)}

/* Sections */
.section{padding:96px 24px}
.section-alt{background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.section-inner{max-width:1200px;margin:0 auto}
.sec-head{max-width:640px;margin-bottom:48px}
.sec-head.center{margin-left:auto;margin-right:auto;text-align:center}
.sec-label{font-size:13px;font-weight:600;color:var(--brand-text);margin-bottom:10px;letter-spacing:.01em}
.sec-title{font-size:clamp(28px,3.6vw,40px);line-height:1.15;font-weight:800;letter-spacing:-.03em;color:var(--ink)}
.sec-sub{font-size:16px;color:var(--muted);margin-top:12px}

.feat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.feat{background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px;transition:box-shadow .2s,transform .2s,border-color .2s}
.feat:hover{box-shadow:var(--shadow);transform:translateY(-2px);border-color:#d9dce1}
.feat-icon{width:44px;height:44px;border-radius:12px;background:var(--tint);display:grid;place-items:center;font-size:21px;margin-bottom:18px}
.feat-title{font-weight:700;font-size:16px;color:var(--ink);margin-bottom:6px}
.feat-desc{font-size:14px;color:var(--muted);line-height:1.65}

.price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;max-width:1060px;margin:0 auto;align-items:stretch}
.pc{position:relative;background:#fff;border:1px solid var(--line);border-radius:14px;padding:32px 28px;display:flex;flex-direction:column}
.pc.featured{border:2px solid var(--brand);box-shadow:var(--shadow);padding:31px 27px}
.feat-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--brand);color:#0b1220;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;white-space:nowrap}
.plan-tag{font-size:15px;font-weight:700;color:var(--ink);margin-bottom:14px}
.plan-price{font-size:48px;font-weight:800;letter-spacing:-.04em;color:var(--ink);line-height:1}
.plan-price sup{font-size:22px;font-weight:600;color:var(--muted);vertical-align:top;position:relative;top:6px;margin-right:2px}
.plan-per{font-size:14px;color:var(--muted);margin:6px 0 24px}
.plan-feats{list-style:none;margin-bottom:28px;flex:1}
.plan-feats li{font-size:14px;color:var(--body);padding:8px 0;display:flex;align-items:center;gap:10px}
.plan-feats li::before{content:"\\2713";color:var(--brand-text);font-weight:700;font-size:13px;width:20px;height:20px;border-radius:50%;background:var(--tint);display:grid;place-items:center;flex-shrink:0}

/* Signup */
.signup-card{max-width:620px;margin:56px auto 0;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:48px 40px}
.signup-card .sec-head{margin-bottom:32px}
.sform{display:flex;flex-direction:column;gap:16px}
.frow{display:flex;gap:12px}
.ff{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.flabel{font-size:14px;font-weight:600;color:var(--ink)}
.finput,.wi{width:100%;height:46px;padding:0 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font:inherit;font-size:15px;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s;display:block}
.finput:hover,.wi:hover{border-color:#9ca3af}
.finput:focus,.wi:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--ring)}
.finput::placeholder,.wi::placeholder,.url-in::placeholder{color:#b6bbc3}
select.wi{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}
.wi.center{text-align:center;padding:0 8px}
.url-wrap{display:flex;border:1px solid #d1d5db;border-radius:8px;background:#fff;overflow:hidden;transition:border-color .15s,box-shadow .15s}
.url-wrap:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px var(--ring)}
.url-pre{padding:0 12px;display:flex;align-items:center;background:#f9fafb;border-right:1px solid var(--line);font-size:14px;color:var(--muted);white-space:nowrap;flex-shrink:0}
.url-in{flex:1;min-width:0;height:44px;border:none;outline:none;padding:0 12px;font:inherit;font-size:15px;font-weight:600;color:var(--brand-text);background:transparent}
.url-in:focus-visible{outline:none}
.sform .btn{margin-top:8px;white-space:normal;height:auto;min-height:48px;padding:12px 24px;text-align:center}
.sform .btn{display:block;gap:0}
.sform .btn span{font-weight:700}
.fine{font-size:13px;color:var(--faint);line-height:1.7;text-align:center}
.fine a{color:var(--muted)}

/* Footer */
.footer{border-top:1px solid var(--line);background:#fff}
.footer-inner{max-width:1200px;margin:0 auto;padding:28px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.fl{font-size:13px;color:var(--muted)}
.fl a{color:var(--ink);text-decoration:none;font-weight:600}
.fr{display:flex;gap:20px;flex-wrap:wrap}
.fr a{font-size:13px;color:var(--muted);text-decoration:none;transition:color .15s}
.fr a:hover{color:var(--ink)}

/* Wizard */
.wz-overlay{position:fixed;inset:0;z-index:9000;background:var(--bg);overflow-y:auto;animation:fadeIn .2s ease both}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.wz-wrap{max-width:640px;margin:0 auto;padding:24px 16px 64px}
.wz-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.wz-close{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--muted);display:grid;place-items:center;transition:background .15s,color .15s}
.wz-close:hover{background:var(--line-soft);color:var(--ink)}
.wz-card{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:36px 36px 32px}
.wz-progress{margin-bottom:32px}
.wz-progress-row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px}
.wz-step{font-weight:600;color:var(--ink)}
.wz-pct{color:var(--muted)}
.wz-bar{height:6px;border-radius:999px;background:var(--line-soft);overflow:hidden}
.wz-bar-fill{height:100%;border-radius:999px;background:var(--brand);transition:width .4s ease}
.ws{animation:fadeUp .3s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ws-tag{font-size:13px;font-weight:600;color:var(--brand-text);margin-bottom:8px}
.ws-h{font-size:clamp(24px,4.5vw,30px);line-height:1.2;font-weight:800;letter-spacing:-.025em;color:var(--ink);margin-bottom:10px}
.ws-p{font-size:15px;color:var(--muted);line-height:1.65;margin-bottom:28px}
.ws-p strong{color:var(--ink);font-weight:600}
.wf{margin-bottom:18px;min-width:0}
.wl{display:block;font-size:14px;font-weight:600;color:var(--ink);margin-bottom:8px}
.req{color:var(--danger)}
.w-hint{font-size:13px;color:var(--muted);margin-top:8px;line-height:1.5}
.w-hint .ok{color:var(--success);font-weight:600}
.w-hint .bad{color:var(--danger);font-weight:600}
.wchips{display:flex;flex-wrap:wrap;gap:8px}
.wc{padding:10px 16px;border:1px solid var(--line);border-radius:999px;background:#fff;font-size:14px;font-weight:500;color:var(--body);cursor:pointer;user-select:none;transition:border-color .15s,background .15s,color .15s}
.wc:hover{border-color:#c7cbd1}
.wc.on{border-color:var(--brand);background:var(--tint);color:var(--brand-text);font-weight:600}
.wc.day{min-width:56px;text-align:center}
.w-actions{display:flex;gap:10px;margin-top:28px}
.w-actions .grow{flex:1}
.w-svc-row{display:flex;gap:8px;margin-bottom:8px;align-items:flex-end}
.w-svc-name{flex:1;min-width:0}
.w-svc-num{width:76px;flex-shrink:0}
.w-svc-lbl{font-size:12px;font-weight:500;color:var(--muted);margin-bottom:6px}
.w-x{width:40px;height:46px;flex-shrink:0;border-radius:8px;border:1px solid var(--line);background:#fff;color:var(--muted);font-size:20px;line-height:1;transition:color .15s,border-color .15s}
.w-x:hover{color:var(--danger);border-color:#fecaca}
.w-add{width:100%;margin-top:6px;height:44px;border-radius:8px;border:1px dashed #cfd3d9;background:#fafbfc;color:var(--brand-text);font-size:14px;font-weight:600;transition:border-color .15s,background .15s}
.w-add:hover{border-color:var(--brand);background:var(--tint)}
.w-drop{position:relative;border:1.5px dashed #cfd3d9;border-radius:12px;background:#fafbfc;padding:28px 16px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s}
.w-drop:hover{border-color:var(--brand);background:var(--tint)}
.w-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.w-drop-icon{width:44px;height:44px;border-radius:12px;background:#fff;border:1px solid var(--line);color:var(--brand-text);display:grid;place-items:center;margin:0 auto 10px}
.w-drop-text{font-size:14px;color:var(--body)}
.w-swatches{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.w-swatch{width:34px;height:34px;border-radius:50%;border:1px solid rgba(0,0,0,.08);transition:transform .15s,box-shadow .15s}
.w-swatch:hover{transform:scale(1.06)}
.w-swatch.on{box-shadow:0 0 0 2px #fff,0 0 0 4px var(--ink)}
.w-color-row{display:flex;align-items:center;gap:10px}
.w-color-preview{width:46px;height:46px;border-radius:8px;border:1px solid var(--line);flex-shrink:0}
.w-hours{display:flex;align-items:center;gap:10px}
.w-hours .wi{flex:1;min-width:0}
.w-to{color:var(--muted);font-size:14px}
.w-two{display:flex;gap:12px}
.w-two .wf{flex:1}
.w-review{border:1px solid var(--line);border-radius:12px;padding:20px;margin:8px 0 16px}
.w-review-head{display:flex;align-items:center;gap:14px;padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid var(--line)}
.w-review-logo{width:44px;height:44px;border-radius:10px;flex-shrink:0;display:grid;place-items:center;color:#fff;font-weight:800;font-size:18px;overflow:hidden;border:1px solid rgba(0,0,0,.06)}
.w-review-logo img{width:100%;height:100%;object-fit:contain;background:#fff}
.w-review-name{font-weight:700;font-size:16px;color:var(--ink)}
.w-review-url{font-size:13px;color:var(--brand-text);font-weight:500;margin-top:2px;word-break:break-all}
.w-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px}
.w-k{font-size:12px;font-weight:500;color:var(--muted);margin-bottom:2px}
.w-v{font-size:14px;color:var(--ink);font-weight:500}
.w-checklist{list-style:none;border:1px solid var(--line);border-radius:12px;margin-bottom:16px;overflow:hidden}
.w-checklist li{padding:12px 16px;border-bottom:1px solid var(--line-soft);font-size:14px;color:var(--body);display:flex;align-items:center;gap:10px}
.w-checklist li:last-child{border-bottom:none}
.w-check{width:20px;height:20px;border-radius:50%;background:#dcfce7;color:var(--success);font-size:12px;font-weight:700;display:grid;place-items:center;flex-shrink:0}
.w-note{background:var(--tint);border-radius:10px;padding:14px 16px;font-size:14px;color:var(--body);line-height:1.6;margin-bottom:20px}
.w-note strong{color:var(--ink)}
.w-done{text-align:center;padding:16px 0 8px}
.w-done-icon{width:64px;height:64px;border-radius:50%;background:#dcfce7;color:var(--success);display:grid;place-items:center;margin:0 auto 18px}
.w-done-title{font-size:28px;font-weight:800;letter-spacing:-.025em;color:var(--ink);margin-bottom:6px}
.w-done-url{font-size:15px;font-weight:600;color:var(--brand-text);margin-bottom:14px;word-break:break-all}
.w-done-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}

@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  .booking-shell,.ws,.wz-overlay{animation:none}
}
@media (max-width:980px){
  .hero-mascot{display:none}
  .hero{grid-template-columns:minmax(0,1fr);gap:48px;padding-top:48px}
  .hero-right{max-width:620px;width:100%;margin:0 auto}
  .feat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .price-grid{grid-template-columns:minmax(0,1fr);max-width:440px;gap:28px}
  .nav-links{display:none}
}
@media (max-width:640px){
  .nav-inner{padding:0 16px;height:60px}
  .nav-signin{display:none}
  .logo-sub{display:none}
  .hero{padding:36px 16px 56px}
  .hero-sub{font-size:16px}
  .hero-btns .btn{flex:1}
  .booking-body{grid-template-columns:minmax(0,1fr)}
  .demo-side{border-right:none;border-bottom:1px solid var(--line);padding:16px}
  .biz-info{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .biz-logo{margin-bottom:0}
  .ai-pill{margin-top:0}
  .svc-list{flex-direction:row;overflow-x:auto;scrollbar-width:none}
  .svc-list::-webkit-scrollbar{display:none}
  .svc-item{flex:0 0 auto;min-width:150px}
  .demo-cal{padding:16px}
  .dc{width:30px;height:30px;font-size:12px}
  .section{padding:64px 16px}
  .sec-head{margin-bottom:32px}
  .feat-grid{grid-template-columns:minmax(0,1fr);gap:14px}
  .feat{padding:22px}
  .signup-card{padding:32px 20px;border-radius:14px}
  .frow{flex-direction:column;gap:16px}
  .footer-inner{flex-direction:column;align-items:flex-start;padding:24px 16px}
  .wz-card{padding:24px 18px 22px;border-radius:14px}
  .w-svc-num{width:64px}
  .w-review-grid{grid-template-columns:minmax(0,1fr)}
  .w-done-btns .btn{width:100%}
}
`;
