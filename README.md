# Voisina 🍃 — L'entraide locale en Suisse

**Voisina** est une plateforme d'entraide entre voisins, pensée pour toute la Suisse :
proposer un coup de main, demander de l'aide ou donner un objet, gratuitement ou contre
une petite rémunération.

> Projet de fin d'année. Site en ligne : https://lennyhrng.github.io/Voisina/

---

## ✨ Fonctionnalités

| Domaine | Ce que le site fait |
|---|---|
| **Recherche** | Recherche plein texte, filtres (type, catégorie, canton, rémunération, urgent, profils vérifiés), tri, pagination, **distance autour de moi** (géolocalisation ou NPA/localité) |
| **Carte** | Fond de carte officiel **swisstopo**, regroupement automatique des annonces, « Rechercher dans cette zone » |
| **Annonces** | Page détaillée avec lien partageable, photos, zone approximative, annonces similaires, **export agenda (.ics)**, partage |
| **Publier** | Formulaire guidé en 7 étapes, **aperçu en direct**, brouillon enregistré automatiquement, jusqu'à 3 photos, modification / clôture / suppression |
| **Messagerie** | Conversations par annonce, indicateur « en train d'écrire », réponses automatiques des membres de démo, alertes anti-arnaque |
| **Planning** | Favoris + calendrier mensuel (récurrences gérées) + export de tous les rendez-vous vers Google Agenda / Apple / Outlook |
| **Compte** | Profil public (photo, présentation, langues, savoir-faire), mes annonces, changement de mot de passe, **export et suppression de mes données (nLPD)** |
| **Confiance** | Signalement (annonce, membre, conversation), blocage, conseils de sécurité, numéros d'urgence suisses |
| **Administration** | Tableau de bord, file de modération des signalements, masquage d'annonces, statistiques par catégorie, réinitialisation de la démo |
| **Langues** | Français, **allemand, italien** et anglais (détection automatique de la langue du navigateur) |
| **Confort** | Mode sombre, version mobile avec barre de navigation, installable comme une application (PWA), fonctionne hors ligne |
| **Légal** | Politique de confidentialité (nLPD), conditions d'utilisation, règles de la communauté, mentions légales, aide/FAQ |

## 🔐 Sécurité (résumé)

- Mots de passe **jamais stockés** : empreinte PBKDF2-SHA256, 600 000 itérations, sel aléatoire.
- Le mot de passe administrateur n'apparaît plus dans le code (seulement son empreinte).
- **Content Security Policy** stricte + échappement automatique de tout contenu → protection XSS.
- Bibliothèque de carte chargée avec une **empreinte SRI** (impossible à modifier par un tiers).
- Anti force brute (blocage après 5 essais), sessions qui expirent, validation de toutes les saisies.
- Photos ré-encodées : les **métadonnées GPS sont supprimées**. Position sur la carte floutée (± 1 km).
- Aucun cookie, aucun traceur, aucune publicité.

➡️ Détails : [`docs/SECURITE.md`](docs/SECURITE.md)

## 🧪 Comptes de démonstration

- Créez librement un compte (il reste dans votre navigateur).
- Compte administrateur : identifiant `admin`, mot de passe `CPNV`.
- Pour tester la messagerie entre deux vrais comptes : créez-en deux dans le même navigateur, publiez une annonce avec l'un et contactez-la avec l'autre.

## 🗂️ Organisation du code

```
index.html                 page unique (Content Security Policy, balises SEO)
assets/css/styles.css      design (thème clair/sombre, responsive)
assets/js/app.js           démarrage, routeur, en-tête, pied de page
assets/js/store.js         TOUTES les données (seul fichier à changer pour un vrai serveur)
assets/js/auth.js          mots de passe, sessions, anti force brute
assets/js/util.js          échappement HTML (anti-XSS), stockage, outils
assets/js/views/*.js       une page = un fichier
assets/js/translations.js  textes FR / DE / IT / EN
docs/                      documentation (sécurité, architecture, suite du projet)
```

Aucune installation ni « build » : ce sont des fichiers HTML/CSS/JavaScript modernes.

## ▶️ Tester en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

---

Fait avec soin en Suisse. Cartes © swisstopo · Leaflet (BSD-2) · Police Fraunces (OFL).
