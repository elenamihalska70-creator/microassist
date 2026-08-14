# MICROASSIST DESIGN PRINCIPLES

Les regles qui protegent la simplicite, la confiance et la clarte du produit.

Microassist accompagne des personnes qui peuvent etre stressees, debutantes ou peu familieres avec l'administration francaise. Un ecran techniquement correct peut rester mauvais s'il est confus, anxiogene ou trompeur. Ces principes priment sur les preferences visuelles, les tendances SaaS, la quantite de fonctionnalites et les objectifs de conversion. Tout nouvel ecran devra etre verifie a partir de cette liste.

## 1. Une Action Principale Par Ecran

Principe : chaque ecran ou etat principal doit permettre de comprendre immediatement quelle est l'action la plus utile.

Regles :

- afficher une seule action principale clairement dominante ;
- garder les actions secondaires visibles sans concurrencer l'action principale ;
- ne pas afficher plusieurs boutons identiques ou equivalents ;
- ne pas demander de choisir entre cinq actions administratives sans hierarchie ;
- lorsqu'aucune action n'est necessaire, le dire clairement plutot que d'inventer une action.

Bon exemple : `Ajoute ton premier revenu.`

Mauvais exemple : `Configurer mon profil / Verifier l'ACRE / Ajouter un revenu / Decouvrir la TVA / Creer une facture` avec cinq boutons de meme importance.

Question de controle : en cinq secondes, l'utilisateur comprend-il quoi faire maintenant ?

## 2. Aujourd'hui Avant le Tableau de Bord

Principe : l'utilisateur n'ouvre pas Microassist pour regarder des graphiques. Il l'ouvre pour savoir s'il doit faire quelque chose.

Regles :

- commencer par la situation presente ;
- afficher la prochaine echeance utile ;
- afficher le montant conseille a reserver quand il peut etre estime ;
- masquer les graphiques et analyses tant qu'ils n'aident pas une decision ;
- ne jamais remplir un ecran avec des statistiques uniquement pour donner une impression de produit complet.

Question de controle : cet element aide-t-il l'utilisateur a agir aujourd'hui ou a anticiper une action reelle ?

## 3. Expliquer Avant de Nommer

Principe : presenter d'abord le sens concret, puis le terme administratif.

Exemple recommande :

> Tu ne factures pas encore la TVA. Ce regime s'appelle la franchise en base de TVA.

Eviter :

> Franchise en base de TVA activee.

Regles :

- expliquer les consequences pratiques ;
- definir les acronymes lors de leur premiere apparition ;
- eviter le jargon lorsqu'un mot courant suffit ;
- permettre d'acceder a une explication complementaire sans encombrer l'ecran principal ;
- preferer des phrases courtes.

Question de controle : une personne qui vient de creer sa micro-entreprise comprend-elle cette phrase sans chercher le terme sur Internet ?

## 4. Ne Jamais Presenter l'Inconnu Comme Certain

Principe : Microassist doit etre explicitement honnete sur la qualite de ses donnees.

Etats utiles :

- confirme ;
- estime ;
- a confirmer ;
- information manquante ;
- impossible a determiner actuellement.

Regles :

- ne jamais inventer une echeance ;
- ne jamais supposer que l'ACRE est accordee ;
- ne jamais supposer que l'utilisateur facture ou ne facture pas la TVA ;
- ne jamais presenter une estimation comme un montant officiel ;
- ne jamais montrer un calcul precis lorsque les donnees necessaires sont absentes ;
- expliquer quelle information permettrait d'ameliorer la fiabilite.

Question de controle : l'utilisateur peut-il distinguer ce qui est confirme de ce qui est estime ?

## 5. Montrer l'Origine des Chiffres

Principe : une valeur importante doit pouvoir etre comprise et verifiee.

Regles :

- expliquer brievement comment le montant est calcule ;
- indiquer les donnees utilisees ;
- signaler les donnees manquantes ;
- distinguer chiffre d'affaires, cotisations estimees, reserve conseillee et argent potentiellement disponible ;
- afficher le taux reglementaire applicable lorsque cela aide reellement ;
- conserver la date ou la periode reglementaire utilisee ;
- permettre d'acceder a la source officielle pertinente ;
- eviter les faux niveaux de precision.

Exemple : `Sur 1 000 EUR encaisses, Microassist estime 212 EUR de cotisations selon ton type d'activite et ton statut actuel.`

Question de controle : l'utilisateur comprend-il d'ou vient ce montant et a quel point il peut lui faire confiance ?

## 6. Toute Alerte Doit Proposer une Action

Principe : une alerte sans solution augmente le stress sans aider.

Regles :

- expliquer ce qui se passe ;
- expliquer pourquoi cela compte ;
- proposer la prochaine action ;
- indiquer l'echeance lorsqu'elle est connue ;
- utiliser une alerte forte uniquement pour un risque reel ;
- ne pas utiliser le rouge pour une simple information ou une donnee manquante non urgente ;
- permettre de fermer ou reporter une alerte non critique lorsque cela est approprie.

Structure recommandee :

1. Ce qui se passe.
2. Pourquoi c'est important.
3. Ce que l'utilisateur peut faire maintenant.

Question de controle : apres avoir lu l'alerte, l'utilisateur sait-il exactement quoi faire ?

## 7. Ne Pas Creer d'Anxiete Artificielle

Principe : Microassist doit reduire le stress administratif, pas creer un sentiment d'urgence permanent.

Regles :

- ne pas utiliser de compte a rebours anxiogene pour une echeance lointaine ;
- ne pas afficher un score fiscal abstrait ou culpabilisant ;
- ne pas qualifier un profil d'`incomplet` lorsque les informations manquantes ne sont pas encore utiles ;
- distinguer information, recommandation, vigilance et urgence ;
- rassurer explicitement lorsqu'aucune action n'est necessaire ;
- ne pas utiliser de formulation culpabilisante.

Preferer : `Cette information pourra etre ajoutee plus tard.`

Eviter : `Ton profil n'est complete qu'a 40 %.`

Question de controle : cet ecran aide-t-il reellement ou cherche-t-il seulement a provoquer un clic ?

## 8. Demander une Information au Bon Moment

Principe : le profil se complete progressivement.

Regles :

- ne pas imposer un long questionnaire avant l'acces a l'espace ;
- demander une information lorsqu'elle devient necessaire a une action ou a un calcul ;
- expliquer pourquoi cette information est demandee ;
- permettre de repondre `Je ne sais pas` lorsque c'est legitime ;
- permettre de revenir modifier la reponse ;
- ne pas bloquer une fonctionnalite si l'information n'est pas reellement indispensable ;
- distinguer une donnee obligatoire legalement d'une donnee utile seulement pour ameliorer l'experience.

Question de controle : avons-nous reellement besoin de cette information maintenant ?

## 9. Ne Pas Faire Memoriser Ce Que le Produit Peut Memoriser

Principe : Microassist doit reduire la charge mentale.

Regles :

- conserver les informations deja renseignees ;
- eviter de redemander la meme date ou le meme statut ;
- preremplir les donnees connues ;
- afficher l'historique utile ;
- conserver la distinction entre donnees confirmees et anciennes donnees ;
- rappeler les decisions precedentes lorsque l'utilisateur les modifie ;
- prevenir avant toute perte de donnees.

Question de controle : demandons-nous a l'utilisateur de se souvenir d'une information que Microassist possede deja ?

## 10. Preparer N'Est Pas Transmettre

Principe : les mots employes doivent refleter exactement la capacite reelle du produit.

Microassist peut :

- preparer ;
- estimer ;
- regrouper ;
- generer un brouillon ;
- rappeler ;
- orienter vers un site officiel.

Microassist ne doit pas pretendre :

- avoir declare a l'Urssaf ;
- avoir paye ;
- avoir valide l'ACRE ;
- avoir transmis une facture a une PDP ;
- avoir realise une formalite officielle ;

sauf si une future fonctionnalite reelle, autorisee et testee le fait effectivement.

Preferer : `Preparer ma declaration.`

Eviter : `Faire ma declaration.`

Question de controle : le libelle peut-il laisser croire que Microassist a effectue une action officielle ?

## 11. Distinguer Facture et Encaissement

Principe : une facture creee n'est pas necessairement un revenu encaisse.

Regles :

- separer clairement facturation et revenus ;
- ne pas ajouter automatiquement une facture au chiffre d'affaires encaisse ;
- permettre d'indiquer la date reelle de paiement ;
- expliquer pourquoi le calcul micro-social repose sur les encaissements ;
- eviter le mot `revenu` pour designer une facture non payee ;
- signaler les incoherences sans bloquer inutilement.

Question de controle : l'utilisateur peut-il croire qu'une facture creee a deja ete comptee comme encaissee ?

## 12. Mobile d'Abord, Mais Pas Mobile Seulement

Principe : le parcours essentiel doit etre pleinement utilisable sur telephone.

Regles :

- boutons suffisamment grands ;
- phrases courtes ;
- formulaires divises en etapes simples ;
- ne pas cacher une action essentielle derriere un survol ;
- eviter les tableaux larges pour les actions quotidiennes ;
- maintenir une navigation claire sur desktop ;
- reserver les visualisations complexes aux ecrans ou elles sont reellement utiles.

Question de controle : cette action peut-elle etre realisee confortablement d'une seule main sur un telephone ?

## 13. Une Interface Calme et Hierarchisee

Principe : l'interface doit inspirer confiance avant d'impressionner.

Regles :

- utiliser une hierarchie visuelle claire ;
- limiter le nombre de couleurs semantiques ;
- reserver le rouge aux erreurs et risques reels ;
- maintenir suffisamment d'espace ;
- eviter les effets decoratifs qui concurrencent l'information ;
- limiter les cartes imbriquees et les blocs identiques ;
- privilegier la lisibilite a la densite ;
- ne pas afficher simultanement toutes les capacites du produit.

Question de controle : l'oeil sait-il immediatement ou regarder ?

## 14. Proteger les Donnees et les Actions Importantes

Principe : une erreur de clic ne doit pas avoir de consequence irreversible silencieuse.

Regles :

- confirmation explicite avant suppression ;
- indiquer clairement ce qui sera supprime ;
- permettre l'annulation lorsqu'elle est techniquement raisonnable ;
- avertir avant la reinitialisation du mode decouverte ;
- prevenir avant une deconnexion pouvant entrainer une perte de donnees locales ;
- ne pas remplacer silencieusement des informations confirmees ;
- conserver une trace des changements reglementaires importants.

Question de controle : une personne stressee peut-elle declencher par erreur une action irreversible ?

## 15. L'Authentification Ne Doit Jamais Etre une Impasse

Principe : a tout moment, l'utilisateur doit comprendre ou il se trouve et comment continuer.

Regles :

- garder un acces visible a la connexion ;
- distinguer clairement inscription, connexion, confirmation email et recuperation de mot de passe ;
- ne pas renvoyer automatiquement vers un onboarding deja termine ;
- afficher une explication claire apres l'envoi d'un email ;
- proposer un nouvel envoi lorsque cela est possible ;
- proteger le flow de recuperation de mot de passe ;
- revenir vers `Aujourd'hui` apres authentification reussie, sauf exception technique documentee.

Question de controle : apres cet ecran, l'utilisateur sait-il comment entrer ou revenir dans son espace ?

## 16. La Progression Doit Etre Naturelle

Principe : Microassist revele ses capacites selon les besoins et les donnees disponibles.

Regles :

- experience simple par defaut ;
- pas de bascule brutale vers un mode complexe ;
- presenter les fonctions avancees lorsqu'elles deviennent pertinentes ;
- laisser l'utilisateur conserver une interface simple ;
- ne pas conditionner les calculs de base au mode d'affichage ;
- ne pas afficher des projections sans historique suffisant ;
- expliquer l'utilite d'un nouvel outil avant de l'activer.

Question de controle : cette fonctionnalite apparait-elle parce qu'elle est utile maintenant ou simplement parce qu'elle existe ?

## 17. Accessibilite Par Defaut

Principe : l'accessibilite n'est pas une fonction avancee.

Regles :

- contraste suffisant ;
- navigation clavier ;
- focus visible ;
- labels explicites ;
- messages d'erreur associes aux champs concernes ;
- ne pas transmettre une information uniquement par la couleur ;
- textes redimensionnables ;
- structure semantique claire ;
- boutons et liens nommes selon leur action reelle ;
- langage comprehensible.

Question de controle : une personne ayant une limitation visuelle, motrice, cognitive ou linguistique peut-elle comprendre et realiser cette action ?

## 18. Sources, Dates et Historique Reglementaire

Principe : une regle administrative doit etre tracable dans le temps.

Regles :

- conserver la source officielle ;
- conserver la date de verification ;
- associer les regles a leur periode d'application ;
- ne pas remplacer une regle historique pour tous les utilisateurs ;
- tester les dates frontieres ;
- verifier les sources avant implementation et avant mise en production ;
- afficher une date de mise a jour lorsqu'elle est pertinente pour l'utilisateur ;
- distinguer regle reglementaire et choix produit.

Question de controle : pouvons-nous expliquer quelle regle a ete appliquee, a quelle date et a partir de quelle source ?

## 19. La Confiance Avant la Conversion

Principe : Microassist ne doit pas degrader l'experience de base pour pousser artificiellement vers un compte ou une offre premium.

Regles :

- ne pas repeter `Creer mon compte` comme CTA principal sur tous les ecrans ;
- ne pas masquer une explication essentielle derriere un abonnement ;
- ne pas utiliser de peur administrative pour vendre ;
- indiquer clairement les limites du mode decouverte ;
- permettre de comprendre la valeur avant de demander un engagement ;
- presenter les fonctions premium comme des outils supplementaires, pas comme la condition pour comprendre ses obligations de base.

Question de controle : cette decision protege-t-elle l'utilisateur ou seulement notre taux de conversion ?

## 20. Checklist de Validation d'un Ecran

- L'objectif de l'ecran est-il clair ?
- Une seule action est-elle reellement principale ?
- Le texte est-il comprehensible sans connaissance administrative ?
- Les donnees confirmees et estimees sont-elles distinguees ?
- L'origine des chiffres importants est-elle explicable ?
- Toute alerte propose-t-elle une action ?
- L'ecran cree-t-il une urgence artificielle ?
- Demandons-nous uniquement les informations necessaires maintenant ?
- Une action officielle pourrait-elle etre suggeree a tort ?
- Facture et encaissement sont-ils clairement separes ?
- Le parcours fonctionne-t-il sur mobile ?
- Le contraste, le focus et les labels sont-ils accessibles ?
- L'utilisateur peut-il revenir, corriger ou annuler ?
- Les regles reglementaires sont-elles sourcees et datees ?
- L'ecran respecte-t-il la Product Vision 2027 ?

Regle finale : si une reponse importante est `non`, l'ecran ne doit pas etre considere comme valide.

## 21. Hierarchie Documentaire

1. `MICROASSIST_PRODUCT_VISION_2027.md` definit pourquoi et pour qui le produit existe.
2. `MICROASSIST_DESIGN_PRINCIPLES.md` definit les regles que l'experience ne doit jamais violer.
3. Le futur `UX_BLUEPRINT_V3.md` definira les parcours, ecrans et etats.
4. `PRODUCT_BLUEPRINT_V2.md` devra ensuite etre revise.
5. `ARCHITECTURE_AUDIT.md` reste la photographie technique de l'existant.
