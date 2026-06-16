import { create } from 'zustand';
import { temporal } from 'zundo';
import { v4 as uuidv4 } from 'uuid';

export const useLayoutStore = create(
  temporal(
    (set, get) => ({
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
      gridSize: 20,

      toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
      setGridSize: (size) => set({ gridSize: size }),

      // Actions
      selectNode: (id, multi = false) => set((state) => ({
        selectedIds: multi
          ? (state.selectedIds.includes(id)
             ? state.selectedIds.filter(sid => sid !== id)
             : [...state.selectedIds, id])
          : [id]
      })),
      clearSelection: () => set({ selectedIds: [] }),
      selectAll: () => set((state) => ({
        selectedIds: Object.keys(state.nodes).filter(id => id !== 'root')
      })),

      addNode: (parentId, type, initialProps = {}) => {
        const id = uuidv4();
        const newNode = {
          id,
          type,
          name: `New ${type}`,
          props: { x: 0, y: 0, width: 200, height: 100, ...initialProps },
          children: [],
          role: 'none',
          anchor: 'top-left'
        };

        set((state) => {
          const newNodes = { ...state.nodes, [id]: newNode };
          if (parentId && newNodes[parentId]) {
            newNodes[parentId] = {
              ...newNodes[parentId],
              children: [...newNodes[parentId].children, id]
            };
          }
          return { nodes: newNodes, selectedIds: [id] };
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
        if (id === 'root') return;
        set((state) => {
          const newNodes = { ...state.nodes };

          const deleteRecursive = (nodeId) => {
            const node = newNodes[nodeId];
            if (node && node.children) {
              node.children.forEach(deleteRecursive);
            }
            delete newNodes[nodeId];
          };

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
            selectedIds: state.selectedIds.filter(sid => sid !== id && newNodes[sid])
          };
        });
      },

      _findParent: (id, nodes) => {
        for (const key in nodes) {
          if (nodes[key].children && nodes[key].children.includes(id)) {
            return key;
          }
        }
        return null;
      },

      moveUp: (id) => {
        set((state) => {
          const parentId = get()._findParent(id, state.nodes);
          if (!parentId) return state;
          const parent = state.nodes[parentId];
          const idx = parent.children.indexOf(id);
          if (idx <= 0) return state;
          const newChildren = [...parent.children];
          [newChildren[idx - 1], newChildren[idx]] = [newChildren[idx], newChildren[idx - 1]];
          return {
            nodes: {
              ...state.nodes,
              [parentId]: { ...parent, children: newChildren }
            }
          };
        });
      },

      moveDown: (id) => {
        set((state) => {
          const parentId = get()._findParent(id, state.nodes);
          if (!parentId) return state;
          const parent = state.nodes[parentId];
          const idx = parent.children.indexOf(id);
          if (idx < 0 || idx >= parent.children.length - 1) return state;
          const newChildren = [...parent.children];
          [newChildren[idx], newChildren[idx + 1]] = [newChildren[idx + 1], newChildren[idx]];
          return {
            nodes: {
              ...state.nodes,
              [parentId]: { ...parent, children: newChildren }
            }
          };
        });
      },

      bringToFront: (id) => {
        set((state) => {
          const parentId = get()._findParent(id, state.nodes);
          if (!parentId) return state;
          const parent = state.nodes[parentId];
          const newChildren = parent.children.filter(cid => cid !== id);
          newChildren.push(id);
          return {
            nodes: {
              ...state.nodes,
              [parentId]: { ...parent, children: newChildren }
            }
          };
        });
      },

      sendToBack: (id) => {
        set((state) => {
          const parentId = get()._findParent(id, state.nodes);
          if (!parentId) return state;
          const parent = state.nodes[parentId];
          const newChildren = parent.children.filter(cid => cid !== id);
          newChildren.unshift(id);
          return {
            nodes: {
              ...state.nodes,
              [parentId]: { ...parent, children: newChildren }
            }
          };
        });
      },

      // --- Alignment actions ---
      getSelectionBounds: (ids) => {
        const nodes = get().nodes;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        ids.forEach(sid => {
          const n = nodes[sid];
          if (!n || sid === 'root') return;
          minX = Math.min(minX, n.props.x);
          minY = Math.min(minY, n.props.y);
          maxX = Math.max(maxX, n.props.x + n.props.width);
          maxY = Math.max(maxY, n.props.y + n.props.height);
        });
        return { minX, minY, maxX, maxY };
      },

      alignElements: (mode) => {
        set((state) => {
          const ids = state.selectedIds.filter(id => id !== 'root');
          if (ids.length < 2) return state;
          const bounds = get().getSelectionBounds(ids);
          const updates = {};
          ids.forEach(sid => {
            const n = state.nodes[sid];
            if (!n || sid === 'root') return;
            let nx = n.props.x, ny = n.props.y;
            switch (mode) {
              case 'left':   nx = bounds.minX; break;
              case 'center': nx = bounds.minX + (bounds.maxX - bounds.minX) / 2 - n.props.width / 2; break;
              case 'right':  nx = bounds.maxX - n.props.width; break;
              case 'top':    ny = bounds.minY; break;
              case 'middle': ny = bounds.minY + (bounds.maxY - bounds.minY) / 2 - n.props.height / 2; break;
              case 'bottom': ny = bounds.maxY - n.props.height; break;
            }
            if (state.snapToGrid) {
              nx = Math.round(nx / state.gridSize) * state.gridSize;
              ny = Math.round(ny / state.gridSize) * state.gridSize;
            }
            updates[sid] = { x: Math.round(nx), y: Math.round(ny) };
          });
          const newNodes = { ...state.nodes };
          Object.entries(updates).forEach(([sid, pos]) => {
            newNodes[sid] = { ...newNodes[sid], props: { ...newNodes[sid].props, ...pos } };
          });
          return { nodes: newNodes };
        });
      },

      distributeElements: (direction) => {
        set((state) => {
          const ids = state.selectedIds.filter(id => id !== 'root');
          if (ids.length < 3) return state;
          const bounds = get().getSelectionBounds(ids);
          const nodes = state.nodes;

          // Sort elements by their position in the distribute direction
          const sorted = [...ids].sort((a, b) => {
            const pa = nodes[a].props, pb = nodes[b].props;
            return direction === 'horizontal' ? pa.x - pb.x : pa.y - pb.y;
          });

          const totalSize = sorted.reduce((sum, sid) => {
            const n = nodes[sid];
            return sum + (direction === 'horizontal' ? n.props.width : n.props.height);
          }, 0);

          const start = direction === 'horizontal' ? bounds.minX : bounds.minY;
          const end = direction === 'horizontal' ? bounds.maxX : bounds.maxY;
          const gap = (end - start - totalSize) / (ids.length - 1);

          let pos = start;
          const updates = {};
          sorted.forEach(sid => {
            const n = nodes[sid];
            const dim = direction === 'horizontal' ? 'x' : 'y';
            const size = direction === 'horizontal' ? n.props.width : n.props.height;
            updates[sid] = { [dim]: Math.round(state.snapToGrid ? Math.round(pos / state.gridSize) * state.gridSize : pos) };
            pos += size + gap;
          });

          const newNodes = { ...state.nodes };
          Object.entries(updates).forEach(([sid, posUpdate]) => {
            newNodes[sid] = { ...newNodes[sid], props: { ...newNodes[sid].props, ...posUpdate } };
          });
          return { nodes: newNodes };
        });
      },

      // --- Drag & Drop reparenting ---
      reparentNode: (nodeId, newParentId) => {
        set((state) => {
          if (nodeId === 'root' || nodeId === newParentId) return state;
          const node = state.nodes[nodeId];
          if (!node) return state;

          // Don't reparent to a descendant
          const isDescendant = (parentId, targetId) => {
            const parent = state.nodes[parentId];
            if (!parent) return false;
            for (const cid of parent.children) {
              if (cid === targetId) return true;
              if (isDescendant(cid, targetId)) return true;
            }
            return false;
          };
          if (isDescendant(nodeId, newParentId)) return state;

          const newNodes = { ...state.nodes };

          // Remove from old parent
          for (const key in newNodes) {
            const parent = newNodes[key];
            if (parent.children && parent.children.includes(nodeId)) {
              newNodes[key] = {
                ...parent,
                children: parent.children.filter(cid => cid !== nodeId)
              };
              break;
            }
          }

          // Add to new parent
          if (newNodes[newParentId]) {
            newNodes[newParentId] = {
              ...newNodes[newParentId],
              children: [...newNodes[newParentId].children, nodeId]
            };
          }

          return { nodes: newNodes };
        });
      },

      // --- Duplicate node (deep clone with children) ---
      duplicateNode: (id) => {
        if (id === 'root') return;
        set((state) => {
          const idMap = {};
          const newNodes = { ...state.nodes };

          // Recursively clone: return new node with new children
          const clone = (nodeId) => {
            const original = state.nodes[nodeId];
            if (!original) return null;
            const newId = uuidv4();
            idMap[nodeId] = newId;
            const newNode = {
              ...original,
              id: newId,
              name: original.name + ' (copy)',
              children: [],
              props: { ...original.props, x: (original.props.x || 0) + 20, y: (original.props.y || 0) + 20 },
            };
            // Clone children recursively
            for (const childId of original.children) {
              const clonedChild = clone(childId);
              if (clonedChild) {
                newNode.children.push(clonedChild.id);
              }
            }
            newNodes[newId] = newNode;
            return newNode;
          };

          const cloned = clone(id);
          if (!cloned) return state;

          // Find the original's parent and add the clone to its children
          for (const key in newNodes) {
            if (newNodes[key].children && newNodes[key].children.includes(id)) {
              newNodes[key] = {
                ...newNodes[key],
                children: [...newNodes[key].children, cloned.id],
              };
              break;
            }
          }

          return { nodes: newNodes, selectedIds: [cloned.id] };
        });
      },
    }),
    { limit: 50 }
  )
);
