export function selectProfileModal({ authOpen, recovery, authLoading, hydrated, userId,
  loadStatus, conflictOpen, conflictCurrent, conflictPending, strategy, beta,
  structured, onboarding, completion, completionCurrent }) {
  if (authOpen || recovery) return "auth";
  if (authLoading || !hydrated) return null;
  if (conflictOpen && conflictCurrent && (!userId || loadStatus === "found")) return "conflict";
  if (beta) return "beta";
  if (userId && !["found", "absent"].includes(loadStatus)) return null;
  if (userId && (conflictPending || strategy === "detected")) return null;
  if (structured) return "structured";
  if (onboarding) return "onboarding";
  if (completion && completionCurrent) return "completion";
  return null;
}

export function canApplyProfileConflictChoice({ owner, currentSession, userId,
  remoteUserId, loadUserId, loadStatus }) {
  return Boolean(userId && owner === currentSession && owner?.userId === userId &&
    remoteUserId === userId && loadUserId === userId && loadStatus === "found");
}

export function authProfileResolutionMessage({ loadStatus, conflictPending, strategy }) {
  if (loadStatus === "loading") return "Connexion réussie. Chargement du profil fiscal en cours.";
  if (loadStatus === "failed") return "Connexion réussie. Le profil fiscal n’a pas pu être chargé. Réessaie son chargement.";
  if (conflictPending && strategy === "keep_local") return "Connexion réussie. Le brouillon local est conservé sans synchronisation avec le compte.";
  if (conflictPending) return "Connexion réussie. Un choix de profil est nécessaire avant toute synchronisation.";
  if (loadStatus === "absent") return "Connexion réussie. Aucun profil fiscal n’est encore enregistré dans ce compte.";
  if (loadStatus === "found") return "Connexion réussie. Le profil fiscal du compte a été chargé.";
  return "Connexion réussie. Chargement du profil fiscal en cours.";
}
