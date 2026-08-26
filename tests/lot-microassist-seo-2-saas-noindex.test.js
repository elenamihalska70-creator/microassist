import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// LOT MICROASSIST SEO.2, section I: this repository produces
// https://microassist.vercel.app, the authenticated SaaS application --
// not the public marketing site (https://microassist.digitallab.studio,
// a separate repository not present here -- see that LOT's own
// "NOT PRESENT IN THIS REPOSITORY" finding). This locks in the two
// defense-in-depth signals added so the SaaS app is never accidentally
// indexed alongside the marketing site: a <meta name="robots"> tag (the
// signal search engines actually honor even if a page is crawled) and a
// robots.txt (advisory to well-behaved crawlers; has zero effect on
// actual login/auth/API requests, which never consult it).

const INDEX_HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ROBOTS_TXT = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");

test("index.html declares noindex, nofollow", () => {
  assert.match(INDEX_HTML, /<meta name="robots" content="noindex, nofollow"\s*\/?>/);
});

test("index.html still has its title, description, and app mount point -- nothing else was removed", () => {
  assert.match(INDEX_HTML, /<title>Microassist - Assistant fiscal pour micro-entrepreneurs<\/title>/);
  assert.match(INDEX_HTML, /<meta name="description"/);
  assert.match(INDEX_HTML, /<div id="root"><\/div>/);
  assert.match(INDEX_HTML, /<script type="module" src="\/src\/main\.jsx">/);
});

test("public/robots.txt disallows all crawling of this SaaS app", () => {
  assert.match(ROBOTS_TXT, /User-agent:\s*\*/);
  assert.match(ROBOTS_TXT, /Disallow:\s*\/\s*(\n|$)/);
});

test("public/robots.txt does not declare a sitemap for this app -- it has no public/indexable pages of its own", () => {
  assert.doesNotMatch(ROBOTS_TXT, /Sitemap:/i);
});

test("no localhost reference exists in either file", () => {
  assert.doesNotMatch(INDEX_HTML, /localhost/i);
  assert.doesNotMatch(ROBOTS_TXT, /localhost/i);
});

test("neither file references the marketing site's own domain as if this app owned it", () => {
  // This app links OUT to the marketing site elsewhere in its own UI, but
  // these two SEO-control files are scoped to this app only and must not
  // claim ownership of microassist.digitallab.studio's indexing.
  assert.doesNotMatch(ROBOTS_TXT, /Sitemap:\s*https?:\/\/microassist\.digitallab\.studio/);
});
