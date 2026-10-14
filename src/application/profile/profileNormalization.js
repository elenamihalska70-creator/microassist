export function normalizeDateValue(value) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return raw;

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function pickProfileField(source, aliases) {
  if (!source || typeof source !== "object") return null;

  for (const key of aliases) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

export function normalizeProfileConflictValue(value, type = "string") {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (type === "date") {
    return normalizeDateValue(value) || null;
  }

  if (type === "booleanish") {
    if (value === true || value === "true" || value === "yes") return "yes";
    if (value === false || value === "false" || value === "no") return "no";
  }

  return String(value).trim().toLowerCase();
}
