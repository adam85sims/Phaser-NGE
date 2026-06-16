import React, { useState, useEffect, useCallback } from 'react';
import { useLayoutStore } from '../store/useLayoutStore';

const resolveAssetSrc = (src) => {
  if (!src) return '';
  if (src.startsWith('asset://')) return '/api/assets/' + src.slice(8);
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) return src;
  return '/api/assets/' + src;
};

const AssetPanel = ({ onClose }) => {
  const [currentDir, setCurrentDir] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSvg, setShowSvg] = useState(false);
  const selectedId = useLayoutStore(s => s.selectedIds[0]);
  const selectedNode = useLayoutStore(s => selectedId ? s.nodes[selectedId] : null);
  const updateNodeProps = useLayoutStore(s => s.updateNodeProps);

  const fetchDir = useCallback(async (subdir) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${subdir}`);
      if (!res.ok) throw new Error(`Failed to load: ${res.statusText}`);
      const data = await res.json();
      setItems(data.items || []);
      setCurrentDir(subdir);
    } catch (e) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDir('');
  }, [fetchDir]);

  const handleSelect = useCallback((item) => {
    if (item.directory) {
      fetchDir(item.path);
    } else if (item.type === 'image' && selectedNode?.type === 'image') {
      updateNodeProps(selectedId, { src: `asset://${item.path}` });
    }
  }, [fetchDir, selectedId, selectedNode, updateNodeProps]);

  const handleGoUp = useCallback(() => {
    const parts = currentDir.split('/').filter(Boolean);
    parts.pop();
    fetchDir(parts.join('/'));
  }, [currentDir, fetchDir]);

  return (
    <div className="h-full flex flex-col text-slate-300 text-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assets</span>
        <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 mb-2 text-slate-500">
        <button onClick={() => fetchDir('')} className="hover:text-white">assets</button>
        {currentDir && currentDir.split('/').filter(Boolean).map((part, i, arr) => (
          <React.Fragment key={i}>
            <span>/</span>
            <button onClick={() => fetchDir(arr.slice(0, i + 1).join('/'))} className="hover:text-white">{part}</button>
          </React.Fragment>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <label className="flex items-center gap-1 cursor-pointer text-slate-600 hover:text-slate-400" title="Show SVG files (may need conversion for Unity/Unreal)">
            <input type="checkbox" checked={showSvg} onChange={() => setShowSvg(!showSvg)} className="rounded border-slate-700 bg-slate-800 w-3 h-3" />
            <span className="text-[10px]">SVG</span>
          </label>
        </div>
      </div>

      {/* Up button */}
      {currentDir && (
        <button onClick={handleGoUp} className="flex items-center gap-1 px-2 py-1 hover:bg-slate-700 rounded mb-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12l7-7 7 7"/></svg>
          ..
        </button>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto -mx-4 px-4">
        {loading && <p className="text-slate-600">Loading...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-slate-600">No assets found</p>
        )}
        {items.filter(i => {
          if (i.directory) return true;
          if (i.type !== 'image') return false;
          // Filter SVGs unless the toggle is on
          if (i.ext === '.svg' && !showSvg) return false;
          return true;
        }).map(item => (
          <button
            key={item.path}
            onClick={() => handleSelect(item)}
            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 rounded cursor-pointer text-left"
            title={item.path}
          >
            {item.directory ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 shrink-0"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            )}
            <span className="truncate">{item.name}</span>
            {item.directory && (
              <span className="ml-auto text-slate-600 text-[10px]">{item.children}</span>
            )}
          </button>
        ))}
      </div>

      {/* Preview */}
      {selectedNode?.type === 'image' && selectedNode.props.src && (
        <div className="border-t border-slate-700 pt-2 mt-2">
          <div className="text-[10px] text-slate-500 mb-1">Current Image</div>
          <div className="bg-slate-900 rounded overflow-hidden h-20 flex items-center justify-center">
            <img src={resolveAssetSrc(selectedNode.props.src)} alt="" className="max-h-full max-w-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <div className="text-[10px] text-slate-600 mt-1 truncate">{selectedNode.props.src}</div>
        </div>
      )}
    </div>
  );
};

export default AssetPanel;
