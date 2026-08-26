// LOT 10.2E.1: the first visible VNext dashboard component. Purely
// presentational -- receives an already-built view-model (see
// buildPriorityCardViewModel.js) plus a handful of existing callback props
// it does not own. It never talks to Supabase, never computes a date or an
// eligibility rule, and never opens a second declaration-confirmation flow:
// onConfirmDeclaration/onConfirmPayment are the exact same handlers the
// legacy "Ma déclaration" section already uses (LOT 10.2D/10.2D.1).

function resolveCta(cta, { onConfirmDeclaration, onConfirmPayment, onEditProfile, isSavingPayment }) {
  if (!cta) return null;

  if (cta.kind === "official_link") {
    return { as: "a", label: cta.label, href: cta.href, disabled: false };
  }
  if (cta.kind === "confirm_declaration") {
    return { as: "button", label: cta.label, onClick: onConfirmDeclaration, disabled: false };
  }
  if (cta.kind === "confirm_payment") {
    return {
      as: "button",
      label: isSavingPayment ? "Enregistrement..." : cta.label,
      onClick: onConfirmPayment,
      disabled: isSavingPayment,
    };
  }
  if (cta.kind === "edit_profile") {
    return { as: "button", label: cta.label, onClick: onEditProfile, disabled: false };
  }
  return null;
}

export default function PriorityCard({
  viewModel,
  isSavingPayment = false,
  onConfirmDeclaration,
  onConfirmPayment,
  onEditProfile,
  onViewDetail,
}) {
  if (!viewModel) return null;

  const { severity, badgeLabel, icon, title, explanation, dateLabel, showDetailLink } = viewModel;
  const handlers = { onConfirmDeclaration, onConfirmPayment, onEditProfile, isSavingPayment };
  const primary = resolveCta(viewModel.primaryCta, handlers);
  const secondary = resolveCta(viewModel.secondaryCta, handlers);
  const hasActions = Boolean(primary || secondary || (showDetailLink && onViewDetail));

  return (
    <section className={`priorityCard priorityCard--${severity}`} aria-labelledby="priorityCardTitle">
      <div className="priorityCardStatus">
        <span className="priorityCardIcon" aria-hidden="true">
          {icon}
        </span>
        <span className="priorityCardBadge">{badgeLabel}</span>
      </div>

      <h2 id="priorityCardTitle" className="priorityCardTitle">
        {title}
      </h2>
      <p className="priorityCardExplanation">{explanation}</p>

      {dateLabel && (
        <p className="priorityCardDate">
          <span className="priorityCardDateLabel">Échéance</span> {dateLabel}
        </p>
      )}

      {hasActions && (
        <div className="priorityCardActions">
          {primary &&
            (primary.as === "a" ? (
              <a
                className="btn btnActionPrimary"
                href={primary.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {primary.label}
              </a>
            ) : (
              <button
                type="button"
                className="btn btnActionPrimary"
                onClick={primary.onClick}
                disabled={primary.disabled}
              >
                {primary.label}
              </button>
            ))}

          {secondary && (
            <button
              type="button"
              className="btn btnActionSecondary"
              onClick={secondary.onClick}
              disabled={secondary.disabled}
            >
              {secondary.label}
            </button>
          )}

          {showDetailLink && onViewDetail && (
            <button type="button" className="btn btnGhost priorityCardDetailLink" onClick={onViewDetail}>
              Voir le détail
            </button>
          )}
        </div>
      )}
    </section>
  );
}
