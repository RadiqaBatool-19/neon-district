import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { getCityPlan, type CityPlan, type PartShape } from './cityGenerator';
import {
  createBeaconMaterial,
  createCyberUniforms,
  createFacadeMaterial,
  createGlowDecalMaterial,
  createGroundMaterial,
  createSignMaterial,
  type CyberUniforms,
} from './materials';
import { createSignAtlas } from './signAtlas';

/** Twisted, tapering tower geometry for the Aurora Spire (unit size, base at y = 0). */
function createSpireGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 64, 1).translate(0, 0.5, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = v.y;
    const angle = t * Math.PI * 0.55;
    const taper = 1 - 0.5 * Math.pow(t, 1.4);
    const x = v.x * taper;
    const z = v.z * taper;
    pos.setXYZ(i, x * Math.cos(angle) - z * Math.sin(angle), v.y, x * Math.sin(angle) + z * Math.cos(angle));
  }
  g.computeVertexNormals();
  return g;
}

function flat(g: THREE.BufferGeometry) {
  const n = g.toNonIndexed();
  n.computeVertexNormals();
  g.dispose();
  return n;
}

export function createShapeGeometry(shape: PartShape): THREE.BufferGeometry {
  switch (shape) {
    case 'box':
      return new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    case 'oct':
      return flat(new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1).rotateY(Math.PI / 8).translate(0, 0.5, 0));
    case 'cyl':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1).translate(0, 0.5, 0);
    case 'spire':
      return createSpireGeometry();
  }
}

export interface CyberResources {
  plan: CityPlan;
  uniforms: CyberUniforms;
  atlas: THREE.CanvasTexture;
  facade: THREE.MeshStandardMaterial;
  ground: THREE.MeshStandardMaterial;
  sign: THREE.ShaderMaterial;
  beacon: THREE.MeshBasicMaterial;
  glow: THREE.ShaderMaterial;
}

const Ctx = createContext<CyberResources | null>(null);

export function CyberResourcesProvider({ children }: { children: ReactNode }) {
  const res = useMemo<CyberResources>(() => {
    const uniforms = createCyberUniforms();
    const atlas = createSignAtlas();
    return {
      plan: getCityPlan(),
      uniforms,
      atlas,
      facade: createFacadeMaterial(uniforms),
      ground: createGroundMaterial(uniforms),
      sign: createSignMaterial(uniforms, atlas),
      beacon: createBeaconMaterial(uniforms),
      glow: createGlowDecalMaterial(),
    };
  }, []);

  useEffect(
    () => () => {
      // three re-uploads disposed resources if they are used again (e.g. React StrictMode remount).
      res.atlas.dispose();
      res.facade.dispose();
      res.ground.dispose();
      res.sign.dispose();
      res.beacon.dispose();
      res.glow.dispose();
    },
    [res],
  );

  return <Ctx.Provider value={res}>{children}</Ctx.Provider>;
}

export function useCyberResources(): CyberResources {
  const r = useContext(Ctx);
  if (!r) throw new Error('useCyberResources must be used inside CyberResourcesProvider');
  return r;
}
