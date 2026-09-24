/**
 * The report TRL reopens with (SESSION-1): only references are kept, never
 * results. On reopening, the Core recalculates from the stored report, and the
 * analysis run id is content-derived, so the same Experiment notes still match.
 */
export type NoteRef = { id: string; path: string };

export type LastReport = {
  schema: 1;
  datasetRef: string;
  /** Whether the report had been analysed; if so it is recalculated on reopening. */
  analysed: boolean;
  workingSet: { strategy: NoteRef | null; experiment: NoteRef | null; report: NoteRef | null };
};

const noteRef = (value: unknown): NoteRef | null => {
  if (typeof value !== "object" || value === null) return null;
  const { id, path } = value as { id?: unknown; path?: unknown };
  return typeof id === "string" && id && typeof path === "string" && path ? { id, path } : null;
};

/** Reads the saved value defensively; anything malformed means "nothing to restore". */
export function readLastReport(value: unknown): LastReport | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as { schema?: unknown; datasetRef?: unknown; analysed?: unknown; workingSet?: unknown };
  if (record.schema !== 1 || typeof record.datasetRef !== "string" || !record.datasetRef) return null;
  const set = (typeof record.workingSet === "object" && record.workingSet !== null ? record.workingSet : {}) as Record<string, unknown>;
  return {
    schema: 1,
    datasetRef: record.datasetRef,
    analysed: record.analysed === true,
    workingSet: { strategy: noteRef(set.strategy), experiment: noteRef(set.experiment), report: noteRef(set.report) },
  };
}

export function sameLastReport(a: LastReport | null, b: LastReport | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
