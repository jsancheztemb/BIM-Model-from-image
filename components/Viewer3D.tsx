
import React, { Suspense, useMemo, useState, useRef } from 'react';
import { Canvas, ThreeElements, useThree } from '@react-three/fiber';
import { OrbitControls, Stage, Grid, Bounds, Html, Line, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { Ruler, Crosshair, Check, MousePointer2, Target } from 'lucide-react';
import { ModelData, PrimitiveType, Primitive, Unit } from '../types';

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

interface Viewer3DProps {
  model: ModelData;
  globalScale: number;
  unit: Unit;
  onScaleChange: (newScale: number) => void;
  onUnitChange: (newUnit: Unit) => void;
}

const PrimitiveMesh: React.FC<{ 
  primitive: Primitive; 
  globalScale: number;
  isMeasureMode: boolean;
  onPointSelect: (point: THREE.Vector3) => void;
  onHoverPoint: (point: THREE.Vector3 | null) => void;
}> = ({ primitive, globalScale, isMeasureMode, onPointSelect, onHoverPoint }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [localHoveredVertex, setLocalHoveredVertex] = useState<THREE.Vector3 | null>(null);

  const getGeometry = () => {
    switch (primitive.type) {
      case PrimitiveType.BOX: return <boxGeometry args={[1, 1, 1]} />;
      case PrimitiveType.CYLINDER: return <cylinderGeometry args={[0.5, 0.5, 1, 16]} />;
      case PrimitiveType.PYRAMID: return <coneGeometry args={[0.5, 1, 4]} />;
      case PrimitiveType.SPHERE: return <sphereGeometry args={[0.5, 16, 16]} />;
      default: return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isMeasureMode || !meshRef.current) return;
    e.stopPropagation();

    // Lógica de Snapping a Vértices
    const geometry = meshRef.current.geometry;
    const positionAttribute = geometry.getAttribute('position');
    const localPoint = e.point.clone();
    meshRef.current.worldToLocal(localPoint);

    let closestVertex = new THREE.Vector3();
    let minDistance = Infinity;

    for (let i = 0; i < positionAttribute.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
      const dist = v.distanceTo(localPoint);
      if (dist < minDistance) {
        minDistance = dist;
        closestVertex.copy(v);
      }
    }

    // Umbral de snapping (si está muy cerca de un vértice, lo fijamos)
    const worldVertex = closestVertex.clone();
    meshRef.current.localToWorld(worldVertex);
    
    if (minDistance < 0.2) {
      setLocalHoveredVertex(worldVertex);
      onHoverPoint(worldVertex);
    } else {
      setLocalHoveredVertex(null);
      onHoverPoint(e.point);
    }
  };

  const handlePointerDown = (e: any) => {
    if (!isMeasureMode) return;
    e.stopPropagation();
    // Si tenemos un vértice seleccionado por snapping, usamos ese, si no el punto del raycast
    onPointSelect(localHoveredVertex || e.point);
  };

  const scaledPosition: [number, number, number] = [
    primitive.position[0] * globalScale,
    primitive.position[1] * globalScale,
    primitive.position[2] * globalScale,
  ];

  const scaledSize: [number, number, number] = [
    primitive.scale[0] * globalScale,
    primitive.scale[1] * globalScale,
    primitive.scale[2] * globalScale,
  ];

  return (
    <group position={scaledPosition} rotation={primitive.rotation}>
      <mesh
        ref={meshRef}
        scale={scaledSize}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerOver={() => isMeasureMode && (document.body.style.cursor = 'crosshair')}
        onPointerOut={() => {
          setLocalHoveredVertex(null);
          onHoverPoint(null);
          document.body.style.cursor = 'auto';
        }}
      >
        {getGeometry()}
        <meshStandardMaterial 
          color={primitive.color || '#3b82f6'} 
          metalness={0.1} 
          roughness={0.8}
          transparent={isMeasureMode && localHoveredVertex !== null}
          opacity={isMeasureMode && localHoveredVertex !== null ? 0.8 : 1}
        />
        {/* Visualización de estructura interna para referencia técnica */}
        {isMeasureMode && (
          <Edges 
            threshold={15} 
            color={localHoveredVertex ? "#60a5fa" : "#1e293b"} 
          />
        )}
      </mesh>
      {/* Indicador de Vértice Detectado (Snap) */}
      {localHoveredVertex && (
        <group position={meshRef.current?.worldToLocal(localHoveredVertex.clone()) || [0,0,0]}>
           <mesh scale={0.05 / globalScale}>
             <sphereGeometry args={[1, 16, 16]} />
             <meshBasicMaterial color="#ffffff" />
           </mesh>
        </group>
      )}
    </group>
  );
};

const Viewer3D: React.FC<Viewer3DProps> = ({ model, globalScale, unit, onScaleChange, onUnitChange }) => {
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const [snappedHoverPoint, setSnappedHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [userInputValue, setUserInputValue] = useState('');

  const currentDistance = useMemo(() => {
    if (points.length < 2) return 0;
    return points[0].distanceTo(points[1]);
  }, [points]);

  const liveDistance = useMemo(() => {
    if (points.length !== 1 || !snappedHoverPoint) return 0;
    return points[0].distanceTo(snappedHoverPoint);
  }, [points, snappedHoverPoint]);

  const applyCalibration = () => {
    const targetVal = parseFloat(userInputValue);
    if (isNaN(targetVal) || targetVal <= 0 || currentDistance === 0) return;
    const rawDistance = currentDistance / globalScale;
    const newScale = targetVal / rawDistance;
    onScaleChange(newScale);
    setPoints([]);
    setUserInputValue('');
    setIsMeasureMode(false);
  };

  return (
    <div className="w-full h-full relative flex flex-col">
      {/* Toolbar Superior */}
      <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center pointer-events-none">
        <div className="flex gap-3 pointer-events-auto">
          <button
            onClick={() => {
              setIsMeasureMode(!isMeasureMode);
              setPoints([]);
              setSnappedHoverPoint(null);
            }}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-[10px] transition-all shadow-xl uppercase tracking-widest ${
              isMeasureMode 
                ? 'bg-blue-600 text-white ring-4 ring-blue-500/20' 
                : 'bg-slate-900 text-slate-300 hover:text-white border border-white/10'
            }`}
          >
            <Ruler size={16} />
            {isMeasureMode ? 'MODO PRECISIÓN ACTIVO' : 'MEDIR ENTRE PUNTOS'}
          </button>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <select
            value={unit}
            onChange={(e) => onUnitChange(e.target.value as Unit)}
            className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-5 py-3.5 rounded-2xl border border-white/10 outline-none shadow-xl cursor-pointer"
          >
            <option value={Unit.MM}>MM</option>
            <option value={Unit.CM}>CM</option>
            <option value={Unit.M}>M</option>
          </select>
        </div>
      </div>

      {/* Modal de Calibración */}
      {points.length === 2 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-6 animate-in slide-in-from-bottom-8">
          <div className="bg-slate-900/95 backdrop-blur-2xl border border-blue-500/30 p-8 rounded-[2.5rem] shadow-2xl text-white">
            <h5 className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-6 flex items-center">
              <Target size={14} className="mr-3" /> AJUSTE DE REFERENCIA
            </h5>
            <div className="space-y-6">
              <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4 border-b border-white/5">
                <span>DISTANCIA MEDIDA:</span>
                <span className="text-blue-400 font-black">{currentDistance.toFixed(3)} {unit}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={userInputValue}
                  onChange={(e) => setUserInputValue(e.target.value)}
                  placeholder="VALOR REAL"
                  className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-4 text-base font-black outline-none focus:ring-2 ring-blue-500"
                />
                <button onClick={applyCalibration} className="bg-blue-600 hover:bg-blue-50 text-white px-6 rounded-xl font-black transition-all">
                  <Check size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Escena 3D */}
      <div className="flex-1 w-full h-full relative">
        <Canvas 
          shadows 
          dpr={[1, 2]} 
          camera={{ position: [100, 100, 100], fov: 40 }} 
          onPointerMissed={() => setSnappedHoverPoint(null)}
        >
          <color attach="background" args={['#020617']} />
          <ambientLight intensity={1.5} />
          <pointLight position={[100, 100, 100]} intensity={2} />
          
          <Suspense fallback={null}>
            <Bounds observe margin={1.2}>
              <Stage intensity={0.5} environment={null} adjustCamera={false} shadows="contact">
                {model.primitives.map((p, idx) => (
                  <PrimitiveMesh 
                    key={`${idx}-${model.generationTime}`} 
                    primitive={p} 
                    globalScale={globalScale}
                    isMeasureMode={isMeasureMode}
                    onPointSelect={(pt) => setPoints(prev => prev.length >= 2 ? [pt] : [...prev, pt])}
                    onHoverPoint={setSnappedHoverPoint}
                  />
                ))}
              </Stage>

              {/* Guía visual de medición en tiempo real */}
              {isMeasureMode && snappedHoverPoint && points.length < 2 && (
                <group>
                  <mesh position={snappedHoverPoint}>
                    <sphereGeometry args={[0.3, 16, 16]} />
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>
                  {points.length === 1 && (
                    <group>
                      <Line
                        points={[points[0], snappedHoverPoint]}
                        color="#3b82f6"
                        lineWidth={2}
                      />
                      <Html position={snappedHoverPoint.clone().lerp(points[0], 0.5)} center>
                        <div className="bg-blue-600 text-white px-2 py-1 rounded text-[9px] font-black shadow-lg">
                          {liveDistance.toFixed(3)} {unit}
                        </div>
                      </Html>
                    </group>
                  )}
                </group>
              )}

              {/* Puntos de control fijados */}
              {points.map((p, i) => (
                <mesh key={i} position={p}>
                  <sphereGeometry args={[0.4, 16, 16]} />
                  <meshBasicMaterial color="#3b82f6" />
                </mesh>
              ))}

              {points.length === 2 && (
                <Line points={[points[0], points[1]]} color="#3b82f6" lineWidth={3} />
              )}
            </Bounds>

            <Grid
              infiniteGrid
              fadeDistance={1000}
              fadeStrength={5}
              cellSize={5}
              sectionSize={25}
              sectionColor="#1e293b"
              cellColor="#0f172a"
              position={[0, -0.1, 0]}
            />
          </Suspense>

          <OrbitControls 
            makeDefault 
            enableDamping 
            enabled={!isMeasureMode || points.length < 1} 
          />
        </Canvas>
      </div>

      <div className="absolute bottom-6 right-6 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex gap-6 bg-slate-900/60 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/5">
        {isMeasureMode ? (
          <span className="text-blue-400 flex items-center gap-2">
            <Crosshair size={12} /> SNAPPING A VÉRTICES ACTIVO
          </span>
        ) : (
          <>
            <span>🖱️ Orbitar</span>
            <span>🖐️ Desplazar</span>
          </>
        )}
      </div>
    </div>
  );
};

export default Viewer3D;
