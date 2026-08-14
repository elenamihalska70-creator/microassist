# LOT 5.7 - Shadow Parity Validation

Statut : validation de parite passive.

## Resume

LOT 5.7 ajoute un mecanisme local de comparaison MATCH/MISMATCH entre le legacy dashboard et le Shadow Result Facade.

Le Permanent Migration Guard reste respecte : Legacy demeure la seule source de verite. Le Shadow Result est lu uniquement par le mecanisme de validation de parite, puis ignore. Aucun resultat Facade ne remplace une valeur visible, un state, une persistence, un export, un assistant message, un summary ou un payload.

## Pipeline compare

Pipeline actif :

```text
App legacy computed
  -> legacySnapshot local

buildFiscalSummaryInput(...)
  -> calculateFiscalSummary(..., { trace: false })
  -> shadowResult local
  -> createShadowParityReport(legacySnapshot, shadowResult)
  -> ignore
```

Le point d'integration LOT 5.6 n'a pas ete deplace.

## Valeurs comparees

Comparaison stricte avec `Object.is`, sans normalisation :

- `revenue.total` : `currentMonthTotal` legacy vs `shadowResult.revenue.total` ;
- `summary.baseAmount` : `currentMonthTotal` legacy vs `shadowResult.summary.baseAmount` ;
- `summary.finalContributionAmount` : `computed.estimatedAmount` vs `shadowResult.summary.finalContributionAmount` ;
- `summary.effectiveRate` : `computed.rate` vs `shadowResult.summary.effectiveRate` ;
- `acre.status` : `computed.acreStatus` vs `shadowResult.contributions.acre.acreStatus`.

Non compares dans ce lot :

- TVA ;
- CFE ;
- deadlines ;
- labels UI ;
- recommandations ;
- smart alerts ;
- smart priorities ;
- score ;
- invoices ;
- exports ;
- assistant messages ;
- trace.

## Resultats MATCH

Le mecanisme declare `MATCH` seulement si tous les checks sont strictement egaux.

Le test dedie verifie :

- constantes `MATCH` et `MISMATCH` presentes ;
- comparaison stricte par `Object.is` ;
- aucune normalisation, aucun arrondi, aucun fallback ;
- execution Adapter, Facade et rapport de parite ;
- resultats ignores par `void`.

## Resultats MISMATCH

Le mecanisme declare `MISMATCH` si au moins un check strict diverge.

Le statut reste local, non affiche, non loggue, non persiste et non transmis.

Un `MISMATCH` ne modifie pas :

- UI ;
- React state ;
- App state ;
- Supabase ;
- localStorage ;
- exports ;
- payloads ;
- legacy.

## Ecarts observes

Aucun ecart runtime n'est affiche ou persiste dans LOT 5.7.

Risques de divergence attendus pour lots futurs :

- legacy calcule certains montants avec `computeObligations` et des dates implicites ;
- Facade produit une structure fiscale plus stricte ;
- Facade ne couvre pas TVA, CFE, deadlines ni labels UI ;
- `acre.status` peut diverger si le legacy et le domaine ACRE caracterisent differemment un contexte incomplet.

Ces ecarts potentiels ne declenchent aucune migration.

## Impact

Impact utilisateur : aucun.

Impact application :

- aucun state ajoute ;
- aucun state modifie ;
- aucune persistence ajoutee ;
- aucun payload modifie ;
- aucun export modifie ;
- aucune UI modifiee ;
- aucun logging permanent ajoute.

Le seul changement fonctionnel est une lecture passive du Shadow Result par le rapport de parite local.

## Performance

Le mecanisme ajoute une construction de snapshot local et cinq comparaisons strictes lorsque le shadow est actif.

Aucun effet asynchrone, aucune boucle, aucun setState, aucune persistence et aucun rendu supplementaire ne sont ajoutes.

## Tests

Test cree :

- `tests/shadow-parity-validation.test.js`.

Couverture :

- shadow parity passif ;
- MATCH/MISMATCH definis ;
- comparaison stricte ;
- absence de normalisation ;
- absence de mutation state/persistence/UI/payload ;
- Adapter et Facade executes dans le bloc shadow ;
- Shadow Result et rapport de parite ignores.

## Validation

Validations executees :

- `node --test tests/shadow-parity-validation.test.js` : OK, 6 tests passes ;
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
- `npx eslint tests/shadow-parity-validation.test.js` : OK ;
- `npx eslint src/App.jsx` : ECHEC sur dette historique hors perimetre ;
- `npx playwright test --reporter=line` : OK, 11 tests passes.

Dette lint documentee :

- `src/App.jsx` : erreurs `no-unused-vars` et warnings `react-hooks/exhaustive-deps` historiques ;
- `src/components/InvoiceGenerator.jsx` : erreur `react-refresh/only-export-components` dans le lint global ;
- `src/context/AuthContext.jsx` : erreur `react-refresh/only-export-components` dans le lint global.

Aucune nouvelle erreur lint n'est associee au test LOT 5.7. `App.jsx` reste bloque par dette historique hors perimetre.

## Rollback

Rollback LOT 5.7 :

- retirer `SHADOW_PARITY_MATCH` ;
- retirer `SHADOW_PARITY_MISMATCH` ;
- retirer `createShadowParityCheck` ;
- retirer `createShadowParityReport` ;
- retirer la creation `legacySnapshot` et `shadowParityReport` dans le bloc shadow ;
- supprimer `tests/shadow-parity-validation.test.js` ;
- supprimer ce rapport si necessaire.

Le Shadow Pipeline LOT 5.6 peut rester intact.

## GO / NO-GO LOT 5.8

GO POUR LOT 5.8.

Conditions :

- Legacy reste la seule source de verite ;
- Shadow reste ignore hors mecanisme de parite ;
- aucune donnee utilisateur ne doit etre remplacee ;
- aucune persistence ne doit etre modifiee ;
- aucun export ne doit etre modifie ;
- aucun payload ne doit etre modifie ;
- toute future action doit rester passive jusqu'a validation explicite de parite.
