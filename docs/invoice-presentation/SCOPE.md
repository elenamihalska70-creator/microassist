# Présentation de Factures

Baseline : `df3e14d1b1b3231bb0085ddacab1c42b03783122`, branche `main`.

Avant modification : en-tête et deux accès génériques de création, explications PDF/XML et plateforme, avertissement de revenu sans facture, notice locale, sauvegarde/restauration, résultat de création, demande de retour, puis liste ou état vide. Les cartes répètent certains statuts et l'explication générale de l'indicateur de complétude.

Après : en-tête avec un accès de création et une indication courte de stockage ; avertissement de revenu sans facture, notice et résultat visibles ; cartes ou état vide ; zone JSON compacte ; explications repliables ; demande de retour en dernier. Le contrôle existant Voir tout/Réduire conserve son état et son callback. Les badges de paiement, de complétude, de provenance locale et de brouillon Factur-X, les valeurs de score et leurs alertes restent dans les cartes. Les doublons purement textuels de statut PDF/Factur-X et l'explication générale de l'indicateur sont retirés des métadonnées répétées, avec les badges visibles et l'explication commune conservés.

L'en-tête conserve `handleOpenInvoiceGenerator`, l'avertissement particulier conserve `handleOpenInvoiceFromLatestRevenue`. Les clés React restent qualifiées par provenance, le paiement utilise toujours `(invoice, origin)`, PDF et XML gardent leurs composants/callbacks distincts. Aucun champ enregistré n'est modifié.

Les détails utilisent les éléments natifs `details`/`summary` : clavier et focus natifs, contenu fermé absent de la navigation clavier. La zone JSON reste montée ; seules ses explications se replient. Ses boutons, erreurs, annonces, lecture, aperçu, confirmation et résultat sont tous hors des détails. Aucun ajout de hook ou modification des gestionnaires de sauvegarde/restauration. L'explication de confidentialité du fichier client reste visible.

La notice `LocalInvoiceStatus` et sa réconciliation inter-onglets restent intactes, y compris pour source vide, invalide ou inaccessible. Les alertes de complétude nécessitant une action restent dans les cartes, et l'avertissement de revenu sans facture n'est pas replié.

Styles limités à `#invoices-section`, palette du cockpit : crème `#F7F4EE`, vert `#065640`, titres Georgia, CTA orange foncé `#A95000` avec texte blanc (contraste contrôlé ≥ 4,5:1). Aucun changement global `.btn` ou `.card`, du cockpit, de Mon accès, du site vitrine, des calculs ou des mécanismes de données.

Validation comparative : source absente/liste vide, classiques + Factur-X Unicode, ancienne facture locale sans `localOnly`, collision d'identifiants entre collections, stockage invalide/inaccessible, et avertissement de revenu sans facture. Comparaison des valeurs, badges, alertes, actions et sources brutes avant/après ; captures à 1440/390/320 px. Les comportements métier sont aussi couverts par les suites existantes de sauvegarde/restauration, provenance/paiement, PDF/XML et barre globale, avec services externes simulés. Les PATCH de paiement distant ne sont que des réponses interceptées ; aucune écriture distante réelle ne doit être déduite de ces tests.
