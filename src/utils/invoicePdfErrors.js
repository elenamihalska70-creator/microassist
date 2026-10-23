export class InvoicePdfError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "InvoicePdfError";
    this.code = code;
    Object.assign(this, details);
  }
}

export function invoicePdfErrorMessage(error, { editable = false } = {}) {
  const retained = editable
    ? "Les informations saisies sont conservées."
    : "Le contenu de cette facture conservée n’a pas été modifié.";
  if (error?.code === "unsupported-glyph") {
    const character = `« ${error.character} » (U+${error.character.codePointAt(0).toString(16).toUpperCase()})`;
    return `La police du PDF ne peut pas afficher le caractère ${character} dans le champ « ${error.field} ». ${editable
      ? "Corrige ce champ, puis réessaie."
      : "Cette facture n’est pas modifiable ici ; son PDF ne peut pas être téléchargé avec ce caractère."} ${retained}`;
  }
  if (error?.code === "font-load") {
    return `Les polices du PDF n’ont pas pu être chargées. Vérifie ta connexion, puis réessaie. ${retained}`;
  }
  return `La préparation ou le téléchargement de la facture a échoué. Réessaie. ${retained}`;
}
