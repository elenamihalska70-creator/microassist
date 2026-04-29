import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  FACTURX_NOT_TRANSMITTED_NOTE,
  FACTURX_PREPARATION_LABEL,
  PDP_ROADMAP_NOTE,
  TVA_EXEMPTION_MENTION,
  VAT_MODES,
  createFacturXReadyInvoiceDraft,
  downloadTextFile,
  generateFacturXXml,
} from "../utils/facturx.js";
import "./ExpertDashboard.css";

const EXPERT_CLIENTS_STORAGE_KEY = "microassist_expert_clients";
const EXPERT_HISTORY_STORAGE_KEY = "microassist_expert_history";
const SELLER_NAME = import.meta.env.VITE_INVOICE_SELLER_NAME || "Microassist Expert";
const SELLER_ADDRESS =
  import.meta.env.VITE_INVOICE_SELLER_ADDRESS || "Adresse vendeur à compléter";
const SELLER_EMAIL = import.meta.env.VITE_INVOICE_SELLER_EMAIL || "";
const SELLER_VAT_NUMBER = import.meta.env.VITE_INVOICE_SELLER_VAT_NUMBER || "";

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "late", label: "En retard" },
  { key: "tva_risk", label: "Risque TVA" },
  { key: "alert", label: "Alertes" },
  { key: "ok", label: "OK" },
];

const mockClients = [
  {
    id: 1,
    name: "Sophie Martin",
    activity: "Prestation de services",
    revenue: "4 850 €",
    status: "ok",
    nextAction: "Déclaration URSSAF le 30 avril",
    notes: "Cliente autonome, peu de relances nécessaires.",
    priorities: [
      "Vérifier la prochaine échéance URSSAF",
      "Préparer le suivi mensuel",
    ],
    invoices: [],
  },
  {
    id: 2,
    name: "Lucas Bernard",
    activity: "Vente en ligne",
    revenue: "12 400 €",
    status: "tva_risk",
    nextAction: "Vérifier le seuil TVA",
    notes: "CA en hausse, surveiller le passage de seuil.",
    priorities: [
      "Contrôler le seuil TVA",
      "Préparer un point client sur la facturation",
    ],
    invoices: [],
  },
  {
    id: 3,
    name: "Emma Petit",
    activity: "Consulting",
    revenue: "2 100 €",
    status: "late",
    nextAction: "Déclaration en retard à régulariser",
    notes: "Besoin d’un rappel rapide cette semaine.",
    priorities: [
      "Régulariser la déclaration",
      "Envoyer un rappel client",
    ],
    invoices: [],
  },
  {
    id: 4,
    name: "Nina Robert",
    activity: "Graphisme",
    revenue: "6 320 €",
    status: "ok",
    nextAction: "Préparer l’échéance CFE",
    notes: "RAS, dossier stable.",
    priorities: [
      "Préparer l’échéance CFE",
      "Vérifier les charges estimées",
    ],
    invoices: [],
  },
  {
    id: 5,
    name: "Thomas Garcia",
    activity: "Activité mixte",
    revenue: "8 970 €",
    status: "alert",
    nextAction: "Contrôler les charges estimées",
    notes: "Activité mixte, points de vigilance sur le suivi.",
    priorities: [
      "Vérifier la ventilation vente / service",
      "Contrôler les charges estimées",
    ],
    invoices: [],
  },
];

function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToDate(dateString, days = 30) {
  const base = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function normalizeExpertClients(clients) {
  if (!Array.isArray(clients)) return mockClients;

  return clients.map((client) => ({
    ...client,
    invoices: Array.isArray(client.invoices) ? client.invoices : [],
  }));
}

function loadExpertClients() {
  try {
    const saved = window.localStorage?.getItem(EXPERT_CLIENTS_STORAGE_KEY);
    return saved ? normalizeExpertClients(JSON.parse(saved)) : mockClients;
  } catch {
    return mockClients;
  }
}

function loadExpertHistory() {
  try {
    const saved = window.localStorage?.getItem(EXPERT_HISTORY_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.map((event) => ({
      ...event,
      date: event.date ? new Date(event.date) : new Date(),
    }));
  } catch {
    return [];
  }
}

function formatInvoiceDate(date) {
  if (!date) return "Date non renseignée";

  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) return "Date non renseignée";

  return parsedDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatInvoiceAmount(amount) {
  return `${Number(amount || 0).toLocaleString("fr-FR")} €`;
}

function getInvoiceTotal(invoice) {
  if (invoice?.totals?.totalTTC !== undefined) return invoice.totals.totalTTC;
  if (invoice?.amount !== undefined) return invoice.amount;
  return 0;
}

function getInvoiceDate(invoice) {
  return invoice?.issueDate || invoice?.date || "";
}

function getInvoiceNumber(invoice) {
  return invoice?.invoiceNumber || `EXP-${invoice.id}`;
}

function isFacturXDraft(invoice) {
  return invoice?.formatStatus === "facturx_ready_draft";
}

function getStatusLabels(invoice) {
  return Array.isArray(invoice?.statuses) && invoice.statuses.length > 0
    ? invoice.statuses
    : ["Brouillon", "PDF généré", "Transmission PDP non activée"];
}

function getSafeFilenamePart(value) {
  return String(value || "client")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function downloadExpertInvoiceXml(invoice) {
  if (!isFacturXDraft(invoice)) return;

  downloadTextFile(
    `facturx-draft-${getSafeFilenamePart(getInvoiceNumber(invoice))}.xml`,
    generateFacturXXml(invoice),
  );
}

function generateExpertInvoicePdf(client, invoice) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const invoiceNumber = getInvoiceNumber(invoice);
  const total = Number(getInvoiceTotal(invoice) || 0);
  const line = invoice.lines?.[0] || {
    description: invoice.description || "Prestation",
    quantity: 1,
    unitPrice: invoice.amount || 0,
    vatRate: 0,
    totalHT: invoice.amount || 0,
    totalTVA: 0,
    totalTTC: invoice.amount || 0,
  };
  const buyerName = invoice.buyer?.name || client.name || "Client";
  const seller = invoice.seller || {};
  const buyer = invoice.buyer || {};

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("FACTURE", 20, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`N° ${invoiceNumber}`, 20, 29);
  doc.text(FACTURX_PREPARATION_LABEL, 20, 36);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Émetteur", 20, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(seller.name || SELLER_NAME, 20, 68);
  doc.text(doc.splitTextToSize(seller.address || SELLER_ADDRESS, 76), 20, 75);
  if (seller.siret) doc.text(`SIRET : ${seller.siret}`, 20, 90);
  if (seller.vatNumber) doc.text(`TVA : ${seller.vatNumber}`, 20, 96);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Client", 116, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(buyerName, 116, 68);
  if (buyer.address) doc.text(doc.splitTextToSize(buyer.address, 72), 116, 75);
  if (buyer.siret) doc.text(`SIRET : ${buyer.siret}`, 116, 90);
  if (buyer.vatNumber) doc.text(`TVA : ${buyer.vatNumber}`, 116, 96);

  doc.setFont("helvetica", "bold");
  doc.text("Date", 20, 110);
  doc.setFont("helvetica", "normal");
  doc.text(formatInvoiceDate(getInvoiceDate(invoice)), 45, 110);
  doc.setFont("helvetica", "bold");
  doc.text("Échéance", 116, 110);
  doc.setFont("helvetica", "normal");
  doc.text(formatInvoiceDate(invoice.dueDate), 145, 110);

  doc.setDrawColor(226, 232, 240);
  doc.line(20, 122, pageWidth - 20, 122);

  doc.setFillColor(248, 250, 252);
  doc.rect(20, 132, pageWidth - 40, 14, "F");
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  doc.text("Description", 26, 141);
  doc.text("Qté", 104, 141);
  doc.text("PU HT", 124, 141);
  doc.text("TVA", 150, 141);
  doc.text("Total TTC", pageWidth - 42, 141);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  const descriptionLines = doc.splitTextToSize(
    line.description || "Prestation",
    70,
  );
  doc.text(descriptionLines, 26, 158);
  doc.text(String(line.quantity || 0), 104, 158);
  doc.text(formatInvoiceAmount(line.unitPrice), 124, 158);
  doc.text(`${line.vatRate || 0}%`, 150, 158);
  doc.text(formatInvoiceAmount(line.totalTTC ?? total), pageWidth - 42, 158);

  const totalY = Math.max(182, 158 + descriptionLines.length * 6);
  doc.setDrawColor(226, 232, 240);
  doc.line(20, totalY, pageWidth - 20, totalY);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Total HT", pageWidth - 82, totalY + 12);
  doc.text(formatInvoiceAmount(invoice.totals?.totalHT ?? line.totalHT), pageWidth - 42, totalY + 12);
  doc.text("TVA", pageWidth - 82, totalY + 20);
  doc.text(formatInvoiceAmount(invoice.totals?.totalTVA ?? line.totalTVA), pageWidth - 42, totalY + 20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.text("Total TTC", pageWidth - 82, totalY + 32);
  doc.text(formatInvoiceAmount(total), pageWidth - 42, totalY + 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (invoice.vatExemptionReason) {
    doc.text(invoice.vatExemptionReason, 20, totalY + 18);
  }
  doc.text(invoice.paymentTerms || "Conditions de paiement à compléter", 20, totalY + 28);
  doc.text(FACTURX_NOT_TRANSMITTED_NOTE, 20, totalY + 40);

  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageHeight - 27, pageWidth, 27, "F");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text("Microassist Expert", pageWidth / 2, pageHeight - 11, { align: "center" });

  doc.save(`facture-${getSafeFilenamePart(buyerName)}-${getSafeFilenamePart(invoiceNumber)}.pdf`);
}

function getStatusLabel(status) {
  switch (status) {
    case "late":
      return "En retard";
    case "tva_risk":
      return "Risque TVA";
    case "alert":
      return "Alerte";
    default:
      return "OK";
  }
}

export default function ExpertDashboard() {
  const [clients, setClients] = useState(loadExpertClients);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [reminderClientId, setReminderClientId] = useState(null);
  const [reminderType, setReminderType] = useState("declaration");
  const [reminderMessage, setReminderMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [clientHistory, setClientHistory] = useState(loadExpertHistory);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [addClientError, setAddClientError] = useState("");
  const [noteClientId, setNoteClientId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState("");
  const [invoiceClientId, setInvoiceClientId] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    clientName: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    vatMode: VAT_MODES.exempt,
    dueDate: addDaysToDate(getTodayInputDate(), 30),
    buyerSiret: "",
    sellerSiret: "",
  });
  const [invoiceError, setInvoiceError] = useState("");
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    activity: "",
    revenue: "",
    nextAction: "",
    status: "ok",
  });

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId],
  );
  const reminderClient = useMemo(
    () => clients.find((client) => client.id === reminderClientId) || null,
    [clients, reminderClientId],
  );
  const noteClient = useMemo(
    () => clients.find((client) => client.id === noteClientId) || null,
    [clients, noteClientId],
  );
  const invoiceClient = useMemo(
    () => clients.find((client) => client.id === invoiceClientId) || null,
    [clients, invoiceClientId],
  );
  const selectedClientHistory = useMemo(() => {
    if (!selectedClient) return [];

    return clientHistory.filter((event) => event.clientId === selectedClient.id);
  }, [clientHistory, selectedClient]);
  const selectedClientInvoices = useMemo(() => {
    if (!selectedClient) return [];

    return Array.isArray(selectedClient.invoices) ? selectedClient.invoices : [];
  }, [selectedClient]);
  const selectedClientNotes = useMemo(() => {
    if (!selectedClient) return [];

    if (Array.isArray(selectedClient.notesList) && selectedClient.notesList.length > 0) {
      return selectedClient.notesList;
    }

    return selectedClient.notes ? [selectedClient.notes] : [];
  }, [selectedClient]);

  const kpis = useMemo(() => {
    const clientsSuivis = clients.length;
    const enRetard = clients.filter((client) => client.status === "late").length;
    const risqueTva = clients.filter(
      (client) => client.status === "tva_risk",
    ).length;
    const actionsCetteSemaine = clients.filter(
      (client) =>
        client.status === "late" ||
        client.status === "tva_risk" ||
        client.status === "alert",
    ).length;

    return { clientsSuivis, enRetard, risqueTva, actionsCetteSemaine };
  }, [clients]);

  const visibleClients = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesFilter =
        activeFilter === "all" ? true : client.status === activeFilter;
      const matchesSearch = normalizedQuery
        ? client.name.toLowerCase().includes(normalizedQuery)
        : true;

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, clients, searchQuery]);

  useEffect(() => {
    try {
      // FUTURE: persist invoices after invoice schema migration.
      window.localStorage?.setItem(
        EXPERT_CLIENTS_STORAGE_KEY,
        JSON.stringify(clients),
      );
    } catch {
      // Local persistence is best-effort for the expert prototype.
    }
  }, [clients]);

  useEffect(() => {
    try {
      window.localStorage?.setItem(
        EXPERT_HISTORY_STORAGE_KEY,
        JSON.stringify(clientHistory),
      );
    } catch {
      // Local persistence is best-effort for the expert prototype.
    }
  }, [clientHistory]);

  function buildReminderMessage(client) {
    if (!client) return "";

    return `Bonjour ${client.name}, petit rappel concernant : ${client.nextAction}. Merci de vérifier ce point dès que possible.`;
  }

  function openReminderModal(client) {
    setReminderClientId(client.id);
    setReminderType("declaration");
    setReminderMessage(buildReminderMessage(client));
  }

  function closeReminderModal() {
    setReminderClientId(null);
    setReminderType("declaration");
    setReminderMessage("");
  }

  function openNoteModal(client) {
    setNoteClientId(client.id);
    setNoteDraft("");
    setNoteError("");
  }

  function closeNoteModal() {
    setNoteClientId(null);
    setNoteDraft("");
    setNoteError("");
  }

  function openInvoiceModal(client) {
    setInvoiceClientId(client.id);
    setInvoiceError("");
    setInvoiceForm({
      clientName: client.name,
      description: "",
      quantity: "1",
      unitPrice: "",
      vatMode: VAT_MODES.exempt,
      dueDate: addDaysToDate(getTodayInputDate(), 30),
      buyerSiret: "",
      sellerSiret: "",
    });
  }

  function closeInvoiceModal() {
    setInvoiceClientId(null);
    setInvoiceError("");
    setInvoiceForm({
      clientName: "",
      description: "",
      quantity: "1",
      unitPrice: "",
      vatMode: VAT_MODES.exempt,
      dueDate: addDaysToDate(getTodayInputDate(), 30),
      buyerSiret: "",
      sellerSiret: "",
    });
  }

  function handleInvoiceFormChange(field, value) {
    setInvoiceForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    if (invoiceError) {
      setInvoiceError("");
    }
  }

  function openAddClientModal() {
    setAddClientError("");
    setNewClientForm({
      name: "",
      activity: "",
      revenue: "",
      nextAction: "",
      status: "ok",
    });
    setShowAddClientModal(true);
  }

  function closeAddClientModal() {
    setAddClientError("");
    setShowAddClientModal(false);
  }

  function handleNewClientChange(field, value) {
    setNewClientForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleAddClient() {
    const clientName = newClientForm.name.trim();
    const clientActivity = newClientForm.activity.trim();
    const clientRevenue = newClientForm.revenue.trim();
    const clientNextAction = newClientForm.nextAction.trim();
    const normalizedRevenue = clientRevenue.replace(/\s/g, "").replace(",", ".");
    const revenueValue = Number(normalizedRevenue);

    if (!clientName) {
      setAddClientError("Le nom du client est requis.");
      return;
    }

    if (!clientActivity) {
      setAddClientError("L’activité est requise.");
      return;
    }

    if (!clientRevenue || Number.isNaN(revenueValue) || revenueValue <= 0) {
      setAddClientError("Le chiffre d’affaires doit être un nombre positif.");
      return;
    }

    if (!clientNextAction) {
      setAddClientError("La prochaine action est requise.");
      return;
    }

    setAddClientError("");

    const nextClient = {
      id: Date.now(),
      name: clientName,
      activity: clientActivity,
      revenue: `${revenueValue.toLocaleString("fr-FR")} €`,
      nextAction: clientNextAction,
      status: newClientForm.status,
      priorities: [
        "Vérifier les informations du dossier",
        "Préparer la prochaine action",
      ],
      notes: "Dossier ajouté manuellement dans le prototype expert.",
      invoices: [],
    };

    setClients((currentClients) => [nextClient, ...currentClients]);
    setSuccessMessage(`Client ajouté : ${clientName}`);
    closeAddClientModal();
  }

  function handleSimulateReminder() {
    if (!reminderClient) return;

    const reminderTypeLabels = {
      declaration: "Déclaration URSSAF",
      tva: "TVA",
      cfe: "CFE",
      pieces: "Pièces manquantes",
      autre: "Autre",
    };

    setClientHistory((currentHistory) => [
      {
        clientId: reminderClient.id,
        type: "reminder",
        label: "Rappel envoyé",
        detail: reminderTypeLabels[reminderType] || "Autre",
        date: new Date(),
      },
      ...currentHistory,
    ]);
    setSuccessMessage(`Rappel préparé pour ${reminderClient.name}.`);
    closeReminderModal();
  }

  function handleAddNote() {
    if (!noteClient) return;

    const trimmedNote = noteDraft.trim();

    if (!trimmedNote) {
      setNoteError("La note expert ne peut pas être vide.");
      return;
    }

    const nextNotesList = Array.isArray(noteClient.notesList)
      ? [trimmedNote, ...noteClient.notesList]
      : noteClient.notes
        ? [trimmedNote, noteClient.notes]
        : [trimmedNote];

    setClients((currentClients) =>
      currentClients.map((client) =>
        client.id === noteClient.id
          ? {
              ...client,
              notes: trimmedNote,
              notesList: nextNotesList,
            }
          : client,
      ),
    );

    setClientHistory((currentHistory) => [
      {
        clientId: noteClient.id,
        type: "note",
        label: "Note ajoutée",
        detail:
          trimmedNote.length > 60 ? `${trimmedNote.slice(0, 60)}…` : trimmedNote,
        date: new Date(),
      },
      ...currentHistory,
    ]);

    setSuccessMessage(`Note ajoutée pour ${noteClient.name}.`);
    closeNoteModal();
  }

  function handleCreateInvoice() {
    if (!invoiceClient) return;

    const description = invoiceForm.description.trim();
    const normalizedQuantity = String(invoiceForm.quantity || "")
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");
    const normalizedUnitPrice = String(invoiceForm.unitPrice || "")
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");
    const quantity = Number(normalizedQuantity);
    const unitPrice = Number(normalizedUnitPrice);

    if (!invoiceForm.clientName.trim()) {
      setInvoiceError("Le nom du client est requis.");
      return;
    }

    if (!description) {
      setInvoiceError("La description est requise.");
      return;
    }

    if (!normalizedQuantity || Number.isNaN(quantity) || quantity <= 0) {
      setInvoiceError("La quantité doit être un nombre positif.");
      return;
    }

    if (!normalizedUnitPrice || Number.isNaN(unitPrice) || unitPrice <= 0) {
      setInvoiceError("Le prix unitaire doit être un nombre positif.");
      return;
    }

    if (!invoiceForm.dueDate) {
      setInvoiceError("La date d’échéance est requise.");
      return;
    }

    const id = Date.now();
    const issueDate = getTodayInputDate();
    const invoice = createFacturXReadyInvoiceDraft({
      id,
      invoiceNumber: `EXP-${new Date().getFullYear()}-${String(id).slice(-6)}`,
      issueDate,
      dueDate: invoiceForm.dueDate,
      seller: {
        name: SELLER_NAME,
        address: SELLER_ADDRESS,
        siret: invoiceForm.sellerSiret.trim(),
        vatNumber: SELLER_VAT_NUMBER,
        email: SELLER_EMAIL,
      },
      buyer: {
        name: invoiceForm.clientName.trim(),
        address: "Adresse acheteur à compléter",
        siret: invoiceForm.buyerSiret.trim(),
        vatNumber: "",
        email: "",
      },
      description,
      quantity,
      unitPrice,
      vatMode: invoiceForm.vatMode,
    });

    const pdfClient = {
      ...invoiceClient,
      name: invoiceForm.clientName.trim(),
    };

    setClients((currentClients) =>
      currentClients.map((client) =>
        client.id === invoiceClient.id
          ? {
              ...client,
              invoices: [invoice, ...(client.invoices || [])],
            }
          : client,
      ),
    );

    setClientHistory((currentHistory) => [
      {
        clientId: invoiceClient.id,
        type: "invoice",
        label: "Facture préparée",
        detail: formatInvoiceAmount(invoice.totals.totalTTC),
        date: new Date(),
      },
      ...currentHistory,
    ]);

    generateExpertInvoicePdf(pdfClient, invoice);
    downloadExpertInvoiceXml(invoice);
    setSuccessMessage(
      `Facture préparée : ${formatInvoiceAmount(invoice.totals.totalTTC)}`,
    );
    closeInvoiceModal();
  }

  if (selectedClient) {
    return (
      <section className="expertDashboard">
        <div className="expertBanner">
          Microassist Expert aide les professionnels à suivre plusieurs
          micro-entrepreneurs, repérer les risques et éviter les oublis côté
          client.
        </div>

        <div className="expertDetail">
          <button
            type="button"
            className="btn btnGhost btnSmall"
            onClick={() => setSelectedClientId(null)}
          >
            Retour à la liste
          </button>

          <div className="expertDetailCard">
            <div className="expertDetailHeader">
              <div>
                <p className="expertDashboard__eyebrow">Fiche client</p>
                <h2>{selectedClient.name}</h2>
              </div>
              <span
                className={`expertBadge expertBadge--${selectedClient.status}`}
              >
                {getStatusLabel(selectedClient.status)}
              </span>
            </div>

            <div className="expertDetailGrid">
              <div className="expertInfoBlock">
                <span>Activité</span>
                <strong>{selectedClient.activity}</strong>
              </div>
              <div className="expertInfoBlock">
                <span>Chiffre d’affaires</span>
                <strong>{selectedClient.revenue}</strong>
              </div>
              <div className="expertInfoBlock">
                <span>Prochaine action</span>
                <strong>{selectedClient.nextAction}</strong>
              </div>
              <div className="expertInfoBlock">
                <span>Statut</span>
                <strong>{getStatusLabel(selectedClient.status)}</strong>
              </div>
            </div>

            <div className="expertPanelBlock">
              <h3>Notes expert</h3>
              {selectedClientNotes.length > 0 ? (
                <ul className="expertNotesList">
                  {selectedClientNotes.map((note, index) => (
                    <li key={`${selectedClient.id}-note-${index}`}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p>Aucune note pour ce client.</p>
              )}
            </div>

            <div className="expertPanelBlock">
              <h3>Smart Priorités</h3>
              <ul className="expertPriorityList">
                {selectedClient.priorities.map((priority) => (
                  <li key={priority}>{priority}</li>
                ))}
              </ul>
            </div>

            <div className="expertPanelBlock">
              <div className="expertPanelHeader">
                <div>
                  <h3>Factures</h3>
                  <p className="expertPanelNote">{PDP_ROADMAP_NOTE}</p>
                </div>
                <button
                  type="button"
                  className="btn btnPrimary btnSmall"
                  onClick={() => openInvoiceModal(selectedClient)}
                >
                  Créer une facture
                </button>
              </div>

              {selectedClientInvoices.length === 0 ? (
                <p className="expertHistoryEmpty">
                  Aucune facture pour ce client.
                </p>
              ) : (
                <ul className="expertInvoiceList">
                  {selectedClientInvoices.map((invoice) => (
                    <li key={invoice.id} className="expertInvoiceItem">
                      <div>
                        <span className="expertInvoiceDate">
                          {formatInvoiceDate(getInvoiceDate(invoice))}
                        </span>
                        <strong>{formatInvoiceAmount(getInvoiceTotal(invoice))}</strong>
                        <span className="expertInvoiceMeta">
                          {getInvoiceNumber(invoice)}
                        </span>
                        <span className="expertInvoiceMeta">
                          {FACTURX_PREPARATION_LABEL}
                        </span>
                        <div className="expertStatusList">
                          {getStatusLabels(invoice).map((status) => (
                            <span key={status} className="expertStatusPill">
                              {status}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="expertInvoiceActions">
                        <button
                          type="button"
                          className="btn btnGhost btnSmall"
                          onClick={() =>
                            generateExpertInvoicePdf(selectedClient, invoice)
                          }
                        >
                          Télécharger PDF
                        </button>
                        {isFacturXDraft(invoice) && (
                          <button
                            type="button"
                            className="btn btnGhost btnSmall"
                            onClick={() => downloadExpertInvoiceXml(invoice)}
                          >
                            Télécharger XML
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="expertPanelBlock">
              <h3>Historique des actions</h3>
              {selectedClientHistory.length === 0 ? (
                <p className="expertHistoryEmpty">Aucune action pour ce client.</p>
              ) : (
                <ul className="expertHistoryList">
                  {selectedClientHistory.map((event, index) => (
                    <li
                      key={`${event.clientId}-${event.type}-${event.date.toISOString()}-${index}`}
                    >
                      <span className="expertHistoryDate">
                        {event.date.toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span className="expertHistoryText">
                        {event.type === "invoice"
                          ? `${event.label} : ${event.detail}`
                          : `${event.label} (${event.detail})`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="expertToast" role="status" aria-live="polite">
            <span>{successMessage}</span>
            <button
              type="button"
              className="expertToastClose"
              onClick={() => setSuccessMessage("")}
              aria-label="Fermer le message"
            >
              ✕
            </button>
          </div>
        )}

        {invoiceClient && (
          <div className="expertModalOverlay" role="presentation">
            <div
              className="expertModalCard"
              role="dialog"
              aria-modal="true"
              aria-labelledby="expert-invoice-title"
            >
              <div className="expertModalHeader">
                <div>
                  <h3 id="expert-invoice-title">Créer une facture</h3>
                  <p className="expertModalSubtitle">
                    {FACTURX_PREPARATION_LABEL}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btnGhost btnSmall"
                  onClick={closeInvoiceModal}
                >
                  Fermer
                </button>
              </div>

              <div className="expertModalField">
                <label htmlFor="expert-invoice-client-name">Client</label>
                <input
                  id="expert-invoice-client-name"
                  type="text"
                  className="expertModalInput"
                  value={invoiceForm.clientName}
                  onChange={(event) =>
                    handleInvoiceFormChange("clientName", event.target.value)
                  }
                />
              </div>

              <div className="expertModalField">
                <label htmlFor="expert-invoice-description">Description</label>
                <input
                  id="expert-invoice-description"
                  type="text"
                  className="expertModalInput"
                  value={invoiceForm.description}
                  onChange={(event) =>
                    handleInvoiceFormChange("description", event.target.value)
                  }
                />
              </div>

              <div className="expertModalField">
                <label htmlFor="expert-invoice-quantity">Quantité</label>
                <input
                  id="expert-invoice-quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="expertModalInput"
                  value={invoiceForm.quantity}
                  onChange={(event) =>
                    handleInvoiceFormChange("quantity", event.target.value)
                  }
                />
              </div>

              <div className="expertModalField">
                <label htmlFor="expert-invoice-unit-price">Prix unitaire HT (€)</label>
                <input
                  id="expert-invoice-unit-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="expertModalInput"
                  value={invoiceForm.unitPrice}
                  onChange={(event) =>
                    handleInvoiceFormChange("unitPrice", event.target.value)
                  }
                />
              </div>

              <div className="expertModalField">
                <label htmlFor="expert-invoice-vat-mode">Mode TVA</label>
                <select
                  id="expert-invoice-vat-mode"
                  className="expertModalSelect"
                  value={invoiceForm.vatMode}
                  onChange={(event) =>
                    handleInvoiceFormChange("vatMode", event.target.value)
                  }
                >
                  <option value={VAT_MODES.exempt}>
                    {TVA_EXEMPTION_MENTION}
                  </option>
                  <option value={VAT_MODES.standard}>TVA standard</option>
                  <option value={VAT_MODES.later}>À compléter plus tard</option>
                </select>
              </div>

              <div className="expertModalField">
                <label htmlFor="expert-invoice-due-date">Date d’échéance</label>
                <input
                  id="expert-invoice-due-date"
                  type="date"
                  className="expertModalInput"
                  value={invoiceForm.dueDate}
                  onChange={(event) =>
                    handleInvoiceFormChange("dueDate", event.target.value)
                  }
                />
              </div>

              <div className="expertModalField">
                <label htmlFor="expert-invoice-buyer-siret">
                  SIRET acheteur (optionnel)
                </label>
                <input
                  id="expert-invoice-buyer-siret"
                  type="text"
                  className="expertModalInput"
                  value={invoiceForm.buyerSiret}
                  onChange={(event) =>
                    handleInvoiceFormChange("buyerSiret", event.target.value)
                  }
                />
              </div>

              <div className="expertModalField">
                <label htmlFor="expert-invoice-seller-siret">
                  SIRET vendeur (optionnel)
                </label>
                <input
                  id="expert-invoice-seller-siret"
                  type="text"
                  className="expertModalInput"
                  value={invoiceForm.sellerSiret}
                  onChange={(event) =>
                    handleInvoiceFormChange("sellerSiret", event.target.value)
                  }
                />
              </div>

              <div className="expertFacturxNotice">
                {FACTURX_NOT_TRANSMITTED_NOTE}
              </div>

              {invoiceError && (
                <div className="expertModalError" role="alert">
                  {invoiceError}
                </div>
              )}

              <div className="expertModalActions">
                <button
                  type="button"
                  className="btn btnGhost btnSmall"
                  onClick={closeInvoiceModal}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn btnPrimary btnSmall"
                  onClick={handleCreateInvoice}
                >
                  Préparer PDF + XML
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="expertDashboard">
      <div className="expertBanner">
        Microassist Expert aide les professionnels à suivre plusieurs
        micro-entrepreneurs, repérer les risques et éviter les oublis côté
        client.
      </div>

      <div className="expertDashboard__header">
        <div>
          <p className="expertDashboard__eyebrow">Mode expert</p>
          <h2>Portefeuille clients</h2>
          <p className="expertDashboard__subtitle">
            Vue rapide des dossiers à suivre en priorité.
          </p>
        </div>
        <button
          type="button"
          className="btn btnPrimary btnSmall"
          onClick={openAddClientModal}
        >
          + Ajouter client
        </button>
      </div>

      <div className="expertKpis">
        <div className="expertKpiCard">
          <span>Clients suivis</span>
          <strong>{kpis.clientsSuivis}</strong>
        </div>
        <div className="expertKpiCard">
          <span>En retard</span>
          <strong>{kpis.enRetard}</strong>
        </div>
        <div className="expertKpiCard">
          <span>Risque TVA</span>
          <strong>{kpis.risqueTva}</strong>
        </div>
        <div className="expertKpiCard">
          <span>Actions cette semaine</span>
          <strong>{kpis.actionsCetteSemaine}</strong>
        </div>
      </div>

      <div className="expertFilters">
        <div className="expertSearch">
          <label className="expertSearchLabel" htmlFor="expert-client-search">
            Recherche client
          </label>
          <input
            id="expert-client-search"
            type="text"
            className="expertSearchInput"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Rechercher un client..."
          />
        </div>
        <div className="expertFilterList" role="tablist" aria-label="Filtres clients">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`expertFilterButton ${
                activeFilter === filter.key ? "expertFilterButton--active" : ""
              }`}
              onClick={() => setActiveFilter(filter.key)}
              aria-pressed={activeFilter === filter.key}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="expertFilterCount">
          {visibleClients.length} dossier(s) affiché(s)
        </div>
      </div>

      <div className="expertDashboard__grid">
        {visibleClients.map((client) => (
          <article
            key={client.id}
            className={`expertCard expertCard--${client.status}`}
          >
            <div className="expertCard__top">
              <div>
                <h3>{client.name}</h3>
                <p>{client.activity}</p>
              </div>
              <span className={`expertBadge expertBadge--${client.status}`}>
                {getStatusLabel(client.status)}
              </span>
            </div>

            <div className="expertCard__body">
              <div>
                <span>Chiffre d’affaires</span>
                <strong>{client.revenue}</strong>
              </div>
              <div>
                <span>Prochaine action</span>
                <strong>{client.nextAction}</strong>
              </div>
            </div>

            <div className="expertCard__actions">
              <button
                type="button"
                className="btn btnPrimary btnSmall"
                onClick={() => setSelectedClientId(client.id)}
              >
                Voir fiche
              </button>
              <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={() => openReminderModal(client)}
              >
                Envoyer rappel
              </button>
              <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={() => openNoteModal(client)}
              >
                Ajouter note
              </button>
            </div>
          </article>
        ))}

        {visibleClients.length === 0 && (
          <div className="expertEmptyState">Aucun dossier pour cette recherche.</div>
        )}
      </div>

      {successMessage && (
        <div className="expertToast" role="status" aria-live="polite">
          <span>{successMessage}</span>
          <button
            type="button"
            className="expertToastClose"
            onClick={() => setSuccessMessage("")}
            aria-label="Fermer le message"
          >
            ✕
          </button>
        </div>
      )}

      {reminderClient && (
        <div className="expertModalOverlay" role="presentation">
          <div
            className="expertModalCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expert-reminder-title"
          >
            <div className="expertModalHeader">
              <div>
                <h3 id="expert-reminder-title">Envoyer un rappel</h3>
                <p className="expertModalSubtitle">{reminderClient.name}</p>
              </div>
              <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={closeReminderModal}
              >
                Fermer
              </button>
            </div>

            <div className="expertModalField">
              <label htmlFor="expert-reminder-type">Type de rappel</label>
              <select
                id="expert-reminder-type"
                className="expertModalSelect"
                value={reminderType}
                onChange={(event) => setReminderType(event.target.value)}
              >
                <option value="declaration">Déclaration URSSAF</option>
                <option value="tva">TVA</option>
                <option value="cfe">CFE</option>
                <option value="pieces">Pièces manquantes</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            <div className="expertModalField">
              <label htmlFor="expert-reminder-message">Message</label>
              <textarea
                id="expert-reminder-message"
                className="expertModalTextarea"
                value={reminderMessage}
                onChange={(event) => setReminderMessage(event.target.value)}
                rows={5}
              />
            </div>

            <div className="expertModalActions">
              <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={closeReminderModal}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btnPrimary btnSmall"
                onClick={handleSimulateReminder}
              >
                Simuler l’envoi
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddClientModal && (
        <div className="expertModalOverlay" role="presentation">
          <div
            className="expertModalCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expert-add-client-title"
          >
            <div className="expertModalHeader">
              <div>
                <h3 id="expert-add-client-title">Ajouter un client</h3>
              </div>
              <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={closeAddClientModal}
              >
                Fermer
              </button>
            </div>

            <div className="expertModalField">
              <label htmlFor="expert-client-name">Nom du client</label>
              <input
                id="expert-client-name"
                type="text"
                className="expertModalInput"
                value={newClientForm.name}
                onChange={(event) =>
                  handleNewClientChange("name", event.target.value)
                }
              />
            </div>

            <div className="expertModalField">
              <label htmlFor="expert-client-activity">Activité</label>
              <input
                id="expert-client-activity"
                type="text"
                className="expertModalInput"
                value={newClientForm.activity}
                onChange={(event) =>
                  handleNewClientChange("activity", event.target.value)
                }
              />
            </div>

            <div className="expertModalField">
              <label htmlFor="expert-client-revenue">Chiffre d’affaires</label>
              <input
                id="expert-client-revenue"
                type="text"
                className="expertModalInput"
                value={newClientForm.revenue}
                onChange={(event) =>
                  handleNewClientChange("revenue", event.target.value)
                }
              />
            </div>

            <div className="expertModalField">
              <label htmlFor="expert-client-next-action">Prochaine action</label>
              <input
                id="expert-client-next-action"
                type="text"
                className="expertModalInput"
                value={newClientForm.nextAction}
                onChange={(event) =>
                  handleNewClientChange("nextAction", event.target.value)
                }
              />
            </div>

            <div className="expertModalField">
              <label htmlFor="expert-client-status">Statut</label>
              <select
                id="expert-client-status"
                className="expertModalSelect"
                value={newClientForm.status}
                onChange={(event) =>
                  handleNewClientChange("status", event.target.value)
                }
              >
                <option value="ok">OK</option>
                <option value="late">En retard</option>
                <option value="tva_risk">Risque TVA</option>
                <option value="alert">Alerte</option>
              </select>
            </div>

            {addClientError && (
              <div className="expertModalError" role="alert">
                {addClientError}
              </div>
            )}

            <div className="expertModalActions">
              <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={closeAddClientModal}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btnPrimary btnSmall"
                onClick={handleAddClient}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {noteClient && (
        <div className="expertModalOverlay" role="presentation">
          <div
            className="expertModalCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expert-add-note-title"
          >
            <div className="expertModalHeader">
              <div>
                <h3 id="expert-add-note-title">Ajouter une note</h3>
                <p className="expertModalSubtitle">{noteClient.name}</p>
              </div>
              <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={closeNoteModal}
              >
                Fermer
              </button>
            </div>

            <div className="expertModalField">
              <label htmlFor="expert-note-message">Note expert</label>
              <textarea
                id="expert-note-message"
                className="expertModalTextarea"
                value={noteDraft}
                onChange={(event) => {
                  setNoteDraft(event.target.value);
                  if (noteError) {
                    setNoteError("");
                  }
                }}
                rows={5}
              />
            </div>

            {noteError && (
              <div className="expertModalError" role="alert">
                {noteError}
              </div>
            )}

            <div className="expertModalActions">
              <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={closeNoteModal}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btnPrimary btnSmall"
                onClick={handleAddNote}
              >
                Ajouter la note
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
