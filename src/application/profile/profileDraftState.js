export const INITIAL_PROFILE_SAVE_STATE = Object.freeze({
  userId: null,
  revision: 0,
  status: "idle",
  localSaved: false,
});

export function profileSaveReducer(state, action) {
  if (action.type === "session") {
    return { ...INITIAL_PROFILE_SAVE_STATE, userId: action.userId };
  }
  if (action.userId !== state.userId || action.revision < state.revision) return state;
  if (action.type === "edited") {
    return { userId: action.userId, revision: action.revision, status: "edited", localSaved: false, localSettingSaved: state.localSettingSaved };
  }
  if (action.revision !== state.revision) return state;
  if (action.type === "local_setting_saved") {
    return { ...state, localSettingSaved: true, status: state.status === "idle" ? "local_saved" : state.status };
  }
  if (action.type === "local_saved") {
    return {
      ...state,
      localSaved: true,
      status: ["remote_pending", "remote_saved", "remote_failed", "remote_unchanged"].includes(state.status)
        ? state.status
        : "local_saved",
    };
  }
  if (["remote_pending", "remote_saved", "remote_failed", "remote_unchanged", "local_failed"].includes(action.type)) {
    return { ...state, status: action.type };
  }
  return state;
}

export function canUseRemoteProfileForEntry({ strategy, loadStatus, hasUnsavedDraft }) {
  return loadStatus === "found" && !hasUnsavedDraft &&
    strategy !== "keep_local" && strategy !== "detected";
}

export function profileSaveMessage(state, { userId, loadStatus, localOnly }) {
  if (state.userId !== userId || state.status === "idle") return "";
  if (userId && loadStatus !== "found" && loadStatus !== "absent") {
    return state.localSaved
      ? "Brouillon conservé sur cet appareil. Synchronisation suspendue jusqu’au chargement du profil du compte."
      : "Modifications en mémoire. Synchronisation suspendue jusqu’au chargement du profil du compte.";
  }
  switch (state.status) {
    case "edited": return "Brouillon modifié. Pas encore enregistré.";
    case "local_saved": return state.localSettingSaved && !state.localSaved
      ? "Réglage TVA conservé uniquement sur cet appareil."
      : localOnly || !userId
      ? "Brouillon conservé sur cet appareil. Aucune synchronisation avec le compte."
      : "Brouillon conservé sur cet appareil.";
    case "remote_pending": return "Enregistrement du profil dans ton compte en cours…";
    case "remote_saved": return state.localSettingSaved
      ? "Profil enregistré dans ton compte. Le réglage TVA reste conservé uniquement sur cet appareil."
      : "Profil enregistré dans ton compte.";
    case "remote_unchanged": return "Le brouillon correspond déjà au profil du compte. Aucun nouvel enregistrement nécessaire.";
    case "remote_failed": return state.localSaved
      ? "Enregistrement dans le compte impossible. Ton brouillon est conservé sur cet appareil. Réessaie."
      : "Enregistrement dans le compte impossible. Ton brouillon reste en mémoire. Réessaie.";
    case "local_failed": return "Impossible de conserver le brouillon sur cet appareil. Les modifications restent en mémoire.";
    default: return "";
  }
}
