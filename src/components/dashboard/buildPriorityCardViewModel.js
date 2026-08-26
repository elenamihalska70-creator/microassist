import { parseLocalDate } from "../../domain/calculations/dates.js";
import { ACTION_TYPE, OBLIGATION_STATUS } from "../../domain/obligations/constants.js";
import { getOfficialAction } from "../../domain/obligations/officialActionRegistry.js";

// LOT 10.2E.1: the one place the canonical getPrioritizedActions() output
// is translated into calm, beginner-French copy for <PriorityCard/>.
//
// Pure and React-free by design -- src/domain/obligations/actionObject.js
// is explicit that its layer carries "no JSX, CSS classes, modal state, or
// presentation copy"; that copy lives HERE instead, next to the one
// component that consumes it, not inside the domain layer. This function
// never recalculates a date, an amount, or an eligibility rule -- every
// fact it renders already exists on the canonical action object passed in.

function formatFrenchDate(dateInput) {
  const date = parseLocalDate(dateInput);
  if (!date) return null;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function missingFieldExplanation(field) {
  switch (field) {
    case "activity_type":
      return "On a besoin de connaître ton type d'activité pour calculer tes cotisations.";
    case "declaration_frequency":
      return "On a besoin de savoir à quelle fréquence tu déclares (mensuelle ou trimestrielle).";
    case "business_start_date":
      return "On a besoin de ta date de création d'activité pour appliquer correctement l'ACRE.";
    default:
      return "Il manque une information pour continuer.";
  }
}

function officialLinkCta(action) {
  const officialAction = action.officialAction;
  if (!officialAction) return null;
  return { kind: "official_link", label: officialAction.label, href: officialAction.url };
}

function buildDeclarationViewModel(action) {
  const dueDateLabel = formatFrenchDate(action.dueDate);
  const declaredAtLabel = action.metadata?.declaredAt
    ? formatFrenchDate(new Date(action.metadata.declaredAt))
    : null;
  const daysLeft = action.metadata?.daysLeft ?? null;

  switch (action.status) {
    case OBLIGATION_STATUS.overdue:
      // LOT 10.2E.1A: the deadline having passed IS a verifiable fact (the
      // badge below states it plainly), but whether the declaration was
      // actually filed is NOT something MicroAssist can verify -- a
      // missing dossier means "no confirmation on file", never "the
      // administration confirms it wasn't done" (section 5). Title and
      // explanation are worded to preserve that distinction; the CTA
      // label reflects that this may be a retrospective confirmation
      // ("J'ai déjà déclaré"), not a same-day one.
      return {
        key: "overdue",
        severity: "critical",
        badgeLabel: "En retard",
        icon: "⚠",
        title: "Déclaration URSSAF à vérifier",
        explanation: dueDateLabel
          ? `Nous n'avons pas encore de confirmation que la déclaration due le ${dueDateLabel} a été effectuée.`
          : "Nous n'avons pas encore de confirmation que cette déclaration a été effectuée.",
        dateLabel: dueDateLabel,
        primaryCta: officialLinkCta(action),
        secondaryCta: { kind: "confirm_declaration", label: "J'ai déjà déclaré" },
        showDetailLink: true,
      };

    case OBLIGATION_STATUS.due:
      return {
        key: "due",
        severity: "urgent",
        badgeLabel: "Aujourd'hui",
        icon: "⚠",
        title: "Déclaration URSSAF à faire aujourd'hui",
        explanation: "C'est le dernier jour pour déclarer.",
        dateLabel: dueDateLabel,
        primaryCta: officialLinkCta(action),
        secondaryCta: { kind: "confirm_declaration", label: "J'ai fait ma déclaration" },
        showDetailLink: true,
      };

    case OBLIGATION_STATUS.dueSoon: {
      const daysLabel =
        daysLeft === 1 ? "Il vous reste 1 jour." : `Il vous reste ${daysLeft} jours.`;
      return {
        key: "due_soon",
        severity: "urgent",
        badgeLabel: "Bientôt",
        icon: "⚠",
        title: dueDateLabel
          ? `Déclaration à faire avant le ${dueDateLabel}`
          : "Déclaration à faire bientôt",
        explanation: daysLeft != null ? daysLabel : "L'échéance approche.",
        dateLabel: dueDateLabel,
        primaryCta: officialLinkCta(action),
        secondaryCta: { kind: "confirm_declaration", label: "J'ai fait ma déclaration" },
        showDetailLink: true,
      };
    }

    case OBLIGATION_STATUS.upcoming:
      return {
        key: "upcoming",
        severity: "calm",
        badgeLabel: "À venir",
        icon: "ℹ",
        title: "Prochaine déclaration",
        explanation: dueDateLabel
          ? `À faire avant le ${dueDateLabel}.`
          : "Rien à faire pour l'instant.",
        dateLabel: dueDateLabel,
        primaryCta: officialLinkCta(action),
        secondaryCta: null,
        showDetailLink: true,
      };

    case OBLIGATION_STATUS.declared:
      return {
        key: "declared",
        severity: "calm",
        badgeLabel: "Déclarée",
        icon: "✓",
        title: "Déclaration confirmée",
        explanation: declaredAtLabel
          ? `Tu as déclaré le ${declaredAtLabel}.`
          : "Tu as confirmé cette déclaration.",
        dateLabel: null,
        primaryCta: { kind: "confirm_payment", label: "J'ai payé" },
        secondaryCta: null,
        showDetailLink: true,
      };

    case OBLIGATION_STATUS.paid:
      return {
        key: "paid",
        severity: "positive",
        badgeLabel: "Payée",
        icon: "✓",
        title: "Déclarée et payée",
        explanation: "Tout est à jour pour cette période.",
        dateLabel: null,
        primaryCta: null,
        secondaryCta: null,
        showDetailLink: true,
      };

    default:
      return null;
  }
}

function buildMissingInformationViewModel(action) {
  const missingField = action.metadata?.missingField ?? null;

  if (missingField === "first_declaration_period") {
    // buildMissingInformationActions() does not attach an officialAction to
    // its own actions (only buildUrssafDeclarationAction does) -- this
    // state still wants to point somewhere safe ("go check your own
    // account"), so it reuses the same already-verified URSSAF registry
    // entry rather than inventing a second URL anywhere.
    const urssafLink = getOfficialAction("urssafDeclaration");
    return {
      key: "first_declaration_unresolved",
      severity: "calm",
      badgeLabel: "À confirmer",
      icon: "ℹ",
      title: "Date de première déclaration à confirmer",
      explanation:
        "MicroAssist n'a pas encore assez d'informations vérifiées pour afficher une échéance fiable. Consulte ton espace URSSAF pour connaître ta date exacte.",
      dateLabel: null,
      primaryCta: urssafLink
        ? { kind: "official_link", label: urssafLink.label, href: urssafLink.url }
        : null,
      secondaryCta: null,
      showDetailLink: false,
    };
  }

  return {
    key: "missing_information",
    severity: "attention",
    badgeLabel: "Info requise",
    icon: "ℹ",
    title: "Une information manque",
    explanation: missingFieldExplanation(missingField),
    dateLabel: null,
    primaryCta: { kind: "edit_profile", label: "Compléter mon profil" },
    secondaryCta: null,
    showDetailLink: false,
  };
}

function buildNoActionViewModel() {
  return {
    key: "all_clear",
    severity: "positive",
    badgeLabel: "À jour",
    icon: "✓",
    title: "Tout est à jour",
    explanation: "Aucune action urgente pour le moment.",
    dateLabel: null,
    primaryCta: null,
    secondaryCta: null,
    showDetailLink: false,
  };
}

function buildGenericViewModel(action) {
  const isUrgent = action.severity === "critical" || action.severity === "urgent";
  return {
    key: "generic",
    severity: isUrgent ? "urgent" : "calm",
    badgeLabel: isUrgent ? "À vérifier" : "Info",
    icon: isUrgent ? "⚠" : "ℹ",
    title: "Un point mérite ton attention",
    explanation: "Consulte le détail pour en savoir plus.",
    dateLabel: null,
    primaryCta: null,
    secondaryCta: null,
    showDetailLink: true,
  };
}

/**
 * Converts the top canonical action (getPrioritizedActions()[0]) into a
 * beginner-French, presentation-only view-model for <PriorityCard/>. Never
 * called with more than one action -- ranking is entirely the canonical
 * model's job (src/domain/obligations/priority.js); this function only
 * relabels whichever single action it is given.
 */
export function buildPriorityCardViewModel(action) {
  if (!action) return null;

  if (action.type === ACTION_TYPE.urssafDeclaration) {
    return buildDeclarationViewModel(action) ?? buildGenericViewModel(action);
  }

  if (action.type === ACTION_TYPE.missingInformation) {
    return buildMissingInformationViewModel(action);
  }

  if (action.type === ACTION_TYPE.noActionRequired) {
    return buildNoActionViewModel();
  }

  return buildGenericViewModel(action);
}
