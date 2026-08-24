// supabase/functions/send-trial-ending-email/index.ts
//
// LOT 9.2: emergency server-side kill switch for obsolete trial/premium
// lifecycle emails -- unchanged and still checked first, before any
// other work.
//
// LOT 10.1G: closes the two findings from LOT 10.1F --
//   1. This endpoint no longer trusts any client-supplied recipient
//      email, user id, subject, HTML, text, event type, or trial_ends_at.
//      The caller's own Supabase-issued access token is verified
//      server-side (auth.getUser), and user_id/email come only from that
//      verified identity -- an authenticated caller can only ever act on
//      their own account.
//   2. Duplicate-send protection is now a DB-enforced atomic claim
//      (trial_email_events + claim_trial_email/finalize_trial_email),
//      adapted directly from the reminder subsystem's claim_reminder
//      pattern, replacing the removed check-then-act email_events logic
//      that could race under concurrent requests (LOT 10.1F section C).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { isTrialEmailsEnabled } from "./trialEmailsFlag.js";
import { buildTrialEmailLogicalKey, buildTrialEmailIdempotencyKey } from "./trialEmailIdentity.js";
import { computeTrialDaysLeft, resolveTrialEventType } from "./trialEmailLifecycle.js";
import { buildTrialEmailTemplate } from "./trialEmailTemplates.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Fail-closed: only the exact string "true" enables sending. Absent,
// "false", or any other value disables it.
const TRIAL_EMAILS_ENABLED = isTrialEmailsEnabled(Deno.env.get("TRIAL_EMAILS_ENABLED"));
const CLAIM_LEASE_MINUTES = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Checked before any auth verification, DB read, or provider call --
  // no request is even authenticated when disabled.
  if (!TRIAL_EMAILS_ENABLED) {
    console.log("[trial-email] skipped: disabled");
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "trial_emails_disabled" }),
      { status: 200, headers: corsHeaders },
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ ok: false, success: false, error: "Unauthorized" }),
      { status: 401, headers: corsHeaders },
    );
  }
  const accessToken = authHeader.slice("Bearer ".length).trim();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ ok: false, success: false, error: "Missing Supabase environment variables" }),
      { status: 500, headers: corsHeaders },
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Real identity verification: auth.getUser validates the caller's own
  // token against Supabase Auth. user_id/email below come ONLY from this
  // verified result -- the request body is never consulted for either,
  // so an authenticated caller cannot target another user's email.
  const { data: verifiedUser, error: verifyError } = await supabaseAdmin.auth.getUser(accessToken);
  if (verifyError || !verifiedUser?.user) {
    console.log("[trial-email] rejected: invalid or expired token");
    return new Response(
      JSON.stringify({ ok: false, success: false, error: "Unauthorized" }),
      { status: 401, headers: corsHeaders },
    );
  }

  const userId = verifiedUser.user.id;
  const email = verifiedUser.user.email;

  if (!email) {
    return new Response(
      JSON.stringify({ ok: false, success: false, error: "Verified account has no email" }),
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    // Server-verified trial state: profiles.trial_ends_at is the same
    // column the client's own UI is populated from (src/App.jsx
    // userProfile/profiles read), so a legitimate user's experience is
    // unchanged -- only the request body's claimed trialEndsAt is no
    // longer trusted.
    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("trial_ends_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[trial-email] profile lookup failed:", profileError.message);
      return new Response(
        JSON.stringify({ ok: false, success: false, error: "Profile lookup failed" }),
        { status: 500, headers: corsHeaders },
      );
    }

    const trialEndsAt = profileRow?.trial_ends_at ?? null;
    if (!trialEndsAt) {
      console.log("[trial-email] skipped: no_trial_state");
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "no_trial_state" }),
        { status: 200, headers: corsHeaders },
      );
    }

    // Event type is derived here, from the server's own read of
    // trial_ends_at -- never taken from the request body.
    const daysLeft = computeTrialDaysLeft(trialEndsAt);
    const eventType = resolveTrialEventType(daysLeft);
    if (!eventType) {
      console.log("[trial-email] skipped: not_due");
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "not_due" }),
        { status: 200, headers: corsHeaders },
      );
    }

    const logicalKey = buildTrialEmailLogicalKey({ userId, eventType, trialEndsAt });
    const idempotencyKey = buildTrialEmailIdempotencyKey(logicalKey);

    // Atomic DB claim. A claim loser must never call Resend.
    const { data: claimRows, error: claimError } = await supabaseAdmin.rpc("claim_trial_email", {
      p_user_id: userId,
      p_event_type: eventType,
      p_trial_ends_at: trialEndsAt,
      p_lease_minutes: CLAIM_LEASE_MINUTES,
    });

    if (claimError) {
      console.error("[trial-email] claim RPC error:", claimError.message);
      return new Response(
        JSON.stringify({ ok: false, success: false, error: "Claim failed" }),
        { status: 500, headers: corsHeaders },
      );
    }

    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    if (!claim?.claimed) {
      console.log(`[trial-email] skipped: already_handled (${eventType})`);
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "already_handled" }),
        { status: 200, headers: corsHeaders },
      );
    }

    const claimToken = claim.claim_token;
    const template = buildTrialEmailTemplate(eventType, { trialEndsAt });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      await supabaseAdmin.rpc("finalize_trial_email", {
        p_user_id: userId,
        p_event_type: eventType,
        p_trial_ends_at: trialEndsAt,
        p_claim_token: claimToken,
        p_status: "failed",
      });
      return new Response(
        JSON.stringify({ ok: false, success: false, error: "Missing RESEND_API_KEY secret" }),
        { status: 500, headers: corsHeaders },
      );
    }

    let outcomeStatus;
    let providerMessageId = null;

    try {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          // Second, independent layer of dedup at the provider itself
          // (LOT 10.1F section F) -- protects against a network-
          // ambiguous outcome even if our own claim bookkeeping is ever
          // inconclusive.
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          from: "Microassist <onboarding@resend.dev>",
          to: email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        }),
      });

      const resendData = await resendResponse.json();

      if (resendResponse.ok) {
        outcomeStatus = "sent";
        providerMessageId = resendData?.id ?? null;
      } else {
        // Never a real send -- safe to leave reclaimable for a later
        // retry.
        outcomeStatus = "failed";
      }
    } catch (sendError) {
      // No definite response (network error/timeout). Resend may still
      // have processed the request -- record as unknown (reclaimable),
      // never as a definite failure, and rely on the idempotency key
      // above if a later retry re-reaches Resend.
      console.error(
        `[trial-email] provider call threw for ${eventType}:`,
        sendError instanceof Error ? sendError.message : "unknown error",
      );
      outcomeStatus = "unknown";
    }

    const { data: finalized } = await supabaseAdmin.rpc("finalize_trial_email", {
      p_user_id: userId,
      p_event_type: eventType,
      p_trial_ends_at: trialEndsAt,
      p_claim_token: claimToken,
      p_status: outcomeStatus,
      p_provider_message_id: providerMessageId,
    });

    if (!finalized) {
      console.warn(`[trial-email] finalize skipped: claim no longer owned (${eventType})`);
    }

    if (outcomeStatus === "sent") {
      return new Response(
        JSON.stringify({ ok: true, success: true, skipped: false, meta: { eventType } }),
        { status: 200, headers: corsHeaders },
      );
    }

    return new Response(
      JSON.stringify({ ok: false, success: false, error: "Resend send failed", meta: { eventType } }),
      { status: 502, headers: corsHeaders },
    );
  } catch (error) {
    console.error("[trial-email] unexpected error:", error instanceof Error ? error.message : "unknown error");
    return new Response(
      JSON.stringify({ ok: false, success: false, error: "Internal server error" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
