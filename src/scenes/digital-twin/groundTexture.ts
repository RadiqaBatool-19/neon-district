import * as THREE from 'three';
import { distanceToLines, pointInRing, type Ring, type RoadClass, type TwinModel } from '../../data/digital-twin/buildTwinModel';
import { SIM_SCALES } from '../../data/digital-twin/simulatedMetrics';
import type { SurfaceOverlay } from '../../stores/twinStore';
import { createRng } from '../../utils/random';
import { sampleRamp } from '../../utils/colorRamp';

const SIZE = 2048;

const LANDUSE_FILL: Record<string, string> = {
  residential: '#ece9e3',
  commercial: '#ece6ee',
  retail: '#eee4ea',
  park: '#cfe6c3',
  grass: '#d6eacb',
  scrub: '#d5e2bf',
  forest: '#bcd8b0',
  construction: '#efe3cf',
};

const ROAD_STYLE: Record<RoadClass, { fill: string; casing: string; dash?: number[] }> = {
  major: { fill: '#ffffff', casing: '#b9c0cb' },
  transit: { fill: '#efe3fb', casing: '#c4b2dc' },
  minor: { fill: '#ffffff', casing: '#cdd2da' },
  service: { fill: '#f8f8f8', casing: '#d6dae0' },
  path: { fill: '#c9bfae', casing: 'transparent', dash: [4, 3] },
};

const DRAW_ORDER: RoadClass[] = ['path', 'service', 'minor', 'transit', 'major'];

export interface GroundState {
  roads: boolean;
  landuse: boolean;
  surface: SurfaceOverlay;
  selectedRoad: number | null;
  /** Footprints of buildings hidden by filters, drawn as dashed outlines. */
  ghostFootprints: Ring[][][];
}

/**
 * Synthetic surface field (SIMULATED) sampled on a coarse grid, shaped by real
 * geometry: distance to major roads, building cover and green space.
 */
function surfaceField(model: TwinModel, kind: Exclude<SurfaceOverlay, 'none'>, res = 72): Float32Array {
  const { minX, maxX, minZ, maxZ } = model.extent;
  const major = model.roads.filter((r) => r.cls === 'major' || r.cls === 'transit').flatMap((r) => r.lines);
  const green = model.landuse.filter((l) => ['park', 'grass', 'scrub', 'forest'].includes(String(l.props.class))).flatMap((l) => l.polygons.map((p) => p[0]));
  const roofs = model.buildings.map((b) => b.polygons[0][0]);
  const rng = createRng(kind === 'air' ? 11 : 17);
  const noise = Array.from({ length: 9 }, () => rng.range(-1, 1));
  const out = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = minX + ((i + 0.5) / res) * (maxX - minX);
      const z = minZ + ((j + 0.5) / res) * (maxZ - minZ);
      const dRoad = major.length ? distanceToLines(x, z, major) : 300;
      const inGreen = green.some((r) => pointInRing(x, z, r)) ? 1 : 0;
      const nearRoof = roofs.some((r) => pointInRing(x, z, r)) ? 1 : 0;
      const n = noise[(i % 3) + 3 * (j % 3)] * 0.4 + Math.sin(x * 0.02) * Math.cos(z * 0.025);
      out[j * res + i] =
        kind === 'temperature'
          ? 36 + 5 * Math.exp(-dRoad / 45) + 3 * nearRoof - 5.5 * inGreen + n
          : 28 + 44 * Math.exp(-dRoad / 60) - 7 * inGreen + 3 * n;
    }
  }
  return out;
}

const fieldCache = new WeakMap<TwinModel, Partial<Record<'temperature' | 'air', Float32Array>>>();

export function createGroundCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, texture };
}

export function drawGround(canvas: HTMLCanvasElement, model: TwinModel, state: GroundState) {
  const ctx = canvas.getContext('2d')!;
  const { minX, maxX, minZ, maxZ } = model.extent;
  const sx = SIZE / (maxX - minX);
  const sz = SIZE / (maxZ - minZ);
  const px = (x: number) => (x - minX) * sx;
  const pz = (z: number) => (z - minZ) * sz;
  const tracePoly = (poly: Ring[]) => {
    for (const ring of poly) {
      ring.forEach(([x, z], k) => (k ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))));
      ctx.closePath();
    }
  };

  ctx.fillStyle = '#f1f1ec';
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (state.landuse) {
    for (const l of model.landuse) {
      ctx.beginPath();
      for (const poly of l.polygons) tracePoly(poly);
      ctx.fillStyle = LANDUSE_FILL[String(l.props.class)] ?? '#ebe9e2';
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(120, 140, 110, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  if (state.surface !== 'none') {
    const kind = state.surface;
    let cache = fieldCache.get(model);
    if (!cache) fieldCache.set(model, (cache = {}));
    const field = (cache[kind] ??= surfaceField(model, kind));
    const res = Math.round(Math.sqrt(field.length));
    const small = document.createElement('canvas');
    small.width = res;
    small.height = res;
    const sctx = small.getContext('2d')!;
    const img = sctx.createImageData(res, res);
    const scale = SIM_SCALES[kind];
    const c = new THREE.Color();
    for (let k = 0; k < field.length; k++) {
      sampleRamp([...scale.stops], (field[k] - scale.min) / (scale.max - scale.min), c);
      img.data.set([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255], k * 4);
    }
    sctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, SIZE, SIZE);
    ctx.restore();
  }

  if (state.roads) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pass of ['casing', 'fill'] as const) {
      for (const cls of DRAW_ORDER) {
        const style = ROAD_STYLE[cls];
        if (pass === 'casing' && style.casing === 'transparent') continue;
        for (const r of model.roads) {
          if (r.cls !== cls) continue;
          ctx.beginPath();
          for (const line of r.lines) line.forEach(([x, z], k) => (k ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))));
          const selected = state.selectedRoad === r.index;
          ctx.setLineDash(pass === 'fill' && style.dash ? style.dash.map((d) => d * sx) : []);
          ctx.strokeStyle = pass === 'casing' ? (selected ? '#1d4ed8' : style.casing) : selected ? '#93c5fd' : style.fill;
          ctx.lineWidth = (r.widthM + (pass === 'casing' ? 1.6 : 0)) * sx;
          ctx.stroke();
        }
      }
    }
    ctx.setLineDash([]);
  }

  if (state.ghostFootprints.length) {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 2;
    for (const polys of state.ghostFootprints) {
      ctx.beginPath();
      for (const poly of polys) tracePoly(poly);
      ctx.fill('evenodd');
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Area-local point → ground texture UV (matches drawGround). */
export function groundUv(model: TwinModel, x: number, z: number): [number, number] {
  const { minX, maxX, minZ, maxZ } = model.extent;
  return [(x - minX) / (maxX - minX), 1 - (z - minZ) / (maxZ - minZ)];
}
