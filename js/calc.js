/* Pure calculation functions: no DOM access. Every KPI, chart and table value comes from here. */
(function () {
var D = window.DemoData, C = {};
function sum(a, f) { var t = 0; a.forEach(function (x) { t += f(x); }); return t; }
C.mAdd = function (ym, n) { return new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5) - 1 + n, 1)).toISOString().slice(0, 7); };
C.mDiff = function (a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5) - +a.slice(5)); };
C.monthsIn = function (f) { var o = [], m = f.from; while (m <= f.to) { o.push(m); m = C.mAdd(m, 1); } return o; };
C.inRange = function (d, f) { var m = d.slice(0, 7); return m >= f.from && m <= f.to; };
function siteOf(id) { var r = null; D.rel.sections.forEach(function (s) { if (s.id == id) r = s; }); return r; }
/* Reliability formulas (KALKULASI slide): IR = Breakdown Time / Loading Time; MTTR = Breakdown Time / Breakdown Frequency; MTBF = Loading Time / Breakdown Frequency.
   Times are stored in minutes; MTTR and MTBF are returned in hours. Sums are taken first, then divided (never an average of monthly ratios). */
C.reliability = function (f) {
  var a = D.rel.rows.filter(function (r) { return C.inRange(r.month, f) && (!f.site || siteOf(r.section).site == f.site) && (!f.section || r.section == f.section); }),
    L = sum(a, function (r) { return r.load; }), T = sum(a, function (r) { return r.trouble; }), N = sum(a, function (r) { return r.freq; });
  return { loadH: L / 60, troubleH: T / 60, freq: N, ir: L ? T / L * 100 : null, mttr: N ? T / N / 60 : null, mtbf: N && L ? L / N / 60 : null };
};
C.series = function (f) {
  var s = { labels: C.monthsIn(f), ir: [], mttr: [], mtbf: [] };
  s.labels.forEach(function (m) {
    var x = C.reliability({ from: m, to: m, site: f.site, section: f.section });
    s.ir.push(x.ir); s.mttr.push(x.mttr); s.mtbf.push(x.mtbf);
  });
  return s;
};
C.bySection = function (f) {
  return D.rel.sections.filter(function (s) { return !f.site || s.site == f.site; }).map(function (s) {
    var x = C.reliability({ from: f.from, to: f.to, section: s.id });
    return { id: s.id, group: s.group, site: s.site, loadH: x.loadH, troubleH: x.troubleH, freq: x.freq, ir: x.ir, mttr: x.mttr, mtbf: x.mtbf };
  });
};
C.prev = function (f) {
  var n = C.mDiff(f.from, f.to) + 1, p = { from: C.mAdd(f.from, -n), to: C.mAdd(f.from, -1) };
  return p.from < D.rel.months[0] ? null : p;
};
function uniq(v, i, a) { return a.indexOf(v) === i; }
C.orderMonths = function () { return D.orders.map(function (o) { return o.plannedStart.slice(0, 7); }).filter(uniq).sort(); };
C.orderTypes = function () { return D.orders.map(function (o) { return o.type; }).filter(uniq).sort(); };
/* Orders whose planned start date falls in month ym. The source sheet has no status, end date or confirmation, so no completion rate is calculated. */
C.monthOrders = function (ym) {
  var o = D.orders.filter(function (x) { return x.plannedStart.slice(0, 7) == ym; }), by = {}, eq = {};
  C.orderTypes().forEach(function (t) { by[t] = 0; });
  o.forEach(function (x) { by[x.type]++; eq[x.equipmentNo] = 1; });
  return { orders: o, total: o.length, byType: by, equipment: Object.keys(eq).length };
};
/* Inventory has two separate fields.
   Category (by Minimum / Maximum): Slow Moving = Minimum and Maximum are both not set (0 or empty; in SAP an unmaintained Min/Max reads as 0). Fast Moving = Minimum and/or Maximum is set.
   Status, first match wins:
   1 Out of Stock: Actual Stock is 0 (for every category).   2 Unclassified: Minimum not set but Maximum is.   3 Below Minimum (only when a Minimum is set).
   4 Above Maximum (only when a Maximum is set).   5 Normal. A Slow Moving material has no Minimum or Maximum to cross, so with stock it is Normal.
   Gap = Actual - Minimum, null (Unavailable) when no Minimum is set. min and max are returned as they came in; only the rules treat 0 as "not set". */
C.inv = function (m) {
  var mn = m.min > 0 ? m.min : null, mx = m.max > 0 ? m.max : null,
    cat = mn == null && mx == null ? 'Slow Moving' : 'Fast Moving',
    st = m.actual === 0 ? 'Out of Stock' : mn == null ? (mx == null ? 'Normal' : 'Unclassified') : m.actual < mn ? 'Below Minimum' :
    (mx != null && m.actual > mx) ? 'Above Maximum' : 'Normal';
  return { plant: m.plant, material: m.material, description: m.description, unit: m.unit, min: m.min, max: m.max, actual: m.actual,
    gap: mn == null ? null : m.actual - mn, status: st, category: cat };
};
window.Calc = C;
})();
