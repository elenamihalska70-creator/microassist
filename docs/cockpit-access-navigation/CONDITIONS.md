# Accès et navigation — état avant modification

Baseline examiné : `894e143387c0498053afb7379943c76d07183d8b`, `main`. Cette matrice est relevée avant modification du rendu. Les sélecteurs, droits, dates et tarifs restent hors du LOT.

## Surfaces d'accès/offre du dashboard

| Surface actuelle | Condition exacte | Informations et actions à conserver |
| --- | --- | --- |
| Offre fondateur | `isFounder` (`userProfile.is_founder === true`) | « Offre fondateur — 3 mois Premium offerts » ; aucune action |
| Découverte | Ternaire existant : invité non Premium → aucun bandeau ici ; sinon non Premium et `isEarlyAccessEndingToday`, sinon `isEarlyFullAccess`, sinon `isPostEarlyAccessTrial` | Fin aujourd'hui : texte/liste et `openPremiumModal("early_access_end")` ; découverte active : texte et `handleOpenSmartPriorities` ; après découverte : texte et `openPremiumModal("early_access_end")` |
| Résumé facturation | Toujours dans le dashboard | `premiumBannerContent.line1/line2/line3`, `premiumBannerButtonLabel`, `handleBillingBannerAction` |
| Accès prioritaire | `premiumWaitlistJoined`, dans le résumé facturation | « Accès prioritaire activé », à conserver immédiatement visible |
| Carte de promotion/protection | `shouldShowDashboardPremiumValue && !hasPremiumLikeAccess` | Tout le contenu promotionnel existant, dont les mentions chiffrées ; `openPremiumModal("dashboard_protection")` |
| Pastille QA locale | Élément `qa` de `dashboardLaunchAnchors`, issu de `isQaPremium` | Libellé et texte du mode local ; à déplacer sans déplacer l'élément `saved` |

`premiumBannerContent` est déjà le sélecteur de texte : QA, invité, `trial_active`, `trial_expired`, `premium_active`, `registered_free`. Son contenu n'est pas réécrit. `handleBillingBannerAction` garde le suivi invité `save_follow_clicked`/`dashboard_top` puis signup ; sinon `openPremiumModal(premiumContextualCTA?.source || "dashboard_top")`.

Les états sont ceux du code : QA prioritaire ; sinon invité ; abonnement payé ; fin de test présente (active ou expirée) ; statut Premium du profil ; gratuit. `totalTrialDays` vaut 90 pour fondateur, sinon 14. Les drapeaux de découverte existants utilisent `trialDaysLeft` comparé à `totalTrialDays - 7`. Rien de cela ne doit être recalculé dans un composant de présentation.

CockpitOverview et son action invitée de création de compte restent inchangés. Les erreurs auth/profil, conflits, chargements, états d'enregistrement, `saveNotice`, `successToast` et alertes fiscales restent hors des détails d'accès. La carte promotionnelle de protection n'est pas le moteur d'alertes fiscales ; les véritables alertes et leurs actions ne sont pas déplacées.

## Accès des deux navigations actuelles

Les deux surfaces ont le même garde : `hasProfileCore || simpleAssistantProfile`.

| Accès | Callback/cible avant | Destination après regroupement |
| --- | --- | --- |
| Revenus | `revenusRef.current?.scrollIntoView({ behavior: "smooth" })` | Même référence ; accès aux exports existants de cette section |
| Factures | `facturesRef.current?.scrollIntoView({ behavior: "smooth" })` | Même référence |
| Analyse | `analyseRef.current?.scrollIntoView({ behavior: "smooth" })` | Même référence ; son absence éventuelle dans un contexte partiel reste une absence de cible, comme au baseline |
| Priorités | `prioritesRef.current?.scrollIntoView({ behavior: "smooth" })` | Même référence |
| URSSAF si revenus présents | Lien `https://www.autoentrepreneur.urssaf.fr/`, nouveau contexte ; `trackBetaEvent("urssaf_declare_clicked", { source: "dashboard_control_center" })` | Même lien et suivi |
| Comprendre l'URSSAF sinon | `openExplanationModal("urssaf")` | Même callback/paramètre |
| Partage | `scrollToSection("advisor-share-section")` | Même cible et callback normal |
| Profil | `handleEditProfile` | Même handler et protections |
| Rappels | `scrollToSection("reminders-section")` | Même cible et callback normal |

Les exports CSV/PDF ne sont pas des boutons des deux navigations au baseline : ils sont dans Revenus. Ils y restent avec `handleExportCSV`, `handleExportPDFWithLimit`, les mêmes disabled/quotas et filtres. La destination Revenus rend cet accès explicite, sans créer deux liens vers le même endroit et sans dupliquer les exports.

« Ajouter un revenu » et « Créer une facture » restent exclusivement les raccourcis de CockpitOverview pour cette zone ; aucun ajout de ces actions dans la navigation fusionnée.

Le défilement normal conserve les callbacks existants. En reduced-motion uniquement, la navigation utilise les mêmes références/identifiants avec un déplacement immédiat ; aucune règle métier ou garde ne dépend de ce choix visuel.

## Répartition après regroupement

| État | Résumé immédiatement visible | Détails conservés | Navigation |
| --- | --- | --- | --- |
| Invité sans profil | `premiumBannerContent.line1` invité | Texte de stockage, création de compte | Absente, comme avant |
| Invité avec profil | Même résumé invité | Mêmes informations et signup | 4 sections + URSSAF explicatif, partage, profil, rappels |
| Compte gratuit sans fenêtre de test | Résumé `registered_free`, titre après découverte | Facturation, découverte, protection si le sélecteur l'autorise | 4 sections + 4 outils ; lien officiel URSSAF si revenus |
| Test actif, découverte complète | Résumé `trial_active`, titre découverte | Date et informations existantes, action priorités | Même garde et mêmes cibles |
| Jour de fin de découverte | Résumé `trial_active`, titre de fin | Liste des options, action `early_access_end`, protection selon sélecteur | Identique |
| Test terminé | Résumé `trial_expired`, titre après découverte | Informations de base et Premium, actions distinctes conservées | Identique |
| Premium | Résumé `premium_active` | Informations Premium et bouton existant | Identique |
| Fondateur + Premium | Résumé Premium ET offre fondateur | Informations Premium | Identique |
| Fondateur en découverte | Résumé test ET offre fondateur ET titre découverte | Informations de test existantes | Identique |
| Premium QA local | Résumé QA | Pastille QA et informations locales | Selon le même garde de profil |

`premiumWaitlistJoined` ajoute toujours la confirmation immédiatement visible, sans dépendre de l'ouverture des détails. Aucun formulaire de liste d'attente n'est soumis pour la validation de ce LOT. Les tests de présentation suivent le passage des callbacks au composant, tout en gardant les assertions sur les déclencheurs explicites et l'absence d'ouverture automatique de Premium.

La navigation possède un seul ordre DOM : sections puis outils, également utilisé visuellement. Les raccourcis de création de CockpitOverview, le moteur de priorité, les sections détaillées, les exports, les gardes des modales et les traitements de données sont inchangés. Les seuls hooks ajoutés sont ceux du nouveau composant de présentation (état du repli, identifiant accessible, référence de focus).

La référence publique a été consultée en lecture seule : fond `rgb(247,244,238)`, titres Georgia, textes sans-serif, boutons secondaires verts et rayon 7 px. Les styles du LOT restent sous `.cockpitAccess` et `.cockpitNavigation` ; aucune classe globale `.btn`/`.card` ni feuille du site vitrine n'est modifiée. Les captures et le relevé calculé des styles sont fournis dans le paquet de revue.
