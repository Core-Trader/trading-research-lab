import { ItemView, type WorkspaceLeaf } from "obsidian";
import React, { useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PAGE_GROUPS, type WorkspacePage } from "./application/navigation";
import type TradingResearchLabPlugin from "./main";
import { ObsidianIcon } from "./components/obsidian-icon";

export const NAVIGATION_VIEW_TYPE = "trading-research-lab-navigation";

/** TRL navigation in Obsidian's left sidebar (NAV-1, NAV-3). */
export class NavigationView extends ItemView {
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TradingResearchLabPlugin) { super(leaf); }

  getViewType(): string { return NAVIGATION_VIEW_TYPE; }
  getDisplayText(): string { return "Trading Research Lab"; }
  getIcon(): string { return "line-chart"; }

  async onOpen(): Promise<void> {
    this.root = createRoot(this.contentEl);
    this.root.render(<NavigationSidebar plugin={this.plugin} />);
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}

function NavigationSidebar({ plugin }: { plugin: TradingResearchLabPlugin }): React.ReactElement {
  const navigation = plugin.navigation;
  const snapshot = useSyncExternalStore((listener) => navigation.subscribe(listener), () => navigation.current);
  const report = snapshot.report;
  const open = (page: WorkspacePage): void => { void plugin.openPage(page); };
  const act = (action: "validate" | "analyse"): void => {
    void plugin.openPage("data").then(() => { navigation.request(action); });
  };

  return <nav className="trl-sidenav" aria-label="Trading Research Lab">
    <header className="trl-sidenav__brand"><strong>Trading Research Lab</strong><span>Local research workspace</span></header>

    <section className="trl-sidenav__report" aria-label="Current report">
      {report ? <>
        <strong title={report.name}><ObsidianIcon id="file-check" />{report.name}</strong>
        <span className="trl-sidenav__market">{report.market}</span>
        <ul className="trl-sidenav__badges">
          <li className={report.analysed ? "is-ok" : "is-pending"}>{report.analysed ? "Analysed" : "Not analysed yet"}</li>
          <li className={report.equity ? "is-ok" : "is-none"}>{report.equity ? "Equity log ✓" : "No equity log"}</li>
          <li className={report.setCheck === "MATCH" ? "is-ok" : report.setCheck === "DIFFERS" ? "is-warn" : "is-none"}>{report.setCheck === "MATCH" ? ".set matches ✓" : report.setCheck === "DIFFERS" ? ".set differs" : "No .set check"}</li>
        </ul>
        <div className="trl-sidenav__actions">
          {!report.analysed && <button type="button" className="mod-cta" disabled={snapshot.busy} onClick={() => act("analyse")}>Start analysis</button>}
          <button type="button" disabled={snapshot.busy} onClick={() => { void plugin.openPage("prop").then(() => navigation.requestPropCheck(null)); }}>Check prop-firm rules…</button>
          <button type="button" disabled={snapshot.busy} onClick={() => act("validate")}>Validate another report…</button>
        </div>
      </> : <>
        <span className="trl-sidenav__empty">No report selected yet.</span>
        <div className="trl-sidenav__actions"><button type="button" className="mod-cta" onClick={() => act("validate")}>Browse and validate report…</button></div>
      </>}
      {snapshot.busy && <span className="trl-sidenav__busy" role="status">Working…</span>}
    </section>

    {PAGE_GROUPS.map((group) => <section key={group.label} className="trl-sidenav__group">
      <h6>{group.label}</h6>
      <ul>{group.pages.map((page) => <li key={page.id}>
        <button type="button" className={snapshot.workspaceOpen && snapshot.page === page.id ? "is-active" : undefined} aria-current={snapshot.workspaceOpen && snapshot.page === page.id ? "page" : undefined} title={page.description} onClick={() => open(page.id)}><ObsidianIcon id={page.icon} />{page.label}</button>
      </li>)}</ul>
    </section>)}
  </nav>;
}
