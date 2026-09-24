import type { App, TAbstractFile } from "obsidian";
import { entryFromFrontmatter, type NoteEntry } from "./research-notes-model";

type Listener = () => void;

/**
 * Live list of TRL research notes (N3, N4, N6): only Markdown files whose
 * frontmatter carries a TRL `trl_type` and `trl_id`, read from Obsidian's
 * metadata cache. Other notes are never opened or read.
 */
export class ResearchNotesIndex {
  private readonly app: App;
  private current: NoteEntry[] = [];
  private readonly listeners = new Set<Listener>();
  private timer: number | null = null;

  constructor(app: App) {
    this.app = app;
  }

  get entries(): NoteEntry[] { return this.current; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  refresh(): void {
    const next: NoteEntry[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const entry = entryFromFrontmatter(file.path, file.basename, file.stat.mtime, this.app.metadataCache.getFileCache(file)?.frontmatter);
      if (entry) next.push(entry);
    }
    this.current = next;
    for (const listener of [...this.listeners]) listener();
  }

  /** Debounced refresh for bursts of vault events (sync, bulk renames). */
  schedule(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.timer = null; this.refresh(); }, 250);
  }

  isMarkdown(file: TAbstractFile): boolean { return file.path.toLowerCase().endsWith(".md"); }
}
