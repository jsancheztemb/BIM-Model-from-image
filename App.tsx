
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Settings, 
  Box, 
  Upload, 
  Cpu, 
  Download, 
  Trash2, 
  ChevronRight, 
  AlertCircle,
  BoxSelect,
  Layers,
  CheckCircle2,
  X,
  Info,
  RefreshCw,
  Plus,
  RotateCcw,
  FileCode,
  Beaker,
  Maximize
} from 'lucide-react';
import { LOD, AppState, PrimitiveType, Unit, LODConfig, ModelData } from './types';
import { generate3DPrimitives } from './services/geminiService';
import Viewer3D from './components/Viewer3D';
import { exportToOBJ, exportToDXF, downloadFile } from './utils/exportUtils';

const DEFAULT_LOD_CONFIGS: Record<LOD, LODConfig> = {
  [LOD.LOW]: { maxPrimitives: 5 },
  [LOD.MEDIUM]: { maxPrimitives: 12 },
  [LOD.HIGH]: { maxPrimitives: 25 },
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'detail' | 'viewer'>('upload');
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
      const timer = setTimeout(() => setState(s => ({ ...s, notification: null })), 5000);
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
    setState(prev => ({ ...prev, model: testModel, globalScale: 1, notification: { message: "Modelo demo cargado.", type: 'info' } }));
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
      setState(prev => ({ ...prev, isProcessing: false, error: err instanceof Error ? err.message : "Error." }));
    }
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
      const content = format === 'OBJ' ? exportToOBJ(scaledModel) : exportToDXF(scaledModel);
      downloadFile(content, `GeoImage_${state.lod}_${Date.now()}.${format.toLowerCase()}`, "text/plain");
      setState(s => ({ ...s, notification: { message: `Modelo exportado en ${format}`, type: 'success' } }));
    } catch (e) {
      setState(s => ({ ...s, notification: { message: "Error al exportar.", type: 'error' } }));
    }
  };

  const renderUploadTab = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-200 text-center relative overflow-hidden">
        <div className="mx-auto w-24 h-24 bg-blue-600 text-white rounded-3xl flex items-center justify-center mb-8 shadow-2xl rotate-6 transform transition hover:rotate-0">
          <Upload size={44} />
        </div>
        <h3 className="text-3xl font-black mb-4 text-slate-900 tracking-tight">Carga de Referencias</h3>
        <p className="text-slate-500 mb-10 max-w-lg mx-auto leading-relaxed font-medium">
          Selecciona fotos o planos técnicos (plantas, alzados, secciones). La IA ignorará textos y anotaciones para centrarse en la geometría 3D.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <label className="group inline-flex items-center px-10 py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all cursor-pointer shadow-xl hover:-translate-y-1">
            <Plus size={24} className="mr-3 group-hover:rotate-90 transition-transform" />
            Añadir Imágenes
            <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
          </label>
          <button onClick={loadTestModel} className="flex items-center px-10 py-5 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all border border-slate-200">
            <Beaker size={24} className="mr-3" />
            Cargar Demo
          </button>
        </div>
      </div>
      {state.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {state.images.map((img, idx) => (
            <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-200 aspect-square bg-white shadow-sm transition-all hover:ring-8 ring-blue-500/10">
              <img src={img} className="w-full h-full object-cover" />
              <button onClick={() => setState(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {state.images.length > 0 && (
        <div className="flex justify-end pt-8">
          <button onClick={() => setActiveTab('detail')} className="group flex items-center px-10 py-5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-black shadow-xl shadow-blue-500/20">
            Siguiente Paso
            <ChevronRight size={24} className="ml-3 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );

  const renderDetailTab = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <section>
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
              <Layers size={32} className="mr-4 text-blue-600" />
              Nivel de detalle (LOD)
            </h3>
            <p className="text-slate-500 mt-2 font-medium">Define cuántas primitivas quieres que la IA utilice para simplificar el modelo.</p>
          </div>
          <button onClick={() => setState(prev => ({ ...prev, lodConfigs: { ...DEFAULT_LOD_CONFIGS } }))} className="flex items-center text-xs font-black text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-3 rounded-xl transition-colors border border-blue-100 uppercase tracking-widest">
            <RotateCcw size={16} className="mr-2" />
            Valores Originales
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { id: LOD.LOW, title: 'Bajo (Masas)', desc: 'Volúmenes puros para encaje urbano o masificación general.', icon: <Box size={28} /> },
            { id: LOD.MEDIUM, title: 'Medio (Standard)', desc: 'Nivel ideal para familias de Revit con geometría clara.', icon: <Layers size={28} /> },
            { id: LOD.HIGH, title: 'Alto (Detalle)', desc: 'Descomposición exhaustiva para elementos complejos.', icon: <BoxSelect size={28} /> },
          ].map((level) => (
            <div
              key={level.id}
              onClick={() => setState(s => ({ ...s, lod: level.id }))}
              className={`p-8 rounded-[2rem] border-2 transition-all cursor-pointer ${
                state.lod === level.id ? 'border-blue-600 bg-blue-50/50 shadow-2xl shadow-blue-500/10' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all ${state.lod === level.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}>
                {level.icon}
              </div>
              <h4 className="font-black text-xl mb-3 text-slate-800 tracking-tight">{level.title}</h4>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">{level.desc}</p>
              <div className="pt-6 border-t border-slate-200" onClick={e => e.stopPropagation()}>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3">Piezas Máximas</label>
                <input 
                  type="number"
                  value={state.lodConfigs[level.id].maxPrimitives}
                  onChange={(e) => setState(prev => ({ ...prev, lodConfigs: { ...prev.lodConfigs, [level.id]: { maxPrimitives: parseInt(e.target.value) || 1 } } }))}
                  className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-black text-lg focus:ring-4 ring-blue-500/10"
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="flex justify-between items-center pt-10 border-t border-slate-200">
        <button onClick={() => setActiveTab('upload')} className="px-10 py-5 text-slate-600 font-black hover:bg-slate-100 rounded-2xl transition-all uppercase tracking-widest text-xs">← Volver</button>
        <button onClick={processModel} className="flex items-center px-12 py-5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-600/20 font-black text-lg">
          <RefreshCw size={24} className={`mr-4 ${state.isProcessing ? 'animate-spin' : ''}`} />
          {state.isProcessing ? 'Procesando...' : 'Construir Modelo'}
        </button>
      </div>
    </div>
  );

  const renderViewerTab = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row gap-8">
        <div className="flex-1 h-[650px] relative">
          {state.isProcessing ? (
            <div className="absolute inset-0 z-30 bg-slate-950/95 flex flex-col items-center justify-center rounded-[2.5rem] border border-white/10">
              <div className="w-16 h-16 border-[6px] border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h4 className="text-2xl font-black text-white mb-2 tracking-tight uppercase tracking-[0.1em]">IA: Reconstruyendo Espacios</h4>
              <p className="text-slate-400 animate-pulse font-bold">Interpretando planos y filtrando anotaciones...</p>
            </div>
          ) : state.error ? (
            <div className="absolute inset-0 z-30 bg-red-50 flex flex-col items-center justify-center rounded-[2.5rem] border border-red-200 p-12 text-center">
              <AlertCircle size={64} className="text-red-500 mb-8" />
              <p className="text-red-900 font-black text-xl mb-10 max-w-md leading-relaxed">{state.error}</p>
              <button onClick={processModel} className="px-12 py-5 bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-red-600/20 uppercase tracking-widest text-xs">Reintentar Proceso</button>
            </div>
          ) : state.model ? (
            <Viewer3D 
              model={state.model} 
              globalScale={state.globalScale}
              unit={state.unit}
              onScaleChange={(newScale) => setState(s => ({ ...s, globalScale: newScale }))}
              onUnitChange={(newUnit) => setState(s => ({ ...s, unit: newUnit }))}
            />
          ) : (
            <div className="h-full w-full bg-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-400 border-4 border-dashed border-slate-200">
              <Box size={64} className="mb-6 opacity-20" />
              <p className="font-black text-xl uppercase tracking-widest opacity-40">Sin modelo activo</p>
            </div>
          )}
        </div>

        <div className="w-full xl:w-[400px] space-y-6">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h4 className="font-black text-2xl mb-2 text-slate-900 tracking-tight">Inspector BIM</h4>
            <p className="text-sm text-slate-500 mb-10 font-medium">Calibra y exporta tu geometría simplificada.</p>
            
            <div className="space-y-8">
               <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <Maximize size={24} />
                  </div>
                  <div>
                    <h5 className="font-black text-blue-900 uppercase tracking-widest text-[10px]">Factor de Escala</h5>
                    <p className="text-2xl font-black text-blue-600">{state.globalScale.toFixed(4)}</p>
                  </div>
                </div>
                <p className="text-[10px] text-blue-800 font-bold uppercase leading-relaxed opacity-70">
                  Usa la herramienta de medición en el visor para ajustar el tamaño real.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Cambiar Nivel de Detalle</label>
                <div className="grid grid-cols-3 gap-2 p-2 bg-slate-100 rounded-2xl">
                  {[LOD.LOW, LOD.MEDIUM, LOD.HIGH].map((l) => (
                    <button 
                      key={l}
                      onClick={() => setState(s => ({ ...s, lod: l }))}
                      disabled={state.isProcessing}
                      className={`py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${
                        state.lod === l ? 'bg-white shadow-xl text-blue-600' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 space-y-4">
                <button 
                  onClick={() => handleExport('OBJ')}
                  disabled={!state.model || state.isProcessing}
                  className="w-full flex items-center justify-center px-8 py-5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-30 transition-all font-black shadow-xl shadow-slate-900/10"
                >
                  <Download size={24} className="mr-3" /> Exportar .OBJ
                </button>
                <button 
                  onClick={() => handleExport('DXF')}
                  disabled={!state.model || state.isProcessing}
                  className="w-full flex items-center justify-center px-8 py-5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-30 transition-all font-black shadow-xl shadow-blue-600/20"
                >
                  <FileCode size={24} className="mr-3" /> Exportar .DXF
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <Box size={120} />
            </div>
            <h5 className="font-black text-lg mb-4 flex items-center tracking-tight">
              Flujo de Trabajo Revit
            </h5>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              Importa el .DXF en una nueva "Familia de Modelo Genérico" para tener una base paramétrica rápida basada en la realidad capturada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 bg-slate-50 selection:bg-blue-100">
      {state.notification && (
        <div className={`fixed top-24 right-6 z-[100] p-6 rounded-3xl shadow-2xl flex items-center max-w-md animate-in slide-in-from-right-full backdrop-blur-xl border border-white/20 ${
          state.notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          <CheckCircle2 className="mr-4 shrink-0" />
          <p className="text-xs font-black uppercase tracking-widest mr-8 leading-relaxed">{state.notification.message}</p>
          <button onClick={() => setState(s => ({ ...s, notification: null }))} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X size={18}/></button>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 h-24 flex items-center justify-between">
          <div className="flex items-center space-x-5">
            <div className="w-14 h-14 bg-blue-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-2xl rotate-3 transition-transform hover:rotate-0">
              <BoxSelect size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">GeoImage</h1>
              <div className="flex flex-col mt-1">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">BIM Model from image</p>
                <p className="text-[9px] text-blue-600 font-bold uppercase tracking-[0.1em]">by Javier Sánchez-Tembleque</p>
              </div>
            </div>
          </div>
          <nav className="hidden lg:flex items-center space-x-3 p-2 bg-slate-100 rounded-[1.5rem] border border-slate-200">
            {['upload', 'detail', 'viewer'].map((tab, idx) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-8 py-3.5 rounded-2xl text-[10px] font-black transition-all uppercase tracking-[0.2em] ${
                  activeTab === tab ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                {idx + 1}. {tab === 'upload' ? 'Imagen' : tab === 'detail' ? 'Nivel de detalle' : 'Modelo'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-14">
        {activeTab === 'upload' && renderUploadTab()}
        {activeTab === 'detail' && renderDetailTab()}
        {activeTab === 'viewer' && renderViewerTab()}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 py-6 z-40">
        <div className="max-w-7xl mx-auto px-8 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
          <span>© 2025 Architecture Primitive Studio - GeoImage</span>
          <span className="flex items-center gap-4">
            Built for Architects with <img src="https://www.gstatic.com/lamda/images/gemini_wordmark_color_768edc6197d02251144a.svg" className="h-4 grayscale hover:grayscale-0 transition-all" />
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
