/**
 * Digital Twin data validation. Run with `npm run validate:twin` (Node ≥ 22.18,
 * which runs TypeScript directly).
 *
 * For every available area in the manifest it checks:
 * - geometry: closed rings, ≥ 4 positions, finite coordinates inside the bbox,
 *   no repeated vertices, unique OSM ids;
 * - attributes: counts match meta.json, and height_source agrees with the tags
 *   (recorded ⇔ an OSM `height` tag is present);
 * - measurements: the app's ellipsoidal area / Vincenty length (src/…/measure.ts)
 *   against the QGIS attributes footprint_area_m2 / length_m (UTM 43N planar);
 * - projection: the scene's local tangent plane against ellipsoidal distance.
 *
 * Exits non-zero if any check fails.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { measureArea, vincentyDistance } from '../src/data/digital-twin/measure.ts';
import { LocalProjection } from '../src/data/digital-twin/projection.ts';

const TOL = { areaRelPct: 0.1, lengthM: 0.5, projectionPct: 0.05 };

type Ring = number[][];
const root = fileURLToPath(new URL('../public/data/twin/', import.meta.url));
const read = (f: string) => JSON.parse(readFileSync(root + f, 'utf8'));
const manifest = read('manifest.json');
const proj = new LocalProjection(manifest.region.origin);
const polys = (g: { type: string; coordinates: unknown }) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as Ring[][];
let failed = false;

for (const area of manifest.areas.filter((a: { status: string }) => a.status === 'available')) {
  const meta = read(area.meta);
  const B = read(area.layers.buildings);
  const R = read(area.layers.roads);
  const L = read(area.layers.landuse);
  const [w, s, e, n] = meta.bbox;
  const issues: string[] = [];

  const checkRing = (r: Ring, id: string) => {
    if (r.length < 4) issues.push(`${id}: ring with ${r.length} positions`);
    const a = r[0];
    const z = r[r.length - 1];
    if (a[0] !== z[0] || a[1] !== z[1]) issues.push(`${id}: ring not closed`);
    if (r.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) issues.push(`${id}: non-finite coordinate`);
    if (r.some((p) => p[0] < w - 0.002 || p[0] > e + 0.002 || p[1] < s - 0.002 || p[1] > n + 0.002)) issues.push(`${id}: vertex outside bbox`);
    if (r.some((p, i) => i > 0 && p[0] === r[i - 1][0] && p[1] === r[i - 1][1])) issues.push(`${id}: repeated vertex`);
  };

  if (B.features.length !== meta.counts.buildings || R.features.length !== meta.counts.roads || L.features.length !== meta.counts.landuse) issues.push('feature counts differ from meta.json');

  const ids = new Set<string>();
  let worstArea = { pct: 0, id: '' };
  for (const f of B.features) {
    const p = f.properties;
    if (ids.has(p.osm_id)) issues.push(`${p.osm_id}: duplicate osm_id`);
    ids.add(p.osm_id);
    if ((p.height_source === 'recorded') !== (p.height !== null && p.height !== '' && p.height !== undefined)) issues.push(`${p.osm_id}: height_source "${p.height_source}" disagrees with the height tag`);
    let m2 = 0;
    for (const poly of polys(f.geometry)) {
      poly.forEach((ring, i) => {
        checkRing(ring, p.osm_id);
        const a = measureArea(ring.slice(0, -1).map(([lon, lat]) => ({ lon, lat, x: 0, y: 0, z: 0, elevation: null })))!.areaM2;
        m2 += i === 0 ? a : -a;
      });
    }
    const pct = ((m2 - p.footprint_area_m2) / p.footprint_area_m2) * 100;
    if (Math.abs(pct) > Math.abs(worstArea.pct)) worstArea = { pct, id: p.osm_id };
  }

  let worstLen = { m: 0, id: '' };
  for (const f of R.features) {
    const lines: Ring[] = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let len = 0;
    for (const l of lines) for (let i = 1; i < l.length; i++) len += vincentyDistance(l[i - 1][0], l[i - 1][1], l[i][0], l[i][1]);
    const d = len - f.properties.length_m;
    if (Math.abs(d) > Math.abs(worstLen.m)) worstLen = { m: d, id: f.properties.osm_id };
  }
  for (const f of L.features) for (const poly of polys(f.geometry)) poly.forEach((r) => checkRing(r, f.properties.osm_id));

  const [x1, z1] = proj.project(w, s);
  const [x2, z2] = proj.project(e, n);
  const diag = vincentyDistance(w, s, e, n);
  const projPct = ((Math.hypot(x2 - x1, z2 - z1) - diag) / diag) * 100;

  const checks = [
    { name: 'geometry & attributes', ok: issues.length === 0, detail: issues.length ? issues.slice(0, 10).join('; ') : `${B.features.length} buildings, ${R.features.length} roads, ${L.features.length} land use` },
    { name: 'footprint area vs QGIS', ok: Math.abs(worstArea.pct) <= TOL.areaRelPct, detail: `worst ${worstArea.pct.toFixed(4)} % (${worstArea.id}), tolerance ±${TOL.areaRelPct} %` },
    { name: 'road length vs QGIS', ok: Math.abs(worstLen.m) <= TOL.lengthM, detail: `worst ${worstLen.m.toFixed(3)} m (${worstLen.id}), tolerance ±${TOL.lengthM} m` },
    { name: 'scene projection', ok: Math.abs(projPct) <= TOL.projectionPct, detail: `${projPct.toFixed(4)} % over the ${diag.toFixed(0)} m diagonal, tolerance ±${TOL.projectionPct} %` },
  ];
  console.log(`\n${area.id}`);
  for (const c of checks) {
    console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name} — ${c.detail}`);
    if (!c.ok) failed = true;
  }
}

process.exit(failed ? 1 : 0);
