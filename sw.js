/* Service worker : permet d'installer Voisina comme une application
   et de l'ouvrir sans connexion. Stratégie "réseau d'abord" : on affiche
   toujours la version la plus récente, et la copie en cache seulement hors ligne. */
const CACHE = "voisina-v2.0.0";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/styles.css",
  "./assets/fonts/fraunces-latin-600-normal.woff2",
  "./assets/img/favicon.svg",
  "./assets/js/theme-boot.js",
  "./assets/js/app.js",
  "./assets/js/util.js",
  "./assets/js/icons.js",
  "./assets/js/i18n.js",
  "./assets/js/translations.js",
  "./assets/js/data.js",
  "./assets/js/seed.js",
  "./assets/js/store.js",
  "./assets/js/auth.js",
  "./assets/js/ui.js",
  "./assets/js/map.js",
  "./assets/js/ics.js",
  "./assets/js/switzerland.js",
  "./assets/js/pages-content.js",
  "./assets/js/views/home.js",
  "./assets/js/views/explore.js",
  "./assets/js/views/listing.js",
  "./assets/js/views/publish.js",
  "./assets/js/views/messages.js",
  "./assets/js/views/planning.js",
  "./assets/js/views/auth.js",
  "./assets/js/views/account.js",
  "./assets/js/views/profile.js",
  "./assets/js/views/admin.js",
  "./assets/js/views/pages.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // On ne gère que nos propres fichiers (pas les cartes ni les services externes).
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
