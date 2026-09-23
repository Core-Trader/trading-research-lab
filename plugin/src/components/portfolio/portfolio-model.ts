/**
 * Session state for Portfolio Lab track building. Pure data operations only:
 * which reports belong to which track and which tracks are combined. Order,
 * eligibility, and every result are decided by the Core.
 */
export type TrackDraft = { key: string; label: string; refs: string[]; included: boolean };

export function addTrack(tracks: TrackDraft[], ref: string, label: string): TrackDraft[] {
  if (tracks.some((track) => track.refs.includes(ref))) return tracks;
  const key = `t${tracks.reduce((largest, track) => Math.max(largest, Number(track.key.slice(1)) || 0), 0) + 1}`;
  return [...tracks, { key, label, refs: [ref], included: true }];
}

export function addToTrack(tracks: TrackDraft[], key: string, ref: string): TrackDraft[] {
  if (tracks.some((track) => track.refs.includes(ref))) return tracks;
  return tracks.map((track) => track.key === key ? { ...track, refs: [...track.refs, ref] } : track);
}

export function removeReport(tracks: TrackDraft[], ref: string): TrackDraft[] {
  return tracks.map((track) => ({ ...track, refs: track.refs.filter((item) => item !== ref) })).filter((track) => track.refs.length > 0);
}

export function removeTrack(tracks: TrackDraft[], key: string): TrackDraft[] {
  return tracks.filter((track) => track.key !== key);
}

export function renameTrack(tracks: TrackDraft[], key: string, label: string): TrackDraft[] {
  return tracks.map((track) => track.key === key ? { ...track, label } : track);
}

export function toggleIncluded(tracks: TrackDraft[], key: string): TrackDraft[] {
  return tracks.map((track) => track.key === key ? { ...track, included: !track.included } : track);
}

/** The tracks sent to the Core, in display order, plus their labels in the same order. */
export function combinationRequest(tracks: TrackDraft[]): { tracks: string[][]; labels: string[] } {
  const included = tracks.filter((track) => track.included && track.refs.length > 0);
  return { tracks: included.map((track) => track.refs), labels: included.map((track) => track.label || track.key) };
}

export type Span = { key: string; label: string; first: string; last: string; flagged?: boolean };
export type SpanRow = Span & { left: number; width: number };

/** Places report-clock spans on one shared axis (percent). Display geometry only. */
export function spanTimeline(spans: Span[]): { rows: SpanRow[]; start: string; end: string } | null {
  const parsed = spans.map((span) => ({ span, from: Date.parse(span.first), to: Date.parse(span.last) }));
  if (parsed.length === 0 || parsed.some((item) => Number.isNaN(item.from) || Number.isNaN(item.to))) return null;
  const start = Math.min(...parsed.map((item) => item.from));
  const end = Math.max(...parsed.map((item) => item.to));
  const range = end - start || 1;
  return {
    start: parsed.find((item) => item.from === start)!.span.first,
    end: parsed.find((item) => item.to === end)!.span.last,
    rows: parsed.map(({ span, from, to }) => ({ ...span, left: ((from - start) / range) * 100, width: Math.max(0.8, ((to - from) / range) * 100) })),
  };
}
