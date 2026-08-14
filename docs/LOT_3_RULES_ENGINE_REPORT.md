# Microassist V2 - LOT 3 Rules Engine Report

Date : 2026-07-29\
Branche : `refactor/saas-shell-v2`\
Statut d'entree : GO POUR LOT 3\
Baseline lint acceptee : 21 erreurs, 29 warnings

## 1. Resume executif

LOT 3 cree un Rules Engine pur, versionne, tracable et teste, sans remplacer le Calculation Engine actuel.

Le chemin actif de l'application reste inchange :

- `src/App.jsx` n'a pas ete modifie ;
- `src/utils/obligations.js` n'a pas ete modifie ;
- `src/components/InvoiceGenerator.jsx` n'a pas ete modifie ;
- Supabase, localStorage, les payloads et les calculs visibles ne sont pas modifies.

Le Rules Engine repond uniquement a la question : quelles regles actuelles sont applicables dans ce contexte ?

## 2. Inventaire des regles actuelles

| Identifiant | Nom | Fichier actuel | Fonction actuelle | Entrees | Valeur actuelle | Sortie | Date d'effet | Source actuelle | Duplication | Confiance | Risque | Proprietaire futur |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CONTRIBUTION_RATE_SERVICES` | Cotisations services | `src/utils/obligations.js` | `getRate` | `activity_type` | `0.22` | taux base | inconnue | code actuel | oui, App simple | moyenne | fiscal | `contributionRules.js` |
| `CONTRIBUTION_RATE_COMMERCE` | Cotisations commerce | `src/utils/obligations.js` | `getRate` | `activity_type` | `0.123` | taux base | inconnue | code actuel | oui, App simple a 12% | moyenne | fiscal | `contributionRules.js` |
| `CONTRIBUTION_RATE_MIXTE` | Cotisations mixte | `src/utils/obligations.js` | `getRate` | `activity_type` | `0.18` | taux base | inconnue | code actuel | oui, App simple a 17% | faible | approximation | `contributionRules.js` |
| `CONTRIBUTION_RATE_UNKNOWN_FALLBACK` | Activite inconnue | `src/utils/obligations.js` | `getRate` | activite inconnue | `0` | aucun taux | inconnue | code actuel | non | faible | estimation bloquee | `contributionRules.js` |
| `CONTRIBUTION_SIMPLE_ASSISTANT_PERCENTAGE` | Taux onboarding simple | `src/App.jsx` | `getSimpleChargeRate` | `activity_type` | services 22, commerce 12, fallback/mixte 17 | pourcentage affiche | inconnue | code actuel | oui | faible | incoherence | `contributionRules.js` |
| `ACRE_CURRENT_12_MONTHS_HALF_RATE` | ACRE courante | `src/utils/obligations.js` | `computeObligations` | ACRE, date, activite | `baseRate / 2`, 12 mois | taux effectif, statut, mois restants | inconnue | code actuel | alertes App | moyenne | fiscal/date | `acreRules.js` |
| `VAT_THRESHOLD_SERVICES` | TVA services | `src/utils/obligations.js` | `computeObligations` | activite, CA | 36 800, proche a 80% | ok/soon/exceeded | inconnue | code actuel | oui, App simple | moyenne | seuil non verifie | `vatRules.js` |
| `VAT_THRESHOLD_COMMERCE` | TVA commerce | `src/utils/obligations.js` | `computeObligations` | activite, CA | 91 900, proche a 80% | ok/soon/exceeded | inconnue | code actuel | Edge Function vente | moyenne | mapping vente/commerce | `vatRules.js` |
| `VAT_THRESHOLD_MIXTE` | TVA mixte | `src/utils/obligations.js` | `computeObligations` | activite, CA | 36 800 | ok/soon/exceeded | inconnue | code actuel | non | faible | simplification | `vatRules.js` |
| `VAT_SIMPLE_ASSISTANT_MONTHLY_WARNING` | TVA onboarding simple | `src/App.jsx` | `buildSimpleAssistantGuidance` | CA mensuel | > 36 800 danger, > 30 000 warning | tone/alerte | inconnue | code actuel | oui | faible | seuil mensuel divergent | `vatRules.js` |
| `DEADLINE_URSSAF_MONTHLY_LAST_DAY_NEXT_MONTH` | Echeance mensuelle | `src/utils/obligations.js` | `nextMonthlyDeadline` | date courante | dernier jour mois suivant | deadline | inconnue | code actuel | rappels App | moyenne | dates simplifiees | `deadlineRules.js` |
| `DEADLINE_URSSAF_QUARTER_SIMPLIFIED` | Echeance trimestrielle | `src/utils/obligations.js` | `nextQuarterDeadline` | date courante | 30/04, 31/07, 31/10, 31/01 | deadline | inconnue | code actuel | rappels App | moyenne | dates simplifiees | `deadlineRules.js` |
| `INVOICE_CURRENT_STATUS_AND_VAT` | Facture courante | `InvoiceGenerator.jsx`, `facturx.js`, `App.jsx` | plusieurs | statut, TVA mode, facture | paid/unpaid/draft, TVA 20/0, localOnly, Factur-X draft | regle facture | inconnue | code actuel | non | moyenne | Factur-X non valide officiellement | `invoiceRules.js` |
| `PREMIUM_ACCESS_MATRIX_CURRENT` | Acces premium | `src/config/accessMatrix.js`, `pricing.js` | `getAccessProfile` | etat compte/premium | matrix actuelle, limites pricing | acces/features | technique | config actuelle | non | moyenne | offre produit | `premiumRules.js` |
| `PREMIUM_TRIGGER_CURRENT` | Trigger premium | `src/App.jsx` | `getPremiumTrigger` | trial, deadline, revenus, activite | 7 jours, 3 revenus, 7 jours inactif | trigger | technique | code actuel | non | moyenne | UX premium | `premiumRules.js` |
| `PREMIUM_TRIAL_DAYS_LEFT` | Jours essai | `src/App.jsx` | `getTrialDaysLeft` | `trialEndsAt` | ceil diff jours, min 0 | jours restants | technique | code actuel + migrations trial | non | moyenne | timezone/date | `premiumRules.js` |

## 3. Sources techniques

Sources analysees :

- `src/App.jsx` ;
- `src/utils/obligations.js` ;
- `src/components/InvoiceGenerator.jsx` ;
- `src/utils/facturx.js` ;
- `src/config/accessMatrix.js` ;
- `src/config/pricing.js` ;
- `src/config/steps.fiscal.js` ;
- `src/domain/` ;
- `supabase/migrations/*.sql` ;
- `supabase/functions/send-reminder/index.ts` ;
- `supabase/functions/send-trial-ending-email/index.ts` ;
- `tests/*.js`.

## 4. Architecture du Rules Engine

Structure creee :

```text
src/domain/rules/
  index.js
  ruleSet.js
  contributionRules.js
  acreRules.js
  vatRules.js
  deadlineRules.js
  invoiceRules.js
  premiumRules.js
```

Le fichier `src/domain/index.js` exporte maintenant le Rules Engine pour les lots futurs.

## 5. Rule sets et versions

Rule set courant :

- `ruleSetId` : `microassist-current-baseline` ;
- `version` : `2026-07-29-lot3-baseline` ;
- `effectiveFrom` : `2026-07-29` ;
- `effectiveTo` : `null` ;
- `status` : `technical_baseline_unverified` ;
- `sourceReference` : extraction technique depuis le code actuel ;
- `notes` : baseline historique, non presentee comme verification juridique.

Aucune date reglementaire n'a ete inventee.

## 6. Regles de cotisations

Regles extraites :

- services : `0.22` ;
- commerce : `0.123` ;
- mixte : `0.18` ;
- activite inconnue : `0`.

Regle complementaire documentee :

- onboarding simple : services `22`, commerce `12`, mixte/fallback `17`.

Decision LOT 3 :

- conserver ces valeurs telles quelles ;
- documenter l'ecart commerce 12% vs 12,3% ;
- ne pas corriger le taux ou le fallback.

## 7. Regles ACRE

Regles extraites :

- ACRE appliquee seulement si `acre === "yes"` et taux de base > 0 ;
- reduction `baseRate / 2` ;
- duree actuelle : 12 mois depuis `acre_start_date` ;
- sans date : ACRE active avec fallback documente ;
- date expiree : retour au taux de base et statut `expired` ;
- statut inconnu : aucune reduction, avertissement possible.

Les tests couvrent les frontieres de date avec `today` injecte.

## 8. Regles TVA

Regles extraites :

- services : seuil `36 800` ;
- commerce : seuil `91 900` ;
- mixte : seuil `36 800` ;
- statut proche si projection annuelle >= `80%` du seuil ;
- statut depasse si projection annuelle >= `100%` du seuil ;
- projection YTD moyenne si `ca_ytd > 0` et `months_with_data > 1` ;
- sinon projection `ca_month * 12`.

Regle App simple documentee :

- danger si revenu mensuel > `36 800` ;
- warning si revenu mensuel > `30 000`.

## 9. Regles d'echeances

Regles extraites :

- mensuel : dernier jour du mois suivant ;
- trimestriel : `30/04`, `31/07`, `31/10`, `31/01` ;
- urgence `soon` si `<= 7` jours ;
- retard si diff negatif ;
- frequence inconnue : pas de date.

Le Rules Engine expose ces regles mais ne remplace pas le calcul d'echeance actif.

## 10. Regles factures

Regles extraites :

- statuts connus : `draft`, `unpaid`, `paid` ;
- statut paiement affiche : `paid` uniquement si status vaut `paid`, sinon `unpaid` ;
- TVA facture : `standard` => 20%, `exempt` ou `later` => 0% ;
- `localOnly` conserve comme indicateur local ;
- brouillon Factur-X : `formatStatus === "facturx_ready_draft"` ;
- transmission : `not_transmitted` ;
- aucune creation automatique de revenu depuis une facture.

## 11. Regles premium / trial

Regles extraites :

- profils d'acces depuis `ACCESS_MATRIX` ;
- limites depuis `PRICING_LIMITS` ;
- trial fondateur : 90 jours dans la matrice/config historique ;
- trial inscription : 90 jours fondateur, 14 jours sinon dans `App.jsx` ;
- fin essai : J-7, J-2, expire ;
- trigger premium : trial <= 7 jours, deadline <= 7 jours, 3 revenus, inactivite >= 7 jours.

## 12. API pure creee

Fonctions exposees :

- `getApplicableRuleSet()` ;
- `getContributionRule(context)` ;
- `getRevenueContributionRule(context)` ;
- `getSimpleAssistantContributionRule(context)` ;
- `getAcreRule(context)` ;
- `getVatRule(context)` ;
- `getSimpleAssistantVatRule(context)` ;
- `getDeadlineRule(context)` ;
- `getInvoiceRule(context)` ;
- `getPremiumRule(context)` ;
- `getPremiumTriggerRule(context)` ;
- `getTrialDaysLeftRule(context)`.

Ces fonctions ne dependent pas de React, DOM, localStorage, Supabase ou fetch.

Les fonctions qui ont besoin du temps acceptent `today` en entree. Elles n'utilisent `new Date()` qu'en fallback compatible avec les comportements actuels.

## 13. Tests unitaires

Fichier cree :

- `tests/rules-engine.test.js`

Tests unitaires couverts :

- version du rule set ;
- cotisations ;
- taux onboarding simple ;
- ACRE avec dates injectees ;
- TVA ;
- echeances ;
- facture ;
- premium ;
- donnees nulles/incompletes.

## 14. Tests de parite

Parite testee contre `computeObligations` :

- taux services ;
- taux commerce ;
- taux mixte ;
- activite inconnue ;
- ACRE active ;
- ACRE expiree ;
- TVA sous seuil ;
- TVA proche ;
- TVA depassee ;
- mensuel ;
- trimestriel ;
- projections TVA.

Parite testee contre les comportements App/config :

- taux onboarding simple ;
- facture payee/non payee ;
- TVA facture 20%/0% ;
- acces premium ;
- triggers premium.

## 15. Integration minimale

Integration applicative realisee :

- export du Rules Engine depuis `src/domain/index.js`.

Aucune autre integration applicative.

Le moteur n'est pas branche dans `App.jsx`, `computeObligations`, `InvoiceGenerator`, Supabase, localStorage ou les composants.

## 16. Anomalies conservees

| Identifiant | Description | Localisation | Risque | Lot futur recommande | Decision actuelle |
| --- | --- | --- | --- | --- | --- |
| `ANOM-CONTRIB-001` | Taux du parcours simple : commerce 12% vs compute 12,3% | `App.jsx#getSimpleChargeRate`, `obligations.js#getRate` | estimation incoherente | LOT 4 Calculation | conserver |
| `ANOM-CONTRIB-002` | Mixte simplifie : 18% dans compute, 17% dans onboarding simple | `App.jsx`, `obligations.js` | approximation | LOT 4 | conserver |
| `ANOM-CONTRIB-003` | Activite inconnue : fallback 0 dans compute, fallback 17% dans onboarding simple | `App.jsx`, `obligations.js` | divergence UX/calcul | LOT 4 | conserver |
| `ANOM-TVA-001` | Seuils TVA codes en dur sans source reglementaire confirmee | `obligations.js` | fiscal | LOT 4/spec reglementaire | conserver |
| `ANOM-TVA-002` | Regle App simple > 30 000 differente de la proximite 80% | `App.jsx#buildSimpleAssistantGuidance` | signal incoherent | LOT 4/Today | conserver |
| `ANOM-DEADLINE-001` | Echeances URSSAF simplifiees | `obligations.js` | date fiscale | LOT Deadline/Calculation | conserver |
| `ANOM-CFE-001` | CFE approximative par paliers internes | `obligations.js` | fiscal | LOT 4 ou lot CFE dedie | conserver |
| `ANOM-FACTURX-001` | Factur-X brouillon non valide par schema officiel | `facturx.js` | conformite facture | LOT Invoice | conserver |
| `ANOM-EDGE-001` | Edge reminder TVA mappe `activity_type === "vente"` alors que le frontend utilise `commerce` | `supabase/functions/send-reminder/index.ts` | incoherence rappel TVA | LOT Notifications | conserver |

## 17. Valeurs sans source reglementaire confirmee

Valeurs conservees sans verification externe :

- cotisations `0.22`, `0.123`, `0.18` ;
- onboarding simple `22`, `12`, `17` ;
- ACRE `50%` / 12 mois ;
- TVA `36 800`, `91 900`, seuil proche `80%`, seuil simple `30 000` ;
- CFE : `5 000`, `10 000`, `20 000`, `30 000`, `50 000`, montants `75`, `150`, `250`, `400`, `600` ;
- echeances trimestrielles simplifiees ;
- premium/trial : 14, 90, 7, 2, 3 revenus, 7 jours inactivite ;
- facture : TVA standard 20%, echeance facture par defaut 30 jours, indemnite 40 EUR.

## 18. Compatibilite Domain Models

Le Rules Engine consomme des contextes simples compatibles avec les modeles LOT 2 :

- `FiscalProfile` : activite, ACRE, TVA, periodicite ;
- `Revenue` : categorie, montant ;
- `Invoice` : statut, TVA mode, `localOnly`, `formatStatus` ;
- `Subscription` : plan, premium, trial ;
- `Deadline` : frequence et date.

Aucun modele LOT 2 n'a ete modifie.

## 19. Compatibilite localStorage

Aucune cle localStorage n'a ete ajoutee, renomme ou supprimee.

Les regles documentent seulement les comportements lies a :

- `microassist_is_premium` ;
- `microassist_exports_<YYYY>_<M>` ;
- donnees invite ;
- preferences et rappels.

## 20. Compatibilite Supabase

Aucune migration, aucune table, aucune RLS et aucune Edge Function n'ont ete modifiees.

Les migrations trial/premium et Edge Functions ont ete analysees uniquement comme sources techniques.

## 21. Resultats build / tests / lint

Validation preliminaire avant rapport :

- `node --test tests/rules-engine.test.js` : OK, 15 tests, 15 passes ;
- `npm run lint` : baseline respectee, 21 erreurs et 29 warnings.

Validation finale complete executee apres creation du rapport :

### Tests Rules Engine et parite

Commande : `node --test tests/rules-engine.test.js`

Resultat :

- 15 tests ;
- 15 passes ;
- 0 fail ;
- duree : 501.416 ms.

Le fichier couvre les tests unitaires du Rules Engine et les tests de parite contre le comportement actuel.

### Tests Domain Models

Commande : `node --test tests/domain-models.test.js`

Resultat :

- 14 tests ;
- 14 passes ;
- 0 fail ;
- duree : 165.6448 ms.

### Build

Commande : `npm run build`

Resultat :

- OK ;
- Vite v7.2.6 ;
- 333 modules transformed ;
- build en 8.75 s ;
- warning historique : certains chunks depassent 500 kB apres minification.

### Lint

Commande : `npm run lint`

Resultat :

- KO attendu selon baseline acceptee ;
- 50 problems ;
- 21 errors ;
- 29 warnings.

Conclusion lint :

- baseline avant LOT 3 : 21 erreurs, 29 warnings ;
- baseline apres LOT 3 : 21 erreurs, 29 warnings ;
- aucune augmentation ;
- aucun probleme lint cree dans `src/domain/rules` ou `tests/rules-engine.test.js`.

### Playwright

Commande : `npx playwright test --reporter=line`

Resultat :

- 11 tests Playwright ;
- 11 passed ;
- duree : 26.1 s.

Observation :

- Playwright execute aussi les tests Node presents dans le workspace avant les tests navigateur, tous verts ;
- warning Babel historique : `src/App.jsx` depasse 500 KB.

## 22. Fichiers crees

- `src/domain/rules/index.js` ;
- `src/domain/rules/ruleSet.js` ;
- `src/domain/rules/contributionRules.js` ;
- `src/domain/rules/acreRules.js` ;
- `src/domain/rules/vatRules.js` ;
- `src/domain/rules/deadlineRules.js` ;
- `src/domain/rules/invoiceRules.js` ;
- `src/domain/rules/premiumRules.js` ;
- `tests/rules-engine.test.js` ;
- `docs/LOT_3_RULES_ENGINE_REPORT.md`.

## 23. Fichiers modifies

- `src/domain/index.js`.

## 24. Risques residuels

- le moteur n'est pas encore branche dans les calculs actifs ;
- les anomalies historiques restent visibles dans le code ancien ;
- la verification reglementaire officielle reste a faire avant toute correction ;
- la baseline lint historique reste rouge mais inchangee ;
- les Edge Functions ne consomment pas encore le Rules Engine.

## 25. Dette reportee

- Calculation Engine LOT 4 ;
- verification officielle des taux/seuils avant correction ;
- suppression des duplications App/Rules seulement apres parite complete ;
- Deadline Engine futur ;
- Invoice/Factur-X P1 ;
- Notification Engine et alignement Edge Functions.

## 26. Rollback

Rollback simple :

1. Supprimer `src/domain/rules/`.
2. Retirer `export * from "./rules/index.js";` de `src/domain/index.js`.
3. Supprimer `tests/rules-engine.test.js`.
4. Supprimer `docs/LOT_3_RULES_ENGINE_REPORT.md`.

Aucune donnee utilisateur, Supabase ou localStorage n'est concernee.

## 27. Decision GO / NO-GO pour LOT 4

Confirmations finales :

- aucun taux n'a change ;
- aucun seuil n'a change ;
- aucun calcul final visible n'a change ;
- aucune donnee persistee n'a change ;
- aucune migration n'a ete executee ;
- aucun payload Supabase n'a change ;
- aucune cle localStorage/sessionStorage n'a change ;
- aucune regle externe non sourcee n'a ete ajoutee ;
- aucune correction reglementaire n'a ete appliquee ;
- aucun comportement utilisateur visible n'a change.

Decision : GO POUR LOT 4.
