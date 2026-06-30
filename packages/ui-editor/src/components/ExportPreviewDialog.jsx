import React, { useState, useMemo } from 'react';
import { useLayoutStore } from '../store/useLayoutStore';
import { exportLayoutToJSON } from '../utils/exporter';
import { exportToNGE } from '../utils/adapters/nge';
import { exportToGodot } from '../utils/adapters/godot';
import { exportToUnity } from '../utils/adapters/unity';
import { exportToUnreal } from '../utils/adapters/unreal';

const TABS = [
  { id: 'json', label: 'Raw JSON' },
  { id: 'nge', label: 'NGE (Phaser 4)' },
  { id: 'godot', label: 'Godot 4' },
  { id: 'unity', label: 'Unity' },
  { id: 'unreal', label: 'Unreal' },
];

export const ExportPreviewDialog = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('json');
  const nodes = useLayoutStore(s => s.nodes);
  const [copied, setCopied] = useState(false);

  const outputs = useMemo(() => {
    try {
      const jsonStr = exportLayoutToJSON(nodes);
      const jsonObj = JSON.parse(jsonStr);
      
      return {
        json: jsonStr,
        nge: exportToNGE(jsonObj) || 'NGE adapter returned null (maybe empty layout?)',
        godot: exportToGodot(jsonObj),
        unity: exportToUnity(jsonObj),
        unreal: exportToUnreal(jsonObj),
      };
    } catch (e) {
      console.error(e);
      return {
        json: `Error generating export: ${e.message}`,
        nge: 'Error',
        godot: 'Error',
        unity: 'Error',
        unreal: 'Error',
      };
    }
  }, [nodes]);

  const activeOutput = outputs[activeTab] || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(typeof activeOutput === 'object' ? JSON.stringify(activeOutput, null, 2) : activeOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderOutput = (output) => {
    if (typeof output === 'object') {
      return JSON.stringify(output, null, 2);
    }
    return output;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl flex flex-col w-full max-w-5xl h-full max-h-[85vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Export Preview</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 border-b border-slate-700 gap-4 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-blue-500 text-white' 
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col relative p-6 bg-slate-900 rounded-b-lg">
          <button 
            onClick={handleCopy}
            className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors"
          >
            {copied ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
            )}
          </button>
          
          <pre className="flex-1 overflow-auto text-xs font-mono text-slate-300">
            <code>{renderOutput(activeOutput)}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ExportPreviewDialog;
