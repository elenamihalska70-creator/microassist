const TABLE = "declaration_dossiers";
const IDENTITY_CONFLICT_TARGET = "user_id,declaration_type,period_start,period_end";

/**
 * Thin I/O wrapper around public.declaration_dossiers (LOT 10.2D). Takes
 * the Supabase client as an explicit parameter (not imported directly) so
 * this stays testable without a real network call -- all decision logic
 * (what to write, how to resolve status) lives in
 * src/domain/declarationDossier/, which never touches Supabase itself.
 */

export async function fetchDeclarationDossiers(supabaseClient, userId) {
  if (!supabaseClient || !userId) return [];

  const { data, error } = await supabaseClient
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("period_start", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Upserts a declaration confirmation. Relies on the DB's own unique
 * constraint (user_id, declaration_type, period_start, period_end) to
 * update-in-place if a dossier for this exact period was already
 * confirmed (e.g. the user edits their declared amount later) rather than
 * creating a duplicate row for the same period.
 */
export async function saveDeclarationConfirmation(supabaseClient, payload) {
  const { data, error } = await supabaseClient
    .from(TABLE)
    .upsert(payload, { onConflict: IDENTITY_CONFLICT_TARGET })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Confirms payment on an already-declared dossier. Scoped by both id and
 * user_id (defense in depth alongside RLS) so this can never touch a row
 * that both isn't the caller's own and isn't the intended dossier.
 */
export async function savePaymentConfirmation(supabaseClient, dossierId, userId, paymentPayload) {
  const { data, error } = await supabaseClient
    .from(TABLE)
    .update(paymentPayload)
    .eq("id", dossierId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
