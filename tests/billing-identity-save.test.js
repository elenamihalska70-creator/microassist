import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { updateBillingIdentity } from "../src/application/profile/billingIdentityRepository.js";

// Saving the invoice seller identity must only ever write
// profiles.billing_identity. It used to upsert the whole profile built from
// the in-memory copy, which would reset plan, premium, trial and onboarding
// fields whenever that copy was missing or stale.

const PROFILE_FIELDS_NEVER_SENT = [
  "plan", "is_premium", "subscription_status", "trial_started_at", "trial_ends_at",
  "stripe_customer_id", "onboarding_completed", "email", "full_name", "locale",
];
const USER_ID = "11111111-1111-1111-1111-111111111111";
const IDENTITY = { siret: "12345678900011", legal_name: "Exemple EI", address: "1 rue Fictive" };
const STORED_ROW = {
  id: USER_ID, plan: "free", is_premium: false, subscription_status: "trial",
  trial_ends_at: "2027-01-01T00:00:00.000Z", onboarding_completed: true, billing_identity: IDENTITY,
};

// Records every query-builder call; `respond` provides the awaited result.
function fakeSupabase(respond) {
  const calls = [];
  const builder = {};
  for (const method of ["update", "upsert", "insert", "eq", "select"]) {
    builder[method] = (...args) => { calls.push([method, ...args]); return builder; };
  }
  for (const method of ["maybeSingle", "single"]) {
    builder[method] = () => { calls.push([method]); return respond(); };
  }
  return { calls, from: (table) => { calls.push(["from", table]); return builder; } };
}

function writes(calls) {
  return calls.filter(([method]) => ["update", "upsert", "insert"].includes(method));
}

test("only billing_identity is written, on the signed-in user's own row", async () => {
  const client = fakeSupabase(async () => ({ data: STORED_ROW, error: null }));
  const saved = await updateBillingIdentity(client, USER_ID, IDENTITY);

  assert.deepEqual(client.calls, [
    ["from", "profiles"],
    ["update", { billing_identity: IDENTITY }],
    ["eq", "id", USER_ID],
    ["select", "*"],
    ["maybeSingle"],
  ]);
  assert.equal(saved, STORED_ROW);
});

test("premium, trial and onboarding fields are never sent", async () => {
  const client = fakeSupabase(async () => ({ data: STORED_ROW, error: null }));
  await updateBillingIdentity(client, USER_ID, IDENTITY);

  const [[, payload]] = writes(client.calls);
  assert.deepEqual(Object.keys(payload), ["billing_identity"]);
  for (const field of PROFILE_FIELDS_NEVER_SENT) assert.equal(field in payload, false, field);
});

test("a Supabase error is reported and nothing else is attempted", async () => {
  const failure = { code: "PGRST301", message: "JWT expired" };
  const client = fakeSupabase(async () => ({ data: null, error: failure }));

  await assert.rejects(updateBillingIdentity(client, USER_ID, IDENTITY), (error) => error === failure);
  assert.equal(writes(client.calls).length, 1, "no retry and no upsert fallback");
});

test("an update that matched no row (expired session, missing profile) is a failure", async () => {
  const client = fakeSupabase(async () => ({ data: null, error: null }));
  await assert.rejects(updateBillingIdentity(client, USER_ID, IDENTITY), /no profile row was updated/);
});

test("without a signed-in user nothing is sent", async () => {
  const client = fakeSupabase(async () => ({ data: STORED_ROW, error: null }));
  await assert.rejects(updateBillingIdentity(client, null, IDENTITY), /signed-in user/);
  assert.deepEqual(client.calls, []);
});

// The App.jsx callback, run as written with fakes for its closure, so the
// wiring (guard, notices, profile state) is checked rather than its text.
const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function topLevelFunction(name) {
  const start = SOURCE.indexOf(`\nfunction ${name}(`);
  assert.notEqual(start, -1, `function ${name} not found`);
  return SOURCE.slice(start, SOURCE.indexOf("\n}\n", start) + 2);
}

function saveBillingIdentityCallback() {
  const start = SOURCE.indexOf("  const saveBillingIdentity = useCallback(");
  assert.notEqual(start, -1, "saveBillingIdentity not found");
  const body = SOURCE.indexOf("async () =>", start);
  const end = SOURCE.indexOf("\n  }, [", body);
  return SOURCE.slice(body, end + 4);
}

async function runSave({ user, userProfile = null, respond }) {
  const supabase = fakeSupabase(respond);
  const notices = [];
  const profiles = [];
  const context = vm.createContext({
    supabase,
    user,
    userProfile,
    billingIdentityDraft: { siret: " 12345678900011 ", legal_name: "Exemple EI", address: "1 rue Fictive" },
    updateBillingIdentity,
    showSaveNotice: (message) => notices.push(message),
    setUserProfile: (value) => profiles.push(value),
    buildProfilePayload: () => { throw new Error("the full profile payload must not be built"); },
    console: { error() {} },
  });
  vm.runInContext(
    `${topLevelFunction("normalizeBillingIdentity")}\nglobalThis.save = ${saveBillingIdentityCallback()};`,
    context,
  );
  const result = await context.save();
  return { result, notices, profiles, calls: supabase.calls };
}

test("App saves only billing_identity even when the profile failed to load", async () => {
  const run = await runSave({
    user: { id: USER_ID, created_at: "2026-10-01T00:00:00.000Z" },
    userProfile: null,
    respond: async () => ({ data: STORED_ROW, error: null }),
  });

  assert.equal(run.result, true);
  // The payload object comes from the vm realm: compare its JSON form.
  assert.deepEqual(JSON.parse(JSON.stringify(writes(run.calls))), [["update", { billing_identity: IDENTITY }]]);
  assert.deepEqual(run.profiles, [STORED_ROW], "the profile shown is the row read back");
  assert.deepEqual(run.notices, ["Identité de facturation enregistrée ✅"]);
});

test("App keeps the draft and reports an error or an expired session", async () => {
  for (const respond of [
    async () => ({ data: null, error: { code: "PGRST301", message: "JWT expired" } }),
    async () => ({ data: null, error: null }),
    async () => { throw new TypeError("Failed to fetch"); },
  ]) {
    const run = await runSave({ user: { id: USER_ID }, userProfile: STORED_ROW, respond });
    assert.equal(run.result, false);
    assert.deepEqual(run.profiles, [], "the profile state is left as it was");
    assert.deepEqual(run.notices, ["Impossible d’enregistrer l’identité de facturation."]);
  }
});

test("App sends nothing without a signed-in user", async () => {
  const run = await runSave({ user: null, respond: async () => ({ data: STORED_ROW, error: null }) });
  assert.equal(run.result, false);
  assert.deepEqual(run.calls, []);
  assert.deepEqual(run.notices, ["Crée un compte pour enregistrer ton identité de facturation."]);
});
