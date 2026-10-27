import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import type * as THREE from 'three';
import type { Line2 } from 'three-stdlib';
import { formatArea, formatLength, measureArea, measureDistance } from '../../data/digital-twin/measure';
import { useTwinStore, type MeasurePoint } from '../../stores/twinStore';
import { measureCursor, toMeasurePoint } from './picking';
import { useTwinModel } from './TwinModelContext';

const LIFT = 0.6;

/**
 * Rubber-band preview from the last placed point to the cursor (and back to the
 * first point when drawing an area), with a live length / area label. Updated in
 * the render loop from `measureCursor`, so pointer moves cost no React renders.
 */
function MeasurePreview({ tool, points }: { tool: 'distance' | 'area'; points: MeasurePoint[] }) {
  const model = useTwinModel();
  const group = useRef<THREE.Group>(null);
  const line = useRef<Line2>(null);
  const dot = useRef<THREE.Mesh>(null);
  const labelAnchor = useRef<THREE.Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const last = useRef({ x: NaN, y: NaN, z: NaN, text: '', points: null as MeasurePoint[] | null });
  const positions = useMemo(() => new Array<number>(9).fill(0), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const visible = measureCursor.active && points.length > 0;
    g.visible = visible;
    if (!visible) return;
    const c = measureCursor.point;
    const prev = last.current;
    // Skip work while the cursor is still, unless a point was just added or removed.
    if (c.x === prev.x && c.y === prev.y && c.z === prev.z && prev.points === points) return;
    prev.points = points;
    prev.x = c.x;
    prev.y = c.y;
    prev.z = c.z;

    const a = points[points.length - 1];
    const first = points[0];
    const closing = tool === 'area' && points.length >= 2;
    positions[0] = a.x;
    positions[1] = a.y + LIFT;
    positions[2] = a.z;
    positions[3] = c.x;
    positions[4] = c.y + LIFT;
    positions[5] = c.z;
    // Third vertex: back to the first point for areas, otherwise a zero-length tail.
    positions[6] = closing ? first.x : c.x;
    positions[7] = closing ? first.y + LIFT : c.y + LIFT;
    positions[8] = closing ? first.z : c.z;
    if (line.current) {
      line.current.geometry.setPositions(positions);
      line.current.computeLineDistances();
    }
    dot.current?.position.set(c.x, c.y + LIFT, c.z);
    labelAnchor.current?.position.set(c.x, c.y + 7, c.z);

    const cursorPoint = toMeasurePoint(model, c, useTwinStore.getState().exaggeration, measureCursor.building);
    let text: string;
    if (tool === 'area' && points.length >= 2) {
      text = formatArea(measureArea([...points, cursorPoint])!.areaM2);
    } else {
      const segment = measureDistance([a, cursorPoint])!.totalM;
      const total = tool === 'distance' && points.length > 1 ? measureDistance(points)!.totalM + segment : null;
      text = total !== null ? `${formatLength(segment)} · total ${formatLength(total)}` : formatLength(segment);
    }
    if (text !== prev.text && label.current) {
      label.current.textContent = text;
      prev.text = text;
    }
  });

  return (
    <group ref={group} visible={false}>
      <Line ref={line} points={[[0, 0, 0], [0, 0, 0], [0, 0, 0]]} color="#2563eb" lineWidth={2} dashed dashSize={3} gapSize={2.5} transparent opacity={0.85} depthTest={false} renderOrder={9} />
      <mesh ref={dot} renderOrder={10}>
        <sphereGeometry args={[1.1, 14, 10]} />
        <meshBasicMaterial color="#60a5fa" depthTest={false} transparent opacity={0.9} />
      </mesh>
      <group ref={labelAnchor}>
        <Html center zIndexRange={[3, 0]} pointerEvents="none">
          <div ref={label} className="tw-measure-label tw-measure-label--live" />
        </Html>
      </group>
    </group>
  );
}

/** Measurement geometry drawn in world (region) coordinates. */
export function MeasureLayer() {
  const tool = useTwinStore((s) => s.tool);
  const points = useTwinStore((s) => s.points);
  const closed = useTwinStore((s) => s.closed);

  const linePts = useMemo(() => {
    const pts = points.map((p) => [p.x, p.y + LIFT, p.z] as [number, number, number]);
    if (tool === 'area' && points.length >= 3) pts.push(pts[0]);
    return pts;
  }, [points, tool]);

  const distance = tool === 'distance' ? measureDistance(points) : null;
  const area = tool === 'area' ? measureArea(points) : null;

  if (tool === 'none' || points.length === 0) return null;

  return (
    <group>
      {(tool === 'distance' || (tool === 'area' && !closed)) && <MeasurePreview tool={tool} points={points} />}
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y + LIFT, p.z]} renderOrder={10}>
          <sphereGeometry args={[1.4, 16, 12]} />
          <meshBasicMaterial color={i === 0 ? '#1d4ed8' : '#2563eb'} depthTest={false} transparent />
        </mesh>
      ))}
      {linePts.length >= 2 && <Line points={linePts} color="#1d4ed8" lineWidth={2.5} dashed={tool === 'area' && !closed} dashSize={4} gapSize={2} depthTest={false} renderOrder={9} />}
      {distance &&
        distance.segmentsM.map((d, i) => {
          const a = points[i];
          const b = points[i + 1];
          return (
            <Html key={i} position={[(a.x + b.x) / 2, Math.max(a.y, b.y) + 6, (a.z + b.z) / 2]} center zIndexRange={[3, 0]} className="tw-measure-label">
              {formatLength(d)}
            </Html>
          );
        })}
      {area && (
        <Html
          position={[points.reduce((s, p) => s + p.x, 0) / points.length, Math.max(...points.map((p) => p.y)) + 8, points.reduce((s, p) => s + p.z, 0) / points.length]}
          center
          zIndexRange={[3, 0]}
          className="tw-measure-label tw-measure-label--strong"
        >
          {formatArea(area.areaM2)}
        </Html>
      )}
    </group>
  );
}
