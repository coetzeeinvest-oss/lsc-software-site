/*! LiftMe free invoice tool: the step-by-step form, the live preview and the PDF download.
 *  Everything runs in the browser. Nothing is sent anywhere; the only storage is this
 *  browser's own localStorage, so the operator's details are there next time.
 *
 *  Flow: four steps are shown one at a time next to the preview. Finishing a step
 *  (its required fields are valid and the person moves on) fills a quarter of the
 *  progress bar. When the bar is full the Download PDF button unlocks. */
(function () {
  'use strict';

  var Pdf = window.LiftMeInvoicePdf;
  var root = document.getElementById('tool');
  if (!root || !Pdf) return;

  var STORE_KEY = 'liftme.invoiceTool.v2';
  var MAX_ITEMS = 10;
  var QUICK = ['Monthly school transport', 'Morning trip', 'Afternoon trip', 'Extra-mural trip', 'Holiday trip', 'Sibling discount'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }
  function trim(v) { return str(v).trim(); }

  function esc(s) {
    return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isoDate(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* ---------- State ---------- */

  function blankItem() { return { desc: '', qty: '1', price: '' }; }

  function newInvoice(number) {
    return {
      number: number, date: isoDate(0), due: isoDate(7), period: '',
      client: { name: '', contact: '', address: '' },
      learners: '', school: '', items: [blankItem()], notes: ''
    };
  }

  function defaultState() {
    return {
      v: 2,
      business: { name: '', phone: '', email: '', address: '', regNo: '', vat: false, vatNo: '', vatRate: '15', payment: '', logo: null },
      invoice: newInvoice('INV-001'),
      step: 0,
      exVat: false, // true while VAT is on only because the VAT example switched it on
      done: [false, false, false] // steps 1 to 3 count once the person has moved on from them; step 4 counts as soon as it is valid
    };
  }

  // Copy only the keys the template knows about, as strings, so stored data can never change the shape of the app.
  function pick(template, src) {
    var out = {};
    Object.keys(template).forEach(function (k) {
      var v = src && src[k];
      out[k] = typeof template[k] === 'boolean' ? !!v : (typeof v === 'string' ? v : template[k]);
    });
    return out;
  }

  function loadState() {
    try {
      var s = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (!s || s.v !== 2 || !s.business || !s.invoice) return null;
      var d = defaultState();
      var biz = pick(d.business, s.business);
      var logo = s.business.logo;
      biz.logo = logo && typeof logo.data === 'string' && logo.data.indexOf('data:image/jpeg;base64,') === 0 ? { data: logo.data, w: +logo.w || 0, h: +logo.h || 0 } : null;
      var inv = pick({ number: '', date: '', due: '', period: '', learners: '', school: '', notes: '' }, s.invoice);
      inv.client = pick(d.invoice.client, s.invoice.client);
      var items = Array.isArray(s.invoice.items) ? s.invoice.items.slice(0, MAX_ITEMS).map(function (it) { return pick(blankItem(), it); }) : [];
      inv.items = items.length ? items : [blankItem()];
      var done = Array.isArray(s.done) ? s.done.slice(0, 3).map(Boolean) : [];
      while (done.length < 3) done.push(false);
      return { v: 2, business: biz, invoice: inv, step: Math.min(Math.max(parseInt(s.step, 10) || 0, 0), 3), exVat: !!s.exVat, done: done };
    } catch (e) {
      return null;
    }
  }

  var state = loadState() || defaultState();
  var saveTimer = null;
  var saveWarned = false;

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      if (!saveWarned) {
        saveWarned = true;
        say('Your browser would not let us save your details, so they will not be here next time. The invoice still works.', 'error');
      }
    }
  }

  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
  }

  /* ---------- Messages ---------- */

  var msgTimer = null;
  function say(text, kind) {
    var m = $('tool-msg');
    clearTimeout(msgTimer);
    m.textContent = text || '';
    m.className = 'tool-msg' + (kind ? ' is-' + kind : '');
    if (text && kind === 'ok') msgTimer = setTimeout(function () { m.textContent = ''; }, 7000);
  }

  /* ---------- Steps and progress ---------- */

  function hasPricedItem() {
    return state.invoice.items.some(function (it) { return trim(it.desc) && trim(it.price) !== ''; });
  }

  function detailsProblem() {
    var inv = state.invoice;
    if (!trim(inv.number)) return 'Add an invoice number to continue.';
    if (!inv.date) return 'Add the invoice date to continue.';
    if (!inv.due) return 'Add the due date to continue.';
    if (inv.due < inv.date) return 'The due date cannot be before the invoice date.';
    return '';
  }

  var STEPS = [
    { title: 'Your business', problem: function () { return trim(state.business.name) ? '' : 'Add your business name to continue.'; } },
    { title: 'Who is it for?', problem: function () { return trim(state.invoice.client.name) ? '' : 'Add the parent or client name to continue.'; } },
    { title: 'Invoice details', problem: detailsProblem },
    { title: 'What you are charging for', problem: function () { return hasPricedItem() ? '' : 'Add at least one line with a description and a price.'; } }
  ];
  var LAST = STEPS.length - 1;

  function valid(i) { return !STEPS[i].problem(); }
  function isDone(i) { return valid(i) && (i === LAST || !!state.done[i]); }

  function percent() {
    var n = 0;
    for (var i = 0; i <= LAST; i++) if (isDone(i)) n++;
    return Math.round(100 * n / STEPS.length);
  }

  function firstIncomplete() {
    for (var i = 0; i <= LAST; i++) if (!isDone(i)) return i;
    return -1;
  }

  var stepper = $('stepper');
  var cards = [].slice.call(root.querySelectorAll('[data-step-panel]'));
  var lastPct = null;

  function buildStepper() {
    cards.forEach(function (card, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'step-pill';
      b.innerHTML = '<span class="step-pill-num"></span><span class="step-pill-label">' + esc(card.getAttribute('data-short')) + '</span>';
      b.addEventListener('click', function () { go(i, { focus: true }); });
      li.appendChild(b);
      stepper.appendChild(li);
    });
  }

  function renderStatus() {
    var cur = state.step;

    [].forEach.call(stepper.querySelectorAll('.step-pill'), function (b, i) {
      var done = isDone(i);
      b.classList.toggle('is-done', done);
      if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + STEPS[i].title + (done ? ' (completed)' : ''));
      b.querySelector('.step-pill-num').innerHTML = done ? '<svg class="icon" aria-hidden="true"><use href="#icon-check"></use></svg>' : String(i + 1);
    });

    var card = cards[cur];
    var problem = STEPS[cur].problem();
    var pct = percent();
    card.querySelector('[data-nav=next], [data-nav=finish]').disabled = !!problem;
    var hint = card.querySelector('[data-hint]');
    if (problem) hint.textContent = problem;
    else if (cur < LAST) hint.textContent = isDone(cur) ? '' : 'Looks good. Press Continue to complete this step.';
    else hint.textContent = pct === 100 ? 'Everything is complete. Press Review and download.' : 'Finish the other steps to unlock your PDF.';

    var prog = $('progress');
    [].forEach.call(root.querySelectorAll('.progress'), function (p) { p.style.setProperty('--p', String(pct)); });
    prog.setAttribute('aria-valuenow', String(pct));
    $('progress-pct').textContent = pct + '%';
    $('mini-pct').textContent = pct + '% ready';
    var next = firstIncomplete();
    $('progress-hint').textContent = pct === 100
      ? 'All four steps are complete. Your PDF is ready to download.'
      : 'Finish all four steps to unlock your PDF. Next up: ' + STEPS[next].title + '.';

    var dl = $('btn-download');
    dl.disabled = pct < 100;
    dl.classList.toggle('is-ready', pct === 100);
    $('btn-share').disabled = pct < 100;
    if (lastPct !== null && lastPct < 100 && pct === 100) say('Your PDF is ready. Press Download PDF.', 'ok');
    lastPct = pct;
  }

  function go(i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(LAST, i));
    var from = state.step;
    if (i !== from && from < LAST) state.done[from] = valid(from);
    state.step = i;
    cards.forEach(function (c, k) { c.hidden = k !== i; });
    $('paper').setAttribute('data-active', String(i + 1));
    renderStatus();
    if (!opts.silent) saveSoon();
    if (opts.focus) {
      cards[i].querySelector('h2').focus({ preventScroll: true });
      if (stepper.getBoundingClientRect().top < 110) stepper.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  root.addEventListener('click', function (e) {
    var nav = e.target.closest && e.target.closest('[data-nav]');
    if (!nav || nav.disabled) return;
    var k = nav.getAttribute('data-nav');
    if (k === 'back') go(state.step - 1, { focus: true });
    else if (k === 'next') go(state.step + 1, { focus: true });
    else if (k === 'finish') finish();
  });

  // Enter in a single-line field moves on, like a form would.
  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('input:not([type=checkbox]):not([type=file])')) return;
    var btn = cards[state.step].querySelector('[data-nav=next], [data-nav=finish]');
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  });

  function finish() {
    var gap = firstIncomplete();
    if (gap < 0) {
      var dl = $('btn-download');
      dl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      dl.focus({ preventScroll: true });
      return;
    }
    go(gap, { focus: true });
    say(valid(gap)
      ? 'Check step ' + (gap + 1) + ' (' + STEPS[gap].title + '), then press Continue to unlock your PDF.'
      : 'Finish step ' + (gap + 1) + ' (' + STEPS[gap].title + ') to unlock your PDF.', 'error');
  }

  /* ---------- Field binding ---------- */

  function resolve(path) {
    var parts = path.split('.');
    var obj = parts[0] === 'business' ? state.business : state.invoice;
    for (var i = 1; i < parts.length - 1; i++) obj = obj[parts[i]];
    return { obj: obj, key: parts[parts.length - 1] };
  }

  function syncFields() {
    root.querySelectorAll('[data-bind]').forEach(function (inp) {
      var r = resolve(inp.getAttribute('data-bind'));
      if (inp.type === 'checkbox') inp.checked = !!r.obj[r.key];
      else inp.value = str(r.obj[r.key]);
    });
    $('vat-fields').hidden = !state.business.vat;
  }

  root.addEventListener('input', function (e) {
    var t = e.target;
    var path = t.getAttribute && t.getAttribute('data-bind');
    if (path) {
      var r = resolve(path);
      r.obj[r.key] = t.type === 'checkbox' ? t.checked : t.value;
      if (path === 'business.vat') { state.exVat = false; $('vat-fields').hidden = !state.business.vat; }
      refresh();
      return;
    }
    var row = t.closest && t.closest('.item-row');
    if (row && t.hasAttribute('data-f')) {
      state.invoice.items[+row.getAttribute('data-i')][t.getAttribute('data-f')] = t.value;
      refresh();
    }
  });

  /* ---------- Items ---------- */

  function itemRow(it, i) {
    var row = document.createElement('div');
    row.className = 'item-row';
    row.setAttribute('data-i', String(i));
    row.innerHTML =
      '<div class="form-field item-desc"><label for="it-d-' + i + '">Description</label>' +
      '<input id="it-d-' + i + '" data-f="desc" type="text" list="item-suggestions" maxlength="140" autocomplete="off" placeholder="Monthly school transport: Thandi (Grade 3)"></div>' +
      '<div class="form-field item-qty"><label for="it-q-' + i + '">Qty</label>' +
      '<input id="it-q-' + i + '" data-f="qty" type="text" inputmode="decimal" maxlength="6" autocomplete="off"></div>' +
      '<div class="form-field item-price"><label for="it-p-' + i + '">Price (R)</label>' +
      '<input id="it-p-' + i + '" data-f="price" type="text" inputmode="decimal" maxlength="12" autocomplete="off" placeholder="0.00"></div>' +
      '<div class="item-amt"><span class="item-amt-label">Amount</span><output aria-label="Line amount"></output></div>' +
      '<button type="button" class="item-del" data-act="del" aria-label="Remove line ' + (i + 1) + '"><svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg></button>';
    row.querySelector('[data-f=desc]').value = it.desc;
    row.querySelector('[data-f=qty]').value = it.qty;
    row.querySelector('[data-f=price]').value = it.price;
    return row;
  }

  function hasEmptyRow() {
    var items = state.invoice.items, last = items[items.length - 1];
    return !trim(last.desc) && !trim(last.price);
  }

  function renderItems() {
    var items = state.invoice.items, box = $('items');
    box.innerHTML = '';
    items.forEach(function (it, i) { box.appendChild(itemRow(it, i)); });
    $('add-item').disabled = items.length >= MAX_ITEMS;
    root.querySelectorAll('#quick-items .chip').forEach(function (c) { c.disabled = items.length >= MAX_ITEMS && !hasEmptyRow(); });
    updateAmounts();
  }

  function updateAmounts() {
    root.querySelectorAll('.item-row').forEach(function (row) {
      var it = state.invoice.items[+row.getAttribute('data-i')];
      var out = row.querySelector('output');
      out.textContent = trim(it.price) ? Pdf.money(Pdf.calc({ items: [it] }, { vat: false }).sub) : '—';
    });
  }

  $('items').addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-act=del]');
    if (!btn) return;
    var items = state.invoice.items;
    items.splice(+btn.closest('.item-row').getAttribute('data-i'), 1);
    if (!items.length) items.push(blankItem());
    renderItems();
    refresh();
  });

  function addItem(desc) {
    var items = state.invoice.items, target;
    if (hasEmptyRow()) target = items[items.length - 1];
    else if (items.length < MAX_ITEMS) { target = blankItem(); items.push(target); }
    else { say('An invoice can have up to ' + MAX_ITEMS + ' lines.', 'error'); return; }
    if (desc) target.desc = desc;
    renderItems();
    refresh();
    var row = root.querySelectorAll('.item-row')[items.indexOf(target)];
    if (row) row.querySelector(desc ? '[data-f=price]' : '[data-f=desc]').focus();
  }

  $('add-item').addEventListener('click', function () { addItem(''); });

  function buildChips() {
    var box = $('quick-items');
    QUICK.forEach(function (label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = label;
      b.addEventListener('click', function () { addItem(label); });
      box.appendChild(b);
    });
  }

  /* ---------- Totals ---------- */

  function renderTotals() {
    var t = Pdf.calc(state.invoice, state.business);
    var vat = !!state.business.vat;
    $('t-sub-row').hidden = !vat;
    $('t-vat-row').hidden = !vat;
    if (vat) {
      $('t-sub').textContent = Pdf.money(t.sub);
      $('t-vat-label').textContent = 'VAT (' + Pdf.fmtQty(t.rate) + '%)';
      $('t-vat').textContent = Pdf.money(t.vat);
    }
    $('t-total').textContent = Pdf.money(t.total);
    return t;
  }

  /* ---------- Live preview (each block is tagged with the step that edits it) ---------- */

  function line(label, value) { return value ? '<dt>' + label + '</dt><dd>' + esc(value) + '</dd>' : ''; }

  function renderPreview(t) {
    var inv = state.invoice, b = state.business, h = '';
    var ph = function (txt) { return '<span class="ph">' + esc(txt) + '</span>'; };

    h += '<div class="p-head"><div class="p-biz" data-step="1">';
    if (b.logo) h += '<img class="p-logo" alt="" src="' + esc(b.logo.data) + '">';
    h += '<div class="p-bizname' + (b.logo ? ' has-logo' : '') + '">' + (trim(b.name) ? esc(trim(b.name)) : ph('Your business name')) + '</div>';
    if (trim(b.address)) h += '<div class="p-small">' + esc(trim(b.address)) + '</div>';
    var contact = [trim(b.phone), trim(b.email)].filter(Boolean).join('   ·   ');
    if (contact) h += '<div class="p-small">' + esc(contact) + '</div>';
    if (trim(b.regNo)) h += '<div class="p-small">Reg / ID no: ' + esc(trim(b.regNo)) + '</div>';
    if (b.vat && trim(b.vatNo)) h += '<div class="p-small">VAT no: ' + esc(trim(b.vatNo)) + '</div>';
    h += '</div><div class="p-title" data-step="3"><div class="p-h">' + (b.vat ? 'TAX INVOICE' : 'INVOICE') + '</div><dl class="p-meta">' +
      line('Invoice no.', trim(inv.number)) + line('Date', Pdf.fmtDate(inv.date)) + line('Due date', Pdf.fmtDate(inv.due)) +
      '</dl></div></div><div class="p-rule"></div>';

    h += '<div class="p-two"><div data-step="2"><div class="p-label">Bill to</div><div class="p-client">' +
      (trim(inv.client.name) ? esc(trim(inv.client.name)) : ph('Parent or client name')) + '</div>';
    if (trim(inv.client.contact)) h += '<div class="p-text">' + esc(trim(inv.client.contact)) + '</div>';
    if (trim(inv.client.address)) h += '<div class="p-text">' + esc(trim(inv.client.address)) + '</div>';
    h += '</div>';
    var facts = line('Learner(s)', trim(inv.learners)) + line('School', trim(inv.school)) + line('Billing period', trim(inv.period));
    h += facts ? '<div data-step="2 3"><div class="p-label">Details</div><dl class="p-facts">' + facts + '</dl></div>' : '<div></div>';
    h += '</div>';

    h += '<table class="p-table" data-step="4"><colgroup><col><col class="c-qty"><col class="c-price"><col class="c-amt"></colgroup>' +
      '<thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>';
    if (t.lines.length) {
      t.lines.forEach(function (ln) {
        h += '<tr><td>' + esc(ln.desc) + '</td><td>' + esc(Pdf.fmtQty(ln.qty)) + '</td><td>' + Pdf.money(ln.price) + '</td><td>' + Pdf.money(ln.cents) + '</td></tr>';
      });
    } else {
      h += '<tr><td>' + ph('Monthly school transport') + '</td><td>' + ph('1') + '</td><td>' + ph('R0.00') + '</td><td>' + ph('R0.00') + '</td></tr>';
    }
    h += '</tbody></table>';

    h += '<div class="p-total"><div class="p-total-box" data-step="4">';
    if (b.vat) {
      h += '<div class="p-total-row">Subtotal<b>' + Pdf.money(t.sub) + '</b></div>' +
        '<div class="p-total-row">VAT (' + esc(Pdf.fmtQty(t.rate)) + '%)<b>' + Pdf.money(t.vat) + '</b></div>';
    }
    h += '<div class="p-grand"><span>TOTAL DUE</span><b>' + Pdf.money(t.total) + '</b></div></div></div>';

    var pay = [];
    if (trim(inv.due)) pay.push('Please pay by ' + Pdf.fmtDate(inv.due) + '.');
    if (trim(b.payment)) pay.push(trim(b.payment));
    var payHtml = esc(pay.join('\n'));
    if (trim(inv.number)) payHtml += (payHtml ? '\n' : '') + '<strong>Payment reference: ' + esc(trim(inv.number)) + '</strong>';
    if (payHtml || trim(inv.notes)) {
      h += '<div class="p-two p-pay"><div' + (payHtml ? ' data-step="1 3"' : '') + '>' + (payHtml ? '<div class="p-label">Payment details</div><div class="p-text">' + payHtml + '</div>' : '') + '</div>' +
        '<div' + (trim(inv.notes) ? ' data-step="4"' : '') + '>' + (trim(inv.notes) ? '<div class="p-label">Notes</div><div class="p-text">' + esc(trim(inv.notes)) + '</div>' : '') + '</div></div>';
    }

    h += '<div class="p-foot"><img src="media/icons/favicon.svg" alt="" width="11" height="11"><span>Free invoice template by LiftMe  ·  liftme.co.za</span></div><div class="p-tread"></div>';
    $('paper').innerHTML = h;
  }

  /* ---------- New invoice, clear, example ---------- */

  function invoiceIsBlank() {
    var inv = state.invoice;
    return !trim(inv.client.name) && !trim(inv.client.contact) && !trim(inv.client.address) && !trim(inv.learners) &&
      !trim(inv.school) && !trim(inv.notes) && inv.items.every(function (it) { return !trim(it.desc) && !trim(it.price); });
  }

  function isPristine() { return !trim(state.business.name) && invoiceIsBlank(); }

  function nextNumber(prev) {
    var m = /^(.*?)(\d+)(\D*)$/.exec(trim(prev));
    if (!m) return 'INV-002';
    var next = String(parseInt(m[2], 10) + 1);
    while (next.length < m[2].length) next = '0' + next;
    return m[1] + next + m[3];
  }

  function rebuild() {
    syncFields();
    renderLogo();
    renderItems();
  }

  $('btn-new').addEventListener('click', function () {
    if (!invoiceIsBlank() && !window.confirm('Start a new invoice? The current invoice will be cleared, but your business details stay. Download it first if you still need it.')) return;
    var old = state.invoice;
    state.invoice = newInvoice(nextNumber(old.number));
    state.invoice.period = old.period;
    state.done = [state.done[0], false, false];
    rebuild();
    var gap = firstIncomplete();
    go(gap < 0 ? 1 : gap, { focus: true });
    refresh();
    say('New invoice started. Your business details are already filled in.', 'ok');
  });

  $('btn-clear').addEventListener('click', function () {
    if (!window.confirm('Clear everything, including your business details and the invoice? This cannot be undone.')) return;
    clearTimeout(saveTimer); // a save queued by the last keystroke must not bring the old data back
    try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* storage unavailable */ }
    state = defaultState();
    lastPct = null;
    rebuild();
    go(0, { focus: true, silent: true });
    refresh(true);
    say('Everything has been cleared from this browser.', 'ok');
  });

  /* ---------- Examples (the cards further down the page) and note snippets ---------- */

  // Fill the invoice from one of the example cards. Business details are only filled in when empty.
  function loadExample(ex, opts) {
    if (!ex) return;
    if (!invoiceIsBlank() && !window.confirm('Replace the current invoice with this example? Your business details stay.')) return;
    var b = state.business, inv = state.invoice;
    var d = new Date(), next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    var sampled = !trim(b.name);
    if (sampled) {
      b.name = 'Sunshine Scholar Transport';
      b.phone = '082 555 0142';
      b.email = 'accounts@sunshinetransport.co.za';
      b.address = ['14 Jacaranda Road', 'Hyde Park, Johannesburg'].join('\n');
      b.payment = ['FNB Cheque account', 'Account name: Sunshine Scholar Transport', 'Account number: 62 8888 0000 1', 'Branch code: 250655'].join('\n');
    }
    inv.client = pick(newInvoice('').client, ex.client);
    inv.learners = str(ex.learners);
    inv.school = str(ex.school);
    inv.notes = str(ex.notes);
    inv.period = MONTHS[next.getMonth()] + ' ' + next.getFullYear();
    inv.items = (Array.isArray(ex.items) ? ex.items : []).slice(0, MAX_ITEMS).map(function (it) { return pick(blankItem(), it); });
    if (!inv.items.length) inv.items = [blankItem()];
    if (ex.vat) {
      if (!b.vat) { b.vat = true; state.exVat = true; }
      if (!trim(b.vatRate)) b.vatRate = '15';
      if (sampled && !trim(b.vatNo)) b.vatNo = '4123456789';
    } else if (state.exVat) {
      // the VAT example turned VAT on, not the operator: put it back so this example matches its card
      b.vat = false;
      state.exVat = false;
      if (b.vatNo === '4123456789') b.vatNo = '';
    }
    state.done = [true, true, true];
    rebuild();
    go(LAST);
    refresh();
    say('Example loaded. Change any detail, then download your PDF.' +
      (ex.vat ? " VAT is switched on for this example: untick I'm VAT registered in step 1 if you are not." : '') +
      (sampled ? ' The business details are samples, so replace them with your own.' : ''), 'ok');
    if (opts && opts.scroll) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exampleData(id) {
    var card = document.getElementById('example-' + id);
    try { return card ? JSON.parse(card.getAttribute('data-example')) : null; } catch (e) { return null; }
  }

  $('btn-example').addEventListener('click', function () { loadExample(exampleData('siblings')); });

  function addNote(btn) {
    var text = btn.getAttribute('data-add-note'), notes = trim(state.invoice.notes);
    if (notes.indexOf(text) === -1) state.invoice.notes = (notes ? notes + '\n' : '') + text;
    state.invoice.notes = state.invoice.notes.slice(0, 400);
    syncFields();
    refresh();
    var label = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', label);
    btn.textContent = 'Added to your invoice notes';
    setTimeout(function () { btn.textContent = label; }, 2500);
  }

  document.addEventListener('click', function (e) {
    var use = e.target.closest && e.target.closest('[data-use-example]');
    if (use) { loadExample(exampleData(use.getAttribute('data-use-example')), { scroll: true }); return; }
    var note = e.target.closest && e.target.closest('[data-add-note]');
    if (note) addNote(note);
  });

  /* ---------- Logo ---------- */

  function renderLogo() {
    var logo = state.business.logo, thumb = $('logo-thumb');
    thumb.innerHTML = '';
    if (logo) {
      var img = document.createElement('img');
      img.alt = '';
      img.src = logo.data;
      thumb.appendChild(img);
    } else {
      thumb.textContent = 'Logo';
    }
    $('logo-btn-text').textContent = logo ? 'Change logo' : 'Add your logo';
    $('logo-remove').hidden = !logo;
  }

  $('logo-btn').addEventListener('click', function () { $('logo-input').click(); });

  $('logo-remove').addEventListener('click', function () {
    state.business.logo = null;
    $('logo-input').value = '';
    renderLogo();
    refresh();
  });

  $('logo-input').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { say('That image is too big. Please choose one under 8 MB.', 'error'); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var w = img.naturalWidth || 300, h = img.naturalHeight || 120;
      var s = Math.min(1, 640 / w, 260 / h);
      var cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
      var c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      state.business.logo = { data: c.toDataURL('image/jpeg', 0.9), w: cw, h: ch };
      renderLogo();
      refresh();
      say('Logo added.', 'ok');
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      say('We could not read that image. Please try a PNG or JPG.', 'error');
    };
    img.src = url;
  });

  /* ---------- Download and share (only once the bar is full) ---------- */

  function safe(s) { return trim(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }

  function makePdf() {
    if (percent() < 100) return null;
    save();
    var inv = state.invoice;
    var bytes = Pdf.build([inv], state.business);
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      name: ['Invoice', safe(inv.number), safe(inv.client.name)].filter(Boolean).join('-') + '.pdf'
    };
  }

  $('btn-download').addEventListener('click', function () {
    var made = makePdf();
    if (!made) return;
    var url = URL.createObjectURL(made.blob), a = document.createElement('a');
    a.href = url;
    a.download = made.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
    say('Downloaded ' + made.name + '. Need another? Press Start a new invoice.', 'ok');
  });

  (function setupShare() {
    var btn = $('btn-share');
    try {
      var probe = new File([new Blob(['x'])], 'invoice.pdf', { type: 'application/pdf' });
      if (!(navigator.share && navigator.canShare && navigator.canShare({ files: [probe] }))) return;
    } catch (e) { return; }
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var made = makePdf();
      if (!made) return;
      var file = new File([made.blob], made.name, { type: 'application/pdf' });
      navigator.share({ files: [file], title: made.name.replace(/\.pdf$/, '') }).catch(function (err) {
        if (err && err.name !== 'AbortError') say('Sharing did not work here. Use Download PDF instead.', 'error');
      });
    });
  })();

  /* ---------- Render everything ---------- */

  function refresh(skipSave) {
    updateAmounts();
    renderPreview(renderTotals());
    $('btn-example').hidden = !isPristine() || !document.getElementById('example-siblings');
    $('btn-new').hidden = invoiceIsBlank();
    renderStatus();
    if (skipSave !== true) saveSoon();
  }

  buildStepper();
  buildChips();
  root.hidden = false;
  rebuild();
  go(state.step, { silent: true }); // first paint: do not write anything until the visitor changes something
  refresh(true);
  lastPct = percent();
})();
