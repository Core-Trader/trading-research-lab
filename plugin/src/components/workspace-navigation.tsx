import React from "react";

export type WorkspacePage = "overview" | "data" | "portfolio" | "analysis" | "research" | "advanced";

const pages: Array<{ id: WorkspacePage; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Research home" },
  { id: "data", label: "Data & import", description: "MT5 reports and source evidence" },
  { id: "portfolio", label: "Portfolio", description: "Combine EA backtests on one account" },
  { id: "analysis", label: "Analysis", description: "Verified results and risk" },
  { id: "research", label: "Research", description: "Strategies, experiments and reports" },
  { id: "advanced", label: "Advanced", description: "Scenarios, simulation and optimisation" },
];

export function WorkspaceNavigation({ activePage, onChange }: { activePage: WorkspacePage; onChange: (page: WorkspacePage) => void }): React.ReactElement {
  return <nav className="trl-workspace-nav" aria-label="Trading Research Lab sections">
    {pages.map((page) => <button key={page.id} type="button" className={activePage === page.id ? "is-active" : ""} aria-current={activePage === page.id ? "page" : undefined} onClick={() => onChange(page.id)}>
      <span>{page.label}</span><small>{page.description}</small>
    </button>)}
  </nav>;
}
