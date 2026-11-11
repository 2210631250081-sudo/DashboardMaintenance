# SAP PM Dashboard: frontend demo (standalone)

Plain HTML, CSS and JavaScript. **Not integrated with B2E**, SAP or Call System. It exists to be studied and discussed with IT before being adapted to B2E.

| Module | Data source |
|---|---|
| 01 Reliability & Cost | `CALL SISTEM 2026.xlsx`, sheet `new section` (Oct 2025 to Apr 2026) |
| 02 Maintenance Calendar | Google Sheet `Data_dashboard`, tab `Maintenance_Kalender` (read live, see "Google Sheets connection"). The copy in `js/data.js` comes from `Data_dashboard.xlsx` (719 orders: 699 for plant 6410 and 20 for plant 6420, May to Oct 2026, updated 3 Nov 2026; the sheet now also has a `Description` column (SAP `CAUFVD-KTEXT`), shown in both order tables of the calendar) |
| 03 Inventory Monitoring | Google Sheet `Data_dashboard`, tab `Min_Max_Stok` (read live). The copy in `js/data.js` comes from `Data_dashboard.xlsx` (16127 rows: 7899 for plant 6410 and 8228 for plant 6420, updated 3 Nov 2026) |

## Run locally
1. Unzip and open `index.html` in a browser (no server, build step or install needed).
2. Internet is needed for two things: Chart.js 2.4.0 from cdnjs, and reading the Google Sheet (without internet the page shows the copy in `js/data.js` and says so in the bar under the title).
   Chart.js: For offline use, download that file, save it as `vendor/Chart.min.js`, and change the script tag in `index.html` to `vendor/Chart.min.js`. Without Chart.js, the KPIs, calendar and tables still work and a warning banner appears.
3. Optional data and calculation checks (Node.js): `node test/validate.js`

## Files
| File | Role |
|---|---|
| `index.html` | Page layout, filters, containers. IDs are prefixed `rc-`, `mc-`, `iv-` per module |
| `css/styles.css` | Styling and status colors |
| `js/data.js` | The three datasets copied from the Excel files (REL, ORD, MAT). REL is the only one used live (Reliability & Cost); ORD and MAT are the fallback when the Google Sheet cannot be read |
| `js/calc.js` | Pure calculations (no DOM): IR, MTTR, MTBF, orders per month and type, inventory gap and status |
| `js/sheets.js` | Reads the two Google Sheet tabs (Maintenance_Kalender, Min_Max_Stok) and returns the same record shapes as `data.js`. The only file that uses the network |
| `js/ui.js` | Rendering, filters, calendar, sortable tables, charts |
| `test/validate.js` | Node checks of data consistency and calculations |
| `CALL SISTEM 2026.xlsx`, `Data_dashboard.xlsx` | Source Excel files |

## Google Sheets connection (Maintenance Calendar and Inventory Monitoring)
The page reads the two tabs straight from the Google Sheet when it opens, every 5 minutes after that, and when the refresh button (red, top right of the bar) is pressed. A change made in the sheet therefore shows up within a few minutes, without touching any file. It is "near real time", not instant: Google can hold a change back for a short while.

- **Sheet link and tab names** are at the top of `js/sheets.js` (`sheetId`, `orders.sheet`, `materials.sheet`, `refreshMinutes`).
- **Sharing**: the spreadsheet must be shared as "Anyone with the link: Viewer", otherwise Google answers with a sign-in page and the dashboard falls back to `js/data.js`. Anyone with the link can read the sheet, so only dummy or non-confidential data belongs there.
- **Layout the page expects** (same as `Data_dashboard.xlsx`): column A is a marker (`Value` on data rows; rows with other text in column A, such as SAP / Dashboard / Table Name / FieldName, are label rows and are ignored). Columns are found by their title row: `Order, Equipment_No, Type_Order, Description, Planned_Start, Plant` and `Plant, Material, Description, Minimum Stock, Maximum Stock, Actual Stock`. If the title row cannot be found, the same columns are read by position (B to G) and the bar says "columns read by position". Do not insert, delete or reorder columns without telling the dashboard owner.
- **Values**: `Planned_Start` as `31/7/2026` or `2026-07-31`; stock columns as plain numbers. Empty `Minimum Stock` and `Maximum Stock`, or 0, mean "not set". Rows with an invalid value (text in a number column, impossible date, empty Plant / Material / Order / Actual Stock) are ignored and counted in the bar, which then turns orange.
- **If the sheet cannot be read** (no internet, not shared, wrong tab name, browser blocks it), nothing breaks: the page keeps the data it already has (the `js/data.js` copy, or the last good read) and the bar says what went wrong.
- **How the tabs are requested**: by tab name through Google's "gviz" address, loaded as a `<script>` tag. A plain `fetch()` to that address is blocked by the browser (CORS error, seen when `index.html` is opened from a folder), a script tag is not. The two tabs are requested one after the other.
- **Alternative**: File > Share > Publish to web, choose the tab and "Comma-separated values (.csv)", and paste each link into `csvUrl` in `js/sheets.js` (one per tab). Those links are read with `fetch()`, which Google allows for published CSV. No other change is needed.
- **In B2E** this must not stay: the data comes from the C# backend. Replace `js/sheets.js` with the backend call (`_fw_post`) that returns the same two lists (orders, materials); `calc.js` and `ui.js` do not need to change.

## Update the fallback copy and Reliability data
`js/data.js` is still read for Reliability & Cost (`var REL`, from `CALL SISTEM 2026.xlsx`) and is the fallback for the other two modules. To refresh the fallback after the Google Sheet changes, regenerate the matching block in `js/data.js` (`var MAT` for tab `Min_Max_Stok`, `var ORD` for tab `Maintenance_Kalender`), then run `node test/validate.js`. If the counts change, update the expected numbers in `test/validate.js` as well.

## Rules used
- Reliability (KALKULASI slide): IR (%) = Breakdown Time / Loading Time x 100; MTTR = Breakdown Time / Breakdown Frequency; MTBF = Loading Time / Breakdown Frequency. Loading Time = working hours - planned stop. Times are in minutes in the source and shown in hours. For a period, times and frequencies are summed first, then divided.
- Loading Time, Breakdown Time and Breakdown Frequency (troubles with Mesin Stop = Yes) are the per-section monthly figures in sheet `new section`. With these figures the formulas reproduce the IR, MTTR and MTBF printed in that sheet (checked in `test/validate.js`). PROD 1 to 3 = Cikarang, PROD 4 and 5 = Karawang.
- Maintenance cost, per-machine Loading Time and May 2026 are not available in the Call System file, so they show Unavailable or are left out.
- Calendar: each order is shown on its planned start date, coloured by order type (ZPM1, ZPM2). The sheet has no end date, status or confirmation, so Planned / Completed / Overdue and the completion rate are not calculated (Unavailable).
- Inventory: Gap = Actual Stock - Minimum Stock, calculated by the app (Unavailable when no minimum is set). Two separate columns. **Category**: Slow Moving when Minimum and Maximum are both 0 or empty (not maintained in SAP), Fast Moving when a Minimum and/or Maximum is set. **Status**, first match wins: Out of Stock when Actual Stock is 0 (any category); Unclassified when only the Minimum is not set; Below Minimum; Above Maximum (only when a Maximum is set); Normal (a Slow Moving material with stock has no Minimum or Maximum to cross, so it is Normal). The sheet has no unit column, so quantities are shown without a unit. The inventory table shows 200 rows at a time (button "Show more"); the count and KPIs always cover all rows that match the filters.

## Not done / not verified
- The Google Sheets connection was tested here without internet: the sheet reader, the Slow Moving rule and the page wiring ran against the Excel data turned into sheet-style text and against a fake Google answer (`node test/validate.js`). The first version (fetch of the gviz address) was blocked by the browser (CORS) on a real computer; the script-tag version replaces it and has not yet been confirmed against the real Google server. First check when you open `index.html` with internet: the bar under the title should say "Google Sheets, 719 orders and ... materials". If it says "Google Sheets problem", the message tells which cause applies.
- The Reliability & Cost module is not connected to Google Sheets (its data is not in that spreadsheet).
- Slow Moving rows exist only when the sheet has materials with Minimum and Maximum 0 or empty; the bundled copy in `js/data.js` has none, so all its rows are Fast Moving and its status counts below have no Slow Moving materials.
- In the 3 Nov 2026 `Min_Max_Stok`, Actual Stock is 0 for 1011 of 16127 rows (Out of Stock), and the sheet's own Gap column equals Actual - Minimum in all 16127 rows. The app still calculates Gap itself. Statuses: Out of Stock 1011, Below Minimum 3132, Normal 9556, Above Maximum 2428 (checked against the Excel file).
- Recomputing Breakdown Time from the raw sheet `data` of the Call System file (sum of `ResolvedTime` for Mesin Stop = Yes, PROD 1 to 5) gives different totals from the KPI sheet (for example Jan 2026: 365,473 min against 433,643 min), so the dashboard uses the KPI sheet figures. The rule behind the KPI sheet figures is not confirmed.
- Not tested in the real B2E runtime, and not opened in every browser. Field names are proposed, not verified SAP or Call System names.
- The UI was opened in a headless Chromium without internet, so Chart.js did not load and the charts were not checked visually. KPIs, filters, calendar and tables were checked.
"# DashboardMaintenance" 
