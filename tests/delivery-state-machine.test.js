import test from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERY_STATES,
  TERMINAL_DELIVERY_STATES,
  decideDeliveryEventTransition,
} from "../supabase/functions/_shared/deliveryEvents/deliveryStateMachine.js";

// UNIT — LOT 8.12 delivery-event state-machine contract (design LOT 8.11
// sections 8-11). No DB dependency: current/incoming are plain objects
// supplied by the test, exactly as a future webhook handler would.

test("canonical state model matches LOT 8.12 section 8", () => {
  assert.deepEqual([...DELIVERY_STATES].sort(), ["bounced", "delayed", "delivered", "failed", "sent"].sort());
  assert.deepEqual([...TERMINAL_DELIVERY_STATES].sort(), ["bounced", "delivered", "failed"].sort());
});

// Fresh occurrence (no prior delivery-event state) ------------------------

test("no prior state + email.sent -> applied, state=sent", () => {
  const result = decideDeliveryEventTransition(
    { state: null, eventCreatedAt: null },
    { type: "email.sent", createdAt: "2026-08-17T08:00:00.000Z" },
  );
  assert.deepEqual(result, { action: "applied", nextState: "sent", eventCreatedAt: "2026-08-17T08:00:00.000Z" });
});

test("no prior state + email.delivered -> applied directly (ordering not guaranteed, sent may never be observed)", () => {
  const result = decideDeliveryEventTransition(
    { state: null, eventCreatedAt: null },
    { type: "email.delivered", createdAt: "2026-08-17T08:00:05.000Z" },
  );
  assert.equal(result.action, "applied");
  assert.equal(result.nextState, "delivered");
});

// Straight-line transitions ------------------------------------------------

test("sent -> delivered", () => {
  const result = decideDeliveryEventTransition(
    { state: "sent", eventCreatedAt: "2026-08-17T08:00:00.000Z" },
    { type: "email.delivered", createdAt: "2026-08-17T08:00:05.000Z" },
  );
  assert.deepEqual(result, { action: "applied", nextState: "delivered", eventCreatedAt: "2026-08-17T08:00:05.000Z" });
});

test("sent -> bounced", () => {
  const result = decideDeliveryEventTransition(
    { state: "sent", eventCreatedAt: "2026-08-17T08:00:00.000Z" },
    { type: "email.bounced", createdAt: "2026-08-17T08:00:03.000Z" },
  );
  assert.equal(result.action, "applied");
  assert.equal(result.nextState, "bounced");
});

test("sent -> failed", () => {
  const result = decideDeliveryEventTransition(
    { state: "sent", eventCreatedAt: "2026-08-17T08:00:00.000Z" },
    { type: "email.failed", createdAt: "2026-08-17T08:00:03.000Z" },
  );
  assert.equal(result.nextState, "failed");
});

test("sent -> delayed -> delivered", () => {
  const toDelayed = decideDeliveryEventTransition(
    { state: "sent", eventCreatedAt: "2026-08-17T08:00:00.000Z" },
    { type: "email.delivery_delayed", createdAt: "2026-08-17T08:05:00.000Z" },
  );
  assert.equal(toDelayed.nextState, "delayed");

  const toDelivered = decideDeliveryEventTransition(
    { state: toDelayed.nextState, eventCreatedAt: toDelayed.eventCreatedAt },
    { type: "email.delivered", createdAt: "2026-08-17T09:00:00.000Z" },
  );
  assert.equal(toDelivered.action, "applied");
  assert.equal(toDelivered.nextState, "delivered");
});

test("sent -> delayed -> bounced", () => {
  const toDelayed = decideDeliveryEventTransition(
    { state: "sent", eventCreatedAt: "2026-08-17T08:00:00.000Z" },
    { type: "email.delivery_delayed", createdAt: "2026-08-17T08:05:00.000Z" },
  );
  const toBounced = decideDeliveryEventTransition(
    { state: toDelayed.nextState, eventCreatedAt: toDelayed.eventCreatedAt },
    { type: "email.bounced", createdAt: "2026-08-17T09:00:00.000Z" },
  );
  assert.equal(toBounced.nextState, "bounced");
});

// Terminal-state protection (LOT 8.12 section 9 examples) ------------------

test("delivered then an older email.sent -> ignored (state already terminal)", () => {
  const result = decideDeliveryEventTransition(
    { state: "delivered", eventCreatedAt: "2026-08-17T08:00:05.000Z" },
    { type: "email.sent", createdAt: "2026-08-17T08:00:00.000Z" },
  );
  assert.deepEqual(result, { action: "ignored", reason: "state_terminal" });
});

test("bounced then an older email.delivery_delayed -> ignored (state already terminal)", () => {
  const result = decideDeliveryEventTransition(
    { state: "bounced", eventCreatedAt: "2026-08-17T09:00:00.000Z" },
    { type: "email.delivery_delayed", createdAt: "2026-08-17T08:05:00.000Z" },
  );
  assert.deepEqual(result, { action: "ignored", reason: "state_terminal" });
});

test("terminal state also rejects a NEWER-timestamped event -- terminal is frozen, not just protected from regression", () => {
  const result = decideDeliveryEventTransition(
    { state: "delivered", eventCreatedAt: "2026-08-17T08:00:05.000Z" },
    { type: "email.bounced", createdAt: "2026-08-17T10:00:00.000Z" },
  );
  assert.deepEqual(result, { action: "ignored", reason: "state_terminal" });
});

// Out-of-order protection among NON-terminal states -------------------------

test("delayed then an older email.sent (both non-terminal) -> ignored as older, does not regress", () => {
  const result = decideDeliveryEventTransition(
    { state: "delayed", eventCreatedAt: "2026-08-17T08:05:00.000Z" },
    { type: "email.sent", createdAt: "2026-08-17T08:00:00.000Z" },
  );
  assert.deepEqual(result, { action: "ignored", reason: "older_event" });
});

test("an event with a timestamp exactly equal to the stored one is ignored, not re-applied", () => {
  const result = decideDeliveryEventTransition(
    { state: "sent", eventCreatedAt: "2026-08-17T08:00:00.000Z" },
    { type: "email.delivered", createdAt: "2026-08-17T08:00:00.000Z" },
  );
  assert.deepEqual(result, { action: "ignored", reason: "older_event" });
});

// Complaint layering (LOT 8.12 section 10) ----------------------------------

test("email.complained always applies, independent of current state", () => {
  for (const state of [null, "sent", "delayed", "delivered", "bounced", "failed"]) {
    const result = decideDeliveryEventTransition(
      { state, eventCreatedAt: "2026-08-17T08:00:00.000Z" },
      { type: "email.complained", createdAt: "2026-08-17T12:00:00.000Z" },
    );
    assert.deepEqual(result, { action: "complaint" }, `complaint must apply over state=${state}`);
  }
});

test("email.complained on a delivered reminder does not report a state change -- caller keeps delivery_state=delivered and separately sets complained=true", () => {
  const result = decideDeliveryEventTransition(
    { state: "delivered", eventCreatedAt: "2026-08-17T08:00:05.000Z" },
    { type: "email.complained", createdAt: "2026-08-17T20:00:00.000Z" },
  );
  assert.equal(result.action, "complaint");
  assert.equal("nextState" in result, false);
});

// Input safety ---------------------------------------------------------------

test("unsupported event type is ignored, not thrown", () => {
  const result = decideDeliveryEventTransition(
    { state: "sent", eventCreatedAt: "2026-08-17T08:00:00.000Z" },
    { type: "email.opened", createdAt: "2026-08-17T08:00:05.000Z" },
  );
  assert.deepEqual(result, { action: "ignored", reason: "unsupported_type" });
});

test("missing/invalid createdAt is ignored, not thrown or defaulted to now", () => {
  const result = decideDeliveryEventTransition(
    { state: "sent", eventCreatedAt: "2026-08-17T08:00:00.000Z" },
    { type: "email.delivered", createdAt: null },
  );
  assert.deepEqual(result, { action: "ignored", reason: "missing_created_at" });
});

test("tolerates missing/malformed currentState and incomingEvent objects", () => {
  assert.doesNotThrow(() => decideDeliveryEventTransition(null, { type: "email.sent", createdAt: "2026-08-17T08:00:00.000Z" }));
  assert.doesNotThrow(() => decideDeliveryEventTransition(undefined, undefined));
  assert.deepEqual(decideDeliveryEventTransition(undefined, undefined), { action: "ignored", reason: "unsupported_type" });
});
