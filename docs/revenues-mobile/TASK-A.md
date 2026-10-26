# Tâche A — présentation de Revenus

Baseline examiné avant modification : `242fb2a3d3aced35dd675192d3dbedd3dabcb13f`, `main`.

## Inventaire avant modification

| Élément | Condition, valeur et action existantes |
| --- | --- |
| Titre et total | `filteredRevenues.length`, `revenueSectionTotal`, `getDisplayValue(..., "money")` ; sinon invitation au premier revenu |
| Replier l'historique | `dashboardSections.revenues`, `toggleDashboardSection("revenues")`, mêmes libellés Voir tout/Réduire |
| Filtre de mois | `selectedMonth`, `monthOptions` issus de `monthlyHistory`, `setSelectedMonth` ; aucune entrée si le mois filtré est vide |
| Liste | `filteredRevenues.map`, mêmes clés et ordre, montant `Number(...).toLocaleString`, `formatRevenueDate`, catégorie, client, facture et note conditionnels |
| Supprimer | `handleDeleteRevenue(item.id)` ; aucun changement de gestionnaire ou de données |
| Ajouter | `handleOpenRevenuePopup`, présent dans l'état vide ; même gestionnaire repris dans l'en-tête |
| CSV | `handleExportCSV`, titre « Exporter les revenus affichés » ; disabled si liste filtrée vide, export en cours ou limite atteinte ; garde interne `canExportCsv` conservée ; nom et contenu dépendent du mois sélectionné |
| PDF | `handleExportPDFWithLimit`, disabled si liste totale vide, export en cours ou limite atteinte ; même rapport, mêmes données et nom ; comptage d'usage existant conservé |
| Informations d'accès | `exportHelperText`, `premiumExportBadge`, mêmes sélecteurs de plan/test/QA et mêmes conditions d'affichage |
| Historique mensuel et graphique | `monthlyHistory.length > 0`, `dashboardSections.chart`, `showChart`, `revenueChartData`, `maxRevenueValue`, `hideChart`, mêmes valeurs, ordre et actions |
| Retour utilisateur | `renderBetaMicroFeedbackCard("revenues")`, mêmes conditions et callbacks |

Le chargement des revenus connectés repose sur `refreshRevenues` et l'ordre serveur `revenue_date` décroissant. Cette section ne possède actuellement ni pagination ni contrôle de tri supplémentaire, ni indicateur local explicite de chargement/erreur : pendant une lecture en attente ou une erreur de lecture, la liste reste dans son état existant. Les diagnostics et états globaux d'authentification/profil restent hors modification. Aucun nouveau comportement n'est inventé pour ce LOT.

Les limites d'export restent exactement celles du code, notamment la différence de source entre disabled CSV (liste filtrée) et PDF (liste totale). Les tests simulent les profils et les usages ; ils ne modifient pas le contrat d'accès. Le traitement Unicode existant du rapport PDF Revenus est également conservé : comparer les sorties ne signifie pas le certifier ou corriger son générateur.

## Organisation prévue

En-tête : titre, résumé, Ajouter un revenu, Voir tout/Réduire et filtre de mois. Puis liste/état vide/replié, zone compacte d'exports avec informations d'accès visibles, détails des explications secondaires, historique mensuel inchangé, et retour utilisateur. Les informations nécessaires à l'export et les résultats/erreurs globaux ne sont pas placés dans les détails.

Styles limités à `#revenues-section`, reprenant la palette et les contrastes du cockpit. Aucun changement du rendu Factures, de Mon accès ou du cockpit dans cette tâche ; tout défaut mobile éventuel de ces zones sera établi et traité séparément en tâche B.

## Validation ciblée avant le premier commit

Neuf tests navigateur du candidat passent : huit états (invité vide/rempli, gratuit, Premium, quota atteint, provisoire, lecture en attente et erreur), plus ajout synthétique et lien vers une facture. Les huit snapshots initiaux/filtrés et les exports sont identiques au baseline. Le CSV est comparé sur son contenu complet ; le PDF sur ses octets après exclusion uniquement de `/ID` et `/CreationDate`, métadonnées générées par jsPDF. Les empreintes brutes et fichiers restent disponibles pour revue. Les largeurs sont 320, 390, 768 et 1440 px.

Les HTTP et WebSockets Realtime sont simulés. Deux ajustements du dispositif de test ont été nécessaires : intercepter explicitement les WebSockets et ne pas attendre la fin d'une lecture volontairement suspendue. Aucun code produit n'a été modifié pour satisfaire ces cas. Les six premiers cas de baseline et les trois reprises ciblées passent.

Unités exécutées dans les archives suivies du baseline et du candidat : 1 795/1 797, mêmes échecs historiques `reminder-retry-wiring.test.js:75` et `reminder-scheduler-heartbeat-wiring.test.js:38`. La vérification finale du build, du lint comparé et des régressions concernées aura lieu après l'audit mobile afin de ne pas les répéter sans motif.
