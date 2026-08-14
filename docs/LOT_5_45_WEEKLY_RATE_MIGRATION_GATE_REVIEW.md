# LOT 5.45 - Weekly Rate Migration Gate Review

Statut : decision GO/NO-GO documentaire.

## 1. Objet

Ce lot decide si le consommateur `dashboardWeeklyRecap` peut migrer sa source de taux hebdomadaire vers le contrat durci du LOT 5.44, sans changer le comportement visible du recap hebdomadaire.

Migration candidate :

```js
resolveWeeklyEstimatedRate({
  effectiveRate: fiscalSummaryVisibleSlice.effectiveRate,
  legacyFallbackRate: getEstimatedRate(dashboardAnswers.activity_type),
})
```

Ce LOT ne migre pas le runtime, ne modifie pas `src/App.jsx`, ne cree pas de nouveau consommateur et ne lance pas de tests.

## 2. Sources d'autorite

- LOT 5.41 - Next Consumer Migration Gate Review
- LOT 5.42 - Weekly Recap Effective Rate Parity Evidence
- LOT 5.43 - Weekly Rate Mismatch Investigation
- LOT 5.44 - Weekly Rate Contract Hardening
- Inspection locale du consommateur `dashboardWeeklyRecap`
- Inspection locale de `getEstimatedRate`
- Inspection locale de `fiscalSummaryVisibleSlice.effectiveRate`
- Inspection locale de `resolveWeeklyEstimatedRate`

## 3. Consommateur legacy actuel

Le recap hebdomadaire calcule aujourd'hui :

```js
const estimatedRate =
  computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);

const weeklyEstimatedCharges =
  weeklyRevenueCount > 0 && Number.isFinite(estimatedRate)
    ? Math.round(weeklyRevenueTotal * estimatedRate)
    : null;
```

Le consommateur est un calcul `useMemo` local. Il combine :

- revenus de la semaine ;
- factures visibles creees sur la semaine ;
- rappels actifs ;
- CTA de recommandation ou prochaine action ;
- estimation de cotisations via `weeklyRevenueTotal * estimatedRate`.

Le rendu du recap peut exister meme si le profil fiscal n'est pas complet, des lors qu'il existe au moins une donnee utile hebdomadaire : revenu, facture ou rappel.

## 4. Source candidate

La source candidate est `fiscalSummaryVisibleSlice.effectiveRate`.

Cette valeur est deja le point de sortie visible du Shadow Adapter :

- Shadow actif : `shadowResult.summary.effectiveRate`
- Shadow inactif : `computed?.rate`

Le feature flag existant reste donc porte par `fiscalSummaryVisibleSlice`. La migration du consommateur ne doit pas creer de nouveau flag.

## 5. Contrat durci valide

Le LOT 5.44 a introduit le helper :

```js
resolveWeeklyEstimatedRate({
  effectiveRate,
  legacyFallbackRate,
})
```

Contrat :

```js
return effectiveRate || legacyFallbackRate;
```

Ce contrat reproduit explicitement la logique legacy du consommateur hebdomadaire :

```js
computed?.rate || getEstimatedRate(dashboardAnswers.activity_type)
```

La migration candidate remplace seulement la premiere operande par la source visible du Shadow Adapter, tout en conservant le fallback legacy.

## 6. Parite

Le LOT 5.42 a etabli la parite brute entre `computed?.rate` et `fiscalSummaryVisibleSlice.effectiveRate` pour les cas standards :

- services ;
- commerce ;
- mixte ;
- `computed.rate` positif ;
- ACRE inactive ;
- ACRE active ;
- variantes de revenus hebdomadaires.

Le LOT 5.42 a aussi documente trois divergences :

- `computed.rate = 0` ;
- activite inconnue ;
- activite manquante.

Le LOT 5.43 a classe ces divergences comme une ambiguite de contrat : le domaine peut conserver `0`, tandis que l'UI legacy applique un fallback truthy vers `getEstimatedRate`.

Le LOT 5.44 a ferme cette ambiguite en validant que le helper durci reproduit la source legacy attendue sur ces divergences.

Conclusion parite : la migration est acceptable uniquement avec `resolveWeeklyEstimatedRate`, pas avec une lecture brute de `fiscalSummaryVisibleSlice.effectiveRate`.

## 7. Formule hebdomadaire

La migration ne doit pas changer :

```js
Math.round(weeklyRevenueTotal * estimatedRate)
```

Elle ne doit pas changer :

- la condition `weeklyRevenueCount > 0` ;
- le controle `Number.isFinite(estimatedRate)` ;
- le retour `null` quand l'estimation n'est pas applicable ;
- l'arrondi ;
- la devise ;
- le shape des items du recap.

La seule surface autorisee pour le LOT d'implementation est la resolution de `estimatedRate`.

## 8. Isolation date, factures et rappels

La migration de taux n'a pas besoin de toucher :

- `getTodayIsoDate()` ;
- `parseIsoDate()` ;
- le calcul `weekStart` / `weekEnd` ;
- le filtrage des revenus par semaine ;
- le filtrage des factures visibles ;
- `activeReminderItems` ;
- `dashboardRecommendation` ;
- `dashboardNextStep`.

Ces dependances restent hors perimetre.

## 9. React et dependances

Le changement attendu est local au `useMemo` du recap hebdomadaire.

Dependances attendues apres migration :

- remplacer `computed?.rate` par `fiscalSummaryVisibleSlice.effectiveRate` ;
- conserver `dashboardAnswers.activity_type` pour le fallback ;
- ne pas ajouter de `useState` ;
- ne pas ajouter de `useEffect` ;
- ne pas ajouter de persistence ;
- ne pas modifier les payloads assistant.

Le helper doit etre importe puis appele une seule fois dans `src/App.jsx`.

## 10. Baseline Shadow

Baseline avant migration :

- `fiscalSummaryVisibleSlice` est deja defini comme source visible ;
- aucun consommateur direct de `fiscalSummaryVisibleSlice.effectiveRate` n'existe hors construction du slice ;
- le nombre d'occurrences de `fiscalSummaryVisibleSlice` dans `src/App.jsx` est 8.

Attendu apres implementation :

- ajout d'un seul consommateur hebdomadaire ;
- baseline `fiscalSummaryVisibleSlice` : 8 -> 9 ;
- aucune dixieme occurrence ;
- aucune deuxieme facade ou adapter.

## 11. Rollback

Rollback local attendu :

```js
const estimatedRate =
  computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);
```

Si l'import de `resolveWeeklyEstimatedRate` devient inutilise apres rollback, il doit etre retire.

Le rollback ne doit pas toucher aux dates, revenus, factures, rappels, CTA ou au Shadow Adapter.

## 12. Fichiers autorises pour le LOT d'implementation

Si cette gate review donne GO, le LOT 5.46 devrait se limiter a :

- `src/App.jsx`
- `tests/lot-5-46-weekly-rate-migration-implementation.test.js`
- `docs/LOT_5_46_WEEKLY_RATE_MIGRATION_IMPLEMENTATION_REPORT.md`

Le helper du LOT 5.44 doit etre reutilise tel quel, sauf contradiction critique decouverte pendant l'implementation.

## 13. Tests attendus au LOT 5.46

Le LOT 5.46 doit couvrir :

- usage unique de `resolveWeeklyEstimatedRate` dans `src/App.jsx` ;
- import du helper ;
- remplacement source-only de `computed?.rate` par `fiscalSummaryVisibleSlice.effectiveRate` ;
- conservation du fallback `getEstimatedRate(dashboardAnswers.activity_type)` ;
- cas `effectiveRate` positif ;
- cas `effectiveRate = 0` ;
- activite inconnue ;
- activite manquante ;
- ACRE active et inactive ;
- formule `Math.round(weeklyRevenueTotal * estimatedRate)` inchangee ;
- logique date/semaine inchangee ;
- factures/rappels inchangees ;
- absence de nouveau state/effect/persistence/payload ;
- baseline `fiscalSummaryVisibleSlice` 8 -> 9 sans 10e occurrence ;
- rollback local documente.

Les suites de parite et runtime existantes doivent rester vertes au LOT 5.46.

## 14. Risques residuels

Risque principal : utiliser directement `fiscalSummaryVisibleSlice.effectiveRate` sans fallback legacy. Cela reintroduirait les divergences du LOT 5.42.

Mitigation : le GO est conditionne a l'usage explicite du helper `resolveWeeklyEstimatedRate`.

Risque secondaire : modifier le `useMemo` au-dela de la source du taux. Cela elargirait inutilement le perimetre.

Mitigation : le LOT 5.46 doit etre source-only.

## 15. Decision

Le consommateur `dashboardWeeklyRecap` est pret pour migration.

Raison :

- la divergence identifiee au LOT 5.42 est comprise ;
- le LOT 5.43 a etabli que le fallback legacy doit rester dans le contrat ;
- le LOT 5.44 a durci ce contrat avec un helper dedie ;
- la migration candidate conserve le comportement legacy tout en consommant la source visible Shadow ;
- le perimetre d'implementation est local et reversible.

Decision : GO POUR LOT 5.46 - WEEKLY RATE MIGRATION IMPLEMENTATION
