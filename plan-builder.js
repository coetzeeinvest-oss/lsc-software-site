/* LiftMe plan builder. Loaded only on build-your-own-plan.html.
 *
 * Everything that costs money lives in RATES and FEATURES below. The rate card on the
 * page, the running estimate, the result screen and the email are all generated from
 * them, so changing a price here changes it everywhere.
 *
 * FEATURES mirrors the feature switches a Super Admin turns on per client in the LiftMe
 * app (FeatureFlag in LiftMe.Database/Tenancy/FeatureFlag.cs, wording in the Super Admin
 * feature-meta.ts). When a new flag is added there, add it here too.
 *
 * Set by the owner (2026-11-26): Live tracking R199 + R25 per vehicle (so R399 at 8 vehicles),
 * Invoicing R99, Driver navigation R49, Driver transfers and Off Season free, priority support
 * R249 (email support is free, with replies within 48 hours), R100 off for a single vehicle,
 * and children and schools never change the price. Client risk R99 was confirmed fine. Still
 * assumed, not confirmed: the R499 platform price (matches Bakkie), R45 per extra vehicle and
 * the R79 full theme and fonts.
 */
(() => {
  'use strict';

  const card = document.getElementById('pb-card');
  const headEl = document.getElementById('pb-head');
  const stage = document.getElementById('pb-stage');
  const navEl = document.getElementById('pb-nav');
  const resultEl = document.getElementById('pb-result');
  const ratesEl = document.getElementById('pb-rates');
  if (!card || !headEl || !stage || !navEl || !resultEl) return;

  const EMAIL = 'liftme.demo@gmail.com';
  const WHATSAPP = '27748606814';
  const STORE_KEY = 'liftme-plan-builder-v1';
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- Rates ---------- */

  const RATES = {
    platform: 499,            // per month: scheduling, parent portal, notifications, branded subdomain, logo + accent colour
    includedVehicles: 2,
    extraVehicle: 45,         // per vehicle beyond the included ones
    singleVehicleDiscount: 100, // taken off the total when there is exactly one vehicle
    fullBranding: 79,         // full theme and fonts, instead of logo + accent colour
    prioritySupport: 249,     // personal support, instead of email support (free, replies within 48 hours)
    annualMonthsPaid: 10,     // annual billing: pay 10 months, get 12
  };

  // Children and schools are asked about for context only: they never change the price.
  const LIMITS = { vehicles: 500, children: 5000, schools: 50 };

  // Each feature costs `price` a month, plus `perVehicle` for every vehicle if set. 0 means free.
  const FEATURES = [
    {
      key: 'LiveTracking', label: 'Live tracking', icon: 'ph-pin', tone: 'sky', price: 199, perVehicle: 25,
      desc: 'Parents and admins watch each vehicle move on a live map once the driver starts a trip.',
      suggest: (s) => s.vehicles >= 3 || s.children >= 50,
      why: (s) => (s.vehicles >= 3
        ? `With ${s.vehicles} vehicles on the road, parents will want to see where each one is.`
        : `With ${s.children} children, that is a lot of "where is the car?" messages.`),
    },
    {
      key: 'Invoicing', label: 'Invoicing', icon: 'ph-receipt', tone: 'mint', price: 99,
      desc: 'Create VAT-ready invoices for your clients straight from completed trips.',
      suggest: (s) => s.children >= 30,
      why: (s) => `Billing ${s.children} children's families by hand adds up. Invoices come from completed trips.`,
    },
    {
      key: 'ClientRisk', label: 'Client risk', icon: 'ph-shield-check', tone: 'lilac', price: 99,
      desc: 'Ranks parents by late pickups, late arrivals and cancellations, so you know who to phone first.',
      suggest: (s) => s.children >= 250,
      why: (s) => `With ${s.children} children, it helps to know which parents need a nudge.`,
    },
    {
      key: 'DriverTransfers', label: 'Driver transfers', icon: 'icon-swap', tone: 'peach', price: 0,
      desc: 'Drivers can hand children to another driver mid-trip, and parents are notified automatically. Free, because some operators simply work this way.',
      suggest: (s) => s.vehicles >= 5,
      why: (s) => `With ${s.vehicles} vehicles, drivers will sometimes need to hand a child over.`,
    },
    {
      key: 'DriverNavigation', label: 'Driver navigation', icon: 'ph-compass', tone: 'teal', price: 49,
      desc: "A route map built into the driver's app, so they don't have to switch to Google Maps.",
      suggest: (s) => s.vehicles >= 10,
      why: () => 'Handy when you have a bigger team and not every driver knows every street.',
    },
    {
      key: 'OffSeason', label: 'Off Season', icon: 'ph-sun', tone: 'amber', price: 0,
      desc: 'Parents book one-off event lifts outside the school run, and you accept or decline them.',
      suggest: (s) => s.vehicles >= 2,
      why: (s) => `Your ${s.vehicles} vehicles could keep earning through the school holidays.`,
    },
  ];

  const ALWAYS_INCLUDED = [
    'Scheduling and dispatch',
    'Parent portal',
    'Automatic notifications',
    'Your own branded subdomain',
    'Public quote calculator for new parents',
    'No setup fee',
  ];

  // What the ready-made plans on pricing.html cover, used to say when one of them is cheaper.
  const PLANS = [
    { name: 'Bakkie', price: 499, maxVehicles: 2, features: [], fullBranding: false, prioritySupport: false, perSchoolInvoicing: false },
    { name: 'Fleet', price: 1299, maxVehicles: 8, features: ['LiveTracking', 'Invoicing'], fullBranding: true, prioritySupport: false, perSchoolInvoicing: false },
    { name: 'Depot', price: 2799, maxVehicles: Infinity, features: ['LiveTracking', 'Invoicing'], fullBranding: true, prioritySupport: true, perSchoolInvoicing: true },
  ];

  const BRANDING = {
    basic: { label: 'Logo and accent colour', desc: 'Your logo and an accent colour on every screen.' },
    full: { label: 'Full theme and fonts', desc: 'A full colour theme and font, so parents see your business, not ours.' },
  };
  const SUPPORT = {
    email: { label: 'Email support', desc: 'Send us a message and we reply within 48 hours.' },
    priority: { label: 'Priority support', desc: 'Personal support, with replies as soon as possible.' },
  };

  /* ---------- Small helpers ---------- */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const money = (n) => (n < 0 ? '-' : '') + 'R' + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const byKey = (key) => FEATURES.find((f) => f.key === key);
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const FILL_ICON = /^(ph-|icon-wa$)/;
  const icon = (id, extra) => `<svg class="${FILL_ICON.test(id) ? 'icon-duo' : 'icon'}${extra ? ' ' + extra : ''}" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;

  const featurePrice = (f, s) => f.price + (f.perVehicle || 0) * s.vehicles;
  const priceText = (n) => (n === 0 ? 'Free' : money(n));
  const suggestedKeys = (s) => FEATURES.filter((f) => f.suggest(s)).map((f) => f.key);

  // Every suggested feature is tagged "Suggested", but only the free and low-cost ones start switched on,
  // so the "so far" total doesn't leap the moment someone reaches the features question.
  const PRESELECT_MAX_PRICE = 99;
  const isPreselected = (f, s) => f.suggest(s) && featurePrice(f, s) <= PRESELECT_MAX_PRICE;
  const preselectedKeys = (s) => FEATURES.filter((f) => isPreselected(f, s)).map((f) => f.key);

  /* ---------- Counter questions ---------- */

  const COUNTERS = {
    vehicles: {
      min: 1, max: LIMITS.vehicles, sliderMin: 1, sliderMax: 40, sliderStep: 1, nudge: 1,
      chips: [1, 2, 4, 8, 15, 25], icon: 'ph-bus', cap: 12, one: 'vehicle', many: 'vehicles',
      title: 'How many vehicles are on the road?',
      lede: 'Count every car, bakkie, minibus or bus that does a school run.',
      insight: (s) => {
        if (s.vehicles === 1) return `Just one vehicle? We take ${money(RATES.singleVehicleDiscount)} off your monthly total, and you'll see it in your price.`;
        if (s.vehicles <= 2) return 'Bakkie-sized: our Bakkie plan covers up to 2 vehicles.';
        if (s.vehicles <= 8) return 'Fleet-sized: our Fleet plan covers up to 8 vehicles.';
        return 'Depot-sized: our Depot plan covers unlimited vehicles.';
      },
    },
    children: {
      min: 1, max: LIMITS.children, sliderMin: 5, sliderMax: 600, sliderStep: 5, nudge: 5,
      chips: [20, 50, 100, 250, 500], icon: 'ph-student', cap: 24, one: 'child', many: 'children',
      title: 'How many children do you transport?',
      lede: 'Every child you collect and drop off, across all your vehicles.',
      insight: (s) => {
        const per = Math.max(1, Math.round(s.children / s.vehicles));
        return `About ${plural(per, 'child', 'children')} per vehicle. The number of children doesn't change your price, it just helps us understand your operation.`;
      },
    },
    schools: {
      min: 1, max: LIMITS.schools, sliderMin: 1, sliderMax: 15, sliderStep: 1, nudge: 1,
      chips: [1, 2, 3, 5, 8, 12], icon: 'ph-graduation-cap', cap: 15, one: 'school', many: 'schools',
      title: 'How many schools do you serve?',
      lede: 'Count every school your children are collected from or dropped at.',
      insight: () => "Parents pick their school on your public quote calculator. The number of schools doesn't change your price, it's just good for us to know.",
    },
  };

  const STEPS = ['vehicles', 'children', 'schools', 'features', 'finish'];
  const RESULT = STEPS.length;

  /* ---------- State ---------- */

  const freshState = () => ({
    step: 0, vehicles: 3, children: 60, schools: 1,
    features: [], featuresTouched: false,
    branding: 'basic', support: 'email', billing: 'monthly',
    name: '', business: '', phone: '',
  });

  function sanitize(raw) {
    const s = freshState();
    if (!raw || typeof raw !== 'object') return s;
    const num = (v, min, max, fallback) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? clamp(n, min, max) : fallback;
    };
    s.step = num(raw.step, 0, RESULT, 0);
    s.vehicles = num(raw.vehicles, 1, LIMITS.vehicles, s.vehicles);
    s.children = num(raw.children, 1, LIMITS.children, s.children);
    s.schools = num(raw.schools, 1, LIMITS.schools, s.schools);
    s.features = Array.isArray(raw.features) ? raw.features.filter((k) => !!byKey(k)) : [];
    s.featuresTouched = raw.featuresTouched === true;
    s.branding = raw.branding === 'full' ? 'full' : 'basic';
    s.support = raw.support === 'priority' ? 'priority' : 'email';
    s.billing = raw.billing === 'annual' ? 'annual' : 'monthly';
    return s;
  }

  function loadState() {
    try {
      const saved = window.sessionStorage.getItem(STORE_KEY);
      return sanitize(saved ? JSON.parse(saved) : null);
    } catch (e) {
      return freshState();
    }
  }

  // Contact details are typed just before sending, so they are deliberately not stored.
  function persist() {
    try {
      const { name, business, phone, ...rest } = state;
      window.sessionStorage.setItem(STORE_KEY, JSON.stringify(rest));
    } catch (e) { /* storage blocked: the builder still works, it just forgets on reload */ }
  }

  let state = loadState();
  let calcTimer = null;
  let lastEstimate = NaN;

  /* ---------- Pricing ---------- */

  function quote(s) {
    const lines = [];
    lines.push({
      label: 'LiftMe platform',
      note: `Includes up to ${plural(RATES.includedVehicles, 'vehicle', 'vehicles')}`,
      amount: RATES.platform,
    });
    const xv = Math.max(0, s.vehicles - RATES.includedVehicles);
    if (xv) lines.push({ label: 'Extra vehicles', note: `${xv} x ${money(RATES.extraVehicle)}`, amount: xv * RATES.extraVehicle });
    FEATURES.filter((f) => s.features.includes(f.key)).forEach((f) => {
      const price = featurePrice(f, s);
      const note = !price ? 'No charge' : f.perVehicle ? `${money(f.price)} + ${s.vehicles} x ${money(f.perVehicle)}` : 'Flat monthly fee';
      lines.push({ label: f.label, note, amount: price });
    });
    if (s.branding === 'full') lines.push({ label: BRANDING.full.label, note: 'Instead of logo and accent colour', amount: RATES.fullBranding });
    if (s.support === 'priority') lines.push({ label: SUPPORT.priority.label, note: 'Instead of email support', amount: RATES.prioritySupport });
    if (s.vehicles === 1) lines.push({ label: 'Single-vehicle discount', note: 'One vehicle on the road', amount: -RATES.singleVehicleDiscount, discount: true });

    const monthly = lines.reduce((sum, l) => sum + l.amount, 0);
    const annualPerMonth = Math.round((monthly * RATES.annualMonthsPaid) / 12);
    return {
      lines,
      monthly,
      annualPerMonth,
      yearly: monthly * RATES.annualMonthsPaid,
      annualDiscount: monthly - annualPerMonth,
      yearlySaving: monthly * 12 - monthly * RATES.annualMonthsPaid,
    };
  }

  // The cheapest ready-made plan that covers everything picked, if it beats the custom total.
  function cheaperPlan(s, q) {
    const covers = (p) =>
      s.vehicles <= p.maxVehicles &&
      s.features.every((k) => p.features.includes(k)) &&
      (s.branding === 'basic' || p.fullBranding) &&
      (s.support === 'email' || p.prioritySupport) &&
      (!s.features.includes('Invoicing') || s.schools === 1 || p.perSchoolInvoicing);
    return PLANS.filter((p) => covers(p) && p.price < q.monthly).sort((a, b) => a.price - b.price)[0] || null;
  }

  /* ---------- Email / WhatsApp text ---------- */

  function planText(s, q, compact) {
    const picked = FEATURES.filter((f) => s.features.includes(f.key));
    const L = [
      'Hi LiftMe team,', '',
      "I built a plan on liftme.co.za and I'd like to talk about it.", '',
      'ABOUT ME',
      `Name: ${s.name}`,
      `Business: ${s.business}`,
      `Phone: ${s.phone}`, '',
      'MY FLEET',
      `Vehicles: ${s.vehicles}`,
      `Children: ${s.children}`,
      `Schools: ${s.schools}`, '',
      'FEATURES I PICKED',
    ];
    if (picked.length) picked.forEach((f) => L.push(`- ${f.label}`));
    else L.push('- None, just the core platform');
    L.push(`Look: ${BRANDING[s.branding].label}`, `Support: ${SUPPORT[s.support].label}`, '');
    L.push('MY PRICE');
    if (!compact) q.lines.forEach((l) => L.push(`${l.label}: ${priceText(l.amount)}`));
    if (s.billing === 'annual') {
      L.push(`Total: ${money(q.annualPerMonth)} per month, billed yearly (${money(q.yearly)} a year, 2 months free)`);
    } else {
      L.push(`Total: ${money(q.monthly)} per month, billed monthly`);
    }
    L.push('', 'Please confirm my plan and price, and the next steps.', '', 'Thank you,');
    if (s.name) L.push(s.name);
    return L;
  }

  function mailtoUrl(s, q) {
    const who = s.business || s.name;
    const subject = who
      ? `LiftMe custom plan for ${who}: ${money(s.billing === 'annual' ? q.annualPerMonth : q.monthly)}/month`
      : `LiftMe custom plan: ${plural(s.vehicles, 'vehicle', 'vehicles')}, ${s.children} children (${money(s.billing === 'annual' ? q.annualPerMonth : q.monthly)}/month)`;
    const build = (compact) => `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(planText(s, q, compact).join('\n'))}`;
    const full = build(false);
    // Some mail apps drop very long links, so fall back to a shorter body.
    return full.length > 1900 ? build(true) : full;
  }

  function whatsappUrl(s, q) {
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(planText(s, q, false).join('\n'))}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  /* ---------- Animated money ---------- */

  function setMoney(el, to) {
    if (!el) return;
    const from = el.dataset.v ? Number(el.dataset.v) : NaN;
    el.dataset.v = String(to);
    const token = (el._pbTween = (el._pbTween || 0) + 1);
    if (reduceMotion || !Number.isFinite(from) || from === to) {
      el.textContent = money(to);
      return;
    }
    const start = performance.now();
    const frame = (now) => {
      if (el._pbTween !== token) return;
      const p = Math.min(1, (now - start) / 380);
      el.textContent = money(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ---------- Header and navigation ---------- */

  function paintHead() {
    if (card.dataset.view === 'calc') {
      headEl.innerHTML = `<ol class="pb-steps" aria-label="Progress">${STEPS.map(() => '<li class="pb-seg is-done"></li>').join('')}</ol>
        <div class="pb-head-row"><span class="pb-step-label">All done</span></div>`;
      return;
    }
    const n = state.step;
    const segs = STEPS.map((id, i) => {
      const cls = i < n ? 'is-done' : i === n ? 'is-current' : '';
      return `<li class="pb-seg ${cls}"${i === n ? ' aria-current="step"' : ''}></li>`;
    }).join('');
    headEl.innerHTML = `<ol class="pb-steps" aria-label="Progress">${segs}</ol>
      <div class="pb-head-row">
        <span class="pb-step-label">Question ${n + 1} of ${STEPS.length}</span>
        <span class="pb-so-far"><span>So far</span> <strong id="pb-estimate" data-v=""></strong><span>/ month</span></span>
      </div>`;
    // Carry the last figure across steps so the number rolls from it instead of jumping.
    const el = $('#pb-estimate');
    if (Number.isFinite(lastEstimate)) el.dataset.v = String(lastEstimate);
    paintEstimate();
  }

  function paintEstimate() {
    const total = quote(state).monthly;
    lastEstimate = total;
    setMoney($('#pb-estimate'), total);
  }

  function paintNav() {
    const last = state.step === STEPS.length - 1;
    const hint = state.step === 0 ? 'Takes about a minute.' : '';
    navEl.innerHTML = `
      ${state.step > 0 ? `<button type="button" class="btn btn-ghost" data-act="back">${icon('ph-arrow-left')} Back</button>` : '<span></span>'}
      <span class="pb-hint">${hint}</span>
      <button type="button" class="btn btn-amber btn-lg" data-act="next">${last ? 'Show my price' : 'Continue'} ${icon('ph-arrow-right')}</button>`;
  }

  /* ---------- Question screens ---------- */

  function counterStep(key, dir) {
    const c = COUNTERS[key];
    const chips = c.chips.map((n) => `<button type="button" class="pb-chip" data-set="${n}">${n}</button>`).join('');
    return `
      <div class="pb-q ${dir}" data-step="${key}">
        <h2 class="pb-q-title" tabindex="-1" data-focus>${c.title}</h2>
        <p class="pb-q-lede">${c.lede}</p>
        <div class="pb-counter">
          <button type="button" class="pb-round" data-nudge="-1" aria-label="${c.nudge === 1 ? `One fewer ${c.one}` : `${c.nudge} fewer ${c.many}`}">${icon('icon-minus')}</button>
          <label class="pb-num">
            <input id="pb-input" class="pb-input" type="number" inputmode="numeric" min="${c.min}" max="${c.max}" step="1" value="${state[key]}" autocomplete="off" aria-label="Number of ${c.many}">
            <span class="pb-unit" id="pb-unit"></span>
          </label>
          <button type="button" class="pb-round" data-nudge="1" aria-label="${c.nudge === 1 ? `One more ${c.one}` : `${c.nudge} more ${c.many}`}">${icon('icon-plus')}</button>
        </div>
        <input id="pb-range" class="pb-range" type="range" min="${c.sliderMin}" max="${c.sliderMax}" step="${c.sliderStep}" value="${clamp(state[key], c.sliderMin, c.sliderMax)}" aria-label="Slide to set the number of ${c.many}">
        <div class="pb-chips" role="group" aria-label="Quick picks">${chips}</div>
        <div class="pb-crowd" id="pb-crowd" aria-hidden="true"></div>
        <p class="pb-crowd-note" id="pb-crowd-note"></p>
        <p class="pb-insight" id="pb-insight"></p>
      </div>`;
  }

  function paintCounter(key) {
    const c = COUNTERS[key];
    const v = state[key];
    const input = $('#pb-input');
    const range = $('#pb-range');
    if (input) input.style.width = `${Math.max(2, String(input.value || v).length) + 0.5}ch`;
    const unit = $('#pb-unit');
    if (unit) unit.textContent = v === 1 ? c.one : c.many;
    if (range) {
      range.value = clamp(v, c.sliderMin, c.sliderMax);
      range.style.setProperty('--pb-fill', `${((clamp(v, c.sliderMin, c.sliderMax) - c.sliderMin) / (c.sliderMax - c.sliderMin)) * 100}%`);
    }
    stage.querySelectorAll('.pb-chip').forEach((chip) => chip.classList.toggle('is-on', Number(chip.dataset.set) === v));

    const crowd = $('#pb-crowd');
    if (crowd) {
      const units = [1, 2, 5, 10, 20, 25, 50, 100, 250, 500, 1000];
      const unitSize = units.find((u) => Math.ceil(v / u) <= c.cap) || 1000;
      const want = Math.max(1, Math.ceil(v / unitSize));
      if (crowd.dataset.unit !== String(unitSize)) { crowd.innerHTML = ''; crowd.dataset.unit = String(unitSize); }
      while (crowd.children.length > want) crowd.lastElementChild.remove();
      // Stagger the first fill; a single icon added while sliding should appear at once.
      const bulk = crowd.children.length === 0;
      while (crowd.children.length < want) {
        const item = document.createElement('span');
        item.className = 'pb-crowd-item';
        item.style.setProperty('--i', bulk ? String(crowd.children.length) : '0');
        item.innerHTML = icon(c.icon);
        crowd.appendChild(item);
      }
      const note = $('#pb-crowd-note');
      if (note) note.textContent = unitSize > 1 ? `Each icon stands for ${unitSize} ${c.many}` : '';
    }
    const insight = $('#pb-insight');
    if (insight) {
      insight.textContent = c.insight(state);
      insight.classList.toggle('is-good', key === 'vehicles' && v === 1);
    }
  }

  function setCounter(key, raw, fromTyping) {
    const c = COUNTERS[key];
    state[key] = clamp(Math.round(raw), c.min, c.max);
    const input = $('#pb-input');
    if (input && !fromTyping) input.value = state[key];
    paintCounter(key);
    persist();
    paintEstimate();
  }

  function featureCard(f, s, compact) {
    const on = s.features.includes(f.key);
    const suggested = f.suggest(s);
    return `
      <button type="button" class="pb-feat${on ? ' is-on' : ''}" data-feature="${f.key}" aria-pressed="${on}">
        <span class="pb-feat-ic tone-${f.tone}" aria-hidden="true">${icon(f.icon)}</span>
        <span class="pb-feat-body">
          <span class="pb-feat-top"><span class="pb-feat-name">${f.label}</span>${suggested ? '<span class="pb-feat-tag">Suggested</span>' : ''}</span>
          <span class="pb-feat-desc">${f.desc}</span>
          ${!compact && suggested ? `<span class="pb-feat-why">${esc(f.why(s))}</span>` : ''}
        </span>
        <span class="pb-feat-side">
          <span class="pb-feat-price${featurePrice(f, s) === 0 ? ' is-free' : ''}">${priceText(featurePrice(f, s))}${featurePrice(f, s) === 0 ? '' : '<small>/ month</small>'}</span>
          <span class="pb-switch" aria-hidden="true"></span>
        </span>
      </button>`;
  }

  function featuresLede() {
    if (state.featuresTouched) return 'Tap any card to switch it on or off. The price updates as you go.';
    const base = `With ${plural(state.vehicles, 'vehicle', 'vehicles')} and ${plural(state.children, 'child', 'children')}, these are the ones that usually suit you.`;
    const heldBack = FEATURES.some((f) => f.suggest(state) && !isPreselected(f, state));
    return heldBack
      ? `${base} We've switched on the free and low-cost ones. Anything tagged Suggested that's still off costs more, so that one is your call: tap it to add it.`
      : `${base} We've switched them on. Tap any card to change that.`;
  }

  function featuresStep(dir) {
    return `
      <div class="pb-q ${dir}" data-step="features">
        <h2 class="pb-q-title" tabindex="-1" data-focus>Which features would you actually use?</h2>
        <p class="pb-q-lede" id="pb-feat-lede">${esc(featuresLede())}</p>
        <div class="pb-feat-tools">
          <button type="button" class="btn-link" data-act="suggested">Use our suggestions</button>
          <button type="button" class="btn-link" data-act="clear">Clear all</button>
        </div>
        <div class="pb-feat-grid">${FEATURES.map((f) => featureCard(f, state, false)).join('')}</div>
        <div class="pb-always">
          <strong>Always included</strong>
          <ul>${ALWAYS_INCLUDED.map((t) => `<li>${icon('ph-check-circle')}${t}</li>`).join('')}</ul>
        </div>
      </div>`;
  }

  function choiceGroup(name, legend, options, current, prices) {
    return `
      <fieldset class="pb-fieldset">
        <legend>${legend}</legend>
        <div class="pb-choices">
          ${Object.keys(options).map((k) => `
            <label class="pb-choice">
              <input type="radio" name="${name}" value="${k}"${current === k ? ' checked' : ''}>
              <span class="pb-choice-card">
                <span class="pb-choice-body"><strong>${options[k].label}</strong><span>${options[k].desc}</span></span>
                <span class="pb-choice-price">${prices[k]}</span>
              </span>
            </label>`).join('')}
        </div>
      </fieldset>`;
  }

  function finishStep(dir) {
    return `
      <div class="pb-q ${dir}" data-step="finish">
        <h2 class="pb-q-title" tabindex="-1" data-focus>Last two choices</h2>
        <p class="pb-q-lede">How your business looks to parents, and how quickly you want help when you need it.</p>
        ${choiceGroup('pb-branding', `${icon('ph-palette')} How should it look?`, BRANDING, state.branding, { basic: 'Included', full: `+${money(RATES.fullBranding)} / month` })}
        ${choiceGroup('pb-support', `${icon('ph-rocket-launch')} How fast should we answer?`, SUPPORT, state.support, { email: 'Included', priority: `+${money(RATES.prioritySupport)} / month` })}
      </div>`;
  }

  function renderQuestion(dir, userDriven) {
    const id = STEPS[state.step];
    const d = dir === 'back' ? 'from-left' : 'from-right';
    card.hidden = false;
    resultEl.hidden = true;
    resultEl.innerHTML = '';
    card.dataset.view = 'question';

    if (id === 'features' && !state.featuresTouched) state.features = preselectedKeys(state);

    stage.innerHTML = COUNTERS[id] ? counterStep(id, d) : id === 'features' ? featuresStep(d) : finishStep(d);
    paintHead();
    paintNav();
    if (COUNTERS[id]) paintCounter(id);
    persist();

    if (userDriven) {
      const h = $('[data-focus]', stage);
      if (h) h.focus({ preventScroll: true });
      bringIntoView(card);
    }
  }

  function bringIntoView(el) {
    const top = el.getBoundingClientRect().top;
    if (top < 90 || top > window.innerHeight * 0.45) {
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /* ---------- Moving between screens ---------- */

  function next() {
    if (state.step >= STEPS.length - 1) { startCalc(); return; }
    state.step += 1;
    renderQuestion('fwd', true);
  }

  function back() {
    if (state.step <= 0) return;
    state.step -= 1;
    renderQuestion('back', true);
  }

  function goTo(step) {
    clearTimeout(calcTimer);
    state.step = clamp(step, 0, STEPS.length - 1);
    renderQuestion('back', true);
  }

  function startOver() {
    clearTimeout(calcTimer);
    const keep = { name: state.name, business: state.business, phone: state.phone };
    state = Object.assign(freshState(), keep);
    renderQuestion('back', true);
  }

  function startCalc() {
    state.step = RESULT;
    persist();
    card.hidden = false;
    resultEl.hidden = true;
    card.dataset.view = 'calc';
    paintHead();
    navEl.innerHTML = '';
    const steps = [
      `Counting ${plural(state.vehicles, 'vehicle', 'vehicles')}`,
      `Fitting ${plural(state.children, 'child', 'children')} on board`,
      state.features.length ? `Switching on ${plural(state.features.length, 'feature', 'features')}` : 'Keeping it simple, no extra features',
      'Working out your price',
    ];
    stage.innerHTML = `
      <div class="pb-q pb-calc from-right" role="status">
        <h2 class="pb-q-title" tabindex="-1" data-focus>Building your plan</h2>
        <div class="pb-loading" aria-hidden="true"><span class="eyebrow">Loading...</span></div>
        <ul class="pb-calc-list">${steps.map((t) => `<li>${icon('ph-check-circle')}<span>${esc(t)}</span></li>`).join('')}</ul>
      </div>`;
    const h = $('[data-focus]', stage);
    if (h) h.focus({ preventScroll: true });
    bringIntoView(card);

    if (reduceMotion) { renderResult(true); return; }
    const items = stage.querySelectorAll('.pb-calc-list li');
    let i = 0;
    const tick = () => {
      if (i < items.length) {
        items[i].classList.add('is-on');
        i += 1;
        calcTimer = setTimeout(tick, 330);
      } else {
        calcTimer = setTimeout(() => renderResult(true), 420);
      }
    };
    tick();
  }

  /* ---------- Result screen ---------- */

  function recapChips() {
    const chips = [
      { step: 0, icon: 'ph-bus', text: plural(state.vehicles, 'vehicle', 'vehicles') },
      { step: 1, icon: 'ph-student', text: plural(state.children, 'child', 'children') },
      { step: 2, icon: 'ph-graduation-cap', text: plural(state.schools, 'school', 'schools') },
      { step: 4, icon: 'ph-palette', text: BRANDING[state.branding].label },
      { step: 4, icon: 'ph-rocket-launch', text: SUPPORT[state.support].label },
    ];
    return chips.map((c) => `<button type="button" class="pb-recap-chip" data-goto="${c.step}" aria-label="Change: ${esc(c.text)}">${icon(c.icon)}<span>${esc(c.text)}</span><em>Change</em></button>`).join('');
  }

  function resultHTML() {
    return `
      <div class="pb-result-head">
        <p class="pb-result-kicker">${icon('ph-check-circle')} Your plan is ready</p>
        <h2 class="pb-result-title" tabindex="-1" data-focus>Here's your price</h2>
        <div class="pb-recap">${recapChips()}</div>
      </div>
      <div class="pb-result-grid">
        <div class="pb-main">
        <section class="pb-price" aria-labelledby="pb-price-h">
          <div class="pb-price-top">
            <p class="pb-price-kicker" id="pb-price-h">${icon('ph-chart-line-up')} Your monthly price</p>
            <div class="pb-price-line"><span class="pb-price-amt" id="pb-amt" data-v=""></span><span class="pb-price-per" id="pb-per"></span></div>
            <p class="pb-price-sub" id="pb-sub"></p>
            <div class="pb-bill" role="group" aria-label="Billing">
              <button type="button" class="pb-bill-btn" data-billing="monthly">Monthly</button>
              <button type="button" class="pb-bill-btn" data-billing="annual">Annual <span class="pb-bill-save">2 months free</span></button>
            </div>
          </div>
          <div class="pb-price-body">
            <h3>Where that comes from</h3>
            <ul class="pb-lines" id="pb-lines"></ul>
            <p class="pb-price-foot">We're open to discussing price. Email us your plan and we'll talk it through.</p>
          </div>
        </section>

        <div class="pb-tip-slot" id="pb-tip"></div>

        <section class="pb-incl" aria-labelledby="pb-incl-h">
          <h3 id="pb-incl-h">What's in your plan</h3>
          <p class="pb-incl-sub">Switch features on or off and the price updates straight away.</p>
          <div class="pb-feat-grid">${FEATURES.map((f) => featureCard(f, state, true)).join('')}</div>
          <h4>Always included</h4>
          <ul class="pb-always-list">${ALWAYS_INCLUDED.map((t) => `<li>${icon('ph-check-circle')}${t}</li>`).join('')}</ul>
        </section>
        </div>

        <aside class="pb-contact" aria-labelledby="pb-contact-h">
          <h3 id="pb-contact-h">Happy with that? Let's talk.</h3>
          <p>We'll open an email with your whole plan already typed out. Add your details, press send, and a person replies to confirm everything. We're open to discussing price too.</p>
          <div class="pb-fields">
            <div class="form-field"><label for="pb-name">Your name</label><input id="pb-name" data-contact="name" autocomplete="name" value="${esc(state.name)}"></div>
            <div class="form-field"><label for="pb-business">Business name</label><input id="pb-business" data-contact="business" autocomplete="organization" value="${esc(state.business)}"></div>
            <div class="form-field"><label for="pb-phone">Phone number</label><input id="pb-phone" data-contact="phone" type="tel" autocomplete="tel" value="${esc(state.phone)}"></div>
          </div>
          <a class="btn btn-dark btn-lg pb-mail" id="pb-mail" href="mailto:${EMAIL}">${icon('ph-envelope-simple')} Email us this plan</a>
          <div class="pb-alt">
            <a class="btn btn-ghost" id="pb-wa" href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">${icon('icon-wa')} WhatsApp</a>
            <button type="button" class="btn btn-ghost" id="pb-copy" data-act="copy">${icon('icon-copy')} <span>Copy details</span></button>
          </div>
          <p class="form-note">Nothing is sent until you press send in your email app. No email app on this device? Use WhatsApp or copy the details.</p>
          <button type="button" class="btn-link pb-restart" data-act="restart">Start over</button>
        </aside>
      </div>`;
  }

  function renderResult(userDriven) {
    clearTimeout(calcTimer);
    state.step = RESULT;
    persist();
    card.hidden = true;
    resultEl.hidden = false;
    resultEl.innerHTML = resultHTML();
    paintResult();
    if (userDriven) {
      const h = $('[data-focus]', resultEl);
      if (h) h.focus({ preventScroll: true });
      bringIntoView(resultEl);
    }
  }

  function paintResult() {
    const q = quote(state);
    const annual = state.billing === 'annual';

    setMoney($('#pb-amt'), annual ? q.annualPerMonth : q.monthly);
    $('#pb-per').textContent = annual ? '/ month, billed yearly' : '/ month';
    $('#pb-sub').textContent = annual
      ? `${money(q.yearly)} billed once a year. You save ${money(q.yearlySaving)} compared with paying monthly.`
      : 'Billed month to month, with no setup fee.';
    resultEl.querySelectorAll('[data-billing]').forEach((b) => {
      const on = b.dataset.billing === state.billing;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });

    const rows = q.lines.map((l) => `<li${l.discount ? ' class="pb-line-save"' : ''}><span class="pb-line-name">${l.label}<small>${esc(l.note)}</small></span><span class="pb-line-amt">${priceText(l.amount)}</span></li>`);
    if (annual) rows.push(`<li class="pb-line-save"><span class="pb-line-name">Annual billing<small>10 months for 12</small></span><span class="pb-line-amt">-${money(q.annualDiscount)}</span></li>`);
    rows.push(`<li class="pb-line-total"><span class="pb-line-name">Total per month</span><span class="pb-line-amt">${money(annual ? q.annualPerMonth : q.monthly)}</span></li>`);
    $('#pb-lines').innerHTML = rows.join('');

    const plan = cheaperPlan(state, q);
    $('#pb-tip').innerHTML = plan
      ? `<div class="pb-tip">${icon('ph-check-circle')}<p><strong>Good news: our ${plan.name} plan already covers everything you picked, for ${money(plan.price)} a month.</strong> That's ${money(q.monthly - plan.price)} less than this custom build. <a href="pricing.html#compare">See what ${plan.name} includes</a>.</p></div>`
      : '';

    paintFeatureStates();
    paintContactLinks();
  }

  function paintContactLinks() {
    const mail = $('#pb-mail');
    const wa = $('#pb-wa');
    if (!mail || !wa) return;
    const q = quote(state);
    mail.href = mailtoUrl(state, q);
    wa.href = whatsappUrl(state, q);
  }

  /* ---------- Shared updates ---------- */

  function paintFeatureStates() {
    document.querySelectorAll('.pb-feat[data-feature]').forEach((el) => {
      const on = state.features.includes(el.dataset.feature);
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', String(on));
    });
  }

  function onFeaturesChanged() {
    paintFeatureStates();
    persist();
    if (!resultEl.hidden) paintResult();
    else {
      paintEstimate();
      const lede = $('#pb-feat-lede');
      if (lede) lede.textContent = featuresLede();
    }
  }

  /* ---------- Events ---------- */

  function onClick(e) {
    const t = e.target.closest('[data-act],[data-nudge],[data-set],[data-feature],[data-billing],[data-goto]');
    if (!t) return;
    const id = STEPS[state.step];

    if (t.dataset.nudge && COUNTERS[id]) {
      setCounter(id, state[id] + Number(t.dataset.nudge) * COUNTERS[id].nudge);
    } else if (t.dataset.set && COUNTERS[id]) {
      setCounter(id, Number(t.dataset.set));
    } else if (t.dataset.feature) {
      const k = t.dataset.feature;
      state.features = state.features.includes(k) ? state.features.filter((x) => x !== k) : state.features.concat(k);
      state.featuresTouched = true;
      onFeaturesChanged();
    } else if (t.dataset.billing) {
      state.billing = t.dataset.billing;
      persist();
      paintResult();
    } else if (t.dataset.goto) {
      goTo(Number(t.dataset.goto));
    } else if (t.dataset.act === 'next') {
      next();
    } else if (t.dataset.act === 'back') {
      back();
    } else if (t.dataset.act === 'suggested') {
      // An explicit tap on "Use our suggestions" switches on every suggested feature, paid ones included.
      state.features = suggestedKeys(state);
      state.featuresTouched = true;
      onFeaturesChanged();
    } else if (t.dataset.act === 'clear') {
      state.features = [];
      state.featuresTouched = true;
      onFeaturesChanged();
    } else if (t.dataset.act === 'restart') {
      startOver();
    } else if (t.dataset.act === 'copy') {
      copyText(planText(state, quote(state), false).join('\n')).then((ok) => {
        const label = t.querySelector('span');
        if (!label) return;
        label.textContent = ok ? 'Copied' : 'Press Ctrl+C to copy';
        setTimeout(() => { label.textContent = 'Copy details'; }, 2200);
      });
    }
  }

  function onInput(e) {
    const t = e.target;
    const id = STEPS[state.step];
    if (t.id === 'pb-input' && COUNTERS[id]) {
      const v = parseInt(t.value, 10);
      if (Number.isFinite(v) && v >= COUNTERS[id].min) {
        if (v > COUNTERS[id].max) t.value = String(COUNTERS[id].max);
        setCounter(id, v, true);
      }
    } else if (t.id === 'pb-range' && COUNTERS[id]) {
      setCounter(id, Number(t.value));
    } else if (t.dataset && t.dataset.contact) {
      state[t.dataset.contact] = t.value.trim();
      paintContactLinks();
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.name === 'pb-branding') {
      state.branding = t.value === 'full' ? 'full' : 'basic';
    } else if (t.name === 'pb-support') {
      state.support = t.value === 'priority' ? 'priority' : 'email';
    } else {
      return;
    }
    persist();
    paintEstimate();
  }

  function onBlur(e) {
    const id = STEPS[state.step];
    if (e.target.id === 'pb-input' && COUNTERS[id]) {
      e.target.value = state[id];
      paintCounter(id);
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && e.target.id === 'pb-input') {
      e.preventDefault();
      next();
    }
  }

  [card, resultEl].forEach((el) => {
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
  });
  card.addEventListener('focusout', onBlur);
  card.addEventListener('keydown', onKey);

  /* ---------- Rate card ---------- */

  function renderRates() {
    if (!ratesEl) return;
    const row = (name, price, desc) => `
      <li>
        <div class="pb-rate-main"><strong>${name}</strong><span class="pb-rate-price">${price}</span></div>
        <p>${desc}</p>
      </li>`;
    const feature = (f) => row(
      f.label,
      f.perVehicle ? `${money(f.price)} + ${money(f.perVehicle)} per vehicle` : f.price ? `${money(f.price)} / month` : 'Free',
      f.desc,
    );
    ratesEl.innerHTML = `
      <div class="pb-rate-group">
        <h3>The platform</h3>
        <ul>
          ${row('LiftMe platform', `${money(RATES.platform)} / month`, `Scheduling and dispatch, parent portal, automatic notifications, your own branded subdomain, and your logo and accent colour. Includes up to ${plural(RATES.includedVehicles, 'vehicle', 'vehicles')}.`)}
          ${row('Each extra vehicle', `${money(RATES.extraVehicle)} / month`, `For every vehicle beyond the first ${RATES.includedVehicles}.`)}
          ${row('Single-vehicle discount', `-${money(RATES.singleVehicleDiscount)} / month`, `Run just one vehicle and we take ${money(RATES.singleVehicleDiscount)} off your total.`)}
          ${row('Children and schools', 'No charge', "We ask how many children and schools you have so we understand your operation, but neither changes your price.")}
        </ul>
      </div>
      <div class="pb-rate-group">
        <h3>Features you can add</h3>
        <ul>${FEATURES.map(feature).join('')}</ul>
      </div>
      <div class="pb-rate-group">
        <h3>Finishing touches</h3>
        <ul>
          ${row(BRANDING.full.label, `+${money(RATES.fullBranding)} / month`, `${BRANDING.full.desc} Logo and accent colour branding is already included.`)}
          ${row(SUPPORT.email.label, 'Free', `${SUPPORT.email.desc} Included with every plan.`)}
          ${row(SUPPORT.priority.label, `+${money(RATES.prioritySupport)} / month`, `${SUPPORT.priority.desc}`)}
        </ul>
      </div>`;
  }

  /* ---------- Go ---------- */

  renderRates();
  if (state.step >= RESULT) renderResult(false);
  else renderQuestion('fwd', false);
})();
