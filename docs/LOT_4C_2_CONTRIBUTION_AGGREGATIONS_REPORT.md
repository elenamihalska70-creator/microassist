# LOT 4C.2 - Contribution Aggregations Report

Date : 2026-07-30\
Statut : extension pure du domaine Contributions\
References : `docs/LOT_4C_0_CONTRIBUTIONS_GATE_REVIEW.md`, `docs/LOT_4C_1_STANDARD_CONTRIBUTION_REPORT.md`

## 1. Resume

LOT 4C.2 ajoute des agregations pures de cotisations standard a partir de plusieurs bases de revenu.

Le lot couvre :

- total global ;
- periode explicite ;
- aggregation mensuelle ;
- aggregation trimestrielle ;
- aggregation annuelle ;
- breakdown par activite.

Aucune integration applicative n'a ete realisee.

## 2. Perimetre

Inclus :

- agregations pures Contributions ;
- reutilisation obligatoire de `calculateStandardContribution` ;
- tests unitaires et caracterisation legacy hors ACRE ;
- mise a jour du barrel Contributions local ;
- rapport documentaire.

Exclus :

- `App.jsx` ;
- Revenue Calculations ;
- Rules Engine ;
- Domain Models ;
- Money ;
- Dates ;
- Supabase ;
- localStorage ;
- UI ;
- routing ;
- `obligations.js` ;
- InvoiceGenerator ;
- Factur-X ;
- tests Playwright existants ;
- ACRE, TVA, CFE, reserve, net disponible, prevision, echeances, declarations, facade globale, adapter applicatif.

## 3. Architecture

Fichiers ajoutes :

```text
src/domain/calculations/contributions/
  calculateContributionTotal.js
  periods.js
  activities.js
```

Structure :

- `calculateContributionTotal.js` porte l'accumulation de resultats individuels ;
- `periods.js` porte les periodes calendaires explicites, mensuelles, trimestrielles et annuelles ;
- `activities.js` porte le regroupement par valeur d'activite ;
- `index.js` expose uniquement l'API publique Contributions.

## 4. Contrat d'entree

Entree multi-lignes :

```js
[
  {
    baseAmount,
    activityType,
    date,
    sourceId
  }
]
```

`date` est requis uniquement pour les fonctions temporelles.

`sourceId` est optionnel et sert a rattacher les warnings techniques. Aucun Domain Model complet n'est impose.

## 5. Contrat de sortie

Les sorties d'agregation exposent selon le cas :

- `totalBaseAmount` ;
- `totalContributionAmount` ;
- `count` ;
- `includedCount` ;
- `excludedCount` ;
- `warnings` ;
- `trace`.

Les agregations temporelles ajoutent `period`, `year`, `months` ou `quarters`. Le breakdown activite ajoute `groups`.

## 6. Reutilisation de calculateStandardContribution

Chaque entree incluse est calculee en appelant `calculateStandardContribution`.

LOT 4C.2 ne recopie pas :

- resolution du taux ;
- multiplication ;
- arrondi ;
- warnings standards ;
- trace du calcul individuel.

## 7. Total global

Fonction :

```js
calculateContributionTotal(entries, options)
```

Le total additionne les `contributionAmount` deja produits par `calculateStandardContribution`.

Les entrees non calculables sont exclues et signalees par warning.

## 8. Periode explicite

Fonction :

```js
calculateContributionsForPeriod(entries, { startDate, endDate }, options)
```

Les bornes sont inclusives. Le contrat de date est strictement `YYYY-MM-DD`.

Aucune periode URSSAF, fiscale ou declarative n'est creee.

## 9. Mensuel

Fonction :

```js
calculateMonthlyContributionTotals(entries, year, options)
```

Retourne toujours 12 mois calendaires pour une annee valide, y compris les mois vides.

Chaque mois expose :

- `month` ;
- `monthKey` ;
- `period` ;
- `baseAmount` ;
- `contributionAmount` ;
- `count`.

## 10. Trimestriel

Fonction :

```js
calculateQuarterlyContributionTotals(entries, year, options)
```

Retourne toujours quatre trimestres calendaires :

- Q1 : janvier a mars ;
- Q2 : avril a juin ;
- Q3 : juillet a septembre ;
- Q4 : octobre a decembre.

## 11. Annuel

Fonction :

```js
calculateAnnualContributionTotal(entries, year, options)
```

L'annee est toujours injectee. Le module n'utilise pas `Date.now()`, `new Date().getFullYear()` ou annee courante implicite.

## 12. Breakdown par activite

Fonction :

```js
calculateContributionTotalsByActivity(entries, options)
```

Aucune fusion implicite n'est appliquee.

Les valeurs restent distinctes :

- `service` ;
- `services` ;
- `vente` ;
- `commerce` ;
- `mixed` ;
- `mixte` ;
- `unknown` ;
- cles sensibles comme `__proto__`, `constructor`, `toString`.

Le regroupement utilise un `Map`, pas un objet public indexe par activite.

## 13. Regles et taux

Le taux reste exclusivement resolu par `calculateStandardContribution`, lui-meme branche sur le Rules Engine.

LOT 4C.2 ne contient aucune table de taux Contributions, aucun switch local et aucune constante de taux metier.

## 14. Warnings

Warnings standards preserves :

- `INVALID_CONTRIBUTION_BASE` ;
- `NEGATIVE_CONTRIBUTION_BASE` ;
- `MISSING_ACTIVITY_TYPE` ;
- `UNKNOWN_ACTIVITY_TYPE` ;
- `CONTRIBUTION_RULE_NOT_FOUND` ;
- `INVALID_CONTRIBUTION_RATE` ;
- `CONTRIBUTION_RULE_WARNING`.

Warnings d'agregation ajoutes :

- `CONTRIBUTION_ENTRY_EXCLUDED` ;
- `INVALID_CONTRIBUTION_DATE` ;
- `INVALID_CONTRIBUTION_PERIOD` ;
- `INVALID_CONTRIBUTION_PERIOD_START_DATE` ;
- `INVALID_CONTRIBUTION_PERIOD_END_DATE` ;
- `INVALID_CONTRIBUTION_PERIOD_ORDER` ;
- `INVALID_CONTRIBUTION_YEAR`.

Les warnings restent structures et ne contiennent pas de texte UI ni de payload personnel.

## 15. Trace

La trace est :

- desactivee par defaut ;
- active uniquement avec `trace: true` ;
- structuree ;
- non persistee ;
- sans `console.log`.

Steps publics possibles :

- `contributions.total.aggregate` ;
- `contributions.period.aggregate` ;
- `contributions.monthly.aggregate` ;
- `contributions.quarterly.aggregate` ;
- `contributions.activity.aggregate`.

## 16. Arrondi

Aucune nouvelle politique d'arrondi n'est creee.

Chaque cotisation individuelle est arrondie par `calculateStandardContribution`, puis les agregations additionnent ces montants produits.

Le lot ne calcule jamais `totalBaseAmount x taux global`.

## 17. Immutabilite

Les tests couvrent l'absence de mutation de :

- `entries` ;
- objets d'entree ;
- `options` ;
- `period`.

Les groupes et resultats sont construits dans de nouveaux objets.

## 18. Parite legacy

La parite caracterisee compare les agregations de cotisations standard hors ACRE a `computeObligations` sur les cas retenus par LOT 4C.0 :

- services ;
- commerce ;
- mixte ;
- activite inconnue ;
- base nulle ;
- base decimale.

`App.jsx` n'est pas importe.

## 19. Tests

Commandes executees :

- `node --test tests/contribution-aggregations.test.js` : PASS, 16 tests passes. Premier lancement sandbox en echec environnemental `spawn EPERM`, relance hors sandbox PASS ;
- `node --test tests/standard-contribution.test.js` : PASS, 16 tests passes ;
- `node --test tests/revenue-periods.test.js` : PASS, 21 tests passes ;
- `node --test tests/revenue-foundations.test.js` : PASS, 14 tests passes ;
- `node --test tests/calculation-primitives.test.js` : PASS, 17 tests passes ;
- `node --test tests/domain-models.test.js` : PASS, 14 tests passes ;
- `node --test tests/rules-engine.test.js` : PASS, 15 tests passes ;
- `npm run build` : PASS, warning historique de chunk superieur a 500 kB ;
- `npm run lint` : ECHEC attendu baseline, 50 problems, 21 errors, 29 warnings, sans nouveau fichier concerne ;
- `npx playwright test --reporter=line` : PASS, suites Node rejouees puis 11 tests Playwright passes.

## 20. Fichiers crees

- `src/domain/calculations/contributions/calculateContributionTotal.js` ;
- `src/domain/calculations/contributions/periods.js` ;
- `src/domain/calculations/contributions/activities.js` ;
- `tests/contribution-aggregations.test.js` ;
- `docs/LOT_4C_2_CONTRIBUTION_AGGREGATIONS_REPORT.md`.

## 21. Fichiers modifies

- `src/domain/calculations/contributions/index.js` ;
- `tests/standard-contribution.test.js`.

Justification :

- `index.js` expose la nouvelle API publique Contributions ;
- `tests/standard-contribution.test.js` corrige uniquement l'assertion des exports publics.

## 22. Risques

Risques residuels :

- les agregations ne sont pas encore branchees dans l'application ;
- les entrees temporelles utilisent un contrat minimal `date`, a adapter explicitement plus tard ;
- les activites non canoniques restent separees et donc souvent non calculables.

Mitigations :

- API locale Contributions uniquement ;
- aucune integration applicative ;
- aucune modification Revenue ou Rules ;
- tests par periode, annee, activite, warnings, trace et parite.

## 23. Rollback

Rollback simple :

1. Supprimer `src/domain/calculations/contributions/calculateContributionTotal.js`.
2. Supprimer `src/domain/calculations/contributions/periods.js`.
3. Supprimer `src/domain/calculations/contributions/activities.js`.
4. Retirer les exports ajoutes de `src/domain/calculations/contributions/index.js`.
5. Supprimer `tests/contribution-aggregations.test.js`.
6. Retablir l'assertion d'exports 4C.1 dans `tests/standard-contribution.test.js`.
7. Supprimer ce rapport.

Aucune migration, donnee persistante, cle localStorage ou integration UI n'est a annuler.

## 24. GO / NO-GO prochain sous-lot

Confirmations finales :

- aucune TVA ;
- aucune ACRE ;
- aucune CFE ;
- aucune reserve ;
- aucune integration `App.jsx` ;
- aucune modification Revenue ;
- aucune modification Rules Engine ;
- aucune modification Domain Models ;
- aucun taux code en dur ;
- aucune donnee persistee modifiee ;
- aucune cle localStorage modifiee ;
- aucun payload Supabase modifie ;
- aucun comportement visible modifie.

Decision :

GO POUR LE PROCHAIN SOUS-LOT.
