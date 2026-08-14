# MICROASSIST PRODUCT BLUEPRINT V3

Architecture produit, domaines metier, donnees, services et strategie d'implementation de Microassist V2.

## Introduction

Ce document traduit `MICROASSIST_PRODUCT_VISION_2027.md`, `MICROASSIST_DESIGN_PRINCIPLES.md` et `UX_BLUEPRINT_V3.md` en architecture produit et technique cible.

Il remplace `PRODUCT_BLUEPRINT_V2.md` comme reference technique future. `PRODUCT_BLUEPRINT_V2.md` reste conserve comme photographie historique de la premiere direction V2, notamment utile pour comprendre les arbitrages anterieurs et les contradictions resolues depuis.

`ARCHITECTURE_AUDIT.md` decrit l'existant : application React/Vite largement centralisee dans `App.jsx`, calculs et parcours encore couples a l'interface, persistance locale et Supabase imbriquees. Le present document decrit la cible a atteindre progressivement. Il ne decrit pas encore le code final, ne cree aucun composant, ne modifie aucun schema Supabase et ne fige aucun calcul fiscal sous forme d'implementation.

Toute implementation future doit respecter les decisions UX validees : `Aujourd'hui` est l'ecran produit principal, le mode decouverte remplace la notion de session temporaire, la confirmation email et le recovery restent separes, la preparation d'une declaration ne vaut jamais transmission officielle, et une facture ne devient pas automatiquement un revenu encaisse.

## 1. Sources De Verite Et Hierarchie

La hierarchie documentaire cible est la suivante :

1. `MICROASSIST_PRODUCT_VISION_2027.md` definit la mission, les utilisateurs, la promesse et la direction produit.
2. `MICROASSIST_DESIGN_PRINCIPLES.md` definit les regles d'experience non negociables.
3. `UX_BLUEPRINT_V3.md` definit les parcours, les ecrans, les etats, les priorites UX et les transitions.
4. `PRODUCT_BLUEPRINT_V3.md` definit l'architecture produit et technique cible.
5. `ARCHITECTURE_AUDIT.md` decrit l'etat technique actuel.
6. `PRODUCT_BLUEPRINT_V2.md` reste une reference historique, mais ne doit plus gouverner les nouveaux choix lorsque ses decisions contredisent V3.

Regle de resolution : en cas de contradiction, la Product Vision et le UX Blueprint valide priment sur les documents plus anciens. `PRODUCT_BLUEPRINT_V3.md` doit donc appliquer les arbitrages valides, meme lorsque l'audit ou V2 decrivent un comportement existant different.

## 2. Principes D'Architecture

L'architecture cible repose sur une modularisation par domaines fonctionnels. Les domaines portent les regles, les transitions et les decisions metier ; l'interface presente ces decisions et collecte les intentions utilisateur.

Principes structurants :

- architecture modulaire par domaines fonctionnels ;
- separation claire entre interface, logique metier, donnees et regles ;
- aucun calcul fiscal directement dans les composants d'interface ;
- aucune regle reglementaire importante dispersee dans plusieurs fichiers ;
- separation entre donnees saisies, donnees confirmees, donnees estimees et donnees calculees ;
- historique des regles et des decisions reglementaires ;
- progressive disclosure pilotee par des etats, pas par du code UI improvise ;
- fonctionnement coherent entre mode decouverte et compte connecte ;
- migration progressive depuis l'architecture existante ;
- tests des regles metier independamment de l'interface ;
- securite et tracabilite par defaut ;
- aucune pretention d'action officielle si le produit ne la realise pas.

Regle fondamentale : les composants d'interface affichent les decisions du domaine. Ils ne doivent pas decider eux-memes des regles fiscales, des priorites, de la validite d'un statut ou de la fiabilite d'une date.

## 3. Architecture Globale De L'Application

### 3.1 Presentation

La couche presentation contient les pages, la navigation, les formulaires, les messages, les etats de chargement, les etats vides, l'affichage mobile et desktop, et les exigences d'accessibilite.

Elle orchestre l'experience sans porter les regles. Elle peut demander a un cas d'usage de charger `Aujourd'hui`, afficher une estimation retournee par le moteur de calcul, ouvrir une confirmation avant suppression, ou presenter un libelle de fiabilite.

La presentation ne doit pas contenir :

- taux fiscaux codes en dur ;
- priorites reglementaires ;
- calculs ACRE ;
- generation de dates reglementaires non validees ;
- decisions metier complexes.

### 3.2 Domaines Metier

Domaines recommandes :

- Auth ;
- Discovery Mode ;
- Today ;
- Profile ;
- Revenue ;
- Declaration ;
- ACRE ;
- Invoice ;
- Deadline ;
- Document ;
- Notification ;
- Settings ;
- Analytics ;
- Assistant.

Chaque domaine contient ses modeles metier, cas d'usage, validations, etats, regles de transition et acces aux services necessaires. Un domaine peut exposer une API applicative simple, mais ne doit pas connaitre les details visuels d'une page.

### 3.3 Services Partages

Services cibles :

- Calculation Engine ;
- Rules Engine ;
- Today Decision Engine ;
- Visibility Engine ;
- Deadline Engine ;
- Notification Engine ;
- Document Engine ;
- Sync and Migration Service ;
- Audit and History Service ;
- Source Registry ;
- Storage Adapter ;
- Authentication Adapter.

Ces services doivent permettre aux domaines de partager des capacites sans recopier de logique. Par exemple, ACRE et Declaration utilisent le Rules Engine, Today utilise le Today Decision Engine, Revenue et Invoice utilisent le Storage Adapter, et Profile utilise l'Audit and History Service avant toute modification sensible.

### 3.4 Infrastructure

L'infrastructure cible peut inclure Supabase Auth, la base Supabase, le stockage local, un stockage securise de documents si valide, un service email, des notifications futures, une generation PDF future, la journalisation et le monitoring.

L'infrastructure doit pouvoir evoluer sans modifier les regles metier fondamentales. Le domaine ne doit pas etre modele uniquement autour des tables existantes si ces tables ne representent plus correctement le produit cible.

## 4. Decoupage Par Domaines

### Auth

Responsabilite : gerer l'identite, les sessions, l'inscription, la connexion, la confirmation email, le recovery, la deconnexion et la protection des routes.

Donnees principales : utilisateur authentifie, email, statut de confirmation, session active, destination demandee, etat recovery, expiration.

Actions utilisateur : creer un compte, se connecter, confirmer son email, demander un reset, definir un nouveau mot de passe, se deconnecter.

Cas d'usage : `createAccount`, `signIn`, `confirmEmail`, `recoverPassword`, `signOut`, `protectPrivateRoute`.

Dependances : Authentication Adapter, Storage Adapter pour destination memorisee, Sync and Migration Service apres creation de compte.

Etats principaux : inconnu, visiteur, connecte non confirme si applicable, connecte confirme, recovery actif, session expiree.

Limites : ne pas melanger confirmation email et recovery ; ne pas afficher les donnees privees si la session n'est pas valide.

Priorite : P0.

### Discovery Mode

Responsabilite : offrir une premiere experience utile sans compte, avec stockage local et limites explicites.

Donnees principales : profil minimal local, revenus locaux, estimations simples, progression locale, statut de migration.

Actions utilisateur : commencer en mode decouverte, completer un profil minimal, ajouter un revenu local, consulter `Aujourd'hui`, creer un compte, demander le transfert.

Cas d'usage : `startDiscoveryMode`, `loadDiscoveryToday`, `saveLocalRevenue`, `migrateDiscoveryData`.

Dependances : local storage adapter, Calculation Engine, Today Decision Engine, Sync and Migration Service.

Etats principaux : aucune donnee locale, profil minimal absent, profil minimal suffisant, revenu local existant, migration proposee, conflit, migration reussie ou echouee.

Limites : pas de stockage cloud, pas de stockage securise de documents, pas de rappels distants, pas de promesse de conservation multi-appareil.

Priorite : P0.

### Today

Responsabilite : presenter la situation actuelle, l'action principale, la prochaine echeance, la reserve conseillee et les prochaines etapes.

Donnees principales : profil, revenus, echeances, statut ACRE, declarations, incoherences, donnees manquantes, niveau de fiabilite.

Actions utilisateur : realiser l'action principale, ouvrir une action secondaire, ajouter un revenu, completer le profil, preparer une declaration, verifier l'ACRE.

Cas d'usage : `loadToday`, `resolveTodayAction`, `dismissSecondaryHint`.

Dependances : Today Decision Engine, Calculation Engine, Deadline Engine, Visibility Engine, domaines Profile, Revenue, Declaration, ACRE.

Etats principaux : profil minimal absent, date officielle manquante, aucun revenu, echeance inconnue, action urgente, rien a faire, incoherence critique.

Limites : une seule action principale ; pas de dashboard analytique en remplacement de `Aujourd'hui`.

Priorite : P0.

### Profile

Responsabilite : gerer les informations de l'activite et les choix fiscaux necessaires aux parcours.

Donnees principales : activite, categorie, activite mixte, SIREN/SIRET, date officielle d'ouverture, periodicite, ACRE, TVA, facturation, compte, version du profil.

Actions utilisateur : completer progressivement, modifier une section, previsualiser l'impact d'une modification sensible, confirmer ou annuler.

Cas d'usage : `updateBusinessProfile`, `previewFiscalProfileChange`, `confirmProfileChange`.

Dependances : Rules Engine, Calculation Engine, Audit and History Service, Storage Adapter.

Etats principaux : absent, minimal, suffisant, a confirmer, incoherent, historique impacte.

Limites : ne jamais recalculer silencieusement des declarations historiques confirmees.

Priorite : P0.

### Revenue

Responsabilite : enregistrer les encaissements reels et les categoriser.

Donnees principales : montant encaisse, date d'encaissement, categorie, description, client facultatif, facture liee facultative, source, statut.

Actions utilisateur : ajouter, modifier, supprimer, filtrer, categoriser, lier a une facture.

Cas d'usage : `addRevenue`, `updateRevenue`, `deleteRevenue`, `listRevenues`, `linkRevenueToInvoice`.

Dependances : Storage Adapter, Calculation Engine, Audit and History Service, Invoice si liaison.

Etats principaux : saisie, valide, erreur validation, sauvegarde locale, sauvegarde cloud, suppression a confirmer, conflit migration.

Limites : la date de facture ne remplace jamais automatiquement la date d'encaissement ; l'activite mixte se gere au niveau de chaque encaissement.

Priorite : P0.

### Declaration

Responsabilite : aider l'utilisateur a preparer sa declaration sans pretendre la transmettre.

Donnees principales : periode, periodicite, revenus inclus, estimation, montant prepare, statut utilisateur, montant paye, date paiement.

Actions utilisateur : preparer une declaration, verifier les revenus, ouvrir le site officiel, confirmer ensuite si la declaration est envoyee, indiquer un probleme.

Cas d'usage : `prepareDeclaration`, `openOfficialDeclarationSite`, `confirmDeclarationStatus`, `recordDeclarationPayment`.

Dependances : Revenue, Calculation Engine, Deadline Engine, Rules Engine, Audit and History Service.

Etats principaux : periode identifiee, donnees insuffisantes, estimation disponible, site officiel ouvert, a confirmer, confirmee par utilisateur, probleme.

Limites : `declaration faite` repose uniquement sur la confirmation de l'utilisateur ; ce statut n'est pas une preuve officielle.

Priorite : P0.

### ACRE

Responsabilite : modeler le statut ACRE, la demande, le suivi, les periodes d'application et les sources.

Donnees principales : statut, date officielle, date demande, date reponse, regle applicable, source, periode, niveau de confirmation.

Actions utilisateur : verifier son statut, indiquer une demande a faire, marquer une demande envoyee, renseigner accord ou refus, corriger les dates.

Cas d'usage : `updateAcreStatus`, `resolveAcreRule`, `previewAcreImpact`, `listAcreActions`.

Dependances : Rules Engine, Calculation Engine, Deadline Engine, Source Registry, Audit and History Service.

Etats principaux : eligibility_unknown, to_apply, application_sent, pending, approved, rejected, deadline_passed, not_eligible, unknown.

Limites : ne jamais considerer automatiquement l'ACRE comme accordee uniquement parce que l'utilisateur semble eligible ; ne pas afficher une duree certaine si la date officielle manque.

Priorite : P0 pour le statut et l'impact sur les calculs ; P1 pour un parcours complet de suivi.

### Invoice

Responsabilite : gerer la facturation comme domaine distinct des encaissements.

Donnees principales : numero, client, lignes, total, dates, statut, paiements, revenu lie eventuel, version.

Actions utilisateur : creer un brouillon, finaliser, marquer payee, lier un encaissement, creer un encaissement depuis paiement, telecharger un PDF futur.

Cas d'usage : `createInvoice`, `finalizeInvoice`, `markInvoicePaid`, `createRevenueFromInvoicePayment`, `generateInvoiceDocument`.

Dependances : Document Engine, Revenue, Storage Adapter, Audit and History Service, Rules Engine pour mentions ou TVA.

Etats principaux : brouillon, finalisee, envoyee si suivi futur, payee, partiellement payee futur, annulee, erreur.

Limites : le module complet est P1 ; une facture creee ne devient pas automatiquement un revenu ; PDF et Factur-X ne doivent etre promis que si reellement implementes.

Priorite : P1 complet, avec distinction conceptuelle P0.

### Deadline

Responsabilite : fournir des echeances fiables, sourcees, priorisees et associees a une action utile.

Donnees principales : type, date, priorite, statut, fiabilite, source, action associee.

Actions utilisateur : consulter, filtrer, marquer a verifier, configurer un rappel interne ou futur.

Cas d'usage : `listDeadlines`, `resolveNextDeadline`, `confirmDeadline`, `attachReminder`.

Dependances : Deadline Engine, Rules Engine, Profile, Declaration, ACRE, Notification.

Etats principaux : connue, estimee, inconnue, urgente, pas encore disponible, depassee, traitee.

Limites : une date inconnue doit rester inconnue ; aucune date ne doit etre inventee pour remplir l'interface.

Priorite : P0.

### Document

Responsabilite : gerer les documents generes par Microassist et les documents utilisateur si un stockage securise est valide.

Donnees principales : type, origine, stockage, proprietaire, date, statut, metadonnees, suppression.

Actions utilisateur : telecharger, ajouter si disponible, supprimer avec confirmation, consulter les metadonnees.

Cas d'usage : `generateDocument`, `uploadDocument`, `deleteDocument`, `listDocuments`.

Dependances : Document Engine, Storage Adapter, Authentication Adapter, Audit and History Service.

Etats principaux : generation disponible, upload indisponible, stockage valide, document liste, suppression a confirmer, erreur.

Limites : Documents est P1 ; mode decouverte sans stockage cloud ; upload conditionne par validation technique de securite.

Priorite : P1.

### Notification

Responsabilite : gerer les rappels internes et preparer les notifications distantes futures.

Donnees principales : consentement, canal, frequence, fuseau, statut, priorite, historique d'envoi.

Actions utilisateur : activer, desactiver, choisir canal/frequence si disponible, consulter les rappels.

Cas d'usage : `scheduleReminder`, `updateReminderPreferences`, `listInternalReminders`, `recordNotificationResult`.

Dependances : Notification Engine, Deadline, Today, Storage Adapter.

Etats principaux : rappel interne, notification distante non disponible, consentement absent, actif, desactive, echec envoi.

Limites : pas de spam, pas de fausse urgence, aucune notification distante sans consentement valide.

Priorite : P0 pour rappels internes lies a `Aujourd'hui` et echeances ; P1/P2 pour notifications distantes.

### Settings

Responsabilite : regrouper les preferences de compte, d'affichage, de rappels, de confidentialite et les actions sensibles.

Donnees principales : preferences, langue future, mode debutant/avance, consentements, compte, securite, suppression future.

Actions utilisateur : ajuster preferences, gerer rappels, se deconnecter, consulter confidentialite, demander suppression future.

Cas d'usage : `updateSettings`, `updateConsent`, `signOut`, `requestAccountDeletion`.

Dependances : Auth, Notification, Storage Adapter, Audit and History Service.

Etats principaux : preferences chargees, modification locale, sauvegarde, erreur, action sensible a confirmer.

Limites : ne pas cacher une action P0 dans des reglages ; les parametres ne remplacent pas les parcours metier.

Priorite : P0 minimal, P1 complet.

### Analytics

Responsabilite : afficher tendances, projections, seuils et analyses progressives lorsque les donnees sont suffisantes.

Donnees principales : historique revenus, categories, periodes, seuils, projections, niveau de confiance.

Actions utilisateur : consulter tendances, comparer periodes, masquer analyses avancees.

Cas d'usage : `loadAnalytics`, `calculateTrend`, `detectThresholdRisk`.

Dependances : Revenue, Calculation Engine, Rules Engine, Visibility Engine.

Etats principaux : non disponible, historique insuffisant, tendance visible, seuil proche, analyse avancee masquee.

Limites : pas de projection sans historique suffisant ; les calculs de base ne changent pas selon l'affichage.

Priorite : P2.

### Assistant

Responsabilite : expliquer, orienter et contextualiser sans agir silencieusement.

Donnees principales : contexte utilisateur autorise, page active, etats metier, questions frequentes, sources.

Actions utilisateur : poser une question, demander une explication, naviguer vers une page, comprendre une estimation.

Cas d'usage : `explainSituation`, `suggestNavigation`, `explainCalculation`, `explainOfficialLimit`.

Dependances : Today, Calculation Engine, Source Registry, Visibility Engine.

Etats principaux : aide simple, explication contextuelle, limite atteinte, action necessitant confirmation.

Limites : aucune modification de donnees sans confirmation ; aucune action officielle ; assistant conversationnel riche en P2.

Priorite : P2, avec explications statiques ou contextuelles simples possibles avant.

## 5. Routing Et Protection Des Parcours

### Routes Publiques

Exemples fonctionnels :

- accueil ;
- connexion ;
- inscription ;
- confirmation email ;
- mot de passe oublie ;
- nouveau mot de passe ;
- mentions legales ;
- confidentialite ;
- aide publique.

### Routes Mode Decouverte

Routes ciblees :

- `Aujourd'hui` decouverte ;
- profil minimal ;
- revenus locaux ;
- ajout revenu local ;
- estimation simple.

Ces routes ne doivent pas etre interpretees comme des routes privees. Elles reposent sur des donnees locales et doivent afficher les limites du mode decouverte lorsque cela influence la confiance ou la conservation des donnees.

### Routes Privees

Routes ciblees :

- `Aujourd'hui` ;
- revenus ;
- ajout revenu ;
- declaration ;
- ACRE ;
- factures ;
- echeances ;
- documents ;
- profil ;
- parametres.

### Routes Speciales

Routes ou etats speciaux :

- email confirmation ;
- recovery actif ;
- erreur auth ;
- 404 ;
- acces interdit ;
- session expiree ;
- migration locale en attente.

Regles :

- apres connexion reussie, aller vers `Aujourd'hui` ou vers la destination privee demandee si elle est coherente ;
- apres confirmation email, aller vers `Aujourd'hui` ;
- apres recovery reussi, aller vers `Aujourd'hui` ou connexion selon session ;
- onboarding termine ne doit jamais etre relance automatiquement ;
- route privee sans session, rediriger vers connexion avec destination memorisee ;
- mode decouverte ne doit pas etre interprete comme session privee ;
- aucune route ne doit melanger confirmation email et recovery mot de passe.

## 6. Modele D'Etat Global

L'application cible ne doit pas contenir un seul gros etat global portant tout le produit. Elle doit preferer des etats par domaine, avec orchestration explicite par les pages et services d'application.

### Etat D'Authentification

- inconnu ;
- visiteur ;
- decouverte ;
- connecte non confirme si applicable ;
- connecte confirme ;
- recovery actif ;
- session expiree.

### Etat Du Profil

- absent ;
- minimal ;
- suffisant ;
- a confirmer ;
- incoherent ;
- historique impacte.

### Etat Des Donnees

- local uniquement ;
- cloud ;
- en synchronisation ;
- migration proposee ;
- conflit ;
- sauvegarde echouee ;
- hors ligne futur.

### Etat Reglementaire

- inconnu ;
- estime ;
- confirme par l'utilisateur ;
- confirme par document ;
- historique ;
- obsolete ;
- a revalider.

### Etat Des Calculs

- non disponible ;
- partiel ;
- estime ;
- fiable selon donnees disponibles ;
- invalide par incoherence ;
- recalcul necessaire.

Ces etats doivent rester lisibles et testables. Un etat UI comme `modale ouverte` ne doit pas devenir la source de verite d'un statut metier comme `declaration confirmee`.

## 7. Strategie De Gestion D'Etat

### Donnees Persistantes Utilisateur

Exemples :

- profil ;
- revenus ;
- factures ;
- statuts ACRE ;
- declarations ;
- echeances confirmees ;
- preferences ;
- historique.

Ces donnees doivent etre rattachees a un utilisateur, protegees par les regles d'acces, et historisees lorsqu'une modification sensible a un impact fiscal ou administratif.

### Donnees Locales Decouverte

Exemples :

- profil minimal ;
- revenus ;
- estimations ;
- progression locale ;
- statut de migration.

Ces donnees restent locales a l'appareil et ne doivent pas etre presentees comme sauvegardees dans le cloud. La migration vers compte doit etre proposee, explicite et reversible tant qu'elle n'est pas confirmee.

### Donnees Derivees

Exemples :

- total de periode ;
- reserve conseillee ;
- prochaine action ;
- niveau de fiabilite ;
- prochaine echeance ;
- visibilite des fonctions.

Elles doivent etre recalculees a partir des sources fiables, sauf lorsqu'il faut conserver une trace historique de l'estimation presentee ou utilisee.

### Donnees Temporaires UI

Exemples :

- formulaire en cours ;
- modale ouverte ;
- filtre actif ;
- message temporaire ;
- etape de parcours.

Regles :

- ne pas persister ce qui peut etre recalcule de maniere fiable ;
- ne pas recalculer silencieusement les donnees historiques confirmees ;
- conserver les brouillons en cas d'erreur ;
- ne pas melanger donnees metier et etats purement visuels ;
- eviter les duplications de source de verite.

## 8. Modeles Metier Cibles

Les modeles suivants sont conceptuels. Ils ne constituent pas un schema SQL.

### UserAccount

- identite de compte ;
- email ;
- statut de confirmation ;
- preferences ;
- dates techniques importantes.

### BusinessProfile

- identite activite ;
- type activite ;
- categories ;
- activite mixte ;
- SIREN ;
- SIRET ;
- date officielle d'ouverture ;
- periodicite ;
- TVA ;
- ACRE ;
- version du profil.

### Revenue

- identifiant ;
- montant encaisse ;
- date d'encaissement ;
- categorie ;
- description ;
- client facultatif ;
- facture liee facultative ;
- source ;
- statut ;
- dates de creation et modification.

### Invoice

- identifiant ;
- numero ;
- client ;
- lignes ;
- total ;
- dates ;
- statut ;
- paiements ;
- revenu lie eventuel ;
- version.

### DeclarationPeriod

- type ;
- periode ;
- date limite ;
- fiabilite ;
- revenus inclus ;
- montants prepares ;
- statut utilisateur ;
- montant paye ;
- date paiement.

### AcreStatus

- etat ;
- date officielle ;
- date demande ;
- date reponse ;
- regle applicable ;
- source ;
- periode ;
- niveau de confirmation.

### Deadline

- type ;
- date ;
- priorite ;
- statut ;
- fiabilite ;
- source ;
- action associee.

### Estimation

- type ;
- periode ;
- entrees utilisees ;
- donnees manquantes ;
- resultat ;
- taux utilises ;
- regle utilisee ;
- niveau de confiance ;
- date de calcul.

### RegulatoryRule

- identifiant ;
- domaine ;
- periode d'application ;
- conditions ;
- valeurs ;
- source ;
- date de verification ;
- version ;
- statut actif ou historique.

### DocumentRecord

- type ;
- origine ;
- stockage ;
- proprietaire ;
- date ;
- statut ;
- metadonnees ;
- suppression.

### AuditEvent

- action ;
- auteur ;
- date ;
- ancienne valeur ;
- nouvelle valeur ;
- raison ;
- source.

## 9. Rules Engine

Le Rules Engine est la source structuree des regles reglementaires et des regles produit qui influencent les calculs, les statuts et les echeances.

Responsabilites :

- taux ;
- seuils ;
- periodes d'application ;
- categories d'activite ;
- ACRE ;
- TVA ;
- echeances ;
- dates frontieres ;
- sources officielles ;
- historique ;
- version des regles.

Exigences :

- aucune regle importante uniquement codee dans un composant ;
- toute regle doit avoir une periode d'application ;
- toute regle doit avoir une source ;
- toute regle doit avoir une date de verification ;
- les regles historiques doivent rester disponibles ;
- les calculs passes doivent pouvoir expliquer quelle regle a ete utilisee ;
- les dates frontieres doivent etre testees ;
- une regle produit doit etre distinguee d'une regle legale.

Le moteur doit prevoir conceptuellement :

- rule selector ;
- rule resolver ;
- rule versioning ;
- source metadata ;
- test fixtures reglementaires.

La regle ACRE liee au 1er juillet 2026 illustre ce besoin : l'application devra conserver la logique historique applicable avant cette date et appliquer la nouvelle logique selon la date officielle d'ouverture de l'activite, sans confondre cette date avec une date de facture, de client ou d'encaissement.

## 10. Calculation Engine

Le Calculation Engine est le moteur unique de calcul. Il centralise les estimations et rend les resultats explicables.

Responsabilites :

- cotisations estimees ;
- reserve conseillee ;
- argent restant indicatif ;
- regroupement par categorie ;
- activite mixte ;
- ACRE ;
- periodes ;
- arrondis ;
- donnees manquantes ;
- niveau de fiabilite.

Entrees :

- profil ;
- revenus ;
- periode ;
- regles applicables ;
- statut ACRE ;
- statut TVA si pertinent ;
- historique.

Sorties :

- estimation ;
- detail du calcul ;
- taux utilises ;
- regles utilisees ;
- donnees manquantes ;
- avertissements ;
- niveau de confiance.

Regles :

- aucun `amount * 0.22` dans les composants ;
- aucun taux placeholder en production ;
- aucun calcul sans type d'activite suffisant ;
- ACRE appliquee uniquement si le statut permet de le faire ;
- les estimations restent explicitement indicatives ;
- les resultats doivent etre reproductibles ;
- toute modification du profil doit pouvoir declencher une previsualisation d'impact.

Le moteur doit pouvoir fonctionner sur donnees locales en mode decouverte et sur donnees cloud pour un compte connecte, avec les memes regles metier et des niveaux de fiabilite adaptes.

## 11. Today Decision Engine

Le Today Decision Engine selectionne l'action principale de `Aujourd'hui`.

Entrees possibles :

- profil ;
- revenus ;
- echeances ;
- ACRE ;
- declarations ;
- incoherences ;
- donnees manquantes ;
- historique ;
- niveau de maturite.

Sorties :

- situation actuelle ;
- action principale ;
- actions secondaires ;
- niveau de priorite ;
- justification ;
- echeance associee ;
- message utilisateur ;
- destination.

Ordre de priorite valide :

1. erreur bloquante ou incoherence critique ;
2. echeance urgente connue ;
3. action reglementaire avec delai reel ;
4. donnee indispensable a un calcul demande ;
5. premier revenu ;
6. action utile non urgente ;
7. rien a faire.

Regles :

- une seule action principale ;
- aucune alerte rouge pour une information non urgente ;
- rien a faire est un etat valide ;
- le moteur decide, l'interface affiche ;
- les decisions doivent etre testables sans navigateur.

## 12. Visibility Engine

Le Visibility Engine decide quelles fonctions et informations sont visibles selon le contexte utilisateur.

Entrees :

- mode decouverte ou compte ;
- maturite utilisateur ;
- nombre de revenus ;
- historique ;
- proximite de seuil ;
- fonctions utilisees ;
- preferences ;
- droits eventuels ;
- niveau gratuit ou premium futur.

Sorties :

- navigation visible ;
- sections visibles ;
- detail simple ou avance ;
- CTA contextuels ;
- recommandations ;
- limites.

Regles :

- progressive disclosure ;
- pas de bascule brutale ;
- les calculs de base ne changent pas selon l'affichage ;
- l'utilisateur peut masquer les analyses avancees ;
- les fonctions non disponibles ne doivent pas etre simulees ;
- Documents et fonctions avancees restent P1 ou P2 selon validation.

La navigation mobile cible reste limitee a cinq acces : `Aujourd'hui`, `Revenus`, `Factures`, `Echeances`, `Plus`. `Documents`, `Profil`, `Aide`, `Parametres` et `Deconnexion` peuvent etre regroupes dans `Plus`.

## 13. Deadline Engine

Responsabilites :

- calculer ou recevoir les echeances ;
- distinguer confirme, estime, inconnu ;
- associer une source ;
- associer une priorite ;
- produire une action utile ;
- eviter les dates inventees.

Entrees :

- date officielle d'ouverture ;
- periodicite ;
- historique declaratif ;
- ACRE ;
- TVA ;
- regles applicables ;
- confirmations utilisateur.

Sorties :

- echeance ;
- niveau de confiance ;
- source ;
- statut ;
- rappel possible ;
- action.

Une date inconnue doit rester inconnue. Le produit peut dire qu'une information manque ou qu'une source doit etre verifiee, mais il ne doit pas remplir une date par commodite d'interface.

## 14. Migration Du Mode Decouverte

Le Sync and Migration Service gere le transfert local vers compte.

Etapes :

1. detecter des donnees locales ;
2. proposer la migration ;
3. afficher les donnees concernees ;
4. verifier les donnees cloud existantes ;
5. choisir fusion ou remplacement selon politique ;
6. transferer ;
7. verifier le succes ;
8. conserver la copie locale jusqu'a confirmation ;
9. journaliser le resultat ;
10. permettre une reprise en cas d'echec.

Etats :

- aucune donnee ;
- migration proposee ;
- analyse ;
- conflit ;
- en cours ;
- reussie ;
- partielle ;
- echouee ;
- annulee.

Contraintes :

- aucune suppression silencieuse ;
- aucun doublon non signale ;
- revenus compares avec strategie de detection ;
- migration idempotente autant que possible ;
- utilisateur informe avant chaque remplacement.

La politique exacte de fusion reste ouverte. Les exigences minimales sont deja fixees : afficher les donnees locales, detecter l'existence de donnees cloud, expliquer les consequences, conserver la copie locale jusqu'a succes confirme ou choix explicite de l'utilisateur.

## 15. Historique Et Audit

Elements a historiser :

- modification de categorie ;
- date officielle ;
- periodicite ;
- ACRE ;
- TVA ;
- declaration confirmee ;
- estimation utilisee ;
- regle reglementaire ;
- migration locale ;
- suppression importante.

Regles :

- les declarations historiques confirmees ne sont pas reecrites silencieusement ;
- toute estimation importante conserve ses entrees et la regle utilisee ;
- les anciennes regles restent consultables ;
- les changements sensibles doivent pouvoir etre expliques ;
- l'historique n'est pas necessairement visible integralement a l'utilisateur, mais doit exister pour la fiabilite.

L'audit metier et les logs techniques doivent rester separes. Un audit metier explique ce qui a change pour l'utilisateur et pourquoi ; un log technique aide a diagnostiquer une erreur de sauvegarde, reseau ou service.

## 16. Document Engine

Le Document Engine separe deux familles.

### Documents Generes Par Microassist

Exemples :

- recapitulatif ;
- brouillon de declaration ;
- facture PDF ;
- export ;
- attestation interne ;
- synthese.

### Documents Ajoutes Par L'Utilisateur

Exemples :

- justificatif de creation ;
- attestation d'immatriculation ;
- document ACRE ;
- attestation Urssaf.

Responsabilites :

- generation ;
- metadonnees ;
- telechargement ;
- stockage ;
- suppression ;
- droits ;
- duree de conservation ;
- tracabilite.

Precisions :

- Documents est P1 ;
- l'upload depend de la validation d'un stockage securise ;
- le mode decouverte ne propose pas de stockage cloud ;
- la generation PDF et Factur-X ne doivent etre promises que si reellement implementees.

## 17. Notification Engine

Le Notification Engine separe rappels internes et notifications distantes futures.

### Rappels Internes

Exemples :

- cartes `Aujourd'hui` ;
- echeances ;
- elements a confirmer ;
- actions non terminees.

### Notifications Distantes Futures

Canaux possibles :

- email ;
- push ;
- autres canaux eventuels.

Donnees necessaires :

- consentement ;
- canal ;
- frequence ;
- fuseau ;
- statut ;
- priorite ;
- historique d'envoi.

Regles :

- pas de spam ;
- pas de fausse urgence ;
- possibilite de desactiver ;
- distinction rappel et alerte reglementaire ;
- aucune notification distante sans consentement valide.

Les canaux et la frequence exacts restent ouverts. La priorite P0 consiste surtout a afficher les rappels utiles dans `Aujourd'hui` et `Echeances`.

## 18. Authentification Et Securite

L'architecture cible doit couvrir :

- session ;
- confirmation email ;
- recovery ;
- expiration ;
- routes protegees ;
- separation des donnees utilisateur ;
- controle d'acces ;
- suppression de compte future ;
- journalisation des actions sensibles.

Exigences :

- confirmation email et recovery separes ;
- aucun acces aux donnees d'un autre utilisateur ;
- donnees locales non confondues avec donnees cloud ;
- validation cote serveur pour les ecritures sensibles ;
- regles d'acces Supabase a revoir avant production ;
- secrets jamais exposes dans le client ;
- stockage de documents protege ;
- erreurs d'authentification sans fuite d'information excessive.

Le client peut orchestrer une experience fluide, mais il ne doit pas etre la seule barriere de securite. Les regles d'acces, les validations sensibles et les actions futures a impact administratif doivent etre traitees avec une defense en profondeur.

## 19. Strategie Supabase

Supabase peut fournir :

- Auth ;
- base de donnees ;
- Row Level Security ;
- stockage ;
- fonctions serveur eventuelles ;
- evenements ;
- logs.

Regles :

- le client ne doit pas etre l'unique autorite metier ;
- RLS obligatoire pour les donnees privees ;
- migrations versionnees ;
- environnements separes ;
- donnees de test distinctes ;
- aucune table creee avant validation du modele ;
- ne pas adapter le domaine aux limites d'une ancienne table si elle ne correspond plus au produit cible.

Le schema definitif sera traite dans un futur Technical Data Blueprint ou plan de migration, pas dans ce document. Les tables existantes decrites dans `ARCHITECTURE_AUDIT.md` doivent etre encapsulees avant d'etre remplacees ou etendues.

## 20. Architecture Des Composants

### Pages

Les pages orchestrent :

- route ;
- chargement ;
- etat global de page ;
- composition.

Une page appelle des cas d'usage et decide de la composition visuelle. Elle ne calcule pas un taux fiscal et ne tranche pas un statut reglementaire.

### Feature Components

Exemples conceptuels :

- TodayAction ;
- RevenueForm ;
- DeclarationPreparation ;
- AcreStatus ;
- InvoiceEditor ;
- DeadlineList.

Ils consomment les cas d'usage du domaine et affichent des donnees deja interpretees.

### Shared Components

Exemples :

- StatusBadge ;
- ConfidenceLabel ;
- SourceLink ;
- EmptyState ;
- ErrorState ;
- ConfirmationDialog ;
- MoneySummary.

Ils peuvent exprimer des etats transversaux, mais ne portent pas la logique fiscale ou reglementaire.

### UI Primitives

Exemples :

- Button ;
- Input ;
- Select ;
- Modal ;
- Card ;
- Tabs ;
- Skeleton.

Regles :

- pas de logique fiscale dans UI Primitives ;
- composants accessibles ;
- pas de duplication massive ;
- composants metiers nommes selon leur responsabilite ;
- ne pas creer un composant geant `App` contenant tout le produit.

## 21. Cas D'Usage Et Services D'Application

Les cas d'usage suivants sont conceptuels et ne constituent pas une implementation.

| Cas d'usage | Entree | Validation | Domaine | Resultat | Erreur possible | Effet de bord | Historique |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `startDiscoveryMode` | intention visiteur | localStorage disponible ou fallback clair | Discovery Mode | session decouverte locale | stockage indisponible | creation d'un espace local | non, sauf trace locale minimale |
| `createAccount` | email, mot de passe, consentements | email valide, conditions acceptees | Auth | compte cree ou email confirmation envoye | email deja utilise, reseau | session ou attente confirmation | audit auth technique |
| `migrateDiscoveryData` | donnees locales, compte cible, choix utilisateur | donnees lisibles, conflit analyse | Discovery Mode | donnees transferees ou conservees | conflit, echec partiel | ecriture cloud, copie locale conservee jusqu'a succes | oui |
| `signIn` | email, mot de passe, destination | identifiants presents | Auth | session active | identifiants invalides, email non confirme | chargement donnees privees | audit auth technique |
| `confirmEmail` | callback ou token valide | flow confirmation reconnu | Auth | compte confirme | lien expire, token invalide | route vers `Aujourd'hui` | audit auth technique |
| `recoverPassword` | email ou nouveau mot de passe | flow recovery separe | Auth | email envoye ou mot de passe mis a jour | lien expire, session absente | retour connexion ou `Aujourd'hui` | audit auth technique |
| `loadToday` | utilisateur ou mode decouverte | source de donnees coherent | Today | decision d'ecran | profil introuvable, reseau | aucun | non |
| `updateBusinessProfile` | section profil | champs coherents | Profile | profil mis a jour | validation, sauvegarde | recalcul derive | oui si sensible |
| `previewFiscalProfileChange` | changement propose | ancienne et nouvelle valeurs comparables | Profile | impact preview | historique impossible | aucun avant confirmation | non, sauf confirmation finale |
| `addRevenue` | montant, date encaissement, categorie | montant positif, date valide, categorie si mixte | Revenue | revenu cree | validation, doublon possible, sauvegarde | recalcul estimations | oui si cloud ou declaration impactee |
| `updateRevenue` | revenu modifie | coherence montant/date/categorie | Revenue | revenu modifie | introuvable, conflit | recalcul estimations | oui |
| `deleteRevenue` | identifiant revenu | confirmation utilisateur | Revenue | revenu supprime | introuvable, reseau | recalcul estimations | oui |
| `prepareDeclaration` | periode, revenus, profil | periode et donnees suffisantes | Declaration | brouillon prepare | calcul impossible, regle absente | ouverture possible du site officiel | oui si sauvegarde de preparation |
| `confirmDeclarationStatus` | statut choisi par utilisateur | statut autorise | Declaration | a confirmer, envoyee, probleme | incoherence historique | mise a jour declaration | oui |
| `updateAcreStatus` | statut, dates, source eventuelle | statut coherent avec dates | ACRE | statut ACRE mis a jour | date officielle absente, conflit | recalcul possible | oui |
| `calculateEstimate` | profil, revenus, periode, regles | regles disponibles, donnees suffisantes | Calculation | estimation explicable | regle absente, donnees manquantes | aucun | oui si estimation conservee |
| `listDeadlines` | profil, historique, regles | donnees minimales | Deadline | liste sourcee | date inconnue, regle absente | aucun | non |
| `createInvoice` | client, lignes, dates | champs facturation suffisants | Invoice | facture brouillon ou finalisee | numero invalide, profil incomplet | document futur possible | oui si finalisee |
| `markInvoicePaid` | facture, date paiement, montant | paiement coherent | Invoice | facture payee ou partielle | date manquante, montant incoherent | proposition de revenu | oui |
| `createRevenueFromInvoicePayment` | paiement facture | date encaissement explicite | Revenue + Invoice | revenu cree et lie | doublon, categorie manquante | recalcul estimations | oui |
| `uploadDocument` | fichier, type, proprietaire | stockage securise valide, taille/type | Document | document ajoute | stockage indisponible | ecriture storage | oui |
| `generateDocument` | type, donnees source | donnees suffisantes | Document | document genere | generation echouee | telechargement ou stockage | oui selon document |
| `scheduleReminder` | echeance, canal, consentement | consentement et canal valides | Notification | rappel cree | canal indisponible | notification future possible | oui pour distant |

## 22. Gestion Des Erreurs

Categories :

- validation utilisateur ;
- authentification ;
- reseau ;
- stockage local ;
- base de donnees ;
- migration ;
- calcul impossible ;
- regle absente ;
- incoherence historique ;
- document ;
- service externe.

Regles :

- message utilisateur simple ;
- detail technique journalise separement ;
- aucune perte silencieuse de formulaire ;
- possibilite de reessayer ;
- eviter les erreurs generiques si une action claire est possible ;
- ne pas afficher une estimation si le calcul est invalide ;
- fallback sûr lorsqu'une regle n'est pas disponible.

Un message d'erreur doit aider l'utilisateur a savoir quoi faire maintenant. Lorsque l'erreur est technique, le produit doit conserver le brouillon ou la saisie en cours autant que possible.

## 23. Observabilite Et Journalisation

Elements a suivre :

- erreurs critiques ;
- echec de sauvegarde ;
- echec de migration ;
- calcul sans regle ;
- incoherences ;
- auth ;
- temps de chargement ;
- echec de generation de document ;
- echec de notification.

Separations necessaires :

- logs techniques ;
- audit metier ;
- analytics produit ;
- donnees personnelles.

Regles :

- minimisation des donnees ;
- pas de secret dans les logs ;
- identifiants pseudonymises si possible ;
- respect RGPD ;
- outils a choisir plus tard.

L'observabilite doit permettre de diagnostiquer une regression sans transformer les donnees personnelles de l'utilisateur en donnees analytiques inutiles. Les evenements produit doivent mesurer la comprehension et l'efficacite des parcours, pas surveiller excessivement les micro-entrepreneurs.

## 24. Accessibilite Et Internationalisation

### Accessibilite

L'accessibilite doit etre integree des les primitives UI, puis preservee dans les composants partages, les composants metier et les pages. Elle ne doit pas etre ajoutee uniquement a la fin, car les erreurs d'accessibilite structurelles deviennent couteuses a corriger lorsque les parcours sont deja branches.

Exigences :

- structure HTML semantique ;
- navigation au clavier ;
- ordre de focus logique ;
- focus visible ;
- labels de formulaire explicites ;
- association des erreurs aux champs concernes ;
- annonces dynamiques accessibles pour les changements importants ;
- contrastes suffisants ;
- taille minimale des zones interactives ;
- etats qui ne reposent jamais uniquement sur la couleur ;
- gestion accessible des modales ;
- reduction des animations si demandee par l'utilisateur ;
- tests avec lecteur d'ecran ;
- accessibilite des tableaux, graphiques et resumes financiers.

Les messages reglementaires, les erreurs et les avertissements doivent rester comprehensibles sans connaissance administrative avancee. Un utilisateur doit pouvoir comprendre si une information est manquante, estimee, confirmee, urgente ou simplement informative.

Les graphiques futurs doivent toujours avoir une alternative textuelle : resume des chiffres, tendance principale, periode concernee, donnees manquantes et niveau de fiabilite.

### Internationalisation

L'internationalisation doit etre prevue conceptuellement sans choisir de bibliotheque definitive a ce stade.

Elements a separer de la logique :

- textes d'interface ;
- formats de dates ;
- formats monetaires ;
- nombres et separateurs ;
- pluriels ;
- vocabulaire reglementaire francais ;
- possibilite future d'interface ukrainienne, russe ou anglaise ;
- distinction entre langue d'interface et cadre reglementaire applicable.

Regle fondamentale : une traduction de l'interface ne modifie jamais automatiquement les regles reglementaires francaises du produit.

Le cadre metier cible reste celui de la micro-entreprise francaise, meme si l'interface peut un jour etre traduite pour aider des utilisateurs non francophones a comprendre leurs obligations.

## 25. Strategie De Test

La strategie de test doit proteger les regles critiques avant les transformations de l'interface. Aucune regle fiscale critique ne doit etre validee uniquement par un test manuel dans l'interface.

### Tests Unitaires

Couvrir au minimum :

- Rules Engine ;
- Calculation Engine ;
- Today Decision Engine ;
- Deadline Engine ;
- validations de domaine ;
- Visibility Engine ;
- regles de migration ;
- changements de profil fiscal.

Ces tests doivent pouvoir s'executer sans navigateur et sans Supabase reel lorsque la logique testee ne depend pas directement de l'infrastructure.

### Tests D'Integration

Couvrir :

- Profile + Revenue + Calculation ;
- ACRE + Rules + Calculation ;
- Revenue + Declaration ;
- Invoice payee + proposition de Revenue ;
- mode decouverte + migration ;
- authentification + routes protegees ;
- modification fiscale + historique ;
- Deadline + Today.

Ces tests verifient que les domaines collaborent sans recreer de logique dans les composants.

### Tests De Parcours

Couvrir :

- premiere visite ;
- demarrage en mode decouverte ;
- premier revenu ;
- creation de compte ;
- confirmation email ;
- migration locale ;
- connexion ;
- recovery mot de passe ;
- premiere declaration ;
- confirmation manuelle de declaration ;
- modification retroactive ;
- erreur reseau ;
- session expiree ;
- deconnexion.

Les parcours doivent verifier les destinations, les messages, la conservation des brouillons et l'absence de perte silencieuse.

### Tests Reglementaires

Couvrir :

- dates frontieres ;
- versions historiques des regles ;
- ACRE avant et apres une date de changement ;
- statut ACRE inconnu ou non confirme ;
- activite mixte ;
- changement de taux ;
- periodes mensuelles et trimestrielles ;
- regles absentes ;
- arrondis ;
- reproduction d'une estimation historique.

Les fixtures reglementaires doivent inclure les sources, les dates de verification et les periodes d'application.

### Tests D'Accessibilite

Couvrir :

- clavier ;
- focus ;
- lecteur d'ecran ;
- contrastes ;
- labels ;
- erreurs ;
- annonces dynamiques ;
- navigation mobile.

### Tests De Securite

Couvrir conceptuellement :

- separation des utilisateurs ;
- routes privees ;
- RLS ;
- acces aux documents ;
- session expiree ;
- tentative d'ecriture non autorisee ;
- donnees locales non fusionnees sans consentement.

## 26. Strategie De Migration De L'Existant

La migration doit partir de l'application actuelle decrite dans `ARCHITECTURE_AUDIT.md`, sans reecriture complete immediate. Chaque phase doit conserver des points de retour, stabiliser le build et verifier les parcours critiques.

### Phase 0 - Stabilisation Et Filet De Securite

Objectifs :

- etablir une sauvegarde fonctionnelle ;
- confirmer que le build passe ;
- inventorier les parcours existants ;
- identifier les calculs placeholders ;
- identifier les fonctions dupliquees ;
- identifier les responsabilites actuellement concentrees dans `App.jsx` ;
- ajouter ou preparer des tests de non-regression sur les parcours critiques ;
- documenter les comportements a conserver provisoirement.

Criteres de sortie :

- build stable ;
- principaux parcours repertories ;
- placeholders fiscaux critiques localises ;
- liste des dependances et zones risquees ;
- strategie de retour arriere disponible.

### Phase 1 - Frontieres D'Architecture

Objectifs :

- clarifier le routing ;
- separer public, decouverte et prive ;
- introduire des adapters autour de localStorage et Supabase ;
- commencer a isoler les modeles metier ;
- eviter tout nouveau calcul dans `App.jsx` ;
- conserver l'apparence et les comportements utiles pendant l'extraction.

Criteres de sortie :

- routes identifiables ;
- acces aux donnees encapsules ;
- aucun nouveau couplage majeur ;
- build et parcours existants stables.

### Phase 2 - Rules Engine Et Calculation Engine

Objectifs :

- centraliser les regles ;
- supprimer progressivement les taux disperses ;
- remplacer les placeholders ;
- produire des calculs explicables ;
- conserver les versions historiques ;
- ecrire les tests reglementaires avant branchement complet a l'UI.

Criteres de sortie :

- un seul chemin de calcul officiel dans l'application ;
- aucun placeholder fiscal dans les parcours actifs ;
- resultats testes sur dates frontieres ;
- details et sources disponibles.

### Phase 3 - Domaines Profile Et Revenue

Objectifs :

- extraire les donnees et validations du profil ;
- extraire les revenus ;
- gerer l'activite mixte par encaissement ;
- distinguer etat local, cloud et derive ;
- preserver les brouillons ;
- introduire audit et preview des changements sensibles.

Criteres de sortie :

- Profile et Revenue utilisables independamment de `App.jsx` ;
- estimations basees sur les nouveaux moteurs ;
- historique sensible protege.

### Phase 4 - Today Decision Engine Et UX P0

Objectifs :

- creer le modele de decision de `Aujourd'hui` ;
- afficher une seule action principale ;
- integrer profils incomplets, premier revenu, echeances et rien a faire ;
- appliquer la progressive disclosure ;
- stabiliser l'experience mobile.

Criteres de sortie :

- decisions testables sans navigateur ;
- `Aujourd'hui` ne depend plus de conditions dispersees dans la page ;
- aucun dashboard ne remplace l'action principale.

### Phase 5 - Declaration Et Deadline

Objectifs :

- preparer les periodes ;
- regrouper les revenus ;
- integrer les echeances fiables ;
- ouvrir le site officiel ;
- conserver le statut `A confirmer` ;
- permettre la confirmation manuelle.

Criteres de sortie :

- aucune transmission officielle simulee ;
- echeances inconnues non inventees ;
- historique de declaration protege.

### Phase 6 - Migration Du Mode Decouverte

Objectifs :

- detecter les donnees locales ;
- proposer la migration ;
- gerer les conflits ;
- rendre le processus reprenable ;
- conserver la copie locale jusqu'au succes.

Criteres de sortie :

- aucune perte silencieuse ;
- migrations testees ;
- repetition sure ou idempotente ;
- audit du resultat.

### Phase 7 - Fonctions P1

Inclure :

- facturation complete ;
- parcours ACRE complet ;
- documents ;
- rappels avances ;
- audit enrichi.

### Phase 8 - Fonctions P2

Inclure :

- analytics ;
- assistant conversationnel ;
- premium ;
- partage conseiller ;
- projections.

Regles generales :

- migrer par domaine ;
- conserver des points de retour ;
- ne pas supprimer l'ancien comportement avant validation du nouveau ;
- ne pas reecrire `App.jsx` en une seule operation ;
- chaque phase doit avoir un build stable et des criteres de sortie ;
- utiliser temporairement des adapters ou facades pour eviter une rupture brutale.

## 27. Dependances Entre Modules

La matrice suivante decrit les dependances ciblees. Les imports physiques futurs devront respecter ces limites.

| Module | Dependances autorisees | Donnees consommees | Donnees produites | Interdictions ou limites |
| --- | --- | --- | --- | --- |
| Presentation | cas d'usage, view models, composants partages | decisions de domaine, etats UI | intentions utilisateur | pas de taux, pas de calcul fiscal, pas de decision reglementaire |
| Auth | Authentication Adapter, Storage Adapter minimal | session, callbacks, destination | etat auth, utilisateur | ne lit pas les donnees metier directement |
| Discovery Mode | Storage Adapter local, Calculation, Today, Migration | profil minimal local, revenus locaux | etat decouverte, migration proposee | ne promet pas le cloud ni les documents securises |
| Profile | Rules, Calculation, Audit, Storage Adapter | profil, historique, changement propose | profil valide, preview d'impact | ne reecrit pas l'historique confirme silencieusement |
| Revenue | Storage Adapter, Calculation, Audit, Invoice pour liaison | encaissements, categorie, facture optionnelle | revenus, totaux derives | ne deduit pas un revenu depuis une facture sans action utilisateur |
| ACRE | Rules, Calculation, Deadline, Audit | statut, dates, sources | impact ACRE, actions ACRE | ne suppose pas l'accord automatique |
| Deadline | Profile, Rules, ACRE, Declaration | periodicite, date officielle, historique | echeances, confiance, actions | n'invente pas les dates inconnues |
| Declaration | Revenue, Profile, Calculation, Deadline, Audit | periode, revenus, profil, echeance | preparation, statut utilisateur | ne transmet pas officiellement |
| Invoice | Revenue, Document, Storage Adapter, Audit | facture, client, paiements | facture, proposition de revenu | ne cree jamais silencieusement un encaissement |
| Document | Declaration, Invoice, Storage Adapter, Auth | donnees documentaires, droits | document genere ou stocke | upload seulement apres validation securisee |
| Notification | Deadline, Today, Storage Adapter | echeances, actions, consentement | rappels, historique d'envoi | aucune notification distante sans consentement |
| Visibility | etats des domaines, droits futurs | maturite, historique, mode | navigation, sections visibles | ne modifie pas les calculs |
| Assistant | sorties des domaines, Source Registry | contexte autorise, explications | reponses, suggestions de navigation | ne remplace pas les cas d'usage |
| Audit | evenements metier, Authentication Adapter | action, auteur, ancienne/nouvelle valeur | trace d'audit | ne pilote pas le domaine |
| Rules | Source Registry | sources, periodes, versions | regles resolues | ne depend jamais de Presentation |
| Calculation | Profile, Revenue, Rules | profil, revenus, regles | estimations, details, confiance | ne depend jamais de composants React |

Risques de dependances circulaires :

- Today peut devenir un point central qui appelle tous les domaines et se fait appeler par eux ;
- Declaration et Deadline peuvent se referencer mutuellement si l'echeance est a la fois entree et sortie ;
- Invoice et Revenue peuvent creer une boucle autour du paiement et de l'encaissement ;
- Profile et Calculation peuvent se coupler si la previsualisation modifie directement le profil ;
- Visibility peut devenir un moteur cache de regles si ses decisions changent les calculs.

Recommandations :

- orchestration par cas d'usage ;
- interfaces de domaine ;
- evenements metier lorsque necessaire ;
- adapters pour l'infrastructure ;
- aucune importation directe incontrolee entre features.

## 28. Priorites Techniques

### P0 Technique

- authentification coherente ;
- routing ;
- separation decouverte / connecte ;
- Storage et Authentication Adapters ;
- modeles Profile et Revenue ;
- Rules Engine ;
- Calculation Engine ;
- Today Decision Engine ;
- Deadline Engine minimal ;
- profil progressif ;
- revenus ;
- preparation de declaration ;
- gestion des erreurs ;
- mobile ;
- tests critiques.

La distinction facture / encaissement reste obligatoire en P0 meme si le module Invoice complet est P1.

### P1 Technique

- facturation complete ;
- parcours ACRE complet ;
- Deadline avance ;
- Documents ;
- rappels distants ou avances ;
- audit enrichi ;
- migration locale robuste si non finalisee en P0 ;
- generation PDF validee.

### P2 Technique

- analytics ;
- assistant conversationnel ;
- premium ;
- partage conseiller ;
- projections ;
- fonctions collaboratives.

La priorite doit etre comparee a `ARCHITECTURE_AUDIT.md`. Une fonction deja partiellement presente ne devient pas automatiquement P0. La dette technique ne doit pas dicter la valeur utilisateur, mais elle doit etre prise en compte dans l'ordre de migration.

## 29. Risques De Regression

Risques majeurs :

- changement involontaire des calculs de cotisations, ACRE, TVA ou echeances pendant l'extraction ;
- perte, duplication ou ecrasement des donnees locales du mode decouverte ;
- confusion entre facture creee, facture payee et revenu encaisse ;
- declaration affichee comme envoyee alors qu'elle est seulement preparee ;
- rupture des callbacks Supabase de confirmation email ou recovery ;
- affichage de routes privees sans session valide ;
- remplacement d'une date inconnue par une estimation presentee comme certaine ;
- modification retroactive du profil recalculant silencieusement des periodes confirmees ;
- regression mobile dans les actions P0 ;
- perte d'accessibilite lors de la creation de nouveaux composants.

Mesures de reduction :

- tests de caracterisation avant extraction des calculs existants ;
- adapters temporaires autour de Supabase et localStorage ;
- feature flags ou branchements reversibles lorsque le risque est eleve ;
- journalisation des migrations et modifications sensibles ;
- comparaison des resultats avant/apres pour les cas fiscaux connus ;
- validation manuelle ciblee des parcours auth, revenus, declaration, facture et migration locale ;
- revue explicite des messages qui pourraient suggerer une action officielle.

## 30. Decisions Validees

Les decisions suivantes sont validees par la Product Vision, les Design Principles, le UX Blueprint V3 et le present blueprint. Elles ne doivent plus etre rouvertes dans les documents techniques suivants, sauf contradiction legale, contrainte technique majeure documentee ou nouvel arbitrage produit formel.

- `Aujourd'hui` est la page principale ;
- onboarding progressif ;
- une seule action principale ;
- mode decouverte limite au coeur de valeur ;
- donnees du mode decouverte stockees localement ;
- migration locale proposee lors de la creation du compte ;
- aucune suppression silencieuse des donnees locales ;
- separation facture / encaissement ;
- un revenu correspond a une somme reellement encaissee ;
- module complet de facturation en P1 ;
- Documents en P1 ;
- confirmation de declaration uniquement par l'utilisateur ;
- aucune declaration marquee automatiquement comme transmise ;
- activite mixte geree au niveau de chaque encaissement ;
- historique des modifications reglementaires ;
- previsualisation avant modification fiscale retroactive ;
- conservation des declarations historiques confirmees ;
- assistant conversationnel riche en P2 ;
- progressive disclosure ;
- navigation mobile limitee a `Aujourd'hui`, `Revenus`, `Factures`, `Echeances` et `Plus` ;
- aucun taux fiscal dans les composants ;
- Calculation Engine unique ;
- Rules Engine versionne, date et source ;
- Today Decision Engine independant de l'interface ;
- Deadline Engine conservant une date inconnue comme inconnue ;
- aucune action officielle simulee ;
- migration progressive de `App.jsx` ;
- aucune reecriture globale immediate.

## 31. Decisions Encore Ouvertes

Les decisions suivantes restent ouvertes. Elles ne doivent pas etre confondues avec les decisions deja validees en section 30.

| Decision | Pourquoi elle reste ouverte | Moment ou elle doit etre tranchee | Livrable ou prototype necessaire |
| --- | --- | --- | --- |
| Bibliotheque exacte de gestion d'etat | Le choix dependra du decoupage final des domaines et du volume d'etat partage. | Avant Phase 1 | Prototype court sur Auth, Today et Revenue |
| Structure precise des dossiers | Elle doit refleter les frontieres reelles observees pendant l'extraction. | Avant Phase 1 | Note d'architecture des dossiers |
| Politique exacte de fusion des donnees locales et cloud | Les conflits, doublons et remplacements doivent etre testes avec des donnees reelles. | Avant Phase 6 | Prototype de migration locale |
| Schema Supabase cible | Les modeles conceptuels doivent etre traduits sans heriter aveuglement des tables actuelles. | Avant creation du schema Supabase | Technical Data Blueprint |
| Plan de migration Supabase | Il depend du schema cible et des donnees existantes a preserver. | Avant creation du schema Supabase | Supabase Migration Plan |
| Strategie de stockage des documents | Le niveau de securite, les droits et la conservation doivent etre valides. | Avant P1 | Prototype stockage documents |
| Exigences de securite documentaire | Les documents utilisateur peuvent contenir des donnees sensibles. | Avant P1 | Security review documentaire |
| Service PDF | La generation doit etre fiable, testable et compatible avec les documents promis. | Avant P1 | Prototype PDF |
| Service email | Les cas d'usage email doivent etre distingues entre auth, rappels et produit. | Avant P1 | Prototype email transactionnel |
| Canaux de notification | Le produit doit eviter spam, fausse urgence et consentement insuffisant. | Avant P1 | Specification Notification Engine |
| Frequence des rappels | La frequence doit proteger l'utilisateur sans creer d'anxiete. | Avant P1 | Test UX rappels |
| Granularite des regles reglementaires | Le bon niveau dependra des calculs et des dates frontieres a couvrir. | Avant Phase 2 | Rules and Calculation Specification |
| Niveau exact de detail des estimations | Le detail doit varier selon debutant/avance sans changer le calcul. | Avant Phase 2 | Prototype d'explication de calcul |
| Strategie de conservation des estimations historiques | Elle depend des besoins d'audit et du volume de donnees. | Avant Phase 2 | Specification historique des estimations |
| Modele gratuit / premium | Le modele commercial ne doit pas perturber les fonctions P0. | Avant P2 | Product pricing brief |
| Perimetre exact du module Invoice P1 | La distinction P0 est validee, mais le module complet doit etre cadre. | Avant P1 | Invoice P1 Specification |
| Outils analytics et monitoring | Le choix doit respecter minimisation, RGPD et besoins de diagnostic. | Avant Phase 0 avancee | Observability brief |
| Strategie offline eventuelle | Le besoin dependra de l'usage reel mobile et du stockage local existant. | Avant P2 | Prototype offline |
| Bibliotheque d'internationalisation | Aucune bibliotheque n'est retenue tant que le besoin multilingue n'est pas priorise. | Avant P2 | I18n technical spike |
| Criteres chiffres d'activation des analyses avancees | Les seuils doivent etre bases sur donnees et valeur utilisateur. | Avant P2 | Analytics activation brief |
| Role exact et limites de l'assistant conversationnel | L'assistant ne doit pas remplacer les cas d'usage ni agir silencieusement. | Avant P2 | Assistant behavior specification |

## 32. Criteres De Validation, Gouvernance Et Prochaine Etape

Ce blueprint est valide pour guider l'implementation si les criteres suivants sont respectes :

- `Aujourd'hui` reste l'ecran principal de l'espace produit ;
- les composants UI ne portent pas les regles fiscales ;
- les regles reglementaires sont sourcees, versionnees et datees ;
- les calculs sont centralises et testables hors navigateur ;
- le mode decouverte est separe du compte connecte ;
- la migration locale ne supprime rien silencieusement ;
- la declaration est preparee, puis confirmee uniquement par l'utilisateur ;
- facture et encaissement restent separes dans les modeles et les parcours ;
- les routes auth, confirmation email et recovery sont distinctes ;
- Documents reste P1 tant que le stockage securise n'est pas valide ;
- l'assistant conversationnel riche reste P2 ;
- les etats inconnus, estimes et confirmes sont visuellement et techniquement distincts ;
- les tests couvrent les regles critiques avant remplacement de l'ancien comportement ;
- chaque phase de migration a un build stable et une strategie de retour.

Un futur changement technique qui contredit ces criteres doit etre documente et arbitre contre la Product Vision, les Design Principles et le UX Blueprint V3.

`PRODUCT_BLUEPRINT_V3.md` devient la reference technique cible pour la suite de la refonte controlee. Il ne doit pas etre transforme en specification d'implementation detaillee sans documents complementaires.

Regles de gouvernance :

- conserver `PRODUCT_BLUEPRINT_V2.md` comme historique ;
- ne pas modifier l'existant sans filet de non-regression ;
- traiter `ARCHITECTURE_AUDIT.md` comme description de l'etat actuel, pas comme cible ;
- documenter toute decision qui change un arbitrage valide ;
- ne pas coder une regle fiscale sans source, periode et test ;
- ne pas promettre une action officielle, une notification distante, un stockage documentaire ou une generation PDF si la capacite n'est pas reellement implementee.

La prochaine etape immediate n'est pas le Technical Data Blueprint. Avant de creer les specifications specialisees, il faut comparer precisement l'existant a la cible et transformer les phases de migration en lots executables.

Creer apres validation :

`docs/IMPLEMENTATION_ROADMAP_V3.md`

Ce document devra :

- comparer precisement l'existant a la cible ;
- transformer les phases de migration en lots concrets ;
- identifier les fichiers existants concernes ;
- fixer l'ordre de creation et d'extraction des modules ;
- distinguer refactor, correction fiscale et nouvelle fonction ;
- definir les tests avant et apres chaque lot ;
- definir les criteres de sortie ;
- prevoir un rollback ;
- identifier le moment ou les documents specialises deviennent necessaires.

Le futur `IMPLEMENTATION_ROADMAP_V3.md` devra decider a quel lot creer, si necessaire :

- Technical Data Blueprint ;
- Rules and Calculation Specification ;
- Supabase Migration Plan ;
- Test Plan ;
- Component Architecture Notes.

Ordre de suite :

1. Valider `PRODUCT_BLUEPRINT_V3.md`.
2. Creer `IMPLEMENTATION_ROADMAP_V3.md`.
3. Executer la Phase 0 de stabilisation.
4. Creer les specifications techniques specialisees au moment defini par la roadmap.
5. Commencer les extractions et migrations par petits lots valides.
