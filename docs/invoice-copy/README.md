# Clarification des factures — revue locale

Baseline : `99103b85d65b59676cba259e36c792c0522d07ee`. Aucun push ni déploiement pour ce LOT.

## Contrat préservé

- La mention « Enregistrée dans ce navigateur » dépend de la provenance `origin === "local"`, y compris sans `localOnly`. Un ancien champ `localOnly` sur une facture distante ne lui attribue pas cette mention.
- Les messages distinguent profil/revenus synchronisables et nouvelles factures locales, même après connexion. Le transfert manuel passe par sauvegarde/restauration JSON.
- PDF et brouillon XML sont séparés. Le téléchargement est décrit comme déclenché, sans garantie de sauvegarde sur disque. Aucune certification fiscale, Factur-X/PDF/A-3 ou transmission disponible n'est revendiquée.
- L'indicateur de complétude conserve calcul, scores et statuts techniques (`conforme`, etc.). Seuls les libellés et alertes présentés changent. Le SIRET seul ne vaut pas validation fiscale.
- La note historique `FACTURX_NOT_TRANSMITTED_NOTE` reste réservée au XML et inchangée. La nouvelle note `INVOICE_DOCUMENTS_NOTE` sert aux interfaces et PDF. `xml-baseline.sha256` provient du XML de la fixture Factur-X synthétique `docs/local-invoice-backup/examples/valid.json`, généré avec le module exact du baseline ; le candidat doit produire les mêmes octets.
- Aucun objet stocké, mécanisme de stockage, paiement, provenance, gate INSERT, migration, calcul fiscal ou contrat XML n'est modifié.

## Référence visuelle observée

Source consultée en navigateur : https://microassist.digitallab.studio/ (HTTP 200), avec captures desktop/mobile et styles calculés.

| Élément | Observation réelle |
| --- | --- |
| Fond | `#F7F4EE` |
| Texte / vert | Texte `#17120D` ; vert `#065640` observé notamment sur les actions secondaires |
| CTA principal | Orange `#DC7C00`, texte blanc, rayon 7 px, padding horizontal 17 px |
| Typographie | Titres Georgia/Times ; corps `MicroAssistPreserved, Arial, Helvetica, sans-serif`, 16 px / 24 px |
| Titres | H1 environ 53 px / 60 px ; H2 34 px / 39 px à la taille observée |
| Cartes | Cadre 1 px `#DED8CB`, rayon 8 px, padding 22 px ; ombres absentes ou discrètes sur les cartes observées |
| Sections | Une section observée : padding vertical 96 px ; aucun de ces styles n'est copié dans l'application |

Écarts à traiter dans un LOT visuel ultérieur :

1. Titres de l'application en system-ui, sans la hiérarchie éditoriale Georgia de la référence.
2. Palette hétérogène : gris froids/violet dans l'application et le PDF, au lieu du couple crème/vert/orange de la référence.
3. Cartes Factures à rayon 18 px, padding 15/16 px et ombre, contre 8 px et 22 px sur les cartes de référence.
4. Boutons et espacements variables ; aligner ensuite les tokens sans importer le CSS marketing en bloc.
5. Les superpositions globales existantes (barre d'action fixe, notices) restent à examiner séparément ; elles ne sont pas remaniées ici.

## Ajustement responsive autorisé

Mesure à 390 px avec les mêmes deux factures synthétiques : le baseline produit un document large de 682 px et les nouveaux textes, sans ajustement, de 822 px. La rangée de badges/actions est déjà en `nowrap` au baseline. Le seul ajustement autorisé par l'utilisateur est `flexWrap: "wrap"` sur la rangée d'actions des factures ; il ramène le document à 390 px, sans changement de couleurs, polices, espacements ni structure. Aucun CSS général ou token visuel n'est modifié.

## Validation

Les résultats bruts et captures sont livrés dans le paquet de revue final. Les services externes des tests navigateur sont interceptés, les données sont synthétiques. Les assertions fonctionnelles existantes sont conservées ; les attentes textuelles sont adaptées aux nouveaux libellés.

Le contrôle PDF extrait le texte Unicode, vérifie les fontes incorporées, les limites de page, l'absence de chevauchement de tous les segments, la pagination et le XML inchangé. Il ne certifie pas un format fiscal ou PDF/A-3. Le parcours Expert conserve ses styles existants ; la note PDF y est simplement mise à la ligne.

Résultats exécutés le 25 octobre 2026, dans des copies isolées du baseline et du candidat :

- Tests Node complets : baseline 1791/1793 ; candidat 1795/1797. Les deux mêmes échecs historiques concernent `reminder-retry-wiring.test.js:75` et `reminder-scheduler-heartbeat-wiring.test.js:38`. Aucune nouvelle régression ; quatre nouveaux tests passent.
- Tests navigateur ciblés : 36/36 (textes/provenance invité et connecté, sauvegarde/restauration, sécurité client, téléchargements PDF/XML). Aucun INSERT facture ; paiements local/distant séparés et aucune exception JavaScript dans les nouveaux scénarios.
- Contrôles PDF : 5/5 ; quatre PDF synthétiques actuels, plus reproduction du défaut historique. Texte Unicode, géométrie et pagination vérifiés, rendu court et dernière page longue inspectés visuellement. Le téléchargement Expert n'a pas été testé indépendamment en navigateur.
- `npm run build` : succès. Lint baseline et candidat : 21 erreurs / 29 avertissements, mêmes diagnostics après normalisation des chemins et numéros de lignes.
- `git diff --check` : succès. XML synthétique identique au baseline (SHA-256 documenté).

Limite visuelle conservée : la barre globale fixe « Ajoute ton premier revenu » peut recouvrir une bande du contenu ou du pied de formulaire. Ce comportement préexistant est visible dans les captures ; seule la rangée Factures a été autorisée à revenir à la ligne.
