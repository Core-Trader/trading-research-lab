import { Modal, Notice, TFile, type App } from "obsidian";
import type TradingResearchLabPlugin from "../main";
import { generatedNoteBlock, updateGeneratedNoteText } from "../generated-note";
import { readDocumentReference } from "../research-documents";
import type { MarkdownResult } from "../types";

export async function writeGeneratedNote(plugin: TradingResearchLabPlugin, sourcePath: string, rendered: MarkdownResult): Promise<string> {
  const baseName = (sourcePath.split(/[\\/]/).pop()?.replace(/\.(xlsx|html?)$/i, "") || "mt5-report").replace(/[<>:"/\\|?*]/g, "_");
  const folder = "Trading Research Lab/M0";
  await ensureFolder(plugin, "Trading Research Lab");
  await ensureFolder(plugin, folder);
  const outputPath = `${folder}/${baseName} - M0 Analysis.md`;
  const existing = plugin.app.vault.getAbstractFileByPath(outputPath);
  if (existing instanceof TFile) {
    const prior = await plugin.app.vault.read(existing);
    await plugin.app.vault.modify(existing, updateGeneratedNoteText(prior, rendered));
  } else {
    const frontmatter = `---\ntrl_type: report\ntrl_schema: 1\ntrl_id: ${rendered.analysis_run_id}\ntrl_status: draft\ntrl_engine_version: ${rendered.core_version}\ntrl_dataset_id: ${rendered.dataset_id}\ntrl_source_import_id: ${rendered.source_import_id}\ntrl_analysis_run_id: ${rendered.analysis_run_id}\n---\n\n# ${baseName} — M0 Analysis\n\n`;
    await plugin.app.vault.create(outputPath, `${frontmatter}${generatedNoteBlock(rendered)}\n`);
  }
  return outputPath;
}

export async function ensureFolder(plugin: TradingResearchLabPlugin, path: string): Promise<void> {
  if (plugin.app.vault.getAbstractFileByPath(path) === null) await plugin.app.vault.createFolder(path);
}

export async function createVaultDocument(plugin: TradingResearchLabPlugin, folder: string, title: string, text: string): Promise<string> {
  await ensureFolder(plugin, folder);
  const safeTitle = title.replace(/[<>:"/\\|?*]/g, "_").trim();
  if (!safeTitle) throw new Error("A document name is required.");
  const path = `${folder}/${safeTitle}.md`;
  if (plugin.app.vault.getAbstractFileByPath(path) !== null) throw new Error(`A document already exists at ${path}. Choose a different name; the plugin will not overwrite it.`);
  await plugin.app.vault.create(path, text);
  return path;
}

export function requestDocumentName(app: App, title: string, label: string, initialValue: string): Promise<string | null> {
  return requestText(app, title, label, initialValue, "Create");
}

export function requestText(app: App, title: string, label: string, initialValue: string, confirmText: string): Promise<string | null> {
  return new Promise((resolve) => new DocumentNameModal(app, title, label, initialValue, confirmText, resolve).open());
}

class DocumentNameModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly titleText: string,
    private readonly labelText: string,
    private readonly initialValue: string,
    private readonly confirmText: string,
    private readonly resolveName: (value: string | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.titleText });
    contentEl.createEl("label", { text: this.labelText });
    const input = contentEl.createEl("input", { type: "text", value: this.initialValue });
    input.style.width = "100%";
    const actions = contentEl.createDiv({ cls: "trl-m0__actions" });
    const confirm = actions.createEl("button", { text: this.confirmText, cls: "mod-cta" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    const submit = (): void => {
      const value = input.value.trim();
      if (!value) {
        new Notice("Enter a document name or cancel.");
        return;
      }
      this.settle(value);
    };
    confirm.addEventListener("click", submit);
    cancel.addEventListener("click", () => this.settle(null));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit();
      if (event.key === "Escape") this.settle(null);
    });
    window.setTimeout(() => input.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) {
      this.settled = true;
      this.resolveName(null);
    }
  }

  private settle(value: string | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolveName(value);
    this.close();
  }
}

export async function readCurrentDocument(
  plugin: TradingResearchLabPlugin,
  expectedType: "strategy" | "experiment" | "report",
  requiredKeys: string[],
): Promise<{ id: string; path: string; values: Record<string, string> }> {
  const file = plugin.selectedMarkdownFile();
  if (file === null) throw new Error(`Open the existing ${expectedType} Markdown note first, then use this button.`);
  const reference = readDocumentReference(await plugin.app.vault.read(file), expectedType, requiredKeys);
  return { id: reference.id, path: file.path, values: reference.values };
}
