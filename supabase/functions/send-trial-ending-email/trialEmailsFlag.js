// Pure, runtime-agnostic (Deno + Node) fail-closed flag evaluation
// (LOT 9.2). Only the exact string "true" enables sending -- absent,
// "false", or any other value (case variants, whitespace, empty string,
// non-string input) is treated as disabled. Fail-closed by construction:
// there is no code path in this function that defaults to enabled.
export function isTrialEmailsEnabled(rawValue) {
  return rawValue === "true";
}
