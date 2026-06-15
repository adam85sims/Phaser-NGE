document.addEventListener('DOMContentLoaded', async () => {
  const btnOpen = document.getElementById('btn-open');
  const btnNew = document.getElementById('btn-new');
  const projectDiv = document.getElementById('current-project');

  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.projectRoot) {
      projectDiv.style.display = 'block';
      projectDiv.innerText = `Current: ${data.projectRoot}`;
    }
  } catch (err) {
    console.warn('Could not fetch status', err);
  }

  const checkElectron = () => {
    if (!window.electron || !window.electron.openFolderDialog) {
      alert('Electron API not available. Are you running in a browser?');
      return false;
    }
    return true;
  };

  btnOpen.addEventListener('click', async () => {
    if (!checkElectron()) return;
    const selectedPath = await window.electron.openFolderDialog();
    if (selectedPath) {
      try {
        const res = await fetch('/data/game.json');
        if (!res.ok) {
          if (!confirm('This folder does not appear to contain a valid game.json. Open anyway?')) {
            return;
          }
        }
      } catch (e) {
      }
      window.location.href = '/tools/index.html';
    }
  });

  const modal = document.getElementById('new-project-modal');
  const inputName = document.getElementById('project-name');
  const btnCancel = document.getElementById('btn-cancel');
  const btnConfirm = document.getElementById('btn-confirm');

  let pendingProjectPath = null;

  btnNew.addEventListener('click', async () => {
    if (!checkElectron()) return;
    const selectedPath = await window.electron.openFolderDialog();
    if (selectedPath) {
      pendingProjectPath = selectedPath;
      const folderName = selectedPath.split(/[\\/]/).pop() || 'New Project';
      inputName.value = folderName;
      modal.showModal();
    }
  });

  btnCancel.addEventListener('click', () => {
    modal.close();
    pendingProjectPath = null;
  });

  btnConfirm.addEventListener('click', async () => {
    const projectName = inputName.value.trim() || 'New Project';
    modal.close();

    const template = {
      game: {
        title: projectName,
        width: 1280,
        height: 720,
        schemaVersion: "1.0",
        version: "1.0.0",
        startScene: "start",
        scenes: ["start"],
        animations: [],
        defaults: { textSpeed: 40, autoAdvance: false, bgmVolume: 0.7, sfxVolume: 1 }
      },
      characters: {},
      variables: [],
      theme: {
        dialogue: {
          textBoxSize: { width: 1180, height: 180 },
          textBoxPosition: { x: 50, y: 520 },
          textSpeed: 40, fontSize: 28, fontFamily: "monospace",
          textColor: "#ffffff", backgroundColor: "#22224488",
          padding: { x: 30, y: 20 }, transitionDuration: 300
        },
        ui: {
          menu: { 
            background: "", 
            title: { text: projectName, x: 640, y: 220, font: "monospace", size: 56, color: "#ffffff" },
            subtitle: { text: "— A New Journey —", x: 640, y: 280, font: "monospace", size: 18, color: "#666688" },
            buttons: [
              { id: "start", label: "▶ Start Game", x: 640, y: 420, font: "monospace", size: 22, color: "#00ccff", hoverColor: "#ffffff" },
              { id: "continue", label: "▶ Continue", x: 640, y: 480, font: "monospace", size: 18, color: "#444444", hoverColor: "#88aa88" },
              { id: "settings", label: "▶ Settings", x: 640, y: 540, font: "monospace", size: 18, color: "#888888", hoverColor: "#ffffff" }
            ]
          },
          splash: { enabled: false }
        }
      },
      scenes: {
        start: {
          id: "start",
          entryNode: "n1",
          nodes: [
            { id: "n1", type: "dialogue", speaker: "narrator", text: "Welcome to your new game!", next: null }
          ]
        }
      },
      animations: {}
    };

    try {
      const res = await fetch('/api/project/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });

      if (!res.ok) throw new Error('Failed to create project');

      window.location.href = '/tools/index.html';
    } catch (err) {
      alert('Error creating project: ' + err.message);
    }
  });
});
