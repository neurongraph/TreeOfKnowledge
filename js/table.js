import { getTree, getSelected, setSelected, findNode } from './store.js';

export function renderTable(container) {
  const tree       = getTree();
  const selectedId = getSelected();
  if (!tree) return;

  const selectedNode = findNode(tree, selectedId) ?? tree;
  const rows = flattenSubtree(selectedNode, 0);

  container.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'tok-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Title</th>
    <th>Summary</th>
    <th>Key Concepts</th>
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach(({ node, depth }) => tbody.appendChild(buildRow(node, depth, selectedId)));
  table.appendChild(tbody);
  container.appendChild(table);
}

function flattenSubtree(node, depth) {
  const result = [{ node, depth }];
  if (node.expanded || depth === 0) {
    node.children.forEach(child => result.push(...flattenSubtree(child, depth + 1)));
  }
  return result;
}

function buildRow(node, depth, selectedId) {
  const isFolder = node.children.length > 0;
  const tr = document.createElement('tr');
  if (node.id === selectedId) tr.classList.add('selected');

  const titleTd = document.createElement('td');
  titleTd.className = 'col-title' + (isFolder ? ' folder' : '');
  titleTd.style.paddingLeft = `${10 + depth * 16}px`;
  titleTd.textContent = (isFolder ? (node.expanded ? '▼ ' : '▶ ') : '') + node.title;

  const summaryTd = document.createElement('td');
  summaryTd.className = 'col-summary' + (node.status === 'loading' ? ' streaming' : '');
  summaryTd.dataset.summaryId = node.id;

  if (node.status === 'loading') {
    summaryTd.textContent = Array.isArray(node.summary) ? node.summary.join(' ') : (node.summary ?? '⏳ Generating…');
    summaryTd.dataset.streaming = '1';
  } else if (node.status === 'done') {
    renderSummary(summaryTd, node.summary);
  } else if (node.status === 'error') {
    summaryTd.textContent = '⚠ Error generating summary';
  }

  const conceptsTd = document.createElement('td');
  (node.concepts ?? []).forEach(c => {
    const pill = document.createElement('span');
    pill.className = 'concept-pill';
    pill.textContent = c;
    conceptsTd.appendChild(pill);
  });

  tr.appendChild(titleTd);
  tr.appendChild(summaryTd);
  tr.appendChild(conceptsTd);

  tr.addEventListener('click', () => setSelected(node.id));
  return tr;
}

function renderSummary(td, summary) {
  if (!summary) return;
  const bullets = Array.isArray(summary) ? summary : [summary];
  if (bullets.length <= 1) {
    td.textContent = bullets[0] ?? '';
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'summary-bullets';
  bullets.forEach(b => {
    const li = document.createElement('li');
    li.textContent = b;
    ul.appendChild(li);
  });
  td.appendChild(ul);
}
