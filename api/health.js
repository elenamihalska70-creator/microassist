/* global process */
/**
 * Fleet Health Endpoint Standard V1 — microassist.  GET /api/health
 *
 * First Vercel Serverless Function in this Vite SPA project. Read-only.
 * It imports nothing from the application: no React code, no business-domain
 * logic, no authentication flow, no database migration, no Edge Function, no
 * background scheduler. It never writes, never runs a business workflow, and
 * never sends a notification.
 *
 * It issues at most one bounded outbound probe:
 *   GET {HEALTH_SUPABASE_URL}/auth/v1/health   with an `apikey` header
 *
 * Per the AI OS Fleet Supabase probe standard (Digital-Lab-AI-OS 92cbd45):
 * /auth/v1/health is NOT keyless — an unauthenticated request returns 401,
 * which maps to DEGRADED/backend_auth_failed (never HEALTHY, never
 * unknown_error). No `Authorization: Bearer` is sent for this probe.
 *
 * The response body carries only closed-vocabulary statuses: no secrets, no
 * env values, no URLs, no project ref, no rows, no stack traces.
 */

const SCHEMA_VERSION = "1";
const PROJECT_ID = "microassist";
const PROBE_TIMEOUT_MS = 2500;

function normalizeBaseUrl(raw) {
  return String(raw).trim().replace(/\/+$/, "");
}

async function probe(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    return { kind: "response", status: response.status };
  } catch {
    // The underlying error is never captured, logged, or surfaced.
    return controller.signal.aborted ? { kind: "timeout" } : { kind: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Platform reachability, from GET /auth/v1/health (sent with the `apikey`
 * header). Mirrors the AI OS Fleet Supabase platform-probe status map.
 */
function mapPlatform(outcome) {
  if (outcome.kind === "timeout") return { status: "UNKNOWN", reason: "probe_timeout" };
  if (outcome.kind === "network_error") return { status: "DOWN", reason: "backend_unreachable" };
  const code = outcome.status;
  if (code === 200 || code === 206) return { status: "HEALTHY", reason: "backend_ok" };
  if (code === 401) return { status: "DEGRADED", reason: "backend_auth_failed" };
  if (code === 404 || code >= 500) return { status: "DOWN", reason: "backend_unreachable" };
  return { status: "UNKNOWN", reason: "unknown_error" };
}

/**
 * Auth-service health, derived deterministically from the SAME
 * /auth/v1/health observation — that path IS GoTrue's own health endpoint,
 * so a second provider call would be redundant. For microassist,
 * authentication is a critical product dependency.
 */
function mapAuth(outcome) {
  if (outcome.kind === "timeout") return { status: "UNKNOWN", reason: "probe_timeout" };
  if (outcome.kind === "network_error") return { status: "DOWN", reason: "auth_service_unavailable" };
  const code = outcome.status;
  if (code === 200 || code === 206) return { status: "HEALTHY", reason: "auth_service_ok" };
  if (code === 401) return { status: "DEGRADED", reason: "backend_auth_failed" };
  if (code === 404 || code >= 500) return { status: "DOWN", reason: "auth_service_unavailable" };
  return { status: "UNKNOWN", reason: "unknown_error" };
}

/**
 * Deterministic roll-up. microassist has no offline/localStorage fallback
 * for its authenticated fiscal workflow, so every executable dependency is
 * `critical` and Supabase unavailable => project DOWN.
 *   - a missing required endpoint config => NOT_CONFIGURED
 *   - dependency checks that are intentionally NOT_CONFIGURED are excluded
 *   - any critical DOWN => DOWN
 *   - any critical UNKNOWN or DEGRADED => DEGRADED
 *   - otherwise HEALTHY
 */
function rollUp(checks) {
  if (checks.some((c) => c.required === "critical" && c.reason === "config_missing")) {
    return "NOT_CONFIGURED";
  }
  const scored = checks.filter((c) => c.status !== "NOT_CONFIGURED");
  const critical = scored.filter((c) => c.required === "critical");
  if (critical.some((c) => c.status === "DOWN")) return "DOWN";
  if (critical.some((c) => c.status === "UNKNOWN")) return "DEGRADED";
  if (critical.some((c) => c.status === "DEGRADED")) return "DEGRADED";
  return "HEALTHY";
}

function httpStatusFor(status) {
  if (status === "NOT_CONFIGURED") return { code: 503, retryAfter: 300 };
  if (status === "DOWN") return { code: 503, retryAfter: 60 };
  return { code: 200 };
}

async function computeHealth() {
  const generatedAt = new Date().toISOString();
  const checks = [
    { key: "runtime", layer: "endpoint", required: "critical", status: "HEALTHY", reason: "runtime_ok" },
  ];

  const supabaseUrl = (process.env.HEALTH_SUPABASE_URL || "").trim();
  const anonKey = (process.env.HEALTH_SUPABASE_ANON_KEY || "").trim();
  const configOk = supabaseUrl !== "" && anonKey !== "";

  checks.push({
    key: "configuration",
    layer: "endpoint",
    required: "critical",
    status: configOk ? "HEALTHY" : "NOT_CONFIGURED",
    reason: configOk ? "config_ok" : "config_missing",
  });

  if (!configOk) {
    for (const key of ["backend_platform", "backend_auth"]) {
      checks.push({
        key,
        layer: "dependency",
        required: "critical",
        status: "NOT_CONFIGURED",
        reason: "config_missing",
      });
    }
  } else {
    const outcome = await probe(`${normalizeBaseUrl(supabaseUrl)}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: anonKey },
    });
    const platform = mapPlatform(outcome);
    checks.push({
      key: "backend_platform",
      layer: "dependency",
      required: "critical",
      status: platform.status,
      reason: platform.reason,
    });
    const auth = mapAuth(outcome);
    checks.push({
      key: "backend_auth",
      layer: "dependency",
      required: "critical",
      status: auth.status,
      reason: auth.reason,
    });
  }

  // Phase 1: no safe anon-readable business table exists — every core table
  // is auth.uid()/RLS scoped. Reported NOT_CONFIGURED and excluded from the
  // roll-up so it never drags a healthy project away from HEALTHY.
  checks.push({
    key: "critical_resource",
    layer: "dependency",
    required: "critical",
    status: "NOT_CONFIGURED",
    reason: "dependency_not_configured",
  });

  const status = rollUp(checks);
  const { code, retryAfter } = httpStatusFor(status);
  const headers = { "Cache-Control": "no-store" };
  if (retryAfter !== undefined) headers["Retry-After"] = String(retryAfter);

  return {
    body: { schema_version: SCHEMA_VERSION, project_id: PROJECT_ID, status, generated_at: generatedAt, checks },
    code,
    headers,
  };
}

export default async function handler(req, res) {
  const method = String(req && req.method ? req.method : "GET").toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Cache-Control", "no-store");
    res.status(405).end();
    return;
  }

  const { body, code, headers } = await computeHealth();
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(code);

  if (method === "HEAD") {
    res.end();
    return;
  }
  res.end(JSON.stringify(body));
}

// Exported for deterministic unit tests only (no side effects on import).
export const __test__ = { computeHealth, rollUp, mapPlatform, mapAuth, normalizeBaseUrl, PROBE_TIMEOUT_MS };
