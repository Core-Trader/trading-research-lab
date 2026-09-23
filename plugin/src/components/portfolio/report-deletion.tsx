import React, { useState } from "react";
import type { DatasetDeletionPreview } from "../../types";
import { deletionConsequence } from "./portfolio-model";

/** Vault access for notes that carry `trl_dataset_id`; provided by the view (Obsidian app). */
export type LinkedNotes = {
  find: (datasetId: string) => string[];
  /** Moves notes to Obsidian's trash (recoverable); returns how many were moved. */
  trash: (paths: string[]) => Promise<number>;
};

const KIND_LABEL: Record<DatasetDeletionPreview["dependents"][number]["kind"], string> = {
  SAVED_COMBINATION: "Saved combination",
  PARAMETER_STUDY_SINGLE_TEST: "Parameter study single test",
  SEQUENTIAL_BATCH: "Sequential batch",
  REPORT_REVISIONS: "Report data",
};

/**
 * Permanent deletion with an explicit dependents choice (DS-003). The Core
 * lists TRL-managed dependents; linked vault notes are found by
 * `trl_dataset_id`. Default is to keep linked items.
 */
export function ReportDeletion({ preview, notes, busy, onConfirm, onCancel }: {
  preview: DatasetDeletionPreview;
  notes: string[];
  busy: boolean;
  onConfirm: (deleteLinked: boolean) => void;
  onCancel: () => void;
}): React.ReactElement {
  const [deleteLinked, setDeleteLinked] = useState(false);
  const linked = preview.dependents.length + notes.length;
  return <div className="trl-deletion" role="alertdialog" aria-label={`Delete ${preview.original_filename} permanently`}>
    <strong>Delete {preview.original_filename} permanently?</strong>
    <p>This removes TRL's copy of the report and everything derived from it ({(preview.bytes / 1024).toFixed(0)} KB). It cannot be undone. Your original file on disk is not touched, so you can import it again later.</p>
    {linked > 0 && <>
      <p className="trl-deletion__warning">Used by:</p>
      <ul>
        {preview.dependents.map((item) => <li key={`${item.kind}:${item.name}`}>{KIND_LABEL[item.kind]}: {item.name}</li>)}
        {notes.map((path) => <li key={path}>Note: {path}</li>)}
      </ul>
      <fieldset className="trl-deletion__choice">
        <label><input type="radio" name="trl-linked" checked={!deleteLinked} onChange={() => setDeleteLinked(false)} /> Keep linked items</label>
        <label><input type="radio" name="trl-linked" checked={deleteLinked} onChange={() => setDeleteLinked(true)} /> Delete linked items too</label>
      </fieldset>
    </>}
    <p className="trl-m0__note">{deletionConsequence(preview, notes, deleteLinked)}</p>
    <div className="trl-m0__actions">
      <button type="button" className="mod-warning" disabled={busy} onClick={() => onConfirm(deleteLinked)}>Delete permanently</button>
      <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
    </div>
  </div>;
}
