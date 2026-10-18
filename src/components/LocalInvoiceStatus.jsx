import { useEffect, useState } from "react";
import { LOCAL_INVOICE_MESSAGES, readLocalInvoices } from "../application/invoices/localInvoiceStatus.js";

const readStatus = () => readLocalInvoices(() => localStorage.getItem("guest_invoices")).status;

export default function LocalInvoiceStatus({ userId, invoices, onStorageChange }) {
  const [status, setStatus] = useState(readStatus);
  useEffect(() => {
    const refresh = () => {
      const snapshot = readLocalInvoices(() => localStorage.getItem("guest_invoices"));
      setStatus(snapshot.status);
      // Also reconcile after remount/focus: storage events can occur off-section.
      if (JSON.stringify(snapshot.items) !== JSON.stringify(invoices)) onStorageChange(snapshot.items);
    };
    const onStorage = event => {
      if (event.key === null || event.key === "guest_invoices") {
        refresh();
      }
    };
    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [userId, invoices, onStorageChange]);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" data-testid="local-invoice-status"
      style={status === "empty" ? undefined : { marginTop: 16, padding: 16, border: "1px solid #64748b", borderRadius: 8, background: "#f1f5f9", color: "#1e293b" }}>
      {LOCAL_INVOICE_MESSAGES[status] || ""}
    </div>
  );
}
