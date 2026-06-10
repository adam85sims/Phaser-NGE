/**
 * Narrative Engine — Shared Utilities
 * Used by all view modules.
 */

/** Document ID shorthand */
export const $ = id => document.getElementById(id);

/** Fetch JSON with error handling */
export async function fetchJSON(url) {
  const sep = url.includes('?') ? '&' : '?';
  const r = await fetch(`${url}${sep}t=${Date.now()}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.json();
}

/** Set status text + state class on an element */
export function setStatus(el, text, state) {
  if (!el) return;
  el.textContent = text;
  el.className = 'status ' + (state || '');
}

/** Debounce a function */
export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Count words in all dialogue nodes */
export function countWords(nodes) {
  return (nodes || []).reduce((sum, n) => {
    if (n.text) sum += n.text.split(/\s+/).filter(Boolean).length;
    if (n.choices) n.choices.forEach(c => {
      if (c.text) sum += c.text.split(/\s+/).filter(Boolean).length;
    });
    return sum;
  }, 0);
}

/** Count total choices across nodes */
export function countChoices(nodes) {
  return (nodes || []).reduce((sum, n) => sum + (n.choices?.length || 0), 0);
}

/** Get a scene's node count */
export function countNodes(nodes) {
  return nodes?.length || 0;
}

/** Safely get a nested value */
export function get(obj, path, fallback) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : fallback), obj);
}

/** Format a timestamp for display */
export function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
