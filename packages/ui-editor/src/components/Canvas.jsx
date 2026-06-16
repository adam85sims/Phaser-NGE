import React, { useState, useRef, useCallback } from 'react';
import { useLayoutStore } from '../store/useLayoutStore';
import { useZoomPan } from '../hooks/useZoomPan';
import { useFontLoader } from '../hooks/useFontLoader';

const HANDLE_SIZE = 8;
const MIN_SIZE = 10;

// Resolve asset:// URIs to browser-loadable URLs via the /api/assets endpoint
const resolveAssetSrc = (src) => {
  if (!src) return '';
  if (src.startsWith('asset://')) {
    return '/api/assets/' + src.slice(8);
  }
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
    return src;
  }
  return '/api/assets/' + src;
};

// Edge positions for resize handles
const EDGE_HANDLES = [
  { id: 'nw', cursor: 'nw-resize', x: 0, y: 0 },
  { id: 'n',  cursor: 'n-resize',  x: 0.5, y: 0 },
  { id: 'ne', cursor: 'ne-resize', x: 1, y: 0 },
  { id: 'w',  cursor: 'w-resize',  x: 0, y: 0.5 },
  { id: 'e',  cursor: 'e-resize',  x: 1, y: 0.5 },
  { id: 'sw', cursor: 'sw-resize', x: 0, y: 1 },
  { id: 's',  cursor: 's-resize',  x: 0.5, y: 1 },
  { id: 'se', cursor: 'se-resize', x: 1, y: 1 },
];

const ResizeHandles = ({ id, node }) => {
  const updateNodeProps = useLayoutStore(s => s.updateNodeProps);
  const snapToGrid = useLayoutStore(s => s.snapToGrid);
  const gridSize = useLayoutStore(s => s.gridSize);
  const dragRef = useRef(null);

  const snap = useCallback((v) => snapToGrid ? Math.round(v / gridSize) * gridSize : Math.round(v), [snapToGrid, gridSize]);

  const onHandleDown = useCallback((e, handleId) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      handleId,
      startX: e.clientX,
      startY: e.clientY,
      props: { ...node.props },
    };

    const move = (me) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = me.clientX - d.startX;
      const dy = me.clientY - d.startY;
      const p = d.props;
      let nx = p.x, ny = p.y, nw = p.width, nh = p.height;

      switch (d.handleId) {
        case 'nw': nx = snap(p.x + dx); ny = snap(p.y + dy); nw = p.x + p.width - nx; nh = p.y + p.height - ny; break;
        case 'n':  ny = snap(p.y + dy); nw = p.width; nh = p.y + p.height - ny; break;
        case 'ne': ny = snap(p.y + dy); nw = snap(p.x + p.width + dx) - p.x; nh = p.y + p.height - ny; break;
        case 'w':  nx = snap(p.x + dx); nw = p.x + p.width - nx; nh = p.height; break;
        case 'e':  nw = snap(p.x + p.width + dx) - p.x; break;
        case 'sw': nx = snap(p.x + dx); nw = p.x + p.width - nx; nh = snap(p.y + p.height + dy) - p.y; break;
        case 's':  nh = snap(p.y + p.height + dy) - p.y; break;
        case 'se': nw = snap(p.x + p.width + dx) - p.x; nh = snap(p.y + p.height + dy) - p.y; break;
      }

      // Clamp minimum size; re-anchor opposite corner
      if (nw < MIN_SIZE) { nw = MIN_SIZE; if (d.handleId !== 'e' && d.handleId !== 'se' && d.handleId !== 's') nx = p.x + p.width - MIN_SIZE; }
      if (nh < MIN_SIZE) { nh = MIN_SIZE; if (d.handleId !== 's' && d.handleId !== 'se' && d.handleId !== 'e') ny = p.y + p.height - MIN_SIZE; }

      updateNodeProps(id, { x: nx, y: ny, width: nw, height: nh });
    };

    const up = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [id, node.props, snap, updateNodeProps]);

  return (
    <>
      {EDGE_HANDLES.map(h => (
        <div
          key={h.id}
          onPointerDown={(e) => onHandleDown(e, h.id)}
          style={{
            position: 'absolute',
            left: h.x * node.props.width - HANDLE_SIZE / 2,
            top: h.y * node.props.height - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            cursor: h.cursor,
            backgroundColor: '#3b82f6',
            border: '1px solid white',
            borderRadius: 1,
            zIndex: 9999,
            boxSizing: 'border-box',
          }}
        />
      ))}
    </>
  );
};

const CanvasNode = ({ id }) => {
  const node = useLayoutStore((state) => state.nodes[id]);
  const selectedIds = useLayoutStore((state) => state.selectedIds);
  const selectNode = useLayoutStore((state) => state.selectNode);
  const updateNodeProps = useLayoutStore((state) => state.updateNodeProps);
  const snapToGrid = useLayoutStore((state) => state.snapToGrid);
  const gridSize = useLayoutStore((state) => state.gridSize);

  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0, multiStartProps: {} });

  if (!node) return null;

  const isSelected = selectedIds.includes(id);
  const isRoot = id === 'root';

  const handlePointerDown = (e) => {
    e.stopPropagation();
    selectNode(id, e.ctrlKey || e.metaKey);

    if (!isRoot) {
      setIsDragging(true);
      const nodes = useLayoutStore.getState().nodes;
      // Snapshot start positions for group drag
      const multiStartProps = {};
      if (e.ctrlKey || e.metaKey || selectedIds.length > 1) {
        // We're in multi-select mode; snapshot all selected nodes' positions
        const targetIds = selectedIds.includes(id) ? selectedIds : [id];
        targetIds.forEach(sid => {
          if (nodes[sid] && sid !== 'root') {
            multiStartProps[sid] = { x: nodes[sid].props.x, y: nodes[sid].props.y };
          }
        });
      }
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        nodeX: node.props.x,
        nodeY: node.props.y,
        multiStartProps
      };
      
      // Capture pointer events on the window to track outside the element
      const handlePointerMove = (moveEvent) => {
        const ds = dragStart.current;
        const dx = moveEvent.clientX - ds.x;
        const dy = moveEvent.clientY - ds.y;
        
        // Helper: apply snap
        const snapV = (v) => snapToGrid ? Math.round(v / gridSize) * gridSize : Math.round(v);

        if (Object.keys(ds.multiStartProps).length > 0) {
          // Group drag: move all snapshotted nodes
          for (const [sid, startPos] of Object.entries(ds.multiStartProps)) {
            updateNodeProps(sid, {
              x: snapV(startPos.x + dx),
              y: snapV(startPos.y + dy)
            });
          }
        } else {
          // Single drag
          updateNodeProps(id, {
            x: snapV(ds.nodeX + dx),
            y: snapV(ds.nodeY + dy)
          });
        }
      };
      
      const handlePointerUp = () => {
        setIsDragging(false);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
  };

  const baseStyle = isRoot ? {
    width: node.props.width,
    height: node.props.height,
    position: 'relative',
    backgroundColor: '#1e293b', // slate-800
    backgroundImage: snapToGrid ? `linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)` : 'none',
    backgroundSize: `${gridSize}px ${gridSize}px`,
    overflow: 'hidden'
  } : {
    position: 'absolute',
    left: node.props.x,
    top: node.props.y,
    width: node.props.width,
    height: node.props.height,
    backgroundColor: node.props.backgroundColor || (
      node.type === 'button' ? '#3b82f6' :
      node.type === 'panel' ? '#334155' :
      node.type === 'image' ? '#1e293b' : 'transparent'
    ),
    border: isSelected ? '2px solid #3b82f6' : (
      node.type === 'image' && !node.props.src ? '1px dashed #475569' : '1px solid transparent'
    ),
    color: node.props.color || (
      node.type === 'button' ? '#ffffff' : '#f8fafc'
    ),
    display: 'flex',
    alignItems: 'center',
    justifyContent: node.type === 'button' ? 'center' : 'center',
    cursor: isRoot ? 'default' : (isDragging ? 'grabbing' : 'grab'),
    userSelect: 'none',
    overflow: 'hidden',
    borderRadius: node.props.borderRadius || (node.type === 'button' ? 6 : 0),
    fontFamily: node.type === 'text' ? (node.props.fontFamily || 'monospace') : undefined,
    fontSize: node.type === 'text' ? (node.props.fontSize || 28) : undefined,
    textAlign: node.type === 'text' ? (node.props.textAlign || 'left') : undefined,
    lineHeight: node.type === 'text' ? (node.props.lineHeight || 1.4) : undefined,
    backgroundImage: node.type === 'image' && node.props.src 
      ? `url(${resolveAssetSrc(node.props.src)})` 
      : undefined,
    backgroundSize: node.type === 'image' && node.props.src ? (node.props.objectFit === 'cover' ? 'cover' : node.props.objectFit === 'fill' ? '100% 100%' : 'contain') : undefined,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <div 
      style={baseStyle}
      onPointerDown={handlePointerDown}
    >
      {node.type === 'text' && <span>{node.props.text || 'Text Node'}</span>}
      {node.type === 'button' && (
        <span className="text-sm font-medium">{node.props.label || 'Button'}</span>
      )}
      {node.type === 'image' && (
        node.props.src
          ? <img src={resolveAssetSrc(node.props.src)} alt="" style={{ width: '100%', height: '100%', objectFit: node.props.objectFit || 'contain' }} />
          : <span className="text-xs text-slate-500 opacity-50">Image</span>
      )}
      {node.children.map(childId => (
        <CanvasNode key={childId} id={childId} />
      ))}
      {isSelected && !isRoot && <ResizeHandles id={id} node={node} />}
    </div>
  );
};

export const Canvas = () => {
  useFontLoader();
  const {
    zoom,
    zoomIn,
    zoomOut,
    resetView,
    handleWheel,
    handleMouseDown,
    containerStyle,
  } = useZoomPan();

  return (
    <div
      className="w-full h-full flex items-center justify-center overflow-hidden p-8"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      style={{ cursor: 'grab' }}
    >
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 z-20 bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-1">
        <button onClick={zoomOut} className="p-1 hover:bg-slate-700 rounded text-slate-400 text-xs" title="Zoom Out">−</button>
        <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} className="p-1 hover:bg-slate-700 rounded text-slate-400 text-xs" title="Zoom In">+</button>
        <button onClick={resetView} className="p-1 hover:bg-slate-700 rounded text-slate-400 text-xs ml-1" title="Reset View (Ctrl+0)">↺</button>
      </div>
      {/* Container to center the fixed size root canvas */}
      <div style={containerStyle} className="shadow-2xl ring-1 ring-slate-700">
        <CanvasNode id="root" />
      </div>
    </div>
  );
};
