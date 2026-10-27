import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OUTSIDE_INDEX } from '../../data/cyberpunk/citySimulation';
import { CITY_HALF_EXTENT } from '../../data/cyberpunk/config';
import { createRng } from '../../utils/random';
import { useCyberResources } from './resources';

const TINTS = ['#8fd8ff', '#ff9be6', '#ffd3a1', '#a99bff'];

/**
 * Low-detail silhouettes beyond the playable grid. They share the facade
 * shader (so windows read consistently) but are not interactive and cast no shadows.
 */
export function DistantSkyline({ count = 520 }: { count?: number }) {
  const { facade } = useCyberResources();

  const mesh = useMemo(() => {
    const rng = createRng(4242);
    const geometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const m = new THREE.InstancedMesh(geometry, facade, count);
    const tint = new Float32Array(count * 4);
    const params = new Float32Array(count * 4);
    const accent = new Float32Array(count * 4);
    const mat = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = CITY_HALF_EXTENT + 90 + Math.pow(rng.next(), 0.7) * 1100;
      const near = 1 - (r - CITY_HALF_EXTENT) / 1200;
      // Kept below the core towers so the Aurora Spire stays the tallest silhouette.
      const h = rng.range(25, 95) + (rng.chance(0.15) ? rng.range(50, 150) * (0.4 + near) : 0);
      const w = rng.range(18, 50);
      const d = rng.range(18, 50);
      mat.makeScale(w, h, d).setPosition(Math.cos(a) * r, 0, Math.sin(a) * r);
      m.setMatrixAt(i, mat);
      c.set(rng.pick(TINTS));
      tint.set([c.r, c.g, c.b, rng.range(0.25, 0.55)], i * 4);
      params.set([rng.int(0, 9999), rng.chance(0.4) ? 1 : 0, rng.range(2, 3), 3.8], i * 4);
      c.set(rng.chance(0.5) ? '#3ef0ff' : '#ff2bd6');
      accent.set([c.r, c.g, c.b, rng.chance(0.25) ? 0.7 : 0], i * 4);
    }
    geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 4));
    geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4));
    geometry.setAttribute('aAccent', new THREE.InstancedBufferAttribute(accent, 4));
    geometry.setAttribute('aDistrict', new THREE.InstancedBufferAttribute(new Float32Array(count).fill(OUTSIDE_INDEX), 1));
    geometry.setAttribute('aOverlay', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
    geometry.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.raycast = () => {};
    return m;
  }, [facade, count]);

  useEffect(() => () => mesh.geometry.dispose(), [mesh]);

  return <primitive object={mesh} />;
}
