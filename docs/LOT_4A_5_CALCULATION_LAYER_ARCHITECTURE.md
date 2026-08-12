# LOT 4A.5 - Calculation Layer Architecture

Date : 2026-07-29\
Branche : `refactor/saas-shell-v2`\
Statut : etape d'architecture uniquement\
Decision attendue : cadrer LOT 4B sans commencer LOT 4B

## 1. Resume executif

LOT 4A.5 fixe les conventions officielles du futur Calculation Layer.

Decision principale :

- le Calculation Layer sera compose de fonctions pures ;
- les primitives `money` et `dates` restent directement dans `src/domain/calculations/` ;
- les futurs calculs metier seront organises par sous-dossiers de domaine lorsque plusieurs fichiers deviennent utiles ;
- LOT 4B doit commencer par Revenue Calculations uniquement ;
- aucun calcul fiscal, ACRE, TVA, echeance, facture, premium ou Today ne doit entrer dans LOT 4B.

Le moteur ne lit ni React, ni Supabase, ni localStorage, ni DOM, ni horloge implicite. Il produit des valeurs derivees, des warnings techniques structures et des traces optionnelles. Il ne produit pas de phrases UI.

Decision finale : GO POUR LOT 4B, avec perimetre strict Revenue Calculations pures et non branchees.

## 2. Contexte

Lots valides :

- LOT 0 Stabilisation ;
- LOT 0.1 Routing Readiness ;
- LOT 1 Routing Shell Extraction ;
- LOT 2 Domain Models ;
- LOT 3 Rules Engine ;
- preparation LOT 4 ;
- Gate Review LOT 4 ;
- LOT 4A Primitives pures Money & Dates.

Etat actuel :

- `App.jsx` concentre encore beaucoup de calculs et d'agregats ;
- `src/utils/obligations.js` reste le calcul fiscal actif ;
- `src/utils/facturx.js` contient les calculs facture ;
- `src/domain/rules/` expose les regles historiques ;
- `src/domain/calculations/` contient seulement `money.js`, `dates.js` et `index.js`.

## 3. Objectifs

Objectifs de cette etape :

- definir les conventions de nommage ;
- definir les contrats de retour ;
- definir erreurs, warnings, trace et options ;
- fixer les frontieres avec Domain Models, Rules Engine, Money, Dates, adapters et UI ;
- definir l'architecture minimale que LOT 4B devra respecter ;
- eviter un moteur trop abstrait ou un fichier geant.

## 4. Perimetre

Inclus :

- decision architecturale ;
- conventions de code futures ;
- cadrage exact de LOT 4B ;
- risques, questions ouvertes et stop conditions.

Exclus :

- aucune implementation ;
- aucun calcul Revenue ;
- aucun deplacement de calcul existant ;
- aucun changement de source, test, export ou document existant ;
- aucune integration applicative.

## 5. Principes du Calculation Layer

Decision :

- fonctions pures ;
- entrees explicites ;
- date de reference injectee ;
- regles recues ou resolues explicitement selon le domaine ;
- aucune dependance React, Supabase, localStorage, sessionStorage, DOM, reseau ou navigateur ;
- immutabilite des arguments ;
- sorties deterministes ;
- responsabilite unique ;
- compatibilite historique avant toute integration.

Justification :

- l'existant melange calculs, UI, effets et persistance ;
- les calculs doivent devenir testables hors navigateur ;
- les lots futurs doivent pouvoir comparer ancien et nouveau comportement sans brancher l'application.

Exemple :

```js
calculateRevenueTotal({ revenues })
```

Alternative rejetee :

- moteur global configuré avec etat interne.

Impact LOT 4B :

- LOT 4B ne cree que des fonctions pures Revenue.

## 6. Responsabilites incluses

Appartiennent au Calculation Layer :

- sommes ;
- regroupements ;
- periodes ;
- totaux ;
- ratios ;
- statuts derives techniques ;
- arrondis metier explicites ;
- warnings de donnees ;
- trace de calcul optionnelle.

Exemples futurs :

- total des revenus d'une periode ;
- breakdown vente/service ;
- nombre de mois avec donnees ;
- revenu moyen mensuel ;
- cotisation estimee quand un lot fiscal l'autorise.

## 7. Responsabilites exclues

Restent hors du Calculation Layer :

- lecture React state ;
- hooks ;
- Supabase ;
- localStorage/sessionStorage ;
- fetch ;
- Edge Functions ;
- navigation ;
- PDF/XML/download ;
- textes UI ;
- formatage devise affiche ;
- messages toast ;
- analytics ;
- persistence de trace ;
- generation d'identifiant ;
- prise de decision officielle.

Justification :

- ces elements sont des effets, de l'infrastructure ou de la presentation.

## 8. Convention de nommage

Convention principale :

- utiliser `calculateX` pour toute valeur derivee par calcul.

Prefixes autorises :

- `calculateX` : produit une valeur derivee par formule ou aggregation ;
- `normalizeX` : transforme une structure legacy vers une forme compatible sans decision metier nouvelle ;
- `parseX` : convertit une primitive d'entree vers une primitive exploitable ;
- `validateX` : retourne validite et erreurs de contrat ;
- `filterX` : retourne un sous-ensemble ;
- `groupX` : organise par cle ;
- `resolveX` : selectionne une regle, periode ou valeur parmi plusieurs possibilites ;
- `selectX` : choisit une valeur sans transformation lourde ;
- `compareX` : compare deux valeurs ;
- `createX` : construit un objet metier nouveau ;
- `buildX` : assemble un payload ou objet compose, hors calcul pur si effet/format ;
- `formatX` : interdit dans le moteur metier, sauf format canonique technique comme `formatLocalDate`.

Alternatives rejetees :

- `computeX` : deja utilise par legacy `computeObligations`, a reserver a l'ancien code ;
- `getX` : trop vague pour un calcul ;
- `deriveX` : correct mais moins lisible pour l'equipe ;
- `buildX` : suggere assemblage, pas formule.

Impact LOT 4B :

- fonctions publiques `calculateRevenueTotal`, `calculateRevenueBreakdown`, `calculateRevenuePeriodMetrics`.

## 9. Categories de fonctions

Trois categories officielles :

1. Primitive helper.
2. Calculation function.
3. Calculation report ou aggregate.

Primitive helper :

- retourne directement `number`, `boolean`, `string YYYY-MM-DD`, `Date`, `null` ou tableau simple ;
- peut lever `TypeError` ou `RangeError` pour option invalide ;
- pas de warnings lourds par defaut.

Calculation function :

- retourne un objet metier simple ou une valeur directe si le calcul est evident ;
- peut retourner warnings si des entrees sont ignorees ;
- trace optionnelle.

Calculation report :

- retourne un objet specialise avec plusieurs champs, warnings et trace optionnelle ;
- pas de wrapper universel obligatoire.

## 10. Contrats de retour

Decision :

- pas de `Result` universel impose ;
- utiliser des retours directs pour primitives ;
- utiliser des objets specialises pour les calculs metier ;
- utiliser `{ value, warnings, trace }` seulement quand la fonction doit signaler exclusions ou details.

Exemples :

```js
calculateRevenueTotal({ revenues }) => 1500
calculateRevenueBreakdown({ revenues }) => {
  total: 1500,
  venteTotal: 1000,
  serviceTotal: 500,
  warnings: []
}
```

Alternative rejetee :

```js
{ ok: true, value, warnings, trace, metadata }
```

Justification :

- wrapper universel trop lourd pour `roundEuro` ou `sumMoney` ;
- `ok` est inutile quand l'erreur est une violation de contrat ou quand un tableau vide vaut naturellement 0.

Impact LOT 4B :

- preferer objets specialises pour les aggregates Revenue.

## 11. Gestion des erreurs

Politique officielle :

| Categorie | Strategie |
| --- | --- |
| erreur de programmation | throw `TypeError` ou `RangeError` |
| contrat d'entree viole | throw si option ou structure obligatoire invalide |
| donnee utilisateur invalide | warning + exclusion ou valeur non calculable explicite |
| donnee historique incomplete | fallback documente + warning si impact |
| regle absente | warning ou `{ value: null }`, pas de taux invente |
| conflit entre regles | warning severity `error`, blocage du calcul concerne |
| valeur non calculable | `null` ou objet avec champ `calculable: false` |
| entree volontairement exclue | warning `info` ou compteur `excludedCount` |
| comportement legacy preserve | warning ou trace avec code legacy |

Interdiction :

- aucun fallback silencieux non documente.

Impact LOT 4B :

- revenus avec montant invalide : exclusion documentee, pas transformation cachee en revenu valide sauf contrat legacy explicite.

## 12. Contrat des warnings

Structure retenue :

```js
{
  code: "INVALID_REVENUE_AMOUNT",
  severity: "warning",
  domain: "revenue",
  field: "amount",
  sourceId: "rev-123",
  details: {
    reason: "not_finite"
  }
}
```

Champs obligatoires :

- `code` ;
- `severity` ;
- `domain`.

Champs facultatifs :

- `field` ;
- `sourceId` ;
- `details`.

Severities autorisees :

- `info` ;
- `warning` ;
- `error`.

Interdits :

- phrase UI traduite ;
- email, nom, adresse, numero fiscal ;
- payload complet ;
- stack trace ;
- objet Supabase complet.

Impact LOT 4B :

- codes possibles : `INVALID_REVENUE_AMOUNT`, `INVALID_REVENUE_DATE`, `REVENUE_OUTSIDE_PERIOD`, `UNKNOWN_REVENUE_CATEGORY`.

## 13. Contrat de trace

Decision :

- trace optionnelle ;
- desactivee par defaut ;
- structuree ;
- jamais persistee par le moteur ;
- differente du log technique et de l'audit.

Option :

```js
{ trace: true }
```

Structure minimale :

```js
{
  step: "revenue.total.include",
  domain: "revenue",
  inputRef: "rev-123",
  operation: "sum",
  valueBefore: 1000,
  valueAfter: 1500,
  ruleId: null,
  metadata: {}
}
```

La trace peut contenir :

- identifiant technique non sensible ;
- operation ;
- montant intermediaire ;
- date canonique ;
- `ruleId` si une regle est appliquee ;
- version de rule set si utile dans les lots fiscaux.

Elle ne contient pas :

- payload complet ;
- texte utilisateur ;
- informations personnelles ;
- logs console.

Impact LOT 4B :

- trace utile pour `include`, `exclude`, `group`.

## 14. Contrat des options

Decision :

- utiliser un objet `options` seulement a partir de deux options ou pour options facultatives ;
- preferer des parametres nommes dans un objet d'entree pour les calculs metier ;
- pas d'objet options universel global ;
- options inconnues ignorees sauf mode de test dedie futur ;
- ne jamais muter les options.

Options autorisees selon domaine :

- primitives money : `invalidValue`, `allowDecimalComma`, `precision`, `strategy` ;
- primitives dates : `policy` ;
- Revenue LOT 4B : `period`, `referenceDate`, `trace`, `includeZero`, `includeNegative`, `categoryMapping`.

Options interdites globales :

- `supabase` ;
- `localStorage` ;
- `window` ;
- `document` ;
- `setState` ;
- `locale` pour calcul metier.

Alternative rejetee :

- un unique `CalculationOptions` contenant toutes les options de tous les domaines.

## 15. Decision sur strict mode

Decision :

- ne pas introduire de `strict` global dans le Calculation Layer.

Justification :

- un mode strict global risque de creer deux moteurs metier ;
- les comportements doivent etre explicites par fonction ou par option ciblee.

Cas autorise :

- une option locale comme `invalidValue: "reject"` ou `includeNegative: false`.

Impact LOT 4B :

- pas de `strict: true` dans les API Revenue.

## 16. Purete et determinisme

Interdictions absolues dans les calculs :

- `Date.now()` ;
- `new Date()` sans argument ;
- `Math.random()` ;
- `crypto.randomUUID()` ;
- `window` ;
- `document` ;
- `navigator` ;
- `localStorage` ;
- `sessionStorage` ;
- `fetch` ;
- Supabase ;
- React state/context/hooks ;
- `Intl.NumberFormat` ;
- locale implicite ;
- timezone implicite non documentee ;
- mutation des arguments ;
- variable globale mutable.

Injection obligatoire :

- `referenceDate` pour aujourd'hui ;
- `currentYear` si seule l'annee est necessaire ;
- rules ou rule set pour les calculs reglementaires ;
- profile normalise ;
- options explicites.

## 17. Immutabilite

Decision :

- aucun argument ne doit etre mute ;
- les tableaux sont parcourus sans tri en place ;
- les objets retournes sont nouveaux ;
- les `Date` recues sont clonees avant manipulation.

Impact LOT 4B :

- `calculateRevenuePeriodMetrics` doit laisser `revenues` intact, ordre compris.

## 18. Relation avec Domain Models

Decision :

- les calculs consomment idealement des Domain Models normalises ;
- les adapters legacy normalisent avant calcul ;
- un calcul peut tolerer une structure incomplete seulement si le contrat le documente ;
- les calculs ne mutent jamais les modeles ;
- les calculs retournent des objets simples, pas des instances de modeles persistants.

Frontiere :

```text
donnees brutes -> adapter legacy -> Domain Model -> calculation input -> calculation result
```

Impact LOT 4B :

- les tests peuvent utiliser `normalizeRevenue`, mais les calculators ne doivent pas devenir des normalisateurs complets.

## 19. Relation avec Rules Engine

Decision :

- `rules` peut etre importe par `calculations` quand un calcul applique une regle ;
- `rules` ne depend jamais de `calculations` ;
- les primitives `money` et `dates` ne dependent pas de `rules` ;
- les calculs fiscaux recoivent de preference une regle resolue ou appellent une fonction `getXRule` clairement identifiee.

Sens autorise :

```text
calculations -> rules
rules -/-> calculations
```

Impact LOT 4B :

- Revenue Calculations ne doit pas importer Rules sauf pour mapping categorie explicitement justifie. Pour LOT 4B, aucune dependance Rules n'est necessaire.

## 20. Relation avec Money

Decision :

- les futurs modules utilisent les primitives LOT 4A au lieu de disperser `Number`, `parseFloat` ou `Math.round` ;
- chaque fallback numerique doit etre nomme ;
- le formatage euros reste hors moteur.

Usages autorises :

- `parseMoneyValue` pour montants d'entree ;
- `toFiniteNumberOrZero` pour parite legacy explicite ;
- `sumMoney` pour aggregations simples ;
- `roundEuro` pour cotisations/CFE dans lots fiscaux ;
- `roundMoney` pour facture dans lot Invoice ;
- `multiplyMoneyByRate` pour appliquer un taux.

Impact LOT 4B :

- `calculateRevenueTotal` peut utiliser `parseMoneyValue` et `sumMoney`.

## 21. Relation avec Dates

Decision :

- les dates metier `YYYY-MM-DD` sont traitees en Local Date ;
- pas de `new Date("YYYY-MM-DD")` ;
- pas de `toISOString().slice(0, 10)` dans les calculs ;
- la date courante est injectee.

Usages autorises :

- `parseLocalDate` pour lire une date ;
- `formatLocalDate` pour sortie canonique technique ;
- `compareLocalDates` pour filtrer une periode ;
- `differenceInCalendarDays` pour ecarts de jours civils ;
- `addCalendarDays` et `addCalendarMonths` quand le lot metier le permet.

Impact LOT 4B :

- filtrage par periode via comparaison Local Date, pas via ISO UTC.

## 22. Architecture des dossiers

Decision retenue : structure hybride sobre, sans restructurer LOT 4A.

Structure actuelle conservee :

```text
src/domain/calculations/
  money.js
  dates.js
  index.js
```

Structure future recommandee :

```text
src/domain/calculations/
  money.js
  dates.js
  revenue/
    index.js
    revenueTotals.js
    revenuePeriods.js
  contributions/
  acre/
  vat/
  deadlines/
```

Alternative A rejetee :

- fichiers plats illimites, risque de dossier confus.

Alternative C complete rejetee maintenant :

- deplacer `money.js` et `dates.js` dans `primitives/` serait du churn sans valeur.

Impact LOT 4B :

- creer seulement `src/domain/calculations/revenue/` si le lot implemente plusieurs responsabilites Revenue.

## 23. Regles de decoupage

Seuils indicatifs :

- moins de 250 lignes : acceptable si responsabilite unique ;
- 250 a 400 lignes : reevaluation obligatoire ;
- plus de 400 lignes : decoupage probablement necessaire.

Critere principal :

- responsabilite, pas nombre de lignes.

Diviser si un fichier melange :

- normalisation legacy ;
- periode ;
- total ;
- groupement ;
- trace ;
- warnings ;
- formules fiscales.

Interdiction :

- un fichier `calculations.js` ou `calculationEngine.js` de 1000 lignes.

## 24. API publique

Decision :

- `src/domain/calculations/index.js` expose seulement les fonctions stables ;
- `src/domain/index.js` peut reexporter l'API publique de domaine ;
- les fonctions internes restent non reexportees depuis le barrel public.

Pour LOT 4B :

- fonctions publiques minimales depuis `revenue/index.js` ;
- reexport depuis `calculations/index.js` seulement si tests verts ;
- pas d'import direct depuis l'UI.

## 25. Exports internes

Decision :

- helpers prives restent dans leur fichier ;
- helpers partages par un sous-domaine peuvent etre exportes depuis un fichier interne non reexporte globalement ;
- pas de barrel circulaire entre `rules/index.js` et `calculations/index.js`.

Impact LOT 4B :

- `revenuePeriods.js` peut exporter vers `revenue/index.js`, mais l'application ne doit pas importer `revenuePeriods.js` directement.

## 26. Import boundaries

Matrice officielle :

| Source | Cible | Autorise | Justification |
| --- | --- | --- | --- |
| Domain Models | Validation/constants | oui | normalisation stable |
| Domain Models | Calculations | non par defaut | eviter boucle modele/calcul |
| Rules Engine | Constants | oui | regles versionnees |
| Rules Engine | Calculations | interdit | eviter dependance circulaire |
| Calculations | Money/Dates | oui | primitives pures |
| Calculations | Domain Models | oui avec prudence | consommer formes normalisees |
| Calculations | Rules | oui pour fiscal | appliquer regles resolues |
| Calculations | React/UI | interdit | purete |
| Calculations | Supabase/localStorage | interdit | adapters |
| Adapters | Calculations | oui | orchestrer entree/sortie |
| UI | Calculations | non direct pour integration future | passer par facade/cas d'usage |
| Tests | Imports directs | oui | caracterisation |

## 27. Role des adapters

Adapters futurs :

- lisent React state via orchestration ;
- lisent localStorage ;
- lisent Supabase ;
- transforment payload DB ;
- convertissent legacy vers Domain Model ;
- resolvent champs historiques ;
- fusionnent cloud/local ;
- deduplient techniquement ;
- injectent `referenceDate` ;
- appellent les calculs ;
- adaptent le resultat pour l'UI.

LOT 4A.5 ne cree aucun adapter.

## 28. Role de la facade future

Decision :

- facade future utile seulement quand plusieurs calculs doivent etre composes ;
- facade = fonction pure, pas classe ;
- elle orchestre, ne lit pas les donnees ;
- elle ne persiste pas ;
- elle ne formate pas ;
- elle ne doit pas devenir `calculateEverything`.

Exemples futurs non implementes :

- `calculateObligationsBaseline` ;
- `calculateBusinessState` ;
- `calculateTodayCalculationInputs`.

Impact LOT 4B :

- aucune facade globale.

## 29. Frontiere avec UI

Le Calculation Layer peut retourner :

- nombre ;
- booleen ;
- code ;
- statut technique ;
- date canonique ;
- warning structure ;
- trace structuree.

Il ne retourne pas :

- symbole euro ;
- phrase traduite ;
- couleur ;
- icone ;
- JSX ;
- toast ;
- libelle marketing ;
- HTML email.

Impact LOT 4B :

- pas de `toLocaleString("fr-FR")`, pas de texte utilisateur.

## 30. Politique d'arrondi

Decision :

- la primitive mathematique existe dans `money.js` ;
- la regle metier choisit quand arrondir ;
- les calculs doivent indiquer si la valeur est brute ou arrondie ;
- ne pas arrondir deux fois sans trace ou test de parite.

Contrats possibles :

```js
{
  rawValue: 123.456,
  roundedValue: 123
}
```

Pour LOT 4B :

- Revenue totals restent des sommes brutes numeriques ;
- aucun arrondi euro fiscal.

## 31. Politique de date

Decision :

- Local Date `YYYY-MM-DD` pour revenus, factures, periodes et echeances civiles ;
- `Date` locale seulement comme outil interne ou retour technique documente ;
- `referenceDate` obligatoire pour toute notion de "aujourd'hui" ;
- timezone metier future a definir seulement si necessaire.

Impact LOT 4B :

- filtrage de revenus par `from` / `to` en `YYYY-MM-DD`.

## 32. Versionnage

Decision :

- ne pas creer de systeme complexe de version de Calculation API maintenant ;
- utiliser la version du Rule Set pour les calculs fiscaux ;
- ajouter `calculationId` et `calculationVersion` seulement aux reports complexes si utile.

Pour LOT 4B :

- pas de version specifique requise ;
- un champ trace `calculationId` peut etre ajoute si trace active.

## 33. Conventions de tests

Types :

- unit tests : formules pures ;
- characterization tests : comportement legacy ;
- parity tests : ancien vs nouveau ;
- golden tests : cas stables importants ;
- contract tests : structure warnings/trace/options ;
- integration tests : futurs branchements ;
- Playwright : parcours visibles.

Convention fichiers :

- court terme : `tests/revenue-calculations.test.js` ;
- si le dossier tests grossit : `tests/calculations/revenue.test.js` dans un lot dedie.

Pour chaque sous-lot :

- purete ;
- immutabilite ;
- valeurs nulles/incompletes ;
- dates locales ;
- erreurs ;
- warnings ;
- trace si option active ;
- absence d'integration applicative.

## 34. Fixtures

Decision :

- commencer avec objets inline ;
- introduire fixtures partagees seulement apres duplication claire ;
- pas de fixtures geantes ;
- pas de donnees personnelles ;
- pas de dates dependantes du jour courant.

Impact LOT 4B :

- fixtures inline pour revenus : zero, negatif, invalide, categories, periodes, legacy local/Supabase.

## 35. Golden tests

Decision :

- pas de golden test dans LOT 4A.5 ;
- golden tests utiles plus tard pour `computeObligations`, Factur-X, ACRE, TVA et echeances ;
- JSON acceptable pour entrees/sorties stables, code preferable tant que les cas sont peu nombreux.

Regle :

- un golden test n'est pas la source metier ;
- toute mise a jour doit documenter pourquoi le resultat change.

Impact LOT 4B :

- pas obligatoire si les tests unitaires couvrent les agregats Revenue.

## 36. Parite legacy

Methode officielle :

1. identifier le calcul legacy ;
2. creer une fixture representative ;
3. appeler l'ancien code quand possible ;
4. creer le calcul pur ;
5. comparer les resultats ;
6. documenter les divergences ;
7. ne pas integrer avant parite ;
8. conserver les anomalies explicitement decidees ;
9. integrer dans un lot separe.

Cas contradictoires :

- conserver les deux chemins tant qu'ils existent ;
- ne jamais corriger un taux ou seuil dans un lot de refactor.

Impact LOT 4B :

- comparer les totals Revenue aux aggregats observes dans `App.jsx`, sans brancher `App.jsx`.

## 37. Strategie d'integration future

Phases :

1. creer calcul pur ;
2. tests unitaires et parite ;
3. adapter de compatibilite ;
4. integration sur un seul consommateur ;
5. validation Playwright ;
6. suppression eventuelle de l'ancien calcul dans un lot separe.

Rollback :

- ancien code reste actif jusqu'a integration explicite ;
- nouveau calcul peut etre supprime sans migration de donnees.

## 38. Performance

Decision :

- lisibilite avant optimisation ;
- parcours unique acceptable pour totals simples ;
- `Map` utile pour groupements par mois ou categorie ;
- pas de memoisation dans le moteur ;
- memoisation eventuelle dans React ou adapter ;
- trace desactivee par defaut pour grandes listes.

Impact LOT 4B :

- un ou deux parcours de tableau sont acceptables si le code reste clair.

## 39. Securite et confidentialite

Ne jamais mettre dans warnings, trace, erreurs ou fixtures :

- nom complet ;
- email ;
- adresse ;
- numero fiscal ;
- informations bancaires ;
- facture complete ;
- payload Supabase complet ;
- note utilisateur libre.

Autorise :

- identifiant technique si deja present et necessaire ;
- montant minimal ;
- date canonique ;
- categorie technique ;
- code de raison.

## 40. Anti-patterns interdits

Interdits :

- `calculateEverything` ;
- gros fichier util generique ;
- options universelles ;
- fallback silencieux ;
- regles fiscales dans l'UI ;
- `Date.now` dans le domaine ;
- `Math.round` disperse ;
- `parseFloat` disperse ;
- `new Date("YYYY-MM-DD")` disperse ;
- trace sous forme de phrases ;
- warnings traduits ;
- imports React ;
- imports Supabase ;
- mutation ;
- dependances circulaires ;
- fichier de 1000 lignes ;
- classe moteur avec etat mutable ;
- acces localStorage ;
- fonction qui calcule et persiste ;
- fonction qui calcule et formate ;
- fonction qui calcule et navigue ;
- fonction multi-domaines sans contrat clair.

## 41. Architecture precise de LOT 4B

Decision :

- LOT 4B = Revenue Calculations pures uniquement.

Inclus :

- total de revenus ;
- filtrage par periode ;
- breakdown par categorie ;
- mois avec donnees ;
- historique mensuel technique ;
- date du premier revenu ;
- jours depuis premier revenu si `referenceDate` injectee.

Exclus :

- cotisations ;
- ACRE ;
- TVA ;
- echeances ;
- declaration ;
- obligations ;
- facture ;
- premium ;
- Today ;
- Supabase/localStorage ;
- UI.

Entrees :

```js
{
  revenues,
  period: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" },
  referenceDate: "YYYY-MM-DD",
  options: {
    trace: false,
    includeZero: true,
    includeNegative: false
  }
}
```

Sorties :

- objets specialises ;
- warnings structures ;
- trace optionnelle.

## 42. Fichiers proposes pour LOT 4B

Fichiers a creer :

```text
src/domain/calculations/revenue/
  index.js
  revenueTotals.js
  revenuePeriods.js

tests/revenue-calculations.test.js
docs/LOT_4B_REVENUE_CALCULATIONS_REPORT.md
```

Fichiers a modifier eventuellement :

- `src/domain/calculations/index.js` pour reexport public si tests verts.

Fichiers a ne pas modifier :

- `src/App.jsx` ;
- `src/utils/obligations.js` ;
- `src/utils/facturx.js` ;
- `src/components/InvoiceGenerator.jsx` ;
- `src/domain/rules/` ;
- Supabase ;
- localStorage ;
- Playwright specs existantes sauf demande explicite.

## 43. Tests obligatoires pour LOT 4B

Tests minimum :

- total tableau vide ;
- total montants valides ;
- montant zero ;
- montant negatif selon contrat choisi ;
- montant invalide avec warning ;
- champs inconnus preserves si objet retourne ;
- absence de mutation du tableau source ;
- filtrage periode inclusive ;
- date invalide exclue ou signalee ;
- dates locales sans decalage ;
- categories `vente`, `service`, inconnue ;
- breakdown mixte ;
- historique mensuel trie sans mutation ;
- mois avec donnees ;
- premier revenu ;
- jours depuis premier revenu avec `referenceDate` injectee ;
- trace active/desactivee ;
- aucune importation React/Supabase/localStorage.

Commandes conseillees :

- `node --test tests/revenue-calculations.test.js` ;
- `node --test tests/calculation-primitives.test.js` ;
- `node --test tests/domain-models.test.js` ;
- `node --test tests/rules-engine.test.js` ;
- `npm run build` ;
- `npm run lint`.

## 44. STOP CONDITIONS LOT 4B

Arreter LOT 4B si :

- un calcul fiscal devient necessaire ;
- une integration App est requise ;
- un acces Supabase/localStorage apparait ;
- une date depend de `Date.now()` ;
- les warnings contiennent des donnees personnelles ;
- le fichier Revenue devient un god object ;
- les calculs veulent corriger une contradiction legacy ;
- la baseline lint augmente ;
- un test de parite App ne peut pas etre defini sans modifier App.

## 45. Questions ouvertes

| Question | Contexte | Risque | Decision temporaire | Blocage | Lot |
| --- | --- | --- | --- | --- | --- |
| Contrat exact des revenus negatifs | `normalizeRevenue` force non negatif mais certains chemins legacy `Number` peuvent accepter negatif | divergence | LOT 4B doit choisir par fonction et tester | non bloquant | LOT 4B |
| Categories Revenue finales | V3 veut activite mixte par encaissement, code utilise `vente`/`service` | mapping incomplet | conserver valeurs existantes | non bloquant | LOT 4B |
| Parite exacte des aggregats App | calculs dans `App.jsx` disperses | oubli possible | tests par fixtures et audit ciblé | non bloquant | LOT 4B |
| Version Calculation API | pas encore de consommateur actif | sur-architecture | reporter | non bloquant | lot facade |
| Format des golden files | pas encore necessaire | maintenance | objets inline | non bloquant | LOT 4C+ |

## 46. Risques residuels

Risques :

- le Calculation Layer n'est pas encore branche ;
- les calculs `App.jsx` restent nombreux ;
- les Rules contiennent encore des fallbacks temporels historiques ;
- Revenue peut sembler simple mais alimente beaucoup d'ecrans ;
- les contradictions legacy ne sont pas corrigees.

Mitigation :

- LOT 4B non branche ;
- tests unitaires ;
- referenceDate injectee ;
- warnings structures ;
- aucun taux/seuil touche.

## 47. Decisions finales

| Sujet | Decision | Alternative rejetee | Impact LOT 4B |
| --- | --- | --- | --- |
| Nommage | `calculateX` pour calculs | `computeX`, `getX` | API Revenue claire |
| Resultats | retours directs ou objets specialises | wrapper universel | pas de lourdeur |
| Erreurs | throw pour programmation, warnings pour donnees | fallback silencieux | exclusions explicites |
| Warnings | `code/severity/domain/field/sourceId/details` | phrases UI | diagnostic stable |
| Trace | optionnelle, structuree | toujours active | cout faible |
| Options | locales par domaine | options globales | pas d'objet magique |
| Strict mode | pas de strict global | deux comportements | coherence |
| Arrondis | choix par regle metier | arrondi disperse | Revenue non arrondi |
| Dates | Local Date + referenceDate | `Date.now` | deterministic |
| Imports | calculations -> rules autorise, inverse interdit | imports croises | pas de cycle |
| Exports | API publique minimale | tout reexporter | surface controlee |
| Dossiers | hybride sobre | restructurer primitives | pas de churn |
| Tests | unit + parity par lot | validation manuelle | securite |
| Fixtures | inline d'abord | fixtures geantes | lisible |
| Golden tests | plus tard | snapshots opaques | maintenance |
| Integration | lot separe | brancher tout de suite | rollback simple |
| Facade | plus tard, fonction pure | classe/service mutable | pas de calculateEverything |
| Classes | fonctions pures | classes moteur | simplicity |
| Versionnage | minimal | systeme complexe | reporter |

## 48. GO / NO-GO LOT 4B

Decision : GO POUR LOT 4B.

Justification :

- une convention coherente est definie ;
- les primitives LOT 4A sont compatibles ;
- aucune dependance circulaire inevitable n'est identifiee ;
- les Domain Models peuvent fournir des entrees stables ;
- la strategie de retour est explicite ;
- la strategie d'erreurs et warnings est explicite ;
- la trace est optionnelle et minimisee ;
- LOT 4B peut etre limite a Revenue Calculations pures ;
- aucune restructuration immediate n'est necessaire ;
- aucune dependance externe n'est requise ;
- aucune integration applicative n'est necessaire pour valider LOT 4B.

Perimetre obligatoire de LOT 4B :

- Revenue Calculations pures ;
- sans React ;
- sans Supabase ;
- sans localStorage ;
- sans UI ;
- sans calcul fiscal ;
- sans branchement applicatif.

Ne pas commencer LOT 4B depuis ce document.
