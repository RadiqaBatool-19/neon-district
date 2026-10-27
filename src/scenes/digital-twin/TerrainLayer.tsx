import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useTwinStore } from '../../stores/twinStore';
import { createGroundCanvas, drawGround, groundUv } from './groundTexture';
import { handleSceneClick } from './picking';
import { useTwinModel } from './TwinModelContext';

const SEG = 96;
const PLINTH_DEPTH = 18;

/**
 * DEM terrain (or a flat plate when no DEM is available) draped with a canvas
 * texture holding land use, roads, the simulated surface overlay and the
 * footprints of filtered-out buildings. A plinth makes the extract read as a
 * deliberate model tile rather than a floating cut.
 */
export function TerrainLayer({ ghostFootprints }: { ghostFootprints: import('../../data/digital-twin/buildTwinModel').Ring[][][] }) {
  const model = useTwinModel();
  const layers = useTwinStore((s) => s.layers);
  const surface = useTwinStore((s) => s.surface);
  const exaggeration = useTwinStore((s) => s.exaggeration);
  const selection = useTwinStore((s) => s.selection);
  const { canvas, texture } = useMemo(createGroundCanvas, []);

  const showRelief = layers.terrain && !!model.terrain;
  const ex = showRelief ? exaggeration : 0;

  const geometry = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = model.extent;
    const g = new THREE.PlaneGeometry(1, 1, SEG, SEG);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      // PlaneGeometry spans [-0.5, 0.5] in x/y; map to the extent with y → z (north = minZ).
      const x = minX + (pos.getX(i) + 0.5) * (maxX - minX);
      const z = minZ + (0.5 - pos.getY(i)) * (maxZ - minZ);
      const y = model.terrain ? model.terrain.sample(x, z) * ex : 0;
      pos.setXYZ(i, x, y, z);
      const [u, v] = groundUv(model, x, z);
      uv.setXY(i, u, v);
    }
    g.computeVertexNormals();
    return g;
  }, [model, ex]);

  // Plinth: vertical skirt from the terrain edge down to a common base.
  const plinth = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = model.extent;
    const edge: [number, number][] = [];
    const n = SEG;
    for (let i = 0; i <= n; i++) edge.push([minX + (i / n) * (maxX - minX), minZ]);
    for (let i = 1; i <= n; i++) edge.push([maxX, minZ + (i / n) * (maxZ - minZ)]);
    for (let i = 1; i <= n; i++) edge.push([maxX - (i / n) * (maxX - minX), maxZ]);
    for (let i = 1; i <= n; i++) edge.push([minX, maxZ - (i / n) * (maxZ - minZ)]);
    const pos: number[] = [];
    const idx: number[] = [];
    edge.forEach(([x, z], k) => {
      const y = model.terrain ? model.terrain.sample(x, z) * ex : 0;
      pos.push(x, y, z, x, -PLINTH_DEPTH, z);
      if (k > 0) {
        const a = (k - 1) * 2;
        const b = k * 2;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [model, ex]);

  useEffect(
    () => () => {
      geometry.dispose();
      plinth.dispose();
    },
    [geometry, plinth],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  const selectedRoad = selection?.kind === 'road' ? selection.index : null;
  useEffect(() => {
    drawGround(canvas, model, { roads: layers.roads, landuse: layers.landuse, surface, selectedRoad, ghostFootprints });
    texture.needsUpdate = true;
  }, [canvas, texture, model, layers.roads, layers.landuse, surface, selectedRoad, ghostFootprints]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 5) return;
    e.stopPropagation();
    handleSceneClick(model, e.point, null);
  };

  const { minX, maxX, minZ, maxZ } = model.extent;
  return (
    <group>
      <mesh geometry={geometry} receiveShadow onClick={onClick}>
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
      </mesh>
      <mesh geometry={plinth}>
        <meshStandardMaterial color="#b9c0ca" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[(minX + maxX) / 2, -PLINTH_DEPTH, (minZ + maxZ) / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[maxX - minX, maxZ - minZ]} />
        <meshStandardMaterial color="#a9b1bc" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
