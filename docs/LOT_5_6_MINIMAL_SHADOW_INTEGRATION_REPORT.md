# LOT 5.6 - Minimal Shadow Integration

Statut : premiere integration technique, Shadow Mode uniquement.

## Resume

LOT 5.6 branche techniquement le pipeline :

```text
App.jsx
  -> buildFiscalSummaryInput
  -> calculateFiscalSummary
```

Le branchement est strictement shadow. Le legacy reste la seule source de verite pour toute valeur visible, persistee, exportee, envoyee, affichee ou stockee.

## Point d'integration

Le point d'integration respecte LOT 5.5 : bloc adjacent au calcul legacy `computed` dans `App.jsx`.

Le shadow s'execute apres :

- `dashboardAnswers` ;
- `currentMonthTotal` ;
- `computed`.

Il s'execute avant les consommateurs UI, sans modifier aucun de ces consommateurs.

## Pipeline Shadow

Pipeline implemente :

```text
DTO applicatif reduit
  -> buildFiscalSummaryInput()
  -> calculateFiscalSummary(..., { trace: false })
  -> shadowResult local
  -> ignore
```

Le shadow est garde par `FISCAL_SUMMARY_SHADOW_ENABLED`.

Le bloc ne fait pas :

- comparaison ;
- setState ;
- persistence ;
- affichage ;
- logging ;
- export ;
- mutation.

## Imports ajoutes

Imports ajoutes dans `src/App.jsx` :

```js
import { buildFiscalSummaryInput } from "./application/adapters/index.js";
import { calculateFiscalSummary } from "./domain/calculations/facade/index.js";
```

Aucun import global, barrel Facade ou barrel Domain n'a ete modifie.

## Execution Adapter

L'Adapter est appele uniquement dans le bloc shadow :

```text
buildFiscalSummaryInput({
  revenues,
  fiscalProfile,
  period,
  referenceDate,
})
```

Le DTO utilise :

- les `revenues` deja charges par App ;
- `dashboardAnswers.activity_type` ;
- `dashboardAnswers.acre` ;
- `dashboardAnswers.acre_start_date` ;
- `period: {}` ;
- `referenceDate` explicitement transmis depuis le slice shadow.

## Execution Facade

Le Facade est appele uniquement dans le bloc shadow :

```text
calculateFiscalSummary(shadowInput, { trace: false })
```

Le resultat est stocke dans une variable locale puis ignore explicitement.

Le Facade ne remplace aucun resultat legacy.

## Absence de mutation

Le bloc shadow :

- ne modifie pas React state ;
- ne modifie pas App state ;
- ne modifie pas `revenues` ;
- ne modifie pas `dashboardAnswers` ;
- ne modifie pas `computed` ;
- ne modifie pas les erreurs legacy ;
- ne modifie pas la persistence ;
- ne modifie pas les payloads.

Les erreurs shadow sont capturees localement et ignorees.

## Absence de comparaison

Aucune comparaison legacy/facade n'est implemente dans LOT 5.6.

LOT 5.7 reste le lot dedie a la comparaison.

## Absence de Shadow State

Aucun shadow state n'a ete ajoute :

- pas de `useState` shadow ;
- pas de context shadow ;
- pas de store ;
- pas de Supabase shadow ;
- pas de localStorage shadow ;
- pas de sessionStorage shadow.

Le resultat shadow ne survit pas au cycle courant.

## Tests

Aucun test n'a ete cree ou modifie.

Note de perimetre : le brief LOT 5.6 contient une tension entre "ne jamais modifier tests" et "creer uniquement les tests Shadow". La contrainte stricte "tests interdits" a ete respectee. Les regressions existantes demandees ont ete executees.

## Validation

Validations executees :

- `node --test tests/fiscal-summary-input-adapter.test.js` : OK, 24 tests passes ;
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
- `npm run lint` : ECHEC sur dette historique hors perimetre ;
- `npx eslint src/App.jsx` : ECHEC sur dette historique hors perimetre ;
- `npx playwright test --reporter=line` : OK, 11 tests passes.

Dette lint documentee :

- `src/App.jsx` : erreurs `no-unused-vars` et warnings `react-hooks/exhaustive-deps` deja presents dans la zone legacy ;
- `src/components/InvoiceGenerator.jsx` : erreur `react-refresh/only-export-components` dans le lint global ;
- `src/context/AuthContext.jsx` : erreur `react-refresh/only-export-components` dans le lint global.

Aucune nouvelle erreur lint n'est associee aux imports shadow ou au bloc shadow.

## Rollback

Rollback LOT 5.6 :

- retirer les deux imports shadow de `App.jsx` ;
- retirer `FISCAL_SUMMARY_SHADOW_ENABLED` ;
- retirer le bloc `useMemo` shadow adjacent a `computed` ;
- supprimer ce rapport si necessaire.

Aucun rollback Revenue, Contributions, ACRE, Rules Engine, Adapter, Facade, persistence ou UI n'est requis.

## GO / NO-GO LOT 5.7

GO POUR LOT 5.7.

Conditions :

- Legacy reste la seule source de verite ;
- LOT 5.7 peut ajouter une comparaison locale et desactivable ;
- aucun resultat Facade ne doit alimenter UI, state, persistence, export, assistant, summary ou payload ;
- aucune comparaison ne doit persister ou afficher des ecarts ;
- toute violation du Permanent Migration Guard doit etre NO-GO.
