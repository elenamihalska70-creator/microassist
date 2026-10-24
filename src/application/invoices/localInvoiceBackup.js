export const LOCAL_INVOICE_KEY = 'guest_invoices';
export const BACKUP_FORMAT = 'microassist.local-invoices';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_INVOICES = 1000;
const bytes = value => new TextEncoder().encode(value).length;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unsafe = /^(?:__proto__|prototype|constructor)$|token|session|password|secret|credential|authorization|api.?key|jwt/i;
const amounts = new Set(['amount','quantity','unitPrice','unit_price','vatRate','vat_rate','totalHT','totalTVA','totalTTC','total_ht','total_tva','total_ttc']);
const textFields = new Set(['invoiceNumber','invoice_number','number','client_name','client_address','client_email','description','name','address','email','siret','vatNumber','vatMode','vat_mode','vatExemptionReason','vat_exemption_reason','paymentTerms','formatStatus','format_status','transmissionStatus','transmission_status','source']);
const booleanFields = new Set(['localOnly','local_only','is_compliant','isCompliant']);
const dateFields = new Set(['issueDate','invoice_date','dueDate','due_date']);
const timestampFields = new Set(['paid_at','paidAt','created_at','createdAt','updated_at','updatedAt']);
export class InvoiceBackupError extends Error {}
const fail = message => { throw new InvoiceBackupError(message); };

function safeJson(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 5000 || depth > 8) fail('Structure trop complexe.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { if (value.length > 20000) fail('Texte trop long (20 000 caractères maximum).'); return; }
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('Nombre invalide.'); return; }
  if (Array.isArray(value)) { if (value.length > 1000) fail('Liste interne trop longue.'); value.forEach(item => safeJson(item, depth + 1, budget)); return; }
  if (!object(value)) fail('Valeur JSON incompatible.');
  for (const [key, item] of Object.entries(value)) {
    if (key.length > 128 || unsafe.test(key)) fail('Clé dangereuse ou donnée de session interdite.');
    safeJson(item, depth + 1, budget);
  }
}
function fields(value) {
  for (const [key, item] of Object.entries(value)) {
    if (item === null) continue;
    if (amounts.has(key) && (typeof item !== 'number' || !Number.isFinite(item) || item < 0 || item > Number.MAX_SAFE_INTEGER)) fail(`Montant ou quantité invalide : ${key}.`);
    if (textFields.has(key) && typeof item !== 'string') fail(`Texte invalide : ${key}.`);
    if (booleanFields.has(key) && typeof item !== 'boolean') fail(`Indicateur invalide : ${key}.`);
    if (dateFields.has(key) && (typeof item !== 'string' || (item !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(item) || !Number.isFinite(Date.parse(item)) || new Date(item).toISOString().slice(0,10) !== item)))) fail(`Date invalide : ${key}.`);
    if (timestampFields.has(key) && (typeof item !== 'string' || (item !== '' && !Number.isFinite(Date.parse(item))))) fail(`Horodatage invalide : ${key}.`);
  }
}
export function validateInvoice(invoice) {
  if (!object(invoice)) fail('La facture doit être un objet JSON.');
  safeJson(invoice);
  fields(invoice);
  if (invoice.status != null && !['draft','unpaid','paid'].includes(invoice.status)) fail('Statut de paiement non pris en charge.');
  for (const key of ['seller','buyer','client','totals']) {
    if (invoice[key] != null) { if (!object(invoice[key])) fail(`Objet invalide : ${key}.`); fields(invoice[key]); }
  }
  if (invoice.lines != null) {
    if (!Array.isArray(invoice.lines) || invoice.lines.length > 100) fail('Lignes de facture invalides (100 maximum).');
    invoice.lines.forEach(line => { if (!object(line)) fail('Ligne de facture invalide.'); fields(line); });
  }
  if (invoice.statuses != null && (!Array.isArray(invoice.statuses) || invoice.statuses.some(s => typeof s !== 'string'))) fail('Liste de statuts invalide.');
}
export function invoiceIdentity(invoice) {
  const id = invoice.id;
  if (typeof id === 'string' && id.length <= 256 && id.trim() === id && id !== '' && !Array.from(id).some(char => char.codePointAt(0) < 32 || char.codePointAt(0) === 127)) return id;
  if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) return String(id);
  return null;
}
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function readCurrentInvoices(read) {
  let raw;
  try { raw = read(); } catch { fail('Le stockage des factures de cet appareil est inaccessible. Aucune donnée n’a été modifiée.'); }
  if (raw === null) return { raw, invoices: [] };
  try {
    if (typeof raw !== 'string' || bytes(raw) > MAX_BACKUP_BYTES) throw Error();
    const invoices = JSON.parse(raw);
    if (!Array.isArray(invoices) || invoices.length > MAX_INVOICES) throw Error();
    invoices.forEach(validateInvoice);
    return { raw, invoices };
  } catch { fail('Le stockage actuel des factures est invalide ou dépasse les limites. Il ne sera pas écrasé.'); }
}
export function createBackup(read, exportedAt = new Date().toISOString()) {
  const { invoices } = readCurrentInvoices(read);
  if (!invoices.length) fail('Aucune facture locale à sauvegarder sur cet appareil.');
  const json = JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, invoices }, null, 2);
  if (bytes(json) > MAX_BACKUP_BYTES) fail('La sauvegarde dépasse la limite de 5 Mio.');
  return json;
}
export function parseBackup(text) {
  if (typeof text !== 'string' || bytes(text) > MAX_BACKUP_BYTES) fail('Fichier trop volumineux : 5 Mio maximum.');
  let data;
  try { data = JSON.parse(text); } catch { fail('Le fichier ne contient pas un JSON valide.'); }
  if (!object(data) || data.format !== BACKUP_FORMAT || data.version !== BACKUP_VERSION) fail('Format ou version de sauvegarde non pris en charge.');
  if (Object.keys(data).some(key => !['format','version','exportedAt','invoices'].includes(key))) fail('La sauvegarde contient des champs non pris en charge.');
  if (typeof data.exportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(data.exportedAt) || !Number.isFinite(Date.parse(data.exportedAt)) || new Date(data.exportedAt).toISOString().slice(0,10) !== data.exportedAt.slice(0,10)) fail('Date d’export invalide.');
  if (!Array.isArray(data.invoices) || data.invoices.length > MAX_INVOICES) fail('La sauvegarde doit contenir au plus 1 000 factures.');
  return data.invoices;
}
export function previewRestore(incoming, current) {
  const additions = [], issues = [], counts = { additions: 0, duplicates: 0, conflicts: 0, refused: 0 };
  const groups = new Map(), existing = new Map(), refusedIds = new Set();
  for (const invoice of current.invoices) {
    const id = invoiceIdentity(invoice);
    if (id !== null) { if (!existing.has(id)) existing.set(id, []); existing.get(id).push(canonical(invoice)); }
  }
  incoming.forEach((invoice, index) => {
    try {
      validateInvoice(invoice);
      if (invoice.user_id != null || invoice.userId != null) fail('Une attribution de compte est présente ; cette entrée ne peut pas être restaurée localement.');
      const id = invoiceIdentity(invoice);
      if (id === null) fail('Identifiant absent ou inexploitable : aucune identité ne sera inventée.');
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push({ invoice, index, content: canonical(invoice) });
    } catch (error) {
      if (object(invoice) && invoiceIdentity(invoice) !== null) refusedIds.add(invoiceIdentity(invoice));
      counts.refused++; issues.push({ index: index + 1, kind: 'refused', reason: error.message });
    }
  });
  for (const [id, group] of groups) {
    const different = group.some(entry => entry.content !== group[0].content);
    const present = existing.get(id);
    if (different || refusedIds.has(id) || (present && present.some(content => content !== group[0].content))) {
      counts.conflicts += group.length;
      group.forEach(entry => issues.push({ index: entry.index + 1, kind: 'conflict', reason: `Identifiant ${id} : contenus différents ; aucune entrée de ce groupe ne sera ajoutée.` }));
    } else if (present) counts.duplicates += group.length;
    else { additions.push(group[0].invoice); counts.additions++; counts.duplicates += group.length - 1; }
  }
  if (current.invoices.length + additions.length > MAX_INVOICES) fail('La restauration dépasserait la limite de 1 000 factures sur cet appareil.');
  const serialized = JSON.stringify([...current.invoices, ...additions]);
  if (bytes(serialized) > MAX_BACKUP_BYTES) fail('Le stockage après restauration dépasserait 5 Mio.');
  return { incoming, raw: current.raw, current: current.invoices, additions, counts, issues, serialized };
}
export function confirmRestore(preview, read, write) {
  const current = readCurrentInvoices(read);
  if (current.raw !== preview.raw) return { kind: 'changed', preview: previewRestore(preview.incoming, current) };
  if (!preview.additions.length) return { kind: 'nothing' };
  try { write(preview.serialized); } catch { fail('La sauvegarde n’a pas pu être restaurée (quota ou stockage indisponible). Les factures précédentes sont conservées.'); }
  return { kind: 'written', invoices: [...current.invoices, ...preview.additions], count: preview.additions.length };
}
