/* Request PR (menu 04). Technicians request materials, the admin turns the requests into PR numbers in SAP.
   Own file on purpose: nothing of Reliability & Cost, Maintenance Calendar or Inventory Monitoring is used or changed here.
   - All element IDs start with rp-.
   - Materials come from DemoData.materials (tab Min_Max_Stok), machine numbers from DemoData.orders (last 5 characters of Equipment_No).
     Both are read when needed, so they follow the Google Sheet whenever it brings new data.
   - Requests are kept in localStorage (demo only, no backend): they stay in this browser and are not shared with other computers.
   - The Excel files are written here in the browser (small .xlsx writer below), so no library and no internet are needed. */
(function () {
'use strict';

/* ---------- Settings (change here, nothing else needs to be touched) ---------- */
var CFG = {
  /* Demo users, chosen in the "User login (demo)" box. In B2E this comes from the real login: name = NAME column,
     code = short user name that is used in REQUESTOR (the first letter of the code of whoever downloads is the last letter of REQUESTOR). */
  users: [{ name: 'FAJAR', code: 'FAJAR' }, { name: 'PARMI', code: 'PARMI' }, { name: 'BUDI LAKSO', code: 'BUDIL' }],
  userKey: 'cmms_request_pr_user',
  /* middle letter of REQUESTOR comes from this field of the request: 'machineStatus' (RUN, STOP, TPM) or 'status' (URGENT, STOCK, MAINT) */
  requestorStatus: 'machineStatus',
  /* plant code -> name, SAP purchasing group (PURCH GROUP) and MAPIN of the Excel to SAP file */
  plants: { '6410': { name: 'Cikarang', purch: '64G', mapin: '6400' }, '6420': { name: 'Karawang', purch: '64H', mapin: '6400' } },
  machineStatus: ['RUN', 'STOP', 'TPM'],
  units: ['EA', 'PCS', 'KG'],
  status: ['URGENT', 'STOCK', 'MAINT'],
  noMaster: ['NON MASTER', 'SV'],   /* NON MASTER = material has no master data yet, SV = service (jasa) */
  descMax: 40,                      /* SAP short text length for a material without master data */
  listMax: 50,                      /* rows shown in the Material / Nomor Mesin suggestion lists */
  storeKey: 'cmms_request_pr_v1'
};
var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
var DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/* ---------- Small helpers (no DOM) ---------- */
function p2(n) { return (n < 10 ? '0' : '') + n; }
function ymd(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
function today() { return ymd(new Date()); }
function addDays(s, n) { return ymd(new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10) + n)); }
function isYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
function dmy(s) { return isYmd(s) ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; }
function serial(s) { return Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000) + 25569; }   /* Excel date number */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function xesc(s) { return esc(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
function nf(n) { return Number(n).toLocaleString('id-ID'); }
function isSpecial(code) { return CFG.noMaster.indexOf(code) >= 0; }
function tracking(r) { return r.machine + r.status; }   /* TRACKING NUMBER of the SAP file, e.g. 33002STOCK */
/* REQUESTOR of the SAP file = who requested + first letter of the machine status + first letter of who downloads.
   Example: Fajar requested, machine STOP, Parmi downloads Excel to SAP -> FAJAR-S-P. Rows saved by the first version only have `requestor` (BUDIL-S-P): its first part is used. */
function requesterCode(r) { return String(r.by || String(r.requestor || '').split('-')[0] || r.name || '').toUpperCase(); }
function requestorOf(r, downloader) { return requesterCode(r) + '-' + String(r[CFG.requestorStatus] || '').charAt(0).toUpperCase() + '-' + String(downloader || '').charAt(0).toUpperCase(); }
function num(v) { return /^\d+$/.test(String(v)) ? { t: 'n', v: +v } : { t: 's', v: String(v) }; }

/* ---------- Excel files ---------- */
/* Excel to SAP: same columns and order as the SAP upload sheet. Empty columns stay empty on purpose (filled by hand in SAP). */
var SAP_HEAD = ['JML CHAR', 'REQUESTOR', 'PLANT', 'MAPIN', 'PURCH GROUP', 'MATERIAL GROUP', 'MATERIAL', 'MATERIAL DESCRIPTION', 'QTY', 'UNIT', 'PRICE', '', 'DELIVERY DATE', 'TRACKING NUMBER', 'KETERANGAN'];
function sapSheet(rows, day, downloader) {
  var out = [SAP_HEAD.map(function (h) { return h ? { t: 's', v: h } : null; })];
  rows.forEach(function (r) {
    var p = CFG.plants[r.plant] || {}, sp = isSpecial(r.material);
    out.push([null, { t: 's', v: requestorOf(r, downloader) }, { t: 's', v: r.plant }, { t: 's', v: p.mapin || '' }, { t: 's', v: p.purch || '' }, null,
      { t: 's', v: r.material }, sp ? { t: 's', v: r.description } : null,   /* a material with master data gets its description from SAP */
      { t: 'n', v: r.qty }, { t: 's', v: r.unit }, null, null,
      isYmd(r.useDate) ? { t: 'n', v: serial(r.useDate), s: 1 } : null, { t: 's', v: tracking(r) }, r.note ? { t: 's', v: r.note } : null]);
  });
  return { name: 'REQUEST PR - ' + day, widths: [9, 16, 8, 8, 12, 15, 15, 36, 7, 7, 9, 2, 15, 20, 30], rows: out, merges: [], filter: null, defName: null };
}
/* Export Excel: the table as shown on screen (title rows, header with filter arrows, one row per request). */
var EXP_HEAD = ['#', 'TANGGAL', 'NAME', 'MATERIAL', 'DESCRIPTION', 'MAKER', 'QTY', 'STATUS', 'PLANT', 'NO MESIN', 'STATUSMESIN', 'NO PR', 'TANGGALPR'];
function exportSheet(rows) {
  var out = [[{ t: 's', v: 'Request PR | CMMS', s: 3 }], [{ t: 's', v: 'REQUEST PR', s: 3 }], EXP_HEAD.map(function (h) { return { t: 's', v: h, s: 2 }; })];
  rows.forEach(function (r) {
    out.push([null, { t: 'n', v: serial(r.date), s: 1 }, { t: 's', v: r.name }, { t: 's', v: r.material }, r.description ? { t: 's', v: r.description } : null, r.maker ? { t: 's', v: r.maker } : null,
      { t: 'n', v: r.qty }, { t: 's', v: r.status }, num(r.plant), num(r.machine), { t: 's', v: r.machineStatus }, r.pr ? { t: 's', v: r.pr } : null,
      isYmd(r.prDate) ? { t: 'n', v: serial(r.prDate), s: 1 } : null]);
  });
  return { name: 'REQUEST PR', widths: [4, 12, 14, 16, 30, 14, 7, 9, 7, 10, 13, 14, 12], rows: out, merges: ['A1:M1', 'A2:M2'], filter: 'A3:M' + out.length, defName: true };
}

/* minimal .xlsx writer: one sheet, text / number / date cells, merged cells, filter arrows. An .xlsx is a zip of XML files (stored, not compressed). */
function colName(i) { var s = '', m; i++; while (i > 0) { m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function cellXml(ref, c) {
  var s;
  if (!c || c.v == null || c.v === '') return '';
  s = c.s ? ' s="' + c.s + '"' : '';
  return c.t === 'n' ? '<c r="' + ref + '"' + s + '><v>' + c.v + '</v></c>' : '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + xesc(c.v) + '</t></is></c>';
}
var CRC = (function () { var t = [], n, c, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { var c = 0xFFFFFFFF, i; for (i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) {
  var te = new TextEncoder(), loc = [], cen = [], off = 0, size = 0, i, f, nm, crc, a, dv, c, out, pos = 0;
  for (i = 0; i < files.length; i++) {
    f = files[i]; nm = te.encode(f.n); crc = crc32(f.d);
    a = new Uint8Array(30 + nm.length); dv = new DataView(a.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 23585, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, f.d.length, true); dv.setUint32(22, f.d.length, true); dv.setUint16(26, nm.length, true); dv.setUint16(28, 0, true); a.set(nm, 30);
    loc.push(a, f.d);
    c = new Uint8Array(46 + nm.length); dv = new DataView(c.buffer);
    dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true); dv.setUint16(8, 0x0800, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0, true); dv.setUint16(14, 23585, true);
    dv.setUint32(16, crc, true); dv.setUint32(20, f.d.length, true); dv.setUint32(24, f.d.length, true); dv.setUint16(28, nm.length, true);
    dv.setUint32(42, off, true); c.set(nm, 46);
    cen.push(c); off += a.length + f.d.length;
  }
  c = new Uint8Array(22); dv = new DataView(c.buffer);
  for (i = 0; i < cen.length; i++) size += cen[i].length;
  dv.setUint32(0, 0x06054b50, true); dv.setUint16(8, files.length, true); dv.setUint16(10, files.length, true); dv.setUint32(12, size, true); dv.setUint32(16, off, true);
  loc = loc.concat(cen, [c]);
  for (i = 0, size = 0; i < loc.length; i++) size += loc[i].length;
  out = new Uint8Array(size);
  for (i = 0; i < loc.length; i++) { out.set(loc[i], pos); pos += loc[i].length; }
  return out;
}
function buildXlsx(sh) {
  var te = new TextEncoder(), H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    RN = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', PR = 'http://schemas.openxmlformats.org/package/2006/relationships', nm = xesc(sh.name), q = "'" + sh.name.replace(/'/g, "''") + "'", rows = '', r, c, cells, last;
  for (r = 0; r < sh.rows.length; r++) {
    cells = '';
    for (c = 0; c < sh.rows[r].length; c++) cells += cellXml(colName(c) + (r + 1), sh.rows[r][c]);
    rows += '<row r="' + (r + 1) + '">' + cells + '</row>';
  }
  last = sh.rows.length;
  var sheet = H + '<worksheet xmlns="' + NS + '"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>' +
    sh.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>' + rows + '</sheetData>' +
    (sh.filter ? '<autoFilter ref="' + sh.filter + '"/>' : '') +
    (sh.merges.length ? '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>' : '') + '</worksheet>';
  var wb = H + '<workbook xmlns="' + NS + '" xmlns:r="' + RN + '"><sheets><sheet name="' + nm + '" sheetId="1" r:id="rId1"/></sheets>' +
    (sh.filter ? '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">' + xesc(q) + '!$A$3:$M$' + last + '</definedName></definedNames>' : '') + '</workbook>';
  var styles = H + '<styleSheet xmlns="' + NS + '"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  var files = [
    { n: '[Content_Types].xml', x: H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { n: '_rels/.rels', x: H + '<Relationships xmlns="' + PR + '"><Relationship Id="rId1" Type="' + RN + '/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { n: 'xl/workbook.xml', x: wb },
    { n: 'xl/_rels/workbook.xml.rels', x: H + '<Relationships xmlns="' + PR + '"><Relationship Id="rId1" Type="' + RN + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + RN + '/styles" Target="styles.xml"/></Relationships>' },
    { n: 'xl/styles.xml', x: styles },
    { n: 'xl/worksheets/sheet1.xml', x: sheet }
  ];
  return zip(files.map(function (f) { return { n: f.n, d: te.encode(f.x) }; }));
}
function download(name, bytes) {
  var a = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
}

var core = { CFG: CFG, sapSheet: sapSheet, exportSheet: exportSheet, buildXlsx: buildXlsx, serial: serial, tracking: tracking, requestorOf: requestorOf, crc32: crc32 };
window.RequestPR = { core: core, render: function () {} };
if (typeof document === 'undefined' || !document.getElementById('tab-rp')) return;   /* no page (Node test): only the Excel helpers above are used */

/* ---------- Page ---------- */
var RQ = [], st = { material: null, machine: null }, cf = {}, warned = false, pop = null, pk = null, me = CFG.users[0];   /* me = user login (demo) */
function $(i) { return document.getElementById(i); }
function DD() { return window.DemoData || { materials: [], orders: [] }; }
function msg(t, kind) { var e = $('rp-msg'); e.textContent = t || ''; e.className = 'rp-msg ' + (kind || ''); }

/* requests in localStorage */
function load() { try { var s = localStorage.getItem(CFG.storeKey), a = s && JSON.parse(s); if (Array.isArray(a)) return a; } catch (e) { /* storage blocked: start empty */ } return null; }
function save() {
  try { localStorage.setItem(CFG.storeKey, JSON.stringify(RQ)); }
  catch (e) { if (!warned) { warned = true; msg('Penyimpanan browser tidak tersedia: data hanya ada selama halaman ini terbuka.', 'bad'); } }
}
function master(code, plant) { var m = DD().materials, i; for (i = 0; i < m.length; i++) if (m[i].material === code && m[i].plant === plant) return m[i]; return null; }
/* first start only: the rows of the reference screenshots, so the screen is not empty (the older ones already have a PR number) */
function seed() {
  var t = today(), y = addDays(t, -1), rows = [], n = 0;
  function add(date, code, qty, pr) {
    var m = master(code, '6410');
    n++; rows.push({ id: n, date: date, name: 'BUDI LAKSO', by: 'BUDIL', material: code, description: m ? m.description : '', maker: '', qty: qty, unit: 'EA', status: 'STOCK',
      plant: '6410', machine: '33002', machineStatus: 'RUN', useDate: addDays(date, 3), note: '', pr: pr ? 'DEMO-' + ('000' + n).slice(-4) : '', prDate: pr ? date : '' });
  }
  [['IMTNME01827', 20], ['IMTNME02577', 50], ['IMTNME02575', 50], ['IMTNEL00554', 10], ['IMTNEL00553', 10], ['IMTNEL00552', 10], ['IMTNEL01347', 5], ['IMTNME01833', 20]].forEach(function (x) { add(y, x[0], x[1], true); });
  add(t, 'IMTNME01833', 20, true);
  ['IMTNME02706', 'IMTNME01776', 'IMTNME01778', 'IMTNME01787', 'IMTNME01798', 'IMTNME01800', 'IMTNME01810', 'IMTNME01811', 'IMTNME01831'].forEach(function (c) { add(t, c, 10, false); });
  return rows;
}

/* ---------- Suggestion lists (Material, Nomor Mesin) ---------- */
function searchMaterial(q) {
  var plant = $('rp-plant').value, tk = q.toLowerCase().split(/\s+/).filter(Boolean), items = [], seen = {}, more = 0, m = DD().materials, i, r, h, note = '';
  items.push({ sp: 1, value: { code: 'NON MASTER', desc: '', special: true }, html: '<b>NON MASTER</b><span>material belum ada master data (tulis deskripsinya sendiri)</span>' });
  items.push({ sp: 1, value: { code: 'SV', desc: '', special: true }, html: '<b>SV</b><span>jasa (service)</span>' });
  if (!tk.length) return { items: items, note: 'Ketik kode material atau description untuk mencari.' };
  for (i = 0; i < m.length; i++) {
    r = m[i];
    if ((plant && r.plant !== plant) || seen[r.material]) continue;
    h = (r.material + ' ' + r.description).toLowerCase();
    if (tk.every(function (t) { return h.indexOf(t) >= 0; })) {
      seen[r.material] = 1;
      if (items.length - 2 < CFG.listMax) items.push({ value: { code: r.material, desc: r.description, special: false }, html: '<b>' + esc(r.material) + '</b><span>' + esc(r.description) + '</span>' }); else more++;
    }
  }
  if (more) note = 'Ada ' + nf(more) + ' hasil lagi. Ketik lebih spesifik.';
  else if (items.length === 2) note = 'Tidak ada material yang cocok. Jika master tidak ada, pilih NON MASTER (jasa: SV).';
  return { items: items, note: note };
}
var mcache = { src: null, list: [] };
function machines() {
  var o = DD().orders, map = {}, k;
  if (mcache.src === o) return mcache.list;
  o.forEach(function (x) { var no = String(x.equipmentNo).slice(-5); (map[no] = map[no] || {})[x.plant] = 1; });
  mcache = { src: o, list: Object.keys(map).sort().map(function (no) { return { no: no, plants: Object.keys(map[no]) }; }) };
  return mcache.list;
}
function searchMachine(q) {
  var plant = $('rp-plant').value, s = q.trim().toLowerCase(), all = machines().filter(function (m) { return (!plant || m.plants.indexOf(plant) >= 0) && (!s || m.no.toLowerCase().indexOf(s) >= 0); });
  return { items: all.slice(0, CFG.listMax).map(function (m) { return { value: { no: m.no }, html: '<b>' + esc(m.no) + '</b><span>' + m.plants.map(function (p) { return (CFG.plants[p] || {}).name || p; }).join(', ') + '</span>' }; }),
    note: all.length > CFG.listMax ? 'Menampilkan ' + CFG.listMax + ' dari ' + nf(all.length) + ' mesin. Ketik untuk mempersempit.' : all.length ? '' : 'Tidak ada nomor mesin yang cocok.' };
}
/* a text box with a suggestion list under it: o.search(text) -> {items, note}; o.pick(value, text); o.edit() when the text is changed by hand */
function combo(o) {
  var el = o.input, ul = o.list, items = [], note = '', act = -1;
  function close() { ul.hidden = true; el.setAttribute('aria-expanded', 'false'); }
  function draw() {
    ul.innerHTML = items.map(function (it, i) { return '<li role="option" data-i="' + i + '" class="' + (i === act ? 'on ' : '') + (it.sp ? 'sp' : '') + '">' + it.html + '</li>'; }).join('') + (note ? '<li class="rp-note">' + esc(note) + '</li>' : '');
    ul.hidden = false; el.setAttribute('aria-expanded', 'true');
    var on = ul.querySelector('li.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  function refresh() {
    var r = o.search(el.value), i; items = r.items; note = r.note; act = -1;
    for (i = 0; i < items.length; i++) if (!items[i].sp) { act = i; break; }
    draw();
  }
  function pick(i) { var t = el.value; if (!items[i]) return; close(); o.pick(items[i].value, t); }
  el.addEventListener('focus', refresh);
  el.addEventListener('input', function () { o.edit(); refresh(); });
  el.addEventListener('blur', function () { close(); o.blur(); });
  el.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (ul.hidden) return refresh();
      if (items.length) { act = (act + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; draw(); }
    } else if (e.key === 'Enter') { if (!ul.hidden && act >= 0) { e.preventDefault(); pick(act); } }
    else if (e.key === 'Escape') { if (!ul.hidden) { e.stopPropagation(); close(); } }
  });
  ul.addEventListener('mousedown', function (e) {   /* mousedown, not click: the text box must not lose focus first */
    var li = e.target; e.preventDefault();
    while (li && li !== ul && !(li.getAttribute && li.getAttribute('data-i'))) li = li.parentNode;
    if (li && li !== ul) pick(+li.getAttribute('data-i'));
  });
}

/* ---------- Date picker (one popup for the whole page) ---------- */
function pkClose(back) { if (!pop || !pk) return; var i = pk.input; pop.hidden = true; pk = null; if (back) i.focus(); }
function pkDraw() {
  var y = pk.y, m = pk.m, first = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate(), t = today(), sel = pk.input.value, d, key, i,
    h = '<div class="rp-ph"><button type="button" data-a="prev" aria-label="Bulan sebelumnya"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><b>' + MONTHS[m] + ' ' + y +
      '</b><button type="button" data-a="next" aria-label="Bulan berikutnya"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div><div class="rp-pg">' + DAYS.map(function (x) { return '<i>' + x + '</i>'; }).join('');
  for (i = 0; i < first; i++) h += '<span></span>';
  for (d = 1; d <= dim; d++) { key = y + '-' + p2(m + 1) + '-' + p2(d); h += '<button type="button" data-d="' + key + '" class="' + (key === sel ? 'sel ' : '') + (key === t ? 'now' : '') + '">' + d + '</button>'; }
  pop.innerHTML = h + '</div><div class="rp-pf"><button type="button" data-a="today">Hari ini</button>' + (pk.input.getAttribute('data-clear') ? '<button type="button" data-a="clear">Kosongkan</button>' : '') + '</div>';
}
function pkOpen(input) {
  var base = isYmd(input.value) ? input.value : today(), r, w = 256, h, top, left, f;
  pk = { input: input, y: +base.slice(0, 4), m: +base.slice(5, 7) - 1 };
  pkDraw(); pop.hidden = false;
  r = input.getBoundingClientRect(); h = pop.offsetHeight; top = r.bottom + 2; left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  if (top + h > window.innerHeight - 8 && r.top - h - 2 > 8) top = r.top - h - 2;
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  f = pop.querySelector('.sel') || pop.querySelector('.now') || pop.querySelector('[data-d]');
  if (f) f.focus({ preventScroll: true });
}
function pkSet(v) { var i = pk.input; i.value = v; pkClose(true); i.dispatchEvent(new Event('change', { bubbles: true })); }
function initPicker() {
  pop = document.createElement('div'); pop.className = 'rp-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Pilih tanggal'); document.body.appendChild(pop);
  pop.addEventListener('click', function (e) {
    var b = e.target, a, d, f;
    while (b && b !== pop && !(b.getAttribute && (b.getAttribute('data-a') || b.getAttribute('data-d')))) b = b.parentNode;
    if (!b || b === pop || !pk) return;
    d = b.getAttribute('data-d'); a = b.getAttribute('data-a');
    if (d) return pkSet(d);
    if (a === 'today') return pkSet(today());
    if (a === 'clear') return pkSet('');
    pk.m += a === 'next' ? 1 : -1; if (pk.m > 11) { pk.m = 0; pk.y++; } if (pk.m < 0) { pk.m = 11; pk.y--; }
    pkDraw(); f = pop.querySelector('[data-a="' + a + '"]'); if (f) f.focus({ preventScroll: true });
  });
  document.addEventListener('mousedown', function (e) { if (pk && !pop.contains(e.target) && e.target !== pk.input) pkClose(); });
  document.addEventListener('keydown', function (e) { if (pk && e.key === 'Escape') pkClose(true); });
  document.addEventListener('scroll', function (e) { if (pk && !pop.contains(e.target)) pkClose(); }, true);
  window.addEventListener('resize', function () { pkClose(); });
  Array.prototype.forEach.call(document.querySelectorAll('#tab-rp .rp-date'), function (el) {
    el.addEventListener('click', function () { pkOpen(el); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); pkOpen(el); } });
  });
}

/* ---------- Form ---------- */
function updateStock() {
  var c = st.material && !st.material.special ? st.material.code : null, plant = $('rp-plant').value, a = c && master(c, '6410'), b = c && master(c, '6420'), s = c && plant && master(c, plant);
  $('rp-s-ckr').textContent = a ? nf(a.actual) : '0';
  $('rp-s-krw').textContent = b ? nf(b.actual) : '0';
  $('rp-s-std').textContent = !c ? '0' : s ? nf(s.min) + ' \u2013 ' + nf(s.max) : '-';   /* Standar Stok = Minimum and Maximum Stock of the chosen plant */
}
function setMaterial(v, text) {
  var i = $('rp-material'), d = $('rp-desc');
  st.material = v; i.value = v ? (v.special ? v.code : v.code + ' \u2014 ' + v.desc) : ''; i.classList.remove('bad');
  $('rp-desc-wrap').hidden = !(v && v.special);
  if (v && v.special) { d.value = (text || '').trim().slice(0, CFG.descMax); d.focus(); } else d.value = '';
  updateStock();
}
function setMachine(v) { st.machine = v; $('rp-machine').value = v ? v.no : ''; $('rp-machine').classList.remove('bad'); }
function plantChanged() {   /* a chosen material / machine that does not exist in the new plant is cleared */
  var p = $('rp-plant').value;
  if (p && st.material && !st.material.special && !master(st.material.code, p)) setMaterial(null);
  if (p && st.machine && !machines().some(function (m) { return m.no === st.machine.no && m.plants.indexOf(p) >= 0; })) setMachine(null);
  updateStock();
}
function addRequest() {
  var f = [], q = $('rp-qty').value, plant = $('rp-plant').value, desc = $('rp-desc').value.trim(), id = 0, first, r;
  function need(ok, label, el) { if (!ok) { f.push(label); el.classList.add('bad'); if (!first) first = el; } }
  Array.prototype.forEach.call(document.querySelectorAll('#tab-rp .bad'), function (e) { e.classList.remove('bad'); });
  need(plant, 'Plant', $('rp-plant'));
  need(st.material, 'Material (pilih dari daftar)', $('rp-material'));
  if (st.material && st.material.special) need(desc, 'Deskripsi material', $('rp-desc'));
  need(st.machine, 'Nomor Mesin (pilih dari daftar)', $('rp-machine'));
  need($('rp-mstatus').value, 'Status Mesin', $('rp-mstatus'));
  need($('rp-use').value, 'Pemakaian Untuk Tanggal', $('rp-use'));
  need($('rp-unit').value, 'Satuan', $('rp-unit'));
  need(/^\d+$/.test(q) && +q > 0, 'Quantity (angka lebih dari 0)', $('rp-qty'));
  need($('rp-status').value, 'Status', $('rp-status'));
  if (f.length) { msg('Lengkapi dulu: ' + f.join(', ') + '.', 'bad'); first.focus(); return; }
  RQ.forEach(function (x) { if (x.id > id) id = x.id; });
  r = { id: id + 1, date: today(), name: me.name, by: me.code, material: st.material.code, description: st.material.special ? desc : st.material.desc, maker: '', qty: +q, unit: $('rp-unit').value,
    status: $('rp-status').value, plant: plant, machine: st.machine.no, machineStatus: $('rp-mstatus').value, useDate: $('rp-use').value, note: $('rp-note').value.trim(), pr: '', prDate: '' };
  RQ.push(r); save();
  /* ready for the next item of the same machine: only material, quantity and keterangan are cleared */
  setMaterial(null); $('rp-qty').value = ''; $('rp-note').value = '';
  if ($('rp-to').value && r.date > $('rp-to').value) $('rp-to').value = r.date;   /* the new row must be visible */
  if ($('rp-from').value && r.date < $('rp-from').value) $('rp-from').value = r.date;
  renderBody(); msg('Request ditambahkan: ' + r.material + ', ' + nf(r.qty) + ' ' + r.unit + '.', 'ok');
}

/* ---------- Table ---------- */
var COLS = [['date', 'TANGGAL'], ['name', 'NAME'], ['material', 'MATERIAL'], ['description', 'DESCRIPTION'], ['maker', 'MAKER'], ['qty', 'QTY'], ['status', 'STATUS'], ['plant', 'PLANT'], ['machine', 'NO MESIN'], ['machineStatus', 'STATUS MESIN'], ['pr', 'NO PR'], ['prDate', 'TANGGAL PR']];
var TRASH = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>';
function buildHead() {
  $('rp-table').innerHTML = '<table class="dt rp-t"><thead><tr><th></th>' + COLS.map(function (c) { return '<th' + (c[0] === 'qty' ? ' class="num"' : '') + '>' + c[1] + '</th>'; }).join('') + '</tr>' +
    '<tr class="rp-fr"><th></th>' + COLS.map(function (c) { return '<th><input data-f="' + c[0] + '" placeholder="' + c[1] + '" aria-label="Filter ' + c[1] + '"></th>'; }).join('') + '</tr></thead><tbody id="rp-tbody"></tbody></table>';
}
function inRange(r) { var a = $('rp-from').value, b = $('rp-to').value; return (!a || r.date >= a) && (!b || r.date <= b); }
function view() {   /* date filters + the filter boxes in the header; newest first */
  var keys = Object.keys(cf).filter(function (k) { return cf[k]; });
  return RQ.filter(function (r) { return inRange(r) && keys.every(function (k) { return String(r[k] == null ? '' : r[k]).toLowerCase().indexOf(cf[k]) >= 0; }); })
    .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id; });
}
function rowHtml(r) {
  var tip = 'Satuan: ' + r.unit + ' | Pemakaian untuk tanggal: ' + (r.useDate || '-') + (r.note ? ' | Keterangan: ' + r.note : '');
  return '<tr data-id="' + r.id + '"' + (r.pr ? ' class="done"' : '') + '><td><button type="button" class="rp-del" data-del="' + r.id + '" title="Hapus request"' + (r.pr ? ' disabled' : '') + '>' + TRASH + '</button></td>' +
    '<td>' + esc(r.date) + '</td><td>' + esc(r.name) + '</td><td class="rp-mat">' + esc(r.material) + '</td><td>' + esc(r.description) + '</td><td>' + esc(r.maker) + '</td>' +
    '<td class="num" title="' + esc(tip) + '">' + nf(r.qty) + '</td><td>' + esc(r.status) + '</td><td>' + esc(r.plant) + '</td><td>' + esc(r.machine) + '</td><td class="ms-' + esc(r.machineStatus) + '">' + esc(r.machineStatus) + '</td>' +
    '<td><input class="rp-pr" data-id="' + r.id + '" value="' + esc(r.pr) + '" placeholder="NO PR" aria-label="Nomor PR"></td><td><input type="date" class="rp-prd" data-id="' + r.id + '" value="' + esc(r.prDate) + '" aria-label="Tanggal PR"></td></tr>';
}
function renderBody() {
  var list = view(), a = $('rp-from').value, b = $('rp-to').value, pend = RQ.filter(function (r) { return !r.pr; }).length;
  $('rp-tbody').innerHTML = list.length ? list.map(rowHtml).join('') : '<tr><td colspan="13" class="empty">' + (a && b && a > b ? 'Tanggal Dari lebih besar dari Tanggal Sampai.' : 'Tidak ada data pada filter ini.') + '</td></tr>';
  $('rp-count').textContent = nf(list.length) + ' data found. ' + nf(pend) + ' request belum punya nomor PR (ikut Excel to SAP).';
}
function find(id) { var i; for (i = 0; i < RQ.length; i++) if (RQ[i].id === +id) return RQ[i]; return null; }
function onTable(e) {
  var t = e.target, r;
  if (e.type === 'click') {
    t = t.closest ? t.closest('button.rp-del') : null;
    if (!t || t.disabled) return;
    if (t.className.indexOf('ask') < 0) {   /* first click asks, second click within 3 seconds deletes (no pop-up box) */
      t.className += ' ask'; t.textContent = 'Hapus?';
      setTimeout(function () { if (t.parentNode) { t.className = 'rp-del'; t.innerHTML = TRASH; } }, 3000);
      return;
    }
    RQ = RQ.filter(function (x) { return x.id !== +t.getAttribute('data-del'); }); save(); renderBody(); return msg('Request dihapus.', 'ok');
  }
  if (!t.getAttribute || !(r = find(t.getAttribute('data-id')))) return;
  if (t.classList.contains('rp-pr')) {
    r.pr = t.value.trim(); save();
    t.parentNode.parentNode.className = r.pr ? 'done' : '';   /* the row fades once it has a PR number; no redraw, so the cursor can move on to TANGGAL PR */
    var del = t.parentNode.parentNode.querySelector('.rp-del'); if (del) del.disabled = !!r.pr;
    $('rp-count').textContent = $('rp-count').textContent.replace(/\d[\d.]* request belum/, nf(RQ.filter(function (x) { return !x.pr; }).length) + ' request belum');
  } else if (t.classList.contains('rp-prd')) { r.prDate = t.value; save(); }
}
function onFilter(e) { var f = e.target.getAttribute && e.target.getAttribute('data-f'); if (!f) return; cf[f] = e.target.value.trim().toLowerCase(); renderBody(); }

/* ---------- Downloads ---------- */
function runExcel(name, sheet, count, label) {
  try { download(name, buildXlsx(sheet)); msg(label + ': ' + nf(count) + ' baris diunduh (' + name + ').', 'ok'); }
  catch (e) { msg('Gagal membuat file Excel: ' + e.message, 'bad'); }
}
function toSap() {
  var rows = RQ.filter(function (r) { return !r.pr; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id; });   /* every request without a PR number, whatever the date filter says */
  if (!rows.length) return msg('Tidak ada request yang belum punya nomor PR.', 'bad');
  runExcel('REQUEST PR - ' + today() + '.xlsx', sapSheet(rows, today(), me.code), rows.length, 'Excel to SAP oleh ' + me.name);
}
function toExcel() {
  var rows = view();
  if (!rows.length) return msg('Tidak ada data untuk diekspor pada filter ini.', 'bad');
  runExcel('REQUEST PR.xlsx', exportSheet(rows), rows.length, 'Export Excel');
}

/* ---------- Start ---------- */
function opts(el, list, first) { el.innerHTML = '<option value="">' + first + '</option>' + list.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join(''); }
function init() {
  var t = today(), clear = function (e) { e.target.classList.remove('bad'); };
  RQ = load() || seed(); save();
  try { var c = localStorage.getItem(CFG.userKey); CFG.users.forEach(function (u) { if (u.code === c) me = u; }); } catch (e) { /* storage blocked: first user */ }
  $('rp-user').innerHTML = CFG.users.map(function (u) { return '<option value="' + esc(u.code) + '">' + esc(u.name) + '</option>'; }).join('');
  $('rp-user').value = me.code;
  $('rp-user').onchange = function () {
    CFG.users.forEach(function (u) { if (u.code === $('rp-user').value) me = u; });
    try { localStorage.setItem(CFG.userKey, me.code); } catch (e) { /* not saved, only for this visit */ }
    msg('User login: ' + me.name + '.', 'ok');
  };
  opts($('rp-plant'), Object.keys(CFG.plants).map(function (p) { return [p, CFG.plants[p].name]; }), 'Pilih Plant');
  opts($('rp-mstatus'), CFG.machineStatus.map(function (x) { return [x, x]; }), 'Pilih');
  opts($('rp-unit'), CFG.units.map(function (x) { return [x, x]; }), 'Pilih Satuan');
  $('rp-status').innerHTML = CFG.status.map(function (x) { return '<option value="' + x + '">' + x + '</option>'; }).join('');   /* URGENT is the first and preselected, as in the reference screen */
  $('rp-desc').maxLength = CFG.descMax;
  $('rp-from').value = addDays(t, -1); $('rp-to').value = t;
  buildHead(); initPicker();
  combo({ input: $('rp-material'), list: $('rp-material-list'), search: searchMaterial, pick: setMaterial, edit: function () { st.material = null; $('rp-desc-wrap').hidden = true; updateStock(); },
    blur: function () { var i = $('rp-material'); if (i.value && !st.material) i.classList.add('bad'); } });
  combo({ input: $('rp-machine'), list: $('rp-machine-list'), search: searchMachine, pick: setMachine, edit: function () { st.machine = null; },
    blur: function () { var i = $('rp-machine'); if (i.value && !st.machine) i.classList.add('bad'); } });
  $('rp-plant').onchange = function (e) { clear(e); plantChanged(); };
  ['rp-mstatus', 'rp-unit', 'rp-status', 'rp-use', 'rp-desc', 'rp-note'].forEach(function (i) { $(i).addEventListener('change', clear); $(i).addEventListener('input', clear); });
  $('rp-qty').addEventListener('input', function (e) { e.target.value = e.target.value.replace(/\D/g, ''); clear(e); });   /* numbers only */
  $('rp-add').onclick = addRequest;
  $('rp-toggle').onclick = function () { var b = $('rp-body'); b.hidden = !b.hidden; this.setAttribute('aria-expanded', String(!b.hidden)); };
  $('rp-from').addEventListener('change', renderBody); $('rp-to').addEventListener('change', renderBody);
  $('rp-refresh').onclick = function () { RQ = load() || RQ; renderBody(); msg('', ''); };
  $('rp-sap').onclick = toSap; $('rp-export').onclick = toExcel;
  $('rp-tbody').addEventListener('click', onTable); $('rp-tbody').addEventListener('change', onTable);
  $('rp-table').querySelector('thead').addEventListener('input', onFilter);
  updateStock(); renderBody();
  window.RequestPR.render = function () {   /* called by the app whenever this tab is shown or the refresh button is pressed */
    var a = document.activeElement;
    if (a && $('rp-tbody').contains(a)) return;   /* do not redraw while a PR number is being typed */
    RQ = load() || RQ; renderBody(); updateStock();
  };
}
init();
})();
