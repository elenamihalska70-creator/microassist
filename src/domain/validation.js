export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isKnownValue(value, allowedValues) {
  return Object.values(allowedValues).includes(value);
}

export function isValidDateOnly(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
  );
}

export function isValidTimestamp(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function normalizeNonNegativeAmount(value, fallback = 0) {
  const number = toNumberOrNull(value);
  if (number === null || number < 0) return fallback;
  return number;
}

export function normalizeDateOnly(value) {
  return isValidDateOnly(value) ? value : null;
}

export function normalizeTimestamp(value) {
  return isValidTimestamp(value) ? value : null;
}

export function validateIdentifier(value, fieldName = "id") {
  const errors = [];
  if (value === null || value === undefined || String(value).trim() === "") {
    errors.push(`${fieldName} is required`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateNonNegativeAmount(value, fieldName = "amount") {
  const errors = [];
  const amount = toNumberOrNull(value);
  if (amount === null) {
    errors.push(`${fieldName} must be numeric`);
  } else if (amount < 0) {
    errors.push(`${fieldName} must be zero or positive`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateDateOnly(value, fieldName = "date") {
  const errors = [];
  if (!isValidDateOnly(value)) {
    errors.push(`${fieldName} must use YYYY-MM-DD`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateKnownValue(value, allowedValues, fieldName = "status") {
  const errors = [];
  if (!isKnownValue(value, allowedValues)) {
    errors.push(`${fieldName} is not allowed`);
  }

  return { valid: errors.length === 0, errors };
}
