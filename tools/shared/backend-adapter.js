/**
 * Backend Adapter
 * Centralizes all backend API calls (fetching data, saving, listing/uploading assets).
 * This makes it easier to swap out the underlying transport (e.g., from Vite/fetch to Electron IPC) in the future.
 */

import { fetchJSON } from './utils.js';

export const backend = {
  /**
   * Fetch project data files
   */
  async fetchGameConfig() {
    return fetchJSON('/data/game.json');
  },
  
  async fetchCharacters() {
    return fetchJSON('/data/characters.json');
  },
  
  async fetchVariables() {
    return fetchJSON('/data/variables.json');
  },
  
  async fetchTheme() {
    return fetchJSON('/data/theme.json').catch(() => ({}));
  },
  
  async fetchScene(id) {
    return fetchJSON(`/data/scenes/${id}.json`);
  },

  /**
   * Save entire project state
   */
  async saveProject(data) {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Save failed');
    return res;
  },

  /**
   * Assets API
   */
  async listAssets() {
    const res = await fetch('/api/list-assets');
    if (!res.ok) throw new Error('Failed to list assets');
    return res.json();
  },

  async uploadAsset(category, filename, base64) {
    const res = await fetch('/api/upload-asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, filename, base64 })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  }
};
