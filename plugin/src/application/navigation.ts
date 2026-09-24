/**
 * Plugin-level navigation state shared by the TRL workspace view and the
 * left-sidebar navigation view (NAV-1 to NAV-3). The workspace view owns the
 * research state and publishes a small report summary here; the sidebar only
 * reads it and sends requests. No calculations live here.
 */
export type WorkspacePage = "overview" | "data" | "portfolio" | "parameters" | "analysis" | "research" | "advanced" | "prop" | "help";

export type PageInfo = { id: WorkspacePage; label: string; description: string; icon: string };
export type PageGroup = { label: string; pages: PageInfo[] };

export const PAGE_GROUPS: PageGroup[] = [
  { label: "Home", pages: [{ id: "overview", label: "Overview", description: "Dashboard of the analysed report", icon: "layout-dashboard" }] },
  { label: "Data", pages: [{ id: "data", label: "Data & import", description: "Validate reports and companion files", icon: "file-input" }] },
  { label: "Research", pages: [
    { id: "analysis", label: "Analysis", description: "Verified results, risk and equity", icon: "line-chart" },
    { id: "portfolio", label: "Portfolio", description: "Combine EA backtests on one account", icon: "layers" },
    { id: "parameters", label: "Parameters", description: "Optimisation trade-offs and neighbourhoods", icon: "sliders-horizontal" },
    { id: "prop", label: "Prop-firm check", description: "Check a run against your firm's rules", icon: "shield-check" },
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

/** Ask the Prop-firm check page to select a run: "report:<ref>", "combination:<key>", or null for the current report. */
export type PropRequest = { choice: string | null; seq: number };
export type NavigationSnapshot = { page: WorkspacePage; report: ReportSummary | null; busy: boolean; workspaceOpen: boolean; propRequest?: PropRequest | null };
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

  /** Open the Prop-firm check page on a run (quick actions from the sidebar and saved combinations). */
  requestPropCheck(choice: string | null): void {
    this.update({ page: "prop", propRequest: { choice, seq: (this.snapshot.propRequest?.seq ?? 0) + 1 } });
  }

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
