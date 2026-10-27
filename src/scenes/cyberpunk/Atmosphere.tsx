import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRng } from '../../utils/random';
import { useCyberResources } from './resources';

/** Night sky dome: gradient, city light-pollution glow at the horizon, stars and a hazy moon. */
export function SkyDome() {
  const { uniforms } = useCyberResources();
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime, uDusk: uniforms.uDusk },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uDusk;
        varying vec3 vDir;
        float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        void main() {
          vec3 d = normalize(vDir);
          float y = d.y;
          vec3 zenith = mix(vec3(0.004, 0.005, 0.016), vec3(0.02, 0.025, 0.07), uDusk);
          vec3 mid = mix(vec3(0.02, 0.012, 0.05), vec3(0.09, 0.05, 0.16), uDusk);
          // Horizon matches the scene fog colour (linear) so distant towers dissolve into haze.
          vec3 horizon = mix(vec3(0.0252, 0.011, 0.0513), vec3(0.102, 0.0356, 0.117), uDusk);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, y));
          col = mix(col, zenith, smoothstep(0.22, 0.8, y));
          // City light-pollution glow just above the skyline.
          col += vec3(0.07, 0.022, 0.08) * exp(-max(y, 0.0) * 12.0) * step(0.0, y);
          // Stars above the glow band.
          vec3 sp = floor(d * 380.0);
          float star = step(0.9965, h(sp)) * smoothstep(0.08, 0.35, y);
          star *= 0.6 + 0.4 * sin(uTime * 1.3 + h(sp + 3.0) * 30.0);
          col += vec3(0.75, 0.82, 1.0) * star * (1.0 - uDusk * 0.7);
          // Moon.
          vec3 moonDir = normalize(vec3(-0.45, 0.42, -0.78));
          float md = dot(d, moonDir);
          col += vec3(0.85, 0.9, 1.0) * smoothstep(0.99935, 0.99955, md) * 1.6;
          col += vec3(0.25, 0.3, 0.55) * pow(max(md, 0.0), 220.0) * 0.6;
          col = max(col, vec3(0.0));
          if (y < 0.0) col = horizon;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    return m;
  }, [uniforms]);
  useEffect(() => () => mat.dispose(), [mat]);

  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false} name="sky">
      <sphereGeometry args={[5000, 32, 16]} />
    </mesh>
  );
}

/**
 * GPU rain: streaks wrap around the camera inside a box, so the CPU cost is zero
 * per frame. Intensity hides a fraction of drops in the vertex shader.
 */
export function Rain({ count, intensity, visible }: { count: number; intensity: number; visible: boolean }) {
  const { uniforms } = useCyberResources();

  const { geometry, material } = useMemo(() => {
    const rng = createRng(555);
    const seeds = new Float32Array(count * 2 * 4);
    const ends = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const s = [rng.next(), rng.next(), rng.next(), rng.next()];
      seeds.set(s, i * 8);
      seeds.set(s, i * 8 + 4);
      ends[i * 2] = 0;
      ends[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    g.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime, uIntensity: { value: intensity }, uBox: { value: new THREE.Vector3(140, 110, 140) } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uIntensity; uniform vec3 uBox;
        attribute vec4 aSeed; attribute float aEnd;
        varying float vA;
        void main() {
          vec3 cam = cameraPosition;
          vec3 p;
          p.xz = cam.xz + mod(aSeed.xz * uBox.xz - cam.xz, uBox.xz) - uBox.xz * 0.5;
          float speed = 46.0 + aSeed.w * 18.0;
          p.y = cam.y + mod(aSeed.y * uBox.y - uTime * speed - cam.y, uBox.y) - uBox.y * 0.5;
          vec3 vel = normalize(vec3(0.12, -1.0, 0.05));
          p += vel * aEnd * (1.3 + aSeed.w * 1.2);
          float on = step(aSeed.w, uIntensity);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = on * smoothstep(110.0, 10.0, -mv.z) * (0.4 + 0.6 * aEnd);
          gl_Position = on > 0.5 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { gl_FragColor = vec4(vec3(0.55, 0.7, 0.95) * vA * 0.42, 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
    // Intensity is applied through the uniform below without rebuilding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, uniforms]);

  material.uniforms.uIntensity.value = intensity;

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} visible={visible} renderOrder={5} />;
}

/** Sparse drifting motes catching the neon light. */
export function DriftParticles({ count, visible }: { count: number; visible: boolean }) {
  const { uniforms } = useCyberResources();
  const { geometry, material } = useMemo(() => {
    const rng = createRng(808);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [new THREE.Color('#3ef0ff'), new THREE.Color('#ff2bd6'), new THREE.Color('#8b5cff'), new THREE.Color('#ffd9a8')];
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(rng.next()) * 320;
      const a = rng.range(0, Math.PI * 2);
      pos.set([Math.cos(a) * r, rng.range(3, 140), Math.sin(a) * r], i * 3);
      const c = rng.pick(palette);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime, uPixel: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uPixel;
        attribute vec3 color;
        varying vec3 vC; varying float vA;
        void main() {
          vec3 p = position;
          float s = fract(sin(dot(position, vec3(1.3, 7.1, 3.7))) * 431.7);
          p.x += sin(uTime * 0.11 + s * 40.0) * 6.0;
          p.z += cos(uTime * 0.09 + s * 30.0) * 6.0;
          p.y += sin(uTime * 0.2 + s * 10.0) * 2.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uPixel * 90.0 / -mv.z, 1.0, 6.0);
          vC = color;
          vA = (0.5 + 0.5 * sin(uTime * 0.8 + s * 50.0)) * smoothstep(900.0, 80.0, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vC * a * vA * 0.9, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, [count, uniforms]);

  useFrame(({ gl }) => {
    material.uniforms.uPixel.value = gl.getPixelRatio();
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <points geometry={geometry} material={material} visible={visible} frustumCulled={false} renderOrder={4} />;
}
