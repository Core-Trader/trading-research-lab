import { LAYOUT_SCHEMA, readLayoutSettings, type LayoutSettings, type SurfaceLayout } from "./layout-model.ts";

/** Saved layouts for every surface; the plugin persists them in its settings (data.json). */
export class LayoutStore {
  private settings: LayoutSettings;
  private readonly listeners = new Set<() => void>();
  private readonly persist: (settings: LayoutSettings) => Promise<void>;

  constructor(initial: unknown, persist: (settings: LayoutSettings) => Promise<void>) {
    this.settings = readLayoutSettings(initial);
    this.persist = persist;
  }

  get snapshot(): LayoutSettings { return this.settings; }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Saves a surface's layout; null returns it to the default. */
  set(surface: string, layout: SurfaceLayout | null): void {
    const surfaces = { ...this.settings.surfaces };
    if (layout === null) delete surfaces[surface];
    else surfaces[surface] = layout;
    this.settings = { schema: LAYOUT_SCHEMA, surfaces };
    this.listeners.forEach((listener) => listener());
    void this.persist(this.settings).catch(() => undefined);  // the layout still applies for this session
  }
}
