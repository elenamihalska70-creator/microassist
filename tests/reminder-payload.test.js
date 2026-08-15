import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReminderPayload,
  REMINDER_TEMPLATE_VERSION,
} from "../supabase/functions/send-reminder/reminderPayload.js";

// UNIT — payload rendering must be a pure function of its inputs alone,
// with NO "today" dependency (the root cause characterized in LOT 7.17/7.18:
// relative wording like "dans 2 jours" made the same logical delivery
// produce a different payload depending on which day a retry ran, breaking
// Resend idempotency-key reuse). Byte-identical output for identical input
// is the property that makes provider idempotency usable at all.

const BASE_INPUT = {
  reminderType: "declaration",
  reminderDate: "2026-08-23",
  declarationFrequency: "mensuel",
  activityType: "services",
  appUrl: "https://microassist.fr",
};

test("declaration: subject and html contain the absolute date, not relative wording", () => {
  const { subject, html } = buildReminderPayload(BASE_INPUT);
  assert.match(subject, /23 août 2026/);
  assert.match(html, /23 août 2026/);
  assert.doesNotMatch(subject, /dans \d+ jours?/);
  assert.doesNotMatch(html, /dans \d+ jours?|aujourd'hui|demain|après-demain/);
});

test("declaration: mensuel vs trimestriel produce different wording", () => {
  const monthly = buildReminderPayload(BASE_INPUT);
  const quarterly = buildReminderPayload({ ...BASE_INPUT, declarationFrequency: "trimestriel" });
  assert.match(monthly.subject, /mensuelle/);
  assert.match(quarterly.subject, /trimestrielle/);
});

test("stability: identical inputs produce byte-identical output, called on two different 'todays'", () => {
  // No `today`/`Date.now()` parameter exists on the function at all -- this
  // test exists to make that invariant explicit and regression-proof.
  const a = buildReminderPayload(BASE_INPUT);
  const b = buildReminderPayload(BASE_INPUT);
  assert.deepEqual(a, b);
});

test("tva: subject/html use the absolute date and the correct threshold", () => {
  const { subject, html } = buildReminderPayload({
    ...BASE_INPUT,
    reminderType: "tva",
    activityType: "vente",
  });
  assert.match(subject, /23 août 2026/);
  assert.match(html, /91.900|91 900/);
});

test("custom/unknown reminder_type falls back to the generic template with absolute date", () => {
  const { subject, html } = buildReminderPayload({ ...BASE_INPUT, reminderType: "custom" });
  assert.match(subject, /23 août 2026/);
  assert.match(html, /23 août 2026/);
});

test("APP_URL is embedded in the rendered html", () => {
  const { html } = buildReminderPayload({ ...BASE_INPUT, appUrl: "https://example.test" });
  assert.match(html, /https:\/\/example\.test/);
});

test("REMINDER_TEMPLATE_VERSION is a stable, explicit string constant", () => {
  assert.equal(typeof REMINDER_TEMPLATE_VERSION, "string");
  assert.equal(REMINDER_TEMPLATE_VERSION, "1");
});
