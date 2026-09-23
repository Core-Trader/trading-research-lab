import { Plugin, PluginSettingTab, Setting, TFile, type App, type WorkspaceLeaf } from "obsidian";
import { ResearchView, RESEARCH_VIEW_TYPE, writeGeneratedNote } from "./research-view";
import { NavigationView, NAVIGATION_VIEW_TYPE } from "./navigation-view";
import { ALL_PAGES, NavigationStore, type WorkspacePage } from "./application/navigation";
import { WorkerClient } from "./worker-client";
import type { MarkdownResult } from "./types";

type TradingResearchSettings = { pythonExecutable: string };
const DEFAULT_SETTINGS: TradingResearchSettings = { pythonExecutable: "" };

export default class TradingResearchLabPlugin extends Plugin {
  settings: TradingResearchSettings = DEFAULT_SETTINGS;
  worker!: WorkerClient;
  /** Shared by the workspace view and the left-sidebar navigation. */
  readonly navigation = new NavigationStore();
  private lastOpenedMarkdownPath: string | null = null;

  async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData() as Partial<TradingResearchSettings> ?? {}) };
    this.worker = new WorkerClient(this.settings.pythonExecutable, this.workerWorkspacePath());
    this.rememberMarkdownFile(this.app.workspace.getActiveFile());
    this.registerEvent(this.app.workspace.on("file-open", (file) => this.rememberMarkdownFile(file)));
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
  }
}
