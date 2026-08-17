// supabase/functions/resend-webhook/index.ts
//
// LOT 8.13: receives Resend delivery-event webhooks and persists verified
// evidence into delivery_events (LOT 8.12 model). Deliberately a SEPARATE
// function from send-reminder (LOT 8.11 section 17): different trigger
// source (Resend, not cron/manual), different auth model (Svix signature,
// not a Supabase-issued Bearer JWT), different failure semantics (must
// ack fast or trigger Resend's own 24h retry, unrelated to reminder
// claim/lease timing).
//
// DEPLOYMENT NOTE (not applied this LOT -- LOT 8.13 forbids deployment):
// this function MUST be deployed with verify_jwt=false (`supabase
// functions deploy resend-webhook --no-verify-jwt`). Resend cannot supply
// a Supabase-issued JWT, so leaving Supabase's own gateway auth on would
// reject every genuine Resend call before this code ever runs. This is
// acceptable ONLY because Svix signature verification below becomes the
// actual authentication boundary instead -- every request is rejected
// before its payload is trusted unless it carries a valid signature over
// RESEND_WEBHOOK_SECRET. This project already has a verify_jwt=false
// precedent (send-trial-ending-email); send-reminder's verify_jwt=true
// is untouched by this LOT.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { Webhook } from "https://esm.sh/svix@1.99.1";
import { extractSvixHeaders } from "./webhookHeaders.js";
import { buildDeliveryEventRecord } from "./buildDeliveryEventRecord.js";
import { isDuplicateSvixIdError } from "./duplicateInsertOutcome.js";
import {
  isSupportedEventType,
  extractProviderMessageId,
  normalizeEventCreatedAt,
} from "../_shared/deliveryEvents/deliveryEventValidation.js";

const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";

serve(async (req: Request) => {
  console.log("🚀 Fonction resend-webhook démarrée");

  // Section 3: absent secret -> deterministic server error, event never
  // processed, never a silent no-op that would look like success to Resend.
  if (!RESEND_WEBHOOK_SECRET) {
    console.error("❌ RESEND_WEBHOOK_SECRET is not configured");
    return new Response(JSON.stringify({ error: "webhook not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Section 4: raw body captured BEFORE any parsing -- Svix verification
  // signs the exact bytes Resend sent; re-serializing a parsed object
  // would very likely produce a byte-for-byte different string and make
  // every signature fail.
  const rawBody = await req.text();

  const svixHeaders = extractSvixHeaders(req.headers);
  if (!svixHeaders) {
    console.error("❌ Missing required Svix headers (svix-id/svix-timestamp/svix-signature)");
    return new Response(JSON.stringify({ error: "missing signature headers" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Section 5/6: nothing about rawBody is trusted before this succeeds.
  let verifiedPayload: { type?: string; created_at?: string; data?: Record<string, unknown> };
  try {
    const wh = new Webhook(RESEND_WEBHOOK_SECRET);
    verifiedPayload = wh.verify(rawBody, {
      "svix-id": svixHeaders.svixId,
      "svix-timestamp": svixHeaders.svixTimestamp,
      "svix-signature": svixHeaders.svixSignature,
    }) as typeof verifiedPayload;
  } catch (verifyError) {
    // Never log the signature/secret themselves -- only that verification
    // failed and, if present, the library's own (non-secret) message.
    console.error("❌ Svix signature verification failed:", (verifyError as Error)?.message ?? "unknown");
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventType = verifiedPayload?.type;
  console.log(`📩 Verified event: ${eventType} (svix-id: ${svixHeaders.svixId})`);

  // Section 6: unsupported event types are acknowledged, not persisted --
  // Resend must not retry something we deliberately don't model, and this
  // codebase's own event-type contract lives in one place (LOT 8.12
  // deliveryEventValidation.js), not duplicated here.
  if (!isSupportedEventType(eventType)) {
    console.log(`ℹ️ Unsupported event type ignored: ${eventType}`);
    return new Response(JSON.stringify({ message: "event type ignored" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const providerMessageId = extractProviderMessageId(verifiedPayload);
  const eventCreatedAt = normalizeEventCreatedAt(verifiedPayload?.created_at);

  if (!providerMessageId || !eventCreatedAt) {
    console.error("❌ Verified payload missing email_id or created_at");
    return new Response(JSON.stringify({ error: "malformed verified payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Section 7/8: correlate by provider_message_id only, never by
    // recipient email. No match is not an error -- LOT 8.12 section 14
    // decision: preserve the verified event uncorrelated (reminder_id
    // null) rather than reject it.
    const { data: matchedReminder, error: lookupError } = await supabaseClient
      .from("reminders")
      .select("id")
      .eq("metadata->>provider_message_id", providerMessageId)
      .maybeSingle();

    if (lookupError) {
      console.error("❌ Reminder correlation lookup failed:", lookupError);
      return new Response(JSON.stringify({ error: "internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!matchedReminder) {
      console.log(`ℹ️ No reminder matched provider_message_id ${providerMessageId} — storing uncorrelated`);
    }

    const record = buildDeliveryEventRecord(verifiedPayload, {
      svixId: svixHeaders.svixId,
      eventType,
      providerMessageId,
      eventCreatedAt,
      reminderId: matchedReminder?.id ?? null,
    });

    const { error: insertError } = await supabaseClient.from("delivery_events").insert(record);

    if (insertError) {
      // Section 10: a duplicate svix_id is an idempotent replay, not a
      // failure -- Resend must see 2xx so it stops retrying a webhook
      // we've already durably recorded.
      if (isDuplicateSvixIdError(insertError)) {
        console.log(`♻️ Duplicate webhook delivery for svix-id ${svixHeaders.svixId} — idempotent replay`);
        return new Response(JSON.stringify({ message: "duplicate event, already processed" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      console.error("❌ delivery_events insert failed:", insertError);
      return new Response(JSON.stringify({ error: "internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`✅ delivery_events row persisted: ${eventType} / ${providerMessageId}`);
    return new Response(JSON.stringify({ message: "event processed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
