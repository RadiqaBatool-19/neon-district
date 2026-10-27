import { NEON } from './config';

export type DistrictId = 'plaza' | 'financial' | 'market' | 'industrial' | 'residential';

export interface DistrictDef {
  id: DistrictId;
  name: string;
  tagline: string;
  /** Lit-window tint (shader colour). */
  windowTint: string;
  /** Rooftop crown / accent colour. */
  accent: string;
  /** Base facade colour (dark). */
  facade: string;
  /** Fraction of windows lit. */
  litRatio: [number, number];
  /** Building height range (m) at the inner ring; falls off outward. */
  height: [number, number];
}

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  plaza: {
    id: 'plaza',
    name: 'Central Plaza',
    tagline: 'Civic heart & the Aurora Spire',
    windowTint: '#9fe8ff',
    accent: NEON.cyan,
    facade: '#0c1020',
    litRatio: [0.5, 0.7],
    height: [40, 60],
  },
  financial: {
    id: 'financial',
    name: 'Financial District',
    tagline: 'Glass towers & capital flows',
    windowTint: '#8fd8ff',
    accent: NEON.cyan,
    facade: '#0a0f1c',
    litRatio: [0.42, 0.7],
    height: [90, 230],
  },
  market: {
    id: 'market',
    name: 'Neon Market',
    tagline: 'Dense stacks & signage',
    windowTint: '#ff9be6',
    accent: NEON.magenta,
    facade: '#120c18',
    litRatio: [0.45, 0.75],
    height: [24, 80],
  },
  industrial: {
    id: 'industrial',
    name: 'Industrial Zone',
    tagline: 'Fabricators, pipes & power',
    windowTint: '#ffc078',
    accent: NEON.amber,
    facade: '#101012',
    litRatio: [0.18, 0.35],
    height: [10, 34],
  },
  residential: {
    id: 'residential',
    name: 'Residential District',
    tagline: 'Quieter streets & warm windows',
    windowTint: '#ffd3a1',
    accent: NEON.violet,
    facade: '#0e0d16',
    litRatio: [0.3, 0.55],
    height: [14, 48],
  },
};

export const DISTRICT_ORDER: DistrictId[] = ['plaza', 'financial', 'market', 'industrial', 'residential'];
