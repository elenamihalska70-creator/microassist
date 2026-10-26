# Premier écran du cockpit — contrat de présentation

Baseline : `8b3f7dc06367ce96e11daf86831a159b13a98ec2`. LOT local, sans push ni déploiement.

## Composition et données préservées

`CockpitOverview` est une surface de présentation : en-tête, priorité, trois repères, deux actions rapides et résumé du profil fiscal. Le composant ne calcule ni montant, ni échéance, ni éligibilité ; il ne lit pas de stockage et ne contacte aucun service.

- Si le contexte rendait la priorité administrative canonique, le même `PriorityCard` reçoit le même `priorityCardViewModel`, issu de `dashboardPrioritizedActions[0]`, et les mêmes callbacks. Sinon, la même `dashboardPrimaryAction` fournit titre, explication et callback. Aucun nouvel ordre de priorité n'est introduit. Les accès secondaires de la priorité (confirmation et détail) restent disponibles.
- Le titre du `PriorityCard` accepte un niveau de titre de présentation (`h4` ici, `h2` par défaut ailleurs) pour respecter la hiérarchie de la nouvelle zone. Aucun état ou handler du composant n'est modifié.
- Revenus/CA, réserve et disponible réutilisent `dashboardRevenueDisplay`, `dashboardChargesDisplay` et `dashboardAvailableDisplay`, sous les mêmes gardes de calcul effectif. Les libellés d'absence de calcul sont remplacés par `—` ; les zéros calculés et le suffixe provisoire sont conservés. Une explication commune distingue données enregistrées, provisoires, chargement et erreur.
- Les champs manquants utilisent les indicateurs déjà présents : activité, fréquence, début d'activité, choix ACRE et début ACRE lorsqu'il est requis. Les champs vendeur de facture (SIRET, identité/adresse vendeur) restent dans leur parcours dédié. Le résumé générique est suspendu quand le profil du compte n'est pas chargé ; les messages et modales de chargement, erreur et conflit existants sont préservés.
- Les deux raccourcis appellent exactement `handleOpenRevenuePopup` et `handleOpenInvoiceGenerator`. Ils sont visuellement secondaires lorsqu'une recommandation possède déjà son CTA principal.
- La bannière invitée de stockage est regroupée dans l'en-tête. « Créer mon compte » conserve la condition `!isPremiumUser && isGuest` et `openAuthModal("signup")`. Le premier bras de l'ancien ternaire reste `null` pour ne pas exposer aux invités une autre variante d'offre par effet de bord. Les autres conditions d'offre sont inchangées.
- Les statistiques détaillées, navigation interne, ancres, alertes, déclaration, revenus, factures, rappels, analyses et accès restants sont conservés. L'ancien rappel générique du profil et l'ancien affichage de la priorité de repli sont retirés puisqu'ils sont rendus dans la nouvelle zone.

L'absence de confirmation d'une déclaration n'est jamais présentée comme une preuve de non-déclaration. Le garde existant de confirmation (`user.id` et période disponibles) reste inchangé : son clic est sans effet pour un invité. Ce LOT ne modifie pas ce comportement métier.

## Styles limités à la zone

La feuille `CockpitOverview.css` cible uniquement les classes du nouveau composant et ses descendants, plus sa position comme enfant direct du dashboard. Elle ne redéfinit pas les classes globales `.btn` ou `.card`. L'ordre des enfants de cette zone est identique dans le DOM et à l'écran ; les règles historiques de classement des sections détaillées ne sont pas remaniées.

Référence consultée en navigateur en lecture seule : https://microassist.digitallab.studio/ (HTTP 200). Fond observé `#F7F4EE`, titres Georgia/Times, texte `#17120D`, actions secondaires vert `#065640`, cadres fins et rayon de bouton 7 px. La police propriétaire du site vitrine n'est pas copiée ; formulaires, données et détails restent en sans-serif système.

Le CTA principal utilise l'orange `#A95000`, plus sombre pour rendre le texte blanc lisible : contraste 5,48:1. Vert `#065640` sur blanc cassé : 8,56:1. Texte secondaire `#46564C` sur crème : 7,10:1. Les tests vérifient aussi le contraste réellement calculé des boutons de la zone, le focus clavier visible et `prefers-reduced-motion`.

Le correctif de barre globale du baseline est préservé : flux normal, masquage natif `hidden` piloté par les états de modales. Aucune règle de cette barre n'est modifiée ici.

## Validation reproductible

`tests/cockpit-overview.spec.js` emploie huit fixtures synthétiques : invité vide, invité avec facture, profil connecté incomplet, complet avec 1 200 € de revenus, zéro calculé, CA provisoire, chargement et erreur. Les services externes sont interceptés. Les captures sont prises à 1440, 390 et 320 px ; les tests candidat contrôlent débordement, ordre DOM/visuel, handlers, garde invité, focus, contraste et absence d'INSERT facture.

Pour la comparaison avant/après dans deux extractions isolées du dépôt :

1. Définir `COCKPIT_REVIEW_DIR` vers un répertoire temporaire commun et exécuter le test sur le baseline avec `COCKPIT_BASELINE=1`.
2. Exécuter le même test sur le candidat avec `COCKPIT_BASELINE=0` et le même répertoire. Les trois valeurs numériques et le texte complet de la priorité doivent être identiques ; seuls les placeholders sans chiffre deviennent `—`.
3. Les commandes utilisent une configuration Supabase synthétique, sans secret réel, correspondant à la clé de session des fixtures. Un port local 5177 peut remplacer 5174 pour isoler les serveurs.

Sans `COCKPIT_REVIEW_DIR`, le test reste autonome : il vérifie les fixtures et interactions sans dépendre de captures ou de fichiers générés par une ancienne exécution.

Les résultats finaux, captures, diff et manifeste SHA-256 sont joints au paquet de revue. Les deux échecs Node historiques (`reminder-retry-wiring.test.js:75` et `reminder-scheduler-heartbeat-wiring.test.js:38`) doivent rester distingués des régressions de ce LOT.

Les valeurs de référence comparées sont notamment : 1 200 € / 264 € / 936 € avec revenus ; 0 € / 0 € / 0 € pour un zéro calculé ; 1 800 € estimés / 396 € / 1 404 € pour le provisoire. Le texte complet de la priorité canonique est comparé, pas seulement son titre.

Les tests de régression couvrent aussi factures locales/distantes, paiement et provenance, export/restauration JSON, refus d'import incompatible, lectures ou préparations asynchrones invalidées, téléchargements PDF/XML et profils/conflits. Le fichier historique de test d'ordre conserve ses assertions de priorité et de gating ; seule l'attente de la bannière invitée est adaptée à son regroupement dans l'en-tête, avec une assertion sur la condition et le callback du CTA déplacé.
