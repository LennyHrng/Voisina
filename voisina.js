/* Voisina — tous les modules JavaScript réunis dans un seul fichier (généré à partir du dossier src/). */
(function () {
"use strict";
const __defs = {}, __cache = {};
function __def(name, fn) { __defs[name] = fn; }
function __req(name) { if (!(name in __cache)) { __cache[name] = {}; __cache[name] = __defs[name](); } return __cache[name]; }
__def("util.js", function () {
/* =====================================================================
   OUTILS GÉNÉRAUX
   ---------------------------------------------------------------------
   Le point le plus important de ce fichier est la fonction `html` :
   toutes les valeurs insérées dans une page passent par elle et sont
   automatiquement "échappées". Un texte comme <script> devient
   &lt;script&gt; et s'affiche au lieu de s'exécuter => protection XSS.
   ===================================================================== */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;", "=": "&#61;" };

/** Échappe un texte pour l'insérer sans danger dans du HTML. */
function esc(value) {
  return String(value ?? "").replace(/[&<>"'`=]/g, (c) => ESCAPES[c]);
}

/** Contenu HTML déjà sûr (généré par `html` ou par nous-mêmes). */
class SafeHTML {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

/** Marque une chaîne comme sûre. À n'utiliser QUE pour du HTML écrit par nous (icônes…). */
const raw = (value) => new SafeHTML(String(value));

function renderValue(value) {
  if (value === null || value === undefined || value === false || value === true) return "";
  if (value instanceof SafeHTML) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  return esc(value);
}

/** Gabarit HTML avec échappement automatique : html`<p>${texte}</p>` */
function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += renderValue(values[i]) + strings[i + 1];
  return new SafeHTML(out);
}

/** Insère un contenu sûr dans un élément. */
function mount(el, content) {
  if (!el) return;
  el.innerHTML = content instanceof SafeHTML ? content.value : esc(content);
}

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/* ---------------------------------------------------------------------
   STOCKAGE LOCAL
   Toutes les lectures/écritures sont protégées (try/catch) : en navigation
   privée ou si le stockage est plein, le site continue de fonctionner.
   --------------------------------------------------------------------- */
const PREFIX = "voisina:v2:";
const memoryFallback = new Map();

const storage = {
  get(key, fallback) {
    try {
      const rawValue = localStorage.getItem(PREFIX + key);
      if (rawValue === null) return memoryFallback.has(key) ? memoryFallback.get(key) : fallback;
      return JSON.parse(rawValue);
    } catch {
      return memoryFallback.has(key) ? memoryFallback.get(key) : fallback;
    }
  },
  /** Retourne true si l'écriture a réussi, false si le stockage est plein. */
  set(key, value) {
    memoryFallback.set(key, value);
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    memoryFallback.delete(key);
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignoré */ }
  },
  /** Supprime toutes les données Voisina de ce navigateur. */
  clearAll() {
    memoryFallback.clear();
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
    } catch { /* ignoré */ }
  },
  /** Supprime les données de l'ancienne version (mots de passe en clair !). */
  purgeLegacy() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("vc_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignoré */ }
  },
};

/** Identifiant aléatoire non devinable (générateur cryptographique). */
function uid(prefix = "") {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
}

function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** Distance en km entre deux points GPS (formule de haversine). */
function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Générateur pseudo-aléatoire "à graine" : mêmes données sur tous les appareils. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Date locale au format AAAA-MM-JJ (sans décalage de fuseau horaire). */
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayKey() {
  return dateKey(new Date());
}

/** Initiales pour les avatars : "Léa Martin" -> "LM" */
function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Couleur d'avatar stable dérivée du nom (6 teintes de la charte). */
function avatarTone(seed) {
  return `tone-${hashString(seed) % 6}`;
}

/** Détection simple de coordonnées ou demandes sensibles (conseil de sécurité). */
function detectSensitive(text) {
  const value = String(text || "");
  const found = [];
  if (/(\+41|0041|\b0)\s?\d{2}[\s./-]?\d{3}[\s./-]?\d{2}[\s./-]?\d{2}\b/.test(value)) found.push("phone");
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) found.push("email");
  if (/\bCH\d{2}[\s]?(\d{4}[\s]?){4}\d\b/i.test(value) || /\biban\b/i.test(value)) found.push("iban");
  if (/(mot de passe|passwort|password|code (pin|sms|de confirmation)|pin-code|tan\b|western union|moneygram|carte cadeau|gift ?card|geschenkkarte|crypto|bitcoin)/i.test(value)) found.push("scam");
  return found;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Lit un fichier image, vérifie son type réel et le ré-encode.
 *  Le ré-encodage supprime les métadonnées EXIF (dont la position GPS
 *  que les smartphones ajoutent aux photos !). */
async function processImage(file, maxSize = 1200, quality = 0.82) {
  if (!file) throw new Error("no-file");
  if (file.size > 8 * 1024 * 1024) throw new Error("too-large");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 && header[8] === 0x57 && header[9] === 0x45;
  const isGif = header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46;
  if (!(isJpeg || isPng || isWebp || isGif)) throw new Error("bad-type");

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("bad-type"));
      image.src = url;
    });
    const ratio = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** N'accepte que des images que NOUS avons produites (data:image/jpeg;base64). */
function safeImageSrc(value) {
  return typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "";
}

/** Télécharge un fichier généré dans le navigateur. */
function downloadFile(filename, content, type = "application/octet-stream") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

return { esc, html, mount, uid, debounce, distanceKm, seededRandom, hashString, dateKey, parseDateKey, todayKey, initials, avatarTone, detectSensitive, prefersReducedMotion, processImage, safeImageSrc, downloadFile, raw, $, $$, storage, clamp };
});
__def("icons.js", function () {
/* =====================================================================
   ICÔNES (SVG en ligne, style "trait" cohérent — inspirées de Lucide, licence ISC)
   Un seul style d'icônes pour tout le site = rendu professionnel,
   identique sur Windows, Mac, Android et iPhone (contrairement aux emojis).
   ===================================================================== */
const { raw } = __req("util.js");

const P = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  locate: '<path d="M2 12h3"/><path d="M19 12h3"/><path d="M12 2v3"/><path d="M12 19v3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  pencil: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  paw: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  laptop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="m7.5 4.27 9 5.15"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4"/><path d="M21 5h-4"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  armchair: '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  badgeCheck: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13h4"/><path d="M10 17h4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  hand: '<path d="M11 12h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 14"/><path d="m7 18 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 13 6 6"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
};

/** Retourne une icône SVG (décorative : cachée aux lecteurs d'écran). */
function icon(name, cls = "") {
  const paths = P[name] || P.sparkles;
  return raw(
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`
  );
}

/** Logo Voisina : la feuille de la version originale, redessinée proprement. */
function logo(cls = "") {
  return raw(`<svg class="logo-mark ${cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <rect width="48" height="48" rx="14" fill="#12372A"/>
    <path d="M38.5 9.5C27.6 10 17.6 13.6 12 20.6C7.2 26.6 9.1 36.1 9.9 38.8C17.7 38.2 26.8 35.4 32.7 28.7C37.9 22.7 38.8 14.6 38.5 9.5Z" fill="#5E9F68"/>
    <path d="M10.6 38.3C17.4 29.4 24.3 23.5 34.9 15.1" stroke="#DCEFE2" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M20.2 28.6 19.1 21.8M27 22.9 26.1 17.1" stroke="#DCEFE2" stroke-width="2" stroke-linecap="round" fill="none"/>
  </svg>`);
}

return { icon, logo };
});
__def("translations.js", function () {
/* =====================================================================
   TEXTES DU SITE — français (fr), allemand (de), italien (it), anglais (en)
   Pour ajouter un texte : ajoutez la même clé dans les 4 langues.
   {nom} = variable remplacée automatiquement.
   ===================================================================== */

const fr = {
  // Langues
  "lang.fr": "Français", "lang.de": "Deutsch", "lang.it": "Italiano", "lang.en": "English",

  // Méta
  "meta.homeTitle": "L'entraide locale en Suisse",
  "meta.exploreTitle": "Explorer les annonces",
  "meta.messagesTitle": "Messagerie",
  "meta.planningTitle": "Mon planning",
  "meta.accountTitle": "Mon compte",

  // Navigation
  "nav.main": "Navigation principale",
  "nav.home": "Accueil",
  "nav.explore": "Explorer",
  "nav.planning": "Mon planning",
  "nav.messages": "Messages",
  "nav.messagesShort": "Messages",
  "nav.safety": "Sécurité",
  "nav.publish": "Publier",
  "nav.login": "Connexion",
  "nav.logout": "Se déconnecter",
  "nav.account": "Mon compte",
  "nav.profile": "Profil",
  "nav.admin": "Administration",
  "nav.language": "Changer de langue",

  // Commun
  "common.cancel": "Annuler",
  "common.close": "Fermer",
  "common.save": "Enregistrer",
  "common.back": "Retour",
  "common.view": "Voir",
  "common.next": "Page suivante",
  "common.previous": "Page précédente",
  "common.pagination": "Pagination",
  "common.breadcrumb": "Fil d'Ariane",
  "common.flexible": "Flexible",
  "common.formerMember": "Ancien membre",

  // Démo
  "demo.banner": "Version de démonstration (projet de fin d'année) : les annonces d'exemple sont fictives et vos données restent uniquement dans votre navigateur.",
  "demo.learnMore": "En savoir plus",
  "demo.chip": "Exemple",
  "demo.chipTitle": "Annonce d'exemple fictive, générée pour la démonstration",
  "demo.member": "Membre de démonstration",

  // Thème
  "theme.toDark": "Activer le mode sombre",
  "theme.toLight": "Activer le mode clair",
  "theme.system": "Automatique",
  "theme.light": "Clair",
  "theme.dark": "Sombre",
  "toast.langChanged": "Langue modifiée.",

  // Types, paiements, unités
  "type.offer": "Je propose",
  "type.request": "Je cherche",
  "type.donation": "Je donne",
  "pay.free": "Gratuit",
  "pay.paid": "Rémunéré",
  "pay.negotiable": "À discuter",
  "unit.total": "Montant total",
  "unit.hour": "Par heure",
  "unit.visit": "Par intervention",
  "unit.perHour": " / h",
  "unit.perVisit": " / fois",
  "duration.30": "30 minutes", "duration.60": "1 heure", "duration.90": "1 h 30", "duration.120": "2 heures",
  "duration.180": "3 heures", "duration.240": "Une demi-journée", "duration.480": "Une journée",
  "duration.half": "Une demi-journée", "duration.day": "Une journée",
  "recurrence.once": "Une seule fois", "recurrence.weekly": "Chaque semaine", "recurrence.monthly": "Chaque mois",
  "status.active": "Active", "status.done": "Terminée", "status.hidden": "Masquée",

  // Recherche
  "search.what": "Que cherchez-vous ?",
  "search.whatPh": "Courses, promenade de chien, bricolage…",
  "search.wherePh": "NPA ou localité",
  "search.submit": "Rechercher",
  "search.nearMe": "Autour de moi",
  "loc.placeholder": "NPA ou localité",
  "loc.myPosition": "ma position",
  "loc.found": "Position trouvée. Les annonces sont triées par distance.",
  "loc.denied": "Impossible d'obtenir votre position. Indiquez plutôt une localité.",
  "loc.unsupported": "La géolocalisation n'est pas disponible sur cet appareil.",
  "loc.outside": "Vous semblez être hors de Suisse : indiquez plutôt une localité.",

  // Accueil
  "home.eyebrow": "L'entraide locale, partout en Suisse",
  "home.title1": "S'entraider.",
  "home.title2": "Simplement.",
  "home.title3": "Humainement.",
  "home.lead": "Trouvez un voisin pour vous donner un coup de main, proposez vos compétences ou donnez une seconde vie à vos objets. Gratuit, sans publicité et respectueux de votre vie privée.",
  "home.statsLabel": "Voisina en chiffres",
  "home.statListings": "annonces actives",
  "home.statCantons": "cantons couverts",
  "home.statLangs": "langues nationales + anglais",
  "home.statTrackers": "publicité ni traceur",
  "home.catKicker": "Catégories",
  "home.catTitle": "De quoi avez-vous besoin ?",
  "home.catCount.one": "{count} annonce",
  "home.catCount.other": "{count} annonces",
  "home.seeAll": "Tout voir",
  "home.recentKicker": "Nouveautés",
  "home.nearKicker": "Près de {place}",
  "home.recentTitle": "Les dernières annonces",
  "home.howKicker": "Comment ça marche",
  "home.howTitle": "Trois étapes pour s'entraider",
  "home.step1Title": "Publiez ou cherchez",
  "home.step1Text": "Décrivez en deux minutes ce dont vous avez besoin ou ce que vous proposez, ou parcourez les annonces près de chez vous.",
  "home.step2Title": "Échangez en confiance",
  "home.step2Text": "Discutez via la messagerie intégrée, sans partager votre numéro. Consultez le profil et les évaluations.",
  "home.step3Title": "Entraidez-vous",
  "home.step3Text": "Rencontrez-vous, rendez service et ajoutez vos rendez-vous à votre agenda en un clic.",
  "home.ctaPublish": "Publier une annonce",
  "home.ctaExplore": "Explorer les annonces",
  "home.trustKicker": "Confiance & sécurité",
  "home.trustTitle": "Votre sécurité passe avant tout",
  "home.trustText": "Voisina a été conçu dès le départ pour protéger ses membres et leurs données.",
  "home.trustCta": "Nos conseils de sécurité",
  "home.trustLocTitle": "Adresse jamais affichée",
  "home.trustLocText": "Seule la localité est visible, et la position sur la carte est floutée d'environ 1 km.",
  "home.trustPwdTitle": "Mots de passe protégés",
  "home.trustPwdText": "Ils ne sont jamais enregistrés en clair : seule une empreinte chiffrée est conservée.",
  "home.trustReportTitle": "Signaler et bloquer",
  "home.trustReportText": "Chaque annonce, profil et conversation peut être signalé ; chaque signalement est examiné.",
  "home.trustTrackTitle": "Zéro pistage",
  "home.trustTrackText": "Aucun cookie, aucune publicité, aucun outil de statistiques. Vos données vous appartiennent.",
  "home.faqKicker": "Questions fréquentes",
  "home.faqTitle": "Vous vous demandez…",
  "home.faqText": "Les réponses aux questions qu'on nous pose le plus souvent.",
  "home.faqMore": "Toute l'aide",
  "home.ctaTitle": "Un coup de main change une journée.",
  "home.ctaText": "Publiez votre première annonce en moins de deux minutes.",

  "faq.cost.q": "Voisina est-il vraiment gratuit ?",
  "faq.cost.a": "Oui. Publier, rechercher et discuter est gratuit. Voisina ne prélève aucune commission et n'affiche aucune publicité.",
  "faq.safety.q": "Comment savoir si je peux faire confiance à quelqu'un ?",
  "faq.safety.a": "Consultez son profil (ancienneté, évaluations, badge vérifié), échangez d'abord par la messagerie et donnez-vous rendez-vous dans un lieu public la première fois.",
  "faq.payment.q": "Comment se passe le paiement d'un service ?",
  "faq.payment.a": "Le montant est convenu directement entre vous, puis réglé en main propre ou par TWINT après le service. Ne payez jamais à l'avance.",
  "faq.location.q": "Mon adresse est-elle visible ?",
  "faq.location.a": "Non. Seule votre localité apparaît et la position sur la carte est volontairement approximative.",
  "faq.languages.q": "Dans quelles langues puis-je utiliser Voisina ?",
  "faq.languages.a": "En français, allemand, italien et anglais. Changez de langue à tout moment via le bouton en haut de la page.",
  "faq.data.q": "Que faites-vous de mes données ?",
  "faq.data.a": "Rien d'autre que faire fonctionner le service. Vous pouvez les exporter ou les supprimer à tout moment depuis votre compte.",

  // Explorer
  "explore.title": "Explorer les annonces",
  "explore.results.one": "annonce",
  "explore.results.other": "annonces",
  "explore.view": "Affichage",
  "explore.list": "Liste",
  "explore.map": "Carte",
  "explore.mapLabel": "Carte des annonces",
  "explore.searchArea": "Rechercher dans cette zone",
  "explore.mapPrivacy": "Positions approximatives pour protéger la vie privée.",
  "explore.emptyTitle": "Aucune annonce ne correspond",
  "explore.emptyText": "Essayez d'élargir la zone ou de retirer un filtre. Vous pouvez aussi publier votre propre demande !",
  "explore.emptyPublish": "Publier une demande",
  "filter.title": "Filtres",
  "filter.type": "Type d'annonce",
  "filter.all": "Tout",
  "filter.category": "Catégorie",
  "filter.allCategories": "Toutes les catégories",
  "filter.canton": "Canton",
  "filter.allCantons": "Tous les cantons",
  "filter.payment": "Rémunération",
  "filter.anyPayment": "Gratuit ou rémunéré",
  "filter.radius": "Distance",
  "filter.anyDistance": "Toute distance",
  "filter.distanceNeedsPlace": "Distance : indiquez d'abord un lieu",
  "filter.within": "Dans un rayon de {km} km",
  "filter.urgent": "Urgent",
  "filter.verified": "Profils vérifiés",
  "filter.around": "Autour de {place}",
  "filter.mapArea": "Zone de la carte",
  "filter.reset": "Réinitialiser les filtres",
  "sort.label": "Trier par",
  "sort.recent": "Plus récentes",
  "sort.distance": "Plus proches",
  "sort.soon": "Date la plus proche",
  "sort.priceLow": "Prix croissant",
  "sort.priceHigh": "Prix décroissant",
  "map.unavailable": "La carte n'a pas pu être chargée. Les annonces restent disponibles dans la liste.",
  "map.clusterTitle": "{count} annonces dans ce secteur",

  // Favoris
  "fav.add": "Ajouter aux favoris",
  "fav.remove": "Retirer des favoris",
  "fav.save": "Enregistrer",
  "fav.saved": "Enregistrée",
  "fav.added": "Ajoutée à vos favoris.",
  "fav.removed": "Retirée de vos favoris.",

  // Annonce
  "listing.urgent": "Urgent",
  "listing.flexibleDate": "Date flexible",
  "listing.published": "publiée {when}",
  "listing.date": "Date",
  "listing.time": "Horaire",
  "listing.recurrence": "Fréquence",
  "listing.payment": "Rémunération",
  "listing.languages": "Langues parlées",
  "listing.description": "Description",
  "listing.where": "Où ?",
  "listing.mapLabel": "Zone approximative de l'annonce",
  "listing.approxLocation": "Zone approximative (± 1 km). L'adresse exacte est communiquée uniquement par message, si vous le souhaitez.",
  "listing.contact": "Contacter",
  "listing.share": "Partager",
  "listing.addToCalendar": "Ajouter à mon agenda",
  "listing.totalHint": "Montant indicatif, à confirmer ensemble.",
  "listing.edit": "Modifier",
  "listing.markDone": "Marquer comme terminée",
  "listing.markedDone": "Annonce marquée comme terminée. Merci pour votre entraide !",
  "listing.reactivate": "Réactiver",
  "listing.reactivated": "Annonce réactivée.",
  "listing.delete": "Supprimer",
  "listing.deleteTitle": "Supprimer cette annonce ?",
  "listing.deleteText": "Cette action est définitive. Les conversations liées resteront accessibles.",
  "listing.deleted": "Annonce supprimée.",
  "listing.similar": "Annonces similaires à proximité",
  "listing.notFoundTitle": "Annonce introuvable",
  "listing.notFoundText": "Cette annonce a peut-être été supprimée ou n'est plus disponible.",
  "listing.backToExplore": "Voir les annonces",
  "listing.hiddenNotice": "Cette annonce est masquée par la modération et n'est plus visible publiquement.",
  "listing.doneNotice": "Cette entraide est terminée.",
  "listing.writtenIn": "Rédigée en {lang}",
  "listing.translate": "Traduire avec DeepL",
  "listing.photoN": "Photo {n}",

  // Confiance
  "trust.verified": "Profil vérifié",
  "trust.notVerified": "Non vérifié",
  "trust.rating": "Évaluation",
  "trust.ratingOutOf": "{rating} sur 5",
  "trust.reviews": "Avis",
  "trust.completed": "Entraides",
  "trust.memberSince": "Membre depuis",
  "trust.newMember": "Nouveau",
  "trust.viewProfile": "Voir le profil",

  // Sécurité
  "safety.boxTitle": "Pour un échange serein",
  "safety.tip1": "Échangez via la messagerie Voisina avant de partager vos coordonnées.",
  "safety.tip2": "Ne payez jamais à l'avance et ne communiquez aucun code (TWINT, e-banking, SMS).",
  "safety.tip3": "Pour une première rencontre, choisissez un lieu public.",
  "safety.more": "Tous nos conseils",
  "safety.sensitive.contact": "Votre texte semble contenir un numéro ou une adresse e-mail. Pour votre sécurité, évitez de les publier : les membres vous contacteront via la messagerie.",
  "safety.sensitive.contactChat": "Vous partagez vos coordonnées : faites-le seulement si vous faites confiance à cette personne.",
  "safety.sensitive.iban": "Ne partagez jamais vos coordonnées bancaires sur Voisina.",
  "safety.sensitive.scam": "Attention : ne communiquez jamais de mot de passe, code SMS ou carte cadeau. C'est souvent le signe d'une arnaque.",

  // Signalement / blocage
  "report.title": "Signaler un problème",
  "report.intro": "Merci de nous aider à garder Voisina sûr. Votre signalement est confidentiel.",
  "report.reason": "Motif",
  "report.reason.scam": "Arnaque ou tentative de fraude",
  "report.reason.inappropriate": "Contenu inapproprié ou offensant",
  "report.reason.dangerous": "Situation dangereuse",
  "report.reason.spam": "Publicité ou spam",
  "report.reason.illegal": "Activité illégale",
  "report.reason.other": "Autre",
  "report.details": "Précisions (facultatif)",
  "report.detailsPh": "Décrivez brièvement ce qui pose problème…",
  "report.emergency": "En cas de danger immédiat, appelez la police au 117.",
  "report.send": "Envoyer le signalement",
  "report.thanks": "Merci, votre signalement a été transmis à la modération.",
  "report.listing": "Signaler l'annonce",
  "report.user": "Signaler",
  "report.conversation": "Signaler la conversation",
  "block.user": "Bloquer",
  "block.unblock": "Débloquer",
  "block.confirmTitle": "Bloquer {name} ?",
  "block.confirmText": "Vous ne verrez plus ses annonces ni ses messages. Cette personne n'est pas prévenue. Vous pourrez la débloquer depuis son profil.",
  "block.confirm": "Bloquer",
  "block.done": "Membre bloqué.",
  "block.undone": "Membre débloqué.",

  // Partage / agenda
  "share.copied": "Lien copié dans le presse-papiers.",
  "share.title": "Partager ce lien",
  "calendar.icsDone": "Fichier agenda téléchargé : ouvrez-le pour l'ajouter à votre calendrier.",

  // Publier
  "publish.kicker": "Nouvelle annonce",
  "publish.editKicker": "Modification",
  "publish.title": "Publier une annonce",
  "publish.editTitle": "Modifier mon annonce",
  "publish.lead": "Quelques informations suffisent. Vous pourrez modifier votre annonce à tout moment.",
  "publish.gateTitle": "Connectez-vous pour publier",
  "publish.gateText": "Un compte gratuit permet aux membres de vous contacter en toute sécurité. Cela prend moins d'une minute.",
  "publish.cannotEdit": "Vous ne pouvez pas modifier cette annonce.",
  "publish.draftRestored": "Nous avons retrouvé votre brouillon.",
  "publish.clearDraft": "Recommencer à zéro",
  "publish.sType": "Type d'annonce",
  "publish.type.offer": "Je peux aider quelqu'un",
  "publish.type.request": "J'ai besoin d'aide",
  "publish.type.donation": "Je donne un objet",
  "publish.sDetails": "Votre annonce",
  "publish.fTitle": "Titre",
  "publish.fTitlePh": "Ex. Je peux faire vos courses le samedi",
  "publish.fCategory": "Catégorie",
  "publish.chooseCategory": "Choisir une catégorie",
  "publish.fDescription": "Description",
  "publish.fDescriptionPh": "Expliquez votre besoin ou ce que vous proposez, vos disponibilités, ce qu'il faut prévoir…",
  "publish.fDescriptionHint": "Au moins 20 caractères. Ne mettez pas votre numéro ni votre adresse.",
  "publish.sWhere": "Lieu",
  "publish.fCity": "Localité",
  "publish.privacyHint": "Seule la localité est affichée. La position sur la carte est floutée d'environ 1 km.",
  "publish.sWhen": "Quand ?",
  "publish.fDate": "Date",
  "publish.fDateHint": "Laissez vide si c'est flexible.",
  "publish.fTime": "Heure",
  "publish.fDuration": "Durée estimée",
  "publish.fRecurrence": "Fréquence",
  "publish.fUrgent": "C'est urgent",
  "publish.sPayment": "Rémunération",
  "publish.pay.free": "Entraide gratuite",
  "publish.pay.paid": "Je propose ou demande un montant",
  "publish.pay.negotiable": "On en parle ensemble",
  "publish.fAmount": "Montant",
  "publish.fUnit": "Unité",
  "publish.payHint": "Voisina n'encaisse rien : le montant est indicatif et réglé directement entre vous, après le service.",
  "publish.sExtras": "Photos et langues",
  "publish.fPhotos": "Photos (facultatif, 3 maximum)",
  "publish.addPhoto": "Ajouter",
  "publish.removePhoto": "Retirer la photo",
  "publish.photoHint": "Les photos sont redimensionnées et leurs métadonnées (dont la position GPS) sont supprimées automatiquement.",
  "publish.photoTooLarge": "Photo trop lourde (8 Mo maximum).",
  "publish.photoBadType": "Format non pris en charge. Utilisez une image JPG, PNG ou WebP.",
  "publish.fLanguages": "Langues que vous parlez",
  "publish.sConfirm": "Confirmation",
  "publish.cRules": "Je respecte les",
  "publish.cRulesLink": "règles de la communauté",
  "publish.cHonest": "Mon annonce est honnête et ne concerne aucune activité illégale ou dangereuse.",
  "publish.submit": "Publier l'annonce",
  "publish.save": "Enregistrer les modifications",
  "publish.published": "Votre annonce est en ligne !",
  "publish.saved": "Modifications enregistrées.",
  "publish.preview": "Aperçu",
  "publish.previewTitle": "Titre de votre annonce",
  "publish.previewCity": "Votre localité",
  "publish.tipsTitle": "Conseils pour une annonce réussie",
  "publish.tip1": "Un titre court et concret attire plus de réponses.",
  "publish.tip2": "Indiquez vos disponibilités et ce qu'il faut prévoir.",
  "publish.tip3": "Une photo aide beaucoup pour les dons d'objets.",

  // Erreurs
  "err.required": "Ce champ est obligatoire.",
  "err.email": "Adresse e-mail invalide.",
  "err.taken": "Cette adresse e-mail est déjà utilisée.",
  "err.weak": "Mot de passe trop faible (voir les conseils ci-dessous).",
  "err.mismatch": "Les mots de passe ne correspondent pas.",
  "err.min5": "Au moins 5 caractères.",
  "err.min20": "Au moins 20 caractères.",
  "err.location": "Choisissez une localité suisse dans la liste.",
  "err.amount": "Indiquez un montant entre 1 et 5000 CHF.",
  "err.date": "Choisissez une date à venir (dans l'année).",
  "err.time": "Heure invalide.",
  "err.confirm": "Merci de cocher les deux confirmations.",
  "err.quota": "Espace de stockage du navigateur plein. Retirez des photos et réessayez.",
  "err.auth": "Vous devez être connecté·e.",
  "err.forbidden": "Action non autorisée.",
  "err.formHasErrors": "Certains champs sont à corriger.",
  "err.fillAll": "Merci de remplir tous les champs.",
  "err.wrongPassword": "Mot de passe incorrect.",
  "err.generic": "Une erreur est survenue. Réessayez.",
  "err.pageTitle": "Oups, un problème est survenu",
  "err.pageText": "Cette page n'a pas pu s'afficher. Rechargez la page ou revenez à l'accueil.",

  // Messagerie
  "messages.title": "Messages",
  "messages.conversations": "Conversations",
  "messages.gateTitle": "Connectez-vous pour discuter",
  "messages.gateText": "La messagerie permet d'échanger avec les membres sans partager votre numéro.",
  "messages.emptyTitle": "Aucune conversation",
  "messages.emptyText": "Contactez l'auteur d'une annonce pour démarrer une discussion.",
  "messages.findListing": "Trouver une annonce",
  "messages.selectConv": "Sélectionnez une conversation.",
  "messages.placeholder": "Écrire un message…",
  "messages.send": "Envoyer",
  "messages.you": "Vous :",
  "messages.noMessagesYet": "Pas encore de message",
  "messages.listingGone": "Annonce supprimée",
  "messages.unread.one": "{count} message non lu",
  "messages.unread.other": "{count} messages non lus",
  "messages.typing": "{name} est en train d'écrire",
  "messages.safetyBanner": "Restez sur Voisina pour échanger, et ne payez jamais à l'avance.",
  "messages.firstHint": "Présentez-vous et expliquez brièvement votre demande. Un message poli obtient plus souvent une réponse !",
  "messages.demoNotice": "Membre de démonstration : les réponses sont générées automatiquement.",
  "messages.delete": "Supprimer la conversation",
  "messages.deleteTitle": "Supprimer cette conversation ?",
  "messages.deleteText": "Elle disparaîtra de votre messagerie.",
  "messages.deleted": "Conversation supprimée.",

  // Planning
  "planning.kicker": "Mon planning",
  "planning.title": "Favoris et agenda",
  "planning.lead": "Retrouvez les annonces qui vous intéressent et vos rendez-vous d'entraide au même endroit.",
  "planning.exportAll": "Exporter vers mon agenda",
  "planning.calendar": "Calendrier",
  "planning.favorites": "Mes favoris",
  "planning.prevMonth": "Mois précédent",
  "planning.nextMonth": "Mois suivant",
  "planning.today": "Aujourd'hui",
  "planning.thisMonth": "Ce mois-ci",
  "planning.showMonth": "Voir tout le mois",
  "planning.noEvents": "Aucun rendez-vous prévu. Ajoutez des annonces datées à vos favoris pour les voir ici.",
  "planning.eventsCount.one": "{count} rendez-vous",
  "planning.eventsCount.other": "{count} rendez-vous",
  "planning.emptyTitle": "Pas encore de favoris",
  "planning.emptyText": "Touchez le cœur d'une annonce pour la retrouver ici et dans votre calendrier.",
  "planning.explore": "Explorer les annonces",
  "planning.clearFavs": "Tout retirer",
  "planning.clearTitle": "Retirer tous les favoris ?",
  "planning.clearText": "Votre liste de favoris et votre calendrier seront vidés.",
  "planning.cleared": "Favoris retirés.",
  "planning.guestNotice": "Vos favoris sont enregistrés sur cet appareil. Connectez-vous pour les rattacher à votre compte.",

  // Authentification
  "auth.login": "Se connecter",
  "auth.createAccount": "Créer un compte",
  "auth.welcomeBack": "Bon retour parmi nous",
  "auth.loginSub": "Connectez-vous pour publier et discuter avec les membres.",
  "auth.joinTitle": "Rejoignez Voisina",
  "auth.joinSub": "Gratuit, sans publicité, en moins d'une minute.",
  "auth.email": "Adresse e-mail",
  "auth.password": "Mot de passe",
  "auth.passwordConfirm": "Confirmer le mot de passe",
  "auth.firstname": "Prénom",
  "auth.lastname": "Nom",
  "auth.city": "Localité",
  "auth.nameHint": "Seuls votre prénom et l'initiale de votre nom sont visibles (ex. « Léa M. »).",
  "auth.terms": "J'accepte les {terms} et la {privacy}.",
  "auth.noAccount": "Pas encore de compte ?",
  "auth.haveAccount": "Déjà inscrit·e ?",
  "auth.showPassword": "Afficher le mot de passe",
  "auth.hidePassword": "Masquer le mot de passe",
  "auth.pwRules": "Au moins 10 caractères, avec des lettres, des chiffres ou des symboles. Une longue phrase facile à retenir fonctionne aussi.",
  "auth.pwGood": "Excellent mot de passe.",
  "auth.pwIssue.length": "Encore un peu : 10 caractères minimum.",
  "auth.pwIssue.common": "Ce mot de passe est trop courant ou contient votre nom.",
  "auth.pwIssue.variety": "Mélangez majuscules, minuscules, chiffres ou symboles.",
  "auth.invalid": "E-mail ou mot de passe incorrect.",
  "auth.locked": "Trop de tentatives. Pour votre sécurité, réessayez dans {seconds} secondes.",
  "auth.loggedIn": "Bonjour {name} !",
  "auth.welcome": "Bienvenue sur Voisina, {name} !",
  "auth.loggedOut": "Vous êtes déconnecté·e.",
  "auth.loginToContact": "Connectez-vous pour contacter ce membre.",
  "auth.demoTitle": "Accès de démonstration",
  "auth.demoText": "Créez librement un compte de test : il reste dans votre navigateur. Un compte administrateur existe aussi pour la présentation du projet.",
  "auth.whyTitle": "Pourquoi créer un compte ?",
  "auth.why1": "Publier des annonces et répondre aux demandes près de chez vous.",
  "auth.why2": "Discuter en toute sécurité, sans partager votre numéro.",
  "auth.why3": "Retrouver vos favoris et votre agenda d'entraide.",
  "auth.why4": "Construire votre réputation au fil des échanges.",
  "auth.securityNote": "Votre mot de passe n'est jamais enregistré : nous n'en gardons qu'une empreinte chiffrée (PBKDF2, 600 000 itérations).",

  // Compte
  "account.hello": "Bonjour {name}",
  "account.sections": "Sections du compte",
  "account.tab.profile": "Mon profil",
  "account.tab.listings": "Mes annonces",
  "account.tab.security": "Sécurité",
  "account.tab.data": "Mes données",
  "account.tab.prefs": "Préférences",
  "account.myListings": "Mes annonces",
  "account.welcomeNotice": "Votre compte est prêt ! Complétez votre profil pour inspirer confiance, puis publiez votre première annonce.",
  "account.changePhoto": "Changer la photo",
  "account.removePhoto": "Retirer la photo",
  "account.photoReady": "Photo prête : pensez à enregistrer.",
  "account.publicName": "Nom public : {name}",
  "account.bio": "Présentation",
  "account.bioPh": "Quelques mots sur vous, ce que vous aimez faire, vos disponibilités…",
  "account.specialties": "Savoir-faire",
  "account.specialtiesPh": "Ex. jardinage, informatique, cuisine",
  "account.specialtiesHint": "Séparez-les par des virgules (8 maximum).",
  "account.languages": "Langues parlées",
  "account.viewPublic": "Voir mon profil public",
  "account.saved": "Modifications enregistrées.",
  "account.noListings": "Vous n'avez pas encore publié d'annonce",
  "account.noListingsText": "Proposez votre aide ou demandez un coup de main : c'est gratuit.",
  "account.changePassword": "Changer de mot de passe",
  "account.currentPassword": "Mot de passe actuel",
  "account.newPassword": "Nouveau mot de passe",
  "account.updatePassword": "Mettre à jour",
  "account.passwordChanged": "Mot de passe modifié.",
  "account.adminPwNote": "Le mot de passe du compte administrateur de démonstration est défini dans le code (sous forme d'empreinte) et ne peut pas être modifié ici.",
  "account.howProtected": "Comment votre compte est protégé",
  "account.prot1": "Mot de passe transformé en empreinte PBKDF2 (600 000 itérations, sel unique) : personne ne peut le relire.",
  "account.prot2": "Connexion bloquée temporairement après 5 essais ratés.",
  "account.prot3": "Session automatiquement expirée après 14 jours.",
  "account.exportTitle": "Télécharger mes données",
  "account.exportText": "Conformément à la loi sur la protection des données (nLPD), vous pouvez récupérer toutes vos données dans un fichier lisible (JSON).",
  "account.exportBtn": "Télécharger (JSON)",
  "account.exported": "Vos données ont été téléchargées.",
  "account.storedTitle": "Ce que Voisina conserve",
  "account.storedProfile": "Profil",
  "account.storedListings": "Annonces",
  "account.storedFavorites": "Favoris",
  "account.storedConversations": "Conversations",
  "account.storedWhere": "Dans cette version, ces données sont stockées uniquement dans ce navigateur, sur cet appareil.",
  "account.deleteTitle": "Supprimer mon compte",
  "account.deleteText": "Votre profil, vos annonces, vos favoris et vos conversations seront définitivement supprimés.",
  "account.deleteConfirmText": "Cette action est irréversible. Saisissez votre mot de passe pour confirmer.",
  "account.deleteBtn": "Supprimer définitivement",
  "account.deleted": "Votre compte a été supprimé. Au revoir et merci !",
  "account.language": "Langue",
  "account.theme": "Apparence",
  "account.showDemoBanner": "Afficher le bandeau « version de démonstration »",

  // Profil public
  "profile.notFound": "Membre introuvable",
  "profile.team": "Équipe Voisina",
  "profile.edit": "Modifier mon profil",
  "profile.activeListings": "Annonces actives",
  "profile.about": "À propos",
  "profile.listingsBy": "Annonces de {name}",
  "profile.noListings": "Aucune annonce active pour le moment.",
  "profile.privacy": "Pour protéger la vie privée, l'e-mail, le nom complet et l'adresse ne sont jamais affichés.",

  // Admin
  "admin.kicker": "Espace réservé",
  "admin.title": "Modération & statistiques",
  "admin.lead": "Traitez les signalements et gardez un œil sur l'activité de la plateforme.",
  "admin.forbidden": "Accès réservé",
  "admin.forbiddenText": "Cette page est réservée à l'équipe de modération.",
  "admin.kpiListings": "annonces actives",
  "admin.kpiUsers": "membres inscrits",
  "admin.kpiMessages": "messages échangés",
  "admin.kpiReports": "signalements ouverts",
  "admin.reportsTitle": "Signalements à traiter",
  "admin.noReports": "Aucun signalement en attente. Tout va bien !",
  "admin.colTarget": "Élément",
  "admin.colReason": "Motif",
  "admin.colDetails": "Précisions",
  "admin.colWhen": "Date",
  "admin.colActions": "Actions",
  "admin.colName": "Nom",
  "admin.colJoined": "Inscription",
  "admin.type.listing": "Annonce",
  "admin.type.user": "Membre",
  "admin.type.conversation": "Conversation",
  "admin.status.actioned": "masqué",
  "admin.status.dismissed": "classé",
  "admin.deleted": "(supprimé)",
  "admin.conversation": "Conversation privée",
  "admin.hide": "Masquer",
  "admin.unhide": "Rétablir",
  "admin.dismiss": "Classer",
  "admin.hidden": "Annonce masquée.",
  "admin.unhidden": "Annonce rétablie.",
  "admin.dismissed": "Signalement classé.",
  "admin.history": "Historique",
  "admin.memberListings": "Annonces des membres",
  "admin.noMemberListings": "Aucune annonce publiée par des membres pour l'instant.",
  "admin.byCategory": "Annonces par catégorie",
  "admin.members": "Membres inscrits",
  "admin.noMembers": "Aucun membre inscrit sur ce navigateur pour l'instant.",
  "admin.pwNote": "Les mots de passe ne sont jamais visibles, même pour l'administration.",
  "admin.moderation": "Modération",
  "admin.reset": "Réinitialiser la démo",
  "admin.resetTitle": "Réinitialiser toutes les données ?",
  "admin.resetText": "Tous les comptes, annonces, messages et favoris créés sur ce navigateur seront effacés. Les annonces d'exemple restent.",

  // Notifications
  "notif.title": "Notifications",
  "notif.markRead": "Tout marquer comme lu",
  "notif.empty": "Aucune notification pour l'instant.",
  "notif.welcome": "Bienvenue sur Voisina ! Complétez votre profil pour inspirer confiance.",
  "notif.published": "Votre annonce « {title} » est en ligne.",
  "notif.message": "Nouveau message de {name}.",
  "notif.reportDone": "Votre signalement a été traité. Merci !",

  // Pages / pied de page
  "pages.kicker": "Informations",
  "pages.nav": "Pages d'information",
  "footer.tagline": "La plateforme suisse d'entraide entre voisins : proposer un coup de main, demander de l'aide, donner une seconde vie aux objets.",
  "footer.noTracking": "Sans pub ni traceur",
  "footer.secure": "Sécurisé dès la conception",
  "footer.explore": "Explorer",
  "footer.listings": "Toutes les annonces",
  "footer.map": "Carte",
  "footer.community": "Communauté",
  "footer.help": "Aide & FAQ",
  "footer.safety": "Conseils de sécurité",
  "footer.rules": "Règles de la communauté",
  "footer.about": "À propos",
  "footer.legal": "Légal",
  "footer.privacy": "Politique de confidentialité",
  "footer.terms": "Conditions d'utilisation",
  "footer.imprint": "Mentions légales",
  "footer.project": "Projet de fin d'année",
  "footer.madeIn": "Fait avec soin en Suisse",
  "notFound.title": "Page introuvable",
  "notFound.text": "Le lien est peut-être incorrect ou la page n'existe plus.",
  "notFound.home": "Retour à l'accueil",
};

const de = {
  "lang.fr": "Français", "lang.de": "Deutsch", "lang.it": "Italiano", "lang.en": "English",
  "meta.homeTitle": "Nachbarschaftshilfe in der Schweiz",
  "meta.exploreTitle": "Anzeigen entdecken",
  "meta.messagesTitle": "Nachrichten",
  "meta.planningTitle": "Meine Planung",
  "meta.accountTitle": "Mein Konto",
  "nav.main": "Hauptnavigation",
  "nav.home": "Start",
  "nav.explore": "Entdecken",
  "nav.planning": "Meine Planung",
  "nav.messages": "Nachrichten",
  "nav.messagesShort": "Chats",
  "nav.safety": "Sicherheit",
  "nav.publish": "Inserieren",
  "nav.login": "Anmelden",
  "nav.logout": "Abmelden",
  "nav.account": "Mein Konto",
  "nav.profile": "Profil",
  "nav.admin": "Administration",
  "nav.language": "Sprache wechseln",
  "common.cancel": "Abbrechen",
  "common.close": "Schliessen",
  "common.save": "Speichern",
  "common.back": "Zurück",
  "common.view": "Ansehen",
  "common.next": "Nächste Seite",
  "common.previous": "Vorherige Seite",
  "common.pagination": "Seitennavigation",
  "common.breadcrumb": "Brotkrümelnavigation",
  "common.flexible": "Flexibel",
  "common.formerMember": "Ehemaliges Mitglied",
  "demo.banner": "Demoversion (schulisches Abschlussprojekt): Die Beispielanzeigen sind fiktiv, und Ihre Daten bleiben ausschliesslich in Ihrem Browser.",
  "demo.learnMore": "Mehr erfahren",
  "demo.chip": "Beispiel",
  "demo.chipTitle": "Fiktive Beispielanzeige für die Demo",
  "demo.member": "Demo-Mitglied",
  "theme.toDark": "Dunklen Modus aktivieren",
  "theme.toLight": "Hellen Modus aktivieren",
  "theme.system": "Automatisch",
  "theme.light": "Hell",
  "theme.dark": "Dunkel",
  "toast.langChanged": "Sprache geändert.",
  "type.offer": "Ich biete",
  "type.request": "Ich suche",
  "type.donation": "Zu verschenken",
  "pay.free": "Kostenlos",
  "pay.paid": "Bezahlt",
  "pay.negotiable": "Nach Absprache",
  "unit.total": "Gesamtbetrag",
  "unit.hour": "Pro Stunde",
  "unit.visit": "Pro Einsatz",
  "unit.perHour": " / Std.",
  "unit.perVisit": " / Einsatz",
  "duration.30": "30 Minuten", "duration.60": "1 Stunde", "duration.90": "1½ Stunden", "duration.120": "2 Stunden",
  "duration.180": "3 Stunden", "duration.240": "Ein halber Tag", "duration.480": "Ein ganzer Tag",
  "duration.half": "Ein halber Tag", "duration.day": "Ein ganzer Tag",
  "recurrence.once": "Einmalig", "recurrence.weekly": "Jede Woche", "recurrence.monthly": "Jeden Monat",
  "status.active": "Aktiv", "status.done": "Erledigt", "status.hidden": "Ausgeblendet",
  "search.what": "Was suchen Sie?",
  "search.whatPh": "Einkaufen, Hund ausführen, Reparaturen…",
  "search.wherePh": "PLZ oder Ort",
  "search.submit": "Suchen",
  "search.nearMe": "In meiner Nähe",
  "loc.placeholder": "PLZ oder Ort",
  "loc.myPosition": "meinem Standort",
  "loc.found": "Standort gefunden. Anzeigen sind nach Distanz sortiert.",
  "loc.denied": "Standort nicht verfügbar. Geben Sie stattdessen einen Ort ein.",
  "loc.unsupported": "Standortbestimmung ist auf diesem Gerät nicht verfügbar.",
  "loc.outside": "Sie scheinen ausserhalb der Schweiz zu sein: Geben Sie bitte einen Ort ein.",
  "home.eyebrow": "Nachbarschaftshilfe in der ganzen Schweiz",
  "home.title1": "Einander helfen.",
  "home.title2": "Einfach.",
  "home.title3": "Menschlich.",
  "home.lead": "Finden Sie Nachbarinnen und Nachbarn, die Ihnen helfen, bieten Sie Ihre Fähigkeiten an oder geben Sie Gegenständen ein zweites Leben. Kostenlos, werbefrei und mit Respekt für Ihre Privatsphäre.",
  "home.statsLabel": "Voisina in Zahlen",
  "home.statListings": "aktive Anzeigen",
  "home.statCantons": "Kantone",
  "home.statLangs": "Landessprachen + Englisch",
  "home.statTrackers": "Werbung und Tracker",
  "home.catKicker": "Kategorien",
  "home.catTitle": "Wobei brauchen Sie Hilfe?",
  "home.catCount.one": "{count} Anzeige",
  "home.catCount.other": "{count} Anzeigen",
  "home.seeAll": "Alle ansehen",
  "home.recentKicker": "Neu",
  "home.nearKicker": "In der Nähe von {place}",
  "home.recentTitle": "Die neuesten Anzeigen",
  "home.howKicker": "So funktioniert's",
  "home.howTitle": "In drei Schritten zur Hilfe",
  "home.step1Title": "Inserieren oder suchen",
  "home.step1Text": "Beschreiben Sie in zwei Minuten, was Sie brauchen oder anbieten – oder stöbern Sie in Anzeigen in Ihrer Nähe.",
  "home.step2Title": "Vertrauensvoll austauschen",
  "home.step2Text": "Schreiben Sie über den integrierten Chat, ohne Ihre Nummer zu teilen. Prüfen Sie Profil und Bewertungen.",
  "home.step3Title": "Einander helfen",
  "home.step3Text": "Treffen Sie sich, helfen Sie einander und übernehmen Sie Termine mit einem Klick in Ihre Agenda.",
  "home.ctaPublish": "Anzeige erstellen",
  "home.ctaExplore": "Anzeigen entdecken",
  "home.trustKicker": "Vertrauen & Sicherheit",
  "home.trustTitle": "Ihre Sicherheit steht an erster Stelle",
  "home.trustText": "Voisina wurde von Anfang an so gebaut, dass Mitglieder und ihre Daten geschützt sind.",
  "home.trustCta": "Unsere Sicherheitstipps",
  "home.trustLocTitle": "Adresse nie sichtbar",
  "home.trustLocText": "Nur der Ort ist sichtbar, und die Position auf der Karte ist um etwa 1 km ungenau.",
  "home.trustPwdTitle": "Geschützte Passwörter",
  "home.trustPwdText": "Sie werden nie im Klartext gespeichert – nur ein verschlüsselter Fingerabdruck.",
  "home.trustReportTitle": "Melden und blockieren",
  "home.trustReportText": "Jede Anzeige, jedes Profil und jeder Chat kann gemeldet werden; jede Meldung wird geprüft.",
  "home.trustTrackTitle": "Kein Tracking",
  "home.trustTrackText": "Keine Cookies, keine Werbung, keine Statistik-Tools. Ihre Daten gehören Ihnen.",
  "home.faqKicker": "Häufige Fragen",
  "home.faqTitle": "Sie fragen sich…",
  "home.faqText": "Antworten auf die Fragen, die uns am häufigsten gestellt werden.",
  "home.faqMore": "Zur Hilfe",
  "home.ctaTitle": "Eine helfende Hand verändert einen Tag.",
  "home.ctaText": "Erstellen Sie Ihre erste Anzeige in weniger als zwei Minuten.",
  "faq.cost.q": "Ist Voisina wirklich kostenlos?",
  "faq.cost.a": "Ja. Inserieren, Suchen und Schreiben sind kostenlos. Voisina verlangt keine Kommission und zeigt keine Werbung.",
  "faq.safety.q": "Woran erkenne ich, ob ich jemandem vertrauen kann?",
  "faq.safety.a": "Schauen Sie sich das Profil an (Mitglied seit, Bewertungen, Badge «verifiziert»), schreiben Sie zuerst im Chat und treffen Sie sich beim ersten Mal an einem öffentlichen Ort.",
  "faq.payment.q": "Wie läuft die Bezahlung einer Hilfe ab?",
  "faq.payment.a": "Den Betrag vereinbaren Sie direkt miteinander und bezahlen nach der Hilfe bar oder mit TWINT. Zahlen Sie nie im Voraus.",
  "faq.location.q": "Ist meine Adresse sichtbar?",
  "faq.location.a": "Nein. Nur Ihr Ort erscheint, und die Position auf der Karte ist absichtlich ungenau.",
  "faq.languages.q": "In welchen Sprachen kann ich Voisina nutzen?",
  "faq.languages.a": "Auf Deutsch, Französisch, Italienisch und Englisch. Wechseln Sie die Sprache jederzeit oben auf der Seite.",
  "faq.data.q": "Was passiert mit meinen Daten?",
  "faq.data.a": "Nichts anderes, als den Dienst zu betreiben. Sie können sie jederzeit in Ihrem Konto exportieren oder löschen.",
  "explore.title": "Anzeigen entdecken",
  "explore.results.one": "Anzeige",
  "explore.results.other": "Anzeigen",
  "explore.view": "Ansicht",
  "explore.list": "Liste",
  "explore.map": "Karte",
  "explore.mapLabel": "Karte der Anzeigen",
  "explore.searchArea": "In diesem Gebiet suchen",
  "explore.mapPrivacy": "Ungefähre Positionen zum Schutz der Privatsphäre.",
  "explore.emptyTitle": "Keine passende Anzeige",
  "explore.emptyText": "Vergrössern Sie das Gebiet oder entfernen Sie einen Filter. Oder erstellen Sie selbst eine Anfrage!",
  "explore.emptyPublish": "Anfrage erstellen",
  "filter.title": "Filter",
  "filter.type": "Art der Anzeige",
  "filter.all": "Alle",
  "filter.category": "Kategorie",
  "filter.allCategories": "Alle Kategorien",
  "filter.canton": "Kanton",
  "filter.allCantons": "Alle Kantone",
  "filter.payment": "Vergütung",
  "filter.anyPayment": "Kostenlos oder bezahlt",
  "filter.radius": "Distanz",
  "filter.anyDistance": "Beliebige Distanz",
  "filter.distanceNeedsPlace": "Distanz: zuerst einen Ort angeben",
  "filter.within": "Im Umkreis von {km} km",
  "filter.urgent": "Dringend",
  "filter.verified": "Verifizierte Profile",
  "filter.around": "Rund um {place}",
  "filter.mapArea": "Kartenausschnitt",
  "filter.reset": "Filter zurücksetzen",
  "sort.label": "Sortieren nach",
  "sort.recent": "Neueste",
  "sort.distance": "Nächstgelegene",
  "sort.soon": "Nächstes Datum",
  "sort.priceLow": "Preis aufsteigend",
  "sort.priceHigh": "Preis absteigend",
  "map.unavailable": "Die Karte konnte nicht geladen werden. Die Anzeigen sind weiterhin in der Liste verfügbar.",
  "map.clusterTitle": "{count} Anzeigen in diesem Gebiet",
  "fav.add": "Zu Favoriten hinzufügen",
  "fav.remove": "Aus Favoriten entfernen",
  "fav.save": "Merken",
  "fav.saved": "Gemerkt",
  "fav.added": "Zu Ihren Favoriten hinzugefügt.",
  "fav.removed": "Aus Ihren Favoriten entfernt.",
  "listing.urgent": "Dringend",
  "listing.flexibleDate": "Datum flexibel",
  "listing.published": "veröffentlicht {when}",
  "listing.date": "Datum",
  "listing.time": "Zeit",
  "listing.recurrence": "Häufigkeit",
  "listing.payment": "Vergütung",
  "listing.languages": "Gesprochene Sprachen",
  "listing.description": "Beschreibung",
  "listing.where": "Wo?",
  "listing.mapLabel": "Ungefähres Gebiet der Anzeige",
  "listing.approxLocation": "Ungefähres Gebiet (± 1 km). Die genaue Adresse wird nur per Nachricht mitgeteilt, wenn Sie das möchten.",
  "listing.contact": "Kontaktieren",
  "listing.share": "Teilen",
  "listing.addToCalendar": "In meine Agenda",
  "listing.totalHint": "Richtbetrag, gemeinsam zu bestätigen.",
  "listing.edit": "Bearbeiten",
  "listing.markDone": "Als erledigt markieren",
  "listing.markedDone": "Anzeige als erledigt markiert. Danke für Ihre Hilfe!",
  "listing.reactivate": "Reaktivieren",
  "listing.reactivated": "Anzeige reaktiviert.",
  "listing.delete": "Löschen",
  "listing.deleteTitle": "Diese Anzeige löschen?",
  "listing.deleteText": "Diese Aktion ist endgültig. Zugehörige Chats bleiben erhalten.",
  "listing.deleted": "Anzeige gelöscht.",
  "listing.similar": "Ähnliche Anzeigen in der Nähe",
  "listing.notFoundTitle": "Anzeige nicht gefunden",
  "listing.notFoundText": "Diese Anzeige wurde vielleicht gelöscht oder ist nicht mehr verfügbar.",
  "listing.backToExplore": "Zu den Anzeigen",
  "listing.hiddenNotice": "Diese Anzeige wurde von der Moderation ausgeblendet und ist nicht mehr öffentlich sichtbar.",
  "listing.doneNotice": "Diese Hilfe ist erledigt.",
  "listing.writtenIn": "Verfasst auf {lang}",
  "listing.translate": "Mit DeepL übersetzen",
  "listing.photoN": "Foto {n}",
  "trust.verified": "Verifiziertes Profil",
  "trust.notVerified": "Nicht verifiziert",
  "trust.rating": "Bewertung",
  "trust.ratingOutOf": "{rating} von 5",
  "trust.reviews": "Bewertungen",
  "trust.completed": "Hilfen",
  "trust.memberSince": "Mitglied seit",
  "trust.newMember": "Neu",
  "trust.viewProfile": "Profil ansehen",
  "safety.boxTitle": "Für einen entspannten Austausch",
  "safety.tip1": "Schreiben Sie über den Voisina-Chat, bevor Sie Kontaktdaten teilen.",
  "safety.tip2": "Zahlen Sie nie im Voraus und geben Sie keine Codes weiter (TWINT, E-Banking, SMS).",
  "safety.tip3": "Treffen Sie sich beim ersten Mal an einem öffentlichen Ort.",
  "safety.more": "Alle Tipps",
  "safety.sensitive.contact": "Ihr Text scheint eine Telefonnummer oder E-Mail zu enthalten. Veröffentlichen Sie diese zu Ihrer Sicherheit besser nicht: Mitglieder kontaktieren Sie über den Chat.",
  "safety.sensitive.contactChat": "Sie teilen Ihre Kontaktdaten: Tun Sie das nur, wenn Sie dieser Person vertrauen.",
  "safety.sensitive.iban": "Teilen Sie auf Voisina nie Ihre Bankdaten.",
  "safety.sensitive.scam": "Achtung: Geben Sie nie Passwörter, SMS-Codes oder Geschenkkarten weiter. Das ist oft ein Zeichen für Betrug.",
  "report.title": "Ein Problem melden",
  "report.intro": "Danke, dass Sie helfen, Voisina sicher zu halten. Ihre Meldung ist vertraulich.",
  "report.reason": "Grund",
  "report.reason.scam": "Betrug oder Betrugsversuch",
  "report.reason.inappropriate": "Unangemessener oder beleidigender Inhalt",
  "report.reason.dangerous": "Gefährliche Situation",
  "report.reason.spam": "Werbung oder Spam",
  "report.reason.illegal": "Illegale Tätigkeit",
  "report.reason.other": "Anderes",
  "report.details": "Details (freiwillig)",
  "report.detailsPh": "Beschreiben Sie kurz das Problem…",
  "report.emergency": "Bei unmittelbarer Gefahr rufen Sie die Polizei unter 117 an.",
  "report.send": "Meldung senden",
  "report.thanks": "Danke, Ihre Meldung wurde an die Moderation weitergeleitet.",
  "report.listing": "Anzeige melden",
  "report.user": "Melden",
  "report.conversation": "Chat melden",
  "block.user": "Blockieren",
  "block.unblock": "Blockierung aufheben",
  "block.confirmTitle": "{name} blockieren?",
  "block.confirmText": "Sie sehen keine Anzeigen und Nachrichten dieser Person mehr. Sie wird nicht benachrichtigt. Sie können die Blockierung im Profil aufheben.",
  "block.confirm": "Blockieren",
  "block.done": "Mitglied blockiert.",
  "block.undone": "Blockierung aufgehoben.",
  "share.copied": "Link in die Zwischenablage kopiert.",
  "share.title": "Diesen Link teilen",
  "calendar.icsDone": "Agenda-Datei heruntergeladen: Öffnen Sie sie, um den Termin in Ihren Kalender zu übernehmen.",
  "publish.kicker": "Neue Anzeige",
  "publish.editKicker": "Bearbeitung",
  "publish.title": "Anzeige erstellen",
  "publish.editTitle": "Meine Anzeige bearbeiten",
  "publish.lead": "Ein paar Angaben genügen. Sie können Ihre Anzeige jederzeit ändern.",
  "publish.gateTitle": "Melden Sie sich an, um zu inserieren",
  "publish.gateText": "Mit einem kostenlosen Konto können Mitglieder Sie sicher kontaktieren. Das dauert weniger als eine Minute.",
  "publish.cannotEdit": "Sie können diese Anzeige nicht bearbeiten.",
  "publish.draftRestored": "Wir haben Ihren Entwurf wiederhergestellt.",
  "publish.clearDraft": "Neu beginnen",
  "publish.sType": "Art der Anzeige",
  "publish.type.offer": "Ich kann jemandem helfen",
  "publish.type.request": "Ich brauche Hilfe",
  "publish.type.donation": "Ich verschenke etwas",
  "publish.sDetails": "Ihre Anzeige",
  "publish.fTitle": "Titel",
  "publish.fTitlePh": "z. B. Ich erledige samstags Ihre Einkäufe",
  "publish.fCategory": "Kategorie",
  "publish.chooseCategory": "Kategorie wählen",
  "publish.fDescription": "Beschreibung",
  "publish.fDescriptionPh": "Beschreiben Sie, was Sie brauchen oder anbieten, wann Sie Zeit haben, was vorzubereiten ist…",
  "publish.fDescriptionHint": "Mindestens 20 Zeichen. Keine Telefonnummer oder Adresse angeben.",
  "publish.sWhere": "Ort",
  "publish.fCity": "Ort",
  "publish.privacyHint": "Nur der Ort wird angezeigt. Die Position auf der Karte ist um etwa 1 km ungenau.",
  "publish.sWhen": "Wann?",
  "publish.fDate": "Datum",
  "publish.fDateHint": "Leer lassen, wenn flexibel.",
  "publish.fTime": "Uhrzeit",
  "publish.fDuration": "Geschätzte Dauer",
  "publish.fRecurrence": "Häufigkeit",
  "publish.fUrgent": "Es ist dringend",
  "publish.sPayment": "Vergütung",
  "publish.pay.free": "Kostenlose Hilfe",
  "publish.pay.paid": "Ich biete oder verlange einen Betrag",
  "publish.pay.negotiable": "Wir sprechen darüber",
  "publish.fAmount": "Betrag",
  "publish.fUnit": "Einheit",
  "publish.payHint": "Voisina kassiert nichts: Der Betrag ist ein Richtwert und wird nach der Hilfe direkt untereinander bezahlt.",
  "publish.sExtras": "Fotos und Sprachen",
  "publish.fPhotos": "Fotos (freiwillig, maximal 3)",
  "publish.addPhoto": "Hinzufügen",
  "publish.removePhoto": "Foto entfernen",
  "publish.photoHint": "Fotos werden verkleinert und ihre Metadaten (inklusive GPS-Position) automatisch entfernt.",
  "publish.photoTooLarge": "Foto zu gross (maximal 8 MB).",
  "publish.photoBadType": "Format nicht unterstützt. Verwenden Sie JPG, PNG oder WebP.",
  "publish.fLanguages": "Sprachen, die Sie sprechen",
  "publish.sConfirm": "Bestätigung",
  "publish.cRules": "Ich halte mich an die",
  "publish.cRulesLink": "Community-Regeln",
  "publish.cHonest": "Meine Anzeige ist ehrlich und betrifft keine illegale oder gefährliche Tätigkeit.",
  "publish.submit": "Anzeige veröffentlichen",
  "publish.save": "Änderungen speichern",
  "publish.published": "Ihre Anzeige ist online!",
  "publish.saved": "Änderungen gespeichert.",
  "publish.preview": "Vorschau",
  "publish.previewTitle": "Titel Ihrer Anzeige",
  "publish.previewCity": "Ihr Ort",
  "publish.tipsTitle": "Tipps für eine gute Anzeige",
  "publish.tip1": "Ein kurzer, konkreter Titel bringt mehr Antworten.",
  "publish.tip2": "Nennen Sie Ihre Verfügbarkeit und was vorzubereiten ist.",
  "publish.tip3": "Ein Foto hilft sehr beim Verschenken von Gegenständen.",
  "err.required": "Dieses Feld ist obligatorisch.",
  "err.email": "Ungültige E-Mail-Adresse.",
  "err.taken": "Diese E-Mail-Adresse wird bereits verwendet.",
  "err.weak": "Passwort zu schwach (siehe Hinweise unten).",
  "err.mismatch": "Die Passwörter stimmen nicht überein.",
  "err.min5": "Mindestens 5 Zeichen.",
  "err.min20": "Mindestens 20 Zeichen.",
  "err.location": "Wählen Sie einen Schweizer Ort aus der Liste.",
  "err.amount": "Geben Sie einen Betrag zwischen 1 und 5000 CHF an.",
  "err.date": "Wählen Sie ein zukünftiges Datum (innerhalb eines Jahres).",
  "err.time": "Ungültige Uhrzeit.",
  "err.confirm": "Bitte beide Bestätigungen ankreuzen.",
  "err.quota": "Browserspeicher voll. Entfernen Sie Fotos und versuchen Sie es erneut.",
  "err.auth": "Sie müssen angemeldet sein.",
  "err.forbidden": "Aktion nicht erlaubt.",
  "err.formHasErrors": "Einige Felder müssen korrigiert werden.",
  "err.fillAll": "Bitte alle Felder ausfüllen.",
  "err.wrongPassword": "Falsches Passwort.",
  "err.generic": "Ein Fehler ist aufgetreten. Bitte erneut versuchen.",
  "err.pageTitle": "Hoppla, ein Problem ist aufgetreten",
  "err.pageText": "Diese Seite konnte nicht angezeigt werden. Laden Sie die Seite neu oder kehren Sie zur Startseite zurück.",
  "messages.title": "Nachrichten",
  "messages.conversations": "Chats",
  "messages.gateTitle": "Melden Sie sich an, um zu chatten",
  "messages.gateText": "Mit dem Chat tauschen Sie sich mit Mitgliedern aus, ohne Ihre Nummer zu teilen.",
  "messages.emptyTitle": "Keine Chats",
  "messages.emptyText": "Kontaktieren Sie jemanden über eine Anzeige, um einen Chat zu beginnen.",
  "messages.findListing": "Anzeige finden",
  "messages.selectConv": "Wählen Sie einen Chat aus.",
  "messages.placeholder": "Nachricht schreiben…",
  "messages.send": "Senden",
  "messages.you": "Sie:",
  "messages.noMessagesYet": "Noch keine Nachricht",
  "messages.listingGone": "Anzeige gelöscht",
  "messages.unread.one": "{count} ungelesene Nachricht",
  "messages.unread.other": "{count} ungelesene Nachrichten",
  "messages.typing": "{name} schreibt",
  "messages.safetyBanner": "Bleiben Sie für den Austausch auf Voisina und bezahlen Sie nie im Voraus.",
  "messages.firstHint": "Stellen Sie sich vor und erklären Sie kurz Ihr Anliegen. Eine freundliche Nachricht wird öfter beantwortet!",
  "messages.demoNotice": "Demo-Mitglied: Die Antworten werden automatisch erzeugt.",
  "messages.delete": "Chat löschen",
  "messages.deleteTitle": "Diesen Chat löschen?",
  "messages.deleteText": "Er verschwindet aus Ihren Nachrichten.",
  "messages.deleted": "Chat gelöscht.",
  "planning.kicker": "Meine Planung",
  "planning.title": "Favoriten und Agenda",
  "planning.lead": "Ihre gemerkten Anzeigen und Hilfstermine an einem Ort.",
  "planning.exportAll": "In meine Agenda exportieren",
  "planning.calendar": "Kalender",
  "planning.favorites": "Meine Favoriten",
  "planning.prevMonth": "Vorheriger Monat",
  "planning.nextMonth": "Nächster Monat",
  "planning.today": "Heute",
  "planning.thisMonth": "Diesen Monat",
  "planning.showMonth": "Ganzen Monat anzeigen",
  "planning.noEvents": "Keine Termine geplant. Merken Sie sich Anzeigen mit Datum, um sie hier zu sehen.",
  "planning.eventsCount.one": "{count} Termin",
  "planning.eventsCount.other": "{count} Termine",
  "planning.emptyTitle": "Noch keine Favoriten",
  "planning.emptyText": "Tippen Sie auf das Herz einer Anzeige, um sie hier und in Ihrem Kalender zu finden.",
  "planning.explore": "Anzeigen entdecken",
  "planning.clearFavs": "Alle entfernen",
  "planning.clearTitle": "Alle Favoriten entfernen?",
  "planning.clearText": "Ihre Favoritenliste und Ihr Kalender werden geleert.",
  "planning.cleared": "Favoriten entfernt.",
  "planning.guestNotice": "Ihre Favoriten sind auf diesem Gerät gespeichert. Melden Sie sich an, um sie Ihrem Konto zuzuordnen.",
  "auth.login": "Anmelden",
  "auth.createAccount": "Konto erstellen",
  "auth.welcomeBack": "Willkommen zurück",
  "auth.loginSub": "Melden Sie sich an, um zu inserieren und mit Mitgliedern zu schreiben.",
  "auth.joinTitle": "Werden Sie Teil von Voisina",
  "auth.joinSub": "Kostenlos, werbefrei, in weniger als einer Minute.",
  "auth.email": "E-Mail-Adresse",
  "auth.password": "Passwort",
  "auth.passwordConfirm": "Passwort bestätigen",
  "auth.firstname": "Vorname",
  "auth.lastname": "Nachname",
  "auth.city": "Ort",
  "auth.nameHint": "Sichtbar sind nur Ihr Vorname und die Initiale Ihres Nachnamens (z. B. «Lea M.»).",
  "auth.terms": "Ich akzeptiere die {terms} und die {privacy}.",
  "auth.noAccount": "Noch kein Konto?",
  "auth.haveAccount": "Bereits registriert?",
  "auth.showPassword": "Passwort anzeigen",
  "auth.hidePassword": "Passwort verbergen",
  "auth.pwRules": "Mindestens 10 Zeichen mit Buchstaben, Zahlen oder Symbolen. Ein langer, gut merkbarer Satz funktioniert auch.",
  "auth.pwGood": "Ausgezeichnetes Passwort.",
  "auth.pwIssue.length": "Noch etwas länger: mindestens 10 Zeichen.",
  "auth.pwIssue.common": "Dieses Passwort ist zu verbreitet oder enthält Ihren Namen.",
  "auth.pwIssue.variety": "Mischen Sie Gross- und Kleinbuchstaben, Zahlen oder Symbole.",
  "auth.invalid": "E-Mail oder Passwort falsch.",
  "auth.locked": "Zu viele Versuche. Zu Ihrer Sicherheit versuchen Sie es in {seconds} Sekunden erneut.",
  "auth.loggedIn": "Hallo {name}!",
  "auth.welcome": "Willkommen bei Voisina, {name}!",
  "auth.loggedOut": "Sie sind abgemeldet.",
  "auth.loginToContact": "Melden Sie sich an, um dieses Mitglied zu kontaktieren.",
  "auth.demoTitle": "Demo-Zugang",
  "auth.demoText": "Erstellen Sie ruhig ein Testkonto: Es bleibt in Ihrem Browser. Für die Projektpräsentation gibt es zudem ein Administratorkonto.",
  "auth.whyTitle": "Warum ein Konto erstellen?",
  "auth.why1": "Anzeigen erstellen und auf Anfragen in Ihrer Nähe antworten.",
  "auth.why2": "Sicher schreiben, ohne Ihre Nummer zu teilen.",
  "auth.why3": "Favoriten und Hilfs-Agenda immer griffbereit.",
  "auth.why4": "Mit jedem Austausch Ihren Ruf aufbauen.",
  "auth.securityNote": "Ihr Passwort wird nie gespeichert: Wir behalten nur einen verschlüsselten Fingerabdruck (PBKDF2, 600 000 Iterationen).",
  "account.hello": "Hallo {name}",
  "account.sections": "Kontobereiche",
  "account.tab.profile": "Mein Profil",
  "account.tab.listings": "Meine Anzeigen",
  "account.tab.security": "Sicherheit",
  "account.tab.data": "Meine Daten",
  "account.tab.prefs": "Einstellungen",
  "account.myListings": "Meine Anzeigen",
  "account.welcomeNotice": "Ihr Konto ist bereit! Ergänzen Sie Ihr Profil, um Vertrauen zu schaffen, und erstellen Sie dann Ihre erste Anzeige.",
  "account.changePhoto": "Foto ändern",
  "account.removePhoto": "Foto entfernen",
  "account.photoReady": "Foto bereit: Bitte speichern.",
  "account.publicName": "Öffentlicher Name: {name}",
  "account.bio": "Über mich",
  "account.bioPh": "Ein paar Worte über Sie, was Sie gerne tun, wann Sie Zeit haben…",
  "account.specialties": "Fähigkeiten",
  "account.specialtiesPh": "z. B. Gartenarbeit, Informatik, Kochen",
  "account.specialtiesHint": "Mit Kommas trennen (maximal 8).",
  "account.languages": "Gesprochene Sprachen",
  "account.viewPublic": "Mein öffentliches Profil",
  "account.saved": "Änderungen gespeichert.",
  "account.noListings": "Sie haben noch keine Anzeige erstellt",
  "account.noListingsText": "Bieten Sie Hilfe an oder bitten Sie um Unterstützung – kostenlos.",
  "account.changePassword": "Passwort ändern",
  "account.currentPassword": "Aktuelles Passwort",
  "account.newPassword": "Neues Passwort",
  "account.updatePassword": "Aktualisieren",
  "account.passwordChanged": "Passwort geändert.",
  "account.adminPwNote": "Das Passwort des Demo-Administratorkontos ist im Code (als Fingerabdruck) festgelegt und kann hier nicht geändert werden.",
  "account.howProtected": "So ist Ihr Konto geschützt",
  "account.prot1": "Passwort als PBKDF2-Fingerabdruck gespeichert (600 000 Iterationen, eigenes Salz): Niemand kann es lesen.",
  "account.prot2": "Anmeldung nach 5 Fehlversuchen vorübergehend gesperrt.",
  "account.prot3": "Sitzung läuft nach 14 Tagen automatisch ab.",
  "account.exportTitle": "Meine Daten herunterladen",
  "account.exportText": "Gemäss Datenschutzgesetz (revDSG) können Sie alle Ihre Daten in einer lesbaren Datei (JSON) herunterladen.",
  "account.exportBtn": "Herunterladen (JSON)",
  "account.exported": "Ihre Daten wurden heruntergeladen.",
  "account.storedTitle": "Was Voisina speichert",
  "account.storedProfile": "Profil",
  "account.storedListings": "Anzeigen",
  "account.storedFavorites": "Favoriten",
  "account.storedConversations": "Chats",
  "account.storedWhere": "In dieser Version werden diese Daten ausschliesslich in diesem Browser auf diesem Gerät gespeichert.",
  "account.deleteTitle": "Mein Konto löschen",
  "account.deleteText": "Ihr Profil, Ihre Anzeigen, Favoriten und Chats werden endgültig gelöscht.",
  "account.deleteConfirmText": "Diese Aktion kann nicht rückgängig gemacht werden. Geben Sie zur Bestätigung Ihr Passwort ein.",
  "account.deleteBtn": "Endgültig löschen",
  "account.deleted": "Ihr Konto wurde gelöscht. Auf Wiedersehen und danke!",
  "account.language": "Sprache",
  "account.theme": "Darstellung",
  "account.showDemoBanner": "Hinweis «Demoversion» anzeigen",
  "profile.notFound": "Mitglied nicht gefunden",
  "profile.team": "Voisina-Team",
  "profile.edit": "Profil bearbeiten",
  "profile.activeListings": "Aktive Anzeigen",
  "profile.about": "Über mich",
  "profile.listingsBy": "Anzeigen von {name}",
  "profile.noListings": "Zurzeit keine aktiven Anzeigen.",
  "profile.privacy": "Zum Schutz der Privatsphäre werden E-Mail, vollständiger Name und Adresse nie angezeigt.",
  "admin.kicker": "Geschützter Bereich",
  "admin.title": "Moderation & Statistiken",
  "admin.lead": "Bearbeiten Sie Meldungen und behalten Sie die Aktivität der Plattform im Blick.",
  "admin.forbidden": "Zugriff beschränkt",
  "admin.forbiddenText": "Diese Seite ist dem Moderationsteam vorbehalten.",
  "admin.kpiListings": "aktive Anzeigen",
  "admin.kpiUsers": "registrierte Mitglieder",
  "admin.kpiMessages": "ausgetauschte Nachrichten",
  "admin.kpiReports": "offene Meldungen",
  "admin.reportsTitle": "Zu bearbeitende Meldungen",
  "admin.noReports": "Keine offenen Meldungen. Alles in Ordnung!",
  "admin.colTarget": "Element",
  "admin.colReason": "Grund",
  "admin.colDetails": "Details",
  "admin.colWhen": "Datum",
  "admin.colActions": "Aktionen",
  "admin.colName": "Name",
  "admin.colJoined": "Registriert",
  "admin.type.listing": "Anzeige",
  "admin.type.user": "Mitglied",
  "admin.type.conversation": "Chat",
  "admin.status.actioned": "ausgeblendet",
  "admin.status.dismissed": "abgelegt",
  "admin.deleted": "(gelöscht)",
  "admin.conversation": "Privater Chat",
  "admin.hide": "Ausblenden",
  "admin.unhide": "Wiederherstellen",
  "admin.dismiss": "Ablegen",
  "admin.hidden": "Anzeige ausgeblendet.",
  "admin.unhidden": "Anzeige wiederhergestellt.",
  "admin.dismissed": "Meldung abgelegt.",
  "admin.history": "Verlauf",
  "admin.memberListings": "Anzeigen der Mitglieder",
  "admin.noMemberListings": "Noch keine Anzeigen von Mitgliedern.",
  "admin.byCategory": "Anzeigen nach Kategorie",
  "admin.members": "Registrierte Mitglieder",
  "admin.noMembers": "Noch keine Mitglieder auf diesem Browser registriert.",
  "admin.pwNote": "Passwörter sind nie sichtbar, auch nicht für die Administration.",
  "admin.moderation": "Moderation",
  "admin.reset": "Demo zurücksetzen",
  "admin.resetTitle": "Alle Daten zurücksetzen?",
  "admin.resetText": "Alle auf diesem Browser erstellten Konten, Anzeigen, Nachrichten und Favoriten werden gelöscht. Die Beispielanzeigen bleiben.",
  "notif.title": "Benachrichtigungen",
  "notif.markRead": "Alle als gelesen markieren",
  "notif.empty": "Noch keine Benachrichtigungen.",
  "notif.welcome": "Willkommen bei Voisina! Ergänzen Sie Ihr Profil, um Vertrauen zu schaffen.",
  "notif.published": "Ihre Anzeige «{title}» ist online.",
  "notif.message": "Neue Nachricht von {name}.",
  "notif.reportDone": "Ihre Meldung wurde bearbeitet. Danke!",
  "pages.kicker": "Informationen",
  "pages.nav": "Informationsseiten",
  "footer.tagline": "Die Schweizer Plattform für Nachbarschaftshilfe: Hilfe anbieten, um Hilfe bitten, Gegenständen ein zweites Leben geben.",
  "footer.noTracking": "Ohne Werbung und Tracker",
  "footer.secure": "Sicher von Grund auf",
  "footer.explore": "Entdecken",
  "footer.listings": "Alle Anzeigen",
  "footer.map": "Karte",
  "footer.community": "Community",
  "footer.help": "Hilfe & FAQ",
  "footer.safety": "Sicherheitstipps",
  "footer.rules": "Community-Regeln",
  "footer.about": "Über uns",
  "footer.legal": "Rechtliches",
  "footer.privacy": "Datenschutzerklärung",
  "footer.terms": "Nutzungsbedingungen",
  "footer.imprint": "Impressum",
  "footer.project": "Schulisches Abschlussprojekt",
  "footer.madeIn": "Mit Sorgfalt in der Schweiz gemacht",
  "notFound.title": "Seite nicht gefunden",
  "notFound.text": "Der Link ist vielleicht falsch oder die Seite existiert nicht mehr.",
  "notFound.home": "Zur Startseite",
};

const it = {
  "lang.fr": "Français", "lang.de": "Deutsch", "lang.it": "Italiano", "lang.en": "English",
  "meta.homeTitle": "L'aiuto tra vicini in Svizzera",
  "meta.exploreTitle": "Esplora gli annunci",
  "meta.messagesTitle": "Messaggi",
  "meta.planningTitle": "La mia agenda",
  "meta.accountTitle": "Il mio account",
  "nav.main": "Navigazione principale",
  "nav.home": "Home",
  "nav.explore": "Esplora",
  "nav.planning": "La mia agenda",
  "nav.messages": "Messaggi",
  "nav.messagesShort": "Messaggi",
  "nav.safety": "Sicurezza",
  "nav.publish": "Pubblica",
  "nav.login": "Accedi",
  "nav.logout": "Esci",
  "nav.account": "Il mio account",
  "nav.profile": "Profilo",
  "nav.admin": "Amministrazione",
  "nav.language": "Cambia lingua",
  "common.cancel": "Annulla",
  "common.close": "Chiudi",
  "common.save": "Salva",
  "common.back": "Indietro",
  "common.view": "Vedi",
  "common.next": "Pagina successiva",
  "common.previous": "Pagina precedente",
  "common.pagination": "Paginazione",
  "common.breadcrumb": "Percorso",
  "common.flexible": "Flessibile",
  "common.formerMember": "Ex membro",
  "demo.banner": "Versione dimostrativa (progetto scolastico di fine anno): gli annunci d'esempio sono fittizi e i vostri dati restano solo nel vostro browser.",
  "demo.learnMore": "Scopri di più",
  "demo.chip": "Esempio",
  "demo.chipTitle": "Annuncio d'esempio fittizio, creato per la dimostrazione",
  "demo.member": "Membro dimostrativo",
  "theme.toDark": "Attiva la modalità scura",
  "theme.toLight": "Attiva la modalità chiara",
  "theme.system": "Automatico",
  "theme.light": "Chiaro",
  "theme.dark": "Scuro",
  "toast.langChanged": "Lingua cambiata.",
  "type.offer": "Offro",
  "type.request": "Cerco",
  "type.donation": "Regalo",
  "pay.free": "Gratuito",
  "pay.paid": "Retribuito",
  "pay.negotiable": "Da concordare",
  "unit.total": "Importo totale",
  "unit.hour": "All'ora",
  "unit.visit": "Per intervento",
  "unit.perHour": " / ora",
  "unit.perVisit": " / volta",
  "duration.30": "30 minuti", "duration.60": "1 ora", "duration.90": "1 ora e mezza", "duration.120": "2 ore",
  "duration.180": "3 ore", "duration.240": "Mezza giornata", "duration.480": "Una giornata",
  "duration.half": "Mezza giornata", "duration.day": "Una giornata",
  "recurrence.once": "Una volta", "recurrence.weekly": "Ogni settimana", "recurrence.monthly": "Ogni mese",
  "status.active": "Attivo", "status.done": "Concluso", "status.hidden": "Nascosto",
  "search.what": "Cosa cercate?",
  "search.whatPh": "Spesa, passeggiata col cane, riparazioni…",
  "search.wherePh": "NPA o località",
  "search.submit": "Cerca",
  "search.nearMe": "Vicino a me",
  "loc.placeholder": "NPA o località",
  "loc.myPosition": "la mia posizione",
  "loc.found": "Posizione trovata. Gli annunci sono ordinati per distanza.",
  "loc.denied": "Impossibile ottenere la posizione. Indicate piuttosto una località.",
  "loc.unsupported": "La geolocalizzazione non è disponibile su questo dispositivo.",
  "loc.outside": "Sembra che siate fuori dalla Svizzera: indicate piuttosto una località.",
  "home.eyebrow": "L'aiuto tra vicini, in tutta la Svizzera",
  "home.title1": "Aiutarsi.",
  "home.title2": "Semplicemente.",
  "home.title3": "Umanamente.",
  "home.lead": "Trovate un vicino che vi dia una mano, offrite le vostre competenze o date una seconda vita ai vostri oggetti. Gratuito, senza pubblicità e rispettoso della vostra privacy.",
  "home.statsLabel": "Voisina in cifre",
  "home.statListings": "annunci attivi",
  "home.statCantons": "cantoni",
  "home.statLangs": "lingue nazionali + inglese",
  "home.statTrackers": "pubblicità e tracker",
  "home.catKicker": "Categorie",
  "home.catTitle": "Di cosa avete bisogno?",
  "home.catCount.one": "{count} annuncio",
  "home.catCount.other": "{count} annunci",
  "home.seeAll": "Vedi tutto",
  "home.recentKicker": "Novità",
  "home.nearKicker": "Vicino a {place}",
  "home.recentTitle": "Gli ultimi annunci",
  "home.howKicker": "Come funziona",
  "home.howTitle": "Tre passi per aiutarsi",
  "home.step1Title": "Pubblicate o cercate",
  "home.step1Text": "Descrivete in due minuti di cosa avete bisogno o cosa offrite, oppure sfogliate gli annunci vicino a voi.",
  "home.step2Title": "Scrivetevi in fiducia",
  "home.step2Text": "Parlate tramite la chat integrata, senza condividere il vostro numero. Guardate profilo e valutazioni.",
  "home.step3Title": "Aiutatevi",
  "home.step3Text": "Incontratevi, datevi una mano e aggiungete gli appuntamenti alla vostra agenda con un clic.",
  "home.ctaPublish": "Pubblica un annuncio",
  "home.ctaExplore": "Esplora gli annunci",
  "home.trustKicker": "Fiducia e sicurezza",
  "home.trustTitle": "La vostra sicurezza prima di tutto",
  "home.trustText": "Voisina è stato progettato fin dall'inizio per proteggere i membri e i loro dati.",
  "home.trustCta": "I nostri consigli di sicurezza",
  "home.trustLocTitle": "Indirizzo mai mostrato",
  "home.trustLocText": "È visibile solo la località e la posizione sulla carta è sfocata di circa 1 km.",
  "home.trustPwdTitle": "Password protette",
  "home.trustPwdText": "Non vengono mai salvate in chiaro: si conserva solo un'impronta cifrata.",
  "home.trustReportTitle": "Segnalare e bloccare",
  "home.trustReportText": "Ogni annuncio, profilo e conversazione può essere segnalato; ogni segnalazione viene esaminata.",
  "home.trustTrackTitle": "Zero tracciamento",
  "home.trustTrackText": "Nessun cookie, nessuna pubblicità, nessuno strumento statistico. I vostri dati vi appartengono.",
  "home.faqKicker": "Domande frequenti",
  "home.faqTitle": "Vi state chiedendo…",
  "home.faqText": "Le risposte alle domande che ci vengono poste più spesso.",
  "home.faqMore": "Tutto l'aiuto",
  "home.ctaTitle": "Una mano può cambiare una giornata.",
  "home.ctaText": "Pubblicate il vostro primo annuncio in meno di due minuti.",
  "faq.cost.q": "Voisina è davvero gratuito?",
  "faq.cost.a": "Sì. Pubblicare, cercare e scrivere è gratuito. Voisina non prende commissioni e non mostra pubblicità.",
  "faq.safety.q": "Come capisco se posso fidarmi di qualcuno?",
  "faq.safety.a": "Guardate il profilo (anzianità, valutazioni, badge verificato), scrivetevi prima in chat e incontratevi la prima volta in un luogo pubblico.",
  "faq.payment.q": "Come funziona il pagamento di un servizio?",
  "faq.payment.a": "L'importo si concorda direttamente tra voi e si paga di persona o con TWINT dopo il servizio. Non pagate mai in anticipo.",
  "faq.location.q": "Il mio indirizzo è visibile?",
  "faq.location.a": "No. Appare solo la località e la posizione sulla carta è volutamente approssimativa.",
  "faq.languages.q": "In quali lingue posso usare Voisina?",
  "faq.languages.a": "In italiano, francese, tedesco e inglese. Potete cambiare lingua in qualsiasi momento in alto nella pagina.",
  "faq.data.q": "Cosa fate con i miei dati?",
  "faq.data.a": "Nient'altro che far funzionare il servizio. Potete esportarli o eliminarli in qualsiasi momento dal vostro account.",
  "explore.title": "Esplora gli annunci",
  "explore.results.one": "annuncio",
  "explore.results.other": "annunci",
  "explore.view": "Visualizzazione",
  "explore.list": "Elenco",
  "explore.map": "Carta",
  "explore.mapLabel": "Carta degli annunci",
  "explore.searchArea": "Cerca in questa zona",
  "explore.mapPrivacy": "Posizioni approssimative per proteggere la privacy.",
  "explore.emptyTitle": "Nessun annuncio corrispondente",
  "explore.emptyText": "Provate ad ampliare la zona o a togliere un filtro. Potete anche pubblicare la vostra richiesta!",
  "explore.emptyPublish": "Pubblica una richiesta",
  "filter.title": "Filtri",
  "filter.type": "Tipo di annuncio",
  "filter.all": "Tutti",
  "filter.category": "Categoria",
  "filter.allCategories": "Tutte le categorie",
  "filter.canton": "Cantone",
  "filter.allCantons": "Tutti i cantoni",
  "filter.payment": "Compenso",
  "filter.anyPayment": "Gratuito o retribuito",
  "filter.radius": "Distanza",
  "filter.anyDistance": "Qualsiasi distanza",
  "filter.distanceNeedsPlace": "Distanza: indicate prima un luogo",
  "filter.within": "Entro {km} km",
  "filter.urgent": "Urgente",
  "filter.verified": "Profili verificati",
  "filter.around": "Intorno a {place}",
  "filter.mapArea": "Zona della carta",
  "filter.reset": "Reimposta i filtri",
  "sort.label": "Ordina per",
  "sort.recent": "Più recenti",
  "sort.distance": "Più vicini",
  "sort.soon": "Data più vicina",
  "sort.priceLow": "Prezzo crescente",
  "sort.priceHigh": "Prezzo decrescente",
  "map.unavailable": "Non è stato possibile caricare la carta. Gli annunci restano disponibili nell'elenco.",
  "map.clusterTitle": "{count} annunci in questa zona",
  "fav.add": "Aggiungi ai preferiti",
  "fav.remove": "Rimuovi dai preferiti",
  "fav.save": "Salva",
  "fav.saved": "Salvato",
  "fav.added": "Aggiunto ai preferiti.",
  "fav.removed": "Rimosso dai preferiti.",
  "listing.urgent": "Urgente",
  "listing.flexibleDate": "Data flessibile",
  "listing.published": "pubblicato {when}",
  "listing.date": "Data",
  "listing.time": "Orario",
  "listing.recurrence": "Frequenza",
  "listing.payment": "Compenso",
  "listing.languages": "Lingue parlate",
  "listing.description": "Descrizione",
  "listing.where": "Dove?",
  "listing.mapLabel": "Zona approssimativa dell'annuncio",
  "listing.approxLocation": "Zona approssimativa (± 1 km). L'indirizzo esatto viene comunicato solo via messaggio, se lo desiderate.",
  "listing.contact": "Contatta",
  "listing.share": "Condividi",
  "listing.addToCalendar": "Aggiungi alla mia agenda",
  "listing.totalHint": "Importo indicativo, da confermare insieme.",
  "listing.edit": "Modifica",
  "listing.markDone": "Segna come concluso",
  "listing.markedDone": "Annuncio segnato come concluso. Grazie per il vostro aiuto!",
  "listing.reactivate": "Riattiva",
  "listing.reactivated": "Annuncio riattivato.",
  "listing.delete": "Elimina",
  "listing.deleteTitle": "Eliminare questo annuncio?",
  "listing.deleteText": "L'azione è definitiva. Le conversazioni collegate resteranno accessibili.",
  "listing.deleted": "Annuncio eliminato.",
  "listing.similar": "Annunci simili nelle vicinanze",
  "listing.notFoundTitle": "Annuncio non trovato",
  "listing.notFoundText": "Forse l'annuncio è stato eliminato o non è più disponibile.",
  "listing.backToExplore": "Vedi gli annunci",
  "listing.hiddenNotice": "Questo annuncio è stato nascosto dalla moderazione e non è più visibile pubblicamente.",
  "listing.doneNotice": "Questo aiuto è concluso.",
  "listing.writtenIn": "Scritto in {lang}",
  "listing.translate": "Traduci con DeepL",
  "listing.photoN": "Foto {n}",
  "trust.verified": "Profilo verificato",
  "trust.notVerified": "Non verificato",
  "trust.rating": "Valutazione",
  "trust.ratingOutOf": "{rating} su 5",
  "trust.reviews": "Recensioni",
  "trust.completed": "Aiuti",
  "trust.memberSince": "Membro dal",
  "trust.newMember": "Nuovo",
  "trust.viewProfile": "Vedi il profilo",
  "safety.boxTitle": "Per uno scambio sereno",
  "safety.tip1": "Scrivetevi tramite la chat di Voisina prima di condividere i vostri contatti.",
  "safety.tip2": "Non pagate mai in anticipo e non comunicate alcun codice (TWINT, e-banking, SMS).",
  "safety.tip3": "Per il primo incontro scegliete un luogo pubblico.",
  "safety.more": "Tutti i consigli",
  "safety.sensitive.contact": "Il testo sembra contenere un numero o un indirizzo e-mail. Per la vostra sicurezza evitate di pubblicarli: i membri vi contatteranno tramite la chat.",
  "safety.sensitive.contactChat": "State condividendo i vostri contatti: fatelo solo se vi fidate di questa persona.",
  "safety.sensitive.iban": "Non condividete mai i vostri dati bancari su Voisina.",
  "safety.sensitive.scam": "Attenzione: non comunicate mai password, codici SMS o carte regalo. Spesso è segno di una truffa.",
  "report.title": "Segnala un problema",
  "report.intro": "Grazie per aiutarci a mantenere Voisina sicuro. La segnalazione è confidenziale.",
  "report.reason": "Motivo",
  "report.reason.scam": "Truffa o tentativo di frode",
  "report.reason.inappropriate": "Contenuto inappropriato od offensivo",
  "report.reason.dangerous": "Situazione pericolosa",
  "report.reason.spam": "Pubblicità o spam",
  "report.reason.illegal": "Attività illegale",
  "report.reason.other": "Altro",
  "report.details": "Dettagli (facoltativo)",
  "report.detailsPh": "Descrivete brevemente il problema…",
  "report.emergency": "In caso di pericolo immediato chiamate la polizia al 117.",
  "report.send": "Invia la segnalazione",
  "report.thanks": "Grazie, la segnalazione è stata trasmessa alla moderazione.",
  "report.listing": "Segnala l'annuncio",
  "report.user": "Segnala",
  "report.conversation": "Segnala la conversazione",
  "block.user": "Blocca",
  "block.unblock": "Sblocca",
  "block.confirmTitle": "Bloccare {name}?",
  "block.confirmText": "Non vedrete più i suoi annunci né i suoi messaggi. La persona non viene avvisata. Potrete sbloccarla dal suo profilo.",
  "block.confirm": "Blocca",
  "block.done": "Membro bloccato.",
  "block.undone": "Membro sbloccato.",
  "share.copied": "Link copiato negli appunti.",
  "share.title": "Condividi questo link",
  "calendar.icsDone": "File agenda scaricato: apritelo per aggiungerlo al vostro calendario.",
  "publish.kicker": "Nuovo annuncio",
  "publish.editKicker": "Modifica",
  "publish.title": "Pubblica un annuncio",
  "publish.editTitle": "Modifica il mio annuncio",
  "publish.lead": "Bastano poche informazioni. Potrete modificare l'annuncio in qualsiasi momento.",
  "publish.gateTitle": "Accedete per pubblicare",
  "publish.gateText": "Un account gratuito permette ai membri di contattarvi in tutta sicurezza. Ci vuole meno di un minuto.",
  "publish.cannotEdit": "Non potete modificare questo annuncio.",
  "publish.draftRestored": "Abbiamo ritrovato la vostra bozza.",
  "publish.clearDraft": "Ricomincia da capo",
  "publish.sType": "Tipo di annuncio",
  "publish.type.offer": "Posso aiutare qualcuno",
  "publish.type.request": "Ho bisogno di aiuto",
  "publish.type.donation": "Regalo un oggetto",
  "publish.sDetails": "Il vostro annuncio",
  "publish.fTitle": "Titolo",
  "publish.fTitlePh": "Es. Faccio la spesa per voi il sabato",
  "publish.fCategory": "Categoria",
  "publish.chooseCategory": "Scegli una categoria",
  "publish.fDescription": "Descrizione",
  "publish.fDescriptionPh": "Spiegate il vostro bisogno o cosa offrite, le vostre disponibilità, cosa prevedere…",
  "publish.fDescriptionHint": "Almeno 20 caratteri. Non indicate numero di telefono né indirizzo.",
  "publish.sWhere": "Luogo",
  "publish.fCity": "Località",
  "publish.privacyHint": "Viene mostrata solo la località. La posizione sulla carta è sfocata di circa 1 km.",
  "publish.sWhen": "Quando?",
  "publish.fDate": "Data",
  "publish.fDateHint": "Lasciate vuoto se è flessibile.",
  "publish.fTime": "Ora",
  "publish.fDuration": "Durata stimata",
  "publish.fRecurrence": "Frequenza",
  "publish.fUrgent": "È urgente",
  "publish.sPayment": "Compenso",
  "publish.pay.free": "Aiuto gratuito",
  "publish.pay.paid": "Offro o chiedo un importo",
  "publish.pay.negotiable": "Ne parliamo insieme",
  "publish.fAmount": "Importo",
  "publish.fUnit": "Unità",
  "publish.payHint": "Voisina non incassa nulla: l'importo è indicativo e si paga direttamente tra voi, dopo il servizio.",
  "publish.sExtras": "Foto e lingue",
  "publish.fPhotos": "Foto (facoltative, massimo 3)",
  "publish.addPhoto": "Aggiungi",
  "publish.removePhoto": "Rimuovi la foto",
  "publish.photoHint": "Le foto vengono ridimensionate e i loro metadati (compresa la posizione GPS) eliminati automaticamente.",
  "publish.photoTooLarge": "Foto troppo pesante (massimo 8 MB).",
  "publish.photoBadType": "Formato non supportato. Usate un'immagine JPG, PNG o WebP.",
  "publish.fLanguages": "Lingue che parlate",
  "publish.sConfirm": "Conferma",
  "publish.cRules": "Rispetto le",
  "publish.cRulesLink": "regole della comunità",
  "publish.cHonest": "Il mio annuncio è onesto e non riguarda attività illegali o pericolose.",
  "publish.submit": "Pubblica l'annuncio",
  "publish.save": "Salva le modifiche",
  "publish.published": "Il vostro annuncio è online!",
  "publish.saved": "Modifiche salvate.",
  "publish.preview": "Anteprima",
  "publish.previewTitle": "Titolo del vostro annuncio",
  "publish.previewCity": "La vostra località",
  "publish.tipsTitle": "Consigli per un buon annuncio",
  "publish.tip1": "Un titolo breve e concreto attira più risposte.",
  "publish.tip2": "Indicate le vostre disponibilità e cosa prevedere.",
  "publish.tip3": "Una foto aiuta molto per regalare oggetti.",
  "err.required": "Campo obbligatorio.",
  "err.email": "Indirizzo e-mail non valido.",
  "err.taken": "Questo indirizzo e-mail è già utilizzato.",
  "err.weak": "Password troppo debole (vedi i consigli qui sotto).",
  "err.mismatch": "Le password non corrispondono.",
  "err.min5": "Almeno 5 caratteri.",
  "err.min20": "Almeno 20 caratteri.",
  "err.location": "Scegliete una località svizzera dall'elenco.",
  "err.amount": "Indicate un importo tra 1 e 5000 CHF.",
  "err.date": "Scegliete una data futura (entro un anno).",
  "err.time": "Ora non valida.",
  "err.confirm": "Spuntate entrambe le conferme.",
  "err.quota": "Memoria del browser piena. Rimuovete delle foto e riprovate.",
  "err.auth": "Dovete aver effettuato l'accesso.",
  "err.forbidden": "Azione non consentita.",
  "err.formHasErrors": "Alcuni campi sono da correggere.",
  "err.fillAll": "Compilate tutti i campi.",
  "err.wrongPassword": "Password errata.",
  "err.generic": "Si è verificato un errore. Riprovate.",
  "err.pageTitle": "Ops, si è verificato un problema",
  "err.pageText": "Non è stato possibile visualizzare la pagina. Ricaricatela o tornate alla home.",
  "messages.title": "Messaggi",
  "messages.conversations": "Conversazioni",
  "messages.gateTitle": "Accedete per chattare",
  "messages.gateText": "La chat permette di scrivere ai membri senza condividere il vostro numero.",
  "messages.emptyTitle": "Nessuna conversazione",
  "messages.emptyText": "Contattate l'autore di un annuncio per iniziare una conversazione.",
  "messages.findListing": "Trova un annuncio",
  "messages.selectConv": "Selezionate una conversazione.",
  "messages.placeholder": "Scrivi un messaggio…",
  "messages.send": "Invia",
  "messages.you": "Voi:",
  "messages.noMessagesYet": "Ancora nessun messaggio",
  "messages.listingGone": "Annuncio eliminato",
  "messages.unread.one": "{count} messaggio non letto",
  "messages.unread.other": "{count} messaggi non letti",
  "messages.typing": "{name} sta scrivendo",
  "messages.safetyBanner": "Restate su Voisina per scrivervi e non pagate mai in anticipo.",
  "messages.firstHint": "Presentatevi e spiegate brevemente la vostra richiesta. Un messaggio cortese riceve più spesso risposta!",
  "messages.demoNotice": "Membro dimostrativo: le risposte sono generate automaticamente.",
  "messages.delete": "Elimina la conversazione",
  "messages.deleteTitle": "Eliminare questa conversazione?",
  "messages.deleteText": "Scomparirà dai vostri messaggi.",
  "messages.deleted": "Conversazione eliminata.",
  "planning.kicker": "La mia agenda",
  "planning.title": "Preferiti e agenda",
  "planning.lead": "Gli annunci che vi interessano e i vostri appuntamenti di aiuto in un unico posto.",
  "planning.exportAll": "Esporta nella mia agenda",
  "planning.calendar": "Calendario",
  "planning.favorites": "I miei preferiti",
  "planning.prevMonth": "Mese precedente",
  "planning.nextMonth": "Mese successivo",
  "planning.today": "Oggi",
  "planning.thisMonth": "Questo mese",
  "planning.showMonth": "Mostra tutto il mese",
  "planning.noEvents": "Nessun appuntamento previsto. Aggiungete ai preferiti annunci con una data per vederli qui.",
  "planning.eventsCount.one": "{count} appuntamento",
  "planning.eventsCount.other": "{count} appuntamenti",
  "planning.emptyTitle": "Ancora nessun preferito",
  "planning.emptyText": "Toccate il cuore di un annuncio per ritrovarlo qui e nel vostro calendario.",
  "planning.explore": "Esplora gli annunci",
  "planning.clearFavs": "Rimuovi tutti",
  "planning.clearTitle": "Rimuovere tutti i preferiti?",
  "planning.clearText": "L'elenco dei preferiti e il calendario verranno svuotati.",
  "planning.cleared": "Preferiti rimossi.",
  "planning.guestNotice": "I preferiti sono salvati su questo dispositivo. Accedete per collegarli al vostro account.",
  "auth.login": "Accedi",
  "auth.createAccount": "Crea un account",
  "auth.welcomeBack": "Bentornati",
  "auth.loginSub": "Accedete per pubblicare e scrivere ai membri.",
  "auth.joinTitle": "Unitevi a Voisina",
  "auth.joinSub": "Gratuito, senza pubblicità, in meno di un minuto.",
  "auth.email": "Indirizzo e-mail",
  "auth.password": "Password",
  "auth.passwordConfirm": "Conferma la password",
  "auth.firstname": "Nome",
  "auth.lastname": "Cognome",
  "auth.city": "Località",
  "auth.nameHint": "Sono visibili solo il nome e l'iniziale del cognome (es. «Giulia R.»).",
  "auth.terms": "Accetto le {terms} e l'{privacy}.",
  "auth.noAccount": "Non avete ancora un account?",
  "auth.haveAccount": "Siete già iscritti?",
  "auth.showPassword": "Mostra la password",
  "auth.hidePassword": "Nascondi la password",
  "auth.pwRules": "Almeno 10 caratteri, con lettere, cifre o simboli. Funziona anche una lunga frase facile da ricordare.",
  "auth.pwGood": "Password eccellente.",
  "auth.pwIssue.length": "Ancora un po': minimo 10 caratteri.",
  "auth.pwIssue.common": "Questa password è troppo comune o contiene il vostro nome.",
  "auth.pwIssue.variety": "Mescolate maiuscole, minuscole, cifre o simboli.",
  "auth.invalid": "E-mail o password errata.",
  "auth.locked": "Troppi tentativi. Per la vostra sicurezza riprovate tra {seconds} secondi.",
  "auth.loggedIn": "Ciao {name}!",
  "auth.welcome": "Benvenuti su Voisina, {name}!",
  "auth.loggedOut": "Avete effettuato il logout.",
  "auth.loginToContact": "Accedete per contattare questo membro.",
  "auth.demoTitle": "Accesso dimostrativo",
  "auth.demoText": "Create pure un account di prova: resta nel vostro browser. Per la presentazione del progetto esiste anche un account amministratore.",
  "auth.whyTitle": "Perché creare un account?",
  "auth.why1": "Pubblicare annunci e rispondere alle richieste vicino a voi.",
  "auth.why2": "Scrivere in sicurezza, senza condividere il vostro numero.",
  "auth.why3": "Ritrovare i preferiti e la vostra agenda.",
  "auth.why4": "Costruire la vostra reputazione scambio dopo scambio.",
  "auth.securityNote": "La password non viene mai salvata: ne conserviamo solo un'impronta cifrata (PBKDF2, 600 000 iterazioni).",
  "account.hello": "Ciao {name}",
  "account.sections": "Sezioni dell'account",
  "account.tab.profile": "Il mio profilo",
  "account.tab.listings": "I miei annunci",
  "account.tab.security": "Sicurezza",
  "account.tab.data": "I miei dati",
  "account.tab.prefs": "Preferenze",
  "account.myListings": "I miei annunci",
  "account.welcomeNotice": "Il vostro account è pronto! Completate il profilo per ispirare fiducia, poi pubblicate il vostro primo annuncio.",
  "account.changePhoto": "Cambia la foto",
  "account.removePhoto": "Rimuovi la foto",
  "account.photoReady": "Foto pronta: ricordatevi di salvare.",
  "account.publicName": "Nome pubblico: {name}",
  "account.bio": "Presentazione",
  "account.bioPh": "Qualche parola su di voi, cosa vi piace fare, le vostre disponibilità…",
  "account.specialties": "Competenze",
  "account.specialtiesPh": "Es. giardinaggio, informatica, cucina",
  "account.specialtiesHint": "Separatele con virgole (massimo 8).",
  "account.languages": "Lingue parlate",
  "account.viewPublic": "Vedi il mio profilo pubblico",
  "account.saved": "Modifiche salvate.",
  "account.noListings": "Non avete ancora pubblicato annunci",
  "account.noListingsText": "Offrite il vostro aiuto o chiedete una mano: è gratuito.",
  "account.changePassword": "Cambia la password",
  "account.currentPassword": "Password attuale",
  "account.newPassword": "Nuova password",
  "account.updatePassword": "Aggiorna",
  "account.passwordChanged": "Password modificata.",
  "account.adminPwNote": "La password dell'account amministratore dimostrativo è definita nel codice (come impronta) e non può essere modificata qui.",
  "account.howProtected": "Come è protetto il vostro account",
  "account.prot1": "Password trasformata in impronta PBKDF2 (600 000 iterazioni, sale unico): nessuno può leggerla.",
  "account.prot2": "Accesso bloccato temporaneamente dopo 5 tentativi falliti.",
  "account.prot3": "Sessione scaduta automaticamente dopo 14 giorni.",
  "account.exportTitle": "Scarica i miei dati",
  "account.exportText": "In base alla legge sulla protezione dei dati (nLPD) potete scaricare tutti i vostri dati in un file leggibile (JSON).",
  "account.exportBtn": "Scarica (JSON)",
  "account.exported": "I vostri dati sono stati scaricati.",
  "account.storedTitle": "Cosa conserva Voisina",
  "account.storedProfile": "Profilo",
  "account.storedListings": "Annunci",
  "account.storedFavorites": "Preferiti",
  "account.storedConversations": "Conversazioni",
  "account.storedWhere": "In questa versione questi dati sono salvati solo in questo browser, su questo dispositivo.",
  "account.deleteTitle": "Elimina il mio account",
  "account.deleteText": "Profilo, annunci, preferiti e conversazioni verranno eliminati definitivamente.",
  "account.deleteConfirmText": "L'azione è irreversibile. Inserite la password per confermare.",
  "account.deleteBtn": "Elimina definitivamente",
  "account.deleted": "Il vostro account è stato eliminato. Arrivederci e grazie!",
  "account.language": "Lingua",
  "account.theme": "Aspetto",
  "account.showDemoBanner": "Mostra l'avviso «versione dimostrativa»",
  "profile.notFound": "Membro non trovato",
  "profile.team": "Team Voisina",
  "profile.edit": "Modifica il mio profilo",
  "profile.activeListings": "Annunci attivi",
  "profile.about": "Chi sono",
  "profile.listingsBy": "Annunci di {name}",
  "profile.noListings": "Nessun annuncio attivo per il momento.",
  "profile.privacy": "Per proteggere la privacy, e-mail, nome completo e indirizzo non vengono mai mostrati.",
  "admin.kicker": "Area riservata",
  "admin.title": "Moderazione e statistiche",
  "admin.lead": "Gestite le segnalazioni e tenete d'occhio l'attività della piattaforma.",
  "admin.forbidden": "Accesso riservato",
  "admin.forbiddenText": "Questa pagina è riservata al team di moderazione.",
  "admin.kpiListings": "annunci attivi",
  "admin.kpiUsers": "membri iscritti",
  "admin.kpiMessages": "messaggi scambiati",
  "admin.kpiReports": "segnalazioni aperte",
  "admin.reportsTitle": "Segnalazioni da gestire",
  "admin.noReports": "Nessuna segnalazione in sospeso. Tutto bene!",
  "admin.colTarget": "Elemento",
  "admin.colReason": "Motivo",
  "admin.colDetails": "Dettagli",
  "admin.colWhen": "Data",
  "admin.colActions": "Azioni",
  "admin.colName": "Nome",
  "admin.colJoined": "Iscrizione",
  "admin.type.listing": "Annuncio",
  "admin.type.user": "Membro",
  "admin.type.conversation": "Conversazione",
  "admin.status.actioned": "nascosto",
  "admin.status.dismissed": "archiviato",
  "admin.deleted": "(eliminato)",
  "admin.conversation": "Conversazione privata",
  "admin.hide": "Nascondi",
  "admin.unhide": "Ripristina",
  "admin.dismiss": "Archivia",
  "admin.hidden": "Annuncio nascosto.",
  "admin.unhidden": "Annuncio ripristinato.",
  "admin.dismissed": "Segnalazione archiviata.",
  "admin.history": "Cronologia",
  "admin.memberListings": "Annunci dei membri",
  "admin.noMemberListings": "Ancora nessun annuncio pubblicato dai membri.",
  "admin.byCategory": "Annunci per categoria",
  "admin.members": "Membri iscritti",
  "admin.noMembers": "Ancora nessun membro iscritto su questo browser.",
  "admin.pwNote": "Le password non sono mai visibili, nemmeno per l'amministrazione.",
  "admin.moderation": "Moderazione",
  "admin.reset": "Reimposta la demo",
  "admin.resetTitle": "Reimpostare tutti i dati?",
  "admin.resetText": "Tutti gli account, annunci, messaggi e preferiti creati su questo browser verranno cancellati. Gli annunci d'esempio restano.",
  "notif.title": "Notifiche",
  "notif.markRead": "Segna tutto come letto",
  "notif.empty": "Ancora nessuna notifica.",
  "notif.welcome": "Benvenuti su Voisina! Completate il profilo per ispirare fiducia.",
  "notif.published": "Il vostro annuncio «{title}» è online.",
  "notif.message": "Nuovo messaggio da {name}.",
  "notif.reportDone": "La vostra segnalazione è stata gestita. Grazie!",
  "pages.kicker": "Informazioni",
  "pages.nav": "Pagine informative",
  "footer.tagline": "La piattaforma svizzera di aiuto tra vicini: offrire una mano, chiedere aiuto, dare una seconda vita agli oggetti.",
  "footer.noTracking": "Senza pubblicità né tracker",
  "footer.secure": "Sicuro fin dalla progettazione",
  "footer.explore": "Esplora",
  "footer.listings": "Tutti gli annunci",
  "footer.map": "Carta",
  "footer.community": "Comunità",
  "footer.help": "Aiuto e FAQ",
  "footer.safety": "Consigli di sicurezza",
  "footer.rules": "Regole della comunità",
  "footer.about": "Chi siamo",
  "footer.legal": "Note legali",
  "footer.privacy": "Informativa sulla privacy",
  "footer.terms": "Condizioni d'uso",
  "footer.imprint": "Note legali",
  "footer.project": "Progetto di fine anno",
  "footer.madeIn": "Fatto con cura in Svizzera",
  "notFound.title": "Pagina non trovata",
  "notFound.text": "Il link potrebbe essere errato o la pagina non esiste più.",
  "notFound.home": "Torna alla home",
};

const en = {
  "lang.fr": "Français", "lang.de": "Deutsch", "lang.it": "Italiano", "lang.en": "English",
  "meta.homeTitle": "Local mutual aid in Switzerland",
  "meta.exploreTitle": "Explore listings",
  "meta.messagesTitle": "Messages",
  "meta.planningTitle": "My planner",
  "meta.accountTitle": "My account",
  "nav.main": "Main navigation",
  "nav.home": "Home",
  "nav.explore": "Explore",
  "nav.planning": "My planner",
  "nav.messages": "Messages",
  "nav.messagesShort": "Messages",
  "nav.safety": "Safety",
  "nav.publish": "Post",
  "nav.login": "Log in",
  "nav.logout": "Log out",
  "nav.account": "My account",
  "nav.profile": "Profile",
  "nav.admin": "Admin",
  "nav.language": "Change language",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.save": "Save",
  "common.back": "Back",
  "common.view": "View",
  "common.next": "Next page",
  "common.previous": "Previous page",
  "common.pagination": "Pagination",
  "common.breadcrumb": "Breadcrumb",
  "common.flexible": "Flexible",
  "common.formerMember": "Former member",
  "demo.banner": "Demo version (end-of-year school project): sample listings are fictional and your data stays in your browser only.",
  "demo.learnMore": "Learn more",
  "demo.chip": "Sample",
  "demo.chipTitle": "Fictional sample listing generated for the demo",
  "demo.member": "Demo member",
  "theme.toDark": "Switch to dark mode",
  "theme.toLight": "Switch to light mode",
  "theme.system": "Automatic",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "toast.langChanged": "Language changed.",
  "type.offer": "Offering",
  "type.request": "Looking for",
  "type.donation": "Giving away",
  "pay.free": "Free",
  "pay.paid": "Paid",
  "pay.negotiable": "Negotiable",
  "unit.total": "Total amount",
  "unit.hour": "Per hour",
  "unit.visit": "Per visit",
  "unit.perHour": " / hr",
  "unit.perVisit": " / visit",
  "duration.30": "30 minutes", "duration.60": "1 hour", "duration.90": "1.5 hours", "duration.120": "2 hours",
  "duration.180": "3 hours", "duration.240": "Half a day", "duration.480": "A full day",
  "duration.half": "Half a day", "duration.day": "A full day",
  "recurrence.once": "One-off", "recurrence.weekly": "Every week", "recurrence.monthly": "Every month",
  "status.active": "Active", "status.done": "Done", "status.hidden": "Hidden",
  "search.what": "What are you looking for?",
  "search.whatPh": "Groceries, dog walking, DIY…",
  "search.wherePh": "Postcode or town",
  "search.submit": "Search",
  "search.nearMe": "Near me",
  "loc.placeholder": "Postcode or town",
  "loc.myPosition": "my location",
  "loc.found": "Location found. Listings are sorted by distance.",
  "loc.denied": "We couldn't get your location. Enter a town instead.",
  "loc.unsupported": "Geolocation isn't available on this device.",
  "loc.outside": "You seem to be outside Switzerland: please enter a town instead.",
  "home.eyebrow": "Local mutual aid, all across Switzerland",
  "home.title1": "Help each other.",
  "home.title2": "Simply.",
  "home.title3": "Humanly.",
  "home.lead": "Find a neighbour to lend you a hand, offer your skills or give your things a second life. Free, ad-free and respectful of your privacy.",
  "home.statsLabel": "Voisina in numbers",
  "home.statListings": "active listings",
  "home.statCantons": "cantons covered",
  "home.statLangs": "national languages + English",
  "home.statTrackers": "ads or trackers",
  "home.catKicker": "Categories",
  "home.catTitle": "What do you need help with?",
  "home.catCount.one": "{count} listing",
  "home.catCount.other": "{count} listings",
  "home.seeAll": "See all",
  "home.recentKicker": "Latest",
  "home.nearKicker": "Near {place}",
  "home.recentTitle": "Newest listings",
  "home.howKicker": "How it works",
  "home.howTitle": "Three steps to helping each other",
  "home.step1Title": "Post or search",
  "home.step1Text": "Describe what you need or offer in two minutes, or browse listings near you.",
  "home.step2Title": "Chat with confidence",
  "home.step2Text": "Talk through the built-in messaging without sharing your number. Check profiles and ratings.",
  "home.step3Title": "Help each other",
  "home.step3Text": "Meet up, lend a hand and add appointments to your calendar in one click.",
  "home.ctaPublish": "Post a listing",
  "home.ctaExplore": "Explore listings",
  "home.trustKicker": "Trust & safety",
  "home.trustTitle": "Your safety comes first",
  "home.trustText": "Voisina was designed from day one to protect its members and their data.",
  "home.trustCta": "Our safety tips",
  "home.trustLocTitle": "Address never shown",
  "home.trustLocText": "Only the town is visible, and the map position is blurred by about 1 km.",
  "home.trustPwdTitle": "Protected passwords",
  "home.trustPwdText": "Never stored in plain text: only an encrypted fingerprint is kept.",
  "home.trustReportTitle": "Report and block",
  "home.trustReportText": "Every listing, profile and conversation can be reported; every report is reviewed.",
  "home.trustTrackTitle": "Zero tracking",
  "home.trustTrackText": "No cookies, no ads, no analytics. Your data belongs to you.",
  "home.faqKicker": "FAQ",
  "home.faqTitle": "You might be wondering…",
  "home.faqText": "Answers to the questions we're asked most often.",
  "home.faqMore": "All help topics",
  "home.ctaTitle": "A helping hand can change a day.",
  "home.ctaText": "Post your first listing in under two minutes.",
  "faq.cost.q": "Is Voisina really free?",
  "faq.cost.a": "Yes. Posting, searching and messaging are free. Voisina takes no commission and shows no ads.",
  "faq.safety.q": "How do I know I can trust someone?",
  "faq.safety.a": "Check their profile (member since, ratings, verified badge), chat through the messaging first and meet somewhere public the first time.",
  "faq.payment.q": "How does payment for help work?",
  "faq.payment.a": "You agree on the amount directly, then pay in person or with TWINT after the help. Never pay in advance.",
  "faq.location.q": "Is my address visible?",
  "faq.location.a": "No. Only your town appears, and the map position is deliberately approximate.",
  "faq.languages.q": "Which languages can I use Voisina in?",
  "faq.languages.a": "French, German, Italian and English. Switch language at any time from the top of the page.",
  "faq.data.q": "What do you do with my data?",
  "faq.data.a": "Nothing except running the service. You can export or delete it at any time from your account.",
  "explore.title": "Explore listings",
  "explore.results.one": "listing",
  "explore.results.other": "listings",
  "explore.view": "View",
  "explore.list": "List",
  "explore.map": "Map",
  "explore.mapLabel": "Listings map",
  "explore.searchArea": "Search this area",
  "explore.mapPrivacy": "Approximate positions to protect privacy.",
  "explore.emptyTitle": "No matching listings",
  "explore.emptyText": "Try widening the area or removing a filter. You can also post your own request!",
  "explore.emptyPublish": "Post a request",
  "filter.title": "Filters",
  "filter.type": "Listing type",
  "filter.all": "All",
  "filter.category": "Category",
  "filter.allCategories": "All categories",
  "filter.canton": "Canton",
  "filter.allCantons": "All cantons",
  "filter.payment": "Payment",
  "filter.anyPayment": "Free or paid",
  "filter.radius": "Distance",
  "filter.anyDistance": "Any distance",
  "filter.distanceNeedsPlace": "Distance: choose a place first",
  "filter.within": "Within {km} km",
  "filter.urgent": "Urgent",
  "filter.verified": "Verified profiles",
  "filter.around": "Around {place}",
  "filter.mapArea": "Map area",
  "filter.reset": "Reset filters",
  "sort.label": "Sort by",
  "sort.recent": "Newest",
  "sort.distance": "Closest",
  "sort.soon": "Soonest date",
  "sort.priceLow": "Price: low to high",
  "sort.priceHigh": "Price: high to low",
  "map.unavailable": "The map couldn't be loaded. Listings are still available in the list.",
  "map.clusterTitle": "{count} listings in this area",
  "fav.add": "Add to favourites",
  "fav.remove": "Remove from favourites",
  "fav.save": "Save",
  "fav.saved": "Saved",
  "fav.added": "Added to your favourites.",
  "fav.removed": "Removed from your favourites.",
  "listing.urgent": "Urgent",
  "listing.flexibleDate": "Flexible date",
  "listing.published": "posted {when}",
  "listing.date": "Date",
  "listing.time": "Time",
  "listing.recurrence": "Frequency",
  "listing.payment": "Payment",
  "listing.languages": "Languages spoken",
  "listing.description": "Description",
  "listing.where": "Where?",
  "listing.mapLabel": "Approximate area of the listing",
  "listing.approxLocation": "Approximate area (± 1 km). The exact address is only shared by message, if you choose to.",
  "listing.contact": "Contact",
  "listing.share": "Share",
  "listing.addToCalendar": "Add to my calendar",
  "listing.totalHint": "Indicative amount, to be confirmed together.",
  "listing.edit": "Edit",
  "listing.markDone": "Mark as done",
  "listing.markedDone": "Listing marked as done. Thanks for helping!",
  "listing.reactivate": "Reactivate",
  "listing.reactivated": "Listing reactivated.",
  "listing.delete": "Delete",
  "listing.deleteTitle": "Delete this listing?",
  "listing.deleteText": "This can't be undone. Related conversations remain available.",
  "listing.deleted": "Listing deleted.",
  "listing.similar": "Similar listings nearby",
  "listing.notFoundTitle": "Listing not found",
  "listing.notFoundText": "This listing may have been deleted or is no longer available.",
  "listing.backToExplore": "Browse listings",
  "listing.hiddenNotice": "This listing has been hidden by moderation and is no longer publicly visible.",
  "listing.doneNotice": "This help has been completed.",
  "listing.writtenIn": "Written in {lang}",
  "listing.translate": "Translate with DeepL",
  "listing.photoN": "Photo {n}",
  "trust.verified": "Verified profile",
  "trust.notVerified": "Not verified",
  "trust.rating": "Rating",
  "trust.ratingOutOf": "{rating} out of 5",
  "trust.reviews": "Reviews",
  "trust.completed": "Helped",
  "trust.memberSince": "Member since",
  "trust.newMember": "New",
  "trust.viewProfile": "View profile",
  "safety.boxTitle": "For a worry-free exchange",
  "safety.tip1": "Chat through Voisina before sharing your contact details.",
  "safety.tip2": "Never pay in advance or share any code (TWINT, e-banking, SMS).",
  "safety.tip3": "Meet somewhere public the first time.",
  "safety.more": "All our tips",
  "safety.sensitive.contact": "Your text seems to contain a phone number or email address. For your safety, avoid publishing them: members will contact you through the messaging.",
  "safety.sensitive.contactChat": "You're sharing your contact details: only do so if you trust this person.",
  "safety.sensitive.iban": "Never share your bank details on Voisina.",
  "safety.sensitive.scam": "Careful: never share passwords, SMS codes or gift cards. It's often a sign of a scam.",
  "report.title": "Report a problem",
  "report.intro": "Thank you for helping keep Voisina safe. Your report is confidential.",
  "report.reason": "Reason",
  "report.reason.scam": "Scam or fraud attempt",
  "report.reason.inappropriate": "Inappropriate or offensive content",
  "report.reason.dangerous": "Dangerous situation",
  "report.reason.spam": "Advertising or spam",
  "report.reason.illegal": "Illegal activity",
  "report.reason.other": "Other",
  "report.details": "Details (optional)",
  "report.detailsPh": "Briefly describe the problem…",
  "report.emergency": "If you are in immediate danger, call the police on 117.",
  "report.send": "Send report",
  "report.thanks": "Thank you, your report has been sent to moderation.",
  "report.listing": "Report listing",
  "report.user": "Report",
  "report.conversation": "Report conversation",
  "block.user": "Block",
  "block.unblock": "Unblock",
  "block.confirmTitle": "Block {name}?",
  "block.confirmText": "You will no longer see their listings or messages. They won't be notified. You can unblock them from their profile.",
  "block.confirm": "Block",
  "block.done": "Member blocked.",
  "block.undone": "Member unblocked.",
  "share.copied": "Link copied to clipboard.",
  "share.title": "Share this link",
  "calendar.icsDone": "Calendar file downloaded: open it to add the event to your calendar.",
  "publish.kicker": "New listing",
  "publish.editKicker": "Editing",
  "publish.title": "Post a listing",
  "publish.editTitle": "Edit my listing",
  "publish.lead": "Just a few details. You can edit your listing at any time.",
  "publish.gateTitle": "Log in to post",
  "publish.gateText": "A free account lets members contact you safely. It takes less than a minute.",
  "publish.cannotEdit": "You can't edit this listing.",
  "publish.draftRestored": "We found your draft.",
  "publish.clearDraft": "Start over",
  "publish.sType": "Listing type",
  "publish.type.offer": "I can help someone",
  "publish.type.request": "I need help",
  "publish.type.donation": "I'm giving something away",
  "publish.sDetails": "Your listing",
  "publish.fTitle": "Title",
  "publish.fTitlePh": "e.g. I can do your shopping on Saturdays",
  "publish.fCategory": "Category",
  "publish.chooseCategory": "Choose a category",
  "publish.fDescription": "Description",
  "publish.fDescriptionPh": "Explain what you need or offer, when you're available, what to bring…",
  "publish.fDescriptionHint": "At least 20 characters. Don't include your phone number or address.",
  "publish.sWhere": "Location",
  "publish.fCity": "Town",
  "publish.privacyHint": "Only the town is shown. The map position is blurred by about 1 km.",
  "publish.sWhen": "When?",
  "publish.fDate": "Date",
  "publish.fDateHint": "Leave empty if flexible.",
  "publish.fTime": "Time",
  "publish.fDuration": "Estimated duration",
  "publish.fRecurrence": "Frequency",
  "publish.fUrgent": "It's urgent",
  "publish.sPayment": "Payment",
  "publish.pay.free": "Free help",
  "publish.pay.paid": "I offer or ask for an amount",
  "publish.pay.negotiable": "Let's discuss it",
  "publish.fAmount": "Amount",
  "publish.fUnit": "Unit",
  "publish.payHint": "Voisina collects nothing: the amount is indicative and paid directly between you, after the help.",
  "publish.sExtras": "Photos and languages",
  "publish.fPhotos": "Photos (optional, up to 3)",
  "publish.addPhoto": "Add",
  "publish.removePhoto": "Remove photo",
  "publish.photoHint": "Photos are resized and their metadata (including GPS location) is removed automatically.",
  "publish.photoTooLarge": "Photo too large (8 MB maximum).",
  "publish.photoBadType": "Unsupported format. Use a JPG, PNG or WebP image.",
  "publish.fLanguages": "Languages you speak",
  "publish.sConfirm": "Confirmation",
  "publish.cRules": "I follow the",
  "publish.cRulesLink": "community rules",
  "publish.cHonest": "My listing is honest and doesn't involve any illegal or dangerous activity.",
  "publish.submit": "Publish listing",
  "publish.save": "Save changes",
  "publish.published": "Your listing is live!",
  "publish.saved": "Changes saved.",
  "publish.preview": "Preview",
  "publish.previewTitle": "Your listing title",
  "publish.previewCity": "Your town",
  "publish.tipsTitle": "Tips for a great listing",
  "publish.tip1": "A short, concrete title gets more replies.",
  "publish.tip2": "Mention when you're available and what's needed.",
  "publish.tip3": "A photo really helps when giving items away.",
  "err.required": "This field is required.",
  "err.email": "Invalid email address.",
  "err.taken": "This email address is already in use.",
  "err.weak": "Password too weak (see tips below).",
  "err.mismatch": "Passwords don't match.",
  "err.min5": "At least 5 characters.",
  "err.min20": "At least 20 characters.",
  "err.location": "Choose a Swiss town from the list.",
  "err.amount": "Enter an amount between 1 and 5000 CHF.",
  "err.date": "Choose a future date (within a year).",
  "err.time": "Invalid time.",
  "err.confirm": "Please tick both confirmations.",
  "err.quota": "Browser storage is full. Remove some photos and try again.",
  "err.auth": "You need to be logged in.",
  "err.forbidden": "Action not allowed.",
  "err.formHasErrors": "Some fields need fixing.",
  "err.fillAll": "Please fill in all fields.",
  "err.wrongPassword": "Incorrect password.",
  "err.generic": "Something went wrong. Please try again.",
  "err.pageTitle": "Oops, something went wrong",
  "err.pageText": "This page couldn't be displayed. Reload the page or go back home.",
  "messages.title": "Messages",
  "messages.conversations": "Conversations",
  "messages.gateTitle": "Log in to chat",
  "messages.gateText": "Messaging lets you talk to members without sharing your number.",
  "messages.emptyTitle": "No conversations",
  "messages.emptyText": "Contact the author of a listing to start a conversation.",
  "messages.findListing": "Find a listing",
  "messages.selectConv": "Select a conversation.",
  "messages.placeholder": "Write a message…",
  "messages.send": "Send",
  "messages.you": "You:",
  "messages.noMessagesYet": "No messages yet",
  "messages.listingGone": "Listing deleted",
  "messages.unread.one": "{count} unread message",
  "messages.unread.other": "{count} unread messages",
  "messages.typing": "{name} is typing",
  "messages.safetyBanner": "Keep your conversation on Voisina and never pay in advance.",
  "messages.firstHint": "Introduce yourself and briefly explain your request. A polite message gets more replies!",
  "messages.demoNotice": "Demo member: replies are generated automatically.",
  "messages.delete": "Delete conversation",
  "messages.deleteTitle": "Delete this conversation?",
  "messages.deleteText": "It will disappear from your inbox.",
  "messages.deleted": "Conversation deleted.",
  "planning.kicker": "My planner",
  "planning.title": "Favourites and calendar",
  "planning.lead": "The listings you like and your help appointments, all in one place.",
  "planning.exportAll": "Export to my calendar",
  "planning.calendar": "Calendar",
  "planning.favorites": "My favourites",
  "planning.prevMonth": "Previous month",
  "planning.nextMonth": "Next month",
  "planning.today": "Today",
  "planning.thisMonth": "This month",
  "planning.showMonth": "Show whole month",
  "planning.noEvents": "No appointments planned. Save dated listings to see them here.",
  "planning.eventsCount.one": "{count} appointment",
  "planning.eventsCount.other": "{count} appointments",
  "planning.emptyTitle": "No favourites yet",
  "planning.emptyText": "Tap the heart on a listing to find it here and in your calendar.",
  "planning.explore": "Explore listings",
  "planning.clearFavs": "Remove all",
  "planning.clearTitle": "Remove all favourites?",
  "planning.clearText": "Your favourites list and calendar will be cleared.",
  "planning.cleared": "Favourites removed.",
  "planning.guestNotice": "Your favourites are saved on this device. Log in to link them to your account.",
  "auth.login": "Log in",
  "auth.createAccount": "Create account",
  "auth.welcomeBack": "Welcome back",
  "auth.loginSub": "Log in to post listings and chat with members.",
  "auth.joinTitle": "Join Voisina",
  "auth.joinSub": "Free, ad-free, in under a minute.",
  "auth.email": "Email address",
  "auth.password": "Password",
  "auth.passwordConfirm": "Confirm password",
  "auth.firstname": "First name",
  "auth.lastname": "Last name",
  "auth.city": "Town",
  "auth.nameHint": "Only your first name and last initial are visible (e.g. “Anna M.”).",
  "auth.terms": "I accept the {terms} and the {privacy}.",
  "auth.noAccount": "No account yet?",
  "auth.haveAccount": "Already registered?",
  "auth.showPassword": "Show password",
  "auth.hidePassword": "Hide password",
  "auth.pwRules": "At least 10 characters, with letters, numbers or symbols. A long, memorable sentence works too.",
  "auth.pwGood": "Excellent password.",
  "auth.pwIssue.length": "A little longer: 10 characters minimum.",
  "auth.pwIssue.common": "This password is too common or contains your name.",
  "auth.pwIssue.variety": "Mix upper and lower case, numbers or symbols.",
  "auth.invalid": "Incorrect email or password.",
  "auth.locked": "Too many attempts. For your security, try again in {seconds} seconds.",
  "auth.loggedIn": "Hello {name}!",
  "auth.welcome": "Welcome to Voisina, {name}!",
  "auth.loggedOut": "You are logged out.",
  "auth.loginToContact": "Log in to contact this member.",
  "auth.demoTitle": "Demo access",
  "auth.demoText": "Feel free to create a test account: it stays in your browser. An admin account also exists for the project presentation.",
  "auth.whyTitle": "Why create an account?",
  "auth.why1": "Post listings and answer requests near you.",
  "auth.why2": "Chat safely without sharing your number.",
  "auth.why3": "Keep your favourites and help calendar in one place.",
  "auth.why4": "Build your reputation with every exchange.",
  "auth.securityNote": "Your password is never stored: we only keep an encrypted fingerprint (PBKDF2, 600,000 iterations).",
  "account.hello": "Hello {name}",
  "account.sections": "Account sections",
  "account.tab.profile": "My profile",
  "account.tab.listings": "My listings",
  "account.tab.security": "Security",
  "account.tab.data": "My data",
  "account.tab.prefs": "Preferences",
  "account.myListings": "My listings",
  "account.welcomeNotice": "Your account is ready! Complete your profile to build trust, then post your first listing.",
  "account.changePhoto": "Change photo",
  "account.removePhoto": "Remove photo",
  "account.photoReady": "Photo ready: remember to save.",
  "account.publicName": "Public name: {name}",
  "account.bio": "About me",
  "account.bioPh": "A few words about you, what you enjoy, when you're available…",
  "account.specialties": "Skills",
  "account.specialtiesPh": "e.g. gardening, IT, cooking",
  "account.specialtiesHint": "Separate with commas (up to 8).",
  "account.languages": "Languages spoken",
  "account.viewPublic": "View my public profile",
  "account.saved": "Changes saved.",
  "account.noListings": "You haven't posted a listing yet",
  "account.noListingsText": "Offer your help or ask for a hand: it's free.",
  "account.changePassword": "Change password",
  "account.currentPassword": "Current password",
  "account.newPassword": "New password",
  "account.updatePassword": "Update",
  "account.passwordChanged": "Password changed.",
  "account.adminPwNote": "The demo admin account password is defined in the code (as a fingerprint) and can't be changed here.",
  "account.howProtected": "How your account is protected",
  "account.prot1": "Password turned into a PBKDF2 fingerprint (600,000 iterations, unique salt): nobody can read it.",
  "account.prot2": "Login temporarily blocked after 5 failed attempts.",
  "account.prot3": "Session expires automatically after 14 days.",
  "account.exportTitle": "Download my data",
  "account.exportText": "Under the Swiss Data Protection Act (FADP), you can download all your data in a readable file (JSON).",
  "account.exportBtn": "Download (JSON)",
  "account.exported": "Your data has been downloaded.",
  "account.storedTitle": "What Voisina stores",
  "account.storedProfile": "Profile",
  "account.storedListings": "Listings",
  "account.storedFavorites": "Favourites",
  "account.storedConversations": "Conversations",
  "account.storedWhere": "In this version, this data is stored only in this browser, on this device.",
  "account.deleteTitle": "Delete my account",
  "account.deleteText": "Your profile, listings, favourites and conversations will be permanently deleted.",
  "account.deleteConfirmText": "This can't be undone. Enter your password to confirm.",
  "account.deleteBtn": "Delete permanently",
  "account.deleted": "Your account has been deleted. Goodbye and thank you!",
  "account.language": "Language",
  "account.theme": "Appearance",
  "account.showDemoBanner": "Show the “demo version” banner",
  "profile.notFound": "Member not found",
  "profile.team": "Voisina team",
  "profile.edit": "Edit my profile",
  "profile.activeListings": "Active listings",
  "profile.about": "About",
  "profile.listingsBy": "Listings by {name}",
  "profile.noListings": "No active listings at the moment.",
  "profile.privacy": "To protect privacy, email, full name and address are never shown.",
  "admin.kicker": "Restricted area",
  "admin.title": "Moderation & statistics",
  "admin.lead": "Handle reports and keep an eye on platform activity.",
  "admin.forbidden": "Restricted access",
  "admin.forbiddenText": "This page is reserved for the moderation team.",
  "admin.kpiListings": "active listings",
  "admin.kpiUsers": "registered members",
  "admin.kpiMessages": "messages exchanged",
  "admin.kpiReports": "open reports",
  "admin.reportsTitle": "Reports to handle",
  "admin.noReports": "No pending reports. All good!",
  "admin.colTarget": "Item",
  "admin.colReason": "Reason",
  "admin.colDetails": "Details",
  "admin.colWhen": "Date",
  "admin.colActions": "Actions",
  "admin.colName": "Name",
  "admin.colJoined": "Joined",
  "admin.type.listing": "Listing",
  "admin.type.user": "Member",
  "admin.type.conversation": "Conversation",
  "admin.status.actioned": "hidden",
  "admin.status.dismissed": "dismissed",
  "admin.deleted": "(deleted)",
  "admin.conversation": "Private conversation",
  "admin.hide": "Hide",
  "admin.unhide": "Restore",
  "admin.dismiss": "Dismiss",
  "admin.hidden": "Listing hidden.",
  "admin.unhidden": "Listing restored.",
  "admin.dismissed": "Report dismissed.",
  "admin.history": "History",
  "admin.memberListings": "Member listings",
  "admin.noMemberListings": "No listings posted by members yet.",
  "admin.byCategory": "Listings by category",
  "admin.members": "Registered members",
  "admin.noMembers": "No members registered on this browser yet.",
  "admin.pwNote": "Passwords are never visible, not even to admins.",
  "admin.moderation": "Moderation",
  "admin.reset": "Reset demo",
  "admin.resetTitle": "Reset all data?",
  "admin.resetText": "All accounts, listings, messages and favourites created on this browser will be erased. Sample listings remain.",
  "notif.title": "Notifications",
  "notif.markRead": "Mark all as read",
  "notif.empty": "No notifications yet.",
  "notif.welcome": "Welcome to Voisina! Complete your profile to build trust.",
  "notif.published": "Your listing “{title}” is live.",
  "notif.message": "New message from {name}.",
  "notif.reportDone": "Your report has been handled. Thank you!",
  "pages.kicker": "Information",
  "pages.nav": "Information pages",
  "footer.tagline": "The Swiss platform for neighbourly help: offer a hand, ask for help, give things a second life.",
  "footer.noTracking": "No ads, no trackers",
  "footer.secure": "Secure by design",
  "footer.explore": "Explore",
  "footer.listings": "All listings",
  "footer.map": "Map",
  "footer.community": "Community",
  "footer.help": "Help & FAQ",
  "footer.safety": "Safety tips",
  "footer.rules": "Community rules",
  "footer.about": "About",
  "footer.legal": "Legal",
  "footer.privacy": "Privacy policy",
  "footer.terms": "Terms of use",
  "footer.imprint": "Legal notice",
  "footer.project": "End-of-year project",
  "footer.madeIn": "Made with care in Switzerland",
  "notFound.title": "Page not found",
  "notFound.text": "The link may be wrong or the page no longer exists.",
  "notFound.home": "Back to home",
};

const DICT = { fr, de, it, en };

return { DICT };
});
__def("data.js", function () {
/* =====================================================================
   DONNÉES DE RÉFÉRENCE : cantons, localités, catégories, modèles d'annonces
   ===================================================================== */

const LANGS = ["fr", "de", "it", "en"];

/** Les 26 cantons, avec leur nom dans les 4 langues du site. */
const CANTONS = {
  ZH: { fr: "Zurich", de: "Zürich", it: "Zurigo", en: "Zurich", lang: "de" },
  BE: { fr: "Berne", de: "Bern", it: "Berna", en: "Bern", lang: "de" },
  LU: { fr: "Lucerne", de: "Luzern", it: "Lucerna", en: "Lucerne", lang: "de" },
  UR: { fr: "Uri", de: "Uri", it: "Uri", en: "Uri", lang: "de" },
  SZ: { fr: "Schwytz", de: "Schwyz", it: "Svitto", en: "Schwyz", lang: "de" },
  OW: { fr: "Obwald", de: "Obwalden", it: "Obvaldo", en: "Obwalden", lang: "de" },
  NW: { fr: "Nidwald", de: "Nidwalden", it: "Nidvaldo", en: "Nidwalden", lang: "de" },
  GL: { fr: "Glaris", de: "Glarus", it: "Glarona", en: "Glarus", lang: "de" },
  ZG: { fr: "Zoug", de: "Zug", it: "Zugo", en: "Zug", lang: "de" },
  FR: { fr: "Fribourg", de: "Freiburg", it: "Friburgo", en: "Fribourg", lang: "fr" },
  SO: { fr: "Soleure", de: "Solothurn", it: "Soletta", en: "Solothurn", lang: "de" },
  BS: { fr: "Bâle-Ville", de: "Basel-Stadt", it: "Basilea Città", en: "Basel-City", lang: "de" },
  BL: { fr: "Bâle-Campagne", de: "Basel-Landschaft", it: "Basilea Campagna", en: "Basel-Country", lang: "de" },
  SH: { fr: "Schaffhouse", de: "Schaffhausen", it: "Sciaffusa", en: "Schaffhausen", lang: "de" },
  AR: { fr: "Appenzell Rh.-Ext.", de: "Appenzell Ausserrhoden", it: "Appenzello Esterno", en: "Appenzell Outer Rhodes", lang: "de" },
  AI: { fr: "Appenzell Rh.-Int.", de: "Appenzell Innerrhoden", it: "Appenzello Interno", en: "Appenzell Inner Rhodes", lang: "de" },
  SG: { fr: "Saint-Gall", de: "St. Gallen", it: "San Gallo", en: "St. Gallen", lang: "de" },
  GR: { fr: "Grisons", de: "Graubünden", it: "Grigioni", en: "Grisons", lang: "de" },
  AG: { fr: "Argovie", de: "Aargau", it: "Argovia", en: "Aargau", lang: "de" },
  TG: { fr: "Thurgovie", de: "Thurgau", it: "Turgovia", en: "Thurgau", lang: "de" },
  TI: { fr: "Tessin", de: "Tessin", it: "Ticino", en: "Ticino", lang: "it" },
  VD: { fr: "Vaud", de: "Waadt", it: "Vaud", en: "Vaud", lang: "fr" },
  VS: { fr: "Valais", de: "Wallis", it: "Vallese", en: "Valais", lang: "fr" },
  NE: { fr: "Neuchâtel", de: "Neuenburg", it: "Neuchâtel", en: "Neuchâtel", lang: "fr" },
  GE: { fr: "Genève", de: "Genf", it: "Ginevra", en: "Geneva", lang: "fr" },
  JU: { fr: "Jura", de: "Jura", it: "Giura", en: "Jura", lang: "fr" },
};

const CANTON_CODES = Object.keys(CANTONS);

/** Localités : [nom, NPA, canton, latitude, longitude, langue locale (facultatif)]
 *  Coordonnées approximatives du centre (la position exacte n'est jamais utilisée). */
const RAW_LOCALITIES = [
  ["Zürich", "8001", "ZH", 47.3769, 8.5417], ["Winterthur", "8400", "ZH", 47.4999, 8.7241], ["Uster", "8610", "ZH", 47.3471, 8.7209],
  ["Dübendorf", "8600", "ZH", 47.3972, 8.6186], ["Dietikon", "8953", "ZH", 47.4017, 8.4001], ["Wädenswil", "8820", "ZH", 47.2303, 8.6716],
  ["Kloten", "8302", "ZH", 47.4515, 8.5849], ["Horgen", "8810", "ZH", 47.2596, 8.5977], ["Bülach", "8180", "ZH", 47.522, 8.5405], ["Meilen", "8706", "ZH", 47.27, 8.6435],
  ["Bern", "3011", "BE", 46.948, 7.4474], ["Biel/Bienne", "2502", "BE", 47.1368, 7.2468], ["Thun", "3600", "BE", 46.758, 7.628],
  ["Köniz", "3098", "BE", 46.9244, 7.4146], ["Burgdorf", "3400", "BE", 47.059, 7.628], ["Langenthal", "4900", "BE", 47.2153, 7.787],
  ["Interlaken", "3800", "BE", 46.6863, 7.8632], ["Spiez", "3700", "BE", 46.6865, 7.6793], ["Moutier", "2740", "BE", 47.2786, 7.3706, "fr"], ["Saint-Imier", "2610", "BE", 47.1527, 6.9965, "fr"],
  ["Luzern", "6003", "LU", 47.0502, 8.3093], ["Emmen", "6020", "LU", 47.0782, 8.294], ["Kriens", "6010", "LU", 47.0359, 8.2765], ["Sursee", "6210", "LU", 47.1717, 8.111],
  ["Altdorf", "6460", "UR", 46.8804, 8.6444], ["Andermatt", "6490", "UR", 46.6356, 8.5939],
  ["Schwyz", "6430", "SZ", 47.0207, 8.6524], ["Freienbach", "8807", "SZ", 47.2047, 8.7584], ["Einsiedeln", "8840", "SZ", 47.1285, 8.743], ["Küssnacht", "6403", "SZ", 47.0859, 8.4419],
  ["Sarnen", "6060", "OW", 46.896, 8.246], ["Engelberg", "6390", "OW", 46.8211, 8.4013],
  ["Stans", "6370", "NW", 46.958, 8.366], ["Glarus", "8750", "GL", 47.04, 9.068],
  ["Zug", "6300", "ZG", 47.1662, 8.5155], ["Baar", "6340", "ZG", 47.1963, 8.5295], ["Cham", "6330", "ZG", 47.182, 8.4636],
  ["Fribourg", "1700", "FR", 46.8065, 7.161], ["Bulle", "1630", "FR", 46.617, 7.0577], ["Murten/Morat", "3280", "FR", 46.9283, 7.1172, "de"],
  ["Estavayer", "1470", "FR", 46.849, 6.846], ["Villars-sur-Glâne", "1752", "FR", 46.7905, 7.117], ["Düdingen", "3186", "FR", 46.8491, 7.1886, "de"],
  ["Solothurn", "4500", "SO", 47.2088, 7.5323], ["Olten", "4600", "SO", 47.3499, 7.9033], ["Grenchen", "2540", "SO", 47.1921, 7.3959],
  ["Basel", "4051", "BS", 47.5596, 7.5886], ["Riehen", "4125", "BS", 47.5788, 7.6468],
  ["Liestal", "4410", "BL", 47.4841, 7.7343], ["Allschwil", "4123", "BL", 47.5508, 7.5358], ["Pratteln", "4133", "BL", 47.5207, 7.693],
  ["Reinach", "4153", "BL", 47.4935, 7.591], ["Muttenz", "4132", "BL", 47.5228, 7.6453],
  ["Schaffhausen", "8200", "SH", 47.696, 8.635], ["Neuhausen am Rheinfall", "8212", "SH", 47.683, 8.617],
  ["Herisau", "9100", "AR", 47.3862, 9.2792], ["Appenzell", "9050", "AI", 47.3311, 9.409],
  ["St. Gallen", "9000", "SG", 47.4245, 9.3767], ["Rapperswil-Jona", "8640", "SG", 47.2298, 8.836], ["Wil", "9500", "SG", 47.4615, 9.0455],
  ["Gossau", "9200", "SG", 47.415, 9.254], ["Buchs", "9470", "SG", 47.167, 9.478],
  ["Chur", "7000", "GR", 46.8508, 9.531], ["Davos", "7270", "GR", 46.8027, 9.836], ["St. Moritz", "7500", "GR", 46.4908, 9.8355],
  ["Ilanz", "7130", "GR", 46.774, 9.204], ["Poschiavo", "7742", "GR", 46.324, 10.058, "it"],
  ["Aarau", "5000", "AG", 47.3904, 8.0457], ["Baden", "5400", "AG", 47.4733, 8.3059], ["Wettingen", "5430", "AG", 47.4597, 8.316],
  ["Brugg", "5200", "AG", 47.484, 8.2084], ["Wohlen", "5610", "AG", 47.351, 8.278], ["Rheinfelden", "4310", "AG", 47.554, 7.794],
  ["Frauenfeld", "8500", "TG", 47.557, 9.108], ["Kreuzlingen", "8280", "TG", 47.65, 9.175], ["Arbon", "9320", "TG", 47.5167, 9.4333], ["Weinfelden", "8570", "TG", 47.5667, 9.1],
  ["Lugano", "6900", "TI", 46.0037, 8.9511], ["Bellinzona", "6500", "TI", 46.1957, 9.022], ["Locarno", "6600", "TI", 46.1709, 8.7995],
  ["Mendrisio", "6850", "TI", 45.8702, 8.9819], ["Chiasso", "6830", "TI", 45.835, 9.03], ["Biasca", "6710", "TI", 46.359, 8.969],
  ["Lausanne", "1003", "VD", 46.5197, 6.6323], ["Montreux", "1820", "VD", 46.4312, 6.9107], ["Nyon", "1260", "VD", 46.3833, 6.2396],
  ["Vevey", "1800", "VD", 46.4625, 6.8431], ["Yverdon-les-Bains", "1400", "VD", 46.7785, 6.6412], ["Renens", "1020", "VD", 46.539, 6.588],
  ["Morges", "1110", "VD", 46.511, 6.499], ["Pully", "1009", "VD", 46.51, 6.662], ["Gland", "1196", "VD", 46.421, 6.27],
  ["Aigle", "1860", "VD", 46.318, 6.969], ["Payerne", "1530", "VD", 46.822, 6.938], ["Orbe", "1350", "VD", 46.725, 6.532],
  ["Sainte-Croix", "1450", "VD", 46.822, 6.503], ["Vallorbe", "1337", "VD", 46.712, 6.379],
  ["Sion", "1950", "VS", 46.2331, 7.3606], ["Martigny", "1920", "VS", 46.1022, 7.0729], ["Monthey", "1870", "VS", 46.2549, 6.9541],
  ["Sierre", "3960", "VS", 46.292, 7.535], ["Brig", "3900", "VS", 46.3167, 7.9833, "de"], ["Visp", "3930", "VS", 46.293, 7.882, "de"],
  ["Zermatt", "3920", "VS", 46.0207, 7.7491, "de"], ["Verbier", "1936", "VS", 46.096, 7.228],
  ["Neuchâtel", "2000", "NE", 46.9896, 6.9293], ["La Chaux-de-Fonds", "2300", "NE", 47.0999, 6.8259], ["Le Locle", "2400", "NE", 47.056, 6.749], ["Fleurier", "2114", "NE", 46.903, 6.582],
  ["Genève", "1204", "GE", 46.2044, 6.1432], ["Carouge", "1227", "GE", 46.1815, 6.1395], ["Meyrin", "1217", "GE", 46.234, 6.08],
  ["Vernier", "1214", "GE", 46.217, 6.084], ["Lancy", "1212", "GE", 46.189, 6.116], ["Onex", "1213", "GE", 46.184, 6.102], ["Thônex", "1226", "GE", 46.192, 6.2],
  ["Delémont", "2800", "JU", 47.364, 7.344], ["Porrentruy", "2900", "JU", 47.4173, 7.0754], ["Saignelégier", "2350", "JU", 47.256, 6.996],
];

const LOCALITIES = RAW_LOCALITIES.map(([name, npa, canton, lat, lng, lang]) => ({
  name, npa, canton, lat, lng, lang: lang || CANTONS[canton].lang,
}));

/** Supprime les accents pour des recherches tolérantes ("geneve" trouve "Genève"). */
function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Recherche locale d'une localité par nom ou NPA (fonctionne hors ligne). */
function searchLocalities(query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const loc of LOCALITIES) {
    const n = normalize(loc.name);
    if (n.startsWith(q) || loc.npa.startsWith(q)) starts.push(loc);
    else if (n.includes(q)) contains.push(loc);
  }
  return [...starts, ...contains].slice(0, limit);
}

function findLocality(name) {
  const q = normalize(name);
  return LOCALITIES.find((l) => normalize(l.name) === q) || null;
}

const SWITZERLAND_CENTER = { lat: 46.8182, lng: 8.2275 };

/** Catégories : icône + teinte + libellés traduits. */
const CATEGORIES = [
  { id: "shopping", icon: "cart", tone: 0, fr: "Courses & commissions", de: "Einkäufe & Besorgungen", it: "Spesa e commissioni", en: "Shopping & errands" },
  { id: "pets", icon: "paw", tone: 1, fr: "Animaux", de: "Tiere", it: "Animali", en: "Pets" },
  { id: "seniors", icon: "armchair", tone: 2, fr: "Aide aux aînés", de: "Hilfe für Senioren", it: "Aiuto agli anziani", en: "Help for seniors" },
  { id: "family", icon: "smile", tone: 3, fr: "Famille & enfants", de: "Familie & Kinder", it: "Famiglia e bambini", en: "Family & kids" },
  { id: "transport", icon: "car", tone: 4, fr: "Transport", de: "Fahrdienste", it: "Trasporti", en: "Transport & rides" },
  { id: "repair", icon: "wrench", tone: 5, fr: "Bricolage & réparations", de: "Heimwerken & Reparaturen", it: "Fai da te e riparazioni", en: "DIY & repairs" },
  { id: "digital", icon: "laptop", tone: 4, fr: "Aide informatique", de: "Computerhilfe", it: "Aiuto informatico", en: "Tech help" },
  { id: "language", icon: "languages", tone: 3, fr: "Langues & cours", de: "Sprachen & Nachhilfe", it: "Lingue e lezioni", en: "Languages & tutoring" },
  { id: "garden", icon: "sprout", tone: 0, fr: "Jardin", de: "Garten", it: "Giardino", en: "Garden" },
  { id: "home", icon: "home", tone: 2, fr: "Maison & ménage", de: "Haushalt", it: "Casa e pulizie", en: "Home & housekeeping" },
  { id: "moving", icon: "package", tone: 5, fr: "Déménagement", de: "Umzug", it: "Trasloco", en: "Moving" },
  { id: "donation", icon: "gift", tone: 1, fr: "Dons & objets", de: "Verschenken", it: "Regali e oggetti", en: "Giveaways" },
  { id: "community", icon: "users", tone: 0, fr: "Vie de quartier", de: "Quartierleben", it: "Vita di quartiere", en: "Neighbourhood life" },
  { id: "other", icon: "sparkles", tone: 3, fr: "Autre", de: "Sonstiges", it: "Altro", en: "Other" },
];

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const getCategory = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

const TYPES = ["offer", "request", "donation"];
const PAYMENTS = ["free", "paid", "negotiable"];
const UNITS = ["total", "hour", "visit"];
const DURATIONS = [30, 60, 90, 120, 180, 240, 480];
const RECURRENCES = ["once", "weekly", "monthly"];

/* ---------------------------------------------------------------------
   MODÈLES D'ANNONCES DE DÉMONSTRATION (traduits dans les 4 langues)
   c = catégorie, ty = type, pay = rémunération, amt = montant CHF,
   unit = unité, dur = durée (min), rec = récurrence
   --------------------------------------------------------------------- */
const TEMPLATES = [
  { c: "shopping", ty: "offer", pay: "paid", amt: 15, unit: "visit", dur: 60,
    t: { fr: "Je fais vos courses de la semaine", de: "Ich erledige Ihren Wocheneinkauf", it: "Faccio la vostra spesa settimanale", en: "I'll do your weekly grocery run" },
    d: { fr: "Je passe à la Migros ou à la Coop pour vous et je livre à domicile. Idéal si vous avez peu de temps ou du mal à vous déplacer. Vous me donnez la liste, je m'occupe du reste.",
         de: "Ich gehe für Sie in die Migros oder den Coop und bringe alles nach Hause. Ideal, wenn Sie wenig Zeit haben oder nicht gut zu Fuss sind. Sie geben mir die Liste, ich kümmere mich um den Rest.",
         it: "Vado alla Migros o alla Coop per voi e consegno a domicilio. Ideale se avete poco tempo o difficoltà a spostarvi. Voi mi date la lista, io penso al resto.",
         en: "I'll go to Migros or Coop for you and deliver to your door. Perfect if you're short on time or have trouble getting around. Just give me the list and I'll take care of the rest." } },
  { c: "shopping", ty: "request", pay: "free", amt: 0, unit: "total", dur: 30,
    t: { fr: "Quelqu'un pour passer à la pharmacie ?", de: "Wer holt mir Medikamente in der Apotheke?", it: "Qualcuno può passare in farmacia per me?", en: "Could someone pick up my prescription?" },
    d: { fr: "Je suis alitée quelques jours après une opération et j'aurais besoin qu'on passe chercher mes médicaments à la pharmacie du quartier. L'ordonnance est déjà transmise.",
         de: "Ich bin nach einer Operation ein paar Tage ans Bett gebunden und bräuchte jemanden, der meine Medikamente in der Quartierapotheke abholt. Das Rezept ist bereits dort.",
         it: "Dopo un'operazione devo restare a letto qualche giorno e avrei bisogno che qualcuno ritiri i miei medicinali nella farmacia del quartiere. La ricetta è già stata inviata.",
         en: "I'm stuck in bed for a few days after surgery and need someone to collect my medication from the local pharmacy. The prescription has already been sent." } },
  { c: "pets", ty: "offer", pay: "paid", amt: 15, unit: "visit", dur: 60,
    t: { fr: "Promenade de chiens en semaine", de: "Hundespaziergänge unter der Woche", it: "Passeggiate con il cane in settimana", en: "Weekday dog walking" },
    d: { fr: "Amoureuse des animaux, je promène votre chien pendant que vous travaillez. Balades de 45 minutes par tous les temps, avec des photos envoyées par la messagerie.",
         de: "Als Tierfreundin führe ich Ihren Hund aus, während Sie arbeiten. Spaziergänge von 45 Minuten bei jedem Wetter – mit Fotos über den Chat.",
         it: "Amante degli animali, porto a spasso il vostro cane mentre lavorate. Passeggiate di 45 minuti con qualsiasi tempo, con foto inviate in chat.",
         en: "Animal lover here: I'll walk your dog while you're at work. 45-minute walks in any weather, with photos sent through the chat." } },
  { c: "pets", ty: "request", pay: "negotiable", amt: 0, unit: "visit", dur: 30,
    t: { fr: "Garde de chat pendant les vacances", de: "Katzensitting während der Ferien", it: "Cercasi cat sitter per le vacanze", en: "Cat sitting during the holidays" },
    d: { fr: "Nous partons deux semaines. Nous cherchons une personne de confiance pour nourrir notre chat et changer sa litière une fois par jour.",
         de: "Wir sind zwei Wochen weg und suchen eine vertrauenswürdige Person, die unsere Katze einmal täglich füttert und das Katzenklo reinigt.",
         it: "Partiamo per due settimane. Cerchiamo una persona di fiducia che dia da mangiare al nostro gatto e pulisca la lettiera una volta al giorno.",
         en: "We're away for two weeks and are looking for someone trustworthy to feed our cat and clean the litter box once a day." } },
  { c: "seniors", ty: "offer", pay: "free", amt: 0, unit: "total", dur: 90,
    t: { fr: "Visites et compagnie pour personnes âgées", de: "Besuche und Gesellschaft für Senioren", it: "Visite e compagnia per persone anziane", en: "Visits and company for older people" },
    d: { fr: "Retraité, j'ai du temps libre et j'aime la conversation. Je propose de rendre visite, jouer aux cartes, faire une promenade ou simplement boire un café ensemble.",
         de: "Ich bin pensioniert, habe Zeit und unterhalte mich gerne. Ich biete Besuche, Kartenspiele, Spaziergänge oder einfach einen gemeinsamen Kaffee an.",
         it: "Sono in pensione, ho tempo libero e amo chiacchierare. Propongo visite, partite a carte, passeggiate o semplicemente un caffè insieme.",
         en: "I'm retired, have free time and love a good chat. I can drop by for cards, a walk or simply a coffee together." } },
  { c: "seniors", ty: "request", pay: "free", amt: 0, unit: "total", dur: 120,
    t: { fr: "Accompagner ma mère chez le médecin", de: "Begleitung zum Arzttermin gesucht", it: "Accompagnare mia madre dal medico", en: "Someone to take my mother to the doctor" },
    d: { fr: "Ma mère de 84 ans a un rendez-vous chez son médecin et ne conduit plus. Je cherche quelqu'un pour l'accompagner en transports publics, car je travaille ce jour-là.",
         de: "Meine 84-jährige Mutter hat einen Arzttermin und fährt nicht mehr Auto. Ich suche jemanden, der sie mit dem ÖV begleitet – ich muss an diesem Tag arbeiten.",
         it: "Mia madre di 84 anni ha un appuntamento dal medico e non guida più. Cerco qualcuno che la accompagni con i mezzi pubblici, perché quel giorno lavoro.",
         en: "My 84-year-old mother has a doctor's appointment and no longer drives. I'm looking for someone to go with her on public transport, as I'm working that day." } },
  { c: "family", ty: "offer", pay: "paid", amt: 20, unit: "hour", dur: 180,
    t: { fr: "Baby-sitting les soirs et week-ends", de: "Babysitting abends und am Wochenende", it: "Baby-sitting la sera e nel weekend", en: "Evening and weekend babysitting" },
    d: { fr: "Étudiante de 21 ans, j'ai suivi le cours de baby-sitting de la Croix-Rouge. Disponible les soirs et les week-ends pour garder vos enfants de 2 à 10 ans.",
         de: "Studentin, 21, mit dem Babysitting-Kurs des SRK. Abends und am Wochenende verfügbar für Kinder von 2 bis 10 Jahren.",
         it: "Studentessa di 21 anni, ho seguito il corso di baby-sitting della Croce Rossa. Disponibile la sera e nel fine settimana per bambini dai 2 ai 10 anni.",
         en: "21-year-old student with the Red Cross babysitting course. Available evenings and weekends for children aged 2 to 10." } },
  { c: "family", ty: "request", pay: "paid", amt: 20, unit: "hour", dur: 180, rec: "weekly",
    t: { fr: "Récupérer les enfants à l'école", de: "Kinder von der Schule abholen", it: "Prendere i bambini a scuola", en: "School pick-up for two kids" },
    d: { fr: "Deux après-midi par semaine, j'ai besoin de quelqu'un pour aller chercher mes deux enfants (6 et 8 ans) à l'école et les garder jusqu'à 18 h.",
         de: "An zwei Nachmittagen pro Woche brauche ich jemanden, der meine zwei Kinder (6 und 8) von der Schule abholt und bis 18 Uhr betreut.",
         it: "Due pomeriggi a settimana ho bisogno di qualcuno che vada a prendere i miei due figli (6 e 8 anni) a scuola e li tenga fino alle 18.",
         en: "Two afternoons a week I need someone to pick up my two children (6 and 8) from school and look after them until 6 pm." } },
  { c: "language", ty: "offer", pay: "paid", amt: 30, unit: "hour", dur: 60,
    t: { fr: "Aide aux devoirs – maths et français", de: "Nachhilfe in Mathe und Deutsch", it: "Aiuto compiti – matematica e italiano", en: "Homework help – maths and languages" },
    d: { fr: "Enseignant à la retraite, j'aide les élèves de la 5P à la 11H en mathématiques et en français. Méthode douce et beaucoup de patience.",
         de: "Als pensionierter Lehrer helfe ich Schülerinnen und Schülern der 3. bis 9. Klasse in Mathematik und Deutsch. Ruhige Art, viel Geduld.",
         it: "Insegnante in pensione, aiuto gli allievi delle elementari e delle medie in matematica e italiano. Metodo tranquillo e tanta pazienza.",
         en: "Retired teacher helping primary and secondary pupils with maths and languages. Calm approach and lots of patience." } },
  { c: "language", ty: "offer", pay: "free", amt: 0, unit: "total", dur: 60, rec: "weekly",
    t: { fr: "Tandem de conversation français–allemand", de: "Sprachtandem Deutsch–Französisch", it: "Tandem linguistico italiano–tedesco", en: "Language exchange over coffee" },
    d: { fr: "Je parle français et j'aimerais améliorer mon allemand. On se retrouve autour d'un café : une demi-heure dans chaque langue.",
         de: "Ich spreche Deutsch und möchte mein Französisch verbessern. Treffen wir uns bei einem Kaffee: eine halbe Stunde pro Sprache.",
         it: "Parlo italiano e vorrei migliorare il mio tedesco. Ci vediamo per un caffè: mezz'ora in ogni lingua.",
         en: "Let's meet for coffee and practise languages together: half an hour in each language. All levels welcome." } },
  { c: "digital", ty: "offer", pay: "free", amt: 0, unit: "total", dur: 60,
    t: { fr: "Aide smartphone et ordinateur pour débutants", de: "Handy- und Computerhilfe für Einsteiger", it: "Aiuto smartphone e computer per principianti", en: "Smartphone and computer help for beginners" },
    d: { fr: "Je vous aide à configurer votre téléphone, utiliser WhatsApp, faire des appels vidéo, gérer vos e-mails ou acheter un billet CFF en ligne.",
         de: "Ich helfe Ihnen beim Einrichten des Handys, bei WhatsApp, Videoanrufen, E-Mails oder beim Kauf eines SBB-Billetts online.",
         it: "Vi aiuto a configurare il telefono, usare WhatsApp, fare videochiamate, gestire le e-mail o comprare un biglietto FFS online.",
         en: "I'll help you set up your phone, use WhatsApp, make video calls, manage emails or buy an SBB train ticket online." } },
  { c: "digital", ty: "request", pay: "negotiable", amt: 0, unit: "visit", dur: 60,
    t: { fr: "Mon imprimante ne fonctionne plus", de: "Mein Drucker funktioniert nicht mehr", it: "La mia stampante non funziona più", en: "My printer stopped working" },
    d: { fr: "Depuis une mise à jour, mon ordinateur ne trouve plus l'imprimante. Quelqu'un de patient pourrait-il passer jeter un œil ?",
         de: "Seit einem Update findet mein Computer den Drucker nicht mehr. Könnte jemand mit Geduld vorbeikommen und nachschauen?",
         it: "Dopo un aggiornamento il computer non trova più la stampante. Qualcuno di paziente potrebbe passare a dare un'occhiata?",
         en: "Since an update, my computer can't find the printer anymore. Could someone patient come by and take a look?" } },
  { c: "digital", ty: "offer", pay: "paid", amt: 25, unit: "hour", dur: 120,
    t: { fr: "Numérisation de photos et diapositives", de: "Digitalisierung von Fotos und Dias", it: "Digitalizzazione di foto e diapositive", en: "Digitising photos and slides" },
    d: { fr: "Je numérise vos anciennes photos, diapositives et cassettes vidéo pour les conserver et les partager en famille.",
         de: "Ich digitalisiere Ihre alten Fotos, Dias und Videokassetten, damit Sie sie aufbewahren und mit der Familie teilen können.",
         it: "Digitalizzo vecchie foto, diapositive e videocassette per conservarle e condividerle in famiglia.",
         en: "I'll digitise your old photos, slides and video tapes so you can keep them and share them with family." } },
  { c: "transport", ty: "offer", pay: "paid", amt: 30, unit: "total", dur: 90,
    t: { fr: "Transport pour objets encombrants", de: "Transport für sperrige Sachen", it: "Trasporto per oggetti ingombranti", en: "Van for bulky items" },
    d: { fr: "J'ai une camionnette et je peux transporter un meuble, des achats encombrants ou des objets pour la déchetterie.",
         de: "Ich habe einen Lieferwagen und transportiere Möbel, sperrige Einkäufe oder Sachen für die Entsorgungsstelle.",
         it: "Ho un furgoncino e posso trasportare un mobile, acquisti ingombranti o oggetti da portare all'ecocentro.",
         en: "I have a small van and can move a piece of furniture, bulky shopping or items for the recycling centre." } },
  { c: "transport", ty: "request", pay: "free", amt: 0, unit: "total", dur: 60, rec: "weekly",
    t: { fr: "Covoiturage pour le marché du samedi", de: "Mitfahrgelegenheit zum Samstagsmarkt", it: "Passaggio per il mercato del sabato", en: "Lift to the Saturday market" },
    d: { fr: "Je n'ai pas de voiture et le marché est mal desservi le samedi matin. Quelqu'un y va régulièrement et aurait une place ?",
         de: "Ich habe kein Auto und der Markt ist am Samstagmorgen schlecht erreichbar. Fährt jemand regelmässig hin und hätte einen Platz frei?",
         it: "Non ho l'auto e il sabato mattina il mercato è mal servito. Qualcuno ci va regolarmente e ha un posto libero?",
         en: "I don't have a car and the market is poorly served on Saturday mornings. Does anyone go regularly and have a free seat?" } },
  { c: "repair", ty: "offer", pay: "negotiable", amt: 0, unit: "visit", dur: 120,
    t: { fr: "Petits travaux de bricolage à domicile", de: "Kleine Handwerksarbeiten zu Hause", it: "Piccoli lavori di bricolage a domicilio", en: "Small DIY jobs at home" },
    d: { fr: "Monter un meuble, fixer une étagère, changer une ampoule difficile d'accès ou réparer un robinet qui goutte : j'ai l'outillage et l'expérience.",
         de: "Möbel aufbauen, ein Regal montieren, schwer erreichbare Lampen wechseln oder einen tropfenden Wasserhahn reparieren: Werkzeug und Erfahrung sind vorhanden.",
         it: "Montare un mobile, fissare una mensola, cambiare una lampadina difficile da raggiungere o riparare un rubinetto che gocciola: ho gli attrezzi e l'esperienza.",
         en: "Assembling furniture, putting up a shelf, changing a hard-to-reach bulb or fixing a dripping tap: I have the tools and the experience." } },
  { c: "repair", ty: "request", pay: "paid", amt: 40, unit: "total", dur: 60,
    t: { fr: "Réparer mon vélo (freins et vitesses)", de: "Velo reparieren (Bremsen und Schaltung)", it: "Riparare la mia bici (freni e cambio)", en: "Bike repair (brakes and gears)" },
    d: { fr: "Mon vélo a besoin d'un réglage des freins et du dérailleur. Les pièces sont à ma charge, merci d'avance pour votre aide !",
         de: "Mein Velo braucht eine Einstellung der Bremsen und der Schaltung. Ersatzteile zahle ich – danke für die Hilfe!",
         it: "La mia bici ha bisogno di una regolazione dei freni e del cambio. I pezzi li pago io, grazie in anticipo!",
         en: "My bike needs its brakes and gears adjusted. I'll pay for any parts — thanks in advance for your help!" } },
  { c: "garden", ty: "request", pay: "paid", amt: 25, unit: "hour", dur: 180,
    t: { fr: "Aide pour tailler la haie", de: "Hilfe beim Heckenschneiden", it: "Aiuto per potare la siepe", en: "Help trimming the hedge" },
    d: { fr: "Notre haie a bien poussé. Nous cherchons un coup de main pour la tailler et évacuer les branches. Taille-haie et échelle fournis.",
         de: "Unsere Hecke ist stark gewachsen. Wir suchen Hilfe beim Schneiden und Wegbringen der Äste. Heckenschere und Leiter sind vorhanden.",
         it: "La nostra siepe è cresciuta parecchio. Cerchiamo aiuto per potarla e portare via i rami. Tagliasiepi e scala a disposizione.",
         en: "Our hedge has grown a lot. We need a hand trimming it and clearing the branches. Hedge trimmer and ladder provided." } },
  { c: "garden", ty: "donation", pay: "free", amt: 0, unit: "total", dur: 30,
    t: { fr: "Plantons de tomates à donner", de: "Tomatensetzlinge zu verschenken", it: "Piantine di pomodoro da regalare", en: "Tomato seedlings to give away" },
    d: { fr: "J'ai trop de plantons cette année : tomates, courgettes et basilic. Venez les chercher, je vous donne aussi quelques conseils de culture.",
         de: "Ich habe dieses Jahr zu viele Setzlinge: Tomaten, Zucchetti und Basilikum. Holen Sie sie ab – Tipps zum Anbau gibt es gratis dazu.",
         it: "Quest'anno ho troppe piantine: pomodori, zucchine e basilico. Venite a prenderle, vi do anche qualche consiglio.",
         en: "I have too many seedlings this year: tomatoes, courgettes and basil. Come and pick them up — gardening tips included." } },
  { c: "home", ty: "offer", pay: "paid", amt: 28, unit: "hour", dur: 180,
    t: { fr: "Aide au ménage et au repassage", de: "Hilfe bei Haushalt und Bügeln", it: "Aiuto per pulizie e stiro", en: "Cleaning and ironing help" },
    d: { fr: "Soigneuse et discrète, je vous aide pour le ménage, le repassage ou un grand nettoyage de printemps.",
         de: "Sorgfältig und diskret helfe ich Ihnen beim Putzen, Bügeln oder beim grossen Frühlingsputz.",
         it: "Precisa e discreta, vi aiuto con le pulizie, lo stiro o le grandi pulizie di primavera.",
         en: "Careful and discreet, I can help with cleaning, ironing or a big spring clean." } },
  { c: "home", ty: "request", pay: "free", amt: 0, unit: "total", dur: 30,
    t: { fr: "Arroser mes plantes pendant mon absence", de: "Pflanzen giessen während meiner Abwesenheit", it: "Innaffiare le piante durante la mia assenza", en: "Water my plants while I'm away" },
    d: { fr: "Je m'absente une semaine. Qui pourrait passer deux fois pour arroser mes plantes ? Je rendrai volontiers la pareille.",
         de: "Ich bin eine Woche weg. Wer könnte zweimal vorbeikommen und meine Pflanzen giessen? Ich revanchiere mich gern.",
         it: "Sarò via una settimana. Chi potrebbe passare due volte ad annaffiare le mie piante? Ricambierò volentieri.",
         en: "I'm away for a week. Could someone drop by twice to water my plants? Happy to return the favour." } },
  { c: "moving", ty: "request", pay: "paid", amt: 25, unit: "hour", dur: 240,
    t: { fr: "Besoin de bras pour un déménagement", de: "Helfer für einen Umzug gesucht", it: "Cercasi braccia per un trasloco", en: "Extra hands for a move" },
    d: { fr: "Je déménage d'un 3e étage sans ascenseur. Je cherche deux personnes motivées pour porter les cartons. Pizza et boissons offertes !",
         de: "Ich ziehe aus dem 3. Stock ohne Lift aus und suche zwei motivierte Personen zum Kistentragen. Pizza und Getränke offeriert!",
         it: "Trasloco da un terzo piano senza ascensore. Cerco due persone motivate per portare gli scatoloni. Pizza e bibite offerte!",
         en: "I'm moving out of a 3rd-floor flat with no lift and need two motivated people to carry boxes. Pizza and drinks on me!" } },
  { c: "moving", ty: "donation", pay: "free", amt: 0, unit: "total", dur: 30,
    t: { fr: "Cartons de déménagement à donner", de: "Umzugskartons zu verschenken", it: "Scatoloni da trasloco da regalare", en: "Moving boxes to give away" },
    d: { fr: "Une trentaine de cartons solides, déjà pliés, et du papier bulle. À venir chercher rapidement.",
         de: "Rund dreissig stabile, zusammengefaltete Kartons und Luftpolsterfolie. Bitte bald abholen.",
         it: "Una trentina di scatoloni robusti già piegati e del pluriball. Da ritirare al più presto.",
         en: "About thirty sturdy flat-packed boxes plus bubble wrap. Please pick them up soon." } },
  { c: "donation", ty: "donation", pay: "free", amt: 0, unit: "total", dur: 30,
    t: { fr: "Table en bois et quatre chaises", de: "Holztisch mit vier Stühlen", it: "Tavolo in legno e quattro sedie", en: "Wooden table and four chairs" },
    d: { fr: "Table en chêne massif (160 × 90 cm) et quatre chaises en bon état. À donner contre un petit coup de main pour la descente.",
         de: "Massiver Eichentisch (160 × 90 cm) und vier Stühle in gutem Zustand. Gratis gegen etwas Hilfe beim Heruntertragen.",
         it: "Tavolo in rovere massiccio (160 × 90 cm) e quattro sedie in buono stato. In regalo, basta un aiuto a portarli giù.",
         en: "Solid oak table (160 × 90 cm) and four chairs in good condition. Free — just help me carry them downstairs." } },
  { c: "donation", ty: "donation", pay: "free", amt: 0, unit: "total", dur: 30,
    t: { fr: "Vêtements d'enfant 2–4 ans", de: "Kinderkleider 2–4 Jahre", it: "Vestiti per bambini 2–4 anni", en: "Children's clothes, ages 2–4" },
    d: { fr: "Deux sacs de vêtements d'enfant propres et en bon état, pour garçon et fille. Idéal pour une famille qui s'agrandit.",
         de: "Zwei Säcke saubere Kinderkleider in gutem Zustand, für Buben und Mädchen. Ideal für eine wachsende Familie.",
         it: "Due sacchi di vestiti per bambini puliti e in buono stato, per maschi e femmine. Ideali per una famiglia che cresce.",
         en: "Two bags of clean children's clothes in good condition, for boys and girls. Ideal for a growing family." } },
  { c: "donation", ty: "donation", pay: "free", amt: 0, unit: "total", dur: 30,
    t: { fr: "Livres et bandes dessinées", de: "Bücher und Comics", it: "Libri e fumetti", en: "Books and comics" },
    d: { fr: "Je vide ma bibliothèque : romans, livres de cuisine et une belle collection de BD. Servez-vous !",
         de: "Ich räume mein Büchergestell: Romane, Kochbücher und eine schöne Comic-Sammlung. Bedienen Sie sich!",
         it: "Svuoto la mia libreria: romanzi, libri di cucina e una bella collezione di fumetti. Servitevi pure!",
         en: "Clearing my bookshelves: novels, cookbooks and a nice comic collection. Help yourself!" } },
  { c: "community", ty: "offer", pay: "free", amt: 0, unit: "total", dur: 180, rec: "monthly",
    t: { fr: "Repair Café du quartier", de: "Repair Café im Quartier", it: "Repair Café di quartiere", en: "Neighbourhood Repair Café" },
    d: { fr: "Chaque mois, des bénévoles réparent gratuitement petits appareils, vêtements et vélos. Apportez vos objets cassés, on les répare ensemble !",
         de: "Jeden Monat reparieren Freiwillige kostenlos Kleingeräte, Kleider und Velos. Bringen Sie Ihre kaputten Sachen mit – wir flicken sie gemeinsam!",
         it: "Ogni mese dei volontari riparano gratuitamente piccoli elettrodomestici, vestiti e bici. Portate i vostri oggetti rotti, li ripariamo insieme!",
         en: "Every month, volunteers repair small appliances, clothes and bikes for free. Bring your broken items and we'll fix them together!" } },
  { c: "community", ty: "request", pay: "free", amt: 0, unit: "total", dur: 180,
    t: { fr: "Bénévoles pour la fête des voisins", de: "Freiwillige für das Nachbarschaftsfest", it: "Volontari per la festa dei vicini", en: "Volunteers for the neighbours' party" },
    d: { fr: "Nous organisons la fête des voisins de l'immeuble. Qui peut aider à installer les tables, préparer un gâteau ou animer un jeu pour les enfants ?",
         de: "Wir organisieren ein Fest für die Nachbarschaft. Wer hilft beim Aufstellen der Tische, backt einen Kuchen oder leitet ein Spiel für Kinder?",
         it: "Organizziamo la festa dei vicini del palazzo. Chi può aiutare a montare i tavoli, preparare una torta o animare un gioco per i bambini?",
         en: "We're organising a party for our building. Who can help set up tables, bake a cake or run a game for the kids?" } },
  { c: "community", ty: "offer", pay: "free", amt: 0, unit: "total", dur: 60, rec: "weekly",
    t: { fr: "Balade du dimanche en groupe", de: "Gemeinsamer Sonntagsspaziergang", it: "Passeggiata domenicale in gruppo", en: "Sunday group walk" },
    d: { fr: "Chaque semaine, une balade tranquille d'une heure pour découvrir la région et faire connaissance. Ouvert à toutes et à tous, rythme doux.",
         de: "Jede Woche ein gemütlicher, einstündiger Spaziergang, um die Gegend zu entdecken und sich kennenzulernen. Offen für alle, gemächliches Tempo.",
         it: "Ogni settimana una passeggiata tranquilla di un'ora per scoprire la zona e conoscersi. Aperta a tutti, ritmo lento.",
         en: "A relaxed one-hour walk every week to explore the area and meet people. Open to everyone, gentle pace." } },
  { c: "other", ty: "request", pay: "negotiable", amt: 0, unit: "total", dur: 60,
    t: { fr: "Aide pour ma déclaration d'impôts", de: "Hilfe bei der Steuererklärung", it: "Aiuto per la dichiarazione d'imposta", en: "Help with my tax return" },
    d: { fr: "Je viens d'arriver dans le canton et je ne comprends pas bien le formulaire de déclaration d'impôts. Quelqu'un d'expérimenté pourrait-il m'expliquer ?",
         de: "Ich bin neu im Kanton und verstehe das Formular der Steuererklärung nicht ganz. Könnte mir jemand mit Erfahrung helfen?",
         it: "Sono appena arrivato nel cantone e non capisco bene il modulo della dichiarazione d'imposta. Qualcuno con esperienza potrebbe spiegarmelo?",
         en: "I've just moved to the canton and don't quite understand the tax return form. Could someone experienced walk me through it?" } },
  { c: "other", ty: "offer", pay: "paid", amt: 20, unit: "hour", dur: 120,
    t: { fr: "Cours de cuisine italienne à domicile", de: "Italienischer Kochkurs bei Ihnen zu Hause", it: "Corso di cucina italiana a domicilio", en: "Italian cooking class at your home" },
    d: { fr: "Pâtes fraîches, risotto, tiramisu : je vous apprends les recettes de ma nonna dans votre cuisine. Pour 1 à 4 personnes.",
         de: "Frische Pasta, Risotto, Tiramisu: Ich zeige Ihnen die Rezepte meiner Nonna in Ihrer Küche. Für 1 bis 4 Personen.",
         it: "Pasta fresca, risotto, tiramisù: vi insegno le ricette della nonna nella vostra cucina. Da 1 a 4 persone.",
         en: "Fresh pasta, risotto, tiramisu: I'll teach you my nonna's recipes in your own kitchen. For 1 to 4 people." } },
  { c: "seniors", ty: "offer", pay: "free", amt: 0, unit: "total", dur: 60, rec: "weekly",
    t: { fr: "Lecture à voix haute", de: "Vorlesen für Seniorinnen und Senioren", it: "Lettura ad alta voce", en: "Reading aloud" },
    d: { fr: "J'aime lire et je propose de faire la lecture du journal ou d'un roman aux personnes malvoyantes ou qui apprécient simplement la compagnie.",
         de: "Ich lese gerne und biete an, Zeitung oder Romane für sehbehinderte Menschen oder alle, die Gesellschaft schätzen, vorzulesen.",
         it: "Mi piace leggere e propongo di leggere il giornale o un romanzo a persone ipovedenti o a chi apprezza un po' di compagnia.",
         en: "I love reading and can read the newspaper or a novel to people with impaired vision, or anyone who enjoys some company." } },
];

/** Prénoms et noms réalistes selon la région linguistique. */
const NAMES = {
  fr: {
    first: ["Léa", "Camille", "Chloé", "Manon", "Julie", "Sophie", "Élodie", "Nathalie", "Lucas", "Thomas", "Nicolas", "Julien", "Mathieu", "Olivier", "Antoine", "Yves", "Pascal", "Aline", "Céline", "Karim", "Amélie", "Loïc", "Inès", "Samuel"],
    last: ["Favre", "Rochat", "Bonvin", "Dubois", "Perrin", "Jaquet", "Monnier", "Chappuis", "Pittet", "Rey", "Mottier", "Cuendet", "Aebischer", "Berset", "Gashi", "Da Silva", "Nguyen", "Morel"],
  },
  de: {
    first: ["Anna", "Laura", "Sarah", "Lea", "Nina", "Sandra", "Ursula", "Monika", "Luca", "Noah", "Jonas", "David", "Daniel", "Marco", "Stefan", "Reto", "Beat", "Thomas", "Fabienne", "Mia", "Leon", "Arben", "Selin", "Elias"],
    last: ["Müller", "Meier", "Schmid", "Keller", "Weber", "Huber", "Schneider", "Brunner", "Baumann", "Fischer", "Gerber", "Steiner", "Frei", "Graf", "Krasniqi", "Ferreira", "Yilmaz", "Bühler"],
  },
  it: {
    first: ["Giulia", "Chiara", "Sara", "Martina", "Francesca", "Elena", "Luca", "Marco", "Matteo", "Davide", "Andrea", "Paolo", "Giorgio", "Sofia", "Alessandro", "Noemi"],
    last: ["Bernasconi", "Rossi", "Ferrari", "Bianchi", "Lombardi", "Galli", "Fontana", "Pedrazzini", "Rezzonico", "Colombo", "Moretti", "Guidi"],
  },
};

const SPECIALTY_POOL = {
  shopping: ["courses", "Einkaufen", "spesa", "errands"],
  pets: ["animaux", "Tiere", "animali", "pets"],
  seniors: ["accompagnement", "Begleitung", "compagnia", "companionship"],
  family: ["enfants", "Kinder", "bambini", "childcare"],
  transport: ["transport", "Fahrdienst", "trasporti", "driving"],
  repair: ["bricolage", "Handwerk", "fai da te", "DIY"],
  digital: ["informatique", "Informatik", "informatica", "IT"],
  language: ["langues", "Sprachen", "lingue", "languages"],
  garden: ["jardinage", "Gartenarbeit", "giardinaggio", "gardening"],
  home: ["ménage", "Haushalt", "casa", "housekeeping"],
  moving: ["déménagement", "Umzug", "trasloco", "moving"],
  donation: ["récup'", "Recycling", "riuso", "reuse"],
  community: ["vie de quartier", "Quartier", "quartiere", "community"],
  other: ["cuisine", "Kochen", "cucina", "cooking"],
};

return { normalize, searchLocalities, findLocality, LANGS, CANTONS, CANTON_CODES, LOCALITIES, SWITZERLAND_CENTER, CATEGORIES, CATEGORY_IDS, getCategory, TYPES, PAYMENTS, UNITS, DURATIONS, RECURRENCES, TEMPLATES, NAMES, SPECIALTY_POOL };
});
__def("i18n.js", function () {
/* =====================================================================
   TRADUCTIONS (français, allemand, italien, anglais)
   Les textes sont dans translations.js. Ici : la logique.
   ===================================================================== */
const { DICT } = __req("translations.js");
const { storage } = __req("util.js");
const { LANGS, CANTONS, getCategory } = __req("data.js");

const LOCALES = { fr: "fr-CH", de: "de-CH", it: "it-CH", en: "en-GB" };

function detectLanguage() {
  const saved = storage.get("prefs", {}).lang;
  if (LANGS.includes(saved)) return saved;
  for (const l of navigator.languages || [navigator.language || "fr"]) {
    const code = String(l).slice(0, 2).toLowerCase();
    if (LANGS.includes(code)) return code;
  }
  return "fr";
}

let current = detectLanguage();
const missing = new Set();

const getLang = () => current;
const locale = () => LOCALES[current];

function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  current = lang;
  const prefs = storage.get("prefs", {});
  storage.set("prefs", { ...prefs, lang });
  document.documentElement.lang = lang;
}

/** Traduit une clé. Les {variables} sont remplacées par les paramètres.
 *  Pluriel : t("x", {count}) cherche "x.one" / "x.other". */
function t(key, params = {}) {
  let k = key;
  if (typeof params.count === "number") {
    const plural = params.count === 1 ? `${key}.one` : `${key}.other`;
    if (DICT[current]?.[plural] !== undefined || DICT.fr[plural] !== undefined) k = plural;
  }
  let text = DICT[current]?.[k];
  if (text === undefined) {
    text = DICT.fr[k];
    if (!missing.has(`${current}:${k}`)) {
      missing.add(`${current}:${k}`);
      console.warn(`[i18n] clé manquante: ${current}:${k}`);
    }
  }
  if (text === undefined) return key;
  return String(text).replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`));
}

/** Texte multilingue {fr,de,it,en} ou simple chaîne. */
function pick(value) {
  if (value && typeof value === "object") return value[current] || value.fr || Object.values(value)[0] || "";
  return value ?? "";
}

const cantonName = (code) => (CANTONS[code] ? CANTONS[code][current] : code || "");
const categoryName = (id) => getCategory(id)[current];

const languageName = (code) => t(`lang.${code}`);

/* ----------------------------- FORMATS ----------------------------- */

function fmtDate(date, options = { day: "numeric", month: "long", year: "numeric" }) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale(), options).format(d);
}

function fmtShortDate(date) {
  return fmtDate(date, { weekday: "short", day: "numeric", month: "short" });
}

function fmtTime(date) {
  return fmtDate(date, { hour: "2-digit", minute: "2-digit" });
}

/** "il y a 3 heures", "hier"… */
function fmtRelative(date) {
  const d = date instanceof Date ? date : new Date(date);
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return fmtDate(d, { day: "numeric", month: "short" });
}

function fmtNumber(n) {
  return new Intl.NumberFormat(locale()).format(n);
}

/** Montant en francs suisses : "CHF 25.–" (convention suisse). */
function fmtCHF(amount) {
  const n = Number(amount) || 0;
  return Number.isInteger(n) ? `CHF ${fmtNumber(n)}.–` : `CHF ${n.toFixed(2)}`;
}

function fmtDuration(minutes) {
  const m = Number(minutes) || 0;
  if (!m) return t("common.flexible");
  if (m >= 480) return t("duration.day");
  if (m >= 240 && m % 60 === 0 && m < 480) return t("duration.half");
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h && rest) return `${h} h ${rest}`;
  if (h) return `${h} h`;
  return `${rest} min`;
}

function fmtDistance(km) {
  if (km === null || km === undefined) return "";
  if (km < 1) return "< 1 km";
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

return { setLang, t, pick, fmtDate, fmtShortDate, fmtTime, fmtRelative, fmtNumber, fmtCHF, fmtDuration, fmtDistance, getLang, locale, cantonName, categoryName, languageName };
});
__def("seed.js", function () {
/* =====================================================================
   DONNÉES DE DÉMONSTRATION
   ---------------------------------------------------------------------
   Les annonces d'exemple sont générées avec une "graine" fixe : tout le
   monde voit exactement les mêmes annonces, sur tous les appareils.
   => un lien partagé (#/annonce/d42) mène à la même annonce chez un ami.
   Elles sont clairement signalées comme fictives dans l'interface.
   ===================================================================== */
const { LOCALITIES, TEMPLATES, NAMES, SPECIALTY_POOL, LANGS, CATEGORY_IDS } = __req("data.js");
const { seededRandom, dateKey } = __req("util.js");

const DEMO_COUNT = 420;
const BIG_CITIES = new Set(["Zürich", "Genève", "Basel", "Lausanne", "Bern", "Winterthur", "Luzern", "St. Gallen", "Lugano", "Biel/Bienne", "Fribourg", "Neuchâtel", "Sion"]);

const BIOS = {
  fr: ["J'habite le quartier depuis {n} ans et j'aime rendre service.", "Toujours partant·e pour un coup de main entre voisins !", "Parent de deux enfants, je crois beaucoup à l'entraide locale.", "Retraité·e actif·ve, j'ai du temps à partager."],
  de: ["Ich wohne seit {n} Jahren im Quartier und helfe gerne.", "Immer bereit für Nachbarschaftshilfe!", "Mutter/Vater von zwei Kindern – ich glaube an lokale Solidarität.", "Aktiv pensioniert, ich habe Zeit zu teilen."],
  it: ["Abito nel quartiere da {n} anni e mi piace dare una mano.", "Sempre pronto/a ad aiutare i vicini!", "Genitore di due figli, credo molto nell'aiuto reciproco.", "Pensionato/a attivo/a, ho tempo da condividere."],
};

let cache = null;

/** Génère (une seule fois) les membres et annonces de démonstration. */
function getDemoData() {
  if (cache) return cache;
  const r = seededRandom(20260622);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];

  // Localités pondérées : les grandes villes ont plus d'annonces.
  const weighted = [];
  LOCALITIES.forEach((loc) => {
    const w = BIG_CITIES.has(loc.name) ? 5 : 1;
    for (let i = 0; i < w; i++) weighted.push(loc);
  });

  const authors = [];
  const byLocality = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function createAuthor(loc) {
    const lang = loc.lang === "it" ? "it" : loc.lang === "de" ? "de" : "fr";
    const first = pick(NAMES[lang].first);
    const last = pick(NAMES[lang].last);
    const cats = [pick(CATEGORY_IDS), pick(CATEGORY_IDS)];
    const specialties = [...new Set(cats.map((c) => SPECIALTY_POOL[c][LANGS.indexOf(lang)]))];
    const since = new Date(today.getTime() - Math.floor(30 + r() * 900) * 86400000);
    const author = {
      id: `du${authors.length + 1}`,
      demo: true,
      firstname: first,
      lastname: last,
      city: loc.name,
      canton: loc.canton,
      lang,
      verified: r() > 0.3,
      rating: Math.round((4.2 + r() * 0.8) * 10) / 10,
      reviews: Math.floor(r() * 60),
      completed: Math.floor(r() * 40),
      created: since.toISOString(),
      specialties,
      languages: lang === "fr" ? ["fr", r() > 0.6 ? "de" : "en"] : lang === "de" ? ["de", r() > 0.5 ? "fr" : "en"] : ["it", r() > 0.5 ? "fr" : "de"],
      bio: pick(BIOS[lang]).replace("{n}", String(2 + Math.floor(r() * 20))),
    };
    authors.push(author);
    if (!byLocality.has(loc.name)) byLocality.set(loc.name, []);
    byLocality.get(loc.name).push(author);
    return author;
  }

  const listings = [];
  for (let i = 1; i <= DEMO_COUNT; i++) {
    const loc = pick(weighted);
    const locals = byLocality.get(loc.name) || [];
    const author = locals.length && r() < 0.45 ? pick(locals) : createAuthor(loc);
    const tpl = pick(TEMPLATES);

    const createdDaysAgo = Math.floor(r() * 30);
    const created = new Date(Date.now() - createdDaysAgo * 86400000 - Math.floor(r() * 12) * 3600000);
    const hasDate = r() > 0.15;
    const eventDate = new Date(today.getTime() + (1 + Math.floor(r() * 45)) * 86400000);
    const hour = 8 + Math.floor(r() * 12);
    const minute = r() > 0.5 ? "30" : "00";
    let amount = tpl.amt;
    if (tpl.pay === "paid") amount = Math.max(5, tpl.amt + Math.round((r() - 0.5) * 4) * 5);

    listings.push({
      id: `d${i}`,
      demo: true,
      authorId: author.id,
      type: tpl.ty,
      category: tpl.c,
      title: tpl.t,
      description: tpl.d,
      payment: tpl.pay,
      amount: tpl.pay === "paid" ? amount : null,
      unit: tpl.unit,
      date: hasDate ? dateKey(eventDate) : null,
      time: hasDate ? `${String(hour).padStart(2, "0")}:${minute}` : null,
      duration: tpl.dur,
      recurrence: tpl.rec || "once",
      urgent: r() < 0.08,
      city: loc.name,
      npa: loc.npa,
      canton: loc.canton,
      // Position floutée (±1,5 km) : jamais l'adresse exacte.
      lat: Math.round((loc.lat + (r() - 0.5) * 0.028) * 10000) / 10000,
      lng: Math.round((loc.lng + (r() - 0.5) * 0.04) * 10000) / 10000,
      languages: author.languages,
      photos: [],
      created: created.toISOString(),
      status: "active",
      views: 5 + Math.floor(r() * 180),
    });
  }

  cache = { authors, listings, authorsById: new Map(authors.map((a) => [a.id, a])) };
  return cache;
}

return { getDemoData };
});
__def("auth.js", function () {
/* =====================================================================
   SÉCURITÉ DES COMPTES
   ---------------------------------------------------------------------
   - Les mots de passe ne sont JAMAIS enregistrés : on garde seulement une
     "empreinte" PBKDF2-SHA256 (600 000 itérations + sel aléatoire, norme
     recommandée par l'OWASP). Impossible de retrouver le mot de passe.
   - La session ne contient qu'un identifiant et une date d'expiration.
   - Après 5 essais ratés, la connexion est bloquée temporairement
     (protection contre les attaques par force brute).

   LIMITE (honnête) : ce prototype n'a pas de serveur. Tout se passe dans
   le navigateur ; pour un vrai lancement, ces contrôles doivent être faits
   sur un serveur (voir docs/SECURITE.md).
   ===================================================================== */
const { storage, uid } = __req("util.js");

const ITERATIONS = 600000;
const SESSION_DAYS = 14;

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Calcule l'empreinte d'un mot de passe. */
async function hashPassword(password, saltB64 = null, iterations = ITERATIONS) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return { algo: "PBKDF2-SHA256", iterations, salt: toB64(salt), hash: toB64(bits) };
}

/** Comparaison en temps constant (évite les attaques temporelles). */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyPassword(password, record) {
  if (!record || !record.salt || !record.hash) return false;
  const computed = await hashPassword(password, record.salt, record.iterations || ITERATIONS);
  return safeEqual(computed.hash, record.hash);
}

/* Compte administrateur de démonstration (demandé pour le projet).
   Identifiant : admin — le mot de passe n'apparaît PAS dans le code :
   seule son empreinte PBKDF2 est présente. */
const ADMIN_ACCOUNT = {
  id: "admin",
  email: "admin@voisina.ch",
  firstname: "Équipe",
  lastname: "Voisina",
  role: "admin",
  verified: true,
  city: "Yverdon-les-Bains",
  canton: "VD",
  languages: ["fr", "de", "it", "en"],
  specialties: [],
  bio: "",
  created: "2026-01-01T00:00:00.000Z",
  password: {
    algo: "PBKDF2-SHA256",
    iterations: 600000,
    salt: "jIBAzr+12tTP0RjGBPxuYg==",
    hash: "oE2TyT3mXGdo87J/zcdjBDy+P0LwYMkGl3nu1LZwVLo=",
  },
};

/* ---------------------- Mots de passe : règles ---------------------- */
const COMMON = ["12345678", "123456789", "1234567890", "password", "motdepasse", "passwort", "azertyuiop", "qwertzuiop", "qwertyuiop", "11111111", "00000000", "iloveyou", "voisina123", "switzerland", "suisse123", "schweiz123", "admin123", "password1", "abcdefgh"];

/** Retourne un score de 0 à 4 et la liste des problèmes. */
function passwordStrength(pw, context = []) {
  const value = String(pw || "");
  const issues = [];
  if (value.length < 10) issues.push("length");
  const lower = value.toLowerCase();
  if (COMMON.includes(lower) || context.some((c) => c && c.length > 2 && lower.includes(String(c).toLowerCase()))) issues.push("common");
  let variety = 0;
  if (/[a-z]/.test(value)) variety++;
  if (/[A-Z]/.test(value)) variety++;
  if (/\d/.test(value)) variety++;
  if (/[^A-Za-z0-9]/.test(value)) variety++;
  // Une longue phrase de passe (16+ caractères) est acceptée même sans chiffres/symboles.
  if (variety < 3 && value.length < 16) issues.push("variety");
  let score = 0;
  if (value.length >= 10) score++;
  if (value.length >= 14) score++;
  if (variety >= 3) score++;
  if (variety === 4) score++;
  if (issues.includes("common")) score = 0;
  return { score: Math.min(4, score), issues, ok: !issues.length };
}

/* ---------------------- Anti force brute ---------------------- */
function loginLock() {
  const state = storage.get("loginGuard", { fails: 0, until: 0 });
  const remaining = Math.max(0, Math.ceil((state.until - Date.now()) / 1000));
  return { ...state, remaining };
}

function registerFailure() {
  const state = storage.get("loginGuard", { fails: 0, until: 0 });
  const fails = state.fails + 1;
  let until = 0;
  if (fails >= 5) until = Date.now() + Math.min(15 * 60, 30 * 2 ** (fails - 5)) * 1000;
  storage.set("loginGuard", { fails, until });
}

function resetFailures() {
  storage.set("loginGuard", { fails: 0, until: 0 });
}

/* ---------------------- Session ---------------------- */
function createSession(userId) {
  const session = { id: uid("s_"), userId, created: Date.now(), expires: Date.now() + SESSION_DAYS * 86400000 };
  storage.set("session", session);
  return session;
}

function readSession() {
  const s = storage.get("session", null);
  if (!s || typeof s.userId !== "string" || typeof s.expires !== "number") return null;
  if (s.expires < Date.now()) {
    storage.remove("session");
    return null;
  }
  return s;
}

function destroySession() {
  storage.remove("session");
}

function isValidEmail(email) {
  return /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i.test(String(email || "")) && String(email).length <= 120;
}

return { hashPassword, verifyPassword, passwordStrength, loginLock, registerFailure, resetFailures, createSession, readSession, destroySession, isValidEmail, ADMIN_ACCOUNT };
});
__def("store.js", function () {
/* =====================================================================
   COUCHE DE DONNÉES
   ---------------------------------------------------------------------
   C'est le SEUL fichier qui lit/écrit les données. Les pages passent
   toujours par ces fonctions. Pour brancher un vrai serveur plus tard
   (ex. Supabase), il suffira de réécrire ce fichier (voir docs/).

   Toutes les données saisies sont VALIDÉES et NETTOYÉES ici, même si le
   formulaire les a déjà vérifiées (principe : ne jamais faire confiance
   aux données reçues).
   ===================================================================== */
const { storage, uid, safeImageSrc, distanceKm, parseDateKey, todayKey } = __req("util.js");
const { getDemoData } = __req("seed.js");
const { CANTON_CODES, CATEGORY_IDS, TYPES, PAYMENTS, UNITS, DURATIONS, RECURRENCES, LANGS, LOCALITIES } = __req("data.js");
const { ADMIN_ACCOUNT, hashPassword, verifyPassword, createSession, readSession, destroySession, loginLock, registerFailure, resetFailures, isValidEmail, passwordStrength } = __req("auth.js");
const { t, getLang, categoryName } = __req("i18n.js");

/* ------------------------- Abonnements -------------------------- */
const listeners = new Set();
function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(kind = "data") { listeners.forEach((fn) => { try { fn(kind); } catch (e) { console.error(e); } }); }

/* ------------------------- Nettoyage ---------------------------- */
/** Supprime les caractères de contrôle et limite la longueur. */
function cleanText(value, max = 500, multiline = false) {
  let s = String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, "");
  s = multiline ? s.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  return s.trim().slice(0, max);
}

const inSwitzerland = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat > 45.7 && lat < 47.95 && lng > 5.8 && lng < 10.6;

/* ============================ UTILISATEURS ============================ */
const getStoredUsers = () => {
  const users = storage.get("users", []);
  return Array.isArray(users) ? users : [];
};
const saveUsers = (users) => storage.set("users", users);

function findUserRecord(id) {
  if (id === ADMIN_ACCOUNT.id) {
    const override = storage.get("adminProfile", {});
    return { ...ADMIN_ACCOUNT, ...override, password: ADMIN_ACCOUNT.password };
  }
  return getStoredUsers().find((u) => u.id === id) || null;
}

/** Utilisateur connecté (sans son empreinte de mot de passe). */
function currentUser() {
  const session = readSession();
  if (!session) return null;
  const user = findUserRecord(session.userId);
  if (!user) { destroySession(); return null; }
  const { password, ...safe } = user;
  return safe;
}

const isAdmin = () => currentUser()?.role === "admin";

/** Nom affiché publiquement : prénom + initiale (protection de la vie privée). */
function displayName(person) {
  if (!person) return t("common.formerMember");
  const initial = person.lastname ? ` ${person.lastname.trim()[0].toUpperCase()}.` : "";
  return `${person.firstname}${initial}`;
}

/** Profil public d'une personne (membre démo, membre local ou admin). */
function getPerson(id) {
  const demo = getDemoData().authorsById.get(id);
  if (demo) return { ...demo, name: displayName(demo) };
  const user = findUserRecord(id);
  if (!user) return null;
  const listings = allListingsRaw().filter((l) => l.authorId === id);
  return {
    id: user.id,
    demo: false,
    firstname: user.firstname,
    lastname: user.lastname,
    name: displayName(user),
    city: user.city,
    canton: user.canton,
    verified: !!user.verified,
    role: user.role || "user",
    rating: null,
    reviews: 0,
    completed: listings.filter((l) => l.status === "done").length,
    created: user.created,
    specialties: user.specialties || [],
    languages: user.languages || [],
    bio: user.bio || "",
    photo: safeImageSrc(user.photo),
  };
}

async function register(input) {
  const firstname = cleanText(input.firstname, 40);
  const lastname = cleanText(input.lastname, 40);
  const email = cleanText(input.email, 120).toLowerCase();
  const errors = {};
  if (firstname.length < 2) errors.firstname = "required";
  if (lastname.length < 2) errors.lastname = "required";
  if (!isValidEmail(email)) errors.email = "email";
  if (email === ADMIN_ACCOUNT.email || email === "admin" || getStoredUsers().some((u) => u.email === email)) errors.email = "taken";
  const strength = passwordStrength(input.password, [firstname, lastname, email.split("@")[0]]);
  if (!strength.ok) errors.password = "weak";
  if (input.password !== input.passwordConfirm) errors.passwordConfirm = "mismatch";
  const loc = LOCALITIES.find((l) => l.name === input.city) || null;
  const canton = CANTON_CODES.includes(input.canton) ? input.canton : loc?.canton;
  if (!canton) errors.city = "required";
  if (!input.terms) errors.terms = "required";
  if (Object.keys(errors).length) return { ok: false, errors };

  const user = {
    id: uid("u_"),
    email,
    firstname,
    lastname,
    city: cleanText(input.city, 60),
    canton,
    languages: [getLang()],
    specialties: [],
    bio: "",
    photo: "",
    role: "user",
    verified: false,
    blocked: [],
    created: new Date().toISOString(),
    password: await hashPassword(input.password),
  };
  const users = getStoredUsers();
  users.push(user);
  if (!saveUsers(users)) return { ok: false, errors: { form: "quota" } };
  createSession(user.id);
  addNotification(user.id, { kind: "welcome", link: "#/compte" });
  emit("auth");
  return { ok: true, user };
}

async function login(identifier, password) {
  const lock = loginLock();
  if (lock.remaining > 0) return { ok: false, error: "locked", remaining: lock.remaining };
  const id = cleanText(identifier, 120).toLowerCase();
  let record = null;
  if (id === "admin" || id === ADMIN_ACCOUNT.email) record = ADMIN_ACCOUNT;
  else record = getStoredUsers().find((u) => u.email === id) || null;

  // On calcule toujours une empreinte, même si le compte n'existe pas :
  // le temps de réponse ne révèle donc pas si l'e-mail est inscrit.
  const valid = record ? await verifyPassword(password, record.password) : (await hashPassword(String(password || "x")), false);
  if (!valid) {
    registerFailure();
    const after = loginLock();
    return { ok: false, error: after.remaining > 0 ? "locked" : "invalid", remaining: after.remaining };
  }
  resetFailures();
  createSession(record.id);
  emit("auth");
  return { ok: true };
}

function logout() {
  destroySession();
  emit("auth");
}

function updateUserRecord(id, updater) {
  if (id === ADMIN_ACCOUNT.id) {
    const current = storage.get("adminProfile", {});
    const next = updater({ ...ADMIN_ACCOUNT, ...current });
    const { password, id: _i, email, role, ...profile } = next;
    storage.set("adminProfile", profile);
    return true;
  }
  const users = getStoredUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index < 0) return false;
  users[index] = updater(users[index]);
  return saveUsers(users);
}

function updateProfile(patch) {
  const me = currentUser();
  if (!me) return { ok: false };
  const loc = patch.city !== undefined ? LOCALITIES.find((l) => l.name === patch.city) : null;
  const ok = updateUserRecord(me.id, (u) => ({
    ...u,
    firstname: patch.firstname !== undefined ? cleanText(patch.firstname, 40) || u.firstname : u.firstname,
    lastname: patch.lastname !== undefined ? cleanText(patch.lastname, 40) || u.lastname : u.lastname,
    city: patch.city !== undefined ? cleanText(patch.city, 60) || u.city : u.city,
    canton: loc ? loc.canton : CANTON_CODES.includes(patch.canton) ? patch.canton : u.canton,
    bio: patch.bio !== undefined ? cleanText(patch.bio, 400, true) : u.bio,
    languages: Array.isArray(patch.languages) ? patch.languages.filter((l) => LANGS.includes(l)) : u.languages,
    specialties: Array.isArray(patch.specialties) ? patch.specialties.map((s) => cleanText(s, 30)).filter(Boolean).slice(0, 8) : u.specialties,
    photo: patch.photo !== undefined ? safeImageSrc(patch.photo) : u.photo,
  }));
  if (!ok) return { ok: false, error: "quota" };
  emit("profile");
  return { ok: true };
}

async function changePassword(oldPassword, newPassword) {
  const me = currentUser();
  if (!me || me.role === "admin") return { ok: false, error: "forbidden" };
  const record = findUserRecord(me.id);
  if (!(await verifyPassword(oldPassword, record.password))) return { ok: false, error: "invalid" };
  if (!passwordStrength(newPassword, [me.firstname, me.lastname]).ok) return { ok: false, error: "weak" };
  const password = await hashPassword(newPassword);
  updateUserRecord(me.id, (u) => ({ ...u, password }));
  return { ok: true };
}

/** Droit à l'effacement (nLPD) : supprime le compte et toutes ses données. */
async function deleteAccount(password) {
  const me = currentUser();
  if (!me || me.role === "admin") return { ok: false, error: "forbidden" };
  const record = findUserRecord(me.id);
  if (!(await verifyPassword(password, record.password))) return { ok: false, error: "invalid" };
  saveUsers(getStoredUsers().filter((u) => u.id !== me.id));
  storage.set("listings", getUserListings().filter((l) => l.authorId !== me.id));
  storage.set("conversations", getConversationsRaw().filter((c) => !c.participants.includes(me.id)));
  const favs = storage.get("favorites", {});
  delete favs[me.id];
  storage.set("favorites", favs);
  const notifs = storage.get("notifications", {});
  delete notifs[me.id];
  storage.set("notifications", notifs);
  destroySession();
  bump();
  emit("auth");
  return { ok: true };
}

/** Droit d'accès / portabilité (nLPD) : export de toutes mes données. */
function exportMyData() {
  const me = currentUser();
  if (!me) return null;
  return {
    exportedAt: new Date().toISOString(),
    service: "Voisina (prototype)",
    profile: me,
    listings: getUserListings().filter((l) => l.authorId === me.id),
    favorites: getFavorites(),
    conversations: getConversationsRaw().filter((c) => c.participants.includes(me.id)),
    reports: getReports().filter((r) => r.by === me.id),
    notifications: getNotifications(),
  };
}

function toggleBlock(personId) {
  const me = currentUser();
  if (!me || personId === me.id) return false;
  let blockedNow = false;
  updateUserRecord(me.id, (u) => {
    const list = new Set(u.blocked || []);
    if (list.has(personId)) list.delete(personId);
    else { list.add(personId); blockedNow = true; }
    return { ...u, blocked: [...list] };
  });
  bump();
  emit("block");
  return blockedNow;
}

const isBlocked = (personId) => (currentUser()?.blocked || []).includes(personId);

function getAllUsersForAdmin() {
  if (!isAdmin()) return [];
  return getStoredUsers().map(({ password, ...u }) => u);
}

/* ============================== ANNONCES ============================== */
let version = 0;
let listingsCache = null;
function bump() { version++; listingsCache = null; }

const getUserListings = () => {
  const list = storage.get("listings", []);
  return Array.isArray(list) ? list : [];
};

function getModeration() {
  return storage.get("moderation", { hidden: [] });
}

/** Toutes les annonces (démo + membres), sans filtre de blocage. */
function allListingsRaw() {
  if (listingsCache) return listingsCache;
  const hidden = new Set(getModeration().hidden || []);
  const demo = getDemoData().listings.map((l) => (hidden.has(l.id) ? { ...l, status: "hidden" } : l));
  const users = getUserListings().map((l) => (hidden.has(l.id) ? { ...l, status: "hidden" } : l));
  listingsCache = [...users, ...demo];
  return listingsCache;
}

/** Annonces visibles par l'utilisateur actuel. */
function allListings({ includeInactive = false } = {}) {
  const blocked = new Set(currentUser()?.blocked || []);
  return allListingsRaw().filter((l) => (includeInactive || l.status === "active") && !blocked.has(l.authorId));
}

function getListing(id) {
  return allListingsRaw().find((l) => l.id === String(id)) || null;
}

const listingsByAuthor = (authorId, opts) => allListings(opts).filter((l) => l.authorId === authorId);

/** Valide et nettoie une annonce. Retourne { data } ou { errors }. */
function validateListing(input) {
  const errors = {};
  const title = cleanText(input.title, 90);
  const description = cleanText(input.description, 1500, true);
  if (title.length < 5) errors.title = "min5";
  if (description.length < 20) errors.description = "min20";
  if (!TYPES.includes(input.type)) errors.type = "required";
  if (!CATEGORY_IDS.includes(input.category)) errors.category = "required";
  if (!PAYMENTS.includes(input.payment)) errors.payment = "required";
  const loc = LOCALITIES.find((l) => l.name === input.city);
  const lat = Number(input.lat ?? loc?.lat);
  const lng = Number(input.lng ?? loc?.lng);
  const canton = CANTON_CODES.includes(input.canton) ? input.canton : loc?.canton;
  if (!input.city || !canton || !inSwitzerland(lat, lng)) errors.city = "location";
  let amount = null;
  if (input.payment === "paid") {
    amount = Math.round(Number(input.amount) * 2) / 2;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) errors.amount = "amount";
  }
  let date = null;
  let time = null;
  if (input.date) {
    const d = parseDateKey(input.date);
    const max = new Date();
    max.setFullYear(max.getFullYear() + 1);
    if (!d || input.date < todayKey() || d > max) errors.date = "date";
    else date = input.date;
    if (input.time) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) errors.time = "time";
      else time = input.time;
    }
  }
  const duration = DURATIONS.includes(Number(input.duration)) ? Number(input.duration) : null;
  const photos = (Array.isArray(input.photos) ? input.photos : []).map(safeImageSrc).filter(Boolean).slice(0, 3);
  const npa = /^\d{4}$/.test(String(input.npa || "")) ? String(input.npa) : loc?.npa || "";

  if (Object.keys(errors).length) return { errors };
  // Position floutée autour du centre de la localité (jamais l'adresse exacte).
  const jitter = () => (Math.random() - 0.5) * 0.02;
  return {
    data: {
      type: input.type,
      category: input.category,
      title,
      description,
      lang: LANGS.includes(input.lang) ? input.lang : getLang(),
      payment: input.payment,
      amount,
      unit: UNITS.includes(input.unit) ? input.unit : "total",
      date,
      time,
      duration,
      recurrence: RECURRENCES.includes(input.recurrence) ? input.recurrence : "once",
      urgent: !!input.urgent,
      city: cleanText(input.city, 60),
      npa,
      canton,
      lat: Math.round((lat + jitter()) * 10000) / 10000,
      lng: Math.round((lng + jitter()) * 10000) / 10000,
      languages: (Array.isArray(input.languages) ? input.languages : []).filter((l) => LANGS.includes(l)),
      photos,
    },
  };
}

function createListing(input) {
  const me = currentUser();
  if (!me) return { ok: false, errors: { form: "auth" } };
  const { data, errors } = validateListing(input);
  if (errors) return { ok: false, errors };
  const listing = { ...data, id: uid("u"), authorId: me.id, demo: false, created: new Date().toISOString(), status: "active", views: 0 };
  const list = getUserListings();
  list.unshift(listing);
  if (!storage.set("listings", list)) return { ok: false, errors: { form: "quota" } };
  bump();
  addNotification(me.id, { kind: "published", params: { title: listing.title }, link: `#/annonce/${listing.id}` });
  emit("listings");
  return { ok: true, listing };
}

function updateListing(id, input) {
  const me = currentUser();
  const list = getUserListings();
  const index = list.findIndex((l) => l.id === id);
  if (!me || index < 0 || (list[index].authorId !== me.id && me.role !== "admin")) return { ok: false, errors: { form: "forbidden" } };
  const { data, errors } = validateListing(input);
  if (errors) return { ok: false, errors };
  // On garde la position existante si la localité n'a pas changé.
  if (list[index].city === data.city) { data.lat = list[index].lat; data.lng = list[index].lng; }
  list[index] = { ...list[index], ...data, updated: new Date().toISOString() };
  if (!storage.set("listings", list)) return { ok: false, errors: { form: "quota" } };
  bump();
  emit("listings");
  return { ok: true, listing: list[index] };
}

function setListingStatus(id, status) {
  const me = currentUser();
  const list = getUserListings();
  const index = list.findIndex((l) => l.id === id);
  if (!me || index < 0 || (list[index].authorId !== me.id && me.role !== "admin")) return false;
  if (!["active", "done"].includes(status)) return false;
  list[index] = { ...list[index], status };
  storage.set("listings", list);
  bump();
  emit("listings");
  return true;
}

function deleteListing(id) {
  const me = currentUser();
  const list = getUserListings();
  const target = list.find((l) => l.id === id);
  if (!me || !target || (target.authorId !== me.id && me.role !== "admin")) return false;
  storage.set("listings", list.filter((l) => l.id !== id));
  bump();
  emit("listings");
  return true;
}

/** Recherche + filtres + tri. `origin` = point de référence pour la distance. */
function searchListings(f = {}, origin = null) {
  const q = String(f.q || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = q.split(/\s+/).filter(Boolean);
  const lang = getLang();
  let results = allListings().map((l) => ({ listing: l, distance: origin ? distanceKm(origin, l) : null }));

  results = results.filter(({ listing: l, distance }) => {
    if (f.type && l.type !== f.type) return false;
    if (f.cat && l.category !== f.cat) return false;
    if (f.canton && l.canton !== f.canton) return false;
    if (f.pay && l.payment !== f.pay) return false;
    if (f.urgent && !l.urgent) return false;
    if (f.verified && !getPerson(l.authorId)?.verified) return false;
    if (f.radius && origin && distance !== null && distance > Number(f.radius)) return false;
    if (f.bounds) {
      const [s, w, n, e] = f.bounds;
      if (l.lat < s || l.lat > n || l.lng < w || l.lng > e) return false;
    }
    if (words.length) {
      const title = typeof l.title === "object" ? Object.values(l.title).join(" ") : l.title;
      const desc = typeof l.description === "object" ? l.description[lang] || "" : l.description;
      const hay = `${title} ${desc} ${l.city} ${l.npa} ${l.canton} ${categoryName(l.category)}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });

  const sort = f.sort || (origin ? "distance" : "recent");
  const byDate = (a, b) => new Date(b.listing.created) - new Date(a.listing.created);
  if (sort === "distance" && origin) results.sort((a, b) => a.distance - b.distance);
  else if (sort === "soon") results.sort((a, b) => (a.listing.date || "9999").localeCompare(b.listing.date || "9999") || (a.listing.time || "").localeCompare(b.listing.time || ""));
  else if (sort === "priceLow") results.sort((a, b) => (a.listing.amount || 0) - (b.listing.amount || 0));
  else if (sort === "priceHigh") results.sort((a, b) => (b.listing.amount || 0) - (a.listing.amount || 0));
  else results.sort(byDate);
  return results;
}

/* ============================== FAVORIS =============================== */
const favOwner = () => currentUser()?.id || "guest";

function getFavorites() {
  const all = storage.get("favorites", {});
  const list = all[favOwner()];
  return Array.isArray(list) ? list : [];
}

const isFavorite = (id) => getFavorites().includes(id);

function toggleFavorite(id) {
  if (!getListing(id)) return false;
  const all = storage.get("favorites", {});
  const owner = favOwner();
  const list = new Set(Array.isArray(all[owner]) ? all[owner] : []);
  const added = !list.has(id);
  if (added) list.add(id); else list.delete(id);
  all[owner] = [...list];
  storage.set("favorites", all);
  emit("favorites");
  return added;
}

function clearFavorites() {
  const all = storage.get("favorites", {});
  all[favOwner()] = [];
  storage.set("favorites", all);
  emit("favorites");
}

/** Au moment de la connexion, on fusionne les favoris "invité" dans le compte. */
function mergeGuestFavorites() {
  const me = currentUser();
  if (!me) return;
  const all = storage.get("favorites", {});
  if (!all.guest?.length) return;
  all[me.id] = [...new Set([...(all[me.id] || []), ...all.guest])];
  all.guest = [];
  storage.set("favorites", all);
}

/* ============================ MESSAGERIE ============================== */
function getConversationsRaw() {
  const list = storage.get("conversations", []);
  return Array.isArray(list) ? list : [];
}
const saveConversations = (list) => storage.set("conversations", list);

function getConversations() {
  const me = currentUser();
  if (!me) return [];
  const blocked = new Set(me.blocked || []);
  return getConversationsRaw()
    .filter((c) => c.participants.includes(me.id))
    .filter((c) => !blocked.has(c.participants.find((p) => p !== me.id)))
    .sort((a, b) => new Date(b.updated) - new Date(a.updated));
}

const getConversation = (id) => getConversations().find((c) => c.id === id) || null;

function otherParticipant(conv) {
  const me = currentUser();
  return conv.participants.find((p) => p !== me?.id);
}

function unreadCount(conv) {
  const me = currentUser();
  if (!me) return 0;
  const lastRead = conv.readBy?.[me.id] || 0;
  return conv.messages.filter((m) => m.from !== me.id && new Date(m.at).getTime() > lastRead).length;
}

const totalUnread = () => getConversations().reduce((sum, c) => sum + unreadCount(c), 0);

/** Ouvre (ou retrouve) la conversation liée à une annonce. */
function startConversation(listingId) {
  const me = currentUser();
  const listing = getListing(listingId);
  if (!me || !listing || listing.authorId === me.id) return null;
  const list = getConversationsRaw();
  let conv = list.find((c) => c.listingId === listingId && c.participants.includes(me.id));
  if (!conv) {
    conv = { id: uid("c_"), listingId, participants: [me.id, listing.authorId], messages: [], readBy: { [me.id]: Date.now() }, updated: new Date().toISOString(), created: new Date().toISOString() };
    list.push(conv);
    saveConversations(list);
    emit("messages");
  }
  return conv;
}

const typing = new Set();

function sendMessage(convId, text) {
  const me = currentUser();
  const body = cleanText(text, 1000, true);
  if (!me || !body) return { ok: false };
  const list = getConversationsRaw();
  const conv = list.find((c) => c.id === convId && c.participants.includes(me.id));
  if (!conv) return { ok: false };
  const now = new Date().toISOString();
  conv.messages.push({ id: uid("m_"), from: me.id, text: body, at: now });
  conv.updated = now;
  conv.readBy = { ...conv.readBy, [me.id]: Date.now() };
  if (!saveConversations(list)) return { ok: false, error: "quota" };
  const other = conv.participants.find((p) => p !== me.id);
  if (getDemoData().authorsById.has(other)) scheduleDemoReply(conv.id, other);
  else addNotification(other, { kind: "message", params: { name: displayName(me) }, link: `#/messages/${conv.id}` });
  emit("messages");
  return { ok: true };
}

const DEMO_REPLIES = {
  fr: ["Bonjour {name} ! Merci pour votre message. Oui, c'est toujours d'actualité 🙂 Quand seriez-vous disponible ?", "Parfait, ça me convient. Je vous propose qu'on se retrouve d'abord dans un lieu public, par exemple devant la gare de {city}.", "Super, merci beaucoup ! À bientôt."],
  de: ["Hallo {name}! Danke für Ihre Nachricht. Ja, das ist noch aktuell 🙂 Wann hätten Sie Zeit?", "Perfekt, das passt mir. Ich schlage vor, dass wir uns zuerst an einem öffentlichen Ort treffen, zum Beispiel beim Bahnhof {city}.", "Super, vielen Dank! Bis bald."],
  it: ["Buongiorno {name}! Grazie per il messaggio. Sì, è ancora attuale 🙂 Quando sarebbe disponibile?", "Perfetto, mi va bene. Propongo di incontrarci prima in un luogo pubblico, per esempio davanti alla stazione di {city}.", "Ottimo, grazie mille! A presto."],
  en: ["Hi {name}! Thanks for your message. Yes, it's still available 🙂 When would suit you?", "Perfect, that works for me. I suggest we first meet somewhere public, for example outside {city} station.", "Great, thank you so much! See you soon."],
};

function scheduleDemoReply(convId, authorId) {
  typing.add(convId);
  setTimeout(() => emit("typing"), 50);
  setTimeout(() => {
    typing.delete(convId);
    const list = getConversationsRaw();
    const conv = list.find((c) => c.id === convId);
    const me = currentUser();
    if (!conv || !me) { emit("messages"); return; }
    const theirs = conv.messages.filter((m) => m.from === authorId).length;
    const lines = DEMO_REPLIES[getLang()] || DEMO_REPLIES.fr;
    const listing = getListing(conv.listingId);
    const text = lines[Math.min(theirs, lines.length - 1)].replace("{name}", me.firstname).replace("{city}", listing?.city || "");
    const now = new Date().toISOString();
    conv.messages.push({ id: uid("m_"), from: authorId, text, at: now, auto: true });
    conv.updated = now;
    saveConversations(list);
    const author = getPerson(authorId);
    addNotification(me.id, { kind: "message", params: { name: author?.name || "" }, link: `#/messages/${convId}` });
    emit("messages");
  }, 1600 + Math.random() * 1200);
}

function markConversationRead(convId) {
  const me = currentUser();
  if (!me) return;
  const list = getConversationsRaw();
  const conv = list.find((c) => c.id === convId && c.participants.includes(me.id));
  if (!conv || unreadCount(conv) === 0) return;
  conv.readBy = { ...conv.readBy, [me.id]: Date.now() };
  saveConversations(list);
  emit("read");
}

function deleteConversation(convId) {
  const me = currentUser();
  if (!me) return;
  saveConversations(getConversationsRaw().filter((c) => !(c.id === convId && c.participants.includes(me.id))));
  emit("messages");
}

/* ============================ SIGNALEMENTS ============================ */
const REPORT_REASONS = ["scam", "inappropriate", "dangerous", "spam", "illegal", "other"];

function getReports() {
  const list = storage.get("reports", []);
  return Array.isArray(list) ? list : [];
}

function createReport({ targetType, targetId, reason, details }) {
  const me = currentUser();
  if (!["listing", "user", "conversation"].includes(targetType) || !REPORT_REASONS.includes(reason)) return false;
  const list = getReports();
  list.unshift({ id: uid("r_"), targetType, targetId: String(targetId), reason, details: cleanText(details, 500, true), by: me?.id || "guest", at: new Date().toISOString(), status: "open" });
  storage.set("reports", list.slice(0, 500));
  emit("reports");
  return true;
}

function resolveReport(id, action) {
  if (!isAdmin()) return false;
  const list = getReports();
  const report = list.find((r) => r.id === id);
  if (!report) return false;
  report.status = action === "hide" ? "actioned" : "dismissed";
  report.resolvedAt = new Date().toISOString();
  storage.set("reports", list);
  if (action === "hide" && report.targetType === "listing") setListingHidden(report.targetId, true);
  if (report.by && report.by !== "guest") addNotification(report.by, { kind: "reportDone", link: "#/" });
  emit("reports");
  return true;
}

function setListingHidden(id, hidden) {
  if (!isAdmin()) return false;
  const mod = getModeration();
  const set = new Set(mod.hidden || []);
  if (hidden) set.add(id); else set.delete(id);
  storage.set("moderation", { ...mod, hidden: [...set] });
  bump();
  emit("listings");
  return true;
}

const isHidden = (id) => (getModeration().hidden || []).includes(id);

/* =========================== NOTIFICATIONS ============================ */
function addNotification(userId, { kind, params = {}, link = "" }) {
  if (!userId) return;
  const all = storage.get("notifications", {});
  const list = Array.isArray(all[userId]) ? all[userId] : [];
  list.unshift({ id: uid("n_"), kind, params, link, at: new Date().toISOString(), read: false });
  all[userId] = list.slice(0, 50);
  storage.set("notifications", all);
  emit("notifications");
}

function getNotifications() {
  const me = currentUser();
  if (!me) return [];
  const list = storage.get("notifications", {})[me.id];
  return Array.isArray(list) ? list : [];
}

function markNotificationsRead() {
  const me = currentUser();
  if (!me) return;
  const all = storage.get("notifications", {});
  (all[me.id] || []).forEach((n) => { n.read = true; });
  storage.set("notifications", all);
  emit("notifications");
}

/* ============================ PRÉFÉRENCES ============================= */
function getPrefs() {
  return storage.get("prefs", {});
}

function setPrefs(patch) {
  storage.set("prefs", { ...getPrefs(), ...patch });
  emit("prefs");
}

/** Point de référence choisi pour calculer les distances (reste sur l'appareil). */
function getOrigin() {
  const o = storage.get("origin", null);
  return o && inSwitzerland(o.lat, o.lng) ? o : null;
}

function setOrigin(origin) {
  if (origin && inSwitzerland(origin.lat, origin.lng)) {
    storage.set("origin", { lat: Math.round(origin.lat * 1000) / 1000, lng: Math.round(origin.lng * 1000) / 1000, label: cleanText(origin.label, 60) });
  } else storage.remove("origin");
  emit("origin");
}

/* ============================ STATISTIQUES ============================ */
function stats() {
  const listings = allListingsRaw();
  return {
    active: listings.filter((l) => l.status === "active").length,
    userListings: getUserListings().length,
    users: getStoredUsers().length,
    reportsOpen: getReports().filter((r) => r.status === "open").length,
    conversations: getConversationsRaw().length,
    messages: getConversationsRaw().reduce((s, c) => s + c.messages.length, 0),
    hidden: (getModeration().hidden || []).length,
  };
}

const dataVersion = () => version;

return { onChange, cleanText, currentUser, displayName, getPerson, register, login, logout, updateProfile, changePassword, deleteAccount, exportMyData, toggleBlock, getAllUsersForAdmin, allListings, getListing, validateListing, createListing, updateListing, setListingStatus, deleteListing, searchListings, getFavorites, toggleFavorite, clearFavorites, mergeGuestFavorites, getConversations, otherParticipant, unreadCount, startConversation, sendMessage, markConversationRead, deleteConversation, getReports, createReport, resolveReport, setListingHidden, addNotification, getNotifications, markNotificationsRead, getPrefs, setPrefs, getOrigin, setOrigin, stats, isAdmin, isBlocked, listingsByAuthor, isFavorite, getConversation, totalUnread, typing, REPORT_REASONS, isHidden, dataVersion };
});
__def("ui.js", function () {
/* =====================================================================
   COMPOSANTS D'INTERFACE RÉUTILISABLES
   (cartes d'annonce, avatars, boîtes de dialogue, notifications, etc.)
   ===================================================================== */
const { html, raw, esc, $, mount, initials, avatarTone, debounce, safeImageSrc } = __req("util.js");
const { icon } = __req("icons.js");
const { t, pick, cantonName, categoryName, fmtCHF, fmtShortDate, fmtDistance, getLang } = __req("i18n.js");
const { getCategory, searchLocalities, LOCALITIES, CANTON_CODES } = __req("data.js");
const { getPerson, isFavorite, REPORT_REASONS, createReport } = __req("store.js");
const { distanceKm } = __req("util.js");

/* ------------------------------------------------------------------
   ACTIONS : les boutons portent data-action="nom" au lieu de onclick.
   (Les attributs onclick sont interdits par notre politique de sécurité.)
   ------------------------------------------------------------------ */
const actions = {};
function registerActions(map) { Object.assign(actions, map); }

/* ----------------------------- Toasts ----------------------------- */
function toast(message, kind = "info") {
  const box = $("#toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  const iconName = kind === "success" ? "checkCircle" : kind === "error" ? "alert" : "info";
  mount(el, html`${icon(iconName)}<span>${message}</span>`);
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3600);
}

/* ------------------------ Petits éléments ------------------------- */
function avatar(person, size = "md") {
  const name = person?.name || person?.firstname || "?";
  const photo = safeImageSrc(person?.photo);
  if (photo) return html`<span class="avatar avatar-${size}"><img src="${photo}" alt=""></span>`;
  return html`<span class="avatar avatar-${size} ${avatarTone(person?.id || name)}" aria-hidden="true">${initials(name)}</span>`;
}

function priceLabel(l) {
  if (l.payment === "free") return t("pay.free");
  if (l.payment === "negotiable") return t("pay.negotiable");
  const suffix = l.unit === "hour" ? t("unit.perHour") : l.unit === "visit" ? t("unit.perVisit") : "";
  return `${fmtCHF(l.amount)}${suffix}`;
}

function scheduleLabel(l) {
  if (!l.date) return t("listing.flexibleDate");
  return l.time ? `${fmtShortDate(l.date + "T12:00:00")} · ${l.time}` : fmtShortDate(l.date + "T12:00:00");
}

const typeLabel = (type) => t(`type.${type}`);

function categoryThumb(l, cls = "") {
  const cat = getCategory(l.category);
  const photo = safeImageSrc(l.photos?.[0]);
  if (photo) return html`<div class="media ${cls}"><img src="${photo}" alt="" loading="lazy"></div>`;
  return html`<div class="media media-illu tone-${cat.tone} ${cls}"><span class="media-icon">${icon(cat.icon)}</span></div>`;
}

function listingTitle(l) { return pick(l.title); }
function listingDescription(l) { return pick(l.description); }

/** Carte d'annonce utilisée partout (accueil, recherche, favoris…). */
function listingCard(l, { distance = null, origin = null } = {}) {
  const author = getPerson(l.authorId);
  const fav = isFavorite(l.id);
  const d = distance ?? (origin ? distanceKm(origin, l) : null);
  const title = listingTitle(l);
  return html`
  <article class="listing-card${l.status !== "active" ? " is-inactive" : ""}">
    <div class="listing-card-media">
      ${categoryThumb(l)}
      <div class="media-chips">
        <span class="chip chip-type type-${l.type}">${typeLabel(l.type)}</span>
        ${l.urgent ? html`<span class="chip chip-urgent">${icon("zap")}${t("listing.urgent")}</span>` : ""}
      </div>
    </div>
    <button class="fav-btn${fav ? " is-active" : ""}" type="button" data-action="fav" data-id="${l.id}" aria-pressed="${fav ? "true" : "false"}" aria-label="${fav ? t("fav.remove") : t("fav.add")}">${icon("heart")}</button>
    <div class="listing-card-body">
      <div class="listing-card-cat">${icon(getCategory(l.category).icon)}${categoryName(l.category)}</div>
      <h3 class="listing-card-title"><a href="#/annonce/${l.id}" class="stretched">${title}</a></h3>
      <div class="listing-card-meta">
        <span>${icon("pin")}${l.city} · ${l.canton}</span>
        ${d !== null ? html`<span class="distance">${fmtDistance(d)}</span>` : ""}
      </div>
      <div class="listing-card-meta">${icon("calendar")}<span>${scheduleLabel(l)}</span></div>
      <div class="listing-card-foot">
        <span class="mini-author">${avatar(author, "xs")}<span>${author?.name || t("common.formerMember")}</span>${author?.verified ? html`<span class="verified-dot" title="${t("trust.verified")}">${icon("badgeCheck")}</span>` : ""}</span>
        <span class="price${l.payment === "free" ? " is-free" : ""}">${priceLabel(l)}</span>
      </div>
    </div>
  </article>`;
}

function emptyState({ iconName = "inbox", title, text = "", action = "" }) {
  return html`<div class="empty-state">
    <div class="empty-icon">${icon(iconName)}</div>
    <h3>${title}</h3>
    ${text ? html`<p>${text}</p>` : ""}
    ${action}
  </div>`;
}

function stars(rating) {
  if (rating === null || rating === undefined) return html`<span class="muted">${t("trust.newMember")}</span>`;
  return html`<span class="stars" aria-label="${t("trust.ratingOutOf", { rating })}">${icon("star")}<strong>${rating.toFixed(1)}</strong></span>`;
}

/* ---------------------------- Dialogues --------------------------- */
let dialogResolve = null;

/** Ouvre la boîte de dialogue. `onSubmit(form)` peut retourner false pour la garder ouverte. */
function openDialog({ title, body, footer = "", size = "", onSubmit = null, onOpen = null }) {
  const dlg = $("#dialog");
  if (dialogResolve) { dialogResolve(null); dialogResolve = null; }
  dlg.className = `dialog ${size}`;
  mount(dlg, html`
    <form class="dialog-form" method="dialog" novalidate>
      <header class="dialog-head">
        <h2 id="dialog-title">${title}</h2>
        <button class="icon-btn" type="button" data-dialog-close aria-label="${t("common.close")}">${icon("x")}</button>
      </header>
      <div class="dialog-body">${body}</div>
      ${footer ? html`<footer class="dialog-foot">${footer}</footer>` : ""}
    </form>`);
  dlg.setAttribute("aria-labelledby", "dialog-title");
  const form = $("form", dlg);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const result = onSubmit ? await onSubmit(form, e.submitter) : true;
    if (result !== false) closeDialog(result);
  });
  $$dialogClose(dlg);
  dlg.showModal();
  onOpen?.(dlg);
  return new Promise((resolve) => { dialogResolve = resolve; });
}

function $$dialogClose(dlg) {
  dlg.querySelectorAll("[data-dialog-close]").forEach((b) => b.addEventListener("click", () => closeDialog(null)));
}

function closeDialog(result = null) {
  const dlg = $("#dialog");
  if (dlg.open) dlg.close();
  if (dialogResolve) { dialogResolve(result); dialogResolve = null; }
}

function initDialog() {
  const dlg = $("#dialog");
  dlg.addEventListener("cancel", () => { if (dialogResolve) { dialogResolve(null); dialogResolve = null; } });
  // Clic sur le fond sombre = fermer
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closeDialog(null); });
}

async function confirmDialog({ title, text, confirm, danger = false }) {
  const result = await openDialog({
    title,
    size: "dialog-sm",
    body: html`<p class="dialog-text">${text}</p>`,
    footer: html`<button type="button" class="btn btn-ghost" data-dialog-close>${t("common.cancel")}</button>
      <button type="submit" class="btn ${danger ? "btn-danger" : "btn-primary"}">${confirm}</button>`,
    onSubmit: () => true,
  });
  return result === true;
}

async function reportDialog(targetType, targetId) {
  const done = await openDialog({
    title: t("report.title"),
    body: html`
      <p class="dialog-text">${t("report.intro")}</p>
      <fieldset class="choice-list">
        <legend class="sr-only">${t("report.reason")}</legend>
        ${REPORT_REASONS.map((r, i) => html`<label class="choice"><input type="radio" name="reason" value="${r}" ${i === 0 ? raw("checked") : ""}><span>${t("report.reason." + r)}</span></label>`)}
      </fieldset>
      <label class="field"><span class="field-label">${t("report.details")}</span>
        <textarea name="details" rows="3" maxlength="500" class="input" placeholder="${t("report.detailsPh")}"></textarea></label>
      <p class="help">${icon("info")} ${t("report.emergency")}</p>`,
    footer: html`<button type="button" class="btn btn-ghost" data-dialog-close>${t("common.cancel")}</button>
      <button type="submit" class="btn btn-danger">${icon("flag")}${t("report.send")}</button>`,
    onSubmit: (form) => {
      const data = new FormData(form);
      return createReport({ targetType, targetId, reason: data.get("reason"), details: data.get("details") });
    },
  });
  if (done) toast(t("report.thanks"), "success");
}

async function shareLink(url, title) {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; } catch (e) { if (e?.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t("share.copied"), "success");
  } catch {
    openDialog({ title: t("share.title"), size: "dialog-sm", body: html`<input class="input" readonly value="${url}">` });
  }
}

/* ---------------------- Saisie d'une localité ---------------------- */
/* Suggestions hors ligne (liste intégrée) + recherche officielle de la
   Confédération (geo.admin.ch) pour trouver n'importe quelle commune. */
const remoteCache = new Map();

async function searchRemote(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  if (remoteCache.has(q)) return remoteCache.get(q);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(q)}&type=locations&origins=zipcode,gg25&limit=8&sr=4326`;
    const res = await fetch(url, { signal: ctrl.signal, referrerPolicy: "strict-origin-when-cross-origin", credentials: "omit" });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = await res.json();
    const out = [];
    for (const item of json.results || []) {
      const a = item.attrs || {};
      // Le libellé officiel contient du HTML (<b>) : on n'en garde que le texte.
      const text = String(a.label || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      const lat = Number(a.lat);
      const lng = Number(a.lon);
      if (!text || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      let canton = (/\(([A-Z]{2})\)/.exec(text) || [])[1];
      if (!CANTON_CODES.includes(canton)) canton = nearestCanton(lat, lng);
      const npa = (/\b(\d{4})\b/.exec(text) || [])[1] || "";
      const name = text.replace(/\(([A-Z]{2})\)/, "").replace(/\b\d{4}\b/, "").replace(/^[\s-–]+|[\s-–]+$/g, "").trim();
      if (!name || !canton) continue;
      out.push({ name: name.slice(0, 60), npa, canton, lat, lng, remote: true });
    }
    remoteCache.set(q, out);
    return out;
  } catch {
    return [];
  }
}

function nearestCanton(lat, lng) {
  let best = null;
  let bestD = Infinity;
  for (const l of LOCALITIES) {
    const d = (l.lat - lat) ** 2 + (l.lng - lng) ** 2;
    if (d < bestD) { bestD = d; best = l; }
  }
  return best?.canton || null;
}

function renderSuggestions(list, items, activeIndex) {
  if (!items.length) {
    list.hidden = true;
    return;
  }
  mount(list, html`${items.map((it, i) => html`<li role="option" id="${list.id}-opt-${i}" class="suggest-item${i === activeIndex ? " is-active" : ""}" data-index="${i}" aria-selected="${i === activeIndex ? "true" : "false"}">
    ${icon("pin")}<span><strong>${it.name}</strong> <span class="muted">${it.npa ? it.npa + " · " : ""}${cantonName(it.canton)}</span></span></li>`)}`);
  list.hidden = false;
}

/** Active l'autocomplétion sur tous les champs [data-locality] d'un conteneur. */
function initLocalityFields(root = document) {
  root.querySelectorAll("[data-locality]").forEach((input, n) => {
    if (input.dataset.ready) return;
    input.dataset.ready = "1";
    const wrap = input.closest(".locality-field");
    const list = wrap.querySelector(".suggest");
    list.id = list.id || `suggest-${n}-${Math.random().toString(36).slice(2, 7)}`;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("autocomplete", "off");
    let items = [];
    let active = -1;
    const hidden = (name) => wrap.querySelector(`[data-loc="${name}"]`);

    const choose = (it) => {
      input.value = it.name;
      if (hidden("canton")) hidden("canton").value = it.canton;
      if (hidden("npa")) hidden("npa").value = it.npa || "";
      if (hidden("lat")) hidden("lat").value = it.lat;
      if (hidden("lng")) hidden("lng").value = it.lng;
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      input.dispatchEvent(new CustomEvent("locality-change", { bubbles: true, detail: it }));
    };

    const update = async () => {
      const q = input.value;
      ["canton", "npa", "lat", "lng"].forEach((k) => { if (hidden(k)) hidden(k).value = ""; });
      items = searchLocalities(q, 6);
      active = -1;
      renderSuggestions(list, items, active);
      input.setAttribute("aria-expanded", String(!list.hidden));
      const remote = await searchRemote(q);
      if (input.value !== q) return;
      const known = new Set(items.map((i) => i.name.toLowerCase() + i.npa));
      items = [...items, ...remote.filter((r) => !known.has(r.name.toLowerCase() + r.npa))].slice(0, 8);
      renderSuggestions(list, items, active);
      input.setAttribute("aria-expanded", String(!list.hidden));
    };
    const debounced = debounce(update, 180);

    input.addEventListener("input", debounced);
    input.addEventListener("focus", () => { if (input.value && !hidden("lat")?.value) update(); });
    input.addEventListener("keydown", (e) => {
      if (list.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        renderSuggestions(list, items, active);
        input.setAttribute("aria-activedescendant", `${list.id}-opt-${active}`);
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        choose(items[active]);
      } else if (e.key === "Escape") {
        list.hidden = true;
      }
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("[data-index]");
      if (li) { e.preventDefault(); choose(items[Number(li.dataset.index)]); }
    });
    input.addEventListener("blur", () => setTimeout(() => {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      // Si la personne a tapé un nom exact sans cliquer, on le reconnaît.
      if (!hidden("lat")?.value) {
        const exact = searchLocalities(input.value, 1)[0];
        if (exact && exact.name.toLowerCase() === input.value.trim().toLowerCase()) choose(exact);
      }
    }, 120));
  });
}

/** Champ de localité (à placer dans un formulaire). */
function localityField({ name = "city", label, value = "", canton = "", npa = "", lat = "", lng = "", required = false, placeholder = "", error = "" }) {
  return html`<div class="field locality-field">
    ${label ? html`<label class="field-label" for="f-${name}">${label}${required ? html` <span class="req" aria-hidden="true">*</span>` : ""}</label>` : ""}
    <div class="input-icon">${icon("pin")}<input id="f-${name}" class="input" name="${name}" data-locality value="${value}" placeholder="${placeholder || t("loc.placeholder")}" ${required ? raw("required") : ""} maxlength="60"></div>
    <input type="hidden" name="canton" data-loc="canton" value="${canton}">
    <input type="hidden" name="npa" data-loc="npa" value="${npa}">
    <input type="hidden" name="lat" data-loc="lat" value="${lat}">
    <input type="hidden" name="lng" data-loc="lng" value="${lng}">
    <ul class="suggest" role="listbox" hidden></ul>
    ${error ? html`<p class="field-error">${error}</p>` : ""}
  </div>`;
}

function langChips(name, selected = []) {
  return html`<div class="chip-choices">${["fr", "de", "it", "en"].map((l) => html`<label class="chip-choice"><input type="checkbox" name="${name}" value="${l}" ${selected.includes(l) ? raw("checked") : ""}><span>${t("lang." + l)}</span></label>`)}</div>`;
}



return { registerActions, toast, avatar, priceLabel, scheduleLabel, categoryThumb, listingTitle, listingDescription, listingCard, emptyState, stars, openDialog, closeDialog, initDialog, confirmDialog, reportDialog, shareLink, initLocalityFields, localityField, langChips, actions, typeLabel, esc, getLang };
});
__def("switzerland.js", function () {
/* Silhouette simplifiée de la Suisse (longitude, latitude) pour l'illustration
   de la page d'accueil, et projection des annonces sur ce dessin. */
const { raw } = __req("util.js");

const BORDER = [
  [7.59, 47.59], [7.7, 47.54], [7.95, 47.55], [8.22, 47.61], [8.42, 47.58], [8.55, 47.62], [8.4, 47.68], [8.47, 47.77],
  [8.6, 47.8], [8.7, 47.79], [8.81, 47.72], [8.73, 47.69], [8.86, 47.66], [9.0, 47.66], [9.18, 47.66], [9.4, 47.55],
  [9.56, 47.53], [9.67, 47.46], [9.55, 47.3], [9.48, 47.1], [9.6, 47.05], [9.87, 46.99], [10.1, 46.92], [10.23, 46.87],
  [10.39, 46.98], [10.49, 46.94], [10.47, 46.8], [10.49, 46.62], [10.43, 46.54], [10.3, 46.55], [10.1, 46.42], [10.16, 46.26],
  [10.05, 46.3], [9.95, 46.37], [9.72, 46.3], [9.51, 46.33], [9.45, 46.45], [9.3, 46.5], [9.27, 46.42], [9.15, 46.2],
  [9.07, 45.92], [9.02, 45.83], [8.94, 45.84], [8.86, 45.97], [8.79, 46.0], [8.71, 46.11], [8.61, 46.13], [8.45, 46.25],
  [8.44, 46.44], [8.3, 46.41], [8.14, 46.25], [7.99, 46.05], [7.86, 45.92], [7.66, 45.98], [7.35, 45.91], [7.17, 45.87],
  [7.04, 45.93], [6.93, 46.06], [6.8, 46.16], [6.87, 46.28], [6.79, 46.39], [6.55, 46.4], [6.23, 46.31], [6.31, 46.25],
  [6.17, 46.18], [6.1, 46.14], [5.96, 46.14], [6.0, 46.23], [6.12, 46.31], [6.07, 46.41], [6.07, 46.46], [6.14, 46.56],
  [6.37, 46.71], [6.45, 46.84], [6.46, 46.91], [6.63, 46.97], [6.72, 47.03], [6.85, 47.08], [6.95, 47.25], [7.03, 47.36],
  [6.88, 47.37], [6.95, 47.44], [7.0, 47.5], [7.13, 47.5], [7.2, 47.44], [7.33, 47.44], [7.45, 47.47], [7.53, 47.5],
];

const K = 200;
const COS = Math.cos((46.8 * Math.PI) / 180);
const VIEW_W = 640;
const VIEW_H = 412;

function project(lng, lat) {
  return [(lng - 5.9) * K * COS + 4, (47.87 - lat) * K + 4];
}

const outlinePath = () =>
  BORDER.map(([lng, lat], i) => {
    const [x, y] = project(lng, lat);
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join("") + "Z";

/** Lac Léman (très simplifié) pour reconnaître la carte au premier coup d'œil. */
const LEMAN = [[6.15, 46.21], [6.25, 46.3], [6.45, 46.4], [6.62, 46.5], [6.8, 46.47], [6.91, 46.39], [6.78, 46.39], [6.55, 46.38], [6.3, 46.34], [6.17, 46.24]];
const lemanPath = () =>
  LEMAN.map(([lng, lat], i) => {
    const [x, y] = project(lng, lat);
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join("") + "Z";

function swissMapSvg(dots = []) {
  const circles = dots
    .map((d) => {
      const [x, y] = project(d.lng, d.lat);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${d.r || 3.2}" class="dot tone-${d.tone}"/>`;
    })
    .join("");
  return raw(`<svg class="swiss-map" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img" aria-hidden="true" focusable="false">
    <path class="swiss-shape" d="${outlinePath()}"/>
    <path class="swiss-lake" d="${lemanPath()}"/>
    <g class="swiss-dots">${circles}</g>
  </svg>`);
}

return { project, swissMapSvg, VIEW_W, VIEW_H, outlinePath, lemanPath };
});
__def("views/home.js", function () {
/* Page d'accueil */
const { html, raw } = __req("util.js");
const { icon } = __req("icons.js");
const { t, fmtNumber, categoryName } = __req("i18n.js");
const { CATEGORIES, getCategory } = __req("data.js");
const { allListings, searchListings, getOrigin, setOrigin, stats, isFavorite } = __req("store.js");
const { listingCard, priceLabel, listingTitle, localityField, initLocalityFields } = __req("ui.js");
const { swissMapSvg, project, VIEW_W, VIEW_H } = __req("switzerland.js");

function heroCards(listings) {
  const wanted = [["Lausanne", "right"], ["Zürich", "left"], ["Lugano", "left"]];
  return wanted
    .map(([city, side], i) => {
      const l = listings.find((x) => x.city === city && x.demo && x.type === (i === 1 ? "request" : "offer")) || listings.find((x) => x.city === city);
      if (!l) return "";
      const [x, y] = project(l.lng, l.lat);
      const cat = getCategory(l.category);
      return html`<a class="hero-float hero-float-${i} side-${side}" href="#/annonce/${l.id}" data-x="${((x / VIEW_W) * 100).toFixed(1)}" data-y="${((y / VIEW_H) * 100).toFixed(1)}">
        <span class="hero-float-icon tone-${cat.tone}">${icon(cat.icon)}</span>
        <span class="hero-float-text"><strong>${listingTitle(l)}</strong><span>${l.city} · ${priceLabel(l)}</span></span>
      </a>`;
    });
}

const FAQ = ["cost", "safety", "payment", "location", "languages", "data"];

const __default = {
  title: () => t("meta.homeTitle"),
  refreshOn: ["listings", "auth"],
  onData(kind) {
    if (kind === "favorites") {
      document.querySelectorAll(".fav-btn[data-id]").forEach((b) => {
        const on = isFavorite(b.dataset.id);
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
  },

  render() {
    const listings = allListings();
    const s = stats();
    const origin = getOrigin();
    const recent = searchListings({ sort: origin ? "distance" : "recent" }, origin).slice(0, 8);
    const counts = {};
    listings.forEach((l) => { counts[l.category] = (counts[l.category] || 0) + 1; });
    const dots = listings.slice(0, 380).map((l) => ({ lat: l.lat, lng: l.lng, tone: getCategory(l.category).tone }));

    return html`
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <span class="eyebrow">${icon("leaf")}${t("home.eyebrow")}</span>
          <h1 class="display">${t("home.title1")}<br>${t("home.title2")}<br><em>${t("home.title3")}</em></h1>
          <p class="lead">${t("home.lead")}</p>

          <form class="hero-search" data-form="hero-search" role="search">
            <div class="field">
              <label class="sr-only" for="hero-q">${t("search.what")}</label>
              <div class="input-icon">${icon("search")}<input id="hero-q" class="input" name="q" placeholder="${t("search.whatPh")}" maxlength="80"></div>
            </div>
            ${localityField({ name: "where", placeholder: origin?.label || t("search.wherePh") })}
            <button class="btn btn-primary btn-lg" type="submit">${t("search.submit")}</button>
          </form>
          <div class="hero-quick">
            <button type="button" class="link-btn" data-action="locate">${icon("locate")}${t("search.nearMe")}</button>
            <span class="hero-quick-sep" aria-hidden="true">·</span>
            ${["shopping", "pets", "digital", "garden"].map((c) => html`<a class="pill" href="#/explorer?cat=${c}">${categoryName(c)}</a>`)}
          </div>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <div class="hero-map">
            ${swissMapSvg(dots)}
            ${heroCards(listings)}
          </div>
        </div>
      </div>
    </section>

    <section class="stats-band" aria-label="${t("home.statsLabel")}">
      <div class="container stats-grid">
        <div class="stat"><strong>${fmtNumber(s.active)}</strong><span>${t("home.statListings")}</span></div>
        <div class="stat"><strong>26</strong><span>${t("home.statCantons")}</span></div>
        <div class="stat"><strong>4</strong><span>${t("home.statLangs")}</span></div>
        <div class="stat"><strong>0</strong><span>${t("home.statTrackers")}</span></div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <div><span class="kicker">${t("home.catKicker")}</span><h2 class="h2">${t("home.catTitle")}</h2></div>
          <a class="btn btn-ghost" href="#/explorer">${t("home.seeAll")}${icon("arrowRight")}</a>
        </div>
        <div class="cat-grid">
          ${CATEGORIES.map((c) => html`<a class="cat-tile" href="#/explorer?cat=${c.id}">
            <span class="cat-icon tone-${c.tone}">${icon(c.icon)}</span>
            <span class="cat-name">${categoryName(c.id)}</span>
            <span class="cat-count">${t("home.catCount", { count: counts[c.id] || 0 })}</span>
          </a>`)}
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="container">
        <div class="section-head">
          <div><span class="kicker">${origin ? t("home.nearKicker", { place: origin.label }) : t("home.recentKicker")}</span><h2 class="h2">${t("home.recentTitle")}</h2></div>
          <a class="btn btn-ghost" href="#/explorer">${t("home.seeAll")}${icon("arrowRight")}</a>
        </div>
        <div class="listing-grid">
          ${recent.map(({ listing, distance }) => listingCard(listing, { distance }))}
        </div>
      </div>
    </section>

    <section class="section" id="how">
      <div class="container">
        <div class="section-head center">
          <div><span class="kicker">${t("home.howKicker")}</span><h2 class="h2">${t("home.howTitle")}</h2></div>
        </div>
        <ol class="steps">
          ${[["pencil", 1], ["message", 2], ["hand", 3]].map(([ic, n]) => html`<li class="step">
            <span class="step-num">${n}</span>
            <span class="step-icon">${icon(ic)}</span>
            <h3>${t(`home.step${n}Title`)}</h3>
            <p>${t(`home.step${n}Text`)}</p>
          </li>`)}
        </ol>
        <div class="center-actions">
          <a class="btn btn-primary btn-lg" href="#/publier">${icon("plus")}${t("home.ctaPublish")}</a>
          <a class="btn btn-ghost btn-lg" href="#/explorer">${t("home.ctaExplore")}</a>
        </div>
      </div>
    </section>

    <section class="section trust-section">
      <div class="container trust-grid">
        <div class="trust-intro">
          <span class="kicker kicker-light">${t("home.trustKicker")}</span>
          <h2 class="h2">${t("home.trustTitle")}</h2>
          <p>${t("home.trustText")}</p>
          <a class="btn btn-light" href="#/page/securite">${icon("shieldCheck")}${t("home.trustCta")}</a>
        </div>
        <div class="trust-cards">
          ${[["pin", "Loc"], ["lock", "Pwd"], ["flag", "Report"], ["eyeOff", "Track"]].map(([ic, k]) => html`<div class="trust-card">
            <span class="trust-icon">${icon(ic)}</span>
            <h3>${t(`home.trust${k}Title`)}</h3>
            <p>${t(`home.trust${k}Text`)}</p>
          </div>`)}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container faq-wrap">
        <div>
          <span class="kicker">${t("home.faqKicker")}</span>
          <h2 class="h2">${t("home.faqTitle")}</h2>
          <p class="muted">${t("home.faqText")}</p>
          <a class="btn btn-ghost" href="#/page/aide">${t("home.faqMore")}${icon("arrowRight")}</a>
        </div>
        <div class="faq">
          ${FAQ.map((k) => html`<details class="faq-item"><summary>${t(`faq.${k}.q`)}${icon("chevronDown")}</summary><p>${t(`faq.${k}.a`)}</p></details>`)}
        </div>
      </div>
    </section>

    <section class="section cta-band">
      <div class="container cta-inner">
        <div>
          <h2 class="h2">${t("home.ctaTitle")}</h2>
          <p>${t("home.ctaText")}</p>
        </div>
        <div class="cta-actions">
          <a class="btn btn-light btn-lg" href="#/publier">${icon("plus")}${t("home.ctaPublish")}</a>
        </div>
      </div>
    </section>`;
  },

  mount(root) {
    initLocalityFields(root);
    let placeChosen = false;
    root.addEventListener("locality-change", (e) => {
      const loc = e.detail;
      setOrigin({ lat: loc.lat, lng: loc.lng, label: loc.name });
      placeChosen = true;
    });
    root.querySelector("[data-form='hero-search']")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const p = new URLSearchParams();
      const q = e.target.q.value.trim();
      if (q) p.set("q", q);
      if (placeChosen) { p.set("radius", "25"); p.set("sort", "distance"); }
      location.hash = `#/explorer${p.toString() ? "?" + p : ""}`;
    });
    // Positionne les cartes flottantes sur l'illustration de la Suisse
    root.querySelectorAll(".hero-float").forEach((el) => {
      el.style.setProperty("--x", el.dataset.x + "%");
      el.style.setProperty("--y", el.dataset.y + "%");
    });
  },
};



return { default: __default, raw };
});
__def("map.js", function () {
/* =====================================================================
   CARTE (Leaflet + fond de carte officiel swisstopo)
   ---------------------------------------------------------------------
   - Fond de carte : Office fédéral de topographie (swisstopo), données
     libres. Si le service ne répond pas, on bascule sur OpenStreetMap.
   - Vie privée : zoom maximal limité et positions floutées (±1 km),
     on ne peut donc jamais voir l'adresse exacte de quelqu'un.
   - Si la librairie de carte ne charge pas, le reste du site continue
     de fonctionner normalement (l'ancienne version plantait entièrement).
   ===================================================================== */
const { html, esc } = __req("util.js");
const { icon } = __req("icons.js");
const { t } = __req("i18n.js");
const { getCategory } = __req("data.js");
const { priceLabel, listingTitle } = __req("ui.js");

const MAX_ZOOM = 15;
const SWISS_BOUNDS = [[45.75, 5.9], [47.85, 10.55]];

const leafletReady = () => typeof window.L !== "undefined" && typeof window.L.map === "function";

function mapUnavailable(el) {
  el.classList.add("map-fallback");
  el.innerHTML = html`<div class="map-fallback-inner">${icon("map")}<p>${t("map.unavailable")}</p></div>`.toString();
}

function addBaseLayer(map) {
  const L = window.L;
  const swiss = L.tileLayer("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener noreferrer">swisstopo</a>',
  });
  let loaded = 0;
  let errors = 0;
  let switched = false;
  swiss.on("tileload", () => { loaded++; });
  swiss.on("tileerror", () => {
    errors++;
    if (!switched && loaded === 0 && errors >= 4) {
      switched = true;
      map.removeLayer(swiss);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(map);
    }
  });
  swiss.addTo(map);
}

/** Crée une carte dans un élément. */
function createMap(el, { center = [46.8, 8.23], zoom = 8, interactive = true } = {}) {
  if (!leafletReady()) { mapUnavailable(el); return null; }
  try {
    const L = window.L;
    const map = L.map(el, {
      center,
      zoom,
      minZoom: 7,
      maxZoom: MAX_ZOOM,
      maxBounds: [[45.2, 5.0], [48.4, 11.4]],
      zoomControl: interactive,
      scrollWheelZoom: false,
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      keyboard: interactive,
      attributionControl: true,
    });
    map.attributionControl.setPrefix(false);
    addBaseLayer(map);
    // Molette active seulement après un clic sur la carte (évite de "piéger" le défilement de la page).
    if (interactive) {
      map.once("focus", () => map.scrollWheelZoom.enable());
      map.on("click", () => map.scrollWheelZoom.enable());
    }
    return map;
  } catch (e) {
    console.error(e);
    mapUnavailable(el);
    return null;
  }
}

function pinIcon(listing, active = false) {
  const cat = getCategory(listing.category);
  return window.L.divIcon({
    className: "",
    html: `<span class="map-pin tone-${cat.tone}${listing.urgent ? " is-urgent" : ""}${active ? " is-active" : ""}">${icon(cat.icon)}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

function clusterIcon(count) {
  const size = count < 10 ? "s" : count < 50 ? "m" : "l";
  const px = size === "s" ? 36 : size === "m" ? 44 : 54;
  return window.L.divIcon({
    className: "",
    html: `<span class="map-cluster size-${size}"><span>${count}</span></span>`,
    iconSize: [px, px],
    iconAnchor: [px / 2, px / 2],
  });
}

function popupContent(listing) {
  return html`<div class="map-popup">
    <a class="map-popup-title" href="#/annonce/${listing.id}">${listingTitle(listing)}</a>
    <div class="map-popup-meta">${listing.city} · ${listing.canton}</div>
    <div class="map-popup-foot"><strong>${priceLabel(listing)}</strong><a class="btn btn-primary btn-xs" href="#/annonce/${listing.id}">${t("common.view")}</a></div>
  </div>`.toString();
}

/** Couche d'annonces avec regroupement automatique ("clusters"). */
function listingsLayer(map) {
  const L = window.L;
  const group = L.layerGroup().addTo(map);
  let items = [];
  let highlighted = null;

  function draw() {
    group.clearLayers();
    const zoom = map.getZoom();
    const bounds = map.getBounds().pad(0.25);
    const cell = zoom >= 13 ? 40 : 58;
    const cells = new Map();
    for (const l of items) {
      if (!bounds.contains([l.lat, l.lng])) continue;
      const p = map.project([l.lat, l.lng], zoom);
      const key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(l);
    }
    for (const members of cells.values()) {
      if (members.length === 1 || zoom >= MAX_ZOOM) {
        members.forEach((l, i) => {
          // Petits décalages si plusieurs annonces se superposent au zoom maximal
          const offset = members.length > 1 ? 0.0009 * i : 0;
          const m = L.marker([l.lat + offset, l.lng + offset], { icon: pinIcon(l, l.id === highlighted), title: listingTitle(l), riseOnHover: true, keyboard: true });
          m.bindPopup(popupContent(l), { maxWidth: 260, minWidth: 200 });
          m.addTo(group);
        });
      } else {
        const lat = members.reduce((s, l) => s + l.lat, 0) / members.length;
        const lng = members.reduce((s, l) => s + l.lng, 0) / members.length;
        const m = L.marker([lat, lng], { icon: clusterIcon(members.length), title: t("map.clusterTitle", { count: members.length }), keyboard: true });
        m.on("click", () => {
          const b = L.latLngBounds(members.map((l) => [l.lat, l.lng]));
          map.fitBounds(b, { padding: [50, 50], maxZoom: Math.min(MAX_ZOOM, zoom + 3) });
        });
        m.addTo(group);
      }
    }
  }

  map.on("zoomend moveend", draw);
  return {
    setItems(list, { fit = false } = {}) {
      items = list;
      if (fit && list.length) {
        const b = L.latLngBounds(list.map((l) => [l.lat, l.lng]));
        map.fitBounds(b, { padding: [40, 40], maxZoom: 12 });
      }
      draw();
    },
    highlight(id) { highlighted = id; draw(); },
  };
}

/** Petite carte d'une annonce : zone approximative (cercle), jamais de point exact. */
function detailMap(el, listing) {
  const map = createMap(el, { center: [listing.lat, listing.lng], zoom: 13, interactive: true });
  if (!map) return null;
  window.L.circle([listing.lat, listing.lng], { radius: 900, color: "#2F6F4E", weight: 2, fillColor: "#5E9F68", fillOpacity: 0.18, interactive: false }).addTo(map);
  return map;
}

function fitSwitzerland(map) {
  map.fitBounds(SWISS_BOUNDS, { padding: [10, 10] });
}



return { mapUnavailable, createMap, listingsLayer, detailMap, fitSwitzerland, MAX_ZOOM, leafletReady, esc };
});
__def("views/explore.js", function () {
/* Page "Explorer" : recherche, filtres, liste d'annonces et carte */
const { html, raw, $, $$, mount, debounce } = __req("util.js");
const { icon } = __req("icons.js");
const { t, cantonName, categoryName, fmtNumber } = __req("i18n.js");
const { CATEGORIES, CANTON_CODES, TYPES, PAYMENTS, LOCALITIES } = __req("data.js");
const { searchListings, getOrigin, setOrigin, isFavorite } = __req("store.js");
const { listingCard, emptyState, localityField, initLocalityFields, toast } = __req("ui.js");
const { createMap, listingsLayer, leafletReady, fitSwitzerland } = __req("map.js");

const PAGE_SIZE = 16;
const FILTER_KEYS = ["q", "type", "cat", "canton", "pay", "radius", "urgent", "verified", "sort", "page"];

let state = null;
let map = null;
let layer = null;
let mapBounds = null;
let userMoved = false;

function readFilters(query) {
  const f = {};
  for (const k of FILTER_KEYS) {
    const v = query.get(k);
    if (v) f[k] = v;
  }
  if (f.type && !TYPES.includes(f.type)) delete f.type;
  if (f.cat && !CATEGORIES.some((c) => c.id === f.cat)) delete f.cat;
  if (f.canton && !CANTON_CODES.includes(f.canton)) delete f.canton;
  if (f.pay && !PAYMENTS.includes(f.pay)) delete f.pay;
  if (f.radius && !["5", "10", "25", "50"].includes(f.radius)) delete f.radius;
  f.page = Math.max(1, parseInt(f.page, 10) || 1);
  f.view = query.get("view") === "map" ? "map" : "list";
  return f;
}

function writeUrl() {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = state.f[k];
    if (v && !(k === "page" && v === 1)) p.set(k, v);
  }
  if (state.f.view === "map") p.set("view", "map");
  const qs = p.toString();
  history.replaceState(null, "", `#/explorer${qs ? "?" + qs : ""}`);
}

function select(name, label, options, value) {
  return html`<label class="filter-select"><span class="sr-only">${label}</span>
    <select class="select" name="${name}" data-filter="${name}" aria-label="${label}">
      ${options.map(([v, text]) => html`<option value="${v}" ${String(v) === String(value || "") ? raw("selected") : ""}>${text}</option>`)}
    </select></label>`;
}

function filtersBar(f, origin) {
  return html`
  <div class="filter-row">
    <div class="segmented" role="group" aria-label="${t("filter.type")}">
      ${[["", t("filter.all")], ...TYPES.map((ty) => [ty, t("type." + ty)])].map(([v, text]) => html`<button type="button" class="seg${(f.type || "") === v ? " is-active" : ""}" data-action="filter-type" data-value="${v}" aria-pressed="${(f.type || "") === v ? "true" : "false"}">${text}</button>`)}
    </div>
    ${select("cat", t("filter.category"), [["", t("filter.allCategories")], ...CATEGORIES.map((c) => [c.id, categoryName(c.id)])], f.cat)}
    ${select("canton", t("filter.canton"), [["", t("filter.allCantons")], ...CANTON_CODES.map((c) => [c, `${cantonName(c)} (${c})`]).sort((a, b) => a[1].localeCompare(b[1]))], f.canton)}
    ${select("pay", t("filter.payment"), [["", t("filter.anyPayment")], ...PAYMENTS.map((p) => [p, t("pay." + p)])], f.pay)}
    ${select("radius", t("filter.radius"), [["", origin ? t("filter.anyDistance") : t("filter.radius")], ...["5", "10", "25", "50"].map((r) => [r, t("filter.within", { km: r })])], f.radius)}
    <label class="toggle"><input type="checkbox" data-filter="urgent" ${f.urgent ? raw("checked") : ""}><span>${icon("zap")}${t("filter.urgent")}</span></label>
    <label class="toggle"><input type="checkbox" data-filter="verified" ${f.verified ? raw("checked") : ""}><span>${icon("badgeCheck")}${t("filter.verified")}</span></label>
  </div>`;
}

function activeChips(f, origin) {
  const chips = [];
  if (origin) chips.push(html`<button type="button" class="chip chip-removable" data-action="clear-origin">${icon("pin")}${t("filter.around", { place: origin.label })}${icon("x")}</button>`);
  if (mapBounds) chips.push(html`<button type="button" class="chip chip-removable" data-action="clear-bounds">${icon("map")}${t("filter.mapArea")}${icon("x")}</button>`);
  if (f.q) chips.push(html`<button type="button" class="chip chip-removable" data-action="clear-filter" data-key="q">« ${f.q} »${icon("x")}</button>`);
  const any = chips.length || f.type || f.cat || f.canton || f.pay || f.radius || f.urgent || f.verified;
  if (!any) return "";
  return html`<div class="active-chips">${chips}<button type="button" class="link-btn" data-action="reset-filters">${t("filter.reset")}</button></div>`;
}

function renderResults() {
  const f = state.f;
  const origin = getOrigin();
  const all = searchListings({ ...f, bounds: mapBounds }, origin);
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  if (f.page > pages) f.page = pages;
  const pageItems = all.slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE);

  mount($("#results-count"), html`<strong>${fmtNumber(all.length)}</strong> ${t("explore.results", { count: all.length })}`);
  mount($("#active-chips"), activeChips(f, origin));
  mount(
    $("#results-grid"),
    pageItems.length
      ? html`${pageItems.map(({ listing, distance }) => listingCard(listing, { distance }))}`
      : emptyState({ iconName: "search", title: t("explore.emptyTitle"), text: t("explore.emptyText"), action: html`<div class="empty-actions"><button class="btn btn-ghost" data-action="reset-filters">${t("filter.reset")}</button><a class="btn btn-primary" href="#/publier">${icon("plus")}${t("explore.emptyPublish")}</a></div>` })
  );
  mount($("#pagination"), pagination(f.page, pages));
  layer?.setItems(all.map((r) => r.listing));
  writeUrl();
}

function pagination(page, pages) {
  if (pages <= 1) return "";
  const nums = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  for (let i = start; i <= end; i++) nums.push(i);
  return html`
    <button class="page-btn" data-action="page" data-page="${page - 1}" ${page === 1 ? raw("disabled") : ""} aria-label="${t("common.previous")}">${icon("chevronLeft")}</button>
    ${start > 1 ? html`<button class="page-btn" data-action="page" data-page="1">1</button>${start > 2 ? html`<span class="page-gap">…</span>` : ""}` : ""}
    ${nums.map((n) => html`<button class="page-btn${n === page ? " is-active" : ""}" data-action="page" data-page="${n}" ${n === page ? raw('aria-current="page"') : ""}>${n}</button>`)}
    ${end < pages ? html`${end < pages - 1 ? html`<span class="page-gap">…</span>` : ""}<button class="page-btn" data-action="page" data-page="${pages}">${pages}</button>` : ""}
    <button class="page-btn" data-action="page" data-page="${page + 1}" ${page === pages ? raw("disabled") : ""} aria-label="${t("common.next")}">${icon("chevronRight")}</button>`;
}

function setFilter(key, value, { resetPage = true } = {}) {
  if (value === "" || value === null || value === false || value === undefined) delete state.f[key];
  else state.f[key] = value;
  if (resetPage) state.f.page = 1;
  renderResults();
}

function applyView() {
  const layout = $("#explore-layout");
  if (!layout) return;
  layout.classList.toggle("show-map", state.f.view === "map");
  $$("[data-action='set-view']").forEach((b) => {
    const on = b.dataset.value === state.f.view;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  setTimeout(() => map?.invalidateSize(), 60);
  writeUrl();
}

const exploreActions = {
  "filter-type": (el) => {
    $$("[data-action='filter-type']").forEach((b) => { b.classList.toggle("is-active", b === el); b.setAttribute("aria-pressed", b === el ? "true" : "false"); });
    setFilter("type", el.dataset.value);
  },
  "clear-filter": (el) => {
    if (el.dataset.key === "q") { const q = $("#explore-q"); if (q) q.value = ""; }
    setFilter(el.dataset.key, "");
  },
  "reset-filters": () => {
    state.f = { page: 1, view: state.f.view };
    mapBounds = null;
    const q = $("#explore-q");
    if (q) q.value = "";
    mount($("#filter-bar"), filtersBar(state.f, getOrigin()));
    renderResults();
  },
  "clear-origin": () => {
    setOrigin(null);
    delete state.f.radius;
    if (state.f.sort === "distance") delete state.f.sort;
    mount($("#filter-bar"), filtersBar(state.f, null));
    const w = $("#f-where");
    if (w) { w.value = ""; w.placeholder = t("search.wherePh"); }
    renderResults();
  },
  "clear-bounds": () => { mapBounds = null; renderResults(); },
  "search-area": () => {
    if (!map) return;
    const b = map.getBounds();
    mapBounds = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
    const btn = $("#map-search-area");
    if (btn) btn.hidden = true;
    userMoved = false;
    state.f.page = 1;
    renderResults();
  },
  page: (el) => {
    state.f.page = Number(el.dataset.page) || 1;
    renderResults();
    $("#results-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  },
  "set-view": (el) => { state.f.view = el.dataset.value; applyView(); },
  "toggle-filters": (el) => {
    const bar = $("#filter-bar");
    const open = bar.classList.toggle("is-open");
    el.setAttribute("aria-expanded", open ? "true" : "false");
  },
};

const __default = {
  title: () => t("meta.exploreTitle"),
  refreshOn: [],

  render(ctx) {
    const f = readFilters(ctx.query);
    // Une nouvelle recherche arrivant par l'URL remet la zone de carte à zéro
    mapBounds = null;
    state = { f };
    const origin = getOrigin();
    const sortOptions = [["recent", t("sort.recent")], ["soon", t("sort.soon")], ["priceLow", t("sort.priceLow")], ["priceHigh", t("sort.priceHigh")]];
    if (origin) sortOptions.unshift(["distance", t("sort.distance")]);

    return html`
    <section class="page-head page-head-tight">
      <div class="container">
        <h1 class="h1">${t("explore.title")}</h1>
        <form class="explore-search" data-form="explore-search" role="search">
          <div class="field"><label class="sr-only" for="explore-q">${t("search.what")}</label>
            <div class="input-icon">${icon("search")}<input id="explore-q" class="input" name="q" value="${f.q || ""}" placeholder="${t("search.whatPh")}" maxlength="80"></div></div>
          ${localityField({ name: "where", value: "", placeholder: origin?.label || t("search.wherePh") })}
          <button type="button" class="btn btn-ghost btn-icon-only" data-action="locate" title="${t("search.nearMe")}" aria-label="${t("search.nearMe")}">${icon("locate")}</button>
          <button class="btn btn-primary" type="submit">${t("search.submit")}</button>
        </form>
        <button type="button" class="btn btn-ghost filters-toggle" data-action="toggle-filters" aria-expanded="false" aria-controls="filter-bar">${icon("sliders")}${t("filter.title")}</button>
        <div id="filter-bar" class="filter-bar">${filtersBar(f, origin)}</div>
      </div>
    </section>

    <section class="container explore-layout${f.view === "map" ? " show-map" : ""}" id="explore-layout">
      <div class="results-col">
        <div class="results-bar" id="results-top">
          <p id="results-count" class="results-count" aria-live="polite"></p>
          <div class="results-tools">
            <label class="sort"><span class="muted">${t("sort.label")}</span>
              <select class="select select-sm" data-filter="sort" aria-label="${t("sort.label")}">
                ${sortOptions.map(([v, text]) => html`<option value="${v}" ${(f.sort || (origin ? "distance" : "recent")) === v ? raw("selected") : ""}>${text}</option>`)}
              </select></label>
            <div class="segmented segmented-sm view-toggle" role="group" aria-label="${t("explore.view")}">
              <button type="button" class="seg${f.view === "list" ? " is-active" : ""}" data-action="set-view" data-value="list" aria-pressed="${f.view === "list" ? "true" : "false"}">${icon("list")}<span>${t("explore.list")}</span></button>
              <button type="button" class="seg${f.view === "map" ? " is-active" : ""}" data-action="set-view" data-value="map" aria-pressed="${f.view === "map" ? "true" : "false"}">${icon("map")}<span>${t("explore.map")}</span></button>
            </div>
          </div>
        </div>
        <div id="active-chips"></div>
        <div id="results-grid" class="listing-grid listing-grid-explore"></div>
        <nav id="pagination" class="pagination" aria-label="${t("common.pagination")}"></nav>
      </div>
      <div class="map-col">
        <div class="map-sticky">
          <div id="explore-map" class="map" role="region" aria-label="${t("explore.mapLabel")}"></div>
          <button type="button" class="btn btn-primary map-back-list" data-action="set-view" data-value="list">${icon("list")}${t("explore.list")}</button>
          <button type="button" id="map-search-area" class="btn btn-light map-search-area" data-action="search-area" hidden>${icon("search")}${t("explore.searchArea")}</button>
          <p class="map-note">${icon("shield")}${t("explore.mapPrivacy")}</p>
        </div>
      </div>
    </section>`;
  },

  mount(root) {
    initLocalityFields(root);
    const mapEl = $("#explore-map", root);
    map = createMap(mapEl, { zoom: 8 });
    if (map) {
      fitSwitzerland(map);
      layer = listingsLayer(map);
      map.on("dragstart zoomstart", () => { userMoved = true; });
      map.on("moveend", () => { const b = $("#map-search-area"); if (userMoved && b) b.hidden = false; });
    } else layer = null;
    renderResults();

    // Filtres (listes déroulantes et cases)
    root.addEventListener("change", (e) => {
      const el = e.target.closest("[data-filter]");
      if (!el) return;
      const key = el.dataset.filter;
      if (key === "radius" && el.value && !getOrigin()) {
        el.value = "";
        toast(t("filter.distanceNeedsPlace"), "info");
        $("#f-where")?.focus();
        return;
      }
      setFilter(key, el.type === "checkbox" ? (el.checked ? "1" : "") : el.value, { resetPage: key !== "sort" });
    });
    // Recherche instantanée pendant la frappe
    const q = $("#explore-q", root);
    q?.addEventListener("input", debounce(() => setFilter("q", q.value.trim()), 300));
    root.addEventListener("submit", (e) => {
      if (!e.target.matches("[data-form='explore-search']")) return;
      e.preventDefault();
      setFilter("q", q.value.trim());
      $("#results-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    // Choix d'une localité = point de référence pour la distance
    root.addEventListener("locality-change", (e) => {
      const loc = e.detail;
      setOrigin({ lat: loc.lat, lng: loc.lng, label: loc.name });
      if (!state.f.radius) state.f.radius = "25";
      state.f.sort = "distance";
      mount($("#filter-bar"), filtersBar(state.f, getOrigin()));
      const sortSel = root.querySelector("[data-filter='sort']");
      if (sortSel && ![...sortSel.options].some((o) => o.value === "distance")) {
        sortSel.insertAdjacentHTML("afterbegin", `<option value="distance">${t("sort.distance")}</option>`);
      }
      if (sortSel) sortSel.value = "distance";
      mapBounds = null;
      renderResults();
      if (map) map.setView([loc.lat, loc.lng], 11);
    });
  },

  /** Mise à jour légère quand les favoris changent (cœurs). */
  onData(kind) {
    if (kind === "favorites") {
      $$(".fav-btn[data-id]").forEach((b) => {
        const on = isFavorite(b.dataset.id);
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    } else if (kind === "listings" || kind === "block") renderResults();
  },

  unmount() {
    map?.remove();
    map = null;
    layer = null;
    state = null;
    userMoved = false;
  },
};



return { exploreActions, default: __default, LOCALITIES, leafletReady };
});
__def("ics.js", function () {
/* Export vers les agendas (Google Agenda, Apple Calendrier, Outlook…)
   au format standard iCalendar (.ics — norme RFC 5545). */
const { downloadFile } = __req("util.js");
const { pick } = __req("i18n.js");

const TZ = `BEGIN:VTIMEZONE
TZID:Europe/Zurich
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19810329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19961027T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

/** Échappement des caractères spéciaux du format .ics */
const escText = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Les lignes .ics ne doivent pas dépasser 75 octets. */
function fold(line) {
  const out = [];
  let current = "";
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > 74) {
      out.push(current);
      current = " " + ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n");
}

const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function eventFor(listing, baseUrl) {
  if (!listing.date) return null;
  const [y, m, d] = listing.date.split("-");
  const [hh, mm] = (listing.time || "09:00").split(":");
  const start = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
  const end = new Date(start.getTime() + (listing.duration || 60) * 60000);
  const local = (dt) => `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}${String(dt.getMinutes()).padStart(2, "0")}00`;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${listing.id}@voisina.ch`,
    `DTSTAMP:${stamp(new Date())}`,
    listing.time ? `DTSTART;TZID=Europe/Zurich:${local(start)}` : `DTSTART;VALUE=DATE:${y}${m}${d}`,
    listing.time ? `DTEND;TZID=Europe/Zurich:${local(end)}` : null,
    listing.recurrence === "weekly" ? "RRULE:FREQ=WEEKLY;COUNT=8" : listing.recurrence === "monthly" ? "RRULE:FREQ=MONTHLY;COUNT=6" : null,
    `SUMMARY:${escText("Voisina · " + pick(listing.title))}`,
    `DESCRIPTION:${escText(pick(listing.description) + "\n\n" + baseUrl + "#/annonce/" + listing.id)}`,
    `LOCATION:${escText(`${listing.npa ? listing.npa + " " : ""}${listing.city} (${listing.canton})`)}`,
    `URL:${baseUrl}#/annonce/${listing.id}`,
    "END:VEVENT",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n");
}

function buildIcs(listings) {
  const base = location.href.split("#")[0];
  const events = listings.map((l) => eventFor(l, base)).filter(Boolean);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Voisina//Entraide locale//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Voisina", TZ.replace(/\n/g, "\r\n"), ...events, "END:VCALENDAR"].join("\r\n") + "\r\n";
}

function downloadIcs(listings, filename = "voisina.ics") {
  const content = buildIcs(listings);
  downloadFile(filename, content, "text/calendar;charset=utf-8");
}

return { buildIcs, downloadIcs };
});
__def("views/listing.js", function () {
/* Page de détail d'une annonce */
const { html, raw, $, safeImageSrc } = __req("util.js");
const { icon } = __req("icons.js");
const { t, pick, getLang, cantonName, categoryName, fmtDate, fmtRelative, fmtDuration, fmtDistance, languageName } = __req("i18n.js");
const { getCategory } = __req("data.js");
const { getListing, getPerson, currentUser, isFavorite, searchListings, getOrigin, startConversation, setListingStatus, deleteListing, setListingHidden, isAdmin, toggleBlock, isBlocked } = __req("store.js");
const { listingCard, avatar, priceLabel, typeLabel, emptyState, stars, confirmDialog, reportDialog, shareLink, toast, listingTitle, listingDescription, categoryThumb } = __req("ui.js");
const { detailMap } = __req("map.js");
const { downloadIcs } = __req("ics.js");
const { distanceKm } = __req("util.js");

let map = null;
let currentId = null;

function notFound() {
  return html`<section class="section"><div class="container narrow">
    ${emptyState({ iconName: "search", title: t("listing.notFoundTitle"), text: t("listing.notFoundText"), action: html`<a class="btn btn-primary" href="#/explorer">${t("listing.backToExplore")}</a>` })}
  </div></section>`;
}

function fact(iconName, label, value) {
  return html`<div class="fact"><span class="fact-icon">${icon(iconName)}</span><div><dt>${label}</dt><dd>${value}</dd></div></div>`;
}

function gallery(l) {
  const photos = (l.photos || []).map(safeImageSrc).filter(Boolean);
  if (!photos.length) return categoryThumb(l, "detail-media");
  return html`<div class="gallery">
    <img class="gallery-main" id="gallery-main" src="${photos[0]}" alt="${listingTitle(l)}">
    ${photos.length > 1 ? html`<div class="gallery-thumbs">${photos.map((p, i) => html`<button type="button" class="gallery-thumb${i === 0 ? " is-active" : ""}" data-action="gallery" data-index="${i}" aria-label="${t("listing.photoN", { n: i + 1 })}"><img src="${p}" alt=""></button>`)}</div>` : ""}
  </div>`;
}

const __default = {
  title: (ctx) => {
    const l = getListing(ctx.params[0]);
    return l ? listingTitle(l) : t("listing.notFoundTitle");
  },
  refreshOn: ["listings", "auth", "block"],

  render(ctx) {
    const id = ctx.params[0];
    currentId = id;
    const l = getListing(id);
    const me = currentUser();
    const owner = me && l && l.authorId === me.id;
    const admin = isAdmin();
    if (!l || (l.status === "hidden" && !admin && !owner) || (isBlocked(l?.authorId) && !admin)) return notFound();

    const author = getPerson(l.authorId);
    const cat = getCategory(l.category);
    const fav = isFavorite(l.id);
    const origin = getOrigin();
    const dist = origin ? distanceKm(origin, l) : null;
    const similar = searchListings({ cat: l.category }, { lat: l.lat, lng: l.lng })
      .filter((r) => r.listing.id !== l.id && r.listing.authorId !== l.authorId)
      .sort((a, b) => a.distance - b.distance)
      .filter((r, i, arr) => arr.findIndex((x) => listingTitle(x.listing) === listingTitle(r.listing)) === i && listingTitle(r.listing) !== listingTitle(l))
      .slice(0, 4);
    const sourceLang = l.demo ? null : l.lang;
    const showTranslate = sourceLang && sourceLang !== getLang();
    const text = listingDescription(l);
    const deeplUrl = showTranslate ? `https://www.deepl.com/translator#${sourceLang}/${getLang() === "en" ? "en" : getLang()}/${encodeURIComponent((listingTitle(l) + "\n\n" + text).slice(0, 1500))}` : "";

    return html`
    <div class="container">
      <nav class="breadcrumb" aria-label="${t("common.breadcrumb")}">
        <a href="#/explorer">${t("nav.explore")}</a>${icon("chevronRight")}
        <a href="#/explorer?cat=${l.category}">${categoryName(l.category)}</a>${icon("chevronRight")}
        <span aria-current="page">${listingTitle(l)}</span>
      </nav>

      ${l.status === "hidden" ? html`<div class="notice notice-danger">${icon("eyeOff")}${t("listing.hiddenNotice")}</div>` : ""}
      ${l.status === "done" ? html`<div class="notice">${icon("checkCircle")}${t("listing.doneNotice")}</div>` : ""}

      <div class="detail-layout">
        <article class="detail-main">
          ${gallery(l)}
          <div class="detail-chips">
            <span class="chip chip-type type-${l.type}">${typeLabel(l.type)}</span>
            <span class="chip">${icon(cat.icon)}${categoryName(l.category)}</span>
            ${l.urgent ? html`<span class="chip chip-urgent">${icon("zap")}${t("listing.urgent")}</span>` : ""}
            ${l.demo ? html`<span class="chip chip-muted" title="${t("demo.chipTitle")}">${icon("info")}${t("demo.chip")}</span>` : ""}
          </div>
          <h1 class="h1 detail-title">${listingTitle(l)}</h1>
          <p class="detail-sub">${icon("pin")}${l.npa ? `${l.npa} ` : ""}${l.city}, ${cantonName(l.canton)}${dist !== null ? html` · <strong>${fmtDistance(dist)}</strong>` : ""} · ${t("listing.published", { when: fmtRelative(l.created) })}</p>

          <dl class="facts">
            ${fact("calendar", t("listing.date"), l.date ? fmtDate(l.date + "T12:00:00", { weekday: "long", day: "numeric", month: "long" }) : t("listing.flexibleDate"))}
            ${fact("clock", t("listing.time"), l.time ? `${l.time} · ${fmtDuration(l.duration)}` : fmtDuration(l.duration))}
            ${fact("repeat", t("listing.recurrence"), t("recurrence." + (l.recurrence || "once")))}
            ${fact("coins", t("listing.payment"), priceLabel(l))}
            ${l.languages?.length ? fact("languages", t("listing.languages"), l.languages.map(languageName).join(", ")) : ""}
          </dl>

          <section class="detail-section">
            <h2 class="h3">${t("listing.description")}</h2>
            <p class="prose-text">${text}</p>
            ${showTranslate ? html`<p class="translate-note">${icon("languages")}${t("listing.writtenIn", { lang: languageName(sourceLang) })} · <a href="${deeplUrl}" target="_blank" rel="noopener noreferrer">${t("listing.translate")}</a></p>` : ""}
          </section>

          <section class="detail-section">
            <h2 class="h3">${t("listing.where")}</h2>
            <div id="detail-map" class="map map-detail" role="region" aria-label="${t("listing.mapLabel")}"></div>
            <p class="map-note">${icon("shield")}${t("listing.approxLocation")}</p>
          </section>

          <aside class="safety-box">
            <h2 class="h4">${icon("shieldCheck")}${t("safety.boxTitle")}</h2>
            <ul>
              <li>${t("safety.tip1")}</li>
              <li>${t("safety.tip2")}</li>
              <li>${t("safety.tip3")}</li>
            </ul>
            <a href="#/page/securite">${t("safety.more")}</a>
          </aside>
        </article>

        <aside class="detail-side">
          <div class="side-card price-card">
            <div class="price-big${l.payment === "free" ? " is-free" : ""}">${priceLabel(l)}</div>
            ${l.payment === "paid" && l.unit === "total" ? html`<p class="muted small">${t("listing.totalHint")}</p>` : ""}
            <div class="side-actions">
              ${owner
                ? html`<a class="btn btn-primary btn-block" href="#/publier?edit=${l.id}">${icon("pencil")}${t("listing.edit")}</a>
                  <button type="button" class="btn btn-ghost btn-block" data-action="listing-status" data-id="${l.id}" data-status="${l.status === "done" ? "active" : "done"}">${icon(l.status === "done" ? "refresh" : "checkCircle")}${l.status === "done" ? t("listing.reactivate") : t("listing.markDone")}</button>
                  <button type="button" class="btn btn-danger-ghost btn-block" data-action="listing-delete" data-id="${l.id}">${icon("trash")}${t("listing.delete")}</button>`
                : html`<button type="button" class="btn btn-primary btn-block btn-lg" data-action="contact" data-id="${l.id}" ${l.status !== "active" ? raw("disabled") : ""}>${icon("message")}${t("listing.contact")}</button>`}
              <div class="side-row">
                <button type="button" class="btn btn-ghost fav-toggle${fav ? " is-active" : ""}" data-action="fav" data-id="${l.id}" aria-pressed="${fav ? "true" : "false"}">${icon("heart")}<span>${fav ? t("fav.saved") : t("fav.save")}</span></button>
                <button type="button" class="btn btn-ghost" data-action="share" data-id="${l.id}">${icon("share")}<span>${t("listing.share")}</span></button>
              </div>
              ${l.date ? html`<button type="button" class="btn btn-ghost btn-block" data-action="ics" data-id="${l.id}">${icon("calendar")}${t("listing.addToCalendar")}</button>` : ""}
            </div>
          </div>

          <div class="side-card author-card">
            <div class="author-head">
              ${avatar(author, "lg")}
              <div>
                <a class="author-name" href="#/membre/${l.authorId}">${author?.name || t("common.formerMember")}</a>
                ${author?.verified ? html`<span class="badge badge-verified">${icon("badgeCheck")}${t("trust.verified")}</span>` : html`<span class="badge">${t("trust.notVerified")}</span>`}
                <div class="muted small">${icon("pin")}${author?.city || l.city}</div>
              </div>
            </div>
            <dl class="author-stats">
              <div><dt>${t("trust.rating")}</dt><dd>${stars(author?.rating)}</dd></div>
              <div><dt>${t("trust.reviews")}</dt><dd>${author?.reviews ?? 0}</dd></div>
              <div><dt>${t("trust.completed")}</dt><dd>${author?.completed ?? 0}</dd></div>
              <div><dt>${t("trust.memberSince")}</dt><dd>${author?.created ? fmtDate(author.created, { month: "short", year: "numeric" }) : "—"}</dd></div>
            </dl>
            <a class="btn btn-ghost btn-block" href="#/membre/${l.authorId}">${icon("user")}${t("trust.viewProfile")}</a>
          </div>

          ${!owner ? html`<div class="side-links">
            <button type="button" class="link-btn danger" data-action="report" data-type="listing" data-id="${l.id}">${icon("flag")}${t("report.listing")}</button>
            ${me ? html`<button type="button" class="link-btn" data-action="block" data-id="${l.authorId}">${icon("ban")}${t("block.user")}</button>` : ""}
          </div>` : ""}

          ${admin ? html`<div class="side-card admin-card">
            <h2 class="h4">${icon("shield")}${t("admin.moderation")}</h2>
            <button type="button" class="btn ${l.status === "hidden" ? "btn-primary" : "btn-danger"} btn-block" data-action="admin-hide" data-id="${l.id}" data-hidden="${l.status === "hidden" ? "0" : "1"}">${icon(l.status === "hidden" ? "eye" : "eyeOff")}${l.status === "hidden" ? t("admin.unhide") : t("admin.hide")}</button>
          </div>` : ""}
        </aside>
      </div>

      ${similar.length ? html`<section class="section-sm">
        <h2 class="h2">${t("listing.similar")}</h2>
        <div class="listing-grid">${similar.map(({ listing, distance }) => listingCard(listing, { distance }))}</div>
      </section>` : ""}
    </div>`;
  },

  mount(root) {
    const l = getListing(currentId);
    const el = $("#detail-map", root);
    if (l && el) map = detailMap(el, l);
  },

  onData(kind) {
    if (kind === "favorites") {
      const fav = isFavorite(currentId);
      document.querySelectorAll(`[data-action="fav"][data-id="${currentId}"]`).forEach((b) => {
        b.classList.toggle("is-active", fav);
        b.setAttribute("aria-pressed", fav ? "true" : "false");
        const span = b.querySelector("span");
        if (span) span.textContent = fav ? t("fav.saved") : t("fav.save");
      });
    }
  },

  unmount() {
    map?.remove();
    map = null;
  },
};

/* Actions propres à cette page */
const listingActions = {
  contact: (el) => {
    const me = currentUser();
    if (!me) {
      toast(t("auth.loginToContact"), "info");
      location.hash = `#/connexion?next=${encodeURIComponent("#/annonce/" + el.dataset.id)}`;
      return;
    }
    const conv = startConversation(el.dataset.id);
    if (conv) location.hash = `#/messages/${conv.id}`;
  },
  share: (el) => {
    const l = getListing(el.dataset.id);
    if (l) shareLink(`${location.href.split("#")[0]}#/annonce/${l.id}`, listingTitle(l));
  },
  ics: (el) => {
    const l = getListing(el.dataset.id);
    if (l) { downloadIcs([l], `voisina-${l.id}.ics`); toast(t("calendar.icsDone"), "success"); }
  },
  report: (el) => reportDialog(el.dataset.type, el.dataset.id),
  block: async (el) => {
    const person = getPerson(el.dataset.id);
    const blocking = !isBlocked(el.dataset.id);
    if (blocking && !(await confirmDialog({ title: t("block.confirmTitle", { name: person?.name || "" }), text: t("block.confirmText"), confirm: t("block.confirm"), danger: true }))) return;
    const now = toggleBlock(el.dataset.id);
    toast(now ? t("block.done") : t("block.undone"), "success");
    if (now && location.hash.startsWith("#/annonce/")) location.hash = "#/explorer";
  },
  "listing-status": (el) => {
    if (setListingStatus(el.dataset.id, el.dataset.status)) toast(el.dataset.status === "done" ? t("listing.markedDone") : t("listing.reactivated"), "success");
  },
  "listing-delete": async (el) => {
    if (!(await confirmDialog({ title: t("listing.deleteTitle"), text: t("listing.deleteText"), confirm: t("listing.delete"), danger: true }))) return;
    if (deleteListing(el.dataset.id)) {
      toast(t("listing.deleted"), "success");
      if (location.hash.startsWith("#/annonce/")) location.hash = "#/compte?tab=listings";
    }
  },
  "admin-hide": (el) => {
    const hide = el.dataset.hidden === "1";
    if (setListingHidden(el.dataset.id, hide)) toast(hide ? t("admin.hidden") : t("admin.unhidden"), "success");
  },
  gallery: (el) => {
    const l = getListing(currentId);
    const photo = safeImageSrc(l?.photos?.[Number(el.dataset.index)]);
    if (photo) {
      $("#gallery-main").src = photo;
      document.querySelectorAll(".gallery-thumb").forEach((b) => b.classList.toggle("is-active", b === el));
    }
  },
};



return { listingActions, default: __default, pick };
});
__def("views/publish.js", function () {
/* Page "Publier / modifier une annonce" */
const { html, raw, $, $$, mount, storage, processImage, detectSensitive, todayKey, debounce } = __req("util.js");
const { icon } = __req("icons.js");
const { t, getLang, categoryName } = __req("i18n.js");
const { CATEGORIES, TYPES, PAYMENTS, UNITS, DURATIONS, RECURRENCES, getCategory } = __req("data.js");
const { currentUser, createListing, updateListing, getListing, isAdmin, validateListing } = __req("store.js");
const { listingCard, localityField, initLocalityFields, langChips, toast, emptyState, confirmDialog } = __req("ui.js");

let photos = [];
let editId = null;

const TYPE_ICONS = { offer: "hand", request: "help", donation: "gift" };
const PAY_ICONS = { free: "heart", paid: "coins", negotiable: "message" };

function readForm(form) {
  const fd = new FormData(form);
  return {
    type: fd.get("type"),
    title: fd.get("title"),
    category: fd.get("category"),
    description: fd.get("description"),
    city: fd.get("city"),
    canton: fd.get("canton"),
    npa: fd.get("npa"),
    lat: fd.get("lat") || undefined,
    lng: fd.get("lng") || undefined,
    date: fd.get("date"),
    time: fd.get("time"),
    duration: fd.get("duration"),
    recurrence: fd.get("recurrence"),
    urgent: fd.get("urgent") === "1",
    payment: fd.get("payment"),
    amount: fd.get("amount"),
    unit: fd.get("unit"),
    languages: fd.getAll("languages"),
    photos,
    lang: getLang(),
  };
}

function previewListing(data) {
  const cat = CATEGORIES.some((c) => c.id === data.category) ? data.category : "other";
  return {
    id: "preview",
    authorId: currentUser()?.id,
    type: TYPES.includes(data.type) ? data.type : "offer",
    category: cat,
    title: data.title?.trim() || t("publish.previewTitle"),
    description: data.description || "",
    payment: data.payment || "free",
    amount: Number(data.amount) || 0,
    unit: data.unit || "total",
    date: data.date || null,
    time: data.time || null,
    city: data.city || t("publish.previewCity"),
    canton: data.canton || "—",
    urgent: data.urgent,
    photos,
    status: "active",
  };
}

function field(name, label, control, { required = false, hint = "", counter = 0 } = {}) {
  return html`<div class="field" data-field="${name}">
    <label class="field-label" for="f-${name}">${label}${required ? html` <span class="req" aria-hidden="true">*</span>` : ""}</label>
    ${control}
    <div class="field-foot">${hint ? html`<p class="help">${hint}</p>` : html`<span></span>`}${counter ? html`<span class="counter" data-counter="${name}">0 / ${counter}</span>` : ""}</div>
    <p class="field-error" id="err-${name}" hidden></p>
  </div>`;
}

function photoList() {
  return html`${photos.map((p, i) => html`<div class="photo-item"><img src="${p}" alt="${t("listing.photoN", { n: i + 1 })}"><button type="button" class="icon-btn icon-btn-sm" data-action="remove-photo" data-index="${i}" aria-label="${t("publish.removePhoto")}">${icon("x")}</button></div>`)}
  ${photos.length < 3 ? html`<label class="photo-add">${icon("camera")}<span>${t("publish.addPhoto")}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-photo-input class="sr-only"></label>` : ""}`;
}

const __default = {
  title: (ctx) => (ctx.query.get("edit") ? t("publish.editTitle") : t("publish.title")),
  refreshOn: ["auth"],

  render(ctx) {
    const me = currentUser();
    editId = ctx.query.get("edit");
    if (!me) {
      return html`<section class="section"><div class="container narrow">
        ${emptyState({
          iconName: "pencil",
          title: t("publish.gateTitle"),
          text: t("publish.gateText"),
          action: html`<div class="empty-actions"><a class="btn btn-primary" href="#/connexion?mode=register&next=${encodeURIComponent("#/publier")}">${t("auth.createAccount")}</a><a class="btn btn-ghost" href="#/connexion?next=${encodeURIComponent("#/publier")}">${t("auth.login")}</a></div>`,
        })}
      </div></section>`;
    }

    let v = {};
    if (editId) {
      const l = getListing(editId);
      if (!l || l.demo || (l.authorId !== me.id && !isAdmin())) {
        return html`<section class="section"><div class="container narrow">${emptyState({ iconName: "lock", title: t("publish.cannotEdit"), action: html`<a class="btn btn-primary" href="#/compte?tab=listings">${t("account.myListings")}</a>` })}</div></section>`;
      }
      v = { ...l };
      photos = [...(l.photos || [])];
    } else {
      v = storage.get("draft", {}) || {};
      photos = Array.isArray(v.photos) ? v.photos.slice(0, 3) : [];
    }
    const hasDraft = !editId && (v.title || v.description);
    const type = TYPES.includes(v.type) ? v.type : "offer";
    const payment = PAYMENTS.includes(v.payment) ? v.payment : "free";

    return html`
    <section class="page-head">
      <div class="container">
        <span class="kicker">${editId ? t("publish.editKicker") : t("publish.kicker")}</span>
        <h1 class="h1">${editId ? t("publish.editTitle") : t("publish.title")}</h1>
        <p class="lead">${t("publish.lead")}</p>
      </div>
    </section>

    <div class="container publish-layout">
      <form class="publish-form" id="publish-form" novalidate>
        ${hasDraft ? html`<div class="notice">${icon("info")}<span>${t("publish.draftRestored")}</span><button type="button" class="link-btn" data-action="clear-draft">${t("publish.clearDraft")}</button></div>` : ""}
        <p class="field-error form-error" id="err-form" hidden></p>

        <fieldset class="form-section">
          <legend><span class="step-badge">1</span>${t("publish.sType")}</legend>
          <div class="radio-cards">
            ${TYPES.map((ty) => html`<label class="radio-card"><input type="radio" name="type" value="${ty}" ${ty === type ? raw("checked") : ""}>
              <span class="radio-card-inner">${icon(TYPE_ICONS[ty])}<strong>${t("type." + ty)}</strong><small>${t("publish.type." + ty)}</small></span></label>`)}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend><span class="step-badge">2</span>${t("publish.sDetails")}</legend>
          ${field("title", t("publish.fTitle"), html`<input id="f-title" class="input" name="title" maxlength="90" required value="${typeof v.title === "string" ? v.title : ""}" placeholder="${t("publish.fTitlePh")}">`, { required: true, counter: 90 })}
          ${field("category", t("publish.fCategory"), html`<select id="f-category" class="select" name="category" required>
            <option value="">${t("publish.chooseCategory")}</option>
            ${CATEGORIES.map((c) => html`<option value="${c.id}" ${v.category === c.id ? raw("selected") : ""}>${categoryName(c.id)}</option>`)}
          </select>`, { required: true })}
          ${field("description", t("publish.fDescription"), html`<textarea id="f-description" class="input textarea" name="description" rows="6" maxlength="1500" required placeholder="${t("publish.fDescriptionPh")}">${typeof v.description === "string" ? v.description : ""}</textarea>`, { required: true, counter: 1500, hint: t("publish.fDescriptionHint") })}
          <div id="sensitive-warning" class="notice notice-warn" hidden></div>
        </fieldset>

        <fieldset class="form-section">
          <legend><span class="step-badge">3</span>${t("publish.sWhere")}</legend>
          ${localityField({ name: "city", label: t("publish.fCity"), value: v.city || me.city || "", canton: v.canton || me.canton || "", npa: v.npa || "", required: true })}
          <p class="field-error" id="err-city" hidden></p>
          <p class="help">${icon("shield")}${t("publish.privacyHint")}</p>
        </fieldset>

        <fieldset class="form-section">
          <legend><span class="step-badge">4</span>${t("publish.sWhen")}</legend>
          <div class="grid-2">
            ${field("date", t("publish.fDate"), html`<input id="f-date" class="input" type="date" name="date" min="${todayKey()}" value="${v.date || ""}">`, { hint: t("publish.fDateHint") })}
            ${field("time", t("publish.fTime"), html`<input id="f-time" class="input" type="time" name="time" value="${v.time || ""}">`)}
            ${field("duration", t("publish.fDuration"), html`<select id="f-duration" class="select" name="duration">
              <option value="">${t("common.flexible")}</option>
              ${DURATIONS.map((d) => html`<option value="${d}" ${Number(v.duration) === d ? raw("selected") : ""}>${t("duration." + d)}</option>`)}
            </select>`)}
            ${field("recurrence", t("publish.fRecurrence"), html`<select id="f-recurrence" class="select" name="recurrence">
              ${RECURRENCES.map((r) => html`<option value="${r}" ${v.recurrence === r ? raw("selected") : ""}>${t("recurrence." + r)}</option>`)}
            </select>`)}
          </div>
          <label class="check"><input type="checkbox" name="urgent" value="1" ${v.urgent ? raw("checked") : ""}><span>${icon("zap")}${t("publish.fUrgent")}</span></label>
        </fieldset>

        <fieldset class="form-section">
          <legend><span class="step-badge">5</span>${t("publish.sPayment")}</legend>
          <div class="radio-cards">
            ${PAYMENTS.map((p) => html`<label class="radio-card"><input type="radio" name="payment" value="${p}" ${p === payment ? raw("checked") : ""}>
              <span class="radio-card-inner">${icon(PAY_ICONS[p])}<strong>${t("pay." + p)}</strong><small>${t("publish.pay." + p)}</small></span></label>`)}
          </div>
          <div class="grid-2 pay-fields" id="pay-fields" ${payment !== "paid" ? raw("hidden") : ""}>
            ${field("amount", t("publish.fAmount"), html`<div class="input-affix"><span>CHF</span><input id="f-amount" class="input" type="number" name="amount" min="1" max="5000" step="0.5" inputmode="decimal" value="${v.amount || ""}"></div>`)}
            ${field("unit", t("publish.fUnit"), html`<select id="f-unit" class="select" name="unit">${UNITS.map((u) => html`<option value="${u}" ${v.unit === u ? raw("selected") : ""}>${t("unit." + u)}</option>`)}</select>`)}
          </div>
          <p class="help">${icon("info")}${t("publish.payHint")}</p>
        </fieldset>

        <fieldset class="form-section">
          <legend><span class="step-badge">6</span>${t("publish.sExtras")}</legend>
          <div class="field">
            <span class="field-label">${t("publish.fPhotos")}</span>
            <div class="photo-grid" id="photo-grid">${photoList()}</div>
            <p class="help">${icon("shield")}${t("publish.photoHint")}</p>
          </div>
          <div class="field">
            <span class="field-label">${t("publish.fLanguages")}</span>
            ${langChips("languages", v.languages || me.languages || [getLang()])}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend><span class="step-badge">7</span>${t("publish.sConfirm")}</legend>
          <label class="check"><input type="checkbox" name="rules" value="1" required ${editId ? raw("checked") : ""}><span>${t("publish.cRules")} <a href="#/page/regles" target="_blank" rel="noopener">${t("publish.cRulesLink")}</a></span></label>
          <label class="check"><input type="checkbox" name="honest" value="1" required ${editId ? raw("checked") : ""}><span>${t("publish.cHonest")}</span></label>
          <p class="field-error" id="err-confirm" hidden></p>
        </fieldset>

        <div class="form-actions">
          <a class="btn btn-ghost" href="${editId ? `#/annonce/${editId}` : "#/"}">${t("common.cancel")}</a>
          <button type="submit" class="btn btn-primary btn-lg">${icon(editId ? "check" : "send")}${editId ? t("publish.save") : t("publish.submit")}</button>
        </div>
      </form>

      <aside class="publish-preview" aria-label="${t("publish.preview")}">
        <div class="preview-sticky">
          <p class="kicker">${icon("eye")}${t("publish.preview")}</p>
          <div id="preview-card"></div>
          <div class="tips-card">
            <h2 class="h4">${icon("sparkles")}${t("publish.tipsTitle")}</h2>
            <ul><li>${t("publish.tip1")}</li><li>${t("publish.tip2")}</li><li>${t("publish.tip3")}</li></ul>
          </div>
        </div>
      </aside>
    </div>`;
  },

  mount(root) {
    const form = $("#publish-form", root);
    if (!form) return;
    initLocalityFields(root);

    const updatePreview = () => {
      if (!form.isConnected) return; // la page a changé entre-temps
      const data = readForm(form);
      mount($("#preview-card"), listingCard(previewListing(data)));
      $("#pay-fields").hidden = data.payment !== "paid";
      $$("[data-counter]", form).forEach((c) => {
        const input = form.elements[c.dataset.counter];
        const max = input.maxLength;
        c.textContent = `${input.value.length} / ${max}`;
        c.classList.toggle("is-near", input.value.length > max * 0.9);
      });
      const found = detectSensitive(`${data.title} ${data.description}`);
      const warn = $("#sensitive-warning");
      if (found.length) {
        mount(warn, html`${icon("alert")}<span>${t("safety.sensitive." + (found.includes("scam") ? "scam" : found.includes("iban") ? "iban" : "contact"))}</span>`);
        warn.hidden = false;
      } else warn.hidden = true;
      if (!editId) storage.set("draft", { ...data, photos: photos.slice(0, 3) });
    };
    const debounced = debounce(updatePreview, 120);
    form.addEventListener("input", debounced);
    form.addEventListener("change", debounced);
    form.addEventListener("locality-change", debounced);
    updatePreview();

    // Photos : vérification du format réel + suppression des métadonnées (GPS)
    form.addEventListener("change", async (e) => {
      if (!e.target.matches("[data-photo-input]")) return;
      const files = [...e.target.files].slice(0, 3 - photos.length);
      for (const file of files) {
        try {
          photos.push(await processImage(file, 1100, 0.8));
        } catch (err) {
          toast(t(err.message === "too-large" ? "publish.photoTooLarge" : "publish.photoBadType"), "error");
        }
      }
      mount($("#photo-grid"), photoList());
      updatePreview();
    });
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action='remove-photo']");
      if (!btn) return;
      photos.splice(Number(btn.dataset.index), 1);
      mount($("#photo-grid"), photoList());
      updatePreview();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      $$(".field-error", form).forEach((el) => { el.hidden = true; });
      $$("[aria-invalid]", form).forEach((el) => el.removeAttribute("aria-invalid"));
      const errors = {};
      if (!form.elements.rules.checked || !form.elements.honest.checked) errors.confirm = "confirm";
      const data = readForm(form);
      let result = { ok: false, errors: {} };
      if (!Object.keys(errors).length) {
        result = editId ? updateListing(editId, data) : createListing(data);
      } else {
        // Valide quand même le reste pour tout afficher d'un coup
        result = { ok: false, errors: { ...errors, ...(createListingDry(data)) } };
      }
      if (result.ok) {
        if (!editId) storage.remove("draft");
        photos = [];
        toast(editId ? t("publish.saved") : t("publish.published"), "success");
        location.hash = `#/annonce/${result.listing.id}`;
        return;
      }
      showErrors(form, result.errors);
    });
  },

  unmount() { editId = null; },
};

function createListingDry(data) {
  return validateListing(data).errors || {};
}

function showErrors(form, errors) {
  let first = null;
  for (const [key, code] of Object.entries(errors || {})) {
    const el = $(`#err-${key}`);
    if (el) {
      el.textContent = t(`err.${code}`);
      el.hidden = false;
    }
    const input = form.elements[key];
    if (input && input.setAttribute) {
      input.setAttribute("aria-invalid", "true");
      if (el) input.setAttribute("aria-describedby", el.id);
    }
    if (!first) first = (input && input.focus ? input : null) || el;
  }
  if (first) {
    first.scrollIntoView?.({ behavior: "smooth", block: "center" });
    first.focus?.({ preventScroll: true });
  }
  toast(t("err.formHasErrors"), "error");
}

const publishActions = {
  "clear-draft": async () => {
    storage.remove("draft");
    photos = [];
    location.hash = "#/publier?new=" + Date.now();
  },
};



return { publishActions, default: __default, getCategory, confirmDialog };
});
__def("views/messages.js", function () {
/* Messagerie */
const { html, raw, $, mount, detectSensitive } = __req("util.js");
const { icon } = __req("icons.js");
const { t, fmtTime, fmtDate, fmtRelative } = __req("i18n.js");
const { currentUser, getConversations, getConversation, otherParticipant, getPerson, getListing, unreadCount, sendMessage, markConversationRead, typing, deleteConversation } = __req("store.js");
const { avatar, emptyState, listingTitle, confirmDialog, reportDialog, toast } = __req("ui.js");
const { getDemoData } = __req("seed.js");

let activeId = null;

function convItem(c) {
  const other = getPerson(otherParticipant(c));
  const listing = getListing(c.listingId);
  const last = c.messages[c.messages.length - 1];
  const unread = unreadCount(c);
  const me = currentUser();
  return html`<a class="conv-item${c.id === activeId ? " is-active" : ""}${unread ? " is-unread" : ""}" href="#/messages/${c.id}" ${c.id === activeId ? raw('aria-current="true"') : ""}>
    ${avatar(other, "md")}
    <span class="conv-body">
      <span class="conv-top"><strong>${other?.name || t("common.formerMember")}</strong><span class="conv-time">${last ? fmtRelative(last.at) : ""}</span></span>
      <span class="conv-listing">${listing ? listingTitle(listing) : t("messages.listingGone")}</span>
      <span class="conv-preview">${last ? (last.from === me?.id ? t("messages.you") + " " : "") + last.text : t("messages.noMessagesYet")}</span>
    </span>
    ${unread ? html`<span class="badge-count" aria-label="${t("messages.unread", { count: unread })}">${unread}</span>` : ""}
  </a>`;
}

function listPane() {
  const convs = getConversations();
  if (!convs.length) {
    return emptyState({ iconName: "message", title: t("messages.emptyTitle"), text: t("messages.emptyText"), action: html`<a class="btn btn-primary" href="#/explorer">${t("messages.findListing")}</a>` });
  }
  return html`${convs.map(convItem)}`;
}

function messagesPane(c) {
  const me = currentUser();
  const otherId = otherParticipant(c);
  const other = getPerson(otherId);
  let lastDay = "";
  const items = [];
  for (const m of c.messages) {
    const day = new Date(m.at).toDateString();
    if (day !== lastDay) {
      lastDay = day;
      items.push(html`<div class="chat-day"><span>${fmtDate(m.at, { weekday: "long", day: "numeric", month: "long" })}</span></div>`);
    }
    const mine = m.from === me.id;
    items.push(html`<div class="bubble-row${mine ? " is-mine" : ""}">
      ${!mine ? avatar(other, "xs") : ""}
      <div class="bubble"><p>${m.text}</p><span class="bubble-time">${fmtTime(m.at)}${mine ? html` ${icon("check")}` : ""}</span></div>
    </div>`);
  }
  if (typing.has(c.id)) items.push(html`<div class="bubble-row">${avatar(other, "xs")}<div class="bubble typing" aria-label="${t("messages.typing", { name: other?.name || "" })}"><span></span><span></span><span></span></div></div>`);
  return html`
    <div class="chat-safety">${icon("shieldCheck")}<span>${t("messages.safetyBanner")}</span> <a href="#/page/securite">${t("safety.more")}</a></div>
    ${!c.messages.length ? html`<p class="chat-hint">${t("messages.firstHint")}</p>` : ""}
    ${items}`;
}

function chatPane(c) {
  const otherId = otherParticipant(c);
  const other = getPerson(otherId);
  const listing = getListing(c.listingId);
  const demo = getDemoData().authorsById.has(otherId);
  return html`
  <header class="chat-head">
    <a class="icon-btn chat-back" href="#/messages" aria-label="${t("common.back")}">${icon("arrowLeft")}</a>
    ${avatar(other, "md")}
    <div class="chat-head-info">
      <a class="chat-name" href="#/membre/${otherId}">${other?.name || t("common.formerMember")}</a>
      ${listing ? html`<a class="chat-listing" href="#/annonce/${listing.id}">${icon("file")}${listingTitle(listing)}</a>` : ""}
    </div>
    <div class="chat-head-actions">
      <button type="button" class="icon-btn" data-action="report" data-type="conversation" data-id="${c.id}" aria-label="${t("report.conversation")}" title="${t("report.conversation")}">${icon("flag")}</button>
      <button type="button" class="icon-btn" data-action="block" data-id="${otherId}" aria-label="${t("block.user")}" title="${t("block.user")}">${icon("ban")}</button>
      <button type="button" class="icon-btn" data-action="delete-conv" data-id="${c.id}" aria-label="${t("messages.delete")}" title="${t("messages.delete")}">${icon("trash")}</button>
    </div>
  </header>
  ${demo ? html`<p class="chat-demo">${icon("info")}${t("messages.demoNotice")}</p>` : ""}
  <div class="chat-messages" id="chat-messages" aria-live="polite">${messagesPane(c)}</div>
  <form class="chat-composer" id="chat-composer" data-id="${c.id}">
    <div id="composer-warning" class="composer-warning" hidden></div>
    <div class="composer-row">
      <label for="chat-input" class="sr-only">${t("messages.placeholder")}</label>
      <textarea id="chat-input" class="input" name="text" rows="1" maxlength="1000" placeholder="${t("messages.placeholder")}" autocomplete="off"></textarea>
      <button type="submit" class="btn btn-primary btn-send" aria-label="${t("messages.send")}">${icon("send")}</button>
    </div>
  </form>`;
}

const __default = {
  title: () => t("meta.messagesTitle"),
  refreshOn: ["auth", "block"],

  render(ctx) {
    const me = currentUser();
    if (!me) {
      return html`<section class="section"><div class="container narrow">${emptyState({
        iconName: "message", title: t("messages.gateTitle"), text: t("messages.gateText"),
        action: html`<div class="empty-actions"><a class="btn btn-primary" href="#/connexion?next=${encodeURIComponent("#/messages")}">${t("auth.login")}</a><a class="btn btn-ghost" href="#/connexion?mode=register&next=${encodeURIComponent("#/messages")}">${t("auth.createAccount")}</a></div>`,
      })}</div></section>`;
    }
    activeId = ctx.params[0] || null;
    const conv = activeId ? getConversation(activeId) : null;
    if (activeId && !conv) activeId = null;
    if (conv) markConversationRead(conv.id);

    return html`
    <div class="container messages-wrap">
      <h1 class="h1 messages-title">${t("messages.title")}</h1>
      <div class="messages-app${conv ? " has-active" : ""}">
        <nav class="conv-list" id="conv-list" aria-label="${t("messages.conversations")}">${listPane()}</nav>
        <section class="chat" id="chat">
          ${conv ? chatPane(conv) : html`<div class="chat-empty">${icon("message")}<p>${t("messages.selectConv")}</p></div>`}
        </section>
      </div>
    </div>`;
  },

  mount(root) {
    const msgs = $("#chat-messages", root);
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    const form = $("#chat-composer", root);
    if (!form) return;
    const input = $("#chat-input", form);
    const warn = $("#composer-warning", form);
    const autosize = () => {
      input.style.height = "auto";
      input.style.height = Math.min(160, input.scrollHeight) + "px";
      const found = detectSensitive(input.value);
      if (found.length) {
        mount(warn, html`${icon("alert")}<span>${t("safety.sensitive." + (found.includes("scam") ? "scam" : found.includes("iban") ? "iban" : "contactChat"))}</span>`);
        warn.hidden = false;
      } else warn.hidden = true;
    };
    input.addEventListener("input", autosize);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const res = sendMessage(form.dataset.id, text);
      if (res.ok) {
        input.value = "";
        autosize();
      } else toast(t("err.generic"), "error");
    });
    if (window.matchMedia("(min-width: 900px)").matches) input.focus({ preventScroll: true });
  },

  onData(kind) {
    if (!["messages", "typing", "read"].includes(kind) || !currentUser()) return;
    const list = $("#conv-list");
    if (list) mount(list, listPane());
    const conv = activeId ? getConversation(activeId) : null;
    const msgs = $("#chat-messages");
    if (conv && msgs) {
      if (kind === "messages") markConversationRead(conv.id);
      mount(msgs, messagesPane(conv));
      msgs.scrollTop = msgs.scrollHeight;
    }
  },

  unmount() { activeId = null; },
};

const messagesActions = {
  "delete-conv": async (el) => {
    if (!(await confirmDialog({ title: t("messages.deleteTitle"), text: t("messages.deleteText"), confirm: t("messages.delete"), danger: true }))) return;
    deleteConversation(el.dataset.id);
    toast(t("messages.deleted"), "success");
    location.hash = "#/messages";
  },
};



return { messagesActions, default: __default, reportDialog };
});
__def("views/planning.js", function () {
/* Mon planning : favoris + calendrier + export agenda */
const { html, raw, $, mount, dateKey, parseDateKey } = __req("util.js");
const { icon } = __req("icons.js");
const { t, locale, fmtDate, fmtDuration } = __req("i18n.js");
const { getCategory } = __req("data.js");
const { getFavorites, getListing, clearFavorites, currentUser } = __req("store.js");
const { listingCard, emptyState, confirmDialog, toast, listingTitle } = __req("ui.js");
const { downloadIcs } = __req("ics.js");

let cursor = null; // premier jour du mois affiché
let selectedDay = null;

function favListings() {
  return getFavorites().map(getListing).filter((l) => l && l.status !== "hidden");
}

/** Occurrences d'une annonce dans un mois (gère les récurrences). */
function occurrences(l, year, month) {
  if (!l.date) return [];
  const start = parseDateKey(l.date);
  if (!start) return [];
  const out = [];
  const last = new Date(year, month + 1, 0);
  if (l.recurrence === "weekly") {
    for (let d = new Date(start), n = 0; d <= last && n < 8; d.setDate(d.getDate() + 7), n++) {
      if (d.getMonth() === month && d.getFullYear() === year) out.push(dateKey(d));
    }
  } else if (l.recurrence === "monthly") {
    for (let d = new Date(start), n = 0; d <= last && n < 6; d.setMonth(d.getMonth() + 1), n++) {
      if (d.getMonth() === month && d.getFullYear() === year) out.push(dateKey(d));
    }
  } else if (start.getMonth() === month && start.getFullYear() === year) out.push(l.date);
  return out;
}

function calendar() {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const favs = favListings();
  const byDay = {};
  favs.forEach((l) => occurrences(l, year, month).forEach((k) => (byDay[k] ||= []).push(l)));
  Object.values(byDay).forEach((list) => list.sort((a, b) => (a.time || "").localeCompare(b.time || "")));

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // lundi en premier (usage suisse)
  const today = dateKey(new Date());
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(new Date(2024, 0, 1 + i)));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i);
    const key = dateKey(d);
    const events = byDay[key] || [];
    const other = d.getMonth() !== month;
    if (i >= 35 && other && d.getDate() < 8 && i % 7 === 0) break; // évite une 6e ligne vide
    cells.push(html`<button type="button" class="cal-day${other ? " is-other" : ""}${key === today ? " is-today" : ""}${key === selectedDay ? " is-selected" : ""}${events.length ? " has-events" : ""}" data-action="cal-day" data-day="${key}" aria-label="${fmtDate(d, { weekday: "long", day: "numeric", month: "long" })}${events.length ? ` — ${t("planning.eventsCount", { count: events.length })}` : ""}">
      <span class="cal-num">${d.getDate()}</span>
      <span class="cal-events">${events.slice(0, 3).map((l) => html`<span class="cal-event tone-${getCategory(l.category).tone}"><span class="cal-event-time">${l.time || ""}</span> ${listingTitle(l)}</span>`)}
      ${events.length > 3 ? html`<span class="cal-more">+${events.length - 3}</span>` : ""}</span>
      ${events.length ? html`<span class="cal-dots" aria-hidden="true">${events.slice(0, 4).map((l) => html`<i class="tone-${getCategory(l.category).tone}"></i>`)}</span>` : ""}
    </button>`);
  }

  const monthEvents = [];
  favs.forEach((l) => occurrences(l, year, month).forEach((k) => monthEvents.push({ key: k, l })));
  monthEvents.sort((a, b) => (a.key + (a.l.time || "")).localeCompare(b.key + (b.l.time || "")));
  const shown = selectedDay ? monthEvents.filter((e) => e.key === selectedDay) : monthEvents;

  return html`
  <div class="cal-head">
    <h2 class="h3 cal-title">${fmtDate(first, { month: "long", year: "numeric" })}</h2>
    <div class="cal-nav">
      <button type="button" class="icon-btn" data-action="cal-move" data-delta="-1" aria-label="${t("planning.prevMonth")}">${icon("chevronLeft")}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-action="cal-today">${t("planning.today")}</button>
      <button type="button" class="icon-btn" data-action="cal-move" data-delta="1" aria-label="${t("planning.nextMonth")}">${icon("chevronRight")}</button>
    </div>
  </div>
  <div class="cal-grid" role="grid">
    ${weekdays.map((w) => html`<div class="cal-weekday" role="columnheader">${w}</div>`)}
    ${cells}
  </div>
  <div class="agenda">
    <h3 class="h4">${selectedDay ? fmtDate(selectedDay + "T12:00:00", { weekday: "long", day: "numeric", month: "long" }) : t("planning.thisMonth")}
      ${selectedDay ? html`<button type="button" class="link-btn" data-action="cal-day" data-day="${selectedDay}">${t("planning.showMonth")}</button>` : ""}</h3>
    ${shown.length
      ? html`<ul class="agenda-list">${shown.map(({ key, l }) => html`<li class="agenda-item">
          <span class="agenda-date"><strong>${fmtDate(key + "T12:00:00", { day: "numeric" })}</strong><span>${fmtDate(key + "T12:00:00", { month: "short" })}</span></span>
          <span class="agenda-body"><a href="#/annonce/${l.id}">${listingTitle(l)}</a><span class="muted small">${l.time ? l.time + " · " : ""}${fmtDuration(l.duration)} · ${l.city}</span></span>
          <button type="button" class="icon-btn" data-action="ics" data-id="${l.id}" aria-label="${t("listing.addToCalendar")}" title="${t("listing.addToCalendar")}">${icon("download")}</button>
        </li>`)}</ul>`
      : html`<p class="muted">${t("planning.noEvents")}</p>`}
  </div>`;
}

const __default = {
  title: () => t("meta.planningTitle"),
  refreshOn: ["auth", "listings"],

  render() {
    if (!cursor) { cursor = new Date(); cursor.setDate(1); }
    const favs = favListings();
    const dated = favs.filter((l) => l.date);
    const me = currentUser();
    return html`
    <section class="page-head">
      <div class="container page-head-row">
        <div>
          <span class="kicker">${t("planning.kicker")}</span>
          <h1 class="h1">${t("planning.title")}</h1>
          <p class="lead">${t("planning.lead")}</p>
        </div>
        <div class="page-head-actions">
          <button type="button" class="btn btn-primary" data-action="ics-all" ${dated.length ? "" : raw("disabled")}>${icon("download")}${t("planning.exportAll")}</button>
        </div>
      </div>
    </section>
    <div class="container planning-layout">
      <section class="card cal-card" aria-label="${t("planning.calendar")}" id="calendar">${calendar()}</section>
      <section class="fav-section" aria-labelledby="fav-title">
        <div class="section-head section-head-sm">
          <h2 class="h3" id="fav-title">${icon("heart")}${t("planning.favorites")} <span class="count-pill">${favs.length}</span></h2>
          ${favs.length ? html`<button type="button" class="link-btn" data-action="clear-favs">${t("planning.clearFavs")}</button>` : ""}
        </div>
        ${!me && favs.length ? html`<p class="notice">${icon("info")}<span>${t("planning.guestNotice")}</span> <a href="#/connexion?next=${encodeURIComponent("#/planning")}">${t("auth.login")}</a></p>` : ""}
        ${favs.length
          ? html`<div class="listing-grid listing-grid-compact" id="fav-grid">${favs.map((l) => listingCard(l))}</div>`
          : emptyState({ iconName: "heart", title: t("planning.emptyTitle"), text: t("planning.emptyText"), action: html`<a class="btn btn-primary" href="#/explorer">${t("planning.explore")}</a>` })}
      </section>
    </div>`;
  },

  onData(kind) {
    if (kind === "favorites") {
      const view = document.getElementById("view");
      const y = window.scrollY;
      mount(view, this.render());
      window.scrollTo(0, y);
    }
  },
};

const planningActions = {
  "cal-move": (el) => {
    cursor.setMonth(cursor.getMonth() + Number(el.dataset.delta));
    selectedDay = null;
    mount($("#calendar"), calendar());
  },
  "cal-today": () => {
    cursor = new Date();
    cursor.setDate(1);
    selectedDay = dateKey(new Date());
    mount($("#calendar"), calendar());
  },
  "cal-day": (el) => {
    selectedDay = selectedDay === el.dataset.day ? null : el.dataset.day;
    const d = parseDateKey(el.dataset.day);
    if (d && (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear())) cursor = new Date(d.getFullYear(), d.getMonth(), 1);
    mount($("#calendar"), calendar());
  },
  "ics-all": () => {
    const list = favListings().filter((l) => l.date);
    if (!list.length) return;
    downloadIcs(list, "voisina-planning.ics");
    toast(t("calendar.icsDone"), "success");
  },
  "clear-favs": async () => {
    if (!(await confirmDialog({ title: t("planning.clearTitle"), text: t("planning.clearText"), confirm: t("planning.clearFavs"), danger: true }))) return;
    clearFavorites();
    toast(t("planning.cleared"), "success");
  },
};

return { planningActions, default: __default };
});
__def("views/auth.js", function () {
/* Connexion / inscription */
const { html, raw, $, $$, mount } = __req("util.js");
const { icon, logo } = __req("icons.js");
const { t } = __req("i18n.js");
const { login, register, currentUser, mergeGuestFavorites } = __req("store.js");
const { passwordStrength } = __req("auth.js");
const { localityField, initLocalityFields, toast } = __req("ui.js");

let mode = "login";
let next = "#/compte";

/** N'autorise que des redirections internes (évite les redirections malveillantes). */
function safeNext(value) {
  return /^#\/[\w\-/?=&%.]*$/.test(value || "") ? value : "#/compte";
}

function pwField(name, label, autocomplete, withMeter = false) {
  return html`<div class="field">
    <label class="field-label" for="f-${name}">${label}</label>
    <div class="input-icon input-password">${icon("lock")}
      <input id="f-${name}" class="input" type="password" name="${name}" autocomplete="${autocomplete}" required maxlength="128">
      <button type="button" class="icon-btn icon-btn-sm pw-toggle" data-action="toggle-pw" data-target="f-${name}" aria-label="${t("auth.showPassword")}" aria-pressed="false">${icon("eye")}</button>
    </div>
    ${withMeter ? html`<div class="pw-meter" aria-hidden="true"><span></span><span></span><span></span><span></span></div><p class="help" id="pw-help">${t("auth.pwRules")}</p>` : ""}
    <p class="field-error" id="err-${name}" hidden></p>
  </div>`;
}

function loginForm() {
  return html`<form id="login-form" class="auth-form" novalidate>
    <div class="field">
      <label class="field-label" for="f-identifier">${t("auth.email")}</label>
      <div class="input-icon">${icon("mail")}<input id="f-identifier" class="input" name="identifier" type="text" autocomplete="username" required maxlength="120" inputmode="email"></div>
    </div>
    ${pwField("password", t("auth.password"), "current-password")}
    <p class="field-error form-error" id="err-login" role="alert" hidden></p>
    <button type="submit" class="btn btn-primary btn-lg btn-block">${t("auth.login")}</button>
    <p class="auth-switch">${t("auth.noAccount")} <button type="button" class="link-btn" data-action="auth-mode" data-mode="register">${t("auth.createAccount")}</button></p>
    <details class="demo-hint"><summary>${icon("info")}${t("auth.demoTitle")}</summary><p>${t("auth.demoText")}</p></details>
  </form>`;
}

function registerForm() {
  return html`<form id="register-form" class="auth-form" novalidate>
    <div class="grid-2">
      <div class="field"><label class="field-label" for="f-firstname">${t("auth.firstname")}</label><input id="f-firstname" class="input" name="firstname" autocomplete="given-name" required maxlength="40"><p class="field-error" id="err-firstname" hidden></p></div>
      <div class="field"><label class="field-label" for="f-lastname">${t("auth.lastname")}</label><input id="f-lastname" class="input" name="lastname" autocomplete="family-name" required maxlength="40"><p class="field-error" id="err-lastname" hidden></p></div>
    </div>
    <p class="help">${icon("eyeOff")}${t("auth.nameHint")}</p>
    <div class="field">
      <label class="field-label" for="f-email">${t("auth.email")}</label>
      <div class="input-icon">${icon("mail")}<input id="f-email" class="input" name="email" type="email" autocomplete="email" required maxlength="120"></div>
      <p class="field-error" id="err-email" hidden></p>
    </div>
    ${pwField("password", t("auth.password"), "new-password", true)}
    ${pwField("passwordConfirm", t("auth.passwordConfirm"), "new-password")}
    ${localityField({ name: "city", label: t("auth.city"), required: true })}
    <p class="field-error" id="err-city" hidden></p>
    <label class="check"><input type="checkbox" name="terms" value="1" required><span>${raw(t("auth.terms", { terms: `<a href="#/page/conditions" target="_blank" rel="noopener">${t("footer.terms")}</a>`, privacy: `<a href="#/page/confidentialite" target="_blank" rel="noopener">${t("footer.privacy")}</a>` }))}</span></label>
    <p class="field-error" id="err-terms" hidden></p>
    <p class="field-error form-error" id="err-form" role="alert" hidden></p>
    <button type="submit" class="btn btn-primary btn-lg btn-block">${t("auth.createAccount")}</button>
    <p class="auth-switch">${t("auth.haveAccount")} <button type="button" class="link-btn" data-action="auth-mode" data-mode="login">${t("auth.login")}</button></p>
  </form>`;
}

function setBusy(form, busy) {
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = busy;
  btn.classList.toggle("is-loading", busy);
}

const __default = {
  title: () => (mode === "register" ? t("auth.createAccount") : t("auth.login")),
  refreshOn: [],

  render(ctx) {
    mode = ctx.query.get("mode") === "register" ? "register" : "login";
    next = safeNext(ctx.query.get("next"));
    if (currentUser()) {
      setTimeout(() => { location.hash = next; }, 0);
      return html``;
    }
    return html`
    <section class="auth-page">
      <div class="container auth-grid">
        <div class="auth-card card">
          <div class="auth-brand">${logo()}<span>Voisina</span></div>
          <div class="tabs" role="tablist">
            <button type="button" role="tab" class="tab${mode === "login" ? " is-active" : ""}" aria-selected="${mode === "login" ? "true" : "false"}" data-action="auth-mode" data-mode="login">${t("auth.login")}</button>
            <button type="button" role="tab" class="tab${mode === "register" ? " is-active" : ""}" aria-selected="${mode === "register" ? "true" : "false"}" data-action="auth-mode" data-mode="register">${t("auth.createAccount")}</button>
          </div>
          <h1 class="h2 auth-title">${mode === "login" ? t("auth.welcomeBack") : t("auth.joinTitle")}</h1>
          <p class="muted auth-sub">${mode === "login" ? t("auth.loginSub") : t("auth.joinSub")}</p>
          <div id="auth-form-wrap">${mode === "login" ? loginForm() : registerForm()}</div>
        </div>
        <aside class="auth-aside">
          <h2 class="h3">${t("auth.whyTitle")}</h2>
          <ul class="check-list">
            <li>${icon("checkCircle")}<span>${t("auth.why1")}</span></li>
            <li>${icon("checkCircle")}<span>${t("auth.why2")}</span></li>
            <li>${icon("checkCircle")}<span>${t("auth.why3")}</span></li>
            <li>${icon("checkCircle")}<span>${t("auth.why4")}</span></li>
          </ul>
          <div class="auth-security">${icon("lock")}<p>${t("auth.securityNote")}</p></div>
        </aside>
      </div>
    </section>`;
  },

  mount(root) {
    initLocalityFields(root);
    const loginEl = $("#login-form", root);
    const registerEl = $("#register-form", root);

    loginEl?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#err-login");
      err.hidden = true;
      const id = loginEl.identifier.value.trim();
      const pw = loginEl.password.value;
      if (!id || !pw) { err.textContent = t("err.fillAll"); err.hidden = false; return; }
      setBusy(loginEl, true);
      const res = await login(id, pw);
      setBusy(loginEl, false);
      if (!res.ok) {
        err.textContent = res.error === "locked" ? t("auth.locked", { seconds: res.remaining }) : t("auth.invalid");
        err.hidden = false;
        loginEl.password.value = "";
        loginEl.password.focus();
        return;
      }
      mergeGuestFavorites();
      toast(t("auth.loggedIn", { name: currentUser().firstname }), "success");
      location.hash = next;
    });

    if (registerEl) {
      const pw = registerEl.password;
      const meter = $(".pw-meter", registerEl);
      pw.addEventListener("input", () => {
        const s = passwordStrength(pw.value, [registerEl.firstname.value, registerEl.lastname.value, registerEl.email.value.split("@")[0]]);
        meter.dataset.score = pw.value ? String(Math.max(1, s.score)) : "0";
        $("#pw-help").textContent = !pw.value ? t("auth.pwRules") : s.ok ? t("auth.pwGood") : t("auth.pwIssue." + s.issues[0]);
      });
      registerEl.addEventListener("submit", async (e) => {
        e.preventDefault();
        $$(".field-error", registerEl).forEach((el) => { el.hidden = true; });
        const fd = new FormData(registerEl);
        setBusy(registerEl, true);
        const res = await register({
          firstname: fd.get("firstname"),
          lastname: fd.get("lastname"),
          email: fd.get("email"),
          password: fd.get("password"),
          passwordConfirm: fd.get("passwordConfirm"),
          city: fd.get("city"),
          canton: fd.get("canton"),
          terms: fd.get("terms") === "1",
        });
        setBusy(registerEl, false);
        if (!res.ok) {
          let first = null;
          for (const [k, code] of Object.entries(res.errors)) {
            const el = $(`#err-${k}`);
            if (el) { el.textContent = t(`err.${code}`); el.hidden = false; }
            first ||= registerEl.elements[k] || el;
          }
          first?.focus?.();
          return;
        }
        mergeGuestFavorites();
        toast(t("auth.welcome", { name: res.user.firstname }), "success");
        location.hash = next === "#/compte" ? "#/compte?welcome=1" : next;
      });
    }
  },
};

const authActions = {
  "auth-mode": (el) => {
    const p = new URLSearchParams();
    if (el.dataset.mode === "register") p.set("mode", "register");
    if (next && next !== "#/compte") p.set("next", next);
    location.hash = `#/connexion${p.toString() ? "?" + p : ""}`;
  },
  "toggle-pw": (el) => {
    const input = document.getElementById(el.dataset.target);
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    el.setAttribute("aria-pressed", show ? "true" : "false");
    el.setAttribute("aria-label", show ? t("auth.hidePassword") : t("auth.showPassword"));
    mount(el, icon(show ? "eyeOff" : "eye"));
  },
};

return { authActions, default: __default };
});
__def("views/account.js", function () {
/* Mon compte : profil, annonces, sécurité, données personnelles, préférences */
const { html, raw, $, $$, mount, processImage, downloadFile, safeImageSrc } = __req("util.js");
const { icon } = __req("icons.js");
const { t, fmtDate, cantonName, getLang, setLang, fmtRelative } = __req("i18n.js");
const { currentUser, updateProfile, changePassword, deleteAccount, exportMyData, listingsByAuthor, getFavorites, getConversations, getPerson, logout, getPrefs, setPrefs, isAdmin } = __req("store.js");
const { passwordStrength } = __req("auth.js");
const { avatar, listingCard, emptyState, localityField, initLocalityFields, langChips, toast, confirmDialog, openDialog, priceLabel, listingTitle, categoryThumb } = __req("ui.js");

const TABS = ["profile", "listings", "security", "data", "prefs"];
const TAB_ICONS = { profile: "user", listings: "file", security: "lock", data: "download", prefs: "sliders" };
let tab = "profile";
let pendingPhoto = undefined;

function profileTab(me) {
  const person = getPerson(me.id);
  return html`
  <form id="profile-form" class="card form-card" novalidate>
    <div class="profile-photo-row">
      <div id="profile-avatar">${avatar({ ...person, photo: pendingPhoto ?? me.photo }, "xl")}</div>
      <div>
        <label class="btn btn-ghost">${icon("camera")}${t("account.changePhoto")}<input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" id="photo-input"></label>
        ${(pendingPhoto ?? me.photo) ? html`<button type="button" class="link-btn danger" data-action="remove-avatar">${t("account.removePhoto")}</button>` : ""}
        <p class="help">${icon("shield")}${t("publish.photoHint")}</p>
      </div>
    </div>
    <div class="grid-2">
      <div class="field"><label class="field-label" for="f-firstname">${t("auth.firstname")}</label><input id="f-firstname" class="input" name="firstname" value="${me.firstname}" maxlength="40" required></div>
      <div class="field"><label class="field-label" for="f-lastname">${t("auth.lastname")}</label><input id="f-lastname" class="input" name="lastname" value="${me.lastname}" maxlength="40" required></div>
    </div>
    <p class="help">${icon("eyeOff")}${t("account.publicName", { name: person.name })}</p>
    ${localityField({ name: "city", label: t("auth.city"), value: me.city || "", canton: me.canton || "" })}
    <div class="field"><label class="field-label" for="f-bio">${t("account.bio")}</label>
      <textarea id="f-bio" class="input textarea" name="bio" rows="4" maxlength="400" placeholder="${t("account.bioPh")}">${me.bio || ""}</textarea></div>
    <div class="field"><label class="field-label" for="f-specialties">${t("account.specialties")}</label>
      <input id="f-specialties" class="input" name="specialties" value="${(me.specialties || []).join(", ")}" maxlength="200" placeholder="${t("account.specialtiesPh")}">
      <p class="help">${t("account.specialtiesHint")}</p></div>
    <div class="field"><span class="field-label">${t("account.languages")}</span>${langChips("languages", me.languages || [])}</div>
    <div class="form-actions">
      <a class="btn btn-ghost" href="#/membre/${me.id}">${icon("eye")}${t("account.viewPublic")}</a>
      <button type="submit" class="btn btn-primary">${icon("check")}${t("common.save")}</button>
    </div>
  </form>`;
}

function listingsTab(me) {
  const mine = listingsByAuthor(me.id, { includeInactive: true });
  if (!mine.length) return emptyState({ iconName: "file", title: t("account.noListings"), text: t("account.noListingsText"), action: html`<a class="btn btn-primary" href="#/publier">${icon("plus")}${t("nav.publish")}</a>` });
  return html`<ul class="my-listings">${mine.map((l) => html`<li class="my-listing card">
    ${categoryThumb(l, "my-listing-thumb")}
    <div class="my-listing-body">
      <a class="my-listing-title" href="#/annonce/${l.id}">${listingTitle(l)}</a>
      <p class="muted small">${l.city} · ${priceLabel(l)} · ${t("listing.published", { when: fmtRelative(l.created) })}</p>
      <span class="status status-${l.status}">${t("status." + l.status)}</span>
    </div>
    <div class="my-listing-actions">
      <a class="btn btn-ghost btn-sm" href="#/publier?edit=${l.id}">${icon("pencil")}${t("listing.edit")}</a>
      ${l.status !== "hidden" ? html`<button type="button" class="btn btn-ghost btn-sm" data-action="listing-status" data-id="${l.id}" data-status="${l.status === "done" ? "active" : "done"}">${icon(l.status === "done" ? "refresh" : "checkCircle")}${l.status === "done" ? t("listing.reactivate") : t("listing.markDone")}</button>` : ""}
      <button type="button" class="btn btn-danger-ghost btn-sm" data-action="listing-delete" data-id="${l.id}">${icon("trash")}${t("listing.delete")}</button>
    </div>
  </li>`)}</ul>`;
}

function securityTab(me) {
  if (me.role === "admin") {
    return html`<div class="card form-card"><p class="notice">${icon("info")}<span>${t("account.adminPwNote")}</span></p></div>`;
  }
  return html`
  <form id="password-form" class="card form-card" novalidate>
    <h2 class="h3">${t("account.changePassword")}</h2>
    <div class="field"><label class="field-label" for="f-old">${t("account.currentPassword")}</label><input id="f-old" class="input" type="password" name="old" autocomplete="current-password" required></div>
    <div class="field"><label class="field-label" for="f-new">${t("account.newPassword")}</label><input id="f-new" class="input" type="password" name="new" autocomplete="new-password" required><p class="help">${t("auth.pwRules")}</p></div>
    <div class="field"><label class="field-label" for="f-new2">${t("auth.passwordConfirm")}</label><input id="f-new2" class="input" type="password" name="new2" autocomplete="new-password" required></div>
    <p class="field-error form-error" id="err-pw" role="alert" hidden></p>
    <div class="form-actions"><button type="submit" class="btn btn-primary">${icon("key")}${t("account.updatePassword")}</button></div>
  </form>
  <div class="card form-card">
    <h2 class="h3">${t("account.howProtected")}</h2>
    <ul class="check-list">
      <li>${icon("checkCircle")}<span>${t("account.prot1")}</span></li>
      <li>${icon("checkCircle")}<span>${t("account.prot2")}</span></li>
      <li>${icon("checkCircle")}<span>${t("account.prot3")}</span></li>
    </ul>
    <button type="button" class="btn btn-ghost" data-action="logout">${icon("logout")}${t("nav.logout")}</button>
  </div>`;
}

function dataTab(me) {
  return html`
  <div class="card form-card">
    <h2 class="h3">${icon("download")}${t("account.exportTitle")}</h2>
    <p>${t("account.exportText")}</p>
    <button type="button" class="btn btn-primary" data-action="export-data">${icon("download")}${t("account.exportBtn")}</button>
  </div>
  <div class="card form-card">
    <h2 class="h3">${icon("info")}${t("account.storedTitle")}</h2>
    <ul class="data-list">
      <li><strong>${t("account.storedProfile")}</strong><span>${me.email}</span></li>
      <li><strong>${t("account.storedListings")}</strong><span>${listingsByAuthor(me.id, { includeInactive: true }).length}</span></li>
      <li><strong>${t("account.storedFavorites")}</strong><span>${getFavorites().length}</span></li>
      <li><strong>${t("account.storedConversations")}</strong><span>${getConversations().length}</span></li>
    </ul>
    <p class="help">${t("account.storedWhere")}</p>
  </div>
  ${me.role !== "admin" ? html`<div class="card form-card danger-zone">
    <h2 class="h3">${icon("trash")}${t("account.deleteTitle")}</h2>
    <p>${t("account.deleteText")}</p>
    <button type="button" class="btn btn-danger" data-action="delete-account">${icon("trash")}${t("account.deleteBtn")}</button>
  </div>` : ""}`;
}

function prefsTab() {
  const prefs = getPrefs();
  const theme = prefs.theme || "system";
  return html`<form id="prefs-form" class="card form-card">
    <div class="field"><label class="field-label" for="f-lang">${t("account.language")}</label>
      <select id="f-lang" class="select" name="lang">${["fr", "de", "it", "en"].map((l) => html`<option value="${l}" ${getLang() === l ? raw("selected") : ""}>${t("lang." + l)}</option>`)}</select></div>
    <fieldset class="field"><legend class="field-label">${t("account.theme")}</legend>
      <div class="segmented">${["system", "light", "dark"].map((th) => html`<label class="seg-radio"><input type="radio" name="theme" value="${th}" ${theme === th ? raw("checked") : ""}><span>${icon(th === "dark" ? "moon" : th === "light" ? "sun" : "laptop")}${t("theme." + th)}</span></label>`)}</div>
    </fieldset>
    <label class="check"><input type="checkbox" name="banner" value="1" ${!prefs.bannerDismissed ? raw("checked") : ""}><span>${t("account.showDemoBanner")}</span></label>
  </form>`;
}

const __default = {
  title: () => t("meta.accountTitle"),
  refreshOn: ["auth", "listings", "profile"],

  render(ctx) {
    const me = currentUser();
    if (!me) {
      setTimeout(() => { location.hash = `#/connexion?next=${encodeURIComponent("#/compte")}`; }, 0);
      return html``;
    }
    const q = ctx.query.get("tab");
    tab = TABS.includes(q) ? q : tab;
    if (!TABS.includes(tab)) tab = "profile";
    const person = getPerson(me.id);
    const welcome = ctx.query.get("welcome") === "1";
    const content = { profile: profileTab, listings: listingsTab, security: securityTab, data: dataTab, prefs: prefsTab }[tab](me);
    return html`
    <section class="page-head">
      <div class="container account-head">
        ${avatar(person, "lg")}
        <div>
          <h1 class="h1">${t("account.hello", { name: me.firstname })}</h1>
          <p class="muted">${me.email} · ${t("trust.memberSince")} ${fmtDate(me.created, { month: "long", year: "numeric" })}${me.canton ? ` · ${cantonName(me.canton)}` : ""}</p>
        </div>
        ${isAdmin() ? html`<a class="btn btn-primary account-admin-btn" href="#/admin">${icon("shield")}${t("nav.admin")}</a>` : ""}
      </div>
    </section>
    <div class="container">
      ${welcome ? html`<div class="notice notice-success">${icon("sparkles")}<span>${t("account.welcomeNotice")}</span><a class="btn btn-primary btn-sm" href="#/publier">${t("nav.publish")}</a></div>` : ""}
      <div class="account-layout">
        <nav class="account-nav" aria-label="${t("account.sections")}">
          ${TABS.map((k) => html`<a class="account-nav-link${k === tab ? " is-active" : ""}" href="#/compte?tab=${k}" ${k === tab ? raw('aria-current="page"') : ""}>${icon(TAB_ICONS[k])}${t("account.tab." + k)}</a>`)}
          <button type="button" class="account-nav-link" data-action="logout">${icon("logout")}${t("nav.logout")}</button>
        </nav>
        <div class="account-content">${content}</div>
      </div>
    </div>`;
  },

  mount(root) {
    initLocalityFields(root);
    pendingPhoto = undefined;

    const profile = $("#profile-form", root);
    if (profile) {
      $("#photo-input", root).addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          pendingPhoto = await processImage(file, 400, 0.85);
          const me = currentUser();
          mount($("#profile-avatar"), avatar({ ...getPerson(me.id), photo: pendingPhoto }, "xl"));
          toast(t("account.photoReady"), "info");
        } catch (err) {
          toast(t(err.message === "too-large" ? "publish.photoTooLarge" : "publish.photoBadType"), "error");
        }
      });
      profile.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(profile);
        const patch = {
          firstname: fd.get("firstname"),
          lastname: fd.get("lastname"),
          city: fd.get("city"),
          canton: fd.get("canton"),
          bio: fd.get("bio"),
          specialties: String(fd.get("specialties") || "").split(",").map((s) => s.trim()).filter(Boolean),
          languages: fd.getAll("languages"),
        };
        if (pendingPhoto !== undefined) patch.photo = pendingPhoto;
        const res = updateProfile(patch);
        toast(res.ok ? t("account.saved") : t("err.quota"), res.ok ? "success" : "error");
      });
    }

    const pwForm = $("#password-form", root);
    pwForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#err-pw");
      err.hidden = true;
      if (pwForm.new.value !== pwForm.new2.value) { err.textContent = t("err.mismatch"); err.hidden = false; return; }
      if (!passwordStrength(pwForm.new.value).ok) { err.textContent = t("err.weak"); err.hidden = false; return; }
      const btn = pwForm.querySelector("[type=submit]");
      btn.disabled = true;
      const res = await changePassword(pwForm.old.value, pwForm.new.value);
      btn.disabled = false;
      if (!res.ok) { err.textContent = t(res.error === "invalid" ? "err.wrongPassword" : "err.weak"); err.hidden = false; return; }
      pwForm.reset();
      toast(t("account.passwordChanged"), "success");
    });

    const prefs = $("#prefs-form", root);
    prefs?.addEventListener("change", (e) => {
      const el = e.target;
      if (el.name === "lang") { setLang(el.value); window.dispatchEvent(new Event("voisina:lang")); }
      if (el.name === "theme") { setPrefs({ theme: el.value === "system" ? null : el.value }); window.dispatchEvent(new Event("voisina:theme")); }
      if (el.name === "banner") { setPrefs({ bannerDismissed: !el.checked }); window.dispatchEvent(new Event("voisina:banner")); }
      toast(t("account.saved"), "success");
    });
  },
};

const accountActions = {
  "remove-avatar": () => {
    pendingPhoto = "";
    const me = currentUser();
    mount($("#profile-avatar"), avatar({ ...getPerson(me.id), photo: "" }, "xl"));
  },
  logout: () => {
    logout();
    toast(t("auth.loggedOut"), "success");
    location.hash = "#/";
  },
  "export-data": () => {
    const data = exportMyData();
    if (!data) return;
    downloadFile(`voisina-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
    toast(t("account.exported"), "success");
  },
  "delete-account": async () => {
    const result = await openDialog({
      title: t("account.deleteTitle"),
      size: "dialog-sm",
      body: html`<p class="dialog-text">${t("account.deleteConfirmText")}</p>
        <div class="field"><label class="field-label" for="f-del-pw">${t("auth.password")}</label><input id="f-del-pw" class="input" type="password" name="password" autocomplete="current-password" required></div>
        <p class="field-error" id="err-del" role="alert" hidden></p>`,
      footer: html`<button type="button" class="btn btn-ghost" data-dialog-close>${t("common.cancel")}</button><button type="submit" class="btn btn-danger">${icon("trash")}${t("account.deleteBtn")}</button>`,
      onSubmit: async (form) => {
        const res = await deleteAccount(form.password.value);
        if (!res.ok) {
          const err = form.querySelector("#err-del");
          err.textContent = t("err.wrongPassword");
          err.hidden = false;
          return false;
        }
        return true;
      },
    });
    if (result) {
      toast(t("account.deleted"), "success");
      location.hash = "#/";
    }
  },
};



return { accountActions, default: __default, safeImageSrc, listingCard };
});
__def("views/profile.js", function () {
/* Profil public d'un membre */
const { html } = __req("util.js");
const { icon } = __req("icons.js");
const { t, fmtDate, cantonName, languageName } = __req("i18n.js");
const { getPerson, listingsByAuthor, currentUser, isBlocked } = __req("store.js");
const { avatar, listingCard, emptyState, stars } = __req("ui.js");

const __default = {
  title: (ctx) => getPerson(ctx.params[0])?.name || t("profile.notFound"),
  refreshOn: ["listings", "block", "profile", "auth"],

  render(ctx) {
    const id = ctx.params[0];
    const p = getPerson(id);
    const me = currentUser();
    if (!p) {
      return html`<section class="section"><div class="container narrow">${emptyState({ iconName: "user", title: t("profile.notFound"), action: html`<a class="btn btn-primary" href="#/explorer">${t("listing.backToExplore")}</a>` })}</div></section>`;
    }
    const listings = listingsByAuthor(id);
    const isMe = me?.id === id;
    const blocked = isBlocked(id);
    return html`
    <section class="page-head profile-head">
      <div class="container profile-hero">
        ${avatar(p, "xl")}
        <div class="profile-hero-info">
          <h1 class="h1">${p.name}</h1>
          <div class="profile-badges">
            ${p.role === "admin" ? html`<span class="badge badge-verified">${icon("shield")}${t("profile.team")}</span>` : ""}
            ${p.verified ? html`<span class="badge badge-verified">${icon("badgeCheck")}${t("trust.verified")}</span>` : html`<span class="badge">${t("trust.notVerified")}</span>`}
            ${p.demo ? html`<span class="badge badge-muted">${icon("info")}${t("demo.member")}</span>` : ""}
          </div>
          <p class="muted">${icon("pin")}${p.city || "—"}${p.canton ? `, ${cantonName(p.canton)}` : ""} · ${t("trust.memberSince")} ${p.created ? fmtDate(p.created, { month: "long", year: "numeric" }) : "—"}</p>
        </div>
        <div class="profile-actions">
          ${isMe ? html`<a class="btn btn-primary" href="#/compte">${icon("pencil")}${t("profile.edit")}</a>` : html`
            <button type="button" class="btn btn-ghost" data-action="report" data-type="user" data-id="${id}">${icon("flag")}${t("report.user")}</button>
            ${me ? html`<button type="button" class="btn btn-ghost" data-action="block" data-id="${id}">${icon("ban")}${blocked ? t("block.unblock") : t("block.user")}</button>` : ""}`}
        </div>
      </div>
    </section>
    <div class="container profile-layout">
      <aside class="profile-side">
        <div class="card">
          <dl class="author-stats author-stats-lg">
            <div><dt>${t("trust.rating")}</dt><dd>${stars(p.rating)}</dd></div>
            <div><dt>${t("trust.reviews")}</dt><dd>${p.reviews ?? 0}</dd></div>
            <div><dt>${t("trust.completed")}</dt><dd>${p.completed ?? 0}</dd></div>
            <div><dt>${t("profile.activeListings")}</dt><dd>${listings.length}</dd></div>
          </dl>
        </div>
        ${p.bio ? html`<div class="card"><h2 class="h4">${t("profile.about")}</h2><p class="prose-text">${p.bio}</p></div>` : ""}
        ${p.languages?.length ? html`<div class="card"><h2 class="h4">${icon("languages")}${t("account.languages")}</h2><div class="tag-list">${p.languages.map((l) => html`<span class="tag">${languageName(l)}</span>`)}</div></div>` : ""}
        ${p.specialties?.length ? html`<div class="card"><h2 class="h4">${icon("sparkles")}${t("account.specialties")}</h2><div class="tag-list">${p.specialties.map((s) => html`<span class="tag">${s}</span>`)}</div></div>` : ""}
        <p class="help">${icon("shield")}${t("profile.privacy")}</p>
      </aside>
      <section>
        <h2 class="h3">${t("profile.listingsBy", { name: p.firstname })}</h2>
        ${listings.length ? html`<div class="listing-grid listing-grid-compact">${listings.map((l) => listingCard(l))}</div>` : html`<p class="muted">${t("profile.noListings")}</p>`}
      </section>
    </div>`;
  },
};

return { default: __default };
});
__def("views/admin.js", function () {
/* Espace administrateur : modération et statistiques */
const { html, raw, storage } = __req("util.js");
const { icon } = __req("icons.js");
const { t, fmtRelative, fmtNumber, categoryName } = __req("i18n.js");
const { CATEGORIES } = __req("data.js");
const { isAdmin, stats, getReports, resolveReport, getListing, getPerson, allListings, getAllUsersForAdmin, setListingHidden, isHidden } = __req("store.js");
const { emptyState, confirmDialog, toast, listingTitle } = __req("ui.js");

function kpi(iconName, label, value, tone = "") {
  return html`<div class="kpi ${tone}"><span class="kpi-icon">${icon(iconName)}</span><div><strong>${fmtNumber(value)}</strong><span>${label}</span></div></div>`;
}

function targetLabel(r) {
  if (r.targetType === "listing") {
    const l = getListing(r.targetId);
    return l ? html`<a href="#/annonce/${l.id}">${listingTitle(l)}</a>` : t("admin.deleted");
  }
  if (r.targetType === "user") {
    const p = getPerson(r.targetId);
    return p ? html`<a href="#/membre/${p.id}">${p.name}</a>` : t("admin.deleted");
  }
  return t("admin.conversation");
}

const __default = {
  title: () => t("nav.admin"),
  refreshOn: ["reports", "listings", "auth"],

  render() {
    if (!isAdmin()) {
      return html`<section class="section"><div class="container narrow">${emptyState({ iconName: "lock", title: t("admin.forbidden"), text: t("admin.forbiddenText"), action: html`<a class="btn btn-primary" href="#/connexion?next=${encodeURIComponent("#/admin")}">${t("auth.login")}</a>` })}</div></section>`;
    }
    const s = stats();
    const reports = getReports();
    const open = reports.filter((r) => r.status === "open");
    const closed = reports.filter((r) => r.status !== "open").slice(0, 8);
    const users = getAllUsersForAdmin();
    const listings = allListings();
    const memberListings = allListings({ includeInactive: true }).filter((l) => !l.demo);
    const counts = CATEGORIES.map((c) => ({ c, n: listings.filter((l) => l.category === c.id).length })).sort((a, b) => b.n - a.n);
    const max = Math.max(1, ...counts.map((x) => x.n));

    return html`
    <section class="page-head">
      <div class="container page-head-row">
        <div><span class="kicker">${icon("shield")}${t("admin.kicker")}</span><h1 class="h1">${t("admin.title")}</h1><p class="lead">${t("admin.lead")}</p></div>
        <div class="page-head-actions"><button type="button" class="btn btn-danger-ghost" data-action="reset-demo">${icon("refresh")}${t("admin.reset")}</button></div>
      </div>
    </section>
    <div class="container admin-wrap">
      <div class="kpi-grid">
        ${kpi("file", t("admin.kpiListings"), s.active)}
        ${kpi("users", t("admin.kpiUsers"), s.users)}
        ${kpi("message", t("admin.kpiMessages"), s.messages)}
        ${kpi("flag", t("admin.kpiReports"), s.reportsOpen, s.reportsOpen ? "kpi-alert" : "")}
      </div>

      <section class="card admin-section">
        <h2 class="h3">${icon("flag")}${t("admin.reportsTitle")} <span class="count-pill">${open.length}</span></h2>
        ${open.length ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th>${t("admin.colTarget")}</th><th>${t("admin.colReason")}</th><th>${t("admin.colDetails")}</th><th>${t("admin.colWhen")}</th><th><span class="sr-only">${t("admin.colActions")}</span></th></tr></thead>
          <tbody>${open.map((r) => html`<tr>
            <td><span class="badge">${t("admin.type." + r.targetType)}</span> ${targetLabel(r)}</td>
            <td>${t("report.reason." + r.reason)}</td>
            <td class="td-details">${r.details || "—"}</td>
            <td>${fmtRelative(r.at)}</td>
            <td class="td-actions">
              ${r.targetType === "listing" ? html`<button type="button" class="btn btn-danger btn-sm" data-action="resolve-report" data-id="${r.id}" data-do="hide">${icon("eyeOff")}${t("admin.hide")}</button>` : ""}
              <button type="button" class="btn btn-ghost btn-sm" data-action="resolve-report" data-id="${r.id}" data-do="dismiss">${t("admin.dismiss")}</button>
            </td></tr>`)}</tbody></table></div>`
          : html`<p class="muted">${icon("checkCircle")} ${t("admin.noReports")}</p>`}
        ${closed.length ? html`<details class="admin-history"><summary>${t("admin.history")}</summary><ul>${closed.map((r) => html`<li>${t("admin.type." + r.targetType)} — ${t("report.reason." + r.reason)} — <strong>${t("admin.status." + r.status)}</strong> (${fmtRelative(r.resolvedAt || r.at)})</li>`)}</ul></details>` : ""}
      </section>

      <div class="admin-grid">
        <section class="card admin-section">
          <h2 class="h3">${icon("file")}${t("admin.memberListings")}</h2>
          ${memberListings.length ? html`<ul class="admin-list">${memberListings.map((l) => html`<li>
            <a href="#/annonce/${l.id}">${listingTitle(l)}</a>
            <span class="muted small">${getPerson(l.authorId)?.name || "—"} · ${l.city} · <span class="status status-${l.status}">${t("status." + l.status)}</span></span>
            <button type="button" class="btn btn-ghost btn-sm" data-action="admin-hide" data-id="${l.id}" data-hidden="${isHidden(l.id) ? "0" : "1"}">${icon(isHidden(l.id) ? "eye" : "eyeOff")}${isHidden(l.id) ? t("admin.unhide") : t("admin.hide")}</button>
          </li>`)}</ul>` : html`<p class="muted">${t("admin.noMemberListings")}</p>`}
        </section>

        <section class="card admin-section">
          <h2 class="h3">${icon("chart")}${t("admin.byCategory")}</h2>
          <ul class="bars">${counts.map(({ c, n }) => html`<li><span class="bar-label">${categoryName(c.id)}</span><span class="bar-track"><span class="bar tone-${c.tone}" data-w="${Math.round((n / max) * 100)}"></span></span><span class="bar-value">${n}</span></li>`)}</ul>
        </section>
      </div>

      <section class="card admin-section">
        <h2 class="h3">${icon("users")}${t("admin.members")} <span class="count-pill">${users.length}</span></h2>
        ${users.length ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th>${t("admin.colName")}</th><th>${t("auth.email")}</th><th>${t("auth.city")}</th><th>${t("admin.colJoined")}</th></tr></thead>
          <tbody>${users.map((u) => html`<tr><td><a href="#/membre/${u.id}">${u.firstname} ${u.lastname}</a></td><td>${u.email}</td><td>${u.city || "—"} ${u.canton ? `(${u.canton})` : ""}</td><td>${fmtRelative(u.created)}</td></tr>`)}</tbody>
        </table></div><p class="help">${icon("lock")}${t("admin.pwNote")}</p>` : html`<p class="muted">${t("admin.noMembers")}</p>`}
      </section>
    </div>`;
  },

  mount(root) {
    // Largeur des barres appliquée en JS (compatible avec notre politique de sécurité CSP)
    root.querySelectorAll(".bar[data-w]").forEach((b) => { b.style.width = b.dataset.w + "%"; });
  },
};

const adminActions = {
  "resolve-report": (el) => {
    if (resolveReport(el.dataset.id, el.dataset.do)) toast(el.dataset.do === "hide" ? t("admin.hidden") : t("admin.dismissed"), "success");
  },
  "reset-demo": async () => {
    if (!(await confirmDialog({ title: t("admin.resetTitle"), text: t("admin.resetText"), confirm: t("admin.reset"), danger: true }))) return;
    storage.clearAll();
    location.hash = "#/";
    location.reload();
  },
};



return { adminActions, default: __default, raw, setListingHidden };
});
__def("pages-content.js", function () {
/* =====================================================================
   CONTENU DES PAGES D'INFORMATION (4 langues)
   Aide, sécurité, règles, conditions, confidentialité (nLPD),
   mentions légales, à propos.
   ===================================================================== */

const PAGE_ORDER = ["aide", "securite", "regles", "conditions", "confidentialite", "mentions-legales", "a-propos"];

const EMERGENCY = {
  fr: ["117 — Police", "144 — Urgences sanitaires / ambulance", "118 — Pompiers", "112 — Numéro d'urgence européen", "143 — La Main Tendue (écoute, 24 h/24)", "147 — Pro Juventute (enfants et jeunes)"],
  de: ["117 — Polizei", "144 — Sanitätsnotruf", "118 — Feuerwehr", "112 — Europäische Notrufnummer", "143 — Die Dargebotene Hand (rund um die Uhr)", "147 — Pro Juventute (Kinder und Jugendliche)"],
  it: ["117 — Polizia", "144 — Emergenza sanitaria / ambulanza", "118 — Pompieri", "112 — Numero d'emergenza europeo", "143 — Telefono Amico (24 ore su 24)", "147 — Pro Juventute (bambini e giovani)"],
  en: ["117 — Police", "144 — Medical emergency / ambulance", "118 — Fire brigade", "112 — European emergency number", "143 — Die Dargebotene Hand / La Main Tendue (24/7 listening line)", "147 — Pro Juventute (children and young people)"],
};

const PAGES = {
  /* ------------------------------------------------------------ AIDE */
  aide: {
    fr: {
      title: "Aide & questions fréquentes",
      intro: "Tout ce qu'il faut savoir pour bien démarrer sur Voisina.",
      sections: [
        { h: "Premiers pas", qa: [
          ["Qu'est-ce que Voisina ?", "Voisina est une plateforme d'entraide entre voisins, partout en Suisse. Vous pouvez proposer un coup de main, demander de l'aide ou donner un objet, gratuitement ou contre une petite rémunération."],
          ["Est-ce gratuit ?", "Oui. Publier, rechercher et discuter est entièrement gratuit. Voisina ne prend aucune commission et n'affiche aucune publicité."],
          ["Faut-il un compte ?", "Vous pouvez consulter les annonces et les ajouter à vos favoris sans compte. Pour publier une annonce ou écrire à un membre, un compte gratuit est nécessaire."],
        ] },
        { h: "Publier une annonce", qa: [
          ["Comment écrire une bonne annonce ?", "Choisissez un titre court et précis, décrivez clairement le besoin ou l'aide proposée, indiquez une date si possible et précisez si c'est gratuit, rémunéré ou à discuter."],
          ["Mon adresse sera-t-elle visible ?", "Non, jamais. Seule votre localité est affichée et la position sur la carte est volontairement floutée d'environ un kilomètre."],
          ["Puis-je modifier ou supprimer mon annonce ?", "Oui, à tout moment depuis « Mon compte › Mes annonces ». Vous pouvez aussi la marquer comme terminée une fois l'entraide réalisée."],
          ["Puis-je ajouter des photos ?", "Oui, jusqu'à trois. Elles sont automatiquement redimensionnées et leurs métadonnées (dont la position GPS enregistrée par les smartphones) sont supprimées."],
        ] },
        { h: "Contacter un membre", qa: [
          ["Comment contacter l'auteur d'une annonce ?", "Cliquez sur « Contacter » sur la page de l'annonce. Une conversation s'ouvre dans la messagerie, sans que votre numéro ou votre e-mail ne soient partagés."],
          ["Que faire en cas de comportement suspect ?", "Utilisez le bouton « Signaler » (sur l'annonce, le profil ou la conversation) et, si besoin, bloquez la personne. En cas de danger, appelez le 117."],
        ] },
        { h: "Compte et données", qa: [
          ["Comment exporter ou supprimer mes données ?", "Dans « Mon compte › Mes données », vous pouvez télécharger toutes vos données (fichier JSON) ou supprimer définitivement votre compte."],
          ["J'ai oublié mon mot de passe", "Dans cette version de démonstration, il n'existe pas encore d'envoi d'e-mail de réinitialisation : créez simplement un nouveau compte. La version serveur ajoutera cette fonction."],
        ] },
      ],
    },
    de: {
      title: "Hilfe & häufige Fragen",
      intro: "Alles, was Sie für einen guten Start auf Voisina wissen müssen.",
      sections: [
        { h: "Erste Schritte", qa: [
          ["Was ist Voisina?", "Voisina ist eine Plattform für Nachbarschaftshilfe in der ganzen Schweiz. Sie können Hilfe anbieten, um Hilfe bitten oder Gegenstände verschenken – kostenlos oder gegen eine kleine Entschädigung."],
          ["Ist Voisina kostenlos?", "Ja. Inserieren, Suchen und Schreiben sind komplett kostenlos. Voisina verlangt keine Kommission und zeigt keine Werbung."],
          ["Brauche ich ein Konto?", "Anzeigen ansehen und als Favoriten speichern geht ohne Konto. Um zu inserieren oder einem Mitglied zu schreiben, brauchen Sie ein kostenloses Konto."],
        ] },
        { h: "Eine Anzeige erstellen", qa: [
          ["Wie schreibe ich eine gute Anzeige?", "Wählen Sie einen kurzen, präzisen Titel, beschreiben Sie klar, was Sie brauchen oder anbieten, geben Sie wenn möglich ein Datum an und ob es kostenlos, bezahlt oder verhandelbar ist."],
          ["Ist meine Adresse sichtbar?", "Nein, nie. Angezeigt wird nur Ihr Ort; die Position auf der Karte ist absichtlich um etwa einen Kilometer ungenau."],
          ["Kann ich meine Anzeige ändern oder löschen?", "Ja, jederzeit unter «Mein Konto › Meine Anzeigen». Nach erfolgter Hilfe können Sie sie auch als erledigt markieren."],
          ["Kann ich Fotos hinzufügen?", "Ja, bis zu drei. Sie werden automatisch verkleinert und ihre Metadaten (inklusive der GPS-Position von Smartphones) werden entfernt."],
        ] },
        { h: "Ein Mitglied kontaktieren", qa: [
          ["Wie kontaktiere ich jemanden?", "Klicken Sie auf der Anzeige auf «Kontaktieren». Es öffnet sich ein Chat – ohne dass Telefonnummer oder E-Mail geteilt werden."],
          ["Was tun bei verdächtigem Verhalten?", "Nutzen Sie «Melden» (bei Anzeige, Profil oder Chat) und blockieren Sie die Person bei Bedarf. Bei Gefahr rufen Sie 117 an."],
        ] },
        { h: "Konto und Daten", qa: [
          ["Wie exportiere oder lösche ich meine Daten?", "Unter «Mein Konto › Meine Daten» können Sie alle Ihre Daten herunterladen (JSON-Datei) oder Ihr Konto endgültig löschen."],
          ["Ich habe mein Passwort vergessen", "In dieser Demoversion gibt es noch keine E-Mail zum Zurücksetzen: Erstellen Sie einfach ein neues Konto. Die Serverversion wird diese Funktion ergänzen."],
        ] },
      ],
    },
    it: {
      title: "Aiuto e domande frequenti",
      intro: "Tutto ciò che serve sapere per iniziare bene su Voisina.",
      sections: [
        { h: "Primi passi", qa: [
          ["Che cos'è Voisina?", "Voisina è una piattaforma di aiuto tra vicini in tutta la Svizzera. Potete offrire una mano, chiedere aiuto o regalare un oggetto, gratuitamente o con un piccolo compenso."],
          ["È gratuito?", "Sì. Pubblicare, cercare e scrivere è completamente gratuito. Voisina non prende commissioni e non mostra pubblicità."],
          ["Serve un account?", "Potete consultare gli annunci e salvarli nei preferiti senza account. Per pubblicare o scrivere a un membro serve un account gratuito."],
        ] },
        { h: "Pubblicare un annuncio", qa: [
          ["Come scrivere un buon annuncio?", "Scegliete un titolo breve e preciso, descrivete chiaramente il bisogno o l'aiuto offerto, indicate una data se possibile e specificate se è gratuito, retribuito o da concordare."],
          ["Il mio indirizzo sarà visibile?", "No, mai. Viene mostrata solo la località e la posizione sulla carta è volutamente sfocata di circa un chilometro."],
          ["Posso modificare o eliminare l'annuncio?", "Sì, in qualsiasi momento da «Il mio account › I miei annunci». Potete anche segnarlo come concluso."],
          ["Posso aggiungere foto?", "Sì, fino a tre. Vengono ridimensionate automaticamente e i metadati (compresa la posizione GPS registrata dagli smartphone) vengono eliminati."],
        ] },
        { h: "Contattare un membro", qa: [
          ["Come contatto l'autore di un annuncio?", "Cliccate su «Contatta» nella pagina dell'annuncio. Si apre una conversazione, senza condividere numero di telefono o e-mail."],
          ["Cosa fare in caso di comportamento sospetto?", "Usate il pulsante «Segnala» (annuncio, profilo o conversazione) e, se necessario, bloccate la persona. In caso di pericolo chiamate il 117."],
        ] },
        { h: "Account e dati", qa: [
          ["Come esporto o elimino i miei dati?", "In «Il mio account › I miei dati» potete scaricare tutti i vostri dati (file JSON) o eliminare definitivamente l'account."],
          ["Ho dimenticato la password", "In questa versione dimostrativa non esiste ancora l'e-mail di reimpostazione: create semplicemente un nuovo account. La versione con server aggiungerà questa funzione."],
        ] },
      ],
    },
    en: {
      title: "Help & FAQ",
      intro: "Everything you need to get started on Voisina.",
      sections: [
        { h: "Getting started", qa: [
          ["What is Voisina?", "Voisina is a neighbourly help platform covering all of Switzerland. You can offer a hand, ask for help or give items away — for free or for a small fee."],
          ["Is it free?", "Yes. Posting, searching and messaging are completely free. Voisina takes no commission and shows no ads."],
          ["Do I need an account?", "You can browse listings and save favourites without an account. To post a listing or message a member, you need a free account."],
        ] },
        { h: "Posting a listing", qa: [
          ["How do I write a good listing?", "Pick a short, precise title, clearly describe what you need or offer, add a date if possible and say whether it's free, paid or negotiable."],
          ["Will my address be visible?", "No, never. Only your town is shown and the map position is deliberately blurred by about one kilometre."],
          ["Can I edit or delete my listing?", "Yes, at any time from “My account › My listings”. You can also mark it as done once the help has happened."],
          ["Can I add photos?", "Yes, up to three. They are resized automatically and their metadata (including the GPS position smartphones record) is removed."],
        ] },
        { h: "Contacting a member", qa: [
          ["How do I contact someone?", "Click “Contact” on the listing page. A conversation opens in the inbox — your phone number and email are never shared."],
          ["What if someone behaves suspiciously?", "Use the “Report” button (on the listing, profile or conversation) and block the person if needed. If you are in danger, call 117."],
        ] },
        { h: "Account and data", qa: [
          ["How do I export or delete my data?", "In “My account › My data” you can download all your data (JSON file) or permanently delete your account."],
          ["I forgot my password", "This demo version cannot send reset emails yet: simply create a new account. The server version will add this feature."],
        ] },
      ],
    },
  },

  /* ------------------------------------------------------- SÉCURITÉ */
  securite: {
    fr: {
      title: "Conseils de sécurité",
      intro: "L'immense majorité des échanges se passe très bien. Quelques réflexes simples permettent de s'entraider en toute sérénité.",
      sections: [
        { h: "Avant de vous rencontrer", list: [
          "Échangez d'abord via la messagerie de Voisina : ne partagez pas votre numéro, votre adresse ou votre e-mail trop tôt.",
          "Consultez le profil : ancienneté, évaluations, annonces publiées, badge « vérifié ».",
          "Pour une première rencontre, choisissez un lieu public (gare, café, place du village).",
          "Prévenez un proche de l'heure et du lieu du rendez-vous.",
        ] },
        { h: "Argent et paiements", list: [
          "Ne payez jamais à l'avance une personne que vous n'avez pas rencontrée.",
          "Ne communiquez jamais de mot de passe, code SMS, code PIN ou code de confirmation TWINT / e-banking.",
          "Méfiez-vous des demandes de cartes cadeaux, de cryptomonnaies ou de transferts d'argent (Western Union, etc.).",
          "Pour un service rémunéré, convenez du montant par écrit avant de commencer. Le montant affiché sur l'annonce est indicatif.",
        ] },
        { h: "Signes d'alerte", list: [
          "La personne veut absolument quitter la messagerie ou vous presse d'agir.",
          "L'offre est trop belle pour être vraie.",
          "On vous demande des documents d'identité ou des informations bancaires.",
          "Le récit change ou devient incohérent.",
        ] },
        { h: "Personnes vulnérables et enfants", p: [
          "Pour la garde d'enfants ou l'aide aux personnes âgées, prenez le temps de rencontrer la personne, demandez des références et restez joignable. Un mineur ne doit jamais se rendre seul chez un inconnu : parlez-en d'abord à un adulte de confiance.",
        ] },
        { h: "En cas de problème", p: ["Signalez l'annonce, le profil ou la conversation : notre équipe de modération examine chaque signalement. Vous pouvez aussi bloquer une personne à tout moment. En cas d'urgence, contactez directement les services compétents :"], list: EMERGENCY.fr },
      ],
    },
    de: {
      title: "Sicherheitstipps",
      intro: "Die allermeisten Begegnungen verlaufen bestens. Mit ein paar einfachen Regeln helfen Sie sich gegenseitig ganz entspannt.",
      sections: [
        { h: "Vor dem Treffen", list: [
          "Schreiben Sie zuerst über den Voisina-Chat: Teilen Sie Telefonnummer, Adresse oder E-Mail nicht zu früh.",
          "Schauen Sie sich das Profil an: Mitglied seit, Bewertungen, Anzeigen, Badge «verifiziert».",
          "Wählen Sie für das erste Treffen einen öffentlichen Ort (Bahnhof, Café, Dorfplatz).",
          "Sagen Sie einer vertrauten Person, wann und wo Sie sich treffen.",
        ] },
        { h: "Geld und Zahlungen", list: [
          "Bezahlen Sie nie im Voraus jemanden, den Sie nicht getroffen haben.",
          "Geben Sie nie Passwörter, SMS-Codes, PIN-Codes oder Bestätigungscodes für TWINT / E-Banking weiter.",
          "Seien Sie misstrauisch bei Anfragen nach Geschenkkarten, Kryptowährungen oder Geldüberweisungen (Western Union usw.).",
          "Vereinbaren Sie bei bezahlten Diensten den Betrag schriftlich, bevor Sie beginnen. Der Betrag in der Anzeige ist ein Richtwert.",
        ] },
        { h: "Warnsignale", list: [
          "Die Person will unbedingt den Chat verlassen oder setzt Sie unter Druck.",
          "Das Angebot ist zu schön, um wahr zu sein.",
          "Sie werden nach Ausweisen oder Bankdaten gefragt.",
          "Die Geschichte ändert sich oder wird widersprüchlich.",
        ] },
        { h: "Verletzliche Personen und Kinder", p: [
          "Nehmen Sie sich bei Kinderbetreuung oder Seniorenhilfe Zeit, die Person kennenzulernen, fragen Sie nach Referenzen und bleiben Sie erreichbar. Minderjährige sollten nie allein zu Unbekannten gehen: zuerst mit einer erwachsenen Vertrauensperson sprechen.",
        ] },
        { h: "Bei Problemen", p: ["Melden Sie die Anzeige, das Profil oder den Chat: Unser Moderationsteam prüft jede Meldung. Sie können eine Person jederzeit blockieren. Im Notfall wenden Sie sich direkt an:"], list: EMERGENCY.de },
      ],
    },
    it: {
      title: "Consigli di sicurezza",
      intro: "La grande maggioranza degli scambi va benissimo. Qualche semplice accorgimento permette di aiutarsi in tutta tranquillità.",
      sections: [
        { h: "Prima di incontrarsi", list: [
          "Scrivetevi prima tramite la chat di Voisina: non condividete numero, indirizzo o e-mail troppo presto.",
          "Guardate il profilo: anzianità, valutazioni, annunci pubblicati, badge «verificato».",
          "Per il primo incontro scegliete un luogo pubblico (stazione, bar, piazza del paese).",
          "Avvisate una persona di fiducia dell'ora e del luogo dell'appuntamento.",
        ] },
        { h: "Denaro e pagamenti", list: [
          "Non pagate mai in anticipo una persona che non avete incontrato.",
          "Non comunicate mai password, codici SMS, codici PIN o codici di conferma TWINT / e-banking.",
          "Diffidate di richieste di carte regalo, criptovalute o trasferimenti di denaro (Western Union, ecc.).",
          "Per un servizio retribuito, concordate l'importo per iscritto prima di iniziare. L'importo indicato nell'annuncio è indicativo.",
        ] },
        { h: "Segnali d'allarme", list: [
          "La persona vuole assolutamente lasciare la chat o vi mette fretta.",
          "L'offerta è troppo bella per essere vera.",
          "Vi vengono chiesti documenti d'identità o dati bancari.",
          "La storia cambia o diventa incoerente.",
        ] },
        { h: "Persone vulnerabili e bambini", p: [
          "Per la custodia di bambini o l'aiuto agli anziani prendetevi il tempo di conoscere la persona, chiedete referenze e restate raggiungibili. Un minorenne non deve mai recarsi da solo da uno sconosciuto: ne parli prima con un adulto di fiducia.",
        ] },
        { h: "In caso di problemi", p: ["Segnalate l'annuncio, il profilo o la conversazione: il nostro team di moderazione esamina ogni segnalazione. Potete anche bloccare una persona in qualsiasi momento. In caso di emergenza contattate direttamente:"], list: EMERGENCY.it },
      ],
    },
    en: {
      title: "Safety tips",
      intro: "The vast majority of exchanges go perfectly well. A few simple habits let you help each other with complete peace of mind.",
      sections: [
        { h: "Before you meet", list: [
          "Talk through Voisina's messaging first: don't share your phone number, address or email too early.",
          "Check the profile: member since, ratings, listings, “verified” badge.",
          "For a first meeting, choose a public place (station, café, village square).",
          "Tell someone you trust when and where you are meeting.",
        ] },
        { h: "Money and payments", list: [
          "Never pay in advance to someone you haven't met.",
          "Never share passwords, SMS codes, PIN codes or TWINT / e-banking confirmation codes.",
          "Be wary of requests for gift cards, cryptocurrency or money transfers (Western Union, etc.).",
          "For paid help, agree on the amount in writing before starting. The amount on the listing is indicative.",
        ] },
        { h: "Warning signs", list: [
          "The person insists on leaving the messaging system or rushes you.",
          "The offer is too good to be true.",
          "You are asked for identity documents or bank details.",
          "The story changes or stops making sense.",
        ] },
        { h: "Vulnerable people and children", p: [
          "For childcare or help for older people, take time to meet the person, ask for references and stay reachable. A minor should never go alone to a stranger's home: talk to a trusted adult first.",
        ] },
        { h: "If something goes wrong", p: ["Report the listing, profile or conversation: our moderation team reviews every report. You can also block someone at any time. In an emergency, contact the services directly:"], list: EMERGENCY.en },
      ],
    },
  },

  /* ---------------------------------------------------------- RÈGLES */
  regles: {
    fr: {
      title: "Règles de la communauté",
      intro: "Voisina repose sur la confiance. Ces règles s'appliquent à toutes les annonces, à tous les profils et à tous les messages.",
      sections: [
        { h: "1. Respect et bienveillance", p: ["Soyez courtois, même en cas de désaccord. Les insultes, le harcèlement, les menaces et tout propos discriminatoire (origine, religion, genre, orientation, handicap, âge…) sont interdits."] },
        { h: "2. Honnêteté", p: ["Décrivez votre annonce de façon exacte. N'utilisez que votre vraie identité et ne publiez pas d'annonce pour le compte d'autrui sans son accord."] },
        { h: "3. Entraide, pas commerce", p: ["Voisina est destiné à l'entraide entre particuliers. La publicité, le démarchage commercial, les annonces en série et les offres d'emploi professionnelles ne sont pas autorisés."] },
        { h: "4. Contenus interdits", list: [
          "Services ou objets illégaux (médicaments sur ordonnance, armes, substances, contrefaçons…).",
          "Activités dangereuses ou nécessitant une autorisation que vous n'avez pas (électricité, gaz, soins médicaux…).",
          "Contenus à caractère sexuel, violent ou haineux.",
          "Toute demande d'argent sans service réel, de codes bancaires ou de documents d'identité.",
        ] },
        { h: "5. Vie privée", p: ["Ne publiez jamais les données personnelles d'une autre personne (adresse, numéro, photos) sans son consentement. Utilisez la messagerie pour échanger vos coordonnées lorsque vous vous faites confiance."] },
        { h: "6. Engagement", p: ["Si vous acceptez d'aider, tenez parole ou prévenez à temps. Marquez vos annonces comme terminées lorsqu'elles ne sont plus d'actualité."] },
        { h: "7. Modération", p: ["Chaque signalement est examiné. Une annonce ou un profil ne respectant pas ces règles peut être masqué, et un compte peut être suspendu en cas d'abus répétés."] },
      ],
    },
    de: {
      title: "Community-Regeln",
      intro: "Voisina beruht auf Vertrauen. Diese Regeln gelten für alle Anzeigen, Profile und Nachrichten.",
      sections: [
        { h: "1. Respekt und Freundlichkeit", p: ["Bleiben Sie höflich, auch bei Meinungsverschiedenheiten. Beleidigungen, Belästigung, Drohungen und jede Diskriminierung (Herkunft, Religion, Geschlecht, Orientierung, Behinderung, Alter…) sind verboten."] },
        { h: "2. Ehrlichkeit", p: ["Beschreiben Sie Ihre Anzeige korrekt. Verwenden Sie nur Ihre echte Identität und inserieren Sie nicht ohne Einverständnis für andere Personen."] },
        { h: "3. Hilfe, nicht Handel", p: ["Voisina dient der Hilfe unter Privatpersonen. Werbung, kommerzielle Akquise, Serienanzeigen und professionelle Stellenangebote sind nicht erlaubt."] },
        { h: "4. Verbotene Inhalte", list: [
          "Illegale Dienste oder Gegenstände (verschreibungspflichtige Medikamente, Waffen, Substanzen, Fälschungen…).",
          "Gefährliche Tätigkeiten oder solche, für die eine Bewilligung nötig ist, die Sie nicht haben (Elektro, Gas, medizinische Pflege…).",
          "Sexuelle, gewalttätige oder hasserfüllte Inhalte.",
          "Geldforderungen ohne echte Leistung, Anfragen nach Bankcodes oder Ausweisen.",
        ] },
        { h: "5. Privatsphäre", p: ["Veröffentlichen Sie nie persönliche Daten anderer (Adresse, Nummer, Fotos) ohne deren Zustimmung. Tauschen Sie Kontaktdaten über den Chat aus, wenn Sie einander vertrauen."] },
        { h: "6. Verbindlichkeit", p: ["Wenn Sie Hilfe zusagen, halten Sie Wort oder sagen Sie rechtzeitig ab. Markieren Sie Anzeigen als erledigt, wenn sie nicht mehr aktuell sind."] },
        { h: "7. Moderation", p: ["Jede Meldung wird geprüft. Anzeigen oder Profile, die gegen diese Regeln verstossen, können ausgeblendet und Konten bei wiederholtem Missbrauch gesperrt werden."] },
      ],
    },
    it: {
      title: "Regole della comunità",
      intro: "Voisina si basa sulla fiducia. Queste regole valgono per tutti gli annunci, i profili e i messaggi.",
      sections: [
        { h: "1. Rispetto e gentilezza", p: ["Siate cortesi anche in caso di disaccordo. Insulti, molestie, minacce e ogni forma di discriminazione (origine, religione, genere, orientamento, disabilità, età…) sono vietati."] },
        { h: "2. Onestà", p: ["Descrivete l'annuncio in modo corretto. Usate solo la vostra vera identità e non pubblicate per conto di altri senza il loro consenso."] },
        { h: "3. Aiuto, non commercio", p: ["Voisina è dedicato all'aiuto tra privati. Pubblicità, promozione commerciale, annunci in serie e offerte di lavoro professionali non sono ammessi."] },
        { h: "4. Contenuti vietati", list: [
          "Servizi o oggetti illegali (farmaci soggetti a ricetta, armi, sostanze, contraffazioni…).",
          "Attività pericolose o che richiedono un'autorizzazione che non avete (elettricità, gas, cure mediche…).",
          "Contenuti sessuali, violenti o d'odio.",
          "Richieste di denaro senza un vero servizio, di codici bancari o di documenti d'identità.",
        ] },
        { h: "5. Privacy", p: ["Non pubblicate mai dati personali di altre persone (indirizzo, numero, foto) senza il loro consenso. Scambiatevi i contatti tramite la chat quando vi fidate l'uno dell'altro."] },
        { h: "6. Impegno", p: ["Se accettate di aiutare, mantenete la parola o avvisate in tempo. Segnate gli annunci come conclusi quando non sono più attuali."] },
        { h: "7. Moderazione", p: ["Ogni segnalazione viene esaminata. Annunci o profili che non rispettano queste regole possono essere nascosti e gli account sospesi in caso di abusi ripetuti."] },
      ],
    },
    en: {
      title: "Community rules",
      intro: "Voisina is built on trust. These rules apply to every listing, profile and message.",
      sections: [
        { h: "1. Respect and kindness", p: ["Stay polite, even when you disagree. Insults, harassment, threats and any discrimination (origin, religion, gender, orientation, disability, age…) are forbidden."] },
        { h: "2. Honesty", p: ["Describe your listing accurately. Only use your real identity and don't post on someone else's behalf without their consent."] },
        { h: "3. Help, not business", p: ["Voisina is for help between private individuals. Advertising, commercial canvassing, mass listings and professional job offers are not allowed."] },
        { h: "4. Forbidden content", list: [
          "Illegal services or items (prescription drugs, weapons, substances, counterfeits…).",
          "Dangerous work or work requiring a licence you don't hold (electrical, gas, medical care…).",
          "Sexual, violent or hateful content.",
          "Requests for money without a real service, for bank codes or identity documents.",
        ] },
        { h: "5. Privacy", p: ["Never publish another person's personal data (address, number, photos) without their consent. Use the messaging system to exchange contact details once you trust each other."] },
        { h: "6. Commitment", p: ["If you agree to help, keep your word or cancel in good time. Mark your listings as done when they are no longer relevant."] },
        { h: "7. Moderation", p: ["Every report is reviewed. Listings or profiles breaking these rules may be hidden, and accounts may be suspended after repeated abuse."] },
      ],
    },
  },

  /* ------------------------------------------------------ CONDITIONS */
  conditions: {
    fr: {
      title: "Conditions d'utilisation",
      updated: "Version de démonstration — dernière mise à jour : septembre 2026",
      sections: [
        { h: "1. Objet", p: ["Voisina est une plateforme qui met en relation des particuliers souhaitant s'entraider en Suisse. Voisina n'est partie à aucun accord conclu entre membres et n'agit pas comme employeur, intermédiaire de paiement ou prestataire de services."] },
        { h: "2. Statut du service", p: ["Le site est actuellement un prototype réalisé dans le cadre d'un projet scolaire de fin d'année. Les annonces d'exemple sont fictives et les données saisies restent dans votre navigateur. Le service est fourni tel quel, sans garantie de disponibilité."] },
        { h: "3. Inscription", p: ["L'inscription est gratuite et réservée aux personnes âgées d'au moins 16 ans ; en dessous, l'accord d'un représentant légal est nécessaire. Vous vous engagez à fournir des informations exactes et à garder votre mot de passe confidentiel."] },
        { h: "4. Annonces et comportements", p: ["Vous êtes responsable du contenu que vous publiez et de vos échanges. Vous vous engagez à respecter les Règles de la communauté et le droit suisse."] },
        { h: "5. Services rémunérés", p: ["Les montants sont convenus librement entre membres ; Voisina n'encaisse rien. Il appartient aux membres de respecter leurs éventuelles obligations légales (déclaration des revenus, cotisations sociales AVS pour certains travaux domestiques, assurances)."] },
        { h: "6. Modération", p: ["Voisina peut masquer ou supprimer tout contenu contraire aux présentes conditions et suspendre un compte en cas d'abus, sans préavis."] },
        { h: "7. Responsabilité", p: ["Dans les limites permises par la loi, Voisina décline toute responsabilité pour les dommages résultant des échanges entre membres. Chacun reste responsable de ses actes."] },
        { h: "8. Droit applicable", p: ["Les présentes conditions sont soumises au droit suisse. Le for est au siège de l'exploitant, sous réserve des fors impératifs prévus par la loi."] },
      ],
    },
    de: {
      title: "Nutzungsbedingungen",
      updated: "Demoversion — letzte Aktualisierung: September 2026",
      sections: [
        { h: "1. Zweck", p: ["Voisina ist eine Plattform, die Privatpersonen in der Schweiz für gegenseitige Hilfe zusammenbringt. Voisina ist nicht Partei von Vereinbarungen zwischen Mitgliedern und handelt weder als Arbeitgeberin noch als Zahlungsvermittlerin oder Dienstleisterin."] },
        { h: "2. Status des Dienstes", p: ["Die Website ist derzeit ein Prototyp im Rahmen eines schulischen Abschlussprojekts. Die Beispielanzeigen sind fiktiv, und eingegebene Daten bleiben in Ihrem Browser. Der Dienst wird ohne Verfügbarkeitsgarantie bereitgestellt."] },
        { h: "3. Registrierung", p: ["Die Registrierung ist kostenlos und Personen ab 16 Jahren vorbehalten; darunter ist die Zustimmung einer gesetzlichen Vertretung nötig. Sie verpflichten sich zu korrekten Angaben und halten Ihr Passwort geheim."] },
        { h: "4. Anzeigen und Verhalten", p: ["Sie sind für Ihre Inhalte und Ihren Austausch verantwortlich und verpflichten sich, die Community-Regeln und das Schweizer Recht einzuhalten."] },
        { h: "5. Bezahlte Dienste", p: ["Beträge werden frei zwischen Mitgliedern vereinbart; Voisina kassiert nichts. Die Mitglieder sind selbst für allfällige gesetzliche Pflichten verantwortlich (Einkommensdeklaration, AHV-Beiträge bei gewissen Hausarbeiten, Versicherungen)."] },
        { h: "6. Moderation", p: ["Voisina kann Inhalte, die gegen diese Bedingungen verstossen, ohne Vorankündigung ausblenden oder löschen und Konten bei Missbrauch sperren."] },
        { h: "7. Haftung", p: ["Soweit gesetzlich zulässig, lehnt Voisina jede Haftung für Schäden aus dem Austausch zwischen Mitgliedern ab. Jede Person bleibt für ihr Handeln verantwortlich."] },
        { h: "8. Anwendbares Recht", p: ["Es gilt Schweizer Recht. Gerichtsstand ist der Sitz der Betreiberin, vorbehaltlich zwingender gesetzlicher Gerichtsstände."] },
      ],
    },
    it: {
      title: "Condizioni d'uso",
      updated: "Versione dimostrativa — ultimo aggiornamento: settembre 2026",
      sections: [
        { h: "1. Oggetto", p: ["Voisina è una piattaforma che mette in contatto privati che desiderano aiutarsi in Svizzera. Voisina non è parte degli accordi tra membri e non agisce come datore di lavoro, intermediario di pagamento o fornitore di servizi."] },
        { h: "2. Stato del servizio", p: ["Il sito è attualmente un prototipo realizzato nell'ambito di un progetto scolastico di fine anno. Gli annunci d'esempio sono fittizi e i dati inseriti restano nel vostro browser. Il servizio è fornito senza garanzia di disponibilità."] },
        { h: "3. Iscrizione", p: ["L'iscrizione è gratuita e riservata alle persone di almeno 16 anni; al di sotto è necessario il consenso di un rappresentante legale. Vi impegnate a fornire informazioni corrette e a mantenere segreta la password."] },
        { h: "4. Annunci e comportamenti", p: ["Siete responsabili dei contenuti che pubblicate e dei vostri scambi. Vi impegnate a rispettare le Regole della comunità e il diritto svizzero."] },
        { h: "5. Servizi retribuiti", p: ["Gli importi sono concordati liberamente tra membri; Voisina non incassa nulla. Spetta ai membri rispettare eventuali obblighi legali (dichiarazione dei redditi, contributi AVS per alcuni lavori domestici, assicurazioni)."] },
        { h: "6. Moderazione", p: ["Voisina può nascondere o eliminare senza preavviso qualsiasi contenuto contrario alle presenti condizioni e sospendere un account in caso di abuso."] },
        { h: "7. Responsabilità", p: ["Nei limiti consentiti dalla legge, Voisina declina ogni responsabilità per danni derivanti dagli scambi tra membri. Ciascuno resta responsabile delle proprie azioni."] },
        { h: "8. Diritto applicabile", p: ["Si applica il diritto svizzero. Il foro è presso la sede del gestore, riservati i fori imperativi previsti dalla legge."] },
      ],
    },
    en: {
      title: "Terms of use",
      updated: "Demo version — last updated: September 2026",
      sections: [
        { h: "1. Purpose", p: ["Voisina is a platform connecting private individuals who want to help each other in Switzerland. Voisina is not a party to any agreement between members and does not act as an employer, payment intermediary or service provider."] },
        { h: "2. Service status", p: ["The site is currently a prototype built as an end-of-year school project. Sample listings are fictional and the data you enter stays in your browser. The service is provided as is, with no availability guarantee."] },
        { h: "3. Registration", p: ["Registration is free and reserved for people aged 16 or over; under 16, a legal guardian's consent is required. You agree to provide accurate information and keep your password confidential."] },
        { h: "4. Listings and behaviour", p: ["You are responsible for the content you post and for your exchanges. You agree to follow the Community rules and Swiss law."] },
        { h: "5. Paid help", p: ["Amounts are freely agreed between members; Voisina collects nothing. Members are responsible for any legal obligations (declaring income, AHV/AVS social contributions for certain household work, insurance)."] },
        { h: "6. Moderation", p: ["Voisina may hide or remove any content that breaches these terms and suspend accounts in case of abuse, without notice."] },
        { h: "7. Liability", p: ["To the extent permitted by law, Voisina accepts no liability for damage arising from exchanges between members. Everyone remains responsible for their own actions."] },
        { h: "8. Governing law", p: ["These terms are governed by Swiss law. The place of jurisdiction is the operator's registered office, subject to mandatory statutory jurisdictions."] },
      ],
    },
  },

  /* ---------------------------------------------------- CONFIDENTIALITÉ */
  confidentialite: {
    fr: {
      title: "Politique de confidentialité",
      intro: "Rédigée selon la loi fédérale sur la protection des données (nLPD), en vigueur depuis le 1er septembre 2023.",
      updated: "Dernière mise à jour : septembre 2026",
      sections: [
        { h: "En bref", list: [
          "Aucun cookie, aucun outil de statistiques, aucune publicité, aucun traceur.",
          "Dans cette version, vos données restent uniquement dans votre navigateur : elles ne sont envoyées à aucun serveur Voisina.",
          "Votre mot de passe n'est jamais enregistré : seule une empreinte chiffrée (PBKDF2) est conservée.",
          "Votre adresse exacte n'est jamais demandée ni affichée.",
        ] },
        { h: "Responsable du traitement", p: ["Voisina — projet scolaire de fin d'année (voir les mentions légales)."] },
        { h: "Données traitées", list: [
          "Compte : prénom, nom (seule l'initiale est publique), e-mail, localité, canton, empreinte du mot de passe.",
          "Profil facultatif : photo, présentation, langues, spécialités.",
          "Contenus : annonces, photos d'annonces, messages, favoris, signalements.",
          "Préférences : langue, thème, point de référence pour le calcul des distances.",
        ] },
        { h: "Où sont stockées vos données ?", p: ["Dans ce prototype, toutes les données sont enregistrées dans le stockage local (localStorage) de votre navigateur, sur votre appareil. Elles ne sont pas partagées avec d'autres appareils. Vider les données du site dans votre navigateur les supprime définitivement."] },
        { h: "Services tiers", p: ["Pour fonctionner, le site fait appel aux services suivants, qui reçoivent techniquement votre adresse IP :"], list: [
          "GitHub Pages (GitHub Inc., États-Unis) : hébergement du site.",
          "unpkg.com : distribution de la bibliothèque de cartes Leaflet (fichier vérifié par empreinte SRI).",
          "swisstopo (Office fédéral de topographie, Suisse) : fonds de carte ; OpenStreetMap en secours.",
          "geo.admin.ch (Confédération suisse) : recherche de localités — seul le texte saisi dans le champ « localité » est transmis.",
          "DeepL (Allemagne) : uniquement si vous cliquez sur « Traduire », le texte de l'annonce est ouvert sur deepl.com.",
        ] },
        { h: "Vos droits", p: ["Vous pouvez à tout moment consulter, corriger, exporter (fichier JSON) ou supprimer vos données depuis « Mon compte ». Vous pouvez également adresser une réclamation au Préposé fédéral à la protection des données et à la transparence (PFPDT)."] },
        { h: "Sécurité", p: ["Politique de sécurité du contenu (CSP) stricte, échappement systématique des contenus, empreintes de mots de passe PBKDF2 avec 600 000 itérations, limitation des tentatives de connexion, suppression des métadonnées GPS des photos, position floutée sur la carte."] },
        { h: "Version future avec serveur", p: ["Si Voisina est un jour mis en ligne avec un serveur, les données seraient hébergées en Suisse ou dans l'UE, cette politique serait mise à jour et vous en seriez informé·e avant tout changement."] },
      ],
    },
    de: {
      title: "Datenschutzerklärung",
      intro: "Verfasst nach dem revidierten Datenschutzgesetz (revDSG), in Kraft seit dem 1. September 2023.",
      updated: "Letzte Aktualisierung: September 2026",
      sections: [
        { h: "Kurz gesagt", list: [
          "Keine Cookies, keine Statistik-Tools, keine Werbung, keine Tracker.",
          "In dieser Version bleiben Ihre Daten ausschliesslich in Ihrem Browser: Sie werden an keinen Voisina-Server gesendet.",
          "Ihr Passwort wird nie gespeichert: Nur ein verschlüsselter Fingerabdruck (PBKDF2) wird aufbewahrt.",
          "Ihre genaue Adresse wird weder abgefragt noch angezeigt.",
        ] },
        { h: "Verantwortliche Stelle", p: ["Voisina — schulisches Abschlussprojekt (siehe Impressum)."] },
        { h: "Bearbeitete Daten", list: [
          "Konto: Vorname, Nachname (nur die Initiale ist öffentlich), E-Mail, Ort, Kanton, Passwort-Fingerabdruck.",
          "Freiwilliges Profil: Foto, Beschreibung, Sprachen, Fähigkeiten.",
          "Inhalte: Anzeigen, Anzeigenfotos, Nachrichten, Favoriten, Meldungen.",
          "Einstellungen: Sprache, Design, Referenzpunkt für Distanzen.",
        ] },
        { h: "Wo werden Ihre Daten gespeichert?", p: ["In diesem Prototyp werden alle Daten im lokalen Speicher (localStorage) Ihres Browsers auf Ihrem Gerät abgelegt. Sie werden nicht mit anderen Geräten geteilt. Wenn Sie die Websitedaten im Browser löschen, sind sie endgültig entfernt."] },
        { h: "Drittdienste", p: ["Für den Betrieb nutzt die Website folgende Dienste, die technisch Ihre IP-Adresse erhalten:"], list: [
          "GitHub Pages (GitHub Inc., USA): Hosting der Website.",
          "unpkg.com: Auslieferung der Kartenbibliothek Leaflet (Datei per SRI-Prüfsumme verifiziert).",
          "swisstopo (Bundesamt für Landestopografie, Schweiz): Kartenhintergrund; OpenStreetMap als Ersatz.",
          "geo.admin.ch (Schweizerische Eidgenossenschaft): Ortssuche — nur der im Feld «Ort» eingegebene Text wird übermittelt.",
          "DeepL (Deutschland): nur wenn Sie auf «Übersetzen» klicken, wird der Anzeigentext auf deepl.com geöffnet.",
        ] },
        { h: "Ihre Rechte", p: ["Sie können Ihre Daten jederzeit unter «Mein Konto» einsehen, berichtigen, exportieren (JSON-Datei) oder löschen. Sie können sich zudem beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) beschweren."] },
        { h: "Sicherheit", p: ["Strikte Content Security Policy (CSP), systematisches Escaping von Inhalten, PBKDF2-Passwort-Fingerabdrücke mit 600 000 Iterationen, Begrenzung der Anmeldeversuche, Entfernung der GPS-Metadaten aus Fotos, ungenaue Position auf der Karte."] },
        { h: "Künftige Serverversion", p: ["Sollte Voisina mit einem Server online gehen, würden die Daten in der Schweiz oder der EU gehostet, diese Erklärung aktualisiert und Sie vorab informiert."] },
      ],
    },
    it: {
      title: "Informativa sulla privacy",
      intro: "Redatta secondo la nuova legge federale sulla protezione dei dati (nLPD), in vigore dal 1° settembre 2023.",
      updated: "Ultimo aggiornamento: settembre 2026",
      sections: [
        { h: "In breve", list: [
          "Nessun cookie, nessuno strumento statistico, nessuna pubblicità, nessun tracker.",
          "In questa versione i vostri dati restano soltanto nel vostro browser: non vengono inviati a nessun server di Voisina.",
          "La password non viene mai salvata: viene conservata solo un'impronta cifrata (PBKDF2).",
          "Il vostro indirizzo esatto non viene mai chiesto né mostrato.",
        ] },
        { h: "Titolare del trattamento", p: ["Voisina — progetto scolastico di fine anno (vedi note legali)."] },
        { h: "Dati trattati", list: [
          "Account: nome, cognome (è pubblica solo l'iniziale), e-mail, località, cantone, impronta della password.",
          "Profilo facoltativo: foto, presentazione, lingue, competenze.",
          "Contenuti: annunci, foto degli annunci, messaggi, preferiti, segnalazioni.",
          "Preferenze: lingua, tema, punto di riferimento per il calcolo delle distanze.",
        ] },
        { h: "Dove sono salvati i dati?", p: ["In questo prototipo tutti i dati sono registrati nella memoria locale (localStorage) del browser, sul vostro dispositivo. Non sono condivisi con altri dispositivi. Cancellando i dati del sito nel browser vengono eliminati definitivamente."] },
        { h: "Servizi di terzi", p: ["Per funzionare, il sito utilizza i seguenti servizi, che ricevono tecnicamente il vostro indirizzo IP:"], list: [
          "GitHub Pages (GitHub Inc., Stati Uniti): hosting del sito.",
          "unpkg.com: distribuzione della libreria cartografica Leaflet (file verificato con impronta SRI).",
          "swisstopo (Ufficio federale di topografia, Svizzera): sfondi cartografici; OpenStreetMap come riserva.",
          "geo.admin.ch (Confederazione Svizzera): ricerca delle località — viene trasmesso solo il testo digitato nel campo «località».",
          "DeepL (Germania): solo se cliccate su «Traduci», il testo dell'annuncio viene aperto su deepl.com.",
        ] },
        { h: "I vostri diritti", p: ["Potete in qualsiasi momento consultare, correggere, esportare (file JSON) o eliminare i vostri dati da «Il mio account». Potete inoltre presentare reclamo all'Incaricato federale della protezione dei dati e della trasparenza (IFPDT)."] },
        { h: "Sicurezza", p: ["Content Security Policy (CSP) rigorosa, escaping sistematico dei contenuti, impronte delle password PBKDF2 con 600 000 iterazioni, limitazione dei tentativi di accesso, rimozione dei metadati GPS dalle foto, posizione sfocata sulla carta."] },
        { h: "Versione futura con server", p: ["Se Voisina venisse messo online con un server, i dati sarebbero ospitati in Svizzera o nell'UE, questa informativa sarebbe aggiornata e ne sareste informati prima di qualsiasi cambiamento."] },
      ],
    },
    en: {
      title: "Privacy policy",
      intro: "Written in line with the revised Swiss Federal Act on Data Protection (FADP), in force since 1 September 2023.",
      updated: "Last updated: September 2026",
      sections: [
        { h: "In short", list: [
          "No cookies, no analytics, no ads, no trackers.",
          "In this version, your data stays in your browser only: it is not sent to any Voisina server.",
          "Your password is never stored: only an encrypted fingerprint (PBKDF2) is kept.",
          "Your exact address is never requested or shown.",
        ] },
        { h: "Controller", p: ["Voisina — end-of-year school project (see legal notice)."] },
        { h: "Data processed", list: [
          "Account: first name, last name (only the initial is public), email, town, canton, password fingerprint.",
          "Optional profile: photo, bio, languages, skills.",
          "Content: listings, listing photos, messages, favourites, reports.",
          "Preferences: language, theme, reference point for distances.",
        ] },
        { h: "Where is your data stored?", p: ["In this prototype, all data is saved in your browser's local storage (localStorage), on your device. It is not shared with other devices. Clearing the site data in your browser deletes it permanently."] },
        { h: "Third-party services", p: ["To work, the site uses the following services, which technically receive your IP address:"], list: [
          "GitHub Pages (GitHub Inc., USA): website hosting.",
          "unpkg.com: delivery of the Leaflet map library (file verified with an SRI hash).",
          "swisstopo (Federal Office of Topography, Switzerland): base maps; OpenStreetMap as a fallback.",
          "geo.admin.ch (Swiss Confederation): place search — only the text typed in the “town” field is sent.",
          "DeepL (Germany): only if you click “Translate”, the listing text is opened on deepl.com.",
        ] },
        { h: "Your rights", p: ["You can view, correct, export (JSON file) or delete your data at any time from “My account”. You may also lodge a complaint with the Federal Data Protection and Information Commissioner (FDPIC)."] },
        { h: "Security", p: ["Strict Content Security Policy (CSP), systematic output escaping, PBKDF2 password fingerprints with 600,000 iterations, login attempt limiting, removal of GPS metadata from photos, blurred map positions."] },
        { h: "Future server version", p: ["Should Voisina go live with a server, data would be hosted in Switzerland or the EU, this policy would be updated and you would be informed beforehand."] },
      ],
    },
  },

  /* ------------------------------------------------ MENTIONS LÉGALES */
  "mentions-legales": {
    fr: {
      title: "Mentions légales",
      sections: [
        { h: "Éditeur du site", p: ["Voisina — projet scolaire de fin d'année réalisé par Lenny H., Suisse.", "Ce site est un prototype pédagogique non commercial. Les annonces et les membres d'exemple sont fictifs ; toute ressemblance avec des personnes réelles serait fortuite."] },
        { h: "Hébergement", p: ["GitHub Pages — GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis."] },
        { h: "Cartes et données géographiques", p: ["Fonds de carte © swisstopo (Office fédéral de topographie). Données de repli © contributeurs OpenStreetMap. Recherche de localités : service geo.admin.ch de la Confédération suisse."] },
        { h: "Crédits", list: ["Bibliothèque de cartes : Leaflet (licence BSD-2).", "Police de titres : Fraunces (SIL Open Font License).", "Icônes inspirées de Lucide (licence ISC)."] },
        { h: "Propriété intellectuelle", p: ["Les textes, le logo et la conception du site sont la propriété de leur auteur. Les contenus publiés par les membres restent leur propriété."] },
      ],
    },
    de: {
      title: "Impressum",
      sections: [
        { h: "Herausgeber", p: ["Voisina — schulisches Abschlussprojekt von Lenny H., Schweiz.", "Diese Website ist ein nicht kommerzieller Lernprototyp. Beispielanzeigen und -mitglieder sind fiktiv; Ähnlichkeiten mit realen Personen wären zufällig."] },
        { h: "Hosting", p: ["GitHub Pages — GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA."] },
        { h: "Karten und Geodaten", p: ["Kartenhintergrund © swisstopo (Bundesamt für Landestopografie). Ersatzdaten © OpenStreetMap-Mitwirkende. Ortssuche: Dienst geo.admin.ch der Schweizerischen Eidgenossenschaft."] },
        { h: "Credits", list: ["Kartenbibliothek: Leaflet (BSD-2-Lizenz).", "Titelschrift: Fraunces (SIL Open Font License).", "Icons inspiriert von Lucide (ISC-Lizenz)."] },
        { h: "Geistiges Eigentum", p: ["Texte, Logo und Gestaltung der Website gehören ihrem Autor. Von Mitgliedern veröffentlichte Inhalte bleiben deren Eigentum."] },
      ],
    },
    it: {
      title: "Note legali",
      sections: [
        { h: "Editore del sito", p: ["Voisina — progetto scolastico di fine anno realizzato da Lenny H., Svizzera.", "Questo sito è un prototipo didattico non commerciale. Gli annunci e i membri d'esempio sono fittizi; ogni somiglianza con persone reali è casuale."] },
        { h: "Hosting", p: ["GitHub Pages — GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, Stati Uniti."] },
        { h: "Carte e dati geografici", p: ["Sfondi cartografici © swisstopo (Ufficio federale di topografia). Dati di riserva © contributori OpenStreetMap. Ricerca delle località: servizio geo.admin.ch della Confederazione Svizzera."] },
        { h: "Crediti", list: ["Libreria cartografica: Leaflet (licenza BSD-2).", "Carattere dei titoli: Fraunces (SIL Open Font License).", "Icone ispirate a Lucide (licenza ISC)."] },
        { h: "Proprietà intellettuale", p: ["Testi, logo e concezione del sito appartengono al loro autore. I contenuti pubblicati dai membri restano di loro proprietà."] },
      ],
    },
    en: {
      title: "Legal notice",
      sections: [
        { h: "Publisher", p: ["Voisina — end-of-year school project by Lenny H., Switzerland.", "This site is a non-commercial educational prototype. Sample listings and members are fictional; any resemblance to real people is coincidental."] },
        { h: "Hosting", p: ["GitHub Pages — GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA."] },
        { h: "Maps and geodata", p: ["Base maps © swisstopo (Federal Office of Topography). Fallback data © OpenStreetMap contributors. Place search: geo.admin.ch service of the Swiss Confederation."] },
        { h: "Credits", list: ["Map library: Leaflet (BSD-2 licence).", "Heading font: Fraunces (SIL Open Font License).", "Icons inspired by Lucide (ISC licence)."] },
        { h: "Intellectual property", p: ["The texts, logo and design of the site belong to their author. Content posted by members remains their property."] },
      ],
    },
  },

  /* ---------------------------------------------------------- À PROPOS */
  "a-propos": {
    fr: {
      title: "À propos de Voisina",
      intro: "Rendre l'entraide locale plus simple, plus accessible et plus humaine, partout en Suisse.",
      sections: [
        { h: "Notre idée", p: ["Tout le monde a un jour besoin d'un coup de main : porter un meuble, promener un chien, comprendre un formulaire, trouver de la compagnie. Et tout le monde a quelque chose à offrir. Voisina met ces personnes en relation, près de chez elles, dans leur langue."] },
        { h: "Nos principes", list: [
          "Gratuit et sans publicité.",
          "Respect de la vie privée dès la conception : pas de traceur, adresse jamais affichée.",
          "Multilingue comme la Suisse : français, allemand, italien et anglais.",
          "Accessible à toutes et à tous, y compris aux personnes âgées et aux lecteurs d'écran.",
        ] },
        { h: "Un projet de fin d'année", p: ["Voisina a été conçu et développé dans le cadre d'un projet scolaire. Le site fonctionne entièrement dans le navigateur : les annonces d'exemple servent à la démonstration et vos données restent sur votre appareil."] },
        { h: "Sous le capot", list: [
          "HTML, CSS et JavaScript modernes, sans framework, pour un site rapide et léger.",
          "Application monopage avec liens partageables vers chaque annonce.",
          "Carte officielle swisstopo et recherche de communes de la Confédération.",
          "Sécurité : CSP stricte, protection XSS, mots de passe hachés (PBKDF2), anti force brute.",
          "Installable sur smartphone comme une application (PWA) et utilisable hors connexion.",
        ] },
        { h: "Et ensuite ?", p: ["Prochaines étapes envisagées : un serveur sécurisé hébergé en Suisse pour partager les annonces entre tous les appareils, la vérification des profils par e-mail et SMS, les évaluations après chaque échange et des groupes de quartier."] },
      ],
    },
    de: {
      title: "Über Voisina",
      intro: "Nachbarschaftshilfe einfacher, zugänglicher und menschlicher machen – in der ganzen Schweiz.",
      sections: [
        { h: "Unsere Idee", p: ["Alle brauchen irgendwann Hilfe: ein Möbel tragen, den Hund ausführen, ein Formular verstehen, Gesellschaft finden. Und alle haben etwas zu geben. Voisina bringt diese Menschen zusammen – in ihrer Nähe und in ihrer Sprache."] },
        { h: "Unsere Grundsätze", list: [
          "Kostenlos und ohne Werbung.",
          "Datenschutz von Anfang an: keine Tracker, Adresse nie sichtbar.",
          "Mehrsprachig wie die Schweiz: Deutsch, Französisch, Italienisch und Englisch.",
          "Für alle zugänglich, auch für ältere Menschen und Screenreader.",
        ] },
        { h: "Ein Abschlussprojekt", p: ["Voisina wurde im Rahmen eines Schulprojekts konzipiert und entwickelt. Die Website läuft vollständig im Browser: Die Beispielanzeigen dienen der Demonstration, und Ihre Daten bleiben auf Ihrem Gerät."] },
        { h: "Unter der Haube", list: [
          "Modernes HTML, CSS und JavaScript ohne Framework – schnell und leicht.",
          "Single-Page-App mit teilbaren Links zu jeder Anzeige.",
          "Offizielle swisstopo-Karte und Gemeindesuche des Bundes.",
          "Sicherheit: strikte CSP, XSS-Schutz, gehashte Passwörter (PBKDF2), Schutz vor Brute-Force.",
          "Auf dem Smartphone wie eine App installierbar (PWA) und offline nutzbar.",
        ] },
        { h: "Wie geht es weiter?", p: ["Geplante nächste Schritte: ein sicherer Server in der Schweiz, damit Anzeigen auf allen Geräten sichtbar sind, Profilverifizierung per E-Mail und SMS, Bewertungen nach jedem Austausch und Quartiergruppen."] },
      ],
    },
    it: {
      title: "Chi siamo",
      intro: "Rendere l'aiuto tra vicini più semplice, accessibile e umano, in tutta la Svizzera.",
      sections: [
        { h: "La nostra idea", p: ["Tutti prima o poi hanno bisogno di una mano: portare un mobile, portare a spasso il cane, capire un modulo, trovare compagnia. E tutti hanno qualcosa da offrire. Voisina mette in contatto queste persone, vicino a casa e nella loro lingua."] },
        { h: "I nostri principi", list: [
          "Gratuito e senza pubblicità.",
          "Privacy fin dalla progettazione: nessun tracker, indirizzo mai mostrato.",
          "Multilingue come la Svizzera: italiano, francese, tedesco e inglese.",
          "Accessibile a tutti, anche alle persone anziane e ai lettori di schermo.",
        ] },
        { h: "Un progetto di fine anno", p: ["Voisina è stato ideato e sviluppato nell'ambito di un progetto scolastico. Il sito funziona interamente nel browser: gli annunci d'esempio servono alla dimostrazione e i vostri dati restano sul vostro dispositivo."] },
        { h: "Sotto il cofano", list: [
          "HTML, CSS e JavaScript moderni, senza framework, per un sito veloce e leggero.",
          "Applicazione a pagina singola con link condivisibili per ogni annuncio.",
          "Carta ufficiale swisstopo e ricerca dei comuni della Confederazione.",
          "Sicurezza: CSP rigorosa, protezione XSS, password con hash (PBKDF2), protezione brute force.",
          "Installabile sullo smartphone come un'app (PWA) e utilizzabile offline.",
        ] },
        { h: "E poi?", p: ["Prossime tappe previste: un server sicuro ospitato in Svizzera per condividere gli annunci tra tutti i dispositivi, la verifica dei profili via e-mail e SMS, le valutazioni dopo ogni scambio e i gruppi di quartiere."] },
      ],
    },
    en: {
      title: "About Voisina",
      intro: "Making local help simpler, more accessible and more human, all across Switzerland.",
      sections: [
        { h: "Our idea", p: ["Everyone needs a hand at some point: carrying furniture, walking a dog, understanding a form, finding some company. And everyone has something to offer. Voisina connects these people, close to home and in their own language."] },
        { h: "Our principles", list: [
          "Free and ad-free.",
          "Privacy by design: no trackers, addresses never shown.",
          "Multilingual like Switzerland: French, German, Italian and English.",
          "Accessible to everyone, including older people and screen reader users.",
        ] },
        { h: "An end-of-year project", p: ["Voisina was designed and built as a school project. The site runs entirely in the browser: sample listings are for demonstration and your data stays on your device."] },
        { h: "Under the hood", list: [
          "Modern HTML, CSS and JavaScript with no framework, for a fast, lightweight site.",
          "Single-page app with shareable links to every listing.",
          "Official swisstopo map and federal municipality search.",
          "Security: strict CSP, XSS protection, hashed passwords (PBKDF2), brute-force protection.",
          "Installable on smartphones like an app (PWA) and usable offline.",
        ] },
        { h: "What's next?", p: ["Planned next steps: a secure server hosted in Switzerland so listings are shared across all devices, profile verification by email and SMS, ratings after each exchange and neighbourhood groups."] },
      ],
    },
  },
};

return { PAGE_ORDER, PAGES };
});
__def("views/pages.js", function () {
/* Pages d'information : aide, sécurité, règles, conditions, confidentialité, mentions légales, à propos */
const { html } = __req("util.js");
const { icon } = __req("icons.js");
const { t, getLang } = __req("i18n.js");
const { PAGES, PAGE_ORDER } = __req("pages-content.js");
const { emptyState } = __req("ui.js");

const PAGE_ICONS = { aide: "help", securite: "shieldCheck", regles: "users", conditions: "file", confidentialite: "lock", "mentions-legales": "info", "a-propos": "leaf" };

function content(slug) {
  const page = PAGES[slug];
  return page ? page[getLang()] || page.fr : null;
}

const __default = {
  title: (ctx) => content(ctx.params[0])?.title || t("notFound.title"),
  refreshOn: [],

  render(ctx) {
    const slug = ctx.params[0];
    const c = content(slug);
    if (!c) return html`<section class="section"><div class="container narrow">${emptyState({ iconName: "search", title: t("notFound.title"), action: html`<a class="btn btn-primary" href="#/">${t("notFound.home")}</a>` })}</div></section>`;
    return html`
    <section class="page-head">
      <div class="container narrow-wide">
        <span class="kicker">${icon(PAGE_ICONS[slug] || "file")}${t("pages.kicker")}</span>
        <h1 class="h1">${c.title}</h1>
        ${c.intro ? html`<p class="lead">${c.intro}</p>` : ""}
        ${c.updated ? html`<p class="muted small">${c.updated}</p>` : ""}
      </div>
    </section>
    <div class="container pages-layout">
      <nav class="pages-nav" aria-label="${t("pages.nav")}">
        ${PAGE_ORDER.map((s) => html`<a class="pages-nav-link${s === slug ? " is-active" : ""}" href="#/page/${s}" ${s === slug ? html`aria-current="page"` : ""}>${icon(PAGE_ICONS[s])}${content(s).title}</a>`)}
      </nav>
      <article class="prose">
        ${c.sections.map((s) => html`<section>
          <h2>${s.h}</h2>
          ${(s.p || []).map((p) => html`<p>${p}</p>`)}
          ${s.list ? html`<ul>${s.list.map((li) => html`<li>${li}</li>`)}</ul>` : ""}
          ${s.qa ? html`<div class="faq">${s.qa.map(([q, a]) => html`<details class="faq-item"><summary>${q}${icon("chevronDown")}</summary><p>${a}</p></details>`)}</div>` : ""}
        </section>`)}
        ${c.contact ? html`<div class="notice">${icon("mail")}<span>${c.contact}</span></div>` : ""}
      </article>
    </div>`;
  },
};

return { default: __default };
});
__def("app.js", function () {
/* =====================================================================
   VOISINA — point d'entrée de l'application
   ---------------------------------------------------------------------
   - Routeur : chaque "page" correspond à une adresse #/... (liens
     partageables, bouton retour du navigateur fonctionnel).
   - En-tête, pied de page, barre mobile, notifications.
   - Délégation des clics : un seul écouteur gère tous les boutons
     data-action (compatible avec notre politique de sécurité CSP).
   ===================================================================== */
const { html, raw, $, $$, mount, storage } = __req("util.js");
const { icon, logo } = __req("icons.js");
const { t, getLang, setLang, fmtRelative } = __req("i18n.js");
const { LANGS } = __req("data.js");
const store = __req("store.js");
const { actions, registerActions, toast, initDialog, avatar } = __req("ui.js");

const home = __req("views/home.js").default;
const explore = __req("views/explore.js").default;
const { exploreActions } = __req("views/explore.js");
const listing = __req("views/listing.js").default;
const { listingActions } = __req("views/listing.js");
const publish = __req("views/publish.js").default;
const { publishActions } = __req("views/publish.js");
const messages = __req("views/messages.js").default;
const { messagesActions } = __req("views/messages.js");
const planning = __req("views/planning.js").default;
const { planningActions } = __req("views/planning.js");
const auth = __req("views/auth.js").default;
const { authActions } = __req("views/auth.js");
const account = __req("views/account.js").default;
const { accountActions } = __req("views/account.js");
const profile = __req("views/profile.js").default;
const admin = __req("views/admin.js").default;
const { adminActions } = __req("views/admin.js");
const pages = __req("views/pages.js").default;

/* ------------------------------ Routes ------------------------------ */
const notFound = {
  title: () => t("notFound.title"),
  render: () => html`<section class="section"><div class="container narrow center">
    <p class="big-404">404</p><h1 class="h2">${t("notFound.title")}</h1><p class="muted">${t("notFound.text")}</p>
    <a class="btn btn-primary" href="#/">${t("notFound.home")}</a></div></section>`,
};

const ROUTES = [
  [/^$/, home],
  [/^explorer$/, explore],
  [/^annonce\/([\w-]{1,40})$/, listing],
  [/^publier$/, publish],
  [/^messages(?:\/([\w-]{1,40}))?$/, messages],
  [/^planning$/, planning],
  [/^connexion$/, auth],
  [/^compte$/, account],
  [/^membre\/([\w-]{1,40})$/, profile],
  [/^admin$/, admin],
  [/^page\/([\w-]{1,40})$/, pages],
];

let currentView = null;
let currentCtx = null;

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [path, qs = ""] = hash.split("?");
  return { path: decodeURIComponent(path).replace(/\/$/, ""), query: new URLSearchParams(qs) };
}

function render({ keepScroll = false } = {}) {
  const { path, query } = parseHash();
  let view = notFound;
  let params = [];
  for (const [re, v] of ROUTES) {
    const m = re.exec(path);
    if (m) { view = v; params = m.slice(1); break; }
  }
  const sameView = view === currentView && currentCtx?.path === path;
  if (currentView?.unmount) { try { currentView.unmount(); } catch (e) { console.error(e); } }
  currentView = view;
  currentCtx = { path, params, query };

  const root = $("#view");
  const y = window.scrollY;
  try {
    mount(root, view.render(currentCtx));
    view.mount?.(root, currentCtx);
  } catch (e) {
    console.error(e);
    mount(root, html`<section class="section"><div class="container narrow center"><h1 class="h2">${t("err.pageTitle")}</h1><p class="muted">${t("err.pageText")}</p><a class="btn btn-primary" href="#/">${t("notFound.home")}</a></div></section>`);
  }
  document.title = `${view.title ? view.title(currentCtx) + " · " : ""}Voisina`;
  if (keepScroll || sameView) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
  if (!keepScroll && !sameView) $("#main").focus({ preventScroll: true });
  renderChrome();
}

/* ----------------------- En-tête et navigation ---------------------- */
const NAV = [
  ["explorer", "search", "nav.explore"],
  ["planning", "calendar", "nav.planning"],
  ["messages", "message", "nav.messages"],
  ["page/securite", "shield", "nav.safety"],
];

function isActive(route) {
  const { path } = parseHash();
  return path === route || path.startsWith(route + "/") ? " is-active" : "";
}

function notificationText(n) {
  const key = `notif.${n.kind}`;
  return t(key, n.params || {});
}

function renderHeader() {
  const me = store.currentUser();
  const unread = me ? store.totalUnread() : 0;
  const notifs = store.getNotifications();
  const unreadNotifs = notifs.filter((n) => !n.read).length;
  const theme = document.documentElement.getAttribute("data-theme");
  const dark = theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);

  mount($("#site-header"), html`
  <div class="container header-inner">
    <a class="brand" href="#/" aria-label="${t("nav.home")} — Voisina">${logo()}<span class="brand-name">Voisina</span></a>
    <nav class="main-nav" aria-label="${t("nav.main")}">
      ${NAV.map(([route, ic, key]) => html`<a class="nav-link${isActive(route)}" href="#/${route}" ${isActive(route) ? raw('aria-current="page"') : ""}>${icon(ic)}<span>${t(key)}</span>${route === "messages" && unread ? html`<span class="badge-count">${unread}</span>` : ""}</a>`)}
    </nav>
    <div class="header-actions">
      <a class="btn btn-primary btn-publish" href="#/publier">${icon("plus")}<span>${t("nav.publish")}</span></a>
      <div class="menu-wrap">
        <button type="button" class="icon-btn lang-btn" data-action="toggle-menu" data-menu="lang" aria-haspopup="true" aria-expanded="false" aria-label="${t("nav.language")}">${icon("globe")}<span>${getLang().toUpperCase()}</span></button>
        <div class="menu" id="menu-lang" hidden>
          ${LANGS.map((l) => html`<button type="button" class="menu-item${l === getLang() ? " is-active" : ""}" data-action="set-lang" data-lang="${l}" lang="${l}">${t("lang." + l)}${l === getLang() ? icon("check") : ""}</button>`)}
        </div>
      </div>
      <button type="button" class="icon-btn theme-btn" data-action="toggle-theme" aria-label="${dark ? t("theme.toLight") : t("theme.toDark")}" title="${dark ? t("theme.toLight") : t("theme.toDark")}">${icon(dark ? "sun" : "moon")}</button>
      ${me
        ? html`
        <div class="menu-wrap">
          <button type="button" class="icon-btn" data-action="toggle-menu" data-menu="notif" aria-haspopup="true" aria-expanded="false" aria-label="${t("notif.title")}${unreadNotifs ? ` (${unreadNotifs})` : ""}">${icon("bell")}${unreadNotifs ? html`<span class="dot-count">${unreadNotifs}</span>` : ""}</button>
          <div class="menu menu-wide" id="menu-notif" hidden>
            <div class="menu-head"><strong>${t("notif.title")}</strong>${unreadNotifs ? html`<button type="button" class="link-btn" data-action="notif-read">${t("notif.markRead")}</button>` : ""}</div>
            ${notifs.length ? notifs.slice(0, 8).map((n) => html`<a class="notif-item${n.read ? "" : " is-unread"}" href="${/^#\/[\w\-/?=&%.]*$/.test(n.link) ? n.link : "#/"}">
              <span class="notif-icon">${icon(n.kind === "message" ? "message" : n.kind === "published" ? "checkCircle" : n.kind === "reportDone" ? "shieldCheck" : "sparkles")}</span>
              <span><span class="notif-text">${notificationText(n)}</span><span class="notif-time">${fmtRelative(n.at)}</span></span></a>`) : html`<p class="menu-empty">${t("notif.empty")}</p>`}
          </div>
        </div>
        <div class="menu-wrap">
          <button type="button" class="avatar-btn" data-action="toggle-menu" data-menu="account" aria-haspopup="true" aria-expanded="false" aria-label="${t("nav.account")}">${avatar(store.getPerson(me.id), "sm")}</button>
          <div class="menu" id="menu-account" hidden>
            <div class="menu-head menu-user"><strong>${me.firstname} ${me.lastname}</strong><span class="muted small">${me.email}</span></div>
            <a class="menu-item" href="#/compte">${icon("user")}${t("nav.account")}</a>
            <a class="menu-item" href="#/compte?tab=listings">${icon("file")}${t("account.myListings")}</a>
            <a class="menu-item" href="#/planning">${icon("heart")}${t("nav.planning")}</a>
            ${me.role === "admin" ? html`<a class="menu-item" href="#/admin">${icon("shield")}${t("nav.admin")}</a>` : ""}
            <button type="button" class="menu-item" data-action="logout">${icon("logout")}${t("nav.logout")}</button>
          </div>
        </div>`
        : html`<a class="btn btn-ghost btn-login" href="#/connexion">${icon("user")}<span>${t("nav.login")}</span></a>`}
    </div>
  </div>`);
}

function renderTabbar() {
  const me = store.currentUser();
  const unread = me ? store.totalUnread() : 0;
  const { path } = parseHash();
  const tab = (route, ic, label, extra = "") => {
    const active = route === "" ? path === "" : path === route || path.startsWith(route + "/");
    return html`<a class="tab-link${active ? " is-active" : ""}" href="#/${route}" ${active ? raw('aria-current="page"') : ""}>${icon(ic)}<span>${label}</span>${extra}</a>`;
  };
  mount($("#tabbar"), html`
    ${tab("", "home", t("nav.home"))}
    ${tab("explorer", "search", t("nav.explore"))}
    <a class="tab-publish" href="#/publier" aria-label="${t("nav.publish")}">${icon("plus")}</a>
    ${tab("messages", "message", t("nav.messagesShort"), unread ? html`<span class="badge-count">${unread}</span>` : "")}
    ${tab(me ? "compte" : "connexion", "user", me ? t("nav.profile") : t("nav.login"))}`);
}

function renderFooter() {
  mount($("#site-footer"), html`
  <div class="container footer-grid">
    <div class="footer-brand">
      <a class="brand" href="#/">${logo()}<span class="brand-name">Voisina</span></a>
      <p>${t("footer.tagline")}</p>
      <ul class="footer-badges">
        <li>${icon("eyeOff")}${t("footer.noTracking")}</li>
        <li>${icon("lock")}${t("footer.secure")}</li>
      </ul>
    </div>
    <div><h2 class="footer-title">${t("footer.explore")}</h2><ul>
      <li><a href="#/explorer">${t("footer.listings")}</a></li>
      <li><a href="#/explorer?view=map">${t("footer.map")}</a></li>
      <li><a href="#/publier">${t("nav.publish")}</a></li>
      <li><a href="#/planning">${t("nav.planning")}</a></li>
    </ul></div>
    <div><h2 class="footer-title">${t("footer.community")}</h2><ul>
      <li><a href="#/page/aide">${t("footer.help")}</a></li>
      <li><a href="#/page/securite">${t("footer.safety")}</a></li>
      <li><a href="#/page/regles">${t("footer.rules")}</a></li>
      <li><a href="#/page/a-propos">${t("footer.about")}</a></li>
    </ul></div>
    <div><h2 class="footer-title">${t("footer.legal")}</h2><ul>
      <li><a href="#/page/confidentialite">${t("footer.privacy")}</a></li>
      <li><a href="#/page/conditions">${t("footer.terms")}</a></li>
      <li><a href="#/page/mentions-legales">${t("footer.imprint")}</a></li>
    </ul></div>
  </div>
  <div class="container footer-bottom">
    <span>© 2026 Voisina · ${t("footer.project")}</span>
    <span class="footer-langs">${LANGS.map((l) => html`<button type="button" class="link-btn${l === getLang() ? " is-active" : ""}" data-action="set-lang" data-lang="${l}" lang="${l}">${l.toUpperCase()}</button>`)}</span>
    <span>${t("footer.madeIn")}</span>
  </div>`);
}

function renderBanner() {
  const banner = $("#demo-banner");
  if (store.getPrefs().bannerDismissed) { banner.hidden = true; return; }
  banner.hidden = false;
  mount(banner, html`<div class="container demo-banner-inner">${icon("info")}<p>${t("demo.banner")} <a href="#/page/a-propos">${t("demo.learnMore")}</a></p>
    <button type="button" class="icon-btn icon-btn-sm" data-action="dismiss-banner" aria-label="${t("common.close")}">${icon("x")}</button></div>`);
}

function renderChrome() {
  renderHeader();
  renderTabbar();
}

function renderAll() {
  renderBanner();
  renderFooter();
  render({ keepScroll: true });
}

/* ------------------------------ Menus ------------------------------ */
function closeMenus(except = null) {
  $$(".menu").forEach((m) => {
    if (m.id !== except) {
      m.hidden = true;
      const btn = document.querySelector(`[data-menu="${m.id.replace("menu-", "")}"]`);
      btn?.setAttribute("aria-expanded", "false");
    }
  });
}

/* ------------------------- Actions globales ------------------------ */
function applyTheme(theme) {
  if (theme === "dark" || theme === "light") document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
}

registerActions({
  ...exploreActions, ...listingActions, ...publishActions, ...messagesActions,
  ...planningActions, ...authActions, ...accountActions, ...adminActions,

  "toggle-menu": (el) => {
    const menu = $(`#menu-${el.dataset.menu}`);
    const open = menu.hidden;
    closeMenus(open ? menu.id : null);
    menu.hidden = !open;
    el.setAttribute("aria-expanded", String(open));
    if (open) menu.querySelector("a, button")?.focus();
  },
  "set-lang": (el) => {
    setLang(el.dataset.lang);
    renderAll();
    toast(t("toast.langChanged"), "success");
  },
  "toggle-theme": () => {
    const current = document.documentElement.getAttribute("data-theme");
    const dark = current === "dark" || (!current && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = dark ? "light" : "dark";
    store.setPrefs({ theme: next });
    applyTheme(next);
    renderHeader();
  },
  fav: (el) => {
    const id = el.dataset.id;
    if (!store.getListing(id)) return;
    const added = store.toggleFavorite(id);
    toast(added ? t("fav.added") : t("fav.removed"), "success");
  },
  "notif-read": () => { store.markNotificationsRead(); },
  skip: () => { $("#main").focus(); $("#main").scrollIntoView(); },
  "dismiss-banner": () => { store.setPrefs({ bannerDismissed: true }); renderBanner(); },
  locate: (el) => {
    if (!navigator.geolocation) { toast(t("loc.unsupported"), "error"); return; }
    el.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        el.disabled = false;
        const { latitude: lat, longitude: lng } = pos.coords;
        if (lat < 45.7 || lat > 47.95 || lng < 5.8 || lng > 10.6) { toast(t("loc.outside"), "info"); return; }
        store.setOrigin({ lat, lng, label: t("loc.myPosition") });
        toast(t("loc.found"), "success");
        const target = "#/explorer?radius=10&sort=distance";
        if (location.hash === target) render({ keepScroll: true });
        else location.hash = target;
      },
      () => { el.disabled = false; toast(t("loc.denied"), "error"); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  },
});

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el && actions[el.dataset.action]) {
    if (el.tagName === "A") e.preventDefault();
    actions[el.dataset.action](el, e);
    if (el.dataset.action !== "toggle-menu") closeMenus();
    return;
  }
  if (!e.target.closest(".menu-wrap")) closeMenus();
  // Un clic sur un lien d'un menu le ferme
  if (e.target.closest(".menu a")) closeMenus();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenus();
});

/* --------------------- Réactions aux changements -------------------- */
store.onChange((kind) => {
  renderChrome();
  if (!currentView) return;
  currentView.onData?.(kind, currentCtx);
  if (currentView.refreshOn?.includes(kind)) render({ keepScroll: true });
});

window.addEventListener("hashchange", () => { closeMenus(); render(); });
window.addEventListener("voisina:lang", renderAll);
window.addEventListener("voisina:theme", () => { applyTheme(store.getPrefs().theme); renderHeader(); });
window.addEventListener("voisina:banner", renderBanner);
// Synchronisation entre plusieurs onglets ouverts
window.addEventListener("storage", (e) => { if (e.key?.startsWith("voisina:")) renderAll(); });

/* --------------------------- Démarrage ----------------------------- */
function start() {
  storage.purgeLegacy(); // efface les anciennes données (mots de passe en clair de la v1)
  document.documentElement.lang = getLang();
  initDialog();
  renderBanner();
  renderFooter();
  render();
  document.body.classList.add("is-ready");

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

start();

return {  };
});
__req("app.js");
})();
