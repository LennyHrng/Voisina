/* Applique le thème choisi (clair / sombre) le plus tôt possible,
   avant l'affichage de la page, pour éviter un "flash" de couleur.
   Anti-clickjacking : si le site est affiché dans une iframe d'un autre site,
   on s'en échappe (GitHub Pages ne permet pas d'envoyer l'en-tête X-Frame-Options). */
(function () {
  try {
    if (window.top !== window.self) window.top.location = window.self.location.href;
  } catch (e) { /* navigateur qui bloque l'accès : on ignore */ }
  try {
    var prefs = JSON.parse(localStorage.getItem("voisina:v2:prefs") || "{}");
    if (prefs.theme === "dark" || prefs.theme === "light") {
      document.documentElement.setAttribute("data-theme", prefs.theme);
    }
    if (prefs.textSize === "large") document.documentElement.classList.add("text-lg");
    if (prefs.lang && /^(fr|de|it|en)$/.test(prefs.lang)) {
      document.documentElement.lang = prefs.lang;
    }
  } catch (e) { /* stockage indisponible (navigation privée) */ }
})();
