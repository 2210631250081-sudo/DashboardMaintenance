/* Google Sheets reader for the Maintenance Calendar and Inventory Monitoring modules.
   It reads two tabs of the spreadsheet and returns the SAME record shapes as js/data.js (ORD and MAT), so calc.js and ui.js do not change.
   This is the only file that talks to the network. In B2E, replace it with the call to the C# backend that returns the same two lists.
   Requirement: the spreadsheet is shared as "Anyone with the link: Viewer". Reliability & Cost still uses the copy inside js/data.js. */
(function () {
var CFG = {
  sheetId: '1hal2fEnchMF32et0W02PDVu1KWK3o05IozRTSBR3zcI', // the part of the sheet link between /d/ and /edit
  refreshMinutes: 5,   // the page re-reads the sheet by itself every N minutes; 0 = only when the page opens or the refresh button is pressed
  timeoutSeconds: 20,
  /* csvUrl empty = read the tab by name through a script tag (works from a folder, no extra step). Optional alternative: File > Share > Publish to web > pick the tab > CSV, and paste that link into csvUrl. */
  orders:    { sheet: 'Maintenance_Kalender', csvUrl: '' },
  materials: { sheet: 'Min_Max_Stok',         csvUrl: '' }
};

/* ---------- Reading values ---------- */
/* CSV text -> list of rows (list of cells). Handles quoted cells, "" inside quotes, line breaks inside quotes, CRLF and a BOM. */
function parseCsv(text) {
  var rows = [], row = [], f = '', q = false, i, c;
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  for (i = 0; i < text.length; i++) {
    c = text.charAt(i);
    if (q) { if (c === '"') { if (text.charAt(i + 1) === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text.charAt(i + 1) === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function norm(s) { return String(s == null ? '' : s).replace(/[\s\u00a0]+/g, ' ').trim().toLowerCase(); }
function cell(r, i) { return i == null || i < 0 || r[i] == null ? '' : String(r[i]).trim(); }
/* Number: returns a number, null for an empty cell, or undefined when the text is not a number (the row is then ignored and counted).
   Plain numbers are best. Also understood: 1,234.5  1.234.567,5  12,5  A single "1.234" is read as 1.234, not 1234. */
function num(s) {
  s = String(s == null ? '' : s).replace(/[\s\u00a0]/g, '');
  if (s === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return +s;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return +s.replace(/,/g, '');
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) return +s.replace(/\./g, '').replace(',', '.');
  if (/^-?\d+,\d+$/.test(s)) return +s.replace(',', '.');
  return undefined;
}
/* Date -> 'yyyy-mm-dd' or null. Accepts yyyy-mm-dd and d/m/yyyy (the format shown in the sheet, e.g. 31/7/2026). If only the second number can be a month (8/31/2026), it is read as m/d/yyyy. */
function date(s) {
  s = String(s == null ? '' : s).trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s), y, mo, d, t, dt;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(s))) { y = +m[3]; d = +m[1]; mo = +m[2]; if (mo > 12 && d <= 12) { t = d; d = mo; mo = t; } }
  else return null;
  dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
}

/* ---------- Finding the columns ----------
   Each field has the column title the dashboard expects (h), the column position used when the title row cannot be found (i, 0 = column A),
   and req = the title row must contain it. Titles are compared without capitals and extra spaces. */
var ORD_FIELDS = [{ k: 'order', h: 'order', i: 1, req: 1 }, { k: 'equipmentNo', h: 'equipment_no', i: 2, req: 1 }, { k: 'type', h: 'type_order', i: 3, req: 1 },
  { k: 'description', h: 'description', i: 4 }, { k: 'plannedStart', h: 'planned_start', i: 5, req: 1 }, { k: 'plant', h: 'plant', i: 6, req: 1 }];
var MAT_FIELDS = [{ k: 'plant', h: 'plant', i: 1, req: 1 }, { k: 'material', h: 'material', i: 2, req: 1 }, { k: 'description', h: 'description', i: 3 },
  { k: 'min', h: 'minimum stock', i: 4, req: 1 }, { k: 'max', h: 'maximum stock', i: 5, req: 1 }, { k: 'actual', h: 'actual stock', i: 6, req: 1 }];
/* Looks for the title row in the first 10 rows. Found = columns by title, data starts below it. Not found = columns by position, data starts at row 1. */
function layout(rows, fields) {
  var r, i, f, cols, ok, titles;
  for (r = 0; r < Math.min(rows.length, 10); r++) {
    titles = rows[r].map(norm); cols = {}; ok = true;
    for (i = 0; i < fields.length; i++) {
      f = fields[i]; cols[f.k] = titles.indexOf(f.h);
      if (f.req && cols[f.k] < 0) ok = false;
    }
    if (ok) return { cols: cols, start: r + 1, byTitle: true };
  }
  cols = {}; fields.forEach(function (f) { cols[f.k] = f.i; });
  return { cols: cols, start: 0, byTitle: false };
}
/* Rows to read: column A is the marker column. "Value" (or empty) = data. Any other text (SAP, Dashboard, Table Name, FieldName ...) = a label row, ignored. Completely empty rows are ignored too. */
function isLabel(r) { var a = norm(r[0]); return a !== '' && a !== 'value'; }
function isEmpty(r) { for (var i = 1; i < r.length; i++) if (String(r[i]).trim() !== '') return false; return true; }

/* ---------- Rows -> records (same shapes as data.js) ---------- */
function toOrders(rows) {
  var L = layout(rows, ORD_FIELDS), c = L.cols, out = [], skipped = 0, i, r, o, d;
  for (i = L.start; i < rows.length; i++) {
    r = rows[i]; if (isLabel(r) || isEmpty(r)) continue;
    d = date(cell(r, c.plannedStart));
    o = { order: cell(r, c.order), equipmentNo: cell(r, c.equipmentNo), type: cell(r, c.type), plannedStart: d, plant: cell(r, c.plant), description: cell(r, c.description) || null };
    if (!o.order || !o.equipmentNo || !o.type || !o.plant || !d) { skipped++; continue; }
    out.push(o);
  }
  return { rows: out, skipped: skipped, byTitle: L.byTitle };
}
function toMaterials(rows) {
  var L = layout(rows, MAT_FIELDS), c = L.cols, out = [], skipped = 0, i, r, p, mt, mn, mx, ac;
  for (i = L.start; i < rows.length; i++) {
    r = rows[i]; if (isLabel(r) || isEmpty(r)) continue;
    p = cell(r, c.plant); mt = cell(r, c.material); mn = num(cell(r, c.min)); mx = num(cell(r, c.max)); ac = num(cell(r, c.actual));
    /* An empty Minimum or Maximum is allowed (null): calc.js treats empty and 0 as "not set". Actual Stock must be a number (0 is fine). */
    if (!p || !mt || mn === undefined || mx === undefined || ac == null) { skipped++; continue; }
    out.push({ plant: p, material: mt, description: cell(r, c.description), min: mn, max: mx, actual: ac });
  }
  return { rows: out, skipped: skipped, byTitle: L.byTitle };
}

/* ---------- Network ----------
   Two ways to get a tab, chosen by csvUrl in the config:
   - csvUrl empty (default): the tab is requested by name from Google's "gviz" address and loaded as a <script> tag (JSONP). Browsers block fetch() to that address
     (CORS), above all when index.html is opened from a folder (file://), but they do not block script tags.
   - csvUrl filled (a "Publish to web" CSV link): read with fetch(). Google allows that for published CSV. */
var seq = 0;
/* gviz cell -> text, so the same row readers (toOrders, toMaterials) serve both ways. Numbers stay numbers-as-text, dates Date(2026,7,1) become 2026-08-01, empty = ''. */
function cellText(c) {
  var v = c == null ? null : c.v, m;
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  m = /^Date\((\d+),(\d+),(\d+)/.exec(v);
  return m ? m[1] + '-' + ('0' + (+m[2] + 1)).slice(-2) + '-' + ('0' + m[3]).slice(-2) : String(v);
}
/* If Google used the first sheet row as column titles, that row is not among the rows, so it is put back on top (the title search needs it). */
function tableRows(t) {
  var rows = [], labels = t.cols.map(function (c) { return c.label || ''; });
  if (labels.some(function (l) { return l !== ''; })) rows.push(labels);
  t.rows.forEach(function (r) { rows.push((r.c || []).map(cellText)); });
  return rows;
}
function viaScript(spec, done) {
  var name = '__sheetCb' + (++seq), s = document.createElement('script'), fin = false, timer, g = window.google, stub = !g || !g.visualization;
  function end(err, rows) {
    if (fin) return; fin = true; clearTimeout(timer);
    try { delete window[name]; } catch (e) { window[name] = undefined; }
    if (stub) { try { delete window.google; } catch (e2) { window.google = undefined; } }
    if (s.parentNode) s.parentNode.removeChild(s);
    done(err, rows && { rows: rows, sig: JSON.stringify(rows) });
  }
  function handler(r) {
    var m = r && r.errors && r.errors[0] && (r.errors[0].detailed_message || r.errors[0].message);
    if (!r || r.status !== 'ok' || !r.table) return end(new Error('Google refused tab ' + spec.sheet + (m ? ' (' + m + ')' : '') + ', check the tab name and that the link is shared'));
    end(null, tableRows(r.table));
  }
  window[name] = handler;
  /* Google calls the name given in responseHandler; the stub only covers the case that it calls its default name instead (only used when no Google script is on the page). */
  if (stub) window.google = { visualization: { Query: { setResponse: handler } } };
  s.onerror = function () { end(new Error('could not reach Google Sheets (no internet, or the network blocks docs.google.com)')); };
  timer = setTimeout(function () {
    end(new Error('Google Sheets did not answer within ' + CFG.timeoutSeconds + ' seconds. Most likely the spreadsheet is not shared as "Anyone with the link: Viewer" (Google then sends a sign-in page), or there is no internet'));
  }, CFG.timeoutSeconds * 1000);
  s.src = 'https://docs.google.com/spreadsheets/d/' + CFG.sheetId + '/gviz/tq?tqx=out:json;responseHandler:' + name + '&sheet=' + encodeURIComponent(spec.sheet);
  (document.head || document.getElementsByTagName('head')[0]).appendChild(s);
}
function viaFetch(spec, done) {
  if (typeof fetch !== 'function') return done(new Error('this browser cannot read Google Sheets (no fetch)'));
  var ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, CFG.timeoutSeconds * 1000) : 0;
  fetch(spec.csvUrl, { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) {
    if (!r.ok) throw new Error('Google answered HTTP ' + r.status + ' for tab ' + spec.sheet + ' (check the csvUrl link)');
    return r.text();
  }).then(function (t) {
    if (/^\s*<(!doctype|html)/i.test(t)) throw new Error('Google returned a web page instead of CSV for tab ' + spec.sheet + ' (check the csvUrl link, it must be a Publish to web link with CSV format)');
    return t;
  }).then(function (t) { clearTimeout(timer); done(null, { rows: parseCsv(t), sig: t }); }, function (e) {
    clearTimeout(timer);
    done(e && e.name === 'AbortError' ? new Error('Google Sheets did not answer within ' + CFG.timeoutSeconds + ' seconds') :
      e && e.message === 'Failed to fetch' ? new Error('could not reach Google Sheets (no internet, blocked by the browser or the network, or the link is wrong)') : (e instanceof Error ? e : new Error(String(e))));
  });
}
function get(spec, done) { (spec.csvUrl ? viaFetch : viaScript)(spec, done); }

var last = {}, S = { config: CFG, parts: { parseCsv: parseCsv, num: num, date: date, toOrders: toOrders, toMaterials: toMaterials, tableRows: tableRows, cellText: cellText } };
/* load(callback): callback(error) or callback(null, { orders, materials, skipped: {orders, materials}, byTitle: {orders, materials}, changed, at }).
   changed = false when both tabs are identical to the previous successful read. On any error the caller keeps the data it already has.
   The two tabs are requested one after the other (not together), so Google's answers can never be mixed up. */
S.load = function (cb) {
  get(CFG.orders, function (e1, a) {
    if (e1) return cb(e1);
    get(CFG.materials, function (e2, b) {
      if (e2) return cb(e2);
      var o, m, changed;
      try { o = toOrders(a.rows); m = toMaterials(b.rows); } catch (e) { return cb(e); }
      if (!o.rows.length) return cb(new Error('tab ' + CFG.orders.sheet + ' has no valid order rows (' + o.skipped + ' rows ignored)'));
      if (!m.rows.length) return cb(new Error('tab ' + CFG.materials.sheet + ' has no valid material rows (' + m.skipped + ' rows ignored)'));
      changed = a.sig !== last.orders || b.sig !== last.materials;
      last = { orders: a.sig, materials: b.sig };
      cb(null, { orders: o.rows, materials: m.rows, skipped: { orders: o.skipped, materials: m.skipped }, byTitle: { orders: o.byTitle, materials: m.byTitle }, changed: changed, at: new Date() });
    });
  });
};
window.SheetData = S;
})();
