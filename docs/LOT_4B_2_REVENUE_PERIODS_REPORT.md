# LOT 4B.2 - Revenue Periods & Breakdowns Report

Date : 2026-07-30\
Branche : `refactor/saas-shell-v2`\
Statut d'entree : GO POUR LOT 4B.2\
Reference principale : `docs/LOT_4A_5_CALCULATION_LAYER_ARCHITECTURE.md`

## 1. Resume executif

LOT 4B.2 etend le domaine pur Revenue Calculations avec des aggregations temporelles et des breakdowns par categorie.

Le lot ajoute uniquement :

- total d'une periode explicite ;
- totaux mensuels d'une annee ;
- totaux trimestriels d'une annee ;
- total annuel ;
- totaux par categorie.

Aucune integration applicative n'est realisee. Aucun calcul fiscal n'est ajoute.

## 2. Perimetre exact

Inclus :

- fonctions pures Revenue ;
- tests unitaires et tests de parite locaux ;
- extension de l'API publique `src/domain/calculations/revenue/index.js` ;
- rapport documentaire.

Exclus :

- `App.jsx` ;
- UI ;
- Supabase ;
- localStorage/sessionStorage ;
- routing ;
- cotisations ;
- ACRE ;
- TVA ;
- CFE ;
- echeances ;
- declarations ;
- factures ;
- premium ;
- Today ;
- graphiques et KPI UI.

## 3. Architecture du sous-lot

Structure ajoutee :

```text
src/domain/calculations/revenue/
  periods.js
  categories.js
```

Structure conservee :

```text
src/domain/calculations/revenue/
  normalizeRevenue.js
  filterRevenues.js
  calculateRevenueTotal.js
  index.js
```

Le decoupage est volontairement limite :

- `periods.js` porte les periodes calendaires ;
- `categories.js` porte les regroupements par categorie ;
- aucun fichier global `calculationEngine` ou `calculateEverything`.

## 4. Reutilisation de LOT 4B.1

Les nouveaux calculs reutilisent :

- `normalizeRevenue` via `filterRevenues` ;
- `filterRevenues` pour normaliser, exclure les donnees invalides et appliquer les periodes 4B.1 ;
- `calculateRevenueTotal` pour toutes les sommes.

La logique de normalisation, de parsing montant, de warnings `INVALID_REVENUE_AMOUNT` / `INVALID_REVENUE_DATE` et de trace de filtrage n'a pas ete recopiee.

## 5. Contrat de periode

Contrat retenu :

```js
{
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD"
}
```

Les bornes sont inclusives, par parite avec `filterRevenues` LOT 4B.1 et les filtres legacy `App.jsx`.

La periode est invalide si :

- `startDate` est absent ou invalide ;
- `endDate` est absent ou invalide ;
- `startDate` est apres `endDate`.

Aucune periode fiscale, declarative ou URSSAF n'est creee.

## 6. Calcul pour periode explicite

Fonction :

```js
calculateRevenueForPeriod(revenues, period, options)
```

Retour :

```js
{
  total,
  count,
  includedCount,
  excludedCount,
  period: { startDate, endDate },
  valid,
  warnings,
  trace
}
```

Comportement :

- valide la periode ;
- filtre les revenus par date locale ;
- exige une date revenue valide pour entrer dans la periode ;
- conserve zero et montants negatifs selon le contrat LOT 4B.1 ;
- exclut les montants invalides avec warnings ;
- ne mute pas les entrees.

## 7. Calcul mensuel

Fonction :

```js
calculateMonthlyRevenueTotals(revenues, year, options)
```

Structure :

```js
{
  year,
  months: [
    {
      month,
      monthKey,
      period,
      total,
      count,
      includedCount,
      excludedCount
    }
  ],
  total,
  includedCount,
  excludedCount,
  valid,
  warnings,
  trace
}
```

Les 12 mois calendaires sont toujours retournes pour une annee valide, y compris les mois sans revenu.

## 8. Calcul trimestriel

Fonction :

```js
calculateQuarterlyRevenueTotals(revenues, year, options)
```

Structure :

```js
{
  year,
  quarters: [
    {
      quarter,
      quarterKey,
      period,
      total,
      count,
      includedCount,
      excludedCount
    }
  ],
  total,
  includedCount,
  excludedCount,
  valid,
  warnings,
  trace
}
```

Les trimestres sont calendaires :

- Q1 : janvier a mars ;
- Q2 : avril a juin ;
- Q3 : juillet a septembre ;
- Q4 : octobre a decembre.

## 9. Calcul annuel

Fonction :

```js
calculateAnnualRevenueTotal(revenues, year, options)
```

Elle reutilise `calculateRevenueForPeriod` avec la periode `YYYY-01-01` a `YYYY-12-31`.

Elle n'utilise pas :

- `new Date()` sans argument ;
- `Date.now()` ;
- annee courante implicite.

## 10. Breakdown par categorie

Fonction :

```js
calculateRevenueTotalsByCategory(revenues, options)
```

Structure :

```js
{
  groups: [
    {
      categoryKey,
      category,
      originalCategories,
      total,
      count,
      includedCount,
      excludedCount
    }
  ],
  total,
  includedCount,
  excludedCount,
  warnings,
  trace
}
```

Le resultat public est un tableau de groupes serialisable, pas un objet indexe par categorie. Ce choix evite les collisions de prototype pour des cles comme `__proto__`, `constructor` ou `toString`.

## 11. Categories historiques identifiees

Categories identifiees dans le code et les documents :

- `service` ;
- `services` ;
- `vente` ;
- `commerce` ;
- `mixed` ;
- `mixte` ;
- `other` ;
- categorie vide ;
- categories inconnues.

`App.jsx` utilise actuellement `vente` et `service` pour le breakdown d'activite mixte.

## 12. Mapping de categorie

Aucun mapping par defaut n'est applique.

Les valeurs restent distinctes :

- `service` reste distinct de `services` ;
- `vente` reste distinct de `commerce` ;
- `mixed` reste distinct de `mixte`.

Une option locale est disponible :

```js
{
  categoryMapping: {
    services: "service"
  }
}
```

Ce mapping est explicite, non global, non persiste et non mutate.

## 13. Politique des mois vides

Une annee valide retourne toujours 12 mois.

Un mois sans revenu retourne :

```js
{
  total: 0,
  count: 0,
  includedCount: 0,
  excludedCount: 0
}
```

Aucun label de mois localise n'est produit.

## 14. Politique des trimestres vides

Une annee valide retourne toujours 4 trimestres.

Un trimestre sans revenu retourne un total `0` et un count `0`.

Aucun trimestre n'est interprete comme periode URSSAF.

## 15. Gestion des dates invalides

Les revenus avec date invalide sont signales par `normalizeRevenue`, puis exclus des calculs periodiques qui exigent une date.

Le moteur ne transforme pas une date invalide en date courante et ne change pas de fuseau horaire.

## 16. Gestion des annees invalides

Les fonctions annuelles, mensuelles et trimestrielles exigent une annee calendaire explicite.

Une annee invalide retourne :

- `valid: false` ;
- total `0` ;
- groupes vides ;
- warning `INVALID_REVENUE_YEAR`.

## 17. Warnings

Warnings ajoutes :

- `INVALID_REVENUE_PERIOD_START_DATE` ;
- `INVALID_REVENUE_PERIOD_END_DATE` ;
- `INVALID_REVENUE_PERIOD_ORDER` ;
- `INVALID_REVENUE_YEAR` ;
- `MISSING_REVENUE_CATEGORY` ;
- `UNKNOWN_REVENUE_CATEGORY`.

Warnings reutilises :

- `INVALID_REVENUE_AMOUNT` ;
- `INVALID_REVENUE_DATE` ;
- `REVENUE_EXCLUDED_AS_INVALID`.

Les warnings restent structures :

```js
{
  code,
  severity,
  domain,
  field,
  sourceId,
  details
}
```

Ils ne contiennent pas de texte UI, de payload complet, de client, de note ou de donnee personnelle.

## 18. Trace

La trace reste :

- desactivee par defaut ;
- active uniquement avec `trace: true` ;
- structuree ;
- non persistee ;
- sans `console.log`.

Nouveaux steps possibles :

- `revenue.period.validate` ;
- `revenue.period.total` ;
- `revenue.monthly.validate` ;
- `revenue.monthly.aggregate` ;
- `revenue.quarterly.validate` ;
- `revenue.quarterly.aggregate` ;
- `revenue.annual.validate` ;
- `revenue.category.aggregate`.

## 19. Arrondis

Aucun arrondi implicite n'est ajoute.

Les totaux conservent le comportement de `calculateRevenueTotal` et `sumMoney`.

Le lot n'ajoute pas :

- `Math.round` ;
- `roundEuro` ;
- `roundMoney` ;
- `toFixed` ;
- formatage euro.

## 20. Immutabilite

Tests ajoutes :

- tableau source inchange ;
- objets Revenue inchanges ;
- `period` inchange ;
- `options` inchange ;
- `categoryMapping` inchange.

Les tableaux de resultats sont construits dans de nouveaux objets.

## 21. Determinisme

Les nouveaux modules ne dependent pas de :

- React ;
- Supabase ;
- localStorage/sessionStorage ;
- DOM ;
- `window` ;
- `document` ;
- `Date.now` ;
- `new Date()` sans argument ;
- `Intl` ;
- locale navigateur ;
- `Math.random` ;
- UUID.

Les tests de parite peuvent utiliser `new Date(...)` pour reproduire les chemins legacy, mais le moteur Revenue ne l'utilise pas.

## 22. API publique Revenue

API publique de `src/domain/calculations/revenue/index.js` apres LOT 4B.2 :

- `normalizeRevenue` ;
- `filterRevenues` ;
- `calculateRevenueTotal` ;
- `calculateRevenueForPeriod` ;
- `calculateMonthlyRevenueTotals` ;
- `calculateQuarterlyRevenueTotals` ;
- `calculateAnnualRevenueTotal` ;
- `calculateRevenueTotalsByCategory`.

## 23. Collision normalizeRevenue

La collision entre :

- `src/domain/calculations/revenue/normalizeRevenue.js` ;
- Domain Models `normalizeRevenue`.

reste volontairement non resolue.

Revenue Calculations n'est toujours pas reexporte depuis :

- `src/domain/calculations/index.js` ;
- `src/domain/index.js`.

## 24. Tests unitaires

Fichier cree :

- `tests/revenue-periods.test.js`.

Couverture :

- periode vide ;
- tableau vide ;
- meme jour ;
- bornes inclusives ;
- dates avant/apres ;
- dates invalides ;
- ordre invalide ;
- changement de mois ;
- changement d'annee ;
- 12 mois ;
- mois sans revenu ;
- janvier ;
- fevrier ;
- 29 fevrier ;
- decembre ;
- 4 trimestres ;
- frontieres Q1/Q2/Q3/Q4 ;
- annee vide ;
- annee invalide ;
- decimaux ;
- montants negatifs ;
- categories historiques ;
- categorie inconnue ;
- categorie absente ;
- mapping explicite ;
- cles sensibles ;
- warnings ;
- trace ;
- immutabilite.

## 25. Tests de parite

Parite caracterisee :

- total de periode sur cas valides equivalents a `revenues.reduce((sum, item) => sum + Number(item.amount || 0), 0)` ;
- historique mensuel legacy de `App.jsx`, compare par mois pour les dates valides ;
- breakdown mixte `vente` / `service` de `App.jsx`.

`App.jsx` n'est pas importe.

## 26. Divergences legacy

Divergences documentees et non branchees :

- les revenus avec montant invalide sont exclus avec warning, au lieu de produire potentiellement `NaN` ;
- le calcul mensuel 4B.2 retourne toujours 12 mois, alors que `monthlyHistory` legacy retourne seulement les mois avec donnees, tries du plus recent au plus ancien ;
- les breakdowns par categorie 4B.2 conservent toutes les categories, alors que le breakdown mixte legacy n'affiche que `vente` et `service`.

Aucune de ces divergences n'est visible car aucun branchement applicatif n'a ete realise.

## 27. Cas limites

Cas limites couverts :

- `2026-01-01` ;
- `2026-02-28` ;
- `2028-02-29` ;
- `2026-03-31` / `2026-04-01` ;
- `2026-06-30` / `2026-07-01` ;
- `2026-09-30` / `2026-10-01` ;
- `2026-12-31` / `2027-01-01` ;
- montant zero ;
- montant negatif ;
- decimal ;
- categorie vide ;
- categorie inconnue ;
- cles `__proto__`, `constructor`, `toString`.

## 28. Securite des cles de categorie

Le regroupement utilise un `Map` interne et retourne une liste de groupes.

Il ne cree pas d'objet public indexe par categorie. Les cles sensibles ne peuvent donc pas polluer `Object.prototype`.

## 29. Calculs reportes

Reportes explicitement :

- cotisations ;
- ACRE ;
- TVA ;
- CFE ;
- echeances URSSAF ;
- declarations ;
- obligations ;
- reserve recommandee ;
- factures ;
- Factur-X ;
- premium ;
- Today ;
- KPI UI ;
- graphiques ;
- moyenne mensuelle dashboard ;
- premier revenu et jours depuis premier revenu ;
- projections fiscales.

## 30. Absence d'integration applicative

Aucun nouveau calcul n'est importe ou appele depuis :

- `App.jsx` ;
- composants React ;
- hooks ;
- utils historiques ;
- Supabase ;
- localStorage.

Le comportement utilisateur reste donc inchange.

## 31. Resultats build/tests/lint

Commandes executees :

### `node --test tests/revenue-periods.test.js`

Premier lancement sandbox :

- echec environnemental `spawn EPERM`.

Validation finale apres creation du rapport :

- 21 tests ;
- 21 pass ;
- 0 fail ;
- duree : 191.331 ms.

### `node --test tests/revenue-foundations.test.js`

- 14 tests ;
- 14 pass ;
- 0 fail ;
- duree : 123.8112 ms.

### `node --test tests/calculation-primitives.test.js`

- 17 tests ;
- 17 pass ;
- 0 fail ;
- duree : 153.6741 ms.

### `node --test tests/domain-models.test.js`

- 14 tests ;
- 14 pass ;
- 0 fail ;
- duree : 143.6388 ms.

### `node --test tests/rules-engine.test.js`

- 15 tests ;
- 15 pass ;
- 0 fail ;
- duree : 246.0767 ms.

### `npm run build`

- PASS ;
- Vite v7.2.6 ;
- 333 modules transformed ;
- build termine en 4.48 s ;
- warning historique : certains chunks depassent 500 kB.

### `npm run lint`

Premier lancement apres ajout :

- 22 errors / 29 warnings ;
- cause : variable interne inutilisee dans `periods.js`.

Apres correction :

- ECHEC attendu baseline ;
- 50 problems ;
- 21 errors ;
- 29 warnings.

Baseline :

- avant LOT 4B.2 : 21 erreurs / 29 warnings ;
- apres LOT 4B.2 : 21 erreurs / 29 warnings ;
- variation : aucune augmentation.

### `npx playwright test --reporter=line`

- suites Node rejouees par la configuration, toutes vertes ;
- 11 tests Playwright ;
- 11 passed ;
- duree Playwright : 16.8 s.

## 32. Fichiers crees

Fichiers crees par LOT 4B.2 :

- `src/domain/calculations/revenue/periods.js` ;
- `src/domain/calculations/revenue/categories.js` ;
- `tests/revenue-periods.test.js` ;
- `docs/LOT_4B_2_REVENUE_PERIODS_REPORT.md`.

## 33. Fichiers modifies

Fichiers modifies par LOT 4B.2 :

- `src/domain/calculations/revenue/index.js` ;
- `tests/revenue-foundations.test.js`.

Justification de la modification du test 4B.1 :

- le test verifie la liste exacte des exports publics Revenue ;
- LOT 4B.2 ajoute officiellement de nouveaux exports publics ;
- seule l'assertion de contrat d'exports a ete mise a jour ;
- les tests comportementaux 4B.1 restent inchanges.

Fichiers volontairement non modifies :

- `src/App.jsx` ;
- `src/domain/index.js` ;
- `src/domain/calculations/index.js` ;
- `src/domain/models/` ;
- `src/domain/rules/` ;
- `src/domain/calculations/money.js` ;
- `src/domain/calculations/dates.js` ;
- `src/utils/obligations.js` ;
- `src/components/InvoiceGenerator.jsx` ;
- `src/utils/facturx.js`.

## 34. Risques residuels

Risques :

- les nouveaux calculs ne sont pas encore branches ;
- `normalizeRevenue` reste duplique entre Domain Models et Revenue Calculations ;
- les divergences legacy sur invalides et groupes mensuels devront etre arbitrees avant integration ;
- les categories historiques restent heterogenes ;
- les calculs de moyenne, projection, premier revenu et dashboard restent dans `App.jsx`.

Mitigation :

- API Revenue locale uniquement ;
- tests de parite ;
- absence d'integration applicative ;
- rollback simple.

## 35. Rollback

Rollback simple :

1. Supprimer `src/domain/calculations/revenue/periods.js`.
2. Supprimer `src/domain/calculations/revenue/categories.js`.
3. Retirer les nouveaux exports de `src/domain/calculations/revenue/index.js`.
4. Supprimer `tests/revenue-periods.test.js`.
5. Retirer les nouveaux noms de l'assertion d'exports dans `tests/revenue-foundations.test.js`.
6. Supprimer ce rapport.

Aucune migration de donnees, Supabase, localStorage ou UI n'est necessaire.

## 36. Recommandation pour le prochain sous-lot

Recommandation :

- continuer avec un sous-lot Revenue strictement pur si besoin ;
- ne pas brancher l'application tant que les divergences legacy ne sont pas acceptees ;
- traiter separement moyenne mensuelle, premier revenu et jours depuis premier revenu si le prochain lot reste Revenue ;
- reporter cotisations, TVA, ACRE, echeances et factures a leurs lots dedies.

## 37. GO / NO-GO

Confirmations :

- aucune logique metier active modifiee ;
- aucun taux modifie ;
- aucun seuil modifie ;
- aucun calcul fiscal ajoute ;
- aucune TVA ajoutee ;
- aucune ACRE ajoutee ;
- aucune cotisation ajoutee ;
- aucune echeance metier ajoutee ;
- aucune facture transformee en revenu ;
- aucune donnee persistee modifiee ;
- aucun payload Supabase modifie ;
- aucune cle localStorage modifiee ;
- aucun comportement visible modifie ;
- `src/domain/index.js` non modifie ;
- `src/domain/calculations/index.js` non modifie ;
- collision `normalizeRevenue` volontairement non resolue ;
- baseline lint non augmentee.

Decision :

GO POUR LE PROCHAIN SOUS-LOT.
