export function parseLocalDraftPayload(raw) {
  if (!raw) return null;

  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" ? parsed : null;
}
