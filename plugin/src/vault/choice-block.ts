/**
 * Bounded "chosen parameter set" block inside an Experiment note (PX-007).
 * Only text between the TRL choice markers is ever replaced; the rest of the
 * owner's note is preserved byte for byte. Malformed or duplicated markers
 * block the write instead of guessing.
 */
const START = /<!-- TRL:CHOICE:START evaluation_id=[0-9a-f-]{36} -->/g;
const END = "<!-- TRL:CHOICE:END -->";

export function choiceBlock(evaluationId: string, markdown: string): string {
  if (!/^[0-9a-f-]{36}$/.test(evaluationId)) throw new Error("Invalid evaluation id for the choice block.");
  return `<!-- TRL:CHOICE:START evaluation_id=${evaluationId} -->\n${markdown.trimEnd()}\n${END}`;
}

export function upsertChoiceBlock(note: string, evaluationId: string, markdown: string): { text: string; replaced: boolean } {
  const block = choiceBlock(evaluationId, markdown);
  const starts = note.match(START) ?? [];
  const ends = note.split(END).length - 1;
  if (starts.length === 0 && ends === 0) {
    const separator = note.length === 0 || note.endsWith("\n\n") ? "" : note.endsWith("\n") ? "\n" : "\n\n";
    return { text: `${note}${separator}${block}\n`, replaced: false };
  }
  const startAt = starts.length === 1 ? note.indexOf(starts[0]!) : -1;
  const endAt = startAt >= 0 ? note.indexOf(END, startAt) : -1;
  if (starts.length !== 1 || ends !== 1 || endAt < 0) {
    throw new Error("The experiment note has missing, duplicated, or malformed TRL choice markers. Fix the note before recording a choice.");
  }
  return { text: `${note.slice(0, startAt)}${block}${note.slice(endAt + END.length)}`, replaced: true };
}
