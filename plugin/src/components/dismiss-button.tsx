import React from "react";

/** Small "×" that removes a message the user has read (errors and findings never linger). */
export function DismissButton({ onDismiss, label = "Dismiss message" }: { onDismiss: () => void; label?: string }): React.ReactElement {
  return <button type="button" className="trl-dismiss" aria-label={label} title={label} onClick={onDismiss}>×</button>;
}
