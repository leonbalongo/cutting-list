# Cutcraft

An independent, subscription-free sheet cutting planner built for this repository. **No accounts, billing, analytics, calculation quotas, or backend.** All project data and optimization stay in the browser.

> This is a new app, not a modification or rebuild of CutList Optimizer. No code, branding, or assets from the uploaded third-party archive are used. It runs on the web and as a bundled Android app using Capacitor.

## Features

- Editable parts and stock sheets, including multiple materials and finite stock quantities (blank = unlimited stock).
- Integer-coordinate layout geometry at **0.001 mm resolution**; strict input validation without `eval`.
- Saw kerf, four-edge trim, global rotation, and per-part rotation locks for grain-sensitive work.
- Quick (4), Balanced (12), and Thorough (36) multi-start guillotine nesting passes, executed in a **Web Worker** so the interface stays responsive. A running optimization can be cancelled.
- Interactive sheet diagrams, part inspection, placement tables, utilization statistics, and explicit unplaced-part reports.
- Auto-saved workspace, separately saved projects, and JSON backup/restore using browser storage.
- CSV parts import/export, SVG diagrams, placement CSV, and all-sheet printing / browser “Save as PDF”.
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
- Print / PDF uses the **Android print dialog**. Choose **Save as PDF** or a configured print service.
- CSV/JSON import uses the system file chooser. Storage stays private to the app; no broad storage, billing, or account permissions are requested. Android automatic backup is disabled.
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

## CSV format

Dimensions are millimeters. Decimal dimensions support up to three decimal places. Quantities must be positive whole numbers.

```csv
label,width,length,quantity,material,rotate
Side panel,720,560,2,Plywood,true
Shelf,864,540,3,Plywood,false
```

`label`, `width`, `length`, and `quantity` are required headers (case-insensitive). `material` defaults to `Plywood`; `rotate` defaults to true and accepts `false`, `no`, or `0` to lock orientation. CSV import replaces the parts list after confirmation. Material names match exactly and are case-sensitive. Rotation locks preserve the entered width/length axes, so enter stock and parts in consistent grain orientation.

On Android, tap **Import CSV → Choose CSV**, then browse **Files / Downloads**. The picker deliberately shows all file types: Android providers do not label CSV MIME types consistently. Cutcraft validates the selected content rather than trusting its filename or MIME label. JSON backups use **My projects → Open project JSON**, including when the provider omits the `.json` extension. Cancelling or selecting an invalid file leaves the current project untouched, and imports can be retried.

Excel `.xlsx`/`.xls` files are **not** CSV, even after renaming them. Export them as **CSV UTF-8** first. The app now identifies Excel/ZIP and UTF-16 files and shows a persistent explanation in the import dialog.

The placement CSV gives the top-left position of each piece relative to its stock sheet's top-left origin, in millimeters. Part dimensions in that export and the diagram are the **placed dimensions**, after any rotation. Exports are planning documents, not machine/CNC toolpaths.

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

The geometry tests cover exact fits, kerf, decimal precision, trim, rotation, grain locks, material matching, stock inventory, deterministic search, unplaced pieces, 1,200 parts, and randomized geometric invariants across 80 projects. Browser tests cover local persistence, invalidation, validation, table operations, CSV import, exports, diagram inspection and mobile page overflow.

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
src/native.js         Android file export and print bridge
android/              Native Capacitor project, icons and print plugin
capacitor.config.json Native app identity and bundled web configuration
src/style.css         Responsive layout and print styles
public/               Original icon and web manifest
scripts/build-sw.js   Production offline-cache generator
tests/                Unit, randomized geometry and browser tests
```

## License

The independently authored application source in this branch is MIT licensed; see `LICENSE`. This license does not apply to any third-party application archive uploaded elsewhere in the repository history.
