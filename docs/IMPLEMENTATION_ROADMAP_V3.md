# IMPLEMENTATION ROADMAP V3

Plan progressif de transformation de Microassist V2

## 1. Mission Du Roadmap

Ce document existe pour transformer l'application actuelle de Microassist vers l'architecture cible V2 sans rupture brutale, sans reecriture globale et sans perdre les comportements utiles deja presents.

Il ne decrit pas le produit, le UX ou l'architecture cible. Ces decisions sont portees par `MICROASSIST_PRODUCT_VISION_2027.md`, `MICROASSIST_DESIGN_PRINCIPLES.md`, `UX_BLUEPRINT_V3.md` et `PRODUCT_BLUEPRINT_V3.md`.

Ce roadmap decrit uniquement l'ordre d'implementation : quoi modifier, dans quel ordre, quels fichiers toucher, quels modules creer, quels tests executer, quels risques surveiller, comment revenir en arriere et a quel moment supprimer l'ancien code.

Toute implementation doit suivre ce roadmap avant de modifier le code.

## 2. Sources De Verite

Ordre de priorite :

1. Product Vision
2. Design Principles
3. UX Blueprint
4. Product Blueprint
5. Architecture Audit

En cas de contradiction, `MICROASSIST_PRODUCT_VISION_2027.md`, `MICROASSIST_DESIGN_PRINCIPLES.md` et `UX_BLUEPRINT_V3.md` priment toujours.

`PRODUCT_BLUEPRINT_V3.md` traduit ces decisions en cible produit et technique. `ARCHITECTURE_AUDIT.md` decrit l'etat actuel et sert a identifier les fichiers, dependances, risques et comportements a proteger.

## 3. Etat Actuel

Microassist est aujourd'hui une application React/Vite avec Supabase pour l'authentification, certaines donnees persistantes, des tables metier existantes et des Edge Functions.

L'application fonctionne, mais `src/App.jsx` concentre encore beaucoup de responsabilites : navigation, parcours utilisateur, etats React, calculs derives, appels Supabase, localStorage, modales, revenus, factures, rappels, premium et orchestration du dashboard.

Le projet utilise aussi `localStorage` pour le mode invite/decouverte, les brouillons, les revenus locaux, les factures locales et plusieurs preferences. La logique metier est encore partiellement couplee a l'interface, notamment autour des calculs, des echeances, d'ACRE, de la TVA, des revenus et des rappels.

L'architecture est donc en cours de transition : le but n'est pas de tout remplacer d'un coup, mais d'extraire progressivement les frontieres stables.

## 4. Principes De Migration

Regles fondamentales :

- jamais reecrire tout le projet ;
- un LOT = une responsabilite ;
- un LOT = un build vert ;
- rollback toujours possible ;
- ne jamais supprimer l'ancien comportement avant validation ;
- preferer adapters et facades aux ruptures brutales ;
- aucune logique metier nouvelle dans `App.jsx` ;
- aucune regle fiscale dans l'interface ;
- conserver un etat fonctionnel apres chaque LOT ;
- distinguer refactor, correction fiscale et nouvelle fonction ;
- proteger les donnees locales avant toute migration ;
- conserver les cles localStorage existantes tant qu'une migration explicite n'est pas testee ;
- encapsuler Supabase avant de modifier le modele de donnees ;
- tester les regles metier hors navigateur avant branchement UI ;
- ne jamais presenter une estimation comme officielle ;
- ne jamais simuler une action administrative.

## 5. Lots D'Implementation

### LOT 0 - Stabilisation

#### Objectif

Installer le filet de securite avant toute extraction : build stable, inventaire des comportements, cartographie des risques et tests de caracterisation prioritaires.

#### Pourquoi maintenant

L'application actuelle fonctionne mais concentre beaucoup de logique dans `App.jsx`. Sans stabilisation, chaque extraction risque de changer les calculs, les parcours auth, les donnees locales ou les factures.

#### Pre-requis

- Documents V2/V3 valides.
- Branche `refactor/saas-shell-v2`.
- `npm run build` vert avant intervention.
- Audit technique disponible.

#### Fichiers concernes

- `src/App.jsx`
- `src/utils/obligations.js`
- `src/utils/facturx.js`
- `src/components/AuthGate.jsx`
- `src/components/InvoiceGenerator.jsx`
- `src/context/AuthContext.jsx`
- `src/lib/supabase.js`
- `tests/*.spec.js`
- `package.json`

#### Nouveaux fichiers

- Eventuels tests de caracterisation.
- Eventuelles notes temporaires de verification si la roadmap les demande dans un lot separe.

#### Fichiers modifies

- Tests existants ou nouveaux tests seulement.
- Aucun fichier applicatif si la stabilisation peut se limiter a l'inventaire et aux tests.

#### Changements interdits

- Modifier l'interface.
- Modifier les calculs.
- Modifier Supabase.
- Renommer les cles localStorage.
- Supprimer du code.
- Reorganiser `App.jsx`.

#### Tests

- `npm run build`.
- Tests existants.
- Tests de caracterisation sur `computeObligations`.
- Tests de caracterisation sur `facturx.js`.
- Parcours manuel : auth, recovery, ajout/suppression revenu, facture PDF/XML, rappels, reset, mode invite.

#### Criteres de sortie

- Build vert.
- Parcours critiques repertories.
- Risques principaux confirmes.
- Calculs placeholders localises.
- Liste des fichiers sensibles connue.
- Strategie de rollback documentee.

#### Rollback

Revenir aux tests/documentation precedents. Aucun changement applicatif ne doit etre necessaire dans ce lot.

#### Risques

- Sous-estimer les comportements caches dans `App.jsx`.
- Oublier des cles localStorage existantes.
- Ne pas couvrir les callbacks Supabase sensibles.

#### Documentation a mettre a jour

- `docs/IMPLEMENTATION_ROADMAP_V3.md` si l'inventaire revele un ordre de lots plus sur.
- Eventuel futur `Test Plan` si les tests deviennent nombreux.

### LOT 1 - Routing

#### Objectif

Clarifier les frontieres de navigation : public, mode decouverte, prive, confirmation email, recovery, erreur auth, session expiree et 404.

#### Pourquoi maintenant

Le routing structure les autres extractions. Tant que public, decouverte et prive restent melanges dans un etat global, les domaines ne peuvent pas etre isoles proprement.

#### Pre-requis

- LOT 0 termine.
- Parcours auth/recovery actuels cartographies.
- Destinations apres connexion, confirmation email et recovery validees contre le UX Blueprint V3.

#### Fichiers concernes

- `src/App.jsx`
- `src/context/AuthContext.jsx`
- `src/components/AuthGate.jsx`
- `src/main.jsx`
- `src/App.css`
- `tests/*.spec.js`

#### Nouveaux fichiers

- Module de routing cible si necessaire.
- Eventuels helpers de route guards.

#### Fichiers modifies

- `src/App.jsx` uniquement par extraction minimale.
- `src/context/AuthContext.jsx` si les etats de session doivent etre exposes plus clairement.
- Tests de navigation.

#### Changements interdits

- Introduire un onboarding long avant `Aujourd'hui`.
- Melanger confirmation email et recovery.
- Changer les calculs ou les donnees.
- Modifier Supabase.
- Redessiner les pages.

#### Tests

- Build.
- Connexion vers `Aujourd'hui`.
- Route privee sans session vers connexion avec destination memorisee.
- Confirmation email distincte du recovery.
- Recovery actif vers nouveau mot de passe.
- Session expiree.
- Mode decouverte non interprete comme session privee.

#### Criteres de sortie

- Routes publiques, decouverte et privees identifiables.
- `Aujourd'hui` reste destination principale apres auth reussie.
- Aucun parcours auth existant casse.
- Ancien comportement encore disponible si rollback.

#### Rollback

Conserver l'ancien routage par `appView` tant que le nouveau routing n'est pas valide. Revenir au branchement precedent dans `App.jsx`.

#### Risques

- Rupture des callbacks URL Supabase.
- Boucle de redirection.
- Relance involontaire d'un onboarding deja termine.
- Perte de destination demandee.

#### Documentation a mettre a jour

- Roadmap si le routing impose un lot intermediaire.
- Futur Component Architecture Notes si une structure de pages emerge.

### LOT 2 - Domain Models

#### Objectif

Introduire les modeles metier conceptuels sous forme de types, schemas ou conventions internes sans changer le comportement utilisateur.

#### Pourquoi maintenant

Les moteurs Rules, Calculation et Today ont besoin d'entrees stables. Les donnees actuelles sont dispersees entre `answers`, `fiscalProfile`, `simpleAssistantProfile`, `revenues`, `invoices`, Supabase et localStorage.

#### Pre-requis

- LOT 1 termine ou suffisamment stable.
- Cartographie des donnees existantes confirmee.
- Decisions ouvertes sur la structure des dossiers tranchees pour ce lot.

#### Fichiers concernes

- `src/App.jsx`
- `src/config/steps.fiscal.js`
- `src/utils/obligations.js`
- `src/utils/facturx.js`
- `src/components/InvoiceGenerator.jsx`
- `src/lib/supabase.js`

#### Nouveaux fichiers

- Modeles `UserAccount`, `BusinessProfile`, `Revenue`, `Invoice`, `DeclarationPeriod`, `AcreStatus`, `Deadline`, `Estimation`, `RegulatoryRule`, `DocumentRecord`, `AuditEvent`.
- Adapters de normalisation entre donnees existantes et modeles cibles.

#### Fichiers modifies

- `src/App.jsx` seulement pour utiliser les adapters sans changer la logique.
- Tests des normalisations.

#### Changements interdits

- Modifier le schema Supabase.
- Changer les payloads persistants sans migration.
- Renommer ou supprimer des champs existants.
- Changer les libelles utilisateur.
- Modifier les calculs.

#### Tests

- Normalisation profil local et Supabase.
- Normalisation revenus locaux et cloud.
- Normalisation factures locales et cloud.
- Donnees manquantes, inconnues, estimees et confirmees.
- Build.

#### Criteres de sortie

- Les modeles cibles existent comme couche de traduction.
- Les donnees existantes restent compatibles.
- Aucun changement visible.
- Les moteurs futurs peuvent consommer ces modeles.

#### Rollback

Rebrancher `App.jsx` sur les donnees brutes existantes et conserver les adapters inutilises jusqu'a suppression future.

#### Risques

- Creer une deuxieme source de verite.
- Normaliser trop tot des donnees dont le sens est encore ambigu.
- Perdre des champs utilises par l'UI existante.

#### Documentation a mettre a jour

- Roadmap si des modeles doivent etre repousses.
- Technical Data Blueprint seulement lorsque la roadmap decide de travailler le schema cible.

### LOT 3 - Rules Engine

#### Objectif

Centraliser les regles reglementaires et produit sourcees, datees, versionnees et testables.

#### Pourquoi maintenant

Le Calculation Engine ne doit pas porter lui-meme les taux, seuils, dates frontieres et statuts. Les regles doivent etre isolees avant de remplacer les calculs disperses.

#### Pre-requis

- LOT 2 termine.
- Sources officielles a verifier avant implementation des regles fiscales.
- Tests de caracterisation existants sur les calculs actuels.

#### Fichiers concernes

- `src/utils/obligations.js`
- `src/utils/facturx.js`
- `src/App.jsx`
- Tests metier.

#### Nouveaux fichiers

- Rules Engine.
- Source Registry.
- Fixtures reglementaires.
- Tests de dates frontieres.

#### Fichiers modifies

- `src/utils/obligations.js` seulement si un wrapper garde le comportement existant.
- Tests.
- Aucun composant UI sauf branchement minimal futur.

#### Changements interdits

- Changer un taux sans source et test.
- Remplacer globalement la logique ACRE historique.
- Mettre des regles dans des composants.
- Supprimer les anciennes regles sans historique.
- Inventer une source.

#### Tests

- Selection de regle par date.
- ACRE avant et apres date de changement.
- Statut ACRE inconnu.
- TVA et seuils actuels caracterises.
- Echeances mensuelles et trimestrielles.
- Regle absente.
- Build.

#### Criteres de sortie

- Rules Engine testable hors navigateur.
- Chaque regle critique a source, date de verification et periode.
- Les regles historiques restent disponibles.
- Aucun comportement utilisateur modifie sans decision explicite.

#### Rollback

Conserver `computeObligations` comme chemin actif tant que le Rules Engine n'est pas branche. Desactiver le branchement par facade si necessaire.

#### Risques

- Corriger un calcul fiscal dans un lot de refactor.
- Supprimer une regle historique.
- Presenter une estimation comme officielle.

#### Documentation a mettre a jour

- Creer `Rules and Calculation Specification` lorsque ce lot confirme les besoins de granularite.
- Roadmap si une verification reglementaire bloque.

### LOT 4 - Calculation Engine

#### Objectif

Creer un moteur unique de calcul qui consomme Profile, Revenue et Rules et produit des estimations explicables.

#### Pourquoi maintenant

Les estimations, reserves, ACRE, activite mixte et echeances alimentees par les calculs sont aujourd'hui fortement couplees a `App.jsx` et `computeObligations`.

#### Pre-requis

- LOT 3 termine.
- Tests de caracterisation disponibles.
- Donnees Profile et Revenue normalisees.

#### Fichiers concernes

- `src/utils/obligations.js`
- `src/App.jsx`
- `src/config/steps.fiscal.js`
- Tests metier.

#### Nouveaux fichiers

- Calculation Engine.
- Types ou modeles d'entree/sortie d'estimation.
- Tests unitaires de calcul.

#### Fichiers modifies

- `src/utils/obligations.js` pour compatibilite ou delegation progressive.
- `src/App.jsx` seulement via une facade conservant les sorties attendues.
- Tests.

#### Changements interdits

- Remplacer les calculs actifs sans comparaison.
- Ajouter des taux dans l'UI.
- Supprimer les labels existants avant remplacement valide.
- Changer les arrondis sans test.

#### Tests

- Resultats avant/apres sur cas actuels.
- Activite services, commerce, mixte.
- ACRE active, inconnue, expiree.
- Donnees manquantes.
- Montant nul.
- Arrondis.
- Reproduction d'une estimation historique.
- Build.

#### Criteres de sortie

- Un chemin de calcul officiel existe.
- Les sorties incluent detail, taux, regle, donnees manquantes, avertissements et confiance.
- `App.jsx` n'ajoute plus de nouveau calcul metier.
- Les resultats actifs restent stables ou changent seulement via correction documentee.

#### Rollback

Revenir a `computeObligations` comme moteur actif. Garder le nouveau moteur non branche si les comparaisons echouent.

#### Risques

- Regression fiscale.
- Double calcul concurrent.
- Incoherence entre detail affiche et montant calcule.

#### Documentation a mettre a jour

- `Rules and Calculation Specification`.
- Roadmap si des corrections fiscales doivent etre separees du refactor.

### LOT 5 - Today Decision Engine

#### Objectif

Extraire la decision de `Aujourd'hui` dans un moteur testable qui choisit situation, action principale, actions secondaires, priorite, justification et destination.

#### Pourquoi maintenant

`Aujourd'hui` est le coeur de Microassist V2. Il doit dependre des domaines et moteurs, pas d'une accumulation de conditions UI dispersees.

#### Pre-requis

- LOT 4 termine.
- Deadline minimal disponible ou facade existante.
- UX Blueprint V3 valide pour les priorites.

#### Fichiers concernes

- `src/App.jsx`
- `src/utils/obligations.js`
- Composants ou blocs dashboard existants.
- Tests de parcours.

#### Nouveaux fichiers

- Today Decision Engine.
- View model `Today`.
- Tests de priorite.

#### Fichiers modifies

- `src/App.jsx` pour consommer la decision plutot que la construire.
- Tests.

#### Changements interdits

- Transformer `Aujourd'hui` en dashboard analytique.
- Afficher plusieurs actions principales.
- Creer une alerte rouge sans urgence reelle.
- Inventer une echeance.
- Changer les calculs.

#### Tests

- Profil absent.
- Date officielle manquante.
- Premier revenu.
- Echeance urgente.
- ACRE proche du delai.
- Donnee incoherente.
- Rien a faire.
- Build.

#### Criteres de sortie

- Decisions testables sans navigateur.
- Une seule action principale.
- `Aujourd'hui` consomme un view model stable.
- L'ancien dashboard peut encore etre restaure.

#### Rollback

Revenir aux conditions existantes de `App.jsx` pour la page actuelle. Garder le moteur non actif.

#### Risques

- Perdre une condition existante utile.
- Prioriser une action secondaire au mauvais moment.
- Creer de l'anxiete artificielle.

#### Documentation a mettre a jour

- Roadmap si la separation Today/Deadline doit etre ajustee.
- Test Plan si les cas de priorite deviennent nombreux.

### LOT 6 - Revenue

#### Objectif

Extraire le domaine Revenue : CRUD, validation, stockage local/cloud, activite mixte par encaissement, liaison facultative a une facture et agregations simples.

#### Pourquoi maintenant

Les revenus alimentent les calculs, declarations, Today, analytics et factures. Ils doivent etre fiables avant les lots Declaration et Discovery Migration.

#### Pre-requis

- LOT 2 termine.
- LOT 4 disponible pour estimations.
- Adapters localStorage et Supabase introduits ou prets.

#### Fichiers concernes

- `src/App.jsx`
- `src/lib/supabase.js`
- `src/components/InvoiceGenerator.jsx`
- `src/utils/obligations.js`
- Tests revenus.

#### Nouveaux fichiers

- Domaine Revenue.
- Revenue repository local/cloud.
- Validations Revenue.
- Tests unitaires et integration.

#### Fichiers modifies

- `src/App.jsx` pour deleguer ajout, modification, suppression, chargement.
- Tests.

#### Changements interdits

- Compter une facture non payee comme revenu.
- Supprimer ou renommer `revenues_guest` sans migration.
- Changer le schema Supabase.
- Perdre la saisie en cas d'erreur.

#### Tests

- Ajouter revenu local.
- Ajouter revenu connecte.
- Modifier revenu.
- Supprimer avec confirmation.
- Activite mixte.
- Doublon potentiel.
- Erreur reseau.
- Build.

#### Criteres de sortie

- Revenue utilisable sans logique directe dans `App.jsx`.
- Local et cloud passent par adapters.
- Les calculs consomment les revenus normalises.
- Aucun changement visible non voulu.

#### Rollback

Rebrancher les handlers existants dans `App.jsx`. Conserver les repositories non actifs.

#### Risques

- Perte de donnees invite.
- Duplication lors d'une future migration.
- Categorie mixte mal conservee.

#### Documentation a mettre a jour

- Roadmap si la migration locale doit etre avancee.
- Technical Data Blueprint si un ecart de modele bloquant apparait.

### LOT 7 - Profile

#### Objectif

Extraire le domaine Profile : profil progressif, validations, ACRE/TVA/periodicite, previsualisation des changements sensibles et historique.

#### Pourquoi maintenant

Le profil conditionne les calculs, echeances, ACRE, declarations et Today. Il doit etre separe de l'assistant et du dashboard avant les parcours fiscaux avances.

#### Pre-requis

- LOT 2 termine.
- LOT 3 et LOT 4 disponibles.
- Regles de previsualisation validees.

#### Fichiers concernes

- `src/App.jsx`
- `src/config/steps.fiscal.js`
- `src/lib/supabase.js`
- `src/context/AuthContext.jsx`
- Tests profil.

#### Nouveaux fichiers

- Domaine Profile.
- Profile repository.
- Service de previsualisation fiscale.
- Audit events profil.

#### Fichiers modifies

- `src/App.jsx` pour deleguer chargement, sauvegarde, edition et reset profil.
- Tests.

#### Changements interdits

- Relancer automatiquement un onboarding termine.
- Reecrire l'historique confirme.
- Modifier une declaration historique sans confirmation.
- Changer les champs Supabase sans plan.

#### Tests

- Profil absent.
- Profil minimal.
- Profil suffisant.
- Modification categorie.
- Modification date officielle.
- Modification ACRE.
- Preview impact.
- Conflit local/distant.
- Build.

#### Criteres de sortie

- Profile expose des cas d'usage stables.
- Modifications sensibles passent par preview.
- Donnees confirmees et estimees distinguees.
- `App.jsx` ne porte plus la logique profil principale.

#### Rollback

Rebrancher `refreshFiscalProfile`, `saveFiscalProfileToSupabase` et handlers existants.

#### Risques

- Ecrasement profil distant.
- Rupture assistant/profil.
- Recalcul silencieux d'anciennes periodes.

#### Documentation a mettre a jour

- Roadmap si les champs Supabase existants bloquent.
- Technical Data Blueprint avant toute evolution de schema.

### LOT 8 - Declaration

#### Objectif

Extraire le domaine Declaration : periode, regroupement des revenus, preparation, ouverture du site officiel, statut `A confirmer`, confirmation utilisateur et montant paye.

#### Pourquoi maintenant

La declaration depend de Revenue, Profile, Calculation et Deadline. Elle doit arriver apres stabilisation des donnees et calculs.

#### Pre-requis

- LOT 4, LOT 6 et LOT 7 termines.
- Deadline minimal disponible.
- UX de confirmation manuelle valide.

#### Fichiers concernes

- `src/App.jsx`
- `src/utils/obligations.js`
- Domaines Revenue/Profile/Deadline.
- Tests declaration.

#### Nouveaux fichiers

- Domaine Declaration.
- Declaration repository si persistance necessaire.
- Tests de parcours declaration.

#### Fichiers modifies

- `src/App.jsx` pour deleguer preparation et confirmation.
- Tests.

#### Changements interdits

- Marquer automatiquement une declaration comme transmise.
- Simuler une transmission URSSAF.
- Inventer une periode ou une echeance.
- Confondre montant prepare et montant paye.

#### Tests

- Periode mensuelle.
- Periode trimestrielle.
- Declaration a zero.
- Revenus par categorie.
- Ouvrir site officiel puis statut `A confirmer`.
- Confirmation utilisateur.
- Probleme utilisateur.
- Build.

#### Criteres de sortie

- Declaration prepare sans transmettre.
- Confirmation manuelle separee.
- Historique protege.
- Today peut consommer l'etat Declaration.

#### Rollback

Revenir au parcours existant ou masquer le nouveau domaine derriere l'ancien comportement.

#### Risques

- Message suggerant une transmission officielle.
- Mauvais regroupement des revenus.
- Perte du statut a confirmer.

#### Documentation a mettre a jour

- Roadmap.
- Eventuel Rules and Calculation Specification si les periodes revelent des cas fiscaux non couverts.

### LOT 9 - Discovery Migration

#### Objectif

Construire la migration explicite des donnees locales du mode decouverte vers un compte connecte.

#### Pourquoi maintenant

La migration doit attendre que Revenue et Profile soient suffisamment stables. Elle protege un parcours critique : essayer sans compte puis securiser ses donnees.

#### Pre-requis

- LOT 6 et LOT 7 termines.
- Politique de fusion locale/cloud tranchee.
- Tests de donnees locales disponibles.

#### Fichiers concernes

- `src/App.jsx`
- `src/components/AuthGate.jsx`
- `src/context/AuthContext.jsx`
- `src/lib/supabase.js`
- Adapters localStorage.
- Repositories Revenue/Profile/Invoice selon perimetre.

#### Nouveaux fichiers

- Sync and Migration Service.
- Tests de migration.
- Eventuelle interface de resolution de conflits future.

#### Fichiers modifies

- `src/App.jsx` pour detecter/proposer sans supprimer.
- `src/components/AuthGate.jsx` si l'inscription doit declencher la proposition.
- Tests.

#### Changements interdits

- Supprimer des donnees locales avant succes confirme.
- Migrer silencieusement.
- Remplacer des donnees cloud sans confirmation.
- Migrer les factures locales Factur-X si le perimetre ne l'autorise pas.

#### Tests

- Aucune donnee locale.
- Donnees locales seules.
- Donnees cloud existantes.
- Conflit.
- Echec partiel.
- Reprise.
- Idempotence.
- Build.

#### Criteres de sortie

- Migration proposee clairement.
- Donnees concernees affichees.
- Copie locale conservee jusqu'a confirmation.
- Audit du resultat.
- Aucun doublon non signale.

#### Rollback

Desactiver le service de migration et conserver les donnees locales existantes.

#### Risques

- Perte de donnees.
- Doublons.
- Conflit mal explique.
- Suppression trop tot.

#### Documentation a mettre a jour

- Roadmap.
- Technical Data Blueprint ou Supabase Migration Plan si la migration impose un schema cible.

### LOT 10 - Invoice

#### Objectif

Extraire le domaine Invoice et preparer le module complet P1 tout en conservant la distinction facture / encaissement.

#### Pourquoi maintenant

Invoice depend de Revenue, Document, Storage et Rules pour certaines mentions. Le module complet est P1, mais la distinction facture/revenu est P0 et doit rester protegee.

#### Pre-requis

- LOT 6 termine.
- Decisions P1 du perimetre Invoice tranchees.
- Service PDF choisi ou prototype prevu.

#### Fichiers concernes

- `src/App.jsx`
- `src/components/InvoiceGenerator.jsx`
- `src/utils/facturx.js`
- `src/lib/supabase.js`
- Tests factures.

#### Nouveaux fichiers

- Domaine Invoice.
- Invoice repository local/cloud.
- Services generation PDF/XML si valides.
- Tests Invoice.

#### Fichiers modifies

- `src/App.jsx` pour deleguer liste, creation, marquage paye.
- `src/components/InvoiceGenerator.jsx` par extraction progressive.
- Tests.

#### Changements interdits

- Creer automatiquement un revenu a partir d'une facture.
- Pretendre transmettre une facture a une PDP.
- Supprimer les brouillons locaux existants.
- Promettre PDF/Factur-X si la capacite n'est pas branchee et testee.

#### Tests

- Brouillon.
- Facture finalisee.
- SIRET manquant.
- Marquer payee.
- Proposition de revenu avec date encaissement.
- Telechargement XML existant.
- Build.

#### Criteres de sortie

- Invoice separe de Revenue.
- Paiement propose un encaissement sans le creer silencieusement.
- Brouillons locaux preserves.
- Ancien generateur remplace uniquement apres validation.

#### Rollback

Rebrancher `InvoiceGenerator` et les handlers existants.

#### Risques

- Confusion facture/revenu.
- Perte de brouillons.
- Regression PDF/XML.
- Statuts incoherents.

#### Documentation a mettre a jour

- Invoice P1 Specification.
- Component Architecture Notes si l'editeur facture devient complexe.

### LOT 11 - Documents

#### Objectif

Introduire le domaine Documents en P1 : documents generes et documents ajoutes par l'utilisateur, avec stockage uniquement si securise et valide.

#### Pourquoi maintenant

Documents depend d'Invoice, Declaration, Storage, Auth et securite. Il ne doit pas etre lance avant de savoir ce qui est genere, stocke et protege.

#### Pre-requis

- LOT 8 ou LOT 10 selon type de document.
- Strategie de stockage documentaire tranchee.
- Exigences de securite documentaire validees.

#### Fichiers concernes

- `src/App.jsx`
- `src/components/InvoiceGenerator.jsx`
- `src/lib/supabase.js`
- Supabase storage futur si valide.
- Tests documents.

#### Nouveaux fichiers

- Document Engine.
- Document repository.
- Adapters storage.
- Tests documents.

#### Fichiers modifies

- Pages ou composants documents futurs.
- `App.jsx` seulement pour brancher l'acces si P1 actif.
- Tests.

#### Changements interdits

- Promettre un stockage securise non implemente.
- Activer l'upload en mode decouverte.
- Stocker des documents sensibles sans controle d'acces.
- Creer une migration Supabase sans plan.

#### Tests

- Document genere.
- Document utilisateur si upload valide.
- Droits d'acces.
- Suppression avec confirmation.
- Erreur storage.
- Build.

#### Criteres de sortie

- Documents distingue generated/user uploaded.
- Stockage et droits valides.
- Mode decouverte sans promesse cloud.
- Suppression tracee.

#### Rollback

Masquer Documents P1 et conserver les generations existantes hors module central.

#### Risques

- Fuite de document.
- Suppression irreversible non confirmee.
- Confusion document interne/officiel.

#### Documentation a mettre a jour

- Technical Data Blueprint.
- Supabase Migration Plan si storage/table ajoute.
- Security review documentaire.

### LOT 12 - Notifications

#### Objectif

Structurer les rappels internes et preparer les notifications distantes avec consentement, priorite, frequence et historique.

#### Pourquoi maintenant

Les rappels dependent de Deadline et Today. Ils doivent venir apres stabilisation des echeances pour eviter les fausses urgences.

#### Pre-requis

- LOT 5 et Deadline minimal actifs.
- Strategie canaux/frequence tranchee.
- Consentement utilisateur defini.

#### Fichiers concernes

- `src/App.jsx`
- `supabase/functions/send-reminder`
- `supabase/functions/send-trial-ending-email`
- `src/lib/supabase.js`
- Rappels dans `fiscal_profiles` et `reminders`
- Tests rappels.

#### Nouveaux fichiers

- Notification Engine.
- Reminder repository.
- Tests notifications.

#### Fichiers modifies

- `src/App.jsx` pour deleguer preferences et rappels.
- Edge Functions seulement dans un lot explicitement autorise.
- Tests.

#### Changements interdits

- Envoyer une notification distante sans consentement.
- Presenter SMS/push comme disponible si non implemente.
- Creer une fausse urgence.
- Modifier Edge Functions sans plan de test.

#### Tests

- Rappel interne Today.
- Rappel echeance.
- Preferences locales.
- Preferences cloud.
- Consentement absent.
- Echec envoi.
- Build.

#### Criteres de sortie

- Rappels internes separes des notifications distantes.
- Preferences encapsulees.
- Aucun canal non disponible affiche comme actif.
- Historique d'envoi prevu si distant.

#### Rollback

Revenir a la modal de rappels existante et aux colonnes actuelles `fiscal_profiles`.

#### Risques

- Spam.
- Desynchronisation local/cloud.
- Edge Function cassee.
- Mauvaise priorite dans Today.

#### Documentation a mettre a jour

- Specification Notification Engine.
- Supabase Migration Plan si schema modifie.

### LOT 13 - Analytics

#### Objectif

Introduire les analyses avancees P2 uniquement lorsque les donnees et criteres d'activation le justifient.

#### Pourquoi maintenant

Analytics est volontairement P2. Il ne doit pas concurrencer `Aujourd'hui` ni influencer les calculs de base.

#### Pre-requis

- Socle P0 stable.
- Revenue et Calculation stables.
- Criteres chiffres d'activation tranchees.
- Outils analytics/monitoring choisis si necessaire.

#### Fichiers concernes

- `src/App.jsx`
- Logique dashboard actuelle.
- `src/config/accessMatrix.js`
- `src/config/pricing.js`
- localStorage analytics existant.
- Tests analytics.

#### Nouveaux fichiers

- Domaine Analytics.
- Services de tendances/projections.
- Tests analytics.

#### Fichiers modifies

- Vues analytics futures.
- `App.jsx` seulement pour retirer la logique analytique residuelle.
- Tests.

#### Changements interdits

- Afficher des projections sans historique suffisant.
- Modifier les calculs de base selon le mode avance.
- Utiliser des donnees personnelles excessives.
- Transformer `Aujourd'hui` en dashboard.

#### Tests

- Historique insuffisant.
- Tendances disponibles.
- Masquer analyses avancees.
- Seuil proche.
- Donnees incoherentes.
- Build.

#### Criteres de sortie

- Analytics separe du socle.
- Activation progressive.
- Aucune source de verite fiscale propre a Analytics.
- Respect minimisation donnees.

#### Rollback

Masquer Analytics et conserver les vues P0.

#### Risques

- Surcharge debutant.
- Faux sentiment de precision.
- Couplage au Calculation Engine dans le mauvais sens.

#### Documentation a mettre a jour

- Analytics activation brief.
- Observability brief si outils ajoutes.

### LOT 14 - Assistant

#### Objectif

Introduire ou reorganiser l'assistant conversationnel riche en P2 comme couche d'explication et de navigation, sans remplacer les cas d'usage.

#### Pourquoi maintenant

L'assistant riche doit arriver apres stabilisation des domaines. Il consomme leurs sorties et ne doit pas devenir le moteur cache du produit.

#### Pre-requis

- Socle P0 stable.
- Today, Calculation, Rules, Revenue, Profile et Declaration exposes par cas d'usage.
- Limites assistant documentees.

#### Fichiers concernes

- `src/App.jsx`
- Logique assistant actuelle.
- `src/config/steps.fiscal.js`
- Composants d'aide existants.
- Tests assistant.

#### Nouveaux fichiers

- Domaine Assistant.
- Service d'explication contextuelle.
- Tests limites assistant.

#### Fichiers modifies

- `src/App.jsx` pour retirer l'orchestration conversationnelle residuelle.
- Composants d'aide futurs.
- Tests.

#### Changements interdits

- Modifier des donnees sans confirmation.
- Rendre une decision administrative.
- Contredire Rules ou Calculation.
- Faire de l'assistant l'unique navigation.
- Presenter une action officielle comme realisee.

#### Tests

- Explication d'un calcul.
- Renvoi vers une page.
- Limite quand donnee inconnue.
- Aucune modification sans confirmation.
- Aucune contradiction avec Today.
- Build.

#### Criteres de sortie

- Assistant consomme les domaines sans les piloter.
- Limites visibles et testees.
- Experience P0 utilisable sans assistant.
- Ancienne logique conversationnelle retiree seulement apres validation.

#### Rollback

Masquer l'assistant riche et conserver les aides statiques ou parcours structures.

#### Risques

- Reintroduire un onboarding conversationnel obligatoire.
- Contourner les moteurs metier.
- Generer une reponse trop certaine.

#### Documentation a mettre a jour

- Assistant behavior specification.
- Test Plan si assistant automatise.

## 6. Dependency Map

| Module | Depend de | Doit rester independant de | Notes operationnelles |
| --- | --- | --- | --- |
| Rules | Source Registry | Presentation, React, Calculation | Source les taux, seuils, periodes, ACRE, TVA, echeances. |
| Calculation | Rules, Profile, Revenue | React components, Today, Visibility | Produit estimations, details, confiance, avertissements. |
| Deadline | Rules, Profile, ACRE, Declaration | Presentation | Une date inconnue reste inconnue. |
| Today | Profile, Revenue, Deadline, ACRE, Declaration, Calculation, Visibility | Composants UI | Choisit une seule action principale. |
| Revenue | Storage Adapter, Audit, Calculation | Invoice automatique | Produit les encaissements reels. |
| Profile | Storage Adapter, Rules, Calculation, Audit | Presentation | Porte preview et changements sensibles. |
| Declaration | Revenue, Profile, Calculation, Deadline, Audit | Notification directe | Prepare, ne transmet pas. |
| Discovery Migration | Local Storage Adapter, Supabase Adapter, Profile, Revenue | UI seule | Transfert explicite et idempotent. |
| Invoice | Revenue, Document, Storage Adapter, Audit | Creation silencieuse de Revenue | Peut proposer, jamais imposer un encaissement. |
| Document | Invoice, Declaration, Auth, Storage Adapter | Mode decouverte cloud | P1, securite avant upload. |
| Notification | Deadline, Today, Consentement | Rules directes non sourcees | Rappels internes avant notifications distantes. |
| Analytics | Revenue, Calculation, Rules, Visibility | Today comme source de calcul | P2, progressive disclosure. |
| Assistant | Today, Calculation, Rules, Source Registry | Ecriture silencieuse, decision fiscale | P2, explique et oriente. |
| Presentation | View models et cas d'usage | Regles fiscales | Affiche seulement les decisions des domaines. |

Ordre critique :

```text
Rules
  -> Calculation
    -> Today
    -> Declaration

Profile
  -> Calculation
  -> Deadline
  -> Today
  -> Declaration

Revenue
  -> Calculation
  -> Today
  -> Declaration
  -> Analytics

Deadline
  -> Today
  -> Notification

Invoice
  -> Revenue proposition
  -> Document generation

Discovery Mode
  -> Local Storage
  -> Migration
  -> Profile / Revenue cloud
```

Risques de dependances circulaires a surveiller :

- Today ne doit pas etre appele par les domaines qu'il consomme.
- Declaration ne doit pas recalculer ses propres echeances hors Deadline.
- Invoice ne doit pas creer Revenue sans passer par le cas d'usage Revenue.
- Visibility ne doit pas modifier Calculation.
- Assistant ne doit pas contourner les cas d'usage.

## 7. Definition Of Done

Un LOT est termine uniquement si toutes les conditions suivantes sont vraies :

- `npm run build` passe ;
- les tests prevus du lot passent ;
- les tests de non-regression pertinents passent ;
- l'UX validee est respectee ;
- `PRODUCT_BLUEPRINT_V3.md` est respecte ;
- aucune regle fiscale critique n'est validee seulement manuellement ;
- aucune logique metier nouvelle n'est ajoutee dans `App.jsx` ;
- aucun taux fiscal n'est place dans un composant ;
- aucun placeholder permanent n'est introduit ;
- les donnees locales existantes sont preservees ou migrees avec consentement ;
- les erreurs conservent les saisies quand c'est pertinent ;
- le rollback est possible et documente ;
- la documentation utile est mise a jour ;
- aucune regression connue n'est acceptee sans decision explicite.

Un LOT peut etre livre avec une fonction masquee ou non branchee si cela reduit le risque, a condition que le build reste vert et que l'ancien comportement reste actif.

## 8. Anti-Patterns

Interdictions explicites :

- reecrire `App.jsx` entierement ;
- melanger plusieurs domaines dans un meme LOT ;
- melanger refactoring et nouvelles fonctionnalites ;
- mettre des regles fiscales dans les composants ;
- creer des placeholders permanents ;
- dupliquer les regles metier ;
- creer plusieurs sources de verite ;
- contourner Rules Engine ;
- contourner Calculation Engine ;
- supprimer l'ancien comportement avant validation du nouveau ;
- changer Supabase sans blueprint ou plan de migration ;
- renommer des cles localStorage sans migration testee ;
- traiter le mode decouverte comme une session privee ;
- creer un revenu automatiquement depuis une facture ;
- marquer une declaration comme transmise sans confirmation utilisateur ;
- afficher une date inconnue comme estimee fiable ;
- rendre l'assistant responsable d'une decision metier ;
- utiliser l'analytics pour changer les calculs ;
- ajouter des documents utilisateur sans stockage securise valide.

## 9. Documentation Future

Ce roadmap decide quand les documents specialises deviennent necessaires. Ils ne doivent pas etre crees avant que le lot correspondant justifie leur contenu.

Documents futurs possibles :

- `Technical Data Blueprint` : a creer avant toute creation ou modification importante de schema Supabase.
- `Rules and Calculation Specification` : a creer pendant LOT 3 ou LOT 4, avant correction fiscale active.
- `Supabase Migration Plan` : a creer avant toute migration de tables, RLS, storage ou Edge Functions.
- `Test Plan` : a creer lorsque les tests de caracterisation deviennent assez nombreux pour necessiter un suivi separe.
- `Component Architecture Notes` : a creer lorsque les extractions de pages, shared components et UI primitives commencent a stabiliser une structure.
- `Invoice P1 Specification` : a creer avant LOT 10 si le module complet depasse la simple extraction.
- `Assistant Behavior Specification` : a creer avant LOT 14.
- `Observability Brief` : a creer avant le choix d'outils analytics ou monitoring.

Ordre documentaire immediat :

1. Valider `docs/IMPLEMENTATION_ROADMAP_V3.md`.
2. Executer LOT 0 - Stabilisation.
3. Creer les documents specialises uniquement lorsque le lot correspondant les rend necessaires.
4. Commencer les extractions par petits lots valides.
