# Sécurité de Voisina

Ce document explique les failles de la première version, ce qui a été corrigé, et les limites
honnêtes d'un site sans serveur. Utile pour la présentation orale.

## 1. Problèmes de la version 1

| Problème | Risque | Correction |
|---|---|---|
| Mots de passe enregistrés **en clair** dans `localStorage` | Toute personne ayant accès au navigateur (ou un script malveillant) lit les mots de passe | Empreinte **PBKDF2-SHA256** (600 000 itérations, sel unique de 16 octets). Les anciennes données `vc_*` sont effacées automatiquement au premier chargement |
| Mot de passe admin `CPNV` **écrit dans le code source** | N'importe qui pouvait le lire (clic droit → code source) | Seule l'empreinte du mot de passe est dans le code |
| La « session » contenait tout le compte, mot de passe compris | Fuite du mot de passe | La session ne contient plus qu'un identifiant et une date d'expiration (14 jours) |
| `onclick="...('${id}')"` avec des données insérées sans échappement | Injection de code (XSS) | Plus aucun `onclick` : délégation d'événements `data-action`. Tout le HTML passe par la fonction `html` qui échappe automatiquement |
| Aucune Content Security Policy | Un script injecté pouvait s'exécuter | CSP stricte : scripts uniquement depuis le site et la version figée de Leaflet, aucun script « inline » |
| Scripts externes sans vérification | Si unpkg.com était piraté, le site l'était aussi | Attribut **SRI** (`integrity`) : le navigateur refuse un fichier modifié |
| Textes des annonces envoyés automatiquement à un service de traduction italien | Transfert de données personnelles sans consentement (nLPD) | Traduction uniquement sur clic de l'utilisateur (lien DeepL) |
| Si la carte ne chargeait pas, **tout le site plantait** | Site inutilisable | La carte est optionnelle ; un message s'affiche et le reste fonctionne |
| Photos de profil acceptées telles quelles | Fichiers piégés, métadonnées GPS de la photo révélant le domicile | Vérification du format réel (octets magiques), redimensionnement et ré-encodage → **suppression des métadonnées EXIF/GPS** |

## 2. Mesures en place

- **XSS** : échappement systématique (`assets/js/util.js`) + CSP + attributs `data-*` au lieu de `onclick`.
- **Validation serveur-style** : `store.js` revalide chaque donnée (longueurs, listes de valeurs autorisées, dates, montants, coordonnées dans les limites de la Suisse), même si le formulaire l'a déjà fait.
- **Force brute** : après 5 essais ratés, blocage de 30 s, puis durée doublée à chaque échec (max 15 min).
- **Énumération de comptes** : le message d'erreur est identique et le temps de calcul aussi, que l'e-mail existe ou non.
- **Redirections** : le paramètre `next` n'accepte que des adresses internes (`#/...`).
- **Clickjacking** : le site refuse de s'afficher dans une iframe d'un autre site.
- **Vie privée** : nom public = prénom + initiale, adresse jamais demandée, position floutée (± 1 km), zoom de carte limité, aucune donnée envoyée à un tiers sans action de l'utilisateur, aucun cookie.
- **Anti-arnaque** : détection des numéros de téléphone, e-mails, IBAN et mots-clés d'arnaque (codes SMS, cartes cadeaux…) avec avertissement.
- **Mots de passe** : 10 caractères minimum, 3 types de caractères (ou phrase de passe de 16+ caractères), refus des mots de passe courants ou contenant le nom.

## 3. Limites (à dire honnêtement au jury)

Le site est hébergé sur **GitHub Pages**, qui ne sert que des fichiers : **il n'y a pas de serveur**.
Tout se passe donc dans le navigateur de chaque visiteur :

- les comptes et annonces créés ne sont visibles que sur l'appareil où ils ont été créés ;
- une personne experte peut modifier les données de **son propre** navigateur (par ex. se donner le rôle admin). Elle ne peut toucher à rien chez les autres.

Pour un vrai lancement, il faut un serveur : voir `SUITE-DU-PROJET.md`.

## 4. Tester soi-même

- Publier une annonce avec le titre `<img src=x onerror=alert(1)>` → le texte s'affiche tel quel, rien ne s'exécute.
- Ouvrir les outils de développement → Application → Local Storage : aucun mot de passe lisible.
- Se tromper 5 fois de mot de passe → blocage temporaire.
