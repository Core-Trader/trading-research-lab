import React, { type ReactNode } from "react";

export type CardState =
  | { kind: "ready" }
  | { kind: "loading"; message?: string }
  | { kind: "error"; message: string }
  | { kind: "empty"; message: string };

export type CardAction = { label: string; onClick: () => void; disabled?: boolean };

/**
 * One wrapper so every dashboard card shows loading, error, and empty states
 * the same way. Content renders only in the ready state.
 */
export function DashboardCard({ title, state, action, className, children }: {
  title: string;
  state: CardState;
  action?: CardAction;
  className?: string;
  children?: ReactNode;
}): React.ReactElement {
  return <section className={`trl-dashboard__card trl-card--${state.kind}${className ? ` ${className}` : ""}`} aria-busy={state.kind === "loading"}>
    <h4>{title}</h4>
    {state.kind === "ready" && children}
    {state.kind === "loading" && <div className="trl-card__skeleton" role="status" aria-label={state.message ?? "Loading"}><span /><span /><span /></div>}
    {state.kind === "error" && <p className="trl-m0__inline-error" role="alert">{state.message}</p>}
    {state.kind === "empty" && <p className="trl-m0__note">{state.message}</p>}
    {state.kind !== "ready" && state.kind !== "loading" && action && <button type="button" disabled={action.disabled} onClick={action.onClick}>{action.label}</button>}
  </section>;
}
