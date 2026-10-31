import BrandMark from '../components/BrandMark.jsx';

export default function MainNavigation({
  activeSection,
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
  const itemProps = (section) => ({
    className: activeSection === section ? "navLink isCurrent" : "navLink",
    "aria-current": activeSection === section ? "location" : undefined,
  });
  return (
    <header className="topbar">
      <div className="appStatusBar">
        <span className="appStatusBadge">{viewLabel}</span>
      </div>
      <div className="topbarLeft">
        <div className="brand"><BrandMark /></div>
        <div className="topbarMeta">
          <div className="greetingBadge">{topbarGreetingLabel}</div>
          {profileLine && <div className="profileMini">{profileLine}</div>}
          {connectedAccountLabel && (
            <div className="profileMini">Connectée : {connectedAccountLabel}</div>
          )}
        </div>
      </div>

      <div className="topbarRight">
        <nav className="nav" aria-label="Navigation principale">
          <button type="button" {...itemProps("home")} onClick={onGoToLandingHome}>
            Accueil
          </button>
          <button
            type="button"
            {...itemProps("services")}
            onClick={onGoToLandingServices}
          >
            Services
          </button>
          <button type="button" {...itemProps("assistant")} onClick={onGoToAssistant}>
            Assistant
          </button>
          <button type="button" {...itemProps("fiscal")} onClick={onGoToDashboard}>
            Mon espace fiscal
          </button>
          <button type="button" {...itemProps("invoices")} onClick={onGoToInvoices}>
            Factures
          </button>

          <button
            type="button"
            {...itemProps("pricing")}
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
