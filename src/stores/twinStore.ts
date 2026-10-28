import { create } from 'zustand';
import type { HeightSource } from '../data/digital-twin/types';

export type ColorBy = 'type' | 'height' | 'heightSource' | 'energy' | 'temperature' | 'air';
export type SurfaceOverlay = 'none' | 'temperature' | 'air';
export type MeasureTool = 'none' | 'distance' | 'area' | 'probe';
export type Selection = { kind: 'building'; index: number } | { kind: 'road'; index: number } | null;

export interface TwinLayers {
  buildings: boolean;
  roads: boolean;
  landuse: boolean;
  terrain: boolean;
  labels: boolean;
}

export interface TwinFilters {
  /** Building types to show; null = all. */
  types: string[] | null;
  heightMin: number;
  heightMax: number;
  sources: Record<HeightSource, boolean>;
}

/** `focus` targets `buildingIndex` when given, otherwise the current single selection. */
export type TwinCameraRequest = { kind: 'reset' | 'top' | 'focus'; nonce: number; buildingIndex?: number };

/** Upper bound on compared buildings, so the table stays readable. */
export const MAX_COMPARE = 8;

/** A measured point: world (region) coordinates + ground-truth lon/lat. */
export interface MeasurePoint {
  x: number;
  y: number;
  z: number;
  lon: number;
  lat: number;
  /** Elevation above sea level (m, EGM2008) when known. */
  elevation: number | null;
}

interface TwinState {
  layers: TwinLayers;
  colorBy: ColorBy;
  surface: SurfaceOverlay;
  markEstimated: boolean;
  exaggeration: number;
  filters: TwinFilters;
  hovered: number | null;
  selection: Selection;
  tool: MeasureTool;
  points: MeasurePoint[];
  closed: boolean;
  cameraRequest: TwinCameraRequest | null;
  /**
   * Buildings in the comparison, by stable OSM id (e.g. "way/472380415"), in
   * the order they were added. Separate from the single `selection`.
   */
  compareIds: string[];
  /** While on, clicking a building adds / removes it instead of inspecting it. */
  compareMode: boolean;
  compareOpen: boolean;
  /** Building highlighted from the UI (e.g. hovering a comparison column), shown like a hover. */
  located: number | null;
  toggleLayer: (k: keyof TwinLayers) => void;
  setColorBy: (c: ColorBy) => void;
  setSurface: (s: SurfaceOverlay) => void;
  setMarkEstimated: (v: boolean) => void;
  setExaggeration: (v: number) => void;
  setFilters: (f: Partial<TwinFilters>) => void;
  resetFilters: (maxHeight: number) => void;
  setHovered: (i: number | null) => void;
  select: (s: Selection) => void;
  setTool: (t: MeasureTool) => void;
  addPoint: (p: MeasurePoint) => void;
  closeShape: () => void;
  clearMeasure: () => void;
  requestCamera: (kind: TwinCameraRequest['kind']) => void;
  focusBuilding: (index: number) => void;
  /** Adds the id if absent, removes it if present. Returns false if the limit blocked an add. */
  toggleCompare: (osmId: string) => boolean;
  removeCompare: (osmId: string) => void;
  clearCompare: () => void;
  setCompareMode: (v: boolean) => void;
  setCompareOpen: (v: boolean) => void;
  setLocated: (index: number | null) => void;
  reset: () => void;
}

let nonce = 0;

const initial = () => ({
  layers: { buildings: true, roads: true, landuse: true, terrain: true, labels: true },
  colorBy: 'type' as ColorBy,
  surface: 'none' as SurfaceOverlay,
  markEstimated: true,
  exaggeration: 1,
  filters: { types: null, heightMin: 0, heightMax: 1000, sources: { recorded: true, estimated_from_levels: true, estimated_default: true } } as TwinFilters,
  hovered: null,
  selection: null as Selection,
  tool: 'none' as MeasureTool,
  points: [] as MeasurePoint[],
  closed: false,
  cameraRequest: null,
  compareIds: [] as string[],
  compareMode: false,
  compareOpen: false,
  located: null as number | null,
});

export const useTwinStore = create<TwinState>()((set, get) => ({
  ...initial(),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setColorBy: (colorBy) => set({ colorBy }),
  setSurface: (surface) => set({ surface }),
  setMarkEstimated: (markEstimated) => set({ markEstimated }),
  setExaggeration: (exaggeration) => set({ exaggeration }),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: (maxHeight) => set({ filters: { types: null, heightMin: 0, heightMax: Math.ceil(maxHeight), sources: { recorded: true, estimated_from_levels: true, estimated_default: true } } }),
  setHovered: (hovered) => set({ hovered }),
  select: (selection) => set({ selection }),
  // Measuring and compare-picking both use clicks, so choosing a measure tool leaves compare mode.
  setTool: (tool) => set((s) => ({ tool, points: [], closed: false, selection: null, compareMode: tool === 'none' ? s.compareMode : false })),
  addPoint: (p) => set((s) => (s.closed ? { points: [p], closed: false } : { points: s.tool === 'probe' ? [p] : [...s.points, p] })),
  closeShape: () => set((s) => (s.points.length >= 3 ? { closed: true } : {})),
  clearMeasure: () => set({ points: [], closed: false }),
  requestCamera: (kind) => set({ cameraRequest: { kind, nonce: ++nonce } }),
  focusBuilding: (buildingIndex) => set({ cameraRequest: { kind: 'focus', nonce: ++nonce, buildingIndex } }),
  toggleCompare: (osmId) => {
    if (!osmId) return false;
    const ids = get().compareIds;
    if (ids.includes(osmId)) {
      set({ compareIds: ids.filter((id) => id !== osmId) });
      return true;
    }
    if (ids.length >= MAX_COMPARE) return false;
    set({ compareIds: [...ids, osmId] });
    return true;
  },
  // Removing a column unmounts it before mouseleave fires, so clear the located highlight here.
  removeCompare: (osmId) => set((s) => ({ compareIds: s.compareIds.filter((id) => id !== osmId), located: null })),
  clearCompare: () => set({ compareIds: [], compareOpen: false, located: null }),
  setCompareMode: (compareMode) => set((s) => (compareMode ? { compareMode, tool: 'none', points: [], closed: false } : { compareMode, tool: s.tool })),
  setCompareOpen: (compareOpen) => set(compareOpen ? { compareOpen } : { compareOpen, located: null }),
  setLocated: (located) => set({ located }),
  reset: () => set(initial()),
}));
