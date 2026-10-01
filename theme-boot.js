/* Applique les réglages d'affichage (thème, taille du texte, contraste, animations)
   le plus tôt possible, avant l'affichage de la page, pour éviter un "flash".
   Anti-clickjacking : si le site est affiché dans une iframe d'un autre site,
   on s'en échappe (GitHub Pages ne permet pas d'envoyer l'en-tête X-Frame-Options). */
(function () {
  try {
    if (window.top !== window.self) window.top.location = window.self.location.href;
  } catch (e) { /* navigateur qui bloque l'accès : on ignore */ }
  try {
    var root = document.documentElement;
    var prefs = JSON.parse(localStorage.getItem("voisina:v2:prefs") || "{}");
    if (prefs.theme === "dark" || prefs.theme === "light") root.setAttribute("data-theme", prefs.theme);
    if (prefs.textSize === "large" || prefs.textSize === "xlarge") root.setAttribute("data-text", prefs.textSize);
    if (prefs.contrast === "high") root.setAttribute("data-contrast", "high");
    if (prefs.motion === "reduced" || prefs.motion === "full") root.setAttribute("data-motion", prefs.motion);
    if (prefs.lang && /^(fr|de|it|en)$/.test(prefs.lang)) root.lang = prefs.lang;
  } catch (e) { /* stockage indisponible (navigation privée) */ }
})();
