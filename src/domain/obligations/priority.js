import { ACTION_TYPE_TIEBREAK_ORDER } from "./constants.js";

// A large finite sentinel, not Number.POSITIVE_INFINITY: two null due dates
// would otherwise both sort as Infinity, and Infinity - Infinity is NaN --
// which breaks the comparator contract (Array#sort's ordering guarantee)
// instead of correctly reporting a tie for the next tie-break step.
const NO_DUE_DATE_SORT_VALUE = Number.MAX_SAFE_INTEGER;

function dueDateSortValue(dueDate) {
  if (!dueDate) return NO_DUE_DATE_SORT_VALUE;
  const time = new Date(dueDate).getTime();
  return Number.isNaN(time) ? NO_DUE_DATE_SORT_VALUE : time;
}

function typeTiebreakRank(type) {
  const index = ACTION_TYPE_TIEBREAK_ORDER.indexOf(type);
  return index === -1 ? ACTION_TYPE_TIEBREAK_ORDER.length : index;
}

/**
 * Deterministic comparator: priorityTier first (risk-first, lower wins),
 * then soonest dueDate (nulls last), then a fixed type tie-break order,
 * then id as a final, fully deterministic tie-break.
 */
export function compareActions(a, b) {
  if (a.priorityTier !== b.priorityTier) return a.priorityTier - b.priorityTier;

  const dueDateDiff = dueDateSortValue(a.dueDate) - dueDateSortValue(b.dueDate);
  if (dueDateDiff !== 0) return dueDateDiff;

  const typeDiff = typeTiebreakRank(a.type) - typeTiebreakRank(b.type);
  if (typeDiff !== 0) return typeDiff;

  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function prioritizeActions(actions) {
  if (!Array.isArray(actions)) {
    throw new TypeError("prioritizeActions expects an array of actions");
  }

  return [...actions].sort(compareActions);
}
