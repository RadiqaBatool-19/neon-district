/** Tunable parameters for the procedural city. Everything here is safe to tweak. */
export const CITY = {
  seed: 20771,
  /** Blocks per side. Must be odd so a block sits at the exact centre (the plaza). */
  gridSize: 11,
  /** Block footprint (m), including sidewalk. */
  blockSize: 56,
  /** Street width between blocks (m). */
  streetWidth: 16,
  sidewalk: 3,
  floorHeight: 3.6,
  /** Highways: elevated loop around the core, plus one straight crossing. */
  highwayLoopHalf: 180,
  highwayLoopHeight: 22,
  highwayCrossZ: 108,
  highwayCrossHeight: 34,
} as const;

/** Length of the optional cinematic intro flight (s). */
export const INTRO_DURATION = 7.5;

export const PITCH = CITY.blockSize + CITY.streetWidth;
export const HALF_GRID = (CITY.gridSize - 1) / 2;
export const CITY_HALF_EXTENT = (CITY.gridSize * PITCH) / 2;

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  dpr: [number, number];
  cars: number;
  highwayCars: number;
  flyers: number;
  rainDrops: number;
  particles: number;
  shadows: boolean;
  multisampling: number;
  bloomLevels: number;
  chromatic: boolean;
  streetGlowDecals: boolean;
  roofDetail: number; // 0..1 fraction of rooftop props kept
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: { dpr: [0.75, 1], cars: 70, highwayCars: 30, flyers: 10, rainDrops: 5000, particles: 150, shadows: false, multisampling: 0, bloomLevels: 5, chromatic: false, streetGlowDecals: true, roofDetail: 0.45 },
  medium: { dpr: [1, 1.25], cars: 150, highwayCars: 60, flyers: 22, rainDrops: 12000, particles: 350, shadows: false, multisampling: 2, bloomLevels: 7, chromatic: false, streetGlowDecals: true, roofDetail: 0.8 },
  high: { dpr: [1, 1.5], cars: 240, highwayCars: 90, flyers: 34, rainDrops: 22000, particles: 600, shadows: true, multisampling: 4, bloomLevels: 8, chromatic: true, streetGlowDecals: true, roofDetail: 1 },
};

/** Palette shared by the cyberpunk scene and its UI. */
export const NEON = {
  cyan: '#3ef0ff',
  blue: '#2b7bff',
  violet: '#8b5cff',
  magenta: '#ff2bd6',
  pink: '#ff4f9a',
  amber: '#ffb347',
  red: '#ff3b4f',
  white: '#e8f4ff',
} as const;
