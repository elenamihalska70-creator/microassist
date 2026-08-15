// Pure, runtime-agnostic (Deno + Node) logical delivery identity.
// LOT 7.18/7.20 design: one logical reminder occurrence is identified by
// reminder_type + reminder.id + reminder_date. Stable across retries and
// concurrent invocations (same occurrence -> same key); changes only when
// the occurrence itself changes (a resave that shifts reminder_date).
// Never includes attempt_count, never includes PII.

const PROVIDER_IDEMPOTENCY_PREFIX = "microassist/reminder";

export function buildLogicalDeliveryKey(reminder) {
  return `${reminder.reminder_type}:${reminder.id}:${reminder.reminder_date}`;
}

export function buildProviderIdempotencyKey(logicalDeliveryKey) {
  return `${PROVIDER_IDEMPOTENCY_PREFIX}/${logicalDeliveryKey}`;
}
