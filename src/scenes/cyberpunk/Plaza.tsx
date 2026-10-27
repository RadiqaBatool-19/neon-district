import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CITY } from '../../data/cyberpunk/config';
import { HORIZONTAL_WORDS } from './cityGenerator';
import { useCyberResources } from './resources';

const PLAZA_R = CITY.blockSize / 2 - 0.5;

function fogAware(vertex: string, fragment: string, uniforms: Record<string, THREE.IUniform>, opts: Partial<THREE.ShaderMaterialParameters> = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: vertex,
    fragmentShader: fragment,
    fog: true,
    ...opts,
  });
  Object.assign(mat.uniforms, uniforms);
  return mat;
}

const VERT = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec2 vUv; varying vec3 vPos;
  void main() {
    vUv = uv; vPos = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

/** The Central Plaza: ring-lit floor, light pillars, spire halos, a sky beam and holographic panels. */
export function Plaza() {
  const { uniforms, atlas } = useCyberResources();
  const holoGroup = useRef<THREE.Group>(null);
  const haloA = useRef<THREE.Mesh>(null);
  const haloB = useRef<THREE.Mesh>(null);
  const pillarRef = useRef<THREE.InstancedMesh>(null);

  const mats = useMemo(() => {
    const floor = fogAware(
      VERT,
      /* glsl */ `
      uniform float uTime;
      #include <common>
      #include <fog_pars_fragment>
      varying vec2 vUv; varying vec3 vPos;
      void main() {
        float r = length(vPos.xy);
        float a = atan(vPos.y, vPos.x);
        float rings = 1.0 - smoothstep(0.0, 0.08, abs(fract(r / 3.2) - 0.5) - 0.44);
        float spokes = 1.0 - smoothstep(0.0, 0.015, abs(fract(a / 6.2831853 * 24.0) - 0.5) - 0.48);
        spokes *= step(8.0, r);
        float pulse = 1.0 - smoothstep(0.0, 1.2, abs(r - mod(uTime * 7.0, 34.0)));
        float edge = 1.0 - smoothstep(0.0, 0.5, abs(r - ${PLAZA_R.toFixed(1)} + 0.6));
        vec3 base = vec3(0.012, 0.014, 0.022) + vec3(0.01) * step(0.5, fract(r / 3.2));
        vec3 cyan = vec3(0.25, 0.9, 1.0);
        vec3 col = base + cyan * (rings * 0.10 + spokes * 0.08 + pulse * 0.6 * (1.0 - r / 34.0) + edge * 1.6);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
      { uTime: uniforms.uTime },
    );

    const beam = fogAware(
      VERT,
      /* glsl */ `
      uniform float uTime;
      #include <common>
      #include <fog_pars_fragment>
      varying vec2 vUv; varying vec3 vPos;
      void main() {
        float fade = pow(1.0 - vUv.y, 1.6);
        float flow = 0.75 + 0.25 * sin(vUv.y * 40.0 - uTime * 3.0);
        gl_FragColor = vec4(vec3(0.35, 0.85, 1.0) * fade * flow * 0.55, 1.0);
      }`,
      { uTime: uniforms.uTime },
      { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false },
    );

    const wordRow = HORIZONTAL_WORDS.indexOf('NEXUS');
    const holo = fogAware(
      VERT,
      /* glsl */ `
      uniform float uTime; uniform sampler2D uAtlas; uniform vec4 uRect;
      #include <common>
      #include <fog_pars_fragment>
      varying vec2 vUv; varying vec3 vPos;
      void main() {
        vec2 suv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
        float text = texture2D(uAtlas, mix(uRect.xy, uRect.zw, suv)).r;
        float scan = 0.6 + 0.4 * sin(vUv.y * 140.0 - uTime * 6.0);
        vec2 e = min(vUv, 1.0 - vUv);
        float frame = 1.0 - smoothstep(0.0, 0.02, min(e.x, e.y));
        float glitch = step(0.97, fract(sin(floor(uTime * 6.0) * 91.7) * 4375.5));
        vec3 col = vec3(0.3, 0.85, 1.0) * (text * 1.8 * scan + frame * 0.9 + 0.06) * (1.0 - glitch * 0.7);
        gl_FragColor = vec4(col, 1.0);
      }`,
      {
        uTime: uniforms.uTime,
        uAtlas: { value: atlas },
        uRect: { value: new THREE.Vector4(0.25 - 0.16, 1 - ((wordRow + 1) * 128) / 2048, 0.25 + 0.16, 1 - (wordRow * 128) / 2048) },
      },
      { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false },
    );

    const halo = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5fe9ff').multiplyScalar(3), toneMapped: false });
    const pillar = new THREE.MeshBasicMaterial({ color: new THREE.Color('#7af3ff').multiplyScalar(2.4), toneMapped: false });
    return { floor, beam, holo, halo, pillar };
  }, [uniforms, atlas]);

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      m.makeTranslation(Math.cos(a) * (PLAZA_R - 2.2), 4.5, Math.sin(a) * (PLAZA_R - 2.2));
      pillarRef.current!.setMatrixAt(i, m);
    }
    pillarRef.current!.instanceMatrix.needsUpdate = true;
    pillarRef.current!.computeBoundingSphere();
  }, []);

  useFrame((_, dt) => {
    if (holoGroup.current) holoGroup.current.rotation.y += dt * 0.12;
    if (haloA.current) haloA.current.rotation.z += dt * 0.25;
    if (haloB.current) haloB.current.rotation.z -= dt * 0.18;
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.24} material={mats.floor}>
        <circleGeometry args={[PLAZA_R, 96]} />
      </mesh>
      <instancedMesh ref={pillarRef} args={[undefined, mats.pillar, 16]}>
        <cylinderGeometry args={[0.18, 0.18, 9, 6, 1]} />
      </instancedMesh>
      <mesh ref={haloA} position-y={128} rotation-x={Math.PI / 2 + 0.12} material={mats.halo}>
        <torusGeometry args={[17, 0.22, 6, 96]} />
      </mesh>
      <mesh ref={haloB} position-y={214} rotation-x={Math.PI / 2 - 0.1} material={mats.halo}>
        <torusGeometry args={[12.5, 0.18, 6, 96]} />
      </mesh>
      <mesh position-y={268 + 34 + 260} material={mats.beam}>
        <cylinderGeometry args={[1.2, 4.5, 520, 16, 1, true]} />
      </mesh>
      <group ref={holoGroup} position-y={62}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 30, 0, Math.sin(a) * 30]} rotation-y={-a + Math.PI / 2} material={mats.holo}>
              <planeGeometry args={[24, 8.5]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
