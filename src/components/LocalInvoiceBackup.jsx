import { useLayoutEffect, useRef, useState } from 'react';
import { LOCAL_INVOICE_KEY, MAX_BACKUP_BYTES, createBackup, parseBackup, readCurrentInvoices, previewRestore, confirmRestore } from '../application/invoices/localInvoiceBackup.js';

const read = () => localStorage.getItem(LOCAL_INVOICE_KEY);
const labels = { conflict: 'Conflit', refused: 'Entrée refusée' };
export default function LocalInvoiceBackup({ onRestored }) {
  const [open, setOpen] = useState(false), [reading, setReading] = useState(false);
  const [preview, setPreview] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState('');
  const lifetime = useRef(null), input = useRef(null);
  useLayoutEffect(() => {
    const scope = { active: true, sequence: 0 }; lifetime.current = scope;
    return () => { scope.active = false; };
  }, []);
  function close() {
    if (lifetime.current) lifetime.current.sequence++;
    setOpen(false); setReading(false); setPreview(null); setError(''); setMessage('');
  }
  function exportInvoices() {
    setError(''); setMessage('');
    try {
      const json = createBackup(read);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
      try {
        const anchor = document.createElement('a'); anchor.href = url;
        anchor.download = `microassist-factures-locales-${new Date().toISOString().slice(0,10)}.json`;
        anchor.click();
      } finally { setTimeout(() => URL.revokeObjectURL(url), 0); }
      setMessage('Le téléchargement de la sauvegarde a été déclenché. Conserve ce fichier dans un endroit sûr.');
    } catch (error) { setError(error.message || 'Impossible de sauvegarder les factures locales.'); }
  }
  async function selectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const scope = lifetime.current, sequence = ++scope.sequence;
    const current = () => scope.active && scope.sequence === sequence;
    setPreview(null); setError(''); setMessage(''); setReading(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Fichier trop volumineux : 5 Mio maximum.');
      const text = await file.text();
      if (!current()) return;
      const incoming = parseBackup(text);
      const result = previewRestore(incoming, readCurrentInvoices(read));
      if (current()) setPreview(result);
    } catch (error) { if (current()) setError(error.message || 'Impossible de lire cette sauvegarde.'); }
    finally { if (current()) { setReading(false); if (input.current) input.current.value = ''; } }
  }
  function confirm() {
    if (!lifetime.current?.active || !preview || reading) return;
    setError(''); setMessage('');
    try {
      const result = confirmRestore(preview, read, value => localStorage.setItem(LOCAL_INVOICE_KEY, value));
      if (result.kind === 'changed') {
        setPreview(result.preview);
        setMessage('Les factures locales ont changé depuis l’aperçu. Vérifie le nouvel aperçu et confirme à nouveau.');
      } else if (result.kind === 'written') {
        onRestored(result.invoices);
        setPreview(null); setOpen(false);
        setMessage(`${result.count} facture(s) restaurée(s) sur cet appareil uniquement. Aucune facture n’a été créée dans un compte.`);
      }
    } catch (error) { setError(error.message || 'La restauration a échoué.'); }
  }
  return <section aria-label="Sauvegarde des factures locales" style={{ marginTop: 16 }}>
    <p>Le fichier contient les informations des clients. Conserve-le dans un endroit sûr. La sauvegarde et la restauration restent sur cet appareil, sans import dans un compte.</p>
    <div className="miniActions" style={{ flexWrap: 'wrap' }}>
      <button type="button" className="btn btnActionSecondary" onClick={exportInvoices}>Sauvegarder les factures de cet appareil</button>
      <button type="button" className="btn btnActionSecondary" onClick={() => { setOpen(true); setMessage(''); setError(''); }}>Restaurer une sauvegarde</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {open && <div role="region" aria-label="Restauration locale" style={{ marginTop: 12, padding: 16, border: '1px solid #64748b', borderRadius: 8 }}>
      <p>JSON Microassist version 1, au plus 5 Mio et 1 000 factures. Aucun remplacement : les conflits sont conservés sur cet appareil. Les anciennes entrées sans identifiant ne seront pas ajoutées.</p>
      <label className="field">Fichier de sauvegarde JSON<input ref={input} type="file" accept=".json,application/json" onChange={selectFile} disabled={reading} /></label>
      {reading && <p role="status">Lecture de la sauvegarde… Aucune écriture n’est effectuée.</p>}
      {preview && <div aria-label="Aperçu de la restauration">
        <h3>Aperçu de la restauration</h3>
        <p>{preview.counts.additions} ajout(s) possible(s) · {preview.counts.duplicates} doublon(s) ignoré(s) · {preview.counts.conflicts} conflit(s) · {preview.counts.refused} entrée(s) refusée(s)</p>
        <p>Seuls les ajouts possibles seront enregistrés. Les factures existantes restent inchangées.</p>
        {preview.additions.length > 0 && <ul>{preview.additions.slice(0,20).map((invoice,index) => <li key={index}>{String(invoice.invoiceNumber || invoice.invoice_number || invoice.id)} — {String(invoice.buyer?.name || invoice.client_name || 'Client non renseigné')}</li>)}</ul>}
        {preview.issues.length > 0 && <ul>{preview.issues.slice(0,50).map((issue,index)=><li key={index}>{labels[issue.kind]} n° {issue.index} : {issue.reason}</li>)}</ul>}
        {(preview.additions.length>20 || preview.issues.length>50) && <p>Les listes détaillées sont limitées à 20 ajouts et 50 problèmes ; les compteurs couvrent tout le fichier.</p>}
        <button type="button" className="btn btnActionSecondary" onClick={confirm} disabled={!preview.counts.additions || reading}>Confirmer la restauration locale</button>
      </div>}
      <button type="button" className="btn btnGhost" onClick={close}>Annuler la restauration</button>
    </div>}
  </section>;
}
