// Pure, runtime-agnostic (Deno + Node) reminder email payload rendering.
//
// LOT 7.20: replaces "today"-relative wording ("dans 2 jours") with
// deterministic absolute-date wording, so the SAME logical delivery
// produces a BYTE-IDENTICAL payload no matter which calendar day a retry
// happens to run on -- required for Resend's idempotency key to ever be
// reusable across retries without a 409 payload-mismatch conflict.
//
// This function is deterministic given its inputs alone: no `new Date()`,
// no `Date.now()`, no reference to "today" anywhere.

import { formatAbsoluteFrenchDate } from "./reminderDateFormat.js";

export const REMINDER_TEMPLATE_VERSION = "1";

function wrap(title, titleBg, bodyHtml) {
  return `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${titleBg}; color: white; padding: 20px; text-align: center;">
              <h1>${title}</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb;">
${bodyHtml}
            </div>
          </div>
        `;
}

export function buildReminderPayload({
  reminderType,
  reminderDate,
  declarationFrequency,
  activityType,
  appUrl,
}) {
  const absoluteDate = formatAbsoluteFrenchDate(reminderDate);

  if (reminderType === "declaration") {
    const period = declarationFrequency === "mensuel" ? "mensuelle" : "trimestrielle";
    const subject = `🔔 Rappel : Votre déclaration ${period} est prévue le ${absoluteDate}`;
    const html = wrap(
      "📋 Microassist",
      "#7c3aed",
      `
              <h2>Bonjour 👋</h2>
              <p>Votre <strong>déclaration ${period}</strong> est prévue le <strong>${absoluteDate}</strong>.</p>
              <div style="background: #fef3c7; padding: 12px; border-radius: 8px; margin: 16px 0;">
                <strong>📊 Points à vérifier :</strong>
                <ul>
                  <li>Ton chiffre d'affaires est-il à jour ?</li>
                  <li>As-tu pensé à mettre de côté les charges ?</li>
                </ul>
              </div>
              <a href="${appUrl}" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Accéder à mon espace →</a>`,
    );
    return { subject, html };
  }

  if (reminderType === "tva") {
    const tvaThreshold = activityType === "vente" ? 91900 : 36800;
    const subject = `⚠️ Alerte TVA : seuil bientôt atteint — rappel du ${absoluteDate}`;
    const html = wrap(
      "⚠️ Microassist",
      "#ef4444",
      `
              <h2>Bonjour 👋</h2>
              <div style="background: #fee2e2; padding: 12px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ef4444;">
                <strong>🚨 Attention seuil TVA !</strong>
                <p>Ton CA approche du seuil de ${tvaThreshold.toLocaleString("fr-FR")} €.</p>
              </div>
              <a href="${appUrl}" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Voir mon tableau de bord →</a>`,
    );
    return { subject, html };
  }

  const subject = `🔔 Rappel Microassist — ${absoluteDate}`;
  const html = wrap(
    "📋 Microassist",
    "#7c3aed",
    `
              <h2>Bonjour 👋</h2>
              <p>Tu as un rappel prévu le ${absoluteDate}.</p>
              <a href="${appUrl}" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Accéder à mon espace →</a>`,
  );
  return { subject, html };
}
