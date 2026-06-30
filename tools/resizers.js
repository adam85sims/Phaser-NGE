/**
 * resizers.js — Panel resize handles for outline, inspector, and workspace panels.
 */
export function initResizers() {
  document.querySelectorAll('.resizer').forEach(resizer => {
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const type = resizer.dataset.resize;
      const isHorizontal = type === 'workspace';
      const startPos = isHorizontal ? e.clientY : e.clientX;
      const root = document.documentElement;

      const propMap = {
        outline:   '--sidebar-w',
        inspector: '--inspector-w',
        workspace: '--workspace-h'
      };
      const prop = propMap[type];
      const startSize = parseInt(getComputedStyle(root).getPropertyValue(prop)) || 0;

      const bounds = {
        outline:   [120, 600],
        inspector: [120, 600],
        workspace: [60, window.innerHeight - 80]
      };
      const [minSize, maxSize] = bounds[type];

      resizer.classList.add('active');
      document.body.style.cursor = isHorizontal ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev) => {
        const curPos = isHorizontal ? ev.clientY : ev.clientX;
        const delta = curPos - startPos;

        let newSize;
        if (type === 'outline') {
          newSize = startSize + delta;
        } else if (type === 'inspector') {
          newSize = startSize - delta;
        } else {
          newSize = startSize - delta;
        }

        newSize = Math.max(minSize, Math.min(maxSize, newSize));
        root.style.setProperty(prop, newSize + 'px');
      };

      const onUp = () => {
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}
