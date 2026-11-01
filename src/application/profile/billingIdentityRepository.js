const TABLE = "profiles";

/**
 * Saves the seller identity printed on invoices for the signed-in user.
 * Only profiles.billing_identity is written, through a targeted UPDATE of
 * the caller's own row: plan, premium, trial, onboarding and every other
 * profile column are never part of the request, so a profile that failed to
 * load (or a stale copy of it) can never be written back over the stored one.
 *
 * Takes the Supabase client as an explicit parameter so the behaviour stays
 * testable without a network call. Throws on any failure, including an
 * update that matched no row (expired session, missing profile): the caller
 * reports it and keeps its draft.
 */
export async function updateBillingIdentity(supabaseClient, userId, billingIdentity) {
  if (!supabaseClient || !userId) {
    throw new Error("Billing identity requires a signed-in user.");
  }

  const { data, error } = await supabaseClient
    .from(TABLE)
    .update({ billing_identity: billingIdentity })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Billing identity was not saved: no profile row was updated.");
  return data;
}
