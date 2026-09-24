import { createContext, useContext, useSyncExternalStore } from "react";
import { DEFAULT_THRESHOLDS, type ResearchThresholds, type ThresholdStore } from "../application/research-settings";

/** The user's own thresholds (minimum trades, confidence level), shared by every page. */
export const ThresholdContext = createContext<ThresholdStore | null>(null);

const none = { subscribe: () => () => undefined };

export function useThresholds(): [ResearchThresholds, (next: Partial<ResearchThresholds>) => void] {
  const store = useContext(ThresholdContext);
  const value = useSyncExternalStore(store?.subscribe ?? none.subscribe, () => store?.snapshot ?? DEFAULT_THRESHOLDS);
  return [value, (next) => store?.set(next)];
}
