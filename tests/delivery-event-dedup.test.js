import test from "node:test";
import assert from "node:assert/strict";
import { isDuplicateDeliveryEvent } from "../supabase/functions/_shared/deliveryEvents/deliveryEventDedup.js";

// UNIT — LOT 8.12 section 6. svix_id is the dedup key (not
// provider_message_id + event_type, which multiple legitimate distinct
// events can legitimately share).

test("known svix_id (Set) is a duplicate", () => {
  const known = new Set(["msg_p5jXN8AQM9LWM0D4loKWxJek"]);
  assert.equal(isDuplicateDeliveryEvent("msg_p5jXN8AQM9LWM0D4loKWxJek", known), true);
});

test("known svix_id (Array) is a duplicate", () => {
  const known = ["msg_p5jXN8AQM9LWM0D4loKWxJek", "msg_other"];
  assert.equal(isDuplicateDeliveryEvent("msg_p5jXN8AQM9LWM0D4loKWxJek", known), true);
});

test("unseen svix_id is not a duplicate", () => {
  const known = new Set(["msg_other"]);
  assert.equal(isDuplicateDeliveryEvent("msg_p5jXN8AQM9LWM0D4loKWxJek", known), false);
});

test("empty known set/array -> never a duplicate", () => {
  assert.equal(isDuplicateDeliveryEvent("msg_p5jXN8AQM9LWM0D4loKWxJek", new Set()), false);
  assert.equal(isDuplicateDeliveryEvent("msg_p5jXN8AQM9LWM0D4loKWxJek", []), false);
});

test("invalid svixId input is never treated as a duplicate", () => {
  assert.equal(isDuplicateDeliveryEvent(null, new Set(["x"])), false);
  assert.equal(isDuplicateDeliveryEvent(undefined, new Set(["x"])), false);
  assert.equal(isDuplicateDeliveryEvent("", new Set([""])), false);
});

test("unrecognized knownSvixIds shape defaults to not-a-duplicate rather than throwing", () => {
  assert.doesNotThrow(() => isDuplicateDeliveryEvent("msg_1", { not: "a set or array" }));
  assert.equal(isDuplicateDeliveryEvent("msg_1", { not: "a set or array" }), false);
  assert.equal(isDuplicateDeliveryEvent("msg_1", null), false);
  assert.equal(isDuplicateDeliveryEvent("msg_1", undefined), false);
});

// Two legitimate distinct events sharing provider_message_id + event_type
// is exactly the scenario svix_id-based dedup must NOT collapse (LOT 8.12
// section 6 rationale) -- this helper only ever compares svix_id, so it
// has no way to conflate them; documented here as the contract, not
// re-derivable from the implementation alone.
test("dedup is keyed on svix_id alone -- same provider_message_id/event_type with different svix_id is never a duplicate", () => {
  const known = new Set(["svix_evt_1"]);
  assert.equal(isDuplicateDeliveryEvent("svix_evt_2", known), false);
});
