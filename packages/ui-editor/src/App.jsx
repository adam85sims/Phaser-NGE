import React from 'react';
import { HierarchyPanel } from './components/HierarchyPanel';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { useLayoutStore } from './store/useLayoutStore';

function App() {
  const snapToGrid = useLayoutStore(state => state.snapToGrid);
  const toggleSnap = useLayoutStore(state => state.toggleSnap);
  const gridSize = useLayoutStore(state => state.gridSize);
  const setGridSize = useLayoutStore(state => state.setGridSize);

  return (
    <div className="h-screen w-screen flex bg-slate-900 text-white overflow-hidden font-sans">
      {/* Sidebar / Hierarchy */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col z-10">
        <div className="p-4 border-b border-slate-700 font-bold text-slate-200 shadow-sm flex items-center justify-between">
          <span>UI Editor</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <HierarchyPanel />
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
        {/* Top toolbar */}
        <div className="h-12 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between">
          <span className="text-xs text-slate-500">1280x720 Canvas Resolution</span>
          <div className="flex items-center space-x-4 text-xs text-slate-400">
             <label className="flex items-center space-x-1 cursor-pointer">
               <input type="checkbox" checked={snapToGrid} onChange={toggleSnap} className="rounded border-slate-700 bg-slate-800" />
               <span>Snap to Grid</span>
             </label>
             {snapToGrid && (
               <select value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 outline-none">
                 <option value={10}>10px</option>
                 <option value={20}>20px</option>
                 <option value={40}>40px</option>
                 <option value={50}>50px</option>
                 <option value={100}>100px</option>
               </select>
             )}
          </div>
        </div>
        <Canvas />
      </div>

      {/* Properties Panel */}
      <div className="w-80 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto z-10 shadow-lg">
        <PropertiesPanel />
      </div>
    </div>
  );
}

export default App;
