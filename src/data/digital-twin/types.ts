import type { Feature, FeatureCollection, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';

/** Where a building's height came from. Never present estimates as measurements. */
export type HeightSource = 'recorded' | 'estimated_from_levels' | 'estimated_default';

export interface LonLat {
  lon: number;
  lat: number;
}

/** [west, south, east, north] in WGS84 degrees. */
export type BBox = [number, number, number, number];

export interface AreaManifestEntry {
  id: string;
  name: string;
  subtitle?: string;
  city: string;
  bbox: BBox;
  layers: { buildings: string; roads: string; landuse: string; terrain?: string };
  meta: string;
  status: 'available' | 'planned';
}

export interface TwinManifest {
  version: number;
  region: { name: string; origin: LonLat & { label: string }; processing_crs: string };
  areas: AreaManifestEntry[];
}

export interface AreaMeta {
  id: string;
  name: string;
  city: string;
  country: string;
  center: [number, number];
  bbox: BBox;
  size_m: [number, number];
  source: string;
  osm_base_timestamp: string | null;
  extracted_at: string;
  processing_crs: string;
  export_crs: string;
  clip_rule: Record<string, string>;
  height_rules: { recorded: string; estimated_from_levels: string; estimated_default: string; defaults_m: Record<string, number> };
  counts: { buildings: number; roads: number; landuse: number; height_source: Record<HeightSource, number> };
  license: string;
  attribution: string;
  license_url: string;
}

export interface BuildingProps {
  osm_id: string;
  osm_type: string;
  osm_version: number | null;
  osm_timestamp: string | null;
  name: string | null;
  'name:en': string | null;
  building: string | null;
  height: string | null;
  min_height: string | null;
  'building:levels': string | null;
  height_m: number;
  min_height_m: number | null;
  levels: number | null;
  height_source: HeightSource;
  height_note: string;
  footprint_area_m2: number;
  [tag: string]: string | number | null;
}

export interface RoadProps {
  osm_id: string;
  name: string | null;
  highway: string | null;
  lanes: string | null;
  oneway: string | null;
  surface: string | null;
  length_m: number;
  [tag: string]: string | number | null;
}

export interface LanduseProps {
  osm_id: string;
  name: string | null;
  class: string | null;
  area_m2: number;
  [tag: string]: string | number | null;
}

export type BuildingCollection = FeatureCollection<Polygon | MultiPolygon, BuildingProps>;
export type RoadCollection = FeatureCollection<LineString | MultiLineString, RoadProps>;
export type LanduseCollection = FeatureCollection<Polygon | MultiPolygon, LanduseProps>;
export type BuildingFeature = Feature<Polygon | MultiPolygon, BuildingProps>;

export interface TerrainGrid {
  width: number;
  height: number;
  bbox: BBox;
  order: string;
  unit: string;
  values: number[];
  source: string;
  note: string;
  attribution: string;
}

export interface AreaData {
  entry: AreaManifestEntry;
  meta: AreaMeta;
  buildings: BuildingCollection;
  roads: RoadCollection;
  landuse: LanduseCollection;
  terrain: TerrainGrid | null;
}
