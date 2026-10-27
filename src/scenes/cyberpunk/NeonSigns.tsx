import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { signUvRect } from './signAtlas';
import { useCyberResources } from './resources';

/**
 * Neon signage (one instanced draw call) plus soft coloured glow decals on the
 * street beneath low signs. The decals are a stylised stand-in for wet-street
 * reflections — they are not computed reflections.
 */
export function NeonSigns({ visible, streetGlow }: { visible: boolean; streetGlow: boolean }) {
  const { plan, sign, glow } = useCyberResources();
  const signs = plan.signs;
  const signRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);

  const lowSigns = useMemo(() => signs.filter((s) => s.y < 45 && s.style !== 'band'), [signs]);

  const signGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    const uv = new Float32Array(signs.length * 4);
    const color = new Float32Array(signs.length * 3);
    const anim = new Float32Array(signs.length * 3);
    const c = new THREE.Color();
    signs.forEach((s, i) => {
      uv.set(signUvRect(s), i * 4);
      c.set(s.color);
      color.set([c.r, c.g, c.b], i * 3);
      anim.set([s.anim, (s.seed % 1000) * 0.137, s.style === 'blade' ? 0 : 1], i * 3);
    });
    g.setAttribute('aUv', new THREE.InstancedBufferAttribute(uv, 4));
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
    g.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 3));
    return g;
  }, [signs]);

  const glowGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const col = new Float32Array(lowSigns.length * 4);
    const c = new THREE.Color();
    lowSigns.forEach((s, i) => {
      c.set(s.color);
      col.set([c.r, c.g, c.b, s.style === 'billboard' ? 0.35 : 0.55], i * 4);
    });
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 4));
    return g;
  }, [lowSigns]);

  useEffect(
    () => () => {
      signGeometry.dispose();
      glowGeometry.dispose();
    },
    [signGeometry, glowGeometry],
  );

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    signs.forEach((sg, i) => {
      q.setFromAxisAngle(up, sg.rotY);
      m.compose(p.set(sg.x, sg.y, sg.z), q, s.set(sg.w, sg.h, 1));
      signRef.current!.setMatrixAt(i, m);
    });
    signRef.current!.instanceMatrix.needsUpdate = true;
    signRef.current!.computeBoundingSphere();

    lowSigns.forEach((sg, i) => {
      // Push the pool out from the facade toward the street.
      const nx = Math.sin(sg.rotY);
      const nz = Math.cos(sg.rotY);
      const out = sg.style === 'blade' ? 0 : 4;
      const r = sg.style === 'blade' ? Math.min(16, sg.h * 1.25) : Math.min(22, sg.w * 1.2);
      q.identity();
      m.compose(p.set(sg.x + nx * out, 0.1, sg.z + nz * out), q, s.set(r, 1, r));
      glowRef.current!.setMatrixAt(i, m);
    });
    glowRef.current!.instanceMatrix.needsUpdate = true;
    glowRef.current!.computeBoundingSphere();
  }, [signs, lowSigns]);

  return (
    <group visible={visible}>
      <instancedMesh ref={signRef} args={[signGeometry, sign, signs.length]} />
      <instancedMesh ref={glowRef} args={[glowGeometry, glow, Math.max(1, lowSigns.length)]} visible={streetGlow} renderOrder={2} />
    </group>
  );
}
