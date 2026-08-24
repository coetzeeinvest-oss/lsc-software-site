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

// Highlight the current nav link on the media page
(function initActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-page]').forEach((a) => {
    if (a.dataset.page === path) a.classList.add('active');
  });
})();
