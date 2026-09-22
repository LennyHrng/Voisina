# Et après ? Passer du prototype à un vrai service

Voisina fonctionne aujourd'hui entièrement dans le navigateur. Pour que des milliers de personnes
l'utilisent réellement en Suisse, voici les étapes recommandées.

## 1. Un serveur (le plus important)

Objectif : que les annonces et les messages soient partagés entre tous les appareils.

- Option simple : **Supabase** (base PostgreSQL + comptes + stockage de photos), région **Zurich / Francfort**.
- Seul le fichier `assets/js/store.js` doit être réécrit : toutes les pages passent déjà par lui.
- Règles d'accès côté serveur (Row Level Security) : chacun ne peut modifier que ses propres annonces ; seuls les admins voient les signalements.
- Vérification de l'adresse e-mail, réinitialisation du mot de passe, double authentification (option).

## 2. Confiance

- Vérification du numéro de téléphone (SMS) pour obtenir le badge « vérifié ».
- Évaluations après chaque entraide terminée (uniquement entre personnes ayant échangé).
- Modération : file de signalements partagée, historique, suspension de comptes.

## 3. Juridique (Suisse)

- Nom de domaine `.ch` et mentions légales avec une personne ou une association responsable.
- Politique de confidentialité mise à jour (hébergeur, sous-traitants), registre des traitements (nLPD).
- Rappel des obligations pour les services rémunérés (AVS pour le travail domestique, impôts).

## 4. Croissance

- Partenariats avec des communes, associations de quartier, Pro Senectute, Croix-Rouge.
- Notifications par e-mail / push (nouvelles annonces près de chez moi).
- Groupes de quartier et événements.
- Référencement : pages d'annonces indexables par Google (rendu côté serveur).
