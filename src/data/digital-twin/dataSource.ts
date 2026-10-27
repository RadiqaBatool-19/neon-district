import type { AreaData, AreaManifestEntry, AreaMeta, BuildingCollection, LanduseCollection, RoadCollection, TerrainGrid, TwinManifest } from './types';

/**
 * Data access for the digital twin. Scene code depends only on this interface,
 * so a PostGIS / REST implementation (e.g. `GET /areas/:id/buildings?bbox=`) can
 * replace the static files without touching rendering.
 */
export interface TwinDataSource {
  loadManifest(signal?: AbortSignal): Promise<TwinManifest>;
  loadArea(entry: AreaManifestEntry, signal?: AbortSignal, onProgress?: (p: number, label: string) => void): Promise<AreaData>;
}

class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataError';
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new DataError(`Could not load ${url} (HTTP ${res.status}).`);
  const type = res.headers.get('content-type') ?? '';
  // Dev servers answer unknown paths with index.html; catch that early with a readable error.
  if (type.includes('text/html')) throw new DataError(`Expected JSON at ${url} but received HTML. Is the data file missing?`);
  return (await res.json()) as T;
}

function assertCollection(fc: { type?: string; features?: unknown[] } | null, name: string) {
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) throw new DataError(`${name} is not a valid GeoJSON FeatureCollection.`);
}

/** Static GeoJSON files under /public/data/twin, exported from QGIS. */
export class StaticGeoJsonSource implements TwinDataSource {
  constructor(private readonly baseUrl = '/data/twin/') {}

  loadManifest(signal?: AbortSignal) {
    return getJson<TwinManifest>(`${this.baseUrl}manifest.json`, signal);
  }

  async loadArea(entry: AreaManifestEntry, signal?: AbortSignal, onProgress?: (p: number, label: string) => void): Promise<AreaData> {
    const base = this.baseUrl;
    let done = 0;
    const steps = entry.layers.terrain ? 5 : 4;
    const track = <T,>(label: string, p: Promise<T>) =>
      p.then((v) => {
        done++;
        onProgress?.(done / steps, label);
        return v;
      });
    const [meta, buildings, roads, landuse, terrain] = await Promise.all([
      track('metadata', getJson<AreaMeta>(base + entry.meta, signal)),
      track('buildings', getJson<BuildingCollection>(base + entry.layers.buildings, signal)),
      track('roads', getJson<RoadCollection>(base + entry.layers.roads, signal)),
      track('land use', getJson<LanduseCollection>(base + entry.layers.landuse, signal)),
      entry.layers.terrain ? track('terrain', getJson<TerrainGrid>(base + entry.layers.terrain, signal)).catch(() => null) : Promise.resolve(null),
    ]);
    assertCollection(buildings, 'buildings');
    assertCollection(roads, 'roads');
    assertCollection(landuse, 'landuse');
    if (terrain && terrain.values.length !== terrain.width * terrain.height) throw new DataError('Terrain grid size does not match its dimensions.');
    return { entry, meta, buildings, roads, landuse, terrain };
  }
}

export const twinDataSource: TwinDataSource = new StaticGeoJsonSource();
