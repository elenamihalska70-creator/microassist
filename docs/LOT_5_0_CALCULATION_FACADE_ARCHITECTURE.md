# LOT 5.0 - Calculation Facade Architecture

Date : 2026-07-30\
Statut : architecture uniquement\
Objet : specification du futur Calculation Facade\
Implementation : aucune

## 1. Executive Summary

Le Calculation Layer contient maintenant trois domaines isoles :

- Revenue ;
- Contributions ;
- ACRE.

Chaque domaine a son contrat, ses tests et ses limites. Le Facade doit devenir le point d'orchestration futur entre ces domaines et l'application, sans absorber leur logique metier.

Decision principale : GO pour LOT 5.1, limite a un Facade minimal pur qui orchestre les domaines existants sans integration `App.jsx`.

Le Facade ne doit pas etre un nouveau moteur fiscal. Il doit composer les resultats, normaliser la sortie de synthese, fusionner warnings et traces, et fournir un contrat stable pour une integration progressive.

## 2. Motivation

Aujourd'hui, les calculs historiques sont encore largement consommes via `App.jsx` et `src/utils/obligations.js`. Les lots 4 ont extrait des blocs purs, mais l'application n'a pas encore un point d'entree unique pour les utiliser.

Un Facade est necessaire pour :

- eviter que `App.jsx` connaisse l'ordre des modules Revenue, Contributions et ACRE ;
- eviter les compositions ad hoc dans l'UI ;
- stabiliser un contrat de sortie lisible par l'application ;
- centraliser les warnings et traces inter-domaines ;
- preparer l'ajout futur de TVA, CFE, retraite, IR ou autres modules ;
- permettre une migration progressive sans changer les domaines deja testes.

Le Facade sert donc de couche d'orchestration, pas de couche de calcul primaire.

## 3. Current Architecture

Architecture actuelle :

```text
src/domain/calculations/
  money.js
  dates.js
  revenue/
  contributions/
  acre/
```

Domaines disponibles :

- Revenue normalise, filtre et agrege les revenus ;
- Contributions calcule les cotisations standard et leurs agregations ;
- ACRE applique la reduction legacy a un resultat Contributions standard.

Autres couches existantes :

- Rules Engine fournit les taux et regles ;
- Domain Models normalise les structures metier ;
- `App.jsx` contient encore des calculs, adaptations UI, stockage, alertes et projections legacy ;
- `src/utils/obligations.js` reste la reference historique de parite, mais ne doit pas devenir une dependance du Facade.

## 4. Problems

Problemes actuels :

- `App.jsx` concentre encore orchestration, UI, donnees et calculs historiques ;
- l'ordre Revenue -> Contributions -> ACRE n'est pas formalise dans une API unique ;
- les warnings de modules differents ne sont pas encore fusionnes par un contrat commun ;
- les traces restent locales aux domaines ;
- l'application risque de brancher chaque domaine directement et de recreer du couplage ;
- les futurs modules fiscaux pourraient etre ajoutes de maniere horizontale sans architecture commune ;
- la distinction entre resultat fiscal et objet UI n'est pas encore explicite.

Le Facade doit resoudre ces problemes sans introduire une grosse abstraction prematuree.

## 5. Objectives

Objectifs du Calculation Facade :

- fournir un point d'entree stable pour les calculs fiscaux composes ;
- orchestrer les domaines existants dans un ordre explicite ;
- conserver la separation des responsabilites ;
- produire un resultat fiscal final utilisable par un adapter applicatif ;
- fusionner warnings et traces en conservant la provenance ;
- rendre les erreurs de programmation visibles ;
- permettre une migration progressive depuis `computeObligations` ;
- preparer les futurs domaines TVA, CFE, retraite, IR sans casser Revenue, Contributions ou ACRE.

Non-objectifs :

- remplacer les domaines ;
- corriger la logique legacy ;
- integrer l'UI ;
- lire ou ecrire des donnees persistantes ;
- introduire une dependance React ;
- inventer des regles fiscales.

## 6. Responsibilities

Le Facade doit :

- orchestrer Revenue : oui, en appelant les fonctions publiques Revenue pour normaliser et agreger les revenus fournis ;
- orchestrer Contributions : oui, en appelant les fonctions publiques Contributions sur les bases de calcul explicites ;
- appliquer ACRE : oui, en appelant `calculateLegacyAcreContribution` sur les resultats standards pertinents ;
- fusionner les warnings : oui, avec deduplication et provenance conservee ;
- fusionner les traces : oui, en concatenant les traces domain par domain quand `trace: true` ;
- preparer un objet fiscal consommable : oui, un objet de synthese stable et non UI ;
- gerer les erreurs : oui, en distinguant erreurs de contrat et warnings metier ;
- choisir les domaines a appeler : oui, selon les options explicites et les donnees presentes ;
- lire le Rules Engine directement : non par defaut.

Decision importante : le Facade ne doit pas choisir les regles fiscales lui-meme. Les domaines gardent cette responsabilite via leurs imports ou resolvers existants. Le Facade peut seulement transmettre des options de test ou de composition explicitement decidees dans un lot ulterieur.

## 7. Forbidden Responsibilities

Le Facade ne doit jamais :

- calculer Revenue a la place du domaine Revenue ;
- recalculer Contributions a la place du domaine Contributions ;
- recalculer ACRE a la place du domaine ACRE ;
- connaitre `App.jsx` ;
- importer React ;
- acceder au DOM ;
- acceder a `localStorage` ;
- acceder a Supabase ;
- lire ou ecrire des fichiers ;
- modifier les donnees d'entree ;
- persister les traces ;
- formatter des textes UI ;
- produire des labels marketing ou pedagogiques ;
- appeler `computeObligations` ;
- inventer des taux, seuils, coefficients ou durees ;
- choisir une eligibility juridique ACRE ;
- appliquer la reforme ACRE 2026 sans domaine dedie ;
- fusionner des categories Revenue de facon implicite ;
- installer des dependances.

Le Facade doit rester pur, deterministe et testable.

## 8. Dependencies

Architecture de dependances proposee :

```text
Calculation Facade
  -> Revenue calculations
  -> Contributions calculations
  -> ACRE calculations
```

Dependances indirectes :

```text
Contributions -> Rules Engine
ACRE -> Rules Engine
Revenue -> Money / Dates
Contributions -> Money / Rules
ACRE -> Money / Dates / Rules
```

Le Facade ne depend pas directement du Rules Engine pour LOT 5.1. Cette decision evite de court-circuiter les domaines et de reintroduire des choix metier dans l'orchestrateur.

Le Facade ne depend pas de Domain Models au demarrage. Il peut recevoir des DTO deja normalises ou des objets JSON simples compatibles avec les domaines. Un adapter applicatif futur pourra convertir l'etat `App.jsx` vers ce contrat.

## 9. Pipeline

Pipeline conceptuel obligatoire pour une synthese fiscale complete :

```text
Input fiscal explicite
  -> Revenue normalization / filtering / totals
  -> Standard Contributions
  -> Legacy ACRE application
  -> Result assembly
  -> Warnings / trace aggregation
```

Ordre obligatoire :

1. Revenue avant Contributions, car les revenus fournissent les bases ;
2. Contributions avant ACRE, car ACRE consomme un resultat standard ;
3. ACRE avant resultat final, car le montant final peut differer du standard ;
4. aggregation warnings / trace a la fin, avec conservation des warnings intermediaires.

Le pipeline peut ignorer un domaine si l'appel public choisi n'en a pas besoin. Par exemple, un calcul preview sur une base unique peut appeler Contributions puis ACRE sans agreger Revenue.

## 10. Public API

API publique recommandee a terme :

```js
calculateFiscalSummary(input, options)
calculateContributionPreview(input, options)
calculateRevenueSummary(input, options)
```

Decision pour LOT 5.1 :

- creer seulement `calculateFiscalSummary`.

Raison :

- c'est le point d'entree le plus utile pour remplacer progressivement `computeObligations` ;
- il force a definir le contrat global ;
- il peut rester minimal sans creer de facade preview ou simulation prematuree.

APIs reservees pour lots futurs :

- `calculateContributionPreview` pour une base ponctuelle ;
- `calculateSimulation` pour scenarii multi-hypotheses ;
- `calculateFiscalProjection` pour annualisation, TVA ou CFE futures ;
- `calculateDashboardSummary` seulement si un adapter UI distinct est decide.

Ne pas exporter de helpers internes dans LOT 5.1.

## 11. Input Contract

Le Facade doit recevoir un DTO fiscal explicite, pas l'etat brut `App.jsx`.

Contrat recommande pour `calculateFiscalSummary` :

```js
{
  revenues: [],
  fiscalProfile: {
    activityType,
    acre,
    acreStartDate
  },
  period: {
    startDate,
    endDate,
    year,
    month,
    quarter
  },
  referenceDate
}
```

Regles :

- `referenceDate` doit etre injectee ;
- les revenus doivent etre des objets JSON simples ;
- le profil fiscal doit etre minimal ;
- aucune dependance a Supabase ou localStorage ;
- aucune lecture directe de Domain Models en LOT 5.1 ;
- les aliases historiques peuvent etre acceptes seulement si les domaines les acceptent deja ou si un adapter dedie est cree plus tard.

Decision : le Facade ne recoit pas un App State complet. Un adapter futur transformera l'etat applicatif en DTO Facade.

## 12. Output Contract

Contrat de sortie recommande :

```js
{
  revenue: {
    total,
    period,
    breakdowns
  },
  contributions: {
    standard,
    final,
    acre
  },
  summary: {
    baseAmount,
    standardContributionAmount,
    finalContributionAmount,
    savedAmount,
    effectiveRate,
    calculable
  },
  warnings: [],
  trace: []
}
```

Details :

- `revenue.total` vient du domaine Revenue ;
- `contributions.standard` contient le resultat Contributions standard ;
- `contributions.acre` contient le resultat ACRE si contexte ACRE present ou explicitement evalue ;
- `contributions.final` expose le montant a retenir apres ACRE ;
- `summary` est une synthese non UI ;
- `warnings` contient les warnings fusionnes ;
- `trace` est vide par defaut.

La sortie ne doit pas contenir :

- texte UI ;
- labels localises ;
- emojis ;
- donnees personnelles ;
- objets Supabase complets ;
- references React ;
- mutations d'entree.

## 13. Warning Strategy

Le Facade doit fusionner les warnings avec une strategie stable :

- prendre les warnings de chaque domaine dans l'ordre du pipeline ;
- conserver `code`, `severity`, `domain`, `field`, `sourceId`, `details` ;
- dedupliquer par cle structurelle ;
- ne pas traduire les codes ;
- ne pas convertir automatiquement une erreur de programmation en warning ;
- ne pas supprimer un warning parce qu'un module ulterieur a reussi.

Cle de deduplication recommandee :

```text
domain + code + field + sourceId
```

Les details peuvent diverger pour un meme code. En LOT 5.1, la version la plus simple peut conserver le premier warning rencontre pour eviter des merges complexes.

## 14. Trace Strategy

La trace est optionnelle et desactivee par defaut.

Responsabilite des domaines :

- produire leurs propres steps ;
- nommer les steps avec leur prefixe de domaine ;
- ne pas persister ;
- ne pas logguer.

Responsabilite du Facade :

- transmettre `{ trace: true }` aux domaines ;
- ajouter des steps d'orchestration seulement si utile ;
- concatener les traces dans l'ordre du pipeline ;
- ne pas reinterpreter les traces internes.

Steps Facade proposes :

- `facade.input.normalize` ;
- `facade.revenue.calculate` ;
- `facade.contributions.calculate` ;
- `facade.acre.apply` ;
- `facade.result.assemble`.

LOT 5.1 peut inclure seulement `facade.input.normalize` et `facade.result.assemble` si le pipeline reste minimal.

## 15. Error Strategy

Erreurs qui doivent remonter directement :

- appel du Facade avec un input non objet ;
- options non objet ;
- resolver injecte invalide ;
- domaine appele avec un contrat de programmation invalide ;
- retour de domaine structurellement invalide.

Cas qui doivent devenir warnings :

- revenu invalide ;
- periode invalide ;
- activity type manquant ou inconnu ;
- contribution standard non calculable ;
- contexte ACRE manquant ;
- reference date invalide ;
- regle ACRE absente ;
- taux ACRE invalide.

Principe : les erreurs de programmation restent des exceptions ; les problemes metier ou donnees utilisateur deviennent warnings structures.

## 16. Extensibility

Le Facade doit permettre l'ajout futur de modules :

- TVA ;
- CFE ;
- retraite ;
- IR ;
- obligations declaratives ;
- projections ;
- simulations.

Pattern propose :

```text
domain module -> pure calculation -> facade orchestration -> app adapter
```

Chaque nouveau domaine doit :

- avoir son dossier isole ;
- exposer une API publique minimale ;
- produire ses warnings ;
- produire sa trace optionnelle ;
- ne pas connaitre le Facade ;
- ne pas connaitre App.jsx.

Le Facade pourra ensuite ajouter un bloc de pipeline sans modifier les domaines existants.

## 17. Migration Strategy

Migration progressive proposee :

1. LOT 5.1 : creer Facade minimal pur, sans integration App ;
2. LOT 5.2 : enrichir warnings et traces si le minimal reste trop pauvre ;
3. LOT 5.3 : ajouter previews/simulations si necessaire ;
4. LOT 5.4 : creer adapter App State -> Facade DTO, toujours sans remplacement massif ;
5. LOT 5.5 : brancher une surface non critique dans `App.jsx` ;
6. LOT 5.6 : comparer Facade vs legacy `computeObligations` en shadow mode ;
7. LOT 5.7 : remplacer progressivement les chemins legacy ;
8. LOT 5.8 : retirer duplication seulement apres validation.

Rollback :

- garder `computeObligations` comme reference legacy pendant la migration ;
- chaque integration App doit pouvoir revenir au chemin precedent ;
- ne pas supprimer les calculs historiques tant que la parite n'est pas prouvee.

Risques migration :

- divergence entre UI labels et resultats fiscaux ;
- confusion entre preview et resultat final ;
- manque de `referenceDate` injectee ;
- dette lint existante qui masque de nouveaux problemes ;
- temptation de faire du Facade un second moteur fiscal.

## 18. Proposed Folder Structure

Arborescence cible proposee :

```text
src/domain/calculations/
  index.js
  money.js
  dates.js
  revenue/
  contributions/
  acre/
  facade/
    index.js
    calculateFiscalSummary.js
    warnings.js
    trace.js
```

Decision LOT 5.1 :

```text
src/domain/calculations/facade/
  index.js
  calculateFiscalSummary.js
```

`warnings.js` et `trace.js` doivent attendre si la duplication reste faible. Ajouter ces helpers seulement quand le code reel les justifie.

Exports :

- `facade/index.js` exporte `calculateFiscalSummary` ;
- pas de reexport global depuis `src/domain/calculations/index.js` en LOT 5.1, sauf decision explicite du brief 5.1 ;
- pas de reexport depuis `src/domain/index.js` tant qu'aucune integration App n'est decidee.

## 19. Risks

Risques principaux :

- Facade trop large des LOT 5.1 ;
- ajout de logique metier dans l'orchestrateur ;
- duplication d'arrondis ;
- conflit entre montants standard et montants apres ACRE ;
- warnings mal deduplices ;
- trace verbeuse ou contenant des donnees non necessaires ;
- integration prematuree dans `App.jsx` ;
- couplage au stockage ;
- apparition d'une API publique trop stable avant usage reel.

Mitigations :

- commencer par un seul export ;
- garder les domaines responsables de leurs calculs ;
- tests de parite avec les lots 4 ;
- aucun acces App, Supabase ou localStorage ;
- `referenceDate` obligatoire ;
- rapport de decisions a chaque sous-lot.

## 20. Rollback

Rollback LOT 5.1 futur :

- supprimer `src/domain/calculations/facade/` ;
- supprimer les tests Facade ;
- supprimer le rapport LOT 5.1 ;
- ne rien changer dans App.

Rollback migration App future :

- conserver l'ancien chemin `computeObligations` ;
- isoler le branchement derriere un adapter ;
- comparer les sorties avant remplacement ;
- retirer uniquement le branchement, pas les domaines purs.

LOT 5.0 lui-meme ne necessite qu'un rollback documentaire : supprimer ce fichier.

## 21. Roadmap

Roadmap proposee :

- LOT 5.1 : Facade minimal `calculateFiscalSummary` ;
- LOT 5.2 : strategie warnings/trace dediee si necessaire ;
- LOT 5.3 : previews ponctuelles et simulations simples ;
- LOT 5.4 : adapter App State -> Facade DTO ;
- LOT 5.5 : integration App shadow mode, sans comportement visible ;
- LOT 5.6 : comparaison parite legacy dashboard ;
- LOT 5.7 : remplacement progressif des lectures de `computeObligations` ;
- LOT 5.8 : documentation finale et nettoyage controle.

Les modules TVA, CFE, retraite et IR doivent attendre leurs propres gates avant d'entrer dans le Facade.

## 22. LOT 5.1 Scope

LOT 5.1 doit creer, et seulement si le brief le confirme :

```text
src/domain/calculations/facade/
  index.js
  calculateFiscalSummary.js

tests/calculation-facade.test.js

docs/LOT_5_1_CALCULATION_FACADE_REPORT.md
```

Fonction publique :

```js
calculateFiscalSummary(input, options)
```

Scope minimal :

- recevoir `revenues`, `fiscalProfile`, `period`, `referenceDate` ;
- calculer un total Revenue explicite ;
- calculer une contribution standard sur ce total ;
- appliquer ACRE legacy si contexte fourni ;
- retourner `revenue`, `contributions`, `summary`, `warnings`, `trace` ;
- ne pas reexporter globalement ;
- ne pas integrer App.

Tests minimum LOT 5.1 :

- API publique exacte ;
- input non objet ;
- referenceDate manquante ;
- revenues vides ;
- revenus valides ;
- periode explicite ;
- standard contribution ;
- ACRE active ;
- ACRE inactive ;
- warnings fusionnes ;
- trace off/on ;
- immutabilite ;
- determinisme ;
- aucune dependance App.

## 23. Decisions

Decisions retenues :

- le Facade est un orchestrateur, pas un moteur fiscal ;
- pipeline complet : Revenue -> Contributions -> ACRE -> synthese ;
- `calculateFiscalSummary` est le seul export initial recommande ;
- input DTO explicite, pas App State ;
- output fiscal non UI ;
- warnings fusionnes par cle structurelle ;
- traces concatenees dans l'ordre du pipeline ;
- erreurs de programmation en exceptions ;
- problemes de donnees en warnings ;
- pas de lecture directe Rules Engine par le Facade en LOT 5.1 ;
- pas de Domain Models obligatoires dans LOT 5.1 ;
- pas d'integration `App.jsx` avant un lot dedie ;
- pas de TVA, CFE, retraite ou IR sans gates separes.

Decisions rejetees :

- Facade universel avec toutes les projections ;
- Facade qui lit Supabase ou localStorage ;
- Facade qui formate pour l'UI ;
- Facade qui appelle `computeObligations` ;
- Facade qui implemente l'eligibilite ACRE ;
- reexport global premature.

## 24. GO / NO-GO LOT 5.1

Decision : GO POUR LOT 5.1.

Conditions strictes :

- creer un Facade minimal pur ;
- exporter uniquement `calculateFiscalSummary` depuis le dossier Facade ;
- ne pas modifier App.jsx ;
- ne pas modifier Revenue, Contributions, ACRE, Rules Engine ou Domain Models ;
- ne pas ajouter TVA, CFE, retraite, IR ;
- ne pas installer de dependance ;
- ne pas lire Supabase ou localStorage ;
- garder `referenceDate` injectee ;
- documenter toute divergence de parite.

Confirmations LOT 5.0 :

- un seul fichier cree ;
- aucun JS cree ;
- aucun test cree ;
- aucun export modifie ;
- aucune dependance installee ;
- aucun comportement modifie ;
- aucune integration App.jsx ;
- aucune modification Revenue ;
- aucune modification Contributions ;
- aucune modification ACRE ;
- aucune modification Rules Engine ;
- aucune modification Domain Models.

GO POUR LOT 5.1
