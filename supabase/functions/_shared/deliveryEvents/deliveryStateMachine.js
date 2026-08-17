// Pure, runtime-agnostic (Deno + Node) delivery-event state machine
// (LOT 8.12, design decided LOT 8.11 sections 8/10/11). No DB dependency:
// callers supply the current known state and the incoming event; this
// module only decides whether to apply it and what the next state is.
//
// This is a SEPARATE vocabulary from reminders.metadata.provider_status
// ("accepted" | "failed" | "unknown" | "conflict" | "concurrent", LOT
// 7.6/7.20) -- that field describes the synchronous Resend API hand-off;
// DELIVERY_STATES below describe what happened AFTERWARD, per the
// asynchronous webhook events (LOT 8.11 section 4). Do not conflate them.
//
// Canonical states (LOT 8.12 section 8):
export const DELIVERY_STATES = ["sent", "delayed", "delivered", "bounced", "failed"];

// Terminal = no further delivery_state transition is ever applied once
// reached, regardless of a later event's own timestamp (LOT 8.12 section
// 9: "delivered then older sent -> ignore", "bounced then older delayed ->
// ignore" -- both hold simply because the current state is already
// terminal, without needing timestamp comparison for those cases).
export const TERMINAL_DELIVERY_STATES = ["delivered", "bounced", "failed"];

// email.complained is modeled separately, not as a state (LOT 8.11 section
// 10 decision, restated LOT 8.12 section 10): it layers onto whatever
// delivery_state already exists (typically "delivered", but a complaint
// could in principle be reported even if our own delivered webhook was
// lost) rather than replacing it. Losing the real delivery_state to a
// later complaint would misrepresent what actually happened.
const EVENT_TYPE_TO_STATE = {
  "email.sent": "sent",
  "email.delivery_delayed": "delayed",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.failed": "failed",
};

function isTerminal(state) {
  return TERMINAL_DELIVERY_STATES.includes(state);
}

// currentState: { state: string | null, eventCreatedAt: string | null }
//   state === null means no delivery-event-derived state exists yet (the
//   reminder is still only as far as the synchronous "accepted" hand-off,
//   LOT 7.6) -- treated as non-terminal, so the first event always applies.
// incomingEvent: { type: string, createdAt: string | null }
//
// Returns one of:
//   { action: "complaint" }                                  -- always applied, state unchanged
//   { action: "ignored", reason: "unsupported_type" }
//   { action: "ignored", reason: "missing_created_at" }
//   { action: "ignored", reason: "state_terminal" }
//   { action: "ignored", reason: "older_event" }
//   { action: "applied", nextState: string, eventCreatedAt: string }
export function decideDeliveryEventTransition(currentState, incomingEvent) {
  const current = currentState && typeof currentState === "object" ? currentState : {};
  const incoming = incomingEvent && typeof incomingEvent === "object" ? incomingEvent : {};

  if (incoming.type === "email.complained") {
    // Always layers, independent of terminal state or timestamp ordering
    // (LOT 8.12 section 10) -- a complaint is evidence in its own right,
    // never gated on delivery_state's current value.
    return { action: "complaint" };
  }

  const nextState = EVENT_TYPE_TO_STATE[incoming.type];
  if (!nextState) {
    return { action: "ignored", reason: "unsupported_type" };
  }

  if (typeof incoming.createdAt !== "string" || incoming.createdAt.length === 0) {
    return { action: "ignored", reason: "missing_created_at" };
  }

  if (isTerminal(current.state)) {
    return { action: "ignored", reason: "state_terminal" };
  }

  if (
    typeof current.eventCreatedAt === "string" &&
    incoming.createdAt <= current.eventCreatedAt
  ) {
    // ISO 8601 strings compare correctly lexicographically. Equal
    // timestamps are also ignored -- a genuinely new event never ties with
    // the one already recorded (LOT 8.12 section 7/9).
    return { action: "ignored", reason: "older_event" };
  }

  return { action: "applied", nextState, eventCreatedAt: incoming.createdAt };
}
