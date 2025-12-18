
import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, ThreeElements, useThree } from '@react-three/fiber';
import { OrbitControls, Stage, Grid, Bounds, useBounds, Html, Line, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { Ruler, Crosshair, Check, MousePointer2 } from 'lucide-react';
import { ModelData, PrimitiveType, Primitive, Unit } from '../types';

// Fix for JSX intrinsic elements errors in React Three Fiber by augmenting the global JSX namespace.
// This ensures that Three.js specific tags like <mesh>, <boxGeometry>, etc. are recognized by the TypeScript compiler.
// We use a clean augmentation for the global JSX namespace which is most compatible with standard R3F/React setups.
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
  isHovered: boolean;
  onPointerDown: (point: THREE.Vector3) => void;
  onPointerMove: (point: THREE.Vector3) => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}> = ({ primitive, globalScale, isMeasureMode, isHovered, onPointerDown, onPointerMove, onPointerOver, onPointerOut }) => {
  const getGeometry = () => {
    // Corrected intrinsic JSX geometry components using refined type augmentation
    switch (primitive.type) {
      case PrimitiveType.BOX: return <boxGeometry args={[1, 1, 1]} />;
      case PrimitiveType.CYLINDER: return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case PrimitiveType.PYRAMID: return <coneGeometry args={[0.5, 1, 4]} />;
      case PrimitiveType.SPHERE: return <sphereGeometry args={[0.5, 32, 32]} />;
      default: return <boxGeometry args={[1, 1, 1]} />;
    }
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
        scale={scaledSize}
        onPointerDown={(e) => {
          if (!isMeasureMode) return;
          e.stopPropagation();
          onPointerDown(e.point);
        }}
        onPointerMove={(e) => {
          if (!isMeasureMode) return;
          e.stopPropagation();
          onPointerMove(e.point);
        }}
        onPointerOver={(e) => {
          if (!isMeasureMode) return;
          e.stopPropagation();
          onPointerOver();
          document.body.style.cursor = 'crosshair';
        }}
        onPointerOut={() => {
          onPointerOut();
          document.body.style.cursor = 'auto';
        }}
      >
        {getGeometry()}
        <meshStandardMaterial 
          color={primitive.color || '#3b82f6'} 
          metalness={0.1} 
          roughness={0.6}
          emissive={isHovered && !isMeasureMode ? "#ffffff" : "#000000"}
          emissiveIntensity={isHovered && !isMeasureMode ? 0.2 : 0}
          transparent={isMeasureMode && isHovered}
          opacity={isMeasureMode && isHovered ? 0.8 : 1}
        />
        {/* Resaltado reactivo técnico para aristas y caras en modo medición */}
        {isMeasureMode && isHovered && (
          <Edges 
            scale={1.01} 
            threshold={15} 
            color="#ffffff" 
            renderOrder={1}
          >
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
          </Edges>
        )}
      </mesh>
    </group>
  );
};

const Viewer3D: React.FC<Viewer3DProps> = ({ model, globalScale, unit, onScaleChange, onUnitChange }) => {
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const [tempPoint, setTempPoint] = useState<THREE.Vector3 | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [userInputValue, setUserInputValue] = useState('');

  const currentDistance = useMemo(() => {
    if (points.length < 2) return 0;
    return points[0].distanceTo(points[1]);
  }, [points]);

  const liveDistance = useMemo(() => {
    if (points.length !== 1 || !tempPoint) return 0;
    return points[0].distanceTo(tempPoint);
  }, [points, tempPoint]);

  const handlePointSelect = (point: THREE.Vector3) => {
    if (!isMeasureMode) return;
    const newPoints = points.length >= 2 ? [point] : [...points, point];
    setPoints(newPoints);
    if (newPoints.length === 2) setTempPoint(null);
  };

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
      {/* Barra de herramientas superior */}
      <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center pointer-events-none">
        <div className="flex gap-3 pointer-events-auto">
          <button
            onClick={() => {
              setIsMeasureMode(!isMeasureMode);
              setPoints([]);
              setTempPoint(null);
            }}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-[10px] transition-all shadow-2xl uppercase tracking-widest ${
              isMeasureMode 
                ? 'bg-blue-600 text-white ring-4 ring-blue-500/30' 
                : 'bg-slate-900 text-slate-300 hover:text-white border border-white/10'
            }`}
          >
            <Ruler size={16} />
            {isMeasureMode ? 'CANCELAR MEDICIÓN' : 'MEDIR PARA ESCALAR'}
          </button>

          {isMeasureMode && (
             <div className="bg-slate-900/90 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-blue-500/50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">
                  {points.length === 0 ? 'CLIC EN ARISTA/CARA (ORIGEN)' : points.length === 1 ? 'CLIC EN ARISTA/CARA (DESTINO)' : 'CALIBRANDO'}
                </span>
                <div className="flex gap-1">
                  <div className={`w-2 h-2 rounded-full transition-all duration-300 ${points.length >= 1 ? 'bg-blue-500 scale-125' : 'bg-slate-700'}`}></div>
                  <div className={`w-2 h-2 rounded-full transition-all duration-300 ${points.length >= 2 ? 'bg-blue-500 scale-125' : 'bg-slate-700'}`}></div>
                </div>
             </div>
          )}
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <select
            value={unit}
            onChange={(e) => onUnitChange(e.target.value as Unit)}
            className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-5 py-3.5 rounded-2xl border border-white/10 outline-none focus:ring-4 ring-blue-500/20 shadow-2xl cursor-pointer appearance-none"
          >
            <optgroup label="Métrico">
              <option value={Unit.MM}>MM</option>
              <option value={Unit.CM}>CM</option>
              <option value={Unit.M}>M</option>
            </optgroup>
            <optgroup label="Imperial">
              <option value={Unit.IN}>IN</option>
              <option value={Unit.FT}>FT</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Panel de calibración */}
      {points.length === 2 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-6 animate-in slide-in-from-bottom-8">
          <div className="bg-slate-900/95 backdrop-blur-2xl border border-blue-500/30 p-8 rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.6)] text-white">
            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-6 flex items-center">
              <Crosshair size={16} className="mr-3" /> Definir Dimensión Real
            </h5>
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-widest pb-4 border-b border-white/5">
                <span>Medida en Visor:</span>
                <span className="text-blue-400 text-lg font-black">{currentDistance.toFixed(3)} {unit}</span>
              </div>
              <div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={userInputValue}
                      onChange={(e) => setUserInputValue(e.target.value)}
                      placeholder="Medida real..."
                      autoFocus
                      className="w-full bg-slate-800/50 border border-white/10 rounded-2xl px-6 py-5 text-xl font-black focus:ring-4 focus:ring-blue-600/30 outline-none placeholder:text-slate-600 transition-all"
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-500 uppercase text-sm">{unit}</span>
                  </div>
                  <button onClick={applyCalibration} className="bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-2xl font-black transition-all active:scale-95 shadow-2xl shadow-blue-900/40">
                    <Check size={28} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 w-full h-full relative">
        <Canvas 
          shadows 
          dpr={[1, 2]} 
          camera={{ position: [150, 150, 150], fov: 45 }} 
          style={{ width: '100%', height: '100%' }}
          onPointerMissed={() => setTempPoint(null)}
        >
          <color attach="background" args={['#020617']} />
          <ambientLight intensity={1.5} />
          <pointLight position={[200, 200, 200]} intensity={2.5} />
          <directionalLight position={[-100, 100, -100]} intensity={1.5} />
          
          <Suspense fallback={null}>
            <Bounds observe margin={1.2}>
              {/* Fix: Passed an empty object to 'center' prop instead of boolean shorthand to resolve Type 'true' is not assignable error */}
              <Stage intensity={0.5} environment={null} adjustCamera={false} center={{}} shadows="contact">
                {model.primitives.map((p, idx) => (
                  <PrimitiveMesh 
                    key={`${idx}-${model.generationTime}`} 
                    primitive={p} 
                    globalScale={globalScale}
                    isMeasureMode={isMeasureMode}
                    isHovered={hoveredIdx === idx}
                    onPointerDown={handlePointSelect}
                    onPointerMove={setTempPoint}
                    onPointerOver={() => setHoveredIdx(idx)}
                    onPointerOut={() => setHoveredIdx(null)}
                  />
                ))}
              </Stage>

              {/* Cursor de medición técnico */}
              {isMeasureMode && tempPoint && points.length < 2 && (
                <group>
                  <mesh position={tempPoint}>
                    <sphereGeometry args={[globalScale * 0.35, 16, 16]} />
                    <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
                  </mesh>
                  {points.length === 1 && (
                    <group>
                      <Line
                        points={[points[0], tempPoint]}
                        color="#3b82f6"
                        lineWidth={2}
                        dashed
                        dashSize={0.5}
                        gapSize={0.2}
                      />
                      <Html position={tempPoint.clone().lerp(points[0], 0.5)} center>
                        <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-black whitespace-nowrap shadow-2xl border border-white/20 -translate-y-6">
                          {liveDistance.toFixed(2)} {unit}
                        </div>
                      </Html>
                    </group>
                  )}
                </group>
              )}

              {/* Puntos fijados (Vértices de medida) */}
              {points.map((p, i) => (
                <mesh key={i} position={p}>
                  <sphereGeometry args={[globalScale * 0.5, 24, 24]} />
                  <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={2} />
                </mesh>
              ))}

              {/* Línea de cota técnica */}
              {points.length === 2 && (
                <group>
                  <Line
                    points={[points[0], points[1]]}
                    color="#3b82f6"
                    lineWidth={4}
                  />
                  <Html position={points[0].clone().lerp(points[1], 0.5)} center>
                    <div className="bg-slate-900 text-blue-400 px-4 py-2.5 rounded-2xl text-[13px] font-black whitespace-nowrap shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-blue-500/30 -translate-y-12 flex items-center gap-2">
                      <Ruler size={14} /> {currentDistance.toFixed(3)} {unit}
                    </div>
                  </Html>
                </group>
              )}
            </Bounds>

            <Grid
              infiniteGrid
              fadeDistance={1200}
              fadeStrength={6}
              cellSize={globalScale > 10 ? 10 : 1}
              sectionSize={globalScale > 10 ? 50 : 5}
              sectionColor="#1e293b"
              cellColor="#0f172a"
              position={[0, -0.1, 0]}
            />
          </Suspense>

          <OrbitControls 
            makeDefault 
            enableDamping 
            dampingFactor={0.05} 
            enabled={!isMeasureMode || points.length < 1} 
          />
        </Canvas>
      </div>

      <div className="absolute bottom-6 right-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex gap-8 bg-slate-900/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/5">
        {isMeasureMode ? (
          <span className="text-blue-400 flex items-center gap-3">
            <MousePointer2 size={14} /> {points.length === 0 ? 'Selecciona origen' : points.length === 1 ? 'Selecciona destino' : 'Calibración lista'}
          </span>
        ) : (
          <>
            <span className="hover:text-white transition-colors cursor-default">🖱️ Orbitar</span>
            <span className="hover:text-white transition-colors cursor-default">🖐️ Desplazar</span>
            <span className="hover:text-white transition-colors cursor-default">🎡 Zoom</span>
          </>
        )}
      </div>
    </div>
  );
};

export default Viewer3D;
