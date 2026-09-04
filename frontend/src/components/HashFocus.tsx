import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const FOCUSABLE =
  "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]";

export function HashFocus() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const targetId = decodeURIComponent(hash.slice(1));
    let retryTimer: number | undefined;
    let highlightTimer: number | undefined;

    const revealTarget = () => {
      const target = document.getElementById(targetId);
      if (!target) return false;

      let ancestor: HTMLElement | null = target;
      while (ancestor) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }

      target.classList.add("repair-target");
      const reduceMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      target.scrollIntoView?.({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
      const control = target.matches(FOCUSABLE)
        ? target
        : target.querySelector<HTMLElement>(FOCUSABLE);
      control?.focus({ preventScroll: true });
      highlightTimer = window.setTimeout(
        () => target.classList.remove("repair-target"),
        5000,
      );
      return true;
    };

    if (!revealTarget()) {
      retryTimer = window.setTimeout(revealTarget, 150);
    }

    return () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (highlightTimer !== undefined) window.clearTimeout(highlightTimer);
      document.getElementById(targetId)?.classList.remove("repair-target");
    };
  }, [pathname, hash]);

  return null;
}
