import React, { useState, useRef, useEffect } from 'react';
import { useLayoutStore } from '../store/useLayoutStore';
import { exportLayoutToJSON } from '../utils/exporter';
import { exportToNGE } from '../utils/adapters/nge';
import { exportToGodot } from '../utils/adapters/godot';
import { exportToUnity } from '../utils/adapters/unity';
import { exportToUnreal } from '../utils/adapters/unreal';
import ColorPicker from './ColorPicker';

const ANCHOR_POSITIONS = [
  ['top-left', 'top-center', 'top-right'],
  ['center-left', 'center', 'center-right'],
  ['bottom-left', 'bottom-center', 'bottom-right']
];

const ANCHOR_LABELS = {
  'top-left': 'Top Left',
  'top-center': 'Top Center',
  'top-right': 'Top Right',
  'center-left': 'Center Left',
  'center': 'Center',
  'center-right': 'Center Right',
  'bottom-left': 'Bottom Left',
  'bottom-center': 'Bottom Center',
  'bottom-right': 'Bottom Right'
};

const AnchorSelector = ({ value, onChange }) => {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">Anchor</label>
      <div className="flex items-center gap-3">
        <div className="grid grid-cols-3 gap-1 p-1.5 bg-slate-900 rounded border border-slate-700">
          {ANCHOR_POSITIONS.flat().map(pos => (
            <button
              key={pos}
              onClick={() => onChange(pos)}
              className={`w-5 h-5 rounded-sm transition-colors ${
                value === pos
                  ? 'bg-blue-500 ring-2 ring-blue-400'
                  : 'bg-slate-600 hover:bg-slate-500'
              }`}
              title={ANCHOR_LABELS[pos]}
            />
          ))}
        </div>
        <span className="text-xs text-slate-400">{ANCHOR_LABELS[value] || 'Top Left'}</span>
      </div>
    </div>
  );
};

export const PropertiesPanel = () => {
  const selectedIds = useLayoutStore(state => state.selectedIds);
  const node = useLayoutStore(state => 
    selectedIds.length === 1 ? state.nodes[selectedIds[0]] : null
  );
  const updateNode = useLayoutStore(state => state.updateNode);
  const updateNodeProps = useLayoutStore(state => state.updateNodeProps);
  const storeState = useLayoutStore(state => state);

  // Export format state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const handleExport = (format) => {
    let json, filename, blob;
    if (format === 'nge') {
      const exportJson = JSON.parse(exportLayoutToJSON(storeState.nodes));
      json = exportToNGE(exportJson);
      filename = 'nge_theme.json';
    } else if (format === 'godot') {
      const exportJson = JSON.parse(exportLayoutToJSON(storeState.nodes));
      json = exportToGodot(exportJson);
      filename = 'layouteer_ui.tscn';
    } else if (format === 'unity') {
      const exportJson = JSON.parse(exportLayoutToJSON(storeState.nodes));
      json = exportToUnity(exportJson);
      filename = 'LayouteerUIBuilder.cs';
    } else if (format === 'unreal') {
      const exportJson = JSON.parse(exportLayoutToJSON(storeState.nodes));
      json = exportToUnreal(exportJson);
      filename = 'create_layouteer_ui.py';
    } else {
      json = exportLayoutToJSON(storeState.nodes);
      filename = 'layout_export.json';
    }
    blob = new Blob([json], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handlePreview = (format) => {
    let json, title;
    if (format === 'nge') {
      const exportJson = JSON.parse(exportLayoutToJSON(storeState.nodes));
      json = exportToNGE(exportJson);
      title = 'NGE Theme Preview';
    } else if (format === 'godot') {
      const exportJson = JSON.parse(exportLayoutToJSON(storeState.nodes));
      json = exportToGodot(exportJson);
      title = 'Godot 4 Scene Preview';
    } else if (format === 'unity') {
      const exportJson = JSON.parse(exportLayoutToJSON(storeState.nodes));
      json = exportToUnity(exportJson);
      title = 'Unity C# Script Preview';
    } else if (format === 'unreal') {
      const exportJson = JSON.parse(exportLayoutToJSON(storeState.nodes));
      json = exportToUnreal(exportJson);
      title = 'Unreal Python Script Preview';
    } else {
      json = exportLayoutToJSON(storeState.nodes);
      title = 'Universal JSON Preview';
    }
    setPreviewContent(json);
    setPreviewTitle(title);
    setShowExportPreview(true);
    setShowExportMenu(false);
  };

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
        {selectedIds.length > 1 ? (
          <p>{selectedIds.length} elements selected</p>
        ) : (
          <p>No element selected</p>
        )}
        <div className="relative mt-8" ref={exportMenuRef}>
          <button onClick={() => setShowExportMenu(!showExportMenu)} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500">
            Export ▾
          </button>
          {showExportMenu && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-52 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 py-1">
              <div className="px-3 py-1 text-[10px] text-slate-600 uppercase tracking-wider">Download</div>
              <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Universal JSON</button>
              <button onClick={() => handleExport('nge')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">NGE (Phaser 4) Theme</button>
              <button onClick={() => handleExport('godot')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Godot 4 (.tscn)</button>
              <button onClick={() => handleExport('unity')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Unity (C# Script)</button>
              <button onClick={() => handleExport('unreal')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Unreal (Python)</button>
              <hr className="border-slate-700 my-1" />
              <div className="px-3 py-1 text-[10px] text-slate-600 uppercase tracking-wider">Preview</div>
              <button onClick={() => handlePreview('json')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Universal JSON</button>
              <button onClick={() => handlePreview('nge')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">NGE Theme</button>
              <button onClick={() => handlePreview('godot')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Godot Scene</button>
              <button onClick={() => handlePreview('unity')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Unity Script</button>
              <button onClick={() => handlePreview('unreal')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Unreal Script</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isRoot = node.id === 'root';

  const handleChange = (e, field, isProp = true) => {
    let val = e.target.value;
    if (e.target.type === 'number') {
      val = parseInt(val, 10);
      if (isNaN(val)) val = 0;
    }

    const targetId = selectedIds[0];
    if (!targetId) return;

    if (isProp) {
      updateNodeProps(targetId, { [field]: val });
    } else {
      updateNode(targetId, { [field]: val });
    }
  };

  return (
    <>
    <div className="text-sm text-slate-300">
      <div className="mb-6 flex justify-between items-center">
        <h3 className="font-semibold text-white">Properties</h3>
        <div className="relative" ref={exportMenuRef}>
          <button onClick={() => setShowExportMenu(!showExportMenu)} className="px-3 py-1 bg-indigo-600 text-xs text-white rounded hover:bg-indigo-500 flex items-center gap-1">
            Export ▾
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 py-1">
              <div className="px-3 py-1 text-[10px] text-slate-600 uppercase tracking-wider">Download</div>
              <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Universal JSON</button>
              <button onClick={() => handleExport('nge')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">NGE (Phaser 4) Theme</button>
              <button onClick={() => handleExport('godot')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Godot 4 (.tscn)</button>
              <button onClick={() => handleExport('unity')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Unity (C# Script)</button>
              <button onClick={() => handleExport('unreal')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Unreal (Python)</button>
              <hr className="border-slate-700 my-1" />
              <div className="px-3 py-1 text-[10px] text-slate-600 uppercase tracking-wider">Preview</div>
              <button onClick={() => handlePreview('json')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Universal JSON</button>
              <button onClick={() => handlePreview('nge')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">NGE Theme</button>
              <button onClick={() => handlePreview('godot')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Godot Scene</button>
              <button onClick={() => handlePreview('unity')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Unity Script</button>
              <button onClick={() => handlePreview('unreal')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700">Unreal Script</button>
            </div>
          )}
        </div>
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

        {/* Anchor */}
        {!isRoot && (
          <AnchorSelector 
            value={node.anchor || 'top-left'} 
            onChange={(anchor) => updateNode(selectedIds[0], { anchor })}
          />
        )}

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
            <div className="mt-2">
              <ColorPicker
                label="Text Color"
                value={node.props.color || '#f8fafc'}
                onChange={(v) => handleChange({ target: { value: v, type: 'text' } }, 'color')}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Font Size</label>
                <input type="number" value={node.props.fontSize || 28} onChange={(e) => handleChange(e, 'fontSize')}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Font Family</label>
                <input type="text" value={node.props.fontFamily || 'monospace'} onChange={(e) => handleChange(e, 'fontFamily')}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
        )}

        {node.type === 'panel' && (
          <ColorPicker
            label="Background Color"
            value={node.props.backgroundColor || '#334155'}
            onChange={(v) => handleChange({ target: { value: v, type: 'text' } }, 'backgroundColor')}
          />
        )}

        {node.type === 'image' && (
          <>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Image Source (URL or path)</label>
              <input 
                type="text" 
                value={node.props.src || ''} 
                onChange={(e) => handleChange(e, 'src')}
                placeholder="asset://characters/hero.png"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Object Fit</label>
              <select 
                value={node.props.objectFit || 'contain'} 
                onChange={(e) => handleChange(e, 'objectFit')}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="fill">Fill</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Opacity</label>
              <input 
                type="number" 
                min="0" max="1" step="0.05"
                value={node.props.opacity ?? 1} 
                onChange={(e) => handleChange(e, 'opacity')}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              />
            </div>
          </>
        )}

        {node.type === 'button' && (
          <>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Button Label</label>
              <input 
                type="text" 
                value={node.props.label || ''} 
                onChange={(e) => handleChange(e, 'label')}
                placeholder="Click Me"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <ColorPicker
              label="Background Color"
              value={node.props.backgroundColor || '#3b82f6'}
              onChange={(v) => handleChange({ target: { value: v, type: 'text' } }, 'backgroundColor')}
            />
            <ColorPicker
              label="Text Color"
              value={node.props.color || '#ffffff'}
              onChange={(v) => handleChange({ target: { value: v, type: 'text' } }, 'color')}
            />
            <div>
              <label className="block text-xs text-slate-500 mb-1">Border Radius</label>
              <input 
                type="number" 
                value={node.props.borderRadius ?? 6} 
                onChange={(e) => handleChange(e, 'borderRadius')}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              />
            </div>
          </>
        )}
      </div>
    </div>

    {/* Export Preview Modal */}
    {showExportPreview && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowExportPreview(false)}>
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold">{previewTitle}</h3>
            <button onClick={() => setShowExportPreview(false)} className="p-1 hover:bg-slate-700 rounded text-slate-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">{previewContent}</pre>
        </div>
      </div>
    )}
    </>
  );
};
