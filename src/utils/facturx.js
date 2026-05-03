export const FACTURX_PREPARATION_LABEL =
  "Facture électronique prête (Factur-X) — transmission via plateforme agréée prévue dans une prochaine version.";

export const FACTURX_NOT_TRANSMITTED_NOTE =
  "Ce document contient un brouillon Factur-X. Il n’est pas encore transmis automatiquement via une plateforme agréée.";

export const PDP_ROADMAP_NOTE =
  "La connexion à une plateforme agréée sera ajoutée dans une prochaine version.";

export const TVA_EXEMPTION_MENTION =
  "TVA non applicable, art. 293 B du CGI";

export const VAT_MODES = {
  exempt: "exempt",
  standard: "standard",
  later: "later",
};

export function calculateVatRate(vatMode) {
  if (vatMode === VAT_MODES.standard) return 20;
  return 0;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function getInvoiceTotals(invoice = {}) {
  const line = invoice.lines?.[0] || {};
  const rawTotalTVA = Number(invoice.totals?.totalTVA ?? line.totalTVA ?? 0);
  const rawVatRate = Number(line.vatRate ?? invoice.vatRate ?? 0);
  const exemptionText = String(invoice.vatExemptionReason || "").toLowerCase();
  const hasExemptionMention =
    exemptionText.includes("293") ||
    exemptionText.includes("franchise") ||
    exemptionText.includes("non applicable");
  const hasPositiveVat = rawTotalTVA > 0 || rawVatRate > 0;
  const isVatExempt = hasExemptionMention || !hasPositiveVat;
  const totalHT = roundMoney(
    invoice.totals?.totalHT ?? line.totalHT ?? invoice.amount ?? 0,
  );

  if (isVatExempt) {
    return {
      totalHT,
      totalTVA: 0,
      totalTTC: totalHT,
      vatRate: 0,
      isVatExempt: true,
      amountLabel: "HT",
    };
  }

  const vatRate = rawVatRate;
  const totalTVA = roundMoney(rawTotalTVA || totalHT * (vatRate / 100));
  const totalTTC = roundMoney(invoice.totals?.totalTTC ?? line.totalTTC ?? totalHT + totalTVA);

  return {
    totalHT,
    totalTVA,
    totalTTC,
    vatRate,
    isVatExempt: false,
    amountLabel: "TTC",
  };
}

export function isInvoiceCompliant(invoice = {}, profile = {}) {
  if (typeof invoice?.is_compliant === "boolean") {
    return invoice.is_compliant;
  }

  const profileBillingIdentity = profile?.billing_identity || profile || {};
  const sellerSiret =
    invoice?.seller?.siret ||
    invoice?.seller_siret ||
    profileBillingIdentity?.siret ||
    "";

  return Boolean(String(sellerSiret).trim());
}

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

export function getInvoiceComplianceScore(invoice = {}, profile = {}) {
  const profileBillingIdentity = profile?.billing_identity || profile || {};
  const seller = invoice?.seller || {};
  const buyer = invoice?.buyer || {};
  const totals = getInvoiceTotals(invoice);
  const sellerSiret =
    seller.siret || invoice?.seller_siret || profileBillingIdentity?.siret || "";
  const sellerLegalName =
    seller.name ||
    invoice?.seller_name ||
    profileBillingIdentity?.legal_name ||
    "";
  const sellerAddress =
    seller.address ||
    invoice?.seller_address ||
    profileBillingIdentity?.address ||
    "";
  const invoiceNumber =
    invoice?.invoiceNumber || invoice?.invoice_number || invoice?.number || "";
  const clientName = buyer.name || invoice?.client_name || "";
  const invoiceDate = invoice?.issueDate || invoice?.invoice_date || "";
  const dueDate = invoice?.dueDate || invoice?.due_date || "";
  const tvaLogicValid =
    Number.isFinite(totals.totalHT) &&
    Number.isFinite(totals.totalTVA) &&
    Number.isFinite(totals.totalTTC) &&
    (totals.isVatExempt || totals.vatRate > 0);
  const pdfReady = Boolean(invoiceNumber);
  const facturXDraftReady = invoice?.formatStatus === "facturx_ready_draft";
  const checks = [
    ["seller_siret", "SIRET vendeur", hasValue(sellerSiret)],
    ["seller_legal_name", "Raison sociale vendeur", hasValue(sellerLegalName)],
    ["seller_address", "Adresse vendeur", hasValue(sellerAddress)],
    ["invoice_number", "Numéro de facture", hasValue(invoiceNumber)],
    ["client_name", "Nom du client", hasValue(clientName)],
    ["invoice_date", "Date de facture", hasValue(invoiceDate)],
    ["due_date", "Date d’échéance", hasValue(dueDate)],
    ["tva_logic", "TVA", tvaLogicValid],
    ["pdf_ready", "PDF prêt", pdfReady],
    ["facturx_ready", "Brouillon Factur-X", facturXDraftReady],
  ];
  const missingItems = checks
    .filter(([, , passed]) => !passed)
    .map(([, label]) => label);
  const score = Math.round(
    (checks.filter(([, , passed]) => passed).length / checks.length) * 100,
  );
  const blockingKeys = new Set([
    "invoice_number",
    "client_name",
    "invoice_date",
    "due_date",
  ]);
  const hasBlockingMissing = checks.some(
    ([key, , passed]) => blockingKeys.has(key) && !passed,
  );
  const alerts = [];

  if (!hasValue(sellerSiret)) {
    alerts.push(
      "⚠️ SIRET manquant : complète ton profil pour rendre cette facture conforme.",
    );
  }

  if (invoice?.status !== "paid") {
    alerts.push("🟡 Facture en attente de paiement.");
  }

  return {
    score,
    status:
      score === 100
        ? "conforme"
        : hasBlockingMissing || score < 60
          ? "bloquant"
          : "a_completer",
    missingItems,
    alerts,
  };
}

export function createFacturXReadyInvoiceDraft({
  id,
  invoiceNumber,
  issueDate,
  dueDate,
  seller = {},
  buyer = {},
  description,
  quantity,
  unitPrice,
  vatMode,
  is_compliant,
  paymentTerms = "Paiement à échéance indiquée sur la facture.",
}) {
  const safeQuantity = Math.max(0, Number(quantity) || 0);
  const safeUnitPrice = Math.max(0, Number(unitPrice) || 0);
  const vatRate = calculateVatRate(vatMode);
  const totalHT = roundMoney(safeQuantity * safeUnitPrice);
  const totalTVA = roundMoney(totalHT * (vatRate / 100));
  const totalTTC = roundMoney(totalHT + totalTVA);

  return {
    id,
    invoiceNumber,
    issueDate,
    dueDate,
    seller: {
      name: seller.name || "Microassist Expert",
      address: seller.address || "Adresse vendeur à compléter",
      siret: seller.siret || "",
      vatNumber: seller.vatNumber || "",
      email: seller.email || "",
    },
    buyer: {
      name: buyer.name || "",
      address: buyer.address || "Adresse acheteur à compléter",
      siret: buyer.siret || "",
      vatNumber: buyer.vatNumber || "",
      email: buyer.email || "",
    },
    lines: [
      {
        description,
        quantity: safeQuantity,
        unitPrice: safeUnitPrice,
        vatRate,
        totalHT,
        totalTVA,
        totalTTC,
      },
    ],
    totals: {
      totalHT,
      totalTVA,
      totalTTC,
    },
    vatExemptionReason:
      vatMode === VAT_MODES.exempt
        ? TVA_EXEMPTION_MENTION
        : vatMode === VAT_MODES.later
          ? "À compléter plus tard"
          : "",
    paymentTerms,
    is_compliant:
      is_compliant ??
      isInvoiceCompliant(
        {
          seller,
        },
        null,
      ),
    formatStatus: "facturx_ready_draft",
    transmissionStatus: "not_transmitted",
    statuses: [
      "Brouillon",
      "PDF généré",
      "XML préparé",
      "Transmission PDP non activée",
    ],
  };
}

export function generateFacturXXml(invoice) {
  const line = invoice.lines?.[0] || {};
  const totals = getInvoiceTotals(invoice);
  const exemptionReason =
    totals.isVatExempt && !invoice.vatExemptionReason
      ? TVA_EXEMPTION_MENTION
      : invoice.vatExemptionReason;

  // TODO: validate exact Factur-X XML namespace and schema before production.
  // This XML is an EN16931/Factur-X inspired draft for internal preparation only.
  // It is not a compliant PDP transmission payload yet.
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basicwl</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
    <ram:Note>${escapeXml(FACTURX_NOT_TRANSMITTED_NOTE)}</ram:Note>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoice.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatXmlDate(invoice.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>1</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(line.description || "Description à compléter")}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${formatMoney(line.unitPrice)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${formatQuantity(line.quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${totals.vatRate > 0 ? "S" : "E"}</ram:CategoryCode>
          <ram:RateApplicablePercent>${formatMoney(totals.vatRate)}</ram:RateApplicablePercent>
          ${
            exemptionReason
              ? `<ram:ExemptionReason>${escapeXml(exemptionReason)}</ram:ExemptionReason>`
              : ""
          }
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${formatMoney(totals.totalHT)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(invoice.seller?.name || "Vendeur à compléter")}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(invoice.seller?.address || "Adresse vendeur à compléter")}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="0002">${escapeXml(invoice.seller?.siret || "SIRET_VENDEUR_A_COMPLETER")}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(invoice.buyer?.name || "Acheteur à compléter")}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(invoice.buyer?.address || "Adresse acheteur à compléter")}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="0002">${escapeXml(invoice.buyer?.siret || "SIRET_ACHETEUR_A_COMPLETER")}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery />
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>${escapeXml(invoice.paymentTerms || "Conditions de paiement à compléter")}</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatXmlDate(invoice.dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${formatMoney(totals.totalHT)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${formatMoney(totals.totalHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${formatMoney(totals.totalTVA)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${formatMoney(totals.totalTTC)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${formatMoney(totals.totalTTC)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

export function downloadTextFile(filename, content, type = "application/xml") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatMoney(value) {
  return roundMoney(value).toFixed(2);
}

function formatQuantity(value) {
  return (Number(value) || 0).toFixed(2);
}

function formatXmlDate(date) {
  return String(date || "").replaceAll("-", "");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
