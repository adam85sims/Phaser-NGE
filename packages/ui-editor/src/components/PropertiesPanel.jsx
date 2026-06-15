import React from 'react';
import { useLayoutStore } from '../store/useLayoutStore';
import { exportLayoutToJSON } from '../utils/exporter';

export const PropertiesPanel = () => {
  const selectedId = useLayoutStore(state => state.selectedId);
  const node = useLayoutStore(state => selectedId ? state.nodes[selectedId] : null);
  const updateNode = useLayoutStore(state => state.updateNode);
  const updateNodeProps = useLayoutStore(state => state.updateNodeProps);
  const storeState = useLayoutStore(state => state);

  const handleExport = () => {
    const json = exportLayoutToJSON(storeState.nodes);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layout_export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
        <p>No element selected</p>
        <button onClick={handleExport} className="mt-8 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500">
          Export JSON
        </button>
      </div>
    );
  }

  const handleChange = (e, field, isProp = true) => {
    let val = e.target.value;
    if (e.target.type === 'number') {
      val = parseInt(val, 10);
      if (isNaN(val)) val = 0;
    }

    if (isProp) {
      updateNodeProps(selectedId, { [field]: val });
    } else {
      updateNode(selectedId, { [field]: val });
    }
  };

  return (
    <div className="text-sm text-slate-300">
      <div className="mb-6 flex justify-between items-center">
        <h3 className="font-semibold text-white">Properties</h3>
        <button onClick={handleExport} className="px-3 py-1 bg-indigo-600 text-xs text-white rounded hover:bg-indigo-500">
          Export
        </button>
      </div>

      <div className="space-y-4">
        {/* Identity */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Name</label>
          <input 
            type="text" 
            value={node.name} 
            onChange={(e) => handleChange(e, 'name', false)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Role (Engine Tag)</label>
          <select 
            value={node.role} 
            onChange={(e) => handleChange(e, 'role', false)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          >
            <option value="none">None</option>
            <option value="dialogue_text">Dialogue Text</option>
            <option value="speaker_name">Speaker Name</option>
            <option value="dialogue_box">Dialogue Box</option>
            <option value="choice_container">Choice Container</option>
            <option value="portrait_left">Portrait Left</option>
            <option value="portrait_right">Portrait Right</option>
          </select>
        </div>

        <hr className="border-slate-700" />

        {/* Geometry */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">X</label>
            <input 
              type="number" 
              value={node.props.x ?? 0} 
              disabled={node.id === 'root'}
              onChange={(e) => handleChange(e, 'x')}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Y</label>
            <input 
              type="number" 
              value={node.props.y ?? 0} 
              disabled={node.id === 'root'}
              onChange={(e) => handleChange(e, 'y')}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Width</label>
            <input 
              type="number" 
              value={node.props.width} 
              onChange={(e) => handleChange(e, 'width')}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Height</label>
            <input 
              type="number" 
              value={node.props.height} 
              onChange={(e) => handleChange(e, 'height')}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <hr className="border-slate-700" />

        {/* Content & Styling */}
        {node.type === 'text' && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Text Content</label>
            <textarea 
              value={node.props.text || ''} 
              onChange={(e) => handleChange(e, 'text')}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500 min-h-[80px]"
            />
          </div>
        )}

        {node.type === 'panel' && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Background Color</label>
            <input 
              type="text" 
              value={node.props.backgroundColor || ''} 
              onChange={(e) => handleChange(e, 'backgroundColor')}
              placeholder="e.g. #334155, rgba(0,0,0,0.5)"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};
