# Microassist V2 - LOT 0.1 Routing Readiness Report

Date : 2026-07-29\
Branche : `refactor/saas-shell-v2`\
Perimetre : preparation securisee du routing, sans commencer LOT 1.

## 1. Resume Executif

LOT 0.1 a ajoute un filet de securite plus fiable autour du routing actuel, de la landing Microassist locale, de l'auth et du recovery.

Point majeur decouvert :

- la configuration Playwright precedente pointait vers `http://localhost:5173` sans `webServer` ;
- un serveur deja lance sur ce port servait une landing `Digital Lab`, ce qui rendait les tests LOT 0 trompeurs ;
- la configuration de test a ete ajustee pour lancer le Vite local du depot sur `127.0.0.1:5174`.

Corrections lint realisees :

- suppression de `endOfMonth`, fonction morte non exportee dans `src/utils/obligations.js` ;
- suppression de `isSecondYear`, variable locale morte dans `src/utils/obligations.js`.

Resultat :

- build OK ;
- Playwright OK : 11 tests passes ;
- lint encore KO : 50 problemes restants, 21 erreurs et 29 warnings ;
- aucun comportement applicatif n'a ete volontairement change.

Decision :

**NO-GO POUR LOT 1** tant que le lint rouge restant n'est pas accepte formellement comme baseline temporaire ou corrige dans un mini-lot dedie.

## 2. Etat Initial

Commandes executees avant correction :

| Controle | Resultat initial |
| --- | --- |
| Branche | `refactor/saas-shell-v2` |
| Git status | `M tests/home.spec.js`, `M tests/premium.spec.js`, `?? docs/` |
| `npm run build` | OK |
| `npm run lint` | KO, 52 problemes : 23 erreurs, 29 warnings |
| `npx playwright test` | OK, 2 tests passes, mais contre serveur 5173 non controle |

Observation importante :

- Les tests initiaux etaient verts car ils caracterisaient le serveur disponible sur `localhost:5173`.
- Apres ajout d'un `webServer` Playwright dedie, les tests ont bien cible le code local Microassist et les assertions Digital Lab sont devenues fausses.
- Les tests ont donc ete realignes sur l'application locale effective.

## 3. Classification Complete Du Lint

| Fichier | Ligne | Regle | Description | Categorie | Risque | Correction LOT 0.1 | Lot futur |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `src/App.jsx` | 1297 | `no-unused-vars` | `trialDaysLeft` defini non utilise | F | Moyen : lie premium/trial | Non | LOT premium/routing apres audit usage |
| `src/App.jsx` | 1367 | `no-unused-vars` | `shouldSendTrialEndingEmail` defini non utilise | F | Moyen : email/trial | Non | LOT notifications/email |
| `src/App.jsx` | 1983 | `no-unused-vars` | prop/param `invoices` non utilise | F | Moyen : helper partage facture/dashboard | Non | LOT Invoice |
| `src/App.jsx` | 1984 | `no-unused-vars` | prop/param `reminderPrefs` non utilise | F | Moyen : rappels | Non | LOT Notification |
| `src/App.jsx` | 3399 | `react-hooks/exhaustive-deps` | dependance manquante `isRecoveryFlow` | D | Eleve : fermeture auth/recovery | Non | LOT 1 Routing/Auth |
| `src/App.jsx` | 3479 | `react-hooks/exhaustive-deps` | dependance manquante `closeAuthModal` | D | Eleve : logout/session | Non | LOT 1 Routing/Auth |
| `src/App.jsx` | 3537 | `no-unused-vars` | `persistedPlan` non utilise | F | Moyen : premium/subscription | Non | LOT premium |
| `src/App.jsx` | 3551 | `no-unused-vars` | `trialHasExpired` non utilise | F | Moyen : trial | Non | LOT premium |
| `src/App.jsx` | 3727 | `react-hooks/exhaustive-deps` | dependance inutile `canExportPdf` | D | Moyen : limites export | Non | LOT premium/export |
| `src/App.jsx` | 3741 | `react-hooks/exhaustive-deps` | dependances inutiles `hasPremiumLikeAccess`, `remainingExports` | D | Moyen | Non | LOT premium/export |
| `src/App.jsx` | 4261 | `no-unused-vars` | `saveReminderPreferences` non utilise | F | Moyen : persistance rappels | Non | LOT Notification |
| `src/App.jsx` | 4522 | `react-hooks/exhaustive-deps` | dependance manquante `saveReminderPrefsToSupabase` | D | Eleve : callback Supabase rappels | Non | LOT Notification |
| `src/App.jsx` | 4818 | `react-hooks/exhaustive-deps` | dependance manquante `refreshRevenues` | D | Eleve : realtime revenus | Non | LOT Revenue |
| `src/App.jsx` | 4869 | `react-hooks/exhaustive-deps` | dependance manquante `refreshFiscalProfile` | D | Eleve : realtime profil | Non | LOT Profile |
| `src/App.jsx` | 5105 | `react-hooks/exhaustive-deps` | dependance manquante `sanitizedAnswers` | D | Eleve : autosave assistant | Non | LOT Profile/Discovery |
| `src/App.jsx` | 5365 | `react-hooks/exhaustive-deps` | dependance manquante `simpleAssistantProfile.declaration_frequency` | D | Moyen : onboarding simple | Non | LOT Discovery/Profile |
| `src/App.jsx` | 5565 | `no-unused-vars` | `trustBadgeLabel` non utilise | F | Faible a moyen : affichage dashboard | Non | LOT UI/dashboard |
| `src/App.jsx` | 5776 | `no-unused-vars` | `chargesEstimateHelper` non utilise | F | Moyen : estimation visible | Non | LOT Calculation |
| `src/App.jsx` | 5779 | `no-unused-vars` | `availableEstimateHelper` non utilise | F | Moyen : estimation visible | Non | LOT Calculation |
| `src/App.jsx` | 5889 | `react-hooks/exhaustive-deps` | `visibleInvoices` recree une dependance instable pour useMemo ligne 6220 | D | Moyen : factures/dashboard | Non | LOT Invoice |
| `src/App.jsx` | 5889 | `react-hooks/exhaustive-deps` | `visibleInvoices` instable pour useMemo ligne 6927 | D | Moyen | Non | LOT Invoice |
| `src/App.jsx` | 5889 | `react-hooks/exhaustive-deps` | `visibleInvoices` instable pour useMemo ligne 7068 | D | Moyen | Non | LOT Invoice |
| `src/App.jsx` | 5889 | `react-hooks/exhaustive-deps` | `visibleInvoices` instable pour useMemo ligne 7197 | D | Moyen | Non | LOT Invoice |
| `src/App.jsx` | 5889 | `react-hooks/exhaustive-deps` | `visibleInvoices` instable pour useMemo ligne 8561 | D | Moyen | Non | LOT Invoice |
| `src/App.jsx` | 5977 | `no-unused-vars` | `dashboardEmptyDataMessage` non utilise | F | Faible a moyen : dashboard | Non | LOT Today/dashboard |
| `src/App.jsx` | 6004 | `no-unused-vars` | `reliabilityBadge` non utilise | F | Moyen : fiabilite affichage | Non | LOT Today/dashboard |
| `src/App.jsx` | 6447 | `react-hooks/exhaustive-deps` | dependance manquante `openReminderManager` | D | Moyen : action dashboard | Non | LOT Notification/Today |
| `src/App.jsx` | 6497 | `react-hooks/exhaustive-deps` | dependance manquante `openPremiumModal` | D | Moyen : gating premium | Non | LOT premium |
| `src/App.jsx` | 6571 | `react-hooks/exhaustive-deps` | dependance manquante `openPremiumModal` | D | Moyen | Non | LOT premium |
| `src/App.jsx` | 6936 | `no-unused-vars` | `dashboardThisWeekInsight` non utilise | F | Faible a moyen | Non | LOT Today/dashboard |
| `src/App.jsx` | 6974 | `no-unused-vars` | `dashboardPositiveMomentum` non utilise | F | Faible a moyen | Non | LOT Today/dashboard |
| `src/App.jsx` | 7323 | `react-hooks/exhaustive-deps` | dependance inutile `trialDaysLeft` | D | Moyen : depend du retrait eventuel de variable | Non | LOT premium |
| `src/App.jsx` | 8317 | `no-unused-vars` | `shouldShowDashboardTopNudge` non utilise | F | Moyen : nudge dashboard | Non | LOT Today/dashboard |
| `src/App.jsx` | 8562 | `no-unused-vars` | `dashboardMonthlyReflection` non utilise | F | Faible a moyen | Non | LOT Today/dashboard |
| `src/App.jsx` | 8783 | `no-unused-vars` | `handleReminderToggle` non utilise | F | Moyen : prefs rappel | Non | LOT Notification |
| `src/App.jsx` | 8839 | `react-hooks/exhaustive-deps` | `handleOpenRevenuePopup` rend des useMemo instables ligne 6520 | D | Eleve : ouverture revenu | Non | LOT Revenue/Today |
| `src/App.jsx` | 8839 | `react-hooks/exhaustive-deps` | `handleOpenRevenuePopup` rend des useMemo instables ligne 6620 | D | Eleve | Non | LOT Revenue/Today |
| `src/App.jsx` | 8930 | `react-hooks/exhaustive-deps` | `openReminderManager` rend useMemo instable ligne 6808 | D | Moyen | Non | LOT Notification/Today |
| `src/App.jsx` | 9122 | `react-hooks/exhaustive-deps` | dependance manquante `closeAuthModal` | D | Eleve : effet auth user change | Non | LOT 1 Routing/Auth |
| `src/App.jsx` | 9401 | `react-hooks/exhaustive-deps` | `deleteRevenueFromSupabase` instable pour callback ligne 8960 | D | Eleve : suppression revenu Supabase | Non | LOT Revenue |
| `src/App.jsx` | 9668 | `no-unused-vars` | `handleExportLimitHit` non utilise | F | Moyen : limites export | Non | LOT premium/export |
| `src/App.jsx` | 9998 | `react-hooks/exhaustive-deps` | dependances manquantes dans callback texte/export/dashboard | D | Moyen : PDF/export | Non | LOT export/dashboard |
| `src/App.jsx` | 10125 | `no-unused-vars` | `handleDownloadTxt` non utilise | F | Faible a moyen : export | Non | LOT export |
| `src/App.jsx` | 10225 | `react-hooks/exhaustive-deps` | `openPremiumModal` instable pour callback ligne 7579 | D | Moyen | Non | LOT premium |
| `src/App.jsx` | 10225 | `react-hooks/exhaustive-deps` | `openPremiumModal` instable pour effet ligne 7662 | D | Moyen | Non | LOT premium |
| `src/App.jsx` | 10723 | `react-hooks/exhaustive-deps` | `handleEditProfile` instable pour useMemo ligne 6199 | D | Eleve : edition profil | Non | LOT Profile |
| `src/App.jsx` | 10723 | `react-hooks/exhaustive-deps` | `handleEditProfile` instable pour useMemo ligne 6808 | D | Eleve : edition profil | Non | LOT Profile |
| `src/App.jsx` | 10934 | `react-hooks/exhaustive-deps` | dependance manquante `handleCloseSimpleOnboarding` | D | Moyen : onboarding | Non | LOT Discovery/Profile |
| `src/components/InvoiceGenerator.jsx` | 73 | `react-refresh/only-export-components` | export d'une fonction non composant dans un fichier composant | E | Moyen : contrat public `generateB2CInvoicePdf` | Non | LOT Invoice |
| `src/context/AuthContext.jsx` | 64 | `react-refresh/only-export-components` | export hook `useAuth` dans fichier provider | E | Moyen : contrat public imports auth | Non | LOT 1 ou mini-lot auth |
| `src/utils/obligations.js` | 30 | `no-unused-vars` | `endOfMonth` jamais appele | A/F | Faible | Oui | Corrige LOT 0.1 |
| `src/utils/obligations.js` | 149 | `no-unused-vars` | `isSecondYear` jamais lu | A/F | Faible | Oui | Corrige LOT 0.1 |

Synthese categories initiales :

- A/F corrigees : 2.
- D hooks React conservees : 29 warnings.
- E react-refresh conservees : 2 erreurs.
- F code mort ou variables inutilisees conservees dans `App.jsx` : 19 erreurs.

## 4. Corrections Lint Realisees

Fichier modifie : `src/utils/obligations.js`.

Corrections :

- suppression de `endOfMonth(date)`, fonction locale non exportee, jamais appelee ;
- suppression de `const isSecondYear = businessYear === 2`, variable locale jamais lue.

Justification :

- aucune valeur de sortie de `computeObligations` ne dependait de ces deux elements ;
- aucun import externe n'etait possible pour `endOfMonth` ;
- aucun comportement fiscal n'a ete modifie.

## 5. Erreurs Lint Volontairement Conservees

Les erreurs restantes sont conservees parce qu'elles touchent des zones sensibles :

- `App.jsx` : variables et handlers potentiellement lies a dashboard, premium, rappels, exports, revenus, profil ou auth ;
- hooks React : toute correction peut changer l'ordre ou la frequence d'effets sensibles ;
- `AuthContext.jsx` : separer le hook `useAuth` modifierait le contrat d'import et doit etre fait avec LOT 1 ou un mini-lot auth ;
- `InvoiceGenerator.jsx` : separer `generateB2CInvoicePdf` doit attendre LOT Invoice ou une extraction documentee.

Etat final lint :

- 50 problemes restants ;
- 21 erreurs ;
- 29 warnings.

## 6. Cartographie Auth

| Transition | Declencheur | Etat initial | Action Supabase | Etat final attendu | Stockage | Responsable | Risque |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Utilisateur non connecte | Chargement app | session inconnue | `getSession` dans `AuthContext` | `user=null`, `loading=false` | Supabase local session | `AuthContext.jsx` | Session mal lue |
| Ouverture auth signup | Clic `Créer mon compte` | visiteur ou decouverte | aucune | `AuthGate` mode signup | React state `authOpen`, `authInitialMode` | `App.jsx` | Modal masquee par onboarding |
| Passage signup -> signin | Clic `Connexion` | modal signup | aucune | formulaire connexion | React state `mode` | `AuthGate.jsx` | Confusion inscription/connexion |
| Inscription | Submit signup | email/mdp valides | `supabase.auth.signUp` | email confirmation ou session directe | Supabase Auth, URL redirect | `AuthGate.jsx` | Email reel si non mocke |
| Confirmation email demandee | signUp sans session | inscription OK | retour signUp | notice confirmation | React state `signupCompleted` | `AuthGate.jsx` | Confondre confirmation et connexion |
| Renvoi confirmation | Clic renvoi apres email non confirme | signin avec email | `supabase.auth.resend` | notice renvoi | aucun local | `AuthGate.jsx` | Rate limit, email reel |
| Connexion | Submit signin | email/mdp valides | `signInWithPassword` | `onSuccess`, pending auth | `microassist_pending_auth_success` | `AuthGate.jsx`, `App.jsx` | Destination post-auth |
| Erreur connexion | Auth error | signin | `signInWithPassword` KO | message erreur | aucun | `AuthGate.jsx` | Message trop vague |
| Session existante | Chargement | session stockee Supabase | `getSession` | user hydrate | Supabase local session | `AuthContext.jsx` | Session expiree non differenciee |
| Deconnexion | Clic deconnexion | user connecte | `supabase.auth.signOut` | landing + etats runtime nettoyes | local/session cleanup partiel | `App.jsx` | Perte donnees locales |
| Destination post-auth | `PENDING_AUTH_SUCCESS_KEY` + user | user hydrate | refresh profils/revenus/factures | dashboard ou deep link | `microassist_pending_auth_success`, `beta_seen` | `App.jsx` | Migration silencieuse, mauvais deep link |

## 7. Cartographie Recovery

| Transition | Declencheur | Etat initial | Action Supabase | Etat final attendu | Stockage | Responsable | Risque |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mot de passe oublie | Clic bouton en signin | email saisi | `resetPasswordForEmail` | notice email envoye | aucun | `AuthGate.jsx` | Email reel en test si non mocke |
| Validation email recovery absent | Clic sans email | signin | aucune | erreur locale | aucun | `AuthGate.jsx` | Couverture UI seulement |
| Callback recovery URL | URL `type=recovery` | visiteur/session callback | `onAuthStateChange` ou lecture URL | modal recovery | URL search/hash | `App.jsx`, `AuthGate.jsx` | Ambigu si token absent |
| PASSWORD_RECOVERY | evenement Supabase | session recovery | `onAuthStateChange` | mode recovery | refs internes | `AuthGate.jsx`, `App.jsx` | Ne pas traiter comme SIGNED_IN |
| Saisie nouveau mot de passe | Submit recovery | mode recovery | `updateUser` | notice succes puis callback complete | aucun | `AuthGate.jsx` | Session recovery requise |
| Recovery termine | timeout succes | recoveryCompleted | aucune directe | dashboard apres nettoyage partiel | URL `mode` nettoyee | `App.jsx` | `type=recovery` peut rester selon URL |
| Lien expire | `error=access_denied` ou `otp_expired` | callback auth | aucune ou verify KO | signin + notice expiree | URL nettoyee partiellement | `App.jsx` | Confusion avec confirmation email |
| Nettoyage stale recovery | Chargement hors recovery | URL/storage stale | aucune | cles recovery supprimees | `microassist_recovery_flow`, `microassist_password_recovery` | `App.jsx` | Suppression trop agressive |

## 8. Cartographie Du Routing Actuel

Le routing actuel n'utilise pas de router dedie. Il repose sur :

- `appView` : `landing`, `assistant`, `dashboard`, `pricing` ;
- `history.pushState` et `popstate` ;
- query `?view=dashboard|assistant|pricing` ;
- priorite aux callbacks auth/recovery dans search/hash ;
- `deepLinkViewPendingRef` pour reporter une destination ;
- `focusMode` pour l'affichage concentre ;
- chemins speciaux `/legal/*` et `/expert-view`.

Transitions caracterisees :

| Route/etat | Comportement actuel | Risque |
| --- | --- | --- |
| `/` | landing Microassist locale | OK apres correction config test |
| `/?view=dashboard` sans user | dashboard mode decouverte, pas auth forcee | Diverge de la notion route privee cible |
| `/?type=recovery` | ouvre recovery, pas signin normal | OK caracterise |
| URL inconnue | rend une surface publique non vide | Pas de 404 explicite |
| Auth redirect avec hash/search | deep link ignore tant que callback auth actif | Sensible |
| Post-auth | pending auth success puis dashboard/deep link | Sensible |

## 9. Tests Ajoutes

Nouveau fichier : `tests/auth-routing.spec.js`.

Tests ajoutes :

- affichage formulaire connexion et passage signup -> signin ;
- passage signin -> mot de passe oublie avec validation email locale ;
- validation native des champs obligatoires signup ;
- erreur auth simulee sans compte reel ;
- confirmation email apres signup simule ;
- detection recovery depuis URL ;
- validation locale des deux mots de passe recovery ;
- mode decouverte distinct d'une session connectee sur `?view=dashboard` ;
- URL inconnue non vide.

Tests existants ajustes :

- `tests/home.spec.js` caracterise la landing Microassist locale ;
- `tests/premium.spec.js` caracterise les blocs `Tarifs & accès`.

Configuration test ajustee :

- `playwright.config.js` lance maintenant `npm run dev -- --host 127.0.0.1 --port 5174`.
- `baseURL` devient `http://127.0.0.1:5174`.
- Objectif : ne plus valider un serveur externe ou deja lance sur `localhost:5173`.

## 10. Tests Manuels Encore Necessaires

Tests non automatises dans LOT 0.1 :

- vraie inscription sur environnement de test dedie ;
- reception reelle email confirmation ;
- lien confirmation email avec `token_hash` valide ;
- renvoi confirmation email avec rate limit ;
- vraie demande recovery email ;
- callback recovery avec tokens Supabase reels ;
- changement de mot de passe avec session recovery reelle ;
- connexion reelle puis refresh session ;
- session expiree ;
- deconnexion avec donnees locales existantes ;
- destination privee demandee avant login avec vrai user ;
- migration locale apres signup avec conflit local/cloud.

Ces tests demandent un environnement Supabase de test ou une strategie de mocks plus profonde.

## 11. Risques Residuels

| Risque | Niveau | Commentaire |
| --- | --- | --- |
| Lint rouge restant | Eleve | `npm run lint` echoue encore |
| Hooks auth/recovery non corriges | Eleve | Corrections non mecaniques, a traiter avec LOT 1 |
| Playwright LOT 0 etait mal cible | Eleve | Corrige par `webServer`, mais rapport LOT 0 garde une observation devenue historique |
| `App.jsx` encore central | Eleve | Routing, auth, storage, metier et UI imbriques |
| Route dashboard accessible en decouverte | Moyen | Comportement actuel caracterise, cible privee a clarifier dans LOT 1 |
| Recovery avec URL incomplete | Moyen | `?type=recovery` ouvre la modale meme sans token |
| React-refresh non corrige | Moyen | Necessite extraction de contrats publics |

## 12. Liste Exacte Des Fichiers Modifies

Fichiers crees :

- `docs/LOT_0_1_ROUTING_READINESS_REPORT.md`
- `tests/auth-routing.spec.js`

Fichiers modifies :

- `playwright.config.js`
- `src/utils/obligations.js`
- `tests/home.spec.js`
- `tests/premium.spec.js`

Fichiers de reference non modifies :

- `docs/MICROASSIST_PRODUCT_VISION_2027.md`
- `docs/MICROASSIST_DESIGN_PRINCIPLES.md`
- `docs/UX_BLUEPRINT_V3.md`
- `docs/PRODUCT_BLUEPRINT_V3.md`
- `docs/IMPLEMENTATION_ROADMAP_V3.md`
- `docs/CODING_STANDARDS_V3.md`
- `docs/ARCHITECTURE_AUDIT.md`
- `docs/LOT_0_STABILISATION_REPORT.md`

## 13. Rollback

Rollback possible :

- supprimer `docs/LOT_0_1_ROUTING_READINESS_REPORT.md` ;
- supprimer `tests/auth-routing.spec.js` ;
- revenir sur `playwright.config.js` ;
- revenir sur `tests/home.spec.js` ;
- revenir sur `tests/premium.spec.js` ;
- revenir sur les deux suppressions dans `src/utils/obligations.js`.

Aucun rollback de donnees utilisateur ou Supabase n'est necessaire.

## 14. Criteres De Sortie

| Critere | Etat |
| --- | --- |
| Documents lus | OK |
| Build final | OK |
| Lint final | KO, 50 problemes restants |
| Tests Playwright final | OK, 11 passes |
| Tests auth/recovery avec mocks | OK |
| Supabase non modifie | OK |
| App.jsx non refactore | OK |
| Routing non extrait | OK |
| UX/calculs non modifies | OK |
| Rollback possible | OK |

## 15. Decision GO / NO-GO Pour LOT 1

**NO-GO POUR LOT 1**

Justification :

- Le filet de tests auth/recovery est nettement meilleur.
- La configuration Playwright cible maintenant le bon workspace.
- Mais le lint reste rouge avec 21 erreurs et 29 warnings.
- Les erreurs restantes dans `App.jsx`, `AuthContext.jsx` et `InvoiceGenerator.jsx` ne sont pas toutes mecaniques et ne doivent pas etre corrigees a la volee dans LOT 1.

Condition pour passer GO :

- soit corriger le lint restant dans un LOT 0.2 dedie sans changement comportemental ;
- soit documenter et accepter explicitement une baseline lint rouge temporaire pour LOT 1, avec liste des erreurs autorisees.
