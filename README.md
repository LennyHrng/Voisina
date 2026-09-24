# Voisina 🍃 — L'entraide locale en Suisse

**Voisina** est une plateforme d'entraide entre voisins, pensée pour toute la Suisse :
proposer un coup de main, demander de l'aide ou donner un objet, gratuitement ou contre
une petite rémunération.

> Projet TPA / PAE réalisé seul par Lenny Harnischberg au CPNV (Centre professionnel du Nord vaudois). Site en ligne : https://lennyhrng.github.io/Voisina/

---

## ✨ Fonctionnalités

| Domaine | Ce que le site fait |
|---|---|
| **Découvrir** | Les annonces **une par une en plein écran**, on glisse vers le haut comme sur les Reels / TikTok ; boutons J'aime, Contacter, Partager à portée de pouce ; onglets Tout / Je propose / Je cherche / Je donne |
| **Essai en 1 clic** | Un **compte d'essai** sans e-mail ni mot de passe pour tester tout de suite (idéal pour les tests dans la rue) ; « Terminer l'essai » efface tout, prêt pour la personne suivante |
| **Recherche** | Recherche plein texte, filtres (type, catégorie, canton, rémunération, urgent, profils vérifiés), tri, pagination, **distance autour de moi** (géolocalisation ou NPA/localité) |
| **Carte** | **4 styles au choix** : carte nationale **swisstopo en couleur** (par défaut), **plan des rues** (OpenStreetMap), **satellite** (SWISSIMAGE) et gris ; bouton « me localiser » (point bleu), regroupement des annonces, « Rechercher dans cette zone », choix mémorisé |
| **Annonces** | Page détaillée avec lien partageable, photos, zone approximative, annonces similaires, **export agenda (.ics)**, partage |
| **Publier** | Formulaire guidé en 8 étapes, **aperçu en direct**, brouillon enregistré automatiquement, **image facultative** : jusqu'à 3 photos (glisser-déposer, choix de la couverture) ou une illustration colorée au choix (6 couleurs × 5 motifs), modification / clôture / suppression |
| **Alertes** | Enregistrer une recherche (« Créer une alerte ») et recevoir une notification dès qu'une nouvelle annonce correspond |
| **Messagerie** | Conversations par annonce, **réponses rapides**, indicateur « en train d'écrire », réponses automatiques des membres de démo, alertes anti-arnaque |
| **Planning** | Favoris + calendrier mensuel (récurrences gérées) + export de tous les rendez-vous vers Google Agenda / Apple / Outlook |
| **Compte** | Profil public (photo, présentation, langues, savoir-faire) avec **jauge de profil complété**, mes annonces, mes alertes, changement de mot de passe, **export et suppression de mes données (nLPD)** |
| **Confiance** | Signalement (annonce, membre, conversation), blocage, conseils de sécurité, numéros d'urgence suisses |
| **Administration** | Tableau de bord, file de modération des signalements, masquage d'annonces, statistiques par catégorie, réinitialisation de la démo |
| **Langues** | Français, **allemand, italien** et anglais (détection automatique de la langue du navigateur) |
| **Accueil** | Carte de la Suisse animée, catégories colorées, **villes populaires**, vraie carte interactive des annonces, étapes « comment ça marche », FAQ, carte de bienvenue à la première visite |
| **Annonces d'exemple** | 100 annonces fictives variées (au lieu de centaines de copies), présentes dans les 26 cantons et autour d'Yverdon-les-Bains, clairement signalées « Exemple » |
| **Téléphone** | Conçu **d'abord pour le téléphone** : accueil court avec une rangée de « bulles » (comme les stories), rangées d'annonces qu'on fait glisser, liste compacte avec petite image, peu de texte à la fois. Pensé comme une **vraie application** : barre d'onglets, filtres dans une feuille qui monte du bas, bouton flottant « Carte », photos à faire glisser au doigt (et à agrandir), barre « Contacter » toujours visible sur une annonce, messagerie plein écran, bouton retour, cartes qui ne bloquent pas le défilement, **installation sur l'écran d'accueil** (Android et iPhone, avec mode d'emploi), prise en charge des encoches |
| **Confort** | Mode sombre, **texte plus grand** (pratique pour les aînés), annonces **vues récemment**, partage WhatsApp / e-mail, **QR code du site à montrer à l'écran**, fonctionne hors ligne (avec message « hors ligne ») |
| **Légal** | Politique de confidentialité (nLPD), conditions d'utilisation, règles de la communauté, mentions légales, aide/FAQ |

## 🔐 Sécurité (résumé)

- Mots de passe **jamais stockés** : empreinte PBKDF2-SHA256, 600 000 itérations, sel aléatoire.
- Le mot de passe administrateur n'apparaît plus dans le code (seulement son empreinte).
- **Content Security Policy** stricte + échappement automatique de tout contenu → protection XSS.
- Bibliothèque de carte chargée avec une **empreinte SRI** (impossible à modifier par un tiers).
- Anti force brute (blocage après 5 essais), sessions qui expirent, validation de toutes les saisies.
- Photos ré-encodées : les **métadonnées GPS sont supprimées**. Position sur la carte floutée (± 1 km).
- Aucun cookie, aucun traceur, aucune publicité.

➡️ Détails : [`SECURITE.md`](SECURITE.md)

## 🧪 Comptes de démonstration

- Créez librement un compte (il reste dans votre navigateur).
- Compte administrateur : identifiant `admin`, mot de passe `CPNV`.
- Pour tester la messagerie entre deux vrais comptes : créez-en deux dans le même navigateur, publiez une annonce avec l'un et contactez-la avec l'autre.

## 🗂️ Organisation des fichiers

Tous les fichiers sont à la racine (pratique pour les envoyer sur GitHub) :

```
index.html        la page (Content Security Policy, balises SEO)
styles.css        le design (couleurs, thème clair/sombre, version mobile)
voisina.js        tout le code JavaScript (routeur, pages, sécurité, traductions FR/DE/IT/EN)
theme-boot.js     applique le thème et la taille du texte avant l'affichage
sw.js             permet d'installer le site comme une application
SECURITE.md       explications sur la sécurité
```

## ▶️ Tester en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

---

> **Pourquoi pas Google Maps ?** Il faut une clé d'accès liée à une carte bancaire, et chaque visite enverrait des données
> des visiteurs à Google — contraire à la promesse « sans traceur » du site. La carte officielle de la Confédération
> (swisstopo) est gratuite, précise et hébergée en Suisse ; OpenStreetMap fournit le plan des rues.

Fait avec soin en Suisse. Cartes © swisstopo · © contributeurs OpenStreetMap · Leaflet (BSD-2) · Police Fraunces (OFL).
