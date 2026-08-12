# Microassist V2 - LOT 0 Stabilisation Report

Date d'audit : 2026-07-29\
Branche verifiee : `refactor/saas-shell-v2`\
Objectif du lot : installer un filet de securite avant toute extraction ou refonte.

## 1. Perimetre Execute

LOT execute : `LOT 0 - Stabilisation` uniquement.

Actions autorisees realisees :

- verification Git, branche et etat de travail ;
- verification build initiale et finale ;
- execution des tests Playwright existants ;
- mise a jour de tests de caracterisation obsoletes pour documenter l'etat visible actuel ;
- inventaire technique des flux critiques ;
- creation du present rapport.

Actions volontairement non realisees :

- aucune modification de `src/App.jsx` ;
- aucune modification d'interface, de style, de parcours ou de texte applicatif ;
- aucune modification de Supabase, schema, Edge Function ou RLS ;
- aucun changement de calcul fiscal, TVA, ACRE, cotisations, echeances, revenus ou factures ;
- aucun refactor, deplacement de fichier applicatif, router ou nouvelle architecture.

## 2. Etat Initial

### Git

- Branche courante : `refactor/saas-shell-v2`.
- Etat initial : `?? docs/`.
- Les documents de conception deja crees sont non suivis par Git dans ce workspace.

### Build initial

Commande : `npm run build`\
Resultat : OK.

Observation :

- Vite signale un chunk JavaScript superieur a 500 kB : `assets/index-B8-Bm27d.js` environ 1131 kB, gzip environ 333 kB.
- Ce warning est preexistant et non bloquant pour LOT 0.

### Tests initiaux

Commande : `npx playwright test`

Resultats :

- En sandbox : echec technique `spawn EPERM`.
- Hors sandbox approuve : les tests se lancent mais echouent car ils attendent une ancienne experience Microassist.
- L'application affiche actuellement la landing `Digital Lab` sur `/`, avec une entree projet `MicroAssist - Assistant fiscal SaaS`.
- Les tests existants cherchaient notamment `Entrepreneurs Assistant`, `Commencer gratuitement` et des reperes dashboard Microassist non presents sur l'etat visible actuel.

Decision LOT 0 :

- Les tests ont ete adaptes comme tests de caracterisation de l'etat actuel, sans modifier l'application.

### Lint initial

Commande : `npm run lint`\
Resultat : KO preexistant.

Synthese :

- 52 problemes : 23 erreurs, 29 warnings.
- Principales familles :
  - variables inutilisees dans `src/App.jsx` ;
  - dependances manquantes dans des hooks React ;
  - exports non compatibles avec `react-refresh/only-export-components` dans `InvoiceGenerator.jsx` et `AuthContext.jsx` ;
  - fonctions inutilisees dans `src/utils/obligations.js`.

Decision LOT 0 :

- Pas de correction lint, car elle impliquerait des modifications applicatives hors perimetre.
- Dette documentee comme risque avant extraction.

## 3. Documents De Reference Lus

Documents obligatoires presents dans `docs/` :

- `MICROASSIST_PRODUCT_VISION_2027.md`
- `MICROASSIST_DESIGN_PRINCIPLES.md`
- `UX_BLUEPRINT_V3.md`
- `PRODUCT_BLUEPRINT_V3.md`
- `IMPLEMENTATION_ROADMAP_V3.md`
- `CODING_STANDARDS_V3.md`
- `ARCHITECTURE_AUDIT.md`

Constats utiles pour LOT 0 :

- `IMPLEMENTATION_ROADMAP_V3.md` demande un filet de securite avant extraction.
- `CODING_STANDARDS_V3.md` confirme que la structure cible doit etre introduite progressivement, sans deplacement massif non teste.
- `ARCHITECTURE_AUDIT.md` reste la base de cartographie existante et confirme que `App.jsx` concentre encore beaucoup de responsabilites.

## 4. Carte Rapide Du Projet Actuel

| Zone | Fichiers principaux | Role actuel |
| --- | --- | --- |
| Shell React | `src/App.jsx` | Orchestration principale, etats, navigation, auth, calculs, stockage, affichage |
| Auth | `src/components/AuthGate.jsx`, `src/context/AuthContext.jsx`, `src/lib/supabaseClient.js` | Connexion, inscription, recovery, session Supabase |
| Factures | `src/components/InvoiceGenerator.jsx`, `src/utils/facturx.js` | Creation facture locale, PDF/XML, conformite Factur-X preparatoire |
| Obligations | `src/utils/obligations.js` | Estimation cotisations, ACRE, TVA, echeances URSSAF, sante financiere |
| Expert | `src/components/ExpertDashboard.jsx` | Vue expert locale avec donnees mock/localStorage |
| Tests | `tests/home.spec.js`, `tests/premium.spec.js` | Tests Playwright de caracterisation de la landing actuelle |
| Edge Functions | `supabase/functions/send-reminder`, `supabase/functions/send-trial-ending-email` | Rappels email et email fin d'essai |

## 5. Cartographie De `App.jsx`

`src/App.jsx` depasse 16 000 lignes et porte encore les responsabilites suivantes :

| Zone | Responsabilite actuelle | Risque |
| --- | --- | --- |
| Constantes globales | Cles storage, flags, labels, limites premium, categories, defaults | Couplage fort entre stockage, UI et metier |
| Helpers metier | Taux, dates, ACRE, formatage, fiscal profile, smart priorities | Calculs disperses et duplication avec `obligations.js` |
| App state | Tres nombreux `useState` pour donnees, UI, modales, auth, dashboard | Regression difficile a isoler |
| Navigation | `appView`, deep links, pages legales, dashboard, routes auth | Parcours implicites sans router dedie |
| Auth/session | Ecoute Supabase, recovery, signOut, post-auth, migration invite | Risque donnees locales et session |
| Supabase | Select/upsert/insert/update/delete directement dans `App.jsx` | Non conforme a l'architecture cible repositories/adapters |
| localStorage | Draft, profil, revenus invite, factures, preferences, dismissals | Migration future sensible |
| Dashboard | Derivations, insights, rappels, priorites, badges | Couplage calculs + presentation |
| Revenus | Ajout, suppression, migration locale/distant, categories | Source de verite multiple local/Supabase |
| Factures | Statuts, paiement, edition locale, liens avec revenus | Risque conversion facture -> revenu |
| Modales | Auth, profile, onboarding, factures, premium, reset, feedback | Etat UI entremêle aux decisions produit |

## 6. Flux Critiques Inventories

| Flux | Entrees actuelles | Sorties / donnees | Dependances | Risques de regression |
| --- | --- | --- | --- | --- |
| Premiere visite | `/` | Landing Digital Lab visible, entree MicroAssist | `App.jsx`, assets/styles | Tests obsoletes si la landing change sans decision |
| Acces Microassist | CTA/projet depuis landing | Shell assistant/dashboard selon etat | `appView`, localStorage, auth state | Navigation non routee explicitement |
| Auth inscription | `AuthGate.jsx` | `supabase.auth.signUp`, email redirect | Supabase Auth, URL redirect | Rupture confirmation email |
| Auth connexion | `AuthGate.jsx` | Session Supabase, callback `onAuthSuccess` | Supabase Auth, `App.jsx` | Mauvaise destination post-login |
| Recovery | URL params, `AuthGate.jsx` | `updateUser`, nettoyage params | Supabase Auth, `sessionStorage` | Boucle recovery ou token perdu |
| Revenus invite | Formulaire revenu | `revenues_guest`, `microassist_v1` | localStorage, calculs `App.jsx` | Perte ou double migration |
| Revenus connectes | Formulaire revenu | table `revenues` | Supabase, realtime, local fallback | Duplication, categories perdues |
| Calcul cotisations | Revenus + profil | estimation, taux, reserve | `computeObligations`, helpers App | Changement fiscal involontaire |
| ACRE | Profil + date debut | taux reduit temporaire | `obligations.js`, helpers App | Date frontiere ou duree incorrecte |
| TVA | CA annuel/projete | statut depassement/proximite | Seuils codifies | Faux signal TVA |
| Echeances URSSAF | Periodicite + date | prochaines dates/urgences | `computeObligations`, helpers rappel | Mauvaise date mensuelle/trimestrielle |
| Factures | `InvoiceGenerator` | facture locale, PDF/XML, statut | `facturx.js`, localStorage | Facture consideree a tort comme revenu |
| Rappels | Preferences + echeances | stockage prefs, Edge Function possible | localStorage, table `reminders` | Notification envoyee ou masquee a tort |
| Reset donnees | UI reset | suppression locale/Supabase selon contexte | localStorage, Supabase delete | Perte de donnees non reversible |

## 7. Inventaire Calculs Et Metier

| Domaine | Implementation actuelle | Points a conserver |
| --- | --- | --- |
| Cotisations | `src/utils/obligations.js#getRate`, `computeObligations`, helpers `getEstimatedRate` et `getRevenueContributionRate` dans `App.jsx` | Taux actuels services 22 %, commerce 12,3 %, mixte 18 % |
| ACRE | Reduction `baseRate / 2`, periode 12 mois depuis `acre_start_date`, controles du profil dans `App.jsx` | Ne pas changer la duree ni les conditions |
| TVA | Seuils codifies : services 36 800, commerce 91 900, mixte 36 800 ; alerte proche a 80 % | Ne pas corriger sans Rules Engine source |
| Echeances URSSAF | Mensuel : fin du mois suivant ; trimestriel : 30/04, 31/07, 31/10, 31/01 ; urgence <= 7 jours | Garder exactement les dates actuelles |
| Revenus | Ajout, suppression, categories, migration invite, calcul contribution par revenu | Ne pas changer l'arrondi ni le taux par defaut |
| Factures | `InvoiceGenerator.jsx`, `facturx.js`, statut paye/localOnly, TVA facture standard 20 % sinon 0 % | Ne pas relier automatiquement facture et revenu |
| Rappels | Preferences locales, dismissals dashboard, table `reminders`, Edge Function `send-reminder` | Ne pas modifier la frequence/canal |
| Profil fiscal | `microassist_profile_v1`, table `fiscal_profiles`, table `profiles`, payloads dans `App.jsx` | Ne pas renommer champs ni cles |

Dette metier connue :

- Le taux 22 % reste un comportement existant dans plusieurs chemins de calcul.
- La TVA et CFE utilisent des seuils/tables codifies localement.
- `facturx.js` contient un TODO de validation namespace/schema Factur-X avant production.

## 8. Etats React Importants

Familles d'etats identifiees dans `App.jsx` :

- Auth/session : utilisateur, session, etats de chargement, recovery, pending auth success.
- Navigation : `appView`, pages legales, liens profonds, vue dashboard/projet.
- Donnees metier : revenus, factures, profil fiscal, profil simple, preferences de rappel.
- Formulaires : revenu courant, profil, facture, feedback, reset, premium.
- Dashboard : sections, chart visibility, nudges, checklist, insights, dismissals.
- Premium/trial : statut premium, essai, limites export, interet offre.
- Modales : auth, profil, onboarding, factures, premium, reset, feedback, documents.
- Erreurs/loading : erreurs Supabase, erreurs validation, etats de synchronisation.

Risque principal :

- Les etats UI, metier, persistance et navigation sont encore fortement couples dans un meme composant.

## 9. Acces Supabase

### Auth Client

| Fichier | Operation |
| --- | --- |
| `src/App.jsx` | `supabase.auth.signOut`, `onAuthStateChange`, recuperation session via callbacks |
| `src/components/AuthGate.jsx` | `onAuthStateChange`, `updateUser`, `signUp`, `signInWithPassword`, `resetPasswordForEmail`, `resend` |
| `src/context/AuthContext.jsx` | `getSession`, `onAuthStateChange` |

### Tables Client

| Table | Operations detectees | Fichier |
| --- | --- | --- |
| `profiles` | `select`, `upsert` | `src/App.jsx` |
| `subscriptions` | `select` | `src/App.jsx` |
| `revenues` | `select`, `insert`, `delete` | `src/App.jsx` |
| `invoices` | `select`, `insert`, `update`, `delete` via reset generique | `src/App.jsx` |
| `fiscal_profiles` | `select`, `upsert`, `update`, `delete` | `src/App.jsx` |
| `reminders` | `upsert`, `delete` via reset generique | `src/App.jsx` |
| `offer_interest` | `upsert`, `select` | `src/App.jsx` |

### RPC Et Realtime

| Type | Usage |
| --- | --- |
| RPC | `join_premium_waitlist` |
| Realtime | channels `revenues-${user.id}` et `fiscal-profile-${user.id}` |
| Nettoyage | `supabase.removeChannel(channel)` |

### Edge Functions

| Fonction | Acces |
| --- | --- |
| `send-reminder` | `reminders.select`, `auth.admin.getUserById`, `fiscal_profiles.select`, `reminders.update` |
| `send-trial-ending-email` | `email_events.select`, `email_events.insert` |

### Endpoint Direct

- `src/App.jsx` appelle directement `https://bvymwuokljxgoavfehav.supabase.co/functions/v1/send-trial-ending-email`.

Risque principal :

- Les appels Supabase directs depuis `App.jsx` et composants ne respectent pas encore la cible `repositories/adapters`, mais ils doivent etre conserves tant que l'extraction n'est pas protegee.

## 10. Stockage Local Et Session

| Cle | Support | Usage actuel |
| --- | --- | --- |
| `microassist_v1` | localStorage | Brouillon / donnees principales historiques |
| `microassist_profile_v1` | localStorage | Profil fiscal simple/local |
| `revenues_guest` | localStorage | Revenus en mode invite |
| `guest_invoices` | localStorage | Factures invite/locales |
| `microassist_is_premium` | localStorage | Statut premium local |
| `microassist_reminder_prefs` | localStorage | Preferences de rappels |
| `microassist_dashboard_reminders_dismissed` | localStorage | Rappels dashboard masques |
| `microassist_dashboard_sections` | localStorage | Sections dashboard |
| `microassist_dashboard_top_nudge_dismissed` | localStorage | Nudge dashboard masque |
| `microassist_dashboard_checklist_collapsed` | localStorage | Checklist repliee |
| `microassist_expert_view_demo` | localStorage | Mode demo expert |
| `microassist_first_revenue_onboarding_seen` | localStorage | Onboarding premier revenu |
| `microassist_beta_micro_feedback` | localStorage | Feedback beta |
| `microassist_anonymous_visitor_id` | localStorage | Analytics anonyme |
| `microassist_email_event_*` | localStorage | Dedupe evenements email |
| `beta_seen` | localStorage | Etat beta vu |
| `microassist_profile_conflict_strategy` | localStorage | Strategie conflit profil |
| `microassist_pending_auth_success` | localStorage/sessionStorage | Reprise auth/recovery |
| `microassist_expert_clients` | localStorage | Clients demo expert |
| `microassist_expert_history` | localStorage | Historique demo expert |

Risques :

- Plusieurs cles portent des donnees metier ou quasi metier.
- Toute migration future doit etre defensive, idempotente et reversible.
- Ne pas supprimer les anciennes cles avant validation d'une migration explicite.

## 11. Modales Et Parcours UI Actuels

Parcours/modalites identifiees :

- Auth : connexion, inscription, confirmation email, renvoi email, mot de passe oublie, reset.
- Onboarding : premiere visite, premier revenu, mode invite vers compte.
- Profil fiscal : creation, edition, conflits local/distant, ACRE, periodicite.
- Revenus : ajout, suppression, categories, messages d'aide et limites.
- Factures : generation, preview, export PDF/XML, statut paye, limite export.
- Dashboard : sections, rappels masques, checklist, nudge, insights.
- Premium : essai, badge, waitlist/interet offre, limites.
- Feedback beta : collecte micro feedback.
- Donnees/reset : suppression donnees locales et distantes selon contexte.
- Pages legales/footer : contenu statique et navigation.

Risque :

- Beaucoup de parcours dependent d'etats locaux internes a `App.jsx`, ce qui rend les extractions futures sensibles.

## 12. Tests De Caracterisation

Tests existants avant LOT 0 :

- `tests/home.spec.js`
- `tests/premium.spec.js`

Probleme :

- Les assertions documentaient un ancien etat de l'application et echouaient sur l'etat visible courant.

Modification realisee :

- `tests/home.spec.js` caracterise maintenant la landing actuelle : lien `Digital Lab`, heading principal et CTA `Explorer les solutions`.
- `tests/premium.spec.js` caracterise maintenant la presence de l'entree projet `MicroAssist - Assistant fiscal SaaS` et du lien `Voir le projet`.

Important :

- Ces changements ne creent aucune fonctionnalite.
- Ils ne modifient aucun comportement utilisateur.
- Ils transforment des tests obsoletes en filet de securite minimal contre une regression accidentelle de l'etat actuel.

## 13. Checklist Manuelle Recommandee Avant LOT 1

A executer manuellement avant une extraction auth ou shell :

- Ouvrir `/` et verifier la landing Digital Lab.
- Verifier que l'entree MicroAssist reste visible.
- Ouvrir le projet MicroAssist depuis la landing.
- Tester ouverture/fermeture auth.
- Tester inscription avec email de test.
- Tester connexion avec compte existant de test.
- Tester recovery mot de passe.
- Creer un revenu invite et recharger la page.
- Verifier conservation de `revenues_guest`.
- Generer une facture invite et recharger la page.
- Verifier conservation de `guest_invoices`.
- Modifier profil fiscal local et recharger.
- Verifier estimation cotisations, ACRE, TVA et echeance affichees sans changement visible.
- Tester suppression d'un revenu.
- Tester reset donnees sur environnement de test uniquement.

## 14. Dette Technique Et Placeholders A Conserver

| Dette | Fichier | Decision LOT 0 |
| --- | --- | --- |
| `App.jsx` tres volumineux | `src/App.jsx` | Documenter, ne pas refactorer |
| Calculs dupliques | `App.jsx`, `obligations.js` | Conserver avant extraction testee |
| Acces Supabase directs | `App.jsx`, `AuthGate.jsx`, `AuthContext.jsx` | Conserver avant repositories |
| localStorage disperse | `App.jsx`, `ExpertDashboard.jsx` | Conserver les cles |
| Lint rouge | Plusieurs fichiers | Ne pas corriger dans LOT 0 |
| Factur-X TODO schema | `src/utils/facturx.js` | A traiter dans lot document/facture |
| Persistence facture Supabase future | `InvoiceGenerator.jsx` | A traiter avec migration schema |
| Expert mock/local | `ExpertDashboard.jsx` | A traiter hors P0 ou lot expert |
| Taux/seuils codifies | `App.jsx`, `obligations.js` | A extraire plus tard sans changer |

## 15. Strategie De Rollback

Rollback LOT 0 possible sans perte de donnees :

- Revenir sur `docs/LOT_0_STABILISATION_REPORT.md`.
- Revenir sur `tests/home.spec.js`.
- Revenir sur `tests/premium.spec.js`.

Justification :

- Aucun fichier applicatif n'a ete modifie.
- Aucun schema Supabase, Edge Function ou stockage utilisateur n'a ete modifie.
- Aucune migration locale n'a ete executee.

## 16. Validation Finale

Commandes executees apres creation du rapport :

- `npm run build` : OK.
- `npx playwright test` : OK, 2 tests passes.

Observation build finale :

- Meme warning Vite qu'au build initial : chunk `assets/index-B8-Bm27d.js` superieur a 500 kB.

Controle supplementaire execute :

- `npm run lint`, KO preexistant.

Critere LOT 0 :

- Build vert : oui.
- Tests de caracterisation verts : oui.
- Lint rouge documente comme dette preexistante : oui.
- Comportement applicatif intentionnellement inchange : oui.

Fichiers crees ou modifies pendant LOT 0 :

- `docs/LOT_0_STABILISATION_REPORT.md` : cree.
- `tests/home.spec.js` : test de caracterisation aligne sur la landing actuelle.
- `tests/premium.spec.js` : test de caracterisation aligne sur l'entree projet MicroAssist actuelle.

## 17. Risques Critiques Pour LOT 1

| Risque | Niveau | Mitigation avant extraction |
| --- | --- | --- |
| Lint deja rouge | Eleve | Decider si LOT 1 accepte cette dette ou creer un mini-lot lint sans changement comportemental |
| Tests Playwright tres limites | Eleve | Ajouter caracterisation auth/recovery avant extraction auth |
| `App.jsx` concentre auth + navigation + donnees | Eleve | Extraire par facade/cas d'usage, jamais par grand deplacement |
| localStorage non encapsule | Eleve | Documenter schemas et adapter avant migration |
| Supabase direct depuis UI | Eleve | Introduire repositories sans changer payloads |
| Calculs fiscaux disperses | Eleve | Tests reglementaires avant toute extraction Calculation/Rules |
| Landing Digital Lab vs cible Microassist | Moyen | Clarifier le premier ecran attendu avant refonte shell |
| Edge Functions non alignees avec future Rules Engine | Moyen | Ne pas modifier avant lot notifications/email |

## 18. Decision LOT 0

Etat apres LOT 0 attendu si validation finale passe :

- Application non modifiee.
- Comportement visible intentionnellement inchange.
- Build vert.
- Tests Playwright disponibles alignes sur l'etat courant.
- Dette lint documentee.

Decision proposee :

**NO-GO POUR LOT 1 tant qu'une decision n'est pas prise sur le lint rouge preexistant et sur le niveau minimal de tests auth/recovery.**

Raison :

- Le build peut etre vert et les tests de caracterisation peuvent passer, mais le standard de code demande des tests fiables et une dette documentee.
- L'extraction LOT 1 touche auth/recovery, zone a fort risque, alors que les tests actuels ne couvrent pas encore ces parcours.
