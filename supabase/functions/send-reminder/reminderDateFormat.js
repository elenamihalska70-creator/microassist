// Pure, runtime-agnostic (Deno + Node) absolute French date formatting.
//
// Deliberately does NOT construct a `Date` object: `reminder_date` is a
// plain Postgres `date` column (e.g. "2026-08-23") with no time component.
// Parsing it via `new Date("2026-08-23")` and formatting with
// `.toLocaleDateString()` is timezone-sensitive (local midnight can land on
// the previous UTC day) -- exactly the serialization risk characterized as
// debt in LOT 7.1/7.2/7.15/7.18. String-parsing the Y/M/D components and
// mapping the month name directly avoids any Date-object timezone
// conversion, making the result deterministic regardless of the runtime's
// system timezone.

const FRENCH_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatAbsoluteFrenchDate(isoDateString) {
  const match = ISO_DATE_PATTERN.exec(String(isoDateString ?? ""));
  if (!match) return String(isoDateString ?? "");

  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  const monthName = FRENCH_MONTHS[monthIndex];
  if (!monthName) return String(isoDateString ?? "");

  const dayNumber = Number(day);
  return `${dayNumber} ${monthName} ${year}`;
}
