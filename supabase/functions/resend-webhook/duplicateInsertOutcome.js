// Pure, runtime-agnostic (Deno + Node) duplicate-insert classification
// (LOT 8.13 section 10). Deliberately insert-then-classify rather than
// select-then-insert: a SELECT-before-INSERT check has a TOCTOU race
// under concurrent duplicate webhook delivery (Resend's own docs confirm
// at-least-once delivery is expected, LOT 8.11 section 4/11), so the
// unique constraint on delivery_events.svix_id (LOT 8.12) is the actual
// dedup mechanism -- this only recognizes when that constraint is what
// rejected the insert, so the caller can treat it as an idempotent
// success (200) rather than a real failure (5xx).

// Postgres unique_violation SQLSTATE. supabase-js/PostgREST surfaces this
// as error.code on the returned error object.
const POSTGRES_UNIQUE_VIOLATION_CODE = "23505";

export function isDuplicateSvixIdError(dbError) {
  if (!dbError || typeof dbError !== "object") return false;
  // The table's only unique constraint is on svix_id (LOT 8.12 migration),
  // and this insert only ever writes one row -- so the SQLSTATE alone is
  // sufficient to identify a duplicate svix_id, with no ambiguity about
  // which constraint fired.
  return dbError.code === POSTGRES_UNIQUE_VIOLATION_CODE;
}
