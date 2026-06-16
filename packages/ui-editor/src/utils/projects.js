const STORAGE_KEY = 'layouteer_saved_projects';

export const savedProjects = {
  list() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  },

  save(name, state) {
    const projects = this.list();
    const project = {
      id: Date.now().toString(36),
      name,
      savedAt: new Date().toISOString(),
      data: {
        nodes: state.nodes,
        gridSize: state.gridSize,
        snapToGrid: state.snapToGrid
      }
    };
    const existing = projects.findIndex(p => p.name === name);
    if (existing >= 0) {
      projects[existing] = project;
    } else {
      projects.push(project);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return project;
  },

  load(id) {
    const projects = this.list();
    return projects.find(p => p.id === id) || null;
  },

  delete(id) {
    const projects = this.list().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  },

  autoSave(state) {
    // Quick-save to an auto-save slot
    const project = {
      id: 'autosave',
      name: 'Auto Save',
      savedAt: new Date().toISOString(),
      data: {
        nodes: state.nodes,
        gridSize: state.gridSize,
        snapToGrid: state.snapToGrid
      }
    };
    localStorage.setItem('layouteer_autosave', JSON.stringify(project));
  },

  loadAutoSave() {
    try {
      return JSON.parse(localStorage.getItem('layouteer_autosave'));
    } catch {
      return null;
    }
  },

  clearAutoSave() {
    localStorage.removeItem('layouteer_autosave');
  }
};
