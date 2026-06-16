import React, { useState, useRef } from 'react';
import { useLayoutStore } from '../store/useLayoutStore';

const CanvasNode = ({ id }) => {
  const node = useLayoutStore((state) => state.nodes[id]);
  const selectedId = useLayoutStore((state) => state.selectedId);
  const selectNode = useLayoutStore((state) => state.selectNode);
  const updateNodeProps = useLayoutStore((state) => state.updateNodeProps);
  const snapToGrid = useLayoutStore((state) => state.snapToGrid);
  const gridSize = useLayoutStore((state) => state.gridSize);

  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  if (!node) return null;

  const isSelected = selectedId === id;
  const isRoot = id === 'root';

  const handlePointerDown = (e) => {
    e.stopPropagation();
    selectNode(id);

    if (!isRoot) {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        nodeX: node.props.x,
        nodeY: node.props.y
      };
      
      // Capture pointer events on the window to track outside the element
      const handlePointerMove = (moveEvent) => {
        const dx = moveEvent.clientX - dragStart.current.x;
        const dy = moveEvent.clientY - dragStart.current.y;
        
        let newX = dragStart.current.nodeX + dx;
        let newY = dragStart.current.nodeY + dy;

        if (snapToGrid) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        } else {
          newX = Math.round(newX);
          newY = Math.round(newY);
        }

        updateNodeProps(id, { x: newX, y: newY });
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
    backgroundColor: node.props.backgroundColor || (node.type === 'panel' ? '#334155' : 'transparent'),
    color: node.props.color || '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: isSelected ? '2px solid #3b82f6' : '1px solid transparent',
    cursor: isRoot ? 'default' : (isDragging ? 'grabbing' : 'grab'),
    userSelect: 'none'
  };

  return (
    <div 
      style={baseStyle}
      onPointerDown={handlePointerDown}
    >
      {node.type === 'text' && <span>{node.props.text || 'Text Node'}</span>}
      {node.children.map(childId => (
        <CanvasNode key={childId} id={childId} />
      ))}
    </div>
  );
};

export const Canvas = () => {
  return (
    <div className="w-full h-full flex items-center justify-center overflow-auto p-8">
      {/* Container to center the fixed size root canvas */}
      <div className="shadow-2xl ring-1 ring-slate-700">
        <CanvasNode id="root" />
      </div>
    </div>
  );
};
