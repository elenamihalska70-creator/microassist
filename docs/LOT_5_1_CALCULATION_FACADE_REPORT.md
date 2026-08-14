# LOT 5.1 - Minimal Calculation Facade

Date : 2026-07-30\
Statut : premiere implementation du Calculation Facade\
Reference : `docs/LOT_5_0_CALCULATION_FACADE_ARCHITECTURE.md`

## 1. Resume

LOT 5.1 cree un Facade minimal et pur expose par `calculateFiscalSummary`.

Le Facade orchestre uniquement les domaines existants :

- Revenue ;
- Contributions ;
- Legacy ACRE.

Il ne deplace aucune formule, aucun taux, aucun arrondi et aucune regle metier. Il assemble les resultats, fusionne warnings et traces, puis retourne un objet fiscal unique.

## 2. Perimetre

Inclus :

- creation de `src/domain/calculations/facade/` ;
- export local `calculateFiscalSummary` ;
- orchestration Revenue -> Contributions -> ACRE ;
- fusion des warnings sans creation de nouveaux warnings ;
- fusion des traces sans creation de trace Facade ;
- tests d'orchestration avec mocks ;
- rapport LOT 5.1.

Exclus :

- aucune integration `App.jsx` ;
- aucune modification Revenue ;
- aucune modification Contributions ;
- aucune modification ACRE ;
- aucune modification Rules Engine ;
- aucune modification Domain Models ;
- aucune lecture Supabase ou localStorage ;
- aucun nouveau calcul fiscal.

## 3. Architecture

Structure creee :

```text
src/domain/calculations/facade/
  calculateFiscalSummary.js
  index.js
```

Le Facade depend des exports publics :

- `revenue/index.js` ;
- `contributions/index.js` ;
- `acre/index.js`.

Il ne depend pas directement du Rules Engine, de `App.jsx`, de `obligations.js`, de React, de Supabase ou du stockage local.

## 4. Pipeline

Pipeline implemente :

```text
Input DTO
  -> Revenue total ou Revenue period
  -> Revenue category breakdown
  -> Standard Contribution
  -> Legacy ACRE Contribution
  -> Fiscal Summary
```

Le total Revenue est transmis comme `baseAmount` au calcul standard. Le resultat standard est transmis tel quel au calcul ACRE.

Le Facade ne multiplie pas, n'arrondit pas, ne relit pas de taux et ne branche pas sur une activite.

## 5. Contrat d'entree

Contrat respecte :

```js
{
  revenues: [],
  fiscalProfile: {
    activityType,
    acre,
    acreStartDate
  },
  period: {
    startDate,
    endDate,
    year,
    quarter
  },
  referenceDate
}
```

`period.startDate` / `period.endDate` declenchent `calculateRevenueForPeriod`.

`period.year` seul declenche `calculateAnnualRevenueTotal`.

Sans periode explicite, le Facade appelle `calculateRevenueTotal`.

Le Facade minimal 5.1 ne selectionne pas lui-meme un mois ou un trimestre, afin d'eviter toute interpretation de valeur metier dans l'orchestrateur.

## 6. Contrat de sortie

Sortie :

```js
{
  revenue: {
    total,
    period,
    breakdowns
  },
  contributions: {
    standard,
    final,
    acre
  },
  summary: {
    baseAmount,
    standardContributionAmount,
    finalContributionAmount,
    savedAmount,
    effectiveRate,
    calculable
  },
  warnings,
  trace
}
```

`contributions.final` est un assemblage du resultat ACRE final. Il ne recalcule aucun montant.

## 7. Dependances

Dependances directes :

- Revenue calculations ;
- Contributions calculations ;
- ACRE calculations.

Dependances interdites et absentes :

- Rules Engine direct ;
- App ;
- React ;
- Supabase ;
- localStorage ;
- obligations legacy ;
- Money direct ;
- Dates direct.

## 8. Fusion des warnings

Le Facade fusionne les warnings existants de :

- Revenue total / period ;
- Revenue breakdown categories ;
- Standard Contributions ;
- Legacy ACRE.

Il ne cree aucun warning nouveau.

Deduplication par cle :

```text
domain + code + field + sourceId
```

Les champs `code`, `severity`, `domain`, `field`, `sourceId` et `details` sont preserves.

## 9. Fusion des traces

Le Facade concatene les traces existantes dans l'ordre du pipeline.

Trace :

- vide par defaut ;
- fusionnee seulement avec `{ trace: true }` ;
- non modifiee ;
- non enrichie par des steps Facade.

Aucun `console.log`, aucune persistence.

## 10. Gestion des erreurs

Le Facade lance des `TypeError` uniquement pour les erreurs de contrat de programmation :

- input non objet ;
- options non objet ;
- calculateur injecte non fonction.

Les erreurs levees par les domaines sont propagees directement. Le Facade ne les convertit pas en warnings.

## 11. API publique

Export public local exact :

```js
export { calculateFiscalSummary } from "./calculateFiscalSummary.js";
```

Depuis :

```text
src/domain/calculations/facade/index.js
```

Aucun export global du projet n'a ete modifie.

## 12. Tests

Tests crees :

- `tests/fiscal-summary.test.js`.

Couverture :

- API publique exacte ;
- pipeline complet ;
- ordre d'appel ;
- fusion Revenue ;
- fusion Contributions ;
- fusion ACRE ;
- fusion warnings ;
- fusion trace ;
- immutabilite ;
- determinisme ;
- propagation des erreurs ;
- absence de recalcul ;
- orchestration periodique annuelle et trimestrielle ;
- garde architectural statique contre calcul direct dans `calculateFiscalSummary.js` ;
- fonctionnement avec les vrais domaines hors App.

Validations executees :

- `node --test tests/fiscal-summary.test.js` : OK, 14 tests passes, incluant le garde architectural ;
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

Le premier lancement sandbox de `node --test tests/fiscal-summary.test.js` a echoue sur `spawn EPERM`; la meme commande relancee hors sandbox a reussi.

## 13. Fichiers crees

- `src/domain/calculations/facade/calculateFiscalSummary.js` ;
- `src/domain/calculations/facade/index.js` ;
- `tests/fiscal-summary.test.js` ;
- `docs/LOT_5_1_CALCULATION_FACADE_REPORT.md`.

## 14. Fichiers modifies

Aucun fichier existant n'a ete modifie pour LOT 5.1.

Aucun export global n'a ete modifie.

## 15. Limites

Limites volontaires :

- pas d'adapter App State ;
- pas d'integration UI ;
- pas de facade preview ;
- pas de simulation ;
- pas de selection mois/trimestre dans le Facade minimal ;
- pas de TVA, CFE, retraite ou IR ;
- pas de strategie warnings/trace extraite dans des fichiers dedies ;
- pas de lecture directe Domain Models.

Le Facade reste minimal et pourra etre elargi par LOT 5.2 seulement si le scope le confirme.

## 16. Rollback

Rollback LOT 5.1 :

- supprimer `src/domain/calculations/facade/` ;
- supprimer `tests/fiscal-summary.test.js` ;
- supprimer `docs/LOT_5_1_CALCULATION_FACADE_REPORT.md`.

Aucun autre fichier ni export global n'est implique.

## 17. GO / NO-GO LOT 5.2

Decision : GO POUR LOT 5.2.

Conditions :

- garder le Facade comme orchestrateur ;
- ne pas integrer `App.jsx` sans lot dedie ;
- ne pas deplacer de calcul depuis les domaines ;
- ne pas ajouter de module fiscal sans gate ;
- traiter la dette lint globale dans un lot separe si elle devient bloquante.

Confirmations :

- aucune regle metier ajoutee ;
- aucun calcul deplace ;
- aucune formule deplacee ;
- aucun taux deplace ;
- aucun arrondi deplace ;
- aucune modification Revenue ;
- aucune modification Contributions ;
- aucune modification ACRE ;
- aucune modification Rules Engine ;
- aucune modification Domain Models ;
- aucune integration App.jsx ;
- aucune donnee persistee modifiee ;
- aucun comportement visible modifie.

GO POUR LOT 5.2
