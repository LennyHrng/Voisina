/* Service worker : permet d'installer Voisina comme une application et de l'ouvrir hors ligne.
   Stratégie "réseau d'abord" : toujours la version la plus récente, le cache seulement hors ligne. */
const CACHE = "voisina-v3.1";
const SHELL = ["./", "./index.html", "./styles.css?v=3.1", "./voisina.js?v=3.1", "./theme-boot.js?v=3.1", "./fraunces-latin-600-normal.woff2", "./favicon.svg", "./manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html"))));
});
