import React, { useRef, useCallback } from 'react';

/**
 * Color picker with full alpha channel support.
 * Native <input type="color"> for picking the base hue,
 * a hex text input for manual entry (#RRGGBB or #RRGGBBAA),
 * and an alpha slider for transparency.
 */
const ColorPicker = ({ value = '', onChange, label }) => {
  const nativeRef = useRef(null);

  // Extract components
  const baseHex = (value || '#000000').slice(0, 7);
  const alphaHex = value.length === 9 ? value.slice(7) : 'ff';
  const alphaDecimal = parseInt(alphaHex, 16) || 255;

  const handleNativeChange = useCallback((e) => {
    const newBase = e.target.value;
    onChange(`${newBase}${alphaHex}`);
  }, [onChange, alphaHex]);

  const handleTextChange = useCallback((e) => {
    let v = e.target.value;
    if (v && !v.startsWith('#')) v = '#' + v;
    onChange(v);
  }, [onChange]);

  const handleAlphaChange = useCallback((e) => {
    const newAlpha = parseInt(e.target.value, 10);
    const hex = Math.round(newAlpha).toString(16).padStart(2, '0');
    onChange((value || '#000000').slice(0, 7) + hex);
  }, [onChange, value]);

  return (
    <div>
      {label && <label className="block text-xs text-slate-500 mb-1">{label}</label>}
      <div className="flex items-center gap-2">
        {/* Swatch with checkerboard for transparency */}
        <div className="relative w-8 h-8 shrink-0 rounded border border-slate-600 overflow-hidden"
             style={{ backgroundImage: 'linear-gradient(45deg, #4a4a4a 25%, transparent 25%), linear-gradient(-45deg, #4a4a4a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #4a4a4a 75%), linear-gradient(-45deg, transparent 75%, #4a4a4a 75%)',
                      backgroundSize: '8px 8px',
                      backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px' }}>
          <button
            onClick={() => nativeRef.current?.click()}
            className="absolute inset-0 hover:ring-2 hover:ring-blue-500 transition-shadow rounded"
            style={{ backgroundColor: baseHex, opacity: alphaDecimal / 255 }}
            title="Pick color"
          />
        </div>
        <input
          ref={nativeRef}
          type="color"
          value={baseHex}
          onChange={handleNativeChange}
          className="sr-only"
        />
        <input
          type="text"
          value={value}
          onChange={handleTextChange}
          placeholder="#ffffff"
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500 font-mono text-xs min-w-0"
        />
      </div>
      {/* Alpha slider */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-slate-500 w-8 shrink-0">Alpha</span>
        <div className="flex-1 relative h-4 rounded overflow-hidden"
             style={{ backgroundImage: 'linear-gradient(45deg, #4a4a4a 25%, transparent 25%), linear-gradient(-45deg, #4a4a4a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #4a4a4a 75%), linear-gradient(-45deg, transparent 75%, #4a4a4a 75%)',
                      backgroundSize: '6px 6px',
                      backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px' }}>
          <div className="absolute inset-0 rounded"
               style={{ background: `linear-gradient(to right, transparent, ${baseHex})` }} />
          <input
            type="range"
            min="0" max="255"
            value={alphaDecimal}
            onChange={handleAlphaChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <span className="text-[10px] text-slate-400 w-6 text-right font-mono">{alphaDecimal}</span>
      </div>
    </div>
  );
};

export default ColorPicker;
