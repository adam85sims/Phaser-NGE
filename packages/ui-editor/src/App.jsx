import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HierarchyPanel } from './components/HierarchyPanel';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import AssetPanel from './components/AssetPanel';
import { useLayoutStore } from './store/useLayoutStore';
import { savedProjects } from './utils/projects';
import { useKeyboard } from './hooks/useKeyboard';
import { TEMPLATES } from './utils/templates';

function App() {
  const snapToGrid = useLayoutStore(state => state.snapToGrid);
  const toggleSnap = useLayoutStore(state => state.toggleSnap);
  const gridSize = useLayoutStore(state => state.gridSize);
  const setGridSize = useLayoutStore(state => state.setGridSize);
  const selectedIds = useLayoutStore(state => state.selectedIds);
  
  // Undo/redo from temporal middleware
  const temporalStore = useLayoutStore.temporal;
  const undo = useCallback(() => temporalStore.getState().undo(), [temporalStore]);
  const redo = useCallback(() => temporalStore.getState().redo(), [temporalStore]);
  // Reactive temporal state via manual subscription
  const [canUndo, setCanUndo] = useState(() => temporalStore.getState().pastStates.length > 0);
  const [canRedo, setCanRedo] = useState(() => temporalStore.getState().futureStates.length > 0);
  useEffect(() => {
    const unsub = temporalStore.subscribe(() => {
      const s = temporalStore.getState();
      setCanUndo(s.pastStates.length > 0);
      setCanRedo(s.futureStates.length > 0);
    });
    return unsub;
  }, [temporalStore]);

  // Keyboard shortcuts
  useKeyboard();

  // Sidebar tab state
  const [sidebarTab, setSidebarTab] = useState('elements');

  // Project state
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [projectName, setProjectName] = useState('My Project');
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  // Canvas resolution
  const rootNode = useLayoutStore(s => s.nodes['root']);
  const canvasWidth = rootNode?.props?.width || 1280;
  const canvasHeight = rootNode?.props?.height || 720;
  const updateNodeProps = useLayoutStore(s => s.updateNodeProps);

  const RESOLUTION_PRESETS = {
    '1280x720': { label: 'HD (1280×720)', w: 1280, h: 720 },
    '1920x1080': { label: 'FHD (1920×1080)', w: 1920, h: 1080 },
    '2560x1440': { label: 'QHD (2560×1440)', w: 2560, h: 1440 },
    '3840x2160': { label: '4K (3840×2160)', w: 3840, h: 2160 },
  };

  const currentResKey = `${canvasWidth}x${canvasHeight}`;
  const handleResolutionChange = (e) => {
    const preset = RESOLUTION_PRESETS[e.target.value];
    if (preset) {
      updateNodeProps('root', { width: preset.w, height: preset.h });
    }
  };

  // Close project menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowProjectMenu(false);
      }
    };
    if (showProjectMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProjectMenu]);

  // Auto-save debounce
  const autoSaveTimer = useRef(null);
  const storeNodes = useLayoutStore(s => s.nodes);
  useEffect(() => {
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      savedProjects.autoSave(useLayoutStore.getState());
    }, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [storeNodes]);

  const handleSave = useCallback(() => {
    const state = useLayoutStore.getState();
    savedProjects.save(projectName, state);
    setShowSaveDialog(false);
    setShowProjectMenu(false);
  }, [projectName]);

  const handleLoad = useCallback((id) => {
    const project = savedProjects.load(id);
    if (!project) return;
    useLayoutStore.setState({
      nodes: project.data.nodes,
      gridSize: project.data.gridSize,
      snapToGrid: project.data.snapToGrid,
      selectedIds: []
    });
    useLayoutStore.temporal.getState().clear();
    setShowLoadDialog(false);
    setShowProjectMenu(false);
  }, []);

  const handleNew = useCallback(() => {
    if (confirm('Create a new project? Unsaved changes will be lost.')) {
      useLayoutStore.setState({
        nodes: {
          'root': {
            id: 'root',
            type: 'canvas',
            name: 'Main Canvas',
            props: { width: 1280, height: 720 },
            children: [],
            role: 'canvas'
          }
        },
        selectedIds: [],
        snapToGrid: true,
        gridSize: 20
      });
      useLayoutStore.temporal.getState().clear();
      savedProjects.clearAutoSave();
      setShowProjectMenu(false);
    }
  }, []);

  const handleNewFromTemplate = useCallback((templateKey) => {
    const template = TEMPLATES[templateKey];
    if (!template) return;
    const data = template.buildNodes();
    useLayoutStore.setState({
      nodes: data.nodes,
      gridSize: data.gridSize,
      snapToGrid: data.snapToGrid,
      selectedIds: []
    });
    useLayoutStore.temporal.getState().clear();
    setShowProjectMenu(false);
    setProjectName(template.name);
  }, []);

  const restoreState = useCallback((data, name) => {
    useLayoutStore.setState({
      nodes: data.nodes,
      gridSize: data.gridSize,
      snapToGrid: data.snapToGrid ?? true,
      selectedIds: []
    });
    useLayoutStore.temporal.getState().clear();
    setProjectName(name || 'My Project');
  }, []);

  const handleSaveToFile = useCallback(() => {
    const state = useLayoutStore.getState();
    const blob = {
      layouteerVersion: '1.0',
      name: projectName,
      savedAt: new Date().toISOString(),
      data: {
        nodes: state.nodes,
        gridSize: state.gridSize,
        snapToGrid: state.snapToGrid,
      },
    };
    const json = JSON.stringify(blob, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.layouteer`;
    a.click();
    URL.revokeObjectURL(url);
    setShowProjectMenu(false);
  }, [projectName]);

  const handleOpenFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (!parsed.data?.nodes) {
          alert('Invalid .layouteer file');
          return;
        }
        restoreState(parsed.data, parsed.name);
      } catch (err) {
        alert('Failed to read file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-opened
    setShowProjectMenu(false);
  }, [restoreState]);

  const savedList = savedProjects.list();

  return (
    <div className="h-screen w-screen flex bg-slate-900 text-white overflow-hidden font-sans">
      {/* Hidden file input for opening .layouteer files */}
      <input ref={fileInputRef} type="file" accept=".layouteer,application/json" onChange={handleOpenFile} className="hidden" />

      {/* Sidebar / Hierarchy */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col z-10">
        <div className="border-b border-slate-700">
          <div className="flex">
            <button onClick={() => setSidebarTab('elements')} className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${sidebarTab === 'elements' ? 'text-white border-b-2 border-blue-500 bg-slate-750' : 'text-slate-500 hover:text-slate-300'}`}>
              Elements
            </button>
            <button onClick={() => setSidebarTab('assets')} className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${sidebarTab === 'assets' ? 'text-white border-b-2 border-blue-500 bg-slate-750' : 'text-slate-500 hover:text-slate-300'}`}>
              Assets
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {sidebarTab === 'elements' ? <HierarchyPanel /> : <AssetPanel onClose={() => setSidebarTab('elements')} />}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
        {/* Top toolbar */}
        <div className="h-12 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between">
          <div className="flex items-center gap-3">
            {/* Project Menu */}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowProjectMenu(!showProjectMenu)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium flex items-center gap-1 text-slate-300">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Project
              </button>
              {showProjectMenu && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 py-1">
                  <button onClick={() => { setProjectName('My Project'); setShowSaveDialog(true); setShowProjectMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save to Browser</button>
                  <button onClick={handleSaveToFile} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Save to File...</button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Open File...</button>
                  <hr className="border-slate-700 my-1" />
                  <button onClick={() => { setShowLoadDialog(true); setShowProjectMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Load from Browser</button>
                  <hr className="border-slate-700 my-1" />
                  <button onClick={handleNew} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 flex items-center gap-2 text-red-400"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> New Project</button>
                  <div className="border-t border-slate-700 mt-1 pt-1">
                    <div className="px-3 py-1 text-[10px] text-slate-600 uppercase tracking-wider">Templates</div>
                    {Object.entries(TEMPLATES).map(([key, tpl]) => (
                      <button key={key} onClick={() => handleNewFromTemplate(key)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 flex items-center gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                        {tpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select value={currentResKey} onChange={handleResolutionChange} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-400 outline-none cursor-pointer hover:border-slate-600">
                {Object.entries(RESOLUTION_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>{preset.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-xs text-slate-400">
             {/* Undo / Redo */}
             <div className="flex items-center gap-1">
               <button onClick={undo} disabled={!canUndo} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
               </button>
               <button onClick={redo} disabled={!canRedo} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" title="Redo (Ctrl+Shift+Z)">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
               </button>
             </div>
             {/* Alignment toolbar (visible when 2+ selected) */}
             {(() => {
               const alignE = (mode) => useLayoutStore.getState().alignElements(mode);
               const distribE = (dir) => useLayoutStore.getState().distributeElements(dir);
               const nonRootCount = selectedIds.filter(i => i !== 'root').length;
               if (nonRootCount < 2) return null;
               return (
                 <div className="flex items-center gap-0.5 px-2 border-l border-slate-700">
                   <button onClick={() => alignE('left')} className="p-1 hover:bg-slate-700 rounded text-slate-400" title="Align Left"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="15" y2="6"/><line x1="3" y1="12" x2="19" y2="12"/><line x1="3" y1="18" x2="11" y2="18"/></svg></button>
                   <button onClick={() => alignE('center')} className="p-1 hover:bg-slate-700 rounded text-slate-400" title="Align Center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="6" x2="19" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="6" y1="18" x2="18" y2="18"/></svg></button>
                   <button onClick={() => alignE('right')} className="p-1 hover:bg-slate-700 rounded text-slate-400" title="Align Right"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="21" y2="6"/><line x1="5" y1="12" x2="21" y2="12"/><line x1="13" y1="18" x2="21" y2="18"/></svg></button>
                   <span className="w-px h-4 bg-slate-700 mx-0.5" />
                   <button onClick={() => alignE('top')} className="p-1 hover:bg-slate-700 rounded text-slate-400" title="Align Top"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15"/><line x1="12" y1="3" x2="12" y2="19"/><line x1="18" y1="3" x2="18" y2="11"/></svg></button>
                   <button onClick={() => alignE('middle')} className="p-1 hover:bg-slate-700 rounded text-slate-400" title="Align Middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="5" x2="6" y2="19"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="18" y1="6" x2="18" y2="18"/></svg></button>
                   <button onClick={() => alignE('bottom')} className="p-1 hover:bg-slate-700 rounded text-slate-400" title="Align Bottom"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="9" x2="6" y2="21"/><line x1="12" y1="5" x2="12" y2="21"/><line x1="18" y1="13" x2="18" y2="21"/></svg></button>
                   <span className="w-px h-4 bg-slate-700 mx-0.5" />
                   <button onClick={() => distribE('horizontal')} className="p-1 hover:bg-slate-700 rounded text-slate-400" title="Distribute Horizontally"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="4" height="16" rx="1"/><rect x="10" y="7" width="4" height="10" rx="1"/><rect x="18" y="2" width="4" height="20" rx="1"/></svg></button>
                   <button onClick={() => distribE('vertical')} className="p-1 hover:bg-slate-700 rounded text-slate-400" title="Distribute Vertically"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="4" rx="1"/><rect x="7" y="10" width="10" height="4" rx="1"/><rect x="2" y="18" width="20" height="4" rx="1"/></svg></button>
                 </div>
               );
             })()}
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

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Save Project</h3>
            <label className="block text-xs text-slate-400 mb-1">Project Name</label>
            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm mb-4 outline-none focus:border-blue-500"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveDialog(false)} className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded">Cancel</button>
              <button onClick={handleSave} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Load Dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowLoadDialog(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Load Project</h3>
            {savedList.length === 0 ? (
              <p className="text-xs text-slate-500 mb-4">No saved projects.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto mb-4 space-y-1">
                {savedList.map(p => (
                  <button key={p.id} onClick={() => handleLoad(p.id)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-700 text-sm flex items-center justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-slate-500">{new Date(p.savedAt).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setShowLoadDialog(false)} className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
