# LOT 5.4 - Minimal Integration Adapter

Statut : implementation minimale de la frontiere App -> Calculation Facade.

## 1. Resume

LOT 5.4 cree un adapter pur qui transforme un DTO applicatif reduit en entree compatible avec `calculateFiscalSummary`.

L'adapter ne calcule aucune valeur metier, n'appelle aucun domaine, n'appelle pas le Facade, ne lit aucun state React, ne lit aucune persistence et ne cree aucune date implicite.

## 2. Source d'autorite LOT 5.3

La source d'autorite principale est `docs/LOT_5_3_INTEGRATION_ADAPTER_GATE_REVIEW.md`.

Decisions appliquees :

- adapter minimal ;
- emplacement `src/application/adapters` ;
- signature reduite ;
- entree composee de `revenues`, `fiscalProfile`, `period`, `referenceDate` ;
- sortie compatible avec le contrat d'entree du Facade ;
- aucune integration dans `App.jsx` ;
- aucun comportement visible.

## 3. Contrat implemente

Contrat implemente :

```js
buildFiscalSummaryInput({
  revenues,
  fiscalProfile,
  period,
  referenceDate,
})
```

L'adapter accepte uniquement cet objet applicatif. Un second argument est rejete explicitement, car LOT 5.3 n'a pas approuve d'options publiques pour l'adapter.

## 4. Emplacement de l'adapter

Fichiers crees :

- `src/application/adapters/buildFiscalSummaryInput.js` ;
- `src/application/adapters/index.js`.

Le placement suit la recommandation LOT 5.3 : couche applicative entre App et Domaine, hors `src/domain`, hors `src/utils` et hors `App.jsx`.

## 5. Signature publique

Signature publique :

```js
buildFiscalSummaryInput(input)
```

Export local :

```js
export { buildFiscalSummaryInput } from "./buildFiscalSummaryInput.js";
```

Aucun barrel global n'a ete modifie.

## 6. Entrees

Entree racine autorisee :

- `revenues` ;
- `fiscalProfile` ;
- `period` ;
- `referenceDate`.

Profil fiscal applicatif autorise :

- `activity_type` ;
- `acre` ;
- `acre_start_date`.

Les champs internes des revenus ne sont pas interpretes par l'adapter. Chaque entree de revenu objet est copiee superficiellement.

## 7. Sortie

Sortie produite :

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

La sortie ne contient aucun champ UI, warning, trace, resume, label, metadata persistence ou valeur derivee.

## 8. Mapping exact

Mapping applique :

| Entree adapter | Sortie Facade |
| --- | --- |
| `revenues` | `revenues` |
| `fiscalProfile.activity_type` | `fiscalProfile.activityType` |
| `fiscalProfile.acre` | `fiscalProfile.acre` |
| `fiscalProfile.acre_start_date` | `fiscalProfile.acreStartDate` |
| `period` | `period` |
| `referenceDate` | `referenceDate` |

Aucun autre mapping n'est implemente.

## 9. Validations structurelles

Validations ajoutees :

- input present et objet non tableau ;
- champs racine connus ;
- champs racine requis ;
- `revenues` tableau ;
- `fiscalProfile` objet non tableau ;
- champs `fiscalProfile` connus ;
- champs `fiscalProfile` requis ;
- `period` objet non tableau ;
- absence de second argument.

Ces validations sont structurelles et ne portent pas sur l'exactitude fiscale.

## 10. Politique d'erreur

Les erreurs sont deterministes et utilisent `TypeError`.

Cas couverts :

- entree absente ;
- entree invalide ;
- champ obligatoire absent ;
- champ inconnu ;
- second argument non autorise ;
- type structurel incompatible.

L'adapter ne masque pas les erreurs et ne retourne jamais un objet partiel.

## 11. Transformations autorisees

Transformations implementees :

- extraction de proprietes ;
- renommage snake_case vers camelCase ;
- assemblage du DTO Facade ;
- copie superficielle de `period` ;
- copie du tableau `revenues` ;
- copie superficielle des entrees revenus objets ;
- selection explicite des champs `fiscalProfile`.

## 12. Transformations exclues

Transformations exclues :

- calcul Revenue ;
- calcul Contributions ;
- calcul ACRE ;
- total ;
- taux ;
- coefficient ;
- pourcentage ;
- arrondi ;
- eligibilite ;
- selection fiscale de periode ;
- fallback vers zero ;
- fallback d'activite ;
- correction de categorie ;
- formatage UI.

## 13. Immutabilite

L'adapter ne mute pas :

- l'objet d'entree ;
- le tableau `revenues` ;
- les entrees de revenus objets ;
- le profil fiscal source ;
- la periode source.

La sortie est un nouvel objet et les conteneurs mappes sont reconstruits.

## 14. Determinisme

Pour une meme entree, l'adapter retourne la meme structure.

Il ne depend pas :

- de l'heure ;
- de la date courante ;
- de React ;
- de la persistence ;
- du reseau ;
- du navigateur ;
- de la locale ;
- du hasard.

## 15. Dates

Toutes les dates restent injectees.

L'adapter transmet `referenceDate` tel que recu. Il ne cree aucune date, ne deduit aucune annee, aucun mois et aucun trimestre.

## 16. Persistence

Aucun acces persistence n'a ete ajoute.

L'adapter n'utilise pas :

- Supabase ;
- `localStorage` ;
- `sessionStorage` ;
- IndexedDB ;
- cookies ;
- API ;
- reseau ;
- fichier runtime.

## 17. React et UI

L'adapter est independant de React.

Il n'utilise aucun hook, aucun JSX, aucun composant, aucun handler, aucun `window` et aucun `document`.

## 18. Architectural Guard

Un test statique dedie inspecte `src/application/adapters/buildFiscalSummaryInput.js`.

Il ignore imports, commentaires et chaines, puis verifie l'absence de :

- `Math.round`, `Math.floor`, `Math.ceil` ;
- `Date.now`, `new Date` ;
- `getContributionRule` ;
- `calculateFiscalSummary` ;
- fonctions de calcul Revenue, Contributions et ACRE ;
- `parseFloat`, `parseInt`, `Number` ;
- `switch` ;
- fallbacks `|| 0` et `?? 0` ;
- conditions directes sur `activity_type` ou `activityType`.

## 19. Tests

Fichier de test cree :

- `tests/fiscal-summary-input-adapter.test.js`.

Couverture :

- mapping nominal complet ;
- mapping minimal valide ;
- structure exacte de sortie ;
- absence de champs supplementaires ;
- renommage exact ;
- absence d'options ;
- rejet d'options ;
- entree absente ;
- entree non objet ;
- champ obligatoire absent ;
- champ inconnu ;
- type structurel invalide ;
- copies de conteneurs ;
- immutabilite entree et options tentees ;
- determinisme ;
- absence de date implicite ;
- absence de persistence ;
- absence de React/UI ;
- compatibilite structurelle Facade ;
- securite face aux noms `__proto__` ;
- guard architectural.

## 20. Resultats de validation

Validations executees :

- `node --test tests/fiscal-summary-input-adapter.test.js` : OK, 24 tests passes ;
- `node --test tests/fiscal-summary.test.js` : OK, 21 tests passes ;
- `node --test tests/legacy-acre-contribution.test.js` : OK, 22 tests passes ;
- `node --test tests/contribution-aggregations.test.js` : OK, 16 tests passes ;
- `node --test tests/standard-contribution.test.js` : OK, 16 tests passes ;
- `node --test tests/revenue-periods.test.js` : OK, 21 tests passes ;
- `node --test tests/revenue-foundations.test.js` : OK, 14 tests passes ;
- `node --test tests/calculation-primitives.test.js` : OK, 17 tests passes ;
- `node --test tests/domain-models.test.js` : OK, 14 tests passes ;
- `node --test tests/rules-engine.test.js` : OK, 15 tests passes ;
- `npm run build` : OK, avec warning Vite preexistant de chunk > 500 kB ;
- `npm run lint` : ECHEC sur dette preexistante hors perimetre ;
- `npx eslint src/application/adapters/buildFiscalSummaryInput.js src/application/adapters/index.js tests/fiscal-summary-input-adapter.test.js` : OK ;
- `npx playwright test --reporter=line` : OK, 11 tests passes.

Le premier lancement sandbox de `node --test tests/fiscal-summary-input-adapter.test.js` a echoue sur `spawn EPERM`; la meme commande relancee hors sandbox a reussi.

Dette lint globale hors perimetre :

- `src/App.jsx` : erreurs `no-unused-vars` et warnings `react-hooks/exhaustive-deps` deja hors scope ;
- `src/components/InvoiceGenerator.jsx` : erreur `react-refresh/only-export-components` hors scope ;
- `src/context/AuthContext.jsx` : erreur `react-refresh/only-export-components` hors scope.

Les fichiers LOT 5.4 passent le lint cible.

## 21. Fichiers crees

- `src/application/adapters/buildFiscalSummaryInput.js` ;
- `src/application/adapters/index.js` ;
- `tests/fiscal-summary-input-adapter.test.js` ;
- `docs/LOT_5_4_MINIMAL_INTEGRATION_ADAPTER_REPORT.md`.

## 22. Fichiers modifies

Aucun fichier existant n'a ete modifie pour LOT 5.4.

## 23. Ecarts eventuels avec LOT 5.3

Aucun ecart bloquant avec LOT 5.3.

Clarification : le brief LOT 5.4 mentionne des tests d'options si compatibles. LOT 5.3 approuve une signature reduite sans options ; LOT 5.4 rejette donc tout second argument au lieu d'inventer une API non validee.

## 24. Limites

Limites volontaires :

- aucune integration App ;
- aucun shadow mode ;
- aucun appel au Facade ;
- aucune comparaison legacy ;
- aucune parite fiscale declaree ;
- aucun support de source persistence directe ;
- aucun mapping large depuis App State complet.

## 25. Risques

Risques residuels :

- divergence future entre formes App et adapter si App evolue sans contrat ;
- besoin de clarifier la periode exacte avant shadow mode ;
- besoin de clarifier la source de profil prioritaire avant integration visible ;
- dette lint globale preexistante pouvant masquer de nouveaux signaux.

## 26. Rollback

Rollback LOT 5.4 :

- supprimer `src/application/adapters/buildFiscalSummaryInput.js` ;
- supprimer `src/application/adapters/index.js` ;
- supprimer `tests/fiscal-summary-input-adapter.test.js` ;
- supprimer `docs/LOT_5_4_MINIMAL_INTEGRATION_ADAPTER_REPORT.md`.

Aucun rollback App, Facade, Domaine ou persistence n'est necessaire.

## 27. Perimetre propose de LOT 5.5

Perimetre propose :

- integration shadow mode non visible ;
- appel explicite de l'adapter puis du Facade depuis une zone applicative controlee ;
- capture non bloquante des erreurs shadow ;
- aucune modification d'affichage ;
- aucune substitution de `computeObligations` ;
- comparaison structurelle limitee, documentee, sans effet utilisateur.

## 28. GO / NO-GO LOT 5.5

GO POUR LOT 5.5, sous conditions :

- conserver l'integration invisible ;
- injecter explicitement `referenceDate` ;
- ne pas lire la persistence depuis l'adapter ;
- ne pas modifier les calculs legacy ;
- ne pas afficher le resultat Facade ;
- documenter toute divergence de parite.
