/**
 * Script Editor — Monaco-based code editor for JavaScript files.
 * Integrated with the Files tab: double-click .js files to open.
 */
import loader from '@monaco-editor/loader';

let _app = null;
let _editor = null;
let _currentFile = null;
let _monaco = null;

export function init(app) {
  _app = app;
}

export async function render(container, app) {
  _app = app;
  
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <!-- Toolbar -->
      <div class="view-toolbar" style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid var(--border);background:var(--bg-panel)">
        <div style="display:flex;align-items:center;gap:8px">
          <span id="script-filename" class="text-dim" style="font-size:12px">No file open</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="btn btn-sm" id="btn-save-script" disabled>💾 Save</button>
          <button class="btn btn-sm" id="btn-format-script" disabled>⇧⏎ Format</button>
        </div>
      </div>
      
      <!-- Editor Container -->
      <div id="monaco-container" style="flex:1;overflow:hidden"></div>
      
      <!-- Status Bar -->
      <div id="script-status" style="padding:4px 12px;font-size:11px;border-top:1px solid var(--border);background:var(--bg-panel);display:flex;justify-content:space-between">
        <span class="text-dim">Ready</span>
        <span id="cursor-position" class="text-dim">Ln 1, Col 1</span>
      </div>
    </div>
  `;
  
  // Initialize Monaco
  await _initMonaco();
  
  // Bind buttons
  document.getElementById('btn-save-script')?.addEventListener('click', _saveFile);
  document.getElementById('btn-format-script')?.addEventListener('click', _formatCode);
}

async function _initMonaco() {
  const container = document.getElementById('monaco-container');
  if (!container) return;
  
  // Configure Monaco loader
  loader.config({
    paths: {
      vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs'
    }
  });
  
  try {
    _monaco = await loader.init();
    
    // Create editor with dark theme
    _editor = _monaco.editor.create(container, {
      value: '// Select a JavaScript file from the Files tab to edit\n',
      language: 'javascript',
      theme: 'vs-dark-custom',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      cursorStyle: 'line',
      cursorBlinking: 'smooth',
      smoothScrolling: true,
      contextmenu: true,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      wordWrap: 'off',
      folding: true,
      foldingHighlight: true,
      matchBrackets: 'always',
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnPaste: true,
      formatOnType: true,
      scrollBeyondLastLine: true,
      rulers: [],
      renderLineHighlight: 'all',
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      }
    });
    
    // Define custom dark theme matching editor-v2
    _monaco.editor.defineTheme('vs-dark-custom', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'string', foreground: 'fbbf24' },
        { token: 'keyword', foreground: '5b9eff' },
        { token: 'number', foreground: '4ade80' },
        { token: 'type', foreground: 'f472b6' },
        { token: 'class', foreground: 'f472b6' },
        { token: 'function', foreground: '60a5fa' },
        { token: 'variable', foreground: 'd4d8df' },
        { token: 'operator', foreground: '5b9eff' }
      ],
      colors: {
        'editor.background': '#1a1d24',
        'editor.foreground': '#d4d8df',
        'editor.lineHighlightBackground': '#22262e',
        'editorCursor.foreground': '#5b9eff',
        'editor.selectionBackground': '#2a4a7a',
        'editor.inactiveSelectionBackground': '#1f2937',
        'editorIndentGuide.background': '#2e333d',
        'editorIndentGuide.activeBackground': '#3a4049',
        'editorLineNumber.foreground': '#5a6170',
        'editorLineNumber.activeForeground': '#8a91a0',
        'editor minimap.background': '#1a1d24',
        'scrollbarSlider.background': '#2e333d80',
        'scrollbarSlider.hoverBackground': '#3a404980',
        'scrollbarSlider.activeBackground': '#5b9eff80'
      }
    });
    
    _monaco.editor.setTheme('vs-dark-custom');
    
    // Track cursor position
    _editor.onDidChangeCursorPosition((e) => {
      const pos = document.getElementById('cursor-position');
      if (pos) {
        pos.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
      }
    });
    
    // Track content changes
    _editor.onDidChangeModelContent(() => {
      const status = document.getElementById('script-status');
      if (status) {
        status.innerHTML = '<span style="color:var(--warning)">● Unsaved changes</span>';
      }
      document.getElementById('btn-save-script').disabled = false;
    });
    
  } catch (err) {
    console.error('Failed to load Monaco:', err);
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;color:var(--text-muted)">
        <span style="font-size:48px;opacity:0.3;margin-bottom:16px">⚠️</span>
        <div style="font-size:14px">Failed to load code editor</div>
        <div style="font-size:12px;margin-top:4px">${err.message}</div>
      </div>
    `;
  }
}

export function openFile(path, content) {
  if (!_editor) return;
  
  _currentFile = path;
  const ext = path.split('.').pop()?.toLowerCase();
  
  // Set language based on extension
  const langMap = {
    'js': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'html': 'html',
    'css': 'css',
    'md': 'markdown',
    'yaml': 'yaml',
    'yml': 'yaml'
  };
  
  const language = langMap[ext] || 'plaintext';
  
  // Update editor
  _editor.setValue(content || '');
  _monaco.editor.setModelLanguage(_editor.getModel(), language);
  
  // Update UI
  const filenameEl = document.getElementById('script-filename');
  if (filenameEl) {
    filenameEl.textContent = path;
    filenameEl.classList.remove('text-dim');
  }
  
  document.getElementById('btn-save-script').disabled = false;
  document.getElementById('btn-format-script').disabled = false;
  document.getElementById('script-status').innerHTML = '<span class="text-dim">Ready</span>';
  
  console.log('Opened file:', path, '(language:', language + ')');
}

export function getCurrentContent() {
  return _editor ? _editor.getValue() : null;
}

async function _saveFile() {
  if (!_currentFile || !_editor) return;
  
  const content = _editor.getValue();
  console.log('Save file:', _currentFile);
  // Future: POST to backend API
  // await fetch('/api/save-file', { method: 'POST', body: JSON.stringify({ path: _currentFile, content }) });
  
  document.getElementById('script-status').innerHTML = '<span style="color:var(--success)">✓ Saved</span>';
  document.getElementById('btn-save-script').disabled = true;
  
  setTimeout(() => {
    document.getElementById('script-status').innerHTML = '<span class="text-dim">Ready</span>';
  }, 2000);
}

function _formatCode() {
  if (!_editor) return;
  
  _editor.getAction('editor.action.formatDocument').run();
}

// Global exports for file interaction
window.__openScript = openFile;
window.__getScriptContent = getCurrentContent;
