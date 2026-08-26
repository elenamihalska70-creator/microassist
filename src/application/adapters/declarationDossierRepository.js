const TABLE = "declaration_dossiers";

/**
 * Thin I/O wrapper around public.declaration_dossiers (LOT 10.2D) and its
 * confirm_declaration/confirm_declaration_payment RPCs (LOT 10.2D.1). Takes
 * the Supabase client as an explicit parameter (not imported directly) so
 * this stays testable without a real network call -- all decision logic
 * (what to write, how to resolve status) lives in
 * src/domain/declarationDossier/, which never touches Supabase itself.
 *
 * LOT 10.2D.1: direct client INSERT/UPDATE on this table was removed after
 * an independent review found it let the row owner silently regress
 * already-confirmed history (clear/backdate declared_at or paid_at,
 * rewrite period identity, self-assign a stronger confirmation_source than
 * ever occurred). All writes now go through two SECURITY DEFINER RPCs that
 * enforce monotonic transitions server-side -- SELECT is the only direct
 * table privilege the authenticated role still has.
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

function firstRow(data) {
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

/**
 * Confirms (or edits) a declaration via the confirm_declaration RPC. The
 * RPC itself decides insert-vs-update based on the caller's own identity +
 * the period identity -- on an edit of an already-confirmed period, only
 * declared_revenue/actual_contributions/notes are actually applied; every
 * other field in `payload` is accepted but silently ignored server-side if
 * a row already exists, so this function does not need its own "is this a
 * first confirmation or an edit" branch.
 */
export async function saveDeclarationConfirmation(supabaseClient, payload) {
  const { data, error } = await supabaseClient.rpc("confirm_declaration", {
    p_declaration_type: payload.declaration_type,
    p_frequency: payload.frequency,
    p_period_start: payload.period_start,
    p_period_end: payload.period_end,
    p_due_date: payload.due_date,
    p_calculated_revenue: payload.calculated_revenue,
    p_estimated_contributions: payload.estimated_contributions,
    p_declared_revenue: payload.declared_revenue,
    p_actual_contributions: payload.actual_contributions,
    p_declared_at: payload.declared_at,
    p_notes: payload.notes,
  });

  if (error) throw error;
  return firstRow(data);
}

/**
 * Confirms payment via the confirm_declaration_payment RPC -- idempotent
 * (a repeat call, e.g. from a double-click, leaves an already-set paid_at
 * untouched rather than erroring or moving the timestamp) and requires the
 * dossier to already be declared (enforced server-side, in addition to the
 * table's own CHECK constraint).
 */
export async function savePaymentConfirmation(supabaseClient, dossierId, paidAt) {
  const { data, error } = await supabaseClient.rpc("confirm_declaration_payment", {
    p_dossier_id: dossierId,
    p_paid_at: paidAt ?? null,
  });

  if (error) throw error;
  return firstRow(data);
}
