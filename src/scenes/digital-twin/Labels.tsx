import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useTwinStore } from '../../stores/twinStore';
import { useTwinModel } from './TwinModelContext';

// drei 9 ignores `pointerEvents` outside transform mode, so labels must opt out of hit-testing via style.
const NO_POINTER = { pointerEvents: 'none' } as const;

/** Map labels for named buildings and major named roads. */
export function Labels({ visibleSet }: { visibleSet: Set<number> }) {
  const model = useTwinModel();
  const ex = useTwinStore((s) => (s.layers.terrain && model.terrain ? s.exaggeration : 0));

  const buildingLabels = useMemo(() => {
    const seen = new Set<string>();
    return model.buildings
      .filter((b) => b.displayName && b.supersededBy === null && visibleSet.has(b.index))
      .filter((b) => (seen.has(b.displayName!) ? false : (seen.add(b.displayName!), true)))
      .map((b) => ({ key: b.index, text: b.displayName!, pos: [b.centroid[0], b.baseY * ex + b.height + 6, b.centroid[1]] as [number, number, number] }));
  }, [model, visibleSet, ex]);

  const roadLabels = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; text: string; pos: [number, number, number] }[] = [];
    for (const r of model.roads) {
      if (!r.displayName || (r.cls !== 'major' && r.cls !== 'minor') || seen.has(r.displayName)) continue;
      // Label the longest line at its midpoint vertex.
      const line = r.lines.reduce((a, b) => (b.length > a.length ? b : a));
      if (line.length < 2) continue;
      const [x, z] = line[Math.floor(line.length / 2)];
      seen.add(r.displayName);
      out.push({ key: `r${r.index}`, text: r.displayName, pos: [x, (model.terrain?.sample(x, z) ?? 0) * ex + 2, z] });
    }
    return out;
  }, [model, ex]);

  return (
    <group>
      {buildingLabels.map((l) => (
        <Html style={NO_POINTER} key={l.key} position={l.pos} center zIndexRange={[3, 0]} className="tw-label tw-label--building">
          {l.text}
        </Html>
      ))}
      {roadLabels.map((l) => (
        <Html style={NO_POINTER} key={l.key} position={l.pos} center zIndexRange={[3, 0]} className="tw-label tw-label--road">
          {l.text}
        </Html>
      ))}
    </group>
  );
}
