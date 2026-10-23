# Invoice PDF review tests

The browser suite generates real PDFs/XML from synthetic data with external services
intercepted. It covers short/long Cyrillic invoices, creation plus list redownload,
unchanged local storage and XML, zero invoice INSERTs, and explicit unsupported-glyph
failure. Run `npx playwright test tests/invoice-pdf.spec.js`.

For independent extraction, geometry checks and PNG rendering, install review-only
tools outside the repository (no application dependency changes):

```powershell
npm install --prefix "$env:TEMP/microassist-pdf-tools" --no-package-lock --no-audit --no-fund pdfjs-dist@6.4.299 @napi-rs/canvas@1.0.13
$env:PDF_TOOLS_DIR = "$env:TEMP/microassist-pdf-tools"
$env:PDF_REVIEW_DIR = '<extracted review ZIP>/artifacts'
node --test --test-isolation=none tests/invoice-pdf-artifacts.test.mjs
```

`PDF_REVIEW_DIR` contains `baseline/`, `fixed/`, and `renders/`. The review ZIP supplies
the baseline reproductions. To generate new corrected artifacts, set
`PDF_ARTIFACT_DIR` to its `fixed/` directory before running the browser suite.
The Node suite checks exact extracted Unicode strings, complete party/description
text across pages, embedded normal/bold fonts, clipping/overlap, non-orphaned table
headers, long pagination and byte-identical baseline/fixed XML. PNGs still require
visual review; these checks do not certify Factur-X or PDF/A-3.

## Async errors and deferred font loading

`generateB2CInvoicePdf` is async; callers must await it. Both App download buttons
use InvoicePdfDownloadButton. Creation prepares XML first, awaits PDF completion,
then downloads XML and invokes the existing onSaved callback. Expected glyph/load
errors are shown in French; form data and stored invoices are not rewritten.

The browser suite now has nine tests, including a font HTTP failure followed by a
successful retry, historical list errors, notice render errors (scoped fault injection),
zero font requests on app opening, shared concurrent loads and cached reuse.
Unhandled page errors are collected and forbidden in every test.

Pure loader/message tests:
`node --test --test-isolation=none tests/invoice-pdf-loading.test.js`.
The six tests cover HTTP, network and invalid-font failures, retry, lazy loading,
single-flight caching and editable/non-editable error guidance.
