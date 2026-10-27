import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRng } from '../../utils/random';
import { useCyberResources } from './resources';

/**
 * Sky dome driven by the time-of-day and weather state: gradient, sun and moon,
 * city light-pollution glow, stars, a drifting cloud layer and lightning.
 * The horizon colour is also the fog colour, so distant towers dissolve into it.
 */
export function SkyDome() {
  const { uniforms } = useCyberResources();
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: uniforms.uTime,
        uZenith: uniforms.uZenith,
        uSkyMid: uniforms.uSkyMid,
        uHorizon: uniforms.uHorizon,
        uSunDir: uniforms.uSunDir,
        uSunColor: uniforms.uSunColor,
        uMoonDir: uniforms.uMoonDir,
        uStars: uniforms.uStars,
        uCloud: uniforms.uCloud,
        uCityGlow: uniforms.uCityGlow,
        uDaylight: uniforms.uDaylight,
        uFlash: uniforms.uFlash,
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uZenith; uniform vec3 uSkyMid; uniform vec3 uHorizon;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uMoonDir;
        uniform float uStars; uniform float uCloud; uniform float uCityGlow; uniform float uDaylight; uniform float uFlash;
        varying vec3 vDir;
        float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) { return n2(p) * 0.5 + n2(p * 2.1 + 3.1) * 0.3 + n2(p * 4.3 + 7.7) * 0.2; }
        void main() {
          vec3 d = normalize(vDir);
          float y = d.y;
          vec3 col = mix(uHorizon, uSkyMid, smoothstep(0.0, 0.22, y));
          col = mix(col, uZenith, smoothstep(0.22, 0.8, y));
          // City light-pollution glow just above the skyline.
          col += vec3(0.07, 0.022, 0.08) * exp(-max(y, 0.0) * 12.0) * step(0.0, y) * uCityGlow;
          float clear = 1.0 - uCloud;
          // Stars above the glow band.
          vec3 sp = floor(d * 380.0);
          float star = step(0.9965, h(sp)) * smoothstep(0.08, 0.35, y);
          star *= 0.6 + 0.4 * sin(uTime * 1.3 + h(sp + 3.0) * 30.0);
          col += vec3(0.75, 0.82, 1.0) * star * uStars * clear;
          // Sun: disc plus a warm halo, only above the horizon.
          float sd = dot(d, uSunDir);
          float sunUp = smoothstep(-0.05, 0.05, uSunDir.y);
          col += uSunColor * (smoothstep(0.9993, 0.9996, sd) * 6.0 + pow(max(sd, 0.0), 60.0) * 0.6 + pow(max(sd, 0.0), 6.0) * 0.12) * sunUp * mix(1.0, 0.25, uCloud);
          // Moon.
          float md = dot(d, uMoonDir);
          float moonVis = (1.0 - smoothstep(0.15, 0.6, uDaylight)) * mix(1.0, 0.3, uCloud);
          col += vec3(0.85, 0.9, 1.0) * smoothstep(0.99935, 0.99955, md) * 1.6 * moonVis;
          col += vec3(0.25, 0.3, 0.55) * pow(max(md, 0.0), 220.0) * 0.6 * moonVis;
          // Drifting cloud layer, projected onto a plane above the city.
          vec2 cp = d.xz / max(y + 0.12, 0.05) * 1.3 + vec2(uTime * 0.012, uTime * 0.004);
          float cn = fbm(cp);
          float cover = smoothstep(0.75 - uCloud * 0.55, 0.95 - uCloud * 0.4, cn) * smoothstep(0.0, 0.12, y);
          vec3 cloudCol = mix(uHorizon * 0.8, uSkyMid * 0.9 + uHorizon * 0.25, cn) * mix(1.0, 0.6, uCloud);
          cloudCol += vec3(0.55, 0.6, 0.85) * uFlash * (0.4 + cn);
          col = mix(col, cloudCol, cover * (0.35 + 0.6 * uCloud));
          col += vec3(0.3, 0.33, 0.45) * uFlash * 0.35 * smoothstep(-0.05, 0.4, y);
          col = max(col, vec3(0.0));
          if (y < 0.0) col = uHorizon;
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
 * per frame. The weather-driven `uRain` uniform hides a fraction of drops in the
 * vertex shader, so weather changes fade the rain in and out.
 */
export function Rain({ count }: { count: number }) {
  const { uniforms } = useCyberResources();
  const ref = useRef<THREE.LineSegments>(null);

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
      uniforms: { uTime: uniforms.uTime, uIntensity: uniforms.uRain, uBox: { value: new THREE.Vector3(140, 110, 140) } },
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
  }, [count, uniforms]);

  useFrame(() => {
    if (ref.current) ref.current.visible = uniforms.uRain.value > 0.004;
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <lineSegments ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
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
