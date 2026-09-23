/**
 * Plugin-level navigation state shared by the TRL workspace view and the
 * left-sidebar navigation view (NAV-1 to NAV-3). The workspace view owns the
 * research state and publishes a small report summary here; the sidebar only
 * reads it and sends requests. No calculations live here.
 */
export type WorkspacePage = "overview" | "data" | "portfolio" | "parameters" | "analysis" | "research" | "advanced" | "help";

export type PageInfo = { id: WorkspacePage; label: string; description: string; icon: string };
export type PageGroup = { label: string; pages: PageInfo[] };

export const PAGE_GROUPS: PageGroup[] = [
  { label: "Home", pages: [{ id: "overview", label: "Overview", description: "Dashboard of the analysed report", icon: "layout-dashboard" }] },
  { label: "Data", pages: [{ id: "data", label: "Data & import", description: "Validate reports and companion files", icon: "file-input" }] },
  { label: "Research", pages: [
    { id: "analysis", label: "Analysis", description: "Verified results, risk and equity", icon: "line-chart" },
    { id: "portfolio", label: "Portfolio", description: "Combine EA backtests on one account", icon: "layers" },
    { id: "parameters", label: "Parameters", description: "Optimisation trade-offs and neighbourhoods", icon: "sliders-horizontal" },
    { id: "advanced", label: "Advanced", description: "Scenarios, simulation and evidence", icon: "flask-conical" },
  ] },
  { label: "Documents", pages: [{ id: "research", label: "Research notes", description: "Strategies, experiments and reports", icon: "notebook-pen" }] },
  { label: "Help", pages: [{ id: "help", label: "Help & downloads", description: "Equity logger, MT5 exports", icon: "life-buoy" }] },
];

export const ALL_PAGES: PageInfo[] = PAGE_GROUPS.flatMap((group) => group.pages);

export function pageInfo(page: WorkspacePage): PageInfo {
  return ALL_PAGES.find((item) => item.id === page) ?? ALL_PAGES[0]!;
}

/** What the sidebar shows about the report the workspace is using. */
export type ReportSummary = {
  name: string;
  market: string;
  analysed: boolean;
  equity: boolean;
  setCheck: "MATCH" | "DIFFERS" | null;
};

export type NavigationSnapshot = { page: WorkspacePage; report: ReportSummary | null; busy: boolean; workspaceOpen: boolean };
export type NavigationAction = "validate" | "analyse";

type Listener = (snapshot: NavigationSnapshot) => void;

export class NavigationStore {
  private snapshot: NavigationSnapshot = { page: "overview", report: null, busy: false, workspaceOpen: false };
  private readonly listeners = new Set<Listener>();
  private actionHandler: ((action: NavigationAction) => void) | null = null;

  get current(): NavigationSnapshot { return this.snapshot; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Merge a change and notify only when something actually changed. */
  update(change: Partial<NavigationSnapshot>): void {
    const next = { ...this.snapshot, ...change };
    if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
    this.snapshot = next;
    for (const listener of [...this.listeners]) listener(this.snapshot);
  }

  setPage(page: WorkspacePage): void { this.update({ page }); }

  /** The workspace registers the handler for sidebar quick actions while it is open. */
  handleActions(handler: (action: NavigationAction) => void): () => void {
    this.actionHandler = handler;
    return () => { if (this.actionHandler === handler) this.actionHandler = null; };
  }

  /** Returns false when no workspace is open to perform the action. */
  request(action: NavigationAction): boolean {
    if (this.actionHandler === null) return false;
    this.actionHandler(action);
    return true;
  }
}
