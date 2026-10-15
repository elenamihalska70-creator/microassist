import { expect, test } from "@playwright/test";

for (const suspended of ["revenues", "invoices"]) {
  test(`actual React root unmount during ${suspended} prevents subsequent writes and cleanup`, async ({ page }) => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const writes = [];
    let waiting = false, completed = false;
    // Expose only the real root handle in the served test entry. App and its
    // effects remain unmodified; unmount runs React's actual layout cleanup.
    await page.route("**/src/main.jsx*", async route => {
      const response = await route.fetch();
      const source = await response.text();
      const root = 'ReactDOM.createRoot(document.getElementById("root"))';
      expect(source).toContain(root);
      await route.fulfill({ response, body: source.replace(root, `(window.__lotRoot = ${root})`) });
    });
    await page.route("**://*.supabase.co/**", async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (!["GET", "OPTIONS"].includes(request.method())) writes.push(`${request.method()} ${path}`);
      const pending = path === `/rest/v1/${suspended}` && request.method() === "POST";
      if (pending) { waiting = true; await gate; }
      const body = path === "/rest/v1/profiles" ? { id: "11111111-1111-4111-8111-111111111111", onboarding_completed: true } : path.includes("/rest/v1/") ? [] : {};
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (pending) completed = true;
    });
    await page.addInitScript(() => {
      localStorage.setItem("beta_seen", "1");
      localStorage.setItem("microassist_pending_auth_success", "manual_auth");
      localStorage.setItem("revenues_guest", '[{"id":1,"amount":10,"date":"2026-01-01"}]');
      localStorage.setItem("guest_invoices", '[{"invoice_number":"SYNTHETIC","amount":10,"invoice_date":"2026-01-01"}]');
      localStorage.setItem("microassist_reminder_prefs", '{"email":true}');
      const id = "11111111-1111-4111-8111-111111111111", exp = Math.floor(Date.now() / 1000) + 3600;
      const encode = value => btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      const user = { id, email: "synthetic@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
      localStorage.setItem("sb-bvymwuokljxgoavfehav-auth-token", JSON.stringify({ access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, aud: "authenticated", exp })}.synthetic`, refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 3600, expires_at: exp, user }));
    });
    try {
      await page.goto("/");
      await expect.poll(() => waiting, { timeout: 20000 }).toBe(true);
      const snapshot = await page.evaluate(() => ["revenues_guest", "guest_invoices", "microassist_reminder_prefs", "microassist_pending_auth_success"].map(key => localStorage.getItem(key)));
      const issued = [...writes];
      await page.evaluate(() => window.__lotRoot.unmount());
      await expect(page.locator("#root")).toBeEmpty();
      release();
      await expect.poll(() => completed).toBe(true);
      await page.waitForTimeout(1500);
      expect(writes).toEqual(issued);
      expect(await page.evaluate(() => ["revenues_guest", "guest_invoices", "microassist_reminder_prefs", "microassist_pending_auth_success"].map(key => localStorage.getItem(key)))).toEqual(snapshot);
    } finally {
      release();
    }
  });
}
