import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { DISTRICTS } from '../../data/cyberpunk/districts';
import { LENS_SCALES, lensValue } from '../../data/cyberpunk/simulatedMetrics';
import { useCyberStore } from '../../stores/cyberpunkStore';
import { sampleRamp } from '../../utils/colorRamp';
import type { PartShape } from './cityGenerator';
import { createShapeGeometry, useCyberResources } from './resources';

const SHAPES: PartShape[] = ['box', 'oct', 'cyl', 'spire'];

interface ShapeBatch {
  shape: PartShape;
  mesh: THREE.InstancedMesh;
  /** instance index → building id */
  buildingOf: Int32Array;
  overlay: THREE.InstancedBufferAttribute;
  state: THREE.InstancedBufferAttribute;
}

const ACCENT_STRENGTH = { plaza: 1.2, financial: 1, market: 0.85, industrial: 0.5, residential: 0.35 } as const;

/**
 * All procedural buildings, drawn as one InstancedMesh per primitive shape with
 * a single shared facade material. Hover / selection / data-lens state lives in
 * per-instance attributes, so interaction never creates materials or meshes.
 */
export function BuildingInstances({ visible }: { visible: boolean }) {
  const { plan, facade } = useCyberResources();

  const { batches, instancesOf } = useMemo(() => {
    const instancesOf: { batch: number; index: number }[][] = plan.buildings.map(() => []);
    const tmpM = new THREE.Matrix4();
    const tmpQ = new THREE.Quaternion();
    const tmpE = new THREE.Euler();
    const tmpP = new THREE.Vector3();
    const tmpS = new THREE.Vector3();
    const tint = new THREE.Color();
    const accent = new THREE.Color();

    const batches: ShapeBatch[] = [];
    for (const shape of SHAPES) {
      const parts = plan.parts.filter((p) => p.shape === shape);
      if (!parts.length) continue;
      const geometry = createShapeGeometry(shape);
      const n = parts.length;
      const aTint = new Float32Array(n * 4);
      const aParams = new Float32Array(n * 4);
      const aAccent = new Float32Array(n * 4);
      const mesh = new THREE.InstancedMesh(geometry, facade, n);
      const buildingOf = new Int32Array(n);
      parts.forEach((p, i) => {
        const b = plan.buildings[p.buildingId];
        const def = DISTRICTS[b.district];
        tmpE.set(p.rx, p.ry, p.rz);
        tmpQ.setFromEuler(tmpE);
        tmpP.set(p.x, p.y, p.z);
        // Horizontal pipes: rotating +90° about Z maps local +Y to world −X, so shift to centre the run on p.x.
        if (p.rz !== 0) tmpP.set(p.x + p.h / 2, p.y, p.z);
        tmpS.set(p.w, p.h, p.d);
        tmpM.compose(tmpP, tmpQ, tmpS);
        mesh.setMatrixAt(i, tmpM);
        tint.set(def.windowTint);
        aTint.set([tint.r, tint.g, tint.b, b.litRatio], i * 4);
        aParams.set([b.seed % 10000, p.style, b.windowWidth, b.floorHeight], i * 4);
        accent.set(def.accent);
        aAccent.set([accent.r, accent.g, accent.b, p.crown ? ACCENT_STRENGTH[b.district] : 0], i * 4);
        buildingOf[i] = b.id;
        instancesOf[b.id].push({ batch: batches.length, index: i });
      });
      geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 4));
      geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(aParams, 4));
      geometry.setAttribute('aAccent', new THREE.InstancedBufferAttribute(aAccent, 4));
      const overlay = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
      const state = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
      overlay.setUsage(THREE.DynamicDrawUsage);
      state.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('aOverlay', overlay);
      geometry.setAttribute('aState', state);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.buildingOf = buildingOf;
      batches.push({ shape, mesh, buildingOf, overlay, state });
    }
    return { batches, instancesOf };
  }, [plan, facade]);

  useEffect(() => () => batches.forEach((b) => b.mesh.geometry.dispose()), [batches]);

  // Hover / selection highlight → aState.
  useEffect(() => {
    const write = (id: number | null, channel: 0 | 1, value: number) => {
      if (id === null || !instancesOf[id]) return;
      for (const { batch, index } of instancesOf[id]) {
        const attr = batches[batch].state;
        attr.setComponent(index, channel, value);
        attr.needsUpdate = true;
      }
    };
    let prev = useCyberStore.getState();
    write(prev.hoveredId, 0, 1);
    write(prev.selectedId, 1, 1);
    return useCyberStore.subscribe((s) => {
      if (s.hoveredId !== prev.hoveredId) {
        write(prev.hoveredId, 0, 0);
        write(s.hoveredId, 0, 1);
      }
      if (s.selectedId !== prev.selectedId) {
        write(prev.selectedId, 1, 0);
        write(s.selectedId, 1, 1);
      }
      prev = s;
    });
  }, [batches, instancesOf]);

  // Data lens → aOverlay.
  useEffect(() => {
    const color = new THREE.Color();
    const apply = (lens: ReturnType<typeof useCyberStore.getState>['dataLens']) => {
      for (const batch of batches) {
        const arr = batch.overlay.array as Float32Array;
        for (let i = 0; i < batch.buildingOf.length; i++) {
          if (lens === 'none') {
            arr[i * 4 + 3] = 0;
            continue;
          }
          const scale = LENS_SCALES[lens];
          const b = plan.buildings[batch.buildingOf[i]];
          const t = (lensValue(lens, b.metrics) - scale.min) / (scale.max - scale.min);
          sampleRamp(scale.stops, t, color);
          arr.set([color.r, color.g, color.b, 0.85], i * 4);
        }
        batch.overlay.needsUpdate = true;
      }
    };
    apply(useCyberStore.getState().dataLens);
    return useCyberStore.subscribe((s, p) => {
      if (s.dataLens !== p.dataLens) apply(s.dataLens);
    });
  }, [batches, plan]);

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const map = (e.object as THREE.InstancedMesh).userData.buildingOf as Int32Array | undefined;
    if (!map || e.instanceId === undefined) return;
    const id = map[e.instanceId];
    if (useCyberStore.getState().hoveredId !== id) useCyberStore.getState().setHovered(id);
  };

  const handleOut = () => {
    if (useCyberStore.getState().hoveredId !== null) useCyberStore.getState().setHovered(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Ignore clicks that were really camera drags.
    if (e.delta > 6) return;
    const map = (e.object as THREE.InstancedMesh).userData.buildingOf as Int32Array | undefined;
    if (!map || e.instanceId === undefined) return;
    useCyberStore.getState().select(map[e.instanceId]);
  };

  return (
    <group visible={visible}>
      {batches.map((b) => (
        <primitive
          key={b.shape}
          object={b.mesh}
          onPointerMove={visible ? handleMove : undefined}
          onPointerOut={visible ? handleOut : undefined}
          onClick={visible ? handleClick : undefined}
        />
      ))}
    </group>
  );
}
