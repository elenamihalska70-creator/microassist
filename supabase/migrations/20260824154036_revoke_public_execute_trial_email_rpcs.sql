-- LOT 10.1H follow-up, applied directly to production during release
-- verification. Post-migration verification of
-- 20260824000000_secure_and_deduplicate_trial_email_delivery.sql found
-- claim_trial_email/finalize_trial_email executable by PUBLIC (and
-- therefore anon/authenticated, who are implicitly members of PUBLIC)
-- in production, despite that migration's explicit
-- "revoke ... from anon, authenticated". PostgreSQL grants EXECUTE to
-- PUBLIC by default on function creation; revoking from named roles
-- alone does not remove a still-standing PUBLIC grant.
--
-- The pre-existing claim_reminder function does not have this gap
-- (verified live: anon/authenticated/public all show can_execute=false
-- for it) despite an identical revoke-from-named-roles pattern in its
-- own migration -- the most likely explanation is a per-role default
-- privilege configuration that applied to whatever role/session created
-- claim_reminder but not to the role this migration ran under. Rather
-- than depend on that ambient default, this migration closes the gap
-- explicitly for both new functions.

revoke execute on function public.claim_trial_email(uuid, text, timestamptz, integer) from public;
revoke execute on function public.finalize_trial_email(uuid, text, timestamptz, uuid, text, text) from public;
