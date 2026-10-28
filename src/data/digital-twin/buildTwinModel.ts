import type { MultiPolygon, Polygon, Position } from 'geojson';
import { LocalProjection } from './projection';
import { simulateTwinMetrics, type TwinSimMetrics } from './simulatedMetrics';
import type { AreaData, BuildingProps, HeightSource, LanduseProps, RoadProps, TerrainGrid, TwinManifest } from './types';

/**
 * Geographic pipeline: validated GeoJSON → projected, terrain-aware scene model.
 * Pure data (no Three.js) so it can move to a worker or a server later.
 *
 * Coordinates in the model are metres relative to the AREA centre; the area's
 * own offset from the regional origin is `areaOffset`, applied as a group
 * transform. World coordinates are therefore region coordinates.
 */

export type Ring = [number, number][];

export interface TwinBuilding {
  index: number;
  props: BuildingProps;
  displayName: string | null;
  /** Polygons, each [outer, ...holes], in area-local metres [x, z]. */
  polygons: Ring[][];
  centroid: [number, number];
  /** Terrain height under the footprint (lowest sample), relative to terrain base. */
  baseY: number;
  height: number;
  minHeight: number;
  source: HeightSource;
  typeKey: string;
  footprintArea: number;
  floors: number;
  distToMajorRoad: number;
  sim: TwinSimMetrics;
  /** Set when OSM contains another way with an identical footprint that is rendered instead. */
  supersededBy: number | null;
  /** Other OSM features sharing this footprint. */
  overlaps: number[];
}

export interface TwinRoad {
  index: number;
  props: RoadProps;
  displayName: string | null;
  lines: Ring[];
  cls: RoadClass;
  widthM: number;
}

export interface TwinLanduse {
  index: number;
  props: LanduseProps;
  polygons: Ring[][];
}

export type RoadClass = 'major' | 'minor' | 'service' | 'path' | 'transit';

export interface TerrainModel {
  grid: TerrainGrid;
  /** Lowest elevation in the grid (m, EGM2008). Scene y = 0 corresponds to this. */
  baseElevation: number;
  maxElevation: number;
  /** Relative terrain height (m) at area-local x, z. */
  sample(x: number, z: number): number;
}

export interface TwinModel {
  areaId: string;
  projection: LocalProjection;
  areaOffset: [number, number];
  /** Area extent in local metres. */
  extent: { minX: number; maxX: number; minZ: number; maxZ: number };
  buildings: TwinBuilding[];
  /** Stable OSM id (e.g. "way/472380415") → index in `buildings`. */
  buildingIndexById: Map<string, number>;
  roads: TwinRoad[];
  landuse: TwinLanduse[];
  terrain: TerrainModel | null;
  data: AreaData;
  stats: {
    heightSource: Record<HeightSource, number>;
    types: { key: string; count: number }[];
    maxHeight: number;
    duplicatesResolved: number;
  };
}

const ROAD_CLASS: Record<string, RoadClass> = {
  motorway: 'major', trunk: 'major', primary: 'major', primary_link: 'major', secondary: 'major', secondary_link: 'major',
  tertiary: 'minor', tertiary_link: 'minor', residential: 'minor', unclassified: 'minor', living_street: 'minor',
  service: 'service', footway: 'path', path: 'path', pedestrian: 'path', corridor: 'path', steps: 'path', cycleway: 'path', busway: 'transit',
};

const ROAD_WIDTH: Record<RoadClass, number> = { major: 11, minor: 6.5, service: 4.5, path: 2.2, transit: 7 };

function displayName(p: { name?: string | number | null; 'name:en'?: string | number | null }): string | null {
  const en = p['name:en'];
  if (typeof en === 'string' && en) return en;
  return typeof p.name === 'string' && p.name ? p.name : null;
}

function polygonsOf(g: Polygon | MultiPolygon): Position[][][] {
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
}

function ringArea(r: Ring) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
}

function ringCentroid(r: Ring): [number, number] {
  let x = 0;
  let z = 0;
  const n = r.length - 1 || 1;
  for (let i = 0; i < n; i++) {
    x += r[i][0];
    z += r[i][1];
  }
  return [x / n, z / n];
}

function distPointSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export function distanceToLines(px: number, pz: number, lines: Ring[]): number {
  let best = Infinity;
  for (const l of lines) for (let i = 1; i < l.length; i++) best = Math.min(best, distPointSegment(px, pz, l[i - 1][0], l[i - 1][1], l[i][0], l[i][1]));
  return best;
}

export function pointInRing(x: number, z: number, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const SOURCE_RANK: Record<HeightSource, number> = { recorded: 0, estimated_from_levels: 1, estimated_default: 2 };

export function buildTwinModel(data: AreaData, manifest: TwinManifest): TwinModel {
  const projection = new LocalProjection(manifest.region.origin);
  const [w, s, e, n] = data.meta.bbox;
  const areaOffset = projection.project((w + e) / 2, (s + n) / 2);
  const toLocal = (p: Position): [number, number] => {
    const [x, z] = projection.project(p[0], p[1]);
    return [x - areaOffset[0], z - areaOffset[1]];
  };
  const [x0, z1] = toLocal([w, s]);
  const [x1, z0] = toLocal([e, n]);
  const extent = { minX: x0, maxX: x1, minZ: z0, maxZ: z1 };

  // --- Terrain ---
  let terrain: TerrainModel | null = null;
  if (data.terrain) {
    const g = data.terrain;
    const [tw, ts, te, tn] = g.bbox;
    let min = Infinity;
    let max = -Infinity;
    for (const v of g.values) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    const sample = (x: number, z: number) => {
      const ll = projection.unproject(x + areaOffset[0], z + areaOffset[1]);
      const u = Math.max(0, Math.min(1, (ll.lon - tw) / (te - tw))) * (g.width - 1);
      const v = Math.max(0, Math.min(1, (tn - ll.lat) / (tn - ts))) * (g.height - 1);
      const i0 = Math.floor(u);
      const j0 = Math.floor(v);
      const i1 = Math.min(g.width - 1, i0 + 1);
      const j1 = Math.min(g.height - 1, j0 + 1);
      const fu = u - i0;
      const fv = v - j0;
      const at = (i: number, j: number) => g.values[j * g.width + i];
      const top = at(i0, j0) * (1 - fu) + at(i1, j0) * fu;
      const bot = at(i0, j1) * (1 - fu) + at(i1, j1) * fu;
      return top * (1 - fv) + bot * fv - min;
    };
    terrain = { grid: g, baseElevation: min, maxElevation: max, sample };
  }
  const groundAt = (x: number, z: number) => (terrain ? terrain.sample(x, z) : 0);

  // --- Roads ---
  const roads: TwinRoad[] = data.roads.features.map((f, index) => {
    const geom = f.geometry;
    const raw = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
    const cls = ROAD_CLASS[f.properties.highway ?? ''] ?? 'minor';
    const lanes = Number(f.properties.lanes);
    const widthM = Number.isFinite(lanes) && lanes > 0 && cls !== 'path' ? Math.max(ROAD_WIDTH[cls], lanes * 3.3) : ROAD_WIDTH[cls];
    return { index, props: f.properties, displayName: displayName(f.properties), lines: raw.map((l) => l.map(toLocal)), cls, widthM };
  });
  const majorLines = roads.filter((r) => r.cls === 'major' || r.cls === 'transit').flatMap((r) => r.lines);

  // --- Land use ---
  const landuse: TwinLanduse[] = data.landuse.features.map((f, index) => ({
    index,
    props: f.properties,
    polygons: polygonsOf(f.geometry).map((poly) => poly.map((ring) => ring.map(toLocal))),
  }));
  const green = landuse.filter((l) => ['park', 'grass', 'scrub', 'forest', 'garden', 'meadow'].includes(String(l.props.class)));

  // --- Buildings ---
  const buildings: TwinBuilding[] = data.buildings.features.map((f, index) => {
    const p = f.properties;
    const polygons = polygonsOf(f.geometry).map((poly) =>
      poly.map((ring) => {
        const r = ring.map(toLocal);
        return r;
      }),
    );
    // Normalise winding: outer rings counter-clockwise in (x, z), holes clockwise.
    for (const poly of polygons) {
      poly.forEach((r, i) => {
        const ccw = ringArea(r) > 0;
        if ((i === 0 && !ccw) || (i > 0 && ccw)) r.reverse();
      });
    }
    const outer = polygons[0][0];
    const centroid = ringCentroid(outer);
    let baseY = Infinity;
    for (const poly of polygons) for (const [x, z] of poly[0]) baseY = Math.min(baseY, groundAt(x, z));
    if (!Number.isFinite(baseY)) baseY = 0;
    const height = Math.max(2, Number(p.height_m) || 3);
    const minHeight = Math.min(height - 1, Number(p.min_height_m) || 0);
    const typeKey = String(p.building ?? 'yes');
    const floors = p.levels ?? Math.max(1, Math.round(height / 3));
    const distToMajorRoad = majorLines.length ? distanceToLines(centroid[0], centroid[1], majorLines) : 500;
    let greenNear = 0;
    for (const g of green) {
      for (const poly of g.polygons) {
        if (pointInRing(centroid[0], centroid[1], poly[0]) || distanceToLines(centroid[0], centroid[1], [poly[0]]) < 60) greenNear = Math.min(1, greenNear + 0.5);
      }
    }
    const footprintArea = Number(p.footprint_area_m2) || 0;
    return {
      index,
      props: p,
      displayName: displayName(p),
      polygons,
      centroid,
      baseY,
      height,
      minHeight,
      source: p.height_source,
      typeKey,
      footprintArea,
      floors,
      distToMajorRoad,
      sim: simulateTwinMetrics(String(p.osm_id), typeKey, footprintArea * floors, footprintArea, distToMajorRoad, greenNear),
      supersededBy: null,
      overlaps: [],
    };
  });

  // Identical footprints (duplicate OSM ways): render the best-sourced one, keep both for inspection.
  let duplicatesResolved = 0;
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const a = buildings[i];
      const b = buildings[j];
      const sameArea = Math.abs(a.footprintArea - b.footprintArea) <= Math.max(1, a.footprintArea * 0.002);
      const sameCentre = Math.hypot(a.centroid[0] - b.centroid[0], a.centroid[1] - b.centroid[1]) < 0.5;
      if (!sameArea || !sameCentre) continue;
      a.overlaps.push(b.index);
      b.overlaps.push(a.index);
      const keep = SOURCE_RANK[a.source] < SOURCE_RANK[b.source] || (SOURCE_RANK[a.source] === SOURCE_RANK[b.source] && a.height >= b.height) ? a : b;
      const drop = keep === a ? b : a;
      if (drop.supersededBy === null) {
        drop.supersededBy = keep.index;
        duplicatesResolved++;
      }
    }
  }

  const heightSource: Record<HeightSource, number> = { recorded: 0, estimated_from_levels: 0, estimated_default: 0 };
  const typeCounts = new Map<string, number>();
  let maxHeight = 0;
  for (const b of buildings) {
    heightSource[b.source]++;
    typeCounts.set(b.typeKey, (typeCounts.get(b.typeKey) ?? 0) + 1);
    maxHeight = Math.max(maxHeight, b.height);
  }

  return {
    areaId: data.entry.id,
    projection,
    areaOffset,
    extent,
    buildings,
    buildingIndexById: new Map(buildings.map((b) => [String(b.props.osm_id), b.index])),
    roads,
    landuse,
    terrain,
    data,
    stats: {
      heightSource,
      types: [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count })),
      maxHeight,
      duplicatesResolved,
    },
  };
}
