import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { RoofProp, RoofPropKind } from './cityGenerator';
import { useCyberResources } from './resources';

const KINDS: RoofPropKind[] = ['ac', 'tank', 'antenna', 'dish', 'helipad'];

/** Rooftop mechanical kit and blinking aviation beacons, instanced per kind. */
export function RoofProps({ visible, detail }: { visible: boolean; detail: number }) {
  const { plan, beacon } = useCyberResources();

  const byKind = useMemo(() => {
    const out: Record<RoofPropKind, RoofProp[]> = { ac: [], tank: [], antenna: [], dish: [], helipad: [] };
    // Deterministic thinning for lower detail levels (antennas and helipads always kept).
    plan.roofProps.forEach((p, i) => {
      if ((p.kind === 'ac' || p.kind === 'dish' || p.kind === 'tank') && ((i * 2654435761) >>> 0) / 4294967296 > detail) return;
      out[p.kind].push(p);
    });
    return out;
  }, [plan, detail]);

  const refs = {
    ac: useRef<THREE.InstancedMesh>(null),
    tank: useRef<THREE.InstancedMesh>(null),
    antenna: useRef<THREE.InstancedMesh>(null),
    dish: useRef<THREE.InstancedMesh>(null),
    helipad: useRef<THREE.InstancedMesh>(null),
  };
  const beaconRef = useRef<THREE.InstancedMesh>(null);

  // Unit geometries with their base at y = 0 so instance scale.y is the prop height.
  const geo = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      tank: new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1).translate(0, 0.5, 0),
      antenna: new THREE.CylinderGeometry(0.15, 0.5, 1, 5, 1).translate(0, 0.5, 0),
      pad: new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1).translate(0, 0.5, 0),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const kind of KINDS) {
      const mesh = refs[kind].current;
      if (!mesh) continue;
      byKind[kind].forEach((prop, i) => {
        if (kind === 'ac') s.set(prop.s, prop.h, prop.s * 0.7);
        else s.set(prop.s, prop.h, prop.s);
        m.compose(p.set(prop.x, prop.y, prop.z), q.identity(), s);
        mesh.setMatrixAt(i, m);
      });
      mesh.count = byKind[kind].length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    const bm = beaconRef.current!;
    plan.beacons.forEach((b, i) => {
      m.compose(p.set(b.x, b.y, b.z), q.identity(), s.setScalar(0.9));
      bm.setMatrixAt(i, m);
    });
    bm.instanceMatrix.needsUpdate = true;
    bm.computeBoundingSphere();
  }, [byKind, plan]);

  const max = (k: RoofPropKind) => Math.max(1, byKind[k].length);

  return (
    <group visible={visible}>
      <instancedMesh ref={refs.ac} args={[geo.box, undefined, max('ac')]} castShadow>
        <meshStandardMaterial color="#20232d" roughness={0.6} metalness={0.7} />
      </instancedMesh>
      <instancedMesh ref={refs.tank} args={[geo.tank, undefined, max('tank')]} castShadow>
        <meshStandardMaterial color="#1c1f27" roughness={0.5} metalness={0.8} />
      </instancedMesh>
      <instancedMesh ref={refs.antenna} args={[geo.antenna, undefined, max('antenna')]}>
        <meshStandardMaterial color="#2a2d38" roughness={0.4} metalness={0.9} />
      </instancedMesh>
      <instancedMesh ref={refs.dish} args={[undefined, undefined, max('dish')]}>
        <sphereGeometry args={[0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3a3e4c" roughness={0.4} metalness={0.6} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={refs.helipad} args={[geo.pad, undefined, max('helipad')]}>
        <meshStandardMaterial color="#14161e" roughness={0.7} emissive="#1d3a52" emissiveIntensity={0.6} />
      </instancedMesh>
      <instancedMesh ref={beaconRef} args={[undefined, beacon, plan.beacons.length]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 6, 4]} />
      </instancedMesh>
    </group>
  );
}
