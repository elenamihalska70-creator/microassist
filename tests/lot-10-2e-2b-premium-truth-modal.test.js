import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);

function sourceWithoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function extractBlock(startText, endText) {
  const start = APP_SOURCE.indexOf(startText);
  assert.notEqual(start, -1, `Missing block start: ${startText}`);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, `Missing block end: ${endText}`);
  return APP_SOURCE.slice(start, end);
}

function premiumModalContentBlock() {
  return sourceWithoutComments(
    extractBlock("const premiumModalContent = useMemo(() => {", "\n  const premiumModalPrimaryCtaLabel"),
  );
}

function premiumBenefitsBlock() {
  return sourceWithoutComments(
    extractBlock("const premiumModalBenefits = useMemo(", "\n  const revenueSectionTotal"),
  );
}

function premiumInlineEffectBlock() {
  return sourceWithoutComments(
    extractBlock("useEffect(() => {\n    if (billingUiState === \"guest\"", "\n  useEffect(() => {\n    if (!user?.id || !user?.email) return;"),
  );
}

test("dashboard load does not automatically open Premium from detected trigger context", () => {
  const effect = premiumInlineEffectBlock();
  assert.doesNotMatch(effect, /openPremiumModal\(/);
  assert.match(effect, /premium_inline_notice/);
});

test("urgent and overdue declaration cannot automatically open Premium", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  assert.doesNotMatch(code, /openPremiumModal\(["']declaration_urgent["']\)/);
  assert.doesNotMatch(code, /openPremiumModal\(premiumTriggerContext\.triggerType\)/);
});

test("early access ending and post early access no longer auto-cover the dashboard", () => {
  const effect = premiumInlineEffectBlock();
  assert.doesNotMatch(effect, /early_access_ending[\s\S]*openPremiumModal/);
  assert.doesNotMatch(effect, /post_early_access[\s\S]*openPremiumModal/);
  assert.match(APP_SOURCE, /onClick=\{\(\) => openPremiumModal\("early_access_end"\)\}/);
});

test("explicit Premium clicks still open the modal", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  assert.match(code, /openPremiumModal\("pricing_page"\)/);
  assert.match(code, /onClick=\{\(\) => openPremiumModal\("smart_priorities_lock"\)\}/);
  assert.match(code, /onClick=\{\(\) => openPremiumModal\("dashboard_protection"\)\}/);
});

test("disabled declaration reminder claims are absent from active Premium modal benefits", () => {
  const benefits = premiumBenefitsBlock();
  assert.doesNotMatch(benefits, /Alertes email avant échéance/);
  assert.doesNotMatch(benefits, /Alertes intelligentes par email/);
  assert.doesNotMatch(benefits, /Accompagnement proactif avant les échéances/);
});

test("disabled automatic reminder claims are absent from active Premium modal copy", () => {
  const modalCopy = premiumModalContentBlock();
  assert.doesNotMatch(modalCopy, /Premium te prévient automatiquement avant les échéances importantes/);
  assert.doesNotMatch(modalCopy, /t’envoie des alertes avant les échéances/);
  assert.doesNotMatch(modalCopy, /alertes automatiques/);
});

test("unknown or disabled capabilities are not presented as confirmed active benefits", () => {
  const benefits = premiumBenefitsBlock();
  assert.doesNotMatch(benefits, /Accompagnement proactif/);
  assert.doesNotMatch(benefits, /rappels automatiques/);
  assert.doesNotMatch(benefits, /Priorités personnalisées/);
  assert.doesNotMatch(benefits, /intelligent/);
});

test("verified implemented benefits still remain visible", () => {
  const benefits = premiumBenefitsBlock();
  assert.match(benefits, /Exports PDF et CSV illimités/);
  assert.match(benefits, /Historique illimité des revenus/);
  assert.match(benefits, /Suivi TVA \+ ACRE \+ CFE dans le tableau de bord/);
  assert.match(benefits, /Suivi des factures impayées/);
});

test("inline Premium messaging remains available without modal auto-open", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  assert.match(code, /buildPremiumInlineNotice/);
  assert.match(code, /premiumInlineNotice/);
  assert.match(code, /premiumBannerContent/);
  assert.doesNotMatch(premiumInlineEffectBlock(), /setShowPricingModal\(true\)/);
});

test("declaration reminder emails remain disabled", () => {
  assert.match(APP_SOURCE, /const DECLARATION_REMINDER_EMAILS_ENABLED = false;/);
});
