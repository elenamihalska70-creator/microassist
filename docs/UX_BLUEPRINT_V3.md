# MICROASSIST UX BLUEPRINT V3

Parcours, ecrans, etats et regles d'experience de Microassist V2.

Ce document traduit la Product Vision 2027 en experience concrete. Il sert de reference avant toute refonte technique, mais ne decrit pas encore l'implementation. Il doit etre utilise avec `MICROASSIST_DESIGN_PRINCIPLES.md` pour verifier chaque ecran, texte, alerte et parcours. Il remplace toute logique UX contradictoire presente dans `PRODUCT_BLUEPRINT_V2.md`.

Contradictions detectees avec les documents existants :

- `PRODUCT_BLUEPRINT_V2.md` utilise encore le terme `Session temporaire`; la reference validee est maintenant `Mode decouverte`.
- `PRODUCT_BLUEPRINT_V2.md` propose encore un onboarding structure comme passage principal; la vision validee fixe `Aujourd'hui` comme premier ecran produit apres activation du compte, avec profil progressif.
- `PRODUCT_BLUEPRINT_V2.md` liste `Rappels` dans la navigation privee principale; ce blueprint recommande une navigation mobile fixee autour de `Aujourd'hui`, `Revenus`, `Factures`, `Echeances`, `Plus`, avec les rappels rattaches aux echeances ou aux parametres selon arbitrage restant.

## 1. Personnalite d'Experience

Microassist est un assistant calme, fiable et competent, qui connait les regles francaises mais les explique simplement, sans juger, sans creer de peur et sans pretendre agir a la place de l'utilisateur.

Axes :

- ton : calme et rassurant ;
- style : simple et direct ;
- relation : accompagnateur, pas controleur ;
- expertise : forte mais non demonstrative ;
- honnetete : absolue sur les incertitudes ;
- rythme : une etape a la fois.

Le produit doit donner le sentiment :

- `Je comprends ce que je dois faire.`
- `Je ne suis pas seul.`
- `Je peux avancer sans tout maitriser immediatement.`
- `Microassist ne me cache pas ses limites.`

## 2. Architecture UX Globale

### Zone publique

La zone publique explique, rassure et oriente. Elle ne contient pas de dashboard, de donnees personnelles ou de fausse demonstration d'espace prive.

Ecrans :

- page d'accueil ;
- connexion ;
- creation de compte ;
- confirmation email ;
- mot de passe oublie ;
- nouveau mot de passe ;
- mentions legales / confidentialite ;
- aide ou FAQ publique si necessaire.

### Espace utilisateur

Navigation desktop recommandee :

- `Aujourd'hui` ;
- `Revenus` ;
- `Factures` ;
- `Echeances` ;
- `Profil`.

`Documents` peut apparaitre sur desktop dans une navigation secondaire ou un groupe plus avance, mais n'est pas un acces principal mobile P0.

Navigation mobile validee, cinq acces maximum :

- `Aujourd'hui` ;
- `Revenus` ;
- `Factures` ;
- `Echeances` ;
- `Plus`.

Dans `Plus` :

- `Documents` ;
- `Profil` ;
- `Aide` ;
- `Parametres` ;
- `Deconnexion`.

Elements avances possibles plus tard :

- analyses ;
- exports ;
- partage conseiller ;
- TVA ;
- assistant conversationnel.

Regles :

- `Aujourd'hui` est toujours la page principale ;
- le dashboard analytique ne remplace jamais `Aujourd'hui` ;
- ne pas afficher tous les elements avances des le debut ;
- la navigation mobile reste compacte et limitee aux cinq acces valides ;
- la navigation desktop peut etre plus visible sans etre plus complexe.
- le profil peut aussi etre accessible par l'avatar dans l'en-tete, sans devenir une action principale concurrente.

## 3. Parcours 1 - Premiere Visite

Decision produit : la page publique doit avoir une seule promesse principale.

Promesse de base :

> Microassist te montre ce que tu dois faire aujourd'hui, ce qui arrive ensuite et combien mettre de cote.

CTA principal possible : `Commencer simplement`

CTA secondaire : `J'ai deja un compte`

### Etape 1 - Arrivee sur la page publique

- Objectif utilisateur : comprendre si Microassist peut l'aider.
- Contenu principal : promesse, benefice immediat, limite claire du produit.
- Action principale : `Commencer simplement`.
- Actions secondaires : `J'ai deja un compte`, aide publique.
- Ne pas afficher : graphiques, faux dashboard, jargon fiscal dense.
- Erreurs possibles : aucune donnee requise ; si le site ne charge pas, afficher une page d'erreur simple.
- Sortie : mode decouverte, inscription ou connexion.

### Etape 2 - Choix du chemin

- Objectif utilisateur : essayer, creer un compte ou revenir a son espace.
- Contenu principal : trois choix hierarchises.
- Action principale : essayer en mode decouverte.
- Actions secondaires : creer un compte, se connecter.
- Ne pas afficher : long formulaire fiscal.
- Erreurs possibles : confusion entre inscription et connexion.
- Sortie : `Aujourd'hui`, inscription ou connexion.

### Etape 3 - Acces rapide a Aujourd'hui

- Objectif utilisateur : voir le produit avant un long questionnaire.
- Contenu principal : premier etat `Aujourd'hui`, souvent profil minimal absent.
- Action principale : depend de l'etat, par exemple `Indiquer mon activite`.
- Actions secondaires : continuer plus tard, expliquer pourquoi.
- Ne pas afficher : analyses, exports, score.
- Erreurs possibles : localStorage indisponible en mode decouverte.
- Sortie : espace utilisateur progressif.

## 4. Mode Decouverte

### Objectif

Permettre de comprendre la valeur du produit avant la creation d'un compte.

### Donnees

- stockees localement sur l'appareil ;
- non garanties sur un autre appareil ;
- non garanties en cas de suppression du navigateur ;
- non considerees comme sauvegardees dans un compte.

### Fonctions autorisees

Perimetre minimum valide :

- acceder a `Aujourd'hui` ;
- renseigner un profil minimal ;
- ajouter, modifier et supprimer des revenus locaux ;
- voir une estimation simple des cotisations ;
- voir une reserve conseillee ;
- afficher une explication courte du calcul.

### Fonctions limitees ou absentes

- facturation complete ;
- stockage de documents ;
- synchronisation multi-appareils ;
- sauvegarde cloud garantie ;
- rappels distants ;
- export complet ;
- partage conseiller ;
- historique long ;
- analyses avancees ;
- fonctions premium.

Ce perimetre montre la valeur principale sans reproduire toute l'application connectee.

### Conversion vers compte

- Emplacement : bouton `Creer mon compte` dans l'en-tete, le profil ou les parametres du mode decouverte.
- Moment opportun : apres une action utile, par exemple premier revenu ajoute, profil minimal renseigne ou tentative d'utiliser une fonction limitee.
- Message : `Cree un compte pour securiser ces donnees et les retrouver plus tard.`
- Migration : lorsqu'un utilisateur cree un compte depuis un mode decouverte contenant des donnees, Microassist doit proposer de transferer les donnees locales vers le compte.
- Perte de donnees : confirmation obligatoire avant suppression ou remplacement.

Avant transfert, expliquer :

- quelles donnees seront transferees ;
- si des donnees existent deja dans le compte ;
- si elles seront fusionnees ou remplacees ;
- que les donnees locales ne seront supprimees qu'apres confirmation du succes du transfert ou choix explicite de l'utilisateur.

En cas d'absence temporaire de migration automatique :

- ne pas promettre que les donnees seront securisees automatiquement ;
- avertir clairement avant l'inscription ;
- ne pas supprimer la copie locale.

Interdictions :

- ne pas afficher `Creer mon compte` comme CTA principal sur tous les ecrans ;
- ne pas faire croire que les donnees sont sauvegardees dans le cloud ;
- ne pas supprimer les donnees locales sans confirmation.

## 5. Creation de Compte et Authentification

Ces parcours ne doivent jamais se confondre : inscription, connexion, confirmation email, mot de passe oublie et nouveau mot de passe sont cinq experiences distinctes.

### Inscription

Objectif : creer un compte sans lancer un onboarding long.

Champs minimum recommandes :

- email ;
- mot de passe ;
- confirmation eventuelle du mot de passe ;
- acceptation des conditions necessaires.

Action principale : `Creer mon compte`

Apres soumission :

- expliquer qu'un email de confirmation a ete envoye ;
- ne pas renvoyer directement vers un ecran incoherent ;
- proposer de renvoyer l'email si possible ;
- proposer de changer l'adresse si elle est incorrecte.

Parcours UX principal :

1. Inscription reussie.
2. Confirmation email.
3. Email confirme.
4. `Aujourd'hui`.

L'acces direct a `Aujourd'hui` apres inscription n'est possible que si la configuration d'authentification ne demande officiellement aucune confirmation email. Ce cas technique ne doit pas remplacer le parcours UX principal.

Erreurs : email deja utilise, mot de passe trop court, reseau, limite d'envoi email.

### Connexion

Champs :

- email ;
- mot de passe.

Actions :

- `Me connecter` ;
- `Mot de passe oublie` ;
- lien vers creation de compte.

Apres connexion reussie :

- aller vers `Aujourd'hui` ;
- ne pas relancer un onboarding deja termine ;
- si une destination privee etait demandee, y revenir seulement si elle reste coherente.

### Confirmation email

Etats :

- email envoye ;
- email confirme ;
- lien expire ;
- lien invalide ;
- nouvel envoi possible ;
- erreur reseau.

Regle : ne jamais afficher l'ecran de nouveau mot de passe dans ce parcours.

### Mot de passe oublie

Etats :

- formulaire initial ;
- email envoye ;
- adresse inconnue sans divulgation excessive ;
- erreur reseau.

Regle : apres envoi, expliquer clairement que l'utilisateur doit consulter sa boite email.

### Nouveau mot de passe

Etats :

- recovery valide ;
- recovery expire ;
- mot de passe modifie ;
- echec ;
- retour connexion.

Regle : afficher cet ecran uniquement si le flow de recuperation est explicitement actif.

## 6. Premier Acces a Aujourd'hui

Decision validee : apres activation du compte, le premier ecran produit est `Aujourd'hui`. Ne jamais imposer un long onboarding avant cet ecran.

### Etat A - Profil minimal absent

- Action principale : `Indiquer mon activite`.
- Message : `Pour commencer, indique ton type d'activite. Cela aidera Microassist a estimer tes cotisations plus correctement.`
- Actions secondaires : continuer plus tard, expliquer pourquoi.
- Donnees necessaires : aucune donnee fiscale prealable.
- Transition : profil progressif, puis retour `Aujourd'hui`.

### Etat B - Date officielle manquante

- Action principale : `Ajouter ma date de debut officielle`.
- Message : `Cette date figure sur ton justificatif de creation. Elle peut etre utile pour l'ACRE et les echeances.`
- Actions secondaires : `Je ne sais pas ou la trouver`, `Je l'ajouterai plus tard`.
- Donnees necessaires : justificatif de creation si disponible.
- Transition : retour `Aujourd'hui` avec fiabilite amelioree.

### Etat C - Profil minimal suffisant, aucun revenu

- Action principale : `Ajouter mon premier revenu`.
- Message : `Ajoute uniquement les sommes reellement encaissees.`
- Actions secondaires : voir profil, comprendre les encaissements.
- Donnees necessaires : activite suffisante pour estimer.
- Transition : confirmation revenu, puis `Aujourd'hui`.

### Etat D - Revenu existant, echeance inconnue

- Action principale : `Indiquer ma periodicite`.
- Message : `Microassist a besoin de savoir si tu declares chaque mois ou chaque trimestre pour afficher une echeance fiable.`
- Actions secondaires : `Je ne sais pas`, aide URSSAF.
- Donnees necessaires : periodicite de declaration.
- Transition : `Echeances` ou `Aujourd'hui`.

### Etat E - Rien a faire

- Action principale : aucune action artificielle.
- Message : `Tu n'as rien a faire aujourd'hui.`
- Action secondaire : `Voir mes revenus`.
- Donnees necessaires : etat suffisamment fiable.
- Transition : revenus, factures ou profil selon choix.

## 7. Profil Progressif

### Groupe 1 - Identite de l'activite

- nom ou nom commercial ;
- SIREN ;
- SIRET ;
- date officielle d'ouverture ;
- type d'activite ;
- categorie d'activite ;
- activite mixte eventuelle.

### Groupe 2 - Declarations

- periodicite mensuelle ou trimestrielle ;
- premiere echeance connue ou estimable ;
- statut de l'espace Urssaf ;
- declaration deja commencee ou non.

### Groupe 3 - ACRE

- eligibilite inconnue ;
- demande a faire ;
- demande envoyee ;
- date d'envoi ;
- en attente ;
- accordee ;
- refusee ;
- delai depasse ;
- statut inconnu.

### Groupe 4 - TVA

- statut inconnu ;
- franchise en base ;
- TVA active ;
- date d'effet ;
- surveillance des seuils.

### Groupe 5 - Facturation

- identite de facturation ;
- adresse ;
- mentions legales ;
- coordonnees bancaires si utilisees ;
- numerotation.

Regles UX :

- ne pas demander tous les groupes au premier acces ;
- demander une donnee au moment ou elle devient utile ;
- afficher `A confirmer` plutot qu'une erreur si la donnee n'est pas encore obligatoire ;
- permettre `Je ne sais pas` lorsque cela est legitime ;
- expliquer l'impact de chaque donnee ;
- permettre la correction ulterieure.

## 8. Ecran Aujourd'hui

### Zone 1 - Situation actuelle

Exemples :

- rien a faire ;
- action a faire ;
- information a completer ;
- echeance proche ;
- alerte reelle ;
- donnee incoherente.

### Zone 2 - Action principale

Une seule action, choisie selon la priorite UX.

Exemples :

- ajouter un revenu ;
- completer une donnee ;
- preparer une declaration ;
- verifier l'ACRE ;
- corriger une incoherence.

### Zone 3 - Prochaine echeance

Afficher seulement si connue ou estimable de maniere fiable.

Etats :

- confirmee ;
- estimee ;
- inconnue ;
- a confirmer.

### Zone 4 - Montant a mettre de cote

Afficher :

- revenu encaisse de la periode ;
- cotisations estimees ;
- reserve conseillee ;
- explication courte ;
- acces au detail du calcul.

Ne jamais afficher comme montant officiel.

### Zone 5 - Prochaines etapes

Liste courte, maximum 2 ou 3 elements secondaires. Ne pas transformer la page en dashboard sature.

## 9. Moteur d'Etats de Aujourd'hui

Matrice de priorite UX :

1. erreur bloquante ou donnee incoherente critique ;
2. echeance urgente connue ;
3. action reglementaire avec delai reel ;
4. information indispensable a un calcul demande ;
5. premier revenu ;
6. action utile non urgente ;
7. rien a faire.

Regles :

- une seule action principale doit etre choisie ;
- une echeance dans 2 jours est prioritaire sur une invitation a completer une adresse de facturation ;
- une incoherence de revenu est prioritaire sur un graphique ;
- une demande ACRE proche du delai est prioritaire sur la creation d'une facture ;
- une donnee non urgente ne doit pas devenir une alerte rouge ;
- plusieurs actions urgentes doivent etre hierarchisees, pas affichees comme cinq CTA principaux.

## 10. Parcours Ajouter un Revenu

### Etape 1 - Saisie

Champs recommandes :

- montant encaisse ;
- date d'encaissement ;
- categorie d'activite ;
- client ou description facultative ;
- reference de facture facultative ;
- moyen de paiement facultatif ;
- note facultative.

Regles :

- montant positif ;
- date reelle d'encaissement ;
- ne pas utiliser automatiquement la date de facture ;
- activite obligatoire seulement si necessaire au calcul ;
- champs avances masques par defaut.

Action principale : `Ajouter le revenu`

### Etape 2 - Confirmation

Afficher :

- montant ajoute ;
- estimation de cotisations ;
- reserve conseillee ;
- argent restant indicatif ;
- niveau de fiabilite ;
- donnee manquante eventuelle.

Actions :

- `Terminer` ;
- `Ajouter un autre revenu` ;
- `Voir le detail`.

### Erreurs

- montant invalide ;
- date future improbable ;
- doublon potentiel ;
- activite non determinee ;
- donnees fiscales insuffisantes ;
- erreur de sauvegarde.

Regle : ne pas perdre la saisie en cas d'erreur.

## 11. Ecran Revenus

Objectifs :

- retrouver les encaissements ;
- comprendre la periode ;
- corriger une erreur ;
- preparer une declaration.

Contenu :

- total de la periode ;
- liste des encaissements ;
- filtres simples ;
- statut de categorisation ;
- lien eventuel avec facture ;
- export plus tard.

Actions principales selon contexte :

- `Ajouter un revenu` ;
- `Preparer ma declaration`.

Actions secondaires :

- modifier ;
- supprimer avec confirmation ;
- filtrer ;
- rechercher ;
- voir detail.

Etats :

- aucun revenu ;
- un revenu ;
- plusieurs revenus ;
- activite mixte ;
- erreur de chargement ;
- mode hors ligne eventuel ;
- donnees locales en mode decouverte.

## 12. Parcours Preparer Ma Declaration

Microassist prepare, mais ne transmet pas.

### Etape 1 - Identifier la periode

Afficher :

- periode concernee ;
- periodicite ;
- date limite si connue ;
- statut de fiabilite.

### Etape 2 - Verifier les revenus

Afficher separement :

- ventes commerciales ;
- prestations BIC ;
- prestations BNC ;
- autres categories pertinentes ;
- total encaisse ;
- revenus exclus ou a confirmer.

### Etape 3 - Estimation

Afficher :

- chiffre d'affaires a declarer par categorie ;
- cotisations estimees ;
- impact ACRE si confirme ;
- reserve disponible ;
- avertissement sur l'estimation.

### Etape 4 - Aller vers le site officiel

Action principale : `Ouvrir le site officiel`

Message :

> Microassist a prepare les montants a verifier. La declaration doit etre envoyee sur le site officiel.

### Etape 5 - Confirmation utilisateur

Apres ouverture du site officiel, enregistrer la preparation avec le statut `A confirmer`.

Lors d'un retour ulterieur dans Microassist, demander :

> As-tu termine ta declaration sur le site officiel ?

Reponses possibles :

- `Oui, elle est envoyee` ;
- `Pas encore` ;
- `J'ai rencontre un probleme`.

Permettre aussi d'indiquer separement :

- montant reellement paye ;
- date de paiement.

Regles :

- Microassist ne detecte pas automatiquement le retour du site Urssaf ;
- le statut `declaration faite` repose sur la confirmation de l'utilisateur ;
- ce statut n'est pas une preuve officielle ;
- le montant paye et la date de paiement peuvent etre ajoutes separement ;
- ne jamais marquer automatiquement la declaration comme envoyee ;
- inclure le cas de declaration a zero ;
- conserver les montants prepares comme aide, pas comme preuve officielle.

## 13. Parcours ACRE

### Etat inconnu

- Action : `Verifier ma situation ACRE`.
- Message : l'ACRE peut changer l'estimation, mais le statut doit etre confirme.

### Potentiellement eligible

- Message prudent : `Tu peux peut-etre beneficier de l'ACRE. Ton eligibilite doit etre verifiee.`
- Action : consulter les criteres ou noter le statut.

### Demande a faire

Afficher :

- date officielle d'ouverture ;
- delai de 60 jours ;
- jours restants si calculables ;
- pieces a preparer ;
- lien vers la source officielle.

### Demande envoyee

Permettre :

- date d'envoi ;
- statut en attente ;
- document ou note facultative ;
- rappel a 30 jours.

### En attente

Afficher :

- date d'envoi ;
- delai Urssaf ;
- statut a confirmer ;
- action `Mettre a jour mon statut`.

### Accordee

Afficher :

- date de debut ;
- periode d'application estimee ;
- regle applicable selon la date officielle ;
- taux utilise dans les estimations ;
- source et date de verification.

### Refusee

Afficher :

- statut ;
- absence d'application de la reduction ;
- possibilite de corriger si erreur de saisie ;
- lien vers information officielle.

### Delai depasse

Message non accusateur :

> Le delai semble depasse selon la date indiquee. Verifie ta situation aupres de l'Urssaf.

Regle : ne pas rendre une decision administrative.

## 14. Parcours Factures

Principe : separer clairement facture et encaissement.

Decision de priorite :

- En P0, la distinction conceptuelle et fiscale entre facture et encaissement est obligatoire.
- Un revenu correspond a une somme reellement encaissee.
- La reference de facture peut etre facultative lors de l'ajout d'un revenu.
- Le module complet de facturation peut rester en P1.

Le module complet comprend notamment :

- creation ;
- numerotation ;
- PDF ;
- statuts ;
- paiement partiel ;
- liaison avec un encaissement.

Ecrans :

- liste des factures ;
- creer une facture ;
- detail ;
- modifier brouillon ;
- marquer comme envoyee ;
- marquer comme payee ;
- lier a un encaissement ;
- creer un encaissement depuis une facture payee.

Statuts possibles :

- brouillon ;
- finalisee ;
- envoyee ;
- payee ;
- partiellement payee ;
- en retard ;
- annulee ;
- avoir eventuel plus tard.

Regles :

- une facture creee ne devient pas automatiquement un revenu ;
- une facture marquee payee peut proposer de creer l'encaissement ;
- demander la date reelle de paiement ;
- ne pas pretendre transmettre a une PDP ;
- Factur-X peut etre decrit comme generation ou brouillon seulement si la fonction existe reellement ;
- eviter les fonctions non disponibles dans l'UX initiale.

## 15. Ecran Echeances

Objectif : permettre de voir ce qui arrive sans surcharger `Aujourd'hui`.

Types possibles :

- declaration Urssaf ;
- paiement estime ;
- demande ACRE ;
- suivi ACRE ;
- TVA ;
- CFE ;
- renouvellement ou verification de donnees ;
- echeances personnalisees plus tard.

Chaque echeance doit avoir :

- nom simple ;
- date ;
- niveau de fiabilite ;
- statut ;
- action possible ;
- source ou explication ;
- priorite.

Etats :

- aucune echeance connue ;
- echeance estimee ;
- echeance confirmee ;
- echeance passee ;
- action indiquee comme faite par l'utilisateur ;
- donnee insuffisante.

Regle : ne pas inventer une date inconnue.

## 16. Ecran Documents

Objectif : centraliser les documents utiles sans devenir un gestionnaire documentaire complexe.

Positionnement :

- `Documents` est une fonction P1 ;
- sur mobile, `Documents` se trouve dans `Plus` ;
- sur desktop, `Documents` peut apparaitre dans une navigation secondaire ;
- l'upload utilisateur depend de la validation technique d'un stockage securise ;
- le mode decouverte ne doit pas promettre le stockage securise de documents.

Categories :

1. Documents generes par Microassist : factures, exports, brouillons ou documents produits par les fonctions existantes.
2. Documents administratifs ajoutes par l'utilisateur : justificatif de creation, attestation d'immatriculation, document ACRE, attestations Urssaf, autres documents personnels plus tard.

Ces deux categories peuvent avoir des capacites et des regles de stockage differentes.

Pour chaque document :

- type ;
- nom ;
- date ;
- statut ;
- source ;
- possibilite d'ajouter une note ;
- possibilite de supprimer avec confirmation.

Precision : l'upload et le stockage securise doivent etre valides techniquement avant implementation. Le UX Blueprint decrit le besoin, pas une fonction actuelle garantie.

## 17. Ecran Profil

Sections :

- mon activite ;
- declarations ;
- ACRE ;
- TVA ;
- facturation ;
- compte ;
- confidentialite ;
- mode d'affichage ;
- deconnexion ;
- suppression du compte plus tard.

Regles :

- montrer l'etat de chaque section ;
- distinguer complet, suffisant, a confirmer et non necessaire ;
- ne pas afficher un score de profil culpabilisant ;
- expliquer l'impact d'une modification ;
- confirmer les changements pouvant modifier des estimations ;
- ne pas effacer l'historique reglementaire sans avertissement.

### Previsualisation avant modification sensible

Avant validation d'une modification pouvant changer les estimations, afficher un etat de previsualisation.

Donnees concernees notamment :

- categorie d'activite ;
- date officielle d'ouverture ;
- statut ACRE ;
- date ACRE ;
- periodicite ;
- statut TVA.

Afficher :

- les periodes potentiellement touchees ;
- si seuls les futurs calculs changent ;
- si des periodes historiques seraient recalculees ;
- les declarations deja confirmees par l'utilisateur.

Regle obligatoire : les declarations historiques indiquees comme effectuees ne doivent jamais etre silencieusement reecrites apres modification du profil.

## 18. Etats Transversaux

### Chargement

- skeleton ou indicateur calme ;
- eviter ecran vide prolonge.

### Vide

- expliquer pourquoi il n'y a rien ;
- proposer une action utile ;
- ne pas presenter cela comme une erreur.

### Erreur reseau

- conserver les donnees saisies ;
- proposer de reessayer ;
- expliquer si la sauvegarde n'a pas eu lieu.

### Donnees insuffisantes

- indiquer ce qui manque ;
- expliquer pourquoi ;
- proposer de completer ou continuer plus tard.

### Donnees incoherentes

- expliquer clairement ;
- ne pas afficher un calcul trompeur ;
- permettre de corriger.

### Succes

- confirmer l'action ;
- ne pas bloquer avec une modale inutile ;
- proposer l'etape suivante seulement si elle est reellement utile.

### Hors ligne

Etat futur eventuel, sans promettre une prise en charge si elle n'existe pas encore.

## 19. Navigation et Retour

Regles :

- logo ou element principal renvoie vers `Aujourd'hui` ;
- retour explicite dans les sous-parcours ;
- ne pas utiliser uniquement le bouton navigateur ;
- preserver les donnees saisies ;
- apres succes, revenir vers une destination logique ;
- ne pas renvoyer vers la page publique apres une action privee ;
- apres connexion, revenir vers `Aujourd'hui` ou vers la destination precedemment demandee ;
- apres deconnexion, revenir vers la page publique ou connexion.

Mobile :

- navigation principale fixee a cinq acces maximum : `Aujourd'hui`, `Revenus`, `Factures`, `Echeances`, `Plus` ;
- dans `Plus` : `Documents`, `Profil`, `Aide`, `Parametres`, `Deconnexion` ;
- le profil peut aussi etre accessible par l'avatar dans l'en-tete ;
- ne pas masquer l'action principale.

## 20. Visibilite Progressive

| Niveau | Visible | Regle |
| --- | --- | --- |
| Niveau 1 - Decouverte | Aujourd'hui, profil minimal, revenus, estimation simple, creation de compte | Montrer la valeur sans promettre la sauvegarde cloud |
| Niveau 2 - Premiers revenus | Historique, reserve conseillee, preparation declaration, factures simples, echeances | Relier les encaissements aux actions utiles |
| Niveau 3 - Activite reguliere | Tendances, filtres avances, alertes TVA, exports, documents P1 | Afficher seulement si les donnees existent |
| Niveau 4 - Activite developpee | Projections, analyses avancees, partage conseiller, outils premium, fonctions collaboratives | Laisser l'utilisateur garder une experience simple |

Ces niveaux ne sont pas obligatoirement visibles comme gamification. Ils servent surtout a gerer l'affichage progressif. Le niveau d'affichage ne modifie jamais les calculs de base.

## 21. Mode Debutant et Outils Avances

Criteres possibles d'apparition :

- nombre de revenus ;
- nombre de mois d'historique ;
- proximite d'un seuil ;
- utilisation de fonctions avancees ;
- choix explicite.

Eviter :

- activation automatique brutale ;
- dashboard soudainement complexe ;
- perte de reperes ;
- changement de vocabulaire.

Permettre :

- `Afficher plus de details` ;
- `Masquer les analyses avancees` ;
- explication de chaque nouvel outil.

## 22. Role Futur de l'Assistant Conversationnel

L'assistant conversationnel peut :

- expliquer un terme ;
- aider a retrouver une action ;
- expliquer un calcul ;
- guider vers un ecran ;
- repondre a partir des donnees connues ;
- signaler les limites de ses informations ;
- renvoyer vers une source officielle.

Il ne doit pas :

- remplacer les actions structurees ;
- inventer un statut ;
- modifier des donnees sans confirmation ;
- rendre une decision administrative ;
- produire une reponse contradictoire avec les regles fiscales du produit.

Position UX recommandee :

- bouton discret accessible depuis `Aujourd'hui` ;
- possibilite de l'ouvrir depuis un contexte precis ;
- ne pas en faire l'unique moyen de naviguer.

## 23. Matrice des Ecrans

| Ecran | Utilisateur concerne | Objectif | Action principale | Actions secondaires | Donnees necessaires | Etats principaux | Destination suivante |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Accueil public | Visiteur | Comprendre la promesse | Commencer simplement | J'ai deja un compte, aide | Aucune | charge, erreur, public | Aujourd'hui decouverte, inscription, connexion |
| Inscription | Visiteur | Creer un compte | Creer mon compte | Connexion | Email, mot de passe, conditions | initial, erreur, email envoye | Confirmation email |
| Connexion | Compte existant | Entrer dans l'espace | Me connecter | Mot de passe oublie, inscription | Email, mot de passe | initial, erreur, succes | Aujourd'hui |
| Confirmation email | Inscrit non confirme | Confirmer l'adresse | Renvoyer l'email | Retour connexion | Email | envoye, confirme, expire, invalide | Connexion ou Aujourd'hui |
| Mot de passe oublie | Compte existant | Demander recovery | Recevoir le lien | Retour connexion | Email | initial, envoye, erreur | Nouveau mot de passe via lien |
| Nouveau mot de passe | Recovery actif | Changer le mot de passe | Mettre a jour | Retour connexion si hors flow | Session recovery, mot de passe | valide, expire, succes, echec | Aujourd'hui ou connexion |
| Aujourd'hui | Invite ou connecte | Savoir quoi faire | Selon priorite UX | Revenus, profil, echeances | Profil, revenus, echeances | absent, action, rien, alerte, incoherence | Parcours lie |
| Ajouter un revenu | Invite ou connecte | Enregistrer encaissement | Ajouter le revenu | Annuler, champs avances | Montant, date | saisie, erreur, succes | Confirmation revenu |
| Revenus | Profil disponible | Suivre encaissements | Ajouter un revenu ou preparer declaration | Modifier, supprimer, filtrer | Revenus | vide, liste, mixte, erreur | Detail, declaration |
| Preparer declaration | Utilisateur avec periode | Aider a declarer | Ouvrir le site officiel | Verifier revenus | Revenus, periodicite | periode, estimation, a confirmer | Site officiel puis confirmation utilisateur |
| ACRE | Profil concerne | Suivre statut ACRE | Verifier ou mettre a jour | Source officielle | Date officielle, statut | inconnu, a faire, attente, accordee, refusee | Aujourd'hui ou profil |
| Factures | Utilisateur facturant | Suivre factures | Creer une facture | Marquer payee, lier revenu | Identite facturation selon besoin | vide, brouillon, envoyee, payee | Detail facture |
| Creer facture | Utilisateur facturant | Preparer facture | Creer facture | Annuler, completer profil | Client, lignes, dates | saisie, SIRET manquant, erreur, succes | Liste factures |
| Echeances | Tout espace | Voir ce qui arrive | Action selon echeance | Rappels, sources | Profil, dates | aucune, estimee, confirmee, passee | Declaration, ACRE, profil |
| Documents | Connecte P1 ou futur | Centraliser documents | Ajouter document si disponible | Supprimer, noter | Fonction stockage validee | besoin, vide, liste, erreur | Detail document |
| Profil | Invite ou connecte | Completer/corriger | Modifier section utile | Deconnexion, confidentialite | Donnees profil | suffisant, a confirmer, erreur | Aujourd'hui |

## 24. Matrice des Parcours Critiques

| Parcours | Point de depart | Etapes | Sortie reussie | Erreurs possibles | Donnees a preserver | Regle UX critique |
| --- | --- | --- | --- | --- | --- | --- |
| Premiere visite | Accueil public | Promesse, choix, acces rapide | Aujourd'hui ou auth | confusion CTA, chargement | aucune | une promesse, une action dominante |
| Decouverte sans compte | Accueil ou Aujourd'hui | Entrer, profil minimal, revenu | Valeur comprise localement | localStorage indisponible | donnees locales | ne pas promettre le cloud |
| Creation de compte | Mode decouverte ou public | Inscription, confirmation email, activation, transfert local propose | Aujourd'hui apres email confirme | email deja utilise, non confirme, migration impossible | donnees locales | proposer le transfert et ne pas perdre les donnees sans confirmation |
| Retour utilisateur | Connexion ou session | Auth, chargement profil | Aujourd'hui normal | profil absent, reseau | profil, revenus, factures | ne pas relancer onboarding termine |
| Premier revenu | Aujourd'hui | Saisie, confirmation | Reserve estimee visible | montant invalide, doublon | saisie | ne pas perdre la saisie |
| Premiere declaration | Aujourd'hui ou Echeances | Periode, revenus, estimation, site officiel, statut a confirmer | Confirmation utilisateur recue ou preparation gardee a confirmer | periodicite inconnue, probleme Urssaf | revenus, statut declaration, montants prepares | preparer n'est pas transmettre |
| Demande ACRE | Aujourd'hui, Profil | Statut, date officielle, demande | Statut mis a jour | date inconnue, delai depasse | statut ACRE, dates | ne pas supposer accord |
| Facture payee | Factures | Marquer payee, date paiement, proposer revenu | Encaissement cree ou lie | date manquante | facture, paiement | facture != revenu |
| Modification fiscale | Profil | Modifier, previsualiser impact, confirmer | Estimations futures mises a jour sans reecrire silencieusement l'historique | changement retroactif | historique reglementaire, declarations confirmees | proteger les periodes historiques |
| Erreur auth | Auth | Message, correction, retry | Retour auth | mauvais mdp, lien expire | email saisi | auth jamais impasse |
| Perte donnees locales | Mode decouverte | Avertir, confirmer, compte | Donnees preservees ou suppression voulue | migration impossible | localStorage | confirmation explicite |
| Deconnexion | Profil/compte | Confirmer si risque local, signer out | Public ou connexion | reseau | donnees compte, locales | ne pas perdre silencieusement |

## 25. Priorites UX Pour la Premiere Version

### P0 - Indispensable

- authentification claire ;
- mode decouverte ;
- `Aujourd'hui` ;
- profil progressif ;
- ajout de revenus ;
- estimation transparente ;
- distinction facture / encaissement ;
- preparation de declaration ;
- echeances fiables ;
- erreurs et etats vides ;
- mobile.

### P1 - Important

- module complet de facturation ;
- parcours ACRE complet ;
- documents essentiels ;
- historique ;
- rappels ;
- details des calculs.

### P2 - Apres validation du socle

- analyses avancees ;
- exports complexes ;
- assistant conversationnel riche ;
- partage conseiller ;
- projections ;
- espace expert ;
- premium avance.

Cette priorite UX ne vaut pas encore plan technique definitif.

## 26. Decisions a Valider Avant le Blueprint Technique

Decisions encore ouvertes :

- politique exacte de fusion lors de la migration locale ;
- strategie des rappels ;
- canaux et frequence des rappels ;
- niveau de details affiche dans les estimations ;
- fonctions gratuites et premium ;
- stockage technique des documents ;
- criteres chiffres d'apparition des analyses avancees.

Decisions deja validees a ne pas remettre en question ici :

- `Aujourd'hui` comme ecran principal ;
- onboarding progressif ;
- une action principale ;
- distinction facture / encaissement ;
- transparence sur les estimations ;
- conservation historique des regles ACRE ;
- navigation mobile : `Aujourd'hui`, `Revenus`, `Factures`, `Echeances`, `Plus` ;
- facturation complete en P1 ;
- `Documents` en P1 et dans `Plus` sur mobile ;
- confirmation de declaration uniquement par l'utilisateur ;
- migration des donnees locales proposee lors de la creation de compte ;
- activite mixte geree au niveau de chaque encaissement ;
- modification retroactive protegee par previsualisation et historique ;
- assistant conversationnel en P2 ;
- fonctions avancees par divulgation progressive.

## 27. Criteres de Validation du UX Blueprint

Le document peut etre considere comme valide si :

- chaque ecran a un objectif clair ;
- chaque ecran a une action principale identifiable ;
- les transitions sont decrites ;
- les etats vide, erreur, chargement et succes sont couverts ;
- le mode decouverte est honnete ;
- l'authentification n'est pas une impasse ;
- `Aujourd'hui` reste central ;
- les calculs sont presentes comme estimations ;
- les actions officielles ne sont pas simulees ;
- facture et encaissement sont separes ;
- l'ACRE depend de donnees confirmees ;
- les fonctions avancees apparaissent progressivement ;
- le parcours mobile est viable ;
- les principes d'accessibilite sont integres ;
- les decisions ouvertes sont clairement separees des decisions validees.

## 28. Hierarchie Documentaire

1. `MICROASSIST_PRODUCT_VISION_2027.md` definit la direction produit.
2. `MICROASSIST_DESIGN_PRINCIPLES.md` definit les regles d'experience.
3. `UX_BLUEPRINT_V3.md` definit les parcours, ecrans, etats et transitions.
4. `PRODUCT_BLUEPRINT_V2.md` devra etre revise apres validation du UX Blueprint V3.
5. `ARCHITECTURE_AUDIT.md` reste la photographie technique de l'existant.
