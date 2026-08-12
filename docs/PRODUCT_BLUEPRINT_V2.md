# Product Blueprint Microassist V2

Branche cible : `refactor/saas-shell-v2`

Date : 26 juillet 2026

Objectif : definir l'architecture produit et UX de Microassist V2 avant toute modification du code. Ce document ne modifie pas la logique metier existante. Il s'appuie sur `docs/ARCHITECTURE_AUDIT.md`.

Mission produit :

> Aider l'utilisateur a comprendre ce qu'il doit faire maintenant, ce qu'il devra faire ensuite et combien il doit mettre de cote.

Microassist V2 doit rester simple, rassurant, progressif et adapte aux micro-entrepreneurs debutants en France.

## 1. Principes Produit

- Une seule action principale visible a la fois : chaque ecran doit avoir un objectif dominant et un bouton primaire clairement identifiable.
- Ne pas montrer de donnees inutiles : les analyses, graphiques, projections, scores et exports restent masques ou reduits tant que les donnees necessaires ne sont pas disponibles.
- Distinguer clairement public et prive : le site public explique Microassist ; l'espace prive sert a agir sur son suivi fiscal.
- Expliquer simplement l'administratif : URSSAF, ACRE, TVA, CFE et franchise en base doivent etre traduits en phrases courtes.
- Guider etape par etape : l'utilisateur debutant ne doit pas avoir a comprendre toute la fiscalite avant d'avancer.
- Ne jamais suggerer qu'une action administrative est automatique : Microassist prepare, rappelle et aide a calculer, mais ne declare pas a l'URSSAF et ne transmet pas automatiquement les factures.
- Preserver les calculs existants : les taux, seuils, echeances et comportements documentes dans l'audit restent inchanges jusqu'a validation explicite.
- Permettre un mode invite temporaire : l'utilisateur peut commencer sans compte, avec sauvegarde locale sur le meme appareil.
- Rendre creation de compte et connexion faciles a trouver : les parcours publics et temporaires gardent toujours une issue claire vers inscription/connexion.

## 2. Types d'Utilisateurs et Etats

### A. Visiteur sans compte et sans profil temporaire

Affichage :

- Page publique.
- Bouton principal `Commencer`.
- Bouton ou lien clairement visible `Se connecter`.

Comportement attendu :

- `Commencer` mene a `/onboarding`.
- `Se connecter` mene a `/connexion`.
- Aucune donnee personnelle, aucun dashboard, aucune analyse.

### B. Visiteur sans compte avec profil temporaire commence

Affichage :

- Possibilite de continuer l'onboarding.
- Indication visible `Session temporaire`.
- Message : `Tu pourras retrouver cette session sur cet appareil.`
- Possibilite claire de creer un compte.

Comportement attendu :

- Reprise depuis `microassist_v1` ou futur stockage local equivalent.
- Le compte est propose comme protection des donnees, jamais impose au milieu d'une saisie critique.

### C. Visiteur avec profil temporaire termine

Affichage :

- Resume `Ton espace est pret`.
- Bouton principal `Creer mon compte`.
- Bouton secondaire `Continuer sans compte`.
- Texte : `Tes donnees restent temporaires tant que tu n'as pas cree de compte.`

Comportement attendu :

- `Creer mon compte` declenche le parcours inscription.
- `Continuer sans compte` ouvre un espace prive temporaire limite.
- Les donnees locales ne sont pas supprimees sans action explicite.

### D. Utilisateur inscrit mais email non confirme

Affichage :

- Page dediee `/confirmer-email`.
- Message demandant de confirmer l'adresse email.
- Action `Renvoyer l'email`.
- Lien secondaire `Retour a la connexion`.

Regles :

- Aucun reset de mot de passe automatique.
- Ne pas afficher le dashboard comme si le compte etait pleinement actif.
- Ne pas effacer le profil temporaire local pendant cette attente.

### E. Utilisateur connecte sans profil fiscal

Redirection :

- Directement vers `/onboarding`.

Affichage :

- Onboarding fiscal V2.
- Message rassurant : `On commence par quelques informations simples pour preparer ton espace.`

Regles :

- Ne pas afficher un dashboard vide complexe.
- Ne pas demander le chiffre d'affaires estime dans l'onboarding principal.

### F. Utilisateur connecte avec profil fiscal

Redirection :

- Directement vers `/app`.

Regles :

- Ne jamais afficher a nouveau le parcours initial automatiquement.
- Proposer la modification du profil depuis `/app/profil`.
- En cas de conflit local/distant, afficher une decision explicite avant toute fusion.

### G. Utilisateur en recuperation de mot de passe

Affichage :

- Ecran nouveau mot de passe uniquement quand le flow Supabase contient explicitement `type=recovery`.

Regles :

- Si `type=recovery` est absent, ne pas afficher l'ecran de reset.
- Apres succes, revenir vers connexion ou dashboard selon session.
- Ne pas confondre confirmation email et reset password.

## 3. Carte des Pages

### Pages publiques

#### `/`

- Objectif principal : comprendre Microassist et commencer.
- Contenu essentiel : promesse, explication simple, exemples de ce que l'utilisateur saura faire maintenant.
- Action principale : `Commencer`.
- Actions secondaires : `Se connecter`, `Voir les fonctionnalites`, `Tarifs`.
- Elements a ne pas afficher : dashboard, score fiscal, exports, donnees privees, analyses.
- Condition d'acces : publique.
- Destination apres validation : `/onboarding`.

#### `/fonctionnalites`

- Objectif principal : expliquer les fonctions sans jargon.
- Contenu essentiel : suivi des revenus, cotisations estimees, echeances, rappels, factures.
- Action principale : `Commencer`.
- Actions secondaires : `Se connecter`, `Voir les tarifs`.
- Elements a ne pas afficher : formulaires fiscaux complets, donnees utilisateur.
- Condition d'acces : publique.
- Destination apres validation : `/onboarding`.

#### `/tarifs`

- Objectif principal : presenter l'offre et les limites.
- Contenu essentiel : gratuit/temporaire, compte, premium/attente, limites d'exports existantes.
- Action principale : `Commencer`.
- Actions secondaires : `Se connecter`, `Continuer sans compte` si session temporaire existante.
- Elements a ne pas afficher : actions privees, tableaux fiscaux.
- Condition d'acces : publique.
- Destination apres validation : `/onboarding` ou `/inscription`.

#### `/contact`

- Objectif principal : permettre de contacter Microassist.
- Contenu essentiel : formulaire ou lien de contact, motifs simples.
- Action principale : `Envoyer un message`.
- Actions secondaires : `Aide`, `Retour accueil`.
- Elements a ne pas afficher : donnees fiscales, parcours de declaration.
- Condition d'acces : publique.
- Destination apres validation : confirmation sur place.

#### `/aide`

- Objectif principal : repondre aux questions simples.
- Contenu essentiel : definitions URSSAF, ACRE, TVA, CFE, compte, donnees temporaires.
- Action principale : `Commencer`.
- Actions secondaires : `Se connecter`, `Contacter`.
- Elements a ne pas afficher : analytics avancees, actions irreversibles.
- Condition d'acces : publique.
- Destination apres validation : `/onboarding` ou page precedente.

### Authentification

#### `/connexion`

- Objectif principal : connecter un utilisateur existant.
- Contenu essentiel : email, mot de passe, lien mot de passe oublie.
- Action principale : `Se connecter`.
- Actions secondaires : `Creer un compte`, `Mot de passe oublie`.
- Elements a ne pas afficher : onboarding complet, dashboard.
- Condition d'acces : publique, redirection si deja connecte.
- Destination apres validation : `/app` si profil fiscal existe, sinon `/onboarding`.

#### `/inscription`

- Objectif principal : creer un compte.
- Contenu essentiel : email, mot de passe, rappel sur sauvegarde des donnees.
- Action principale : `Creer mon compte`.
- Actions secondaires : `Se connecter`, `Continuer sans compte` si profil temporaire existe.
- Elements a ne pas afficher : reset password, donnees privees d'un autre compte.
- Condition d'acces : publique.
- Destination apres validation : `/confirmer-email` si confirmation requise, sinon `/onboarding` ou `/app`.

#### `/confirmer-email`

- Objectif principal : attendre/declencher la confirmation email.
- Contenu essentiel : email concerne, message de verification, renvoi.
- Action principale : `Renvoyer l'email`.
- Actions secondaires : `Retour connexion`, `Changer d'adresse`.
- Elements a ne pas afficher : formulaire nouveau mot de passe.
- Condition d'acces : compte cree non confirme ou retour apres signup.
- Destination apres validation : `/connexion` ou `/app` selon session confirmee.

#### `/mot-de-passe-oublie`

- Objectif principal : demander un email de recuperation.
- Contenu essentiel : champ email, explication courte.
- Action principale : `Recevoir le lien`.
- Actions secondaires : `Retour connexion`.
- Elements a ne pas afficher : champ nouveau mot de passe.
- Condition d'acces : publique.
- Destination apres validation : confirmation d'envoi.

#### `/nouveau-mot-de-passe`

- Objectif principal : definir un nouveau mot de passe.
- Contenu essentiel : nouveau mot de passe, confirmation.
- Action principale : `Mettre a jour mon mot de passe`.
- Actions secondaires : `Retour connexion` seulement hors flow actif.
- Elements a ne pas afficher : inscription, confirmation email.
- Condition d'acces : uniquement avec `type=recovery` Supabase.
- Destination apres validation : `/app` ou `/connexion` selon session.

### Onboarding

#### `/onboarding`

- Objectif principal : construire le profil fiscal minimal.
- Contenu essentiel : activite, rythme declaration, date debut, ACRE, TVA.
- Action principale : `Continuer`.
- Actions secondaires : `Retour`, `Se connecter`, `Sauvegarder avec un compte`.
- Elements a ne pas afficher : CA estime obligatoire, analyses, exports.
- Condition d'acces : invite ou connecte sans profil fiscal.
- Destination apres validation : `/onboarding/resume`.

#### `/onboarding/resume`

- Objectif principal : verifier les reponses avant creation d'espace.
- Contenu essentiel : resume lisible, elements inconnus, prochaine action.
- Action principale : connecte `Valider mon profil`, invite `Creer mon compte`.
- Actions secondaires : `Modifier`, `Continuer sans compte`.
- Elements a ne pas afficher : dashboard complet.
- Condition d'acces : profil temporaire ou profil connecte en cours.
- Destination apres validation : `/onboarding/sauvegarde` ou `/app`.

#### `/onboarding/sauvegarde`

- Objectif principal : proteger les donnees temporaires.
- Contenu essentiel : difference compte vs session temporaire.
- Action principale : `Creer mon compte`.
- Actions secondaires : `Continuer sans compte`, `Se connecter`.
- Elements a ne pas afficher : arguments marketing longs.
- Condition d'acces : invite avec profil termine.
- Destination apres validation : `/inscription` ou `/app`.

### Application privee

#### `/app`

- Objectif principal : dire quoi faire maintenant.
- Contenu essentiel : prochaine action, echeance connue, montant a mettre de cote si disponible, raccourcis utiles.
- Action principale : depend de l'etat, souvent `Ajouter mon premier revenu`.
- Actions secondaires : `Modifier profil`, `Voir revenus`, `Gerer rappels`.
- Elements a ne pas afficher : marketing public, inscription si connecte.
- Condition d'acces : connecte avec profil ou invite temporaire termine.
- Destination apres validation : page/action liee.

#### `/app/revenus`

- Objectif principal : ajouter et consulter les revenus.
- Contenu essentiel : formulaire ajout, liste, total mois, categorie si activite mixte.
- Action principale : `Ajouter un revenu`.
- Actions secondaires : supprimer, exporter si disponible, filtrer.
- Elements a ne pas afficher : facturation complete si aucun revenu et pas pertinent.
- Condition d'acces : profil termine.
- Destination apres validation : rester sur revenus avec confirmation.

#### `/app/factures`

- Objectif principal : creer et suivre les factures.
- Contenu essentiel : liste factures, statut paye/non paye, creation PDF/XML, conformite.
- Action principale : `Creer une facture`.
- Actions secondaires : `Creer depuis le dernier revenu`, `Telecharger XML`, `Marquer payee`.
- Elements a ne pas afficher : transmission automatique PDP comme active.
- Condition d'acces : profil termine.
- Destination apres validation : liste factures.

#### `/app/echeances`

- Objectif principal : montrer les obligations a venir.
- Contenu essentiel : prochaine declaration URSSAF, TVA, CFE, ACRE si pertinent.
- Action principale : `Preparer ma prochaine declaration`.
- Actions secondaires : comprendre URSSAF, configurer rappels.
- Elements a ne pas afficher : fausse confirmation de declaration effectuee.
- Condition d'acces : profil termine.
- Destination apres validation : `/app/revenus` ou `/app/rappels`.

#### `/app/rappels`

- Objectif principal : configurer les rappels disponibles.
- Contenu essentiel : email actif, SMS non implemente/premium futur, types de rappels.
- Action principale : `Enregistrer mes rappels`.
- Actions secondaires : annuler, retour echeances.
- Elements a ne pas afficher : promesse SMS si `isSmsReminderImplemented` reste false.
- Condition d'acces : profil termine.
- Destination apres validation : `/app` ou rester sur rappels.

#### `/app/profil`

- Objectif principal : consulter et modifier les informations fiscales.
- Contenu essentiel : activite, periodicite, dates, ACRE, TVA, identite de facturation.
- Action principale : `Modifier mon profil`.
- Actions secondaires : reset profil, reset complet, retour dashboard.
- Elements a ne pas afficher : onboarding initial automatique pour profil complet.
- Condition d'acces : connecte ou invite temporaire selon capacites.
- Destination apres validation : `/app`.

#### `/app/parametres`

- Objectif principal : gerer compte, securite, donnees.
- Contenu essentiel : email, deconnexion, reset, CGU/confidentialite, donnees temporaires si invite.
- Action principale : selon contexte `Creer mon compte` invite ou `Enregistrer`.
- Actions secondaires : deconnexion, reset complet.
- Elements a ne pas afficher : calculs fiscaux detailles.
- Condition d'acces : espace prive.
- Destination apres validation : `/app` ou `/`.

## 4. Parcours Principaux

### 1. Nouveau visiteur -> profil temporaire -> creation de compte

- Point de depart : `/`.
- Etapes : cliquer `Commencer`, completer onboarding, verifier resume, choisir `Creer mon compte`, inscription, confirmation email si necessaire, migration des donnees locales.
- Donnees utilisees : `microassist_v1`, `microassist_profile_v1`, futur payload `fiscal_profiles`.
- Messages affiches : `Session temporaire`, `Ton espace est pret`, `Cree un compte pour conserver tes donnees`.
- Sortie attendue : utilisateur connecte avec profil fiscal, arrivee sur `/app`.
- Erreurs possibles : email deja utilise, email non confirme, conflit profil local/distant, echec migration Supabase.

### 2. Nouveau visiteur -> profil temporaire -> continuer sans compte

- Point de depart : `/onboarding/resume`.
- Etapes : choisir `Continuer sans compte`, ouvrir espace temporaire, proposer creation de compte de facon non bloquante.
- Donnees utilisees : localStorage `microassist_v1`, `microassist_profile_v1`, revenus/factures invites.
- Messages affiches : `Tes donnees restent sur cet appareil`, `Cree un compte pour les retrouver partout`.
- Sortie attendue : `/app` en mode session temporaire.
- Erreurs possibles : localStorage indisponible, donnees locales corrompues, session effacee par navigateur.

### 3. Utilisateur existant -> connexion -> tableau de bord

- Point de depart : `/connexion`.
- Etapes : saisir email/mot de passe, authentification Supabase, charger `profiles`, `fiscal_profiles`, `revenues`, `invoices`.
- Donnees utilisees : Supabase Auth, `profiles`, `fiscal_profiles`, `revenues`, `invoices`.
- Messages affiches : `Connexion en cours`, puis accueil personnalise.
- Sortie attendue : `/app` si profil fiscal existe.
- Erreurs possibles : identifiants invalides, email non confirme, session impossible, profil introuvable.

### 4. Utilisateur connecte sans profil -> onboarding

- Point de depart : callback auth ou `/connexion`.
- Etapes : detection absence `fiscal_profiles`, redirection `/onboarding`, completion, sauvegarde.
- Donnees utilisees : Supabase Auth, `fiscal_profiles.upsert`.
- Messages affiches : `On commence par quelques informations simples`.
- Sortie attendue : profil cree puis `/app`.
- Erreurs possibles : sauvegarde profil echouee, dates invalides, champs obligatoires incomplets.

### 5. Utilisateur connecte avec profil -> tableau de bord

- Point de depart : `/connexion`, callback auth ou retour direct.
- Etapes : charger profil, verifier pas de recovery actif, rediriger `/app`.
- Donnees utilisees : `profiles`, `fiscal_profiles`, revenus, factures, preferences rappels.
- Messages affiches : salutation et prochaine action.
- Sortie attendue : dashboard prive progressif.
- Erreurs possibles : conflit avec brouillon local, echec fetch, ancien localStorage qui tente de restaurer l'assistant.

### 6. Mot de passe oublie -> email recovery -> nouveau mot de passe

- Point de depart : `/mot-de-passe-oublie`.
- Etapes : saisir email, recevoir lien, ouvrir lien Supabase avec `type=recovery`, afficher `/nouveau-mot-de-passe`, update password.
- Donnees utilisees : Supabase Auth `resetPasswordForEmail`, `updateUser`.
- Messages affiches : `Email envoye`, `Choisis un nouveau mot de passe`, `Mot de passe mis a jour`.
- Sortie attendue : retour espace ou connexion.
- Erreurs possibles : lien expire, absence `type=recovery`, mot de passe trop court, confusion avec confirmation email.

### 7. Modification du profil fiscal

- Point de depart : `/app/profil`.
- Etapes : ouvrir edition, modifier champ, afficher confirmation si changement structurant, sauvegarder.
- Donnees utilisees : `fiscal_profiles`, `answers` adaptes, `computeObligations`.
- Messages affiches : `Modifier ce champ peut changer tes estimations`, `Profil fiscal enregistre`.
- Sortie attendue : dashboard recalculé avec logique existante.
- Erreurs possibles : echec upsert, dates invalides, changement ACRE/activite qui modifie les labels attendus.

### 8. Reinitialisation complete du profil

- Point de depart : `/app/profil` ou `/app/parametres`.
- Etapes : ouvrir confirmation, choisir reset profil seul ou reset complet, confirmer, supprimer donnees concernees.
- Donnees utilisees : `fiscal_profiles.delete`, `revenues.delete`, `invoices.delete`, `reminders.delete`, localStorage keys.
- Messages affiches : avertissement clair, liste de ce qui sera conserve/supprime, succes ou erreur.
- Sortie attendue : profil seul -> `/onboarding`; reset complet -> espace vide/onboarding.
- Erreurs possibles : suppression partielle, localStorage non nettoye, utilisateur pensait supprimer seulement le profil.

### 9. Ajout du premier revenu

- Point de depart : `/app` etat nouvel utilisateur.
- Etapes : cliquer `Ajouter mon premier revenu`, saisir montant/date, valider, sauvegarder localement ou Supabase.
- Donnees utilisees : `revenues_guest` ou table `revenues`, profil fiscal pour estimation.
- Messages affiches : `Revenu ajoute`, `Voici combien mettre de cote`.
- Sortie attendue : dashboard etat 2 avec total mois et estimation cotisations.
- Erreurs possibles : montant invalide, activite mixte sans categorie, echec insert, duplication apres migration.

### 10. Premiere declaration URSSAF

- Point de depart : `/app/echeances` ou carte prochaine action.
- Etapes : voir prochaine echeance, verifier revenus, voir montant a declarer/prevoir, ouvrir lien officiel URSSAF.
- Donnees utilisees : `computeObligations`, revenus, `declaration_frequency`.
- Messages affiches : `Microassist ne declare pas a ta place`, `Prepare ton chiffre d'affaires avant l'echeance`.
- Sortie attendue : utilisateur comprend quoi declarer et ou le faire.
- Erreurs possibles : periodicite inconnue, aucun revenu, echeance simplifiee non adaptee a un cas particulier.

### 11. Creation de la premiere facture

- Point de depart : `/app/factures` ou apres premier revenu.
- Etapes : ouvrir generateur, saisir client/prestation/montant, verifier SIRET vendeur, generer PDF + XML.
- Donnees utilisees : `InvoiceGenerator`, `facturx.js`, `guest_invoices`, `invoices` legacy, `billing_identity`.
- Messages affiches : `Facture compatible 2026 preparee`, `Transmission PDP non activee`, avertissement SIRET si manquant.
- Sortie attendue : facture locale visible, PDF/XML telecharges.
- Erreurs possibles : SIRET manquant, date echeance avant date facture, montant invalide, confusion avec transmission automatique.

## 5. Onboarding Fiscal V2

Regle centrale : ne pas demander le chiffre d'affaires estime pendant l'onboarding principal. Cette information peut etre demandee plus tard dans une simulation ou un profil avance.

### Etape 1. Activite principale

- Titre : `Ton activite principale`
- Explication simple : `Cela sert a estimer le bon taux de cotisations.`
- Choix : `Services`, `Commerce`, `Mixte`.
- Bouton principal : `Continuer`.
- Bouton retour : absent si premiere etape.
- Validation : un choix obligatoire.
- Valeur par defaut : aucune selection pre-validee.

### Etape 2. Rythme de declaration

- Titre : `Ton rythme de declaration`
- Explication simple : `C'est la frequence a laquelle tu declares ton chiffre d'affaires a l'URSSAF.`
- Choix : `Mensuelle`, `Trimestrielle`, `Je ne sais pas`.
- Bouton principal : `Continuer`.
- Bouton retour : `Retour`.
- Validation : un choix obligatoire ; `Je ne sais pas` est accepte.
- Valeur par defaut : aucune.

### Etape 3. Date de debut d'activite

- Titre : `Date de debut d'activite`
- Explication simple : `Cette date aide a situer tes echeances et certaines aides comme l'ACRE.`
- Choix : champ date, option `Je ne l'ai pas sous la main`.
- Bouton principal : `Continuer`.
- Bouton retour : `Retour`.
- Validation : date valide si renseignee.
- Valeur par defaut : vide.

### Etape 4. Statut ACRE

- Titre : `Ta situation ACRE`
- Explication simple : `L'ACRE peut reduire tes cotisations au debut de l'activite.`
- Choix : `A demander`, `Demandee`, `Acceptee`, `Refusee`, `Non concerne`, `Je ne sais pas`.
- Bouton principal : `Continuer`.
- Bouton retour : `Retour`.
- Validation : un choix obligatoire.
- Valeur par defaut : `Je ne sais pas` peut etre propose comme choix de repli, mais pas selectionne automatiquement.

### Etape 5. Statut TVA

- Titre : `Ton statut TVA`
- Explication simple : `Beaucoup de micro-entrepreneurs commencent sans facturer la TVA, puis doivent la surveiller si leur chiffre d'affaires augmente.`
- Choix : `Franchise en base`, `TVA active`, `Je ne sais pas`.
- Bouton principal : `Continuer`.
- Bouton retour : `Retour`.
- Validation : un choix obligatoire.
- Valeur par defaut : aucune.

### Etape 6. Resume final

- Titre : `Ton espace est pret`
- Explication simple : `Microassist peut maintenant te montrer les prochaines actions et les montants a mettre de cote quand tu ajoutes tes revenus.`
- Choix : resume des reponses + liens `Modifier`.
- Bouton principal : connecte `Valider mon profil`, invite `Creer mon compte`.
- Bouton retour : `Retour`.
- Validation : profil minimal complet ou champs inconnus explicitement acceptes.
- Valeur par defaut : non applicable.

## 6. Tableau de Bord Progressif

### Etat 1 - Nouvel utilisateur, aucun revenu

Afficher uniquement :

- Bonjour + prenom ou email.
- Prochaine action recommandee.
- Bouton `Ajouter mon premier revenu`.
- Prochaine echeance connue.
- Statut ACRE.
- Statut TVA.
- Raccourci vers le profil.

Masquer ou reduire :

- Score fiscal.
- Analyse financiere.
- Projections.
- Graphiques.
- Recapitulatif hebdomadaire.
- Exports.
- Partage conseiller.

Objectif UX : eviter l'impression d'un tableau de bord vide ou anxiogene.

### Etat 2 - Utilisateur avec des revenus

Ajouter progressivement :

- Revenus du mois.
- Estimation des cotisations.
- Montant conseille a mettre de cote.
- Historique simple.
- Prochaine declaration.
- Factures.

Objectif UX : relier chaque revenu a une consequence utile et immediate.

### Etat 3 - Utilisateur actif avec historique

Ajouter :

- Analyse.
- Tendances.
- Projections.
- Alertes TVA.
- Exports.
- Partage avec conseiller.
- Syntheses periodiques.

Objectif UX : transformer l'historique en aide a la decision, sans surcharger les nouveaux utilisateurs.

## 7. Navigation

### Navigation publique

- `Accueil`
- `Fonctionnalites`
- `Tarifs`
- `Aide`
- `Se connecter`
- `Commencer`

Regles :

- `Commencer` reste l'action primaire.
- `Se connecter` reste toujours visible.
- Les pages marketing ne contiennent pas d'actions privees.

### Navigation privee

- `Aujourd'hui`
- `Revenus`
- `Factures`
- `Echeances`
- `Rappels`
- `Profil`

Regles en mode connecte :

- Afficher clairement email ou prenom.
- Afficher `Deconnexion`.
- Ne pas afficher `Creer mon compte`.
- Ne pas melanger pages marketing et actions privees.

Regles en mode invite temporaire :

- Afficher `Session temporaire`.
- Afficher `Creer mon compte` comme action de securisation.
- Garder `Continuer sans compte` possible tant que le mode invite est supporte.

## 8. Hierarchie Visuelle

- Une action principale par ecran.
- Cartes limitees aux blocs d'information vraiment actionnables.
- Beaucoup d'espace et des regroupements clairs.
- Titres courts : `Aujourd'hui`, `Revenus`, `Factures`, `Profil`.
- Texte administratif simplifie : expliquer le resultat avant le terme technique.
- Statuts visuels coherents : `ok`, `a surveiller`, `urgent`, `incomplet`.
- Couleurs d'alerte reservees aux vraies alertes : retard, seuil TVA depasse, echec sauvegarde.
- Boutons :
  - `primary` : action principale.
  - `secondary` : action utile mais non principale.
  - `ghost` : navigation, annulation, action discrete.
  - `danger` : suppression, reset, actions irreversibles.
- Responsive :
  - Desktop : navigation privee laterale, contenu en colonne principale lisible.
  - Mobile : navigation basse ou menu compact, une action primaire sticky seulement si necessaire.
- Aucune animation complexe. Transitions simples uniquement si elles clarifient un changement d'etat.

## 9. Design System Minimal

### `AppShell`

- Role : structure globale public/prive, providers, zones de navigation.
- Variantes : `public`, `private`, `temporary`.
- Donnees recues : utilisateur, etat profil, navigation active.
- Etats : loading session, empty profil absent, error chargement global, success non applicable.

### `PublicHeader`

- Role : navigation marketing.
- Variantes : desktop, mobile.
- Donnees recues : liens, session temporaire existe, utilisateur connecte.
- Etats : loading auth, empty non applicable, error non applicable, success non applicable.

### `PrivateSidebar`

- Role : navigation privee desktop.
- Variantes : connecte, invite temporaire, premium/trial.
- Donnees recues : liens, email/prenom, etat actif.
- Etats : loading profil, empty profil incomplet, error session, success non applicable.

### `MobileNavigation`

- Role : navigation compacte mobile.
- Variantes : public, private.
- Donnees recues : liens, action primaire, etat actif.
- Etats : loading, empty, error, success selon contexte.

### `PageHeader`

- Role : titre court, contexte, action principale.
- Variantes : simple, avec badge, avec action.
- Donnees recues : title, subtitle, badge, primaryAction.
- Etats : loading skeleton, empty subtitle optionnel, error banner, success notice.

### `PrimaryActionCard`

- Role : montrer la prochaine action recommandee.
- Variantes : onboarding, firstRevenue, declaration, profileIncomplete, invoice.
- Donnees recues : titre, description, action, priorite.
- Etats : loading, empty si aucune action, error si action indisponible, success apres action.

### `StatusBadge`

- Role : representer un statut fiscal ou produit.
- Variantes : ok, warning, danger, neutral, premium, temporary.
- Donnees recues : label, tone, tooltip.
- Etats : loading, empty `A confirmer`, error `Indisponible`, success `OK`.

### `AlertBanner`

- Role : afficher une information importante.
- Variantes : info, warning, danger, success.
- Donnees recues : message, action optionnelle, dismissible.
- Etats : loading non applicable, empty masque, error visible, success visible temporaire.

### `EmptyState`

- Role : guider quand aucune donnee n'existe.
- Variantes : noRevenue, noInvoice, noReminder, noProfile.
- Donnees recues : title, message, primaryAction, secondaryAction.
- Etats : empty principal, loading si donnees en cours, error si chargement echoue, success non applicable.

### `Modal`

- Role : conteneur generique de dialogue.
- Variantes : standard, large, fullscreenMobile.
- Donnees recues : title, children, closeAction.
- Etats : loading contenu, empty possible, error message, success confirmation.

### `ConfirmationDialog`

- Role : confirmer action sensible.
- Variantes : neutral, danger.
- Donnees recues : title, message, confirmLabel, cancelLabel.
- Etats : loading pendant action, error si action echoue, success fermeture/notice.

### `FormField`

- Role : champ formulaire standard.
- Variantes : text, number, date, select, textarea.
- Donnees recues : label, value, helper, error, required.
- Etats : loading disabled, empty value, error validation, success valid.

### `Button`

- Role : action utilisateur.
- Variantes : primary, secondary, ghost, danger, icon.
- Donnees recues : label, icon, disabled, loading.
- Etats : loading, disabled, error externe, success via feedback parent.

### `ProgressSteps`

- Role : indiquer progression onboarding.
- Variantes : compact, full.
- Donnees recues : steps, currentStep, completedSteps.
- Etats : loading, empty non affiche, error etape invalide, success complet.

### `SummaryCard`

- Role : afficher un resume fiscal ou de donnees.
- Variantes : profile, monthlyRevenue, savings, compliance.
- Donnees recues : title, rows, action.
- Etats : loading, empty, error, success.

### `DeadlineCard`

- Role : afficher une echeance et son niveau d'urgence.
- Variantes : urssaf, tva, cfe, acre.
- Donnees recues : date, label, daysLeft, status, action.
- Etats : loading, empty `A definir`, error, success `Pret`.

### `RevenueCard`

- Role : afficher un revenu saisi.
- Variantes : compact, detailed, mixedActivity.
- Donnees recues : amount, date, category, client, note, actions.
- Etats : loading, empty non applicable, error action, success action.

### `InvoiceCard`

- Role : afficher une facture.
- Variantes : localDraft, persisted, paid, unpaid, nonCompliant.
- Donnees recues : number, client, amount, date, dueDate, status, compliance, actions.
- Etats : loading, empty non applicable, error action, success paid/download.

## 10. Fonctions a Conserver

### Fonctions metier a conserver telles quelles

- `computeObligations`.
- `getDashValue`.
- Les taux actuels de cotisations dans `obligations.js`.
- La logique ACRE actuelle.
- La logique TVA actuelle de `computeObligations`.
- `VAT_MODES`, `calculateVatRate`, `getInvoiceTotals`.
- `isInvoiceCompliant`, `getInvoiceComplianceScore`.
- `createFacturXReadyInvoiceDraft`, `generateFacturXXml`, `downloadTextFile`.
- `generateB2CInvoicePdf`.

### Acces Supabase a conserver

- Auth : session, state changes, sign up, sign in, sign out, recovery, resend confirmation.
- `profiles` pour profil utilisateur, plan, trial, premium, billing identity.
- `fiscal_profiles` pour profil fiscal et preferences de rappels.
- `revenues` pour revenus connectes.
- `invoices` pour factures persistables/legacy.
- `reminders` pour rappels declaration.
- `offer_interest` et `join_premium_waitlist` pour interet premium.
- Edge Function `send-trial-ending-email`.
- Edge Function `send-reminder`.

### Composants eventuellement reutilisables

- `AuthGate` comme base fonctionnelle auth/recovery, a adapter plus tard en pages.
- `CGUModal`.
- `InvoiceGenerator`, en conservant explicitement les messages Factur-X/PDP.
- `PricingPage`, si separe de l'espace prive.
- `ExpertDashboard`, comme module a part ou fonctionnalite separee.

### Fonctions a extraire de `App.jsx`

- Services Supabase : profils, fiscal profiles, revenus, factures, rappels, premium.
- Gestion localStorage/sessionStorage et migrations.
- Normalisation profil fiscal et detection de conflits.
- Handlers revenus.
- Handlers factures.
- Handlers rappels.
- Gestion premium/trial/export limits.
- Tracking client et dedupe emails.
- Resets profil/espace.
- Navigation et detection des etats utilisateur.

### Composants anciens a remplacer

- Dashboard monolithique dans `App.jsx`.
- Modales inline dispersees dans `App.jsx`.
- Navigation publique/privee melangee.
- Assistant conversationnel comme seul parcours de profil initial si l'onboarding V2 devient structure.
- Blocs d'analyse affiches trop tot pour les nouveaux utilisateurs.

### Donnees localStorage a migrer

- `microassist_v1`.
- `microassist_profile_v1`.
- `revenues_guest`.
- `guest_invoices`.
- `microassist_reminder_prefs`.
- `microassist_show_chart`.
- `microassist_dashboard_sections`.
- `microassist_dashboard_reminders_dismissed`.
- `microassist_dashboard_top_nudge_dismissed`.
- `microassist_dashboard_checklist_collapsed`.
- `microassist_first_revenue_onboarding_seen`.
- `microassist_beta_micro_feedback`.
- `microassist_profile_conflict_strategy`.
- `microassist_export_usage_<YYYY-MM>`.
- `microassist_email_event_*`.

### Risques de regression

- Calculs modifies indirectement par changement de mapping profil.
- Perte de donnees invite pendant migration.
- Ecrasement profil distant par brouillon local.
- Recovery password affiche hors `type=recovery`.
- Confirmation email confondue avec reset password.
- Factures locales Factur-X supprimees ou mal migrees.
- Rappels SMS presentes comme disponibles alors qu'ils ne le sont pas.
- Dashboard trop riche pour un nouvel utilisateur.
- Navigation connectee affichant encore des CTA creation de compte.
- Build passant mais parcours critiques non testes.

## 11. Plan de Migration

### Phase 0 - Protection et tests

- Fichiers a creer : tests de caracterisation pour calculs, factures, storage, routing states.
- Fichiers a modifier : tests uniquement.
- Fonctions reutilisees : `computeObligations`, `facturx.js`, handlers via parcours UI existants.
- Tests necessaires : build, Playwright existants, tests unitaires calculs.
- Criteres d'acceptation : comportement actuel documente et testable.
- Strategie retour arriere : supprimer les tests ajoutes si bloquants, aucun code produit touche.

### Phase 1 - Nouveau router et etats utilisateur

- Fichiers a creer : `src/router`, `src/domain/session`, hooks d'etat utilisateur.
- Fichiers a modifier : integration minimale dans `App.jsx`, sans suppression massive.
- Fonctions reutilisees : auth context, detection profil, local draft.
- Tests necessaires : redirections invite/connecte/recovery.
- Criteres d'acceptation : chaque etat utilisateur mene a la bonne destination.
- Strategie retour arriere : revenir au routage `appView` existant.

### Phase 2 - Pages publiques et authentification

- Fichiers a creer : pages publiques, pages auth dediees.
- Fichiers a modifier : `AuthGate` seulement si necessaire, shell public.
- Fonctions reutilisees : appels Supabase Auth existants.
- Tests necessaires : inscription, connexion, email non confirme, recovery.
- Criteres d'acceptation : public et prive clairement separes.
- Strategie retour arriere : garder `AuthGate` modal existant comme fallback.

### Phase 3 - Onboarding

- Fichiers a creer : pages onboarding V2, composants `ProgressSteps`, resume.
- Fichiers a modifier : mapping vers `fiscal_profiles`, local draft.
- Fonctions reutilisees : `buildFiscalProfilePayload`, normalisations, sauvegarde profil.
- Tests necessaires : invite, connecte sans profil, champs inconnus, resume.
- Criteres d'acceptation : profil minimal cree sans demander CA estime.
- Strategie retour arriere : conserver assistant fiscal existant accessible.

### Phase 4 - Shell prive

- Fichiers a creer : `AppShell`, `PrivateSidebar`, `MobileNavigation`, `PageHeader`.
- Fichiers a modifier : composition de l'espace prive.
- Fonctions reutilisees : etat session/profil/premium.
- Tests necessaires : navigation desktop/mobile, logout, invite temporaire.
- Criteres d'acceptation : aucune page marketing dans l'espace prive.
- Strategie retour arriere : restaurer navigation actuelle dans `App.jsx`.

### Phase 5 - Revenus

- Fichiers a creer : domaine revenus, page `/app/revenus`, cartes revenus.
- Fichiers a modifier : extraction handlers revenus.
- Fonctions reutilisees : `refreshRevenues`, `saveRevenueToSupabase`, `deleteRevenueFromSupabase`, local guest.
- Tests necessaires : premier revenu, activite mixte, suppression, migration invite.
- Criteres d'acceptation : totaux et estimations identiques.
- Strategie retour arriere : rebrancher bloc revenus existant.

### Phase 6 - Factures

- Fichiers a creer : domaine factures, page `/app/factures`, `InvoiceCard`.
- Fichiers a modifier : integration `InvoiceGenerator`.
- Fonctions reutilisees : `facturx.js`, `generateB2CInvoicePdf`, `handleMarkInvoicePaid`.
- Tests necessaires : creation PDF/XML, SIRET manquant, facture payee, local draft.
- Criteres d'acceptation : aucune transmission automatique promise, brouillons locaux preserves.
- Strategie retour arriere : conserver composant et liste existants.

### Phase 7 - Rappels et echeances

- Fichiers a creer : pages `/app/echeances`, `/app/rappels`, domaine reminders.
- Fichiers a modifier : extraction preferences et deadline cards.
- Fonctions reutilisees : `computeObligations`, `calculateNextReminder`, save prefs.
- Tests necessaires : periodicite mensuelle/trimestrielle/inconnue, prefs email, SMS indisponible.
- Criteres d'acceptation : echeances identiques et message clair `Microassist ne declare pas a ta place`.
- Strategie retour arriere : rebrancher modal rappels existante.

### Phase 8 - Profil

- Fichiers a creer : page `/app/profil`, edition profil, reset dialogs.
- Fichiers a modifier : extraction edition selective.
- Fonctions reutilisees : `refreshFiscalProfile`, `saveFiscalProfileToSupabase`, reset profile/full reset.
- Tests necessaires : modification activite, ACRE, dates, reset profil, reset complet.
- Criteres d'acceptation : changement profil recalcule sans changer la logique.
- Strategie retour arriere : garder edition inline actuelle.

### Phase 9 - Dashboard progressif

- Fichiers a creer : page `/app`, composants dashboard progressif.
- Fichiers a modifier : extraction `useDashboardState`.
- Fonctions reutilisees : `computeObligations`, revenus, factures, rappels, premium access.
- Tests necessaires : etat 1 aucun revenu, etat 2 revenus, etat 3 historique.
- Criteres d'acceptation : un nouvel utilisateur voit seulement les actions essentielles.
- Strategie retour arriere : conserver ancien dashboard derriere feature flag.

### Phase 10 - Suppression controlee de l'ancienne interface

- Fichiers a creer : aucun sauf notes de migration.
- Fichiers a modifier : suppression progressive des blocs morts de `App.jsx`.
- Fonctions reutilisees : toutes celles deja extraites.
- Tests necessaires : suite complete, build, tests manuels auth/onboarding/revenus/factures/profil.
- Criteres d'acceptation : `App.jsx` devient orchestration, pas source metier.
- Strategie retour arriere : commit par phase permettant revert cible.

## 12. Regles de Securite du Refactoring

- Aucune modification massive de `App.jsx` en une seule etape.
- Aucun changement de schema Supabase sans validation explicite.
- Aucun changement des calculs fiscaux sans tests.
- Aucune suppression avant que la nouvelle version equivalente fonctionne.
- Un commit Git par phase.
- `npm run build` apres chaque phase.
- Tests Auth, onboarding, revenus, factures et profil apres chaque phase.
- Ne jamais modifier simultanement plusieurs parcours critiques.
- Conserver les cles localStorage jusqu'a migration explicite et testee.
- Garder le mode invite fonctionnel pendant toute la transition.
- Ajouter des feature flags ou chemins de fallback pour les remplacements de surface importants.

## Checklist de Validation Produit

- La promesse `quoi faire maintenant / ensuite / combien mettre de cote` est visible dans l'espace prive.
- Le site public ne montre pas de donnees privees.
- Le dashboard nouvel utilisateur ne montre pas d'analyse vide.
- La creation de compte est toujours facile a trouver en mode invite.
- La connexion est toujours visible sur le site public.
- Les textes ne suggerent jamais une declaration URSSAF automatique.
- Les textes ne suggerent jamais une transmission PDP automatique.
- Les termes URSSAF, ACRE, TVA, CFE sont expliques simplement.

## Checklist Technique

- `npm run build` passe.
- Les tests calculs couvrent cotisations, ACRE, TVA, echeances.
- Les tests factures couvrent HT/TVA/TTC, SIRET, PDF/XML.
- Les tests auth couvrent signin, signup, email non confirme, recovery.
- Les tests storage couvrent invite, migration et conflit local/distant.
- Les appels Supabase sont encapsules avant suppression de code ancien.
- Les resets sont couverts avant refactor de profil.
- Les donnees Factur-X locales ne sont pas migrees/supprimees sans test dedie.

## Checklist UX

- Chaque page a une action primaire unique.
- Les actions secondaires sont visibles mais moins fortes.
- Les messages administratifs sont courts.
- Les alertes rouges sont reservees aux vrais problemes.
- Les pages mobiles restent lisibles sans blocs trop denses.
- Les modales critiques indiquent clairement les consequences.
- Les etats loading, empty, error et success existent pour les composants cles.
- Le mode invite affiche toujours `Session temporaire`.

## Decisions a Valider avec la Fondatrice

- Le niveau de detail exact du site public : tres court ou plus pedagogique.
- Le libelle final de la promesse principale.
- Le choix entre onboarding structure V2 et assistant conversationnel conserve comme aide.
- Le statut produit du mode invite : duree, limites, messages.
- Les libelles ACRE V2 et leur mapping exact vers les valeurs existantes (`yes`, `no`, `unknown`).
- La place du chiffre d'affaires estime : simulation, profil avance ou jamais demande.
- La strategie premium : page tarifs publique, modal waitlist, limites gratuites.
- La presence de l'espace expert dans la V2 initiale ou dans une version separee.
- Les criteres exacts pour passer du dashboard etat 2 a etat 3.
- Les textes legaux autour de Factur-X et de l'absence de transmission automatique.
