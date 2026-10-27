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

export type TwinCameraRequest = { kind: 'reset' | 'top' | 'focus'; nonce: number };

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
});

export const useTwinStore = create<TwinState>()((set) => ({
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
  setTool: (tool) => set({ tool, points: [], closed: false, selection: null }),
  addPoint: (p) => set((s) => (s.closed ? { points: [p], closed: false } : { points: s.tool === 'probe' ? [p] : [...s.points, p] })),
  closeShape: () => set((s) => (s.points.length >= 3 ? { closed: true } : {})),
  clearMeasure: () => set({ points: [], closed: false }),
  requestCamera: (kind) => set({ cameraRequest: { kind, nonce: ++nonce } }),
  reset: () => set(initial()),
}));
