import * as THREE from 'three';
import { CITY } from '../../data/cyberpunk/config';

/**
 * Highway centre-lines as precomputed lookup tables, so vehicles can be moved
 * every frame without calling into Curve (which allocates).
 */
export interface PathLUT {
  closed: boolean;
  length: number;
  /** xyz per sample. */
  points: Float32Array;
  /** Unit tangent xz per sample. */
  tangents: Float32Array;
  samples: number;
}

function buildLUT(curve: THREE.Curve<THREE.Vector3>, samples: number, closed: boolean): PathLUT {
  const pts = curve.getSpacedPoints(samples);
  const points = new Float32Array((samples + 1) * 3);
  const tangents = new Float32Array((samples + 1) * 2);
  for (let i = 0; i <= samples; i++) {
    const p = pts[i];
    points.set([p.x, p.y, p.z], i * 3);
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(samples, i + 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    tangents.set([dx / l, dz / l], i * 2);
  }
  return { closed, length: curve.getLength(), points, tangents, samples };
}

/** Sample position + tangent at u ∈ [0, 1) into the provided outputs. */
export function samplePath(lut: PathLUT, u: number, outPos: THREE.Vector3, outTan: THREE.Vector2) {
  const f = (((u % 1) + 1) % 1) * lut.samples;
  const i = Math.floor(f);
  const t = f - i;
  const j = Math.min(lut.samples, i + 1);
  const P = lut.points;
  outPos.set(P[i * 3] + (P[j * 3] - P[i * 3]) * t, P[i * 3 + 1] + (P[j * 3 + 1] - P[i * 3 + 1]) * t, P[i * 3 + 2] + (P[j * 3 + 2] - P[i * 3 + 2]) * t);
  const T = lut.tangents;
  outTan.set(T[i * 2] + (T[j * 2] - T[i * 2]) * t, T[i * 2 + 1] + (T[j * 2 + 1] - T[i * 2 + 1]) * t).normalize();
}

function roundedRect(half: number, radius: number, y: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const corners: [number, number, number][] = [
    [half - radius, half - radius, 0],
    [-(half - radius), half - radius, Math.PI / 2],
    [-(half - radius), -(half - radius), Math.PI],
    [half - radius, -(half - radius), (3 * Math.PI) / 2],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let k = 0; k <= 8; k++) {
      const a = a0 + (k / 8) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius));
    }
  }
  return pts;
}

export interface HighwayDef {
  id: string;
  curve: THREE.Curve<THREE.Vector3>;
  lut: PathLUT;
  width: number;
  lanes: number;
  accent: string;
}

let cache: HighwayDef[] | null = null;

export function getHighways(): HighwayDef[] {
  if (cache) return cache;
  const loopCurve = new THREE.CatmullRomCurve3(roundedRect(CITY.highwayLoopHalf, 40, CITY.highwayLoopHeight), true, 'centripetal');
  const z = CITY.highwayCrossZ;
  const crossCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-1400, CITY.highwayCrossHeight - 8, z),
      new THREE.Vector3(-500, CITY.highwayCrossHeight, z),
      new THREE.Vector3(0, CITY.highwayCrossHeight, z),
      new THREE.Vector3(500, CITY.highwayCrossHeight, z),
      new THREE.Vector3(1400, CITY.highwayCrossHeight - 8, z),
    ],
    false,
  );
  cache = [
    { id: 'loop', curve: loopCurve, lut: buildLUT(loopCurve, 1200, true), width: 15, lanes: 4, accent: '#3ef0ff' },
    { id: 'cross', curve: crossCurve, lut: buildLUT(crossCurve, 1400, false), width: 13, lanes: 4, accent: '#ff2bd6' },
  ];
  return cache;
}

/** Deck slab geometry swept along a path LUT. */
export function buildDeckGeometry(h: HighwayDef, thickness = 1.3): THREE.BufferGeometry {
  const { lut, width } = h;
  const n = lut.samples + 1;
  const hw = width / 2;
  // Four corners per sample: top-left, top-right, bottom-right, bottom-left.
  const pos = new Float32Array(n * 4 * 3);
  for (let i = 0; i < n; i++) {
    const x = lut.points[i * 3];
    const y = lut.points[i * 3 + 1];
    const z = lut.points[i * 3 + 2];
    const tx = lut.tangents[i * 2];
    const tz = lut.tangents[i * 2 + 1];
    const nx = -tz;
    const nz = tx;
    pos.set([x + nx * hw, y, z + nz * hw, x - nx * hw, y, z - nz * hw, x - nx * hw, y - thickness, z - nz * hw, x + nx * hw, y - thickness, z + nz * hw], i * 12);
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      idx.push(a + k, b + k, a + k2, a + k2, b + k, b + k2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Thin glowing barrier strips along both deck edges. */
export function buildEdgeStripGeometry(h: HighwayDef, height = 0.35, lift = 0.9): THREE.BufferGeometry {
  const { lut, width } = h;
  const n = lut.samples + 1;
  const hw = width / 2 - 0.1;
  const pos = new Float32Array(n * 4 * 3);
  for (let i = 0; i < n; i++) {
    const x = lut.points[i * 3];
    const y = lut.points[i * 3 + 1] + lift;
    const z = lut.points[i * 3 + 2];
    const nx = -lut.tangents[i * 2 + 1];
    const nz = lut.tangents[i * 2];
    pos.set([x + nx * hw, y, z + nz * hw, x + nx * hw, y + height, z + nz * hw, x - nx * hw, y, z - nz * hw, x - nx * hw, y + height, z - nz * hw], i * 12);
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    idx.push(a, b, a + 1, a + 1, b, b + 1, a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
