// Run: node test/validate.js  (checks data consistency and calculations; does not test the browser UI)
global.window = global;
require('../js/data.js'); require('../js/calc.js'); require('../js/sheets.js');
var D = DemoData, C = Calc, ok = 0, bad = 0;
function t(name, cond, info) { (cond ? ok++ : bad++); console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  [' + info + ']' : '')); }
function near(a, b, e) { return a != null && Math.abs(a - b) <= e; }

/* ---- Reliability: expected IR / MTTR / MTBF are the values printed in CALL SISTEM 2026.xlsx, sheet "new section" ---- */
var all = { from: '2025-10', to: '2026-04' };
t('35 rows = 5 sections x 7 months', D.rel.rows.length === 35 && D.rel.sections.length === 5 && D.rel.months.length === 7);
t('every row has load, trouble, frequency > 0 and a known section', D.rel.rows.every(function (r) { return r.load > 0 && r.trouble > 0 && r.freq > 0 && D.rel.sections.some(function (s) { return s.id === r.section; }); }));
function chk(label, f, ir, mttr, mtbf) { var x = C.reliability(f); t(label, near(x.ir, ir, .005) && near(x.mttr, mttr, .005) && near(x.mtbf, mtbf, .005), x.ir.toFixed(2) + ' / ' + x.mttr.toFixed(2) + ' / ' + x.mtbf.toFixed(2)); }
chk('ALL Oct 2025 matches report (5.34 / 6.20 / 116.12)', { from: '2025-10', to: '2025-10' }, 5.34, 6.20, 116.12);
chk('ALL Jan 2026 matches report (5.57 / 5.41 / 97.12)', { from: '2026-01', to: '2026-01' }, 5.57, 5.41, 97.12);
chk('ALL Apr 2026 matches report (5.21 / 5.73 / 110.04)', { from: '2026-04', to: '2026-04' }, 5.21, 5.73, 110.04);
chk('Cikarang Jan 2026 matches report (6.05 / 7.77 / 128.55)', { from: '2026-01', to: '2026-01', site: 'Cikarang' }, 6.05, 7.77, 128.55);
chk('Karawang Apr 2026 matches report (5.20 / 3.18 / 61.23)', { from: '2026-04', to: '2026-04', site: 'Karawang' }, 5.20, 3.18, 61.23);
var ck = C.reliability({ from: all.from, to: all.to, site: 'Cikarang' }), kw = C.reliability({ from: all.from, to: all.to, site: 'Karawang' }), al = C.reliability(all);
t('Cikarang + Karawang = all (loading, breakdown, frequency)', near(ck.loadH + kw.loadH, al.loadH, 1e-6) && near(ck.troubleH + kw.troubleH, al.troubleH, 1e-6) && ck.freq + kw.freq === al.freq);
t('formulas: IR = T/L, MTTR = T/N, MTBF = L/N', near(al.ir, al.troubleH / al.loadH * 100, 1e-9) && near(al.mttr, al.troubleH / al.freq, 1e-9) && near(al.mtbf, al.loadH / al.freq, 1e-9));
t('series has one point per month', C.series(all).labels.length === 7 && C.series(all).ir.length === 7);
t('bySection: 5 sections, 3 for Cikarang', C.bySection(all).length === 5 && C.bySection({ from: all.from, to: all.to, site: 'Cikarang' }).length === 3);
t('empty selection gives null (Unavailable), not 0', C.reliability({ from: '2027-01', to: '2027-02' }).ir === null);
t('previous period: 2026-02..04 -> 2025-11..2026-01', JSON.stringify(C.prev({ from: '2026-02', to: '2026-04' })) === '{"from":"2025-11","to":"2026-01"}');
t('no previous period for the full range', C.prev(all) === null);

/* ---- Maintenance orders: Data_dashboard.xlsx, sheet Maintenance_Kalender ---- */
var o = D.orders;
t('719 orders, all order numbers unique and 7 digits', o.length === 719 && o.every(function (x) { return /^\d{7}$/.test(x.order); }) && Object.keys(o.reduce(function (a, x) { a[x.order] = 1; return a; }, {})).length === 719);
t('all planned start dates are valid YYYY-MM-DD', o.every(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x.plannedStart) && !isNaN(Date.parse(x.plannedStart)); }));
t('order types ZPM1 10 / ZPM2 709', JSON.stringify(C.orderTypes()) === '["ZPM1","ZPM2"]' && o.filter(function (x) { return x.type === 'ZPM1'; }).length === 10 && o.filter(function (x) { return x.type === 'ZPM2'; }).length === 709);
t('months May 22 / Jun 179 / Jul 273 / Aug 192 / Sep 52 / Oct 1', JSON.stringify(C.orderMonths()) === '["2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"]' && C.monthOrders('2026-05').total === 22 && C.monthOrders('2026-06').total === 179 && C.monthOrders('2026-07').total === 273 && C.monthOrders('2026-08').total === 192 && C.monthOrders('2026-09').total === 52 && C.monthOrders('2026-10').total === 1);
t('month type counts add up to month total', C.orderMonths().every(function (m) { var x = C.monthOrders(m); return x.byType.ZPM1 + x.byType.ZPM2 === x.total; }));
t('304 distinct equipment overall; plant 6410 has 699 orders and plant 6420 has 20', Object.keys(o.reduce(function (a, x) { a[x.equipmentNo] = 1; return a; }, {})).length === 304 && o.filter(function (x) { return x.plant === '6410'; }).length === 699 && o.filter(function (x) { return x.plant === '6420'; }).length === 20);
t('every order has a description (null when empty: only order 5119351 has no description in the sheet)', o.every(function (x) { return x.description === null || (typeof x.description === 'string' && x.description.length > 0); }) && o.filter(function (x) { return x.description === null; }).length === 1 && o.filter(function (x) { return x.description === null; })[0].order === '5119351');
t('a month without orders is empty, not an error', C.monthOrders('2027-01').total === 0 && C.monthOrders('2027-01').equipment === 0);

/* ---- Inventory: Data_dashboard.xlsx, sheet Min_Max_Stok ---- */
var inv = D.materials.map(C.inv), n = {};
inv.forEach(function (x) { n[x.status] = (n[x.status] || 0) + 1; });
t('inventory 16127 rows, each plant + material pair is unique (8334 distinct materials)', inv.length === 16127 && Object.keys(inv.reduce(function (a, x) { a[x.plant + '|' + x.material] = 1; return a; }, {})).length === 16127 && Object.keys(inv.reduce(function (a, x) { a[x.material] = 1; return a; }, {})).length === 8334);
t('inventory: plant 6410 has 7899 rows and plant 6420 has 8228 rows, no other plant', inv.filter(function (x) { return x.plant === '6410'; }).length === 7899 && inv.filter(function (x) { return x.plant === '6420'; }).length === 8228 && inv.every(function (x) { return x.plant === '6410' || x.plant === '6420'; }));
t('inventory: every row has minimum > 0 and maximum >= minimum, or no minimum and no maximum (Slow Moving)', inv.every(function (x) { return (x.min > 0 && x.max >= x.min) || x.category === 'Slow Moving'; }));
t('inventory: Category is Slow Moving or Fast Moving for every row, and Status is never Slow Moving', inv.every(function (x) { return (x.category === 'Slow Moving' || x.category === 'Fast Moving') && x.status !== 'Slow Moving' && x.status !== 'Fast Moving'; }));
t('inventory status counts add up to the total', Object.keys(n).reduce(function (a, k) { return a + n[k]; }, 0) === 16127, JSON.stringify(n));
t('inventory status counts match the Excel sheet (Out 1011 / Below 3132 / Normal 9556 / Above 2428)', n['Out of Stock'] === 1011 && n['Below Minimum'] === 3132 && n.Normal === 9556 && n['Above Maximum'] === 2428, JSON.stringify(n));
t('gap = actual - min; null (Unavailable) when min is 0 or empty', inv.every(function (x) { return !(x.min > 0) ? x.gap === null : x.gap === x.actual - x.min; }));
t('status rules on sample records', C.inv({ plant: '6410', material: 'X', description: '', min: 4, max: 10, actual: 2 }).status === 'Below Minimum' && C.inv({ plant: '6410', material: 'X', description: '', min: 4, max: 10, actual: 11 }).status === 'Above Maximum' && C.inv({ plant: '6410', material: 'X', description: '', min: 4, max: 10, actual: 6 }).status === 'Normal');

/* ---- Inventory: Category rule (Slow Moving = Minimum and Maximum both 0 or empty, Fast Moving = set) and Status for Slow Moving rows ---- */
function st(min, max, actual) { return C.inv({ plant: '6410', material: 'X', description: '', min: min, max: max, actual: actual }); }
t('Slow Moving: min 0 and max 0, stock 5 (Category Slow Moving, Status Normal, Gap Unavailable)', st(0, 0, 5).category === 'Slow Moving' && st(0, 0, 5).status === 'Normal' && st(0, 0, 5).gap === null);
t('Slow Moving: min 0 and max 0, stock 0 is Out of Stock in Status and still Slow Moving in Category', st(0, 0, 0).status === 'Out of Stock' && st(0, 0, 0).category === 'Slow Moving');
t('Slow Moving: empty (null) min and max count the same as 0', st(null, null, 3).category === 'Slow Moving' && st(0, null, 3).category === 'Slow Moving');
t('Fast Moving: min and max set, whatever the status', st(4, 10, 0).category === 'Fast Moving' && st(4, 10, 2).category === 'Fast Moving' && st(4, 10, 6).category === 'Fast Moving' && st(4, 10, 11).category === 'Fast Moving');
t('only one of min/max set: old rules apply (min 0 + max 10 = Unclassified; min 4 + max 0 = Normal or Below Minimum, never Above Maximum)', st(0, 10, 5).status === 'Unclassified' && st(4, 0, 7).status === 'Normal' && st(4, 0, 2).status === 'Below Minimum' && st(0, 10, 5).category === 'Fast Moving' && st(4, 0, 7).category === 'Fast Moving');
t('with min and max set, Out of Stock / Below / Above / Normal are unchanged', st(4, 10, 0).status === 'Out of Stock' && st(4, 10, 2).status === 'Below Minimum' && st(4, 10, 11).status === 'Above Maximum' && st(4, 10, 6).status === 'Normal');
t('Slow Moving rows keep the 0 values as they came in (shown as 0, Gap Unavailable)', st(0, 0, 5).min === 0 && st(0, 0, 5).max === 0);

/* ---- Google Sheets reader (js/sheets.js): no network needed, the sheet text is built here ---- */
var P = SheetData.parts;
function q(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
function csv(rows) { return rows.map(function (r) { return r.map(q).join(','); }).join('\n') + '\n'; }
function dmy(iso) { var p = iso.split('-'); return (+p[2]) + '/' + (+p[1]) + '/' + p[0]; }
var matHead = [['Website', 'Plant', 'Material', 'Description', 'Minimum Stock', 'Maximum Stock', 'Actual Stock ', 'Gap'], ['SAP', 'Plant', 'Material', 'Descr.', 'Safety Stock', 'Maximum Stock Level', 'Actual Stock ', 'Actual Stock  - Minimum Stock'],
  ['Table Name', 'RMMG1', 'RMMG1', 'MAKT', 'MARC', 'MARC', 'MARD', 'MARD - MARC'], ['FieldName', 'WERKS', 'MATNR', 'MAKTX', 'EISBE', 'MABST', 'LABST', 'LABST - EISBE']];
var ordHead = [['SAP', 'CAUFVD-AUFNR', 'CAUFVD-EQUNR', 'CAUFVD-AUART', 'CAUFVD-KTEXT', 'CAUFVD-GSTRP', 'CAUFVD-IWERK'], ['Dashboard', 'Order', 'Equipment_No', 'Type_Order', 'Description', 'Planned_Start', 'Plant']];
var matRows = D.materials.map(function (m) { return ['Value', m.plant, m.material, m.description, m.min, m.max, m.actual, m.actual - m.min]; });
var ordRows = D.orders.map(function (o) { return ['Value', o.order, o.equipmentNo, o.type, o.description || '', dmy(o.plannedStart), o.plant]; });
var matSheet = csv(matHead.concat(matRows)), ordSheet = csv(ordHead.concat(ordRows));
var mr = P.toMaterials(P.parseCsv(matSheet)), or = P.toOrders(P.parseCsv(ordSheet));
t('sheet reader: Min_Max_Stok in the Excel layout gives the same 16127 materials as data.js (4 title/label rows ignored, none counted as invalid)', mr.rows.length === 16127 && mr.skipped === 0 && mr.byTitle === true && JSON.stringify(mr.rows) === JSON.stringify(D.materials));
t('sheet reader: Maintenance_Kalender in the Excel layout gives the same 719 orders as data.js (dates d/m/yyyy converted)', or.rows.length === 719 && or.skipped === 0 && or.byTitle === true && JSON.stringify(or.rows) === JSON.stringify(D.orders));
var gm = P.toMaterials(P.parseCsv(csv([['', '', '', '', '', '', '', ''], ['SAP', '', '', '', '', '', '', ''], ['Table Name', '', '', '', '', '', '', ''], ['FieldName', '', '', '', '', '', '', '']].concat(matRows))));
t('sheet reader: when Google drops the title row, columns are read by position and the result is the same', gm.rows.length === 16127 && gm.byTitle === false && JSON.stringify(gm.rows) === JSON.stringify(D.materials));
var em = P.toMaterials(P.parseCsv(csv(matHead.slice(0, 1).concat([
  ['Value', '6410', 'A1', 'Hose, 1" "big"', '0', '0', '5', ''], ['Value', '6410', 'A2', 'blank min max', '', '', '0', ''], ['Value', '6420', 'A3', 'separators', '1,234', '2,000', '1.500', ''],
  ['Value', '6420', 'A4', 'text in min', 'abc', '5', '1', ''], ['Value', '', 'A5', 'no plant', '1', '2', '3', ''], ['Value', '6420', 'A6', 'no actual stock', '1', '2', '', ''],
  ['', '', '', '', '', '', '', ''], ['Value', '6420', 'A7', 'normal', '2', '9', '4', '']]))));
t('sheet reader: 0 / empty min and max are kept; quotes, commas and thousand separators are read; 3 bad rows are counted, the empty line is not', em.rows.length === 4 && em.skipped === 3 && em.rows[0].description === 'Hose, 1" "big"' && em.rows[0].min === 0 && em.rows[1].min === null && em.rows[1].actual === 0 && em.rows[2].min === 1234 && em.rows[2].max === 2000 && em.rows[2].actual === 1.5);
t('sheet reader: those rows get the right category and status (0/0 and empty/empty are Slow Moving; with stock 0 they are also Out of Stock)', C.inv(em.rows[0]).category === 'Slow Moving' && C.inv(em.rows[0]).status === 'Normal' && C.inv(em.rows[1]).category === 'Slow Moving' && C.inv(em.rows[1]).status === 'Out of Stock' && C.inv(em.rows[3]).category === 'Fast Moving' && C.inv(em.rows[3]).status === 'Normal');
var eo = P.toOrders(P.parseCsv(csv(ordHead.concat([['Value', '1', 'E1', 'ZPM1', '', '31/7/2026', '6410'], ['Value', '2', 'E2', 'ZPM2', 'x', '2026-08-01', '6410'], ['Value', '3', 'E3', 'ZPM2', 'x', '31/2/2026', '6410'],
  ['Value', '4', '', 'ZPM2', 'x', '1/8/2026', '6410'], ['Value', '5', 'E5', 'ZPM2', 'x', '8/31/2026', '6420']]))));
t('sheet reader: orders: d/m/yyyy, yyyy-mm-dd and m/d/yyyy dates; impossible date and missing equipment are counted; empty description becomes null', eo.rows.length === 3 && eo.skipped === 2 && eo.rows[0].plannedStart === '2026-07-31' && eo.rows[0].description === null && eo.rows[1].plannedStart === '2026-08-01' && eo.rows[2].plannedStart === '2026-08-31');
t('date and number parsing', P.date('1/8/2026') === '2026-08-01' && P.date('31/2/2026') === null && P.date('x') === null && P.num('12') === 12 && P.num('') === null && P.num('12,5') === 12.5 && P.num('1.234.567,5') === 1234567.5 && P.num('1.234') === 1.234 && P.num('abc') === undefined && P.num('-3') === -3);
t('CSV parser: quotes, doubled quotes, line break inside a cell, CRLF, BOM', JSON.stringify(P.parseCsv('\ufeffa,"b,c","d""e"\r\n"f\ng",h,\r\n')) === JSON.stringify([['a', 'b,c', 'd"e'], ['f\ng', 'h', '']]));

/* ---- load() with a published CSV link (csvUrl filled): fetch is replaced by a fake so the success, unchanged, changed and error paths run without internet ---- */
function resp(body, status) { return { ok: !status || status < 400, status: status || 200, text: function () { return Promise.resolve(body); } }; }
function fake(o, m) { global.fetch = function (u) { return Promise.resolve(u.indexOf('sheet=Maintenance_Kalender') >= 0 ? o : u.indexOf('sheet=Min_Max_Stok') >= 0 ? m : resp('', 404)); }; }
function load() { return new Promise(function (res) { SheetData.load(function (e, r) { res({ e: e, r: r }); }); }); }
SheetData.config.orders.csvUrl = 'https://x.test/pub?sheet=Maintenance_Kalender&output=csv'; SheetData.config.materials.csvUrl = 'https://x.test/pub?sheet=Min_Max_Stok&output=csv';
fake(resp(ordSheet), resp(matSheet));
load().then(function (a) {
  t('load: both tabs read, 719 orders and 16127 materials, changed = true on the first read', !a.e && a.r.orders.length === 719 && a.r.materials.length === 16127 && a.r.changed === true && a.r.skipped.orders === 0 && a.r.skipped.materials === 0);
  return load();
}).then(function (a) {
  t('load: the same sheet read again reports changed = false', !a.e && a.r.changed === false);
  var m2 = matSheet.replace('"CHEMICAL_3030","2","8","0"', '"CHEMICAL_3030","2","8","1"');
  fake(resp(ordSheet), resp(m2));
  return load().then(function (b) { t('load: one changed number in the sheet reports changed = true', !b.e && b.r.changed === true && b.r.materials[0].actual === 1); });
}).then(function () {
  fake(resp('<!DOCTYPE html><html><body>Sign in</body></html>'), resp(matSheet));
  return load().then(function (a) { t('load: a web page instead of CSV is an error that points at the csvUrl link', !!a.e && /web page/.test(a.e.message) && /Publish to web/.test(a.e.message)); });
}).then(function () {
  fake(resp(ordSheet), resp('', 404));
  return load().then(function (a) { t('load: HTTP 404 is an error that names the tab', !!a.e && /HTTP 404/.test(a.e.message) && /Min_Max_Stok/.test(a.e.message)); });
}).then(function () {
  global.fetch = function () { return Promise.reject(new TypeError('Failed to fetch')); };
  return load().then(function (a) { t('load: no internet / blocked is an error with a readable message', !!a.e && /could not reach Google Sheets/.test(a.e.message)); });
}).then(function () {
  fake(resp(csv(ordHead)), resp(matSheet));
  return load().then(function (a) { t('load: a tab without valid rows is an error, the dashboard keeps its current data', !!a.e && /no valid order rows/.test(a.e.message)); });
}).then(function () {
  /* ---- load() through a script tag (default, csvUrl empty): a fake document plays Google's answer ---- */
  SheetData.config.orders.csvUrl = ''; SheetData.config.materials.csvUrl = '';
  function dd(iso) { var p = iso.split('-'); return 'Date(' + p[0] + ',' + (+p[1] - 1) + ',' + (+p[2]) + ')'; }
  function gt(rows, labels) { return { status: 'ok', table: { cols: rows[0].map(function (x, i) { return { id: 'ABCDEFGH'.charAt(i), label: labels ? labels[i] : '' }; }),
    rows: rows.map(function (r) { return { c: r.map(function (v) { return v === '' || v == null ? null : { v: v }; }) }; }) } }; }
  function gfake(map, how) {
    global.document = { createElement: function () { return {}; }, head: { appendChild: function (el) {
      var name = /responseHandler:(\w+)/.exec(el.src)[1], sheet = decodeURIComponent(/sheet=([^&]+)/.exec(el.src)[1]);
      if (how === 'event') return setTimeout(function () { el.onerror(); }, 0);
      if (how === 'silent') return;
      setTimeout(function () { global[name](map[sheet]); }, 0);
    } } };
  }
  var matT = D.materials.map(function (m) { return ['Value', m.plant, m.material, m.description, m.min, m.max, m.actual, m.actual - m.min]; });
  var ordT = D.orders.map(function (o) { return ['Value', o.order, o.equipmentNo, o.type, o.description || '', dd(o.plannedStart), o.plant]; });
  var blank = function (a) { return [a, '', '', '', '', '', '', '']; };
  var ordA = gt(ordHead.concat(ordT));
  var variants = [['title row and label rows kept as text', gt(matHead.concat(matT)), true], ['Google used the title row as column titles', gt(matHead.slice(1).concat(matT), matHead[0]), true],
    ['label rows blanked and no title row', gt([blank('SAP'), blank('Table Name'), blank('FieldName')].concat(matT)), false]];
  var chain = Promise.resolve();
  variants.forEach(function (v) {
    chain = chain.then(function () {
      gfake({ Maintenance_Kalender: ordA, Min_Max_Stok: v[1] });
      return load().then(function (a) {
        t('script load, ' + v[0] + ': 719 orders and 16127 materials identical to data.js', !a.e && JSON.stringify(a.r.orders) === JSON.stringify(D.orders) && JSON.stringify(a.r.materials) === JSON.stringify(D.materials) && a.r.byTitle.materials === v[2] && a.r.skipped.materials === 0 && a.r.skipped.orders === 0, a.e && a.e.message);
      });
    });
  });
  return chain.then(function () {
    t('script load leaves nothing behind (no callback names, no google stub)', Object.keys(global).filter(function (k) { return /^__sheetCb/.test(k); }).length === 0 && typeof global.google === 'undefined');
    t('gviz cell and row helpers: dates, numbers, empty cells, title row put back', P.cellText({ v: 'Date(2026,7,1)' }) === '2026-08-01' && P.cellText({ v: 6410 }) === '6410' && P.cellText(null) === '' && P.cellText({ v: null }) === '' &&
      JSON.stringify(P.tableRows({ cols: [{ label: 'A1' }, { label: '' }], rows: [{ c: [{ v: 'x' }, null] }] })) === JSON.stringify([['A1', ''], ['x', '']]));
    gfake({ Maintenance_Kalender: ordA, Min_Max_Stok: { status: 'error', errors: [{ message: 'Invalid query', detailed_message: 'Unknown sheet' }] } });
    return load();
  }).then(function (a) {
    t('script load: Google answering with an error names the tab and says what to check', !!a.e && /Google refused tab Min_Max_Stok/.test(a.e.message) && /Unknown sheet/.test(a.e.message));
    gfake({}, 'event'); return load();
  }).then(function (a) {
    t('script load: network failure of the script tag is a readable error', !!a.e && /could not reach Google Sheets/.test(a.e.message));
    gfake({}, 'silent'); SheetData.config.timeoutSeconds = 0.05; return load();
  }).then(function (a) {
    SheetData.config.timeoutSeconds = 20;
    t('script load: no answer (typical for a sheet that is not shared) times out with the sharing hint', !!a.e && /did not answer/.test(a.e.message) && /Anyone with the link/.test(a.e.message));
    t('after errors nothing is left behind either', Object.keys(global).filter(function (k) { return /^__sheetCb/.test(k); }).length === 0 && typeof global.google === 'undefined');
  });
}).then(function () {
  console.log('\n' + ok + ' passed, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
}, function (e) { console.log('FAIL load tests crashed: ' + (e && e.stack || e)); process.exit(1); });

