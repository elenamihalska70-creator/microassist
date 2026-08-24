// LOT 10.1G section 4/8: server-side trial lifecycle evaluation. Mirrors
// the client's own getTrialDaysLeft (src/App.jsx) exactly -- same
// clamped-at-zero day count -- so a legitimate user's experience does
// not change, but event type is DERIVED here from the server's own
// database read of trial_ends_at, never trusted from the request body.
// This closes the "caller changes event_type" and "caller changes
// trialEndsAt" attack surfaces structurally, not just by validation.
export function computeTrialDaysLeft(trialEndsAt, now = Date.now()) {
  if (!trialEndsAt) return null;

  const trialEndDate = new Date(trialEndsAt);
  if (Number.isNaN(trialEndDate.getTime())) return null;

  const diffMs = trialEndDate.getTime() - now;
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// Ranges, not exact-day equality: the client's own per-day gating
// (exactly day 7, exactly day 2) already decides WHEN to attempt a
// call; this is the server's coarser, clock-skew-tolerant confirmation
// that the claimed lifecycle stage is at least plausible given its own
// read of trial_ends_at. Ordered most-urgent-first so a value can only
// ever resolve to one stage.
export function resolveTrialEventType(daysLeft) {
  if (daysLeft === null) return null;
  if (daysLeft <= 0) return "trial_expired";
  if (daysLeft <= 2) return "trial_ending_j2";
  if (daysLeft <= 7) return "trial_ending_j7";
  return null;
}

export const ALLOWED_TRIAL_EVENT_TYPES = Object.freeze([
  "trial_ending_j7",
  "trial_ending_j2",
  "trial_expired",
]);
