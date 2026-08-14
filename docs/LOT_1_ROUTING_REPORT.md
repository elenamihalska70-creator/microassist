# Microassist V2 - LOT 1 Routing Shell Extraction Report

Date : 2026-07-29\
Branche : `refactor/saas-shell-v2`\
Statut d'entree : GO POUR LOT 1\
Baseline lint acceptee : 21 erreurs, 29 warnings

## 1. Objectif atteint

Objectif du LOT 1 atteint : extraction progressive du shell de navigation hors de `src/App.jsx`, sans changement volontaire de comportement visible.

Le lot a uniquement extrait :

- le cadre applicatif principal `page` ;
- le header/topbar ;
- les liens et boutons de navigation principaux ;
- l'affichage QA premium local et deconnexion dans la topbar.

Aucune logique metier, aucun calcul, aucun acces Supabase, aucune cle localStorage et aucun payload n'a ete deplace.

## 2. Architecture navigation creee

Nouvelle structure introduite :

```text
src/
  navigation/
    MainNavigation.jsx
  shell/
    AppShell.jsx
```

`App.jsx` reste l'orchestrateur principal. Les callbacks de navigation restent declares dans `App.jsx` et sont transmis par props a `MainNavigation`.

Architecture active :

- `App.jsx` decide toujours de `appView`, `focusMode`, auth, recovery, modales, dashboard et parcours.
- `AppShell` rend seulement le conteneur `.page` et le header recu.
- `MainNavigation` rend seulement la topbar et declenche les callbacks existants.

## 3. Fichiers crees

Fichiers crees par LOT 1 :

- `src/shell/AppShell.jsx`
- `src/navigation/MainNavigation.jsx`
- `docs/LOT_1_ROUTING_REPORT.md`

Fichiers deja crees avant LOT 1 et conserves :

- `docs/LOT_0_1_ROUTING_READINESS_REPORT.md`
- `tests/auth-routing.spec.js`

## 4. Fichiers modifies

Fichier modifie par LOT 1 :

- `src/App.jsx`

Modifications deja presentes avant LOT 1, non creees par ce lot :

- `playwright.config.js`
- `src/utils/obligations.js`
- `tests/home.spec.js`
- `tests/premium.spec.js`

## 5. Responsabilites retirees de App.jsx

Responsabilites retirees de `App.jsx` :

- markup du header `.topbar` ;
- markup de la barre de statut applicative ;
- markup marque/greeting/profil/connecte dans la topbar ;
- markup du menu principal : Accueil, Services, Assistant, Mon espace fiscal, Factures, Tarifs, Contact, Signaler un probleme ;
- markup du bouton Premium QA local ;
- markup du bouton Deconnexion.

Les comportements associes restent portes par les callbacks existants dans `App.jsx`.

## 6. Responsabilites restant dans App.jsx

Responsabilites volontairement conservees dans `App.jsx` :

- etat `appView`, `focusMode`, `currentPath` ;
- fonctions `goToView`, `goToDashboard`, `goToPricing`, `goToAssistant`, `goToLandingSection` ;
- scroll vers les sections ;
- auth, recovery, confirmation email, logout ;
- appels Supabase ;
- lecture/ecriture localStorage/sessionStorage ;
- calculs et donnees derivees ;
- dashboard, revenus, factures, rappels, premium, assistant, profil fiscal ;
- toutes les modales ;
- rendu conditionnel des vues actuelles.

## 7. Nouveaux composants

### `AppShell`

Responsabilite :

- rendre le conteneur `.page` ;
- inserer le header transmis ;
- rendre les enfants sans logique.

### `MainNavigation`

Responsabilite :

- afficher la topbar existante ;
- afficher les liens de navigation existants ;
- appeler les callbacks fournis par `App.jsx`.

Le composant ne contient aucun calcul fiscal, aucun appel Supabase et aucune persistence locale.

## 8. Nouveaux layouts

Layout cree :

- `AppShell`, layout principal minimal.

Aucun layout de page, dashboard, assistant, revenus, factures ou premium n'a ete cree dans ce lot.

## 9. Nouveaux providers

Aucun provider cree.

Decision :

- `NavigationProvider` n'etait pas necessaire pour ce lot ;
- ajouter un contexte aurait cree une abstraction prematuree et une nouvelle source de complexite ;
- les callbacks restent explicites en props.

## 10. Tests executes

Avant extraction :

- `npm run build` : OK ;
- `npm run lint` : KO attendu, 50 problemes, 21 erreurs, 29 warnings ;
- `npx playwright test --reporter=line` : OK, 11 tests passes.

Apres extraction :

- `npm run build` : OK ;
- `npm run lint` : KO attendu, 50 problemes, 21 erreurs, 29 warnings ;
- `npx playwright test --reporter=line` : OK, 11 tests passes.

Aucun test n'a ete ajoute dans LOT 1. Les tests LOT 0.1 couvrent deja la landing, pricing, auth, recovery, dashboard decouverte et URL inconnue.

## 11. Build

Build avant extraction :

- commande : `npm run build` ;
- resultat : OK ;
- warning Vite preexistant : chunk principal superieur a 500 kB.

Build apres extraction :

- commande : `npm run build` ;
- resultat : OK ;
- warning Vite identique dans sa nature : chunk principal superieur a 500 kB.

## 12. Lint avant/apres

Baseline officielle acceptee :

- 21 erreurs ;
- 29 warnings.

Avant LOT 1 :

- `npm run lint` : KO attendu ;
- 50 problemes ;
- 21 erreurs ;
- 29 warnings.

Apres LOT 1 :

- `npm run lint` : KO attendu ;
- 50 problemes ;
- 21 erreurs ;
- 29 warnings.

Conclusion :

- la baseline lint n'a pas augmente ;
- les nouvelles lignes de `App.jsx` ont decale les numeros de ligne ;
- aucune nouvelle famille d'erreur lint n'a ete introduite.

## 13. Rollback

Rollback LOT 1 possible sans impact donnees :

1. Retirer l'import `MainNavigation` de `src/App.jsx`.
2. Retirer l'import `AppShell` de `src/App.jsx`.
3. Replacer le markup header/topbar precedent dans `src/App.jsx`.
4. Replacer `<AppShell ...>` par `<div className="page">`.
5. Supprimer `src/navigation/MainNavigation.jsx`.
6. Supprimer `src/shell/AppShell.jsx`.
7. Supprimer `docs/LOT_1_ROUTING_REPORT.md` si le rapport doit etre retire.

Aucune action Supabase, migration locale ou nettoyage de donnees n'est necessaire.

## 14. Risques

Risques residuels :

- `App.jsx` reste tres volumineux et porte encore la majorite de l'orchestration ;
- les callbacks de navigation restent dans `App.jsx`, donc le routing n'est pas encore un module autonome ;
- la navigation Factures utilise encore le scroll DOM existant vers `#invoices-section` ;
- la baseline lint reste rouge par decision officielle ;
- les tests Playwright couvrent les parcours principaux mais pas chaque clic de topbar en isolation.

Risques evites :

- aucun deplacement de logique metier ;
- aucun changement de calcul ;
- aucun changement Supabase ;
- aucune modification des cles localStorage/sessionStorage ;
- aucun redesign ;
- aucune suppression de comportement.

## 15. GO / NO-GO LOT 2

Decision proposee :

**GO POUR LOT 2**

Justification :

- build OK ;
- tests Playwright OK, 11/11 ;
- baseline lint respectee : 21 erreurs, 29 warnings avant et apres ;
- extraction limitee au shell/navigation ;
- comportement visible conserve ;
- rollback simple et localise ;
- aucune logique metier, Supabase, localStorage ou calcul n'a ete deplace.

Taille `App.jsx` :

- avant LOT 1 : 16 304 lignes, 558 696 octets ;
- apres LOT 1 : 16 219 lignes, 556 097 octets.
