# LOT 5.2 - Facade Contract & Boundary Hardening

Date : 2026-07-30\
Statut : hardening architectural\
Objet : verrouillage du contrat et des frontieres du Calculation Facade

## 1. Resume

LOT 5.2 durcit le Facade sans ajouter de fonctionnalite ni de calcul metier.

Le Facade reste une couche d'orchestration :

- il recoit les entrees ;
- il appelle Revenue ;
- il appelle Contributions ;
- il appelle Legacy ACRE ;
- il assemble les resultats ;
- il fusionne warnings et traces ;
- il propage les erreurs.

Aucun taux, arrondi, pourcentage, calcul de cotisation, calcul de reduction ou regle fiscale n'a ete ajoute.

## 2. Contrat d'entree

Le contrat d'entree est verrouille sur les champs top-level LOT 5.0 :

```js
{
  revenues,
  fiscalProfile,
  period,
  referenceDate
}
```

Le Facade refuse maintenant :

- input non objet ;
- champ obligatoire absent ;
- champ top-level inconnu ;
- options non objet ;
- option inconnue ;
- calculateur injecte non fonction.

Les options absentes restent acceptees via le contrat JavaScript par defaut. Le Facade ne complete plus `revenues`, `fiscalProfile` ou `period` par des valeurs metier silencieuses.

## 3. Contrat de sortie

La structure de sortie est testee comme structure exacte :

```js
{
  revenue,
  contributions,
  summary,
  warnings,
  trace
}
```

Sous-structures exactes testees :

- `revenue`: `total`, `period`, `breakdowns` ;
- `contributions`: `standard`, `final`, `acre` ;
- `summary`: `baseAmount`, `standardContributionAmount`, `finalContributionAmount`, `savedAmount`, `effectiveRate`, `calculable`.

Aucun champ top-level supplementaire n'est ajoute.

## 4. Pipeline

Pipeline verrouille :

```text
Revenue
  -> Contributions
  -> Legacy ACRE
  -> Fusion
  -> Fiscal Summary
```

Le Facade ne modifie pas l'ordre d'orchestration et ne poursuit pas le pipeline si un domaine echoue.

## 5. Orchestration

Orchestration testee :

- periode explicite : appel `calculateRevenueForPeriod` ;
- absence de periode explicite : appel `calculateRevenueTotal` ;
- periode annuelle : appel `calculateAnnualRevenueTotal` ;
- breakdown categories : appel `calculateRevenueTotalsByCategory` ;
- standard : appel `calculateStandardContribution` avec le total Revenue ;
- ACRE : appel `calculateLegacyAcreContribution` avec le resultat standard.

Le Facade ne selectionne plus un trimestre dans LOT 5.2, afin d'eviter toute interpretation de valeur metier dans l'orchestrateur minimal.

## 6. Erreurs

Propagation testee :

- si Revenue echoue, Contributions et ACRE ne sont pas appeles ;
- si Contributions echoue, ACRE n'est pas appele ;
- si ACRE echoue, l'erreur est propagee ;
- le Facade ne masque aucune erreur ;
- aucun fallback n'est applique.

Les erreurs de programmation sont des `TypeError`. Les erreurs des domaines remontent telles quelles.

## 7. Warnings

Fusion des warnings :

- ordre deterministe par pipeline ;
- deduplication structurelle ;
- aucune creation de warning Facade ;
- aucune mutation des warnings sources.

Champs preserves :

- `code` ;
- `severity` ;
- `domain` ;
- `field` ;
- `details` ;
- `sourceId`.

Cle de deduplication :

```text
domain + code + field + sourceId
```

## 8. Trace

Trace :

- desactivee par defaut ;
- activee avec `{ trace: true }` ;
- fusionnee dans l'ordre des domaines ;
- aucune trace inventee ;
- aucune mutation des traces sources.

Le Facade ne cree pas de step `facade.*` dans ce lot.

## 9. Immutabilite

Tests renforces sur :

- input ;
- options ;
- resultats Revenue ;
- resultats Contributions ;
- resultats ACRE ;
- tableaux warnings ;
- tableaux trace.

Le Facade assemble des objets de sortie sans modifier les objets recus.

## 10. Guard Architecture

Un test statique analyse `calculateFiscalSummary.js`.

Il ignore :

- imports ;
- commentaires ;
- chaines de caracteres.

Il echoue si le corps executable contient :

- `Math.round` ;
- `*` ;
- `/` ;
- `%` ;
- `getContributionRule` ;
- `switch` ;
- `activityType` ;
- `Date.now` ;
- `new Date` ;
- `Number(` ;
- `parseFloat(` ;
- `parseInt(` ;
- `|| 0` ;
- `?? 0`.

Le controle brut `rg` ne remonte que des imports et la chaine de cle `"activityType"`, ignores par le test statique conformement au brief.

## 11. Tests

Validations executees :

- `node --test tests/fiscal-summary.test.js` : OK, 21 tests passes ;
- `node --test tests/legacy-acre-contribution.test.js` : OK, 22 tests passes ;
- `node --test tests/contribution-aggregations.test.js` : OK, 16 tests passes ;
- `node --test tests/standard-contribution.test.js` : OK, 16 tests passes ;
- `node --test tests/revenue-periods.test.js` : OK, 21 tests passes ;
- `node --test tests/revenue-foundations.test.js` : OK, 14 tests passes ;
- `node --test tests/calculation-primitives.test.js` : OK, 17 tests passes ;
- `node --test tests/domain-models.test.js` : OK, 14 tests passes ;
- `node --test tests/rules-engine.test.js` : OK, 15 tests passes ;
- `npm run build` : OK, avec warning Vite preexistant de chunk > 500 kB ;
- `npm run lint` : ECHEC sur dette existante hors perimetre dans `src/App.jsx`, `src/components/InvoiceGenerator.jsx`, `src/context/AuthContext.jsx` ;
- `npx eslint src/domain/calculations/facade/calculateFiscalSummary.js src/domain/calculations/facade/index.js tests/fiscal-summary.test.js` : OK ;
- `npx playwright test --reporter=line` : OK, 11 tests passes.

## 12. Fichiers modifies

Fichiers modifies :

- `src/domain/calculations/facade/calculateFiscalSummary.js` ;
- `tests/fiscal-summary.test.js`.

Fichier cree :

- `docs/LOT_5_2_FACADE_CONTRACT_HARDENING_REPORT.md`.

Aucun export public n'a ete modifie.

## 13. Limites

Ce lot ne fait pas :

- integration App ;
- amelioration Revenue ;
- amelioration Contributions ;
- amelioration ACRE ;
- modification Rules Engine ;
- modification Domain Models ;
- ajout de module TVA, CFE, retraite ou IR ;
- ajout d'options publiques ;
- integration UI ;
- persistance.

## 14. Risques

Risques residuels :

- le lint global reste bloque par une dette hors perimetre ;
- les options d'injection restent reservees aux tests et a l'orchestration controlee ;
- une future selection mensuelle ou trimestrielle devra etre deleguee a Revenue ou specifiee dans un lot separe.

Mitigations :

- guard statique dans la suite Facade ;
- tests d'ordre strict ;
- tests d'arret sur erreur ;
- rejection des champs inconnus ;
- aucune modification des domaines.

## 15. Rollback

Rollback LOT 5.2 :

- restaurer `src/domain/calculations/facade/calculateFiscalSummary.js` a l'etat LOT 5.1 ;
- restaurer `tests/fiscal-summary.test.js` a l'etat LOT 5.1 ;
- supprimer `docs/LOT_5_2_FACADE_CONTRACT_HARDENING_REPORT.md`.

Aucun autre fichier n'est implique.

## 16. GO / NO-GO LOT 5.3

Decision : GO POUR LOT 5.3.

Conditions :

- conserver le Facade comme orchestrateur strict ;
- ne pas ajouter de calcul metier dans `calculateFiscalSummary.js` ;
- ne pas integrer `App.jsx` sans lot dedie ;
- ne pas modifier Revenue, Contributions, ACRE, Rules Engine ou Domain Models ;
- deleguer tout futur calcul aux domaines specialises.

Confirmations :

- aucune regle metier ajoutee ;
- aucun calcul ajoute ;
- aucune formule ajoutee ;
- aucun taux ajoute ;
- aucun arrondi ajoute ;
- aucune modification Revenue ;
- aucune modification Contributions ;
- aucune modification ACRE ;
- aucune modification Rules Engine ;
- aucune modification Domain Models ;
- aucune integration App.jsx ;
- aucune donnee persistee modifiee ;
- aucun comportement visible modifie.

GO POUR LOT 5.3
