
import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Grid, Bounds, useBounds, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Ruler } from 'lucide-react';
import { ModelData, PrimitiveType, Primitive, Unit } from '../types';

// Fix for JSX intrinsic elements in React Three Fiber
// This ensures that tags like <mesh>, <boxGeometry>, <group>, etc. are recognized by the TypeScript compiler.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      boxGeometry: any;
      cylinderGeometry: any;
      coneGeometry: any;
      sphereGeometry: any;
      meshStandardMaterial: any;
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      group: any;
      primitive: any;
      color: any;
      line: any;
      bufferGeometry: any;
      lineBasicMaterial: any;
    }
  }
  // Support for environments using React 18+ style JSX mapping
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        mesh: any;
        boxGeometry: any;
        cylinderGeometry: any;
        coneGeometry: any;
        sphereGeometry: any;
        meshStandardMaterial: any;
        ambientLight: any;
        pointLight: any;
        directionalLight: any;
        group: any;
        primitive: any;
        color: any;
        line: any;
        bufferGeometry: any;
        lineBasicMaterial: any;
      }
    }
  }
}

interface Viewer3DProps {
  model: ModelData;
  globalScale: number;
  unit: Unit;
  onScaleChange: (newScale: number) => void;
}

const PrimitiveMesh: React.FC<{ 
  primitive: Primitive; 
  isSelected: boolean; 
  onClick: () => void;
  globalScale: number;
  unit: Unit;
}> = ({ primitive, isSelected, onClick, globalScale, unit }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const getGeometry = () => {
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
        ref={meshRef}
        scale={scaledSize}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {getGeometry()}
        <meshStandardMaterial 
          color={primitive.color || '#3b82f6'} 
          metalness={isSelected ? 0.4 : 0.1} 
          roughness={0.4}
          emissive={isSelected ? primitive.color : '#000000'}
          emissiveIntensity={isSelected ? 0.5 : 0}
        />
      </mesh>
      
      {isSelected && (
        <Html distanceFactor={10} position={[0, scaledSize[1]/2 + 5, 0]}>
          <div className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap shadow-xl border border-white/20">
            {scaledSize[0].toFixed(1)} x {scaledSize[1].toFixed(1)} x {scaledSize[2].toFixed(1)} {unit}
          </div>
        </Html>
      )}
    </group>
  );
};

const FitModel: React.FC<{ model: ModelData; globalScale: number }> = ({ model, globalScale }) => {
  const bounds = useBounds();
  useEffect(() => {
    if (model.primitives.length > 0) {
      bounds.refresh().clip().fit();
    }
  }, [model, globalScale, bounds]);
  return null;
};

const Viewer3D: React.FC<Viewer3DProps> = ({ model, globalScale, unit, onScaleChange }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [targetSize, setTargetSize] = useState<string>('');
  const [selectedAxis, setSelectedAxis] = useState<0 | 1 | 2>(1); // Default Y axis (Height)

  const handleCalibrate = () => {
    if (selectedIndex === null) return;
    const val = parseFloat(targetSize);
    if (isNaN(val) || val <= 0) return;

    const primitive = model.primitives[selectedIndex];
    const currentSizeOnAxis = primitive.scale[selectedAxis];
    
    // New Global Scale = Target Real Size / Original AI Relative Size
    const newGlobalScale = val / currentSizeOnAxis;
    onScaleChange(newGlobalScale);
    setTargetSize('');
  };

  const selectedPrimitive = selectedIndex !== null ? model.primitives[selectedIndex] : null;

  return (
    <div className="canvas-container bg-slate-950 border border-slate-800 shadow-2xl relative h-full min-h-[600px] rounded-xl overflow-hidden flex flex-col">
      <div className="flex-1 relative">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [150, 150, 150], fov: 45 }}>
          <color attach="background" args={['#020617']} />
          <ambientLight intensity={0.8} />
          <pointLight position={[200, 200, 200]} intensity={1.5} />
          <directionalLight position={[-100, 100, -100]} intensity={1} />

          <Suspense fallback={null}>
            <Bounds observe margin={1.5}>
              <group onClick={() => setSelectedIndex(null)}>
                <Stage intensity={0.5} environment={null} adjustCamera={false} center shadows="contact">
                  {model.primitives.map((p, idx) => (
                    <PrimitiveMesh 
                      key={`${idx}-${model.generationTime}`} 
                      primitive={p} 
                      isSelected={selectedIndex === idx}
                      onClick={() => setSelectedIndex(idx)}
                      globalScale={globalScale}
                      unit={unit}
                    />
                  ))}
                </Stage>
              </group>
              <FitModel model={model} globalScale={globalScale} />
            </Bounds>
            
            <Grid
              infiniteGrid
              fadeDistance={1000}
              fadeStrength={5}
              cellSize={globalScale > 10 ? 10 : 1}
              sectionSize={globalScale > 10 ? 50 : 5}
              sectionColor="#1e293b"
              cellColor="#0f172a"
              position={[0, -0.1, 0]}
            />
          </Suspense>

          <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        </Canvas>

        {/* Overlay de Calibración */}
        {selectedPrimitive && (
          <div className="absolute top-4 left-4 z-10 w-64 bg-slate-900/90 backdrop-blur-md border border-white/10 p-5 rounded-2xl shadow-2xl text-white animate-in slide-in-from-left duration-300">
            <h5 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center">
              <Ruler size={14} className="mr-2" /> Calibrar Escala Real
            </h5>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-2">Seleccionar Arista/Eje</label>
                <div className="grid grid-cols-3 gap-1">
                  {['Ancho (X)', 'Alto (Y)', 'Fondo (Z)'].map((label, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedAxis(i as any)}
                      className={`py-1.5 text-[10px] font-bold rounded border transition-all ${
                        selectedAxis === i ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-2">
                  Dimensión Real en {unit}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={targetSize}
                    onChange={(e) => setTargetSize(e.target.value)}
                    placeholder="Ej: 150"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 outline-none font-bold"
                  />
                  <button
                    onClick={handleCalibrate}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-black text-xs transition-all active:scale-95"
                  >
                    OK
                  </button>
                </div>
              </div>

              <p className="text-[9px] text-slate-500 italic leading-tight">
                * Esto ajustará proporcionalmente todas las piezas del modelo Revit.
              </p>
            </div>
          </div>
        )}

        <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none">
          <span className="bg-blue-600/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg backdrop-blur-sm">
            {model.primitives.length} PRIMITIVAS
          </span>
          <span className="bg-slate-800/90 text-slate-300 text-[10px] font-bold px-2 py-1 rounded shadow-lg backdrop-blur-sm">
            FACTOR ESCALA: {globalScale.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Viewer3D;
