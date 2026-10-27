import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CITY_HALF_EXTENT, PITCH } from '../../data/cyberpunk/config';
import { buildDeckGeometry, buildEdgeStripGeometry, getHighways } from './highwayPaths';

/** Elevated highway decks, glowing barrier strips and support pillars. */
export function Highways({ visible }: { visible: boolean }) {
  const highways = getHighways();
  const pillarRef = useRef<THREE.InstancedMesh>(null);

  const geos = useMemo(
    () => highways.map((h) => ({ id: h.id, deck: buildDeckGeometry(h), strip: buildEdgeStripGeometry(h), accent: h.accent })),
    [highways],
  );
  const stripMats = useMemo(
    () => geos.map((g) => new THREE.MeshBasicMaterial({ color: new THREE.Color(g.accent).multiplyScalar(2.2), side: THREE.DoubleSide, toneMapped: false })),
    [geos],
  );

  // Pillars every ~32 m, skipped where they would land inside a building block.
  const pillars = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const h of highways) {
      const step = Math.max(1, Math.round((32 / h.lut.length) * h.lut.samples));
      for (let i = 0; i <= h.lut.samples; i += step) {
        const x = h.lut.points[i * 3];
        const y = h.lut.points[i * 3 + 1];
        const z = h.lut.points[i * 3 + 2];
        if (Math.max(Math.abs(x), Math.abs(z)) > CITY_HALF_EXTENT + 400) continue;
        const lx = Math.abs((((x + PITCH / 2) % PITCH) + PITCH) % PITCH - PITCH / 2);
        const lz = Math.abs((((z + PITCH / 2) % PITCH) + PITCH) % PITCH - PITCH / 2);
        const inCity = Math.max(Math.abs(x), Math.abs(z)) < CITY_HALF_EXTENT;
        if (inCity && lx < 29 && lz < 29) continue;
        out.push([x, y - 1.3, z]);
      }
    }
    return out;
  }, [highways]);

  useEffect(
    () => () => {
      geos.forEach((g) => {
        g.deck.dispose();
        g.strip.dispose();
      });
      stripMats.forEach((m) => m.dispose());
    },
    [geos, stripMats],
  );

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    pillars.forEach(([x, y, z], i) => {
      m.makeScale(1, y, 1).setPosition(x, 0, z);
      pillarRef.current!.setMatrixAt(i, m);
    });
    pillarRef.current!.instanceMatrix.needsUpdate = true;
    pillarRef.current!.computeBoundingSphere();
  }, [pillars]);

  const pillarGeo = useMemo(() => new THREE.CylinderGeometry(1.1, 1.4, 1, 10, 1).translate(0, 0.5, 0), []);
  useEffect(() => () => pillarGeo.dispose(), [pillarGeo]);

  return (
    <group visible={visible}>
      {geos.map((g, i) => (
        <group key={g.id}>
          <mesh geometry={g.deck} castShadow receiveShadow>
            <meshStandardMaterial color="#14161f" roughness={0.55} metalness={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={g.strip} material={stripMats[i]} />
        </group>
      ))}
      <instancedMesh ref={pillarRef} args={[pillarGeo, undefined, pillars.length]} castShadow>
        <meshStandardMaterial color="#12141c" roughness={0.7} metalness={0.3} />
      </instancedMesh>
    </group>
  );
}
