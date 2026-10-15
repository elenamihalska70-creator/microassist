import { parseLocalDraftPayload } from "./profileStorageCodec.js";

const LS_KEY = "microassist_v1";
const PROFILE_CONFLICT_STRATEGY_KEY = "microassist_profile_conflict_strategy";

export function readLocalDraftPayload() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return parseLocalDraftPayload(raw);
  } catch {
    return null;
  }
}

export function readProfileConflictStrategy() {
  try {
    return localStorage.getItem(PROFILE_CONFLICT_STRATEGY_KEY) || null;
  } catch {
    return null;
  }
}

export function writeLocalDraftPayload(payload) {
  localStorage.setItem(LS_KEY, JSON.stringify(payload));
}
