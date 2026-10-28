import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TwinBuilding } from '../../data/digital-twin/buildTwinModel';
import { SIM_SCALES } from '../../data/digital-twin/simulatedMetrics';
import { HEIGHT_RAMP, metricValue, SOURCE_COLORS, TYPE_COLORS, TYPE_FALLBACK } from '../../data/digital-twin/styling';
import { useTwinStore, type ColorBy } from '../../stores/twinStore';
import { sampleRamp } from '../../utils/colorRamp';
import { clearMeasureCursor, handleSceneClick, updateMeasureCursor } from './picking';
import { useTwinModel } from './TwinModelContext';

function buildingGeometry(b: TwinBuilding, exaggeration: number): THREE.BufferGeometry {
  const shapes = b.polygons.map((poly) => {
    // Shape space (x, -z): after rotateX(-90°) the shape's y maps back to +z.
    const shape = new THREE.Shape(poly[0].map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const hole of poly.slice(1)) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
    return shape;
  });
  const g = new THREE.ExtrudeGeometry(shapes, { depth: b.height - b.minHeight, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, b.baseY * exaggeration + b.minHeight, 0);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  g.setAttribute('aBid', new THREE.Float32BufferAttribute(new Float32Array(n).fill(b.index), 1));
  g.setAttribute('aEst', new THREE.Float32BufferAttribute(new Float32Array(n).fill(b.source === 'recorded' ? 0 : 1), 1));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  return g;
}

/** Building material: vertex colours plus subtle diagonal hatching on walls of buildings with estimated heights. */
function createBuildingMaterial(opacity = 1) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  const uMark = { value: 1 };
  mat.userData.uMark = uMark;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMark = uMark;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEst;\nvarying float vEst;\nvarying vec3 vWp;\nvarying vec3 vWn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEst = aEst;\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWn = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uMark;\nvarying float vEst;\nvarying vec3 vWp;\nvarying vec3 vWn;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float wall = 1.0 - step(0.6, abs(vWn.y));
        float stripe = step(0.72, fract((vWp.x + vWp.z + vWp.y) * 0.35));
        diffuseColor.rgb *= 1.0 - 0.13 * stripe * wall * vEst * uMark;`,
      );
  };
  return mat;
}

const HOVER = new THREE.Color('#fef3c7');
const SELECT = new THREE.Color('#2563eb');
/** Buildings in the comparison set (kept distinct from the blue single selection). */
const COMPARE = new THREE.Color('#7c3aed');

function baseColor(b: TwinBuilding, colorBy: ColorBy, maxHeight: number, target: THREE.Color) {
  switch (colorBy) {
    case 'type':
      return target.set(TYPE_COLORS[b.typeKey] ?? TYPE_FALLBACK);
    case 'height':
      return sampleRamp(HEIGHT_RAMP, Math.sqrt(b.height / Math.max(1, maxHeight)), target);
    case 'heightSource':
      return target.set(SOURCE_COLORS[b.source]);
    default: {
      const s = SIM_SCALES[colorBy];
      return sampleRamp([...s.stops], (metricValue(b, colorBy) - s.min) / (s.max - s.min), target);
    }
  }
}

/**
 * All buildings merged into one mesh (one draw call) with a per-vertex building
 * id for picking and per-vertex colours for styling and highlight.
 */
export function BuildingsLayer({ visibleSet }: { visibleSet: Set<number> }) {
  const model = useTwinModel();
  const exaggeration = useTwinStore((s) => s.exaggeration);
  const relief = useTwinStore((s) => s.layers.terrain);
  const colorBy = useTwinStore((s) => s.colorBy);
  const markEstimated = useTwinStore((s) => s.markEstimated);
  const ex = relief && model.terrain ? exaggeration : 0;

  const material = useMemo(() => createBuildingMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  material.userData.uMark.value = markEstimated ? 1 : 0;

  const { geometry, edges, ranges } = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const ranges = new Map<number, [number, number]>();
    let cursor = 0;
    for (const b of model.buildings) {
      if (b.supersededBy !== null || !visibleSet.has(b.index)) continue;
      const g = buildingGeometry(b, ex);
      ranges.set(b.index, [cursor, g.attributes.position.count]);
      cursor += g.attributes.position.count;
      parts.push(g);
    }
    if (!parts.length) return { geometry: null, edges: null, ranges };
    const geometry = mergeGeometries(parts, false)!;
    geometry.computeBoundingSphere();
    const edges = new THREE.EdgesGeometry(geometry, 25);
    parts.forEach((p) => p.dispose());
    return { geometry, edges, ranges };
  }, [model, visibleSet, ex]);

  useEffect(
    () => () => {
      geometry?.dispose();
      edges?.dispose();
    },
    [geometry, edges],
  );

  // Colours: base style + hover / selection, written into the vertex colour buffer.
  useEffect(() => {
    if (!geometry) return;
    const colorAttr = geometry.attributes.color as THREE.BufferAttribute;
    const arr = colorAttr.array as Float32Array;
    const c = new THREE.Color();
    const s0 = useTwinStore.getState();
    type S = typeof s0;
    const sel = (s: S) => (s.selection?.kind === 'building' ? s.selection.index : null);
    // Pointer hover in the scene, or a building located from the UI.
    const lit = (s: S) => s.hovered ?? s.located;
    // Compared buildings by index; ids not in this area (e.g. after an area switch) are skipped.
    const comparedOf = (s: S) => new Set(s.compareIds.map((id) => model.buildingIndexById.get(id)).filter((i): i is number => i !== undefined));
    let compared = comparedOf(s0);
    const paint = (index: number, s: S) => {
      const range = ranges.get(index);
      if (!range) return;
      baseColor(model.buildings[index], colorBy, model.stats.maxHeight, c);
      if (index === sel(s)) c.lerp(SELECT, 0.55);
      else if (compared.has(index)) c.lerp(COMPARE, index === lit(s) ? 0.3 : 0.6);
      else if (index === lit(s)) c.lerp(HOVER, 0.6);
      for (let v = range[0]; v < range[0] + range[1]; v++) arr.set([c.r, c.g, c.b], v * 3);
    };
    for (const index of ranges.keys()) paint(index, s0);
    colorAttr.needsUpdate = true;
    return useTwinStore.subscribe((s, p) => {
      const compareChanged = s.compareIds !== p.compareIds;
      if (lit(s) === lit(p) && sel(s) === sel(p) && !compareChanged) return;
      const dirty = new Set([lit(p), lit(s), sel(p), sel(s)]);
      if (compareChanged) {
        const next = comparedOf(s);
        for (const i of compared) if (!next.has(i)) dirty.add(i);
        for (const i of next) if (!compared.has(i)) dirty.add(i);
        compared = next;
      }
      for (const i of dirty) if (i !== null) paint(i, s);
      colorAttr.needsUpdate = true;
    });
  }, [geometry, ranges, colorBy, model]);

  if (!geometry || !edges) return null;

  const idOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (e.faceIndex == null) return null;
    const bid = geometry.attributes.aBid as THREE.BufferAttribute;
    // Non-indexed geometry: face i uses vertices 3i..3i+2.
    return bid.getX(e.faceIndex * 3);
  };

  return (
    <group>
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onPointerMove={(e) => {
          e.stopPropagation();
          const id = idOf(e);
          updateMeasureCursor(e.point, id);
          if (id !== null && useTwinStore.getState().hovered !== id) useTwinStore.getState().setHovered(id);
        }}
        onPointerOut={() => {
          clearMeasureCursor();
          if (useTwinStore.getState().hovered !== null) useTwinStore.getState().setHovered(null);
        }}
        onClick={(e) => {
          if (e.delta > 5) return;
          e.stopPropagation();
          const id = idOf(e);
          if (id !== null) handleSceneClick(model, e.point, id, e.nativeEvent.shiftKey);
        }}
      />
      <lineSegments geometry={edges} raycast={() => null}>
        <lineBasicMaterial color="#334155" transparent opacity={0.28} />
      </lineSegments>
    </group>
  );
}
