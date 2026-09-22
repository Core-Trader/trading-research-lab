/**
 * Tracks the most recent run of one workflow so a slower, superseded run can
 * never overwrite the results of a newer one (e.g. two imports in quick
 * succession). It does not cancel worker requests; it only rejects stale results.
 */
export class LatestRun {
  private current = 0;

  begin(): number {
    this.current += 1;
    return this.current;
  }

  isCurrent(token: number): boolean {
    return token === this.current;
  }
}
