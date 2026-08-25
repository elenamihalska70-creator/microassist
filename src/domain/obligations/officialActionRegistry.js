// Centralized, safe official action destinations (LOT 10.2B section 7).
// Only URLs already used and verified elsewhere in this repository are
// listed here -- nothing is invented. See:
//   - src/App.jsx EXPLANATION_CONTENT.urssaf.link
//   - src/App.jsx EXPLANATION_CONTENT.cfe.link
// A key is intentionally omitted (e.g. TVA) when no verified official URL
// exists yet in the codebase; callers must handle `getOfficialAction`
// returning null.

export const OFFICIAL_ACTION_REGISTRY = Object.freeze({
  urssafDeclaration: Object.freeze({
    label: "Déclarer sur autoentrepreneur.urssaf.fr",
    url: "https://www.autoentrepreneur.urssaf.fr/",
    provider: "urssaf",
  }),
  cfe: Object.freeze({
    label: "En savoir plus sur impots.gouv.fr",
    url: "https://www.impots.gouv.fr/professionnel/questions/quest-ce-que-la-cotisation-fonciere-des-entreprises-cfe",
    provider: "impots_gouv_fr",
  }),
});

export function getOfficialAction(key) {
  return OFFICIAL_ACTION_REGISTRY[key] ?? null;
}
