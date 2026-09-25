import type { RecordKind } from "./record-block";
import type { ExperimentKind, NoteEntry } from "./research-notes-model";

/** What record panels and the notes browser may do with TRL research notes (N1, N3). */
export type NotesApi = {
  entries: NoteEntry[];
  open: (path: string) => void;
  createStrategy: (title: string) => Promise<{ id: string; path: string }>;
  createExperiment: (title: string, strategyId: string, kind: ExperimentKind, bindings?: Record<string, string>) => Promise<{ id: string; path: string }>;
  /** Writes (or, after confirmation, replaces) a marked block in the note. */
  record: (path: string, markdown: string, recordId: string, kind: RecordKind) => Promise<void>;
  rename: (path: string, title: string) => Promise<string>;
  /** TRL notes (never others) whose text contains the reference, e.g. a sweep's hash; used to warn before a deletion. */
  findReferences: (reference: string) => Promise<string[]>;
  /** Moves notes to Obsidian's trash (recoverable); returns how many were moved. */
  trash: (paths: string[]) => Promise<number>;
  /** Asks for a name with the N5 check against the given existing names. */
  promptName: (title: string, label: string, initial: string, existing: string[], confirmText: string) => Promise<string | null>;
};
