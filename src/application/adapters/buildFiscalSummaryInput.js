const INPUT_FIELDS = Object.freeze([
  "revenues",
  "fiscalProfile",
  "period",
  "referenceDate",
]);

const REQUIRED_PROFILE_FIELDS = Object.freeze([
  "activity_type",
  "acre",
  "acre_start_date",
]);

// LOT 10.1B: business_start_date is accepted but not required, so existing
// callers that never carried this field (predating the ACRE reform) keep
// working unchanged; when absent it maps to undefined, which the ACRE rule
// already treats as "regime unknown, apply full rate" rather than guessing.
const KNOWN_PROFILE_FIELDS = Object.freeze([
  ...REQUIRED_PROFILE_FIELDS,
  "business_start_date",
]);

function assertPlainObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }
}

function assertKnownFields(value, allowedFields, message) {
  for (const field of Object.keys(value)) {
    if (!allowedFields.includes(field)) {
      throw new TypeError(message);
    }
  }
}

function assertRequiredFields(value, requiredFields, message) {
  for (const field of requiredFields) {
    if (!Object.hasOwn(value, field)) {
      throw new TypeError(message);
    }
  }
}

function copyRevenueEntry(entry) {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    return { ...entry };
  }

  return entry;
}

export function buildFiscalSummaryInput(input) {
  if (arguments.length > 1) {
    throw new TypeError("buildFiscalSummaryInput does not accept options");
  }

  assertPlainObject(input, "buildFiscalSummaryInput expects an input object");
  assertKnownFields(input, INPUT_FIELDS, "buildFiscalSummaryInput input contains unknown fields");
  assertRequiredFields(input, INPUT_FIELDS, "buildFiscalSummaryInput input is missing required fields");

  if (!Array.isArray(input.revenues)) {
    throw new TypeError("buildFiscalSummaryInput revenues must be an array");
  }

  assertPlainObject(
    input.fiscalProfile,
    "buildFiscalSummaryInput fiscalProfile must be an object",
  );
  assertKnownFields(
    input.fiscalProfile,
    KNOWN_PROFILE_FIELDS,
    "buildFiscalSummaryInput fiscalProfile contains unknown fields",
  );
  assertRequiredFields(
    input.fiscalProfile,
    REQUIRED_PROFILE_FIELDS,
    "buildFiscalSummaryInput fiscalProfile is missing required fields",
  );
  assertPlainObject(input.period, "buildFiscalSummaryInput period must be an object");

  return {
    revenues: input.revenues.map(copyRevenueEntry),
    fiscalProfile: {
      activityType: input.fiscalProfile.activity_type,
      acre: input.fiscalProfile.acre,
      acreStartDate: input.fiscalProfile.acre_start_date,
      businessStartDate: input.fiscalProfile.business_start_date,
    },
    period: { ...input.period },
    referenceDate: input.referenceDate,
  };
}
