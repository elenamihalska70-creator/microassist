import { DECLARATION_FREQUENCIES } from "../constants.js";
import { withRuleTrace } from "./ruleSet.js";

const DAY_MS = 1000 * 60 * 60 * 24;

function coerceDate(value) {
  if (value instanceof Date) return value;
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getQuarterIndex(monthIndex) {
  if (monthIndex <= 2) return 1;
  if (monthIndex <= 5) return 2;
  if (monthIndex <= 8) return 3;
  return 4;
}

function nextQuarterDeadline(today) {
  const year = today.getFullYear();
  const quarter = getQuarterIndex(today.getMonth());

  if (quarter === 1) return new Date(year, 3, 30);
  if (quarter === 2) return new Date(year, 6, 31);
  if (quarter === 3) return new Date(year, 9, 31);
  return new Date(year + 1, 0, 31);
}

function nextMonthlyDeadline(today) {
  return new Date(today.getFullYear(), today.getMonth() + 2, 0);
}

export function getDeadlineRule(context = {}) {
  context = context || {};
  const frequency = context.frequency || context.declaration_frequency;
  const today = coerceDate(context.today);
  let deadlineDate = null;
  let nextDeclaration = "Prochaine échéance : à définir";
  let periodLabel = null;

  if (frequency === DECLARATION_FREQUENCIES.monthly) {
    deadlineDate = nextMonthlyDeadline(today);
    nextDeclaration = "Déclaration mensuelle";
    periodLabel = `CA de ${today.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    })}`;
  } else if (frequency === DECLARATION_FREQUENCIES.quarterly) {
    deadlineDate = nextQuarterDeadline(today);
    nextDeclaration = "Déclaration trimestrielle";
    periodLabel = `CA du trimestre T${getQuarterIndex(today.getMonth())} ${today.getFullYear()}`;
  }

  const daysLeft = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - today.getTime()) / DAY_MS)
    : null;
  const urgency =
    daysLeft === null ? null : daysLeft < 0 ? "late" : daysLeft <= 7 ? "soon" : null;

  return withRuleTrace({
    ruleId:
      frequency === DECLARATION_FREQUENCIES.monthly
        ? "DEADLINE_URSSAF_MONTHLY_LAST_DAY_NEXT_MONTH"
        : frequency === DECLARATION_FREQUENCIES.quarterly
          ? "DEADLINE_URSSAF_QUARTER_SIMPLIFIED"
          : "DEADLINE_URSSAF_UNKNOWN_FREQUENCY",
    name: "Echeance URSSAF historique",
    description:
      "Expose la regle de date actuellement utilisee par computeObligations.",
    inputs: ["frequency", "today"],
    value: {
      monthly: "Dernier jour du mois suivant",
      quarterly: ["30/04", "31/07", "31/10", "31/01"],
      soonThresholdDays: 7,
    },
    output: {
      deadlineDate,
      nextDeclaration,
      periodLabel,
      daysLeft,
      urgency,
    },
    sourceReference:
      "src/utils/obligations.js#nextMonthlyDeadline,#nextQuarterDeadline,#computeObligations",
    reason:
      "Preserve les echeances simplifiees existantes sans creer de Deadline Engine.",
    fallback: deadlineDate ? null : "unknown_frequency_no_deadline",
    warnings: ["Echeances simplifiees, provenance reglementaire non verifiee dans ce lot."],
    confidence: deadlineDate ? "medium" : "low",
  });
}
