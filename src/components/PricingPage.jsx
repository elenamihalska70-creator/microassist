export default function PricingPage({ onClose, onTryWithoutAccount }) {
  return (
    <div className="pricingPage pricingBetaPage">
      <div className="pricingHeader">
        <div>
          <span className="pricingBetaBadge">MVP en test</span>
          <h1>Microassist est en phase de test</h1>
        </div>

        {onClose && (
          <button className="closeButton" onClick={onClose} aria-label="Fermer">
            x
          </button>
        )}
      </div>

      <section className="pricingBetaCard">
        <p>
          Je travaille actuellement sur une version stable et accessible du
          produit.
        </p>

        <div className="pricingBetaBlock">
          <h2>Certaines parties sont encore en cours d’amélioration :</h2>
          <ul>
            <li>précision des estimations</li>
            <li>rappels</li>
            <li>infrastructure technique.</li>
          </ul>
        </div>

        <div className="pricingBetaBlock pricingBetaAccess">
          <h2>Pendant cette phase :</h2>
          <ul>
            <li>✔ accès libre pour tester</li>
            <li>✔ la majorité des fonctionnalités disponibles</li>
            <li>✔ aucun paiement demandé</li>
          </ul>
        </div>

        <p>
          Les conditions évolueront progressivement, avec l’objectif de rester
          simple et accessible.
        </p>

        <div className="pricingBetaActions">
          <button
            className="btn btnPrimary"
            onClick={() => onTryWithoutAccount?.()}
            type="button"
          >
            Accéder à Microassist
          </button>
        </div>
      </section>
    </div>
  );
}
