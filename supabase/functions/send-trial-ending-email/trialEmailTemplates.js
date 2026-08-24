// LOT 10.1G section 8: server-owned lifecycle email copy. Text preserved
// verbatim from the client-side builders it replaces
// (buildTrialEndingEmailPayload / buildTrialEndingEmailPayloadJ2 /
// buildTrialExpiredEmailPayload, formerly in src/App.jsx, removed in this
// LOT) -- only the trust boundary moved server-side, the wording did not
// change. eventType is always server-derived (trialEmailLifecycle.js),
// never taken from the request body, so this module never receives an
// untrusted event type.

function formatTrialEndLabel(trialEndsAt) {
  if (!trialEndsAt) return "";
  const date = new Date(trialEndsAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR");
}

function buildTrialEndingJ7Template({ trialEndsAt }) {
  const trialEndLabel = formatTrialEndLabel(trialEndsAt);

  return {
    subject: "⏳ Ton essai Microassist se termine dans 7 jours",
    text: [
      "Bonjour 👋",
      "",
      "Ton essai Premium se termine dans 7 jours.",
      "",
      "Tu as pu tester :",
      "• l’historique complet",
      "• les rappels avant échéance",
      "• les exports PDF",
      "",
      "En gratuit, tu vois l’essentiel.",
      "Avec Premium, Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.",
      "",
      trialEndLabel
        ? `Fin de l’essai : ${trialEndLabel}.`
        : "La fin de ton essai approche.",
      "",
      "Les rappels avancés seront proposés progressivement après la phase de test.",
      "",
      "À très vite,",
      "Microassist",
    ].join("\n"),
    html: `
      <p>Bonjour 👋</p>
      <p>Ton essai Premium se termine dans <strong>7 jours</strong>.</p>
      <p>Tu as pu tester :</p>
      <ul>
        <li>l’historique complet</li>
        <li>les rappels avant échéance</li>
        <li>les exports PDF</li>
      </ul>
      <p>En gratuit, tu vois l’essentiel.</p>
      <p>Avec Premium, Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.</p>
      ${
        trialEndLabel
          ? `<p><strong>Fin de l’essai :</strong> ${trialEndLabel}</p>`
          : `<p>La fin de ton essai approche.</p>`
      }
      <p><a href="https://microassist.vercel.app/" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Voir les tarifs Premium</a></p>
      <p>À très vite,<br/>Microassist</p>
    `,
  };
}

function buildTrialEndingJ2Template({ trialEndsAt }) {
  const trialEndLabel = formatTrialEndLabel(trialEndsAt);

  return {
    subject: "⏳ Plus que 2 jours avant la fin de ton essai Microassist",
    text: [
      "Bonjour 👋",
      "",
      "Il ne reste plus que 2 jours avant la fin de ton essai Premium Microassist.",
      "",
      "Pendant cet essai, tu as pu profiter de :",
      "- l’historique complet",
      "- les rappels avant échéance",
      "- les exports PDF",
      "",
      "En gratuit, tu vois l’essentiel.",
      "Avec Premium, Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.",
      "",
      trialEndLabel
        ? `Fin de l’essai : ${trialEndLabel}`
        : "Fin de l’essai : bientôt",
      "",
      "Voir les tarifs Premium : https://microassist.vercel.app/?view=pricing",
      "",
      "À très vite,",
      "Microassist",
    ].join("\n"),
    html: `
      <h2>Plus que 2 jours avant la fin de ton essai</h2>
      <p>Il ne reste plus que <strong>2 jours</strong> avant la fin de ton essai Premium Microassist.</p>
      <p>Pendant cet essai, tu as pu profiter de :</p>
      <ul>
        <li>l’historique complet</li>
        <li>les rappels avant échéance</li>
        <li>les exports PDF</li>
      </ul>
      <p>En gratuit, tu vois l’essentiel.</p>
      <p>Avec Premium, Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.</p>
      ${
        trialEndLabel
          ? `<p><strong>Fin de l’essai :</strong> ${trialEndLabel}</p>`
          : `<p><strong>Fin de l’essai :</strong> bientôt</p>`
      }
      <p><a href="https://microassist.vercel.app/?view=pricing" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Voir les tarifs Premium</a></p>
      <p>À très vite,<br/>Microassist</p>
    `,
  };
}

function buildTrialExpiredTemplate({ trialEndsAt }) {
  const trialEndLabel = formatTrialEndLabel(trialEndsAt);

  return {
    subject: "Ton essai Microassist est terminé",
    text: [
      "Bonjour 👋",
      "",
      "Ton essai Premium Microassist est maintenant terminé.",
      "",
      "En gratuit, tu vois l’essentiel :",
      "- suivi simple",
      "- estimations de base",
      "",
      "Avec Premium, Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.",
      "",
      "Découvre l’offre Premium ici :",
      "https://microassist.vercel.app/?view=pricing",
      "",
      "À bientôt,",
      "Microassist",
    ].join("\n"),
    html: `
      <h2>Ton essai Microassist est terminé</h2>
      <p>Ton essai Premium Microassist est maintenant terminé.</p>
      <div>
        <p><strong>En gratuit, tu vois l’essentiel</strong></p>
        <ul>
          <li>suivi simple</li>
          <li>estimations de base</li>
        </ul>
      </div>
      <div>
        <p><strong>Premium</strong></p>
        <p>Microassist te prévient avant les échéances importantes et t’aide à agir plus tôt.</p>
      </div>
      ${
        trialEndLabel
          ? `<p><strong>Fin de l’essai :</strong> ${trialEndLabel}</p>`
          : ""
      }
      <p><a href="https://microassist.vercel.app/?view=pricing" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Voir les tarifs Premium</a></p>
      <p>À bientôt,<br/>Microassist</p>
    `,
  };
}

export function buildTrialEmailTemplate(eventType, { trialEndsAt }) {
  if (eventType === "trial_ending_j7") return buildTrialEndingJ7Template({ trialEndsAt });
  if (eventType === "trial_ending_j2") return buildTrialEndingJ2Template({ trialEndsAt });
  if (eventType === "trial_expired") return buildTrialExpiredTemplate({ trialEndsAt });
  return null;
}
