import React from 'react';
import { useLayoutStore } from '../store/useLayoutStore';
import { ChevronRight, ChevronDown, Type, Square, Layout, Plus, Trash2 } from 'lucide-react';

const NodeTreeItem = ({ id, level = 0 }) => {
  const node = useLayoutStore(state => state.nodes[id]);
  const selectedId = useLayoutStore(state => state.selectedId);
  const selectNode = useLayoutStore(state => state.selectNode);
  const removeNode = useLayoutStore(state => state.removeNode);

  if (!node) return null;

  const isSelected = selectedId === id;
  const hasChildren = node.children.length > 0;

  const Icon = node.type === 'canvas' ? Layout : node.type === 'text' ? Type : Square;

  return (
    <div>
      <div 
        className={`flex items-center px-2 py-1 cursor-pointer hover:bg-slate-700 ${isSelected ? 'bg-blue-600 hover:bg-blue-600' : ''}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => selectNode(id)}
      >
        <span className="w-4 h-4 mr-1 flex items-center justify-center">
          {hasChildren ? <ChevronDown size={14} /> : null}
        </span>
        <Icon size={14} className="mr-2 opacity-70" />
        <span className="text-sm truncate flex-1">{node.name}</span>
        
        {id !== 'root' && isSelected && (
          <button onClick={(e) => { e.stopPropagation(); removeNode(id); }} className="p-1 hover:bg-red-500 rounded">
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {node.children.map(childId => (
        <NodeTreeItem key={childId} id={childId} level={level + 1} />
      ))}
    </div>
  );
};

export const HierarchyPanel = () => {
  const addNode = useLayoutStore(state => state.addNode);
  const selectedId = useLayoutStore(state => state.selectedId);

  const handleAdd = (type) => {
    // Add to selected node if it's a container, otherwise add to root
    const parentId = (selectedId && selectedId !== 'root') ? 'root' : 'root'; 
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
        </div>
      </div>
      <div className="flex-1 overflow-y-auto -mx-4">
        <NodeTreeItem id="root" />
      </div>
    </div>
  );
};
