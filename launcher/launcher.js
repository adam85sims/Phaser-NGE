document.addEventListener('DOMContentLoaded', async () => {
  const btnOpen = document.getElementById('btn-open');
  const btnNew = document.getElementById('btn-new');
  const projectDiv = document.getElementById('current-project');
  const recentList = document.getElementById('recent-list');
  const launcherContent = document.getElementById('launcher-content');

  // Format relative time helper
  function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  // Load and render recent projects
  async function loadRecentProjects() {
    if (!window.electron || !window.electron.getRecentProjects) {
      launcherContent.classList.add('no-recent');
      return;
    }

    try {
      const projects = await window.electron.getRecentProjects();
      if (!projects || projects.length === 0) {
        launcherContent.classList.add('no-recent');
        return;
      }

      launcherContent.classList.remove('no-recent');
      recentList.innerHTML = '';

      projects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'recent-item';
        
        const info = document.createElement('div');
        info.className = 'recent-info';
        
        const name = document.createElement('div');
        name.className = 'recent-name';
        name.innerText = project.name || 'Unnamed Project';
        name.title = project.name || 'Unnamed Project';
        
        const path = document.createElement('div');
        path.className = 'recent-path';
        path.innerText = project.path;
        path.title = project.path;

        const meta = document.createElement('div');
        meta.className = 'recent-meta';
        meta.innerText = `Opened ${formatRelativeTime(project.lastOpened)}`;

        info.appendChild(name);
        info.appendChild(path);
        info.appendChild(meta);

        const btnRemove = document.createElement('button');
        btnRemove.className = 'btn-remove';
        btnRemove.innerHTML = '&times;';
        btnRemove.title = 'Remove from recent';
        btnRemove.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Remove "${project.name}" from the recent projects list?`)) {
            await window.electron.removeRecentProject(project.path);
            loadRecentProjects();
          }
        });

        item.appendChild(info);
        item.appendChild(btnRemove);

        // Click to open recent project
        item.addEventListener('click', async () => {
          const res = await window.electron.setProjectRoot(project.path);
          if (res.success) {
            // Update timestamp
            await addProject(project.path);
            window.location.href = '/tools/index.html';
          } else {
            if (res.error === 'not_found' || res.error === 'not_directory') {
              if (confirm(`The folder at "${project.path}" no longer exists or is inaccessible.\n\nWould you like to remove it from the recent projects list?`)) {
                await window.electron.removeRecentProject(project.path);
                loadRecentProjects();
              }
            } else {
              alert('Could not open project: ' + res.error);
            }
          }
        });

        recentList.appendChild(item);
      });
    } catch (err) {
      console.error('Failed to load recent projects', err);
      launcherContent.classList.add('no-recent');
    }
  }

  // Fetch current project status (just in case)
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

  // Initial load
  await loadRecentProjects();

  const checkElectron = () => {
    if (!window.electron || !window.electron.openFolderDialog) {
      alert('Electron API not available. Are you running in a browser?');
      return false;
    }
    return true;
  };

  // Add project to recent projects list helper
  const addProject = async (projectPath) => {
    if (!window.electron || !window.electron.addRecentProject) return;
    let projectName = 'Unnamed Project';
    try {
      const res = await fetch('/data/game.json');
      if (res.ok) {
        const gameData = await res.json();
        projectName = gameData.title || projectName;
      }
    } catch (e) {
      console.warn('Could not read project title', e);
    }
    await window.electron.addRecentProject({ path: projectPath, name: projectName });
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
      await addProject(selectedPath);
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
            { id: "n1", type: "dialogue", speaker: "narrator", text: "Welcome to your new game!", x: 400, y: 300, next: null }
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

      await addProject(pendingProjectPath);
      window.location.href = '/tools/index.html';
    } catch (err) {
      alert('Error creating project: ' + err.message);
    }
  });
});
