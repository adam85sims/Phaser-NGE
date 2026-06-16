import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export const useLayoutStore = create((set, get) => ({
  // The layout tree is a flat map of nodes, with root elements at the top level
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
  selectedId: null,
  snapToGrid: true,
  gridSize: 20,

  toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  setGridSize: (size) => set({ gridSize: size }),

  // Actions
  selectNode: (id) => set({ selectedId: id }),
  
  addNode: (parentId, type, initialProps = {}) => {
    const id = uuidv4();
    const newNode = {
      id,
      type,
      name: `New ${type}`,
      props: { x: 0, y: 0, width: 200, height: 100, ...initialProps },
      children: [],
      role: 'none'
    };

    set((state) => {
      const newNodes = { ...state.nodes, [id]: newNode };
      if (parentId && newNodes[parentId]) {
        newNodes[parentId] = {
          ...newNodes[parentId],
          children: [...newNodes[parentId].children, id]
        };
      }
      return { nodes: newNodes, selectedId: id };
    });
  },

  updateNode: (id, updates) => {
    set((state) => {
      if (!state.nodes[id]) return state;
      return {
        nodes: {
          ...state.nodes,
          [id]: { ...state.nodes[id], ...updates }
        }
      };
    });
  },

  updateNodeProps: (id, propUpdates) => {
    set((state) => {
      if (!state.nodes[id]) return state;
      return {
        nodes: {
          ...state.nodes,
          [id]: { 
            ...state.nodes[id], 
            props: { ...state.nodes[id].props, ...propUpdates } 
          }
        }
      };
    });
  },

  removeNode: (id) => {
    if (id === 'root') return; // Can't delete root
    set((state) => {
      const newNodes = { ...state.nodes };
      
      // Recursive delete helper
      const deleteRecursive = (nodeId) => {
        const node = newNodes[nodeId];
        if (node && node.children) {
          node.children.forEach(deleteRecursive);
        }
        delete newNodes[nodeId];
      };
      
      // Remove from parent's children array
      for (const key in newNodes) {
        if (newNodes[key].children && newNodes[key].children.includes(id)) {
          newNodes[key] = {
            ...newNodes[key],
            children: newNodes[key].children.filter(childId => childId !== id)
          };
          break;
        }
      }
      
      deleteRecursive(id);
      
      return { 
        nodes: newNodes, 
        selectedId: state.selectedId === id ? null : state.selectedId 
      };
    });
  }
}));
