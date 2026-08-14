# LOT 4C.0 - Contributions Gate & Legacy Characterization

Date : 2026-07-30\
Branche : `refactor/saas-shell-v2`\
Statut : audit preparatoire uniquement\
Decision cible : determiner si LOT 4C.1 peut commencer sans decision metier supplementaire

## 1. Resume executif

Le repository contient deja plusieurs chemins de cotisations, mais un seul chemin doit servir de base au futur LOT 4C.1 : la cotisation standard hors ACRE issue de `src/utils/obligations.js#getRate` et documentee par `src/domain/rules/contributionRules.js#getContributionRule`.

Decision principale :

- GO pour LOT 4C.1 uniquement si le lot reste limite a `calculateStandardContribution` ;
- NO-GO pour inclure ACRE, TVA, reserve, annualisation, preview UI, labels ou integration `App.jsx` dans LOT 4C.1 ;
- ne corriger aucun taux ;
- ne chercher aucune source externe ;
- reproduire les valeurs historiques actuelles, meme lorsqu'elles sont divergentes.

Le futur calcul Contributions doit appliquer une base de chiffre d'affaires explicite a un taux standard resolu par Rules Engine, puis arrondir en euros avec la politique historique `Math.round(baseAmount * rate)`.

## 2. Perimetre

Inclus dans cet audit :

- inventaire des calculs de cotisations actuels ;
- inventaire des taux ;
- inventaire des types d'activite et categories ;
- frontieres Contributions / ACRE / TVA / reserve ;
- recommandation d'architecture pour LOT 4C.1 ;
- decisions de contrat d'entree, sortie, warnings, trace et tests.

Exclus de cet audit :

- aucune implementation ;
- aucun fichier JavaScript ;
- aucun test ;
- aucun export ;
- aucune fixture ;
- aucune correction de taux ;
- aucune integration applicative.

## 3. Sources inspectees

Documents lus ou inspectes :

- `docs/MICROASSIST_PRODUCT_VISION_2027.md` ;
- `docs/MICROASSIST_DESIGN_PRINCIPLES.md` ;
- `docs/UX_BLUEPRINT_V3.md` ;
- `docs/PRODUCT_BLUEPRINT_V3.md` ;
- `docs/IMPLEMENTATION_ROADMAP_V3.md` ;
- `docs/CODING_STANDARDS_V3.md` ;
- `docs/ARCHITECTURE_AUDIT.md` ;
- `docs/LOT_2_DOMAIN_MODELS_REPORT.md` ;
- `docs/LOT_3_RULES_ENGINE_REPORT.md` ;
- `docs/LOT_4_CALCULATION_ENGINE_PLAN.md` ;
- `docs/LOT_4_GATE_REVIEW.md` ;
- `docs/LOT_4A_CALCULATION_PRIMITIVES_REPORT.md` ;
- `docs/LOT_4A_5_CALCULATION_LAYER_ARCHITECTURE.md` ;
- `docs/LOT_4B_1_REVENUE_FOUNDATIONS_REPORT.md` ;
- `docs/LOT_4B_2_REVENUE_PERIODS_REPORT.md`.

Code inspecte :

- `src/App.jsx` ;
- `src/utils/obligations.js` ;
- `src/domain/rules/` ;
- `src/domain/models/` ;
- `src/domain/calculations/` ;
- `src/components/` ;
- `src/utils/` ;
- `tests/` ;
- `playwright.config.js`.

Recherches effectuees :

- `cotisation`, `cotisations`, `contribution`, `social`, `reserve`, `urssaf` ;
- `0.22`, `0.123`, `0.18`, `0.12`, `12`, `22`, `Math.round` ;
- `activity_type`, `activityType`, `service`, `services`, `vente`, `commerce`, `mixed`, `mixte` ;
- `acre`, `revenue`, `currentMonthTotal`, `estimatedCharges`, `previewCharges`.

## 4. Inventaire des calculs historiques

| ID | Fichier | Fonction ou bloc | Ligne / zone | Entrees | Formule | Taux | Arrondi | Sortie | Consommateur | UI | Statut | Tests | Confiance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 | `src/utils/obligations.js` | `getRate` | debut fichier | `activity_type` | table directe | services `0.22`, commerce `0.123`, mixte `0.18`, inconnu `0` | aucun | `baseRate` | `computeObligations` | indirect | actif officiel legacy | `rules-engine.test.js` | elevee |
| C-02 | `src/utils/obligations.js` | `computeObligations` | `estimatedAmount` | `ca_month`, `rate` | `ca * rate` | taux effectif | `Math.round` euro | `estimatedAmount` | dashboard, labels, reserve | oui | actif | `rules-engine.test.js` partiel | elevee |
| C-03 | `src/utils/obligations.js` | `computeObligations` ACRE | bloc ACRE | `baseRate`, `acre`, `acre_start_date` | `baseRate / 2` si ACRE active | demi-taux | aucun sur taux | `rate` effectif | `estimatedAmount` | oui | actif mais ACRE | `rules-engine.test.js` | elevee |
| C-04 | `src/utils/obligations.js` | `treasuryRecommended` | apres `estimatedAmount` | `estimatedAmount` | identite | aucun | herite de C-02 | `treasuryRecommended` | cartes reserve | oui | actif derive | model test indirect | moyenne |
| C-05 | `src/utils/obligations.js` | `annualCharges` | annual calculations | `estimatedAmount` | `estimatedAmount * 12` | herite | aucun supplementaire | `annualCharges` | projection dashboard | oui | actif derive | model test indirect | moyenne |
| C-06 | `src/utils/obligations.js` | `annualNet` | annual calculations | `ca * 12`, `annualCharges` | `annualRevenue - annualCharges` | herite | aucun | `annualNet` | dashboard | oui | derive, pas cotisation stricte | model test indirect | moyenne |
| C-07 | `src/App.jsx` | `getSimpleChargeRate` | env. 509 | `activityType` normalise | table pourcentage | services `22`, commerce `12`, mixte/fallback `17` | aucun | pourcentage | `buildSimpleAssistantGuidance` | oui | actif, divergent | `rules-engine.test.js` | elevee |
| C-08 | `src/App.jsx` | `buildSimpleAssistantGuidance` | env. 697 | `monthlyRevenue`, `chargeRate` | `monthlyRevenue * (chargeRate / 100)` | C-07 | `Math.round` euro | `chargeEstimate` | hero assistant | oui | actif onboarding | pas contre App direct | moyenne |
| C-09 | `src/App.jsx` | `getEstimatedRate` | env. 2134 | `activityType` normalise | table directe | mixte `0.18`, commerce `0.123`, services/default `0.22` | aucun | fallback rate | cockpit, preview | oui | actif helper | non direct | moyenne |
| C-10 | `src/App.jsx` | `getRevenueContributionRate` | env. 2159 | revenu, activite, fallback | categorie ou fallback, facteur ACRE via `computed.rate/baseFallbackRate` | vente `0.123`, service `0.22`, fallback | aucun | taux effectif par revenu | preview, save notice | oui | actif UI-adjacent | non direct | moyenne |
| C-11 | `src/App.jsx` | `estimatedCharges` | env. 5590 | `currentMonthTotal`, `computed.rate` | `currentMonthTotal * computed.rate` | taux effectif compute | `Math.round` euro | `estimatedCharges` | dashboard, reserve, Today | oui | actif derive | Playwright indirect | moyenne |
| C-12 | `src/App.jsx` | `availableAmount` | env. 5597 | `currentMonthTotal`, `estimatedCharges` | `Math.max(0, currentMonthTotal - estimatedCharges)` | aucun | aucun | disponible | dashboard, reserve | oui | reserve / net UI | non direct | moyenne |
| C-13 | `src/App.jsx` | `previewCharges` | env. 5606 | `revenueAmount`, categorie, activite, `computed.rate` | `revenueAmount * effectiveRate` | C-10 | `Math.round` euro | charges estimees preview | modal revenu | oui | actif preview | non direct | moyenne |
| C-14 | `src/App.jsx` | `previewAvailable` | env. 5621 | `revenueAmount`, `previewCharges` | `Math.max(0, revenueAmount - previewCharges)` | aucun | aucun | net estime | modal revenu | oui | net UI | non direct | moyenne |
| C-15 | `src/App.jsx` | `previewRateLabel` | env. 5626 | `effectiveRate` | `effectiveRate * 1000 / 10` | C-10 | `Math.round` a 0,1 point | label taux | modal revenu | oui | affichage UI | non direct | moyenne |
| C-16 | `src/App.jsx` | `saveRevenueEntry` notice | env. 9498 | montant sauvegarde, rate | `amount * rate` | C-10 | `Math.round` euro | charges/disponible notice | toast/notice | oui | actif apres save auth | non direct | moyenne |
| C-17 | `src/App.jsx` | `handleSaveRevenue` guest notice | env. 9530 | `revenueAmount` | aucun calcul charges | aucun | aucun | montant seul | notice invite | oui | divergence parcours invite | non direct | moyenne |
| C-18 | `src/App.jsx` | `cockpitEstimate` | env. 5910 | revenu reel ou starter | `baseRevenue * rate` | `computed.rate` ou C-09 | `Math.round` euro | charges, available | cockpit dashboard | oui | actif derive | non direct | moyenne |
| C-19 | `src/App.jsx` | `weeklyEstimatedCharges` | env. 6852 | revenus semaine, taux | `weeklyRevenueTotal * estimatedRate` | `computed.rate` ou C-09 | `Math.round` euro | charges hebdo | reflection/insights | oui | product UI | non direct | faible |
| C-20 | `src/App.jsx` | `savingsGoal` | env. 6338 | `estimatedCharges` | `Math.max(estimatedCharges * 3, 500)` | herite | aucun | objectif epargne | dashboard | oui | reserve UI, pas cotisation | non direct | moyenne |
| C-21 | `src/App.jsx` | cash impact modal | env. 14030 | `treasuryRecommended`, charges | affichage reserve et disponible ajuste | herite | affichage | reserve / charges | modal tresorerie | oui | UI | Playwright indirect | moyenne |
| C-22 | `src/domain/rules/contributionRules.js` | `CONTRIBUTION_RATES` | debut fichier | `ACTIVITY_TYPES` | table directe | `0.22`, `0.123`, `0.18` | aucun | rate | future calculations | non | actif rules | `rules-engine.test.js` | elevee |
| C-23 | `src/domain/rules/contributionRules.js` | `getContributionRule` | fonction | contexte activite | lookup + fallback | C-22 ou `0` | aucun | rule trace, value | tests/futur | non | actif rules | `rules-engine.test.js` | elevee |
| C-24 | `src/domain/rules/contributionRules.js` | `getRevenueContributionRule` | fonction | categorie revenu | `vente -> commerce`, `service -> services`, sinon contexte | `0.123`, `0.22`, fallback | aucun | contribution rule | tests/futur | non | actif rules | `rules-engine.test.js` | elevee |
| C-25 | `src/domain/rules/contributionRules.js` | `getSimpleAssistantContributionRule` | fonction | activite | lookup pourcentage + fallback mixte | `22`, `12`, `17` | aucun | rule simple | tests/futur | non | actif rules mais divergent | `rules-engine.test.js` | elevee |
| C-26 | `src/domain/rules/acreRules.js` | `getAcreRule` | fonction | activite, ACRE, date, today | `baseRate / 2` et 12 mois | herite C-23 | aucun sur montant | effectiveRate | tests/futur ACRE | non | actif rules ACRE | `rules-engine.test.js` | elevee |
| C-27 | `src/domain/models/calculation.js` | `normalizeCalculationResult` | modele | sortie compute | normalise non-negatif | aucun | aucun | `estimatedAmount`, `annualCharges`... | Domain Models | non | structure persistable possible | `domain-models.test.js` | moyenne |
| C-28 | `tests/rules-engine.test.js` | tests contributions | debut suite | fixtures | compare rules a compute | `0.22`, `0.123`, `0.18`, `0`, `22`, `12`, `17` | aucun | assertions | CI | non | test actif | oui | elevee |
| C-29 | `src/components/InvoiceGenerator.jsx` | preview facture | env. 607 | amount, TVA | TVA/TTC facture | 20% TVA selon mode | aucun visible | facture | UI facture | oui | TVA, pas cotisation | non | elevee hors perimetre |
| C-30 | `src/utils/facturx.js` | totals facture | plusieurs | facture | HT/TVA/TTC | TVA | `roundMoney` / `toFixed` | facture | PDF/XML | oui | facture/TVA, pas cotisation | non | elevee hors perimetre |

Conclusion inventaire : C-01, C-02, C-22 et C-23 sont le noyau Contributions standard exploitable pour LOT 4C.1. C-03 et C-26 appartiennent a ACRE. C-04, C-05, C-06, C-12, C-14, C-20, C-21 sont des derives reserve/net/projection. C-07, C-08, C-15 sont onboarding UI divergent. C-10, C-13, C-16 sont preview par revenu, a reporter apres le calcul standard.

## 5. Placeholders identifies

Recherche du placeholder connu :

```js
Math.round(amount * 0.22)
```

Resultat :

- aucune occurrence exacte trouvee dans le code source actuel ;
- l'anti-pattern est mentionne dans `docs/PRODUCT_BLUEPRINT_V3.md` comme element a eviter ;
- une forme equivalente existe quand `previewCharges`, `estimatedCharges`, `chargeEstimate` ou `cockpitEstimate.charges` utilisent un taux effectif `0.22`.

Emplacements equivalants :

- `src/App.jsx#buildSimpleAssistantGuidance` : `Math.round(monthlyRevenue * (chargeRate / 100))`, avec `chargeRate === 22` pour services ;
- `src/App.jsx#estimatedCharges` : `Math.round(currentMonthTotal * computed.rate)`, avec `computed.rate === 0.22` hors ACRE services ;
- `src/App.jsx#previewCharges` : `Math.round(revenueAmount * effectiveRate)`, avec `effectiveRate === 0.22` pour service ;
- `src/App.jsx#saveRevenueEntry` : `Math.round(amount * rate)`, avec `rate === 0.22` possible.

Decision :

- ne pas qualifier ces chemins de regle officielle par leur forme `amount * 0.22` ;
- les caracteriser comme chemins legacy actifs ou previews UI selon consommateur ;
- ne pas reproduire l'onboarding simple comme calcul Contributions officiel en LOT 4C.1 ;
- reproduire uniquement la formule standard `Math.round(baseAmount * rate)` avec taux fourni par `getContributionRule`.

Persistence :

- le placeholder exact n'est pas persiste ;
- les resultats de preview ne sont pas persistes ;
- les revenus sauvegardes ne contiennent pas de cotisation calculee ;
- certains resultats `computeObligations` sont normalisables par Domain Models, mais aucune migration ou table cotisations n'est identifiee.

## 6. Inventaire des taux

| Valeur | Forme | Activite / usage | Source code | Source Rules | Usage reel | ACRE | Statut | Divergence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `0.22` | decimal | services, taux standard | `obligations.js#getRate`, `App.jsx#getEstimatedRate`, `getRevenueContributionRate` | `CONTRIBUTION_RATES.services`, `getContributionRule`, `getRevenueContributionRule` | compute principal, preview, tests | base avant division par deux | actif | coherent avec simple `22%` sauf forme |
| `22` | pourcentage | services onboarding | `App.jsx#getSimpleChargeRate` | `getSimpleAssistantContributionRule` | assistant simple | hors ACRE | actif UI | coherent avec `0.22`, mais chemin distinct |
| `0.123` | decimal | commerce standard | `obligations.js#getRate`, `App.jsx#getEstimatedRate`, categorie `vente` | `CONTRIBUTION_RATES.commerce` | compute principal, preview | base avant division par deux | actif | diverge de simple `12%` |
| `12` | pourcentage | commerce onboarding | `App.jsx#getSimpleChargeRate` | `getSimpleAssistantContributionRule` | assistant simple | hors ACRE | actif UI | diverge de `0.123` / 12,3% |
| `0.18` | decimal | mixte standard simplifie | `obligations.js#getRate`, `App.jsx#getEstimatedRate` | `CONTRIBUTION_RATES.mixed` | compute principal, preview fallback | base avant division par deux | actif | diverge de simple `17%` |
| `17` | pourcentage | mixte et fallback onboarding | `App.jsx#getSimpleChargeRate` | `getSimpleAssistantContributionRule` | assistant simple | hors ACRE | actif UI | diverge de `0.18` |
| `0` | decimal | activite inconnue compute | `obligations.js#getRate` | `CONTRIBUTION_RATE_UNKNOWN_FALLBACK` | compute principal | pas d'ACRE car baseRate 0 | actif fallback | diverge de fallback simple `17%` |
| `0.5` | facteur | reduction ACRE | `obligations.js`, `acreRules.js` | `getAcreRule` | taux effectif ACRE | ACRE uniquement | actif ACRE | hors LOT 4C.1 |
| `1000` | facteur label | `previewRateLabel` | `App.jsx` | aucune | arrondi 0,1 point de taux | affiche taux effectif | UI | pas un taux metier |

Decision :

- LOT 4C.1 utilise `0.22`, `0.123`, `0.18`, `0` via Rules Engine ;
- LOT 4C.1 n'utilise pas `22`, `12`, `17` sauf tests de caracterisation documentant leur exclusion du calcul officiel ;
- LOT 4C.1 ne gere pas `0.5` ACRE.

## 7. Types d'activite

| Valeur | Emplacement | Signification apparente | Taux associe | Mapping actuel | Fallback |
| --- | --- | --- | --- | --- | --- |
| `services` | profil, `ACTIVITY_TYPES.services`, `getRate`, UI | activite services canonique profil | `0.22` ou `22` simple | cible de `service` | compute : 0.22 |
| `service` | categorie revenu, normalizer App | categorie encaissement service | `0.22` par revenu | mappe vers `services` pour activity, conserve comme categorie revenue | si activity : `services` |
| `commerce` | profil, `ACTIVITY_TYPES.commerce`, `getRate` | activite commerce canonique | `0.123` ou `12` simple | cible de `vente` | compute : 0.123 |
| `vente` | categorie revenu, normalizer App | categorie encaissement vente/commerce | `0.123` par revenu | mappe vers `commerce` pour activity | si category : commerce |
| `mixte` | profil canonique mixed | activite mixte | `0.18` ou `17` simple | cible de `mix`/`mixed` | compute : 0.18 |
| `mixed` | App normalizer, Revenue categories 4B.2 | variante mixte / categorie historique | pas direct compute si non normalise | mappe vers `mixte` pour activity | simple fallback `mixte` |
| `mix` | App normalizer | variante mixte | pas direct compute si non normalise | mappe vers `mixte` | simple fallback `mixte` |
| `other` | Revenue categories 4B.2, Expert/demo | categorie autre | aucun taux standard | conserve en category breakdown | unknown |
| vide `""` | revenus non mixtes, formulaire | absence de categorie revenue | fallback activite profil | pas fusionne | compute selon activity profile |
| inconnu | tests/rules | activite non reconnue | compute `0`, simple `17` | aucun mapping dans Rules | divergence documentee |

Decision :

- LOT 4C.1 consomme `activityType` canonique `services`, `commerce`, `mixte` ou valeur inconnue ;
- LOT 4C.1 ne fait pas de mapping large `service -> services` ou `vente -> commerce` dans le calculator standard ;
- les mappings restent responsabilite adapter / normalizer / future integration ;
- un test peut caracteriser que Rules retourne `0` pour unknown.

## 8. Mappings existants

Mappings actifs :

- `App.jsx#normalizeActivityType` :
  - `vente`, `sale`, `sales` -> `commerce` ;
  - `service`, `services` -> `services` ;
  - `mixte`, `mix`, `mixed` -> `mixte` ;
  - vide -> `services`.
- `App.jsx#getRevenueContributionRate` :
  - `revenue_category === "vente"` -> `0.123` ;
  - `revenue_category === "service"` -> `0.22` ;
  - sinon fallback activity.
- `src/domain/rules/getRevenueContributionRule` :
  - `category === "vente"` -> commerce rule ;
  - `category === "service"` -> services rule ;
  - sinon contexte activity.
- `src/domain/constants.js` :
  - activity canonique : `services`, `commerce`, `mixte` ;
  - revenue category canonique : `""`, `vente`, `service`.

Decision :

- ne pas introduire de mapping nouveau dans LOT 4C.1 ;
- ne pas fusionner activity et revenue category ;
- ne pas resoudre la divergence vide -> `services` de `normalizeActivityType` dans le calcul pur standard.

## 9. Regles Contributions existantes

Regles publiques :

- `CONTRIBUTION_RATES` ;
- `SIMPLE_ASSISTANT_CONTRIBUTION_PERCENTAGES` ;
- `getContributionRule(context)` ;
- `getRevenueContributionRule(context)` ;
- `getSimpleAssistantContributionRule(context)`.

Contrat `getContributionRule` :

- entrees : `activityType` ou `activity_type` ;
- sorties : `value`, `output.rate`, `ruleId`, `fallback`, `warnings`, `confidence`, version via `withRuleTrace` ;
- taux : services `0.22`, commerce `0.123`, mixte `0.18`, unknown `0` ;
- fallback : `unknown_activity_rate_zero`.

Contrat `getRevenueContributionRule` :

- entrees : `category` ou `revenueCategory`, plus contexte activity ;
- sorties : meme forme que `getContributionRule` ;
- mapping : `vente` vers commerce, `service` vers services.

Contrat `getSimpleAssistantContributionRule` :

- entrees : `activityType` ou `activity_type` ;
- sorties : `value` en pourcentage, `output.ratePercent` ;
- taux : services `22`, commerce `12`, mixte `17`, unknown fallback `17` ;
- warnings documentent les divergences.

Version :

- Rule set courant : `microassist-current-baseline`, version `2026-07-29-lot3-baseline`, statut `technical_baseline_unverified`.

## 10. Relation avec Rules Engine

Decision recommandee pour LOT 4C.1 : combinaison D.

Details :

- le calculator standard importe `getContributionRule` par defaut ;
- il accepte une option locale `resolveContributionRule` ou `rule` seulement pour tests et injection future ;
- il ne recoit pas un gros ruleset global ;
- il ne lit pas Rules depuis UI ou App.

Justification :

- `calculations -> rules` est autorise par LOT 4A.5 ;
- le Rules Engine existe deja et caracterise les divergences ;
- recevoir seulement un taux par options rendrait la trace/ruleId plus faible ;
- recevoir un ruleset complet serait surdimensionne pour un calcul standard.

Alternative rejetee A pure :

- importer seulement les rules sans injection rend les tests moins souples.

Alternative rejetee B pure :

- recevoir seulement `rate` par options oblige l'appelant a refaire la resolution et augmente le risque de taux invente.

Alternative rejetee C pure :

- ruleset injecte complet trop large pour LOT 4C.1.

Impact LOT 4C.1 :

- creer des tests qui verifient le `ruleId` et le fallback unknown ;
- ne pas modifier `src/domain/rules/`.

## 11. Relation avec Revenue

Revenue Calculations fournit maintenant :

- normalisation ;
- filtrage ;
- total ;
- periode ;
- breakdown categorie.

Decision :

- LOT 4C.1 ne doit pas dependre de `src/domain/calculations/revenue/` ;
- LOT 4C.1 calcule une cotisation pour une base monetaire explicite, pas pour une collection de revenus ;
- l'orchestration future pourra appeler Revenue puis Contributions dans un lot separe.

Justification :

- eviter un couplage premature ;
- eviter la collision `normalizeRevenue` non resolue ;
- garder un calcul de contribution testable en isolation.

## 12. Frontiere Contributions / ACRE

Separation :

- Contribution standard : base * taux standard hors ACRE ;
- ACRE : statut, date, duree, reduction, taux effectif, transition.

Appartient a LOT 4C.1 :

- base standard ;
- taux standard ;
- montant standard hors ACRE ;
- fallback activite inconnue ;
- arrondi euro.

Reporte a futur LOT ACRE :

- `acre === "yes"` ;
- `acre_start_date` ;
- duree 12 mois ;
- `baseRate / 2` ;
- `acreMonthsLeft` ;
- `acreEndDate` ;
- `acreStatus` ;
- passage taux reduit -> taux standard.

Decision :

- ACRE est separable ;
- LOT 4C.1 doit ignorer ACRE ;
- aucun champ ACRE dans le contrat d'entree LOT 4C.1.

## 13. Frontiere Contributions / TVA

Ambiguites identifiees :

- `ca_month` sert a la fois de base cotisation et base de projection TVA ;
- factures manipulent HT/TVA/TTC, mais un revenu correspond a un encaissement ;
- `InvoiceGenerator` affiche TVA/TTC mais ne cree pas automatiquement un revenu ;
- `computeObligations` calcule TVA apres la cotisation, dans le meme fichier.

Decision :

- LOT 4C.1 ne calcule aucune TVA ;
- la base s'appelle `baseAmount`, pas HT/TTC ;
- aucun `vatMode`, `tvaStatus`, `tvaThreshold`, `totalHT`, `totalTTC` dans l'API Contributions.

## 14. Frontiere Contributions / Reserve

Calculs identifies :

- `treasuryRecommended = estimatedAmount` dans `computeObligations` ;
- `treasuryLabel` : texte "a mettre de cote" ;
- `availableAmount = currentMonthTotal - estimatedCharges` ;
- `previewAvailable` ;
- `savingsGoal = Math.max(estimatedCharges * 3, 500)` ;
- `savingsRecommended` selon depenses mensuelles ;
- cash impact modal : charges estimees, reserve, disponible ajuste ;
- `annualNet`.

Decision :

- seule la cotisation calculee appartient a Contributions ;
- `treasuryRecommended`, `availableAmount`, `savingsGoal`, `savingsRecommended`, `annualNet` appartiennent a reserve / financial health / UI ;
- LOT 4C.1 ne retourne pas de recommandation de reserve.

## 15. Strategies d'arrondi

Strategies observees :

- cotisation principale : `Math.round(ca * rate)` ;
- dashboard charges : `Math.round(currentMonthTotal * computed.rate)` ;
- preview revenu : `Math.round(revenueAmount * effectiveRate)` ;
- assistant simple : `Math.round(monthlyRevenue * (chargeRate / 100))` ;
- weekly charges : `Math.round(weeklyRevenueTotal * estimatedRate)` ;
- taux preview : `Math.round(effectiveRate * 1000) / 10` ;
- CFE / savings : `Math.round` ;
- facture : `roundMoney`, `toFixed`, ou calcul non arrondi dans preview facture.

Decision pour LOT 4C.1 :

- utiliser arrondi euro historique equivalent a `Math.round(baseAmount * rate)` ;
- utiliser la primitive LOT 4A `roundEuro` seulement si elle est deja prouvee equivalente au comportement historique sur les fixtures ;
- documenter `rounding: "nearest_euro_math_round"` dans la sortie ou la trace ;
- ne pas arrondir le taux.

## 16. Bases de calcul

Bases observees :

- `ca_month` dans `computeObligations` ;
- `currentMonthTotal` dans dashboard ;
- `revenueAmount` dans modal revenu ;
- `baseRevenue` dans cockpit estimate ;
- `weeklyRevenueTotal` dans reflection ;
- `monthlyRevenue` dans assistant simple ;
- `annualRevenue` pour projections derivees.

Decision :

- LOT 4C.1 utilise `baseAmount` explicite ;
- `baseAmount` represente le chiffre d'affaires / revenu encaisse deja agrege par l'appelant ;
- le calcul ne decide pas si la base vient du mois, d'une semaine, d'un revenu individuel ou d'une periode ;
- aucun acces a Revenue Calculations dans LOT 4C.1.

## 17. Donnees persistees concernees

Donnees persistantes en amont :

- Supabase `fiscal_profiles.activity_type` ;
- localStorage simple profile activity ;
- `revenues_guest` / table `revenues` pour la base future ;
- sorties normalisables par `normalizeCalculationResult`, mais pas identifiees comme table cotisations dediee.

Donnees non persistees :

- `estimatedCharges` ;
- `previewCharges` ;
- `previewAvailable` ;
- `cockpitEstimate` ;
- `weeklyEstimatedCharges` ;
- `treasuryLabel`.

Decision :

- LOT 4C.1 ne modifie aucune donnee persistante ;
- pas de migration ;
- pas de nouveau champ Supabase ;
- pas de nouvelle cle localStorage.

## 18. Comportements UI

Comportements visibles :

- assistant simple affiche un montant a mettre de cote et un taux en pourcentage ;
- dashboard affiche charges estimees, disponible, reserve ;
- modal revenu affiche taux estime, charges estimees, net estime ;
- notice apres sauvegarde auth affiche charges estimees et disponible estime ;
- parcours invite affiche seulement montant local, pas les charges dans la notice ;
- cash impact modal parle de reserve recommandee ;
- URSSAF helper parle du montant a declarer, pas du montant de cotisation.

Decision :

- aucun comportement UI ne doit etre modifie en LOT 4C.1 ;
- ces comportements servent de caracterisation, pas de branchement.

## 19. Tests historiques

Tests existants :

- `tests/rules-engine.test.js` couvre taux standard, taux simple, revenue category fallback, ACRE ;
- `tests/domain-models.test.js` couvre normalisation de `estimatedAmount`, `treasuryRecommended`, `annualCharges`, `annualNet` ;
- Playwright couvre surfaces visibles globales, sans assertions fines de montants contributions.

Tests manquants pour LOT 4C.1 :

- calcul standard par activite ;
- base zero ;
- base negative ;
- montant invalide ;
- activite manquante ;
- activite inconnue ;
- rule absent ;
- rule rate invalide ;
- trace active/desactivee ;
- non mutation options ;
- parite `computeObligations` hors ACRE.

## 20. Divergences legacy

Divergences a conserver :

- commerce standard `0.123` vs onboarding simple `12%` ;
- mixte standard `0.18` vs onboarding simple `17%` ;
- activite inconnue standard `0` vs onboarding simple fallback `17%` ;
- activity normalizer App retourne `services` par defaut pour vide, alors que Rules unknown retourne `0` si activite absente ;
- parcours invite ne montre pas la notice charges apres sauvegarde locale, contrairement au parcours authentifie ;
- `getRevenueContributionRate` applique un adjustment factor lie a `computed.rate`, donc ACRE peut contaminer la preview par categorie.

Decision :

- LOT 4C.1 reproduit uniquement la parite standard hors ACRE ;
- les divergences UI sont caracterisees mais non integrees.

## 21. Anomalies connues

| ID | Anomalie | Source | Decision |
| --- | --- | --- | --- |
| ANOM-CONTRIB-001 | commerce `12%` simple vs `12.3%` standard | LOT 3, App, obligations | conserver, ne pas corriger |
| ANOM-CONTRIB-002 | mixte `17%` simple vs `18%` standard | LOT 3, App, obligations | conserver, ne pas corriger |
| ANOM-CONTRIB-003 | unknown `0` standard vs `17%` simple | LOT 3 | conserver, tester standard |
| ANOM-CONTRIB-004 | `normalizeActivityType("")` retourne `services` | App | ne pas importer dans calculator standard |
| ANOM-CONTRIB-005 | preview categorie peut integrer ACRE par adjustment factor | App | reporter hors 4C.1 |
| ANOM-CONTRIB-006 | placeholder exact `Math.round(amount * 0.22)` absent mais equivalent possible | recherche repo | ne pas inventer une occurrence |

## 22. Contrat d'entree recommande

Options evaluees :

### Option A

```js
calculateStandardContribution(revenueAmount, activityType, options)
```

Avantages :

- simple.

Limites :

- parametres positionnels fragiles ;
- extension warnings/trace/rule difficile ;
- nom `revenueAmount` trop lie a Revenue.

Decision : rejetee.

### Option B

```js
calculateStandardContribution({
  baseAmount,
  activityType
}, options)
```

Avantages :

- explicite ;
- testable ;
- compatible Rules Engine ;
- pas de couplage Domain Models ;
- extensible sans introduire ACRE ;
- facile a tracer.

Decision : retenue.

### Option C

```js
calculateStandardContributions(revenues, profile, options)
```

Avantages :

- proche orchestration future.

Limites :

- couple Revenue, Profile et Contributions trop tot ;
- risque d'integration applicative ;
- oblige a trancher mapping et periode.

Decision : rejetee pour LOT 4C.1.

Contrat retenu :

```js
calculateStandardContribution(
  {
    baseAmount,
    activityType
  },
  options
)
```

## 23. Contrat de sortie recommande

Sortie specialisee recommandee :

```js
{
  baseAmount,
  activityType,
  rate,
  contributionAmount,
  ruleId,
  rounding: "nearest_euro_math_round",
  calculable,
  warnings,
  trace
}
```

Champs obligatoires :

- `baseAmount` ;
- `activityType` ;
- `rate` ;
- `contributionAmount` ;
- `calculable` ;
- `warnings` ;
- `trace`.

Champs optionnels :

- `ruleId` ;
- `rounding` ;
- `fallback`.

Comportements recommandes :

- base zero : calculable, montant `0` ;
- base negative : warning, mais reproduire `Math.round(base * rate)` seulement si le contrat de parite l'exige ; recommandation stricte : `calculable: false`, montant `0` pour eviter une cotisation negative non officielle ;
- montant invalide : warning `INVALID_CONTRIBUTION_BASE`, `calculable: false`, contribution `0` ;
- activite inconnue : warning `UNKNOWN_ACTIVITY_TYPE`, taux `0`, contribution `0`, `calculable: false` ou `true` avec fallback documente ; recommandation : `calculable: false` si `rule.fallback` existe ;
- regle absente : warning, contribution `0`, `calculable: false` ;
- taux invalide : warning, contribution `0`, `calculable: false`.

Decision importante :

- pour LOT 4C.1, les tests de parite doivent d'abord caracteriser `computeObligations` sur base negative. Si le legacy produit un montant negatif, le calcul standard peut documenter la divergence mais ne doit pas etre branche.

## 24. Erreurs

Cas `throw` :

- argument d'entree non objet si le contrat exige un objet ;
- options structurellement invalides, par exemple `resolveContributionRule` non fonction ;
- rules resolver qui retourne une forme non objet en mode strict test.

Cas warning :

- montant invalide ;
- montant negatif ;
- activite absente ;
- activite inconnue ;
- regle absente ;
- taux absent ou invalide ;
- placeholder simple assistant demande dans le mauvais calculator.

Cas resultat zero :

- base zero ;
- activite inconnue avec fallback rate `0` ;
- montant invalide non calculable ;
- taux invalide.

Cas NO-GO :

- besoin d'ACRE pour calculer la cotisation standard ;
- besoin de TVA ;
- besoin de lire `App.jsx`, Supabase ou localStorage ;
- impossibilite de distinguer taux standard et taux simple.

## 25. Warnings

Codes proposes sans implementation :

- `INVALID_CONTRIBUTION_BASE` ;
- `NEGATIVE_CONTRIBUTION_BASE` ;
- `MISSING_ACTIVITY_TYPE` ;
- `UNKNOWN_ACTIVITY_TYPE` ;
- `CONTRIBUTION_RULE_NOT_FOUND` ;
- `INVALID_CONTRIBUTION_RATE` ;
- `LEGACY_SIMPLE_ASSISTANT_RATE_EXCLUDED` ;
- `LEGACY_PLACEHOLDER_RATE` ;
- `ACRE_EXCLUDED_FROM_STANDARD_CONTRIBUTION` ;
- `TVA_EXCLUDED_FROM_STANDARD_CONTRIBUTION`.

Structure :

```js
{
  code,
  severity,
  domain: "contributions",
  field,
  sourceId,
  details
}
```

Interdits :

- texte UI traduit ;
- payload Revenue complet ;
- profil complet ;
- donnee personnelle.

## 26. Trace

Trace recommandee :

- desactivee par defaut ;
- active avec `trace: true` ;
- aucune persistence ;
- aucun `console.log`.

Steps proposes :

- `contributions.input.normalize` ;
- `contributions.rule.resolve` ;
- `contributions.amount.multiply` ;
- `contributions.amount.round`.

Chaque trace peut inclure :

- `baseAmount` ;
- `rate` ;
- `rawContributionAmount` ;
- `contributionAmount` ;
- `ruleId` ;
- `rounding`.

## 27. Options

Options recommandees pour LOT 4C.1 :

```js
{
  trace: false,
  resolveContributionRule,
  allowNegativeBase: false
}
```

Options rejetees :

- `acre` ;
- `vatMode` ;
- `period` ;
- `revenues` ;
- `profile` ;
- `locale` ;
- `formatCurrency` ;
- `persist`.

Decision :

- options locales uniquement ;
- pas d'option globale Calculation Engine ;
- pas de strict mode global.

## 28. Architecture LOT 4C.1

Structure minimale proposee :

```text
src/domain/calculations/contributions/
  index.js
  calculateStandardContribution.js

tests/
  standard-contributions.test.js

docs/
  LOT_4C_1_STANDARD_CONTRIBUTIONS_REPORT.md
```

Ne pas creer :

- `acre/` ;
- `vat/` ;
- `reserve/` ;
- `calculateObligations` ;
- facade globale ;
- adapter React ;
- adapter Supabase ;
- integration App.

## 29. API publique proposee

Exports publics proposes depuis `src/domain/calculations/contributions/index.js` :

- `calculateStandardContribution`.

Pas de reexport depuis :

- `src/domain/calculations/index.js` si une collision ou une instabilite existe ;
- `src/domain/index.js` avant decision explicite.

Helpers internes non exportes :

- warning factory ;
- trace factory ;
- rate validation ;
- base normalization.

## 30. Tests proposes

Tests unitaires LOT 4C.1 :

- API publique exacte ;
- services `1000 -> 220` ;
- commerce `1000 -> 123` ;
- mixte `1000 -> 180` ;
- unknown `1000 -> 0` avec warning ;
- activite absente ;
- base zero ;
- base decimale ;
- base string numerique ;
- base string virgule si la primitive Money le permet explicitement ;
- base invalide ;
- base negative ;
- taux invalide via resolver injecte ;
- regle absente via resolver injecte ;
- trace off/on ;
- warnings structures ;
- immutabilite entree/options.

Tests de caracterisation hors API officielle :

- simple assistant `22/12/17` documente mais non integre ;
- preview categorie `vente/service` reportee ;
- ACRE demi-taux reportee.

## 31. Fixtures de parite

Fixtures obligatoires :

| Fixture | Legacy | Resultat attendu | Decision |
| --- | --- | --- | --- |
| services 1000 | `computeObligations({ activity_type:"services", ca_month:1000, acre:"no" })` | `estimatedAmount 220`, `rate 0.22` | reproduire |
| commerce 1000 | idem commerce | `123`, `0.123` | reproduire |
| mixte 1000 | idem mixte | `180`, `0.18` | reproduire |
| unknown 1000 | idem unknown | `0`, `0` | reproduire comme fallback warning |
| missing activity 1000 | activity absent | `0`, `0` | reproduire fallback warning |
| zero services | ca `0` | `0` | reproduire |
| decimal services 100.5 | `Math.round(100.5 * 0.22)` | `22` | reproduire |
| negative services -100 | legacy a caracteriser | probablement `-22` | decision avant code final |
| simple commerce 1000 | `getSimpleChargeRate("commerce")` | `12%`, amount `120` | caracteriser, ne pas integrer |
| ACRE services 1000 | `acre:"yes"` | `110` si active | reporter ACRE |

## 32. Risques

Risques LOT 4C.1 :

- confondre taux standard et taux onboarding simple ;
- integrer ACRE trop tot ;
- retourner une reserve au lieu d'une cotisation ;
- changer le fallback activite inconnue ;
- arrondir aux centimes au lieu de l'euro ;
- mapper silencieusement `vente` vers `commerce` dans le calculator standard ;
- brancher `App.jsx` sans parite UI ;
- modifier les Rules pour faire passer un test.

Mitigations :

- API limitee ;
- tests de parite ;
- aucun App integration ;
- aucun changement Rules ;
- rapport de lot obligatoire.

## 33. Questions ouvertes

Questions qui ne bloquent pas LOT 4C.1 reduit :

- faut-il plus tard exposer un calculator de preview par revenu avec categorie `vente/service` ?
- faut-il conserver le fallback vide -> `services` de `normalizeActivityType` dans un adapter ?
- comment traiter officiellement les bases negatives ?
- faut-il un lot separe pour reserve / available amount ?

Question bloquante si le perimetre s'elargit :

- faut-il reproduire le taux simple `12%` / `17%` dans un calculator officiel ou le laisser comme UI legacy ?

Decision : ne pas elargir LOT 4C.1.

## 34. Decisions obligatoires

| Sujet | Decision retenue | Justification | Alternative rejetee | Impact LOT 4C.1 |
| --- | --- | --- | --- | --- |
| Base | `baseAmount` explicite | evite periode/revenue coupling | `revenues + profile` | calculator pur simple |
| Taux | Rules `getContributionRule` | source interne deja caracterisee | taux invente en option | ruleId/warnings |
| Activite | `activityType` canonique | aligne constants/rules | mapping automatique | adapter futur |
| Mapping | aucun dans calculator standard | evite fusion silencieuse | `vente -> commerce` partout | tests plus clairs |
| Arrondi | euro `Math.round` / `roundEuro` equivalent | parite historique | centimes | resultats legacy |
| Negatif | warning, non calculable recommande | evite cotisation negative officielle | reproduire sans avertir | test de caracterisation avant integration |
| Inconnu | fallback rate 0 + warning | parite compute | fallback 17% | pas de confusion onboarding |
| Regle absente | warning + non calculable | pas de taux invente | throw user data | resilience |
| ACRE | exclue | separable | demi-taux ici | futur LOT ACRE |
| TVA | exclue | autre domaine | base HT/TTC | futur LOT TVA |
| Reserve | exclue | UI/financial health | `treasuryRecommended` | futur lot reserve |
| Entree | Option B objet | extensible | params positionnels | contrat propre |
| Sortie | objet specialise | warnings/trace utiles | number direct | testable |
| Exports | `calculateStandardContribution` uniquement | surface minimale | facade globale | rollback simple |
| Legacy reproduit | standard compute hors ACRE | noyau fiable | onboarding simple | divergence documentee |
| Legacy non reproduit | simple assistant, preview, ACRE | hors perimetre | tout melanger | lot reduit |

## 35. Stop conditions

LOT 4C.1 doit passer NO-GO si :

- il faut modifier `src/domain/rules/` ;
- il faut modifier `App.jsx` ;
- il faut lire Supabase ou localStorage ;
- il faut integrer ACRE ;
- il faut integrer TVA ;
- il faut retourner une reserve ;
- le taux standard ne peut plus etre distingue du taux onboarding simple ;
- la base negative doit etre officialisee sans decision ;
- une source externe devient necessaire ;
- un export global cree une collision ;
- un changement de Revenue Calculations est requis ;
- la baseline lint augmente.

## 36. GO / NO-GO LOT 4C.1

Decision : GO POUR LOT 4C.1, avec perimetre strictement reduit.

Contenu autorise :

- creer `src/domain/calculations/contributions/` ;
- creer `calculateStandardContribution` ;
- utiliser `getContributionRule` ;
- calculer uniquement `baseAmount * standardRate` ;
- arrondir en euros comme le legacy ;
- produire warnings et trace optionnelle ;
- ajouter tests unitaires et parite standard hors ACRE ;
- creer un rapport LOT 4C.1.

Contenu interdit :

- ACRE ;
- TVA ;
- reserve ;
- preview par revenu ;
- simple assistant ;
- weekly charges ;
- annual charges ;
- net disponible ;
- App integration ;
- Supabase/localStorage ;
- correction de taux.

Justification :

- le taux standard est clairement caracterise ;
- le Rules Engine fournit un contrat exploitable ;
- ACRE est separable ;
- TVA est separable ;
- la base peut etre explicite ;
- aucune decision metier externe n'est requise pour reproduire le comportement standard actuel.

## 37. Validation de ce lot

Commandes demandees a executer apres creation du document :

```text
git diff --stat
git status --short
git diff -- docs/LOT_4C_0_CONTRIBUTIONS_GATE_REVIEW.md
git status --short --untracked-files=all -- docs/LOT_4C_0_CONTRIBUTIONS_GATE_REVIEW.md
```

Resultats a reporter dans la reponse finale.

## 38. Confirmations

Confirmations de conception :

- un seul fichier doit etre cree ;
- aucun fichier source ne doit etre modifie ;
- aucun test ne doit etre modifie ;
- aucun document existant ne doit etre modifie ;
- aucun export ne doit etre modifie ;
- aucune dependance ne doit etre installee ;
- aucun calcul Contributions ne doit etre cree ;
- aucun taux ne doit etre modifie ;
- aucun seuil ne doit etre modifie ;
- aucune regle ne doit etre modifiee ;
- aucun calcul ACRE ne doit etre cree ;
- aucun calcul TVA ne doit etre cree ;
- aucune integration `App.jsx` ;
- aucune donnee persistee modifiee ;
- aucun payload Supabase modifie ;
- aucune cle localStorage modifiee ;
- aucun comportement visible modifie.
