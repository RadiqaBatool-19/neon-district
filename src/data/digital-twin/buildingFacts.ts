import type { Position } from 'geojson';
import type { TwinModel } from './buildTwinModel';
import { vincentyDistance } from './measure';
import type { BuildingProps } from './types';

/**
 * Structured facts about one building, split by provenance:
 * - `source`: values exactly as tagged in OpenStreetMap (null = not tagged);
 * - `derived`: values computed by the pipeline or the app, each with its method;
 * - synthetic metrics live on `TwinBuilding.sim` and are never mixed in here.
 *
 * Pure data, so the inspector, a comparison table and CSV / GeoJSON export can
 * all present the same values. Missing values stay `null` — never estimated.
 */

export interface Fact {
  key: string;
  label: string;
  /** Formatted value, or null when the source has no value. */
  value: string | null;
  /** Raw value for export (number in the stated unit, or the tag string). */
  raw: string | number | null;
  unit?: string;
  /** How the value was obtained (derived facts only). */
  method?: string;
}

export interface BuildingFacts {
  source: Fact[];
  derived: Fact[];
}

export const NOT_AVAILABLE = 'Not available';

const tag = (p: BuildingProps, k: string): string | null => {
  const v = p[k];
  return v === null || v === undefined || v === '' ? null : String(v);
};

const fact = (key: string, label: string, raw: string | number | null, value: string | null = raw === null ? null : String(raw), extra: Partial<Fact> = {}): Fact => ({ key, label, raw, value, ...extra });

/** Postal address from addr:* tags, or null if none are tagged. */
export function addressOf(p: BuildingProps): string | null {
  const parts = [[tag(p, 'addr:housenumber'), tag(p, 'addr:street')].filter(Boolean).join(' '), tag(p, 'addr:city'), tag(p, 'addr:postcode')].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Use tags (amenity, shop, office, …) as `key=value` pairs, or null if none. */
export function useOf(p: BuildingProps): string | null {
  const uses = ['amenity', 'shop', 'office', 'tourism', 'leisure', 'building:use'].map((k) => (tag(p, k) ? `${k}=${tag(p, k)}` : null)).filter(Boolean);
  return uses.length ? uses.join(' · ') : null;
}

function ringPerimeter(ring: Position[]) {
  let m = 0;
  for (let i = 1; i < ring.length; i++) m += vincentyDistance(ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1]);
  return m;
}

const HEIGHT_METHOD = {
  recorded: 'OSM height tag',
  estimated_from_levels: 'Estimated: building:levels × 3.0 m',
  estimated_default: 'Estimated: default for the building type',
} as const;

export function buildingFacts(model: TwinModel, index: number): BuildingFacts {
  const b = model.buildings[index];
  const p = b.props;
  const feature = model.data.buildings.features[index];
  const outerRings = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates[0]] : feature.geometry.coordinates.map((poly) => poly[0]);
  const perimeter = outerRings.reduce((s, r) => s + ringPerimeter(r), 0);
  const centroid = model.projection.unproject(b.centroid[0] + model.areaOffset[0], b.centroid[1] + model.areaOffset[1]);
  const levels = tag(p, 'building:levels');
  const ground = model.terrain ? model.terrain.baseElevation + b.baseY : null;
  const volume = b.footprintArea * (b.height - b.minHeight);
  // The model falls back to a placeholder distance when the extract has no major road; never show that.
  const hasMajorRoad = model.roads.some((r) => r.cls === 'major' || r.cls === 'transit');
  const roadDist = hasMajorRoad && Number.isFinite(b.distToMajorRoad) ? Math.round(b.distToMajorRoad) : null;

  const source: Fact[] = [
    fact('building', 'Building (building=*)', tag(p, 'building')),
    fact('name', 'Name', tag(p, 'name')),
    ...(tag(p, 'name:en') ? [fact('name:en', 'Name (English)', tag(p, 'name:en'))] : []),
    fact('address', 'Address (addr:*)', addressOf(p)),
    fact('use', 'Use (amenity / shop / office …)', useOf(p)),
    fact('operator', 'Operator', tag(p, 'operator')),
    fact('height', 'Height tag', tag(p, 'height')),
    fact('building:levels', 'Levels (building:levels)', levels),
    fact('min_height', 'Min. height tag', tag(p, 'min_height')),
  ];

  const derived: Fact[] = [
    fact('height_m', 'Height used in 3D', +b.height.toFixed(1), `${b.height.toFixed(1)} m`, { unit: 'm', method: HEIGHT_METHOD[b.source] }),
    fact('height_source', 'Height source', b.source, b.source.replace(/_/g, ' '), { method: 'Pipeline rule (meta.json)' }),
    fact('footprint_area_m2', 'Footprint area', +b.footprintArea.toFixed(1), `${Math.round(b.footprintArea).toLocaleString()} m²`, { unit: 'm²', method: 'QGIS, planar in EPSG:32643 (UTM 43N)' }),
    fact('perimeter_m', 'Footprint perimeter', +perimeter.toFixed(1), `${perimeter.toFixed(1)} m`, { unit: 'm', method: 'Ellipsoidal (Vincenty, WGS84), outer ring' }),
    fact(
      'volume_m3',
      b.source === 'recorded' ? 'Volume (footprint × height)' : 'Volume (footprint × estimated height)',
      Math.round(volume),
      `${Math.round(volume).toLocaleString()} m³`,
      { unit: 'm³', method: b.source === 'recorded' ? 'Footprint × recorded height' : 'Uses an estimated height — indicative only' },
    ),
    fact('ground_elevation_m', 'Ground elevation', ground === null ? null : +ground.toFixed(1), ground === null ? null : `${ground.toFixed(1)} m ASL`, {
      unit: 'm ASL',
      method: 'Copernicus DEM GLO-30 (surface model), lowest sample under the footprint',
    }),
    fact('centroid', 'Centroid (lat, lon)', `${centroid.lat.toFixed(6)}, ${centroid.lon.toFixed(6)}`, `${centroid.lat.toFixed(6)}, ${centroid.lon.toFixed(6)}`, { method: 'Vertex mean of the outer ring, WGS84' }),
    fact('dist_major_road_m', 'Nearest major road', roadDist, roadDist === null ? null : `${roadDist} m`, {
      unit: 'm',
      method: 'Centroid to the nearest primary / secondary road centreline in this extract',
    }),
  ];

  return { source, derived };
}
