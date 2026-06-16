/**
 * Backend Adapter
 * Centralizes all backend API calls (fetching data, saving, listing/uploading assets).
 * This makes it easier to swap out the underlying transport (e.g., from Vite/fetch to Electron IPC) in the future.
 */

import { fetchJSON } from './utils.js';

export const backend = {
  /**
   * Generic API request wrapper
   */
  async request(url, body) {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },

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

  async fetchAnimation(id) {
    return fetchJSON(`/data/animations/${id}.json`);
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.warnings) {
        throw new Error('WARNINGS:' + JSON.stringify(err.warnings));
      }
      throw new Error(err.error || 'Save failed');
    }
    const json = await res.json();
    if (json.warnings && json.warnings.length > 0) {
      console.warn('Save completed with warnings:', json.warnings);
      // We could dispatch an event here, but throwing a specific Error format is easier for now
      throw new Error('WARNINGS:' + JSON.stringify(json.warnings));
    }
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
