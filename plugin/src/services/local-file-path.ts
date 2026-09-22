export function localPathForSelectedFile(file: File): string {
  const runtimeRequire = (window as Window & { require?: (moduleName: string) => unknown }).require;
  if (runtimeRequire !== undefined) {
    try {
      const electron = runtimeRequire("electron") as {
        webUtils?: { getPathForFile?: (candidate: File) => string };
      };
      const modernPath = electron.webUtils?.getPathForFile?.(file);
      if (typeof modernPath === "string" && modernPath.length > 0) return modernPath;
    } catch {
      // Older or restricted Obsidian desktop runtimes may not expose Electron here.
    }
  }

  const legacyPath = (file as File & { path?: unknown }).path;
  if (typeof legacyPath === "string" && legacyPath.length > 0) return legacyPath;

  throw new Error("Obsidian could not obtain the local path for the selected file. Paste the full .xlsx path instead, then report this compatibility issue.");
}
