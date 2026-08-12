# Audit technique d'architecture Microassist

Branche auditee : `refactor/saas-shell-v2`

Date de l'audit : 26 juillet 2026

Objectif : documenter l'etat existant avant refonte controlee, sans modifier `App.jsx`, Supabase, les calculs ou les comportements utilisateur.

## 1. Structure actuelle du projet

Le projet est une application React/Vite monolithique cote frontend, avec Supabase pour l'authentification, les donnees persistantes et deux Edge Functions.

Arborescence utile :

- `src/main.jsx` : point d'entree React, montage de l'application.
- `src/App.jsx` : composant central. Il contient la navigation, l'assistant fiscal, le dashboard, les modales, les handlers metier, les acces Supabase et les persistances locales.
- `src/App.css` et `src/index.css` : styles principaux.
- `src/context/AuthContext.jsx` : contexte React autour de la session Supabase.
- `src/lib/supabase.js` : creation du client Supabase via `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
- `src/components/AuthGate.jsx` : modale/parcours d'authentification, inscription, connexion, mot de passe oublie et recuperation.
- `src/components/CGUModal.jsx` : affichage CGU/confidentialite.
- `src/components/InvoiceGenerator.jsx` : formulaire de creation de facture locale Factur-X, PDF et XML.
- `src/components/PricingPage.jsx` : page d'offre/pricing.
- `src/components/ExpertDashboard.jsx` et `ExpertDashboard.css` : espace expert local/demo, portefeuille clients, notes, rappels simules et factures.
- `src/config/steps.fiscal.js` : definition des etapes du questionnaire fiscal.
- `src/config/pricing.js` : limites d'offre, notamment exports.
- `src/config/accessMatrix.js` : matrice d'acces selon profil invité/essai/premium/fondateur.
- `src/utils/obligations.js` : calculs fiscaux principaux.
- `src/utils/facturx.js` : helpers Factur-X, TVA facture, conformite et generation XML.
- `supabase/migrations/*.sql` : migrations existantes pour profils, abonnements, champs fiscal profiles, billing identity et email events.
- `supabase/functions/send-trial-ending-email` : Edge Function d'envoi d'emails lies a l'essai/rappels applicatifs.
- `supabase/functions/send-reminder` : Edge Function de traitement de rappels.
- `tests/*.spec.js` : tests Playwright existants.

## 2. Responsabilites actuelles de `App.jsx`

`App.jsx` est actuellement le conteneur principal de presque toute l'application. Ses responsabilites depassent largement l'affichage :

- routage interne par etat `appView` et synchronisation `history.pushState` / URL ;
- affichage landing, assistant, dashboard, pricing et parcours premium ;
- orchestration de l'assistant fiscal conversationnel ;
- stockage/restauration du brouillon local de l'assistant ;
- lecture et fusion des profils fiscaux locaux/Supabase ;
- detection des conflits entre profil local et profil distant ;
- calcul des indicateurs de dashboard via `computeObligations` et de nombreux `useMemo` locaux ;
- gestion des revenus : formulaire, ajout, suppression, export CSV/PDF, migration invité vers Supabase ;
- gestion des factures : liste, brouillons locaux, statut paye, ouverture du generateur, telechargement XML ;
- gestion des rappels : preferences locales, sauvegarde partielle dans `fiscal_profiles`, creation/upsert de rappel declaration ;
- gestion auth UI : ouverture/fermeture modale, callback email, recovery, logout ;
- gestion premium/trial : statut local QA, profil Supabase, limites d'exports, waitlist, triggers contextuels ;
- notifications et modales globales ;
- analytics client local via `microassist_analytics_*` ;
- resets partiels/complets de l'espace utilisateur.

## 3. Fonctions metier existantes

### Calcul des cotisations

- Source principale : `src/utils/obligations.js`.
- `getRate(activityType)` applique les taux simplifiés :
  - services : `0.22` ;
  - commerce : `0.123` ;
  - mixte : `0.18`.
- `computeObligations(answers)` calcule `estimatedAmount`, `rate`, `baseRate`, `amountEstimatedLabel`, `treasuryRecommended`, `treasuryLabel`, `annualCharges` et `annualNet`.
- Dans `App.jsx`, plusieurs helpers reutilisent/normalisent ces resultats pour le dashboard, les previews de revenu et les cartes de synthese.

### ACRE

- Source principale : `computeObligations`.
- Champs utilises : `answers.acre`, `answers.acre_start_date`, `answers.activity_type`.
- Si ACRE active et taux connu, le taux de cotisations est divise par deux.
- Si une date de debut est presente, la logique calcule une fin a 12 mois, le nombre de mois restants, `acreStatus`, `acreHint` et le retour au taux normal apres expiration.
- `App.jsx` ajoute des labels, alertes et parcours de completion/edition ACRE.

### TVA

- Dans `computeObligations` :
  - seuil services : `36 800 EUR` ;
  - seuil commerce : `91 900 EUR` ;
  - seuil mixte : `36 800 EUR` avec note de simplification ;
  - statut `ok`, `soon` si projection >= 80% du seuil, `exceeded` si projection >= seuil ;
  - labels et recommandations associes.
- Dans `src/utils/facturx.js` :
  - `VAT_MODES` : `exempt`, `standard`, `later` ;
  - `calculateVatRate` applique 20% uniquement au mode standard ;
  - `getInvoiceTotals` consolide HT/TVA/TTC et franchise.
- Dans `App.jsx`, la TVA pilote les alertes, diagnostics, configuration simple et textes pedagogiques.

### Echeances URSSAF

- Source principale : `computeObligations`.
- `nextMonthlyDeadline(today)` retourne le dernier jour du mois suivant.
- `nextQuarterDeadline(today)` retourne les echeances trimestrielles simplifiees : 30 avril, 31 juillet, 31 octobre, 31 janvier.
- `deadlineLabel`, `daysLeft`, `urgency`, `periodLabel` et les recommandations sont derives de `declaration_frequency`.
- `App.jsx` reutilise ces donnees pour les rappels, timeline fiscale, priorites et emails J-2/J-7.

### Revenus

- Etat principal : `revenues`, `revenueForm`, `selectedMonth`, `showAddRevenue`, `showRevenueDetails`.
- Invité : sauvegarde dans `localStorage` sous `revenues_guest`.
- Authentifié : table Supabase `revenues`.
- Fonctions principales : `refreshRevenues`, `saveRevenueToSupabase`, `saveRevenueEntry`, `handleSaveRevenue`, `deleteRevenueFromSupabase`, `handleDeleteRevenue`.
- Calculs associes : total mensuel, historique mensuel, breakdown mixte vente/service, stats, graphiques, projections, exports.

### Factures

- Composants/utilitaires : `InvoiceGenerator.jsx`, `facturx.js`, logique liste dans `App.jsx`.
- Invité/local : `guestInvoices` sous `guest_invoices`, notamment brouillons Factur-X non migres.
- Authentifié : table Supabase `invoices` pour les factures legacy/persistables.
- Fonctions principales : `refreshInvoices`, `handleOpenInvoiceGenerator`, `handleOpenInvoiceFromLatestRevenue`, `handleMarkInvoicePaid`, `downloadInvoiceXmlDraft`.
- La creation courante dans `InvoiceGenerator` genere PDF + XML Factur-X et renvoie `savedToSupabase: false`.

### Rappels

- Preferences par defaut : `DEFAULT_REMINDER_PREFS`.
- Stockage local : `microassist_reminder_prefs`.
- Sauvegarde distante : colonnes `reminder_declaration`, `reminder_tva`, `reminder_cfe`, `reminder_acre`, `reminder_email`, `reminder_sms` dans `fiscal_profiles`.
- Creation/upsert d'un rappel declaration dans `reminders` lors de `saveFiscalProfileToSupabase`.
- Edge Function `send-reminder` lit `reminders`, recupere l'utilisateur et son `fiscal_profiles`, puis met a jour le statut `sent` ou `failed`.

### Profil fiscal

- Source questionnaire : `FISCAL_STEPS`.
- Etat local assistant : `answers`, `stepIndex`, `messages`, `userName`, brouillon `microassist_v1`.
- Profil simple : `microassist_profile_v1`.
- Profil distant : table `fiscal_profiles`.
- Fonctions principales : `sanitizeFiscalAnswers`, `buildFiscalProfilePayload`, `refreshFiscalProfile`, `saveFiscalProfileToSupabase`, `getAssistantAnswersFromProfile`, edition selective du profil, reset profil.
- Champs structurants : statut micro, type d'activite, periodicite declaration, ACRE, dates ACRE/debut activite, TVA mode.

## 4. Etats React importants

Etats globaux/navigation :

- `appView`, `currentPath`, `focusMode`, `hydrated`.
- `authOpen`, `authInitialMode`, `isRecoveryFlow`, `logoutPending`.
- `userProfile`, `subscriptionRecord`, `localPremiumStatus`.
- `fiscalProfile`, `fiscalProfileLoaded`.

Etats assistant/profil :

- `stepIndex`, `answers`, `messages`, `input`, `userName`, `isTyping`.
- `hasDraft`, `lastSavedAt`, `restoredAt`.
- `assistantFieldError`, `assistantEditMode`, `assistantCollapsed`, `helpOpen`.
- `profileEditMode`, `selectedProfileField`, `profileEditDraft`, `pendingStructuredProfileEdit`.
- `profileConflictState`, `profileSyncBlocked`.
- `simpleAssistantProfile`, `showSimpleOnboarding`, `simpleOnboardingStep`, `simpleOnboardingDraft`, `showOnboardingConfirmation`.
- `tvaConfigDraft`, `isEditingTVA`.

Etats dashboard/metier :

- `revenues`, `revenueForm`, `selectedMonth`, `showAddRevenue`, `showRevenueDetails`, `showChart`.
- `invoices`, `guestInvoices`, `invoiceInitialValues`, `invoiceNotice`, `showInvoiceGenerator`.
- `reminderPrefs`, `showReminderModal`.
- `dashboardSections`, `dashboardRemindersDismissed`, `dashboardTopNudgeDismissedType`, `dashboardChecklistCollapsed`.
- `monthlyExportUsage`, `isExportingCsv`, `isExportingPdf`.

Etats modales/feedback/premium :

- `showBetaNotice`, `showCGU`, `showPrivacy`.
- `showPricingModal`, `showFutureAdvancedModal`, `premiumModalSource`.
- `premiumWaitlistEmail`, `premiumWaitlistError`, `isJoiningPremiumWaitlist`, `premiumWaitlistJoined`.
- `showCashImpactModal`, `showTVADiagnosticModal`, `explanationModalType`.
- `showFirstRevenueOnboarding`, `showResetModal`, `resetInProgress`.
- `saveNotice`, `successToast`, `betaMicroFeedbackState`, `betaMicroFeedbackThanks`.

Etats propres a `AuthGate` :

- `mode`, `email`, `password`, `confirmPassword`, `submitting`, `forgotPasswordSent`, `signupCompleted`, `showResendConfirmation`, `resendingConfirmation`, `notice`, `error`, `recoveryCompleted`.

Etats propres a `InvoiceGenerator` :

- `form`, `saving`, `showMissingSiretWarning`.

Etats propres a `ExpertDashboard` :

- `clients`, `selectedClientId`, `activeFilter`, `searchQuery`, `reminderClientId`, `reminderType`, `reminderMessage`, `successMessage`, `clientHistory`, `showAddClientModal`, `addClientError`, `noteClientId`, `noteDraft`, `noteError`, `invoiceClientId`, `invoiceForm`, `invoiceError`, `newClientForm`.

## 5. Acces Supabase

### Auth

- `src/context/AuthContext.jsx`
  - `supabase.auth.getSession()`.
  - `supabase.auth.onAuthStateChange(...)`.
- `src/components/AuthGate.jsx`
  - `supabase.auth.onAuthStateChange(...)`.
  - `supabase.auth.updateUser({ password })`.
  - `supabase.auth.signUp(...)`.
  - `supabase.auth.signInWithPassword(...)`.
  - `supabase.auth.resetPasswordForEmail(...)`.
  - `supabase.auth.resend(...)`.
- `src/App.jsx`
  - `supabase.auth.signOut()`.
  - `supabase.auth.onAuthStateChange(...)`.
  - `supabase.auth.getSession()` via callback/cas de confirmation.

### Tables utilisees cote frontend

- `profiles`
- `subscriptions` : code present mais desactive par `SUBSCRIPTIONS_TABLE_ENABLED = false`.
- `fiscal_profiles`
- `reminders`
- `revenues`
- `invoices`
- `offer_interest`

### Tables utilisees cote Edge Functions

- `email_events`
- `reminders`
- `fiscal_profiles`
- Auth Admin : `auth.admin.getUserById` dans `send-reminder`.

### Select

- `profiles.select("*").eq("id", user.id).maybeSingle()`.
- `profiles.upsert(...).select().single()`.
- `subscriptions.select("*").eq("user_id", user.id).order(...).limit(1)` si active.
- `revenues.select("*").eq("user_id", user.id).order("revenue_date", ...)`.
- `invoices.select("*").eq("user_id", user.id).order("created_at", ...)`.
- `fiscal_profiles.select("*").eq("user_id", user.id).maybeSingle()`.
- `fiscal_profiles.upsert(...).select().single()`.
- `offer_interest.upsert(...).select("id, email, offer_type, source, status")`.
- Edge `send-trial-ending-email` : `email_events.select("id")`.
- Edge `send-reminder` : `reminders.select("*")`, `fiscal_profiles.select("activity_type, declaration_frequency")`.

### Insert

- `revenues.insert(payload)` pendant migration invité.
- `revenues.insert(payload).select().single()` lors de l'ajout de revenu authentifie.
- `invoices.insert(payload)` pendant migration des factures invité legacy.
- Edge `send-trial-ending-email` : `email_events.insert(...)`.

### Update

- `fiscal_profiles.update(payload).eq("user_id", user.id)` pour preferences de rappels.
- `invoices.update({ status: "paid", paid_at }).eq("id", invoice.id).eq("user_id", user.id)`.
- Edge `send-reminder` : `reminders.update({ status: "sent" | "failed" })`.

### Upsert

- `profiles.upsert(profilePayload, { onConflict: "id" })` pour identite facturation, premium/trial/profil utilisateur.
- `fiscal_profiles.upsert(payload, { onConflict: "user_id" })` pour profil fiscal.
- `reminders.upsert(..., { onConflict: "user_id,reminder_type" })` pour rappel declaration.
- `offer_interest.upsert(payload, { onConflict: ... })`.

### Delete

- `fiscal_profiles.delete().eq("user_id", user.id)` pour reset profil.
- `supabase.from(table).delete().eq("user_id", user.id)` pour reset complet sur `revenues`, `invoices`, `reminders`.
- `revenues.delete().eq("id", id)` pour suppression de revenu.

### RPC et fonctions HTTP

- `supabase.rpc("join_premium_waitlist", ...)`.
- `fetch("https://bvymwuokljxgoavfehav.supabase.co/functions/v1/send-trial-ending-email", ...)`.

## 6. Donnees enregistrees dans `localStorage` / `sessionStorage`

### `localStorage`

- `microassist_v1` : brouillon assistant (`version`, `stepIndex`, `answers`, `userName`, `messages`, `appView`, `savedAt`).
- `revenues_guest` : revenus locaux des invites.
- `guest_invoices` : factures locales/invite, dont brouillons Factur-X conserves localement.
- `microassist_is_premium` : fallback/QA premium local.
- `microassist_reminder_prefs` : preferences rappels.
- `microassist_dashboard_reminders_dismissed` : dismissal bloc rappels.
- `microassist_dashboard_sections` : sections dashboard ouvertes/fermees.
- `microassist_dashboard_top_nudge_dismissed` : type de nudge masque.
- `microassist_dashboard_checklist_collapsed` : checklist repliee.
- `microassist_expert_view_demo` : snapshot de partage/demo expert.
- `microassist_first_revenue_onboarding_seen` : onboarding premier revenu deja vu.
- `microassist_beta_micro_feedback` : etat des micro feedbacks beta.
- `microassist_anonymous_visitor_id` : identifiant visiteur local.
- `microassist_email_event_<eventType>_<userId>` : dedupe local d'evenements emails.
- `beta_seen` : modale beta deja vue.
- `microassist_profile_conflict_strategy` : strategie/detection conflit profil local vs distant.
- `microassist_pending_auth_success` : succes auth en attente.
- `microassist_profile_v1` : profil simple/onboarding rapide.
- `microassist_show_chart` : affichage du graphique revenus.
- `microassist_export_usage_<YYYY-MM>` : usage mensuel des exports.
- `microassist_analytics_<YYYY-MM-DD>` : journal analytics client local.
- `microassist_expert_clients` : clients du dashboard expert.
- `microassist_expert_history` : historique expert local.
- Anciennes cles de recovery nettoyees : `microassist_recovery_flow`, `microassist_password_recovery`.

### `sessionStorage`

- `microassist_recovery_flow` et `microassist_password_recovery` : nettoyees lors des sorties de recovery.
- Cles de dedupe de triggers premium/session construites dynamiquement autour des triggers contextuels.

## 7. Modales et parcours utilisateur actuels

- Notice beta au demarrage, masquee via `beta_seen`.
- Authentification (`AuthGate`) : inscription, connexion, mot de passe oublie, renvoi confirmation, recovery password.
- CGU et confidentialite via `CGUModal`.
- Assistant fiscal conversationnel : etapes `FISCAL_STEPS`, reprise de brouillon, nouvelle session, edition.
- Onboarding simple : modal multi-etapes, confirmation de profil, sauvegarde dans `microassist_profile_v1`.
- Edition profil fiscal : edition selective, choix de champ, confirmation structurée si changement important.
- Conflit profil local/distant : choisir profil distant ou conserver brouillon local.
- Ajout de revenu : modal avec montant, date, categorie mixte, client, facture/note, preview cotisations.
- Details de revenu : extension du formulaire et affichage avance.
- Facturation : `InvoiceGenerator`, avertissement SIRET manquant, creation PDF/XML, facture depuis dernier revenu.
- Marquer facture payee et telecharger XML depuis la liste factures.
- Gestion rappels : modal de preferences/etat email/SMS.
- Modales pedagogiques : impact tresorerie, diagnostic TVA, explications URSSAF/CFE/ACRE/TVA.
- Pricing/premium : page pricing, modal premium, waitlist, modal fonctions avancees.
- Reset : reset profil fiscal seul, reset complet de l'espace.
- First revenue onboarding : incitation apres premier revenu.
- Dashboard expert : ajout client, fiche client, rappel simule, note, facture expert.

## 8. Dependances entre fonctions metier et interface

Les dependances sont fortes et majoritairement directes :

- `computeObligations` est appele depuis `App.jsx` avec `dashboardAnswers`, puis ses resultats alimentent labels, cartes, alertes, priorites, emails, exports et timeline.
- Les calculs fiscaux dependent de donnees UI locales (`answers`, `revenues`, `simpleAssistantProfile`, `fiscalProfile`) qui sont combinees dans `App.jsx`.
- La logique ACRE/TVA/URSSAF sert a la fois au calcul, au texte d'aide, aux badges visuels, aux modales pedagogiques et aux triggers premium.
- Les revenus declenchent des effets UI : onboarding premier revenu, collapse assistant, projections, export limits, facture depuis dernier revenu, analytics.
- Les factures melangent logique documentaire, conformite, affichage, localStorage et Supabase dans `App.jsx` + `InvoiceGenerator`.
- Les rappels combinent preferences UI, stockage local, colonnes `fiscal_profiles`, table `reminders`, contenu pedagogique et premium gating SMS.
- Le profil fiscal est au centre de l'assistant, des calculs, du dashboard, des rappels et de la migration invité.

## 9. Elements a conserver sans modifier

- Les taux et seuils actuels utilises par `computeObligations`.
- Le comportement ACRE actuel, y compris duree 12 mois, division du taux par deux et messages d'expiration.
- Les echeances URSSAF simplifiees actuellement codees.
- Le mode TVA facture et la mention `TVA non applicable, art. 293 B du CGI`.
- Le format de brouillon local `microassist_v1` tant que la migration n'est pas explicite.
- Les cles localStorage existantes, pour ne pas casser les sessions invitees.
- Le schema et les usages Supabase existants.
- La matrice d'acces, les limites d'export et le gating premium actuel.
- Les parcours auth/recovery, sensibles aux callbacks URL Supabase.
- La preservation locale des brouillons Factur-X non migres.
- Les tests Playwright existants comme filet de securite initial.

## 10. Elements remplacables par une nouvelle architecture

- Decouper `App.jsx` en shell applicatif, routes/vues, hooks de donnees et composants metier.
- Extraire les acces Supabase dans des services/repositories par domaine : `profiles`, `fiscalProfiles`, `revenues`, `invoices`, `reminders`, `billing`.
- Extraire la persistance locale dans un module unique avec constantes exportees, schemas de lecture/ecriture et migration de versions.
- Creer un domaine fiscal pur autour de `computeObligations`, des normalisations et des adaptateurs de profil.
- Creer un domaine `revenues` pour CRUD, agregations, historique, exports et projections.
- Creer un domaine `invoices` pour Factur-X, conformite, statuts et adaptation local/distant.
- Remplacer les multiples booleens de modales par un gestionnaire de modales ou une machine d'etat legere.
- Remplacer les effets disperses par des hooks dedies : `useFiscalProfile`, `useRevenues`, `useInvoices`, `useReminderPrefs`, `usePremiumAccess`, `useLocalDraft`.
- Isoler le tracking client et les emails automatiques hors du rendu principal.
- Isoler l'espace expert, qui est deja partiellement separe, derriere une vue/module independant.

## 11. Risques de regression

- Perte ou duplication de donnees invite lors de la migration vers Supabase.
- Conflits profil local/distant mal geres, pouvant ecraser un profil fiscal existant.
- Changement involontaire des calculs de cotisations, ACRE, TVA ou echeances.
- Rupture du recovery password Supabase a cause de la logique URL/hash/search.
- Rupture du gating premium/trial et des limites d'export.
- Factures Factur-X locales supprimees ou migrees alors qu'elles sont volontairement conservees.
- Desynchronisation entre `fiscal_profiles`, `profiles` et fallback local premium.
- Preferences de rappels sauvegardees localement mais non refletees dans `fiscal_profiles`.
- Regression mobile ou modales bloquees par la gestion globale `body.style.overflow`.
- Realtime/channels et timers non nettoyes si les effets sont deplaces trop vite.
- Exports PDF/CSV differents si les donnees normalisees changent.
- Tests insuffisants autour des resets, auth callbacks, migration invité et factures.

## 12. Plan de migration progressif propose

1. Geler le comportement actuel par tests de caracterisation.
   - Ajouter des tests unitaires purs autour de `computeObligations`, `facturx.js` et normalisations critiques.
   - Completer Playwright sur les parcours revenu, facture locale, auth modal mocked si possible, reset et dashboard.

2. Introduire des modules sans changer les appels.
   - Exporter les constantes localStorage depuis un module dedie.
   - Creer des services Supabase qui encapsulent exactement les requetes actuelles.
   - Remplacer progressivement les appels directs dans `App.jsx` par ces wrappers a comportement identique.

3. Extraire les hooks de donnees.
   - `useFiscalProfile` pour chargement, sauvegarde, conflit, reset.
   - `useRevenues` pour local/distant, migration, CRUD et agregations simples.
   - `useInvoices` pour local/distant, marquage paye et brouillons Factur-X.
   - `useReminderPrefs` pour localStorage + Supabase.

4. Extraire les vues sans redesign.
   - Garder le HTML/CSS et deplacer seulement les blocs en composants : assistant, dashboard, revenus, factures, profil, modales.
   - Conserver les props proches des etats existants pour limiter le risque.

5. Introduire un shell SaaS v2.
   - Une fois les domaines stabilises, remplacer uniquement la composition/navigation.
   - Brancher les vues existantes dans le nouveau shell sans modifier les calculs.

6. Migrer les modales et parcours.
   - Centraliser l'ouverture/fermeture des modales apres extraction des vues.
   - Garder les noms et conditions actuelles dans une premiere passe.

7. Nettoyer l'ancien `App.jsx`.
   - Quand les tests passent et que les composants extraits sont stables, reduire `App.jsx` a l'orchestration du shell, providers et routes internes.

8. Valider a chaque etape.
   - `npm run build`.
   - Tests Playwright existants.
   - Verification manuelle des parcours sensibles : invité, signup/signin, recovery, migration invité, ajout/suppression revenu, facture PDF/XML, reset, reminders, premium limits.
