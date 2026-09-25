/**
 * One marked block per kind of recorded check inside an Experiment note
 * (NOTES-2). Recording a check replaces only the block of the same kind; every
 * other record and all of the owner's text stay byte for byte. Malformed or
 * duplicated markers of the kind being written block the write instead of guessing.
 *
 * Legacy notes hold at most one `TRL:CHOICE` block (PX-007), which every
 * record used to share. Its kind is read from its heading; it is upgraded to a
 * kind block only when that same kind is recorded again, and never overwritten
 * by a different kind.
 */

export const RECORD_KINDS = {
  "parameter-choice": { label: "chosen parameter set", heading: "## Chosen parameter set" },
  "symbol-shortlist": { label: "symbol shortlist", heading: "### Symbol shortlist" },
  windows: { label: "windows check", heading: "### Windows checked" },
  significance: { label: "significance check", heading: "### Significance checked" },
  costs: { label: "costs check", heading: "### Costs checked" },
  "execution-costs": { label: "execution costs check", heading: "### Execution costs checked" },
  "monte-carlo": { label: "Monte Carlo check", heading: "### Monte Carlo checked" },
  "combined-equity": { label: "combined equity check", heading: "### Combined equity checked" },
} as const;
export type RecordKind = keyof typeof RECORD_KINDS;

const ID = /^[0-9a-f-]{36}$/;
const LEGACY_START = /<!-- TRL:CHOICE:START evaluation_id=[0-9a-f-]{36} -->/g;
const LEGACY_END = "<!-- TRL:CHOICE:END -->";
const start = (kind: RecordKind, id: string): string => `<!-- TRL:RECORD:START kind=${kind} id=${id} -->`;
const end = (kind: RecordKind): string => `<!-- TRL:RECORD:END kind=${kind} -->`;
const startPattern = (kind: RecordKind): RegExp => new RegExp(`<!-- TRL:RECORD:START kind=${kind.replace(/-/g, "\\-")} id=[0-9a-f-]{36} -->`, "g");

export function recordBlock(kind: RecordKind, id: string, markdown: string): string {
  if (!(kind in RECORD_KINDS)) throw new Error(`Unknown record kind ${kind}.`);
  if (!ID.test(id)) throw new Error("Invalid record id.");
  return `${start(kind, id)}\n${markdown.trimEnd()}\n${end(kind)}`;
}

/** The kind of a legacy TRL:CHOICE block, read from its first heading. */
export function legacyKind(content: string): RecordKind {
  const heading = content.split("\n").map((line) => line.trim()).find((line) => line.startsWith("#")) ?? "";
  const match = (Object.entries(RECORD_KINDS) as Array<[RecordKind, { heading: string }]>).find(([, value]) => heading.startsWith(value.heading));
  return match ? match[0] : "parameter-choice";
}

function legacyBlock(note: string): { startAt: number; endAt: number; kind: RecordKind } | null {
  const starts = note.match(LEGACY_START) ?? [];
  const ends = note.split(LEGACY_END).length - 1;
  if (starts.length === 0 && ends === 0) return null;
  const startAt = starts.length === 1 ? note.indexOf(starts[0]!) : -1;
  const endAt = startAt >= 0 ? note.indexOf(LEGACY_END, startAt) : -1;
  if (starts.length !== 1 || ends !== 1 || endAt < 0) return { startAt: -1, endAt: -1, kind: "parameter-choice" };  // malformed: only matters if we must touch it
  return { startAt, endAt: endAt + LEGACY_END.length, kind: legacyKind(note.slice(startAt + starts[0]!.length, endAt)) };
}

export function upsertRecordBlock(note: string, kind: RecordKind, id: string, markdown: string): { text: string; replaced: boolean } {
  const block = recordBlock(kind, id, markdown);
  const starts = note.match(startPattern(kind)) ?? [];
  const ends = note.split(end(kind)).length - 1;
  if (starts.length > 0 || ends > 0) {
    const startAt = starts.length === 1 ? note.indexOf(starts[0]!) : -1;
    const endAt = startAt >= 0 ? note.indexOf(end(kind), startAt) : -1;
    if (starts.length !== 1 || ends !== 1 || endAt < 0) throw new Error(`The note has missing, duplicated, or malformed TRL markers for its ${RECORD_KINDS[kind].label}. Fix the note before recording it again.`);
    return { text: `${note.slice(0, startAt)}${block}${note.slice(endAt + end(kind).length)}`, replaced: true };
  }
  const legacy = legacyBlock(note);
  if (legacy && legacy.startAt >= 0 && legacy.kind === kind) {
    return { text: `${note.slice(0, legacy.startAt)}${block}${note.slice(legacy.endAt)}`, replaced: true };
  }
  const separator = note.length === 0 || note.endsWith("\n\n") ? "" : note.endsWith("\n") ? "\n" : "\n\n";
  return { text: `${note}${separator}${block}\n`, replaced: false };
}

/** Kinds recorded in a note (kind blocks plus a legacy block), for the research checklist. */
export function recordedKinds(note: string): RecordKind[] {
  const found = new Set<RecordKind>();
  for (const match of note.matchAll(/<!-- TRL:RECORD:START kind=([a-z-]+) id=[0-9a-f-]{36} -->/g)) {
    if (match[1]! in RECORD_KINDS && note.includes(end(match[1] as RecordKind))) found.add(match[1] as RecordKind);
  }
  const legacy = legacyBlock(note);
  if (legacy && legacy.startAt >= 0) found.add(legacy.kind);
  return [...found];
}
