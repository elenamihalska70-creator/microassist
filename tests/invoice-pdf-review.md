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
