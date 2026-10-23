import { useRef, useState } from "react";
import { generateB2CInvoicePdf } from "./InvoiceGenerator.jsx";
import { invoicePdfErrorMessage } from "../utils/invoicePdfErrors.js";

export default function InvoicePdfDownloadButton({ invoice, userEmail = "", children }) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await generateB2CInvoicePdf(invoice, { userEmail });
    } catch (error) {
      setError(invoicePdfErrorMessage(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return <>
    <button className="btn btnActionSecondary btnSmall" type="button" onClick={download} disabled={busy} aria-busy={busy}>
      {busy ? "Préparation du PDF…" : children}
    </button>
    {error && <span role="alert" style={{ display: "block", marginTop: 8 }}>{error}</span>}
  </>;
}
