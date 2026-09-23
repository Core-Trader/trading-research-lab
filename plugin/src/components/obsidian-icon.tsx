import { getIconIds, setIcon } from "obsidian";
import React, { useEffect, useRef } from "react";

let known: Set<string> | null = null;

/** Obsidian's built-in Lucide icon (D2). Renders nothing if this Obsidian lacks the id. */
export function ObsidianIcon({ id, className }: { id: string; className?: string }): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.replaceChildren();
    known ??= new Set(getIconIds());
    if (known.has(id) || known.has(`lucide-${id}`)) setIcon(element, id);
  }, [id]);
  return <span ref={ref} className={`trl-icon${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}
