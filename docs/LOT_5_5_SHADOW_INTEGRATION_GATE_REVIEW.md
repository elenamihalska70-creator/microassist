# LOT 5.5 - Shadow Integration Gate Review

Statut : audit d'integration, documentation uniquement.

## 1 Executive Summary

LOT 5.5 prepare la premiere integration invisible entre App, l'Integration Adapter et le Calculation Facade.

Decision : GO conditionnel pour LOT 5.6, limite a un shadow mode dashboard non visible, desactivable, sans persistence, sans affichage, sans remplacement du legacy et sans modification de Revenue, Contributions, ACRE, Rules Engine, Adapter ou Facade.

Le legacy doit rester la source exclusive de l'UI. Le Facade peut travailler en parallele uniquement pour produire un snapshot compare puis ignore.

## 2 Architecture actuelle

Architecture de calcul disponible :

```text
App.jsx
  -> buildFiscalSummaryInput
  -> calculateFiscalSummary
  -> Revenue
  -> Contributions
  -> Legacy ACRE
```

Etat reel aujourd'hui :

- `App.jsx` n'importe pas encore `buildFiscalSummaryInput` ;
- `App.jsx` n'importe pas encore `calculateFiscalSummary` ;
- `computed` reste produit par `computeObligations` ;
- les montants dashboard restent derives par calculs legacy dans `App.jsx` ;
- l'Adapter existe mais n'est pas branche ;
- le Facade existe mais n'est pas branche a l'application.

Calculs fiscaux encore dans `App.jsx` :

- `currentMonthTotal` somme `revenues` avec `Number(item.amount || 0)` ;
- `mixedRevenueBreakdown` somme les categories `vente` et `service` ;
- `computed` calcule `caYtd`, `monthsWithData`, puis appelle `computeObligations` ;
- `estimatedCharges` applique `Math.round(currentMonthTotal * computed.rate)` ;
- `availableAmount` applique `Math.max(0, currentMonthTotal - estimatedCharges)` ;
- preview ajout revenu calcule montant, taux effectif, cotisation et disponible ;
- alertes, priorites, score, recap hebdo et recommandations derivent de `computed`, revenus, factures et dates implicites.

Consommation actuelle :

- dashboard hero et declaration URSSAF ;
- cards "Revenus cumules", "A mettre de cote", "Disponible" ;
- mini-stats, breakdown mixte, timeline fiscale ;
- smart alerts, smart priorities, fiscal coaching, recommandations ;
- modal cash impact, diagnostic TVA, analyse financiere, score ;
- export texte via `buildFiscalSummary` et `buildFiscalChecklist`.

## 3 Point exact d'integration

Point d'integration recommande pour LOT 5.6 : un `useMemo` ou bloc equivalent strictement adjacent au bloc `computed` dans `App.jsx`, apres la construction de `dashboardAnswers`, `currentMonthTotal` et avant les consommateurs UI.

Raison :

- les donnees minimales sont deja disponibles : `revenues`, `dashboardAnswers`, periode explicite a construire par le slice, date de reference injectee par le slice ;
- c'est le point ou le legacy fiscal principal est deja calcule ;
- les consommateurs UI peuvent rester inchanges ;
- les erreurs shadow peuvent etre capturees localement sans remonter a l'UI.

Appel Adapter recommande dans LOT 5.6 :

```text
dashboardAnswers + revenues + explicitPeriod + injectedReferenceDate
  -> buildFiscalSummaryInput
```

Appel Facade recommande dans LOT 5.6 :

```text
buildFiscalSummaryInput(...)
  -> calculateFiscalSummary(..., { trace: false })
```

Contraintes :

- ne pas inserer l'appel dans un event handler visible ;
- ne pas inserer l'appel dans les fonctions de persistence ;
- ne pas inserer l'appel dans `buildFiscalSummary` ou `buildFiscalChecklist` ;
- ne pas remplacer `computed`.

## 4 Point exact de comparaison

Point de comparaison recommande : immediatement apres l'obtention du resultat Facade dans le meme bloc shadow.

Comparer uniquement un objet technique local :

```text
legacySnapshot
facadeSnapshot
comparisonResult
```

Puis ignorer `comparisonResult` par defaut.

Le shadow mode ne doit pas alimenter :

- JSX ;
- state React affiche ;
- localStorage ;
- Supabase ;
- toast ;
- alert ;
- analytics permanente ;
- export utilisateur.

Le resultat Facade doit etre ignore par tous les chemins UI tant que le lot ne valide pas une surface visible dediee.

## 5 Pipeline Shadow

Pipeline propose LOT 5.6 :

```text
feature flag shadow off by default
  -> if disabled: return null
  -> collect explicit app DTO
  -> buildFiscalSummaryInput(appDto)
  -> calculateFiscalSummary(facadeInput, { trace: false })
  -> build legacySnapshot from existing legacy outputs
  -> build facadeSnapshot from Facade output
  -> compare snapshots
  -> keep result in local ephemeral value
  -> ignore for UI
```

Le flag doit pouvoir couper completement :

- appel Adapter ;
- appel Facade ;
- comparaison ;
- eventuel logging de dev.

Le legacy reste le seul chemin de rendu.

## 6 Donnees comparees

Comparaison stricte recommandee :

- presence top-level Facade : `revenue`, `contributions`, `summary`, `warnings`, `trace` ;
- booleen `summary.calculable` ;
- nombre de warnings ;
- codes de warnings par domaine.

Comparaison tolerante recommandee :

- `revenue.total` Facade vs total legacy comparable ;
- `summary.baseAmount` vs base legacy comparable ;
- `summary.standardContributionAmount` vs estimation legacy comparable ;
- `summary.finalContributionAmount` vs montant a mettre de cote comparable ;
- `summary.savedAmount` si ACRE active des deux cotes ;
- `summary.effectiveRate` vs `computed.rate` si disponible.

Tolerance proposee :

- montants : ecart absolu de 1 euro maximum pour les chemins arrondis ;
- taux : ecart absolu de 0.001 maximum ;
- warnings : comparaison par codes, pas par texte ;
- trace : ne pas comparer si `trace: false`.

Ecarts acceptables :

- champs Facade plus structures que legacy ;
- absence de TVA/CFE/deadlines dans Facade actuel ;
- labels UI absents du Facade ;
- warnings domaine plus explicites que legacy.

Ecarts bloquants :

- Facade impossible a appeler avec DTO adapter ;
- erreur non capturee qui casse le rendu ;
- total revenu divergent au-dela de la tolerance sur un cas comparable ;
- contribution standard divergente au-dela de la tolerance sur un cas comparable ;
- ACRE active/inactive divergente sur un cas complet comparable ;
- necessite de modifier Facade, Adapter ou domaines.

## 7 Donnees ignorees

Ignorer explicitement :

- textes UI ;
- labels localises ;
- emojis ;
- `nextDeclarationLabel` ;
- `deadlineLabel` ;
- TVA ;
- CFE ;
- financial health ;
- annual projection ;
- reminders ;
- invoices ;
- premium triggers ;
- dashboard score ;
- recommandations et coaching textuel ;
- `smartAlerts` et `smartPriorities` comme structures UI ;
- `trace` si non activee ;
- toute donnee personnelle client ou facture.

Le Facade actuel ne couvre pas TVA, CFE, deadlines, factures, premium ou UX coaching. Ces domaines ne doivent donc pas etre utilises pour juger la parite LOT 5.6.

## 8 Logging

Politique recommandee : aucun logging permanent.

Pour LOT 5.6, deux options acceptables :

- zero logging, comparaison gardee dans une valeur locale ignoree ;
- logging dev uniquement derriere un flag local compile/runtime, desactive par defaut.

Interdit :

- `console.info` permanent ;
- `console.warn` permanent ;
- `console.error` pour divergence attendue ;
- `alert` ;
- toast ;
- affichage UI ;
- Supabase ;
- localStorage ;
- sessionStorage ;
- analytics produit ;
- payload reseau.

La comparaison doit etre completement desactivable sans toucher Revenue, Contributions ou ACRE.

## 9 Performance

Risque performance : le dashboard contient deja beaucoup de `useMemo`; ajouter un calcul Facade sur chaque variation de `revenues` et `dashboardAnswers` peut avoir un cout.

Mitigations LOT 5.6 :

- flag shadow desactive par defaut ;
- execution seulement si profil fiscal complet et donnees minimales presentes ;
- pas de `trace: true` par defaut ;
- pas de deep clone universel ;
- pas de persistence ;
- pas d'effet asynchrone ;
- pas de recalcul dans le rendu JSX ;
- dependances `useMemo` strictes.

Le shadow mode ne doit pas deplacer le cout vers l'utilisateur tant qu'il est desactive.

## 10 Rollback

Rollback immediat :

- mettre le flag shadow a `false` ;
- ou supprimer le bloc shadow de LOT 5.6 ;
- retirer les imports Adapter/Facade si presents.

Rollback interdit :

- modifier Revenue ;
- modifier Contributions ;
- modifier ACRE ;
- modifier Rules Engine ;
- modifier Adapter ;
- modifier Facade ;
- modifier persistence.

Comme le legacy continue d'alimenter l'UI, le rollback ne doit changer aucun comportement utilisateur.

## 11 Stop Conditions

LOT 5.6 doit etre NO-GO si :

- `App.jsx` doit etre refactorise avant shadow mode ;
- `calculateFiscalSummary` doit etre modifie ;
- `buildFiscalSummaryInput` doit etre modifie ;
- Revenue doit etre modifie ;
- Contributions doivent etre modifiees ;
- ACRE doit etre modifie ;
- Rules Engine doit etre modifie ;
- une comparaison fiable du slice choisi est impossible ;
- le slice ne peut pas etre isole ;
- une date implicite doit etre ajoutee hors point explicitement controle ;
- un resultat Facade doit etre affiche pour tester ;
- localStorage ou Supabase doivent enregistrer les ecarts ;
- le shadow mode ne peut pas etre desactive proprement ;
- un ecart bloque le rendu dashboard.

## 12 Premier Slice recommande

Candidats analyses :

- assistant message : risque visible, utilise `buildFiscalSummary` et `buildFiscalChecklist`, donc non recommande ;
- dashboard : meilleure disponibilite des donnees sources, mais surface visible a ne pas modifier ;
- summary/export texte : visible et declenche fichier utilisateur, non recommande ;
- simulator/preview revenu : flux ponctuel avec calculs de preview tres differents du Facade actuel, non recommande ;
- dashboard shadow interne : recommande.

Slice unique recommande pour LOT 5.6 :

```text
Dashboard fiscal shadow interne, non visible, autour du calcul legacy `computed`.
```

Justification :

- donnees sources deja centralisees ;
- Facade summary comparable sur revenue/contributions/ACRE ;
- legacy peut rester intact ;
- aucune UI ne doit changer ;
- rollback simple ;
- performance maitrisable par flag off.

## 13 Perimetre LOT 5.6

Perimetre propose :

- ajouter les imports locaux strictement necessaires dans `App.jsx` ;
- ajouter un flag shadow desactive par defaut ;
- construire un DTO applicatif reduit pour l'adapter ;
- appeler `buildFiscalSummaryInput` seulement dans le bloc shadow ;
- appeler `calculateFiscalSummary` seulement dans le bloc shadow ;
- comparer un snapshot minimal legacy/facade ;
- capturer les erreurs shadow sans casser l'UI ;
- ne rien afficher ;
- ne rien persister ;
- documenter les resultats dans un rapport LOT 5.6 ;
- ajouter des tests uniquement si le brief LOT 5.6 les autorise.

Hors perimetre LOT 5.6 :

- remplacement de `computed` ;
- modification de `estimatedCharges` ;
- modification des cards dashboard ;
- modification assistant, export, simulator ou preview ;
- modification Adapter, Facade, Revenue, Contributions, ACRE, Rules Engine ;
- logging permanent ;
- persistence des divergences.

## 14 GO / NO-GO

GO POUR LOT 5.6.

Justification : le premier slice est isolable en shadow mode interne autour du dashboard, avec legacy conservant l'UI, Facade appele en parallele, comparaison locale des seules valeurs comparables, et rollback par desactivation du flag ou suppression du bloc shadow.

Conditions obligatoires :

- aucun resultat Facade visible ;
- aucun changement persistence ;
- aucun changement Supabase ;
- aucun changement localStorage ;
- aucun changement Adapter ;
- aucun changement Facade ;
- aucun changement Domain ;
- aucun remplacement du legacy ;
- aucune console permanente ;
- comparaison completement desactivable.
