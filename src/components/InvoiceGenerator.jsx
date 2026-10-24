import { useLayoutEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import { loadInvoicePdfFonts } from "../utils/invoicePdfFonts.js";
import { InvoicePdfError, invoicePdfErrorMessage } from "../utils/invoicePdfErrors.js";
import {
  FACTURX_NOT_TRANSMITTED_NOTE,
  FACTURX_PREPARATION_LABEL,
  PDP_ROADMAP_NOTE,
  TVA_EXEMPTION_MENTION,
  VAT_MODES,
  calculateVatRate,
  createFacturXReadyInvoiceDraft,
  downloadTextFile,
  generateFacturXXml,
  getInvoiceTotals,
  isInvoiceCompliant,
} from "../utils/facturx.js";

const SELLER_NAME =
  import.meta.env.VITE_INVOICE_SELLER_NAME || "Microassist";
const SELLER_ADDRESS =
  import.meta.env.VITE_INVOICE_SELLER_ADDRESS || "Adresse a completer";
const SELLER_EMAIL = import.meta.env.VITE_INVOICE_SELLER_EMAIL || "";
const SELLER_SIRET = import.meta.env.VITE_INVOICE_SELLER_SIRET || "";
const SELLER_VAT_NUMBER = import.meta.env.VITE_INVOICE_SELLER_VAT_NUMBER || "";
const LATE_PENALTY_MENTION =
  "Penalites de retard : taux legal en vigueur apres la date d'echeance.";
const FLAT_FEE_MENTION =
  "Indemnite forfaitaire pour frais de recouvrement : 40 EUR.";

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysToDate(dateString, days = 30) {
  const base = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + days);
  return formatDateInput(base);
}

function formatDateFr(dateStr) {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function formatInvoiceAmount(amount) {
  const formattedAmount = Number(amount || 0)
    .toLocaleString("fr-FR")
    .replace(/[\u00a0\u202f]/g, " ");

  return `${formattedAmount} €`;
}

function getSafeFilenamePart(value) {
  return String(value || "facture")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function generateB2CInvoicePdf(invoice, { userEmail = "", isCurrent = () => true } = {}) {
  if (!isCurrent()) return false;
  const [notoSansRegular, notoSansBold] = await loadInvoicePdfFonts();
  if (!isCurrent()) return false;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const number = invoice.invoiceNumber || invoice.invoice_number || "FACTURE";
  const line = invoice.lines?.[0] || {
    description: invoice.description || "Prestation",
    quantity: 1,
    unitPrice: invoice.amount || 0,
    vatRate: 0,
    totalHT: invoice.amount || 0,
    totalTVA: 0,
    totalTTC: invoice.amount || 0,
  };
  const totals = getInvoiceTotals(invoice);
  const exemptionReason =
    totals.isVatExempt && !invoice.vatExemptionReason
      ? TVA_EXEMPTION_MENTION
      : invoice.vatExemptionReason;
  const seller = invoice.seller || {
    name: SELLER_NAME,
    address: SELLER_ADDRESS,
    siret: SELLER_SIRET,
    vatNumber: SELLER_VAT_NUMBER,
    email: SELLER_EMAIL || userEmail,
  };
  const buyer = invoice.buyer || {
    name: invoice.client_name || "",
    address: invoice.client_address || "",
    siret: "",
    vatNumber: "",
    email: invoice.client_email || "",
  };

  // Embed both faces in every invoice; all layout measurements use the same fonts.
  for (const [style, data] of [["normal", notoSansRegular], ["bold", notoSansBold]]) {
    const file = `NotoSans-${style}.ttf`;
    doc.addFileToVFS(file, data);
    doc.addFont(file, "NotoSans", style);
  }
  doc.setFont("NotoSans", "normal");
  // Never silently replace unsupported user characters with a missing glyph.
  const glyphs = doc.getFont().metadata.cmap.unicode.codeMap;
  const fields = [["Numéro de facture", number], ["Nom du vendeur", seller.name],
    ["Adresse du vendeur", seller.address], ["Email du vendeur", seller.email],
    ["SIRET du vendeur", seller.siret], ["TVA du vendeur", seller.vatNumber],
    ["Client", buyer.name], ["Adresse client", buyer.address], ["Email client", buyer.email],
    ["SIRET client", buyer.siret], ["TVA client", buyer.vatNumber],
    ["Prestation", line.description], ["Mention de TVA", exemptionReason]];
  for (const [field, value] of fields) {
    for (const character of String(value ?? "")) {
      if (!/[\n\r\t]/.test(character) && !glyphs[character.codePointAt(0)]) {
        throw new InvoicePdfError("unsupported-glyph", { character, field });
      }
    }
  }
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20, width = pageWidth - margin * 2;
  const footerTop = pageHeight - 29, contentBottom = footerTop - 8;
  let y = 0;
  const font = (size = 10, style = "normal", color = [55, 65, 81]) => {
    doc.setFont("NotoSans", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const lines = (text, availableWidth, size = 10, style = "normal") => {
    font(size, style);
    return doc.splitTextToSize(String(text ?? ""), availableWidth);
  };
  const newPage = () => { doc.addPage(); y = 24; };
  const ensure = height => { if (y + height > contentBottom) newPage(); };
  const textBlock = (text, size = 9, gap = 4) => {
    const wrapped = lines(text, width, size);
    const step = size * 0.3528 * 1.5;
    for (const row of wrapped) {
      ensure(step);
      font(size);
      doc.text(row, margin, y);
      y += step;
    }
    y += gap;
  };

  const numberLines = lines(`N° ${number}`, width, 10);
  const preparationLines = lines(FACTURX_PREPARATION_LABEL, width, 8);
  const headerHeight = 34 + numberLines.length * 5 + preparationLines.length * 4;
  doc.setFillColor(91, 33, 182);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  font(22, "bold", [255, 255, 255]);
  doc.text("FACTURE", margin, 18);
  font(10, "normal", [255, 255, 255]);
  numberLines.forEach((row, i) => doc.text(row, margin, 28 + i * 5));
  const dateY = 28 + numberLines.length * 5;
  doc.text(`Date : ${formatDateFr(invoice.issueDate || invoice.invoice_date)}`, margin, dateY);
  font(8, "normal", [255, 255, 255]);
  preparationLines.forEach((row, i) => doc.text(row, margin, dateY + 7 + i * 4));
  y = headerHeight + 12;

  const partyRows = (title, fields) => [
    { text: title, bold: true },
    ...fields.filter(value => value !== undefined && value !== "").flatMap(value =>
      lines(value, 78).map(text => ({ text, bold: false }))),
  ];
  const sellerRows = partyRows("Émetteur", [seller.name || SELLER_NAME,
    seller.email || SELLER_EMAIL || userEmail || "Email non renseigne",
    seller.address || SELLER_ADDRESS,
    seller.siret ? `SIRET : ${seller.siret}` : "Facture non conforme (SIRET manquant)",
    seller.vatNumber ? `TVA : ${seller.vatNumber}` : ""]);
  const buyerRows = partyRows("Client", [buyer.name || "—", buyer.address, buyer.email,
    buyer.siret ? `SIRET : ${buyer.siret}` : "", buyer.vatNumber ? `TVA : ${buyer.vatNumber}` : ""]);
  for (let i = 0; i < Math.max(sellerRows.length, buyerRows.length); i++) {
    ensure(6);
    for (const [rows, x] of [[sellerRows, margin], [buyerRows, pageWidth - margin - 78]]) {
      if (rows[i]) {
        font(rows[i].bold ? 11 : 10, rows[i].bold ? "bold" : "normal");
        doc.text(rows[i].text, x, y);
      }
    }
    y += 6;
  }
  y += 8;

  const columns = [
    { x: 25, width: 68, title: "Prestation", value: line.description || "Prestation" },
    { x: 98, width: 14, title: "Qté", value: String(line.quantity || 0) },
    { x: 116, width: 22, title: "PU HT", value: formatInvoiceAmount(line.unitPrice) },
    { x: 142, width: 16, title: "TVA", value: `${totals.vatRate || 0}%` },
    { x: pageWidth - 48, width: 26, title: totals.isVatExempt ? "Total HT" : "Total TTC",
      value: formatInvoiceAmount(totals.isVatExempt ? totals.totalHT : totals.totalTTC) },
  ];
  const tableHeader = () => {
    ensure(21); // Keep the header with at least the first description row.
    doc.setFillColor(245, 243, 255);
    doc.rect(margin, y - 5, width, 10, "F");
    font(9, "bold", [91, 33, 182]);
    columns.forEach(column => doc.text(column.title, column.x, y + 2));
    y += 15;
  };
  const cells = columns.map(column => lines(column.value, column.width, 9));
  tableHeader();
  for (let i = 0; i < Math.max(...cells.map(cell => cell.length)); i++) {
    if (y + 5 > contentBottom) { newPage(); tableHeader(); }
    font(9);
    columns.forEach((column, c) => { if (cells[c][i]) doc.text(cells[c][i], column.x, y); });
    y += 5;
  }
  y += 8;

  // Totals stay together. Notes start below the measured total box, never beside it.
  const amountLines = lines(formatInvoiceAmount(totals.totalTTC), 32, 11, "bold");
  const totalHeight = Math.max(14, amountLines.length * 5 + 8);
  ensure(24 + totalHeight);
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y - 4, pageWidth - margin, y - 4);
  font(10);
  doc.text("Total HT", 112, y + 4);
  doc.text(formatInvoiceAmount(totals.totalHT), pageWidth - margin, y + 4, { align: "right" });
  doc.text("TVA", 112, y + 12);
  doc.text(formatInvoiceAmount(totals.totalTVA), pageWidth - margin, y + 12, { align: "right" });
  doc.setFillColor(91, 33, 182);
  doc.rect(108, y + 19, pageWidth - margin - 108, totalHeight, "F");
  font(10, "bold", [255, 255, 255]);
  doc.text("TOTAL À PAYER", 112, y + 28);
  font(11, "bold", [255, 255, 255]);
  amountLines.forEach((row, i) => doc.text(row, pageWidth - margin - 4, y + 28 + i * 5, { align: "right" }));
  y += 19 + totalHeight + 10;
  if (exemptionReason) textBlock(exemptionReason, 8.5);
  textBlock(`Date d'échéance : ${formatDateFr(invoice.dueDate || invoice.due_date)}`, 8.5);
  textBlock(FACTURX_NOT_TRANSMITTED_NOTE, 8.5);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFillColor(245, 243, 255);
    doc.rect(0, footerTop, pageWidth, 29, "F");
    let footerY = footerTop + 6;
    for (const text of [LATE_PENALTY_MENTION, FLAT_FEE_MENTION,
      "Microassist - Assistant fiscal pour micro-entrepreneurs", `Page ${page} / ${pages}`]) {
      const wrapped = lines(text, width, 7);
      font(7, "normal", [91, 33, 182]);
      for (const row of wrapped) {
        doc.text(row, pageWidth / 2, footerY, { align: "center" });
        footerY += 4;
      }
    }
  }
  if (!isCurrent()) return false;
  await doc.save(`facture-${getSafeFilenamePart(number)}.pdf`, { returnPromise: true });
  return isCurrent();
}

const today = formatDateInput(new Date());

const DEFAULT_FORM = {
  client_name: "",
  client_address: "",
  client_email: "",
  description: "",
  quantity: "1",
  unit_price: "",
  vat_mode: VAT_MODES.exempt,
  buyer_siret: "",
  seller_siret: SELLER_SIRET,
  invoice_date: today,
  due_date: addDaysToDate(today, 30),
};

export default function InvoiceGenerator({
  user,
  billingIdentity,
  initialValues,
  onClose,
  onGoToProfile,
  onSaved,
}) {
  const [form, setForm] = useState(() => ({
    ...DEFAULT_FORM,
    seller_siret: billingIdentity?.siret || DEFAULT_FORM.seller_siret,
    seller_name: billingIdentity?.legal_name || SELLER_NAME,
    seller_address: billingIdentity?.address || SELLER_ADDRESS,
    ...(initialValues || {}),
  }));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const lifetimeRef = useRef(null);
  useLayoutEffect(() => {
    const lifetime = { active: true };
    lifetimeRef.current = lifetime;
    return () => { lifetime.active = false; };
  }, [user?.id]);
  function closeGenerator() {
    if (lifetimeRef.current) lifetimeRef.current.active = false;
    onClose?.();
  }
  const [pdfError, setPdfError] = useState("");
  const [showMissingSiretWarning, setShowMissingSiretWarning] = useState(false);

  function handleChange(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "invoice_date") {
        next.due_date = addDaysToDate(value, 30);
      }

      return next;
    });
  }

  function generateGuestInvoiceNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const stamp = `${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}`;
    return `FAC-${year}-GUEST-${stamp}`;
  }

  function getNormalizedAmount() {
    return getNormalizedQuantity() * getNormalizedUnitPrice();
  }

  function getNormalizedQuantity() {
    return Number(String(form.quantity || "0").replace(",", "."));
  }

  function getNormalizedUnitPrice() {
    return Number(String(form.unit_price || "0").replace(",", "."));
  }

  function validateForm() {
    const quantity = getNormalizedQuantity();
    const unitPrice = getNormalizedUnitPrice();

    if (!form.client_name.trim()) {
      return "Le nom du client est obligatoire.";
    }

    if (!form.description.trim()) {
      return "La prestation est obligatoire.";
    }

    if (!quantity || quantity <= 0) {
      return "La quantité doit être supérieure à 0.";
    }

    if (!unitPrice || unitPrice <= 0) {
      return "Le prix unitaire HT doit être supérieur à 0 €.";
    }

    if (!form.invoice_date) {
      return "La date de facture est obligatoire.";
    }

    if (!form.due_date) {
      return "La date d’échéance est obligatoire.";
    }

    const invoiceDate = new Date(`${form.invoice_date}T00:00:00`);
    const dueDate = new Date(`${form.due_date}T00:00:00`);

    if (
      Number.isNaN(invoiceDate.getTime()) ||
      Number.isNaN(dueDate.getTime())
    ) {
      return "Les dates de facture et d’échéance doivent être valides.";
    }

    if (dueDate < invoiceDate) {
      return "La date d’échéance ne peut pas être antérieure à la date de facture.";
    }

    return null;
  }

  async function handleSave(options = {}) {
    const lifetime = lifetimeRef.current;
    const isCurrent = () => lifetime?.active && lifetimeRef.current === lifetime;
    if (savingRef.current || !isCurrent()) return;

    const validationError = validateForm();

    if (validationError) {
      alert(validationError);
      return;
    }

    if (!options.continueAsDraft && !form.seller_siret.trim()) {
      setShowMissingSiretWarning(true);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setPdfError("");

    try {
      const number = generateGuestInvoiceNumber();
      const invoice = buildStructuredInvoice(number);

      const xml = generateFacturXXml(invoice);
      const generated = await generateB2CInvoicePdf(invoice, { userEmail: user?.email, isCurrent });
      if (!generated || !isCurrent()) return;
      downloadTextFile(
        `facturx-draft-${number}.xml`,
        xml,
      );

      if (isCurrent() && onSaved) {
        onSaved({
          // FUTURE: persist invoices after invoice schema migration.
          savedToSupabase: false,
          invoice: {
            ...invoice,
            invoice_number: invoice.invoiceNumber,
            client_name: invoice.buyer.name,
            client_address: invoice.buyer.address,
            client_email: invoice.buyer.email,
            description: invoice.lines[0]?.description || "",
            amount: invoice.totals.totalTTC,
            invoice_date: invoice.issueDate,
            due_date: invoice.dueDate,
            status: "unpaid",
            localOnly: true,
          },
          message:
            "Facture préparée en brouillon Factur-X. PDF et XML ont été téléchargés.",
        });
      }
    } catch (err) {
      if (!isCurrent()) return;
      console.error("Erreur sauvegarde facture:", err);
      setPdfError(invoicePdfErrorMessage(err, { editable: true }));
    } finally {
      if (isCurrent()) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  function buildStructuredInvoice(number) {
    return createFacturXReadyInvoiceDraft({
      id: `local-${Date.now()}`,
      invoiceNumber: number,
      issueDate: form.invoice_date,
      dueDate: form.due_date,
      seller: {
        name: form.seller_name?.trim() || SELLER_NAME,
        address: form.seller_address?.trim() || SELLER_ADDRESS,
        siret: form.seller_siret.trim(),
        vatNumber: SELLER_VAT_NUMBER,
        email: SELLER_EMAIL || user?.email || "",
      },
      buyer: {
        name: form.client_name.trim(),
        address: form.client_address.trim(),
        siret: form.buyer_siret.trim(),
        vatNumber: "",
        email: form.client_email.trim(),
      },
      description: form.description.trim(),
      quantity: getNormalizedQuantity(),
      unitPrice: getNormalizedUnitPrice(),
      vatMode: form.vat_mode,
      is_compliant: isInvoiceCompliant(
        {
          seller: {
            siret: form.seller_siret,
          },
        },
        {
          billing_identity: billingIdentity,
        },
      ),
    });
  }

  const amount = getNormalizedAmount();

  return (
    <div
      className="modalOverlay"
      onClick={closeGenerator}
      style={{ overflowY: "auto", alignItems: "flex-start" }}
    >
      <div
        className="modalCard"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 560,
          width: "100%",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          overflowX: "hidden",
          margin: "auto",
        }}
      >
        <div className="sectionHead">
          <h3>🧾 Créer une facture</h3>
          <button className="iconBtn" onClick={closeGenerator} type="button">
            ✕
          </button>
        </div>

        <div className="formGrid">
          <label className="field fieldFull">
            <span>Client *</span>
            <input
              type="text"
              value={form.client_name}
              onChange={(e) => handleChange("client_name", e.target.value)}
              placeholder="Nom ou raison sociale"
            />
          </label>

          <label className="field fieldFull">
            <span>Adresse client</span>
            <input
              type="text"
              value={form.client_address}
              onChange={(e) => handleChange("client_address", e.target.value)}
              placeholder="Optionnel"
            />
          </label>

          <label className="field fieldFull">
            <span>Email client</span>
            <input
              type="email"
              value={form.client_email}
              onChange={(e) => handleChange("client_email", e.target.value)}
              placeholder="Optionnel"
            />
          </label>

          <label className="field fieldFull">
            <span>Prestation *</span>
            <input
              type="text"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Ex : Développement d’un site web — mars 2026"
            />
          </label>

          <label className="field">
            <span>Quantité *</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.quantity}
              onChange={(e) => handleChange("quantity", e.target.value)}
              placeholder="Ex : 1"
            />
          </label>

          <label className="field">
            <span>Prix unitaire HT (€) *</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.unit_price}
              onChange={(e) => handleChange("unit_price", e.target.value)}
              placeholder="Ex : 500"
            />
          </label>

          <label className="field fieldFull">
            <span>Mode TVA</span>
            <select
              value={form.vat_mode}
              onChange={(e) => handleChange("vat_mode", e.target.value)}
            >
              <option value={VAT_MODES.exempt}>{TVA_EXEMPTION_MENTION}</option>
              <option value={VAT_MODES.standard}>TVA standard</option>
              <option value={VAT_MODES.later}>À compléter plus tard</option>
            </select>
          </label>

          <label className="field">
            <span>SIRET acheteur</span>
            <input
              type="text"
              value={form.buyer_siret}
              onChange={(e) => handleChange("buyer_siret", e.target.value)}
              placeholder="Optionnel"
            />
          </label>

          <label className="field">
            <span>SIRET vendeur</span>
            <input
              type="text"
              value={form.seller_siret}
              onChange={(e) => handleChange("seller_siret", e.target.value)}
              placeholder="Optionnel"
            />
          </label>

          <label className="field">
            <span>Raison sociale vendeur</span>
            <input
              type="text"
              value={form.seller_name}
              onChange={(e) => handleChange("seller_name", e.target.value)}
              placeholder="Optionnel"
            />
          </label>

          <label className="field fieldFull">
            <span>Adresse vendeur</span>
            <input
              type="text"
              value={form.seller_address}
              onChange={(e) => handleChange("seller_address", e.target.value)}
              placeholder="Optionnel"
            />
          </label>

          <label className="field">
            <span>Date de facture</span>
            <input
              type="date"
              value={form.invoice_date}
              onChange={(e) => handleChange("invoice_date", e.target.value)}
            />
          </label>

          <label className="field">
            <span>Date d'échéance</span>
            <input
              type="date"
              value={form.due_date}
              min={form.invoice_date}
              onChange={(e) => handleChange("due_date", e.target.value)}
            />
          </label>
        </div>

        {amount > 0 && (
          <div className="revenuePreview" style={{ marginTop: 12 }}>
            <div className="previewTitle">Aperçu</div>

            <div className="previewRow">
              <span>Montant HT</span>
              <strong>{amount.toLocaleString("fr-FR")} €</strong>
            </div>

            <div className="previewRow">
              <span>TVA</span>
              <strong>
                {form.vat_mode === VAT_MODES.standard
                  ? `${(amount * (calculateVatRate(form.vat_mode) / 100)).toLocaleString("fr-FR")} €`
                  : form.vat_mode === VAT_MODES.later
                    ? "À compléter plus tard"
                    : "Non applicable (Art. 293 B du CGI)"}
              </strong>
            </div>

            <div className="previewRow">
              <span>Total à payer</span>
              <strong>
                {(amount + amount * (calculateVatRate(form.vat_mode) / 100)).toLocaleString("fr-FR")} €
              </strong>
            </div>
          </div>
        )}

        <div className="revenuePreview" style={{ marginTop: 12 }}>
          <div className="previewTitle">{FACTURX_PREPARATION_LABEL}</div>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {FACTURX_NOT_TRANSMITTED_NOTE}
          </p>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {PDP_ROADMAP_NOTE}
          </p>
        </div>

        {pdfError && <p role="alert">{pdfError}</p>}
        <div
          className="miniActions"
          style={{
            marginTop: 16,
            position: "sticky",
            bottom: 0,
            background: "#fff",
            paddingTop: 12,
          }}
        >
          <button className="btn btnGhost" onClick={closeGenerator} type="button">
            Annuler
          </button>

          <button
            className="btn btnPrimary"
            onClick={handleSave}
            disabled={saving}
            type="button"
          >
            {saving ? "Préparation..." : "Créer facture compatible 2026"}
          </button>
        </div>
      </div>

      {showMissingSiretWarning && (
        <div
          className="modalOverlay"
          onClick={(event) => {
            event.stopPropagation();
            setShowMissingSiretWarning(false);
          }}
        >
          <div
            className="modalCard"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: 460 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="missing-siret-warning-title"
          >
            <div className="sectionHead">
              <h3 id="missing-siret-warning-title">SIRET manquant</h3>
              <button
                className="iconBtn"
                onClick={() => setShowMissingSiretWarning(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <p className="muted" style={{ marginTop: 8 }}>
              Pour créer une facture conforme, complète ton SIRET.
            </p>

            <div className="miniActions" style={{ marginTop: 16 }}>
              <button
                className="btn btnGhost"
                type="button"
                onClick={() => {
                  setShowMissingSiretWarning(false);
                  handleSave({ continueAsDraft: true });
                }}
              >
                Continuer en brouillon
              </button>
              <button
                className="btn btnPrimary"
                type="button"
                onClick={() => {
                  setShowMissingSiretWarning(false);
                  if (lifetimeRef.current) lifetimeRef.current.active = false;
                  onGoToProfile?.();
                }}
              >
                Aller au profil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
