# Archived characterization tests (LOT-MICROASSIST-FREE-00)

These files describe the behaviour of `migrateLocalDataToSupabase` and the
login finalization **before** later fixes. They were never committed and are
kept unchanged (same bytes) as historical evidence. They are not executed:
`tests/run-unit.mjs` only runs `tests/*.test.{js,mjs}`.

| File | Written | Describes | Superseded by |
|---|---|---|---|
| `lot-10-3b-5b-migration-cleanup.test.js` | 2026-10-15 17:47 | a successful revenues/invoices/reminders migration deleting the fiscal draft | `afe2ebc` (guard fiscal draft cleanup by confirmed snapshot), `ce72ad9` (preserve non-fiscal local sources) |
| `lot-10-3b-6b-category-cleanup.test.js` | 2026-10-15 22:51 | one successful category deleting the other local sources | `ce72ad9`, `d2c8af8` (guest invoices stay local) |
| `lot-10-3b-6d-7a-characterization.test.js` | 2026-10-18 23:19 | "CURRENT DEFECT" cases of the invoice login finalization | `d2c8af8` |

Why they cannot run as-is:

- their assertions encode the old, unsafe behaviour, so they fail against the
  fixed code (7 and 10 failures);
- `lot-10-3b-6b-category-cleanup.test.js` waits for
  `supabase.from("invoices").insert`, which the migration no longer calls since
  `d2c8af8`: without a timeout the run never ends;
- they read `../src/App.jsx` and sibling fixtures relative to `tests/`, so they
  only resolve from their original location.

The current behaviour is covered by the active tests
`lot-10-3b-5d-fiscal-cleanup`, `lot-10-3b-6c-*`, `lot-10-3b-6d-7b-client-safety`
and `guest-invoices-preservation`.
