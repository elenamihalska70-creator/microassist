export default function MainNavigation({
  appView,
  connectedAccountLabel,
  feedbackFormUrl,
  isLocalhostQa,
  localPremiumStatus,
  logoutPending,
  onGoToAssistant,
  onGoToDashboard,
  onGoToInvoices,
  onGoToLandingHome,
  onGoToLandingServices,
  onGoToPricing,
  onLogout,
  onToggleLocalPremiumQa,
  profileLine,
  topbarGreetingLabel,
  user,
  viewLabel,
}) {
  return (
    <header className="topbar">
      <div className="appStatusBar">
        <span className="appStatusBadge">{viewLabel}</span>
      </div>
      <div className="topbarLeft">
        <div className="brand">Entrepreneurs Assistant</div>
        <div className="topbarMeta">
          <div className="greetingBadge">{topbarGreetingLabel}</div>
          {profileLine && <div className="profileMini">{profileLine}</div>}
          {connectedAccountLabel && (
            <div className="profileMini">Connectée : {connectedAccountLabel}</div>
          )}
        </div>
      </div>

      <div className="topbarRight">
        <nav className="nav">
          <button type="button" className="navLink" onClick={onGoToLandingHome}>
            Accueil
          </button>
          <button
            type="button"
            className="navLink"
            onClick={onGoToLandingServices}
          >
            Services
          </button>
          <button type="button" className="navLink" onClick={onGoToAssistant}>
            Assistant
          </button>
          <button type="button" className="navLink" onClick={onGoToDashboard}>
            Mon espace fiscal
          </button>
          <button type="button" className="navLink" onClick={onGoToInvoices}>
            Factures
          </button>

          <button
            type="button"
            className={`navButton ${appView === "pricing" ? "isActive" : ""}`}
            onClick={onGoToPricing}
          >
            Tarifs
          </button>

          <a
            className="navLink"
            href={feedbackFormUrl}
            target="_blank"
            rel="noreferrer"
          >
            Contact
          </a>
          <a
            className="navLink"
            href={feedbackFormUrl}
            target="_blank"
            rel="noreferrer"
          >
            ❓ Signaler un problème
          </a>
        </nav>

        {isLocalhostQa && (
          <button
            type="button"
            className="btn btnGhost btnSmall"
            onClick={onToggleLocalPremiumQa}
            style={{
              paddingInline: "0.8rem",
              borderRadius: 999,
              background: localPremiumStatus
                ? "rgba(255, 244, 214, 0.88)"
                : "rgba(241, 245, 249, 0.92)",
              border: localPremiumStatus
                ? "1px solid rgba(217, 168, 41, 0.24)"
                : "1px solid rgba(148, 163, 184, 0.22)",
              color: localPremiumStatus ? "#7c5a10" : "#475569",
              fontWeight: 700,
            }}
            title="Basculer le mode Premium QA en local"
          >
            🧪 Premium QA
          </button>
        )}

        {user && (
          <button
            type="button"
            className="btn btnGhost btnSmall"
            onClick={onLogout}
            disabled={logoutPending}
          >
            {logoutPending ? "Déconnexion..." : "Déconnexion"}
          </button>
        )}
      </div>
    </header>
  );
}
