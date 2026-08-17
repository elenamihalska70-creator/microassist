// Pure, runtime-agnostic (Deno + Node) Svix header extraction (LOT 8.13
// section 4/7). Svix signature verification requires exactly these three
// headers; missing any one of them must be rejected before verification
// is even attempted, not defaulted or guessed.

const REQUIRED_HEADER_NAMES = ["svix-id", "svix-timestamp", "svix-signature"];

// `headersLike` is anything exposing a Fetch-API-shaped `.get(name)`
// (Deno's Request#headers satisfies this directly; a plain object works
// too via the fallback below, which is what makes this testable without
// constructing a real Headers instance).
function readHeader(headersLike, name) {
  if (headersLike && typeof headersLike.get === "function") {
    return headersLike.get(name);
  }
  if (headersLike && typeof headersLike === "object") {
    return headersLike[name] ?? null;
  }
  return null;
}

// Returns { svixId, svixTimestamp, svixSignature } only if all three are
// present and non-empty; otherwise null -- callers must reject the
// request outright on null, never proceed with partial headers.
export function extractSvixHeaders(headersLike) {
  const values = REQUIRED_HEADER_NAMES.map((name) => readHeader(headersLike, name));
  if (values.some((value) => typeof value !== "string" || value.length === 0)) {
    return null;
  }
  const [svixId, svixTimestamp, svixSignature] = values;
  return { svixId, svixTimestamp, svixSignature };
}
