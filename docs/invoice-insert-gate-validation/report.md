# Validation isolee du gate INSERT factures

Decision: PASS PostgreSQL direct (68 notices d'assertion PASS, aucune assertion affaiblie).
Aucune activation distante autorisee. Revue independante toujours requise.
Baseline de preparation: b48534ed8d87aea52f1dd1c0a3265b00e8020533, main,
origin https://github.com/elenamihalska70-creator/microassist.git.
Worktree suivi/index propres avant ce LOT. Aucun AGENTS.md applicable trouve dans les
ancetres verifies ou les chemins du depot. Les 34 fichiers historiques et les quatre
exports de revue sont conserves dans protected-manifest.json (empreintes uniquement).

## Reproduction et preuves

Prerequis: Docker Desktop local utilisable; image deja en cache. Aucun telechargement
ou installation n'a ete effectue. Dans PowerShell, depuis la racine du depot:

```powershell
& ./docs/invoice-insert-gate-validation/run-validation.ps1
```

Le runner epingle l'image postgres@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3
avec --pull=never. Il cree un nom de conteneur unique, un reseau `none`, aucun port
publie, aucune liaison vers un repertoire hote et un PGDATA tmpfs de 256 Mio. Limites:
384 Mio de memoire et un CPU. Les SQL sont copies avec docker cp, jamais montes.
La cible est affichee et inspectee AVANT SQL: conteneur jetable, socket Unix local,
database postgres, role de test postgres. Aucune connexion/cle du projet heberge.

Version observee: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2); Docker Engine 29.6.2.
L'identite precise, les heures UTC, les empreintes avant/apres copie et le nettoyage
figurent dans results.json. execution.txt conserve les commandes et sorties SQL.
Seuls les espaces de fin de ligne du transcript sont retires. Les SQL d'entree
restent octet-identiques; .gitattributes interdit leur conversion de fins de ligne.
Les executions sont bornees par `timeout 60s` et `timeout 30s`; les sous-processus
du programme historique ont leurs propres limites. Le conteneur genere est supprime
dans finally, uniquement apres verification de son label, puis son absence est verifiee.

Les trois inputs sont des copies OCTET POUR OCTET, pas de nouvelles migrations:

| Input | Source historique | SHA-256 attendu |
|---|---|---|
| gate-proposal.sql | docs/lot-10-3b-6d-4/gate-proposal.sql | 4CF51AA8D0E484863637EB3CD09721C49B9A9D834D56DDC1F07F9027DFAA5187 |
| isolated-validation.sql | fichier ajoute par ec9b7e0973dccad85d3b67ce9768816f1e2537cd | AAD26A3CB419E54A46C5D6207E889C41E1E278B2B5C59574BE3998C2EDC50B2F |
| invoices-schema-compatibility.sql | docs/lot-10-3b-6d-2/invoices-schema-compatibility.sql | 28B48707D751BEF86744E6CF53758F90D26CE478F0220F9BDC526E937975A5EF |

Les digests sont verifies automatiquement dans run-validation.ps1 et results.json.
Les fichiers historiques ne sont pas modifies.
Le SQL exact du gate est execute par psql -f ou inclusion du fichier; il n'est jamais
remplace par une implementation simplifiee pour les essais de refus/preconditions.
Le supplement ne change aucune assertion historique.

## Matrice executee

| Scenario | Assertion attendue / preuve |
|---|---|
| Controle positif sans gate | INSERT du proprietaire autorise; supplement: payload complet, exactement une ligne RETURNING; rollback de cette ligne |
| Schema sans les deux colonnes | INSERT valide de l'ancien schema simple/bulk/upsert refuse par RLS 42501; payload nommant les colonnes absentes donne 42703 et n'est PAS compte comme preuve RLS |
| Schema avec les deux colonnes | Payload legacy complet simple/bulk/ON CONFLICT refuse avec 42501 et message RLS; pas d'ajout ni modification de lignes |
| SELECT / paiement / DELETE | SELECT uniquement du proprietaire; UPDATE exactement une ligne, champs de paiement verifies; DELETE exactement une ligne, absence verifiee; transaction ensuite annulee |
| Autre utilisateur | B ne lit pas A; UPDATE et DELETE de A par B affectent zero ligne; etat global identique ensuite |
| Roles | authenticated, anon sans sujet et anon avec sujet synthetique de controle positif; role heritant authenticated: refus; service_role BYPASSRLS: insertion permise puis annulee |
| Preconditions | RLS desactivee, role absent, role navigateur BYPASSRLS, acces au proprietaire: P0001; nom de policy deja occupe: 42710; aucun changement partiel |
| Contention | Connexion independante avec ACCESS EXCLUSIVE observe dans pg_locks; fichier exact du gate echoue avec 55P03 vers cinq secondes, avant limite externe de 12 s |
| Rollback avant commit | Supplement: event trigger synthetique leve ZX001 apres CREATE POLICY du fichier exact, avant COMMIT; fermeture du processus, catalogs/roles pertinents et toutes les lignes inchanges |
| Rollback apres tentative de retrait | Historique: retrait dans une transaction de test permet une insertion, puis ROLLBACK retablit la definition exacte et le refus |
| Etat final | Deux lignes synthetiques initiales inchangees; gate exact present; table sentinelle intacte; conteneur et stockage ephemere supprimes |

Les deux colonnes ne sont ajoutees/retirees que dans le schema SYNTHETIQUE jetable
pour exercer les deux variantes exigees. Aucun fichier de migration appliquee,
schema distant, backfill, nettoyage utilisateur ou runtime n'est modifie.

## Lecture critique des artefacts historiques

ec9b7e0 ajoute uniquement un programme pour base jetable. Il cree des roles et donne
GRANT ALL dans sa fixture: il ne doit JAMAIS etre utilise comme migration reelle.
Sa politique permissive originale et ses donnees sont des hypotheses de test, pas
une preuve des ACL ou de la RLS Production. Son auth.uid() lit un parametre de session
synthetique: aucune verification JWT ni passerelle HTTP n'est testee.

Le programme historique verifie les SQLSTATE et le texte RLS, les preconditions,
les comparaisons de catalogs, les limites BYPASSRLS et le rollback. Deux limites de
preuve sont completees ici: son rollback d'installation recreait directement la
policy au lieu d'interrompre le fichier exact; ses refus bulk/upsert apres colonnes
utilisaient des payloads reduits. Le supplement execute le fichier exact avec erreur
post-DDL et teste des payloads legacy complets. Il ajoute les nombres RETURNING et
les verifications explicites B-vers-A. Les originaux restent intacts.

Le gate lui-meme est restrictif INSERT, transactionnel et borne en attente de verrou.
Il ne refuse pas automatiquement tous les chemins possibles vers un autre role
privilegie: ses preconditions regardent les attributs directs de anon/authenticated
et leur appartenance au proprietaire, pas tous les chemins SET ROLE vers tout role
BYPASSRLS. Un inventaire complet des roles reste indispensable avant activation.
Il ne retire pas TRUNCATE, ne bloque pas les roles privilegies ni les fonctions
definer privilegiees. Il ne distingue pas provenance legacy et creation directe.
La revue independante de ces artefacts reste a faire; ce rapport ne l'accorde pas.

## Consommateurs

| Consommateur | Connaissance depuis le depot | Effet du gate / limite |
|---|---|---|
| Nouveau client standard | InvoiceGenerator.jsx:337, App.jsx:16740: creation locale/PDF/XML | Creation locale preservee; pas d'INSERT distant dans ce parcours |
| ExpertDashboard | handleCreateInvoice, clients en localStorage | Hors INSERT distant; workflow local conserve |
| Ancien bundle ce72ad9 | App.jsx historique:4440, INSERT automatique | Refuse pour roles navigateur soumis a la RLS; effets UX des anciens bundles non testes ici |
| Lecture et paiement distants | App.jsx:3896 et 9238 | SELECT/UPDATE conserves dans la fixture, contrat reel a verifier |
| Reset complet explicite | App.jsx:9542, DELETE filtre utilisateur | DELETE conserve dans la fixture; aucun reset execute |
| service_role / proprietaire / BYPASSRLS / definer privilegie | Limite explicite, service_role exerce dans la fixture | EXCLUS de la garantie du gate |
| Edge Functions du depot | Aucun writer facture identifie lors du diagnostic local | Absence de reference statique non equivalente a preuve d'absence de chemin indirect |
| Clients externes, scripts admin, consommateurs GraphQL, autres roles | INCONNUS | Inventaire bloque l'activation; ne pas supposer leur compatibilite |

## Conditions pour une future activation

1. Revue independante des hashes exacts, du runner et des resultats; approbation
   distincte pour ec9b7e0, sans supposer l'approbation de tous les commits locaux.
2. Sous une AUTRE autorisation, verifier identite du projet, schema, colonnes,
   contraintes, RLS, policies, ACL table/colonnes, graphe d'heritage et SET ROLE,
   fonctions, triggers, vues, surfaces API et consommateurs privilegies frais.
   Les snapshots locaux dates ne sont pas l'etat actuel de Production.
3. Etablir les creations distantes legitimes. Le gate refuse TOUT INSERT direct
   navigateur. Si une creation legitime depend de ce chemin, activation NO-GO
   jusqu'a une API/RPC controlee revue dans un LOT separe. Aucun flag client fiable.
4. Confirmer le client livre et l'UX des vieux bundles; rien n'est deploye ici.
5. Operateur/observateur nommes, seuils et fenetre bornes, preuves figees et hashes
   verifies avant/apres transfert; autorisation explicite du gate seul.
6. Installer le gate AVANT tout elargissement de schema. Sur erreur/55P03: fermer
   ou annuler la transaction, verifier les catalogs, ne pas poursuivre ni rejouer
   aveuglement. Sur COMMIT ambigu: verifier independamment avant toute suite.
7. Apres commit, controle metadata de la definition exacte, RLS/roles/ACL et etat
   des colonnes. Aucun test INSERT/UPDATE/DELETE ni lecture de vraies lignes autorise
   par ce LOT. Assurance HTTP reelle non demontree: arret si elle est requise.
8. Toute operation ulterieure sur les colonnes exige une autorisation distincte.

Rollback: avant commit, annuler laisse l'etat initial intact dans les essais.
Apres commit, conserver le gate lors d'un rollback applicatif. Apres elargissement
du schema, ne pas retirer le gate sans protection de remplacement revue et autorisee:
cela pourrait reactiver les imports legacy. Ne pas supprimer de lignes, dedupliquer,
effacer les sources locales ou retirer des colonnes comme rollback improvise.

## Documentation officielle consultee

- https://www.postgresql.org/docs/17/sql-createpolicy.html : policy restrictive AND,
  application de WITH CHECK a tous les candidats ON CONFLICT, policy ALL implicite.
- https://www.postgresql.org/docs/17/ddl-rowsecurity.html : heritage, proprietaire,
  BYPASSRLS, operations hors RLS.
- https://www.postgresql.org/docs/17/runtime-config-client.html : lock_timeout par
  acquisition et distinction avec statement_timeout.

Le changelog markdown Supabase a aussi ete demande; le lecteur web l'a refuse pour
type MIME non supporte. Aucun changement de fonctionnalite Supabase n'est implemente.
Cette execution PostgreSQL directe ne valide NI PostgREST, NI GraphQL, NI GoTrue,
NI Supabase heberge. Les suites client inchangees n'ont pas ete relancees.

L'export review.patch est produit apres le commit via `git show --format= --binary`.
Il reste non suivi dans ce repertoire pour representer exactement le commit sans
autoreference. Les anciens exports de revue ne sont jamais stages.
