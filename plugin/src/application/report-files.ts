/** MT5 Strategy Tester report files TRL imports: the Excel export or the HTML report. */
export const MT5_REPORT_ACCEPT = ".xlsx,.htm,.html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html";
export const MT5_REPORT_HINT = "MT5 Strategy Tester report (.xlsx or .html)";

export function isMt5ReportPath(path: string): boolean {
  return /\.(xlsx|html?)$/i.test(path.trim());
}

/** File name without the report extension, for labels and note names. */
export function reportBaseName(filename: string): string {
  return filename.replace(/\.(xlsx|html?)$/i, "");
}
