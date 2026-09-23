/**
 * Which MQL5 files the Help page offers and where each goes. Pure: the page
 * performs the writes (never overwriting) with Node's fs.
 */
export type HelpFile = { name: string; description: string; mt5Subfolder: string[] };

export const LOGGER_FILES: HelpFile[] = [
  { name: "TRL_EquityLogger.mqh", description: "The equity logger include: add it to any EA whose source you have.", mt5Subfolder: ["Include"] },
  { name: "TRL_EquityLogger_Example.mq5", description: "A small example EA with the logger already added; compile it in MetaEditor (F7).", mt5Subfolder: ["Experts", "TRL"] },
];

export type SaveTarget = "folder" | "mt5";

/** Path parts (relative to the chosen folder) for a file, per target. */
export function relativeParts(file: HelpFile, target: SaveTarget): string[] {
  return target === "mt5" ? [...file.mt5Subfolder, file.name] : [file.name];
}

/** An MQL5 folder is recognised by its standard Include and Experts subfolders. */
export function looksLikeMql5Folder(entries: string[]): boolean {
  const names = new Set(entries.map((entry) => entry.toLowerCase()));
  return names.has("include") && names.has("experts");
}
