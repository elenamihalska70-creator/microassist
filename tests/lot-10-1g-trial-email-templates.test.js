import test from "node:test";
import assert from "node:assert/strict";
import { buildTrialEmailTemplate } from "../supabase/functions/send-trial-ending-email/trialEmailTemplates.js";

// Proves copy was preserved verbatim (LOT 10.1G section 8) when it moved
// server-side from the now-removed src/App.jsx builders, and that
// content is only ever produced for the three known event types.

test("trial_ending_j7: subject and key copy match the original client-side text exactly", () => {
  const template = buildTrialEmailTemplate("trial_ending_j7", { trialEndsAt: "2026-09-01T00:00:00Z" });
  assert.equal(template.subject, "⏳ Ton essai Microassist se termine dans 7 jours");
  assert.match(template.text, /Ton essai Premium se termine dans 7 jours\./);
  assert.match(template.html, /<strong>7 jours<\/strong>/);
});

test("trial_ending_j2: subject and key copy match the original client-side text exactly", () => {
  const template = buildTrialEmailTemplate("trial_ending_j2", { trialEndsAt: "2026-09-01T00:00:00Z" });
  assert.equal(template.subject, "⏳ Plus que 2 jours avant la fin de ton essai Microassist");
  assert.match(template.text, /Il ne reste plus que 2 jours avant la fin de ton essai Premium Microassist\./);
});

test("trial_expired: subject and key copy match the original client-side text exactly", () => {
  const template = buildTrialEmailTemplate("trial_expired", { trialEndsAt: "2026-09-01T00:00:00Z" });
  assert.equal(template.subject, "Ton essai Microassist est terminé");
  assert.match(template.text, /Ton essai Premium Microassist est maintenant terminé\./);
});

test("missing/invalid trialEndsAt falls back gracefully instead of rendering an invalid date", () => {
  const template = buildTrialEmailTemplate("trial_expired", { trialEndsAt: null });
  assert.doesNotMatch(template.text, /Invalid Date/);
  assert.doesNotMatch(template.html, /Invalid Date/);
});

test("an unrecognized event type returns null rather than guessing at content", () => {
  assert.equal(buildTrialEmailTemplate("something_else", { trialEndsAt: "2026-09-01T00:00:00Z" }), null);
  assert.equal(buildTrialEmailTemplate(undefined, { trialEndsAt: "2026-09-01T00:00:00Z" }), null);
});
