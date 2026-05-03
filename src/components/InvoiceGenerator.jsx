import { useState } from "react";
import jsPDF from "jspdf";
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

export function generateB2CInvoicePdf(invoice, { userEmail = "" } = {}) {
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

  doc.setFillColor(91, 33, 182);
  doc.rect(0, 0, pageWidth, 42, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURE", 20, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`N° ${number}`, 20, 28);
  doc.text(`Date : ${formatDateFr(invoice.issueDate || invoice.invoice_date)}`, 20, 35);
  doc.text(FACTURX_PREPARATION_LABEL, 20, 40);

  doc.setTextColor(30, 27, 75);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Émetteur", 20, 58);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(10);
  doc.text(seller.name || SELLER_NAME, 20, 66);
  doc.text(seller.email || SELLER_EMAIL || userEmail || "Email non renseigne", 20, 73);
  doc.text(doc.splitTextToSize(seller.address || SELLER_ADDRESS, 78), 20, 80);
  if (seller.siret) doc.text(`SIRET : ${seller.siret}`, 20, 96);
  if (!seller.siret) {
    doc.setTextColor(190, 18, 60);
    doc.text("Facture non conforme (SIRET manquant)", 20, 96);
    doc.setTextColor(55, 65, 81);
  }
  if (seller.vatNumber) doc.text(`TVA : ${seller.vatNumber}`, 20, 102);

  doc.setTextColor(30, 27, 75);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Client", 120, 58);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(10);
  doc.text(buyer.name || "—", 120, 66);
  if (buyer.address) doc.text(doc.splitTextToSize(buyer.address, 68), 120, 73);
  if (buyer.email) doc.text(buyer.email, 120, 88);
  if (buyer.siret) doc.text(`SIRET : ${buyer.siret}`, 120, 96);
  if (buyer.vatNumber) doc.text(`TVA : ${buyer.vatNumber}`, 120, 102);

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(20, 112, pageWidth - 20, 112);

  doc.setFillColor(245, 243, 255);
  doc.rect(20, 118, pageWidth - 40, 10, "F");

  doc.setTextColor(91, 33, 182);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Prestation", 25, 125);
  doc.text("Qté", 98, 125);
  doc.text("PU HT", 116, 125);
  doc.text("TVA", 142, 125);
  doc.text(totals.isVatExempt ? "Total HT" : "Total TTC", pageWidth - 48, 125);

  doc.setTextColor(55, 65, 81);
  doc.setFont("helvetica", "normal");
  const descLines = doc.splitTextToSize(line.description || "Prestation", 68);
  doc.text(descLines, 25, 139);
  doc.text(String(line.quantity || 0), 98, 139);
  doc.text(formatInvoiceAmount(line.unitPrice), 116, 139);
  doc.text(`${totals.vatRate || 0}%`, 142, 139);
  doc.text(
    formatInvoiceAmount(totals.isVatExempt ? totals.totalHT : totals.totalTTC),
    pageWidth - 48,
    139,
  );

  const tableBottom = Math.max(160, 139 + descLines.length * 6);

  doc.setDrawColor(229, 231, 235);
  doc.line(20, tableBottom + 5, pageWidth - 20, tableBottom + 5);

  doc.setTextColor(55, 65, 81);
  doc.setFontSize(10);
  doc.text("Total HT", pageWidth - 82, tableBottom + 16);
  doc.text(formatInvoiceAmount(totals.totalHT), pageWidth - 44, tableBottom + 16);
  doc.text("TVA", pageWidth - 82, tableBottom + 24);
  doc.text(formatInvoiceAmount(totals.totalTVA), pageWidth - 44, tableBottom + 24);

  doc.setTextColor(255, 255, 255);
  doc.setFillColor(91, 33, 182);
  doc.rect(pageWidth - 88, tableBottom + 32, 68, 14, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL À PAYER", pageWidth - 84, tableBottom + 41);
  doc.text(formatInvoiceAmount(totals.totalTTC), pageWidth - 50, tableBottom + 41);

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  if (exemptionReason) {
    doc.text(exemptionReason, 20, tableBottom + 18);
  }
  doc.text(`Date d'échéance : ${formatDateFr(invoice.dueDate || invoice.due_date)}`, 20, tableBottom + 28);
  doc.text(FACTURX_NOT_TRANSMITTED_NOTE, 20, tableBottom + 38);

  doc.setFillColor(245, 243, 255);
  doc.rect(0, 268, pageWidth, 29, "F");
  doc.setTextColor(91, 33, 182);
  doc.setFontSize(7.5);
  doc.text(LATE_PENALTY_MENTION, pageWidth / 2, 278, { align: "center" });
  doc.text(FLAT_FEE_MENTION, pageWidth / 2, 284, { align: "center" });
  doc.setFontSize(8.5);
  doc.text("Microassist - Assistant fiscal pour micro-entrepreneurs", pageWidth / 2, 291, {
    align: "center",
  });

  doc.save(`facture-${getSafeFilenamePart(number)}.pdf`);
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
    if (saving) return;

    const validationError = validateForm();

    if (validationError) {
      alert(validationError);
      return;
    }

    if (!options.continueAsDraft && !form.seller_siret.trim()) {
      setShowMissingSiretWarning(true);
      return;
    }

    setSaving(true);

    try {
      const number = generateGuestInvoiceNumber();
      const invoice = buildStructuredInvoice(number);

      generateB2CInvoicePdf(invoice, { userEmail: user?.email });
      downloadTextFile(
        `facturx-draft-${number}.xml`,
        generateFacturXXml(invoice),
      );

      if (onSaved) {
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
      console.error("Erreur sauvegarde facture:", err);
      alert("Impossible de créer la facture.");
    } finally {
      setSaving(false);
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
      onClick={onClose}
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
          <button className="iconBtn" onClick={onClose} type="button">
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
          <button className="btn btnGhost" onClick={onClose} type="button">
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
