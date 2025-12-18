
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Trash2, 
  ChevronRight, 
  AlertCircle,
  BoxSelect,
  Layers,
  CheckCircle2,
  RefreshCw,
  Plus,
  Beaker,
  ChevronLeft,
  Activity
} from 'lucide-react';
import { LOD, AppState, PrimitiveType, Unit, LODConfig, ModelData } from './types';
import { generate3DPrimitives } from './services/geminiService';
import Viewer3D from './components/Viewer3D';
import { exportToOBJ, exportToDXF, downloadFile } from './utils/exportUtils';

const DEFAULT_LOD_CONFIGS: Record<LOD, LODConfig> = {
  [LOD.LOW]: { maxPrimitives: 6 },
  [LOD.MEDIUM]: { maxPrimitives: 15 },
  [LOD.HIGH]: { maxPrimitives: 40 },
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'detail' | 'viewer' | 'export'>('upload');
  const [state, setState] = useState<AppState>({
    images: [],
    lod: LOD.MEDIUM,
    lodConfigs: { ...DEFAULT_LOD_CONFIGS },
    unit: Unit.CM,
    model: null,
    globalScale: 1,
    isProcessing: false,
    error: null,
    notification: null,
  });

  const prevLodRef = useRef<LOD>(state.lod);

  useEffect(() => {
    if (state.model && activeTab === 'viewer' && prevLodRef.current !== state.lod && state.images.length > 0) {
      processModel();
    }
    prevLodRef.current = state.lod;
  }, [state.lod, activeTab]);

  useEffect(() => {
    if (state.notification) {
      const timer = setTimeout(() => setState(s => ({ ...s, notification: null })), 6000);
      return () => clearTimeout(timer);
    }
  }, [state.notification]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const newImages: string[] = [];
    let processedCount = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) newImages.push(event.target.result as string);
        processedCount++;
        if (processedCount === files.length) setState(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const loadTestModel = () => {
    const testModel: ModelData = {
      generationTime: Date.now(),
      primitives: [
        { type: PrimitiveType.BOX, position: [0, 0, 0], rotation: [0, 0, 0], scale: [40, 40, 40], color: '#3b82f6' },
        { type: PrimitiveType.CYLINDER, position: [0, 40, 0], rotation: [0, 0, 0], scale: [20, 40, 20], color: '#10b981' },
        { type: PrimitiveType.PYRAMID, position: [40, 0, 0], rotation: [0, 0, 1.57], scale: [30, 30, 30], color: '#f59e0b' },
        { type: PrimitiveType.SPHERE, position: [-40, 0, 0], rotation: [0, 0, 0], scale: [25, 25, 25], color: '#ef4444' }
      ]
    };
    setState(prev => ({ ...prev, model: testModel, globalScale: 1, notification: { message: "Entorno de demostración cargado.", type: 'info' } }));
    setActiveTab('viewer');
  };

  const processModel = async () => {
    if (state.images.length === 0) return;
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    setActiveTab('viewer');
    try {
      const model = await generate3DPrimitives(state.images, state.lod, state.lodConfigs[state.lod], 100, state.unit);
      setState(prev => ({ ...prev, model, isProcessing: false, globalScale: 1 }));
    } catch (err) {
      setState(prev => ({ ...prev, isProcessing: false, error: err instanceof Error ? err.message : "Error de IA." }));
    }
  };

  const handleScaleChange = (newScale: number) => {
    setState(s => ({ 
      ...s, 
      globalScale: newScale,
      notification: { message: "Factor de escala sincronizado para exportación BIM.", type: 'success' }
    }));
  };

  const handleExport = (format: 'OBJ' | 'DXF') => {
    if (!state.model) return;
    try {
      const scaledModel: ModelData = {
        ...state.model,
        primitives: state.model.primitives.map(p => ({
          ...p,
          position: p.position.map(v => v * state.globalScale) as [number, number, number],
          scale: p.scale.map(v => v * state.globalScale) as [number, number, number]
        }))
      };
      const fileName = `BIM_Object_${state.lod}_${Date.now()}.${format.toLowerCase()}`;
      const content = format === 'OBJ' ? exportToOBJ(scaledModel) : exportToDXF(scaledModel);
      downloadFile(content, fileName, format === 'OBJ' ? "text/plain" : "application/dxf");
      setState(s => ({ ...s, notification: { message: `Archivo ${format} generado correctamente.`, type: 'success' } }));
    } catch (e) {
      setState(s => ({ ...s, notification: { message: "Error al exportar geometría.", type: 'error' } }));
    }
  };

  const getEstimatedFaces = (count: number) => Math.round(count * 12.5);

  const renderUploadTab = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-200 text-center relative overflow-hidden">
        <div className="mx-auto w-20 h-20 bg-slate-900 text-white rounded-3xl flex items-center justify-center mb-8 shadow-xl">
          <Upload size={36} />
        </div>
        <h3 className="text-3xl font-black mb-3 text-slate-900 uppercase tracking-tight">Captura de Datos</h3>
        <p className="text-slate-500 mb-10 max-w-lg mx-auto leading-relaxed font-medium">
          Suba fotos reales o planos técnicos. La IA reconstruirá la geometría en sólidos paramétricos para modelos BIM.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <label className="group inline-flex items-center px-8 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all cursor-pointer shadow-lg shadow-blue-500/20">
            <Plus size={20} className="mr-3" />
            Cargar Fotografías
            <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
          </label>
          <button onClick={loadTestModel} className="flex items-center px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all border border-slate-200">
            <Beaker size={20} className="mr-3" />
            Entorno Demo
          </button>
        </div>
      </div>
      {state.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {state.images.map((img, idx) => (
            <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-200 aspect-square bg-white shadow-sm hover:ring-4 ring-blue-500/30 transition-all">
              <img src={img} className="w-full h-full object-cover" />
              <button onClick={() => setState(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))} className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 size={24} />
              </button>
            </div>
          ))}
        </div>
      )}
      {state.images.length > 0 && (
        <div className="flex justify-end pt-8">
          <button onClick={() => setActiveTab('detail')} className="flex items-center px-10 py-5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-black shadow-xl">
            Continuar a Nivel de Detalle
            <ChevronRight size={20} className="ml-3" />
          </button>
        </div>
      )}
    </div>
  );

  const renderDetailTab = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center uppercase">
              <Layers size={28} className="mr-4 text-blue-600" />
              Niveles de Detalle (LOD)
            </h3>
            <p className="text-slate-500 mt-1 font-medium italic">Configure la densidad geométrica para optimizar el rendimiento en software BIM.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { id: LOD.LOW, title: 'LOD 100 / Bajo', desc: 'Volumen conceptual.' },
            { id: LOD.MEDIUM, title: 'LOD 200 / Medio', desc: 'Geometría constructiva básica.' },
            { id: LOD.HIGH, title: 'LOD 350 / Alto', desc: 'Detalle para fabricación.' },
          ].map((level) => (
            <div
              key={level.id}
              onClick={() => setState(s => ({ ...s, lod: level.id }))}
              className={`p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer relative overflow-hidden ${
                state.lod === level.id ? 'border-blue-600 bg-blue-50/50 shadow-xl' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <h4 className="font-black text-lg mb-1 text-slate-800 uppercase tracking-tight">{level.title}</h4>
              <p className="text-slate-500 text-xs font-medium mb-6">{level.desc}</p>
              
              <div className="pt-6 border-t border-slate-200 space-y-4" onClick={e => e.stopPropagation()}>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Máx. Sólidos</label>
                  <input 
                    type="number"
                    value={state.lodConfigs[level.id].maxPrimitives}
                    onChange={(e) => setState(prev => ({ ...prev, lodConfigs: { ...prev.lodConfigs, [level.id]: { maxPrimitives: parseInt(e.target.value) || 1 } } }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-black text-base focus:ring-4 ring-blue-500/10"
                  />
                </div>
                <div className="flex items-center justify-between px-1">
                   <div className="flex items-center text-blue-600 gap-2">
                     <Activity size={14} />
                     <span className="text-[10px] font-black uppercase tracking-tight">Carga BIM:</span>
                   </div>
                   <span className="text-[10px] font-black text-slate-900">~{getEstimatedFaces(state.lodConfigs[level.id].maxPrimitives)} CARAS</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="flex justify-between items-center pt-8 border-t border-slate-200">
        <button onClick={() => setActiveTab('upload')} className="px-8 py-4 text-slate-600 font-black hover:bg-slate-100 rounded-xl transition-all uppercase tracking-widest text-[10px]">← Atrás</button>
        <button onClick={processModel} className="flex items-center px-10 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl font-black">
          <RefreshCw size={20} className={`mr-3 ${state.isProcessing ? 'animate-spin' : ''}`} />
          {state.isProcessing ? 'Calculando Primitivas...' : 'Generar modelo'}
        </button>
      </div>
    </div>
  );

  const renderViewerTab = () => (
    <div className="animate-in fade-in duration-500 h-[80vh] flex flex-col">
      <div className="flex-1 relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200 bg-slate-950">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
          {[LOD.LOW, LOD.MEDIUM, LOD.HIGH].map((l) => (
            <button
              key={l}
              onClick={() => setState(s => ({ ...s, lod: l }))}
              disabled={state.isProcessing}
              className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                state.lod === l ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              LOD {l === LOD.LOW ? '100' : l === LOD.MEDIUM ? '200' : '350'}
            </button>
          ))}
        </div>

        {state.isProcessing ? (
          <div className="absolute inset-0 z-30 bg-slate-950/90 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-[6px] border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h4 className="text-xl font-black text-white tracking-[0.2em] uppercase">IA Generando Sólidos</h4>
            <p className="text-slate-500 mt-2 font-bold uppercase tracking-[0.1em] text-[10px]">Identificando {state.lodConfigs[state.lod].maxPrimitives} geometrías...</p>
          </div>
        ) : state.model ? (
          <Viewer3D 
            model={state.model} 
            globalScale={state.globalScale}
            unit={state.unit}
            onScaleChange={handleScaleChange}
            onUnitChange={(newUnit) => setState(s => ({ ...s, unit: newUnit }))}
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-slate-600">
            <p className="font-black text-lg uppercase tracking-widest opacity-20">Esperando Geometría</p>
          </div>
        )}
      </div>
      
      <div className="mt-8 flex justify-between items-center">
        <button onClick={() => setActiveTab('detail')} className="flex items-center px-6 py-3 text-slate-500 font-black hover:bg-slate-200 rounded-xl transition-all uppercase text-[10px]">
          <ChevronLeft size={16} className="mr-2" /> Volver a LOD
        </button>
        <button onClick={() => setActiveTab('export')} className="flex items-center px-12 py-5 bg-slate-900 text-white rounded-[2rem] hover:bg-blue-600 transition-all font-black shadow-xl shadow-slate-900/10 text-base">
          Exportar para software BIM
          <ChevronRight size={20} className="ml-3" />
        </button>
      </div>
    </div>
  );

  const renderExportTab = () => (
    <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-bottom-10 duration-700">
      <div className="bg-white p-16 rounded-[3rem] shadow-sm border border-slate-200 text-center">
        <div className="mx-auto w-20 h-20 bg-green-500 text-white rounded-3xl flex items-center justify-center mb-10 shadow-xl">
          <CheckCircle2 size={40} />
        </div>
        <h3 className="text-4xl font-black mb-4 text-slate-900 tracking-tight uppercase">Modelo BIM Generado</h3>
        <p className="text-slate-500 mb-12 font-medium">Su geometría está lista para ser insertada en software BIM o CAD.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-200 hover:border-blue-500/50 transition-all group flex items-center justify-center">
            <button 
              onClick={() => handleExport('OBJ')} 
              className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black shadow-lg uppercase tracking-widest text-sm hover:bg-slate-800 transition-all"
            >
              Descargar OBJ
            </button>
          </div>
          <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-200 hover:border-blue-500/50 transition-all group flex items-center justify-center">
            <button 
              onClick={() => handleExport('DXF')} 
              className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 uppercase tracking-widest text-sm hover:bg-blue-700 transition-all"
            >
              Descargar DXF
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-12 bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg">
              <BoxSelect size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none uppercase">GeoImage</h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">BIM AI Modeler</span>
            </div>
          </div>
          <nav className="hidden lg:flex items-center space-x-2 p-1.5 bg-slate-100 rounded-2xl">
            {[
              { id: 'upload', label: '1. IMAGEN' },
              { id: 'detail', label: '2. NIVEL DE DETALLE' },
              { id: 'viewer', label: '3. MODELO' },
              { id: 'export', label: '4. EXPORTAR' }
            ].map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-xl ${
                  activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-10">
        {activeTab === 'upload' && renderUploadTab()}
        {activeTab === 'detail' && renderDetailTab()}
        {activeTab === 'viewer' && renderViewerTab()}
        {activeTab === 'export' && renderExportTab()}
      </main>
      <footer className="max-w-7xl mx-auto w-full px-8 py-10 flex items-center justify-between border-t border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <span>&copy; 2024 GeoImage AI - Workflow BIM Especializado</span>
        <span>Desarrollado por <span className="text-slate-900 font-black">Javier Sánchez-Tembleque</span></span>
      </footer>
    </div>
  );
};

export default App;
