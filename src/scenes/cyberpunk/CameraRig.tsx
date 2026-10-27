import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { INTRO_DURATION } from '../../data/cyberpunk/config';
import { useCyberStore } from '../../stores/cyberpunkStore';
import { isTypingTarget } from '../../utils/webgl';
import { useCyberResources } from './resources';

export const DEFAULT_VIEW = { pos: new THREE.Vector3(330, 205, 430), target: new THREE.Vector3(0, 60, 0) };

/** Intro flight: low street-level skyline reveal rising to the aerial overview. */
const INTRO_POS = [new THREE.Vector3(-470, 16, 300), new THREE.Vector3(-320, 48, 360), new THREE.Vector3(-40, 150, 520), DEFAULT_VIEW.pos];
const INTRO_TARGET = [new THREE.Vector3(0, 150, 0), new THREE.Vector3(0, 125, 0), new THREE.Vector3(0, 90, 0), DEFAULT_VIEW.target];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const ORBIT_LIMITS = { minDistance: 30, maxDistance: 1300, maxPolarAngle: Math.PI * 0.47, minPolarAngle: 0.05 };
const FREE_LIMITS = { minDistance: 1, maxDistance: 2200, maxPolarAngle: Math.PI * 0.62, minPolarAngle: 0.01 };

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const { plan } = useCyberResources();
  const camera = useThree((s) => s.camera);
  // Intro progress is driven by wall-clock time so a slow GPU can never stretch or stall it.
  const intro = useRef({ start: 0, active: false });
  const keys = useRef(new Set<string>());
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), dir: new THREE.Vector3() }), []);
  const introCurves = useMemo(
    () => ({ pos: new THREE.CatmullRomCurve3(INTRO_POS, false, 'centripetal'), target: new THREE.CatmullRomCurve3(INTRO_TARGET, false, 'centripetal') }),
    [],
  );

  // Phase changes: start or finish the intro.
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    controls.setBoundary(new THREE.Box3(new THREE.Vector3(-1100, 0, -1100), new THREE.Vector3(1100, 420, 1100)));
    controls.dollyToCursor = true;
    controls.smoothTime = 0.35;
    controls.draggingSmoothTime = 0.12;

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

  // Camera mode → control limits.
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    const apply = (mode: 'orbit' | 'free') => Object.assign(controls, mode === 'free' ? FREE_LIMITS : ORBIT_LIMITS);
    apply(useCyberStore.getState().cameraMode);
    return useCyberStore.subscribe((s, p) => {
      if (s.cameraMode !== p.cameraMode) apply(s.cameraMode);
    });
  }, []);

  // Camera requests: reset, district presets, building focus.
  useEffect(() => {
    return useCyberStore.subscribe((s, p) => {
      const req = s.cameraRequest;
      const controls = ref.current;
      if (!req || req === p.cameraRequest || !controls || s.phase !== 'explore') return;
      controls.smoothTime = 0.8;
      if (req.kind === 'reset') {
        controls.setLookAt(DEFAULT_VIEW.pos.x, DEFAULT_VIEW.pos.y, DEFAULT_VIEW.pos.z, DEFAULT_VIEW.target.x, DEFAULT_VIEW.target.y, DEFAULT_VIEW.target.z, true);
      } else if (req.kind === 'district') {
        const c = plan.districtCenters[req.id];
        if (req.id === 'plaza') {
          controls.setLookAt(150, 110, 190, 0, 95, 0, true);
          return;
        }
        // Stand outside the district looking back toward the city centre.
        const out = tmp.dir.set(c.x, 0, c.z).normalize();
        const dist = 170 + c.maxHeight * 0.55;
        const side = new THREE.Vector3(-out.z, 0, out.x).multiplyScalar(dist * 0.35);
        controls.setLookAt(c.x + out.x * dist + side.x, Math.max(70, c.maxHeight * 0.75), c.z + out.z * dist + side.z, c.x * 0.6, Math.min(60, c.maxHeight * 0.3), c.z * 0.6, true);
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

  // Keyboard: WASD / arrows move, Q / E change altitude, Shift = fast.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
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

    const k = keys.current;
    if (k.size && controls.enabled) {
      const free = useCyberStore.getState().cameraMode === 'free';
      const speed = (k.has('shift') ? 3 : 1) * (free ? 70 : 110) * dt;
      const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const right = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      const lift = (k.has('e') ? 1 : 0) - (k.has('q') ? 1 : 0);
      if (right) controls.truck(right * speed, 0, true);
      if (fwd) controls.forward(fwd * speed, true);
      if (lift) controls.elevate(lift * speed * 0.6, true);
    }

    // Keep the camera above street level.
    camera.getWorldPosition(tmp.p);
    if (tmp.p.y < 2.5) {
      controls.getPosition(tmp.p);
      controls.setPosition(tmp.p.x, 2.5, tmp.p.z, false);
    }
  });

  return <CameraControls ref={ref} makeDefault />;
}
