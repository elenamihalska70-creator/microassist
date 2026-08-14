# LOT 5.9 - Runtime Parity Evidence Implementation Report

## Resume

LOT 5.9 adds a controlled runtime parity evidence mechanism for Shadow Mode.

The implementation makes parity evidence observable, reproducible, temporary, auditable, and disableable without changing user-visible behavior.

Legacy remains the only source of truth. Shadow remains passive. No visible migration is approved.

## Architecture

New module:

- `src/application/shadow/runtimeParityEvidence.js`

Updated integration:

- `src/App.jsx`

Updated tests:

- `tests/shadow-parity-validation.test.js`
- `tests/runtime-parity-evidence.test.js`

The evidence module sits outside the domain layer and outside the facade contract. It does not modify Revenue, Contributions, Legacy ACRE, Rules Engine, Domain Models, Adapter contract, Facade contract, UI, Dashboard, Summary, Assistant, Exports, Payloads, Supabase, or localStorage.

## Collecte de preuves

The mechanism produces an evidence record containing:

- `schemaVersion`;
- `scenarioId`;
- explicit `observedAt` value when supplied;
- `referenceDate` copied from the shadow input;
- global MATCH/MISMATCH status;
- ordered compared field list;
- field-level checks;
- Legacy snapshot;
- Shadow snapshot;
- reproduction data with the shadow input DTO.

The in-memory store is:

- temporary;
- bounded;
- disableable;
- defensive-copy based;
- free from persistence;
- free from UI exposure.

## Scenarios couverts

The dedicated tests cover the LOT 5.8 scenario names at evidence-mechanism level:

- standard non-ACRE activity;
- ACRE active;
- ACRE expired;
- missing ACRE start date;
- multiple revenues;
- empty revenues.

The implementation also records:

- a MATCH example;
- a MISMATCH example;
- a real Adapter plus Calculation Facade evidence path for the standard non-ACRE first slice.

These are runtime evidence-mechanism proofs. They are not yet an authorization to replace Legacy.

## Preuves disponibles

Available evidence now includes:

- active collection proof;
- disabled collection proof;
- MATCH recording proof;
- MISMATCH recording proof;
- field order proof;
- compared field inventory proof;
- reproduction input proof;
- same input repeated twice proof;
- cloned input proof;
- different references with identical values proof;
- no mutation of Legacy snapshot proof;
- no mutation of Shadow result proof;
- no mutation of Shadow input proof;
- no side effect between repeated store reads and later reports proof;
- no UI, React state, persistence, network, Supabase, localStorage, `Date.now`, `new Date`, or `Math.random` in the evidence module.

## Limites

The evidence mechanism proves collection and comparison behavior.

It does not yet prove full business parity for every real Legacy scenario.

Remaining limits:

- the App Shadow integration still receives its `referenceDate` from the existing App current-date helper;
- Legacy `computeObligations` still contains current-date behavior outside this LOT;
- ACRE-sensitive full App parity requires a date-controlled harness before visible migration;
- no persistent evidence archive is introduced;
- no UI inspection screen is introduced;
- no production migration is introduced.

## Determinisme

The evidence module is deterministic:

- no implicit current date;
- no random value;
- no locale dependency;
- no timezone dependency introduced by the module;
- no object mutation;
- fixed field order;
- exact `Object.is` comparison;
- no tolerance;
- no hidden normalization;
- no corrective behavior.

The tests prove deterministic behavior for:

- identical input run twice;
- cloned input;
- different references with identical values;
- repeated store usage without side-effect influence on later report generation.

## Performance

The mechanism is intentionally small:

- one fixed first-slice field list;
- one evidence record per Shadow execution;
- bounded in-memory store;
- shallow structural copies of the approved DTO and snapshots.

No network, storage, rendering, export, Supabase, or API work is added.

## Rollback

Rollback is limited to removing:

- `src/application/shadow/runtimeParityEvidence.js`;
- the passive evidence call in `src/App.jsx`;
- `tests/runtime-parity-evidence.test.js`;
- the related static test updates.

No fiscal formula, domain contract, adapter contract, facade contract, UI, persistence, export, or Supabase rollback is needed.

## Validation

Executed:

- `node --test tests/*.test.js`: blocked by sandbox `spawn EPERM` before assertions.
- Sequential Node test execution file by file: PASS.
- `node tests/runtime-parity-evidence.test.js`: PASS, 11/11.
- `npm run build`: PASS, with existing Vite chunk-size warning.
- `npm run lint`: FAIL on historical lint debt in `App.jsx`, `InvoiceGenerator.jsx`, and `AuthContext.jsx`.
- Targeted lint for LOT 5.9 files: PASS.
- `npx playwright test`: PASS, including Node tests and 11 Playwright specs.

Historical lint debt remains outside this LOT.

## Recommandation LOT 5.10

Recommended next LOT:

LOT 5.10 - Date-Controlled Full Parity Harness.

Scope:

- remove implicit current-date influence from parity evidence execution;
- run full Legacy-vs-Shadow parity fixtures with explicit dates;
- cover ACRE-sensitive scenarios with real Legacy snapshots and real Shadow outputs;
- keep evidence passive and temporary;
- keep Legacy as the only source of truth;
- keep visible replacement forbidden.

## Confirmations

Legacy remains the only source of truth.

Shadow remains passive.

The evidence is observable.

The evidence is reproducible.

The evidence is disableable.

No user-visible behavior is modified.

GO POUR LOT 5.10
