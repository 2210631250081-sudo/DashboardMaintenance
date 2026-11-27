/* Checks for the pure parts of js/request-pr.js (Excel layout and the .xlsx writer). Run: node test/request-pr.test.js
   The form, lists and calendar need a browser and are not covered here. */
var fs = require('fs'), path = require('path'), fails = 0, n = 0;
global.window = {};
new Function(fs.readFileSync(path.join(__dirname, '..', 'js', 'request-pr.js'), 'utf8'))();   /* no document here, so only the Excel helpers are set up */
var core = window.RequestPR.core;
function ok(c, m) { n++; if (!c) { fails++; console.log('FAIL: ' + m); } }
function eq(a, b, m) { ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }

ok(core.crc32(new TextEncoder().encode('123456789')) === 0xCBF43926, 'crc32 of 123456789');
eq(core.serial('2026-11-18'), 46344, 'Excel date number of 2026-11-18');
eq(core.serial('1900-03-01'), 61, 'Excel date number of 1900-03-01');

var base = { date: '2026-11-18', name: 'FAJAR', by: 'FAJAR', material: 'IMTNME01833', description: 'SEAL_P-7', maker: '', qty: 20, unit: 'EA', status: 'STOCK', plant: '6410', machine: '33002', machineStatus: 'STOP', useDate: '2026-11-21', note: 'uji', pr: '', prDate: '' };
eq(core.tracking(base), '33002STOCK', 'tracking number = machine + status');

/* REQUESTOR = who requested + first letter of the machine status + first letter of who downloads */
eq(core.requestorOf(base, 'PARMI'), 'FAJAR-S-P', 'Fajar requested, machine STOP, Parmi downloads -> FAJAR-S-P');
eq(core.requestorOf(Object.assign({}, base, { machineStatus: 'RUN' }), 'PARMI'), 'FAJAR-R-P', 'machine RUN -> R');
eq(core.requestorOf(Object.assign({}, base, { machineStatus: 'TPM' }), 'PARMI'), 'FAJAR-T-P', 'machine TPM -> T');
eq(core.requestorOf(base, 'Suparmi'), 'FAJAR-S-S', 'the downloader letter follows whoever downloads');
eq(core.requestorOf({ name: 'BUDI LAKSO', requestor: 'BUDIL-S-P', machineStatus: 'RUN' }, 'PARMI'), 'BUDIL-R-P', 'row saved by the first version: requester taken from its old requestor');
core.CFG.requestorStatus = 'status';
eq(core.requestorOf(base, 'PARMI'), 'FAJAR-S-P', 'switch to the Status field (STOCK -> S)');
core.CFG.requestorStatus = 'machineStatus';

var sap = core.sapSheet([base, Object.assign({}, base, { plant: '6420', material: 'NON MASTER', description: 'BEARING 6204' })], '2026-11-18', 'PARMI');
eq(sap.rows[1][1].v, 'FAJAR-S-P', 'REQUESTOR cell of the SAP file');
eq(sap.rows[0].map(function (c) { return c ? c.v : ''; }), ['JML CHAR', 'REQUESTOR', 'PLANT', 'MAPIN', 'PURCH GROUP', 'MATERIAL GROUP', 'MATERIAL', 'MATERIAL DESCRIPTION', 'QTY', 'UNIT', 'PRICE', '', 'DELIVERY DATE', 'TRACKING NUMBER', 'KETERANGAN'], 'SAP header');
eq(sap.rows[1].length, 15, 'SAP row has 15 columns');
eq([sap.rows[1][2].v, sap.rows[1][3].v, sap.rows[1][4].v], ['6410', '6400', '64G'], 'Cikarang: plant, mapin, purchase group');
eq([sap.rows[2][2].v, sap.rows[2][4].v], ['6420', '64H'], 'Karawang: plant, purchase group');
ok(sap.rows[1][7] === null, 'material with master data: description left empty');
eq(sap.rows[2][7] && sap.rows[2][7].v, 'BEARING 6204', 'NON MASTER: description filled');
ok(sap.rows[1][0] === null && sap.rows[1][5] === null && sap.rows[1][10] === null, 'JML CHAR, MATERIAL GROUP and PRICE stay empty');
eq([sap.rows[1][12].v, sap.rows[1][13].v, sap.rows[1][14].v], [46347, '33002STOCK', 'uji'], 'delivery date, tracking number, keterangan');
eq(sap.name, 'REQUEST PR - 2026-11-18', 'SAP sheet name');

var ex = core.exportSheet([base]);
eq(ex.rows[0][0].v, 'Request PR | CMMS', 'export title');
eq(ex.rows[2].map(function (c) { return c.v; }), ['#', 'TANGGAL', 'NAME', 'MATERIAL', 'DESCRIPTION', 'MAKER', 'QTY', 'STATUS', 'PLANT', 'NO MESIN', 'STATUSMESIN', 'NO PR', 'TANGGALPR'], 'export header');
eq(ex.filter, 'A3:M4', 'filter range covers header and data');
eq([ex.rows[3][8].v, ex.rows[3][9].v], [6410, 33002], 'plant and machine number are numbers like the reference file');

[sap, ex].forEach(function (sh) {
  var b = core.buildXlsx(sh), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  ok(dv.getUint32(0, true) === 0x04034b50, sh.name + ': starts like a zip file');
  ok(dv.getUint32(b.length - 22, true) === 0x06054b50, sh.name + ': ends with the zip directory');
  eq(dv.getUint16(b.length - 22 + 10, true), 6, sh.name + ': 6 parts in the zip');
  var txt = Buffer.from(b).toString('latin1');
  ok(txt.indexOf('xl/worksheets/sheet1.xml') > 0 && txt.indexOf('[Content_Types].xml') > 0, sh.name + ': has the required parts');
});
/* characters that would break the XML are escaped */
var evil = core.buildXlsx(core.sapSheet([Object.assign({}, base, { note: 'a & b <c> "d"\u0001' })], '2026-11-18', 'PARMI'));
var t = Buffer.from(evil).toString('latin1');
ok(t.indexOf('a &amp; b &lt;c&gt; &quot;d&quot;</t>') > 0, 'special characters are escaped and the control character is dropped');

console.log(n + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
