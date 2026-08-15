// supabase/functions/send-reminder/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { Resend } from "https://esm.sh/resend@4.3.0";
import { getEligibilityWindow } from "./reminderWindow.js";
import { buildAttemptMetadata } from "./reminderMetadata.js";
import { buildLogicalDeliveryKey, buildProviderIdempotencyKey } from "./reminderIdentity.js";
import { buildReminderPayload, REMINDER_TEMPLATE_VERSION } from "./reminderPayload.js";
import { hasDurableAcceptedOutcome } from "./reminderReplay.js";
import { buildNoEmailMetadata, resolveNoEmailFinalizeResult } from "./reminderNoEmail.js";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = "noreply@microassist.fr";
const APP_URL = Deno.env.get("APP_URL") || "https://microassist.fr";
const CLAIM_LEASE_MINUTES = 5;

interface User {
  id: string;
  email: string;
  userName?: string;
}

interface FiscalProfile {
  activity_type: string;
  declaration_frequency: string;
}

serve(async (req: Request) => {
  console.log("🚀 Fonction send-reminder démarrée");
  console.log("📅 Timestamp:", new Date().toISOString());

  const authHeader = req.headers.get("Authorization");
  console.log("🔑 Auth header present:", !!authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("❌ Unauthorized - missing or invalid token");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    console.log("🔄 Création du client Supabase...");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    console.log("✅ Client Supabase initialisé");

    const resend = new Resend(RESEND_API_KEY);
    console.log("✅ Client Resend initialisé");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { startDate: dateString, endDate: dayAfterTomorrowDateString } =
      getEligibilityWindow(today);
    console.log(`📅 Date cible: ${dateString}`);

    const { data: reminders, error: remindersError } = await supabaseClient
      .from("reminders")
      .select("*")
      .eq("status", "pending")
      .lte("reminder_date", dayAfterTomorrowDateString)
      .gte("reminder_date", dateString);

    if (remindersError) {
      console.error("❌ Error fetching reminders:", remindersError);
      return new Response(JSON.stringify({ error: remindersError.message }), { status: 500 });
    }

    console.log(`📊 ${reminders?.length || 0} reminders trouvés`);

    if (!reminders || reminders.length === 0) {
      console.log("ℹ️ Aucun rappel à envoyer");
      return new Response(JSON.stringify({ message: "No reminders to send" }), { status: 200 });
    }

    console.log(`📋 ${reminders.length} rappels à traiter`);
    const results = [];

    for (const reminder of reminders) {
      console.log(`🔄 Traitement du reminder ${reminder.id}, type: ${reminder.reminder_type}`);

      const logicalDeliveryKey = buildLogicalDeliveryKey(reminder);
      const idempotencyKey = buildProviderIdempotencyKey(logicalDeliveryKey);

      // Atomic DB claim (LOT 7.19). A claim loser must never call Resend.
      const { data: claimRows, error: claimError } = await supabaseClient.rpc(
        "claim_reminder",
        {
          p_reminder_id: reminder.id,
          p_logical_delivery_key: logicalDeliveryKey,
          p_lease_minutes: CLAIM_LEASE_MINUTES,
        },
      );

      if (claimError) {
        console.error(`❌ Claim RPC error for ${reminder.id}:`, claimError);
        results.push({ id: reminder.id, status: "skipped", reason: "claim_error" });
        continue;
      }

      const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
      if (!claim || !claim.claimed) {
        console.log(
          `⏭️ Reminder ${reminder.id} not claimed — another invocation holds it or it is no longer eligible`,
        );
        results.push({ id: reminder.id, status: "skipped", reason: "not_claimed" });
        continue;
      }

      const claimToken = claim.claim_token;
      const claimedMetadata = claim.metadata || {};

      // Replay safety (LOT 7.22): a prior attempt on this exact logical
      // delivery may have durably persisted a provider-accepted outcome
      // (Phase A) and then failed to finalize status (Phase B). Reclaiming
      // must not call Resend again in that case -- only the missing
      // finalize is still needed. Resend's own 24h idempotency dedup is a
      // second layer, not a substitute for checking this first.
      if (hasDurableAcceptedOutcome(claimedMetadata, logicalDeliveryKey)) {
        console.log(
          `♻️ Reminder ${reminder.id} already accepted by provider in a prior attempt — finalizing without resending`,
        );
        const { data: replayFinalizeRows, error: replayFinalizeError } = await supabaseClient
          .from("reminders")
          .update({ status: "sent" })
          .eq("id", reminder.id)
          .eq("metadata->claim->>claim_token", claimToken)
          .select("id");

        if (replayFinalizeError) {
          console.error(`❌ Replay finalize error for ${reminder.id}:`, replayFinalizeError);
          results.push({ id: reminder.id, status: "finalize_failed", provider_status: "accepted" });
        } else if (!replayFinalizeRows || replayFinalizeRows.length === 0) {
          console.warn(
            `⚠️ Replay finalize skipped for ${reminder.id}: claim no longer owned (reclaimed by a newer invocation)`,
          );
          results.push({ id: reminder.id, status: "skipped", reason: "claim_lost_before_replay_finalize" });
        } else {
          results.push({
            id: reminder.id,
            status: "sent",
            provider_status: "accepted",
            reason: "already_accepted_replay",
          });
        }
        continue;
      }

      const { data: userData } = await supabaseClient.auth.admin.getUserById(reminder.user_id);
      console.log(`👤 Utilisateur trouvé: ${userData?.user?.email ? "oui" : "non"}`);

      const user = { id: reminder.user_id, email: userData?.user?.email || "" } as User;

      const { data: fiscalProfileData } = await supabaseClient
        .from("fiscal_profiles")
        .select("activity_type, declaration_frequency")
        .eq("user_id", reminder.user_id)
        .single();
      const fiscalProfile = fiscalProfileData as FiscalProfile | null;

      if (!user?.email) {
        console.error(`❌ No email for user ${reminder.user_id}`);

        // No provider round-trip happens here, so this is not written
        // through buildAttemptMetadata (LOT 7.6/7.20 contract). Same
        // ownership discipline as every other finalize write in this loop:
        // claim-token filtered, error checked, affected rows checked. A
        // stale claimant must not overwrite a newer invocation's state.
        const { data: noEmailRows, error: noEmailError } = await supabaseClient
          .from("reminders")
          .update({
            status: "failed",
            metadata: buildNoEmailMetadata(claimedMetadata, new Date().toISOString()),
          })
          .eq("id", reminder.id)
          .eq("metadata->claim->>claim_token", claimToken)
          .select("id");

        if (noEmailError) {
          console.error(`❌ No-email finalize error for ${reminder.id}:`, noEmailError);
        } else if (!noEmailRows || noEmailRows.length === 0) {
          console.warn(
            `⚠️ No-email finalize skipped for ${reminder.id}: claim no longer owned (reclaimed by a newer invocation)`,
          );
        }
        results.push(resolveNoEmailFinalizeResult(reminder.id, { error: noEmailError, rows: noEmailRows }));
        continue;
      }

      // Payload stability (LOT 7.18/7.20): reuse a frozen rendering from an
      // earlier interrupted attempt on this exact logical delivery if one
      // exists, otherwise render fresh. Absolute-date wording already makes
      // rendering deterministic regardless of "today"; freezing additionally
      // protects against a template change deployed between retries.
      const hasFrozenPayload =
        typeof claimedMetadata.rendered_subject === "string" &&
        typeof claimedMetadata.rendered_html === "string";

      const rendered = hasFrozenPayload
        ? { subject: claimedMetadata.rendered_subject, html: claimedMetadata.rendered_html }
        : buildReminderPayload({
            reminderType: reminder.reminder_type,
            reminderDate: reminder.reminder_date,
            declarationFrequency: fiscalProfile?.declaration_frequency,
            activityType: fiscalProfile?.activity_type,
            appUrl: APP_URL,
          });
      const { subject, html: htmlContent } = rendered;

      // Recipient frozen at first claim (LOT 7.18 section 10): guarantees a
      // stable `to` field under the same idempotency key even if the user
      // changes their email between retries.
      const recipientSnapshot =
        typeof claimedMetadata.recipient_snapshot === "string"
          ? claimedMetadata.recipient_snapshot
          : user.email;

      const frozenFields = {
        ...claimedMetadata,
        logical_delivery_key: logicalDeliveryKey,
        idempotency_key: idempotencyKey,
        template_version: REMINDER_TEMPLATE_VERSION,
        rendered_subject: subject,
        rendered_html: htmlContent,
        recipient_snapshot: recipientSnapshot,
      };

      console.log(`📧 Envoi d'email (idempotency key: ${idempotencyKey})`);

      let outcomeMetadata;
      let finalStatus;

      try {
        const { data: emailData, error: emailError } = await resend.emails.send(
          {
            from: FROM_EMAIL,
            to: [recipientSnapshot],
            subject,
            html: htmlContent,
          },
          { idempotencyKey },
        );

        if (emailError) {
          // The bundled resend@4.3.0 type declarations do not (yet) list
          // these two idempotency-specific error names in their literal
          // union, even though the Resend API can return them (LOT 7.17
          // "External Provider Evidence"; confirmed absent from
          // RESEND_ERROR_CODES_BY_KEY by direct inspection of the shipped
          // .d.ts). Comparing via a widened type reflects the real,
          // documented API surface rather than the currently-incomplete
          // type declaration.
          const errorName = emailError.name as string;
          if (errorName === "invalid_idempotent_request") {
            console.error(`⚠️ Idempotency payload conflict for ${reminder.id}:`, emailError.message);
            outcomeMetadata = buildAttemptMetadata(frozenFields, {
              attemptedAt: new Date().toISOString(),
              providerStatus: "conflict",
              failureReason: emailError.message,
            });
          } else if (errorName === "concurrent_idempotent_requests") {
            console.log(`⏭️ Concurrent idempotent request in flight for ${reminder.id}`);
            outcomeMetadata = buildAttemptMetadata(frozenFields, {
              attemptedAt: new Date().toISOString(),
              providerStatus: "concurrent",
              failureReason: emailError.message,
            });
          } else {
            console.error(`❌ Error sending email:`, emailError);
            outcomeMetadata = buildAttemptMetadata(frozenFields, {
              attemptedAt: new Date().toISOString(),
              providerStatus: "failed",
              failureReason: emailError.message,
            });
          }
          finalStatus = "failed";
        } else {
          console.log(`✅ Email envoyé à ${recipientSnapshot}`);
          outcomeMetadata = buildAttemptMetadata(frozenFields, {
            attemptedAt: new Date().toISOString(),
            providerStatus: "accepted",
            providerMessageId: emailData?.id ?? null,
          });
          finalStatus = "sent";
        }
      } catch (emailError) {
        // No definite response was received (network error / timeout / the
        // fetch itself rejected). Resend may still have processed the
        // request. Never treat this as a definite failure: record it as
        // UNKNOWN and keep the same idempotency_key so that if this reminder
        // is ever retried later, Resend's own 24h dedup can catch a genuine
        // duplicate even if our own bookkeeping could not confirm the
        // outcome (LOT 7.18 sections 13/15).
        console.error(`❓ Unknown provider outcome (no response) for ${reminder.id}:`, emailError);
        outcomeMetadata = buildAttemptMetadata(frozenFields, {
          attemptedAt: new Date().toISOString(),
          providerStatus: "unknown",
          failureReason: String(emailError),
        });
        finalStatus = "failed";
      }

      // Phase A (LOT 7.22): persist the provider outcome durably BEFORE
      // finalizing status. Ownership-checked: only the invocation still
      // holding this exact claim_token may write. If this fails or the
      // claim was lost, status is left untouched (still "pending") and a
      // future reclaim will safely re-evaluate from scratch -- no state is
      // written that could be mistaken for a completed outcome.
      const { data: outcomeRows, error: outcomeError } = await supabaseClient
        .from("reminders")
        .update({ metadata: outcomeMetadata })
        .eq("id", reminder.id)
        .eq("metadata->claim->>claim_token", claimToken)
        .select("id");

      if (outcomeError) {
        console.error(`❌ Outcome persistence error for ${reminder.id}:`, outcomeError);
        results.push({
          id: reminder.id,
          status: "outcome_persist_failed",
          provider_status: outcomeMetadata.provider_status,
        });
        continue;
      }
      if (!outcomeRows || outcomeRows.length === 0) {
        console.warn(
          `⚠️ Outcome persistence skipped for ${reminder.id}: claim no longer owned (reclaimed by a newer invocation)`,
        );
        results.push({ id: reminder.id, status: "skipped", reason: "claim_lost_before_outcome_persist" });
        continue;
      }

      // Phase B: finalize the coarse reminder status separately. A failure
      // here no longer erases the provider outcome recorded in Phase A --
      // that write already survives on the row.
      const { data: finalizeRows, error: finalizeError } = await supabaseClient
        .from("reminders")
        .update({ status: finalStatus })
        .eq("id", reminder.id)
        .eq("metadata->claim->>claim_token", claimToken)
        .select("id");

      if (finalizeError) {
        console.error(`❌ Finalize status update error for ${reminder.id}:`, finalizeError);
        results.push({
          id: reminder.id,
          status: "finalize_failed",
          provider_status: outcomeMetadata.provider_status,
        });
        continue;
      }
      if (!finalizeRows || finalizeRows.length === 0) {
        console.warn(
          `⚠️ Finalize skipped for ${reminder.id}: claim no longer owned (reclaimed by a newer invocation)`,
        );
        results.push({ id: reminder.id, status: "skipped", reason: "claim_lost_before_finalize" });
        continue;
      }

      results.push({
        id: reminder.id,
        status: finalStatus,
        provider_status: outcomeMetadata.provider_status,
      });
    }

    console.log(`🏁 Fin. ${results.length} rappels traités`);
    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
