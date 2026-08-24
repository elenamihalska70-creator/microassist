import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isTrialEmailsEnabled } from "./trialEmailsFlag.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// LOT 9.2: emergency server-side stop for obsolete trial/premium lifecycle
// emails. Root cause (LOT 9.1): this function has no dedup of its own, and
// the client-side trial_expired trigger condition never naturally resets
// after trial expiry, so every app visit past the 24h client-local
// cooldown re-sends a real email indefinitely. This flag is the narrowest
// server-side stop -- it does not touch dedup, email_events, trigger
// semantics, or trial policy (all explicitly out of scope this LOT).
//
// Fail-closed: only the exact string "true" enables sending. Absent,
// "false", or any other value disables it -- matches LOT 9.2 section 3.
const TRIAL_EMAILS_ENABLED = isTrialEmailsEnabled(Deno.env.get("TRIAL_EMAILS_ENABLED"));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Checked before any parsing, Resend client creation, or DB work (LOT
  // 9.2 section 4) -- no email/body is even read when disabled.
  if (!TRIAL_EMAILS_ENABLED) {
    console.log("[trial-email] skipped: disabled");
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: "trial_emails_disabled",
      }),
      { status: 200, headers: corsHeaders },
    );
  }

  try {
    const body = await req.json();
    const { email, subject, text, html, trialEndsAt, userId } = body;

    if (!email) {
      return new Response(
        JSON.stringify({
          ok: false,
          success: false,
          error: "Missing email",
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          success: false,
          error: "Missing RESEND_API_KEY secret",
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Microassist <onboarding@resend.dev>",
        to: email,
        subject: subject || "Test Microassist",
        html:
          html ||
          `<h2>Ton essai Premium se termine dans 7 jours</h2><p>Fin de l’essai : ${trialEndsAt || ""}</p>`,
        text:
          text ||
          `Ton essai Premium se termine bientôt. Fin de l’essai : ${trialEndsAt || ""}`,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          success: false,
          error: "Resend send failed",
          resend: resendData,
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        skipped: false,
        resend: resendData,
        meta: {
          userId: userId || null,
          email,
          trialEndsAt: trialEndsAt || null,
        },
      }),
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
