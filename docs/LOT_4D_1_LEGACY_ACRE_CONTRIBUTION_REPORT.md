# LOT 4D.1 - Legacy ACRE Contribution

Date : 2026-07-30\
Statut : implementation pure legacy\
Source d'autorite : `docs/LOT_4D_0_ACRE_GATE_REVIEW.md`

## 1. Resume

LOT 4D.1 cree un domaine pur ACRE limite a la parite legacy. La fonction publique `calculateLegacyAcreContribution` applique une reduction ACRE deja decidee a un resultat standard produit par Contributions.

Aucune eligibilite juridique, reforme 2026, integration applicative, aggregation ACRE ou logique fiscale adjacente n'a ete ajoutee.

## 2. Perimetre

Inclus :

- creation de `src/domain/calculations/acre/` ;
- calcul ACRE legacy sur resultat Contributions existant ;
- utilisation de `getAcreRule` comme seule source de regle ACRE ;
- `referenceDate` injectee ;
- warnings structures et deduplices ;
- trace optionnelle ;
- tests unitaires dedies.

Exclus :

- App, UI, Revenue, Contributions, Rules Engine, Domain Models, Money, Dates ;
- Supabase, localStorage, migrations, payloads persistants ;
- TVA, CFE, reserve, echeances, declarations ;
- eligibility engine et reforme ACRE 2026.

## 3. Contrat d'entree

Export public :

```js
calculateLegacyAcreContribution(
  standardContributionResult,
  {
    acre,
    acreStartDate,
    referenceDate,
    activityType
  },
  options
)
```

Le premier argument est le resultat standard deja produit par `calculateStandardContribution`. Le calcul ACRE ne recalcule pas la cotisation standard.

`referenceDate` est obligatoire pour appliquer ACRE. Si elle est absente ou invalide, le resultat reste standard avec warning `INVALID_ACRE_REFERENCE_DATE`.

## 4. Contrat de sortie

La sortie specialisee contient :

- `baseAmount`, `activityType`, `referenceDate` ;
- `standardRate`, `standardContributionAmount` ;
- `acreApplied`, `acreRate`, `reductionRate` ;
- `acreContributionAmount`, `savedAmount` ;
- `acrePeriod`, `acreStatus`, `acreMonthsLeft` ;
- `ruleId`, `rounding`, `calculable` ;
- `warnings`, `trace`.

Quand ACRE n'est pas appliquee, `acreContributionAmount` reste egal au montant standard et `savedAmount` vaut `0`.

## 5. Source de la regle ACRE

La seule source de regle ACRE est `src/domain/rules/acreRules.js#getAcreRule`, identifiee par LOT 4D.0.

Le calculateur n'ajoute aucun taux, coefficient ou valeur locale. Il lit seulement `rule.output.effectiveRate`, `rule.output.acreActive`, `rule.output.acreStatus`, `rule.output.acreMonthsLeft`, `rule.output.acreEndDate` et `rule.value.reductionFactor`.

## 6. Relation avec Contributions

Contributions reste responsable du calcul standard :

- base ;
- activite ;
- taux standard ;
- montant standard ;
- arrondi standard ;
- warnings Contributions.

ACRE compose avec ce resultat et preserve ses warnings. Aucun fichier Contributions n'a ete modifie.

## 7. Logique de periode

La periode ACRE est evaluee par `getAcreRule` avec :

- `acre` ;
- `acreStartDate` si valide ;
- `activityType` ;
- `today` issu de `referenceDate`.

La borne legacy reproduit le comportement 12 mois par difference annee/mois. Le jour du mois n'est pas utilise pour les mois restants, conformement a la caracterisation 4D.0.

## 8. Formule legacy

Si la regle ACRE indique `acreActive === true` et si le standard est calculable :

```text
acreContributionAmount = roundEuro(baseAmount * effectiveRate)
savedAmount = standardContributionAmount - acreContributionAmount
```

Sinon :

```text
acreContributionAmount = standardContributionAmount
savedAmount = 0
```

## 9. Arrondi

Le montant ACRE reutilise `roundEuro`, la primitive deja retenue pour la parite `Math.round` en euros entiers.

L'economie est calculee apres arrondi des deux montants. Aucune nouvelle strategie d'arrondi n'a ete creee.

## 10. Warnings

Codes utilises parmi ceux valides en 4D.0 :

- `INVALID_ACRE_START_DATE` ;
- `INVALID_ACRE_REFERENCE_DATE` ;
- `MISSING_ACRE_CONTEXT` ;
- `ACRE_NOT_ACTIVE` ;
- `ACRE_PERIOD_EXPIRED` ;
- `ACRE_RULE_NOT_FOUND` ;
- `INVALID_ACRE_RATE` ;
- `UNKNOWN_ACRE_ELIGIBILITY` ;
- `ACRE_STATUS_NOT_CONFIRMED` ;
- `STANDARD_CONTRIBUTION_NOT_CALCULABLE`.

Les warnings Contributions recus sont preserves et deduplices avec les warnings ACRE.

## 11. Trace

Trace desactivee par defaut.

Avec `{ trace: true }`, les steps emis sont :

- `acre.input.normalize` ;
- `acre.standard.read` ;
- `acre.rule.resolve` ;
- `acre.period.evaluate` ;
- `acre.amount.calculate` ;
- `acre.amount.round` ;
- `acre.result.finalize`.

Aucun `console.log`, aucune persistence, aucun payload personnel.

## 12. Immutabilite

Le calculateur ne mute pas :

- le resultat Contributions recu ;
- le contexte ACRE ;
- les options ;
- les dates d'entree ;
- la regle retournee.

Un test dedie verifie cette propriete.

## 13. Parite legacy

La parite couverte inclut :

- services ACRE active sans date ;
- commerce ACRE active ;
- mixte ACRE active ;
- ACRE inactive ;
- ACRE unknown ;
- statut manquant ;
- date de debut valide ;
- date invalide avec fallback legacy sans date ;
- periode active ;
- periode expiree ;
- borne mois avant expiration ;
- borne mois exacte a 12 mois ;
- base nulle ;
- base negative caracterisee via standard explicitement calculable.

Les comparaisons de montant et de taux s'appuient sur `computeObligations` quand la date implicite legacy ne perturbe pas le cas.

## 14. Tests

Commandes executees :

- `node --test tests/legacy-acre-contribution.test.js` : OK, 22 tests passes ;
- `node --test tests/contribution-aggregations.test.js` : OK, 16 tests passes ;
- `node --test tests/standard-contribution.test.js` : OK, 16 tests passes ;
- `node --test tests/revenue-periods.test.js` : OK, 21 tests passes ;
- `node --test tests/revenue-foundations.test.js` : OK, 14 tests passes ;
- `node --test tests/calculation-primitives.test.js` : OK, 17 tests passes ;
- `node --test tests/domain-models.test.js` : OK, 14 tests passes ;
- `node --test tests/rules-engine.test.js` : OK, 15 tests passes ;
- `npm run build` : OK, warning Vite preexistant de chunk > 500 kB ;
- `npm run lint` : ECHEC sur dette existante hors perimetre dans `src/App.jsx`, `src/components/InvoiceGenerator.jsx`, `src/context/AuthContext.jsx` ;
- `npx eslint src/domain/calculations/acre/calculateLegacyAcreContribution.js src/domain/calculations/acre/index.js tests/legacy-acre-contribution.test.js` : OK ;
- `npx playwright test --reporter=line` : OK, 11 tests passes.

Le premier lancement sandbox de `node --test tests/legacy-acre-contribution.test.js` a echoue sur `spawn EPERM`; la meme commande a ete relancee hors sandbox et a reussi.

## 15. Fichiers crees

- `src/domain/calculations/acre/index.js` ;
- `src/domain/calculations/acre/calculateLegacyAcreContribution.js` ;
- `tests/legacy-acre-contribution.test.js` ;
- `docs/LOT_4D_1_LEGACY_ACRE_CONTRIBUTION_REPORT.md`.

## 16. Fichiers modifies

Aucun fichier existant n'a ete modifie pour LOT 4D.1.

Aucun reexport n'a ete ajoute depuis `src/domain/calculations/index.js` ou `src/domain/index.js`.

## 17. Risques

Risques residuels :

- `getAcreRule` contient encore une fallback date implicite si `today` manque, mais le calculateur 4D.1 ne l'appelle pas sans `referenceDate` valide ;
- la dette lint existante bloque `npm run lint` hors perimetre ;
- la date invalide est caracterisee comme warning avec comportement legacy sans date, pas comme refus juridique.

## 18. Limites

Le lot ne traite pas :

- criteres d'eligibilite ;
- depot ou delai de demande ;
- reforme ACRE 2026 ;
- dates officielles futures ;
- aggregation ACRE ;
- integration UI ou dashboard ;
- donnees persistantes.

## 19. Rollback

Rollback simple :

- supprimer `src/domain/calculations/acre/` ;
- supprimer `tests/legacy-acre-contribution.test.js` ;
- supprimer `docs/LOT_4D_1_LEGACY_ACRE_CONTRIBUTION_REPORT.md`.

Aucun autre fichier ou export global n'est implique.

## 20. GO / NO-GO prochain sous-lot

Decision : GO POUR LE PROCHAIN SOUS-LOT, sous conditions strictes.

Conditions :

- conserver ACRE hors eligibility juridique ;
- ne pas appliquer la reforme 2026 sans lot dedie ;
- ne pas brancher App.jsx sans sous-lot d'integration separe ;
- traiter la dette lint existante dans un lot distinct si elle devient bloquante.

Confirmations :

- aucune logique d'eligibilite ;
- aucune reforme ACRE 2026 ;
- aucun taux code en dur dans le calcul ACRE ;
- aucune TVA ;
- aucune CFE ;
- aucune reserve ;
- aucune aggregation ACRE ;
- aucune integration App.jsx ;
- aucune modification Revenue ;
- aucune modification Contributions ;
- aucune modification Rules Engine ;
- aucune modification Domain Models ;
- aucune donnee persistee modifiee ;
- aucune cle localStorage modifiee ;
- aucun payload Supabase modifie ;
- aucun comportement visible modifie.

GO POUR LE PROCHAIN SOUS-LOT
