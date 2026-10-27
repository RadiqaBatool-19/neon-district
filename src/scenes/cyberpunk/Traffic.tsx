import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CITY, CITY_HALF_EXTENT, HALF_GRID, PITCH } from '../../data/cyberpunk/config';
import { DENSITY_FACTOR, useCyberStore } from '../../stores/cyberpunkStore';
import { createRng } from '../../utils/random';
import { getHighways, samplePath } from './highwayPaths';

/**
 * Vehicle body material: headlights / tail-lights are painted in the shader from
 * the local position, so each vehicle is a single instance (one draw call total).
 * Vehicles face local +X.
 */
function createVehicleMaterial(tailColor: string, headStrength: number) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.8 });
  const tail = new THREE.Color(tailColor);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTail = { value: tail };
    shader.uniforms.uHead = { value: headStrength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTail; uniform float uHead; varying vec3 vLocal;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float band = step(abs(vLocal.z), 0.42) * step(0.15, abs(vLocal.z)) * step(-0.05, vLocal.y) * step(vLocal.y, 0.2);
        float head = step(0.495, vLocal.x) * band;
        float rear = step(vLocal.x, -0.495) * step(abs(vLocal.z), 0.45) * step(-0.1, vLocal.y) * step(vLocal.y, 0.15);
        totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * head * uHead + uTail * rear * 3.5;`,
      );
  };
  return mat;
}

const CAR_COLORS = ['#1a1d26', '#2a2e3a', '#0f1118', '#3b3f4c', '#5a1f2c', '#1d3045', '#d8dde6', '#20242c'];

interface GroundCar {
  axis: 0 | 1;
  line: number;
  s: number;
  speed: number;
  /** Phase and rate of the slow speed variation (accelerating / braking). */
  phase: number;
  rate: number;
}

/** Speed multiplier that drifts smoothly between ~0.55 and 1.15 — reads as traffic easing and braking. */
function cruise(t: number, phase: number, rate: number) {
  return 0.85 + 0.2 * Math.sin(t * rate + phase) + 0.1 * Math.sin(t * rate * 2.7 + phase * 1.7);
}

/**
 * Street traffic on the grid plus traffic on the elevated highways. Buffers are
 * sized for heavy traffic; the density control only changes the drawn count,
 * so switching density never rebuilds anything. Streets near the centre get
 * more cars, so the commercial core reads busier than the outskirts.
 */
export function Traffic({ cars, highwayCars, visible }: { cars: number; highwayCars: number; visible: boolean }) {
  const groundRef = useRef<THREE.InstancedMesh>(null);
  const hwRef = useRef<THREE.InstancedMesh>(null);
  const highways = getHighways();

  const material = useMemo(() => createVehicleMaterial('#ff2a3d', 4), []);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );

  const ground = useMemo<GroundCar[]>(() => {
    const rng = createRng(99);
    // Weighted street lines: central streets carry up to ~3× the traffic of the edge streets.
    const lines: number[] = [];
    for (let k = -HALF_GRID - 1; k <= HALF_GRID; k++) {
      const centrality = 1 - Math.abs(k + 0.5) / (HALF_GRID + 1);
      for (let r = 0; r < 1 + Math.round(centrality * 2.5); r++) lines.push((k + 0.5) * PITCH);
    }
    return Array.from({ length: cars }, () => {
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = rng.chance(0.5) ? 2.4 : 5.6;
      const axis: 0 | 1 = rng.chance(0.5) ? 0 : 1;
      // Right-hand traffic: eastbound keeps to +z, southbound keeps to −x.
      const side = axis === 0 ? dir : -dir;
      return {
        axis,
        line: rng.pick(lines) + lane * side,
        s: rng.range(-CITY_HALF_EXTENT, CITY_HALF_EXTENT),
        speed: rng.range(9, 17) * dir,
        phase: rng.range(0, Math.PI * 2),
        rate: rng.range(0.15, 0.45),
      };
    });
  }, [cars]);

  const hw = useMemo(() => {
    const rng = createRng(7);
    return Array.from({ length: highwayCars }, () => {
      const h = rng.int(0, highways.length - 1);
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = rng.chance(0.5) ? 1.8 : 5.0;
      return { h, u: rng.next(), offset: lane * dir, speed: (rng.range(22, 34) * dir) / highways[h].lut.length, phase: rng.range(0, Math.PI * 2), rate: rng.range(0.1, 0.3) };
    });
  }, [highwayCars, highways]);
  const time = useRef(0);

  // Static per-instance colours.
  useEffect(() => {
    const rng = createRng(3);
    const c = new THREE.Color();
    for (const mesh of [groundRef.current, hwRef.current]) {
      if (!mesh) continue;
      for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, c.set(rng.pick(CAR_COLORS)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [ground, hw]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(4.4, 1.35, 1.95), t: new THREE.Vector2(), up: new THREE.Vector3(0, 1, 0) }), []);

  useFrame((_, rawDt) => {
    if (!visible) return;
    const dt = Math.min(rawDt, 0.1);
    time.current += dt;
    const T = time.current;
    const density = DENSITY_FACTOR[useCyberStore.getState().trafficDensity];
    const { m, q, p, s, t, up } = tmp;
    const g = groundRef.current;
    if (g) {
      const lim = CITY_HALF_EXTENT;
      g.count = Math.round(ground.length * density);
      for (let i = 0; i < g.count; i++) {
        const c = ground[i];
        c.s += c.speed * cruise(T, c.phase, c.rate) * dt;
        if (c.s > lim) c.s -= lim * 2;
        else if (c.s < -lim) c.s += lim * 2;
        if (c.axis === 0) {
          p.set(c.s, 0.9, c.line);
          q.setFromAxisAngle(up, c.speed > 0 ? 0 : Math.PI);
        } else {
          p.set(c.line, 0.9, c.s);
          q.setFromAxisAngle(up, c.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
        m.compose(p, q, s);
        g.setMatrixAt(i, m);
      }
      g.instanceMatrix.needsUpdate = true;
    }
    const h = hwRef.current;
    if (h) {
      h.count = Math.round(hw.length * density);
      for (let i = 0; i < h.count; i++) {
        const c = hw[i];
        const lut = highways[c.h].lut;
        c.u += c.speed * cruise(T, c.phase, c.rate) * dt;
        if (!lut.closed) c.u = ((c.u % 1) + 1) % 1;
        samplePath(lut, c.u, p, t);
        p.x += -t.y * c.offset;
        p.z += t.x * c.offset;
        p.y += 0.85;
        const yaw = Math.atan2(-t.y, t.x) + (c.speed > 0 ? 0 : Math.PI);
        q.setFromAxisAngle(up, yaw);
        m.compose(p, q, s);
        h.setMatrixAt(i, m);
      }
      h.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group visible={visible}>
      <instancedMesh ref={groundRef} args={[geometry, material, ground.length]} frustumCulled={false} />
      <instancedMesh ref={hwRef} args={[geometry, material, hw.length]} frustumCulled={false} />
    </group>
  );
}

interface Flyer {
  r: number;
  alt: number;
  speed: number;
  phase: number;
  wobble: number;
  cx: number;
  cz: number;
  ellipse: number;
}

/** Flying vehicles on smooth elliptical lanes between the towers. */
export function FlyingVehicles({ count, visible }: { count: number; visible: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => createVehicleMaterial('#3ef0ff', 6), []);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );

  const flyers = useMemo<Flyer[]>(() => {
    const rng = createRng(1234);
    return Array.from({ length: count }, (_, i) => ({
      r: rng.range(70, CITY.highwayLoopHalf * 1.9),
      alt: rng.range(48, 175),
      speed: rng.range(0.035, 0.08) * (i % 2 ? 1 : -1),
      phase: rng.range(0, Math.PI * 2),
      wobble: rng.range(2, 7),
      cx: rng.range(-60, 60),
      cz: rng.range(-60, 60),
      ellipse: rng.range(0.6, 1.0),
    }));
  }, [count]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, c.set(i % 3 === 0 ? '#c9d2e3' : '#262a35'));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [flyers]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(6.2, 1.5, 3) }), []);
  const time = useRef(0);

  useFrame((_, rawDt) => {
    if (!visible || !ref.current) return;
    time.current += Math.min(rawDt, 0.1);
    const T = time.current;
    const { m, q, e, p, s } = tmp;
    ref.current.count = Math.round(flyers.length * DENSITY_FACTOR[useCyberStore.getState().flyerDensity]);
    for (let i = 0; i < ref.current.count; i++) {
      const f = flyers[i];
      const a = f.phase + T * f.speed;
      p.set(f.cx + Math.cos(a) * f.r, f.alt + Math.sin(T * 0.4 + f.phase) * f.wobble, f.cz + Math.sin(a) * f.r * f.ellipse);
      // Tangent of the ellipse gives the heading; bank slightly into the turn.
      const tx = -Math.sin(a) * f.r * Math.sign(f.speed);
      const tz = Math.cos(a) * f.r * f.ellipse * Math.sign(f.speed);
      e.set(0, Math.atan2(-tz, tx), 0.12 * Math.sign(f.speed));
      q.setFromEuler(e);
      m.compose(p, q, s);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geometry, material, flyers.length]} frustumCulled={false} visible={visible} />;
}
