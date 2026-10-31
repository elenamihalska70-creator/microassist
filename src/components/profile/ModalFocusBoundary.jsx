import { useLayoutEffect, useRef } from "react";

// One owner for isolation, keyboard trapping and deferred restoration, including nested dialogs.
const boundaries = [];
const isolated = new Map();
let generation = 0;
const available = (element) => element?.isConnected && !element.disabled &&
  !element.closest('[inert], [hidden]') && element.getClientRects().length > 0 &&
  getComputedStyle(element).visibility !== "hidden";

export default function ModalFocusBoundary({ children, onEscape, returnFocusRef, canRestoreFocus }) {
  const rootRef = useRef(null);
  const optionsRef = useRef({ onEscape, canRestoreFocus });
  useLayoutEffect(() => { optionsRef.current = { onEscape, canRestoreFocus }; });
  useLayoutEffect(() => {
    const root = rootRef.current;
    const dialog = root.querySelector('[role="dialog"]');
    if (!dialog) return undefined;
    const owner = returnFocusRef?.current;
    const previousFocus = owner?.trigger || document.activeElement;
    const parentBoundary = boundaries.findLast((candidate) => candidate.root.contains(root));
    const boundary = { root, dialog };
    boundaries.push(boundary);
    generation += 1;
    const hidden = [];
    let branch = root;
    while (branch && branch !== document.body) {
      for (const sibling of branch.parentElement?.children || []) {
        if (sibling !== branch) {
          let record = isolated.get(sibling);
          if (!record) { record = { inert: sibling.inert, owners: new Set() }; isolated.set(sibling, record); }
          record.owners.add(boundary);
          hidden.push(sibling);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    const active = () => boundaries.at(-1) === boundary;
    const focusable = () => Array.from(dialog.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]',
    )).filter((el) => el.tabIndex >= 0 && available(el));
    const focusFirst = () => (focusable()[0] || dialog).focus({ preventScroll: true });
    const originalTabIndex = dialog.getAttribute("tabindex");
    dialog.setAttribute("tabindex", "-1");
    focusFirst();
    const keydown = (event) => {
      if (!active()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        optionsRef.current.onEscape?.();
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0] || dialog, last = items.at(-1) || dialog;
        if (!items.length || !dialog.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    const focusin = (event) => { if (active() && !dialog.contains(event.target)) focusFirst(); };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin);
      const wasActive = active();
      boundaries.splice(boundaries.indexOf(boundary), 1);
      for (const element of hidden) {
        const record = isolated.get(element);
        record.owners.delete(boundary);
        if (!record.owners.size) { element.inert = record.inert; isolated.delete(element); }
      }
      if (originalTabIndex === null) dialog.removeAttribute("tabindex");
      else dialog.setAttribute("tabindex", originalTabIndex);
      const closingGeneration = ++generation;
      // Wait for hidden mobile triggers to reappear and all owner/scope effects to commit.
      requestAnimationFrame(() => {
        if (!wasActive || generation !== closingGeneration ||
          (parentBoundary && !boundaries.includes(parentBoundary)) ||
          optionsRef.current.canRestoreFocus?.(owner) === false) return;
        const parent = boundaries.at(-1)?.dialog;
        const candidates = [previousFocus,
          ...(owner?.fallbackSelector ? document.querySelectorAll(owner.fallbackSelector) : []),
          ...document.querySelectorAll(
          '.topbar button',
        )];
        const target = candidates.find((element) => available(element) && (!parent || parent.contains(element)));
        target?.focus({ preventScroll: true });
      });
    };
  }, [returnFocusRef]);
  return <div ref={rootRef} style={{ display: "contents" }}>{children}</div>;
}
