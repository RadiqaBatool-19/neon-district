import { create } from 'zustand';
import type { CityEvent, CityEventKind } from '../data/cyberpunk/citySimulation';
import type { QualityLevel } from '../data/cyberpunk/config';
import type { DistrictId } from '../data/cyberpunk/districts';
import type { DataLens } from '../data/cyberpunk/simulatedMetrics';
import type { WeatherPreset } from '../data/cyberpunk/weather';
import { prefersReducedMotion } from '../utils/webgl';

export type CyberPhase = 'loading' | 'intro' | 'explore';
/** orbit: cinematic orbit around a target · fly: drone, look from the camera · walk: street level. */
export type CameraMode = 'orbit' | 'fly' | 'walk';
export type Density = 'low' | 'normal' | 'heavy';
export type TimeSpeed = 'slow' | 'normal' | 'fast';

export const DENSITY_FACTOR: Record<Density, number> = { low: 0.35, normal: 0.65, heavy: 1 };
/** Simulated hours per real second. */
export const TIME_SPEED_RATE: Record<TimeSpeed, number> = { slow: 24 / (24 * 60), normal: 24 / (6 * 60), fast: 24 / 90 };

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

export const DEFAULT_HOUR = 21.5;

/**
 * Live clock, written by the render loop. `target` is where time is heading
 * (set by the slider / presets / auto cycle); `hour` eases toward it so jumps
 * become smooth transitions. Kept out of React state to avoid per-frame renders.
 */
export const cityClock = { hour: DEFAULT_HOUR, target: DEFAULT_HOUR };

/** Movement keys held on the on-screen touch pad (same names as keyboard keys: w a s d q e). */
export const touchKeys = new Set<string>();

interface CyberState {
  phase: CyberPhase;
  quality: QualityLevel;
  /** True until the user picks a quality level; while true the scene may step down on low FPS. */
  autoQuality: boolean;
  reducedEffects: boolean;
  layers: CyberLayers;
  dataLens: DataLens;
  particles: boolean;
  // Time of day.
  timeAuto: boolean;
  timeSpeed: TimeSpeed;
  // Weather.
  weather: WeatherPreset;
  /** 0..1, 0.5 = preset as designed. Scales rain amount and fog. */
  weatherIntensity: number;
  lightningFlashes: boolean;
  // Activity.
  trafficDensity: Density;
  flyerDensity: Density;
  /** 0..1, 0.5 = typical. */
  cityActivity: number;
  events: CityEvent[];
  // Camera.
  cameraMode: CameraMode;
  /** Movement speed multiplier for keyboard / touch movement. */
  moveSpeed: number;
  pointerLocked: boolean;
  /** Incremented to ask the camera rig to enter pointer lock (must run inside a click handler). */
  lockRequest: number;
  hoveredId: number | null;
  selectedId: number | null;
  activeDistrict: DistrictId | null;
  cameraRequest: CameraRequest | null;
  setPhase: (p: CyberPhase) => void;
  setQuality: (q: QualityLevel, auto?: boolean) => void;
  setReducedEffects: (v: boolean) => void;
  toggleLayer: (k: keyof CyberLayers) => void;
  setDataLens: (l: DataLens) => void;
  setParticles: (v: boolean) => void;
  setTime: (hour: number) => void;
  setTimeAuto: (v: boolean) => void;
  setTimeSpeed: (v: TimeSpeed) => void;
  setWeather: (w: WeatherPreset) => void;
  setWeatherIntensity: (v: number) => void;
  setLightningFlashes: (v: boolean) => void;
  setTrafficDensity: (d: Density) => void;
  setFlyerDensity: (d: Density) => void;
  setCityActivity: (v: number) => void;
  triggerEvent: (kind: CityEventKind, district: DistrictId) => void;
  clearEvent: (id: number) => void;
  clearEvents: () => void;
  setCameraMode: (m: CameraMode) => void;
  setMoveSpeed: (v: number) => void;
  setPointerLocked: (v: boolean) => void;
  requestPointerLock: () => void;
  setHovered: (id: number | null) => void;
  select: (id: number | null) => void;
  flyToDistrict: (id: DistrictId) => void;
  resetView: () => void;
  reset: () => void;
}

let nonce = 0;
let eventId = 0;

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
  particles: true,
  timeAuto: false,
  timeSpeed: 'normal' as TimeSpeed,
  weather: 'lightRain' as WeatherPreset,
  weatherIntensity: 0.5,
  // Lightning is a flashing effect: off by default for users who prefer reduced motion.
  lightningFlashes: !prefersReducedMotion(),
  trafficDensity: 'normal' as Density,
  flyerDensity: 'normal' as Density,
  cityActivity: 0.5,
  events: [] as CityEvent[],
  cameraMode: 'orbit' as CameraMode,
  moveSpeed: 1,
  pointerLocked: false,
  lockRequest: 0,
  hoveredId: null,
  selectedId: null,
  activeDistrict: null,
  cameraRequest: null,
});

export const useCyberStore = create<CyberState>()((set, get) => ({
  ...initial(),
  setPhase: (phase) => set({ phase }),
  setQuality: (quality, auto = false) => set((s) => ({ quality, autoQuality: auto ? s.autoQuality : false })),
  setReducedEffects: (reducedEffects) => set({ reducedEffects }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setDataLens: (dataLens) => set({ dataLens }),
  setParticles: (particles) => set({ particles }),
  setTime: (hour) => {
    cityClock.target = ((hour % 24) + 24) % 24;
  },
  setTimeAuto: (timeAuto) => set({ timeAuto }),
  setTimeSpeed: (timeSpeed) => set({ timeSpeed }),
  setWeather: (weather) => set({ weather }),
  setWeatherIntensity: (weatherIntensity) => set({ weatherIntensity }),
  setLightningFlashes: (lightningFlashes) => set({ lightningFlashes }),
  setTrafficDensity: (trafficDensity) => set({ trafficDensity }),
  setFlyerDensity: (flyerDensity) => set({ flyerDensity }),
  setCityActivity: (cityActivity) => set({ cityActivity }),
  triggerEvent: (kind, district) => {
    // One event of each kind per district; re-triggering restarts it.
    const rest = get().events.filter((e) => !(e.kind === kind && e.district === district));
    set({ events: [...rest, { id: ++eventId, kind, district, startedAt: performance.now() }] });
  },
  clearEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
  clearEvents: () => set({ events: [] }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setMoveSpeed: (moveSpeed) => set({ moveSpeed }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  requestPointerLock: () => set((s) => ({ lockRequest: s.lockRequest + 1 })),
  setHovered: (hoveredId) => set({ hoveredId }),
  // Street-level modes keep the camera where it is; the panel still opens.
  select: (selectedId) =>
    set((s) =>
      selectedId === null || s.cameraMode !== 'orbit'
        ? { selectedId }
        : { selectedId, cameraRequest: { kind: 'building', id: selectedId, nonce: ++nonce } },
    ),
  flyToDistrict: (id) => set({ activeDistrict: id, selectedId: null, cameraRequest: { kind: 'district', id, nonce: ++nonce } }),
  // Reset always returns to the cinematic orbit overview.
  resetView: () => set({ cameraMode: 'orbit', activeDistrict: null, selectedId: null, cameraRequest: { kind: 'reset', nonce: ++nonce } }),
  /** Called on route unmount so a revisit starts clean. */
  reset: () => {
    cityClock.hour = cityClock.target = DEFAULT_HOUR;
    set(initial());
  },
}));
