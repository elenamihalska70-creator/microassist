# LOT 4C.1 - Standard Contribution Foundations Report

Date : 2026-07-30\
Statut : implementation pure du calcul standard de cotisation sociale\
Reference principale : `docs/LOT_4C_0_CONTRIBUTIONS_GATE_REVIEW.md`

## 1. Resume

LOT 4C.1 cree uniquement le calcul standard d'une cotisation sociale pour une base explicite et une activite canonique.

Aucune aggregation, integration applicative, ACRE, TVA, CFE, reserve, forecast, simulation ou migration n'a ete ajoutee.

## 2. Contrat d'entree

Contrat retenu depuis LOT 4C.0 :

```js
calculateStandardContribution(
  {
    baseAmount,
    activityType
  },
  options
)
```

`baseAmount` represente une base deja fournie par l'appelant. `activityType` reste canonique et n'est pas mappe par le calculateur.

Options locales :

- `trace` : trace optionnelle, desactivee par defaut ;
- `resolveContributionRule` : injection locale pour tests ;
- `allowNegativeBase` : caracterisation explicite de la parite negative legacy.

## 3. Contrat de sortie

La sortie specialisee est :

```js
{
  baseAmount,
  activityType,
  rate,
  contributionAmount,
  ruleId,
  rounding: "nearest_euro_math_round",
  calculable,
  fallback,
  warnings,
  trace
}
```

Aucun wrapper universel n'a ete ajoute.

## 4. Recuperation du taux

Le taux provient uniquement du Rules Engine via `getContributionRule`.

Le calculateur ne contient aucune table de taux, aucun switch local et aucune constante de taux metier.

## 5. Calcul

Le calcul est strictement :

```text
baseAmount x rate
```

Puis arrondi a l'euro selon la politique historique.

## 6. Warnings

Warnings structures utilises :

- `INVALID_CONTRIBUTION_BASE` ;
- `NEGATIVE_CONTRIBUTION_BASE` ;
- `MISSING_ACTIVITY_TYPE` ;
- `UNKNOWN_ACTIVITY_TYPE` ;
- `CONTRIBUTION_RULE_NOT_FOUND` ;
- `INVALID_CONTRIBUTION_RATE` ;
- `CONTRIBUTION_RULE_WARNING`.

Les warnings restent techniques, sans texte UI, payload Revenue complet, profil complet ou donnee personnelle.

## 7. Throw

Le calculateur throw uniquement pour violation structurelle du contrat de programmation :

- entree non objet ;
- options non objet ;
- `resolveContributionRule` non fonction ;
- resolver retournant une forme non objet non nulle.

Les donnees utilisateur invalides retournent un resultat non calculable avec warning.

## 8. Immutabilite

Les tests confirment l'absence de mutation de :

- entree ;
- options ;
- rule injectee.

Le calculateur ne lit ni ne modifie Rules, Revenue, Domain Models, React, Supabase, localStorage ou DOM.

## 9. Parite

Parite confirmee avec `computeObligations` hors ACRE pour :

- services ;
- commerce ;
- mixte ;
- activite inconnue ;
- base nulle ;
- base decimale.

La base negative est non calculable par defaut avec warning. Une option explicite `allowNegativeBase` permet de caracteriser la parite legacy negative sans l'officialiser.

## 10. Tests

Commandes demandees :

```text
node --test tests/standard-contribution.test.js
node --test tests/revenue-periods.test.js
node --test tests/revenue-foundations.test.js
node --test tests/calculation-primitives.test.js
node --test tests/domain-models.test.js
node --test tests/rules-engine.test.js
npm run build
npm run lint
npx playwright test --reporter=line
```

Resultats :

- `node --test tests/standard-contribution.test.js` : PASS, 16 tests passes. Premier lancement sandbox en echec environnemental `spawn EPERM`, relance hors sandbox PASS ;
- `node --test tests/revenue-periods.test.js` : PASS, 21 tests passes ;
- `node --test tests/revenue-foundations.test.js` : PASS, 14 tests passes ;
- `node --test tests/calculation-primitives.test.js` : PASS, 17 tests passes ;
- `node --test tests/domain-models.test.js` : PASS, 14 tests passes ;
- `node --test tests/rules-engine.test.js` : PASS, 15 tests passes ;
- `npm run build` : PASS, warning historique de chunk superieur a 500 kB ;
- `npm run lint` : ECHEC attendu baseline, 50 problems, 21 errors, 29 warnings, sans nouveau fichier concerne ;
- `npx playwright test --reporter=line` : PASS, suites Node rejouees puis 11 tests Playwright passes.

## 11. Fichiers crees

- `src/domain/calculations/contributions/index.js` ;
- `src/domain/calculations/contributions/calculateStandardContribution.js` ;
- `tests/standard-contribution.test.js` ;
- `docs/LOT_4C_1_STANDARD_CONTRIBUTION_REPORT.md`.

## 12. Fichiers modifies

Aucun fichier existant modifie.

## 13. Risques

Risques residuels :

- le calcul n'est pas encore branche dans l'application ;
- les divergences onboarding simple restent hors perimetre ;
- le traitement officiel des bases negatives devra etre confirme avant integration.

Mitigations :

- API locale minimale ;
- taux exclusivement Rules Engine ;
- tests de parite ;
- absence totale d'integration applicative.

## 14. Rollback

Rollback simple :

1. Supprimer `src/domain/calculations/contributions/index.js`.
2. Supprimer `src/domain/calculations/contributions/calculateStandardContribution.js`.
3. Supprimer `tests/standard-contribution.test.js`.
4. Supprimer `docs/LOT_4C_1_STANDARD_CONTRIBUTION_REPORT.md`.

Aucune migration, donnee persistante, cle localStorage ou integration UI n'est a annuler.

## 15. GO / NO-GO LOT 4C.2

Confirmations :

- aucune TVA ;
- aucune ACRE ;
- aucune CFE ;
- aucune reserve ;
- aucune integration `App.jsx` ;
- aucune modification Revenue ;
- aucune modification Domain Models ;
- aucune modification Rules Engine ;
- aucun taux code en dur dans le calculateur.

Decision provisoire avant validation finale :

GO POUR LOT 4C.2.
