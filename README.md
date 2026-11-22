# Cutcraft

An independent, subscription-free sheet cutting planner built for this repository. **No accounts, billing, analytics, calculation quotas, or backend.** All project data and optimization stay in the browser.

> This is a new app, not a modification or rebuild of CutList Optimizer. No code, branding, or assets from the uploaded third-party archive are used. It runs on the web and as a bundled Android app using Capacitor.

## Features

- Editable parts and stock sheets, including multiple materials and finite stock quantities (blank = unlimited stock).
- Integer-coordinate layout geometry at **0.001 mm resolution**; strict input validation without `eval`.
- Saw kerf, four-edge trim, global/per-part rotation locks, and a **Consider grain direction** switch with part and stock grain axes.
- Quick (4), Balanced (12), and Thorough (36) multi-start guillotine nesting passes, executed in a **Web Worker** so the interface stays responsive. A running optimization can be cancelled.
- Interactive sheet diagrams, part inspection, placement tables, utilization statistics, and explicit unplaced-part reports.
- Auto-saved workspace, separately saved projects, and JSON backup/restore using browser storage.
- Spreadsheet import (Excel, OpenDocument, CSV/TSV and more) with worksheet selection and preview; CSV, SVG and placement exports.
- Direct **Complete PDF report** export: every sheet diagram, whole-project/material totals, per-sheet statistics, and requested/placed/unplaced part quantities.
- Responsive desktop/mobile interface and a new, original SVG icon.
- Installable web manifest and a production service worker that precaches the app, including the optimizer worker, for offline use after the first successful online load.

## Run locally

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The development server binds to `0.0.0.0` and permits Arena's `.e2b.app` preview hosts. There is no backend to configure and no API key needed.

## Production

```sh
npm run build
npm run preview
```

Deploy the contents of `dist/` to any static HTTPS host **at its domain root**. HTTPS (or localhost) is required for service workers and installation. The build script generates a content-versioned precache containing the HTML, CSS, JavaScript, worker, icon, and manifest. Wait for the first online load to finish before going offline. A new deployment activates after tabs using the previous version close.

This app uses relative/same-origin assets only; there are no remote fonts, API calls, or third-party scripts. Project data is not included in the service-worker cache.

## Download an Android APK

The **[Android APK workflow](https://github.com/leonbalongo/cutting-list/actions/workflows/android-apk.yml)** builds an installable, debug-signed APK on source pushes and pull requests. Once this workflow is on the default branch, it can also be started with **Run workflow**, selecting the branch to build.

1. Open a successful **Android APK** run for the branch/commit you want.
2. Download **Cutcraft-Android-APK** under **Artifacts** (you must be signed in).
3. Extract the ZIP and open **`Cutcraft-debug.apk`** on your Android phone.
4. Allow **Install unknown apps** for your browser/file manager when Android asks. You can revoke this permission afterward.

The artifact also contains a SHA-256 checksum, APK certificate/package information, and installation notes. Artifacts expire after 90 days; download a copy or rerun the workflow. Only install builds from a repository/commit you trust.

### Android behavior

- Requires **Android 7.0+** and an **up-to-date Android System WebView**. If you see a blank page on an old device, update WebView / Chrome.
- The APK bundles the complete UI, optimizer worker, and icons. It needs **no hosted site or internet connection, even on first launch**. It has no account, subscription, or imposed calculation limit.
- Uses its own package name: `io.github.leonbalongo.cutcraft`. It does not replace the third-party app.
- File exports use **Android's share sheet** instead of unsupported WebView blob downloads. Choose a file manager, Drive, email, etc. to save/send a copy. Cutcraft itself does not upload your project; choosing a cloud destination is your decision.
- **Export plan → Complete PDF report** generates an actual PDF locally and opens Android’s share sheet to save/send it. This does not require a print service. The separate **Print** option still uses the Android print dialog.
- Spreadsheet/JSON import uses the system file chooser. Storage stays private to the app; no broad storage, billing, or account permissions are requested. Android automatic backup is disabled.
- Project data in the APK is separate from the website's browser storage. Export/import JSON to transfer projects. **Uninstalling or clearing app data deletes saved projects.**
- The native app skips the web service worker to avoid stale assets after APK updates. The web version retains offline PWA caching.

**This is a debug/testing APK, not a Play Store release.** Android may display a sideloading/security warning. Each fresh build runner may use a different debug signing key, so an update can fail with a signature mismatch. Export your projects before uninstalling an older testing build. Production distribution requires a private, stable release key and usually an AAB; no release keys or passwords are committed.

### Build Android locally

Requires Node.js 22+, **JDK 21**, and an Android SDK with **platform 36** and **build-tools 36.0.0**. Android Studio can install the SDK. Set `ANDROID_HOME`/`JAVA_HOME` for your machine.

```sh
npm ci
npm run android:apk
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android:sync` rebuilds web assets and syncs native plugins; run it after web changes. `npm run android:open` opens the checked-in Android project in Android Studio. `npm run android:icons` regenerates legacy launcher PNGs from the original SVG; adaptive and splash vector icons live in Android resources. Do not commit APKs, local SDK paths, generated web copies, or signing keys.

### Install the website instead

Alternatively, open a deployed HTTPS web version and use **Install app** / **Add to home screen**. Browser installation support varies. The website includes SVG, 192px / 512px PNG, and Apple touch icons.

## Spreadsheet imports

Use **Import spreadsheet → Choose spreadsheet**. Select a file, choose a worksheet in the preview, and tap **Import parts**. Existing parts are replaced only after confirmation; stock and cut settings are not overwritten. Disabled rows and note-only rows are counted as skipped. Invalid measurement rows block import with a row-specific explanation rather than disappearing silently.

Supported/tested formats:

- Excel **XLSX, XLS, XLSM, XLSB** (macros are not executed).
- OpenDocument **ODS, FODS**.
- **CSV**, tab-separated **TSV/TXT**, and Excel **SpreadsheetML XML**.
- Google Sheets: download as XLSX, ODS, CSV or TSV first. Apple Numbers and other proprietary formats are not guaranteed; export to XLSX or CSV if they cannot be read. Encrypted/password-protected workbooks must be unlocked first. There is no promise of accepting every spreadsheet format in existence.

The local parser detects content, not just the filename or MIME type, so an Excel workbook incorrectly named `.csv` can still be read. Android file providers may label files generically; the chooser intentionally displays all files. Parsing runs in a separate worker. No file is uploaded, no macro or spreadsheet formula is executed, and hyperlinks are not followed. Formula cells must contain saved/calculated values—recalculate and save in a spreadsheet editor first. UTF-8 and UTF-16 delimited text are supported.

### Column names

Headers are case-insensitive. Titles/blank rows above the header are allowed.

| Field    | Recognized headings                             | Required / default                     |
| -------- | ----------------------------------------------- | -------------------------------------- |
| Width    | Width, W, Width (mm)                            | Required, millimeters                  |
| Length   | Length, Height, L, H, Length (mm), Height (mm)  | Required, millimeters                  |
| Quantity | Quantity, Qty, Count, Pieces, Pcs, Number       | Required, positive whole number        |
| Label    | Label, Name, Part, Part name, Description, Item | Optional; Part 001, Part 002, …        |
| Material | Material, Board, Material name                  | Optional; Plywood                      |
| Rotation | Rotate, Rotation, Allow rotation                | Optional; true                         |
| Grain    | Grain, Grain direction, Grain axis              | Optional; length                       |
| Enabled  | Enabled, Active, Include                        | Optional; true; false rows are skipped |

Boolean columns accept true/false, yes/no, 1/0 (also on/off). Dimensions support up to **three decimal places**; do not use mixed units, fractions, or ambiguous thousands/decimal separators. Unsupported unit headers such as Width (cm) are rejected instead of silently treating centimeters as millimeters.

```csv
label,width,length,quantity,material,rotate,grain,enabled
Side panel,560,720,2,Plywood,true,length,true
Shelf,540,864,3,Plywood,true,none,true
```

The original `Length,Width,Qty,Enabled` layout is supported without adding a label column. Multiple worksheets are previewed independently; only the selected one is imported. Cancelling or closing the dialog leaves the existing project unchanged. JSON project backups remain under **My projects → Open project JSON**.

## Grain consideration

Turn on **Cut settings → Consider grain direction** to expose grain selectors on both tables:

- **Length** = along the entered length (vertical in the diagram), not necessarily the longer side.
- **Width** = along the entered width (horizontal in the diagram).
- A part can use **Any / none** if it has no grain requirement. Stock uses length or width.

The optimizer only places a grained part when its final grain axis matches the stock. A 90° turn changes the grain axis—even for a square part—and is allowed only if the global and per-part rotation switches allow it. If consideration is off, stored grain axes are ignored but rotation locks still apply. Existing projects default to consideration off and length axes. Direction settings persist in project backups; the parts CSV export includes the `grain` column. No automatic guess is made from which dimension happens to be longer.

## Complete PDF reports

After optimizing, choose **Export plan → Complete PDF report**. The app downloads a real `.pdf` in the browser or opens the share sheet in Android. Reports include:

1. Whole-work totals: requested, placed and unplaced parts; sheet count; stock, net part and remaining area; utilization; material breakdown; kerf, trim, grain/rotation settings and solve statistics.
2. **Every sheet**, not just the active tab, as a sharp vector diagram with dimensions, part identifiers, grain direction and per-sheet usage/area statistics.
3. A paginated part appendix with original dimensions, material, requested/placed/unplaced quantities and grain settings. Partial and fully unplaced plans are explicitly reported.

Remaining area includes trim, saw kerf and offcuts; it is not all reusable. PDFs are planning documents, not physical-scale templates or machine/CNC toolpaths. The original Print option and placement CSV remain available; placement CSV coordinates are measured from the stock’s top-left and show placed (possibly rotated) dimensions.

Both spreadsheet import and PDF export work offline after the web app has cached its build, and from first launch in the APK. Report code and a bundled Noto Sans font are loaded locally on demand. This font covers many Latin/Greek/Cyrillic labels but is not a universal font for every writing system.

## Accuracy & performance

`src/optimizer.js` is a dependency-free guillotine packing heuristic. Each trial sorts expanded part instances by one of four size rules, chooses feasible positions from disjoint free rectangles, and splits the remaining space along guillotine lines. Trials compare three placement scores and, in Thorough mode, three split policies. The best trial minimizes unplaced part count first, total sheet area second, and sheet count third.

- Parts never overlap and must fit inside the trimmed sheet boundary.
- Kerf is reserved between neighboring parts, not unnecessarily beyond an outer stock edge.
- Materials, stock inventory, and permitted orientations are enforced.
- Oversize parts and exhausted stock are reported, not silently discarded.
- Coordinates are integer thousandths of a millimeter; utilization is a floating-point statistic.
- “Remaining area” includes saw kerf, edge trim, and offcuts; it is **not** a promise of reusable offcut area.
- There is **no application-imposed part or calculation quota**. Runtime and memory depend on your device and project. The search is heuristic, not a proof of globally optimal packing. Very large jobs can exhaust device resources; try Quick mode or smaller batches.
- There is no benchmark claiming this is faster or more accurate than a proprietary app. Background computation and the small, dependency-free runtime keep normal projects responsive.

Always verify dimensions, grain, blade width, and the physical cut sequence before cutting. The app does not generate an ordered saw-operation list, handle defects/irregular shapes, or account for edge banding thickness.

## Data & backups

The workspace and named projects are stored in `localStorage` on the current browser origin. Clearing site data, changing browser/profile/domain, or private browsing may remove or isolate them. Use **Export plan → Project backup** to keep JSON copies. Export is available even before a successful optimization. If storage is unavailable/full, the app warns and can still export backups.

## Tests

```sh
npm test                  # geometry, validation and CSV tests
npm run build             # production bundling + offline precache
npx playwright install chromium
npm run test:browser      # desktop/mobile browser flows
```

The geometry tests cover exact fits, kerf, decimal precision, trim, rotation, grain locks, material matching, stock inventory, deterministic search, unplaced pieces, 1,200 parts, and randomized geometric invariants across 80 projects. Spreadsheet tests exercise all listed formats, aliases, enabled rows and formula caches. PDF tests verify page structure, complete sheet coverage, pagination, statistics and binary Android export. Browser tests click the real file chooser and cover preview/worksheet selection, persisted grain settings, direct PDF downloads and offline imports/reports, as well as existing flows.

To exercise offline behavior against a production preview:

```sh
npm run build
npm run preview -- --port 4173
# In a second terminal:
TEST_BASE_URL=http://localhost:4173 TEST_PRODUCTION=1 npm run test:browser
```

`PW_CHROMIUM_EXECUTABLE=/path/to/chromium` can select an existing test browser. Browser binaries and generated artifacts are not checked into Git.

## Project structure

```text
src/main.js           UI, persistence, import/export and worker orchestration
src/optimizer.js      Independent packing engine and validation
src/worker.js         Worker message boundary
src/csv.js            CSV parsing and serialization
src/grain.js          Grain axis validation and orientation matching
src/spreadsheet.js    Workbook decoding and measurement normalization
src/spreadsheet-worker.js  Background workbook parsing
src/pdf-report.js     Vector PDF report and statistics
src/native.js         Android file export and print bridge
android/              Native Capacitor project, icons and print plugin
capacitor.config.json Native app identity and bundled web configuration
src/style.css         Responsive layout and print styles
public/               Original icon and web manifest
scripts/build-sw.js   Production offline-cache generator
tests/                Unit, randomized geometry and browser tests
```

## License

The independently authored application source in this branch is MIT licensed; see `LICENSE`. This license does not apply to any third-party application archive uploaded elsewhere in the repository history, bundled fonts, or third-party dependencies. Noto Sans is SIL OFL licensed (`public/fonts/OFL.txt`); spreadsheet parsing uses SheetJS CE 0.20.3 (Apache-2.0, distributed through the `@e965/xlsx` npm mirror), and PDF generation uses jsPDF (MIT). License copies are in `public/licenses/` and the installed packages.
