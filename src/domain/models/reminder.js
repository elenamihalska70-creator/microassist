import {
  DATA_SOURCES,
  REMINDER_STATUSES,
  REMINDER_TYPES,
} from "../constants.js";
import { normalizeDateOnly } from "../validation.js";
import { normalizeObject, pickKnown } from "./shared.js";

/**
 * Existing sources:
 * - `DEFAULT_REMINDER_PREFS` in App.jsx.
 * - localStorage `microassist_reminder_prefs`.
 * - Supabase `reminders`.
 * - Supabase `fiscal_profiles.reminder_*` columns.
 */

export function normalizeReminder(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    id: source.id || null,
    userId: source.userId || source.user_id || null,
    type: pickKnown(
      source.type || source.reminder_type,
      REMINDER_TYPES,
      REMINDER_TYPES.declaration,
    ),
    date: normalizeDateOnly(source.date || source.reminder_date),
    status: pickKnown(source.status, REMINDER_STATUSES, REMINDER_STATUSES.pending),
    email: Boolean(source.email ?? source.reminder_email ?? true),
    sms: Boolean(source.sms ?? source.reminder_sms ?? false),
    createdAt: source.createdAt || source.created_at || null,
    updatedAt: source.updatedAt || source.updated_at || null,
    source: source.source || DATA_SOURCES.supabase,
  };
}

export function normalizeNotificationPreference(input = {}) {
  const source = normalizeObject(input);

  return {
    ...source,
    declaration: Boolean(source.declaration ?? true),
    tva: Boolean(source.tva ?? true),
    cfe: Boolean(source.cfe ?? true),
    acre: Boolean(source.acre ?? true),
    email: Boolean(source.email ?? true),
    sms: Boolean(source.sms ?? false),
    source: source.source || DATA_SOURCES.localStorage,
  };
}
