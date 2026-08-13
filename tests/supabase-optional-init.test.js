import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveSupabaseClient,
  supabase,
  isSupabaseConfigured,
  SUPABASE_UNAVAILABLE_MESSAGE,
  SUPABASE_UNAVAILABLE_ERROR,
} from "../src/lib/supabase.js";

test("module import does not throw when env vars are absent (regression: 'supabaseUrl is required')", () => {
  assert.equal(isSupabaseConfigured, false);
  assert.equal(supabase, null);
});

test("resolveSupabaseClient: env present creates a client and reports configured", () => {
  const calls = [];
  const fakeClient = { fake: true };
  const fakeCreateClient = (url, anonKey) => {
    calls.push([url, anonKey]);
    return fakeClient;
  };

  const result = resolveSupabaseClient(
    "https://example.supabase.co",
    "anon-key",
    fakeCreateClient,
  );

  assert.equal(result.isSupabaseConfigured, true);
  assert.equal(result.supabase, fakeClient);
  assert.deepEqual(calls, [["https://example.supabase.co", "anon-key"]]);
});

test("resolveSupabaseClient: env missing does not call createClient and returns a null client", () => {
  const calls = [];
  const fakeCreateClient = (...args) => {
    calls.push(args);
    return { fake: true };
  };

  const result = resolveSupabaseClient(undefined, undefined, fakeCreateClient);

  assert.equal(result.isSupabaseConfigured, false);
  assert.equal(result.supabase, null);
  assert.deepEqual(calls, []);
});

test("resolveSupabaseClient: partial env (url only) is treated as not configured", () => {
  const calls = [];
  const fakeCreateClient = (...args) => {
    calls.push(args);
    return { fake: true };
  };

  const result = resolveSupabaseClient(
    "https://example.supabase.co",
    "",
    fakeCreateClient,
  );

  assert.equal(result.isSupabaseConfigured, false);
  assert.equal(result.supabase, null);
  assert.deepEqual(calls, []);
});

test("SUPABASE_UNAVAILABLE_ERROR exposes a deterministic, non-throwing error shape", () => {
  assert.equal(typeof SUPABASE_UNAVAILABLE_MESSAGE, "string");
  assert.ok(SUPABASE_UNAVAILABLE_MESSAGE.length > 0);
  assert.deepEqual(SUPABASE_UNAVAILABLE_ERROR, {
    message: SUPABASE_UNAVAILABLE_MESSAGE,
  });
});
