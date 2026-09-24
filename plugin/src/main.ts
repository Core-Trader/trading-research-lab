import { Plugin, PluginSettingTab, Setting, TFile, type App, type WorkspaceLeaf } from "obsidian";
import { ResearchView, RESEARCH_VIEW_TYPE, writeGeneratedNote } from "./research-view";
import { NavigationView, NAVIGATION_VIEW_TYPE } from "./navigation-view";
import { ALL_PAGES, NavigationStore, type WorkspacePage } from "./application/navigation";
import { WorkerClient } from "./worker-client";
import { ResearchNotesIndex } from "./vault/research-index";
import type { MarkdownResult } from "./types";
import { LayoutStore } from "./layout/layout-store";
import { CONFIDENCE_OPTIONS, parseMinTrades, ThresholdStore } from "./application/research-settings";
import { readLastReport, sameLastReport, type LastReport } from "./application/last-report";

/** `layouts` holds customised page layouts (LAYOUT-1); it is read defensively. */
type TradingResearchSettings = { pythonExecutable: string; showDeveloperDiagnostics: boolean; layouts?: unknown; lastReport?: unknown; thresholds?: unknown };
const DEFAULT_SETTINGS: TradingResearchSettings = { pythonExecutable: "", showDeveloperDiagnostics: false };

export default class TradingResearchLabPlugin extends Plugin {
  settings: TradingResearchSettings = DEFAULT_SETTINGS;
  worker!: WorkerClient;
  /** Shared by the workspace view and the left-sidebar navigation. */
  readonly navigation = new NavigationStore();
  /** TRL research notes (trl_type frontmatter only), shared by the workspace and the sidebar. */
  notesIndex!: ResearchNotesIndex;
  /** Customised page layouts, saved with the plugin settings. */
  layouts!: LayoutStore;
  /** Your own research thresholds (minimum trades, confidence level). */
  thresholds!: ThresholdStore;
  private lastOpenedMarkdownPath: string | null = null;

  /** The report the workspace reopens with (SESSION-1); references only. */
  get lastReport(): LastReport | null { return readLastReport(this.settings.lastReport); }

  async saveLastReport(value: LastReport | null): Promise<void> {
    if (sameLastReport(this.lastReport, value)) return;
    this.settings.lastReport = value ?? undefined;
    await this.saveData(this.settings);
  }

  async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData() as Partial<TradingResearchSettings> ?? {}) };
    this.worker = new WorkerClient(this.settings.pythonExecutable, this.workerWorkspacePath());
    this.thresholds = new ThresholdStore(this.settings.thresholds, async (thresholds) => { this.settings.thresholds = thresholds; await this.saveData(this.settings); });
    this.layouts = new LayoutStore(this.settings.layouts, async (layouts) => { this.settings.layouts = layouts; await this.saveData(this.settings); });
    this.rememberMarkdownFile(this.app.workspace.getActiveFile());
    this.registerEvent(this.app.workspace.on("file-open", (file) => this.rememberMarkdownFile(file)));
    this.notesIndex = new ResearchNotesIndex(this.app);
    this.app.workspace.onLayoutReady(() => this.notesIndex.refresh());
    this.registerEvent(this.app.metadataCache.on("changed", () => this.notesIndex.schedule()));
    this.registerEvent(this.app.metadataCache.on("resolved", () => this.notesIndex.schedule()));
    this.registerEvent(this.app.vault.on("delete", (file) => { if (this.notesIndex.isMarkdown(file)) this.notesIndex.schedule(); }));
    this.registerEvent(this.app.vault.on("rename", (file) => { if (this.notesIndex.isMarkdown(file)) this.notesIndex.schedule(); }));
    this.registerView(RESEARCH_VIEW_TYPE, (leaf) => new ResearchView(leaf, this));
    this.registerView(NAVIGATION_VIEW_TYPE, (leaf) => new NavigationView(leaf, this));
    this.addRibbonIcon("line-chart", "Open Trading Research Lab", () => { void this.activateResearchView().then(() => this.openNavigation(true)); });
    this.addCommand({ id: "open-research-view", name: "Open research view", callback: () => void this.activateResearchView() });
    this.addCommand({ id: "open-navigation", name: "Open navigation sidebar", callback: () => void this.openNavigation(true) });
    for (const page of ALL_PAGES) {
      this.addCommand({ id: `open-page-${page.id}`, name: `Open ${page.label}`, callback: () => void this.openPage(page.id) });
    }
    this.addSettingTab(new TradingResearchSettingsTab(this.app, this));
  }

  async onunload(): Promise<void> { await this.worker.stop(); }

  async activateResearchView(): Promise<void> {
    // TRL is a research workspace, not a utility sidebar. Always open its
    // dashboard in a central tab; the active leaf can itself be a sidebar.
    const existing = this.app.workspace.getLeavesOfType(RESEARCH_VIEW_TYPE)[0];
    const mainLeaves: WorkspaceLeaf[] = [];
    this.app.workspace.iterateRootLeaves((candidate) => mainLeaves.push(candidate));
    if (existing !== undefined && mainLeaves.includes(existing)) {
      await this.app.workspace.revealLeaf(existing);
      return;
    }

    const mainLeaf = this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit);
    // `getLeaf("tab")` follows the active group. Make a root editor leaf
    // active first so an invocation from the right dock cannot create a dock tab.
    if (mainLeaf !== null) this.app.workspace.setActiveLeaf(mainLeaf, { focus: false });
    const leaf = this.app.workspace.getLeaf("tab");
    if (existing !== undefined && existing !== leaf) existing.detach();
    await leaf.setViewState({ type: RESEARCH_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  /** Switches the workspace to a page, opening the workspace if needed. */
  async openPage(page: WorkspacePage): Promise<void> {
    this.navigation.setPage(page);
    await this.activateResearchView();
  }

  /** The TRL navigation lives in Obsidian's left sidebar (NAV-1). */
  async openNavigation(reveal: boolean): Promise<void> {
    const leaf = await this.app.workspace.ensureSideLeaf(NAVIGATION_VIEW_TYPE, "left", { active: reveal, reveal });
    if (reveal) await this.app.workspace.revealLeaf(leaf);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await this.worker.stop();
    this.worker = new WorkerClient(this.settings.pythonExecutable, this.workerWorkspacePath());
  }

  async writeGeneratedMarkdown(sourcePath: string, rendered: MarkdownResult): Promise<string> {
    return writeGeneratedNote(this, sourcePath, rendered);
  }

  selectedMarkdownFile(): TFile | null {
    const active = this.app.workspace.getActiveFile();
    if (active instanceof TFile && active.extension.toLowerCase() === "md") {
      this.lastOpenedMarkdownPath = active.path;
      return active;
    }
    if (this.lastOpenedMarkdownPath === null) return null;
    const remembered = this.app.vault.getAbstractFileByPath(this.lastOpenedMarkdownPath);
    return remembered instanceof TFile && remembered.extension.toLowerCase() === "md" ? remembered : null;
  }

  private rememberMarkdownFile(file: TFile | null): void {
    if (file instanceof TFile && file.extension.toLowerCase() === "md") this.lastOpenedMarkdownPath = file.path;
  }

  private workerWorkspacePath(): string {
    const adapter = this.app.vault.adapter as unknown as { getBasePath(): string };
    // A forward slash also works on Windows; a backslash is a filename character on macOS and Linux.
    return `${adapter.getBasePath()}/.trl-data`;
  }
}

class TradingResearchSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: TradingResearchLabPlugin) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Trading Research Lab" });
    new Setting(containerEl)
      .setName("Python 3.14 virtual-environment executable")
      .setDesc("Absolute path to the Python executable where trading-research-core is installed. This desktop-only plugin never downloads or starts a network service.")
      .addText((text) => text.setPlaceholder("C:\\path\\to\\.venv\\Scripts\\python.exe").setValue(this.plugin.settings.pythonExecutable).onChange(async (value) => {
        this.plugin.settings.pythonExecutable = value.trim();
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("Show developer diagnostics")
      .setDesc("Shows local timing details (worker start, import, analysis) on the Data page. Off by default; nothing is sent anywhere.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.showDeveloperDiagnostics).onChange(async (value) => {
        this.plugin.settings.showDeveloperDiagnostics = value;
        await this.plugin.saveData(this.plugin.settings);
      }));
    containerEl.createEl("h3", { text: "Your research thresholds" });
    new Setting(containerEl)
      .setName("Minimum trades")
      .setDesc("TRL warns wherever a result rests on fewer closed trades than this. No published number applies, so it is yours to choose; empty turns the warning off.")
      .addText((text) => text.setPlaceholder("none").setValue(this.plugin.thresholds.snapshot.minTrades === null ? "" : String(this.plugin.thresholds.snapshot.minTrades)).onChange((value) => {
        const parsed = parseMinTrades(value);
        if (parsed !== undefined) this.plugin.thresholds.set({ minTrades: parsed });
      }));
    new Setting(containerEl)
      .setName("Confidence level")
      .setDesc("Used by the significance check on Analysis. 95 % is preselected as a common convention, not a rule.")
      .addDropdown((dropdown) => {
        for (const option of CONFIDENCE_OPTIONS) dropdown.addOption(option, `${Math.round(Number(option) * 100)} %`);
        dropdown.setValue(this.plugin.thresholds.snapshot.confidence).onChange((value) => this.plugin.thresholds.set({ confidence: value as (typeof CONFIDENCE_OPTIONS)[number] }));
      });
  }
}
