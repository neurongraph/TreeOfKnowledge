import { setTree, setSelected, on } from './store.js';
import { ingestDirectory, buildTreeFromFileList } from './ingest.js';
import { renderTree }  from './tree.js';
import { renderTable } from './table.js';

const screens = {
  welcome: document.getElementById('screen-welcome'),
  ingest:  document.getElementById('screen-ingest'),
  main:    document.getElementById('screen-main'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── Welcome screen ──────────────────────────────────────
screens.welcome.innerHTML = `
  <h1 class="welcome-title">Tree of Knowledge</h1>
  <p class="welcome-subtitle">Explore books and documents as an interactive knowledge tree</p>
  <button class="btn-primary" id="btn-open">📂 Open Folder</button>
  <p class="welcome-hint">Supports .md and .pdf — folders become sections</p>
  <button class="btn-secondary" id="btn-files">or select files manually (Firefox)</button>
  <input type="file" id="input-files" multiple accept=".md,.pdf" webkitdirectory style="display:none">
`;

document.getElementById('btn-open').addEventListener('click', async () => {
  try {
    const dirHandle = await window.showDirectoryPicker();
    await runIngest(dirHandle);
  } catch (err) {
    if (err.name !== 'AbortError') console.error(err);
  }
});

document.getElementById('btn-files').addEventListener('click', () => {
  document.getElementById('input-files').click();
});

document.getElementById('input-files').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  await runIngestFiles(files);
});

// ── Ingest ───────────────────────────────────────────────
function showProgress() {
  showScreen('ingest');
  screens.ingest.innerHTML = `
    <p class="ingest-label">Reading your files…</p>
    <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
    <p class="ingest-file" id="ingest-file">Starting…</p>
  `;
}

function updateProgress(done, total, name) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('ingest-file').textContent = name;
}

async function runIngest(dirHandle) {
  showProgress();
  const root = await ingestDirectory(dirHandle, updateProgress);
  finishIngest(root);
}

async function runIngestFiles(files) {
  showProgress();
  const root = await buildTreeFromFileList(files, updateProgress);
  finishIngest(root);
}

function finishIngest(root) {
  setTree(root);
  setSelected(root.id);
  screens.main.innerHTML = `
    <div id="panel-tree"></div>
    <div id="panel-table"></div>
  `;
  showScreen('main');

  const treeEl  = document.getElementById('panel-tree');
  const tableEl = document.getElementById('panel-table');

  renderTree(treeEl);
  renderTable(tableEl);

  on('tree:change',    () => renderTree(treeEl));
  on('select:change',  () => renderTable(tableEl));
  on('summary:change', () => renderTable(tableEl));
}
