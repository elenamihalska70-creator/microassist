// Pure, runtime-agnostic (Deno + Node) retry-policy decisions (LOT 7.32).
//
// Answers, from durable reminder metadata alone: is this reminder
// retryable, and has its retry budget been exhausted? Does not select
// reminders, does not schedule anything, does not call Supabase/Resend.
// No live-query widening happens here (LOT 7.32 scope) -- selection
// integration is LOT 7.33.
//
// Design (LOT 7.31):
//   - status stays pending/sent/failed unchanged; retry state lives only
//     in metadata (section 11).
//   - daily-cron-only timing: no next_retry_at, nothing schedules a retry
//     more precisely than "the next cron run" (section 8).
//   - MAX_ATTEMPTS = 3 (section 7).
//   - provider_status "accepted" is never retryable, unconditionally
//     (section 8/14 of LOT 7.31, restated as the central invariant here).
//   - an unclassified "failed" defaults to TRANSIENT (conservative: wastes
//     a bounded number of attempts rather than silently dropping a
//     possibly-recoverable reminder); "conflict" (payload mismatch on an
//     idempotency key) is PERMANENT -- a bare retry with the same payload
//     cannot fix it; "concurrent" (another request in flight) is
//     TRANSIENT by nature (section 6).
//   - "unknown" outcomes are retryable with the same idempotency key
//     within Resend's 24h dedup window; past 24h with no resolution,
//     policy is conservative -- stop, do not blindly resend (section 16).

export const MAX_ATTEMPTS = 3;
const PROVIDER_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

// LOT 7.31 section 6 mapping. `outcomeMetadata` must be occurrence-scoped
// by the caller already (see reminderReplay.js `occurrenceScopedMetadata`)
// -- this function only reads provider_status/no_email_at, which are
// always freshly written for the current attempt and never carried
// forward stale, so no additional scoping is needed here.
export function classifyFailure(outcomeMetadata) {
  const meta = normalizeMetadata(outcomeMetadata);

  if (typeof meta.no_email_at === "string") return "permanent";

  switch (meta.provider_status) {
    case "accepted":
      return null; // not a failure
    case "unknown":
      return "unknown";
    case "conflict":
      return "permanent";
    case "concurrent":
      return "transient";
    case "failed":
      return "transient"; // conservative default; see module doc
    default:
      return null; // no attempt yet
  }
}

// `scopedMetadata` must already be occurrence-scoped (attempt_count/
// last_attempt_at/provider_status only mean anything for the occurrence
// that produced them -- see reminderReplay.js `occurrenceScopedMetadata`).
export function isRetryExhausted(scopedMetadata, { now = new Date(), maxAttempts = MAX_ATTEMPTS } = {}) {
  const meta = normalizeMetadata(scopedMetadata);
  const category = classifyFailure(meta);
  const attemptCount = typeof meta.attempt_count === "number" ? meta.attempt_count : 0;

  if (category === "transient") {
    return attemptCount >= maxAttempts;
  }

  if (category === "unknown") {
    if (attemptCount >= maxAttempts) return true;
    if (typeof meta.last_attempt_at !== "string") return false;
    const elapsedMs = now.getTime() - new Date(meta.last_attempt_at).getTime();
    return Number.isFinite(elapsedMs) && elapsedMs >= PROVIDER_IDEMPOTENCY_WINDOW_MS;
  }

  // permanent, accepted, or no attempt yet: no budget being spent, so
  // nothing to exhaust.
  return false;
}

export function isRetryable(scopedMetadata, options = {}) {
  const meta = normalizeMetadata(scopedMetadata);

  if (meta.provider_status === "accepted") return false; // central invariant, never overridden
  if (typeof meta.no_email_at === "string") return false;

  const category = classifyFailure(meta);
  if (category === null) return true; // nothing attempted against this occurrence yet
  if (category === "permanent") return false;

  return !isRetryExhausted(meta, options);
}

// Fields to merge into an already-built outcome metadata object (the
// result of buildAttemptMetadata / buildNoEmailMetadata). Never replaces
// the metadata object, never touches any other key, and never erases
// provider outcome evidence -- it only adds these two keys.
export function buildRetryPolicyFields(outcomeMetadata, { now = new Date() } = {}) {
  const meta = normalizeMetadata(outcomeMetadata);
  const exhausted = isRetryExhausted(meta, { now });
  const previousExhaustedAt =
    typeof meta.retry_exhausted_at === "string" ? meta.retry_exhausted_at : null;

  return {
    last_failure_category: classifyFailure(meta),
    // Set once, deterministically, and never cleared once true for this
    // occurrence -- exhaustion is monotonic (attempt_count only grows).
    retry_exhausted_at: exhausted ? (previousExhaustedAt ?? now.toISOString()) : null,
  };
}
