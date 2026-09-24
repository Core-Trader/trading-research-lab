import React from "react";
import { LABEL_TEXT, SOURCES, type WorkflowPoint } from "./help/research-workflow";

/** One labelled point (sourced fact, workflow choice, TRL suggestion, or your threshold) with its source. */
export function SourcedPoint({ point }: { point: WorkflowPoint }): React.ReactElement {
  const source = point.source ? SOURCES[point.source] : null;
  return <li className={`trl-workflow__check is-${point.label.toLowerCase()}`}>
    <span className="trl-workflow__label" title={LABEL_TEXT[point.label]}>{LABEL_TEXT[point.label]}</span> {point.text}
    {source && <span className="trl-workflow__source"> Source: {source.url ? <a href={source.url}>{source.title}</a> : source.title}.</span>}
  </li>;
}

export function SourcedList({ points }: { points: WorkflowPoint[] }): React.ReactElement {
  return <ul className="trl-workflow__checks">{points.map((point) => <SourcedPoint key={point.text} point={point} />)}</ul>;
}
