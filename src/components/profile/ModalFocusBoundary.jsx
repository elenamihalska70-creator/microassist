import { useEffect, useRef } from "react";

// Preserve the existing overlay/scrolling styles while isolating the active dialog.
export default function ModalFocusBoundary({ children, onEscape }) {
  const rootRef = useRef(null);
  const escapeRef = useRef(onEscape);
  useEffect(() => { escapeRef.current = onEscape; }, [onEscape]);
  useEffect(() => {
    const root = rootRef.current;
    const dialog = root.querySelector('[role="dialog"]');
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const hidden = [];
    let branch = root;
    while (branch && branch !== document.body) {
      for (const sibling of branch.parentElement?.children || []) {
        if (sibling !== branch) {
          hidden.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    const focusable = () => Array.from(dialog.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]',
    )).filter((el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const focusFirst = () => (focusable()[0] || dialog).focus({ preventScroll: true });
    dialog.setAttribute("tabindex", "-1");
    focusFirst();
    const keydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        escapeRef.current?.();
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0] || dialog, last = items.at(-1) || dialog;
        if (!items.length || (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    const focusin = (event) => { if (!dialog.contains(event.target)) focusFirst(); };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin);
      for (const [element, inert] of hidden) element.inert = inert;
      const returnTarget = previousFocus?.isConnected && !previousFocus.closest("[inert]")
        ? previousFocus : document.querySelector(".topbar button");
      returnTarget?.focus({ preventScroll: true });
    };
  }, []);
  return <div ref={rootRef} style={{ display: "contents" }}>{children}</div>;
}
