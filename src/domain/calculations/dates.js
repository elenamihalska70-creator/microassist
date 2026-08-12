export const ADD_MONTH_POLICIES = Object.freeze({
  clampToEndOfMonth: "clampToEndOfMonth",
  overflow: "overflow",
});

const DAY_MS = 1000 * 60 * 60 * 24;

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function cloneLocalDate(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

export function isLeapYear(year) {
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear)) return false;
  return numericYear % 4 === 0 && (numericYear % 100 !== 0 || numericYear % 400 === 0);
}

export function daysInMonth(year, month) {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth)) {
    return null;
  }

  if (numericMonth < 1 || numericMonth > 12) return null;

  return new Date(numericYear, numericMonth, 0).getDate();
}

export function isValidLocalDateString(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const maxDay = daysInMonth(year, month);

  return maxDay !== null && day >= 1 && day <= maxDay;
}

export function parseLocalDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return cloneLocalDate(value);
  }

  if (!isValidLocalDateString(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatLocalDate(dateInput) {
  const date = parseLocalDate(dateInput);
  if (!date) return null;

  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

export function startOfLocalDay(dateInput) {
  const date = parseLocalDate(dateInput);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfLocalMonth(dateInput) {
  const date = parseLocalDate(dateInput);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfLocalMonth(dateInput) {
  const date = parseLocalDate(dateInput);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function compareLocalDates(a, b) {
  const first = startOfLocalDay(a);
  const second = startOfLocalDay(b);

  if (!first || !second) return null;

  const diff = first.getTime() - second.getTime();
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

export function differenceInCalendarDays(a, b) {
  const first = startOfLocalDay(a);
  const second = startOfLocalDay(b);

  if (!first || !second) return null;

  const utcFirst = Date.UTC(first.getFullYear(), first.getMonth(), first.getDate());
  const utcSecond = Date.UTC(second.getFullYear(), second.getMonth(), second.getDate());

  return Math.round((utcSecond - utcFirst) / DAY_MS);
}

export function addCalendarDays(dateInput, amount) {
  const date = startOfLocalDay(dateInput);
  const dayAmount = Number(amount);

  if (!date || !Number.isInteger(dayAmount)) return null;

  const next = new Date(date);
  next.setDate(next.getDate() + dayAmount);
  return next;
}

export function addCalendarMonths(dateInput, amount, options = {}) {
  const date = startOfLocalDay(dateInput);
  const monthAmount = Number(amount);
  const policy = options.policy || ADD_MONTH_POLICIES.clampToEndOfMonth;

  if (!date || !Number.isInteger(monthAmount)) return null;

  if (policy === ADD_MONTH_POLICIES.overflow) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + monthAmount);
    return next;
  }

  if (policy !== ADD_MONTH_POLICIES.clampToEndOfMonth) {
    throw new RangeError("Unknown add-month policy");
  }

  const targetYear = date.getFullYear();
  const targetMonthIndex = date.getMonth() + monthAmount;
  const firstOfTarget = new Date(targetYear, targetMonthIndex, 1);
  const targetMonth = firstOfTarget.getMonth() + 1;
  const maxDay = daysInMonth(firstOfTarget.getFullYear(), targetMonth);
  const day = Math.min(date.getDate(), maxDay);

  return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), day);
}

export function requireReferenceDate(dateInput) {
  const date = parseLocalDate(dateInput);
  if (!date) {
    throw new TypeError("A valid reference date is required");
  }
  return date;
}
