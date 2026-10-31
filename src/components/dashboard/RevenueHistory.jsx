export default function RevenueHistory({ history, series, maximum, collapsed, showChart, onToggle, onHide, chartRef }) {
  return <figure className="monthlyHistory revenueHistory" aria-label="Évolution des revenus encaissés">
    <div className="journalHeader dashboardSectionHeader">
      <div className="dashboardSectionHeaderMain">
        <figcaption className="dashboardSectionTitle">Évolution des revenus encaissés</figcaption>
        <p className="dashboardSectionSubtitle">Revenus enregistrés par mois, hors factures non encaissées.</p>
      </div>
      {history.length > 0 && <button className="btn btnActionUtility btnSmall" type="button" onClick={onToggle}>{collapsed ? 'Voir tout' : 'Réduire'}</button>}
    </div>
    {history.length === 0 ? <p className="dashboardHelperText">Aucun encaissement enregistré. Les montants apparaîtront après l’ajout d’un revenu.</p> : collapsed ?
      <p className="dashboardHelperText">Le graphique et l’historique mensuel sont repliés.</p> : <>
        {showChart && series.length > 0 && <div ref={chartRef} className="revenueChartCard">
          <div className="chartHeader"><span className="muted">Jusqu’à six mois enregistrés</span><button className="iconBtn" onClick={onHide} aria-label="Masquer le graphique">✕</button></div>
          <div className="revenueChartViewport" role="region" aria-label="Graphique des encaissements, défilement horizontal si nécessaire" tabIndex={0}>
          <div className="revenueChart" aria-hidden="true">{series.map(item => <div key={`${item.year}-${item.month}`} className="chartCol">
            <span className="chartValue">{item.total.toLocaleString('fr-FR')} €</span>
            <div className="chartBar" style={{height: `${Math.max(0, item.total / maximum) * 120}px`}} />
            <span className="chartLabel">{new Date(item.year,item.month).toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})}</span>
          </div>)}</div>
          </div>
        </div>}
        <details className="revenueHistoryText" open>
          <summary>Voir les montants par mois</summary>
          <dl className="historyList">{history.map(item => <div key={`${item.year}-${item.month}`} className="historyItem">
            <dt className="historyMonth">{new Date(item.year,item.month).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</dt>
            <dd className="historyTotal">{item.total.toLocaleString('fr-FR')} €</dd>
          </div>)}</dl>
        </details>
      </>}
  </figure>;
}
