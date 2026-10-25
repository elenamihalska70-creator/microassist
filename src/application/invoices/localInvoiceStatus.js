export const LOCAL_INVOICE_MESSAGES = {
  local: "Tes nouvelles factures sont enregistrées dans ce navigateur, même après connexion. Elles n’ont pas été importées dans ton compte.",
  invalid: "Les données locales de factures n’ont pas pu être lues. Elles n’ont pas été importées. Ne réinitialise pas les données de cet appareil.",
  unavailable: "L’accès aux factures de cet appareil est indisponible. Aucun import automatique n’est effectué.",
};

// Read only: never normalize or repair the stored source, including invalid data.
export function readLocalInvoices(read) {
  let raw;
  try { raw = read(); } catch { return { status: "unavailable", items: [] }; }
  if (raw === null) return { status: "empty", items: [] };
  try {
    const items = JSON.parse(raw);
    if (!Array.isArray(items) || items.some(item => !item || typeof item !== "object" || Array.isArray(item))) {
      return { status: "invalid", items: [] };
    }
    return { status: items.length ? "local" : "empty", items };
  } catch { return { status: "invalid", items: [] }; }
}
