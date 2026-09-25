# Voisina v2.6 — Finitions téléphone

Testé automatiquement sur 320, 360, 390, 768, 1024 et 1440 px,
en français, allemand, italien et anglais, en visiteur et en compte d'essai.

## Corrigé
- Fiche annonce sur petit téléphone : les cases Date / Horaire / Rémunération dépassaient
  de l'écran et la barre « Contacter » disparaissait. Corrigé.
- Planning : le bouton « mois suivant » du calendrier sortait de l'écran. Corrigé.
- Accueil : la carte « Bienvenue » est plus compacte sur téléphone et ne cache plus la recherche.
- Recherche de l'accueil : bouton loupe sur téléphone, le champ a plus de place.
- Bandeau de démo : une seule ligne courte sur téléphone.
- « Les dernières annonces » : plus d'annonces en double.
- Typographie française : espace insécable avant ? ! : ; (plus de « ? » seul en début de ligne).
- Titres équilibrés sur plusieurs lignes (plus de mot orphelin).
- Pages « Connectez-vous » : boutons de même largeur, empilés proprement.
- Pagination et barre d'onglets lisibles jusqu'à 320 px.
- Pied de page plus court sur téléphone (la barre d'onglets remplace les liens « Explorer »).
- Menus des pages d'aide et du compte : l'onglet actif est toujours visible.

## Fichiers modifiés
index.html, styles.css (bloc « v2.6 » à la fin), voisina.js, sw.js
