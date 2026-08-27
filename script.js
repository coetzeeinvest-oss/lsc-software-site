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
          <a href="mailto:liftme.demo@gmail.com?subject=Which%20LiftMe%20company%20am%20I%20looking%20for%3F&body=My%20child%27s%20school%20or%20transport%20company%20is%3A%20">Ask us to find it</a>
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

// Features page: showcase Phone / Desktop view switcher
(function initShowcaseTabs() {
  const tabs = document.querySelectorAll('.showcase-tab');
  if (!tabs.length) return;

  const panels = document.querySelectorAll('.showcase[data-view-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      tabs.forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      panels.forEach((p) => { p.hidden = p.dataset.viewPanel !== view; });
    });
  });
})();

// Pricing page: mobile plan-comparison tabs
(function initCompareTabs() {
  const tabs = document.querySelectorAll('.compare-tab');
  if (!tabs.length) return;

  const panels = document.querySelectorAll('.compare-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const plan = tab.dataset.plan;
      tabs.forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      panels.forEach((p) => { p.hidden = p.dataset.plan !== plan; });
    });
  });
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

    window.location.href = `mailto:liftme.demo@gmail.com?subject=${subject}&body=${body}`;
  });
})();

// Highlight the current nav link on the media page
(function initActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-page]').forEach((a) => {
    if (a.dataset.page === path) a.classList.add('active');
  });
})();
