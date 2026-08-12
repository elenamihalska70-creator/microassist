# LOT 4D.0 - ACRE Gate & Legacy Characterization

Date : 2026-07-30\
Statut : audit preparatoire uniquement\
Decision cible : determiner si LOT 4D.1 peut commencer sans decision metier supplementaire

## 1. Resume executif

Le repository contient deja une logique ACRE active, mais elle est limitee a une reduction legacy :

- activation si `acre === "yes"` et taux standard connu ;
- taux effectif `baseRate / 2` ;
- duree simplifiee de 12 mois depuis `acre_start_date` ;
- retour au taux standard si `acreMonthsLeft <= 0` ;
- aucune verification juridique d'eligibilite ;
- aucun depot de demande ACRE ;
- aucune gestion du changement produit futur au 1er juillet 2026.

La logique officielle legacy est portee par `src/utils/obligations.js#computeObligations` et caracterisee dans `src/domain/rules/acreRules.js#getAcreRule`.

Decision principale :

- GO pour LOT 4D.1 uniquement si le lot reste limite a un calcul ACRE legacy pur, hors integration ;
- NO-GO pour inclure eligibilite juridique, demande ACRE, delai de depot, regle future 2026, TVA, CFE, reserve, deadlines, UI ou modification Contributions/Revenue/Rules.

ACRE peut rester separee de Standard Contributions : Contributions calcule le standard, ACRE applique ensuite une reduction ou un taux effectif, sans dupliquer les agregations Revenue.

## 2. Perimetre

Inclus dans cet audit :

- inventaire des chemins ACRE legacy ;
- inventaire des champs, dates, durees, taux et coefficients ;
- relation avec Rules Engine ;
- frontiere ACRE / Contributions / Revenue ;
- recommandations de contrat, warnings, trace, tests et architecture pour LOT 4D.1.

Exclus :

- aucune implementation ;
- aucun fichier JavaScript ;
- aucun test ;
- aucun export ;
- aucune fixture ;
- aucune modification de regle ;
- aucune correction de taux ;
- aucune integration applicative.

## 3. Sources inspectees

Documents lus ou inspectes :

- `docs/LOT_4_GATE_REVIEW.md` ;
- `docs/LOT_4A_5_CALCULATION_LAYER_ARCHITECTURE.md` ;
- `docs/LOT_4C_0_CONTRIBUTIONS_GATE_REVIEW.md` ;
- `docs/LOT_4C_1_STANDARD_CONTRIBUTION_REPORT.md` ;
- `docs/LOT_4C_2_CONTRIBUTION_AGGREGATIONS_REPORT.md` ;
- `docs/ARCHITECTURE_AUDIT.md` ;
- `docs/LOT_3_RULES_ENGINE_REPORT.md` ;
- `docs/LOT_4_CALCULATION_ENGINE_PLAN.md` ;
- `docs/LOT_2_DOMAIN_MODELS_REPORT.md` ;
- `docs/LOT_0_STABILISATION_REPORT.md` ;
- `docs/MICROASSIST_PRODUCT_VISION_2027.md` ;
- `docs/PRODUCT_BLUEPRINT_V2.md` ;
- `docs/PRODUCT_BLUEPRINT_V3.md` ;
- `docs/IMPLEMENTATION_ROADMAP_V3.md` ;
- `docs/CODING_STANDARDS_V3.md`.

Code inspecte :

- `src/App.jsx` ;
- `src/utils/obligations.js` ;
- `src/domain/rules/` ;
- `src/domain/models/` ;
- `src/domain/calculations/` ;
- `src/domain/constants.js` ;
- `src/config/steps.fiscal.js` ;
- `src/components/` ;
- `src/utils/` ;
- `tests/` ;
- `supabase/migrations/` ;
- `supabase/functions/`.

Recherches effectuees :

- `acre`, `ACRE`, `exoneration`, `exoneration`, `reduction`, `reducedRate`, `acreRate` ;
- `acreStart`, `acreEnd`, `acre_start_date`, `business_start_date`, `activityStartDate`, `startDate` ;
- `eligibility`, `eligible`, `hasAcre`, `acreEligible`, `acreEnabled` ;
- `standardRate`, `contributionRate`, `effectiveRate`, `baseRate` ;
- `0.5`, `50 %`, `12 mois`, `period`, `transition`, `taux reduit`, `taux normal`.

## 4. Inventaire legacy

| ID | Fichier | Fonction ou bloc | Entree | Formule | Taux / coefficient | Dates utilisees | Eligibilite | Duree | Arrondi | Sortie | Consommateur | Statut | Tests | Confiance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACRE-01 | `src/utils/obligations.js` | `computeObligations` bloc ACRE | `answers.acre`, `activity_type`, `ca_month`, `acre_start_date` | si ACRE active : `rate = baseRate / 2` | coefficient implicite `0.5` | `new Date(acre_start_date)`, `new Date()` | recu via `acre === "yes"` | 12 mois | aucun sur taux | `rate`, `estimatedAmount` | dashboard legacy | actif officiel legacy | `rules-engine.test.js` indirect | elevee |
| ACRE-02 | `src/utils/obligations.js` | date fin ACRE | `acre_start_date` | `endDate = startDate + 12 mois` | aucun | `acre_start_date`, date courante | aucune | 12 mois | aucun | `acreEndDate` | labels, alertes | actif | `rules-engine.test.js` indirect | elevee |
| ACRE-03 | `src/utils/obligations.js` | mois restants | `startDate`, `today` | difference annee/mois, puis `12 - monthsSinceStart` | aucun | mois calendaires locaux | aucune | `Math.max(0, ...)` | aucun | `acreMonthsLeft` | labels, statut | actif | `rules-engine.test.js` indirect | elevee |
| ACRE-04 | `src/utils/obligations.js` | expiration | `acreMonthsLeft` | si `<= 0`, retour `rate = baseRate` | aucun | herite ACRE-03 | aucune | seuil `0` | aucun | `acreStatus: "expired"` | dashboard | actif | `rules-engine.test.js` indirect | elevee |
| ACRE-05 | `src/utils/obligations.js` | ACRE sans date | `acre === "yes"`, pas de date | reduction immediate | `baseRate / 2` | aucune | statut recu | illimitee jusqu'a date fournie | aucun | `acreStatus: "active"`, `acreHint` | dashboard | actif avec fallback implicite | `rules-engine.test.js` via rule | elevee |
| ACRE-06 | `src/utils/obligations.js` | ACRE inconnue | `acre === "unknown"` | aucune reduction | aucun | aucune | inconnue | aucune | aucun | `acreHint` seulement | UI | actif pedagogique | aucun direct | moyenne |
| ACRE-07 | `src/utils/obligations.js` | montant cotisation ACRE | `ca`, `rate` | `Math.round(ca * rate)` | taux effectif | aucune date directe | herite ACRE | herite ACRE | euro entier | `estimatedAmount` | dashboard, reserve, labels | actif | `rules-engine.test.js` partiel | elevee |
| ACRE-08 | `src/domain/rules/acreRules.js` | `getAcreRule` | `acre`, `activityType`, `acreStartDate`, `today` | applique `baseRate / 2` | `reductionFactor: 0.5`, `durationMonths: 12` | `acreStartDate`, `today` injecte ou `new Date()` | recu via statut | 12 mois | aucun montant | `effectiveRate`, `acreStatus`, `acreMonthsLeft`, `acreEndDate` | tests et futur calcul | actif Rules | `rules-engine.test.js` | elevee |
| ACRE-09 | `tests/rules-engine.test.js` | tests ACRE | active, expiree, date absente | compare rule vs legacy | demi-taux | dates relatives et `today` injecte | recu | 12 / 13 mois | aucun | assertions | CI | actif | oui | elevee |
| ACRE-10 | `src/App.jsx#getFiscalDateErrors` | validation profil | `business_start_date`, `acre_start_date`, `acre` | controle format, futur, minimum, ACRE >= debut activite | aucun | `getTodayIsoDate()`, `MIN_REALISTIC_FISCAL_DATE` | aucune | aucune | aucun | erreurs UI | onboarding / edition profil | actif UI validation | Playwright indirect | moyenne |
| ACRE-11 | `src/App.jsx#sanitizeFiscalAnswers` | nettoyage profil | `acre`, `acre_start_date` | si `acre !== "yes"`, date ACRE forcee a `null` | aucun | `acre_start_date` normalisee | aucune | aucune | aucun | answers sanitizees | profil local/Supabase | actif adapter UI | aucun direct | moyenne |
| ACRE-12 | `src/App.jsx#buildSmartAlerts` | smart alert ACRE | `answers.acre`, `acre_start_date`, `today` | fin + 12 mois, `daysLeft`, `monthsLeft = ceil(days/30)` | aucun | `getTodayIsoDate()` | recu | alerte <= 2 mois | `Math.ceil` jours/mois | alerte `acre-ending` | Today/dashboard | actif UI | Playwright indirect | moyenne |
| ACRE-13 | `src/App.jsx` daily fiscal tip | coaching ACRE | `dashboardAnswers.acre`, `acre_start_date` | fin + 12 mois, alerte si `daysLeft <= 90` | aucun | `getTodayIsoDate()` | recu | 90 jours | `Math.ceil` jours | tip ACRE | dashboard | actif UI | non direct | moyenne |
| ACRE-14 | `src/App.jsx` reminders list | rappel ACRE | `reminderPrefs.acre`, `dashboardAnswers.acre`, `acre_start_date` | fin + 12 mois, `daysLeft`, `ceil(days/30)` | aucun | `Date.now()` | recu | <=90 jours urgent, >90 actif | `Math.ceil` | items `acre` / `acre-active` | reminders UI | actif UI | non direct | moyenne |
| ACRE-15 | `src/App.jsx` premium contextual trigger | premium ACRE | `acre_start_date`, `Date.now()` | fin + 12 mois, mois restants `ceil(days/30)` | aucun | `Date.now()` | recu | visible si <=2 mois | `Math.ceil` | trigger premium | premium UI | actif product | non direct | faible |
| ACRE-16 | `src/App.jsx` dashboard insight | warning ACRE | `acre_start_date`, `Date.now()` | fin + 12 mois, jours restants | aucun | `Date.now()` | recu | <=90 jours | `Math.ceil` | insight `acre_ending` | dashboard | actif UI | non direct | faible |
| ACRE-17 | `src/App.jsx` PDF/export summary | `computed.acreHint`, `dashboardAnswers.acre` | affiche statut/hint | aucun | aucune | aucune | aucune | aucun | lignes PDF | export | actif affichage | non direct | faible |
| ACRE-18 | `src/config/steps.fiscal.js` | etapes ACRE | choix `acre`, `acre_start_date` | aucun calcul | texte dit 50% | date saisie si `acre === "yes"` | statut declare | aucune | aucun | formulaire | onboarding | actif UI | Playwright indirect | moyenne |
| ACRE-19 | `src/domain/constants.js` | `ACRE_VALUES` | valeurs enum | aucun calcul | aucun | aucune | valeurs `yes/no/unknown/to_request/requested` | aucune | aucun | constantes | models/UI | actif | `domain-models.test.js` partiel | elevee |
| ACRE-20 | `src/domain/models/identity.js` | `normalizeFiscalProfile` | `acre`, `acre_start_date`, `business_start_date` | normalisation date/status | aucun | dates `YYYY-MM-DD` | aucune | aucune | aucun | `acre`, `acreStartDate` | models | actif | `domain-models.test.js` | elevee |
| ACRE-21 | `src/domain/models/calculation.js` | `normalizeCalculationResult` | sortie legacy | normalise `acreStatus`, `acreActive` | aucun | aucune | aucune | aucune | aucun | calculation result | model | actif | `domain-models.test.js` | moyenne |
| ACRE-22 | `docs/MICROASSIST_PRODUCT_VISION_2027.md` | evolution future | `activity_start_date` futur | avant 2026-07-01 demi-taux, apres 75% taux normal | 50% puis 75% du taux normal | date officielle debut activite | ne pas supposer accord | jusqu'a fin T3 civil futur | non code | exigence future | produit | futur, non code | aucun | moyenne |

Conclusion inventaire : ACRE fiscal calcule uniquement un taux effectif legacy. Les autres chemins ACRE sont validations, stockage, labels, alertes, rappels ou premium triggers.

## 5. Placeholders

Placeholders ou elements non officiels identifies :

- `src/config/steps.fiscal.js` contient une aide UI indiquant une reduction de 50% la premiere annee, mais ce n'est pas un calcul ;
- `docs/MICROASSIST_PRODUCT_VISION_2027.md` documente une evolution future au 1er juillet 2026, avec 75% du taux normal et une duree jusqu'a fin du troisieme trimestre civil, mais le code actuel ne l'applique pas ;
- `src/App.jsx` calcule plusieurs alertes ACRE par jours restants et `ceil(days / 30)`, ce sont des signaux UI, pas le calcul fiscal officiel ;
- `getRevenueContributionRate` dans `App.jsx` peut propager ACRE aux previews par categorie via `computed.rate / baseFallbackRate`, mais ce chemin reste UI-adjacent et hors calcul ACRE officiel.

Decision :

- ne pas implementer la regle future 2026 en LOT 4D.1 ;
- ne pas reprendre les alertes UI comme contrat de calcul fiscal ;
- caracteriser le demi-taux legacy seulement.

## 6. Champs ACRE

Champs ACRE trouves :

- `acre` : statut declare par l'utilisateur ou le profil ;
- `hasAcre` : variante lue dans les conflits de profil App, mappee vers `acre` ;
- `acre_start_date` : date de debut ACRE legacy ;
- `acreStartDate` : forme normalisee Domain Models / Rules ;
- `acreActive` : sortie compute/rule ;
- `acreMonthsLeft` : sortie compute/rule ;
- `acreEndDate` : sortie compute/rule ;
- `acreStatus` : sortie compute/rule, ou statut UI ;
- `acreHint` : texte legacy ;
- `reminder_acre` : preference Supabase `fiscal_profiles` ;
- `activity_start_date` : nom futur documente dans Product Vision, non code ;
- `business_start_date` / `businessStartDate` : date de debut activite, utilisee pour validation et CFE, pas pour reduction ACRE legacy ;
- `eligibility_unknown`, `to_apply`, `application_sent`, `pending`, `approved`, `rejected`, `deadline_passed`, `not_eligible` : statuts futurs documentes, non codes.

Champs non trouves comme logique active :

- `acreEligible` ;
- `acreEnabled` ;
- `eligibilityStatus` ;
- `eligible` comme critere ACRE ;
- `reducedRate` ou `acreRate` publics.

## 7. Eligibilite

Le repository ne calcule pas reellement l'eligibilite ACRE.

Le comportement actuel :

- recoit un statut utilisateur/profil (`acre`) ;
- applique la reduction uniquement si `acre === "yes"` ;
- gere `unknown` comme absence de reduction avec information ;
- accepte `to_request` et `requested` comme valeurs de profil/UI, mais `getAcreRule` et `computeObligations` ne les reduisent pas ;
- ne verifie aucun critere juridique ;
- ne verifie pas le delai de 60 jours ;
- ne determine pas automatiquement que l'ACRE est accordee.

Options evaluees :

### Option A - calculer l'eligibilite

Rejetee pour LOT 4D.1. Le repository ne contient pas les criteres juridiques necessaires et le brief interdit d'inventer une decision metier.

### Option B - recevoir l'eligibilite deja decidee

Acceptable pour la parite legacy si `acre === "yes"` signifie accordee/applicable.

### Option C - separer eligibility et calculation

Decision recommandee. LOT 4D.1 doit calculer uniquement l'impact ACRE a partir d'un statut recu. Un futur domaine eligibility pourra traiter demande, delai et statuts avances.

Decision :

- LOT 4D.1 recoit le statut ACRE ;
- LOT 4D.1 ne calcule pas l'eligibilite ;
- un statut inconnu ou demande non confirmee produit resultat standard sans ACRE ou warning.

## 8. Dates

Dates inventoriees :

- `acre_start_date` : declencheur legacy de la periode ACRE ;
- `acreStartDate` : alias normalise ;
- `business_start_date` : date de debut activite, utilisee pour validation et profil, pas pour le demi-taux legacy ;
- `businessStartDate` : alias normalise ;
- `activity_start_date` : futur nom produit possible, non code ;
- `acreEndDate` : sortie calculee comme start + 12 mois ;
- `today` : injecte dans `getAcreRule`, implicite dans `computeObligations` ;
- `referenceDate` : nom recommande pour futur calcul pur ;
- `Date.now()` : utilise dans plusieurs alertes App ;
- `getTodayIsoDate()` : utilise dans validations et certains tips App ;
- dates Revenue, facture, declaration : presentes ailleurs, mais non declencheurs ACRE legacy.

Declencheur de reduction legacy :

- `acre === "yes"` suffit pour activer la reduction si `baseRate > 0` ;
- si `acre_start_date` existe, elle determine l'expiration ;
- si `acre_start_date` manque, la reduction reste active dans legacy.

Limites :

- `getAcreRule` et `computeObligations` calculent les mois restants par difference annee/mois, sans comparer le jour du mois ;
- les alertes UI calculent en jours puis divisent par 30 ;
- les limites inclusives ne sont pas explicitement documentees ;
- la date courante implicite existe encore dans legacy ;
- le fuseau horaire peut influencer `new Date("YYYY-MM-DD")`, `Date.now()` et `toISOString().slice(0, 10)` dans App.

Decision :

- LOT 4D.1 doit injecter `referenceDate` ;
- LOT 4D.1 doit utiliser les primitives Dates LOT 4A seulement si elles reproduisent la parite attendue ;
- ne pas modifier la politique legacy de date dans ce lot.

## 9. Duree

Duree legacy officielle :

- 12 mois depuis `acre_start_date`.

Calcul legacy :

```text
monthsSinceStart =
  (today.year - start.year) * 12 + (today.month - start.month)
acreMonthsLeft = max(0, 12 - monthsSinceStart)
expired si acreMonthsLeft <= 0
```

Caracteristiques :

- granularite mois calendrier ;
- le jour du mois est ignore pour les mois restants ;
- `acreEndDate` est calcule avec `setMonth(+12)` ;
- date absente : ACRE active sans duree certaine ;
- `unknown` : aucune reduction.

Duree UI :

- plusieurs alertes utilisent `daysLeft = ceil((acreEnd - now) / DAY_MS)` ;
- le nombre de mois affiche est souvent `max(1, ceil(daysLeft / 30))` ;
- seuils UI observes : <= 2 mois, <= 90 jours, > 90 jours.

Duree future Product Vision :

- jusqu'a fin du troisieme trimestre civil suivant la date officielle de debut/ouverture ;
- non codee et hors LOT 4D.1.

## 10. Taux et coefficients

Inventaire :

| Valeur | Type | Source | Usage | Statut |
| --- | --- | --- | --- | --- |
| taux standard services | taux base | Contributions / `getContributionRule` / legacy `getRate` | base avant ACRE | actif |
| taux standard commerce | taux base | Contributions / `getContributionRule` / legacy `getRate` | base avant ACRE | actif |
| taux standard mixte | taux base | Contributions / `getContributionRule` / legacy `getRate` | base avant ACRE | actif |
| `baseRate / 2` | formule | `computeObligations`, `getAcreRule` | taux effectif ACRE | actif |
| `0.5` | reductionFactor | `getAcreRule`, docs/tests | coefficient ACRE | actif Rules |
| `50%` | texte produit/UI | `steps.fiscal.js`, docs | explication reduction | actif affichage / docs |
| `75%` | futur produit | Product Vision 2027 | regle future apres 2026-07-01 | non code |
| `25%` exoneration | futur produit | Product Vision 2027 | explication future | non code |

Arrondi :

- taux non arrondi pour le calcul ;
- labels legacy arrondissent `Math.round(rate * 100)` pour afficher un pourcentage ;
- montant final arrondi par `Math.round(ca * rate)`.

Decision :

- LOT 4D.1 ne code aucun taux standard ;
- LOT 4D.1 obtient le standard via Contributions ou via le resultat standard ;
- LOT 4D.1 applique seulement la regle ACRE fournie par Rules Engine.

## 11. Rules Engine

Regle ACRE publique existante :

```js
getAcreRule({
  acre,
  acreStartDate,
  acre_start_date,
  activityType,
  activity_type,
  today
})
```

Sortie :

- `ruleId: "ACRE_CURRENT_12_MONTHS_HALF_RATE"` ;
- `value.reductionFactor: 0.5` ;
- `value.durationMonths: 12` ;
- `output.acreActive` ;
- `output.acreMonthsLeft` ;
- `output.acreEndDate` ;
- `output.acreStatus` ;
- `output.baseRate` ;
- `output.effectiveRate` ;
- `fallback` : `acre_active_without_start_date` ou `acre_unknown_no_rate_reduction` ;
- warnings texte legacy ;
- version via `withRuleTrace`, rule set `microassist-current-baseline`, version `2026-07-29-lot3-baseline`.

Options LOT 4D.1 :

### Option A - importer une regle ACRE directe

Partiellement retenue : le calcul ACRE peut importer `getAcreRule`, avec `today` injecte, pour caracteriser la periode et le taux effectif legacy.

### Option B - obtenir le taux standard via Contributions et appliquer une regle ACRE separee

Decision recommandee. `calculateStandardContribution` fournit la base standard, puis ACRE applique la regle ACRE et calcule le montant reduit ou l'economie.

### Option C - recevoir un coefficient injecte

Rejetee comme API par defaut : elle risquerait de bypasser le Rules Engine.

### Option D - utiliser un ruleset injecte

Rejetee pour LOT 4D.1 : trop large pour le besoin legacy minimal.

Decision :

- LOT 4D.1 doit combiner B + A : standard via Contributions, regle ACRE via `getAcreRule`.

## 12. Frontiere ACRE / Contributions

Responsabilite Contributions :

- calculer la cotisation standard hors ACRE ;
- agreger des cotisations standard ;
- resoudre les taux standard via Rules Engine ;
- conserver la politique d'arrondi standard.

Responsabilite ACRE :

- recevoir un resultat standard ou l'obtenir explicitement ;
- evaluer si ACRE legacy s'applique ;
- calculer un taux/montant reduit ;
- calculer `savedAmount` si necessaire ;
- exposer periode, statut, warnings et trace ACRE ;
- ne pas dupliquer les agregations Revenue.

Decision :

- ACRE doit vivre dans `src/domain/calculations/acre/` ;
- Contributions ne doit pas etre modifie de maniere cassante ;
- ACRE ne doit pas injecter de champs ACRE dans `calculateStandardContribution`.

## 13. Frontiere ACRE / Revenue

Revenue fournit des bases, dates et agregats de chiffre d'affaires.

ACRE ne doit pas :

- lire les revenus ;
- recalculer des periodes Revenue ;
- mapper des categories `vente/service` ;
- decider de la source de la base ;
- acceder a Supabase ou localStorage.

Le futur adapter pourra composer :

```text
Revenue -> Contributions standard -> ACRE
```

LOT 4D.1 doit rester sur une base explicite ou un resultat standard, pas sur une collection Revenue.

## 14. Arrondis

Legacy observe :

- pas d'arrondi du taux ACRE ;
- pas d'arrondi du coefficient ;
- montant ACRE calcule par `Math.round(ca * effectiveRate)` ;
- economie non calculee explicitement dans legacy ;
- labels arrondissent les taux en pourcentage entier ;
- alertes UI arrondissent jours/mois par `Math.ceil`.

Recommandation LOT 4D.1 :

- calculer le montant ACRE en reutilisant la politique euro legacy deja retenue par Contributions ;
- si `applyAcreReduction` recoit un montant standard deja arrondi, calculer le montant reduit depuis `baseAmount * effectiveRate` pour la parite `computeObligations`, pas en divisant le montant standard arrondi ;
- calculer `savedAmount = standardContributionAmount - acreContributionAmount` seulement si utile, apres arrondi des deux montants ;
- documenter `rounding: "nearest_euro_math_round"`.

## 15. Donnees persistees

Donnees persistantes ou quasi persistantes identifiees :

- `localStorage` `microassist_v1.answers` : contient potentiellement `acre`, `acre_start_date`, `business_start_date` ;
- `localStorage` `microassist_profile_v1` : profil simple ;
- `localStorage` `microassist_profile_conflict_strategy` : strategie de conflit profil ;
- table Supabase `fiscal_profiles` : utilisee par App pour `acre`, `acre_start_date`, `business_start_date`, `reminder_acre` ;
- table `reminders` : peut porter des rappels, mais l'Edge Function actuelle ne calcule pas ACRE ;
- Domain Models : `normalizeFiscalProfile` expose `acre`, `acreStartDate`, `businessStartDate`.

Donnees non persistees :

- `acreActive` ;
- `acreMonthsLeft` ;
- `acreEndDate` ;
- `acreStatus` calcule ;
- `acreHint` ;
- montants ACRE calcules.

Decision :

- LOT 4D.1 ne modifie aucune donnee persistee ;
- aucune migration n'est necessaire ;
- aucune cle localStorage ne doit etre creee.

## 16. UI et previews

Surfaces UI ACRE :

- explanation modal ACRE ;
- onboarding `acre` et `acre_start_date` ;
- edition profil ACRE ;
- dashboard profil manquant ;
- smart alerts `acre-ending` ;
- daily fiscal tip ACRE ;
- reminder list ACRE active / fin ACRE ;
- premium contextual trigger ACRE ;
- PDF/export summary affichant `acreHint` ;
- CSS `.acreExpirationWarning`.

Previews liees :

- `getRevenueContributionRate` peut propager un taux ACRE via `computed.rate / baseFallbackRate` ;
- `previewCharges` et notice de sauvegarde peuvent donc afficher une estimation reduite ;
- ce chemin est UI-adjacent et non officialise comme moteur ACRE.

Decision :

- aucun comportement UI ne doit etre modifie en LOT 4D.1 ;
- les alertes ACRE doivent rester caracterisees, pas branchees.

## 17. Tests historiques

Tests existants :

- `tests/rules-engine.test.js` couvre ACRE active, expiree, date absente, date frontiere avec `today` injecte, `unknown` ;
- `tests/domain-models.test.js` couvre normalisation `acre_start_date` vide/invalide ;
- Playwright couvre les surfaces publiques/auth, pas les montants ACRE de maniere fine.

Tests manquants :

- calcul ACRE pur par base et activite ;
- parite `computeObligations` sur montant ACRE ;
- base nulle ;
- base negative ;
- date invalide ;
- statut `to_request` / `requested` ;
- activite inconnue ;
- regle ACRE absente ;
- regle contribution standard absente ;
- frontieres jour/mois exactes ;
- absence de mutation ;
- warnings structures ;
- trace active/desactivee.

## 18. Divergences legacy

Divergences a documenter :

- calcul fiscal ACRE : mois restants par difference annee/mois ;
- UI alerts : jours restants puis division par 30 ;
- `computeObligations` utilise `new Date()` implicite ;
- `getAcreRule` accepte `today` injecte mais retombe sur `new Date()` ;
- `computeObligations` applique ACRE sans date si `acre === "yes"` ;
- Product Vision future demande une date officielle d'ouverture et une regle 2026 differente, non codee ;
- `business_start_date` valide `acre_start_date` mais ne pilote pas la reduction legacy ;
- `to_request` et `requested` existent comme statuts UI, mais ne reduisent pas les cotisations ;
- `getRevenueContributionRate` peut appliquer un facteur ACRE aux previews par categorie, alors que Contributions standard 4C l'exclut.

Decision :

- reproduire uniquement le comportement fiscal legacy ;
- ne pas corriger la divergence mois/jours en LOT 4D.1 ;
- ne pas integrer la regle future sans lot dedie.

## 19. Contrat d'entree recommande

Options evaluees :

### Option A

```js
calculateAcreContribution({
  baseAmount,
  activityType,
  referenceDate,
  acreStartDate
}, options)
```

Avantages :

- simple pour parite legacy ;
- proche de `computeObligations`.

Limites :

- risque de dupliquer `calculateStandardContribution` ;
- melange standard et reduction si mal implemente ;
- ne clarifie pas le statut ACRE complet.

Decision : acceptable seulement si la fonction appelle `calculateStandardContribution` en interne.

### Option B

```js
applyAcreReduction(
  standardContributionResult,
  acreContext,
  options
)
```

Avantages :

- separation nette des responsabilites ;
- reutilise Contributions ;
- evite de resoudre deux fois la base standard ;
- facilite trace et tests unitaires ;
- compatible avec agregations futures.

Limites :

- l'appelant doit deja avoir un resultat standard ;
- il faut s'assurer que le taux effectif Rules reste coherent avec le standard.

Decision : recommandee comme coeur pur.

### Option C

```js
calculateContributionWithAcre(
  contributionInput,
  acreContext,
  options
)
```

Avantages :

- ergonomique pour adapter futur.

Limites :

- facade composee trop tot ;
- risque d'etre confondu avec Contributions standard.

Decision : possible helper plus tard, pas premier export 4D.1.

Contrat recommande LOT 4D.1 :

```js
applyAcreReduction(
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

Option acceptable si le lot veut une seule fonction publique :

```js
calculateAcreContribution(
  {
    baseAmount,
    activityType,
    acre,
    acreStartDate,
    referenceDate
  },
  options
)
```

Cette fonction doit appeler `calculateStandardContribution`.

## 20. Contrat de sortie recommande

Objet specialise recommande :

```js
{
  baseAmount,
  activityType,
  referenceDate,
  standardRate,
  standardContributionAmount,
  acreApplied,
  acreRate,
  reductionRate,
  acreContributionAmount,
  savedAmount,
  acrePeriod,
  acreStatus,
  acreMonthsLeft,
  ruleId,
  rounding,
  calculable,
  warnings,
  trace
}
```

Notes :

- `acreRate` correspond au taux effectif ACRE ;
- `reductionRate` correspond au coefficient de reduction/exoneration documente par la regle ;
- `acreContributionAmount` est le montant apres ACRE ;
- si ACRE non active, le montant ACRE doit egaler le standard ou etre clairement nomme `finalContributionAmount` selon decision LOT 4D.1 ;
- `savedAmount` doit rester numerique, sans format euro.

## 21. Erreurs

Cas `throw` recommandes :

- entree non objet ;
- `standardContributionResult` absent ou structurellement invalide pour Option B ;
- options structurellement invalides ;
- resolver Rules injecte non fonction ;
- resolver qui retourne une forme non objet en mode test strict.

Cas warning :

- date ACRE invalide ;
- date de reference invalide ;
- contexte ACRE manquant ;
- ACRE inconnue ;
- ACRE non active ;
- periode expiree ;
- regle ACRE absente ;
- taux ACRE invalide ;
- standard non calculable ;
- statut `to_request` / `requested` non applique.

Cas resultat standard sans ACRE :

- `acre` absent, `no`, `unknown`, `to_request`, `requested` ;
- ACRE expiree ;
- activite inconnue ou taux standard nul ;
- date invalide si le lot choisit fallback non bloquant.

Cas resultat zero :

- base standard zero ;
- standard non calculable avec montant zero ;
- regle absente si aucun taux ne peut etre determine.

Cas NO-GO :

- besoin d'inventer l'eligibilite ;
- besoin d'une source juridique externe ;
- besoin de modifier Rules ou Contributions ;
- besoin d'une migration ;
- besoin d'integrer App.

## 22. Warnings

Codes proposes :

- `INVALID_ACRE_START_DATE` ;
- `INVALID_ACRE_REFERENCE_DATE` ;
- `MISSING_ACRE_CONTEXT` ;
- `ACRE_NOT_ACTIVE` ;
- `ACRE_PERIOD_EXPIRED` ;
- `ACRE_RULE_NOT_FOUND` ;
- `INVALID_ACRE_RATE` ;
- `UNKNOWN_ACRE_ELIGIBILITY` ;
- `ACRE_STATUS_NOT_CONFIRMED` ;
- `STANDARD_CONTRIBUTION_NOT_CALCULABLE` ;
- `LEGACY_ACRE_PLACEHOLDER` ;
- `ACRE_FUTURE_RULE_EXCLUDED`.

Structure :

```js
{
  code,
  severity,
  domain: "acre",
  field,
  sourceId,
  details
}
```

Interdits :

- texte UI ;
- payload profil complet ;
- payload Supabase ;
- nom, email, note utilisateur ;
- montant formate avec symbole euro.

## 23. Trace

Trace recommandee :

- desactivee par defaut ;
- active avec `trace: true` ;
- aucune persistence ;
- aucun `console.log` ;
- sans donnees personnelles.

Steps proposes :

- `acre.input.normalize` ;
- `acre.standard.read` ;
- `acre.rule.resolve` ;
- `acre.period.evaluate` ;
- `acre.amount.calculate` ;
- `acre.amount.round` ;
- `acre.result.finalize`.

Details possibles :

- `baseAmount` ;
- `activityType` ;
- `referenceDate` ;
- `acreStartDate` ;
- `standardRate` ;
- `effectiveRate` ;
- `standardContributionAmount` ;
- `acreContributionAmount` ;
- `savedAmount` ;
- `ruleId`.

## 24. Parite

Fixtures obligatoires LOT 4D.1 :

| Fixture | Legacy attendu | Decision |
| --- | --- | --- |
| services 1000, ACRE yes sans date | `rate 0.11`, `estimatedAmount 110`, `acreStatus active`, fallback a documenter | reproduire |
| services 1000, ACRE yes date aujourd'hui | demi-taux, 12 mois restants | reproduire |
| services 1000, ACRE yes il y a 13 mois | taux standard, statut expired | reproduire |
| commerce 1000, ACRE yes | demi-taux commerce legacy | reproduire |
| mixte 1000, ACRE yes | demi-taux mixte legacy | reproduire |
| unknown activity 1000, ACRE yes | taux 0, pas ACRE active car baseRate 0 | reproduire |
| ACRE no | taux standard | reproduire |
| ACRE unknown | taux standard + warning/info | reproduire |
| base nulle | montant 0 | reproduire |
| base negative | legacy peut produire montant negatif si ACRE active | caracteriser avant integration |
| date invalide | legacy `new Date` peut produire invalid date et effets a caracteriser | decision avant code final |
| date limite 12 mois exacts | statut expired selon mois restants | reproduire si scope legacy |
| statuts `to_request` / `requested` | pas de reduction | caracteriser |
| regle ACRE absente | warning, standard sans ACRE | futur test injection |
| divergence UI jours / Rules mois | ne pas reproduire dans calcul fiscal | documenter |

Ne pas importer `App.jsx`.

## 25. Architecture LOT 4D.1

Structure minimale recommandee :

```text
src/domain/calculations/acre/
  index.js
  calculateAcreContribution.js

tests/
  acre-contribution.test.js

docs/
  LOT_4D_1_ACRE_CONTRIBUTION_REPORT.md
```

Imports autorises :

- `src/domain/calculations/contributions/` pour `calculateStandardContribution` ou resultats standards ;
- `src/domain/rules/acreRules.js` pour `getAcreRule` ;
- `src/domain/calculations/money.js` pour l'arrondi si besoin de parite ;
- `src/domain/calculations/dates.js` si compatible avec la parite ;
- aucun React, Supabase, localStorage, DOM, App.

Relation avec Contributions :

- Contributions reste standard ;
- ACRE compose avec Contributions ;
- aucun export global depuis `src/domain/calculations/index.js` ou `src/domain/index.js` sans decision explicite.

Ne pas proposer :

- integration App.jsx ;
- facade globale ;
- TVA ;
- deadlines ;
- obligations ;
- simulation UI.

## 26. API publique proposee

Export public exact propose depuis `src/domain/calculations/acre/index.js` :

- `applyAcreReduction`.

Alternative acceptable si besoin d'une API autonome :

- `calculateAcreContribution`.

Ne pas exporter :

- helpers internes de warning ;
- helpers de date ;
- constants de taux ;
- resolver prive ;
- facade `calculateContributionWithAcre` en 4D.1.

Pas de reexport depuis :

- `src/domain/calculations/index.js` ;
- `src/domain/index.js`.

## 27. Tests proposes

Tests unitaires minimum :

- API publique exacte ;
- ACRE active services ;
- ACRE active commerce ;
- ACRE active mixte ;
- ACRE inactive ;
- ACRE unknown ;
- statuts `to_request` / `requested` ;
- date absente ;
- date invalide ;
- date aujourd'hui avec `referenceDate` injectee ;
- date expiree 13 mois ;
- date limite 12 mois ;
- activite inconnue ;
- base nulle ;
- base negative caracterisee ;
- standard non calculable ;
- regle ACRE absente ;
- taux ACRE invalide ;
- warnings structures ;
- trace off/on ;
- immutabilite entree/options/rule ;
- determinisme ;
- parite `computeObligations` hors App.

Commandes futures conseillees :

- `node --test tests/acre-contribution.test.js` ;
- `node --test tests/standard-contribution.test.js` ;
- `node --test tests/contribution-aggregations.test.js` ;
- `node --test tests/rules-engine.test.js` ;
- `node --test tests/calculation-primitives.test.js` ;
- `node --test tests/domain-models.test.js` ;
- `npm run build` ;
- `npm run lint` ;
- `npx playwright test --reporter=line` si integration ulterieure.

## 28. Risques

Risques LOT 4D.1 :

- confondre statut declare et eligibilite juridique ;
- appliquer la regle future 2026 trop tot ;
- remplacer le demi-taux legacy pour tous les utilisateurs ;
- utiliser `business_start_date` au lieu de `acre_start_date` sans decision ;
- changer la granularite mois/jours ;
- diviser un montant standard deja arrondi au lieu de recalculer depuis la base ;
- propager les previews UI comme contrat officiel ;
- introduire une dependance App ou Revenue ;
- modifier Contributions de maniere cassante.

Mitigations :

- scope legacy explicite ;
- `referenceDate` injectee ;
- parite `computeObligations` ;
- Rules Engine comme source de la regle ACRE ;
- aucun branchement applicatif ;
- rapport 4D.1 obligatoire.

## 29. Questions ouvertes

Questions non bloquantes pour un LOT 4D.1 legacy reduit :

- faut-il nommer le montant final `acreContributionAmount` ou `finalContributionAmount` ?
- faut-il exporter seulement `applyAcreReduction` ou aussi `calculateAcreContribution` ?
- faut-il exposer `acreEndDate` comme `Date` ou `YYYY-MM-DD` ?
- faut-il caracteriser exactement les dates invalides legacy ou les traiter comme warning non calculable ?

Questions bloquantes si le scope s'elargit :

- quelle date officielle doit remplacer `acre_start_date` pour la regle future ?
- comment representer les statuts eligibility/demande ?
- faut-il implementer la regle 2026 maintenant ?
- faut-il verifier les criteres juridiques ?
- faut-il consulter une source externe ?

Decision : ne pas elargir LOT 4D.1.

## 30. Decisions obligatoires

| Sujet | Decision retenue | Justification | Alternative rejetee | Impact LOT 4D.1 |
| --- | --- | --- | --- | --- |
| Eligibilite | recue, non calculee | aucun critere juridique code | inventer eligibility | scope legacy |
| Statut applique | `acre === "yes"` | parite computeObligations | appliquer `requested` | tests clairs |
| Date | `acreStartDate` / `acre_start_date` | source legacy | basculer vers activity_start_date | futur lot |
| Reference date | injectee | determinisme | `new Date()` implicite | tests stables |
| Duree | 12 mois legacy | Rules actuel | fin T3 civil future | parite |
| Coefficient | Rules ACRE | pas de taux hardcode dans calcul | constante locale | source unique |
| Standard | via Contributions | evite duplication | recalcul taux standard dans ACRE | separation |
| Arrondi | euro Math.round parity | cohérent 4C | centimes ou division montant arrondi | parite |
| UI alerts | exclues | jours/30 divergent | fusionner alertes et calcul | purete |
| Revenue | exclu | base explicite | lire revenus | decouplage |
| App | exclu | integration separee | brancher dashboard | rollback |
| Future 2026 | exclue | non code, decision metier | remplacer coefficient | evite regression |

## 31. Stop conditions

LOT 4D.1 doit passer NO-GO si :

- l'eligibilite doit etre inventee ;
- la date de debut applicable doit devenir `activity_start_date` sans decision ;
- la duree legacy 12 mois doit etre remplacee ;
- la regle ACRE est absente ou doit etre modifiee ;
- un taux ou coefficient doit etre code en dur hors Rules ;
- Contributions doit etre modifie de maniere cassante ;
- Revenue doit etre modifie ;
- App.jsx est necessaire ;
- une migration est necessaire ;
- une source juridique externe est necessaire ;
- les comportements legacy UI et fiscal ne peuvent pas etre separes ;
- la baseline lint augmente ;
- un test existant echoue.

## 32. GO / NO-GO LOT 4D.1

Decision : GO POUR LOT 4D.1, avec perimetre strictement reduit.

Contenu autorise :

- creer un domaine pur `src/domain/calculations/acre/` ;
- appliquer la regle ACRE legacy caracterisee ;
- reutiliser Standard Contributions ;
- importer `getAcreRule` ;
- injecter `referenceDate` ;
- tester la parite `computeObligations` hors App ;
- produire warnings et trace optionnelle ;
- creer un rapport LOT 4D.1.

Contenu interdit :

- calculer l'eligibilite juridique ;
- implementer la regle future 2026 ;
- calculer le delai de depot de demande ACRE ;
- modifier Rules Engine ;
- modifier Contributions ;
- modifier Revenue ;
- modifier App.jsx ;
- ajouter TVA, CFE, reserve, deadlines, obligations ou UI ;
- ajouter une migration ou une cle localStorage.

Justification :

- la regle ACRE legacy existe deja dans le Rules Engine ;
- le comportement historique est suffisamment caracterise pour un calcul pur reduit ;
- l'eligibilite et la reforme future peuvent etre separees ;
- ACRE peut composer avec Contributions sans casser le standard ;
- aucune source externe n'est requise pour reproduire le legacy.

Confirmations :

- un seul fichier cree ;
- aucun fichier source modifie ;
- aucun test modifie ;
- aucun document existant modifie ;
- aucun export modifie ;
- aucune dependance installee ;
- aucun calcul ACRE cree ;
- aucun taux modifie ;
- aucune regle modifiee ;
- aucune integration `App.jsx` ;
- aucune modification Contributions ;
- aucune modification Revenue ;
- aucune donnee persistee modifiee ;
- aucun payload Supabase modifie ;
- aucune cle localStorage modifiee ;
- aucun comportement visible modifie.

GO POUR LOT 4D.1
