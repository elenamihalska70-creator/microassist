const DEFAULT_SECTION = Object.freeze({
  landing: "home",
  assistant: "assistant",
  dashboard: "fiscal",
  pricing: "pricing",
});

const SECTION_VIEW = Object.freeze({
  home: "landing",
  services: "landing",
  assistant: "assistant",
  fiscal: "dashboard",
  invoices: "dashboard",
  pricing: "pricing",
});

// Runtime identity only: URLs, history payloads and persisted appView stay unchanged.
export function resolveNavigationLocation(view, section) {
  const resolvedView = Object.hasOwn(DEFAULT_SECTION, view) ? view : "landing";
  return {
    view: resolvedView,
    section: Object.hasOwn(SECTION_VIEW, section) && SECTION_VIEW[section] === resolvedView
      ? section : DEFAULT_SECTION[resolvedView],
  };
}
