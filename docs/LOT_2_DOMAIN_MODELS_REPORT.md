# Microassist V2 - LOT 2 Domain Models Report

Date : 2026-07-29\
Branche : `refactor/saas-shell-v2`\
Statut d'entree : GO POUR LOT 2\
Baseline lint acceptee : 21 erreurs, 29 warnings

## 1. Objectif du lot

LOT 2 introduit une premiere couche de modeles domaine et de normalisateurs, sans branchement applicatif et sans modification des comportements existants.

Le lot ne modifie pas :

- `src/App.jsx` ;
- l'interface utilisateur ;
- le routing ;
- les calculs fiscaux ;
- les acces Supabase ;
- les payloads persistants ;
- les cles localStorage ou sessionStorage ;
- les migrations.

L'objectif est de documenter et stabiliser les formes de donnees deja presentes afin de preparer les lots suivants sans inventer de contrat futur.

## 2. Verification du perimetre

### Modeles initialement envisages

Les modeles envisages pendant l'analyse etaient :

- `UserAccount` ;
- `Subscription` ;
- `FiscalProfile` ;
- `BusinessProfile` ;
- `Revenue` ;
- `Client` ;
- `InvoiceItem` ;
- `Invoice` ;
- `Reminder` ;
- `NotificationPreference` ;
- `Deadline` ;
- `Obligation` ;
- `CalculationResult` ;
- `Declaration` ;
- `Document` ;
- `TodayAction` ;
- `MigrationState`.

### Modeles finalement conserves

#### `UserAccount`

Justification code actuel :

- `App.jsx` consomme l'utilisateur Supabase Auth via `user`, `session`, `authUser`, `session.user.id`, `user.email` et les metadonnees associees.
- `AuthContext.jsx` expose la session et l'utilisateur au reste de l'application.

Justification localStorage :

- aucun modele local dedie n'est cree, mais le compte conditionne les donnees invite/connecte et la reprise de session.

Justification Supabase :

- Supabase Auth fournit `id`, `email`, `user_metadata`, `app_metadata`, `created_at`, `updated_at`.

Justification V3 :

- les documents V3 distinguent l'espace invite, connecte et premium ; le compte utilisateur est le pivot minimal de cette distinction.

#### `Subscription`

Justification code actuel :

- `App.jsx` derive les etats premium, essai, plan persiste, acces exports PDF et limitations depuis les profils et abonnements.
- `accessMatrix` et les fonctions premium manipulent deja les notions de plan, statut, periode et trial.

Justification localStorage :

- les etats d'acces locaux et QA premium existent deja dans l'application.

Justification Supabase :

- migrations `profiles` et `subscriptions`, colonnes `is_premium`, `premium_plan`, `premium_since`, `trial_starts_at`, `trial_ends_at`, `trial_status`.

Justification V3 :

- la monetisation, l'essai, le premium et les limites d'export font partie du produit cible.

#### `FiscalProfile`

Justification code actuel :

- `App.jsx` manipule `answers`, `simpleAssistantProfile`, `fiscalProfile`, `sanitizedAnswers` et les champs activite, ACRE, TVA, frequence et dates.
- `src/utils/obligations.js` consomme ces champs pour produire les obligations.

Justification localStorage :

- `microassist_profile_v1` et `microassist_v1.answers` stockent deja des formes historiques du profil fiscal.

Justification Supabase :

- table `fiscal_profiles`, colonnes `activity_type`, `declaration_frequency`, `acre`, `tva_status`, `tva_mode`, `start_date`, `last_declaration_date`, `reminder_*`.

Justification V3 :

- le profil fiscal est le socle des parcours obligations, ACRE, TVA, revenus et rappels.

#### `BusinessProfile`

Justification code actuel :

- `App.jsx` et le generateur de factures exploitent les informations d'identite de l'entreprise, dont SIRET, denomination, adresse et TVA intracommunautaire.

Justification localStorage :

- l'identite de facturation existe dans les donnees facture et profil.

Justification Supabase :

- migration `profiles.billing_identity` et enrichissement de `profiles`.

Justification V3 :

- l'espace fiscal et la facturation doivent reutiliser une identite entreprise stable.

#### `Revenue`

Justification code actuel :

- `App.jsx` manipule `revenues`, `revenueForm`, `visibleRevenues`, les totaux et la suppression/creation de revenus.
- `src/utils/obligations.js` calcule les estimations a partir du chiffre d'affaires.

Justification localStorage :

- `revenues_guest` conserve les revenus invite.

Justification Supabase :

- table `revenues`, operations `select`, `insert`, `update`, `delete`.

Justification V3 :

- les revenus alimentent le cockpit, les estimations et les obligations.

#### `Client`

Justification code actuel :

- `InvoiceGenerator.jsx`, `facturx.js`, les revenus et les factures manipulent deja `client_name`, email, adresse et champs acheteur.

Justification localStorage :

- les factures invite conservent les informations client.

Justification Supabase :

- les factures persistent le client sous forme de payload dans `invoices`.

Justification V3 :

- le parcours facture doit produire des documents coherents avec un client explicite.

#### `InvoiceItem`

Justification code actuel :

- `InvoiceGenerator.jsx` gere les lignes de facture, quantite, prix unitaire, TVA et total.
- `facturx.js` consomme les lignes pour generer les donnees de facture.

Justification localStorage :

- les factures invite contiennent deja des listes de lignes.

Justification Supabase :

- table `invoices`, payload facture incluant les lignes.

Justification V3 :

- la facture V2 reste une fonction metier centrale.

#### `Invoice`

Justification code actuel :

- `App.jsx` manipule `invoices`, `visibleInvoices`, statuts, exports et historique.
- `InvoiceGenerator.jsx` produit et relit la structure facture actuelle.

Justification localStorage :

- les factures invite et brouillons sont conservees localement.

Justification Supabase :

- table `invoices`, operations `select`, `insert`, `update`, `delete`.

Justification V3 :

- le module factures est explicitement conserve et ameliore progressivement.

#### `Reminder`

Justification code actuel :

- `App.jsx` gere les rappels, `reminderPrefs`, les toggles, les echeances et l'ouverture du gestionnaire de rappels.

Justification localStorage :

- `microassist_reminder_prefs` stocke les preferences de rappel.

Justification Supabase :

- table `reminders`, champs `type`, `status`, `due_date`, `scheduled_for`, et colonnes `fiscal_profiles.reminder_*`.
- fonction Edge `send-reminder` exploite les rappels planifies.

Justification V3 :

- les rappels sont un parcours utilisateur cible et un facteur de confiance.

#### `NotificationPreference`

Justification code actuel :

- `DEFAULT_REMINDER_PREFS` et les preferences email/navigateur/frequence existent dans `App.jsx`.

Justification localStorage :

- `microassist_reminder_prefs`.

Justification Supabase :

- `fiscal_profiles.reminder_enabled`, `reminder_days_before`, `reminder_channels`.

Justification V3 :

- le controle utilisateur des rappels doit etre conserve.

#### `Deadline`

Justification code actuel :

- `src/utils/obligations.js` et `App.jsx` manipulent `deadline`, `deadlineDate`, `deadlineLabel`, prochaine declaration et dates d'echeance.

Justification localStorage :

- les echeances derivees sont relues via profil et rappels, sans nouvelle cle locale.

Justification Supabase :

- les rappels utilisent `due_date` et `scheduled_for`, derives d'une echeance.

Justification V3 :

- les echeances URSSAF et TVA sont au coeur de l'assistant fiscal.

#### `Obligation`

Justification code actuel :

- `computeObligations` retourne deja des blocs `next_declaration`, `estimated_amount`, `deadline`, `tva`, `reminders`, `treasury`.

Justification localStorage :

- depend des revenus et du profil fiscal historiques.

Justification Supabase :

- depend de `revenues`, `fiscal_profiles` et `reminders`.

Justification V3 :

- les obligations fiscales sont l'objet principal du cockpit et des parcours assistant.

#### `CalculationResult`

Justification code actuel :

- le resultat de `computeObligations` agrege les calculs existants et les messages affiches dans le cockpit.

Justification localStorage :

- le resultat est derive des donnees deja stockees, sans nouveau stockage.

Justification Supabase :

- le resultat est derive des profils, revenus et rappels Supabase.

Justification V3 :

- les estimations, alertes et syntheses doivent etre separees des futurs composants sans changer les calculs.

### Modeles supprimes car prematures

#### `Declaration`

Supprime car aucun objet declaration persiste autonome n'existe actuellement. Le code manipule des echeances et un profil fiscal, mais pas une table ou structure locale de declaration.

#### `Document`

Supprime car les documents ne sont pas modelises dans le code actuel. Les exports et factures existent, mais aucun contrat generique `Document` n'est persiste.

#### `TodayAction`

Supprime car les actions du jour sont une intention UX V3, pas une structure actuelle exploitee par le code ou la base.

#### `MigrationState`

Supprime car l'etat de migration est documentaire et operationnel. Il n'existe pas de donnees applicatives `MigrationState` dans Supabase, localStorage ou App.

## 3. Verification de la complexite

La structure a ete reduite et divisee par responsabilite :

```text
src/domain/
  constants.js
  index.js
  models.js
  validation.js
  models/
    calculation.js
    identity.js
    invoice.js
    reminder.js
    revenue.js
    shared.js
```

`models.js` est volontairement devenu un fichier d'export. Les normalisateurs sont ranges par domaine fonctionnel pour eviter un fichier central surdimensionne.

Aucune factory generique, aucun registre abstrait et aucune constante future-only ne sont conserves.

Les constantes conservees correspondent a des valeurs deja presentes dans le code, Supabase ou les documents V3 : activite, revenus, declaration, ACRE, TVA, facture, rappel, premium, echeance, dates et devise.

## 4. Normalisateurs et validateurs

Normalisateurs conserves :

- `createUserAccount` ;
- `normalizeSubscription` ;
- `normalizeFiscalProfile` ;
- `normalizeBusinessProfile` ;
- `normalizeRevenue` ;
- `normalizeClient` ;
- `normalizeInvoiceItem` ;
- `normalizeInvoice` ;
- `normalizeReminder` ;
- `normalizeNotificationPreference` ;
- `normalizeDeadline` ;
- `normalizeObligation` ;
- `normalizeCalculationResult`.

Alias de compatibilite conserves :

- `normalizeSupabaseFiscalProfile` ;
- `normalizeLocalFiscalProfile` ;
- `normalizeSupabaseRevenue` ;
- `normalizeLocalRevenue` ;
- `normalizeSupabaseInvoice` ;
- `normalizeLocalInvoice`.

Validateurs conserves :

- `validateFiscalProfile` ;
- `validateRevenue` ;
- `validateInvoice`.

Proprietes verifiees :

- conservation des champs inconnus ;
- idempotence ;
- absence de mutation de l'objet source ;
- conservation des identifiants ;
- conservation des dates locales `YYYY-MM-DD` sans conversion UTC ;
- absence de changement de format monetaire ;
- absence de masquage des valeurs invalides par fallback dans les validateurs.

## 5. Tests ajoutes

Fichier cree :

- `tests/domain-models.test.js`

Couverture ajoutee :

- idempotence de chaque normalisateur conserve ;
- conservation des champs inconnus ;
- absence de mutation de l'objet source ;
- dates locales sans decalage de fuseau ;
- valeurs invalides non masquees par fallback ;
- montants zero ;
- montants negatifs selon le contrat actuel ;
- statuts inconnus ;
- anciennes structures incompletes ;
- compatibilite localStorage ;
- compatibilite Supabase.

## 6. Integration application

Aucune integration applicative n'a ete ajoutee pendant LOT 2.

`App.jsx`, les composants, Supabase, localStorage, le routing, l'UI, les calculs et les payloads persistants ne consomment pas encore les nouveaux modeles.

Cette absence d'integration est volontaire et conforme au perimetre LOT 2.

## 7. Compatibilite historique

Les normalisateurs sont conservateurs :

- ils partent de l'objet source ;
- ils preservent les champs inconnus ;
- ils ajoutent uniquement des champs normalises quand la structure actuelle le justifie ;
- ils ne suppriment pas silencieusement les donnees anciennes ;
- ils ne modifient pas les cles persistantes existantes ;
- ils ne transforment pas les montants en centimes ou en chaines formatees ;
- ils ne convertissent pas les dates locales en UTC ;
- ils ne regenerent pas les identifiants existants.

Structures historiques couvertes :

- profil fiscal local incomplet ;
- revenus invite ;
- revenus Supabase ;
- facture invite legacy ;
- facture Factur-X ;
- preferences de rappel locales ;
- rappels Supabase ;
- resultat `computeObligations`.

## 8. Risques residuels

Risques residuels identifies :

- les modeles ne sont pas encore branches dans l'application ; leur usage reel devra etre introduit progressivement avec tests de non-regression ;
- certaines formes historiques de facture peuvent contenir des champs libres non documentes ; ils sont preserves, mais pas encore interpretes ;
- la baseline lint historique reste ouverte hors du perimetre LOT 2 ;
- les tests Playwright valident les parcours existants, pas encore l'adoption future des modeles.

## 9. Dette volontairement reportee

Dette reportee aux lots suivants :

- extraction applicative progressive depuis `App.jsx` ;
- branchement des normalisateurs dans les lectures Supabase/localStorage ;
- nettoyage de la baseline lint historique ;
- durcissement des contrats TypeScript ou schema, si choisi plus tard ;
- modelisation eventuelle de declarations, documents ou actions du jour seulement quand le code ou Supabase les introduira.

## 10. Fichiers crees et modifies

Fichiers crees ou modifies par LOT 2 :

- `src/domain/constants.js` ;
- `src/domain/validation.js` ;
- `src/domain/index.js` ;
- `src/domain/models.js` ;
- `src/domain/models/shared.js` ;
- `src/domain/models/identity.js` ;
- `src/domain/models/revenue.js` ;
- `src/domain/models/invoice.js` ;
- `src/domain/models/reminder.js` ;
- `src/domain/models/calculation.js` ;
- `tests/domain-models.test.js` ;
- `docs/LOT_2_DOMAIN_MODELS_REPORT.md`.

Fichiers deja modifies par les lots precedents et non modifies pour LOT 2 :

- `src/App.jsx` ;
- `src/utils/obligations.js` ;
- `playwright.config.js` ;
- `tests/home.spec.js` ;
- `tests/premium.spec.js` ;
- `src/navigation/MainNavigation.jsx` ;
- `src/shell/AppShell.jsx` ;
- `tests/auth-routing.spec.js`.

## 11. Validation finale

Commandes obligatoires executees apres creation du rapport :

### `node --test tests/domain-models.test.js`

Premier lancement sandbox : echec environnemental `spawn EPERM`.

Relance hors sandbox :

- 14 tests ;
- 14 passes ;
- 0 fail ;
- duree : 226.8707 ms.

Tests passes :

- `normalizes user account id fields idempotently` ;
- `normalizes subscription fields from profiles and subscriptions` ;
- `normalizes fiscal profile from current local and Supabase shapes` ;
- `normalizes business profile and billing identity without changing ids` ;
- `validates fiscal profile unknown values and bad dates` ;
- `normalizes Supabase and local revenues without dropping historical fields` ;
- `validates revenue zero amount, negative amount and invalid category` ;
- `normalizes client and invoice items from existing invoice structures` ;
- `normalizes legacy and Factur-X invoice structures` ;
- `validates invoice status without masking unknown status` ;
- `normalizes reminders and notification preferences from current storage` ;
- `normalizes deadlines, obligations and calculation results already emitted` ;
- `keeps local date-only values stable across timezone conversion paths` ;
- `normalizes incomplete historical structures defensively`.

### `npm run build`

Resultat : OK.

- Vite v7.2.6 ;
- 333 modules transformed ;
- build termine en 8.25 s ;
- avertissement historique : certains chunks depassent 500 kB apres minification.

### `npm run lint`

Resultat : baseline respectee.

Critere lint LOT 2 :

- maximum 21 erreurs ;
- maximum 29 warnings.

Resultat obtenu :

- 50 problems ;
- 21 errors ;
- 29 warnings.

Les erreurs et warnings restent localises dans le perimetre historique :

- `src/App.jsx` ;
- `src/components/InvoiceGenerator.jsx` ;
- `src/context/AuthContext.jsx`.

Aucun fichier `src/domain` ni `tests/domain-models.test.js` n'ajoute de probleme lint.

### `npx playwright test --reporter=line`

Resultat : OK.

- 11 tests Playwright ;
- 11 passed ;
- duree : 19.8 s.

Parcours valides :

- landing page ;
- acces pricing ;
- modale auth signin/signup ;
- validation locale email/mot de passe ;
- erreur auth simulee ;
- confirmation signup simulee ;
- recovery URL ;
- dashboard invite ;
- URL inconnue avec surface publique non vide.

## 12. Decision

Confirmations LOT 2 :

- aucune logique metier modifiee ;
- aucun taux ou seuil modifie ;
- aucune donnee persistee modifiee ;
- aucune migration executee ;
- aucun payload Supabase modifie ;
- aucune cle localStorage modifiee ;
- aucun comportement visible modifie ;
- aucun modele futur injustifie conserve.

Decision : GO POUR LOT 3.
