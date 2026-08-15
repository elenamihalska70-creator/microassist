// Pure, runtime-agnostic (Deno + Node) selection-policy composition
// (LOT 7.33).
//
// Answers the single safety-critical question the whole catch-up/retry
// design exists to get right: given a reminder row as the live Supabase
// query would return it (status, reminder_date, metadata -- no Supabase/
// Resend dependency, no claim involved), would send-reminder's current
// logic actually reach a FRESH provider call for it? This composes the
// date/status window (reminderWindow.js), occurrence identity
// (reminderReplay.js), and retry policy (reminderRetryPolicy.js) exactly
// the way index.ts does, so the full NORMAL/CATCH-UP/RETRY/OVERLAP test
// matrix can be expressed as single yes/no assertions instead of requiring
// each test to hand-compose three modules.
//
// Deliberately does NOT cover the no-email path: whether a user has an
// email is not part of the `reminders` row and is resolved by a separate
// lookup in index.ts (see reminder-no-email.test.js for that path).
// "Already accepted" (E) returns false here even though the row IS still
// claimed and finalized (via replay, not a fresh send) -- this function
// answers "would Resend be called again," not "would this row be
// touched at all."

import { isReminderEligible } from "./reminderWindow.js";
import { buildLogicalDeliveryKey } from "./reminderIdentity.js";
import { hasDurableAcceptedOutcome, occurrenceScopedMetadata } from "./reminderReplay.js";
import { isRetryable } from "./reminderRetryPolicy.js";

export function isReminderProcessable(reminder, now = new Date()) {
  if (!isReminderEligible(reminder, now)) return false;

  const logicalDeliveryKey = buildLogicalDeliveryKey(reminder);

  if (hasDurableAcceptedOutcome(reminder?.metadata, logicalDeliveryKey)) return false;

  const scopedMetadata = occurrenceScopedMetadata(reminder?.metadata, logicalDeliveryKey);
  return isRetryable(scopedMetadata, { now });
}
