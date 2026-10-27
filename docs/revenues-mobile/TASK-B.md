# Tâche B — audit mobile ciblé

État avant correction : tâche A, commit `27f0cf56da2b25edc04b30242030cb11330a30f9`. Huit contextes : invité vide et compte Premium simulé rempli avec noms longs/Unicode, chacun à 320, 390, 768 et 1440 px.

## Défaut établi et correction

| Zone | Preuve avant | Correction ciblée | Preuve attendue après |
| --- | --- | --- | --- |
| Formulaire Revenu | Durée de transition du bouton Enregistrer non nulle sous `prefers-reduced-motion: reduce`, aux quatre largeurs et dans les deux contextes | Annuler les transitions/animations/transforms des `.btn` sous cette préférence, seulement dans le dialogue identifié par `aria-labelledby="add-revenue-title"` | Durée `0s`, clics de fermeture, défilement et accès au bouton conservés |
| Formulaire Facture | Même défaut pour Créer et télécharger PDF + XML | Même règle, ciblée par la nouvelle classe statique `invoiceGeneratorModal` | Durée `0s`, contrôles et données conservés |
| Barre globale | Même défaut lorsque la barre est visible, à 320/390 px | Même règle, sous `.dashboardMobileActionBar` | Durée `0s`, masquage dans les modales et rétablissement selon les conditions conservés |
| En-tête Revenus | À 320/390 px, ordre visuel Ajouter/filtre/Réduire (`[0,2,1]`) différent du DOM et de la tabulation Ajouter/Réduire/filtre (`[0,1,2]`) ; cohérent à 768/1440 px | Annuler seulement l'`order:3` hérité du bouton utilitaire de cet en-tête, sous 520 px | Ordre visuel, DOM et tabulation `[0,1,2]` aux quatre largeurs |

Les traces `before-*.json` enregistrent le défaut calculé, et les captures correspondantes montrent le rendu avant correction. Les traces/captures `after-*` sont faites avec les mêmes fixtures. La preuve d'une préférence de mouvement est la propriété calculée, pas une différence décorative entre images statiques. Le mouvement normal et la réponse visuelle existante restent inchangés lorsque cette préférence n'est pas activée.

## Zones laissées intactes

Aucun débordement, chevauchement, texte tronqué ou focus invisible n'a été établi dans CockpitOverview, Mon accès/navigation, Revenus et Factures avec les fixtures de l'audit. CockpitOverview, Mon accès et Factures restent intacts. Hormis l'ordre du bouton utilitaire de Revenus, leurs composants et feuilles existantes ne sont pas modifiés par la tâche B. Aucun changement de gabarit général, couleur ou espacement n'est ajouté pour produire artificiellement un second commit.

Les formulaires sont parcourus avec noms longs, ouverts/fermés par clics réels, et leurs boutons de validation sont amenés dans la zone visible et accessibles au clavier. Aucune soumission n'est faite par l'audit B ; l'ajout effectif a été vérifié en A. Les données métier sont comparées avant/après navigation, annulation et reload ; les métadonnées techniques de conversation/horodatage ne sont pas confondues avec les données métier.

Les HTTP et WebSockets sont interceptés. Le compte connecté simulé peut déclencher les anciens appels de démarrage fiscal/rappels à partir de sa fixture locale : ils sont consignés et entièrement simulés, sans écriture réelle. L'audit vérifie qu'aucune écriture de revenu ou facture ne provient des parcours de fermeture. Aucun appel métier, droit d'accès, calcul, stockage ou protection asynchrone du produit n'est modifié.

## Résultats exécutés

La série regroupée a passé 34/34 tests (Revenus, audit mobile, barre globale, copie des factures et PDF/XML). L'inspection visuelle a ensuite établi l'écart d'ordre de l'en-tête Revenus ; quatre mesures sur l'archive A montrent `[0,2,1]` à 320/390 px, et `[0,1,2]` à 768/1440 px. Après l'unique propriété CSS ajoutée, les douze contrôles B passent : huit contextes complets et quatre vérifications d'ordre/tabulation. Les captures après sont rafraîchies sur cette dernière version.

Build et lint finaux ont été exécutés après cette dernière correction. Les unités finales restent à 1 795/1 797 (les deux mêmes échecs historiques), sans modification des fonctions depuis leur exécution. Les limites sont Chromium et services simulés ; aucun résultat de production n'est revendiqué.
