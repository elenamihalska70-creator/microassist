export const MONEY_INVALID_VALUE_POLICIES = Object.freeze({
  reject: "reject",
  null: "null",
  zero: "zero",
});

export const MONEY_ROUNDING_STRATEGIES = Object.freeze({
  nearest: "nearest",
  floor: "floor",
  ceil: "ceil",
  truncate: "truncate",
});

const DEFAULT_INVALID_VALUE_POLICY = MONEY_INVALID_VALUE_POLICIES.null;

function resolveInvalidValue(policy) {
  if (policy === MONEY_INVALID_VALUE_POLICIES.zero) return 0;
  if (policy === MONEY_INVALID_VALUE_POLICIES.reject) {
    throw new TypeError("Invalid money value");
  }
  return null;
}

function normalizeNumericInput(value, { allowDecimalComma = false } = {}) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    return allowDecimalComma ? trimmed.replace(",", ".") : trimmed;
  }

  return value;
}

export function isFiniteMoneyValue(value, options = {}) {
  const normalized = normalizeNumericInput(value, options);
  if (normalized === null || normalized === undefined) return false;
  return Number.isFinite(Number(normalized));
}

export function parseMoneyValue(value, options = {}) {
  const {
    allowDecimalComma = false,
    invalidValue = DEFAULT_INVALID_VALUE_POLICY,
  } = options;
  const normalized = normalizeNumericInput(value, { allowDecimalComma });

  if (normalized === null || normalized === undefined) {
    return resolveInvalidValue(invalidValue);
  }

  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    return resolveInvalidValue(invalidValue);
  }

  return number;
}

export function normalizeMoney(value, options = {}) {
  const { allowNegative = true } = options;
  const number = parseMoneyValue(value, options);

  if (number === null) return null;
  if (!allowNegative && number < 0) {
    return resolveInvalidValue(options.invalidValue || DEFAULT_INVALID_VALUE_POLICY);
  }

  return number;
}

export function toFiniteNumberOrZero(value, options = {}) {
  return parseMoneyValue(value, {
    ...options,
    invalidValue: MONEY_INVALID_VALUE_POLICIES.zero,
  });
}

export function clampNonNegative(value, options = {}) {
  const number = parseMoneyValue(value, {
    ...options,
    invalidValue: MONEY_INVALID_VALUE_POLICIES.zero,
  });

  return Math.max(0, number);
}

export function sumMoney(values, options = {}) {
  if (!Array.isArray(values)) {
    return resolveInvalidValue(options.invalidValue || DEFAULT_INVALID_VALUE_POLICY);
  }

  return values.reduce((sum, value) => {
    const number = parseMoneyValue(value, options);
    return number === null ? sum : sum + number;
  }, 0);
}

export function roundMoney(value, options = {}) {
  const {
    strategy = MONEY_ROUNDING_STRATEGIES.nearest,
    precision = 2,
  } = options;
  const number = parseMoneyValue(value, options);

  if (number === null) return null;

  const decimalPlaces = Number(precision);
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
    throw new RangeError("precision must be a zero or positive integer");
  }

  const factor = 10 ** decimalPlaces;
  const scaled = number * factor;

  if (strategy === MONEY_ROUNDING_STRATEGIES.floor) {
    return Math.floor(scaled) / factor;
  }

  if (strategy === MONEY_ROUNDING_STRATEGIES.ceil) {
    return Math.ceil(scaled) / factor;
  }

  if (strategy === MONEY_ROUNDING_STRATEGIES.truncate) {
    return Math.trunc(scaled) / factor;
  }

  if (strategy === MONEY_ROUNDING_STRATEGIES.nearest) {
    return Math.round(scaled) / factor;
  }

  throw new RangeError("Unknown money rounding strategy");
}

export function roundEuro(value, options = {}) {
  return roundMoney(value, {
    ...options,
    strategy: options.strategy || MONEY_ROUNDING_STRATEGIES.nearest,
    precision: 0,
  });
}

export function multiplyMoneyByRate(amount, rate, options = {}) {
  const parsedAmount = parseMoneyValue(amount, options);
  const parsedRate = parseMoneyValue(rate, options);

  if (parsedAmount === null || parsedRate === null) return null;

  return parsedAmount * parsedRate;
}

export function areMoneyValuesEqual(a, b, options = {}) {
  const { tolerance = 0 } = options;
  const first = parseMoneyValue(a, options);
  const second = parseMoneyValue(b, options);
  const parsedTolerance = parseMoneyValue(tolerance, {
    ...options,
    invalidValue: MONEY_INVALID_VALUE_POLICIES.reject,
  });

  if (first === null || second === null) return false;
  if (parsedTolerance < 0) {
    throw new RangeError("tolerance must be zero or positive");
  }

  return Math.abs(first - second) <= parsedTolerance;
}
