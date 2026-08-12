# LOT 4B.1 - Revenue Foundations Report

Date : 2026-07-29\
Branche : `refactor/saas-shell-v2`\
Statut d'entree : GO POUR LOT 4B.1\
Reference architecture : `docs/LOT_4A_5_CALCULATION_LAYER_ARCHITECTURE.md`

## 1. Resume

LOT 4B.1 cree les fondations pures du domaine Revenue dans le Calculation Layer.

Ce lot cree uniquement :

- `normalizeRevenue` ;
- `filterRevenues` ;
- `calculateRevenueTotal`.

Aucun calcul fiscal n'est ajoute. Le lot ne calcule ni cotisations, ni TVA, ni ACRE, ni echeances, ni reserve, ni dashboard, ni KPI.

Le code applicatif actif reste inchange :

- `App.jsx` non modifie ;
- UI non modifiee ;
- Supabase non modifie ;
- localStorage non modifie ;
- Rules Engine non modifie ;
- Domain Models non modifies ;
- Money et Dates non modifies.

## 2. Architecture

Structure creee :

```text
src/domain/calculations/revenue/
  index.js
  normalizeRevenue.js
  filterRevenues.js
  calculateRevenueTotal.js
```

Choix d'export :

- l'API publique Revenue est exposee depuis `src/domain/calculations/revenue/index.js` ;
- `src/domain/calculations/index.js` n'a pas ete modifie pour eviter un conflit avec `normalizeRevenue` deja expose par les Domain Models ;
- `src/domain/index.js` n'a pas ete modifie pour la meme raison.

Cette decision preserve les tests Domain Models existants et evite une ambiguite de barrel export.

## 3. Normalizer

Fonction :

```js
normalizeRevenue(input, options)
```

Responsabilites :

- accepter les formes historiques locales et Supabase ;
- normaliser `amount` avec les primitives Money ;
- normaliser `date` avec les primitives Dates ;
- produire `id`, `userId`, `amount`, `date`, `revenueCategory`, `client`, `invoice`, `note`, `createdAt` ;
- conserver les champs inconnus ;
- ne pas muter l'objet source ;
- documenter les anomalies dans `warnings`.

Contrats importants :

- virgule decimale acceptee par defaut ;
- montant negatif conserve par defaut ;
- montant invalide retourne `amount: null` avec warning ;
- date invalide retourne `date: null` avec warning ;
- aucune categorie fiscale n'est deduite.

## 4. Filter

Fonction :

```js
filterRevenues(revenues, options)
```

Responsabilites :

- normaliser chaque revenu ;
- ne filtrer par defaut aucun revenu ;
- exclure les revenus invalides uniquement avec `excludeInvalid: true` ;
- filtrer par `category` uniquement si l'option est fournie ;
- filtrer par periode explicite uniquement si `period` est fourni ;
- produire warnings et trace optionnelle.

Options supportees :

- `category` ;
- `period: { from, to }` ;
- `excludeInvalid` ;
- `includeNegative` ;
- `includeZero` ;
- `requireDate` ;
- `trace`.

## 5. Total

Fonction :

```js
calculateRevenueTotal(revenues, options)
```

Responsabilites :

- calculer uniquement le total de revenus ;
- utiliser `sumMoney` ;
- appliquer les filtres explicites transmis ;
- exclure les valeurs invalides selon le contrat du total ;
- retourner un rapport simple.

Retour :

```js
{
  total,
  includedCount,
  excludedCount,
  warnings,
  trace
}
```

Le total ne calcule pas :

- TVA ;
- cotisations ;
- ACRE ;
- reserve ;
- projection ;
- dashboard.

## 6. API publique

API publique exacte de `src/domain/calculations/revenue/index.js` :

- `normalizeRevenue` ;
- `filterRevenues` ;
- `calculateRevenueTotal`.

Rien d'autre n'est exporte par ce fichier.

## 7. Warnings

Structure retenue :

```js
{
  code,
  severity: "warning",
  domain: "revenue",
  field,
  sourceId,
  details
}
```

Codes actuels :

- `INVALID_REVENUE_AMOUNT` ;
- `INVALID_REVENUE_DATE` ;
- `REVENUE_EXCLUDED_AS_INVALID`.

Les warnings ne contiennent pas :

- phrase UI traduite ;
- email ;
- nom ;
- adresse ;
- payload complet ;
- donnee Supabase complete.

## 8. Tests

Fichier cree :

- `tests/revenue-foundations.test.js`.

Couverture :

- API publique exacte ;
- tableau vide ;
- un revenu ;
- plusieurs revenus ;
- montant nul ;
- montant negatif ;
- chaine numerique ;
- valeur invalide ;
- immutabilite ;
- normalisation locale/Supabase ;
- filtrage par invalidite explicite ;
- filtrage par categorie explicite ;
- filtrage par periode explicite ;
- total ;
- trace optionnelle ;
- parite du total historique sur cas valides equivalents.

## 9. Parite

Calcul historique reproduit :

```js
revenues.reduce((sum, item) => sum + Number(item.amount || 0), 0)
```

Source :

- `src/App.jsx`, calcul `currentMonthTotal` ;
- `src/App.jsx`, calcul `revenueSectionTotal` ;
- `src/App.jsx`, aggregats simples de revenus.

Parite testee :

- `0` ;
- nombres positifs ;
- chaines numeriques ;
- montants negatifs ;
- `null` et `undefined`.

Difference documentee :

- une valeur invalide comme `"bad"` est exclue avec warning dans le nouveau total, au lieu de produire silencieusement `NaN`.

Cette difference ne modifie aucun comportement applicatif car le nouveau calcul n'est pas branche.

## 10. Fichiers crees

Fichiers crees par LOT 4B.1 :

- `src/domain/calculations/revenue/index.js` ;
- `src/domain/calculations/revenue/normalizeRevenue.js` ;
- `src/domain/calculations/revenue/filterRevenues.js` ;
- `src/domain/calculations/revenue/calculateRevenueTotal.js` ;
- `tests/revenue-foundations.test.js` ;
- `docs/LOT_4B_1_REVENUE_FOUNDATIONS_REPORT.md`.

## 11. Fichiers modifies

Fichiers modifies par LOT 4B.1 :

- aucun fichier existant.

Fichiers volontairement non modifies :

- `src/domain/calculations/index.js` ;
- `src/domain/index.js`.

Justification :

- ne pas creer de collision avec le `normalizeRevenue` des Domain Models.

## 12. Risques

Risques residuels :

- le domaine Revenue Foundations n'est pas encore branche ;
- `normalizeRevenue` existe aussi cote Domain Models, avec une responsabilite differente ;
- les revenus invalides sont traites plus prudemment que certains chemins legacy ;
- aucun calcul mensuel, trimestriel, annuel ou par categorie n'est encore disponible.

Mitigation :

- API limitee ;
- tests unitaires dedies ;
- aucun branchement applicatif ;
- documentation explicite de la collision de nom.

## 13. Rollback

Rollback simple :

1. Supprimer `src/domain/calculations/revenue/`.
2. Supprimer `tests/revenue-foundations.test.js`.
3. Supprimer `docs/LOT_4B_1_REVENUE_FOUNDATIONS_REPORT.md`.

Aucun rollback Supabase, localStorage, UI ou App n'est necessaire.

## 14. Validation finale

Commandes executees :

### `node --test tests/revenue-foundations.test.js`

Resultat :

- 14 tests ;
- 14 pass ;
- 0 fail ;
- duree : 183.8449 ms.

### `node --test tests/calculation-primitives.test.js`

Resultat :

- 17 tests ;
- 17 pass ;
- 0 fail ;
- duree : 162.1286 ms.

### `node --test tests/domain-models.test.js`

Resultat :

- 14 tests ;
- 14 pass ;
- 0 fail ;
- duree : 135.2518 ms.

### `node --test tests/rules-engine.test.js`

Resultat :

- 15 tests ;
- 15 pass ;
- 0 fail ;
- duree : 264.4574 ms.

### `npm run build`

Resultat :

- PASS ;
- Vite v7.2.6 ;
- 333 modules transformed ;
- build termine en 4.70 s ;
- warning historique : certains chunks depassent 500 kB.

### `npm run lint`

Resultat :

- ECHEC attendu baseline ;
- 50 problems ;
- 21 errors ;
- 29 warnings.

Baseline :

- baseline avant LOT 4B.1 : 21 erreurs, 29 warnings ;
- baseline apres LOT 4B.1 : 21 erreurs, 29 warnings ;
- variation : aucune augmentation ;
- aucun probleme lint dans les fichiers Revenue crees.

### `npx playwright test --reporter=line`

Resultat :

- suites Node rejouees par la configuration, toutes vertes ;
- 11 tests Playwright ;
- 11 passed ;
- duree Playwright : 18.7 s.

## 15. GO / NO-GO LOT 4B.2

Confirmations :

- aucun calcul fiscal ajoute ;
- aucune TVA ;
- aucune ACRE ;
- aucune cotisation ;
- aucune echeance ;
- aucune facture ;
- aucun premium ;
- aucun Today ;
- aucune integration `App.jsx` ;
- aucune modification Supabase ;
- aucune modification localStorage ;
- aucune regle metier modifiee ;
- aucun taux modifie ;
- aucun seuil modifie ;
- aucun comportement visible modifie.

Decision : GO POUR LOT 4B.2.
