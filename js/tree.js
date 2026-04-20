import { getTree, getSelected, setSelected, setStatus, setSummary, getSettings } from './store.js';
import { summarize } from './ollama.js';

export function renderTree(container) {
  const root = getTree();
  if (!root) return;
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'tree-header';
  header.textContent = root.title;
  container.appendChild(header);

  root.children.forEach(child => container.appendChild(buildNodeEl(child, 1, container)));
}

function buildNodeEl(node, depth, treeContainer) {
  const isFolder = node.children.length > 0;
  const selectedId = getSelected();

  const wrapper = document.createElement('div');

  const row = document.createElement('div');
  row.className = 'tree-node' + (node.id === selectedId ? ' selected' : '');
  row.style.paddingLeft = `${8 + depth * 14}px`;

  const arrowEl = document.createElement('span');
  arrowEl.className = 'node-arrow';
  arrowEl.textContent = isFolder ? (node.expanded ? '▼' : '▶') : '○';

  const labelEl = document.createElement('span');
  labelEl.className = 'node-label';
  labelEl.textContent = node.title;

  const statusEl = document.createElement('span');
  statusEl.className = `node-status ${node.status}`;
  statusEl.textContent = node.status === 'loading' ? '⏳'
                        : node.status === 'done'   ? '✦'
                        : node.status === 'error'  ? '⚠'
                        : '';

  row.appendChild(arrowEl);
  row.appendChild(labelEl);
  row.appendChild(statusEl);
  wrapper.appendChild(row);

  if (isFolder && node.expanded) {
    node.children.forEach(child =>
      wrapper.appendChild(buildNodeEl(child, depth + 1, treeContainer))
    );
  }

  arrowEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isFolder) return;
    const wasExpanded = node.expanded;
    node.expanded = !wasExpanded;
    if (wasExpanded && node.status === 'pending') {
      triggerSummary(node, 'folder');
    }
    const panelTree = treeContainer.closest('#panel-tree') ?? treeContainer;
    renderTree(panelTree);
  });

  row.addEventListener('click', () => {
    setSelected(node.id);
    if (isFolder) {
      triggerChildLeafSummaries(node);
    } else if (node.status === 'pending') {
      triggerSummary(node, 'leaf');
    }
  });

  return wrapper;
}

async function triggerChildLeafSummaries(folderNode) {
  for (const child of folderNode.children) {
    if (child.children.length === 0 && child.status === 'pending') {
      await triggerSummary(child, 'leaf');
    }
  }
}

async function triggerSummary(node, type) {
  setStatus(node.id, 'loading');

  try {
    const { summary, concepts } = await summarize(node, type, (token) => {
      const cell = document.querySelector(`[data-summary-id="${node.id}"]`);
      if (cell) {
        if (!cell.dataset.streaming) {
          cell.textContent = '';
          cell.dataset.streaming = '1';
        }
        cell.textContent += token;
      }
    });
    setSummary(node.id, summary, concepts);
  } catch (err) {
    setStatus(node.id, 'error');
    const msg = err.message === 'timeout'
      ? '⚠ Timed out'
      : err.message === 'unreachable'
        ? `⚠ Cannot connect to Ollama at ${getSettings().ollamaUrl}`
        : `⚠ Error: ${err.message}`;

    const cell = document.querySelector(`[data-summary-id="${node.id}"]`);
    if (cell) {
      cell.textContent = msg;
      const retryBtn = document.createElement('button');
      retryBtn.textContent = 'Retry';
      retryBtn.style.cssText =
        'margin-left:8px;font-size:11px;cursor:pointer;background:var(--bg-row);color:var(--text-dim);border:none;border-radius:4px;padding:2px 8px';
      retryBtn.onclick = () => {
        node.status = 'pending';
        delete cell.dataset.streaming;
        triggerSummary(node, type);
      };
      cell.appendChild(retryBtn);
    }
  }
}
