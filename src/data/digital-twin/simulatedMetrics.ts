import { createRng, hashString } from '../../utils/random';

/**
 * SIMULATED environmental values for the digital twin. They are synthetic,
 * deterministic per OSM feature, and shaped by real geometry (floor area, distance
 * to major roads, nearby green space) so the patterns are plausible — but they
 * are NOT measurements and must always be labelled as simulated.
 */
export interface TwinSimMetrics {
  /** Annual energy use (MWh/yr) for the whole building. */
  energyMWhYr: number;
  /** Energy use intensity (kWh/m²/yr). */
  energyIntensity: number;
  /** Afternoon roof-surface temperature scenario (°C). */
  roofTempC: number;
  /** PM2.5 at street level (µg/m³). */
  pm25: number;
}

const INTENSITY: Record<string, [number, number]> = {
  commercial: [190, 320],
  retail: [220, 360],
  office: [170, 280],
  apartments: [95, 160],
  house: [70, 130],
  residential: [80, 140],
  mosque: [50, 110],
  construction: [10, 30],
  yes: [110, 230],
};

export function simulateTwinMetrics(osmId: string, buildingType: string, floorAreaM2: number, roofAreaM2: number, distToMajorRoadM: number, greenWithin60m: number): TwinSimMetrics {
  const rng = createRng(hashString(osmId));
  const [i0, i1] = INTENSITY[buildingType] ?? INTENSITY.yes;
  const energyIntensity = rng.range(i0, i1);
  const energyMWhYr = (energyIntensity * floorAreaM2) / 1000;
  const roofTempC = 38 + Math.min(6, roofAreaM2 / 900) - greenWithin60m * 5 + rng.range(-1.8, 1.8);
  const roadInfluence = Math.exp(-distToMajorRoadM / 70);
  const pm25 = 32 + 42 * roadInfluence - greenWithin60m * 8 + rng.range(-5, 5);
  return { energyMWhYr, energyIntensity, roofTempC, pm25: Math.max(8, pm25) };
}

export const SIM_SCALES = {
  energy: { label: 'Energy use intensity', unit: 'kWh/m²/yr', min: 50, max: 340, stops: ['#ecfdf5', '#6ee7b7', '#0ea5e9', '#4338ca'] },
  temperature: { label: 'Roof surface temperature', unit: '°C', min: 32, max: 46, stops: ['#2563eb', '#a5f3fc', '#fde68a', '#f97316', '#b91c1c'] },
  air: { label: 'PM2.5 at street level', unit: 'µg/m³', min: 15, max: 80, stops: ['#22c55e', '#facc15', '#f97316', '#dc2626', '#7e22ce'] },
} as const;

export type SimMetricKey = keyof typeof SIM_SCALES;
