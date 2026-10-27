import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CITY } from '../../data/cyberpunk/config';
import { useCyberResources } from './resources';

const POLE_H = 7.2;

/** Ground, sidewalks, street lights and their light pools. */
export function StreetLevel({ visible }: { visible: boolean }) {
  const { plan, ground, glow } = useCyberResources();
  const blocks = useMemo(() => plan.blocks.filter((b) => b.district !== 'plaza'), [plan]);
  const lights = plan.streetLights;

  const slabRef = useRef<THREE.InstancedMesh>(null);
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const poolRef = useRef<THREE.InstancedMesh>(null);

  const poolGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const colors = new Float32Array(lights.length * 4);
    const c = new THREE.Color();
    lights.forEach((_, i) => {
      // Mostly cool white, with an occasional sodium-amber lamp.
      c.set(i % 9 === 0 ? '#ffb070' : '#9fdcff');
      colors.set([c.r, c.g, c.b, 0.32], i * 4);
    });
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 4));
    return g;
  }, [lights]);
  useEffect(() => () => poolGeometry.dispose(), [poolGeometry]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    blocks.forEach((b, i) => {
      m.compose(p.set(b.x, 0, b.z), q.identity(), s.set(CITY.blockSize, 0.22, CITY.blockSize));
      slabRef.current!.setMatrixAt(i, m);
    });
    slabRef.current!.instanceMatrix.needsUpdate = true;
    slabRef.current!.computeBoundingSphere();

    lights.forEach((l, i) => {
      const dx = Math.cos(l.rot);
      const dz = Math.sin(l.rot);
      m.compose(p.set(l.x, 0, l.z), q.identity(), s.set(1, POLE_H, 1));
      poleRef.current!.setMatrixAt(i, m);
      q.setFromAxisAngle(up, -l.rot);
      m.compose(p.set(l.x + dx * 1.1, POLE_H - 0.1, l.z + dz * 1.1), q, s.set(2.2, 0.14, 0.14));
      armRef.current!.setMatrixAt(i, m);
      m.compose(p.set(l.x + dx * 2.0, POLE_H - 0.28, l.z + dz * 2.0), q, s.set(1.0, 0.16, 0.42));
      headRef.current!.setMatrixAt(i, m);
      m.compose(p.set(l.x + dx * 2.6, 0.08, l.z + dz * 2.6), q.identity(), s.set(15, 1, 15));
      poolRef.current!.setMatrixAt(i, m);
    });
    for (const r of [poleRef, armRef, headRef, poolRef]) {
      r.current!.instanceMatrix.needsUpdate = true;
      r.current!.computeBoundingSphere();
    }
  }, [blocks, lights]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={ground} receiveShadow>
        <planeGeometry args={[3600, 3600, 1, 1]} />
      </mesh>
      <group visible={visible}>
        <instancedMesh ref={slabRef} args={[undefined, undefined, blocks.length]} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#10121a" roughness={0.85} metalness={0.15} />
        </instancedMesh>
        <instancedMesh ref={poleRef} args={[undefined, undefined, lights.length]}>
          <cylinderGeometry args={[0.09, 0.12, 1, 6, 1]} />
          <meshStandardMaterial color="#1b1e28" roughness={0.5} metalness={0.8} />
        </instancedMesh>
        <instancedMesh ref={armRef} args={[undefined, undefined, lights.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#1b1e28" roughness={0.5} metalness={0.8} />
        </instancedMesh>
        <instancedMesh ref={headRef} args={[undefined, undefined, lights.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={new THREE.Color('#cfefff').multiplyScalar(3.2)} toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={poolRef} args={[poolGeometry, glow, lights.length]} renderOrder={2} />
      </group>
    </group>
  );
}
