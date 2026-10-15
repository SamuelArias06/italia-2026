// Bump VERSION whenever any file changes so phones pick up the new copy.
const VERSION = "italia2026-v4";
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "data.json",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "fonts/atkinson-400.woff2",
  "fonts/atkinson-700.woff2",
  "fonts/fraunces.woff2",
  "fonts/fraunces-italic.woff2",
  "pases.bin"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first for the page and data (so edits show up when online), cache first for the rest.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // The app asks for cache: "reload" when the cached pases.bin is older than data.json.
  const fresh = e.request.mode === "navigate" || url.pathname.endsWith("data.json") || e.request.cache === "reload";
  if (fresh) {
    e.respondWith(
      fetch(e.request)
        .then((res) => { if (!res.ok) return res; const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
    );
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
  }
});
