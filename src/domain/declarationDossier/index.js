export { DECLARATION_TYPE } from "./constants.js";
export { buildDossierIdentity, findDossierForPeriod } from "./dossierIdentity.js";
export { resolveDossierStatus } from "./resolveDossierStatus.js";
export { resolveActiveDeclarationPeriod } from "./resolveActiveDeclarationPeriod.js";
export {
  buildDeclarationConfirmation,
  buildPaymentConfirmation,
} from "./buildDeclarationConfirmation.js";
export {
  getCurrentDeclarationView,
  getUpcomingDeclarationView,
  getLastConfirmedDeclaration,
  getDeclarationHistory,
} from "./declarationHistory.js";
