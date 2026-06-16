import React, { useState } from 'react';
import { useLayoutStore } from '../store/useLayoutStore';
import { ChevronRight, ChevronDown, Type, Square, Layout, Image as ImageIcon, MousePointerClick, Plus, Trash2, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown } from 'lucide-react';

const NodeTreeItem = ({ id, level = 0 }) => {
  const node = useLayoutStore(state => state.nodes[id]);
  const selectedIds = useLayoutStore(state => state.selectedIds);
  const selectNode = useLayoutStore(state => state.selectNode);
  const removeNode = useLayoutStore(state => state.removeNode);
  const reparentNode = useLayoutStore(state => state.reparentNode);

  const [isDragOver, setIsDragOver] = useState(false);

  if (!node) return null;

  const isSelected = selectedIds.includes(id);
  const hasChildren = node.children.length > 0;

  const Icon = 
    node.type === 'canvas' ? Layout : 
    node.type === 'text' ? Type : 
    node.type === 'image' ? ImageIcon : 
    node.type === 'button' ? MousePointerClick : 
    Square;

  const handleDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== id) {
      reparentNode(draggedId, id);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={isDragOver ? 'outline outline-1 outline-blue-500 -outline-offset-1' : ''}
    >
      <div 
        className={`flex items-center px-2 py-1 cursor-pointer hover:bg-slate-700 ${isSelected ? 'bg-blue-600 hover:bg-blue-600' : ''}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={(e) => selectNode(id, e.ctrlKey || e.metaKey)}
        draggable={id !== 'root'}
        onDragStart={handleDragStart}
      >
        <span className="w-4 h-4 mr-1 flex items-center justify-center">
          {hasChildren ? <ChevronDown size={14} /> : null}
        </span>
        <Icon size={14} className="mr-2 opacity-70" />
        <span className="text-sm truncate flex-1">{node.name}</span>
        
        {id !== 'root' && isSelected && (
          <div className="flex items-center gap-0.5">
            <button onClick={(e) => { e.stopPropagation(); useLayoutStore.getState().moveUp(id); }} className="p-0.5 hover:bg-slate-600 rounded" title="Send Backward">
              <ArrowUp size={12} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); useLayoutStore.getState().moveDown(id); }} className="p-0.5 hover:bg-slate-600 rounded" title="Bring Forward">
              <ArrowDown size={12} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); useLayoutStore.getState().sendToBack(id); }} className="p-0.5 hover:bg-slate-600 rounded" title="Send to Back">
              <ChevronsUp size={12} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); useLayoutStore.getState().bringToFront(id); }} className="p-0.5 hover:bg-slate-600 rounded" title="Bring to Front">
              <ChevronsDown size={12} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); removeNode(id); }} className="p-0.5 hover:bg-red-500 rounded" title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      {node.children.toReversed().map(childId => (  // Reverse so top of list = renders on top
        <NodeTreeItem key={childId} id={childId} level={level + 1} />
      ))}
    </div>
  );
};

export const HierarchyPanel = () => {
  const addNode = useLayoutStore(state => state.addNode);
  const selectedIds = useLayoutStore(state => state.selectedIds);

  const handleAdd = (type) => {
    // Add to selected node if it's a container, otherwise add to root
    const parentId = (selectedIds.length === 1 && selectedIds[0] !== 'root') ? selectedIds[0] : 'root'; 
    addNode(parentId, type);
  };

  return (
    <div className="flex flex-col h-full text-slate-300">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Elements</span>
        <div className="flex space-x-1">
          <button onClick={() => handleAdd('panel')} className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-xs flex items-center" title="Add Panel">
            <Plus size={12} className="mr-1"/> Panel
          </button>
          <button onClick={() => handleAdd('text')} className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-xs flex items-center" title="Add Text">
            <Plus size={12} className="mr-1"/> Text
          </button>
          <button onClick={() => handleAdd('image')} className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-xs flex items-center" title="Add Image">
            <Plus size={12} className="mr-1"/> Image
          </button>
          <button onClick={() => handleAdd('button')} className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-xs flex items-center" title="Add Button">
            <Plus size={12} className="mr-1"/> Btn
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto -mx-4">
        <NodeTreeItem id="root" />
      </div>
    </div>
  );
};
