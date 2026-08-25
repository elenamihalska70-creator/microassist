import { DECLARATION_FREQUENCIES } from "../constants.js";
import { withRuleTrace } from "./ruleSet.js";
import {
  resolveCurrentDeclarationPeriod,
  computeDeclarationDeadline,
} from "./declarationPeriod.js";

const SOON_THRESHOLD_DAYS = 7;

function formatPeriodLabel(frequency, period) {
  if (!period) return null;

  if (period.type === "month") {
    const monthDate = new Date(period.year, period.month0, 1);
    return `CA de ${monthDate.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    })}`;
  }

  if (period.type === "quarter") {
    return `CA du trimestre T${period.quarter} ${period.year}`;
  }

  return null;
}

export function getDeadlineRule(context = {}) {
  context = context || {};
  const frequency = context.frequency || context.declaration_frequency;
  const referenceDate = context.today;

  const period = resolveCurrentDeclarationPeriod({ frequency, referenceDate });
  const deadline = period
    ? computeDeclarationDeadline({ period, referenceDate })
    : null;

  const deadlineDate = deadline?.dueDate ?? null;
  const daysLeft = deadline?.daysLeft ?? null;
  const periodLabel = formatPeriodLabel(frequency, period);
  const nextDeclaration =
    frequency === DECLARATION_FREQUENCIES.monthly
      ? "Déclaration mensuelle"
      : frequency === DECLARATION_FREQUENCIES.quarterly
        ? "Déclaration trimestrielle"
        : "Prochaine échéance : à définir";
  const urgency =
    daysLeft === null ? null : daysLeft < 0 ? "late" : daysLeft <= SOON_THRESHOLD_DAYS ? "soon" : null;

  return withRuleTrace({
    ruleId:
      frequency === DECLARATION_FREQUENCIES.monthly
        ? "DEADLINE_URSSAF_MONTHLY_PERIOD_ANCHORED"
        : frequency === DECLARATION_FREQUENCIES.quarterly
          ? "DEADLINE_URSSAF_QUARTER_PERIOD_ANCHORED"
          : "DEADLINE_URSSAF_UNKNOWN_FREQUENCY",
    name: "Echeance URSSAF ancree sur la periode declaree",
    description:
      "Identifie la periode (mois ou trimestre) actuellement declarable et calcule une echeance fixe pour cette periode, stable dans le temps (LOT 10.2C -- corrige le glissement permanent de l'echeance observe dans computeObligations avant cette date).",
    inputs: ["frequency", "today"],
    value: {
      monthly: "Dernier jour du mois suivant la periode declaree",
      quarterly: ["30/04", "31/07", "31/10", "31/01"],
      soonThresholdDays: SOON_THRESHOLD_DAYS,
    },
    output: {
      deadlineDate,
      nextDeclaration,
      periodLabel,
      daysLeft,
      urgency,
    },
    sourceReference:
      "Verifie aupres d'entreprendre.service-public.gouv.fr (recupere le 2026-08-25) ; corrobore par autoentrepreneur.urssaf.fr. Voir le rapport final LOT 10.2C pour les citations completes.",
    reason:
      "La periode declarable est desormais resolue independamment de la date d'echeance elle-meme (src/domain/rules/declarationPeriod.js), de sorte que l'echeance d'une periode donnee ne se deplace plus lorsque le temps avance.",
    fallback: deadlineDate ? null : "unknown_frequency_no_deadline",
    warnings: [
      "Ne modelise pas encore la premiere declaration apres creation d'activite (regle non etablie de maniere fiable aupres d'une source primaire -- voir rapport LOT 10.2C).",
      "Ne modelise pas le report d'echeance en cas de week-end ou jour ferie.",
    ],
    confidence: deadlineDate ? "high" : "low",
  });
}
