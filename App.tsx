
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
  Ruler,
  CheckCircle2,
  X,
  Info,
  RefreshCw,
  Plus,
  RotateCcw,
  FileCode,
  Beaker,
  MousePointer2
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
    globalScale: 1, // Por defecto, escala 1:1 de lo que devuelva la IA
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
    if (files.length === 0) return;

    const newImages: string[] = [];
    let processedCount = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          newImages.push(event.target.result as string);
        }
        processedCount++;
        if (processedCount === files.length) {
          setState(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
        }
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
    setState(prev => ({ 
      ...prev, 
      model: testModel, 
      globalScale: 1,
      notification: { message: "Modelo de diagnóstico cargado.", type: 'info' } 
    }));
    setActiveTab('viewer');
  };

  const removeImage = (index: number) => {
    setState(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const processModel = async () => {
    if (state.images.length === 0) {
      setState(s => ({ ...s, error: "Por favor sube al menos una imagen." }));
      return;
    }
    
    setState(prev => ({ ...prev, isProcessing: true, error: null, globalScale: 1 }));
    setActiveTab('viewer');
    
    try {
      // Usamos un valor de referencia genérico (100) para que la IA devuelva algo proporcional,
      // luego el usuario calibrará en la pestaña 3.
      const model = await generate3DPrimitives(
        state.images, 
        state.lod, 
        state.lodConfigs[state.lod],
        100, 
        state.unit
      );
      setState(prev => ({ ...prev, model, isProcessing: false }));
    } catch (err) {
      console.error("Processing Error:", err);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: err instanceof Error ? err.message : "Error procesando imágenes." 
      }));
    }
  };

  const handleExport = (format: 'OBJ' | 'DXF') => {
    if (!state.model) return;
    try {
      // Creamos una copia del modelo escalado para exportar
      const scaledModel: ModelData = {
        ...state.model,
        primitives: state.model.primitives.map(p => ({
          ...p,
          position: [p.position[0] * state.globalScale, p.position[1] * state.globalScale, p.position[2] * state.globalScale],
          scale: [p.scale[0] * state.globalScale, p.scale[1] * state.globalScale, p.scale[2] * state.globalScale]
        }))
      };

      let content = "";
      let filename = `GeoSimplified_${state.lod}_${Date.now()}`;
      
      if (format === 'OBJ') {
        content = exportToOBJ(scaledModel);
        filename += ".obj";
      } else {
        content = exportToDXF(scaledModel);
        filename += ".dxf";
      }
      
      downloadFile(content, filename, "text/plain");
      setState(s => ({ ...s, notification: { message: `Exportado ${format} con éxito!`, type: 'success' } }));
    } catch (e) {
      setState(s => ({ ...s, notification: { message: "Error al exportar.", type: 'error' } }));
    }
  };

  const renderUploadTab = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center relative overflow-hidden">
        <div className="mx-auto w-20 h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl rotate-3 transform transition hover:rotate-0">
          <Upload size={40} />
        </div>
        <h3 className="text-2xl font-bold mb-3 text-slate-800 tracking-tight">Referencias Visuales</h3>
        <p className="text-slate-500 mb-8 max-w-lg mx-auto leading-relaxed">
          Sube imágenes del objeto. El motor reconstruirá la geometría básica basándose en estas capturas.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <label className="group inline-flex items-center px-8 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5">
            <Plus size={24} className="mr-3 group-hover:rotate-90 transition-transform" />
            Añadir Imágenes
            <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
          </label>
          <button onClick={loadTestModel} className="flex items-center px-8 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all border border-slate-200">
            <Beaker size={24} className="mr-3" />
            Cargar Demo
          </button>
        </div>
      </div>

      {state.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {state.images.map((img, idx) => (
            <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-white shadow-sm transition-all hover:ring-4 ring-blue-500/20">
              <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
              <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {state.images.length > 0 && (
        <div className="flex justify-end pt-4">
          <button onClick={() => setActiveTab('detail')} className="group flex items-center px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg">
            Configurar Detalle
            <ChevronRight size={24} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );

  const renderDetailTab = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <section>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-extrabold text-slate-900 flex items-center tracking-tight">
            <Layers size={24} className="mr-3 text-blue-600" />
            Complejidad del Modelo (LOD)
          </h3>
          <button onClick={restoreDefaultLods} className="flex items-center text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded-lg transition-colors border border-blue-100">
            <RotateCcw size={14} className="mr-2" />
            Restaurar Valores
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { id: LOD.LOW, title: 'Bajo (Masas)', desc: 'Volúmenes muy simples.', icon: <Box size={24} /> },
            { id: LOD.MEDIUM, title: 'Medio (Standard)', desc: 'Equilibrio perfecto.', icon: <Layers size={24} /> },
            { id: LOD.HIGH, title: 'Alto (Detallado)', desc: 'Ensamblajes precisos.', icon: <BoxSelect size={24} /> },
          ].map((level) => (
            <div
              key={level.id}
              onClick={() => setState(s => ({ ...s, lod: level.id }))}
              className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                state.lod === level.id ? 'border-blue-600 bg-blue-50/50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`p-4 rounded-xl inline-block mb-4 ${state.lod === level.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}>
                {level.icon}
              </div>
              <h4 className="font-bold text-lg mb-2 text-slate-800">{level.title}</h4>
              <p className="text-sm text-slate-500 mb-6">{level.desc}</p>
              
              <div className="pt-4 border-t border-slate-200/50" onClick={(e) => e.stopPropagation()}>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Máx. Primitivas</label>
                <input 
                  type="number"
                  value={state.lodConfigs[level.id].maxPrimitives}
                  onChange={(e) => setState(prev => ({
                    ...prev,
                    lodConfigs: { ...prev.lodConfigs, [level.id]: { maxPrimitives: parseInt(e.target.value) || 1 } }
                  }))}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg outline-none font-bold"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-xl font-extrabold text-slate-900 mb-6 flex items-center">
          <Settings size={24} className="mr-3 text-blue-600" /> Preferencias Generales
        </h3>
        <div className="w-48">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Sistema de Unidades</label>
          <select 
            value={state.unit}
            onChange={(e) => setState(prev => ({ ...prev, unit: e.target.value as Unit }))}
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none font-bold"
          >
            <option value={Unit.CM}>Centímetros (cm)</option>
            <option value={Unit.M}>Metros (m)</option>
          </select>
        </div>
      </section>

      <div className="flex justify-between items-center pt-8 border-t border-slate-200">
        <button onClick={() => setActiveTab('upload')} className="px-8 py-4 text-slate-600 font-bold hover:bg-slate-100 rounded-xl">Atrás</button>
        <button onClick={processModel} className="flex items-center px-10 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-xl font-black">
          <RefreshCw size={24} className={`mr-3 ${state.isProcessing ? 'animate-spin' : ''}`} /> Generar Geometría
        </button>
      </div>
    </div>
  );

  const renderViewerTab = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-h-[600px] relative">
          {state.isProcessing ? (
            <div className="absolute inset-0 z-30 bg-slate-950/90 flex flex-col items-center justify-center rounded-2xl">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <h4 className="text-xl font-bold text-white mb-2">Construyendo Modelo 3D...</h4>
            </div>
          ) : state.error ? (
            <div className="absolute inset-0 z-30 bg-red-50 flex flex-col items-center justify-center rounded-2xl border border-red-200 p-8 text-center">
              <AlertCircle size={48} className="text-red-500 mb-6" />
              <p className="text-red-700 font-bold mb-8">{state.error}</p>
              <button onClick={processModel} className="px-10 py-4 bg-red-600 text-white rounded-xl font-bold">Reintentar</button>
            </div>
          ) : state.model ? (
            <Viewer3D 
              model={state.model} 
              globalScale={state.globalScale}
              unit={state.unit}
              onScaleChange={(newScale) => setState(s => ({ ...s, globalScale: newScale }))}
            />
          ) : (
            <div className="h-[600px] bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 border-2 border-dashed">
              <p className="font-bold">Genera un modelo para previsualizar.</p>
            </div>
          )}
        </div>

        <div className="w-full lg:w-96 space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <div className="mb-8">
               <h4 className="font-black text-lg mb-2 flex items-center text-slate-800 tracking-tight">
                <MousePointer2 size={20} className="mr-3 text-blue-600" /> Inspector & Calibración
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Haz clic en cualquier pieza del visor para ver sus dimensiones y ajustar la escala real del modelo completo.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Complejidad Activa</label>
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-xl">
                  {[LOD.LOW, LOD.MEDIUM, LOD.HIGH].map((l) => (
                    <button 
                      key={l}
                      onClick={() => setState(s => ({ ...s, lod: l }))}
                      disabled={state.isProcessing}
                      className={`py-2 text-[10px] font-black rounded-lg transition-all ${
                        state.lod === l ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 space-y-3">
                <button 
                  onClick={() => handleExport('OBJ')}
                  disabled={!state.model || state.isProcessing}
                  className="w-full flex items-center justify-center px-6 py-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-30 transition-all font-black"
                >
                  <Download size={20} className="mr-3" /> Exportar .OBJ
                </button>
                <button 
                  onClick={() => handleExport('DXF')}
                  disabled={!state.model || state.isProcessing}
                  className="w-full flex items-center justify-center px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-30 transition-all font-black"
                >
                  <FileCode size={20} className="mr-3" /> Exportar .DXF
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-600 p-8 rounded-2xl text-white shadow-xl">
            <h5 className="font-bold text-sm mb-2">Tip de Modelado BIM:</h5>
            <p className="text-xs text-blue-100 leading-relaxed">
              Mide el elemento más representativo (ej. la altura total) para obtener una escala precisa para Revit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  function restoreDefaultLods() {
    setState(prev => ({ ...prev, lodConfigs: { ...DEFAULT_LOD_CONFIGS } }));
  }

  return (
    <div className="min-h-screen pb-24 bg-slate-50">
      {state.notification && (
        <div className={`fixed top-24 right-6 z-[100] p-5 rounded-2xl shadow-2xl flex items-center max-w-md animate-in slide-in-from-right-full ${
          state.notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          <Info className="mr-4 shrink-0" />
          <p className="text-xs font-bold uppercase tracking-tight mr-6">{state.notification.message}</p>
          <button onClick={() => setState(s => ({ ...s, notification: null }))}><X size={18}/></button>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
              <BoxSelect size={28} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-900">GeoSimplifier <span className="text-blue-600">3D</span></h1>
          </div>
          <nav className="hidden md:flex items-center space-x-2 p-1.5 bg-slate-100 rounded-2xl">
            {['upload', 'detail', 'viewer'].map((tab, idx) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all uppercase ${
                  activeTab === tab ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {idx + 1}. {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'upload' && renderUploadTab()}
        {activeTab === 'detail' && renderDetailTab()}
        {activeTab === 'viewer' && renderViewerTab()}
      </main>
    </div>
  );
};

export default App;
