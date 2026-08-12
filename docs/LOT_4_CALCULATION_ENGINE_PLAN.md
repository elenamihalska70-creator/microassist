# LOT 4 - Calculation Engine Plan

Date : 2026-07-29\
Branche : `refactor/saas-shell-v2`\
Statut d'entree : GO POUR LOT 4 - preparation uniquement\
Perimetre : analyse et plan. Aucune implementation LOT 4.

## 1. Decision De Perimetre

Ce document prepare LOT 4 sans creer le Calculation Engine.

Interdictions respectees pour cette etape :

- aucun fichier source modifie ;
- aucun test modifie ;
- aucun fichier `src/domain/rules/` modifie ;
- aucun dossier `src/domain/calculations/` cree ;
- aucun calcul deplace ;
- aucun comportement utilisateur modifie ;
- aucun payload localStorage, sessionStorage ou Supabase modifie.

LOT 4 devra extraire des fonctions pures de calcul, en s'appuyant sur les Domain Models de LOT 2 et les Rules de LOT 3, sans corriger les valeurs historiques.

## 2. Sources Lues

Documents de reference :

- `docs/MICROASSIST_PRODUCT_VISION_2027.md`
- `docs/MICROASSIST_DESIGN_PRINCIPLES.md`
- `docs/UX_BLUEPRINT_V3.md`
- `docs/PRODUCT_BLUEPRINT_V3.md`
- `docs/IMPLEMENTATION_ROADMAP_V3.md`
- `docs/CODING_STANDARDS_V3.md`
- `docs/ARCHITECTURE_AUDIT.md`
- `docs/LOT_0_STABILISATION_REPORT.md`
- `docs/LOT_0_1_ROUTING_READINESS_REPORT.md`
- `docs/LOT_1_ROUTING_REPORT.md`
- `docs/LOT_2_DOMAIN_MODELS_REPORT.md`
- `docs/LOT_3_RULES_ENGINE_REPORT.md`

Code de reference :

- `src/domain/`
- `src/domain/models/`
- `src/domain/rules/`
- `src/utils/obligations.js`
- `src/utils/facturx.js`
- `src/App.jsx`
- `src/components/InvoiceGenerator.jsx`
- `src/components/ExpertDashboard.jsx`
- `src/config/accessMatrix.js`
- `src/config/pricing.js`
- `supabase/functions/send-reminder/index.ts`
- `supabase/functions/send-trial-ending-email/index.ts`
- `tests/domain-models.test.js`
- `tests/rules-engine.test.js`

## 3. Situation Actuelle

`src/utils/obligations.js` contient le calcul fiscal principal via `computeObligations`.

`src/App.jsx` contient encore :

- l'appel a `computeObligations` ;
- les agregats de revenus ;
- les previsualisations de charges dans la modale revenu ;
- les signaux Today ;
- les triggers premium ;
- les calculs de trial ;
- les labels et formats affiches ;
- certains helpers facture ;
- des validations de dates fiscales.

`src/utils/facturx.js` contient les calculs facture HT, TVA, TTC, score de conformite et format XML.

`src/components/InvoiceGenerator.jsx` et `src/components/ExpertDashboard.jsx` reproduisent des calculs facture/date/formatage utiles a isoler plus tard, mais pas en premier.

Les Edge Functions contiennent des calculs de rappels et un seuil TVA email simplifie. Ces calculs ne doivent pas etre modifies par LOT 4 sans lot Supabase dedie.

## 4. Frontiere Rules / Calculations / UI

Definitions a conserver :

- Rule Engine : fournit les valeurs et decisions applicables, versionnees et tracees. Exemple : taux services `0.22`, seuil TVA services `36800`, echeance mensuelle "dernier jour du mois suivant".
- Calculation Engine : applique ces regles a des donnees d'entree pour produire des nombres, dates et statuts purs. Exemple : `estimatedAmount = Math.round(ca * rate)`.
- Aggregation Engine : calcule des sommes depuis des collections locales. Exemple : CA du mois courant, CA YTD, historique mensuel.
- Presentation/UI : transforme les sorties en libelles, alertes ordonnees, messages et composants.
- Persistence/Effects : lit ou ecrit Supabase, localStorage, sessionStorage, PDF, XML, email ou navigation.

LOT 4 doit prioriser les fonctions Calculation et Aggregation pures. Les messages UI et les effets restent dans l'application jusqu'a un lot ulterieur.

## 5. Inventaire Des Calculs

| ID | Famille | Calcul actuel | Source actuelle | Nature | Destination LOT 4 |
| --- | --- | --- | --- | --- | --- |
| A-01 | Revenus | Somme des revenus visibles en CA courant | `src/App.jsx:5394` | aggregation | extraire totaux revenus |
| A-02 | Revenus | Somme vente/service pour activite mixte | `src/App.jsx:5400` | aggregation | extraire breakdown revenus |
| A-03 | Revenus | CA YTD filtre sur annee courante | `src/App.jsx:5480` environ | aggregation | extraire avec date injectee |
| A-04 | Revenus | Nombre de mois avec donnees | `src/App.jsx:5490` environ | aggregation | extraire avec date locale |
| A-05 | Revenus | Historique mensuel trie | `src/App.jsx:5649` | aggregation/UI-adjacent | extraire noyau, garder labels UI |
| A-06 | Revenus | Moyenne mensuelle historique | `src/App.jsx:5719` | calculation | extraire apres A-05 |
| A-07 | Revenus | Premier revenu et jours depuis premier revenu | `src/App.jsx:5730` environ | calculation/date | extraire avec clock injectee |
| A-08 | Revenus | Condition projection annuelle : `revenues.length >= 5` et `daysSinceFirstRevenue >= 7` | `src/App.jsx:5748` | UX gate | conserver temporairement UI |
| A-09 | Revenus | Parsing montant revenu avec virgule | `src/App.jsx:5601` | normalization/calculation input | extraire seulement si parity testee |
| B-01 | Cotisations | Taux services/commerce/mixte/fallback 0 | `src/utils/obligations.js:getRate` | rule lookup + calc input | utiliser Rules LOT 3 |
| B-02 | Cotisations | Taux effectif ACRE ou taux base | `src/utils/obligations.js:computeObligations` | calculation | extraire dans contribution calculator |
| B-03 | Cotisations | Montant estime `Math.round(ca * rate)` | `src/utils/obligations.js` | calculation | extraire en premier |
| B-04 | Cotisations | Tresorerie recommandee = montant estime | `src/utils/obligations.js` | calculation simple | extraire avec B-03 |
| B-05 | Cotisations | Charges annuelles = charges mensuelles * 12 | `src/utils/obligations.js` | calculation | extraire avec projection annuelle |
| B-06 | Cotisations | Net annuel = CA annuel - charges annuelles | `src/utils/obligations.js` | calculation | extraire avec B-05 |
| B-07 | Cotisations | Taux onboarding simple 22/12/17 | `src/App.jsx:509` | rule duplicate | ne pas fusionner avant decision |
| B-08 | Cotisations | Previsualisation charges revenu par categorie | `src/App.jsx:2159`, `5606`, `5626`, `9498` | calculation/UI-adjacent | extraire apres parite |
| C-01 | ACRE | Activation si `acre === "yes"` et taux base > 0 | `src/utils/obligations.js` | calculation from rule | extraire |
| C-02 | ACRE | Reduction `baseRate / 2` | `src/utils/obligations.js` | calculation | extraire |
| C-03 | ACRE | Date de fin `startDate + 12 mois` | `src/utils/obligations.js` | date calculation | extraire avec clock/date adapter |
| C-04 | ACRE | Mois restants par difference annee/mois | `src/utils/obligations.js` | date calculation | extraire tel quel |
| C-05 | ACRE | Statut expire si mois restants <= 0 | `src/utils/obligations.js` | calculation | extraire |
| C-06 | ACRE | Alerte fin ACRE <= 2 mois | `src/App.jsx:1981`, `docs LOT3` | UI signal | conserver temporairement UI |
| D-01 | TVA | Projection annuelle YTD moyenne | `src/utils/obligations.js` | calculation | extraire |
| D-02 | TVA | Projection fallback `ca_month * 12` | `src/utils/obligations.js` | calculation | extraire |
| D-03 | TVA | Seuils 36800/91900/36800 | `src/utils/obligations.js`, `src/domain/rules/vatRules.js` | rule lookup | utiliser Rules LOT 3 |
| D-04 | TVA | Ratio projection/seuil | `src/utils/obligations.js` | calculation | extraire |
| D-05 | TVA | Statut `ok/soon/exceeded`, proximite 0.8 | `src/utils/obligations.js` | calculation from rule | extraire |
| D-06 | TVA | Urgence `late/soon/null` | `src/utils/obligations.js` | calculation/status | extraire |
| D-07 | TVA | Alerte onboarding simple > 36800 ou > 30000 | `src/App.jsx:673` | UI signal + rule duplicate | conserver temporairement |
| D-08 | TVA | Seuil email Edge `activity_type === "vente" ? 91900 : 36800` | `supabase/functions/send-reminder/index.ts:138` | edge calculation | exclure LOT 4 frontend |
| E-01 | Echeances | Dernier jour du mois suivant | `src/utils/obligations.js` | date calculation | extraire avec date locale |
| E-02 | Echeances | Trimestres fixes 30/04, 31/07, 31/10, 31/01 | `src/utils/obligations.js` | date calculation | extraire |
| E-03 | Echeances | `daysLeft = Math.ceil(diffMs / DAY_MS)` | `src/utils/obligations.js` | date calculation | extraire |
| E-04 | Echeances | Urgence deadline : retard ou <= 7 jours | `src/utils/obligations.js` | calculation/status | extraire |
| E-05 | Echeances | Period label mensuel/trimestriel | `src/utils/obligations.js` | presentation-adjacent | conserver ou extraire en formatter separe |
| E-06 | Echeances | Rappels declaration J-2/J-7 | `src/App.jsx`, Edge Functions | effect trigger | pas dans LOT 4 core |
| E-07 | Echeances | Trial days left, ceil diff et min 0 | `src/App.jsx:1186` | product calculation | extraire dans premium/date calculator |
| E-08 | Echeances | Fenetre trial inscription 14/90 jours | `src/App.jsx:1210` environ | product calculation | extraire apres parite |
| F-01 | Factures | TVA facture standard 20%, sinon 0 | `src/utils/facturx.js:19` | rule lookup/calculation | utiliser Rules LOT 3 |
| F-02 | Factures | Arrondi monetaire a 2 decimales | `src/utils/facturx.js:24` | calculation utility | extraire strategy partagee |
| F-03 | Factures | Totaux HT/TVA/TTC avec exemption | `src/utils/facturx.js:28` | calculation | extraire apres fiscal core |
| F-04 | Factures | Brouillon Factur-X clamp quantite/prix a >= 0 | `src/utils/facturx.js:168` | calculation + normalization | extraire avec test negatif |
| F-05 | Factures | Score conformite `Math.round(passed / total * 100)` | `src/utils/facturx.js:87` | calculation/status | extraire plus tard |
| F-06 | Factures | Statut paiement paid/unpaid | `src/App.jsx:748` | calculation/status | extraire avec invoice calculator |
| F-07 | Factures | Date echeance facture +30 jours | `src/components/InvoiceGenerator.jsx:36`, `src/App.jsx:766`, `src/components/ExpertDashboard.jsx:108` | date calculation duplicate | extraire avec strategie timezone |
| F-08 | Factures | Montant preview facture `quantity * unitPrice` | `src/components/InvoiceGenerator.jsx:280` | calculation | extraire apres F-03 |
| F-09 | Factures | Affichage HT/TTC selon exemption | `src/App.jsx:752` | presentation-adjacent | garder formatter separe |
| G-01 | Premium | Profil acces depuis matrice | `src/config/accessMatrix.js` | rule/config selection | deja Rules LOT 3, pas calculation core |
| G-02 | Premium | Limites pricing/export | `src/config/pricing.js`, `src/App.jsx:3707`, `9671` | product calculation | extraire apres fiscal core |
| G-03 | Premium | Usage export mensuel legacy number/object | `src/App.jsx:1152` | normalization + aggregation | garder hors calcul fiscal |
| G-04 | Premium | Trigger premium trial/deadline/revenus/inactivite | `src/App.jsx:1268` | product calculation | extraire plus tard |
| H-01 | Today | Smart alert prioritaire TVA depassee | `src/App.jsx:1981` | UI decision | conserver temporairement UI |
| H-02 | Today | Smart alert ACRE ending | `src/App.jsx:1981` | UI decision + date calc | extraire date seulement |
| H-03 | Today | Reserve low : disponible < charges estimees | `src/App.jsx:2029` | UI decision | conserver temporairement |
| H-04 | Today | Smart priorities deadline <= 2 jours | `src/App.jsx:2067` | UI decision | conserver temporairement |
| H-05 | Today | Fiscal score par tranches de 20 points | `src/App.jsx:7252` | UX/product score | pas premier LOT 4 |
| H-06 | Today | Reserve recommandee `Math.max(estimatedCharges * 3, 500)` | `src/App.jsx:6338` | product calculation | extraire apres B |
| I-01 | Autres | CFE premiere annee, seuil CA > 5000, paliers 75/150/250/400/600 | `src/utils/obligations.js` | calculation approximative | extraire mais signaler non verifie |
| I-02 | Autres | Sante financiere ratio CA/depenses et epargne recommandee | `src/utils/obligations.js` | product calculation | extraire apres fiscal core |
| I-03 | Autres | Validation dates fiscales min/futur/ACRE >= debut activite | `src/App.jsx:1936` | validation | hors Calculation Engine core |
| I-04 | Autres | Formatage devise `toLocaleString("fr-FR")`, XML `toFixed(2)` | `src/App.jsx`, `src/utils/facturx.js` | presentation/serialization | extraire seulement en formatter dedie |

Total inventorie : 50 calculs ou decisions derivees.

## 6. Classification Par Famille

A. Revenus :

- total courant ;
- CA annuel YTD ;
- mois suivis ;
- breakdown mixte ;
- historique mensuel ;
- moyenne mensuelle ;
- signaux de maturite des donnees.

B. Cotisations :

- taux base ;
- taux effectif ACRE ;
- montant estime ;
- tresorerie a reserver ;
- charges annuelles ;
- preview par revenu.

C. ACRE :

- statut actif/inactif/expire ;
- date de fin ;
- mois restants ;
- reduction appliquee ;
- signaux de fin prochaine.

D. TVA :

- projection annuelle ;
- seuil applicable ;
- ratio seuil ;
- statut ok/soon/exceeded ;
- urgence ;
- seuils onboarding et Edge Function actuellement divergents.

E. Echeances :

- prochaine declaration mensuelle ;
- prochaine declaration trimestrielle ;
- jours restants ;
- urgence ;
- labels de periode ;
- rappels.

F. Factures :

- HT/TVA/TTC ;
- TVA facture ;
- exemption ;
- arrondi ;
- echeance de paiement ;
- statut paiement ;
- score conformite ;
- export XML/PDF.

G. Premium :

- trial days ;
- trial window ;
- limites export ;
- triggers premium ;
- access profile.

H. Today :

- alertes prioritaires ;
- priorites ;
- score fiscal ;
- reserve ;
- signaux d'engagement.

I. Autres :

- CFE ;
- sante financiere ;
- validations dates ;
- formatage monetaire.

## 7. Contradictions Et Zones Instables

| ID | Sujet | Constat | Risque | Decision LOT 4 |
| --- | --- | --- | --- | --- |
| CONTR-01 | Commerce cotisations | `computeObligations` utilise 12,3%, onboarding simple utilise 12% | ecart d'affichage et de projection | ne pas corriger, tester les deux chemins |
| CONTR-02 | Mixte cotisations | `computeObligations` utilise 18%, onboarding simple 17% | ecart d'affichage | ne pas corriger, deux calculators si necessaire |
| CONTR-03 | Activite inconnue | calcul principal fallback 0, onboarding fallback 17% | comportement different selon parcours | conserver exactement |
| TVA-01 | Seuil simple | onboarding simple compare un CA mensuel a 36800 et 30000 | incoherence avec projection annuelle | conserver temporairement UI |
| TVA-02 | Edge Function | `activity_type === "vente"` pour seuil commerce, alors que frontend utilise `commerce` | emails TVA potentiellement faux | exclure de LOT 4 frontend, documenter |
| DATE-01 | `toISOString().slice(0, 10)` | peut decaler une date locale selon fuseau | regression facture/echeance | imposer tests timezone avant extraction |
| DATE-02 | `new Date("YYYY-MM-DD")` vs `new Date("YYYY-MM-DDT00:00:00")` | parsing different UTC/local | regression date-only | choisir helper date-only unique |
| CFE-01 | CFE | paliers internes approximatifs et non verifies | risque fiscal | extraire tel quel avec avertissement |
| FACT-01 | Factur-X | brouillon non valide schema officiel | risque conformite | ne pas presenter comme transmission conforme |
| PREM-01 | Trial | 90 jours founder dans plusieurs chemins, 14 jours inscription sinon | confusion produit | extraire apres tests de parite |

## 8. Contrats Proposes

### 8.1 Contexte Commun

```js
{
  today: Date,
  ruleSet: CURRENT_RULE_SET,
  currencyCode: "EUR"
}
```

`today` doit etre injecte par l'appelant en tests et optionnel en production pour conserver le fallback actuel.

### 8.2 Revenus

```js
calculateRevenueMetrics({
  revenues,
  activityType,
  today
}) => {
  currentTotal,
  yearToDateTotal,
  monthsWithData,
  monthlyHistory,
  mixedBreakdown,
  firstRevenueDate,
  daysSinceFirstRevenue
}
```

Contraintes :

- ne pas muter `revenues` ;
- accepter structures incomplètes ;
- convertir les montants comme aujourd'hui avec `Number(amount || 0)` sauf pour les chemins ou la virgule est deja acceptee ;
- conserver les dates `YYYY-MM-DD` en local date-only.

### 8.3 Obligations Fiscales

```js
calculateObligations({
  fiscalProfile,
  revenueMetrics,
  expenses,
  today,
  rules
}) => {
  contribution,
  acre,
  vat,
  deadline,
  cfe,
  financialHealth,
  annualProjection
}
```

Cette API remplacera progressivement le corps de `computeObligations`, mais LOT 4 doit d'abord livrer une facade de parite qui peut etre testee contre `computeObligations`.

### 8.4 Cotisations

```js
calculateContribution({
  monthlyRevenue,
  activityType,
  acre,
  acreStartDate,
  today,
  rules
}) => {
  baseRate,
  effectiveRate,
  estimatedAmount,
  treasuryRecommended,
  annualCharges
}
```

Le taux vient des rules. L'arrondi reste `Math.round`.

### 8.5 TVA

```js
calculateVatExposure({
  activityType,
  monthlyRevenue,
  yearToDateRevenue,
  monthsWithData,
  rules
}) => {
  threshold,
  projectedRevenue,
  projectionMode,
  ratio,
  status,
  urgency
}
```

Le seuil et le ratio 0.8 viennent des rules. La projection garde les deux modes historiques.

### 8.6 Echeances

```js
calculateDeclarationDeadline({
  declarationFrequency,
  today,
  rules
}) => {
  deadlineDate,
  nextDeclaration,
  periodLabel,
  daysLeft,
  urgency
}
```

Les dates doivent rester des `Date` pour la parite avec `computeObligations` tant que `App.jsx` les attend ainsi.

### 8.7 Factures

```js
calculateInvoiceTotals({
  invoice,
  vatRules
}) => {
  totalHT,
  totalTVA,
  totalTTC,
  vatRate,
  isVatExempt,
  amountLabel
}
```

Ce contrat doit etre compatible avec `getInvoiceTotals` avant tout remplacement. Les sorties monetaires restent des nombres arrondis a deux decimales.

## 9. Structure De Fichiers Proposee Pour LOT 4

Structure cible minimale :

```text
src/domain/calculations/
  index.js
  money.js
  dates.js
  revenues.js
  contributions.js
  acre.js
  vat.js
  deadlines.js
  obligations.js
  invoices.js
  premium.js
```

Ordre conseille :

- commencer avec `money.js`, `dates.js`, `contributions.js`, `acre.js`, `vat.js`, `deadlines.js`, `obligations.js` ;
- reporter `invoices.js` et `premium.js` si le lot devient trop large ;
- ne pas creer de dossier trop fragmente tant que les tests ne le justifient pas.

Structure alternative si le lot doit rester plus petit :

```text
src/domain/calculations/
  index.js
  shared.js
  fiscalCalculations.js
  revenueCalculations.js
  invoiceCalculations.js
```

Choix recommande : structure minimale par responsabilite, pas de god file, pas de micro-fragmentation.

## 10. Dependances Autorisees

Autorise :

- `src/domain/models/*` pour normaliser les entrees lorsque necessaire ;
- `src/domain/rules/*` pour obtenir les valeurs applicables ;
- helpers purs internes au dossier `calculations`.

Interdit dans le Calculation Engine :

- React ;
- DOM ;
- `localStorage` ;
- `sessionStorage` ;
- Supabase ;
- fetch ;
- PDF/XML download ;
- navigation ;
- textes longs d'interface ;
- side effects ;
- lecture implicite de l'horloge sans possibilite d'injection.

## 11. Strategie Date Et Fuseau Horaire

Regle principale :

- les champs `YYYY-MM-DD` doivent rester des dates locales sans decalage ;
- le moteur doit recevoir `today` en injection ;
- les comparaisons jour doivent neutraliser l'heure quand la sortie est une date civile ;
- ne jamais remplacer un calcul existant par `toISOString().slice(0, 10)` sans test de parite.

Helpers proposes :

- `parseDateOnlyLocal(value)` ;
- `formatDateOnlyLocal(date)` ;
- `addDaysLocalDate(value, days)` ;
- `diffDaysCeil(a, b)` ;
- `startOfLocalDay(date)`.

Tests obligatoires :

- passage heure ete/hiver Europe/Paris ;
- 29 fevrier ;
- fin de mois ;
- 31 janvier + 30 jours ;
- echeance trimestrielle de decembre vers janvier.

## 12. Strategie Monetaire Et Arrondis

Regles historiques a conserver :

- cotisations : `Math.round(ca * rate)` vers euro entier ;
- TVA/facture : arrondi a deux decimales via `Math.round(value * 100) / 100` ;
- affichage : `toLocaleString("fr-FR")` reste hors moteur ;
- XML : `toFixed(2)` reste serialization, pas calcul metier.

Le moteur doit distinguer :

- `roundEuro(value)` pour cotisations et CFE ;
- `roundMoney(value)` pour facture ;
- aucun changement de format monetaire persiste.

## 13. Strategie De Parite

Avant tout branchement dans `App.jsx`, LOT 4 doit avoir des tests de parite contre les fonctions historiques :

- `computeObligations` pour cotisations, ACRE, TVA, echeances, CFE, sante financiere ;
- `getInvoiceTotals` pour factures ;
- `createFacturXReadyInvoiceDraft` pour brouillons facture ;
- helpers internes App repliques par des fixtures, sans modifier App ;
- `getTrialDaysLeft` par fixtures reproduisant le comportement actuel.

Approche :

1. Creer des fixtures de caracterisation.
2. Tester le nouveau moteur contre le comportement historique.
3. Brancher une facade optionnelle seulement apres parite verte.
4. Garder l'ancien code comme fallback pendant le branchement.

## 14. Golden Cases Minimum

Cotisations :

- services 1000, ACRE non : 220 ;
- commerce 1000, ACRE non : 123 ;
- mixte 1000, ACRE non : 180 ;
- activite inconnue 1000 : 0 ;
- montant zero : 0 ;
- montant negatif : conserver le comportement historique du chemin teste.

ACRE :

- ACRE yes sans date : active, taux divise par deux ;
- ACRE yes debut aujourd'hui : 12 mois restants ;
- ACRE yes debut il y a 13 mois : expire, taux base ;
- ACRE unknown : aucune reduction.

TVA :

- services 1000/mois : ok ;
- services 2500/mois : soon ;
- services 4000/mois : exceeded ;
- commerce 7000/mois : soon ;
- commerce 8000/mois : exceeded ;
- YTD 9000 sur 3 mois : projection 36000 ;
- YTD 9000 sur 1 mois : fallback `ca_month * 12`.

Echeances :

- mensuel au 31/01/2026 : 28/02/2026 ;
- mensuel au 31/01/2028 : 29/02/2028 ;
- trimestriel en decembre 2026 : 31/01/2027 ;
- frequence inconnue : pas de deadline.

Factures :

- exempt : HT = TTC, TVA 0 ;
- standard 100 HT : TVA 20, TTC 120 ;
- totals fournis prioritaires ;
- quantite/prix invalides dans brouillon : clamp historique a 0 ;
- arrondi 2 decimales.

Premium :

- trial finit dans 7 jours : 7 ;
- trial finit aujourd'hui : 0 expire ;
- trial date invalide : null ;
- premium active : aucun trigger premium.

Today :

- TVA exceeded prioritaire ;
- ACRE <= 2 mois si pas TVA exceeded ;
- reserve low ;
- early tracking si <= 2 revenus ;
- all clear sinon.

## 15. Plan De Tests LOT 4

Fichiers de tests recommandes :

- `tests/calculation-engine.obligations.test.js`
- `tests/calculation-engine.revenues.test.js`
- `tests/calculation-engine.invoices.test.js`
- `tests/calculation-engine.premium.test.js`

Commandes :

- `node --test tests/domain-models.test.js`
- `node --test tests/rules-engine.test.js`
- `node --test tests/calculation-engine*.test.js`
- `npm run build`
- `npm run lint`
- `npx playwright test --reporter=line`

La baseline lint maximale reste celle validee avant migration si les erreurs ne concernent pas les fichiers du lot.

## 16. Ordre D'Extraction Progressif

### LOT 4.A - Shared Date/Money

Creer helpers purs date/money avec tests de parite.

Toucher uniquement :

- `src/domain/calculations/dates.js`
- `src/domain/calculations/money.js`
- tests associes.

Ne pas brancher App.

### LOT 4.B - Cotisations

Extraire le calcul cotisation principal :

- taux base depuis Rules ;
- taux effectif ACRE ;
- `estimatedAmount` ;
- `treasuryRecommended`.

Comparer a `computeObligations`.

### LOT 4.C - ACRE

Extraire statut, date de fin, mois restants, expiration.

Ne pas modifier les textes `acreHint`.

### LOT 4.D - TVA

Extraire projection, ratio, seuil, statut, urgence.

Ne pas corriger les seuils ni les contradictions.

### LOT 4.E - Echeances

Extraire mensuel/trimestriel, daysLeft, urgency.

Garder les labels UI au plus pres du comportement historique.

### LOT 4.F - Facade Obligations

Composer les fonctions fiscales dans une facade pure.

But : reproduire la sortie structurelle de `computeObligations` sans brancher App.

### LOT 4.G - Revenus

Extraire aggregats revenus :

- current total ;
- YTD ;
- monthsWithData ;
- monthlyHistory ;
- mixed breakdown.

Ne pas modifier sauvegarde, suppression ou formulaire.

### LOT 4.H - Factures

Extraire les calculs Factur-X et facture.

Reporter si le lot devient trop volumineux.

### LOT 4.I - Premium / Today

Extraire uniquement les calculs purs deja couverts par Rules LOT 3.

Les priorites UI et textes restent dans App jusqu'a un lot UX/application.

### LOT 4.J - Branchement Minimal

Optionnel et uniquement apres tests verts :

- remplacer un appel par une facade compatible ;
- conserver fallback historique ;
- ne brancher qu'une famille a la fois ;
- verifier Playwright.

## 17. Calculs A Conserver Temporairement Dans App

A conserver pendant LOT 4 initial :

- textes de guidance simple assistant ;
- ordre et contenu des smart alerts ;
- smart priorities avec libelles ;
- fiscal score et helpers UX ;
- modales ;
- navigation ;
- logique premium commerciale ;
- quotas export ;
- ecriture localStorage ;
- appels Supabase ;
- mapping UI des factures ;
- validations formulaire ;
- generation PDF/XML et telechargements.

Raison : ces elements melangent calcul, texte, UX et effets. Les extraire trop tot risquerait une regression visible.

## 18. Impact Attendu Sur App.jsx

Phase de preparation actuelle :

- aucun impact.

Future implementation LOT 4 :

- d'abord aucun branchement ;
- ensuite remplacement tres local de `computeObligations` par une facade compatible ;
- aucun changement de props visible ;
- aucune modification des payloads persistes ;
- aucune modification des cles localStorage ;
- aucune modification des appels Supabase.

Un branchement est interdit tant que la facade ne reproduit pas les sorties attendues par `App.jsx` :

- `estimatedAmount`
- `rate`
- `baseRate`
- `acreActive`
- `acreMonthsLeft`
- `acreEndDate`
- `acreStatus`
- `acreHint`
- `deadlineDate`
- `daysLeft`
- `urgency`
- `caAnnuel`
- `tvaThreshold`
- `tvaStatus`
- `tvaUrgency`
- `tvaProjectionMode`
- `recommendations`
- `nextDeclarationLabel`
- `amountEstimatedLabel`
- `deadlineLabel`
- `tvaStatusLabel`
- `treasuryRecommended`
- `treasuryLabel`
- `monthlyExpenses`
- `financialHealth`
- `financialHealthMessage`
- `savingsRecommended`
- `coverageRatio`
- `annualRevenue`
- `annualCharges`
- `annualNet`
- `businessYear`
- `isFirstYear`
- `cfeAlert`

## 19. Risques De Regression

Risques runtime :

- import circulaire entre `domain/index.js`, rules et calculations ;
- mutation accidentelle des tableaux revenus/factures ;
- Date invalide propagee differemment ;
- `Date` remplacee par string alors que l'UI attend une instance.

Risques metier :

- modification involontaire des taux ;
- arrondi euro remplace par arrondi cents ;
- seuil TVA corrige trop tot ;
- fallback activite inconnue modifie ;
- ACRE expiree calculee avec une granularite differente.

Risques UX :

- changement des labels ;
- ordre des alertes Today modifie ;
- preview revenu differente ;
- format devise different ;
- PDF/XML facture different.

Risques data :

- format date `YYYY-MM-DD` decale par UTC ;
- payload facture `totals` modifie ;
- payload revenu `amount` normalise autrement ;
- cle localStorage ou structure export usage modifiee.

## 20. Conditions STOP

Arreter LOT 4 et revenir au plan si :

- un test de parite montre une difference non expliquee ;
- un calcul necessite une correction fiscale ;
- une date change entre local et UTC ;
- une fonction du moteur veut lire Supabase ou localStorage ;
- App.jsx doit etre modifie massivement pour brancher le moteur ;
- le dossier calculations devient un god object ;
- une regle de LOT 3 doit etre changee pour faire passer les tests ;
- un payload persiste change ;
- la baseline lint augmente au-dessus du seuil accepte.

## 21. Strategie De Rollback

Rollback simple attendu :

- supprimer les nouveaux fichiers `src/domain/calculations/*` ;
- supprimer les tests calculation engine ;
- revenir a l'appel historique `computeObligations` si un branchement minimal a ete fait ;
- ne toucher ni aux migrations Supabase ni aux donnees locales.

Pendant LOT 4, l'ancien code doit rester source active tant que la parite n'est pas validee.

## 22. Dette Volontairement Reportee

Dette a ne pas traiter dans LOT 4 :

- verification juridique des taux, seuils et echeances ;
- correction commerce 12% vs 12,3% ;
- correction mixte 17% vs 18% ;
- correction Edge Function `vente` vs `commerce` ;
- refonte Factur-X conforme PDP ;
- refonte reminders ;
- refonte premium ;
- suppression de `computeObligations` ;
- migration localStorage ;
- modification schema Supabase ;
- redesign UX.

## 23. Questions Ouvertes Avant Implementation

Questions a trancher avant de coder LOT 4 :

- LOT 4 doit-il brancher la facade dans `App.jsx`, ou seulement creer un moteur teste sans integration ?
- Les calculs facture doivent-ils faire partie de LOT 4 initial ou d'un LOT 4 bis ?
- Les calculs premium/trial doivent-ils rester dans Rules/Product pour eviter de melanger fiscal et commercial ?
- Faut-il conserver dans le moteur les libelles historiques de `computeObligations`, ou creer un formatter separe ?
- Quelle baseline de parite accepter pour les contradictions deja documentees ?

## 24. Recommandation D'Implementation

Recommendation : GO pour implementation LOT 4, mais uniquement en mode extraction progressive et non corrective.

Perimetre recommande pour le premier commit LOT 4 :

1. creer `src/domain/calculations/`;
2. ajouter helpers `money` et `dates`;
3. extraire cotisations, ACRE, TVA et echeances ;
4. creer une facade `calculateObligationsBaseline`;
5. tester contre `computeObligations`;
6. ne pas brancher `App.jsx` tant que les tests de parite ne sont pas verts.

Ne pas inclure au premier passage :

- factures ;
- premium ;
- Today ;
- exports ;
- Edge Functions ;
- Supabase ;
- localStorage ;
- refonte UI.

## 25. Decision Finale

GO POUR IMPLEMENTATION LOT 4, sous conditions :

- implementation limitee a un moteur pur ;
- parite historique obligatoire ;
- aucune correction fiscale dans le lot ;
- aucun branchement applicatif avant tests verts ;
- aucun modele futur injustifie ;
- aucun changement visible ;
- aucun changement de persistence.
