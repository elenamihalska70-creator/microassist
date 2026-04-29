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
          <ram:CategoryCode>${line.vatRate > 0 ? "S" : "E"}</ram:CategoryCode>
          <ram:RateApplicablePercent>${formatMoney(line.vatRate)}</ram:RateApplicablePercent>
          ${
            invoice.vatExemptionReason
              ? `<ram:ExemptionReason>${escapeXml(invoice.vatExemptionReason)}</ram:ExemptionReason>`
              : ""
          }
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${formatMoney(line.totalHT)}</ram:LineTotalAmount>
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
        <ram:LineTotalAmount>${formatMoney(invoice.totals?.totalHT)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${formatMoney(invoice.totals?.totalHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${formatMoney(invoice.totals?.totalTVA)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${formatMoney(invoice.totals?.totalTTC)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${formatMoney(invoice.totals?.totalTTC)}</ram:DuePayableAmount>
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

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
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
