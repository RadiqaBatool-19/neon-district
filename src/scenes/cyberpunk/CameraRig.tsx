import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { CITY_HALF_EXTENT, HALF_GRID, INTRO_DURATION, PITCH } from '../../data/cyberpunk/config';
import { touchKeys, useCyberStore, type CameraMode } from '../../stores/cyberpunkStore';
import { isTypingTarget } from '../../utils/webgl';
import type { CityPlan } from './cityGenerator';
import { useCyberResources } from './resources';

export const DEFAULT_VIEW = { pos: new THREE.Vector3(330, 205, 430), target: new THREE.Vector3(0, 60, 0) };

/** Intro flight: low street-level skyline reveal rising to the aerial overview. */
const INTRO_POS = [new THREE.Vector3(-470, 16, 300), new THREE.Vector3(-320, 48, 360), new THREE.Vector3(-40, 150, 520), DEFAULT_VIEW.pos];
const INTRO_TARGET = [new THREE.Vector3(0, 150, 0), new THREE.Vector3(0, 125, 0), new THREE.Vector3(0, 90, 0), DEFAULT_VIEW.target];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const { ACTION } = CameraControlsImpl;
/** In fly / walk the target sits just ahead of the camera, so rotating looks around from the camera. */
const LOOK_DIST = 0.6;
const EYE_HEIGHT = 1.7;
const WALK_MARGIN = 0.9;
/** Base speeds (m/s) before the speed slider and Shift. */
const SPEED: Record<CameraMode, number> = { orbit: 110, fly: 55, walk: 6 };
const MOVE_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'];

function configure(controls: CameraControlsImpl, mode: CameraMode) {
  if (mode === 'orbit') {
    Object.assign(controls, { minDistance: 30, maxDistance: 1300, minPolarAngle: 0.05, maxPolarAngle: Math.PI * 0.47, azimuthRotateSpeed: 1, polarRotateSpeed: 1, dollyToCursor: true });
    controls.mouseButtons.left = ACTION.ROTATE;
    controls.mouseButtons.right = ACTION.TRUCK;
    controls.mouseButtons.middle = ACTION.DOLLY;
    controls.mouseButtons.wheel = ACTION.DOLLY;
    controls.touches.one = ACTION.TOUCH_ROTATE;
    controls.touches.two = ACTION.TOUCH_DOLLY_TRUCK;
    controls.touches.three = ACTION.TOUCH_TRUCK;
  } else {
    // First-person look: inverted rotation around a target just ahead of the eye.
    Object.assign(controls, { minDistance: 0.01, maxDistance: Infinity, minPolarAngle: 0.08, maxPolarAngle: Math.PI - 0.08, azimuthRotateSpeed: -0.32, polarRotateSpeed: -0.32, dollyToCursor: false });
    controls.mouseButtons.left = ACTION.ROTATE;
    controls.mouseButtons.right = ACTION.NONE;
    controls.mouseButtons.middle = ACTION.NONE;
    controls.mouseButtons.wheel = ACTION.NONE;
    controls.touches.one = ACTION.TOUCH_ROTATE;
    controls.touches.two = ACTION.NONE;
    controls.touches.three = ACTION.NONE;
  }
}

/** Nearest point on a north–south street centre line, at eye height. */
function streetPoint(x: number, z: number, out: THREE.Vector3) {
  const k = THREE.MathUtils.clamp(Math.round(x / PITCH - 0.5), -HALF_GRID - 1, HALF_GRID);
  return out.set((k + 0.5) * PITCH, EYE_HEIGHT, THREE.MathUtils.clamp(z, -CITY_HALF_EXTENT + 10, CITY_HALF_EXTENT - 10));
}

/** True if a walker at (x, z) would be inside a building footprint (axis-aligned, with margin). */
function collides(plan: CityPlan, x: number, z: number) {
  if (Math.abs(x) > CITY_HALF_EXTENT + 400 || Math.abs(z) > CITY_HALF_EXTENT + 400) return true;
  for (const b of plan.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + WALK_MARGIN && Math.abs(z - b.z) < b.d / 2 + WALK_MARGIN) return true;
  }
  return false;
}

/**
 * One camera rig for every mode, built on drei's CameraControls:
 * - orbit: cinematic orbit / pan / dolly around a target;
 * - fly: drone — look from the camera, WASD + Q/E move freely;
 * - walk: first-person at street level with building collision.
 * Keyboard / touch-pad movement is integrated with smooth acceleration and
 * deceleration. Mouse look can use pointer lock in fly and walk (Esc releases).
 */
export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const { plan } = useCyberResources();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  // Intro progress is driven by wall-clock time so a slow GPU can never stretch or stall it.
  const intro = useRef({ start: 0, active: false });
  const keys = useRef(new Set<string>());
  const tmp = useMemo(
    () => ({
      p: new THREE.Vector3(),
      t: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      right: new THREE.Vector3(),
      want: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );
  const introCurves = useMemo(
    () => ({ pos: new THREE.CatmullRomCurve3(INTRO_POS, false, 'centripetal'), target: new THREE.CatmullRomCurve3(INTRO_TARGET, false, 'centripetal') }),
    [],
  );

  /** Look from `pos` toward `at` in first-person configuration. */
  const lookFrom = (controls: CameraControlsImpl, pos: THREE.Vector3, at: THREE.Vector3, smooth: boolean) => {
    tmp.dir.subVectors(at, pos).normalize().multiplyScalar(LOOK_DIST).add(pos);
    controls.setLookAt(pos.x, pos.y, pos.z, tmp.dir.x, tmp.dir.y, tmp.dir.z, smooth);
  };

  // Phase changes: start or finish the intro.
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    controls.setBoundary(new THREE.Box3(new THREE.Vector3(-1100, 0, -1100), new THREE.Vector3(1100, 420, 1100)));
    controls.smoothTime = 0.35;
    controls.draggingSmoothTime = 0.12;
    configure(controls, 'orbit');

    const apply = (phase: string, prevPhase?: string) => {
      if (phase === 'intro') {
        intro.current = { start: performance.now(), active: true };
        controls.enabled = false;
        controls.setLookAt(INTRO_POS[0].x, INTRO_POS[0].y, INTRO_POS[0].z, INTRO_TARGET[0].x, INTRO_TARGET[0].y, INTRO_TARGET[0].z, false);
      } else if (phase === 'explore') {
        const wasIntro = intro.current.active || prevPhase === 'intro';
        intro.current.active = false;
        controls.enabled = true;
        if (wasIntro || prevPhase === 'loading') {
          controls.smoothTime = 0.9;
          controls.setLookAt(DEFAULT_VIEW.pos.x, DEFAULT_VIEW.pos.y, DEFAULT_VIEW.pos.z, DEFAULT_VIEW.target.x, DEFAULT_VIEW.target.y, DEFAULT_VIEW.target.z, prevPhase === 'intro');
        }
      } else {
        controls.setLookAt(DEFAULT_VIEW.pos.x, DEFAULT_VIEW.pos.y, DEFAULT_VIEW.pos.z, DEFAULT_VIEW.target.x, DEFAULT_VIEW.target.y, DEFAULT_VIEW.target.z, false);
      }
    };
    apply(useCyberStore.getState().phase);
    return useCyberStore.subscribe((s, p) => {
      if (s.phase !== p.phase) apply(s.phase, p.phase);
    });
  }, []);

  // Camera mode changes: reconfigure the controls and move to a sensible start point.
  useEffect(() => {
    return useCyberStore.subscribe((s, prev) => {
      const controls = ref.current;
      if (!controls || s.cameraMode === prev.cameraMode) return;
      const from = prev.cameraMode;
      const to = s.cameraMode;
      if (s.pointerLocked) controls.unlockPointer();
      tmp.vel.set(0, 0, 0);
      configure(controls, to);
      controls.smoothTime = 0.85;
      controls.getPosition(tmp.p);
      camera.getWorldDirection(tmp.dir);
      if (to === 'walk') {
        // Drop to the nearest street near what the camera was looking at, facing along the street.
        if (from === 'orbit') controls.getTarget(tmp.t);
        else tmp.t.copy(tmp.p).addScaledVector(tmp.dir, 40);
        streetPoint(tmp.t.x, tmp.t.z, tmp.p);
        const face = tmp.dir.z > 0 ? 1 : -1;
        tmp.t.set(tmp.p.x, EYE_HEIGHT + 2, tmp.p.z + face * 50);
        lookFrom(controls, tmp.p, tmp.t, true);
      } else if (to === 'fly') {
        if (from === 'walk') tmp.p.y += 45;
        tmp.t.copy(tmp.p).add(tmp.dir);
        lookFrom(controls, tmp.p, tmp.t, true);
      } else {
        // Back to orbit: pull up and back, orbiting a point ahead of where we were.
        tmp.dir.y = Math.min(tmp.dir.y, -0.15);
        tmp.dir.normalize();
        tmp.t.copy(tmp.p).addScaledVector(tmp.dir, 140);
        tmp.t.y = THREE.MathUtils.clamp(tmp.t.y, 5, 120);
        if (from === 'walk') tmp.p.set(tmp.p.x - tmp.dir.x * 90, 85, tmp.p.z - tmp.dir.z * 90);
        controls.setLookAt(tmp.p.x, tmp.p.y, tmp.p.z, tmp.t.x, tmp.t.y, tmp.t.z, true);
      }
    });
  }, [camera, tmp]);

  // Camera requests: reset, district presets, building focus.
  useEffect(() => {
    return useCyberStore.subscribe((s, p) => {
      const req = s.cameraRequest;
      const controls = ref.current;
      if (!req || req === p.cameraRequest || !controls || s.phase !== 'explore') return;
      controls.smoothTime = 0.8;
      const mode = s.cameraMode;
      if (req.kind === 'reset') {
        controls.setLookAt(DEFAULT_VIEW.pos.x, DEFAULT_VIEW.pos.y, DEFAULT_VIEW.pos.z, DEFAULT_VIEW.target.x, DEFAULT_VIEW.target.y, DEFAULT_VIEW.target.z, true);
      } else if (req.kind === 'district') {
        const c = plan.districtCenters[req.id];
        if (mode === 'walk') {
          // Walk: step onto a street at the district edge facing the city centre.
          streetPoint(c.x, c.z, tmp.p);
          tmp.t.set(tmp.p.x, EYE_HEIGHT + 4, tmp.p.z * 0.3);
          if (Math.abs(tmp.t.z - tmp.p.z) < 5) tmp.t.z = tmp.p.z - 50;
          lookFrom(controls, tmp.p, tmp.t, true);
          return;
        }
        let px: number, py: number, pz: number, tx: number, ty: number, tz: number;
        if (req.id === 'plaza') {
          [px, py, pz, tx, ty, tz] = [150, 110, 190, 0, 95, 0];
        } else {
          // Stand outside the district looking back toward the city centre.
          const out = tmp.dir.set(c.x, 0, c.z).normalize();
          const dist = 170 + c.maxHeight * 0.55;
          const sx = -out.z * dist * 0.35;
          const sz = out.x * dist * 0.35;
          [px, py, pz] = [c.x + out.x * dist + sx, Math.max(70, c.maxHeight * 0.75), c.z + out.z * dist + sz];
          [tx, ty, tz] = [c.x * 0.6, Math.min(60, c.maxHeight * 0.3), c.z * 0.6];
        }
        if (mode === 'fly') lookFrom(controls, tmp.p.set(px, py, pz), tmp.t.set(tx, ty, tz), true);
        else controls.setLookAt(px, py, pz, tx, ty, tz, true);
      } else if (req.kind === 'building') {
        const b = plan.buildings[req.id];
        if (!b) return;
        const ty = Math.min(b.height * 0.55, b.height - 6);
        const dist = Math.max(55, b.height * 0.85 + Math.max(b.w, b.d) * 1.4);
        // Keep the current viewing azimuth so the move feels continuous.
        controls.getPosition(tmp.p);
        tmp.dir.set(tmp.p.x - b.x, 0, tmp.p.z - b.z);
        if (tmp.dir.lengthSq() < 1) tmp.dir.set(1, 0, 1);
        tmp.dir.normalize();
        const elev = 0.42;
        controls.setLookAt(b.x + tmp.dir.x * dist * Math.cos(elev), ty + dist * Math.sin(elev), b.z + tmp.dir.z * dist * Math.cos(elev), b.x, ty, b.z, true);
      }
    });
  }, [plan, tmp]);

  // Pointer lock (mouse look) requests from the HUD, and lock-state tracking.
  useEffect(() => {
    const onLockChange = () => useCyberStore.getState().setPointerLocked(document.pointerLockElement === gl.domElement);
    document.addEventListener('pointerlockchange', onLockChange);
    const unsub = useCyberStore.subscribe((s, p) => {
      const controls = ref.current;
      if (!controls || s.lockRequest === p.lockRequest) return;
      if (s.cameraMode !== 'orbit' && !s.pointerLocked) controls.lockPointer();
    });
    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      unsub();
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
    };
  }, [gl]);

  // Keyboard: WASD / arrows move, Q / E change altitude, Shift = fast.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (MOVE_KEYS.includes(k)) {
        keys.current.add(k);
        if (k.startsWith('arrow')) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useFrame((_, rawDt) => {
    const controls = ref.current;
    if (!controls) return;
    const dt = Math.min(rawDt, 0.1);

    if (intro.current.active) {
      const progress = (performance.now() - intro.current.start) / 1000 / INTRO_DURATION;
      const t = easeInOut(Math.min(1, progress));
      introCurves.pos.getPoint(t, tmp.p);
      introCurves.target.getPoint(t, tmp.t);
      controls.setLookAt(tmp.p.x, tmp.p.y, tmp.p.z, tmp.t.x, tmp.t.y, tmp.t.z, false);
      if (progress >= 1) {
        intro.current.active = false;
        useCyberStore.getState().setPhase('explore');
      }
      return;
    }

    // --- Movement input → desired velocity (world space).
    const s = useCyberStore.getState();
    const mode = s.cameraMode;
    const k = keys.current;
    const has = (key: string) => k.has(key) || touchKeys.has(key);
    const fwd = (has('w') || has('arrowup') ? 1 : 0) - (has('s') || has('arrowdown') ? 1 : 0);
    const strafe = (has('d') || has('arrowright') ? 1 : 0) - (has('a') || has('arrowleft') ? 1 : 0);
    const lift = mode === 'walk' ? 0 : (has('e') ? 1 : 0) - (has('q') ? 1 : 0);
    const boost = has('shift') ? (mode === 'walk' ? 2.2 : 3) : 1;
    const speed = SPEED[mode] * s.moveSpeed * boost;
    // Horizontal basis from the camera's right vector (no roll), so W never dives into the ground.
    tmp.right.setFromMatrixColumn(camera.matrixWorld, 0);
    tmp.right.y = 0;
    tmp.right.normalize();
    tmp.fwd.crossVectors(tmp.up, tmp.right);
    tmp.want.set(0, 0, 0).addScaledVector(tmp.fwd, fwd).addScaledVector(tmp.right, strafe);
    if (tmp.want.lengthSq() > 1) tmp.want.normalize();
    tmp.want.multiplyScalar(speed);
    tmp.want.y = lift * speed * 0.6;
    const moving = fwd !== 0 || strafe !== 0 || lift !== 0;
    // Accelerate quickly, glide to a stop a little slower.
    tmp.vel.lerp(tmp.want, 1 - Math.exp(-dt * (moving ? 5 : 3.5)));

    if (controls.enabled && tmp.vel.lengthSq() > 0.0004) {
      controls.getTarget(tmp.t);
      controls.getPosition(tmp.p);
      let dx = tmp.vel.x * dt;
      let dz = tmp.vel.z * dt;
      const dy = tmp.vel.y * dt;
      if (mode === 'walk') {
        // Slide along walls: drop whichever axis would enter a building.
        if (collides(plan, tmp.p.x + dx, tmp.p.z)) {
          dx = 0;
          tmp.vel.x = 0;
        }
        if (collides(plan, tmp.p.x + dx, tmp.p.z + dz)) {
          dz = 0;
          tmp.vel.z = 0;
        }
      }
      controls.moveTo(tmp.t.x + dx, tmp.t.y + dy, tmp.t.z + dz, false);
    }

    // Keep the camera above street level. (Walking eye height drifts by at most LOOK_DIST while looking around.)
    camera.getWorldPosition(tmp.p);
    const floor = mode === 'walk' ? EYE_HEIGHT - LOOK_DIST : 2.5;
    if (tmp.p.y < floor) {
      controls.getTarget(tmp.t);
      controls.getPosition(tmp.p);
      const dy = floor - tmp.p.y;
      controls.setLookAt(tmp.p.x, tmp.p.y + dy, tmp.p.z, tmp.t.x, tmp.t.y + dy, tmp.t.z, false);
    }
  });

  return <CameraControls ref={ref} makeDefault />;
}
