# LOT 4 - Gate Review Avant LOT 4A

Date : 2026-07-29\
Objet : audit critique de `docs/LOT_4_CALCULATION_ENGINE_PLAN.md`\
Decision recherchee : pret ou non pour demarrer LOT 4A

## 1. Audit De Couverture

Le plan couvre le noyau principal, mais il sous-estime plusieurs calculs implicites dans `App.jsx`, `InvoiceGenerator`, `ExpertDashboard`, les effets de rappels et les formatters.

| Zone | Calcul | Localisation | Couvert par le plan | Commentaire |
| --- | --- | --- | --- | --- |
| Obligations | taux cotisations services/commerce/mixte | `src/utils/obligations.js` | oui | couvert par B-01/B-03 |
| Obligations | ACRE active, fin, mois restants | `src/utils/obligations.js` | oui | couvert, mais trop tot pour LOT 4A |
| Obligations | projection annuelle TVA | `src/utils/obligations.js` | oui | couvert |
| Obligations | CFE paliers internes | `src/utils/obligations.js` | oui | couvert mais risque eleve |
| Obligations | sante financiere, coverage ratio, epargne | `src/utils/obligations.js` | oui | couvert mais pas assez detaille |
| Obligations | labels `amountEstimatedLabel`, `deadlineLabel`, `tvaHint` | `src/utils/obligations.js` | partiel | plan dit presentation, mais ces labels sont dans la sortie active |
| App | total revenus courant | `src/App.jsx:5394` | oui | couvert |
| App | breakdown activite mixte | `src/App.jsx:5400` | oui | couvert |
| App | CA YTD et mois suivis | `src/App.jsx:5481` | oui | couvert |
| App | preview charges revenu | `src/App.jsx:5606` | oui | couvert |
| App | preview taux arrondi a 0,1% | `src/App.jsx:5626` | partiel | le plan nomme la preview mais pas ce format de taux |
| App | preview advice par seuils 50/300 | `src/App.jsx:5635` | non | calcul UX oublie |
| App | max chart value | `src/App.jsx:5708` | non | calcul graphique implicite |
| App | dashboard confidence | `src/App.jsx:5751` | non | calcul produit implicite |
| App | maturity progress 5 revenus | `src/App.jsx:6052`, `6060` | partiel | seuil 5 couvert, pas le pourcentage |
| App | savings goal et progress | `src/App.jsx:6336`, `14447` | partiel | `savingsGoal` couvert, pas progress/percent |
| App | weekly revenue total et charges semaine | `src/App.jsx:6830` | non | calcul Today oublie |
| App | tracking streak | `src/App.jsx:7027` | non | calcul de comportement oublie |
| App | invoices this month | `src/App.jsx:8553` | non | calcul facture/tableau de bord oublie |
| App | fiscal score | `src/App.jsx:7252` | oui | couvert |
| App | email reminders J2/J7 | `src/App.jsx:1381`, `1404` | partiel | identifie mais tests non definis |
| App | dedupe email cooldown 24h | `src/App.jsx:1445` | non | depend de localStorage et Date.now |
| App | trial labels | `src/App.jsx:3621` | non | formatter date non couvert |
| App | export remaining quota | `src/App.jsx:3707`, `9671` | oui | couvert |
| App | analytics visitor id | `src/App.jsx:910` | non | pas metier fiscal, mais calcul identifiant |
| InvoiceGenerator | date facture +30 jours | `src/components/InvoiceGenerator.jsx:36` | oui | couvert |
| InvoiceGenerator | numero facture invite | `src/components/InvoiceGenerator.jsx:271` | non | depend de Date courante |
| InvoiceGenerator | parse quantite/prix virgule | `src/components/InvoiceGenerator.jsx:284` | partiel | couvert comme montant preview, pas facture |
| InvoiceGenerator | validation dueDate >= invoiceDate | `src/components/InvoiceGenerator.jsx:292` | non | validation-calcul oublie |
| InvoiceGenerator | preview TVA/TTC non arrondie | `src/components/InvoiceGenerator.jsx:607` | partiel | risque de divergence avec Factur-X |
| Factur-X | HT/TVA/TTC arrondi | `src/utils/facturx.js` | oui | couvert |
| Factur-X | score conformite | `src/utils/facturx.js:87` | oui | couvert |
| Factur-X | XML date/money/quantity serialization | `src/utils/facturx.js:366` | partiel | plan dit serialization, mais tests absents |
| Factur-X | download Blob/URL/document | `src/utils/facturx.js:355` | oui hors moteur | doit rester exclu |
| ExpertDashboard | KPIs clients | `src/components/ExpertDashboard.jsx:412` | non | calcul demo/expert oublie |
| ExpertDashboard | dates facture +30 jours | `src/components/ExpertDashboard.jsx:105` | oui | couvert |
| ExpertDashboard | numero facture EXP annee + id | `src/components/ExpertDashboard.jsx:719` | non | calcul identifiant/date |
| ExpertDashboard | total facture fallback | `src/components/ExpertDashboard.jsx:167` | partiel | facture couverte mais pas fallback expert |
| Edge Reminder | cible today + 2 jours | `supabase/functions/send-reminder/index.ts:51` | partiel | identifie, mais exclu |
| Edge Reminder | `daysUntil` email | `supabase/functions/send-reminder/index.ts:103` | oui | edge exclu |
| Edge Reminder | seuil TVA email | `supabase/functions/send-reminder/index.ts:138` | oui | anomalie couverte |
| Edge Trial Email | normalisation email/event payload | `supabase/functions/send-trial-ending-email/index.ts` | non | effet email, pas calcul LOT 4A |

Conclusion couverture : suffisante pour cadrer un futur moteur fiscal, insuffisante pour pretendre couvrir tous les calculs applicatifs. Le plan doit etre lu comme plan fiscal + facture, pas comme inventaire exhaustif de tous les derives UI/produit.

## 2. Calculs Oublies

Oublis principaux a documenter avant extraction large :

- `previewAdvice` avec seuils `<= 50`, `<= 300`.
- `previewRateLabel` arrondi a `Math.round(rate * 1000) / 10`.
- `dashboardConfidence`.
- `dashboardLearningProgress` et `trackingMaturityPercent`.
- `weeklyRevenueTotal`, `weeklyEstimatedCharges`, insights hebdomadaires.
- `dashboardTrackingStreak` et calcul de semaines de suivi.
- `invoicesThisMonth`.
- `savingsProgress` et pourcentages de barre de progression.
- `trialEndsAtLabel`.
- `wasEmailEventHandledRecently` et cooldown email.
- generation de numero facture invite.
- validation `dueDate >= invoiceDate`.
- KPIs et filtres de `ExpertDashboard`.
- calculs d'identifiants analytics ou locaux avec `Date.now`, `Math.random`, `randomUUID`.

Ces oublis ne bloquent pas un LOT 4A reduit, mais bloquent une extraction large de LOT 4.

## 3. Dependances Cachees

| Dependance | Localisation | Risque | Adapter necessaire | Strategie |
| --- | --- | --- | --- | --- |
| React state | `App.jsx` useMemo/useEffect | calculs relies a l'ordre de rendu | aucun pour LOT 4A | ne pas brancher UI |
| useEffect | rappels, emails, sync local/Supabase | extraction pourrait declencher des effets | event adapter futur | exclure LOT 4A |
| Context Auth | `src/context/AuthContext.jsx` | session determine premium/data | auth adapter futur | exclure |
| Supabase | `App.jsx`, Edge Functions | moteur impur si appels directs | repository adapter | exclure |
| localStorage | `App.jsx`, ExpertDashboard | donnees legacy et dedupe | storage adapter | exclure |
| sessionStorage | premium modal/session trigger | comportement par session | storage adapter | exclure |
| Intl/locale navigateur | `toLocaleString`, `toLocaleDateString` | snapshots instables selon runtime | formatter adapter | exclure LOT 4A |
| `Date.now` | trial, tracking, cooldown, revenus | tests non deterministes | clock adapter | obligatoire des LOT 4A dates |
| `new Date` | partout | timezone, invalid date, DST | date adapter | obligatoire si dates incluses |
| `window` | analytics, routing, storage, scroll | runtime browser only | browser adapter | exclure |
| `document` | Factur-X download, main render | DOM side effect | download adapter | exclure |
| `URL` / `Blob` | XML download | side effect navigateur | file adapter | exclure |
| `setTimeout` | UI notices, onboarding, auth | comportement temporel UI | scheduler adapter | exclure |
| `Math.random` | visitor id fallback | non deterministe | id generator adapter | exclure |
| `crypto.randomUUID` | visitor id | browser capability | id generator adapter | exclure |
| Fuseau horaire | date-only, deadlines, invoice due date | decalage silencieux | local date helpers | bloquant si dates dans 4A |
| Locale navigateur | fr-FR labels | affichage different | formatter explicite | pas dans moteur |
| Variables globales | env Edge, `window.gtag` | side effects | infrastructure adapter | exclure |

Point critique : tant que LOT 4A contient des dates, il n'est pas "le plus sur possible". Les helpers dates purs sont utiles, mais ils ont un risque plus eleve que les helpers money/numeric.

## 4. Matrice De Risque

| Calcul | Risque | Difficulte | Impact utilisateur | Dependances | Tests necessaires |
| --- | --- | --- | --- | --- | --- |
| `roundEuro` cotisations | faible | faible | montant charges | Math.round | zero, decimal, negatif historique |
| `roundMoney` facture | moyen | faible | facture/PDF/XML | Number, Math.round | decimals, NaN, negatif, priorites totals |
| parsing montant simple | moyen | faible | revenus/factures | locale implicite | virgule, vide, NaN, negatif |
| taux cotisations via Rules | moyen | moyen | charges | Rules LOT 3 | services/commerce/mixte/inconnu |
| montant cotisations | moyen | faible | dashboard | arrondi euro | parite computeObligations |
| ACRE taux effectif | eleve | moyen | charges | Date, Rules | yes/no/unknown, date absente |
| ACRE mois restants | critique | moyen | charges/alertes | timezone, mois calendaires | today injecte, limites 12/13 mois |
| TVA projection | eleve | moyen | alerte fiscale | taux, CA YTD, mois | YTD moyenne/fallback |
| TVA statut seuil | critique | moyen | risque fiscal | Rules, seuils non verifies | exact seuil, 80%, unknown |
| echeance mensuelle | critique | moyen | rappels/declaration | Date locale | fin mois, fevrier, DST |
| echeance trimestrielle | critique | moyen | rappels/declaration | Date locale | Q1-Q4, annee suivante |
| CFE | eleve | moyen | alerte fiscale | Date, CA annuel | premiere annee, paliers |
| sante financiere | moyen | faible | reserve conseillee | depenses, CA | ratios 0.5/0.8/1.2 |
| labels obligations | eleve | moyen | UI visible | Intl, texte | snapshots exacts |
| aggregats revenus | moyen | moyen | dashboard | dates, arrays | mutation, tri, YTD |
| preview revenu | moyen | moyen | modale | taux, parsing | categories, fallback |
| invoices this month | moyen | faible | dashboard | Date | mois courant, invalid date |
| facture HT/TVA/TTC | eleve | moyen | facture/PDF/XML | arrondi, exemption | standard/exempt/later |
| score conformite facture | moyen | moyen | alerte facture | champs facture | missing/blocking |
| date echeance facture | critique | faible | facture | Date, UTC | +30, DST, fin mois |
| numero facture | moyen | faible | facture | Date.now | pattern stable |
| trial days left | eleve | faible | premium/email | Date.now | J7/J2/J0/invalide |
| email cooldown | eleve | moyen | emails dupliques | localStorage, Date.now | dedupe/cooldown |
| smart alerts | eleve | moyen | Today | ordre, textes | priorite exacte |
| tracking streak | moyen | moyen | motivation UI | dates, sets | duplicates, weeks |
| chart max/height | faible | faible | UI graphique | Math.max | empty, max |

## 5. Sous-Lots Recommandes

LOT 4 est encore trop gros si on le lit comme extraction fiscal + revenus + factures + premium + Today.

Decoupage recommande en sous-lots d'une session :

- LOT 4A.1 : helpers numeriques purs uniquement (`roundEuro`, `roundMoney`, `toFiniteNumberOrZero`, `clampNonNegative`) avec tests.
- LOT 4A.2 : helpers date-only purs, sans branchement (`parseDateOnlyLocal`, `formatDateOnlyLocal`, `addDaysLocalDate`, `diffDaysCeil`) avec tests timezone/fins de mois.
- LOT 4B : cotisations sans ACRE datee, puis ACRE dans le meme lot seulement si les helpers date sont stables.
- LOT 4C : TVA projection/statut.
- LOT 4D : echeances URSSAF.
- LOT 4E : facade `calculateObligationsBaseline` sans App.
- LOT 4F : revenus/aggregats.
- LOT 4G : facture totals et arrondis Factur-X.
- LOT 4H : premium/trial.
- LOT 4I : Today/smart signals.
- LOT 4J : branchement minimal dans `App.jsx`, un seul appel a la fois.

Recommendation critique : renommer le premier lot implementation en `LOT 4A - Pure Shared Numeric Baseline` ou limiter explicitement `LOT 4A` a money + dates sans utiliser ces helpers dans le reste du code.

## 6. Contenu Exact De LOT 4A

GO uniquement pour ce LOT 4A reduit :

- creer `src/domain/calculations/`;
- creer `src/domain/calculations/money.js`;
- creer `src/domain/calculations/dates.js` seulement si aucun branchement applicatif ;
- creer `src/domain/calculations/index.js`;
- creer tests dedies, sans modifier les tests existants sauf ajout de nouveaux tests ;
- exporter uniquement des helpers purs ;
- ne pas importer ces helpers dans `App.jsx`, `obligations.js`, `facturx.js`, composants ou Edge Functions ;
- ne pas importer Supabase, React, localStorage, sessionStorage, DOM ou window ;
- ne pas modifier les Rules ;
- ne pas corriger les seuils ou taux.

Fonctions autorisees :

- `toFiniteNumberOrZero(value)` si elle reproduit explicitement `Number(value) || 0`;
- `roundEuro(value)` avec `Math.round`;
- `roundMoney(value)` avec deux decimales historiques ;
- `clampNonNegative(value)` avec `Math.max(0, Number(value) || 0)`;
- `parseDateOnlyLocal(value)`;
- `formatDateOnlyLocal(date)`;
- `addDaysLocalDate(dateOnly, days)`;
- `diffDaysCeil(from, to)`;
- `startOfLocalDay(date)`.

Tests obligatoires dans LOT 4A :

- aucun side effect ;
- idempotence des helpers ;
- zero ;
- decimales ;
- valeurs invalides ;
- montants negatifs selon contrat historique ;
- 2026-01-31 + 30 jours ;
- 2028-01-31 + 30 jours ;
- date-only stable ;
- DST Europe/Paris ;
- source non mutee.

## 7. Calculs Reportes

A reporter hors LOT 4A :

- cotisations : depend des Rules, du profil et de la parite `computeObligations`.
- ACRE : depend de dates calendaires et du statut fiscal, risque eleve.
- TVA : risque fiscal critique, seuils contradictoires.
- echeances URSSAF : risque timezone et rappel.
- CFE : approximation fiscale non verifiee.
- sante financiere : produit/UX, pas noyau partage.
- revenus YTD et historique : depend des dates et du tri.
- preview revenu : depend UI et categories.
- factures HT/TVA/TTC : depend de Factur-X et de l'arrondi deux decimales, a traiter apres money.
- date echeance facture : attendre helpers dates valides.
- score conformite facture : melange calcul et statut UX.
- premium/trial : depend Date.now, billing state, emails.
- reminders J2/J7 : depend useEffect, Supabase, email dedupe.
- email cooldown : depend localStorage et Date.now.
- smart alerts/priorities : ordre UX visible.
- dashboard score/maturity/streak : UI/product.
- analytics visitor id : non metier et non deterministe.
- ExpertDashboard : zone demo/expert separee.
- Edge Functions : runtime Deno/Supabase, hors moteur frontend.

## 8. Tests Manquants

Bloquants avant extraction large :

- parite exhaustive `computeObligations` sur sorties completes, pas seulement montants.
- tests date-only sans decalage timezone.
- tests ACRE frontieres 0/1/12/13 mois.
- tests seuil TVA exacts : juste sous, egal, juste au-dessus.
- tests inconnus : activite inconnue, frequence inconnue, statut inconnu.
- tests montant negatif par chemin historique.
- tests labels si une sortie de `computeObligations` est reproduite.

Importants :

- tests agregats revenus avec dates invalides et tri.
- tests preview revenu categories vente/service/mixte.
- tests CFE premiere annee et paliers.
- tests `financialHealth` aux seuils 0.5, 0.8, 1.2.
- tests facture standard/exempt/later avec totals fournis et fallback line.
- tests invoice due date fin de mois/DST.
- tests trial J7/J2/J0/invalide.
- tests email cooldown avec clock/storage fake.

Optionnels :

- tests graphiques chart max/height.
- tests dashboard maturity/streak.
- tests ExpertDashboard demo.
- tests analytics visitor id.

## 9. Validation De La Strategie De Parite

Le plan actuel ne garantit pas totalement la parite historique.

Faiblesses :

- il dit "tester contre `computeObligations`", mais ne precise pas si la comparaison porte sur toute la sortie ou seulement quelques champs ;
- il ne fige pas les labels historiques, alors que `App.jsx` lit des labels deja composes ;
- il propose des helpers dates "propres" qui pourraient differer des bugs historiques ;
- il ne definit pas le comportement negatif par chemin : `computeObligations` accepte des CA negatifs via `Number`, Factur-X clamp certains champs a 0, les models normalisent en non negatif ;
- il ne couvre pas assez les calculs dans useEffect et emails ;
- il ne precise pas la granularite acceptable pour les `Date` : instance, timestamp, date-only string ;
- il ne distingue pas "parite exacte" et "amelioration voulue", alors que LOT 4 ne doit pas corriger.

Condition pour garantir la parite :

- chaque extraction doit avoir une fixture historique qui appelle l'ancien code et le nouveau code ;
- tout ecart doit bloquer, sauf si documente comme non branche et non visible ;
- les labels doivent rester dans l'ancien code tant qu'ils ne sont pas snapshotes ;
- les dates doivent etre comparees par timestamp et par `YYYY-MM-DD` local selon le consommateur.

## 10. Dernieres Recommandations

Recommandations avant LOT 4A :

- reduire LOT 4A a helpers shared non branches ;
- ne pas extraire ACRE/TVA/echeances dans le meme sous-lot que les helpers ;
- ne pas brancher `src/domain/calculations/index.js` dans `src/domain/index.js` si cela cree un risque d'import circulaire avec Rules ;
- eviter d'importer les Domain Models dans les helpers shared ;
- definir une convention : le moteur retourne des nombres et dates, jamais des textes longs ;
- garder `computeObligations` actif jusqu'a facade de parite complete ;
- documenter chaque ecart comme regression bloquante ou dette reportee ;
- ne pas toucher Edge Functions dans LOT 4 frontend ;
- ne pas traiter Factur-X dans LOT 4A.

## 11. GO / NO-GO LOT 4A

Decision : GO POUR LOT 4A, mais uniquement avec perimetre reduit.

Le projet n'est pas pret pour un LOT 4A qui extrairait deja cotisations + ACRE + TVA + echeances. Ce perimetre serait trop gros et trop risque pour une seule session.

Contenu exact autorise pour LOT 4A :

- helpers purs `money`;
- helpers purs `dates`;
- tests unitaires nouveaux dedies ;
- aucune integration applicative ;
- aucune modification de source existante ;
- aucune modification de regle ;
- aucune modification de calcul historique ;
- aucune modification UI ;
- aucune modification Supabase/localStorage.

NO-GO pour inclure dans LOT 4A :

- `calculateContribution`;
- `calculateAcre`;
- `calculateVatExposure`;
- `calculateDeclarationDeadline`;
- `calculateObligationsBaseline`;
- revenus ;
- factures ;
- premium ;
- Today ;
- Edge Functions.

Conclusion : LOT 4A peut commencer seulement comme socle technique pur et non branche. Le premier lot mettra en place les primitives testees ; les vrais calculs metier doivent commencer au lot suivant.

## 12. Validation De Cette Etape

Cette etape de Gate Review cree uniquement ce document.

Confirmations :

- aucun fichier source modifie ;
- aucun test modifie ;
- aucun document existant modifie ;
- aucun calcul modifie ;
- aucune regle modifiee ;
- aucune donnee persistee modifiee ;
- seul fichier cree : `docs/LOT_4_GATE_REVIEW.md`.
