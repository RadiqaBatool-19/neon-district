import { create } from 'zustand';
import type { QualityLevel } from '../data/cyberpunk/config';
import type { DistrictId } from '../data/cyberpunk/districts';
import type { DataLens } from '../data/cyberpunk/simulatedMetrics';

export type CyberPhase = 'loading' | 'intro' | 'explore';
export type CameraMode = 'orbit' | 'free';

export interface CyberLayers {
  buildings: boolean;
  roads: boolean;
  traffic: boolean;
  flying: boolean;
  signage: boolean;
}

export type CameraRequest =
  | { kind: 'reset'; nonce: number }
  | { kind: 'district'; id: DistrictId; nonce: number }
  | { kind: 'building'; id: number; nonce: number };

interface CyberState {
  phase: CyberPhase;
  quality: QualityLevel;
  /** True until the user picks a quality level; while true the scene may step down on low FPS. */
  autoQuality: boolean;
  reducedEffects: boolean;
  layers: CyberLayers;
  dataLens: DataLens;
  rain: boolean;
  rainIntensity: number;
  particles: boolean;
  /** 0 = dusk, 1 = deep night. */
  nightLevel: number;
  cameraMode: CameraMode;
  hoveredId: number | null;
  selectedId: number | null;
  activeDistrict: DistrictId | null;
  cameraRequest: CameraRequest | null;
  setPhase: (p: CyberPhase) => void;
  setQuality: (q: QualityLevel, auto?: boolean) => void;
  setReducedEffects: (v: boolean) => void;
  toggleLayer: (k: keyof CyberLayers) => void;
  setDataLens: (l: DataLens) => void;
  setRain: (v: boolean) => void;
  setRainIntensity: (v: number) => void;
  setParticles: (v: boolean) => void;
  setNightLevel: (v: number) => void;
  setCameraMode: (m: CameraMode) => void;
  setHovered: (id: number | null) => void;
  select: (id: number | null) => void;
  flyToDistrict: (id: DistrictId) => void;
  resetView: () => void;
  reset: () => void;
}

let nonce = 0;

function defaultQuality(): QualityLevel {
  if (typeof navigator === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency ?? 4;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobile || cores <= 4) return 'low';
  return 'medium';
}

const initial = () => ({
  phase: 'loading' as CyberPhase,
  quality: defaultQuality(),
  autoQuality: true,
  reducedEffects: false,
  layers: { buildings: true, roads: true, traffic: true, flying: true, signage: true },
  dataLens: 'none' as DataLens,
  rain: true,
  rainIntensity: 0.45,
  particles: true,
  nightLevel: 0.75,
  cameraMode: 'orbit' as CameraMode,
  hoveredId: null,
  selectedId: null,
  activeDistrict: null,
  cameraRequest: null,
});

export const useCyberStore = create<CyberState>()((set) => ({
  ...initial(),
  setPhase: (phase) => set({ phase }),
  setQuality: (quality, auto = false) => set((s) => ({ quality, autoQuality: auto ? s.autoQuality : false })),
  setReducedEffects: (reducedEffects) => set({ reducedEffects }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setDataLens: (dataLens) => set({ dataLens }),
  setRain: (rain) => set({ rain }),
  setRainIntensity: (rainIntensity) => set({ rainIntensity }),
  setParticles: (particles) => set({ particles }),
  setNightLevel: (nightLevel) => set({ nightLevel }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setHovered: (hoveredId) => set({ hoveredId }),
  select: (selectedId) =>
    set(selectedId === null ? { selectedId } : { selectedId, cameraRequest: { kind: 'building', id: selectedId, nonce: ++nonce } }),
  flyToDistrict: (id) => set({ activeDistrict: id, selectedId: null, cameraRequest: { kind: 'district', id, nonce: ++nonce } }),
  resetView: () => set({ activeDistrict: null, selectedId: null, cameraRequest: { kind: 'reset', nonce: ++nonce } }),
  /** Called on route unmount so a revisit starts clean. */
  reset: () => set(initial()),
}));
