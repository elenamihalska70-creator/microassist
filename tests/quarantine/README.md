# Quarantined source-shape tests (LOT-MICROASSIST-FREE-00)

`source-shape.json` lists 106 tests, in 45 `lot-5-*` files, that
`tests/run-unit.mjs` leaves out **by exact name, inside their own file only**
(Node drops them from the counts; the runner prints how many were not run).
The files are unchanged and every other test they contain still runs,
including the parity and calculation evidence that imports `src/domain`.

## Why

These tests read `src/App.jsx` as text and assert its shape, not its behaviour:

- `frozen-count` (65): exact occurrence counts of `useState`,
  `fiscalSummaryVisibleSlice`, `availableAmount`, `savingsGoal`... recorded at
  each LOT 5 step. Any later edit of `App.jsx` changes them.
- `removed-anchor` (41): blocks delimited by the comment
  `{/* ACRE Expiration Warning */}`. The comment had no code under it and was
  removed by `6997b96`; no ACRE behaviour was removed.

They degraded gradually (13 failures on 2026-10-15, 30 on 2026-10-29, 98 after
`6997b96`) and were not part of a runnable suite: the previous full run never
finished (see `tests/archive/characterization/README.md`).

The list was generated from a clean checkout of `4c26b26`, so it does not
absorb failures caused by uncommitted work.

## Rules

- Do not add a test here to hide a behavioural failure.
- The runner fails when an entry no longer matches a test in its file, so the
  list cannot silently drift.
- To retire an entry, fix or rewrite the test against behaviour, then delete
  the entry.
