// Pure, runtime-agnostic (Deno + Node) reminder attempt observability.
// Builds the reminders.metadata jsonb payload for one delivery attempt,
// without ever writing to disk/DB/network itself.
//
// Contract (LOT 7.6):
//   { last_attempt_at, attempt_count, provider, provider_message_id,
//     provider_status: "accepted" | "failed", failure_reason }
//
// provider_status is never "delivered" — no delivery/bounce webhook exists,
// a 2xx from the provider only means the provider accepted the request.

export function buildAttemptMetadata(existingMetadata, attempt) {
  const previous =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? existingMetadata
      : {};
  const previousAttemptCount =
    typeof previous.attempt_count === "number" ? previous.attempt_count : 0;

  return {
    ...previous,
    last_attempt_at: attempt.attemptedAt,
    attempt_count: previousAttemptCount + 1,
    provider: "resend",
    provider_message_id: attempt.providerMessageId ?? null,
    provider_status: attempt.providerStatus,
    failure_reason:
      attempt.providerStatus === "failed" ? (attempt.failureReason ?? null) : null,
  };
}
