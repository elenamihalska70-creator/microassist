import { expect, test } from "@playwright/test";
import process from "node:process";

test("mounted auth finalization does not repeat invoice inserts during slow refreshes", async ({ page }) => {
  let inserts = 0;
  const userId = "11111111-1111-4111-8111-111111111111";
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.fallback();
    const path = url.pathname;
    if (path === "/rest/v1/invoices" && request.method() === "POST") inserts++;
    if (path === "/rest/v1/revenues" && request.method() === "GET") await new Promise(resolve => setTimeout(resolve, 900));
    const body = path === "/rest/v1/profiles" ? { id: userId, onboarding_completed: true, email: "synthetic@example.com" } : path.includes("/rest/v1/") ? [] : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.addInitScript(userId => {
    localStorage.setItem("beta_seen", "1");
    localStorage.setItem("microassist_pending_auth_success", "manual_auth");
    localStorage.setItem("guest_invoices", '[{"invoice_number":"SYNTHETIC-ONLY","amount":10,"invoice_date":"2026-01-01"}]');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = value => btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    const user = { id: userId, email: "synthetic@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
    localStorage.setItem("sb-bvymwuokljxgoavfehav-auth-token", JSON.stringify({ access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, aud: "authenticated", exp })}.synthetic`, refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 3600, expires_at: exp, user }));
  }, userId);
  await page.goto("/");
  if (process.env.LOT6C1_BEFORE === "1") {
    await expect.poll(() => inserts, { timeout: 20000 }).toBeGreaterThan(1);
  } else {
    await expect.poll(() => page.evaluate(() => localStorage.getItem("microassist_pending_auth_success")), { timeout: 20000 }).toBeNull();
    await page.waitForTimeout(2000);
    expect(inserts).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem("guest_invoices"))).toContain("SYNTHETIC-ONLY");
  }
});
