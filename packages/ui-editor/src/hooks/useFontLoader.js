import { useEffect, useRef } from 'react';
import { useLayoutStore } from '../store/useLayoutStore';

// Simple Google Fonts loader: when a text element's fontFamily is set
// to a non-system font, inject a <link> tag for Google Fonts.
const SYSTEM_FONTS = new Set([
  'monospace', 'serif', 'sans-serif', 'cursive', 'fantasy',
  'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
  'arial', 'helvetica', 'georgia', 'times new roman', 'courier new',
  'verdana', 'tahoma', 'trebuchet ms', 'impact', 'comic sans ms',
  'inter', '-apple-system', 'blinkmacsystemfont', 'segoe ui',
  'roboto', 'opensans', 'open sans', 'lato', 'montserrat', 'poppins',
  'noto sans', 'noto serif', 'source sans pro', 'source serif pro',
]);

const loadedFonts = new Set();

function loadGoogleFont(fontFamily) {
  const clean = fontFamily.replace(/["']/g, '').trim().toLowerCase();
  if (SYSTEM_FONTS.has(clean) || loadedFonts.has(clean)) return;
  loadedFonts.add(clean);

  // Check if already loaded
  const existing = document.getElementById('lt-fonts');
  const linkText = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('+');
  const href = `https://fonts.googleapis.com/css2?family=${linkText}:wght@400;700&display=swap`;

  if (existing) {
    // Add to existing stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  } else {
    const link = document.createElement('link');
    link.id = 'lt-fonts';
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

export const useFontLoader = () => {
  const nodes = useLayoutStore(s => s.nodes);
  const loaded = useRef(new Set());

  useEffect(() => {
    const families = new Set();
    Object.values(nodes).forEach(n => {
      if (n.type === 'text' && n.props.fontFamily) {
        families.add(n.props.fontFamily.replace(/["']/g, '').trim());
      }
    });
    families.forEach(f => {
      const key = f.toLowerCase();
      if (!loaded.current.has(key)) {
        loaded.current.add(key);
        loadGoogleFont(f);
      }
    });
  }, [nodes]);
};
