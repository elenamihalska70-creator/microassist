# LOT 4A - Calculation Primitives Report

Date : 2026-07-29\
Branche : `refactor/saas-shell-v2`\
Statut d'entree : GO POUR LOT 4A AVEC PERIMETRE REDUIT

## 1. Resume executif

LOT 4A cree uniquement des primitives pures pour montants et dates.

Aucun calcul metier n'est extrait. Aucune cotisation, ACRE, TVA, echeance URSSAF, declaration, revenu, facture ou obligation n'est calculee par ce lot.

Le code applicatif actif reste inchange :

- `src/App.jsx` non modifie ;
- `src/utils/obligations.js` non modifie ;
- `src/components/InvoiceGenerator.jsx` non modifie ;
- `src/utils/facturx.js` non modifie ;
- `src/domain/rules/` non modifie ;
- Supabase, Edge Functions, localStorage et UI non modifies.

## 2. Perimetre exact

Perimetre realise :

- creation de `src/domain/calculations/`;
- creation de primitives `money`;
- creation de primitives `dates`;
- creation d'un index de calculs ;
- reexport depuis `src/domain/index.js`, autorise par le lot ;
- creation de tests unitaires dedies ;
- creation du present rapport.

Perimetre exclu :

- pas de `CalculationEngine`;
- pas de facade obligations ;
- pas de calcul fiscal ;
- pas de branchement applicatif ;
- pas de dependance externe.

## 3. Inventaire des comportements money

Comportements historiques identifies :

- `Number(value || 0)` dans `computeObligations`, previews et totaux ;
- remplacement virgule vers point dans certains formulaires ;
- `Math.round(ca * rate)` pour les cotisations ;
- `Math.round(value * 100) / 100` pour les montants Factur-X ;
- `Math.max(0, Number(value) || 0)` pour quantite/prix facture ;
- `reduce` avec `Number(item.amount || 0)` pour les sommes ;
- `toLocaleString("fr-FR")` pour l'affichage, exclu des primitives ;
- `toFixed(2)` pour XML/serialization, exclu du calcul pur.

Variantes conservees comme contrats distincts :

- invalide -> `null` par defaut ;
- invalide -> `0` seulement si demande explicite ;
- invalide -> exception seulement si demande explicite ;
- negatif autorise par defaut ;
- clamp non negatif seulement via helper dedie.

## 4. Inventaire des comportements dates

Comportements historiques identifies :

- dates metier sous forme `YYYY-MM-DD` ;
- parsing local frequent via `new Date(`${date}T00:00:00`)` ;
- usage risqué de `toISOString().slice(0, 10)` dans certains chemins ;
- ajout de jours par `setDate` ;
- ajout de mois par `setMonth` ;
- fin de mois par `new Date(year, month + 2, 0)` ;
- difference de jours par division de millisecondes ;
- comparaison de dates civiles pour rappels et deadlines ;
- timezone navigateur implicite dans le code actif.

Convention LOT 4A :

- une date locale est un jour calendaire civil ;
- les chaines `YYYY-MM-DD` sont parsees en Date locale, jamais via `new Date("YYYY-MM-DD")` ;
- les helpers retournent des `Date` locales pour les operations et `YYYY-MM-DD` pour formatage explicite ;
- la date courante doit etre injectee par l'appelant.

## 5. Architecture creee

```text
src/domain/calculations/
  index.js
  money.js
  dates.js

tests/
  calculation-primitives.test.js
```

`src/domain/index.js` reexporte `./calculations/index.js`.

Les primitives ne dependent pas de React, Rules, Models, Supabase, localStorage, DOM, window ou fetch.

## 6. Fonctions money

Fonctions creees :

- `isFiniteMoneyValue(value, options)`;
- `parseMoneyValue(value, options)`;
- `normalizeMoney(value, options)`;
- `toFiniteNumberOrZero(value, options)`;
- `clampNonNegative(value, options)`;
- `sumMoney(values, options)`;
- `roundMoney(value, options)`;
- `roundEuro(value, options)`;
- `multiplyMoneyByRate(amount, rate, options)`;
- `areMoneyValuesEqual(a, b, options)`.

Constantes creees :

- `MONEY_INVALID_VALUE_POLICIES`;
- `MONEY_ROUNDING_STRATEGIES`.

Aucune fonction ne choisit un taux fiscal, une categorie, une regle ACRE, une regle TVA ou une reserve.

## 7. Fonctions dates

Fonctions creees :

- `isLeapYear(year)`;
- `daysInMonth(year, month)`;
- `isValidLocalDateString(value)`;
- `parseLocalDate(value)`;
- `formatLocalDate(dateInput)`;
- `startOfLocalDay(dateInput)`;
- `startOfLocalMonth(dateInput)`;
- `endOfLocalMonth(dateInput)`;
- `compareLocalDates(a, b)`;
- `differenceInCalendarDays(a, b)`;
- `addCalendarDays(dateInput, amount)`;
- `addCalendarMonths(dateInput, amount, options)`;
- `requireReferenceDate(dateInput)`.

Constante creee :

- `ADD_MONTH_POLICIES`.

Aucune fonction ne calcule une echeance metier ou une regle reglementaire.

## 8. Contrats d'entree

Money :

- accepte nombres et chaines numeriques ;
- accepte la virgule decimale uniquement avec `allowDecimalComma: true` ;
- refuse `NaN`, `Infinity`, `-Infinity`, objets et chaines non numeriques ;
- expose une politique d'invalide explicite.

Dates :

- accepte `YYYY-MM-DD` strict ;
- accepte `Date` valide en entree pour certaines operations ;
- refuse date invalide, mois 00/13, jour 00, jour hors mois ;
- ne lit jamais implicitement la date courante.

## 9. Contrats de sortie

Money :

- retourne des nombres, `null`, `0` explicite ou exception selon option ;
- ne retourne jamais de chaine formatee ;
- ne convertit jamais euros en centimes.

Dates :

- retourne des `Date` locales ou une chaine `YYYY-MM-DD` via `formatLocalDate`;
- retourne `null` pour les dates invalides, sauf `requireReferenceDate` qui leve une erreur ;
- ne retourne pas de timestamp ISO implicite.

## 10. Strategies d'arrondi

Strategies disponibles :

- `nearest` : `Math.round`;
- `floor` : `Math.floor`;
- `ceil` : `Math.ceil`;
- `truncate` : `Math.trunc`.

Precision :

- explicite via `precision`;
- `roundEuro` force `precision: 0`;
- `roundMoney` utilise `precision: 2` par defaut, pour reproduire le comportement Factur-X courant.

Comportement JavaScript reel conserve :

- `roundMoney(1.005, { precision: 2 })` retourne `1`;
- `roundMoney(0.1 + 0.2, { precision: 2 })` retourne `0.3`.

## 11. Gestion des entrees invalides

Politiques :

- `null` : retourne `null`, politique par defaut ;
- `zero` : reproduit explicitement les chemins historiques `Number(...) || 0` ;
- `reject` : leve `TypeError`.

Decision :

- ne pas transformer silencieusement une entree invalide en zero par defaut ;
- utiliser `toFiniteNumberOrZero` ou `invalidValue: "zero"` pour les comportements historiques.

## 12. Convention Local Date

Une Local Date represente un jour calendaire local, sans heure metier.

Format externe :

- `YYYY-MM-DD`.

Parsing :

- decomposer year/month/day ;
- construire `new Date(year, month - 1, day)` ;
- ne pas utiliser `new Date("YYYY-MM-DD")`.

Formatage :

- `formatLocalDate(date)` reconstruit `YYYY-MM-DD` depuis les getters locaux ;
- pas de `toISOString()` implicite.

## 13. Politique d'ajout de jours

`addCalendarDays(dateInput, amount)` :

- exige un nombre entier de jours ;
- parse en debut de jour local ;
- utilise une copie de date ;
- retourne une `Date` locale ;
- retourne `null` si entree invalide.

Tests couverts :

- changement de mois ;
- changement d'annee ;
- retrait de jour ;
- passages sensibles heure ete/hiver.

## 14. Politique d'ajout de mois

Deux politiques explicites :

- `clampToEndOfMonth` par defaut : preserve le jour si possible, sinon borne au dernier jour du mois cible ;
- `overflow` : reproduit le comportement JavaScript `setMonth`.

Exemples testes :

- `2026-01-31 + 1 mois` -> `2026-02-28` en clamp ;
- `2028-01-31 + 1 mois` -> `2028-02-29` en clamp ;
- `2026-01-31 + 1 mois` -> `2026-03-03` en overflow.

Decision :

- exposer le choix ;
- ne pas masquer les divergences historiques.

## 15. Immutabilite

Garanties :

- aucune mutation de tableau d'entree ;
- aucune mutation de `Date` recue ;
- aucune mutation d'options ;
- aucun etat global mutable.

Tests :

- `sumMoney` ne mute pas son tableau ;
- `parseLocalDate`, `startOfLocalDay` et `addCalendarDays` ne mutent pas la date source.

## 16. Tests unitaires money

Couverture :

- zero ;
- entier positif ;
- entier negatif ;
- decimal ;
- tres petit decimal ;
- chaine numerique ;
- chaine avec espaces ;
- chaine vide ;
- null ;
- undefined ;
- NaN ;
- Infinity ;
- -Infinity ;
- objet ;
- tableau ;
- addition de montants ;
- tableau vide ;
- valeurs mixtes ;
- arrondis nearest/floor/ceil/truncate ;
- precision 0 et 2 ;
- multiplication par taux ;
- taux zero ;
- taux negatif ;
- tolerance flottante ;
- immutabilite.

## 17. Tests unitaires dates

Couverture :

- date `YYYY-MM-DD` valide ;
- date invalide ;
- mois 00/13 ;
- jour 00/hors mois ;
- 29 fevrier valide/invalide ;
- annee bissextile/non bissextile ;
- comparaison avant/egal/apres ;
- difference positive/negative/meme jour ;
- ajout/retrait de jour ;
- changement de mois/annee ;
- fin janvier/fevrier/decembre ;
- timezone non perturbante ;
- immutabilite ;
- date de reference injectee.

## 18. Tests de caracterisation

Caracterisations incluses :

- comportement historique `Number(...) || 0` via `toFiniteNumberOrZero`;
- clamp historique Factur-X via `clampNonNegative`;
- arrondi euro `Math.round`;
- arrondi centimes `Math.round(value * 100) / 100`;
- date-only locale sans `toISOString`;
- ajout de mois overflow JavaScript explicitement disponible.

Non inclus :

- parite `computeObligations`, reportee a LOT 4B+ ;
- parite Factur-X totals, reportee a LOT 4G ;
- parite App.jsx, interdite dans LOT 4A.

## 19. Cas limites

Cas limites couverts :

- `0.1 + 0.2`;
- `1.005`;
- decimales negatives ;
- tolerance negative interdite ;
- precision invalide ;
- date invalide ;
- annee 1900/2000 ;
- fevrier bissextile ;
- 31 janvier ;
- 31 decembre ;
- passage DST Europe/Paris en date-only.

## 20. Comportements reportes

Reportes :

- cotisations ;
- ACRE ;
- TVA ;
- echeances URSSAF ;
- CFE ;
- sante financiere ;
- revenus YTD/historique ;
- previews revenu ;
- factures ;
- score conformite facture ;
- premium/trial ;
- reminders ;
- Today ;
- analytics ;
- ExpertDashboard ;
- Edge Functions.

Justification :

- ces comportements impliquent des regles metier, des effets, des donnees applicatives ou une parite historique plus large.

## 21. Absence d'integration applicative

Les nouveaux helpers ne sont importes par aucun fichier applicatif.

Pas de modification :

- `App.jsx`;
- `obligations.js`;
- `InvoiceGenerator.jsx`;
- `facturx.js`;
- composants ;
- Edge Functions.

## 22. Compatibilite Domain Models

Les primitives sont compatibles avec LOT 2 :

- elles ne modifient aucun normalisateur ;
- elles ne changent aucun contrat localStorage/Supabase ;
- elles peuvent etre consommees plus tard par les normalisateurs ou calculators si un lot l'autorise.

## 23. Compatibilite Rules Engine

Les primitives sont compatibles avec LOT 3 :

- elles ne dependent pas des Rules ;
- elles ne changent aucune regle ;
- elles ne selectionnent aucun taux, seuil ou statut ;
- le reexport depuis `src/domain/index.js` ne cree pas d'import circulaire.

## 24. Resultats build/tests/lint

Resultats de validation finale :

- `node --test tests/calculation-primitives.test.js` : PASS, 17 tests, 17 pass, 0 fail, duration 151.6546 ms ;
- `node --test tests/domain-models.test.js` : PASS, 14 tests, 14 pass, 0 fail, duration 156.1859 ms ;
- `node --test tests/rules-engine.test.js` : PASS, 15 tests, 15 pass, 0 fail, duration 316.76 ms ;
- `npm run build` : PASS, Vite build OK, 333 modules transformed, warning historique chunk > 500 kB ;
- `npm run lint` : ECHEC ATTENDU baseline, 50 problems : 21 errors, 29 warnings ;
- `npx playwright test --reporter=line` : PASS, 11 tests Playwright, 11 passed, suites Node egalement rejouees par la configuration.

Baseline lint :

- baseline autorisee avant LOT 4A : 21 erreurs, 29 warnings ;
- resultat apres LOT 4A : 21 erreurs, 29 warnings ;
- variation : aucune augmentation.

Note environnement :

- le premier lancement Node en sandbox peut echouer avec `spawn EPERM`; la relance hors sandbox a ete necessaire comme dans les lots precedents.

## 25. Fichiers crees

Fichiers crees par LOT 4A :

- `src/domain/calculations/index.js`;
- `src/domain/calculations/money.js`;
- `src/domain/calculations/dates.js`;
- `tests/calculation-primitives.test.js`;
- `docs/LOT_4A_CALCULATION_PRIMITIVES_REPORT.md`.

## 26. Fichiers modifies

Fichier modifie par LOT 4A :

- `src/domain/index.js`.

Modification :

- ajout du reexport `export * from "./calculations/index.js";`.

## 27. Risques residuels

Risques residuels :

- les primitives ne sont pas encore utilisees en production ;
- certains comportements historiques restent contradictoires ;
- les helpers dates devront etre compares aux sorties historiques avant tout branchement ;
- les arrondis flottants JavaScript sont documentes mais non corriges ;
- aucune verification fiscale n'est faite dans LOT 4A.

## 28. Rollback

Rollback simple :

1. Supprimer `src/domain/calculations/`.
2. Supprimer `tests/calculation-primitives.test.js`.
3. Retirer le reexport `./calculations/index.js` de `src/domain/index.js`.
4. Supprimer ce rapport si le lot doit etre annule.

Aucun rollback Supabase/localStorage/UI n'est necessaire.

## 29. Recommandation pour LOT 4B

Recommendation :

- LOT 4B peut commencer par les cotisations uniquement, sans ACRE datee ;
- utiliser `roundEuro`, `parseMoneyValue` et `multiplyMoneyByRate` ;
- comparer chaque resultat a `computeObligations` ;
- ne pas brancher `App.jsx` ;
- ne pas corriger commerce 12% vs 12,3% ;
- ne pas traiter TVA, ACRE ou echeances dans le meme sous-lot.

## 30. Decision GO / NO-GO LOT 4B

Decision finale :

GO POUR LOT 4B

Justification :

- tests LOT 4A verts ;
- tests Domain Models verts ;
- tests Rules Engine verts ;
- build vert ;
- baseline lint non augmentee ;
- Playwright vert ;
- aucun branchement applicatif realise ;
- aucun calcul metier modifie ;
- aucun modele futur injustifie ajoute.
