/* Rendering and event handling only. All numbers come from Calc / DemoData. All element IDs use the prefixes rc-, mc-, iv-. */
(function () {
var D = window.DemoData, C = window.Calc, ch = {}, sorts = {}, shown = {}, ivSig = '', cal = { ym: C.orderMonths()[0], sel: null };
var OT = { ZPM1: '#c1272d', ZPM2: '#484848' };
var MC = '#c1272d';   /* Maintenance Calendar: one colour, all orders are preventive maintenance */
var OS = { Complete: '#2e7d32', 'Overdue / Not Complete': '#c1272d' };
var PN = { '6410': 'Cikarang', '6420': 'Karawang' };   /* plant code -> name (Maintenance Calendar and Inventory Monitoring) */
function otc(t) { return OT[t] || '#9e9e9e'; }
var IS = { 'Out of Stock': '#c1272d', 'Below Minimum': '#d9822b', Normal: '#2e7d32', 'Above Maximum': '#484848' };
var IC = { 'Fast Moving': '#00838f', 'Slow Moving': '#2b6cb0' };
var MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function $(i) { return document.getElementById(i); }
function nf(n, d) { return n == null ? 'Unavailable' : n.toLocaleString('id-ID', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
function rp(n) { return 'Rp ' + nf(n); }
function fd(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '-'; }
function mix(f, o) { return { from: o.from, to: o.to, site: f.site, section: f.section }; }
function pill(s) { return '<span class="pill" style="background:' + (IS[s] || IC[s] || OS[s] || otc(s)) + '">' + s + '</span>'; }
function opts(el, list, all) { el.innerHTML = (all ? '<option value="">' + all + '</option>' : '') + list.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join(''); }
function card(l, v, d, n) { return '<div class="kpi"><div class="kl">' + l + '</div><div class="kv">' + v + '</div><div class="kd ' + (d ? d.c : '') + '">' + (d ? d.t : '') + '</div><div class="kn">' + (n || '') + '</div></div>'; }
function dl(cur, prev, low, pp) {
  if (cur == null || prev == null || (!pp && prev === 0)) return { t: 'vs previous: n/a', c: '' };
  var x = pp ? cur - prev : (cur - prev) / prev * 100;
  return { t: (x > 0 ? '+' : '') + nf(x, 1) + (pp ? ' pp' : '%') + ' vs previous', c: x === 0 ? '' : ((x < 0) === !!low ? 'good' : 'bad') };
}
function chart(id, cfg) {
  if (typeof Chart === 'undefined') { $('app-warn').hidden = false; return; }
  Chart.defaults.global.defaultFontFamily = 'Arial, "Helvetica Neue", Helvetica, sans-serif'; Chart.defaults.global.defaultFontColor = '#333';
  Chart.defaults.scale.gridLines.color = 'rgba(0,0,0,.1)';
  if (ch[id]) ch[id].destroy();
  cfg.options = cfg.options || {}; cfg.options.maintainAspectRatio = false;
  ch[id] = new Chart($(id).getContext('2d'), cfg);
}
/* page (optional): show only the first `page` rows and add a "Show more" button, so a table with thousands of rows stays fast. */
function tbl(id, cols, rows, re, emptyMsg, page) {
  var el = $(id), s = sorts[id], all = rows.length;
  if (s) rows = rows.slice().sort(function (a, b) { var x = a[s.k], y = b[s.k]; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * s.d; });
  if (page) { shown[id] = Math.min(shown[id] || page, all); rows = rows.slice(0, shown[id]); }
  el.onclick = function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-k'), o = sorts[id];
    if (t.getAttribute && t.getAttribute('data-more')) { shown[id] = (shown[id] || page) + page; return re(); }
    if (!k) return; sorts[id] = { k: k, d: o && o.k == k ? -o.d : 1 }; shown[id] = 0; re();
  };
  el.innerHTML = '<table class="dt"><thead><tr>' + cols.map(function (c) { return '<th data-k="' + c.k + '"' + (c.n ? ' class="num"' : '') + '>' + c.l + (s && s.k == c.k ? (s.d > 0 ? ' &#9650;' : ' &#9660;') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (rows.length ? rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td' + (c.n ? ' class="num"' : '') + '>' + (c.f ? c.f(r) : (r[c.k] == null ? '-' : r[c.k])) + '</td>'; }).join('') + '</tr>'; }).join('') :
    '<tr><td colspan="' + cols.length + '" class="empty">' + emptyMsg + '</td></tr>') + '</tbody></table>' +
    (page && all > rows.length ? '<div class="more"><span>Showing ' + nf(rows.length) + ' of ' + nf(all) + ' rows.</span><button class="plain" data-more="1">Show ' + nf(Math.min(page, all - rows.length)) + ' more</button></div>' : '');
}
/* ---------- Reliability & Cost ---------- */
function rcF() { return { from: $('rc-from').value, to: $('rc-to').value, site: $('rc-site').value, section: $('rc-sec').value }; }
function rcRender() {
  var f = rcF(), k = $('rc-kpis');
  if (f.from > f.to) { k.innerHTML = '<div class="empty">The start month is after the end month. Change the period.</div>'; return; }
  var c = C.reliability(f), pr = C.prev(f), p = pr && C.reliability(mix(f, pr));
  $('rc-note').textContent = 'Period ' + f.from + ' to ' + f.to + (pr ? ', compared with ' + pr.from + ' to ' + pr.to : ', no previous period in the data');
  k.innerHTML = card('Incident Rate (IR)', c.ir == null ? 'Unavailable' : nf(c.ir, 2) + '%', dl(c.ir, p && p.ir, 1, 1), 'breakdown ' + nf(c.troubleH, 0) + ' h of loading ' + nf(c.loadH, 0) + ' h') +
    card('MTTR', c.mttr == null ? 'Unavailable' : nf(c.mttr, 2) + ' h', dl(c.mttr, p && p.mttr, 1), 'breakdown time / breakdown frequency') +
    card('MTBF', c.mtbf == null ? 'Unavailable' : nf(c.mtbf, 1) + ' h', dl(c.mtbf, p && p.mtbf, 0), 'loading time / breakdown frequency') +
    card('Breakdown frequency', nf(c.freq), dl(c.freq, p && p.freq, 1), 'machine-stop troubles in the period') +
    card('Total Maintenance Cost', 'Unavailable', null, 'no cost field in Call System 2026');
  var s = C.series(f), m = $('rc-metric').value, lab = $('rc-metric').options[$('rc-metric').selectedIndex].text, sec = C.bySection(f);
  chart('rc-c1', { type: m == 'ir' ? 'bar' : 'line', data: { labels: s.labels, datasets: [{ label: lab, data: s[m], backgroundColor: '#484848', borderColor: '#484848', fill: false }] },
    options: { legend: { display: false }, scales: { yAxes: [{ ticks: { beginAtZero: true } }] } } });
  chart('rc-c2', { type: 'bar', data: { labels: sec.map(function (x) { return x.id; }), datasets: [{ label: 'IR (%)', data: sec.map(function (x) { return x.ir == null ? null : Math.round(x.ir * 100) / 100; }), backgroundColor: '#c1272d' }] },
    options: { legend: { display: false }, scales: { yAxes: [{ ticks: { beginAtZero: true } }] } } });
  tbl('rc-table', [{ k: 'id', l: 'Section' }, { k: 'group', l: 'Group' }, { k: 'site', l: 'Site' },
    { k: 'loadH', l: 'Loading time (h)', n: 1, f: function (r) { return nf(r.loadH, 0); } }, { k: 'troubleH', l: 'Breakdown time (h)', n: 1, f: function (r) { return nf(r.troubleH, 0); } },
    { k: 'freq', l: 'Frequency', n: 1, f: function (r) { return nf(r.freq); } }, { k: 'ir', l: 'IR (%)', n: 1, f: function (r) { return nf(r.ir, 2); } },
    { k: 'mttr', l: 'MTTR (h)', n: 1, f: function (r) { return nf(r.mttr, 2); } }, { k: 'mtbf', l: 'MTBF (h)', n: 1, f: function (r) { return nf(r.mtbf, 1); } }], sec, rcRender, 'No data for the selected filters.');
}
function rcSec() { opts($('rc-sec'), D.rel.sections.filter(function (s) { return !$('rc-site').value || s.site == $('rc-site').value; }).map(function (s) { return [s.id, s.group == s.id ? s.id : s.id + ' (' + s.group + ')']; }), 'All sections'); }
/* ---------- Maintenance Calendar ---------- */
var OC = [{ k: 'plant', l: 'Plant', f: function (r) { return PN[r.plant] || r.plant; } }, { k: 'order', l: 'Order' },
  { k: 'equipmentNo', l: 'No. Mesin', f: function (r) { return String(r.equipmentNo).slice(-5); } },   /* machine number = last 5 characters of Equipment_No */
  { k: 'description', l: 'Description', f: function (r) { return r.description ? esc(r.description) : '-'; } },
  { k: 'range', l: 'Range', f: function (r) { return r.range ? esc(r.range) : '-'; } },
  { k: 'plannedStart', l: 'Planned Start', f: function (r) { return fd(r.plannedStart); } }, { k: 'finish', l: 'Finish', f: function (r) { return fd(r.finish); } },
  { k: 'status', l: 'Status', f: function (r) { return r.status ? pill(r.status) : '-'; } }];
/* Maintenance Calendar filters (same controls as Inventory Monitoring). Category = order type. Status = Complete or Overdue / Not Complete (column Status of the sheet). */
function mcRows() {
  var pl = $('mc-plant').value, st = $('mc-status').value, q = $('mc-search').value.toLowerCase(), ln = $('mc-line').value;
  return D.orders.filter(function (o) { return (!pl || o.plant == pl) && (!ln || (o.line || (Dummy.mc[String(o.equipmentNo).slice(-5)] || [])[2]) == ln) && (!st || o.status == st) && (!q || (o.order + ' ' + o.equipmentNo + ' ' + (o.description || '')).toLowerCase().indexOf(q) >= 0); });
}
var TI = {
  cal: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.01"/></svg>',
  ring: function (p) { return '<svg viewBox="0 0 36 36" style="transform:rotate(-90deg)"><circle class="trk" cx="18" cy="18" r="14"/>' + (p == null ? '' : '<circle cx="18" cy="18" r="14" stroke-dasharray="' + (Math.max(0, Math.min(1, p)) * 87.96).toFixed(2) + ' 87.96"/>') + '</svg>'; }
};
/* One colored tile. val null = Unavailable (the source sheet does not provide it); unit then says why. */
function tile(cls, icon, label, val, unit) {
  return '<div class="tile ' + cls + '"><div class="ti">' + icon + '</div><div class="tb"><div class="tl">' + label + '</div><div class="tv' + (val == null ? ' na' : '') + '">' + (val == null ? 'Unavailable' : val) + '</div><div class="tu">' + unit + '</div></div></div>';
}
/* Month and Year dropdowns follow the calendar (cal.ym). Fiscal year = April to March, named by the year it ends (2026FY = April 2025 to March 2026).
   The list holds the fiscal years found in the data plus the one being shown; months are listed April to March. */
var FM = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03'];
function fyOf(ym) { var y = +ym.slice(0, 4); return +ym.slice(5) >= 4 ? y + 1 : y; }
function yearOpts() {
  var ys = C.orderMonths().map(function (m) { return fyOf(m); }).concat(fyOf(cal.ym)).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
  opts($('mc-year'), ys.map(function (v) { return [String(v), v + 'FY']; }));
}
function syncYM() {
  var f = String(fyOf(cal.ym));
  if (!Array.prototype.some.call($('mc-year').options, function (o) { return o.value === f; })) yearOpts();
  $('mc-year').value = f; $('mc-month').value = cal.ym.slice(5);
}
function mcRender() {
  var fl = mcRows(), ym = cal.ym, y = +ym.slice(0, 4), m = +ym.slice(5) - 1, off = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), by = {}, h, d, i, key, cnt;
  fl.forEach(function (o) { (by[o.plannedStart] = by[o.plannedStart] || []).push(o); });
  $('mc-title').textContent = MN[m] + ' ' + y; syncYM();
  h = '<table class="cal"><tr>' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr><tr>';
  for (i = 0; i < off; i++) h += '<td class="e"></td>';
  for (d = 1; d <= dim; d++) {
    key = ym + '-' + ('0' + d).slice(-2); cnt = (by[key] || []).length;
    h += '<td data-d="' + key + '" class="' + (key == cal.sel ? 'sel' : '') + '"><div class="d">' + d + '</div>' +
      Dummy.day(by[key] || [], MC) + '</td>';
    if ((off + d) % 7 === 0 && d < dim) h += '</tr><tr>';
  }
  $('mc-grid').innerHTML = h + '</tr></table>';
  var rows = cal.sel ? (by[cal.sel] || []) : [];
  $('mc-dtitle').textContent = cal.sel ? 'Activities on ' + fd(cal.sel) : 'Select a date';
  $('mc-detail').innerHTML = !cal.sel ? '<div class="empty">Click a date to see its maintenance orders.</div>' : !rows.length ? '<div class="empty">No maintenance activity on this date.</div>' :
    '<table class="dt"><tr>' + OC.map(function (c) { return '<th>' + c.l + '</th>'; }).join('') + '</tr>' +
    rows.map(function (r) { return '<tr>' + OC.map(function (c) { return '<td>' + (c.f ? c.f(r) : r[c.k]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  var p = C.monthOrders(ym, fl), nd = 'no Status values in the source sheet', pa = p.attain;
  $('mc-kpis').innerHTML = tile('blue', TI.cal, 'Planned Maintenance', nf(p.total), 'jobs') + tile('green', TI.ok, 'Completed (Actual)', p.hasStatus ? nf(p.done) : null, p.hasStatus ? 'jobs' : nd) +
    tile('red', TI.warn, 'Overdue / Not Completed', p.hasStatus ? nf(p.overdue) : null, p.hasStatus ? 'jobs' : nd) +
    tile('teal', TI.ring(pa), 'Plan Attainment', pa == null ? null : nf(pa * 100, 1) + '%', pa == null ? (p.hasStatus ? 'no orders in this month' : nd) : nf(p.done) + ' of ' + nf(p.total) + ' planned');
  $('mc-ttitle').textContent = 'Maintenance orders starting in ' + MN[m] + ' ' + y;
  tbl('mc-table', OC, p.orders, mcRender, 'No maintenance orders start in this month.');
  var ms = C.orderMonths();
  chart('mc-c1', { type: 'bar', data: { labels: ms, datasets: [{ label: 'Orders', backgroundColor: MC, data: ms.map(function (x) { return C.monthOrders(x, fl).total; }) }] },
    options: { legend: { display: false }, scales: { yAxes: [{ ticks: { beginAtZero: true } }] } } });
}
/* ---------- Inventory Monitoring ---------- */
function kc(c, l, n, v) { return '<div class="kpi k-' + c + '"><div class="kl">' + l + '</div><div class="kv">' + nf(n) + '</div><div class="kn">' + Dummy.rp(v || 0) + '</div></div>'; }
function ivRender() {
  var pl = $('iv-plant').value, st = $('iv-status').value, ct = '', gp = $('iv-grp').value, ln = $('iv-line').value, mcn = $('iv-mc').value, q = $('iv-search').value.toLowerCase(), n = {}, cn = {};
  var rows = D.materials.map(C.inv).filter(function (r) { return (!pl || r.plant == pl) && (!st || r.status == st) && (!ct || r.category == ct) && (!gp || r.group == gp) && (!ln || r.line == ln) && (!mcn || r.machine == mcn) && (!q || (r.material + ' ' + r.description).toLowerCase().indexOf(q) >= 0); });
  var v = { all: 0 }; rows.forEach(function (r) { n[r.status] = (n[r.status] || 0) + 1; cn[r.category] = (cn[r.category] || 0) + 1; v.all += r.value || 0; v[r.status] = (v[r.status] || 0) + (r.value || 0); v[r.category] = (v[r.category] || 0) + (r.value || 0); });
  var sg = pl + '|' + st + '|' + ct + '|' + gp + '|' + ln + '|' + mcn + '|' + q; if (sg !== ivSig) { ivSig = sg; shown['iv-table'] = 0; }
  $('iv-count').textContent = nf(rows.length) + ' data found.';
  $('iv-kpis').innerHTML = kc('total', 'Total material master', rows.length, v.all) + kc('out', 'Out of stock', n['Out of Stock'] || 0, v['Out of Stock']) +
    kc('below', 'Below minimum', n['Below Minimum'] || 0, v['Below Minimum']) + kc('normal', 'Normal', n.Normal || 0, v.Normal) + kc('above', 'Above maximum', n['Above Maximum'] || 0, v['Above Maximum']) +
    kc('slow', 'Slow moving', cn['Slow Moving'] || 0, v['Slow Moving']) + kc('fast', 'Fast moving', cn['Fast Moving'] || 0, v['Fast Moving']);
  var q2 = function (v) { return nf(v); };
  tbl('iv-table', [{ k: 'plant', l: 'Plant', f: function (r) { return PN[r.plant] || r.plant; } }, { k: 'material', l: 'Material' }, { k: 'description', l: 'Description' },
    { k: 'min', l: 'Minimum Stock', n: 1, f: function (r) { return q2(r.min, r); } }, { k: 'max', l: 'Maximum Stock', n: 1, f: function (r) { return q2(r.max, r); } },
    { k: 'actual', l: 'Actual Stock', n: 1, f: function (r) { return q2(r.actual, r); } }, { k: 'gap', l: 'Gap', n: 1, f: function (r) { return r.gap == null ? 'Unavailable' : (r.gap > 0 ? '+' : '') + nf(r.gap); } },
    { k: 'status', l: 'Status', f: function (r) { return pill(r.status); } }, { k: 'category', l: 'Category', f: function (r) { return pill(r.category); } }], rows, ivRender, 'No materials match the selected filters.', 200);
}
/* ---------- Tabs and init ---------- */
var R = { rc: rcRender, mc: mcRender, iv: ivRender, rp: function () { if (window.RequestPR) window.RequestPR.render(); }, sm: function () { if (window.Summary) window.Summary.render(); } };   /* rp = Request PR, js/request-pr.js */
var cur = 'rc';
/* Open menus, most recent first: opened[0] is the menu on screen, the rest are minimized tabs. A minimized pane is only hidden,
   so its filters, calendar month, sorting and scroll position are still there when its tab is opened again. */
var opened = ['rc'], scrolled = {};
var XI = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function menu(t) { var b = document.querySelector('nav button[data-tab="' + t + '"]'); return { no: b.getAttribute('data-no'), name: b.getAttribute('data-name'), icon: b.innerHTML }; }
function pane(t) { return $('tab-' + t).querySelector('.content'); }
function drawTabs() {
  $('app-tabs').innerHTML = opened.map(function (t, i) {
    var m = menu(t), x = opened.length > 1 ? '<button class="tab-x" data-close="' + t + '" title="Close" aria-label="Close ' + esc(m.name) + '">' + XI + '</button>' : '';
    return i === 0 ? '<div class="tab on"><h1 id="app-title"><span class="no">' + esc(m.no) + '</span> ' + esc(m.name) + '</h1>' + x + '</div>' :
      '<div class="tab"><button class="tab-open" data-open="' + t + '" title="Open ' + esc(m.name) + '">' + m.icon + '<span>' + esc(m.no) + ' ' + esc(m.name) + '</span></button>' + x + '</div>';
  }).join('');
}
function show(t) {
  var i = opened.indexOf(t);
  if (!$('tab-' + cur).hidden) scrolled[cur] = pane(cur).scrollTop;
  cur = t;
  if (i >= 0) opened.splice(i, 1);
  opened.unshift(t);
  ['rc', 'mc', 'iv', 'rp', 'sm'].forEach(function (x) { $('tab-' + x).hidden = x != t; });
  Array.prototype.forEach.call(document.querySelectorAll('nav button'), function (b) { b.className = b.getAttribute('data-tab') == t ? 'on' : ''; });
  var m = menu(t);
  $('app-crumb').innerHTML = 'Transaction &#9656; ' + esc(m.no) + ' ' + esc(m.name);
  drawTabs();
  R[t]();
  pane(t).scrollTop = scrolled[t] || 0;
}
/* The last open tab cannot be closed (its x is not drawn), so there is always a menu on screen. */
function closeTab(t) {
  if (opened.length < 2) return;
  opened.splice(opened.indexOf(t), 1);
  if (t === cur) show(opened[0]); else drawTabs();
}
/* Filter options that depend on the data (plant list, order-type legend). Called at start and again whenever the sheet brings new data; the chosen plant is kept if it still exists. */
function dataFilters() {
  var el = $('iv-plant'), pl = el.value;
  opts(el, D.materials.map(function (m) { return m.plant; }).filter(function (p, i, a) { return a.indexOf(p) === i; }).sort().map(function (p) { return [p, PN[p] || p]; }), 'All plants');
  if (pl && Array.prototype.some.call(el.options, function (o) { return o.value === pl; })) el.value = pl;
  keepOpts($('mc-plant'), D.orders.map(function (o) { return o.plant; }).filter(function (p, i, a) { return a.indexOf(p) === i; }).sort().map(function (p) { return [p, PN[p] || p]; }), 'All plants');
  yearOpts();
}
/* Refill a dropdown and keep the chosen value if it still exists. */
function keepOpts(el, list, all) { var v = el.value; opts(el, list, all); if (v && Array.prototype.some.call(el.options, function (o) { return o.value === v; })) el.value = v; }
/* ---------- Google Sheets (Maintenance Calendar + Inventory Monitoring) ---------- */
var SD = window.SheetData, busy = false, good = '';
function setSrc(txt, bad) { var e = $('app-src'); e.textContent = txt; e.title = txt; e.className = 'src' + (bad ? ' bad' : ''); }
function hhmm(d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
function mcOpts() { return Object.keys(Dummy.mc).sort().map(function (k) { return [k, k + ' ' + Dummy.mc[k][0]]; }); }
function rcRefresh() {
  var f = $('rc-from').value, t = $('rc-to').value, ml = D.rel.months.map(function (m) { return [m, m]; }), has = function (v) { return ml.some(function (x) { return x[0] == v; }); };
  opts($('rc-from'), ml); opts($('rc-to'), ml); $('rc-from').value = has(f) ? f : ml[0][0]; $('rc-to').value = has(t) ? t : ml[ml.length - 1][0]; rcSec();
}
function loadSheets() {
  if (!SD || busy) return;
  busy = true;
  SD.load(function (err, r) {
    busy = false;
    if (err) { setSrc('Calendar and Inventory: ' + (good ? 'last good read ' + good + ', refresh failed: ' : 'copy from js/data.js, Google Sheets problem: ') + err.message, 1); return; }
    good = hhmm(r.at);
    if (r.changed) {
      D.orders = r.orders; D.materials = r.materials;
      if (C.orderMonths().indexOf(cal.ym) < 0) { cal.ym = C.orderMonths()[0]; cal.sel = null; }
      dataFilters();
      if (cur !== 'rc') R[cur]();   /* the other module is drawn from the new data the next time it is opened */
    }
    var ig = r.skipped.orders + r.skipped.materials;
    setSrc('Calendar and Inventory: Google Sheets, ' + nf(r.orders.length) + ' orders and ' + nf(r.materials.length) + ' materials, read at ' + good +
      (ig ? ', ' + nf(ig) + ' invalid rows ignored (' + r.skipped.orders + ' orders, ' + r.skipped.materials + ' materials)' : '') +
      (r.byTitle.orders && r.byTitle.materials ? '' : ', columns read by position'), ig > 0);
    if (SD.loadExtra) SD.loadExtra(function (err, chg) {
      var el = $('app-src'), t = el.textContent + (err ? ' | Reliability and Summary tabs: copy from js/data.js and js/dummy.js (' + err.message + ')' : ' | Reliability and Summary tabs: Google Sheets');
      el.textContent = t; el.title = t; if (err) el.className = 'src bad';
      if (chg) { rcRefresh(); keepOpts($('iv-line'), Dummy.lines.map(function (x) { return [x, x]; }), 'All lines'); keepOpts($('iv-mc'), mcOpts(), 'All machines'); keepOpts($('mc-line'), Dummy.lines.map(function (x) { return [x, x]; }), 'All lines'); dataFilters(); if (window.Summary) window.Summary.reset(); R[cur](); }
    });
  });
}
function init() {
  var ml = D.rel.months.map(function (m) { return [m, m]; }), sites = [];
  D.rel.sections.forEach(function (s) { if (sites.indexOf(s.site) < 0) sites.push(s.site); });
  opts($('rc-from'), ml); opts($('rc-to'), ml); $('rc-from').value = '2026-02'; $('rc-to').value = D.rel.months[D.rel.months.length - 1];
  opts($('rc-site'), sites.map(function (x) { return [x, x]; }), 'All sites'); rcSec();
  ['rc-from', 'rc-to', 'rc-sec', 'rc-metric'].forEach(function (i) { $(i).onchange = rcRender; });
  $('rc-site').onchange = function () { rcSec(); rcRender(); };
  opts($('iv-status'), Object.keys(IS).map(function (s) { return [s, s]; }), 'All statuses');
  opts($('iv-grp'), [['Main Component', 'Main Component'], ['Aksesoris', 'Aksesoris']], 'All categories');
  opts($('iv-line'), Dummy.lines.map(function (x) { return [x, x]; }), 'All lines'); opts($('iv-mc'), mcOpts(), 'All machines');
  opts($('mc-month'), FM.map(function (mm) { return [mm, MN[+mm - 1]]; }));
  opts($('mc-line'), Dummy.lines.map(function (x) { return [x, x]; }), 'All lines');
  opts($('mc-status'), [['Complete', 'Complete'], ['Overdue / Not Complete', 'Overdue / Not Complete']], 'All statuses');
  dataFilters();
  $('iv-plant').onchange = $('iv-status').onchange = $('iv-grp').onchange = $('iv-line').onchange = $('iv-mc').onchange = $('iv-search').oninput = ivRender;
  $('mc-plant').onchange = $('mc-line').onchange = $('mc-status').onchange = $('mc-search').oninput = mcRender;
  $('mc-month').onchange = $('mc-year').onchange = function () { cal.ym = (+$('mc-month').value >= 4 ? +$('mc-year').value - 1 : +$('mc-year').value) + '-' + $('mc-month').value; cal.sel = null; mcRender(); };
  $('mc-prev').onclick = function () { cal.ym = C.mAdd(cal.ym, -1); cal.sel = null; mcRender(); };
  $('mc-next').onclick = function () { cal.ym = C.mAdd(cal.ym, 1); cal.sel = null; mcRender(); };
  $('mc-grid').onclick = function (e) { var el = e.target; while (el && el.getAttribute && !el.getAttribute('data-d')) el = el.parentNode; if (el && el.getAttribute) { cal.sel = el.getAttribute('data-d'); mcRender(); } };
  Array.prototype.forEach.call(document.querySelectorAll('nav button'), function (b) { b.onclick = function () { show(b.getAttribute('data-tab')); }; });
  $('app-tabs').onclick = function (e) {
    var el = e.target, o, c;
    while (el && el !== this) {
      c = el.getAttribute && el.getAttribute('data-close'); o = el.getAttribute && el.getAttribute('data-open');
      if (c) return closeTab(c);
      if (o) return show(o);
      el = el.parentNode;
    }
  };
  $('app-refresh').onclick = function () { loadSheets(); R[cur](); };
  Array.prototype.forEach.call(document.querySelectorAll('[data-apply]'), function (b) { b.onclick = function () { R[cur](); }; });
  show('rc');
  setSrc('Calendar and Inventory: ' + (SD ? 'copy from js/data.js, reading Google Sheets...' : 'copy from js/data.js (js/sheets.js not loaded)'));
  loadSheets();
  if (SD && SD.config.refreshMinutes > 0) setInterval(function () { if (!document.hidden) loadSheets(); }, SD.config.refreshMinutes * 60000);
}
init();
})();
