import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { plain, plainSentence } from "../plain-language";
import type { ResearchService } from "../../application/research-service";
import { LatestRun } from "../../application/latest-run";
import type { DatasetEvidence, PropChain, PropEvaluation, PropPreset, PropProfile, PropRolling, PropTarget, SavedCombinationEntry } from "../../types";
import type { PropRequest } from "../../application/navigation";
import { AuditTrail } from "../audit-trail";
import { ChartFrame } from "../chart-frame";
import { slotIndex, nearestIndex } from "../chart-geometry";
import { DismissButton } from "../dismiss-button";
import { formatTimestamp, roundDecimalString } from "../display-format";
import { GuidanceBlock, KpiTile } from "../guidance";
import { CHAIN_LABEL, CHALLENGE_TEXT, ROLLING_LABEL, accountText, chainGuidance, presetIdOf, presetKey, rollingGuidance, emptyForm, formFromPreset, EVIDENCE_TEXT, formFromRules, limitText, limitUsedPercent, modeText, profileFromForm, propChartGeometry, propGuidance, RULE_LABELS, verdictHeadline, ZONE_SUGGESTIONS, type LimitKind, type ProfileForm } from "./prop-model";
import { money } from "../display-format";

type Props = { service: ResearchService; currentDatasetRef: string | null; request?: PropRequest | null };
type Choice = { key: string; label: string; target: PropTarget; account: string | null; logged: boolean };

const r2 = (value: string | null | undefined): string => value === null || value === undefined ? "—" : roundDecimalString(value, 2);
const CLOCK_KEY = "trl-prop-report-clock:";

function rememberedClock(key: string): string {
  try { return window.localStorage.getItem(CLOCK_KEY + key) ?? ""; } catch { return ""; }
}
function rememberClock(key: string, zone: string): void {
  try { window.localStorage.setItem(CLOCK_KEY + key, zone); } catch { /* per-viewer convenience only */ }
}

/**
 * Prop-firm rule check (PROP_FIRM_SPEC.md). The user enters the firm's rules
 * in a profile; the Core checks one report or saved combination against it.
 */
export function PropCheckPage({ service, currentDatasetRef, request = null }: Props): React.ReactElement {
  const [profiles, setProfiles] = useState<PropProfile[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [editing, setEditing] = useState<{ form: ProfileForm; supersedes: string | null } | null>(null);
  const [library, setLibrary] = useState<DatasetEvidence[]>([]);
  const [combinations, setCombinations] = useState<SavedCombinationEntry[]>([]);
  const [presets, setPresets] = useState<PropPreset[]>([]);
  const [choiceKey, setChoiceKey] = useState<string>("");
  const [clockZone, setClockZone] = useState("");
  const [result, setResult] = useState<PropEvaluation | null>(null);
  const [rolling, setRolling] = useState<PropRolling | null>(null);
  const [chain, setChain] = useState<PropChain | null>(null);
  const [laterPhases, setLaterPhases] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runs = useRef(new LatestRun()).current;
  const fail = (caught: unknown): void => setError(caught instanceof Error ? caught.message : String(caught));

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [listed, registry, saved, firmPresets] = await Promise.all([service.listPropProfiles(), service.listRegistry(), service.listSavedCombinations(), service.listPropPresets()]);
      setPresets(firmPresets.presets);
      setProfiles(listed.profiles);
      setLibrary(registry.entries);
      setCombinations(saved.entries.filter((entry) => entry.combination !== null));
      setProfileId((current) => current || listed.profiles[0]?.profile_id || (firmPresets.presets[0] ? presetKey(firmPresets.presets[0].preset_id) : ""));
    } catch (caught) { fail(caught); }
  }, [service]);
  useEffect(() => { void refresh(); }, [refresh]);

  const choices = useMemo<Choice[]>(() => [
    ...library.map((entry) => ({ key: `report:${entry.dataset_ref}`, label: `${entry.original_filename} · ${entry.supplied_facts.symbol ?? "?"}${entry.equity?.status === "LINKED_VERIFIED" ? " · equity log" : ""}`, target: { kind: "DATASET" as const, dataset_ref: entry.dataset_ref }, account: entry.supplied_facts.initial_deposit, logged: entry.equity?.status === "LINKED_VERIFIED" })),
    ...combinations.map((entry) => ({ key: `combination:${entry.saved.key}`, label: `${entry.saved.name} (saved combination, ${entry.saved.tracks.length} tracks)`, target: { kind: "COMBINATION" as const, tracks: entry.saved.tracks, starting_capital: entry.saved.starting_capital }, account: entry.saved.starting_capital, logged: false })),
  ], [library, combinations]);
  useEffect(() => {
    if (choiceKey || choices.length === 0) return;
    const current = currentDatasetRef ? choices.find((choice) => choice.key === `report:${currentDatasetRef}`) : undefined;
    setChoiceKey((current ?? choices[0]!).key);
  }, [choices, choiceKey, currentDatasetRef]);
  useEffect(() => { if (choiceKey) setClockZone(rememberedClock(choiceKey)); }, [choiceKey]);
  // A quick action asked for a specific run (or the current report); apply it once the choices are known.
  const appliedRequest = useRef(0);
  useEffect(() => {
    if (!request || request.seq === appliedRequest.current || choices.length === 0) return;
    const wanted = request.choice ?? (currentDatasetRef ? `report:${currentDatasetRef}` : null);
    if (wanted && choices.some((item) => item.key === wanted)) { setChoiceKey(wanted); setResult(null); setRolling(null); setChain(null); }
    appliedRequest.current = request.seq;
  }, [request, choices, currentDatasetRef]);

  const profile = profiles.find((item) => item.profile_id === profileId) ?? null;
  const choice = choices.find((item) => item.key === choiceKey) ?? null;
  const presetById = (key: string): PropPreset | null => { const id = presetIdOf(key); return id === null ? null : presets.find((item) => item.preset_id === id) ?? null; };
  const selectedPreset = presetById(profileId);
  const runAccount = accountText(choice?.account);
  const rulesOf = (key: string): { reset: PropProfile["rules"]["reset"] } | null => profiles.find((item) => item.profile_id === key)?.rules ?? presetById(key)?.rules ?? null;
  const needsClock = rulesOf(profileId)?.reset.kind === "FIRM_RESET";
  const selected = profile !== null || selectedPreset !== null;
  // Checking against a firm preset saves an ordinary, editable copy sized to the run first (content-addressed: repeat checks reuse it).
  const resolveProfile = async (key: string): Promise<string> => {
    const preset = presetById(key);
    if (!preset) return key;
    if (!runAccount) throw new Error("The selected run has no starting balance to size the preset copy; use New profile… and enter the account size.");
    const saved = await service.savePropProfile({ ...preset.rules, name: preset.name, account_size: runAccount }, null, preset.preset_id);
    const listed = await service.listPropProfiles();
    setProfiles(listed.profiles);
    if (key === profileId) setProfileId(saved.profile.profile_id);
    setLaterPhases((current) => current.map((item) => item === key ? saved.profile.profile_id : item));
    return saved.profile.profile_id;
  };

  const save = async (): Promise<void> => {
    if (!editing) return;
    setError(null);
    try {
      const saved = await service.savePropProfile(profileFromForm(editing.form), editing.supersedes, editing.form.presetId);
      await refresh();
      setProfileId(saved.profile.profile_id);
      setEditing(null);
    } catch (caught) { fail(caught); }
  };
  const remove = async (): Promise<void> => {
    if (!profile || !window.confirm(`Delete the profile "${profile.rules.name}"? Results are not stored, so nothing else changes.`)) return;
    try { await service.deletePropProfile(profile.profile_id); setProfileId(""); setResult(null); setRolling(null); setChain(null); await refresh(); } catch (caught) { fail(caught); }
  };
  const phaseKeys = selected ? [profileId, ...laterPhases.filter((id) => id !== "")] : [];
  const chainNeedsClock = phaseKeys.some((key) => rulesOf(key)?.reset.kind === "FIRM_RESET");
  const rollStarts = async (): Promise<void> => {
    if (!selected || !choice) return;
    const token = runs.begin();
    setBusy(phaseKeys.length > 1 ? "Following every start day through each phase…" : "Following every start day to its first decision…");
    setError(null);
    try {
      if (clockZone.trim()) rememberClock(choice.key, clockZone.trim());
      const phaseIds: string[] = [];
      for (const key of phaseKeys) phaseIds.push(await resolveProfile(key));
      if (phaseIds.length > 1) {
        const chained = await service.propChainStarts(phaseIds, choice.target, chainNeedsClock ? clockZone.trim() || null : null);
        if (runs.isCurrent(token)) { setChain(chained); setRolling(null); }
      } else {
        const rolled = await service.propRollingStarts(phaseIds[0]!, choice.target, needsClock ? clockZone.trim() || null : null);
        if (runs.isCurrent(token)) { setRolling(rolled); setChain(null); }
      }
    } catch (caught) {
      if (runs.isCurrent(token)) { setRolling(null); setChain(null); fail(caught); }
    } finally {
      if (runs.isCurrent(token)) setBusy(null);
    }
  };
  const check = async (): Promise<void> => {
    if (!selected || !choice) return;
    const token = runs.begin();
    setBusy("Checking the run against the rules…");
    setError(null);
    try {
      if (needsClock && clockZone.trim()) rememberClock(choice.key, clockZone.trim());
      const evaluated = await service.propEvaluate(await resolveProfile(profileId), choice.target, needsClock ? clockZone.trim() || null : null);
      if (runs.isCurrent(token)) setResult(evaluated);
    } catch (caught) {
      if (runs.isCurrent(token)) { setResult(null); setRolling(null); setChain(null); fail(caught); }
    } finally {
      if (runs.isCurrent(token)) setBusy(null);
    }
  };

  return <section className="trl-page" aria-label="Prop-firm check">
    <header className="trl-page__header"><div><h3>Prop-firm check</h3><p>Would this backtest have broken your prop firm's rules? Enter the rules once, then check any report or saved combination against them.</p></div></header>
    <p className="trl-portfolio__caveat" role="note"><strong>Check the rules against your firm's current terms.</strong> Firm presets are copied from each firm's published rules on the date shown, and firms change their terms. Every preset becomes an ordinary profile you can edit. This checks a past run and does not predict a live challenge.</p>
    {error && <div className="trl-m0__error-wrap"><pre className="trl-m0__error" role="alert">{error}</pre><DismissButton onDismiss={() => setError(null)} /></div>}

    <section className="trl-page__surface">
      <h4>1. Rules</h4>
      {(profiles.length > 0 || presets.length > 0) && <label className="trl-m0__field">Profile
        <select value={profileId} onChange={(event) => { setProfileId(event.currentTarget.value); setResult(null); setRolling(null); setChain(null); }}>
          {profiles.length > 0 && <optgroup label="My profiles">{profiles.map((item) => <option key={item.profile_id} value={item.profile_id}>{item.rules.name} · {r2(item.rules.account_size)}</option>)}</optgroup>}
          {[...new Set(presets.map((item) => item.firm))].map((firm) => <optgroup key={firm} label={`${firm} presets (copied when you check or edit)`}>{presets.filter((item) => item.firm === firm).map((item) => <option key={item.preset_id} value={presetKey(item.preset_id)}>{item.programme} · {item.phase}</option>)}</optgroup>)}
        </select>
      </label>}
      {profiles.length === 0 && !editing && <p className="trl-m0__note">No profiles of your own yet. Pick a firm preset above, or create one with New profile….</p>}
      {profile && !editing && <ProfileSummary profile={profile} presets={presets} />}
      {selectedPreset && !editing && <ProfileSummary profile={{ profile_version: "preset", profile_id: presetKey(selectedPreset.preset_id), profile_hash: "", saved_at: selectedPreset.retrieved_at, supersedes: null, values_source: "PRESET", preset: selectedPreset, rules: { ...selectedPreset.rules, name: selectedPreset.name, account_size: runAccount ?? "—" } }} presets={presets} />}
      {!editing && <div className="trl-m0__actions">
        <button type="button" onClick={() => setEditing({ form: emptyForm(runAccount ?? ""), supersedes: null })}>New profile…</button>
        {selectedPreset && <button type="button" onClick={() => setEditing({ form: formFromPreset(selectedPreset, runAccount ?? ""), supersedes: null })}>Edit a copy…</button>}
        {profile && <button type="button" onClick={() => setEditing({ form: formFromRules(profile.rules), supersedes: profile.profile_id })}>Edit (saves a new version)…</button>}
        {profile && <button type="button" className="trl-link-button is-danger" onClick={() => void remove()}>Delete profile</button>}
      </div>}
      {selectedPreset && !editing && <p className="trl-m0__note">Checking against this preset saves a copy sized to the selected run ({runAccount ?? "no starting balance"}) under My profiles, where you can edit it.</p>}
      {editing && <ProfileEditor form={editing.form} presets={editing.supersedes ? [] : presets} onChange={(form) => setEditing({ ...editing, form })} onSave={() => void save()} onCancel={() => setEditing(null)} />}
    </section>

    <section className="trl-page__surface">
      <h4>2. What to check</h4>
      {choices.length === 0 ? <p className="trl-m0__note">No reports yet. Import one on the Data page or in the Portfolio report library.</p> : <label className="trl-m0__field">Report or saved combination
        <select value={choiceKey} onChange={(event) => { setChoiceKey(event.currentTarget.value); setResult(null); setRolling(null); setChain(null); }}>
          <optgroup label="Reports">{choices.filter((item) => item.target.kind === "DATASET").map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</optgroup>
          {combinations.length > 0 && <optgroup label="Saved combinations">{choices.filter((item) => item.target.kind === "COMBINATION").map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</optgroup>}
        </select>
      </label>}
      {choice && choice.target.kind === "DATASET" && !choice.logged && <p className="trl-m0__note">This report has no equity log, so the check sees closed trades only (an optimistic preview).</p>}
      {selected && <div className="trl-m0__scenario-fields">
        {[0, 1].map((slot) => (slot === 0 || laterPhases[0]) && <label key={slot} className="trl-m0__field">Then phase {slot + 2} (for rolling starts; optional)
          <select value={laterPhases[slot]} onChange={(event) => { const next = [...laterPhases]; next[slot] = event.currentTarget.value; if (slot === 0 && !next[0]) next[1] = ""; setLaterPhases(next); setRolling(null); setChain(null); }}>
            <option value="">none</option>
            {profiles.filter((item) => item.profile_id !== profileId).length > 0 && <optgroup label="My profiles">{profiles.filter((item) => item.profile_id !== profileId).map((item) => <option key={item.profile_id} value={item.profile_id}>{item.rules.name}</option>)}</optgroup>}
            {[...new Set(presets.map((item) => item.firm))].map((firm) => <optgroup key={firm} label={`${firm} presets`}>{presets.filter((item) => item.firm === firm && presetKey(item.preset_id) !== profileId).map((item) => <option key={item.preset_id} value={presetKey(item.preset_id)}>{item.programme} · {item.phase}</option>)}</optgroup>)}
          </select>
        </label>)}
      </div>}
      {(needsClock || chainNeedsClock) && <label className="trl-m0__field">Report server time zone (needed for the firm's reset time)
        <input list="trl-prop-zones" value={clockZone} placeholder="e.g. Europe/Athens or UTC+02:00" onChange={(event) => setClockZone(event.currentTarget.value)} />
        <datalist id="trl-prop-zones">{ZONE_SUGGESTIONS.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</datalist>
        <span className="trl-m0__note">MT5 test times are in the broker's server time. Many MT5 servers use EET with EU daylight saving (Europe/Athens). TRL remembers this for the selected report on this device.</span>
      </label>}
      <div className="trl-m0__actions">
        <button type="button" className="mod-cta" disabled={!selected || !choice || busy !== null || (needsClock && !clockZone.trim())} onClick={() => void check()}>Check against the rules</button>
        <button type="button" disabled={!selected || !choice || busy !== null || ((needsClock || chainNeedsClock) && !clockZone.trim())} title="Use every day of the run as a challenge start" onClick={() => void rollStarts()}>{phaseKeys.length > 1 ? `Rolling starts through ${phaseKeys.length} phases` : "Rolling start dates"}</button>
        {busy && <span className="trl-m0__note" role="status">{busy}</span>}
      </div>
    </section>

    {result && <PropResult result={result} />}
    {rolling && <RollingStarts result={rolling} />}
    {chain && <ChainStarts result={chain} />}
  </section>;
}

function ProfileSummary({ profile, presets }: { profile: PropProfile; presets: PropPreset[] }): React.ReactElement {
  const origin = profile.preset ?? null;
  const notModelled = origin ? presets.find((item) => item.preset_id === origin.preset_id)?.not_modelled ?? [] : [];
  const rules = profile.rules;
  const reset = rules.reset.kind === "FIRM_RESET" ? `${rules.reset.time} ${rules.reset.zone}` : "midnight, report clock";
  return <dl className="trl-prop__summary">
    <dt>Account size</dt><dd>{r2(rules.account_size)}</dd>
    <dt>Daily loss</dt><dd>{limitText(rules.daily_loss_limit, "", rules.daily_loss_basis === "START_OF_DAY_REFERENCE" ? "reference" : "account")}</dd>
    <dt>Overall loss</dt><dd>{limitText(rules.overall_loss_limit, "")}{rules.overall_loss_limit ? ` · ${rules.overall_loss_mode === "FIXED" ? "fixed" : rules.overall_loss_mode === "TRAILING" ? "trailing" : "trailing, locks at start"}` : ""}</dd>
    <dt>Profit target</dt><dd>{limitText(rules.profit_target, "")}</dd>
    <dt>Trading days</dt><dd>{rules.minimum_trading_days ?? "no minimum"}{rules.maximum_calendar_days ? ` · within ${rules.maximum_calendar_days} calendar days` : ""}</dd>
    <dt>Day reset</dt><dd>{reset}</dd>
    <dt>Trading day</dt><dd>{rules.trading_day_definition === "POSITION_OPENED" ? "a day with a position opened" : "a day with a deal opened or closed"}</dd>
    {rules.best_day_max_percent && <><dt>Best day</dt><dd>at most {rules.best_day_max_percent}% of the positive days' profit</dd></>}
    <dt>At the limit</dt><dd>{rules.limit_touch_counts === false ? "only going beyond it is a breach" : "touching it is a breach"}</dd>
    <dt>Source</dt><dd>{origin ? <>{origin.firm} preset ({origin.programme}, {origin.phase}), copied from <a href={origin.source_url}>{origin.source_url}</a> on {origin.retrieved_at}; saved {profile.saved_at.slice(0, 10)}</> : <>entered by you on {profile.saved_at.slice(0, 10)}</>}</dd>
    {notModelled.length > 0 && <><dt>Not checked</dt><dd>{notModelled.join(" ")}</dd></>}
  </dl>;
}

function LimitField({ label, kind, value, onKind, onValue, amountOnlyHint }: { label: string; kind: LimitKind; value: string; onKind: (kind: LimitKind) => void; onValue: (value: string) => void; amountOnlyHint?: string }): React.ReactElement {
  return <div className="trl-m0__field">
    <span>{label}</span>
    <span className="trl-prop__limit">
      <select value={kind} onChange={(event) => onKind(event.currentTarget.value as LimitKind)}>
        <option value="NONE">Not used</option><option value="PERCENT">Percent</option><option value="AMOUNT">Amount</option>
      </select>
      {kind !== "NONE" && <input inputMode="decimal" value={value} placeholder={kind === "PERCENT" ? "e.g. 5" : "e.g. 5000"} onChange={(event) => onValue(event.currentTarget.value)} />}
      {kind === "PERCENT" && amountOnlyHint && <span className="trl-m0__note">{amountOnlyHint}</span>}
    </span>
  </div>;
}

function ProfileEditor({ form, presets, onChange, onSave, onCancel }: { form: ProfileForm; presets: PropPreset[]; onChange: (form: ProfileForm) => void; onSave: () => void; onCancel: () => void }): React.ReactElement {
  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]): void => onChange({ ...form, [key]: value });
  const chosen = presets.find((item) => item.preset_id === form.presetId) ?? null;
  return <div className="trl-prop__editor">
    {presets.length > 0 && <label className="trl-m0__field">Start from
      <select value={form.presetId ?? ""} onChange={(event) => { const picked = presets.find((item) => item.preset_id === event.currentTarget.value); onChange(picked ? formFromPreset(picked, form.accountSize) : { ...emptyForm(form.accountSize) }); }}>
        <option value="">A blank profile</option>
        {[...new Set(presets.map((item) => item.firm))].map((firm) => <optgroup key={firm} label={firm}>{presets.filter((item) => item.firm === firm).map((item) => <option key={item.preset_id} value={item.preset_id}>{item.programme} · {item.phase}</option>)}</optgroup>)}
      </select>
      {chosen && <span className="trl-m0__note">Copied from <a href={chosen.source_url}>{chosen.source_url}</a>{chosen.source_details?.map((url, index) => <React.Fragment key={url}> and <a href={url}>detail {index + 1}</a></React.Fragment>)} on {chosen.retrieved_at}. Verify against the firm's current terms; every value below stays editable. Not checked: {chosen.not_modelled.join(" ")}</span>}
    </label>}
    <p className="trl-m0__note">Leave a rule as "Not used" if your firm does not have it. Placeholders in empty boxes are examples, not any firm's terms.</p>
    <div className="trl-m0__scenario-fields">
      <label className="trl-m0__field">Profile name<input value={form.name} placeholder="e.g. My 100k challenge, phase 1" onChange={(event) => set("name", event.currentTarget.value)} /></label>
      <label className="trl-m0__field">Account size<input inputMode="decimal" value={form.accountSize} onChange={(event) => set("accountSize", event.currentTarget.value)} /><span className="trl-m0__note">Must equal the report's starting balance (results are not rescaled).</span></label>
    </div>
    <h5>Daily loss</h5>
    <div className="trl-m0__scenario-fields">
      <LimitField label="Daily loss limit" kind={form.dailyKind} value={form.dailyValue} onKind={(value) => set("dailyKind", value)} onValue={(value) => set("dailyValue", value)} />
      {form.dailyKind === "PERCENT" && <label className="trl-m0__field">Percent of<select value={form.dailyBasis} onChange={(event) => set("dailyBasis", event.currentTarget.value as ProfileForm["dailyBasis"])}><option value="INITIAL_BALANCE">the account size</option><option value="START_OF_DAY_REFERENCE">the value at the start of each day</option></select></label>}
      {form.dailyKind !== "NONE" && <label className="trl-m0__field">A day's loss is measured from<select value={form.startReference} onChange={(event) => set("startReference", event.currentTarget.value as ProfileForm["startReference"])}><option value="HIGHER_OF_BALANCE_AND_EQUITY">the higher of balance and equity at the reset</option><option value="BALANCE">balance at the reset</option><option value="EQUITY">equity at the reset</option></select></label>}
    </div>
    <h5>Overall loss</h5>
    <div className="trl-m0__scenario-fields">
      <LimitField label="Maximum loss" kind={form.overallKind} value={form.overallValue} onKind={(value) => set("overallKind", value)} onValue={(value) => set("overallValue", value)} amountOnlyHint="of the account size" />
      {form.overallKind !== "NONE" && <label className="trl-m0__field">Floor<select value={form.overallMode} onChange={(event) => set("overallMode", event.currentTarget.value as ProfileForm["overallMode"])}><option value="FIXED">Fixed (account size minus the limit)</option><option value="TRAILING">Trailing (follows the high)</option><option value="TRAILING_LOCKS_AT_START">Trailing until it reaches the starting balance</option></select></label>}
      {form.overallKind !== "NONE" && form.overallMode !== "FIXED" && <label className="trl-m0__field">Trails the<select value={form.trailingReference} onChange={(event) => set("trailingReference", event.currentTarget.value as ProfileForm["trailingReference"])}><option value="BALANCE_HIGH">highest balance</option><option value="EQUITY_HIGH">highest equity</option><option value="END_OF_DAY_BALANCE_HIGH">highest end-of-day balance</option></select></label>}
    </div>
    <h5>Target and days</h5>
    <div className="trl-m0__scenario-fields">
      <LimitField label="Profit target" kind={form.targetKind} value={form.targetValue} onKind={(value) => set("targetKind", value)} onValue={(value) => set("targetValue", value)} amountOnlyHint="of the account size" />
      <label className="trl-m0__field">Minimum trading days<input inputMode="numeric" value={form.minimumDays} placeholder="none" onChange={(event) => set("minimumDays", event.currentTarget.value)} /><span className="trl-m0__note">A day with at least one deal opened or closed.</span></label>
      <label className="trl-m0__field">Maximum calendar days<input inputMode="numeric" value={form.maximumDays} placeholder="unlimited" onChange={(event) => set("maximumDays", event.currentTarget.value)} /></label>
      <label className="trl-m0__field">A trading day is a day with<select value={form.tradingDay} onChange={(event) => set("tradingDay", event.currentTarget.value as ProfileForm["tradingDay"])}><option value="DEAL_OPENED_OR_CLOSED">a deal opened or closed</option><option value="POSITION_OPENED">a position opened</option></select></label>
      <label className="trl-m0__field">Best day at most (% of positive days' profit)<input inputMode="decimal" value={form.bestDay} placeholder="no rule" onChange={(event) => set("bestDay", event.currentTarget.value)} /><span className="trl-m0__note">A consistency rule: you pass only once your best day is at most this share.</span></label>
    </div>
    <h5>Day reset and breaches</h5>
    <div className="trl-m0__scenario-fields">
      <label className="trl-m0__field">The day resets at<select value={form.resetKind} onChange={(event) => set("resetKind", event.currentTarget.value as ProfileForm["resetKind"])}><option value="REPORT_CLOCK_MIDNIGHT">midnight on the report's clock (broker server time)</option><option value="FIRM_RESET">a time in the firm's zone</option></select></label>
      {form.resetKind === "FIRM_RESET" && <label className="trl-m0__field">Reset time (24-hour)<input value={form.resetTime} placeholder="00:00" onChange={(event) => set("resetTime", event.currentTarget.value)} /></label>}
      {form.resetKind === "FIRM_RESET" && <label className="trl-m0__field">Firm's time zone<input list="trl-prop-firm-zones" value={form.resetZone} placeholder="e.g. Europe/Prague" onChange={(event) => set("resetZone", event.currentTarget.value)} /><datalist id="trl-prop-firm-zones">{ZONE_SUGGESTIONS.filter((zone) => !zone.value.startsWith("UTC+")).map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</datalist></label>}
      <label className="trl-m0__field">A breach is<select value={form.breachOn} onChange={(event) => set("breachOn", event.currentTarget.value as ProfileForm["breachOn"])}><option value="EQUITY_TOUCH">equity touching the limit, even while trades are open</option><option value="BALANCE_CLOSE">balance reaching the limit when trades close</option></select></label>
      <label className="trl-portfolio__include"><input type="checkbox" checked={form.touchCounts} onChange={(event) => set("touchCounts", event.currentTarget.checked)} /> Exactly reaching a limit counts as a breach (untick if your firm breaches only below the limit)</label>
    </div>
    <div className="trl-m0__actions">
      <button type="button" className="mod-cta" onClick={onSave}>Save profile</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  </div>;
}

function PropResult({ result }: { result: PropEvaluation }): React.ReactElement {
  const ccy = result.currency ?? "";
  const tone = result.verdict === "BROKEN" ? "is-broken" : result.verdict === "POSSIBLY_BROKEN" ? "is-possible" : result.evidence_level === "REALISED_ONLY" ? "is-preview" : "is-clear";
  return <section className="trl-page__surface" aria-label="Prop-firm check result">
    <h4>Result · {result.profile.name}</h4>
    <p className={`trl-prop__verdict ${tone}`} role="status"><strong>{verdictHeadline(result)}</strong><span>{EVIDENCE_TEXT[result.evidence_level]}</span></p>
    <div className="trl-kpi-row">
      {result.rules.map((rule) => {
        const breach = rule.first_breach;
        const value = breach ? (rule.verdict === "POSSIBLY_BROKEN" ? "Possibly broken" : "Broken") : `${r2(rule.tightest?.headroom)} ${ccy} to spare`;
        const detail = breach ? `${formatTimestamp(breach.time)} · reached ${r2(breach.value)} vs ${r2(breach.limit_level)}` : `closest: ${r2(rule.tightest?.headroom_percent_of_limit)}% of the limit left · ${modeText(rule)}`;
        return <KpiTile key={rule.rule} label={`${RULE_LABELS[rule.rule]} (${limitText(rule.limit, ccy, rule.basis === "START_OF_DAY_REFERENCE" ? "reference" : "account")})`} value={value} detail={detail} tone={rule.verdict === "BROKEN" ? "negative" : rule.verdict === "POSSIBLY_BROKEN" ? "warning" : "positive"} exact={breach ? breach.value : rule.tightest?.headroom ?? null} />;
      })}
      {result.profit_target && <KpiTile label={`Profit target (${r2(result.profit_target.amount)} ${ccy})`} value={result.profit_target.reached ? `Reached ${result.profit_target.day}` : "Not reached"} detail={result.profit_target.reached ? `${result.profit_target.trading_days} trading · ${result.profit_target.calendar_days} calendar days` : `needs balance ${r2(result.profit_target.level)}`} tone={result.profit_target.reached ? "positive" : "neutral"} />}
      <KpiTile label="Trading days in the run" value={String(result.trading_days.total)} detail={result.challenge?.minimum_trading_days.required ? `${result.challenge.minimum_trading_days.required} required` : "days with a deal"} />
    </div>
    {result.challenge && <p className="trl-m0__note"><strong>Challenge:</strong> {CHALLENGE_TEXT[result.challenge.outcome]}{result.challenge.pass_time ? ` (pass point ${formatTimestamp(result.challenge.pass_time)}${result.challenge.maximum_calendar_days.days_to_pass ? `, day ${result.challenge.maximum_calendar_days.days_to_pass}` : ""})` : ""}.</p>}
    <PropChart result={result} />
    {result.rules.some((rule) => rule.rule === "DAILY_LOSS") && <DailyLossChart result={result} />}
    <GuidanceBlock guidance={propGuidance(result)} />
    <AuditTrail items={[
      ["Profile", <><code>{result.profile.profile_id}</code> · hash <code>{result.profile.profile_hash.slice(0, 16)}…</code> · entered {result.profile.saved_at}</>],
      ["Checked", result.target.kind === "DATASET" ? <code>{result.target.dataset_ref}</code> : <>combination <code>{result.target.combination_id}</code>, capital {result.target.starting_capital}</>],
      ["Day boundary", <><code>{result.day_boundary.version}</code> · {plain(result.day_boundary.kind)}{result.day_boundary.zone ? ` ${result.day_boundary.time} ${result.day_boundary.zone}; report clock ${result.day_boundary.report_clock_zone}` : ""}</>],
      ["Evidence", <code>{result.evidence_level}</code>],
      ["Calculation", <code>{result.calculation_version}</code>],
      ["Findings", result.findings.map((item) => item.code).join(", ") || "none"],
      ["Notes", plainSentence(result.warnings.join(" "))],
    ]} />
  </section>;
}

function PropChart({ result }: { result: PropEvaluation }): React.ReactElement | null {
  const [withFloor, setWithFloor] = useState(true);
  const geometry = useMemo(() => propChartGeometry(result, withFloor), [result, withFloor]);
  const [active, setActive] = useState<number | null>(null);
  if (geometry === null) return <p className="trl-m0__note">Not enough samples to draw a chart.</p>;
  const ccy = result.currency ?? "";
  const series = result.series;
  const point = active === null ? null : series[active] ?? null;
  const x = active === null ? 0 : (active / (series.length - 1)) * 100;
  const equityBased = result.evidence_level !== "REALISED_ONLY";
  return <ChartFrame title="Equity against the overall-loss floor">
    <figure className="trl-balance-chart trl-prop-chart">
      <div className="trl-balance-chart__body">
        <div className="trl-balance-chart__y-axis" aria-hidden="true"><span>{geometry.top.toFixed(2)}</span><span>{geometry.bottom.toFixed(2)}</span></div>
        <div className="trl-balance-chart__plot" role="img" aria-label={`Balance${equityBased ? ", equity and lowest equity" : ""}${geometry.floor ? " with the overall-loss floor" : ""}, from ${formatTimestamp(series[0]!.time)} to ${formatTimestamp(series.at(-1)!.time)}.`}
          onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width > 0) setActive(nearestIndex((event.clientX - bounds.left) / bounds.width, series.length)); }}
          onPointerLeave={() => setActive(null)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {equityBased && <polyline className="trl-prop__low" points={geometry.low} vectorEffect="non-scaling-stroke" />}
            {equityBased && <polyline className="trl-equity__equity" points={geometry.equity} vectorEffect="non-scaling-stroke" />}
            <polyline className="trl-equity__balance" points={geometry.balance} vectorEffect="non-scaling-stroke" />
            {geometry.floor && <polyline className="trl-prop__floor" points={geometry.floor} vectorEffect="non-scaling-stroke" />}
          </svg>
          {geometry.markers.map((marker) => <span key={marker.rule} className="trl-prop__marker" style={{ left: `${marker.x}%` }} title={`${marker.rule === "DAILY_LOSS" ? "Daily" : "Overall"} rule first broken ${formatTimestamp(marker.time)}`} />)}
          {point && <>
            <span className="trl-balance-chart__guide" style={{ left: `${x}%` }} />
            <span className={`trl-balance-chart__tooltip${x > 60 ? " is-left" : ""}`} style={{ left: `${x}%` }} role="status">
              <strong>{formatTimestamp(point.time)}</strong>
              <span>Balance {money(point.balance)} {ccy}</span>
              {equityBased && <span>Equity {money(point.equity)} · lowest {money(point.low)}</span>}
              {point.floor !== null && <span>Floor {money(point.floor)}</span>}
            </span>
          </>}
        </div>
      </div>
      <div className="trl-balance-chart__x-axis" aria-hidden="true"><span>{formatTimestamp(series[0]!.time)}</span><span>{formatTimestamp(series.at(-1)!.time)}</span></div>
      <figcaption className="trl-m0__note">
        <span className="trl-equity__key is-balance" /> Balance {equityBased && <><span className="trl-equity__key is-equity" /> Equity <span className="trl-prop__key is-low" /> Lowest equity{result.evidence_level === "PORTFOLIO_CONSERVATIVE" ? " (conservative)" : ""} </>}
        {geometry.floor && <><span className="trl-prop__key is-floor" /> Overall-loss floor </>}
        {geometry.markers.length > 0 && <><span className="trl-prop__key is-marker" /> first breach</>}
        {result.series[0]?.floor != null && <label className="trl-mc-fan__toggle"><input type="checkbox" checked={!withFloor} onChange={() => setWithFloor(!withFloor)} /> zoom to balance and equity (hides the floor)</label>}
      </figcaption>
    </figure>
  </ChartFrame>;
}

function DailyLossChart({ result }: { result: PropEvaluation }): React.ReactElement {
  const [active, setActive] = useState<number | null>(null);
  const days = result.daily;
  const ccy = result.currency ?? "";
  const day = active === null ? null : days[active] ?? null;
  return <ChartFrame title="Daily loss against the daily limit">
    <figure className="trl-prop-daily">
      <div className="trl-prop-daily__plot" role="img" aria-label={`Each day's loss as a share of its limit, ${days.length} days. The line marks the limit.`}
        onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width > 0) setActive(slotIndex((event.clientX - bounds.left) / bounds.width, days.length)); }}
        onPointerLeave={() => setActive(null)}>
        <span className="trl-prop-daily__limit" style={{ bottom: `${100 / 1.2}%` }} />
        {days.map((row, index) => <span key={row.date} className={`trl-prop-daily__bar${row.broken ? " is-broken" : ""}${index === active ? " is-active" : ""}`} style={{ height: `${limitUsedPercent(row.headroom_percent_of_limit) / 1.2}%` }} />)}
        {day && <span className={`trl-balance-chart__tooltip${(active ?? 0) / days.length > 0.6 ? " is-left" : ""}`} style={{ left: `${(((active ?? 0) + 0.5) / days.length) * 100}%` }} role="status">
          <strong>{day.date}</strong>
          <span>Loss {r2(day.loss)} of {r2(day.limit)} {ccy}</span>
          <span>From {r2(day.reference)} down to {r2(day.lowest)}</span>
          {day.lowest_at && <span>Lowest at {formatTimestamp(day.lowest_at)}</span>}
        </span>}
      </div>
      <div className="trl-balance-chart__x-axis" aria-hidden="true"><span>{days[0]?.date}</span><span>{days.at(-1)?.date}</span></div>
      <figcaption className="trl-m0__note">Bar height = the share of that day's limit used; the line is the limit. Red bars broke it. Hover a bar for the day's figures.</figcaption>
    </figure>
  </ChartFrame>;
}

function RollingStarts({ result }: { result: PropRolling }): React.ReactElement {
  const [active, setActive] = useState<number | null>(null);
  const summary = result.summary;
  const starts = result.starts;
  const item = active === null ? null : starts[active] ?? null;
  const count = (key: keyof typeof ROLLING_LABEL): number => summary.counts[key] ?? 0;
  const success = result.mode === "SURVIVAL" ? "SURVIVED" : "PASSED";
  return <section className="trl-page__surface" aria-label="Rolling start dates">
    <h4>Rolling start dates · {result.profile.name}</h4>
    <div className="trl-kpi-row">
      <KpiTile label={result.mode === "SURVIVAL" ? `Survived ${result.horizon_days} days` : "Passed"} value={summary.success_share_percent === null ? "—" : `${r2(summary.success_share_percent)}%`} detail={`${count(success)} of ${summary.decided} decided starts`} tone={count(success) > 0 ? "positive" : "neutral"} exact={summary.success_share_percent} />
      <KpiTile label="Broken" value={String(count("BROKEN") + count("POSSIBLY_BROKEN"))} detail={count("POSSIBLY_BROKEN") ? `${count("POSSIBLY_BROKEN")} only on the conservative bound` : summary.days_to_breach ? `median ${summary.days_to_breach.median} days` : "no start broke a rule"} tone={count("BROKEN") ? "negative" : "neutral"} />
      {result.mode === "CHALLENGE" && <KpiTile label="Days to pass" value={summary.days_to_pass ? String(summary.days_to_pass.median) : "—"} detail={summary.days_to_pass ? `median; ${summary.days_to_pass.minimum}–${summary.days_to_pass.maximum}` : "no start passed"} />}
      <KpiTile label="Did not finish" value={String(count("NOT_DECIDED") + count("OUT_OF_TIME"))} detail={`${count("OUT_OF_TIME")} out of time (count as not passed) · ${count("NOT_DECIDED")} ran out of data (left out of the share)`} />
    </div>
    <ChartFrame title="Outcome by start day">
      <figure className="trl-prop-rolling">
        <div className="trl-prop-rolling__strip" role="img" aria-label={`Outcome for each of ${starts.length} start days, from ${starts[0]?.start_day} to ${starts.at(-1)?.start_day}.`}
          onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width > 0) setActive(slotIndex((event.clientX - bounds.left) / bounds.width, starts.length)); }}
          onPointerLeave={() => setActive(null)}>
          {starts.map((start, index) => <span key={start.start_day} className={`trl-prop-rolling__cell is-${start.outcome.toLowerCase().replace(/_/g, "-")}${index === active ? " is-active" : ""}`} />)}
          {item && <span className={`trl-balance-chart__tooltip${(active ?? 0) / starts.length > 0.6 ? " is-left" : ""}`} style={{ left: `${(((active ?? 0) + 0.5) / starts.length) * 100}%` }} role="status">
            <strong>Start {item.start_day}</strong>
            <span>{ROLLING_LABEL[item.outcome]}{item.rule ? ` (${RULE_LABELS[item.rule].toLowerCase()})` : ""}</span>
            {item.decided_at && <span>{formatTimestamp(item.decided_at)} · day {item.calendar_days}</span>}
            {item.open_at_start && <span>Started with open positions</span>}
          </span>}
        </div>
        <div className="trl-balance-chart__x-axis" aria-hidden="true"><span>{starts[0]?.start_day}</span><span>{starts.at(-1)?.start_day}</span></div>
        <figcaption className="trl-m0__note">
          {(Object.keys(ROLLING_LABEL) as Array<keyof typeof ROLLING_LABEL>).filter((key) => count(key) > 0).map((key) => <React.Fragment key={key}><span className={`trl-prop-rolling__key is-${key.toLowerCase().replace(/_/g, "-")}`} /> {ROLLING_LABEL[key]} ({count(key)}) </React.Fragment>)}
          · Hover a day for its outcome.
        </figcaption>
      </figure>
    </ChartFrame>
    <GuidanceBlock guidance={rollingGuidance(result)} />
    <AuditTrail items={[["Calculation", <code>{result.calculation_version}</code>], ["Profile", <code>{result.profile.profile_id}</code>], ["Evidence", <code>{result.evidence_level}</code>], ["Horizon", result.horizon_days === null ? "none (until pass, breach, or the end of the data)" : `${result.horizon_days} calendar days`], ["Findings", result.findings.map((finding) => finding.code).join(", ") || "none"]]} />
  </section>;
}

function ChainStarts({ result }: { result: PropChain }): React.ReactElement {
  const [active, setActive] = useState<number | null>(null);
  const summary = result.summary;
  const starts = result.starts;
  const item = active === null ? null : starts[active] ?? null;
  const count = (key: keyof typeof CHAIN_LABEL): number => summary.counts[key] ?? 0;
  return <section className="trl-page__surface" aria-label="Challenge chain from every start day">
    <h4>Challenge chain · {result.profiles.map((profile) => profile.name).join(" → ")}</h4>
    <div className="trl-kpi-row">
      <KpiTile label="Completed every phase" value={summary.completed_share_percent === null ? "—" : `${r2(summary.completed_share_percent)}%`} detail={`${count("COMPLETED")} of ${summary.decided} decided starts`} tone={count("COMPLETED") > 0 ? "positive" : "neutral"} exact={summary.completed_share_percent} />
      {result.profiles.map((profile, index) => <KpiTile key={profile.profile_id} label={`Failed in phase ${index + 1}`} value={String(summary.failed_by_phase[String(index + 1)] ?? 0)} detail={profile.name} tone={(summary.failed_by_phase[String(index + 1)] ?? 0) > 0 ? "negative" : "neutral"} />)}
      <KpiTile label="Days to complete" value={summary.days_to_complete ? String(summary.days_to_complete.median) : "—"} detail={summary.days_to_complete ? `median; ${summary.days_to_complete.minimum}–${summary.days_to_complete.maximum}` : `${count("NOT_DECIDED")} not decided`} />
    </div>
    <ChartFrame title="Final outcome by start day">
      <figure className="trl-prop-rolling">
        <div className="trl-prop-rolling__strip" role="img" aria-label={`Final outcome for each of ${starts.length} start days.`}
          onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width > 0) setActive(slotIndex((event.clientX - bounds.left) / bounds.width, starts.length)); }}
          onPointerLeave={() => setActive(null)}>
          {starts.map((start, index) => <span key={start.start_day} className={`trl-prop-rolling__cell is-${start.outcome === "COMPLETED" ? "passed" : start.outcome === "FAILED" ? "broken" : start.outcome === "POSSIBLY_FAILED" ? "possibly-broken" : "not-decided"}${index === active ? " is-active" : ""}`} />)}
          {item && <span className={`trl-balance-chart__tooltip${(active ?? 0) / starts.length > 0.6 ? " is-left" : ""}`} style={{ left: `${(((active ?? 0) + 0.5) / starts.length) * 100}%` }} role="status">
            <strong>Start {item.start_day}: {CHAIN_LABEL[item.outcome]}</strong>
            {item.phases.map((phase) => <span key={phase.phase}>Phase {phase.phase}: {ROLLING_LABEL[phase.outcome]}{phase.rule ? ` (${RULE_LABELS[phase.rule].toLowerCase()})` : ""}{phase.decided_day ? ` · ${phase.decided_day}` : ""}</span>)}
          </span>}
        </div>
        <div className="trl-balance-chart__x-axis" aria-hidden="true"><span>{starts[0]?.start_day}</span><span>{starts.at(-1)?.start_day}</span></div>
        <figcaption className="trl-m0__note">Green: completed every phase · red: failed a phase · orange: possibly failed (portfolio worst case) · grey: the data ended first. Hover a day for each phase.</figcaption>
      </figure>
    </ChartFrame>
    <GuidanceBlock guidance={chainGuidance(result)} />
    <AuditTrail items={[["Calculation", <code>{result.calculation_version}</code>], ["Phases", result.profiles.map((profile, index) => `${index + 1}. ${profile.name} (${profile.profile_id})`).join(" · ")], ["Evidence", <code>{result.evidence_level}</code>]]} />
  </section>;
}
