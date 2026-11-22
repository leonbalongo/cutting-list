import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? files(`${dir}/${e.name}`) : `${dir}/${e.name}`,
      ),
    )
  ).flat();
}
const assets = (await files("dist")).filter((p) => !p.endsWith("/sw.js"));
const hash = createHash("sha256");
hash.update(await readFile(new URL(import.meta.url)));
for (const asset of assets) hash.update(await readFile(asset));
const name = `cutcraft-${hash.digest("hex").slice(0, 12)}`;
const urls = assets.map((p) => "/" + p.slice(5));
await writeFile(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(name)};
const ASSETS=${JSON.stringify(["/", ...urls])};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('cutcraft-') && k !== CACHE).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Only cache this build's static assets; never capture imported user files.
  const path = new URL(event.request.url).pathname;
  if (!ASSETS.includes(path) && event.request.mode !== 'navigate') return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // Assets are public, immutable for this build and same-origin. Ignore
    // Vary: Origin added by preview/static hosts: module and precache fetches
    // can otherwise have different Origin headers and miss the offline cache.
    const cached = await cache.match(event.request, { ignoreSearch: true, ignoreVary: true });
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) { if (event.request.mode === 'navigate') return cache.match('/'); throw error; }
  }));
});
`,
);
console.log(`Offline cache: ${urls.length} assets (${name})`);
