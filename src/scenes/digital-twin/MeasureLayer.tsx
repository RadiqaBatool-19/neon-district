import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { formatArea, formatLength, measureArea, measureDistance } from '../../data/digital-twin/measure';
import { useTwinStore } from '../../stores/twinStore';

const LIFT = 0.6;

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
