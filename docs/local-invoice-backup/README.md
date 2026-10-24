# Sauvegarde des factures de cet appareil — version 1

Tout reste dans `guest_invoices`, connecté ou invité. Aucun accès aux factures distantes, revenus, sessions ou autres clés ; aucune requête métier distante. Les téléchargements PDF/XML, le paiement et les contrats existants restent inchangés.

## Fichier et limites

Enveloppe JSON : `format: "microassist.local-invoices"`, `version: 1`, `exportedAt` (horodatage ISO UTC), `invoices` (tableau). Les autres formats, versions et propriétés d’enveloppe sont refusés. Limites : 5 Mio UTF-8 pour le fichier et le stockage résultant, 1 000 factures au total. Par facture : profondeur 8, 5 000 valeurs, chaînes de 20 000 caractères UTF-16, clés de 128 caractères, tableaux internes de 1 000 éléments, 100 lignes de facture.

Les factures sont des objets JSON. Parties et totaux sont des objets, lignes des objets en tableau. Les champs connus conservent leur type : textes, booléens, montants/quantités numériques finis, non négatifs et au plus Number.MAX_SAFE_INTEGER ; dates calendaires YYYY-MM-DD et horodatages interprétables. Le statut de paiement, si présent, est draft, unpaid ou paid. Les champs absents ou null et les extensions JSON compatibles sont conservés, sans conversion ni normalisation. Les clés dangereuses (__proto__, prototype, constructor) et les clés contenant token, session, password, secret, credential, authorization, api.?key ou jwt sont refusées à toute profondeur. Aucun rendu HTML ni fusion d’objets importés.

L’export lit directement la source, sans écriture. Une source inaccessible, invalide, excessive ou vide provoque une erreur sans téléchargement. Les entrées historiques sans identifiant sont conservées dans l’export ; elles seront signalées comme non restaurables, sans identité inventée. Une source actuelle invalide bloque aussi toute restauration, sans écrasement.

## Restauration et identités

La lecture et l’aperçu n’écrivent rien. Une confirmation explicite ajoute seulement les entrées admissibles ; doublons, conflits et refus sont comptés séparément. Les autres entrées valides peuvent être restaurées malgré ces refus. Les détails affichés sont limités à 20 ajouts et 50 problèmes, les compteurs portent sur tout le fichier.

Identifiant exploitable : chaîne non vide, sans espaces aux extrémités ni caractères de contrôle, de 256 caractères maximum ; ou entier historique strictement positif et sûr. L’identifiant stocké reste inchangé. Pour le rapprochement conservateur, le nombre 42 et la chaîne "42" désignent le même groupe ; leurs contenus différents sont un conflit. Le numéro de facture ne sert jamais d’identité.

L’égalité compare tout le contenu JSON, indépendamment de l’ordre des propriétés, en conservant l’ordre des tableaux. Même identité et même contenu : doublon ignoré. Même identité et contenu différent, dans le fichier ou face au stockage : tout le groupe est en conflit, aucune entrée de ce groupe n’est ajoutée. Si une entrée refusée possède cette identité, les autres entrées de ce groupe sont également bloquées. Les factures existantes ne sont jamais remplacées. Une seconde restauration identique n’ajoute rien.

Une attribution de compte non nulle (`user_id` ou `userId`) dans une entrée importée est refusée ; elle n’est ni supprimée ni réattribuée. Aucun identifiant, statut de synchronisation ou autre champ n’est ajouté automatiquement. Les champs compatibles, notamment paid_at et les données Factur-X, sont conservés tels quels. Aucune correction des données stockées n’est faite pour rendre une entrée compatible.

## Écriture et limites de concurrence

À la confirmation, le stockage est relu et validé. Tout changement de sa chaîne brute depuis l’aperçu recalcule celui-ci et impose une nouvelle confirmation, sans écriture. Le succès et la mise à jour React surviennent après `localStorage.setItem` réussi. Un quota ou une erreur laisse les données antérieures intactes et permet de réessayer.

Annuler, quitter Factures ou changer de contexte d’authentification invalide les lectures en attente. Les autres onglets utilisent la réconciliation existante (événement storage, focus/pageshow) pour liste et notice. Cette vérification ne garantit pas une transaction atomique entre onglets : une écriture concurrente peut intervenir entre relecture et écriture ; éviter les restaurations simultanées.

Les exemples sont exclusivement synthétiques. Le fichier contient des informations clients : le conserver dans un endroit sûr. Ces contrôles sont structurels et ne certifient ni la validité fiscale ni Factur-X/PDF/A-3.

## Correctif de compatibilité des consommateurs (baseline 5ab6f0e)

Inventaire des lectures existantes, vérifié dans `App.jsx` (liste, filtres, paiement), `components/InvoiceGenerator.jsx` (PDF), `utils/facturx.js` (conformité, calculs, XML), et `components/LocalInvoiceBackup.jsx` (aperçu). Aucun de ces consommateurs n'est modifié par le correctif.

| Emplacement | Champs consommés | Contrat de restauration |
| --- | --- | --- |
| Facture | `id` | Identité chaîne/entier selon les règles ci-dessus ; jamais inventée |
| Facture | `invoiceNumber`, `invoice_number`, `number`, `client_name`, `client_address`, `client_email`, `description` | Chaîne si renseignée |
| Facture, anciens replis de conformité | `seller_siret`, `seller_name`, `seller_address` | Chaîne si renseignée, comme les champs des parties structurées |
| Facture | `vatExemptionReason`, `paymentTerms`, `formatStatus`, `transmissionStatus` | Chaîne si renseignée |
| Facture | `amount`, `vatRate` | Nombre fini non négatif, dans la limite existante |
| Facture | `issueDate`, `invoice_date`, `dueDate`, `due_date` | Date calendaire selon la validation existante |
| Facture | `status`, `paid_at` | Statut connu ; horodatage interprétable selon la validation existante |
| Facture | `localOnly`, `is_compliant` | Booléen si renseigné |
| `seller`, `buyer` (et `client`, alias compatible) | `name`, `address`, `email`, `siret`, `vatNumber` | Objet de partie ; propriétés textuelles si renseignées |
| `lines` | `description`, `quantity`, `unitPrice`, `vatRate`, `totalHT`, `totalTVA`, `totalTTC` | Tableau d'objets ; description textuelle, nombres selon les limites existantes |
| `totals` | `totalHT`, `totalTVA`, `totalTTC` | Objet ; nombres selon les limites existantes |
| `statuses` | Liste descriptive Factur-X conservée | Tableau de chaînes |

Les alias compatibles déjà validés restent couverts : `paidAt`, dates de création/modification, noms de montants en snake_case, `local_only`, `isCompliant`, `format_status`, `transmission_status`, `vat_mode`, `vat_exemption_reason`, `source`. Les propriétés absentes ou explicitement `null` restent conservées : les consommateurs utilisent alors leurs replis existants. Une partie, `totals`, `lines` ou `statuses` peut être absente ou `null`, mais une ligne présente doit être un objet non nul, et un élément de `statuses` une chaîne non nulle. Les objets, tableaux, booléens ou nombres ne sont pas convertis en textes pour contourner un refus.

Les extensions JSON non consommées restent intactes, y compris dans les parties et lignes. Elles ne dispensent jamais un champ consommé de son contrat : `metadata.seller_siret` peut être une extension structurée, alors que `seller_siret` à la racine doit être textuel ou nul. Les limites et clés interdites antérieures restent applicables à toute profondeur. Ce contrat ne certifie pas une facture fiscalement complète ou un document téléchargeable sans limite de glyphes.

À chaque confirmation, `previewRestore` est réexécuté sur les entrées et le stockage relu, même si la chaîne du stockage n'a pas changé. Seul le contenu recalculé peut être écrit. Une différence de stockage, de contenu à écrire, de compteurs ou de motifs impose un nouvel aperçu et une nouvelle confirmation. Les refus indiquent le chemin incompatible, par exemple `facture.seller_siret` ou `lines[0].quantity`. Aucun nettoyage ni réparation du stockage : si une entrée déjà stockée échoue à cette validation partagée, la restauration (et l'export utilisant cette même lecture) est bloquée sans écrasement.

La fixture `examples/malformed-consumer.json` contient le cas P1 exact, exclusivement synthétique. Les tests couvrent son refus sans écriture, les types/structures des champs consommés, les replis `null`, les extensions inertes, un fichier mixte, la revalidation finale et l'absence de crash après reload.
