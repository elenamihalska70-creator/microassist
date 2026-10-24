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
