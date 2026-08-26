// Scroll reveal for anything marked .reveal / .reveal-stagger
(function initReveal() {
  const targets = document.querySelectorAll('.reveal, .reveal-stagger');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach((el) => io.observe(el));
})();

// Company directory search — used on the "find my portal" section for parents/operators.
(function initFinder() {
  const input = document.getElementById('finder-input');
  const results = document.getElementById('finder-results');
  if (!input || !results || typeof LIFTME_TENANTS === 'undefined') return;

  function render(list) {
    if (!list.length) {
      results.innerHTML = `
        <div class="finder-empty">
          Can't see your company listed?
          <a href="mailto:hello@liftme.co.za?subject=Which%20LiftMe%20company%20am%20I%20looking%20for%3F&body=My%20child%27s%20school%20or%20transport%20company%20is%3A%20">Ask us to find it</a>
        </div>`;
      return;
    }
    results.innerHTML = list
      .map(
        (t) => `
        <a class="finder-result" href="https://${t.slug}.liftme.co.za" target="_blank" rel="noopener">
          <div>
            <div class="fr-name">${t.name}</div>
            <div class="fr-url">${t.slug}.liftme.co.za</div>
          </div>
          <span class="fr-go">Open →</span>
        </a>`
      )
      .join('');
  }

  render(LIFTME_TENANTS);

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const filtered = !q
      ? LIFTME_TENANTS
      : LIFTME_TENANTS.filter(
          (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
        );
    render(filtered);
  });
})();

// Media page category filter
(function initMediaTabs() {
  const tabs = document.querySelectorAll('.media-tab');
  if (!tabs.length) return;

  const tiles = document.querySelectorAll('[data-media-category]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.category;
      tiles.forEach((tile) => {
        const show = cat === 'all' || tile.dataset.mediaCategory === cat;
        tile.style.display = show ? '' : 'none';
      });
    });
  });
})();

// Catch-the-drop-off mini game: steer the bus between 3 lanes, catch
// drop-off pins for points. Runs forever — speed ramps up after every catch
// until it caps out, and the best run is remembered locally.
(function initLaneGame() {
  const gameEl = document.getElementById('lane-game');
  const road = document.getElementById('lane-road');
  const bus = document.getElementById('lane-bus');
  const scoreEl = document.getElementById('lane-score');
  const bestEl = document.getElementById('lane-best');
  const speedLabel = document.getElementById('lane-speed-label');
  const leftBtn = document.getElementById('lane-left');
  const rightBtn = document.getElementById('lane-right');
  if (!gameEl || !road || !bus) return;

  const LANES = [16.667, 50, 83.333]; // percent across the road
  const MAX_FALL_SPEED = 240; // px / second
  const MIN_SPAWN_INTERVAL = 480; // ms
  const BEST_KEY = 'liftme-lane-game-best';

  let laneIndex = 1;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY)) || 0;
  let speedLevel = 1;
  let fallSpeed = 60; // px / second
  let spawnInterval = 1500; // ms
  let spawnTimer = 0;
  let lastTime = 0;
  let drops = [];

  if (bestEl) bestEl.textContent = String(best);

  function setLane(i) {
    laneIndex = Math.max(0, Math.min(2, i));
    bus.style.left = LANES[laneIndex] + '%';
  }

  function spawnDrop() {
    const lane = Math.floor(Math.random() * 3);
    const el = document.createElement('div');
    el.className = 'lane-drop';
    el.style.left = LANES[lane] + '%';
    el.style.top = '-24px';
    el.innerHTML = '<svg class="icon"><use href="#icon-pin"></use></svg>';
    road.appendChild(el);
    drops.push({ el, lane, y: -24 });
  }

  function pop(xPercent, y) {
    const el = document.createElement('div');
    el.className = 'lane-pop';
    el.textContent = '+1';
    el.style.left = xPercent + '%';
    el.style.top = y + 'px';
    road.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  function tick(now) {
    const dt = Math.min(48, now - lastTime);
    lastTime = now;

    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnDrop();
    }

    const roadH = road.clientHeight;
    const catchTop = roadH - 62;
    const catchBottom = roadH - 4;

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += (fallSpeed * dt) / 1000;
      d.el.style.top = d.y + 'px';

      if (d.y >= catchTop && d.y <= catchBottom && d.lane === laneIndex) {
        pop(LANES[d.lane], d.y);
        d.el.remove();
        drops.splice(i, 1);
        score += 1;
        scoreEl.textContent = String(score);
        if (score > best) {
          best = score;
          if (bestEl) bestEl.textContent = String(best);
          localStorage.setItem(BEST_KEY, String(best));
        }
        fallSpeed = Math.min(MAX_FALL_SPEED, fallSpeed + 14);
        spawnInterval = Math.max(MIN_SPAWN_INTERVAL, spawnInterval - 90);
        speedLevel += 1;
        speedLabel.textContent = 'Speed ' + speedLevel;
      } else if (d.y > roadH + 10) {
        d.el.remove();
        drops.splice(i, 1);
      }
    }

    requestAnimationFrame(tick);
  }

  leftBtn.addEventListener('click', () => setLane(laneIndex - 1));
  rightBtn.addEventListener('click', () => setLane(laneIndex + 1));

  setLane(1);
  lastTime = performance.now();
  requestAnimationFrame(tick);

  let touchStartX = null;
  road.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.touches[0].clientX;
    },
    { passive: true }
  );
  road.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 24) setLane(laneIndex + (dx > 0 ? 1 : -1));
    touchStartX = null;
  });

  // Arrow keys only act while the widget is hovered, so the game doesn't
  // hijack normal page scrolling for the rest of the site.
  let hovering = false;
  gameEl.addEventListener('mouseenter', () => { hovering = true; });
  gameEl.addEventListener('mouseleave', () => { hovering = false; });
  document.addEventListener('keydown', (e) => {
    if (!hovering) return;
    if (e.key === 'ArrowLeft') setLane(laneIndex - 1);
    else if (e.key === 'ArrowRight') setLane(laneIndex + 1);
    else return;
    e.preventDefault();
  });
})();

// Mobile nav: hamburger toggle + drawer of links (all links stay reachable
// on small screens instead of disappearing).
(function initNavToggle() {
  const topbar = document.querySelector('.topbar');
  const toggle = document.querySelector('.nav-toggle');
  const links = document.getElementById('nav-links');
  if (!topbar || !toggle || !links) return;

  function setOpen(open) {
    topbar.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', () => {
    setOpen(!topbar.classList.contains('open'));
  });

  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => setOpen(false));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 661) setOpen(false);
  });
})();

// Pricing page: monthly/annual billing toggle
(function initBillingToggle() {
  const sw = document.getElementById('billing-switch');
  if (!sw) return;

  const labels = document.querySelectorAll('.billing-label');
  const amounts = document.querySelectorAll('[data-monthly]');
  const pers = document.querySelectorAll('[data-per-monthly]');

  function setAnnual(annual) {
    sw.setAttribute('aria-checked', String(annual));
    labels.forEach((l) => l.classList.toggle('active', (l.dataset.billing === 'annual') === annual));
    amounts.forEach((el) => { el.textContent = annual ? el.dataset.annual : el.dataset.monthly; });
    pers.forEach((el) => { el.textContent = annual ? el.dataset.perAnnual : el.dataset.perMonthly; });
  }

  sw.addEventListener('click', () => setAnnual(sw.getAttribute('aria-checked') !== 'true'));
  labels.forEach((l) => l.addEventListener('click', () => setAnnual(l.dataset.billing === 'annual')));
  setAnnual(false);
})();

// FAQ page: accordion + category tabs + live search
(function initFaq() {
  const items = document.querySelectorAll('.faq-item');
  if (!items.length) return;

  items.forEach((item) => {
    const btn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    btn.addEventListener('click', () => {
      const open = item.classList.toggle('open');
      answer.style.maxHeight = open ? answer.scrollHeight + 'px' : '0px';
    });
  });

  const tabs = document.querySelectorAll('.faq-tab');
  const searchInput = document.getElementById('faq-search');
  const categoryBlocks = document.querySelectorAll('[data-faq-category]');
  const emptyState = document.getElementById('faq-empty');

  function applyFilters() {
    const activeTab = document.querySelector('.faq-tab.active');
    const cat = activeTab ? activeTab.dataset.category : 'all';
    const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let anyVisibleTotal = false;

    categoryBlocks.forEach((block) => {
      const blockCat = block.dataset.faqCategory;
      const catMatch = cat === 'all' || cat === blockCat;
      let anyVisible = false;
      block.querySelectorAll('.faq-item').forEach((item) => {
        const text = item.textContent.toLowerCase();
        const show = catMatch && (!q || text.includes(q));
        item.style.display = show ? '' : 'none';
        if (show) anyVisible = true;
      });
      block.style.display = anyVisible ? '' : 'none';
      if (anyVisible) anyVisibleTotal = true;
    });

    if (emptyState) emptyState.style.display = anyVisibleTotal ? 'none' : '';
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      applyFilters();
    });
  });

  if (searchInput) searchInput.addEventListener('input', applyFilters);
})();

// Contact page: build a mailto: link from the form (static site, no backend)
(function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const company = form.company.value.trim();
    const email = form.email.value.trim();
    const plan = form.plan ? form.plan.value : '';
    const message = form.message.value.trim();

    const subject = encodeURIComponent(`LiftMe enquiry — ${company || name || 'New enquiry'}`);
    const bodyLines = [
      `Name: ${name}`,
      `Company / school: ${company}`,
      `Email: ${email}`,
      plan ? `Plan interested in: ${plan}` : null,
      '',
      message,
    ].filter((l) => l !== null);
    const body = encodeURIComponent(bodyLines.join('\n'));

    window.location.href = `mailto:hello@liftme.co.za?subject=${subject}&body=${body}`;
  });
})();

// Highlight the current nav link on the media page
(function initActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-page]').forEach((a) => {
    if (a.dataset.page === path) a.classList.add('active');
  });
})();
