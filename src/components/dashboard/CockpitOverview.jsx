import './CockpitOverview.css';

// Presentation only: the parent supplies existing values, priority and handlers.
export default function CockpitOverview({ title, account, storage, children, recommendation,
  revenue, reserve, available, provisional, estimateNote, missingFields, onEditProfile,
  onAddRevenue, onCreateInvoice, onCreateAccount, workspace, insights, reserveValue, availableValue }) {
  const comparable = [reserveValue, availableValue].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  const maximum = comparable ? Math.max(reserveValue, availableValue) : 0;
  return (
    <section className="cockpitOverview" aria-label="Vue d’ensemble du cockpit">
      <header className="cockpitHeading">
        <h2>{title}</h2>
        <div className="cockpitIdentity">
          <p>{account}</p>
          {onCreateAccount && <button className="cockpitAccountAction" type="button" onClick={onCreateAccount}>Créer mon compte</button>}
        </div>
        <p className="cockpitStorage">{storage}</p>
      </header>

      <div className="cockpitComposition">
      <nav className="cockpitActions" aria-label="Actions rapides">
        <button type="button" onClick={onAddRevenue}>Ajouter un revenu</button>
        <button type="button" onClick={onCreateInvoice}>Créer une facture</button>
      </nav>
      <aside className="cockpitResults" aria-label="Résultats et prochaine action">
      <section className="cockpitNow" aria-labelledby="cockpit-now-title">
        <h3 id="cockpit-now-title">À faire maintenant</h3>
        {children || (recommendation ? <>
          <h4>{recommendation.title}</h4>
          <p>{recommendation.text}</p>
          <button className="cockpitPrimary" type="button" onClick={recommendation.onClick}>{recommendation.cta}</button>
        </> : <p>Aucune recommandation disponible pour le moment. Les détails restent accessibles ci-dessous.</p>)}
      </section>

      <section className="cockpitMarkers" aria-labelledby="cockpit-markers-title">
        <h3 id="cockpit-markers-title">Mes repères</h3>
        <dl>
          <div><dt>{provisional ? 'CA estimé' : 'Revenus cumulés'}</dt><dd data-testid="cockpit-revenue">{revenue}</dd></div>
          <div><dt>Réserve estimée</dt><dd data-testid="cockpit-reserve">{reserve}</dd>{maximum > 0 && <div className="cockpitAllocation" aria-hidden="true"><span style={{width: `${reserveValue / maximum * 100}%`}} /></div>}</div>
          <div><dt>Disponible estimé</dt><dd data-testid="cockpit-available">{available}</dd>{maximum > 0 && <div className="cockpitAllocation isAvailable" aria-hidden="true"><span style={{width: `${availableValue / maximum * 100}%`}} /></div>}</div>
        </dl>
        <p className="cockpitEstimateNote">{estimateNote}</p>
      </section>
      </aside>

      <div className="cockpitWorkspace">
      {missingFields.length > 0 && <section className="cockpitProfile" aria-labelledby="cockpit-profile-title">
        <h3 id="cockpit-profile-title">Mon profil fiscal</h3>
        <p>Informations à compléter : {missingFields.join(', ')}.</p>
        <button type="button" onClick={onEditProfile}>Compléter mon profil fiscal</button>
      </section>}
      {workspace}
      </div>
      <div className="cockpitInsights">{insights}</div>
      </div>
    </section>
  );
}
