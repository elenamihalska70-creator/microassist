# LOT 5.3 - Integration Adapter Gate Review

Statut : Gate review documentaire pour LOT 5.4.

## 1. Resume executif

Le Facade de calcul existe comme frontiere de domaine minimale et durcie. Il recoit un DTO explicite, orchestre les domaines existants Revenue, Contributions et ACRE, assemble leurs resultats, fusionne warnings/traces et propage les erreurs.

Le prochain risque architectural n'est pas le Facade lui-meme, mais l'endroit ou les donnees applicatives seront transformees avant son appel. L'adapter d'integration doit rester une couche de traduction technique entre l'etat App et le contrat du Facade. Il ne doit pas calculer, completer, corriger ou interpreter une valeur metier.

Decision de gate : GO conditionnel pour LOT 5.4, limite a un adapter minimal, teste unitairement, non branche a App.jsx, sans modification de comportement visible.

## 2. Perimetre

Ce rapport couvre uniquement la preparation architecturale d'un adapter d'integration entre l'application React existante et `calculateFiscalSummary`.

Inclus :

- inspection de la documentation LOT 5.0, LOT 5.1 et LOT 5.2 ;
- inspection des frontieres `App.jsx`, domaines, modeles, utils, composants et tests ;
- caracterisation des donnees necessaires a l'adapter ;
- definition des transformations autorisees et interdites ;
- recommandation du perimetre exact de LOT 5.4.

Exclus :

- aucune modification de code source ;
- aucune creation d'adapter ;
- aucun export ;
- aucun test ;
- aucune fixture ;
- aucune integration App ;
- aucun changement de persistence, payload, cle, formule, taux, arrondi ou date implicite.

## 3. Sources inspectees

Documentation inspectee :

- `docs/LOT_5_0_CALCULATION_FACADE_ARCHITECTURE.md` ;
- `docs/LOT_5_1_CALCULATION_FACADE_REPORT.md` ;
- `docs/LOT_5_2_FACADE_CONTRACT_HARDENING_REPORT.md`.

Code inspecte :

- `src/App.jsx` ;
- `src/domain/calculations/facade/calculateFiscalSummary.js` ;
- `src/domain/calculations/facade/index.js` ;
- `src/domain/calculations/revenue/*` ;
- `src/domain/calculations/contributions/*` ;
- `src/domain/calculations/acre/*` ;
- `src/domain/models/identity.js` ;
- `src/domain/models/revenue.js` ;
- `src/utils/obligations.js` ;
- `src/utils/facturx.js` ;
- `src/context/AuthContext.jsx` ;
- `src/components/*` ;
- `tests/*`.

Observation de structure : `src/contexts/` n'existe pas dans l'arborescence inspectee ; le contexte present est `src/context/AuthContext.jsx`.

## 4. Hierarchie documentaire

La sequence documentaire actuelle etablit une progression claire :

- LOT 5.0 definit l'architecture cible du Facade et ses interdictions ;
- LOT 5.1 introduit un Facade minimal et reversible ;
- LOT 5.2 durcit le contrat d'entree, les options, la propagation d'erreurs et les garde-fous statiques ;
- LOT 5.3 doit preparer l'adapter sans le creer.

La hierarchie a respecter pour LOT 5.4 est donc :

1. domaines fiscaux existants ;
2. Facade de calcul strictement orchestrateur ;
3. adapter applicatif strictement traducteur ;
4. integration App uniquement dans un lot ulterieur et separe.

## 5. Architecture actuelle

L'application contient encore plusieurs calculs legacy dans `App.jsx` et `src/utils/obligations.js`. Ces calculs alimentent l'experience actuelle : dashboard, assistant, alertes, priorites, apercus et contenus premium.

En parallele, le domaine contient maintenant des modules specialises :

- Revenue pour les totaux et regroupements ;
- Contributions pour les cotisations standard ;
- ACRE pour l'application legacy ACRE ;
- Facade pour orchestrer ces domaines sans calcul direct.

L'architecture transitoire est donc duale : legacy actif cote App et domaine fiscal consolide cote `src/domain`. L'adapter ne doit pas fusionner ces deux mondes fonctionnellement ; il doit seulement preparer l'entree du Facade.

## 6. Contrat actuel du Facade

Entree attendue :

- `revenues` ;
- `fiscalProfile` ;
- `period` ;
- `referenceDate`.

Options autorisees :

- `trace` ;
- injections de calculateurs de domaine pour tests et orchestration.

Sortie assemblee :

- `revenue` ;
- `contributions` ;
- `summary` ;
- `warnings` ;
- `trace`.

Le contrat est volontairement strict :

- champ top-level manquant : erreur ;
- champ top-level inconnu : erreur ;
- option inconnue : erreur ;
- erreur domaine : propagation ;
- warnings domaine : fusion sans interpretation ;
- traces domaine : fusion si `trace` est actif.

## 7. Inventaire des calculs legacy

Calculs legacy identifies dans `App.jsx` :

- taux simples par type d'activite pour assistant et apercus ;
- estimation de cotisations par multiplication montant x taux ;
- arrondis par `Math.round` ;
- sommes de revenus via reductions ;
- breakdown mixte vente/service ;
- projections annuelles ;
- alertes TVA ;
- alertes ACRE basees sur dates ;
- indicateurs de reserve ;
- scores et pourcentages d'avancement ;
- priorites et recommandations textuelles ;
- weekly recap et estimations associees.

Calculs legacy identifies dans `src/utils/obligations.js` :

- obligations, taux, ACRE, TVA, CFE, deadlines, projection et etat fiscal.

Ces calculs restent hors perimetre de LOT 5.4. L'adapter ne doit ni les appeler ni les reproduire.

## 8. Inventaire du state App

Etats applicatifs pertinents observes :

- `answers` ;
- `fiscalProfile` ;
- `revenues` ;
- `simpleAssistantProfile` ;
- `simpleOnboardingDraft` ;
- `revenueForm` ;
- `invoices` et `guestInvoices` ;
- `reminderPrefs` ;
- etats UI de navigation, modales, exports, abonnement et notifications.

Donnees utiles au futur adapter :

- la liste des revenus deja chargee ;
- un profil fiscal deja connu par l'application ;
- une periode explicite ;
- une date de reference explicite.

Donnees a exclure du contrat adapter :

- etats UI ;
- textes de dashboard ;
- invoices ;
- reminders ;
- subscription ;
- toasts ;
- modales ;
- drafts non normalises ;
- valeurs derivees comme `computed`, `estimatedCharges`, `currentMonthTotal` ou `availableAmount`.

## 9. Donnees persistees

Persistences observees :

- `localStorage` pour profil simple, reponses, revenus guest, factures guest, preferences et etats UI ;
- Supabase pour revenus, profils fiscaux, factures et preferences ;
- migrations localStorage vers Supabase.

Point notable : la migration des revenus vers Supabase construit un payload a partir des revenus locaux. Le rapport ne modifie pas cette zone, mais LOT 5.4 ne doit pas s'appuyer sur une lecture directe persistence.

Regle pour l'adapter : il recoit des donnees deja chargees en memoire. Il ne lit ni `localStorage`, ni Supabase, ni session storage.

## 10. Donnees temporelles

Dates observees dans App :

- date du jour via `new Date()` ou `Date.now()` ;
- date par defaut du formulaire revenu ;
- date de reference pour alertes, priorites et contenus ;
- dates de revenus ;
- dates ACRE ;
- dates de factures.

Risque principal : introduire une date implicite dans l'adapter. Cela rendrait les resultats non deterministes et violerait le contrat durci du Facade.

Regle pour l'adapter : `referenceDate` doit etre fourni explicitement par l'appelant. L'adapter ne doit pas appeler `new Date()`, `Date.now()` ou deduire l'annee courante.

## 11. Matrice App -> Facade

Mapping recommande :

| Source App | Champ Facade | Transformation autorisee |
| --- | --- | --- |
| `revenues` | `revenues` | copie defensive de collection |
| `activity_type` | `fiscalProfile.activityType` | renommage snake_case vers camelCase |
| `acre` | `fiscalProfile.acre` | passage tel quel |
| `acre_start_date` | `fiscalProfile.acreStartDate` | renommage snake_case vers camelCase |
| periode fournie | `period` | copie defensive |
| date fournie | `referenceDate` | passage explicite |

Champs non mappes :

- `computed` ;
- `estimatedCharges` ;
- `currentMonthTotal` ;
- `availableAmount` ;
- `monthlyHistory` ;
- `smartAlerts` ;
- `smartPriorities` ;
- `fiscalScore` ;
- tout contenu texte ou UI.

## 12. Transformations techniques autorisees

L'adapter peut :

- renommer des champs snake_case vers camelCase ;
- copier un tableau sans muter la source ;
- copier un objet sans muter la source ;
- selectionner les champs strictement requis ;
- assembler le DTO attendu par le Facade ;
- rejeter une entree structurellement absente ;
- passer une periode explicite ;
- passer une date de reference explicite.

Ces transformations sont techniques car elles ne changent pas la valeur fiscale et n'appliquent aucune regle metier.

## 13. Transformations metier interdites

L'adapter ne doit jamais :

- multiplier ;
- diviser ;
- calculer un pourcentage ;
- appeler `Math.round` ;
- sommer les revenus ;
- calculer une cotisation ;
- calculer une reduction ACRE ;
- choisir un taux ;
- appeler `getContributionRule` ;
- appeler `computeObligations` ;
- appliquer une condition metier sur `activityType` ;
- choisir une periode fiscale ;
- deduire l'annee courante ;
- creer une date implicite ;
- remplacer un montant manquant par zero ;
- remplacer une activite manquante par `services` ;
- corriger une categorie ;
- produire un warning metier.

## 14. Architectural Guard

Le guard du Facade reste applicable par extension a l'adapter :

- aucune formule fiscale ;
- aucun taux ;
- aucun arrondi ;
- aucune resolution directe de regle ;
- aucune branche metier sur activite ;
- aucune dependance a l'heure courante.

LOT 5.4 doit ajouter un guard statique propre a l'adapter ou etendre le guard existant, mais uniquement pour verifier l'absence de calcul et de dependances interdites.

## 15. Frontieres de responsabilite

Responsabilites App :

- posseder l'etat UI ;
- charger et synchroniser les donnees ;
- gerer auth, persistence, notifications et affichage ;
- fournir explicitement les donnees a l'adapter.

Responsabilites Adapter :

- traduire l'etat applicatif minimal en DTO Facade ;
- valider la presence structurelle des donnees necessaires ;
- rester pur, deterministe et sans effet de bord.

Responsabilites Facade :

- orchestrer les domaines ;
- assembler les resultats ;
- propager erreurs, warnings et traces.

Responsabilites Domaines :

- calculer les valeurs metier.

## 16. Options de placement de l'adapter

Option A : `src/domain/calculations/facade`

- rejetee ;
- l'adapter depend de formes applicatives, donc il ne doit pas entrer dans le domaine.

Option B : `src/utils`

- possible mais fragile ;
- ce dossier contient deja du legacy fiscal actif, ce qui augmente le risque de melange.

Option C : `src/application/adapters`

- recommandee ;
- position explicite entre App et Domaine ;
- favorise la separation des responsabilites.

Option D : proche de `App.jsx`

- rejetee pour LOT 5.4 ;
- augmente le risque de modification comportementale visible.

## 17. Placement recommande

Placement recommande :

- `src/application/adapters/buildFiscalSummaryInput.js` ;
- `src/application/adapters/index.js`.

Le nom recommande decrit la responsabilite exacte : construire l'entree du Facade, pas calculer un resume fiscal.

La couche `application/adapters` doit dependre du contrat du Facade ou de constantes de champ stables si necessaire, mais ne doit pas dependre des calculateurs de domaine.

## 18. Contrat d'entree de l'adapter

Contrat recommande :

```js
buildFiscalSummaryInput({
  revenues,
  fiscalProfile,
  period,
  referenceDate,
})
```

Forme minimale attendue :

- `revenues` : liste deja chargee ;
- `fiscalProfile` : profil fiscal applicatif ou profil deja agrege par l'appelant ;
- `period` : objet fourni explicitement ;
- `referenceDate` : date fournie explicitement.

L'adapter ne doit pas recevoir tout l'etat App. Un contrat large encouragerait les lectures opportunistes et les fallbacks implicites.

## 19. Contrat de sortie de l'adapter

Sortie recommandee :

```js
{
  revenues,
  fiscalProfile: {
    activityType,
    acre,
    acreStartDate,
  },
  period,
  referenceDate,
}
```

La sortie doit etre compatible avec `calculateFiscalSummary`.

Elle ne doit pas inclure :

- valeurs calculees ;
- warnings ;
- trace ;
- donnees UI ;
- donnees persistantes brutes ;
- metadata Supabase ;
- fallback implicite.

## 20. Validation et erreurs

Validation autorisee :

- verifier que le payload adapter est un objet ;
- verifier la presence des cles requises ;
- verifier que `revenues` est une collection ;
- verifier que `fiscalProfile` est un objet ;
- verifier que `period` est un objet ;
- verifier que `referenceDate` est present.

Validation interdite :

- valider un taux ;
- valider une eligibilite fiscale ;
- corriger une activite ;
- filtrer une periode ;
- normaliser un montant ;
- normaliser une date par rapport a aujourd'hui.

Les erreurs doivent etre structurelles, pas fiscales.

## 21. Warnings

L'adapter ne doit pas produire de warnings metier.

Deux options acceptables pour LOT 5.4 :

- aucune gestion de warnings dans l'adapter ;
- messages d'erreur structurels via exceptions, sans champ `warnings`.

Les warnings fiscaux restent la responsabilite des domaines et du Facade.

## 22. Trace

L'adapter ne doit pas produire de trace fiscale.

Une trace technique pourrait etre envisagee plus tard, mais elle est hors perimetre de LOT 5.4. Pour ce lot, la trace doit rester geree par le Facade et les domaines.

## 23. Immutabilite

L'adapter doit etre pur :

- ne pas muter `revenues` ;
- ne pas muter `fiscalProfile` ;
- ne pas muter `period` ;
- ne pas enrichir les objets sources ;
- retourner de nouveaux objets ou des copies defensives quand une collection est transmise.

Tests proposes pour LOT 5.4 : verifier que les references sources ne sont pas modifiees apres appel.

## 24. Dependances autorisees

Dependances autorisees :

- constantes de contrat si elles existent deja ;
- helpers purement structurels deja etablis, uniquement s'ils ne calculent pas de valeur metier ;
- aucun acces runtime externe.

Si une dependance cree une ambiguite sur une regle fiscale, elle doit etre exclue.

## 25. Dependances interdites

Dependances interdites :

- `src/utils/obligations.js` ;
- calculateurs Revenue ;
- calculateurs Contributions ;
- calculateurs ACRE ;
- `calculateFiscalSummary` lui-meme ;
- Supabase ;
- `localStorage` ;
- `sessionStorage` ;
- composants React ;
- hooks React ;
- contexte auth ;
- routeur ;
- fonctions de formatage monetaire si elles font parsing ou arrondi ;
- toute source de date implicite.

L'adapter construit l'entree ; il ne declenche pas le calcul.

## 26. Premiere tranche d'integration

La premiere tranche d'integration recommandee n'est pas une integration visible.

Ordre recommande :

1. LOT 5.4 : creer l'adapter minimal et ses tests, sans brancher App ;
2. LOT 5.5 : shadow mode interne, appele mais non affiche, avec comparaison controlee ;
3. lot ulterieur : premiere surface visible si la parite est documentee.

Cette sequence limite le risque de regression utilisateur.

## 27. Shadow mode

Le shadow mode doit appeler le Facade en parallele du legacy sans modifier l'affichage.

Conditions :

- resultat non visible par defaut ;
- aucune modification de `computed` ;
- aucune modification des cards existantes ;
- aucun changement de persistence ;
- erreurs capturees et non bloquantes si le shadow mode est strictement observatoire ;
- logs ou instrumentation uniquement si explicitement acceptes par un lot dedie.

LOT 5.4 ne doit pas encore introduire ce shadow mode.

## 28. Parite legacy

La parite legacy ne peut pas etre declaree globalement a ce stade.

Raisons :

- App contient des calculs multi-usages non couverts par le Facade ;
- `computeObligations` produit des obligations, labels et etats plus larges que le resume fiscal minimal ;
- certains noms comme `currentMonthTotal` ne correspondent pas strictement a une periode fiscale filtree ;
- des decisions temporelles sont encore implicites dans App.

Objectif LOT 5.4 : preparer une entree stable pour mesurer la parite, pas conclure la parite.

## 29. Tests proposes

Tests unitaires adapter proposes :

- construit le DTO Facade minimal depuis des champs applicatifs snake_case ;
- conserve les valeurs sans calcul ;
- copie `revenues` sans mutation ;
- copie `period` sans mutation ;
- rejette une entree non objet ;
- rejette une cle top-level inconnue si le contrat le decide ;
- rejette `referenceDate` absent ;
- n'appelle aucune dependance interdite ;
- guard statique : pas `Math.round`, pas `*`, pas `/`, pas `%`, pas `new Date`, pas `Date.now`, pas `computeObligations`, pas `getContributionRule`, pas `calculateFiscalSummary`.

Tests exclus de LOT 5.4 :

- tests App ;
- tests Playwright ;
- tests Supabase ;
- tests de parite exhaustive.

## 30. Risques

Risques principaux :

- glisser un fallback metier dans l'adapter ;
- reutiliser `dashboardAnswers` sans distinguer donnees sources et donnees derivees ;
- deduire la periode ou l'annee depuis la date du jour ;
- appeler le Facade trop tot depuis App ;
- melanger adapter et legacy `computeObligations` ;
- transformer des montants ou categories dans l'adapter ;
- produire une sortie qui ressemble a un resume au lieu d'une entree.

Mitigation :

- perimetre LOT 5.4 strict ;
- tests statiques ;
- aucune modification App ;
- aucune dependance domaine calculee.

## 31. Questions ouvertes

Questions a trancher avant integration visible :

- quelle periode exacte l'interface devra-t-elle transmettre au Facade ?
- la premiere surface visible utilisera-t-elle le total courant, annuel ou une periode explicite ?
- quelle source de profil fiscal doit etre privilegiee en cas de divergence entre local draft, answers et profil Supabase ?
- comment traiter les revenus Supabase sans categorie si la categorie devient obligatoire pour certains cas mixtes ?
- quelle strategie de comparaison parite sera retenue entre legacy et Facade ?

Ces questions ne bloquent pas LOT 5.4 si ce lot reste adapter-only.

## 32. Decisions obligatoires

Decisions pour LOT 5.4 :

- l'adapter ne lit pas App globalement ;
- l'adapter ne lit aucune persistence ;
- l'adapter ne cree aucune date ;
- l'adapter ne calcule aucune valeur metier ;
- l'adapter ne branche pas le Facade ;
- l'adapter ne modifie pas `App.jsx` ;
- l'adapter ne modifie pas les domaines ;
- l'adapter est teste uniquement comme traducteur de contrat.

## 33. Plan de migration

Plan recommande :

1. Creer l'adapter minimal dans `src/application/adapters`.
2. Ajouter des tests unitaires de contrat et de non-calcul.
3. Documenter le rapport LOT 5.4.
4. Garder App et legacy inchanges.
5. Dans un lot ulterieur, introduire shadow mode non visible.
6. Comparer les resultats Facade et legacy sur des cas representatifs.
7. Seulement ensuite envisager une premiere substitution visible.

## 34. Rollback

Rollback LOT 5.4 attendu :

- supprimer le fichier adapter ;
- supprimer son export ;
- supprimer ses tests ;
- supprimer son rapport.

Comme LOT 5.4 ne doit pas brancher App, le rollback ne doit impliquer aucun changement runtime utilisateur.

## 35. Stop conditions

LOT 5.4 doit s'arreter immediatement si l'implementation exige :

- modifier `App.jsx` ;
- modifier un composant ;
- modifier un hook ;
- modifier un domaine ;
- modifier `calculateFiscalSummary.js` ;
- lire Supabase ;
- lire `localStorage` ;
- ajouter une persistence ;
- ajouter une formule ;
- ajouter un taux ;
- ajouter un arrondi ;
- deduire une date ;
- choisir une activite par defaut ;
- corriger des donnees metier ;
- changer un payload existant.

## 36. Perimetre exact de LOT 5.4

Perimetre recommande de LOT 5.4 :

- creer `src/application/adapters/buildFiscalSummaryInput.js` ;
- creer `src/application/adapters/index.js` si necessaire pour export applicatif ;
- creer `tests/fiscal-summary-input-adapter.test.js` ;
- creer `docs/LOT_5_4_MINIMAL_INTEGRATION_ADAPTER_REPORT.md`.

Interdits LOT 5.4 :

- aucun branchement dans `App.jsx` ;
- aucun appel a `calculateFiscalSummary` depuis l'adapter ;
- aucune modification de Facade ;
- aucune modification Revenue, Contributions, ACRE, Rules ou Domain Models ;
- aucun changement Supabase ou localStorage ;
- aucun changement de formule, taux, arrondi, payload ou cle.

## 37. GO / NO-GO LOT 5.4

GO POUR LOT 5.4.

Justification : le LOT 5.4 peut etre engage si et seulement s'il reste limite a un adapter minimal de construction de DTO, sans integration App, sans appel au Facade, sans acces persistence, sans date implicite et sans calcul metier.

Toute tentative d'utiliser l'adapter pour reproduire `computeObligations`, calculer une cotisation, corriger une activite, deduire une periode ou modifier une surface utilisateur ferait basculer le lot en NO-GO.
