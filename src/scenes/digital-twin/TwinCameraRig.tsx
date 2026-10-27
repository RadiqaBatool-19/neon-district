import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { useTwinStore } from '../../stores/twinStore';
import { useTwinModel } from './TwinModelContext';
import { twinView } from './viewState';

/**
 * Oblique home view from the south-south-east, far enough to frame the whole
 * extract between the side panels. Portrait viewports pull back further.
 */
const HOME_POS = (c: THREE.Vector3, span: number, aspect: number): [number, number, number] => {
  const k = aspect < 1 ? Math.min(2.2, 1.15 / aspect) : 1;
  return [c.x + span * 0.42 * k, span * 0.95 * k, c.z + span * 1.25 * k];
};

/**
 * Map-style camera: left-drag pans, right-drag orbits, wheel zooms to cursor.
 * Bounded to the loaded area so the extract never drifts out of view.
 */
export function TwinCameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const model = useTwinModel();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3() }), []);

  const centre = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = model.extent;
    return new THREE.Vector3(model.areaOffset[0] + (minX + maxX) / 2, 15, model.areaOffset[1] + (minZ + maxZ) / 2);
  }, [model]);
  const span = model.extent.maxX - model.extent.minX;
  const aspect = size.width / Math.max(1, size.height);

  const views = useMemo(
    () => ({
      reset: () => ref.current?.setLookAt(...HOME_POS(centre, span, aspect), centre.x, centre.y, centre.z, true),
      top: () => ref.current?.setLookAt(centre.x, span * 1.35, centre.z + 0.01, centre.x, 0, centre.z, true),
    }),
    [centre, span, aspect],
  );

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.mouseButtons.left = CameraControlsImpl.ACTION.TRUCK;
    c.mouseButtons.right = CameraControlsImpl.ACTION.ROTATE;
    c.mouseButtons.middle = CameraControlsImpl.ACTION.DOLLY;
    c.mouseButtons.wheel = CameraControlsImpl.ACTION.DOLLY;
    c.touches.one = CameraControlsImpl.ACTION.TOUCH_TRUCK;
    c.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_ROTATE;
    c.dollyToCursor = true;
    c.minDistance = 40;
    c.maxDistance = span * 3.2;
    c.maxPolarAngle = Math.PI * 0.46;
    c.smoothTime = 0.3;
    // Truck along the ground plane rather than the screen plane (map-like panning).
    c.verticalDragToForward = true;
    const pad = span * 0.6;
    c.setBoundary(new THREE.Box3(new THREE.Vector3(centre.x - pad, -10, centre.z - pad), new THREE.Vector3(centre.x + pad, 300, centre.z + pad)));
    c.setLookAt(...HOME_POS(centre, span, aspect), centre.x, centre.y, centre.z, false);
    // Initial framing only; later resizes keep the user's view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre, span]);

  useEffect(
    () =>
      useTwinStore.subscribe((s, p) => {
        const req = s.cameraRequest;
        if (!req || req === p.cameraRequest || !ref.current) return;
        if (req.kind === 'reset') views.reset();
        else if (req.kind === 'top') views.top();
        else if (req.kind === 'focus' && s.selection?.kind === 'building') {
          const b = model.buildings[s.selection.index];
          const x = model.areaOffset[0] + b.centroid[0];
          const z = model.areaOffset[1] + b.centroid[1];
          const r = Math.max(60, b.height * 1.6 + Math.sqrt(b.footprintArea) * 1.5);
          ref.current.getPosition(tmp.p);
          const dir = tmp.t.set(tmp.p.x - x, 0, tmp.p.z - z).normalize();
          ref.current.setLookAt(x + dir.x * r * 0.8, b.height * 0.5 + r * 0.6, z + dir.z * r * 0.8, x, b.height * 0.45, z, true);
        }
      }),
    [model, views, tmp],
  );

  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    c.getTarget(tmp.t);
    const dist = camera.position.distanceTo(tmp.t);
    const mpp = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, size.height);
    twinView.update(c.azimuthAngle, mpp);
  });

  return <CameraControls ref={ref} makeDefault />;
}
