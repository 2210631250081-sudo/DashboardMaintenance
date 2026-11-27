/* Summary (menu 05): ONE fixed 1600x900 page (no scrolling) scaled to the window. Reliability & Cost on the left; maintenance schedule and consumable inventory on the right.
   Same Calc functions as the other menus. Clicking a date in the schedule opens a pop-up with the machine numbers and names of that date. */
(function () {
var D = window.DemoData, C = window.Calc, X = window.Dummy, ch = {}, ym = null, sel = null, dm = {};
function $(i) { return document.getElementById(i); }
function e(s) { return X.e(s); }
function nf(n, d) { return n == null || isNaN(n) ? '-' : n.toLocaleString('id-ID', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
function tile(c, l, v, u) { return '<div class="sm-t sm-' + c + '"><b>' + v + '</b><span>' + l + (u ? ' <i>' + u + '</i>' : '') + '</span></div>'; }
function draw(id, cfg) { if (!window.Chart) return; if (ch[id]) ch[id].destroy(); ch[id] = new Chart($(id), cfg); }
function opt(t) { var a = { ticks: { fontSize: 9 } }; return { responsive: true, maintainAspectRatio: false, title: { display: true, text: t, fontSize: 11 }, legend: { display: false }, scales: { xAxes: [a], yAxes: [a] } }; }
function mno(o) { return String(o.equipmentNo).slice(-5); }
function mach() {
  var f = $('sm-fac').value, l = $('sm-line').value, n = $('sm-no').value, nm = $('sm-nm').value;
  return Object.keys(X.perf).filter(function (k) { var m = X.mc[k]; return m && (!f || m[1] == f) && (!l || m[2] == l) && (!n || k == n) && (!nm || m[0] == nm); });
}
function mm(k) {   /* perf = [Jam Kerja h, Stop Planning h, Breakdown min, Frequency, Consumable Cost Rp]; formulas of the KALKULASI slide */
  var p = X.perf[k], lt = p[0] - p[1], bd = p[2] / 60;
  return { k: k, m: X.mc[k], lt: lt, bd: bd, fr: p[3], ir: bd / lt * 100, mttr: bd / p[3], mtbf: lt / p[3], cost: p[4] };
}
function cal(list) {
  var y = +ym.slice(0, 4), m = +ym.slice(5) - 1, off = new Date(Date.UTC(y, m, 1)).getUTCDay(), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), by = {}, d, k, i,
    h = '<table><tr>' + ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr><tr>';
  list.forEach(function (o) { (by[o.plannedStart] = by[o.plannedStart] || []).push(o); });
  dm = by;
  for (i = 0; i < off; i++) h += '<td></td>';
  for (d = 1; d <= dim; d++) {
    k = ym + '-' + ('0' + d).slice(-2);
    h += '<td' + (by[k] ? ' class="has" data-d="' + k + '"' : '') + '><div class="d">' + d + '</div>' + (by[k] ? '<i class="sm-dot"></i>' : '') + '</td>';
    if ((off + d) % 7 === 0 && d < dim) h += '</tr><tr>';
  }
  return h + '</tr></table>';
}
function build(root) {
  var ks = Object.keys(X.perf);
  function u(f) { return ks.map(f).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(); }
  function fill(id, a) { $(id).innerHTML = '<option value="">All</option>' + a.map(function (v) { return '<option value="' + e(v) + '">' + e(v) + '</option>'; }).join(''); $(id).onchange = render; }
  function cv(id) { return '<div class="sm-cv"><canvas id="' + id + '"></canvas></div>'; }
  root.innerHTML = '<div class="sm-st" id="sm-stage"><div class="sm-top"><div class="sm-ttl"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>MAINTENANCE CALENDAR &amp; PERFORMANCE DASHBOARD</div>' +
    '<div class="sm-bar"><div class="sm-today">Today<br><b id="sm-today"></b></div><label>Factory<select id="sm-fac"></select></label><label>Line<select id="sm-line"></select></label><label>Machine No.<select id="sm-no"></select></label><label>Machine Name<select id="sm-nm"></select></label></div></div>' +
    '<div class="sm-L"><div class="sm-h">Reliability &amp; Cost</div><div class="sm-row" id="sm-k1"></div>' +
    '<div class="sm-mid"><div class="sm-charts">' + cv('sm-c1') + cv('sm-c2') + cv('sm-c3') + '</div><div class="sm-side"><div class="sm-box"><div class="sm-bt">Worst Machine</div><div id="sm-w"></div></div><div class="sm-box"><div class="sm-bt">Detail Masalah</div><div id="sm-d"></div></div></div></div>' +
    '<div class="sm-box sm-grow"><div class="sm-bt">Maintenance Performance Detail</div><div id="sm-tb"></div></div></div>' +
    '<div class="sm-R"><div class="sm-row" id="sm-k2"></div><div class="sm-box"><div class="sm-bt"><button id="sm-prev">&lsaquo;</button> Maintenance Schedule &ndash; <span id="sm-ct"></span> <button id="sm-next">&rsaquo;</button><span class="sm-lg"><i class="sm-dot"></i> PM Plan</span></div><div class="sm-cal" id="sm-cal"></div></div>' +
    '<div class="sm-h">Consumable Inventory Spare Part</div><div class="sm-row" id="sm-k3"></div><div class="sm-row sm-2">' + cv('sm-c4') + cv('sm-c5') + '</div>' +
    '<div class="sm-box"><div class="sm-bt">Stock Status</div><div class="sm-sb" id="sm-sb"></div></div>' +
    '<div class="sm-bot"><div class="sm-box"><div class="sm-bt">Top 10 Low Stock &amp; Out of Stock</div><div id="sm-top"></div></div><div class="sm-col" id="sm-k4"></div></div></div>' +
    '<div class="sm-pop" id="sm-pop" hidden><div><div class="sm-bt"><span id="sm-pt"></span><button id="sm-px">&times;</button></div><table><tr><th>Machine No.</th><th>Machine Name</th><th>Line</th></tr><tbody id="sm-pb"></tbody></table></div></div></div>';
  fill('sm-fac', u(function (k) { return X.mc[k][1]; })); fill('sm-line', u(function (k) { return X.mc[k][2]; }));
  fill('sm-no', ks.slice().sort()); fill('sm-nm', u(function (k) { return X.mc[k][0]; }));
  $('sm-prev').onclick = function () { ym = C.mAdd(ym, -1); render(); };
  $('sm-next').onclick = function () { ym = C.mAdd(ym, 1); render(); };
  $('sm-w').onclick = function (ev) { var el = ev.target; while (el && el !== this && !el.getAttribute('data-w')) el = el.parentNode; if (el && el !== this) { sel = el.getAttribute('data-w'); render(); } };
  $('sm-cal').onclick = function (ev) {
    var el = ev.target, k, s = {}, h = '';
    while (el && el !== this && !el.getAttribute('data-d')) el = el.parentNode;
    if (!el || el === this) return;
    k = el.getAttribute('data-d');
    (dm[k] || []).forEach(function (o) { var n = mno(o); if (s[n]) return; s[n] = 1; h += '<tr><td>' + n + '</td><td>' + e(o.machineName || (X.mc[n] ? X.mc[n][0] : '')) + '</td><td>' + e(o.line || (X.mc[n] ? X.mc[n][2] : '')) + '</td></tr>'; });
    $('sm-pt').textContent = k + ' - ' + Object.keys(s).length + ' machines'; $('sm-pb').innerHTML = h; $('sm-pop').hidden = false;
  };
  $('sm-pop').onclick = function (ev) { if (ev.target === this || ev.target.id === 'sm-px') this.hidden = true; };
}
function fit() {
  var r = $('sm-root'), s = $('sm-stage'), W, H, k;
  if (!r || !s || !r.clientWidth) return;
  W = r.clientWidth; H = Math.max(300, window.innerHeight - r.getBoundingClientRect().top - 6); k = Math.min(W / 1600, H / 900);
  r.style.height = H + 'px'; s.style.width = (W / k) + 'px'; s.style.height = (H / k) + 'px'; s.style.left = '0'; s.style.transform = 'scale(' + k + ')';
}
function render() {
  var root = $('sm-root'); if (!root) return;
  if (!$('sm-fac')) build(root);
  fit();
  if (!ym) { var om = C.orderMonths(); ym = om.length ? om.sort(function (a, b) { return C.monthOrders(b).total - C.monthOrders(a).total; })[0] : new Date().toISOString().slice(0, 7); }
  var ks = mach(), set = {}, ms = ks.map(mm), cost = 0, T = X.tg, mo = D.rel.months, f = { from: mo[0], to: mo[mo.length - 1] }, rel = C.reliability(f), sr = C.series(f);
  ks.forEach(function (k) { set[k] = 1; }); ms.forEach(function (x) { cost += x.cost; });
  $('sm-today').textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  /* Reliability & Cost: IR, MTTR, MTBF from the Call System KPI (all sections); cost, worst machine and table follow the machine filters */
  $('sm-k1').innerHTML = tile('blue', 'IR', nf(rel.ir, 1) + ' %', 'Target &le; ' + T.ir + ' %') + tile('green', 'MTTR', nf(rel.mttr, 1) + ' h', 'Target &le; ' + T.mttr + ' h') +
    tile('purple', 'MTBF', nf(rel.mtbf, 0) + ' h', 'Target &ge; ' + T.mtbf + ' h') + tile('orange', 'Consumable Cost', X.rp(cost), 'Plan ' + X.rp(cost * T.costPlan));
  [['sm-c1', 'ir', 'IR (%)', T.ir, '#1565c0'], ['sm-c2', 'mttr', 'MTTR (h)', T.mttr, '#2e7d32'], ['sm-c3', 'mtbf', 'MTBF (h)', T.mtbf, '#6a1b9a']].forEach(function (c) {
    draw(c[0], { type: 'line', data: { labels: sr.labels, datasets: [{ label: 'Actual', data: sr[c[1]], borderColor: c[4], backgroundColor: c[4], fill: false, lineTension: 0 },
      { label: 'Plan', data: sr.labels.map(function () { return c[3]; }), borderColor: '#d32f2f', borderDash: [5, 4], pointRadius: 0, fill: false }] }, options: opt(c[2]) });
  });
  var any = $('sm-fac').value || $('sm-line').value || $('sm-no').value || $('sm-nm').value, s,
    w = (X.worst || []).filter(function (r) { return !any || set[r.mc]; }).sort(function (a, b) { return b.down - a.down; }).slice(0, 5).map(function (r) { return { k: r.mc, m: [r.type, '', r.line, r.maker], bd: r.down, fr: r.freq, mttr: r.freq ? r.down / r.freq : null, u: '' }; });
  if (!X.worst || !X.worst.length) w = ms.slice().sort(function (a, b) { return b.bd - a.bd; }).slice(0, 5);
  s = w.filter(function (x) { return x.k == sel; })[0] || w[0];
  $('sm-w').innerHTML = w.map(function (x, i) { return '<div class="sm-w' + (s && x.k == s.k ? ' on' : '') + '" data-w="' + x.k + '"><b>' + (i + 1) + '. ' + x.k + '</b> ' + e(x.m[0]) + '<span>' + nf(x.bd, 1) + (x.u == null ? ' h' : x.u) + ' &middot; ' + x.fr + 'x</span></div>'; }).join('') || '<div>No machine.</div>';
  $('sm-d').innerHTML = s ? '<b>' + s.k + ' ' + e(s.m[0]) + '</b> (' + e(s.m[2]) + ', ' + e(s.m[3]) + ')<br>Down time ' + nf(s.bd, 1) + (s.u == null ? ' h' : s.u) + ', ' + s.fr + ' times, per trouble ' + nf(s.mttr, 1) + (s.u == null ? ' h' : s.u) + '<ul>' +
    [0, 1, 2].map(function (i) { return '<li>' + X.iss[(+s.k + i) % X.iss.length] + '</li>'; }).join('') + '</ul>' : '';
  var pl = {}, ac = {}, t = { p: 0, a: 0, bd: 0, lt: 0, fr: 0, c: 0 };
  D.orders.forEach(function (o) { var k = mno(o); pl[k] = (pl[k] || 0) + 1; if (o.status === 'Complete') ac[k] = (ac[k] || 0) + 1; });
  ms.forEach(function (x) { t.p += pl[x.k] || 0; t.a += ac[x.k] || 0; t.bd += x.bd; t.lt += x.lt; t.fr += x.fr; t.c += x.cost; });
  function row(c, tot) { return '<tr' + (tot ? ' class="tot"' : '') + '>' + c.map(function (v, i) { return '<td' + (i > 3 ? ' class="num"' : '') + '>' + v + '</td>'; }).join('') + '</tr>'; }
  $('sm-tb').innerHTML = '<table><tr>' + ['Factory', 'Line', 'Machine No.', 'Machine Name', 'Plan (Year)', 'Actual (Year)', 'Plan Att. %', 'IR %', 'MTTR (h)', 'MTBF (h)', 'Consumable Cost'].map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' +
    ms.slice().sort(function (a, b) { return b.ir - a.ir; }).slice(0, 12).map(function (x) { var p = pl[x.k] || 0, a = ac[x.k] || 0;
      return row([e(x.m[1]), e(x.m[2]), x.k, e(x.m[0]), p, a, p ? nf(a / p * 100, 1) + '%' : '-', nf(x.ir, 1) + '%', nf(x.mttr, 1), nf(x.mtbf, 0), X.rp(x.cost)]); }).join('') +
    row(['Total', '', '', ms.length + ' machines', t.p, t.a, t.p ? nf(t.a / t.p * 100, 1) + '%' : '-', t.lt ? nf(t.bd / t.lt * 100, 1) + '%' : '-', t.fr ? nf(t.bd / t.fr, 1) : '-', t.fr ? nf(t.lt / t.fr, 0) : '-', X.rp(t.c)], 1) + '</table>';
  /* Maintenance schedule: preventive orders of the selected machines, month by month */
  var all = D.orders.filter(function (o) { return set[mno(o)]; }), p = C.monthOrders(ym, all);
  $('sm-ct').textContent = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5) - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  $('sm-k2').innerHTML = tile('blue', 'Planned Maintenance', nf(p.total), 'jobs') + tile('green', 'Completed (Actual)', p.hasStatus ? nf(p.done) : '-', 'jobs') +
    tile('red', 'Overdue / Not Completed', p.hasStatus ? nf(p.overdue) : '-', 'jobs') + tile('teal', 'Plan Attainment', p.attain == null ? '-' : nf(p.attain * 100, 1) + ' %', p.hasStatus ? p.done + ' / ' + p.total : '');
  $('sm-cal').innerHTML = cal(p.orders);
  /* Consumable inventory (all plants) */
  var iv = D.materials.map(C.inv), n = { 'Out of Stock': 0, 'Below Minimum': 0, Normal: 0, 'Above Maximum': 0 }, g = {}, tv = 0, gk;
  iv.forEach(function (r) { n[r.status]++; if (r.value) { tv += r.value; g[r.group] = (g[r.group] || 0) + r.value; } });
  gk = Object.keys(g);
  $('sm-k3').innerHTML = tile('blue', 'Total Item', nf(iv.length)) + tile('green', 'Total Value', X.rp(tv)) + tile('orange', 'Low Stock', nf(n['Below Minimum']), 'item') + tile('red', 'Out of Stock', nf(n['Out of Stock']), 'item');
  draw('sm-c4', { type: 'doughnut', data: { labels: gk, datasets: [{ data: gk.map(function (k) { return Math.round(g[k] / 1e6); }), backgroundColor: gk.map(function (k, j) { return X.gc[j % X.gc.length]; }) }] },
    options: { responsive: true, maintainAspectRatio: false, title: { display: true, text: 'Inventory Value by Category (Rp million)', fontSize: 11 }, legend: { position: 'right', labels: { fontSize: 10, boxWidth: 10 } } } });
  draw('sm-c5', { type: 'line', data: { labels: X.tm, datasets: [{ label: 'Rp million', data: (X.tv || X.tf.map(function (v) { return tv * v; })).map(function (v) { return Math.round(v / 1e6); }), borderColor: '#1565c0', backgroundColor: '#1565c0', fill: false, lineTension: 0 }] }, options: opt('Inventory Value Trend (Rp million)') });
  $('sm-sb').innerHTML = [['Normal', n.Normal, '#2e7d32'], ['Above Max', n['Above Maximum'], '#484848'], ['Low', n['Below Minimum'], '#d9822b'], ['Out', n['Out of Stock'], '#c1272d']].map(function (c) {
    return '<div style="flex:' + c[1] + ';background:' + c[2] + '" title="' + c[0] + ': ' + nf(c[1]) + '">' + nf(c[1] / iv.length * 100) + '%</div>'; }).join('');
  $('sm-k4').innerHTML = tile('blue', 'Inventory Turnover (YTD)', T.turn[0] + 'x', 'Target &ge; ' + T.turn[1] + 'x') + tile('green', 'Inventory Accuracy', T.acc + ' %');
  $('sm-top').innerHTML = '<table><tr><th>Part Number</th><th>Description</th><th>On Hand</th><th>Min Stock</th><th>Status</th></tr>' +
    iv.filter(function (r) { return r.status == 'Out of Stock' || r.status == 'Below Minimum'; }).sort(function (a, b) { return (a.status == b.status ? 0 : a.status == 'Out of Stock' ? -1 : 1) || (b.min - a.min); }).slice(0, 10).map(function (r) {
      return '<tr><td>' + e(r.material) + '</td><td>' + e(r.description) + '</td><td class="num">' + nf(r.actual) + '</td><td class="num">' + nf(r.min) + '</td><td>' + r.status + '</td></tr>'; }).join('') + '</table>';
  fit();
}
window.addEventListener('resize', fit);
window.Summary = { render: render, reset: function () { var r = $('sm-root'); if (r) r.innerHTML = ''; } };
})();
