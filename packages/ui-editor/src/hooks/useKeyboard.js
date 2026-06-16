import { useEffect } from 'react';
import { useLayoutStore } from '../store/useLayoutStore';
import { savedProjects } from '../utils/projects';

export const useKeyboard = () => {
  useEffect(() => {
    const handler = (e) => {
      const state = useLayoutStore.getState();
      const target = e.target;

      // Don't intercept when user is typing in an input/textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useLayoutStore.temporal.getState().undo();
      } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        useLayoutStore.temporal.getState().redo();
      } else if (ctrl && e.key === 's') {
        e.preventDefault();
        savedProjects.autoSave(state);
      } else if (ctrl && e.key === 'd') {
        e.preventDefault();
        // Duplicate: deep clone selected nodes (including children)
        const ids = state.selectedIds;
        // Clone in reverse order so clones appear in original visual order
        [...ids].filter(id => id !== 'root').reverse().forEach(id => {
          state.duplicateNode(id);
        });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedIds.length > 0) {
          state.selectedIds.forEach(id => state.removeNode(id));
        }
      } else if (e.key === 'Escape') {
        state.clearSelection();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
};
