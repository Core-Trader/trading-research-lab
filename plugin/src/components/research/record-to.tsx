import React, { useEffect, useMemo, useState } from "react";
import type { NotesApi } from "../../vault/notes-api";
import { isCompatible, KIND_LABEL, nameCheck, similarTitles, type ExperimentKind, type RecordRequirement } from "../../vault/research-notes-model";

type Props = {
  notes: NotesApi;
  requirement: RecordRequirement;
  /** The kind a new experiment created here gets. */
  createKind: ExperimentKind;
  /** Frontmatter bindings for a new experiment (report-analysis needs the loaded dataset and analysis). */
  bindings?: Record<string, string>;
  value: string | null;
  onChange: (path: string | null) => void;
};

const NEW = "__new__";
const fail = (caught: unknown): string => caught instanceof Error ? caught.message : String(caught);

/**
 * "Record to" (N1): choose a compatible Experiment, or create one inline with a
 * name check and a Strategy picker, and open it. Used by every record panel.
 */
export function RecordTo({ notes, requirement, createKind, bindings, value, onChange }: Props): React.ReactElement {
  const compatible = useMemo(() => notes.entries.filter((entry) => isCompatible(entry, requirement)).sort((left, right) => right.mtime - left.mtime), [notes.entries, requirement]);
  const strategies = useMemo(() => notes.entries.filter((entry) => entry.type === "strategy").sort((left, right) => left.title.localeCompare(right.title)), [notes.entries]);
  const experimentTitles = useMemo(() => notes.entries.filter((entry) => entry.type === "experiment").map((entry) => entry.title), [notes.entries]);
  const strategyTitles = strategies.map((entry) => entry.title);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<string>("");
  const [strategyName, setStrategyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to the most recently changed compatible experiment; drop a choice that is no longer compatible.
  useEffect(() => {
    if (value && compatible.some((entry) => entry.path === value)) return;
    onChange(compatible[0]?.path ?? null);
  }, [compatible, value, onChange]);
  useEffect(() => { if (!strategy) setStrategy(strategies[0]?.id ?? NEW); }, [strategies, strategy]);

  const check = nameCheck(name, experimentTitles);
  const strategyCheck = nameCheck(strategyName, strategyTitles);
  const canCreate = name.trim() !== "" && check.exact === null && (strategy !== NEW || (strategyName.trim() !== "" && strategyCheck.exact === null));

  const create = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const strategyId = strategy === NEW ? (await notes.createStrategy(strategyName.trim())).id : strategy;
      const created = await notes.createExperiment(name.trim(), strategyId, createKind, bindings);
      onChange(created.path);
      setCreating(false);
      setName("");
      setStrategyName("");
    } catch (caught) { setError(fail(caught)); } finally { setBusy(false); }
  };

  return <div className="trl-record-to">
    <div className="trl-record-to__row">
      <label htmlFor="trl-record-to">Record to</label>
      <select id="trl-record-to" value={value ?? ""} onChange={(event) => onChange(event.currentTarget.value || null)}>
        {compatible.length === 0 && <option value="">No matching experiment yet</option>}
        {compatible.map((entry) => <option key={entry.path} value={entry.path}>{entry.title} · {KIND_LABEL[entry.kind!]}</option>)}
      </select>
      <button type="button" onClick={() => setCreating(!creating)}>{creating ? "Cancel" : "New experiment…"}</button>
      {value && <button type="button" className="trl-link-button" onClick={() => notes.open(value)}>Open note</button>}
    </div>
    {compatible.length === 0 && !creating && <p className="trl-m0__note">Experiments of the kinds {requirement.kinds.map((kind) => KIND_LABEL[kind].toLowerCase()).join(" or ")}{requirement.kinds.includes("report-analysis") ? " (for this report)" : ""} can hold this record. Create one here.</p>}
    {creating && <div className="trl-record-to__form">
      <label className="trl-m0__field"><span>Experiment name ({KIND_LABEL[createKind].toLowerCase()})</span>
        <input value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="e.g. DCA EAs, symbol scan 2025" />
      </label>
      {check.exact && <p className="trl-m0__inline-error">"{check.exact}" already exists. Choose another name.</p>}
      {!check.exact && check.near.length > 0 && <p className="trl-m0__note">Similar name already exists: {check.near.join(", ")}.</p>}
      {!check.exact && check.near.length === 0 && similarTitles(name, experimentTitles).length > 0 && <p className="trl-m0__note">Existing: {similarTitles(name, experimentTitles).join(", ")}</p>}
      <label className="trl-m0__field"><span>Strategy</span>
        <select value={strategy} onChange={(event) => setStrategy(event.currentTarget.value)}>
          {strategies.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
          <option value={NEW}>New strategy…</option>
        </select>
      </label>
      {strategy === NEW && <label className="trl-m0__field"><span>New strategy name</span><input value={strategyName} onChange={(event) => setStrategyName(event.currentTarget.value)} placeholder="e.g. DCA grid family" /></label>}
      {strategy === NEW && strategyCheck.exact && <p className="trl-m0__inline-error">A strategy "{strategyCheck.exact}" already exists; pick it from the list.</p>}
      <div className="trl-m0__actions"><button type="button" className="mod-cta" disabled={!canCreate || busy} onClick={() => void create()}>Create and select</button></div>
      {error && <p className="trl-m0__inline-error" role="alert">{error}</p>}
    </div>}
  </div>;
}
