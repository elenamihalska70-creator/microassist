# CODING STANDARDS V3

Guide officiel de developpement de Microassist V2

## 1. Mission

Ce document definit les regles obligatoires de developpement pour Microassist V2. Il sert de reference unique pour les decisions de code : structure, responsabilites, tests, erreurs, nommage, dette technique et conditions d'arret.

Il ne decrit pas le produit, le UX, l'architecture cible ou le roadmap. Ces sujets sont deja couverts par les documents de reference.

Aucune implementation ne doit deroger a ces standards sans decision documentee, justifiee et reliee aux documents de reference.

Toutes les futures implementations devront respecter ce document.

## 2. Documents De Reference

Hierarchie applicable :

1. Product Vision
2. Design Principles
3. UX Blueprint
4. Product Blueprint
5. Implementation Roadmap
6. Coding Standards

Ce document ne peut jamais contredire les documents situes au-dessus. En cas de doute, la Product Vision, les Design Principles et le UX Blueprint priment toujours.

Le role du Coding Standards est de transformer ces decisions en discipline de developpement : comment ecrire le code, comment le decouper, comment le tester et comment eviter de recreer les problemes constates dans `ARCHITECTURE_AUDIT.md`.

## 3. Principes Generaux

Principes obligatoires :

- simplicite ;
- lisibilite ;
- modularite ;
- testabilite ;
- explicabilite ;
- faible couplage ;
- separation des responsabilites ;
- une seule source de verite ;
- architecture par domaines.

Le code doit etre comprehensible par un developpeur qui decouvre le projet. Une fonction claire, testee et un peu plus longue vaut mieux qu'une abstraction prematuree difficile a suivre.

Chaque changement doit indiquer implicitement ou explicitement :

- quelle responsabilite il traite ;
- quelle source de verite il utilise ;
- quel comportement il preserve ;
- quel test le protege ;
- comment revenir en arriere si necessaire.

## 4. Structure Des Dossiers

Structure cible recommandee, a introduire progressivement et sans incompatibilite brutale avec l'existant :

```text
src/
  pages/
  domains/
  components/
  shared/
  ui/
  hooks/
  services/
  repositories/
  adapters/
  engines/
  rules/
  models/
  utils/
  config/
tests/
```

Roles :

- `pages/` : pages et orchestration de route. Les pages chargent les donnees necessaires, composent les features et gerent les etats de page.
- `domains/` : logique metier par domaine, cas d'usage, validations, transitions et modeles propres au domaine.
- `components/` : composants metier ou feature components lies a une experience precise.
- `shared/` : composants et helpers partages qui ne portent pas de regle fiscale ou de logique domaine profonde.
- `ui/` : primitives visuelles reutilisables : Button, Input, Modal, Select, Tabs, Skeleton.
- `hooks/` : hooks React d'orchestration ou d'adaptation UI, sans regles fiscales critiques.
- `services/` : services applicatifs ou techniques coordonnant plusieurs operations.
- `repositories/` : acces aux donnees persistantes par domaine.
- `adapters/` : adaptation d'infrastructure, Supabase, localStorage, storage, auth, format externe.
- `engines/` : moteurs purs : Calculation, Today Decision, Deadline, Visibility, Notification, Document.
- `rules/` : regles reglementaires ou produit sourcees, datees, versionnees.
- `models/` : modeles conceptuels et structures partagees.
- `utils/` : fonctions utilitaires pures et generales.
- `config/` : configuration statique non sensible.
- `tests/` : tests de parcours, integration et non-regression.

Cette structure est une cible. Elle doit etre introduite par lots, selon `IMPLEMENTATION_ROADMAP_V3.md`, sans deplacement massif non teste.

## 5. Regles Pour Les Composants React

Regles :

- une responsabilite par composant ;
- composants courts et lisibles ;
- props explicites ;
- pas de logique metier ;
- pas de calcul fiscal ;
- pas d'acces direct a Supabase ;
- pas de dependance circulaire ;
- pas de mutation silencieuse de donnees metier ;
- pas de source de verite locale concurrente d'un domaine ;
- etats accessibles, labels explicites, focus visible et erreurs associees aux champs.

Un composant React peut :

- afficher un view model ;
- collecter une intention utilisateur ;
- declencher un callback ;
- gerer un etat UI local ;
- afficher chargement, vide, erreur ou succes.

Un composant React ne doit pas :

- choisir un taux fiscal ;
- determiner si l'ACRE est applicable ;
- calculer une echeance reglementaire ;
- decider si une declaration est valide ;
- ecrire directement dans Supabase ;
- lire ou ecrire directement localStorage, sauf primitive technique explicitement dediee ;
- transformer une facture en revenu sans cas d'usage.

Taille recommandee :

- objectif : composant <= 300 lignes ;
- au-dela, verifier si la responsabilite est trop large ;
- exception acceptable pour une migration temporaire, uniquement si elle est documentee et planifiee pour extraction.

## 6. Regles Pour Les Domaines

Chaque domaine porte la logique metier. Jamais l'interface.

Un domaine peut contenir :

- cas d'usage ;
- repositories ;
- services ;
- validations ;
- etats ;
- modeles ;
- transitions ;
- erreurs metier ;
- evenements metier.

Un domaine doit exposer une interface claire vers les pages et composants. Il ne doit pas dependre de details visuels, de classes CSS, de composants React ou de textes d'interface non necessaires a la logique.

Exemples de domaines :

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

Regles :

- un cas d'usage correspond a une intention claire ;
- les validations critiques vivent dans le domaine ;
- les erreurs metier sont explicites ;
- les donnees confirmees, estimees, derivees et temporaires restent distinctes ;
- un domaine ne modifie pas directement l'etat interne d'un autre domaine ;
- les communications transverses passent par cas d'usage, services d'orchestration ou evenements metier documentes.

## 7. Regles Pour Les Engines

Les engines sont des modules purs ou quasi purs, testables sans navigateur et sans React.

### Calculation Engine

Responsabilite : produire les estimations, reserves conseillees, details de calcul, taux utilises, donnees manquantes, avertissements et niveau de confiance.

Il depend de Profile, Revenue et Rules. Il ne depend jamais de React, de composants, de CSS ou de l'affichage.

### Rules Engine

Responsabilite : selectionner et resoudre les regles reglementaires ou produit selon source, date, periode d'application, version et statut historique.

Il ne depend jamais de Presentation. Aucune regle fiscale critique ne doit exister seulement dans un composant.

### Today Decision Engine

Responsabilite : choisir la situation actuelle, l'action principale, les actions secondaires, la priorite, la justification et la destination de `Aujourd'hui`.

Il decide ; l'interface affiche.

### Deadline Engine

Responsabilite : produire des echeances confirmees, estimees ou inconnues, avec source, statut, priorite et action associee.

Une date inconnue doit rester inconnue.

### Visibility Engine

Responsabilite : decider quelles fonctions, sections et niveaux de detail sont visibles selon le contexte.

Il ne modifie jamais les calculs.

### Notification Engine

Responsabilite : gerer rappels internes, notifications futures, consentement, frequence, canal, statut et historique.

Il ne doit jamais envoyer de notification distante sans consentement valide.

### Document Engine

Responsabilite : gerer documents generes et documents utilisateur, metadonnees, stockage, droits, suppression et tracabilite.

Il ne doit pas promettre de stockage securise si l'infrastructure n'est pas validee.

## 8. Gestion De L'Etat

Categories d'etat :

- etat persistant ;
- etat derive ;
- etat UI ;
- etat temporaire.

### Etat Persistant

Exemples : profil, revenus, factures, declarations, statuts ACRE, preferences, historique.

Regles :

- persister uniquement les donnees qui doivent survivre au rechargement ;
- passer par repositories ou adapters ;
- proteger les donnees utilisateur ;
- historiser les changements sensibles.

### Etat Derive

Exemples : total de periode, reserve conseillee, prochaine action, niveau de confiance, prochaine echeance.

Regles :

- recalculer depuis les sources fiables ;
- ne pas dupliquer comme source de verite ;
- conserver seulement si l'estimation doit etre historisee.

### Etat UI

Exemples : modale ouverte, onglet actif, filtre, etat de chargement, message temporaire.

Regles :

- rester local lorsque possible ;
- ne pas porter de decision metier ;
- ne pas declencher seul une mutation persistante.

### Etat Temporaire

Exemples : formulaire en cours, brouillon, saisie non sauvegardee, etape de parcours.

Regles :

- conserver en cas d'erreur ;
- avertir avant perte ;
- ne pas confondre brouillon et donnee confirmee.

Ne jamais melanger ces categories. Une modale ouverte ne doit jamais devenir la preuve qu'une declaration est faite.

## 9. Supabase

Regles :

- jamais d'appel direct depuis les composants ;
- toujours passer par des adapters ou repositories ;
- aucune regle metier critique uniquement dans les Edge Functions ;
- RLS obligatoire pour les donnees privees ;
- migrations versionnees ;
- environnements separes ;
- donnees de test distinctes ;
- secrets jamais exposes dans le client ;
- erreurs auth sans fuite d'information excessive.

Les repositories doivent encapsuler :

- `select` ;
- `insert` ;
- `update` ;
- `upsert` ;
- `delete` ;
- RPC ;
- appels Edge Functions.

Les Edge Functions peuvent orchestrer une operation serveur, envoyer un email, traiter un rappel ou proteger une operation sensible. Elles ne doivent pas devenir la seule source de verite des regles fiscales ; elles doivent consommer les memes regles versionnees que le reste du domaine lorsque cela est applicable.

Toute modification de schema, RLS, storage ou Edge Function doit attendre un livrable de migration approprie lorsque la roadmap l'exige.

## 10. Local Storage

localStorage est autorise pour :

- mode decouverte ;
- brouillons locaux ;
- preferences non sensibles ;
- etats de confort UI ;
- dedupe temporaire non critique ;
- compatibilite avec les donnees invite existantes.

localStorage est interdit pour :

- secrets ;
- donnees sensibles non protegees ;
- preuve officielle ;
- source unique d'une information fiscale critique connectee ;
- remplacement silencieux d'une donnee cloud ;
- documents utilisateur sensibles ;
- consentement legal non verifie.

Regles :

- centraliser les cles ;
- versionner les donnees ;
- documenter le schema local ;
- fournir lecture defensive et fallback ;
- preparer les migrations avant renommage ;
- ne jamais supprimer silencieusement des donnees locales ;
- conserver la copie locale jusqu'au succes confirme d'une migration ;
- tester localStorage indisponible ou corrompu.

Les cles existantes decrites dans `ARCHITECTURE_AUDIT.md` doivent etre preservees tant qu'une migration explicite n'est pas implementee et testee.

## 11. Tests

### Tests Unitaires

Obligatoires pour :

- Rules Engine ;
- Calculation Engine ;
- Today Decision Engine ;
- Deadline Engine ;
- validations de domaine ;
- Visibility Engine ;
- regles de migration ;
- changements de profil fiscal.

### Tests D'Integration

Obligatoires lorsqu'un lot relie plusieurs domaines :

- Profile + Revenue + Calculation ;
- ACRE + Rules + Calculation ;
- Revenue + Declaration ;
- Invoice payee + proposition de Revenue ;
- mode decouverte + migration ;
- authentification + routes protegees ;
- modification fiscale + historique ;
- Deadline + Today.

### Tests De Parcours

Obligatoires pour les parcours utilisateur critiques :

- premiere visite ;
- mode decouverte ;
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

### Tests Reglementaires

Obligatoires avant toute modification fiscale :

- dates frontieres ;
- versions historiques ;
- ACRE avant/apres changement ;
- statut inconnu ou non confirme ;
- activite mixte ;
- changement de taux ;
- periodes mensuelles et trimestrielles ;
- regles absentes ;
- arrondis ;
- reproduction d'une estimation historique.

### Tests D'Accessibilite

Obligatoires pour tout nouvel ecran ou composant interactif :

- clavier ;
- focus ;
- labels ;
- erreurs ;
- annonces dynamiques ;
- contrastes ;
- navigation mobile.

### Tests De Securite

Obligatoires pour auth, donnees privees, documents, migration et Supabase :

- routes privees ;
- separation utilisateurs ;
- RLS ;
- session expiree ;
- ecriture non autorisee ;
- acces documents ;
- donnees locales non fusionnees sans consentement.

Aucune regle fiscale critique ne doit etre validee uniquement par un test manuel dans l'interface.

## 12. Gestion Des Erreurs

Categories :

- exceptions techniques ;
- validation utilisateur ;
- erreurs auth ;
- erreurs reseau ;
- erreurs Supabase ;
- erreurs localStorage ;
- erreurs de migration ;
- calcul impossible ;
- regle absente ;
- incoherence historique ;
- erreur document ;
- erreur service externe.

Regles :

- message utilisateur simple ;
- detail technique journalise separement ;
- aucune perte silencieuse de formulaire ;
- possibilite de reessayer quand c'est utile ;
- fallback securise lorsqu'une regle n'est pas disponible ;
- ne pas afficher une estimation si le calcul est invalide ;
- ne pas masquer une regression connue ;
- rollback possible pour tout lot.

Les logs techniques ne doivent pas contenir de secrets. Les donnees personnelles doivent etre minimisees et pseudonymisees lorsque possible.

## 13. Conventions De Nommage

### Fichiers

- composants React : `PascalCase.jsx` ;
- hooks : `useSomething.js` ou `useSomething.jsx` si JSX necessaire ;
- services : `somethingService.js` ;
- repositories : `somethingRepository.js` ;
- adapters : `somethingAdapter.js` ;
- engines : `somethingEngine.js` ;
- rules : `somethingRules.js` ou fichiers par domaine/date si necessaire ;
- tests : nom du module suivi de `.test.js` ou `.spec.js` selon l'outil.

### Composants

- nommer selon la responsabilite : `RevenueForm`, `TodayAction`, `DeadlineList`.
- eviter les noms vagues : `Manager`, `Container`, `Thing`, `HelperPanel`.

### Hooks

- commencer par `use`.
- exposer une responsabilite claire.
- eviter un hook qui pilote plusieurs domaines sans orchestration explicite.

### Services

- nommer par capacite applicative : `migrationService`, `notificationService`.
- ne pas creer de service omnipotent.

### Repositories

- nommer par source ou domaine : `revenueRepository`, `profileRepository`.
- une methode repository doit parler donnees, pas UI.

### Engines

- nommer par decision ou calcul : `calculationEngine`, `todayDecisionEngine`.
- une sortie d'engine doit etre explicable et testable.

### Constantes

- constantes globales en `UPPER_SNAKE_CASE`.
- constantes locales explicites en camelCase si elles restent dans un petit scope.
- aucune magic number fiscale hors Rules Engine.

### Types Et Modeles

- noms metier explicites : `BusinessProfile`, `Revenue`, `AcreStatus`, `DeclarationPeriod`.
- distinguer `Draft`, `Confirmed`, `Estimated` si le statut change le sens.

### Evenements

- nommer comme un fait passe : `revenueCreated`, `profileUpdated`, `declarationConfirmedByUser`.
- ne pas nommer un evenement comme une intention si l'action n'a pas reussi.

### Variables

- nommer selon le sens metier, pas selon l'affichage.
- preferer `collectedAmount` ou `paidAt` a `value` ou `date` lorsqu'un sens fiscal existe.

## 14. Limites De Complexite

Garde-fous recommandes, non rigides :

- composant <= 300 lignes, objectif ;
- fonction <= 60 a 80 lignes selon le contexte ;
- hook <= une responsabilite claire ;
- fichier domaine <= un sujet metier coherent ;
- eviter les imbrications profondes ;
- eviter les switch geants ;
- eviter les fichiers "god object" ;
- eviter les dependances inutiles ;
- eviter les props drilling excessifs ;
- eviter les abstractions sans usage reel.

Ces limites sont des signaux d'attention. Les depasser peut etre acceptable pendant une migration, mais doit declencher une question : quelle responsabilite doit etre extraite ensuite ?

## 15. Code Smells

Signaux d'alerte :

- duplication ;
- logique metier dans UI ;
- plusieurs sources de verite ;
- magic numbers ;
- TODO oublies ;
- dependances circulaires ;
- composants geants ;
- services omnipotents ;
- etat global inutile ;
- calculs dupliques ;
- appels Supabase directs depuis un composant ;
- localStorage lu ou ecrit dans plusieurs endroits sans adapter ;
- libelle UI qui suggere une action officielle non realisee ;
- estimation affichee sans source, periode ou confiance ;
- facture traitee comme revenu ;
- decision Today encodee dans plusieurs composants ;
- regle ACRE ou TVA dispersee ;
- tests manquants sur une regle modifiee.

Un code smell ne signifie pas toujours qu'il faut refactorer immediatement. Il signifie qu'il faut soit corriger, soit documenter la dette, soit planifier son remboursement.

## 16. Technical Debt

Une dette technique est acceptable seulement si :

- elle permet de reduire un risque plus grand ;
- elle est temporaire ;
- elle est documentee ;
- elle possede un critere de remboursement ;
- elle ne touche pas une regle fiscale critique sans test ;
- elle ne met pas les donnees utilisateur en danger.

Toute dette doit indiquer :

- description ;
- raison ;
- impact ;
- fichier concerne ;
- lot de remboursement ;
- test manquant le cas echeant ;
- personne ou decision responsable si applicable.

Interdiction : TODO sans suivi.

Formats acceptables :

- commentaire court lie a une issue, un lot ou une decision ;
- entree dans un document de migration ;
- test marque comme TODO seulement s'il reference le lot qui doit le completer.

La dette doit etre remboursee dans le lot ou elle devient risquee, pas accumulee jusqu'a une future reecriture globale.

## 17. Revue De Code

Checklist minimale :

- [ ] respecte Product Vision ;
- [ ] respecte Design Principles ;
- [ ] respecte UX Blueprint ;
- [ ] respecte Product Blueprint ;
- [ ] respecte Implementation Roadmap ;
- [ ] respecte Coding Standards ;
- [ ] une seule responsabilite principale ;
- [ ] pas de logique fiscale dans l'UI ;
- [ ] pas d'appel Supabase direct depuis un composant ;
- [ ] pas de nouvelle source de verite concurrente ;
- [ ] donnees locales preservees ou migration explicite ;
- [ ] erreurs utilisateur comprehensibles ;
- [ ] logs techniques sans secret ;
- [ ] accessibilite verifiee si UI ;
- [ ] build passe ;
- [ ] tests passent ;
- [ ] rollback possible ;
- [ ] documentation mise a jour.

Une revue de code doit commencer par les risques : regression, donnees, calculs, auth, securite, accessibilite et coherence documentaire.

## 18. Stop Conditions

Le developpement doit etre interrompu et une decision doit etre demandee si :

- build casse ;
- Blueprint contradictoire ;
- regression inconnue ;
- impossibilite de rollback ;
- regle metier non comprise ;
- conflit documentaire ;
- test impossible ;
- source fiscale absente ;
- changement Supabase non couvert par plan ;
- donnees utilisateur risquees ;
- comportement auth/recovery incertain ;
- migration locale non idempotente ;
- document ou stockage sensible non securise ;
- fonctionnalite pouvant faire croire a une action officielle.

Dans ces cas, arreter l'implementation, conserver l'etat du projet, documenter le blocage et demander une decision. Ne pas compenser une incertitude metier par du code improvise.

## 19. Regle D'Or

La stabilite prime sur la vitesse.

La qualite prime sur la quantite.

Une seule responsabilite par module.

Toujours tester avant de supprimer.

Jamais de logique metier dans l'UI.

Jamais de regle fiscale sans source.

Jamais de duplication volontaire.

Chaque changement doit etre explicable.

Chaque changement doit etre testable.

Chaque changement doit etre reversible.

Apres chaque livraison, le projet doit etre plus propre qu'avant.

En cas de doute, choisir la solution la plus simple, la plus lisible, la plus testable et la plus coherente avec les documents de reference.
