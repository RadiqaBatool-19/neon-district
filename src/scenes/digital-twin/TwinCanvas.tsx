import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import type { TwinModel } from '../../data/digital-twin/buildTwinModel';
import { useTwinStore } from '../../stores/twinStore';
import { passesFilters } from '../../data/digital-twin/filters';
import { BuildingsLayer } from './BuildingsLayer';
import { CompareMarkers } from './CompareMarkers';
import { Labels } from './Labels';
import { MeasureLayer } from './MeasureLayer';
import { TerrainLayer } from './TerrainLayer';
import { TwinCameraRig } from './TwinCameraRig';
import { TwinModelContext } from './TwinModelContext';

function TwinScene({ model }: { model: TwinModel }) {
  const filters = useTwinStore((s) => s.filters);
  const layers = useTwinStore((s) => s.layers);

  const visibleSet = useMemo(() => new Set(model.buildings.filter((b) => passesFilters(b, filters)).map((b) => b.index)), [model, filters]);
  const ghostFootprints = useMemo(
    () => (layers.buildings ? model.buildings.filter((b) => b.supersededBy === null && !visibleSet.has(b.index)).map((b) => b.polygons) : []),
    [model, visibleSet, layers.buildings],
  );

  const { minX, maxX, minZ, maxZ } = model.extent;
  const span = maxX - minX;
  const sun: [number, number, number] = [model.areaOffset[0] - span * 0.6, span * 0.9, model.areaOffset[1] + span * 0.35];

  return (
    <>
      <color attach="background" args={['#e7ebf0']} />
      <fog attach="fog" args={['#e7ebf0', span * 2.2, span * 6]} />
      <hemisphereLight args={['#ffffff', '#aab3bf', 1.5]} />
      <directionalLight
        position={sun}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span * 0.75}
        shadow-camera-right={span * 0.75}
        shadow-camera-top={span * 0.75}
        shadow-camera-bottom={-span * 0.75}
        shadow-camera-near={10}
        shadow-camera-far={span * 4}
        shadow-bias={-0.0005}
        shadow-normalBias={0.4}
      >
        <object3D attach="target" position={[model.areaOffset[0], 0, model.areaOffset[1]]} />
      </directionalLight>
      <group position={[model.areaOffset[0], 0, model.areaOffset[1]]}>
        <TerrainLayer ghostFootprints={ghostFootprints} />
        {layers.buildings && <BuildingsLayer visibleSet={visibleSet} />}
        {layers.labels && <Labels visibleSet={visibleSet} />}
        {layers.buildings && <CompareMarkers visibleSet={visibleSet} />}
        <Grid
          position={[(minX + maxX) / 2, -18.5, (minZ + maxZ) / 2]}
          args={[span * 6, span * 6]}
          cellSize={20}
          sectionSize={100}
          cellColor="#cbd2db"
          sectionColor="#b3bcc8"
          fadeDistance={span * 3}
          fadeStrength={1.2}
          infiniteGrid
        />
      </group>
      <MeasureLayer />
      <TwinCameraRig />
    </>
  );
}

export default function TwinCanvas({ model }: { model: TwinModel }) {
  const tool = useTwinStore((s) => s.tool);
  const hovered = useTwinStore((s) => s.hovered);

  useEffect(() => {
    document.body.style.cursor = tool !== 'none' ? 'crosshair' : hovered !== null ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [tool, hovered]);

  return (
    <Canvas
      className="tw-canvas"
      flat
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 35, near: 1, far: 12000, position: [0, 500, 800] }}
      onCreated={({ gl, scene, camera }) => {
        // Dev-only handle for profiling and verification from the browser console.
        if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__twin = { gl, scene, camera, store: useTwinStore, model };
      }}
      onPointerMissed={(e) => {
        const s = useTwinStore.getState();
        if (e.type === 'click' && s.tool === 'none' && !s.compareMode && !e.shiftKey) s.select(null);
      }}
    >
      <TwinModelContext.Provider value={model}>
        <TwinScene model={model} />
      </TwinModelContext.Provider>
    </Canvas>
  );
}
