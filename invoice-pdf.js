/*! LiftMe free invoice tool: PDF writer.
 *  A small, dependency-free PDF generator for A4 invoices. It uses the standard
 *  Helvetica fonts that every PDF viewer has built in, so nothing is fetched,
 *  nothing is uploaded and there is no library to host. Runs in the browser and
 *  in Node (for tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiftMeInvoicePdf = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PAGE_W = 595.28;
  var PAGE_H = 841.89;
  var MARGIN = 42;
  var SITE_URL = 'https://liftme.co.za/school-transport-invoice-template.html';

  // LiftMe brand colours (match styles.css) plus the neutrals used on the invoice.
  var C = {
    ink: [14, 26, 58],
    text2: [44, 56, 88],
    text3: [87, 97, 124],
    text4: [138, 144, 163],
    navy: [3, 4, 94],
    amber: [251, 176, 45],
    amberLight: [255, 241, 214],
    line: [236, 232, 223],
    band: [246, 243, 236]
  };

  /* ---------- Helvetica metrics (units per 1000 em, ASCII 32 to 126) ---------- */

  function seq() { return Array.prototype.concat.apply([], arguments); }
  function rep(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }

  var W_REG = seq(
    [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278], // space to /
    rep(10, 556),                                                                       // 0-9
    [278, 278, 584, 584, 584, 556, 1015],                                               // : to @
    [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611], // A-Z
    [278, 278, 278, 469, 556, 333],                                                     // [ to `
    [556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500], // a-z
    [334, 260, 334, 584]                                                                // { to ~
  );

  var W_BOLD = seq(
    [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278],
    rep(10, 556),
    [333, 333, 584, 584, 584, 611, 975],
    [722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611],
    [333, 278, 333, 584, 556, 333],
    [556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500],
    [389, 280, 389, 584]
  );

  // WinAnsi bytes whose width is not just a base letter: [regular, bold]
  var SPECIAL = {
    0x80: [556, 556], 0x85: [1000, 1000], 0x91: [222, 278], 0x92: [222, 278],
    0x93: [333, 500], 0x94: [333, 500], 0x95: [350, 350], 0x96: [556, 556],
    0x97: [1000, 1000], 0x99: [1000, 1000], 0xA0: [278, 278], 0xA3: [556, 556],
    0xA9: [737, 737], 0xAE: [737, 737], 0xB0: [400, 400], 0xB7: [278, 278],
    0xD7: [584, 584], 0xF7: [584, 584]
  };

  // Unicode characters outside Latin-1 that WinAnsi can still show
  var WIN_EXTRA = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86,
    0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
    0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95,
    0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
    0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
  };

  /** Turn a JS string into an array of WinAnsi byte values. */
  function toWin(str) {
    var out = [];
    var chars = Array.from(String(str == null ? '' : str));
    for (var i = 0; i < chars.length; i++) {
      var cp = chars[i].codePointAt(0);
      if (cp === 9 || cp === 10 || cp === 13) out.push(32);
      else if (cp >= 32 && cp <= 126) out.push(cp);
      else if (cp >= 160 && cp <= 255) out.push(cp);
      else if (WIN_EXTRA[cp]) out.push(WIN_EXTRA[cp]);
      else if (cp < 32 || (cp >= 127 && cp < 160)) out.push(32);
      else out.push(63); // ? for anything WinAnsi cannot show
    }
    return out;
  }

  function baseWidth(byte, bold) {
    if (byte >= 32 && byte <= 126) return (bold ? W_BOLD : W_REG)[byte - 32];
    if (SPECIAL[byte]) return SPECIAL[byte][bold ? 1 : 0];
    if (byte >= 0xC0 && byte <= 0xFF && String.prototype.normalize) {
      var base = String.fromCharCode(byte).normalize('NFD').charCodeAt(0);
      if (base >= 32 && base <= 126) return (bold ? W_BOLD : W_REG)[base - 32];
    }
    return 556;
  }

  function strWidth(str, size, bold, spacing) {
    var bytes = toWin(str), w = 0;
    for (var i = 0; i < bytes.length; i++) w += baseWidth(bytes[i], bold);
    return (w * size) / 1000 + (spacing || 0) * bytes.length;
  }

  /* ---------- Small helpers ---------- */

  function f(n) { return String(Math.round(n * 100) / 100); }
  function rgb(c) { return f(c[0] / 255) + ' ' + f(c[1] / 255) + ' ' + f(c[2] / 255); }

  function pdfString(str) {
    var bytes = toWin(str), s = '';
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      if (b === 40 || b === 41 || b === 92) s += '\\' + String.fromCharCode(b);
      else s += String.fromCharCode(b);
    }
    return '(' + s + ')';
  }

  function hexUtf16(str) {
    var hex = 'FEFF';
    for (var i = 0; i < str.length; i++) {
      var h = str.charCodeAt(i).toString(16).toUpperCase();
      hex += '0000'.slice(h.length) + h;
    }
    return '<' + hex + '>';
  }

  function strBytes(s) {
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xFF;
    return b;
  }

  function b64ToBytes(b64) {
    if (typeof atob === 'function') {
      var bin = atob(b64), out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  /** Read size and colour components from a JPEG's start-of-frame marker. */
  function jpegInfo(bytes) {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
    var i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xFF) { i++; continue; }
      var marker = bytes[i + 1];
      if (marker === 0xFF) { i++; continue; }
      if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
      var len = (bytes[i + 2] << 8) | bytes[i + 3];
      if ((marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8], comps: bytes[i + 9] };
      }
      i += 2 + len;
    }
    return null;
  }

  /** Accepts "1200", "1 200,50", "R1,200.00", "12,5" and returns a number. */
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[Rr\s ]/g, '');
    if (!s) return 0;
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (s.indexOf(',') > -1 && s.indexOf('.') === -1) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function money(cents) {
    var neg = cents < 0, a = Math.abs(cents);
    var r = Math.floor(a / 100), c = a % 100;
    var s = String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + 'R' + s + '.' + (c < 10 ? '0' : '') + c;
  }

  function fmtQty(n) { return String(Number(n.toFixed(2))); }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return '';
    return parseInt(m[3], 10) + ' ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }

  function trim(s) { return String(s == null ? '' : s).replace(/\r/g, '').trim(); }

  /** Work out the lines and totals for one invoice. Money is kept in whole cents. */
  function calc(inv, biz) {
    var lines = [], sub = 0;
    (inv.items || []).forEach(function (it) {
      var desc = trim(it.desc);
      var priceRaw = trim(it.price);
      if (!desc && !priceRaw) return;
      var qtyRaw = trim(it.qty);
      var qty = qtyRaw === '' ? 1 : num(qtyRaw);
      var price = num(priceRaw);
      var cents = Math.round(qty * price * 100);
      lines.push({ desc: desc, qty: qty, price: Math.round(price * 100), cents: cents });
      sub += cents;
    });
    var rate = biz.vat ? num(biz.vatRate) : 0;
    var vat = biz.vat ? Math.round(sub * rate / 100) : 0;
    return { lines: lines, sub: sub, vat: vat, rate: rate, total: sub + vat };
  }

  /* ---------- Document ---------- */

  function Doc(logoData) {
    this.pages = [];
    this.page = null;
    this.logo = null;
    if (logoData && logoData.indexOf('data:image/jpeg;base64,') === 0) {
      var bytes = b64ToBytes(logoData.slice(23));
      var info = jpegInfo(bytes);
      if (info && (info.comps === 3 || info.comps === 1)) this.logo = { bytes: bytes, w: info.w, h: info.h, comps: info.comps };
    }
  }

  Doc.prototype.addPage = function () {
    this.page = { ops: [], links: [] };
    this.pages.push(this.page);
    return this.page;
  };

  Doc.prototype.op = function (s) { this.page.ops.push(s); };

  Doc.prototype.rect = function (x, yTop, w, h, color) {
    this.op(rgb(color) + ' rg ' + f(x) + ' ' + f(PAGE_H - yTop - h) + ' ' + f(w) + ' ' + f(h) + ' re f');
  };

  Doc.prototype.hline = function (x1, x2, yTop, width, color) {
    this.op(rgb(color) + ' RG ' + f(width) + ' w ' + f(x1) + ' ' + f(PAGE_H - yTop) + ' m ' + f(x2) + ' ' + f(PAGE_H - yTop) + ' l S');
  };

  /** Draw one line of text. yTop is the top of the line box; align is left, right or center. */
  Doc.prototype.text = function (str, x, yTop, size, bold, color, align, spacing) {
    if (str === '' || str == null) return;
    var w = strWidth(str, size, bold, spacing);
    if (align === 'right') x -= w;
    else if (align === 'center') x -= w / 2;
    var baseline = PAGE_H - (yTop + size * 0.8);
    // Tc (character spacing) is graphics state and outlives ET, so always set it explicitly.
    this.op('BT /' + (bold ? 'F2' : 'F1') + ' ' + f(size) + ' Tf ' + rgb(color) + ' rg ' + f(spacing || 0) + ' Tc ' +
      f(x) + ' ' + f(baseline) + ' Td ' + pdfString(str) + ' Tj ET');
  };

  Doc.prototype.wrap = function (str, maxW, size, bold) {
    var out = [];
    if (!String(str == null ? '' : str).trim()) return out;
    String(str == null ? '' : str).replace(/\r/g, '').split('\n').forEach(function (para) {
      if (!para.trim()) { out.push(''); return; }
      var words = para.split(/\s+/).filter(Boolean), line = '';
      words.forEach(function (w) {
        var test = line ? line + ' ' + w : w;
        if (strWidth(test, size, bold) <= maxW) { line = test; return; }
        if (line) { out.push(line); line = ''; }
        while (strWidth(w, size, bold) > maxW && w.length > 1) {
          var i = w.length;
          while (i > 1 && strWidth(w.slice(0, i), size, bold) > maxW) i--;
          out.push(w.slice(0, i));
          w = w.slice(i);
        }
        line = w;
      });
      if (line) out.push(line);
    });
    return out;
  };

  Doc.prototype.image = function (x, yTop, w, h) {
    this.op('q ' + f(w) + ' 0 0 ' + f(h) + ' ' + f(x) + ' ' + f(PAGE_H - yTop - h) + ' cm /Im1 Do Q');
  };

  function circlePath(cx, cy, r) {
    var k = r * 0.5523;
    return [
      f(cx + r) + ' ' + f(cy) + ' m',
      f(cx + r) + ' ' + f(cy + k) + ' ' + f(cx + k) + ' ' + f(cy + r) + ' ' + f(cx) + ' ' + f(cy + r) + ' c',
      f(cx - k) + ' ' + f(cy + r) + ' ' + f(cx - r) + ' ' + f(cy + k) + ' ' + f(cx - r) + ' ' + f(cy) + ' c',
      f(cx - r) + ' ' + f(cy - k) + ' ' + f(cx - k) + ' ' + f(cy - r) + ' ' + f(cx) + ' ' + f(cy - r) + ' c',
      f(cx + k) + ' ' + f(cy - r) + ' ' + f(cx + r) + ' ' + f(cy - k) + ' ' + f(cx + r) + ' ' + f(cy) + ' c h'
    ].join(' ');
  }

  /** The LiftMe mark (amber disc with the navy tread band) as vector paths. */
  Doc.prototype.mark = function (x, yTop, size) {
    var s = size / 200, a = -26 * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    var e = 100 - 100 * cs + 100 * sn, ff = 100 - 100 * sn - 100 * cs;
    var circle = circlePath(100, 100, 100);
    var o = [
      'q',
      '1 0 0 1 ' + f(x) + ' ' + f(PAGE_H - yTop - size) + ' cm',
      f(s) + ' 0 0 ' + f(s) + ' 0 0 cm',
      '1 0 0 -1 0 200 cm',
      rgb(C.amber) + ' rg ' + circle + ' f',
      circle + ' W n',
      'q',
      [cs, sn, -sn, cs, e, ff].map(function (n) { return n.toFixed(4); }).join(' ') + ' cm',
      rgb(C.navy) + ' rg -70 70 340 60 re f',
      rgb(C.amber) + ' rg'
    ];
    for (var k = -5; k <= 16; k++) o.push(f(12.5 + 17 * k) + ' 70 4.5 60 re f');
    o.push('Q', 'Q');
    this.op(o.join(' '));
  };

  /** Thin navy strip with amber slants along the bottom edge, echoing the LiftMe tread. */
  Doc.prototype.tread = function () {
    var h = 4, o = [rgb(C.navy) + ' rg 0 0 ' + f(PAGE_W) + ' ' + h + ' re f', rgb(C.amber) + ' rg'];
    for (var x = -6; x < PAGE_W; x += 15) {
      o.push(f(x) + ' 0 m ' + f(x + 4.5) + ' 0 l ' + f(x + 4.5 + 3.2) + ' ' + h + ' l ' + f(x + 3.2) + ' ' + h + ' l f');
    }
    this.op(o.join(' '));
  };

  /* ---------- Invoice layout ---------- */

  var FOOT_TOP = PAGE_H - 54;   // content stays above this line
  var TOP = 42;

  function drawFooter(doc, n, total) {
    doc.page = doc.pages[n];
    var L = MARGIN, R = PAGE_W - MARGIN, y = PAGE_H - 40;
    doc.hline(L, R, FOOT_TOP + 6, 0.6, C.line);
    doc.mark(L, y - 1, 11);
    var label = 'Free invoice template by LiftMe  ·  liftme.co.za';
    doc.text(label, L + 16, y, 7.5, false, C.text4);
    doc.page.links.push({ x: L, y: PAGE_H - y - 12, w: 16 + strWidth(label, 7.5, false) + 2, h: 14, url: SITE_URL });
    if (total > 1) doc.text('Page ' + (n + 1) + ' of ' + total, R, y, 7.5, false, C.text4, 'right');
    doc.tread();
  }

  function renderInvoice(doc, inv, biz) {
    var t = calc(inv, biz);
    var L = MARGIN, R = PAGE_W - MARGIN, W = R - L;
    var firstPage = doc.pages.length;
    var y;

    doc.addPage();
    y = TOP;

    /* Header: business on the left, invoice title and numbers on the right */
    var leftW = W * 0.54, ly = y;
    var hasLogo = !!doc.logo;
    if (hasLogo) {
      var s = Math.min(150 / doc.logo.w, 56 / doc.logo.h);
      doc.image(L, ly, doc.logo.w * s, doc.logo.h * s);
      ly += doc.logo.h * s + 8;
    }
    var nameSize = hasLogo ? 12.5 : 17;
    doc.wrap(trim(biz.name), leftW, nameSize, true).forEach(function (ln) {
      doc.text(ln, L, ly, nameSize, true, C.ink);
      ly += nameSize + 3.5;
    });
    ly += 2;
    var details = [];
    if (trim(biz.address)) details.push(trim(biz.address));
    var contact = [trim(biz.phone), trim(biz.email)].filter(Boolean).join('   ·   ');
    if (contact) details.push(contact);
    if (trim(biz.regNo)) details.push('Reg / ID no: ' + trim(biz.regNo));
    if (biz.vat && trim(biz.vatNo)) details.push('VAT no: ' + trim(biz.vatNo));
    details.forEach(function (block) {
      doc.wrap(block, leftW, 9, false).forEach(function (ln) {
        doc.text(ln, L, ly, 9, false, C.text3);
        ly += 12.5;
      });
    });

    var ry = y;
    doc.text(biz.vat ? 'TAX INVOICE' : 'INVOICE', R, ry, 22, true, C.navy, 'right');
    ry += 34;
    [['Invoice no.', trim(inv.number)], ['Date', fmtDate(inv.date)], ['Due date', fmtDate(inv.due)]].forEach(function (row) {
      if (!row[1]) return;
      doc.text(row[0], R - 150, ry + 0.5, 8.5, false, C.text4);
      doc.text(row[1], R, ry, 9.5, true, C.ink, 'right');
      ry += 15;
    });

    y = Math.max(ly, ry) + 10;
    doc.rect(L, y, W, 2.2, C.amber);
    y += 2.2 + 20;

    /* Bill to (left) and invoice details (right) */
    var colW = W * 0.48, rx = L + W * 0.55, rw = W * 0.45;
    var by = y;
    doc.text('BILL TO', L, by, 7.5, true, C.text4, 'left', 0.7);
    by += 14;
    var cName = trim(inv.client && inv.client.name) || '';
    doc.wrap(cName, colW, 11.5, true).forEach(function (ln) { doc.text(ln, L, by, 11.5, true, C.ink); by += 15; });
    [trim(inv.client && inv.client.contact), trim(inv.client && inv.client.address)].filter(Boolean).forEach(function (block) {
      doc.wrap(block, colW, 9.5, false).forEach(function (ln) { doc.text(ln, L, by, 9.5, false, C.text2); by += 13; });
    });

    var fy = y;
    var facts = [['Learner(s)', trim(inv.learners)], ['School', trim(inv.school)], ['Billing period', trim(inv.period)]]
      .filter(function (r) { return r[1]; });
    if (facts.length) {
      doc.text('DETAILS', rx, fy, 7.5, true, C.text4, 'left', 0.7);
      fy += 14;
      facts.forEach(function (r) {
        var lines = doc.wrap(r[1], rw - 74, 9.5, false);
        doc.text(r[0], rx, fy + 0.5, 8.5, false, C.text4);
        lines.forEach(function (ln, i) { doc.text(ln, rx + 74, fy + i * 13, 9.5, false, C.text2); });
        fy += Math.max(lines.length, 1) * 13 + 2;
      });
    }
    y = Math.max(by, fy) + 18;

    /* Items table */
    var xAmt = R - 8, xPrice = xAmt - 86, xQty = xPrice - 78;
    var descX = L + 10, descW = xQty - 36 - descX;

    function tableHeader() {
      doc.rect(L, y, W, 22, C.band);
      doc.text('DESCRIPTION', descX, y + 7, 7.5, true, C.navy, 'left', 0.6);
      doc.text('QTY', xQty, y + 7, 7.5, true, C.navy, 'right', 0.6);
      doc.text('UNIT PRICE', xPrice, y + 7, 7.5, true, C.navy, 'right', 0.6);
      doc.text('AMOUNT', xAmt, y + 7, 7.5, true, C.navy, 'right', 0.6);
      y += 22;
    }

    function newPage() {
      doc.addPage();
      y = TOP;
    }

    tableHeader();
    t.lines.forEach(function (ln) {
      var lines = doc.wrap(ln.desc, descW, 9.5, false);
      if (!lines.length) lines = [''];
      var rh = lines.length * 12.5 + 14;
      if (y + rh > FOOT_TOP - 4) { newPage(); tableHeader(); }
      lines.forEach(function (txt, i) { doc.text(txt, descX, y + 7 + i * 12.5, 9.5, false, C.ink); });
      doc.text(fmtQty(ln.qty), xQty, y + 7, 9.5, false, C.text2, 'right');
      doc.text(money(ln.price), xPrice, y + 7, 9.5, false, C.text2, 'right');
      doc.text(money(ln.cents), xAmt, y + 7, 9.5, true, C.ink, 'right');
      y += rh;
      doc.hline(L, R, y, 0.6, C.line);
    });

    /* Totals */
    var totW = 230, tx = R - totW;
    var totalsH = 18 + (biz.vat ? 40 : 0) + 38;
    if (y + totalsH > FOOT_TOP - 4) newPage();
    y += 12;
    if (biz.vat) {
      doc.text('Subtotal', tx + 12, y, 9.5, false, C.text3);
      doc.text(money(t.sub), xAmt, y, 9.5, false, C.text2, 'right');
      y += 18;
      doc.text('VAT (' + fmtQty(t.rate) + '%)', tx + 12, y, 9.5, false, C.text3);
      doc.text(money(t.vat), xAmt, y, 9.5, false, C.text2, 'right');
      y += 22;
    }
    doc.rect(tx, y, totW, 32, C.amberLight);
    doc.rect(tx, y, 3, 32, C.amber);
    doc.text('TOTAL DUE', tx + 14, y + 12, 8.5, true, C.navy, 'left', 0.6);
    doc.text(money(t.total), xAmt, y + 8.5, 15, true, C.navy, 'right');
    y += 32 + 26;

    /* Payment details (left) and notes (right) */
    var payLines = [];
    if (trim(inv.due)) payLines.push({ txt: 'Please pay by ' + fmtDate(inv.due) + '.', bold: false });
    doc.wrap(trim(biz.payment), colW, 9.5, false).forEach(function (ln) { payLines.push({ txt: ln, bold: false }); });
    if (trim(inv.number)) payLines.push({ txt: 'Payment reference: ' + trim(inv.number), bold: true });
    var noteLines = doc.wrap(trim(inv.notes), colW, 9.5, false);
    var blockH = 16 + Math.max(payLines.length, noteLines.length) * 13;

    if (payLines.length || noteLines.length) {
      if (y + blockH > FOOT_TOP - 4) { newPage(); }
      var py = y, ny = y;
      if (payLines.length) {
        doc.text('PAYMENT DETAILS', L, py, 7.5, true, C.text4, 'left', 0.7);
        py += 14;
        payLines.forEach(function (p) { doc.text(p.txt, L, py, 9.5, p.bold, p.bold ? C.ink : C.text2); py += 13; });
      }
      if (noteLines.length) {
        doc.text('NOTES', rx, ny, 7.5, true, C.text4, 'left', 0.7);
        ny += 14;
        doc.wrap(trim(inv.notes), rw, 9.5, false).forEach(function (ln) { doc.text(ln, rx, ny, 9.5, false, C.text2); ny += 13; });
      }
    }

    var total = doc.pages.length - firstPage;
    for (var i = 0; i < total; i++) drawFooter(doc, firstPage + i, total);
  }

  /* ---------- PDF serialisation ---------- */

  function serialize(doc, meta) {
    var chunks = [], pos = 0, offsets = [], n = 0;
    function alloc() { return ++n; }
    function put(s) { var b = strBytes(s); chunks.push(b); pos += b.length; }
    function putBytes(b) { chunks.push(b); pos += b.length; }
    function begin(id) { offsets[id] = pos; put(id + ' 0 obj\n'); }
    function end() { put('\nendobj\n'); }

    var catalog = alloc(), pagesId = alloc(), f1 = alloc(), f2 = alloc();
    var im = doc.logo ? alloc() : 0;
    var info = alloc();
    var pageIds = doc.pages.map(function (p) {
      var o = { content: alloc(), page: alloc(), annots: [] };
      p.links.forEach(function () { o.annots.push(alloc()); });
      return o;
    });

    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    begin(catalog);
    put('<< /Type /Catalog /Pages ' + pagesId + ' 0 R /Lang (en-ZA) /ViewerPreferences << /DisplayDocTitle true >> >>');
    end();

    begin(pagesId);
    put('<< /Type /Pages /Count ' + pageIds.length + ' /Kids [' + pageIds.map(function (p) { return p.page + ' 0 R'; }).join(' ') + '] >>');
    end();

    [[f1, 'Helvetica'], [f2, 'Helvetica-Bold']].forEach(function (fnt) {
      begin(fnt[0]);
      put('<< /Type /Font /Subtype /Type1 /BaseFont /' + fnt[1] + ' /Encoding /WinAnsiEncoding >>');
      end();
    });

    if (im) {
      begin(im);
      put('<< /Type /XObject /Subtype /Image /Width ' + doc.logo.w + ' /Height ' + doc.logo.h +
        ' /ColorSpace /' + (doc.logo.comps === 1 ? 'DeviceGray' : 'DeviceRGB') +
        ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + doc.logo.bytes.length + ' >>\nstream\n');
      putBytes(doc.logo.bytes);
      put('\nendstream');
      end();
    }

    var d = new Date();
    function p2(v) { return (v < 10 ? '0' : '') + v; }
    var stamp = 'D:' + d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + 'Z';
    begin(info);
    put('<< /Title ' + hexUtf16(meta.title) + ' /Author ' + hexUtf16(meta.author) +
      ' /Creator ' + hexUtf16('LiftMe free invoice template (liftme.co.za)') +
      ' /Producer ' + hexUtf16('LiftMe invoice tool') + ' /CreationDate (' + stamp + ') >>');
    end();

    var resources = '<< /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >>' + (im ? ' /XObject << /Im1 ' + im + ' 0 R >>' : '') + ' >>';
    doc.pages.forEach(function (p, i) {
      var ids = pageIds[i];
      var stream = p.ops.join('\n');
      begin(ids.content);
      put('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
      end();

      p.links.forEach(function (lk, j) {
        begin(ids.annots[j]);
        put('<< /Type /Annot /Subtype /Link /Rect [' + f(lk.x) + ' ' + f(lk.y) + ' ' + f(lk.x + lk.w) + ' ' + f(lk.y + lk.h) +
          '] /Border [0 0 0] /A << /S /URI /URI ' + pdfString(lk.url) + ' >> >>');
        end();
      });

      begin(ids.page);
      put('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + PAGE_W + ' ' + PAGE_H + '] /Contents ' + ids.content +
        ' 0 R /Resources ' + resources +
        (ids.annots.length ? ' /Annots [' + ids.annots.map(function (a) { return a + ' 0 R'; }).join(' ') + ']' : '') + ' >>');
      end();
    });

    var xrefPos = pos;
    var xref = 'xref\n0 ' + (n + 1) + '\n0000000000 65535 f \n';
    for (var k = 1; k <= n; k++) xref += ('0000000000' + offsets[k]).slice(-10) + ' 00000 n \n';
    put(xref + 'trailer\n<< /Size ' + (n + 1) + ' /Root ' + catalog + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n');

    var out = new Uint8Array(pos), off = 0;
    chunks.forEach(function (c) { out.set(c, off); off += c.length; });
    return out;
  }

  /** Build one PDF holding every invoice passed in (one invoice starts on each new page). */
  function build(invoices, biz) {
    var doc = new Doc(biz.logo && biz.logo.data);
    invoices.forEach(function (inv) { renderInvoice(doc, inv, biz); });
    var first = invoices[0] || {};
    var title = invoices.length > 1
      ? 'Invoices (' + invoices.length + ') from ' + (trim(biz.name) || 'my business')
      : 'Invoice ' + (trim(first.number) || '') + ' from ' + (trim(biz.name) || 'my business');
    return serialize(doc, { title: title.replace(/\s+/g, ' '), author: trim(biz.name) || 'LiftMe invoice tool' });
  }

  return { build: build, calc: calc, money: money, num: num, fmtDate: fmtDate, fmtQty: fmtQty, jpegInfo: jpegInfo, _strWidth: strWidth, _W_REG: W_REG, _W_BOLD: W_BOLD };
}));
